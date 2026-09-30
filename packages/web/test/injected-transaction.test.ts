import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitNativeReviveCall } from "../src/wallet/substrate/injected-transaction";
import { manifest, SOURCE_CONTRACT } from "./helpers";

const mocks = vi.hoisted(() => ({
  getApi: vi.fn(),
  web3Enable: vi.fn(),
  web3FromAddress: vi.fn(),
}));

vi.mock("../src/wallet/substrate/polkadot-js-client", () => ({ getPolkadotJsApi: mocks.getApi }));
vi.mock("@polkadot/extension-dapp", () => ({ web3Enable: mocks.web3Enable, web3FromAddress: mocks.web3FromAddress }));

function nativeJsApi(result: any) {
  const tx = {
    signAndSend: vi.fn((address: string, options: unknown, callback: (value: any) => void) => {
      callback(result);
      return Promise.resolve(() => {});
    }),
  };
  const api = {
    genesisHash: { toHex: () => `0x${"11".repeat(32)}` },
    runtimeMetadata: { toHex: () => "0x00" },
    runtimeVersion: { specVersion: { toString: () => "77", toNumber: () => 77 }, transactionVersion: { toString: () => "9" } },
    registry: { signedExtensions: ["AuthorizeCall", "CheckNonce"], findMetaError: vi.fn() },
    tx: { revive: { call: vi.fn().mockReturnValue(tx) } },
    rpc: { chain: { getHeader: vi.fn().mockResolvedValue({ number: 42 }) } },
  };
  return { api, tx };
}

const finalized = {
  status: { isReady: false, isBroadcast: false, isInBlock: false, isFinalized: true, isInvalid: false, isDropped: false, isUsurped: false, isRetracted: false, asFinalized: { toHex: () => `0x${"44".repeat(32)}` } },
  txHash: { toHex: () => `0x${"55".repeat(32)}` },
  events: [],
};

describe("injected Native transaction", () => {
  beforeEach(() => vi.clearAllMocks());
  it("builds revive.call with native units and signs with the selected SS58 account", async () => {
    const { api, tx } = nativeJsApi(finalized);
    const signer = { signPayload: vi.fn() };
    mocks.getApi.mockResolvedValueOnce(api);
    mocks.web3Enable.mockResolvedValueOnce([{ name: "SubWallet", version: "1.2.3" }]);
    mocks.web3FromAddress.mockResolvedValueOnce({ name: "SubWallet", version: "1.2.3", signer });

    const account = "5GrwvaEF5zXb26Fz9rcQpDWSJ8U1h4QqN9u2Xh5iQ3cP5k1";
    const result = await submitNativeReviveCall({
      manifest: manifest(), address: account, contractAddress: SOURCE_CONTRACT, value: 10_000_000_000n,
      weightLimit: { refTime: 100n, proofSize: 10n }, storageDepositLimit: 5n, data: "0x1234",
    });

    expect(api.tx.revive.call).toHaveBeenCalledWith(SOURCE_CONTRACT, "10000000000", { refTime: "100", proofSize: "10" }, "5", "0x1234");
    expect(tx.signAndSend).toHaveBeenCalledWith(account, { signer }, expect.any(Function));
    expect(result.blockNumber).toBe(42n);
  });

  it("normalizes a dispatch error to NATIVE_SUBMISSION_FAILED", async () => {
    const dispatchError = { isModule: true, asModule: "Balances.InsufficientBalance" };
    const { api } = nativeJsApi({ ...finalized, status: { ...finalized.status, isFinalized: false, isInBlock: true }, dispatchError });
    api.registry.findMetaError.mockReturnValue({ section: "balances", name: "InsufficientBalance", docs: ["not enough"] });
    mocks.getApi.mockResolvedValueOnce(api);
    mocks.web3Enable.mockResolvedValueOnce([{}]);
    mocks.web3FromAddress.mockResolvedValueOnce({ signer: {} });

    await expect(submitNativeReviveCall({
      manifest: manifest(), address: "selected-account", contractAddress: SOURCE_CONTRACT, value: 1n,
      weightLimit: { refTime: 1n, proofSize: 2n }, storageDepositLimit: 0n, data: "0x",
    })).rejects.toThrow("NATIVE_SUBMISSION_FAILED");
  });

  it("classifies an RPC submit rejection as NATIVE_SUBMISSION_FAILED and preserves the raw error", async () => {
    const { api, tx } = nativeJsApi(finalized);
    const rpcError = new Error("1010: Invalid Transaction: Transaction has a bad signature");
    tx.signAndSend.mockImplementationOnce(() => Promise.reject(rpcError));
    mocks.getApi.mockResolvedValueOnce(api);
    mocks.web3Enable.mockResolvedValueOnce([{}]);
    mocks.web3FromAddress.mockResolvedValueOnce({ signer: {} });
    const diagnostics: Record<string, unknown> = {};

    await expect(submitNativeReviveCall({
      manifest: manifest(), address: "selected-account", contractAddress: SOURCE_CONTRACT, value: 1n,
      weightLimit: { refTime: 1n, proofSize: 2n }, storageDepositLimit: 0n, data: "0x",
      onDiagnostic: (patch) => Object.assign(diagnostics, patch),
    })).rejects.toThrow("NATIVE_SUBMISSION_FAILED");

    expect(diagnostics.submissionError).toEqual({ description: rpcError.message, raw: rpcError });
    expect(diagnostics.signingError).toBeUndefined();
  });

  it("keeps an explicit wallet rejection as NATIVE_SIGNING_REJECTED", async () => {
    const { api, tx } = nativeJsApi(finalized);
    const walletError = Object.assign(new Error("User rejected the request"), { code: 4001 });
    tx.signAndSend.mockImplementationOnce(() => Promise.reject(walletError));
    mocks.getApi.mockResolvedValueOnce(api);
    mocks.web3Enable.mockResolvedValueOnce([{}]);
    mocks.web3FromAddress.mockResolvedValueOnce({ signer: {} });
    const diagnostics: Record<string, unknown> = {};

    await expect(submitNativeReviveCall({
      manifest: manifest(), address: "selected-account", contractAddress: SOURCE_CONTRACT, value: 1n,
      weightLimit: { refTime: 1n, proofSize: 2n }, storageDepositLimit: 0n, data: "0x",
      onDiagnostic: (patch) => Object.assign(diagnostics, patch),
    })).rejects.toThrow("NATIVE_SIGNING_REJECTED");

    expect(diagnostics.signingError).toEqual({ description: walletError.message, raw: walletError });
    expect(diagnostics.submissionError).toBeUndefined();
  });

  it("refreshes current runtime metadata even when the injected wallet reports the chain as known", async () => {
    const { api, tx } = nativeJsApi(finalized);
    Object.assign(api, {
      genesisHash: { toHex: () => `0x${"11".repeat(32)}` },
      runtimeMetadata: { toHex: () => "0x1234" },
    });
    const metadata = { get: vi.fn().mockResolvedValue([{ genesisHash: `0x${"11".repeat(32)}`, specVersion: 77 }]), provide: vi.fn().mockResolvedValue(true) };
    mocks.getApi.mockResolvedValueOnce(api);
    mocks.web3Enable.mockResolvedValueOnce([{}]);
    mocks.web3FromAddress.mockResolvedValueOnce({ name: "talisman", version: "3.8.0", signer: {}, metadata });
    const diagnostics: Record<string, unknown> = {};

    await submitNativeReviveCall({
      manifest: manifest(), address: "selected-account", contractAddress: SOURCE_CONTRACT, value: 1n,
      weightLimit: { refTime: 1n, proofSize: 2n }, storageDepositLimit: 0n, data: "0x",
      onDiagnostic: (patch) => Object.assign(diagnostics, patch),
    });

    expect(metadata.provide).toHaveBeenCalledWith(expect.objectContaining({
      chain: manifest().source.name,
      genesisHash: `0x${"11".repeat(32)}`,
      specVersion: 77,
      tokenDecimals: 10,
      tokenSymbol: "DOT",
      rawMetadata: "0x1234",
    }));
    expect(diagnostics.injectorMetadataKnown).toBe(true);
    expect(diagnostics.injectorMetadataProvided).toBe(true);
    expect(tx.signAndSend).toHaveBeenCalled();
  });

  it("rejects a genesis mismatch before requesting the wallet", async () => {
    const { api } = nativeJsApi(finalized);
    api.genesisHash = { toHex: () => `0x${"99".repeat(32)}` };
    mocks.getApi.mockResolvedValueOnce(api);

    await expect(submitNativeReviveCall({
      manifest: manifest(), address: "selected-account", contractAddress: SOURCE_CONTRACT, value: 1n,
      weightLimit: { refTime: 1n, proofSize: 2n }, storageDepositLimit: 0n, data: "0x",
    })).rejects.toThrow("NATIVE_NETWORK_MISMATCH");

    expect(mocks.web3Enable).not.toHaveBeenCalled();
  });

  it("classifies Paseo AuthorizeValueTransfer BadProof as runtime incompatible", async () => {
    const { api, tx } = nativeJsApi(finalized);
    api.registry.signedExtensions = ["AuthorizeValueTransfer", "CheckNonce"];
    tx.signAndSend.mockImplementationOnce(() => Promise.reject(new Error('{"type":"Invalid","value":{"type":"BadProof"}}')));
    mocks.getApi.mockResolvedValueOnce(api);
    mocks.web3Enable.mockResolvedValueOnce([{}]);
    mocks.web3FromAddress.mockResolvedValueOnce({ signer: { signPayload: vi.fn() } });

    await expect(submitNativeReviveCall({
      manifest: manifest(), address: "selected-account", contractAddress: SOURCE_CONTRACT, value: 1n,
      weightLimit: { refTime: 1n, proofSize: 2n }, storageDepositLimit: 0n, data: "0x",
    })).rejects.toThrow("NATIVE_RUNTIME_INCOMPATIBLE");
  });
});

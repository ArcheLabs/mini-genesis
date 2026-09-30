import { describe, expect, it, vi } from "vitest";
import { hexToBytes, type Address } from "viem";
import { createNativeDiagnostic, createSubstrateExecutionAdapter, estimateNativeMax, inspectWeightShape, recordSimulationDiagnostic, validateNativeEvents, validatePolkadotJsNativeEvents, validateWeightRequired } from "../src/genesis/execution/substrate";
import { parseDotAmount } from "../src/genesis/amount";
import { readNativeBalance } from "../src/wallet/substrate/balance";
import { ACCOUNT, contributedLog, manifest, SOURCE_CONTRACT } from "./helpers";

const mocks = vi.hoisted(() => ({ submitNativeReviveCall: vi.fn() }));
vi.mock("../src/wallet/substrate/injected-transaction", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/wallet/substrate/injected-transaction")>()),
  submitNativeReviveCall: mocks.submitNativeReviveCall,
}));

const NATIVE_ACCOUNT = "111111111111111111111111111111111HC1";
const H160 = "0x88386fc84ba6bc95484008f6362f93160ef3e563" as Address;

function nativeApi() {
  const log = contributedLog(H160, 1n * 10n ** 18n);
  const call = vi.fn().mockResolvedValue({ weight_required: { ref_time: 100n, proof_size: 10n }, weight_consumed: { ref_time: 80n, proof_size: 8n }, storage_deposit: { type: "Charge", value: 1n }, max_storage_deposit: { type: "Charge", value: 5n }, result: { success: true } });
  const tx = {
    getEstimatedFees: vi.fn().mockResolvedValue(2n),
    signAndSubmit: vi.fn().mockResolvedValue({ txHash: `0x${"ab".repeat(32)}`, block: { number: 9, index: 4 }, ok: true, events: [{ type: "ContractEmitted", value: { contract: SOURCE_CONTRACT, data: hexToBytes(log.data), topics: log.topics } }] }),
  };
  const api = {
    apis: { ReviveApi: { call, address: vi.fn().mockResolvedValue(H160) } },
    query: { System: { Account: { getValue: vi.fn().mockResolvedValue({ data: { free: 20_000_000_000n, frozen: 0n } }) } }, Revive: { OriginalAccount: { getValue: vi.fn().mockResolvedValue(NATIVE_ACCOUNT) } } },
    tx: { Revive: { call: vi.fn().mockReturnValue(tx), map_account: vi.fn() } },
  };
  mocks.submitNativeReviveCall.mockResolvedValue({ txHash: `0x${"ab".repeat(32)}`, blockHash: `0x${"cd".repeat(32)}`, blockNumber: 9n, events: [
    { event: { section: "system", method: "ExtrinsicSuccess", data: { toJSON: () => [] } } },
    { event: { section: "revive", method: "ContractEmitted", data: { toJSON: () => [SOURCE_CONTRACT, log.data, log.topics] } } },
  ] });
  return { api, tx, call };
}

describe("native contribution adapter", () => {
  it("accepts the descriptor's snake_case bigint weight", () => {
    expect(validateWeightRequired({ ref_time: 100n, proof_size: 20n })).toEqual({ ref_time: 100n, proof_size: 20n });
  });
  it("records a missing required weight reason", () => {
    const diagnostic = createNativeDiagnostic(NATIVE_ACCOUNT);
    expect(() => validateWeightRequired(undefined, diagnostic)).toThrow("REVIVE_WEIGHT_LIMIT");
    expect(diagnostic.weightLimitFailureReason).toBe("WEIGHT_REQUIRED_MISSING");
  });
  it("records zero ref_time", () => {
    const diagnostic = createNativeDiagnostic(NATIVE_ACCOUNT);
    expect(() => validateWeightRequired({ ref_time: 0n, proof_size: 10n }, diagnostic)).toThrow("REVIVE_WEIGHT_LIMIT");
    expect(diagnostic.weightLimitFailureReason).toBe("WEIGHT_REF_TIME_ZERO");
  });
  it("records negative proof_size", () => {
    const diagnostic = createNativeDiagnostic(NATIVE_ACCOUNT);
    expect(() => validateWeightRequired({ ref_time: 100n, proof_size: -1n }, diagnostic)).toThrow("REVIVE_WEIGHT_LIMIT");
    expect(diagnostic.weightLimitFailureReason).toBe("WEIGHT_PROOF_SIZE_NEGATIVE");
  });
  it("exposes camelCase weight without accepting it", () => {
    const diagnostic = createNativeDiagnostic(NATIVE_ACCOUNT);
    expect(inspectWeightShape({ refTime: 100n, proofSize: 20n })).toMatchObject({ keys: ["refTime", "proofSize"], refTime: "100", proofSize: "20", ref_time: null, proof_size: null });
    expect(() => validateWeightRequired({ refTime: 100n, proofSize: 20n }, diagnostic)).toThrow("REVIVE_WEIGHT_LIMIT");
    expect(diagnostic.weightLimitFailureReason).toBe("WEIGHT_SHAPE_UNEXPECTED");
  });
  it("records the full dry-run resource envelope before validation", () => {
    const diagnostic = createNativeDiagnostic(NATIVE_ACCOUNT);
    const simulation = {
      weight_consumed: { ref_time: 80n, proof_size: 8n }, weight_required: { ref_time: 100n, proof_size: 10n },
      storage_deposit: { type: "Charge", value: 1n }, max_storage_deposit: { type: "Charge", value: 5n }, gas_consumed: 77n,
      result: { success: true, value: { flags: 0, data: new Uint8Array() } },
    };
    recordSimulationDiagnostic(diagnostic, simulation);
    expect(diagnostic.dryRunEnvelope).toBe(simulation);
    expect(diagnostic.dryRunEnvelopeShape?.keys).toEqual(Object.keys(simulation));
    expect(diagnostic.dryRunWeightRequiredShape).toMatchObject({ ref_time: "100", proof_size: "10" });
    expect(diagnostic.dryRunWeightConsumed).toBe(simulation.weight_consumed);
    expect(diagnostic.dryRunStorageDeposit).toBe(simulation.storage_deposit);
    expect(diagnostic.dryRunMaxStorageDeposit).toBe(simulation.max_storage_deposit);
    expect(diagnostic.dryRunGasConsumed).toBe(77n);
    expect(diagnostic.dryRunResult).toBe(simulation.result);
  });
  it("keeps the UI free balance separate from spendable balance", async () => {
    const api = { query: { System: { Account: { getValue: vi.fn().mockResolvedValue({ data: { free: 20n, frozen: 7n } }) } } }, constants: { Balances: { ExistentialDeposit: vi.fn().mockResolvedValue(3n) } } };
    await expect(readNativeBalance(api, NATIVE_ACCOUNT)).resolves.toEqual({ free: 20n, frozen: 7n, existentialDeposit: 3n, spendable: 13n });
  });
  it("uses planck for Revive.call and validates the emitted Solidity event", async () => {
    const { api, tx } = nativeApi();
    const signer = { signTx: vi.fn() };
    const adapter = createSubstrateExecutionAdapter(api, signer, NATIVE_ACCOUNT, manifest({ source: { ...manifest().source, contract: SOURCE_CONTRACT } }));
    const result = await adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT });
    expect(api.tx.Revive.call).toHaveBeenCalledWith(expect.objectContaining({ value: 10_000_000_000n, weight_limit: { ref_time: 100n, proof_size: 10n }, storage_deposit_limit: 5n }));
    expect(api.tx.Revive.call.mock.calls[0][0].value).not.toBe(10n ** 18n);
    expect(mocks.submitNativeReviveCall).toHaveBeenCalledWith(expect.objectContaining({
      address: NATIVE_ACCOUNT, contractAddress: SOURCE_CONTRACT, value: 10_000_000_000n,
      weightLimit: { refTime: 100n, proofSize: 10n }, storageDepositLimit: 5n,
    }));
    expect(tx.signAndSubmit).not.toHaveBeenCalled();
    expect(result.amount.evmWei).toBe(10n ** 18n);
    expect(result.execution).toBe("substrate");
  });
  it("does not sign when the dry-run reverts", async () => {
    const { api, tx, call } = nativeApi();
    call.mockResolvedValueOnce({ weight_required: { ref_time: 100n, proof_size: 10n }, weight_consumed: { ref_time: 80n, proof_size: 8n }, storage_deposit: { type: "Refund", value: 0n }, max_storage_deposit: { type: "Refund", value: 0n }, result: { success: false, error: { type: "ContractReverted" } } });
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await expect(adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT })).rejects.toThrow("REVIVE_CONTRACT_REVERTED");
    expect(tx.signAndSubmit).not.toHaveBeenCalled();
  });
  it("does not sign when the runtime dry-run dispatch fails", async () => {
    const { api, tx, call } = nativeApi();
    call.mockRejectedValueOnce(new Error("dispatch error"));
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await expect(adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT })).rejects.toThrow("REVIVE_DRY_RUN_FAILED");
    expect(tx.signAndSubmit).not.toHaveBeenCalled();
  });
  it("does not require map_account when runtime AutoMap handles the contribution", async () => {
    const { api, tx } = nativeApi();
    api.query.Revive.OriginalAccount.getValue.mockResolvedValue(null);
    const mapSubmit = vi.fn().mockResolvedValue({ ok: true });
    api.tx.Revive.map_account.mockReturnValue({ signAndSubmit: mapSubmit });
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT });
    expect(mapSubmit).not.toHaveBeenCalled();
    expect(mocks.submitNativeReviveCall).toHaveBeenCalled();
  });
  it("does not block a contribution on a stale mapping query", async () => {
    const { api, tx } = nativeApi();
    api.query.Revive.OriginalAccount.getValue.mockResolvedValue("1mkmXsb3yPEMYPTnfvCnTJXMTxEsh5sRfD21tgmryszueHv");
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT });
    expect(mocks.submitNativeReviveCall).toHaveBeenCalled();
  });
  it("preserves a standard injected wallet rejection as NATIVE_SIGNING_REJECTED", async () => {
    const { api } = nativeApi();
    const { NativeTransactionError } = await import("../src/wallet/substrate/injected-transaction");
    mocks.submitNativeReviveCall.mockRejectedValueOnce(new NativeTransactionError("NATIVE_SIGNING_REJECTED", "User rejected the request"));
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await expect(adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT })).rejects.toThrow("NATIVE_SIGNING_REJECTED");
  });
  it("preserves a standard transaction rejection as NATIVE_SUBMISSION_FAILED", async () => {
    const { api } = nativeApi();
    const { NativeTransactionError } = await import("../src/wallet/substrate/injected-transaction");
    mocks.submitNativeReviveCall.mockRejectedValueOnce(new NativeTransactionError("NATIVE_SUBMISSION_FAILED", "1010: Invalid Transaction"));
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await expect(adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT })).rejects.toThrow("NATIVE_SUBMISSION_FAILED");
  });
  it("does not accept a matching event from another extrinsic", () => {
    const amount = parseDotAmount("1");
    const log = contributedLog(H160, amount.evmWei);
    expect(() => validateNativeEvents([{ type: "ContractEmitted", value: { contract: SOURCE_CONTRACT, data: hexToBytes(log.data), topics: log.topics }, phase: { type: "ApplyExtrinsic", value: 3 } }], SOURCE_CONTRACT, H160, amount, 4)).toThrow("CONTRIBUTED_EVENT_MISMATCH");
  });
  it("validates Polkadot.js ContractEmitted data and Contributed", () => {
    const amount = parseDotAmount("1");
    const log = contributedLog(H160, amount.evmWei);
    expect(() => validatePolkadotJsNativeEvents([
      { event: { section: "system", method: "ExtrinsicSuccess", data: { toJSON: () => [] } } },
      { event: { section: "revive", method: "ContractEmitted", data: { toJSON: () => [SOURCE_CONTRACT, log.data, log.topics] } } },
    ], SOURCE_CONTRACT, H160, amount)).not.toThrow();
  });
  it("calculates native max without a blocking mapping lookup", async () => {
    const { api } = nativeApi();
    const value = await estimateNativeMax(api, NATIVE_ACCOUNT, manifest(), 0, 10n ** 18n, 9_999_999_999_999_999n);
    expect(value).toBe((20_000_000_000n - 7n) * 100_000_000n);
    api.query.Revive.OriginalAccount.getValue.mockResolvedValue(null);
    await expect(estimateNativeMax(api, NATIVE_ACCOUNT, manifest(), 0, 10n ** 18n, 9_999_999_999_999_999n)).resolves.toBe((20_000_000_000n - 7n) * 100_000_000n);
    api.query.Revive.OriginalAccount.getValue.mockResolvedValue(NATIVE_ACCOUNT);
    api.tx.Revive.call.mockReturnValueOnce({ getEstimatedFees: vi.fn().mockRejectedValue(new Error("fee unavailable")) });
    await expect(estimateNativeMax(api, NATIVE_ACCOUNT, manifest(), 0, 10n ** 18n, 9_999_999_999_999_999n)).resolves.toBeNull();
  });
});

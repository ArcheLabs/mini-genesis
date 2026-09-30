import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bytesToHex, encodeFunctionData, hexToBytes, type Address } from "viem";
import { Observable, type Subscriber } from "rxjs";
import { getOfflineApi, type SS58String } from "polkadot-api";
import { getFakeTxCreator } from "polkadot-api/tx-creator";
import { paseo_asset_hub } from "@polkadot-api/descriptors";
import { manifest, SOURCE_CONTRACT } from "./helpers";
import { curveAbi } from "../src/genesis/curve-abi.generated";
import { checkNativeRuntime, matchesNativeExtensionSchema } from "../src/wallet/substrate/runtime";
import { NativeTransactionError, probeNativeWalletCapability, submitNativeTransaction } from "../src/wallet/substrate/native-transaction";
import { PASEO_ASSET_HUB_PROFILE, PASEO_EXTENSION_SCHEMA } from "../src/wallet/substrate/runtime-profile";

const TEST_ACCOUNT = "111111111111111111111111111111111HC1" as SS58String;
const TEST_CREATOR = getFakeTxCreator(TEST_ACCOUNT);
const TX_HASH = `0x${"ab".repeat(32)}` as `0x${string}`;
const BLOCK_HASH = `0x${"cd".repeat(32)}` as `0x${string}`;
const LIVE_METADATA = bytesToHex(new Uint8Array(readFileSync(".papi/metadata/paseo_asset_hub.scale")));

function stagingManifest() {
  const base = manifest();
  return {
    ...base,
    environment: "staging" as const,
    source: {
      ...base.source,
      chainId: "420420417",
      name: "Polkadot Hub TestNet",
      rpcHttpUrls: ["https://rpc.example"],
      substrateWsUrls: ["wss://sys.ibp.network/asset-hub-paseo", "wss://asset-hub-paseo.dotters.network", "wss://asset-hub-paseo-rpc.n.dwellir.com"],
      substrateGenesisHash: PASEO_ASSET_HUB_PROFILE.fingerprint.genesisHash,
      substrateRuntime: {
        profileId: PASEO_ASSET_HUB_PROFILE.id,
        specName: PASEO_ASSET_HUB_PROFILE.fingerprint.specName,
        specVersion: PASEO_ASSET_HUB_PROFILE.fingerprint.specVersion,
        transactionVersion: PASEO_ASSET_HUB_PROFILE.fingerprint.transactionVersion,
        wasmCodeHash: PASEO_ASSET_HUB_PROFILE.fingerprint.wasmCodeHash,
      },
    },
  };
}

function runtimeClient(overrides: { genesisHash?: string; specVersion?: number; transactionVersion?: number; codeHash?: string } = {}) {
  const manifest = stagingManifest();
  return {
    getChainSpecData: vi.fn().mockResolvedValue({ name: "Polkadot Hub TestNet", genesisHash: overrides.genesisHash ?? manifest.source.substrateGenesisHash }),
    getFinalizedBlock: vi.fn().mockResolvedValue({ hash: BLOCK_HASH, number: 100 }),
    _request: vi.fn(async (method: string) => {
      if (method === "state_getRuntimeVersion") return { specName: "asset-hub-paseo", specVersion: overrides.specVersion ?? 2005002, transactionVersion: overrides.transactionVersion ?? 18 };
      if (method === "state_getStorageHash") return overrides.codeHash ?? "0x3d399dc2daeaaf831fc4fda6ddc1958494fc0f3319ebb8ec0c1e7ca8995eed56";
      if (method === "state_getMetadata") return LIVE_METADATA;
      throw new Error(`unexpected rpc ${method}`);
    }),
  };
}

describe("PAPI v3 native transaction core", () => {
  let offline: Awaited<ReturnType<typeof getOfflineApi<typeof paseo_asset_hub>>>;

  beforeAll(async () => {
    offline = await getOfflineApi(paseo_asset_hub);
  });

  it("uses the exact reviewed extension schema and fails closed on unknown extensions", () => {
    expect(PASEO_EXTENSION_SCHEMA.map(({ identifier }) => identifier)).toEqual([
      "UnitTransactionExtension", "AuthorizeCall", "AsPgas", "AsDotnsGateway", "RestrictOrigins",
      "CheckNonZeroSender", "CheckSpecVersion", "CheckTxVersion", "CheckGenesis", "CheckMortality",
      "CheckNonce", "CheckWeight", "ChargeAssetTxPayment", "PrevalidateAttests", "CheckMetadataHash",
      "EthSetOrigin", "StorageWeightReclaim",
    ]);
    expect(matchesNativeExtensionSchema([...PASEO_EXTENSION_SCHEMA], PASEO_EXTENSION_SCHEMA)).toBe(true);
    expect(matchesNativeExtensionSchema([...PASEO_EXTENSION_SCHEMA, { identifier: "FutureUnknown", type: 1, additionalSigned: 1 }], PASEO_EXTENSION_SCHEMA)).toBe(false);
    expect(PASEO_ASSET_HUB_PROFILE.buildTransactionOptions()).toEqual({ customSignedExtensions: {
      AsPgas: { value: undefined }, AsDotnsGateway: { value: undefined }, RestrictOrigins: { value: true },
    } });
  });

  it("constructs map_account and buyExactMini Revive.call through generated Paseo metadata", async () => {
    const options = { nonce: 0, mortality: { mortal: false }, ...PASEO_ASSET_HUB_PROFILE.buildTransactionOptions() };
    const mapCall = offline.tx.Revive.map_account();
    const mapExtrinsic = await mapCall.create(TEST_CREATOR, options);
    const miniAmount = 2n * 10n ** 18n;
    const maxDotCost = 4n * 10n ** 18n;
    const data = encodeFunctionData({ abi: curveAbi, functionName: "buyExactMini", args: [miniAmount, maxDotCost] });
    const call = offline.tx.Revive.call({
      dest: SOURCE_CONTRACT,
      value: 40_000_000_000n,
      weight_limit: { ref_time: 100_000n, proof_size: 10_000n },
      storage_deposit_limit: 1_000n,
      data: hexToBytes(data),
    });
    const callExtrinsic = await call.create(TEST_CREATOR, options);
    expect(mapExtrinsic).toBeInstanceOf(Uint8Array);
    expect(callExtrinsic).toBeInstanceOf(Uint8Array);
    expect(mapExtrinsic.byteLength).toBeGreaterThan(100);
    expect(callExtrinsic.byteLength).toBeGreaterThan(mapExtrinsic.byteLength);
    expect(bytesToHex(call.encodedData)).toContain(data.slice(2, 10));
  });

  it("accepts only the exact runtime fingerprint and metadata schema", async () => {
    await expect(checkNativeRuntime(runtimeClient() as any, stagingManifest())).resolves.toMatchObject({ compatibility: "supported", profileId: "paseo-asset-hub-2005002" });
    await expect(checkNativeRuntime(runtimeClient({ genesisHash: `0x${"00".repeat(32)}` }) as any, stagingManifest())).resolves.toMatchObject({ compatibility: "network_mismatch" });
    await expect(checkNativeRuntime(runtimeClient({ specVersion: 2005003 }) as any, stagingManifest())).resolves.toMatchObject({ compatibility: "runtime_changed" });
    await expect(checkNativeRuntime(runtimeClient({ transactionVersion: 19 }) as any, stagingManifest())).resolves.toMatchObject({ compatibility: "runtime_changed" });
  });

  it("enables a wallet only after the current profile can be fee-probed", async () => {
    const tx = { getEstimatedFees: vi.fn().mockResolvedValue(9n) };
    await expect(probeNativeWalletCapability(tx, TEST_CREATOR, stagingManifest())).resolves.toBe(9n);
    expect(tx.getEstimatedFees).toHaveBeenCalledWith(TEST_CREATOR, PASEO_ASSET_HUB_PROFILE.buildTransactionOptions());
  });

  it("reports finalized success only after broadcast and best-block notifications", async () => {
    const client = runtimeClient();
    let observer: Subscriber<any> | undefined;
    const tx = {
      getEstimatedFees: vi.fn().mockResolvedValue(12n),
      createSubmitAndWatch: vi.fn((_creator: unknown, _options: unknown) => new Observable((subscriber) => {
        observer = subscriber;
        subscriber.next({ type: "broadcasted", txHash: TX_HASH });
        subscriber.next({ type: "inBestBlock", txHash: TX_HASH, ok: true, events: [], block: { hash: BLOCK_HASH, number: 100, index: 2 } });
      })),
    };
    const statuses: string[] = [];
    let resolved = false;
    const resultPromise = submitNativeTransaction({ client, manifest: stagingManifest(), tx, txCreator: TEST_CREATOR, onStatus: (status) => statuses.push(status) }).then((result) => { resolved = true; return result; });
    await vi.waitFor(() => expect(observer).toBeDefined());
    expect(resolved).toBe(false);
    expect(statuses).toEqual(["ready", "broadcast", "inBestBlock"]);
    observer?.next({ type: "finalized", txHash: TX_HASH, ok: true, events: [], block: { hash: BLOCK_HASH, number: 100, index: 2 } });
    await expect(resultPromise).resolves.toEqual({ substrateTxHash: TX_HASH, finalizedBlockHash: BLOCK_HASH, finalizedBlockNumber: 100n, extrinsicIndex: 2, events: [] });
    expect(statuses.at(-1)).toBe("finalized");
  });

  it("blocks unsupported wallet extensions before opening submission", async () => {
    const client = runtimeClient();
    const tx = {
      getEstimatedFees: vi.fn().mockRejectedValue(new Error("PJS does not support this signed-extension: AsPgas")),
      createSubmitAndWatch: vi.fn(),
    };
    await expect(submitNativeTransaction({ client, manifest: stagingManifest(), tx, txCreator: TEST_CREATOR })).rejects.toMatchObject({ code: "NATIVE_WALLET_RUNTIME_UNSUPPORTED" } satisfies Partial<NativeTransactionError>);
    expect(tx.createSubmitAndWatch).not.toHaveBeenCalled();
  });

  it("maps a wallet rejection to the signing-rejected error without reporting success", async () => {
    const tx = {
      getEstimatedFees: vi.fn().mockResolvedValue(12n),
      createSubmitAndWatch: vi.fn(() => new Observable((subscriber) => subscriber.error(new Error("User rejected signing")))),
    };
    await expect(submitNativeTransaction({ client: runtimeClient() as any, manifest: stagingManifest(), tx, txCreator: TEST_CREATOR }))
      .rejects.toMatchObject({ code: "NATIVE_SIGNING_REJECTED" } satisfies Partial<NativeTransactionError>);
  });
});

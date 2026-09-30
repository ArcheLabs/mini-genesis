import { beforeEach, describe, expect, it, vi } from "vitest";
import { manifest } from "./helpers";
import { buyExactMiniNative } from "../src/genesis/curve-contribution-native";
import { purchaseErrorDiagnostics } from "../src/genesis/purchase-error";

const mocks = vi.hoisted(() => ({
  assertRuntime: vi.fn(),
  resolveAddress: vi.fn(),
  readBalance: vi.fn(),
  checkMapping: vi.fn(),
  mapAccount: vi.fn(),
  getSubstrateClient: vi.fn(),
  getRuntimeProfile: vi.fn(),
  probe: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("../src/wallet/substrate/native-transaction", () => ({
  assertNativeRuntimeSupported: mocks.assertRuntime,
  NativeTransactionError: class NativeTransactionError extends Error {
    constructor(public readonly code: string, detail: string, rawError?: unknown) {
      super(code, { cause: rawError ?? detail });
      this.name = "NativeTransactionError";
    }
  },
  probeNativeWalletCapability: mocks.probe,
  submitNativeTransaction: mocks.submit,
}));
vi.mock("../src/wallet/substrate/account", () => ({ resolveContractAddress: mocks.resolveAddress }));
vi.mock("../src/wallet/substrate/balance", () => ({ readNativeBalance: mocks.readBalance }));
vi.mock("../src/wallet/substrate/mapping", () => ({ checkAccountMapping: mocks.checkMapping, mapAccount: mocks.mapAccount }));
vi.mock("../src/wallet/substrate/client", () => ({ getSubstrateClient: mocks.getSubstrateClient }));
vi.mock("../src/wallet/substrate/runtime-profile", () => ({ getNativeRuntimeProfile: mocks.getRuntimeProfile }));

const CONTRACT = "0x5555555555555555555555555555555555555555" as const;
const TX = { id: "Revive.call" };
const H160 = "0x6666666666666666666666666666666666666666" as const;

function testApi() {
  return {
    apis: {
      ReviveApi: {
        call: vi.fn().mockResolvedValue({
          result: { success: true, value: { type: "Ok" } },
          weight_required: { ref_time: 10n, proof_size: 2n },
          max_storage_deposit: { type: "Refund", value: 0n },
        }),
      },
    },
    tx: { Revive: { call: vi.fn(() => TX) } },
  };
}

describe("Genesis II native purchase fee probe and diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertRuntime.mockResolvedValue({ profileId: "paseo-profile" });
    mocks.resolveAddress.mockResolvedValue({ h160: H160, accountId32: new Uint8Array(32), source: "runtime" });
    mocks.readBalance.mockResolvedValue({ free: 50_000_000_000_000n, spendable: 50_000_000_000_000n });
    mocks.checkMapping.mockResolvedValue("mapped");
    mocks.mapAccount.mockResolvedValue(undefined);
    mocks.getSubstrateClient.mockReturnValue({});
    mocks.getRuntimeProfile.mockReturnValue({ id: "paseo-profile", enabled: true });
    mocks.probe.mockResolvedValue(100n);
    mocks.submit.mockImplementation(async ({ onStage }: { onStage?: (stage: string) => void }) => {
      onStage?.("runtime-check");
      onStage?.("submission");
      onStage?.("wallet-signing");
      throw new Error("NATIVE_SIGNING_REJECTED");
    });
  });

  it("enters awaiting_signature after the Revive.call fee probe succeeds and submits without reprobe", async () => {
    const updates: string[] = [];
    await expect(buyExactMiniNative(
      testApi(), {} as never, {} as never, "5GrwvaEF5zXb26Fz9rcQpDWSewAs1Q3V", manifest(), CONTRACT, 10n ** 18n, 10n ** 18n,
      (update) => updates.push(update.state), { wallet: "SubWallet" },
    )).rejects.toThrow("NATIVE_SIGNING_REJECTED");

    expect(updates).toContain("awaiting_signature");
    expect(updates.at(-1)).toBe("failed");
    expect(mocks.probe).toHaveBeenCalledTimes(1);
    expect(mocks.probe).toHaveBeenCalledWith(TX, {}, expect.anything());
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ tx: TX, feeEstimate: 100n }));
  });

  it("reports the exact Revive.call fee-estimation stage and raw signed-extension error", async () => {
    const cause = new Error("PJS bridge rejected AsPgas while constructing the Revive.call transaction");
    mocks.probe.mockRejectedValue(new Error("NATIVE_WALLET_RUNTIME_UNSUPPORTED", { cause }));
    let failure: unknown;
    try {
      await buyExactMiniNative(
        testApi(), {} as never, {} as never, "5GrwvaEF5zXb26Fz9rcQpDWSewAs1Q3V", manifest(), CONTRACT, 10n ** 18n, 10n ** 18n,
        () => {}, { wallet: "SubWallet" },
      );
    } catch (error) { failure = error; }

    expect(purchaseErrorDiagnostics(failure)).toMatchObject({
      code: "NATIVE_WALLET_RUNTIME_UNSUPPORTED",
      wallet: "SubWallet",
      runtimeProfile: "paseo-profile",
      transactionCall: "Revive.call",
      transactionStage: "fee-estimation",
      cause: [expect.objectContaining({ message: "NATIVE_WALLET_RUNTIME_UNSUPPORTED" }), expect.objectContaining({ message: cause.message })],
    });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("retains the failed dry-run cause instead of replacing it with a generic message", async () => {
    const cause = new Error("ReviveApi is temporarily unavailable");
    const api = testApi();
    api.apis.ReviveApi.call.mockRejectedValue(cause);
    let failure: unknown;
    try {
      await buyExactMiniNative(api, {} as never, {} as never, "5GrwvaEF5zXb26Fz9rcQpDWSewAs1Q3V", manifest(), CONTRACT, 10n ** 18n, 10n ** 18n);
    } catch (error) { failure = error; }

    expect(purchaseErrorDiagnostics(failure)).toMatchObject({
      code: "REVIVE_DRY_RUN_FAILED",
      transactionStage: "dry-run",
      cause: [expect.objectContaining({ message: "REVIVE_DRY_RUN_FAILED" }), expect.objectContaining({ message: cause.message })],
    });
  });
});

import { describe, expect, it } from "vitest";
import { NativePurchaseFailure, normalizePurchaseError, purchaseErrorDiagnostics, shouldLogPurchaseDiagnostics } from "../src/genesis/purchase-error";
import { normalizeFeedback } from "../src/feedback/normalize";
import { buyExactMini } from "../src/genesis/curve-contribution";

describe("Genesis II purchase error classification", () => {
  it.each([
    [new Error("fetch failed"), "RPC_UNAVAILABLE"],
    [new Error("connection refused"), "RPC_UNAVAILABLE"],
    [new Error("request timed out"), "RPC_UNAVAILABLE"],
    [new Error("insufficient funds for gas * price + value"), "INSUFFICIENT_BALANCE"],
    [new Error("execution reverted: SlippageExceeded"), "TRANSACTION_REVERTED"],
    [{ code: 4001, message: "User rejected request" }, "USER_REJECTED_TRANSACTION"],
    [new Error("WRONG_CHAIN"), "WRONG_CHAIN"],
    [new Error("ACCOUNT_ADDRESS_RESOLUTION_FAILED"), "ACCOUNT_ADDRESS_RESOLUTION_FAILED"],
    [new Error("ACCOUNT_ADDRESS_MAPPING_MISMATCH"), "ACCOUNT_ADDRESS_MAPPING_MISMATCH"],
    [new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED"), "SUBSTRATE_ACCOUNT_NOT_SELECTED"],
    [new Error("REVIVE_DRY_RUN_FAILED"), "REVIVE_DRY_RUN_FAILED"],
    [new Error("REVIVE_WEIGHT_LIMIT"), "REVIVE_WEIGHT_LIMIT"],
    [new Error("REVIVE_STORAGE_DEPOSIT_LIMIT"), "REVIVE_STORAGE_DEPOSIT_LIMIT"],
    [new Error("REVIVE_CONTRACT_REVERTED"), "REVIVE_CONTRACT_REVERTED"],
    [new Error("NATIVE_INSUFFICIENT_BALANCE"), "NATIVE_INSUFFICIENT_BALANCE"],
    [new Error("NATIVE_FEE_ESTIMATE_UNAVAILABLE"), "NATIVE_FEE_ESTIMATE_UNAVAILABLE"],
    [new Error("NATIVE_TRANSACTION_BUILD_FAILED"), "NATIVE_TRANSACTION_BUILD_FAILED"],
    [new Error("NATIVE_WALLET_RUNTIME_UNSUPPORTED"), "NATIVE_WALLET_RUNTIME_UNSUPPORTED"],
    [new Error("NATIVE_RUNTIME_PROFILE_MISMATCH"), "NATIVE_RUNTIME_PROFILE_MISMATCH"],
    [new Error("NATIVE_RUNTIME_PROFILE_INCOMPLETE"), "NATIVE_RUNTIME_PROFILE_INCOMPLETE"],
    [new Error("NATIVE_SIGNING_REJECTED"), "NATIVE_SIGNING_REJECTED"],
    [new Error("NATIVE_SUBMISSION_FAILED"), "NATIVE_SUBMISSION_FAILED"],
    [new Error("opaque provider payload"), "UNKNOWN_ERROR"],
  ] as const)("maps %s to %s", (error, expected) => expect(normalizePurchaseError(error)).toBe(expected));

  it("writes stage-rich staging diagnostics while redacting signatures and secrets", () => {
    const signature = `0x${"ab".repeat(65)}`;
    const secret = `0x${"cd".repeat(32)}`;
    const failure = new NativePurchaseFailure(
      "NATIVE_TRANSACTION_BUILD_FAILED",
      "fee-estimation",
      "SubWallet",
      "paseo-asset-hub-2005002",
      "Revive.call",
      new Error(`PJS TxCreator rejected signed extension AsPgas; signature ${signature}; private key: ${secret}`),
    );
    const diagnostic = purchaseErrorDiagnostics(failure);
    const serialized = JSON.stringify(diagnostic);
    expect(diagnostic).toMatchObject({
      stage: "phase2-purchase",
      code: "NATIVE_TRANSACTION_BUILD_FAILED",
      wallet: "SubWallet",
      runtimeProfile: "paseo-asset-hub-2005002",
      transactionCall: "Revive.call",
      transactionStage: "fee-estimation",
    });
    expect(serialized).toContain("PJS TxCreator rejected signed extension AsPgas");
    expect(serialized).not.toContain(signature);
    expect(serialized).not.toContain(secret);
  });

  it("enables diagnostics for staging but not production by default", () => {
    expect(shouldLogPurchaseDiagnostics("staging", false)).toBe(true);
    expect(shouldLogPurchaseDiagnostics("production", false)).toBe(false);
    expect(shouldLogPurchaseDiagnostics("production", true)).toBe(true);
  });

  it("does not classify a contract execution failure as an RPC outage", () => {
    expect(normalizeFeedback(new Error("Contract execution failed"), { operation: "submit-contribution", locale: "en" }).code).toBe("UNKNOWN_ERROR");
    expect(normalizeFeedback(new Error("execution reverted: SlippageExceeded"), { operation: "submit-contribution", locale: "en" }).code).toBe("TRANSACTION_REVERTED");
  });

  it("caps both the simulation value and maxDotCost at the entered budget", async () => {
    const budget = 1_000_000_000_000_000_000n;
    const miniAmount = 280n * 10n ** 18n;
    const simulated: Record<string, unknown>[] = [];
    const client = {
      simulateContract: async (request: Record<string, unknown>) => {
        simulated.push(request);
        throw new Error("execution reverted: SlippageExceeded");
      },
    };
    await expect(buyExactMini(
      client as never,
      {} as never,
      {} as never,
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      miniAmount,
      budget,
    )).rejects.toThrow("TRANSACTION_REVERTED");
    expect(simulated[0]?.value).toBe(budget);
    expect(simulated[0]?.args).toEqual([miniAmount, budget]);
  });
});

import { describe, expect, it } from "vitest";
import { normalizePurchaseError } from "../src/genesis/purchase-error";
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
    [new Error("opaque provider payload"), "UNKNOWN_ERROR"],
  ] as const)("maps %s to %s", (error, expected) => expect(normalizePurchaseError(error)).toBe(expected));

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

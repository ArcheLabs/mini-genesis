import { describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { normalizePurchaseError } from "../src/genesis/purchase-error";
import { normalizeFeedback } from "../src/feedback/normalize";
import { buyExactMini } from "../src/genesis/curve-contribution";
import { curveAbi } from "../src/genesis/curve-abi.generated";
import { ACCOUNT, SOURCE_CONTRACT, manifest } from "./helpers";

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

  it("submits staging TestNet EVM purchases through simulation and wallet.writeContract", async () => {
    const miniAmount = 300n * 10n ** 18n;
    const dotCost = 1n * 10n ** 18n;
    const hash = `0x${"ab".repeat(32)}` as const;
    const topics = encodeEventTopics({ abi: curveAbi as any, eventName: "Purchased", args: { buyer: ACCOUNT } as any });
    const data = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
      [miniAmount, dotCost, miniAmount, dotCost, dotCost],
    );
    const client = {
      simulateContract: vi.fn().mockResolvedValue({ request: { address: SOURCE_CONTRACT, functionName: "buyExactMini" } }),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", blockNumber: 8n, logs: [{ address: SOURCE_CONTRACT, data, topics }] }),
      getBlock: vi.fn().mockResolvedValue({ number: 8n }),
    };
    const wallet = { writeContract: vi.fn().mockResolvedValue(hash) };

    const result = await buyExactMini(client as any, wallet as any, manifest({ environment: "staging" }), ACCOUNT, SOURCE_CONTRACT, miniAmount, dotCost);

    expect(client.simulateContract).toHaveBeenCalledWith(expect.objectContaining({ address: SOURCE_CONTRACT, functionName: "buyExactMini", args: [miniAmount, dotCost], account: ACCOUNT, value: dotCost }));
    expect(wallet.writeContract).toHaveBeenCalledWith({ address: SOURCE_CONTRACT, functionName: "buyExactMini" });
    expect(result).toMatchObject({ hash, blockNumber: 8n, miniAmount, dotCost, finalized: true });
  });
});

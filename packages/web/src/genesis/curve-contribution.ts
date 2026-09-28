import { decodeEventLog, type Address, type Hash, type PublicClient, type WalletClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { curveAbi } from "./curve-abi.generated";
import { normalizePurchaseError } from "./purchase-error";

export type CurvePurchaseUpdate = { state: "simulating" | "awaiting_signature" | "submitted" | "included" | "failed"; hash?: Hash; error?: string };
export type CurvePurchaseResult = { hash: Hash; blockNumber: bigint; miniAmount: bigint; dotCost: bigint; finalized: boolean };

export async function waitForTransactionFinality(client: PublicClient, blockNumber: bigint, timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const finalized = await client.getBlock({ blockTag: "finalized" });
      if (finalized.number !== null && finalized.number >= blockNumber) return true;
    } catch { /* Keep checking while the finalized endpoint catches up. */ }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return false;
}

export async function buyExactMini(
  client: PublicClient,
  wallet: WalletClient,
  manifest: DeploymentManifest,
  account: Address,
  contract: Address,
  miniAmount: bigint,
  maxDotCost: bigint,
  onUpdate: (update: CurvePurchaseUpdate) => void = () => {},
): Promise<CurvePurchaseResult> {
  try {
    onUpdate({ state: "simulating" });
    const simulation = await client.simulateContract({ address: contract, abi: curveAbi, functionName: "buyExactMini", args: [miniAmount, maxDotCost], account, value: maxDotCost } as any);
    onUpdate({ state: "awaiting_signature" });
    const hash = await wallet.writeContract(simulation.request as any);
    onUpdate({ state: "submitted", hash });
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("TRANSACTION_REVERTED");
    let dotCost: bigint | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== contract.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: curveAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "Purchased" && String((decoded.args as any).buyer).toLowerCase() === account.toLowerCase() && (decoded.args as any).miniAmount === miniAmount) dotCost = (decoded.args as any).dotCost;
      } catch { /* Ignore unrelated logs. */ }
    }
    if (dotCost === null) throw new Error("PURCHASED_EVENT_MISMATCH");
    onUpdate({ state: "included", hash });
    const finalized = await waitForTransactionFinality(client, receipt.blockNumber);
    return { hash, blockNumber: receipt.blockNumber, miniAmount, dotCost, finalized };
  } catch (error) {
    const code = normalizePurchaseError(error);
    onUpdate({ state: "failed", error: code });
    throw new Error(code, { cause: error });
  }
}

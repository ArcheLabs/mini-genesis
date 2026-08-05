import { decodeEventLog, type Address, type Hash, type PublicClient, type WalletClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { genesisAbi } from "./abi";
import { validateContributionAmount } from "./amount";

export type ContributionState = "idle" | "validating" | "simulating" | "awaiting_signature" | "submitted" | "included" | "failed";
export type ContributionUpdate = { state: ContributionState; hash?: Hash; error?: string };
export type ContributionResult = { hash: Hash; blockNumber: bigint; amount: bigint };
export function stableError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && Number((error as { code?: unknown }).code) === 4001) return "USER_REJECTED_TRANSACTION";
  const message = error instanceof Error ? error.message : String(error);
  if (message === "OPERATION_CANCELLED") return message;
  if (/reject|denied|user/i.test(message)) return "USER_REJECTED_TRANSACTION";
  if (/insufficient|balance/i.test(message)) return "INSUFFICIENT_BALANCE";
  if (/revert|execution/i.test(message)) return "TRANSACTION_REVERTED";
  return message.includes("_") ? message : "RPC_UNAVAILABLE";
}
function checkCancelled(signal?: AbortSignal): void { if (signal?.aborted) throw new Error("OPERATION_CANCELLED"); }
export async function contribute(client: PublicClient, wallet: WalletClient, manifest: DeploymentManifest, account: Address, input: string, phase: number, firstMinimum: bigint, subsequentExclusive: bigint, onUpdate: (update: ContributionUpdate) => void = () => {}, signal?: AbortSignal): Promise<ContributionResult> {
  try {
    checkCancelled(signal); onUpdate({ state: "validating" });
    const value = validateContributionAmount(input, phase, firstMinimum, subsequentExclusive);
    const balance = await client.getBalance({ address: account }); checkCancelled(signal);
    if (balance < value) throw new Error("INSUFFICIENT_BALANCE");
    onUpdate({ state: "simulating" }); await client.simulateContract({ address: manifest.source.contract, abi: genesisAbi, functionName: "contribute", account, value } as any); checkCancelled(signal);
    onUpdate({ state: "awaiting_signature" }); const hash = await wallet.writeContract({ address: manifest.source.contract, abi: genesisAbi, functionName: "contribute", account, value } as any); checkCancelled(signal);
    onUpdate({ state: "submitted", hash }); let receipt; try { receipt = await client.waitForTransactionReceipt({ hash }); } catch { throw new Error("TRANSACTION_RECEIPT_UNAVAILABLE"); } checkCancelled(signal);
    if (receipt.status !== "success" || !receipt.to || receipt.to.toLowerCase() !== manifest.source.contract.toLowerCase()) throw new Error("TRANSACTION_REVERTED");
    let matches = 0;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== manifest.source.contract.toLowerCase()) continue;
      try { const decoded = decodeEventLog({ abi: genesisAbi, data: log.data, topics: log.topics }); if (decoded.eventName === "Contributed" && String((decoded.args as any).contributor).toLowerCase() === account.toLowerCase() && (decoded.args as any).amount === value) matches += 1; } catch { /* unrelated log */ }
    }
    if (matches !== 1) throw new Error("CONTRIBUTED_EVENT_MISMATCH");
    onUpdate({ state: "included", hash }); return { hash, blockNumber: receipt.blockNumber, amount: value };
  } catch (error) { const mapped = stableError(error); if (mapped !== "OPERATION_CANCELLED") onUpdate({ state: "failed", error: mapped }); throw new Error(mapped); }
}

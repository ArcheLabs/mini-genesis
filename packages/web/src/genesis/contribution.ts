import { decodeEventLog, type Address, type Hash, type PublicClient, type WalletClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { genesisAbi } from "./abi";
import { waitForFinality } from "./finality";
import { validateContributionAmount } from "./amount";

export type ContributionState = "idle" | "validating" | "simulating" | "awaiting_signature" | "submitted" | "included" | "finalizing" | "finalized" | "failed";
export type ContributionUpdate = { state: ContributionState; hash?: Hash; error?: string };
export function stableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|user/i.test(message)) return "USER_REJECTED_TRANSACTION";
  if (/insufficient|balance/i.test(message)) return "INSUFFICIENT_BALANCE";
  if (/revert|execution/i.test(message)) return "TRANSACTION_REVERTED";
  return message.includes("_") ? message : "RPC_UNAVAILABLE";
}
export async function contribute(client: PublicClient, wallet: WalletClient, manifest: DeploymentManifest, account: Address, input: string, phase: number, firstMinimum: bigint, subsequentExclusive: bigint, onUpdate: (update: ContributionUpdate) => void = () => {}): Promise<Hash> {
  try {
    onUpdate({ state: "validating" });
    const value = validateContributionAmount(input, phase, firstMinimum, subsequentExclusive);
    const balance = await client.getBalance({ address: account });
    if (balance < value) throw new Error("INSUFFICIENT_BALANCE");
    onUpdate({ state: "simulating" });
    await client.simulateContract({ address: manifest.source.contract, abi: genesisAbi, functionName: "contribute", account, value } as any);
    onUpdate({ state: "awaiting_signature" });
    const hash = await wallet.writeContract({ address: manifest.source.contract, abi: genesisAbi, functionName: "contribute", account, value } as any);
    onUpdate({ state: "submitted", hash });
    const receipt = await client.waitForTransactionReceipt({ hash });
    onUpdate({ state: "included", hash });
    if (receipt.status !== "success" || receipt.to?.toLowerCase() !== manifest.source.contract.toLowerCase()) throw new Error("TRANSACTION_REVERTED");
    let matched = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== manifest.source.contract.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: genesisAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "Contributed" && String((decoded.args as any).contributor).toLowerCase() === account.toLowerCase() && (decoded.args as any).amount === value) matched = true;
      } catch { /* unrelated log */ }
    }
    if (!matched) throw new Error("CONTRIBUTED_EVENT_MISMATCH");
    onUpdate({ state: "finalizing", hash });
    await waitForFinality(client, receipt.blockNumber, {});
    onUpdate({ state: "finalized", hash });
    return hash;
  } catch (error) { const mapped = stableError(error); onUpdate({ state: "failed", error: mapped }); throw new Error(mapped); }
}

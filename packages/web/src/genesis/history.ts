import { parseAbiItem, type Address, type PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";

export type ContributionHistoryItem = { amount: bigint; blockNumber: bigint; transactionHash: `0x${string}`; logIndex: number };
const contributedEvent = parseAbiItem("event Contributed(address indexed contributor, uint256 amount)");

export async function readContributionHistory(client: PublicClient, manifest: DeploymentManifest, account: Address, finalizedBlockNumber: bigint): Promise<ContributionHistoryItem[]> {
  const logs = await client.getLogs({ address: manifest.source.contract, event: contributedEvent, args: { contributor: account }, fromBlock: BigInt(manifest.source.deploymentBlock), toBlock: finalizedBlockNumber });
  return logs.map((log) => ({ amount: log.args.amount as bigint, blockNumber: log.blockNumber, transactionHash: log.transactionHash as `0x${string}`, logIndex: Number(log.logIndex) })).sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
    return b.logIndex - a.logIndex;
  });
}

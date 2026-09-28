import { parseAbiItem, type Address, type Hash, type PublicClient } from "viem";
import { hasLivePhase1Contract, phase2Address, type DeploymentManifest } from "../config/manifest";
import type { WalletSession } from "../wallet/types";
import { resolveContractAddress } from "../wallet/substrate/account";

export type ContributionHistoryItem = { amount: bigint; blockNumber: bigint; transactionHash: `0x${string}`; logIndex: number };
export type Genesis2PurchaseHistoryItem = {
  miniAmount: bigint;
  dotCost: bigint;
  totalSoldMini: bigint;
  totalRaisedDot: bigint;
  spotPriceAfter: bigint;
  blockNumber: bigint;
  transactionHash: Hash;
  logIndex: number;
};
const contributedEvent = parseAbiItem("event Contributed(address indexed contributor, uint256 amount)");
const purchasedEvent = parseAbiItem("event Purchased(address indexed buyer, uint256 miniAmount, uint256 dotCost, uint256 totalSoldMini, uint256 totalRaisedDot, uint256 spotPriceAfter)");

export async function readContributionHistory(client: PublicClient, manifest: DeploymentManifest, account: Address, finalizedBlockNumber: bigint): Promise<ContributionHistoryItem[]> {
  if (!hasLivePhase1Contract(manifest)) throw new Error("PHASE1_CONTRACT_UNAVAILABLE");
  const logs = await client.getLogs({ address: manifest.source.contract, event: contributedEvent, args: { contributor: account }, fromBlock: BigInt(manifest.source.deploymentBlock), toBlock: finalizedBlockNumber });
  return logs.map((log) => ({ amount: log.args.amount as bigint, blockNumber: log.blockNumber, transactionHash: log.transactionHash as `0x${string}`, logIndex: Number(log.logIndex) })).sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
    return b.logIndex - a.logIndex;
  });
}

export async function resolveHistoryH160(session: WalletSession): Promise<Address> {
  if (!session) throw new Error("WALLET_NOT_CONNECTED");
  if (session.kind === "evm") return session.address;
  if (!session.api) throw new Error("ACCOUNT_ADDRESS_RESOLUTION_FAILED");
  return (await resolveContractAddress(session.api, session.selectedAccountAddress)).h160;
}

export async function readGenesis2PurchaseHistory(
  client: PublicClient,
  manifest: DeploymentManifest,
  buyer: Address,
  finalizedBlockNumber: bigint,
): Promise<Genesis2PurchaseHistoryItem[]> {
  const address = phase2Address(manifest);
  const deploymentBlock = manifest.genesis?.phases.phase2?.deploymentBlock;
  if (!address || !deploymentBlock || manifest.genesis?.phases.phase2?.status === "template") throw new Error("PHASE2_CONTRACT_UNAVAILABLE");
  const fromBlock = BigInt(deploymentBlock);
  if (finalizedBlockNumber < fromBlock) return [];
  const logs = await client.getLogs({ address, event: purchasedEvent, args: { buyer }, fromBlock, toBlock: finalizedBlockNumber });
  return logs.map((log) => {
    const { miniAmount, dotCost, totalSoldMini, totalRaisedDot, spotPriceAfter } = log.args as {
      miniAmount: bigint; dotCost: bigint; totalSoldMini: bigint; totalRaisedDot: bigint; spotPriceAfter: bigint;
    };
    if (log.blockNumber === null || log.transactionHash === null || log.logIndex === null) throw new Error("INCOMPLETE_PURCHASE_LOG");
    return { miniAmount, dotCost, totalSoldMini, totalRaisedDot, spotPriceAfter, blockNumber: log.blockNumber, transactionHash: log.transactionHash, logIndex: log.logIndex };
  }).sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1;
    return b.logIndex - a.logIndex;
  });
}

export async function readGenesis2PurchaseHistoryForSession(
  client: PublicClient,
  manifest: DeploymentManifest,
  session: WalletSession,
  finalizedBlockNumber: bigint,
): Promise<Genesis2PurchaseHistoryItem[]> {
  const buyer = await resolveHistoryH160(session);
  return readGenesis2PurchaseHistory(client, manifest, buyer, finalizedBlockNumber);
}

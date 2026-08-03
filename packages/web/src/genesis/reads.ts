import type { Address, PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { genesisAbi } from "./abi";
import { phaseName, type PhaseName } from "./phase";

export type GenesisGlobal = {
  phase: number; phaseName: PhaseName; startBlock: bigint; contributionEndBlock: bigint; emissionEndBlock: bigint;
  totalRaisedDot: bigint; contributorCount: bigint; genesisAllocation: bigint; luckyRootAllocation: bigint;
  emittedMini: bigint; contributionBlocks: bigint; protectionBlocks: bigint; firstContributionMinimum: bigint;
  subsequentContributionMinimumExclusive: bigint; treasury: Address; protectionEmissionMini: bigint;
};
export type GenesisUser = { nativeBalance: bigint; contributedDot: bigint; pendingMini: bigint };
const read = (client: PublicClient, address: Address, functionName: string, args?: readonly unknown[]) => client.readContract({ address, abi: genesisAbi, functionName, args } as any) as Promise<any>;
export async function readGlobal(client: PublicClient, manifest: DeploymentManifest): Promise<GenesisGlobal> {
  const names = ["phase", "startBlock", "contributionEndBlock", "emissionEndBlock", "totalRaisedDot", "contributorCount", "genesisAllocation", "luckyRootAllocation", "emittedMini", "contributionBlocks", "protectionBlocks", "firstContributionMinimum", "subsequentContributionMinimumExclusive", "treasury", "protectionEmissionMini"];
  const values = await Promise.all(names.map((name) => read(client, manifest.source.contract, name)));
  const [rawPhase, startBlock, contributionEndBlock, emissionEndBlock, totalRaisedDot, contributorCount, genesisAllocation, luckyRootAllocation, emittedMini, contributionBlocks, protectionBlocks, firstContributionMinimum, subsequentContributionMinimumExclusive, treasury, protectionEmissionMini] = values;
  return { phase: Number(rawPhase), phaseName: phaseName(rawPhase), startBlock, contributionEndBlock, emissionEndBlock, totalRaisedDot, contributorCount, genesisAllocation, luckyRootAllocation, emittedMini, contributionBlocks, protectionBlocks, firstContributionMinimum, subsequentContributionMinimumExclusive, treasury, protectionEmissionMini };
}
export async function readUser(client: PublicClient, manifest: DeploymentManifest, account: Address): Promise<GenesisUser> {
  const [nativeBalance, userInfo, pendingMini] = await Promise.all([client.getBalance({ address: account }), read(client, manifest.source.contract, "userInfo", [account]), read(client, manifest.source.contract, "pendingMini", [account])]);
  return { nativeBalance, contributedDot: userInfo.contributedDot ?? userInfo[0], pendingMini };
}

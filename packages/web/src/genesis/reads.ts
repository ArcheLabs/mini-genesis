import type { Address, PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { genesisAbi } from "./abi";
import { phaseName, type PhaseName } from "./phase";

export type GenesisStatic = {
  genesisAllocation: bigint;
  contributionBlocks: bigint;
  protectionBlocks: bigint;
  totalEmissionBlocks: bigint;
  firstContributionMinimum: bigint;
  subsequentContributionMinimumExclusive: bigint;
  treasury: Address;
  protectionEmissionMini: bigint;
};

export type GenesisDynamic = {
  phase: number;
  phaseName: PhaseName;
  startBlock: bigint;
  contributionEndBlock: bigint;
  emissionEndBlock: bigint;
  lastSettledBlock: bigint;
  totalRaisedDot: bigint;
  contributorCount: bigint;
  emittedMini: bigint;
  observedBlockNumber: bigint;
};

export type GenesisUser = { nativeBalance: bigint; contributedDot: bigint; pendingMini: bigint };

const read = (client: PublicClient, address: Address, functionName: string, args?: readonly unknown[]) =>
  client.readContract({ address, abi: genesisAbi, functionName, args } as any) as Promise<any>;

export async function readGlobalStatic(client: PublicClient, manifest: DeploymentManifest): Promise<GenesisStatic> {
  const names = ["genesisAllocation", "contributionBlocks", "protectionBlocks", "totalEmissionBlocks", "firstContributionMinimum", "subsequentContributionMinimumExclusive", "treasury", "protectionEmissionMini"];
  const values = await Promise.all(names.map((name) => read(client, manifest.source.contract, name)));
  const [genesisAllocation, contributionBlocks, protectionBlocks, totalEmissionBlocks, firstContributionMinimum, subsequentContributionMinimumExclusive, treasury, protectionEmissionMini] = values;
  return { genesisAllocation, contributionBlocks, protectionBlocks, totalEmissionBlocks, firstContributionMinimum, subsequentContributionMinimumExclusive, treasury, protectionEmissionMini };
}

export async function readGlobalDynamic(client: PublicClient, manifest: DeploymentManifest): Promise<GenesisDynamic> {
  const [rawPhase, startBlock, contributionEndBlock, emissionEndBlock, lastSettledBlock, totalRaisedDot, contributorCount, emittedMini, observedBlockNumber] = await Promise.all([
    read(client, manifest.source.contract, "phase"),
    read(client, manifest.source.contract, "startBlock"),
    read(client, manifest.source.contract, "contributionEndBlock"),
    read(client, manifest.source.contract, "emissionEndBlock"),
    read(client, manifest.source.contract, "lastSettledBlock"),
    read(client, manifest.source.contract, "totalRaisedDot"),
    read(client, manifest.source.contract, "contributorCount"),
    read(client, manifest.source.contract, "emittedMini"),
    client.getBlockNumber(),
  ]);
  return { phase: Number(rawPhase), phaseName: phaseName(rawPhase), startBlock, contributionEndBlock, emissionEndBlock, lastSettledBlock, totalRaisedDot, contributorCount, emittedMini, observedBlockNumber };
}

export async function readUser(client: PublicClient, manifest: DeploymentManifest, account: Address): Promise<GenesisUser> {
  const [nativeBalance, userInfo, pendingMini] = await Promise.all([
    client.getBalance({ address: account }),
    read(client, manifest.source.contract, "userInfo", [account]),
    read(client, manifest.source.contract, "pendingMini", [account]),
  ]);
  return { nativeBalance, contributedDot: userInfo.contributedDot ?? userInfo[0], pendingMini };
}

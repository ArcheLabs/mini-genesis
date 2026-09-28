import type { Address, PublicClient } from "viem";
import { hasLivePhase1Contract, type DeploymentManifest } from "../config/manifest";
import { genesisAbi } from "./abi";
import { streamPhaseName, type StreamPhaseName } from "./stream-phase";

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
  phaseName: StreamPhaseName;
  startBlock: bigint;
  contributionEndBlock: bigint;
  emissionEndBlock: bigint;
  lastSettledBlock: bigint;
  totalRaisedDot: bigint;
  contributorCount: bigint;
  emittedMini: bigint;
  observedBlockNumber: bigint;
};

export type GenesisUser = { contributedDot: bigint; pendingMini: bigint; nativeBalance?: bigint };

const read = (client: PublicClient, address: Address, functionName: string, args?: readonly unknown[]) =>
  client.readContract({ address, abi: genesisAbi, functionName, args } as any) as Promise<any>;

function phase1Address(manifest: DeploymentManifest): Address {
  if (!hasLivePhase1Contract(manifest)) throw new Error("PHASE1_CONTRACT_UNAVAILABLE");
  return manifest.source.contract;
}

export async function readGlobalStatic(client: PublicClient, manifest: DeploymentManifest): Promise<GenesisStatic> {
  const address = phase1Address(manifest);
  const names = ["genesisAllocation", "contributionBlocks", "protectionBlocks", "totalEmissionBlocks", "firstContributionMinimum", "subsequentContributionMinimumExclusive", "treasury", "protectionEmissionMini"];
  const values = await Promise.all(names.map((name) => read(client, address, name)));
  const [genesisAllocation, contributionBlocks, protectionBlocks, totalEmissionBlocks, firstContributionMinimum, subsequentContributionMinimumExclusive, treasury, protectionEmissionMini] = values;
  return { genesisAllocation, contributionBlocks, protectionBlocks, totalEmissionBlocks, firstContributionMinimum, subsequentContributionMinimumExclusive, treasury, protectionEmissionMini };
}

export async function readGlobalDynamic(client: PublicClient, manifest: DeploymentManifest): Promise<GenesisDynamic> {
  const address = phase1Address(manifest);
  const [rawPhase, startBlock, contributionEndBlock, emissionEndBlock, lastSettledBlock, totalRaisedDot, contributorCount, emittedMini, observedBlockNumber] = await Promise.all([
    read(client, address, "phase"),
    read(client, address, "startBlock"),
    read(client, address, "contributionEndBlock"),
    read(client, address, "emissionEndBlock"),
    read(client, address, "lastSettledBlock"),
    read(client, address, "totalRaisedDot"),
    read(client, address, "contributorCount"),
    read(client, address, "emittedMini"),
    client.getBlockNumber(),
  ]);
  return { phase: Number(rawPhase), phaseName: streamPhaseName(rawPhase), startBlock, contributionEndBlock, emissionEndBlock, lastSettledBlock, totalRaisedDot, contributorCount, emittedMini, observedBlockNumber };
}

export async function readGenesisUserState(client: PublicClient, manifest: DeploymentManifest, contractAddress: Address): Promise<GenesisUser> {
  const address = phase1Address(manifest);
  const [userInfo, pendingMini] = await Promise.all([
    read(client, address, "userInfo", [contractAddress]),
    read(client, address, "pendingMini", [contractAddress]),
  ]);
  return { contributedDot: userInfo.contributedDot ?? userInfo[0], pendingMini };
}

/** @deprecated Use readGenesisUserState; wallet balance belongs to the execution adapter. */
export const readUser = readGenesisUserState;

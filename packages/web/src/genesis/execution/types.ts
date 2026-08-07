import type { Address, Hash } from "viem";
import type { ParsedDotAmount } from "../amount";

export type ContributionExecution = "evm" | "substrate";
export type GenesisBalance = { available: bigint; decimals: number };
export type ContributionContext = {
  manifest: import("../../config/manifest").DeploymentManifest;
  phase: number;
  firstMinimum: bigint;
  subsequentExclusive: bigint;
  contractAddress: Address;
};
export type ContributionState = "idle" | "validating" | "checking_mapping" | "simulating" | "awaiting_signature" | "submitted" | "included" | "finalized" | "failed";
export type ContributionUpdate = { state: ContributionState; hash?: Hash | `0x${string}`; error?: string };
export type ContributionResult = {
  execution: ContributionExecution;
  blockNumber: bigint;
  amount: ParsedDotAmount;
  contributorH160: Address;
  evmTxHash?: Hash;
  substrateTxHash?: `0x${string}`;
};

export interface GenesisExecutionAdapter {
  kind: ContributionExecution;
  getBalance(): Promise<GenesisBalance>;
  contribute(input: string, context: ContributionContext, onUpdate?: (update: ContributionUpdate) => void, signal?: AbortSignal): Promise<ContributionResult>;
  safeMax(): Promise<bigint | null>;
}

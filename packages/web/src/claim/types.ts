import type { Address, Hex } from "viem";

export type Ledger = { sourceH160: Address; contributedDot: string; earned: string; claimed: string; reserved: string; claimable: string; finalizedThroughBlock: string };
export type PreparedClaim = { claim: {
  creditGrantId: Hex;
  claimSequence: string;
  sourceH160: Address;
  username: string;
  usernameHash: Hex;
  amount: string;
  deadline: string;
  identityH160: Address;
  identityResolutionBlock: string;
  identityResolutionBlockHash: Hex;
  contextAlias: Hex;
  targetChainId: string;
  targetChainGenesisHash: Hex;
  miniLucky: Address;
}; typedData: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> } };
export type ClaimStatus = "PREPARED" | "RESERVED" | "SUBMITTING" | "SUBMITTED" | "FINALIZED" | "FAILED";
export type ClaimState = "idle" | "loading_ledger" | "preparing" | "review" | "awaiting_signature" | "submitting" | "submitted" | "finalizing" | "finalized" | "failed";

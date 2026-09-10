import type { Address, Hex } from "viem";

export type Ledger = { sourceH160: Address; contributedDot: string; earned: string; claimed: string; reserved: string; claimable: string; finalizedThroughBlock: string };
export type PreparedClaim = { claim: {
  sourceH160: Address;
  username: string;
  usernameHash: Hex;
  ownerAccountId32: Hex;
  targetH160: Address;
  amount: string;
  nonce: string;
}; typedData: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> } };
export type ClaimStatus = "PREPARED" | "RESERVED" | "SUBMITTING" | "SUBMITTED" | "FINALIZED" | "FAILED";
export type ClaimRecord = { creditGrantId: Hex; status: ClaimStatus };
export type ClaimState = "idle" | "loading_ledger" | "preparing" | "review" | "awaiting_signature" | "submitting" | "finalizing" | "finalized" | "failed";

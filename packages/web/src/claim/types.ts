import type { Address, Hex } from "viem";

export type Ledger = { sourceH160: Address; contributedDot: string; earned: string; claimed: string; reserved: string; claimable: string; finalizedThroughBlock: string };
export type PreparedClaim = { claim: { creditGrantId: Hex; sourceH160: Address; username: string; amount: string; deadline: string; targetChainId: string; miniLucky: Address }; typedData: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> } };
export type ClaimStatus = "AVAILABLE" | "RESERVED" | "SUBMITTED" | "FINALIZED" | "FAILED";
export type ClaimState = "idle" | "loading_ledger" | "preparing" | "review" | "awaiting_signature" | "submitting" | "submitted" | "finalizing" | "finalized" | "failed";

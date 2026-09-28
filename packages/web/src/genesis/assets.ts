import type { GenesisUser } from "./reads";

export function shouldLoadContributionHistory(walletKind: "evm" | "polkadot" | null): boolean {
  return walletKind !== null;
}

export function nativeAssetSummary(user: GenesisUser | null): { pendingMini: bigint | null; contributedDot: bigint | null } {
  return { pendingMini: user?.pendingMini ?? null, contributedDot: user?.contributedDot ?? null };
}

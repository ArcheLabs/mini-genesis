import type { Address } from "viem";

/** Canonical finalized Genesis I holdings have not been supplied in this repository. */
export const GENESIS1_HOLDER_SNAPSHOT_INPUT_REQUIRED = true;
export const GENESIS1_HOLDER_SNAPSHOT = {
  version: 1,
  holders: {} as Readonly<Record<string, bigint>>,
} as const;

export function normalizeGenesisHolder(address: string): string {
  return address.toLowerCase();
}

export function lookupGenesis1Holding(address: Address | string): bigint | null {
  if (GENESIS1_HOLDER_SNAPSHOT_INPUT_REQUIRED) return null;
  return GENESIS1_HOLDER_SNAPSHOT.holders[normalizeGenesisHolder(address)] ?? 0n;
}

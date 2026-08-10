export function contributionBoundaryPercent(
  contributionBlocks: bigint,
  totalEmissionBlocks: bigint,
): number {
  if (totalEmissionBlocks <= 0n) return 0;

  return Number(
    contributionBlocks * 10_000n /
    totalEmissionBlocks
  ) / 100;
}

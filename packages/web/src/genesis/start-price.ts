const PRICE_SCALE = 10n ** 18n;

function ceilDiv(value: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) throw new Error("INVALID_DIVISOR");
  return (value + divisor - 1n) / divisor;
}

export type StartPriceInput = {
  totalRaisedDot: bigint;
  lastSettledBlock: bigint;
  startBlock: bigint;
  genesisAllocation: bigint;
  totalEmissionBlocks: bigint;
};

export function calculateStartPriceX18(input: StartPriceInput): bigint | null {
  if (input.totalRaisedDot === 0n || input.startBlock === 0n || input.genesisAllocation === 0n || input.totalEmissionBlocks === 0n) return null;
  const elapsed = input.lastSettledBlock > input.startBlock ? input.lastSettledBlock - input.startBlock : 0n;
  const cappedElapsed = elapsed > input.totalEmissionBlocks ? input.totalEmissionBlocks : elapsed;
  const emittedAtLastContribution = input.genesisAllocation * cappedElapsed / input.totalEmissionBlocks;
  const remainingMini = input.genesisAllocation - emittedAtLastContribution;
  if (remainingMini === 0n) return null;
  return ceilDiv(input.totalRaisedDot * PRICE_SCALE, remainingMini);
}

export type LocalEmissionInput = {
  startBlock: bigint;
  currentBlock: bigint;
  genesisAllocation: bigint;
  totalEmissionBlocks: bigint;
};

export function calculateEmittedMini(input: LocalEmissionInput): bigint {
  if (input.startBlock === 0n || input.currentBlock <= input.startBlock || input.genesisAllocation === 0n || input.totalEmissionBlocks === 0n) return 0n;
  const elapsed = input.currentBlock - input.startBlock;
  const cappedElapsed = elapsed > input.totalEmissionBlocks ? input.totalEmissionBlocks : elapsed;
  return input.genesisAllocation * cappedElapsed / input.totalEmissionBlocks;
}

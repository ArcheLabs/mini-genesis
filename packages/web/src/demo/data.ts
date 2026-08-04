import type { GenesisDynamic, GenesisStatic, GenesisUser } from "../genesis/reads";

const E18 = 10n ** 18n;
export const DEMO_ACCOUNT = "0x7a31...f19c";
export const demoGenesis = {
  phase: "Contribution" as const,
  totalRaisedDot: 6840n * E18,
  contributorCount: 1248n,
  genesisAllocation: 10_000_000n * E18,
  emittedMini: 6_840_000n * E18,
  startPriceX18: 37_500_000_000_000n,
  walletBalance: 1284_620_000_000_000_000_000n,
  contributedDot: 320n * E18,
  pendingMini: 48_620n * E18,
};

export const demoStatic: GenesisStatic = {
  genesisAllocation: demoGenesis.genesisAllocation,
  contributionBlocks: 100n,
  protectionBlocks: 140n,
  totalEmissionBlocks: 240n,
  firstContributionMinimum: 10n * E18,
  subsequentContributionMinimumExclusive: 1n * E18,
  treasury: "0x0000000000000000000000000000000000000001",
  protectionEmissionMini: 5_833_333n * E18,
};

export const demoDynamic: GenesisDynamic = {
  phase: 1,
  phaseName: "Contribution",
  startBlock: 1_000_000n,
  contributionEndBlock: 1_000_100n,
  emissionEndBlock: 1_000_240n,
  lastSettledBlock: 1_000_084n,
  observedBlockNumber: 1_000_164n,
  totalRaisedDot: demoGenesis.totalRaisedDot,
  contributorCount: demoGenesis.contributorCount,
};

export const demoUser: GenesisUser = {
  nativeBalance: demoGenesis.walletBalance,
  contributedDot: demoGenesis.contributedDot,
  pendingMini: demoGenesis.pendingMini,
};

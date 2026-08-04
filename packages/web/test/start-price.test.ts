import { describe, expect, it } from "vitest";
import { calculateStartPriceX18 } from "../src/genesis/start-price";

describe("calculateStartPriceX18", () => {
  it("anchors to the latest settled contribution block and rounds up", () => {
    expect(calculateStartPriceX18({
      totalRaisedDot: 1n,
      lastSettledBlock: 8n,
      startBlock: 1n,
      genesisAllocation: 10n,
      totalEmissionBlocks: 10n,
    })).toBe((10n ** 18n + 2n) / 3n);
  });

  it("returns null before Genesis starts or after all MINI is emitted", () => {
    expect(calculateStartPriceX18({ totalRaisedDot: 1n, lastSettledBlock: 0n, startBlock: 0n, genesisAllocation: 10n, totalEmissionBlocks: 2n })).toBeNull();
    expect(calculateStartPriceX18({ totalRaisedDot: 1n, lastSettledBlock: 3n, startBlock: 1n, genesisAllocation: 10n, totalEmissionBlocks: 2n })).toBeNull();
  });
});

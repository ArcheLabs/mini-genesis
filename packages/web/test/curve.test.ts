import { describe, expect, it } from "vitest";
import { curveCumulativeCost, curvePriceAt, curveQuote, maxMiniForBudget, productionCurve } from "../src/genesis/curve";

describe("Genesis II curve", () => {
  it("matches the protocol checkpoints", () => {
    const points = [
      [0n, 3_500_000_000_000_000n, 0n],
      [500_000n * 10n ** 18n, 4_000_000_000_000_000n, 1_875n * 10n ** 18n],
      [1_000_000n * 10n ** 18n, 4_500_000_000_000_000n, 4_000n * 10n ** 18n],
      [1_500_000n * 10n ** 18n, 5_000_000_000_000_000n, 6_375n * 10n ** 18n],
      [1_600_000n * 10n ** 18n, 5_100_000_000_000_000n, 6_880n * 10n ** 18n],
      [2_000_000n * 10n ** 18n, 5_500_000_000_000_000n, 9_000n * 10n ** 18n],
    ] as const;
    for (const [sold, price, cost] of points) {
      expect(curvePriceAt(productionCurve, sold)).toBe(price);
      expect(curveCumulativeCost(productionCurve, sold)).toBe(cost);
    }
  });

  it("uses cumulative differences for split purchases", () => {
    const first = 500_000n * 10n ** 18n;
    const second = 500_000n * 10n ** 18n;
    expect(curveQuote(productionCurve, 0n, first) + curveQuote(productionCurve, first, second)).toBe(curveQuote(productionCurve, 0n, first + second));
  });

  it("finds the largest exact amount within a DOT budget", () => {
    const budget = 1_875n * 10n ** 18n;
    const amount = maxMiniForBudget(productionCurve, 0n, budget);
    expect(amount).toBeGreaterThanOrEqual(500_000n * 10n ** 18n);
    expect(curveQuote(productionCurve, 0n, amount)).toBeLessThanOrEqual(budget);
    expect(curveQuote(productionCurve, 0n, amount + 1n)).toBeGreaterThan(budget);
  });
});

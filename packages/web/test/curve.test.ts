import { describe, expect, it } from "vitest";
import { curveCumulativeCost, curvePriceAt, curveQuote, maxMiniForBudget, productionCurve } from "../src/genesis/curve";

describe("Genesis II curve", () => {
  it("matches the protocol checkpoints", () => {
    const points = [
      [0n, 750_000_000_000_000n, 0n],
      [500_000n * 10n ** 18n, 875_000_000_000_000n, 406_250_000_000_000_000_000n],
      [1_000_000n * 10n ** 18n, 1_000_000_000_000_000n, 875n * 10n ** 18n],
      [1_500_000n * 10n ** 18n, 1_125_000_000_000_000n, 1_406_250_000_000_000_000_000n],
      [2_000_000n * 10n ** 18n, 1_250_000_000_000_000n, 2_000n * 10n ** 18n],
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
    const budget = 406_250_000_000_000_000_000n;
    const amount = maxMiniForBudget(productionCurve, 0n, budget);
    expect(amount).toBeGreaterThanOrEqual(500_000n * 10n ** 18n);
    expect(curveQuote(productionCurve, 0n, amount)).toBeLessThanOrEqual(budget);
    expect(curveQuote(productionCurve, 0n, amount + 1n)).toBeGreaterThan(budget);
  });
});

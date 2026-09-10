import { formatUnits, parseUnits } from "viem";

export const MINI_UNIT = 10n ** 18n;
export const PHASE2_ALLOCATION = 2_000_000n * MINI_UNIT;
export const PHASE2_START_PRICE_X18 = 750_000_000_000_000n;
export const PHASE2_END_PRICE_X18 = 1_250_000_000_000_000n;
export const PHASE2_FULL_RAISE_DOT = 2_000n * MINI_UNIT;

export type CurveParameters = {
  allocation: bigint;
  startPrice: bigint;
  endPrice: bigint;
};

export const productionCurve: CurveParameters = {
  allocation: PHASE2_ALLOCATION,
  startPrice: PHASE2_START_PRICE_X18,
  endPrice: PHASE2_END_PRICE_X18,
};

export function curvePriceAt(parameters: CurveParameters, sold: bigint): bigint {
  if (sold < 0n || sold > parameters.allocation) throw new Error("CURVE_AMOUNT_OUT_OF_RANGE");
  return parameters.startPrice + (parameters.endPrice - parameters.startPrice) * sold / parameters.allocation;
}

export function curveCumulativeCost(parameters: CurveParameters, sold: bigint): bigint {
  if (sold < 0n || sold > parameters.allocation) throw new Error("CURVE_AMOUNT_OUT_OF_RANGE");
  const linear = parameters.startPrice * sold / MINI_UNIT;
  const quadratic = (parameters.endPrice - parameters.startPrice) * sold * sold / (2n * parameters.allocation * MINI_UNIT);
  return linear + quadratic;
}

export function curveQuote(parameters: CurveParameters, sold: bigint, miniAmount: bigint): bigint {
  if (miniAmount <= 0n) throw new Error("CURVE_AMOUNT_MUST_BE_POSITIVE");
  const soldAfter = sold + miniAmount;
  if (soldAfter > parameters.allocation) throw new Error("CURVE_AMOUNT_OUT_OF_RANGE");
  return curveCumulativeCost(parameters, soldAfter) - curveCumulativeCost(parameters, sold);
}

/** Largest exact MINI amount affordable with a DOT budget in EVM native units. */
export function maxMiniForBudget(parameters: CurveParameters, sold: bigint, dotBudgetWei: bigint): bigint {
  if (dotBudgetWei <= 0n || sold >= parameters.allocation) return 0n;
  let low = 0n;
  let high = parameters.allocation - sold;
  while (low < high) {
    const midpoint = (low + high + 1n) / 2n;
    if (curveQuote(parameters, sold, midpoint) <= dotBudgetWei) low = midpoint;
    else high = midpoint - 1n;
  }
  return low;
}

export function parseDotBudget(value: string, decimals = 18): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value) || value === "0" || /^0\.0+$/.test(value)) throw new Error("INVALID_DOT_BUDGET");
  return parseUnits(value, decimals);
}

export function formatDot(value: bigint, decimals = 18, maximumFractionDigits = 6): string {
  const raw = formatUnits(value, decimals);
  const [whole, fraction = ""] = raw.split(".");
  return fraction ? `${whole}.${fraction.slice(0, maximumFractionDigits).replace(/0+$/, "") || "0"}` : whole;
}

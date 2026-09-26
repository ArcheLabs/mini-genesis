import { useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from "react";
import { curvePriceAt } from "./curve";

export type BondingCurveChartProps = {
  allocation: bigint;
  sold: bigint;
  startBasis: bigint;
  endBasis: bigint;
  currentBasis?: bigint;
  language: "zh-CN" | "en";
};

const VIEW_WIDTH = 600;
const LEFT = 48;
const RIGHT = 570;
const TOP = 30;
const BOTTOM = 218;
const SCALE = 1_000_000_000n;

function grouped(value: bigint): string { return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

function formatMini(value: bigint, digits = 2): string {
  const scale = 10n ** BigInt(digits);
  const rounded = (value * scale + 10n ** 18n / 2n) / 10n ** 18n;
  const whole = grouped(rounded / scale);
  const fraction = (rounded % scale).toString().padStart(digits, "0");
  return digits ? `${whole}.${fraction}` : whole;
}

function formatBasis(value: bigint): string {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 6);
  return `${grouped(whole)}.${fraction}`;
}

function asPoint(amount: bigint, allocation: bigint) {
  const bounded = allocation > 0n ? amount < 0n ? 0n : amount > allocation ? allocation : amount : 0n;
  const scaled = allocation > 0n ? bounded * SCALE / allocation : 0n;
  const fraction = Number(scaled) / Number(SCALE);
  return {
    fraction,
    x: LEFT + (RIGHT - LEFT) * fraction,
    y: BOTTOM - (BOTTOM - TOP) * fraction,
  };
}

export function BondingCurveChart({ allocation, sold, startBasis, endBasis, currentBasis, language }: BondingCurveChartProps) {
  const [inspection, setInspection] = useState<bigint | null>(null);
  const current = asPoint(sold, allocation);
  const observedCurrentBasis = currentBasis ?? curvePriceAt({ allocation, startPrice: startBasis, endPrice: endBasis }, sold);
  const basisRange = endBasis - startBasis;
  const normalizedBasis = basisRange > 0n
    ? (observedCurrentBasis <= startBasis ? 0n : observedCurrentBasis >= endBasis ? SCALE : (observedCurrentBasis - startBasis) * SCALE / basisRange)
    : 0n;
  current.y = BOTTOM - (BOTTOM - TOP) * Number(normalizedBasis) / Number(SCALE);
  const amountAtInspection = inspection === null ? null : allocation * inspection / SCALE;
  const inspectionPoint = amountAtInspection === null ? null : asPoint(amountAtInspection, allocation);
  const inspectionBasis = amountAtInspection === null ? null : curvePriceAt({ allocation, startPrice: startBasis, endPrice: endBasis }, amountAtInspection);

  const inspect = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width) return;
    const screenMatrix = typeof svg.getScreenCTM === "function" ? svg.getScreenCTM() : null;
    const transform = screenMatrix?.inverse();
    let chartX = (event.clientX - bounds.left) * VIEW_WIDTH / bounds.width;
    if (transform) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      chartX = point.matrixTransform(transform).x;
    }
    const fraction = Math.max(0, Math.min(1, (chartX - LEFT) / (RIGHT - LEFT)));
    setInspection(BigInt(Math.round(fraction * Number(SCALE))));
  };

  const inspectKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "Escape") { setInspection(null); return; }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const step = SCALE / 100n;
    if (event.key === "Home") setInspection(0n);
    else if (event.key === "End") setInspection(SCALE);
    else setInspection((previous) => {
      const value = previous ?? (current.fraction === 0 ? 0n : BigInt(Math.round(current.fraction * Number(SCALE))));
      return event.key === "ArrowRight" ? (value + step > SCALE ? SCALE : value + step) : (value > step ? value - step : 0n);
    });
  };

  const leave = (event: ReactPointerEvent<SVGSVGElement>) => { if (event.pointerType !== "touch") setInspection(null); };
  const progress = inspection === null ? current.fraction : Number(inspection) / Number(SCALE);
  const currentPosition = `${(current.fraction * 100).toFixed(6)}%`;

  return <section className="curve-section" aria-label={language === "zh-CN" ? "购入曲线" : "Acquisition curve"}>
    <div className="curve-title-row">
      <h2>Bonding Curve</h2>
      <span>{language === "zh-CN" ? "最高购入基准" : "Maximum acquisition basis"} · {formatBasis(endBasis)} DOT / MINI</span>
    </div>
    <div className="curve-chart" data-testid="bonding-curve-chart">
      <svg viewBox="0 0 600 260" role="slider" tabIndex={0}
        aria-label={language === "zh-CN" ? "检查曲线上的购入基准" : "Inspect acquisition basis on the curve"}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number((BigInt(Math.round(progress * Number(SCALE))) * 10_000n) / SCALE) / 100}
        aria-valuetext={`${formatMini(allocation * BigInt(Math.round(progress * Number(SCALE))) / SCALE, 0)} MINI, ${formatBasis(curvePriceAt({ allocation, startPrice: startBasis, endPrice: endBasis }, allocation * BigInt(Math.round(progress * Number(SCALE))) / SCALE))} DOT / MINI`}
        onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={leave} onKeyDown={inspectKey}
        data-current-position={currentPosition} data-current-basis={observedCurrentBasis.toString()} data-testid="bonding-curve-interaction">
        <path className="curve-grid-line" d="M48 30H570M48 124H570M48 218H570M48 30V218M309 30V218M570 30V218" />
        <path className="curve-line" d="M48 218L570 30" />
        <line className="curve-current-marker" x1={current.x} y1={current.y} x2={current.x} y2="238" />
        <circle className="curve-current-point" cx={current.x} cy={current.y} r="7" data-testid="curve-current-point" />
        {inspectionPoint && <g className="curve-hover-point" data-testid="curve-hover-point">
          <line x1={inspectionPoint.x} y1="25" x2={inspectionPoint.x} y2="238" />
          <circle cx={inspectionPoint.x} cy={inspectionPoint.y} r="5" />
        </g>}
      </svg>
      {amountAtInspection !== null && inspectionBasis !== null && <div className="curve-tooltip" role="status" data-testid="curve-tooltip">
        <strong>{(Number(inspection) / Number(SCALE) * 100).toFixed(2)}%</strong>
        <span>{formatMini(amountAtInspection, 0)} MINI</span>
        <span>{formatBasis(inspectionBasis)} DOT / MINI</span>
      </div>}
      <div className="curve-axis"><span>0 MINI</span><span>{formatMini(allocation, 0)} MINI</span></div>
      <div className="curve-range"><span>{language === "zh-CN" ? "起始购入基准" : "Starting acquisition basis"} · {formatBasis(startBasis)}</span><span>{language === "zh-CN" ? "最高购入基准" : "Maximum acquisition basis"} · {formatBasis(endBasis)}</span></div>
    </div>
  </section>;
}

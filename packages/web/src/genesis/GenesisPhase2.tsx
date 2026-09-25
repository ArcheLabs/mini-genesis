import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatUnits, type PublicClient } from "viem";
import type { DeploymentManifest, GenesisWorkItem } from "../config/manifest";
import { buyExactMini } from "./curve-contribution";
import { buyExactMiniNative } from "./curve-contribution-native";
import { curvePriceAt, curveQuote, formatDot, maxMiniForBudget, productionCurve, parseDotBudget, type CurveParameters } from "./curve";
import { getPhase2Contract, type GenesisCurveDynamic } from "./curve-reads";
import { walletClient } from "../wallet/wallet-client";
import type { Eip1193Provider } from "../wallet/eip1193";
import type { WalletSession } from "../wallet/types";
import { GenesisWorkItems } from "./GenesisWorkItems";
import { genesisPhase2WorkItems } from "./work-items";

type Language = "zh-CN" | "en";
type Props = {
  language: Language;
  manifest: DeploymentManifest | null;
  publicClient: PublicClient | null;
  session: WalletSession;
  provider: Eip1193Provider | null;
  walletReady: boolean;
  correctChain: boolean;
  dynamic: GenesisCurveDynamic | null;
  demoMode: boolean;
  onConnect: () => void;
  onRefresh: () => void;
};

const CURVE_VIEW_WIDTH = 600;
const CURVE_LEFT = 42;
const CURVE_RIGHT = 570;
const CURVE_BOTTOM = 220;
const CURVE_TOP = 38;
const POSITION_SCALE = 1_000_000n;

function grouped(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatFixedUnits(value: bigint, decimals: number, digits = 2): string {
  const divisor = 10n ** BigInt(decimals);
  const scale = 10n ** BigInt(digits);
  const rounded = (value * scale + divisor / 2n) / divisor;
  const whole = grouped(rounded / scale);
  const fraction = (rounded % scale).toString().padStart(digits, "0");
  return digits ? whole + "." + fraction : whole;
}

function mini(value: bigint | null | undefined): string {
  return value == null ? "—" : formatFixedUnits(value, 18) + " MINI";
}

function miniAxis(value: bigint): string {
  const amount = formatFixedUnits(value, 18);
  return (amount.endsWith(".00") ? amount.slice(0, -3) : amount) + " MINI";
}

function dot(value: bigint | null | undefined): string {
  return value == null ? "—" : formatFixedUnits(value, 18) + " DOT";
}

function curvePrice(value: bigint): string {
  const raw = formatUnits(value, 18);
  const [whole, fraction = ""] = raw.split(".");
  return grouped(BigInt(whole)) + "." + fraction.padEnd(6, "0").slice(0, 6);
}

function countdown(seconds: bigint): string {
  if (seconds <= 0n) return "0m";
  const days = seconds / 86_400n;
  const hours = seconds % 86_400n / 3_600n;
  const minutes = seconds % 3_600n / 60n;
  return days ? days + "d " + hours + "h " + minutes + "m" : hours + "h " + minutes + "m";
}

function curvePoint(amount: bigint, allocation: bigint): { x: number; y: number; fraction: number } {
  if (allocation <= 0n) return { x: CURVE_LEFT, y: CURVE_BOTTOM, fraction: 0 };
  const bounded = amount < 0n ? 0n : amount > allocation ? allocation : amount;
  const scaled = bounded * 1_000_000_000n / allocation;
  const fraction = Number(scaled) / 1_000_000_000;
  return {
    x: CURVE_LEFT + (CURVE_RIGHT - CURVE_LEFT) * fraction,
    y: CURVE_BOTTOM - (CURVE_BOTTOM - CURVE_TOP) * fraction,
    fraction,
  };
}

function localizedStatus(status: GenesisWorkItem["status"], language: Language): string {
  if (language === "zh-CN") {
    return { planned: "计划中", active: "进行中", delivered: "已交付", investigated: "已研究", discontinued: "已停止" }[status];
  }
  return status.toUpperCase();
}

export function GenesisPhase2({ language, manifest, publicClient, session, provider, walletReady, correctChain, dynamic, demoMode, onConnect, onRefresh }: Props) {
  const [clock, setClock] = useState(() => Math.floor(Date.now() / 1000));
  const [budget, setBudget] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);
  const curveSvgRef = useRef<SVGSVGElement>(null);
  const zh = language === "zh-CN";
  const phase2 = manifest?.genesis?.phases.phase2;
  const phase2Contract = manifest ? getPhase2Contract(manifest) : null;
  const parameters: CurveParameters = useMemo(() => ({
    allocation: dynamic?.allocation ?? productionCurve.allocation,
    startPrice: dynamic?.startPrice ?? productionCurve.startPrice,
    endPrice: dynamic?.endPrice ?? productionCurve.endPrice,
  }), [dynamic]);
  const sold = dynamic?.totalSoldMini ?? 0n;
  const currentSold = sold > parameters.allocation ? parameters.allocation : sold;
  const budgetWei = useMemo(() => {
    try { return parseDotBudget(budget); } catch { return 0n; }
  }, [budget]);
  const quotedMini = useMemo(() => maxMiniForBudget(parameters, currentSold, budgetWei), [budgetWei, currentSold, parameters]);
  const quotedCost = useMemo(() => quotedMini ? curveQuote(parameters, currentSold, quotedMini) : 0n, [currentSold, parameters, quotedMini]);
  const afterBuyAmount = quotedMini ? currentSold + quotedMini : null;
  const priceAfter = afterBuyAmount != null ? curvePriceAt(parameters, afterBuyAmount) : dynamic?.spotPrice ?? curvePriceAt(parameters, currentSold);
  const phase2Status = dynamic?.phaseName === "Waiting" ? "WAITING"
    : dynamic?.phaseName === "Ended" ? (dynamic.totalSoldMini === dynamic.allocation ? "COMPLETED · SOLD OUT" : "COMPLETED")
      : phase2?.status === "ended" ? "COMPLETED"
        : phase2?.status === "template" && !demoMode ? "WAITING" : "LIVE";
  const ended = phase2Status.startsWith("COMPLETED");
  const waiting = dynamic?.phaseName === "Waiting";
  const phase2Time = dynamic
    ? (waiting ? dynamic.startTime - BigInt(clock) : dynamic.phaseName === "Active" ? dynamic.endTime - BigInt(clock) : 0n)
    : 0n;
  const currentPrice = dynamic?.spotPrice ?? curvePriceAt(parameters, currentSold);
  const purchaseEnabled = Boolean(dynamic?.phase === 1 && phase2Contract);
  const manifestWorkItems = phase2?.workItems ?? [];
  const workItems = useMemo(() => genesisPhase2WorkItems.map((item) => {
    const configured = manifestWorkItems.find((candidate) => candidate.id === item.id);
    return configured ? { ...item, status: configured.status } : item;
  }), [manifestWorkItems]);

  const currentPoint = curvePoint(currentSold, parameters.allocation);
  const afterBuyPoint = afterBuyAmount == null ? null : curvePoint(afterBuyAmount, parameters.allocation);
  const hoverAmount = hoveredPosition == null ? null : parameters.allocation * BigInt(hoveredPosition) / POSITION_SCALE;
  const hoverPoint = hoverAmount == null ? null : curvePoint(hoverAmount, parameters.allocation);
  const hoverPrice = hoverAmount == null ? null : curvePriceAt(parameters, hoverAmount);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const inspectCurve = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width) return;
    const transform = svg.getScreenCTM()?.inverse();
    let chartX = (event.clientX - bounds.left) * CURVE_VIEW_WIDTH / bounds.width;
    if (transform) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      chartX = point.matrixTransform(transform).x;
    }
    const fraction = Math.max(0, Math.min(1, (chartX - CURVE_LEFT) / (CURVE_RIGHT - CURVE_LEFT)));
    setHoveredPosition(Math.round(fraction * Number(POSITION_SCALE)));
  };

  const leaveCurve = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== "touch") setHoveredPosition(null);
  };

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!session || !walletReady) { onConnect(); return; }
    if (!phase2Contract) { setError(zh ? "Genesis II 合约尚未部署到此环境。" : "The Genesis II contract is not deployed in this environment."); return; }
    if (!dynamic || dynamic.phase !== 1) { setError(zh ? "当前不在可购买阶段。" : "Purchases are not active right now."); return; }
    if (quotedMini === 0n || quotedCost === 0n) { setError(zh ? "该 DOT 预算不足以购买 MINI。" : "This DOT budget is too small to purchase MINI."); return; }
    const maxCost = quotedCost + (quotedCost / 2_000n || 1n);
    setBusy(true);
    try {
      if (session.kind === "evm") {
        if (!provider || !session.address || !manifest || !correctChain || !publicClient) throw new Error("WRONG_CHAIN");
        const result = await buyExactMini(publicClient, walletClient(provider, manifest), manifest, session.address, phase2Contract, quotedMini, maxCost);
        setMessage(zh ? "已获得 " + mini(result.miniAmount) + "。" : "Received " + mini(result.miniAmount) + ".");
      } else {
        if (!session.api || !manifest) throw new Error("CONFIGURATION_MISMATCH");
        const selected = session.accounts.find((item) => item.address === session.selectedAccountAddress);
        if (!selected) throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED");
        const result = await buyExactMiniNative(session.api, selected.signer, session.selectedAccountAddress, manifest, phase2Contract, quotedMini, maxCost);
        setMessage(zh ? "已获得 " + mini(result.miniAmount) + "。" : "Received " + mini(result.miniAmount) + ".");
      }
      setBudget("");
      onRefresh();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : String(reason);
      setError(code === "WRONG_CHAIN" ? (zh ? "请先切换到 Polkadot Hub 网络。" : "Switch to Polkadot Hub before purchasing.") : code);
    } finally {
      setBusy(false);
    }
  };

  const priceNowLabel = zh ? "当前价格" : "Current price";
  const timeLabel = waiting ? (zh ? "距开始" : "Starts in") : (zh ? "剩余时间" : "Remaining");

  return <section className="stage-panel phase2-panel" data-testid="genesis-phase2">
    <header className="phase2-heading">
      <div>
        <h1>Genesis II</h1>
        <span className={"phase-status phase-status-" + phase2Status.toLowerCase().replace(/[^a-z]+/g, "-")}>{phase2Status}</span>
      </div>
      <div className="phase2-price-block">
        <span>{priceNowLabel}</span>
        <strong data-testid="phase2-current-price">{curvePrice(currentPrice)} <small>DOT / MINI</small></strong>
      </div>
      <div className="phase2-facts" aria-label={zh ? "Genesis II 状态" : "Genesis II status"}>
        <div><strong data-testid="phase2-holder-count">{dynamic?.buyerCount.toLocaleString() ?? "—"}</strong><span>Holders</span></div>
        <div><strong data-testid="phase2-time-remaining">{dynamic ? countdown(phase2Time) : "—"}</strong><span>{timeLabel}</span></div>
      </div>
    </header>

    {ended && <p className="campaign-closed" role="status">{zh ? "购买已关闭" : "Purchases are closed"}</p>}

    <div className="phase2-trade-layout">
      <section className="curve-section" aria-label={zh ? "价格曲线" : "Price curve"}>
        <div className="curve-title-row">
          <h2>Bonding Curve</h2>
          <span>{zh ? "最高价格" : "Maximum"} · {curvePrice(parameters.endPrice)} DOT / MINI</span>
        </div>
        <div className="curve-chart" data-testid="bonding-curve-chart">
          <svg
            ref={curveSvgRef}
            viewBox="0 0 600 260"
            role="img"
            aria-label={zh ? "可交互的 Genesis II 线性价格曲线" : "Interactive Genesis II linear price curve"}
            onPointerMove={inspectCurve}
            onPointerDown={inspectCurve}
            onPointerLeave={leaveCurve}
            data-current-position={currentPoint.fraction}
            data-after-buy-position={afterBuyPoint?.fraction}
          >
            <path className="curve-grid-line" d="M42 220H570M42 38H570" />
            <path className="curve-line" d="M42 220L570 38" />
            <path className="curve-sold-line" d={"M42 220L" + currentPoint.x + " " + currentPoint.y} />
            <line className="curve-current-marker" x1={currentPoint.x} y1={currentPoint.y} x2={currentPoint.x} y2="238" />
            <circle className="curve-current-point" cx={currentPoint.x} cy={currentPoint.y} r="7" data-testid="curve-current-point" />
            {afterBuyPoint && <g data-testid="curve-after-buy-point">
              <line className="curve-after-marker" x1={afterBuyPoint.x} y1={afterBuyPoint.y} x2={afterBuyPoint.x} y2="238" />
              <circle className="curve-after-point" cx={afterBuyPoint.x} cy={afterBuyPoint.y} r="8" />
            </g>}
            {hoverPoint && <g className="curve-hover-point">
              <line x1={hoverPoint.x} y1="30" x2={hoverPoint.x} y2="238" />
              <circle cx={hoverPoint.x} cy={hoverPoint.y} r="5" />
            </g>}
          </svg>
          {hoverAmount != null && hoverPrice != null && <div className="curve-tooltip" role="status" data-testid="curve-tooltip">
            <strong>{(hoveredPosition! / 10_000).toFixed(2)}%</strong>
            <span>{miniAxis(hoverAmount)} sold</span>
            <span>{curvePrice(hoverPrice)} DOT / MINI</span>
          </div>}
          <div className="curve-axis"><span>0 MINI</span><span>{miniAxis(parameters.allocation)}</span></div>
          <div className="curve-legend">
            <span><i className="legend-current" />{zh ? "当前" : "Current"}</span>
            {afterBuyPoint && <span><i className="legend-after" />{zh ? "购买后" : "After buy"}</span>}
            <span className="curve-start-price">{curvePrice(parameters.startPrice)} DOT / MINI</span>
          </div>
        </div>
        <div className="curve-range"><span>{zh ? "起始价格" : "Start"} · {curvePrice(parameters.startPrice)}</span><span>{zh ? "最高价格" : "Maximum"} · {curvePrice(parameters.endPrice)}</span></div>
      </section>

      {ended ? <section className="curve-purchase purchase-panel purchase-closed"><h2>{zh ? "获得 MINI" : "Get MINI"}</h2><p>{zh ? "当前阶段已结束。" : "This stage has ended."}</p></section> : <section className="curve-purchase purchase-panel" aria-label={zh ? "购买 MINI" : "Buy MINI"}>
        <h2>{zh ? "获得 MINI" : "Get MINI"}</h2>
        <label className="budget-label" htmlFor="phase2-dot-budget">{zh ? "支付上限" : "Budget"}</label>
        <div className="budget-input-wrap">
          <input
            id="phase2-dot-budget"
            aria-label={zh ? "支付 DOT 数量" : "DOT amount"}
            inputMode="decimal"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            placeholder="0.00"
          />
          <span>DOT</span>
        </div>
        <div className="budget-presets" aria-label={zh ? "快捷金额" : "Quick amounts"}>
          {["1", "5", "20"].map((value) => <button key={value} type="button" className={budget === value ? "selected" : ""} onClick={() => setBudget(value)}>{value} DOT</button>)}
        </div>
        <div className="purchase-receive">
          <span>{zh ? "预计获得" : "You receive"}</span>
          <strong data-testid="phase2-mini-quote">{quotedMini ? "≈" + mini(quotedMini) : "0.00 MINI"}</strong>
        </div>
        <div className="purchase-details">
          <div><span>{zh ? "预计成本" : "Estimated cost"}</span><strong data-testid="phase2-dot-quote">{dot(quotedCost)}</strong></div>
          <div><span>{priceNowLabel}</span><strong>{curvePrice(currentPrice)} DOT / MINI</strong></div>
          <div><span>{zh ? "购买后价格" : "After buy"}</span><strong data-testid="phase2-price-after">{curvePrice(priceAfter)} DOT / MINI</strong></div>
        </div>
        <button className="submit-button" type="button" disabled={busy || !purchaseEnabled} onClick={() => void submit()}>
          {busy ? (zh ? "处理中…" : "Processing…") : session && walletReady ? (zh ? "获得 MINI" : "Get MINI") : (zh ? "连接钱包" : "Connect wallet")}
        </button>
        {message && <p className="purchase-message success" role="status">{message}</p>}
        {error && <p className="purchase-message error" role="alert">{error}</p>}
        <details className="price-disclosure">
          <summary>{zh ? "价格由 bonding curve 自动计算" : "Price is calculated by the bonding curve"} <span aria-hidden="true">ⓘ</span></summary>
          <p>{zh
            ? "购买成本按累计曲线差值计算，并带有小幅确定性滑点保护。全额售出容量为 9,000 DOT，不是软顶或融资目标。曲线不保证二级市场价格、流动性或未来估值。"
            : "Purchase cost is determined by cumulative curve differences with a small deterministic slippage limit. Full-sale capacity is 9,000 DOT, not a soft cap or fundraising target. The curve does not guarantee secondary-market price, liquidity, or future valuation."}</p>
        </details>
      </section>}
    </div>

    <GenesisWorkItems language={language} mode={ended ? "phase2-enabled" : "phase2-funds"} workItems={workItems} />
  </section>;
}

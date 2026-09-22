import { useEffect, useMemo, useState } from "react";
import { formatUnits, type PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
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

function mini(value: bigint | null | undefined): string {
  return value == null ? "—" : `${formatUnits(value, 18)} MINI`;
}

function dot(value: bigint | null | undefined): string {
  return value == null ? "—" : `${formatDot(value)} DOT`;
}

function curvePrice(value: bigint): string {
  const raw = formatUnits(value, 18);
  const [whole, fraction = ""] = raw.split(".");
  return `${whole}.${fraction.padEnd(6, "0").slice(0, 6)}`;
}

function countdown(seconds: bigint): string {
  if (seconds <= 0n) return "0m";
  const days = seconds / 86_400n;
  const hours = seconds % 86_400n / 3_600n;
  const minutes = seconds % 3_600n / 60n;
  return days ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
}

export function GenesisPhase2({ language, manifest, publicClient, session, provider, walletReady, correctChain, dynamic, demoMode, onConnect, onRefresh }: Props) {
  const [clock, setClock] = useState(() => Math.floor(Date.now() / 1000));
  const [budget, setBudget] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const zh = language === "zh-CN";
  const phase2 = manifest?.genesis?.phases.phase2;
  const phase2Contract = manifest ? getPhase2Contract(manifest) : null;
  const parameters: CurveParameters = useMemo(() => ({ allocation: dynamic?.allocation ?? productionCurve.allocation, startPrice: dynamic?.startPrice ?? productionCurve.startPrice, endPrice: dynamic?.endPrice ?? productionCurve.endPrice }), [dynamic]);
  const sold = dynamic?.totalSoldMini ?? 0n;
  const remaining = parameters.allocation - sold;
  const budgetWei = useMemo(() => { try { return parseDotBudget(budget); } catch { return 0n; } }, [budget]);
  const quotedMini = useMemo(() => maxMiniForBudget(parameters, sold, budgetWei), [budgetWei, parameters, sold]);
  const quotedCost = useMemo(() => quotedMini ? curveQuote(parameters, sold, quotedMini) : 0n, [parameters, quotedMini, sold]);
  const priceAfter = quotedMini ? curvePriceAt(parameters, sold + quotedMini) : dynamic?.spotPrice ?? parameters.startPrice;
  const phase2Status = dynamic?.phaseName === "Waiting" ? "WAITING" : dynamic?.phaseName === "Ended" ? (dynamic.totalSoldMini === dynamic.allocation ? "COMPLETED · SOLD OUT" : "COMPLETED") : phase2?.status === "ended" ? "COMPLETED" : phase2?.status === "template" && !demoMode ? "WAITING" : "LIVE";
  const ended = phase2Status.startsWith("COMPLETED");
  const phase2Time = dynamic ? (dynamic.phaseName === "Waiting" ? dynamic.startTime - BigInt(clock) : dynamic.phaseName === "Active" ? dynamic.endTime - BigInt(clock) : 0n) : 0n;
  const curveProgress = parameters.allocation ? Number(sold * 10_000n / parameters.allocation) / 100 : 0;
  const purchaseEnabled = Boolean(dynamic?.phase === 1 && phase2Contract);
  const workItems = phase2?.workItems ?? genesisPhase2WorkItems;

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const submit = async () => {
    setError(null); setMessage(null);
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
        setMessage(zh ? `已获得 ${mini(result.miniAmount)}。` : `Received ${mini(result.miniAmount)}.`);
      } else {
        if (!session.api || !manifest) throw new Error("CONFIGURATION_MISMATCH");
        const selected = session.accounts.find((item) => item.address === session.selectedAccountAddress);
        if (!selected) throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED");
        const result = await buyExactMiniNative(session.api, selected.signer, session.selectedAccountAddress, manifest, phase2Contract, quotedMini, maxCost);
        setMessage(zh ? `已获得 ${mini(result.miniAmount)}。` : `Received ${mini(result.miniAmount)}.`);
      }
      onRefresh();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : String(reason);
      setError(code === "WRONG_CHAIN" ? (zh ? "请先切换到 Polkadot Hub 网络。" : "Switch to Polkadot Hub before purchasing.") : code);
    } finally { setBusy(false); }
  };

  return <section className="stage-panel phase2-panel">
    <div className="stage-eyebrow">Genesis II · {phase2Status}</div>
    <h1>Genesis II</h1>
    <p className="stage-lead">{zh ? "Genesis I 支持了 MiniJAM 的早期阶段。Genesis II 从 Early Operations Reserve 开放一份有限配额，用于下一轮执行周期。" : "A limited tranche from the Early Operations Reserve funds the next execution cycle. Here is what we are building."}</p>
    <div className="reserve-banner"><strong>{mini(parameters.allocation)} {zh ? "来自 Early Operations Reserve" : "from Early Operations Reserve"}</strong><span>{zh ? "不会创建新的 MINI。这是 10,000,000 MINI Early Operations Reserve 的 20%，也是总供应量的 0.2%。" : "No additional supply is created. This is 20% of the 10,000,000 MINI reserve and 0.2% of total MINI supply."}</span></div>
    <div className="curve-head"><div><span>{zh ? "起始价格" : "Starting price"}</span><strong>{curvePrice(parameters.startPrice)} DOT/MINI</strong></div><div className="curve-arrow">→</div><div><span>{zh ? "最高价格" : "Maximum price"}</span><strong>{curvePrice(parameters.endPrice)} DOT/MINI</strong></div></div>
    <div className="curve-chart" aria-label={zh ? "Genesis II 线性 bonding curve" : "Genesis II linear bonding curve"}><svg viewBox="0 0 600 210" role="img"><path d="M40 174H570M40 174V22M40 174L570 38" /><line x1="40" y1="174" x2={40 + 530 * Math.min(1, Math.max(0, Number(sold * 1000n / parameters.allocation) / 1000))} y2={174 - 136 * Math.min(1, Math.max(0, Number(sold * 1000n / parameters.allocation) / 1000))} className="curve-position" /><circle cx={40 + 530 * Math.min(1, Math.max(0, Number(sold * 1000n / parameters.allocation) / 1000))} cy={174 - 136 * Math.min(1, Math.max(0, Number(sold * 1000n / parameters.allocation) / 1000))} r="7" className="curve-dot" /></svg><div className="curve-axis"><span>{curvePrice(parameters.startPrice)}</span><span>{zh ? `当前位置 · ${curveProgress.toFixed(2)}%` : `Current position · ${curveProgress.toFixed(2)}%`}</span><span>{curvePrice(parameters.endPrice)} DOT/MINI</span></div></div>
    <div className="stage-stats phase2-stats">
      <div><span>{ended ? (zh ? "实际终端价格" : "Actual terminal price") : (zh ? "当前价格" : "Current price")}</span><strong>{curvePrice(dynamic?.spotPrice ?? parameters.startPrice)} DOT/MINI</strong></div>
      <div><span>{zh ? "已募集" : "DOT raised"}</span><strong>{dot(dynamic?.totalRaisedDot ?? 0n)}</strong></div>
      <div><span>{zh ? "已分配 MINI" : "MINI distributed"}</span><strong>{mini(sold)} / {mini(parameters.allocation)}</strong></div>
      <div><span>{zh ? "剩余 MINI" : "MINI remaining"}</span><strong>{mini(remaining)}</strong></div>
      <div><span>{zh ? "参与地址" : "Participants"}</span><strong>{dynamic?.buyerCount.toLocaleString() ?? "—"}{zh ? " 个地址" : " addresses"}</strong></div>
      <div><span>{zh ? "剩余时间" : "Time remaining"}</span><strong>{dynamic ? countdown(phase2Time) : "—"}</strong></div>
    </div>
    {ended ? <div className="campaign-closed"><strong>{zh ? "购买已关闭" : "Purchase closed"}</strong><p>{zh ? "Genesis II 已结束。实际募集金额、分配量、剩余 MINI、参与地址和终端价格作为历史结果保留。" : "Genesis II has ended. Its actual raised amount, distribution, remaining MINI, participants, and terminal price remain available as historical results."}</p></div> : <div className="curve-purchase"><div className="purchase-title"><span>{zh ? "获得 MINI" : "Get MINI"}</span><span>{zh ? "DOT 预算" : "DOT budget"}</span></div><div className="budget-presets">{["1", "5", "20"].map((value) => <button key={value} type="button" className={budget === value ? "selected" : ""} onClick={() => setBudget(value)}>{value} DOT</button>)}<input aria-label={zh ? "自定义 DOT 预算" : "Custom DOT budget"} inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder={zh ? "自定义" : "Custom"} /></div><div className="purchase-preview"><div><span>{zh ? "你将获得" : "You receive"}</span><strong>{mini(quotedMini)}</strong></div><div><span>{zh ? "预计成本" : "Estimated cost"}</span><strong>{dot(quotedCost)}</strong></div><div><span>{zh ? "当前价格" : "Current price"}</span><strong>{curvePrice(dynamic?.spotPrice ?? parameters.startPrice)}</strong></div><div><span>{zh ? "购买后价格" : "Price after purchase"}</span><strong>{curvePrice(priceAfter)}</strong></div></div><button className="submit-button" type="button" disabled={busy || !purchaseEnabled} onClick={() => void submit()}>{busy ? (zh ? "处理中…" : "Processing…") : session && walletReady ? (zh ? "获得 MINI" : "Get MINI") : (zh ? "连接钱包" : "Connect wallet")}</button>{message && <p className="purchase-message success">{message}</p>}{error && <p className="purchase-message error">{error}</p>}<p className="slippage-note">{zh ? "购买成本由累计曲线差值确定，并带有小幅确定性滑点保护。全额售出容量为 9,000 DOT，不是软顶或融资目标。曲线不保证二级市场价格、流动性或未来估值。" : "Purchase cost is determined by cumulative curve differences with a small deterministic slippage limit. Full-sale capacity is 9,000 DOT, not a soft cap or fundraising target. The curve does not guarantee secondary-market price, liquidity, or future valuation."}</p></div>}
    <GenesisWorkItems language={language} mode={ended ? "phase2-enabled" : "phase2-funds"} workItems={workItems} />
    <p className="risk-note">{zh ? "MINI 是实验性加密资产，参与 Genesis II 具有重大风险。参与人数代表地址数量，而非经过验证的独立个人数量。" : "MINI is an experimental crypto asset. Genesis II participation carries substantial risk. Participant count represents addresses, not verified unique persons."}</p>
  </section>;
}

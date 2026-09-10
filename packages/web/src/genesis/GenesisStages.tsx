import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, type Address, type PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { getPhase2Contract, readCurveDynamic, type GenesisCurveDynamic } from "./curve-reads";
import { buyExactMini } from "./curve-contribution";
import { buyExactMiniNative } from "./curve-contribution-native";
import { curvePriceAt, curveQuote, formatDot, maxMiniForBudget, productionCurve, parseDotBudget, type CurveParameters } from "./curve";
import { walletClient } from "../wallet/wallet-client";
import type { Eip1193Provider } from "../wallet/eip1193";
import type { WalletSession } from "../wallet/types";
import type { GenesisDynamic, GenesisStatic } from "./reads";
import { genesisAchievements } from "./achievements";

type Language = "zh-CN" | "en";
type Stage = "phase1" | "phase2" | "phase3";
type Phase1Stats = { allocation: bigint | null; raised: bigint | null; participants: bigint | null; mini: bigint | null };

type Props = {
  language: Language;
  manifest: DeploymentManifest | null;
  publicClient: PublicClient | null;
  session: WalletSession;
  provider: Eip1193Provider | null;
  walletReady: boolean;
  correctChain: boolean;
  phase1Static: GenesisStatic | null;
  phase1Dynamic: GenesisDynamic | null;
  phase1UserMini?: bigint | null;
  demoMode?: boolean;
  onConnect: () => void;
  onRefresh: () => void;
};

const FINAL_REFERENCE_PRICE = 89_460_000_000_000n;
function mini(value: bigint | null | undefined): string { return value == null ? "—" : `${Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} MINI`; }
function dot(value: bigint | null | undefined): string { return value == null ? "—" : `${formatDot(value)} DOT`; }
function stageLabel(stage: Stage, language: Language): string { return language === "zh-CN" ? ({ phase1: "Genesis I", phase2: "Genesis II", phase3: "Genesis III" }[stage]) : ({ phase1: "Genesis I", phase2: "Genesis II", phase3: "Genesis III" }[stage]); }
function phase2Status(dynamic: GenesisCurveDynamic | null): string { return dynamic?.phaseName === "Waiting" ? "WAITING" : dynamic?.phaseName === "Ended" ? (dynamic.totalSoldMini === dynamic.allocation ? "COMPLETED · SOLD OUT" : "COMPLETED") : "LIVE"; }
function phase2TabStatus(dynamic: GenesisCurveDynamic | null, contract: Address | null, demoMode: boolean): string { return dynamic ? phase2Status(dynamic) : contract || demoMode ? "LIVE" : "NOT DEPLOYED"; }
function countdown(seconds: bigint): string { if (seconds <= 0n) return "0m"; const days = seconds / 86_400n; const hours = seconds % 86_400n / 3_600n; const minutes = seconds % 3_600n / 60n; return days ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`; }

export function GenesisStages({ language, manifest, publicClient, session, provider, walletReady, correctChain, phase1Static, phase1Dynamic, phase1UserMini = null, demoMode = false, onConnect, onRefresh }: Props) {
  const [stage, setStage] = useState<Stage>("phase2");
  const [dynamic, setDynamic] = useState<GenesisCurveDynamic | null>(null);
  const [clock, setClock] = useState(() => Math.floor(Date.now() / 1000));
  const [budget, setBudget] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient || !manifest || !getPhase2Contract(manifest)) return;
    try {
      setDynamic(await readCurveDynamic(publicClient, manifest));
      setError(null);
    } catch { setError(language === "zh-CN" ? "Phase II 链上数据暂不可用。" : "Phase II chain data is temporarily unavailable."); }
  }, [language, manifest, publicClient, session]);

  useEffect(() => { void refresh(); const interval = window.setInterval(() => void refresh(), 10_000); return () => window.clearInterval(interval); }, [refresh]);
  useEffect(() => { const interval = window.setInterval(() => setClock(Math.floor(Date.now() / 1000)), 30_000); return () => window.clearInterval(interval); }, []);

  const parameters: CurveParameters = useMemo(() => ({ allocation: dynamic?.allocation ?? productionCurve.allocation, startPrice: dynamic?.startPrice ?? productionCurve.startPrice, endPrice: dynamic?.endPrice ?? productionCurve.endPrice }), [dynamic]);
  const sold = dynamic?.totalSoldMini ?? 0n;
  const budgetWei = useMemo(() => { try { return parseDotBudget(budget); } catch { return 0n; } }, [budget]);
  const quotedMini = useMemo(() => maxMiniForBudget(parameters, sold, budgetWei), [budgetWei, parameters, sold]);
  const quotedCost = useMemo(() => quotedMini ? curveQuote(parameters, sold, quotedMini) : 0n, [parameters, quotedMini, sold]);
  const priceAfter = quotedMini ? curvePriceAt(parameters, sold + quotedMini) : dynamic?.spotPrice ?? parameters.startPrice;
  const phase2Contract = manifest ? getPhase2Contract(manifest) : null;
  const phase2Time = dynamic ? (dynamic.phaseName === "Waiting" ? dynamic.startTime - BigInt(clock) : dynamic.phaseName === "Active" ? dynamic.endTime - BigInt(clock) : 0n) : 0n;
  const phase2Summary = dynamic ? phase2Status(dynamic) : phase2Contract || demoMode ? "LIVE" : "NOT DEPLOYED";
  const phase1: Phase1Stats = {
    allocation: phase1Static?.genesisAllocation ?? null,
    raised: phase1Dynamic?.totalRaisedDot ?? null,
    participants: phase1Dynamic?.contributorCount ?? null,
    mini: phase1UserMini,
  };
  const achievements = manifest?.genesis?.phases.phase1.achievements ?? genesisAchievements;

  const submit = async () => {
    setError(null); setMessage(null);
    if (!session || !walletReady) { onConnect(); return; }
    if (!phase2Contract) { setError(language === "zh-CN" ? "Phase II 合约尚未部署到此环境。" : "The Phase II contract is not deployed in this environment."); return; }
    if (dynamic && dynamic.phase !== 1) { setError(language === "zh-CN" ? "当前不在可购买阶段。" : "Purchases are not active right now."); return; }
    if (quotedMini === 0n || quotedCost === 0n) { setError(language === "zh-CN" ? "该 DOT 预算不足以购买 MINI。" : "This DOT budget is too small to purchase MINI."); return; }
    const maxCost = quotedCost + (quotedCost / 2_000n || 1n);
    setBusy(true);
    try {
      if (session.kind === "evm") {
        if (!provider || !session.address || !manifest || !correctChain) throw new Error("WRONG_CHAIN");
        const result = await buyExactMini(publicClient!, walletClient(provider, manifest), manifest, session.address, phase2Contract, quotedMini, maxCost);
        setMessage(language === "zh-CN" ? `已获得 ${mini(result.miniAmount)}。` : `Received ${mini(result.miniAmount)}.`);
      } else {
        if (!session.api || !manifest) throw new Error("CONFIGURATION_MISMATCH");
        const selected = session.accounts.find((item) => item.address === session.selectedAccountAddress);
        if (!selected) throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED");
        const result = await buyExactMiniNative(session.api, selected.signer, session.selectedAccountAddress, manifest, phase2Contract, quotedMini, maxCost);
        setMessage(language === "zh-CN" ? `已获得 ${mini(result.miniAmount)}。` : `Received ${mini(result.miniAmount)}.`);
      }
      onRefresh();
      void refresh();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : String(reason);
      setError(code === "WRONG_CHAIN" ? (language === "zh-CN" ? "请先切换到 Polkadot Hub 网络。" : "Switch to Polkadot Hub before purchasing.") : code);
    } finally { setBusy(false); }
  };

  const explorerAddress = manifest?.source.explorerUrl && manifest.source.contract ? `${manifest.source.explorerUrl.replace(/\/$/, "")}/address/${manifest.source.contract}` : null;
  const curveProgress = parameters.allocation ? Number(sold * 10_000n / parameters.allocation) / 100 : 0;
  return <main className="genesis-stages">
    <section className="stage-tabs" aria-label={language === "zh-CN" ? "Genesis 阶段" : "Genesis stages"}>
      {(["phase1", "phase2", "phase3"] as const).map((item) => <button key={item} className={`stage-tab ${stage === item ? "active" : ""}`} type="button" onClick={() => setStage(item)} aria-pressed={stage === item}><span>{stageLabel(item, language)}</span><small>{item === "phase1" ? "COMPLETED" : item === "phase2" ? phase2TabStatus(dynamic, phase2Contract, demoMode) : "LOCKED"}</small></button>)}
    </section>

    {stage === "phase1" && <section className="stage-panel phase1-panel"><div className="stage-eyebrow">Genesis I · COMPLETED</div><h1>Genesis I</h1><p className="stage-lead">Genesis I participants took the earliest project risk. Their support helped fund the first execution cycle and the work that followed.</p><div className="stage-stats"><div><span>Total DOT raised</span><strong>{dot(phase1.raised)}</strong></div><div><span>Participants</span><strong>{phase1.participants?.toLocaleString() ?? "—"} addresses</strong></div><div><span>MINI allocation</span><strong>{mini(phase1.allocation)}</strong></div><div><span>Genesis I final reference price</span><strong>{formatDot(FINAL_REFERENCE_PRICE, 18, 8)} DOT/MINI</strong></div><div><span>Start / end blocks</span><strong>{phase1Dynamic ? `#${phase1Dynamic.startBlock.toString()} → #${phase1Dynamic.emissionEndBlock.toString()}` : "—"}</strong></div></div><section className="achievement-section"><div className="stage-eyebrow">What Genesis I Enabled</div><h2>Capital → Execution</h2><div className="achievement-grid">{achievements.map((achievement) => <article key={achievement.id} className={`achievement achievement-${achievement.status}`}><div><strong>{achievement.name}</strong><span>{achievement.status}</span></div><p>{achievement.summary}</p></article>)}</div></section><div className="historical-note">ZkJAM was investigated and later discontinued after feasibility work. Stopping a bad direction is part of the R&amp;D record.</div>{explorerAddress && <a className="contract-link" href={explorerAddress} target="_blank" rel="noreferrer">View the immutable Phase I contract ↗</a>}</section>}

    {stage === "phase2" && <section className="stage-panel phase2-panel"><div className="stage-eyebrow">Genesis II · {phase2Summary}</div><h1>Genesis II</h1><p className="stage-lead">Genesis I funded the earliest stage of MiniJAM. Genesis II opens a limited tranche from the Early Operations Reserve for the next execution cycle.</p><div className="reserve-banner"><strong>{mini(parameters.allocation)} from Early Operations Reserve</strong><span>{parameters.allocation === productionCurve.allocation ? "No additional supply is created. This is 20% of the 10,000,000 MINI reserve and 0.2% of total MINI supply." : "Staging deployment uses a test allocation; no additional supply is created."}</span></div><div className="curve-head"><div><span>Starting price</span><strong>{formatDot(parameters.startPrice, 18, 6)} DOT/MINI</strong></div><div className="curve-arrow">→</div><div><span>Maximum price</span><strong>{formatDot(parameters.endPrice, 18, 6)} DOT/MINI</strong></div></div><div className="curve-chart" aria-label="Genesis II linear bonding curve"><svg viewBox="0 0 600 210" role="img"><path d="M40 174H570M40 174V22M40 174L570 38" /><line x1="40" y1="174" x2={40 + 530 * Math.min(1, Math.max(0, Number(sold * 1000n / parameters.allocation) / 1000))} y2={174 - 136 * Math.min(1, Math.max(0, Number(sold * 1000n / parameters.allocation) / 1000))} className="curve-position" /><circle cx={40 + 530 * Math.min(1, Math.max(0, Number(sold * 1000n / parameters.allocation) / 1000))} cy={174 - 136 * Math.min(1, Math.max(0, Number(sold * 1000n / parameters.allocation) / 1000))} r="7" className="curve-dot" /></svg><div className="curve-axis"><span>{formatDot(parameters.startPrice, 18, 6)}</span><span>Current position · {curveProgress.toFixed(2)}%</span><span>{formatDot(parameters.endPrice, 18, 6)} DOT/MINI</span></div></div><div className="stage-stats phase2-stats"><div><span>Current price</span><strong>{formatDot(dynamic?.spotPrice ?? parameters.startPrice, 18, 6)} DOT/MINI</strong></div><div><span>Raised</span><strong>{dot(dynamic?.totalRaisedDot ?? 0n)}</strong></div><div><span>MINI distributed</span><strong>{mini(sold)} / {mini(parameters.allocation)}</strong></div><div><span>Participants</span><strong>{dynamic?.buyerCount.toLocaleString() ?? "—"} addresses</strong></div><div><span>Time remaining</span><strong>{dynamic ? countdown(phase2Time) : "—"}</strong></div></div><div className="curve-purchase"><div className="purchase-title"><span>Get MINI</span><span>DOT budget</span></div><div className="budget-presets">{["1", "5", "20"].map((value) => <button key={value} type="button" className={budget === value ? "selected" : ""} onClick={() => setBudget(value)}>{value} DOT</button>)}<input aria-label="Custom DOT budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Custom" /></div><div className="purchase-preview"><div><span>You receive</span><strong>{mini(quotedMini)}</strong></div><div><span>Estimated cost</span><strong>{dot(quotedCost)}</strong></div><div><span>Current price</span><strong>{formatDot(dynamic?.spotPrice ?? parameters.startPrice, 18, 6)}</strong></div><div><span>Price after purchase</span><strong>{formatDot(priceAfter, 18, 6)}</strong></div></div><button className="submit-button" type="button" disabled={busy || (Boolean(dynamic) && dynamic?.phase !== 1)} onClick={() => void submit()}>{busy ? (language === "zh-CN" ? "处理中…" : "Processing…") : session && walletReady ? "Get MINI" : (language === "zh-CN" ? "连接钱包" : "Connect wallet")}</button>{message && <p className="purchase-message success">{message}</p>}{error && <p className="purchase-message error">{error}</p>}<p className="slippage-note">A small deterministic slippage limit is used to protect your quote. The curve does not guarantee secondary-market price, liquidity, or future valuation.</p></div><section className="funds-section"><div className="stage-eyebrow">What Genesis II Funds</div><h2>The next execution cycle</h2><p>MiniJAM Stage-1 infrastructure, MiniCells experiments, JamScript development, JAM Asset Center, Ownership Abstraction, research, and infrastructure.</p></section><p className="risk-note">MINI is an experimental crypto asset. Genesis II participation carries substantial risk. Participant count represents addresses, not verified unique persons.</p></section>}

    {stage === "phase3" && <section className="stage-panel phase3-panel"><div className="stage-eyebrow">Genesis III · LOCKED</div><h1>Genesis III</h1><p className="stage-lead">The final Genesis phase. Parameters will be determined after Genesis II and the next execution cycle.</p><div className="locked-card"><span>LOCKED</span><p>No supply, date, price, allocation, or valuation has been determined for Genesis III.</p><small>The only standing policy rule is that Genesis III cannot start below Genesis II’s actual terminal price.</small></div></section>}
  </main>;
}

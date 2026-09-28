import { useEffect, useMemo, useState } from "react";
import { formatUnits, type PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { buyExactMini } from "./curve-contribution";
import { buyExactMiniNative } from "./curve-contribution-native";
import { curvePriceAt, curveQuote, maxMiniForBudget, parseDotBudget, productionCurve, type CurveParameters } from "./curve";
import { getPhase2Contract, type GenesisCurveDynamic } from "./curve-reads";
import { walletClient } from "../wallet/wallet-client";
import type { Eip1193Provider } from "../wallet/eip1193";
import type { WalletSession } from "../wallet/types";
import { GenesisWorkItems } from "./GenesisWorkItems";
import { genesisPhase2WorkItems } from "./work-items";
import { BasisInfo } from "./BasisInfo";
import { BondingCurveChart } from "./BondingCurveChart";
import { GenesisRules } from "./GenesisRules";
import { normalizePurchaseError, purchaseErrorDiagnostics } from "./purchase-error";

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

const NATIVE_TO_EVM_RATIO = 100_000_000n;

function grouped(value: bigint): string { return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

function formatMini(value: bigint | null): string {
  if (value === null) return "—";
  const scale = 100n;
  const rounded = (value * scale + 10n ** 18n / 2n) / 10n ** 18n;
  return `${grouped(rounded / scale)}.${(rounded % scale).toString().padStart(2, "0")}`;
}

function formatBasis(value: bigint): string {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 6);
  return `${grouped(whole)}.${fraction}`;
}

function countdown(seconds: bigint, zh: boolean): string {
  if (seconds <= 0n) return zh ? "0 分钟" : "0m";
  const days = seconds / 86_400n;
  const hours = seconds % 86_400n / 3_600n;
  const minutes = seconds % 3_600n / 60n;
  return zh ? `${days ? `${days} 天 ` : ""}${hours} 小时` : days ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
}

function errorText(code: string, zh: boolean): string {
  const messages: Record<string, [string, string]> = {
    WRONG_CHAIN: ["请先切换到当前 Genesis 网络。", "Switch to the selected Genesis network first."],
    USER_REJECTED_TRANSACTION: ["你已取消钱包签名。", "The wallet signature was declined."],
    INSUFFICIENT_BALANCE: ["余额不足以支付该预算和网络费用。", "Your balance cannot cover this budget and network fees."],
    TRANSACTION_REVERTED: ["合约拒绝了本次购买，请刷新报价后重试。", "The contract rejected this purchase. Refresh the quote and try again."],
    RPC_UNAVAILABLE: ["网络暂时无法连接，请稍后重试。", "The network is temporarily unavailable. Try again shortly."],
    UNKNOWN_ERROR: ["暂时无法完成购买，请重试。", "The purchase could not be completed. Please try again."],
    CONFIGURATION_MISMATCH: ["当前环境配置不匹配。", "The selected environment configuration does not match."],
  };
  const localized = messages[code];
  return localized ? localized[zh ? 0 : 1] : code;
}

export function GenesisPhase2({ language, manifest, publicClient, session, provider, walletReady, correctChain, dynamic, demoMode, onConnect, onRefresh }: Props) {
  const [clock, setClock] = useState(() => Math.floor(Date.now() / 1000));
  const [budget, setBudget] = useState("1.00");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const zh = language === "zh-CN";
  const contract = manifest ? getPhase2Contract(manifest) : null;
  const parameters: CurveParameters = useMemo(() => ({
    allocation: dynamic?.allocation ?? productionCurve.allocation,
    startPrice: dynamic?.startPrice ?? productionCurve.startPrice,
    endPrice: dynamic?.endPrice ?? productionCurve.endPrice,
  }), [dynamic]);
  const sold = dynamic?.totalSoldMini ?? 0n;
  const currentBasis = dynamic?.spotPrice ?? curvePriceAt(parameters, sold > parameters.allocation ? parameters.allocation : sold);
  const budgetWei = useMemo(() => {
    try {
      const parsed = parseDotBudget(budget);
      // Native Revive value is denominated in planck; round down so the signed
      // value can never exceed the amount the user entered.
      return session?.kind === "polkadot" ? parsed / NATIVE_TO_EVM_RATIO * NATIVE_TO_EVM_RATIO : parsed;
    } catch { return 0n; }
  }, [budget, session?.kind]);
  const affordableMini = maxMiniForBudget(parameters, sold, budgetWei);
  const quoteCost = affordableMini > 0n ? curveQuote(parameters, sold, affordableMini) : 0n;
  const phase2Status = dynamic?.phaseName ?? (manifest?.genesis?.phases.phase2?.status === "active" || demoMode ? "Active" : "Waiting");
  const ended = phase2Status === "Ended" || manifest?.genesis?.phases.phase2?.status === "ended";
  const waiting = phase2Status === "Waiting";
  const remaining = dynamic ? (waiting ? dynamic.startTime - BigInt(clock) : phase2Status === "Active" ? dynamic.endTime - BigInt(clock) : 0n) : 0n;
  const purchaseEnabled = Boolean(dynamic?.phase === 1 && contract && !ended);
  const configuredWorkItems = manifest?.genesis?.phases.phase2?.workItems ?? [];
  const workItems = useMemo(() => genesisPhase2WorkItems.map((item) => {
    const configured = configuredWorkItems.find((candidate) => candidate.id === item.id);
    return configured ? { ...item, status: configured.status, tasks: configured.tasks } : item;
  }), [configuredWorkItems]);
  const nativeSymbol = "DOT";
  const balanceLabel = (() => {
    if (!session || session.balance === null) return "—";
    const decimals = session.kind === "polkadot" ? manifest?.source.nativeDecimals ?? 10 : manifest?.evmNativeDecimals ?? 18;
    return Number(formatUnits(session.balance, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  })();

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!session || !walletReady) { onConnect(); return; }
    if (!manifest || !contract) { setError(errorText("CONFIGURATION_MISMATCH", zh)); return; }
    if (!dynamic || dynamic.phase !== 1) { setError(zh ? "当前阶段暂不接受购买。" : "Purchases are not active right now."); return; }
    if (affordableMini === 0n || quoteCost === 0n || budgetWei === 0n) { setError(zh ? "该预算不足以购买 MINI。" : "This budget is too small to acquire MINI."); return; }
    if (session.kind === "evm" && !correctChain) { setError(errorText("WRONG_CHAIN", zh)); return; }
    if (session.balance !== null) {
      const balanceInEvmUnits = session.kind === "polkadot" ? session.balance * NATIVE_TO_EVM_RATIO : session.balance;
      if (balanceInEvmUnits < budgetWei) { setError(errorText("INSUFFICIENT_BALANCE", zh)); return; }
    }

    setBusy(true);
    try {
      if (session.kind === "evm") {
        if (!provider || !publicClient) throw new Error("WRONG_CHAIN");
        // The user's displayed budget is both maxDotCost and msg.value.
        await buyExactMini(publicClient, walletClient(provider, manifest), manifest, session.address, contract, affordableMini, budgetWei);
      } else {
        if (!session.api) throw new Error("CONFIGURATION_MISMATCH");
        const selected = session.accounts.find((item) => item.address === session.selectedAccountAddress);
        if (!selected) throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED");
        await buyExactMiniNative(session.api, selected.signer, session.selectedAccountAddress, manifest, contract, affordableMini, budgetWei);
      }
      setBudget("");
      setMessage(zh ? `已获得约 ${formatMini(affordableMini)} MINI。` : `Received approximately ${formatMini(affordableMini)} MINI.`);
      onRefresh();
    } catch (reason) {
      if (import.meta.env.DEV || manifest.environment === "local") console.error("Genesis II purchase diagnostic", purchaseErrorDiagnostics(reason));
      const code = normalizePurchaseError(reason);
      setError(errorText(code, zh));
    } finally {
      setBusy(false);
    }
  };

  const timeLabel = waiting ? (zh ? "距开始" : "Starts in") : (zh ? "剩余" : "Remaining");

  return <section className="stage-panel phase2-panel" data-testid="genesis-phase2">
    <h1 className="sr-only">Genesis II</h1>
    <header className="phase2-heading">
      <div className="phase2-price-block">
        <span>{zh ? "当前购入基准" : "Current acquisition basis"} <BasisInfo kind="current" language={language} /></span>
        <strong data-testid="phase2-current-basis">{formatBasis(currentBasis)} <small>DOT / MINI</small></strong>
      </div>
      <div className="phase2-facts" aria-label={zh ? "Genesis II 状态" : "Genesis II status"}>
        {/* UI Holders currently maps to buyerCount. Transferability can make these differ later. */}
        <div><strong data-testid="phase2-holder-count">{dynamic?.buyerCount.toLocaleString() ?? "—"}</strong><span>{zh ? "参与者" : "Holders"}</span></div>
        <div><strong data-testid="phase2-time-remaining">{dynamic ? countdown(remaining, zh) : "—"}</strong><span>{timeLabel}</span></div>
      </div>
    </header>

    {ended && <p className="campaign-closed" role="status">{zh ? "购买已关闭" : "Purchases are closed"}</p>}

    <div className="phase2-trade-layout">
      <BondingCurveChart allocation={parameters.allocation} sold={sold} startBasis={parameters.startPrice} endBasis={parameters.endPrice} currentBasis={currentBasis} language={language} />
      {ended ? <section className="curve-purchase purchase-panel purchase-closed"><h2>{zh ? "获得 MINI" : "Get MINI"}</h2><p>{zh ? "当前阶段已结束。" : "This stage has ended."}</p></section> : <section className="curve-purchase purchase-panel" aria-label={zh ? "获得 MINI" : "Get MINI"}>
        <h2>{zh ? "获得 MINI" : "Get MINI"}</h2>
        <label className="budget-label" htmlFor="phase2-dot-budget">{zh ? "支付" : "Pay"}</label>
        <div className="budget-input-wrap">
          <input id="phase2-dot-budget" aria-label={zh ? "支付 DOT 数量" : "DOT budget"} inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="0.00" />
          <span>{nativeSymbol}</span>
        </div>
        <p className="purchase-balance" data-testid="phase2-wallet-balance">{zh ? "余额" : "Balance"} {balanceLabel} {nativeSymbol}</p>
        <div className="budget-presets" aria-label={zh ? "快捷金额" : "Quick amounts"}>
          {["1", "5", "20"].map((value) => <button key={value} type="button" className={budget === value || budget === `${value}.00` ? "selected" : ""} onClick={() => setBudget(value)}>{value} {nativeSymbol}</button>)}
        </div>
        <div className="purchase-receive">
          <span>{zh ? "你将获得" : "You receive"}</span>
          <strong data-testid="phase2-mini-quote">≈ {formatMini(affordableMini)} MINI</strong>
        </div>
        <button className="submit-button" type="button" disabled={busy || !purchaseEnabled || affordableMini === 0n} onClick={() => void submit()}>
          {busy ? (zh ? "处理中…" : "Processing…") : session && walletReady ? (zh ? "获得 MINI" : "Get MINI") : (zh ? "连接钱包" : "Connect wallet")}
        </button>
        {message && <p className="purchase-message success" role="status">{message}</p>}
        {error && <p className="purchase-message error" role="alert">{error}</p>}
      </section>}
    </div>

    <GenesisRules language={language} />
    <GenesisWorkItems language={language} mode="phase2-funds" workItems={workItems} />
  </section>;
}

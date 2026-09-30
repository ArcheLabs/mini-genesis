import { useEffect, useMemo, useState } from "react";
import { formatUnits, type PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { buyExactMini, waitForTransactionFinality } from "./curve-contribution";
import { buyExactMiniNative } from "./curve-contribution-native";
import { curvePriceAt, curveQuote, maxMiniForBudget, parseDotBudget, productionCurve, type CurveParameters } from "./curve";
import { getPhase2Contract, type GenesisCurveDynamic } from "./curve-reads";
import { walletClient } from "../wallet/wallet-client";
import type { Eip1193Provider } from "../wallet/eip1193";
import type { WalletSession } from "../wallet/types";
import { GenesisWorkItems } from "./GenesisWorkItems";
import { genesisPhase2WorkItems, mergeGenesisWorkItems } from "./work-items";
import { BasisInfo } from "./BasisInfo";
import { BondingCurveChart } from "./BondingCurveChart";
import { GenesisRules } from "./GenesisRules";
import { normalizePurchaseError, purchaseErrorDiagnostics, shouldLogPurchaseDiagnostics } from "./purchase-error";
import { SectionHeading } from "../components/SectionHeading";
import { MiniIcon } from "../components/SectionIcons";
import { formatTokenAmount } from "../assets/format";

type Language = "zh-CN" | "en";
type Props = {
  language: Language;
  manifest: DeploymentManifest | null;
  publicClient: PublicClient | null;
  session: WalletSession;
  provider: Eip1193Provider | null;
  correctChain: boolean;
  dynamic: GenesisCurveDynamic | null;
  demoMode: boolean;
  onConnect: () => void;
  onReconcile: () => Promise<void>;
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

type PurchaseWalletState = "disconnected" | "preparing" | "ready" | "unavailable";

function purchaseWalletState(session: WalletSession): PurchaseWalletState {
  if (!session) return "disconnected";
  if (session.kind === "evm") return session.provider ? "ready" : "preparing";

  if (session.nativeRuntimeStatus === "unsupported" || session.nativeRuntimeStatus === "error"
    || session.nativeWalletStatus === "unsupported" || session.nativeWalletStatus === "error"
    || session.balanceStatus === "error") return "unavailable";
  if (!session.api || !session.accounts.some((account) => account.address === session.selectedAccountAddress)
    || (session.balanceStatus !== "ready" && session.balanceStatus !== "refreshing")
    || session.nativeRuntimeStatus !== "supported" || session.nativeWalletStatus !== "supported") return "preparing";
  return "ready";
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
    NATIVE_NETWORK_MISMATCH: ["当前网络与支持的原生交易网络不匹配。", "The current network does not match the supported native transaction network."],
    NATIVE_RUNTIME_PROFILE_MISMATCH: ["当前网络 Runtime 暂不支持原生交易。", "Native transactions are temporarily unavailable for the current network runtime."],
    NATIVE_RUNTIME_PROFILE_INCOMPLETE: ["无法验证当前网络 Runtime，已暂时禁用原生交易。", "The current runtime could not be verified; native transactions are disabled."],
    NATIVE_WALLET_RUNTIME_UNSUPPORTED: ["当前钱包暂不支持此版本 Polkadot Hub TestNet 的原生交易。", "This wallet does not support native transactions for the current Polkadot Hub TestNet runtime."],
    NATIVE_SIGNING_REJECTED: ["你已取消钱包签名。", "The wallet signature was declined."],
    NATIVE_EVENT_RECONCILIATION_FAILED: ["交易已最终确认，但购买事件核验未完成。请勿重复购买；请先检查历史记录。", "The transaction finalized, but purchase-event verification is incomplete. Do not resubmit; check history first."],
    NATIVE_TRANSACTION_BUILD_FAILED: ["当前钱包无法安全构造此原生交易。", "The current wallet could not safely construct this native transaction."],
    NATIVE_SUBMISSION_FAILED: ["原生交易未能完成提交。", "The native transaction could not be submitted."],
    NATIVE_CONTRACT_REVERTED: ["合约拒绝了本次购买，请刷新报价后重试。", "The contract rejected this purchase. Refresh the quote and try again."],
  };
  const localized = messages[code];
  return localized ? localized[zh ? 0 : 1] : code;
}

export function GenesisPhase2({ language, manifest, publicClient, session, provider, correctChain, dynamic, demoMode, onConnect, onReconcile }: Props) {
  const [clock, setClock] = useState(() => Math.floor(Date.now() / 1000));
  const [budget, setBudget] = useState("1.00");
  const [busy, setBusy] = useState(false);
  const [nativeVerificationPendingFor, setNativeVerificationPendingFor] = useState<string | null>(null);
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
  const remainingMini = dynamic ? (dynamic.allocation > dynamic.totalSoldMini ? dynamic.allocation - dynamic.totalSoldMini : 0n) : null;
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
  const workItems = useMemo(() => mergeGenesisWorkItems(genesisPhase2WorkItems, configuredWorkItems), [configuredWorkItems]);
  const nativeSymbol = manifest?.source.currencySymbol ?? "DOT";
  const balanceLabel = (() => {
    if (!session || session.balance === null) return "—";
    const decimals = session.kind === "polkadot" ? manifest?.source.nativeDecimals ?? 10 : manifest?.evmNativeDecimals ?? 18;
    return Number(formatUnits(session.balance, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  })();
  const walletState = purchaseWalletState(session);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!session) { onConnect(); return; }
    if (walletState !== "ready") {
      setError(walletState === "preparing"
        ? (zh ? "钱包仍在准备中，请稍后重试。" : "The wallet is still preparing. Please try again shortly.")
        : (zh ? "钱包暂不可用于购买，请检查上方提示后重试。" : "The wallet is currently unavailable for purchases. Check the message above and try again."));
      return;
    }
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
      let finalized = true;
      let evmBlockNumber: bigint | null = null;
      if (session.kind === "evm") {
        if (!provider || !publicClient) throw new Error("WRONG_CHAIN");
        // The user's displayed budget is both maxDotCost and msg.value.
        const result = await buyExactMini(publicClient, walletClient(provider, manifest), manifest, session.address, contract, affordableMini, budgetWei);
        finalized = result.finalized;
        evmBlockNumber = result.blockNumber;
      } else {
        if (!session.api) throw new Error("CONFIGURATION_MISMATCH");
        if (!publicClient) throw new Error("RPC_UNAVAILABLE");
        const selected = session.accounts.find((item) => item.address === session.selectedAccountAddress);
        if (!selected) throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED");
        await buyExactMiniNative(session.api, publicClient, selected.txCreator, session.selectedAccountAddress, manifest, contract, affordableMini, budgetWei, (update) => {
          if (update.state === "finalized" || update.state === "verifying_event") setNativeVerificationPendingFor(session.selectedAccountAddress);
          if (update.state === "success") setNativeVerificationPendingFor(null);
        }, { wallet: session.walletName || session.extensionId });
      }
      await onReconcile();
      setBudget("");
      const received = zh ? `已获得约 ${formatMini(affordableMini)} MINI。` : `Received approximately ${formatMini(affordableMini)} MINI.`;
      setMessage(finalized ? received : (zh ? `交易已打包，正在等待最终确认；余额与曲线已刷新。${formatMini(affordableMini)} MINI` : `Transaction included; waiting for finality. Balances and curve were refreshed. ${formatMini(affordableMini)} MINI`));
      if (!finalized && publicClient && evmBlockNumber !== null) {
        void waitForTransactionFinality(publicClient, evmBlockNumber, 300_000).then(async (confirmed) => {
          if (!confirmed) return;
          await onReconcile();
          setMessage(received);
        });
      }
    } catch (reason) {
      if (shouldLogPurchaseDiagnostics(manifest.environment, import.meta.env.DEV)) {
        console.error("Genesis II purchase diagnostic", purchaseErrorDiagnostics(reason, {
          wallet: session?.kind === "polkadot" ? session.walletName : session?.kind === "evm" ? "EVM wallet" : "disconnected",
        }));
      }
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
        <span>{zh ? "当前购入基准" : "Current acquisition basis"} <BasisInfo kind="current" language={language} nativeSymbol={nativeSymbol} /></span>
        <strong data-testid="phase2-current-basis">{formatBasis(currentBasis)} <small>{nativeSymbol} / MINI</small></strong>
      </div>
    </header>

    {ended && <p className="campaign-closed" role="status">{zh ? "购买已关闭" : "Purchases are closed"}</p>}

    <div className="phase2-trade-layout">
      <div className="phase2-market-column">
        <BondingCurveChart allocation={parameters.allocation} sold={sold} startBasis={parameters.startPrice} endBasis={parameters.endPrice} currentBasis={currentBasis} language={language} nativeSymbol={nativeSymbol} />
        <div className="phase2-facts" aria-label={zh ? "Genesis II 状态" : "Genesis II status"}>
          <div><strong data-testid="phase2-holder-count">{dynamic?.buyerCount.toLocaleString() ?? "—"}</strong><span>{zh ? "参与者" : "Holders"}</span></div>
          <div><strong data-testid="phase2-remaining-mini">{remainingMini === null ? "—" : `${formatTokenAmount(remainingMini)} MINI`}</strong><span>{zh ? "剩余 MINI" : "MINI remaining"}</span></div>
          <div><strong data-testid="phase2-time-remaining">{dynamic ? countdown(remaining, zh) : "—"}</strong><span>{timeLabel}</span></div>
        </div>
      </div>
      {ended ? <section className="curve-purchase purchase-panel purchase-closed"><SectionHeading size="compact" icon={<MiniIcon />}>{zh ? "获得 MINI" : "Get MINI"}</SectionHeading><p>{zh ? "当前阶段已结束。" : "This stage has ended."}</p></section> : <section className="curve-purchase purchase-panel" aria-label={zh ? "获得 MINI" : "Get MINI"}>
        <SectionHeading size="compact" icon={<MiniIcon />}>{zh ? "获得 MINI" : "Get MINI"}</SectionHeading>
        <label className="budget-label" htmlFor="phase2-native-budget">{zh ? "支付" : "Pay"}</label>
        <div className="budget-input-wrap">
          <input id="phase2-native-budget" aria-label={zh ? `支付 ${nativeSymbol} 数量` : `${nativeSymbol} budget`} inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="0.00" />
          <span>{nativeSymbol}</span>
        </div>
        <p className="purchase-balance" data-testid="phase2-wallet-balance">{zh ? "余额" : "Balance"} {balanceLabel} {nativeSymbol}</p>
        {session?.kind === "polkadot" && session.balanceStatus === "error" && <p className="purchase-message error" role="status">{zh ? "暂时无法读取钱包余额，请稍后刷新或重新连接钱包。" : "Wallet balance could not be loaded. Refresh or reconnect the wallet and try again."}</p>}
        {session?.kind === "polkadot" && (session.nativeRuntimeStatus === "unsupported" || session.nativeRuntimeStatus === "error") && <p className="purchase-message error" role="status">{zh ? "当前网络 Runtime 暂不支持原生交易。" : "Native transactions are temporarily unavailable for the current network runtime."}</p>}
        {session?.kind === "polkadot" && session.nativeWalletStatus === "unsupported" && <p className="purchase-message error" role="status">{zh ? "当前钱包暂不支持此版本 Polkadot Hub TestNet 的原生交易。" : "This wallet does not support native transactions for the current Polkadot Hub TestNet runtime."}</p>}
        {session?.kind === "polkadot" && session.nativeWalletStatus === "error" && <p className="purchase-message error" role="status">{zh ? "无法验证当前钱包对 Runtime 的支持，已禁用原生签名。" : "Wallet support for this runtime could not be verified; native signing is disabled."}</p>}
        {session?.kind === "polkadot" && nativeVerificationPendingFor === session.selectedAccountAddress && <p className="purchase-message error" role="status">{zh ? "交易已最终确认，但购买事件核验未完成。请勿重复购买；请先检查历史记录。" : "The transaction finalized, but purchase-event verification is incomplete. Do not resubmit; check history first."}</p>}
        <div className="budget-presets" aria-label={zh ? "快捷金额" : "Quick amounts"}>
          {["1", "5", "20"].map((value) => <button key={value} type="button" className={budget === value || budget === `${value}.00` ? "selected" : ""} onClick={() => setBudget(value)}>{value} {nativeSymbol}</button>)}
        </div>
        <div className="purchase-receive">
          <span>{zh ? "你将获得" : "You receive"}</span>
          <strong data-testid="phase2-mini-quote">≈ {formatMini(affordableMini)} MINI</strong>
        </div>
        <button className="submit-button" type="button" disabled={busy || (session?.kind === "polkadot" && nativeVerificationPendingFor === session.selectedAccountAddress) || !purchaseEnabled || affordableMini === 0n || (walletState !== "disconnected" && walletState !== "ready")} onClick={() => void submit()}>
          {busy ? (zh ? "处理中…" : "Processing…") : walletState === "disconnected" ? (zh ? "连接钱包" : "Connect wallet") : walletState === "ready" ? (zh ? "获得 MINI" : "Get MINI") : walletState === "preparing" ? (zh ? "正在准备钱包…" : "Preparing wallet…") : (zh ? "钱包暂不可用" : "Wallet unavailable")}
        </button>
        {message && <p className="purchase-message success" role="status">{message}</p>}
        {error && <p className="purchase-message error" role="alert">{error}</p>}
      </section>}
    </div>

    <GenesisRules language={language} />
    <GenesisWorkItems language={language} mode="phase2-funds" workItems={workItems} />
  </section>;
}

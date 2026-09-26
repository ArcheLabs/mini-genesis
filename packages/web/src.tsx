import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPublicClient, type PublicClient } from "viem";
import { genesisChain, publicTransport } from "./src/config/chain";
import { getManifest, type DeploymentManifest } from "./src/config/manifest";
import { currentRuntimeSelection } from "./src/config/runtime-selection";
import { nativeNetworkOverride, resolveNativeManifest } from "./src/config/native-network";
import { walletClient } from "./src/wallet/wallet-client";
import { GenesisWalletProvider } from "./src/wallet/AppKitProvider";
import { useGenesisWallet } from "./src/wallet/use-genesis-wallet";
import { DEMO_ACCOUNT } from "./src/demo/data";
import { NotificationCenter } from "./src/feedback/NotificationCenter";
import { SystemBanner } from "./src/feedback/SystemBanner";
import { useFeedback } from "./src/feedback/use-feedback";
import type { FeedbackContext, NormalizedFeedback } from "./src/feedback/types";
import { NativeSignerSmoke } from "./src/dev/native-signer-smoke";
import { GenesisStages } from "./src/genesis/GenesisStages";
import { GenesisStageNavigation } from "./src/genesis/GenesisStageNavigation";
import { canonicalizeHash, routeFromHash, hashForRoute, type AppRoute } from "./src/navigation/routing";
import { readCurveUser } from "./src/genesis/curve-reads";
import { GENESIS1_HOLDER_SNAPSHOT_INPUT_REQUIRED, lookupGenesis1Holding } from "./src/genesis/genesis1-holder-snapshot";
import { MyMini } from "./src/assets/MyMini";
import { syncWrongChainFeedback } from "./src/wallet/wrong-chain-feedback";
import type { GenesisStageId } from "./src/navigation/routing";
import "./style.css";
import "./src/interaction-overrides.css";

type Language = "zh-CN" | "en";
type Theme = "light" | "dark";
const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
const NATIVE_SMOKE_ENABLED = import.meta.env.MODE === "development" || import.meta.env.VITE_DEPLOYMENT_ENV === "staging";

const copy = {
  "zh-CN": {
    connect: "连接钱包", disconnect: "断开连接", myAssets: "我的资产", mine: "我的资产", vmini: "MINI 生态资产", assetsEmpty: "连接钱包后查看资产。", language: "语言", unavailableNote: "此模块将在后续协议阶段启用。", account: "切换账户",
    evmWallet: "EVM", polkadotWallet: "Polkadot", switchAccount: "切换账户", back: "返回",
  },
  en: {
    connect: "Connect", disconnect: "Disconnect", myAssets: "My assets", mine: "My Assets", vmini: "MINI ecosystem asset", assetsEmpty: "Connect your wallet to view your assets.", language: "Language", unavailableNote: "This module will be enabled in a later protocol phase.", account: "Switch account",
    evmWallet: "EVM", polkadotWallet: "Polkadot", switchAccount: "Switch account", back: "Back",
  },
} as const;

function shortHash(value: string): string { return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value; }
function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("mini-genesis-language") as Language) || "en");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("mini-genesis-theme") as Theme) || "light");
  const text = copy[language];
  const feedback = useFeedback();
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash(window.location.hash, NATIVE_SMOKE_ENABLED));
  const [phase2HeaderStatus, setPhase2HeaderStatus] = useState("LIVE");
  const [runtimeSelection] = useState(() => currentRuntimeSelection(import.meta.env.MODE, import.meta.env.VITE_DEPLOYMENT_ENV));
  const [manifest] = useState<DeploymentManifest | null>(() => getManifest(runtimeSelection.environment));
  const nativeManifest = useMemo(() => manifest ? resolveNativeManifest(manifest, import.meta.env.MODE) : null, [manifest]);
  const nativeMainnetOverride = Boolean(manifest && nativeNetworkOverride(manifest.environment, import.meta.env.MODE) === "polkadot-mainnet");
  const publicClient = useMemo<PublicClient | null>(() => demoMode || !manifest || manifest.status !== "deployed" ? null : createPublicClient({ chain: genesisChain(manifest), transport: publicTransport(manifest) }), [manifest]);
  const { session, walletReady, walletStatus, connectEvm, connectPolkadot, availablePolkadotWallets, openAccount, selectPolkadotAccount, switchToGenesisChain, disconnect, status } = useGenesisWallet(manifest, publicClient, nativeManifest);
  const account = session?.kind === "evm" ? session.address : null;
  const provider = session?.kind === "evm" ? session.provider : null;
  const correctChain = session?.kind === "evm" ? session.correctChain : true;
  const genesisIdentity = session?.kind === "evm" ? session.address : session?.kind === "polkadot" ? session.contractIdentity : null;
  const selectedAccountAddress = session?.kind === "polkadot" ? session.selectedAccountAddress : account;
  const [walletMenu, setWalletMenu] = useState(false);
  const [polkadotWalletMenu, setPolkadotWalletMenu] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [languageMenu, setLanguageMenu] = useState(false);
  const [phase2Mini, setPhase2Mini] = useState<bigint | null>(null);
  const [phase2MiniStatus, setPhase2MiniStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [phase2MiniRefresh, setPhase2MiniRefresh] = useState(0);
  const [phase2RefreshKey, setPhase2RefreshKey] = useState(0);
  const walletWrapRef = useRef<HTMLDivElement | null>(null);
  const languageWrapRef = useRef<HTMLDivElement | null>(null);
  const previousWalletStatus = useRef(status);
  const context = useCallback((operation: FeedbackContext["operation"], params?: FeedbackContext["params"]): FeedbackContext => ({ operation, locale: language, params }), [language]);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("mini-genesis-theme", theme); }, [theme]);
  useEffect(() => { document.documentElement.classList.toggle("native-mainnet-override", nativeMainnetOverride); }, [nativeMainnetOverride]);
  useEffect(() => { localStorage.setItem("mini-genesis-language", language); }, [language]);
  useEffect(() => { if (!demoMode && previousWalletStatus.current === "connecting" && status === "disconnected") feedback.presentCode("WALLET_CONNECTION_REJECTED", context("connect-wallet")); previousWalletStatus.current = status; }, [context, feedback.presentCode, status]);
  useEffect(() => { if (runtimeSelection.error || !manifest) feedback.presentCode("CONFIGURATION_MISMATCH", context("load-global")); else if (!demoMode && manifest.status !== "deployed") feedback.presentCode("TEMPLATE_MANIFEST_NOT_RUNTIME_READY", context("load-global")); }, [context, demoMode, feedback.presentCode, manifest, runtimeSelection.error]);
  const bootSearchRef = useRef(window.location.search);
  useEffect(() => {
    const canonicalizeCurrentHash = () => {
      const normalized = canonicalizeHash(window.location.hash, NATIVE_SMOKE_ENABLED);
      if (window.location.hash !== normalized) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${normalized}`);
      setRoute(routeFromHash(normalized, NATIVE_SMOKE_ENABLED));
    };
    canonicalizeCurrentHash();
    const onHashChange = () => canonicalizeCurrentHash();
    const onPopState = () => { if (window.location.search !== bootSearchRef.current) window.location.reload(); };
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onPopState);
    return () => { window.removeEventListener("hashchange", onHashChange); window.removeEventListener("popstate", onPopState); };
  }, []);

  const refreshPhase2Mini = useCallback(() => setPhase2MiniRefresh((value) => value + 1), []);
  const refreshGenesisII = useCallback(() => setPhase2RefreshKey((value) => value + 1), []);
  useEffect(() => {
    if (route !== "assets" || !session || !publicClient || !manifest) {
      setPhase2Mini(null);
      setPhase2MiniStatus("idle");
      return;
    }
    if (!genesisIdentity) {
      setPhase2Mini(null);
      setPhase2MiniStatus("loading");
      return;
    }
    let cancelled = false;
    setPhase2MiniStatus("loading");
    void readCurveUser(publicClient, manifest, genesisIdentity).then((value) => {
      if (cancelled) return;
      setPhase2Mini(value);
      setPhase2MiniStatus("ready");
      feedback.clearCode("USER_DATA_UNAVAILABLE");
    }).catch((error) => {
      if (cancelled) return;
      setPhase2Mini(null);
      setPhase2MiniStatus("error");
      feedback.presentError(error, context("load-user"));
    });
    return () => { cancelled = true; };
  }, [context, feedback.clearCode, feedback.presentError, genesisIdentity, manifest, phase2MiniRefresh, publicClient, route, session]);
  useEffect(() => { const onPointerDown = (event: PointerEvent) => { if (walletMenu && walletWrapRef.current && !walletWrapRef.current.contains(event.target as Node)) setWalletMenu(false); if (languageMenu && languageWrapRef.current && !languageWrapRef.current.contains(event.target as Node)) setLanguageMenu(false); }; const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setWalletMenu(false); setPolkadotWalletMenu(false); setAccountMenu(false); setLanguageMenu(false); feedback.notifications.filter((item) => !item.persistent).forEach((item) => feedback.dismiss(item.dedupeKey)); } }; document.addEventListener("pointerdown", onPointerDown); document.addEventListener("keydown", onKeyDown); return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); }; }, [feedback.dismiss, feedback.notifications, languageMenu, walletMenu]);
  const navigate = useCallback((nextRoute: AppRoute) => { setWalletMenu(false); const nextHash = hashForRoute(nextRoute); if (window.location.hash !== nextHash) window.location.hash = nextHash; else setRoute(nextRoute); }, []);

  useEffect(() => {
    const clearWrongChain = () => feedback.clearCode("WRONG_CHAIN");
    if (session?.kind === "evm" && !correctChain) {
      syncWrongChainFeedback({ correctChain: false, clear: clearWrongChain, present: () => feedback.presentCode("WRONG_CHAIN", context("switch-network", { networkName: manifest?.source.name })) });
      return;
    }
    syncWrongChainFeedback({ correctChain: true, clear: clearWrongChain, present: () => {} });
    feedback.clearCode("CHAIN_SWITCH_REJECTED");
  }, [context, correctChain, feedback.clearCode, feedback.presentCode, manifest?.source.name, session]);

  const selectedPolkadotAccount = session?.kind === "polkadot" ? session.accounts.find((accountItem) => accountItem.address === session.selectedAccountAddress) ?? null : null;
  const walletLabel = session ? session.kind === "polkadot" ? selectedPolkadotAccount?.name || shortHash(session.selectedAccountAddress) : shortHash(session.address) : walletStatus === "restoring" ? "Loading…" : text.connect;
  const selectedSourceAddress = selectedAccountAddress ?? (demoMode ? DEMO_ACCOUNT : "");
  const handleFeedbackAction = (item: NormalizedFeedback) => { if (item.action === "connect-wallet") setWalletMenu(true); else if (item.action === "switch-network" && manifest) void switchToGenesisChain().then(() => feedback.clearCode("WRONG_CHAIN")).catch((error) => feedback.presentError(error, context("switch-network", { networkName: manifest.source.name }))); else if (item.action === "retry-global-data") { refreshGenesisII(); refreshPhase2Mini(); } else if (item.action === "view-transaction" && item.transactionHash && item.explorerUrl) window.open(`${item.explorerUrl.replace(/\/$/, "")}/tx/${item.transactionHash}`, "_blank", "noopener,noreferrer"); };
  const copySelectedAddress = async () => {
    if (!selectedAccountAddress) return;
    try {
      await navigator.clipboard.writeText(selectedAccountAddress);
      feedback.presentCode("ADDRESS_COPIED", context("copy-address"));
    } catch (error) { feedback.presentError(error, context("copy-address")); }
  };

  const icons = {
    rocket: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 15c-1.5 1.2-2 5-2 5s3.8-.5 5-2" /><path d="M9 15l-2-2c.8-3.2 2.7-6.6 6-8 2.8-1.2 6-1 6-1s.2 3.2-1 6c-1.4 3.3-4.8 5.2-8 6l-1-1Z" /><circle cx="14.5" cy="9.5" r="1.6" /></svg>,
    book: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>,
    globe: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>,
    wallet: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>,
    evm: <svg className="icon wallet-choice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 6 10-6 3-6-3 6-10Z" /><path d="m6 13 6 9 6-9-6 3-6-3Z" /></svg>,
    polkadot: <svg className="icon wallet-choice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.3" /><circle cx="12" cy="4.2" r="1.3" /><circle cx="18.8" cy="8.1" r="1.3" /><circle cx="18.8" cy="15.9" r="1.3" /><circle cx="12" cy="19.8" r="1.3" /><circle cx="5.2" cy="15.9" r="1.3" /><circle cx="5.2" cy="8.1" r="1.3" /></svg>,
    disconnect: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>,
    switchAccount: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h11l-3-3" /><path d="m18 7-3 3" /><path d="M17 17H6l3 3" /><path d="m6 17 3-3" /></svg>,
    copy: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" /></svg>,
    chevron: <svg className="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>,
  };
  const isGenesisRoute = route === "phase1" || route === "phase2" || route === "phase3";
  const activeStage: GenesisStageId = isGenesisRoute ? route : "phase2";
  const header = <header className="site-header"><nav className="nav"><a className="brand" href="#/genesis/ii" onClick={(event) => { event.preventDefault(); navigate("phase2"); }} aria-label="MINI Home"><span className="brand-mark">M</span><span className="brand-word">MINI</span></a>{isGenesisRoute && <GenesisStageNavigation language={language} stage={activeStage} phase2Status={phase2HeaderStatus} onSelect={navigate} />}<div className="nav-actions"><div className="language-wrap" ref={languageWrapRef}><button className="language-button" type="button" aria-label={text.language} aria-haspopup="listbox" aria-expanded={languageMenu} onClick={() => setLanguageMenu((value) => !value)}>{icons.globe}{icons.chevron}</button>{languageMenu && <div className="wallet-menu language-menu open" role="listbox" aria-label={text.language}>{([["zh-CN", "中文"], ["en", "EN"]] as const).map(([value, label]) => <button key={value} type="button" role="option" aria-selected={language === value} className={language === value ? "selected" : ""} onClick={() => { setLanguage(value); setLanguageMenu(false); }}>{icons.globe}{label}{language === value && <span className="check">✓</span>}</button>)}</div>}</div><button className="utility-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Switch appearance"><span className="utility-icon">{theme === "dark" ? "☀" : "☾"}</span></button><div className="wallet-wrap" ref={walletWrapRef}><button className="wallet-button" type="button" disabled={walletStatus === "restoring" || Boolean(runtimeSelection.error) || !manifest} onClick={() => setWalletMenu((value) => !value)}><span className="wallet-dot" hidden={!session} />{!session && icons.wallet}<span className="wallet-label">{walletLabel}</span>{session && icons.chevron}</button>{walletMenu && <div className="wallet-menu open">{!session && !polkadotWalletMenu && <><button type="button" onClick={() => { setWalletMenu(false); connectEvm(); }}>{icons.evm}{text.evmWallet}</button><button type="button" onClick={() => { if (!availablePolkadotWallets.length) { void connectPolkadot().catch((error) => feedback.presentError(error, context("connect-wallet"))); } else if (availablePolkadotWallets.length === 1) { void connectPolkadot(availablePolkadotWallets[0].extensionId).then(() => setWalletMenu(false)).catch((error) => feedback.presentError(error, context("connect-wallet"))); } else setPolkadotWalletMenu(true); }}>{icons.polkadot}{text.polkadotWallet}</button></>}{!session && polkadotWalletMenu && <><button type="button" onClick={() => setPolkadotWalletMenu(false)}>← {text.back}</button>{availablePolkadotWallets.map((wallet) => <button key={wallet.extensionId} type="button" onClick={() => void connectPolkadot(wallet.extensionId).then(() => { setWalletMenu(false); setPolkadotWalletMenu(false); }).catch((error) => feedback.presentError(error, context("connect-wallet")))}>{wallet.displayName}</button>)}</>}{session && !accountMenu && <><button type="button" onClick={() => navigate("assets")}>{icons.wallet}{text.myAssets}</button><button type="button" onClick={() => void copySelectedAddress()}>{icons.copy}{language === "zh-CN" ? "复制地址" : "Copy address"}</button><button type="button" onClick={() => { if (session.kind === "evm") { setWalletMenu(false); openAccount(); } else setAccountMenu(true); }}>{icons.switchAccount}{text.switchAccount}</button><button type="button" className="danger" onClick={disconnect}>{icons.disconnect}{text.disconnect}</button></>}{session?.kind === "polkadot" && accountMenu && <><button type="button" onClick={() => setAccountMenu(false)}>← {text.back}</button>{session.accounts.map((accountItem) => <button key={accountItem.address} type="button" className={accountItem.address === session.selectedAccountAddress ? "selected" : ""} onClick={() => { selectPolkadotAccount(accountItem.address); setWalletMenu(false); setAccountMenu(false); }}><span className="account-menu-name">{accountItem.name || (language === "zh-CN" ? "未命名账户" : "Unnamed account")}</span><span className="account-menu-address">{shortHash(accountItem.address)}</span></button>)}</>}</div>}</div></div></nav></header>;
  const genesis1Holding = genesisIdentity ? lookupGenesis1Holding(genesisIdentity) : null;
  const miniAssetCard = <MyMini language={language} environment={manifest?.environment ?? "production"} genesis1Holding={genesis1Holding} genesis1SnapshotRequired={GENESIS1_HOLDER_SNAPSHOT_INPUT_REQUIRED} genesis2Holding={phase2Mini} genesis2Loading={phase2MiniStatus === "loading" || phase2MiniStatus === "idle"} genesis2Error={phase2MiniStatus === "error"} />;
  const ecosystemAssetCard = <article className="asset-card unavailable-asset" data-testid="ecosystem-assets"><span className="label">{text.vmini}</span><div className="asset-value">—</div><div className="asset-note">{text.unavailableNote}</div><button className="claim-button" type="button" disabled>Claim</button></article>;
  const assetsPage = <main className="assets-page"><div className="assets-heading"><span className="section-index">{text.account}</span><h1>{text.mine}</h1><p className="my-address">{shortHash(selectedSourceAddress)}</p></div>{!session && !demoMode ? <section className="assets-empty"><p>{text.assetsEmpty}</p><button className="submit-button" type="button" onClick={() => setWalletMenu(true)}>{text.connect}</button></section> : <div className="my-grid">{miniAssetCard}{ecosystemAssetCard}</div>}</main>;
  const configurationErrorPage = <main className="configuration-error-page" role="alert"><h1>{language === "zh-CN" ? "页面配置不匹配" : "Configuration mismatch"}</h1><p>{language === "zh-CN" ? "所选环境配置无效。请使用 network=local、network=testnet 或 network=mainnet。" : "The selected environment is invalid. Use network=local, network=testnet, or network=mainnet."}</p></main>;
  const genesisStagesPage = isGenesisRoute ? <GenesisStages language={language} stage={activeStage} refreshKey={phase2RefreshKey} onPhase2StatusChange={setPhase2HeaderStatus} manifest={manifest} publicClient={publicClient} session={session} provider={provider} walletReady={walletReady} correctChain={correctChain} demoMode={demoMode} onConnect={() => setWalletMenu(true)} onRefresh={refreshPhase2Mini} /> : null;
  const smokePage = NATIVE_SMOKE_ENABLED ? <NativeSignerSmoke manifest={manifest} session={session} availablePolkadotWallets={availablePolkadotWallets} connectPolkadot={connectPolkadot} /> : null;
  return <><NotificationCenter items={feedback.notifications} onDismiss={feedback.dismiss} onAction={handleFeedbackAction} /><SystemBanner items={feedback.banners} onAction={handleFeedbackAction} />{header}{runtimeSelection.error ? configurationErrorPage : route === "native-signer-smoke" ? smokePage : route === "assets" ? assetsPage : genesisStagesPage}</>;
}

createRoot(document.getElementById("root")!).render(<GenesisWalletProvider><App /></GenesisWalletProvider>);

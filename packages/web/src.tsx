import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPublicClient, formatEther, getAddress, type Address, type PublicClient } from "viem";
import { deploymentManifests } from "./src/generated/deployment-manifests";
import { genesisChain, publicTransport } from "./src/config/chain";
import { assertManifestRuntime, getManifest, selectedEnvironment, type DeploymentManifest, type RuntimeDiagnostic } from "./src/config/manifest";
import { validateRuntime } from "./src/config/runtime";
import { accounts, injectedProvider, providerChainId, switchChain, type Eip1193Provider, type WalletStatus } from "./src/wallet/provider";
import { walletClient } from "./src/wallet/wallet-client";
import { readGlobal, readUser, type GenesisGlobal, type GenesisUser } from "./src/genesis/reads";
import { contribute, type ContributionState } from "./src/genesis/contribution";
import { formatNative, safeMaxAmount } from "./src/genesis/amount";
import { phaseMessage } from "./src/genesis/phase";
import { getLedger, prepareClaim, submitClaim, pollClaimStatus, type ApiError, validateExactUsername } from "./src/claim/api";
import { signPreparedClaim } from "./src/claim/typed-data";
import type { ClaimState, Ledger, PreparedClaim } from "./src/claim/types";
import "./style.css";

export const EVM_NATIVE_DECIMALS = 18;
const initialNotice = "Connect an EIP-1193 browser wallet. Genesis never uses a Product Host account API.";
type Language = "zh-CN" | "en";
const copy = {
  "zh-CN": { title: "MINI Genesis Pool", connect: "连接钱包", disconnect: "断开", wallet: "浏览器钱包", noWallet: "未检测到注入式钱包", status: "状态", phase: "当前阶段", raised: "已投入", addresses: "参与地址", remaining: "剩余区块", mine: "我的", balance: "钱包余额", contributed: "累计投入", entitlement: "MINI entitlement", claimable: "可领取 Lucky Credit", username: "Exact People username", prepare: "准备 Claim", sign: "签名并提交", amount: "投入 PAS", join: "加入 Pool", max: "安全最大值", rules: "规则", template: "当前环境仍是模板配置，链上读写已禁用。", unavailable: "Claim 服务尚未配置", noRuntime: "运行时校验未通过", refresh: "刷新", included: "已上链，等待 finalized", finality: "等待 finalized", language: "语言", theme: "主题", light: "浅色", dark: "深色", system: "跟随系统", price: "启动价格将在 Genesis 结束并进入后续 Curve 模块后确定。", intro: "独立 EVM dApp：贡献 PAS，记录未来 MINI entitlement，并通过后端处理 Lucky Credit Claim。", diagnostics: "诊断", rulesText: ["第一笔投入启动 Stream，并必须达到 first minimum。", "后续投入必须严格大于 subsequent minimum。", "PAS 不可撤回，会立即进入 immutable Treasury。", "合约记录未来 MINI entitlement，不直接发行 MINI。", "Lucky Credit 在后续 Claim 流程中处理。"] },
  en: { title: "MINI Genesis Pool", connect: "Connect wallet", disconnect: "Disconnect", wallet: "Browser wallet", noWallet: "No injected wallet detected", status: "Status", phase: "Current phase", raised: "Contributed", addresses: "Contributors", remaining: "Blocks remaining", mine: "My account", balance: "Wallet balance", contributed: "My contribution", entitlement: "MINI entitlement", claimable: "Claimable Lucky Credit", username: "Exact People username", prepare: "Prepare Claim", sign: "Sign and submit", amount: "Contribute PAS", join: "Join Pool", max: "Safe maximum", rules: "Rules", template: "This environment is a template; chain reads and writes are disabled.", unavailable: "Claim service is not configured", noRuntime: "Runtime validation failed", refresh: "Refresh", included: "Included; waiting for finalized", finality: "Waiting for finalized", language: "Language", theme: "Theme", light: "Light", dark: "Dark", system: "System", price: "The start price will be determined by a future Curve module after Genesis ends.", intro: "Standalone EVM dApp: contribute PAS, record future MINI entitlement, and handle Lucky Credit claims through the backend.", diagnostics: "Diagnostics", rulesText: ["The first contribution starts the Stream and must reach the first minimum.", "Later contributions must be strictly greater than the subsequent minimum.", "PAS cannot be withdrawn and enters the immutable Treasury immediately.", "The contract records future MINI entitlement; it does not issue MINI.", "Lucky Credit is handled by the later Claim flow."] },
} as const;

function App() {
  const languageState = useState<Language>(() => (localStorage.getItem("mini-genesis-language") as Language) || "zh-CN");
  const [language, setLanguage] = languageState;
  const [theme, setTheme] = useState(() => localStorage.getItem("mini-genesis-theme") || "system");
  const t = copy[language];
  const [walletState, setWalletState] = useState<WalletStatus>(injectedProvider() ? "disconnected" : "unavailable");
  const [account, setAccount] = useState<Address | null>(null);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [client, setClient] = useState<PublicClient | null>(null);
  const [runtime, setRuntime] = useState<RuntimeDiagnostic | null>(null);
  const [global, setGlobal] = useState<GenesisGlobal | null>(null);
  const [user, setUser] = useState<GenesisUser | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [notice, setNotice] = useState(initialNotice);
  const [amount, setAmount] = useState("");
  const [safeMaximum, setSafeMaximum] = useState<bigint | null>(null);
  const [contributionState, setContributionState] = useState<ContributionState>("idle");
  const [txHash, setTxHash] = useState("");
  const [username, setUsername] = useState("");
  const [prepared, setPrepared] = useState<PreparedClaim | null>(null);
  const [signature, setSignature] = useState<`0x${string}` | null>(null);
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const contributionAbort = useRef<AbortController | null>(null);
  const claimAbort = useRef<AbortController | null>(null);
  const refreshLock = useRef(false);
  const manifest = useMemo(() => getManifest(selectedEnvironment(import.meta.env.MODE, import.meta.env.VITE_DEPLOYMENT_ENV)), []);
  const environment = manifest?.environment ?? "unknown";

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("mini-genesis-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("mini-genesis-language", language); }, [language]);
  useEffect(() => {
    const p = injectedProvider(); if (!p) return;
    const cancelOperations = () => { contributionAbort.current?.abort(); claimAbort.current?.abort(); contributionAbort.current = null; claimAbort.current = null; };
    const onAccounts = async (value: unknown) => { cancelOperations(); const list = (value as string[]).filter(Boolean); setPrepared(null); setSignature(null); setLedger(null); if (!list.length) { setAccount(null); setWalletState("disconnected"); return; } setAccount(getAddress(list[0])); setWalletState("connected"); };
    const onChain = () => { cancelOperations(); setPrepared(null); setSignature(null); setClient(null); setRuntime(null); setGlobal(null); setUser(null); setWalletState("wrong_chain"); };
    const onDisconnect = () => { cancelOperations(); setAccount(null); setClient(null); setRuntime(null); setWalletState("disconnected"); };
    p.on?.("accountsChanged", onAccounts); p.on?.("chainChanged", onChain); p.on?.("disconnect", onDisconnect);
    return () => { cancelOperations(); p.removeListener?.("accountsChanged", onAccounts); p.removeListener?.("chainChanged", onChain); p.removeListener?.("disconnect", onDisconnect); };
  }, []);

  const refresh = useCallback(async (nextClient = client, nextAccount = account) => {
    if (!manifest || !nextClient || !runtime?.ok || refreshLock.current) return;
    refreshLock.current = true;
    try { const data = await readGlobal(nextClient, manifest); setGlobal(data); if (nextAccount) { setUser(await readUser(nextClient, manifest, nextAccount)); if (manifest.backend?.baseUrl) setLedger(await getLedger(manifest, nextAccount)); } }
    catch (error) { setNotice(error instanceof Error ? error.message : "RPC_UNAVAILABLE"); }
    finally { refreshLock.current = false; }
  }, [account, client, manifest, runtime?.ok]);

  useEffect(() => { if (!client || !account || !manifest || !runtime?.ok) return; void refresh(); const timer = window.setInterval(() => void refresh(), 12_000); const focus = () => void refresh(); window.addEventListener("focus", focus); return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); }; }, [account, client, manifest, refresh, runtime?.ok]);
  useEffect(() => { if (!client || !account || !manifest || !runtime?.ok) { setSafeMaximum(null); return; } void safeMaxAmount(client as any, { account, to: manifest.source.contract }).then(setSafeMaximum); }, [account, client, manifest, runtime?.ok]);

  const connect = async () => {
    try {
      if (!manifest) throw new Error("MANIFEST_NOT_FOUND");
      assertManifestRuntime(manifest);
      const p = injectedProvider(); if (!p) throw new Error("BROWSER_WALLET_UNAVAILABLE");
      setWalletState("connecting"); await switchChain(p, manifest); const [address] = await accounts(p, true); if (!address) throw new Error("WALLET_CONNECTION_REJECTED");
      if (await providerChainId(p) !== Number(manifest.source.chainId)) throw new Error("WRONG_CHAIN");
      const c = createPublicClient({ chain: genesisChain(manifest), transport: publicTransport(manifest) });
      const check = await validateRuntime(c, manifest); setRuntime(check); if (!check.ok) { setWalletState("error"); setNotice(check.message || t.noRuntime); return; }
      setProvider(p); setAccount(address); setClient(c); setWalletState("connected"); setNotice("Connected"); await refresh(c, address);
    } catch (error) { const message = error instanceof Error ? error.message : "WALLET_CONNECTION_REJECTED"; setWalletState(message === "WRONG_CHAIN" ? "wrong_chain" : "error"); setNotice(message); }
  };
  const cancelOperations = () => { contributionAbort.current?.abort(); claimAbort.current?.abort(); contributionAbort.current = null; claimAbort.current = null; };
  const disconnect = () => { cancelOperations(); setAccount(null); setProvider(null); setClient(null); setRuntime(null); setGlobal(null); setUser(null); setLedger(null); setPrepared(null); setSignature(null); setWalletState("disconnected"); };
  const join = async () => {
    if (!manifest || !client || !provider || !account || !global || !runtime?.ok) return;
    cancelOperations(); const controller = new AbortController(); contributionAbort.current = controller;
    try { const hash = await contribute(client, walletClient(provider, manifest), manifest, account, amount, global.phase, global.firstContributionMinimum, global.subsequentContributionMinimumExclusive, (update) => { setContributionState(update.state); if (update.hash) setTxHash(update.hash); if (update.error) setNotice(update.error); }, controller.signal); setTxHash(hash); await refresh(); } catch (error) { if (error instanceof Error && error.message !== "OPERATION_CANCELLED") setNotice(error.message); } finally { if (contributionAbort.current === controller) contributionAbort.current = null; }
  };
  const prepare = async () => { if (!manifest || !account || !manifest.backend?.baseUrl) { setNotice(t.unavailable); return; } cancelOperations(); try { setClaimState("preparing"); setPrepared(await prepareClaim(manifest, account, validateExactUsername(username))); setSignature(null); setClaimState("review"); } catch (error) { setClaimState("failed"); setNotice(error instanceof Error ? error.message : "CLAIM_SERVICE_ERROR"); } };
  const signAndSubmit = async () => { if (!manifest || !provider || !account || !prepared) return; cancelOperations(); const controller = new AbortController(); claimAbort.current = controller; try { setClaimState("awaiting_signature"); const sig = await signPreparedClaim(walletClient(provider, manifest), prepared, account, username, manifest); setSignature(sig); setClaimState("submitting"); await submitClaim(manifest, prepared.claim.creditGrantId, sig, controller.signal); setClaimState("submitted"); const current = await pollClaimStatus(manifest, prepared.claim.creditGrantId, { signal: controller.signal }); if (current.status === "FINALIZED") { setClaimState("finalized"); await refresh(); } else if (current.status === "FAILED") setClaimState("failed"); } catch (error) { if (!(error instanceof Error && error.message === "OPERATION_CANCELLED")) { setClaimState("failed"); setNotice(error instanceof Error ? error.message : "CLAIM_SERVICE_ERROR"); } } finally { if (claimAbort.current === controller) claimAbort.current = null; } };
  const progress = global && global.genesisAllocation > 0n ? Math.min(100, Number((global.emittedMini * 10_000n) / global.genesisAllocation) / 100) : 0;
  const phaseText = global ? phaseMessage[global.phaseName][language === "zh-CN" ? "zh" : "en"] : "—";
  const setQuickAmount = (value: string) => { try { const requested = BigInt(value) * 10n ** 18n; if (safeMaximum !== null && requested <= safeMaximum) setAmount(value); } catch { /* fixed button values */ } };

  return <main>
    <header className="topbar"><div><span className="eyebrow">MINI</span><h1>{t.title}</h1><p>{t.intro}</p></div><div className="toolbar"><label>{t.language}<select value={language} onChange={(e) => setLanguage(e.target.value as Language)}><option value="zh-CN">简体中文</option><option value="en">English</option></select></label><label>{t.theme}<select value={theme} onChange={(e) => setTheme(e.target.value)}><option value="system">{t.system}</option><option value="light">{t.light}</option><option value="dark">{t.dark}</option></select></label></div></header>
    <section className="wallet-card"><div><h2>{t.wallet}</h2><p className="mono">{account || t.noWallet}</p><p aria-live="polite">{walletState}</p></div>{account ? <button type="button" onClick={disconnect}>{t.disconnect}</button> : <button type="button" onClick={connect} disabled={!manifest || manifest.status !== "deployed"}>{t.connect}</button>}</section>
    {manifest?.status !== "deployed" && <section className="notice" role="alert"><strong>{t.template}</strong><p>{environment === "unknown" ? "MANIFEST_NOT_FOUND" : `Manifest ${environment}: template`}</p></section>}
    {runtime && !runtime.ok && <section className="notice" role="alert"><strong>{t.noRuntime}</strong><p>{runtime.code}: {runtime.message}</p><details><summary>{t.diagnostics}</summary><pre>{JSON.stringify(runtime.checks, null, 2)}</pre></details></section>}
    <section><div className="section-title"><h2>Genesis Stream</h2><button type="button" className="secondary" onClick={() => void refresh()} disabled={!runtime?.ok}>{t.refresh}</button></div><dl><dt>{t.phase}</dt><dd>{phaseText}</dd><dt>{t.raised}</dt><dd>{global ? `${formatEther(global.totalRaisedDot)} PAS` : "—"}</dd><dt>{t.addresses}</dt><dd>{global?.contributorCount.toString() ?? "—"}</dd><dt>{t.remaining}</dt><dd>{global ? (global.contributionEndBlock > 0n ? (global.contributionEndBlock - global.startBlock).toString() : "—") : "—"}</dd><dt>MINI progress</dt><dd>{progress.toFixed(2)}%</dd></dl><div className="progress"><span style={{ width: `${progress}%` }} /></div><p className="muted">{t.price}</p></section>
    <section><h2>{t.join}</h2><label htmlFor="amount">{t.amount}</label><div className="amount-row"><input id="amount" inputMode="decimal" placeholder="1.0" value={amount} onChange={(e) => setAmount(e.target.value)} /><button type="button" className="secondary" disabled={safeMaximum === null} onClick={() => { if (safeMaximum !== null) setAmount(formatNative(safeMaximum)); }}>{t.max}</button></div><div className="quick-row"><button type="button" className="secondary" disabled={safeMaximum === null || safeMaximum < 10n * 10n ** 18n} onClick={() => setQuickAmount("10")}>+10</button><button type="button" className="secondary" disabled={safeMaximum === null || safeMaximum < 100n * 10n ** 18n} onClick={() => setQuickAmount("100")}>+100</button></div><button type="button" onClick={() => void join()} disabled={!runtime?.ok || !account || !global || contributionState === "simulating" || contributionState === "awaiting_signature"}>{t.join}</button><p aria-live="polite">{contributionState}{txHash && <span className="mono"> · {txHash}</span>}</p></section>
    <section><h2>{t.mine}</h2><dl><dt>H160</dt><dd className="mono">{account || "—"}</dd><dt>{t.balance}</dt><dd>{user ? `${formatEther(user.nativeBalance)} PAS` : "—"}</dd><dt>{t.contributed}</dt><dd>{user ? `${formatEther(user.contributedDot)} PAS` : "—"}</dd><dt>{t.entitlement}</dt><dd>{user?.pendingMini.toString() ?? "—"}</dd><dt>{t.claimable}</dt><dd>{ledger?.claimable ?? (manifest?.backend?.baseUrl ? "—" : t.unavailable)}</dd></dl></section>
    <section><h2>Lucky Credit Claim</h2><label htmlFor="username">{t.username}</label><input id="username" value={username} onChange={(e) => { setUsername(e.target.value); setPrepared(null); setSignature(null); }} placeholder="exact UTF-8 value" /><button type="button" onClick={() => void prepare()} disabled={!account || !manifest?.backend?.baseUrl}>{t.prepare}</button>{prepared && <div className="review"><p>Credit grant: <span className="mono">{prepared.claim.creditGrantId}</span></p><p>Amount: {prepared.claim.amount}</p><button type="button" onClick={() => void signAndSubmit()} disabled={claimState === "awaiting_signature" || claimState === "submitting"}>{t.sign}</button></div>}<p aria-live="polite">{claimState}{signature ? " · signature ready" : ""}</p>{!manifest?.backend?.baseUrl && <p className="muted">{t.unavailable}</p>}</section>
    <section><details><summary>{t.rules}</summary><ul>{t.rulesText.map((rule) => <li key={rule}>{rule}</li>)}</ul></details></section>
    <p className="notice" role="status">{notice}</p>
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);

import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPublicClient, formatEther, getAddress, type Address, type PublicClient } from "viem";
import { deploymentManifests } from "./src/generated/deployment-manifests";
import { genesisChain, publicTransport } from "./src/config/chain";
import { getManifest, selectedEnvironment, type DeploymentManifest } from "./src/config/manifest";
import { accounts, injectedProvider, providerChainId, switchChain, type Eip1193Provider } from "./src/wallet/provider";
import { walletClient } from "./src/wallet/wallet-client";
import { readGlobal, readUser, type GenesisGlobal, type GenesisUser } from "./src/genesis/reads";
import { readContributionHistory, type ContributionHistoryItem } from "./src/genesis/history";
import { contribute, type ContributionState } from "./src/genesis/contribution";
import { formatNative, safeMaxAmount } from "./src/genesis/amount";
import { finalizedBlock } from "./src/genesis/finality";
import { demoGenesis, demoGlobal, demoUser, DEMO_ACCOUNT } from "./src/demo/data";
import { DOT_SYMBOL, MINI_SYMBOL } from "./src/config/assets";
import "./style.css";

type Language = "zh-CN" | "en";
type Theme = "light" | "dark";
const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

const copy = {
  "zh-CN": {
    genesis: "启动", rules: "规则", connect: "连接钱包", disconnect: "断开连接", myAssets: "我的资产", pool: "Genesis Pool",
    startPrice: "当前启动价格", progress: "总发放进度", contribution: "投入 DOT", balance: "余额", all: "全部", join: "加入 Pool",
    phase: "当前阶段", contributors: "参与地址", raised: "已投入", blocks: "区块", mine: "我的", mini: "我的 MINI", vmini: "MINI 生态资产",
    history: "交易明细", status: "状态", confirmed: "已确认", unavailable: "暂不可用", walletUnavailable: "未检测到钱包",
    rulesTitle: "规则", account: "Account / 02", protocol: "Protocol / 01", language: "语言", light: "浅色", dark: "深色", system: "系统",
    noData: "连接钱包后显示真实数据。", demo: "预览模式", waiting: "等待", contributionPhase: "投入阶段", protection: "保护阶段", ended: "已结束",
    processing: "处理中…", success: "已确认（演示）", request: "已提交演示投入", statusLabel: "状态", unavailableNote: "此模块将在后续协议阶段启用。",
    ruleTitles: ["创世启动", "社交分发", "流动性引导", "主网上线", "代币经济学"],
    ruleDescs: ["用户投入 DOT，MINI 按区块持续发放；越早参与，持仓成本越低。", "部分激励通过社交关系与生态模块独立分发。", "创世阶段形成的价格与资金将用于后续 DOT / MINI 流动性启动。", "达到预定启动条件后，MINI 进入正式交易与网络使用阶段。", "MINI 总量、创世分发、流动性及长期激励安排。"],
    ruleDetails: ["用户在创世期投入 DOT。每个区块释放固定 MINI，按该区块有效投入权重分配；启动价格锚定最近投入区块的最大持有成本。", "Genesis 核心合约只负责 DOT 投入和 MINI 权益记录，其他生态分发模块独立运行。", "最终启动价格成为后续绑定曲线的起点，创世资金按协议规则用于 DOT / MINI 流动性。", "创世结束后协议进入后续曲线与流动性阶段，MINI 才进入正式使用。", "供应、阶段分配、流动性和长期激励由部署参数与协议规则共同确定。"],
  },
  en: {
    genesis: "Genesis", rules: "Rules", connect: "Connect", disconnect: "Disconnect", myAssets: "My assets", pool: "Genesis Pool",
    startPrice: "Current Start Price", progress: "Total emission", contribution: "Contribute DOT", balance: "Balance", all: "Max", join: "Join Pool",
    phase: "Current phase", contributors: "Contributors", raised: "Contributed", blocks: "blocks", mine: "My Assets", mini: "My MINI", vmini: "MINI ecosystem asset",
    history: "Transaction details", status: "Status", confirmed: "Confirmed", unavailable: "Unavailable", walletUnavailable: "No wallet detected",
    rulesTitle: "Rules", account: "Account / 02", protocol: "Protocol / 01", language: "Language", light: "Light", dark: "Dark", system: "System",
    noData: "Connect a wallet to show live data.", demo: "Preview mode", waiting: "Waiting", contributionPhase: "Contribution", protection: "Protection", ended: "Ended",
    processing: "Processing…", success: "Confirmed (demo)", request: "Demo contribution submitted", statusLabel: "Status", unavailableNote: "This module will be enabled in a later protocol phase.",
    ruleTitles: ["Genesis Launch", "Social Distribution", "Liquidity Bootstrap", "Mainnet Launch", "Token Economics"],
    ruleDescs: ["Contribute DOT while MINI streams per block; earlier participation has a lower cost basis.", "Some incentives are distributed independently through social and ecosystem modules.", "The price and funds formed during Genesis support the future DOT / MINI liquidity launch.", "After launch conditions are met, MINI enters formal trading and network use.", "MINI supply, Genesis distribution, liquidity, and long-term incentives."],
    ruleDetails: ["Users contribute DOT during Genesis. Fixed MINI is released per block and allocated by contribution weight; the start price is anchored to the maximum cost basis at the latest contribution block.", "The Genesis contract only records DOT contributions and MINI entitlement; other ecosystem distribution modules remain independent.", "The final start price becomes the bonding-curve starting point and Genesis funds bootstrap DOT / MINI liquidity under protocol rules.", "After Genesis, the protocol moves into the curve and liquidity phase, where MINI enters formal use.", "Supply, phase allocation, liquidity, and long-term incentives are defined by deployed parameters and protocol rules."],
  },
} as const;

function shortHash(value: string): string { return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value; }
function formatAmount(value: bigint | null | undefined, digits = 2): string { return value == null ? "—" : Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: digits }); }
function phaseLabel(phase: number, t: typeof copy[Language]): string { return phase === 0 ? t.waiting : phase === 1 ? t.contributionPhase : phase === 2 ? t.protection : t.ended; }

function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("mini-genesis-language") as Language) || "zh-CN");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("mini-genesis-theme") as Theme) || "light");
  const text = copy[language];
  const [account, setAccount] = useState<Address | null>(null);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [client, setClient] = useState<PublicClient | null>(null);
  const [manifest] = useState<DeploymentManifest | null>(() => getManifest(selectedEnvironment(import.meta.env.MODE, import.meta.env.VITE_DEPLOYMENT_ENV)));
  const [global, setGlobal] = useState<GenesisGlobal | null>(demoMode ? demoGlobal : null);
  const [user, setUser] = useState<GenesisUser | null>(demoMode ? demoUser : null);
  const [history, setHistory] = useState<ContributionHistoryItem[]>([]);
  const [amount, setAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState<bigint | null>(demoMode ? demoGenesis.walletBalance : null);
  const [contributionState, setContributionState] = useState<ContributionState | "demo_idle" | "demo_processing" | "demo_success">(demoMode ? "demo_idle" : "idle");
  const [walletMenu, setWalletMenu] = useState(false);
  const [openRule, setOpenRule] = useState<number | null>(null);
  const [notice, setNotice] = useState<string>(demoMode ? text.demo : text.noData);
  const [myVisible, setMyVisible] = useState(demoMode);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("mini-genesis-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("mini-genesis-language", language); }, [language]);
  useEffect(() => { if (demoMode) setNotice(copy[language].demo); }, [language]);

  const refresh = useCallback(async (nextClient = client, nextAccount = account) => {
    if (demoMode || !manifest || !nextClient || !nextAccount) return;
    setRefreshing(true);
    try {
      const nextGlobal = await readGlobal(nextClient, manifest);
      const nextUser = await readUser(nextClient, manifest, nextAccount);
      setGlobal(nextGlobal); setUser(nextUser); setMaxAmount(await safeMaxAmount(nextClient as any, { account: nextAccount, to: manifest.source.contract }));
      const finalized = await finalizedBlock(nextClient);
      if (finalized !== null) setHistory(await readContributionHistory(nextClient, manifest, nextAccount, finalized));
      setMyVisible(true); setNotice("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "RPC_UNAVAILABLE"); }
    finally { setRefreshing(false); }
  }, [account, client, manifest]);

  const connect = async () => {
    if (demoMode) { setAccount(getAddress("0x0000000000000000000000000000000000000001")); setMyVisible(true); setWalletMenu(false); setNotice(text.demo); return; }
    try {
      if (!manifest || manifest.status !== "deployed") throw new Error("TEMPLATE_MANIFEST_NOT_RUNTIME_READY");
      const nextProvider = injectedProvider(); if (!nextProvider) throw new Error("BROWSER_WALLET_UNAVAILABLE");
      await switchChain(nextProvider, manifest); const [nextAccount] = await accounts(nextProvider, true); if (!nextAccount) throw new Error("WALLET_CONNECTION_REJECTED");
      if (await providerChainId(nextProvider) !== Number(manifest.source.chainId)) throw new Error("WRONG_CHAIN");
      const nextClient = createPublicClient({ chain: genesisChain(manifest), transport: publicTransport(manifest) });
      setProvider(nextProvider); setAccount(nextAccount); setClient(nextClient); setWalletMenu(false); await refresh(nextClient, nextAccount);
    } catch (error) { setNotice(error instanceof Error ? error.message : "WALLET_CONNECTION_REJECTED"); }
  };
  const disconnect = () => { setAccount(null); setProvider(null); setClient(null); setGlobal(demoMode ? demoGlobal : null); setUser(demoMode ? demoUser : null); setHistory([]); setMyVisible(demoMode); setWalletMenu(false); };
  const submit = async () => {
    if (!amount || !global) { setNotice(text.contribution); return; }
    if (demoMode) { setContributionState("demo_processing"); setNotice(text.processing); window.setTimeout(() => { setContributionState("demo_success"); setNotice(text.success); }, 700); return; }
    if (!manifest || !client || !provider || !account) { setNotice("WALLET_REQUIRED"); return; }
    try { await contribute(client, walletClient(provider, manifest), manifest, account, amount, global.phase, global.firstContributionMinimum, global.subsequentContributionMinimumExclusive, (update) => setContributionState(update.state)); await refresh(); } catch (error) { setNotice(error instanceof Error ? error.message : "TRANSACTION_FAILED"); }
  };
  const setAll = () => { if (maxAmount !== null) setAmount(formatNative(maxAmount)); };
  const stepAmount = (delta: number) => { const current = Number(amount || 0); setAmount(String(Math.max(0, current + delta))); };
  const progress = global && global.genesisAllocation > 0n ? Math.min(100, Number((global.emittedMini * 10_000n) / global.genesisAllocation) / 100) : 0;
  const currentPrice = global?.startPriceX18 == null ? "—" : formatAmount(global.startPriceX18, 6);
  const walletLabel = demoMode && !account ? text.connect : account ? shortHash(account) : text.connect;
  const displayedHistory = demoMode ? [{ amount: 100n * 10n ** 18n, blockNumber: 1_000_072n, transactionHash: "0x9a7f0000000000000000000000000000000031c8" as `0x${string}`, logIndex: 0 }, { amount: 220n * 10n ** 18n, blockNumber: 1_000_041n, transactionHash: "0xf42100000000000000000000000000000000bc09" as `0x${string}`, logIndex: 0 }] : history;
  const explorer = manifest?.source.explorerUrl;

  return <>
    <header className="site-header"><nav className="nav"><a className="brand" href="#genesis" aria-label="MINI Home"><span className="brand-mark">M</span><span className="brand-word">MINI</span></a><div className="nav-center"><a className="nav-link active" href="#genesis">{text.genesis}</a><a className="nav-link" href="#rules">{text.rules}</a></div><div className="nav-actions"><select className="language-select" value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={text.language}><option value="zh-CN">中文</option><option value="en">EN</option></select><button className="utility-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Switch appearance"><span className="utility-icon">{theme === "dark" ? "☀" : "☾"}</span></button><div className="wallet-wrap"><button className="wallet-button" type="button" onClick={() => setWalletMenu((value) => !value)}><span className="wallet-dot" hidden={!account} />{walletLabel}<span>⌄</span></button>{walletMenu && <div className="wallet-menu open"><button type="button" onClick={() => { setMyVisible(true); setWalletMenu(false); document.getElementById("myPanel")?.scrollIntoView({ behavior: "smooth" }); }}>{text.myAssets}</button><button type="button" className="danger" onClick={account ? disconnect : connect}>{account ? text.disconnect : text.connect}</button></div>}</div></div></nav></header>
    <main><section className="hero" id="genesis"><div className="genesis-card"><div className="demo-badge" hidden={!demoMode}>{text.demo}</div><h1 className="pool-title">{text.pool}</h1><div className="status-row"><div><span className="label">{text.startPrice}</span><div className="price">{currentPrice}<span className="price-unit">{DOT_SYMBOL} / {MINI_SYMBOL}</span></div></div><div className="progress-inline"><div className="progress-top"><strong>{progress.toFixed(1)}%</strong><span>{text.progress}</span></div><div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="progress-fill" style={{ width: `${progress}%` }} /></div><div className="progress-meta"><span>{global ? `${formatAmount(global.emittedMini)} ${MINI_SYMBOL}` : "—"}</span><span>{global ? `${formatAmount(global.genesisAllocation)} ${MINI_SYMBOL}` : "—"}</span></div></div></div><div className="input-panel"><div className="input-top"><span>{text.contribution}</span><span>{text.balance} <span className="balance-value">{formatAmount(user?.nativeBalance ?? maxAmount)} {DOT_SYMBOL}</span> · <button className="all-button" type="button" onClick={setAll}>{text.all}</button></span></div><div className="amount-control"><button className="step-button" type="button" onClick={() => stepAmount(-1)} aria-label="Decrease 1 DOT">−</button><input className="amount-field" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" aria-label="DOT amount" /><button className="step-button" type="button" onClick={() => stepAmount(1)} aria-label="Increase 1 DOT">+</button></div><div className="unit-line">{DOT_SYMBOL}</div><div className="quick-row"><button className="quick-button" type="button" onClick={() => stepAmount(10)}>+10 {DOT_SYMBOL}</button><button className="quick-button" type="button" onClick={() => stepAmount(100)}>+100 {DOT_SYMBOL}</button></div><button className="submit-button" type="button" onClick={() => void submit()} disabled={contributionState === "demo_processing" || contributionState === "simulating" || contributionState === "awaiting_signature"}>{text.join}</button><p className="input-status" aria-live="polite">{contributionState === "demo_processing" ? text.processing : contributionState === "demo_success" ? text.success : notice}</p></div></div></section>
      <section className="stats-strip"><div><span>{text.phase}</span><strong>{global ? phaseLabel(global.phase, text) : "—"}</strong></div><div><span>{text.raised}</span><strong>{global ? `${formatAmount(global.totalRaisedDot)} ${DOT_SYMBOL}` : "—"}</strong></div><div><span>{text.contributors}</span><strong>{global?.contributorCount.toLocaleString() ?? "—"}</strong></div><div><span>{text.blocks}</span><strong>{global ? (global.contributionEndBlock - global.startBlock).toString() : "—"}</strong></div><button className="refresh-button" type="button" onClick={() => void refresh()} disabled={refreshing || demoMode}>{refreshing ? "…" : "↻"}</button></section>
      <section className="section" id="rules"><div className="section-header rules-header"><span className="section-index">{text.protocol}</span><h2>{text.rulesTitle}</h2></div><div className="rule-list">{text.ruleTitles.map((title, index) => <article className={`rule-item ${openRule === index ? "open" : ""}`} key={title}><button className="rule-summary" type="button" aria-expanded={openRule === index} onClick={() => setOpenRule(openRule === index ? null : index)}><span className="rule-num">{String(index + 1).padStart(2, "0")}</span><span className="rule-title">{title}</span><span className="rule-desc">{text.ruleDescs[index]}</span><span className="rule-arrow">＋</span></button><div className="rule-detail"><div className="rule-detail-inner"><div className="rule-detail-content">{text.ruleDetails[index]}</div></div></div></article>)}</div></section>
      <section className={`my-panel ${myVisible ? "visible" : ""}`} id="myPanel"><div className="section-header"><div><span className="section-index">{text.account}</span><h2>{text.mine}</h2></div><span className="my-address">{account ? shortHash(account) : demoMode ? DEMO_ACCOUNT : text.noData}</span></div><div className="my-grid"><article className="asset-card"><span className="label">{text.mini}</span><div className="asset-value">{demoMode ? "12,480.00" : formatAmount(user?.pendingMini)}</div><div className="asset-note">{text.unavailableNote}</div></article><article className="asset-card"><span className="label">{text.vmini}</span><div className="asset-value">—</div><div className="asset-note">{text.unavailableNote}</div><button className="claim-button" type="button" disabled>{text.unavailable}</button></article></div><article className="history-card"><div className="history-head"><strong>{text.history}</strong><span>{text.status}</span><span>{DOT_SYMBOL}</span><span>Block</span></div>{displayedHistory.length ? displayedHistory.map((item) => <div className="tx-row" key={`${item.transactionHash}-${item.logIndex}`}><div><div className="tx-type">{text.contribution}</div><div className="tx-time">{shortHash(item.transactionHash)}</div></div><div className="tx-amount">{formatAmount(item.amount)} {DOT_SYMBOL}</div><div className="tx-status">{text.confirmed}</div><div className="tx-block">#{item.blockNumber.toString()}</div></div>) : <div className="empty-history">{text.noData}</div>}</article></section>
      <footer><span>MINI Genesis Stream · {DOT_SYMBOL}</span><span>{demoMode ? text.demo : account ? text.confirmed : text.noData}</span></footer>
    </main>
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);

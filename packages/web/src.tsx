import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPublicClient, formatUnits, type Address, type PublicClient } from "viem";
import { genesisChain, publicTransport } from "./src/config/chain";
import { getManifest, selectedEnvironment, type DeploymentManifest } from "./src/config/manifest";
import { nativeNetworkOverride, resolveNativeManifest } from "./src/config/native-network";
import { walletClient } from "./src/wallet/wallet-client";
import { GenesisWalletProvider } from "./src/wallet/AppKitProvider";
import { useGenesisWallet } from "./src/wallet/use-genesis-wallet";
import { readContributionHistory, type ContributionHistoryItem } from "./src/genesis/history";
import { startVisiblePolling, type PollController } from "./src/genesis/polling";
import { readGlobalDynamic, readGlobalStatic, readGenesisUserState, type GenesisDynamic, type GenesisStatic, type GenesisUser } from "./src/genesis/reads";
import { calculateStartPriceX18 } from "./src/genesis/start-price";
import { contributionBoundaryPercent } from "./src/genesis/progress";
import { GenesisProgress } from "./src/genesis/GenesisProgress";
import { formatNative, safeMaxAmount } from "./src/genesis/amount";
import { createEvmExecutionAdapter } from "./src/genesis/execution/evm";
import { createSubstrateExecutionAdapter, estimateNativeMax } from "./src/genesis/execution/substrate";
import { reconcileGenesisUserState } from "./src/genesis/reconcile";
import { nativeAssetSummary, shouldLoadContributionHistory } from "./src/genesis/assets";
import type { ContributionState } from "./src/genesis/execution/types";
import { demoDynamic, demoGenesis, demoStatic, demoUser, DEMO_ACCOUNT } from "./src/demo/data";
import { DOT_SYMBOL, MINI_SYMBOL } from "./src/config/assets";
import { Price } from "./src/format/price";
import { FieldFeedback } from "./src/feedback/FieldFeedback";
import { NotificationCenter } from "./src/feedback/NotificationCenter";
import { SystemBanner } from "./src/feedback/SystemBanner";
import { useFeedback } from "./src/feedback/use-feedback";
import type { FeedbackContext, NormalizedFeedback } from "./src/feedback/types";
import { getRetryAfterMs, isRateLimitError } from "./src/rpc/error";
import { NativeSignerSmoke } from "./src/dev/native-signer-smoke";
import "./style.css";
import "./src/interaction-overrides.css";

type Language = "zh-CN" | "en";
type Theme = "light" | "dark";
type AppRoute = "genesis" | "rules" | "assets" | "native-signer-smoke";
type UiContributionState = ContributionState | "demo_processing";
const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
const SHOW_GENESIS_STATS = false;
const NATIVE_SMOKE_ENABLED = import.meta.env.MODE === "development" || import.meta.env.VITE_DEPLOYMENT_ENV === "staging";
const NATIVE_MAINNET_UI = import.meta.env.VITE_NATIVE_NETWORK_OVERRIDE === "polkadot-mainnet"
  && import.meta.env.VITE_DEPLOYMENT_ENV !== "production"
  && (import.meta.env.MODE === "development" || import.meta.env.VITE_DEPLOYMENT_ENV === "staging");

const copy = {
  "zh-CN": {
    genesis: "启动", rules: "规则", connect: "连接钱包", disconnect: "断开连接", myAssets: "我的资产", pool: "Genesis Pool", startPrice: "当前启动成本", contribution: "投入 DOT", balance: "余额", all: "全部", join: "加入 Pool", connectAction: "连接钱包", phase: "当前阶段", contributors: "参与地址", raised: "已投入", mine: "我的资产", mini: "我的 MINI", contributed: "累计投入", vmini: "MINI 生态资产", history: "交易明细", status: "状态", confirmed: "已确认", unavailable: "暂不可用", assetsEmpty: "连接钱包后查看资产。", noHistory: "暂无投入记录。", language: "语言", demo: "预览模式", waiting: "等待", contributionPhase: "投入阶段", protection: "保护阶段", ended: "已结束", unavailableNote: "此模块将在后续协议阶段启用。", account: "切换账户", rulesTitle: "规则", viewTransaction: "查看交易", states: { validating: "检查中…", checking_mapping: "准备账户…", mapping_required: "准备账户…", awaiting_mapping_signature: "请确认账户设置", mapping_submitted: "等待账户设置…", mapping_finalized: "账户设置已确认…", verifying_mapping: "复核账户设置…", simulating: "模拟交易…", awaiting_signature: "请在钱包确认", submitted: "等待链上确认…", included: "交易已上链…", finalized: "已确认…", failed: "交易失败" }, ruleTitles: ["创世启动", "社交分发", "流动性引导", "主网上线", "代币经济学"], ruleDescs: ["用户投入 DOT，MINI 按区块持续发放；越早参与，持仓成本越低。", "部分激励通过社交关系与生态模块独立分发。", "创世阶段形成的价格与资金将用于后续 DOT / MINI 流动性启动。", "达到预定启动条件后，MINI 进入正式交易与网络使用阶段。", "MINI 总量、创世分发、流动性及长期激励安排。"], ruleDetails: ["用户在创世期投入 DOT。每个区块释放固定 MINI，按该区块有效投入权重分配；启动价格锚定最近投入区块的最大持有成本。", "Genesis 核心合约只负责 DOT 投入和 MINI 权益记录，其他生态分发模块独立运行。", "最终启动价格成为后续绑定曲线的起点，创世资金按协议规则用于 DOT / MINI 流动性。", "创世结束后协议进入后续曲线与流动性阶段，MINI 才进入正式使用。", "供应、阶段分配、流动性和长期激励由部署参数与协议规则共同确定。"],
    evmWallet: "EVM", polkadotWallet: "Polkadot", choosePolkadotWallet: "选择 Polkadot 钱包", noPolkadotWallet: "未检测到 Polkadot 钱包。", noSupportedAccount: "未找到兼容的 Polkadot 账户。", switchAccount: "切换账户", back: "返回",
  },
  en: {
    genesis: "Genesis", rules: "Rules", connect: "Connect", disconnect: "Disconnect", myAssets: "My assets", pool: "Genesis Pool", startPrice: "Current Launch Cost", contribution: "Contribute DOT", balance: "Balance", all: "Max", join: "Join Pool", connectAction: "Connect wallet", phase: "Current phase", contributors: "Contributors", raised: "Contributed", mine: "My Assets", mini: "My MINI", contributed: "Contributed", vmini: "MINI ecosystem asset", history: "Transaction details", status: "Status", confirmed: "Confirmed", unavailable: "Unavailable", assetsEmpty: "Connect your wallet to view your assets.", noHistory: "No contributions yet.", language: "Language", demo: "Preview mode", waiting: "Waiting", contributionPhase: "Contribution", protection: "Protection", ended: "Ended", unavailableNote: "This module will be enabled in a later protocol phase.", account: "Switch account", rulesTitle: "Rules", viewTransaction: "View transaction", states: { validating: "Validating…", checking_mapping: "Preparing account…", mapping_required: "Prepare account…", awaiting_mapping_signature: "Confirm account setup", mapping_submitted: "Waiting for account setup…", mapping_finalized: "Account setup finalized…", verifying_mapping: "Verifying account setup…", simulating: "Simulating…", awaiting_signature: "Confirm in wallet", submitted: "Waiting for confirmation…", included: "Transaction included…", finalized: "Finalized…", failed: "Transaction failed" }, ruleTitles: ["Genesis Launch", "Social Distribution", "Liquidity Bootstrap", "Mainnet Launch", "Token Economics"], ruleDescs: ["Contribute DOT while MINI streams per block; earlier participation has a lower cost basis.", "Some incentives are distributed independently through social and ecosystem modules.", "The price and funds formed during Genesis support the future DOT / MINI liquidity launch.", "After launch conditions are met, MINI enters formal trading and network use.", "MINI supply, Genesis distribution, liquidity, and long-term incentives."], ruleDetails: ["Users contribute DOT during Genesis. Fixed MINI is released per block and allocated by contribution weight; the start price is anchored to the maximum cost basis at the latest contribution block.", "The Genesis contract only records DOT contributions and MINI entitlement; other ecosystem distribution modules remain independent.", "The final start price becomes the bonding-curve starting point and Genesis funds bootstrap DOT / MINI liquidity under protocol rules.", "After Genesis, the protocol moves into the curve and liquidity phase, where MINI enters formal use.", "Supply, phase allocation, liquidity, and long-term incentives are defined by deployed parameters and protocol rules."],
    evmWallet: "EVM", polkadotWallet: "Polkadot", choosePolkadotWallet: "Choose Polkadot Wallet", noPolkadotWallet: "No Polkadot wallet detected.", noSupportedAccount: "No compatible Polkadot account found.", switchAccount: "Switch account", back: "Back",
  },
} as const;

const ruleCopy = {
  "zh-CN": {
    ruleTitles: ["创世启动", "社交分发", "流动性引导", "正式上线", "代币经济学"],
    ruleDescs: ["投入 DOT，累计获得流式分发的 MINI。", "把 MINI 带给互相信任的好友。", "以创世价格为起点，启动后续绑定曲线。", "完成 Root 绑定曲线和初始流动性建立后，MINI 将进入正式使用阶段。", "了解 MINI 的初始供应量、分配方式、流动性和长期激励。"],
    ruleDetails: [
      "创世启动共分发 10,000,000 MINI。\n\n- 每个区块固定释放 25 MINI，总释放周期为 400,000 个区块\n- 每个区块释放的 MINI，按照释放时 Pool 中已有 DOT 的占比分配\n- 320,000 个区块后进入保护期，不再接受投入，约为 7 天 9 小时\n- 随后进入 80,000 个区块的保护期，不再接受新的投入\n- 创世阶段的 MINI，在初始流动性建立后开放领取\n\n越早投入 DOT，越早开始参与分发，并能够覆盖更多后续区块。",
      "社交分发最多覆盖 9,600,000 MINI。\n\n- 在创世启动开放投入的前 320,000 个区块中，每个区块产生 15 MINI 的初始社交额度\n- 每个区块的额度按照累计释放差值确定，全部投入区块累计产生 5,000,000 MINI\n- 无投入区块产生的额度，将累计到下一个有投入的区块\n- 每个区块可分配的额度，只按照该区块新投入的 DOT 占比分配，不按照 Pool 中的 DOT 总量分配\n- 获得额度后，用户可以通过 Polkadot App 将其封装为随机红包，分享给互相信任的好友\n- 好友领取多少，就获得等额的 vMINI，即未来可领取 MINI 的权益\n- 每次领取时，领取者还会获得领取金额 50% 的新额度，并可以继续分享给自己的可信好友\n- vMINI 将在初始流动性建立后开放领取\n\n初始社交额度为 4,800,000 MINI。随着每次领取继续生成 50% 的新额度，社交分发最多可覆盖 9,600,000 MINI。\n\n这使 MINI 能够沿着 Polkadot App 中真实的可信关系不断传播，让早期分发不只取决于投入金额，也能更公平地触达真实用户。",
      "创世阶段用于完成早期分发和价格发现。创世结束后，将以参与者实际形成的最高有效持仓成本作为初始价格，启动 DOT / MINI Root 绑定曲线。",
      "届时，创世启动和社交分发形成的 MINI 权益将开放领取，MINI 将开放正式交易，并逐步用于 MiniJAM 网络及其生态应用。",
      "MINI 的初始供应量为 1,000,000,000 MINI。各阶段的分配比例、流动性安排和长期激励规则将保持公开，并按照协议和治理决策执行。\n\n你可以在这里了解完整的代币经济学：\nhttps://docs.minijam.xyz/docs/ecosystem/tokenomics",
    ],
  },
  en: {
    ruleTitles: ["Genesis Launch", "Social Distribution", "Liquidity Bootstrapping", "Official Launch", "Tokenomics"],
    ruleDescs: ["Contribute DOT and accumulate MINI through continuous, block-by-block distribution.", "Bring MINI to friends who trust one another.", "Use the Genesis price as the starting point for the subsequent bonding curve.", "After the Root bonding curve is completed and initial liquidity is established, MINI will enter its official usage phase.", "Learn about MINI’s initial supply, allocation, liquidity, and long-term incentives."],
    ruleDetails: [
      "A total of 10,000,000 MINI will be distributed during Genesis.\n\n- Each block releases a fixed 25 MINI, over a total of 400,000 blocks\n- The MINI released in each block is distributed according to your share of the DOT already in the Pool at the time of release\n- After 320,000 blocks, Genesis enters the Protection Phase and no longer accepts contributions. This contribution period lasts approximately 7 days and 9 hours\n- The Protection Phase then continues for another 80,000 blocks\n- MINI earned during Genesis becomes claimable after the initial liquidity has been established\n\nThe earlier you contribute DOT, the earlier you begin participating in the distribution and the more subsequent blocks you can cover.",
      "Social distribution can cover up to 9,600,000 MINI.\n\n- During the first 320,000 blocks in which contributions are open, each block generates an initial social allocation of 15 MINI\n- These blocks generate a total initial social allocation of 4,800,000 MINI\n- Allocations from blocks with no new contributions accumulate and are carried forward to the next block containing contributions\n- The allocation available in each block is distributed according to your share of the DOT newly contributed in that block, rather than your share of the total DOT in the Pool\n- After receiving an allocation, you can package it into a randomized Lucky Packet through the Polkadot App and share it with mutually trusted friends\n- When a friend claims an amount, they receive the same amount of vMINI, representing a future claim on MINI\n- Each recipient also receives a new allocation equal to 50% of the amount claimed and can continue sharing it with their own trusted friends\n- vMINI becomes claimable after the initial liquidity has been established\n\nThe initial social allocation is 4,800,000 MINI. As each claim generates a new allocation equal to 50% of the claimed amount, social distribution can cover up to 9,600,000 MINI.\n\nThis allows MINI to spread through real trusted relationships within the Polkadot App. Early distribution depends on more than contribution size and can reach genuine participants more fairly.",
      "Genesis provides early distribution and price discovery. Once Genesis ends, the maximum effective cost basis actually formed by participants will become the initial price of the DOT / MINI Root bonding curve.",
      "At that point, MINI entitlements created through Genesis and social distribution will become claimable. MINI will open for public trading and gradually be integrated into the MiniJAM network and its ecosystem applications.",
      "MINI has an initial supply of 1,000,000,000 MINI. Allocation percentages, liquidity arrangements, and long-term incentive rules for each stage will remain public and will be executed according to the protocol and governance decisions.\n\nRead the complete tokenomics here:\nhttps://docs.minijam.xyz/docs/ecosystem/tokenomics",
    ],
  },
} as const;

function routeFromHash(): AppRoute { return NATIVE_SMOKE_ENABLED && window.location.hash === "#/native-signer-smoke" ? "native-signer-smoke" : window.location.hash === "#/assets" ? "assets" : window.location.hash === "#/rules" ? "rules" : "genesis"; }
function hashForRoute(route: AppRoute): string { return route === "assets" ? "#/assets" : route === "rules" ? "#/rules" : route === "native-signer-smoke" ? "#/native-signer-smoke" : "#/"; }
function scrollToRoute(route: AppRoute, behavior: ScrollBehavior = "smooth"): void { const target = route === "rules" ? document.getElementById("rules") : route === "genesis" ? document.getElementById("genesis") : null; target?.scrollIntoView({ behavior }); }
function shortHash(value: string): string { return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value; }
function formatAmount(value: bigint | null | undefined, digits = 2): string { return value == null ? "—" : Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: digits }); }
function formatDotBalance(value: bigint | null | undefined, decimals: number, digits = 2): string { return value == null ? "—" : Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: digits }); }
function phaseLabel(phase: number, text: { waiting: string; contributionPhase: string; protection: string; ended: string }): string { return phase === 0 ? text.waiting : phase === 1 ? text.contributionPhase : phase === 2 ? text.protection : text.ended; }
function stateLabel(state: UiContributionState, text: { states: Record<string, string> }): string { return state === "demo_processing" ? text.states.simulating : state === "idle" ? "" : text.states[state] || state; }

function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("mini-genesis-language") as Language) || "en");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("mini-genesis-theme") as Theme) || "light");
  const text = { ...copy[language], ...ruleCopy[language], ...(NATIVE_MAINNET_UI ? { join: "Join Pool · Mainnet" } : {}) };
  const miniTradingNote = language === "zh-CN" ? "暂未开放交易" : "Trading is not available yet";
  const protectionPhaseLabel = language === "zh-CN" ? "保护期" : "Protection";
  const feedback = useFeedback();
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash());
  const [manifest] = useState<DeploymentManifest | null>(() => getManifest(selectedEnvironment(import.meta.env.MODE, import.meta.env.VITE_DEPLOYMENT_ENV)));
  const nativeManifest = useMemo(() => manifest ? resolveNativeManifest(manifest, import.meta.env.MODE) : null, [manifest]);
  const nativeMainnetOverride = Boolean(manifest && nativeNetworkOverride(manifest.environment, import.meta.env.MODE) === "polkadot-mainnet");
  const publicClient = useMemo<PublicClient | null>(() => demoMode || !manifest || manifest.status !== "deployed" ? null : createPublicClient({ chain: genesisChain(manifest), transport: publicTransport(manifest) }), [manifest]);
  const { session, walletReady, walletStatus, connectEvm, connectPolkadot, availablePolkadotWallets, openAccount, selectPolkadotAccount, switchToGenesisChain, disconnect, refreshNativeBalance, isConnected, status } = useGenesisWallet(manifest, publicClient, nativeManifest);
  const paymentReady = walletReady;
  const account = session?.kind === "evm" ? session.address : null;
  const provider = session?.kind === "evm" ? session.provider : null;
  const correctChain = session?.kind === "evm" ? session.correctChain : true;
  const chainId = session?.kind === "evm" ? session.chainId : null;
  const genesisIdentity = session?.kind === "evm" ? session.address : session?.kind === "polkadot" ? session.contractIdentity : null;
  const selectedAccountAddress = session?.kind === "polkadot" ? session.selectedAccountAddress : account;
  const nativeSymbol = (session?.kind === "polkadot" ? nativeManifest : manifest)?.source.currencySymbol ?? DOT_SYMBOL;
  const [staticState, setStaticState] = useState<GenesisStatic | null>(demoMode ? demoStatic : null);
  const [dynamicState, setDynamicState] = useState<GenesisDynamic | null>(demoMode ? demoDynamic : null);
  const [user, setUser] = useState<GenesisUser | null>(demoMode ? demoUser : null);
  const [history, setHistory] = useState<ContributionHistoryItem[]>([]);
  const [userStateStatus, setUserStateStatus] = useState<"idle" | "loading" | "ready" | "error">(demoMode ? "ready" : "idle");
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "ready" | "error">(demoMode ? "ready" : "idle");
  const [maxAmount, setMaxAmount] = useState<bigint | null>(demoMode ? demoGenesis.walletBalance : null);
  const [nativeMaxAmount, setNativeMaxAmount] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("");
  const [amountFeedback, setAmountFeedback] = useState<NormalizedFeedback | null>(null);
  const [contributionState, setContributionState] = useState<UiContributionState>("idle");
  const [walletMenu, setWalletMenu] = useState(false);
  const [polkadotWalletMenu, setPolkadotWalletMenu] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [languageMenu, setLanguageMenu] = useState(false);
  const [openRule, setOpenRule] = useState<number | null>(null);
  const walletWrapRef = useRef<HTMLDivElement | null>(null);
  const languageWrapRef = useRef<HTMLDivElement | null>(null);
  const dynamicRunning = useRef(false);
  const dynamicStateRef = useRef<GenesisDynamic | null>(dynamicState);
  const globalPollingRef = useRef<PollController | null>(null);
  const reconciliationRef = useRef<AbortController | null>(null);
  const nativeMaxRefreshKey = useRef<string | null>(null);
  const previousWalletStatus = useRef(status);
  const sessionKeyRef = useRef<string | null>(null);
  sessionKeyRef.current = session?.kind === "evm" ? `evm:${session.address}` : session?.kind === "polkadot" ? `polkadot:${session.accountId32}` : null;
  const sessionKey = sessionKeyRef.current;
  const context = useCallback((operation: FeedbackContext["operation"], params?: FeedbackContext["params"]): FeedbackContext => ({ operation, locale: language, params }), [language]);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("mini-genesis-theme", theme); }, [theme]);
  useEffect(() => { document.documentElement.classList.toggle("native-mainnet-override", nativeMainnetOverride); }, [nativeMainnetOverride]);
  useEffect(() => { localStorage.setItem("mini-genesis-language", language); }, [language]);
  useEffect(() => { dynamicStateRef.current = dynamicState; }, [dynamicState]);
  useEffect(() => { if (!demoMode && previousWalletStatus.current === "connecting" && status === "disconnected") feedback.presentCode("WALLET_CONNECTION_REJECTED", context("connect-wallet")); previousWalletStatus.current = status; }, [context, feedback.presentCode, status]);
  useEffect(() => { if (demoMode) return; if (!manifest) feedback.presentCode("CONFIGURATION_MISMATCH", context("load-global")); else if (manifest.status !== "deployed") feedback.presentCode("TEMPLATE_MANIFEST_NOT_RUNTIME_READY", context("load-global")); }, [context, feedback.presentCode, manifest]);
  useEffect(() => { const onHashChange = () => { const next = routeFromHash(); setRoute(next); window.setTimeout(() => scrollToRoute(next), 0); }; window.addEventListener("hashchange", onHashChange); return () => window.removeEventListener("hashchange", onHashChange); }, []);
  useEffect(() => { const onPointerDown = (event: PointerEvent) => { if (walletMenu && walletWrapRef.current && !walletWrapRef.current.contains(event.target as Node)) setWalletMenu(false); if (languageMenu && languageWrapRef.current && !languageWrapRef.current.contains(event.target as Node)) setLanguageMenu(false); }; const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setWalletMenu(false); setPolkadotWalletMenu(false); setAccountMenu(false); setLanguageMenu(false); feedback.notifications.filter((item) => !item.persistent).forEach((item) => feedback.dismiss(item.dedupeKey)); } }; document.addEventListener("pointerdown", onPointerDown); document.addEventListener("keydown", onKeyDown); return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); }; }, [feedback.dismiss, feedback.notifications, languageMenu, walletMenu]);
  const navigate = useCallback((nextRoute: AppRoute) => { setWalletMenu(false); const nextHash = hashForRoute(nextRoute); if (window.location.hash !== nextHash) window.location.hash = nextHash; else { setRoute(nextRoute); window.requestAnimationFrame(() => scrollToRoute(nextRoute)); } }, []);

  const calculateMax = useCallback(async (targetAccount: Address, nextDynamic: GenesisDynamic): Promise<bigint | null> => { const requestedKey = sessionKey; if (demoMode || session?.kind !== "evm" || !publicClient || !manifest || !staticState || !requestedKey) return null; const value = await safeMaxAmount(publicClient, { account: targetAccount, contract: manifest.source.contract, phase: nextDynamic.phase, firstContributionMinimum: staticState.firstContributionMinimum, subsequentContributionMinimumExclusive: staticState.subsequentContributionMinimumExclusive }); if (sessionKeyRef.current !== requestedKey) return null; setMaxAmount(value); return value; }, [demoMode, manifest, publicClient, session, sessionKey, staticState]);
  const calculateNativeMax = useCallback(async (nextDynamic: GenesisDynamic): Promise<bigint | null> => { const requestedKey = sessionKey; if (demoMode || session?.kind !== "polkadot" || !session.api || !nativeManifest || !staticState || !requestedKey) return null; const value = await estimateNativeMax(session.api, session.selectedAccountAddress, nativeManifest, nextDynamic.phase, staticState.firstContributionMinimum, staticState.subsequentContributionMinimumExclusive); if (sessionKeyRef.current !== requestedKey) return null; setNativeMaxAmount(value); return value; }, [demoMode, nativeManifest, session, sessionKey, staticState]);
  const presentGlobalError = useCallback((error: unknown) => { const message = error instanceof Error ? error.message : String(error); if ((typeof navigator !== "undefined" && !navigator.onLine) || /http request failed|failed to fetch|fetch|timeout|rpc|network|gateway|connection/i.test(message)) feedback.presentCode("RPC_UNAVAILABLE", context("load-global")); else feedback.presentError(error, context("load-global")); }, [context, feedback.presentCode, feedback.presentError]);
  const refreshDynamic = useCallback(async () => {
    if (demoMode || !publicClient || !manifest || dynamicRunning.current) return { status: "error" } as const;
    dynamicRunning.current = true;
    try {
      const next = await readGlobalDynamic(publicClient, manifest);
      setDynamicState(next);
      feedback.clearCode("RPC_UNAVAILABLE");
      feedback.clearCode("GLOBAL_DATA_UNAVAILABLE");
      return { status: "success" } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        feedback.presentCode("RPC_UNAVAILABLE", context("load-global"));
        return { status: "error" } as const;
      }
      if (isRateLimitError(error) || /429|Too Many Requests/i.test(message)) {
        feedback.presentCode("RPC_UNAVAILABLE", context("load-global"));
        return { status: "rate_limited", retryAfterMs: getRetryAfterMs(error) ?? 60_000 } as const;
      }
      presentGlobalError(error);
      return { status: "error" } as const;
    } finally {
      dynamicRunning.current = false;
    }
  }, [context, feedback.clearCode, feedback.presentCode, manifest, presentGlobalError, publicClient]);
  useEffect(() => { if (demoMode || !publicClient || !manifest) return; let disposed = false; void readGlobalStatic(publicClient, manifest).then((next) => { if (!disposed) setStaticState(next); }).catch((error) => { if (!disposed) presentGlobalError(error); }); return () => { disposed = true; }; }, [manifest, presentGlobalError, publicClient]);
  useEffect(() => {
    if (demoMode || !publicClient || !manifest) return;

    const controller = startVisiblePolling(async () => refreshDynamic());
    globalPollingRef.current = controller;

    return () => {
      controller();
      if (globalPollingRef.current === controller) {
        globalPollingRef.current = null;
      }
    };
  }, [manifest, publicClient, refreshDynamic]);
  useEffect(() => {
    if (demoMode) return;

    const handleOffline = () => feedback.presentCode("RPC_UNAVAILABLE", context("load-global"));

    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("offline", handleOffline);
    };
  }, [context, feedback.presentCode]);

  const loadUser = useCallback(async (targetAccount: Address, requestedKey: string) => { if (demoMode || !publicClient || !manifest) return; setUserStateStatus("loading"); try { const next = await readGenesisUserState(publicClient, manifest, targetAccount); if (sessionKeyRef.current !== requestedKey) return; setUser(next); setUserStateStatus("ready"); feedback.clearCode("USER_DATA_UNAVAILABLE"); } catch (error) { if (sessionKeyRef.current === requestedKey) { setUserStateStatus("error"); feedback.presentError(error, context("load-user")); } } }, [context, demoMode, feedback.clearCode, feedback.presentError, manifest, publicClient]);
  const loadHistory = useCallback(async (targetAccount: Address, requestedKey: string) => { if (demoMode || !publicClient || !manifest) return; setHistoryStatus("loading"); try { const finalized = await publicClient.request({ method: "eth_getBlockByNumber", params: ["finalized", false] } as any) as { number?: string } | null; if (finalized?.number) { const next = await readContributionHistory(publicClient, manifest, targetAccount, BigInt(finalized.number)); if (sessionKeyRef.current !== requestedKey) return; setHistory(next); setHistoryStatus("ready"); } feedback.clearCode("HISTORY_UNAVAILABLE"); } catch (error) { if (sessionKeyRef.current === requestedKey) { setHistoryStatus("error"); feedback.presentError(error, context("load-history")); } } }, [context, demoMode, feedback.clearCode, feedback.presentError, manifest, publicClient]);
  const clearUser = useCallback(() => { reconciliationRef.current?.abort(); setUser(demoMode ? demoUser : null); setHistory([]); setUserStateStatus(demoMode ? "ready" : "idle"); setHistoryStatus(demoMode ? "ready" : "idle"); setMaxAmount(demoMode ? demoGenesis.walletBalance : null); feedback.clearCode("USER_DATA_UNAVAILABLE"); feedback.clearCode("HISTORY_UNAVAILABLE"); }, [feedback.clearCode]);
  const maxRefreshKey = useRef<string | null>(null);
  useEffect(() => {
    if (demoMode) return;
    if (!session) {
      maxRefreshKey.current = null;
      clearUser();
      feedback.clearCode("WRONG_CHAIN");
      feedback.clearCode("CHAIN_SWITCH_REJECTED");
      return;
    }
    if (session.kind === "evm" && !correctChain) {
      maxRefreshKey.current = null;
      clearUser();
      feedback.presentCode("WRONG_CHAIN", context("switch-network", { networkName: manifest?.source.name }));
      return;
    }
    feedback.clearCode("WRONG_CHAIN");
    feedback.clearCode("CHAIN_SWITCH_REJECTED");
  }, [clearUser, context, correctChain, feedback.clearCode, feedback.presentCode, manifest, session, paymentReady]);
  useEffect(() => {
    if (!sessionKey || !paymentReady || !genesisIdentity || demoMode) return;
    if (route === "assets") {
      void loadUser(genesisIdentity, sessionKey);
      if (shouldLoadContributionHistory(session?.kind ?? null)) void loadHistory(genesisIdentity, sessionKey);
      return;
    }
    void loadUser(genesisIdentity, sessionKey);
  }, [demoMode, genesisIdentity, loadHistory, loadUser, paymentReady, route, session?.kind, sessionKey]);
  useEffect(() => {
    if (demoMode) return;
    maxRefreshKey.current = null;
    nativeMaxRefreshKey.current = null;
    setMaxAmount(null);
    setNativeMaxAmount(null);
  }, [demoMode, sessionKey]);
  useEffect(() => {
    if (session?.kind !== "evm" || !account || !dynamicState || !staticState || !sessionKey) return;
    const key = `${sessionKey}:${chainId}`;
    if (maxRefreshKey.current === key) return;
    maxRefreshKey.current = key;
    void calculateMax(account, dynamicState);
  }, [account, calculateMax, chainId, dynamicState, session, sessionKey, staticState]);
  useEffect(() => {
    if (session?.kind !== "polkadot" || !dynamicState || !staticState || !sessionKey) return;
    const key = [sessionKey, nativeManifest?.source.substrateGenesisHash, dynamicState.phase, session.balance, staticState.firstContributionMinimum, staticState.subsequentContributionMinimumExclusive].join(":");
    if (nativeMaxRefreshKey.current === key) return;
    nativeMaxRefreshKey.current = key;
    void calculateNativeMax(dynamicState);
  }, [calculateNativeMax, dynamicState?.phase, nativeManifest?.source.substrateGenesisHash, session?.balance, session?.kind, sessionKey, staticState?.firstContributionMinimum, staticState?.subsequentContributionMinimumExclusive]);
  const displayedEmittedMini = dynamicState?.emittedMini ?? 0n;
  const displayedProgress = staticState?.genesisAllocation ? Number(displayedEmittedMini * 10_000n / staticState.genesisAllocation) / 100 : 0;
  // Genesis emission continues through the protection phase. Contributions close at contributionBlocks / totalEmissionBlocks.
  const calculatedContributionBoundaryPercent = staticState?.totalEmissionBlocks && staticState.contributionBlocks
    ? contributionBoundaryPercent(staticState.contributionBlocks, staticState.totalEmissionBlocks)
    : null;
  const displayedContributionBoundaryPercent = calculatedContributionBoundaryPercent === null ? null : Math.max(0, Math.min(100, calculatedContributionBoundaryPercent));
  const progressMarkup = <GenesisProgress displayedProgress={displayedProgress} displayedEmittedMini={displayedEmittedMini} emittedLabel={`${formatAmount(displayedEmittedMini)} ${MINI_SYMBOL}`} totalLabel={`${formatAmount(staticState?.genesisAllocation)} ${MINI_SYMBOL}`} contributionBoundaryPercent={displayedContributionBoundaryPercent} protectionLabel={protectionPhaseLabel} protectionActive={dynamicState?.phaseName === "Protection"} />;
  const startPriceX18 = staticState && dynamicState ? calculateStartPriceX18({ totalRaisedDot: dynamicState.totalRaisedDot, lastSettledBlock: dynamicState.lastSettledBlock, startBlock: dynamicState.startBlock, genesisAllocation: staticState.genesisAllocation, totalEmissionBlocks: staticState.totalEmissionBlocks }) : null;
  const contributionBusy = ["validating", "checking_mapping", "mapping_required", "awaiting_mapping_signature", "mapping_submitted", "mapping_finalized", "verifying_mapping", "simulating", "awaiting_signature", "submitted", "included", "finalized", "verifying_event", "success", "demo_processing"].includes(contributionState);
  const submit = async () => {
    if (contributionBusy || !session) return;
    setAmountFeedback(null);
    feedback.clearOperation("submit-contribution");
    if (demoMode) { setContributionState("demo_processing"); window.setTimeout(() => { setContributionState("idle"); feedback.presentCode("TRANSACTION_INCLUDED", context("submit-contribution")); }, 700); return; }
    if (!amount || !manifest || !dynamicState || !staticState || !publicClient || !sessionKey) return;
    const minimum = dynamicState.phase === 0 ? staticState.firstContributionMinimum : staticState.subsequentContributionMinimumExclusive;
    const previousContributedDot = user?.contributedDot ?? 0n;
    try {
      const executionManifest = session.kind === "polkadot" ? nativeManifest : manifest;
      if (!executionManifest) throw new Error("CONFIGURATION_MISMATCH");
      const contextValue = { manifest: executionManifest, phase: dynamicState.phase, firstMinimum: staticState.firstContributionMinimum, subsequentExclusive: staticState.subsequentContributionMinimumExclusive, contractAddress: executionManifest.source.contract };
      const adapter = session.kind === "evm"
        ? createEvmExecutionAdapter(publicClient, walletClient(session.provider, manifest), manifest, session.address)
        : session.api && session.contractIdentity
          ? createSubstrateExecutionAdapter(session.api, session.accounts.find((accountItem) => accountItem.address === session.selectedAccountAddress)!.signer, session.selectedAccountAddress, executionManifest, session.contractIdentity)
          : null;
      if (!adapter) throw new Error(session.kind === "polkadot" ? "SUBSTRATE_RPC_UNAVAILABLE" : "EVM_SIGNER_UNAVAILABLE");
      if (session.kind === "evm" && !session.correctChain) await switchToGenesisChain();
      const result = await adapter.contribute(amount, contextValue, (update) => setContributionState(update.state));
      setAmount(""); setContributionState("idle");
      const txHash = result.evmTransactionHash ?? result.substrateTransactionHash;
      feedback.presentCode("TRANSACTION_INCLUDED", context("submit-contribution", { transactionHash: txHash, explorerUrl: manifest.source.explorerUrl }));
      const committedIdentity = session.kind === "polkadot" ? result.contributorH160 : session.address;
      if (session.kind === "polkadot") {
        void refreshNativeBalance();
        reconciliationRef.current?.abort();
        const controller = new AbortController();
        reconciliationRef.current = controller;
        void reconcileGenesisUserState({ client: publicClient, manifest, identity: committedIdentity, expectedContributedDot: previousContributedDot + result.amount.evmWei, signal: controller.signal }).then((next) => {
          if (!next || controller.signal.aborted || sessionKeyRef.current !== sessionKey) return;
          setUser(next); setUserStateStatus("ready");
        }).catch(() => { /* Transaction success is already finalized and event-verified; this only affects UI freshness. */ });
      } else void loadUser(committedIdentity, sessionKey);
      if (session.kind === "evm") { void Promise.allSettled([refreshDynamic(), calculateMax(session.address, dynamicState)]); void loadHistory(session.address, sessionKey); }
    } catch (error) {
      if (session.kind === "polkadot") void refreshNativeBalance();
      setContributionState("idle");
      const normalized = feedback.presentError(error, context("submit-contribution", { minimum: formatNative(minimum), explorerUrl: manifest.source.explorerUrl }));
      if (normalized.surface === "field") setAmountFeedback(normalized);
    }
  };
  const setAll = async () => { if (contributionBusy) return; try { const next = session?.kind === "polkadot" ? nativeMaxAmount ?? (dynamicState ? await calculateNativeMax(dynamicState) : null) : session?.kind === "evm" && account ? maxAmount ?? (dynamicState ? await calculateMax(account, dynamicState) : null) : null; if (next === null) { feedback.presentCode("MAX_AMOUNT_UNAVAILABLE", context("calculate-max")); return; } if (next === 0n) { const normalized = feedback.presentCode("INSUFFICIENT_BALANCE", context("calculate-max")); setAmountFeedback(normalized); return; } setAmount(formatNative(next)); setAmountFeedback(null); } catch (error) { feedback.presentError(error, context("calculate-max")); } };
  const onAmountChange = (next: string) => { setAmount(next); setAmountFeedback(null); };
  const stepAmount = (delta: number) => { if (!contributionBusy) onAmountChange(String(Math.max(0, Number(amount || 0) + delta))); };
  const selectedPolkadotAccount = session?.kind === "polkadot" ? session.accounts.find((accountItem) => accountItem.address === session.selectedAccountAddress) ?? null : null;
  const walletLabel = session ? session.kind === "polkadot" ? selectedPolkadotAccount?.name || shortHash(session.selectedAccountAddress) : shortHash(session.address) : walletStatus === "restoring" ? "Loading…" : text.connect;
  const selectedBalance = session?.kind === "polkadot" ? session.balance : session?.kind === "evm" ? session.balance : null;
  const selectedBalanceDecimals = session?.kind === "polkadot" ? (manifest?.source.nativeDecimals ?? 10) : (manifest?.source.evmNativeDecimals ?? 18);
  const selectedSourceAddress = selectedAccountAddress ?? (demoMode ? DEMO_ACCOUNT : "");
  const handleFeedbackAction = (item: NormalizedFeedback) => { if (item.action === "connect-wallet") setWalletMenu(true); else if (item.action === "switch-network" && manifest) void switchToGenesisChain().then(() => feedback.clearCode("WRONG_CHAIN")).catch((error) => feedback.presentError(error, context("switch-network", { networkName: manifest.source.name }))); else if (item.action === "retry-global-data") { const controller = globalPollingRef.current; if (controller) { controller.retryNow(); } else { void refreshDynamic(); } } else if (item.action === "view-transaction" && item.transactionHash && item.explorerUrl) window.open(`${item.explorerUrl.replace(/\/$/, "")}/tx/${item.transactionHash}`, "_blank", "noopener,noreferrer"); };
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
  const header = <header className="site-header"><nav className="nav"><a className="brand" href="#/" onClick={(event) => { event.preventDefault(); navigate("genesis"); }} aria-label="MINI Home"><span className="brand-mark">M</span><span className="brand-word">MINI</span></a><div className="nav-center"><a className={`nav-link ${route === "genesis" ? "active" : ""}`} href="#/" onClick={(event) => { event.preventDefault(); navigate("genesis"); }}>{icons.rocket}{text.genesis}</a><a className={`nav-link ${route === "rules" ? "active" : ""}`} href="#/rules" onClick={(event) => { event.preventDefault(); navigate("rules"); }}>{icons.book}{text.rules}</a></div><div className="nav-actions"><div className="language-wrap" ref={languageWrapRef}><button className="language-button" type="button" aria-label={text.language} aria-haspopup="listbox" aria-expanded={languageMenu} onClick={() => setLanguageMenu((value) => !value)}>{icons.globe}{icons.chevron}</button>{languageMenu && <div className="wallet-menu language-menu open" role="listbox" aria-label={text.language}>{([["zh-CN", "中文"], ["en", "EN"]] as const).map(([value, label]) => <button key={value} type="button" role="option" aria-selected={language === value} className={language === value ? "selected" : ""} onClick={() => { setLanguage(value); setLanguageMenu(false); }}>{icons.globe}{label}{language === value && <span className="check">✓</span>}</button>)}</div>}</div><button className="utility-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Switch appearance"><span className="utility-icon">{theme === "dark" ? "☀" : "☾"}</span></button><div className="wallet-wrap" ref={walletWrapRef}><button className="wallet-button" type="button" disabled={walletStatus === "restoring"} onClick={() => setWalletMenu((value) => !value)}><span className="wallet-dot" hidden={!session} />{!session && icons.wallet}<span className="wallet-label">{walletLabel}</span>{session && icons.chevron}</button>{walletMenu && <div className="wallet-menu open">{!session && !polkadotWalletMenu && <><button type="button" onClick={() => { setWalletMenu(false); connectEvm(); }}>{icons.evm}{text.evmWallet}</button><button type="button" onClick={() => { if (!availablePolkadotWallets.length) { void connectPolkadot().catch((error) => feedback.presentError(error, context("connect-wallet"))); } else if (availablePolkadotWallets.length === 1) { void connectPolkadot(availablePolkadotWallets[0].extensionId).then(() => setWalletMenu(false)).catch((error) => feedback.presentError(error, context("connect-wallet"))); } else setPolkadotWalletMenu(true); }}>{icons.polkadot}{text.polkadotWallet}</button></>}{!session && polkadotWalletMenu && <><button type="button" onClick={() => setPolkadotWalletMenu(false)}>← {text.back}</button>{availablePolkadotWallets.map((wallet) => <button key={wallet.extensionId} type="button" onClick={() => void connectPolkadot(wallet.extensionId).then(() => { setWalletMenu(false); setPolkadotWalletMenu(false); }).catch((error) => feedback.presentError(error, context("connect-wallet")))}>{wallet.displayName}</button>)}</>}{session && !accountMenu && <><button type="button" onClick={() => navigate("assets")}>{icons.wallet}{text.myAssets}</button><button type="button" onClick={() => void copySelectedAddress()}>{icons.copy}{language === "zh-CN" ? "复制地址" : "Copy address"}</button><button type="button" onClick={() => { if (session.kind === "evm") { setWalletMenu(false); openAccount(); } else setAccountMenu(true); }}>{icons.switchAccount}{text.switchAccount}</button><button type="button" className="danger" onClick={disconnect}>{icons.disconnect}{text.disconnect}</button></>}{session?.kind === "polkadot" && accountMenu && <><button type="button" onClick={() => setAccountMenu(false)}>← {text.back}</button>{session.accounts.map((accountItem) => <button key={accountItem.address} type="button" className={accountItem.address === session.selectedAccountAddress ? "selected" : ""} onClick={() => { selectPolkadotAccount(accountItem.address); setWalletMenu(false); setAccountMenu(false); }}><span className="account-menu-name">{accountItem.name || (language === "zh-CN" ? "未命名账户" : "Unnamed account")}</span><span className="account-menu-address">{shortHash(accountItem.address)}</span></button>)}</>}</div>}</div></div></nav></header>;
  const footer = <footer><span>{demoMode ? text.demo : account ? text.confirmed : ""}</span><nav className="footer-links" aria-label="External links"><a href="https://docs.minijam.xyz/" target="_blank" rel="noreferrer">{language === "zh-CN" ? "文档" : "Docs"}</a><a href="https://minijam.xyz/" target="_blank" rel="noreferrer">MiniJAM</a><a href="https://x.com/archelabs_org" target="_blank" rel="noreferrer">X</a></nav></footer>;
  const historyItems = demoMode ? [{ amount: 100n * 10n ** 18n, blockNumber: 1_000_072n, transactionHash: "0x9a7f0000000000000000000000000000000031c8" as `0x${string}`, logIndex: 0 }, { amount: 220n * 10n ** 18n, blockNumber: 1_000_041n, transactionHash: "0xf42100000000000000000000000000000000bc09" as `0x${string}`, logIndex: 0 }] : history;
  const isNativeAssets = session?.kind === "polkadot";
  const nativeAssets = nativeAssetSummary(user);
  const miniAssetCard = <article className="asset-card mini-asset"><span className="label">{text.mini}</span><div className="asset-value">{demoMode ? "12,480.00" : user ? formatAmount(user.pendingMini) : userStateStatus === "loading" || userStateStatus === "idle" ? "Loading…" : "—"}</div><div className="asset-note">{miniTradingNote}</div></article>;
  const ecosystemAssetCard = <article className="asset-card unavailable-asset"><span className="label">{text.vmini}</span><div className="asset-value">—</div><div className="asset-note">{text.unavailableNote}</div><button className="claim-button" type="button" disabled>Claim</button></article>;
  const contributedAssetCard = <article className="asset-card contributed-asset"><span className="label">{text.contributed}</span><div className="asset-value">{nativeAssets.contributedDot == null && (userStateStatus === "loading" || userStateStatus === "idle") ? "Loading…" : `${formatAmount(nativeAssets.contributedDot)} ${nativeSymbol}`}</div></article>;
  const assetsPage = <main className="assets-page"><div className="assets-heading"><span className="section-index">{text.account}</span><h1>{text.mine}</h1><p className="my-address">{shortHash(selectedSourceAddress)}</p></div>{!session && !demoMode ? <section className="assets-empty"><p>{text.assetsEmpty}</p><button className="submit-button" type="button" onClick={() => setWalletMenu(true)}>{text.connect}</button></section> : session && !paymentReady && !demoMode ? <section className="assets-empty"><p>Loading…</p></section> : <><div className={`my-grid ${isNativeAssets ? "native-assets-grid" : ""}`}>{miniAssetCard}{isNativeAssets ? <>{ecosystemAssetCard}{contributedAssetCard}</> : ecosystemAssetCard}</div>{!isNativeAssets && <article className="history-card"><div className="history-head"><strong>{text.history}</strong><span>{text.status}</span><span>{nativeSymbol}</span><span>Block</span></div>{historyItems.length ? historyItems.map((item) => <div className="tx-row" key={`${item.transactionHash}-${item.logIndex}`}><div><div className="tx-type">{text.contribution.replace("DOT", nativeSymbol)}</div><div className="tx-time">{shortHash(item.transactionHash)}</div></div><div className="tx-amount">{formatAmount(item.amount)} {nativeSymbol}</div><div className="tx-status">{text.confirmed}</div><div className="tx-block">#{item.blockNumber.toString()}</div></div>) : historyStatus === "loading" || historyStatus === "idle" ? <div className="empty-history">Loading…</div> : <div className="empty-history">{text.noHistory}</div>}</article>}</>}</main>;
  const initialWalletLoading = !demoMode && !paymentReady && walletStatus !== "disconnected";
  const genesisPage = <main><section className="hero" id="genesis"><div className="genesis-card"><div className="demo-badge" hidden={!demoMode}>{text.demo}</div><h1 className="pool-title">{text.pool}</h1><div className="status-row"><div><span className="label">{text.startPrice}</span><div className="price"><Price value={startPriceX18} /><span className="price-unit">{nativeSymbol} / {MINI_SYMBOL}</span></div></div>{progressMarkup}</div><div className="input-panel"><div className="input-top"><span>{text.contribution.replace("DOT", nativeSymbol)}</span>{(paymentReady || demoMode) && <span>{text.balance} <span className="balance-value">{`${formatDotBalance(demoMode ? demoGenesis.walletBalance : selectedBalance, selectedBalanceDecimals)} ${nativeSymbol}`}</span>{(session?.kind === "evm" || nativeMaxAmount !== null) && <><span> · </span><button className="all-button" type="button" disabled={contributionBusy} onClick={() => void setAll()}>{text.all}</button></>}</span>}{initialWalletLoading && <span>{text.balance} <span className="balance-value">Loading…</span></span>}</div><div className={`amount-control ${amountFeedback ? "has-error" : ""}`}><button className="step-button" type="button" disabled={contributionBusy || initialWalletLoading} onClick={() => stepAmount(-1)} aria-label={`Decrease 1 ${nativeSymbol}`}>−</button><input className="amount-field" disabled={contributionBusy || initialWalletLoading} value={amount} onChange={(event) => onAmountChange(event.target.value)} inputMode="decimal" placeholder="0" aria-label={`${nativeSymbol} amount`} aria-invalid={Boolean(amountFeedback)} /><button className="step-button" type="button" disabled={contributionBusy || initialWalletLoading} onClick={() => stepAmount(1)} aria-label={`Increase 1 ${nativeSymbol}`}>+</button></div><FieldFeedback feedback={amountFeedback} /><div className="quick-row"><button className="quick-button" type="button" disabled={contributionBusy || initialWalletLoading} onClick={() => stepAmount(10)}>+10 {nativeSymbol}</button><button className="quick-button" type="button" disabled={contributionBusy || initialWalletLoading} onClick={() => stepAmount(100)}>+100 {nativeSymbol}</button></div><button className={`submit-button ${contributionBusy || initialWalletLoading ? "loading" : ""}`} type="button" onClick={() => void (paymentReady || demoMode ? submit() : setWalletMenu(true))} disabled={contributionBusy || initialWalletLoading}>{(contributionBusy || initialWalletLoading) && <span className="button-spinner" aria-hidden="true" />}<span>{contributionBusy ? stateLabel(contributionState, text) : initialWalletLoading ? "Loading…" : paymentReady || demoMode ? text.join : text.connectAction}</span></button></div></div></section>{SHOW_GENESIS_STATS && <section className="stats-strip"><div><span>{text.phase}</span><strong>{dynamicState ? phaseLabel(dynamicState.phase, text) : "—"}</strong></div><div><span>{text.raised}</span><strong>{dynamicState ? `${formatAmount(dynamicState.totalRaisedDot)} ${nativeSymbol}` : "—"}</strong></div><div><span>{text.contributors}</span><strong>{dynamicState?.contributorCount.toLocaleString() ?? "—"}</strong></div></section>}<section className="section" id="rules"><div className="rule-list">{text.ruleTitles.map((title, index) => <article className={`rule-item ${openRule === index ? "open" : ""}`} key={title}><button className="rule-summary" type="button" aria-expanded={openRule === index} onClick={() => setOpenRule(openRule === index ? null : index)}><span className="rule-num">{String(index + 1).padStart(2, "0")}</span><span className="rule-title">{title}</span><span className="rule-desc">{text.ruleDescs[index].replaceAll("DOT", nativeSymbol)}</span><span className="rule-arrow">＋</span></button><div className="rule-detail"><div className="rule-detail-inner"><div className="rule-detail-content">{text.ruleDetails[index].replaceAll("DOT", nativeSymbol)}</div></div></div></article>)}</div></section>{footer}</main>;
  const smokePage = NATIVE_SMOKE_ENABLED ? <NativeSignerSmoke manifest={manifest} session={session} availablePolkadotWallets={availablePolkadotWallets} connectPolkadot={connectPolkadot} /> : null;
  return <><NotificationCenter items={feedback.notifications.filter((item) => route === "assets" || item.code !== "HISTORY_UNAVAILABLE")} onDismiss={feedback.dismiss} onAction={handleFeedbackAction} /><SystemBanner items={feedback.banners} onAction={handleFeedbackAction} />{header}{route === "native-signer-smoke" ? smokePage : route === "assets" ? assetsPage : genesisPage}</>;
}

createRoot(document.getElementById("root")!).render(<GenesisWalletProvider><App /></GenesisWalletProvider>);

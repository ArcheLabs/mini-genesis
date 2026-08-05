import type { FeedbackCode } from "./codes";
import type { FeedbackParams } from "./types";

export type FeedbackCopy = { title: string; message: string; actionLabel?: string };
const minimumText = (params: FeedbackParams) => params.minimum ?? "—";
const networkText = (params: FeedbackParams) => params.networkName ?? "the configured network";
const catalog: Record<FeedbackCode, { zh: FeedbackCopy; en: FeedbackCopy }> = {
  INVALID_AMOUNT: { zh: { title: "金额格式不正确", message: "请输入大于 0 的数字，最多支持 18 位小数。" }, en: { title: "Invalid amount", message: "Enter a number greater than zero with no more than 18 decimal places." } },
  FIRST_CONTRIBUTION_TOO_SMALL: { zh: { title: "未达到首笔投入要求", message: "首笔投入至少需要 {minimum} DOT。" }, en: { title: "Below the initial minimum", message: "The first contribution must be at least {minimum} DOT." } },
  CONTRIBUTION_TOO_SMALL: { zh: { title: "投入金额过低", message: "本次投入必须大于 {minimum} DOT。" }, en: { title: "Amount is too small", message: "This contribution must be greater than {minimum} DOT." } },
  CONTRIBUTION_CLOSED: { zh: { title: "当前阶段已结束", message: "Genesis 当前阶段已经停止接受新的投入。" }, en: { title: "Contributions are closed", message: "The current Genesis phase no longer accepts contributions." } },
  INSUFFICIENT_BALANCE: { zh: { title: "余额不足", message: "当前余额不足以支付投入金额和网络费用，请减少投入金额。" }, en: { title: "Insufficient balance", message: "Your balance cannot cover both the contribution and the network fee. Reduce the amount and try again." } },
  MAX_AMOUNT_UNAVAILABLE: { zh: { title: "无法计算最大金额", message: "当前无法估算网络费用，请稍后重试或手动输入较小金额。" }, en: { title: "Maximum amount unavailable", message: "The network fee could not be estimated. Try again or enter a smaller amount manually." } },
  BROWSER_WALLET_UNAVAILABLE: { zh: { title: "未检测到钱包", message: "请使用支持 EVM 钱包的浏览器，或安装兼容的钱包扩展。", actionLabel: "连接钱包" }, en: { title: "Wallet not detected", message: "Open this page in a browser with a compatible EVM wallet.", actionLabel: "Connect wallet" } },
  WALLET_CONNECTION_REJECTED: { zh: { title: "未连接钱包", message: "钱包连接请求已取消，未发生任何资产操作。" }, en: { title: "Wallet not connected", message: "The connection request was cancelled. No assets were affected." } },
  CHAIN_SWITCH_REJECTED: { zh: { title: "未切换网络", message: "请在钱包中切换到 {networkName} 后重试。", actionLabel: "切换网络" }, en: { title: "Network was not changed", message: "Switch your wallet to {networkName} and try again.", actionLabel: "Switch network" } },
  USER_REJECTED_TRANSACTION: { zh: { title: "交易已取消", message: "你在钱包中取消了本次操作，资产没有发生变化。" }, en: { title: "Transaction cancelled", message: "You cancelled the request in your wallet. No assets were changed." } },
  WALLET_RESTORE_FAILED: { zh: { title: "无法恢复钱包连接", message: "请重新点击连接钱包。" }, en: { title: "Wallet session not restored", message: "Connect your wallet again." } },
  WRONG_CHAIN: { zh: { title: "当前网络不正确", message: "请将钱包切换到 {networkName}。", actionLabel: "切换网络" }, en: { title: "Wrong network", message: "Switch your wallet to {networkName}.", actionLabel: "Switch network" } },
  RPC_UNAVAILABLE: { zh: { title: "网络暂时不可用", message: "当前无法读取链上数据，页面会自动重试。" }, en: { title: "Network temporarily unavailable", message: "Chain data cannot be loaded right now. The page will retry automatically." } },
  GLOBAL_DATA_UNAVAILABLE: { zh: { title: "无法更新 Genesis 数据", message: "页面暂时无法同步最新状态，将继续自动重试。" }, en: { title: "Genesis data unavailable", message: "The latest Genesis state could not be loaded. The page will keep retrying." } },
  USER_DATA_UNAVAILABLE: { zh: { title: "无法更新账户数据", message: "当前无法读取账户余额或资产，请稍后重试。" }, en: { title: "Account data unavailable", message: "Your balance or asset data could not be loaded. Try again shortly." } },
  HISTORY_UNAVAILABLE: { zh: { title: "无法加载交易记录", message: "交易历史暂时不可用，你的链上资产不会受到影响。" }, en: { title: "History unavailable", message: "Transaction history cannot be loaded right now. Your on-chain assets are not affected." } },
  TRANSACTION_REVERTED: { zh: { title: "交易未成功", message: "合约拒绝了本次交易，请检查投入阶段、金额和余额后重试。" }, en: { title: "Transaction failed", message: "The contract rejected the transaction. Check the phase, amount, and balance before retrying." } },
  TRANSACTION_RECEIPT_UNAVAILABLE: { zh: { title: "暂时无法确认交易", message: "已提交交易，但暂时无法获取链上回执，请通过区块浏览器查看。" }, en: { title: "Transaction status unavailable", message: "The transaction was submitted, but its receipt is not available yet. Check the block explorer." } },
  CONTRIBUTED_EVENT_MISMATCH: { zh: { title: "交易结果无法确认", message: "交易已有回执，但未找到预期的投入记录，请通过区块浏览器检查。" }, en: { title: "Transaction result could not be verified", message: "A receipt was found, but the expected contribution event was missing. Check the block explorer." } },
  TRANSACTION_INCLUDED: { zh: { title: "交易已上链", message: "你的投入已经成功写入区块，页面数据可能需要几秒更新。" }, en: { title: "Transaction included", message: "Your contribution was successfully included in a block. The page may take a few seconds to update." } },
  TEMPLATE_MANIFEST_NOT_RUNTIME_READY: { zh: { title: "当前页面尚未配置", message: "当前前端版本没有可用的链上部署配置。" }, en: { title: "Frontend is not configured", message: "This frontend build does not contain an active on-chain deployment." } },
  CONFIGURATION_MISMATCH: { zh: { title: "页面配置不匹配", message: "当前页面配置与链上合约不一致，请刷新页面或联系维护者。" }, en: { title: "Configuration mismatch", message: "The frontend configuration does not match the deployed contract." } },
  OPERATION_CANCELLED: { zh: { title: "", message: "" }, en: { title: "", message: "" } },
  UNKNOWN_ERROR: { zh: { title: "操作未完成", message: "发生了暂时无法识别的问题，请稍后重试。" }, en: { title: "Operation not completed", message: "An unexpected problem occurred. Try again shortly." } },
};

export function feedbackCopy(code: FeedbackCode, locale: "zh-CN" | "en", params: FeedbackParams = {}): FeedbackCopy {
  const item = catalog[code] ?? catalog.UNKNOWN_ERROR;
  const copy = item[locale === "zh-CN" ? "zh" : "en"];
  return {
    ...copy,
    message: copy.message.replace(/\{minimum\}/g, minimumText(params)).replace(/\{networkName\}/g, networkText(params)),
  };
}

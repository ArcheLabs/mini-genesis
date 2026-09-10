import type { FeedbackCode } from "./codes";
import { feedbackCopy } from "./catalog";
import type { FeedbackContext, FeedbackKind, FeedbackParams, FeedbackSurface, NormalizedFeedback } from "./types";

export class AppError extends Error {
  constructor(public readonly code: FeedbackCode, public readonly params: FeedbackParams = {}, options?: ErrorOptions) { super(code, options); this.name = "AppError"; }
}
const fieldCodes = new Set<FeedbackCode>(["INVALID_AMOUNT", "FIRST_CONTRIBUTION_TOO_SMALL", "CONTRIBUTION_TOO_SMALL", "INSUFFICIENT_BALANCE"]);
const bannerCodes = new Set<FeedbackCode>(["BROWSER_WALLET_UNAVAILABLE", "WRONG_CHAIN", "RPC_UNAVAILABLE", "GLOBAL_DATA_UNAVAILABLE", "TEMPLATE_MANIFEST_NOT_RUNTIME_READY", "CONFIGURATION_MISMATCH"]);
const persistentCodes = new Set<FeedbackCode>(["WRONG_CHAIN", "RPC_UNAVAILABLE", "GLOBAL_DATA_UNAVAILABLE", "TEMPLATE_MANIFEST_NOT_RUNTIME_READY", "CONFIGURATION_MISMATCH"]);
export function feedbackSurface(code: FeedbackCode): FeedbackSurface { return code === "OPERATION_CANCELLED" ? "silent" : fieldCodes.has(code) ? "field" : bannerCodes.has(code) ? "banner" : "notification"; }
function codeFromUnknown(error: unknown, context: FeedbackContext): FeedbackCode {
  if (error instanceof AppError) return error.code;
  if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    const objectCode = (error as { code: string }).code;
    if (objectCode === "INVALID_AMOUNT" || objectCode === "FIRST_CONTRIBUTION_TOO_SMALL" || objectCode === "CONTRIBUTION_TOO_SMALL" || objectCode === "CONTRIBUTION_CLOSED") return objectCode;
  }
  const candidate = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  const providerCode = typeof error === "object" && error !== null && "code" in error ? Number((error as { code?: unknown }).code) : Number.NaN;
  if (providerCode === 4001) return context.operation === "connect-wallet" ? "WALLET_CONNECTION_REJECTED" : context.operation === "switch-network" ? "CHAIN_SWITCH_REJECTED" : "USER_REJECTED_TRANSACTION";
  if (["NATIVE_SIGNING_REJECTED", "NATIVE_NETWORK_MISMATCH", "NATIVE_RUNTIME_INCOMPATIBLE"].includes(candidate)) return candidate as FeedbackCode;
  if (candidate === "ADDRESS_COPIED") return candidate;
  const known: FeedbackCode[] = ["INVALID_AMOUNT", "FIRST_CONTRIBUTION_TOO_SMALL", "CONTRIBUTION_TOO_SMALL", "CONTRIBUTION_CLOSED", "INSUFFICIENT_BALANCE", "MAX_AMOUNT_UNAVAILABLE", "BROWSER_WALLET_UNAVAILABLE", "WALLET_CONNECTION_REJECTED", "CHAIN_SWITCH_REJECTED", "USER_REJECTED_TRANSACTION", "WALLET_RESTORE_FAILED", "WRONG_CHAIN", "RPC_UNAVAILABLE", "GLOBAL_DATA_UNAVAILABLE", "USER_DATA_UNAVAILABLE", "HISTORY_UNAVAILABLE", "TRANSACTION_REVERTED", "TRANSACTION_RECEIPT_UNAVAILABLE", "CONTRIBUTED_EVENT_MISMATCH", "TRANSACTION_INCLUDED", "TEMPLATE_MANIFEST_NOT_RUNTIME_READY", "CONFIGURATION_MISMATCH", "ACCOUNT_MAPPING_REQUIRED", "ACCOUNT_MAPPING_FAILED", "ACCOUNT_MAPPING_CONFLICT", "ACCOUNT_MAPPING_VERIFICATION_FAILED", "USER_REJECTED_MAPPING", "ACCOUNT_ADDRESS_RESOLUTION_FAILED", "ACCOUNT_ADDRESS_MAPPING_MISMATCH", "SUBSTRATE_RPC_UNAVAILABLE", "SUBSTRATE_WALLET_NOT_FOUND", "SUBSTRATE_ACCOUNT_NOT_SELECTED", "NATIVE_INSUFFICIENT_BALANCE", "NATIVE_FEE_ESTIMATE_UNAVAILABLE", "NATIVE_SIGNER_UNAVAILABLE", "NATIVE_SIGNING_FAILED", "NATIVE_SUBMISSION_FAILED", "REVIVE_DRY_RUN_FAILED", "REVIVE_WEIGHT_LIMIT", "REVIVE_STORAGE_DEPOSIT_LIMIT", "REVIVE_CONTRACT_REVERTED", "DECIMAL_PRECISION_LOSS", "OPERATION_CANCELLED"];
  if (known.includes(candidate as FeedbackCode)) return candidate as FeedbackCode;
  if (context.operation === "load-history") return "HISTORY_UNAVAILABLE";
  if (context.operation === "load-user" || context.operation === "calculate-max") return "USER_DATA_UNAVAILABLE";
  if (context.operation === "load-global") return "GLOBAL_DATA_UNAVAILABLE";
  if (/reject|denied|user/i.test(candidate)) return context.operation === "connect-wallet" ? "WALLET_CONNECTION_REJECTED" : context.operation === "switch-network" ? "CHAIN_SWITCH_REJECTED" : "USER_REJECTED_TRANSACTION";
  if (/network|rpc|fetch|timeout|gateway|connection|execution/i.test(candidate)) return "RPC_UNAVAILABLE";
  return "UNKNOWN_ERROR";
}
export function normalizeFeedback(error: unknown, context: FeedbackContext): NormalizedFeedback {
  const code = codeFromUnknown(error, context);
  const params = { ...(context.params ?? {}), ...(error instanceof AppError ? error.params : {}) };
  const copy = feedbackCopy(code, context.locale, params);
  const surface = feedbackSurface(code);
  const kind: FeedbackKind = code === "TRANSACTION_INCLUDED" || code === "ADDRESS_COPIED" ? "success" : code === "WALLET_CONNECTION_REJECTED" || code === "USER_REJECTED_TRANSACTION" ? "info" : code === "CONTRIBUTION_CLOSED" || code === "MAX_AMOUNT_UNAVAILABLE" || surface === "banner" ? "warning" : "error";
  const transactionHash = params.transactionHash;
  const dedupeKey = transactionHash && code === "TRANSACTION_INCLUDED" ? `transaction:${transactionHash}` : `${context.operation}:${code}`;
  const action = code === "WRONG_CHAIN" || code === "CHAIN_SWITCH_REJECTED" ? "switch-network" : code === "BROWSER_WALLET_UNAVAILABLE" ? "connect-wallet" : code === "RPC_UNAVAILABLE" || code === "GLOBAL_DATA_UNAVAILABLE" ? "retry-global-data" : code === "TRANSACTION_INCLUDED" && params.explorerUrl ? "view-transaction" : undefined;
  const actionLabel = action === "switch-network" ? (context.locale === "zh-CN" ? "切换网络" : "Switch network") : action === "connect-wallet" ? (context.locale === "zh-CN" ? "连接钱包" : "Connect wallet") : action === "retry-global-data" ? (context.locale === "zh-CN" ? "重试" : "Retry") : action === "view-transaction" ? (context.locale === "zh-CN" ? "查看交易" : "View transaction") : undefined;
  return { code, kind, surface, title: copy.title, message: copy.message, action, actionLabel, transactionHash, explorerUrl: params.explorerUrl, persistent: persistentCodes.has(code), autoDismissMs: persistentCodes.has(code) || surface === "silent" ? undefined : kind === "success" ? 5_000 : kind === "info" ? 4_000 : kind === "warning" ? 7_000 : 8_000, dedupeKey };
}

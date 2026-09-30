const preservedCodes = new Set([
  "WRONG_CHAIN", "USER_REJECTED_TRANSACTION", "INSUFFICIENT_BALANCE", "TRANSACTION_REVERTED",
  "RPC_UNAVAILABLE", "TRANSACTION_RECEIPT_UNAVAILABLE", "PURCHASED_EVENT_MISMATCH",
  "CONFIGURATION_MISMATCH", "NATIVE_INSUFFICIENT_BALANCE", "NATIVE_FEE_ESTIMATE_UNAVAILABLE",
  "NATIVE_SIGNER_UNAVAILABLE", "NATIVE_SIGNING_REJECTED", "NATIVE_NETWORK_MISMATCH",
  "NATIVE_RUNTIME_INCOMPATIBLE", "NATIVE_SUBMISSION_FAILED", "REVIVE_DRY_RUN_FAILED",
  "NATIVE_RUNTIME_PROFILE_MISMATCH", "NATIVE_RUNTIME_PROFILE_INCOMPLETE", "NATIVE_WALLET_RUNTIME_UNSUPPORTED",
  "NATIVE_TRANSACTION_BUILD_FAILED", "NATIVE_CONTRACT_REVERTED", "NATIVE_EVENT_RECONCILIATION_FAILED",
  "REVIVE_WEIGHT_LIMIT", "REVIVE_STORAGE_DEPOSIT_LIMIT", "REVIVE_CONTRACT_REVERTED",
  "ACCOUNT_ADDRESS_RESOLUTION_FAILED", "ACCOUNT_ADDRESS_MAPPING_MISMATCH", "SUBSTRATE_ACCOUNT_NOT_SELECTED",
  "ACCOUNT_UNMAPPED", "ACCOUNT_MAPPING_CONFLICT", "ACCOUNT_MAPPING_FAILED",
]);

export type NativePurchaseStage =
  | "runtime-check"
  | "address-resolution"
  | "balance-check"
  | "dry-run"
  | "tx-build"
  | "fee-estimation"
  | "account-mapping"
  | "wallet-signing"
  | "submission"
  | "finality"
  | "event-reconciliation";

export class NativePurchaseFailure extends Error {
  constructor(
    public readonly code: string,
    public readonly transactionStage: NativePurchaseStage,
    public readonly wallet: string,
    public readonly runtimeProfile: string,
    public readonly transactionCall: string,
    cause: unknown,
  ) {
    super(code, { cause });
    this.name = "NativePurchaseFailure";
  }
}

export function shouldLogPurchaseDiagnostics(environment: string, development: boolean): boolean {
  return development || environment === "local" || environment === "staging";
}

function nestedErrors(error: unknown): unknown[] {
  const result: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    result.push(current);
    current = typeof current === "object" && current !== null && "cause" in current
      ? (current as { cause?: unknown }).cause
      : undefined;
  }
  return result;
}

function textOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return "";
  const value = error as { message?: unknown; shortMessage?: unknown };
  return [value.message, value.shortMessage].filter((item): item is string => typeof item === "string").join(" ");
}

export function normalizePurchaseError(error: unknown): string {
  const sources = nestedErrors(error);
  const providerCode = sources.find((item) => typeof item === "object" && item !== null && "code" in item) as { code?: unknown } | undefined;
  if (Number(providerCode?.code) === 4001) return "USER_REJECTED_TRANSACTION";

  for (const source of sources) {
    const candidate = textOf(source).trim();
    if (preservedCodes.has(candidate)) return candidate;
    if (source && typeof source === "object" && "code" in source) {
      const code = String((source as { code?: unknown }).code);
      if (preservedCodes.has(code)) return code;
    }
  }

  const text = sources.map(textOf).join(" ").toLowerCase();
  if (/insufficient funds|insufficient balance|exceeds (the )?balance|not enough funds/.test(text)) return "INSUFFICIENT_BALANCE";
  if (/revert|contract function .* failed|custom error|execution error|execution reverted/.test(text)) return "TRANSACTION_REVERTED";
  if (/failed to fetch|fetch failed|network request failed|connection refused|econnrefused|timed? ?out|timeout|gateway|http request failed|\b50[234]\b|socket error|network unavailable|rpc unavailable/.test(text)) return "RPC_UNAVAILABLE";
  return "UNKNOWN_ERROR";
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/\b(?:0x)?[a-f\d]{64,}\b/gi, "[REDACTED_HEX]")
    .replace(/\b(private key|seed phrase|recovery phrase|mnemonic|secret)\b\s*[:=]\s*[^\n,;]*/gi, "$1=[REDACTED]")
    .slice(0, 500);
}

function errorSummary(error: unknown): { name?: string; message: string; code?: string | number } {
  if (typeof error === "string") return { message: safeText(error) ?? "" };
  if (!error || typeof error !== "object") return { message: safeText(String(error)) ?? "" };
  const value = error as { name?: unknown; message?: unknown; shortMessage?: unknown; type?: unknown; code?: unknown; constructor?: { name?: unknown } };
  const name = typeof value.name === "string" ? value.name : typeof value.constructor?.name === "string" ? value.constructor.name : undefined;
  const message = [value.message, value.shortMessage, value.type].find((item): item is string => typeof item === "string") ?? "[error without message]";
  const code = typeof value.code === "string" || typeof value.code === "number" ? value.code : undefined;
  return { name, message: safeText(message) ?? "", code: typeof code === "string" ? safeText(code) : code };
}

function causeChain(error: unknown): Array<{ name?: string; message: string; code?: string | number }> {
  const causes: Array<{ name?: string; message: string; code?: string | number }> = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current !== undefined && current !== null && !seen.has(current) && causes.length < 5) {
    seen.add(current);
    causes.push(errorSummary(current));
    current = typeof current === "object" && "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return causes;
}

export function purchaseErrorDiagnostics(error: unknown, context: { wallet?: string; runtimeProfile?: string } = {}) {
  const first = error && typeof error === "object" ? error as { name?: unknown; message?: unknown; shortMessage?: unknown; cause?: unknown } : {};
  const nativeFailure = error instanceof NativePurchaseFailure ? error : null;
  const chain = causeChain(error);
  const outer = chain[0];
  const raw = chain.at(-1);
  return {
    stage: "phase2-purchase",
    code: normalizePurchaseError(error),
    name: raw?.name ?? outer?.name ?? (typeof first.name === "string" ? first.name : undefined),
    wrapperName: outer?.name,
    message: raw?.message ?? outer?.message ?? "[error without message]",
    rawErrorClass: raw?.name,
    shortMessage: safeText(typeof first.shortMessage === "string" ? first.shortMessage : undefined),
    cause: chain.slice(1),
    wallet: safeText(nativeFailure?.wallet ?? context.wallet),
    runtimeProfile: safeText(nativeFailure?.runtimeProfile ?? context.runtimeProfile),
    transactionCall: safeText(nativeFailure?.transactionCall),
    transactionStage: nativeFailure?.transactionStage,
  };
}

const preservedCodes = new Set([
  "WRONG_CHAIN", "USER_REJECTED_TRANSACTION", "INSUFFICIENT_BALANCE", "TRANSACTION_REVERTED",
  "RPC_UNAVAILABLE", "TRANSACTION_RECEIPT_UNAVAILABLE", "PURCHASED_EVENT_MISMATCH",
  "CONFIGURATION_MISMATCH", "NATIVE_INSUFFICIENT_BALANCE", "NATIVE_FEE_ESTIMATE_UNAVAILABLE",
  "NATIVE_SIGNER_UNAVAILABLE", "NATIVE_SIGNING_REJECTED", "NATIVE_NETWORK_MISMATCH",
  "NATIVE_RUNTIME_INCOMPATIBLE", "NATIVE_SUBMISSION_FAILED", "REVIVE_DRY_RUN_FAILED",
  "REVIVE_WEIGHT_LIMIT", "REVIVE_STORAGE_DEPOSIT_LIMIT", "REVIVE_CONTRACT_REVERTED",
  "ACCOUNT_UNMAPPED", "ACCOUNT_MAPPING_CONFLICT", "ACCOUNT_MAPPING_FAILED",
]);

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

export function purchaseErrorDiagnostics(error: unknown) {
  const first = error && typeof error === "object" ? error as { name?: unknown; message?: unknown; shortMessage?: unknown; cause?: unknown } : {};
  return {
    name: typeof first.name === "string" ? first.name : undefined,
    message: typeof first.message === "string" ? first.message : String(error),
    shortMessage: typeof first.shortMessage === "string" ? first.shortMessage : undefined,
    cause: first.cause,
  };
}

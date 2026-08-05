import { describe, expect, it } from "vitest";
import { feedbackCopy } from "../src/feedback/catalog";
import { type FeedbackCode } from "../src/feedback/codes";
import { normalizeFeedback } from "../src/feedback/normalize";

const base = { operation: "submit-contribution" as const, locale: "zh-CN" as const };
const codes: FeedbackCode[] = ["INVALID_AMOUNT", "FIRST_CONTRIBUTION_TOO_SMALL", "CONTRIBUTION_TOO_SMALL", "CONTRIBUTION_CLOSED", "INSUFFICIENT_BALANCE", "MAX_AMOUNT_UNAVAILABLE", "BROWSER_WALLET_UNAVAILABLE", "WALLET_CONNECTION_REJECTED", "CHAIN_SWITCH_REJECTED", "USER_REJECTED_TRANSACTION", "WALLET_RESTORE_FAILED", "WRONG_CHAIN", "RPC_UNAVAILABLE", "GLOBAL_DATA_UNAVAILABLE", "USER_DATA_UNAVAILABLE", "HISTORY_UNAVAILABLE", "TRANSACTION_REVERTED", "TRANSACTION_RECEIPT_UNAVAILABLE", "CONTRIBUTED_EVENT_MISMATCH", "TRANSACTION_INCLUDED", "TEMPLATE_MANIFEST_NOT_RUNTIME_READY", "CONFIGURATION_MISMATCH", "OPERATION_CANCELLED", "UNKNOWN_ERROR"];

describe("feedback normalization", () => {
  it("never exposes an insufficient-balance code in user copy", () => {
    const feedback = normalizeFeedback(new Error("INSUFFICIENT_BALANCE"), base);
    expect(feedback.code).toBe("INSUFFICIENT_BALANCE");
    expect(feedback.title).not.toBe("INSUFFICIENT_BALANCE");
    expect(feedback.message).not.toContain("INSUFFICIENT_BALANCE");
  });
  it("maps provider 4001 by operation", () => {
    expect(normalizeFeedback({ code: 4001 }, { ...base, operation: "connect-wallet" }).code).toBe("WALLET_CONNECTION_REJECTED");
    expect(normalizeFeedback({ code: 4001 }, base).code).toBe("USER_REJECTED_TRANSACTION");
  });
  it("uses history-specific RPC feedback", () => {
    expect(normalizeFeedback(new Error("fetch failed"), { ...base, operation: "load-history" }).code).toBe("HISTORY_UNAVAILABLE");
  });
  it("maps unknown errors to safe fallback copy", () => {
    const feedback = normalizeFeedback(new Error("opaque provider payload"), base);
    expect(feedback.code).toBe("UNKNOWN_ERROR");
    expect(feedback.message).not.toContain("opaque provider payload");
  });
  it("has Chinese and English copy for every code", () => {
    for (const code of codes) {
      if (code !== "OPERATION_CANCELLED") {
        expect(feedbackCopy(code, "zh-CN").title + feedbackCopy(code, "zh-CN").message).toBeTruthy();
        expect(feedbackCopy(code, "en").title + feedbackCopy(code, "en").message).toBeTruthy();
      }
    }
  });
  it("silences cancellation and deduplicates transaction by hash", () => {
    expect(normalizeFeedback(new Error("OPERATION_CANCELLED"), base).surface).toBe("silent");
    const first = normalizeFeedback(new Error("TRANSACTION_INCLUDED"), { ...base, params: { transactionHash: "0x1234567890123456789012345678901234567890123456789012345678901234" } });
    const second = normalizeFeedback(new Error("TRANSACTION_INCLUDED"), { ...base, params: { transactionHash: first.transactionHash } });
    expect(first.dedupeKey).toBe(`transaction:${first.transactionHash}`);
    expect(second.dedupeKey).toBe(first.dedupeKey);
  });
});

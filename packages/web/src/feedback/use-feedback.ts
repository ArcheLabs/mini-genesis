import { useCallback, useMemo, useRef, useState } from "react";
import type { FeedbackCode } from "./codes";
import { normalizeFeedback } from "./normalize";
import type { FeedbackContext, NormalizedFeedback } from "./types";

export type FeedbackController = { notifications: NormalizedFeedback[]; banners: NormalizedFeedback[]; presentError: (error: unknown, context: FeedbackContext) => NormalizedFeedback; presentCode: (code: FeedbackCode, context: FeedbackContext) => NormalizedFeedback; dismiss: (dedupeKey: string) => void; clearCode: (code: FeedbackCode) => void; clearOperation: (operation: FeedbackContext["operation"]) => void };
export function useFeedback(): FeedbackController {
  const [items, setItems] = useState<NormalizedFeedback[]>([]);
  const timers = useRef(new Map<string, number>());
  const present = useCallback((feedback: NormalizedFeedback) => {
    if (feedback.surface === "silent" || feedback.surface === "field") return feedback;
    setItems((current) => { const existing = current.find((item) => item.dedupeKey === feedback.dedupeKey); if (existing && existing.code === feedback.code && existing.message === feedback.message) return current; return [feedback, ...current.filter((item) => item.dedupeKey !== feedback.dedupeKey)].slice(0, 8); });
    if (import.meta.env.DEV) console.error("[MINI Genesis]", { code: feedback.code, operation: feedback.dedupeKey }); else console.warn("[MINI Genesis]", feedback.code);
    if (feedback.autoDismissMs) { const old = timers.current.get(feedback.dedupeKey); if (old) window.clearTimeout(old); const timer = window.setTimeout(() => { setItems((current) => current.filter((item) => item.dedupeKey !== feedback.dedupeKey)); timers.current.delete(feedback.dedupeKey); }, feedback.autoDismissMs); timers.current.set(feedback.dedupeKey, timer); }
    return feedback;
  }, []);
  const presentError = useCallback((error: unknown, context: FeedbackContext) => present(normalizeFeedback(error, context)), [present]);
  const presentCode = useCallback((code: FeedbackCode, context: FeedbackContext) => present(normalizeFeedback(new Error(code), context)), [present]);
  const dismiss = useCallback((dedupeKey: string) => { const timer = timers.current.get(dedupeKey); if (timer) window.clearTimeout(timer); timers.current.delete(dedupeKey); setItems((current) => current.filter((item) => item.dedupeKey !== dedupeKey)); }, []);
  const clearCode = useCallback((code: FeedbackCode) => setItems((current) => { const next = current.filter((item) => item.code !== code); return next.length === current.length ? current : next; }), []);
  const clearOperation = useCallback((operation: FeedbackContext["operation"]) => setItems((current) => { const next = current.filter((item) => !item.dedupeKey.startsWith(`${operation}:`)); return next.length === current.length ? current : next; }), []);
  return useMemo(() => ({ notifications: items.filter((item) => item.surface === "notification").sort((a, b) => Number(b.kind === "error" || b.persistent) - Number(a.kind === "error" || a.persistent)).slice(0, 3), banners: items.filter((item) => item.surface === "banner"), presentError, presentCode, dismiss, clearCode, clearOperation }), [clearCode, clearOperation, dismiss, items, presentCode, presentError]);
}

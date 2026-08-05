import type { NormalizedFeedback } from "./types";
export function SystemBanner({ items, onAction }: { items: NormalizedFeedback[]; onAction?: (item: NormalizedFeedback) => void }) {
  if (!items.length) return null;
  return <section className="system-banner" aria-label="System status">{items.map((item) => <article key={item.dedupeKey} className={`system-banner-item system-banner-${item.kind}`} role={item.kind === "error" ? "alert" : "status"}><div><strong>{item.title}</strong><p>{item.message}</p></div>{item.action && <button type="button" onClick={() => onAction?.(item)}>{item.actionLabel}</button>}</article>)}</section>;
}

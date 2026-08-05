import type { NormalizedFeedback } from "./types";
export function NotificationCenter({ items, onDismiss, onAction }: { items: NormalizedFeedback[]; onDismiss: (key: string) => void; onAction?: (item: NormalizedFeedback) => void }) {
  if (!items.length) return null;
  return <section className="notification-center" aria-label="Notifications">{items.map((item) => <article key={item.dedupeKey} className={`notification notification-${item.kind}`} role={item.kind === "error" ? "alert" : "status"}><div className="notification-content"><strong>{item.title}</strong><p>{item.message}</p>{item.action && <button type="button" className="notification-action" onClick={() => onAction?.(item)}>{item.actionLabel}</button>}</div><button type="button" className="notification-close" aria-label="Dismiss" onClick={() => onDismiss(item.dedupeKey)}>×</button></article>)}</section>;
}

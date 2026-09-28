import type { ProductStatus } from "./StatusBadge";

type Props = { status: ProductStatus; size?: "sm" | "md" };

export function StatusIcon({ status, size = "sm" }: Props) {
  const className = `status-icon status-icon-${size} status-icon-${status}`;
  if (status === "delivered") return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="m5 8 2 2 4-4" /></svg>;
  if (status === "active") return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4" className="status-icon-dot" /></svg>;
  if (status === "planned") return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="M8 4.7v3.5l2.3 1.4" /></svg>;
  if (status === "locked") return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.4" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>;
  if (status === "discontinued") return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="m5.5 5.5 5 5m0-5-5 5" /></svg>;
  return <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.2" /></svg>;
}

export type ProductStatus = "delivered" | "active" | "planned" | "locked" | "investigated" | "discontinued";

type Props = {
  status: ProductStatus;
  language: "zh-CN" | "en";
};

const labels = {
  delivered: { "zh-CN": "已完成", en: "Delivered" },
  active: { "zh-CN": "进行中", en: "In progress" },
  planned: { "zh-CN": "计划中", en: "Planned" },
  locked: { "zh-CN": "锁定", en: "Locked" },
  investigated: { "zh-CN": "已研究", en: "Investigated" },
  discontinued: { "zh-CN": "已停止", en: "Discontinued" },
} as const;

function StatusIcon({ status }: { status: ProductStatus }) {
  if (status === "delivered") return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3.2 3.2L13 4.8" /></svg>;
  if (status === "active") return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4" className="status-icon-dot" /></svg>;
  if (status === "locked") return <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.4" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>;
  return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.2" /></svg>;
}

export function StatusBadge({ status, language }: Props) {
  return <span className={`status-badge status-badge-${status}`} data-status={status}>
    <StatusIcon status={status} />
    <span>{labels[status][language]}</span>
  </span>;
}

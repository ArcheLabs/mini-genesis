import { StatusIcon } from "./StatusIcon";

export type ProductStatus = "delivered" | "active" | "planned" | "locked" | "investigated" | "discontinued";

type Props = {
  status: ProductStatus;
  language: "zh-CN" | "en";
  tone?: "default" | "historical";
};

const labels = {
  delivered: { "zh-CN": "已完成", en: "Completed" },
  active: { "zh-CN": "进行中", en: "In progress" },
  planned: { "zh-CN": "计划中", en: "Planned" },
  locked: { "zh-CN": "锁定", en: "Locked" },
  investigated: { "zh-CN": "已研究", en: "Investigated" },
  discontinued: { "zh-CN": "已取消", en: "Cancelled" },
} as const;

export function productStatusLabel(status: ProductStatus, language: "zh-CN" | "en"): string {
  return labels[status][language];
}

export function StatusBadge({ status, language, tone = "default" }: Props) {
  return <span className={`status-badge status-badge-${status}${tone === "historical" ? " status-badge-historical" : ""}`} data-status={status} data-tone={tone}>
    <StatusIcon status={status} />
    <span>{productStatusLabel(status, language)}</span>
  </span>;
}

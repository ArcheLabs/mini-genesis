type Props = {
  kind: "current" | "closing";
  language: "zh-CN" | "en";
};

export function BasisInfo({ kind, language }: Props) {
  const closing = kind === "closing";
  const label = closing
    ? language === "zh-CN" ? "Genesis I 阶段结束时记录的历史计算基准，不代表可交易市场价格。" : "The historical calculation basis recorded at the end of Genesis I. It is not a tradable market price."
    : language === "zh-CN" ? "这是 Genesis 阶段的计算基准，仅用于确定获得 MINI 所需的 DOT，不代表市场价格或可卖出价格。" : "This is a Genesis calculation basis used to determine the DOT required to acquire MINI. It is not a market price or a sell price.";

  return <details className="basis-info">
    <summary aria-label={label} title={label}><span aria-hidden="true">ⓘ</span></summary>
    <span className="basis-tooltip" role="tooltip">{label}</span>
  </details>;
}

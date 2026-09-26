type Props = { language: "zh-CN" | "en" };

const rules = {
  "zh-CN": [
    "2,000,000 MINI 按线性曲线开放。",
    "Genesis II 仅支持获得 MINI，不提供卖出或赎回。",
    "曲线基准随已分配 MINI 增加；阶段结束基准用于衔接 Genesis III 的流动性积累。",
  ],
  en: [
    "2,000,000 MINI is available through a linear acquisition curve.",
    "Genesis II supports acquiring MINI only; it does not provide selling or redemption.",
    "The curve basis rises with distributed MINI; the closing stage basis carries into Genesis III liquidity accumulation.",
  ],
} as const;

export function GenesisRules({ language }: Props) {
  return <section className="genesis-rules" aria-labelledby="genesis-rules-heading">
    <h2 id="genesis-rules-heading">{language === "zh-CN" ? "规则" : "Rules"}</h2>
    <ul>{rules[language].map((rule) => <li key={rule}>{rule}</li>)}</ul>
  </section>;
}

type Language = "zh-CN" | "en";

export function GenesisPhase3({ language }: { language: Language }) {
  const zh = language === "zh-CN";
  return <section className="stage-panel phase3-panel" data-testid="genesis-phase3">
    <h1 className="sr-only">Genesis III</h1>
    <p>{zh ? "流动性积累" : "Liquidity Accumulation"}</p>
  </section>;
}

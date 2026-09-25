type Language = "zh-CN" | "en";

export function GenesisPhase3({ language }: { language: Language }) {
  const zh = language === "zh-CN";
  return <section className="stage-panel phase3-panel">
    <h1>Genesis III</h1>
    <div className="locked-card">
      <span>LOCKED</span>
      <p>{zh ? "流动性积累" : "Liquidity Accumulation"}</p>
    </div>
  </section>;
}

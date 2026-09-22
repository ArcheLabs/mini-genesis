type Language = "zh-CN" | "en";

export function GenesisPhase3({ language }: { language: Language }) {
  const zh = language === "zh-CN";
  return <section className="stage-panel phase3-panel">
    <div className="stage-eyebrow">Genesis III · LOCKED</div>
    <h1>Genesis III</h1>
    <p className="stage-lead">{zh ? "最终 Genesis 阶段将在 Genesis II 及其执行周期提供足够证据后确定参数。" : "The final Genesis phase remains locked until Genesis II and its execution cycle provide enough evidence to determine its parameters."}</p>
    <div className="locked-card">
      <span>LOCKED</span>
      <p>{zh ? "Genesis III 尚未确定供应量、日期、价格、配额或估值。" : "No supply, date, price, allocation, or valuation has been determined for Genesis III."}</p>
      <small>{zh ? "唯一保留的政策规则是：Genesis III 的起始价格不得低于 Genesis II 的实际终端价格。" : "The only standing policy rule is that Genesis III cannot start below Genesis II’s actual terminal price."}</small>
    </div>
  </section>;
}

import { formatDot } from "./curve";

type Language = "zh-CN" | "en";
type Props = {
  language: Language;
};

export const GENESIS1_FINAL_REFERENCE_PRICE_X18 = 89_460_000_000_000n;

export function GenesisPhase1({ language }: Props) {
  const zh = language === "zh-CN";

  return <section className="stage-panel phase1-panel">
    <div className="stage-eyebrow">Genesis I · COMPLETED</div>
    <h1>Genesis I</h1>
    <p className="stage-lead">{zh ? "Genesis I 已完成，以下保留其最终参考价格作为历史记录。" : "Genesis I is complete. Its final reference price is preserved here as a historical value."}</p>
    <div className="stage-stats">
      <div><span>{zh ? "Genesis I 最终参考价格" : "Genesis I final reference price"}</span><strong>{formatDot(GENESIS1_FINAL_REFERENCE_PRICE_X18, 18, 8)} DOT/MINI</strong></div>
    </div>
  </section>;
}

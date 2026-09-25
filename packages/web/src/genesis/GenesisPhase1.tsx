import { formatDot } from "./curve";
import { GenesisWorkItems } from "./GenesisWorkItems";
import { genesisPhase1WorkItems } from "./work-items";

type Language = "zh-CN" | "en";
type Props = {
  language: Language;
};

export const GENESIS1_FINAL_REFERENCE_PRICE_X18 = 89_460_000_000_000n;

export function GenesisPhase1({ language }: Props) {
  const zh = language === "zh-CN";

  return <section className="stage-panel phase1-panel">
    <div className="stage-eyebrow">COMPLETED</div>
    <h1>Genesis I</h1>
    <div className="phase1-reference-price"><span>{zh ? "最终参考价格" : "Final reference price"}</span><strong>{formatDot(GENESIS1_FINAL_REFERENCE_PRICE_X18, 18, 8)} DOT / MINI</strong></div>
    <GenesisWorkItems language={language} mode="phase1-enabled" workItems={genesisPhase1WorkItems} />
  </section>;
}

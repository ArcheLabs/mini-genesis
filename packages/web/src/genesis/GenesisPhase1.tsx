import { formatDot } from "./curve";
import { BasisInfo } from "./BasisInfo";
import { GenesisWorkItems } from "./GenesisWorkItems";
import { resolveGenesisPhase1WorkItems } from "./work-items";
import type { GenesisWorkItem } from "../config/manifest";

type Language = "zh-CN" | "en";
type Props = {
  language: Language;
  workItems?: readonly GenesisWorkItem[];
  researchHistory?: readonly GenesisWorkItem[];
};

export const GENESIS1_CLOSING_BASIS_X18 = 89_460_000_000_000n;

export function GenesisPhase1({ language, workItems, researchHistory }: Props) {
  const zh = language === "zh-CN";
  const resolvedWorkItems = resolveGenesisPhase1WorkItems(workItems, researchHistory);

  return <section className="stage-panel phase1-panel" data-testid="genesis-phase1">
    <h1 className="sr-only">Genesis I</h1>
    <div className="phase1-closing-basis"><span>{zh ? "阶段结束基准" : "Closing basis"}<BasisInfo kind="closing" language={language} /></span><strong>{formatDot(GENESIS1_CLOSING_BASIS_X18, 18, 8)} DOT / MINI</strong></div>
    <GenesisWorkItems language={language} mode="phase1-enabled" workItems={resolvedWorkItems} />
  </section>;
}

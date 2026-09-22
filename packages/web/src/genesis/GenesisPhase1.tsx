import { formatUnits } from "viem";
import { formatDot } from "./curve";
import { GenesisWorkItems } from "./GenesisWorkItems";
import { genesisPhase1ResearchHistory, genesisPhase1WorkItems } from "./work-items";
import type { GenesisDynamic, GenesisStatic } from "./reads";
import type { DeploymentManifest } from "../config/manifest";

type Language = "zh-CN" | "en";
type Props = {
  language: Language;
  manifest: DeploymentManifest | null;
  phase1Static: GenesisStatic | null;
  phase1Dynamic: GenesisDynamic | null;
  explorerAddress: string | null;
};

const FALLBACK_FINAL_REFERENCE_PRICE = 89_460_000_000_000n;

function mini(value: bigint | null | undefined): string {
  return value == null ? "—" : `${formatUnits(value, 18)} MINI`;
}

function dot(value: bigint | null | undefined): string {
  return value == null ? "—" : `${formatDot(value)} DOT`;
}

export function GenesisPhase1({ language, manifest, phase1Static, phase1Dynamic, explorerAddress }: Props) {
  const phase1 = manifest?.genesis?.phases.phase1;
  const workItems = phase1?.workItems ?? phase1?.achievements?.filter((item) => item.status === "delivered") ?? genesisPhase1WorkItems;
  const researchHistory = phase1?.researchHistory ?? phase1?.achievements?.filter((item) => item.status !== "delivered") ?? genesisPhase1ResearchHistory;
  const finalReferencePrice = phase1?.finalReferencePriceX18 ? BigInt(phase1.finalReferencePriceX18) : FALLBACK_FINAL_REFERENCE_PRICE;
  const zh = language === "zh-CN";

  return <section className="stage-panel phase1-panel">
    <div className="stage-eyebrow">Genesis I · COMPLETED</div>
    <h1>Genesis I</h1>
    <p className="stage-lead">{zh ? "早期参与者承担了项目最初阶段的风险。他们的支持帮助完成了第一轮执行周期，下面是这一周期实际形成的成果。" : "Early participants funded the first execution cycle. Here is what that cycle produced."}</p>
    <div className="stage-stats">
      <div><span>{zh ? "募集 DOT 总额" : "Total DOT raised"}</span><strong>{dot(phase1Dynamic?.totalRaisedDot)}</strong></div>
      <div><span>{zh ? "参与地址" : "Participants"}</span><strong>{phase1Dynamic?.contributorCount.toLocaleString() ?? "—"}{zh ? " 个地址" : " addresses"}</strong></div>
      <div><span>{zh ? "MINI 配额" : "MINI allocation"}</span><strong>{mini(phase1Static?.genesisAllocation)}</strong></div>
      <div><span>{zh ? "Genesis I 最终参考价格" : "Genesis I final reference price"}</span><strong>{formatDot(finalReferencePrice, 18, 8)} DOT/MINI</strong></div>
      <div><span>{zh ? "起止区块" : "Start / end blocks"}</span><strong>{phase1Dynamic ? `#${phase1Dynamic.startBlock.toString()} → #${phase1Dynamic.emissionEndBlock.toString()}` : "—"}</strong></div>
    </div>
    <GenesisWorkItems language={language} mode="phase1-enabled" workItems={workItems} researchHistory={researchHistory} />
    {explorerAddress && <a className="contract-link" href={explorerAddress} target="_blank" rel="noreferrer">{zh ? "查看不可变的 Genesis I 合约 ↗" : "View the immutable Genesis I contract ↗"}</a>}
  </section>;
}

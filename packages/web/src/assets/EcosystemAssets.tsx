import { SectionHeading } from "../components/SectionHeading";
import { BlocksIcon } from "../components/SectionIcons";

export function EcosystemAssets({ language }: { language: "zh-CN" | "en" }) {
  const zh = language === "zh-CN";
  return <section className="asset-card ecosystem-asset" data-testid="ecosystem-assets">
    <SectionHeading size="compact" icon={<BlocksIcon />}>{zh ? "MINI 生态资产" : "MINI Ecosystem Assets"}</SectionHeading>
    <div className="ecosystem-placeholder" role="img" aria-label={zh ? "生态资产数量尚未公布" : "Ecosystem asset amount not yet announced"}>????.??</div>
    <p className="asset-note">{zh ? "将在后续阶段开放" : "Come Soon"}</p>
    <button className="claim-button" type="button" disabled>{zh ? "领取" : "Claim"}</button>
  </section>;
}

import { SectionHeading } from "../components/SectionHeading";
import { BlocksIcon } from "../components/SectionIcons";

export function EcosystemAssets({ language }: { language: "zh-CN" | "en" }) {
  const zh = language === "zh-CN";
  return <section className="asset-card ecosystem-asset" data-testid="ecosystem-assets">
    <SectionHeading size="compact" icon={<BlocksIcon />}>{zh ? "MINI 生态资产" : "MINI Ecosystem Assets"}</SectionHeading>
    <div className="ecosystem-placeholder" role="img" aria-label={zh ? "尚未启用" : "Not yet enabled"}>?</div>
    <p className="asset-note">{zh ? "将在后续阶段开放" : "Available in a later phase"}</p>
  </section>;
}

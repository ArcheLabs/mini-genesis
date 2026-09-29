import { SectionHeading } from "../components/SectionHeading";
import { MiniIcon } from "../components/SectionIcons";
import { formatTokenAmount } from "./format";

type Props = {
  language: "zh-CN" | "en";
  genesis1Holding: bigint | null;
  genesis1Loading: boolean;
  genesis1Error: boolean;
  genesis2Holding: bigint | null;
  genesis2Loading: boolean;
  genesis2Error: boolean;
};

export function MyMini({ language, genesis1Holding, genesis1Loading, genesis1Error, genesis2Holding, genesis2Loading, genesis2Error }: Props) {
  const zh = language === "zh-CN";
  const genesis1Balance = genesis1Loading
    ? (zh ? "读取中…" : "Loading…")
    : genesis1Error
      ? (zh ? "暂不可用" : "Unavailable")
      : genesis1Holding === null ? "—" : `${formatTokenAmount(genesis1Holding)} MINI`;
  const genesis2Balance = genesis2Loading
    ? (zh ? "读取中…" : "Loading…")
    : genesis2Error || genesis2Holding === null ? "—" : `${formatTokenAmount(genesis2Holding)} MINI`;
  return <section className="asset-card mini-asset" data-testid="my-mini-assets">
    <SectionHeading size="compact" icon={<MiniIcon />}>{zh ? "我的 MINI" : "My MINI"}</SectionHeading>
    <div className="mini-holding-row" data-testid="my-mini-genesis1">
      <span>Genesis I</span>
      <strong>{genesis1Balance}</strong>
    </div>
    <div className="mini-holding-row" data-testid="my-mini-genesis2">
      <span>Genesis II</span>
      <strong>{genesis2Balance}</strong>
    </div>
  </section>;
}

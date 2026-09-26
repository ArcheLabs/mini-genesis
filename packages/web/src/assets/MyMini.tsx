import type { DeploymentEnvironment } from "../config/manifest";

type Props = {
  language: "zh-CN" | "en";
  environment: DeploymentEnvironment;
  genesis1Holding: bigint | null;
  genesis1SnapshotRequired: boolean;
  genesis2Holding: bigint | null;
  genesis2Loading: boolean;
  genesis2Error: boolean;
};

function formatMini(value: bigint): string {
  const scale = 100n;
  const rounded = (value * scale + 10n ** 18n / 2n) / 10n ** 18n;
  const whole = (rounded / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${whole}.${(rounded % scale).toString().padStart(2, "0")}`;
}

export function MyMini({ language, environment, genesis1Holding, genesis1SnapshotRequired, genesis2Holding, genesis2Loading, genesis2Error }: Props) {
  const zh = language === "zh-CN";
  const environmentLabel = environment === "local" ? (zh ? "本地" : "Local") : environment === "staging" ? "TestNet" : "";
  return <section className="asset-card mini-asset" data-testid="my-mini-assets">
    <span className="label">{zh ? "我的 MINI" : "My MINI"}</span>
    <div className="mini-holding-row" data-testid="my-mini-genesis1">
      <span>{zh ? "Genesis I · 主网历史" : "Genesis I · Production historical"}</span>
      <strong>{genesis1SnapshotRequired || genesis1Holding === null ? "—" : `${formatMini(genesis1Holding)} MINI`}</strong>
    </div>
    {genesis1SnapshotRequired && <p className="asset-note">{zh ? "Genesis I 持有人快照待提供。" : "The finalized Genesis I holder snapshot has not been provided."}</p>}
    <div className="mini-holding-row" data-testid="my-mini-genesis2">
      <span>{`Genesis II${environmentLabel ? ` · ${environmentLabel}` : ""}`}</span>
      <strong>{genesis2Loading ? (zh ? "加载中…" : "Loading…") : genesis2Error || genesis2Holding === null ? "—" : `${formatMini(genesis2Holding)} MINI`}</strong>
    </div>
  </section>;
}

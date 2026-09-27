type Props = {
  language: "zh-CN" | "en";
  genesis1Holding: bigint | null;
  genesis1Loading: boolean;
  genesis1Error: boolean;
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

export function MyMini({ language, genesis1Holding, genesis1Loading, genesis1Error, genesis2Holding, genesis2Loading, genesis2Error }: Props) {
  const zh = language === "zh-CN";
  const genesis1Balance = genesis1Loading
    ? (zh ? "读取中…" : "Loading…")
    : genesis1Error
      ? (zh ? "暂不可用" : "Unavailable")
      : genesis1Holding === null ? "—" : `${formatMini(genesis1Holding)} MINI`;
  return <section className="asset-card mini-asset" data-testid="my-mini-assets">
    <span className="label">{zh ? "我的 MINI" : "My MINI"}</span>
    <div className="mini-holding-row" data-testid="my-mini-genesis1">
      <span>Genesis I</span>
      <strong>{genesis1Balance}</strong>
    </div>
    <div className="mini-holding-row" data-testid="my-mini-genesis2">
      <span>Genesis II</span>
      <strong>{genesis2Loading ? (zh ? "加载中…" : "Loading…") : genesis2Error || genesis2Holding === null ? "—" : `${formatMini(genesis2Holding)} MINI`}</strong>
    </div>
  </section>;
}

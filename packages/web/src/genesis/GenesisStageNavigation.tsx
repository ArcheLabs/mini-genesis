export type GenesisStageId = "phase1" | "phase2" | "phase3";

type Props = {
  language: "zh-CN" | "en";
  stage: GenesisStageId;
  phase2Status: string;
  onSelect: (stage: GenesisStageId) => void;
};

const stages: readonly { id: GenesisStageId; title: string; status: string }[] = [
  { id: "phase1", title: "Genesis I", status: "COMPLETED" },
  { id: "phase2", title: "Genesis II", status: "LIVE" },
  { id: "phase3", title: "Genesis III", status: "LOCKED" },
];

export function GenesisStageNavigation({ language, stage, phase2Status, onSelect }: Props) {
  return <div className="nav-center stage-nav" role="group" aria-label={language === "zh-CN" ? "Genesis 阶段" : "Genesis stages"}>
    {stages.map((item) => {
      const current = stage === item.id;
      const status = item.id === "phase2" ? phase2Status : item.status;
      return <button
        key={item.id}
        type="button"
        className={`stage-nav-link ${current ? "active" : ""}`}
        aria-current={current ? "page" : undefined}
        aria-label={`${item.title} ${status}`}
        aria-pressed={current}
        data-testid={`stage-nav-${item.id}`}
        onClick={() => onSelect(item.id)}
      >
        <span>{item.title}</span>
        <small><i className={current && item.id === "phase2" && status === "LIVE" ? "live-dot" : ""} aria-hidden="true" />{status}</small>
      </button>;
    })}
  </div>;
}

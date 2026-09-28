import { StatusBadge, type ProductStatus } from "../components/StatusBadge";
import type { GenesisStageId } from "../navigation/routing";

type Props = {
  language: "zh-CN" | "en";
  stage: GenesisStageId;
  phase2Status: string;
  onSelect: (stage: GenesisStageId) => void;
};

const stages: readonly { id: GenesisStageId; title: string; status: ProductStatus }[] = [
  { id: "phase1", title: "Genesis I", status: "delivered" },
  { id: "phase2", title: "Genesis II", status: "active" },
  { id: "phase3", title: "Genesis III", status: "locked" },
];

const paths: Record<GenesisStageId, string> = {
  phase1: "#/genesis/i",
  phase2: "#/genesis/ii",
  phase3: "#/genesis/iii",
};

export function GenesisStageNavigation({ language, stage, phase2Status, onSelect }: Props) {
  return <nav className="nav-center stage-nav" aria-label={language === "zh-CN" ? "Genesis 阶段" : "Genesis stages"}>
    {stages.map((item) => {
      const current = stage === item.id;
      const status: ProductStatus = item.id !== "phase2"
        ? item.status
        : phase2Status === "WAITING"
          ? "planned"
          : phase2Status.startsWith("COMPLETED")
            ? "delivered"
            : "active";
      return <a
        key={item.id}
        href={paths[item.id]}
        className={`stage-nav-link ${current ? "active" : ""}`}
        aria-current={current ? "page" : undefined}
        data-testid={`stage-nav-${item.id}`}
        onClick={() => onSelect(item.id)}
      >
        <span>{item.title}</span>
        <StatusBadge status={status} language={language} />
      </a>;
    })}
  </nav>;
}

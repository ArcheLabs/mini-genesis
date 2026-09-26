import { StatusBadge, type ProductStatus } from "../components/StatusBadge";
import type { GenesisWorkItem } from "./work-items";

type Language = "zh-CN" | "en";
type Props = {
  language: Language;
  mode: "phase1-enabled" | "phase2-funds";
  workItems: readonly GenesisWorkItem[];
};

function localized(value: GenesisWorkItem["summary"] | NonNullable<GenesisWorkItem["tasks"]>[number]["name"], language: Language): string {
  return typeof value === "string" ? value : value[language];
}

function statusFor(item: GenesisWorkItem): ProductStatus {
  return item.status;
}

export function GenesisWorkItems({ language, mode, workItems }: Props) {
  const phase1 = mode === "phase1-enabled";
  const heading = phase1
    ? (language === "zh-CN" ? "已交付" : "Delivered")
    : (language === "zh-CN" ? "Genesis II 执行计划" : "Genesis II Execution");
  return <section className={`work-items-section ${phase1 ? "phase1-work-items" : "phase2-work-items"}`}>
    <h2>{heading}</h2>
    <div className="work-item-grid">
      {workItems.map((item) => <article key={item.id} className={`work-item work-item-${item.status}`} data-testid={`genesis-work-item-${item.id}`}>
        <div className="work-item-head">
          <strong>{item.name}</strong>
          <StatusBadge status={statusFor(item)} language={language} />
        </div>
        <p>{localized(item.summary, language)}</p>
        {item.tasks && item.tasks.length > 0 && <ul className="work-item-tasks">{item.tasks.map((task) => <li key={task.id}>
          <span>{localized(task.name, language)}</span>
          <StatusBadge status={task.status} language={language} />
        </li>)}</ul>}
        {item.evidenceUrl && <a className="work-item-evidence" href={item.evidenceUrl} target="_blank" rel="noreferrer">{language === "zh-CN" ? "查看证据 ↗" : "View evidence ↗"}</a>}
      </article>)}
    </div>
  </section>;
}

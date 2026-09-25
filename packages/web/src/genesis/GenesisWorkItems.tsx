import type { GenesisWorkItem } from "./work-items";

type Language = "zh-CN" | "en";
type Props = {
  language: Language;
  mode: "phase1-enabled" | "phase2-funds" | "phase2-enabled";
  workItems: readonly GenesisWorkItem[];
  researchHistory?: readonly GenesisWorkItem[];
};

function localized(value: GenesisWorkItem["summary"], language: Language): string {
  return typeof value === "string" ? value : value[language];
}

function statusLabel(status: GenesisWorkItem["status"], language: Language): string {
  if (language === "zh-CN") {
    return {
      planned: "计划中",
      active: "进行中",
      delivered: "已交付",
      investigated: "已研究",
      discontinued: "已停止",
    }[status];
  }
  return status.toUpperCase();
}

export function GenesisWorkItems({ language, mode, workItems, researchHistory = [] }: Props) {
  const phase1 = mode === "phase1-enabled";
  const heading = phase1
    ? (language === "zh-CN" ? "已交付" : "Delivered")
    : (language === "zh-CN" ? "Genesis II 执行计划" : "Genesis II Execution");
  return <section className={`work-items-section ${phase1 ? "phase1-work-items" : "phase2-work-items"}`}>
    <h2>{heading}</h2>
    <div className="work-item-grid">
      {workItems.map((item) => <article key={item.id} className={`work-item work-item-${item.status}`} data-testid={`genesis-work-item-${item.id}`}>
        <div className="work-item-head"><strong>{item.name}</strong><span>{statusLabel(item.status, language)}</span></div>
        <p>{localized(item.summary, language)}</p>
        {item.evidenceUrl && <a className="work-item-evidence" href={item.evidenceUrl} target="_blank" rel="noreferrer">{language === "zh-CN" ? "查看证据 ↗" : "View evidence ↗"}</a>}
      </article>)}
    </div>
    {researchHistory.length > 0 && <section className="research-history">
      <div className="research-history-label">{language === "zh-CN" ? "研究历史" : "Research history"}</div>
      <div className="research-history-grid">{researchHistory.map((item) => <article key={item.id} className={`research-item research-item-${item.status}`} data-testid={`genesis-research-item-${item.id}`}>
        <div className="work-item-head"><strong>{item.name}</strong><span>{statusLabel(item.status, language)}</span></div>
        <p>{localized(item.summary, language)}</p>
      </article>)}</div>
    </section>}
  </section>;
}

import type { ContributionHistoryItem, Genesis2PurchaseHistoryItem } from "../genesis/history";
import { SectionHeading } from "../components/SectionHeading";
import { ListChecksIcon } from "../components/SectionIcons";
import { formatTokenAmount } from "./format";

type ReadStatus = "idle" | "loading" | "ready" | "error";
type Props = {
  language: "zh-CN" | "en";
  genesis1: ContributionHistoryItem[];
  genesis1Status: ReadStatus;
  genesis1ExplorerUrl?: string;
  genesis1Symbol: string;
  genesis2: Genesis2PurchaseHistoryItem[];
  genesis2Status: ReadStatus;
  genesis2ExplorerUrl?: string;
  genesis2Symbol: string;
};

function shortHash(hash: string): string { return `${hash.slice(0, 6)}…${hash.slice(-4)}`; }
function transactionUrl(explorerUrl: string | undefined, hash: string): string | null {
  return explorerUrl ? `${explorerUrl.replace(/\/$/, "")}/tx/${hash}` : null;
}

export function MiniHistory({ language, genesis1, genesis1Status, genesis1ExplorerUrl, genesis1Symbol, genesis2, genesis2Status, genesis2ExplorerUrl, genesis2Symbol }: Props) {
  const zh = language === "zh-CN";
  const stateText = (status: ReadStatus, hasRecords: boolean) => status === "loading" || status === "idle"
    ? (zh ? "读取中…" : "Loading…")
    : status === "error"
      ? (zh ? "历史记录暂不可用" : "History unavailable")
      : hasRecords ? null : (zh ? "暂无记录" : "No records yet");
  const genesis1Message = stateText(genesis1Status, genesis1.length > 0);
  const genesis2Message = stateText(genesis2Status, genesis2.length > 0);
  return <section className="asset-card mini-history" data-testid="mini-history">
    <SectionHeading size="compact" icon={<ListChecksIcon />}>{zh ? "历史记录" : "History"}</SectionHeading>
    <div className="history-group" data-testid="genesis1-history">
      <h3>Genesis I</h3>
      {genesis1Message && <p className="history-empty">{genesis1Message}</p>}
      {genesis1Status === "ready" && genesis1.map((item) => {
        const url = transactionUrl(genesis1ExplorerUrl, item.transactionHash);
        return <article className="history-row" key={`${item.transactionHash}-${item.logIndex}`}>
          <div className="history-row-copy"><strong>{zh ? `贡献 ${formatTokenAmount(item.amount)} ${genesis1Symbol}` : `Contributed ${formatTokenAmount(item.amount)} ${genesis1Symbol}`}</strong><span>{zh ? `区块 ${item.blockNumber}` : `Block ${item.blockNumber}`}</span></div>
          {url ? <a className="history-transaction" href={url} target="_blank" rel="noreferrer" title={item.transactionHash}>{shortHash(item.transactionHash)} ↗</a> : <span className="history-transaction" title={item.transactionHash}>{shortHash(item.transactionHash)}</span>}
        </article>;
      })}
    </div>
    <div className="history-group" data-testid="genesis2-history">
      <h3>Genesis II</h3>
      {genesis2Message && <p className="history-empty">{genesis2Message}</p>}
      {genesis2Status === "ready" && genesis2.map((item) => {
        const url = transactionUrl(genesis2ExplorerUrl, item.transactionHash);
        return <article className="history-row" key={`${item.transactionHash}-${item.logIndex}`}>
          <div className="history-row-copy"><strong>{zh ? `获得 ${formatTokenAmount(item.miniAmount)} MINI` : `Acquired ${formatTokenAmount(item.miniAmount)} MINI`}</strong><span>{zh ? `支付 ${formatTokenAmount(item.dotCost)} ${genesis2Symbol} · 区块 ${item.blockNumber}` : `Paid ${formatTokenAmount(item.dotCost)} ${genesis2Symbol} · Block ${item.blockNumber}`}</span></div>
          {url ? <a className="history-transaction" href={url} target="_blank" rel="noreferrer" title={item.transactionHash}>{shortHash(item.transactionHash)} ↗</a> : <span className="history-transaction" title={item.transactionHash}>{shortHash(item.transactionHash)}</span>}
        </article>;
      })}
    </div>
  </section>;
}

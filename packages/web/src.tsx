import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const api = import.meta.env.VITE_GENESIS_API_URL ?? "";
type Account = { contributedDot: string; earned: string; claimed: string; reserved: string; claimable: string };
type Prepared = { claim: { creditGrantId: string; amount: string; sourceAccount: string; deadline: string }; message: number[] };
const request = async <T,>(path: string, init?: RequestInit): Promise<T> => { const response = await fetch(`${api}${path}`, init); const body = await response.json(); if (!response.ok) throw new Error(body.code ?? "REQUEST_FAILED"); return body; };

function App() {
  const [sourceAccount, setSourceAccount] = useState(""); const [username, setUsername] = useState(""); const [account, setAccount] = useState<Account>(); const [prepared, setPrepared] = useState<Prepared>(); const [notice, setNotice] = useState("Connect the Product Host to contribute or claim.");
  const refresh = async () => { try { setAccount(await request<Account>(`/v1/accounts/${sourceAccount}`)); } catch (error) { setNotice(error instanceof Error ? error.message : "ACCOUNT_LOOKUP_FAILED"); } };
  const prepare = async () => { try { const value = await request<Prepared>("/v1/claims/prepare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceAccount, username }) }); setPrepared(value); setNotice("Review the exact username, alias, amount, and deadline in your Product Host."); } catch (error) { setNotice(error instanceof Error ? error.message : "PREPARE_FAILED"); } };
  return <main><header><span className="eyebrow">MINI GENESIS</span><h1>Contribute. Earn. Claim.</h1><p>Finalized contributions create MINI entitlement and repeatable Lucky Credit claims.</p></header><section><h2>贡献 DOT</h2><p>Contribute uses the Product Host signer. The amount is finalized before it appears in your ledger.</p><button disabled>Connect Host to contribute</button></section><section><h2>Credit ledger</h2><input value={sourceAccount} onChange={(e) => setSourceAccount(e.target.value)} placeholder="Source AccountId32 (0x…)" /><button disabled={!/^0x[\da-fA-F]{64}$/.test(sourceAccount)} onClick={refresh}>Refresh finalized ledger</button>{account && <dl><dt>Contributed DOT</dt><dd>{account.contributedDot}</dd><dt>Earned</dt><dd>{account.earned}</dd><dt>Claimed</dt><dd>{account.claimed}</dd><dt>Reserved</dt><dd>{account.reserved}</dd><dt>Claimable</dt><dd>{account.claimable}</dd></dl>}</section><section><h2>Claim Lucky Credit</h2><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Exact People username" /><button disabled={!/^0x[\da-fA-F]{64}$/.test(sourceAccount) || !username} onClick={prepare}>Prepare claim</button>{prepared && <p>Prepared {prepared.claim.amount} Credit · grant {prepared.claim.creditGrantId.slice(0, 12)}…</p>}<p role="status">{notice}</p></section></main>;
}
createRoot(document.getElementById("root")!).render(<App />);

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { formatUnits } from "viem";
import { getLedger, pollClaimStatus, prepareClaim, submitClaim, validatePreparedClaim } from "./api";
import { signPreparedClaim } from "./typed-data";
import type { Ledger, PreparedClaim } from "./types";
import type { DeploymentManifest } from "../config/manifest";
import { accountId32ToSs58 } from "../wallet/substrate/account";
import { walletClient } from "../wallet/wallet-client";
import type { Eip1193Provider } from "../wallet/eip1193";

type ModalStep = "closed" | "input" | "preparing" | "review" | "signing" | "finalizing" | "success";

function displayCredit(value: string | null | undefined): string {
  if (value == null) return "—";
  try { return Number(formatUnits(BigInt(value), 18)).toLocaleString(undefined, { maximumFractionDigits: 2 }); } catch { return "—"; }
}

function isAbort(error: unknown): boolean { return error instanceof Error && error.message === "OPERATION_CANCELLED"; }

export function LuckyCreditClaim({
  manifest,
  sourceH160,
  sessionKey,
  ss58Prefix,
  provider,
  canSign,
  locale,
  onError,
  onLedgerChange,
}: {
  manifest: DeploymentManifest | null;
  sourceH160: Address | null;
  sessionKey: string | null;
  ss58Prefix: number;
  provider: Eip1193Provider | null;
  canSign: boolean;
  locale: "zh-CN" | "en";
  onError: (error: unknown) => void;
  onLedgerChange?: (ledger: Ledger) => void;
}) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [ledgerState, setLedgerState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [step, setStep] = useState<ModalStep>("closed");
  const [username, setUsername] = useState("");
  const [prepared, setPrepared] = useState<PreparedClaim | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const sessionKeyRef = useRef(sessionKey);
  const operationRef = useRef<AbortController | null>(null);
  const onErrorRef = useRef(onError);
  const onLedgerChangeRef = useRef(onLedgerChange);
  onErrorRef.current = onError;
  onLedgerChangeRef.current = onLedgerChange;
  const zh = locale === "zh-CN";

  useEffect(() => {
    sessionKeyRef.current = sessionKey;
    operationRef.current?.abort();
    operationRef.current = null;
    setStep("closed");
    setUsername("");
    setPrepared(null);
    setOwnerAddress(null);
    setClaimError(null);
  }, [sessionKey]);

  const refreshLedger = useCallback(async () => {
    if (!manifest || !sourceH160) {
      setLedger(null);
      setLedgerState("idle");
      return;
    }
    setLedgerState("loading");
    try {
      const next = await getLedger(manifest, sourceH160);
      setLedger(next);
      setLedgerState("ready");
      onLedgerChangeRef.current?.(next);
    } catch (error) {
      setLedgerState("error");
      onErrorRef.current(error);
    }
  }, [manifest, sourceH160]);

  useEffect(() => { void refreshLedger(); }, [refreshLedger, sessionKey]);

  const claimable = ledger?.claimable ?? "0";
  const claimableAmount = useMemo(() => displayCredit(claimable), [claimable]);
  const busy = step === "preparing" || step === "signing" || step === "finalizing";

  const open = () => {
    if (!ledger || BigInt(ledger.claimable) <= 0n || busy) return;
    setClaimError(null);
    setUsername("");
    setPrepared(null);
    setOwnerAddress(null);
    setStep("input");
  };

  const close = () => {
    if (busy) return;
    setStep("closed");
    setPrepared(null);
    setOwnerAddress(null);
    setClaimError(null);
  };

  const prepare = async () => {
    if (!manifest || !sourceH160 || !username.trim() || busy) return;
    const expectedSession = sessionKey;
    if (!expectedSession) return;
    setClaimError(null);
    setStep("preparing");
    try {
      const next = await prepareClaim(manifest, sourceH160, username.trim());
      if (sessionKeyRef.current !== expectedSession) return;
      setPrepared(next);
      setOwnerAddress(accountId32ToSs58(next.claim.ownerAccountId32, ss58Prefix));
      setUsername(next.claim.username);
      setStep("review");
    } catch (error) {
      setStep("input");
      setClaimError(error instanceof Error ? error.message : "CLAIM_FAILED");
      onErrorRef.current(error);
    }
  };

  const confirm = async () => {
    if (!manifest || !sourceH160 || !prepared || !provider || !canSign || busy) return;
    const expectedSession = sessionKey;
    if (!expectedSession) return;
    const operation = new AbortController();
    operationRef.current?.abort();
    operationRef.current = operation;
    setClaimError(null);
    try {
      validatePreparedClaim(prepared, sourceH160, prepared.claim.username, manifest);
      setStep("signing");
      const signature = await signPreparedClaim(walletClient(provider, manifest), prepared, sourceH160, prepared.claim.username, manifest);
      if (sessionKeyRef.current !== expectedSession || operation.signal.aborted) return;
      setStep("finalizing");
      const result = await submitClaim(manifest, prepared, signature as Hex, operation.signal);
      if (sessionKeyRef.current !== expectedSession || operation.signal.aborted) return;
      const final = await pollClaimStatus(manifest, result.creditGrantId, { pollMs: 2_000, signal: operation.signal });
      if (final.status !== "FINALIZED") throw new Error("CLAIM_FAILED");
      setStep("success");
      await refreshLedger();
    } catch (error) {
      if (isAbort(error)) return;
      setStep("review");
      setClaimError(error instanceof Error ? error.message : "CLAIM_FAILED");
      onErrorRef.current(error);
    } finally {
      if (operationRef.current === operation) operationRef.current = null;
    }
  };

  const inputError = claimError && step === "input" ? claimError : null;
  return <>
    <article className="asset-card lucky-credit-asset">
      <span className="label">{zh ? "Lucky 额度" : "Lucky Credit"}</span>
      <div className="asset-value">{ledgerState === "loading" || ledgerState === "idle" ? (zh ? "加载中…" : "Loading…") : `${claimableAmount} MINI`}</div>
      <div className="asset-note">{ledgerState === "error" ? (zh ? "暂时无法读取额度" : "Unable to load credit") : (zh ? "可领取" : "Available to claim")}</div>
      <button className="claim-button" type="button" disabled={ledgerState !== "ready" || BigInt(claimable) <= 0n || busy} onClick={open}>{zh ? "领取" : "Claim"}</button>
    </article>
    {step !== "closed" && <div className="claim-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section className="claim-modal" role="dialog" aria-modal="true" aria-labelledby="lucky-credit-dialog-title">
        {step === "success" ? <>
          <p className="section-index">Lucky Credit</p>
          <h2 id="lucky-credit-dialog-title">{zh ? "领取成功" : "Claim successful"}</h2>
          <p className="claim-modal-copy">{zh ? "Lucky 额度已成功领取。" : "Your Lucky Credit has been claimed successfully."}</p>
          <button className="submit-button" type="button" onClick={close}>{zh ? "返回" : "Back"}</button>
        </> : <>
          <p className="section-index">Lucky Credit</p>
          <h2 id="lucky-credit-dialog-title">{step === "review" || step === "signing" || step === "finalizing" ? (zh ? "确认领取" : "Confirm claim") : (zh ? "领取 Lucky 额度" : "Claim Lucky Credit")}</h2>
          {step === "input" || step === "preparing" ? <>
            <label className="claim-field-label" htmlFor="lucky-credit-username">{zh ? "Mini Lucky 用户名" : "Mini Lucky username"}</label>
            <input id="lucky-credit-username" className="claim-username-input" value={username} onChange={(event) => { setUsername(event.target.value); setClaimError(null); }} placeholder="alice" autoFocus disabled={busy} />
            {inputError && <p className="claim-inline-error" role="alert">{inputError}</p>}
            <div className="claim-summary-row"><span>{zh ? "可领取" : "Available"}</span><strong>{claimableAmount} MINI</strong></div>
            <div className="claim-modal-actions"><button className="secondary-button" type="button" onClick={close} disabled={busy}>{zh ? "取消" : "Cancel"}</button><button className="submit-button" type="button" onClick={() => void prepare()} disabled={!username.trim() || busy}>{step === "preparing" ? <><span className="button-spinner" aria-hidden="true" />{zh ? "正在确认…" : "Preparing…"}</> : (zh ? "确定" : "Continue")}</button></div>
          </> : <>
            <div className="claim-review-list"><div><span>{zh ? "用户名" : "Username"}</span><strong>{prepared?.claim.username}</strong></div><div><span>{zh ? "账户" : "Account"}</span><strong>{ownerAddress}</strong></div><div><span>{zh ? "数量" : "Amount"}</span><strong>{displayCredit(prepared?.claim.amount)} MINI</strong></div></div>
            {claimError && <p className="claim-inline-error" role="alert">{claimError}</p>}
            <div className="claim-modal-actions"><button className="secondary-button" type="button" onClick={() => { setStep("input"); setPrepared(null); setOwnerAddress(null); setClaimError(null); }} disabled={busy}>{zh ? "返回" : "Back"}</button><button className="submit-button" type="button" onClick={() => void confirm()} disabled={busy || !canSign}>{step === "signing" ? <><span className="button-spinner" aria-hidden="true" />{zh ? "请在钱包中签名…" : "Sign in wallet…"}</> : step === "finalizing" ? <><span className="button-spinner" aria-hidden="true" />{zh ? "正在领取…" : "Claiming…"}</> : (zh ? "确认领取" : "Confirm claim")}</button></div>
          </>}
        </>}
      </section>
    </div>}
  </>;
}

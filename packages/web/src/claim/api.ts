import { getAddress, isAddress, keccak256, toBytes, type Address, type Hex } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import type { ClaimRecord, ClaimStatus, Ledger, PreparedClaim } from "./types";

export class ApiError extends Error { constructor(public readonly code: string, public readonly requestId?: string) { super(code); } }
const MAX_BODY = 256 * 1024;
function baseUrl(manifest: DeploymentManifest): string {
  const value = manifest.backend?.baseUrl ?? import.meta.env.VITE_MINI_LUCKY_BACKEND_URL;
  if (!value) throw new ApiError("CLAIM_SERVICE_UNCONFIGURED");
  if (manifest.environment === "production" && !value.startsWith("https://")) throw new ApiError("CONFIGURATION_MISMATCH");
  return value.replace(/\/$/, "");
}
async function request<T>(manifest: DeploymentManifest, path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15_000); const onAbort = () => controller.abort();
  init.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const headers = new Headers(init.headers); headers.set("accept", "application/json"); if (init.body) headers.set("content-type", "application/json");
    const response = await fetch(`${baseUrl(manifest)}${path}`, { ...init, headers, signal: controller.signal });
    const text = await response.text(); if (text.length > MAX_BODY) throw new ApiError("RESPONSE_TOO_LARGE");
    let body: any; try { body = text ? JSON.parse(text) : {}; } catch { throw new ApiError("INVALID_JSON_RESPONSE"); }
    if (!response.ok) throw new ApiError(body?.code ?? "CLAIM_SERVICE_ERROR", body?.requestId);
    return body as T;
  } catch (error) { if (error instanceof ApiError) throw error; if (init.signal?.aborted) throw new ApiError("OPERATION_CANCELLED"); throw new ApiError(error instanceof DOMException && error.name === "AbortError" ? "REQUEST_TIMEOUT" : "RPC_UNAVAILABLE"); }
  finally { clearTimeout(timeout); init.signal?.removeEventListener("abort", onAbort); }
}
export function validateExactUsername(username: string): string { const bytes = new TextEncoder().encode(username); if (!username || bytes.length > 64) throw new ApiError("INVALID_USERNAME"); return username; }
export async function getLedger(manifest: DeploymentManifest, sourceH160: Address): Promise<Ledger> { return request<Ledger>(manifest, `/v1/accounts/${getAddress(sourceH160)}`); }
export async function prepareClaim(manifest: DeploymentManifest, sourceH160: Address, username: string): Promise<PreparedClaim> {
  const canonicalUsername = validateExactUsername(username).trim();
  const response = await request<{
    sourceH160: Address;
    targetKind: "USERNAME";
    username: string;
    ownerAccountId32: Hex;
    targetH160: Address;
    amount: string;
    nonce: string;
    typedData: PreparedClaim["typedData"];
  }>(manifest, "/v1/claims/resolve", { method: "POST", body: JSON.stringify({ sourceH160: getAddress(sourceH160), username: canonicalUsername }) });
  if (response.targetKind !== "USERNAME" || response.username !== canonicalUsername || !isAddress(response.targetH160) || !bytes32(response.ownerAccountId32) || !/^\d+$/.test(response.amount) || !/^\d+$/.test(response.nonce)) throw new ApiError("INVALID_CLAIM_RESPONSE");
  return { claim: { sourceH160: getAddress(response.sourceH160), username: response.username, usernameHash: keccak256(toBytes(response.username)), ownerAccountId32: response.ownerAccountId32, targetH160: getAddress(response.targetH160), amount: response.amount, nonce: response.nonce }, typedData: response.typedData };
}
export async function submitClaim(manifest: DeploymentManifest, prepared: PreparedClaim, signature: Hex, signal?: AbortSignal): Promise<ClaimRecord> {
  return request<ClaimRecord>(manifest, "/v1/claims", { method: "POST", body: JSON.stringify({ sourceH160: prepared.claim.sourceH160, username: prepared.claim.username, targetH160: prepared.claim.targetH160, amount: prepared.claim.amount, nonce: prepared.claim.nonce, signature }), signal });
}
export async function claimStatus(manifest: DeploymentManifest, creditGrantId: Hex, signal?: AbortSignal): Promise<{ status: ClaimStatus }> { return request(manifest, `/v1/claims/${creditGrantId}`, { signal }); }
export async function pollClaimStatus(manifest: DeploymentManifest, creditGrantId: Hex, options: { signal?: AbortSignal; pollMs?: number; timeoutMs?: number } = {}): Promise<{ status: ClaimStatus }> {
  const deadline = Date.now() + (options.timeoutMs ?? 120_000);
  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new ApiError("OPERATION_CANCELLED");
    const current = await claimStatus(manifest, creditGrantId, options.signal);
    if (current.status === "FINALIZED" || current.status === "FAILED") return current;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, options.pollMs ?? 4_000);
      const abort = () => { clearTimeout(timer); reject(new ApiError("OPERATION_CANCELLED")); };
      options.signal?.addEventListener("abort", abort, { once: true });
    });
  }
  throw new ApiError("CLAIM_STATUS_TIMEOUT");
}
function bytes32(value: unknown): value is Hex { return typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value); }
function equalAddress(a: unknown, b: Address): boolean { return typeof a === "string" && isAddress(a) && getAddress(a) === getAddress(b); }
function equalBigInt(a: unknown, b: string): boolean { try { return BigInt(String(a)) === BigInt(b); } catch { return false; } }
function mismatch(): never { throw new ApiError("PREPARED_CLAIM_MISMATCH"); }
export function validatePreparedClaim(prepared: PreparedClaim, account: Address, username: string, manifest: DeploymentManifest): void {
  const { claim, typedData } = prepared; const domain = typedData.domain; const message = typedData.message;
  if (typedData.primaryType !== "GenesisClaim" || domain.name !== "Mini Lucky Genesis Claim" || domain.version !== "3" || !equalBigInt(domain.chainId, manifest.source.chainId) || !equalAddress(domain.verifyingContract, manifest.source.contract)) mismatch();
  const typeFields = typedData.types.GenesisClaim;
  if (!Array.isArray(typeFields) || typeFields.length !== 5 || !["source", "target", "usernameHash", "amount", "nonce"].every((name, index) => { const field = typeFields[index]; return field && typeof field === "object" && (field as { name?: unknown }).name === name; })) mismatch();
  if (!isAddress(claim.sourceH160) || getAddress(claim.sourceH160) !== getAddress(account) || claim.username !== username || !bytes32(claim.usernameHash) || keccak256(toBytes(username)) !== claim.usernameHash || !isAddress(claim.targetH160) || !bytes32(claim.ownerAccountId32) || !/^\d+$/.test(claim.amount) || BigInt(claim.amount) <= 0n || !/^\d+$/.test(claim.nonce) || BigInt(claim.nonce) < 0n) mismatch();
  if (!equalAddress(message.source, account) || Object.hasOwn(message, "sourceAccount") || Object.hasOwn(message, "sourceH160")) mismatch();
  const exact: Array<[unknown, unknown]> = [
    [message.source, claim.sourceH160], [message.target, claim.targetH160], [message.usernameHash, claim.usernameHash], [message.amount, claim.amount], [message.nonce, claim.nonce],
  ];
  for (const [left, right] of exact) {
    if (typeof right === "string" && isAddress(right)) { if (!equalAddress(left, right)) mismatch(); }
    else if (typeof right === "string" && bytes32(right)) { if (typeof left !== "string" || left.toLowerCase() !== right.toLowerCase()) mismatch(); }
    else if (typeof right === "string" && /^\d+$/.test(right)) { if (!equalBigInt(left, right)) mismatch(); }
    else if (left !== right) mismatch();
  }
}

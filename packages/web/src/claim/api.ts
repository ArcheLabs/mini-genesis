import { getAddress, isAddress, type Address, type Hex } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import type { ClaimStatus, Ledger, PreparedClaim } from "./types";

export class ApiError extends Error { constructor(public readonly code: string, public readonly requestId?: string) { super(code); } }
const MAX_BODY = 256 * 1024;
function baseUrl(manifest: DeploymentManifest): string { const value = manifest.backend?.baseUrl; if (!value) throw new ApiError("CLAIM_SERVICE_UNCONFIGURED"); if (manifest.environment === "production" && !value.startsWith("https://")) throw new ApiError("CONFIGURATION_MISMATCH"); return value.replace(/\/$/, ""); }
async function request<T>(manifest: DeploymentManifest, path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const headers = new Headers(init.headers); headers.set("accept", "application/json"); if (init.body) headers.set("content-type", "application/json");
    const response = await fetch(`${baseUrl(manifest)}${path}`, { ...init, headers, signal: controller.signal });
    const text = await response.text(); if (text.length > MAX_BODY) throw new ApiError("RESPONSE_TOO_LARGE");
    let body: any; try { body = text ? JSON.parse(text) : {}; } catch { throw new ApiError("INVALID_JSON_RESPONSE"); }
    if (!response.ok) throw new ApiError(body?.code ?? "CLAIM_SERVICE_ERROR", body?.requestId);
    return body as T;
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(error instanceof DOMException && error.name === "AbortError" ? "REQUEST_TIMEOUT" : "RPC_UNAVAILABLE"); }
  finally { clearTimeout(timeout); }
}
export function validateExactUsername(username: string): string { const bytes = new TextEncoder().encode(username); if (!username || bytes.length > 64) throw new ApiError("INVALID_USERNAME"); return username; }
export async function getLedger(manifest: DeploymentManifest, sourceH160: Address): Promise<Ledger> { return request<Ledger>(manifest, `/v1/accounts/${getAddress(sourceH160)}`); }
export async function prepareClaim(manifest: DeploymentManifest, sourceH160: Address, username: string): Promise<PreparedClaim> { return request<PreparedClaim>(manifest, "/v1/claims/prepare", { method: "POST", body: JSON.stringify({ sourceH160: getAddress(sourceH160), username: validateExactUsername(username) }) }); }
export async function submitClaim(manifest: DeploymentManifest, creditGrantId: Hex, signature: Hex): Promise<unknown> { return request(manifest, "/v1/claims", { method: "POST", body: JSON.stringify({ creditGrantId, signature }) }); }
export async function claimStatus(manifest: DeploymentManifest, creditGrantId: Hex): Promise<{ status: ClaimStatus }> { return request(manifest, `/v1/claims/${creditGrantId}`); }
export function validatePreparedClaim(prepared: PreparedClaim, account: Address, username: string, manifest: DeploymentManifest): void {
  const { claim, typedData } = prepared;
  if (!isAddress(claim.sourceH160) || getAddress(claim.sourceH160) !== getAddress(account) || claim.username !== username || !/^0x[0-9a-f]{64}$/i.test(claim.creditGrantId) || BigInt(claim.amount) <= 0n || BigInt(claim.deadline) <= BigInt(Math.floor(Date.now() / 1000)) || typedData.primaryType !== "GenesisCreditClaim") throw new ApiError("PREPARED_CLAIM_MISMATCH");
  const message = typedData.message as Record<string, unknown>; const source = message.sourceH160 ?? message.sourceAccount ?? message.source;
  if (source === undefined || String(source).toLowerCase() !== account.toLowerCase()) throw new ApiError("PREPARED_CLAIM_MISMATCH");
  const chainId = typedData.domain.chainId; if (chainId === undefined || BigInt(String(chainId)) !== BigInt(manifest.source.chainId)) throw new ApiError("PREPARED_CLAIM_MISMATCH");
  const verifying = typedData.domain.verifyingContract; if (verifying === undefined || String(verifying).toLowerCase() !== manifest.source.contract.toLowerCase()) throw new ApiError("PREPARED_CLAIM_MISMATCH");
  if (claim.targetChainId !== manifest.destination.chainId || claim.miniLucky.toLowerCase() !== manifest.destination.miniLucky.toLowerCase()) throw new ApiError("PREPARED_CLAIM_MISMATCH");
}

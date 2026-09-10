import { describe, expect, it, vi } from "vitest";
import { prepareClaim, submitClaim, validatePreparedClaim } from "../src/claim/api";
import { signPreparedClaim } from "../src/claim/typed-data";
import type { PreparedClaim } from "../src/claim/types";
import { ACCOUNT, SOURCE_CONTRACT, USERNAME, manifest, usernameHash } from "./helpers";

const claim = { sourceH160: ACCOUNT, username: USERNAME, usernameHash: usernameHash(), ownerAccountId32: `0x${"66".repeat(32)}`, targetH160: `0x${"44".repeat(20)}`, amount: "1000000000000000000", nonce: "7" } as const;
const prepared = (): PreparedClaim => ({ claim: { ...claim }, typedData: { primaryType: "GenesisClaim", domain: { name: "Mini Lucky Genesis Claim", version: "3", chainId: "420420417", verifyingContract: SOURCE_CONTRACT }, types: { GenesisClaim: [{ name: "source", type: "address" }, { name: "target", type: "address" }, { name: "usernameHash", type: "bytes32" }, { name: "amount", type: "uint128" }, { name: "nonce", type: "uint256" }] }, message: { source: ACCOUNT, target: claim.targetH160, usernameHash: claim.usernameHash, amount: claim.amount, nonce: claim.nonce } } });

describe("Genesis Credit Claim V3", () => {
  it("prepares and submits against the latest Mini Lucky API shape", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body?: string }> = [];
    globalThis.fetch = vi.fn(async (input, init) => {
      calls.push({ url: String(input), body: init?.body as string | undefined });
      return new Response(JSON.stringify(calls.length === 1 ? {
        sourceH160: ACCOUNT, targetKind: "USERNAME", username: USERNAME, ownerAccountId32: claim.ownerAccountId32,
        targetH160: claim.targetH160, amount: claim.amount, nonce: claim.nonce, typedData: prepared().typedData,
      } : { creditGrantId: `0x${"77".repeat(32)}`, status: "RESERVED" }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const next = await prepareClaim(manifest(), ACCOUNT, USERNAME);
      const submitted = await submitClaim(manifest(), next, `0x${"aa".repeat(65)}`);
      expect(next.claim.targetH160).toBe(claim.targetH160);
      expect(submitted.creditGrantId).toBe(`0x${"77".repeat(32)}`);
      expect(calls[0].url).toContain("/v1/claims/resolve");
      expect(calls[1].body).toContain('"nonce":"7"');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("accepts an exact prepared claim and signs only typed data", async () => {
    const value = prepared(); const wallet = { signTypedData: vi.fn().mockResolvedValue(`0x${"aa".repeat(65)}`) } as any;
    validatePreparedClaim(value, ACCOUNT, USERNAME, manifest());
    await signPreparedClaim(wallet, value, ACCOUNT, USERNAME, manifest());
    expect(wallet.signTypedData).toHaveBeenCalledOnce();
    expect(wallet.request).toBeUndefined();
  });
  it.each([
    ["source alias", (p: PreparedClaim) => { p.typedData.message.sourceH160 = ACCOUNT; }],
    ["wrong domain", (p: PreparedClaim) => { p.typedData.domain.version = "1"; }],
    ["wrong source", (p: PreparedClaim) => { p.typedData.message.source = claim.targetH160; }],
    ["wrong username hash", (p: PreparedClaim) => { p.claim.usernameHash = `0x${"99".repeat(32)}`; }],
    ["wrong target", (p: PreparedClaim) => { p.typedData.message.target = ACCOUNT; }],
    ["wrong nonce", (p: PreparedClaim) => { p.typedData.message.nonce = "8"; }],
  ])("rejects %s", (_name, mutate) => { const value = prepared(); mutate(value); expect(() => validatePreparedClaim(value, ACCOUNT, USERNAME, manifest())).toThrow("PREPARED_CLAIM_MISMATCH"); });
  it("rejects a different connected account", () => expect(() => validatePreparedClaim(prepared(), claim.targetH160, USERNAME, manifest())).toThrow("PREPARED_CLAIM_MISMATCH"));
});

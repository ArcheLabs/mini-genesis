import { describe, expect, it, vi } from "vitest";
import { signPreparedClaim } from "../src/claim/typed-data";
import { validatePreparedClaim } from "../src/claim/api";
import type { PreparedClaim } from "../src/claim/types";
import { ACCOUNT, ALIAS, BLOCK_HASH, DESTINATION, DESTINATION_HASH, IDENTITY, SOURCE_CONTRACT, SOURCE_HASH, USERNAME, manifest, usernameHash } from "./helpers";

const claim = { creditGrantId: `0x${"55".repeat(32)}`, claimSequence: "7", sourceH160: ACCOUNT, username: USERNAME, usernameHash: usernameHash(), amount: "1000000000000000000", deadline: String(Math.floor(Date.now() / 1000) + 600), identityH160: IDENTITY, identityResolutionBlock: "42", identityResolutionBlockHash: BLOCK_HASH, contextAlias: ALIAS, targetChainId: "31337", targetChainGenesisHash: DESTINATION_HASH, miniLucky: DESTINATION } as const;
const prepared = (): PreparedClaim => ({ claim: { ...claim }, typedData: { primaryType: "GenesisCreditClaim", domain: { name: "Mini Genesis Lucky Credit Claim", version: "2", chainId: "420420417", verifyingContract: SOURCE_CONTRACT }, types: { GenesisCreditClaim: [{ name: "sourceAccount", type: "address" }] }, message: { sourceChainGenesisHash: SOURCE_HASH, sourceContract: SOURCE_CONTRACT, sourceAccount: ACCOUNT, creditGrantId: claim.creditGrantId, claimSequence: claim.claimSequence, username: USERNAME, usernameHash: claim.usernameHash, identityAccount: IDENTITY, identityResolutionBlock: claim.identityResolutionBlock, identityResolutionBlockHash: BLOCK_HASH, contextAlias: ALIAS, amount: claim.amount, deadline: claim.deadline, targetChainId: claim.targetChainId, targetChainGenesisHash: DESTINATION_HASH, miniLucky: DESTINATION } } });

describe("Genesis Credit Claim V2", () => {
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
    ["wrong source", (p: PreparedClaim) => { p.typedData.message.sourceAccount = IDENTITY; }],
    ["wrong username hash", (p: PreparedClaim) => { p.claim.usernameHash = `0x${"99".repeat(32)}`; }],
    ["wrong identity", (p: PreparedClaim) => { p.typedData.message.identityAccount = ACCOUNT; }],
    ["zero alias", (p: PreparedClaim) => { p.claim.contextAlias = `0x${"00".repeat(32)}`; }],
    ["wrong destination", (p: PreparedClaim) => { p.claim.targetChainGenesisHash = SOURCE_HASH; }],
  ])("rejects %s", (_name, mutate) => { const value = prepared(); mutate(value); expect(() => validatePreparedClaim(value, ACCOUNT, USERNAME, manifest())).toThrow("PREPARED_CLAIM_MISMATCH"); });
  it("rejects a different connected account", () => expect(() => validatePreparedClaim(prepared(), IDENTITY, USERNAME, manifest())).toThrow("PREPARED_CLAIM_MISMATCH"));
});

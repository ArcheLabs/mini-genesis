import { describe, expect, it, vi } from "vitest";
import { assertManifestRuntime, type DeploymentManifest } from "../src/config/manifest";
import { validateRuntime } from "../src/config/runtime";
import { parseNativeAmount, validateContributionAmount } from "../src/genesis/amount";
import { BLOCK_HASH, manifest, SOURCE_HASH } from "./helpers";

describe("amount and runtime guards", () => {
  it("enforces exact native amount and phase rules", () => { expect(parseNativeAmount("1.123456789012345678")).toBe(1123456789012345678n); expect(() => parseNativeAmount("1.1234567890123456789")).toThrow("INVALID_AMOUNT"); expect(() => validateContributionAmount("1", 0, 2n * 10n ** 18n, 1n)).toThrow("FIRST_CONTRIBUTION_TOO_SMALL"); expect(() => validateContributionAmount("1", 1, 1n, 1n * 10n ** 18n)).toThrow("CONTRIBUTION_TOO_SMALL"); });
  it("never treats a template manifest as runtime-ready", () => { const value = manifest({ status: "template" }); expect(() => assertManifestRuntime(value)).toThrow("TEMPLATE_MANIFEST_NOT_RUNTIME_READY"); });
  it("checks deployed chain, genesis, bytecode and contract getters", async () => { const value = manifest({ source: { ...manifest().source, runtimeCodeHash: BLOCK_HASH, genesisHash: SOURCE_HASH } }); const c = { getChainId: vi.fn().mockResolvedValue(420420417), getBlock: vi.fn().mockResolvedValue({ hash: SOURCE_HASH }), getBytecode: vi.fn().mockResolvedValue("0x6000"), readContract: vi.fn() } as any; const result = await validateRuntime(c, value); expect(result.ok).toBe(false); expect(result.code).toBe("CONFIGURATION_MISMATCH"); });
});

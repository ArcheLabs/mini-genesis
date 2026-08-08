import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nativeAssetSummary, shouldLoadContributionHistory } from "../src/genesis/assets";

describe("wallet-specific My Assets", () => {
  it("uses existing Genesis user state for Native MINI and contributed DOT", () => {
    expect(nativeAssetSummary({ pendingMini: 12_480n * 10n ** 18n, contributedDot: 10n * 10n ** 18n })).toEqual({ pendingMini: 12_480n * 10n ** 18n, contributedDot: 10n * 10n ** 18n });
  });

  it("never loads contribution history for Polkadot and retains it for EVM", () => {
    expect(shouldLoadContributionHistory("polkadot")).toBe(false);
    expect(shouldLoadContributionHistory("evm")).toBe(true);
  });

  it("renders Native contributed state without the Transaction details section", () => {
    const src = readFileSync(resolve(__dirname, "../src.tsx"), "utf8");
    expect(src).toContain("isNativeAssets && <article className=\"asset-card\"");
    expect(src).toContain("text.contributed");
    expect(src).toContain("!isNativeAssets && <article className=\"history-card\"");
    expect(src).toContain("if (shouldLoadContributionHistory(session?.kind ?? null)) void loadHistory(genesisIdentity, sessionKey);");
    expect(src).not.toContain("void loadHistory(committedIdentity, sessionKey);");
  });
});

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
    const styles = readFileSync(resolve(__dirname, "../src/interaction-overrides.css"), "utf8");
    expect(src).toContain("native-assets-grid");
    expect(src).toContain("const miniAssetCard");
    expect(src).toContain("const ecosystemAssetCard");
    expect(src).toContain("const contributedAssetCard");
    expect(src).toContain("text.contributed");
    expect(src).toContain("${formatAmount(nativeAssets.contributedDot)} ${nativeSymbol}");
    expect(src).toContain("const miniTradingNote = language === \"zh-CN\" ? \"暂未开放交易\" : \"Trading is not available yet\"");
    expect(src).toContain("!isNativeAssets && <article className=\"history-card\"");
    expect(src).toContain("if (shouldLoadContributionHistory(session?.kind ?? null)) void loadHistory(genesisIdentity, sessionKey);");
    expect(src).not.toContain("void loadHistory(committedIdentity, sessionKey);");
    expect(styles).toContain(".native-assets-grid .mini-asset{grid-column:1 / -1}");
    expect(styles).toContain(".unavailable-asset .asset-value::after{content:\"????.??\"");
    expect(styles).not.toContain(".my-grid .asset-card:nth-child(2)");
  });
});

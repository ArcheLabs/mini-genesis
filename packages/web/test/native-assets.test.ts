import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { nativeAssetSummary, shouldLoadContributionHistory } from "../src/genesis/assets";
import { MyMini } from "../src/assets/MyMini";

describe("wallet-specific My Assets", () => {
  it("uses existing Genesis user state for Native MINI and contributed DOT", () => {
    expect(nativeAssetSummary({ pendingMini: 12_480n * 10n ** 18n, contributedDot: 10n * 10n ** 18n })).toEqual({ pendingMini: 12_480n * 10n ** 18n, contributedDot: 10n * 10n ** 18n });
  });

  it("loads history for either connected wallet through its EVM identity", () => {
    expect(shouldLoadContributionHistory("polkadot")).toBe(true);
    expect(shouldLoadContributionHistory("evm")).toBe(true);
    expect(shouldLoadContributionHistory(null)).toBe(false);
  });

  it("keeps chain-backed Genesis holdings separate from the future ecosystem asset placeholder", () => {
    const src = readFileSync(resolve(__dirname, "../src.tsx"), "utf8");
    const markup = renderToStaticMarkup(createElement(MyMini, { language: "en", genesis1Holding: 12_480n * 10n ** 18n, genesis1Loading: false, genesis1Error: false, genesis2Holding: 282_775_000_000_000_000_000n, genesis2Loading: false, genesis2Error: false }));
    expect(src).toContain("readCurveUser(publicClient, manifest, genesisIdentity)");
    expect(src).toContain("readGenesisUserState(productionClient, productionManifest, genesisIdentity)");
    expect(src).toContain("const miniAssetCard");
    expect(src).toContain("const ecosystemAssetCard = <EcosystemAssets");
    expect(src).toContain("<MiniHistory");
    expect(src).not.toContain("claim-button");
    expect(src).toContain("my-grid\">{miniAssetCard}{ecosystemAssetCard}");
    expect(markup).toContain("Genesis I");
    expect(markup).toContain("Genesis II");
    expect(markup).toContain("12,480.00 MINI");
    expect(markup).toContain("282.78 MINI");
    expect(markup).not.toContain("Production historical");
    expect(markup).not.toContain("holder snapshot");
    expect(markup).not.toContain("my-mini-total");
    expect(markup).not.toContain("12,762.78 MINI");
    expect(markup).not.toContain("ecosystem");
    expect(src).toContain("readGenesis2PurchaseHistoryForSession");
  });
});

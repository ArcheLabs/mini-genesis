import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { GenesisPhase2 } from "../src/genesis/GenesisPhase2";
import { GenesisPhase3 } from "../src/genesis/GenesisPhase3";
import { GenesisWorkItems } from "../src/genesis/GenesisWorkItems";
import { genesisPhase1ResearchHistory, genesisPhase1WorkItems, genesisPhase2WorkItems } from "../src/genesis/work-items";
import { phase2Status } from "../src/genesis/GenesisStages";

const dynamic = (phaseName: "Waiting" | "Active" | "Ended", sold = 0n) => ({
  contract: "0x1111111111111111111111111111111111111111" as `0x${string}`,
  phase: phaseName === "Waiting" ? 0 : phaseName === "Active" ? 1 : 2,
  phaseName,
  allocation: 2_000_000n * 10n ** 18n,
  startPrice: 3_500_000_000_000_000n,
  endPrice: 5_500_000_000_000_000n,
  startTime: 2_000_000_000n,
  endTime: 2_000_604_800n,
  totalSoldMini: sold,
  totalRaisedDot: 0n,
  buyerCount: 0n,
  spotPrice: 3_500_000_000_000_000n,
  observedTimestamp: 2_000_000_000n,
});

describe("Genesis product closure", () => {
  it("keeps Phase I delivered outcomes separate from research history", () => {
    const markup = renderToStaticMarkup(createElement(GenesisWorkItems, { language: "en", mode: "phase1-enabled", workItems: genesisPhase1WorkItems, researchHistory: genesisPhase1ResearchHistory }));
    expect(markup).toContain("What Genesis I Enabled");
    expect(markup).toContain("MiniJAM");
    expect(markup).toContain("DELIVERED");
    expect(markup).toContain("Research history");
    expect(markup).toContain("ZkJAM");
  });

  it("renders six explicit Phase II work items in both languages", () => {
    const english = renderToStaticMarkup(createElement(GenesisWorkItems, { language: "en", mode: "phase2-funds", workItems: genesisPhase2WorkItems }));
    const chinese = renderToStaticMarkup(createElement(GenesisWorkItems, { language: "zh-CN", mode: "phase2-funds", workItems: genesisPhase2WorkItems }));
    expect(english.match(/class="work-item /g)).toHaveLength(6);
    expect(english).toContain("What Genesis II Funds");
    expect(english).toContain("PLANNED");
    expect(chinese).toContain("Genesis II 的资金用途");
    expect(chinese).toContain("计划中");
  });

  it("derives WAITING, LIVE, COMPLETED, and SOLD OUT without inventing Phase III economics", () => {
    expect(phase2Status(dynamic("Waiting"), null, false)).toBe("WAITING");
    expect(phase2Status(dynamic("Active"), null, false)).toBe("LIVE");
    expect(phase2Status(dynamic("Ended", 1n), null, false)).toBe("COMPLETED");
    expect(phase2Status(dynamic("Ended", 2_000_000n * 10n ** 18n), null, false)).toBe("COMPLETED · SOLD OUT");
    const locked = renderToStaticMarkup(createElement(GenesisPhase3, { language: "en" }));
    expect(locked).toContain("LOCKED");
    expect(locked).not.toContain("2,000,000");
    expect(locked).not.toContain("0.003500");
  });

  it("shows remaining MINI and closes purchase after completion", () => {
    const markup = renderToStaticMarkup(createElement(GenesisPhase2, { language: "en", manifest: null, publicClient: null, session: null, provider: null, walletReady: false, correctChain: false, dynamic: dynamic("Ended", 1_600_000n * 10n ** 18n), demoMode: false, onConnect: () => {}, onRefresh: () => {} }));
    expect(markup).toContain("MINI remaining");
    expect(markup).toContain("COMPLETED");
    expect(markup).toContain("What Genesis II Enabled");
    expect(markup).toContain("ACTIVE");
    expect(markup).toContain("0.003500 DOT/MINI");
    expect(markup).toContain("0.005500 DOT/MINI");
    expect(markup).toContain("Purchase closed");
    expect(markup).not.toContain("DOT budget");
  });
});

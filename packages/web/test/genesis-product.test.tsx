import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { GenesisPhase2 } from "../src/genesis/GenesisPhase2";
import { GenesisPhase1 } from "../src/genesis/GenesisPhase1";
import { GenesisPhase3 } from "../src/genesis/GenesisPhase3";
import { GenesisStageNavigation } from "../src/genesis/GenesisStageNavigation";
import { GenesisWorkItems } from "../src/genesis/GenesisWorkItems";
import { BondingCurveChart } from "../src/genesis/BondingCurveChart";
import { MyMini } from "../src/assets/MyMini";
import { genesisPhase2WorkItems } from "../src/genesis/work-items";
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
  buyerCount: 3n,
  spotPrice: 3_500_000_000_000_000n + 2_000_000_000_000_000n * sold / (2_000_000n * 10n ** 18n),
  observedTimestamp: 2_000_000_000n,
});

describe("Genesis product closure", () => {
  it("renders Genesis I as concise historical facts with a closing basis", () => {
    const markup = renderToStaticMarkup(createElement(GenesisPhase1, { language: "en" }));
    expect(markup).toContain("Closing basis");
    expect(markup).toContain("0.00008946 DOT / MINI");
    expect(markup).toContain("Delivered");
    expect(markup).toContain("MiniJAM");
    expect(markup).toContain("sr-only");
    expect(markup).not.toContain("Genesis I is complete");
    expect(markup).not.toContain("Final reference price");
    expect(markup).not.toContain("ZkJAM");
  });

  it("renders six full-width Phase II workstreams with reusable status badges", () => {
    const english = renderToStaticMarkup(createElement(GenesisWorkItems, { language: "en", mode: "phase2-funds", workItems: genesisPhase2WorkItems }));
    const chinese = renderToStaticMarkup(createElement(GenesisWorkItems, { language: "zh-CN", mode: "phase2-funds", workItems: genesisPhase2WorkItems }));
    expect(english.match(/class="work-item work-item-/g)).toHaveLength(6);
    expect(english).toContain("Genesis II Execution");
    expect(english).toContain("high-level development, build, and deployment tools");
    expect(english).toContain("In progress");
    expect(english).toContain("Planned");
    expect(chinese).toContain("Genesis II 执行计划");
    expect(chinese).toContain("计划中");
  });

  it("supports nested tasks without fabricating any in repository workstreams", () => {
    const item = { ...genesisPhase2WorkItems[0], tasks: [
      { id: "compiler", name: "Compiler", status: "delivered" as const },
      { id: "runtime", name: { en: "Runtime integration", "zh-CN": "运行时集成" }, status: "active" as const },
    ] };
    const markup = renderToStaticMarkup(createElement(GenesisWorkItems, { language: "en", mode: "phase2-funds", workItems: [item] }));
    expect(markup).toContain("Compiler");
    expect(markup).toContain("Runtime integration");
    expect(markup.match(/class="status-badge /g)).toHaveLength(3);
    expect(genesisPhase2WorkItems.every((workItem) => !workItem.tasks?.length)).toBe(true);
  });

  it("puts route links and localized statuses in the global stage navigation", () => {
    const markup = renderToStaticMarkup(createElement(GenesisStageNavigation, { language: "zh-CN", stage: "phase2", phase2Status: "LIVE", onSelect: () => {} }));
    expect(markup.match(/data-testid="stage-nav-/g)).toHaveLength(3);
    expect(markup).toContain('href="#/genesis/i"');
    expect(markup).toContain('href="#/genesis/ii"');
    expect(markup).toContain('href="#/genesis/iii"');
    expect(markup).toContain("aria-current=\"page\"");
    expect(markup).toContain("已完成");
    expect(markup).toContain("进行中");
    expect(markup).toContain("锁定");
    expect(markup).not.toContain("Rules");

    const completed = renderToStaticMarkup(createElement(GenesisStageNavigation, { language: "en", stage: "phase2", phase2Status: "COMPLETED", onSelect: () => {} }));
    expect(completed).toContain("Delivered");
  });

  it("derives live phase status while Genesis III remains minimal", () => {
    expect(phase2Status(dynamic("Waiting"), null, false)).toBe("WAITING");
    expect(phase2Status(dynamic("Active"), null, false)).toBe("LIVE");
    expect(phase2Status(dynamic("Ended", 1n), null, false)).toBe("COMPLETED");
    expect(phase2Status(dynamic("Ended", 2_000_000n * 10n ** 18n), null, false)).toBe("COMPLETED · SOLD OUT");
    const locked = renderToStaticMarkup(createElement(GenesisPhase3, { language: "en" }));
    expect(locked).toContain("Liquidity Accumulation");
    expect(locked).toContain('<h1 class="sr-only">Genesis III</h1>');
    expect(locked).not.toContain("LOCKED");
    expect(locked.match(/Genesis III/g)).toHaveLength(1);
  });

  it("keeps only the current acquisition basis, holders, time, curve, purchase, rules, and execution", () => {
    const markup = renderToStaticMarkup(createElement(GenesisPhase2, { language: "en", manifest: null, publicClient: null, session: null, provider: null, walletReady: false, correctChain: false, dynamic: dynamic("Active", 500_000n * 10n ** 18n), demoMode: false, onConnect: () => {}, onRefresh: () => {} }));
    expect(markup).toContain("Current acquisition basis");
    expect(markup).toContain("Holders");
    expect(markup).toContain("Remaining");
    expect(markup).toContain("Starting acquisition basis");
    expect(markup).toContain("Maximum acquisition basis");
    expect(markup).toContain("Pay");
    expect(markup).toContain("You receive");
    expect(markup).toContain("Get MINI");
    expect(markup).toContain("Rules");
    expect(markup).toContain("Genesis II Execution");
    expect(markup).toContain("data-current-position=\"25.000000%\"");
    expect(markup).toContain("0.004000 DOT / MINI");
    for (const obsolete of ["Current price", "Maximum price", "Estimated cost", "After buy", "Price after purchase", "Early Operations Reserve", "COMPLETED", "LIVE"]) {
      expect(markup).not.toContain(obsolete);
    }
    for (const oldStat of ["DOT raised", "MINI distributed", "MINI remaining", "participant addresses"]) expect(markup).not.toContain(oldStat);
  });

  it("exposes exact current position and native range labels to the curve chart", () => {
    const markup = renderToStaticMarkup(createElement(BondingCurveChart, {
      allocation: 2_000_000n * 10n ** 18n,
      sold: 500_000n * 10n ** 18n,
      startBasis: 3_500_000_000_000_000n,
      endBasis: 5_500_000_000_000_000n,
      currentBasis: 4_000_000_000_000_000n,
      language: "en",
    }));
    expect(markup).toContain('data-current-position="25.000000%"');
    expect(markup).toContain('data-current-basis="4000000000000000"');
    expect(markup).toContain("Starting acquisition basis");
    expect(markup).toContain("Maximum acquisition basis");
    expect(markup).not.toContain("25.00%");
  });

  it("separates Genesis I historical MINI from current-environment Genesis II holdings", () => {
    const local = renderToStaticMarkup(createElement(MyMini, { language: "en", environment: "local", genesis1Holding: null, genesis1SnapshotRequired: true, genesis2Holding: 282_775_000_000_000_000_000n, genesis2Loading: false, genesis2Error: false }));
    expect(local).toContain("Genesis I · Production historical");
    expect(local).toContain("Genesis II · Local");
    expect(local).toContain("282.78 MINI");
    expect(local).toContain("snapshot has not been provided");
    expect(local).not.toContain("Total MINI");
    expect(local).not.toContain("ecosystem");
  });
});

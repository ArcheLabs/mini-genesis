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
import { EcosystemAssets } from "../src/assets/EcosystemAssets";
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
  it("renders the complete Genesis I editorial copy with a closing basis", () => {
    const markup = renderToStaticMarkup(createElement(GenesisPhase1, { language: "en" }));
    expect(markup).toContain("Closing basis");
    expect(markup).toContain("0.00008946 DOT / MINI");
    expect(markup).toContain("Completed");
    expect(markup).toContain("MiniJAM");
    expect(markup).toContain("Ownership Abstraction");
    expect(markup).toContain("Lucos");
    expect(markup).toContain("ZkJAM");
    expect(markup).toContain("Stage-1 Network");
    expect(markup).toContain("Node Infrastructure");
    expect(markup).toContain("Backend");
    expect(markup).toContain("Hybrid CLM");
    expect(markup).toContain("Route Termination");
    expect(markup.match(/data-testid="genesis-work-item-/g)).toHaveLength(7);
    expect(markup).toContain("sr-only");
    expect(markup).not.toContain("Genesis I is complete");
    expect(markup).not.toContain("Final reference price");
  });

  it("renders the supplied Genesis I Chinese copy while preserving manifest status metadata", () => {
    const markup = renderToStaticMarkup(createElement(GenesisPhase1, {
      language: "zh-CN",
      workItems: [
        { id: "minijam", name: "MiniJAM", status: "active", summary: { en: "old manifest text", "zh-CN": "旧 manifest 文案" } },
      ],
      researchHistory: [
        { id: "zkjam", name: "ZkJAM", status: "discontinued", summary: { en: "old research copy", "zh-CN": "旧研究文案" } },
      ],
    }));
    expect(markup).toContain("建立第一代 MiniJAM 网络，为 JAM Service 提供从部署、执行到状态演化的完整环境。");
    expect(markup).toContain("节点基础设施");
    expect(markup).toContain("MiniJAM Client");
    expect(markup).toContain("JamScript 到 JAM/PVM 可执行 Service 的构建流程");
    expect(markup).toContain("延迟发布");
    expect(markup).toContain("外部身份接入");
    expect(markup).toContain("钱包解耦");
    expect(markup).toContain("Lucos");
    expect(markup).toContain("资产状态模型");
    expect(markup).toContain("混合 CLM");
    expect(markup).toContain("MiniCells 的状态与隐私");
    expect(markup).toContain("相关研究结论作为 Genesis I 的研发成果保留");
    expect(markup).toContain('class="work-item work-item-active" data-testid="genesis-work-item-minijam"');
    expect(markup).toContain('class="work-item work-item-discontinued" data-testid="genesis-work-item-zkjam"');
    expect(markup).not.toContain("旧 manifest 文案");
    expect(markup).not.toContain("旧研究文案");
  });

  it("renders task titles and task descriptions as separate hierarchy levels", () => {
    const markup = renderToStaticMarkup(createElement(GenesisPhase1, { language: "en" }));
    expect(markup).toContain('<span class="work-item-task-copy"><strong class="work-item-task-title">Stage-1 Network</strong><span class="work-item-task-summary">Complete the first-generation MiniJAM network');
    expect(markup).toContain('<strong class="work-item-task-title">Compiler Toolchain</strong>');
    expect(markup).toContain('<span class="work-item-task-summary">Complete the build flow from JamScript');
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

  it("renders task status icons before task names without repeating status text", () => {
    const item = { ...genesisPhase2WorkItems[0], tasks: [
      { id: "compiler", name: "Compiler", status: "delivered" as const },
      { id: "runtime", name: { en: "Runtime integration", "zh-CN": "运行时集成" }, status: "active" as const },
      { id: "sdk", name: "Developer SDK", status: "planned" as const },
      { id: "legacy", name: "Legacy experimental path", status: "discontinued" as const },
    ] };
    const markup = renderToStaticMarkup(createElement(GenesisWorkItems, { language: "en", mode: "phase2-funds", workItems: [item] }));
    expect(markup).toContain("Compiler");
    expect(markup).toContain("Runtime integration");
    expect(markup).toContain('role="img" aria-label="Completed"');
    expect(markup).toContain('role="img" aria-label="In progress"');
    expect(markup).toContain('role="img" aria-label="Planned"');
    expect(markup).toContain('role="img" aria-label="Cancelled"');
    expect(markup.match(/class="status-badge /g)).toHaveLength(1);
    expect(markup).toContain("work-item-task-status-discontinued");
    expect(markup).toContain('class="status-icon status-icon-sm status-icon-planned"');
    expect(markup).toContain('d="M8 4.7v3.5l2.3 1.4"></path>');
    expect(markup).toContain('class="status-icon status-icon-sm status-icon-discontinued"');
    expect(markup.indexOf('aria-label="Planned"')).toBeLessThan(markup.indexOf(">Developer SDK</span>"));
    expect(markup).not.toContain("<span>Planned</span>");
    expect(markup).not.toContain("<span>Cancelled</span>");
    expect(genesisPhase2WorkItems.some((workItem) => workItem.tasks?.length)).toBe(true);
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
    expect(completed).toContain("Completed");
    expect(completed).toContain("status-badge-historical");
  });

  it("derives live phase status while Genesis III remains locked and non-interactive", () => {
    expect(phase2Status(dynamic("Waiting"), null, false)).toBe("WAITING");
    expect(phase2Status(dynamic("Active"), null, false)).toBe("LIVE");
    expect(phase2Status(dynamic("Ended", 1n), null, false)).toBe("COMPLETED");
    expect(phase2Status(dynamic("Ended", 2_000_000n * 10n ** 18n), null, false)).toBe("COMPLETED · SOLD OUT");
    const locked = renderToStaticMarkup(createElement(GenesisPhase3, { language: "en" }));
    expect(locked).toContain("Liquidity Accumulation");
    expect(locked).toContain("<h1>Genesis III</h1>");
    expect(locked).toContain("Not yet open");
    expect(locked).toContain('data-phase-state="locked"');
    expect(locked).not.toContain("<button");
    expect(locked).not.toContain("<a ");
    expect(locked.match(/Genesis III/g)).toHaveLength(1);
  });

  it("keeps the current basis, holders, time, curve, purchase, rules, and execution without redundant stats", () => {
    const markup = renderToStaticMarkup(createElement(GenesisPhase2, { language: "en", manifest: null, publicClient: null, session: null, provider: null, walletReady: false, correctChain: false, dynamic: dynamic("Active", 500_000n * 10n ** 18n), demoMode: false, onConnect: () => {}, onReconcile: async () => {} }));
    expect(markup).toContain("Current acquisition basis");
    expect(markup).toContain("Holders");
    expect(markup).toContain("MINI remaining");
    expect(markup).toContain("Remaining");
    expect(markup).toContain("Starting acquisition basis");
    expect(markup).toContain("Maximum acquisition basis");
    expect(markup).toContain("Pay");
    expect(markup).toContain("You receive");
    expect(markup).toContain("Get MINI");
    expect(markup).not.toContain("MINI sold");
    expect(markup).not.toContain("Raised");
    expect(markup).not.toContain("phase2-total-sold");
    expect(markup).not.toContain("phase2-total-raised");
    expect(markup).not.toContain("My MINI");
    expect(markup).not.toContain("phase2-user-mini");
    expect(markup).toContain("Rules");
    expect(markup).toContain("Genesis II Execution");
    expect(markup).toContain("data-current-position=\"25.000000%\"");
    expect(markup).toContain("0.004000 DOT / MINI");
    for (const obsolete of ["Current price", "Maximum price", "Estimated cost", "After buy", "Price after purchase", "Early Operations Reserve", "COMPLETED", "LIVE"]) {
      expect(markup).not.toContain(obsolete);
    }
    for (const oldStat of ["participant addresses"]) expect(markup).not.toContain(oldStat);
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
    const local = renderToStaticMarkup(createElement(MyMini, { language: "en", genesis1Holding: 12_000n * 10n ** 18n, genesis1Loading: false, genesis1Error: false, genesis2Holding: 282_775_000_000_000_000_000n, genesis2Loading: false, genesis2Error: false }));
    expect(local).toContain("Genesis I");
    expect(local).toContain("Genesis II");
    expect(local).toContain("12,000.00 MINI");
    expect(local).toContain("282.78 MINI");
    expect(local).not.toContain("12,282.78 MINI");
    expect(local).not.toContain("my-mini-total");
    expect(local).not.toContain("本地");
    expect(local).not.toContain("Local");
    expect(local).not.toContain("Production historical");
    expect(local).not.toContain("snapshot");
    expect(local).not.toContain("ecosystem");
  });

  it("shows each phase balance independently while a chain is loading or unavailable", () => {
    const partial = renderToStaticMarkup(createElement(MyMini, { language: "en", genesis1Holding: 100n * 10n ** 18n, genesis1Loading: false, genesis1Error: false, genesis2Holding: null, genesis2Loading: true, genesis2Error: false }));
    expect(partial).not.toContain("my-mini-total");
    expect(partial).toContain('data-testid="my-mini-genesis1"><span>Genesis I</span><strong>100.00 MINI</strong>');
    expect(partial).toContain('data-testid="my-mini-genesis2"><span>Genesis II</span><strong>Loading…</strong>');
    const unavailable = renderToStaticMarkup(createElement(MyMini, { language: "en", genesis1Holding: 100n * 10n ** 18n, genesis1Loading: false, genesis1Error: false, genesis2Holding: null, genesis2Loading: false, genesis2Error: true }));
    expect(unavailable).not.toContain("my-mini-total");
    expect(unavailable).toContain('data-testid="my-mini-genesis1"><span>Genesis I</span><strong>100.00 MINI</strong>');
    expect(unavailable).toContain('data-testid="my-mini-genesis2"><span>Genesis II</span><strong>—</strong>');
  });

  it("uses shared compact headings and the existing question-mark state for asset cards", () => {
    const myMini = renderToStaticMarkup(createElement(MyMini, { language: "zh-CN", genesis1Holding: null, genesis1Loading: true, genesis1Error: false, genesis2Holding: null, genesis2Loading: true, genesis2Error: false }));
    const ecosystem = renderToStaticMarkup(createElement(EcosystemAssets, { language: "zh-CN" }));
    expect(myMini).toContain("section-heading-compact");
    expect(myMini).toContain("我的 MINI");
    expect(myMini).toContain("Genesis I");
    expect(myMini).toContain("Genesis II");
    expect(ecosystem).toContain("section-heading-compact");
    expect(ecosystem).toContain("MINI 生态资产");
    expect(ecosystem).toContain('role="img"');
    expect(ecosystem).toContain('aria-label="生态资产数量尚未公布"');
    expect(ecosystem).toContain("????.??");
    expect(ecosystem).toContain("将在后续阶段开放");
    expect(ecosystem).toContain("disabled");
    expect(ecosystem).toContain("领取");
    expect(ecosystem).not.toContain("—");
  });
});

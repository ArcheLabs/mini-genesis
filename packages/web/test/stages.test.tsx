import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GenesisStageNavigation } from "../src/genesis/GenesisStageNavigation";
import { canonicalizeHash, hashForRoute, routeFromHash } from "../src/navigation/routing";

describe("Genesis stage navigation", () => {
  it("keeps the three finite stages addressable through canonical hashes", () => {
    expect(routeFromHash("#/genesis/i")).toBe("phase1");
    expect(routeFromHash("#/genesis/ii")).toBe("phase2");
    expect(routeFromHash("#/genesis/iii")).toBe("phase3");
    expect(hashForRoute("phase1")).toBe("#/genesis/i");
    expect(hashForRoute("phase2")).toBe("#/genesis/ii");
    expect(hashForRoute("phase3")).toBe("#/genesis/iii");
    expect(canonicalizeHash("#/rules")).toBe("#/genesis/ii");
  });

  it("shows each stage status in navigation and marks the selected stage", () => {
    const markup = renderToStaticMarkup(createElement(GenesisStageNavigation, {
      language: "en",
      stage: "phase2",
      phase2Status: "LIVE",
      onSelect: () => {},
    }));

    expect(markup).toContain("Genesis I");
    expect(markup).toContain("Genesis II");
    expect(markup).toContain("Genesis III");
    expect(markup).toContain("Delivered");
    expect(markup).toContain("In progress");
    expect(markup).toContain("Locked");
    expect(markup).toContain('href="#/genesis/ii" class="stage-nav-link active" aria-current="page"');
  });

  it("reflects Genesis II completion in the status badge", () => {
    const markup = renderToStaticMarkup(createElement(GenesisStageNavigation, {
      language: "en",
      stage: "phase3",
      phase2Status: "COMPLETED · SOLD OUT",
      onSelect: () => {},
    }));

    expect(markup).toContain('data-status="delivered"');
  });
});

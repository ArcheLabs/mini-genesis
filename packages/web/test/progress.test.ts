import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { GenesisProgress } from "../src/genesis/GenesisProgress";
import { contributionBoundaryPercent } from "../src/genesis/progress";

const baseProps = {
  displayedEmittedMini: 3_570_000n,
  emittedLabel: "3,570,000 MINI",
  totalLabel: "10,000,000 MINI",
  protectionLabel: "Protection",
  protectionActive: false,
};

describe("Genesis protection progress", () => {
  it("calculates the boundary from deployment blocks", () => {
    expect(contributionBoundaryPercent(320_000n, 400_000n)).toBe(80);
    expect(contributionBoundaryPercent(750n, 1_000n)).toBe(75);
  });

  it("returns a finite value for a zero denominator", () => {
    expect(contributionBoundaryPercent(320_000n, 0n)).toBe(0);
    expect(Number.isFinite(contributionBoundaryPercent(320_000n, 0n))).toBe(true);
  });

  it("renders the existing progress fill and protection marker together", () => {
    const markup = renderToStaticMarkup(createElement(GenesisProgress, { ...baseProps, displayedProgress: 85, contributionBoundaryPercent: 80 }));

    expect(markup).toContain('style="width:85%"');
    expect(markup).toContain('style="left:80%"');
    expect(markup).toContain("progress-protection-region");
    expect(markup).toContain("Protection");
    expect(markup).toContain('aria-label="Genesis emission progress"');
  });

  it("keeps the marker visible when emission is complete", () => {
    const markup = renderToStaticMarkup(createElement(GenesisProgress, { ...baseProps, displayedProgress: 100, contributionBoundaryPercent: 80 }));

    expect(markup).toContain('style="width:100%"');
    expect(markup).toContain('style="left:80%"');
  });

  it("highlights the label during the existing Protection phase", () => {
    const markup = renderToStaticMarkup(createElement(GenesisProgress, { ...baseProps, displayedProgress: 85, contributionBoundaryPercent: 80, protectionActive: true }));

    expect(markup).toContain("progress-phase-boundary is-active");
  });

  it("does not render phase decoration before static state is available", () => {
    const markup = renderToStaticMarkup(createElement(GenesisProgress, { ...baseProps, displayedProgress: 35.7, contributionBoundaryPercent: null }));

    expect(markup).toContain('style="width:35.7%"');
    expect(markup).not.toContain("progress-protection-region");
    expect(markup).not.toContain("progress-phase-boundary");
  });
});

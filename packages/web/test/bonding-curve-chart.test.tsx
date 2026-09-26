import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BondingCurveChart } from "../src/genesis/BondingCurveChart";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(createElement(BondingCurveChart, {
    allocation: 2_000_000n * 10n ** 18n,
    sold: 0n,
    startBasis: 3_500_000_000_000_000n,
    endBasis: 5_500_000_000_000_000n,
    language: "en",
  })));
  const svg = container.querySelector("svg")!;
  svg.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 260, width: 600, height: 260, toJSON: () => ({}) }) as DOMRect;
  return svg;
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe("interactive acquisition curve", () => {
  it("uses exact integer curve math for a pointer inspection", () => {
    const svg = mount();
    act(() => svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 309, clientY: 120 })));
    const tooltip = container!.querySelector('[data-testid="curve-tooltip"]')!;
    expect(tooltip.textContent).toContain("50.00%");
    expect(tooltip.textContent).toContain("1,000,000 MINI");
    expect(tooltip.textContent).toContain("0.004500 DOT / MINI");
  });

  it("supports keyboard inspection for accessible curve navigation", () => {
    const svg = mount();
    act(() => svg.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })));
    const tooltip = container!.querySelector('[data-testid="curve-tooltip"]')!;
    expect(tooltip.textContent).toContain("1.00%");
    expect(tooltip.textContent).toContain("20,000 MINI");
    expect(tooltip.textContent).toContain("0.003520 DOT / MINI");
  });
});

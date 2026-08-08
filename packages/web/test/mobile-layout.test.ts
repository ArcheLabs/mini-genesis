import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(process.cwd());
const indexHtml = readFileSync(resolve(webRoot, "index.html"), "utf8");
const styleCss = readFileSync(resolve(webRoot, "style.css"), "utf8");
const interactionCss = readFileSync(resolve(webRoot, "src/interaction-overrides.css"), "utf8");
const appSource = readFileSync(resolve(webRoot, "src.tsx"), "utf8");

describe("mobile responsive layout", () => {
  it("includes a viewport meta tag optimized for mobile browsers", () => {
    expect(indexHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"');
    expect(indexHtml).not.toContain("user-scalable=no");
  });

  it("adds an overflow-safe wallet label for narrow headers", () => {
    expect(appSource).toContain('<span className="wallet-label">{walletLabel}</span>');
    expect(appSource).toContain("selectedPolkadotAccount?.name || shortHash(session.selectedAccountAddress)");
    expect(appSource).toContain("copySelectedPolkadotAddress");
    expect(appSource).toContain("{icons.switchAccount}{text.switchAccount}");
    expect(appSource).toContain("{!session && icons.wallet}");
    expect(appSource).toContain('className="account-menu-name"');
    expect(appSource).toContain('className="account-menu-address"');
    expect(styleCss).toContain(".wallet-label");
    expect(styleCss).toMatch(/text-overflow\s*:\s*ellipsis/);
  });

  it("removes the fixed mobile history table width in favor of card layout", () => {
    expect(styleCss).not.toContain("min-width:620px");
    expect(styleCss).toContain(".history-head");
  });

  it("keeps stats-strip from forcing three columns at small widths", () => {
    expect(interactionCss).toContain("@media (max-width: 420px)");
    expect(interactionCss).toMatch(/grid-template-columns\s*:\s*1fr/);
  });
});

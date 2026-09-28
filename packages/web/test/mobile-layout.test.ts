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
    expect(appSource).toContain("copySelectedAddress");
    expect(appSource).toContain("{icons.switchAccount}{text.switchAccount}");
    expect(appSource).toContain("{icons.evm}{text.evmWallet}");
    expect(appSource).toContain("{icons.polkadot}{text.polkadotWallet}");
    expect(appSource).toContain("{!session && icons.wallet}");
    expect(appSource).toContain('className="account-menu-name"');
    expect(appSource).toContain('className="account-menu-address"');
    expect(styleCss).toContain(".wallet-label");
    expect(styleCss).toMatch(/text-overflow\s*:\s*ellipsis/);
  });

  it("removes layout rules for retired dashboard and accordion UI", () => {
    const styles = `${styleCss}\n${interactionCss}`;
    for (const selector of [".hero", ".stage-tabs", ".reserve-banner", ".stats-strip", ".history-head", ".rule-item.open"]) {
      expect(styles).not.toContain(selector);
    }
    expect(appSource).not.toContain("openRule");
    expect(appSource).not.toContain("SHOW_GENESIS_STATS");
  });

  it("uses a stacked trade layout and narrow-screen rules", () => {
    expect(interactionCss).toContain(".phase2-trade-layout");
    expect(interactionCss).toMatch(/@media\s*\(max-width:\s*420px\)/);
    expect(interactionCss).toMatch(/grid-template-columns\s*:\s*minmax\(0,1fr\)/);
  });
});

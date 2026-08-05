import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSwitchMenuItem, walletAccountMenuText } from "../src/wallet/account-switch-menu";

const openAccount = vi.fn();

describe("wallet menu account switch", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
    root = createRoot(document.getElementById("root")!);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.innerHTML = "";
    root = null;
  });

  it("shows the English switch-account label and triggers openAccount once", () => {
    act(() => {
      root!.render(createElement(AccountSwitchMenuItem, { label: walletAccountMenuText.en, onClick: () => openAccount() }));
    });

    const switchButton = document.querySelector("button") as HTMLButtonElement;
    expect(switchButton).toBeTruthy();
    expect(document.body.textContent).toContain("Switch account");
    expect(document.body.textContent).not.toContain("Account / 02");

    act(() => {
      switchButton.click();
    });

    expect(openAccount).toHaveBeenCalledTimes(1);
  });

  it("shows the Chinese switch-account label", () => {
    act(() => {
      root!.render(createElement(AccountSwitchMenuItem, { label: walletAccountMenuText["zh-CN"], onClick: () => openAccount() }));
    });

    expect(document.body.textContent).toContain("切换账户");
    expect(document.body.textContent).not.toContain("Account / 02");
  });
});

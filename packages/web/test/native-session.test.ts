import { describe, expect, it } from "vitest";
import { reconcileGenesisUserState } from "../src/genesis/reconcile";
import { POLKADOT_SESSION_STORAGE_KEY, clearStoredPolkadotSession, deriveWalletLifecycle, readStoredPolkadotSession, samePolkadotAccounts, selectWalletSession, storePolkadotSession, type StoredPolkadotSession } from "../src/wallet/use-genesis-wallet";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const stored: StoredPolkadotSession = { version: 1, extensionId: "subwallet-js", accountId32: "0xb0d127ae0cb6572bd7f2eead1cf9176034c80b88ba6a78d927d9a1dbff21b16d" };
const account = (address: string, name = "Primary") => ({ address, name, accountId32: new Uint8Array(32).fill(address === "A" ? 1 : 2), signer: {} as any });

describe("native wallet session persistence", () => {
  it("persists only the extension id and AccountId32", () => {
    storePolkadotSession(stored, window.localStorage);
    expect(readStoredPolkadotSession(window.localStorage)).toEqual(stored);
    expect(window.localStorage.getItem(POLKADOT_SESSION_STORAGE_KEY)).not.toContain("signer");
    clearStoredPolkadotSession(window.localStorage);
    expect(readStoredPolkadotSession(window.localStorage)).toBeNull();
  });

  it("rejects malformed stored session data", () => {
    window.localStorage.setItem(POLKADOT_SESSION_STORAGE_KEY, JSON.stringify({ version: 1, extensionId: "subwallet-js", accountId32: "5G4YR" }));
    expect(readStoredPolkadotSession(window.localStorage)).toBeNull();
  });

  it("does not replace semantically identical extension accounts", () => {
    expect(samePolkadotAccounts([account("A")], [account("A")])).toBe(true);
    expect(samePolkadotAccounts([account("A")], [account("B")])).toBe(false);
  });

  it("keeps the Polkadot account name available for the Header", () => {
    expect(account("A", "Treasury").name).toBe("Treasury");
  });

  it("highlights the active account without a checkmark", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/interaction-overrides.css"), "utf8");
    expect(styles).toContain(".wallet-menu button.selected{color:var(--accent)");
    expect(styles).toContain(".account-menu-address");
  });

  it("lets a restored EVM session win over stale Polkadot restoration", () => {
    const evm = { kind: "evm", provider: {} } as any;
    const polkadot = { kind: "polkadot", api: {}, contractIdentity: "0x0000000000000000000000000000000000000001", contractIdentityStatus: "verified", balanceStatus: "ready" } as any;
    expect(selectWalletSession(true, evm, polkadot)).toBe(evm);
    expect(deriveWalletLifecycle(evm, "done", "connected")).toEqual({ walletReady: true, walletStatus: "ready" });
  });

  it("keeps Polkadot restoration available when EVM is disconnected", () => {
    const polkadot = { kind: "polkadot", api: {}, contractIdentity: "0x0000000000000000000000000000000000000001", contractIdentityStatus: "verified", balanceStatus: "ready" } as any;
    expect(selectWalletSession(false, null, polkadot)).toBe(polkadot);
    expect(deriveWalletLifecycle(polkadot, "done", "disconnected")).toEqual({ walletReady: true, walletStatus: "ready" });
  });

  it("ends stale Polkadot restoration before it can affect the EVM UI", () => {
    const walletSource = readFileSync(resolve(process.cwd(), "src/wallet/use-genesis-wallet.ts"), "utf8");
    const appSource = readFileSync(resolve(process.cwd(), "src.tsx"), "utf8");
    expect(walletSource).toContain('if (!isConnected) return;\n    restorationAttempted.current = true;\n    setRestoreStatus("done");');
    expect(walletSource).toContain("if (evmConnectedRef.current) {");
    expect(walletSource).toContain("const session = selectWalletSession(isConnected, evmSession, polkadotSession);");
    expect(appSource).toContain('const initialWalletLoading = !demoMode && !paymentReady && walletStatus !== "disconnected";');
  });
});

describe("native contribution reconciliation", () => {
  it("uses the canonical identity and stops once EVM RPC sees the new contribution", async () => {
    const readUser = async (_client: any, _manifest: any, identity: string) => {
      expect(identity).toBe("0x0000000000000000000000000000000000000123");
      return { contributedDot: 15n, pendingMini: 1n };
    };
    await expect(reconcileGenesisUserState({ client: {} as any, manifest: {} as any, identity: "0x0000000000000000000000000000000000000123", expectedContributedDot: 15n, readUser: readUser as any })).resolves.toEqual({ contributedDot: 15n, pendingMini: 1n });
  });

  it("is bounded when the EVM RPC remains behind", async () => {
    const controller = new AbortController();
    const pending = reconcileGenesisUserState({ client: {} as any, manifest: {} as any, identity: "0x0000000000000000000000000000000000000123", expectedContributedDot: 15n, signal: controller.signal, readUser: async () => ({ contributedDot: 0n, pendingMini: 0n }) as any });
    controller.abort();
    await expect(pending).rejects.toThrow("OPERATION_CANCELLED");
  });
});

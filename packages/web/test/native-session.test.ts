import { describe, expect, it } from "vitest";
import { reconcileGenesisUserState } from "../src/genesis/reconcile";
import { POLKADOT_SESSION_STORAGE_KEY, clearStoredPolkadotSession, readStoredPolkadotSession, samePolkadotAccounts, storePolkadotSession, type StoredPolkadotSession } from "../src/wallet/use-genesis-wallet";

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

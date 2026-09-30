import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nativeMocks = vi.hoisted(() => ({
  getInjectedExtensions: vi.fn(() => ["subwallet-js"]),
  connectInjectedExtension: vi.fn(),
  getSubstrateApi: vi.fn(),
  getSubstrateClient: vi.fn(),
  checkNativeRuntime: vi.fn(),
  probeNativeWallet: vi.fn(),
  readNativeBalance: vi.fn(),
  resolveContractAddress: vi.fn(),
}));

vi.mock("@reown/appkit/react", () => ({
  createAppKit: (options: { networks: unknown[]; defaultNetwork?: unknown }) => ({
    options,
    getCaipNetworks: () => options.networks,
    setCaipNetwork: vi.fn(),
  }),
  useAppKit: () => ({ open: vi.fn() }),
  useAppKitAccount: () => ({ address: undefined, isConnected: false, status: "disconnected" }),
  useAppKitProvider: () => ({ walletProvider: null }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));
vi.mock("@reown/appkit/networks", () => ({ defineChain: (chain: unknown) => chain }));
vi.mock("@reown/appkit-adapter-wagmi", () => ({ WagmiAdapter: class { wagmiConfig = {}; constructor(_options: unknown) {} } }));
vi.mock("@tanstack/react-query", () => ({ QueryClient: class {} }));
vi.mock("polkadot-api/pjs-signer", () => ({
  getInjectedExtensions: nativeMocks.getInjectedExtensions,
  connectInjectedExtension: nativeMocks.connectInjectedExtension,
}));
vi.mock("../src/wallet/substrate/client", () => ({
  getSubstrateApi: nativeMocks.getSubstrateApi,
  getSubstrateClient: nativeMocks.getSubstrateClient,
}));
vi.mock("../src/wallet/substrate/runtime", () => ({ checkNativeRuntime: nativeMocks.checkNativeRuntime }));
vi.mock("../src/wallet/substrate/wallet-capability", () => ({ probeNativeWallet: nativeMocks.probeNativeWallet }));
vi.mock("../src/wallet/substrate/balance", () => ({ readNativeBalance: nativeMocks.readNativeBalance }));
vi.mock("../src/wallet/substrate/account", () => ({
  accountId32FromSs58: vi.fn(),
  resolveContractAddress: nativeMocks.resolveContractAddress,
}));

import { getManifest } from "../src/config/manifest";
import { POLKADOT_SESSION_STORAGE_KEY, useGenesisWallet } from "../src/wallet/use-genesis-wallet";

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let wallet: ReturnType<typeof useGenesisWallet> | null = null;

function ProductionWalletHost() {
  wallet = useGenesisWallet(getManifest("production"), null, null, false);
  return createElement("span", null, wallet.availablePolkadotWallets.length);
}

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  localStorage.clear();
  localStorage.setItem(POLKADOT_SESSION_STORAGE_KEY, JSON.stringify({ version: 1, extensionId: "subwallet-js", accountId32: `0x${"11".repeat(32)}` }));
  for (const mock of Object.values(nativeMocks)) mock.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  wallet = null;
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  wallet = null;
});

describe("production Native wallet isolation", () => {
  it("clears stale Native session data without discovering wallets or probing Substrate", async () => {
    await act(async () => root?.render(createElement(ProductionWalletHost)));

    expect(container?.textContent).toBe("0");
    expect(localStorage.getItem(POLKADOT_SESSION_STORAGE_KEY)).toBeNull();
    expect(nativeMocks.getInjectedExtensions).not.toHaveBeenCalled();
    expect(nativeMocks.connectInjectedExtension).not.toHaveBeenCalled();
    expect(nativeMocks.getSubstrateApi).not.toHaveBeenCalled();
    expect(nativeMocks.getSubstrateClient).not.toHaveBeenCalled();
    expect(nativeMocks.checkNativeRuntime).not.toHaveBeenCalled();
    expect(nativeMocks.probeNativeWallet).not.toHaveBeenCalled();
    expect(nativeMocks.readNativeBalance).not.toHaveBeenCalled();
    expect(nativeMocks.resolveContractAddress).not.toHaveBeenCalled();
  });

  it("rejects direct Native connect attempts from the production wallet hook", async () => {
    await act(async () => root?.render(createElement(ProductionWalletHost)));
    await expect(wallet?.connectPolkadot()).rejects.toThrow("NATIVE_POLKADOT_DISABLED");
    expect(nativeMocks.connectInjectedExtension).not.toHaveBeenCalled();
  });
});

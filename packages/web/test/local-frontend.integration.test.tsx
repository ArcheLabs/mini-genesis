import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getManifest } from "../src/config/manifest";
import { GenesisStages } from "../src/genesis/GenesisStages";
import { GenesisStageNavigation, type GenesisStageId } from "../src/genesis/GenesisStageNavigation";
import { readContributionHistory } from "../src/genesis/history";
import { readGlobalDynamic, readGlobalStatic, readGenesisUserState } from "../src/genesis/reads";
import { deriveWalletState } from "../src/wallet/wallet-state";

const localManifest = getManifest("local")!;
const phase2Address = localManifest.genesis!.phases.phase2.contract!;
const zeroAddress = "0x0000000000000000000000000000000000000000";

const walletMock = vi.hoisted(() => {
  const state: { chainId: string; provider: any } = { chainId: "0x190f1b44", provider: null };
  state.provider = {
    request: async ({ method }: { method: string }) => method === "eth_chainId" ? state.chainId : null,
    on: () => undefined,
    removeListener: () => undefined,
  };
  return state;
});

vi.mock("@reown/appkit/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@reown/appkit/react")>();
  return {
    ...actual,
    createAppKit: (options: { networks: unknown[]; defaultNetwork?: unknown }) => {
      let activeNetwork = options.defaultNetwork;
      return {
        options,
        getCaipNetworks: () => options.networks,
        getCaipNetwork: () => activeNetwork,
        setCaipNetwork: (network: unknown) => { activeNetwork = network; },
      };
    },
    useAppKit: () => ({ open: vi.fn() }),
    useAppKitAccount: () => ({ address: "0x544Ac734C6B113789Ea97ac145B1a141bB7e0c65", isConnected: true, status: "connected" }),
    useAppKitProvider: () => ({ walletProvider: walletMock.provider }),
    useDisconnect: () => ({ disconnect: vi.fn() }),
  };
});

function mount(): { root: Root; container: HTMLDivElement } {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  return { root, container };
}

async function flushReact(): Promise<void> {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

const curveValues: Record<string, bigint> = {
  phase: 1n,
  allocation: 2_000_000n * 10n ** 18n,
  startPrice: 3_500_000_000_000_000n,
  endPrice: 5_500_000_000_000_000n,
  startTime: 1_790_309_948n,
  endTime: 1_790_914_748n,
  totalSoldMini: 0n,
  totalRaisedDot: 0n,
  buyerCount: 0n,
  spotPrice: 3_500_000_000_000_000n,
};

function LocalReadLifecycle({ client }: { client: PublicClient }) {
  const [stage, setStage] = useState<GenesisStageId>("phase2");
  return <>
    <GenesisStageNavigation language="en" stage={stage} phase2Status="LIVE" onSelect={setStage} />
    <GenesisStages language="en" stage={stage} refreshKey={0} onPhase2StatusChange={() => {}} manifest={localManifest} publicClient={client} session={null} provider={null} walletReady={false} correctChain={false} demoMode={false} onConnect={() => {}} onRefresh={() => {}} />
  </>;
}

describe("local frontend browser integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, "", "/");
    document.body.replaceChildren();
  });

  it("keeps Genesis I display static and polls only the Genesis II contract", async () => {
    expect(localManifest.source.contract.toLowerCase()).toBe(zeroAddress);
    const readContract = vi.fn(async ({ address, functionName }: { address: string; functionName: string }) => {
      if (address.toLowerCase() === zeroAddress) throw new Error("zero-address call");
      return curveValues[functionName] ?? 0n;
    });
    const client = {
      readContract,
      getBlock: vi.fn(async () => ({ timestamp: 1_790_309_948n })),
      getBlockNumber: vi.fn(async () => 1n),
      getLogs: vi.fn(async () => []),
    } as unknown as PublicClient;
    const { root, container } = mount();
    await act(async () => { root.render(createElement(LocalReadLifecycle, { client })); await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(container.textContent).not.toContain("chain data is temporarily unavailable");
    expect(readContract).toHaveBeenCalled();
    expect(readContract.mock.calls.every(([request]) => request.address === phase2Address)).toBe(true);

    const genesis1Tab = container.querySelector('[data-testid="stage-nav-phase1"]') as HTMLButtonElement;
    await act(async () => { genesis1Tab.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(container.textContent).toContain("0.00008946 DOT / MINI");
    expect(container.textContent).not.toContain("Total DOT raised");
    expect(container.textContent).not.toContain("MINI allocation");
    expect(container.textContent).not.toContain("Start / end blocks");
    expect(container.querySelector('a[href*="/address/"]')).toBeNull();

    await expect(readGlobalStatic(client, localManifest)).rejects.toThrow("PHASE1_CONTRACT_UNAVAILABLE");
    await expect(readGlobalDynamic(client, localManifest)).rejects.toThrow("PHASE1_CONTRACT_UNAVAILABLE");
    await expect(readGenesisUserState(client, localManifest, "0x544Ac734C6B113789Ea97ac145B1a141bB7e0c65")).rejects.toThrow("PHASE1_CONTRACT_UNAVAILABLE");
    await expect(readContributionHistory(client, localManifest, "0x544Ac734C6B113789Ea97ac145B1a141bB7e0c65", 1n)).rejects.toThrow("PHASE1_CONTRACT_UNAVAILABLE");
    expect(readContract.mock.calls.every(([request]) => request.address === phase2Address)).toBe(true);

    await act(async () => root.unmount());
  });

  it("registers Development as an AppKit CAIP EVM network and marks the matching wallet chain ready", async () => {
    window.history.replaceState(null, "", "/?network=local");
    vi.stubEnv("VITE_DEPLOYMENT_ENV", "staging");
    vi.resetModules();
    const [{ appKit, customRpcUrls, polkadotHubNetwork, runtimeSelection, wagmiAdapter }, manifestModule, adapterModule, selectionModule, chainModule] = await Promise.all([
      import("../src/wallet/appkit"),
      import("../src/config/manifest"),
      import("@reown/appkit-adapter-wagmi"),
      import("../src/config/runtime-selection"),
      import("../src/config/chain"),
    ]);
    expect(runtimeSelection.environment).toBe("local");
    expect(selectionModule.currentRuntimeSelection("production", "staging").environment).toBe("local");
    const manifest = manifestModule.getManifest(runtimeSelection.environment)!;
    const publicClientChain = chainModule.genesisChain(manifest);
    const caipId = `eip155:${manifest.source.chainId}`;
    const supported = appKit.getCaipNetworks().find((network) => network.caipNetworkId === caipId);

    expect(polkadotHubNetwork.id).toBe(420420420);
    expect(polkadotHubNetwork.caipNetworkId).toBe(caipId);
    expect(polkadotHubNetwork.chainNamespace).toBe("eip155");
    expect(supported?.caipNetworkId).toBe(caipId);
    expect(supported?.chainNamespace).toBe("eip155");
    expect((appKit as typeof appKit & { options: { defaultNetwork?: unknown } }).options.defaultNetwork).toBe(polkadotHubNetwork);
    expect(customRpcUrls[caipId]).toEqual([{ url: "http://127.0.0.1:8545" }]);
    expect(publicClientChain.id).toBe(polkadotHubNetwork.id);
    expect(publicClientChain.rpcUrls.default.http).toEqual(polkadotHubNetwork.rpcUrls.default.http);
    expect((appKit as typeof appKit & { options: { allowUnsupportedChain?: boolean; enableNetworkSwitch?: boolean } }).options).toMatchObject({
      allowUnsupportedChain: true,
      enableNetworkSwitch: false,
    });
    const adapterConnect = vi.spyOn(adapterModule.WagmiAdapter.prototype, "connect").mockResolvedValue({
      address: "0x544Ac734C6B113789Ea97ac145B1a141bB7e0c65",
      chainId: 1,
      provider: null,
      type: "INJECTED",
      id: "injected",
    });
    await wagmiAdapter.connect({ id: "injected", chainId: 1 } as any);
    expect(adapterConnect).toHaveBeenCalledWith(expect.objectContaining({ chainId: undefined }));
    adapterConnect.mockRestore();

    const walletState = deriveWalletState({ isConnected: true, address: "0x544Ac734C6B113789Ea97ac145B1a141bB7e0c65", chainId: manifest.source.chainId, expectedChainId: Number(manifest.source.chainId), hasProvider: true });
    expect(walletState.correctChain).toBe(true);
    expect(walletState.walletReady).toBe(true);
    expect(Number(appKit.getCaipNetwork()?.id)).toBe(420420420);
  });
});

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { PublicClient } from "viem";
import { getManifest } from "../../src/config/manifest";
import { GenesisStages } from "../../src/genesis/GenesisStages";
import { GenesisStageNavigation, type GenesisStageId } from "../../src/genesis/GenesisStageNavigation";
import { appKit, customRpcUrls } from "../../src/wallet/appkit";
import { deriveWalletState } from "../../src/wallet/wallet-state";

declare global {
  interface Window {
    __localFrontendProbe?: {
      supportedCaipNetwork: boolean;
      customRpc: string | null;
      walletChainId: number;
      correctChain: boolean;
      readAddresses: string[];
      zeroAddressRead: boolean;
    };
  }
}

const baseManifest = getManifest("local")!;
const manifest = {
  ...baseManifest,
  genesis: {
    ...baseManifest.genesis!,
    phases: {
      ...baseManifest.genesis!.phases,
      phase1: { ...baseManifest.genesis!.phases.phase1, finalReferencePriceX18: "1" },
    },
  },
};
const phase2Address = manifest.genesis!.phases.phase2.contract!;
const zeroAddress = "0x0000000000000000000000000000000000000000";
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
const readAddresses: string[] = [];
const client = {
  readContract: async ({ address, functionName }: { address: string; functionName: string }) => {
    readAddresses.push(address);
    if (address.toLowerCase() === zeroAddress) throw new Error("zero-address contract read");
    return curveValues[functionName] ?? 0n;
  },
  getBlock: async () => ({ timestamp: 1_790_309_948n }),
} as unknown as PublicClient;

function LocalFrontend() {
  const [stage, setStage] = useState<GenesisStageId>("phase2");
  useEffect(() => {
    const caipId = `eip155:${manifest.source.chainId}`;
    const supported = appKit.getCaipNetworks().find((network) => network.caipNetworkId === caipId);
    if (supported) appKit.setCaipNetwork(supported);
    const walletState = deriveWalletState({
      isConnected: true,
      address: "0x544Ac734C6B113789Ea97ac145B1a141bB7e0c65",
      chainId: Number(manifest.source.chainId),
      expectedChainId: Number(manifest.source.chainId),
      hasProvider: true,
    });
    window.__localFrontendProbe = {
      supportedCaipNetwork: Boolean(supported),
      customRpc: customRpcUrls[caipId]?.[0]?.url ?? null,
      walletChainId: Number(manifest.source.chainId),
      correctChain: walletState.correctChain,
      readAddresses,
      zeroAddressRead: readAddresses.some((address) => address.toLowerCase() === zeroAddress),
    };
  }, []);

  return <>
    <GenesisStageNavigation language="en" stage={stage} phase2Status="LIVE" onSelect={setStage} />
    <GenesisStages language="en" stage={stage} refreshKey={0} onPhase2StatusChange={() => {}} manifest={manifest} publicClient={client} session={null} provider={null} walletReady={false} correctChain={false} demoMode={false} onConnect={() => {}} onRefresh={() => {}} />
  </>;
}

createRoot(document.getElementById("root")!).render(<LocalFrontend />);

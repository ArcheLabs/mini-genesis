import { createAppKit } from "@reown/appkit/react";
import { defineChain } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { QueryClient } from "@tanstack/react-query";
import { DOT_DECIMALS, DOT_SYMBOL } from "../config/assets";
import { getManifest, selectedEnvironment } from "../config/manifest";
import { resolveReownProjectId } from "../config/reown";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
const manifest = getManifest(selectedEnvironment(import.meta.env.MODE, import.meta.env.VITE_DEPLOYMENT_ENV));
const projectId = resolveReownProjectId(import.meta.env);
const chainId = Number(manifest?.source.chainId ?? 420420419);
const rpcHttpUrls = manifest?.source.rpcHttpUrls.filter(Boolean) ?? [];
const explorerUrl = manifest?.source.explorerUrl || (manifest?.environment === "local" ? "http://127.0.0.1" : "https://blockscout.polkadot.io/");
export const polkadotHubNetwork = defineChain({
  id: chainId,
  caipNetworkId: `eip155:${chainId}`,
  chainNamespace: "eip155",
  name: manifest?.source.name ?? "Polkadot Hub",
  nativeCurrency: { name: manifest?.source.currencySymbol ?? DOT_SYMBOL, symbol: manifest?.source.currencySymbol ?? DOT_SYMBOL, decimals: manifest?.source.evmNativeDecimals ?? DOT_DECIMALS },
  rpcUrls: { default: { http: rpcHttpUrls } },
  blockExplorers: { default: { name: manifest?.environment === "local" ? "Local node" : "Blockscout", url: explorerUrl } },
});

const customRpcUrls = {
  [`eip155:${chainId}`]: rpcHttpUrls.map((url) => ({ url })),
} as Record<string, { url: string }[]>;

export const wagmiAdapter = new WagmiAdapter({
  networks: [polkadotHubNetwork],
  projectId,
  customRpcUrls,
  ssr: false,
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [polkadotHubNetwork],
  customRpcUrls,
  projectId: projectId,
  metadata: {
    name: "MINI Genesis",
    description: "MINI Genesis on Polkadot Hub",
    url: typeof window === "undefined" ? "https://minijam.xyz/" : window.location.origin,
    icons: [],
  },
  features: { analytics: false, email: false, socials: false, swaps: false, onramp: false },
});

export const queryClient = new QueryClient();
export { customRpcUrls };

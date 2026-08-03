import { defineChain, fallback, http, type Chain, type Transport } from "viem";
import type { DeploymentManifest } from "./manifest";

export function genesisChain(manifest: DeploymentManifest): Chain {
  return defineChain({
    id: Number(manifest.source.chainId),
    name: manifest.source.name,
    nativeCurrency: { name: manifest.source.currencySymbol, symbol: manifest.source.currencySymbol, decimals: 18 },
    rpcUrls: { default: { http: manifest.source.rpcHttpUrls.filter(Boolean) } },
    blockExplorers: { default: { name: "Explorer", url: manifest.source.explorerUrl || "https://example.invalid" } },
  });
}

export function publicTransport(manifest: DeploymentManifest): Transport {
  const urls = manifest.source.rpcHttpUrls.filter(Boolean);
  if (!urls.length) throw new Error("RPC_UNAVAILABLE");
  return fallback(urls.map((url) => http(url)));
}

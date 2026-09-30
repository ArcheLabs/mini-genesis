import { describe, expect, it, vi } from "vitest";
import { deploymentManifests } from "../src/generated/deployment-manifests";
import { genesisChain } from "../src/config/chain";
import { getManifest, type DeploymentManifest } from "../src/config/manifest";
import { switchEip1193Chain, type Eip1193Provider } from "../src/wallet/eip1193";

describe("production RPC configuration", () => {
  it("uses the official Polkadot Hub EVM RPC endpoint", () => {
    const manifest = deploymentManifests.production;
    expect(manifest.source.chainId).toBe("420420419");
    expect(manifest.source.name).toBe("Polkadot Hub");
    expect(manifest.source.currencySymbol).toBe("DOT");
    expect(manifest.source.evmNativeDecimals).toBe(18);
    expect(manifest.source.rpcHttpUrls).toEqual(["https://services.polkadothub-rpc.com/mainnet/"]);
    expect(manifest.source.rpcHttpUrls.every((url) => !url.includes("eth-rpc.polkadot.io"))).toBe(true);
    expect(manifest.source.rpcHttpUrls.every((url) => url.startsWith("https://"))).toBe(true);
    expect(manifest.source.explorerUrl).toBe("https://blockscout.polkadot.io/");
    const chain = genesisChain(manifest as unknown as DeploymentManifest);
    expect(chain.id).toBe(420420419);
    expect(chain.nativeCurrency).toMatchObject({ symbol: "DOT", decimals: 18 });
    expect(chain.rpcUrls.default.http).toEqual(manifest.source.rpcHttpUrls);
    expect(chain.blockExplorers.default.url).toBe("https://blockscout.polkadot.io/");
  });

  it("keeps production Phase II as a waiting template", () => {
    const manifest = getManifest("production")!;
    expect(manifest.genesis?.phases.phase1.status).toBe("ended");
    expect(manifest.genesis?.phases.phase2.status).toBe("template");
    expect(manifest.genesis?.phases.phase2.contract).toBeUndefined();
    expect(manifest.genesis?.phases.phase2.startTime).toBeUndefined();
  });

  it("adds the exact Mainnet EVM network when the connected wallet does not know it", async () => {
    const manifest = getManifest("production")!;
    const chain = genesisChain(manifest as unknown as DeploymentManifest);
    let activeChainId = 1;
    const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_chainId") return `0x${activeChainId.toString(16)}`;
      if (method === "wallet_switchEthereumChain") throw Object.assign(new Error("unknown chain"), { code: 4902 });
      if (method === "wallet_addEthereumChain") {
        const config = params?.[0] as { chainId: string };
        activeChainId = Number(BigInt(config.chainId));
        return null;
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    await switchEip1193Chain({ request } as Eip1193Provider, {
      chainId: chain.id,
      name: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: chain.rpcUrls.default.http,
    });

    const addRequest = request.mock.calls.find(([args]) => args.method === "wallet_addEthereumChain")?.[0];
    expect(addRequest?.params?.[0]).toEqual({
      chainId: `0x${chain.id.toString(16)}`,
      chainName: "Polkadot Hub",
      nativeCurrency: { name: "DOT", symbol: "DOT", decimals: 18 },
      rpcUrls: ["https://services.polkadothub-rpc.com/mainnet/"],
    });
    expect(activeChainId).toBe(420420419);
  });
});

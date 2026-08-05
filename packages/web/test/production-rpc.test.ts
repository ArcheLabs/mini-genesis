import { describe, expect, it } from "vitest";
import { deploymentManifests } from "../src/generated/deployment-manifests";
import { genesisChain } from "../src/config/chain";
import type { DeploymentManifest } from "../src/config/manifest";

describe("production RPC configuration", () => {
  it("uses the stable Polkadot Hub RPC and excludes eth-rpc.polkadot.io", () => {
    const manifest = deploymentManifests.production;
    expect(manifest.source.rpcHttpUrls).toEqual(["https://services.polkadothub-rpc.com/mainnet/"]);
    expect(manifest.source.rpcHttpUrls.every((url) => url.startsWith("https://") && !url.includes("eth-rpc.polkadot.io"))).toBe(true);
    expect(manifest.source.explorerUrl).toBe("https://blockscout.polkadot.io/");
    expect(genesisChain(manifest as unknown as DeploymentManifest).rpcUrls.default.http).toEqual(manifest.source.rpcHttpUrls);
  });
});

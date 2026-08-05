import { describe, expect, it } from "vitest";
import { deploymentManifests } from "../src/generated/deployment-manifests";
import { genesisChain } from "../src/config/chain";
import type { DeploymentManifest } from "../src/config/manifest";

describe("production RPC configuration", () => {
  it("contains two mainnet HTTPS RPC endpoints", () => {
    const manifest = deploymentManifests.production;
    expect(manifest.source.rpcHttpUrls).toHaveLength(2);
    expect(manifest.source.rpcHttpUrls.every((url) => url.startsWith("https://") && !url.includes("testnet"))).toBe(true);
    expect(manifest.source.explorerUrl).toBe("https://blockscout.polkadot.io/");
    expect(genesisChain(manifest as unknown as DeploymentManifest).rpcUrls.default.http).toEqual(manifest.source.rpcHttpUrls);
  });
});

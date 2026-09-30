import { polkadot_asset_hub, paseo_asset_hub } from "@polkadot-api/descriptors";
import { createClient, type PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";
import type { DeploymentManifest } from "../../config/manifest";

const clients = new Map<string, { client: PolkadotClient; api: any }>();

function descriptorFor(manifest: DeploymentManifest): typeof polkadot_asset_hub | typeof paseo_asset_hub {
  return manifest.source.chainId === "420420419" ? polkadot_asset_hub : paseo_asset_hub;
}

function getClient(manifest: DeploymentManifest): { client: PolkadotClient; api: any } {
  const wsUrls = manifest.source.substrateWsUrls.filter(Boolean);
  if (!wsUrls.length) throw new Error("SUBSTRATE_RPC_UNAVAILABLE");
  const key = `${manifest.source.substrateGenesisHash}:${manifest.source.substrateWsUrls.join(",")}`;
  const existing = clients.get(key);
  if (existing) return existing;
  try {
    const client = createClient(getWsProvider(wsUrls));
    const api = client.getTypedApi(descriptorFor(manifest));
    const created = { client, api };
    clients.set(key, created);
    return created;
  } catch {
    throw new Error("SUBSTRATE_RPC_UNAVAILABLE");
  }
}

export function getSubstrateApi(manifest: DeploymentManifest): any { return getClient(manifest).api; }
export function getSubstrateClient(manifest: DeploymentManifest): PolkadotClient { return getClient(manifest).client; }

export function destroySubstrateClients(): void {
  for (const { client } of clients.values()) client.destroy();
  clients.clear();
}

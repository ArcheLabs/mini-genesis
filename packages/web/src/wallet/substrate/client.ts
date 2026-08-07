import { polkadot_asset_hub, paseo_asset_hub } from "@polkadot-api/descriptors";
import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";
import type { DeploymentManifest } from "../../config/manifest";

const clients = new Map<string, { client: ReturnType<typeof createClient>; api: any }>();

function descriptorFor(manifest: DeploymentManifest): typeof polkadot_asset_hub | typeof paseo_asset_hub {
  return manifest.source.chainId === "420420419" ? polkadot_asset_hub : paseo_asset_hub;
}

export function getSubstrateApi(manifest: DeploymentManifest): any {
  const wsUrl = manifest.source.substrateWsUrls[0];
  if (!wsUrl) throw new Error("SUBSTRATE_RPC_UNAVAILABLE");
  const key = `${manifest.source.chainId}:${wsUrl}`;
  const existing = clients.get(key);
  if (existing) return existing.api;
  try {
    const client = createClient(getWsProvider(wsUrl));
    const api = client.getTypedApi(descriptorFor(manifest));
    clients.set(key, { client, api });
    return api;
  } catch {
    throw new Error("SUBSTRATE_RPC_UNAVAILABLE");
  }
}

export function destroySubstrateClients(): void {
  for (const { client } of clients.values()) client.destroy();
  clients.clear();
}

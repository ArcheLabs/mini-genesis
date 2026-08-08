import { ApiPromise, WsProvider } from "@polkadot/api";
import type { DeploymentManifest } from "../../config/manifest";

const clients = new Map<string, Promise<ApiPromise>>();

export function getPolkadotJsApi(manifest: DeploymentManifest): Promise<ApiPromise> {
  const endpoints = manifest.source.substrateWsUrls.filter(Boolean);
  if (!endpoints.length) return Promise.reject(new Error("SUBSTRATE_RPC_UNAVAILABLE"));
  const key = `${manifest.source.chainId}:${endpoints.join(",")}`;
  const existing = clients.get(key);
  if (existing) return existing;
  const promise = ApiPromise.create({ provider: new WsProvider(endpoints) }).catch((error) => {
    clients.delete(key);
    throw error;
  });
  clients.set(key, promise);
  return promise;
}

export async function destroyPolkadotJsClients(): Promise<void> {
  const pending = [...clients.values()];
  clients.clear();
  const apis = await Promise.allSettled(pending);
  await Promise.all(apis.filter((result): result is PromiseFulfilledResult<ApiPromise> => result.status === "fulfilled").map((result) => result.value.disconnect()));
}

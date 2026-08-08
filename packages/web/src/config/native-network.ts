import { getManifest, type DeploymentManifest } from "./manifest";

export type NativeNetworkOverride = "none" | "polkadot-mainnet";

export function nativeNetworkOverride(environment: DeploymentManifest["environment"], mode: string, value = import.meta.env.VITE_NATIVE_NETWORK_OVERRIDE): NativeNetworkOverride {
  if (value !== "polkadot-mainnet") return "none";
  return environment !== "production" && (mode === "development" || environment === "staging") ? "polkadot-mainnet" : "none";
}

export function resolveNativeManifest(manifest: DeploymentManifest, mode: string, value = import.meta.env.VITE_NATIVE_NETWORK_OVERRIDE): DeploymentManifest {
  if (nativeNetworkOverride(manifest.environment, mode, value) !== "polkadot-mainnet") return manifest;
  const production = getManifest("production");
  if (!production) throw new Error("CONFIGURATION_MISMATCH");
  return production;
}

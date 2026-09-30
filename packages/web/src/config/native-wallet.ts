import type { DeploymentEnvironment } from "./manifest";

/** Native Polkadot wallet support is an explicit staging/local experiment. */
export function isNativePolkadotEnabled(
  environment: DeploymentEnvironment | null,
  flag = import.meta.env.VITE_ENABLE_EXPERIMENTAL_NATIVE_POLKADOT,
): boolean {
  return environment !== null && environment !== "production" && flag === "true";
}

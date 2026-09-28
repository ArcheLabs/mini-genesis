import type { DeploymentEnvironment } from "./manifest";
import { availableDeploymentEnvironments } from "../generated/deployment-manifests";

export type RuntimeSelection = {
  environment: DeploymentEnvironment | null;
  error: "CONFIGURATION_MISMATCH" | null;
  source: "url" | "build" | "mode" | "invalid";
};

const urlEnvironments: Record<string, DeploymentEnvironment> = {
  local: "local",
  testnet: "staging",
  mainnet: "production",
};

const buildEnvironments = new Set<DeploymentEnvironment>(["local", "staging", "production"]);

export function resolveRuntimeSelection(input: {
  search?: string;
  mode: string;
  deploymentEnv?: string;
  availableEnvironments?: readonly DeploymentEnvironment[];
}): RuntimeSelection {
  const availableEnvironments = input.availableEnvironments ?? availableDeploymentEnvironments;
  const isAvailable = (environment: DeploymentEnvironment) => availableEnvironments.some((item) => item === environment);
  const params = new URLSearchParams(input.search ?? "");
  if (params.has("network")) {
    const requested = params.get("network") ?? "";
    const environment = urlEnvironments[requested];
    return environment && isAvailable(environment)
      ? { environment, error: null, source: "url" }
      : { environment: null, error: "CONFIGURATION_MISMATCH", source: "invalid" };
  }

  const configured = input.deploymentEnv?.trim();
  if (configured) {
    if (buildEnvironments.has(configured as DeploymentEnvironment) && isAvailable(configured as DeploymentEnvironment)) {
      return { environment: configured as DeploymentEnvironment, error: null, source: "build" };
    }
    return { environment: null, error: "CONFIGURATION_MISMATCH", source: "invalid" };
  }

  if (input.mode === "development" && isAvailable("local")) return { environment: "local", error: null, source: "mode" };
  if (input.mode === "production" && isAvailable("production")) return { environment: "production", error: null, source: "mode" };
  return { environment: null, error: "CONFIGURATION_MISMATCH", source: "invalid" };
}

export function currentRuntimeSelection(mode: string, deploymentEnv?: string): RuntimeSelection {
  return resolveRuntimeSelection({
    search: typeof window === "undefined" ? "" : window.location.search,
    mode,
    deploymentEnv,
    availableEnvironments: availableDeploymentEnvironments,
  });
}

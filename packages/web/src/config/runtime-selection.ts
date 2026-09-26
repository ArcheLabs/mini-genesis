import type { DeploymentEnvironment } from "./manifest";

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
}): RuntimeSelection {
  const params = new URLSearchParams(input.search ?? "");
  if (params.has("network")) {
    const requested = params.get("network") ?? "";
    const environment = urlEnvironments[requested];
    return environment
      ? { environment, error: null, source: "url" }
      : { environment: null, error: "CONFIGURATION_MISMATCH", source: "invalid" };
  }

  const configured = input.deploymentEnv?.trim();
  if (configured) {
    if (buildEnvironments.has(configured as DeploymentEnvironment)) {
      return { environment: configured as DeploymentEnvironment, error: null, source: "build" };
    }
    return { environment: null, error: "CONFIGURATION_MISMATCH", source: "invalid" };
  }

  if (input.mode === "development") return { environment: "local", error: null, source: "mode" };
  if (input.mode === "production") return { environment: "production", error: null, source: "mode" };
  return { environment: null, error: "CONFIGURATION_MISMATCH", source: "invalid" };
}

export function currentRuntimeSelection(mode: string, deploymentEnv?: string): RuntimeSelection {
  return resolveRuntimeSelection({
    search: typeof window === "undefined" ? "" : window.location.search,
    mode,
    deploymentEnv,
  });
}

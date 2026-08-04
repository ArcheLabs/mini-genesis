import { getAddress, isAddress, type Address, type Hex } from "viem";
import { deploymentManifests } from "../generated/deployment-manifests";

export type DeploymentEnvironment = "local" | "staging" | "production";
export type ManifestStatus = "template" | "deployed";

export type ContractConfig = Partial<Record<
  | "treasury"
  | "genesisAllocation"
  | "contributionBlocks"
  | "protectionBlocks"
  | "firstContributionMinimum"
  | "subsequentContributionMinimumExclusive", string>>;

export type DeploymentManifest = {
  environment: DeploymentEnvironment;
  status: ManifestStatus;
  evmNativeDecimals: number;
  source: {
    chainId: string;
    name: string;
    currencySymbol?: string;
    evmNativeDecimals: number;
    rpcHttpUrls: string[];
    explorerUrl: string;
    contract: Address;
    deploymentBlock: string;
    runtimeCodeHash: Hex;
    contractConfig?: ContractConfig;
  };
  destination: { chainId: string; genesisHash: Hex; miniLucky: Address; trustGraph: Address; personhoodPrecompile: Address; deploymentBlock: string };
  backend?: { baseUrl: string | null };
  product: unknown;
};

export type RuntimeErrorCode =
  | "MANIFEST_NOT_FOUND"
  | "TEMPLATE_MANIFEST_NOT_RUNTIME_READY"
  | "CONFIGURATION_MISMATCH"
  | "RPC_UNAVAILABLE";

export type RuntimeDiagnostic = {
  ok: boolean;
  code?: RuntimeErrorCode;
  message?: string;
  checks: Record<string, "passed" | "failed" | "skipped">;
};

export function selectedEnvironment(mode: string, value = import.meta.env.VITE_DEPLOYMENT_ENV): DeploymentEnvironment | null {
  if (value && value in deploymentManifests) return value as DeploymentEnvironment;
  if (mode === "development") return "local";
  return null;
}

export function getManifest(environment: DeploymentEnvironment | null): DeploymentManifest | null {
  if (!environment) return null;
  return deploymentManifests[environment] as unknown as DeploymentManifest;
}

export function assertManifestRuntime(manifest: DeploymentManifest): void {
  if (manifest.status !== "deployed") throw new Error("TEMPLATE_MANIFEST_NOT_RUNTIME_READY");
  if (manifest.evmNativeDecimals !== 18 || manifest.source.evmNativeDecimals !== 18) throw new Error("CONFIGURATION_MISMATCH");
  if (!manifest.source.rpcHttpUrls.length || manifest.source.rpcHttpUrls.some((url) => !url)) throw new Error("CONFIGURATION_MISMATCH");
  if (!isAddress(manifest.source.contract) || /^0x0+$/i.test(manifest.source.contract)) throw new Error("CONFIGURATION_MISMATCH");
  if (!manifest.source.runtimeCodeHash || /^0x0+$/i.test(manifest.source.runtimeCodeHash)) throw new Error("CONFIGURATION_MISMATCH");
  if (manifest.source.deploymentBlock === "0") throw new Error("CONFIGURATION_MISMATCH");
}

export function checksumAddress(value: string): Address { return getAddress(value); }

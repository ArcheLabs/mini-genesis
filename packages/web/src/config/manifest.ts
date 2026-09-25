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

export type GenesisWorkStatus = "planned" | "active" | "delivered" | "investigated" | "discontinued";
export type GenesisLocalizedText = { "zh-CN": string; en: string };
export type GenesisWorkItem = {
  id: string;
  name: string;
  status: GenesisWorkStatus;
  summary: string | GenesisLocalizedText;
  evidenceUrl?: string;
};
/** Backward-compatible name used by older Phase I manifests. */
export type GenesisAchievement = GenesisWorkItem;

export type GenesisPhase2Manifest = {
  status: "template" | "active" | "ended";
  mechanism: "linear-bonding-curve";
  contract?: Address;
  deploymentBlock?: string;
  runtimeCodeHash?: Hex;
  allocationMini?: string;
  startPriceX18?: string;
  endPriceX18?: string;
  startTime?: string;
  endTime?: string;
  snapshot?: {
    phase: 2;
    status: "ended";
    allocationMini: string;
    soldMini: string;
    raisedDot: string;
    buyerCount: string;
    startPriceX18: string;
    terminalPriceX18: string;
    startTime: string;
    endTime: string;
    contract: Address;
    deploymentBlock: string;
    runtimeCodeHash: Hex;
  };
};

export type GenesisManifest = {
  phases: {
    phase1: {
      status: "ended";
      mechanism: "stream";
      finalReferencePriceX18?: string;
      achievements?: GenesisAchievement[];
      workItems?: GenesisWorkItem[];
      researchHistory?: GenesisWorkItem[];
    };
    phase2: GenesisPhase2Manifest & { workItems?: GenesisWorkItem[] };
    phase3: { status: "locked" };
  };
};

export type DeploymentManifest = {
  environment: DeploymentEnvironment;
  status: ManifestStatus;
  evmNativeDecimals: number;
  source: {
    chainId: string;
    name: string;
    currencySymbol?: string;
    nativeDecimals: number;
    evmNativeDecimals: number;
    rpcHttpUrls: string[];
    substrateWsUrls: string[];
    substrateGenesisHash: Hex;
    ss58Prefix: number;
    explorerUrl: string;
    contract: Address;
    deploymentBlock: string;
    runtimeCodeHash: Hex;
    contractConfig?: ContractConfig;
  };
  destination: { chainId: string; genesisHash: Hex; miniLucky: Address; trustGraph: Address; personhoodPrecompile: Address; deploymentBlock: string };
  backend?: { baseUrl: string | null };
  product: unknown;
  genesis?: GenesisManifest;
};

export type RuntimeErrorCode =
  | "MANIFEST_NOT_FOUND"
  | "TEMPLATE_MANIFEST_NOT_RUNTIME_READY"
  | "CONFIGURATION_MISMATCH"
  | "SUBSTRATE_RPC_UNAVAILABLE"
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
  if (manifest.environment === "local") {
    if (!Number.isInteger(manifest.source.nativeDecimals) || manifest.source.nativeDecimals < 0 || manifest.source.nativeDecimals > 18) throw new Error("CONFIGURATION_MISMATCH");
    if (!Number.isInteger(manifest.source.ss58Prefix) || manifest.source.ss58Prefix < 0 || manifest.source.ss58Prefix > 16383) throw new Error("CONFIGURATION_MISMATCH");
  } else if (manifest.source.nativeDecimals !== 10 || manifest.source.ss58Prefix !== 0) {
    throw new Error("CONFIGURATION_MISMATCH");
  }
  if (!manifest.source.rpcHttpUrls.length || manifest.source.rpcHttpUrls.some((url) => !url)) throw new Error("CONFIGURATION_MISMATCH");
  if (!manifest.source.substrateWsUrls.length || manifest.source.substrateWsUrls.some((url) => !url)) throw new Error("CONFIGURATION_MISMATCH");
  if (!manifest.source.substrateGenesisHash || /^0x0+$/i.test(manifest.source.substrateGenesisHash)) throw new Error("CONFIGURATION_MISMATCH");
  for (const url of manifest.source.rpcHttpUrls) {
    try {
      const parsed = new URL(url);
      if (manifest.environment === "local") {
        if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) throw new Error();
      } else if (parsed.protocol !== "https:") throw new Error();
    } catch { throw new Error("CONFIGURATION_MISMATCH"); }
  }
  for (const url of manifest.source.substrateWsUrls) {
    try {
      const parsed = new URL(url);
      if (manifest.environment === "local") {
        if (parsed.protocol !== "ws:" || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) throw new Error();
      } else if (parsed.protocol !== "wss:") throw new Error();
    } catch { throw new Error("CONFIGURATION_MISMATCH"); }
  }
  if (manifest.environment !== "local") {
    if (!isAddress(manifest.source.contract) || /^0x0+$/i.test(manifest.source.contract)) throw new Error("CONFIGURATION_MISMATCH");
    if (!manifest.source.runtimeCodeHash || /^0x0+$/i.test(manifest.source.runtimeCodeHash)) throw new Error("CONFIGURATION_MISMATCH");
    if (manifest.source.deploymentBlock === "0") throw new Error("CONFIGURATION_MISMATCH");
  } else {
    const phase2 = manifest.genesis?.phases.phase2;
    if (phase2?.status === "template" || !phase2?.runtimeCodeHash || !phase2Address(manifest)) throw new Error("CONFIGURATION_MISMATCH");
  }
}

export function phase2Address(manifest: DeploymentManifest): Address | null {
  const value = manifest.genesis?.phases.phase2?.contract;
  return value && isAddress(value) && !/^0x0+$/i.test(value) ? value : null;
}

export function checksumAddress(value: string): Address { return getAddress(value); }

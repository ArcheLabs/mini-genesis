import { keccak256, type Address, type PublicClient } from "viem";
import type { DeploymentManifest, RuntimeDiagnostic } from "./manifest";
import { assertManifestRuntime, phase2Address } from "./manifest";
import { genesisAbi } from "../genesis/abi";
import { curveAbi } from "../genesis/curve-abi.generated";

const getterNames = [
  "treasury", "genesisAllocation", "contributionBlocks",
  "protectionBlocks", "firstContributionMinimum", "subsequentContributionMinimumExclusive",
] as const;

export async function validateRuntime(client: PublicClient, manifest: DeploymentManifest): Promise<RuntimeDiagnostic> {
  const checks: RuntimeDiagnostic["checks"] = {};
  try {
    assertManifestRuntime(manifest);
    checks.manifest = "passed";
  } catch (error) {
    return { ok: false, code: error instanceof Error && error.message.startsWith("TEMPLATE") ? "TEMPLATE_MANIFEST_NOT_RUNTIME_READY" : "CONFIGURATION_MISMATCH", message: error instanceof Error ? error.message : "CONFIGURATION_MISMATCH", checks: { manifest: "failed" } };
  }
  try {
    const chainId = await client.getChainId();
    if (String(chainId) !== manifest.source.chainId) throw new Error("chain id mismatch");
    checks.chainId = "passed";
    const bytecode = await client.getBytecode({ address: manifest.source.contract });
    if (!bytecode) throw new Error("contract bytecode missing");
    if (keccak256(bytecode) !== manifest.source.runtimeCodeHash) throw new Error("runtime code hash mismatch");
    checks.bytecode = "passed";
    for (const name of getterNames) {
      const expected = manifest.source.contractConfig?.[name];
      if (expected === undefined) { checks[name] = "skipped"; continue; }
      const actual = await client.readContract({ address: manifest.source.contract, abi: genesisAbi, functionName: name } as any);
      const value = name === "treasury" ? String(actual).toLowerCase() : String(actual);
      if (value !== (name === "treasury" ? String(expected).toLowerCase() : String(expected))) throw new Error(`${name} mismatch`);
      checks[name] = "passed";
    }
    const phase2 = manifest.genesis?.phases.phase2;
    if (phase2 && phase2.status !== "template") {
      const phase2Contract = phase2Address(manifest);
      if (!phase2Contract || !phase2.runtimeCodeHash) throw new Error("phase2 manifest is incomplete");
      const phase2Bytecode = await client.getBytecode({ address: phase2Contract });
      if (!phase2Bytecode || keccak256(phase2Bytecode) !== phase2.runtimeCodeHash) throw new Error("phase2 runtime code hash mismatch");
      checks.phase2Bytecode = "passed";
      const phase2Getters = ["allocation", "startPrice", "endPrice", "startTime", "endTime"] as const;
      for (const name of phase2Getters) {
        const expected = phase2[({ allocation: "allocationMini", startPrice: "startPriceX18", endPrice: "endPriceX18", startTime: "startTime", endTime: "endTime" } as const)[name]];
        if (expected === undefined) throw new Error(`phase2 ${name} is missing`);
        const actual = await client.readContract({ address: phase2Contract, abi: curveAbi, functionName: name } as any);
        if (String(actual) !== expected) throw new Error(`phase2 ${name} mismatch`);
        checks[`phase2.${name}`] = "passed";
      }
    } else {
      checks.phase2Bytecode = "skipped";
    }
    return { ok: true, checks };
  } catch (error) {
    return { ok: false, code: "CONFIGURATION_MISMATCH", message: error instanceof Error ? error.message : "CONFIGURATION_MISMATCH", checks: { ...checks, rpc: "failed" } };
  }
}

export type RuntimeSummary = { address: Address; chainId: bigint };

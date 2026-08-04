import { keccak256, type Address, type Hex, type PublicClient } from "viem";
import type { DeploymentManifest, RuntimeDiagnostic } from "./manifest";
import { assertManifestRuntime } from "./manifest";
import { genesisAbi } from "../genesis/abi";

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
    const block = await client.getBlock({ blockNumber: 0n });
    if (!block.hash || block.hash.toLowerCase() !== manifest.source.genesisHash.toLowerCase()) throw new Error("genesis hash mismatch");
    checks.genesisHash = "passed";
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
    return { ok: true, checks };
  } catch (error) {
    return { ok: false, code: "CONFIGURATION_MISMATCH", message: error instanceof Error ? error.message : "CONFIGURATION_MISMATCH", checks: { ...checks, rpc: "failed" } };
  }
}

export type RuntimeSummary = { address: Address; chainId: bigint; genesisHash: Hex };

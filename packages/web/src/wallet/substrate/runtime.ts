import { decAnyMetadata, unifyMetadata } from "@polkadot-api/substrate-bindings";
import type { PolkadotClient } from "polkadot-api";
import type { DeploymentManifest } from "../../config/manifest";
import { getNativeRuntimeProfile, type NativeExtensionSchemaEntry } from "./runtime-profile";

export type NativeRuntimeCompatibility = "supported" | "runtime_changed" | "wallet_unsupported" | "profile_incomplete" | "network_mismatch";
export type NativeRuntimeCheck = {
  compatibility: NativeRuntimeCompatibility;
  profileId: string;
  actual?: { genesisHash: string; specName: string; specVersion: number; transactionVersion: number; wasmCodeHash: string };
  reason?: string;
};

function normalizeSchema(metadata: any): NativeExtensionSchemaEntry[] {
  return Object.values(metadata.extrinsic.extensions).map((entry: any) => ({
    identifier: String(entry.identifier),
    type: Number(entry.type),
    additionalSigned: Number(entry.additionalSigned),
  }));
}

export function matchesNativeExtensionSchema(actual: NativeExtensionSchemaEntry[], expected: readonly NativeExtensionSchemaEntry[]): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function normalizeHash(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/i.test(value)) throw new Error("RUNTIME_HASH_UNAVAILABLE");
  return value.toLowerCase();
}

export async function checkNativeRuntime(client: PolkadotClient, manifest: DeploymentManifest): Promise<NativeRuntimeCheck> {
  const profile = getNativeRuntimeProfile(manifest);
  if (!profile.enabled) return { compatibility: "profile_incomplete", profileId: profile.id, reason: profile.reason };
  try {
    const chainSpec = await client.getChainSpecData();
    const manifestGenesis = manifest.source.substrateGenesisHash.toLowerCase();
    const actualGenesis = normalizeHash(chainSpec.genesisHash);
    if (actualGenesis !== manifestGenesis || actualGenesis !== profile.fingerprint.genesisHash.toLowerCase()) {
      return { compatibility: "network_mismatch", profileId: profile.id, reason: "NATIVE_NETWORK_MISMATCH" };
    }

    const finalized = await client.getFinalizedBlock();
    const [runtime, codeHash, rawMetadata] = await Promise.all([
      client._request<{ specName: string; specVersion: number; transactionVersion: number }>("state_getRuntimeVersion", [finalized.hash]),
      client._request<string>("state_getStorageHash", ["0x3a636f6465", finalized.hash]),
      client._request<string>("state_getMetadata", [finalized.hash]),
    ]);
    const actual = {
      genesisHash: actualGenesis,
      specName: runtime.specName,
      specVersion: Number(runtime.specVersion),
      transactionVersion: Number(runtime.transactionVersion),
      wasmCodeHash: normalizeHash(codeHash),
    };
    const expected = profile.fingerprint;
    if (actual.specName !== expected.specName || actual.specVersion !== expected.specVersion || actual.transactionVersion !== expected.transactionVersion || actual.wasmCodeHash !== expected.wasmCodeHash.toLowerCase()) {
      return { compatibility: "runtime_changed", profileId: profile.id, actual, reason: "NATIVE_RUNTIME_PROFILE_MISMATCH" };
    }
    if (typeof rawMetadata !== "string" || !/^0x[0-9a-f]+$/i.test(rawMetadata)) {
      return { compatibility: "profile_incomplete", profileId: profile.id, actual, reason: "NATIVE_RUNTIME_PROFILE_INCOMPLETE" };
    }
    const metadata = unifyMetadata(decAnyMetadata(rawMetadata));
    const schema = normalizeSchema(metadata);
    if (!matchesNativeExtensionSchema(schema, profile.extensionSchema)) {
      return { compatibility: "profile_incomplete", profileId: profile.id, actual, reason: "NATIVE_RUNTIME_PROFILE_INCOMPLETE" };
    }
    return { compatibility: "supported", profileId: profile.id, actual };
  } catch (error) {
    return { compatibility: "profile_incomplete", profileId: profile.id, reason: error instanceof Error ? error.message : String(error) };
  }
}

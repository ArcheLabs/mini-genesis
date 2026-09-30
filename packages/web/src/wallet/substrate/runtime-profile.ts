import type { Paseo_asset_hubExtensions } from "@polkadot-api/descriptors";
import type { DeploymentManifest } from "../../config/manifest";

export type NativeRuntimeFingerprint = {
  genesisHash: `0x${string}`;
  specName: string;
  specVersion: number;
  transactionVersion: number;
  wasmCodeHash: `0x${string}`;
};

export type NativeExtensionSchemaEntry = {
  identifier: string;
  type: number;
  additionalSigned: number;
};

export type NativeTransactionOptions = {
  customSignedExtensions: {
    AsPgas: { value: Paseo_asset_hubExtensions["AsPgas"]["value"] };
    AsDotnsGateway: { value: Paseo_asset_hubExtensions["AsDotnsGateway"]["value"] };
    RestrictOrigins: { value: boolean };
  };
};

export type NativeRuntimeProfile = {
  id: string;
  enabled: true;
  fingerprint: NativeRuntimeFingerprint;
  extensionSchema: readonly NativeExtensionSchemaEntry[];
  buildTransactionOptions: () => NativeTransactionOptions;
};

export type PendingNativeRuntimeProfile = { id: string; enabled: false; reason: string };

/** Exact V16 extension schema from Paseo Asset Hub runtime v2.5.2. */
export const PASEO_EXTENSION_SCHEMA: readonly NativeExtensionSchemaEntry[] = [
  { identifier: "UnitTransactionExtension", type: 4, additionalSigned: 4 },
  { identifier: "AuthorizeCall", type: 481, additionalSigned: 4 },
  { identifier: "AsPgas", type: 482, additionalSigned: 4 },
  { identifier: "AsDotnsGateway", type: 485, additionalSigned: 4 },
  { identifier: "RestrictOrigins", type: 488, additionalSigned: 4 },
  { identifier: "CheckNonZeroSender", type: 489, additionalSigned: 4 },
  { identifier: "CheckSpecVersion", type: 490, additionalSigned: 14 },
  { identifier: "CheckTxVersion", type: 491, additionalSigned: 14 },
  { identifier: "CheckGenesis", type: 492, additionalSigned: 16 },
  { identifier: "CheckMortality", type: 493, additionalSigned: 16 },
  { identifier: "CheckNonce", type: 495, additionalSigned: 4 },
  { identifier: "CheckWeight", type: 496, additionalSigned: 4 },
  { identifier: "ChargeAssetTxPayment", type: 497, additionalSigned: 4 },
  { identifier: "PrevalidateAttests", type: 498, additionalSigned: 4 },
  { identifier: "CheckMetadataHash", type: 499, additionalSigned: 466 },
  { identifier: "EthSetOrigin", type: 501, additionalSigned: 4 },
  { identifier: "StorageWeightReclaim", type: 4, additionalSigned: 4 },
];

export const PASEO_ASSET_HUB_PROFILE: NativeRuntimeProfile = {
  id: "paseo-asset-hub-2005002",
  enabled: true,
  fingerprint: {
    genesisHash: "0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2",
    specName: "asset-hub-paseo",
    specVersion: 2005002,
    transactionVersion: 18,
    wasmCodeHash: "0x3d399dc2daeaaf831fc4fda6ddc1958494fc0f3319ebb8ec0c1e7ca8995eed56",
  },
  extensionSchema: PASEO_EXTENSION_SCHEMA,
  buildTransactionOptions: () => ({
    customSignedExtensions: {
      // Ordinary native SS58 origin: no PGAS claim/proof and no DotNS proof.
      AsPgas: { value: undefined },
      AsDotnsGateway: { value: undefined },
      // Runtime source requires restricted-origin validation for user calls.
      RestrictOrigins: { value: true },
    },
  }),
};

export const POLKADOT_ASSET_HUB_PRODUCTION_PROFILE: PendingNativeRuntimeProfile = {
  id: "polkadot-asset-hub-production",
  enabled: false,
  reason: "Production runtime fingerprint and custom extension semantics must be confirmed before enabling native submissions.",
};

export function getNativeRuntimeProfile(manifest: DeploymentManifest): NativeRuntimeProfile | PendingNativeRuntimeProfile {
  if (manifest.environment === "staging" && manifest.source.substrateRuntime?.profileId === PASEO_ASSET_HUB_PROFILE.id) return PASEO_ASSET_HUB_PROFILE;
  if (manifest.environment === "production") return POLKADOT_ASSET_HUB_PRODUCTION_PROFILE;
  return { id: "local-native-runtime-unconfigured", enabled: false, reason: "No reviewed local native runtime profile is configured." };
}

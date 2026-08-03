import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const ENVIRONMENTS = ["local", "staging", "production"];
const ZERO = /^0x0+$/i; const HASH = /^0x[0-9a-fA-F]{64}$/; const ADDRESS = /^0x[0-9a-fA-F]{40}$/; const DECIMAL = /^\d+$/;
const required = (value, name) => { if (value === undefined || value === "") throw new Error(`MISSING_${name}`); return value; };
const check = (value, pattern, name) => { if (typeof value !== "string" || !pattern.test(value)) throw new Error(`INVALID_${name}`); return value; };
export function validateManifest(manifest, environment, options = {}) {
  if (manifest?.environment !== environment) throw new Error(`INVALID_ENVIRONMENT_${environment}`);
  if (!['template', 'deployed'].includes(manifest.status)) throw new Error(`INVALID_STATUS_${environment}`);
  const { source, destination, product } = manifest; if (!source || !destination) throw new Error("MISSING_NETWORK");
  check(required(source.chainId, "SOURCE_CHAIN_ID"), DECIMAL, "SOURCE_CHAIN_ID"); check(source.genesisHash, HASH, "SOURCE_GENESIS_HASH"); check(source.contract, ADDRESS, "SOURCE_CONTRACT"); check(source.runtimeCodeHash, HASH, "SOURCE_RUNTIME_CODE_HASH"); check(required(source.deploymentBlock, "SOURCE_DEPLOYMENT_BLOCK"), DECIMAL, "SOURCE_DEPLOYMENT_BLOCK");
  if (typeof source.name !== "string" || !source.name) throw new Error("MISSING_SOURCE_NAME");
  if (typeof source.currencySymbol !== "string" || !source.currencySymbol) throw new Error("MISSING_SOURCE_CURRENCY");
  if (source.evmNativeDecimals !== 18) throw new Error("INVALID_SOURCE_EVM_NATIVE_DECIMALS");
  if (!Array.isArray(source.rpcHttpUrls) || source.rpcHttpUrls.some((url) => typeof url !== "string" || (url && !/^https:\/\//.test(url)))) throw new Error("INVALID_SOURCE_RPC_URLS");
  if (typeof source.explorerUrl !== "string" || (source.explorerUrl && !/^https:\/\//.test(source.explorerUrl))) throw new Error("INVALID_SOURCE_EXPLORER_URL");
  check(required(destination.chainId, "DESTINATION_CHAIN_ID"), DECIMAL, "DESTINATION_CHAIN_ID"); check(destination.genesisHash, HASH, "DESTINATION_GENESIS_HASH"); check(destination.miniLucky, ADDRESS, "DESTINATION_MINI_LUCKY"); check(destination.trustGraph, ADDRESS, "DESTINATION_TRUST_GRAPH"); check(destination.personhoodPrecompile, ADDRESS, "PERSONHOOD_PRECOMPILE"); check(required(destination.deploymentBlock, "DESTINATION_DEPLOYMENT_BLOCK"), DECIMAL, "DESTINATION_DEPLOYMENT_BLOCK");
  if (environment === "local") { if (product !== null) throw new Error("LOCAL_PRODUCT_MUST_BE_NULL"); } else { if (!product || product.dotName !== (environment === "staging" ? "mini-lucky-dev.dot" : "mini-lucky.dot")) throw new Error(`INVALID_${environment.toUpperCase()}_PRODUCT`); check(product.ownerH160, ADDRESS, "PRODUCT_OWNER_H160"); }
  if (manifest.evmNativeDecimals !== 18) throw new Error("INVALID_EVM_NATIVE_DECIMALS");
  if (manifest.status === "deployed" || options.runtimeReady) { if (manifest.status !== "deployed") throw new Error(`TEMPLATE_MANIFEST_NOT_RUNTIME_READY_${environment}`); for (const value of [source.contract, source.genesisHash, source.runtimeCodeHash, source.deploymentBlock, destination.miniLucky, destination.trustGraph, destination.genesisHash, destination.deploymentBlock]) if (value === "0" || ZERO.test(value)) throw new Error(`ZERO_DEPLOYMENT_VALUE_${environment}`); if (source.rpcHttpUrls.length === 0 || source.rpcHttpUrls.some((url) => !url)) throw new Error(`MISSING_SOURCE_RPC_${environment}`); if (!source.explorerUrl) throw new Error(`MISSING_SOURCE_EXPLORER_${environment}`); const supported = options.supportedChainIds ?? []; if (!supported.includes(source.chainId) || !supported.includes(destination.chainId)) throw new Error(`UNSUPPORTED_CHAIN_ID_${environment}`); }
  return manifest;
}
export async function readManifest(environment, options) { return validateManifest(JSON.parse(await readFile(resolve("deployments", `${environment}.json`), "utf8")), environment, options); }

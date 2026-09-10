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
  check(required(source.chainId, "SOURCE_CHAIN_ID"), DECIMAL, "SOURCE_CHAIN_ID"); check(source.contract, ADDRESS, "SOURCE_CONTRACT"); check(source.runtimeCodeHash, HASH, "SOURCE_RUNTIME_CODE_HASH"); check(required(source.deploymentBlock, "SOURCE_DEPLOYMENT_BLOCK"), DECIMAL, "SOURCE_DEPLOYMENT_BLOCK");
  if (typeof source.name !== "string" || !source.name) throw new Error("MISSING_SOURCE_NAME");
  if (typeof source.currencySymbol !== "string" || !source.currencySymbol) throw new Error("MISSING_SOURCE_CURRENCY");
  if (source.nativeDecimals !== 10) throw new Error("INVALID_SOURCE_NATIVE_DECIMALS");
  if (source.evmNativeDecimals !== 18) throw new Error("INVALID_SOURCE_EVM_NATIVE_DECIMALS");
  if (source.ss58Prefix !== 0) throw new Error("INVALID_SOURCE_SS58_PREFIX");
  if (!Array.isArray(source.rpcHttpUrls) || source.rpcHttpUrls.some((url) => typeof url !== "string" || (url && !/^https:\/\//.test(url)))) throw new Error("INVALID_SOURCE_RPC_URLS");
  if (!Array.isArray(source.substrateWsUrls) || source.substrateWsUrls.some((url) => typeof url !== "string" || (url && !/^wss:\/\//.test(url)))) throw new Error("INVALID_SOURCE_SUBSTRATE_WS_URLS");
  if (typeof source.explorerUrl !== "string" || (source.explorerUrl && !/^https:\/\//.test(source.explorerUrl))) throw new Error("INVALID_SOURCE_EXPLORER_URL");
  check(required(destination.chainId, "DESTINATION_CHAIN_ID"), DECIMAL, "DESTINATION_CHAIN_ID"); check(destination.genesisHash, HASH, "DESTINATION_GENESIS_HASH"); check(destination.miniLucky, ADDRESS, "DESTINATION_MINI_LUCKY"); check(destination.trustGraph, ADDRESS, "DESTINATION_TRUST_GRAPH"); check(destination.personhoodPrecompile, ADDRESS, "PERSONHOOD_PRECOMPILE"); check(required(destination.deploymentBlock, "DESTINATION_DEPLOYMENT_BLOCK"), DECIMAL, "DESTINATION_DEPLOYMENT_BLOCK");
  if (environment === "local") { if (product !== null) throw new Error("LOCAL_PRODUCT_MUST_BE_NULL"); } else { if (!product || product.dotName !== (environment === "staging" ? "mini-lucky-dev.dot" : "mini-lucky.dot")) throw new Error(`INVALID_${environment.toUpperCase()}_PRODUCT`); check(product.ownerH160, ADDRESS, "PRODUCT_OWNER_H160"); }
  if (manifest.evmNativeDecimals !== 18) throw new Error("INVALID_EVM_NATIVE_DECIMALS");
  validateGenesisPhases(manifest.genesis, environment);
  if (manifest.status === "deployed" || options.runtimeReady) { if (manifest.status !== "deployed") throw new Error(`TEMPLATE_MANIFEST_NOT_RUNTIME_READY_${environment}`); for (const value of [source.contract, source.runtimeCodeHash, source.deploymentBlock]) if (value === "0" || ZERO.test(value)) throw new Error(`ZERO_DEPLOYMENT_VALUE_${environment}`); if (source.rpcHttpUrls.length === 0 || source.rpcHttpUrls.some((url) => !url)) throw new Error(`MISSING_SOURCE_RPC_${environment}`); if (!source.explorerUrl) throw new Error(`MISSING_SOURCE_EXPLORER_${environment}`); const supported = options.supportedChainIds ?? []; if (supported.length && (!supported.includes(source.chainId) || !supported.includes(destination.chainId))) throw new Error(`UNSUPPORTED_CHAIN_ID_${environment}`); }
  return manifest;
}

function validateGenesisPhases(genesis, environment) {
  if (genesis === undefined) return;
  const phases = genesis?.phases;
  if (!phases || typeof phases !== "object") throw new Error(`INVALID_GENESIS_PHASES_${environment}`);
  const phaseNames = Object.keys(phases).sort();
  if (phaseNames.length !== 3 || phaseNames.join(",") !== "phase1,phase2,phase3") throw new Error(`INVALID_GENESIS_PHASE_SET_${environment}`);
  if (phases.phase1?.status !== "ended" || phases.phase1?.mechanism !== "stream") throw new Error(`INVALID_GENESIS_PHASE1_${environment}`);
  if (phases.phase3?.status !== "locked") throw new Error(`INVALID_GENESIS_PHASE3_${environment}`);
  const phase2 = phases.phase2;
  if (!phase2 || !["template", "active", "ended"].includes(phase2.status) || phase2.mechanism !== "linear-bonding-curve") throw new Error(`INVALID_GENESIS_PHASE2_${environment}`);
  if (phase2.status === "template") return;
  check(phase2.contract, ADDRESS, "GENESIS_PHASE2_CONTRACT");
  check(required(phase2.deploymentBlock, "GENESIS_PHASE2_DEPLOYMENT_BLOCK"), DECIMAL, "GENESIS_PHASE2_DEPLOYMENT_BLOCK");
  check(phase2.runtimeCodeHash, HASH, "GENESIS_PHASE2_RUNTIME_CODE_HASH");
  if (ZERO.test(phase2.contract) || ZERO.test(phase2.runtimeCodeHash) || phase2.deploymentBlock === "0") throw new Error(`ZERO_GENESIS_PHASE2_DEPLOYMENT_${environment}`);
  for (const [value, name] of [[phase2.allocationMini, "GENESIS_PHASE2_ALLOCATION"], [phase2.startPriceX18, "GENESIS_PHASE2_START_PRICE"], [phase2.endPriceX18, "GENESIS_PHASE2_END_PRICE"], [phase2.startTime, "GENESIS_PHASE2_START_TIME"], [phase2.endTime, "GENESIS_PHASE2_END_TIME"]]) check(required(value, name), DECIMAL, name);
  if (environment === "production" && BigInt(phase2.allocationMini) !== 2_000_000n * 10n ** 18n) throw new Error(`INVALID_GENESIS_PHASE2_ALLOCATION_${environment}`);
  if (environment === "production" && (BigInt(phase2.startPriceX18) !== 750_000_000_000_000n || BigInt(phase2.endPriceX18) !== 1_250_000_000_000_000n)) throw new Error(`INVALID_GENESIS_PHASE2_PRICES_${environment}`);
  if (BigInt(phase2.allocationMini) === 0n || BigInt(phase2.startPriceX18) === 0n || BigInt(phase2.endPriceX18) <= BigInt(phase2.startPriceX18)) throw new Error(`INVALID_GENESIS_PHASE2_ECONOMICS_${environment}`);
  if (BigInt(phase2.endTime) <= BigInt(phase2.startTime)) throw new Error(`INVALID_GENESIS_PHASE2_TIME_${environment}`);
  if (phase2.status !== "ended") return;
  const snapshot = phase2.snapshot;
  if (!snapshot || snapshot.phase !== 2 || snapshot.status !== "ended") throw new Error(`MISSING_GENESIS_PHASE2_SNAPSHOT_${environment}`);
  check(snapshot.contract, ADDRESS, "GENESIS_PHASE2_SNAPSHOT_CONTRACT");
  check(snapshot.runtimeCodeHash, HASH, "GENESIS_PHASE2_SNAPSHOT_RUNTIME_CODE_HASH");
  for (const [value, name] of [[snapshot.allocationMini, "GENESIS_PHASE2_SNAPSHOT_ALLOCATION"], [snapshot.soldMini, "GENESIS_PHASE2_SNAPSHOT_SOLD"], [snapshot.raisedDot, "GENESIS_PHASE2_SNAPSHOT_RAISED"], [snapshot.buyerCount, "GENESIS_PHASE2_SNAPSHOT_BUYERS"], [snapshot.startPriceX18, "GENESIS_PHASE2_SNAPSHOT_START_PRICE"], [snapshot.terminalPriceX18, "GENESIS_PHASE2_SNAPSHOT_TERMINAL_PRICE"], [snapshot.startTime, "GENESIS_PHASE2_SNAPSHOT_START_TIME"], [snapshot.endTime, "GENESIS_PHASE2_SNAPSHOT_END_TIME"], [snapshot.deploymentBlock, "GENESIS_PHASE2_SNAPSHOT_DEPLOYMENT_BLOCK"]]) check(required(value, name), DECIMAL, name);
  if (snapshot.contract.toLowerCase() !== phase2.contract.toLowerCase() || snapshot.runtimeCodeHash.toLowerCase() !== phase2.runtimeCodeHash.toLowerCase() || snapshot.deploymentBlock !== phase2.deploymentBlock) throw new Error(`MISMATCHED_GENESIS_PHASE2_SNAPSHOT_${environment}`);
  for (const [snapshotValue, phaseValue, name] of [[snapshot.allocationMini, phase2.allocationMini, "ALLOCATION"], [snapshot.startPriceX18, phase2.startPriceX18, "START_PRICE"], [snapshot.endPriceX18, phase2.endPriceX18, "END_PRICE"], [snapshot.startTime, phase2.startTime, "START_TIME"], [snapshot.endTime, phase2.endTime, "END_TIME"]]) if (snapshotValue !== phaseValue) throw new Error(`MISMATCHED_GENESIS_PHASE2_SNAPSHOT_${name}_${environment}`);
  if (BigInt(snapshot.soldMini) > BigInt(snapshot.allocationMini) || BigInt(snapshot.terminalPriceX18) < BigInt(snapshot.startPriceX18) || BigInt(snapshot.terminalPriceX18) > BigInt(snapshot.endPriceX18)) throw new Error(`INVALID_GENESIS_PHASE2_SNAPSHOT_VALUES_${environment}`);
}
export async function readManifest(environment, options) { return validateManifest(JSON.parse(await readFile(resolve("deployments", `${environment}.json`), "utf8")), environment, options); }

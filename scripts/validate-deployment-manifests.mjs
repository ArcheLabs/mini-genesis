import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const environments = ["local", "staging", "production"];
const hex = (bytes) => new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`);
const address = /^0x[0-9a-fA-F]{40}$/;
const required = (value, name) => { if (value === undefined || value === "") throw new Error(`MISSING_${name}`); return value; };
const check = (value, pattern, name) => { if (typeof value !== "string" || !pattern.test(value)) throw new Error(`INVALID_${name}`); };

for (const environment of environments) {
  const manifest = JSON.parse(await readFile(resolve("deployments", `${environment}.json`), "utf8"));
  if (manifest.environment !== environment) throw new Error(`INVALID_ENVIRONMENT_${environment}`);
  const { source, destination, product } = manifest;
  for (const [section, value] of Object.entries({ source, destination, product })) if (!value || typeof value !== "object") throw new Error(`MISSING_${section.toUpperCase()}`);
  required(source.chainId, "SOURCE_CHAIN_ID"); check(source.genesisHash, hex(32), "SOURCE_GENESIS_HASH"); check(source.contract, address, "SOURCE_CONTRACT"); check(source.runtimeCodeHash, hex(32), "SOURCE_RUNTIME_CODE_HASH");
  required(destination.chainId, "DESTINATION_CHAIN_ID"); check(destination.genesisHash, hex(32), "DESTINATION_GENESIS_HASH"); check(destination.miniLucky, address, "DESTINATION_MINI_LUCKY"); check(destination.trustGraph, address, "DESTINATION_TRUST_GRAPH"); check(destination.personhoodPrecompile, address, "PERSONHOOD_PRECOMPILE");
  required(product.productId, "PRODUCT_ID"); required(product.dotName, "DOT_NAME"); check(product.ownerH160, address, "PRODUCT_OWNER_H160");
  if (manifest.evmNativeDecimals !== 18) throw new Error("INVALID_EVM_NATIVE_DECIMALS");
}

console.log("Deployment manifests valid: local, staging, production");

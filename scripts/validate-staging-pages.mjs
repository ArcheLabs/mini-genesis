import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest } from "./deployment-manifest.mjs";

export const POLKADOT_HUB_TESTNET_RPCS = [
  "https://services.polkadothub-rpc.com/testnet/",
  "https://eth-rpc-testnet.polkadot.io/",
];

const PHASE2_ALLOCATION = "2000000000000000000000000";
const PHASE2_START_PRICE_X18 = "3500000000000000";
const PHASE2_END_PRICE_X18 = "5500000000000000";
const PHASE2_DURATION_SECONDS = 7n * 24n * 60n * 60n;
const PHASE2_WORK_ITEM_IDS = [
  "minijam",
  "jamscript",
  "ownership-abstraction",
  "minicells",
  "locus",
];

export function validateStagingPagesManifest(manifest) {
  validateManifest(manifest, "staging", { runtimeReady: true });
  assert.equal(manifest.status, "deployed", "staging manifest must be deployed");
  assert.equal(manifest.source.chainId, "420420417", "staging chain ID must be Polkadot Hub TestNet");
  assert.equal(manifest.source.name, "Polkadot Hub TestNet");
  assert.equal(manifest.source.currencySymbol, "PAS");
  assert.deepEqual(manifest.source.rpcHttpUrls, POLKADOT_HUB_TESTNET_RPCS, "staging must use both public TestNet RPCs in fallback order");

  const phase2 = manifest.genesis?.phases?.phase2;
  assert.equal(phase2?.status, "active", "Genesis II must be deployed and active");
  assert.notEqual(phase2?.contract?.toLowerCase(), `0x${"0".repeat(40)}`, "Genesis II contract must be nonzero");
  assert.notEqual(phase2?.runtimeCodeHash?.toLowerCase(), `0x${"0".repeat(64)}`, "Genesis II runtime code hash must be nonzero");
  assert.ok(BigInt(phase2?.deploymentBlock ?? "0") > 0n, "Genesis II deployment block must be positive");
  assert.equal(phase2?.allocationMini, PHASE2_ALLOCATION);
  assert.equal(phase2?.startPriceX18, PHASE2_START_PRICE_X18);
  assert.equal(phase2?.endPriceX18, PHASE2_END_PRICE_X18);
  assert.equal(BigInt(phase2?.endTime ?? "0") - BigInt(phase2?.startTime ?? "0"), PHASE2_DURATION_SECONDS);
  assert.deepEqual(phase2?.workItems?.map(({ id }) => id), PHASE2_WORK_ITEM_IDS, "Genesis II work items must be preserved");
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile("deployments/staging.json", "utf8"));
  validateStagingPagesManifest(manifest);
  console.log("Staging Pages release manifest validation passed.");
}

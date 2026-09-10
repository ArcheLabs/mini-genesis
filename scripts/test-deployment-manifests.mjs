import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateManifest } from "./deployment-manifest.mjs";
for (const environment of ["local", "staging", "production"]) {
  const manifest = JSON.parse(await readFile(`deployments/${environment}.json`, "utf8"));
  assert.equal(manifest.genesis.phases.phase1.status, "ended");
  assert.equal(manifest.genesis.phases.phase1.mechanism, "stream");
  assert.equal(manifest.genesis.phases.phase2.status, "template");
  assert.equal(manifest.genesis.phases.phase2.mechanism, "linear-bonding-curve");
  assert.equal(manifest.genesis.phases.phase3.status, "locked");
  validateManifest(manifest, environment);
  assert.throws(() => validateManifest({ ...manifest, genesis: { ...manifest.genesis, phases: { ...manifest.genesis.phases, phase4: { status: "locked" } } } }, environment), /INVALID_GENESIS_PHASE_SET/);
}
for (const environment of ["staging", "production"]) { const manifest = JSON.parse(await readFile(`deployments/${environment}.json`, "utf8")); assert.throws(() => validateManifest({ ...manifest, status: "deployed" }, environment, { runtimeReady: true, supportedChainIds: ["1"] }), /ZERO_|UNSUPPORTED_CHAIN_ID/); }
console.log("Template readiness tests passed: staging and production placeholders are not runtime-ready");

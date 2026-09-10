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
  assert.throws(
    () => validateManifest({ ...manifest, genesis: { ...manifest.genesis, phases: { ...manifest.genesis.phases, phase4: { status: "locked" } } } }, environment),
    /INVALID_GENESIS_PHASE_SET/,
  );
}

for (const environment of ["staging", "production"]) {
  const manifest = JSON.parse(await readFile(`deployments/${environment}.json`, "utf8"));
  assert.throws(
    () => validateManifest({ ...manifest, status: "deployed" }, environment, { runtimeReady: true, supportedChainIds: ["1"] }),
    /ZERO_|UNSUPPORTED_CHAIN_ID/,
  );
}

{
  const manifest = JSON.parse(await readFile("deployments/production.json", "utf8"));
  const activePhase2 = {
    status: "active",
    mechanism: "linear-bonding-curve",
    contract: "0x1111111111111111111111111111111111111111",
    deploymentBlock: "1",
    runtimeCodeHash: `0x${"11".repeat(32)}`,
    allocationMini: (2_000_000n * 10n ** 18n).toString(),
    startPriceX18: "750000000000000",
    endPriceX18: "1250000000000000",
    startTime: "2000000000",
    endTime: (2_000_000_000n + 7n * 24n * 60n * 60n).toString(),
  };
  const productionWithPhase2 = {
    ...manifest,
    genesis: {
      ...manifest.genesis,
      phases: { ...manifest.genesis.phases, phase2: activePhase2 },
    },
  };
  validateManifest(productionWithPhase2, "production");
  assert.throws(
    () => validateManifest({
      ...productionWithPhase2,
      genesis: {
        ...productionWithPhase2.genesis,
        phases: {
          ...productionWithPhase2.genesis.phases,
          phase2: { ...activePhase2, endTime: (BigInt(activePhase2.endTime) + 1n).toString() },
        },
      },
    }, "production"),
    /INVALID_GENESIS_PHASE2_DURATION_production/,
  );
}

console.log("Template readiness tests passed: staging and production placeholders are not runtime-ready");
console.log("Production Phase II duration gate passed: only an exact seven-day window is accepted");

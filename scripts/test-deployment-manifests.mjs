import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateManifest } from "./deployment-manifest.mjs";
import { validateStagingPagesManifest } from "./validate-staging-pages.mjs";

for (const environment of ["local", "staging", "production"]) {
  const manifest = JSON.parse(await readFile(`deployments/${environment}.json`, "utf8"));
  assert.equal(manifest.genesis.phases.phase1.status, "ended");
  assert.equal(manifest.genesis.phases.phase1.mechanism, "stream");
  if (environment === "local" && manifest.status === "deployed") {
    assert.equal(manifest.genesis.phases.phase2.status, "active");
    assert.match(manifest.source.rpcHttpUrls[0], /^http:\/\/127\.0\.0\.1:8545\/?$/);
    assert.match(manifest.source.substrateWsUrls[0], /^ws:\/\/127\.0\.0\.1:9944\/?$/);
  } else if (environment === "staging" && manifest.status === "deployed") {
    validateStagingPagesManifest(manifest);
  } else {
    assert.equal(manifest.genesis.phases.phase2.status, "template");
  }
  assert.equal(manifest.genesis.phases.phase2.mechanism, "linear-bonding-curve");
  assert.equal(manifest.genesis.phases.phase1.workItems?.length, 4);
  assert.equal(manifest.genesis.phases.phase1.researchHistory?.[0]?.status, "discontinued");
  assert.equal(manifest.genesis.phases.phase2.workItems?.length, 5);
  assert.deepEqual(
    manifest.genesis.phases.phase2.workItems?.map((item) => item.id),
    ["minijam", "jamscript", "ownership-abstraction", "minicells", "locus"],
  );
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
  const staging = JSON.parse(await readFile("deployments/staging.json", "utf8"));
  validateManifest(staging, "staging");
  const firstWorkItem = staging.genesis.phases.phase2.workItems[0];
  const tasks = firstWorkItem.tasks;
  assert.doesNotThrow(() => validateManifest({
    ...staging,
    genesis: { ...staging.genesis, phases: { ...staging.genesis.phases, phase2: {
      ...staging.genesis.phases.phase2,
      workItems: [{ ...firstWorkItem, tasks: [...tasks, { ...tasks[0], id: "discontinued-status-fixture", status: "discontinued" }] }, ...staging.genesis.phases.phase2.workItems.slice(1)],
    } } },
  }, "staging"));
  assert.throws(() => validateManifest({
    ...staging,
    genesis: { ...staging.genesis, phases: { ...staging.genesis.phases, phase2: {
      ...staging.genesis.phases.phase2,
      workItems: [{ ...staging.genesis.phases.phase2.workItems[0], tasks: [{ ...tasks[0], status: "investigated" }] }],
    } } },
  }, "staging"), /INVALID_.*_TASK/);
}

{
  const local = JSON.parse(await readFile("deployments/local.json", "utf8"));
  if (local.status === "deployed") {
    assert.throws(
      () => validateManifest({ ...local, source: { ...local.source, rpcHttpUrls: ["https://example.org/"] } }, "local"),
      /INVALID_SOURCE_RPC_URLS/,
    );
    assert.throws(
      () => validateManifest({ ...local, source: { ...local.source, substrateWsUrls: ["wss://example.org/"] } }, "local"),
      /INVALID_SOURCE_SUBSTRATE_WS_URLS/,
    );
  }
  const staging = JSON.parse(await readFile("deployments/staging.json", "utf8"));
  assert.throws(
    () => validateManifest({ ...staging, source: { ...staging.source, rpcHttpUrls: ["http://127.0.0.1:8545"] } }, "staging"),
    /INVALID_SOURCE_RPC_URLS/,
  );
}

{
  const manifest = JSON.parse(await readFile("deployments/production.json", "utf8"));
  const activePhase2 = {
    status: "active",
    mechanism: "linear-bonding-curve",
    contract: "0x1111111111111111111111111111111111111111",
    treasury: "0x2222222222222222222222222222222222222222",
    deploymentBlock: "1",
    runtimeCodeHash: `0x${"11".repeat(32)}`,
    allocationMini: (2_000_000n * 10n ** 18n).toString(),
    startPriceX18: "3500000000000000",
    endPriceX18: "5500000000000000",
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

  const staging = JSON.parse(await readFile("deployments/staging.json", "utf8"));
  const stagingWithPhase2 = {
    ...staging,
    genesis: {
      ...staging.genesis,
      phases: {
        ...staging.genesis.phases,
        phase2: { ...activePhase2, workItems: staging.genesis.phases.phase2.workItems },
      },
    },
  };
  validateManifest(stagingWithPhase2, "staging");
  validateStagingPagesManifest(stagingWithPhase2);
  assert.throws(
    () => validateStagingPagesManifest({
      ...stagingWithPhase2,
      source: { ...stagingWithPhase2.source, rpcHttpUrls: ["https://eth-rpc-testnet.polkadot.io/"] },
    }),
  );
  assert.throws(
    () => validateManifest({
      ...stagingWithPhase2,
      genesis: {
        ...stagingWithPhase2.genesis,
        phases: {
          ...stagingWithPhase2.genesis.phases,
          phase2: { ...activePhase2, endTime: (BigInt(activePhase2.endTime) + 1n).toString() },
        },
      },
    }, "staging"),
    /INVALID_GENESIS_PHASE2_DURATION_staging/,
  );
}

console.log("Deployment manifest readiness tests passed: staging and production states are validated");
console.log("Staging and production Phase II duration gates passed: only an exact seven-day window is accepted");

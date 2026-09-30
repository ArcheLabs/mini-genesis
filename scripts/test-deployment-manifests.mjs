import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { PHASE2_DURATION_SECONDS, validateManifest } from "./deployment-manifest.mjs";
import { isConfiguredRpcUrl } from "./rpc-selection.mjs";
import { validateStagingPagesManifest } from "./validate-staging-pages.mjs";

{
  const staging = JSON.parse(await readFile("deployments/staging.json", "utf8"));
  assert.equal(isConfiguredRpcUrl("https://services.polkadothub-rpc.com/testnet/", staging.source.rpcHttpUrls), true);
  assert.equal(isConfiguredRpcUrl("https://eth-rpc-testnet.polkadot.io/", staging.source.rpcHttpUrls), true);
  assert.equal(isConfiguredRpcUrl("https://rpc.example.invalid/", staging.source.rpcHttpUrls), false);
}

for (const environment of ["local", "staging", "production"]) {
  const manifest = JSON.parse(await readFile(`deployments/${environment}.json`, "utf8"));
  assert.equal(manifest.genesis.phases.phase1.status, "ended");
  assert.equal(manifest.genesis.phases.phase1.mechanism, "stream");
  if (environment === "local" && manifest.status === "deployed") {
    assert.equal(manifest.genesis.phases.phase2.status, "active");
    assert.match(manifest.source.rpcHttpUrls[0], /^http:\/\/127\.0\.0\.1:8545\/?$/);
    assert.match(manifest.source.substrateWsUrls[0], /^ws:\/\/127\.0\.0\.1:9944\/?$/);
  } else if (environment === "staging" && manifest.status === "deployed" && manifest.genesis.phases.phase2.status === "active") {
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

for (const [environment, offset] of [["staging", -1n], ["staging", 1n], ["production", -1n], ["production", 1n]]) {
  const start = 2_000_000_000n;
  const expected = PHASE2_DURATION_SECONDS[environment];
  const result = spawnSync(process.execPath, ["scripts/deploy-phase2.mjs", environment, "--finalize-only"], {
    encoding: "utf8",
    env: {
      ...process.env,
      RPC_URL: "https://rpc.example.invalid",
      TREASURY: "0x2222222222222222222222222222222222222222",
      PHASE2_ALLOCATION: (2_000_000n * 10n ** 18n).toString(),
      PHASE2_START_PRICE_X18: "3500000000000000",
      PHASE2_END_PRICE_X18: "5500000000000000",
      PHASE2_START_TIMESTAMP: start.toString(),
      PHASE2_END_TIMESTAMP: (start + expected + offset).toString(),
      EXPECTED_CHAIN_ID: environment === "staging" ? "420420417" : "420420419",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(`Phase II duration must be exactly ${expected} seconds for ${environment}`));
}

{
  const staging = JSON.parse(await readFile("deployments/staging.json", "utf8"));
  validateManifest(staging, "staging");
  assert.equal(staging.genesis.phases.phase2.previousDeployment.status, "retained-immutable");
  assert.equal(staging.genesis.phases.phase2.previousDeployment.contract, "0x59964457dc4045988eaa7cf4d928970798aa5adf");
  assert.equal(
    BigInt(staging.genesis.phases.phase2.previousDeployment.endTime) - BigInt(staging.genesis.phases.phase2.previousDeployment.startTime),
    7n * 24n * 60n * 60n,
  );
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
    endTime: (2_000_000_000n + PHASE2_DURATION_SECONDS.production).toString(),
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
  for (const offset of [-1n, 1n]) {
    assert.throws(
      () => validateManifest({
        ...productionWithPhase2,
        genesis: {
          ...productionWithPhase2.genesis,
          phases: {
            ...productionWithPhase2.genesis.phases,
            phase2: { ...activePhase2, endTime: (BigInt(activePhase2.endTime) + offset).toString() },
          },
        },
      }, "production"),
      /INVALID_GENESIS_PHASE2_DURATION_production/,
    );
  }

  const staging = JSON.parse(await readFile("deployments/staging.json", "utf8"));
  const stagingWithPhase2 = {
    ...staging,
    genesis: {
      ...staging.genesis,
      phases: {
        ...staging.genesis.phases,
        phase2: {
          ...activePhase2,
          endTime: (BigInt(activePhase2.startTime) + PHASE2_DURATION_SECONDS.staging).toString(),
          workItems: staging.genesis.phases.phase2.workItems,
        },
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
  for (const offset of [-1n, 1n]) {
    assert.throws(
      () => validateManifest({
        ...stagingWithPhase2,
        genesis: {
          ...stagingWithPhase2.genesis,
          phases: {
            ...stagingWithPhase2.genesis.phases,
            phase2: {
              ...stagingWithPhase2.genesis.phases.phase2,
              endTime: (BigInt(activePhase2.startTime) + PHASE2_DURATION_SECONDS.staging + offset).toString(),
            },
          },
        },
      }, "staging"),
      /INVALID_GENESIS_PHASE2_DURATION_staging/,
    );
  }
}

console.log("Deployment manifest readiness tests passed: staging and production states are validated");
console.log("Phase II duration gates passed: staging is exactly 1 hour; production is exactly 15 days");

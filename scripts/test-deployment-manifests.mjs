import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateManifest } from "./deployment-manifest.mjs";
for (const environment of ["staging", "production"]) { const manifest = JSON.parse(await readFile(`deployments/${environment}.json`, "utf8")); assert.throws(() => validateManifest({ ...manifest, status: "deployed" }, environment, { runtimeReady: true, supportedChainIds: ["1"] }), /ZERO_|UNSUPPORTED_CHAIN_ID/); }
console.log("Template readiness tests passed: staging and production placeholders are not runtime-ready");

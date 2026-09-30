import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "packages/web/dist");
const expectedBase = process.argv[2] ?? "/";
const production = JSON.parse(await readFile(resolve(root, "deployments/production.json"), "utf8"));
const staging = JSON.parse(await readFile(resolve(root, "deployments/staging.json"), "utf8"));

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

const files = await filesUnder(dist);
const indexPath = resolve(dist, "index.html");
const html = await readFile(indexPath, "utf8");
const js = (await Promise.all(files.filter((path) => path.endsWith(".js")).map((path) => readFile(path, "utf8")))).join("\n");

assert.match(html, /<script[^>]+src="([^"]+)"/, "production index must reference a built JavaScript entry");
const scriptUrl = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
assert.ok(scriptUrl?.startsWith(expectedBase), `asset URL ${scriptUrl} must use production base path ${expectedBase}`);
assert.ok(js.includes(String(production.source.chainId)), "production bundle must contain the Mainnet EVM chain id");
assert.ok(js.includes(production.source.rpcHttpUrls[0]), "production bundle must contain the Mainnet EVM RPC URL");
assert.ok(js.toLowerCase().includes(production.source.contract.toLowerCase()), "production bundle must contain the Genesis I production contract");
assert.ok(!js.includes(String(staging.source.chainId)), "production bundle must not include the staging chain as a runtime target");
const stagingPhase2Contract = staging.genesis?.phases?.phase2?.contract;
if (stagingPhase2Contract) {
  assert.ok(!js.toLowerCase().includes(stagingPhase2Contract.toLowerCase()), "production bundle must not include the staging Phase II contract");
}

console.log(`Production frontend artifact passed (${expectedBase}).`);

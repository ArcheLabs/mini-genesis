import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const environment = process.argv[2];
if (environment !== "staging" && environment !== "production") throw new Error("Environment must be staging or production");
const rpcUrl = process.env.RPC_URL;
if (!rpcUrl) throw new Error("Missing RPC_URL");

function cast(signature, contract, ...args) {
  const result = spawnSync("cast", ["call", contract, signature, ...args, "--rpc-url", rpcUrl], { cwd: root, encoding: "utf8" });
  if (result.error) throw new Error("cast is not available");
  if (result.status !== 0) throw new Error(result.stderr?.trim() || "cast call failed");
  return result.stdout.trim().split(/\s+/)[0];
}
const asDecimal = (value) => BigInt(value).toString();
const manifestPath = resolve(root, "deployments", `${environment}.json`);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const phase2 = manifest.genesis?.phases?.phase2;
const contract = process.env.PHASE2_CONTRACT_ADDRESS || phase2?.contract;
if (!contract || /^0x0+$/i.test(contract)) throw new Error("Phase II contract is missing from the manifest");
const phase = Number(cast("phase()(uint8)", contract));
if (phase !== 2) throw new Error("Phase II is not ended; refusing to write a historical snapshot");
const allocationMini = asDecimal(cast("allocation()(uint256)", contract));
const soldMini = asDecimal(cast("totalSoldMini()(uint256)", contract));
const raisedDot = asDecimal(cast("totalRaisedDot()(uint256)", contract));
const buyerCount = asDecimal(cast("buyerCount()(uint256)", contract));
const startPriceX18 = asDecimal(cast("startPrice()(uint256)", contract));
const endPriceX18 = asDecimal(cast("endPrice()(uint256)", contract));
const terminalPriceX18 = asDecimal(cast("priceAt(uint256)(uint256)", contract, soldMini));
const startTime = asDecimal(cast("startTime()(uint64)", contract));
const endTime = asDecimal(cast("endTime()(uint64)", contract));
const zeroHash = `0x${"0".repeat(64)}`;
const snapshot = { phase: 2, status: "ended", allocationMini, soldMini, raisedDot, buyerCount, startPriceX18, terminalPriceX18, startTime, endTime, contract, deploymentBlock: phase2?.deploymentBlock ?? "0", runtimeCodeHash: phase2?.runtimeCodeHash ?? zeroHash };
manifest.genesis.phases.phase2 = { ...phase2, status: "ended", snapshot };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const generated = spawnSync("node", ["scripts/generate-deployment-config.mjs"], { cwd: root, stdio: "inherit" });
if (generated.error || generated.status !== 0) throw new Error("Failed to regenerate frontend deployment config");
console.log(`Phase II historical snapshot written to deployments/${environment}.json`);

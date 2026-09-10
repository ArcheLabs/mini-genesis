import { access, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const environment = process.argv[2];
const finalizeOnly = process.argv[3] === "--finalize-only";
const PRODUCTION_DURATION_SECONDS = 7n * 24n * 60n * 60n;
const deploymentEnvironment = [
  "RPC_URL",
  "TREASURY",
  "PHASE2_ALLOCATION",
  "PHASE2_START_PRICE_X18",
  "PHASE2_END_PRICE_X18",
  "PHASE2_START_TIMESTAMP",
  "PHASE2_END_TIMESTAMP",
  "EXPECTED_CHAIN_ID",
];

function requiredEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, env: process.env, stdio: "inherit", ...options });
  if (result.error) throw new Error(`${command} is not available`);
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}`);
  return result;
}

function runText(command, args) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, env: process.env, encoding: "utf8" });
  if (result.error) throw new Error(`${command} is not available`);
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}`);
  return result.stdout.trim();
}

function runJson(command, args) {
  try {
    return JSON.parse(runText(command, args));
  } catch {
    throw new Error(`Invalid JSON output from ${command}`);
  }
}

function decimal(value) {
  return BigInt(value).toString();
}

function normalizedAddress(value) {
  return String(value).trim().toLowerCase();
}

function parseBroadcastDeployment(broadcast) {
  const transactions = Array.isArray(broadcast?.transactions) ? broadcast.transactions : [];
  const transaction = transactions.find(
    (item) => item.transactionType === "CREATE" && item.contractName === "MiniGenesisCurve",
  ) ?? transactions.find((item) => item.contractName === "MiniGenesisCurve");
  if (!transaction?.contractAddress) throw new Error("MiniGenesisCurve deployment was not found in run-latest.json");
  const transactionHash = transaction.transactionHash ?? transaction.hash;
  if (!transactionHash) throw new Error("Deployment transaction hash was not found in run-latest.json");
  return { contractAddress: transaction.contractAddress, transactionHash };
}

function ensureProductionConstants() {
  if (environment !== "production") return;
  if (decimal(requiredEnv("PHASE2_ALLOCATION")) !== "2000000000000000000000000") throw new Error("Production allocation must be 2,000,000 MINI");
  if (decimal(requiredEnv("PHASE2_START_PRICE_X18")) !== "750000000000000") throw new Error("Production start price must be 0.000750 DOT/MINI");
  if (decimal(requiredEnv("PHASE2_END_PRICE_X18")) !== "1250000000000000") throw new Error("Production end price must be 0.001250 DOT/MINI");
  const start = BigInt(requiredEnv("PHASE2_START_TIMESTAMP"));
  const end = BigInt(requiredEnv("PHASE2_END_TIMESTAMP"));
  if (end - start !== PRODUCTION_DURATION_SECONDS) throw new Error("Production Phase II duration must be exactly 7 days");
}

async function deploy() {
  if (environment !== "staging" && environment !== "production") throw new Error("Deployment environment must be staging or production");
  for (const name of deploymentEnvironment) requiredEnv(name);
  if (!finalizeOnly) requiredEnv("PRIVATE_KEY");
  ensureProductionConstants();

  const rpcUrl = requiredEnv("RPC_URL");
  if (!finalizeOnly) {
    run("forge", ["script", "script/DeployMiniGenesisCurve.s.sol", "--rpc-url", rpcUrl, "--broadcast"]);
  }

  const chainId = decimal(runText("cast", ["chain-id", "--rpc-url", rpcUrl]).split(/\s+/)[0]);
  if (chainId !== decimal(requiredEnv("EXPECTED_CHAIN_ID"))) throw new Error("Phase II deployment chain ID does not match EXPECTED_CHAIN_ID");

  const broadcastPath = resolve(repositoryRoot, "broadcast", "DeployMiniGenesisCurve.s.sol", chainId, "run-latest.json");
  let broadcast;
  try {
    broadcast = JSON.parse(await readFile(broadcastPath, "utf8"));
  } catch (error) {
    if (finalizeOnly && error?.code === "ENOENT") throw new Error("run-latest.json was not found; no deployment can be finalized");
    throw error;
  }
  const { contractAddress, transactionHash } = parseBroadcastDeployment(broadcast);
  const receipt = runJson("cast", ["receipt", transactionHash, "--rpc-url", rpcUrl, "--json"]);
  if (receipt?.blockNumber === undefined) throw new Error("Deployment receipt did not include a block number");
  const deploymentBlock = decimal(receipt.blockNumber);
  const runtimeCode = runText("cast", ["code", contractAddress, "--rpc-url", rpcUrl]).split(/\s+/)[0];
  if (!runtimeCode || runtimeCode === "0x") throw new Error("Runtime bytecode was empty");
  const runtimeCodeHash = runText("cast", ["keccak", runtimeCode]).split(/\s+/)[0];
  const call = (signature) => runText("cast", ["call", contractAddress, signature, "--rpc-url", rpcUrl]);
  const treasury = call("treasury()(address)").trim();
  const allocationMini = decimal(call("allocation()(uint256)"));
  const startPriceX18 = decimal(call("startPrice()(uint256)"));
  const endPriceX18 = decimal(call("endPrice()(uint256)"));
  const startTime = decimal(call("startTime()(uint64)"));
  const endTime = decimal(call("endTime()(uint64)"));

  if (normalizedAddress(treasury) !== normalizedAddress(requiredEnv("TREASURY"))) throw new Error("Phase II deployment treasury does not match TREASURY");
  if (allocationMini !== decimal(requiredEnv("PHASE2_ALLOCATION"))) throw new Error("Phase II deployment allocation does not match PHASE2_ALLOCATION");
  if (startPriceX18 !== decimal(requiredEnv("PHASE2_START_PRICE_X18"))) throw new Error("Phase II deployment start price does not match PHASE2_START_PRICE_X18");
  if (endPriceX18 !== decimal(requiredEnv("PHASE2_END_PRICE_X18"))) throw new Error("Phase II deployment end price does not match PHASE2_END_PRICE_X18");
  if (startTime !== decimal(requiredEnv("PHASE2_START_TIMESTAMP"))) throw new Error("Phase II deployment start time does not match PHASE2_START_TIMESTAMP");
  if (endTime !== decimal(requiredEnv("PHASE2_END_TIMESTAMP"))) throw new Error("Phase II deployment end time does not match PHASE2_END_TIMESTAMP");

  if (BigInt(endTime) <= BigInt(startTime) || BigInt(allocationMini) === 0n || BigInt(startPriceX18) === 0n || BigInt(endPriceX18) <= BigInt(startPriceX18)) {
    throw new Error("Phase II deployment parameters failed the economics gate");
  }
  if (environment === "production") {
    if (allocationMini !== "2000000000000000000000000" || startPriceX18 !== "750000000000000" || endPriceX18 !== "1250000000000000") {
      throw new Error("Phase II deployment parameters failed the production economics gate");
    }
    if (BigInt(endTime) - BigInt(startTime) !== PRODUCTION_DURATION_SECONDS) {
      throw new Error("Phase II deployment duration failed the production seven-day gate");
    }
  }

  const manifestPath = resolve(repositoryRoot, "deployments", `${environment}.json`);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.genesis ??= { phases: {} };
  manifest.genesis.phases ??= {};
  manifest.genesis.phases.phase1 ??= { status: "ended", mechanism: "stream", finalReferencePriceX18: "89460000000000" };
  manifest.genesis.phases.phase2 = {
    status: "active",
    mechanism: "linear-bonding-curve",
    contract: contractAddress,
    deploymentBlock,
    runtimeCodeHash,
    allocationMini,
    startPriceX18,
    endPriceX18,
    startTime,
    endTime,
  };
  manifest.genesis.phases.phase3 ??= { status: "locked" };
  manifest.status = "deployed";
  manifest.evmNativeDecimals = 18;
  manifest.source.chainId = chainId;
  manifest.source.currencySymbol = environment === "production" ? "DOT" : "PAS";
  manifest.source.nativeDecimals = 10;
  manifest.source.evmNativeDecimals = 18;
  manifest.source.ss58Prefix = 0;
  const publicRpcUrl = process.env.PUBLIC_RPC_URL?.trim();
  if (publicRpcUrl) manifest.source.rpcHttpUrls = [publicRpcUrl];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  run("node", ["scripts/generate-deployment-config.mjs"]);
  run("pnpm", ["--dir", "packages/web", "build"], { env: { ...process.env, VITE_DEPLOYMENT_ENV: environment, VITE_DEMO_MODE: "false" } });
  await access(resolve(repositoryRoot, "packages", "web", "dist"));
  console.log(`MINI Genesis Phase II ${environment} deployment completed.\n\nMode: ${finalizeOnly ? "finalize-only" : "deploy"}\nChain ID: ${chainId}\nContract: ${contractAddress}\nTransaction: ${transactionHash}\nDeployment block: ${deploymentBlock}\nRuntime code hash: ${runtimeCodeHash}\n\nManifest: deployments/${environment}.json`);
}

try {
  await deploy();
} catch (error) {
  if (process.env.DEBUG === "1" && error instanceof Error && error.stack) console.error(error.stack);
  else console.error(`Phase II deployment failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

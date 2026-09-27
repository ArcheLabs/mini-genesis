import { access, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const environment = process.argv[2];
const finalizeOnly = process.argv[3] === "--finalize-only";
const PHASE2_ALLOCATION = 2_000_000n * 10n ** 18n;
const PHASE2_START_PRICE_X18 = 3_500_000_000_000_000n;
const PHASE2_END_PRICE_X18 = 5_500_000_000_000_000n;
const PHASE2_DURATION_SECONDS = 7n * 24n * 60n * 60n;
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
  // Foundry's human-readable uint output can append a bracketed SI hint,
  // e.g. `2000000000000000000000000 [2e24]`. Only parse the exact leading
  // integer so deployment finalization preserves the contract's full value.
  const exactValue = String(value).trim().split(/\s+/, 1)[0];
  return BigInt(exactValue).toString();
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

function ensurePhase2Constants() {
  if (BigInt(requiredEnv("PHASE2_ALLOCATION")) !== PHASE2_ALLOCATION) throw new Error("Phase II allocation must be 2,000,000 MINI");
  if (BigInt(requiredEnv("PHASE2_START_PRICE_X18")) !== PHASE2_START_PRICE_X18) throw new Error("Phase II start price must be 0.003500 DOT/MINI");
  if (BigInt(requiredEnv("PHASE2_END_PRICE_X18")) !== PHASE2_END_PRICE_X18) throw new Error("Phase II end price must be 0.005500 DOT/MINI");
  const start = BigInt(requiredEnv("PHASE2_START_TIMESTAMP"));
  const end = BigInt(requiredEnv("PHASE2_END_TIMESTAMP"));
  if (end - start !== PHASE2_DURATION_SECONDS) throw new Error("Phase II duration must be exactly 7 days");
}

function assertExpectedChainId(rpcUrl) {
  const expectedByEnvironment = { staging: "420420417", production: "420420419" };
  const expectedChainId = decimal(requiredEnv("EXPECTED_CHAIN_ID"));
  if (expectedChainId !== expectedByEnvironment[environment]) throw new Error(`EXPECTED_CHAIN_ID must be ${expectedByEnvironment[environment]} for ${environment}`);
  const actualChainId = decimal(runText("cast", ["chain-id", "--rpc-url", rpcUrl]).split(/\s+/)[0]);
  if (actualChainId !== expectedChainId) throw new Error(`Phase II deployment chain ID ${actualChainId} does not match EXPECTED_CHAIN_ID ${expectedChainId}`);
  return actualChainId;
}

async function deploy() {
  if (environment !== "staging" && environment !== "production") throw new Error("Deployment environment must be staging or production");
  for (const name of deploymentEnvironment) requiredEnv(name);
  if (!finalizeOnly) requiredEnv("PRIVATE_KEY");
  ensurePhase2Constants();

  const rpcUrl = requiredEnv("RPC_URL");
  let chainId = assertExpectedChainId(rpcUrl);
  if (!finalizeOnly) {
    run("forge", ["script", "script/DeployMiniGenesisCurve.s.sol", "--rpc-url", rpcUrl, "--broadcast"]);
  }

  chainId = assertExpectedChainId(rpcUrl);

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
  const totalSoldMini = decimal(call("totalSoldMini()(uint256)"));
  const totalRaisedDot = decimal(call("totalRaisedDot()(uint256)"));
  const buyerCount = decimal(call("buyerCount()(uint256)"));
  const remainingMini = decimal(call("remainingMini()(uint256)"));
  const phase = decimal(call("phase()(uint8)"));
  const spotPrice = decimal(call("spotPrice()(uint256)"));

  if (normalizedAddress(treasury) !== normalizedAddress(requiredEnv("TREASURY"))) throw new Error("Phase II deployment treasury does not match TREASURY");
  if (allocationMini !== decimal(requiredEnv("PHASE2_ALLOCATION"))) throw new Error("Phase II deployment allocation does not match PHASE2_ALLOCATION");
  if (startPriceX18 !== decimal(requiredEnv("PHASE2_START_PRICE_X18"))) throw new Error("Phase II deployment start price does not match PHASE2_START_PRICE_X18");
  if (endPriceX18 !== decimal(requiredEnv("PHASE2_END_PRICE_X18"))) throw new Error("Phase II deployment end price does not match PHASE2_END_PRICE_X18");
  if (startTime !== decimal(requiredEnv("PHASE2_START_TIMESTAMP"))) throw new Error("Phase II deployment start time does not match PHASE2_START_TIMESTAMP");
  if (endTime !== decimal(requiredEnv("PHASE2_END_TIMESTAMP"))) throw new Error("Phase II deployment end time does not match PHASE2_END_TIMESTAMP");

  const latestBlock = runJson("cast", ["block", "latest", "--rpc-url", rpcUrl, "--json"]);
  const latestTimestamp = BigInt(latestBlock.timestamp);
  const expectedPhase = latestTimestamp < BigInt(startTime) ? "0" : latestTimestamp >= BigInt(endTime) ? "2" : "1";
  if (totalSoldMini !== "0" || totalRaisedDot !== "0" || buyerCount !== "0") throw new Error("Genesis II initial sale totals are not zero");
  if (remainingMini !== allocationMini) throw new Error("Genesis II initial remaining allocation is incorrect");
  if (spotPrice !== startPriceX18) throw new Error("Genesis II initial spot price is incorrect");
  if (phase !== expectedPhase) throw new Error("Genesis II initial phase does not match the current TestNet chain time");

  if (BigInt(endTime) <= BigInt(startTime) || BigInt(allocationMini) === 0n || BigInt(startPriceX18) === 0n || BigInt(endPriceX18) <= BigInt(startPriceX18)) {
    throw new Error("Phase II deployment parameters failed the economics gate");
  }
  const manifestPath = resolve(repositoryRoot, "deployments", `${environment}.json`);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const verificationRpcs = environment === "staging" ? manifest.source.rpcHttpUrls : [rpcUrl];
  if (!Array.isArray(verificationRpcs) || verificationRpcs.length === 0) throw new Error("No public RPC endpoints are configured for deployment verification");
  if (environment === "staging" && normalizedAddress(verificationRpcs[0]) !== normalizedAddress(rpcUrl)) throw new Error("RPC_URL must match the primary TestNet RPC in deployments/staging.json");

  let verifiedRpcCount = 0;
  for (const verificationRpc of verificationRpcs) {
    try {
      const verificationChainId = decimal(runText("cast", ["chain-id", "--rpc-url", verificationRpc]).split(/\s+/)[0]);
      if (verificationChainId !== chainId) throw Object.assign(new Error("Cross-RPC chain ID mismatch"), { verificationMismatch: true });
      const verificationCode = runText("cast", ["code", contractAddress, "--rpc-url", verificationRpc]).split(/\s+/)[0];
      if (!verificationCode || verificationCode === "0x") throw Object.assign(new Error("Cross-RPC contract bytecode is empty"), { verificationMismatch: true });
      const verificationHash = runText("cast", ["keccak", verificationCode]).split(/\s+/)[0];
      if (verificationHash.toLowerCase() !== runtimeCodeHash.toLowerCase()) throw Object.assign(new Error("Cross-RPC runtime code hash mismatch"), { verificationMismatch: true });
      const verificationCall = (signature) => runText("cast", ["call", contractAddress, signature, "--rpc-url", verificationRpc]);
      const verificationTreasury = verificationCall("treasury()(address)").trim();
      const verificationAllocation = decimal(verificationCall("allocation()(uint256)"));
      const verificationStartPrice = decimal(verificationCall("startPrice()(uint256)"));
      const verificationEndPrice = decimal(verificationCall("endPrice()(uint256)"));
      const verificationStartTime = decimal(verificationCall("startTime()(uint64)"));
      const verificationEndTime = decimal(verificationCall("endTime()(uint64)"));
      if (normalizedAddress(verificationTreasury) !== normalizedAddress(treasury)
        || verificationAllocation !== allocationMini
        || verificationStartPrice !== startPriceX18
        || verificationEndPrice !== endPriceX18
        || verificationStartTime !== startTime
        || verificationEndTime !== endTime) {
        throw Object.assign(new Error("Cross-RPC immutable getter mismatch"), { verificationMismatch: true });
      }
      verifiedRpcCount += 1;
      console.log(`CROSS_RPC_VERIFIED=${verificationRpc}`);
    } catch (error) {
      if (error?.verificationMismatch) throw error;
      console.warn(`Cross-RPC verification unavailable: ${verificationRpc}`);
    }
  }
  if (verifiedRpcCount === 0) throw new Error("No RPC endpoint independently verified the deployed Genesis II contract");
  if (verifiedRpcCount < verificationRpcs.length) console.warn("RPC_REDUNDANCY=DEGRADED");
  else console.log("RPC_REDUNDANCY=PASS");

  manifest.genesis ??= { phases: {} };
  manifest.genesis.phases ??= {};
  manifest.genesis.phases.phase1 ??= { status: "ended", mechanism: "stream", finalReferencePriceX18: "89460000000000" };
  const phase2WorkItems = manifest.genesis.phases.phase2?.workItems;
  manifest.genesis.phases.phase2 = {
    status: "active",
    mechanism: "linear-bonding-curve",
    contract: contractAddress,
    treasury,
    deploymentBlock,
    runtimeCodeHash,
    allocationMini,
    startPriceX18,
    endPriceX18,
    startTime,
    endTime,
    ...(phase2WorkItems ? { workItems: phase2WorkItems } : {}),
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

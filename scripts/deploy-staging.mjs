import { access, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const requiredEnvironment = [
  "RPC_URL",
  "PRIVATE_KEY",
  "TREASURY",
  "GENESIS_ALLOCATION",
  "CONTRIBUTION_BLOCKS",
  "PROTECTION_BLOCKS",
  "FIRST_CONTRIBUTION_MINIMUM",
  "SUBSEQUENT_CONTRIBUTION_MINIMUM_EXCLUSIVE",
];

function requiredEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw new Error(`${command} is not available`);
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}`);
  return result;
}

function runText(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: process.env,
    encoding: "utf8",
  });
  if (result.error) throw new Error(`${command} is not available`);
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}`);
  return result.stdout.trim();
}

function runJson(command, args) {
  const output = runText(command, args);
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`Invalid JSON output from ${command}`);
  }
}

function parseCastUint(output) {
  const value = output.trim().split(/\s+/)[0];
  return BigInt(value).toString();
}

function integerString(value) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.startsWith("0x")) return BigInt(value).toString();
  return BigInt(value).toString();
}

function parseBroadcastDeployment(broadcast) {
  const transactions = Array.isArray(broadcast?.transactions) ? broadcast.transactions : [];
  const deployment = transactions.find(
    (transaction) => transaction.transactionType === "CREATE" && transaction.contractName === "MiniGenesisStream",
  );
  const fallback = transactions.find((transaction) => transaction.contractName === "MiniGenesisStream");
  const transaction = deployment ?? fallback;
  const contractAddress = transaction?.contractAddress;
  const transactionHash = transaction?.transactionHash ?? transaction?.hash;
  if (!contractAddress) throw new Error("MiniGenesisStream deployment was not found in run-latest.json");
  if (!transactionHash) throw new Error("Deployment transaction hash was not found in run-latest.json");
  return { contractAddress, transactionHash };
}

async function ensureCommand(command) {
  const result = spawnSync(command, ["--version"], { cwd: repositoryRoot, env: process.env, stdio: "ignore" });
  if (result.error || result.status !== 0) throw new Error(`${command} is not available`);
}

async function deploy() {
  const rpcUrl = requiredEnv("RPC_URL");
  for (const name of requiredEnvironment.slice(1)) requiredEnv(name);
  await ensureCommand("forge");
  await ensureCommand("cast");

  const chainId = runText("cast", ["chain-id", "--rpc-url", rpcUrl]).split(/\s+/)[0];
  run("forge", ["script", "script/DeployMiniGenesisStream.s.sol", "--rpc-url", rpcUrl, "--broadcast"]);

  const broadcastPath = resolve(repositoryRoot, "broadcast", "DeployMiniGenesisStream.s.sol", chainId, "run-latest.json");
  const broadcast = JSON.parse(await readFile(broadcastPath, "utf8"));
  const { contractAddress, transactionHash } = parseBroadcastDeployment(broadcast);

  const receipt = runJson("cast", ["receipt", transactionHash, "--rpc-url", rpcUrl, "--json"]);
  if (receipt?.blockNumber === undefined) throw new Error("Deployment receipt did not include a block number");
  const deploymentBlock = integerString(receipt.blockNumber);

  const genesisBlock = runJson("cast", ["block", "0", "--rpc-url", rpcUrl, "--json"]);
  if (!genesisBlock?.hash) throw new Error("Genesis block hash was not returned");
  const genesisHash = genesisBlock.hash.trim();

  const runtimeCode = runText("cast", ["code", contractAddress, "--rpc-url", rpcUrl]).split(/\s+/)[0];
  if (!runtimeCode || runtimeCode === "0x") throw new Error("Runtime bytecode was empty");
  const runtimeCodeHash = runText("cast", ["keccak", runtimeCode]).split(/\s+/)[0];

  const call = (signature) => runText("cast", ["call", contractAddress, signature, "--rpc-url", rpcUrl]);
  const treasury = call("treasury()(address)").trim();
  const genesisAllocation = parseCastUint(call("genesisAllocation()(uint256)"));
  const contributionBlocks = parseCastUint(call("contributionBlocks()(uint256)"));
  const protectionBlocks = parseCastUint(call("protectionBlocks()(uint256)"));
  const firstContributionMinimum = parseCastUint(call("firstContributionMinimum()(uint256)"));
  const subsequentContributionMinimumExclusive = parseCastUint(call("subsequentContributionMinimumExclusive()(uint256)"));

  const manifestPath = resolve(repositoryRoot, "deployments", "staging.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.status = "deployed";
  manifest.evmNativeDecimals = 18;
  manifest.source.chainId = chainId;
  manifest.source.currencySymbol = "DOT";
  manifest.source.evmNativeDecimals = 18;
  manifest.source.rpcHttpUrls = [rpcUrl];
  manifest.source.genesisHash = genesisHash;
  manifest.source.contract = contractAddress;
  manifest.source.deploymentBlock = deploymentBlock;
  manifest.source.runtimeCodeHash = runtimeCodeHash;
  manifest.source.contractConfig = {
    treasury,
    genesisAllocation,
    contributionBlocks,
    protectionBlocks,
    firstContributionMinimum,
    subsequentContributionMinimumExclusive,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  run("node", ["scripts/generate-deployment-config.mjs"]);
  run("pnpm", ["--dir", "packages/web", "build"], {
    env: { ...process.env, VITE_DEPLOYMENT_ENV: "staging", VITE_DEMO_MODE: "false" },
  });
  await access(resolve(repositoryRoot, "packages", "web", "dist"));

  console.log(`MINI Genesis staging deployment completed.\n\nChain ID: ${chainId}\nContract: ${contractAddress}\nTransaction: ${transactionHash}\nDeployment block: ${deploymentBlock}\nRuntime code hash: ${runtimeCodeHash}\n\nManifest:\ndeployments/staging.json\n\nFrontend:\npackages/web/dist\n\nGenesis has not started yet.\nThe first valid contribution will start the contribution period.`);
}

try {
  await deploy();
} catch (error) {
  if (process.env.DEBUG === "1" && error instanceof Error && error.stack) console.error(error.stack);
  else console.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

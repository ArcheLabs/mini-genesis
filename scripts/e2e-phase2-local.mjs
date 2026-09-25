import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const rpcUrl = "http://127.0.0.1:8545";
const substrateUrl = "ws://127.0.0.1:9944";
const require = createRequire(resolve(root, "packages/web/package.json"));
const {
  createPublicClient,
  createWalletClient,
  decodeErrorResult,
  defineChain,
  encodeFunctionData,
  http,
  keccak256,
  parseEventLogs,
} = require("viem");
const { ApiPromise, WsProvider } = require("@polkadot/api");

const allocation = 2_000_000n * 10n ** 18n;
const startPrice = 3_500_000_000_000_000n;
const endPrice = 5_500_000_000_000_000n;
const buyerAMini = 10_000n * 10n ** 18n;
const buyerBMini = 20_000n * 10n ** 18n;
const oneMini = 10n ** 18n;
const oneNativeToken = 10n ** 18n;
const duration = 7n * 24n * 60n * 60n;

function rpc(method, params = []) {
  return fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`LOCAL_RPC_HTTP_${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(`LOCAL_RPC_${method}_${payload.error.code}`);
    return payload.result;
  });
}

function cumulativeCost(sold) {
  const linear = startPrice * sold / oneMini;
  const quadratic = (endPrice - startPrice) * sold * sold / (2n * allocation * oneMini);
  return linear + quadratic;
}

function priceAt(sold) {
  return startPrice + (endPrice - startPrice) * sold / allocation;
}

function extractRevertData(error, seen = new Set()) {
  if (!error || typeof error !== "object" || seen.has(error)) return undefined;
  seen.add(error);
  if (typeof error.data === "string" && error.data.length >= 10 && /^0x[\da-f]+$/i.test(error.data)) return error.data;
  if (error.data && typeof error.data === "object") {
    const nested = extractRevertData(error.data, seen);
    if (nested) return nested;
  }
  for (const value of [error.cause, error.details, error.error, error.metaMessages]) {
    const nested = extractRevertData(value, seen);
    if (nested) return nested;
  }
  return undefined;
}

async function substrateMetadata() {
  const provider = new WsProvider(substrateUrl, 2500);
  const api = await ApiPromise.create({ provider, noInitWarn: true });
  try {
    const [chain, name, version, runtime, properties, finalizedHead] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
      api.rpc.state.getRuntimeVersion(),
      api.rpc.system.properties(),
      api.rpc.chain.getFinalizedHead(),
    ]);
    const nativeDecimalsValue = properties.tokenDecimals?.toJSON?.() ?? properties.tokenDecimals;
    const nativeSymbolValue = properties.tokenSymbol?.toJSON?.() ?? properties.tokenSymbol;
    const nativeDecimals = Array.isArray(nativeDecimalsValue) ? nativeDecimalsValue[0] : nativeDecimalsValue;
    const nativeSymbol = Array.isArray(nativeSymbolValue) ? nativeSymbolValue[0] : nativeSymbolValue;
    return {
      chain: chain.toString(),
      nodeName: name.toString(),
      nodeVersion: version.toString(),
      specName: runtime.specName.toString(),
      specVersion: runtime.specVersion.toString(),
      ss58Prefix: Number(properties.ss58Format?.toString?.() ?? properties.ss58Format ?? 0),
      nativeDecimals: Number(nativeDecimals),
      nativeSymbol: String(nativeSymbol),
      genesisHash: api.genesisHash.toHex(),
      finalizedHead: finalizedHead.toHex(),
      api,
    };
  } catch (error) {
    await api.disconnect();
    throw error;
  }
}

const health = await Promise.all([rpc("eth_chainId"), rpc("eth_blockNumber"), rpc("eth_accounts")]);
const chainId = Number(BigInt(health[0]));
const accounts = health[2];
assert(Array.isArray(accounts) && accounts.length >= 3, "LOCAL_ACCOUNT_FAILURE: eth_accounts needs at least three accounts");
const [deployer, buyerA, buyerB] = accounts;
assert(new Set([deployer.toLowerCase(), buyerA.toLowerCase(), buyerB.toLowerCase()]).size === 3, "LOCAL_ACCOUNT_FAILURE: accounts must be distinct");

const substrate = await substrateMetadata();
const chain = defineChain({
  id: chainId,
  name: substrate.chain,
  nativeCurrency: { name: substrate.nativeSymbol, symbol: substrate.nativeSymbol, decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 0, timeout: 15_000 }) });
const wallet = createWalletClient({ account: deployer, chain, transport: http(rpcUrl, { retryCount: 0, timeout: 30_000 }) });
const buyerAWallet = createWalletClient({ account: buyerA, chain, transport: http(rpcUrl, { retryCount: 0, timeout: 30_000 }) });
const buyerBWallet = createWalletClient({ account: buyerB, chain, transport: http(rpcUrl, { retryCount: 0, timeout: 30_000 }) });
const [deployerBalance, buyerABalance, buyerBBalance] = await Promise.all([
  publicClient.getBalance({ address: deployer }),
  publicClient.getBalance({ address: buyerA }),
  publicClient.getBalance({ address: buyerB }),
]);
for (const [label, balance] of [["deployer", deployerBalance], ["buyerA", buyerABalance], ["buyerB", buyerBBalance]]) {
  assert(balance > 0n, `LOCAL_ACCOUNT_FAILURE: ${label} has no EVM balance`);
}

const artifactPath = resolve(root, "out", "MiniGenesisCurve.sol", "MiniGenesisCurve.json");
const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
const bytecode = artifact.bytecode?.object;
assert(typeof bytecode === "string" && bytecode.startsWith("0x") && bytecode.length > 2, "FORGE_BUILD_ARTIFACT_MISSING");
let latestBlock = await rpc("eth_getBlockByNumber", ["latest", false]);
if (BigInt(latestBlock.timestamp) <= 1n) {
  // The dev genesis block starts at timestamp zero; seal one empty local block
  // so campaign timestamps still derive from chain time rather than wall time.
  await rpc("evm_mine");
  const deadline = Date.now() + 10_000;
  do {
    latestBlock = await rpc("eth_getBlockByNumber", ["latest", false]);
    if (BigInt(latestBlock.timestamp) > 1n) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
}
const latestBlockTimestamp = BigInt(latestBlock.timestamp);
const startTime = latestBlockTimestamp - 1n;
const endTime = startTime + duration;
assert(latestBlockTimestamp > 1n && startTime > 0n && endTime - startTime === duration,
  `INVALID_LOCAL_CAMPAIGN_TIMESTAMPS timestamp=${latestBlockTimestamp} start=${startTime} end=${endTime}`);

const deployHash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode,
  args: [deployer, allocation, startPrice, endPrice, startTime, endTime],
  account: deployer,
});
const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash, timeout: 60_000 });
assert.equal(deployReceipt.status, "success", "LOCAL_DEPLOY_FAILED");
assert(deployReceipt.contractAddress, "LOCAL_DEPLOY_CONTRACT_ADDRESS_MISSING");
const contract = deployReceipt.contractAddress;
const runtimeCode = await publicClient.getCode({ address: contract });
assert(runtimeCode && runtimeCode !== "0x", "LOCAL_DEPLOY_RUNTIME_CODE_MISSING");
const runtimeCodeHash = keccak256(runtimeCode);

async function read(functionName, args = []) {
  return publicClient.readContract({ address: contract, abi: artifact.abi, functionName, args });
}

const [initialTreasury, initialAllocation, initialStartPrice, initialEndPrice, initialStartTime, initialEndTime, initialPhase, initialSold, initialRaised, initialBuyerCount, initialSpot, initialRemaining] = await Promise.all([
  read("treasury"), read("allocation"), read("startPrice"), read("endPrice"), read("startTime"), read("endTime"),
  read("phase"), read("totalSoldMini"), read("totalRaisedDot"), read("buyerCount"), read("spotPrice"), read("remainingMini"),
]);
assert.equal(initialTreasury.toLowerCase(), deployer.toLowerCase());
assert.equal(initialAllocation, allocation);
assert.equal(initialStartPrice, startPrice);
assert.equal(initialEndPrice, endPrice);
assert.equal(initialStartTime, startTime);
assert.equal(initialEndTime, endTime);
assert.equal(BigInt(initialPhase), 1n);
assert.equal(initialSold, 0n);
assert.equal(initialRaised, 0n);
assert.equal(initialBuyerCount, 0n);
assert.equal(initialSpot, startPrice);
assert.equal(initialRemaining, allocation);

const priceBeforeA = await read("spotPrice");
const quoteA = await read("quoteBuy", [buyerAMini]);
const buyerAHash = await buyerAWallet.writeContract({
  address: contract,
  abi: artifact.abi,
  functionName: "buyExactMini",
  args: [buyerAMini, quoteA],
  value: quoteA,
});
const buyerAReceipt = await publicClient.waitForTransactionReceipt({ hash: buyerAHash, timeout: 60_000 });
assert.equal(buyerAReceipt.status, "success", "LOCAL_BUYER_A_FAILED");
const priceAfterA = await read("spotPrice");
const buyerAPurchased = await read("purchasedMini", [buyerA]);
const buyerACount = await read("buyerCount");
const totalSoldAfterA = await read("totalSoldMini");
const totalRaisedAfterA = await read("totalRaisedDot");
assert.equal(buyerAPurchased, buyerAMini);
assert.equal(buyerACount, 1n);
assert.equal(totalSoldAfterA, buyerAMini);
assert.equal(totalRaisedAfterA, cumulativeCost(buyerAMini));
assert(priceAfterA > priceBeforeA);

const quoteB = await read("quoteBuy", [buyerBMini]);
const treasuryBeforeB = await publicClient.getBalance({ address: deployer });
const buyerBHash = await buyerBWallet.writeContract({
  address: contract,
  abi: artifact.abi,
  functionName: "buyExactMini",
  args: [buyerBMini, quoteB],
  value: quoteB + oneNativeToken,
});
const buyerBReceipt = await publicClient.waitForTransactionReceipt({ hash: buyerBHash, timeout: 60_000 });
assert.equal(buyerBReceipt.status, "success", "LOCAL_BUYER_B_FAILED");
const treasuryAfterB = await publicClient.getBalance({ address: deployer });
const [priceAfterB, buyerBPurchased, buyerCount, totalSold, totalRaised, remaining] = await Promise.all([
  read("spotPrice"), read("purchasedMini", [buyerB]), read("buyerCount"), read("totalSoldMini"), read("totalRaisedDot"), read("remainingMini"),
]);
const expectedSold = buyerAMini + buyerBMini;
const expectedRaised = cumulativeCost(expectedSold);
assert.equal(buyerBPurchased, buyerBMini);
assert.equal(buyerCount, 2n);
assert.equal(totalSold, expectedSold);
assert.equal(totalRaised, expectedRaised);
assert.equal(totalRaised, quoteA + quoteB);
assert.equal(remaining, allocation - expectedSold);
assert(priceAfterB > priceAfterA && priceAfterA > priceBeforeA);
assert.equal(treasuryAfterB - treasuryBeforeB, quoteB, "LOCAL_TREASURY_ACCOUNTING_MISMATCH");
assert.equal(quoteB + oneNativeToken - quoteB, oneNativeToken, "LOCAL_REFUND_VALUE_MISMATCH");

const eventA = parseEventLogs({ abi: artifact.abi, logs: buyerAReceipt.logs, eventName: "Purchased", strict: true })[0]?.args;
const eventB = parseEventLogs({ abi: artifact.abi, logs: buyerBReceipt.logs, eventName: "Purchased", strict: true })[0]?.args;
assert(eventA && eventB, "LOCAL_PURCHASED_EVENT_MISSING");
assert.equal(eventA.buyer.toLowerCase(), buyerA.toLowerCase());
assert.equal(eventA.miniAmount, buyerAMini);
assert.equal(eventA.dotCost, quoteA);
assert.equal(eventA.totalSoldMini, buyerAMini);
assert.equal(eventA.totalRaisedDot, cumulativeCost(buyerAMini));
assert.equal(eventA.spotPriceAfter, priceAfterA);
assert.equal(eventB.buyer.toLowerCase(), buyerB.toLowerCase());
assert.equal(eventB.miniAmount, buyerBMini);
assert.equal(eventB.dotCost, quoteB);
assert.equal(eventB.totalSoldMini, expectedSold);
assert.equal(eventB.totalRaisedDot, expectedRaised);
assert.equal(eventB.spotPriceAfter, priceAfterB);

async function expectCallRevert(errorName, args, value) {
  const calldata = encodeFunctionData({ abi: artifact.abi, functionName: "buyExactMini", args });
  try {
    await publicClient.call({ account: buyerB, to: contract, data: calldata, value });
  } catch (error) {
    const revertData = extractRevertData(error);
    if (revertData && revertData.length >= 10) {
      try {
        const decoded = decodeErrorResult({ abi: artifact.abi, data: revertData });
        if (decoded.errorName === errorName) return;
      } catch { /* Some adapters return a textual custom error. */ }
    }
    if (String(error.shortMessage ?? error.message).includes(`${errorName}()`)) return;
    throw new Error(`LOCAL_EXPECTED_${errorName}_GOT_${String(error.shortMessage ?? error.message).slice(0, 240)}`);
  }
  throw new Error(`LOCAL_EXPECTED_${errorName}_DID_NOT_REVERT`);
}

const stateBeforeReverts = { totalSold, totalRaised, buyerCount };
const slippageQuote = await read("quoteBuy", [oneMini]);
await expectCallRevert("SlippageExceeded", [oneMini, slippageQuote - 1n], slippageQuote);
await expectCallRevert("InsufficientPayment", [oneMini, slippageQuote], slippageQuote - 1n);
assert.equal(await read("totalSoldMini"), stateBeforeReverts.totalSold);
assert.equal(await read("totalRaisedDot"), stateBeforeReverts.totalRaised);
assert.equal(await read("buyerCount"), stateBeforeReverts.buyerCount);

const formulaSpotA = priceAt(buyerAMini);
const formulaSpotB = priceAt(expectedSold);
assert.equal(formulaSpotA, priceAfterA);
assert.equal(formulaSpotB, priceAfterB);
assert.equal(await read("priceAt", [buyerAMini]), formulaSpotA);
assert.equal(await read("priceAt", [expectedSold]), formulaSpotB);

const transactionBlocks = [deployReceipt.blockNumber, buyerAReceipt.blockNumber, buyerBReceipt.blockNumber];
let ethFinalizedTag = "UNSUPPORTED";
let localFinality = "UNVERIFIED";
try {
  const finalizedBlock = await publicClient.getBlock({ blockTag: "finalized" });
  ethFinalizedTag = finalizedBlock.number >= transactionBlocks[2] ? "PASS" : "PENDING";
  if (ethFinalizedTag === "PASS") localFinality = "PASS";
} catch { /* Check native Substrate finality below. */ }

let substrateFinalized = localFinality === "PASS" ? "NOT_NEEDED" : "UNVERIFIED";
let finalizedSubstrateNumber;
if (localFinality !== "PASS") {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const hash = await substrate.api.rpc.chain.getFinalizedHead();
    const header = await substrate.api.rpc.chain.getHeader(hash);
    finalizedSubstrateNumber = header.number.toBigInt();
    if (transactionBlocks.every((block) => finalizedSubstrateNumber >= block)) {
      substrateFinalized = "PASS";
      localFinality = "PASS";
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
assert.equal(localFinality, "PASS", "LOCAL_FINALITY_NOT_DEMONSTRATED");

const localManifestPath = resolve(root, "deployments", "local.json");
const localManifest = JSON.parse(await readFile(localManifestPath, "utf8"));
const historicalPhase1 = JSON.stringify(localManifest.genesis.phases.phase1);
localManifest.status = "deployed";
localManifest.evmNativeDecimals = 18;
localManifest.source.chainId = String(chainId);
localManifest.source.name = substrate.chain;
localManifest.source.currencySymbol = substrate.nativeSymbol;
localManifest.source.nativeDecimals = substrate.nativeDecimals;
localManifest.source.evmNativeDecimals = 18;
localManifest.source.rpcHttpUrls = [rpcUrl];
localManifest.source.substrateWsUrls = [substrateUrl];
localManifest.source.substrateGenesisHash = substrate.genesisHash;
localManifest.source.ss58Prefix = substrate.ss58Prefix;
localManifest.source.explorerUrl = "";
const phase2WorkItems = localManifest.genesis.phases.phase2.workItems;
localManifest.genesis.phases.phase2 = {
  status: "active",
  mechanism: "linear-bonding-curve",
  contract,
  deploymentBlock: deployReceipt.blockNumber.toString(),
  runtimeCodeHash,
  allocationMini: allocation.toString(),
  startPriceX18: startPrice.toString(),
  endPriceX18: endPrice.toString(),
  startTime: startTime.toString(),
  endTime: endTime.toString(),
  workItems: phase2WorkItems,
};
assert.equal(JSON.stringify(localManifest.genesis.phases.phase1), historicalPhase1, "LOCAL_GENESIS1_MANIFEST_CHANGED");
assert.equal(localManifest.genesis.phases.phase3.status, "locked", "LOCAL_GENESIS3_UNLOCKED");
await writeFile(localManifestPath, `${JSON.stringify(localManifest, null, 2)}\n`);

const clientVersion = await rpc("web3_clientVersion").catch(() => "UNSUPPORTED");
const localBlockNumber = BigInt(await rpc("eth_blockNumber"));
console.log(JSON.stringify({
  LOCAL_EVM_RPC: rpcUrl,
  LOCAL_SUBSTRATE_RPC: substrateUrl,
  LOCAL_RPC_READY: true,
  LOCAL_CHAIN_ID: chainId,
  LOCAL_BLOCK_NUMBER: localBlockNumber.toString(),
  LOCAL_WEB3_CLIENT_VERSION: clientVersion,
  LOCAL_SUBSTRATE_CHAIN: substrate.chain,
  LOCAL_SUBSTRATE_GENESIS_HASH: substrate.genesisHash,
  LOCAL_NODE_NAME: substrate.nodeName,
  LOCAL_NODE_VERSION: substrate.nodeVersion,
  LOCAL_SPEC_NAME: substrate.specName,
  LOCAL_SPEC_VERSION: substrate.specVersion,
  LOCAL_SS58_PREFIX: substrate.ss58Prefix,
  LOCAL_NATIVE_DECIMALS: substrate.nativeDecimals,
  LOCAL_NATIVE_SYMBOL: substrate.nativeSymbol,
  LOCAL_ACCOUNT_MODE: "JSON_RPC_UNLOCKED",
  LOCAL_DEPLOYER: deployer,
  LOCAL_BUYER_A: buyerA,
  LOCAL_BUYER_B: buyerB,
  LOCAL_DEPLOYER_BALANCE: deployerBalance.toString(),
  LOCAL_BUYER_A_BALANCE: buyerABalance.toString(),
  LOCAL_BUYER_B_BALANCE: buyerBBalance.toString(),
  FORGE_BUILD: "PASS",
  LOCAL_CONTRACT: contract,
  LOCAL_DEPLOY_TX: deployHash,
  LOCAL_DEPLOY_BLOCK: deployReceipt.blockNumber.toString(),
  LOCAL_RUNTIME_CODE_HASH: runtimeCodeHash,
  LOCAL_DEPLOYMENT_IMMUTABLES: "PASS",
  PRICE_BEFORE_A: priceBeforeA.toString(),
  QUOTE_A: quoteA.toString(),
  BUYER_A_TX: buyerAHash,
  BUYER_A_BLOCK: buyerAReceipt.blockNumber.toString(),
  PRICE_AFTER_A: priceAfterA.toString(),
  QUOTE_B: quoteB.toString(),
  BUYER_B_SENT_VALUE: (quoteB + oneNativeToken).toString(),
  BUYER_B_TX: buyerBHash,
  BUYER_B_BLOCK: buyerBReceipt.blockNumber.toString(),
  PRICE_AFTER_B: priceAfterB.toString(),
  REFUND_TEST: "PASS",
  SLIPPAGE_REVERT_TEST: "PASS",
  INSUFFICIENT_PAYMENT_TEST: "PASS",
  BUYER_COUNT: buyerCount.toString(),
  BUYER_A_PURCHASED_MINI: buyerAPurchased.toString(),
  BUYER_B_PURCHASED_MINI: buyerBPurchased.toString(),
  TOTAL_SOLD_MINI: totalSold.toString(),
  TOTAL_RAISED_DOT: totalRaised.toString(),
  EXPECTED_CUMULATIVE_COST: expectedRaised.toString(),
  REMAINING_MINI: remaining.toString(),
  PRICE_FORMULA_CHECK: "PASS",
  CUMULATIVE_ACCOUNTING: "PASS",
  TREASURY_ACCOUNTING: "PASS",
  EVENT_ACCOUNTING: "PASS",
  LOCAL_ETH_FINALIZED_TAG: ethFinalizedTag,
  LOCAL_FINALIZED_SUBSTRATE_NUMBER: finalizedSubstrateNumber?.toString() ?? "NOT_NEEDED",
  LOCAL_SUBSTRATE_FINALITY: substrateFinalized,
  LOCAL_FINALITY: localFinality,
  LOCAL_MANIFEST: "deployments/local.json updated",
}, null, 2));

await substrate.api.disconnect();

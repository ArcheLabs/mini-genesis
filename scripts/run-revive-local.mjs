import { createWriteStream } from "node:fs";
import { mkdir, access } from "node:fs/promises";
import net from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { hostSupportsPrebuiltPair, runInRuntimeSync, runtimeCacheDirectory, spawnPrebuilt } from "./revive-local-runtime.mjs";

const releaseTag = "nodes-19907546951";
const binaryDirectory = join(homedir(), ".cache", "mini-genesis", "revive", releaseTag);
const nodeBinary = join(binaryDirectory, "revive-dev-node");
const ethRpcBinary = join(binaryDirectory, "eth-rpc");
const nodeDataDirectory = join(runtimeCacheDirectory(), "node-data");
const logDirectory = "/tmp/mini-genesis-revive";
const substrateUrl = "ws://127.0.0.1:9944";
const evmUrl = "http://127.0.0.1:8545";

await Promise.all([access(nodeBinary), access(ethRpcBinary)]);
await mkdir(logDirectory, { recursive: true });
if (hostSupportsPrebuiltPair()) await mkdir(nodeDataDirectory, { recursive: true });
else runInRuntimeSync(["/bin/mkdir", "-p", nodeDataDirectory], { stdio: "ignore" });

function assertPortClosed(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(700);
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error(`LOCAL_PORT_ALREADY_IN_USE_${port}`));
    });
    socket.once("timeout", () => { socket.destroy(); resolve(); });
    socket.once("error", () => resolve());
  });
}

async function substrateCall(method, params = []) {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(substrateUrl);
    const timer = setTimeout(() => { socket.close(); reject(new Error(`SUBSTRATE_RPC_TIMEOUT_${method}`)); }, 2500);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })));
    socket.addEventListener("message", (event) => {
      clearTimeout(timer);
      socket.close();
      const response = JSON.parse(String(event.data));
      if (response.error) reject(new Error(`SUBSTRATE_RPC_ERROR_${method}_${response.error.code}`));
      else resolve(response.result);
    }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error(`SUBSTRATE_RPC_CONNECT_${method}`)); }, { once: true });
  });
}

async function evmCall(method, params = []) {
  const response = await fetch(evmUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`EVM_RPC_HTTP_${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`EVM_RPC_ERROR_${method}_${payload.error.code}`);
  return payload.result;
}

function launch(binaryName, args, logName) {
  const stdout = createWriteStream(join(logDirectory, `${logName}.stdout.log`), { flags: "w" });
  const stderr = createWriteStream(join(logDirectory, `${logName}.stderr.log`), { flags: "w" });
  const child = spawnPrebuilt(binaryName, args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  child.once("error", (error) => { process.stderr.write(`${logName} failed: ${error.message}\n`); });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      process.stderr.write(`${logName} exited unexpectedly (code=${code}, signal=${signal})\n`);
      void stop("SIGTERM", 1);
    }
  });
  return child;
}

async function waitFor(label, check, children, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    for (const [name, child] of children) if (child.exitCode !== null) throw new Error(`${name.toUpperCase()}_EXITED_${child.exitCode}`);
    try { return await check(); } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw new Error(`${label}_NOT_READY: ${lastError?.message ?? "timeout"}`);
}

let stopping = false;
let node;
let adapter;
async function stop(signal = "SIGTERM", exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (!hostSupportsPrebuiltPair()) {
    for (const binaryName of ["eth-rpc", "revive-dev-node"]) {
      try { runInRuntimeSync(["/usr/bin/pkill", "-TERM", "-x", binaryName], { stdio: "ignore" }); }
      catch { /* The paired process may already have exited. */ }
    }
  }
  for (const child of [adapter, node]) if (child?.exitCode === null) child.kill(signal === "SIGINT" ? "SIGINT" : "SIGTERM");
  await Promise.all([adapter, node].filter(Boolean).map((child) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 5000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  })));
  process.exitCode = exitCode;
}

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void stop(signal, 0); });
await assertPortClosed(9944);
await assertPortClosed(8545);

try {
  if (!hostSupportsPrebuiltPair()) console.log(`REVIVE_RUNTIME_DISTRO=${process.env.REVIVE_LOCAL_RUNTIME_DISTRO ?? "UNSET"}`);
  node = launch("revive-dev-node", ["--dev", "--base-path", nodeDataDirectory], "revive-dev-node");
  await waitFor("SUBSTRATE_RPC", () => substrateCall("system_chain"), [["node", node]]);
  adapter = launch("eth-rpc", ["--dev"], "eth-rpc");
  const chainId = await waitFor("ETH_RPC", () => evmCall("eth_chainId"), [["node", node], ["adapter", adapter]]);
  const latestBlock = await waitFor("EVM_BLOCK", () => evmCall("eth_blockNumber"), [["node", node], ["adapter", adapter]]);
  console.log(`REVIVE_NODE_PID=${node.pid}`);
  console.log("REVIVE_NODE_STARTED=true");
  console.log(`ETH_RPC_PID=${adapter.pid}`);
  console.log("ETH_RPC_STARTED=true");
  console.log(`LOCAL_CHAIN_ID=${BigInt(chainId).toString()}`);
  console.log(`LOCAL_BLOCK_NUMBER=${BigInt(latestBlock).toString()}`);
  console.log(`LOCAL_SUBSTRATE_RPC=${substrateUrl}`);
  console.log(`LOCAL_EVM_RPC=${evmUrl}`);
  console.log(`LOCAL_STATE_DIRECTORY=${nodeDataDirectory}`);
  console.log(`LOG_DIRECTORY=${logDirectory}`);

  await new Promise(() => {});
} catch (error) {
  process.stderr.write(`Local Revive startup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  await stop("SIGTERM", 1);
}

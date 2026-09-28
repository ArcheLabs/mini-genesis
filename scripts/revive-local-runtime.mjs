import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { homedir, platform, arch } from "node:os";
import { join } from "node:path";

export const RELEASE_TAG = "nodes-19907546951";
export const BINARY_CACHE_DIRECTORY = join(homedir(), ".cache", "mini-genesis", "revive", RELEASE_TAG);
const TARGET_CACHE_DIRECTORY = `/root/.cache/mini-genesis/revive/${RELEASE_TAG}`;
const windowsSystemDirectory = "/mnt/c/WINDOWS/system32";
const cmdExe = `${windowsSystemDirectory}/cmd.exe`;

export function hostSupportsPrebuiltPair() {
  if (platform() !== "linux" || arch() !== "x64") return false;
  const version = process.report?.getReport?.().header?.glibcVersionRuntime;
  if (!version) return false;
  const [major, minor] = version.split(".").map(Number);
  return major > 2 || (major === 2 && minor >= 34);
}

export function runtimeCacheDirectory() {
  return hostSupportsPrebuiltPair() ? BINARY_CACHE_DIRECTORY : TARGET_CACHE_DIRECTORY;
}

function runtimeDistro() {
  const distro = process.env.REVIVE_LOCAL_RUNTIME_DISTRO?.trim();
  if (!distro) throw new Error("HOST_GLIBC_TOO_OLD: set REVIVE_LOCAL_RUNTIME_DISTRO to a local Linux distro with glibc >= 2.34");
  if (platform() !== "linux" || arch() !== "x64" || !process.env.WSL_DISTRO_NAME || !process.env.WSL_INTEROP) {
    throw new Error("ALTERNATE_RUNTIME_REQUIRES_WSL");
  }
  return distro;
}

function wslArgs(distro, targetArgs) {
  return [cmdExe, "/c", "wsl.exe", "-d", distro, "--user", "root", "--cd", "/tmp", "--exec", ...targetArgs];
}

export function runInRuntimeSync(targetArgs, options = {}) {
  const distro = runtimeDistro();
  return execFileSync("/init", wslArgs(distro, targetArgs), {
    cwd: windowsSystemDirectory,
    encoding: "utf8",
    ...options,
  });
}

export function spawnPrebuilt(binaryName, args, options = {}) {
  const sourcePath = join(BINARY_CACHE_DIRECTORY, binaryName);
  if (hostSupportsPrebuiltPair()) return spawn(sourcePath, args, options);
  const distro = runtimeDistro();
  const targetPath = `${TARGET_CACHE_DIRECTORY}/${binaryName}`;
  return spawn("/init", wslArgs(distro, [targetPath, ...args]), {
    cwd: windowsSystemDirectory,
    ...options,
  });
}

async function transferAsset(serverPort, asset) {
  const targetPath = `${TARGET_CACHE_DIRECTORY}/${asset.fileName}`;
  try {
    const hash = runInRuntimeSync(["/usr/bin/sha256sum", targetPath]).trim().split(/\s+/)[0];
    if (hash === asset.sha256) return;
  } catch { /* Transfer or repair the missing/mismatched cached file. */ }

  const sourcePath = join(BINARY_CACHE_DIRECTORY, asset.fileName);
  await access(sourcePath);
  console.log(`Copying ${asset.fileName} into WSL ${runtimeDistro()} local cache`);
  runInRuntimeSync(["/usr/bin/curl", "--fail", "--location", "--show-error", "--retry", "3", "--retry-delay", "1", "--output", targetPath, `http://127.0.0.1:${serverPort}/${asset.fileName}`], { stdio: "inherit" });
  runInRuntimeSync(["/bin/chmod", "755", targetPath], { stdio: "inherit" });
  const copiedHash = runInRuntimeSync(["/usr/bin/sha256sum", targetPath]).trim().split(/\s+/)[0];
  if (copiedHash !== asset.sha256) throw new Error(`WSL_RUNTIME_COPY_CHECKSUM_MISMATCH_${asset.fileName}`);
}

export async function prepareWslRuntime(assets) {
  const distro = runtimeDistro();
  const runtimeInfo = runInRuntimeSync(["/bin/bash", "-lc", "ldd --version | head -1; strings /lib/x86_64-linux-gnu/libstdc++.so.6 | grep -E '^GLIBCXX_[0-9.]+$' | sort -Vu | tail -1"]);
  const glibc = runtimeInfo.match(/GLIBC (\d+\.\d+)/)?.[1];
  const glibcxx = runtimeInfo.match(/(GLIBCXX_[\d.]+)/)?.[1];
  if (!glibc || Number(glibc.split(".")[0]) < 2 || (Number(glibc.split(".")[0]) === 2 && Number(glibc.split(".")[1]) < 34)) {
    throw new Error(`WSL_RUNTIME_GLIBC_TOO_OLD_${glibc ?? "UNKNOWN"}`);
  }
  const latestGlxx = glibcxx?.replace("GLIBCXX_", "").split(".").map(Number) ?? [];
  if (latestGlxx.length < 3 || latestGlxx[0] < 3 || (latestGlxx[0] === 3 && latestGlxx[1] < 4) || (latestGlxx[0] === 3 && latestGlxx[1] === 4 && latestGlxx[2] < 30)) {
    throw new Error(`WSL_RUNTIME_GLIBCXX_TOO_OLD_${glibcxx ?? "UNKNOWN"}`);
  }

  const approved = new Map(assets.map((asset) => [asset.fileName, asset]));
  const server = createServer(async (request, response) => {
    const fileName = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname.slice(1));
    const asset = approved.get(fileName);
    if (!asset || !["GET", "HEAD"].includes(request.method ?? "")) {
      response.writeHead(404).end();
      return;
    }
    try {
      const filePath = join(BINARY_CACHE_DIRECTORY, fileName);
      const fileStat = await stat(filePath);
      response.writeHead(200, { "content-length": fileStat.size, "content-type": "application/octet-stream" });
      if (request.method === "HEAD") response.end();
      else createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    runInRuntimeSync(["/bin/mkdir", "-p", TARGET_CACHE_DIRECTORY], { stdio: "ignore" });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("WSL_RUNTIME_TRANSFER_SERVER_FAILED");
    for (const asset of assets) await transferAsset(address.port, asset);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(`REVIVE_RUNTIME_DISTRO=${distro}`);
  console.log(`REVIVE_RUNTIME_GLIBC=${glibc}`);
  console.log(`REVIVE_RUNTIME_GLIBCXX=${glibcxx}`);
  return { distro, glibc, glibcxx };
}

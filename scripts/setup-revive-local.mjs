import { createHash } from "node:crypto";
import { access, chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir, platform, arch } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { hostSupportsPrebuiltPair, prepareWslRuntime } from "./revive-local-runtime.mjs";

const repository = "paritytech/hardhat-polkadot";
const releaseTag = "nodes-19907546951";
const binaryAssets = ["revive-dev-node-linux-x64", "eth-rpc-linux-x64"];
const pinnedSha256 = {
  "eth-rpc-linux-x64": "01beeb5449926028dabc6176a8f1f793a9f4b3ea4aafb0d9eada48a6d3fc327d",
  "revive-dev-node-linux-x64": "c06e7589264558bd214f3eef2e9be71c459f932e3d8a0508b1a1018a8f34cb1f",
};
const cacheDirectory = join(homedir(), ".cache", "mini-genesis", "revive", releaseTag);
const releaseApi = `https://api.github.com/repos/${repository}/releases/tags/${releaseTag}`;
const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "mini-genesis-revive-local-setup",
  "x-github-api-version": "2022-11-28",
};

if (platform() !== "linux" || arch() !== "x64") {
  throw new Error(`PLATFORM_UNSUPPORTED_BY_THIS_PATH: ${platform()} ${arch()}`);
}

function curlToFile(url, destination, maxSeconds, resume = false) {
  const args = [
    "--fail", "--location", "--silent", "--show-error",
    "--retry", "4", "--retry-delay", "2",
    "--connect-timeout", "20", "--max-time", String(maxSeconds),
    "--user-agent", headers["user-agent"], "--output", destination,
  ];
  if (resume) args.splice(args.indexOf("--connect-timeout"), 0, "--continue-at", "-");
  args.push(url);
  execFileSync("curl", args, { stdio: "inherit" });
}

async function download(url, destination, resume = false) {
  curlToFile(url, destination, 3600, resume);
}

function expectedDigest(checksumText, filename) {
  for (const line of checksumText.split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f\d]{64})\s+\*?(.+)$/i);
    if (match?.[2] === filename) return match[1].toLowerCase();
  }
  throw new Error(`CHECKSUM_MISSING_${filename}`);
}

async function sha256(path) {
  const digest = createHash("sha256");
  const file = (await import("node:fs")).createReadStream(path);
  for await (const chunk of file) digest.update(chunk);
  return digest.digest("hex");
}

await mkdir(cacheDirectory, { recursive: true });
console.log(`Platform: ${platform()} ${arch()}`);
console.log(`Cache: ${cacheDirectory}`);
const diskReport = execFileSync("df", ["-Pk", homedir()], { encoding: "utf8" }).trim();
console.log(diskReport);
const availableKiB = Number(diskReport.split("\n").at(-1).trim().split(/\s+/)[3]);
const requiredKiB = 8 * 1024 * 1024;
if (!Number.isSafeInteger(availableKiB) || availableKiB < requiredKiB) {
  throw new Error(`INSUFFICIENT_DISK_SPACE: need ${requiredKiB} KiB free under ${homedir()}, found ${availableKiB}`);
}
console.log(`DISK_SPACE_CHECK=PASS availableKiB=${availableKiB} requiredKiB=${requiredKiB}`);

const tempDirectory = await mkdtemp(join(cacheDirectory, ".download-"));
try {
  const apiPath = join(tempDirectory, "release.json");
  let assets;
  try {
    curlToFile(releaseApi, apiPath, 20);
    const release = JSON.parse(await readFile(apiPath, "utf8"));
    if (release.tag_name !== releaseTag) throw new Error(`UNEXPECTED_RELEASE_TAG_${release.tag_name}`);
    assets = new Map((release.assets ?? []).map((asset) => [asset.name, asset.browser_download_url]));
    console.log("RELEASE_ASSET_SOURCE=GITHUB_API");
  } catch (apiError) {
    const expandedAssetsPath = join(tempDirectory, "expanded-assets.html");
    const expandedAssetsUrl = `https://github.com/${repository}/releases/expanded_assets/${releaseTag}`;
    try {
      curlToFile(expandedAssetsUrl, expandedAssetsPath, 45);
      const expandedHtml = await readFile(expandedAssetsPath, "utf8");
      assets = new Map();
      const assetPattern = new RegExp(`href="/(${repository.replaceAll("/", "\\/")}/releases/download/${releaseTag}/([^"?#]+))"`, "g");
      for (const match of expandedHtml.matchAll(assetPattern)) {
        assets.set(match[2], `https://github.com/${match[1]}`);
      }
      if (!assets.size) throw new Error("EMPTY_EXPANDED_ASSET_LIST");
      console.log("RELEASE_ASSET_SOURCE=GITHUB_EXPANDED_RELEASE_PAGE");
    } catch {
      assets = new Map([
        ["checksums.txt", `https://github.com/${repository}/releases/download/${releaseTag}/checksums.txt`],
        ...[...binaryAssets].map((name) => [name, `https://github.com/${repository}/releases/download/${releaseTag}/${name}`]),
      ]);
      console.log("RELEASE_ASSET_SOURCE=PINNED_GITHUB_RELEASE_URLS");
    }
  }
for (const name of [...binaryAssets, "checksums.txt"]) {
    if (!assets.has(name)) throw new Error(`RELEASE_ASSET_MISSING_${name}`);
    const expectedPath = `/paritytech/hardhat-polkadot/releases/download/${releaseTag}/${name}`;
    const assetUrl = new URL(assets.get(name));
    if (assetUrl.protocol !== "https:" || assetUrl.hostname !== "github.com" || assetUrl.pathname !== expectedPath) {
      throw new Error(`UNEXPECTED_RELEASE_ASSET_URL_${name}`);
    }
  }

  for (const name of [...binaryAssets, "checksums.txt"]) {
    if (name === "checksums.txt") await download(assets.get(name), join(tempDirectory, name));
  }

  const checksums = await readFile(join(tempDirectory, "checksums.txt"), "utf8");
  for (const name of binaryAssets) {
    const expected = expectedDigest(checksums, name);
    if (expected !== pinnedSha256[name]) throw new Error(`RELEASE_CHECKSUM_PIN_MISMATCH_${name}`);
    const installedPath = join(cacheDirectory, name.replace(/-linux-x64$/, ""));
    let candidatePath = installedPath;
    try {
      await access(installedPath);
    } catch {
      candidatePath = join(tempDirectory, name);
      await download(assets.get(name), candidatePath, true);
    }
    const actual = await sha256(candidatePath);
    if (actual !== expected) throw new Error(`CHECKSUM_MISMATCH_${name}`);
    const destination = installedPath;
    if (candidatePath !== installedPath) {
      await chmod(candidatePath, 0o755);
      await rm(destination, { force: true });
      await rename(candidatePath, destination);
    }
    console.log(`${name.replace("-linux-x64", "").toUpperCase().replaceAll("-", "_")}_CHECKSUM=PASS`);
    console.log(`Installed: ${destination}`);
  }
  if (!hostSupportsPrebuiltPair()) {
    const runtimeAssets = binaryAssets.map((name) => ({
      fileName: name.replace(/-linux-x64$/, ""),
      sha256: pinnedSha256[name],
    }));
    await prepareWslRuntime(runtimeAssets);
  } else {
    console.log("REVIVE_RUNTIME=HOST");
  }
  await writeFile(join(cacheDirectory, "release-tag.txt"), `${releaseTag}\n`, { mode: 0o644 });
  console.log("REVIVE_BINARY_DOWNLOAD=PASS");
  console.log("REVIVE_BINARY_CHECKSUM=PASS");
  console.log("ETH_RPC_BINARY_CHECKSUM=PASS");
  console.log("PREBUILT_BINARIES_TRACKED=false");
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}

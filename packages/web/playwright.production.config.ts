import { defineConfig } from "playwright/test";

const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? "/";
const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;

export default defineConfig({
  testDir: "./test/browser",
  testMatch: "production-mainnet.spec.ts",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:4174${normalizedBasePath}`,
    browserName: "chromium",
  },
  webServer: {
    command: `./node_modules/.bin/vite preview --base=${normalizedBasePath} --host 127.0.0.1 --port 4174 --strictPort`,
    url: `http://127.0.0.1:4174${normalizedBasePath}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

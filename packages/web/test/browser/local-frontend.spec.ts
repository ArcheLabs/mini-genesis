import { expect, test } from "playwright/test";

test("Development registers as supported CAIP EVM network and keeps Genesis I off-chain", async ({ page }) => {
  await page.goto("/test/browser/local-frontend.html");
  await page.waitForFunction(() => window.__localFrontendProbe?.readAddresses.length >= 10);

  const probe = await page.evaluate(() => window.__localFrontendProbe!);
  expect(probe.supportedCaipNetwork).toBe(true);
  expect(probe.customRpc).toBe("http://127.0.0.1:8545");
  expect(probe.walletChainId).toBe(420420420);
  expect(probe.correctChain).toBe(true);
  expect(probe.zeroAddressRead).toBe(false);
  expect(probe.readAddresses.length).toBeGreaterThanOrEqual(10);
  expect(probe.readAddresses.every((address) => address === "0x3ed62137c5db927cb137c26455969116bf0c23cb")).toBe(true);

  await page.waitForTimeout(10_100);
  const afterPoll = await page.evaluate(() => window.__localFrontendProbe!.readAddresses.length);
  expect(afterPoll).toBeGreaterThan(probe.readAddresses.length);

  await page.locator(".stage-tab").nth(0).click();
  await expect(page.locator(".phase1-panel")).toContainText("0.00008946 DOT/MINI");
  await expect(page.getByText("Total DOT raised")).toHaveCount(0);
  await expect(page.getByText("MINI allocation")).toHaveCount(0);
  await expect(page.getByText("Start / end blocks")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /View the immutable Genesis I contract/ })).toHaveCount(0);
  await expect(page.getByText("Genesis II chain data is temporarily unavailable.")).toHaveCount(0);
  const afterOpeningPhase1 = await page.evaluate(() => window.__localFrontendProbe!.readAddresses);
  expect(afterOpeningPhase1.every((address) => address === "0x3ed62137c5db927cb137c26455969116bf0c23cb")).toBe(true);
});

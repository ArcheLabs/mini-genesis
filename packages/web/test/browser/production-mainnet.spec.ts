import { expect, test } from "playwright/test";

test("production artifact exposes the Mainnet EVM path and a waiting Genesis II template", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("#/genesis/ii");

  await expect(page.getByTestId("stage-nav-phase1")).toContainText("Completed");
  await expect(page.getByTestId("stage-nav-phase2")).toContainText("Planned");
  await expect(page.getByTestId("stage-nav-phase3")).toContainText("Locked");
  await expect(page.locator(".purchase-panel")).toContainText("Genesis II is coming soon");
  await expect(page.locator(".purchase-panel")).toContainText("DOT");
  await expect(page.getByRole("button", { name: "Coming soon" })).toBeDisabled();
  await expect(page.getByLabel("DOT budget")).toBeDisabled();

  const body = await page.locator("body").innerText();
  for (const forbidden of ["PAS", "TestNet", "SubWallet", "Talisman", "Polkadot wallet"]) {
    expect(body).not.toContain(forbidden);
  }

  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("button", { name: "EVM", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Polkadot", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "SubWallet", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Talisman", exact: true })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("production artifact fails closed for TestNet and local URL overrides", async ({ page }) => {
  for (const network of ["testnet", "local"]) {
    await page.goto(`?network=${network}#/genesis/ii`);
    await expect(page.getByRole("heading", { name: "Configuration mismatch" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Connect", exact: true }).click({ force: true });
    await expect(page.getByRole("button", { name: "EVM", exact: true })).toHaveCount(0);
  }

  await page.goto("?network=mainnet#/genesis/ii");
  await expect(page.locator('[data-testid="genesis-phase2"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Configuration mismatch" })).toHaveCount(0);
});

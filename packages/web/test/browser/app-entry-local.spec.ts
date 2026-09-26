import { encodeFunctionData } from "viem";
import { curveAbi } from "../../src/genesis/curve-abi.generated";
import { expect, test } from "playwright/test";

const zeroAddress = "0x0000000000000000000000000000000000000000";
const phase2Address = "0x3ed62137c5db927cb137c26455969116bf0c23cb";
const values: Record<string, bigint> = {
  phase: 1n,
  allocation: 2_000_000n * 10n ** 18n,
  startPrice: 3_500_000_000_000_000n,
  endPrice: 5_500_000_000_000_000n,
  startTime: 1_790_309_948n,
  endTime: 1_790_914_748n,
  totalSoldMini: 0n,
  totalRaisedDot: 0n,
  buyerCount: 0n,
  spotPrice: 3_500_000_000_000_000n,
};
const encodedValues = new Map(Object.entries(values).map(([functionName, value]) => [
  encodeFunctionData({ abi: curveAbi, functionName: functionName as any }).slice(0, 10),
  `0x${value.toString(16).padStart(64, "0")}`,
]));
const zeroWord = `0x${"00".repeat(32)}`;
const block = {
  number: "0x1", hash: `0x${"11".repeat(32)}`, parentHash: `0x${"22".repeat(32)}`, nonce: "0x0000000000000000",
  sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347", logsBloom: `0x${"00".repeat(256)}`,
  transactions: [], stateRoot: `0x${"33".repeat(32)}`, receiptsRoot: `0x${"44".repeat(32)}`, miner: zeroAddress,
  difficulty: "0x0", totalDifficulty: "0x0", extraData: "0x", size: "0x1", gasLimit: "0x1c9c380", gasUsed: "0x0",
  timestamp: "0x6aa00000", transactionsRoot: `0x${"55".repeat(32)}`, uncles: [], baseFeePerGas: "0x0", mixHash: `0x${"66".repeat(32)}`,
};

test("Genesis stages route from the URL and the first viewport centers the live purchase", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const readAddresses: string[] = [];
  await page.route((url) => url.hostname === "127.0.0.1" && url.port === "8545", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "*" } });
      return;
    }
    const incoming = route.request().postDataJSON() as { id: number; method: string; params?: unknown[] };
    let result: unknown = null;
    if (incoming.method === "eth_chainId") result = "0x190f1b44";
    else if (incoming.method === "eth_blockNumber") result = "0x1";
    else if (incoming.method === "eth_getBlockByNumber") result = block;
    else if (incoming.method === "eth_call") {
      const call = incoming.params?.[0] as { to?: string; data?: string } | undefined;
      const address = call?.to?.toLowerCase() ?? "";
      readAddresses.push(address);
      result = encodedValues.get(call?.data?.slice(0, 10) ?? "") ?? zeroWord;
    }
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ jsonrpc: "2.0", id: incoming.id, result }) });
  });

  await page.goto("/?network=local");
  await expect(page).toHaveURL(/\?network=local#\/genesis\/ii$/);
  await expect(page.locator('[data-testid="stage-nav-phase2"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("h1.sr-only")).toHaveText("Genesis II");
  await expect(page.locator('[data-testid="phase2-current-basis"]')).toContainText("0.003500");
  await expect(page.locator('[data-testid="phase2-holder-count"]')).toHaveText("0");
  await expect(page.locator('[data-testid="phase2-time-remaining"]')).not.toHaveText("—");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightBackground = await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--bg").trim());
  await page.getByRole("button", { name: "Switch appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkBackground = await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--bg").trim());
  expect(darkBackground).not.toBe(lightBackground);
  await page.getByRole("button", { name: "Switch appearance" }).click();
  await expect(page.getByText("Current acquisition basis")).toBeVisible();
  await expect(page.getByText("Current price", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Estimated cost", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Price after purchase", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Early Operations Reserve")).toHaveCount(0);
  const rulesHeading = page.getByRole("heading", { name: "Rules" });
  await rulesHeading.scrollIntoViewIfNeeded();
  await expect(rulesHeading).toBeVisible();
  await expect(page.locator(".reserve-banner")).toHaveCount(0);
  await expect(page.getByText("DOT raised", { exact: true })).toHaveCount(0);
  await expect(page.getByText("MINI distributed", { exact: true })).toHaveCount(0);
  await expect(page.getByText("MINI remaining", { exact: true })).toHaveCount(0);

  const curve = page.locator('[data-testid="bonding-curve-interaction"]');
  await expect(page.locator('[data-testid="curve-current-point"]')).toBeVisible();
  await expect(page.getByLabel("DOT budget")).toHaveValue("1.00");
  await expect(page.getByTestId("phase2-mini-quote")).toContainText("MINI");
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  await page.getByRole("button", { name: "20 DOT", exact: true }).click();
  await expect(page.getByLabel("DOT budget")).toHaveValue("20");
  await expect(page.getByRole("button", { name: "1 DOT", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();

  const curveBox = await curve.boundingBox();
  const purchaseBox = await page.locator(".purchase-panel").boundingBox();
  expect(curveBox && purchaseBox && purchaseBox.x > curveBox.x && purchaseBox.y <= curveBox.y + 20).toBe(true);
  expect(purchaseBox && purchaseBox.y + purchaseBox.height).toBeLessThan(900);
  const getButtonBox = await page.getByRole("button", { name: "Connect wallet" }).boundingBox();
  expect(getButtonBox && getButtonBox.y + getButtonBox.height).toBeLessThan(900);

  const center = await curve.evaluate((svg: SVGSVGElement) => {
    const point = svg.createSVGPoint();
    point.x = 309;
    point.y = 125;
    const screen = point.matrixTransform(svg.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.move(center.x, center.y);
  await expect(page.getByTestId("curve-tooltip")).toContainText("50.00%");
  await expect(page.getByTestId("curve-tooltip")).toContainText("1,000,000 MINI");
  await expect(page.getByTestId("curve-tooltip")).toContainText("0.004500 DOT / MINI");

  await expect(page.locator(".genesis-data-note")).toHaveCount(0);
  await expect.poll(() => readAddresses.length).toBeGreaterThanOrEqual(10);
  expect(readAddresses).not.toContain(zeroAddress);
  expect(readAddresses.every((address) => address === phase2Address)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const mobileCurve = await curve.boundingBox();
  const mobilePurchase = await page.locator(".purchase-panel").boundingBox();
  expect(mobileCurve && mobilePurchase && mobilePurchase.x === mobileCurve.x && mobilePurchase.y > mobileCurve.y).toBe(true);
  await page.locator("[data-testid='bonding-curve-interaction']").dispatchEvent("pointerdown", { pointerType: "touch", clientX: 200, clientY: 150 });
  await expect(page.getByTestId("curve-tooltip")).toBeVisible();

  await page.setViewportSize({ width: 430, height: 932 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(430);
  await expect(page.locator('[data-testid="stage-nav-phase2"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();

  await page.goto("/?network=local#/genesis/i");
  await expect(page.locator("h1.sr-only")).toHaveText("Genesis I");
  await expect(page.locator(".phase1-closing-basis > span")).toContainText("Closing basis");
  await expect(page.locator(".phase1-panel")).toContainText("0.00008946 DOT / MINI");
  await expect(page.getByText("Final reference price", { exact: true })).toHaveCount(0);
  expect(readAddresses.every((address) => address === phase2Address)).toBe(true);
  await page.reload();
  await expect(page.locator("h1.sr-only")).toHaveText("Genesis I");

  await page.goto("/?network=local#/genesis/iii");
  await expect(page.locator("h1.sr-only")).toHaveText("Genesis III");
  await expect(page.getByText("Liquidity Accumulation", { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="genesis-phase3"]')).not.toContainText("LOCKED");

  await page.goto("/?network=local#/rules");
  await expect(page).toHaveURL(/\?network=local#\/genesis\/ii$/);
});

test("stage URL survives reload, browser history, and a new tab; invalid network fails closed", async ({ page }) => {
  await page.goto("/?network=local#/genesis/ii");
  await expect(page.locator("h1.sr-only")).toHaveText("Genesis II");
  await page.locator('[data-testid="stage-nav-phase1"]').click();
  await expect(page).toHaveURL(/#\/genesis\/i$/);
  await page.locator('[data-testid="stage-nav-phase2"]').click();
  await expect(page).toHaveURL(/#\/genesis\/ii$/);
  await page.goBack();
  await expect(page.locator("h1.sr-only")).toHaveText("Genesis I");
  await page.goForward();
  await expect(page.locator("h1.sr-only")).toHaveText("Genesis II");
  await page.reload();
  await expect(page.locator("h1.sr-only")).toHaveText("Genesis II");

  const copiedRoute = await page.context().newPage();
  await copiedRoute.goto("/?network=local#/genesis/iii");
  await expect(copiedRoute.locator("h1.sr-only")).toHaveText("Genesis III");
  await copiedRoute.close();

  await page.goto("/?network=tesnet#/genesis/ii");
  await expect(page.getByRole("heading", { name: "Configuration mismatch" })).toBeVisible();
  await expect(page.locator('[data-testid="stage-nav-phase2"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator('[data-testid="phase2-current-basis"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connect wallet" })).toHaveCount(0);
});

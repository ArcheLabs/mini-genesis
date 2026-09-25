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
  number: "0x1",
  hash: `0x${"11".repeat(32)}`,
  parentHash: `0x${"22".repeat(32)}`,
  nonce: "0x0000000000000000",
  sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
  logsBloom: `0x${"00".repeat(256)}`,
  transactions: [],
  stateRoot: `0x${"33".repeat(32)}`,
  receiptsRoot: `0x${"44".repeat(32)}`,
  miner: "0x0000000000000000000000000000000000000000",
  difficulty: "0x0",
  totalDifficulty: "0x0",
  extraData: "0x",
  size: "0x1",
  gasLimit: "0x1c9c380",
  gasUsed: "0x0",
  timestamp: "0x6aa00000",
  transactionsRoot: `0x${"55".repeat(32)}`,
  uncles: [],
  baseFeePerGas: "0x0",
  mixHash: `0x${"66".repeat(32)}`,
};

test("real app startup never touches Genesis I and keeps Genesis II reads alive", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ jsonrpc: "2.0", id: incoming.id, result }),
    });
  });

  await page.goto("/");
  await expect(page.locator(".phase2-panel h1")).toHaveText("Genesis II");
  await expect(page.locator('[data-testid="stage-nav-phase2"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator('[data-testid="phase2-current-price"]')).toContainText("0.003500");
  await expect(page.locator('[data-testid="phase2-holder-count"]')).toHaveText("0");
  await expect(page.locator('[data-testid="phase2-time-remaining"]')).not.toHaveText("—");
  await expect(page.locator(".reserve-banner")).toHaveCount(0);
  await expect(page.getByText("DOT raised", { exact: true })).toHaveCount(0);
  await expect(page.getByText("MINI distributed", { exact: true })).toHaveCount(0);
  await expect(page.getByText("MINI remaining", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Rules", { exact: true })).toHaveCount(0);
  const curve = page.locator(".curve-chart svg");
  await expect(page.locator('[data-testid="curve-current-point"]')).toBeVisible();
  await expect(page.locator('[data-testid="curve-after-buy-point"]')).toBeVisible();
  const afterOneDot = Number(await curve.getAttribute("data-after-buy-position"));
  await page.getByRole("button", { name: "20 DOT", exact: true }).click();
  const afterTwentyDot = Number(await curve.getAttribute("data-after-buy-position"));
  expect(afterTwentyDot).toBeGreaterThan(afterOneDot);
  await page.getByRole("button", { name: "1 DOT", exact: true }).click();
  const curveBox = await curve.boundingBox();
  const purchaseBox = await page.locator(".purchase-panel").boundingBox();
  expect(curveBox && purchaseBox && purchaseBox.x > curveBox.x && purchaseBox.y <= curveBox.y + 20).toBe(true);
  expect(purchaseBox && purchaseBox.y + purchaseBox.height).toBeLessThan(1000);

  const hoverTarget = await curve.evaluate((svg: SVGSVGElement) => {
    const point = svg.createSVGPoint();
    point.x = 306;
    point.y = 130;
    const screen = point.matrixTransform(svg.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.move(hoverTarget.x, hoverTarget.y);
  await expect(page.getByTestId("curve-tooltip")).toContainText("50.00%");
  await expect(page.getByTestId("curve-tooltip")).toContainText("1,000,000 MINI sold");
  await expect(page.getByTestId("curve-tooltip")).toContainText("0.004500 DOT / MINI");

  await expect(page.locator(".genesis-data-note")).toHaveCount(0);
  await expect.poll(() => readAddresses.length).toBeGreaterThanOrEqual(10);
  expect(readAddresses).not.toContain(zeroAddress);
  expect(readAddresses.every((address) => address === phase2Address)).toBe(true);

  const firstPollCount = readAddresses.length;
  await page.waitForTimeout(10_100);
  expect(readAddresses.length).toBeGreaterThan(firstPollCount);
  expect(readAddresses).not.toContain(zeroAddress);
  expect(readAddresses.every((address) => address === phase2Address)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCurve = await page.locator(".curve-chart svg").boundingBox();
  const mobilePurchase = await page.locator(".purchase-panel").boundingBox();
  expect(mobileCurve && mobilePurchase && mobilePurchase.x === mobileCurve.x && mobilePurchase.y > mobileCurve.y).toBe(true);

  await page.locator('[data-testid="stage-nav-phase1"]').click();
  await expect(page.locator(".phase1-panel")).toContainText("0.00008946 DOT / MINI");
  await expect(page.locator(".phase1-panel")).not.toContainText("is complete");
  await expect(page.getByText("Total DOT raised")).toHaveCount(0);
  await expect(page.getByText("MINI allocation")).toHaveCount(0);
  await expect(page.getByText("Start / end blocks")).toHaveCount(0);
  await page.locator('[data-testid="stage-nav-phase3"]').click();
  await expect(page.locator(".phase3-panel")).toContainText("LOCKED");
  await expect(page.locator(".phase3-panel")).toContainText("Liquidity Accumulation");
  await expect(page.locator(".phase3-panel")).not.toContainText("No supply");
  expect(readAddresses).not.toContain(zeroAddress);
});

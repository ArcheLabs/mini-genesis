import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { manifest as baseManifest, ACCOUNT, SOURCE_CONTRACT } from "./helpers";
import { readGenesis2PurchaseHistory, readGenesis2PurchaseHistoryForSession, resolveHistoryH160 } from "../src/genesis/history";
import { MiniHistory } from "../src/assets/MiniHistory";

const BUYER = "0x88386Fc84bA6bC95484008F6362F93160eF3e563" as const;
const CONTRACT = "0x5555555555555555555555555555555555555555" as const;
const HASH_A = `0x${"aa".repeat(32)}` as const;
const HASH_B = `0x${"bb".repeat(32)}` as const;

function phase2Manifest() {
  return baseManifest({ genesis: { phases: {
    phase1: { status: "ended", mechanism: "stream" },
    phase2: { status: "active", mechanism: "linear-bonding-curve", contract: CONTRACT, deploymentBlock: "10" },
    phase3: { status: "locked" },
  } } } as any);
}

const log = (blockNumber: bigint, logIndex: number, transactionHash: `0x${string}`, overrides: Record<string, bigint> = {}) => ({
  blockNumber,
  logIndex,
  transactionHash,
  args: {
    miniAmount: 100n * 10n ** 18n,
    dotCost: 400n * 10n ** 15n,
    totalSoldMini: 100n * 10n ** 18n,
    totalRaisedDot: 400n * 10n ** 15n,
    spotPriceAfter: 3_500_100_000_000_000n,
    ...overrides,
  },
});

describe("Genesis history readers", () => {
  it("queries the Genesis II Purchased buyer topic from deployment through finalized block and sorts newest first", async () => {
    const logs = [log(12n, 3, HASH_A), log(14n, 1, HASH_B), log(14n, 4, HASH_A)];
    const getLogs = vi.fn().mockResolvedValue(logs);
    const client = { getLogs } as unknown as PublicClient;
    const items = await readGenesis2PurchaseHistory(client, phase2Manifest(), BUYER, 20n);

    expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({
      address: CONTRACT,
      args: { buyer: BUYER },
      fromBlock: 10n,
      toBlock: 20n,
    }));
    expect(items.map((item) => [item.blockNumber, item.logIndex])).toEqual([[14n, 4], [14n, 1], [12n, 3]]);
    expect(items[0]).toMatchObject({
      miniAmount: 100n * 10n ** 18n,
      dotCost: 400n * 10n ** 15n,
      totalSoldMini: 100n * 10n ** 18n,
      totalRaisedDot: 400n * 10n ** 15n,
      spotPriceAfter: 3_500_100_000_000_000n,
      transactionHash: HASH_A,
    });
  });

  it("resolves Polkadot history through ReviveApi.address before querying Purchased logs", async () => {
    const address = "111111111111111111111111111111111HC1";
    const runtimeAddress = vi.fn(async () => BUYER.toLowerCase());
    const session = { kind: "polkadot", api: { apis: { ReviveApi: { address: runtimeAddress } } }, selectedAccountAddress: address } as any;
    const getLogs = vi.fn().mockResolvedValue([log(14n, 1, HASH_B)]);
    const client = { getLogs } as unknown as PublicClient;

    await expect(resolveHistoryH160(session)).resolves.toBe(BUYER);
    await readGenesis2PurchaseHistoryForSession(client, phase2Manifest(), session, 20n);
    expect(runtimeAddress).toHaveBeenCalledWith(address);
    expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ args: { buyer: BUYER } }));
  });

  it("keeps EVM H160 addresses direct and stops queries before a contract deployment", async () => {
    await expect(resolveHistoryH160({ kind: "evm", address: BUYER } as any)).resolves.toBe(BUYER);
    const getLogs = vi.fn();
    const items = await readGenesis2PurchaseHistory({ getLogs } as unknown as PublicClient, phase2Manifest(), BUYER, 9n);
    expect(items).toEqual([]);
    expect(getLogs).not.toHaveBeenCalled();
  });

  it("renders phase labels, native-asset costs, and manifest explorer links", () => {
    const markup = renderToStaticMarkup(createElement(MiniHistory, {
      language: "en",
      genesis1: [{ amount: 2n * 10n ** 18n, blockNumber: 8n, transactionHash: HASH_A, logIndex: 0 }],
      genesis1Status: "ready",
      genesis1ExplorerUrl: "https://explorer.example/",
      genesis1Symbol: "DOT",
      genesis2: [{ ...log(14n, 2, HASH_B).args, blockNumber: 14n, transactionHash: HASH_B, logIndex: 2 }],
      genesis2Status: "ready",
      genesis2ExplorerUrl: "https://blockscout.example",
      genesis2Symbol: "PAS",
    }));
    expect(markup).toContain("Genesis I");
    expect(markup).toContain("Genesis II");
    expect(markup.indexOf('data-testid="genesis2-history"')).toBeLessThan(markup.indexOf('data-testid="genesis1-history"'));
    expect(markup).toContain("Contributed 2.00 DOT");
    expect(markup).toContain("Acquired 100.00 MINI");
    expect(markup).toContain("Paid 0.40 PAS");
    expect(markup).toContain(`href="https://explorer.example/tx/${HASH_A}"`);
    expect(markup).toContain(`href="https://blockscout.example/tx/${HASH_B}"`);
  });
});

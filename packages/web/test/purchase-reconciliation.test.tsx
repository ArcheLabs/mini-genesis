import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT, SOURCE_CONTRACT, SOURCE_HASH, DESTINATION, DESTINATION_HASH, BLOCK_HASH, manifest as baseManifest } from "./helpers";
import { GenesisPhase2 } from "../src/genesis/GenesisPhase2";
import type { GenesisCurveDynamic } from "../src/genesis/curve-reads";

const { buyExactMiniMock, walletClientMock } = vi.hoisted(() => ({
  buyExactMiniMock: vi.fn(),
  walletClientMock: vi.fn(() => ({})),
}));

vi.mock("../src/genesis/curve-contribution", () => ({
  buyExactMini: buyExactMiniMock,
  waitForTransactionFinality: vi.fn(),
}));
vi.mock("../src/wallet/wallet-client", () => ({ walletClient: walletClientMock }));

const UNIT = 10n ** 18n;
const phase2Address = "0x5555555555555555555555555555555555555555" as const;
const deployedManifest = baseManifest({
  environment: "staging",
  status: "deployed",
  evmNativeDecimals: 18,
  source: {
    chainId: "420420417", name: "Polkadot Hub TestNet", currencySymbol: "PAS", nativeDecimals: 10, evmNativeDecimals: 18,
    rpcHttpUrls: ["https://rpc.example"], substrateWsUrls: ["wss://ws.example"], substrateGenesisHash: SOURCE_HASH,
    ss58Prefix: 0, explorerUrl: "https://explorer.example", contract: SOURCE_CONTRACT, deploymentBlock: "1", runtimeCodeHash: BLOCK_HASH,
  },
  destination: { chainId: "420420419", genesisHash: DESTINATION_HASH, miniLucky: DESTINATION, trustGraph: ACCOUNT, personhoodPrecompile: DESTINATION, deploymentBlock: "1" },
  genesis: { phases: {
    phase1: { status: "ended", mechanism: "stream" },
    phase2: { status: "active", mechanism: "linear-bonding-curve", contract: phase2Address, deploymentBlock: "10", allocationMini: (2_000_000n * UNIT).toString(), startPriceX18: "3500000000000000", endPriceX18: "5500000000000000", startTime: "2000000000", endTime: "2000604800" },
    phase3: { status: "locked" },
  } },
});

function dynamic(state: { sold: bigint; raised: bigint; buyers: bigint; spot: bigint }): GenesisCurveDynamic {
  return {
    contract: phase2Address,
    phase: 1,
    phaseName: "Active",
    allocation: 2_000_000n * UNIT,
    startPrice: 3_500_000_000_000_000n,
    endPrice: 5_500_000_000_000_000n,
    startTime: 2_000_000_000n,
    endTime: 2_000_604_800n,
    totalSoldMini: state.sold,
    totalRaisedDot: state.raised,
    buyerCount: state.buyers,
    spotPrice: state.spot,
    observedTimestamp: 2_000_000_000n,
  };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function PurchaseHarness() {
  const [state, setState] = useState({
    userMini: 100n * UNIT,
    walletBalance: 20n * UNIT,
    sold: 0n,
    raised: 0n,
    buyers: 1n,
    spot: 3_500_000_000_000_000n,
  });
  const session = { kind: "evm" as const, status: "connected" as const, address: ACCOUNT, provider: {} as any, chainId: 420420417, correctChain: true, balance: state.walletBalance };
  const onReconcile = async () => {
    setState({ userMini: 200n * UNIT, walletBalance: 15n * UNIT, sold: 500_000n * UNIT, raised: 1_875n * UNIT, buyers: 2n, spot: 4_000_000_000_000_000n });
  };
  return createElement(GenesisPhase2, {
    language: "en",
    manifest: deployedManifest,
    publicClient: {} as any,
    session,
    provider: {} as any,
    walletReady: true,
    correctChain: true,
    dynamic: dynamic(state),
    demoMode: false,
    onConnect: () => {},
    onReconcile,
    userMini: state.userMini,
    userMiniLoading: false,
    userMiniError: false,
  });
}

describe("Genesis II purchase reconciliation", () => {
  beforeEach(() => {
    buyExactMiniMock.mockReset().mockResolvedValue({ hash: `0x${"ab".repeat(32)}`, blockNumber: 100n, miniAmount: 1n, dotCost: 1n, finalized: true });
    walletClientMock.mockReset().mockReturnValue({});
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    container?.remove();
    container = null;
  });

  it("updates MINI, native balance, curve price, sold, raised, holders, and remaining after finalized purchase", async () => {
    await act(async () => { root!.render(createElement(PurchaseHarness)); });
    const button = container!.querySelector(".submit-button")!;
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(buyExactMiniMock).toHaveBeenCalledOnce();
    expect(container!.querySelector('[data-testid="phase2-user-mini"]')?.textContent).toContain("200.00 MINI");
    expect(container!.querySelector('[data-testid="phase2-wallet-balance"]')?.textContent).toContain("15 PAS");
    expect(container!.querySelector('[data-testid="phase2-current-basis"]')?.textContent).toContain("0.004000 PAS / MINI");
    expect(container!.querySelector('[data-testid="phase2-total-sold"]')?.textContent).toContain("500,000.00 MINI");
    expect(container!.querySelector('[data-testid="phase2-total-raised"]')?.textContent).toContain("1,875.00 PAS");
    expect(container!.querySelector('[data-testid="phase2-holder-count"]')?.textContent).toBe("2");
    expect(container!.querySelector('[data-testid="phase2-remaining-mini"]')?.textContent).toContain("1,500,000.00 MINI");
    expect(container!.querySelector('[data-testid="bonding-curve-interaction"]')?.getAttribute("data-current-position")).toBe("25.000000%");
  });
});

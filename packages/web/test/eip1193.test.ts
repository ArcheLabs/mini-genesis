import { describe, expect, it, vi } from "vitest";
import { parseEip1193ChainId, switchEip1193Chain, type Eip1193Provider } from "../src/wallet/eip1193";

const network = {
  chainId: 420420420,
  name: "Development",
  nativeCurrency: { name: "MINI", symbol: "MINI", decimals: 18 },
  rpcUrls: ["http://127.0.0.1:8545"],
};

describe("EIP-1193 chain switching", () => {
  it("parses wallet chain IDs returned as hex or decimal", () => {
    expect(parseEip1193ChainId("0x190f1b44")).toBe(420420420);
    expect(parseEip1193ChainId("420420420")).toBe(420420420);
    expect(parseEip1193ChainId("not-a-chain")).toBeNull();
  });

  it("adds an unknown local chain without an empty block explorer URL, then verifies the switch", async () => {
    let activeChainId = 1;
    let switched = false;
    const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "wallet_switchEthereumChain") {
        if (!switched) { switched = true; throw Object.assign(new Error("unknown chain"), { code: 4902 }); }
        activeChainId = Number(BigInt((params?.[0] as { chainId: string }).chainId));
        return null;
      }
      if (method === "wallet_addEthereumChain") return null;
      if (method === "eth_chainId") return `0x${activeChainId.toString(16)}`;
      throw new Error(`Unexpected method: ${method}`);
    });

    await switchEip1193Chain({ request } as Eip1193Provider, network);

    const addRequest = request.mock.calls.find(([args]) => args.method === "wallet_addEthereumChain")?.[0];
    expect(addRequest?.params?.[0]).toEqual({
      chainId: "0x190f1b44",
      chainName: "Development",
      nativeCurrency: network.nativeCurrency,
      rpcUrls: network.rpcUrls,
    });
    expect(activeChainId).toBe(network.chainId);
  });

  it("does not issue a duplicate switch when adding the network already activated it", async () => {
    let activeChainId = 1;
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "wallet_switchEthereumChain") throw Object.assign(new Error("unknown chain"), { code: 4902 });
      if (method === "wallet_addEthereumChain") { activeChainId = network.chainId; return null; }
      if (method === "eth_chainId") return `0x${activeChainId.toString(16)}`;
      throw new Error(`Unexpected method: ${method}`);
    });

    await switchEip1193Chain({ request } as Eip1193Provider, network);

    expect(request.mock.calls.filter(([args]) => args.method === "wallet_switchEthereumChain")).toHaveLength(1);
    expect(activeChainId).toBe(network.chainId);
  });

  it("rejects a switch when the provider still reports the wrong chain", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => method === "eth_chainId" ? "0x1" : null);
    await expect(switchEip1193Chain({ request } as Eip1193Provider, network)).rejects.toThrow("CHAIN_SWITCH_REJECTED");
  });
});

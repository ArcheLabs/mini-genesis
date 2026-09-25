export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener?(event: string, listener: (...args: unknown[]) => void): unknown;
};

export type Eip1193Network = {
  chainId: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
};

const inFlightSwitches = new WeakMap<Eip1193Provider, Map<number, Promise<void>>>();

export function parseEip1193ChainId(value: unknown): number | null {
  try {
    const parsed = typeof value === "number"
      ? BigInt(value)
      : typeof value === "bigint"
        ? value
        : typeof value === "string" && (/^0x[0-9a-f]+$/i.test(value) || /^\d+$/.test(value))
          ? BigInt(value)
          : null;
    return parsed !== null && parsed > 0n && parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null;
  } catch {
    return null;
  }
}

export async function readEip1193ChainId(provider: Eip1193Provider): Promise<number | null> {
  return parseEip1193ChainId(await provider.request({ method: "eth_chainId" }));
}

function providerErrorCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = Number((error as { code?: unknown }).code);
  return Number.isInteger(code) ? code : null;
}

export function switchEip1193Chain(provider: Eip1193Provider, network: Eip1193Network): Promise<void> {
  const providerSwitches = inFlightSwitches.get(provider) ?? new Map<number, Promise<void>>();
  const pendingSwitch = providerSwitches.get(network.chainId);
  if (pendingSwitch) return pendingSwitch;

  const switchPromise = performEip1193ChainSwitch(provider, network).finally(() => {
    providerSwitches.delete(network.chainId);
    if (providerSwitches.size === 0) inFlightSwitches.delete(provider);
  });
  providerSwitches.set(network.chainId, switchPromise);
  inFlightSwitches.set(provider, providerSwitches);
  return switchPromise;
}

async function performEip1193ChainSwitch(provider: Eip1193Provider, network: Eip1193Network): Promise<void> {
  if (await readEip1193ChainId(provider) === network.chainId) return;
  const chainId = `0x${network.chainId.toString(16)}`;
  const switchChain = () => provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });

  try {
    await switchChain();
  } catch (error) {
    if (providerErrorCode(error) !== 4902) throw error;
    if (network.rpcUrls.length === 0) throw new Error("CONFIGURATION_MISMATCH");

    // blockExplorerUrls is optional in EIP-3085. In particular, do not send
    // [""] for the local Development chain, which has no block explorer.
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId,
        chainName: network.name,
        nativeCurrency: network.nativeCurrency,
        rpcUrls: network.rpcUrls,
      }],
    });
    // MetaMask can activate a newly added network as part of its approval
    // flow. Check before requesting a second switch, which can otherwise be
    // rejected as a duplicate request while that approval is still settling.
    if (await readEip1193ChainId(provider) !== network.chainId) await switchChain();
  }

  if (await readEip1193ChainId(provider) !== network.chainId) throw new Error("CHAIN_SWITCH_REJECTED");
}

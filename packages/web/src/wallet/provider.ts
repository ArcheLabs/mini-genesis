import { getAddress, numberToHex, type Address } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { DOT_SYMBOL, DOT_DECIMALS } from "../config/assets";

export type Eip1193Provider = { request(args: { method: string; params?: unknown[] }): Promise<unknown>; on?: (event: string, listener: (...args: unknown[]) => void) => void; removeListener?: (event: string, listener: (...args: unknown[]) => void) => void };
export type WalletStatus = "unavailable" | "disconnected" | "connecting" | "wrong_chain" | "connected" | "error";
export function injectedProvider(): Eip1193Provider | null { return (globalThis as typeof globalThis & { ethereum?: Eip1193Provider }).ethereum ?? null; }
export async function accounts(provider: Eip1193Provider, request = false): Promise<Address[]> {
  const result = await provider.request({ method: request ? "eth_requestAccounts" : "eth_accounts" });
  return (result as string[]).filter(Boolean).map(getAddress);
}
export async function providerChainId(provider: Eip1193Provider): Promise<number> { return Number(BigInt(String(await provider.request({ method: "eth_chainId" })))); }
export async function switchChain(provider: Eip1193Provider, manifest: DeploymentManifest): Promise<void> {
  const chainId = numberToHex(Number(manifest.source.chainId));
  try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] }); }
  catch (error) {
    if (!(error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 4902)) throw new Error("CHAIN_SWITCH_REJECTED");
    await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId, chainName: manifest.source.name, nativeCurrency: { name: DOT_SYMBOL, symbol: DOT_SYMBOL, decimals: DOT_DECIMALS }, rpcUrls: manifest.source.rpcHttpUrls.filter(Boolean), blockExplorerUrls: manifest.source.explorerUrl ? [manifest.source.explorerUrl] : [] }] });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  }
}

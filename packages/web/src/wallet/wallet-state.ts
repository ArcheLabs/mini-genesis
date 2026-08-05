import { getAddress, type Address } from "viem";

export function deriveWalletState(input: { isConnected: boolean; address?: string; chainId?: number | string; expectedChainId: number; hasProvider: boolean }): { account: Address | null; correctChain: boolean; walletReady: boolean } {
  const account = input.isConnected && input.address ? getAddress(input.address) : null;
  const correctChain = input.isConnected && Number(input.chainId) === input.expectedChainId;
  return { account, correctChain, walletReady: Boolean(account && correctChain && input.hasProvider) };
}

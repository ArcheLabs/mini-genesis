import { useCallback, useMemo } from "react";
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from "@reown/appkit/react";
import type { DeploymentManifest } from "../config/manifest";
import { polkadotHubNetwork } from "./appkit";
import type { Eip1193Provider } from "./eip1193";
import { deriveWalletState } from "./wallet-state";

export function useGenesisWallet(manifest: DeploymentManifest | null) {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount({ namespace: "eip155" });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<unknown>("eip155");
  const { disconnect: disconnectAppKit } = useDisconnect();
  const expectedChainId = Number(manifest?.source.chainId ?? polkadotHubNetwork.id);
  const provider = walletProvider ? walletProvider as Eip1193Provider : null;
  const walletState = useMemo(() => deriveWalletState({ isConnected, address, chainId, expectedChainId, hasProvider: Boolean(provider) }), [address, chainId, expectedChainId, isConnected, provider]);
  const connect = useCallback(() => open({ view: "Connect" }), [open]);
  const openAccount = useCallback(() => open({ view: "Account" }), [open]);
  const switchToGenesisChain = useCallback(() => switchNetwork(polkadotHubNetwork), [switchNetwork]);
  const disconnect = useCallback(() => disconnectAppKit({ namespace: "eip155" }), [disconnectAppKit]);
  return { ...walletState, isConnected, status, chainId, provider, connect, openAccount, switchToGenesisChain, disconnect };
}

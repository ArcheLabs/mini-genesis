import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from "@reown/appkit/react";
import type { DeploymentManifest } from "../config/manifest";
import { polkadotHubNetwork } from "./appkit";
import type { Eip1193Provider } from "./eip1193";
import { resolveContractAddress } from "./substrate/account";
import { readNativeBalance } from "./substrate/balance";
import { getSubstrateApi } from "./substrate/client";
import { checkAccountMapping } from "./substrate/mapping";
import { connectInjectedExtension, getInjectedExtensions, type InjectedExtension } from "polkadot-api/pjs-signer";
import { deriveWalletState } from "./wallet-state";
import type { MappingState } from "./types";

type SubstrateWalletAccount = { address: string; name?: string; polkadotSigner: any };

export function useGenesisWallet(manifest: DeploymentManifest | null) {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount({ namespace: "eip155" });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<unknown>("eip155");
  const { disconnect: disconnectAppKit } = useDisconnect();
  const expectedChainId = Number(manifest?.source.chainId ?? polkadotHubNetwork.id);
  const provider = walletProvider ? walletProvider as Eip1193Provider : null;
  const walletState = useMemo(() => deriveWalletState({ isConnected, address, chainId, expectedChainId, hasProvider: Boolean(provider) }), [address, chainId, expectedChainId, isConnected, provider]);
  const [substrateExtension, setSubstrateExtension] = useState<InjectedExtension | null>(null);
  const [substrateAccounts, setSubstrateAccounts] = useState<SubstrateWalletAccount[]>([]);
  const [substrateAccount, setSubstrateAccount] = useState<SubstrateWalletAccount | null>(null);
  const [substrateApi, setSubstrateApi] = useState<any>(null);
  const [substrateContractAddress, setSubstrateContractAddress] = useState<Address | null>(null);
  const [mappingState, setMappingState] = useState<MappingState>("checking");
  const [nativeBalance, setNativeBalance] = useState<bigint | null>(null);

  const connect = useCallback(() => open({ view: "Connect" }), [open]);
  const openAccount = useCallback(() => open({ view: "Account" }), [open]);
  const switchToGenesisChain = useCallback(() => switchNetwork(polkadotHubNetwork), [switchNetwork]);
  const disconnectEvm = useCallback(() => disconnectAppKit({ namespace: "eip155" }), [disconnectAppKit]);

  const connectPolkadot = useCallback(async () => {
    if (!manifest) throw new Error("SUBSTRATE_RPC_UNAVAILABLE");
    const extensions = getInjectedExtensions();
    if (!extensions.length) throw new Error("SUBSTRATE_WALLET_NOT_FOUND");
    const extension = await connectInjectedExtension(extensions[0]);
    const accounts = extension.getAccounts();
    if (!accounts.length) { extension.disconnect(); throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED"); }
    const selected = accounts[0];
    setSubstrateExtension(extension);
    setSubstrateAccounts(accounts);
    setSubstrateAccount(selected);
    setSubstrateContractAddress(null);
    setSubstrateApi(getSubstrateApi(manifest));
    setMappingState("checking");
    return selected.address;
  }, [manifest]);

  const selectPolkadotAccount = useCallback((address: string) => {
    const selected = substrateAccounts.find((candidate) => candidate.address === address);
    if (selected) { setSubstrateAccount(selected); setSubstrateContractAddress(null); setMappingState("checking"); setNativeBalance(null); }
  }, [substrateAccounts]);

  const disconnectPolkadot = useCallback(() => {
    substrateExtension?.disconnect();
    setSubstrateExtension(null); setSubstrateAccounts([]); setSubstrateAccount(null); setSubstrateApi(null); setSubstrateContractAddress(null); setNativeBalance(null); setMappingState("checking");
  }, [substrateExtension]);

  const refreshNativeBalance = useCallback(async () => {
    if (!substrateApi || !substrateAccount) return;
    const balance = await readNativeBalance(substrateApi, substrateAccount.address);
    setNativeBalance(balance.spendable);
    if (substrateContractAddress) {
      const mapping = await checkAccountMapping(substrateApi, substrateContractAddress, substrateAccount.address);
      setMappingState(mapping);
    }
  }, [substrateAccount, substrateApi, substrateContractAddress]);

  useEffect(() => {
    if (!substrateApi || !substrateAccount || !manifest) return;
    let disposed = false;
    void resolveContractAddress(substrateApi, substrateAccount.address).then(async (resolution) => {
      if (disposed) return;
      setSubstrateContractAddress(resolution.h160);
      const [mapped] = await Promise.all([
        checkAccountMapping(substrateApi, resolution.h160, substrateAccount.address),
        refreshNativeBalance(),
      ]);
      if (!disposed) setMappingState(mapped);
    }).catch(() => { if (!disposed) setMappingState("failed"); });
    return () => { disposed = true; };
  }, [manifest, refreshNativeBalance, substrateAccount, substrateApi]);

  const substrateReady = Boolean(substrateAccount && substrateApi && substrateContractAddress && mappingState !== "failed" && mappingState !== "conflict");
  return {
    ...walletState,
    isConnected, status, chainId, provider,
    connect, openAccount, switchToGenesisChain, disconnect: disconnectEvm,
    connectPolkadot, disconnectPolkadot,
    selectPolkadotAccount, substrateAccounts, substrateAccount, substrateSigner: substrateAccount?.polkadotSigner ?? null, substrateApi,
    substrateExtensionName: substrateExtension?.name ?? null,
    substrateContractAddress,
    mappingState, nativeBalance,
    refreshNativeBalance,
    paymentKind: substrateReady ? "substrate" as const : walletState.walletReady ? "evm" as const : null,
    paymentReady: substrateReady || walletState.walletReady,
  };
}

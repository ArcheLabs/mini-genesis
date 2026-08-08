import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bytesToHex, getAddress, type Address, type PublicClient } from "viem";
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from "@reown/appkit/react";
import type { DeploymentManifest } from "../config/manifest";
import { polkadotHubNetwork } from "./appkit";
import type { Eip1193Provider } from "./eip1193";
import { accountId32FromSs58, resolveContractAddress } from "./substrate/account";
import { readNativeBalance } from "./substrate/balance";
import { getSubstrateApi } from "./substrate/client";
import { connectInjectedExtension, getInjectedExtensions, type InjectedExtension, type InjectedPolkadotAccount } from "polkadot-api/pjs-signer";
import type { EvmWalletSession, PolkadotAccount, PolkadotWalletDescriptor, PolkadotWalletSession, WalletSession } from "./types";

const POLKADOT_WALLET_NAMES: Record<string, string> = {
  "subwallet-js": "SubWallet",
  talisman: "Talisman",
};

export function describePolkadotWallet(extensionId: string): PolkadotWalletDescriptor {
  const known = POLKADOT_WALLET_NAMES[extensionId.toLowerCase()];
  if (known) return { extensionId, displayName: known };
  const displayName = extensionId
    .replace(/-js$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim() || "Polkadot Wallet";
  return { extensionId, displayName };
}

export function toPolkadotAccount(account: InjectedPolkadotAccount): PolkadotAccount | null {
  const publicKey = account.polkadotSigner?.publicKey;
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) return null;
  try {
    const accountId32 = accountId32FromSs58(account.address);
    if (accountId32.length !== 32) return null;
    return { address: account.address, name: account.name, signer: account.polkadotSigner, accountId32 };
  } catch {
    return null;
  }
}

export function supportedAccounts(accounts: InjectedPolkadotAccount[]): PolkadotAccount[] {
  const seen = new Set<string>();
  return accounts.map(toPolkadotAccount).filter((account): account is PolkadotAccount => {
    if (!account) return false;
    const key = bytesToHex(account.accountId32).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useGenesisWallet(manifest: DeploymentManifest | null, publicClient: PublicClient | null = null, nativeManifest: DeploymentManifest | null = manifest) {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount({ namespace: "eip155" });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<unknown>("eip155");
  const { disconnect: disconnectAppKit } = useDisconnect();
  const expectedChainId = Number(manifest?.source.chainId ?? polkadotHubNetwork.id);
  const provider = walletProvider ? walletProvider as Eip1193Provider : null;
  const evmAddress = isConnected && address ? getAddress(address) : null;

  const [substrateExtension, setSubstrateExtension] = useState<InjectedExtension | null>(null);
  const [substrateAccounts, setSubstrateAccounts] = useState<PolkadotAccount[]>([]);
  const [selectedPolkadotAddress, setSelectedPolkadotAddress] = useState<string | null>(null);
  const [substrateApi, setSubstrateApi] = useState<any | null>(null);
  const [nativeBalance, setNativeBalance] = useState<bigint | null>(null);
  const [substrateContractAddress, setSubstrateContractAddress] = useState<Address | null>(null);
  const [contractIdentityStatus, setContractIdentityStatus] = useState<PolkadotWalletSession["contractIdentityStatus"]>("loading");
  const [evmBalance, setEvmBalance] = useState<bigint | null>(null);
  const [availablePolkadotWallets, setAvailablePolkadotWallets] = useState<PolkadotWalletDescriptor[]>(() => typeof window === "undefined" ? [] : getInjectedExtensions().map(describePolkadotWallet));
  const selectedAddressRef = useRef<string | null>(selectedPolkadotAddress);
  selectedAddressRef.current = selectedPolkadotAddress;

  const refreshPolkadotWallets = useCallback(() => setAvailablePolkadotWallets(getInjectedExtensions().map(describePolkadotWallet)), []);
  useEffect(() => {
    window.addEventListener("focus", refreshPolkadotWallets);
    return () => window.removeEventListener("focus", refreshPolkadotWallets);
  }, [refreshPolkadotWallets]);

  const evmSession = useMemo<EvmWalletSession | null>(() => {
    if (!evmAddress || !provider) return null;
    return {
      kind: "evm",
      status: "connected",
      address: evmAddress,
      provider,
      chainId: chainId == null ? null : Number(chainId),
      correctChain: Number(chainId) === expectedChainId,
      balance: evmBalance,
    };
  }, [chainId, evmAddress, evmBalance, expectedChainId, provider]);

  const selectedPolkadotAccount = substrateAccounts.find((account) => account.address === selectedPolkadotAddress) ?? null;
  const polkadotSession = useMemo<PolkadotWalletSession | null>(() => {
    if (!substrateExtension || !selectedPolkadotAccount) return null;
    return {
      kind: "polkadot",
      status: "connected",
      extensionId: substrateExtension.name,
      walletName: describePolkadotWallet(substrateExtension.name).displayName,
      accounts: substrateAccounts,
      selectedAccountAddress: selectedPolkadotAccount.address,
      balance: nativeBalance,
      api: substrateApi,
      contractIdentity: substrateContractAddress,
      contractIdentityStatus,
    };
  }, [contractIdentityStatus, nativeBalance, selectedPolkadotAccount, substrateAccounts, substrateApi, substrateContractAddress, substrateExtension]);

  const session: WalletSession = substrateExtension ? polkadotSession : evmSession;
  const sessionKey = session?.kind === "evm" ? `evm:${session.address}` : session?.kind === "polkadot" ? `polkadot:${session.selectedAccountAddress}` : null;

  useEffect(() => {
    if (!substrateExtension || !nativeManifest) return;
    try { setSubstrateApi(getSubstrateApi(nativeManifest)); } catch { setSubstrateApi(null); }
  }, [nativeManifest, substrateExtension]);

  useEffect(() => {
    if (!substrateExtension) return;
    let disposed = false;
    const updateAccounts = (accounts: InjectedPolkadotAccount[]) => {
      const next = supportedAccounts(accounts);
      if (disposed) return;
      if (!next.length) {
        substrateExtension.disconnect();
        setSubstrateExtension(null);
        setSubstrateAccounts([]);
        setSelectedPolkadotAddress(null);
        setSubstrateApi(null);
        return;
      }
      setSubstrateAccounts(next);
      setSelectedPolkadotAddress((current) => next.some((account) => account.address === current) ? current : next[0].address);
    };
    const stop = substrateExtension.subscribe(updateAccounts);
    return () => { disposed = true; stop(); };
  }, [substrateExtension]);

  useEffect(() => {
    if (!selectedPolkadotAccount || !substrateApi) return;
    const requestedAddress = selectedPolkadotAccount.address;
    let disposed = false;
    setNativeBalance(null);
    setSubstrateContractAddress(null);
    setContractIdentityStatus("loading");
    void Promise.allSettled([
      readNativeBalance(substrateApi, requestedAddress),
      resolveContractAddress(substrateApi, requestedAddress),
    ]).then(([balance, resolution]) => {
      if (disposed || selectedAddressRef.current !== requestedAddress) return;
      if (balance.status === "fulfilled") setNativeBalance(balance.value.free);
      if (resolution.status === "fulfilled") {
        setSubstrateContractAddress(resolution.value.h160);
        setContractIdentityStatus("verified");
      } else {
        setContractIdentityStatus("error");
      }
    });
    return () => { disposed = true; };
  }, [selectedPolkadotAccount, substrateApi]);

  useEffect(() => {
    if (!evmSession || !publicClient) return;
    let disposed = false;
    setEvmBalance(null);
    void publicClient.getBalance({ address: evmSession.address }).then((balance) => { if (!disposed) setEvmBalance(balance); }).catch(() => { if (!disposed) setEvmBalance(null); });
    return () => { disposed = true; };
  }, [evmSession?.address, publicClient]);

  const connectEvm = useCallback(() => {
    if (substrateExtension) throw new Error("WALLET_DISCONNECT_REQUIRED");
    open({ view: "Connect" });
  }, [open, substrateExtension]);
  const openAccount = useCallback(() => open({ view: "Account" }), [open]);
  const switchToGenesisChain = useCallback(() => switchNetwork(polkadotHubNetwork), [switchNetwork]);

  const connectPolkadot = useCallback(async (extensionId?: string) => {
    if (isConnected) throw new Error("WALLET_DISCONNECT_REQUIRED");
    const name = extensionId ?? getInjectedExtensions()[0];
    if (!name) throw new Error("NO_POLKADOT_WALLET");
    const extension = await connectInjectedExtension(name, "MINI Genesis");
    const accounts = supportedAccounts(extension.getAccounts());
    if (!accounts.length) {
      extension.disconnect();
      throw new Error("NO_SUPPORTED_POLKADOT_ACCOUNT");
    }
    setSubstrateExtension(extension);
    setSubstrateAccounts(accounts);
    setSelectedPolkadotAddress(accounts[0].address);
    setSubstrateApi(null);
    setNativeBalance(null);
    setSubstrateContractAddress(null);
    setContractIdentityStatus("loading");
    return accounts[0].address;
  }, [isConnected]);

  const selectPolkadotAccount = useCallback((addressToSelect: string) => {
    if (!substrateAccounts.some((account) => account.address === addressToSelect)) return;
    setSelectedPolkadotAddress(addressToSelect);
    setNativeBalance(null);
    setSubstrateContractAddress(null);
    setContractIdentityStatus("loading");
  }, [substrateAccounts]);

  const disconnectPolkadot = useCallback(() => {
    substrateExtension?.disconnect();
    setSubstrateExtension(null);
    setSubstrateAccounts([]);
    setSelectedPolkadotAddress(null);
    setSubstrateApi(null);
    setNativeBalance(null);
    setSubstrateContractAddress(null);
    setContractIdentityStatus("loading");
  }, [substrateExtension]);

  const disconnect = useCallback(() => {
    if (substrateExtension) disconnectPolkadot();
    else void disconnectAppKit({ namespace: "eip155" });
  }, [disconnectAppKit, disconnectPolkadot, substrateExtension]);

  const refreshNativeBalance = useCallback(async () => {
    if (!substrateApi || !selectedPolkadotAddress) return;
    const requestedAddress = selectedPolkadotAddress;
    try {
      const balance = await readNativeBalance(substrateApi, requestedAddress);
      if (selectedAddressRef.current === requestedAddress) setNativeBalance(balance.free);
    } catch { /* Keep the connected session and let the UI show an unavailable balance. */ }
  }, [selectedPolkadotAddress, substrateApi]);

  const walletReady = Boolean(session && (session.kind === "evm" ? session.provider : session.api && session.contractIdentity && session.contractIdentityStatus === "verified"));
  return {
    session,
    sessionKey,
    walletReady,
    walletConnecting: status === "connecting" || (!session && Boolean(substrateExtension)),
    connectEvm,
    connectPolkadot,
    disconnect,
    disconnectPolkadot,
    openAccount,
    switchToGenesisChain,
    selectPolkadotAccount,
    refreshNativeBalance,
    availablePolkadotWallets,
    polkadotAccounts: substrateAccounts,
    provider,
    isConnected,
    status,
    chainId,
  };
}

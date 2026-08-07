import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress, type Address, type PublicClient } from "viem";
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from "@reown/appkit/react";
import type { DeploymentManifest } from "../config/manifest";
import { polkadotHubNetwork } from "./appkit";
import type { Eip1193Provider } from "./eip1193";
import { resolveContractAddress } from "./substrate/account";
import { readNativeBalance } from "./substrate/balance";
import { getSubstrateApi } from "./substrate/client";
import { connectInjectedExtension, getInjectedExtensions, type InjectedExtension, type InjectedPolkadotAccount } from "polkadot-api/pjs-signer";
import { createEvmPaymentSource, createPolkadotPaymentSource, chooseDefaultPaymentSource, persistPaymentSource } from "./payment-source";
import type { EvmPaymentSource, PaymentSource, PolkadotPaymentSource, WalletSession } from "./types";

type NativeSourceState = { contractAddressStatus: PolkadotPaymentSource["contractAddressStatus"]; contractIdentity: Address; balance: PolkadotPaymentSource["balance"] };

function sessionWalletName(substrateExtension: InjectedExtension | null, evmAddress: Address | null): string | null {
  return substrateExtension?.name ?? (evmAddress ? "Connected wallet" : null);
}

export function useWalletSession(manifest: DeploymentManifest | null, publicClient: PublicClient | null = null) {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount({ namespace: "eip155" });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<unknown>("eip155");
  const { disconnect: disconnectAppKit } = useDisconnect();
  const expectedChainId = Number(manifest?.source.chainId ?? polkadotHubNetwork.id);
  const provider = walletProvider ? walletProvider as Eip1193Provider : null;
  const [availablePolkadotWallets, setAvailablePolkadotWallets] = useState<string[]>(() => typeof window === "undefined" ? [] : getInjectedExtensions());
  const [substrateExtension, setSubstrateExtension] = useState<InjectedExtension | null>(null);
  const [substrateAccounts, setSubstrateAccounts] = useState<InjectedPolkadotAccount[]>([]);
  const [substrateApi, setSubstrateApi] = useState<any>(null);
  const [nativeSources, setNativeSources] = useState<Record<string, NativeSourceState>>({});
  const [evmSignerStatus, setEvmSignerStatus] = useState<EvmPaymentSource["signerStatus"]>(provider ? "ready" : "unavailable");
  const [evmBalances, setEvmBalances] = useState<Record<string, PaymentSource["balance"]>>({});
  const [selectedPaymentSourceId, setSelectedPaymentSourceId] = useState<string | null>(null);
  const sessionId = useRef("wallet-session");
  const selectedIdRef = useRef(selectedPaymentSourceId);
  selectedIdRef.current = selectedPaymentSourceId;

  const refreshInjectedWallets = useCallback(() => setAvailablePolkadotWallets(getInjectedExtensions()), []);
  const setEvmBalance = useCallback((id: string, amount: bigint | null, decimals: number, error?: string) => {
    setEvmBalances((current) => ({ ...current, [id]: { status: error ? "error" : "ready", amount, decimals, ...(error ? { error } : {}) } }));
  }, []);

  useEffect(() => {
    window.addEventListener("focus", refreshInjectedWallets);
    return () => window.removeEventListener("focus", refreshInjectedWallets);
  }, [refreshInjectedWallets]);

  const evmAddress = isConnected && address ? getAddress(address) : null;
  const evmWalletId = "appkit:eip155";
  const evmSource = useMemo(() => {
    if (!evmAddress) return null;
    return createEvmPaymentSource({
      walletId: evmWalletId,
      walletName: "Connected wallet",
      address: evmAddress,
      provider,
      chainId: chainId == null ? null : Number(chainId),
      expectedChainId,
      decimals: manifest?.source.evmNativeDecimals ?? 18,
    });
  }, [chainId, expectedChainId, evmAddress, manifest?.source.evmNativeDecimals, provider]);

  useEffect(() => {
    if (!provider || !evmAddress) {
      setEvmSignerStatus("unavailable");
      return;
    }
    setEvmSignerStatus("ready");
    const eventProvider = provider as Eip1193Provider & { on?: (event: string, listener: (value: unknown) => void) => void; removeListener?: (event: string, listener: (value: unknown) => void) => void };
    if (!eventProvider.on) return;
    const onAccountsChanged = (value: unknown) => {
      const accounts = Array.isArray(value) ? value.map(String).map((item) => item.toLowerCase()) : [];
      setEvmSignerStatus(accounts.includes(evmAddress.toLowerCase()) ? "ready" : accounts.length ? "lazy" : "unavailable");
    };
    const onChainChanged = () => setEvmSignerStatus("ready");
    eventProvider.on("accountsChanged", onAccountsChanged);
    eventProvider.on("chainChanged", onChainChanged);
    return () => {
      eventProvider.removeListener?.("accountsChanged", onAccountsChanged);
      eventProvider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [evmAddress, provider]);

  const nativePaymentSources = useMemo(() => substrateAccounts.map((account) => {
    const id = `${substrateExtension?.name ? `injected:${substrateExtension.name}` : "injected:wallet"}:polkadot:${account.address}`;
    const state = nativeSources[id];
    const source = createPolkadotPaymentSource({
      walletId: substrateExtension?.name ? `injected:${substrateExtension.name}` : "injected:wallet",
      walletName: substrateExtension?.name ?? "Connected wallet",
      address: account.address,
      name: account.name,
      signer: account.polkadotSigner,
      api: substrateApi,
      decimals: manifest?.source.nativeDecimals ?? 10,
    });
    return {
      ...source,
      balance: state?.balance ?? source.balance,
      contractIdentity: state?.contractIdentity ?? source.contractIdentity,
      contractAddressStatus: state?.contractAddressStatus ?? source.contractAddressStatus,
    };
  }), [manifest?.source.nativeDecimals, nativeSources, substrateAccounts, substrateApi, substrateExtension]);

  const paymentSources = useMemo<PaymentSource[]>(() => {
    const sources: PaymentSource[] = [...nativePaymentSources];
    if (evmSource) sources.push({ ...evmSource, balance: evmSource.balance, signerStatus: evmSignerStatus });
    return sources;
  }, [evmSignerStatus, evmSource, nativePaymentSources]);

  const selectedPaymentSource = useMemo(() => paymentSources.find((source) => source.id === selectedPaymentSourceId) ?? null, [paymentSources, selectedPaymentSourceId]);
  const sessionStatus: WalletSession["status"] = paymentSources.length ? "connected" : status === "connecting" ? "connecting" : "disconnected";
  const session = useMemo<WalletSession>(() => ({
    id: sessionId.current,
    status: sessionStatus,
    walletName: sessionWalletName(substrateExtension, evmAddress),
    paymentSources,
    selectedPaymentSourceId: selectedPaymentSource?.id ?? null,
  }), [evmAddress, paymentSources, selectedPaymentSource, sessionStatus, substrateExtension]);

  useEffect(() => {
    if (!paymentSources.length) {
      setSelectedPaymentSourceId(null);
      return;
    }
    const current = selectedIdRef.current ? paymentSources.find((source) => source.id === selectedIdRef.current) : null;
    const next = current ?? chooseDefaultPaymentSource(paymentSources);
    if (next && next.id !== selectedIdRef.current) {
      setSelectedPaymentSourceId(next.id);
      persistPaymentSource(next);
    }
  }, [paymentSources]);

  useEffect(() => {
    if (!substrateExtension || !manifest) return;
    let disposed = false;
    try {
      setSubstrateApi(getSubstrateApi(manifest));
    } catch {
      setSubstrateApi(null);
    }
    const updateAccounts = (accounts: InjectedPolkadotAccount[]) => {
      if (!disposed) setSubstrateAccounts(accounts);
    };
    const stop = substrateExtension.subscribe(updateAccounts);
    return () => { disposed = true; stop(); };
  }, [manifest, substrateExtension]);

  useEffect(() => {
    if (!substrateApi || !substrateAccounts.length) return;
    let disposed = false;
    for (const account of substrateAccounts) {
      const walletId = substrateExtension?.name ? `injected:${substrateExtension.name}` : "injected:wallet";
      const id = `${walletId}:polkadot:${account.address}`;
      void Promise.allSettled([
        resolveContractAddress(substrateApi, account.address),
        readNativeBalance(substrateApi, account.address),
      ]).then(([resolution, balance]) => {
        if (disposed) return;
        setNativeSources((current) => {
          const previous = current[id];
          const next = { ...previous, contractAddressStatus: previous?.contractAddressStatus ?? "provisional", contractIdentity: previous?.contractIdentity ?? createPolkadotPaymentSource({ walletId, walletName: substrateExtension?.name ?? "Connected wallet", address: account.address, name: account.name, signer: account.polkadotSigner, api: substrateApi, decimals: manifest?.source.nativeDecimals ?? 10 }).contractIdentity, balance: previous?.balance ?? { status: "loading", amount: null, decimals: manifest?.source.nativeDecimals ?? 10 } } as NativeSourceState;
          if (resolution.status === "fulfilled") { next.contractIdentity = resolution.value.h160; next.contractAddressStatus = "verified"; }
          else { next.contractAddressStatus = "error"; }
          if (balance.status === "fulfilled") { next.balance = { status: "ready", amount: balance.value.spendable, decimals: manifest?.source.nativeDecimals ?? 10 }; }
          else { next.balance = { status: "error", amount: null, decimals: manifest?.source.nativeDecimals ?? 10, error: "NATIVE_BALANCE_UNAVAILABLE" }; }
          return { ...current, [id]: next };
        });
      });
    }
    return () => { disposed = true; };
  }, [manifest?.source.nativeDecimals, substrateAccounts, substrateApi, substrateExtension]);

  useEffect(() => {
    if (!evmSource || !publicClient) return;
    let disposed = false;
    void publicClient.getBalance({ address: evmSource.address }).then((amount) => {
      if (disposed) return;
      setEvmBalance(evmSource.id, amount, manifest?.source.evmNativeDecimals ?? 18);
    }).catch(() => {
      if (disposed) return;
      setEvmBalance(evmSource.id, null, manifest?.source.evmNativeDecimals ?? 18, "EVM_BALANCE_UNAVAILABLE");
    });
    return () => { disposed = true; };
  }, [evmSource, manifest?.source.evmNativeDecimals, publicClient]);

  const hydratedSources = useMemo(() => paymentSources.map((source) => source.kind === "evm" && evmBalances[source.id] ? { ...source, balance: evmBalances[source.id] } : source), [evmBalances, paymentSources]);
  const hydratedSelectedPaymentSource = useMemo(() => hydratedSources.find((source) => source.id === selectedPaymentSourceId) ?? null, [hydratedSources, selectedPaymentSourceId]);

  const selectPaymentSource = useCallback((id: string) => {
    const source = hydratedSources.find((candidate) => candidate.id === id);
    if (!source) return;
    setSelectedPaymentSourceId(source.id);
    persistPaymentSource(source);
  }, [hydratedSources]);

  const connect = useCallback(() => open({ view: "Connect" }), [open]);
  const connectWallet = connect;
  const openAccount = useCallback(() => open({ view: "Account" }), [open]);
  const switchToGenesisChain = useCallback(() => switchNetwork(polkadotHubNetwork), [switchNetwork]);
  const connectPolkadotExtension = useCallback(async (name?: string) => {
    const extensionName = name ?? getInjectedExtensions()[0];
    if (!extensionName) throw new Error("SUBSTRATE_WALLET_NOT_FOUND");
    const extension = await connectInjectedExtension(extensionName, "MINI Genesis");
    const accounts = extension.getAccounts();
    if (!accounts.length) { extension.disconnect(); throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED"); }
    if (substrateExtension && substrateExtension !== extension) substrateExtension.disconnect();
    setSubstrateExtension(extension);
    setSubstrateAccounts(accounts);
    setSubstrateApi(manifest ? getSubstrateApi(manifest) : null);
    return accounts[0].address;
  }, [manifest, substrateExtension]);
  const disconnect = useCallback(() => {
    substrateExtension?.disconnect();
    setSubstrateExtension(null);
    setSubstrateAccounts([]);
    setSubstrateApi(null);
    setNativeSources({});
    setSelectedPaymentSourceId(null);
    void disconnectAppKit({ namespace: "eip155" });
  }, [disconnectAppKit, substrateExtension]);
  const ensurePaymentSourceSigner = useCallback(async (source: PaymentSource | null = hydratedSelectedPaymentSource): Promise<PaymentSource> => {
    if (!source) throw new Error("PAYMENT_SOURCE_NOT_SELECTED");
    if (source.kind !== "evm") return source;
    if (!source.provider) throw new Error("EVM_SIGNER_UNAVAILABLE");
    const authorized = await source.provider.request({ method: "eth_accounts" });
    let accounts = Array.isArray(authorized) ? authorized.map(String) : [];
    if (!accounts.some((item) => item.toLowerCase() === source.address.toLowerCase())) {
      const requested = await source.provider.request({ method: "eth_requestAccounts" });
      accounts = Array.isArray(requested) ? requested.map(String) : [];
    }
    if (!accounts.some((item) => item.toLowerCase() === source.address.toLowerCase())) throw new Error("EVM_PAYMENT_SOURCE_MISMATCH");
    setEvmSignerStatus("ready");
    return { ...source, signerStatus: "ready" };
  }, [hydratedSelectedPaymentSource]);
  const refreshPaymentSource = useCallback(async (sourceId = hydratedSelectedPaymentSource?.id) => {
    const source = hydratedSources.find((candidate) => candidate.id === sourceId);
    if (!source) return;
    if (source.kind === "evm" && publicClient) {
      try { setEvmBalance(source.id, await publicClient.getBalance({ address: source.address }), source.decimals); }
      catch { setEvmBalance(source.id, null, source.decimals, "EVM_BALANCE_UNAVAILABLE"); }
    }
    if (source.kind === "polkadot" && source.api) {
      try {
        const balance = await readNativeBalance(source.api, source.address);
        setNativeSources((current) => ({ ...current, [source.id]: { ...(current[source.id] ?? { contractIdentity: source.contractIdentity, contractAddressStatus: source.contractAddressStatus }), balance: { status: "ready", amount: balance.spendable, decimals: source.decimals } } }));
      } catch { /* source-level error is represented by its balance status */ }
    }
  }, [hydratedSelectedPaymentSource?.id, hydratedSources, publicClient, setEvmBalance]);

  const selected = hydratedSelectedPaymentSource;
  const account = evmAddress;
  const correctChain = evmSource?.correctChain ?? false;
  const walletReady = Boolean(selected && (selected.kind === "polkadot" ? selected.signer && selected.api && selected.contractAddressStatus !== "error" : selected.signerStatus !== "unavailable"));
  return {
    session: { ...session, paymentSources: hydratedSources, selectedPaymentSourceId: selected?.id ?? null },
    selectedPaymentSource: selected,
    connect: connectWallet,
    connectWallet,
    connectPolkadotExtension,
    disconnect,
    selectPaymentSource,
    refreshPaymentSource,
    ensurePaymentSourceSigner,
    openAccount,
    switchToGenesisChain,
    account,
    provider,
    isConnected,
    status,
    chainId,
    correctChain,
    walletReady,
    paymentReady: walletReady,
    substrateApi,
    availablePolkadotWallets,
  };
}

/** Compatibility export for code that still imports the previous hook name. */
export const useGenesisWallet = useWalletSession;

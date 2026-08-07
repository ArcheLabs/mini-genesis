import { getAddress, type Address } from "viem";
import { accountId32FromSs58, deriveNativeAccountH160 } from "./substrate/account";
import type { EvmPaymentSource, PaymentSource, PolkadotPaymentSource } from "./types";

export const PAYMENT_SOURCE_STORAGE_KEY = "mini-genesis-payment-source";

export function normalizePaymentAddress(kind: "polkadot" | "evm", address: string): string {
  return kind === "evm" ? getAddress(address).toLowerCase() : address;
}

export function polkadotPaymentSourceId(walletId: string, address: string): string {
  return `${walletId}:polkadot:${normalizePaymentAddress("polkadot", address)}`;
}

export function evmPaymentSourceId(walletId: string, address: Address): string {
  return `${walletId}:evm:${normalizePaymentAddress("evm", address)}`;
}

export function createPolkadotPaymentSource(input: {
  walletId: string;
  walletName: string;
  address: string;
  name?: string;
  signer: PolkadotPaymentSource["signer"];
  api: any;
  decimals: number;
}): PolkadotPaymentSource {
  const accountId32 = accountId32FromSs58(input.address);
  return {
    id: polkadotPaymentSourceId(input.walletId, input.address),
    kind: "polkadot",
    walletId: input.walletId,
    walletName: input.walletName,
    address: input.address,
    name: input.name,
    accountId32,
    signer: input.signer,
    balance: { status: "loading", amount: null, decimals: input.decimals },
    decimals: input.decimals,
    contractIdentity: deriveNativeAccountH160(accountId32),
    contractAddressStatus: "provisional",
    execution: "revive",
    api: input.api,
  };
}

export function createEvmPaymentSource(input: {
  walletId: string;
  walletName: string;
  address: Address;
  provider: EvmPaymentSource["provider"];
  chainId: number | null;
  expectedChainId: number;
  decimals: number;
  balance?: PaymentSource["balance"];
}): EvmPaymentSource {
  return {
    id: evmPaymentSourceId(input.walletId, input.address),
    kind: "evm",
    walletId: input.walletId,
    walletName: input.walletName,
    address: getAddress(input.address),
    balance: input.balance ?? { status: "loading", amount: null, decimals: input.decimals },
    decimals: input.decimals,
    signerStatus: input.provider ? "ready" : "unavailable",
    provider: input.provider,
    chainId: input.chainId,
    correctChain: input.chainId === input.expectedChainId,
    execution: "evm",
  };
}

export function paymentSourceMatchesStored(source: PaymentSource, stored: { walletId?: string; kind?: string; address?: string } | null): boolean {
  if (!stored || stored.walletId !== source.walletId || stored.kind !== source.kind || !stored.address) return false;
  try {
    return normalizePaymentAddress(source.kind, stored.address) === normalizePaymentAddress(source.kind, source.address);
  } catch {
    return false;
  }
}

export function readStoredPaymentSource(): { walletId?: string; kind?: string; address?: string } | null {
  try {
    const raw = localStorage.getItem(PAYMENT_SOURCE_STORAGE_KEY);
    return raw ? JSON.parse(raw) as { walletId?: string; kind?: string; address?: string } : null;
  } catch {
    return null;
  }
}

export function persistPaymentSource(source: PaymentSource): void {
  try {
    localStorage.setItem(PAYMENT_SOURCE_STORAGE_KEY, JSON.stringify({ walletId: source.walletId, kind: source.kind, address: source.address }));
  } catch {
    // Storage is an optional convenience and must not block wallet use.
  }
}

export function chooseDefaultPaymentSource(sources: PaymentSource[], stored = readStoredPaymentSource()): PaymentSource | null {
  return sources.find((source) => paymentSourceMatchesStored(source, stored))
    ?? sources.find((source) => source.kind === "polkadot")
    ?? sources[0]
    ?? null;
}

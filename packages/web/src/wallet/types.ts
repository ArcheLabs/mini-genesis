import type { Address } from "viem";
import type { PolkadotSigner } from "@polkadot-api/signer";
import type { Eip1193Provider } from "./eip1193";

/** Kept for the lazy compatibility fallback in the native execution adapter. */
export type MappingState = "checking" | "unmapped" | "mapping" | "mapped" | "conflict" | "failed";

export type PolkadotAccount = {
  address: string;
  name?: string;
  signer: PolkadotSigner;
  accountId32: Uint8Array;
};

export type EvmWalletSession = {
  kind: "evm";
  status: "connected";
  address: Address;
  provider: Eip1193Provider;
  chainId: number | null;
  correctChain: boolean;
  balance: bigint | null;
};

export type PolkadotWalletSession = {
  kind: "polkadot";
  status: "connecting" | "connected";
  extensionId: string;
  walletName: string;
  accounts: PolkadotAccount[];
  selectedAccountAddress: string;
  balance: bigint | null;
  api: any | null;
  contractIdentity: Address | null;
  contractIdentityStatus: "loading" | "verified" | "error";
};

export type WalletSession = EvmWalletSession | PolkadotWalletSession | null;

export type PolkadotWalletDescriptor = {
  extensionId: string;
  displayName: string;
};

/** Compatibility aliases for modules that still import the old names. */
export type EvmGenesisWallet = EvmWalletSession;
export type SubstrateGenesisWallet = PolkadotWalletSession;
export type GenesisWallet = EvmGenesisWallet | SubstrateGenesisWallet;

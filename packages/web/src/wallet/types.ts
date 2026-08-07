import type { Address } from "viem";
import type { PolkadotSigner } from "polkadot-api/pjs-signer";
import type { Eip1193Provider } from "./eip1193";

export type MappingState = "checking" | "unmapped" | "mapping" | "mapped" | "conflict" | "failed";

export type PaymentSourceKind = "polkadot" | "evm";
export type PaymentSourceBalanceStatus = "idle" | "loading" | "ready" | "error";
export type ContractAddressStatus = "provisional" | "verified" | "error";

export type PaymentSourceBalance = {
  status: PaymentSourceBalanceStatus;
  amount: bigint | null;
  decimals: number;
  error?: string;
};

export type PolkadotPaymentSource = {
  id: string;
  kind: "polkadot";
  walletId: string;
  walletName: string;
  address: string;
  name?: string;
  accountId32: Uint8Array;
  signer: PolkadotSigner;
  balance: PaymentSourceBalance;
  decimals: number;
  contractIdentity: Address;
  contractAddressStatus: ContractAddressStatus;
  execution: "revive";
  api: any;
};

export type EvmPaymentSource = {
  id: string;
  kind: "evm";
  walletId: string;
  walletName: string;
  address: Address;
  balance: PaymentSourceBalance;
  decimals: number;
  signerStatus: "ready" | "lazy" | "unavailable";
  provider: Eip1193Provider | null;
  chainId: number | null;
  correctChain: boolean;
  execution: "evm";
};

export type PaymentSource = PolkadotPaymentSource | EvmPaymentSource;

export type WalletSession = {
  id: string;
  status: "disconnected" | "connecting" | "connected";
  walletName: string | null;
  paymentSources: PaymentSource[];
  selectedPaymentSourceId: string | null;
};

export type EvmGenesisWallet = {
  kind: "evm";
  address: Address;
  provider: import("./eip1193").Eip1193Provider;
};

export type SubstrateGenesisWallet = {
  kind: "substrate";
  address: string;
  contractAddress: Address;
  signer: PolkadotSigner;
  extensionName: string;
  mapped: boolean;
  mappingState: MappingState;
};

export type GenesisWallet = EvmGenesisWallet | SubstrateGenesisWallet;

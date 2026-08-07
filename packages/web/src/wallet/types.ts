import type { Address } from "viem";
import type { PolkadotSigner } from "polkadot-api/pjs-signer";

export type MappingState = "checking" | "unmapped" | "mapping" | "mapped" | "failed";

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

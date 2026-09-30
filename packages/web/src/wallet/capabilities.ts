import type { DeploymentManifest } from "../config/manifest";

export type GenesisWalletCapabilities = {
  evmWalletConnect: true;
  evmPurchase: true;
  polkadotWalletConnect: boolean;
  nativePolkadotTransactions: boolean;
};

export function genesisWalletCapabilities(manifest: DeploymentManifest | null): GenesisWalletCapabilities {
  const isStagingTestNet = manifest?.environment === "staging" && manifest.source.chainId === "420420417";
  const nativePolkadotTransactions = !isStagingTestNet;
  return {
    evmWalletConnect: true,
    evmPurchase: true,
    polkadotWalletConnect: nativePolkadotTransactions,
    nativePolkadotTransactions,
  };
}

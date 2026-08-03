import { createWalletClient, custom, type WalletClient, type Address } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { genesisChain } from "../config/chain";
import type { Eip1193Provider } from "./provider";

export function walletClient(provider: Eip1193Provider, manifest: DeploymentManifest): WalletClient {
  return createWalletClient({ chain: genesisChain(manifest), transport: custom(provider) });
}
export async function signTypedClaim(client: WalletClient, account: Address, typedData: Record<string, unknown>): Promise<`0x${string}`> {
  const data = typedData as any;
  return client.signTypedData({ account, domain: data.domain, types: data.types, primaryType: data.primaryType, message: data.message });
}

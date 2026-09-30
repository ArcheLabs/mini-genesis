import type { Address } from "viem";
import type { MappingState } from "../types";
import { sameSubstrateAccount } from "./account";
import type { DeploymentManifest } from "../../config/manifest";
import { getSubstrateClient } from "./client";
import { NativeTransactionError, submitNativeTransaction } from "./native-transaction";
import type { InjectedPolkadotAccount } from "polkadot-api/pjs-signer";

export async function checkAccountMapping(api: any, contractAddress: Address, account: string): Promise<MappingState> {
  try {
    const original = await api.query.Revive.OriginalAccount.getValue(contractAddress);
    if (!original) return "unmapped";
    if (sameSubstrateAccount(original, account)) return "mapped";
    return "conflict";
  } catch {
    return "failed";
  }
}

export async function mapAccount(api: any, txCreator: InjectedPolkadotAccount["txCreator"], account: string, manifest: DeploymentManifest, onUpdate: (state: MappingState) => void = () => {}): Promise<void> {
  onUpdate("mapping");
  try {
    await submitNativeTransaction({ client: getSubstrateClient(manifest), manifest, tx: api.tx.Revive.map_account(), txCreator });
    onUpdate("mapped");
  } catch (error) {
    onUpdate("failed");
    if (error instanceof NativeTransactionError) throw error;
    throw new Error(error instanceof Error ? error.message : "ACCOUNT_MAPPING_FAILED", { cause: error });
  }
}

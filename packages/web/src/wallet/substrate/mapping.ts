import type { Address } from "viem";
import type { MappingState } from "../types";
import { sameSubstrateAccount } from "./account";

export async function checkAccountMapping(api: any, contractAddress: Address, account: string): Promise<MappingState> {
  try {
    const original = await api.query.Revive.OriginalAccount.getValue(contractAddress);
    return original && sameSubstrateAccount(original, account) ? "mapped" : "unmapped";
  } catch {
    return "failed";
  }
}

export async function mapAccount(api: any, signer: any, account: string, onUpdate: (state: MappingState) => void = () => {}): Promise<void> {
  onUpdate("mapping");
  try {
    const result = await api.tx.Revive.map_account().signAndSubmit(signer);
    if (!result.ok) throw new Error("ACCOUNT_MAPPING_FAILED");
    onUpdate("mapped");
  } catch (error) {
    if (String(error).toLowerCase().includes("reject")) throw new Error("USER_REJECTED_MAPPING");
    onUpdate("failed");
    throw error instanceof Error ? error : new Error("ACCOUNT_MAPPING_FAILED");
  }
}

import type { Address } from "viem";
import type { MappingState } from "../types";
import { sameSubstrateAccount } from "./account";

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

export async function mapAccount(api: any, signer: any, account: string, onUpdate: (state: MappingState) => void = () => {}): Promise<void> {
  onUpdate("mapping");
  try {
    const result = await api.tx.Revive.map_account().signAndSubmit(signer);
    if (!result.ok) throw new Error("ACCOUNT_MAPPING_FAILED");
    onUpdate("mapped");
  } catch (error) {
    const description = error instanceof Error ? error.message : String(error);
    if (import.meta.env.DEV && /signed.?extension|authorize.?value|pjs.?signer/i.test(description)) {
      console.error("[MINI Genesis] LEGACY_PJS_SIGNER_PATH_USED", error);
      throw new Error("LEGACY_PJS_SIGNER_PATH_USED");
    }
    if (description.toLowerCase().includes("reject")) throw new Error("USER_REJECTED_MAPPING");
    onUpdate("failed");
    throw error instanceof Error ? error : new Error("ACCOUNT_MAPPING_FAILED");
  }
}

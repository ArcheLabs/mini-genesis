import { describe, expect, it, vi } from "vitest";
import { hexToBytes, type Address } from "viem";
import { createSubstrateExecutionAdapter } from "../src/genesis/execution/substrate";
import { ACCOUNT, contributedLog, manifest, SOURCE_CONTRACT } from "./helpers";

const NATIVE_ACCOUNT = "111111111111111111111111111111111HC1";
const H160 = "0x88386fc84ba6bc95484008f6362f93160ef3e563" as Address;

function nativeApi() {
  const log = contributedLog(H160, 1n * 10n ** 18n);
  const call = vi.fn().mockResolvedValue({ weight_required: { ref_time: 100n, proof_size: 10n }, storage_deposit: { type: "Refund", value: 0n }, result: { success: true } });
  const tx = {
    getEstimatedFees: vi.fn().mockResolvedValue(2n),
    signAndSubmit: vi.fn().mockResolvedValue({ txHash: `0x${"ab".repeat(32)}`, block: { number: 9 }, ok: true, events: [{ type: "ContractEmitted", value: { contract: SOURCE_CONTRACT, data: hexToBytes(log.data), topics: log.topics } }] }),
  };
  const api = {
    apis: { ReviveApi: { call } },
    query: { System: { Account: { getValue: vi.fn().mockResolvedValue({ data: { free: 20_000_000_000n, frozen: 0n } }) } }, Revive: { OriginalAccount: { getValue: vi.fn().mockResolvedValue(NATIVE_ACCOUNT) } } },
    tx: { Revive: { call: vi.fn().mockReturnValue(tx), map_account: vi.fn() } },
  };
  return { api, tx, call };
}

describe("native contribution adapter", () => {
  it("uses planck for Revive.call and validates the emitted Solidity event", async () => {
    const { api, tx } = nativeApi();
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest({ source: { ...manifest().source, contract: SOURCE_CONTRACT } }));
    const result = await adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT });
    expect(api.tx.Revive.call).toHaveBeenCalledWith(expect.objectContaining({ value: 10_000_000_000n }));
    expect(api.tx.Revive.call.mock.calls[0][0].value).not.toBe(10n ** 18n);
    expect(tx.signAndSubmit).toHaveBeenCalled();
    expect(result.amount.evmWei).toBe(10n ** 18n);
    expect(result.execution).toBe("substrate");
  });
  it("does not sign when the dry-run reverts", async () => {
    const { api, tx, call } = nativeApi();
    call.mockResolvedValueOnce({ weight_required: { ref_time: 100n, proof_size: 10n }, storage_deposit: { type: "Refund", value: 0n }, result: { success: false, error: { type: "ContractReverted" } } });
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await expect(adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT })).rejects.toThrow("REVIVE_CONTRACT_REVERTED");
    expect(tx.signAndSubmit).not.toHaveBeenCalled();
  });
  it("maps an unmapped account before submitting the contribution", async () => {
    const { api, tx } = nativeApi();
    api.query.Revive.OriginalAccount.getValue.mockResolvedValueOnce(null).mockResolvedValueOnce(NATIVE_ACCOUNT);
    const mapSubmit = vi.fn().mockResolvedValue({ ok: true });
    api.tx.Revive.map_account.mockReturnValue({ signAndSubmit: mapSubmit });
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT });
    expect(mapSubmit).toHaveBeenCalled();
    expect(tx.signAndSubmit).toHaveBeenCalled();
  });
});

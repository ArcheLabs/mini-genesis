import { describe, expect, it, vi } from "vitest";
import { hexToBytes, type Address } from "viem";
import { createSubstrateExecutionAdapter, estimateNativeMax, validateNativeEvents } from "../src/genesis/execution/substrate";
import { parseDotAmount } from "../src/genesis/amount";
import { readNativeBalance } from "../src/wallet/substrate/balance";
import { ACCOUNT, contributedLog, manifest, SOURCE_CONTRACT } from "./helpers";

const NATIVE_ACCOUNT = "111111111111111111111111111111111HC1";
const H160 = "0x88386fc84ba6bc95484008f6362f93160ef3e563" as Address;

function nativeApi() {
  const log = contributedLog(H160, 1n * 10n ** 18n);
  const call = vi.fn().mockResolvedValue({ weight_required: { ref_time: 100n, proof_size: 10n }, weight_consumed: { ref_time: 80n, proof_size: 8n }, storage_deposit: { type: "Charge", value: 1n }, max_storage_deposit: { type: "Charge", value: 5n }, result: { success: true } });
  const tx = {
    getEstimatedFees: vi.fn().mockResolvedValue(2n),
    signAndSubmit: vi.fn().mockResolvedValue({ txHash: `0x${"ab".repeat(32)}`, block: { number: 9, index: 4 }, ok: true, events: [{ type: "ContractEmitted", value: { contract: SOURCE_CONTRACT, data: hexToBytes(log.data), topics: log.topics } }] }),
  };
  const api = {
    apis: { ReviveApi: { call, address: vi.fn().mockResolvedValue(H160) } },
    query: { System: { Account: { getValue: vi.fn().mockResolvedValue({ data: { free: 20_000_000_000n, frozen: 0n } }) } }, Revive: { OriginalAccount: { getValue: vi.fn().mockResolvedValue(NATIVE_ACCOUNT) } } },
    tx: { Revive: { call: vi.fn().mockReturnValue(tx), map_account: vi.fn() } },
  };
  return { api, tx, call };
}

describe("native contribution adapter", () => {
  it("keeps the UI free balance separate from spendable balance", async () => {
    const api = { query: { System: { Account: { getValue: vi.fn().mockResolvedValue({ data: { free: 20n, frozen: 7n } }) } } }, constants: { Balances: { ExistentialDeposit: vi.fn().mockResolvedValue(3n) } } };
    await expect(readNativeBalance(api, NATIVE_ACCOUNT)).resolves.toEqual({ free: 20n, frozen: 7n, existentialDeposit: 3n, spendable: 13n });
  });
  it("uses planck for Revive.call and validates the emitted Solidity event", async () => {
    const { api, tx } = nativeApi();
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest({ source: { ...manifest().source, contract: SOURCE_CONTRACT } }));
    const result = await adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT });
    expect(api.tx.Revive.call).toHaveBeenCalledWith(expect.objectContaining({ value: 10_000_000_000n, weight_limit: { ref_time: 100n, proof_size: 10n }, storage_deposit_limit: 5n }));
    expect(api.tx.Revive.call.mock.calls[0][0].value).not.toBe(10n ** 18n);
    expect(tx.signAndSubmit).toHaveBeenCalled();
    expect(result.amount.evmWei).toBe(10n ** 18n);
    expect(result.execution).toBe("substrate");
  });
  it("does not sign when the dry-run reverts", async () => {
    const { api, tx, call } = nativeApi();
    call.mockResolvedValueOnce({ weight_required: { ref_time: 100n, proof_size: 10n }, weight_consumed: { ref_time: 80n, proof_size: 8n }, storage_deposit: { type: "Refund", value: 0n }, max_storage_deposit: { type: "Refund", value: 0n }, result: { success: false, error: { type: "ContractReverted" } } });
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await expect(adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT })).rejects.toThrow("REVIVE_CONTRACT_REVERTED");
    expect(tx.signAndSubmit).not.toHaveBeenCalled();
  });
  it("does not sign when the runtime dry-run dispatch fails", async () => {
    const { api, tx, call } = nativeApi();
    call.mockRejectedValueOnce(new Error("dispatch error"));
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await expect(adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT })).rejects.toThrow("REVIVE_DRY_RUN_FAILED");
    expect(tx.signAndSubmit).not.toHaveBeenCalled();
  });
  it("does not require map_account when runtime AutoMap handles the contribution", async () => {
    const { api, tx } = nativeApi();
    api.query.Revive.OriginalAccount.getValue.mockResolvedValue(null);
    const mapSubmit = vi.fn().mockResolvedValue({ ok: true });
    api.tx.Revive.map_account.mockReturnValue({ signAndSubmit: mapSubmit });
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT });
    expect(mapSubmit).not.toHaveBeenCalled();
    expect(tx.signAndSubmit).toHaveBeenCalled();
  });
  it("does not block a contribution on a stale mapping query", async () => {
    const { api, tx } = nativeApi();
    api.query.Revive.OriginalAccount.getValue.mockResolvedValue("1mkmXsb3yPEMYPTnfvCnTJXMTxEsh5sRfD21tgmryszueHv");
    const adapter = createSubstrateExecutionAdapter(api, {}, NATIVE_ACCOUNT, manifest());
    await adapter.contribute("1", { manifest: manifest(), phase: 0, firstMinimum: 10n ** 18n, subsequentExclusive: 9_999_999_999_999_999n, contractAddress: SOURCE_CONTRACT });
    expect(tx.signAndSubmit).toHaveBeenCalled();
  });
  it("does not accept a matching event from another extrinsic", () => {
    const amount = parseDotAmount("1");
    const log = contributedLog(H160, amount.evmWei);
    expect(() => validateNativeEvents([{ type: "ContractEmitted", value: { contract: SOURCE_CONTRACT, data: hexToBytes(log.data), topics: log.topics }, phase: { type: "ApplyExtrinsic", value: 3 } }], SOURCE_CONTRACT, H160, amount, 4)).toThrow("CONTRIBUTED_EVENT_MISMATCH");
  });
  it("calculates native max without a blocking mapping lookup", async () => {
    const { api } = nativeApi();
    const value = await estimateNativeMax(api, NATIVE_ACCOUNT, manifest(), 0, 10n ** 18n, 9_999_999_999_999_999n);
    expect(value).toBe((20_000_000_000n - 7n) * 100_000_000n);
    api.query.Revive.OriginalAccount.getValue.mockResolvedValue(null);
    await expect(estimateNativeMax(api, NATIVE_ACCOUNT, manifest(), 0, 10n ** 18n, 9_999_999_999_999_999n)).resolves.toBe((20_000_000_000n - 7n) * 100_000_000n);
    api.query.Revive.OriginalAccount.getValue.mockResolvedValue(NATIVE_ACCOUNT);
    api.tx.Revive.call.mockReturnValueOnce({ getEstimatedFees: vi.fn().mockRejectedValue(new Error("fee unavailable")) });
    await expect(estimateNativeMax(api, NATIVE_ACCOUNT, manifest(), 0, 10n ** 18n, 9_999_999_999_999_999n)).resolves.toBeNull();
  });
});

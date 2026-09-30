import { describe, expect, it, vi } from "vitest";
import { bytesToHex, encodeAbiParameters, encodeEventTopics, hexToBytes, type Address } from "viem";
import { createNativeDiagnostic, inspectWeightShape, recordSimulationDiagnostic, validateNativeEvents, validateWeightRequired } from "../src/genesis/execution/substrate";
import { parseDotAmount } from "../src/genesis/amount";
import { readNativeBalance } from "../src/wallet/substrate/balance";
import { contributedLog, SOURCE_CONTRACT } from "./helpers";
import { curveAbi } from "../src/genesis/curve-abi.generated";
import { reconcileNativePurchasedLog, validateNativePurchasedEvent } from "../src/genesis/curve-contribution-native";

const NATIVE_ACCOUNT = "111111111111111111111111111111111HC1";
const H160 = "0x88386fc84ba6bc95484008f6362f93160ef3e563" as Address;

describe("native Revive dry-run and events", () => {
  it("accepts the descriptor's snake_case bigint weight", () => {
    expect(validateWeightRequired({ ref_time: 100n, proof_size: 20n })).toEqual({ ref_time: 100n, proof_size: 20n });
  });

  it("records explicit reasons for invalid weights", () => {
    const diagnostic = createNativeDiagnostic(NATIVE_ACCOUNT);
    expect(() => validateWeightRequired(undefined, diagnostic)).toThrow("REVIVE_WEIGHT_LIMIT");
    expect(diagnostic.weightLimitFailureReason).toBe("WEIGHT_REQUIRED_MISSING");
    expect(inspectWeightShape({ refTime: 100n, proofSize: 20n })).toMatchObject({ ref_time: null, proof_size: null });
  });

  it("records the dry-run resource envelope before validation", () => {
    const diagnostic = createNativeDiagnostic(NATIVE_ACCOUNT);
    const simulation = {
      weight_consumed: { ref_time: 80n, proof_size: 8n }, weight_required: { ref_time: 100n, proof_size: 10n },
      storage_deposit: { type: "Charge", value: 1n }, max_storage_deposit: { type: "Charge", value: 5n }, gas_consumed: 77n,
      result: { success: true, value: { flags: 0, data: new Uint8Array() } },
    };
    recordSimulationDiagnostic(diagnostic, simulation);
    expect(diagnostic.dryRunEnvelope).toBe(simulation);
    expect(diagnostic.dryRunWeightRequiredShape).toMatchObject({ ref_time: "100", proof_size: "10" });
    expect(diagnostic.dryRunMaxStorageDeposit).toBe(simulation.max_storage_deposit);
  });

  it("keeps free balance separate from spendable balance", async () => {
    const api = {
      query: { System: { Account: { getValue: vi.fn().mockResolvedValue({ data: { free: 20n, frozen: 7n } }) } } },
      constants: { Balances: { ExistentialDeposit: vi.fn().mockResolvedValue(3n) } },
    };
    await expect(readNativeBalance(api, NATIVE_ACCOUNT)).resolves.toEqual({ free: 20n, frozen: 7n, existentialDeposit: 3n, spendable: 13n });
  });

  it("validates only a matching PAPI ContractEmitted event in the finalized extrinsic", () => {
    const amount = parseDotAmount("1");
    const log = contributedLog(H160, amount.evmWei);
    const event = {
      type: "Revive",
      value: { type: "ContractEmitted", value: { contract: SOURCE_CONTRACT, data: hexToBytes(log.data), topics: log.topics } },
      phase: { type: "ApplyExtrinsic", value: 4 },
    };
    expect(() => validateNativeEvents([event], SOURCE_CONTRACT, H160, amount, 4)).not.toThrow();
    expect(() => validateNativeEvents([event], SOURCE_CONTRACT, H160, amount, 5)).toThrow("CONTRIBUTED_EVENT_MISMATCH");
    expect(bytesToHex(hexToBytes(log.data))).toBe(log.data);
  });

  it("fails closed when finalized runtime events report an extrinsic failure", () => {
    const amount = parseDotAmount("1");
    expect(() => validateNativeEvents([{ type: "System", value: { type: "ExtrinsicFailed", value: {} } }], SOURCE_CONTRACT, H160, amount)).toThrow("REVIVE_CONTRACT_REVERTED");
  });

  it("requires a matching Substrate Purchased event and EVM log before native success", async () => {
    const miniAmount = 2n * 10n ** 18n;
    const dotCost = 3n * 10n ** 18n;
    const topics = encodeEventTopics({ abi: curveAbi, eventName: "Purchased", args: { buyer: H160 } });
    const data = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
      [miniAmount, dotCost, miniAmount, dotCost, 4n * 10n ** 15n],
    );
    const substrateEvent = {
      type: "Revive",
      value: { type: "ContractEmitted", value: { contract: SOURCE_CONTRACT, data: hexToBytes(data), topics } },
    };
    const purchase = validateNativePurchasedEvent([substrateEvent], SOURCE_CONTRACT, H160, miniAmount, 4n * 10n ** 18n);
    const finalizedBlockNumber = 123n;
    const publicClient = { getLogs: vi.fn().mockResolvedValue([{ blockNumber: finalizedBlockNumber, args: purchase }]) };

    await expect(reconcileNativePurchasedLog(publicClient as any, SOURCE_CONTRACT, purchase, finalizedBlockNumber)).resolves.toBeUndefined();
    const request = publicClient.getLogs.mock.calls[0]?.[0];
    expect(request).toMatchObject({ fromBlock: finalizedBlockNumber, toBlock: finalizedBlockNumber });
    expect(request.args.buyer.toLowerCase()).toBe(H160.toLowerCase());
  });

  it("fails closed when the EVM Purchased log differs from the finalized Substrate event", async () => {
    const publicClient = { getLogs: vi.fn().mockResolvedValue([{ blockNumber: 123n, args: { buyer: H160, miniAmount: 2n, dotCost: 4n } }]) };
    await expect(reconcileNativePurchasedLog(
      publicClient as any,
      SOURCE_CONTRACT,
      { buyer: H160, miniAmount: 2n, dotCost: 3n },
      123n,
    )).rejects.toMatchObject({ code: "NATIVE_EVENT_RECONCILIATION_FAILED" });
  });
});

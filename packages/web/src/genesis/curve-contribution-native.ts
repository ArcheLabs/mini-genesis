import { bytesToHex, decodeEventLog, encodeFunctionData, hexToBytes, type Address } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { checkAccountMapping, mapAccount } from "../wallet/substrate/mapping";
import { resolveContractAddress } from "../wallet/substrate/account";
import { readNativeBalance } from "../wallet/substrate/balance";
import { NativeTransactionError, submitNativeReviveCall } from "../wallet/substrate/injected-transaction";
import { validateWeightRequired } from "./execution/substrate";
import { curveAbi } from "./curve-abi.generated";
import { NATIVE_TO_EVM_RATIO } from "./amount";

type Simulation = { weight_required?: unknown; max_storage_deposit?: unknown; result?: { success?: boolean; value?: unknown; error?: unknown } };
type CurveNativeUpdate = { state: "checking_mapping" | "mapping_required" | "mapping_submitted" | "mapping_finalized" | "verifying_mapping" | "simulating" | "awaiting_signature" | "submitted" | "included" | "finalized" | "verifying_event" | "success" | "failed"; hash?: `0x${string}`; error?: string };

function errorDescription(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function ceilPlanck(value: bigint): bigint { return (value + NATIVE_TO_EVM_RATIO - 1n) / NATIVE_TO_EVM_RATIO; }
function storageChargeOrZero(value: unknown): bigint {
  if (!value || typeof value !== "object") return 0n;
  const deposit = value as { type?: unknown; value?: unknown };
  return deposit.type === "Charge" && (typeof deposit.value === "string" || typeof deposit.value === "number" || typeof deposit.value === "bigint") ? BigInt(deposit.value) : 0n;
}

async function simulateNativeCurve(api: any, account: string, contract: Address, value: bigint, data: `0x${string}`): Promise<{ refTime: bigint; proofSize: bigint; storageDepositLimit: bigint }> {
  let simulation: Simulation;
  try {
    simulation = await api.apis.ReviveApi.call(account, contract, value, undefined, undefined, hexToBytes(data));
  } catch (error) {
    if (/account.?unmapped|unmapped.?account|original.?account/i.test(errorDescription(error))) throw new Error("ACCOUNT_UNMAPPED");
    throw new Error("REVIVE_DRY_RUN_FAILED");
  }
  if (!simulation?.result || simulation.result.success !== true) throw new Error("REVIVE_CONTRACT_REVERTED");
  const resultValue = simulation.result.value as { flags?: unknown; type?: unknown } | undefined;
  if ((typeof resultValue?.flags === "number" && (resultValue.flags & 1) !== 0) || /revert/i.test(String(resultValue?.type ?? ""))) throw new Error("REVIVE_CONTRACT_REVERTED");
  const weight = validateWeightRequired(simulation.weight_required);
  return { refTime: weight.ref_time, proofSize: weight.proof_size, storageDepositLimit: storageChargeOrZero(simulation.max_storage_deposit) };
}

function validatePurchasedEvent(events: any[], contract: Address, buyer: Address, miniAmount: bigint): void {
  let matches = 0;
  for (const event of events) {
    const record = event?.event ?? event;
    const type = String(record?.type ?? "");
    if (/ExtrinsicFailed$/i.test(type)) throw new Error("REVIVE_CONTRACT_REVERTED");
    if (type !== "ContractEmitted" && type !== "Revive.ContractEmitted") continue;
    const raw = record?.data?.toJSON ? record.data.toJSON() : record?.data;
    const value = Array.isArray(raw) ? { contract: raw[0], data: raw[1], topics: raw[2] } : raw;
    if (!value || String(value.contract).toLowerCase() !== contract.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: curveAbi, data: typeof value.data === "string" ? value.data : bytesToHex(value.data), topics: (value.topics ?? []).map((topic: unknown) => typeof topic === "string" ? topic : bytesToHex(topic as Uint8Array)) as [`0x${string}`, ...`0x${string}`[]] });
      if (decoded.eventName === "Purchased" && String((decoded.args as any).buyer).toLowerCase() === buyer.toLowerCase() && (decoded.args as any).miniAmount === miniAmount) ++matches;
    } catch { /* Ignore unrelated runtime events. */ }
  }
  if (matches !== 1) throw new Error("PURCHASED_EVENT_MISMATCH");
}

export async function buyExactMiniNative(
  api: any,
  signer: any,
  account: string,
  manifest: DeploymentManifest,
  contract: Address,
  miniAmount: bigint,
  maxDotCost: bigint,
  onUpdate: (update: CurveNativeUpdate) => void = () => {},
): Promise<{ hash: `0x${string}`; blockNumber: bigint; miniAmount: bigint }> {
  try {
    const data = encodeFunctionData({ abi: curveAbi, functionName: "buyExactMini", args: [miniAmount, maxDotCost] });
    const value = ceilPlanck(maxDotCost);
    const accountResolution = await resolveContractAddress(api, account);
    let balance = await readNativeBalance(api, account);
    if (balance.spendable < value) throw new Error("NATIVE_INSUFFICIENT_BALANCE");
    onUpdate({ state: "simulating" });
    let limits;
    try {
      limits = await simulateNativeCurve(api, account, contract, value, data);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ACCOUNT_UNMAPPED") throw error;
      onUpdate({ state: "checking_mapping" });
      const mapping = await checkAccountMapping(api, accountResolution.h160, account);
      if (mapping === "conflict") throw new Error("ACCOUNT_MAPPING_CONFLICT");
      if (mapping === "failed") throw new Error("ACCOUNT_MAPPING_FAILED");
      if (mapping === "unmapped") {
        onUpdate({ state: "mapping_required" });
        await mapAccount(api, signer, account, (state) => onUpdate({ state: state === "mapping" ? "mapping_submitted" : "mapping_finalized" }));
        onUpdate({ state: "mapping_finalized" });
        onUpdate({ state: "verifying_mapping" });
      }
      limits = await simulateNativeCurve(api, account, contract, value, data);
      balance = await readNativeBalance(api, account);
    }
    let tx = api.tx.Revive.call({ dest: contract, value, weight_limit: { ref_time: limits.refTime, proof_size: limits.proofSize }, storage_deposit_limit: limits.storageDepositLimit, data: hexToBytes(data) });
    const fee = BigInt(await tx.getEstimatedFees(account));
    if (balance.spendable < value + fee + limits.storageDepositLimit) throw new Error("NATIVE_INSUFFICIENT_BALANCE");
    onUpdate({ state: "awaiting_signature" });
    const finalized = await submitNativeReviveCall({
      manifest, address: account, contractAddress: contract, value,
      weightLimit: { refTime: limits.refTime, proofSize: limits.proofSize },
      storageDepositLimit: limits.storageDepositLimit, data,
      onStatus: (status) => { if (status === "broadcast") onUpdate({ state: "submitted" }); if (status === "inBlock") onUpdate({ state: "included" }); if (status === "finalized") onUpdate({ state: "finalized" }); },
    });
    onUpdate({ state: "verifying_event" });
    validatePurchasedEvent(finalized.events, contract, accountResolution.h160, miniAmount);
    onUpdate({ state: "success", hash: finalized.txHash });
    return { hash: finalized.txHash, blockNumber: finalized.blockNumber, miniAmount };
  } catch (error) {
    const code = error instanceof NativeTransactionError ? error.code : errorDescription(error);
    onUpdate({ state: "failed", error: code });
    throw new Error(code);
  }
}

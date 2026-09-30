import { bytesToHex, decodeEventLog, encodeFunctionData, hexToBytes, parseAbiItem, type Address, type PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { checkAccountMapping, mapAccount } from "../wallet/substrate/mapping";
import { resolveContractAddress } from "../wallet/substrate/account";
import { readNativeBalance } from "../wallet/substrate/balance";
import { assertNativeRuntimeSupported, NativeTransactionError, probeNativeWalletCapability, submitNativeTransaction } from "../wallet/substrate/native-transaction";
import { getSubstrateClient } from "../wallet/substrate/client";
import { getNativeRuntimeProfile } from "../wallet/substrate/runtime-profile";
import type { InjectedPolkadotAccount } from "polkadot-api/pjs-signer";
import { validateWeightRequired } from "./execution/substrate";
import { curveAbi } from "./curve-abi.generated";
import { NATIVE_TO_EVM_RATIO } from "./amount";

type Simulation = { weight_required?: unknown; max_storage_deposit?: unknown; result?: { success?: boolean; value?: unknown; error?: unknown } };
type CurveNativeUpdate = { state: "checking_mapping" | "mapping_required" | "mapping_submitted" | "mapping_finalized" | "verifying_mapping" | "simulating" | "awaiting_signature" | "submitted" | "included" | "finalized" | "verifying_event" | "success" | "failed"; substrateTxHash?: `0x${string}`; error?: string };
export type NativePurchaseResult = {
  substrateTxHash: `0x${string}`;
  finalizedBlockHash: `0x${string}`;
  finalizedBlockNumber: bigint;
  extrinsicIndex?: number;
  miniAmount: bigint;
};
const purchasedEvent = parseAbiItem("event Purchased(address indexed buyer, uint256 miniAmount, uint256 dotCost, uint256 totalSoldMini, uint256 totalRaisedDot, uint256 spotPriceAfter)");

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

export function validateNativePurchasedEvent(events: any[], contract: Address, buyer: Address, miniAmount: bigint, maxDotCost: bigint): { buyer: Address; miniAmount: bigint; dotCost: bigint } {
  const matches: Array<{ buyer: Address; miniAmount: bigint; dotCost: bigint }> = [];
  for (const event of events) {
    const eventType = String(event?.type ?? event?.event?.type ?? "");
    const nested = event?.value ?? event?.event?.value;
    const method = nested && typeof nested === "object" ? String(nested.type ?? "") : "";
    const type = method ? `${eventType}.${method}` : eventType;
    if (/ExtrinsicFailed$/i.test(type)) throw new NativeTransactionError("NATIVE_CONTRACT_REVERTED", "The finalized extrinsic failed.");
    if (type !== "Revive.ContractEmitted" && type !== "ContractEmitted") continue;
    const raw = method ? nested.value : nested;
    const value = Array.isArray(raw) ? { contract: raw[0], data: raw[1], topics: raw[2] } : raw;
    if (!value || String(value.contract).toLowerCase() !== contract.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: curveAbi, data: typeof value.data === "string" ? value.data : bytesToHex(value.data), topics: (value.topics ?? []).map((topic: unknown) => typeof topic === "string" ? topic : bytesToHex(topic as Uint8Array)) as [`0x${string}`, ...`0x${string}`[]] });
      const args = decoded.args as any;
      if (decoded.eventName === "Purchased" && String(args.buyer).toLowerCase() === buyer.toLowerCase() && args.miniAmount === miniAmount && args.dotCost <= maxDotCost) {
        matches.push({ buyer: args.buyer as Address, miniAmount: args.miniAmount, dotCost: args.dotCost });
      }
    } catch { /* Ignore unrelated runtime events. */ }
  }
  if (matches.length !== 1) throw new NativeTransactionError("NATIVE_EVENT_RECONCILIATION_FAILED", "PURCHASED_EVENT_MISMATCH");
  return matches[0]!;
}

export async function reconcileNativePurchasedLog(
  publicClient: PublicClient,
  contract: Address,
  purchase: { buyer: Address; miniAmount: bigint; dotCost: bigint },
  finalizedBlockNumber: bigint,
): Promise<void> {
  try {
    const logs = await publicClient.getLogs({
      address: contract,
      event: purchasedEvent,
      args: { buyer: purchase.buyer },
      fromBlock: finalizedBlockNumber,
      toBlock: finalizedBlockNumber,
    });
    const matches = logs.filter((log) => log.blockNumber === finalizedBlockNumber
      && log.args.buyer?.toLowerCase() === purchase.buyer.toLowerCase()
      && log.args.miniAmount === purchase.miniAmount
      && log.args.dotCost === purchase.dotCost);
    if (matches.length !== 1) throw new Error("PURCHASED_EVM_LOG_MISMATCH");
  } catch (error) {
    throw new NativeTransactionError("NATIVE_EVENT_RECONCILIATION_FAILED", errorDescription(error), error);
  }
}

export async function buyExactMiniNative(
  api: any,
  publicClient: PublicClient,
  txCreator: InjectedPolkadotAccount["txCreator"],
  account: string,
  manifest: DeploymentManifest,
  contract: Address,
  miniAmount: bigint,
  maxDotCost: bigint,
  onUpdate: (update: CurveNativeUpdate) => void = () => {},
): Promise<NativePurchaseResult> {
  try {
    const data = encodeFunctionData({ abi: curveAbi, functionName: "buyExactMini", args: [miniAmount, maxDotCost] });
    const value = ceilPlanck(maxDotCost);
    const runtimeCheck = await assertNativeRuntimeSupported(getSubstrateClient(manifest), manifest);
    const profile = getNativeRuntimeProfile(manifest);
    if (!profile.enabled || runtimeCheck.profileId !== profile.id) throw new NativeTransactionError("NATIVE_RUNTIME_PROFILE_INCOMPLETE", "NATIVE_RUNTIME_PROFILE_INCOMPLETE");
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
        await mapAccount(api, txCreator, account, manifest, (state) => onUpdate({ state: state === "mapping" ? "mapping_submitted" : "mapping_finalized" }));
        onUpdate({ state: "mapping_finalized" });
        onUpdate({ state: "verifying_mapping" });
      }
      limits = await simulateNativeCurve(api, account, contract, value, data);
      balance = await readNativeBalance(api, account);
    }
    const tx = api.tx.Revive.call({ dest: contract, value, weight_limit: { ref_time: limits.refTime, proof_size: limits.proofSize }, storage_deposit_limit: limits.storageDepositLimit, data: hexToBytes(data) });
    const fee = await probeNativeWalletCapability(tx, txCreator, manifest);
    if (balance.spendable < value + fee + limits.storageDepositLimit) throw new Error("NATIVE_INSUFFICIENT_BALANCE");
    onUpdate({ state: "awaiting_signature" });
    const finalized = await submitNativeTransaction({
      client: getSubstrateClient(manifest), manifest, tx, txCreator,
      onStatus: (status) => { if (status === "broadcast") onUpdate({ state: "submitted" }); if (status === "inBestBlock") onUpdate({ state: "included" }); },
    });
    onUpdate({ state: "finalized", substrateTxHash: finalized.substrateTxHash });
    onUpdate({ state: "verifying_event" });
    const purchase = validateNativePurchasedEvent(finalized.events, contract, accountResolution.h160, miniAmount, maxDotCost);
    await reconcileNativePurchasedLog(publicClient, contract, purchase, finalized.finalizedBlockNumber);
    onUpdate({ state: "success", substrateTxHash: finalized.substrateTxHash });
    return {
      substrateTxHash: finalized.substrateTxHash,
      finalizedBlockHash: finalized.finalizedBlockHash,
      finalizedBlockNumber: finalized.finalizedBlockNumber,
      extrinsicIndex: finalized.extrinsicIndex,
      miniAmount,
    };
  } catch (error) {
    const code = error instanceof NativeTransactionError ? error.code : errorDescription(error);
    onUpdate({ state: "failed", error: code });
    throw new Error(code);
  }
}

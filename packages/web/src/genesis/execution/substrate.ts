import { bytesToHex, decodeEventLog, encodeFunctionData, hexToBytes, type Address } from "viem";
import type { DeploymentManifest } from "../../config/manifest";
import { genesisAbi } from "../abi";
import { parseDotAmount, validateContributionAmount, type ParsedDotAmount } from "../amount";
import { checkAccountMapping, mapAccount } from "../../wallet/substrate/mapping";
import { deriveContractAddress } from "../../wallet/substrate/account";
import { readNativeBalance } from "../../wallet/substrate/balance";
import type { GenesisExecutionAdapter, ContributionContext, ContributionResult, ContributionUpdate } from "./types";

type Weight = { ref_time: bigint; proof_size: bigint };
type Simulation = { weight_required: Weight; storage_deposit: unknown; result: { success?: boolean; value?: unknown; error?: unknown } };

function checkCancelled(signal?: AbortSignal): void { if (signal?.aborted) throw new Error("OPERATION_CANCELLED"); }
function padded(value: bigint): bigint { return value + value / 10n + 1n; }
function isSuccess(result: unknown): boolean { return Boolean(result && typeof result === "object" && "success" in result ? (result as { success?: boolean }).success : false); }
function storageDepositAmount(value: unknown): bigint {
  if (!value || typeof value !== "object") return 0n;
  const type = String((value as { type?: unknown }).type ?? "");
  if (/charge/i.test(type)) return BigInt((value as { value?: string | number | bigint }).value ?? 0n);
  return 0n;
}
function asHex(value: unknown): `0x${string}` { return typeof value === "string" ? value as `0x${string}` : bytesToHex(value as Uint8Array); }
function eventParts(event: any): { type: string; value: any } {
  return { type: event?.event?.type ?? event?.type ?? "", value: event?.event?.value ?? event?.value };
}

export async function simulateNativeContribution(api: any, account: string, contractAddress: Address, amount: ParsedDotAmount): Promise<{ weightLimit: Weight; storageDepositLimit: bigint }> {
  const data = encodeFunctionData({ abi: genesisAbi, functionName: "contribute" });
  let simulation: Simulation;
  try {
    simulation = await api.apis.ReviveApi.call(account, contractAddress, amount.planck, undefined, undefined, hexToBytes(data));
  } catch {
    throw new Error("REVIVE_DRY_RUN_FAILED");
  }
  if (!isSuccess(simulation.result)) throw new Error("REVIVE_CONTRACT_REVERTED");
  const required = simulation.weight_required;
  if (!required || required.ref_time <= 0n || required.proof_size < 0n) throw new Error("REVIVE_WEIGHT_LIMIT");
  return { weightLimit: { ref_time: padded(required.ref_time), proof_size: padded(required.proof_size) }, storageDepositLimit: padded(storageDepositAmount(simulation.storage_deposit)) };
}

function validateNativeEvents(events: any[], contractAddress: Address, contributorH160: Address, amount: ParsedDotAmount): void {
  if (events.some((event) => { const parts = eventParts(event); return parts.type === "ExtrinsicFailed" || parts.type === "System.ExtrinsicFailed"; })) throw new Error("REVIVE_CONTRACT_REVERTED");
  const logs = events.filter((event) => {
    const parts = eventParts(event);
    return parts.type === "ContractEmitted" || parts.type === "Revive.ContractEmitted";
  }).map((event) => eventParts(event).value).filter((value) => value && String(value.contract).toLowerCase() === contractAddress.toLowerCase());
  let matches = 0;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: genesisAbi, data: asHex(log.data), topics: (log.topics ?? []).map(asHex) as [`0x${string}`, ...`0x${string}`[]] });
      if (decoded.eventName === "Contributed" && String((decoded.args as any).contributor).toLowerCase() === contributorH160.toLowerCase() && (decoded.args as any).amount === amount.evmWei) matches += 1;
    } catch { /* unrelated runtime event */ }
  }
  if (matches !== 1) throw new Error("CONTRIBUTED_EVENT_MISMATCH");
}

export function createSubstrateExecutionAdapter(api: any, signer: any, account: string, manifest: DeploymentManifest): GenesisExecutionAdapter {
  const contractAddress = manifest.source.contract;
  const contributorH160 = deriveContractAddress(account);
  return {
    kind: "substrate",
    async getBalance() { const balance = await readNativeBalance(api, account); return { available: balance.spendable, decimals: manifest.source.nativeDecimals }; },
    async safeMax() { return null; },
    async contribute(input, context, onUpdate = () => {}, signal): Promise<ContributionResult> {
      try {
        checkCancelled(signal); onUpdate({ state: "validating" });
        const amount = validateContributionAmount(input, context.phase, context.firstMinimum, context.subsequentExclusive);
        const balance = await readNativeBalance(api, account); checkCancelled(signal);
        if (balance.spendable < amount.planck) throw new Error("NATIVE_INSUFFICIENT_BALANCE");
        onUpdate({ state: "checking_mapping" });
        const mapping = await checkAccountMapping(api, contributorH160, account);
        if (mapping === "failed") throw new Error("ACCOUNT_MAPPING_FAILED");
        if (mapping !== "mapped") {
          await mapAccount(api, signer, account, (state) => onUpdate({ state: state === "mapping" ? "awaiting_signature" : "checking_mapping" }));
          const refreshed = await checkAccountMapping(api, contributorH160, account);
          if (refreshed !== "mapped") throw new Error("ACCOUNT_MAPPING_FAILED");
        }
        onUpdate({ state: "simulating" });
        const limits = await simulateNativeContribution(api, account, contractAddress, amount); checkCancelled(signal);
        const data = encodeFunctionData({ abi: genesisAbi, functionName: "contribute" });
        const tx = api.tx.Revive.call({ dest: contractAddress, value: amount.planck, weight_limit: limits.weightLimit, storage_deposit_limit: limits.storageDepositLimit, data: hexToBytes(data) });
        const fee = await tx.getEstimatedFees(account).catch(() => 0n);
        if (balance.spendable < amount.planck + fee) throw new Error("NATIVE_INSUFFICIENT_BALANCE");
        onUpdate({ state: "awaiting_signature" });
        const finalized = await tx.signAndSubmit(signer); checkCancelled(signal);
        onUpdate({ state: "finalized", hash: finalized.txHash as `0x${string}` });
        validateNativeEvents(finalized.events, contractAddress, contributorH160, amount);
        return { execution: "substrate", blockNumber: BigInt(finalized.block.number), amount, contributorH160, substrateTxHash: finalized.txHash as `0x${string}` };
      } catch (error) {
        const code = error instanceof Error ? error.message : "REVIVE_DRY_RUN_FAILED";
        if (code !== "OPERATION_CANCELLED") onUpdate({ state: "failed", error: code });
        throw new Error(code);
      }
    },
  };
}

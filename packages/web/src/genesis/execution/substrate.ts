import { bytesToHex, decodeEventLog, encodeFunctionData, hexToBytes, type Address } from "viem";
import type { DeploymentManifest } from "../../config/manifest";
import { genesisAbi } from "../abi";
import { NATIVE_TO_EVM_RATIO, parseDotAmount, validateContributionAmount, type ParsedDotAmount } from "../amount";
import { checkAccountMapping, mapAccount } from "../../wallet/substrate/mapping";
import { accountId32FromSs58, resolveContractAddress } from "../../wallet/substrate/account";
import { readNativeBalance } from "../../wallet/substrate/balance";
import { NativeTransactionError, submitNativeReviveCall } from "../../wallet/substrate/injected-transaction";
import type { GenesisExecutionAdapter, ContributionContext, ContributionResult } from "./types";

type Weight = { ref_time: bigint; proof_size: bigint };
type Simulation = {
  weight_required: Weight;
  weight_consumed: Weight;
  storage_deposit: unknown;
  max_storage_deposit: unknown;
  result: { success?: boolean; value?: unknown; error?: unknown };
};

type NativeDiagnostic = {
  account: string;
  accountId32: string | null;
  free: bigint | null;
  frozen: bigint | null;
  existentialDeposit: bigint | null;
  spendable: bigint | null;
  dryRunResult: unknown;
  dryRunError: string | null;
  txBuildError: string | null;
  feeEstimateError: string | null;
  polkadotJsRuntimeVersion: { specVersion: string; transactionVersion: string } | null;
  signedExtensions: string[] | null;
  injectorSource: string | null;
  injectorVersion: string | null;
  chainGenesisHash: string | null;
  injectorMetadataKnown: boolean | null;
  injectorMetadataProvided: boolean | null;
  injectorMetadataError: unknown;
  signingError: unknown;
  submissionError: unknown;
  signingStarted: boolean;
  walletPopupReached: boolean;
  txStatus: string | null;
  dispatchError: unknown;
  signerPath: "injected-signPayload" | null;
  network: "paseo" | "polkadot-mainnet" | null;
  reviveCall: unknown;
  error: string | null;
};

function errorDescription(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error ?? ""); } catch { return String(error); }
}

function createNativeDiagnostic(account: string): NativeDiagnostic {
  let accountId32: string | null = null;
  try { accountId32 = bytesToHex(accountId32FromSs58(account)); } catch { /* Keep the diagnostic usable for malformed accounts. */ }
  return { account, accountId32, free: null, frozen: null, existentialDeposit: null, spendable: null, dryRunResult: null, dryRunError: null, txBuildError: null, feeEstimateError: null, polkadotJsRuntimeVersion: null, signedExtensions: null, injectorSource: null, injectorVersion: null, chainGenesisHash: null, injectorMetadataKnown: null, injectorMetadataProvided: null, injectorMetadataError: null, signingStarted: false, walletPopupReached: false, txStatus: null, dispatchError: null, signingError: null, submissionError: null, signerPath: null, network: null, reviveCall: null, error: null };
}

function emitNativeDiagnostic(manifest: DeploymentManifest, diagnostic: NativeDiagnostic): void {
  if (manifest.environment === "staging" || import.meta.env.VITE_DEPLOYMENT_ENV === "staging") console.error("[MINI Genesis][Native diagnostic]", diagnostic);
}

function recordNativeBalance(diagnostic: NativeDiagnostic, balance: Awaited<ReturnType<typeof readNativeBalance>>): void {
  diagnostic.free = balance.free;
  diagnostic.frozen = balance.frozen;
  diagnostic.existentialDeposit = balance.existentialDeposit;
  diagnostic.spendable = balance.spendable;
}

function checkCancelled(signal?: AbortSignal): void { if (signal?.aborted) throw new Error("OPERATION_CANCELLED"); }

function storageChargeOrZero(value: unknown): bigint {
  if (!value || typeof value !== "object") return 0n;
  const deposit = value as { type?: unknown; value?: unknown };
  const charge = deposit.value;
  return deposit.type === "Charge" && (typeof charge === "string" || typeof charge === "number" || typeof charge === "bigint") ? BigInt(charge) : 0n;
}

function resultFailureCode(result: Simulation["result"]): "REVIVE_DRY_RUN_FAILED" | "REVIVE_CONTRACT_REVERTED" {
  if (result?.success === true) {
    const value = result.value as { flags?: unknown; type?: unknown } | undefined;
    if (typeof value?.flags === "number" && (value.flags & 1) !== 0) return "REVIVE_CONTRACT_REVERTED";
    if (/revert/i.test(String(value?.type ?? ""))) return "REVIVE_CONTRACT_REVERTED";
    return "REVIVE_DRY_RUN_FAILED";
  }
  const value = result?.value ?? result?.error;
  let description = String(value ?? "");
  if (typeof value !== "string") { try { description = JSON.stringify(value ?? ""); } catch { /* retain string fallback */ } }
  return /revert|contract/i.test(description) ? "REVIVE_CONTRACT_REVERTED" : "REVIVE_DRY_RUN_FAILED";
}

function isAccountUnmappedError(error: unknown): boolean {
  const description = error instanceof Error ? error.message : typeof error === "string" ? error : (() => { try { return JSON.stringify(error ?? ""); } catch { return ""; } })();
  return /account.?unmapped|unmapped.?account|original.?account/i.test(description);
}

function validateSimulation(simulation: Simulation): void {
  if (!simulation || !simulation.result) throw new Error("REVIVE_DRY_RUN_FAILED");
  if (simulation.result.success !== true) {
    if (isAccountUnmappedError(simulation.result.value ?? simulation.result.error)) throw new Error("ACCOUNT_UNMAPPED");
    throw new Error(resultFailureCode(simulation.result));
  }
  const value = simulation.result.value as { flags?: unknown; type?: unknown } | undefined;
  if ((typeof value?.flags === "number" && (value.flags & 1) !== 0) || /revert/i.test(String(value?.type ?? ""))) throw new Error("REVIVE_CONTRACT_REVERTED");
}

export async function simulateNativeContribution(api: any, account: string, contractAddress: Address, amount: ParsedDotAmount, diagnostic?: NativeDiagnostic): Promise<{ weightLimit: Weight; storageDepositLimit: bigint; simulation: Simulation }> {
  const data = encodeFunctionData({ abi: genesisAbi, functionName: "contribute" });
  let simulation: Simulation;
  try {
    simulation = await api.apis.ReviveApi.call(account, contractAddress, amount.planck, undefined, undefined, hexToBytes(data));
  } catch (error) {
    if (diagnostic) diagnostic.dryRunError = errorDescription(error);
    if (isAccountUnmappedError(error)) throw new Error("ACCOUNT_UNMAPPED");
    throw new Error("REVIVE_DRY_RUN_FAILED");
  }
  if (diagnostic) diagnostic.dryRunResult = simulation.result;
  validateSimulation(simulation);
  const required = simulation.weight_required;
  if (!required || required.ref_time <= 0n || required.proof_size < 0n) throw new Error("REVIVE_WEIGHT_LIMIT");
  return { weightLimit: required, storageDepositLimit: storageChargeOrZero(simulation.max_storage_deposit), simulation };
}

function ceilPlanckFromEvmWei(value: bigint): bigint { return (value + NATIVE_TO_EVM_RATIO - 1n) / NATIVE_TO_EVM_RATIO; }

/** Return EVM-denominated input for the UI, or null when a safe native max is unavailable. */
export async function estimateNativeMax(api: any, account: string, manifest: DeploymentManifest, phase: number, firstMinimum: bigint, subsequentExclusive: bigint): Promise<bigint | null> {
  if (phase >= 2) return 0n;
  const diagnostic = createNativeDiagnostic(account);
  try {
    const resolution = await resolveContractAddress(api, account);
    const balance = await readNativeBalance(api, account);
    recordNativeBalance(diagnostic, balance);
    const probeEvmWei = phase === 0 ? firstMinimum : subsequentExclusive + 1n;
    const probe = { planck: ceilPlanckFromEvmWei(probeEvmWei), evmWei: ceilPlanckFromEvmWei(probeEvmWei) * NATIVE_TO_EVM_RATIO };
    const limits = await simulateNativeContribution(api, account, manifest.source.contract, probe, diagnostic);
    const data = encodeFunctionData({ abi: genesisAbi, functionName: "contribute" });
    let tx;
    try { tx = api.tx.Revive.call({ dest: manifest.source.contract, value: probe.planck, weight_limit: limits.weightLimit, storage_deposit_limit: limits.storageDepositLimit, data: hexToBytes(data) }); } catch (error) { diagnostic.txBuildError = errorDescription(error); throw error; }
    let fee: bigint;
    try { fee = BigInt(await tx.getEstimatedFees(account)); } catch (error) { diagnostic.feeEstimateError = errorDescription(error); throw error; }
    const reserve = fee + fee / 5n + limits.storageDepositLimit;
    if (balance.spendable <= reserve) return 0n;
    const maxPlanck = balance.spendable - reserve;
    return maxPlanck >= probe.planck ? maxPlanck * NATIVE_TO_EVM_RATIO : 0n;
  } catch (error) {
    diagnostic.error = errorDescription(error);
    // Max is probed when an account is selected. An unmapped or empty account
    // is a normal wallet state at this point, not a failed Join attempt.
    if (!/ACCOUNT_UNMAPPED|NATIVE_INSUFFICIENT_BALANCE/.test(diagnostic.error)) {
      emitNativeDiagnostic(manifest, diagnostic);
    }
    return null;
  }
}

function eventParts(event: any): { type: string; value: any; phase?: any } {
  return {
    type: event?.type ?? event?.event?.type ?? "",
    value: event?.value ?? event?.event?.value,
    phase: event?.phase ?? event?.original?.phase ?? event?.event?.phase,
  };
}

function belongsToExtrinsic(event: any, extrinsicIndex?: number): boolean {
  if (extrinsicIndex === undefined) return true;
  const phase = eventParts(event).phase;
  if (!phase) return true;
  return phase.type === "ApplyExtrinsic" && phase.value === extrinsicIndex;
}

export function validateNativeEvents(events: any[], contractAddress: Address, contributorH160: Address, amount: ParsedDotAmount, extrinsicIndex?: number): void {
  const currentEvents = events.filter((event) => belongsToExtrinsic(event, extrinsicIndex));
  if (currentEvents.some((event) => eventParts(event).type === "ExtrinsicFailed" || eventParts(event).type === "System.ExtrinsicFailed")) throw new Error("REVIVE_CONTRACT_REVERTED");
  const logs = currentEvents.filter((event) => {
    const parts = eventParts(event);
    return parts.type === "ContractEmitted" || parts.type === "Revive.ContractEmitted";
  }).map((event) => eventParts(event).value).filter((value) => value && String(value.contract).toLowerCase() === contractAddress.toLowerCase());
  let matches = 0;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: genesisAbi, data: typeof log.data === "string" ? log.data : bytesToHex(log.data), topics: (log.topics ?? []).map((topic: unknown) => typeof topic === "string" ? topic : bytesToHex(topic as Uint8Array)) as [`0x${string}`, ...`0x${string}`[]] });
      if (decoded.eventName === "Contributed" && String((decoded.args as any).contributor).toLowerCase() === contributorH160.toLowerCase() && (decoded.args as any).amount === amount.evmWei) matches += 1;
    } catch { /* unrelated runtime event */ }
  }
  if (matches !== 1) throw new Error("CONTRIBUTED_EVENT_MISMATCH");
}

function polkadotJsEventValue(event: any): { section: string; method: string; value: any } {
  const record = event?.event ?? event;
  const section = String(record?.section ?? "");
  const method = String(record?.method ?? "");
  const raw = record?.data?.toJSON ? record.data.toJSON() : record?.data;
  if ((section.toLowerCase() === "revive" || section.toLowerCase() === "palletrevive") && method === "ContractEmitted") {
    if (Array.isArray(raw)) return { section, method, value: { contract: raw[0], data: raw[1], topics: raw[2] } };
    return { section, method, value: raw };
  }
  return { section, method, value: raw };
}

export function validatePolkadotJsNativeEvents(events: any[], contractAddress: Address, contributorH160: Address, amount: ParsedDotAmount): void {
  const currentEvents = events.map(polkadotJsEventValue);
  if (currentEvents.some(({ section, method }) => section.toLowerCase() === "system" && method === "ExtrinsicFailed")) throw new Error("NATIVE_SUBMISSION_FAILED");
  if (!currentEvents.some(({ section, method }) => section.toLowerCase() === "system" && method === "ExtrinsicSuccess")) throw new Error("NATIVE_SUBMISSION_FAILED");
  const logs = currentEvents.filter(({ section, method, value }) => (section.toLowerCase() === "revive" || section.toLowerCase() === "palletrevive") && method === "ContractEmitted" && value && String(value.contract).toLowerCase() === contractAddress.toLowerCase()).map(({ value }) => value);
  let matches = 0;
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: genesisAbi, data: typeof log.data === "string" ? log.data : bytesToHex(log.data), topics: (log.topics ?? []).map((topic: unknown) => typeof topic === "string" ? topic : bytesToHex(topic as Uint8Array)) as [`0x${string}`, ...`0x${string}`[]] });
      if (decoded.eventName === "Contributed" && String((decoded.args as any).contributor).toLowerCase() === contributorH160.toLowerCase() && (decoded.args as any).amount === amount.evmWei) matches += 1;
    } catch { /* Ignore unrelated contract events. */ }
  }
  if (matches !== 1) throw new Error("CONTRIBUTED_EVENT_MISMATCH");
}

export function createSubstrateExecutionAdapter(api: any, signer: any, account: string, manifest: DeploymentManifest, canonicalContractAddress?: Address): GenesisExecutionAdapter {
  const contractAddress = manifest.source.contract;
  return {
    kind: "substrate",
    async getBalance() { const balance = await readNativeBalance(api, account); return { available: balance.free, decimals: manifest.source.nativeDecimals }; },
    async safeMax() { return null; },
    async contribute(input, context, onUpdate = () => {}, signal): Promise<ContributionResult> {
      const diagnostic = createNativeDiagnostic(account);
      try {
        checkCancelled(signal); onUpdate({ state: "validating" });
        const amount = validateContributionAmount(input, context.phase, context.firstMinimum, context.subsequentExclusive);
        let balance = await readNativeBalance(api, account); checkCancelled(signal);
        recordNativeBalance(diagnostic, balance);
        if (balance.spendable < amount.planck) throw new Error("NATIVE_INSUFFICIENT_BALANCE");
        const resolution = canonicalContractAddress ? { h160: canonicalContractAddress } : await resolveContractAddress(api, account);
        const contributorH160 = resolution.h160;
        onUpdate({ state: "simulating" });
        let limits;
        try {
          limits = await simulateNativeContribution(api, account, contractAddress, amount, diagnostic);
        } catch (error) {
          if (error instanceof Error && error.message === "ACCOUNT_UNMAPPED") {
            onUpdate({ state: "checking_mapping" });
            const mapping = await checkAccountMapping(api, contributorH160, account);
            if (mapping === "conflict") throw new Error("ACCOUNT_MAPPING_CONFLICT");
            if (mapping === "failed") throw new Error("ACCOUNT_MAPPING_FAILED");
            if (mapping === "unmapped") {
              onUpdate({ state: "mapping_required" });
              await mapAccount(api, signer, account, (state) => onUpdate({ state: state === "mapping" ? "awaiting_mapping_signature" : "mapping_submitted" }));
              onUpdate({ state: "mapping_finalized" });
              onUpdate({ state: "verifying_mapping" });
              const refreshed = await checkAccountMapping(api, contributorH160, account);
              if (refreshed === "conflict") throw new Error("ACCOUNT_MAPPING_CONFLICT");
              if (refreshed !== "mapped") throw new Error("ACCOUNT_MAPPING_VERIFICATION_FAILED");
              balance = await readNativeBalance(api, account);
            }
            limits = await simulateNativeContribution(api, account, contractAddress, amount, diagnostic);
          } else throw error;
        }
        checkCancelled(signal);
        const data = encodeFunctionData({ abi: genesisAbi, functionName: "contribute" });
        let tx;
        let fee: bigint;
        try {
          tx = api.tx.Revive.call({ dest: contractAddress, value: amount.planck, weight_limit: limits.weightLimit, storage_deposit_limit: limits.storageDepositLimit, data: hexToBytes(data) });
        } catch (error) {
          diagnostic.txBuildError = errorDescription(error);
          throw new Error("NATIVE_SUBMISSION_FAILED");
        }
        try {
          fee = BigInt(await tx.getEstimatedFees(account));
        } catch (error) {
          diagnostic.feeEstimateError = errorDescription(error);
          throw new Error("NATIVE_FEE_ESTIMATE_UNAVAILABLE");
        }
        if (balance.spendable < amount.planck + fee + limits.storageDepositLimit) throw new Error("NATIVE_INSUFFICIENT_BALANCE");
        onUpdate({ state: "awaiting_signature" });
        diagnostic.signerPath = "injected-signPayload";
        diagnostic.signingStarted = true;
        diagnostic.walletPopupReached = true;
        let finalized;
        try {
          finalized = await submitNativeReviveCall({
            manifest,
            address: account,
            contractAddress,
            value: amount.planck,
            weightLimit: { refTime: limits.weightLimit.ref_time, proofSize: limits.weightLimit.proof_size },
            storageDepositLimit: limits.storageDepositLimit,
            data,
            signal,
            onStatus: (status) => {
              if (status === "broadcast") onUpdate({ state: "submitted" });
              if (status === "inBlock") onUpdate({ state: "included" });
              if (status === "finalized") onUpdate({ state: "finalized" });
            },
            onDiagnostic: (patch) => Object.assign(diagnostic, patch),
          });
        } catch (error) {
          if (error instanceof NativeTransactionError) throw new Error(error.code);
          throw error;
        }
        checkCancelled(signal);
        diagnostic.txStatus = "finalized";
        onUpdate({ state: "finalized", hash: finalized.txHash });
        onUpdate({ state: "verifying_event" });
        validatePolkadotJsNativeEvents(finalized.events, contractAddress, contributorH160, amount);
        onUpdate({ state: "success", hash: finalized.txHash });
        return { execution: "substrate", blockNumber: finalized.blockNumber, amount, contributorH160, substrateTransactionHash: finalized.txHash };
      } catch (error) {
        const code = error instanceof Error ? error.message : "REVIVE_DRY_RUN_FAILED";
        diagnostic.error = code;
        emitNativeDiagnostic(manifest, diagnostic);
        if (code !== "OPERATION_CANCELLED") onUpdate({ state: "failed", error: code });
        throw new Error(code);
      }
    },
  };
}

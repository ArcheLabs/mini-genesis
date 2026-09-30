import type { InjectedPolkadotAccount } from "polkadot-api/pjs-signer";
import type { DeploymentManifest } from "../../config/manifest";
import { getNativeRuntimeProfile } from "./runtime-profile";
import { checkNativeRuntime } from "./runtime";

export type NativeSubmissionStatus = "ready" | "broadcast" | "inBestBlock" | "finalized" | "invalid" | "dropped" | "retracted";
export type NativeSubmissionStage = "runtime-check" | "fee-estimation" | "submission" | "wallet-signing" | "finality";
export type NativeSubmissionResult = {
  substrateTxHash: `0x${string}`;
  finalizedBlockHash: `0x${string}`;
  finalizedBlockNumber: bigint;
  extrinsicIndex?: number;
  events: unknown[];
};

export class NativeTransactionError extends Error {
  constructor(
    public readonly code: "NATIVE_NETWORK_MISMATCH" | "NATIVE_RUNTIME_PROFILE_MISMATCH" | "NATIVE_RUNTIME_PROFILE_INCOMPLETE" | "NATIVE_WALLET_RUNTIME_UNSUPPORTED" | "NATIVE_FEE_ESTIMATE_UNAVAILABLE" | "NATIVE_SIGNING_REJECTED" | "NATIVE_TRANSACTION_BUILD_FAILED" | "NATIVE_SUBMISSION_FAILED" | "NATIVE_CONTRACT_REVERTED" | "NATIVE_EVENT_RECONCILIATION_FAILED",
    public readonly detail: string,
    public readonly rawError?: unknown,
  ) {
    super(code);
    this.name = "NativeTransactionError";
    this.cause = rawError ?? detail;
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error ?? ""); } catch { return String(error); }
}

export function isWalletSigningRejection(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? Number((error as { code?: unknown }).code) : Number.NaN;
  return code === 4001 || /user.*(reject|cancel|den)|reject.*user|declin|cancelled by user|denied by user/i.test(describe(error));
}

export function isWalletExtensionUnsupported(error: unknown): boolean {
  const message = describe(error);
  return /does not support this signed-extension|unsupported.*signed.?extension|signed.?extension.*unsupported|invalid extension .* parameter/i.test(message)
    || /(?:AsPgas|AsDotnsGateway|RestrictOrigins).{0,100}(?:unsupported|invalid|unknown|not supported|reject(?:ed)?|fail(?:ure|ed)?)|(?:unsupported|invalid|unknown|not supported|reject(?:ed)?|fail(?:ure|ed)?).{0,100}(?:AsPgas|AsDotnsGateway|RestrictOrigins)/i.test(message);
}

function isFeeEstimateUnavailable(error: unknown): boolean {
  return /failed to fetch|network request failed|connection refused|econnrefused|timed? ?out|timeout|gateway|rpc unavailable/i.test(describe(error));
}

export async function assertNativeRuntimeSupported(client: any, manifest: DeploymentManifest): Promise<ReturnType<typeof checkNativeRuntime> extends Promise<infer T> ? T : never> {
  const check = await checkNativeRuntime(client, manifest);
  if (check.compatibility === "network_mismatch") throw new NativeTransactionError("NATIVE_NETWORK_MISMATCH", check.reason ?? "NATIVE_NETWORK_MISMATCH");
  if (check.compatibility === "runtime_changed") throw new NativeTransactionError("NATIVE_RUNTIME_PROFILE_MISMATCH", check.reason ?? "NATIVE_RUNTIME_PROFILE_MISMATCH");
  if (check.compatibility !== "supported") throw new NativeTransactionError("NATIVE_RUNTIME_PROFILE_INCOMPLETE", check.reason ?? "NATIVE_RUNTIME_PROFILE_INCOMPLETE");
  return check;
}

/**
 * Fee estimation builds a complete mock-signed transaction. It exercises the
 * wallet TxCreator and runtime extension payloads without opening a signing UI.
 */
export async function probeNativeWalletCapability(tx: any, txCreator: InjectedPolkadotAccount["txCreator"], manifest: DeploymentManifest): Promise<bigint> {
  const profile = getNativeRuntimeProfile(manifest);
  if (!profile.enabled) throw new NativeTransactionError("NATIVE_RUNTIME_PROFILE_INCOMPLETE", profile.reason);
  try {
    return BigInt(await tx.getEstimatedFees(txCreator, profile.buildTransactionOptions()));
  } catch (error) {
    if (isWalletExtensionUnsupported(error)) throw new NativeTransactionError("NATIVE_WALLET_RUNTIME_UNSUPPORTED", describe(error), error);
    if (isWalletSigningRejection(error)) throw new NativeTransactionError("NATIVE_SIGNING_REJECTED", describe(error), error);
    if (isFeeEstimateUnavailable(error)) throw new NativeTransactionError("NATIVE_FEE_ESTIMATE_UNAVAILABLE", describe(error), error);
    throw new NativeTransactionError("NATIVE_TRANSACTION_BUILD_FAILED", describe(error), error);
  }
}

export async function submitNativeTransaction(params: {
  client: any;
  manifest: DeploymentManifest;
  tx: any;
  txCreator: InjectedPolkadotAccount["txCreator"];
  /** Supply a fee already checked against this exact tx to avoid probing the wallet twice. */
  feeEstimate?: bigint;
  signal?: AbortSignal;
  onStatus?: (status: NativeSubmissionStatus) => void;
  onStage?: (stage: NativeSubmissionStage) => void;
}): Promise<NativeSubmissionResult> {
  const { client, manifest, tx, txCreator, feeEstimate, signal, onStatus = () => {}, onStage = () => {} } = params;
  onStage("runtime-check");
  await assertNativeRuntimeSupported(client, manifest);
  const profile = getNativeRuntimeProfile(manifest);
  if (!profile.enabled) throw new NativeTransactionError("NATIVE_RUNTIME_PROFILE_INCOMPLETE", profile.reason);

  if (feeEstimate !== undefined && feeEstimate < 0n) throw new NativeTransactionError("NATIVE_FEE_ESTIMATE_UNAVAILABLE", "Invalid negative fee estimate.");
  if (signal?.aborted) throw new NativeTransactionError("NATIVE_SUBMISSION_FAILED", "OPERATION_CANCELLED");
  if (feeEstimate === undefined) {
    onStage("fee-estimation");
    try {
      await probeNativeWalletCapability(tx, txCreator, manifest);
    } catch (error) {
      if (error instanceof NativeTransactionError) throw error;
      throw new NativeTransactionError("NATIVE_TRANSACTION_BUILD_FAILED", describe(error), error);
    }
  }

  onStatus("ready");
  return new Promise<NativeSubmissionResult>((resolve, reject) => {
    let settled = false;
    const finishError = (error: NativeTransactionError) => {
      if (settled) return;
      settled = true;
      subscription?.unsubscribe();
      signal?.removeEventListener("abort", onAbort);
      reject(error);
    };
    const onAbort = () => finishError(new NativeTransactionError("NATIVE_SUBMISSION_FAILED", "OPERATION_CANCELLED"));
    let subscription: { unsubscribe: () => void } | undefined;
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      onStage("submission");
      const observable = tx.createSubmitAndWatch(txCreator, profile.buildTransactionOptions());
      onStage("wallet-signing");
      subscription = observable.subscribe({
        next(event: any) {
          if (settled) return;
          if (event.type === "broadcasted") { onStage("submission"); onStatus("broadcast"); return; }
          if (event.type === "inBestBlock") { onStage("finality"); onStatus("inBestBlock"); return; }
          if (event.type === "invalid" || event.type === "dropped" || event.type === "retracted" || event.type === "usurped") {
            onStatus(event.type);
            finishError(new NativeTransactionError("NATIVE_SUBMISSION_FAILED", `Transaction ${event.type}`, event));
            return;
          }
          if (event.type !== "finalized") return;
          onStage("finality");
          if (!event.ok) {
            finishError(new NativeTransactionError("NATIVE_CONTRACT_REVERTED", describe(event.dispatchError), event.dispatchError));
            return;
          }
          onStatus("finalized");
          settled = true;
          subscription?.unsubscribe();
          signal?.removeEventListener("abort", onAbort);
          resolve({
            substrateTxHash: event.txHash as `0x${string}`,
            finalizedBlockHash: event.block.hash as `0x${string}`,
            finalizedBlockNumber: BigInt(event.block.number),
            extrinsicIndex: event.block.index,
            events: event.events ?? [],
          });
        },
        error(error: unknown) {
          finishError(isWalletSigningRejection(error)
            ? new NativeTransactionError("NATIVE_SIGNING_REJECTED", describe(error), error)
            : new NativeTransactionError("NATIVE_SUBMISSION_FAILED", describe(error), error));
        },
      });
    } catch (error) {
      finishError(isWalletSigningRejection(error)
        ? new NativeTransactionError("NATIVE_SIGNING_REJECTED", describe(error), error)
        : new NativeTransactionError("NATIVE_SUBMISSION_FAILED", describe(error), error));
    }
  });
}

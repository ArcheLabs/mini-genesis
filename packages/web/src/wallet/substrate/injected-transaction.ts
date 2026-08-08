import type { ApiPromise } from "@polkadot/api";
import { web3Enable, web3FromAddress } from "@polkadot/extension-dapp";
import type { DeploymentManifest } from "../../config/manifest";
import { getPolkadotJsApi } from "./polkadot-js-client";

export type NativeSubmissionStatus = "ready" | "broadcast" | "inBlock" | "finalized" | "invalid" | "dropped" | "usurped" | "retracted";
export type NativeSignerDiagnosticPatch = {
  polkadotJsRuntimeVersion?: { specVersion: string; transactionVersion: string };
  signedExtensions?: string[];
  injectorSource?: string | null;
  injectorVersion?: string | null;
  chainGenesisHash?: string;
  injectorMetadataKnown?: boolean;
  injectorMetadataProvided?: boolean;
  injectorMetadataError?: unknown;
  signingStarted?: boolean;
  walletPopupReached?: boolean;
  txStatus?: NativeSubmissionStatus;
  dispatchError?: unknown;
  txBuildError?: string;
  signingError?: unknown;
  submissionError?: unknown;
};
export type NativeSubmissionResult = {
  txHash: `0x${string}`;
  blockHash: `0x${string}`;
  blockNumber: bigint;
  events: unknown[];
  extrinsicIndex?: number;
};

export type SubmitNativeReviveParams = {
  manifest: DeploymentManifest;
  address: string;
  contractAddress: string;
  value: bigint;
  weightLimit: { refTime: bigint; proofSize: bigint };
  storageDepositLimit: bigint;
  data: `0x${string}`;
  signal?: AbortSignal;
  onStatus?: (status: NativeSubmissionStatus) => void;
  onDiagnostic?: (patch: NativeSignerDiagnosticPatch) => void;
};

export class NativeTransactionError extends Error {
  constructor(public readonly code: "NATIVE_SIGNER_UNAVAILABLE" | "NATIVE_SIGNING_FAILED" | "NATIVE_SUBMISSION_FAILED", public readonly detail: string, public readonly rawError?: unknown) {
    super(code);
    this.name = "NativeTransactionError";
    this.cause = detail;
  }
}

function checkCancelled(signal?: AbortSignal): void { if (signal?.aborted) throw new NativeTransactionError("NATIVE_SUBMISSION_FAILED", "OPERATION_CANCELLED"); }

function errorDescription(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error ?? ""); } catch { return String(error); }
}

function errorDiagnostic(error: unknown): { description: string; raw: unknown } {
  return { description: errorDescription(error), raw: error };
}

function isWalletSigningRejection(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? Number((error as { code?: unknown }).code) : Number.NaN;
  if (code === 4001) return true;
  return /user.*(reject|cancel|den)|reject.*user|declin|cancelled by user|denied by user/i.test(errorDescription(error));
}

function isWalletMetadataError(error: unknown): boolean {
  return /unable to find metadata for chain|chain metadata.*not found|unknown chain metadata/i.test(errorDescription(error));
}

async function ensureInjectedMetadata(api: ApiPromise, injector: any, manifest: DeploymentManifest, onDiagnostic: (patch: NativeSignerDiagnosticPatch) => void): Promise<void> {
  const genesisHash = api.genesisHash.toHex();
  const specVersion = api.runtimeVersion.specVersion.toNumber();
  onDiagnostic({ chainGenesisHash: genesisHash });
  if (!injector.metadata) return;
  try {
    const known = await injector.metadata.get();
    const isKnown = known.some((entry: { genesisHash?: string; specVersion?: number }) => entry.genesisHash?.toLowerCase() === genesisHash.toLowerCase() && Number(entry.specVersion) === specVersion);
    onDiagnostic({ injectorMetadataKnown: isKnown });
    const provided = await injector.metadata.provide({
      chain: manifest.source.name,
      genesisHash,
      icon: "substrate",
      ss58Format: manifest.source.ss58Prefix,
      chainType: "substrate",
      specVersion,
      tokenDecimals: manifest.source.nativeDecimals,
      tokenSymbol: manifest.source.currencySymbol,
      types: {},
      rawMetadata: api.runtimeMetadata.toHex(),
    });
    onDiagnostic({ injectorMetadataProvided: provided });
    if (!provided && !isKnown) throw new Error("WALLET_METADATA_REGISTRATION_REJECTED");
  } catch (error) {
    onDiagnostic({ injectorMetadataError: errorDiagnostic(error) });
    throw error;
  }
}

function dispatchErrorDescription(api: ApiPromise, dispatchError: any): string {
  const raw = errorDescription(dispatchError);
  try {
    if (dispatchError?.isModule) {
      const meta = api.registry.findMetaError(dispatchError.asModule);
      return `${meta.section}.${meta.name}: ${meta.docs.join(" ")} (${raw})`;
    }
  } catch { /* Keep raw dispatch error if metadata decoding fails. */ }
  return raw;
}

export async function submitNativeReviveCall(params: SubmitNativeReviveParams): Promise<NativeSubmissionResult> {
  const { manifest, address, contractAddress, value, weightLimit, storageDepositLimit, data, signal, onStatus = () => {}, onDiagnostic = () => {} } = params;
  let api: ApiPromise;
  try {
    api = await getPolkadotJsApi(manifest);
    onDiagnostic({ polkadotJsRuntimeVersion: { specVersion: api.runtimeVersion.specVersion.toString(), transactionVersion: api.runtimeVersion.transactionVersion.toString() }, signedExtensions: [...api.registry.signedExtensions] });
  } catch (error) {
    throw new NativeTransactionError("NATIVE_SIGNER_UNAVAILABLE", errorDescription(error), error);
  }

  let injector;
  try {
    const enabled = await web3Enable("MINI Genesis");
    if (!enabled.length) throw new Error("SUBSTRATE_WALLET_NOT_FOUND");
    injector = await web3FromAddress(address);
    if (!injector?.signer) throw new Error("NATIVE_SIGNER_UNAVAILABLE");
    onDiagnostic({ injectorSource: injector.name, injectorVersion: injector.version });
    await ensureInjectedMetadata(api, injector, manifest, onDiagnostic);
  } catch (error) {
    throw new NativeTransactionError("NATIVE_SIGNER_UNAVAILABLE", errorDescription(error), error);
  }

  let tx: any;
  try {
    tx = api.tx.revive.call(
      contractAddress,
      value.toString(),
      { refTime: weightLimit.refTime.toString(), proofSize: weightLimit.proofSize.toString() },
      storageDepositLimit.toString(),
      data,
    );
  } catch (error) {
    onDiagnostic({ txBuildError: errorDescription(error) });
    throw new NativeTransactionError("NATIVE_SUBMISSION_FAILED", errorDescription(error), error);
  }

  onStatus("ready");
  onDiagnostic({ signingStarted: true, walletPopupReached: true });
  try {
    return await new Promise<NativeSubmissionResult>((resolve, reject) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;
      const finishError = (error: NativeTransactionError) => { if (settled) return; settled = true; unsubscribe?.(); reject(error); };
      let sendResult!: Promise<() => void>;
      try {
        sendResult = tx.signAndSend(address, { signer: injector.signer }, async (result: any) => {
        try {
          checkCancelled(signal);
          const status = result.status;
          if (status.isReady) { onStatus("ready"); onDiagnostic({ txStatus: "ready" }); }
          if (status.isBroadcast) { onStatus("broadcast"); onDiagnostic({ txStatus: "broadcast" }); }
          if (status.isInBlock) { onStatus("inBlock"); onDiagnostic({ txStatus: "inBlock" }); }
          if (status.isInvalid || status.isDropped || status.isUsurped || status.isRetracted) {
            const state: NativeSubmissionStatus = status.isInvalid ? "invalid" : status.isDropped ? "dropped" : status.isUsurped ? "usurped" : "retracted";
            onStatus(state); onDiagnostic({ txStatus: state });
            finishError(new NativeTransactionError("NATIVE_SUBMISSION_FAILED", `Transaction ${state}`, result));
            return;
          }
          if (result.dispatchError) {
            const description = dispatchErrorDescription(api, result.dispatchError);
            onDiagnostic({ dispatchError: { description, raw: result.dispatchError } });
            finishError(new NativeTransactionError("NATIVE_SUBMISSION_FAILED", description, result.dispatchError));
            return;
          }
          if (!status.isFinalized) return;
          onStatus("finalized"); onDiagnostic({ txStatus: "finalized" });
          const finalizedHash = status.asFinalized.toHex() as `0x${string}`;
          const header = await api.rpc.chain.getHeader(status.asFinalized);
          settled = true;
          unsubscribe?.();
          resolve({ txHash: result.txHash.toHex() as `0x${string}`, blockHash: finalizedHash, blockNumber: BigInt(header.number.toString()), events: result.events ?? [], extrinsicIndex: result.txIndex });
        } catch (error) {
          finishError(error instanceof NativeTransactionError ? error : new NativeTransactionError("NATIVE_SUBMISSION_FAILED", errorDescription(error), error));
        }
        });
      } catch (error) {
        const description = errorDescription(error);
        onDiagnostic({ signingError: errorDiagnostic(error) });
        finishError(new NativeTransactionError("NATIVE_SIGNING_FAILED", description, error));
        return;
      }
      void sendResult.then((stop: (() => void) | undefined) => { unsubscribe = stop; if (settled) stop?.(); }).catch((error: unknown) => {
        const description = errorDescription(error);
        if (isWalletMetadataError(error)) {
          onDiagnostic({ signingError: errorDiagnostic(error) });
          finishError(new NativeTransactionError("NATIVE_SIGNER_UNAVAILABLE", description, error));
          return;
        }
        if (isWalletSigningRejection(error)) {
          onDiagnostic({ signingError: errorDiagnostic(error) });
          finishError(new NativeTransactionError("NATIVE_SIGNING_FAILED", description, error));
          return;
        }
        onDiagnostic({ submissionError: errorDiagnostic(error) });
        finishError(new NativeTransactionError("NATIVE_SUBMISSION_FAILED", description, error));
      });
    });
  } catch (error) {
    if (error instanceof NativeTransactionError) throw error;
    throw new NativeTransactionError("NATIVE_SIGNING_FAILED", errorDescription(error), error);
  }
}

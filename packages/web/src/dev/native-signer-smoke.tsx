import { useState } from "react";
import type { ApiPromise } from "@polkadot/api";
import { web3Enable, web3FromAddress } from "@polkadot/extension-dapp";
import type { DeploymentManifest } from "../config/manifest";
import type { PolkadotWalletDescriptor, WalletSession } from "../wallet/types";
import { getPolkadotJsApi } from "../wallet/substrate/polkadot-js-client";

type SmokeStatus = "idle" | "connecting" | "ready" | "broadcast" | "inBlock" | "finalized" | "failed";
type SmokeResult = { status: SmokeStatus; txHash?: string; error?: string; diagnostics: Record<string, unknown> };

function errorDetails(error: unknown): { name: string; message: string; stack?: string; raw: unknown } {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack, raw: error };
  return { name: "UnknownError", message: typeof error === "string" ? error : JSON.stringify(error), raw: error };
}

export async function runNativeSignerSmoke(manifest: DeploymentManifest, address: string, onUpdate: (result: SmokeResult) => void): Promise<SmokeResult> {
  const diagnostics: Record<string, unknown> = { account: address, walletPopupReached: false };
  let api: ApiPromise;
  try {
    onUpdate({ status: "connecting", diagnostics });
    api = await getPolkadotJsApi(manifest);
    diagnostics.network = (await api.rpc.system.chain()).toString();
    diagnostics.polkadotJsRuntimeVersion = { specVersion: api.runtimeVersion.specVersion.toString(), transactionVersion: api.runtimeVersion.transactionVersion.toString() };
    diagnostics.signedExtensions = [...api.registry.signedExtensions];
    const enabled = await web3Enable("MINI Genesis");
    if (!enabled.length) throw new Error("SUBSTRATE_WALLET_NOT_FOUND");
    const injector = await web3FromAddress(address);
    diagnostics.injectorSource = injector.name;
    diagnostics.injectorVersion = injector.version;
    const tx: any = api.tx.system.remark("MINI Genesis signer smoke");
    onUpdate({ status: "ready", diagnostics });
    diagnostics.signingStarted = true;
    diagnostics.walletPopupReached = true;
    return await new Promise<SmokeResult>((resolve, reject) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        diagnostics.error = errorDetails(error);
        console.error("[MINI Genesis][Native signer smoke]", diagnostics);
        unsubscribe?.();
        reject(error);
      };
      void tx.signAndSend(address, { signer: injector.signer }, async (result: any) => {
        try {
          if (result.dispatchError) {
            const raw = result.dispatchError;
            let description = raw.toString();
            if (raw.isModule) { const meta = api.registry.findMetaError(raw.asModule); description = `${meta.section}.${meta.name}: ${meta.docs.join(" ")} (${description})`; }
            diagnostics.dispatchError = { description, raw };
            throw new Error(description);
          }
          if (result.status.isBroadcast) { diagnostics.txStatus = "broadcast"; onUpdate({ status: "broadcast", diagnostics }); }
          if (result.status.isInBlock) { diagnostics.txStatus = "inBlock"; onUpdate({ status: "inBlock", diagnostics }); }
          if (!result.status.isFinalized) return;
          diagnostics.txStatus = "finalized";
          settled = true;
          unsubscribe?.();
          const finished = { status: "finalized" as const, txHash: result.txHash.toHex(), diagnostics };
          onUpdate(finished);
          resolve(finished);
        } catch (error) { fail(error); }
      }).then((stop: (() => void) | undefined) => { unsubscribe = stop; if (settled) stop?.(); }).catch(fail);
    });
  } catch (error) {
    const details = errorDetails(error);
    diagnostics.error = details;
    console.error("[MINI Genesis][Native signer smoke]", diagnostics);
    const failed = { status: "failed" as const, error: details.message, diagnostics };
    onUpdate(failed);
    return failed;
  }
}

type Props = {
  manifest: DeploymentManifest | null;
  session: WalletSession;
  availablePolkadotWallets: PolkadotWalletDescriptor[];
  connectPolkadot: (extensionId?: string) => Promise<string>;
};

export function NativeSignerSmoke({ manifest, session, availablePolkadotWallets, connectPolkadot }: Props) {
  const [result, setResult] = useState<SmokeResult>({ status: "idle", diagnostics: {} });
  const account = session?.kind === "polkadot" ? session.selectedAccountAddress : null;
  const connect = async (extensionId?: string) => {
    try { await connectPolkadot(extensionId); } catch (error) { setResult({ status: "failed", error: errorDetails(error).message, diagnostics: { error: errorDetails(error) } }); }
  };
  const run = async () => { if (manifest && account) await runNativeSignerSmoke(manifest, account, setResult); };
  return <main className="smoke-page"><div className="smoke-card"><p className="section-index">DEV / STAGING</p><h1>Native Signer Smoke</h1><p>Independent <code>@polkadot/api + injected signer</code> validation. This does not call Genesis.</p><dl><dt>Wallet</dt><dd>{session?.kind === "polkadot" ? session.walletName : "—"}</dd><dt>Account</dt><dd>{account ?? "—"}</dd><dt>Network</dt><dd>{manifest?.source.name ?? "—"}</dd></dl>{!account && <div className="smoke-actions">{availablePolkadotWallets.map((wallet) => <button className="submit-button" key={wallet.extensionId} type="button" onClick={() => void connect(wallet.extensionId)}>{wallet.displayName}</button>)}{!availablePolkadotWallets.length && <button className="submit-button" type="button" onClick={() => void connect()}>Connect Polkadot Wallet</button>}</div>}{account && <button className="submit-button" type="button" disabled={result.status === "connecting" || result.status === "ready" || result.status === "broadcast" || result.status === "inBlock"} onClick={() => void run()}>Run Smoke</button>}<p className="smoke-status">Status: {result.status}</p><pre>{JSON.stringify(result.diagnostics, (_, value) => typeof value === "bigint" ? `${value}n` : value, 2)}</pre>{result.error && <p className="field-feedback" role="alert">{result.error}</p>}</div></main>;
}

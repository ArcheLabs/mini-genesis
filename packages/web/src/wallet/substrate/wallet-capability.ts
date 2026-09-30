import type { InjectedPolkadotAccount } from "polkadot-api/pjs-signer";
import type { DeploymentManifest } from "../../config/manifest";
import { getSubstrateApi, getSubstrateClient } from "./client";
import { assertNativeRuntimeSupported, probeNativeWalletCapability } from "./native-transaction";
import { getNativeRuntimeProfile } from "./runtime-profile";

export type NativeWalletCapability = "supported" | "unsupported";

export async function probeNativeWallet(manifest: DeploymentManifest, txCreator: InjectedPolkadotAccount["txCreator"], wallet = "Polkadot wallet"): Promise<NativeWalletCapability> {
  const client = getSubstrateClient(manifest);
  const api = getSubstrateApi(manifest);
  const profile = getNativeRuntimeProfile(manifest);
  await assertNativeRuntimeSupported(client, manifest);
  try {
    // map_account is a harmless, deterministic call shape for the capability
    // probe. getEstimatedFees requests a mocked signature and never opens UI.
    await probeNativeWalletCapability(api.tx.Revive.map_account(), txCreator, manifest);
    if (manifest.environment === "staging") {
      console.info("Native wallet capability diagnostic", {
        stage: "wallet-capability",
        code: null,
        name: null,
        message: "supported",
        cause: [],
        wallet,
        runtimeProfile: profile.id,
        transactionCall: "Revive.map_account",
        transactionStage: "fee-estimation",
      });
    }
    return "supported";
  } catch (error) {
    if (error instanceof Error && error.message === "NATIVE_WALLET_RUNTIME_UNSUPPORTED") return "unsupported";
    throw error;
  }
}

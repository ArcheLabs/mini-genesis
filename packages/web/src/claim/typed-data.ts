import type { Address } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import type { PreparedClaim } from "./types";
import { validatePreparedClaim } from "./api";
import { signTypedClaim } from "../wallet/wallet-client";
import type { WalletClient } from "viem";

export async function signPreparedClaim(wallet: WalletClient, prepared: PreparedClaim, account: Address, username: string, manifest: DeploymentManifest): Promise<`0x${string}`> {
  validatePreparedClaim(prepared, account, username, manifest);
  return signTypedClaim(wallet, account, prepared.typedData);
}

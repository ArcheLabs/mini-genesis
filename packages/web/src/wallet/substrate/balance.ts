import type { DeploymentManifest } from "../../config/manifest";
import { getSubstrateApi } from "./client";

export type NativeGenesisBalance = {
  free: bigint;
  frozen: bigint;
  existentialDeposit: bigint;
  spendable: bigint;
};

export async function readNativeBalance(api: any, address: string): Promise<NativeGenesisBalance> {
  const account = await api.query.System.Account.getValue(address);
  const free = BigInt(account?.data?.free ?? 0n);
  const frozen = BigInt(account?.data?.frozen ?? 0n);
  const existentialDeposit = BigInt(await api.constants?.Balances?.ExistentialDeposit?.() ?? 0n);
  const reservedForAccount = frozen + existentialDeposit;
  return { free, frozen, existentialDeposit, spendable: free > reservedForAccount ? free - reservedForAccount : 0n };
}

export async function readManifestNativeBalance(manifest: DeploymentManifest, address: string): Promise<NativeGenesisBalance> {
  return readNativeBalance(getSubstrateApi(manifest), address);
}

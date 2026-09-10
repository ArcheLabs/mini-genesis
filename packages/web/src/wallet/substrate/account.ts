import { fromBufferToBase58, getSs58AddressInfo, type SS58String } from "@polkadot-api/substrate-bindings";
import { bytesToHex, getAddress, keccak256, type Address } from "viem";

export type ContractAddressResolution = {
  accountId32: Uint8Array;
  h160: Address;
  source: "runtime";
};

export function accountId32FromSs58(address: string): Uint8Array {
  const info = getSs58AddressInfo(address as SS58String);
  if (!info.isValid || info.publicKey.length !== 32) throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED");
  return info.publicKey;
}

/** Fallback AccountId32 -> H160 mapping for assertions and diagnostics only. */
export function deriveNativeAccountH160(accountId32: Uint8Array): Address {
  const digest = keccak256(accountId32);
  return getAddress(`0x${digest.slice(-40)}`);
}

/** Ethereum-derived AccountId32 stores the original H160 followed by 12 0xee bytes. */
export function isEthereumDerivedAccountId(accountId32: Uint8Array): boolean {
  return accountId32.length === 32 && accountId32.slice(20).every((byte) => byte === 0xee);
}

/** Local fallback used only by tests, diagnostics, and the runtime assertion below. */
export function deriveContractAddress(address: string): Address {
  return deriveNativeAccountH160(accountId32FromSs58(address));
}

function runtimeH160(value: unknown): Address {
  if (typeof value === "string") return getAddress(value);
  if (value instanceof Uint8Array) return getAddress(bytesToHex(value));
  throw new Error("ACCOUNT_ADDRESS_RESOLUTION_FAILED");
}

/** Resolve the authoritative H160 through the chain runtime, never by local hashing alone. */
export async function resolveContractAddress(api: any, account: string | Uint8Array): Promise<ContractAddressResolution> {
  const accountId32 = typeof account === "string" ? accountId32FromSs58(account) : account;
  if (accountId32.length !== 32) throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED");
  const origin = typeof account === "string" ? account : fromBufferToBase58(0)(accountId32);
  let h160: Address;
  try {
    h160 = runtimeH160(await api.apis.ReviveApi.address(origin));
  } catch {
    throw new Error("ACCOUNT_ADDRESS_RESOLUTION_FAILED");
  }
  if (!isEthereumDerivedAccountId(accountId32) && h160.toLowerCase() !== deriveNativeAccountH160(accountId32).toLowerCase()) {
    throw new Error("ACCOUNT_ADDRESS_MAPPING_MISMATCH");
  }
  if (isEthereumDerivedAccountId(accountId32) && h160.toLowerCase() !== getAddress(bytesToHex(accountId32.slice(0, 20))).toLowerCase()) {
    throw new Error("ACCOUNT_ADDRESS_MAPPING_MISMATCH");
  }
  return { accountId32, h160, source: "runtime" };
}

export function accountIdHex(address: string): `0x${string}` {
  return bytesToHex(accountId32FromSs58(address));
}

export function sameSubstrateAccount(left: string, right: string): boolean {
  return accountIdHex(left).toLowerCase() === accountIdHex(right).toLowerCase();
}

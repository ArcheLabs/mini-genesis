import { getSs58AddressInfo, type SS58String } from "@polkadot-api/substrate-bindings";
import { bytesToHex, getAddress, keccak256, type Address } from "viem";

export function accountId32FromSs58(address: string): Uint8Array {
  const info = getSs58AddressInfo(address as SS58String);
  if (!info.isValid || info.publicKey.length !== 32) throw new Error("SUBSTRATE_ACCOUNT_NOT_SELECTED");
  return info.publicKey;
}

/** Polkadot Hub fallback AccountId32 -> H160 mapping. Never truncate SS58 text. */
export function deriveContractAddress(address: string): Address {
  const digest = keccak256(accountId32FromSs58(address));
  return getAddress(`0x${digest.slice(-40)}`);
}

export function accountIdHex(address: string): `0x${string}` {
  return bytesToHex(accountId32FromSs58(address));
}

export function sameSubstrateAccount(left: string, right: string): boolean {
  return accountIdHex(left).toLowerCase() === accountIdHex(right).toLowerCase();
}

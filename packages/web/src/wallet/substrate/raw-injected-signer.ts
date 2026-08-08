import { getPolkadotSigner, type PolkadotSigner } from "@polkadot-api/signer";
import { web3Enable, web3FromAddress } from "@polkadot/extension-dapp";
import { bytesToHex, hexToBytes } from "viem";
import type { InjectedPolkadotAccount, KeypairType } from "polkadot-api/pjs-signer";

function signingType(type?: KeypairType): "Ecdsa" | "Ed25519" | "Sr25519" {
  if (type === "ecdsa") return "Ecdsa";
  if (type === "ed25519") return "Ed25519";
  return "Sr25519";
}

/** PAPI encodes every runtime signed extension; the wallet only signs the final bytes through signRaw. */
export function createRawInjectedSigner(account: InjectedPolkadotAccount): PolkadotSigner {
  return getPolkadotSigner(
    account.polkadotSigner.publicKey,
    signingType(account.type),
    async (payload) => {
      const enabled = await web3Enable("MINI Genesis");
      if (!enabled.length) throw new Error("NATIVE_RAW_SIGNER_UNAVAILABLE");
      const injector = await web3FromAddress(account.address);
      if (!injector.signer.signRaw) throw new Error("NATIVE_RAW_SIGNER_UNAVAILABLE");
      // Injected signRaw is the bytes-signing API. `payload` is reserved for
      // signPayload-style transaction requests in some wallets and is not part
      // of the pjs SignRaw contract.
      const result = await injector.signer.signRaw({ address: account.address, data: bytesToHex(payload), type: "bytes" });
      return hexToBytes(result.signature);
    },
  );
}

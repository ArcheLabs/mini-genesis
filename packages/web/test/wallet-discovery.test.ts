import { describe, expect, it } from "vitest";
import { fromBufferToBase58 } from "@polkadot-api/substrate-bindings";
import { describePolkadotWallet, supportedAccounts } from "../src/wallet/use-genesis-wallet";

describe("Polkadot wallet discovery", () => {
  it("uses human-readable wallet names without exposing extension ids", () => {
    expect(describePolkadotWallet("subwallet-js").displayName).toBe("SubWallet");
    expect(describePolkadotWallet("talisman").displayName).toBe("Talisman");
    expect(describePolkadotWallet("my-wallet-js").displayName).toBe("My Wallet");
    expect(describePolkadotWallet("subwallet-js").displayName).not.toContain("subwallet-js");
  });

  it("keeps only injected accounts with 32-byte signer public keys", () => {
    const signer32 = { publicKey: new Uint8Array(32) };
    const signer20 = { publicKey: new Uint8Array(20) };
    const validAddress = fromBufferToBase58(0)(new Uint8Array(32));
    const accounts = supportedAccounts([
      { address: "bad-account-id20", name: "EVM account", polkadotSigner: signer20 },
      { address: validAddress, name: "DOT account", polkadotSigner: signer32 },
    ] as never);

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.name).toBe("DOT account");
  });
});

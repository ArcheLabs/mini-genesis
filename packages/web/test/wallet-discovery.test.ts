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
    const key32 = new Uint8Array(32);
    const key20 = new Uint8Array(20);
    const validAddress = fromBufferToBase58(0)(key32);
    const accounts = supportedAccounts([
      { address: "bad-account-id20", name: "EVM account", txCreator: { publicKey: key20 } },
      { address: validAddress, name: "DOT account", txCreator: { publicKey: key32 } },
    ] as never);

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.name).toBe("DOT account");
  });

  it("deduplicates accounts by decoded AccountId32", () => {
    const accountId32 = new Uint8Array(32).fill(7);
    const txCreator = { publicKey: accountId32 };
    const accounts = supportedAccounts([
      { address: fromBufferToBase58(0)(accountId32), name: "Account A", txCreator },
      { address: fromBufferToBase58(2)(accountId32), name: "Account B", txCreator },
    ] as never);

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.name).toBe("Account A");
  });
});

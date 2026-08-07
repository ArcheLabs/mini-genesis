import { describe, expect, it } from "vitest";
import { fromBufferToBase58 } from "@polkadot-api/substrate-bindings";
import { hexToBytes } from "viem";
import { deriveContractAddress, deriveNativeAccountH160, resolveContractAddress } from "../src/wallet/substrate/account";

describe("Polkadot native account mapping", () => {
  it.each([
    ["111111111111111111111111111111111HC1", "0x88386Fc84bA6bC95484008F6362F93160eF3e563"],
    ["1mkmXsb3yPEMYPTnfvCnTJXMTxEsh5sRfD21tgmryszueHv", "0xc0b30c2acC9fBDD52Dc5E0D76917DE4034ebdf59"],
    ["12A8eoJt5TaM2p5hBWNogBTHXhRrp38JdzK2XLXfHyKVrjp4", "0x2c53FC945BEd8aab1E8da3F22eccA96cD45f8C57"],
  ])("derives the H160 for a fixed AccountId32 vector", (account, expected) => {
    expect(deriveContractAddress(account)).toBe(expected);
  });
  it("uses ReviveApi.address as the authoritative native resolution", async () => {
    const account = "111111111111111111111111111111111HC1";
    const expected = "0x88386fc84ba6bc95484008f6362f93160ef3e563";
    const api = { apis: { ReviveApi: { address: async () => expected } } };
    const resolution = await resolveContractAddress(api, account);
    expect(resolution.h160).toBe("0x88386Fc84bA6bC95484008F6362F93160eF3e563");
    expect(resolution.source).toBe("runtime");
  });
  it("does not keccak Ethereum-derived AccountId32 values", async () => {
    const original = "0x1234567890abcdef1234567890abcdef12345678";
    const accountId32 = new Uint8Array([...hexToBytes(original), ...new Uint8Array(12).fill(0xee)]);
    const account = fromBufferToBase58(0)(accountId32);
    const api = { apis: { ReviveApi: { address: async () => original } } };
    const resolution = await resolveContractAddress(api, account);
    expect(resolution.h160).toBe("0x1234567890AbcdEF1234567890aBcdef12345678");
    expect(deriveNativeAccountH160(accountId32)).not.toBe(resolution.h160);
  });
  it("fails closed when runtime and local native diagnostics disagree", async () => {
    const account = "111111111111111111111111111111111HC1";
    const api = { apis: { ReviveApi: { address: async () => "0x0000000000000000000000000000000000000001" } } };
    await expect(resolveContractAddress(api, account)).rejects.toThrow("ACCOUNT_ADDRESS_MAPPING_MISMATCH");
  });
});

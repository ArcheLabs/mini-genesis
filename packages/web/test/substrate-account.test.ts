import { describe, expect, it } from "vitest";
import { deriveContractAddress } from "../src/wallet/substrate/account";

describe("Polkadot native account mapping", () => {
  it.each([
    ["111111111111111111111111111111111HC1", "0x88386Fc84bA6bC95484008F6362F93160eF3e563"],
    ["1mkmXsb3yPEMYPTnfvCnTJXMTxEsh5sRfD21tgmryszueHv", "0xc0b30c2acC9fBDD52Dc5E0D76917DE4034ebdf59"],
    ["12A8eoJt5TaM2p5hBWNogBTHXhRrp38JdzK2XLXfHyKVrjp4", "0x2c53FC945BEd8aab1E8da3F22eccA96cD45f8C57"],
  ])("derives the H160 for a fixed AccountId32 vector", (account, expected) => {
    expect(deriveContractAddress(account)).toBe(expected);
  });
});

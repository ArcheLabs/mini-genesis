import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { createEvmPaymentSource, createPolkadotPaymentSource, chooseDefaultPaymentSource } from "../src/wallet/payment-source";

const ACCOUNT_A = "111111111111111111111111111111111HC1";
const ACCOUNT_B = "1mkmXsb3yPEMYPTnfvCnTJXMTxEsh5sRfD21tgmryszueHv";

describe("wallet payment sources", () => {
  it("creates one Polkadot source without exposing canonical H160 as another source", () => {
    const source = createPolkadotPaymentSource({ walletId: "injected:subwallet", walletName: "SubWallet", address: ACCOUNT_A, name: "same", signer: {} as any, api: {}, decimals: 10 });
    expect(source.kind).toBe("polkadot");
    expect(source.accountId32).toHaveLength(32);
    expect(source.contractIdentity).toMatch(/^0x[0-9a-f]{40}$/i);
    expect(source.id).not.toContain(source.contractIdentity);
  });

  it("keeps same-name accounts distinct by cryptographic address", () => {
    const first = createPolkadotPaymentSource({ walletId: "injected:subwallet", walletName: "SubWallet", address: ACCOUNT_A, name: "same", signer: {} as any, api: {}, decimals: 10 });
    const second = createPolkadotPaymentSource({ walletId: "injected:subwallet", walletName: "SubWallet", address: ACCOUNT_B, name: "same", signer: {} as any, api: {}, decimals: 10 });
    expect(first.id).not.toBe(second.id);
  });

  it("uses a real EVM address as a separate source and prefers persisted selection", () => {
    const evm = createEvmPaymentSource({ walletId: "appkit:eip155", walletName: "MetaMask", address: getAddress("0x1111111111111111111111111111111111111111"), provider: {} as any, chainId: 1, expectedChainId: 1, decimals: 18 });
    const polkadot = createPolkadotPaymentSource({ walletId: "injected:subwallet", walletName: "SubWallet", address: ACCOUNT_A, signer: {} as any, api: {}, decimals: 10 });
    expect(chooseDefaultPaymentSource([polkadot, evm], { walletId: evm.walletId, kind: evm.kind, address: evm.address })).toBe(evm);
  });
});

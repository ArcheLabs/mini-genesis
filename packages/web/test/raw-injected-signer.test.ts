import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPolkadotSigner: vi.fn(), web3Enable: vi.fn(), web3FromAddress: vi.fn() }));
vi.mock("@polkadot-api/signer", () => ({ getPolkadotSigner: mocks.getPolkadotSigner }));
vi.mock("@polkadot/extension-dapp", () => ({ web3Enable: mocks.web3Enable, web3FromAddress: mocks.web3FromAddress }));

import { createRawInjectedSigner } from "../src/wallet/substrate/raw-injected-signer";

describe("raw injected signer bridge", () => {
  it("delegates PAPI transaction payload bytes to the wallet signRaw path", async () => {
    const publicKey = new Uint8Array(32).fill(7);
    const signature = `0x${"09".repeat(64)}`;
    const signRaw = vi.fn().mockResolvedValue({ id: 1, signature });
    const rawSigner = { publicKey, signTx: vi.fn(), signBytes: vi.fn() };
    mocks.getPolkadotSigner.mockReturnValueOnce(rawSigner);
    mocks.web3Enable.mockResolvedValueOnce([{}]);
    mocks.web3FromAddress.mockResolvedValueOnce({ signer: { signRaw } });

    const result = createRawInjectedSigner({
      address: "selected-account",
      type: "sr25519",
      polkadotSigner: { publicKey },
    } as never);

    expect(result).toBe(rawSigner);
    expect(mocks.getPolkadotSigner).toHaveBeenCalledWith(publicKey, "Sr25519", expect.any(Function));
    const rawSign = mocks.getPolkadotSigner.mock.calls[0][2] as (payload: Uint8Array) => Promise<Uint8Array>;
    const payload = new Uint8Array([1, 2, 3]);
    await expect(rawSign(payload)).resolves.toEqual(new Uint8Array(64).fill(9));
    expect(signRaw).toHaveBeenCalledWith({ address: "selected-account", data: "0x010203", type: "bytes" });
  });
});

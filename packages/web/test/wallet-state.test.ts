import { describe, expect, it } from "vitest";
import { deriveWalletState } from "../src/wallet/wallet-state";

const expectedChainId = 420420419;

describe("genesis wallet state", () => {
  it("keeps a disconnected wallet neutral", () => {
    expect(deriveWalletState({ isConnected: false, chainId: 1, expectedChainId, hasProvider: false })).toEqual({ account: null, correctChain: false, walletReady: false });
  });
  it("marks a connected wallet on another chain as not ready", () => {
    const state = deriveWalletState({ isConnected: true, address: "0x0000000000000000000000000000000000000001", chainId: 1, expectedChainId, hasProvider: true });
    expect(state.correctChain).toBe(false);
    expect(state.walletReady).toBe(false);
  });
  it("requires the provider and expected chain", () => {
    const state = deriveWalletState({ isConnected: true, address: "0x0000000000000000000000000000000000000001", chainId: expectedChainId, expectedChainId, hasProvider: true });
    expect(state.correctChain).toBe(true);
    expect(state.walletReady).toBe(true);
  });
});

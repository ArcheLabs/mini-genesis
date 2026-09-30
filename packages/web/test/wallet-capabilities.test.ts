import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { genesisWalletCapabilities } from "../src/wallet/capabilities";
import { manifest } from "./helpers";

describe("Genesis wallet capabilities", () => {
  it("keeps EVM connect and purchase enabled while disabling SS58 on staging TestNet", () => {
    const capabilities = genesisWalletCapabilities(manifest({ environment: "staging" }));
    expect(capabilities).toEqual({
      evmWalletConnect: true,
      evmPurchase: true,
      polkadotWalletConnect: false,
      nativePolkadotTransactions: false,
    });
  });

  it("keeps both wallet paths enabled on production Polkadot Hub Mainnet", () => {
    const mainnet = manifest({
      environment: "production",
      source: { ...manifest().source, chainId: "420420419", name: "Polkadot Hub" },
    });
    expect(genesisWalletCapabilities(mainnet)).toEqual({
      evmWalletConnect: true,
      evmPurchase: true,
      polkadotWalletConnect: true,
      nativePolkadotTransactions: true,
    });
  });

  it("leaves local wallet capabilities unchanged", () => {
    expect(genesisWalletCapabilities(manifest())).toEqual({
      evmWalletConnect: true,
      evmPurchase: true,
      polkadotWalletConnect: true,
      nativePolkadotTransactions: true,
    });
  });

  it("preserves the existing wallet behavior while the deployment manifest is loading", () => {
    expect(genesisWalletCapabilities(null)).toEqual({
      evmWalletConnect: true,
      evmPurchase: true,
      polkadotWalletConnect: true,
      nativePolkadotTransactions: true,
    });
  });

  it("uses the capability for visible wallet options and prevents stale SS58 restore on staging", () => {
    const appSource = readFileSync("src.tsx", "utf8");
    const walletSource = readFileSync("src/wallet/use-genesis-wallet.ts", "utf8");
    expect(appSource).toContain("capabilities.evmWalletConnect && <button");
    expect(appSource).toContain("capabilities.polkadotWalletConnect && <button");
    expect(appSource).toContain("routeFromHash(window.location.hash, nativeSmokeEnabled)");
    expect(appSource).toContain("canonicalizeHash(window.location.hash, nativeSmokeEnabled)");
    expect(walletSource).toContain("if (!polkadotWalletConnectionEnabled) throw new Error(\"NATIVE_POLKADOT_TRANSACTIONS_DISABLED\")");
    expect(walletSource).toContain("if (!polkadotWalletConnectionEnabled) {");
  });
});

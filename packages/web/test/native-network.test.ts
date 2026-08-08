import { describe, expect, it } from "vitest";
import { nativeNetworkOverride, resolveNativeManifest } from "../src/config/native-network";
import { manifest } from "./helpers";

describe("Native network override", () => {
  it("keeps staging on Paseo by default", () => {
    const staging = manifest({ environment: "staging" });
    expect(nativeNetworkOverride("staging", "production", "none")).toBe("none");
    expect(resolveNativeManifest(staging, "production", "none")).toBe(staging);
  });

  it("uses the production Native source for an explicit staging override", () => {
    const resolved = resolveNativeManifest(manifest({ environment: "staging" }), "production", "polkadot-mainnet");
    expect(resolved.environment).toBe("production");
    expect(resolved.source.chainId).toBe("420420419");
    expect(resolved.source.contract).toBe("0xa6618752b2ef1bcef5b9372d5427ffeb58ab830a");
  });

  it("ignores the override in production", () => {
    const production = manifest({ environment: "production" });
    expect(nativeNetworkOverride("production", "production", "polkadot-mainnet")).toBe("none");
    expect(resolveNativeManifest(production, "production", "polkadot-mainnet")).toBe(production);
  });
});

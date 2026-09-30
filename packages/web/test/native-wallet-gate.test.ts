import { describe, expect, it } from "vitest";
import { isNativePolkadotEnabled } from "../src/config/native-wallet";

describe("experimental Native Polkadot wallet gate", () => {
  it("requires an explicit flag in local and staging environments", () => {
    expect(isNativePolkadotEnabled("local", "true")).toBe(true);
    expect(isNativePolkadotEnabled("staging", "true")).toBe(true);
    expect(isNativePolkadotEnabled("local", "false")).toBe(false);
    expect(isNativePolkadotEnabled("staging", undefined)).toBe(false);
  });

  it("cannot be enabled in production, even when the build flag is true", () => {
    expect(isNativePolkadotEnabled("production", "true")).toBe(false);
    expect(isNativePolkadotEnabled(null, "true")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { canonicalizeHash, hashForRoute, routeFromHash } from "../src/navigation/routing";
import { resolveRuntimeSelection } from "../src/config/runtime-selection";

describe("Genesis routes", () => {
  it.each([
    ["#/genesis/i", "phase1"],
    ["#/genesis/ii", "phase2"],
    ["#/genesis/iii", "phase3"],
    ["#/assets", "assets"],
  ] as const)("resolves %s to %s", (hash, route) => expect(routeFromHash(hash)).toBe(route));

  it("defaults and canonicalizes old or unknown routes to Genesis II", () => {
    expect(routeFromHash("")).toBe("phase2");
    expect(canonicalizeHash("#/" )).toBe("#/genesis/ii");
    expect(routeFromHash("#/rules")).toBe("phase2");
    expect(canonicalizeHash("#/rules")).toBe("#/genesis/ii");
  });

  it("keeps the development smoke route opt-in", () => {
    expect(routeFromHash("#/native-signer-smoke")).toBe("phase2");
    expect(routeFromHash("#/native-signer-smoke", true)).toBe("native-signer-smoke");
  });

  it("uses canonical stage hashes", () => {
    expect(hashForRoute("phase1")).toBe("#/genesis/i");
    expect(hashForRoute("phase2")).toBe("#/genesis/ii");
    expect(hashForRoute("phase3")).toBe("#/genesis/iii");
  });
});

describe("URL runtime environment selection", () => {
  it.each([
    ["local", "local"],
    ["testnet", "staging"],
    ["mainnet", "production"],
  ] as const)("maps network=%s to %s", (network, environment) => {
    expect(resolveRuntimeSelection({ search: `?network=${network}`, mode: "production", deploymentEnv: "production" })).toMatchObject({ environment, source: "url", error: null });
  });

  it("gives URL selection priority over build configuration", () => {
    expect(resolveRuntimeSelection({ search: "?network=local", mode: "production", deploymentEnv: "production" }).environment).toBe("local");
  });

  it("honors the build environment and mode fallbacks", () => {
    expect(resolveRuntimeSelection({ search: "", mode: "production", deploymentEnv: "staging" }).environment).toBe("staging");
    expect(resolveRuntimeSelection({ search: "", mode: "development" }).environment).toBe("local");
    expect(resolveRuntimeSelection({ search: "", mode: "production" }).environment).toBe("production");
  });

  it.each(["tesnet", "foo", ""]) ("fails closed for invalid network=%s", (network) => {
    const search = network ? `?network=${network}` : "?network=";
    expect(resolveRuntimeSelection({ search, mode: "production" })).toMatchObject({ environment: null, error: "CONFIGURATION_MISMATCH", source: "invalid" });
  });

  it("fails closed for an invalid build environment", () => {
    expect(resolveRuntimeSelection({ search: "", mode: "production", deploymentEnv: "prod" })).toMatchObject({ environment: null, error: "CONFIGURATION_MISMATCH" });
  });
});

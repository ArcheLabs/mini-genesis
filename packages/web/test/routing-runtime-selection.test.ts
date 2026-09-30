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
  ] as const)("maps network=%s to %s outside a production build", (network, environment) => {
    expect(resolveRuntimeSelection({ search: `?network=${network}`, mode: "production", deploymentEnv: "staging" })).toMatchObject({ environment, source: "url", error: null });
  });

  it("pins production builds to Mainnet, allowing only an explicit mainnet URL", () => {
    for (const network of ["local", "testnet"]) {
      expect(resolveRuntimeSelection({ search: `?network=${network}`, mode: "production", deploymentEnv: "production" })).toMatchObject({ environment: null, error: "CONFIGURATION_MISMATCH", source: "invalid" });
    }
    expect(resolveRuntimeSelection({ search: "", mode: "production", deploymentEnv: "production" })).toMatchObject({ environment: "production", source: "build", error: null });
    expect(resolveRuntimeSelection({ search: "?network=mainnet", mode: "production", deploymentEnv: "production" })).toMatchObject({ environment: "production", source: "url", error: null });
  });

  it("pins a default production-mode artifact even when no deployment env is supplied", () => {
    expect(resolveRuntimeSelection({ search: "?network=testnet", mode: "production" })).toMatchObject({ environment: null, error: "CONFIGURATION_MISMATCH" });
    expect(resolveRuntimeSelection({ search: "", mode: "production" })).toMatchObject({ environment: "production", error: null });
  });

  it("fails closed when the requested environment is not bundled into the published frontend", () => {
    const availableEnvironments = ["staging", "production"] as const;
    expect(resolveRuntimeSelection({ search: "?network=local", mode: "production", deploymentEnv: "staging", availableEnvironments })).toMatchObject({ environment: null, error: "CONFIGURATION_MISMATCH", source: "invalid" });
    expect(resolveRuntimeSelection({ search: "?network=testnet", mode: "production", deploymentEnv: "staging", availableEnvironments })).toMatchObject({ environment: "staging", error: null, source: "url" });
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

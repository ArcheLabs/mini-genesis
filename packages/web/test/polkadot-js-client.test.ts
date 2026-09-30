import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeploymentManifest } from "../src/config/manifest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  provider: vi.fn(function(this: { endpoints: string[] }, endpoints: string[]) { this.endpoints = endpoints; }),
}));

vi.mock("@polkadot/api", () => ({
  ApiPromise: { create: mocks.create },
  WsProvider: mocks.provider,
}));

import { destroyPolkadotJsClients, getPolkadotJsApi } from "../src/wallet/substrate/polkadot-js-client";

const manifest = { chainId: "test-chain", source: { substrateWsUrls: ["wss://one.example", "wss://two.example"] } } as DeploymentManifest;

describe("Polkadot.js client", () => {
  afterEach(async () => {
    await destroyPolkadotJsClients();
    mocks.create.mockReset();
    mocks.provider.mockClear();
  });

  it("creates one ApiPromise singleton from manifest WSS endpoints", async () => {
    const api = { disconnect: vi.fn().mockResolvedValue(undefined) };
    mocks.create.mockResolvedValue(api);

    const first = getPolkadotJsApi(manifest);
    const second = getPolkadotJsApi(manifest);

    await expect(first).resolves.toBe(api);
    await expect(second).resolves.toBe(api);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
    expect(mocks.provider).toHaveBeenCalledWith(manifest.source.substrateWsUrls);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith({ provider: expect.anything() });

    await destroyPolkadotJsClients();
    expect(api.disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails without a configured substrate endpoint", async () => {
    await expect(getPolkadotJsApi({ chainId: "empty", source: { substrateWsUrls: [] } } as DeploymentManifest)).rejects.toThrow("SUBSTRATE_RPC_UNAVAILABLE");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

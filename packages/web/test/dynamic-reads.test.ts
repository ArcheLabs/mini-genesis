import { describe, expect, it, vi } from "vitest";
import { formatUnits } from "viem";
import { readGlobalDynamic } from "../src/genesis/reads";
import { manifest } from "./helpers";

describe("dynamic Genesis reads", () => {
  it("uses the contract emittedMini getter instead of local block simulation", async () => {
    const values: Record<string, unknown> = {
      phase: 1n,
      startBlock: 10n,
      contributionEndBlock: 100n,
      emissionEndBlock: 200n,
      lastSettledBlock: 80n,
      totalRaisedDot: 25n,
      contributorCount: 3n,
      emittedMini: 26_666_666_666_666_666_666n,
    };
    const client = {
      readContract: vi.fn(({ functionName }: { functionName: string }) => Promise.resolve(values[functionName])),
      getBlockNumber: vi.fn().mockResolvedValue(999n),
    } as any;
    const result = await readGlobalDynamic(client, manifest());
    expect(result.emittedMini).toBe(values.emittedMini);
    expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "emittedMini" }));
    expect(Number(formatUnits(result.emittedMini, 18))).toBeCloseTo(26.666666666666668);
  });
});

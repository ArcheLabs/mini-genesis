import { describe, expect, it } from "vitest";
import { GENESIS1_HOLDER_SNAPSHOT, GENESIS1_HOLDER_SNAPSHOT_INPUT_REQUIRED, lookupGenesis1Holding, normalizeGenesisHolder } from "../src/genesis/genesis1-holder-snapshot";

describe("Genesis I historical holder snapshot", () => {
  it("clearly blocks display until canonical holder data is supplied", () => {
    expect(GENESIS1_HOLDER_SNAPSHOT_INPUT_REQUIRED).toBe(true);
    expect(Object.keys(GENESIS1_HOLDER_SNAPSHOT.holders)).toHaveLength(0);
    expect(lookupGenesis1Holding("0x0000000000000000000000000000000000000001")).toBeNull();
  });

  it("normalizes H160 identities case-insensitively", () => {
    expect(normalizeGenesisHolder("0xAbC")).toBe("0xabc");
    expect(new Set(Object.keys(GENESIS1_HOLDER_SNAPSHOT.holders).map(normalizeGenesisHolder)).size).toBe(Object.keys(GENESIS1_HOLDER_SNAPSHOT.holders).length);
  });
});

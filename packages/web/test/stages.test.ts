import { describe, expect, it } from "vitest";
import { genesisStages, genesisStageCopy } from "../src/genesis/stages";

describe("Genesis product stages", () => {
  it("contains exactly the three finite phases", () => {
    expect(genesisStages).toEqual(["phase1", "phase2", "phase3"]);
    expect(Object.keys(genesisStageCopy)).toHaveLength(3);
    expect(genesisStageCopy.phase1.status).toBe("COMPLETED");
    expect(genesisStageCopy.phase2.status).toBe("LIVE");
    expect(genesisStageCopy.phase3.status).toBe("LOCKED");
  });
});

import { describe, expect, it } from "vitest";
import { REOWN_PROJECT_ID, resolveReownProjectId } from "../src/config/reown";

describe("reown project configuration", () => {
  it("uses the checked-in project id when no environment override is configured", () => {
    const projectId = resolveReownProjectId({});

    expect(projectId).toBe(REOWN_PROJECT_ID);
    expect(projectId).toBe("65fcb5a5788f31332af2ca9bfabf4699");
  });

  it("allows an environment override to replace the checked-in project id", () => {
    const projectId = resolveReownProjectId({ VITE_REOWN_PROJECT_ID: "override-project-id" });

    expect(projectId).toBe("override-project-id");
    expect(projectId).not.toBe(REOWN_PROJECT_ID);
  });
});

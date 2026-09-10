export type GenesisStage = "phase1" | "phase2" | "phase3";

export const genesisStages: readonly GenesisStage[] = ["phase1", "phase2", "phase3"];

export const genesisStageCopy: Record<GenesisStage, { title: string; status: string }> = {
  phase1: { title: "Genesis I", status: "COMPLETED" },
  phase2: { title: "Genesis II", status: "LIVE" },
  phase3: { title: "Genesis III", status: "LOCKED" },
};

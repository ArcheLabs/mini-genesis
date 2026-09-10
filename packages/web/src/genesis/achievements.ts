import type { GenesisAchievement } from "../config/manifest";

/** Historical Phase I outcomes. Statuses stay conservative until independently verified. */
export const genesisAchievements: readonly GenesisAchievement[] = [
  { id: "minijam-client", name: "MiniJAM Client", status: "delivered", summary: "New Stage-1 client generation delivered." },
  { id: "jamscript", name: "JamScript", status: "delivered", summary: "Developer tooling and language work delivered." },
  { id: "minicells", name: "MiniCells", status: "active", summary: "Active research, experiments, and prototypes." },
  { id: "jam-computer", name: "JAM Computer", status: "delivered", summary: "The JAM Computer workstream delivered." },
  { id: "jam-asset-center", name: "JAM Asset Center", status: "investigated", summary: "Asset infrastructure work remains tracked as an execution workstream." },
  { id: "ownership-abstraction", name: "Ownership Abstraction", status: "investigated", summary: "Ownership abstraction work remains tracked as an execution workstream." },
  { id: "zkjam", name: "ZkJAM", status: "discontinued", summary: "Investigated. The initial ZK direction was evaluated and later discontinued after feasibility work." },
];

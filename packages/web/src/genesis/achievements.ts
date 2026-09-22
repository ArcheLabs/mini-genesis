import { genesisPhase1ResearchHistory, genesisPhase1WorkItems } from "./work-items";

/**
 * Legacy export retained for consumers that still import `genesisAchievements`.
 * New UI code renders delivered outcomes and research history separately.
 */
export const genesisAchievements = genesisPhase1WorkItems;
export const genesisResearchHistory = genesisPhase1ResearchHistory;

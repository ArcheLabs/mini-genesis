import { streamPhaseName, streamPhaseNames, type StreamPhaseName } from "./stream-phase";

/** @deprecated Genesis product stages are defined in stages.ts; this is the Phase I stream state. */
export type PhaseName = StreamPhaseName;
export const phaseNames = streamPhaseNames;
export const phaseName = streamPhaseName;
export const phaseMessage: Record<PhaseName, { zh: string; en: string }> = {
  Waiting: { zh: "尚未启动", en: "Not started" },
  Contribution: { zh: "加入阶段", en: "Join pool" },
  Protection: { zh: "保护发放阶段", en: "Protection" },
  Ended: { zh: "已结束", en: "Ended" },
};

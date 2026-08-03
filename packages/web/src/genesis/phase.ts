export type PhaseName = "Waiting" | "Contribution" | "Protection" | "Ended";
export const phaseNames: readonly PhaseName[] = ["Waiting", "Contribution", "Protection", "Ended"];
export function phaseName(value: number | bigint): PhaseName { return phaseNames[Number(value)] ?? "Ended"; }
export const phaseMessage: Record<PhaseName, { zh: string; en: string }> = {
  Waiting: { zh: "尚未启动", en: "Not started" },
  Contribution: { zh: "加入阶段", en: "Join pool" },
  Protection: { zh: "保护发放阶段", en: "Protection" },
  Ended: { zh: "已结束", en: "Ended" },
};

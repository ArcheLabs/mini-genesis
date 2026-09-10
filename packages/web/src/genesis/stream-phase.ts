/** Phase names for the immutable MiniGenesisStream protocol. */
export type StreamPhaseName = "Waiting" | "Contribution" | "Protection" | "Ended";
export const streamPhaseNames: readonly StreamPhaseName[] = ["Waiting", "Contribution", "Protection", "Ended"];
export function streamPhaseName(value: number | bigint): StreamPhaseName {
  return streamPhaseNames[Number(value)] ?? "Ended";
}

export type GenesisStageId = "phase1" | "phase2" | "phase3";
export type AppRoute = GenesisStageId | "assets" | "native-signer-smoke";

const routeByHash: Record<string, AppRoute> = {
  "#/genesis/i": "phase1",
  "#/genesis/ii": "phase2",
  "#/genesis/iii": "phase3",
  "#/assets": "assets",
  "#/native-signer-smoke": "native-signer-smoke",
};

export function routeFromHash(hash: string, nativeSmokeEnabled = false): AppRoute {
  const route = routeByHash[hash];
  if (route === "native-signer-smoke" && !nativeSmokeEnabled) return "phase2";
  return route ?? "phase2";
}

export function hashForRoute(route: AppRoute): string {
  if (route === "phase1") return "#/genesis/i";
  if (route === "phase3") return "#/genesis/iii";
  if (route === "assets") return "#/assets";
  if (route === "native-signer-smoke") return "#/native-signer-smoke";
  return "#/genesis/ii";
}

export function canonicalizeHash(hash: string, nativeSmokeEnabled = false): string {
  const route = routeFromHash(hash, nativeSmokeEnabled);
  return hashForRoute(route);
}

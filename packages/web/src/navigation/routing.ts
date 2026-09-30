export type GenesisStageId = "phase1" | "phase2" | "phase3";
export type AppRoute = GenesisStageId | "assets";

const routeByHash: Record<string, AppRoute> = {
  "#/genesis/i": "phase1",
  "#/genesis/ii": "phase2",
  "#/genesis/iii": "phase3",
  "#/assets": "assets",
};

export function routeFromHash(hash: string): AppRoute {
  return routeByHash[hash] ?? "phase2";
}

export function hashForRoute(route: AppRoute): string {
  if (route === "phase1") return "#/genesis/i";
  if (route === "phase3") return "#/genesis/iii";
  if (route === "assets") return "#/assets";
  return "#/genesis/ii";
}

export function canonicalizeHash(hash: string): string {
  const route = routeFromHash(hash);
  return hashForRoute(route);
}

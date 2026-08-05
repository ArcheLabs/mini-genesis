export const REOWN_PROJECT_ID =
  "65fcb5a5788f31332af2ca9bfabf4699";

export function resolveReownProjectId(env: Record<string, string | undefined> = (import.meta as any).env): string {
  return env.VITE_REOWN_PROJECT_ID?.trim() || REOWN_PROJECT_ID;
}

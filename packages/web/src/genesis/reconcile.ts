import type { Address, PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { readGenesisUserState, type GenesisUser } from "./reads";

const RETRY_DELAYS_MS = [0, 500, 1_000, 1_500, 2_500, 4_000] as const;

function abortError(): Error { return new Error("OPERATION_CANCELLED"); }

export function waitForReconciliation(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { window.clearTimeout(timer); reject(abortError()); }, { once: true });
  });
}

export async function reconcileGenesisUserState(input: {
  client: PublicClient;
  manifest: DeploymentManifest;
  identity: Address;
  expectedContributedDot: bigint;
  signal?: AbortSignal;
  readUser?: typeof readGenesisUserState;
}): Promise<GenesisUser | null> {
  const readUser = input.readUser ?? readGenesisUserState;
  for (const delay of RETRY_DELAYS_MS) {
    if (input.signal?.aborted) throw abortError();
    if (delay) await waitForReconciliation(delay, input.signal);
    if (input.signal?.aborted) throw abortError();
    try {
      const user = await readUser(input.client, input.manifest, input.identity);
      if (user.contributedDot >= input.expectedContributedDot) return user;
    } catch {
      // EVM RPCs can briefly lag a finalized Substrate transaction. Retry within the bounded window.
    }
  }
  return null;
}

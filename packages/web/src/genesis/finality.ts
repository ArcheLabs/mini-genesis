import type { PublicClient } from "viem";

export class FinalityUnavailableError extends Error { constructor() { super("FINALITY_UNAVAILABLE"); } }
export async function finalizedBlock(client: PublicClient): Promise<bigint | null> {
  try { const result = await client.request({ method: "eth_getBlockByNumber", params: ["finalized", false] } as any) as { number?: string } | null; return result?.number ? BigInt(result.number) : null; } catch { return null; }
}
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms); const abort = () => { clearTimeout(timer); reject(new Error("OPERATION_CANCELLED")); };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function waitForFinality(client: PublicClient, receiptBlock: bigint, options: { timeoutMs?: number; pollMs?: number; signal?: AbortSignal } = {}): Promise<void> {
  const timeout = options.timeoutMs ?? 120_000; const poll = options.pollMs ?? 4_000; const deadline = Date.now() + timeout;
  if (options.signal?.aborted) throw new Error("OPERATION_CANCELLED");
  if ((await finalizedBlock(client)) === null) throw new FinalityUnavailableError();
  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new Error("OPERATION_CANCELLED");
    const head = await finalizedBlock(client); if (head !== null && head >= receiptBlock) return;
    await sleep(poll, options.signal);
  }
  throw new FinalityUnavailableError();
}

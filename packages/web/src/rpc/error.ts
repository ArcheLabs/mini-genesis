function collectCauses(error: unknown): unknown[] {
  const seen = new Set<unknown>();
  const queue: unknown[] = [error];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (typeof current === "object") {
      const candidate = current as { cause?: unknown };
      if (candidate.cause !== undefined) queue.push(candidate.cause);
    }
  }
  return Array.from(seen);
}

function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(value, 0);
  if (typeof value === "string") {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(seconds, 0) * 1_000;
  }
  return undefined;
}

function asHttpStatus(record: Record<string, unknown>): number | undefined {
  const error = record.error as Record<string, unknown> | undefined;
  const values = [record.status, record.statusCode, error?.status, error?.statusCode];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  }
  return undefined;
}

export function isRateLimitError(error: unknown): boolean {
  const sources = collectCauses(error);
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const record = source as Record<string, unknown>;
    const status = asHttpStatus(record);
    if (status === 429) return true;
    if (typeof record.message === "string" && /429|Too Many Requests/i.test(record.message)) return true;
  }
  return false;
}

export function getRetryAfterMs(error: unknown): number | undefined {
  const sources = collectCauses(error);
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const record = source as Record<string, unknown>;
    const headers = record.headers;
    const responseHeaders = (record.response as { headers?: { get?: (name: string) => string | null } } | undefined)?.headers;
    const candidates = [
      record.retryAfter,
      record.retryAfterMs,
      record["Retry-After"],
      headers && typeof headers === "object" && "retryAfter" in headers ? (headers as { retryAfter?: unknown }).retryAfter : undefined,
      headers && typeof headers === "object" && "Retry-After" in headers ? (headers as { "Retry-After"?: unknown })["Retry-After"] : undefined,
      responseHeaders && typeof responseHeaders.get === "function" ? responseHeaders.get("retry-after") : undefined,
      headers && typeof headers === "object" && typeof (headers as { get?: unknown }).get === "function" ? (headers as { get: (name: string) => string | null }).get("retry-after") : undefined,
    ];
    for (const candidate of candidates) {
      const parsed = parseRetryAfter(candidate);
      if (parsed !== undefined) return parsed;
    }
    if (typeof record.message === "string") {
      const match = record.message.match(/retry-after\s*[:=]\s*(\d+(?:\.\d+)?)/i);
      if (match) {
        const seconds = Number(match[1]);
        if (Number.isFinite(seconds)) return Math.max(seconds, 0) * 1_000;
      }
    }
  }
  return undefined;
}

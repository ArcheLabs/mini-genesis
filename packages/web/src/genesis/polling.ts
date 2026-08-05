export type PollOutcome =
  | { status: "success" }
  | { status: "error" }
  | { status: "rate_limited"; retryAfterMs?: number };

export type PollTask = () => Promise<PollOutcome>;

export type PollController = (() => void) & { retryNow: () => void };

export function startVisiblePolling(task: PollTask, intervalMs = 30_000, isHidden: () => boolean = () => document.hidden): PollController {
  let disposed = false;
  let inFlight = false;
  let paused = false;
  let consecutiveRateLimitCount = 0;
  let timer: number | undefined;
  let pausedAtMs = 0;

  const clearTimer = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  const schedule = (delayMs: number) => {
    if (disposed) return;
    clearTimer();
    timer = window.setTimeout(() => {
      void poll();
    }, delayMs);
  };

  const resumeAfterPause = () => {
    if (!paused || disposed) return;
    paused = false;
    consecutiveRateLimitCount = 0;
    if (!isHidden()) schedule(0);
  };

  const poll = async () => {
    if (disposed || inFlight || isHidden()) return;
    inFlight = true;
    try {
      const outcome = await task();
      if (outcome.status === "success") {
        paused = false;
        consecutiveRateLimitCount = 0;
        schedule(intervalMs);
        return;
      }
      if (outcome.status === "error") {
        paused = false;
        consecutiveRateLimitCount = 0;
        schedule(30_000);
        return;
      }

      const retryAfterMs = Math.max(outcome.retryAfterMs ?? 60_000, 60_000);
      if (consecutiveRateLimitCount === 0) {
        paused = false;
        consecutiveRateLimitCount = 1;
        schedule(retryAfterMs);
        return;
      }

      paused = true;
      pausedAtMs = Date.now();
      consecutiveRateLimitCount = 2;
      clearTimer();
    } finally {
      inFlight = false;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;
    if (paused && Date.now() - pausedAtMs >= 60_000) {
      resumeAfterPause();
      return;
    }
    if (!paused && !inFlight && !timer && !isHidden()) {
      void poll();
    }
  };

  const handleOnline = () => {
    if (paused && Date.now() - pausedAtMs >= 0) {
      resumeAfterPause();
      return;
    }
    if (!paused && !inFlight && !timer && !isHidden()) {
      void poll();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);

  const stop = (() => {
    disposed = true;
    clearTimer();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
  }) as PollController;

  stop.retryNow = () => {
    if (disposed) return;
    paused = false;
    consecutiveRateLimitCount = 0;
    if (!isHidden()) schedule(0);
  };

  void poll();
  return stop;
}

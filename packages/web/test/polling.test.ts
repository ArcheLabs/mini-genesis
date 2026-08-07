import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startVisiblePolling, type PollOutcome } from "../src/genesis/polling";

describe("visible polling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("uses a 30s default interval after success", async () => {
    const task = vi.fn<() => Promise<PollOutcome>>().mockResolvedValue({ status: "success" });
    const stop = startVisiblePolling(task, undefined, () => false);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("retryNow clears the pause and triggers an immediate retry", async () => {
    const task = vi.fn<() => Promise<PollOutcome>>()
      .mockResolvedValueOnce({ status: "rate_limited", retryAfterMs: 60_000 })
      .mockResolvedValue({ status: "success" });
    const stop = startVisiblePolling(task, 30_000, () => false);

    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);

    stop.retryNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("polls immediately and then waits 30s after success", async () => {
    const task = vi.fn<() => Promise<PollOutcome>>().mockResolvedValue({ status: "success" });
    const stop = startVisiblePolling(task, 30_000, () => false);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("waits 30s after a normal error", async () => {
    const task = vi.fn<() => Promise<PollOutcome>>().mockResolvedValueOnce({ status: "error" }).mockResolvedValue({ status: "success" });
    const stop = startVisiblePolling(task, 30_000, () => false);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("waits at least 60s after the first 429", async () => {
    const task = vi.fn<() => Promise<PollOutcome>>().mockResolvedValueOnce({ status: "rate_limited", retryAfterMs: 90_000 }).mockResolvedValue({ status: "success" });
    const stop = startVisiblePolling(task, 30_000, () => false);

    await vi.advanceTimersByTimeAsync(89_999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("pauses after two consecutive 429s", async () => {
    const task = vi.fn<() => Promise<PollOutcome>>().mockResolvedValueOnce({ status: "rate_limited", retryAfterMs: 60_000 }).mockResolvedValueOnce({ status: "rate_limited", retryAfterMs: 60_000 }).mockResolvedValue({ status: "success" });
    const stop = startVisiblePolling(task, 30_000, () => false);

    await vi.advanceTimersByTimeAsync(180_000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  it("resets the 429 counter after success", async () => {
    const task = vi.fn<() => Promise<PollOutcome>>()
      .mockResolvedValueOnce({ status: "rate_limited", retryAfterMs: 60_000 })
      .mockResolvedValueOnce({ status: "success" })
      .mockResolvedValueOnce({ status: "rate_limited", retryAfterMs: 60_000 })
      .mockResolvedValue({ status: "success" });
    const stop = startVisiblePolling(task, 30_000, () => false);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(task).toHaveBeenCalledTimes(3);
    stop();
  });

  it("does not overlap requests and cleans up on dispose", async () => {
    let active = 0;
    let maxActive = 0;
    const task = vi.fn(async (): Promise<PollOutcome> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return { status: "success" };
    });
    const stop = startVisiblePolling(task, 30_000, () => false);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(maxActive).toBe(1);
    expect(task).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("skips hidden polls and resumes on visibility change", async () => {
    let hidden = true;
    const task = vi.fn<() => Promise<PollOutcome>>().mockResolvedValue({ status: "success" });
    const stop = startVisiblePolling(task, 30_000, () => hidden);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(task).toHaveBeenCalledTimes(0);
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);
    stop();
  });

  it("app source keeps the 30s global poll and removes the fixed asset timer", () => {
    const src = readFileSync(resolve(__dirname, "../src.tsx"), "utf8");

    expect(src).toMatch(/startVisiblePolling\s*\(\s*async\s*\(\)\s*=>\s*refreshDynamic\(\)\s*\)/);
    expect(src).toContain("globalPollingRef");
    expect(src).toContain("controller.retryNow();");
    expect(src).not.toMatch(/setInterval\s*\(\s*\(\)\s*=>\s*void\s*loadUser\s*\(account\)/);
    expect(src).toContain("void loadUser(selectedContractAddress);");
    expect(src).toContain("void loadHistory(account);");
  });
});

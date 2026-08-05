import { beforeEach, describe, expect, it, vi } from "vitest";
import { startVisiblePolling } from "../src/genesis/polling";

describe("visible polling", () => {
  beforeEach(() => vi.useFakeTimers());
  it("polls immediately and at most once per interval", async () => {
    const task = vi.fn();
    const stop = startVisiblePolling(task, 6_000, () => false);
    expect(task).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6_000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(18_000);
    expect(task).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
  it("skips hidden polls and clears its interval on cleanup", () => {
    const task = vi.fn();
    let hidden = true;
    const stop = startVisiblePolling(task, 6_000, () => hidden);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(6_000);
    expect(task).not.toHaveBeenCalled();
    hidden = false;
    vi.advanceTimersByTime(6_000);
    expect(task).toHaveBeenCalledTimes(1);
    stop();
    vi.advanceTimersByTime(6_000);
    expect(task).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

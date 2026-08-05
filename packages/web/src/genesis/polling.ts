export type PollTask = () => void | Promise<void>;

export function startVisiblePolling(task: PollTask, intervalMs = 6_000, isHidden: () => boolean = () => document.hidden): () => void {
  let disposed = false;
  const poll = async () => {
    if (disposed || isHidden()) return;
    await task();
  };
  void poll();
  const timer = window.setInterval(() => { void poll(); }, intervalMs);
  return () => { disposed = true; window.clearInterval(timer); };
}

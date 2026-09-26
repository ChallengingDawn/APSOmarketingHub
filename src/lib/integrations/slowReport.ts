// Reports that take minutes, not milliseconds.
//
// Counting customer types means reading a year of order history: hundreds of
// throttled HubSpot searches. No request may wait that long, so the first
// caller starts the work and is told it is running, and a later caller gets the
// finished answer. One report is computed at a time — HubSpot's search limit
// punishes parallel bursts with 429s.
//
// The cache sits on globalThis on purpose: in development Next re-evaluates
// modules on every edit, and a module-level Map would lose a count that is
// minutes from finishing, so every poll would start it again and it would never
// land.

export type SlowState<T> = { value?: T; error?: string; computing: boolean; progress?: string };

type Entry = { at: number; value?: unknown; error?: string; running: boolean };
type Store = { entries: Map<string, Entry>; queue: Promise<unknown>; progress: Map<string, string> };

const store: Store = ((globalThis as { __apsoSlowReports?: Store }).__apsoSlowReports ??= {
  entries: new Map(),
  queue: Promise.resolve(),
  progress: new Map(),
});

/** Say what this report is doing right now; shown while it runs. */
export function reportProgress(key: string, text: string): void {
  store.progress.set(key, text);
}

/**
 * The state of one report, starting it when there is nothing fresh.
 * `ttlMs` is how long an answer stays good — these shapes move by the day.
 */
export function slowReport<T>(key: string, ttlMs: number, run: () => Promise<T>): SlowState<T> {
  const hit = store.entries.get(key);
  const fresh = hit?.value !== undefined && Date.now() - hit.at < ttlMs;

  if (!fresh && !hit?.running) {
    store.entries.set(key, { at: Date.now(), value: hit?.value, running: true });
    store.progress.set(key, "starting");
    store.queue = store.queue
      .catch(() => {})
      .then(() => run())
      .then((value) => { store.entries.set(key, { at: Date.now(), value, running: false }); })
      .catch((err: unknown) => {
        store.entries.set(key, {
          at: Date.now(),
          value: hit?.value,
          error: String((err as Error)?.message ?? err),
          running: false,
        });
      })
      .finally(() => { store.progress.delete(key); });
  }

  const now = store.entries.get(key);
  return {
    value: now?.value as T | undefined,
    error: now?.error,
    computing: Boolean(now?.running),
    progress: now?.running ? store.progress.get(key) : undefined,
  };
}

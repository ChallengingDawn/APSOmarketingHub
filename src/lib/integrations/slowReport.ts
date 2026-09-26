// Reports that take minutes, not milliseconds.
//
// Counting customer types means reading a year of order history: hundreds of
// throttled HubSpot searches. No request may wait that long, so the first
// caller starts the work and is told it is running, and a later caller gets the
// finished answer.
//
// The answer is kept in Postgres, not only in memory, for two reasons that both
// bit us on AWS: a deployment restarts the container and would throw away a
// count that was minutes from finishing, and the service can run more than one
// task behind the load balancer, so the browser that starts a count is often
// not talking to the task that finishes it. A shared table makes a finished
// count visible to every task and to every later deployment.
//
// Only aggregates are stored — counts per month and per type. No customer,
// no company, no order id.

import { query } from "@/lib/db/client";

export type SlowState<T> = { value?: T; error?: string; computing: boolean; progress?: string; computedAt?: string };

type Entry = { at: number; value?: unknown; error?: string; running: boolean };
type Store = { entries: Map<string, Entry>; queue: Promise<unknown>; progress: Map<string, string> };

// On globalThis: in development Next re-evaluates modules on every edit, and a
// module-level Map would lose a count that is minutes from finishing.
const store: Store = ((globalThis as { __apsoSlowReports?: Store }).__apsoSlowReports ??= {
  entries: new Map(),
  queue: Promise.resolve(),
  progress: new Map(),
});

const ROW = (key: string) => `slow_report:${key}`;
/**
 * A running count writes a heartbeat as it works. If the heartbeat stops for
 * this long the count is assumed dead and another task may take over. It has to
 * be short: every deployment kills whatever was counting, and until the lock
 * expires nobody else starts — which looks exactly like "still counting" to the
 * person watching the page.
 */
const HEARTBEAT_STALE_MS = 3 * 60 * 1000;
/** Writing the heartbeat on every batch would be hundreds of writes per count. */
const HEARTBEAT_EVERY_MS = 15 * 1000;

type Persisted = {
  value?: unknown;
  error?: string;
  computedAt?: string;
  startedAt?: string;
  beatAt?: string;
  progress?: string;
  running?: boolean;
};

async function readRow(key: string): Promise<Persisted | null> {
  try {
    const res = await query<{ v: Persisted }>("SELECT v FROM apsomh_kv WHERE k = $1", [ROW(key)]);
    return res.rows[0]?.v ?? null;
  } catch {
    return null;                                  // no database on this machine: memory still works
  }
}

async function writeRow(key: string, value: Persisted): Promise<void> {
  try {
    await query(
      `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
      [ROW(key), JSON.stringify(value)],
    );
  } catch {
    /* the answer still serves from memory */
  }
}

const lastBeat = new Map<string, number>();

/** Say what this report is doing right now; shown while it runs, on any task. */
export function reportProgress(key: string, text: string): void {
  store.progress.set(key, text);
  // The heartbeat proves the count is alive and carries the progress line to the
  // other tasks, but it is written at most every 15 seconds.
  const now = Date.now();
  if (now - (lastBeat.get(key) ?? 0) < HEARTBEAT_EVERY_MS) return;
  lastBeat.set(key, now);
  void writeRow(key, {
    running: true,
    startedAt: new Date(now).toISOString(),
    beatAt: new Date(now).toISOString(),
    progress: text,
    value: store.entries.get(key)?.value,
  });
}

/**
 * The state of one report, starting it when nothing fresh exists anywhere.
 * `ttlMs` is how long an answer stays good — these shapes move by the day.
 */
export async function slowReport<T>(key: string, ttlMs: number, run: () => Promise<T>): Promise<SlowState<T>> {
  const local = store.entries.get(key);
  const localFresh = local?.value !== undefined && Date.now() - local.at < ttlMs;
  if (localFresh) {
    return { value: local!.value as T, error: local!.error, computing: Boolean(local!.running), progress: store.progress.get(key) };
  }

  const saved = await readRow(key);
  const savedAt = saved?.computedAt ? Date.parse(saved.computedAt) : 0;
  const savedFresh = saved?.value !== undefined && Date.now() - savedAt < ttlMs;
  if (savedFresh) {
    store.entries.set(key, { at: savedAt, value: saved!.value, running: false });
    return { value: saved!.value as T, computing: false, computedAt: saved!.computedAt };
  }

  // Is someone else already counting this? Only if their heartbeat is recent —
  // a task killed by a deployment leaves running=true behind, and treating that
  // as live would block every other task from ever finishing the count.
  const beatAt = Date.parse(saved?.beatAt ?? saved?.startedAt ?? "") || 0;
  const someoneElseRunning = Boolean(saved?.running) && Date.now() - beatAt < HEARTBEAT_STALE_MS;

  if (!local?.running && !someoneElseRunning) {
    store.entries.set(key, { at: Date.now(), value: saved?.value ?? local?.value, running: true });
    store.progress.set(key, "starting");
    const startedNow = new Date().toISOString();
    void writeRow(key, { running: true, startedAt: startedNow, beatAt: startedNow, value: saved?.value });
    store.queue = store.queue
      .catch(() => {})
      .then(() => run())
      .then(async (value) => {
        const computedAt = new Date().toISOString();
        store.entries.set(key, { at: Date.now(), value, running: false });
        await writeRow(key, { value, computedAt, running: false });
      })
      .catch(async (err: unknown) => {
        const error = String((err as Error)?.message ?? err);
        store.entries.set(key, { at: Date.now(), value: saved?.value ?? local?.value, error, running: false });
        await writeRow(key, { value: saved?.value, error, running: false, computedAt: saved?.computedAt });
      })
      .finally(() => { store.progress.delete(key); });
  }

  const now = store.entries.get(key);
  const running = Boolean(now?.running) || someoneElseRunning;
  return {
    value: (now?.value ?? saved?.value) as T | undefined,
    error: now?.error ?? saved?.error,
    computing: running,
    progress: running ? store.progress.get(key) ?? saved?.progress ?? "counting on another instance" : undefined,
    computedAt: saved?.computedAt,
  };
}

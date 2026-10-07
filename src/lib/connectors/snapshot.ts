// The Compass connector's status as the hub reads it - the shapes and the few
// verdicts the pages draw. Pure, so the pages can use it; the reading itself is
// in src/lib/integrations/compassConnector.ts (server only).
//
// Two things the connector does not keep, so the hub works them out:
//   - the last DELIVERY: its "last run" record is overwritten by every 30-minute
//     check (the company and ticket sweeps run on each), so a morning's files
//     vanish from it within half an hour. The files' own arrival times say it.
//   - each step's LAST RESULT: for the same reason most steps are missing from
//     the latest record; the hub remembers each one when it sees it (stepsLast).

export type DeltaRun = { done?: number; total?: number; status?: string; ts?: number } | null;
export type ChainStatus = { delta_run?: DeltaRun; sftp_last_ts?: number | null; sftp_pulled?: number };
export type StepResult = { step: string; result?: Record<string, unknown> | null; error?: string };
export type Pulled = { remote: string; as: string; mb: number };
export type SftpReport = { pulled?: Pulled[]; skipped?: number; renamed?: Record<string, string>; ts?: number; error?: string; processing?: StepResult[] };
export type ReviewItem = {
  type?: string; un?: string; status?: string; revenue_eur?: number; years?: (string | number)[];
  ts?: number; note?: string; resolved_un?: string; name?: string;
};
export type RawState = {
  last_run?: { mode?: string; started?: number; finished?: number; phases?: { phase: string; rows: number | string; ts: number }[] };
  sftp?: { last?: SftpReport; last_processing?: SftpReport; history?: { ts: number; pulled: number; steps: number; error?: string | null }[]; host?: string; dir?: string };
  kpis?: Record<string, string | number>;
  review_queue?: ReviewItem[];
  progress?: Record<string, unknown>;
  watermarks?: Record<string, unknown>;
  orders_daily?: Record<string, unknown>;
};
export type IncomingFile = { name: string; size: number; uploaded: string };

/** A step's latest result as the hub last saw it (epoch seconds). */
export type StepMemo = { at: number; result?: Record<string, unknown> | null; error?: string };

export type Snapshot = {
  at: string;
  chain: ChainStatus | null;
  chainError: string | null;
  /** null when the read key cannot open /state yet. */
  state: Omit<RawState, "review_queue"> | null;
  stateError: string | null;
  review: { pending: number; resolved: number; total: number; items: ReviewItem[] } | null;
  files: IncomingFile[] | null;
  /** Can the hub itself reach the ERP's SFTP server (TCP + SSH greeting, no login)? */
  sftpFromHub?: { ok: boolean; banner?: string; error?: string; ms: number };
  /** Every step's latest result, remembered by the hub across the connector's checks. */
  stepsLast?: Record<string, StepMemo>;
};

/** "2026-10-07 05:41:10" (the connector's clock, UTC) -> epoch seconds. */
export function fileTime(f: IncomingFile): number | null {
  const t = Date.parse(f.uploaded.replace(" ", "T") + "Z");
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/** The last delivery: when the newest ERP file arrived, and how many arrived within 3 hours of it. */
export function lastDelivery(s: Snapshot): { at: number | null; files: number } {
  const times = (s.files ?? []).filter((f) => !f.name.endsWith(".part")).map(fileTime).filter((t): t is number => t !== null);
  if (!times.length) return { at: null, files: 0 };
  const at = Math.max(...times);
  return { at, files: times.filter((t) => at - t <= 3 * 3600).length };
}

/** Each step's latest result: what the hub remembers, else what the last check reported. */
export function stepResults(s: Snapshot): Map<string, StepMemo> {
  const out = new Map<string, StepMemo>(Object.entries(s.stepsLast ?? {}));
  const proc = s.state?.sftp?.last_processing;
  for (const x of proc?.processing ?? []) {
    const at = proc?.ts ?? 0;
    const have = out.get(x.step);
    if (!have || have.at <= at) out.set(x.step, { at, result: x.result, error: x.error });
  }
  return out;
}

/** The chain as one verdict for a tile: running, stuck, failed steps in the last day, done, or unknown. */
export function chainVerdict(s: Snapshot, now = Date.now()): { tone: "good" | "warn" | "bad" | "unknown"; label: string; at: number | null; failed: string[] } {
  const run = s.chain?.delta_run ?? null;
  const results = stepResults(s);
  const failed = [...results.entries()].filter(([, m]) => m.error && now / 1000 - m.at < 36 * 3600).map(([k]) => k);
  const at = run?.ts ?? s.state?.sftp?.last_processing?.ts ?? null;
  if (!run && !results.size) return { tone: "unknown", label: "No run seen", at: null, failed };
  if (run?.status?.startsWith("running")) {
    // a restart mid-chain leaves "running" behind - after 3 hours it is not running
    const stale = at !== null && now / 1000 - at > 3 * 3600;
    return stale ? { tone: "bad", label: `Stuck at ${run.status.slice(9)}`, at, failed } : { tone: "warn", label: `Running: ${run.status.slice(9)}`, at, failed };
  }
  if (failed.length) return { tone: "bad", label: `${failed.length} step${failed.length > 1 ? "s" : ""} failed`, at, failed };
  return { tone: "good", label: "Done", at, failed };
}

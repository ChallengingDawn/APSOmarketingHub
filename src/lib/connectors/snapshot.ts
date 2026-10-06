// The Compass connector's status as the hub reads it - the shapes and the one
// verdict a tile draws. Pure, so the pages can use it; the reading itself is in
// src/lib/integrations/compassConnector.ts (server only).

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
};

/** The chain as one verdict for a tile: running, done today, done earlier, failed steps, or unknown. */
export function chainVerdict(s: Snapshot, now = Date.now()): { tone: "good" | "warn" | "bad" | "unknown"; label: string; at: number | null } {
  const run = s.chain?.delta_run ?? null;
  const steps = s.state?.sftp?.last_processing?.processing ?? [];
  const failed = steps.filter((x) => x.error).length;
  const at = run?.ts ?? s.state?.sftp?.last_processing?.ts ?? null;
  if (!run && !steps.length) return { tone: "unknown", label: "No run seen", at: null };
  if (run?.status?.startsWith("running")) {
    // a restart mid-chain leaves "running" behind - after 3 hours it is not running
    const stale = at !== null && now / 1000 - at > 3 * 3600;
    return stale ? { tone: "bad", label: `Stuck at ${run.status.slice(9)}`, at } : { tone: "warn", label: `Running: ${run.status.slice(9)}`, at };
  }
  if (failed) return { tone: "bad", label: `${failed} step${failed > 1 ? "s" : ""} failed`, at };
  return { tone: "good", label: "Done", at };
}

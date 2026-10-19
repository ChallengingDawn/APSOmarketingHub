// ONE HUBSPOT SEARCH QUEUE FOR THE WHOLE HUB - the database half (SARCLA 19.10.2026: "one search queue for the whole
// hub, kept in the shared database, so both servers together stay under the limit"). Server only: it holds the
// Postgres client, which must never reach a browser bundle (src/lib/integrations/hubspot.ts is imported by pages too,
// so it only knows this queue through globalThis). instrumentation.ts installs it when a server copy starts.
//
// A search books the next free slot in one row - on the database's clock, so both copies of the hub agree:
//   next_at = max(next_at, now) + 300 ms, and the caller waits until its slot (the old next_at, or now).
// A 429 pushes next_at past the pause HubSpot asked for, so every search of the hub waits, not just the refused one.

import { query } from "../db/client";

const SHARED_INTERVAL_MS = 300;              // the whole hub, both copies together (HubSpot allows 5 a second per app)

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  ready ??= query(`CREATE TABLE IF NOT EXISTS apsomh_hubspot_pace (k text PRIMARY KEY, next_at timestamptz NOT NULL)`)
    .then(() => undefined).catch((e: unknown) => { ready = null; throw e; });
  return ready;
}

/** Book the next free search slot for the whole hub; how long to wait for it, in ms. */
async function wait(): Promise<number> {
  await ensure();
  const r = await query<{ wait_ms: string }>(
    `INSERT INTO apsomh_hubspot_pace (k, next_at) VALUES ('search', clock_timestamp() + $1 * interval '1 millisecond')
     ON CONFLICT (k) DO UPDATE SET next_at = GREATEST(apsomh_hubspot_pace.next_at, clock_timestamp()) + $1 * interval '1 millisecond'
     RETURNING (EXTRACT(EPOCH FROM (next_at - clock_timestamp())) * 1000) - $1 AS wait_ms`, [SHARED_INTERVAL_MS]);
  return Math.max(0, Number(r.rows[0]?.wait_ms ?? 0));
}

/** HubSpot said "secondly limit": no search of the hub before this pause is over. */
async function backoff(ms: number): Promise<void> {
  await ensure();
  await query(`UPDATE apsomh_hubspot_pace SET next_at = GREATEST(next_at, clock_timestamp() + $1 * interval '1 millisecond') WHERE k = 'search'`, [Math.round(ms)]);
}

export type SharedSearchQueue = { wait: () => Promise<number>; backoff: (ms: number) => Promise<void> };

/** Make this server copy's HubSpot searches go through the shared queue (instrumentation.ts, at start). */
export function installSharedSearchQueue(): void {
  (globalThis as { __apsoSearchQueue?: SharedSearchQueue }).__apsoSearchQueue = { wait, backoff };
  console.log("[hubspot] searches paced through the shared queue (the whole hub, 300 ms apart)");
}

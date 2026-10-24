// THE CHAT LOG, COPIED TO AWS (SARCLA 24.10.2026: "I would prefer to have a db on AWS instead of railway but we
// should not lose any data at the migration"). The orchestrator stays on Railway - HubSpot's bot has to reach it -
// and so does its working database. What only that database held is the chat log: one row per message, with the
// language, category, hand-over, ticket and the AI's own trace, and no message text by design (GDPR); the
// conversations themselves are in HubSpot. That log is copied here, whole, and kept current.
//
// conversation_logs is append-only (the orchestrator never updates or deletes a row) and its id is a UUID, so it is
// read in started_at order (now() when the row is written) with the id as the tie-break, page by page on the
// orchestrator's exact cursor. Each run starts 15 minutes before the newest row held, so a row whose transaction
// committed a moment after a later one is still picked up; a row already held is left as it is. The orchestrator's
// own count beside the hub's proves the copy is whole - the Setup tab shows both. A column the hub does not know
// lands in `extra`, so a new one is never dropped.
// Every 5 minutes, at most 6 pages of 1,000 a run, 3 s apart: the orchestrator allows 30 calls a minute and the
// chat page uses the same allowance, so the first run's backfill is spread over a few runs instead.

import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { orchestrator, orchestratorKey } from "./orchestrator";

const TABLE = "apsomh_chat_log";
const LOCK = 4_107_240;                     // 4107201 … 4_107_234 are taken (DoC, partner stock, chat filing, f5's)
const TICK_MS = 5 * 60_000;
const PAGE = 1000;
const PAGES_PER_RUN = 6;
const OVERLAP_MS = 15 * 60_000;
const KV_RUN = "chat:logcopy:last";
const KNOWN = [
  "id", "session_hash", "hubspot_contact_id", "region_id", "language_code", "category_code", "sub_l1", "sub_l2",
  "routing_team", "escalated", "escalation_reason", "hubspot_ticket_id", "turns_count", "started_at", "debug_log", "handler",
] as const;

type Row = Record<string, unknown> & { id: string; _cursor_at?: string };
type Page = { rows: Row[]; total: number; last_at: string | null };
export type LogCopyRun = {
  at: string; ok: boolean; copied: number;
  held: number; heldLastAt: string | null;    // here, on AWS
  source: number; sourceLastAt: string | null; // the orchestrator's own count, read in the same run
  complete: boolean; error?: string;
};

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  ready ??= (async () => {
    await query(`CREATE TABLE IF NOT EXISTS ${TABLE} (
      id text PRIMARY KEY, session_hash text NOT NULL, hubspot_contact_id text, region_id integer,
      language_code text, category_code text, sub_l1 text, sub_l2 text, routing_team text,
      escalated boolean NOT NULL DEFAULT false, escalation_reason text, hubspot_ticket_id text, turns_count integer,
      started_at timestamptz NOT NULL, debug_log text, handler text, extra jsonb,
      copied_at timestamptz NOT NULL DEFAULT now())`);
    await query(`CREATE INDEX IF NOT EXISTS ${TABLE}_session ON ${TABLE} (session_hash)`);
    await query(`CREATE INDEX IF NOT EXISTS ${TABLE}_started ON ${TABLE} (started_at)`);
  })().catch((e: unknown) => { ready = null; throw e; });
  return ready;
}

async function heldNow(): Promise<{ held: number; heldLastAt: string | null }> {
  const r = (await query<{ n: string; m: Date | string | null }>(`SELECT count(*) AS n, max(started_at) AS m FROM ${TABLE}`)).rows[0];
  const m = r?.m ? new Date(r.m).toISOString() : null;
  return { held: Number(r?.n ?? 0), heldLastAt: m };   // pg answers count as text
}

/** One page into the table; a row already held is left as it is. How many were new. */
async function insert(rows: Row[]): Promise<number> {
  const cols = [...KNOWN, "extra"];
  const vals: unknown[] = [];
  const tuples = rows.map((r, i) => {
    const extra = Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_") && !(KNOWN as readonly string[]).includes(k)));
    for (const c of KNOWN) vals.push(c === "escalated" ? r[c] === true : c === "id" ? String(r.id) : (r[c] ?? null));
    vals.push(Object.keys(extra).length ? JSON.stringify(extra) : null);
    return `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(",")})`;
  });
  const got = await query<{ id: string }>(
    `INSERT INTO ${TABLE} (${cols.join(",")}) VALUES ${tuples.join(",")} ON CONFLICT (id) DO NOTHING RETURNING id`, vals);
  return got.rows.length;
}

async function run(pages: number): Promise<LogCopyRun> {
  await ensure();
  const start = await heldNow();
  let at = start.heldLastAt ? new Date(Date.parse(start.heldLastAt) - OVERLAP_MS).toISOString() : "1970-01-01T00:00:00Z";
  let id = "";
  let copied = 0, source = 0, sourceLastAt: string | null = null;
  for (let i = 0; i < pages; i++) {
    if (i) await new Promise((r) => setTimeout(r, 3_000));
    const p = await orchestrator<Page>(
      `/dashboard/logs?after_at=${encodeURIComponent(at)}&after_id=${encodeURIComponent(id)}&limit=${PAGE}`, { timeoutMs: 40_000 });
    source = Number(p.total);
    sourceLastAt = p.last_at ? new Date(p.last_at).toISOString() : null;
    if (!Array.isArray(p.rows) || !p.rows.length) break;
    copied += await insert(p.rows);
    const last = p.rows[p.rows.length - 1];
    if (!last._cursor_at) throw new Error("The orchestrator's page has no cursor (an older /dashboard/logs)");
    at = last._cursor_at; id = String(last.id);
    if (p.rows.length < PAGE) break;
  }
  const { held, heldLastAt } = await heldNow();
  return { at: new Date().toISOString(), ok: true, copied, held, heldLastAt, source, sourceLastAt, complete: held === source };
}

/** One run under the lock; null when another copy of the hub is running it. */
async function locked(pages: number): Promise<LogCopyRun | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      const r = await run(pages).catch((e: unknown): LogCopyRun => ({
        at: new Date().toISOString(), ok: false, copied: 0, held: 0, heldLastAt: null, source: 0, sourceLastAt: null,
        complete: false, error: String((e as Error)?.message ?? e),
      }));
      await kvSet(KV_RUN, r).catch(() => {});
      return r;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false;
export function startChatLogCopy(): void {
  if (started || String(process.env.CHAT_LOG_COPY ?? "").toLowerCase() === "off") return;
  started = true;
  console.log("[chat-log] on: the orchestrator's chat log copied to the hub's database every 5 min");
  const tick = async () => {
    if (!orchestratorKey()) return;
    const r = await locked(PAGES_PER_RUN).catch(() => null);
    if (r && (r.copied || !r.ok)) {
      console.log(`[chat-log] ${r.ok ? `${r.copied} copied · ${r.held} held · orchestrator ${r.source}${r.complete ? " · complete" : ""}` : `failed: ${r.error}`}`);
    }
  };
  setInterval(() => void tick(), TICK_MS).unref?.();
  setTimeout(() => void tick(), 3 * 60_000).unref?.();   // after the boot rush
}

/** The Setup tab: the last run, and what is held right now. */
export async function logCopyState(): Promise<{ last: LogCopyRun | null; held: number; heldLastAt: string | null }> {
  await ensure();
  const [last, now] = await Promise.all([kvGet<LogCopyRun>(KV_RUN).catch(() => null), heldNow()]);
  return { last: last ?? null, ...now };
}

/** The tab's "Copy now" (admins): the same run, under the same lock. */
export async function copyNow(): Promise<LogCopyRun> {
  const r = await locked(PAGES_PER_RUN);
  return r ?? { at: new Date().toISOString(), ok: false, copied: 0, held: 0, heldLastAt: null, source: 0, sourceLastAt: null,
    complete: false, error: "A copy is running right now - try again in a minute." };
}

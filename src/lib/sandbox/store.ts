// THE SANDBOX'S OWN BOOKKEEPING - what it was given (replay), what it still lacks (misses), what it would have written
// to HubSpot, and the asks from the CLI. Server only, and only ever on the sandbox's own database: every statement
// here goes straight to the pool, past the replay hook in db/client.ts.

import { getPool } from "../db/client";
import { isSandbox } from "./mode";
import { looksLikeHubDatabase } from "./jobs";

export type MissKind = "hs" | "sql";
export type HsRequest = { method: string; url: string; body: unknown };
export type SqlRequest = { text: string; params: unknown[] };
export type Miss = { key: string; kind: MissKind; request: HsRequest | SqlRequest; state: string; hits: number; last_at: string };

const pool = () => getPool();

let ready: Promise<void> | null = null;
export function ensureSandboxTables(): Promise<void> {
  ready ??= (async () => {
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS sandbox_marker (k text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())`);
    await p.query(`CREATE TABLE IF NOT EXISTS sandbox_replay (key text PRIMARY KEY, kind text NOT NULL, request jsonb NOT NULL,
      response jsonb NOT NULL, brought_at timestamptz NOT NULL DEFAULT now())`);
    await p.query(`CREATE TABLE IF NOT EXISTS sandbox_misses (key text PRIMARY KEY, kind text NOT NULL, request jsonb NOT NULL,
      state text NOT NULL DEFAULT 'new', hits int NOT NULL DEFAULT 1, note text,
      first_at timestamptz NOT NULL DEFAULT now(), last_at timestamptz NOT NULL DEFAULT now(), asked_at timestamptz)`);
    await p.query(`CREATE TABLE IF NOT EXISTS sandbox_would_write (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
      method text NOT NULL, url text NOT NULL, body jsonb)`);
    await p.query(`CREATE TABLE IF NOT EXISTS sandbox_asks (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
      by_user text NOT NULL, spec jsonb NOT NULL, reason text NOT NULL DEFAULT '', state text NOT NULL DEFAULT 'new',
      note text, asked_at timestamptz, answered_at timestamptz)`);
    // an answered ask points at its replay row, so the CLI can fetch what it asked for
    await p.query(`ALTER TABLE sandbox_asks ADD COLUMN IF NOT EXISTS answer_key text`);
    // "send to review" from the CLI: the hub mails it to the reviewer on its next round
    await p.query(`CREATE TABLE IF NOT EXISTS sandbox_reviews (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
      by_user text NOT NULL, title text NOT NULL, summary text NOT NULL DEFAULT '', base text, preview_url text,
      files jsonb NOT NULL DEFAULT '[]', patch text NOT NULL DEFAULT '', state text NOT NULL DEFAULT 'new', sent_at timestamptz)`);
    // the CLI's sign-in codes, kept until the CLI collects its token
    await p.query(`CREATE TABLE IF NOT EXISTS sandbox_cli (k text PRIMARY KEY, v text NOT NULL, at timestamptz NOT NULL DEFAULT now())`);
  })().catch((e: unknown) => { ready = null; throw e; });
  return ready;
}

/** Written once by startSandbox: Delete all runs only on a database that carries it. */
export async function markSandboxDatabase(): Promise<void> {
  await ensureSandboxTables();
  await pool().query(`INSERT INTO sandbox_marker (k) VALUES ('sandbox') ON CONFLICT (k) DO NOTHING`);
}

export async function replayed(key: string): Promise<unknown | undefined> {
  await ensureSandboxTables();
  const r = await pool().query<{ response: unknown }>(`SELECT response FROM sandbox_replay WHERE key = $1`, [key]);
  return r.rows[0]?.response;
}

/** A read the sandbox could not answer. A refused one stays refused (with the hub's reason) until Delete all. */
export async function noteMiss(kind: MissKind, key: string, request: HsRequest | SqlRequest): Promise<void> {
  await ensureSandboxTables();
  await pool().query(
    `INSERT INTO sandbox_misses (key, kind, request) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET hits = sandbox_misses.hits + 1, last_at = now(),
       state = CASE WHEN sandbox_misses.state = 'answered' THEN 'new' ELSE sandbox_misses.state END`,
    [key, kind, JSON.stringify(request)],
  );
}

export async function noteWouldWrite(method: string, url: string, body: unknown): Promise<void> {
  await ensureSandboxTables();
  await pool().query(`INSERT INTO sandbox_would_write (method, url, body) VALUES ($1, $2, $3)`,
    [method, url, JSON.stringify(body ?? null)]);
}

export type Replay = { key: string; kind: string; request: unknown; response: unknown };

/**
 * What the hub brought, oldest first, after a point - what the sandbox on someone's computer copies down from its relay
 * (`npm run sbx -- dev`). The point is the last row's time, to the microsecond, and its key: one delivery writes all its
 * rows at the same time, and an answer brought again moves to the end, so it is copied down again.
 */
export async function replaysAfter(after: string | null, limit = 200): Promise<{ rows: Replay[]; next: string | null; more: boolean }> {
  await ensureSandboxTables();
  let at = "-infinity", key = "";
  if (after) {
    try {
      const p = JSON.parse(Buffer.from(after, "base64url").toString("utf8")) as unknown;
      if (Array.isArray(p) && typeof p[0] === "string" && typeof p[1] === "string") [at, key] = p as [string, string];
    } catch { /* an unreadable point starts from the beginning */ }
  }
  const r = await pool().query<Replay & { at: string }>(
    `SELECT key, kind, request, response, to_char(brought_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
     FROM sandbox_replay WHERE (brought_at, key) > ($1::timestamptz, $2) ORDER BY brought_at, key LIMIT $3`, [at, key, limit]);
  const last = r.rows.at(-1);
  return {
    rows: r.rows.map(({ key: k, kind, request, response }) => ({ key: k, kind, request, response })),
    next: last ? Buffer.from(JSON.stringify([last.at, last.key])).toString("base64url") : after,
    more: r.rows.length === limit,
  };
}

/** The reads the hub refused, with its reason - so a computer stops asking for them too. */
export async function refusedMisses(): Promise<{ key: string; note: string }[]> {
  await ensureSandboxTables();
  const r = await pool().query<{ key: string; note: string | null }>(`SELECT key, note FROM sandbox_misses WHERE state = 'refused' ORDER BY key LIMIT 1000`);
  return r.rows.map((x) => ({ key: x.key, note: x.note ?? "refused by the hub" }));
}

/** Once the sandbox writes a table itself, that table is the sandbox's: the hub's replayed reads of it step aside. */
export async function dropReplaysOf(table: string): Promise<void> {
  await ensureSandboxTables();
  await pool().query(`DELETE FROM sandbox_replay WHERE kind = 'sql' AND request->>'text' ILIKE $1`, [`%${table}%`]);
}

// What the sandbox holds and what waits. Nothing here asks the hub for anything: the reads and the CLI's asks wait
// until somebody brings them from the hub's Sandbox app (SARCLA 26.10.2026: the hub is the front end for pulling data;
// the sandbox cannot reach the hub, and the decision to let data out belongs on the hub, behind its TOTP and its log).
export type SandboxState = { missing: number; refused: number; brought: number; wouldWrite: number; asks: number };

export async function sandboxState(): Promise<SandboxState> {
  await ensureSandboxTables();
  const r = await pool().query<Record<string, string>>(`SELECT
      (SELECT count(*) FROM sandbox_misses WHERE state = 'new') AS missing,
      (SELECT count(*) FROM sandbox_misses WHERE state = 'refused') AS refused,
      (SELECT count(*) FROM sandbox_replay) AS brought,
      (SELECT count(*) FROM sandbox_would_write) AS would_write,
      (SELECT count(*) FROM sandbox_asks WHERE state = 'new') AS asks`);
  const x = r.rows[0] ?? {};
  return {
    missing: Number(x.missing ?? 0), refused: Number(x.refused ?? 0), brought: Number(x.brought ?? 0),
    wouldWrite: Number(x.would_write ?? 0), asks: Number(x.asks ?? 0),
  };
}

// Delete all keeps the logins - the sandbox's own users, sessions and grants, and in the key store only their
// invitations and recovery codes - plus the CLI's sign-in codes, the reviews already sent and the code `sbx pull` hands
// out. Everything else in the database is the sandbox's data and goes.
export const KEEP_TABLES = ["apsomh_users", "apsomh_sessions", "apsomh_user_app_access", "sandbox_marker", "sandbox_cli", "sandbox_reviews", "sandbox_snapshot"] as const;
export const KEEP_KV_PREFIXES = ["invite:", "recovery:"] as const;

/** The tables Delete all empties: every table of the database but the kept ones (and the key store, done apart). */
export function tablesToEmpty(all: string[]): string[] {
  return all.filter((t) => !(KEEP_TABLES as readonly string[]).includes(t) && t !== "apsomh_kv").sort();
}

/**
 * Delete all - three locks, all on this side: the copy runs as the sandbox, its database is not the hub's, and the
 * database carries the sandbox marker (written by startSandbox, never by the hub).
 */
export async function deleteAll(): Promise<{ tables: number }> {
  if (!isSandbox()) throw new Error("Delete all exists only in the sandbox");
  if (looksLikeHubDatabase(process.env)) throw new Error("this is the hub's database - refused");
  await ensureSandboxTables();
  const p = pool();
  const marked = await p.query(`SELECT 1 FROM sandbox_marker WHERE k = 'sandbox'`);
  if (!marked.rowCount) throw new Error("this database carries no sandbox marker - refused");
  const all = await p.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  const tables = tablesToEmpty(all.rows.map((r) => r.tablename));
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    if (tables.length) await client.query(`TRUNCATE ${tables.map((t) => `"${t.replace(/"/g, '""')}"`).join(", ")} RESTART IDENTITY`);
    if (all.rows.some((r) => r.tablename === "apsomh_kv")) {
      await client.query(`DELETE FROM apsomh_kv WHERE NOT (${KEEP_KV_PREFIXES.map((_, i) => `k LIKE $${i + 1}`).join(" OR ")})`,
        KEEP_KV_PREFIXES.map((x) => `${x}%`));
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return { tables: tables.length };
}

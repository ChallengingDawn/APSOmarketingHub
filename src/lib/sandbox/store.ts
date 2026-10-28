// THE SANDBOX'S OWN BOOKKEEPING - what it would have written to HubSpot (held back, never sent), and Delete all. Server
// only, and only ever on the sandbox's own database (PGlite on the person's computer, started by `npm run sandbox`).

import { getPool } from "../db/client";
import { isSandbox } from "./mode";
import { looksLikeHubDatabase } from "./jobs";

const pool = () => getPool();

let ready: Promise<void> | null = null;
export function ensureSandboxTables(): Promise<void> {
  ready ??= (async () => {
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS sandbox_marker (k text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())`);
    await p.query(`CREATE TABLE IF NOT EXISTS sandbox_would_write (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
      method text NOT NULL, url text NOT NULL, body jsonb)`);
  })().catch((e: unknown) => { ready = null; throw e; });
  return ready;
}

/** Written once by startSandbox: Delete all runs only on a database that carries it. */
export async function markSandboxDatabase(): Promise<void> {
  await ensureSandboxTables();
  await pool().query(`INSERT INTO sandbox_marker (k) VALUES ('sandbox') ON CONFLICT (k) DO NOTHING`);
}

export async function noteWouldWrite(method: string, url: string, body: unknown): Promise<void> {
  await ensureSandboxTables();
  await pool().query(`INSERT INTO sandbox_would_write (method, url, body) VALUES ($1, $2, $3)`,
    [method, url, JSON.stringify(body ?? null)]);
}

export type SandboxState = { wouldWrite: number };

export async function sandboxState(): Promise<SandboxState> {
  await ensureSandboxTables();
  const r = await pool().query<{ n: string }>(`SELECT count(*) AS n FROM sandbox_would_write`);
  return { wouldWrite: Number(r.rows[0]?.n ?? 0) };
}

// Delete all keeps the person's account and grants, and in the key store only invitations and recovery codes.
// Everything else in the sandbox's database is its test data and goes.
export const KEEP_TABLES = ["apsomh_users", "apsomh_sessions", "apsomh_user_app_access", "sandbox_marker"] as const;
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

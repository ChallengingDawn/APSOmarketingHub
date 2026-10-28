// THE RELAY'S CLI DOOR - what `npm run sbx` talks to (scripts/sbx.mjs). Diana and Daniel sign in with a code they
// confirm on the hub's Sandbox app, behind the hub's own TOTP (door.ts), and get a 12-hour CLI token. It is typed
// "sbx-cli": a page never takes it, and a browser session never opens these routes.

import { SignJWT, jwtVerify } from "jose";
import { getPool } from "../db/client";
import type { UserRow } from "../db/init";
import type { HsRequest, SqlRequest } from "./store";
import { ensureSandboxTables } from "./store";

const TTL_S = 12 * 3600;
const TYP = "sbx-cli";

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!s) throw new Error("SESSION_SECRET (or AUTH_SECRET) is not set");
  return new TextEncoder().encode(s);
}

export async function signCli(uid: number): Promise<{ token: string; expiresAt: string }> {
  const token = await new SignJWT({ uid, typ: TYP }).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(`${TTL_S}s`).sign(secret());
  return { token, expiresAt: new Date(Date.now() + TTL_S * 1000).toISOString() };
}

/** The signed-in CLI user, from `Authorization: Bearer <token>`; null for anything else (a browser session included). */
export async function cliUser(req: Request): Promise<UserRow | null> {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.get("authorization") ?? "");
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], secret(), { algorithms: ["HS256"] });
    if (payload.typ !== TYP || typeof payload.uid !== "number") return null;
    const r = await getPool().query<UserRow>(`SELECT * FROM apsomh_users WHERE id = $1 LIMIT 1`, [payload.uid]);
    const u = r.rows[0];
    return u && u.is_active ? u : null;
  } catch {
    return null;
  }
}

export type AskSpec = { kind: "hs"; request: HsRequest } | { kind: "sql"; request: SqlRequest };

/** An ask from the CLI, checked for shape only - what may be run is the hub's decision (sandboxFeed/run.ts). */
export function askSpec(v: unknown): AskSpec | string {
  const o = (v ?? {}) as { kind?: unknown; request?: Record<string, unknown> };
  const r = o.request ?? {};
  if (o.kind === "hs") {
    if (typeof r.method !== "string" || typeof r.url !== "string" || !r.url.startsWith("/")) return "a HubSpot ask needs method and a url starting with /";
    return { kind: "hs", request: { method: r.method.toUpperCase(), url: r.url, body: r.body ?? null } };
  }
  if (o.kind === "sql") {
    if (typeof r.text !== "string" || !r.text.trim()) return "a database ask needs its SELECT as text";
    return { kind: "sql", request: { text: r.text, params: Array.isArray(r.params) ? r.params : [] } };
  }
  return "kind must be hs or sql";
}

export async function addAsk(by: string, spec: AskSpec, reason: string): Promise<number> {
  await ensureSandboxTables();
  const r = await getPool().query<{ id: string }>(`INSERT INTO sandbox_asks (by_user, spec, reason) VALUES ($1, $2, $3) RETURNING id`,
    [by, JSON.stringify(spec), reason.slice(0, 500)]);
  return Number(r.rows[0].id);
}

export async function askState(id: number): Promise<{ id: number; state: string; note: string | null; data: unknown } | null> {
  await ensureSandboxTables();
  const r = await getPool().query<{ state: string; note: string | null; answer_key: string | null }>(
    `SELECT state, note, answer_key FROM sandbox_asks WHERE id = $1`, [id]);
  const a = r.rows[0];
  if (!a) return null;
  let data: unknown = null;
  if (a.answer_key) data = (await getPool().query(`SELECT response FROM sandbox_replay WHERE key = $1`, [a.answer_key])).rows[0]?.response ?? null;
  return { id, state: a.state, note: a.note, data };
}

export type ReviewIn = { title: string; summary: string; base: string | null; preview_url: string | null;
  files: { path: string; added: number; removed: number }[]; patch: string };

const MAX_PATCH = 4 * 1024 * 1024;

export function reviewIn(v: unknown): ReviewIn | string {
  const o = (v ?? {}) as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title.trim()) return "a review needs a title";
  if (typeof o.patch !== "string") return "a review needs its patch";
  if (o.patch.length > MAX_PATCH) return "the patch is over 4 MB - send a smaller change";
  const files = Array.isArray(o.files) ? o.files.slice(0, 500).map((f) => {
    const x = (f ?? {}) as Record<string, unknown>;
    return { path: String(x.path ?? "").slice(0, 300), added: Number(x.added) || 0, removed: Number(x.removed) || 0 };
  }) : [];
  return {
    title: o.title.trim().slice(0, 140), summary: typeof o.summary === "string" ? o.summary.slice(0, 4000) : "",
    base: typeof o.base === "string" ? o.base.slice(0, 64) : null,
    preview_url: typeof o.preview_url === "string" ? o.preview_url.slice(0, 300) : null, files, patch: o.patch,
  };
}

export async function addReview(by: string, r: ReviewIn): Promise<number> {
  await ensureSandboxTables();
  const x = await getPool().query<{ id: string }>(
    `INSERT INTO sandbox_reviews (by_user, title, summary, base, preview_url, files, patch) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [by, r.title, r.summary, r.base, r.preview_url, JSON.stringify(r.files), r.patch]);
  return Number(x.rows[0].id);
}

// The scrubbed code of the hub's current release (the release step uploads it) - what `sbx pull` hands out.
export async function saveSnapshot(sha: string, tar: Buffer): Promise<void> {
  await ensureSandboxTables();
  const p = getPool();
  await p.query(`CREATE TABLE IF NOT EXISTS sandbox_snapshot (sha text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), tar bytea NOT NULL)`);
  await p.query(`INSERT INTO sandbox_snapshot (sha, tar) VALUES ($1, $2) ON CONFLICT (sha) DO UPDATE SET tar = EXCLUDED.tar, at = now()`, [sha, tar]);
  await p.query(`DELETE FROM sandbox_snapshot WHERE sha NOT IN (SELECT sha FROM sandbox_snapshot ORDER BY at DESC LIMIT 2)`);
}

export async function latestSnapshot(): Promise<{ sha: string; at: string; tar: Buffer } | null> {
  await ensureSandboxTables();
  const r = await getPool().query<{ sha: string; at: string; tar: Buffer }>(
    `SELECT sha, at, tar FROM sandbox_snapshot ORDER BY at DESC LIMIT 1`).catch(() => ({ rows: [] as { sha: string; at: string; tar: Buffer }[] }));
  return r.rows[0] ?? null;
}

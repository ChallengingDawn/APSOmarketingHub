// APSOconvert > PAGE TESTS AND PERSONALISATIONS - the hub's side (Website > A/B testing > Page tests; Website > AI
// testing & personalization > Personalise and Ship). SARCLA 07.11.2026: "the approved idea goes to the A/B testing app";
// "nothing goes live until a person approves it" - STARTING a test or a personalisation is that approval (the page's
// write level, and a confirm that says what goes live where).
//
// A test is made from an APPROVED version (src/lib/convert/studio.ts) as a draft: its pages (the version's, and the same
// product in the other languages the person ticks), its host (ACC first; production after), the split or the bandit,
// the audience, the goal. Starting it takes a copy of the version's change list - what was approved is what runs, even
// if the version is reshaped later - and hands the configuration to the DirectUp gateway (C:\dev\convert-contract.md):
// PUT /api/admin/convert/tests/:id. Pause, resume, stop and restart (a new round, counted from zero) go the same way;
// the results come back from GET /api/admin/convert/results and are worked out here (./stats.ts). Every action is
// written down: who, when, what.
//
// The hub's record goes first only where it cannot lie: a test is "running" here once the gateway took it. Without
// DIRECTUP_ADMIN_KEY (or with the gateway away) drafts are made and changed as usual; nothing is started, and no
// number is shown that the gateway did not count.
//
// Tables: apsomh_convert_tests, apsomh_convert_test_log.

import { getPool, query } from "@/lib/db/client";
import { adminKey, gateway } from "@/lib/directup/gateway";
import { ensureConvertSchema } from "./pages";
import { ensureStudioSchema, type Numbers } from "./studio";
import { classify, ENVS, type Env, type PageKind } from "./model";
import {
  ANY_AUDIENCE, DEFAULT_ALLOCATION, HOST, buildConfig, cleanPages, normAllocation, normAudience, normResults, sharedPages,
  type Allocation, type Audience, type GatewayStatus, type Host, type Results, type TestConfig, type TestKind, type TestStatus,
} from "./contract";
import { DEFAULT_MDE, analyse, type Analysis } from "./stats";
import type { Change } from "./versions";
import { calendarEnded, calendarStarted } from "./calendar";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_convert_tests (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'test',
  version_id bigint REFERENCES apsomh_convert_versions(id) ON DELETE SET NULL,
  version_rev int NOT NULL DEFAULT 1,
  changes jsonb NOT NULL DEFAULT '[]',
  idea_id bigint,
  env text NOT NULL,
  host text NOT NULL,
  pages text[] NOT NULL,
  allocation jsonb NOT NULL,
  audience jsonb NOT NULL,
  goal text NOT NULL DEFAULT 'add_to_cart',
  mde real NOT NULL DEFAULT 0.1,
  v int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  winner text,
  from_test bigint,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_by text,
  started_at timestamptz,
  stopped_by text,
  stopped_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  synced_at timestamptz,
  sync_error text,
  results jsonb,
  results_at timestamptz,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apsomh_convert_tests_version ON apsomh_convert_tests (version_id);
CREATE INDEX IF NOT EXISTS apsomh_convert_tests_status ON apsomh_convert_tests (kind, status);
CREATE TABLE IF NOT EXISTS apsomh_convert_test_log (
  id bigserial PRIMARY KEY,
  test_id bigint NOT NULL REFERENCES apsomh_convert_tests(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  by_whom text,
  action text NOT NULL,
  detail text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS apsomh_convert_test_log_test ON apsomh_convert_test_log (test_id, at DESC);
ALTER TABLE apsomh_convert_tests ADD COLUMN IF NOT EXISTS piece_id bigint;
CREATE INDEX IF NOT EXISTS apsomh_convert_tests_piece ON apsomh_convert_tests (piece_id) WHERE piece_id IS NOT NULL;
`;

let schemaReady: Promise<void> | null = null;
export function ensureTestsSchema(): Promise<void> {
  // the versions' table first: a test points at its version
  schemaReady ??= ensureStudioSchema().then(() => getPool().query(SCHEMA)).then(() => undefined).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

/* ── the record ──────────────────────────────────────────────────────── */

export type Test = {
  id: string; name: string; kind: TestKind; versionId: string | null; versionRev: number; changeCount: number;
  ideaId: string | null; env: Env; host: Host; pages: string[]; allocation: Allocation; audience: Audience; goal: "add_to_cart"; mde: number;
  v: number; status: TestStatus; winner: "a" | "b" | "none" | null; fromTest: string | null;
  createdBy: string | null; createdAt: string; startedBy: string | null; startedAt: string | null; stoppedBy: string | null; stoppedAt: string | null;
  decidedBy: string | null; decidedAt: string | null; syncedAt: string | null; syncError: string | null;
  results: Results | null; resultsAt: string | null; notes: string; updatedAt: string;
  /** the Content piece (Page builder) it belongs to - its publishing view controls it (SARCLA 11.11.2026) */
  piece: string | null;
  /** the page kind of its first page - product and category pages are the theme's code, CMS pages Magento's */
  pageKind: PageKind;
};
type Row = {
  id: string; name: string; kind: TestKind; version_id: string | null; version_rev: number; n_changes: number; idea_id: string | null; env: Env; host: Host;
  pages: string[]; allocation: Allocation; audience: Audience; goal: "add_to_cart"; mde: number; v: number; status: TestStatus; winner: Test["winner"]; from_test: string | null;
  created_by: string | null; created_at: Date; started_by: string | null; started_at: Date | null; stopped_by: string | null; stopped_at: Date | null;
  decided_by: string | null; decided_at: Date | null; synced_at: Date | null; sync_error: string | null; results: Results | null; results_at: Date | null; notes: string; updated_at: Date; piece_id: string | null;
};
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
const COLS = `id, name, kind, version_id, version_rev, jsonb_array_length(changes) AS n_changes, idea_id, env, host, pages, allocation, audience, goal, mde, v, status,
  winner, from_test, created_by, created_at, started_by, started_at, stopped_by, stopped_at, decided_by, decided_at, synced_at, sync_error, results, results_at, notes, updated_at, piece_id`;
const toTest = (r: Row): Test => ({
  id: String(r.id), name: r.name, kind: r.kind, versionId: r.version_id ? String(r.version_id) : null, versionRev: r.version_rev, changeCount: Number(r.n_changes ?? 0),
  ideaId: r.idea_id ? String(r.idea_id) : null, env: r.env, host: r.host, pages: r.pages ?? [], allocation: normAllocation(r.allocation), audience: normAudience(r.audience),
  goal: "add_to_cart", mde: Number(r.mde) || DEFAULT_MDE, v: r.v, status: r.status, winner: r.winner, fromTest: r.from_test ? String(r.from_test) : null,
  createdBy: r.created_by, createdAt: iso(r.created_at)!, startedBy: r.started_by, startedAt: iso(r.started_at), stoppedBy: r.stopped_by, stoppedAt: iso(r.stopped_at),
  decidedBy: r.decided_by, decidedAt: iso(r.decided_at), syncedAt: iso(r.synced_at), syncError: r.sync_error,
  results: r.results ? normResults(r.results, String(r.id), r.v) : null, resultsAt: iso(r.results_at), notes: r.notes ?? "", updatedAt: iso(r.updated_at)!,
  piece: r.piece_id ? String(r.piece_id) : null,
  pageKind: classify(r.pages?.[0] ?? "/").kind,
});

export async function testById(id: string): Promise<Test | null> {
  await ensureTestsSchema();
  const r = await query<Row>(`SELECT ${COLS} FROM apsomh_convert_tests WHERE id = $1`, [id]);
  return r.rows[0] ? toTest(r.rows[0]) : null;
}
async function changesOf(id: string): Promise<Change[]> {
  const r = await query<{ changes: Change[] }>(`SELECT changes FROM apsomh_convert_tests WHERE id = $1`, [id]);
  return r.rows[0]?.changes ?? [];
}
export async function listTests(kind: TestKind | null, piece: string | null = null): Promise<Test[]> {
  await ensureTestsSchema();
  const r = await query<Row>(
    `SELECT ${COLS} FROM apsomh_convert_tests WHERE ($1::text IS NULL OR kind = $1) AND ($2::bigint IS NULL OR piece_id = $2::bigint)
      ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'paused' THEN 1 WHEN 'draft' THEN 2 WHEN 'stopped' THEN 3 ELSE 4 END, updated_at DESC LIMIT 300`,
    [kind, piece]);
  return r.rows.map(toTest);
}

export type LogEntry = { at: string; by: string | null; action: string; detail: string };
export async function history(id: string): Promise<LogEntry[]> {
  await ensureTestsSchema();
  const r = await query<{ at: Date; by_whom: string | null; action: string; detail: string }>(
    `SELECT at, by_whom, action, detail FROM apsomh_convert_test_log WHERE test_id = $1 ORDER BY at DESC, id DESC LIMIT 200`, [id]);
  return r.rows.map((x) => ({ at: iso(x.at)!, by: x.by_whom, action: x.action, detail: x.detail }));
}
async function log(id: string, by: string, action: string, detail = ""): Promise<void> {
  await query(`INSERT INTO apsomh_convert_test_log (test_id, by_whom, action, detail) VALUES ($1, $2, $3, $4)`, [id, by, action, detail.slice(0, 2000)]);
}

/* ── where a test comes from ─────────────────────────────────────────── */

type VersionInfo = { id: string; rev: number; env: Env; path: string; status: string; changes: Change[]; summary: string; approvedBy: string | null; approvedAt: string | null;
  ideaId: string; title: string; why: string; change: string; expect: string; numbers: Numbers | null };
async function versionInfo(versionId: string): Promise<VersionInfo | null> {
  await ensureStudioSchema();
  const r = await query<{ id: string; rev: number; env: Env; path: string; status: string; changes: Change[]; summary: string; approved_by: string | null; approved_at: Date | null;
    idea_id: string; title: string; why: string; change: string; expect: string; numbers: Numbers | null }>(
    `SELECT v.id, v.rev, v.env, v.path, v.status, v.changes, v.summary, v.approved_by, v.approved_at, i.id AS idea_id, i.title, i.why, i.change, i.expect, i.numbers
       FROM apsomh_convert_versions v JOIN apsomh_convert_ideas i ON i.id = v.idea_id WHERE v.id = $1`, [versionId]);
  const x = r.rows[0];
  return x ? { id: String(x.id), rev: x.rev, env: x.env, path: x.path, status: x.status, changes: x.changes, summary: x.summary, approvedBy: x.approved_by, approvedAt: iso(x.approved_at),
    ideaId: String(x.idea_id), title: x.title, why: x.why, change: x.change, expect: x.expect, numbers: x.numbers } : null;
}

/** An approved version's page - where the page picker starts. */
export async function approvedVersionPath(versionId: string): Promise<{ path: string; env: Env } | null> {
  const v = await versionInfo(versionId);
  return v && v.status === "approved" ? { path: v.path, env: v.env } : null;
}

export type IdeaBrief = { id: string; title: string; why: string; change: string; expect: string; numbers: Numbers | null };
export async function ideaOf(t: Test): Promise<IdeaBrief | null> {
  if (!t.ideaId) return null;
  await ensureStudioSchema();
  const r = await query<IdeaBrief & { id: string }>(`SELECT id, title, why, change, expect, numbers FROM apsomh_convert_ideas WHERE id = $1`, [t.ideaId]);
  return r.rows[0] ? { ...r.rows[0], id: String(r.rows[0].id) } : null;
}

/**
 * WHERE A TEST CAME FROM (13.11.2026 - the loop as one product: the Tests list never said which Content to-do a test came
 * from, and "See it" opened the test's shop - ACC - for an optimization that lives on production): the Content to-do of
 * its piece (its project and title, read from Content's table - none when Content is away) and the env of the
 * optimization it tests.
 */
export type TestOrigin = { todo: { pieceId: string; projectId: number; title: string } | null; ideaEnv: Env | null };
export async function originsOf(tests: Pick<Test, "id" | "piece" | "ideaId">[]): Promise<Record<string, TestOrigin>> {
  const nums = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  const pieces = nums(tests.map((t) => t.piece));
  const ideas = nums(tests.map((t) => t.ideaId));
  const [p, i] = await Promise.all([
    pieces.length
      ? query<{ id: number; project_id: number; title: string }>(`SELECT id, project_id, title FROM apsomh_content_pieces WHERE id = ANY($1::int[])`, [pieces]).catch(() => ({ rows: [] as { id: number; project_id: number; title: string }[] }))
      : Promise.resolve({ rows: [] as { id: number; project_id: number; title: string }[] }),
    ideas.length
      ? query<{ id: string; env: Env }>(`SELECT id, env FROM apsomh_convert_ideas WHERE id = ANY($1::bigint[])`, [ideas]).catch(() => ({ rows: [] as { id: string; env: Env }[] }))
      : Promise.resolve({ rows: [] as { id: string; env: Env }[] }),
  ]);
  const todo = new Map(p.rows.map((x) => [String(x.id), { pieceId: String(x.id), projectId: Number(x.project_id), title: x.title }]));
  const env = new Map(i.rows.map((x) => [String(x.id), x.env]));
  return Object.fromEntries(tests.map((t) => [t.id, { todo: t.piece ? todo.get(t.piece) ?? null : null, ideaEnv: t.ideaId ? env.get(t.ideaId) ?? null : null }]));
}

export type Candidate = { versionId: string; rev: number; env: Env; path: string; kind: PageKind; summary: string; approvedBy: string | null; approvedAt: string | null; ideaId: string; title: string };
/** Approved versions without a test (or without a personalisation) of their own yet. */
export async function candidates(kind: TestKind): Promise<Candidate[]> {
  await ensureTestsSchema();
  const r = await query<{ id: string; rev: number; env: Env; path: string; summary: string; approved_by: string | null; approved_at: Date | null; idea_id: string; title: string }>(
    `SELECT v.id, v.rev, v.env, v.path, v.summary, v.approved_by, v.approved_at, i.id AS idea_id, i.title
       FROM apsomh_convert_versions v JOIN apsomh_convert_ideas i ON i.id = v.idea_id
      WHERE v.status = 'approved' AND ($1 = 'personalisation' OR NOT EXISTS (SELECT 1 FROM apsomh_convert_tests t WHERE t.version_id = v.id AND t.kind = $1))
        -- one test path per page (13.11.2026): a content page sent to Content is tested in its A/B section; Content's own
        -- test versions get their test from Content; home, category and product pages keep this way (Content cannot test them)
        AND NOT (i.sent_at IS NOT NULL AND i.kind = 'cms') AND NOT (i.source = 'person' AND i.piece_id IS NOT NULL)
      ORDER BY v.approved_at DESC NULLS LAST LIMIT 200`, [kind]);
  return r.rows.map((x) => ({ versionId: String(x.id), rev: x.rev, env: x.env, path: x.path, kind: classify(x.path).kind, summary: x.summary, approvedBy: x.approved_by,
    approvedAt: iso(x.approved_at), ideaId: String(x.idea_id), title: x.title }));
}

/**
 * The page in its other languages, from the shop's index: a product = the same product number in every store view;
 * another page = the same address after the store view (store views of one language share their addresses).
 */
export async function languagePaths(env: Env, path: string): Promise<{ path: string; store: string | null }[]> {
  await ensureConvertSchema();
  const c = classify(path);
  const r = await query<{ url: string; store: string }>(
    c.kind === "product" && c.product
      ? `SELECT url, store FROM apsomh_convert_pages WHERE env = $1 AND gone_at IS NULL AND product = $2 ORDER BY store LIMIT 40`
      : `SELECT url, store FROM apsomh_convert_pages WHERE env = $1 AND gone_at IS NULL AND rest = $2 AND rest <> '' ORDER BY store LIMIT 40`,
    [env, c.kind === "product" && c.product ? c.product : c.rest]);
  const out = [{ path: c.path, store: c.store }];
  for (const x of r.rows) {
    let p: string;
    try { p = new URL(x.url).pathname; } catch { continue; }
    if (!out.some((o) => o.path === p)) out.push({ path: p, store: x.store || null });
  }
  return out;
}

/* ── the gateway ─────────────────────────────────────────────────────── */

export type GatewayState = { configured: boolean; missing: string[] };
export const gatewayState = (): GatewayState => (adminKey() ? { configured: true, missing: [] } : { configured: false, missing: ["DIRECTUP_ADMIN_KEY"] });
const NO_KEY = "DIRECTUP_ADMIN_KEY is not set on the hub, so nothing can reach the shop - drafts can still be made and changed.";

export class ConvertError extends Error {
  constructor(message: string, readonly status = 409, readonly missing: string[] | null = null) { super(message); }
}

function configOf(t: Test, changes: Change[], status: GatewayStatus, v = t.v): TestConfig {
  const { config } = buildConfig({ id: t.id, v, kind: t.kind, status, name: t.name, host: t.host, pages: t.pages, allocation: t.allocation, audience: t.audience }, changes);
  return config;
}

/** Hand a configuration to the gateway; the hub's record changes only when it was taken. */
async function push(t: Test, changes: Change[], status: GatewayStatus, v = t.v): Promise<void> {
  if (!adminKey()) throw new ConvertError(NO_KEY, 503, ["DIRECTUP_ADMIN_KEY"]);
  const cfg = configOf(t, changes, status, v);
  if (!cfg.variants[1].changes.length) throw new ConvertError("The version has no change the shop may run.");
  if (!cfg.pages.length) throw new ConvertError("The test has no page.");
  try {
    await gateway<TestConfig>(`/convert/tests/${encodeURIComponent(t.id)}`, { method: "PUT", body: cfg, timeoutMs: 20_000 });
  } catch (e) {
    const msg = (e as Error).message;
    await query(`UPDATE apsomh_convert_tests SET sync_error = $2, updated_at = now() WHERE id = $1`, [t.id, msg.slice(0, 500)]);
    throw new ConvertError(`The shop's gateway did not take it: ${msg}`, 502);
  }
}

/** What the gateway holds now (with the bandit's live weights), or why it could not be read. */
export async function gatewayTests(): Promise<{ tests: TestConfig[] | null; error: string | null }> {
  if (!adminKey()) return { tests: null, error: null };
  try {
    const r = await gateway<{ tests: TestConfig[] }>("/convert/tests", { timeoutMs: 12_000 });
    return { tests: Array.isArray(r?.tests) ? r.tests : [], error: null };
  } catch (e) {
    return { tests: null, error: (e as Error).message };
  }
}

/** Another test or personalisation live on the same host and page would fight over it. */
async function conflicts(t: Test): Promise<void> {
  const others = (await listTests(null)).filter((o) => o.id !== t.id && (o.status === "running" || o.status === "paused"));
  for (const o of others) {
    const shared = sharedPages(t, o);
    if (shared.length) throw new ConvertError(`${o.kind === "test" ? "The test" : "The personalisation"} #${o.id} "${o.name}" is already on ${shared[0]}${shared.length > 1 ? ` and ${shared.length - 1} more` : ""} on ${o.host} - stop it first.`);
  }
}

/* ── results ─────────────────────────────────────────────────────────── */

export type TestResults = { results: Results | null; at: string | null; live: boolean; error: string | null; analysis: Analysis | null };

/** Read the results of the current round from the gateway (kept as the last ones), else the last ones kept. */
export async function resultsOf(t: Test, opts: { fresh?: boolean; baseRate?: number | null } = {}): Promise<TestResults> {
  if (t.status === "draft") return { results: null, at: null, live: false, error: null, analysis: null };
  const ended = t.status === "stopped" || t.status === "shipped";
  const keptIsFinal = ended && t.results && t.resultsAt && t.stoppedAt && t.resultsAt >= t.stoppedAt && t.results.v === t.v;
  let res: Results | null = t.results && t.results.v === t.v ? t.results : null;
  let at = res ? t.resultsAt : null;
  let live = false;
  let error: string | null = null;
  if (!keptIsFinal || opts.fresh) {
    if (!adminKey()) error = NO_KEY;
    else {
      try {
        const r = await gateway<unknown>(`/convert/results?id=${encodeURIComponent(t.id)}&v=${t.v}`, { timeoutMs: 15_000 });
        res = normResults(r, t.id, t.v);
        at = new Date().toISOString();
        live = true;
        await query(`UPDATE apsomh_convert_tests SET results = $2::jsonb, results_at = now() WHERE id = $1`, [t.id, JSON.stringify(res)]);
      } catch (e) {
        error = `The shop's gateway did not give the results: ${(e as Error).message}`;
      }
    }
  }
  const now = ended && t.stoppedAt ? t.stoppedAt : new Date().toISOString();
  const analysis = res ? analyse({ variants: res.variants, daily: res.daily, segments: res.segments, since: res.since ?? t.startedAt }, now, { mde: t.mde, baseRate: opts.baseRate ?? null }) : null;
  return { results: res, at, live, error, analysis };
}

/** The page's own cart rate (from Problems, kept on the idea) - what the test plans with before it has its own. */
export async function baseRateOf(t: Test): Promise<number | null> {
  const idea = await ideaOf(t).catch(() => null);
  const r = idea?.numbers?.rate;
  return typeof r === "number" && r > 0 ? r : null;
}

/* ── making and changing ─────────────────────────────────────────────── */

export async function createDraft(input: {
  versionId: string; kind: TestKind; env?: Env | null; pages?: unknown; audience?: unknown; allocation?: unknown; name?: string | null; fromTest?: string | null;
  /** the Content piece it belongs to; else the piece its version was made from (the Page builder's own changes) */
  piece?: string | null;
}, by: string): Promise<Test> {
  await ensureTestsSchema();
  const v = await versionInfo(input.versionId);
  if (!v) throw new ConvertError("No such version.", 404);
  if (v.status !== "approved") throw new ConvertError("Only an approved version can be tested - approve it in the Preview first.");
  // ACC first: a version is tried on ACC before production, unless the person picks production
  const env: Env = input.env === "prod" ? "prod" : "acc";
  const allowed = (await languagePaths(env, v.path).catch(() => [{ path: v.path, store: null }])).map((x) => x.path);
  const picked = cleanPages(input.pages).filter((p) => allowed.includes(p) || p === v.path);
  const pages = [v.path, ...picked.filter((p) => p !== v.path)];
  const name = (input.name ?? "").trim().slice(0, 200) || v.title.slice(0, 200);
  const piece = input.piece
    ?? (await query<{ piece_id: string | null }>(`SELECT piece_id FROM apsomh_convert_ideas WHERE id = $1`, [v.ideaId])).rows[0]?.piece_id ?? null;
  const r = await query<{ id: string }>(
    `INSERT INTO apsomh_convert_tests (name, kind, version_id, version_rev, changes, idea_id, env, host, pages, allocation, audience, created_by, from_test, piece_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::text[], $10::jsonb, $11::jsonb, $12, $13, $14) RETURNING id`,
    [name, input.kind, v.id, v.rev, JSON.stringify(v.changes), v.ideaId, env, HOST[env], pages, JSON.stringify(normAllocation(input.allocation ?? DEFAULT_ALLOCATION)),
      JSON.stringify(normAudience(input.audience ?? ANY_AUDIENCE)), by, input.fromTest ?? null, piece]);
  const id = String(r.rows[0].id);
  await log(id, by, "created", `${input.kind === "test" ? "Test" : "Personalisation"} made from version rev ${v.rev} of "${v.title}" - ${pages.length} ${pages.length === 1 ? "page" : "pages"} on ${ENVS[env].label}`);
  return (await testById(id))!;
}

/** A draft's settings - while it has not started (a running test keeps the conditions it started with). */
export async function updateSettings(id: string, patch: Record<string, unknown>, by: string): Promise<Test> {
  const t = await testById(id);
  if (!t) throw new ConvertError("No such test.", 404);
  const sets: string[] = [];
  const vals: unknown[] = [id];
  const add = (col: string, v: unknown, cast = "") => { vals.push(v); sets.push(`${col} = $${vals.length}${cast}`); };
  const said: string[] = [];
  if (typeof patch.name === "string" && patch.name.trim()) { add("name", patch.name.trim().slice(0, 200)); said.push("name"); }
  if (typeof patch.notes === "string") { add("notes", patch.notes.slice(0, 2000)); said.push("notes"); }
  if (typeof patch.mde === "number" && patch.mde > 0 && patch.mde <= 1) { add("mde", patch.mde); said.push(`smallest uplift ${Math.round(patch.mde * 100)}%`); }
  const conditions = ["pages", "audience", "allocation", "env"].filter((k) => k in patch);
  if (conditions.length && t.status !== "draft") throw new ConvertError("A test keeps the conditions it started with - make a copy to change them.");
  if ("env" in patch && (patch.env === "acc" || patch.env === "prod")) { add("env", patch.env); add("host", HOST[patch.env]); said.push(`on ${ENVS[patch.env].label}`); }
  if ("pages" in patch) {
    const v = t.versionId ? await versionInfo(t.versionId) : null;
    const base = v?.path ?? t.pages[0];
    const env: Env = patch.env === "acc" || patch.env === "prod" ? patch.env : t.env;
    const allowed = (await languagePaths(env, base).catch(() => [{ path: base, store: null }])).map((x) => x.path);
    const picked = cleanPages(patch.pages).filter((p) => allowed.includes(p));
    add("pages", [base, ...picked.filter((p) => p !== base)], "::text[]");
    said.push("pages");
  }
  if ("audience" in patch) { add("audience", JSON.stringify(normAudience(patch.audience)), "::jsonb"); said.push("audience"); }
  if ("allocation" in patch) { add("allocation", JSON.stringify(normAllocation(patch.allocation)), "::jsonb"); said.push("split"); }
  if (!sets.length) return t;
  await query(`UPDATE apsomh_convert_tests SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, vals);
  await log(id, by, "changed", said.join(", "));
  return (await testById(id))!;
}

export type Action = "start" | "pause" | "resume" | "stop" | "restart" | "sync" | "remove" | "decide" | "delete" | "copy";
export const ACTIONS: Action[] = ["start", "pause", "resume", "stop", "restart", "sync", "remove", "decide", "delete", "copy"];

/**
 * One action on a test or a personalisation. Starting (and restarting, and resuming) is the approval that puts the
 * version on the shop: the version must still be approved, and nothing else may be live on the same page.
 */
export async function act(id: string, action: Action, by: string, extra: { winner?: unknown; env?: unknown } = {}): Promise<Test | null> {
  await ensureTestsSchema();
  const t = await testById(id);
  if (!t) throw new ConvertError("No such test.", 404);
  const what = t.kind === "test" ? "test" : "personalisation";
  const need = (...s: TestStatus[]) => { if (!s.includes(t.status)) throw new ConvertError(`The ${what} is ${t.status === "draft" ? "not started" : t.status} - it cannot be ${action === "stop" ? "stopped" : `${action}ed`} now.`); };

  /** a fresh copy of the approved version - what the person approves by starting */
  const approvedChanges = async (): Promise<{ changes: Change[]; rev: number }> => {
    if (!t.versionId) {
      if (t.fromTest) return { changes: await changesOf(t.id), rev: t.versionRev }; // a shipped winner runs what was tested
      throw new ConvertError("Its version is gone.");
    }
    if (t.fromTest) return { changes: await changesOf(t.id), rev: t.versionRev };
    const v = await versionInfo(t.versionId);
    if (!v) throw new ConvertError("Its version is gone.");
    if (v.status !== "approved") throw new ConvertError(`The version was changed after it was approved (now revision ${v.rev}, a draft) - approve it again in the Preview.`);
    return { changes: v.changes, rev: v.rev };
  };

  switch (action) {
    case "start": {
      need("draft");
      const { changes, rev } = await approvedChanges();
      await conflicts(t);
      await push(t, changes, "running");
      await query(`UPDATE apsomh_convert_tests SET status = 'running', changes = $2::jsonb, version_rev = $3, started_by = $4, started_at = now(), synced_at = now(), sync_error = NULL, updated_at = now() WHERE id = $1`,
        [id, JSON.stringify(changes), rev, by]);
      await log(id, by, "started", `Version rev ${rev} live on ${t.host}: ${t.pages.join(", ")}`);
      await calendarStarted(t);
      break;
    }
    case "pause": {
      need("running");
      await push(t, await changesOf(id), "paused");
      await query(`UPDATE apsomh_convert_tests SET status = 'paused', synced_at = now(), sync_error = NULL, updated_at = now() WHERE id = $1`, [id]);
      await log(id, by, "paused", "Every visitor sees the page as it is until it is resumed");
      break;
    }
    case "resume": {
      need("paused");
      await conflicts(t);
      await push(t, await changesOf(id), "running");
      await query(`UPDATE apsomh_convert_tests SET status = 'running', synced_at = now(), sync_error = NULL, updated_at = now() WHERE id = $1`, [id]);
      await log(id, by, "resumed", `Live again on ${t.host}`);
      break;
    }
    case "stop": {
      need("running", "paused");
      await push(t, await changesOf(id), "stopped");
      await query(`UPDATE apsomh_convert_tests SET status = 'stopped', stopped_by = $2, stopped_at = now(), synced_at = now(), sync_error = NULL, updated_at = now() WHERE id = $1`, [id, by]);
      await log(id, by, "stopped", "Every visitor sees the page as it is; the figures stay");
      await calendarEnded(t);
      break;
    }
    case "restart": {
      need("running", "paused", "stopped");
      const { changes, rev } = await approvedChanges();
      await conflicts(t);
      const v = t.v + 1;
      await push(t, changes, "running", v);
      await query(`UPDATE apsomh_convert_tests SET status = 'running', v = $2, changes = $3::jsonb, version_rev = $4, started_by = $5, started_at = now(), stopped_by = NULL, stopped_at = NULL,
        winner = NULL, decided_by = NULL, decided_at = NULL, results = NULL, results_at = NULL, synced_at = now(), sync_error = NULL, updated_at = now() WHERE id = $1`,
        [id, v, JSON.stringify(changes), rev, by]);
      await log(id, by, "restarted", `Round ${v}, counted from zero - version rev ${rev}`);
      await calendarStarted(t);
      break;
    }
    case "sync": {
      need("running", "paused", "stopped");
      await push(t, await changesOf(id), t.status === "shipped" ? "stopped" : (t.status as GatewayStatus));
      await query(`UPDATE apsomh_convert_tests SET synced_at = now(), sync_error = NULL, updated_at = now() WHERE id = $1`, [id]);
      await log(id, by, "sent again", `Its setting handed to the shop's gateway again (${t.status})`);
      break;
    }
    case "remove": {
      need("stopped", "shipped");
      if (!adminKey()) throw new ConvertError(NO_KEY, 503, ["DIRECTUP_ADMIN_KEY"]);
      try { await gateway(`/convert/tests/${encodeURIComponent(id)}`, { method: "DELETE" }); } catch (e) { throw new ConvertError(`The shop's gateway did not take it: ${(e as Error).message}`, 502); }
      await log(id, by, "removed from the shop", "Its setting is off the gateway; the visitors counted stay there for the record");
      break;
    }
    case "decide": {
      if (t.kind !== "test") throw new ConvertError("A personalisation has no winner to pick.");
      need("running", "paused", "stopped");
      const w = extra.winner === "a" || extra.winner === "b" || extra.winner === "none" ? extra.winner : null;
      if (!w) throw new ConvertError("Which one won: the version, the page as it is, or neither?");
      if (t.status !== "stopped") await push(t, await changesOf(id), "stopped");
      await query(`UPDATE apsomh_convert_tests SET status = 'stopped', winner = $2, decided_by = $3, decided_at = now(), stopped_by = COALESCE(stopped_by, $3), stopped_at = COALESCE(stopped_at, now()), updated_at = now() WHERE id = $1`, [id, w, by]);
      await log(id, by, "decided", w === "b" ? "The version won - ready to ship" : w === "a" ? "The page as it is won - the version is dropped" : "No real difference - nothing to ship");
      await calendarEnded(t);
      break;
    }
    case "delete": {
      need("draft");
      await query(`DELETE FROM apsomh_convert_tests WHERE id = $1 AND status = 'draft'`, [id]);
      return null;
    }
    case "copy": {
      // the same test as a new draft - on production after ACC, or to change its conditions
      if (!t.versionId) throw new ConvertError("Its version is gone.");
      const env: Env = extra.env === "prod" ? "prod" : extra.env === "acc" ? "acc" : t.env;
      const copy = await createDraft({ versionId: t.versionId, kind: t.kind, env, pages: t.pages, audience: t.audience, allocation: t.allocation, name: t.name, piece: t.piece }, by);
      await log(id, by, "copied", `As #${copy.id} on ${ENVS[env].label}`);
      await log(copy.id, by, "copied from", `#${id} on ${ENVS[t.env].label}`);
      return copy;
    }
  }
  return testById(id);
}

/* ── ship: the winner for everyone ───────────────────────────────────── */

/** The personalisation a test was shipped as (its winner, for everyone), if any. */
export async function shippedAs(testId: string): Promise<Test | null> {
  await ensureTestsSchema();
  const r = await query<Row>(`SELECT ${COLS} FROM apsomh_convert_tests WHERE from_test = $1 AND kind = 'personalisation' ORDER BY id DESC LIMIT 1`, [testId]);
  return r.rows[0] ? toTest(r.rows[0]) : null;
}

/**
 * Keep the version on for everyone: a personalisation with no audience limit on the test's pages and host, running
 * exactly the change list that was tested. The test is stopped first (two settings on one page would fight); undo
 * switches the personalisation off and the page is as it was.
 */
/** `override`: a change list edited after the test (in Content) instead of the tested one - see ./winner.ts. */
export async function shipToEveryone(testId: string, by: string, override?: Change[]): Promise<Test> {
  const t = await testById(testId);
  if (!t || t.kind !== "test") throw new ConvertError("No such test.", 404);
  if (t.winner !== "b") throw new ConvertError("Only a test the version won can be shipped - decide it first.");
  const prev = await shippedAs(testId);
  if (prev && (prev.status === "running" || prev.status === "paused")) throw new ConvertError(`It is on for everyone already (#${prev.id}).`);
  if (!adminKey()) throw new ConvertError(NO_KEY, 503, ["DIRECTUP_ADMIN_KEY"]);
  const changes = override ?? await changesOf(testId);
  if (t.status === "running" || t.status === "paused") await act(testId, "stop", by);
  const r = await query<{ id: string }>(
    `INSERT INTO apsomh_convert_tests (name, kind, version_id, version_rev, changes, idea_id, env, host, pages, allocation, audience, created_by, from_test)
     VALUES ($1, 'personalisation', $2, $3, $4::jsonb, $5, $6, $7, $8::text[], $9::jsonb, $10::jsonb, $11, $12) RETURNING id`,
    [`${t.name} - for everyone`.slice(0, 200), t.versionId, t.versionRev, JSON.stringify(changes), t.ideaId, t.env, t.host, t.pages,
      JSON.stringify(DEFAULT_ALLOCATION), JSON.stringify(ANY_AUDIENCE), by, testId]);
  const pid = String(r.rows[0].id);
  await log(pid, by, "created", `The winner of test #${testId}, for everyone`);
  try {
    await act(pid, "start", by);
  } catch (e) {
    await query(`DELETE FROM apsomh_convert_tests WHERE id = $1 AND status = 'draft'`, [pid]);
    throw e;
  }
  await query(`UPDATE apsomh_convert_tests SET status = 'shipped', updated_at = now() WHERE id = $1`, [testId]);
  await log(testId, by, "shipped", `On for everyone on ${t.host} (personalisation #${pid})`);
  return (await testById(pid))!;
}

export async function undoEveryone(testId: string, by: string): Promise<void> {
  const p = await shippedAs(testId);
  if (!p || (p.status !== "running" && p.status !== "paused")) throw new ConvertError("It is not on for everyone.");
  await act(p.id, "stop", by);
  await query(`UPDATE apsomh_convert_tests SET status = 'stopped', updated_at = now() WHERE id = $1 AND status = 'shipped'`, [testId]);
  await log(testId, by, "shipping undone", `Personalisation #${p.id} switched off - the page is as it was`);
}

/** A way out that happens elsewhere (the code sent to dotSource), written down. */
export async function markHanded(testId: string, how: "dotsource", by: string): Promise<void> {
  const t = await testById(testId);
  if (!t) throw new ConvertError("No such test.", 404);
  await log(testId, by, "code handed over", how === "dotsource" ? "The code and its description went to dotSource" : how);
}

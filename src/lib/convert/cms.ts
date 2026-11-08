// APSOconvert > SHIP > WRITE TO MAGENTO - for CMS pages only (product and category pages are the theme's code: they go
// to dotSource as code, never written from here). The contract (08.11.2026): ONLY when the hub has its Magento CMS keys
// (MAGENTO_CMS_ACC / MAGENTO_CMS_PROD = the integration's four values as JSON {consumer_key, consumer_secret,
// access_token, access_token_secret}, requests signed OAuth 1.0 (./oauth1.ts) - SARCLA made the ACC integration
// 08.11.2026, Content > Elements > Pages only; a plain MAGENTO_CMS_ACC_TOKEN / _PROD_TOKEN is still taken as Bearer if a
// shop ever allows that; without either this stays off and says why); ACC first - production only after the same test was written on ACC; a backup
// row in apsomh_convert_cms_backups before EVERY write; a person presses each write, one page at a time. A backup is
// written back the same way (itself backed up first).
//
// The change list is applied to the page's content as Magento holds it (./ship.ts applyToCms): edits spliced in place,
// everything else kept as it was. A change that finds no place in the content stops the write - those pages go to
// dotSource as code instead.

import { getPool, query } from "@/lib/db/client";
import { ENVS, type Env } from "./model";
import { applyToCms, cmsTarget, type CmsApplied } from "./ship";
import { ConvertError, ensureTestsSchema, testById } from "./tests";
import type { Change } from "./versions";
import { isCreds, oauthHeader, type OAuthCreds } from "./oauth1";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_convert_cms_backups (
  id bigserial PRIMARY KEY,
  test_id bigint,
  env text NOT NULL,
  path text NOT NULL,
  page_id text NOT NULL,
  identifier text NOT NULL,
  title text,
  page jsonb,
  content_before text NOT NULL,
  content_after text NOT NULL,
  by_whom text,
  at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'write',
  written boolean NOT NULL DEFAULT false,
  error text
);
CREATE INDEX IF NOT EXISTS apsomh_convert_cms_backups_test ON apsomh_convert_cms_backups (test_id, at DESC);
`;
let ready: Promise<void> | null = null;
function ensureCmsSchema(): Promise<void> {
  ready ??= ensureTestsSchema().then(() => getPool().query(SCHEMA)).then(() => undefined).catch((e) => { ready = null; throw e; });
  return ready;
}

const CREDS_VAR: Record<Env, string> = { acc: "MAGENTO_CMS_ACC", prod: "MAGENTO_CMS_PROD" };
const TOKEN_VAR: Record<Env, string> = { acc: "MAGENTO_CMS_ACC_TOKEN", prod: "MAGENTO_CMS_PROD_TOKEN" };
type Auth = { kind: "oauth"; creds: OAuthCreds } | { kind: "bearer"; token: string };
/** The way into one shop's Magento: the integration's four values (signed), else a Bearer token, else none. */
function auth(env: Env): Auth | null {
  const raw = (process.env[CREDS_VAR[env]] ?? "").trim();
  if (raw) {
    try { const j = JSON.parse(raw); if (isCreds(j)) return { kind: "oauth", creds: j }; } catch { /* not JSON - try the token */ }
  }
  const t = (process.env[TOKEN_VAR[env]] ?? "").trim();
  return t ? { kind: "bearer", token: t } : null;
}
export function cmsKeys(): { acc: boolean; prod: boolean; missing: string[] } {
  const acc = !!auth("acc"), prod = !!auth("prod");
  return { acc, prod, missing: [!acc ? CREDS_VAR.acc : "", !prod ? CREDS_VAR.prod : ""].filter(Boolean) };
}
export const CMS_OFF = "Writing to Magento needs the hub's Magento CMS integration for that shop (MAGENTO_CMS_ACC, then MAGENTO_CMS_PROD) - not set yet. Until then: the code for dotSource, or the winner kept on for everyone.";

type MagentoPage = { id: number | string; identifier: string; title?: string; content?: string; active?: boolean; store_id?: number[] | number; [k: string]: unknown };

/** One call to Magento's REST API on that environment, all store views (rest/all). */
async function magento<T>(env: Env, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const a = auth(env);
  if (!a) throw new ConvertError(CMS_OFF, 503, [CREDS_VAR[env]]);
  const url = `${ENVS[env].base}/rest/all/V1${path}`;
  const method = init.method ?? "GET";
  const res = await fetch(url, {
    method,
    headers: { Authorization: a.kind === "oauth" ? oauthHeader(method, url, a.creds) : `Bearer ${a.token}`, Accept: "application/json", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const said = body && typeof body === "object" && "message" in body ? String((body as { message: unknown }).message) : text.slice(0, 160);
    throw new ConvertError(`Magento (${ENVS[env].label}) answered ${res.status}: ${said}`, 502);
  }
  return body as T;
}

export type CmsCandidate = { id: string; identifier: string; title: string; active: boolean; stores: number[]; size: number };
async function findPages(env: Env, identifier: string): Promise<CmsCandidate[]> {
  const q = new URLSearchParams({
    "searchCriteria[filterGroups][0][filters][0][field]": "identifier",
    "searchCriteria[filterGroups][0][filters][0][value]": identifier,
    "searchCriteria[filterGroups][0][filters][0][conditionType]": "eq",
  });
  const r = await magento<{ items?: MagentoPage[] }>(env, `/cmsPage/search?${q}`);
  return (r.items ?? []).map((p) => ({
    id: String(p.id), identifier: p.identifier, title: String(p.title ?? ""), active: p.active !== false,
    stores: Array.isArray(p.store_id) ? p.store_id : p.store_id !== undefined ? [Number(p.store_id)] : [], size: String(p.content ?? "").length,
  }));
}

export type CmsPlan = {
  path: string; env: Env;
  target: { ok: true; identifier: string; store: string | null } | { ok: false; why: string };
  candidates: CmsCandidate[];
  chosen: string | null;
  applied: Omit<CmsApplied, "content"> | null;
  sizes: { before: number; after: number } | null;
  /** production waits for this test's write on ACC */
  accDone: boolean;
  canWrite: boolean;
  why: string | null;
};

async function accWritten(testId: string, path: string): Promise<boolean> {
  const r = await query<{ n: string }>(`SELECT count(*)::text AS n FROM apsomh_convert_cms_backups WHERE test_id = $1 AND path = $2 AND env = 'acc' AND written AND kind = 'write'`, [testId, path]);
  return Number(r.rows[0]?.n ?? 0) > 0;
}

async function changesOf(testId: string): Promise<Change[]> {
  const r = await query<{ changes: Change[] }>(`SELECT changes FROM apsomh_convert_tests WHERE id = $1`, [testId]);
  return r.rows[0]?.changes ?? [];
}

/** What a write would do to one page, without writing: the page found in Magento, the changes placed or not. */
/** `changes`: a list edited after the test (in Content) instead of the tested one - see ./winner.ts. */
export async function cmsPlan(testId: string, env: Env, path: string, pageId: string | null, changes?: Change[]): Promise<CmsPlan> {
  await ensureCmsSchema();
  const t = await testById(testId);
  if (!t) throw new ConvertError("No such test.", 404);
  if (!t.pages.includes(path)) throw new ConvertError("That page is not one of the test's pages.", 400);
  const target = cmsTarget(path);
  const accDone = env === "acc" ? true : await accWritten(testId, path);
  const base: CmsPlan = { path, env, target, candidates: [], chosen: null, applied: null, sizes: null, accDone, canWrite: false, why: null };
  if (!target.ok) return { ...base, why: target.why };
  if (t.winner !== "b") return { ...base, why: "Only the version that won its test is written to Magento." };
  if (!auth(env)) return { ...base, why: CMS_OFF };
  if (!accDone) return { ...base, why: "ACC first: write this page on ACC, check it there, then production." };
  const candidates = await findPages(env, target.identifier);
  if (!candidates.length) return { ...base, candidates, why: `Magento (${ENVS[env].label}) has no CMS page "${target.identifier}".` };
  const chosen = pageId && candidates.some((c) => c.id === pageId) ? pageId : candidates.length === 1 ? candidates[0].id : null;
  if (!chosen) return { ...base, candidates, why: `Magento has ${candidates.length} pages called "${target.identifier}" (one per store view) - pick the one to write.` };
  const page = await magento<MagentoPage>(env, `/cmsPage/${encodeURIComponent(chosen)}`);
  const before = String(page.content ?? "");
  const { content, ...applied } = applyToCms(before, changes ?? await changesOf(testId), `test-${testId}`);
  const why = applied.notPlaced.length ? `${applied.notPlaced.length} of the changes find no place in the page's content (${applied.notPlaced.map((x) => x.why).join("; ")}) - this page goes to dotSource as code.` : null;
  return { ...base, candidates, chosen, applied, sizes: { before: before.length, after: content.length }, canWrite: !why, why };
}

/** One write, pressed by a person: the page read again, its content kept in a backup row, then the new content. */
export async function cmsWrite(testId: string, env: Env, path: string, pageId: string, by: string, changes?: Change[]): Promise<{ backupId: string }> {
  const plan = await cmsPlan(testId, env, path, pageId, changes);
  if (!plan.canWrite || !plan.chosen) throw new ConvertError(plan.why ?? "This page cannot be written.");
  const page = await magento<MagentoPage>(env, `/cmsPage/${encodeURIComponent(plan.chosen)}`);
  const before = String(page.content ?? "");
  const { content, notPlaced } = applyToCms(before, changes ?? await changesOf(testId), `test-${testId}`);
  if (notPlaced.length) throw new ConvertError("The page changed in Magento since it was read - read it again.");
  const ident = plan.target.ok ? plan.target.identifier : String(page.identifier);
  // the backup BEFORE the write
  const b = await query<{ id: string }>(
    `INSERT INTO apsomh_convert_cms_backups (test_id, env, path, page_id, identifier, title, page, content_before, content_after, by_whom, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, 'write') RETURNING id`,
    [testId, env, path, plan.chosen, ident, page.title ?? null, JSON.stringify({ ...page, content: undefined }), before, content, by]);
  const backupId = String(b.rows[0].id);
  try {
    await magento(env, `/cmsPage/${encodeURIComponent(plan.chosen)}`, { method: "PUT", body: { page: { ...page, content } } });
    await query(`UPDATE apsomh_convert_cms_backups SET written = true WHERE id = $1`, [backupId]);
    await query(`INSERT INTO apsomh_convert_test_log (test_id, by_whom, action, detail) VALUES ($1, $2, 'written to Magento', $3)`,
      [testId, by, `${ENVS[env].label}: CMS page "${ident}" (${path}) - backup #${backupId}`]);
  } catch (e) {
    await query(`UPDATE apsomh_convert_cms_backups SET error = $2 WHERE id = $1`, [backupId, (e as Error).message.slice(0, 500)]);
    throw e;
  }
  return { backupId };
}

export type CmsBackup = { id: string; env: Env; path: string; pageId: string; identifier: string; by: string | null; at: string; kind: string; written: boolean; error: string | null; sizes: { before: number; after: number } };
export async function cmsBackups(testId: string): Promise<CmsBackup[]> {
  await ensureCmsSchema();
  const r = await query<{ id: string; env: Env; path: string; page_id: string; identifier: string; by_whom: string | null; at: Date; kind: string; written: boolean; error: string | null; nb: number; na: number }>(
    `SELECT id, env, path, page_id, identifier, by_whom, at, kind, written, error, length(content_before) AS nb, length(content_after) AS na
       FROM apsomh_convert_cms_backups WHERE test_id = $1 ORDER BY at DESC LIMIT 50`, [testId]);
  return r.rows.map((x) => ({ id: String(x.id), env: x.env, path: x.path, pageId: x.page_id, identifier: x.identifier, by: x.by_whom, at: new Date(x.at).toISOString(), kind: x.kind,
    written: x.written, error: x.error, sizes: { before: Number(x.nb), after: Number(x.na) } }));
}

/** A backup written back (the page as it was before that write) - itself backed up first. */
export async function cmsRestore(backupId: string, by: string): Promise<{ backupId: string }> {
  await ensureCmsSchema();
  const r = await query<{ test_id: string; env: Env; path: string; page_id: string; identifier: string; content_before: string; written: boolean }>(
    `SELECT test_id, env, path, page_id, identifier, content_before, written FROM apsomh_convert_cms_backups WHERE id = $1`, [backupId]);
  const b = r.rows[0];
  if (!b) throw new ConvertError("No such backup.", 404);
  if (!b.written) throw new ConvertError("That write never reached Magento - nothing to put back.");
  const page = await magento<MagentoPage>(b.env, `/cmsPage/${encodeURIComponent(b.page_id)}`);
  const now = String(page.content ?? "");
  const nb = await query<{ id: string }>(
    `INSERT INTO apsomh_convert_cms_backups (test_id, env, path, page_id, identifier, title, page, content_before, content_after, by_whom, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, 'restore') RETURNING id`,
    [b.test_id, b.env, b.path, b.page_id, b.identifier, page.title ?? null, JSON.stringify({ ...page, content: undefined }), now, b.content_before, by]);
  const id = String(nb.rows[0].id);
  try {
    await magento(b.env, `/cmsPage/${encodeURIComponent(b.page_id)}`, { method: "PUT", body: { page: { ...page, content: b.content_before } } });
    await query(`UPDATE apsomh_convert_cms_backups SET written = true WHERE id = $1`, [id]);
    await query(`INSERT INTO apsomh_convert_test_log (test_id, by_whom, action, detail) VALUES ($1, $2, 'Magento page put back', $3)`,
      [b.test_id, by, `${ENVS[b.env].label}: CMS page "${b.identifier}" as it was before backup #${backupId}`]);
  } catch (e) {
    await query(`UPDATE apsomh_convert_cms_backups SET error = $2 WHERE id = $1`, [id, (e as Error).message.slice(0, 500)]);
    throw e;
  }
  return { backupId: id };
}

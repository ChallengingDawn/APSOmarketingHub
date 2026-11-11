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
import { isSandbox } from "@/lib/sandbox/mode";
import { ENVS, type Env } from "./model";
import { applyToCms, cmsTarget, type CmsApplied } from "./ship";
import { ConvertError, ensureTestsSchema, testById } from "./tests";
import type { Change } from "./versions";
import { isCreds, oauthHeader, type OAuthCreds } from "./oauth1";
import {
  KEY_WAITING, MagentoError, magentoRequest, planPage, planShared, restorePage, storeRefIn, writePage, writeShared,
  type Backup, type Backups, type MagentoRequest, type PagePlan, type SharedPlan, type SharedWritten, type StoreRef, type Target, type Want, type Written,
} from "./cmsPage";
import { magentoFetch } from "./magentoHttp";
import { shopPage } from "./studio";
import { magentoKeys } from "@/lib/doc/config";
import { STORE_VIEWS, storeCodeOf, storeViewOf } from "@/lib/content/studio/kinds/page/storeViews";
import { checkConnection, type Check } from "@/lib/content/studio/kinds/page/magentoCheck";

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
-- Content's page studio writes whole CMS pages by store view (./cmsPage.ts, 09.11.2026): its rows say which to-do and
-- store view; kind 'create' | 'update' | 'restore' there
ALTER TABLE apsomh_convert_cms_backups ADD COLUMN IF NOT EXISTS piece_id bigint;
ALTER TABLE apsomh_convert_cms_backups ADD COLUMN IF NOT EXISTS store text;
CREATE INDEX IF NOT EXISTS apsomh_convert_cms_backups_piece ON apsomh_convert_cms_backups (piece_id, env, store, at DESC);
`;
let ready: Promise<void> | null = null;
function ensureCmsSchema(): Promise<void> {
  ready ??= ensureTestsSchema().then(() => getPool().query(SCHEMA)).then(() => undefined).catch((e) => { ready = null; throw e; });
  return ready;
}

const CREDS_VAR: Record<Env, string> = { acc: "MAGENTO_CMS_ACC", prod: "MAGENTO_CMS_PROD" };
const TOKEN_VAR: Record<Env, string> = { acc: "MAGENTO_CMS_ACC_TOKEN", prod: "MAGENTO_CMS_PROD_TOKEN" };
type Auth = { kind: "oauth"; creds: OAuthCreds; from: "cms" | "order" } | { kind: "bearer"; token: string; from: "cms" };
/** The flag that lets production's pages use the order connector's Magento integration (Content v6, 10.11.2026) - off
 * unless set to 1: SARCLA decides. That integration needs Content > Elements > Pages in Magento first. */
export const ORDER_KEYS_FLAG = "MAGENTO_CMS_PROD_FROM_ORDER_KEYS";
/** The way into one shop's Magento: the integration's four values (signed), else a Bearer token, else - production only,
 * with the flag on - the order connector's integration (src/lib/doc/config.ts, the same production shop), else none. */
function auth(env: Env): Auth | null {
  const raw = (process.env[CREDS_VAR[env]] ?? "").trim();
  if (raw) {
    try { const j = JSON.parse(raw); if (isCreds(j)) return { kind: "oauth", creds: j, from: "cms" }; } catch { /* not JSON - try the token */ }
  }
  const t = (process.env[TOKEN_VAR[env]] ?? "").trim();
  if (t) return { kind: "bearer", token: t, from: "cms" };
  if (env === "prod" && (process.env[ORDER_KEYS_FLAG] ?? "").trim() === "1") {
    const k = magentoKeys();
    const creds = { consumer_key: k.consumerKey, consumer_secret: k.consumerSecret, access_token: k.accessToken, access_token_secret: k.accessSecret };
    // only when those keys are for the production shop itself
    if (isCreds(creds) && k.base.replace(/\/+$/, "") === ENVS.prod.base) return { kind: "oauth", creds, from: "order" };
  }
  return null;
}
export function cmsKeys(): { acc: boolean; prod: boolean; missing: string[]; from: Record<Env, "cms" | "order" | "none"> } {
  const a = auth("acc"), p = auth("prod");
  return {
    acc: !!a, prod: !!p, missing: [!a ? CREDS_VAR.acc : "", !p ? CREDS_VAR.prod : ""].filter(Boolean),
    from: { acc: a?.from ?? "none", prod: p?.from ?? "none" },
  };
}

/** "Check the connection" (the last step): ONE read of Magento's CMS pages with the environment's key - never a write. */
export async function cmsConnectionCheck(env: Env): Promise<Check> {
  const a = auth(env);
  const get = a ? (path: string) => connection(env)("GET", "all", path) : null;
  return checkConnection(env, a?.from ?? "none", get);
}
export const CMS_OFF = "Writing to Magento needs the hub's Magento CMS integration for that shop (MAGENTO_CMS_ACC, then MAGENTO_CMS_PROD) - not set yet. Until then: the code for dotSource, or the winner kept on for everyone.";
/** What a target without its key says, plainly (the page studio's last step - ./cmsPage.ts). */
export { KEY_WAITING } from "./cmsPage";

type MagentoPage = { id: number | string; identifier: string; title?: string; content?: string; active?: boolean; store_id?: number[] | number; [k: string]: unknown };

/** The request function for one environment's Magento: signed with its keys, read leniently (./magentoHttp.ts - ACC
 * pads some chunk sizes, which fetch refuses). The sandbox never writes: anything but a read is refused here too. */
function connection(env: Env): MagentoRequest {
  const a = auth(env);
  if (!a) throw new ConvertError(KEY_WAITING[env], 503, [CREDS_VAR[env]]);
  const req = magentoRequest({ base: ENVS[env].base, fetch: magentoFetch, authorize: (method, url) => (a.kind === "oauth" ? oauthHeader(method, url, a.creds) : `Bearer ${a.token}`) });
  return async (method, store, path, body) => {
    if (method !== "GET" && isSandbox()) throw new ConvertError("The sandbox never writes to Magento.", 403);
    return req(method, store, path, body);
  };
}

/** One call to Magento's REST API on that environment, all store views (rest/all). */
async function magento<T>(env: Env, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const a = auth(env);
  if (!a) throw new ConvertError(CMS_OFF, 503, [CREDS_VAR[env]]);
  const url = `${ENVS[env].base}/rest/all/V1${path}`;
  const method = init.method ?? "GET";
  if (method !== "GET" && isSandbox()) throw new ConvertError("The sandbox never writes to Magento.", 403);
  // read leniently: ACC pads some chunk sizes ("C6C \r\n"), which fetch refuses (./magentoHttp.ts)
  const res = await magentoFetch(url, {
    method,
    headers: { Authorization: a.kind === "oauth" ? oauthHeader(method, url, a.creds) : `Bearer ${a.token}`, Accept: "application/json", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (res.status < 200 || res.status >= 300) {
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

/* ── Content's page studio: whole CMS pages, by store view (09.11.2026) ── */

// SARCLA 09.11.2026: "The Magento publish should occur via the API ... also be able to update ACC and/or PROD". The rules
// are ./cmsPage.ts's (tested against a fake Magento); here: the keys, the store views' codes read from the shop, and the
// backups in the same table as a test's writes - each row with its to-do and store view.

const REFS = new Map<string, { at: number; ref: StoreRef | null }>();
/** A store view's code and id in one environment, read from its front page on the shop - kept a day (an hour when the
 * read failed). */
export async function storeRefOf(env: Env, view: string): Promise<StoreRef | null> {
  // a store view of Magento that is not open (Czech Republic, China, International CS - Content v10): its address leads to
  // en-INT, whose code and id are NOT its own - so never read from its front page; the list's code and id, or nothing
  // when its id is not known (Content v11)
  const listed = storeViewOf(view);
  if (listed && !listed.open) return listed.code && listed.id ? { view, code: listed.code, id: listed.id } : null;
  if (listed && !listed.code) return null;
  const key = `${env}|${view}`;
  const held = REFS.get(key);
  if (held && Date.now() - held.at < (held.ref ? 24 : 1) * 3600_000) return held.ref;
  const page = await shopPage(env, `/${view}/`).catch(() => null);
  const found = page && page.status === 200 ? storeRefIn(page.html, view) : null;
  // the code the shop's list names for it (Content v6: "de-CH/eur" is switzerland_eur_de, never switzerland_chf_de) -
  // a front page that says another is not this store view's
  const want = storeCodeOf(view);
  // the list's code and id when the front page could not be read (the same on production and ACC, read 10.11.2026)
  const ref = found && (!want || found.code === want) ? found : !found && listed?.code && listed.id ? { view, code: listed.code, id: listed.id } : null;
  REFS.set(key, { at: Date.now(), ref });
  return ref;
}

function pageBackups(pieceId: string): Backups {
  return {
    add: async (b) => {
      const r = await query<{ id: string }>(
        `INSERT INTO apsomh_convert_cms_backups (piece_id, env, store, path, page_id, identifier, title, page, content_before, content_after, by_whom, kind)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12) RETURNING id`,
        [pieceId, b.env, b.view, `/${b.view}/${b.identifier}`, b.pageId ?? "", b.identifier, b.title, b.page ? JSON.stringify(b.page) : null, b.before, b.after, b.by, b.action]);
      return String(r.rows[0].id);
    },
    written: async (id, pageId) => { await query(`UPDATE apsomh_convert_cms_backups SET written = true, page_id = $2 WHERE id = $1`, [id, pageId]); },
    failed: async (id, error) => { await query(`UPDATE apsomh_convert_cms_backups SET error = $2 WHERE id = $1`, [id, error]); },
  };
}

/** The Magento pages this to-do created, by environment - a later write may update them (and no other page). */
/** Has this to-do been written on ACC (a page created or updated there, written)? Production waits for it - "ACC first"
 * (Content v11, before the first production CMS write the hub ever makes). */
export async function pieceOnAcc(pieceId: string): Promise<boolean> {
  await ensureCmsSchema();
  const r = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM apsomh_convert_cms_backups WHERE piece_id = $1 AND env = 'acc' AND written AND kind IN ('create', 'update')`, [pieceId]);
  return Number(r.rows[0]?.n ?? 0) > 0;
}

async function oursOf(pieceId: string, env: Env): Promise<Set<string>> {
  const r = await query<{ page_id: string }>(
    `SELECT DISTINCT page_id FROM apsomh_convert_cms_backups WHERE piece_id = $1 AND env = $2 AND kind = 'create' AND written AND page_id <> ''`, [pieceId, env]);
  return new Set(r.rows.map((x) => x.page_id));
}

/** The other store views of the same language, read too: one Magento page may serve several (a write changes them all) -
 * every one the shop has (Content v6: the Swiss shop in EUR, the English store view of each country). */
const sameLanguage = (lang: string) => STORE_VIEWS.filter((v) => v.lang === lang).map((v) => v.key);
async function othersOf(env: Env, view: string): Promise<StoreRef[]> {
  const out: StoreRef[] = [];
  for (const v of sameLanguage(view.slice(0, 2))) {
    if (v === view) continue;
    const r = await storeRefOf(env, v);
    if (r) out.push(r);
  }
  return out;
}

const said = (e: unknown) => (e instanceof MagentoError || e instanceof ConvertError ? e.message : `Magento could not be reached (${String((e as Error)?.message ?? e).slice(0, 120)}).`);

export type PagePlanOut = PagePlan | { view: string; env: Env; action: "none"; why: string; error: true };

/** What a write would do in each store view, read from Magento - nothing written. */
export async function cmsPagePlans(pieceId: string, env: Env, items: { view: string; want: Want }[]): Promise<PagePlanOut[]> {
  await ensureCmsSchema();
  const m = connection(env);
  const ours = await oursOf(pieceId, env);
  const out: PagePlanOut[] = [];
  for (const it of items) {
    try {
      const store = await storeRefOf(env, it.view);
      const { page: _page, ...plan } = await planPage(m, { env, view: it.view, store, want: it.want, others: await othersOf(env, it.view), ours: (id) => ours.has(id) });
      out.push(plan);
    } catch (e) {
      out.push({ view: it.view, env, action: "none", why: said(e), error: true });
    }
  }
  return out;
}

/** One store view written into Magento, pressed by a person - the page backed up first. The gate (the review, the
 * person's grant) is the caller's. */
export async function cmsPageWrite(pieceId: string, env: Env, it: { view: string; want: Want }, by: string): Promise<Written> {
  await ensureCmsSchema();
  const m = connection(env);
  const ours = await oursOf(pieceId, env);
  try {
    return await writePage(m, { env, view: it.view, store: await storeRefOf(env, it.view), want: it.want, others: await othersOf(env, it.view), ours: (id) => ours.has(id), by, backups: pageBackups(pieceId) });
  } catch (e) {
    throw new ConvertError(said(e), 409);
  }
}

/* ── a version written as ONE page for its store views (Content v10) ──── */

/** Each ticked store view with its code and id as the hub knows them (unknown: null). */
async function targetsOf(env: Env, stores: string[]): Promise<Target[]> {
  const out: Target[] = [];
  for (const v of stores) out.push({ view: v, ref: await storeRefOf(env, v) });
  return out;
}
/** Every store view of the language the hub knows the id of - what the page serves now is read among them. */
async function languageRefs(env: Env, lang: string): Promise<StoreRef[]> {
  const out: StoreRef[] = [];
  for (const v of sameLanguage(lang)) { const r = await storeRefOf(env, v); if (r) out.push(r); }
  return out;
}

export type SharedPlanOut = SharedPlan | { view: string; env: Env; action: "none"; why: string; error: true };

/** What writing a version as one page for its store views would do, read from Magento - nothing written. */
export async function cmsSharedPlan(pieceId: string, env: Env, it: { view: string; stores: string[]; want: Extract<Want, { kind: "page" }> }): Promise<SharedPlanOut> {
  await ensureCmsSchema();
  try {
    const m = connection(env);
    const ours = await oursOf(pieceId, env);
    return await planShared(m, { env, view: it.view, targets: await targetsOf(env, it.stores), want: it.want, language: await languageRefs(env, it.view.slice(0, 2)), ours: (id) => ours.has(id) });
  } catch (e) {
    return { view: it.view, env, action: "none", why: said(e), error: true };
  }
}

/** A version written into Magento as ONE page for its store views, pressed by a person - backed up first. */
export async function cmsSharedWrite(pieceId: string, env: Env, it: { view: string; stores: string[]; want: Extract<Want, { kind: "page" }> }, by: string): Promise<SharedWritten> {
  await ensureCmsSchema();
  const m = connection(env);
  const ours = await oursOf(pieceId, env);
  try {
    return await writeShared(m, {
      env, view: it.view, targets: await targetsOf(env, it.stores), want: it.want, language: await languageRefs(env, it.view.slice(0, 2)),
      ours: (id) => ours.has(id), by, backups: pageBackups(pieceId),
    });
  } catch (e) {
    throw new ConvertError(said(e), 409);
  }
}

/** What this to-do last wrote into each store view's page, by environment - its content as Magento got it (Content v12,
 * SARCLA 10.11.2026: "I should be able to update current pages after changes here": the last step tells a page changed
 * since its publish from this). A page brought back or switched off since is not "on" any more: left out. */
export async function cmsWrittenContent(pieceId: string): Promise<{ env: Env; view: string; at: string; content: string }[]> {
  await ensureCmsSchema();
  const r = await query<{ env: Env; store: string; at: Date; kind: string; content_after: string }>(
    `SELECT DISTINCT ON (env, store) env, store, at, kind, content_after FROM apsomh_convert_cms_backups
      WHERE piece_id = $1 AND written AND kind IN ('create', 'update', 'restore') ORDER BY env, store, at DESC`, [pieceId]);
  return r.rows.filter((x) => x.kind !== "restore").map((x) => ({ env: x.env, view: x.store, at: new Date(x.at).toISOString(), content: x.content_after ?? "" }));
}

export type PageBackup = { id: string; env: Env; view: string; identifier: string; pageId: string; action: string; by: string | null; at: string; written: boolean; error: string | null };
export async function cmsPageBackups(pieceId: string): Promise<PageBackup[]> {
  await ensureCmsSchema();
  const r = await query<{ id: string; env: Env; store: string; identifier: string; page_id: string; kind: string; by_whom: string | null; at: Date; written: boolean; error: string | null }>(
    `SELECT id, env, store, identifier, page_id, kind, by_whom, at, written, error FROM apsomh_convert_cms_backups WHERE piece_id = $1 ORDER BY at DESC LIMIT 60`, [pieceId]);
  return r.rows.map((x) => ({ id: String(x.id), env: x.env, view: x.store, identifier: x.identifier, pageId: x.page_id, action: x.kind, by: x.by_whom, at: new Date(x.at).toISOString(), written: x.written, error: x.error }));
}

/** A store view's page brought back as it was before this to-do's last write there (a page it created: switched off). */
export async function cmsPageRestore(pieceId: string, env: Env, view: string, by: string): Promise<{ action: "restored" | "switched-off"; backupId: string; pageId: string; identifier: string }> {
  await ensureCmsSchema();
  const r = await query<{ id: string; identifier: string; page_id: string; kind: string; page: Record<string, unknown> | null; content_before: string; written: boolean }>(
    `SELECT id, identifier, page_id, kind, page, content_before, written FROM apsomh_convert_cms_backups
      WHERE piece_id = $1 AND env = $2 AND store = $3 AND kind IN ('create', 'update') AND written ORDER BY at DESC LIMIT 1`, [pieceId, env, view]);
  const row = r.rows[0];
  if (!row) throw new ConvertError(`Nothing of this page was written to ${ENVS[env].label} in ${view}.`, 404);
  const b: Backup = { id: String(row.id), env, view, identifier: row.identifier, pageId: row.page_id, action: row.kind as Backup["action"], page: row.page, before: row.content_before, written: row.written };
  try {
    const out = await restorePage(connection(env), b, { by, backups: pageBackups(pieceId) });
    return { ...out, pageId: row.page_id, identifier: row.identifier };
  } catch (e) {
    throw new ConvertError(said(e), 409);
  }
}

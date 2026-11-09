// MAGENTO CMS PAGES, ONE STORE VIEW AT A TIME (09.11.2026) - the last step of Content's page studio, "To Magento".
// SARCLA 09.11.2026: "The Magento publish should occur via the API ... also be able to update ACC and/or PROD", and "the
// locales are not all complete in Magento - we select by store view".
//
// Pure: the request function and the backups are handed in (./cms.ts gives the real ones), so the tests run every rule
// against a fake Magento. Nothing here reaches a shop by itself.
//
// What it knows of Magento 2's REST API (read on ACC, GET only, 09.11.2026):
//   - a CMS page's store views are NOT in its answer (PageInterface has no store_id), but the search takes a store_id
//     filter: identifier = X AND store_id = <id> finds the page that serves that store view itself; store_id = 0 the
//     page set for "All Store Views" (no-route is one);
//   - a store view's code and id are on its own front page ("storeCode":"switzerland_chf_de", "storeId":"6") - the CMS
//     integration may not read /V1/store/storeViews (401, Magento_Backend::store);
//   - a page is CREATED in one store view by that store view's code in the address - POST /rest/<code>/V1/cmsPage: the
//     page repository gives a new page the store of the request - and UPDATED by its id - PUT /rest/all/V1/cmsPage/<id>,
//     its store views kept.
//
// The rules:
//   - a new page of the studio: created where its URL key is free; updated where the page there is one this to-do made
//     (its backups say so) - never a page somebody else made under the same URL key
//   - an existing CMS page of the shop: its content as Magento holds it, the change list put in place (./ship.ts
//     applyToCms); a change that finds no place stops it - that page goes to dotSource as code
//   - a page set for "All Store Views" is never written for one store view: it would change every store view
//   - a backup of the page as it is BEFORE every write, written first; "bring it back" writes the backup back (itself
//     backed up first); a page this to-do created is switched off, never deleted

import type { Change } from "./versions";
import { applyToCms } from "./ship";

export type MagentoEnv = "acc" | "prod";
export type Answer = { status: number; text: string };
/** One request to Magento's REST API. `store`: "all", or a store view's code (a page created there is in that store
 * view). `path` after /V1. The caller signs it. */
export type MagentoRequest = (method: "GET" | "POST" | "PUT", store: string, path: string, body?: unknown) => Promise<Answer>;

/** What a request needs: fetch's shape, so the tests hand in a fake one. */
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; text: () => Promise<string> }>;

/** The request function for one Magento: its base address, a fetch, and the Authorization header for each request. */
export function magentoRequest(o: { base: string; fetch: FetchLike; authorize: (method: string, url: string) => string }): MagentoRequest {
  return async (method, store, path, body) => {
    const url = `${o.base}/rest/${encodeURIComponent(store)}/V1${path}`;
    const headers: Record<string, string> = { Authorization: o.authorize(method, url), Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const r = await o.fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, text: await r.text() };
  };
}

export class MagentoError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}

async function call<T>(m: MagentoRequest, method: "GET" | "POST" | "PUT", store: string, path: string, body?: unknown): Promise<T> {
  const a = await m(method, store, path, body);
  let j: unknown = null;
  try { j = JSON.parse(a.text); } catch { /* not JSON */ }
  if (a.status < 200 || a.status >= 300) {
    const msg = j && typeof j === "object" && "message" in j ? String((j as { message: unknown }).message) : a.text.slice(0, 160);
    const params = j && typeof j === "object" && "parameters" in j ? (j as { parameters: unknown }).parameters : null;
    const said = params && typeof params === "object" && !Array.isArray(params)
      ? msg.replace(/%(\w+)/g, (all, k: string) => String((params as Record<string, unknown>)[k] ?? all)) : msg;
    throw new MagentoError(`Magento answered ${a.status}: ${said}`, a.status === 401 || a.status === 403 ? 403 : 502);
  }
  return j as T;
}

/* ── who may write, and where ─────────────────────────────────────────── */

/** What a target without its key says, plainly. */
export const KEY_WAITING: Record<MagentoEnv, string> = {
  acc: "ACC is waiting for its key (MAGENTO_CMS_ACC).",
  prod: "Production is waiting for its key (MAGENTO_CMS_PROD) - production's Magento integration is not made yet.",
};
export const GATE = {
  comment: "You can comment on this project, not publish from it.",
  review: "It goes into Magento once its reviewer approves it - Ask for review, top right.",
  grant: "Writing into Magento needs Edit on Website > AI testing & personalization > Winners - an admin gives it in Settings > People.",
};

/**
 * Why this person may not write this to-do into this Magento now - null when they may. The gate a test's winner has:
 * the to-do approved by its reviewer (or live), the person's Edit on Winners (the hub's one grant for changing the shop),
 * and the environment's key. `restore`: bringing a page back needs no review (it undoes a write).
 */
export function gateOf(x: { canEdit: boolean; status: string; grant: boolean; key: boolean; env: MagentoEnv; restore?: boolean }): string | null {
  if (!x.canEdit) return GATE.comment;
  if (!x.restore && x.status !== "approved" && x.status !== "live") return GATE.review;
  if (!x.grant) return GATE.grant;
  if (!x.key) return KEY_WAITING[x.env];
  return null;
}

/* ── store views ──────────────────────────────────────────────────────── */

/** A store view as Magento knows it: the shop's name for it ("de-CH"), its code and its id. */
export type StoreRef = { view: string; code: string; id: number };

/** A store view's code and id, from one of its own pages on the shop (the minicart's settings every page carries). */
export function storeRefIn(html: string, view: string): StoreRef | null {
  const code = /"storeCode"\s*:\s*"([a-z0-9_]{1,64})"/i.exec(html)?.[1];
  const id = Number(/"storeId"\s*:\s*"?(\d{1,6})"?/.exec(html)?.[1]);
  return code && Number.isInteger(id) && id > 0 ? { view, code, id } : null;
}

/* ── pages ────────────────────────────────────────────────────────────── */

export type MagentoPage = {
  id: number | string; identifier: string; title?: string; content?: string; active?: boolean;
  meta_title?: string; meta_description?: string; [k: string]: unknown;
};

/** The search for one identifier in one store view (0 = the pages set for All Store Views). */
export function searchPath(identifier: string, storeId: number): string {
  const q = new URLSearchParams({
    "searchCriteria[filterGroups][0][filters][0][field]": "identifier",
    "searchCriteria[filterGroups][0][filters][0][value]": identifier,
    "searchCriteria[filterGroups][0][filters][0][conditionType]": "eq",
    "searchCriteria[filterGroups][1][filters][0][field]": "store_id",
    "searchCriteria[filterGroups][1][filters][0][value]": String(storeId),
    "searchCriteria[filterGroups][1][filters][0][conditionType]": "eq",
  });
  return `/cmsPage/search?${q}`;
}

/** The page with this identifier that serves this store view itself (0: All Store Views) - null when there is none. */
export async function pageIn(m: MagentoRequest, identifier: string, storeId: number): Promise<MagentoPage | null> {
  const r = await call<{ items?: MagentoPage[] }>(m, "GET", "all", searchPath(identifier, storeId));
  return (r?.items ?? []).find((p) => p.identifier === identifier) ?? null;
}

/** What one store view's page should become. */
export type Want =
  /** a page made in the studio: created, or - where this to-do made it before - updated */
  | { kind: "page"; identifier: string; title: string; metaTitle: string; metaDescription: string; content: string; active: boolean }
  /** an existing CMS page of the shop: the change list put into its content, the banners at its top, after its first
   * paragraph, at its end; `seo`: its search engine fields (Content v6, SARCLA 09.11.2026) - each only when set, a new
   * URL key the page's new identifier */
  | { kind: "changes"; identifier: string; changes: Change[]; tag: string; inserts?: { top: string; afterIntro: string; bottom: string }; seo?: SeoFields };

/** A page's search engine fields as the studio sends them: an empty one leaves Magento's as it is. */
export type SeoFields = { metaTitle?: string; metaDescription?: string; urlKey?: string };

/** The fields of Magento's page the search engine fields set (only those given, and a URL key only when it changes). */
export function seoFieldsOf(seo: SeoFields | undefined, identifier: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (seo?.metaTitle?.trim()) out.meta_title = seo.metaTitle.trim();
  if (seo?.metaDescription?.trim()) out.meta_description = seo.metaDescription.trim();
  if (seo?.urlKey?.trim() && seo.urlKey.trim() !== identifier) out.identifier = seo.urlKey.trim();
  return out;
}

/** A page's content with the banners put in: at its top, after its first paragraph, at its end. */
export function withInserts(content: string, ins?: { top: string; afterIntro: string; bottom: string }): string {
  if (!ins) return content;
  let out = content;
  if (ins.afterIntro) {
    const p = /<\/p\s*>/i.exec(out);
    out = p ? out.slice(0, p.index + p[0].length) + ins.afterIntro + out.slice(p.index + p[0].length) : out + ins.afterIntro;
  }
  return `${ins.top}${out}${ins.bottom}`;
}

/** The page as Magento holds it with what the studio changes in it - the fields a write sends. */
function pageAfter(want: Want, page: MagentoPage | null): { fields: Record<string, unknown>; notPlaced: string[]; placed: number } {
  if (want.kind === "page") {
    return {
      fields: { identifier: want.identifier, title: want.title, meta_title: want.metaTitle, meta_description: want.metaDescription, content: want.content, active: want.active },
      notPlaced: [], placed: 0,
    };
  }
  const applied = applyToCms(String(page?.content ?? ""), want.changes, want.tag);
  return { fields: { content: withInserts(applied.content, want.inserts), ...seoFieldsOf(want.seo, want.identifier) }, notPlaced: applied.notPlaced.map((x) => x.why), placed: applied.placed.length };
}

export type PagePlan = {
  view: string;
  env: MagentoEnv;
  /** create a page, update one, or nothing (`why`) */
  action: "create" | "update" | "none";
  why: string | null;
  store: StoreRef | null;
  pageId: string | null;
  identifier: string;
  /** the page as Magento holds it now (an update) */
  now: { title: string; active: boolean; size: number } | null;
  /** what the page gets */
  title: string;
  size: number;
  /** the other store views (of those asked about) the same Magento page serves - a write changes them too */
  shared: string[];
  /** an existing page's changes: how many found their place in its content */
  placed: { placed: number; total: number } | null;
};

const bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * What a write would do in one store view, read from Magento, without writing. `others`: the store views of the same
 * language - the same page may serve them too. `ours`: is this Magento page one this to-do made (its backups)?
 */
export async function planPage(m: MagentoRequest, x: {
  env: MagentoEnv; view: string; store: StoreRef | null; want: Want; others?: StoreRef[]; ours: (pageId: string) => boolean;
}): Promise<PagePlan & { page: MagentoPage | null }> {
  const { want } = x;
  const base: PagePlan & { page: MagentoPage | null } = {
    view: x.view, env: x.env, action: "none", why: null, store: x.store, pageId: null, identifier: want.identifier, now: null,
    title: want.kind === "page" ? want.title : "", size: want.kind === "page" ? bytes(want.content) : 0, shared: [], placed: null, page: null,
  };
  if (!want.identifier) return { ...base, why: "The page has no URL key yet (Search engine fields)." };
  if (!x.store) return { ...base, why: `The hub could not read ${x.view}'s store code from the shop - try again in a moment.` };
  const found = await pageIn(m, want.identifier, x.store.id);
  if (!found) {
    const everywhere = await pageIn(m, want.identifier, 0);
    if (everywhere) {
      return { ...base, why: `Magento's page "${want.identifier}" is set for All Store Views - writing it for ${x.view} would change every store view. In Magento, give the page its store views first (Content > Pages > Page in Websites).` };
    }
    if (want.kind === "changes") return { ...base, why: `Magento has no CMS page "${want.identifier}" in ${x.view}.` };
    return { ...base, action: "create" };
  }
  const id = String(found.id);
  const now = { title: String(found.title ?? ""), active: found.active !== false, size: bytes(String(found.content ?? "")) };
  if (want.kind === "page" && !x.ours(id)) {
    return { ...base, pageId: id, now, why: `Magento has a page "${want.identifier}" in ${x.view} already (#${id} "${now.title}") that this to-do did not make - give this page another URL key, or change that page in Magento.` };
  }
  const after = pageAfter(want, found);
  if (after.notPlaced.length) {
    return {
      ...base, pageId: id, now, page: found, placed: { placed: after.placed, total: after.placed + after.notPlaced.length },
      why: `${after.notPlaced.length} of the changes find no place in the page's content (${after.notPlaced.slice(0, 2).join("; ")}) - this page goes to dotSource as code.`,
    };
  }
  // a new URL key (the search engine fields): never one another page of this store view has
  const newKey = want.kind === "changes" ? seoFieldsOf(want.seo, want.identifier).identifier : undefined;
  if (newKey) {
    const taken = await pageIn(m, newKey, x.store.id);
    if (taken && String(taken.id) !== id) return { ...base, pageId: id, now, page: found, why: `Magento has a page "${newKey}" in ${x.view} already (#${taken.id}) - give this page another URL key.` };
  }
  const shared: string[] = [];
  for (const o of x.others ?? []) {
    if (o.id === x.store.id) continue;
    const p = await pageIn(m, want.identifier, o.id);
    if (p && String(p.id) === id) shared.push(o.view);
  }
  return {
    ...base, action: "update", pageId: id, now, page: found, shared,
    title: String(after.fields.title ?? found.title ?? ""), size: bytes(String(after.fields.content ?? "")),
    placed: want.kind === "changes" ? { placed: after.placed, total: after.placed } : null,
  };
}

/* ── writing, with a backup first ─────────────────────────────────────── */

export type BackupIn = {
  env: MagentoEnv; view: string; identifier: string; pageId: string | null; title: string | null;
  page: Record<string, unknown> | null; before: string; after: string; action: "create" | "update" | "restore"; by: string;
};
/** Where the backups go: a row written BEFORE the write (its id), then marked written - or the error kept. */
export type Backups = {
  add: (b: BackupIn) => Promise<string>;
  written: (backupId: string, pageId: string) => Promise<void>;
  failed: (backupId: string, error: string) => Promise<void>;
};

export type Written = { action: "created" | "updated"; pageId: string; backupId: string; plan: PagePlan };

/** One store view written, pressed by a person: read again (the plan may be minutes old), backed up, then written. */
export async function writePage(m: MagentoRequest, x: {
  env: MagentoEnv; view: string; store: StoreRef | null; want: Want; others?: StoreRef[]; ours: (pageId: string) => boolean; by: string; backups: Backups;
}): Promise<Written> {
  const plan = await planPage(m, x);
  if (plan.action === "none") throw new MagentoError(plan.why ?? "This page cannot be written.", 409);
  const { page: _page, ...shown } = plan;
  if (plan.action === "create") {
    const fields = pageAfter(x.want, null).fields;
    const backupId = await x.backups.add({ env: x.env, view: x.view, identifier: x.want.identifier, pageId: null, title: null, page: null, before: "", after: String(fields.content ?? ""), action: "create", by: x.by });
    try {
      const made = await call<MagentoPage>(m, "POST", plan.store!.code, "/cmsPage", { page: fields });
      const pageId = String(made?.id ?? "");
      if (!pageId) throw new MagentoError("Magento did not say which page it made.");
      await x.backups.written(backupId, pageId);
      return { action: "created", pageId, backupId, plan: { ...shown, pageId } };
    } catch (e) {
      await x.backups.failed(backupId, (e as Error).message.slice(0, 500));
      throw e;
    }
  }
  // an update: the page as it is right now is the backup
  const pageId = plan.pageId!;
  const now = await call<MagentoPage>(m, "GET", "all", `/cmsPage/${encodeURIComponent(pageId)}`);
  const after = pageAfter(x.want, now);
  if (after.notPlaced.length) throw new MagentoError("The page changed in Magento since it was read - read it again.", 409);
  const { content: before, ...rest } = now;
  const backupId = await x.backups.add({
    env: x.env, view: x.view, identifier: x.want.identifier, pageId, title: String(now.title ?? ""), page: rest, before: String(before ?? ""),
    after: String(after.fields.content ?? ""), action: "update", by: x.by,
  });
  try {
    await call(m, "PUT", "all", `/cmsPage/${encodeURIComponent(pageId)}`, { page: { ...now, ...after.fields } });
    await x.backups.written(backupId, pageId);
    return { action: "updated", pageId, backupId, plan: shown };
  } catch (e) {
    await x.backups.failed(backupId, (e as Error).message.slice(0, 500));
    throw e;
  }
}

/** A backup as it is kept. */
export type Backup = {
  id: string; env: MagentoEnv; view: string; identifier: string; pageId: string; action: "create" | "update" | "restore";
  page: Record<string, unknown> | null; before: string; written: boolean;
};

/** The page brought back as it was before a write - itself backed up first. A page the write CREATED is switched off
 * (inactive), never deleted. */
export async function restorePage(m: MagentoRequest, b: Backup, x: { by: string; backups: Backups }): Promise<{ action: "restored" | "switched-off"; backupId: string }> {
  if (!b.written) throw new MagentoError("That write never reached Magento - there is nothing to bring back.", 409);
  if (!b.pageId) throw new MagentoError("That backup names no Magento page.", 409);
  const now = await call<MagentoPage>(m, "GET", "all", `/cmsPage/${encodeURIComponent(b.pageId)}`);
  const { content, ...rest } = now;
  const back: Record<string, unknown> = b.action === "create"
    ? { active: false }
    : {
      content: b.before,
      ...(b.page && typeof b.page.title === "string" ? { title: b.page.title } : {}),
      ...(b.page && typeof b.page.meta_title === "string" ? { meta_title: b.page.meta_title } : {}),
      ...(b.page && typeof b.page.meta_description === "string" ? { meta_description: b.page.meta_description } : {}),
      // its URL key too, when the write gave it a new one (the search engine fields)
      ...(b.page && typeof b.page.identifier === "string" && b.page.identifier ? { identifier: b.page.identifier } : {}),
      ...(b.page && typeof b.page.active === "boolean" ? { active: b.page.active } : {}),
    };
  const backupId = await x.backups.add({
    env: b.env, view: b.view, identifier: b.identifier, pageId: b.pageId, title: String(now.title ?? ""), page: rest, before: String(content ?? ""),
    after: String(back.content ?? content ?? ""), action: "restore", by: x.by,
  });
  try {
    await call(m, "PUT", "all", `/cmsPage/${encodeURIComponent(b.pageId)}`, { page: { ...now, ...back } });
    await x.backups.written(backupId, b.pageId);
  } catch (e) {
    await x.backups.failed(backupId, (e as Error).message.slice(0, 500));
    throw e;
  }
  return { action: b.action === "create" ? "switched-off" : "restored", backupId };
}

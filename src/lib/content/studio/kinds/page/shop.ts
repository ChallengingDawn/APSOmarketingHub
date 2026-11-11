// PAGE - THE SHOP'S PAGE FOR THE STUDIO (server, 08.11.2026). Read through APSOconvert's own reader (shopPage: kept ten
// minutes, one read at a time per page, so the studio, APSOconvert's preview and the AI all see the same page and the
// shop is read at a person's pace - its firewall bans bursts).
//
// The preview is a STILL PICTURE of the page: the studio's frame is a srcDoc frame without scripts, and a srcDoc frame
// lives under the hub's own rules (style-src 'self'), which refuse the shop's stylesheets. So the server puts them
// inside the page (read once per theme version and kept a day), lays the changes over it (./apply.ts) and hands the
// browser one finished HTML document. What the shop draws with its scripts (a product's articles, prices, stock) is not
// in a still picture - said beside it.
//
// A NEW page shows the way it will on the shop, in its language: inside one of that store view's own CMS pages (its
// header, menu and footer), the page's content where a CMS page's content goes. SARCLA 08.11.2026 about the old
// "Shown inside ..." setting: "this makes no sense" - so the studio picks that page itself (the `shell`).

import { readPage } from "@/lib/directup/check";
import { query } from "@/lib/db/client";
import { ENVS, classify, isKind, nameFromRest, type Env, type PageKind } from "@/lib/convert/model";
import { ensureConvertSchema } from "@/lib/convert/pages";
import { outline, staticBase } from "@/lib/convert/preview";
import { board, cleanPath, shopPage, themeAssets, type ShopPage } from "@/lib/convert/studio";
import { cmsTarget } from "@/lib/convert/ship";
import type { SeoFields, Want } from "@/lib/convert/cmsPage";
import { getAsset } from "@/lib/content/assets";
import { getPiece } from "@/lib/content/workflow";
import { readDoc } from "../../store";
import { isPreset, normalizeBanner } from "../banner/model";
import { pasteBlock, prefixFor, stillMarkup } from "../banner/render";
import { STILL_CSS, absoluteCss, applyChanges, innerOf, insideOf, stillPage, stylesheetsOf, type AnyChange, type Hit } from "./apply";
import {
  INSERT_WHERE_LABEL, MAIN_SELECTOR, alternatesByStore, baseStore, changeLine, countryStore, pathIn, counterpartIn, finalChanges, isLegacyBody, langOfStore, languageOfStore, newPagePaste, pageDoc,
  styleBlock, storesOfView, unwritten, leftoversOf, urlKeyOf, versionLabel, viewName, viewOf, type Insert, type PageDoc, type PageOutline, type PasteBlock,
} from "./model";
import { framedPage, pageHtml, renderNewPage, type InsertHtml } from "./newpage";
import { PAGE_LAYOUT, ROW_CLASS, framePage, oneColumn } from "./frame";
import { hubPicturesIn, mediaAddress, mediaFileOf, mediaGallerySteps, pictureAltsIn, pictureState, pictureWordsOf, withMediaAddresses, type MediaFile, type MediaHead, type PictureCheck } from "./media";
import { contentAddress, contentFileOf, contentMediaState } from "./contentMedia";
import { storeFailed, storePictures } from "./pictureStore";
import { moduleLinks, relinkHtml, shopLinkOf } from "./links";
import https from "node:https";

/**
 * A version's content with its links to the shop in its own store view (Content v10, SARCLA point 9): the page goes to one
 * store view - its address there; to several - Magento's {{store direct_url}}, each visitor's own store view. A link of
 * another language is said (it needs that language's page - the translation's relink finds them).
 */
function linked(html: string, doc: PageDoc, view: string, warnings?: string[]): string {
  const stores = storesOfView(doc, view);
  const r = relinkHtml(html, viewOf(doc, view).store, stores.length);
  if (warnings && r.foreign.length) warnings.push(`${r.foreign.length} link${r.foreign.length === 1 ? " goes" : "s go"} to another language's page (${r.foreign.slice(0, 2).join(", ")}) - pick ${r.foreign.length === 1 ? "its" : "their"} ${viewName(view).split(" · ")[1] ?? ""} page${r.foreign.length === 1 ? "" : "s"} in the page's settings.`);
  return r.html;
}

/* ── reading the page ─────────────────────────────────────────────────── */

const SANDBOX_HINT = "The local sandbox does not reach the shop - start it with SANDBOX_SHOP=read to read its pages.";

function shopError(e: unknown): string {
  const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = err?.code ?? err?.cause?.code;
  const msg = String(err?.message ?? err?.cause?.message ?? e);
  if (code === "ESANDBOX" || /^sandbox:/.test(msg)) return SANDBOX_HINT;
  return `The shop could not be read just now (${msg.slice(0, 120)}). Try again in a moment.`;
}

/** A fresh read at most every 30 seconds per page - the button is for "the shop changed", not for a loop. */
const FRESH = new Map<string, number>();

async function readPath(env: Env, rawPath: string, fresh: boolean): Promise<{ ok: true; page: ShopPage } | { ok: false; error: string }> {
  const path = cleanPath(rawPath);
  if (!path) return { ok: false, error: "Pick a page first." };
  const key = `${env}${path}`;
  const now = Date.now();
  const again = fresh && now - (FRESH.get(key) ?? 0) > 30_000;
  if (again) FRESH.set(key, now);
  try {
    const page = await shopPage(env, path, again);
    if (page.status !== 200) return { ok: false, error: `The shop answered ${page.status} for ${path}.` };
    return { ok: true, page };
  } catch (e) {
    return { ok: false, error: shopError(e) };
  }
}

export async function readShopPage(d: PageDoc, fresh = false): Promise<{ ok: true; page: ShopPage } | { ok: false; error: string }> {
  return readPath(d.env, d.path, fresh);
}

/* ── its stylesheets, kept ────────────────────────────────────────────── */

const SHEETS = new Map<string, { at: number; css: string | null }>();
const SHEET_TTL = 24 * 3600_000;
const SHEET_MAX = 3_000_000;
const own = (u: string) => u.startsWith(`${ENVS.prod.base}/`) || u.startsWith(`${ENVS.acc.base}/`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sheet(url: string): Promise<{ css: string | null; read: boolean }> {
  const held = SHEETS.get(url);
  if (held && Date.now() - held.at < SHEET_TTL) return { css: held.css, read: false };
  let css: string | null = null;
  try {
    const r = await readPage(url, 20_000);
    if (r.status === 200 && r.body.length <= SHEET_MAX && !/<html[\s>]/i.test(r.body.slice(0, 500))) css = absoluteCss(r.body, url);
  } catch { css = null; }
  SHEETS.set(url, { at: Date.now(), css });
  while (SHEETS.size > 30) SHEETS.delete(SHEETS.keys().next().value as string);
  return { css, read: true };
}

/** The page's own stylesheets (the shop's, at most eight), read one after the other. Outside ones (fonts) stay out. */
async function sheetsFor(html: string, pageUrl: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const url of stylesheetsOf(html, pageUrl).filter(own).slice(0, 8)) {
    const r = await sheet(url);
    if (r.css !== null) out[url] = r.css;
    if (r.read) await sleep(250);
  }
  return out;
}

async function still(page: ShopPage, html: string): Promise<{ html: string; styled: boolean }> {
  const [theme, sheets] = await Promise.all([themeAssets(staticBase(page.html)), sheetsFor(page.html, page.url)]);
  return { html: stillPage(html, { pageUrl: page.url, sheets, tail: `${theme.css}\n${STILL_CSS}`, sprite: theme.sprite }), styled: Object.keys(sheets).length > 0 };
}

/* ── the banners placed in the page ───────────────────────────────────── */

export type InsertOut = { id: string; pieceId: number; where: Insert["where"]; title: string; ok: boolean; html: string; paste: string; error?: string };

/** Each banner placed in the page, drawn by the banner studio's own renderer: frozen for the preview, whole for Magento.
 * A banner whose to-do was removed (or never drawn) says so - the page shows without it and offers to take it out. */
export async function insertsOf(d: PageDoc): Promise<InsertOut[]> {
  const out: InsertOut[] = [];
  for (const ins of d.inserts) {
    const base = { id: ins.id, pieceId: ins.pieceId, where: ins.where };
    try {
      const [piece, stored] = await Promise.all([getPiece(ins.pieceId), readDoc(ins.pieceId)]);
      if (!piece || !stored) { out.push({ ...base, title: piece?.title ?? "A banner", ok: false, html: "", paste: "", error: "This banner's to-do was removed." }); continue; }
      const b = normalizeBanner(stored.doc);
      const key = isPreset(ins.preset) ? ins.preset : "band";
      const prefix = prefixFor(ins.pieceId);
      const s = stillMarkup(b, key, prefix);
      out.push({ ...base, title: piece.title, ok: true, html: `<style>${s.css}</style>${s.html}`, paste: pasteBlock(b, key, prefix, piece.title) });
    } catch (e) {
      out.push({ ...base, title: "A banner", ok: false, html: "", paste: "", error: `It could not be drawn (${String((e as Error)?.message ?? e).slice(0, 80)}).` });
    }
  }
  return out;
}

const insertBox = (x: InsertOut, marks: boolean) => `<div class="apx-ins"${marks ? ` data-apx-insert="${x.id}"` : ""} style="margin:24px 0">${x.html}</div>`;

/** The banners of an existing page, as changes laid over it after the page's own: at the top of its content, after its
 * first paragraph, at its end. */
function insertChanges(list: InsertOut[], marks: boolean): AnyChange[] {
  return list.filter((x) => x.ok).map((x): AnyChange => x.where === "top"
    ? { op: "insert", selector: MAIN_SELECTOR, where: "prepend", html: insertBox(x, marks) }
    : x.where === "after-intro"
      ? { op: "insert", selector: `${MAIN_SELECTOR} p`, where: "after", html: insertBox(x, marks) }
      : { op: "insert", selector: MAIN_SELECTOR, where: "append", html: insertBox(x, marks) });
}

/* ── the store's page a new page is shown in ──────────────────────────── */

const SHELL_PAGES = new Map<string, { at: number; path: string }>();
/** Pages whose layout is not a plain content page (a form, a tool) - never the frame of a new page. */
const NOT_A_SHELL = /(contact|newsletter|cookie|privacy|imprint|access-denied|language|product-finder|configurator|upload|compatibility|3d-cad|black-friday|private-sales)/i;

/** A plain CMS page of the store view (about us first), else its home page - read from the shop's index. */
async function shellPath(env: Env, store: string): Promise<string> {
  const key = `${env}|${store}`;
  const held = SHELL_PAGES.get(key);
  if (held && Date.now() - held.at < 6 * 3600_000) return held.path;
  let path = `/${store}/`;
  try {
    await ensureConvertSchema();
    const r = await query<{ url: string; rest: string }>(
      `SELECT url, rest FROM apsomh_convert_pages WHERE env = $1 AND store = $2 AND kind = 'cms' AND gone_at IS NULL ORDER BY (rest ILIKE '%about%') DESC, length(rest) LIMIT 40`,
      [env, store]);
    const best = r.rows.find((x) => !NOT_A_SHELL.test(x.rest));
    if (best) path = new URL(best.url).pathname;
  } catch { /* the home page */ }
  SHELL_PAGES.set(key, { at: Date.now(), path });
  return path;
}

/** The store's own page with its content area emptied for a new page: `#apx-root` is where the page goes. */
export async function shellOf(env: Env, store: string, fresh = false): Promise<{ ok: true; html: string; url: string; styled: boolean } | { ok: false; error: string }> {
  const path = await shellPath(env, store);
  let r = await readPath(env, path, fresh);
  if (!r.ok && path !== `/${store}/`) r = await readPath(env, `/${store}/`, fresh);
  if (!r.ok) return r;
  const page = r.page;
  const root = `<div class="columns"><div class="column main"><div id="apx-root"></div></div></div>`;
  const emptied = applyChanges(page.html, [{ op: "html", selector: "#maincontent", html: root }]);
  // the CMS page's own title and breadcrumbs belong to that page, not to the new one
  const hidden = applyChanges(emptied.html, [{ op: "hide", selector: ".breadcrumbs", all: true }, { op: "hide", selector: ".page-title-wrapper", all: true }]).html;
  // the new page's layout, whatever the store's page was: one column (./frame.ts PAGE_LAYOUT - what Magento gets)
  const html = oneColumn(hidden);
  const s = await still(page, html);
  return { ok: true, html: s.html, url: page.url, styled: s.styled };
}

/* ── the preview ──────────────────────────────────────────────────────── */

export type ChangeHit = { index: number; state: Hit["state"]; count: number };
export type PreviewOut =
  | { ok: true; html: string; url: string; side: "before" | "after" | "shell"; hits: ChangeHit[]; body: Hit | null; problems: string[]; notes: string[]; inserts: InsertOut[] }
  | { ok: false; error: string };

const HELD = new Map<string, { at: number; out: PreviewOut }>();
const hash = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };

/** The page for the preview: one language (`lang`), as it is (before), with its changes (after), or - a new page - the
 * store's page it shows in (shell), the studio drawing the page itself into it as it is typed. */
export async function previewOf(raw: unknown, side: "before" | "after" | "shell", fresh = false, lang: string | null = null): Promise<PreviewOut> {
  const doc = pageDoc(raw);
  const d = viewOf(doc, lang);
  const inserts = side === "before" ? [] : await insertsOf(d);
  if (d.source === "new") {
    const shell = await shellOf(d.env, d.store, fresh);
    if (!shell.ok) return shell;
    const notes = shell.styled ? [] : ["The shop's styles could not be read - the page shows unstyled."];
    if (side === "shell") return { ok: true, html: shell.html, url: shell.url, side, hits: [], body: null, problems: [], notes, inserts };
    const final = finalChanges(d);
    const body = isLegacyBody(d) ? (final.changes.find((c) => c.op === "html") as { html?: string } | undefined)?.html ?? "" : (() => {
      const r = renderNewPage(d.fields, { store: d.store, inserts: inserts.filter((x) => x.ok).map((x): InsertHtml => ({ id: x.id, where: x.where, html: x.html })) });
      // in the row and the element Magento gets (./frame.ts) - the same frame, the same column
      return framedPage(r);
    })();
    const rest = final.changes.filter((c) => !(c.op === "html" && c.selector === "#maincontent"));
    const html = applyChanges(shell.html.replace(`<div id="apx-root"></div>`, `<div id="apx-root">${body}</div>`), rest as AnyChange[]).html;
    return { ok: true, html, url: shell.url, side, hits: [], body: null, problems: final.problems, notes, inserts };
  }
  const r = await readShopPage(d, fresh);
  if (!r.ok) return r;
  const page = r.page;
  const final = side === "after" ? finalChanges(d) : { changes: [], problems: [], from: [] };
  const key = `${page.env}${page.path}|${page.at}|${side}|${hash(JSON.stringify(final.changes))}|${hash(JSON.stringify(inserts.map((x) => [x.id, x.where, x.html.length, hash(x.html)])))}`;
  const held = HELD.get(key);
  if (held && Date.now() - held.at < 5 * 60_000) return held.out;

  const applied = applyChanges(page.html, final.changes as AnyChange[], { marks: final.from });
  const withInserts = inserts.length ? applyChanges(applied.html, insertChanges(inserts, true)).html : applied.html;
  const s = await still(page, withInserts);
  const hits: ChangeHit[] = [];
  let body: Hit | null = null;
  applied.hits.forEach((h, k) => {
    const from = final.from[k];
    if (from < 0) body = h;
    else hits.push({ index: from, state: h.state, count: h.count });
  });
  const notes: string[] = [];
  const kind = classify(page.path).kind;
  if (kind === "product" || kind === "category") notes.push("What the shop draws with its scripts - the articles, prices and stock - is not in this picture.");
  if (page.env === "acc") notes.push("ACC's own pictures are not shown here.");
  if (!s.styled) notes.push("The shop's styles could not be read - the page shows unstyled.");
  const out: PreviewOut = { ok: true, html: s.html, url: page.url, side: side === "before" ? "before" : "after", hits, body, problems: final.problems, notes, inserts };
  HELD.set(key, { at: Date.now(), out });
  while (HELD.size > 16) HELD.delete(HELD.keys().next().value as string);
  return out;
}

/* ── what the AI is shown ─────────────────────────────────────────────── */

export async function outlineOf(raw: unknown, lang: string | null = null): Promise<{ ok: true; outline: PageOutline } | { ok: false; error: string }> {
  const d = viewOf(pageDoc(raw), lang);
  const r = await readShopPage(d);
  if (!r.ok) return r;
  const o = outline(r.page.html);
  return { ok: true, outline: pageDoc({ outline: { env: d.env, path: r.page.path, ...o } }).outline! };
}

/** The same page in another language, from the main page's hreflang links. */
export async function counterpartOf(raw: unknown, lang: string, prefer: string | null = null): Promise<{ ok: true; path: string | null; store: string | null } | { ok: false; error: string }> {
  const d = pageDoc(raw);
  if (d.source === "new") return { ok: true, path: null, store: null };
  const r = await readShopPage(d);
  if (!r.ok) return r;
  const path = counterpartIn(r.page.html, lang, d.store, prefer);
  return { ok: true, path, store: path ? classify(path).store : null };
}

/**
 * A translated new page's links, moved to its own language: each shop page it links to, read once, gives its
 * counterpart from its hreflang links (/de-CH/dichtungstechnik.html -> /fr-CH/technologie-de-l-etancheite.html).
 * A page with no counterpart keeps its address (and is said).
 */
export async function relinkOf(raw: unknown, lang: string): Promise<{ map: Record<string, string>; missing: string[] }> {
  const doc = pageDoc(raw);
  const d = viewOf(doc, lang);
  const f = d.fields;
  const store = d.store;
  // the key is a store view now ("fr-CH"): its language finds the links' counterparts
  lang = langOfStore(store);
  // Content v10 (SARCLA point 9): its modules' products and categories too - never a de-CH address in an English page
  const modLinks = (f.modules ?? []).flatMap((m) => moduleLinks(m.module.settings));
  const urls = [...new Set([f.hero.button.url, f.cta.button.url, ...f.links.map((l) => l.url), ...modLinks].filter((u) => {
    const l = shopLinkOf(u);
    // another language's page only: one of the same language is put in this store view by the renderer (./links.ts)
    return !!l && l.store.slice(0, 2) !== store.slice(0, 2);
  }))].slice(0, 40);
  const map: Record<string, string> = {};
  const missing: string[] = [];
  for (const u of urls) {
    const l = shopLinkOf(u)!;
    const path = `/${l.store}/${l.rest}`;
    const r = await readPath(doc.env, path, false);
    // a store view in its second currency (fr-CH/eur): the same page under its own prefix (pathIn)
    const found = r.ok ? counterpartIn(r.page.html, lang, store, store) : null;
    const to = pathIn(found, store) ?? found;
    // an address kept whole (a module's card) stays whole
    if (to) map[u] = /^https:/i.test(u) ? `${ENVS.prod.base}${to}` : to; else missing.push(u);
  }
  return { map, missing };
}

/* ── the page in each store view: is it on the shop there? ────────────── */

// SARCLA 09.11.2026: "the locales are not all complete in Magento - we select by store view". A page of the shop is in
// some store views and not in others: the page index says which (the same address in that store view, or the address
// the page's own hreflang links give for it). Nothing found while the index holds that store view = not on the shop
// there; a store view the index does not hold at all = not known.

export type Presence = { exists: boolean | null; path: string | null };

export async function presenceOf(d: PageDoc, stores: readonly string[]): Promise<Record<string, Presence>> {
  const list = [...new Set(stores.map(baseStore).filter((s): s is string => !!s))];
  const out: Record<string, Presence> = Object.fromEntries(list.map((s) => [s, { exists: null, path: null }]));
  if (d.source === "new" || !d.path) return out;
  const c = classify(d.path);
  const rest = c.rest;
  const alts = await readShopPage(d).then((r) => (r.ok ? alternatesByStore(r.page.html) : {})).catch(() => ({} as Record<string, string>));
  try {
    await ensureConvertSchema();
    const want = list.flatMap((s) => [`${s}|${rest}`, ...(alts[s] ? [`${s}|${classify(alts[s]).rest}`] : [])]);
    // the page's own environment only (Content v8, point 7): a to-do on ACC finds ACC's pages, never production's
    const r = await query<{ store: string; rest: string; url: string; env: string }>(
      `SELECT DISTINCT ON (store, rest) store, rest, url, env FROM apsomh_convert_pages
        WHERE gone_at IS NULL AND kind <> 'system' AND env = $2 AND (store || '|' || rest) = ANY($1::text[]) ORDER BY store, rest`,
      [want, d.env]);
    const held = await query<{ store: string }>(`SELECT DISTINCT store FROM apsomh_convert_pages WHERE gone_at IS NULL AND env = $1`, [d.env]);
    const indexed = new Set(held.rows.map((x) => baseStore(x.store)).filter(Boolean));
    for (const s of list) {
      const same = r.rows.find((x) => x.store === s && x.rest === rest);
      const alt = alts[s] ? r.rows.find((x) => x.store === s && x.rest === classify(alts[s]).rest) : undefined;
      const hit = same ?? alt;
      if (hit) { let p = hit.url; try { p = new URL(hit.url).pathname; } catch { /* kept */ } out[s] = { exists: true, path: p }; }
      else out[s] = { exists: indexed.has(s) ? false : null, path: null };
    }
  } catch { /* the index cannot be read: not known */ }
  // the same store view in its other currency (de-CH/eur beside de-CH) is the same page at the same address under its
  // own prefix - the sitemaps the index reads do not list the Swiss EUR shop, so it is not known there, only likely
  const own = baseStore(d.store);
  for (const s of list) {
    if (s === own || out[s]?.path || countryStore(s) !== countryStore(own)) continue;
    out[s] = { exists: out[s]?.exists ?? null, path: `/${s}/${rest}` };
  }
  if (own) out[own] = { exists: true, path: d.path };
  return out;
}

/* ── the shop's pages, for the list to pick from ──────────────────────── */

export type PageRow = {
  store: string; rest: string; kind: PageKind; product: string | null; name: string; path: string; env: Env; convert: { status: string; rev: number; idea: string } | null;
  /** an ACC page production does not have (Content v8: the picker says "only on ACC") */
  onlyAcc?: boolean;
};

/**
 * The shop's indexed pages, searched by words - every word must be in the address (umlauts as the shop writes them:
 * "dichtung", "o-ring") or be the product number. Plain and fast: one table, 40 a time. `env` (Content v8, SARCLA
 * 10.11.2026 point 7 - "I can't select ACC"): production's pages, or ACC's (each saying when production has no such page;
 * `onlyAcc` lists those alone); none (an older caller) = production first, ACC where a page is only there.
 */
export async function findPages(f: { q: string; store: string | null; kind: PageKind | null; page: number; perPage: number; env?: Env | null; onlyAcc?: boolean }): Promise<{ rows: PageRow[]; total: number; more: boolean }> {
  await ensureConvertSchema();
  const words = f.q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").split(/[\s/,]+/).map((w) => w.replace(/[^a-z0-9-]/g, "")).filter((w) => w.length > 1).slice(0, 5);
  const args: unknown[] = [];
  const where: string[] = ["gone_at IS NULL", "kind <> 'system'"];
  // the environment's own pages; an ACC page is "only on ACC" when production's index holds its store view, not this page
  const prodHas = (t: string) => `EXISTS (SELECT 1 FROM apsomh_convert_pages q WHERE q.env = 'prod' AND q.gone_at IS NULL AND q.store = ${t}.store AND q.rest = ${t}.rest)`;
  const prodStore = (t: string) => `EXISTS (SELECT 1 FROM apsomh_convert_pages s WHERE s.env = 'prod' AND s.gone_at IS NULL AND s.store = ${t}.store)`;
  if (f.env) { args.push(f.env); where.push(`env = $${args.length}`); }
  if (f.env === "acc" && f.onlyAcc) where.push(`NOT ${prodHas("c")} AND ${prodStore("c")}`);
  if (f.store) { args.push(f.store); where.push(`store = $${args.length}`); }
  if (f.kind) { args.push(f.kind); where.push(`kind = $${args.length}`); }
  for (const w of words) {
    args.push(`%${w}%`);
    const like = `$${args.length}`;
    if (/^\d{8}$/.test(w)) { args.push(w); where.push(`(rest ILIKE ${like} OR product = $${args.length})`); } else where.push(`rest ILIKE ${like}`);
  }
  const base = `SELECT DISTINCT ON (store, rest) store, rest, kind, product, env, url FROM apsomh_convert_pages c WHERE ${where.join(" AND ")} ORDER BY store, rest, (env = 'prod') DESC`;
  args.push(f.perPage + 1, f.page * f.perPage);
  // "only on ACC" worked out for the rows shown (41), never for the whole count
  const onlyCol = f.env === "acc" ? `, (NOT ${prodHas("x")} AND ${prodStore("x")}) AS only_acc` : f.env ? "" : ", (x.env = 'acc') AS only_acc";
  const r = await query<{ store: string; rest: string; kind: string; product: string | null; env: string; url: string; only_acc?: boolean }>(
    `SELECT x.*${onlyCol} FROM (${base}) x ORDER BY CASE kind WHEN 'home' THEN 0 WHEN 'cms' THEN 1 WHEN 'category' THEN 2 ELSE 3 END, (store = 'de-CH') DESC, store, length(rest), rest LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args);
  const countArgs = args.slice(0, -2);
  const c = await query<{ n: string }>(`SELECT count(*)::text AS n FROM (SELECT 1 FROM (${base}) y LIMIT 5000) z`, countArgs);
  const work = await convertByPath();
  const rows = r.rows.slice(0, f.perPage).filter((x) => isKind(x.kind)).map((x): PageRow => {
    let path = x.url;
    try { path = new URL(x.url).pathname; } catch { /* kept */ }
    const env: Env = x.env === "acc" ? "acc" : "prod";
    return {
      store: x.store, rest: x.rest, kind: x.kind as PageKind, product: x.product, path, env,
      name: x.kind === "home" ? "Home page" : nameFromRest(x.rest) || x.rest, convert: work.get(`${env}${path}`) ?? null,
      ...(x.only_acc ? { onlyAcc: true } : {}),
    };
  });
  return { rows, total: Number(c.rows[0]?.n ?? 0), more: r.rows.length > f.perPage };
}

let convertHeld: { at: number; map: Map<string, { status: string; rev: number; idea: string }> } | null = null;
async function convertByPath() {
  if (convertHeld && Date.now() - convertHeld.at < 60_000) return convertHeld.map;
  const map = new Map<string, { status: string; rev: number; idea: string }>();
  try {
    for (const b of await board()) {
      if (!b.version) continue;
      const key = `${b.env}${b.path}`;
      const had = map.get(key);
      if (!had || (had.status !== "approved" && b.version.status === "approved")) map.set(key, { status: b.version.status, rev: b.version.rev, idea: b.title });
    }
  } catch { /* APSOconvert's tables not there yet */ }
  convertHeld = { at: Date.now(), map };
  return map;
}

/** The pages APSOconvert has a version for - approved first: the pages the team already works on. */
export async function convertPages(): Promise<PageRow[]> {
  const out: PageRow[] = [];
  try {
    const seen = new Set<string>();
    const list = (await board()).filter((b) => b.version).sort((a, b) => Number(b.version!.status === "approved") - Number(a.version!.status === "approved"));
    for (const b of list) {
      const key = `${b.env}${b.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const c = classify(b.path);
      if (c.kind === "system") continue;
      out.push({
        store: c.store ?? "", rest: c.rest, kind: c.kind, product: c.product, path: b.path, env: b.env,
        name: c.kind === "home" ? "Home page" : nameFromRest(c.rest) || c.rest, convert: { status: b.version!.status, rev: b.version!.rev, idea: b.title },
      });
      if (out.length >= 30) break;
    }
  } catch { /* none */ }
  return out;
}

/* ── for Magento ──────────────────────────────────────────────────────── */

const strip = (html: string) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
  .replace(/<input\b[^>]*name=["']form_key["'][^>]*>/gi, "")
  .replace(/ data-apso-v=""/g, "")
  .replace(/\n\s*\n\s*\n+/g, "\n\n")
  .trim();

/** The CMS page's identifier from its address: /de-CH/ueber-uns.html -> ueber-uns. */
const identifierOf = (rest: string) => rest.replace(/\.html?$/i, "").replace(/\/+$/, "");

export type PasteOut = { ok: true; blocks: PasteBlock[]; warnings: string[]; store: string } | { ok: false; error: string };

/**
 * The hub's pictures a page shows, each with the name it gets on the shop (the hub is not public): with the hub's picture
 * storage on (./contentMedia.ts, 11.11.2026) a readable name from its words (`words`, by its path: its alt text or idea,
 * else the picture's own name or prompt) and its address there; else its file in Magento's media (apx-<id>.<ext>).
 */
async function pictureFiles(urls: string[], words: ReadonlyMap<string, string> = new Map()): Promise<Map<string, MediaFile>> {
  const out = new Map<string, MediaFile>();
  const store = contentMediaState();
  for (const u of urls) {
    const m = /^\/api\/content\/picture\/(\d+)-[\w-]+$/.exec(u);
    if (!m || out.has(u)) continue;
    const a = await getAsset(Number(m[1])).catch(() => null);
    if (!store.on) { out.set(u, { file: mediaFileOf(Number(m[1]), a?.mime), url: u }); continue; }
    const file = contentFileOf(Number(m[1]), a?.mime, words.get(u) || a?.name?.replace(/\.[a-z0-9]{2,5}$/i, "") || a?.prompt || "");
    out.set(u, { file, url: u, address: contentAddress(store.base, file) });
  }
  return out;
}

/** A picture's words for its name: its alt text in the HTML, else what the document says of it (alt, idea, a tile's name). */
function wordsOf(html: string, doc: unknown): Map<string, string> {
  const out = pictureWordsOf(doc);
  for (const [u, w] of pictureAltsIn(html)) out.set(u, w);
  return out;
}

/** Every hub picture a page's HTML names - its fields', its modules', its banners' - with its file on the shop. */
const mediaFilesOf = (html: string, doc: unknown) => pictureFiles(hubPicturesIn(html).map((p) => p.url), wordsOf(html, doc));

/**
 * A new page's content, store view by store view: ONE HTML Code element's HTML (`inner` - the hand-over pastes it) and
 * the same in its Page Builder row (`content` - what the API writes), every picture address absolute (`base`: the
 * target's - the hub's pictures are read there before Publish), its links in the visitors' store views.
 */
async function newPageContent(doc: PageDoc, d: PageDoc, base: string, inserts: InsertOut[], warnings?: string[]): Promise<{ inner: string; content: string; files: Map<string, MediaFile> }> {
  const body = renderNewPage(d.fields, { store: d.store, inserts: inserts.filter((x) => x.ok).map((x): InsertHtml => ({ id: x.id, where: x.where, html: x.paste })) });
  const linkedHtml = linked(pageHtml(body, styleBlock(finalChanges(d).changes)), doc, d.store, warnings);
  const files = await mediaFilesOf(linkedHtml, d.fields);
  const inner = withMediaAddresses(linkedHtml, files, base);
  return { inner, content: framePage(inner), files };
}

/* ── is each picture in the target's media? (a HEAD each, read at a person's pace) ── */

const UA = "Mozilla/5.0 (compatible; APSOhub picture check)";
/** One HEAD of a media address on the shop (its lenient parser - ./magentoHttp.ts says why). null: no answer. */
function headOf(url: string): Promise<MediaHead | null> {
  return new Promise((resolve) => {
    let u: URL;
    try { u = new URL(url); } catch { resolve(null); return; }
    if (u.protocol !== "https:" || !own(`${u.origin}/`)) { resolve(null); return; }
    const req = https.request(u, { method: "HEAD", insecureHTTPParser: true, headers: { "User-Agent": UA }, timeout: 12_000 }, (res) => {
      const h = res.headers;
      const len = Number(h["content-length"]);
      resolve({ status: res.statusCode ?? 0, type: String(h["content-type"] ?? ""), length: Number.isFinite(len) ? len : null, etag: String(h.etag ?? ""), modified: String(h["last-modified"] ?? "") });
      res.resume();
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => resolve(null));
    req.end();
  });
}

// Magento's answer for a file that is not there (its placeholder), per shop - read once an hour; a file found stays found
// ten minutes; a missing one is read again at every check (it is uploaded in between)
const PROBE = new Map<string, { at: number; head: MediaHead | null }>();
const FOUND = new Map<string, number>();
async function probeOf(base: string): Promise<MediaHead | null> {
  const held = PROBE.get(base);
  if (held && held.head && Date.now() - held.at < 3600_000) return held.head;
  const head = await headOf(mediaAddress(base, "apx-probe-not-a-file.jpg"));
  PROBE.set(base, { at: Date.now(), head });
  return head;
}

/** Each of the page's hub pictures in a shop's media: there, missing (Magento's placeholder), or not known. */
export async function picturesOn(env: Env, files: readonly MediaFile[]): Promise<PictureCheck[]> {
  const base = ENVS[env].base;
  const out: PictureCheck[] = [];
  if (!files.length) return out;
  const probe = await probeOf(base);
  for (const f of files) {
    const address = mediaAddress(base, f.file);
    if (Date.now() - (FOUND.get(address) ?? 0) < 10 * 60_000) { out.push({ ...f, address, state: "there" }); continue; }
    await sleep(300);
    const state = pictureState(await headOf(address), probe);
    if (state === "there") FOUND.set(address, Date.now());
    out.push({ ...f, address, state });
  }
  while (FOUND.size > 200) FOUND.delete(FOUND.keys().next().value as string);
  return out;
}

/** What a person pastes into Magento, with where it goes - one store view (each store view is its own version since
 * 09.11.2026: SARCLA "we select by store view"). Nothing is written to Magento from here. */
export async function pasteOf(raw: unknown, lang: string | null = null, _shopStores: readonly string[] = []): Promise<PasteOut> {
  const doc = pageDoc(raw);
  const d = viewOf(doc, lang);
  // one page per language (Content v10): every store view it goes to is ticked in Magento's Store View field
  const goes = storesOfView(doc, d.store);
  const storeLine = `Store View: tick ${goes.join(", ")} (${versionLabel(doc, d.store)})`;
  const final = finalChanges(d);
  const warnings = [...final.problems];
  const open = unwritten(d).length;
  if (open) warnings.unshift(`${open} text${open === 1 ? "" : "s"} still to write - the placeholder${open === 1 ? " shows" : "s show"} on the page as it is.`);
  const left = leftoversOf(d);
  if (left.length) warnings.unshift(`${left.length} placeholder${left.length === 1 ? "" : "s"} still in the words (${left.slice(0, 3).map((x) => `"${x.text.slice(0, 40)}"`).join(", ")}) - write them before it goes live.`);
  const inserts = await insertsOf(d);
  for (const x of inserts.filter((i) => !i.ok)) warnings.push(`${x.title}: ${x.error}`);
  if (d.source === "new") {
    if (isLegacyBody(d)) {
      if (!d.newPage.title.trim()) return { ok: false, error: "Give the new page its title first." };
      return { ok: true, blocks: newPagePaste(d), warnings, store: d.store };
    }
    const f = d.fields;
    if (!f.hero.title.trim()) return { ok: false, error: "Give the page its title first (the hero's title)." };
    // the home page kit's paste (10.11.2026): ONE Full Width row without padding, ONE HTML Code element, one column - the
    // hub's pictures named in the media of the shop the to-do works on
    const target = ENVS[d.env].label;
    const { inner: code, files } = await newPageContent(doc, d, ENVS[d.env].base, inserts, warnings);
    const blocks: PasteBlock[] = [
      {
        key: "fields", label: "The page's fields", lang: "text",
        steps: [
          "Content > Pages > Add New Page.",
          `Copy each value into its field. ${storeLine}. Leave "Content Heading" empty - the page's title is in its content.`,
          "Design: Layout - 1 column (as the shop's own pages; three columns squeeze the page to the left).",
        ],
        code: [
          `Page Title: ${f.hero.title.trim()}`, `URL Key: ${f.seo.urlKey.trim() || urlKeyOf(f.hero.title)}`,
          `Meta Title: ${f.seo.title.trim() || f.hero.title.trim()}`, `Meta Description: ${f.seo.description.trim()}`,
          `Layout: 1 column`,
        ].join("\n"),
      },
    ];
    // with the hub's picture storage on (11.11.2026): nothing to upload - they are stored as the hand-over is made
    const own = [...files.values()].filter((p) => p.address);
    if (own.length) {
      const out = await storePictures(own);
      const no = storeFailed(out);
      if (no) warnings.unshift(no.replace(/ - nothing was written to Magento\. Try Publish again in a moment\.$/, " - the page would show them missing. Open the hand-over again in a moment."));
      blocks.push({
        key: "pictures", label: `Its pictures (${own.length}) - in the hub's picture storage`, lang: "text",
        steps: ["Nothing to upload: the content names each picture at its address in the hub's picture storage, where the hub has stored it."],
        code: own.map((p) => `${p.file}   ${p.address}`).join("\n"),
      });
    } else if (files.size) {
      const list = [...files.values()];
      blocks.push({
        key: "pictures", label: `Its pictures (${files.size}) - into ${target}'s media first`, lang: "text",
        steps: ["The pictures are kept in the hub, which the shop's visitors cannot reach - the page shows Magento's grey placeholder until they are in its media.", ...mediaGallerySteps(target, list.map((p) => p.file))],
        code: list.map((p) => `${p.file}   <-   ${p.url}   (the page shows ${mediaAddress(ENVS[d.env].base, p.file)})`).join("\n"),
      });
    }
    blocks.push({
      key: "content", label: "The page's content", lang: "html",
      steps: [
        `In Content (Page Builder), ONE row only - delete any other: Appearance "Full Width", every margin and padding 0, CSS Classes "${ROW_CLASS}".`,
        "In it, ONE HTML Code element (Elements): paste this into it, then Save. Leave the page disabled until it is reviewed on the shop.",
      ],
      code,
    });
    return { ok: true, blocks, warnings, store: d.store };
  }
  // the search engine fields the assistant wrote for an existing page (Magento: the page's Search Engine Optimization)
  const so = seoOfView(d);
  const seoKind = d.path ? classify(d.path).kind : null;
  const seo = so.metaTitle || so.metaDescription || so.urlKey ? [{
    key: "seo", label: "Its search engine fields", lang: "text" as const,
    steps: [
      seoKind === "category" ? `Catalog > Categories: open the category, store view ${viewName(d.store)} ("Use Default Value" off), section Search Engine Optimization.`
        : seoKind === "product" ? `Catalog > Products: open the product, store view ${viewName(d.store)} ("Use Default Value" off), section Search Engine Optimization.`
          : `Content > Pages: open the page of store view ${viewName(d.store)}, section Search Engine Optimization.`,
      `Copy each value into its field and Save.${so.urlKey ? " A new URL key moves the page: its old address stops working unless a redirect is made (Marketing > URL Rewrites)." : ""}`,
    ],
    code: [so.metaTitle ? `Meta Title: ${so.metaTitle}` : "", so.metaDescription ? `Meta Description: ${so.metaDescription}` : "", so.urlKey ? `URL Key: ${so.urlKey}` : ""].filter(Boolean).join("\n"),
  }] : [];
  if (!final.changes.length && !inserts.some((x) => x.ok)) {
    if (seo.length) return { ok: true, blocks: seo, warnings, store: d.store };
    return { ok: false, error: "There are no changes to hand over yet." };
  }
  const r = await readShopPage(d);
  if (!r.ok) return r;
  const page = r.page;
  const c = classify(page.path);
  if (c.kind === "cms" || c.kind === "home") {
    const applied = applyChanges(page.html, final.changes as AnyChange[]);
    const withInserts = applyChanges(applied.html, insertChanges(inserts.map((x) => ({ ...x, html: x.paste })), false)).html;
    const main = innerOf(withInserts, MAIN_SELECTOR);
    if (main === null) return { ok: false, error: "This page has no content area Magento's editor holds (#maincontent .column.main)." };
    final.changes.forEach((ch, k) => {
      if (ch.op === "css") return;
      if (insideOf(page.html, ch.selector, MAIN_SELECTOR) === false) {
        warnings.push(`Change ${final.from[k] + 1} ("${changeLine(ch)}") is outside the page's own content - header, menu or footer need the theme.`);
      }
    });
    const where = c.kind === "home" ? `the home page of ${c.store ?? "the store"}` : `"${identifierOf(c.rest)}" (store view ${c.store ?? "-"})`;
    return {
      ok: true, warnings, store: c.store ?? d.store,
      blocks: [{
        key: "content", label: "The page's content", lang: "html",
        steps: [
          `Content > Pages: open ${where}.`,
          "Save & Duplicate it first and keep the copy disabled - Magento keeps no earlier version.",
          "In the original, remove the content rows, drag one HTML Code element (Elements) in, paste this and Save.",
        ],
        code: linked(`${styleBlock(final.changes)}${strip(main)}`, doc, d.store, warnings),
      }, ...seo],
    };
  }
  // a product or category page is the theme's code: the list itself is the hand-over
  const spec = [
    `Page: ${page.url}`,
    "",
    ...final.changes.map((ch, k) => {
      const head = `${k + 1}. ${changeLine(ch)}`;
      if (ch.op === "css") return `${head}\n${ch.css}`;
      const body = "html" in ch ? `\n${ch.html}` : "text" in ch ? `\n${ch.text}` : ch.op === "attr" ? `\n${ch.name}="${ch.value}"` : "";
      return `${head}\n   ${ch.op}${ch.op === "insert" ? ` ${ch.where}` : ""} ${ch.selector}${ch.all ? " (every match)" : ""}${body}`;
    }),
    ...inserts.filter((x) => x.ok).map((x, k) => `${final.changes.length + k + 1}. Banner "${x.title}" - ${INSERT_WHERE_LABEL[x.where].toLowerCase()} of the page's content\n${x.paste}`),
  ].join("\n");
  return {
    ok: true, warnings, store: c.store ?? d.store,
    blocks: [{
      key: "spec", label: "For the shop's developers", lang: "text",
      steps: [`A ${c.kind} page is the theme's code, not a CMS page: hand this list to the developers, or run it as an A/B test.`],
      code: spec,
    }, ...seo],
  };
}

/* ── what Magento gets, store view by store view (the last step) ──────── */

// SARCLA 09.11.2026: "The Magento publish should occur via the API". Each store view's version as the one Magento page
// it becomes: a page made here - its URL key, title, search engine fields and the content the renderer draws (the same
// renderer as the preview); an existing CMS page of the shop - its change list, put into the content Magento holds
// (src/lib/convert/cmsPage.ts). A category, a product or the home page is not a CMS page: it stays the hand-over.

export type MagentoSent = {
  /** a page made here (created or updated whole), or an existing page's changes put into its content */
  kind: "page" | "changes";
  title: string; identifier: string; metaTitle: string; metaDescription: string; size: number; active: boolean;
  /** the hub's pictures the content names in Magento's media (wysiwyg/content) - uploaded there by hand first; with the
   * hub's picture storage on, each at its `address` there - stored by Publish (11.11.2026) */
  pictures: MediaFile[];
  /** an existing page: its changes and banners */
  changes: number; banners: number;
  /** an existing page given a new URL key (its search engine fields) - "" when it keeps its own */
  newIdentifier?: string;
  /** the version of the page it is (A, B ...) when it has more than one - "" when it has one */
  letter?: string;
  /** a new page's layout in Magento ("1column") */
  layout?: string;
};

/** A page of the shop's search engine fields as set in the studio (fields.seo of its store view): each only when set. */
export function seoOfView(d: PageDoc): SeoFields {
  const s = d.fields.seo;
  const out: SeoFields = {};
  if (s.title.trim()) out.metaTitle = s.title.trim();
  if (s.description.trim()) out.metaDescription = s.description.trim();
  // a CMS page's identifier may hold a "/" ("service/o-ring-expert") - kept; anything else as a URL key writes it
  const key = s.urlKey.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9/_.-]+/g, "").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
  if (key) out.urlKey = key.slice(0, 200);
  return out;
}
export type MagentoView = {
  view: string;
  /** a CMS page the hub writes, or not (then `why`, and the hand-over) */
  cms: boolean;
  why: string | null;
  /** what keeps it from being written now (placeholders left in the words) */
  blocked: string | null;
  sent: MagentoSent | null;
  want: Want | null;
  /** its address on the shop (after the environment's base) */
  path: string | null;
};

const bytesOf = (s: string) => new TextEncoder().encode(s).length;

/** `env`: the shop it is written to - a new page's own pictures are named in that shop's media (the to-do's own when not
 * given: the status, the hand-over). */
export async function magentoOf(raw: unknown, view: string, env?: Env): Promise<MagentoView> {
  const doc = pageDoc(raw);
  const d = viewOf(doc, view);
  const base: MagentoView = { view: d.store, cms: false, why: null, blocked: null, sent: null, want: null, path: null };
  const left = leftoversOf(d);
  const open = unwritten(d).length;
  const blocked = left.length ? `${left.length} placeholder${left.length === 1 ? "" : "s"} still in the words (${left.slice(0, 2).map((x) => `"${x.text.slice(0, 40)}"`).join(", ")}) - write them first.`
    : open ? `${open} text${open === 1 ? "" : "s"} still to write.` : null;
  const inserts = (await insertsOf(d)).filter((x) => x.ok);
  if (d.source === "new") {
    if (isLegacyBody(d)) {
      const np = d.newPage;
      if (!np.title.trim()) return { ...base, cms: true, why: "Give the page its title first." };
      const content = newPagePaste(d).find((b) => b.key === "content")?.code ?? "";
      const identifier = np.urlKey.trim() || urlKeyOf(np.title);
      const want: Want = { kind: "page", identifier, title: np.title.trim(), metaTitle: np.metaTitle.trim() || np.title.trim(), metaDescription: np.metaDescription.trim(), content, active: true };
      return { ...base, cms: true, blocked, want, path: `/${d.store}/${identifier}`, sent: { kind: "page", title: want.title, identifier, metaTitle: want.metaTitle, metaDescription: want.metaDescription, size: bytesOf(content), active: true, pictures: [], changes: 0, banners: 0 } };
    }
    const f = d.fields;
    if (!f.hero.title.trim()) return { ...base, cms: true, why: "Give the page its title first (the hero's title)." };
    // the home page kit's way (10.11.2026): ONE Full Width row holding ONE HTML Code element, on a one-column page, every
    // picture address absolute - the hub's in the target's media (read there before Publish); its links in each
    // visitor's own store view (Content v10, point 9) - one page for all the store views it goes to
    const { content, files } = await newPageContent(doc, d, ENVS[env ?? d.env].base, inserts);
    const identifier = f.seo.urlKey.trim() || urlKeyOf(f.hero.title);
    const want: Want = {
      kind: "page", identifier, title: f.hero.title.trim(), metaTitle: f.seo.title.trim() || f.hero.title.trim(), metaDescription: f.seo.description.trim(), content, active: true,
      layout: PAGE_LAYOUT,
    };
    return {
      ...base, cms: true, blocked, want, path: `/${d.store}/${identifier}`,
      sent: { kind: "page", title: want.title, identifier, metaTitle: want.metaTitle, metaDescription: want.metaDescription, size: bytesOf(content), active: true, pictures: [...files.values()], changes: 0, banners: inserts.length, layout: PAGE_LAYOUT },
    };
  }
  if (!d.path) return { ...base, why: `The ${d.store} page is not picked yet.` };
  const target = cmsTarget(d.path);
  if (!target.ok) return { ...base, why: target.why, path: d.path };
  const final = finalChanges(d);
  // its search engine fields (Content v6): what was set for it here goes with it - an empty one leaves Magento's
  const seo = seoOfView(d);
  const hasSeo = !!(seo.metaTitle || seo.metaDescription || (seo.urlKey && seo.urlKey !== target.identifier));
  if (!final.changes.length && !inserts.length && !hasSeo) return { ...base, cms: true, why: "There are no changes to write yet.", path: d.path };
  const box = (x: InsertOut) => `<div class="apx-ins" style="margin:24px 0">${x.paste}</div>`;
  // the hub's own pictures in the changes (a banner put on the page from the banner studio, Content v7): named in Magento's
  // media as a new page's are - uploaded there by hand first, the hand-over lists them; the hub is not public. With the
  // hub's picture storage on (11.11.2026): at their address there, stored by Publish
  const changed = final.changes.map((ch) => ("html" in ch ? ch.html : "")).join("\n");
  const files = await pictureFiles([...new Set(changed.match(/\/api\/content\/picture\/\d+-[\w-]+/g) ?? [])], wordsOf(changed, final.changes));
  const pics = files.size ? final.changes.map((ch) => ("html" in ch ? { ...ch, html: [...files].reduce((h, [u, f]) => h.split(u).join(f.address || `{{media url='wysiwyg/content/${f.file}'}}`), ch.html) } : ch)) : final.changes;
  // its blocks' links in each visitor's own store view (Content v10, point 9) - the same changes go to every one it is for
  const changes = pics.map((ch) => ("html" in ch && typeof ch.html === "string" ? { ...ch, html: linked(ch.html, doc, d.store) } : ch));
  const want: Want = {
    kind: "changes", identifier: target.identifier, changes, tag: `content-${view}`,
    inserts: {
      top: inserts.filter((x) => x.where === "top").map(box).join(""),
      afterIntro: inserts.filter((x) => x.where === "after-intro").map(box).join(""),
      bottom: inserts.filter((x) => x.where === "bottom").map(box).join(""),
    },
    ...(hasSeo ? { seo } : {}),
  };
  return {
    ...base, cms: true, blocked: blocked ?? (final.problems.length ? `Some changes cannot go out: ${final.problems.slice(0, 2).join("; ")}` : null), want, path: d.path,
    sent: {
      kind: "changes", title: d.outline?.h1[0] ?? "", identifier: target.identifier, metaTitle: seo.metaTitle ?? "", metaDescription: seo.metaDescription ?? "",
      newIdentifier: seo.urlKey && seo.urlKey !== target.identifier ? seo.urlKey : "", size: 0, active: true, pictures: [...files.values()], changes: final.changes.length, banners: inserts.length,
      letter: d.versions.length ? d.letter : "",
    },
  };
}

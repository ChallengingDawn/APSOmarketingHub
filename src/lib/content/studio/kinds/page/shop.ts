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
import { getAsset } from "@/lib/content/assets";
import { getPiece } from "@/lib/content/workflow";
import { readDoc } from "../../store";
import { isPreset, normalizeBanner } from "../banner/model";
import { pasteBlock, prefixFor, stillMarkup } from "../banner/render";
import { STILL_CSS, absoluteCss, applyChanges, innerOf, insideOf, stillPage, stylesheetsOf, type AnyChange, type Hit } from "./apply";
import { fieldPictures } from "./fields";
import {
  INSERT_WHERE_LABEL, MAIN_SELECTOR, changeLine, counterpartIn, finalChanges, isLegacyBody, langOfStore, languageOfStore, newPagePaste, pageDoc, shopLanguages,
  styleBlock, unwritten, leftoversOf, urlKeyOf, viewOf, type Insert, type PageDoc, type PageOutline, type PasteBlock,
} from "./model";
import { renderNewPage, type InsertHtml } from "./newpage";

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
  const html = applyChanges(emptied.html, [{ op: "hide", selector: ".breadcrumbs", all: true }, { op: "hide", selector: ".page-title-wrapper", all: true }]).html;
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
      const r = renderNewPage(d.fields, { inserts: inserts.filter((x) => x.ok).map((x): InsertHtml => ({ id: x.id, where: x.where, html: x.html })) });
      return `<style>${r.css}</style>${r.html}`;
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
  const urls = [...new Set([f.hero.button.url, f.cta.button.url, ...f.links.map((l) => l.url)].filter((u) => /^\/[a-z]{2}-[A-Z]{2,3}\//.test(u) &&!u.startsWith(`/${store}/`)))].slice(0, 16);
  const map: Record<string, string> = {};
  const missing: string[] = [];
  for (const u of urls) {
    const r = await readPath(doc.env, u, false);
    const to = r.ok ? counterpartIn(r.page.html, lang, store, store) : null;
    if (to) map[u] = to; else missing.push(u);
  }
  return { map, missing };
}

/* ── the shop's pages, for the list to pick from ──────────────────────── */

export type PageRow = { store: string; rest: string; kind: PageKind; product: string | null; name: string; path: string; env: Env; convert: { status: string; rev: number; idea: string } | null };

/**
 * The shop's indexed pages (production first, ACC where a page is only there), searched by words - every word must be
 * in the address (umlauts as the shop writes them: "dichtung", "o-ring") or be the product number. Plain and fast:
 * one table, no join, 40 a time.
 */
export async function findPages(f: { q: string; store: string | null; kind: PageKind | null; page: number; perPage: number }): Promise<{ rows: PageRow[]; total: number; more: boolean }> {
  await ensureConvertSchema();
  const words = f.q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").split(/[\s/,]+/).map((w) => w.replace(/[^a-z0-9-]/g, "")).filter((w) => w.length > 1).slice(0, 5);
  const args: unknown[] = [];
  const where: string[] = ["gone_at IS NULL", "kind <> 'system'"];
  if (f.store) { args.push(f.store); where.push(`store = $${args.length}`); }
  if (f.kind) { args.push(f.kind); where.push(`kind = $${args.length}`); }
  for (const w of words) {
    args.push(`%${w}%`);
    const like = `$${args.length}`;
    if (/^\d{8}$/.test(w)) { args.push(w); where.push(`(rest ILIKE ${like} OR product = $${args.length})`); } else where.push(`rest ILIKE ${like}`);
  }
  const base = `SELECT DISTINCT ON (store, rest) store, rest, kind, product, env, url FROM apsomh_convert_pages WHERE ${where.join(" AND ")} ORDER BY store, rest, (env = 'prod') DESC`;
  args.push(f.perPage + 1, f.page * f.perPage);
  const r = await query<{ store: string; rest: string; kind: string; product: string | null; env: string; url: string }>(
    `SELECT * FROM (${base}) x ORDER BY CASE kind WHEN 'home' THEN 0 WHEN 'cms' THEN 1 WHEN 'category' THEN 2 ELSE 3 END, (store = 'de-CH') DESC, store, length(rest), rest LIMIT $${args.length - 1} OFFSET $${args.length}`,
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

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };

/** The hub's pictures a page shows, each with the name it gets in Magento's media (the hub is not public). */
async function pictureFiles(urls: string[]): Promise<Map<string, { file: string; url: string }>> {
  const out = new Map<string, { file: string; url: string }>();
  for (const u of urls) {
    const m = /^\/api\/content\/picture\/(\d+)-[\w-]+$/.exec(u);
    if (!m || out.has(u)) continue;
    const a = await getAsset(Number(m[1])).catch(() => null);
    out.set(u, { file: `apx-${m[1]}.${EXT[a?.mime ?? ""] ?? "jpg"}`, url: u });
  }
  return out;
}

/** What a person pastes into Magento, with where it goes - one language. Nothing is written to Magento from here. */
export async function pasteOf(raw: unknown, lang: string | null = null, shopStores: readonly string[] = []): Promise<PasteOut> {
  const d = viewOf(pageDoc(raw), lang);
  // a CMS page is given every store view of its language (SARCLA 08.11.2026: "we should have all locales")
  const views = shopLanguages(shopStores, d.store).find((x) => x.lang === langOfStore(d.store))?.stores ?? [d.store];
  const storeViews = [d.store, ...views.filter((x) => x !== d.store)];
  const storeLine = storeViews.length > 1 ? `Store View: ${storeViews.join(", ")} - every ${languageOfStore(d.store) ?? ""} store view of the shop (Ctrl-click to pick several)` : `Store View: ${d.store}`;
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
    const files = await pictureFiles(fieldPictures(f).map((p) => p.pic.url));
    const body = renderNewPage(f, {
      inserts: inserts.filter((x) => x.ok).map((x): InsertHtml => ({ id: x.id, where: x.where, html: x.paste })),
      picture: (u) => { const p = files.get(u); return p ? `{{media url="wysiwyg/content/${p.file}"}}` : u; },
    });
    const rest = final.changes;
    const code = `<style>\n${body.css}\n</style>\n${styleBlock(rest)}${body.html}`;
    const blocks: PasteBlock[] = [
      {
        key: "fields", label: "The page's fields", lang: "text",
        steps: [
          "Content > Pages > Add New Page.",
          `Copy each value into its field. ${storeLine}. Leave "Content Heading" empty - the page's title is in its content.`,
        ],
        code: [
          `Page Title: ${f.hero.title.trim()}`, `URL Key: ${f.seo.urlKey.trim() || urlKeyOf(f.hero.title)}`,
          `Meta Title: ${f.seo.title.trim() || f.hero.title.trim()}`, `Meta Description: ${f.seo.description.trim()}`,
        ].join("\n"),
      },
    ];
    if (files.size) {
      blocks.push({
        key: "pictures", label: `Its pictures (${files.size})`, lang: "text",
        steps: [
          "The pictures are kept in the hub, which the shop's visitors cannot reach: download each one (its address below, opened in the hub).",
          "Content > Media Gallery: in the folder wysiwyg/content, upload each under the name given here - the page's content already points there.",
        ],
        code: [...files.values()].map((p) => `${p.file}   <-   ${p.url}`).join("\n"),
      });
    }
    blocks.push({
      key: "content", label: "The page's content", lang: "html",
      steps: ["In Content, drag one HTML Code element (Elements) onto the stage.", "Paste this into it, then Save. Leave the page disabled until it is reviewed on the shop."],
      code,
    });
    return { ok: true, blocks, warnings, store: d.store };
  }
  // the search engine fields the assistant wrote for an existing page (Magento: the page's Search Engine Optimization)
  const seo = d.fields.seo.title.trim() || d.fields.seo.description.trim() ? [{
    key: "seo", label: "Its search engine fields", lang: "text" as const,
    steps: ["Open the page in Magento (Content > Pages, or the category / product), section Search Engine Optimization.", "Copy each value into its field and Save."],
    code: [`Meta Title: ${d.fields.seo.title.trim()}`, `Meta Description: ${d.fields.seo.description.trim()}`].join("\n"),
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
        code: `${styleBlock(final.changes)}${strip(main)}`,
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

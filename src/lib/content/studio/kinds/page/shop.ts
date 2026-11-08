// PAGE - THE SHOP'S PAGE FOR THE STUDIO (server, 08.11.2026). Read through APSOconvert's own reader (shopPage: kept ten
// minutes, one read at a time per page, so the studio, APSOconvert's preview and the AI all see the same page and the
// shop is read at a person's pace - its firewall bans bursts).
//
// The preview is a STILL PICTURE of the page: the studio's frame is a srcDoc frame without scripts, and a srcDoc frame
// lives under the hub's own rules (style-src 'self'), which refuse the shop's stylesheets. So the server puts them
// inside the page (read once per theme version and kept a day), lays the changes over it (./apply.ts) and hands the
// browser one finished HTML document. What the shop draws with its scripts (a product's articles, prices, stock) is not
// in a still picture - said beside it.

import { readPage } from "@/lib/directup/check";
import { ENVS, classify } from "@/lib/convert/model";
import { outline, staticBase } from "@/lib/convert/preview";
import { cleanPath, shopPage, themeAssets, type ShopPage } from "@/lib/convert/studio";
import { STILL_CSS, absoluteCss, applyChanges, innerOf, insideOf, stillPage, stylesheetsOf, type AnyChange, type Hit } from "./apply";
import {
  MAIN_SELECTOR, changeLine, finalChanges, newPagePaste, pageDoc, styleBlock, unwritten,
  type PageDoc, type PageOutline, type PasteBlock,
} from "./model";

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

export async function readShopPage(d: PageDoc, fresh = false): Promise<{ ok: true; page: ShopPage } | { ok: false; error: string }> {
  const path = cleanPath(d.path);
  if (!path) return { ok: false, error: d.source === "new" ? "Pick the store's page the new page is shown in." : "Pick a page first." };
  const key = `${d.env}${path}`;
  const now = Date.now();
  const again = fresh && now - (FRESH.get(key) ?? 0) > 30_000;
  if (again) FRESH.set(key, now);
  try {
    const page = await shopPage(d.env, path, again);
    if (page.status !== 200) return { ok: false, error: `The shop answered ${page.status} for ${path}.` };
    return { ok: true, page };
  } catch (e) {
    return { ok: false, error: shopError(e) };
  }
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

/* ── the preview ──────────────────────────────────────────────────────── */

export type ChangeHit = { index: number; state: Hit["state"]; count: number };
export type PreviewOut =
  | { ok: true; html: string; url: string; side: "before" | "after"; hits: ChangeHit[]; body: Hit | null; problems: string[]; notes: string[] }
  | { ok: false; error: string };

const HELD = new Map<string, { at: number; out: PreviewOut }>();
const hash = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };

export async function previewOf(raw: unknown, side: "before" | "after", fresh = false): Promise<PreviewOut> {
  const d = pageDoc(raw);
  const r = await readShopPage(d, fresh);
  if (!r.ok) return r;
  const page = r.page;
  const final = side === "after" ? finalChanges(d) : { changes: [], problems: [], from: [] };
  const key = `${page.env}${page.path}|${page.at}|${side}|${hash(JSON.stringify(final.changes))}`;
  const held = HELD.get(key);
  if (held && Date.now() - held.at < 5 * 60_000) return held.out;

  const applied = applyChanges(page.html, final.changes as AnyChange[]);
  const [theme, sheets] = await Promise.all([themeAssets(staticBase(page.html)), sheetsFor(page.html, page.url)]);
  const html = stillPage(applied.html, { pageUrl: page.url, sheets, tail: `${theme.css}\n${STILL_CSS}`, sprite: theme.sprite });
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
  if (!Object.keys(sheets).length) notes.push("The shop's styles could not be read - the page shows unstyled.");
  const out: PreviewOut = { ok: true, html, url: page.url, side, hits, body, problems: final.problems, notes };
  HELD.set(key, { at: Date.now(), out });
  while (HELD.size > 16) HELD.delete(HELD.keys().next().value as string);
  return out;
}

/* ── what the AI is shown ─────────────────────────────────────────────── */

export async function outlineOf(raw: unknown): Promise<{ ok: true; outline: PageOutline } | { ok: false; error: string }> {
  const d = pageDoc(raw);
  const r = await readShopPage(d);
  if (!r.ok) return r;
  const o = outline(r.page.html);
  return { ok: true, outline: pageDoc({ outline: { env: d.env, path: r.page.path, ...o } }).outline! };
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

export type PasteOut = { ok: true; blocks: PasteBlock[]; warnings: string[] } | { ok: false; error: string };

/** What a person pastes into Magento, with where it goes. Nothing is written to Magento from here. */
export async function pasteOf(raw: unknown): Promise<PasteOut> {
  const d = pageDoc(raw);
  const final = finalChanges(d);
  const warnings = [...final.problems];
  const open = unwritten(d).length;
  if (open) warnings.unshift(`${open} text${open === 1 ? "" : "s"} still to write - the placeholder${open === 1 ? " shows" : "s show"} on the page as it is.`);
  if (d.source === "new") {
    if (!d.newPage.title.trim()) return { ok: false, error: "Give the new page its title first." };
    return { ok: true, blocks: newPagePaste(d), warnings };
  }
  if (!final.changes.length) return { ok: false, error: "There are no changes to hand over yet." };
  const r = await readShopPage(d);
  if (!r.ok) return r;
  const page = r.page;
  const c = classify(page.path);
  if (c.kind === "cms" || c.kind === "home") {
    const applied = applyChanges(page.html, final.changes as AnyChange[]);
    const main = innerOf(applied.html, MAIN_SELECTOR);
    if (main === null) return { ok: false, error: "This page has no content area Magento's editor holds (#maincontent .column.main)." };
    final.changes.forEach((ch, k) => {
      if (ch.op === "css") return;
      if (insideOf(page.html, ch.selector, MAIN_SELECTOR) === false) {
        warnings.push(`Change ${final.from[k] + 1} ("${changeLine(ch)}") is outside the page's own content - header, menu or footer need the theme.`);
      }
    });
    const where = c.kind === "home" ? `the home page of ${c.store ?? "the store"}` : `"${identifierOf(c.rest)}" (store view ${c.store ?? "-"})`;
    return {
      ok: true, warnings,
      blocks: [{
        key: "content", label: "The page's content", lang: "html",
        steps: [
          `Content > Pages: open ${where}.`,
          "Save & Duplicate it first and keep the copy disabled - Magento keeps no earlier version.",
          "In the original, remove the content rows, drag one HTML Code element (Elements) in, paste this and Save.",
        ],
        code: `${styleBlock(final.changes)}${strip(main)}`,
      }],
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
  ].join("\n");
  return {
    ok: true, warnings,
    blocks: [{
      key: "spec", label: "For the shop's developers", lang: "text",
      steps: [`A ${c.kind} page is the theme's code, not a CMS page: hand this list to the developers, or run it as an A/B test.`],
      code: spec,
    }],
  };
}

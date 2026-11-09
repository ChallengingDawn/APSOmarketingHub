// APSOconvert > SHIP - what happens to a version that won its test. Three ways out (the contract, 08.11.2026):
//   1. keep it on for everyone: a personalisation with no audience limit, on the gateway - instant and undoable
//      (src/lib/convert/tests.ts shipToEveryone);
//   2. the code for dotSource: product and category pages are the theme's code, so the winner goes to the agency as
//      a CSS block, a small ES5 script for the element changes, and a plain description of what changes and why;
//   3. Magento CMS pages only: the hub writes the changes into the page's content (src/lib/convert/cms.ts), ACC first,
//      a backup before every write, a person pressing each one - and only once the hub has its Magento keys.
//
// This file is pure (no "@/" imports): the code, the description, and the change list applied to a CMS page's HTML.

import { classify, nameFromRest, type Env } from "./model";
import { describe, scriptJson, type Change } from "./versions";

/* ── the code for dotSource ─────────────────────────────────────────── */

export type ShipInfo = {
  testId: string; name: string; env: Env; host: string; pages: string[];
  idea: { title: string; why: string; change: string; expect: string } | null;
  versionRev: number;
  result: { rateA: number | null; rateB: number | null; uplift: number | null; pB: number | null; visitors: number; days: number } | null;
  decidedBy: string | null; decidedAt: string | null;
};

const pct = (r: number | null | undefined, d = 1) => (r === null || r === undefined ? "-" : `${(r * 100).toFixed(d)}%`);
const signed = (r: number | null | undefined) => (r === null || r === undefined ? "-" : `${r >= 0 ? "+" : ""}${(r * 100).toFixed(1)}%`);
const day = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "-");
/** Text for a comment: no comment end, one line. */
const inComment = (s: string) => s.replace(/\*\//g, "* /").replace(/[\r\n]+/g, " ").trim();

/** The version's stylesheet, as one block for the theme's styles. */
export function cssBlock(changes: Change[], info: Pick<ShipInfo, "testId" | "name">): string {
  const css = changes.filter((c): c is Extract<Change, { op: "css" }> => c.op === "css");
  if (!css.length) return "";
  return [
    `/* APSOconvert test #${info.testId} - ${inComment(info.name)} */`,
    ...css.map((c) => `${c.note ? `/* ${inComment(c.note)} */\n` : ""}${c.css.trim()}`),
  ].join("\n\n");
}

/**
 * The element changes as a small ES5 script, with the semantics the test ran with (versions.ts runtimeSource): each
 * change waits for its element (the theme draws parts of the page after loading) for at most eight seconds, new
 * blocks are marked data-apso-v so they are never changed twice. No library, no arrow function, no let/const.
 * Empty when the version is CSS only.
 */
export function jsSnippet(changes: Change[], info: Pick<ShipInfo, "testId" | "name" | "pages">): string {
  const els = changes.filter((c) => c.op !== "css");
  if (!els.length) return "";
  const list = els.map((c) => {
    const o: Record<string, unknown> = { ...c };
    delete o.note;
    return o;
  });
  const notes = els.map((c, i) => `   ${i + 1}. ${inComment(describe(c))}`).join("\n");
  return `/* APSOconvert test #${info.testId} - ${inComment(info.name)}
   On: ${info.pages.map(inComment).join(", ")}
   What it does:
${notes}
   ES5, no library. Put it on those pages after the page's own scripts (or in a RequireJS module). */
(function (changes) {
  var D = document, done = [], seen = [];
  function frag(html) {
    var t = D.createElement("template"), j;
    t.innerHTML = html;
    for (j = 0; j < t.content.children.length; j++) t.content.children[j].setAttribute("data-apso-v", "");
    return t.content;
  }
  function apply(c, el) {
    if (c.op === "html") el.innerHTML = c.html;
    else if (c.op === "replace") el.parentNode.replaceChild(frag(c.html), el);
    else if (c.op === "insert") {
      if (c.where === "before") el.parentNode.insertBefore(frag(c.html), el);
      else if (c.where === "after") el.parentNode.insertBefore(frag(c.html), el.nextSibling);
      else if (c.where === "prepend") el.insertBefore(frag(c.html), el.firstChild);
      else el.appendChild(frag(c.html));
    }
    else if (c.op === "text") el.textContent = c.text;
    else if (c.op === "hide") el.style.setProperty("display", "none", "important");
    else if (c.op === "attr") el.setAttribute(c.name, c.value);
  }
  function run() {
    var i, k, c, els;
    for (i = 0; i < changes.length; i++) {
      c = changes[i];
      if (done[i]) continue;
      try { els = c.all ? D.querySelectorAll(c.selector) : [D.querySelector(c.selector)]; } catch (e) { done[i] = true; continue; }
      seen[i] = seen[i] || [];
      for (k = 0; k < els.length; k++) {
        if (!els[k] || (els[k].closest && els[k].closest("[data-apso-v]")) || seen[i].indexOf(els[k]) >= 0) continue;
        seen[i].push(els[k]);
        try { apply(c, els[k]); if (!c.all) done[i] = true; } catch (e) { /* the page changed under it */ }
      }
    }
  }
  function start() {
    var mo = window.MutationObserver ? new MutationObserver(run) : null;
    run();
    if (mo) mo.observe(D.documentElement, { childList: true, subtree: true });
    setTimeout(function () { if (mo) mo.disconnect(); run(); }, 8000);
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();
})(${scriptJson(list)});`;
}

/** What changes and why, in plain words, for the person at dotSource (and for whoever reads it in a year). */
export function description(changes: Change[], info: ShipInfo): string {
  const r = info.result;
  const lines = [
    `APSOconvert test #${info.testId}: ${info.name}`,
    `Pages (${info.host}): ${info.pages.join(", ")}`,
    info.idea ? `The idea: ${info.idea.title}${info.idea.why ? `\nWhy: ${info.idea.why}` : ""}${info.idea.change ? `\nWhat changes: ${info.idea.change}` : ""}${info.idea.expect ? `\nWhat it should move: ${info.idea.expect}` : ""}` : "",
    r ? `The result: ${pct(r.rateB)} of the visitors who saw the version put something in the cart, against ${pct(r.rateA)} on the page as it is (${signed(r.uplift)}), ${r.pB === null ? "" : `${Math.round(r.pB * 100)}% certain, `}${r.visitors.toLocaleString("en-US")} visitors over ${r.days} days.` : "",
    info.decidedBy ? `Decided by ${info.decidedBy} on ${day(info.decidedAt)}.` : "",
    `The changes (version revision ${info.versionRev}):\n${changes.map((c, i) => `${i + 1}. ${describe(c)}${c.op !== "css" ? ` - on ${(c as { selector: string }).selector}${(c as { all?: boolean }).all ? " (every one)" : ""}` : ""}`).join("\n")}`,
    `The CSS goes into the theme's styles; the script places the element changes. Product and category pages are theme code: please build it into the templates rather than keeping the script for good, and tell us when it is live so the test can be switched off.`,
  ];
  return lines.filter(Boolean).join("\n\n");
}

/* ── which pages Magento may be written for ───────────────────────────── */

/** Magento CMS pages only - product, category and the home page come from the theme or Magento's settings. */
export function cmsTarget(path: string): { ok: true; store: string | null; identifier: string } | { ok: false; why: string } {
  const c = classify(path);
  if (c.kind === "product") return { ok: false, why: "A product page is the theme's code - it goes to dotSource as code." };
  if (c.kind === "category") return { ok: false, why: "A category page is the theme's code - it goes to dotSource as code." };
  if (c.kind === "home") return { ok: false, why: "The home page is set in Magento's configuration, not written from the hub." };
  if (c.kind === "system") return { ok: false, why: "A shop function (cart, account, search) is not a page to write." };
  if (!c.rest) return { ok: false, why: "This address does not name one CMS page." };
  return { ok: true, store: c.store, identifier: c.rest.replace(/\/+$/, "") };
}
export const pageName = (path: string) => nameFromRest(classify(path).rest) || path;

/* ── the change list applied to a CMS page's HTML ────────────────────── */
// A small HTML reader that keeps every character it does not change: the edits are spliced into the original text at
// the offsets of the elements they aim at, so the rest of the content stays exactly as Magento holds it. Selectors are
// compound ones (tag, #id, .class, [attr], [attr="v"]) joined by spaces or ">" - what the version writer aims with.
// The shop page wraps the CMS content (#maincontent, .column.main...): a selector that finds nothing as it is is tried
// again without its first parts, and the result says so.

type El = {
  tag: string; attrs: Map<string, { value: string; start: number; end: number }>;
  start: number; openEnd: number; closeStart: number; end: number; parent: El | null;
};

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title"]);

function parse(html: string): El[] {
  const els: El[] = [];
  const stack: El[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) break;
    if (html.startsWith("<!--", lt)) { const e = html.indexOf("-->", lt + 4); i = e < 0 ? html.length : e + 3; continue; }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") { const e = html.indexOf(">", lt); i = e < 0 ? html.length : e + 1; continue; }
    if (html[lt + 1] === "/") {
      const m = /^<\/\s*([a-zA-Z][\w:-]*)\s*>/.exec(html.slice(lt, lt + 100));
      if (!m) { i = lt + 1; continue; }
      const tag = m[1].toLowerCase();
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].tag !== tag) continue;
        // close it and anything left open inside it
        for (let j = stack.length - 1; j >= k; j--) {
          const el = stack[j];
          if (j === k) { el.closeStart = lt; el.end = lt + m[0].length; } else { el.closeStart = lt; el.end = lt; }
        }
        stack.length = k;
        break;
      }
      i = lt + m[0].length;
      continue;
    }
    const tm = /^<([a-zA-Z][\w:-]*)/.exec(html.slice(lt, lt + 60));
    if (!tm) { i = lt + 1; continue; }
    const tag = tm[1].toLowerCase();
    // the attributes, with their value's offsets
    let j = lt + tm[0].length;
    const attrs = new Map<string, { value: string; start: number; end: number }>();
    let selfClose = false;
    for (;;) {
      while (j < html.length && /\s/.test(html[j])) j++;
      if (j >= html.length) break;
      if (html[j] === ">") { j++; break; }
      if (html[j] === "/" && html[j + 1] === ">") { selfClose = true; j += 2; break; }
      const nm = /^[^\s=>/"']+/.exec(html.slice(j, j + 200));
      if (!nm) { j++; continue; }
      const name = nm[0].toLowerCase();
      j += nm[0].length;
      while (j < html.length && /\s/.test(html[j])) j++;
      if (html[j] !== "=") { attrs.set(name, { value: "", start: j, end: j }); continue; }
      j++;
      while (j < html.length && /\s/.test(html[j])) j++;
      const q = html[j];
      if (q === '"' || q === "'") {
        const e = html.indexOf(q, j + 1);
        const end = e < 0 ? html.length : e;
        attrs.set(name, { value: html.slice(j + 1, end), start: j + 1, end });
        j = end + 1;
      } else {
        const vm = /^[^\s>]*/.exec(html.slice(j))!;
        attrs.set(name, { value: vm[0], start: j, end: j + vm[0].length });
        j += vm[0].length;
      }
    }
    const el: El = { tag, attrs, start: lt, openEnd: j, closeStart: j, end: j, parent: stack[stack.length - 1] ?? null };
    els.push(el);
    if (VOID.has(tag) || selfClose) { i = j; continue; }
    if (RAW.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, j);
      const ce = close < 0 ? html.length : html.indexOf(">", close);
      el.closeStart = close < 0 ? html.length : close;
      el.end = ce < 0 ? html.length : ce + 1;
      i = el.end;
      continue;
    }
    stack.push(el);
    i = j;
  }
  for (const el of stack) { el.closeStart = html.length; el.end = html.length; }
  return els;
}

type Compound = { tag: string | null; id: string | null; classes: string[]; attrs: { name: string; value: string | null }[] };
type Part = { c: Compound; rel: " " | ">"; raw: string };

function parseSelector(sel: string): Part[][] | null {
  const groups = sel.split(",").map((s) => s.trim()).filter(Boolean);
  const out: Part[][] = [];
  for (const g of groups) {
    const toks = g.replace(/\s*>\s*/g, " > ").split(/\s+/).filter(Boolean);
    const parts: Part[] = [];
    let rel: " " | ">" = " ";
    for (const t of toks) {
      if (t === ">") { rel = ">"; continue; }
      const m = /^([a-zA-Z][\w-]*|\*)?((?:[#.][\w-]+|\[[^\]]+\])*)$/.exec(t);
      if (!m) return null;
      const c: Compound = { tag: m[1] && m[1] !== "*" ? m[1].toLowerCase() : null, id: null, classes: [], attrs: [] };
      for (const x of m[2].match(/[#.][\w-]+|\[[^\]]+\]/g) ?? []) {
        if (x[0] === "#") c.id = x.slice(1);
        else if (x[0] === ".") c.classes.push(x.slice(1));
        else {
          const am = /^\[\s*([\w:-]+)\s*(?:=\s*["']?([^"'\]]*)["']?)?\s*\]$/.exec(x);
          if (!am) return null;
          c.attrs.push({ name: am[1].toLowerCase(), value: am[2] ?? null });
        }
      }
      parts.push({ c, rel, raw: t });
      rel = " ";
    }
    if (parts.length) out.push(parts);
  }
  return out.length ? out : null;
}

function matchesCompound(el: El, c: Compound): boolean {
  if (c.tag && el.tag !== c.tag) return false;
  if (c.id && el.attrs.get("id")?.value !== c.id) return false;
  if (c.classes.length) {
    const cls = (el.attrs.get("class")?.value ?? "").split(/\s+/);
    if (!c.classes.every((k) => cls.includes(k))) return false;
  }
  for (const a of c.attrs) {
    const v = el.attrs.get(a.name);
    if (!v || (a.value !== null && v.value !== a.value)) return false;
  }
  return true;
}
function matches(el: El, parts: Part[]): boolean {
  const last = parts.length - 1;
  if (!matchesCompound(el, parts[last].c)) return false;
  let cur: El | null = el;
  for (let k = last - 1; k >= 0; k--) {
    const rel = parts[k + 1].rel;
    if (rel === ">") {
      cur = cur?.parent ?? null;
      if (!cur || !matchesCompound(cur, parts[k].c)) return false;
    } else {
      let p: El | null = cur?.parent ?? null;
      while (p && !matchesCompound(p, parts[k].c)) p = p.parent;
      if (!p) return false;
      cur = p;
    }
  }
  return true;
}

/** The elements a selector finds in the content - as it is, else without its first parts (the shop's wrappers). */
function find(els: El[], selector: string): { hits: El[]; used: string | null } {
  const groups = parseSelector(selector);
  if (!groups) return { hits: [], used: null };
  const longest = Math.max(...groups.map((g) => g.length));
  for (let drop = 0; drop < Math.min(4, longest); drop++) {
    const gs = groups.map((g) => g.slice(Math.min(drop, g.length - 1))).map((g) => [{ ...g[0], rel: " " as const }, ...g.slice(1)]);
    const hits = els.filter((el) => gs.some((g) => matches(el, g)));
    if (hits.length) return { hits, used: drop ? gs.map((g) => g.map((p, i) => `${i && p.rel === ">" ? "> " : ""}${p.raw}`).join(" ")).join(", ") : null };
  }
  return { hits: [], used: null };
}

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");

function setAttr(html: string, el: El, name: string, value: string): string {
  const a = el.attrs.get(name);
  const q = a ? html[a.start - 1] : "";
  if (a && (q === '"' || q === "'") && html[a.end] === q) {
    const v = q === "'" ? escAttr(value).replace(/'/g, "&#39;") : escAttr(value);
    return html.slice(0, a.start) + v + html.slice(a.end);
  }
  if (a) {
    // an attribute without quotes or without a value: written again whole
    const from = html.toLowerCase().lastIndexOf(name, a.start);
    return `${html.slice(0, from >= el.start ? from : a.start)}${name}="${escAttr(value)}"${html.slice(a.end)}`;
  }
  const at = html[el.openEnd - 2] === "/" ? el.openEnd - 2 : el.openEnd - 1;
  return `${html.slice(0, at)} ${name}="${escAttr(value)}"${html.slice(at)}`;
}

export type CmsApplied = {
  content: string;
  /** per change: placed (how many elements), or why not */
  placed: { i: number; n: number; via: string | null }[];
  notPlaced: { i: number; why: string }[];
  /** the version's CSS went in as one style block at the top (replacing an earlier APSOconvert block) */
  css: boolean;
};

const STYLE_BLOCK = /<style data-apso-version="[^"]*">[\s\S]*?<\/style>\n?/g;

/* ── Content's publish: what a write put in, and takes out again (Content v6) ─────────────────── */
// SARCLA 09.11.2026 (point 10): "when [the proposal] applies, hide the element and replace [it] for our high[-quality]
// generated code". Two ways, by caller (applyToCms `replace`):
//   "swap" (the default - AI testing & personalization's tested winners, src/lib/convert/cms.ts): exactly as before - the
//          element replaced by the version's HTML, what was tested (versions.ts runtimeSource) is what is written.
//   "keep" (Content's page publish, ./cmsPage.ts): the element SWAPPED for our block - no hidden copy left in the page (a
//          hidden duplicate H1 or paragraph for search engines, a second element with the same id) - and its own HTML
//          kept right beside the block in an HTML comment, base64 (whatever it holds - "--", "-->", "<!--", an inline
//          script - can never break out of the comment). The blocks a write puts in (replace, insert) are marked with the
//          write's tag (data-apx-block), the elements it hides (op hide) too (data-apx-hid). A write made again first takes
//          its own earlier work out: each kept original put back from its comment exactly as it was (also when that
//          replace is no longer in the list - an Undo), its other blocks removed, what it hid shown again - so a page
//          written twice never holds two blocks. Among Page Builder's elements a block goes in as an HTML Code element
//          (inside a row when it stands among rows); inside an HTML Code element as it is.
// The studio's PREVIEW keeps the original hidden instead (./apply.ts), for "Show the old one".

const HIDE_RULE = "display:none !important";

/** UTF-8 base64, the same on the server and in a browser. */
function toB64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  let bin = "";
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "base64").toString("utf8");
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}
/** The comment a "keep" replace leaves beside its block: the element's own HTML, base64 - nothing in it ends the comment. */
const keptComment = (original: string, tag: string) => `<!--apx-was ${toB64(tag)} ${toB64(original)}-->`;
const KEPT = /<!--apx-was ([A-Za-z0-9+/=]*) ([A-Za-z0-9+/=]*)-->/g;

/** The element's top-level elements marked as this write's block (a fragment with loose text is wrapped first). */
function markBlock(html: string, tag: string): string {
  const els = parse(html);
  const tops = els.filter((e) => !e.parent);
  const loose = tops.reduce((s, e) => s.replace(html.slice(e.start, e.end), ""), html).replace(/<!--[\s\S]*?-->/g, "").trim();
  if (loose || !tops.length) return `<div data-apx-block="${escAttr(tag)}">${html}</div>`;
  let out = html;
  for (const e of [...tops].sort((a, b) => b.start - a.start)) {
    const at = e.start + 1 + e.tag.length;
    out = `${out.slice(0, at)} data-apx-block="${escAttr(tag)}"${out.slice(at)}`;
  }
  return out;
}

/** Page Builder's own element names: a block among them must be one of them (an HTML Code element). */
const PB = (el: El | null) => el?.attrs.get("data-content-type")?.value ?? null;
const PB_HOLDERS = new Set(["row", "column", "column-group", "column-line", "tabs", "tab-item"]);
/** Where a block goes, as Magento's editor needs it: plain inside an HTML Code element or a page that is not Page Builder;
 * an HTML Code element among Page Builder's elements; that inside a row among the page's rows. */
function pbWrap(block: string, parent: El | null, pageBuilder: boolean, tag: string): string {
  if (!pageBuilder) return block;
  for (let p: El | null = parent; p; p = p.parent) if (PB(p) === "html" || PB(p) === "text") return block;
  const holder = (() => { for (let p: El | null = parent; p; p = p.parent) { const t = PB(p); if (t) return t; } return null; })();
  const element = `<div data-content-type="html" data-appearance="default" data-element="main" data-decoded="true" data-apx-block="${escAttr(tag)}">${block}</div>`;
  if (holder && PB_HOLDERS.has(holder)) return element;
  return `<div data-content-type="row" data-appearance="contained" data-element="main" data-apx-block="${escAttr(tag)}"><div data-enable-parallax="0" data-parallax-speed="0.5" data-background-images="{}" data-background-type="image" data-video-loop="true" data-video-play-only-visible="true" data-video-lazy-load="true" data-video-fallback-src="" data-element="inner">${element.replace(` data-apx-block="${escAttr(tag)}"`, "")}</div></div>`;
}

/** The content without what an earlier write with this tag put in: its blocks out, what it hid shown again as it was. */
export function withoutOwnWork(content: string, tag: string): string {
  let html = content;
  // each element a "keep" replace swapped out: put back from its comment, in place of the block right after it
  const mine = toB64(tag);
  for (;;) {
    const kept = [...html.matchAll(KEPT)].filter((m) => m[1] === mine);
    if (!kept.length) break;
    const m = kept[kept.length - 1];
    const start = m.index ?? 0;
    let end = start + m[0].length;
    const els = parse(html);
    for (;;) {
      let p = end;
      while (p < html.length && /\s/.test(html[p])) p++;
      const next = els.find((e) => e.start === p && e.attrs.get("data-apx-block")?.value === tag);
      if (!next) break;
      end = next.end;
    }
    html = html.slice(0, start) + fromB64(m[2]) + html.slice(end);
  }
  // the blocks, from the last (offsets stay right); one inside another goes with it
  for (;;) {
    const blocks = parse(html).filter((e) => e.attrs.get("data-apx-block")?.value === tag);
    if (!blocks.length) break;
    const outer = blocks.filter((b) => !blocks.some((o) => o !== b && o.start <= b.start && b.end <= o.end));
    for (const b of outer.sort((x, y) => y.start - x.start)) html = html.slice(0, b.start) + html.slice(b.end);
  }
  // what it hid: its style as it was, the mark gone
  for (const el of parse(html).filter((e) => e.attrs.get("data-apx-hid")?.value === tag).sort((x, y) => y.start - x.start)) {
    const st = el.attrs.get("style");
    const mark = el.attrs.get("data-apx-hid")!;
    const edits: { from: number; to: number; text: string }[] = [];
    const markFrom = html.lastIndexOf("data-apx-hid", mark.start);
    edits.push({ from: html[markFrom - 1] === " " ? markFrom - 1 : markFrom, to: mark.end + 1, text: "" });
    if (st) {
      const was = st.value.replace(/;?\s*display:none !important\s*;?\s*$/i, "").trim();
      if (was) edits.push({ from: st.start, to: st.end, text: was });
      else { const sFrom = html.lastIndexOf("style", st.start); edits.push({ from: html[sFrom - 1] === " " ? sFrom - 1 : sFrom, to: st.end + 1, text: "" }); }
    }
    for (const e of edits.sort((a, b) => b.from - a.from)) html = html.slice(0, e.from) + e.text + html.slice(e.to);
  }
  return html;
}

/**
 * The change list applied to a CMS page's content. CSS: one <style data-apso-version="test-N"> block at the top (an
 * earlier one from APSOconvert is replaced, never doubled). Element changes: spliced in where their selector points,
 * one after the other (each change reads the content as the one before left it). `replace`: "swap" (the default, as
 * it always was) or "keep" (Content's publish: the original kept in a comment beside the block, a write made again
 * first puts back what an earlier one changed - above).
 */
export function applyToCms(content: string, changes: Change[], tag: string, opts: { replace?: "swap" | "keep" } = {}): CmsApplied {
  const keep = opts.replace === "keep";
  let html = content.replace(STYLE_BLOCK, "");
  if (keep) html = withoutOwnWork(html, tag);
  const pageBuilder = keep && /\bdata-content-type=/.test(html);
  const placed: CmsApplied["placed"] = [];
  const notPlaced: CmsApplied["notPlaced"] = [];
  changes.forEach((c, i) => {
    if (c.op === "css") return;
    const els = parse(html);
    const { hits, used } = find(els, c.selector);
    if (!hits.length) { notPlaced.push({ i, why: parseSelector(c.selector) ? `nothing in the page's content matches ${c.selector}` : `the hub cannot read the selector ${c.selector} here` }); return; }
    const targets = (c.all ? hits : hits.slice(0, 1)).sort((x, y) => y.start - x.start);
    // nested hits: change the outer one only
    const outer = targets.filter((t) => !targets.some((o) => o !== t && o.start <= t.start && o.end >= t.end && (o.start < t.start || o.end > t.end)));
    for (const el of outer) {
      const isVoid = el.openEnd === el.end;
      switch (c.op) {
        case "html": if (!isVoid) html = html.slice(0, el.openEnd) + c.html + html.slice(el.closeStart); break;
        case "text": if (!isVoid) html = html.slice(0, el.openEnd) + escText(c.text) + html.slice(el.closeStart); break;
        case "replace": {
          if (!keep) { html = html.slice(0, el.start) + c.html + html.slice(el.end); break; }
          // swapped for our block, marked; the element's own HTML kept in a comment right before it
          html = html.slice(0, el.start) + keptComment(html.slice(el.start, el.end), tag) + pbWrap(markBlock(c.html, tag), el.parent, pageBuilder, tag) + html.slice(el.end);
          break;
        }
        case "insert": {
          const at = c.where === "before" ? el.start : c.where === "after" ? el.end : c.where === "prepend" ? el.openEnd : isVoid ? el.end : el.closeStart;
          const parent = c.where === "before" || c.where === "after" || isVoid ? el.parent : el;
          html = html.slice(0, at) + (keep ? pbWrap(markBlock(c.html, tag), parent, pageBuilder, tag) : c.html) + html.slice(at);
          break;
        }
        case "hide": {
          const cur = el.attrs.get("style")?.value ?? "";
          let h = setAttr(html, el, "style", `${cur.trim() ? `${cur.trim().replace(/;?$/, ";")} ` : ""}${HIDE_RULE}`);
          // "keep": marked as this write's, so a write made again without it (Undo) shows the element again
          if (keep) h = setAttr(h, parse(h).find((x) => x.start === el.start)!, "data-apx-hid", tag);
          html = h;
          break;
        }
        case "attr": html = setAttr(html, el, c.name.toLowerCase(), c.value); break;
      }
    }
    placed.push({ i, n: outer.length, via: used });
  });
  const css = changes.filter((c): c is Extract<Change, { op: "css" }> => c.op === "css").map((c) => c.css.trim()).join("\n");
  if (css) html = `<style data-apso-version="${escAttr(tag)}">\n${css}\n</style>\n${html}`;
  return { content: html, placed, notPlaced, css: Boolean(css) };
}

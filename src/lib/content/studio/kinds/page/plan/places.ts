// PAGE - THE PAGE AS THE AI PLANS ON IT (Content v7, 10.11.2026). Pure: relative imports only (tests/studio-page-plan.test.ts).
//
// SARCLA 10.11.2026 (points 5 and 13): the AI must compose a page of the shop with the module library - "add a product row
// after the intro", "replace the hero with the finder bento". For that it is given the page's REAL structure: its parts in
// their order (the page's own blocks and the modules and blocks the hub put on it), each with its words, its heading and
// what it holds (product links, category links, pictures). The AI names a part by its short id (P3, M1); the hub turns
// that into the place a change is laid at.
//
// Why ids and not the AI's own selectors (point 4 of tonight's list: an AI block "added" and never seen): the outline the
// AI read before gives selectors by tag and class ("div", "p", "h2.title") - on a Page Builder page (/de-CH/privacy) most
// elements have no class, and "the first h2" of a whole page is in its header. Here each part's selector is MADE by the hub
// and CHECKED: it finds exactly that element on the page as the server's preview lays the changes over it (the same tree,
// ./apply.ts, the earlier changes applied first - a new change goes at the end of the list), so what the plan adds stands
// where the plan says, in the preview and in Magento.

import { parseHtml, parseSelector, selectAll, applyChanges, type AnyChange, type Node } from "../apply";
import { finalChanges, type PageChange, type PageDoc } from "../model";
import { readModule, libModule } from "./library";

export type PartKind = "page" | "module" | "block";
export type PagePart = {
  /** "P1".. a part of the page itself, "M1".. a module the hub put on it, "B1".. a block the hub put on it */
  id: string;
  kind: PartKind;
  /** a part of the page: the selector that finds exactly it (made and checked here); a part the hub put: "" */
  selector: string;
  /** a part the hub put: its change's id and (a module) its type */
  change: string;
  module: string;
  tag: string;
  /** its first heading's words, and whether it holds the page's H1 */
  heading: string;
  h1: boolean;
  /** its words, cut (a part with no words: its pictures) */
  text: string;
  /** what Magento's Page Builder calls it, when it is one ("slider", "banner", "image", "tabs", "products") */
  pb?: string;
  /** what it holds: links to product pages, to category pages, pictures, links */
  holds: { products: number; categories: number; pictures: number; links: number };
};

const SKIP = new Set(["script", "style", "link", "input", "template", "noscript", "meta", "br", "hr", "svg"]);
const attrOf = (el: Node, name: string): string | null => { const a = el.attrs.find((x) => x.name === name); return a ? (a.value ?? "") : null; };

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", reg: "®", trade: "™", ndash: "–", mdash: "—", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç" };
/** The words of a piece of HTML: scripts and styles out, entities read, spaces folded. */
export function wordsOf(html: string): string {
  return html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (all, n: string) => ENT[n] ?? all)
    .replace(/\s+/g, " ").trim();
}

const hiddenStyle = (el: Node) => /display\s*:\s*none/i.test(attrOf(el, "style") ?? "") || attrOf(el, "hidden") !== null;

/** A Page Builder background photo: data-background-images='{\"desktop_image\":\"https://...\"}' (its quotes escaped). */
const BG_PHOTO = /desktop_image\\?"\s*:\s*\\?"[^"\\]/i;

/** Does an element show anything (words, a picture, a Page Builder photo)? */
function shows(el: Node, html: string): boolean {
  if (SKIP.has(el.tag) || hiddenStyle(el)) return false;
  const inner = html.slice(el.start, el.end);
  if (wordsOf(inner).length > 1) return true;
  if (/<(img|picture|video|iframe)\b/i.test(inner)) return true;
  return BG_PHOTO.test(inner);
}

const marked = (el: Node) => el.attrs.some((a) => a.name === "data-apso-v");

/** The main column's element: Magento's `.column.main` in #maincontent, else #maincontent, else <body>. */
function mainOf(root: Node): { el: Node; sel: string } | null {
  for (const sel of ["#maincontent .column.main", "#maincontent", "body"]) {
    const g = parseSelector(sel);
    const el = g ? selectAll(root, g)[0] : undefined;
    if (el) return { el, sel: sel === "#maincontent .column.main" ? "div.column.main" : sel };
  }
  return null;
}

/** The page's content blocks as a person sees them: the main column's children that show something - a wrapper holding
 * one block looked into (as the studio's frame does, Frame.tsx contentBlocks). */
function blocksOf(main: Node, html: string): Node[] {
  let kids = main.children.filter((c) => shows(c, html));
  for (let n = 0; kids.length === 1 && !marked(kids[0]) && n < 8; n++) kids = kids[0].children.filter((c) => shows(c, html));
  return kids;
}

const CLASS_OK = (c: string) => /^[A-Za-z_-][\w-]*$/.test(c) && !/^(active|_active|selected|clearfix|hidden|visible|apx-|am-)/.test(c);

/** One step of a path: tag, up to two classes, its place among its siblings of the same tag when it needs one. */
function stepOf(el: Node): string {
  const cls = (attrOf(el, "class") ?? "").split(/\s+/).filter(CLASS_OK).slice(0, 2);
  const same = el.parent ? el.parent.children.filter((x) => x.tag === el.tag) : [el];
  const nth = same.length > 1 ? `:nth-of-type(${same.indexOf(el) + 1})` : "";
  return `${el.tag}${cls.map((c) => `.${c}`).join("")}${nth}`;
}

/** Does the selector find exactly this element first (as a change finds its element: the first match, in page order)? */
function findsIt(root: Node, sel: string, el: Node): boolean {
  const g = parseSelector(sel);
  if (!g) return false;
  const all = selectAll(root, g);
  return all.length === 1 && all[0] === el;
}

/**
 * A selector that finds exactly this element on the page: its id; a Page Builder element's own style key
 * ([data-pb-style] - one per element, it does not move when a block is added before it); else its path down from the
 * main column. Checked against the page as the server's preview lays the changes over it. "" when none is sure.
 */
export function selectorFor(root: Node, el: Node, main: { el: Node; sel: string }): string {
  const id = attrOf(el, "id");
  if (id && /^[A-Za-z][\w-]*$/.test(id) && !/^(ui-id-|ko_|apx-)/.test(id) && findsIt(root, `#${id}`, el)) return `#${id}`;
  const pb = attrOf(el, "data-pb-style");
  if (pb && /^[A-Z0-9]{4,12}$/i.test(pb) && findsIt(root, `${el.tag}[data-pb-style="${pb}"]`, el)) return `${el.tag}[data-pb-style="${pb}"]`;
  const steps: string[] = [];
  for (let cur: Node | null = el; cur && cur !== main.el && cur.tag !== "#root"; cur = cur.parent) steps.unshift(stepOf(cur));
  for (const head of [main.sel, `#maincontent ${main.sel}`]) {
    const sel = `${head} > ${steps.join(" > ")}`;
    if (findsIt(root, sel, el)) return sel;
  }
  return "";
}

/** A part with no words: what its pictures are (their alt text, else their file's name - "USPs_DE.png" shows the shop's
 * promises, "BannerEvolast_DE.jpg" a campaign), so the AI never adds what a picture already says. */
function picturesOf(inner: string): string {
  const names: string[] = [];
  for (const m of inner.matchAll(/<img\b[^>]*>|desktop_image\\?"\s*:\s*\\?"([^"\\]+)/gi)) {
    if (/pagebuilder-mobile-only/.test(m[0])) continue;
    const alt = /\balt\s*=\s*["']([^"']{3,80})["']/i.exec(m[0])?.[1];
    const src = m[1] ?? /\bsrc\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1] ?? "";
    const file = (src.split("/").pop() ?? "").replace(/\?.*$/, "");
    let name = alt || file;
    try { name = alt || decodeURIComponent(file); } catch { /* the name as written */ }
    if (name && !names.includes(name)) names.push(name);
  }
  return names.length ? `(no words - pictures: ${names.slice(0, 6).join(", ")})` : "";
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);

function holdsOf(inner: string): PagePart["holds"] {
  let products = 0, categories = 0, links = 0;
  for (const m of inner.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    links++;
    try {
      const u = new URL(m[1].replace(/&amp;/g, "&"), "https://www.apsoparts.com");
      if (!/^(www|acc)\.apsoparts\.com$/.test(u.hostname)) continue;
      const segs = u.pathname.split("/").filter(Boolean);
      const first = /^[a-z]{2}-[A-Z]{2,3}$/.test(segs[0] ?? "") ? (/^[a-z]{3}$/.test(segs[1] ?? "") ? segs[2] : segs[1]) : segs[0];
      if (/^\d{8}(?=-|\.html$|$)/.test(first ?? "")) products++;
      else if (/\.html$/i.test(u.pathname)) categories++;
    } catch { /* not an address */ }
  }
  // a picture: an <img> (a Page Builder image's mobile twin not counted), or a Page Builder background photo
  const pictures = (inner.match(/<img\b(?![^>]*pagebuilder-mobile-only)/gi) ?? []).length + (inner.match(new RegExp(BG_PHOTO.source, "gi")) ?? []).length;
  return { products, categories, pictures, links };
}

/**
 * The page's parts in their order, as the server's preview lays the store view's changes over the page's HTML: the
 * page's own blocks (P1, P2 ...) with a checked selector each, and what the hub put on it (M1 ... a module, B1 ... a
 * block) by its change. A part of the page hidden by a change (replaced) is not listed: what took its place is.
 */
export type PageMapOut = {
  parts: PagePart[];
  /** the element the parts stand in (to add at the very start or end of the page's content): a checked selector */
  container: string;
};
export function pageMap(rawHtml: string, view: Pick<PageDoc, "changes" | "texts" | "source" | "newPage" | "fields">, max = 30): PageMapOut {
  const final = finalChanges(view as PageDoc);
  const html = applyChanges(rawHtml, final.changes as AnyChange[], { marks: final.from }).html;
  const root = parseHtml(html);
  const main = mainOf(root);
  if (!main) return { parts: [], container: "" };
  const out: PagePart[] = [];
  let p = 0, m = 0, b = 0;
  const seen = new Set<string>();
  const blocks = blocksOf(main.el, html);
  const box = blocks[0]?.parent ?? main.el;
  const container = box === main.el ? (findsIt(root, main.sel, main.el) ? main.sel : "") : selectorFor(root, box, main);
  for (const el of blocks) {
    if (out.length >= max) break;
    const inner = html.slice(el.start, el.end);
    const heading = wordsOf(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1\s*>/i.exec(inner)?.[2] ?? "");
    const said = wordsOf(inner);
    const pb = [...inner.matchAll(/data-content-type\s*=\s*["']([\w-]+)["']/gi)].map((x) => x[1]).find((t) => !/^(row|column-group|column|column-line|text|html|heading|divider|buttons|button-item|slide|block)$/.test(t));
    const base = { tag: el.tag, heading: cut(heading, 90), h1: /<h1\b/i.test(inner), text: cut(said, 260) || picturesOf(inner), holds: holdsOf(inner), ...(pb ? { pb } : {}) };
    if (marked(el)) {
      const idx = Number(attrOf(el, "data-apx-c"));
      const c = Number.isInteger(idx) ? view.changes[idx] : undefined;
      if (!c?.id || seen.has(c.id)) continue;
      seen.add(c.id);
      const mod = readModule((c as PageChange).module);
      if (mod && libModule(mod.type)) out.push({ id: `M${++m}`, kind: "module", selector: "", change: c.id, module: mod.type, ...base });
      else out.push({ id: `B${++b}`, kind: "block", selector: "", change: c.id, module: "", ...base });
      continue;
    }
    const sel = selectorFor(root, el, main);
    if (!sel) continue;
    out.push({ id: `P${++p}`, kind: "page", selector: sel, change: "", module: "", ...base });
  }
  return { parts: out, container };
}

/** The parts as the AI reads them - one line each, in the page's order. */
export function mapText(parts: PagePart[]): string {
  if (!parts.length) return "(the page's parts could not be read)";
  return parts.map((x) => {
    const what = x.kind === "module" ? `a module the hub put here (id "${x.module}")` : x.kind === "block" ? "a block the hub put here" : `<${x.tag}>${x.pb ? ` a ${x.pb}` : ""}`;
    const h = x.holds;
    const holds = [h.products ? `${h.products} product links` : "", h.categories ? `${h.categories} category links` : "", h.pictures ? `${h.pictures} pictures` : ""].filter(Boolean).join(", ");
    return `${x.id} · ${what}${x.h1 ? " · holds the page's H1" : ""}${x.heading ? ` · heading "${x.heading}"` : ""}${holds ? ` · ${holds}` : ""}\n    ${x.text || "(no words)"}`;
  }).join("\n");
}

/** The part a selection is in: the part whose element holds it (a selector the frame made), or the module a click in it named. */
export function partOfSelection(rawHtml: string, view: Pick<PageDoc, "changes" | "texts" | "source" | "newPage" | "fields">, parts: PagePart[], sel: { selector?: string; change?: string }): PagePart | null {
  if (sel.change) return parts.find((x) => x.change === sel.change) ?? null;
  if (!sel.selector) return null;
  const final = finalChanges(view as PageDoc);
  const html = applyChanges(rawHtml, final.changes as AnyChange[], { marks: final.from }).html;
  const root = parseHtml(html);
  const g = parseSelector(sel.selector);
  const el = g ? selectAll(root, g)[0] : undefined;
  if (!el) return null;
  for (const x of parts) {
    if (x.kind !== "page") continue;
    const pg = parseSelector(x.selector);
    const pe = pg ? selectAll(root, pg)[0] : undefined;
    if (pe && pe.start <= el.start && el.end <= pe.end) return x;
  }
  return null;
}


/** Does a selector find an element on the page as the server's preview lays the store view's changes over it? (A block
 * put at a place the page no longer has is said at once - never listed and not drawn.) */
export function findsOnPage(rawHtml: string, view: Pick<PageDoc, "changes" | "texts" | "source" | "newPage" | "fields">, selector: string): boolean {
  const g = parseSelector(selector);
  if (!g) return false;
  const final = finalChanges(view as PageDoc);
  const html = applyChanges(rawHtml, final.changes as AnyChange[], { marks: final.from }).html;
  return selectAll(parseHtml(html), g).length > 0;
}

/** The shop's own pages a page links to (its header, its content, its footer): address and words, once each - what a
 * plan's buttons may go to besides the categories (contact, help, the tools). Product pages and other store views out. */
export function pageLinks(rawHtml: string, store: string, max = 40): { url: string; text: string }[] {
  const out: { url: string; text: string }[] = [];
  const own = `/${store.split("/")[0]}/`;
  for (const m of rawHtml.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    if (out.length >= max) break;
    const text = wordsOf(m[2]).slice(0, 60);
    if (!text || text.length < 3) continue;
    try {
      const u = new URL(m[1].replace(/&amp;/g, "&"), "https://www.apsoparts.com");
      if (!/^(www|acc)\.apsoparts\.com$/.test(u.hostname) || !u.pathname.startsWith(own) || u.search) continue;
      const first = u.pathname.slice(own.length).split("/")[0];
      // the categories are listed with the tree; products, the account, the store switcher are no button's goal
      if (/^\d{8}/.test(first) || /\.html$/i.test(u.pathname) || /^(customer|checkout|wishlist|sales|catalogsearch|newsletter|anp|review|catalog|purchaseorder|requisition_list)\b/.test(first)) continue;
      const url = `https://www.apsoparts.com${u.pathname}`;
      if (!out.some((x) => x.url === url)) out.push({ url, text });
    } catch { /* not an address */ }
  }
  return out;
}

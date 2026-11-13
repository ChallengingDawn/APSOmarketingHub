// APSOconvert > OPTIMIZATIONS PER BLOCK - the pure part (tests/convert-blocks.test.ts).
//
// SARCLA 10.11.2026, on an optimization he could not place ("still really don't understand recommendations - we cannot
// say where it is"): "for now propose optimization on current pages beside product pages ... introduce block and module
// ... old page A/B testing with new block, new version, or 3 or 4 versions"; "for now is completely replace the module,
// then it's change the module"; "position based on click"; "let say that we have thresholds". So:
//   - an optimization is ONE BLOCK of the page (a part of its main column, or a shop block such as the newsletter band),
//     named so a person finds it: "Block 4 of 9 · Warum unsere Kunden immer wieder bestellen"
//   - for now (phase 1) its versions REPLACE the block with a module of the Content library - 3 or 4 really different
//     ones, side by side against the block as it is (later: the module itself changed - words, call to action, place)
//   - the AI picks the blocks from the clicks each one gets (the click map) against thresholds, and from what it holds
//   - product pages get none for now: their layout is the theme's code
// Pure: relative imports only.

import { parseHtml, parseSelector, selectAll, type Node } from "../content/studio/kinds/page/apply";
import { wordsOf, type PagePart } from "../content/studio/kinds/page/plan/places";
import type { PageKind } from "./model";

/** The thresholds a block is weak by (SARCLA: "let say that we have thresholds"). */
export const BLOCK = {
  /** a block holding something to click (links, buttons) that gets under this share of the page's clicks */
  weakShare: 0.03,
  /** the clicks a page needs before its shares say anything */
  minClicks: 30,
  /** blocks proposed per page, versions per block */
  maxBlocks: 3, minVersions: 3, maxVersions: 4,
} as const;

/** Product pages come later: their layout is the theme's code (SARCLA: "beside product pages because there we cannot yet change"). */
export const blockPage = (kind: PageKind) => kind === "home" || kind === "category" || kind === "cms";

/** A part's name as a person finds it on the page: "Block 4 of 9 · Warum unsere Kunden immer wieder bestellen". */
export function partName(p: Pick<PagePart, "id" | "heading" | "text" | "pb" | "holds">, n: number, of: number): string {
  const what = p.heading
    ? p.heading
    : p.pb === "slider" ? "the slider" : p.pb === "banner" ? "the banner" : p.holds.pictures && !p.text.replace(/^\(no words[^)]*\)$/, "").trim() ? (p.holds.pictures > 1 ? `${p.holds.pictures} pictures` : "a picture")
      : p.text ? `"${cutWords(p.text.replace(/^\(no words - pictures: /, "").replace(/\)$/, ""), 40)}"` : "a block";
  return `Block ${n} of ${of} · ${cutWords(what, 70)}`;
}
const cutWords = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`);

export type PartClicks = { id: string; clicks: number; share: number };

/**
 * The clicks of the click map counted per block of the page: a clicked element found in the page's HTML is counted for
 * the block that holds it; what is not found (drawn by the theme's scripts, the header, the footer) is "elsewhere".
 */
export function clicksPerPart(html: string, parts: Pick<PagePart, "id" | "selector" | "kind">[], heat: { s: string; n: number }[]): { parts: PartClicks[]; total: number; elsewhere: number } {
  const total = heat.reduce((a, h) => a + (h.n || 0), 0);
  const root = parseHtml(html);
  const boxes: { id: string; el: Node }[] = [];
  for (const p of parts) {
    if (p.kind !== "page" || !p.selector) continue;
    const g = parseSelector(p.selector);
    const el = g ? selectAll(root, g)[0] : undefined;
    if (el) boxes.push({ id: p.id, el });
  }
  const count = new Map<string, number>();
  let elsewhere = 0;
  for (const h of heat) {
    let el: Node | undefined;
    try { const g = parseSelector(h.s); el = g ? selectAll(root, g)[0] : undefined; } catch { el = undefined; }
    const box = el ? boxes.find((b) => b.el.start <= el!.start && el!.end <= b.el.end) : undefined;
    if (box) count.set(box.id, (count.get(box.id) ?? 0) + (h.n || 0));
    else elsewhere += h.n || 0;
  }
  return { parts: parts.map((p) => { const c = count.get(p.id) ?? 0; return { id: p.id, clicks: c, share: total ? c / total : 0 }; }), total, elsewhere };
}

/** Is a block weak by the thresholds? It holds something to click, and the page's clicks (enough of them) pass it by. */
export function weakBlock(p: Pick<PagePart, "holds" | "h1" | "kind">, c: PartClicks | undefined, total: number): boolean {
  if (p.kind !== "page" || p.h1) return false;
  const clickable = p.holds.links + p.holds.products + p.holds.categories > 0;
  return clickable && total >= BLOCK.minClicks && (c?.share ?? 0) < BLOCK.weakShare;
}

/** The parts as the AI reads them for block optimizations: each with its name, its clicks and whether it is weak. */
export function partsWithClicks(parts: PagePart[], clicks: { parts: PartClicks[]; total: number; elsewhere: number } | null): string {
  const of = parts.filter((p) => p.kind === "page").length;
  let n = 0;
  return parts.map((p) => {
    const c = clicks?.parts.find((x) => x.id === p.id);
    const h = p.holds;
    const holds = [h.products ? `${h.products} product links` : "", h.categories ? `${h.categories} category links` : "", h.links ? `${h.links} links` : "", h.pictures ? `${h.pictures} pictures` : ""].filter(Boolean).join(", ");
    const name = p.kind === "page" ? partName(p, ++n, of) : p.id;
    const click = clicks && clicks.total ? ` · ${c?.clicks ?? 0} clicks (${Math.round((c?.share ?? 0) * 1000) / 10}% of the page's ${clicks.total})${weakBlock(p, c, clicks.total) ? " · WEAK by the thresholds" : ""}` : "";
    return `${p.id} · ${name}${p.h1 ? " · holds the page's H1 (never replaced)" : ""}${p.pb ? ` · a ${p.pb}` : ""}${holds ? ` · ${holds}` : ""}${click}\n    ${p.text || "(no words)"}`;
  }).join("\n");
}

/** A part's name by its id ("P4" -> "Block 4 of 9 · ..."), for the optimization the hub saves. */
export function nameOf(parts: PagePart[], id: string): string {
  const own = parts.filter((p) => p.kind === "page");
  const i = own.findIndex((p) => p.id === id);
  if (i >= 0) return partName(own[i], i + 1, own.length);
  const p = parts.find((x) => x.id === id);
  return p ? `Block · ${p.heading || p.id}` : id;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export type BlockPick = { at: string; title: string; why: string; expect: string; versions: Record<string, unknown>[] };

/** The AI's blocks kept when they are blocks of the page it may replace (not the H1's, not twice), each with 3-4
 * versions; every refusal said. */
export function blocksIn(raw: unknown, parts: Pick<PagePart, "id" | "kind" | "h1">[], focus: string | null = null): { blocks: BlockPick[]; problems: string[] } {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const problems: string[] = [];
  const blocks: BlockPick[] = [];
  for (const b of (Array.isArray(o.blocks) ? o.blocks : []).slice(0, BLOCK.maxBlocks + 2)) {
    if (!b || typeof b !== "object" || blocks.length >= BLOCK.maxBlocks) continue;
    const x = b as Record<string, unknown>;
    const at = str(x.at, 8).toUpperCase();
    const part = parts.find((p) => p.id === at);
    if (!part) { problems.push(`"${at}" is not a block of the page - left out`); continue; }
    if (focus && at !== focus) { problems.push(`${at} is not the block asked for - left out`); continue; }
    if (part.h1) { problems.push(`${at} holds the page's title - it stays`); continue; }
    if (blocks.some((y) => y.at === at)) continue;
    const versions = (Array.isArray(x.versions) ? x.versions : []).filter((v): v is Record<string, unknown> => !!v && typeof v === "object").slice(0, BLOCK.maxVersions);
    if (versions.length < 2) { problems.push(`${at} came with fewer than 2 versions - left out`); continue; }
    const title = str(x.title, 120);
    if (!title) continue;
    blocks.push({ at, title, why: str(x.why, 1200), expect: str(x.expect, 500), versions });
  }
  return { blocks, problems };
}

/** One version as a plan of one step: it REPLACES the block (phase 1) - its module, layout, words and fill as the AI gave. */
export function versionStep(v: Record<string, unknown>, at: string): Record<string, unknown> {
  return { ...v, do: "replace", at, where: "", html: "" };
}

/** The version's line a person reads ("Version B · Checklist: ..."): the AI's label, else the module's name. */
export function versionLabel(v: Record<string, unknown>, moduleName: string): string {
  const l = str(v.label, 80);
  return l || moduleName || "A module";
}

/** A block of the shop outside the page's main column (the newsletter band in the footer) as a part the plan can
 * replace: found by its selector on the page, named, with what it holds. null when the page does not have it. */
export function shopPart(html: string, selector: string, name: string, id = "S1"): PagePart | null {
  const sel = selector.split(",")[0].trim();
  const g = parseSelector(sel);
  const el = g ? selectAll(parseHtml(html), g)[0] : undefined;
  if (!el) return null;
  const inner = html.slice(el.start, el.end);
  const heading = wordsOf(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1\s*>/i.exec(inner)?.[2] ?? "");
  return {
    id, kind: "page", selector: sel, change: "", module: "", tag: el.tag, heading: heading || name, h1: false,
    text: cutWords(wordsOf(inner), 260),
    holds: { products: 0, categories: 0, pictures: (inner.match(/<img\b/gi) ?? []).length, links: (inner.match(/<a\b/gi) ?? []).length + (inner.match(/<(form|button)\b/gi) ?? []).length },
  };
}

/**
 * EVERY STORE VIEW, NOT ONLY de-CH (SARCLA 11.11.2026, on the Pages app's de-CH home page and its six optimizations: "you
 * have a lot of optimizations in [this] locale, in the other locales you don't"): the start batch reads every store
 * view's home page first, then the pages in turn by store view - each store view's next page in the list's own order
 * (the problem pages first, then the most viewed) - so de-CH's views no longer take every place.
 */
export function spreadStores<T extends { path: string }>(pages: T[], storeOf: (path: string) => string, isHome: (path: string) => boolean): T[] {
  const homes = pages.filter((p) => isHome(p.path));
  const queues = new Map<string, T[]>();
  for (const p of pages) {
    if (isHome(p.path)) continue;
    const s = storeOf(p.path);
    queues.set(s, [...(queues.get(s) ?? []), p]);
  }
  const out = [...homes];
  const lists = [...queues.values()];
  for (let k = 0; lists.some((l) => k < l.length); k++) for (const l of lists) if (k < l.length) out.push(l[k]);
  return out;
}

/**
 * THE WHOLE PAGE, NOT ITS BLOCKS (SARCLA 13.11.2026, on the home page's pile of block optimizations: "here the whole page
 * needs to be reworked - the home page needs to be reworked completely; a recommendation of blocks makes no sense"): a
 * home page gets ONE optimization, the page reworked from the library's modules, with a version per angle. The shop
 * blocks on it (the home slider, the newsletter band) keep their own optimizations.
 */
export const REWORK_PART = "The whole page";
export const reworkPage = (kind: PageKind) => kind === "home";
export const isRework = (i: { scope?: string | null; part?: string | null }) => i.scope !== "block" && i.part === REWORK_PART;
export const REWORK_ANGLES = [
  { label: "Products first", request: "Rework the WHOLE page around the shop's products: its most bought products and its ranges where a buyer starts, then the ways into the technologies, then the shop's promises." },
  { label: "Technologies first", request: "Rework the WHOLE page around the shop's technologies and categories as the way in: a buyer finds his range first, then its products, then the shop's tools and promises." },
  { label: "Service and proof first", request: "Rework the WHOLE page around what makes buying here easy: the shop's promises and its tools (configurator, quick order, the experts) up top, proof from the shop's own facts, then the ranges and products." },
] as const;

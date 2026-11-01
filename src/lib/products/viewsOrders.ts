// PRODUCTS REPORTS > VIEWS AGAINST ORDERS (SARCLA 01.11.2026 on Products Reports: "articles CY/LY is ok ... but we should have
// much more ... we should really create subtabs" - his pick "Views against orders"): the product pages viewed against the
// articles bought online, by profit centre, by product hierarchy and by product, month by month - the most viewed and not
// bought, the view-to-order rate. Pure: the Engage read (marketingKpis/engage.ts) and Articles CY/LY's product hierarchy go
// in, the page's figures come out - so the route and the tests read it as it is.
//
// What each number is (GA4, memory reference_ga4_shop_item_events):
//   - a VIEW is GA4's view_item on a product PAGE (its address starts with the 8-digit product). view_item fires on the
//     category lists and the search results too - every product listed - so GA4's "items viewed" is not a view; the lists
//     count by their profit centre only (Engage reads them apart), never per product.
//   - an article BOUGHT ONLINE is a 10-digit article in a GA4 purchase, each article once a month (GA4's item quantity is
//     pieces - 754,961 O-rings - and its item revenue is broken, so neither is used), tied to its product by Products &
//     Pricing. Made to order (8001…) and articles Products & Pricing cannot place belong to no product page.
//   - GA4 counts the visitors who accepted statistics cookies only: every figure is a floor, and no figure carries a company.
//   - the article a visitor looked at is not known: the product page carries the product, the article exists once a size is
//     chosen (memory feedback_article_vs_product_number) - so the views stop at the product.
//   - the main group and sub group are Products & Pricing's, from Articles CY/LY: a product none of whose articles was
//     ordered since January last year has none there.
// The months: this year's whole months against the same months a year earlier (the read holds last year and this year).

import type { EngageData } from "../marketingKpis/engageCube";

export const VDIMS = ["pc", "group", "sub", "product"] as const;
export type VDim = (typeof VDIMS)[number];
/** Bought online in the period, or not - the products viewed only. */
export type Sold = "bought" | "not";
export type VFilters = Partial<Record<VDim, string[]>> & { sold?: Sold };
/** No main group or sub group known. */
export const NONE = "-";
/** A product Products & Pricing does not know - no profit centre. */
export const NO_PC = "?";
/** This year's months, 0 = January - both ends in. */
export type VWin = { start: number; end: number };

/** Products & Pricing's place of a product (Articles CY/LY's rows): its main group, sub group and name. */
export type Place = { group: string; sub: string; name: string };
export type Places = Record<string, Place>;

/** Each product's place from Articles CY/LY's rows - an article that names a main group wins over one that does not. */
export function placesOf(rows: { product?: string; group?: string; sub?: string; productName?: string }[]): Places {
  const out: Places = {};
  for (const r of rows) {
    const p = (r.product ?? "").trim();
    if (!p) continue;
    const was = out[p];
    if (was && (was.group || !r.group)) { if (!was.name && r.productName) was.name = r.productName; continue; }
    out[p] = { group: (r.group ?? "").trim(), sub: (r.sub ?? "").trim(), name: (r.productName ?? "").trim() || was?.name || "" };
  }
  return out;
}

/** The filters out of an address: known levels only, each value short, a few hundred at most; the sold choice. */
export function vFiltersOf(get: (d: VDim | "sold") => unknown): VFilters {
  const out: VFilters = {};
  for (const d of VDIMS) {
    const raw = get(d);
    const list = (Array.isArray(raw) ? raw : raw == null ? [] : [raw])
      .filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 120)).filter(Boolean);
    const v = [...new Set(list)].slice(0, 300);
    if (v.length) out[d] = v;
  }
  const s = get("sold");
  const sold = Array.isArray(s) ? s[0] : s;
  if (sold === "bought" || sold === "not") out.sold = sold;
  return out;
}

/** The window inside this year's whole months; the year so far when none is given or it runs past them. */
export function clampWin(monthsDone: number, w?: Partial<VWin> | null): VWin {
  const last = Math.max(0, monthsDone - 1);
  const s = Number.isInteger(w?.start) ? Math.min(Math.max(0, w!.start!), last) : 0;
  const e = Number.isInteger(w?.end) ? Math.min(Math.max(s, w!.end!), last) : last;
  return { start: s, end: e };
}

/* ── one product in the window ─────────────────────────────────────────── */

/** A product's figures over the window: its page's views and its articles bought online, this year and the same months a year earlier. */
export type Prod = { id: string; name: string; pc: string; group: string; sub: string; v: number; pv: number; b: number; pb: number };

/** a month's place in a product's 24 months: last year's January to December, then this year's */
const CY = (i: number) => 12 + i, PY = (i: number) => i;

type Src = Pick<EngageData, "products">;
function prodsOf(d: Src, places: Places, win: VWin): Prod[] {
  const out: Prod[] = [];
  for (const [id, p] of Object.entries(d.products ?? {})) {
    let v = 0, pv = 0, b = 0, pb = 0;
    for (let i = win.start; i <= win.end; i++) { v += p.v[CY(i)] ?? 0; pv += p.v[PY(i)] ?? 0; b += p.b?.[CY(i)] ?? 0; pb += p.b?.[PY(i)] ?? 0; }
    if (!v && !pv && !b && !pb) continue;
    const at = places[id];
    out.push({ id, name: p.n || at?.name || "", pc: p.pc || NO_PC, group: at?.group || NONE, sub: at?.sub || NONE, v, pv, b, pb });
  }
  return out;
}

const keyOf = (p: Prod, d: VDim) => (d === "pc" ? p.pc : d === "group" ? p.group : d === "sub" ? p.sub : p.id);
type Sets = Partial<Record<VDim, Set<string>>>;
const setsOf = (f: VFilters): Sets => Object.fromEntries(VDIMS.filter((d) => f[d]?.length).map((d) => [d, new Set(f[d])]));
/** The products the filters leave - one level's own filter left out when `skip` names it (its chart shows all its values).
 *  The sold choice is not a membership: it is applied per side (this year's, and a year earlier's on its own terms). */
function matching(ps: Prod[], f: VFilters, skip?: VDim): Prod[] {
  const s = setsOf(f);
  if (!Object.keys(s).length) return ps;
  return ps.filter((p) => VDIMS.every((d) => d === skip || !s[d] || s[d]!.has(keyOf(p, d))));
}
/** viewed in the window - and bought online in it, or not - on one side */
const viewedCy = (p: Prod, sold?: Sold) => p.v > 0 && (!sold || (sold === "bought") === p.b > 0);
const viewedPy = (p: Prod, sold?: Sold) => p.pv > 0 && (!sold || (sold === "bought") === p.pb > 0);

/* ── the figures ───────────────────────────────────────────────────────── */

export type VFig = {
  /** product page views */
  views: number; viewsPy: number;
  /** products whose page was viewed */
  products: number; productsPy: number;
  /** of them, one of its articles bought online in the same months - bought / products is the view-to-order rate */
  bought: number; boughtPy: number;
  /** of them, none bought online */
  notBought: number; notBoughtPy: number;
  /** the articles of those products bought online, each article once a month */
  articles: number; articlesPy: number;
};
const zero = (): VFig => ({ views: 0, viewsPy: 0, products: 0, productsPy: 0, bought: 0, boughtPy: 0, notBought: 0, notBoughtPy: 0, articles: 0, articlesPy: 0 });

function add(f: VFig, p: Prod, sold?: Sold) {
  if (viewedCy(p, sold)) { f.views += p.v; f.products++; if (p.b > 0) f.bought++; else f.notBought++; }
  if (viewedPy(p, sold)) { f.viewsPy += p.pv; f.productsPy++; if (p.pb > 0) f.boughtPy++; else f.notBoughtPy++; }
  // the articles: of every product in scope - with the sold choice, of those viewed (and so bought, or not) only
  if (!sold || viewedCy(p, sold)) f.articles += p.b;
  if (!sold || viewedPy(p, sold)) f.articlesPy += p.pb;
}
export function figuresOf(ps: Prod[], sold?: Sold): VFig {
  const f = zero();
  for (const p of ps) add(f, p, sold);
  return f;
}
/** The view-to-order rate: of the products viewed, the share with an article bought online in the same months. */
export const rateOf = (bought: number, products: number) => (products > 0 ? bought / products : null);

/* ── a breakdown ───────────────────────────────────────────────────────── */

export type VRow = VFig & {
  key: string;
  /** a profit centre's category list views (view_item on a list) - by profit centre, only while no lower level is chosen */
  lists?: number; listsPy?: number;
};

/** A level's values with their figures - its own filter left out, so its chart shows all of them (the chosen marked). */
export function breakdownOf(ps: Prod[], f: VFilters, d: Exclude<VDim, "product">, lists?: EngageData["lists"], win?: VWin): VRow[] {
  const rows = new Map<string, VRow>();
  for (const p of matching(ps, f, d)) {
    const k = keyOf(p, d);
    let r = rows.get(k);
    if (!r) rows.set(k, (r = { key: k, ...zero() }));
    add(r, p, f.sold);
  }
  // the category lists: by their profit centre, while nothing below the profit centre is chosen and no sold choice
  if (d === "pc" && lists && win && !f.group?.length && !f.sub?.length && !f.product?.length && !f.sold) {
    for (const [k, xs] of Object.entries(lists)) {
      if (k === "search" || k === "other") continue;
      let l = 0, lp = 0;
      for (let i = win.start; i <= win.end; i++) { l += xs[CY(i)] ?? 0; lp += xs[PY(i)] ?? 0; }
      if (!l && !lp) continue;
      let r = rows.get(k);
      if (!r) { rows.set(k, (r = { key: k, ...zero() })); }
      r.lists = l; r.listsPy = lp;
    }
    // a product Products & Pricing does not know has no category list: its cell stays empty
    for (const r of rows.values()) if (r.key !== NO_PC) { r.lists ??= 0; r.listsPy ??= 0; }
  }
  return [...rows.values()].filter((r) => r.views || r.viewsPy || r.articles || r.articlesPy || r.lists || r.listsPy)
    .sort((a, b) => b.views - a.views || b.viewsPy - a.viewsPy || a.key.localeCompare(b.key));
}

/* ── month by month ────────────────────────────────────────────────────── */

export type VMonth = VFig & { month: number };
/** Each month of the window on its own: the products viewed that month, and of them those bought online that month. */
export function monthsOf(d: Src, places: Places, win: VWin, f: VFilters): VMonth[] {
  const out: VMonth[] = [];
  for (let i = win.start; i <= win.end; i++) out.push({ month: i, ...figuresOf(matching(prodsOf(d, places, { start: i, end: i }), f), f.sold) });
  return out;
}

/* ── the products ──────────────────────────────────────────────────────── */

export type PLine = { id: string; name: string; pc: string; group: string; sub: string; views: number; viewsPy: number; articles: number; articlesPy: number };
const line = (p: Prod): PLine => ({ id: p.id, name: p.name, pc: p.pc, group: p.group, sub: p.sub, views: p.v, viewsPy: p.pv, articles: p.b, articlesPy: p.pb });

/** The products viewed most and none of their articles bought online - and those bought (the largest first). */
export function topsOf(ps: Prod[], f: VFilters, n = 50): { notBought: PLine[]; bought: PLine[] } {
  const viewed = matching(ps, f).filter((p) => p.v > 0);
  const by = (a: Prod, b: Prod) => b.v - a.v || b.pv - a.pv || a.id.localeCompare(b.id);
  return {
    notBought: f.sold === "bought" ? [] : viewed.filter((p) => !p.b).sort(by).slice(0, n).map(line),
    bought: f.sold === "not" ? [] : viewed.filter((p) => p.b > 0).sort(by).slice(0, n).map(line),
  };
}

export const PRODUCT_SORTS = ["views", "viewsPy", "change", "articles", "name", "pc", "group", "sub"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export type ProductPage = { total: number; page: number; size: number; rows: PLine[] };

/** A part of a product's number, its name, its main group or sub group. */
function searched(ps: Prod[], q: string | null | undefined): Prod[] {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return ps;
  return ps.filter((p) => p.id.includes(needle) || p.name.toLowerCase().includes(needle) || p.group.toLowerCase().includes(needle) || p.sub.toLowerCase().includes(needle));
}

/** Every product viewed under the filters (with the sold choice: viewed and bought, or not), searched, sorted, a page at a time. */
export function productPage(ps: Prod[], f: VFilters, o: { q?: string | null; sort?: ProductSort | null; desc?: boolean; page?: number; size?: number } = {}): ProductPage {
  const all = searched(matching(ps, f).filter((p) => viewedCy(p, f.sold)), o.q);
  const sort = o.sort && (PRODUCT_SORTS as readonly string[]).includes(o.sort) ? o.sort : "views";
  const text = sort === "name" || sort === "pc" || sort === "group" || sort === "sub";
  const desc = o.desc ?? !text;
  const ch = (p: Prod) => (p.pv ? p.v / p.pv - 1 : p.v ? Infinity : -Infinity);
  const val: Record<ProductSort, (p: Prod) => number | string> = {
    views: (p) => p.v, viewsPy: (p) => p.pv, change: ch, articles: (p) => p.b,
    name: (p) => (p.name || p.id).toLowerCase(), pc: (p) => p.pc, group: (p) => (p.group === NONE ? "~" : p.group.toLowerCase()), sub: (p) => (p.sub === NONE ? "~" : p.sub.toLowerCase()),
  };
  const get = val[sort];
  const sorted = [...all].sort((a, b) => {
    const x = get(a), y = get(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return (desc ? -c : c) || b.v - a.v || a.id.localeCompare(b.id);
  });
  const size = Math.max(1, Math.min(50, o.size ?? 25));
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const page = Math.min(Math.max(0, o.page ?? 0), pages - 1);
  return { total: sorted.length, page, size, rows: sorted.slice(page * size, page * size + size).map(line) };
}

/* ── the page's whole answer ───────────────────────────────────────────── */

export type VSummary = {
  generatedAt: string; year: number; monthsDone: number; win: VWin;
  /** Articles CY/LY's hierarchy was there to place the products */
  hierarchy: boolean;
  figures: VFig;
  by: { pc: VRow[]; group: VRow[]; sub: VRow[] };
  months: VMonth[];
  top: { notBought: PLine[]; bought: PLine[] };
  /** the chosen products' names */
  names: Record<string, string>;
  /** the views GA4 fired on the search results and on pages the hub cannot place - no product, no profit centre */
  apart: { search: number; searchPy: number; other: number; otherPy: number };
  /** made-to-order articles bought online (8001…) - no product page; and the articles Products & Pricing could not place (the read's two years) */
  madeToOrder: number; madeToOrderPy: number; unmapped: number;
};

/* ── the visits' funnel (SARCLA 01.11.2026: "data can't be accurate, it's too simple, only one graph") ── */

/** GA4's visits per month at each step: "YYYY-MM" -> [saw articles, put one in the cart, began the check-out, bought]. */
export type PathMonths = Record<string, [number, number, number, number]>;
/** A month of the visits' funnel, this year and the same month a year earlier: [visits, saw, cart, check-out, bought]. */
export type VisitMonth = { month: number; cy: number[]; py: number[] };
export type VisitsFunnel = { months: VisitMonth[]; cy: number[]; py: number[] };
/**
 * The visits of the window's months at each step - the visits (Engage's engageMonthly sessions), those that saw articles, put
 * one in the cart, began the check-out, bought - this year and the same months a year earlier. Null when GA4 gave no step.
 */
export function visitsFunnelOf(visits: Record<string, [number, number, number, number]>, path: PathMonths, year: number, win: VWin): VisitsFunnel | null {
  const months: VisitMonth[] = [];
  const cy = [0, 0, 0, 0, 0], py = [0, 0, 0, 0, 0];
  let any = false;
  for (let m = win.start; m <= win.end; m++) {
    const key = (y: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
    const row = (y: number) => [visits[key(y)]?.[0] ?? 0, ...(path[key(y)] ?? [0, 0, 0, 0])];
    const a = row(year), b = row(year - 1);
    if (path[key(year)] || path[key(year - 1)]) any = true;
    months.push({ month: m, cy: a, py: b });
    for (let i = 0; i < 5; i++) { cy[i] += a[i]; py[i] += b[i]; }
  }
  return any ? { months, cy, py } : null;
}

/** The products of the window, with their place - for the summary and for the pages of the list. */
export const productsOf = prodsOf;

export function summaryOf(d: Pick<EngageData, "generatedAt" | "year" | "monthsDone" | "products" | "lists" | "madeToOrder" | "unmapped">, places: Places, f: VFilters, given?: Partial<VWin> | null): VSummary {
  const win = clampWin(d.monthsDone, given);
  const ps = prodsOf(d, places, win);
  const names: Record<string, string> = {};
  for (const id of f.product ?? []) { const p = d.products?.[id]; names[id] = p?.n || places[id]?.name || ""; }
  const sumW = (xs: number[] | undefined, at: (i: number) => number) => { let s = 0; for (let i = win.start; i <= win.end; i++) s += xs?.[at(i)] ?? 0; return s; };
  return {
    generatedAt: d.generatedAt, year: d.year, monthsDone: d.monthsDone, win,
    hierarchy: Object.keys(places).length > 0,
    figures: figuresOf(matching(ps, f), f.sold),
    by: { pc: breakdownOf(ps, f, "pc", d.lists, win), group: breakdownOf(ps, f, "group"), sub: breakdownOf(ps, f, "sub") },
    months: monthsOf(d, places, win, f),
    top: topsOf(ps, f),
    names,
    apart: { search: sumW(d.lists?.search, CY), searchPy: sumW(d.lists?.search, PY), other: sumW(d.lists?.other, CY), otherPy: sumW(d.lists?.other, PY) },
    madeToOrder: sumW(d.madeToOrder, CY), madeToOrderPy: sumW(d.madeToOrder, PY), unmapped: d.unmapped ?? 0,
  };
}

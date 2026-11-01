// ARTICLES CY/LY, THE PAGE'S FIGURES (SARCLA 01.11.2026: "Articles rebuilt like Figures" - the ESO Figures' page: figures on
// top, a tab per breakdown, the Filters window, a Filter by and a Companies button on every graph). Worked out on the server
// from the report (model.ts) - 45,000 articles are too many to send - and from the buyers kept beside it: the figures, each
// breakdown (the profit centre, and Products & Pricing's main group, sub group and product), the movers, a page of the article
// list and the companies behind any of them. Pure: no HubSpot, no database, so the routes and the tests read it as it is.
//
// The report is this year to date against the same days of last year, and all of last year beside it - it keeps no months,
// so the page has no other period to offer.

import { movers, type ArticleRow, type Buyers } from "./model";

/** What the page filters by: a profit centre, a main group, a sub group, a product (its number), an article (its number). */
export const ADIMS = ["pc", "group", "sub", "product", "article"] as const;
export type ADim = (typeof ADIMS)[number];
/** The breakdowns a tab is drawn by - the article has its own list. */
export const BDIMS = ["pc", "group", "sub", "product"] as const;
export type BDim = (typeof BDIMS)[number];
export type AFilters = Partial<Record<ADim, string[]>>;
/** No main group, sub group or product: an article Products & Pricing does not know (made-to-order, old internal ids). */
export const NONE = "-";
/** No profit centre - as the report writes it. */
export const NO_PC = "?";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** An article's value on a level. */
export function keyOf(r: ArticleRow, d: ADim): string {
  switch (d) {
    case "pc": return r.pc || NO_PC;
    case "group": return r.group || NONE;
    case "sub": return r.sub || NONE;
    case "product": return r.product || NONE;
    default: return r.article;
  }
}

/** The filters out of an address or a body: known levels only, each value short, a few hundred at most. */
export function filtersOf(get: (d: ADim) => unknown): AFilters {
  const out: AFilters = {};
  for (const d of ADIMS) {
    const raw = get(d);
    const list = (Array.isArray(raw) ? raw : raw == null ? [] : [raw])
      .filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 120)).filter(Boolean);
    const v = [...new Set(list)].slice(0, 300);
    if (v.length) out[d] = v;
  }
  return out;
}

type Sets = Partial<Record<ADim, Set<string>>>;
const setsOf = (f: AFilters): Sets => Object.fromEntries(ADIMS.filter((d) => f[d]?.length).map((d) => [d, new Set(f[d])]));
const passes = (r: ArticleRow, s: Sets, skip?: ADim) => {
  for (const d of ADIMS) { const set = s[d]; if (set && d !== skip && !set.has(keyOf(r, d))) return false; }
  return true;
};
/** The articles the filters leave - one level's own filter left out when `skip` names it (its chart shows all its values). */
export function matching(rows: ArticleRow[], f: AFilters, skip?: ADim): ArticleRow[] {
  const s = setsOf(f);
  return Object.keys(s).length ? rows.filter((r) => passes(r, s, skip)) : rows;
}
/** A part of an article number, its description or its product's name. */
export function searched(rows: ArticleRow[], q: string | null | undefined): ArticleRow[] {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) => r.article.toLowerCase().includes(needle) || r.description.toLowerCase().includes(needle) || (r.productName ?? "").toLowerCase().includes(needle));
}

/* ── the figures on top ────────────────────────────────────────────────── */

export type ArtFigures = {
  /** revenue: this year to date, last year's same days, all of last year - every line, the accounting lines too */
  revCy: number; revLyYtd: number; revLy: number;
  /** articles with an order line this year to date, and on last year's same days - accounting lines (credit notes, fees) not counted */
  articlesCy: number; articlesLyYtd: number;
  /** sold this year, not at all last year - and their revenue */
  fresh: number; freshRev: number;
  /** sold by this day last year, nothing this year - and that revenue */
  quiet: number; quietRev: number;
  /** articles selling more / less than on last year's same days */
  growing: number; falling: number;
  /** the companies that bought them (null without the buyers) */
  companiesCy: number | null; companiesLyYtd: number | null;
};

/** The companies that bought these articles: this year to date, and on last year's same days. */
function companyCount(rows: ArticleRow[], b: Buyers | null | undefined): { cy: number | null; ly: number | null } {
  if (!b) return { cy: null, ly: null };
  const cy = new Set<number>(), ly = new Set<number>();
  for (const r of rows) {
    const x = b.byArticle[r.article];
    if (!x) continue;
    for (let i = 0; i < x.length; i += 4) { if (x[i + 1] & 1) cy.add(x[i]); if (x[i + 1] & 2) ly.add(x[i]); }
  }
  return { cy: cy.size, ly: ly.size };
}

export function figuresOf(rows: ArticleRow[], b?: Buyers | null): ArtFigures {
  const f: ArtFigures = { revCy: 0, revLyYtd: 0, revLy: 0, articlesCy: 0, articlesLyYtd: 0, fresh: 0, freshRev: 0, quiet: 0, quietRev: 0, growing: 0, falling: 0, companiesCy: null, companiesLyYtd: null };
  for (const r of rows) {
    f.revCy += r.revenueCy; f.revLyYtd += r.revenueLyYtd; f.revLy += r.revenueLy;
    if (r.pseudo) continue;
    if (r.linesCy > 0) f.articlesCy++;
    if (r.linesLyYtd > 0) f.articlesLyYtd++;
    if (r.revenueCy > 0 && !r.revenueLy) { f.fresh++; f.freshRev += r.revenueCy; }
    if (r.revenueLyYtd > 0 && !r.revenueCy) { f.quiet++; f.quietRev += r.revenueLyYtd; }
    if (r.delta > 0) f.growing++; else if (r.delta < 0) f.falling++;
  }
  const c = companyCount(rows, b);
  return { ...f, revCy: r2(f.revCy), revLyYtd: r2(f.revLyYtd), revLy: r2(f.revLy), freshRev: r2(f.freshRev), quietRev: r2(f.quietRev), companiesCy: c.cy, companiesLyYtd: c.ly };
}

/* ── a breakdown ───────────────────────────────────────────────────────── */

export type Bucket = {
  key: string;
  /** a product's name and its place - the first article's */
  name?: string; pc?: string; group?: string; sub?: string;
  cy: number; lyYtd: number; ly: number;
  articlesCy: number; articlesLyYtd: number; fresh: number; quiet: number;
  companiesCy: number | null; companiesLyYtd: number | null;
};

/** Each value of a level with its figures - over the articles the filters leave, the level's own filter left out (its chart
 *  shows every value, the chosen ones marked) - the largest revenue first. */
export function bucketsOf(rows: ArticleRow[], f: AFilters, dim: BDim, b?: Buyers | null): Bucket[] {
  const acc = new Map<string, Bucket & { cu?: Set<number>; lu?: Set<number> }>();
  for (const r of matching(rows, f, dim)) {
    const key = keyOf(r, dim);
    let x = acc.get(key);
    if (!x) {
      x = { key, cy: 0, lyYtd: 0, ly: 0, articlesCy: 0, articlesLyYtd: 0, fresh: 0, quiet: 0, companiesCy: null, companiesLyYtd: null };
      if (dim === "product") Object.assign(x, { name: r.productName ?? "", pc: keyOf(r, "pc"), group: keyOf(r, "group"), sub: keyOf(r, "sub") });
      if (b) { x.cu = new Set(); x.lu = new Set(); }
      acc.set(key, x);
    }
    x.cy += r.revenueCy; x.lyYtd += r.revenueLyYtd; x.ly += r.revenueLy;
    if (!r.pseudo) {
      if (r.linesCy > 0) x.articlesCy++;
      if (r.linesLyYtd > 0) x.articlesLyYtd++;
      if (r.revenueCy > 0 && !r.revenueLy) x.fresh++;
      if (r.revenueLyYtd > 0 && !r.revenueCy) x.quiet++;
    }
    const by = b?.byArticle[r.article];
    if (by && x.cu && x.lu) for (let i = 0; i < by.length; i += 4) { if (by[i + 1] & 1) x.cu.add(by[i]); if (by[i + 1] & 2) x.lu.add(by[i]); }
  }
  return [...acc.values()].map(({ cu, lu, ...x }) => ({ ...x, cy: r2(x.cy), lyYtd: r2(x.lyYtd), ly: r2(x.ly), companiesCy: cu ? cu.size : null, companiesLyYtd: lu ? lu.size : null }))
    .filter((x) => x.cy || x.lyYtd || x.ly)
    .sort((a, z) => z.cy - a.cy || z.lyYtd - a.lyYtd || a.key.localeCompare(z.key));
}

/* ── what the page reads: the figures, the breakdowns, the movers ──────── */

/** An article as the page lists it - its buyers per country stay on the server. */
export type ArticleLine = Omit<ArticleRow, "byCountryCy">;
const line = ({ byCountryCy: _c, ...r }: ArticleRow): ArticleLine => r;

/** The products sent with the figures - the largest; every one is a page at a time (bucketPage): 5,000 products would
 *  make every click a megabyte and a half. */
export const PRODUCTS_SENT = 50;

export type Explore = {
  figures: ArtFigures;
  /** each breakdown's values - the products the largest PRODUCTS_SENT only; and, for its table's Total, the figures with
   *  its own filter left out */
  by: Record<BDim, Bucket[]>;
  /** how many products there are in all */
  products: number;
  all: Record<BDim, ArtFigures>;
  /** growing and falling most, accounting lines left out - the article filter left out, the chosen ones marked */
  movers: { top: ArticleLine[]; flop: ArticleLine[] };
  /** the chosen products' and articles' names, for the bar under the tabs */
  names: { product: Record<string, string>; article: Record<string, string> };
};

export function exploreOf(rows: ArticleRow[], f: AFilters, b?: Buyers | null): Explore {
  const left = matching(rows, f);
  const by = Object.fromEntries(BDIMS.map((d) => [d, bucketsOf(rows, f, d, b)])) as Record<BDim, Bucket[]>;
  const all = Object.fromEntries(BDIMS.map((d) => [d, f[d]?.length ? figuresOf(matching(rows, f, d), b) : null])) as Record<BDim, ArtFigures | null>;
  const figures = figuresOf(left, b);
  const m = movers(matching(rows, f, "article"));
  const want = { product: new Set(f.product ?? []), article: new Set(f.article ?? []) };
  const names: Explore["names"] = { product: {}, article: {} };
  if (want.product.size || want.article.size) {
    for (const r of rows) {
      if (want.article.has(r.article)) names.article[r.article] = r.description;
      const p = r.product || NONE;
      if (want.product.has(p) && !names.product[p]) names.product[p] = r.productName ?? "";
    }
  }
  const products = by.product.length;
  by.product = by.product.slice(0, PRODUCTS_SENT);
  return {
    figures, by, products, all: Object.fromEntries(BDIMS.map((d) => [d, all[d] ?? figures])) as Record<BDim, ArtFigures>,
    movers: { top: m.top.map(line), flop: m.flop.map(line) }, names,
  };
}

/* ── a level's table, a page at a time (the products) ──────────────────── */

export const BUCKET_SORTS = ["name", "pc", "group", "sub", "cy", "lyYtd", "delta", "deltaPct", "articlesCy", "fresh", "quiet", "companiesCy", "ly"] as const;
export type BucketSort = (typeof BUCKET_SORTS)[number];
export type BucketPage = { total: number; page: number; size: number; rows: Bucket[] };
const B_TEXT: Partial<Record<BucketSort, (x: Bucket) => string>> = {
  // a product without a name after the named ones
  name: (x) => `${x.name ? "0" : "1"} ${x.name ?? ""} ${x.key}`, pc: (x) => x.pc ?? "", group: (x) => x.group ?? "", sub: (x) => x.sub ?? "",
};
const B_NUM: Partial<Record<BucketSort, (x: Bucket) => number | null>> = {
  cy: (x) => x.cy, lyYtd: (x) => x.lyYtd, delta: (x) => x.cy - x.lyYtd, deltaPct: (x) => (x.lyYtd ? (x.cy - x.lyYtd) / Math.abs(x.lyYtd) : null),
  articlesCy: (x) => x.articlesCy, fresh: (x) => x.fresh, quiet: (x) => x.quiet, companiesCy: (x) => x.companiesCy, ly: (x) => x.ly,
};
/** A level's values (bucketsOf, kept by the route) found by a part of the number, the name or the groups, sorted - a figure
 *  from the largest unless asked the other way, an empty one last - a page at a time. */
export function bucketPage(all: Bucket[], o: { q?: string | null; sort?: BucketSort | null; desc?: boolean; page?: number; size?: number }): BucketPage {
  const needle = (o.q ?? "").trim().toLowerCase();
  let list = needle ? all.filter((x) => [x.key, x.name, x.group, x.sub].some((v) => (v ?? "").toLowerCase().includes(needle))) : all;
  const key = o.sort && (BUCKET_SORTS as readonly string[]).includes(o.sort) ? o.sort : null;
  if (key) {
    const text = B_TEXT[key], num = B_NUM[key];
    const dir = (o.desc ?? !text) ? -1 : 1;
    list = [...list].sort(text
      ? (a, b) => dir * text(a).localeCompare(text(b), "en", { numeric: true, sensitivity: "base" }) || b.cy - a.cy
      : (a, b) => {
        const x = num!(a), y = num!(b);
        if (x == null || y == null) return x == null && y == null ? b.cy - a.cy : x == null ? 1 : -1;
        return dir * (x - y) || b.cy - a.cy || a.key.localeCompare(b.key);
      });
  }
  const size = Math.min(100, Math.max(1, o.size ?? 25));
  const pages = Math.max(1, Math.ceil(list.length / size));
  const page = Math.min(Math.max(0, o.page ?? 0), pages - 1);
  return { total: list.length, page, size, rows: list.slice(page * size, page * size + size) };
}

/* ── the article list, a page at a time ────────────────────────────────── */

export const ART_SORTS = ["article", "pc", "product", "revenueCy", "revenueLyYtd", "delta", "deltaPct", "revenueLy", "customersCy", "qtyCy"] as const;
export type ArtSort = (typeof ART_SORTS)[number];
const TEXT_SORT: Partial<Record<ArtSort, (r: ArticleRow) => string>> = {
  article: (r) => r.article, pc: (r) => r.pc, product: (r) => r.productName || r.product || "",
};
const NUM_SORT: Partial<Record<ArtSort, (r: ArticleRow) => number | null>> = {
  revenueCy: (r) => r.revenueCy, revenueLyYtd: (r) => r.revenueLyYtd, delta: (r) => r.delta, deltaPct: (r) => r.deltaPct,
  revenueLy: (r) => r.revenueLy, customersCy: (r) => r.customersCy, qtyCy: (r) => r.qtyCy,
};
export type ArticlePage = { total: number; page: number; size: number; rows: ArticleLine[]; sum: { revCy: number; revLyYtd: number; revLy: number } };

/** The articles the filters and the search leave, sorted - a figure from the largest unless asked the other way; an empty
 *  figure (a change in % without last year) last either way - a page at a time. */
export function articlePage(rows: ArticleRow[], f: AFilters, o: { q?: string | null; sort?: ArtSort | null; desc?: boolean; page?: number; size?: number }): ArticlePage {
  const found = searched(matching(rows, f), o.q);
  const key: ArtSort = o.sort && (ART_SORTS as readonly string[]).includes(o.sort) ? o.sort : "revenueCy";
  const desc = o.desc ?? !TEXT_SORT[key];
  const dir = desc ? -1 : 1;
  const text = TEXT_SORT[key], num = NUM_SORT[key];
  const list = [...found].sort(text
    ? (a, b) => dir * text(a).localeCompare(text(b), "en", { numeric: true, sensitivity: "base" }) || b.revenueCy - a.revenueCy
    : (a, b) => {
      const x = num!(a), y = num!(b);
      if (x == null || y == null) return x == null && y == null ? b.revenueCy - a.revenueCy : x == null ? 1 : -1;
      return dir * (x - y) || b.revenueCy - a.revenueCy || a.article.localeCompare(b.article);
    });
  const size = Math.min(100, Math.max(1, o.size ?? 25));
  const pages = Math.max(1, Math.ceil(list.length / size));
  const page = Math.min(Math.max(0, o.page ?? 0), pages - 1);
  const sum = { revCy: 0, revLyYtd: 0, revLy: 0 };
  for (const r of list) { sum.revCy += r.revenueCy; sum.revLyYtd += r.revenueLyYtd; sum.revLy += r.revenueLy; }
  return { total: list.length, page, size, rows: list.slice(page * size, page * size + size).map(line), sum: { revCy: r2(sum.revCy), revLyYtd: r2(sum.revLyYtd), revLy: r2(sum.revLy) } };
}

/* ── the companies behind a graph ──────────────────────────────────────── */

export const COMPANY_SORTS = ["name", "cy", "lyYtd", "change", "articles", "un", "country"] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];
export type CompanyLine = {
  /** the HubSpot company - "" where HubSpot has none with that customer number */
  id: string; name: string; un: string; country: string;
  /** revenue on these articles: this year to date, last year's same days */
  cy: number; lyYtd: number;
  /** how many of these articles it bought this year to date, and on last year's same days */
  articles: number; articlesLy: number;
};
export type CompanyPage = { total: number; page: number; size: number; rows: CompanyLine[]; sum: { cy: number; lyYtd: number } };

/**
 * The companies that bought these articles - this year to date or on last year's same days - each with its revenue on them,
 * the largest first; a column clicked sorts by it (the largest or A first, then the other way). A part of a name or a
 * customer number finds a company. Adds up to the graph: the revenue of the articles' buyers - lines without a customer
 * number are in the graph and on no company.
 */
export function companiesOf(rows: ArticleRow[], b: Buyers, o: { q?: string | null; sort?: CompanySort | null; desc?: boolean; page?: number; size?: number }): CompanyPage {
  const fig = new Map<number, { cy: number; ly: number; a: number; al: number }>();
  for (const r of rows) {
    const x = b.byArticle[r.article];
    if (!x) continue;
    for (let i = 0; i < x.length; i += 4) {
      let c = fig.get(x[i]);
      if (!c) { c = { cy: 0, ly: 0, a: 0, al: 0 }; fig.set(x[i], c); }
      c.cy += x[i + 2]; c.ly += x[i + 3];
      if (x[i + 1] & 1) c.a++;
      if (x[i + 1] & 2) c.al++;
    }
  }
  const nameOf = (i: number) => b.companies[i]?.[2] || `Customer ${b.companies[i]?.[0] ?? ""}`;
  const needle = (o.q ?? "").trim().toLowerCase();
  let list = [...fig.keys()];
  if (needle) list = list.filter((i) => nameOf(i).toLowerCase().includes(needle) || (b.companies[i]?.[0] ?? "").toLowerCase().includes(needle));
  // the graph's own order: this year's revenue, then last year's, then the name
  list.sort((a, z) => fig.get(z)!.cy - fig.get(a)!.cy || fig.get(z)!.ly - fig.get(a)!.ly || nameOf(a).localeCompare(nameOf(z)));
  const key = o.sort && (COMPANY_SORTS as readonly string[]).includes(o.sort) ? o.sort : null;
  if (key) {
    const at = new Map(list.map((i, k) => [i, k]));
    const text = key === "name" ? nameOf : key === "un" ? (i: number) => b.companies[i]?.[0] ?? "" : key === "country" ? (i: number) => b.companies[i]?.[3] ?? "" : null;
    const desc = o.desc ?? !text;
    const dir = desc ? -1 : 1;
    const num = (i: number) => { const c = fig.get(i)!; return key === "cy" ? c.cy : key === "lyYtd" ? c.ly : key === "change" ? c.cy - c.ly : c.a; };
    list.sort(text
      // an empty country last, whichever way
      ? (a, z) => (!text(a) !== !text(z) ? (text(a) ? -1 : 1) : dir * text(a).localeCompare(text(z), "en", { numeric: true, sensitivity: "base" })) || at.get(a)! - at.get(z)!
      : (a, z) => dir * (num(a) - num(z)) || at.get(a)! - at.get(z)!);
  }
  const sum = { cy: 0, lyYtd: 0 };
  for (const i of list) { const c = fig.get(i)!; sum.cy += c.cy; sum.lyYtd += c.ly; }
  const size = Math.min(100, Math.max(1, o.size ?? 25));
  const pages = Math.max(1, Math.ceil(list.length / size));
  const page = Math.min(Math.max(0, o.page ?? 0), pages - 1);
  return {
    total: list.length, page, size, sum: { cy: r2(sum.cy), lyYtd: r2(sum.lyYtd) },
    rows: list.slice(page * size, page * size + size).map((i) => {
      const c = fig.get(i)!, co = b.companies[i] ?? ["", "", "", ""];
      return { id: co[1], name: nameOf(i), un: co[0], country: co[3], cy: r2(c.cy), lyYtd: r2(c.ly), articles: c.a, articlesLy: c.al };
    }),
  };
}

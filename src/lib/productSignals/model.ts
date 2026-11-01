// PRODUCTS REPORTS - WHAT A CUSTOMER WANTED IN THE SHOP AND DID NOT GET (SARCLA 01.11.2026: "articles CY/LY is ok ... but we
// should have much more, for example availability check on the shop where we didn't have stock and stuff like that - we
// should really create subtabs"; asked which: "all by sub app"). Three pages, one read:
//
//   Availability   the shelf could not serve the quantity they asked for: nothing on it, or less than asked
//   Price checks   they priced an article (a quantity typed) and left it without an order
//   Minimum order  they asked for fewer than we sell (a minimum order quantity Products & Pricing knows)
//
// All three come from the Datatracker's one scan (src/lib/integrations/shopSignals.ts): the quantity lookup the product page
// fires when a signed-in customer types a number, with the ten-digit article. The read (./read.ts) keeps the scan; the rules
// here are pure, so they are tested without HubSpot or a database:
//
//   compactSignals  the scan as small rows - one company, one article, one day each
//   kindOf          one page's rows, the companies and articles renumbered to those it names
//   the rest        what the pages count: a period and the one before it, the filters, the breakdowns, the companies

import { typedQuantity } from "../datatracker/rules";

/** The first whole day the smart bar counted (2 Oct 2026, 09:18 UTC - as the ESO Shop behaviour's LIVE_FROM); a test's
 *  lines sit on 30 Sep. Nothing earlier exists, so no page here compares with a year earlier. */
export const SIGNALS_FROM = "2026-10-02";

export type SignalKind = "availability" | "price" | "moq";
export const KINDS: SignalKind[] = ["availability", "price", "moq"];
export const isKind = (x: unknown): x is SignalKind => x === "availability" || x === "price" || x === "moq";

/** A company: [HubSpot id, name, customer number, country]. */
export type SCompany = [string, string, string, string];
export const CO = { id: 0, name: 1, un: 2, country: 3 } as const;
/** An article: [number, description, profit centre, main group, sub group, product number, product name, sales unit, minimum
 *  order quantity, stock] - as Products & Pricing gives them at the read ("" or null: it gives none). */
export type SArticle = [string, string, string, string, string, string, string, string, number | null, number | null];
export const AR = { number: 0, description: 1, pc: 2, group: 3, sub: 4, product: 5, productName: 6, unit: 7, minimum: 8, stock: 9 } as const;
/** A look - one company, one article, one day: [company, article, "YYYY-MM-DD", quantity asked (null: none typed), short by
 *  (availability; null: no quantity typed), ordered later 0|1, on a price-check ticket 0|1, nothing on the shelf 0|1]. */
export type SLook = [number, number, string, number | null, number | null, 0 | 1, 0 | 1, 0 | 1];
export const LK = { company: 0, article: 1, day: 2, qty: 3, short: 4, later: 5, ticket: 6, empty: 7 } as const;

export type SignalsNotes = {
  /** companies the scan read */
  scanned: number;
  /** the hub's kept lines merged in (the property holds a company's last 50 articles), and those left out without a company */
  kept: { merged: number; unknownCompany: number } | null;
  /** why the kept lines could not be read - the property's alone then */
  keptError: string | null;
  quantityHistoryError: string | null;
  ticketLookupError: string | null;
  /** availability: looks at an article whose stock Products & Pricing does not give - left out (unknown is not empty) */
  unknownStock: number;
  /** price checks and minimum order: looks at a bare 1, the shop's own number (rules.ts typedQuantity) - left out */
  bareOne: { price: number; moq: number };
};

export type SignalsData = {
  generatedAt: string;
  /** the first and last day read */
  from: string;
  through: string;
  companies: SCompany[];
  articles: SArticle[];
  looks: Record<SignalKind, SLook[]>;
  notes: SignalsNotes;
};
/** One page's part: its looks, and only the companies and articles they name. */
export type KindData = Omit<SignalsData, "looks"> & { kind: SignalKind; looks: SLook[] };

/* ── the scan, as rows ─────────────────────────────────────────────────── */

type FactsIn = {
  description: string | null; profitCentre: string | null; mainGroup: string | null; subGroup: string | null;
  product: string | null; productName: string | null; salesUnit: string | null; minimum: number | null; stock: number | null;
};
type CompanyIn = { companyId: string; companyName: string | null; customerNumber: string | null; country: string | null };
type LookIn = CompanyIn & {
  day: string; article: string; description: string | null; mainGroup: string | null; profitCentre: string | null;
  qty: number | null; salesUnit: string | null; moqMinimum: number | null; stock: number | null; belowMoq: boolean; shortfall: number | null;
};
type CheckIn = CompanyIn & {
  day: string; ticketId: string | null;
  articles: { article: string; description: string | null; qty: number | null; profitCentre: string | null; salesUnit: string | null; moqMinimum: number | null }[];
};
/** What compactSignals reads of the scan (ShopSignals, fetched with `facts`). */
export type SignalsIn = {
  priceChecks: CheckIn[]; moq: LookIn[]; availability: LookIn[];
  articleFacts?: Record<string, FactsIn>;
  orderedLooks?: { companyId: string; day: string; article: string }[];
  scanned: number;
  kept?: { merged: number; unknownCompany: number } | null;
  quantityHistoryError: string | null; ticketLookupError: string | null;
};

const text = (v: string | null | undefined) => (v ?? "").trim();
const fin = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function compactSignals(s: SignalsIn, o: { generatedAt: string; from: string; through: string; keptError?: string | null }): SignalsData {
  const companies: SCompany[] = [];
  const coAt = new Map<string, number>();
  const co = (c: CompanyIn) => {
    let i = coAt.get(c.companyId);
    if (i === undefined) {
      i = companies.length;
      coAt.set(c.companyId, i);
      companies.push([c.companyId, text(c.companyName) || text(c.customerNumber) || `Company ${c.companyId}`, text(c.customerNumber), text(c.country)]);
    }
    return i;
  };
  const facts = s.articleFacts ?? {};
  const articles: SArticle[] = [];
  const arAt = new Map<string, number>();
  /** an article as Products & Pricing gives it - the record's own fields when the scan came without the facts */
  const ar = (a: string, r: { description: string | null; profitCentre: string | null; mainGroup?: string | null; salesUnit: string | null; moqMinimum?: number | null; stock?: number | null }) => {
    let i = arAt.get(a);
    if (i === undefined) {
      i = articles.length;
      arAt.set(a, i);
      const f = facts[a];
      articles.push(f
        ? [a, text(f.description), text(f.profitCentre).toUpperCase(), text(f.mainGroup), text(f.subGroup), text(f.product), text(f.productName), text(f.salesUnit), fin(f.minimum), fin(f.stock)]
        : [a, text(r.description).replace(/\s+-$/, ""), text(r.profitCentre).toUpperCase(), text(r.mainGroup).replace(/\s+-$/, ""), "", "", "", text(r.salesUnit), fin(r.moqMinimum), fin(r.stock)]);
    }
    return i;
  };

  // ordered later: the same company ordered the same article on a later day - the latest day each pair was ordered
  const lastOrdered = new Map<string, string>();
  for (const x of s.orderedLooks ?? []) {
    const k = `${x.companyId}|${x.article}`;
    if ((lastOrdered.get(k) ?? "") < x.day) lastOrdered.set(k, x.day);
  }
  const later = (companyId: string, article: string, day: string): 0 | 1 => ((lastOrdered.get(`${companyId}|${article}`) ?? "") > day ? 1 : 0);

  // the shelf: nothing on it, or less than a quantity typed. The stock Products & Pricing gives now - a stock it does not
  // give is unknown, not empty (the scan's own list reads an empty property as 0, so each look is checked again here).
  const availability: SLook[] = [];
  let unknownStock = 0;
  for (const r of s.availability) {
    const stock = s.articleFacts ? fin(s.articleFacts[r.article]?.stock) : fin(r.stock);
    if (stock === null) { unknownStock++; continue; }
    const typed = typedQuantity(r.qty);
    const empty = stock <= 0;
    const short = typed && r.qty! > stock ? r.qty! - Math.max(0, stock) : null;
    if (!empty && short === null) continue;
    availability.push([co(r), ar(r.article, r), r.day, typed ? r.qty : null, short, later(r.companyId, r.article, r.day), 0, empty ? 1 : 0]);
  }

  // the minimum: a quantity typed under it - a bare 1 is the shop's own number, not theirs
  const moq: SLook[] = [];
  let bareMoq = 0;
  for (const r of s.moq) {
    if (!r.belowMoq || r.qty == null) continue;
    if (!typedQuantity(r.qty)) { bareMoq++; continue; }
    moq.push([co(r), ar(r.article, r), r.day, r.qty, null, later(r.companyId, r.article, r.day), 0, 0]);
  }

  // the price checks: an article priced (a quantity typed) and left - every profit centre, the specials too; the tickets
  // (UC17) take only KT and DT, three a day
  const price: SLook[] = [];
  let barePrice = 0;
  for (const row of s.priceChecks) {
    for (const a of row.articles) {
      if (!typedQuantity(a.qty)) { if (a.qty === 1) barePrice++; continue; }
      price.push([co(row), ar(a.article, a), row.day, a.qty, null, later(row.companyId, a.article, row.day), row.ticketId ? 1 : 0, 0]);
    }
  }

  return {
    generatedAt: o.generatedAt, from: o.from, through: o.through, companies, articles,
    looks: { availability, price, moq },
    notes: {
      scanned: s.scanned, kept: s.kept ?? null, keptError: o.keptError ?? null,
      quantityHistoryError: s.quantityHistoryError, ticketLookupError: s.ticketLookupError,
      unknownStock, bareOne: { price: barePrice, moq: bareMoq },
    },
  };
}

/** One page's looks, with only the companies and articles they name - what its address sends. */
export function kindOf(d: SignalsData, kind: SignalKind): KindData {
  const companies: SCompany[] = [], articles: SArticle[] = [];
  const coAt = new Map<number, number>(), arAt = new Map<number, number>();
  const looks = d.looks[kind].map((l): SLook => {
    let c = coAt.get(l[LK.company]);
    if (c === undefined) { c = companies.length; coAt.set(l[LK.company], c); companies.push(d.companies[l[LK.company]]); }
    let a = arAt.get(l[LK.article]);
    if (a === undefined) { a = articles.length; arAt.set(l[LK.article], a); articles.push(d.articles[l[LK.article]]); }
    return [c, a, l[2], l[3], l[4], l[5], l[6], l[7]];
  });
  return { generatedAt: d.generatedAt, from: d.from, through: d.through, notes: d.notes, kind, companies, articles, looks };
}

/* ── the days ──────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;
const at = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const addDays = (iso: string, n: number) => new Date(at(iso) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((at(b) - at(a)) / DAY_MS);
export const dayWords = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
/** "2 Oct – 1 Nov 2026", "5 – 9 Oct 2026", "1 Nov 2026" */
export function rangeWords(a: string, b: string): string {
  if (a === b) return dayWords(a);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8, 10))} – ${dayWords(b)}`;
  if (a.slice(0, 4) === b.slice(0, 4)) return `${dayWords(a).replace(/ \d{4}$/, "")} – ${dayWords(b)}`;
  return `${dayWords(a)} – ${dayWords(b)}`;
}

export type Win = { from: string; to: string };
/** The same number of days right before - null where it would reach before the first day read (nothing to compare with). */
export function prevWin(w: Win, first: string): Win | null {
  const span = daysBetween(w.from, w.to) + 1;
  const p = { from: addDays(w.from, -span), to: addDays(w.from, -1) };
  return p.from < first ? null : p;
}

export type SPeriod = { id: string; label: string; win: Win; disabled?: boolean; title?: string };
/** The quick picks and the quarters - each cut to the days read (`first` .. `through`); one wholly outside them greyed. */
export function periodsOf(first: string, through: string): { quick: SPeriod[]; quarters: SPeriod[] } {
  const clip = (w: Win): Win => ({ from: w.from < first ? first : w.from, to: w.to > through ? through : w.to });
  const off = (w: Win) => w.to < first || w.from > through;
  const monthStart = `${through.slice(0, 7)}-01`;
  const lastStart = new Date(Date.UTC(Number(through.slice(0, 4)), Number(through.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
  const lastEnd = addDays(monthStart, -1);
  const pick = (id: string, label: string, w: Win, title?: string): SPeriod => (off(w)
    ? { id, label, win: clip(w), disabled: true, title: `Before the shop's tracker started (${dayWords(first)})` }
    : { id, label, win: clip(w), ...(title ? { title } : {}) });
  const quick = [
    pick("all", `Since ${dayWords(first)}`, { from: first, to: through }, "Every day read"),
    pick("7d", "Last 7 days", { from: addDays(through, -6), to: through }),
    pick("30d", "Last 30 days", { from: addDays(through, -29), to: through }),
    pick("mtd", "This month to date", { from: monthStart, to: through }),
    pick("lm", `${MONTHS[Number(lastStart.slice(5, 7)) - 1]} ${lastStart.slice(0, 4)}`, { from: lastStart, to: lastEnd }),
  ];
  const y = Number(through.slice(0, 4));
  const quarters = [0, 1, 2, 3].flatMap((q) => {
    const from = `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`;
    const to = addDays(new Date(Date.UTC(y, q * 3 + 3, 1)).toISOString().slice(0, 10), -1);
    if (from > through) return [];
    const running = to >= through;
    return [pick(`q${q + 1}`, `Q${q + 1} ${y}${running ? " to date" : ""}`, { from, to })];
  });
  return { quick, quarters };
}
/** A period by its id ("all", "30d", "q4", "d2026-10-05_2026-10-12"), else the default: every day read. */
export function periodById(first: string, through: string, id: string | null | undefined): SPeriod {
  const { quick, quarters } = periodsOf(first, through);
  const found = [...quick, ...quarters].find((p) => p.id === id && !p.disabled);
  if (found) return found;
  const m = /^d(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(id ?? "");
  if (m && m[1] <= m[2]) {
    const from = m[1] < first ? first : m[1], to = m[2] > through ? through : m[2];
    if (from <= to) return { id: `d${from}_${to}`, label: rangeWords(from, to), win: { from, to } };
  }
  return quick[0];
}

/* ── the breakdowns and the filters ────────────────────────────────────── */

export type FDim = "article" | "pc" | "group" | "sub" | "product" | "country" | "company";
export const FDIMS: FDim[] = ["pc", "group", "sub", "product", "article", "country", "company"];
export type SFilters = Partial<Record<FDim, string[]>>;

/** A look's value on a breakdown - "" where Products & Pricing or the company gives none. */
export function keyOf(d: KindData, l: SLook, dim: FDim): string {
  const a = d.articles[l[LK.article]], c = d.companies[l[LK.company]];
  switch (dim) {
    case "article": return a[AR.number];
    case "pc": return a[AR.pc];
    case "group": return a[AR.group];
    case "sub": return a[AR.sub];
    case "product": return a[AR.product];
    case "country": return c[CO.country];
    case "company": return c[CO.id];
  }
}

/** The looks of a period under the filters - one breakdown's own filter left out when `except` names it. */
export function looksOf(d: KindData, w: Win | null, f: SFilters, except?: FDim): SLook[] {
  if (!w) return [];
  const dims = FDIMS.filter((x) => x !== except && f[x]?.length).map((x) => [x, new Set(f[x])] as const);
  return d.looks.filter((l) => l[LK.day] >= w.from && l[LK.day] <= w.to && dims.every(([x, set]) => set.has(keyOf(d, l, x))));
}

/** What a set of looks adds up to. `share`: the quantity asked as a part of the minimum (minimum order), summed and counted. */
export type SStats = {
  looks: number; companies: number; articles: number;
  /** availability: nothing on the shelf; less than asked */
  empty: number; less: number;
  later: number; ticket: number;
  /** the last day asked */
  last: string;
  shareSum: number; shareN: number;
};
export function statsOf(d: KindData, looks: SLook[]): SStats {
  const cos = new Set<number>(), arts = new Set<number>();
  const s: SStats = { looks: looks.length, companies: 0, articles: 0, empty: 0, less: 0, later: 0, ticket: 0, last: "", shareSum: 0, shareN: 0 };
  for (const l of looks) {
    cos.add(l[LK.company]);
    arts.add(l[LK.article]);
    if (l[LK.empty]) s.empty++; else if (l[LK.short] != null) s.less++;
    s.later += l[LK.later];
    s.ticket += l[LK.ticket];
    if (l[LK.day] > s.last) s.last = l[LK.day];
    const min = d.articles[l[LK.article]][AR.minimum], q = l[LK.qty];
    if (min && q != null) { s.shareSum += q / min; s.shareN++; }
  }
  s.companies = cos.size;
  s.articles = arts.size;
  return s;
}

/** The looks split by a breakdown's value. */
export function groupBy(d: KindData, looks: SLook[], dim: FDim): Map<string, SLook[]> {
  const out = new Map<string, SLook[]>();
  for (const l of looks) {
    const k = keyOf(d, l, dim);
    const arr = out.get(k);
    if (arr) arr.push(l); else out.set(k, [l]);
  }
  return out;
}

/** Per article: the largest quantity asked, the largest gap to the shelf, the smallest quantity asked - in its sales unit. */
export function articleExtremes(looks: SLook[]): { maxQty: number | null; minQty: number | null; maxShort: number | null } {
  let maxQty: number | null = null, minQty: number | null = null, maxShort: number | null = null;
  for (const l of looks) {
    const q = l[LK.qty], s = l[LK.short];
    if (q != null) { maxQty = maxQty == null || q > maxQty ? q : maxQty; minQty = minQty == null || q < minQty ? q : minQty; }
    if (s != null) maxShort = maxShort == null || s > maxShort ? s : maxShort;
  }
  return { maxQty, minQty, maxShort };
}

/** The companies behind a set of looks, the most looks first. */
export type CoLine = { co: number; stats: SStats };
export function companiesOf(d: KindData, looks: SLook[]): CoLine[] {
  const by = new Map<number, SLook[]>();
  for (const l of looks) { const arr = by.get(l[LK.company]); if (arr) arr.push(l); else by.set(l[LK.company], [l]); }
  return [...by.entries()].map(([co, ls]) => ({ co, stats: statsOf(d, ls) }))
    .sort((a, b) => b.stats.looks - a.stats.looks || b.stats.last.localeCompare(a.stats.last) || d.companies[a.co][CO.name].localeCompare(d.companies[b.co][CO.name]));
}

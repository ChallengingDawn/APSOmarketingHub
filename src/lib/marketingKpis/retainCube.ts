// RETAIN & GROW - EROSION AT STAKE (SARCLA 19.10.2026: "Retain and grow we should base on the erosion
// analysis Excel I did" - ErosionArticle-2021-2025-Over2-5k, February 2025: per customer and article the
// revenue of each year, the best year, and the gap of today against it, summed by owner). The rules, with
// no HubSpot in them (the read is retain.ts).
//
//   a line       a customer (mandant-customer number) and an article (its 10-digit number)
//   best year    its biggest invoiced revenue in one calendar year of the five before this one
//                (2021-2025 in 2026)
//   counted      the lines whose best year is EUR 2,500 or more - the Excel's "over 2.5k" (SARCLA chose 19.10)
//   now          invoiced in the last 12 months, and its open orders (SARCLA chose 19.10: like-for-like on
//                any day of the year - "this year so far" makes nearly everything look eroded in January)
//   at stake     best year less now, when now is below it; "stopped" when now is nothing at all
//   money        invoiced documents only - the .000 is the order as placed and its deliveries are invoiced,
//                counting both doubles it (the erosion tickets' rule); credit notes left out as there; a
//                line's year and its last 12 months run from its invoice (the order's date without one)
//   open orders  ordered, not invoiced yet: per order (its base number) and article, what the un-invoiced
//                documents carry less what the invoiced ones already did, never below 0 - for orders of the
//                last 24 months (an older one still open is not a customer buying now)
//   recurring    bought in two of the five years or more; a one-off is one year only - the first read
//                (19.10) found 40% of what is at stake in one-off orders (a project, a made-to-order part)
//                and half in lines last bought in 2021-2023: both shown, never hidden, so the gap reads right

import type { FixMap } from "../erosion/detector"; // relative: the unit tests compile this file

/** The Excel's "over 2.5k": a line counts when its best year reached this. */
export const FLOOR = 2500;
/** 1: the first read (19.10) */
export const RETAIN_SHAPE = 1;

export type RetainLine = {
  /** the customer, "100-703863" (mandant-customer number) */
  u: string;
  /** the article, its 10-digit number */
  a: string;
  /** invoiced revenue in each of the five years (RetainData.years), EUR */
  y: number[];
  /** invoiced in the last 12 months, EUR */
  l: number;
  /** open orders, EUR */
  o: number;
};

export type RetainData = {
  /** every line whose best year reached FLOOR - eroding or not */
  lines: RetainLine[];
  /** the five years the best one is taken from, oldest first */
  years: number[];
  /** the article's text and profit centre */
  articles: Record<string, { t: string; p: string }>;
  /** the customer: name, owner (HubSpot owner id), country, HubSpot company id */
  companies: Record<string, { n: string; o: string; k: string; id?: string }>;
  owners: Record<string, string>;
  /** the day the last 12 months end on, "2026-10-19" */
  asOf: string;
  readAt: string;
  /** order documents read, and those without a customer number (web orders the ERP has not numbered) */
  orders: number;
  noCustomer: number;
  errors: Record<string, string>;
  shape?: number;
};

/* ── the read, one order document at a time ──────────────────────────────── */

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const DAY = 86_400_000;

export type Window = { years: number[]; since12: string; openSince: string };

/** The five years before today's, the start of the last 12 months, and of the orders still counted as open. */
export function windowOf(today: string): Window {
  const y = Number(today.slice(0, 4));
  const t = Date.parse(`${today}T00:00:00Z`);
  return {
    years: [y - 5, y - 4, y - 3, y - 2, y - 1],
    since12: new Date(t - 365 * DAY).toISOString().slice(0, 10),
    openSince: new Date(t - 730 * DAY).toISOString().slice(0, 10),
  };
}

type Pos = { a: string; t: string; p: string; r: number };

/** The order's lines, Compass-internal ids repaired through the fixmap; wrong SKUs (not 10 digits) left out. */
export function positionsOf(json: unknown, fixmap: FixMap): Pos[] {
  let arr: unknown;
  try { arr = JSON.parse(s(json) || "[]"); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out: Pos[] = [];
  for (const raw of arr) {
    if (typeof raw !== "object" || raw === null) continue;
    const x = raw as Record<string, unknown>;
    let a = s(x.article || x.a).trim(), t = s(x.text || x.t).trim();
    const fix = fixmap[a];
    if (fix) { a = fix.n; t = t || fix.t || ""; }
    if (!/^\d{10}$/.test(a)) continue;
    const r = Number(x.revenue ?? x.r ?? 0);
    out.push({ a, t, p: s(x.pc || x.p).trim(), r: Number.isFinite(r) ? r : 0 });
  }
  return out;
}

export type Acc = {
  w: Window;
  lines: Map<string, { y: number[]; l: number; o: number }>;
  articles: Map<string, { t: string; p: string }>;
  /** the orders of the last 24 months: base number -> article -> [customer, ordered not invoiced, invoiced] */
  open: Map<string, Map<string, [string, number, number]>>;
  orders: number;
  noCustomer: number;
};

export const newAcc = (today: string): Acc => ({ w: windowOf(today), lines: new Map(), articles: new Map(), open: new Map(), orders: 0, noCustomer: 0 });
const key = (u: string, a: string) => `${u}\u0000${a}`;
const lineOf = (acc: Acc, u: string, a: string) => {
  let x = acc.lines.get(key(u, a));
  if (!x) { x = { y: [0, 0, 0, 0, 0], l: 0, o: 0 }; acc.lines.set(key(u, a), x); }
  return x;
};

/** One order document into the sums. */
export function addOrder(acc: Acc, p: Record<string, unknown>, fixmap: FixMap): void {
  acc.orders += 1;
  if (s(p.order_order_type) === "Credit note" || s(p.order_order_status).toLowerCase() === "credit_note") return;
  const mand = s(p.order_mandant).trim(), cust = s(p.order_customer_number).trim();
  if (!mand || !cust) { acc.noCustomer += 1; return; }
  const u = `${mand}-${cust}`;
  const status = s(p.order_order_status).trim().toLowerCase();
  const inv = s(p.order_invoice_date).slice(0, 10), ordered = s(p.order_order_date).slice(0, 10);
  const invoiced = status === "invoiced" || inv.length > 0;
  const day = inv || ordered;
  const yi = acc.w.years.indexOf(Number(day.slice(0, 4)));
  const base = s(p.order_order_number).trim().replace(/\.\d{3}$/, "");
  const recent = !!base && ordered >= acc.w.openSince;
  for (const x of positionsOf(p.order_positions_json, fixmap)) {
    const art = acc.articles.get(x.a);
    if (!art) acc.articles.set(x.a, { t: x.t, p: x.p });
    else { if (!art.t && x.t) art.t = x.t; if (!art.p && x.p) art.p = x.p; }
    if (invoiced) {
      if (yi >= 0) lineOf(acc, u, x.a).y[yi] += x.r;
      if (day > acc.w.since12) lineOf(acc, u, x.a).l += x.r;
    }
    if (recent) {
      let m = acc.open.get(base);
      if (!m) { m = new Map(); acc.open.set(base, m); }
      const e = m.get(x.a) ?? [u, 0, 0];
      if (invoiced) e[2] += x.r; else e[1] += x.r;
      m.set(x.a, e);
    }
  }
}

/** The open orders added to their lines; the lines whose best year reached FLOOR. */
export function finish(acc: Acc): RetainLine[] {
  for (const m of acc.open.values()) {
    for (const [a, [u, placed, done]] of m) {
      const left = placed - done;
      if (left > 0.005) lineOf(acc, u, a).o += left;
    }
  }
  const out: RetainLine[] = [];
  for (const [k, x] of acc.lines) {
    if (Math.max(...x.y) < FLOOR) continue;
    const [u, a] = k.split("\u0000");
    out.push({ u, a, y: x.y.map((v) => Math.round(v * 100) / 100), l: Math.round(x.l * 100) / 100, o: Math.round(x.o * 100) / 100 });
  }
  return out;
}

/* ── the figures ─────────────────────────────────────────────────────────── */

export type LineView = RetainLine & { best: number; bestYear: number; now: number; gap: number; stopped: boolean; recurring: boolean; lastYear: number | null };

/** A line's best year, now, and what is at stake. */
export function viewOf(line: RetainLine, years: number[]): LineView {
  let bi = 0;
  for (let i = 1; i < line.y.length; i++) if (line.y[i] > line.y[bi]) bi = i;
  const best = line.y[bi], now = line.l + line.o;
  let last: number | null = null;
  line.y.forEach((v, i) => { if (v > 0) last = years[i]; });
  return { ...line, best, bestYear: years[bi], now, gap: Math.max(0, best - now), stopped: now <= 0, recurring: line.y.filter((v) => v > 0).length >= 2, lastYear: last };
}

export type RFilters = { owner?: string[]; country?: string[]; pc?: string[]; state?: string[]; kind?: string[] };
export const STATES = [{ id: "stopped", label: "Stopped buying" }, { id: "less", label: "Buying less" }] as const;
export const KINDS = [{ id: "recurring", label: "Recurring", note: "bought in two of the five years or more" }, { id: "oneoff", label: "One-off", note: "bought in one year only" }] as const;

const ownerOf = (d: RetainData, u: string) => d.companies[u]?.o ?? "";
const countryOf = (d: RetainData, u: string) => d.companies[u]?.k || "Unknown";
const pcOf = (d: RetainData, a: string) => d.articles[a]?.p || "Unknown";

/** The eroding lines (now below the best year) the filters keep, the most at stake first. */
export function eroding(d: RetainData, f: RFilters): LineView[] {
  const out: LineView[] = [];
  for (const line of d.lines) {
    if (f.owner?.length && !f.owner.includes(ownerOf(d, line.u))) continue;
    if (f.country?.length && !f.country.includes(countryOf(d, line.u))) continue;
    if (f.pc?.length && !f.pc.includes(pcOf(d, line.a))) continue;
    const v = viewOf(line, d.years);
    if (v.gap <= 0) continue;
    if (f.state?.length && !f.state.includes(v.stopped ? "stopped" : "less")) continue;
    if (f.kind?.length && !f.kind.includes(v.recurring ? "recurring" : "oneoff")) continue;
    out.push(v);
  }
  return out.sort((a, b) => b.gap - a.gap);
}

export type Totals = { gap: number; best: number; now: number; lines: number; customers: number; stoppedGap: number; stoppedLines: number };
export function totalsOf(lines: LineView[]): Totals {
  const t: Totals = { gap: 0, best: 0, now: 0, lines: 0, customers: 0, stoppedGap: 0, stoppedLines: 0 };
  const cust = new Set<string>();
  for (const v of lines) {
    t.gap += v.gap; t.best += v.best; t.now += v.now; t.lines += 1; cust.add(v.u);
    if (v.stopped) { t.stoppedGap += v.gap; t.stoppedLines += 1; }
  }
  t.customers = cust.size;
  return t;
}

/** The same, by a key - owner, customer, profit centre, country - the most at stake first. */
export function totalsBy(lines: LineView[], keyOf: (v: LineView) => string): [string, Totals][] {
  const by = new Map<string, LineView[]>();
  for (const v of lines) { const k = keyOf(v); by.set(k, [...(by.get(k) ?? []), v]); }
  return [...by.entries()].map(([k, vs]) => [k, totalsOf(vs)] as [string, Totals]).sort((a, b) => b[1].gap - a[1].gap);
}

export const keyOwner = (d: RetainData) => (v: LineView) => ownerOf(d, v.u);
export const keyCountry = (d: RetainData) => (v: LineView) => countryOf(d, v.u);
export const keyPc = (d: RetainData) => (v: LineView) => pcOf(d, v.a);
export const keyCustomer = () => (v: LineView) => v.u;
/** When the line was last bought: in the last 12 months, or its last year with revenue. */
export const keyLast = () => (v: LineView) => (v.l > 0 ? "In the last 12 months" : v.lastYear ? `Last bought in ${v.lastYear}` : "Only open orders");

/* ── the rework (SARCLA 20.10.2026: "the graphs are bad, the design and the logic - look at the erosion Excel") ──
   He chose: the headline counts the lines still bought less, or stopped recently - articles bought in two years
   or more; made-to-order (800x) apart; what was done about it from the erosion tickets; the Excel's pivot
   (owner > customer > article) as the page, one split graph above it. */

/** What a line is: still bought less, stopped recently, lost before, one year only, or made to order. */
export type Kind = "less" | "stopped" | "gone" | "oneoff" | "made";
export const HEADLINE: Kind[] = ["less", "stopped"];
export const kindInfo = (years: number[]): { id: Kind; label: string; note: string }[] => [
  { id: "less", label: "Still buying, less", note: "bought in the last 12 months or on order, below its best year" },
  { id: "stopped", label: "Stopped recently", note: `bought in ${years[years.length - 2]} or ${years[years.length - 1]}, nothing in the last 12 months and no open order` },
  { id: "gone", label: "Lost before", note: `last bought in ${years[years.length - 3]} or before - lost then, not eroding now` },
  { id: "oneoff", label: "One year only", note: "bought in one of the five years - an order, not a habit" },
  { id: "made", label: "Made to order", note: "an 800x article - cut pieces, special O-rings: a project more than a repeat" },
];
/** A made-to-order article: its number starts with 800 (8001... - DirectCut's cuts, special O-rings). */
export const isMade = (a: string) => a.startsWith("800");

export function kindOf(v: LineView): Kind {
  if (isMade(v.a)) return "made";
  if (v.now > 0) return "less";
  if (v.y.filter((x) => x > 0).length <= 1) return "oneoff";
  const n = v.y.length;
  return v.y[n - 1] > 0 || v.y[n - 2] > 0 ? "stopped" : "gone";
}

/** An erosion ticket as the page shows it: the customer, its articles, when, and what came of it. */
export type RetainAction = { id: string; un: string; articles: string[]; created: string; closed: string | null; result: string; won: boolean; open: boolean; owner: string };

export type Sums = { gap: number; best: number; last: number; now: number; lines: number; customers: number; less: number; stopped: number };
const sumsOf = (vs: LineView[], lastIdx: number): Sums => {
  const t: Sums = { gap: 0, best: 0, last: 0, now: 0, lines: 0, customers: 0, less: 0, stopped: 0 };
  const cust = new Set<string>();
  for (const v of vs) {
    t.gap += v.gap; t.best += v.best; t.last += v.y[lastIdx] ?? 0; t.now += v.now; t.lines += 1; cust.add(v.u);
    const k = kindOf(v);
    if (k === "less") t.less += v.gap; else if (k === "stopped") t.stopped += v.gap;
  }
  t.customers = cust.size;
  return t;
};

export type PivotCustomer = { u: string; sums: Sums; lines: (LineView & { kind: Kind })[] };
export type PivotOwner = { owner: string; sums: Sums; customers: PivotCustomer[] };
/**
 * The Excel's pivot (SummaryView: Resp. action > customer > article): the lines of the kinds chosen that the
 * filters keep, by the customer's owner today, then the customer, then the article - the most at stake first.
 */
export function pivot(d: RetainData, f: RFilters & { kinds?: Kind[] }): PivotOwner[] {
  const kinds = new Set(f.kinds?.length ? f.kinds : HEADLINE);
  const lastIdx = d.years.length - 1;
  const byOwner = new Map<string, Map<string, (LineView & { kind: Kind })[]>>();
  for (const line of d.lines) {
    if (f.owner?.length && !f.owner.includes(ownerOf(d, line.u))) continue;
    if (f.country?.length && !f.country.includes(countryOf(d, line.u))) continue;
    if (f.pc?.length && !f.pc.includes(pcOf(d, line.a))) continue;
    const v = viewOf(line, d.years);
    if (v.gap <= 0) continue;
    const kind = kindOf(v);
    if (!kinds.has(kind)) continue;
    const o = ownerOf(d, line.u);
    const m = byOwner.get(o) ?? new Map();
    byOwner.set(o, m);
    m.set(line.u, [...(m.get(line.u) ?? []), { ...v, kind }]);
  }
  const out: PivotOwner[] = [];
  for (const [owner, m] of byOwner) {
    const customers = [...m.entries()].map(([u, ls]) => ({ u, sums: sumsOf(ls, lastIdx), lines: ls.sort((a, b) => b.gap - a.gap) })).sort((a, b) => b.sums.gap - a.sums.gap);
    out.push({ owner, sums: sumsOf(customers.flatMap((c) => c.lines), lastIdx), customers });
  }
  return out.sort((a, b) => b.sums.gap - a.sums.gap);
}

/** Every kind's at stake over the filters (not the kind choice) - the headline and what is shown apart. */
export function byKind(d: RetainData, f: RFilters): Record<Kind, { gap: number; lines: number; customers: number }> {
  const out = Object.fromEntries((["less", "stopped", "gone", "oneoff", "made"] as Kind[]).map((k) => [k, { gap: 0, lines: 0, customers: new Set<string>() }])) as Record<Kind, { gap: number; lines: number; customers: Set<string> }>;
  for (const v of eroding(d, f)) { const o = out[kindOf(v)]; o.gap += v.gap; o.lines += 1; o.customers.add(v.u); }
  return Object.fromEntries(Object.entries(out).map(([k, o]) => [k, { gap: o.gap, lines: o.lines, customers: o.customers.size }])) as Record<Kind, { gap: number; lines: number; customers: number }>;
}

/** The erosion tickets of a customer - and of one of its articles. */
export const actionsOf = (actions: RetainAction[], u: string, a?: string) => actions.filter((x) => x.un === u && (!a || x.articles.includes(a)));

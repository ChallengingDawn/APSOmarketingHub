// THE ESO SHOP BEHAVIOUR PAGE'S RULES (SARCLA 29.10.2026: "rebuild like Figures/Visits" - his picks: logins, views and
// logged in & bought; the smart bar's live counters since 2 Oct with the Performis years beside them; bought = ordered in
// the shop). Every company the shop counted as small rows - one per company and day (live), one per company and year (the
// Performis export) - so the page works out any period, team, person or filter itself. No HubSpot or database here, so
// the page and the tests read it as it is.
//
// Two sources, never on one chart: a period is either live (the smart bar's day counters, kept in the hub since they
// started on 2 Oct 2026) or a Performis year (the desktop E-Shop Data Tracker's export, loaded into HubSpot by hand - the
// last one on 15 Apr 2026, so 2026 stops there).
//
// The second pass (SARCLA 30.10.2026, his spec: "Logins: per customer category; # without a view or shopping cart.
// Views: per assortment; conversion rate per assortment. Orders: general & per assortment: # all, # one shots,
// # second, # multiple" - "you're missing tabs"; his picks: assortment = the profit centre, orders = shop orders):
// the articles each company looked at, by profit centre (live only - the hub keeps them since October), and every shop
// order since January of last year with the profit centres of its lines.
//
// Third pass (SARCLA 31.10.2026: "why 4 weeks - put like the other year to date and allow filtering like the others";
// "on view we should have the top product as well, include product hierarchy"; "we should not have Not assigned"): the
// periods as the other ESO pages - the year to date first, against the same days a year earlier - and the articles looked
// at by their product, its main group and sub group, besides the profit centre.

export type ShopData = {
  generatedAt: string;
  /** the read's day, "2026-10-29" - the running day counts to date */
  today: string;
  /** the first day the live counters count, "2026-10-02" */
  liveFrom: string;
  /** the Performis export's years, oldest first */
  dtYears: number[];
  /** the day the last export was loaded into HubSpot (its newest year stops there); null when not known */
  dtLoaded: string | null;
  /** the company owners, by index - their team from the rosters, else their HubSpot team */
  people: { id: string; name: string; team: string }[];
  /** pc: the profit centres - DT, KT, FT, ST, AT ... and "Not assigned"; group, sub: Products & Pricing's main and sub groups */
  labels: { prio: string[]; category: string[]; country: string[]; pc: string[]; group: string[]; sub: string[] };
  /** the products looked at - see P */
  products: [string, string, number, number, number][];
  /** per company index - see C */
  companies: number[][];
  /** live: one row per company and day - see D */
  days: number[][];
  /** Performis: one row per company and year - see Y */
  years: number[][];
  /** live: the articles looked at, one row per company, day and product - see L */
  looks: number[][];
  /** one row per shop order - see O; empty until the orders are read */
  orders: number[][];
  /** the first day the shop orders are read from ("2025-01-01"); null while they are still being read */
  ordersFrom: string | null;
  coverage: { companies: number; live: number; performis: number; internal: number };
};
/** A company row: its owner (person index), priority, customer category, country (label indexes). */
export const C = { person: 0, prio: 1, category: 2, country: 3 } as const;
/** A live row: the company, the day (0 = liveFrom), logins, article views, articles ordered in the shop, articles put in
 *  the cart. */
export const D = { company: 0, day: 1, logins: 2, views: 3, orders: 4, carts: 5 } as const;
/** A look row: the company, the day (0 = liveFrom), the product (index into products), the articles of it the company
 *  looked at that day (an article once a day), of them put in the cart, of them ordered. */
export const L = { company: 0, day: 1, product: 2, looks: 3, carted: 4, ordered: 5 } as const;
/** A product: its number, its name, its profit centre, main group and sub group (indexes into labels.pc / group / sub).
 *  The articles Products & Pricing does not know share one product, "Not assigned". */
export const P = { number: 0, name: 1, pc: 2, group: 3, sub: 4 } as const;
/** An order row: the company, the day it was placed (0 = liveFrom - earlier days below 0), its lines' profit centres as
 *  bits (bit i = labels.pc[i]). */
export const O = { company: 0, day: 1, pcs: 2 } as const;
/** A Performis row: the company, the year (index into dtYears), logins, article views, shop orders. */
export const Y = { company: 0, year: 1, logins: 2, views: 3, orders: 4 } as const;

const DAY_MS = 86_400_000;
const at = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
/** "2026-10-05" against "2026-10-02" -> 3 */
export const dayNo = (from: string, day: string) => Math.round((at(day) - at(from)) / DAY_MS);
/** 3 against "2026-10-02" -> "2026-10-05" */
export const dayOf = (from: string, n: number) => new Date(at(from) + n * DAY_MS).toISOString().slice(0, 10);

/** A period: live days (0 = liveFrom, both ends counted) or a Performis year (index into dtYears). */
export type SWin = { kind: "live"; from: number; to: number } | { kind: "year"; y: number };
export type SDim = "person" | "prio" | "category" | "country";
/** What an article looked at or an order is filtered by - its profit centre, main group, sub group (Views and Orders). */
export type LDim = "pc" | "group" | "sub";
export type SFilters = Partial<Record<SDim | LDim, string[]>>;
const COMPANY_DIMS: readonly SDim[] = ["person", "prio", "category", "country"];

/* ── the periods ───────────────────────────────────────────────────────── */

export type SPer = {
  id: string;
  /** the chip's words: "Last 7 days", "October 2026", "2025" */
  label: string;
  /** in a sentence: "the last 7 days", "October 2026" */
  title: string;
  win: SWin;
  /** the period it is compared with - the same length right before it; null when the counters do not reach that far
   *  back, or for a part of a year (the export's newest) */
  prev: SWin | null;
  /** a year the export stops inside of */
  partial?: boolean;
  /** a range of the reader's own days, picked in the calendar - its words are its days ("5 – 20 Oct 2026") */
  custom?: boolean;
};
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-04-15" -> "15 Apr 2026" */
export const dayWords = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const live = (from: number, to: number): SWin => ({ kind: "live", from, to });
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).toISOString().slice(0, 10);
const prevMonth = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);

/** A day a year earlier (29 Feb: 28 Feb). */
const yearBack = (iso: string) => { const y = Number(iso.slice(0, 4)) - 1; return iso.slice(5) === "02-29" ? `${y}-02-28` : `${y}${iso.slice(4)}`; };
const monthName = (iso: string) => `${MONTHS_FULL[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** The periods the Filters offer as quick picks, as the other ESO pages: the year to date (the default), the month to date,
 *  last month - each against the same days a year earlier; the last 7 days and 4 weeks (whole days, to yesterday) against
 *  the days right before; then the Performis years, newest first. The quarters and one's own days are quarterPicks and
 *  rangeOf. A period may begin before the live counters did: logins and views count from their first day, the shop
 *  orders from the first day read - each compared only where its data reaches (prevOf). */
export function presetsOf(d: ShopData): SPer[] {
  const t = dayNo(d.liveFrom, d.today);
  const Y = Number(d.today.slice(0, 4));
  const span = (a: string, b: string): SWin => live(dayNo(d.liveFrom, a), dayNo(d.liveFrom, b));
  const out: SPer[] = [];
  const add = (id: string, label: string, title: string, a: string, b: string) => out.push({ id, label, title, win: span(a, b), prev: span(yearBack(a), yearBack(b)) });
  add("ytd", "Year to date", "year to date", `${Y}-01-01`, d.today);
  add("mtd", "Month to date", "month to date", monthStart(d.today), d.today);
  if (d.today.slice(5, 7) !== "01") { const pm = prevMonth(d.today); add("lm", monthName(pm), monthName(pm), pm, monthEnd(pm)); }
  const back = (n: number, id: string, label: string, title: string) => out.push({ id, label, title, win: live(t - n, t - 1), prev: live(t - 2 * n, t - n - 1) });
  back(7, "7d", "Last 7 days", "the last 7 days");
  back(28, "28d", "Last 4 weeks", "the last 4 weeks");
  // the Performis years: a whole year against the one before; the year the export stops inside of on its own
  for (let y = d.dtYears.length - 1; y >= 0; y--) {
    const year = d.dtYears[y];
    const partial = !!d.dtLoaded && Number(d.dtLoaded.slice(0, 4)) === year;
    const name = partial ? `${year} to ${dayWords(d.dtLoaded!).replace(/ \d{4}$/, "")}` : String(year);
    out.push({ id: `y${year}`, label: name, title: partial ? `${year} until the export of ${dayWords(d.dtLoaded!)}` : String(year), win: { kind: "year", y },
      prev: !partial && y > 0 ? { kind: "year", y: y - 1 } : null, ...(partial ? { partial } : {}) });
  }
  return out;
}
/** The period before, where its data reaches: the live counters from their first day; the shop orders from the first day
 *  read; a Performis year as it is. Null: nothing to compare with. */
export function prevOf(d: ShopData, p: SPer, what: "live" | "orders"): SWin | null {
  const w = p.prev;
  if (!w) return null;
  if (what === "orders") return ordersCover(d, w) ? w : null;
  return w.kind === "year" || w.from >= 0 ? w : null;
}
/** Whether a period begins before the live counters did - logins and views then count from their first day. */
export const beforeCounters = (d: ShopData, w: SWin) => w.kind === "live" && w.from < 0;

/** The days a live period spans, or 0 for a year. */
export const spanOf = (w: SWin) => (w.kind === "live" ? w.to - w.from + 1 : 0);

/** "2026-10-05", "2026-10-20" -> "5 – 20 Oct 2026"; "28 Sep – 4 Oct 2026"; "30 Dec 2026 – 3 Jan 2027"; a single day as it is */
export function rangeWords(a: string, b: string): string {
  if (a === b) return dayWords(a);
  const sameYear = a.slice(0, 4) === b.slice(0, 4), sameMonth = sameYear && a.slice(5, 7) === b.slice(5, 7);
  const left = sameMonth ? String(Number(a.slice(8, 10))) : sameYear ? dayWords(a).replace(/ \d{4}$/, "") : dayWords(a);
  return `${left} – ${dayWords(b)}`;
}

/* ── the quarters and the reader's own days ────────────────────────────── */
// SARCLA 31.10.2026, across the ESO reports: "put every quarter to be easy to select, and really custom dates with a mini
// calendar" - his pick: a calendar of days where the page's data has the day. The live counters have it, since liveFrom;
// the Performis export has whole years only, so it gets neither.

/** Whether two periods are the same days (or the same Performis year): in October the quarter to date is the month to date. */
export const sameWin = (a: SWin, b: SWin) => (a.kind === "live" && b.kind === "live" ? a.from === b.from && a.to === b.to : a.kind === "year" && b.kind === "year" && a.y === b.y);

/** "2027-01-01" for (2027, 0, 1); a month past either end rolls into the next or last year, day 0 is the month before's last */
const utcDay = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);

export type SQuarter = {
  /** "q2026-4" */
  id: string;
  /** "Q4 2026 to date", "Q1 2027" */
  label: string;
  /** the period - null when the counters cannot show it */
  per: SPer | null;
  /** why not: the counters started after it ended ("early" - Q1 to Q3 2026), or it has not started ("ahead") */
  off?: "early" | "ahead";
};
/** Every quarter of the years the live counters have run in, oldest first - one the counters cannot show greyed with its
 *  reason, never left out (Q1 to Q3 2026: no live counters before 2 Oct 2026). One they count is a period from liveFrom at the
 *  earliest, the running one "to date" with today counted (as the month to date); a whole quarter against the quarter
 *  before, the running one against the same days of it - only where the counters have the quarter before whole (as the
 *  months: Q4 2026 lacks 1 Oct, so Q1 2027 has nothing to compare with). */
export function quarterPicks(d: ShopData): SQuarter[] {
  const t = dayNo(d.liveFrom, d.today);
  const out: SQuarter[] = [];
  for (let y = Number(d.liveFrom.slice(0, 4)); y <= Number(d.today.slice(0, 4)); y++) {
    for (let q = 0; q < 4; q++) {
      const start = utcDay(y, q * 3, 1), end = utcDay(y, q * 3 + 3, 0);
      const id = `q${y}-${q + 1}`, name = `Q${q + 1} ${y}`;
      if (end < d.liveFrom) { out.push({ id, label: name, per: null, off: "early" }); continue; }
      if (start > d.today || t < 0) { out.push({ id, label: name, per: null, off: "ahead" }); continue; }
      const running = end >= d.today;
      const from = Math.max(0, dayNo(d.liveFrom, start)), to = running ? t : dayNo(d.liveFrom, end);
      const pFrom = dayNo(d.liveFrom, utcDay(y, q * 3 - 3, 1)), pEnd = dayNo(d.liveFrom, utcDay(y, q * 3, 0));
      const label = running ? `${name} to date` : name;
      out.push({ id, label, per: { id, label, title: label, win: live(from, to), prev: pFrom < 0 ? null : live(pFrom, running ? Math.min(pFrom + (to - from), pEnd) : pEnd) } });
    }
  }
  return out;
}

const RANGE = /^d(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/;
/** A range of one's own days as a period id, both days counted: "d2026-10-05_2026-10-20". */
export const rangeId = (from: string, to: string) => `d${from}_${to}`;
/** A range of one's own days from its id, in either order and cut to the live counters (liveFrom to today - a day before
 *  them has no counter); against the same number of days right before it, once the counters reach back that far. Null for
 *  an id that is no range, a day that is none ("2026-02-31"), or a range wholly outside the counters. */
export function rangeOf(d: ShopData, id: string): SPer | null {
  const m = RANGE.exec(id);
  if (!m) return null;
  const real = (s: string) => Number.isFinite(at(s)) && dayOf(s, 0) === s;
  if (!real(m[1]) || !real(m[2])) return null;
  let a = dayNo(d.liveFrom, m[1]), b = dayNo(d.liveFrom, m[2]);
  if (a > b) [a, b] = [b, a];
  a = Math.max(0, a); b = Math.min(dayNo(d.liveFrom, d.today), b);
  if (b < a) return null;
  const n = b - a + 1, from = dayOf(d.liveFrom, a), to = dayOf(d.liveFrom, b), words = rangeWords(from, to);
  return { id: rangeId(from, to), label: words, title: words, win: live(a, b), prev: a - n >= 0 ? live(a - n, a - 1) : null, custom: true };
}
/** A period by its id - a preset, a quarter or one's own days; null when it is none of them, or no longer offered. */
export function periodOf(d: ShopData, id: string | null | undefined): SPer | null {
  if (!id) return null;
  return presetsOf(d).find((p) => p.id === id) ?? quarterPicks(d).find((q) => q.id === id)?.per ?? rangeOf(d, id);
}
/** The period for the days picked in the calendar: the named one when it is those very days (the last 7 days, a month, a
 *  quarter - it keeps its own comparison and target, and its pick lights), else the days as they are; null when the
 *  counters have none of them. */
export function periodFor(d: ShopData, from: string, to: string): string | null {
  const own = rangeOf(d, rangeId(from, to));
  if (!own) return null;
  const named = [...presetsOf(d), ...quarterPicks(d).flatMap((q) => (q.per ? [q.per] : []))].find((p) => sameWin(p.win, own.win));
  return named?.id ?? own.id;
}

/* ── the figures ───────────────────────────────────────────────────────── */

export type Totals = Map<number, [number, number, number, number]>;
/** Each company's logins, article views, shop orders and cart additions over a period - companies without any left out.
 *  The export has no carts (0). */
export function totalsOf(d: ShopData, w: SWin): Totals {
  const out: Totals = new Map();
  const add = (co: number, l: number, v: number, o: number, c: number) => {
    if (!l && !v && !o && !c) return;
    const t = out.get(co);
    if (t) { t[0] += l; t[1] += v; t[2] += o; t[3] += c; } else out.set(co, [l, v, o, c]);
  };
  if (w.kind === "live") { for (const r of d.days) if (r[D.day] >= w.from && r[D.day] <= w.to) add(r[D.company], r[D.logins], r[D.views], r[D.orders], r[D.carts] ?? 0); }
  else for (const r of d.years) if (r[Y.year] === w.y) add(r[Y.company], r[Y.logins], r[Y.views], r[Y.orders], 0);
  return out;
}

/** A company's value on a breakdown, as its label. */
export function labelOf(d: ShopData, co: number, dim: SDim): string {
  const c = d.companies[co];
  if (!c) return "Not set";
  if (dim === "person") return d.people[c[C.person]]?.name ?? "No owner";
  return d.labels[dim][c[C[dim]]] ?? "Not set";
}

/** Whether a company is shown: its owner among the people, and every filter but a breakdown's own (as the cube). */
export function passOf(d: ShopData, f: SFilters, people: Set<number> | null, except?: SDim): (co: number) => boolean {
  const sets = COMPANY_DIMS.filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  return (co) => {
    const c = d.companies[co];
    if (!c || (people && !people.has(c[C.person]))) return false;
    return sets.every(([k, s]) => s.has(labelOf(d, co, k)));
  };
}

export type SStats = {
  /** companies that logged in */
  companies: number;
  logins: number; views: number;
  /** of the companies that logged in: those that also ordered in the shop, and those that neither opened an article nor
   *  put one in the cart (a Performis year: opened no article - the export has no carts) */
  ordered: number; idle: number;
};
export const blank = (): SStats => ({ companies: 0, logins: 0, views: 0, ordered: 0, idle: 0 });

/** The figures of a period's companies, grouped by a label (all together under ""). A company counts when it logged in
 *  in the period, with its views and shop orders; one with views or orders but no login recorded (a tab left open since
 *  the day before) is left out of every figure, so the shares stay over the same companies. */
export function statsBy(d: ShopData, totals: Totals, pass: (co: number) => boolean, key: (co: number) => string = () => ""): Map<string, SStats> {
  const out = new Map<string, SStats>();
  for (const [co, [l, v, o, c]] of totals) {
    if (l <= 0 || !pass(co)) continue;
    const k = key(co);
    let s = out.get(k);
    if (!s) { s = blank(); out.set(k, s); }
    s.companies++;
    s.logins += l;
    s.views += v;
    if (o > 0) s.ordered++;
    if (v <= 0 && c <= 0) s.idle++;
  }
  return out;
}

/* ── the series: a live period day by day (month by month past two months), the Performis years ── */

export type Series = {
  /** "2026-10-05" (a day) or "2026-10" (a month), or "2025" (a year) */
  keys: string[];
  /** companies that logged in, their logins and article views, and those of them that ordered in the shop */
  companies: number[]; logins: number[]; views: number[]; ordered: number[];
};
const emptySeries = (keys: string[]): Series => ({ keys, companies: keys.map(() => 0), logins: keys.map(() => 0), views: keys.map(() => 0), ordered: keys.map(() => 0) });

/** A live period, bucketed by day - by month when it spans more than 62 days. A company counts once a bucket. */
export function liveSeries(d: ShopData, w: Extract<SWin, { kind: "live" }>, pass: (co: number) => boolean): Series {
  const byMonth = spanOf(w) > 62;
  const keyOf = (n: number) => (byMonth ? dayOf(d.liveFrom, n).slice(0, 7) : dayOf(d.liveFrom, n));
  const keys: string[] = [];
  for (let n = w.from; n <= w.to; n++) { const k = keyOf(n); if (keys[keys.length - 1] !== k) keys.push(k); }
  const s = emptySeries(keys);
  const ix = new Map(keys.map((k, i) => [k, i]));
  const per = new Map<string, [number, number, number]>();
  for (const r of d.days) {
    const n = r[D.day];
    if (n < w.from || n > w.to || !pass(r[D.company])) continue;
    const k = `${ix.get(keyOf(n))}|${r[D.company]}`;
    const t = per.get(k);
    if (t) { t[0] += r[D.logins]; t[1] += r[D.views]; t[2] += r[D.orders]; } else per.set(k, [r[D.logins], r[D.views], r[D.orders]]);
  }
  for (const [k, [l, v, o]] of per) {
    if (l <= 0) continue;
    const i = Number(k.slice(0, k.indexOf("|")));
    s.companies[i]++; s.logins[i] += l; s.views[i] += v; if (o > 0) s.ordered[i]++;
  }
  return s;
}

/** The weekdays of a day-by-day series that fall far below the others - under half the median weekday: a gap in the
 *  recording or a holiday, to be marked before anyone reads a change into it (2 Oct 2026, counted from 09:18 only;
 *  22 Oct 2026, 165 companies against some 600). Needs five weekdays to tell; weekends are always low and never marked, nor
 *  the running day (today counts so far). */
export function shortDays(s: Series, today = ""): Set<string> {
  const week = s.keys.flatMap((k, i) => (/^\d{4}-\d{2}-\d{2}$/.test(k) && k !== today && ![0, 6].includes(new Date(`${k}T00:00:00Z`).getUTCDay()) ? [[k, s.companies[i]] as const] : []));
  if (week.length < 5) return new Set();
  const sorted = week.map(([, v]) => v).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return new Set(week.filter(([, v]) => v < median / 2).map(([k]) => k));
}

/** Every Performis year, oldest first. */
export function yearSeries(d: ShopData, pass: (co: number) => boolean): Series {
  const s = emptySeries(d.dtYears.map(String));
  for (let y = 0; y < d.dtYears.length; y++) {
    const t = statsBy(d, totalsOf(d, { kind: "year", y }), pass).get("") ?? blank();
    s.companies[y] = t.companies; s.logins[y] = t.logins; s.views[y] = t.views; s.ordered[y] = t.ordered;
  }
  return s;
}

/* ── the period's days, for the shop orders (a Performis year as its calendar days) ── */

/** The days a period spans (0 = liveFrom): a live period's own, a Performis year's calendar days - to the export's day for
 *  the year it stops in, as the period says. */
export function dayRange(d: ShopData, w: SWin): [number, number] {
  if (w.kind === "live") return [w.from, w.to];
  const y = d.dtYears[w.y];
  const end = d.dtLoaded && Number(d.dtLoaded.slice(0, 4)) === y ? d.dtLoaded : `${y}-12-31`;
  return [dayNo(d.liveFrom, `${y}-01-01`), dayNo(d.liveFrom, end)];
}
/** Whether the shop orders read reach the whole period. */
export const ordersCover = (d: ShopData, w: SWin) => !!d.ordersFrom && dayRange(d, w)[0] >= dayNo(d.liveFrom, d.ordersFrom);

/* ── the views by profit centre (live only) ────────────────────────────── */

export type AStats = {
  /** articles looked at (an article once a company and day), of them put in the cart, of them ordered */
  looks: number; carted: number; ordered: number;
  /** companies that looked at one */
  companies: number;
};
/** A product's label on a line breakdown: its profit centre, main group or sub group. */
export function lineLabel(d: ShopData, prod: number, dim: LDim): string {
  const x = d.products[prod];
  if (!x) return "Not assigned";
  return (dim === "pc" ? d.labels.pc[x[P.pc]] : dim === "group" ? d.labels.group[x[P.group]] : d.labels.sub[x[P.sub]]) ?? "Not assigned";
}
/** Whether a product is shown under the line filters - a breakdown's own left out, as the company filters. */
export function lineOf(d: ShopData, f: SFilters, except?: LDim): (prod: number) => boolean {
  const sets = (["pc", "group", "sub"] as const).filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  return (prod) => sets.every(([k, set]) => set.has(lineLabel(d, prod, k)));
}
/** The profit-centre bits an order must have one of under the filters (all bits: no profit centre chosen). */
export const pcMask = (d: ShopData, f: SFilters) => (f.pc?.length ? d.labels.pc.reduce((m, pc, i) => (f.pc!.includes(pc) ? m | (1 << i) : m), 0) : -1);

/** A live period's looks by profit centre - or by any label of the company or the product (key) - under the team and filters. */
export function looksBy(d: ShopData, w: SWin, pass: (co: number) => boolean, key: (co: number, prod: number) => string = (_c, prod) => lineLabel(d, prod, "pc"), lines: (prod: number) => boolean = () => true): Map<string, AStats> {
  const out = new Map<string, AStats>();
  if (w.kind !== "live") return out;
  const seen = new Map<string, Set<number>>();
  for (const r of d.looks) {
    if (r[L.day] < w.from || r[L.day] > w.to || !lines(r[L.product]) || !pass(r[L.company])) continue;
    const k = key(r[L.company], r[L.product]);
    let s = out.get(k);
    if (!s) { s = { looks: 0, carted: 0, ordered: 0, companies: 0 }; out.set(k, s); seen.set(k, new Set()); }
    s.looks += r[L.looks]; s.carted += r[L.carted]; s.ordered += r[L.ordered];
    const set = seen.get(k)!;
    if (!set.has(r[L.company])) { set.add(r[L.company]); s.companies++; }
  }
  return out;
}

/* ── the shop orders: all, and the buyers as one-shots, second and multiple ── */

export type OStats = {
  /** shop orders placed in the period, and the companies that placed them */
  orders: number; buyers: number;
  /** of those buyers, by their shop orders from the first day read to the period's end: one, two, three or more */
  oneShot: number; second: number; multiple: number;
};
export const blankOrders = (): OStats => ({ orders: 0, buyers: 0, oneShot: 0, second: 0, multiple: 0 });
/** A period's shop orders, grouped by a label of the company (all together under ""); with a mask, only the orders with a
 *  line of one of those profit centres (bits as O.pcs) - and the buyers counted by their orders of them. */
export function ordersBy(d: ShopData, w: SWin, pass: (co: number) => boolean, key: (co: number) => string = () => "", mask = -1): Map<string, OStats> {
  const out = new Map<string, OStats>();
  const [a, b] = dayRange(d, w);
  const hist = new Map<number, [number, number]>(); // company -> [in the period, up to its end]
  for (const r of d.orders) {
    if (r[O.day] > b || (mask !== -1 && !(r[O.pcs] & mask)) || !pass(r[O.company])) continue;
    let h = hist.get(r[O.company]);
    if (!h) { h = [0, 0]; hist.set(r[O.company], h); }
    h[1]++;
    if (r[O.day] >= a) h[0]++;
  }
  for (const [co, [inside, upTo]] of hist) {
    if (!inside) continue;
    const k = key(co);
    let s = out.get(k);
    if (!s) { s = blankOrders(); out.set(k, s); }
    s.orders += inside; s.buyers++;
    if (upTo === 1) s.oneShot++; else if (upTo === 2) s.second++; else s.multiple++;
  }
  return out;
}

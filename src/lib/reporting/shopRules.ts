// THE ESO SHOP BEHAVIOUR PAGE'S RULES (SARCLA 29.10.2026: "rebuild like Figures/Visits" - his picks: logins, views and
// logged in & bought; the smart bar's live counters since 2 Oct with the Performis years beside them; bought = ordered in
// the shop). Every company the shop counted as small rows - one per company and day (live), one per company and year (the
// Performis export) - so the page works out any period, team, person or filter itself. No HubSpot or database here, so
// the page and the tests read it as it is.
//
// Two sources, never on one chart: a period is either live (the smart bar's day counters, kept in the hub since they
// started on 2 Oct 2026) or a Performis year (the desktop E-Shop Data Tracker's export, loaded into HubSpot by hand - the
// last one on 15 Apr 2026, so 2026 stops there).

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
  labels: { prio: string[]; category: string[]; country: string[] };
  /** per company index - see C */
  companies: number[][];
  /** live: one row per company and day - see D */
  days: number[][];
  /** Performis: one row per company and year - see Y */
  years: number[][];
  coverage: { companies: number; live: number; performis: number; internal: number };
};
/** A company row: its owner (person index), priority, customer category, country (label indexes). */
export const C = { person: 0, prio: 1, category: 2, country: 3 } as const;
/** A live row: the company, the day (0 = liveFrom), logins, article views, articles ordered in the shop. */
export const D = { company: 0, day: 1, logins: 2, views: 3, orders: 4 } as const;
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
export type SFilters = Partial<Record<SDim, string[]>>;

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
};
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-04-15" -> "15 Apr 2026" */
export const dayWords = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const live = (from: number, to: number): SWin => ({ kind: "live", from, to });
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).toISOString().slice(0, 10);
const prevMonth = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);

/** The periods the Filters offer, in their order: live first (the last 4 weeks the default), then the Performis years,
 *  newest first. The last 7 days and 4 weeks are whole days, to yesterday; the month to date counts today so far. */
export function presetsOf(d: ShopData): SPer[] {
  const t = dayNo(d.liveFrom, d.today);
  const out: SPer[] = [];
  const back = (n: number, id: string, label: string, title: string) => {
    const from = Math.max(0, t - n), to = t - 1;
    if (to < from) return;
    out.push({ id, label, title, win: live(from, to), prev: t - 2 * n >= 0 ? live(t - 2 * n, t - n - 1) : null });
  };
  back(28, "28d", "Last 4 weeks", "the last 4 weeks");
  back(7, "7d", "Last 7 days", "the last 7 days");
  // the month to date, against the same days of the month before
  {
    const ms = dayNo(d.liveFrom, monthStart(d.today));
    const pm = prevMonth(d.today);
    const pFrom = dayNo(d.liveFrom, pm), pTo = Math.min(pFrom + (t - ms), dayNo(d.liveFrom, monthEnd(pm)));
    if (t >= 0) out.push({ id: "mtd", label: "Month to date", title: "month to date", win: live(Math.max(0, ms), t), prev: pFrom >= 0 ? live(pFrom, pTo) : null });
  }
  // each month the counters have finished, newest first, against the month before
  const months: SPer[] = [];
  for (let m = monthStart(d.liveFrom); monthEnd(m) < d.today; m = dayOf(monthEnd(m), 1)) {
    const from = dayNo(d.liveFrom, m), to = dayNo(d.liveFrom, monthEnd(m));
    const pm = prevMonth(m), pFrom = dayNo(d.liveFrom, pm);
    const name = `${MONTHS_FULL[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
    months.unshift({ id: `m${m.slice(0, 7)}`, label: name, title: name, win: live(Math.max(0, from), to), prev: pFrom >= 0 ? live(pFrom, dayNo(d.liveFrom, monthEnd(pm))) : null });
  }
  out.push(...months);
  // everything counted so far - once it is more than the month to date
  if (t >= 0 && monthStart(d.liveFrom) < monthStart(d.today)) out.push({ id: "live", label: `Since ${dayWords(d.liveFrom)}`, title: `since ${dayWords(d.liveFrom)}`, win: live(0, t), prev: null });
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

/** The days a live period spans, or 0 for a year. */
export const spanOf = (w: SWin) => (w.kind === "live" ? w.to - w.from + 1 : 0);

/* ── the figures ───────────────────────────────────────────────────────── */

/** Each company's logins, article views and shop orders over a period - companies without any left out. */
export function totalsOf(d: ShopData, w: SWin): Map<number, [number, number, number]> {
  const out = new Map<number, [number, number, number]>();
  const add = (co: number, l: number, v: number, o: number) => {
    if (!l && !v && !o) return;
    const t = out.get(co);
    if (t) { t[0] += l; t[1] += v; t[2] += o; } else out.set(co, [l, v, o]);
  };
  if (w.kind === "live") { for (const r of d.days) if (r[D.day] >= w.from && r[D.day] <= w.to) add(r[D.company], r[D.logins], r[D.views], r[D.orders]); }
  else for (const r of d.years) if (r[Y.year] === w.y) add(r[Y.company], r[Y.logins], r[Y.views], r[Y.orders]);
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
  const sets = (Object.keys(f) as SDim[]).filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
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
  /** of the companies that logged in: those that also ordered in the shop, and those that never opened an article */
  ordered: number; noView: number;
};
export const blank = (): SStats => ({ companies: 0, logins: 0, views: 0, ordered: 0, noView: 0 });

/** The figures of a period's companies, grouped by a label (all together under ""). A company counts when it logged in
 *  in the period, with its views and shop orders; one with views or orders but no login recorded (a tab left open since
 *  the day before) is left out of every figure, so the shares stay over the same companies. */
export function statsBy(d: ShopData, totals: Map<number, [number, number, number]>, pass: (co: number) => boolean, key: (co: number) => string = () => ""): Map<string, SStats> {
  const out = new Map<string, SStats>();
  for (const [co, [l, v, o]] of totals) {
    if (l <= 0 || !pass(co)) continue;
    const k = key(co);
    let s = out.get(k);
    if (!s) { s = blank(); out.set(k, s); }
    s.companies++;
    s.logins += l;
    s.views += v;
    if (o > 0) s.ordered++;
    if (v <= 0) s.noView++;
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
 *  22 Oct 2026, 165 companies against some 600). Needs five weekdays to tell; weekends are always low and never marked. */
export function shortDays(s: Series): Set<string> {
  const week = s.keys.flatMap((k, i) => (/^\d{4}-\d{2}-\d{2}$/.test(k) && ![0, 6].includes(new Date(`${k}T00:00:00Z`).getUTCDay()) ? [[k, s.companies[i]] as const] : []));
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

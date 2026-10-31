// THE ESO VISITS PAGE'S RULES (SARCLA 27.10.2026: "review completely the visits" - his pick, rebuilt like Figures): every
// completed customer visit as one small row, so the page works out any period, team, person or filter itself. No HubSpot
// or database here, so the page and the tests read it as it is.
// 29.10: no potential any more ("take out the potential value"); a visit without a company said so, not "Not set" ("a visit
// should always have a company"); the real customer categories, no "Other"; the customers who had bought before the
// visit - still buying or not retained - and did they buy after it; how much of each priority was visited; last year's
// customer meetings to compare with (the visit reports start in December 2025).
// 29.10, later: "not agreed - call it scheduled"; the type of visit as the page's own split (scheduled, cold, event); the
// visit reports' "Yearly Customer Potential" gone with the rest of the potential (a typical entry €2,000, some in thousands).

export type VisitsData = {
  generatedAt: string;
  /** this year; visits are kept for it and the year before */
  year: number;
  /** the day the read reaches, "2026-10-27" */
  today: string;
  /** the visit owners and the companies' owners, by index - their team from the rosters, else their HubSpot team */
  people: { id: string; name: string; team: string }[];
  labels: { prio: string[]; category: string[]; kind: string[]; country: string[] };
  /** one row per completed visit - see V */
  visits: number[][];
  /** per company index - see CO */
  companies: number[][];
  /** this year's visits that do not count yet (no report): person index -> stage -> visits */
  open: Record<string, Record<string, number>>;
  /** person index -> the companies they own now, by priority in labels.prio's order (the first four) */
  portfolio: Record<string, number[]>;
  /** last year's customer meetings (a meeting with a company in HubSpot - each became a visit from December 2025): person, month, day */
  lastYear: number[][];
  coverage: { read: number; completed: number; withCompany: number; viaContact: number; lastYearRead: boolean };
};
/** The columns of a visit row: who, when, the visit's type, the company's priority / category / country, the company (-1:
 *  none linked, not even through the visit's contact), whether it had never ordered before that day. */
export const V = { person: 0, year: 1, month: 2, day: 3, kind: 4, prio: 5, category: 6, country: 7, company: 8, isNew: 9 } as const;
/** The columns of a company row: the day it registered in the shop yyyymmdd (Magento "customer since") or 0, its first
 *  order yyyymmdd or 0, this year's revenue, its owner now (person index, -1: none), its last order yyyymmdd or 0, the
 *  months it bought in (bit 0 = January last year, bit 23 = December this year). Dates, not the qualification's answers
 *  (SARCLA 28.10.2026: "you are using qualification - we are able to get this correctly"). */
export const CO = { shopSince: 0, firstOrder: 1, revenue: 2, owner: 3, lastOrder: 4, bought: 5 } as const;

/** A visit with no company in HubSpot - neither on the visit nor on its contact */
export const NO_COMPANY = "No company on the visit";
/** The type of visit, as the visit report says (SARCLA 29.10.2026: "not agreed - call it scheduled") */
export const KINDS = ["Scheduled", "Cold", "Event", "Not recorded"] as const;
export function kindOf(type: string | null | undefined): (typeof KINDS)[number] {
  return type === "SCHEDULED VISIT" ? "Scheduled" : type === "COLD VISIT" ? "Cold" : type === "EVENT VISIT" ? "Event" : "Not recorded";
}

/** When a new customer registered in the shop, against its first visit - in the order the page shows them */
export const REG_WAY = ["Registered on the day of the visit", "Registered later, after the visit", "Already registered before the visit", "Not registered in the shop"] as const;
/** A company's shop registration against its first visit's day and the period's end. */
export function regWayOf(shopSince: number, visitDay: number, end: number): (typeof REG_WAY)[number] {
  if (!shopSince || shopSince > end) return REG_WAY[3];
  return shopSince < visitDay ? REG_WAY[2] : shopSince === visitDay ? REG_WAY[0] : REG_WAY[1];
}
/** A customer that had bought before the visit: an order in the 12 months before it, or none for 12 months and more */
export const BEFORE = ["Still buying - an order in the 12 months before the visit", "Not retained - no order for 12 months or more"] as const;

/** A period: this year's months, 0 = January (or last year's with year 1). A range of days (SARCLA 31.10.2026: "really
 *  custom dates with a mini calendar" - a visit has its day) keeps its first and last day too, yyyymmdd: the months are the
 *  ones it spans, the visits are cut to the days. No d0/d1: whole months, as before. */
export type VWin = { from: number; to: number; year?: 0 | 1; d0?: number; d1?: number };
export type VDim = "person" | "prio" | "category" | "kind" | "country";
export type VFilters = Partial<Record<VDim, string[]>>;

/** "2026-03-05" -> 20260305 */
export const ymd = (s: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ""); return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0; };
/** 20260305 -> "2026-03-05" */
export const isoOf = (day: number) => `${Math.floor(day / 10000)}-${String(Math.floor(day / 100) % 100).padStart(2, "0")}-${String(day % 100).padStart(2, "0")}`;
/** 20260305 -> the same day a year earlier, 20250305 */
const yearBefore = (day: number) => day - 10000;
/** The days of a month (0 = January) */
export const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
/** A visit row's day, yyyymmdd */
const dayOfRow = (d: VisitsData, r: number[]) => (d.year - (r[V.year] ?? 0)) * 10000 + (r[V.month] + 1) * 100 + r[V.day];

/** A range of days of this year as a period, either order, kept between the 1st of January and the read's day. Whole
 *  months - from a 1st to a month's last day, or to the read's day - are the months alone, so the quick picks and the
 *  quarters still light up when the calendar gives the same. */
export function dayWin(d: VisitsData, a: number, b: number): VWin {
  const today = ymd(d.today), first = d.year * 10000 + 101;
  // a day past its month's end ("2026-02-31") rolls on, as a calendar would
  const fix = (n: number) => ymd(new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100)).toISOString());
  const keep = (n: number) => (Number.isFinite(n) && n > 0 ? Math.min(Math.max(fix(n), first), today) : first);
  const [x, y] = a <= b ? [keep(a), keep(b)] : [keep(b), keep(a)];
  const from = Math.floor(x / 100) % 100 - 1, to = Math.floor(y / 100) % 100 - 1;
  return x % 100 === 1 && (y === today || y % 100 === daysIn(d.year, to)) ? { from, to } : { from, to, d0: x, d1: y };
}
/** A period's first and last day, yyyymmdd - the last the read's day while it runs. */
export function daysOf(d: VisitsData, win: VWin): [number, number] {
  if (win.d0 && win.d1) return [win.d0, win.d1];
  const yr = d.year - (win.year ?? 0);
  return [yr * 10000 + (win.from + 1) * 100 + 1, Math.min(ymd(d.today), yr * 10000 + (win.to + 1) * 100 + daysIn(yr, win.to))];
}

const COL: Record<Exclude<VDim, "person">, number> = { prio: V.prio, category: V.category, kind: V.kind, country: V.country };
/** A row's value on a breakdown, as its label. */
export function labelOf(d: VisitsData, row: number[], dim: VDim): string {
  if (dim === "person") return d.people[row[V.person]]?.name ?? "Unknown";
  return d.labels[dim][row[COL[dim]]] ?? "Not set";
}

/** The visits of a period, under the filters - a breakdown's own filter left out when grouping by it (the Filters window's
 *  lists only: the charts show what is chosen, SARCLA 29.10: "the filter goes but they still keep on top"). */
export function rowsOf(d: VisitsData, win: VWin, f: VFilters, people: Set<number> | null, except?: VDim): number[][] {
  const y = win.year ?? 0;
  const sets = (Object.keys(f) as VDim[]).filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  return d.visits.filter((r) => r[V.year] === y && r[V.month] >= win.from && r[V.month] <= win.to
    && (!win.d0 || dayOfRow(d, r) >= win.d0) && (!win.d1 || dayOfRow(d, r) <= win.d1)
    && (!people || people.has(r[V.person]))
    && sets.every(([k, s]) => s.has(labelOf(d, r, k))));
}

export type VStats = {
  visits: number; companies: number;
  /** visits without a company (NO_COMPANY) */
  noCompany: number;
  /** visits to new customers (companies that had never ordered before the visit's day), and those companies */
  newVisits: number; newCompanies: number;
  /** of those companies: registered in the shop on the visit's day or after it, by the period's end (or the read's day);
   *  each one's registration against the visit (REG_WAY); first order on the visit's day or after it, by the period's end;
   *  the same by the read's day */
  registeredAfter: number; regWays: Record<string, number>; boughtInPeriod: number; boughtAfter: number;
  /** companies that had bought before the visit: still buying (an order in the 12 months before) or not retained, and of
   *  each how many ordered after the visit by the period's end */
  oldCompanies: number; stillBuying: number; lapsed: number; stillBuyingAgain: number; lapsedAgain: number;
  /** the visits by type (KINDS) - not recorded: the rest */
  scheduled: number; cold: number; event: number;
  /** this year's revenue of the companies visited, and how many of them have any */
  revenue: number; buyers: number;
  /** visits per month of the period, from its first */
  months: number[];
};
/** No visits: every figure zero, n months. */
export const blank = (n: number): VStats => ({
  visits: 0, companies: 0, noCompany: 0, newVisits: 0, newCompanies: 0, registeredAfter: 0, regWays: {}, boughtInPeriod: 0, boughtAfter: 0,
  oldCompanies: 0, stillBuying: 0, lapsed: 0, stillBuyingAgain: 0, lapsedAgain: 0, scheduled: 0, cold: 0, event: 0, revenue: 0, buyers: 0, months: Array(n).fill(0),
});

/** Any month bought in between two month indexes (January last year = 0), both included. */
const boughtIn = (mask: number, from: number, to: number) => { for (let i = Math.max(0, from); i <= Math.min(23, to); i++) if (mask & (1 << i)) return true; return false; };

/** The figures of a set of visits, grouped by a label (all together under ""). */
export function statsBy(d: VisitsData, rows: number[][], win: VWin, key: (r: number[]) => string = () => ""): Map<string, VStats> {
  const out = new Map<string, VStats>();
  const first = new Map<string, Map<number, { day: number; month: number; isNew: boolean }>>();
  const today = ymd(d.today);
  const yr = d.year - (win.year ?? 0);
  // the period's last day - the read's day while it runs, a range's own last day - and its last month in the bought mask.
  // The months bought in are kept by the month: a range that ends mid-month leaves that month out of the mask (an order in
  // it may be after the range) - an order there counts only by the last order's day.
  const end = Math.min(today, win.d1 ?? yr * 10000 + (win.to + 1) * 100 + 31);
  const wholeEnd = !win.d1 || end >= today || end % 100 >= daysIn(yr, win.to);
  const endMonth = (1 - (win.year ?? 0)) * 12 + win.to - (wholeEnd ? 0 : 1);
  const kinds = d.labels.kind;
  const n = win.to - win.from + 1;
  for (const r of rows) {
    const k = key(r);
    let s = out.get(k);
    if (!s) { s = blank(n); out.set(k, s); }
    s.visits++;
    s.months[r[V.month] - win.from]++;
    if (r[V.isNew]) s.newVisits++;
    const kind = kinds[r[V.kind]];
    if (kind === "Scheduled") s.scheduled++; else if (kind === "Cold") s.cold++; else if (kind === "Event") s.event++;
    const co = r[V.company];
    if (co < 0) { s.noCompany++; continue; }
    const day = dayOfRow(d, r);
    let m = first.get(k);
    if (!m) { m = new Map(); first.set(k, m); }
    const was = m.get(co);
    if (!was || day < was.day) m.set(co, { day, month: (1 - (r[V.year] ?? 0)) * 12 + r[V.month], isNew: !!r[V.isNew] });
  }
  for (const [k, m] of first) {
    const s = out.get(k)!;
    for (const [co, v] of m) {
      const c = d.companies[co] ?? [0, 0, 0, -1, 0, 0];
      s.companies++;
      s.revenue += c[CO.revenue];
      if (c[CO.revenue] > 0) s.buyers++;
      const fo = c[CO.firstOrder];
      if (!v.isNew) {
        // it had bought before: in the 12 months before the visit (by month, or its first order within the year before), or not
        s.oldCompanies++;
        const still = boughtIn(c[CO.bought] ?? 0, v.month - 12, v.month - 1) || (fo > 0 && fo >= yearBefore(v.day));
        const lo = c[CO.lastOrder] ?? 0;
        const again = (lo >= v.day && lo <= end) || boughtIn(c[CO.bought] ?? 0, v.month + 1, endMonth);
        if (still) { s.stillBuying++; if (again) s.stillBuyingAgain++; } else { s.lapsed++; if (again) s.lapsedAgain++; }
        continue;
      }
      s.newCompanies++;
      const way = regWayOf(c[CO.shopSince], v.day, end);
      s.regWays[way] = (s.regWays[way] ?? 0) + 1;
      if (way === REG_WAY[0] || way === REG_WAY[1]) s.registeredAfter++;
      // an order on the visit's day counts: it had never ordered before it
      if (fo && fo >= v.day && fo <= today) s.boughtAfter++;
      if (fo && fo >= v.day && fo <= end) s.boughtInPeriod++;
    }
  }
  return out;
}

/** How much of each priority was visited (SARCLA 29.10: visits by priority made Prio 1 look neglected - it is the smallest
 *  group): per priority, the companies the owners hold now and how many of them the visits reached. */
export function coverageOf(d: VisitsData, rows: number[][], owners: Set<number>): { label: string; owned: number; visited: number }[] {
  const bands = d.labels.prio.slice(0, 4);
  const owned = bands.map(() => 0), visited = bands.map(() => 0);
  for (const p of owners) (d.portfolio[String(p)] ?? []).forEach((x, i) => { if (i < owned.length) owned[i] += x; });
  const seen = new Set<number>();
  for (const r of rows) {
    const co = r[V.company];
    if (co < 0 || seen.has(co)) continue;
    seen.add(co);
    if (!owners.has(d.companies[co]?.[CO.owner] ?? -1)) continue;
    const i = r[V.prio];
    if (i < visited.length) visited[i]++;
  }
  return bands.map((label, i) => ({ label, owned: owned[i], visited: visited[i] }));
}

/** Last year's customer meetings per month of the period, for the people shown - the running month to the same day, a
 *  range of days to the same days a year earlier. */
export function lastYearOf(d: VisitsData, win: VWin, people: Set<number> | null): number[] {
  const out = Array(win.to - win.from + 1).fill(0);
  const now = Number(d.today.slice(5, 7)) - 1, day = Number(d.today.slice(8, 10));
  const lo = win.d0 ? win.d0 % 10000 : 0, hi = win.d1 ? win.d1 % 10000 : 9999;
  for (const [p, m, dd] of d.lastYear) {
    const md = (m + 1) * 100 + dd;
    if (m >= win.from && m <= win.to && md >= lo && md <= hi && (!people || people.has(p)) && !(m === now && dd > day)) out[m - win.from]++;
  }
  return out;
}

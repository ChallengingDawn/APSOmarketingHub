// THE ESO VISITS PAGE'S RULES (SARCLA 27.10.2026: "review completely the visits" - his pick, rebuilt like Figures): every
// completed customer visit as one small row, so the page works out any period, team, person or filter itself. No HubSpot
// or database here, so the page and the tests read it as it is.
// 29.10: no potential any more ("take out the potential value"); a visit without a company said so, not "Not set" ("a visit
// should always have a company"); the real customer categories, no "Other"; the customers who had bought before the
// visit - still buying or not retained - and did they buy after it; how much of each priority was visited; last year's
// customer meetings to compare with (the visit reports start in December 2025).

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
 *  none linked, not even through the visit's contact), whether it had never ordered before that day, the annual need the
 *  visit report gives (0: none). */
export const V = { person: 0, year: 1, month: 2, day: 3, kind: 4, prio: 5, category: 6, country: 7, company: 8, isNew: 9, need: 10 } as const;
/** The columns of a company row: the day it registered in the shop yyyymmdd (Magento "customer since") or 0, its first
 *  order yyyymmdd or 0, this year's revenue, its owner now (person index, -1: none), its last order yyyymmdd or 0, the
 *  months it bought in (bit 0 = January last year, bit 23 = December this year). Dates, not the qualification's answers
 *  (SARCLA 28.10.2026: "you are using qualification - we are able to get this correctly"). */
export const CO = { shopSince: 0, firstOrder: 1, revenue: 2, owner: 3, lastOrder: 4, bought: 5 } as const;

/** A visit with no company in HubSpot - neither on the visit nor on its contact */
export const NO_COMPANY = "No company on the visit";
/** An annual need the page can use: €100 to €1m. Under it is typed in thousands ("2" for €2,000 - Katja Storm's half),
 *  over it a placeholder (Benjamin Nitschke's €500,015,000). */
export const needOk = (v: number) => v >= 100 && v <= 1_000_000;
/** The middle value - an average of these reports is led by a few typed €300,000s */
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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

/** A period: this year's months, 0 = January (or last year's with year 1). */
export type VWin = { from: number; to: number; year?: 0 | 1 };
export type VDim = "person" | "prio" | "category" | "kind" | "country";
export type VFilters = Partial<Record<VDim, string[]>>;

/** "2026-03-05" -> 20260305 */
export const ymd = (s: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ""); return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0; };
/** 20260305 -> the same day a year earlier, 20250305 */
const yearBefore = (day: number) => day - 10000;

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
  agreed: number; cold: number; event: number;
  /** the visit reports' annual needs the page can use (needOk), and how many were left out */
  needs: number[]; needOut: number;
  /** this year's revenue of the companies visited, and how many of them have any */
  revenue: number; buyers: number;
  /** visits per month of the period, from its first */
  months: number[];
};
/** No visits: every figure zero, n months. */
export const blank = (n: number): VStats => ({
  visits: 0, companies: 0, noCompany: 0, newVisits: 0, newCompanies: 0, registeredAfter: 0, regWays: {}, boughtInPeriod: 0, boughtAfter: 0,
  oldCompanies: 0, stillBuying: 0, lapsed: 0, stillBuyingAgain: 0, lapsedAgain: 0, agreed: 0, cold: 0, event: 0, needs: [], needOut: 0, revenue: 0, buyers: 0, months: Array(n).fill(0),
});

/** Any month bought in between two month indexes (January last year = 0), both included. */
const boughtIn = (mask: number, from: number, to: number) => { for (let i = Math.max(0, from); i <= Math.min(23, to); i++) if (mask & (1 << i)) return true; return false; };

/** The figures of a set of visits, grouped by a label (all together under ""). */
export function statsBy(d: VisitsData, rows: number[][], win: VWin, key: (r: number[]) => string = () => ""): Map<string, VStats> {
  const out = new Map<string, VStats>();
  const first = new Map<string, Map<number, { day: number; month: number; isNew: boolean }>>();
  const today = ymd(d.today);
  const yr = d.year - (win.year ?? 0);
  // the period's last day - the read's day while it runs - and its last month in the bought mask
  const end = Math.min(today, yr * 10000 + (win.to + 1) * 100 + 31);
  const endMonth = (1 - (win.year ?? 0)) * 12 + win.to;
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
    if (kind === "Agreed") s.agreed++; else if (kind === "Cold") s.cold++; else if (kind === "Event") s.event++;
    const need = r[V.need] ?? 0;
    if (needOk(need)) s.needs.push(need); else if (need > 0) s.needOut++;
    const co = r[V.company];
    if (co < 0) { s.noCompany++; continue; }
    const day = (d.year - (r[V.year] ?? 0)) * 10000 + (r[V.month] + 1) * 100 + r[V.day];
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

/** Last year's customer meetings per month of the period, for the people shown - the running month to the same day. */
export function lastYearOf(d: VisitsData, win: VWin, people: Set<number> | null): number[] {
  const out = Array(win.to - win.from + 1).fill(0);
  const now = Number(d.today.slice(5, 7)) - 1, day = Number(d.today.slice(8, 10));
  for (const [p, m, dd] of d.lastYear) if (m >= win.from && m <= win.to && (!people || people.has(p)) && !(m === now && dd > day)) out[m - win.from]++;
  return out;
}

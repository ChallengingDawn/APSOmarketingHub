// THE ESO VISITS PAGE'S RULES (SARCLA 27.10.2026: "review completely the visits" - his pick, rebuilt like Figures): every
// completed customer visit as one small row, so the page works out any period, team, person or filter itself. No HubSpot
// or database here, so the page and the tests read it as it is.

export type VisitsData = {
  generatedAt: string;
  /** this year; visits are kept for it and the year before */
  year: number;
  /** the day the read reaches, "2026-10-27" */
  today: string;
  /** the visit owners, by index - their team from the rosters, else their HubSpot team */
  people: { id: string; name: string; team: string }[];
  labels: { prio: string[]; category: string[]; kind: string[]; country: string[]; band: string[]; regWay: string[] };
  /** one row per completed visit - see V */
  visits: number[][];
  /** per company index - see CO */
  companies: number[][];
  /** this year's visits that do not count yet (no report): person index -> stage -> visits */
  open: Record<string, Record<string, number>>;
  coverage: { read: number; completed: number; withCompany: number };
};
/** The columns of a visit row: who, when, the visit's type, the company's priority / category / country / potential band,
 *  the company (-1: none linked), whether it had never ordered that day, its yearly potential (0: none or a placeholder
 *  over €1m), the annual need the visit report gives (0: none). */
export const V = { person: 0, year: 1, month: 2, day: 3, kind: 4, prio: 5, category: 6, country: 7, company: 8, isNew: 9, potential: 10, need: 11, band: 12 } as const;
/** The columns of a company row: registered after a visit (HubSpot's "Meeting before registration"), first order yyyymmdd
 *  or 0, this year's revenue, how it registered (labels.regWay). */
export const CO = { registeredAfter: 0, firstOrder: 1, revenue: 2, regWay: 3 } as const;

/** A potential the page can use: above zero and up to €1m - higher ones are placeholders (as the customers' cube). */
export const usable = (v: number) => v > 0 && v <= 1_000_000;
export const POTENTIAL_BANDS = ["€100,000 and more", "€25,000 – 99,999", "€2,500 – 24,999", "€500 – 2,499", "Under €500", "Not set"] as const;
export function bandOf(v: number): string {
  if (!usable(v)) return "Not set";
  return v >= 100_000 ? POTENTIAL_BANDS[0] : v >= 25_000 ? POTENTIAL_BANDS[1] : v >= 2_500 ? POTENTIAL_BANDS[2] : v >= 500 ? POTENTIAL_BANDS[3] : POTENTIAL_BANDS[4];
}
/** HubSpot's registration method, in words */
export const REG_WAY: Record<string, string> = {
  "Meeting before registration": "Registered after the visit",
  "Registered before meeting": "Registered on their own, before the visit",
  "": "Not registered",
};

/** A period: this year's months, 0 = January (or last year's with year 1). */
export type VWin = { from: number; to: number; year?: 0 | 1 };
export type VDim = "person" | "prio" | "category" | "kind" | "country" | "band";
export type VFilters = Partial<Record<VDim, string[]>>;

/** "2026-03-05" -> 20260305 */
export const ymd = (s: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ""); return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0; };

const COL: Record<Exclude<VDim, "person">, number> = { prio: V.prio, category: V.category, kind: V.kind, country: V.country, band: V.band };
/** A row's value on a breakdown, as its label. */
export function labelOf(d: VisitsData, row: number[], dim: VDim): string {
  if (dim === "person") return d.people[row[V.person]]?.name ?? "Unknown";
  return d.labels[dim][row[COL[dim]]] ?? "Not set";
}

/** The visits of a period, under the filters - a breakdown's own filter left out when grouping by it, as the cube does. */
export function rowsOf(d: VisitsData, win: VWin, f: VFilters, people: Set<number> | null, except?: VDim): number[][] {
  const y = win.year ?? 0;
  const sets = (Object.keys(f) as VDim[]).filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  return d.visits.filter((r) => r[V.year] === y && r[V.month] >= win.from && r[V.month] <= win.to
    && (!people || people.has(r[V.person]))
    && sets.every(([k, s]) => s.has(labelOf(d, r, k))));
}

export type VStats = {
  visits: number; companies: number;
  /** visits to new customers (companies that had never ordered that day), and those companies */
  newVisits: number; newCompanies: number;
  /** of those companies: registered in the shop after the visit; how each registered; bought after the visit and by the
   *  period's end (or the read's day); bought after it at all, by the read's day */
  registeredAfter: number; regWays: Record<string, number>; boughtInPeriod: number; boughtAfter: number;
  agreed: number; cold: number; event: number;
  /** the visited companies' yearly potential (usable ones), and the visit reports' annual need, each over the visits that know it */
  potSum: number; potN: number; needSum: number; needN: number;
  /** this year's revenue of the companies visited */
  revenue: number;
  /** visits per month of the period, from its first */
  months: number[];
};
/** No visits: every figure zero, n months. */
export const blank = (n: number): VStats => ({ visits: 0, companies: 0, newVisits: 0, newCompanies: 0, registeredAfter: 0, regWays: {}, boughtInPeriod: 0, boughtAfter: 0, agreed: 0, cold: 0, event: 0, potSum: 0, potN: 0, needSum: 0, needN: 0, revenue: 0, months: Array(n).fill(0) });

/** The figures of a set of visits, grouped by a label (all together under ""). */
export function statsBy(d: VisitsData, rows: number[][], win: VWin, key: (r: number[]) => string = () => ""): Map<string, VStats> {
  const out = new Map<string, VStats>();
  const first = new Map<string, Map<number, { day: number; isNew: boolean }>>();
  const today = ymd(d.today);
  const yr = d.year - (win.year ?? 0);
  // the period's last day - the read's day while it runs
  const end = Math.min(today, yr * 10000 + (win.to + 1) * 100 + 31);
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
    if (usable(r[V.potential])) { s.potSum += r[V.potential]; s.potN++; }
    if (usable(r[V.need] ?? 0)) { s.needSum += r[V.need]; s.needN++; }
    const co = r[V.company];
    if (co >= 0) {
      const day = (d.year - (r[V.year] ?? 0)) * 10000 + (r[V.month] + 1) * 100 + r[V.day];
      let m = first.get(k);
      if (!m) { m = new Map(); first.set(k, m); }
      const was = m.get(co);
      if (!was || day < was.day) m.set(co, { day, isNew: !!r[V.isNew] });
    }
  }
  for (const [k, m] of first) {
    const s = out.get(k)!;
    for (const [co, v] of m) {
      const c = d.companies[co] ?? [0, 0, 0, -1];
      s.companies++;
      s.revenue += c[CO.revenue];
      if (!v.isNew) continue;
      s.newCompanies++;
      if (c[CO.registeredAfter]) s.registeredAfter++;
      const way = REG_WAY[d.labels.regWay?.[c[CO.regWay]] ?? ""] ?? d.labels.regWay?.[c[CO.regWay]] ?? "Not registered";
      s.regWays[way] = (s.regWays[way] ?? 0) + 1;
      const fo = c[CO.firstOrder];
      if (fo && fo > v.day && fo <= today) s.boughtAfter++;
      if (fo && fo > v.day && fo <= end) s.boughtInPeriod++;
    }
  }
  return out;
}

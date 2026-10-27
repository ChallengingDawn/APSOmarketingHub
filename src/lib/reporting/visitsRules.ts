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
  labels: { prio: string[]; category: string[]; kind: string[]; country: string[] };
  /** one row per completed visit - see V */
  visits: number[][];
  /** per company index: [registered after a visit 1/0 (HubSpot's "Meeting before registration"), first order yyyymmdd or 0, revenue this year] */
  companies: number[][];
  /** this year's visits that do not count yet (no report): person index -> stage -> visits */
  open: Record<string, Record<string, number>>;
  coverage: { read: number; completed: number; withCompany: number };
};
/** The columns of a visit row. */
export const V = { person: 0, year: 1, month: 2, day: 3, kind: 4, prio: 5, category: 6, country: 7, company: 8, isNew: 9, potential: 10 } as const;
export const CO = { registeredAfter: 0, firstOrder: 1, revenue: 2 } as const;

/** A period: this year's months, 0 = January (or last year's with year 1). */
export type VWin = { from: number; to: number; year?: 0 | 1 };
export type VDim = "person" | "prio" | "category" | "kind" | "country";
export type VFilters = Partial<Record<VDim, string[]>>;

/** "2026-03-05" -> 20260305 */
export const ymd = (s: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ""); return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0; };

/** A row's value on a breakdown, as its label. */
export function labelOf(d: VisitsData, row: number[], dim: VDim): string {
  if (dim === "person") return d.people[row[V.person]]?.name ?? "Unknown";
  const col = dim === "prio" ? V.prio : dim === "category" ? V.category : dim === "kind" ? V.kind : V.country;
  return d.labels[dim][row[col]] ?? "Not set";
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
  /** visits to companies that had never ordered that day, and those companies */
  newVisits: number; newCompanies: number;
  /** of those companies: registered in the shop after the visit, bought after it (by the read's day) */
  registeredAfter: number; boughtAfter: number;
  agreed: number; cold: number; event: number;
  /** the visited companies' yearly potential, over the visits that know it */
  potSum: number; potN: number;
  /** this year's revenue of the companies visited */
  revenue: number;
  /** visits per month of the period, from its first */
  months: number[];
};
const blank = (n: number): VStats => ({ visits: 0, companies: 0, newVisits: 0, newCompanies: 0, registeredAfter: 0, boughtAfter: 0, agreed: 0, cold: 0, event: 0, potSum: 0, potN: 0, revenue: 0, months: Array(n).fill(0) });

/** The figures of a set of visits, grouped by a label (all together under ""). */
export function statsBy(d: VisitsData, rows: number[][], win: VWin, key: (r: number[]) => string = () => ""): Map<string, VStats> {
  const out = new Map<string, VStats>();
  const first = new Map<string, Map<number, { day: number; isNew: boolean }>>();
  const today = ymd(d.today);
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
    if (r[V.potential] > 0) { s.potSum += r[V.potential]; s.potN++; }
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
      const c = d.companies[co] ?? [0, 0, 0];
      s.companies++;
      s.revenue += c[CO.revenue];
      if (!v.isNew) continue;
      s.newCompanies++;
      if (c[CO.registeredAfter]) s.registeredAfter++;
      if (c[CO.firstOrder] && c[CO.firstOrder] > v.day && c[CO.firstOrder] <= today) s.boughtAfter++;
    }
  }
  return out;
}

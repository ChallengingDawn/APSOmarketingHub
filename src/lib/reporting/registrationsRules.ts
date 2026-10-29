// THE ESO REGISTRATIONS PAGE'S RULES - rebuilt like the Visits and the Figures. Every company with a shop account, and
// every shop account opened this year or last, as small rows, so the page works out any period, team, person or filter
// itself. No HubSpot or database here, so the page and the tests read it as it is.
//
// The dates are the shop's own: a contact's Magento "customer since" (the day it registered), a company's first one.
// Not the HubSpot contact's creation date - 2025 holds about 2,200 contacts created in HubSpot that registered in the
// shop earlier - and not "Registration Details (ESO)", a qualification's answer (SARCLA 28.10.2026: "you are using
// qualification - we are able to get this correctly").

export type RegData = {
  generatedAt: string;
  /** this year; registrations are kept for it and the year before */
  year: number;
  /** the day the read reaches, "2026-10-29" */
  today: string;
  /** the companies' owners, by index - their team from the rosters, else their HubSpot team; "No company" last */
  people: { id: string; name: string; team: string }[];
  labels: { country: string[]; prio: string[]; category: string[]; type: string[]; band: string[] };
  /** every company with a shop account opened this year or last - see C */
  companies: number[][];
  /** every shop account opened this year or last - see A */
  accounts: number[][];
  coverage: { accounts: number; noCompany: number; companies: number; visits: number };
};
/** The columns of a company row: its owner; the day its first shop account was opened yyyymmdd; its first order yyyymmdd
 *  or 0; its first completed customer visit yyyymmdd or 0; its country / priority / category / type / potential band. */
export const C = { person: 0, reg: 1, firstOrder: 2, firstVisit: 3, country: 4, prio: 5, category: 6, type: 7, band: 8 } as const;
/** The columns of an account row: its company (-1: none), the day it was opened yyyymmdd. */
export const A = { company: 0, day: 1 } as const;

/** Before registering: had the company ever ordered? */
export const STATUS = ["Had never ordered", "Already a customer"] as const;
/** A registered company against its first completed visit - visits are in HubSpot since 2026 */
export const REG_VISIT = ["Registered on the day of a visit", "Registered after a visit", "Visited after registering", "Not visited"] as const;

export type RDim = "person" | "status" | "visit" | "country" | "prio" | "category" | "type" | "band";
export type RFilters = Partial<Record<RDim, string[]>>;
/** A period: this year's months, 0 = January - compared with the same months of the year before (the running month to
 *  the same day). */
export type RWin = { from: number; to: number };

/** A potential the page can use: above zero and up to €1m - higher ones are placeholders (as the customers' cube). */
export const usable = (v: number) => v > 0 && v <= 1_000_000;
export const POTENTIAL_BANDS = ["€100,000 and more", "€25,000 – 99,999", "€2,500 – 24,999", "€500 – 2,499", "Under €500", "Not set"] as const;
export function bandOf(v: number): string {
  if (!usable(v)) return "Not set";
  return v >= 100_000 ? POTENTIAL_BANDS[0] : v >= 25_000 ? POTENTIAL_BANDS[1] : v >= 2_500 ? POTENTIAL_BANDS[2] : v >= 500 ? POTENTIAL_BANDS[3] : POTENTIAL_BANDS[4];
}

/** The customer type in the words the ESO pages use (as their typeLabel). */
const TYPE: Record<string, string> = {
  "Original Equipment Manufacture (OEM)": "OEM", "Turning & Miling Workshop (C2S)": "C2S workshop", "Maintenance, Repair, Operations (MRO)": "MRO",
};
export const typeShort = (k: string) => TYPE[k] ?? k;

/** "2026-03-05" -> 20260305 */
export const ymd = (s: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ""); return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0; };
/** 20260305 -> days since 1970 */
const dayNo = (n: number) => Date.UTC(Math.floor(n / 10000), (Math.floor(n / 100) % 100) - 1, n % 100) / 864e5;
export const daysBetween = (a: number, b: number) => Math.round(dayNo(b) - dayNo(a));

/** The day a side's figures reach: this year the read's day, last year the same day a year earlier - so last year's
 *  registrations had exactly as long to buy as this year's. */
export const cutOf = (d: RegData, side: 0 | 1) => ymd(d.today) - side * 10000;
/** The first and last day of a period on a side (0 this year, 1 the year before), the running month to the same day. */
export function spanOf(d: RegData, win: RWin, side: 0 | 1): { from: number; to: number } {
  const y = d.year - side;
  const last = new Date(Date.UTC(y, win.to + 1, 0)).getUTCDate();
  return { from: y * 10000 + (win.from + 1) * 100 + 1, to: Math.min(y * 10000 + (win.to + 1) * 100 + last, cutOf(d, side)) };
}

/** Before registering: a first order before the day of the first shop account. An order on that day is after it. */
export const statusOf = (co: number[]) => (co[C.firstOrder] && co[C.firstOrder] < co[C.reg] ? STATUS[1] : STATUS[0]);
/** The registration against the company's first completed visit, as far as the side reaches. */
export function visitOf(co: number[], cut: number): (typeof REG_VISIT)[number] {
  const v = co[C.firstVisit], r = co[C.reg];
  if (!v || v > cut) return REG_VISIT[3];
  return v < r ? REG_VISIT[1] : v === r ? REG_VISIT[0] : REG_VISIT[2];
}

const COL: Record<"country" | "prio" | "category" | "type" | "band", number> = { country: C.country, prio: C.prio, category: C.category, type: C.type, band: C.band };
/** A company's value on a breakdown, as its label (the visit as far as the side reaches). */
export function labelOf(d: RegData, co: number[], dim: RDim, cut = cutOf(d, 0)): string {
  if (dim === "person") return d.people[co[C.person]]?.name ?? "Unknown";
  if (dim === "status") return statusOf(co);
  if (dim === "visit") return visitOf(co, cut);
  return d.labels[dim][co[COL[dim]]] ?? "Not set";
}

/** The row an account without a company is read by: no owner, nothing known. */
export function noCompany(d: RegData): number[] {
  const i = d.people.findIndex((p) => p.id === "");
  return [i < 0 ? d.people.length : i, 0, 0, 0, -1, -1, -1, -1, -1];
}

export type RStats = {
  /** companies whose first shop account was opened in the period */
  companies: number;
  /** of those: had ordered before (already a customer) / had never ordered */
  already: number; fresh: number;
  /** of the ones that had never ordered: the first order on the day of registering or after it, by the side's day */
  bought: number;
  /** the days from registering to that first order, one per company that bought */
  days: number[];
  /** the companies against their first visit (REG_VISIT) */
  visit: Record<string, number>;
  /** shop accounts opened in the period, and of them the ones at companies already in the shop before that day */
  accounts: number; more: number;
  /** companies registered per month of the period, from its first */
  months: number[];
};
export const blank = (n: number): RStats => ({ companies: 0, already: 0, fresh: 0, bought: 0, days: [], visit: {}, accounts: 0, more: 0, months: Array(n).fill(0) });

/**
 * A period's figures on one side (0 this year, 1 the year before), for the people shown, under the filters - a
 * breakdown's own filter left out when grouping by it, as the cube does - grouped by a label (all together under "").
 */
export function statsBy(d: RegData, win: RWin, side: 0 | 1, f: RFilters, people: Set<number> | null, key?: RDim): Map<string, RStats> {
  const { from, to } = spanOf(d, win, side);
  const cut = cutOf(d, side);
  const n = win.to - win.from + 1;
  const sets = (Object.keys(f) as RDim[]).filter((k) => k !== key && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  const keep = (co: number[]) => (!people || people.has(co[C.person])) && sets.every(([k, s]) => s.has(labelOf(d, co, k, cut)));
  const out = new Map<string, RStats>();
  const at = (co: number[]) => {
    const k = key ? labelOf(d, co, key, cut) : "";
    let s = out.get(k);
    if (!s) { s = blank(n); out.set(k, s); }
    return s;
  };
  for (const co of d.companies) {
    const r = co[C.reg];
    if (r < from || r > to || !keep(co)) continue;
    const s = at(co);
    s.companies++;
    s.months[(Math.floor(r / 100) % 100) - 1 - win.from]++;
    const v = visitOf(co, cut);
    s.visit[v] = (s.visit[v] ?? 0) + 1;
    if (statusOf(co) === STATUS[1]) { s.already++; continue; }
    s.fresh++;
    const fo = co[C.firstOrder];
    if (fo && fo >= r && fo <= cut) { s.bought++; s.days.push(daysBetween(r, fo)); }
  }
  const none = noCompany(d);
  for (const a of d.accounts) {
    const day = a[A.day];
    if (day < from || day > to) continue;
    const co = a[A.company] >= 0 ? d.companies[a[A.company]] : none;
    if (!co || !keep(co)) continue;
    const s = at(co);
    s.accounts++;
    if (a[A.company] >= 0 && co[C.reg] < day) s.more++;
  }
  return out;
}

/** The middle value, or null with nothing to take it of. */
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// THE ESO REGISTRATIONS PAGE'S RULES - rebuilt like the Visits and the Figures. Every company with a shop account, and
// every shop account opened this year or last, as small rows, so the page works out any period, team, person or filter
// itself. No HubSpot or database here, so the page and the tests read it as it is.
//
// The dates are the shop's own: a contact's Magento "customer since" (the day it registered), a company's first one, and
// the shop's own first order (Magento's "oldest order date" of its accounts). Not the HubSpot contact's creation date -
// 2025 holds about 2,200 contacts created in HubSpot that registered in the shop earlier -, not "Registration Details
// (ESO)", a qualification's answer (SARCLA 28.10.2026: "you are using qualification - we are able to get this
// correctly"), and not the ERP's first order, which counts orders outside the shop (SARCLA 30.10.2026 on "already
// customers - had ordered before registering": "how can they order before creating an account? not possible").

export type RegData = {
  generatedAt: string;
  /** this year; registrations are kept for it and the year before */
  year: number;
  /** the day the read reaches, "2026-10-30" */
  today: string;
  /** the companies' owners, by index - their team from the rosters, else their HubSpot team; "No owner" last */
  people: { id: string; name: string; team: string }[];
  labels: { country: string[]; prio: string[]; category: string[]; type: string[]; apic: string[] };
  /** every company with a shop account opened this year or last - see C */
  companies: number[][];
  /** every shop account opened this year or last - see A */
  accounts: number[][];
  coverage: { accounts: number; noCompany: number; companies: number; visits: number };
};
/** The columns of a company row: its owner; the day its first shop account was opened yyyymmdd; its first order in the
 *  shop yyyymmdd or 0; its first completed customer visit yyyymmdd or 0; its country / priority / category / type / APIC. */
export const C = { person: 0, reg: 1, firstOrder: 2, firstVisit: 3, country: 4, prio: 5, category: 6, type: 7, apic: 8 } as const;
/** The columns of an account row: its company (-1: none), the day it was opened yyyymmdd. */
export const A = { company: 0, day: 1 } as const;

/** A registered company against its first completed visit - visits are in HubSpot since 2026 */
export const REG_VISIT = ["Registered on the day of a visit", "Registered after a visit", "Visited after registering", "Not visited"] as const;

export type RDim = "person" | "visit" | "country" | "prio" | "category" | "type" | "apic";
export type RFilters = Partial<Record<RDim, string[]>>;
/** A period: this year's months, 0 = January - compared with the same months of the year before (the running month to
 *  the same day). With days (SARCLA 31.10.2026: "really custom dates with a mini calendar" - the rows hold the day):
 *  `d0` / `d1` the first / last day yyyymmdd, inside the months `from` / `to`, compared with the same days a year
 *  earlier; left out, the whole month - so a window of whole months is read exactly as before. */
export type RWin = { from: number; to: number; d0?: number; d1?: number };
/** A window with a day of its own on either end. */
export const hasDays = (w: RWin) => !!(w.d0 || w.d1);

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
/** The last day of a month (0 = January). */
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
/** A day this year, on a side: the same day a year earlier - 29 February, which the year before has not, its 28th. */
const sameDay = (n: number, side: 0 | 1) => {
  if (!side) return n;
  const y = Math.floor(n / 10000) - 1, m = (Math.floor(n / 100) % 100) - 1;
  return y * 10000 + (m + 1) * 100 + Math.min(n % 100, lastDay(y, m));
};
/** The first and last day of a period on a side (0 this year, 1 the year before), the running month to the same day; a
 *  window's own days the same days a year earlier. */
export function spanOf(d: RegData, win: RWin, side: 0 | 1): { from: number; to: number } {
  const y = d.year - side;
  const from = win.d0 ? sameDay(win.d0, side) : y * 10000 + (win.from + 1) * 100 + 1;
  const to = win.d1 ? sameDay(win.d1, side) : y * 10000 + (win.to + 1) * 100 + lastDay(y, win.to);
  return { from, to: Math.min(to, cutOf(d, side)) };
}

/* ── the period in the address: ?from=2026-03&to=2026-05 (whole months) or ?from=2026-03-05&to=2026-05-17 (days) ── */

const ADDRESS = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;
/** One end of the address, this year's only: a month (0 = January), with its day yyyymmdd when it names one. */
function endOf(d: RegData, s: string | null): { m: number; day?: number } | null {
  const x = ADDRESS.exec(s ?? "");
  if (!x || Number(x[1]) !== d.year) return null;
  const m = Number(x[2]) - 1;
  if (m < 0 || m > 11) return null;
  if (!x[3]) return { m };
  const day = Number(x[3]);
  return day >= 1 && day <= lastDay(d.year, m) ? { m, day: d.year * 10000 + (m + 1) * 100 + day } : null;
}
/**
 * The window an address asks for - either end a month or a day, in either order; null when an end is missing or not
 * this year's (the page then shows the year to date, as before). Nothing after the read's day: a last day after it is
 * the read's day, a first after it the running month's 1st. A day on a month's edge is the whole month - the 1st as the
 * first, the month's last or the read's day as the last ("to date", as the quick picks) -, so 1 Jan to the read's day
 * is the year to date, and a range of whole months picked by the day reads as the months.
 */
export function winOf(d: RegData, from: string | null, to: string | null): RWin | null {
  let a = endOf(d, from), b = endOf(d, to);
  if (!a || !b) return null;
  const first = (e: { m: number; day?: number }) => e.day ?? d.year * 10000 + (e.m + 1) * 100 + 1;
  const last = (e: { m: number; day?: number }) => e.day ?? d.year * 10000 + (e.m + 1) * 100 + lastDay(d.year, e.m);
  if (first(a) > last(b)) [a, b] = [b, a];
  const today = ymd(d.today), month = (n: number) => (Math.floor(n / 100) % 100) - 1;
  let lo = first(a), hi = Math.min(last(b), today);
  if (lo > today) lo = Math.floor(today / 100) * 100 + 1;
  const w: RWin = { from: month(lo), to: month(hi) };
  if (lo % 100 !== 1) w.d0 = lo;
  if (hi !== today && hi % 100 !== lastDay(d.year, month(hi))) w.d1 = hi;
  return w;
}
/** 20260305 -> "2026-03-05" */
export const isoOf = (n: number) => `${Math.floor(n / 10000)}-${String(Math.floor(n / 100) % 100).padStart(2, "0")}-${String(n % 100).padStart(2, "0")}`;
/** A window as the address keeps it: "2026-03" for a whole month's end, "2026-03-05" for a day's. */
export function addressOf(d: RegData, w: RWin): { from: string; to: string } {
  const month = (m: number) => `${d.year}-${String(m + 1).padStart(2, "0")}`;
  return { from: w.d0 ? isoOf(w.d0) : month(w.from), to: w.d1 ? isoOf(w.d1) : month(w.to) };
}

/** The registration against the company's first completed visit, as far as the side reaches. */
export function visitOf(co: number[], cut: number): (typeof REG_VISIT)[number] {
  const v = co[C.firstVisit], r = co[C.reg];
  if (!v || v > cut) return REG_VISIT[3];
  return v < r ? REG_VISIT[1] : v === r ? REG_VISIT[0] : REG_VISIT[2];
}

const COL: Record<"country" | "prio" | "category" | "type" | "apic", number> = { country: C.country, prio: C.prio, category: C.category, type: C.type, apic: C.apic };
/** A company's value on a breakdown, as its label (the visit as far as the side reaches). */
export function labelOf(d: RegData, co: number[], dim: RDim, cut = cutOf(d, 0)): string {
  if (dim === "person") return d.people[co[C.person]]?.name ?? "Unknown";
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
  /** of those: the first order in the shop, by the side's day */
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
export const blank = (n: number): RStats => ({ companies: 0, bought: 0, days: [], visit: {}, accounts: 0, more: 0, months: Array(n).fill(0) });

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
    // the shop's first order is on the day of registering or after it - an account comes first
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

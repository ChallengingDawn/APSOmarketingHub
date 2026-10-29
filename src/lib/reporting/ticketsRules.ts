// THE ESO TICKETS PAGE'S RULES (SARCLA 29.10.2026: "work on ESO Reports > Tickets" - his pick: rebuild like Visits, for
// one question: tickets -> orders, per person). Every ticket of the ESO pipeline as one small row, so the page works out
// any period, team, person or filter itself. No HubSpot or database here, so the page and the tests read it as it is.
//
//   what     the ESO pipeline's tickets, sorted as the Hand-over to ESO/TSA page sorts them (handoverCube.classify,
//            SARCLA 19.10): customer requests, lifecycle hand-overs - and here also the pushes and campaigns typed in
//            for the ESO (erosion, win back, the September push, price checks, GQS sales follow-ups), which the
//            Hand-over page leaves out. Left out as there: not a sales topic, misassigned, Bisphenol, auto-logged and
//            Finance mails, special price requests - and the new registrants to qualify (they end qualified, not ordered)
//   ordered  closed as Ordered, a one-shot order or a one-shot C2S order ("only ordered counts as ordered", 19.10)
//   rate     ordered of the tickets closed with a resolution - the open ones are not decided yet
//   when     the month the ticket came in; its owner today

import { CHANNELS, ORDERED, classify, type TicketIn } from "../marketingKpis/handoverCube";
import { CATEGORY_BANDS, PRIO_BANDS } from "./esoRules";

/** A company potential the page can use: above zero and up to €1m - higher ones are placeholders (as the customers' cube). */
export const usable = (v: number) => v > 0 && v <= 1_000_000;
export const POTENTIAL_BANDS = ["€100,000 and more", "€25,000 – 99,999", "€2,500 – 24,999", "€500 – 2,499", "Under €500", "Not set"] as const;
/** The ticket's company's yearly potential, in bands - a placeholder counts as not set. */
export function bandOf(v: number): string {
  if (!usable(v)) return "Not set";
  return v >= 100_000 ? POTENTIAL_BANDS[0] : v >= 25_000 ? POTENTIAL_BANDS[1] : v >= 2_500 ? POTENTIAL_BANDS[2] : v >= 500 ? POTENTIAL_BANDS[3] : POTENTIAL_BANDS[4];
}

export type TicketsData = {
  generatedAt: string;
  /** this year; tickets are kept for it and the year before */
  year: number;
  /** the day the read reaches, "2026-10-29" */
  today: string;
  /** the ticket owners, by index - their team from the rosters, else their HubSpot team */
  people: { id: string; name: string; team: string }[];
  labels: { kind: string[]; channel: string[]; prio: string[]; category: string[]; country: string[]; band: string[] };
  /** one row per ticket - see T */
  tickets: number[][];
  coverage: { read: number; kept: number; withCompany: number; left: Record<string, number> };
};
/** The columns of a ticket row: who owns it, when it came in, its kind and where it came from, its company's priority /
 *  category / country / potential band, where it stands (STATE), its value (the ticket's Sales Potential €, 0: none). */
export const T = { person: 0, year: 1, month: 2, day: 3, kind: 4, channel: 5, prio: 6, category: 7, country: 8, band: 9, state: 10, value: 11 } as const;
/** Where a ticket stands: still open, closed with a resolution that is not an order, ordered, closed with no resolution. */
export const STATE = { open: 0, lost: 1, ordered: 2, nores: 3 } as const;

/* ── what a ticket is ──────────────────────────────────────────────────── */

export const KINDS = ["Customer requests", "Lifecycle hand-overs", "Pushes & campaigns"] as const;
/** The pushes and campaigns, by their subject - in the order the page shows them. */
export const PUSHES = ["Erosion", "Win back", "September push", "Price check", "GQS sales follow-up", "Other, typed in by hand"] as const;
/** Where a ticket came from, in the order the page shows them: the Hand-over page's channels, then the pushes. */
export const CHANNEL_ORDER: readonly string[] = [...CHANNELS.filter((c) => c.kind !== "newlead").map((c) => c.label), ...PUSHES];

/** A push or campaign by its subject ("EROSION | …", "Win Back Action | …", "SEPT PUSH | …"). */
export function pushOf(subject: string | null | undefined): (typeof PUSHES)[number] {
  const s = (subject ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (s.includes("EROSION")) return PUSHES[0];
  if (s.startsWith("WIN BACK")) return PUSHES[1];
  if (s.includes("SEPT PUSH")) return PUSHES[2];
  if (s.startsWith("PRICE CHECK")) return PUSHES[3];
  if (s.startsWith("GQS SALES FOLLOW")) return PUSHES[4];
  return PUSHES[5];
}

/** A ticket's kind and where it came from - or why the page leaves it out. `lifecycle` names the workflows that make the
 *  lifecycle tickets (as the Hand-over page reads them). */
export function kindOf(t: TicketIn, lifecycle: Record<string, string>): { kind: (typeof KINDS)[number]; channel: string } | { skip: string } {
  const what = classify(t, lifecycle);
  if ("skip" in what) return what.skip === "campaign or typed in by hand" ? { kind: KINDS[2], channel: pushOf(t.subject) } : { skip: what.skip };
  // a new registrant is won when qualified, never ordered (SARCLA 19.10) - not a ticket that can end in an order
  if (what.g === "newlead") return { skip: "new registrant to qualify" };
  return { kind: what.g === "request" ? KINDS[0] : KINDS[1], channel: CHANNELS.find((c) => c.id === what.c)?.label ?? what.c };
}

/** Where a ticket stands: open, or closed - ordered, with another resolution, or with none. */
export function stateOf(closed: boolean, resolution: string | null | undefined): number {
  if (!closed) return STATE.open;
  const r = (resolution ?? "").trim();
  return !r ? STATE.nores : ORDERED.has(r) ? STATE.ordered : STATE.lost;
}

/* ── the rows of a period ──────────────────────────────────────────────── */

/** A period: this year's months, 0 = January (or last year's with year 1). */
export type TWin = { from: number; to: number; year?: 0 | 1 };
export type TDim = "person" | "kind" | "channel" | "prio" | "category" | "country" | "band";
export type TFilters = Partial<Record<TDim, string[]>>;

const COL: Record<Exclude<TDim, "person">, number> = { kind: T.kind, channel: T.channel, prio: T.prio, category: T.category, country: T.country, band: T.band };
/** A row's value on a breakdown, as its label. */
export function labelOf(d: TicketsData, row: number[], dim: TDim): string {
  if (dim === "person") return d.people[row[T.person]]?.name ?? "Unknown";
  return d.labels[dim][row[COL[dim]]] ?? "Not set";
}

/** The tickets of a period, under the filters - a breakdown's own filter left out when grouping by it, as the cube does. */
export function rowsOf(d: TicketsData, win: TWin, f: TFilters, people: Set<number> | null, except?: TDim): number[][] {
  const y = win.year ?? 0;
  const sets = (Object.keys(f) as TDim[]).filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  return d.tickets.filter((r) => r[T.year] === y && r[T.month] >= win.from && r[T.month] <= win.to
    && (!people || people.has(r[T.person]))
    && sets.every(([k, s]) => s.has(labelOf(d, r, k))));
}

export type TStats = {
  tickets: number;
  /** closed with a resolution - the base of the order rate */
  resolved: number;
  ordered: number;
  open: number;
  /** closed with no resolution set */
  nores: number;
  /** the value of the tickets that ended in an order, and of those still open */
  value: number; openValue: number;
  /** per month of the period, from its first: tickets, ordered, closed with a resolution */
  months: number[]; monthsOrdered: number[]; monthsResolved: number[];
};
/** No tickets: every figure zero, n months. */
export const blank = (n: number): TStats => ({ tickets: 0, resolved: 0, ordered: 0, open: 0, nores: 0, value: 0, openValue: 0, months: Array(n).fill(0), monthsOrdered: Array(n).fill(0), monthsResolved: Array(n).fill(0) });

/** The order rate: ordered of the tickets closed with a resolution; null with none closed. */
export const rateOf = (s: Pick<TStats, "ordered" | "resolved">) => (s.resolved ? s.ordered / s.resolved : null);

/** The figures of a set of tickets, grouped by a label (all together under ""). */
export function statsBy(rows: number[][], win: TWin, key: (r: number[]) => string = () => ""): Map<string, TStats> {
  const out = new Map<string, TStats>();
  const n = win.to - win.from + 1;
  for (const r of rows) {
    const k = key(r);
    let s = out.get(k);
    if (!s) { s = blank(n); out.set(k, s); }
    const m = r[T.month] - win.from;
    s.tickets++;
    s.months[m]++;
    const st = r[T.state];
    if (st === STATE.open) { s.open++; s.openValue += r[T.value]; }
    else if (st === STATE.nores) s.nores++;
    else {
      s.resolved++;
      s.monthsResolved[m]++;
      if (st === STATE.ordered) { s.ordered++; s.monthsOrdered[m]++; s.value += r[T.value]; }
    }
  }
  return out;
}

/** Last year's same months can be set beside this year's only when each of them held enough tickets: the ESO pipeline
 *  began in July 2025 (before it, a handful a month), so a year to date against 2025's would compare a pipeline with
 *  an empty one. */
export const PY_MIN = 50;
export function comparable(d: TicketsData, win: TWin, people: Set<number> | null): boolean {
  const per = Array(12).fill(0);
  for (const r of d.tickets) if (r[T.year] === 1 && (!people || people.has(r[T.person]))) per[r[T.month]]++;
  for (let m = win.from; m <= win.to; m++) if (per[m] < PY_MIN) return false;
  return true;
}

/** The labels a read starts from, in the order the page shows them; countries are added as they come. */
export const startLabels = (): TicketsData["labels"] => ({
  kind: [...KINDS], channel: [...CHANNEL_ORDER], prio: [...PRIO_BANDS], category: [...CATEGORY_BANDS], country: [], band: [...POTENTIAL_BANDS],
});

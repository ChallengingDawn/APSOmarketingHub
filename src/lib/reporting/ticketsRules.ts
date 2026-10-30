// THE ESO TICKETS PAGES' RULES (SARCLA 29.10.2026: "work on ESO Reports > Tickets" - rebuilt like Visits; 30.10.2026:
// "split in 2 apps - Incoming tickets and System tickets", "diagram paths like in Digital Growth", "from where they come,
// how we handle them by time and types of activity, and the win rate", "win rate per use case", "closed without any
// activity", "call it win rate", the potential and the figures out). Every ticket of the ESO pipeline as one small row,
// so the pages work out any period, team, person or filter themselves. No HubSpot or database here.
//
//   incoming  the customers' requests, as Hand-over to ESO/TSA sorts them (handoverCube.classify, SARCLA 19.10): a
//             website form, the chat, an e-mail, a request the ESO typed in, one redirected from Back Office, the helpline
//   system    what a workflow or a push hands the ESO: the UC hand-overs (new registrants, lost leads, second purchase,
//             poor rating, abandoned cart) and the pushes and campaigns typed in for the ESO (erosion, win back, the
//             September push, price checks, GQS sales follow-ups)
//   left out  as on Hand-over: not a sales topic, misassigned, Bisphenol, auto-logged and Finance mails, special prices
//   won       closed as Ordered or a one-shot order - a new registrant when closed Qualified (handoverCube.outcomeOf);
//             the win rate: of the tickets closed with a resolution
//   contact   the first thing the team did towards the customer: a reply in the ticket, an e-mail sent, a call or a
//             meeting - in working hours, Monday to Friday 8-17 Zurich, from the moment the ticket came in
//   activity  anything the team logged on the ticket: those, and a note or a task. Closed without any activity: none.

import { CHANNELS, OUTCOMES, classify, outcomeOf, type Outcome, type TicketIn } from "../marketingKpis/handoverCube";
import { PRIO_BANDS } from "./esoRules";

export type TicketsData = {
  generatedAt: string;
  /** this year; tickets are kept for it and the year before */
  year: number;
  /** the day the read reaches, "2026-10-30" */
  today: string;
  /** the ticket owners, by index - their team from the rosters, else their HubSpot team */
  people: { id: string; name: string; team: string }[];
  labels: { channel: string[]; prio: string[]; category: string[]; country: string[] };
  /** one row per ticket - see T */
  tickets: number[][];
  coverage: { read: number; kept: number; withCompany: number; left: Record<string, number> };
};
/** The columns of a ticket row: who owns it, when it came in, incoming (0) or system (1), where it came from, its
 *  company's priority / category / country, what became of it (OUTCOMES), the working hours to the first contact x10
 *  (-1: none), what that contact was (FIRST, -1: none), the e-mails sent, calls, meetings, and notes and tasks on it. */
export const T = { person: 0, year: 1, month: 2, day: 3, group: 4, channel: 5, prio: 6, category: 7, country: 8, outcome: 9, firstH: 10, first: 11, emails: 12, calls: 13, meetings: 14, notes: 15 } as const;

export const GROUPS = ["Incoming tickets", "System tickets"] as const;
export type TGroup = "incoming" | "system";
export const groupIndex = (g: TGroup) => (g === "incoming" ? 0 : 1);

/* ── what a ticket is ──────────────────────────────────────────────────── */

/** The pushes and campaigns, by their subject - in the order the page shows them. */
export const PUSHES = ["Erosion", "Win back", "September push", "Price check", "GQS sales follow-up", "Other, typed in by hand"] as const;
/** Where a ticket came from, in the order the pages show them: the requests' channels, then the UC hand-overs and the pushes. */
export const CHANNEL_ORDER: readonly string[] = [...CHANNELS.map((c) => c.label), ...PUSHES];

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

/** A ticket's group, where it came from and whether it is a new registrant to qualify - or why the pages leave it out.
 *  `lifecycle` names the workflows that make the lifecycle tickets (as the Hand-over page reads them). */
export function kindOf(t: TicketIn, lifecycle: Record<string, string>): { group: TGroup; channel: string; newLead: boolean } | { skip: string } {
  const what = classify(t, lifecycle);
  if ("skip" in what) return what.skip === "campaign or typed in by hand" ? { group: "system", channel: pushOf(t.subject), newLead: false } : { skip: what.skip };
  return { group: what.g === "request" ? "incoming" : "system", channel: CHANNELS.find((c) => c.id === what.c)?.label ?? what.c, newLead: what.g === "newlead" };
}

/** What became of a ticket, as an index into OUTCOMES: won, lost and why, closed otherwise, with no resolution, open. */
export function outcomeIndex(closed: boolean, resolution: string | null | undefined, newLead: boolean): number {
  return OUTCOMES.findIndex((o) => o.id === outcomeOf({ g: newLead ? "newlead" : "request", x: closed ? 1 : 0, r: (resolution ?? "").trim() }));
}

/** What the first contact was. */
export const FIRST = ["Reply in the ticket", "E-mail sent", "Call", "Meeting"] as const;
/** How fast the first contact came, in working hours - and none. */
export const SPEEDS = ["Within a working day", "Within 3 working days", "Later", "No contact"] as const;
export const DAY_HOURS = 9;
export function speedOf(hours: number | null): number {
  return hours == null ? 3 : hours <= DAY_HOURS ? 0 : hours <= 3 * DAY_HOURS ? 1 : 2;
}

/** The first contact of a ticket: the earliest of the team's moves towards the customer after it came in. */
export function firstContact(created: number, moves: { at: number | null; kind: number }[]): { at: number; kind: number } | null {
  let best: { at: number; kind: number } | null = null;
  for (const m of moves) if (m.at != null && m.at >= created && (!best || m.at < best.at)) best = { at: m.at, kind: m.kind };
  return best;
}

/* ── the rows of a period ──────────────────────────────────────────────── */

/** A period: this year's months, 0 = January (or last year's with year 1). */
export type TWin = { from: number; to: number; year?: 0 | 1 };
export type TDim = "person" | "channel" | "prio" | "category" | "country";
export type TFilters = Partial<Record<TDim, string[]>>;

const COL: Record<Exclude<TDim, "person">, number> = { channel: T.channel, prio: T.prio, category: T.category, country: T.country };
/** A row's value on a breakdown, as its label. */
export function labelOf(d: TicketsData, row: number[], dim: TDim): string {
  if (dim === "person") return d.people[row[T.person]]?.name ?? "Unknown";
  return d.labels[dim][row[COL[dim]]] ?? "Not set";
}

/** A group's tickets of a period, under the filters - a breakdown's own filter left out when grouping by it. */
export function rowsOf(d: TicketsData, group: TGroup, win: TWin, f: TFilters, people: Set<number> | null, except?: TDim): number[][] {
  const y = win.year ?? 0, g = groupIndex(group);
  const sets = (Object.keys(f) as TDim[]).filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  return d.tickets.filter((r) => r[T.group] === g && r[T.year] === y && r[T.month] >= win.from && r[T.month] <= win.to
    && (!people || people.has(r[T.person]))
    && sets.every(([k, s]) => s.has(labelOf(d, r, k))));
}

const OPEN = OUTCOMES.findIndex((o) => o.id === "open");
const NORES = OUTCOMES.findIndex((o) => o.id === "nores");
const WON = OUTCOMES.findIndex((o) => o.id === "won");
/** The lost: price, can't supply, delivery, only info, no reply, disqualified. */
export const LOST_IDS: readonly Outcome[] = ["price", "supply", "delivery", "info", "noreply", "disq"];

export type TStats = {
  tickets: number; closed: number;
  /** closed with a resolution - the base of the win rate */
  resolved: number; won: number; open: number;
  outcomes: number[];
  /** how fast the first contact came (SPEEDS), and the won and the decided of each */
  speed: number[]; speedWon: number[]; speedResolved: number[];
  /** what the first contact was (FIRST), and the won and the decided of each */
  first: number[]; firstWon: number[]; firstResolved: number[];
  /** the working hours to each first contact, for the median */
  hours: number[];
  /** closed with nothing logged on them at all */
  quiet: number;
  /** what the team logged: e-mails sent, calls, meetings, notes and tasks - and on how many tickets each */
  emails: number; calls: number; meetings: number; notes: number; withEmails: number; withCalls: number; withMeetings: number; withNotes: number;
  /** per month of the period, from its first */
  months: number[]; monthsWon: number[]; monthsResolved: number[]; monthsInDay: number[]; monthsQuiet: number[]; monthsClosed: number[];
};
const zeros = (n: number) => Array(n).fill(0) as number[];
/** No tickets: every figure zero, n months. */
export const blank = (n: number): TStats => ({
  tickets: 0, closed: 0, resolved: 0, won: 0, open: 0, outcomes: zeros(OUTCOMES.length),
  speed: zeros(4), speedWon: zeros(4), speedResolved: zeros(4), first: zeros(FIRST.length), firstWon: zeros(FIRST.length), firstResolved: zeros(FIRST.length), hours: [],
  quiet: 0, emails: 0, calls: 0, meetings: 0, notes: 0, withEmails: 0, withCalls: 0, withMeetings: 0, withNotes: 0,
  months: zeros(n), monthsWon: zeros(n), monthsResolved: zeros(n), monthsInDay: zeros(n), monthsQuiet: zeros(n), monthsClosed: zeros(n),
});

/** The win rate: won of the tickets closed with a resolution; null with none closed. */
export const rateOf = (s: Pick<TStats, "won" | "resolved">) => (s.resolved ? s.won / s.resolved : null);
/** Contacted within a working day, of all the tickets. */
export const inDayOf = (s: Pick<TStats, "speed" | "tickets">) => (s.tickets ? s.speed[0] / s.tickets : null);
/** Closed without any activity, of the closed. */
export const quietOf = (s: Pick<TStats, "quiet" | "closed">) => (s.closed ? s.quiet / s.closed : null);

export function median(xs: number[]): number | null {
  const v = [...xs].sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** A row did something: a contact, or a note or a task. */
const active = (r: number[]) => r[T.first] >= 0 || r[T.emails] + r[T.calls] + r[T.meetings] + r[T.notes] > 0;

/** The figures of a set of tickets, grouped by a label (all together under ""). */
export function statsBy(rows: number[][], win: TWin, key: (r: number[]) => string = () => ""): Map<string, TStats> {
  const out = new Map<string, TStats>();
  const n = win.to - win.from + 1;
  for (const r of rows) {
    const k = key(r);
    let s = out.get(k);
    if (!s) { s = blank(n); out.set(k, s); }
    const m = r[T.month] - win.from;
    const o = r[T.outcome];
    const closed = o !== OPEN;
    const decided = closed && o !== NORES;
    const won = o === WON;
    const hours = r[T.firstH] >= 0 ? r[T.firstH] / 10 : null;
    const sp = speedOf(hours);
    s.tickets++; s.months[m]++;
    s.outcomes[o]++;
    s.speed[sp]++;
    if (sp === 0) s.monthsInDay[m]++;
    if (hours != null) s.hours.push(hours);
    if (r[T.first] >= 0) s.first[r[T.first]]++;
    if (closed) { s.closed++; s.monthsClosed[m]++; if (!active(r)) { s.quiet++; s.monthsQuiet[m]++; } }
    else s.open++;
    if (decided) {
      s.resolved++; s.monthsResolved[m]++; s.speedResolved[sp]++;
      if (r[T.first] >= 0) s.firstResolved[r[T.first]]++;
      if (won) { s.won++; s.monthsWon[m]++; s.speedWon[sp]++; if (r[T.first] >= 0) s.firstWon[r[T.first]]++; }
    }
    s.emails += r[T.emails]; s.calls += r[T.calls]; s.meetings += r[T.meetings]; s.notes += r[T.notes];
    if (r[T.emails]) s.withEmails++;
    if (r[T.calls]) s.withCalls++;
    if (r[T.meetings]) s.withMeetings++;
    if (r[T.notes]) s.withNotes++;
  }
  return out;
}

/** Last year's same months beside this year's only when each of them held enough of the group's tickets: the ESO pipeline
 *  began in July 2025, so a year to date against 2025's would compare a pipeline with an empty one. */
export const PY_MIN = 50;
export function comparable(d: TicketsData, group: TGroup, win: TWin, people: Set<number> | null): boolean {
  const per = zeros(12), g = groupIndex(group);
  for (const r of d.tickets) if (r[T.year] === 1 && r[T.group] === g && (!people || people.has(r[T.person]))) per[r[T.month]]++;
  for (let m = win.from; m <= win.to; m++) if (per[m] < PY_MIN) return false;
  return true;
}

/* ── the path: where they came from, how fast the first contact came, what became of them, why ── */

export type TFlowNode = { id: string; column: number; label: string; tone: "source" | "good" | "bad" | "none" };
export type TFlow = { columns: string[]; nodes: TFlowNode[]; links: { from: string; to: string; value: number }[] };
/** A reason the path names: 2% of the tickets or more - the rest are "Other reasons" (as Hand-over: "simplify"). */
const NAMED_SHARE = 0.02;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const lostLabel = (id: Outcome) => cap(OUTCOMES.find((o) => o.id === id)!.label.replace(/^Lost - /, ""));

export function flowOf(d: TicketsData, rows: number[][]): TFlow {
  const ids = OUTCOMES.map((o) => o.id);
  const lostCount = new Map<Outcome, number>();
  for (const r of rows) { const o = ids[r[T.outcome]]; if (LOST_IDS.includes(o)) lostCount.set(o, (lostCount.get(o) ?? 0) + 1); }
  const named = (o: Outcome) => (lostCount.get(o) ?? 0) >= rows.length * NAMED_SHARE;
  const nodes = new Map<string, TFlowNode>(), links = new Map<string, { from: string; to: string; value: number }>();
  for (const r of rows) {
    const o = ids[r[T.outcome]];
    const sp = speedOf(r[T.firstH] >= 0 ? r[T.firstH] / 10 : null);
    const path: TFlowNode[] = [
      { id: `c:${r[T.channel]}`, column: 0, label: labelOf(d, r, "channel"), tone: "source" },
      { id: `s:${sp}`, column: 1, label: SPEEDS[sp], tone: sp === 0 ? "good" : sp === 3 ? "bad" : "none" },
      o === "won" ? { id: "o:won", column: 2, label: "Won", tone: "good" }
        : o === "open" ? { id: "o:open", column: 2, label: "Still open", tone: "none" }
          : LOST_IDS.includes(o) ? { id: "o:lost", column: 2, label: "Lost or disqualified", tone: "bad" }
            : o === "nores" ? { id: "o:nores", column: 2, label: "Closed without a resolution", tone: "none" }
              : { id: "o:other", column: 2, label: "Closed otherwise", tone: "none" },
    ];
    if (LOST_IDS.includes(o)) path.push(named(o) ? { id: `w:${o}`, column: 3, label: lostLabel(o), tone: "bad" } : { id: "w:more", column: 3, label: "Other reasons", tone: "bad" });
    for (const nd of path) nodes.set(nd.id, nd);
    for (let i = 0; i + 1 < path.length; i++) {
      const k = `${path[i].id}>${path[i + 1].id}`;
      const l = links.get(k) ?? { from: path[i].id, to: path[i + 1].id, value: 0 };
      l.value++;
      links.set(k, l);
    }
  }
  const order = (nd: TFlowNode) => (nd.column === 0 ? CHANNEL_ORDER.indexOf(nd.label) : nd.column === 1 ? Number(nd.id.slice(2)) : nd.column === 2 ? ["o:won", "o:lost", "o:other", "o:nores", "o:open"].indexOf(nd.id) : nd.id === "w:more" ? 99 : LOST_IDS.indexOf(nd.id.slice(2) as Outcome));
  return {
    columns: ["Came from", "First contact", "Outcome", "Why lost"],
    nodes: [...nodes.values()].sort((a, b) => a.column - b.column || order(a) - order(b)),
    links: [...links.values()],
  };
}

/** The labels a read starts from, in the order the pages show them; categories and countries are added as they come. */
export const startLabels = (): TicketsData["labels"] => ({ channel: [...CHANNEL_ORDER], prio: [...PRIO_BANDS], category: [], country: [] });

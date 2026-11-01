// THE ESO TICKETS PAGES' RULES (SARCLA 29.10.2026: "work on ESO Reports > Tickets" - rebuilt like Visits; 30.10.2026:
// "split in 2 apps - Incoming tickets and System tickets", "diagram paths like in Digital Growth", "from where they come,
// how we handle them by time and types of activity, and the win rate", "win rate per use case", "closed without any
// activity", "call it win rate", the potential and the figures out; 31.10.2026: e-mail and the Back Office redirects as
// one channel - "if they come per mail they come more often via the BO" -, "the breakdown by resolutions", "resolution
// per owner and also the resolution texts", no meetings among what was logged; "Bought at AP should count as lost as
// well", "GQS sales follow-up is not a system ticket, it's a sales ticket", "Other, typed in by hand should not exist -
// give it the real reason"; 01.11.2026: the potential back as a tab of its own - "the ticket value funnel on the pipeline
// with the confidence score"; then "move the tickets also to TSA, all for all in ESO as well": the TSA pipeline read too,
// ESO | TSA | Total on both). Every ticket of the ESO and TSA pipelines as one small row, so the pages work out any period, team,
// person or filter themselves. No HubSpot or database here.
//
//   incoming  the customers' requests, as Hand-over to ESO/TSA sorts them (handoverCube.classify, SARCLA 19.10): a
//             website form, the chat, an e-mail (direct or redirected from Back Office), a request the ESO typed in, the
//             helpline - and Sales' follow-ups and special requests through GQS
//   system    what a workflow or a push hands the ESO: the UC hand-overs (new registrants, the qualified ones with no
//             order 30 days on, lost leads, second purchase, poor rating, abandoned cart) and the pushes (erosion, win
//             back, the September push, price checks)
//   left out  as on Hand-over: not a sales topic, misassigned, Bisphenol, auto-logged and Finance mails, special prices;
//             and the workflows' tests and the internal tickets (product management, reviews)
//   won       closed as Ordered or a one-shot order - a new registrant when closed Qualified (handoverCube.outcomeOf);
//             the win rate: of the tickets closed with a resolution. "Bought at AP" is lost: the order went to
//             Angst+Pfister, not to us (as on the erosion tickets since 04.10)
//   contact   the first thing the team did towards the customer: a reply in the ticket, an e-mail sent, a call or a
//             meeting - in working hours, Monday to Friday 8-17 Zurich, from the moment the ticket came in
//   activity  anything the team logged on the ticket: those, and a note or a task. Closed without any activity: none.

import { CHANNELS, OUTCOMES, classify, outcomeOf, type Outcome, type TicketIn } from "../marketingKpis/handoverCube";
import { PRIO_BANDS } from "./esoRules";

export type TicketsData = {
  generatedAt: string;
  /** this year; tickets are kept for it and the year before */
  year: number;
  /** the day the read reaches, "2026-10-31" */
  today: string;
  /** the ticket owners, by index - their team from the rosters, else their HubSpot team */
  people: { id: string; name: string; team: string }[];
  /** stage: the ESO pipeline's stages in its order (reads before 01.11.2026 have none) */
  labels: { channel: string[]; prio: string[]; category: string[]; country: string[]; resolution: string[]; stage?: string[] };
  /** one row per ticket - see T */
  tickets: number[][];
  /** "More information about the ticket resolution" as the owner wrote it, this year's tickets: row index -> text */
  texts: Record<string, string>;
  /** the tickets' companies by index (T.company): their HubSpot ids and names - a graph's "Companies" list */
  companyIds?: string[]; companyNames?: string[];
  coverage: { read: number; kept: number; withCompany: number; left: Record<string, number> };
};
/** The columns of a ticket row: who owns it, when it came in, incoming (0) or system (1), where it came from, its
 *  company's priority / category / country, what became of it (TOUTCOMES), the working hours to the first contact x10
 *  (-1: none), what that contact was (FIRST, -1: none), the e-mails sent, calls, meetings, notes and tasks on it, and
 *  the resolution as set (an index into labels.resolution; -1: none or still open), its company (an index into companyIds
 *  and companyNames; -1: none), its potential - the Sales potential estimate in whole EUR (0: none) and how sure it is
 *  (CONFS; -1: no value) - the stage it stands in now (labels.stage), and its pipeline (PIPES: 0 ESO, 1 TSA). */
export const T = { person: 0, year: 1, month: 2, day: 3, group: 4, channel: 5, prio: 6, category: 7, country: 8, outcome: 9, firstH: 10, first: 11, emails: 12, calls: 13, meetings: 14, notes: 15, resolution: 16, company: 17, value: 18, conf: 19, stage: 20, pipe: 21 } as const;

export const GROUPS = ["Incoming tickets", "System tickets"] as const;
export type TGroup = "incoming" | "system";
export const groupIndex = (g: TGroup) => (g === "incoming" ? 0 : 1);

/* ── what a ticket is ──────────────────────────────────────────────────── */

/** An e-mail to the ESO and an e-mail redirected from Back Office are one channel: a customer who writes mostly writes to
 *  Back Office first (SARCLA 31.10.2026). */
export const MAIL = "E-mail, direct or via Back Office";
const MERGED: Record<string, string> = { "E-mail": MAIL, "Redirected from Back Office": MAIL };
const DIRECT = "Direct request to the ESO";
/** The same on the TSA pipeline (SARCLA 01.11.2026: the tickets in TSA Reports too). */
export const DIRECT_TSA = "Direct request to the TSA";
/** The pipelines the pages read - T.pipe is the index (SARCLA 01.11.2026: "move the tickets also to TSA ... all for all
 *  in ESO as well"). */
export const PIPES = ["ESO", "TSA"] as const;
export type TPipe = (typeof PIPES)[number];
/** Sales asking the ESO to follow up an offer, or a special request, through GQS: a sales ticket - a request like the
 *  customers', never a system one (SARCLA 31.10.2026). */
export const FROM_SALES = "From Sales (GQS)";
/** The UC2 workflow's second ticket: a qualified new lead with no order 30 days on ("Qualified Lead | … | No Order in the
 *  first 30 days"). */
export const NO_ORDER = "Qualified, no order in 30 days (UC2)";
/** The pushes, by their subject - in the order the page shows them. */
export const PUSHES = ["Erosion", "Win back", "September push", "Price check"] as const;
/** Where a ticket came from, in the order the pages show them: the requests' channels and Sales, then the UC hand-overs
 *  and the pushes. */
export const CHANNEL_ORDER: readonly string[] = [
  ...new Set(CHANNELS.filter((c) => c.kind === "request").flatMap((c) => (c.label === DIRECT ? [DIRECT, DIRECT_TSA] : [MERGED[c.label] ?? c.label]))), FROM_SALES,
  ...CHANNELS.filter((c) => c.kind !== "request").flatMap((c) => (c.id === "uc2" ? [c.label, NO_ORDER] : [c.label])), ...PUSHES,
];

/** A push by its subject ("EROSION | …", "Win Back Action | …", "SEPT PUSH | …", "PRICE CHECK | …" and the low-margin
 *  checks of 2025) - none: not a push. */
export function pushOf(subject: string | null | undefined): (typeof PUSHES)[number] | null {
  const s = (subject ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (s.includes("EROSION")) return PUSHES[0];
  if (s.startsWith("WIN BACK")) return PUSHES[1];
  if (s.includes("SEPT PUSH")) return PUSHES[2];
  if (s.startsWith("PRICE CHECK") || /^LOW (MAR|PRICE)/.test(s)) return PUSHES[3];
  return null;
}

type Kind = { group: TGroup; channel: string; newLead: boolean };
/** What Hand-over leaves out as "a campaign or typed in by hand", by its real reason (SARCLA 31.10.2026: "should not
 *  exist - give it the real reason"): a push by its subject; Sales through GQS; the UC2 workflow's no-order ticket (its
 *  tests left out); a Back Office e-mail copied over; a chat; internal tickets left out - and else a customer's request
 *  someone typed in for the ESO ("Direct Request | Rubix", "FFKM order", "Certificate PTFE …"). */
function typedIn(t: TicketIn): Kind | { skip: string } {
  const s = (t.subject ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  const wf = (t.workflow ?? "").trim();
  const push = pushOf(t.subject);
  if (push) return { group: "system", channel: push, newLead: false };
  if (s.includes("GQS") || s.startsWith("SPECIAL REQUEST")) return { group: "incoming", channel: FROM_SALES, newLead: false };
  if (/^TEST/i.test(wf)) return { skip: "a workflow's test" };
  if (/UC2/i.test(wf) || s.startsWith("QUALIFIED LEAD")) return { group: "system", channel: NO_ORDER, newLead: false };
  if (/^BO\b/i.test(wf)) return { group: "incoming", channel: MAIL, newLead: false };
  if ((t.sourceType ?? "").toUpperCase() === "CHAT") return { group: "incoming", channel: "Chat", newLead: false };
  if (s.startsWith("PRODUCT MANAGEMENT") || s.startsWith("REVIEW TICKET")) return { skip: "internal, not a customer's" };
  return { group: "incoming", channel: DIRECT, newLead: false };
}

/** A ticket's group, where it came from and whether it is a new registrant to qualify - or why the pages leave it out.
 *  `lifecycle` names the workflows that make the lifecycle tickets (as the Hand-over page reads them); on the TSA
 *  pipeline a direct request is the TSA's. */
export function kindOf(t: TicketIn, lifecycle: Record<string, string>, pipe: TPipe = "ESO"): Kind | { skip: string } {
  const k = kindOnEso(t, lifecycle);
  return pipe === "TSA" && !("skip" in k) && k.channel === DIRECT ? { ...k, channel: DIRECT_TSA } : k;
}
function kindOnEso(t: TicketIn, lifecycle: Record<string, string>): Kind | { skip: string } {
  const what = classify(t, lifecycle);
  if ("skip" in what) return what.skip === "campaign or typed in by hand" ? typedIn(t) : { skip: what.skip };
  const label = CHANNELS.find((c) => c.id === what.c)?.label ?? what.c;
  return { group: what.g === "request" ? "incoming" : "system", channel: MERGED[label] ?? label, newLead: what.g === "newlead" };
}

/** What became of a ticket on these pages: Hand-over's outcomes, and "Bought at AP" lost - the order went to Angst+Pfister,
 *  not to us (SARCLA 31.10.2026, as erosion's WON_RESOLUTIONS since 04.10). Hand-over itself is left as it is. */
export type TOutcome = Outcome | "ap";
export const TOUTCOMES: { id: TOutcome; label: string }[] = [...OUTCOMES, { id: "ap", label: "Lost - bought at Angst+Pfister" }];
const AP = /^bought at a\+?p$/i;
/** What became of a ticket, as an index into TOUTCOMES: won, lost and why, closed otherwise, with no resolution, open. */
export function outcomeIndex(closed: boolean, resolution: string | null | undefined, newLead: boolean): number {
  const r = (resolution ?? "").trim();
  if (closed && AP.test(r)) return TOUTCOMES.findIndex((o) => o.id === "ap");
  return TOUTCOMES.findIndex((o) => o.id === outcomeOf({ g: newLead ? "newlead" : "request", x: closed ? 1 : 0, r }));
}

/** What the first contact was. */
export const FIRST = ["Reply in the ticket", "E-mail sent", "Call", "Meeting"] as const;
/** How fast the first contact came, in working hours - and none. */
export const SPEEDS = ["Within a working day", "Within 3 working days", "Later", "No contact"] as const;
export const DAY_HOURS = 9;
export function speedOf(hours: number | null): number {
  return hours == null ? 3 : hours <= DAY_HOURS ? 0 : hours <= 3 * DAY_HOURS ? 1 : 2;
}
/** How much the team logged on a ticket - e-mails sent, calls, meetings, notes and tasks together. */
export const EFFORT = ["Nothing logged", "1 activity", "2-3 activities", "4-6 activities", "7 or more"] as const;
export function effortOf(n: number): number {
  return n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4;
}

/** How sure a ticket's potential is, as the Ticket value app sets it (sales_potential_confidence), the surest first (SARCLA
 *  01.11.2026: "a tab for the potential - the ticket value funnel on the pipeline with the confidence score"). A ticket
 *  valued 0, or without a confidence ("unqualified": no sales topic), has no value: NO_VALUE. */
export const CONFS = ["High", "Medium", "Low"] as const;
export const NO_VALUE = CONFS.length;
export const confIndex = (v: string | null | undefined) => CONFS.findIndex((c) => c.toLowerCase() === (v ?? "").trim().toLowerCase());
/** The potential's funnel, each step inside the one before: every ticket that came in, those closed with a resolution, the won. */
export const VSTEPS = ["Came in", "Closed with a resolution", "Won"] as const;

/** The first contact of a ticket: the earliest of the team's moves towards the customer after it came in. */
export function firstContact(created: number, moves: { at: number | null; kind: number }[]): { at: number; kind: number } | null {
  let best: { at: number; kind: number } | null = null;
  for (const m of moves) if (m.at != null && m.at >= created && (!best || m.at < best.at)) best = { at: m.at, kind: m.kind };
  return best;
}

/* ── the rows of a period ──────────────────────────────────────────────── */

/** A period: this year's months, 0 = January (or last year's with year 1) - and, for a range of one's own dates (SARCLA
 *  31.10.2026: "really custom dates with a mini calendar"), the first day of its first month `d0` and the last day of its
 *  last month `d1` (1-31; none: from the 1st, to the month's end). Only the two end months can be cut, so the days ride on
 *  the months the page already counts by; last year's window is the same months with the same days. */
export type TWin = { from: number; to: number; year?: 0 | 1; d0?: number; d1?: number };
export type TDim = "person" | "channel" | "prio" | "category" | "country";
export type TFilters = Partial<Record<TDim, string[]>>;

/** The days of a month (0 = January). */
export const daysIn = (year: number, m: number) => new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
/** A row on the window's days - its months are checked apart; only the first and the last month are cut. */
const onDays = (r: number[], win: TWin) => (r[T.month] !== win.from || r[T.day] >= (win.d0 ?? 1)) && (r[T.month] !== win.to || r[T.day] <= (win.d1 ?? 31));
/** Two windows the same - months and days. */
export const sameWin = (a: TWin, b: TWin) => a.from === b.from && a.to === b.to && (a.year ?? 0) === (b.year ?? 0) && (a.d0 ?? 1) === (b.d0 ?? 1) && (a.d1 ?? 99) === (b.d1 ?? 99);
/** A window cut by days - not whole months. */
export const byDays = (win: TWin) => win.d0 != null || win.d1 != null;

type Day = Pick<TicketsData, "year" | "today">;
const p2 = (n: number) => String(n).padStart(2, "0");
/**
 * A window from the address or the calendar: each end a month ("2026-03") or a day ("2026-03-05"), this year only (the
 * read keeps last year for the comparison only), in either order, cut at the read's day. A first day of the 1st and a last
 * day at the month's end are whole months, so 1 March - 31 May is March-May exactly as the month picks have it; a range
 * ending on the read's day keeps that day (last year's comparison then stops on the same day a year earlier).
 */
export function winFrom(d: Day, from: string | null | undefined, to: string | null | undefined): TWin | null {
  const end = (x: string | null | undefined) => {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec((x ?? "").trim());
    if (!m || Number(m[1]) !== d.year) return null;
    const mo = Number(m[2]) - 1, day = m[3] ? Number(m[3]) : null;
    if (mo < 0 || mo > 11 || (day != null && (day < 1 || day > daysIn(d.year, mo)))) return null;
    return { m: mo, day };
  };
  let a = end(from), b = end(to);
  if (!a || !b) return null;
  if (a.m * 32 + (a.day ?? 1) > b.m * 32 + (b.day ?? 31)) [a, b] = [b, a];
  const tm = Number(d.today.slice(5, 7)) - 1, td = Number(d.today.slice(8, 10));
  // past the read's day: a month to date, a day the read's day (as the month picks were cut at the running month)
  const cut = (e: { m: number; day: number | null }) => (e.m > tm ? { m: tm, day: e.day == null ? null : td } : e.m === tm && e.day != null && e.day > td ? { m: tm, day: td } : e);
  a = cut(a); b = cut(b);
  const d0 = a.day != null && a.day > 1 ? a.day : undefined;
  const d1 = b.day != null && b.day < daysIn(d.year, b.m) ? b.day : undefined;
  return { from: a.m, to: b.m, ...(d0 ? { d0 } : {}), ...(d1 ? { d1 } : {}) };
}
/** The first and the last day a window covers, "2026-03-05" - the running month to the read's day. */
export function winDays(d: Day, win: TWin): [string, string] {
  const tm = Number(d.today.slice(5, 7)) - 1;
  const last = win.d1 ?? (win.to === tm ? Number(d.today.slice(8, 10)) : daysIn(d.year, win.to));
  return [`${d.year}-${p2(win.from + 1)}-${p2(win.d0 ?? 1)}`, `${d.year}-${p2(win.to + 1)}-${p2(last)}`];
}
/** A window in the address, read back by winFrom: whole months "2026-03" (as before), a window cut by days its two days
 *  "2026-03-05" - but an end running to date stays the month, so the link keeps running with the read. */
export function winParams(d: Day, win: TWin): [string, string] {
  const ym = (m: number) => `${d.year}-${p2(m + 1)}`;
  if (!byDays(win)) return [ym(win.from), ym(win.to)];
  const [a, b] = winDays(d, win);
  return [a, win.d1 == null && win.to === Number(d.today.slice(5, 7)) - 1 ? ym(win.to) : b];
}

const COL: Record<Exclude<TDim, "person">, number> = { channel: T.channel, prio: T.prio, category: T.category, country: T.country };
/** A row's value on a breakdown, as its label. */
export function labelOf(d: TicketsData, row: number[], dim: TDim): string {
  if (dim === "person") return d.people[row[T.person]]?.name ?? "Unknown";
  return d.labels[dim][row[COL[dim]]] ?? "Not set";
}

/** A group's tickets of a period, under the filters - a breakdown's own filter left out when grouping by it. A window cut
 *  by days counts each ticket on the day it came in, last year's on the same days. `pipe`: one pipeline's tickets (PIPES
 *  index; none: both - a read before 01.11.2026 is the ESO pipeline's alone). */
export function rowsOf(d: TicketsData, group: TGroup, win: TWin, f: TFilters, people: Set<number> | null, except?: TDim, pipe?: number | null): number[][] {
  const y = win.year ?? 0, g = groupIndex(group), days = byDays(win);
  const sets = (Object.keys(f) as TDim[]).filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  return d.tickets.filter((r) => r[T.group] === g && r[T.year] === y && r[T.month] >= win.from && r[T.month] <= win.to
    && (pipe == null || (r[T.pipe] ?? 0) === pipe)
    && (!days || onDays(r, win))
    && (!people || people.has(r[T.person]))
    && sets.every(([k, s]) => s.has(labelOf(d, r, k))));
}

const OPEN = TOUTCOMES.findIndex((o) => o.id === "open");
const NORES = TOUTCOMES.findIndex((o) => o.id === "nores");
const WON = TOUTCOMES.findIndex((o) => o.id === "won");
/** The lost: price, can't supply, delivery, only info, no reply, disqualified, bought at Angst+Pfister. */
export const LOST_IDS: readonly TOutcome[] = ["price", "supply", "delivery", "info", "noreply", "disq", "ap"];
/** Where an outcome stands: won, lost, closed otherwise, closed without a resolution, open. */
export function outcomeGroup(o: number): "won" | "lost" | "other" | "nores" | "open" {
  const id = TOUTCOMES[o]?.id;
  return id === "won" ? "won" : id === "open" ? "open" : id === "nores" ? "nores" : id && LOST_IDS.includes(id) ? "lost" : "other";
}

export type TStats = {
  tickets: number; closed: number;
  /** closed with a resolution - the base of the win rate */
  resolved: number; won: number; open: number;
  outcomes: number[];
  /** the closed by their resolution (index into labels.resolution; -1: closed without one), and where each stands */
  res: Record<number, number>; resGroup: Record<number, "won" | "lost" | "other" | "nores">;
  /** how fast the first contact came (SPEEDS), and the won and the decided of each */
  speed: number[]; speedWon: number[]; speedResolved: number[];
  /** what the first contact was (FIRST), and the won and the decided of each */
  first: number[]; firstWon: number[]; firstResolved: number[];
  /** how much was logged (EFFORT), and the won and the decided of each */
  effort: number[]; effortWon: number[]; effortResolved: number[];
  /** the working hours to each first contact, for the median */
  hours: number[];
  /** closed with nothing logged on them at all */
  quiet: number;
  /** what the team logged: e-mails sent, calls, meetings, notes and tasks - and on how many tickets each */
  emails: number; calls: number; meetings: number; notes: number; withEmails: number; withCalls: number; withMeetings: number; withNotes: number;
  /** per month of the period, from its first */
  months: number[]; monthsWon: number[]; monthsResolved: number[]; monthsInDay: number[]; monthsQuiet: number[]; monthsClosed: number[];
  monthsLost: number[]; monthsOther: number[]; monthsNores: number[]; monthsOpen: number[]; monthsHours: number[][];
  /** the potential (EUR) at each step of its funnel (VSTEPS) by how sure it is (CONFS, then NO_VALUE) - and the tickets */
  pot: number[][]; potN: number[][];
  /** the potential still open by how sure it is - and the tickets; and by the stage it stands in (labels.stage, -1: unknown) */
  potOpen: number[]; potOpenN: number[]; potStage: Record<number, number[]>; potStageN: Record<number, number[]>;
  /** the won and the decided by how sure the potential is */
  confWon: number[]; confResolved: number[];
};
const zeros = (n: number) => Array(n).fill(0) as number[];
const CONF_SLOTS = NO_VALUE + 1;
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** The potential of the tickets: all of them, the open, the won. */
export const potOf = (s: Pick<TStats, "pot">) => sum(s.pot[0]);
export const potOpenOf = (s: Pick<TStats, "potOpen">) => sum(s.potOpen);
export const potWonOf = (s: Pick<TStats, "pot">) => sum(s.pot[VSTEPS.length - 1]);
/** No tickets: every figure zero, n months. */
export const blank = (n: number): TStats => ({
  tickets: 0, closed: 0, resolved: 0, won: 0, open: 0, outcomes: zeros(TOUTCOMES.length), res: {}, resGroup: {},
  speed: zeros(4), speedWon: zeros(4), speedResolved: zeros(4), first: zeros(FIRST.length), firstWon: zeros(FIRST.length), firstResolved: zeros(FIRST.length),
  effort: zeros(EFFORT.length), effortWon: zeros(EFFORT.length), effortResolved: zeros(EFFORT.length), hours: [],
  quiet: 0, emails: 0, calls: 0, meetings: 0, notes: 0, withEmails: 0, withCalls: 0, withMeetings: 0, withNotes: 0,
  months: zeros(n), monthsWon: zeros(n), monthsResolved: zeros(n), monthsInDay: zeros(n), monthsQuiet: zeros(n), monthsClosed: zeros(n),
  monthsLost: zeros(n), monthsOther: zeros(n), monthsNores: zeros(n), monthsOpen: zeros(n), monthsHours: Array.from({ length: n }, () => [] as number[]),
  pot: VSTEPS.map(() => zeros(CONF_SLOTS)), potN: VSTEPS.map(() => zeros(CONF_SLOTS)),
  potOpen: zeros(CONF_SLOTS), potOpenN: zeros(CONF_SLOTS), potStage: {}, potStageN: {}, confWon: zeros(CONF_SLOTS), confResolved: zeros(CONF_SLOTS),
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

/** Everything logged on a row: a contact, or a note or a task. */
const logged = (r: number[]) => r[T.emails] + r[T.calls] + r[T.meetings] + r[T.notes];
const active = (r: number[]) => r[T.first] >= 0 || logged(r) > 0;
/** Closed without any activity: closed, and nothing logged on it at all. */
export const quietRow = (r: number[]) => r[T.outcome] !== OPEN && !active(r);

/** A ticket's potential: its EUR and how sure it is (CONFS index, or NO_VALUE). Valued 0 - 1,007 incoming tickets "low" at
 *  0 EUR in 2026 - or without a confidence is no value; reads before 01.11.2026 carry none. */
export function potentialOf(r: number[]): { ci: number; v: number } {
  const ci = (r[T.value] ?? 0) > 0 && (r[T.conf] ?? -1) >= 0 ? r[T.conf] : NO_VALUE;
  return { ci, v: ci === NO_VALUE ? 0 : r[T.value] };
}

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
    const g = outcomeGroup(o);
    const closed = o !== OPEN;
    const decided = closed && o !== NORES;
    const won = o === WON;
    const hours = r[T.firstH] >= 0 ? r[T.firstH] / 10 : null;
    const sp = speedOf(hours);
    const ef = effortOf(logged(r));
    s.tickets++; s.months[m]++;
    s.outcomes[o]++;
    s.speed[sp]++; s.effort[ef]++;
    if (sp === 0) s.monthsInDay[m]++;
    if (hours != null) { s.hours.push(hours); s.monthsHours[m].push(hours); }
    if (r[T.first] >= 0) s.first[r[T.first]]++;
    if (g === "lost") s.monthsLost[m]++; else if (g === "other") s.monthsOther[m]++; else if (g === "nores") s.monthsNores[m]++; else if (g === "open") s.monthsOpen[m]++;
    if (closed) {
      s.closed++; s.monthsClosed[m]++;
      const ri = decided ? r[T.resolution] ?? -1 : -1;
      s.res[ri] = (s.res[ri] ?? 0) + 1;
      s.resGroup[ri] = ri < 0 ? "nores" : (g as "won" | "lost" | "other");
      if (!active(r)) { s.quiet++; s.monthsQuiet[m]++; }
    } else s.open++;
    if (decided) {
      s.resolved++; s.monthsResolved[m]++; s.speedResolved[sp]++; s.effortResolved[ef]++;
      if (r[T.first] >= 0) s.firstResolved[r[T.first]]++;
      if (won) { s.won++; s.monthsWon[m]++; s.speedWon[sp]++; s.effortWon[ef]++; if (r[T.first] >= 0) s.firstWon[r[T.first]]++; }
    }
    // the potential: every ticket's, the decided's, the won's - and the open's by the stage it stands in
    const { ci, v } = potentialOf(r);
    s.pot[0][ci] += v; s.potN[0][ci]++;
    if (decided) { s.pot[1][ci] += v; s.potN[1][ci]++; s.confResolved[ci]++; }
    if (won) { s.pot[2][ci] += v; s.potN[2][ci]++; s.confWon[ci]++; }
    if (!closed) {
      const st = r[T.stage] ?? -1;
      s.potOpen[ci] += v; s.potOpenN[ci]++;
      (s.potStage[st] ??= zeros(CONF_SLOTS))[ci] += v; (s.potStageN[st] ??= zeros(CONF_SLOTS))[ci]++;
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
 *  began in July 2025, so a year to date against 2025's would compare a pipeline with an empty one.
 *  A month the dates cut (SARCLA 31.10.2026: "really custom dates") is held to its share of the 50, counted on the same
 *  days last year - 5-17 March needs 50 x 13/31, 21 tickets on 5-17 March 2025: the same bar a day as a whole month's
 *  (about 1.6 tickets a day). So a cut month is neither waved through on the whole month's tickets (a pipeline that began
 *  on the 20th would compare the 1st-19th with nothing) nor held to 50 in a few days, which no week would reach. A day
 *  this year that last year did not have (29 February) has nothing to compare with. Whole months: as before. */
export const PY_MIN = 50;
export function comparable(d: TicketsData, group: TGroup, win: TWin, people: Set<number> | null, pipe?: number | null): boolean {
  const per = zeros(12), g = groupIndex(group), days = byDays(win);
  for (const r of d.tickets) if (r[T.year] === 1 && r[T.group] === g && (pipe == null || (r[T.pipe] ?? 0) === pipe) && (!people || people.has(r[T.person])) && (!days || onDays(r, win))) per[r[T.month]]++;
  for (let m = win.from; m <= win.to; m++) {
    const n = daysIn(d.year - 1, m);
    const lo = m === win.from ? win.d0 ?? 1 : 1, hi = Math.min(n, m === win.to ? win.d1 ?? n : n);
    const share = days ? Math.max(0, hi - lo + 1) / n : 1;
    if (share <= 0 || per[m] < PY_MIN * share) return false;
  }
  return true;
}

/* ── the resolutions ───────────────────────────────────────────────────── */

/** The resolutions of a set of closed tickets, the most used first: label, count, and where it stands (won, lost…). */
export function resolutionsOf(d: TicketsData, s: Pick<TStats, "res" | "resGroup">): { key: number; label: string; n: number; group: "won" | "lost" | "other" | "nores" }[] {
  return Object.entries(s.res).map(([k, n]) => {
    const i = Number(k);
    return { key: i, label: i < 0 ? "No resolution set" : d.labels.resolution[i] ?? "Unknown", n, group: s.resGroup[i] ?? "other" };
  }).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

/* ── the path: where they came from, how fast the first contact came, what became of them, the resolution ── */

export type TFlowNode = { id: string; column: number; label: string; tone: "source" | "good" | "bad" | "none" };
export type TFlow = { columns: string[]; nodes: TFlowNode[]; links: { from: string; to: string; value: number }[] };
/** A resolution the path names: 2% of the tickets or more - the rest are "Other resolutions" (as Hand-over: "simplify"). */
const NAMED_SHARE = 0.02;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const lostLabel = (id: TOutcome) => cap(TOUTCOMES.find((o) => o.id === id)!.label.replace(/^Lost - /, ""));

export function flowOf(d: TicketsData, rows: number[][]): TFlow {
  const count = new Map<number, number>();
  for (const r of rows) { const g = outcomeGroup(r[T.outcome]); if (g !== "open" && g !== "nores" && r[T.resolution] >= 0) count.set(r[T.resolution], (count.get(r[T.resolution]) ?? 0) + 1); }
  const named = (i: number) => (count.get(i) ?? 0) >= rows.length * NAMED_SHARE;
  const nodes = new Map<string, TFlowNode>(), links = new Map<string, { from: string; to: string; value: number }>();
  const TONE = { won: "good", lost: "bad", other: "none" } as const;
  for (const r of rows) {
    const g = outcomeGroup(r[T.outcome]);
    const sp = speedOf(r[T.firstH] >= 0 ? r[T.firstH] / 10 : null);
    const path: TFlowNode[] = [
      { id: `c:${r[T.channel]}`, column: 0, label: labelOf(d, r, "channel"), tone: "source" },
      { id: `s:${sp}`, column: 1, label: SPEEDS[sp], tone: sp === 0 ? "good" : sp === 3 ? "bad" : "none" },
      g === "won" ? { id: "o:won", column: 2, label: "Won", tone: "good" }
        : g === "open" ? { id: "o:open", column: 2, label: "Still open", tone: "none" }
          : g === "lost" ? { id: "o:lost", column: 2, label: "Lost or disqualified", tone: "bad" }
            : g === "nores" ? { id: "o:nores", column: 2, label: "Closed without a resolution", tone: "none" }
              : { id: "o:other", column: 2, label: "Closed otherwise", tone: "none" },
    ];
    if ((g === "won" || g === "lost" || g === "other") && r[T.resolution] >= 0) {
      const i = r[T.resolution];
      path.push(named(i) ? { id: `r:${i}`, column: 3, label: d.labels.resolution[i] ?? "Unknown", tone: TONE[g] } : { id: `r:more-${g}`, column: 3, label: g === "won" ? "Other wins" : g === "lost" ? "Other lost reasons" : "Other resolutions", tone: TONE[g] });
    }
    for (const nd of path) nodes.set(nd.id, nd);
    for (let i = 0; i + 1 < path.length; i++) {
      const k = `${path[i].id}>${path[i + 1].id}`;
      const l = links.get(k) ?? { from: path[i].id, to: path[i + 1].id, value: 0 };
      l.value++;
      links.set(k, l);
    }
  }
  const out = ["o:won", "o:lost", "o:other", "o:nores", "o:open"];
  const tone = ["good", "bad", "none"];
  const order = (nd: TFlowNode) => (nd.column === 0 ? CHANNEL_ORDER.indexOf(nd.label) : nd.column === 1 ? Number(nd.id.slice(2)) : nd.column === 2 ? out.indexOf(nd.id)
    : tone.indexOf(nd.tone) * 1e6 + (nd.id.startsWith("r:more") ? 5e5 : 0) - (count.get(Number(nd.id.slice(2))) ?? 0));
  return {
    columns: ["Came from", "First contact", "Outcome", "Resolution"],
    nodes: [...nodes.values()].sort((a, b) => a.column - b.column || order(a) - order(b)),
    links: [...links.values()],
  };
}

/** The labels a read starts from, in the order the pages show them; the rest are added as they come. */
export const startLabels = (stages: string[] = []): TicketsData["labels"] => ({ channel: [...CHANNEL_ORDER], prio: [...PRIO_BANDS], category: [], country: [], resolution: [], stage: [...stages] });

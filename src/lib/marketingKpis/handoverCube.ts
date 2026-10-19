// HAND-OVER TO ESO/TSA - how the teams handle what comes in (SARCLA 19.10.2026: "the idea is a view on
// what they do with the leads they handle, how they handle them, what the win rate is - I want to see
// how the teams perform with incoming leads"). The rules, with no HubSpot in them (the read is handover.ts).
//
//   what      ESO and TSA tickets of three kinds (SARCLA 19.10, chosen in a question):
//               request    a customer asked us: a website form, the chat, an e-mail, a request the ESO
//                          typed in ("Direct ESO request"), one redirected from Back Office, the helpline
//               new lead   a new registrant to qualify (UC2 tickets, since 1 October 2026)
//               lifecycle  what the lifecycle workflows hand over: Lost Leads, Second Purchase, Thank you
//                          (a poor rating), Abandoned Cart
//             left out: campaigns typed in by hand, auto-logged mails, Finance mails, special price requests
//             (sales asking inside the company), "Not a sales topic",
//             "TSA NON QUALIFIED", Bisphenol - the rules of the Swiss SLA and territory reports (Sept-Oct 2026)
//   speed     for a customer's request: the first reply from the ticket (first_agent_reply_date) in
//             working hours, Mon-Fri 8-17 Zurich; a reply by phone or from Outlook is not in the ticket and
//             counts as none. A new registrant or a lifecycle hand-over is worked by phone or mail - there is
//             no reply to time, so speed is the customer requests' only
//   won       closed as Ordered (a one-shot order is an order too); a new lead is won when closed
//             Qualified - of the tickets closed with a resolution (SARCLA 19.10: "only ordered counts as
//             ordered, or qualified on new registrants")
//
// Every ticket counts for its team as it is today (its pipeline) and its owner today.

export type Kind = "request" | "newlead" | "lifecycle";
export type HandoverRow = {
  /** the month it came in, "2026-09" */
  m: string;
  t: "ESO" | "TSA";
  g: Kind;
  /** the channel (CHANNELS) */
  c: string;
  /** the company's country, "Unknown" without one */
  k: string;
  /** the ticket's owner (HubSpot owner id), "" without one */
  o: string;
  /** closed */
  x: 0 | 1;
  /** the resolution as written, when closed with one */
  r?: string;
  /** working hours to the first reply from the ticket; null when there is none */
  a: number | null;
  /** days to close (closed) or days open so far (open, at the read) */
  z: number;
};

export type HandoverData = {
  rows: HandoverRow[];
  owners: Record<string, string>;
  year: number;
  monthsDone: number;
  readAt: string;
  errors: Record<string, string>;
  /** tickets read and left out, by why - for the note under the page */
  skipped: Record<string, number>;
  /** what the read carries (HANDOVER_SHAPE): an older answer is shown while a new one is read */
  shape?: number;
};

/** 2: special price requests left out (19.10) */
export const HANDOVER_SHAPE = 2;

export const KINDS: { id: Kind; label: string }[] = [
  { id: "request", label: "Customer requests" },
  { id: "newlead", label: "New registrants to qualify" },
  { id: "lifecycle", label: "Lifecycle hand-overs" },
];
export const kindLabel = (id: string) => KINDS.find((k) => k.id === id)?.label ?? id;

export const CHANNELS: { id: string; label: string; kind: Kind }[] = [
  { id: "form", label: "Website form", kind: "request" },
  { id: "chat", label: "Chat", kind: "request" },
  { id: "email", label: "E-mail", kind: "request" },
  { id: "direct", label: "Direct request to the ESO", kind: "request" },
  { id: "bo", label: "Redirected from Back Office", kind: "request" },
  { id: "helpline", label: "Helpline", kind: "request" },
  { id: "uc2", label: "New registrant (UC2)", kind: "newlead" },
  { id: "uc15", label: "Lost Leads (UC15)", kind: "lifecycle" },
  { id: "uc9", label: "Second purchase (UC9)", kind: "lifecycle" },
  { id: "uc6", label: "Thank you - poor rating (UC6)", kind: "lifecycle" },
  { id: "uc4", label: "Abandoned cart (UC4)", kind: "lifecycle" },
];
export const channelLabel = (id: string) => CHANNELS.find((c) => c.id === id)?.label ?? id;

/** Tag ids of the ticket tags (their names are not in the API - inferred, see the territory report). */
const TAG = { newRegistrant: "43412670", lostLead: "41850163", secondPurchase: "40108945", abandonedCart: "37448743", negativeSurvey: "39041810" };

export type TicketIn = {
  subject?: string | null; sourceType?: string | null; objectSource?: string | null; workflow?: string | null;
  outbound?: string | null; tags?: string | null; resolution?: string | null;
};

/** Resolutions that take a ticket out of every figure. */
export const NOT_SALES: ReadonlySet<string> = new Set(["Not a sales topic", "TSA NON QUALIFIED", "Bisphenol Excel Filled out"]);

/**
 * What a ticket is, or why it is left out: { g, c } for a request, a new lead or a lifecycle hand-over;
 * { skip } otherwise. `lifecycle` names the workflows that create the lifecycle tickets -> "uc2", "uc15"…
 */
export function classify(t: TicketIn, lifecycle: Record<string, string>): { g: Kind; c: string } | { skip: string } {
  const s = (t.subject ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  const src = (t.sourceType ?? "").toUpperCase(), ost = (t.objectSource ?? "").toUpperCase();
  const tags = new Set((t.tags ?? "").split(";").map((x) => x.trim()).filter(Boolean));
  if (String(t.outbound ?? "") === "true" || s.startsWith("TSA | MAIL TO CUSTOMER")) return { skip: "auto-logged mail" };
  if (t.resolution && NOT_SALES.has(t.resolution.trim())) return { skip: "not a sales topic" };
  if (s.includes("BISPHENOL")) return { skip: "Bisphenol" };
  if (s.includes("MAIL FROM FINANCE")) return { skip: "Finance mail" };
  // the lifecycle workflows, by the workflow that made the ticket - then by their tag
  const uc = t.workflow ? lifecycle[t.workflow.trim()] : undefined;
  if (uc === "uc2" || tags.has(TAG.newRegistrant)) return { g: "newlead", c: "uc2" };
  if (uc && ["uc15", "uc9", "uc6", "uc4"].includes(uc)) return { g: "lifecycle", c: uc };
  if (tags.has(TAG.lostLead)) return { g: "lifecycle", c: "uc15" };
  if (tags.has(TAG.secondPurchase)) return { g: "lifecycle", c: "uc9" };
  if (tags.has(TAG.abandonedCart) || s.startsWith("ABANDONED CART")) return { g: "lifecycle", c: "uc4" };
  if (tags.has(TAG.negativeSurvey) || (s.includes("NEGATIVE") && s.includes("SURVEY"))) return { g: "lifecycle", c: "uc6" };
  // a customer wrote to us: the help desk made the ticket from the e-mail, the form or the chat
  const inbox = (["EMAIL", "FORM", "CHAT"].includes(src) && ["CONVERSATIONS", "AUTOMATION_PLATFORM", "BOT"].includes(ost)) || ["CONVERSATIONS", "BOT"].includes(ost);
  // ...or someone typed in a customer's request (the "Direct ESO request" trap of the territory report)
  if (s.startsWith("BO ") || s.startsWith("BO|") || s.startsWith("BACK OFFICE") || s.startsWith("WRONG OWNER PLEASE CORRECT IT - BO")) return { g: "request", c: "bo" };
  if (s.startsWith("DIRECT ESO REQUEST")) return { g: "request", c: "direct" };
  if (s.startsWith("HELPLINE")) return { g: "request", c: "helpline" };
  if (s.startsWith("CUSTOMER FORM") || (inbox && src === "FORM")) return { g: "request", c: "form" };
  if (s.startsWith("REQUEST FROM CHAT") || (inbox && (src === "CHAT" || ost === "BOT"))) return { g: "request", c: "chat" };
  // a special price request is sales asking inside the company, not a customer's lead (SARCLA 19.10: "a mistake")
  if (s.startsWith("SPECIAL PRICE REQUEST")) return { skip: "special price request" };
  if (inbox) return { g: "request", c: "email" };
  return { skip: "campaign or typed in by hand" };
}

/* ── what became of it ─────────────────────────────────────────────────── */

export const ORDERED: ReadonlySet<string> = new Set(["Ordered", "One-shot order", "One-shot C2S order"]);
export type Outcome = "won" | "price" | "supply" | "delivery" | "info" | "noreply" | "disq" | "other" | "open";
export const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: "won", label: "Won - ordered, or qualified" },
  { id: "price", label: "Lost - price" },
  { id: "supply", label: "Lost - can't supply" },
  { id: "delivery", label: "Lost - delivery" },
  { id: "info", label: "Lost - only info, no interest" },
  { id: "noreply", label: "No reply from the customer" },
  { id: "disq", label: "Disqualified, not our focus" },
  { id: "other", label: "Closed otherwise" },
  { id: "open", label: "Still open" },
];
export const outcomeLabel = (id: string) => OUTCOMES.find((o) => o.id === id)?.label ?? id;

const PRICE = /^price issue$|^price is too high/i;
const SUPPLY = /^availability issue$|^can't supply|^no suitable product|^certificates not|^moq issue$/i;
const DELIVERY = /^delivery/i;
// "Only looking for info" is a lost sale, never a non-sales topic (SARCLA 13.09)
const INFO = /^only looking for info$|^no interest|^no demand$|^don't want to buy via online shop$|^benchmarking$|^technical information|^already bought from a competitor$|^offer not accepted/i;

/** What became of a ticket: won, lost and why, closed otherwise, or still open. */
export function outcomeOf(row: Pick<HandoverRow, "g" | "x" | "r">): Outcome {
  if (!row.x) return "open";
  const r = (row.r ?? "").trim();
  if (row.g === "newlead") {
    if (/^qualified/i.test(r)) return "won";
    if (/^disqualified/i.test(r)) return "disq";
  } else if (ORDERED.has(r)) return "won";
  if (PRICE.test(r)) return "price";
  if (SUPPLY.test(r)) return "supply";
  if (DELIVERY.test(r)) return "delivery";
  if (INFO.test(r)) return "info";
  if (/^no reply/i.test(r)) return "noreply";
  if (/^not (eso|apso) focus customer/i.test(r)) return "disq";
  return "other";
}

/* ── working hours ─────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const zurich = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });

/** Zurich's offset from UTC at a moment, in ms (+1 h in winter, +2 h in summer). */
function offsetAt(ms: number): number {
  const p = Object.fromEntries(zurich.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return Math.round((local - Math.floor(ms / 60_000) * 60_000) / 60_000) * 60_000;
}

/** Working hours (Monday to Friday, 08:00-17:00 Zurich) between two moments; 0 when the second is not later. */
export function workingHours(from: number, to: number): number {
  if (!(to > from)) return 0;
  let total = 0;
  // day by day in Zurich's calendar, at most 400 days
  const off = offsetAt(from);
  let day = Math.floor((from + off) / DAY) * DAY; // Zurich midnight, as a UTC-shifted day number
  for (let i = 0; i < 400 && day - off <= to; i++, day += DAY) {
    const dow = new Date(day).getUTCDay(); // 0 Sunday … 6 Saturday, of the Zurich date
    if (dow !== 0 && dow !== 6) {
      const o = offsetAt(day + 12 * 3_600_000 - off);
      const a = Math.max(from, day + 8 * 3_600_000 - o), b = Math.min(to, day + 17 * 3_600_000 - o);
      if (b > a) total += (b - a) / 3_600_000;
    }
  }
  return total;
}

/* ── the figures ───────────────────────────────────────────────────────── */

export type HFilters = { team?: string[]; kind?: string[]; channel?: string[]; country?: string[]; owner?: string[] };
export function keep(r: HandoverRow, f: HFilters): boolean {
  return (!f.team?.length || f.team.includes(r.t)) && (!f.kind?.length || f.kind.includes(r.g)) && (!f.channel?.length || f.channel.includes(r.c))
    && (!f.country?.length || f.country.includes(r.k)) && (!f.owner?.length || f.owner.includes(r.o));
}
export const ym = (year: number, m: number) => `${year}-${String(m + 1).padStart(2, "0")}`;
export const inWin = (m: string, year: number, w: { start: number; end: number }) => m >= ym(year, w.start) && m <= ym(year, w.end);

/** One working day = the 9 hours from 8 to 17. */
export const DAY_HOURS = 9;

export type Stats = {
  incoming: number;
  /** the customer requests: the base of the speed figures */
  requests: number;
  /** answered from the ticket within one working day */
  inDay: number;
  /** no reply from the ticket (closed without one, or open a working day and more) */
  noReply: number;
  /** the working hours to the first reply, for the median */
  firstHours: number[];
  closed: number;
  /** closed with a resolution: the base of the win rate */
  resolved: number;
  won: number;
  outcomes: Record<Outcome, number>;
  open: number;
  /** open for more than 30 days */
  stale: number;
  /** days to close, for the median */
  closeDays: number[];
};
export const emptyStats = (): Stats => ({
  incoming: 0, requests: 0, inDay: 0, noReply: 0, firstHours: [], closed: 0, resolved: 0, won: 0,
  outcomes: { won: 0, price: 0, supply: 0, delivery: 0, info: 0, noreply: 0, disq: 0, other: 0, open: 0 }, open: 0, stale: 0, closeDays: [],
});

export function addRow(s: Stats, r: HandoverRow): Stats {
  s.incoming += 1;
  // speed: a customer's request only - the hand-overs are worked by phone or mail
  if (r.g === "request") {
    s.requests += 1;
    if (r.a != null) { s.firstHours.push(r.a); if (r.a <= DAY_HOURS) s.inDay += 1; }
    else if (r.x || r.z >= 1) s.noReply += 1;
  }
  const o = outcomeOf(r);
  s.outcomes[o] += 1;
  if (r.x) {
    s.closed += 1;
    s.closeDays.push(r.z);
    if (r.r) { s.resolved += 1; if (o === "won") s.won += 1; }
  } else {
    s.open += 1;
    if (r.z > 30) s.stale += 1;
  }
  return s;
}

export function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
export const winRate = (s: Stats) => (s.resolved ? (s.won / s.resolved) * 100 : null);
export const inDayRate = (s: Stats) => (s.requests ? (s.inDay / s.requests) * 100 : null);

/** The months chosen this year, and the same months a year earlier. */
export function statsOf(d: HandoverData, w: { start: number; end: number }, f: HFilters): { cur: Stats; prev: Stats } {
  const cur = emptyStats(), prev = emptyStats();
  for (const r of d.rows) {
    if (!keep(r, f)) continue;
    if (inWin(r.m, d.year, w)) addRow(cur, r);
    else if (inWin(r.m, d.year - 1, w)) addRow(prev, r);
  }
  return { cur, prev };
}

/** The same, broken down by a key (team, channel, country, owner, month). */
export function statsBy(d: HandoverData, w: { start: number; end: number }, f: HFilters, keyOf: (r: HandoverRow) => string): Map<string, { cur: Stats; prev: Stats }> {
  const out = new Map<string, { cur: Stats; prev: Stats }>();
  for (const r of d.rows) {
    if (!keep(r, f)) continue;
    const isCur = inWin(r.m, d.year, w), isPrev = inWin(r.m, d.year - 1, w);
    if (!isCur && !isPrev) continue;
    const k = keyOf(r);
    const e = out.get(k) ?? { cur: emptyStats(), prev: emptyStats() };
    addRow(isCur ? e.cur : e.prev, r);
    out.set(k, e);
  }
  return out;
}

/* ── the flow: where it came in, which team, what became of it ─────────── */

export type HFlowNode = { id: string; column: number; label: string; tone: "source" | "eso" | "tsa" | "good" | "bad" | "none" };
export type HFlow = { columns: string[]; nodes: HFlowNode[]; links: { from: string; to: string; value: number }[]; totals: Record<string, number> };

const LOST: ReadonlySet<Outcome> = new Set(["price", "supply", "delivery", "info", "noreply", "disq"]);

/** The tickets of the months chosen as a flow: channel -> team -> answered in a working day or not -> what became of them. */
export function flowOf(d: HandoverData, w: { start: number; end: number }, f: HFilters): HFlow {
  const nodes = new Map<string, HFlowNode>(), links = new Map<string, { from: string; to: string; value: number }>(), totals: Record<string, number> = {};
  for (const r of d.rows) {
    if (!keep(r, f) || !inWin(r.m, d.year, w)) continue;
    const o = outcomeOf(r);
    const path: HFlowNode[] = [
      { id: `c:${r.c}`, column: 0, label: channelLabel(r.c), tone: "source" },
      { id: `t:${r.t}`, column: 1, label: r.t, tone: r.t === "ESO" ? "eso" : "tsa" },
      r.g !== "request" ? { id: "s:out", column: 2, label: "Hand-over (phone, mail)", tone: "none" }
        : r.a != null && r.a <= DAY_HOURS ? { id: "s:day", column: 2, label: "Answered in a working day", tone: "good" }
          : r.a != null ? { id: "s:late", column: 2, label: "Answered later", tone: "none" }
            : { id: "s:none", column: 2, label: "No reply in the ticket", tone: "bad" },
      o === "won" ? { id: "o:won", column: 3, label: "Won", tone: "good" }
        : o === "open" ? { id: "o:open", column: 3, label: "Still open", tone: "none" }
          : LOST.has(o) ? { id: "o:lost", column: 3, label: "Lost or disqualified", tone: "bad" }
            : { id: "o:other", column: 3, label: "Closed otherwise", tone: "none" },
    ];
    for (const n of path) { nodes.set(n.id, n); totals[n.id] = (totals[n.id] ?? 0) + 1; }
    for (let i = 0; i + 1 < path.length; i++) {
      const k = `${path[i].id}>${path[i + 1].id}`;
      const l = links.get(k) ?? { from: path[i].id, to: path[i + 1].id, value: 0 };
      l.value += 1;
      links.set(k, l);
    }
  }
  const ORDER = ["t:ESO", "t:TSA", "s:day", "s:late", "s:none", "s:out", "o:won", "o:lost", "o:other", "o:open"];
  const rank = (n: HFlowNode) => (n.column === 0 ? -(totals[n.id] ?? 0) : ORDER.indexOf(n.id));
  return {
    columns: ["Came in by", "Team", "First reply", "Outcome"],
    nodes: [...nodes.values()].sort((a, b) => a.column - b.column || rank(a) - rank(b)),
    links: [...links.values()],
    totals,
  };
}

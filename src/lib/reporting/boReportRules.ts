// BACK-OFFICE REPORTS - the pure half (the HubSpot read is in ./boReport.ts). SARCLA 02.11.2026: "and the back office
// reports based on file?" - the Back Office's own KPI workbook (0-KPIs-APSOparts-Sept26-YTD.xlsx, sheet "BO KPI"), worked
// out live by the hub ("Live, file = the KPI list"), a page per part as on ESO / TSA Reports ("like on the ESO / TSA, split
// per topic").
//
// Checked against the workbook's January 2026 (02.11.2026):
//   - orders: every order number once, its deliveries (.000, .001, .002 ...) together, credit notes left out - 4,222, the
//     workbook's 4,224 (HubSpot holds 4,879 order records that month);
//   - order lines: per order number the largest line count of its deliveries - 9,070 against 9,074 (a delivery repeats
//     the order's lines; adding them up gives 9,743);
//   - tickets per topic: the topic each Back Office ticket has today - within a few of the workbook (53 certificates,
//     271 dashboard, 71 MS365 the same); tickets re-filed since move between topics;
//   - first reply: HubSpot's time to the first agent e-mail reply, ~2 days as in the workbook.
// The workbook's own counts of closed tickets and chat tickets since July follow a rule it does not write down; the
// hub's are HubSpot's (closed = close date in the month; chat = handed over by the chat), said where they are shown.

/** One month of the Back Office - kept per month (kv boReport:month:<YYYY-MM>), the finished ones read once. */
export type BoMonth = {
  ym: string;
  /** Back Office tickets created in the month, and closed in it (close date) */
  created: number; closed: number;
  /** of the tickets created in the month and closed since: their days to close, added up, and how many */
  closeDays: number; closeN: number;
  /** of the tickets created in the month and answered: days to the first agent e-mail reply, added up, and how many */
  replyDays: number; replyN: number;
  /** created in the month and handed over by the chat (Redirected from chat, or source Chat) */
  chat: number;
  /** created in the month, by the topic each has today (Enquiry category; "" = none) */
  topics: Record<string, number>;
  /** every ticket created in the month: ESO's, TSA's, all of APSOparts' pipelines */
  eso: number; tsa: number; all: number;
  /** the orders of the month (order date): order numbers, and their lines */
  orders: number; lines: number;
  /** not counted yet (the first count fills the months newest first): every figure of it null, never 0 */
  pending?: boolean;
};

/** One month of GQS tasks (from the GQS figures' own read, kv gqsFigures:store). */
export type GqsMonth = { ym: string; created: number; sentDays: number; sentN: number; doneDays: number; doneN: number };

export type BoReport = {
  generatedAt: string;
  /** January last year to this month, oldest first */
  months: BoMonth[];
  gqs: GqsMonth[];
  /** hours the Back Office worked, per month (typed in - not in HubSpot) */
  hours: Record<string, number>;
  /** this month, as of today (Swiss): "2026-11" */
  current: string;
  today: string;
};

const DAY = 86_400_000;
const ZURICH = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });
/** the Swiss day of a moment, "2026-11-02" */
export const swissDay = (t: number | string | Date) => ZURICH.format(new Date(t));

/** The moment a month begins in Switzerland (midnight of its first day, CET or CEST), in ms. */
export function monthStart(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  for (const h of [1, 2]) {
    const t = Date.UTC(y, m - 1, 1) - h * 3_600_000;
    if (swissDay(t) === `${ym}-01` && swissDay(t - 1) !== `${ym}-01`) return t;
  }
  return Date.UTC(y, m - 1, 1);
}
export const nextMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
/** the months from `first` to `last`, both in */
export function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  for (let ym = first; ym <= last; ym = nextMonth(ym)) out.push(ym);
  return out;
}

/**
 * An order record as the count needs it - `lines` its line count, or, on the shop's own records (Magento, which carry no
 * line count and no type - most of them since July 2026), its item count.
 */
export type OrderRec = { number: string | null; type: string | null; status: string | null; lines: number };
const isCredit = (r: OrderRec) => /credit/i.test(r.type ?? "") || /credit/i.test(r.status ?? "");
/**
 * The month's orders the way the Back Office counts them: an order number once, whatever its deliveries (.001, .002 ...)
 * and whichever system wrote it (the ERP and the shop number them alike), credit notes out; its lines = the largest line
 * count among its deliveries. June to September 2026, with the shop's records in: 1.5 to 4 % from the workbook's figures.
 */
export function orderTally(rows: OrderRec[]): { orders: number; lines: number } {
  const most = new Map<string, number>();
  for (const r of rows) {
    if (isCredit(r) || !r.number) continue;
    const base = r.number.replace(/\.\d+$/, "");
    most.set(base, Math.max(most.get(base) ?? 0, r.lines || 0));
  }
  let lines = 0;
  for (const n of most.values()) lines += n;
  return { orders: most.size, lines };
}

/** A Back Office ticket as the month needs it. */
export type TicketRec = { topic: string | null; toClose: number | null; toReply: number | null; chat: boolean };
/** The created tickets' half of a month: topics, days to close and to the first reply, the chat's. */
export function ticketTally(rows: TicketRec[]): Pick<BoMonth, "closeDays" | "closeN" | "replyDays" | "replyN" | "chat" | "topics"> & { created: number } {
  const out = { created: rows.length, closeDays: 0, closeN: 0, replyDays: 0, replyN: 0, chat: 0, topics: {} as Record<string, number> };
  for (const r of rows) {
    const t = (r.topic ?? "").trim();
    out.topics[t] = (out.topics[t] ?? 0) + 1;
    if (r.toClose != null && r.toClose > 0) { out.closeDays += r.toClose / DAY; out.closeN++; }
    if (r.toReply != null && r.toReply > 0) { out.replyDays += r.toReply / DAY; out.replyN++; }
    if (r.chat) out.chat++;
  }
  return out;
}

/** A GQS task as its month needs it: HubSpot's time to close and its time in the Back Office's first two stages (ms). */
export type GqsRec = { created: string; toClose: number | null; sentMs: number };
/**
 * GQS per month of creation: how many, the days before the Back Office sent it on to GQS (its time in New for Back-Office
 * and Open the GQS Task), and the days to its close (offer sent to Sales, or refused) - HubSpot's time to close, the
 * workbook's figure (January 2026: 25.4 days against its 23.3 when it was written; to the last close, 54).
 */
export function gqsTally(rows: GqsRec[]): GqsMonth[] {
  const by = new Map<string, GqsMonth>();
  for (const r of rows) {
    const ym = swissDay(r.created).slice(0, 7);
    const m = by.get(ym) ?? { ym, created: 0, sentDays: 0, sentN: 0, doneDays: 0, doneN: 0 };
    m.created++;
    if (r.sentMs > 0) { m.sentDays += r.sentMs / DAY; m.sentN++; }
    if (r.toClose != null && r.toClose > 0) { m.doneDays += r.toClose / DAY; m.doneN++; }
    by.set(ym, m);
  }
  return [...by.values()].sort((a, b) => a.ym.localeCompare(b.ym));
}

/* ── the KPIs, as the workbook names them ─────────────────────────────── */

const avg = (sum: number, n: number) => (n ? sum / n : null);

/**
 * The tickets are in HubSpot's pipelines from July 2025 (the Back Office's 1,207 that month, a handful before; GQS from
 * the same month): a month before has no ticket figures - not zero - so nothing is compared with it. The orders go back
 * further.
 */
export const TICKETS_FROM = "2025-07";
export const hasTickets = (ym: string) => ym >= TICKETS_FROM;
const ratio = (a: number, b: number) => (b ? a / b : null);

/** Several months together (a quarter, the year to date): the counts added, the averages over all their tickets. */
export function sumMonths(ms: BoMonth[]): BoMonth {
  const out: BoMonth = { ym: ms[0]?.ym ?? "", created: 0, closed: 0, closeDays: 0, closeN: 0, replyDays: 0, replyN: 0, chat: 0, topics: {}, eso: 0, tsa: 0, all: 0, orders: 0, lines: 0 };
  for (const m of ms) {
    if (m.pending) out.pending = true;
    for (const k of ["created", "closed", "closeDays", "closeN", "replyDays", "replyN", "chat", "eso", "tsa", "all", "orders", "lines"] as const) out[k] += m[k];
    for (const [t, n] of Object.entries(m.topics)) out.topics[t] = (out.topics[t] ?? 0) + n;
  }
  return out;
}
export function sumGqs(ms: GqsMonth[]): GqsMonth {
  const out: GqsMonth = { ym: ms[0]?.ym ?? "", created: 0, sentDays: 0, sentN: 0, doneDays: 0, doneN: 0 };
  for (const m of ms) for (const k of ["created", "sentDays", "sentN", "doneDays", "doneN"] as const) out[k] += m[k];
  return out;
}

export type BoKpis = {
  created: number | null; closed: number | null; hours: number | null; lines: number | null; orders: number | null;
  resolution: number | null; firstReply: number | null; chat: number | null;
  gqsCreated: number | null; gqsSent: number | null; gqsResolution: number | null;
  perLine: number | null; perOrder: number | null; hoursPerTicket: number | null;
  eso: number | null; esoPerLine: number | null; esoPerOrder: number | null;
  tsa: number | null; tsaPerLine: number | null; tsaPerOrder: number | null;
  all: number | null; allPerLine: number | null; allPerOrder: number | null;
};
/**
 * The workbook's KPIs for a month (or months added up - named by the first). `hours` null = not typed in. Before
 * TICKETS_FROM every ticket figure is null; months added up that start before it have none either.
 */
export function kpisOf(m: BoMonth, g: GqsMonth | null, hours: number | null): BoKpis {
  const t = hasTickets(m.ym) && !m.pending;
  const n = (x: number) => (t ? x : null);
  const r = (a: number, b: number) => (t ? ratio(a, b) : null);
  return {
    created: n(m.created), closed: n(m.closed), hours, lines: m.pending ? null : m.lines, orders: m.pending ? null : m.orders,
    resolution: t ? avg(m.closeDays, m.closeN) : null, firstReply: t ? avg(m.replyDays, m.replyN) : null, chat: n(m.chat),
    gqsCreated: t ? g?.created ?? 0 : null, gqsSent: t && g ? avg(g.sentDays, g.sentN) : null, gqsResolution: t && g ? avg(g.doneDays, g.doneN) : null,
    perLine: r(m.created, m.lines), perOrder: r(m.created, m.orders), hoursPerTicket: hours != null ? r(hours, m.created) : null,
    eso: n(m.eso), esoPerLine: r(m.eso, m.lines), esoPerOrder: r(m.eso, m.orders),
    tsa: n(m.tsa), tsaPerLine: r(m.tsa, m.lines), tsaPerOrder: r(m.tsa, m.orders),
    all: n(m.all), allPerLine: r(m.all, m.lines), allPerOrder: r(m.all, m.orders),
  };
}

/** The topics the workbook has under "Others" today come one by one from the hub's classifier; kept apart, in this order. */
export const TOPIC_ORDER = [
  "Delivery", "Invoicing & Accounting", "Product Price", "Product Information", "Order Cancellation", "Certificates (ONLY FOR BO)",
  "Website Issue", "MS365", "Dashboard", "Others", "Automatic e-mail", "Finance e-mail", "Internal e-mail", "GQS task update",
  "Spam or advertising", "Empty e-mail", "AVOR e-mail",
];
export const topicLabel = (t: string) => (t ? t : "No topic");

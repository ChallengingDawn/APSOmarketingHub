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
  /**
   * The workbook's comments and its "new KPIs" (03.11.2026): the C2S tickets ("can we see already the first impact of
   * C2S V1 and C2S V2?" on Delivery) - all of them, and those filed Delivery; each ticket's customer tone (the sentiment
   * sweep's: positive / neutral / negative, "neutral feeling"); the orders by profit centre ("orders per PC").
   */
  c2s: number; c2sDelivery: number; tones: Record<string, number>; pcs: Record<string, number>;
  /** the order lines by profit centre (since version 3) */
  linePcs?: Record<string, number>;
  /** the orders' net value by profit centre - an order once, its largest record's value, CHF and EUR as booked (since version 5) */
  valuePcs?: Record<string, number>;
  /** the month's tickets one by one - the filters, the people, the speed per topic are drawn from them (since version 3) */
  rows?: BoRows;
  /** how HubSpot says each ticket created was made (hs_object_source) - what "automatic" rests on, kept to check it */
  srcs?: Record<string, number>;
  /** not counted yet (the first count fills the months newest first): every figure of it null, never 0 */
  pending?: boolean;
};

/** One month of GQS tasks (from the GQS figures' own read, kv gqsFigures:store). */
export type GqsMonth = { ym: string; created: number; sentDays: number; sentN: number; doneDays: number; doneN: number };


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
export type OrderRec = {
  number: string | null; type: string | null; status: string | null; lines: number; pc?: string | null;
  /** its lines' articles and their profit centres, as the record names them (order_line_NN_article / _pc) */
  arts?: (string | null)[]; lpcs?: (string | null)[];
  /** its net value as booked (order_total_net_revenue) */
  value?: number;
  /** its lines' net revenue, beside `arts` (order_line_NN_revenue) - what an article named on a ticket is worth */
  revs?: (number | null)[];
};
/** what a profit centre field holds when it names none */
const noPc = (x: string | null | undefined) => !x || !x.trim() || /^unknown$/i.test(x.trim());
export const isCredit = (r: OrderRec) => /credit/i.test(r.type ?? "") || /credit/i.test(r.status ?? "");
/** an order number without its delivery's suffix (.000, .001 ...) - the ERP and the shop number alike */
export const baseOf = (n: string) => n.replace(/\.\d+$/, "");
/**
 * A profit centre as a code, from wherever it is written: Products & Pricing's profit_center, a company's
 * major_profit_center ("DT", "KT" ... or "No sales" / "Mix different PC", which name none) - "" when it names none.
 */
export function pcCode(x: string | null | undefined): string {
  const s = (x ?? "").trim();
  if (!s || /^unknown$/i.test(s) || /no sales|mix/i.test(s)) return "";
  const m = s.match(/\b(DT|KT|FT|ST|AT|PW)\b/i);
  if (m) return m[1].toUpperCase();
  return /^[A-Za-z]{2,4}$/.test(s) ? s.toUpperCase() : "";
}
/**
 * The month's orders the way the Back Office counts them: an order number once, whatever its deliveries (.001, .002 ...)
 * and whichever system wrote it (the ERP and the shop number them alike), credit notes out; its lines = the largest line
 * count among its deliveries. June to September 2026, with the shop's records in: 1.5 to 4 % from the workbook's figures.
 */
export function orderTally(rows: OrderRec[], pcOfArticle: (article: string) => string | null = () => null, fallback: (base: string) => string | null | undefined = () => null): { orders: number; lines: number; pcs: Record<string, number>; linePcs: Record<string, number>; valuePcs: Record<string, number>; pcOfNumber: Map<string, string>; valueOfNumber: Map<string, number> } {
  const most = new Map<string, number>(), pcOf = new Map<string, string>(), widest = new Map<string, OrderRec>(), worth = new Map<string, number>();
  const named = (r: OrderRec | undefined) => (r?.arts ?? []).filter(Boolean).length;
  for (const r of rows) {
    if (isCredit(r) || !r.number) continue;
    const base = baseOf(r.number);
    most.set(base, Math.max(most.get(base) ?? 0, r.lines || 0));
    worth.set(base, Math.max(worth.get(base) ?? 0, r.value || 0));
    // its profit centre: any of its records that names one
    if (!noPc(r.pc) && !pcOf.get(base)) pcOf.set(base, r.pc!.trim());
    if (!widest.has(base) || named(r) > named(widest.get(base))) widest.set(base, r);
  }
  let lines = 0;
  for (const n of most.values()) lines += n;
  const pcs: Record<string, number> = {}, linePcs: Record<string, number> = {}, valuePcs: Record<string, number> = {}, pcOfNumber = new Map<string, string>();
  for (const base of most.keys()) {
    // the lines of its widest record: each line's own profit centre, else its article's (SARCLA 03.11.2026 on "No
    // profit centre" for most orders: "this need to be correct" - the shop's own records name none, June to August)
    const r = widest.get(base);
    const ls = (r?.arts ?? []).map((art, i) => { const own = r?.lpcs?.[i]; return !noPc(own) ? own!.trim() : art ? pcOfArticle(art.trim()) : null; }).filter((x): x is string => !!x);
    for (const x of ls) linePcs[x] = (linePcs[x] ?? 0) + 1;
    let k = pcOf.get(base) ?? "";
    if (!k && ls.length) {
      // the profit centre most of its lines are in
      const by: Record<string, number> = {};
      for (const x of ls) by[x] = (by[x] ?? 0) + 1;
      k = Object.entries(by).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0][0];
    }
    // none on the order nor its lines: its customer's main profit centre (SARCLA 04.11.2026: "WHY DO WE STILL HAVE No profit
    // centre - we should not have")
    if (!k) k = pcCode(fallback(base));
    pcs[k] = (pcs[k] ?? 0) + 1;
    valuePcs[k] = (valuePcs[k] ?? 0) + (worth.get(base) ?? 0);
    pcOfNumber.set(base, k);
  }
  return { orders: most.size, lines, pcs, linePcs, valuePcs, pcOfNumber, valueOfNumber: worth };
}

/**
 * An article's profit centre: the one its order lines name, else the one most known articles of its first four digits
 * are in - 94.6 % right on 2026's order lines, where 70 % of the shop's July articles were known by their number.
 */
export function pcFinder(known: Record<string, string>): (article: string) => string | null {
  const by = new Map<string, Record<string, number>>();
  for (const [art, pc] of Object.entries(known)) { const k = art.slice(0, 4); const m = by.get(k) ?? {}; m[pc] = (m[pc] ?? 0) + 1; by.set(k, m); }
  const prefix = new Map([...by].map(([k, m]) => [k, Object.entries(m).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0][0]]));
  return (art) => known[art] ?? prefix.get(art.slice(0, 4)) ?? null;
}
/** the article -> profit centre pairs of a month's order lines that name both */
export function articlePcs(rows: OrderRec[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) (r.arts ?? []).forEach((art, i) => { const pc = r.lpcs?.[i]; if (art && art.trim() && !noPc(pc)) out[art.trim()] = pc!.trim(); });
  return out;
}

/** A Back Office ticket as the month needs it. */
export type TicketRec = { topic: string | null; toClose: number | null; toReply: number | null; chat: boolean; c2s?: boolean; tone?: string | null };
/** The created tickets' half of a month: topics, days to close and to the first reply, the chat's, the C2S ones, the tones. */
export function ticketTally(rows: TicketRec[]): Pick<BoMonth, "closeDays" | "closeN" | "replyDays" | "replyN" | "chat" | "topics" | "c2s" | "c2sDelivery" | "tones"> & { created: number } {
  const out = { created: rows.length, closeDays: 0, closeN: 0, replyDays: 0, replyN: 0, chat: 0, topics: {} as Record<string, number>, c2s: 0, c2sDelivery: 0, tones: {} as Record<string, number> };
  for (const r of rows) {
    const t = (r.topic ?? "").trim();
    out.topics[t] = (out.topics[t] ?? 0) + 1;
    if (r.c2s) { out.c2s++; if (t === "Delivery") out.c2sDelivery++; }
    const tone = (r.tone ?? "").trim().toLowerCase();
    out.tones[tone] = (out.tones[tone] ?? 0) + 1;
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

/** a month's figures all at nought - a month not counted yet adds `pending` */
export const emptyMonth = (): Omit<BoMonth, "ym"> => ({ created: 0, closed: 0, closeDays: 0, closeN: 0, replyDays: 0, replyN: 0, chat: 0, topics: {}, eso: 0, tsa: 0, all: 0, orders: 0, lines: 0, c2s: 0, c2sDelivery: 0, tones: {}, pcs: {} });

const avg = (sum: number, n: number) => (n ? sum / n : null);

/* ── the tickets one by one: where each came from, who has it, whose it is ─ */

/** where a Back Office ticket came from (SARCLA 03.11.2026: "how many came in automatic or customer") */
export const ORIGINS = ["Customer", "Chat", "Automatic & internal"] as const;
/** the e-mails HubSpot files on their own that no customer wrote - what the workbook counted in Others */
export const AUTO_TOPICS = ["Automatic e-mail", "Finance e-mail", "Internal e-mail", "GQS task update", "Spam or advertising", "Empty e-mail", "AVOR e-mail"];
/** tickets a system made, not an e-mail or a form (hs_object_source) */
const SYSTEM_SOURCES = new Set(["AUTOMATION_PLATFORM", "INTEGRATION", "API", "IMPORT", "WORKFLOWS", "BATCH_UPDATE"]);
export function originOf(topic: string | null | undefined, chat: boolean, objectSource?: string | null): (typeof ORIGINS)[number] {
  if (chat) return "Chat";
  if (AUTO_TOPICS.includes((topic ?? "").trim()) || SYSTEM_SOURCES.has((objectSource ?? "").trim().toUpperCase())) return "Automatic & internal";
  return "Customer";
}

/**
 * A month's tickets, each string once in `dict` and the rows pointing at it:
 * created: [day, topic, owner, origin, days to close x10 (-1 none), days to the first reply x10 (-1 none), C2S 0/1, tone, company]
 * closed (by close date): [day, topic, owner, origin, company] - owner and company as HubSpot ids ("" none).
 */
export type BoRows = { dict: string[]; created: number[][]; closed: number[][]; ids?: string[]; cids?: string[] };
/** from version 6 on, after `pc`: the net value of the ticket's orders (CHF and EUR as booked, whole), its articles
 *  ("article:line value|..." in `dict`, "" none) and where its profit centre was found (PC_FROM) */
export const RW = { day: 0, topic: 1, owner: 2, origin: 3, close: 4, reply: 5, c2s: 6, tone: 7, company: 8, pc: 9, value: 10, arts: 11, from: 12 } as const;
export const RCL = { day: 0, topic: 1, owner: 2, origin: 3, company: 4 } as const;
export type RowTicket = {
  id?: string; pc?: string | null; day: number; topic: string | null; owner: string | null; origin: string; toClose?: number | null; toReply?: number | null; c2s?: boolean; tone?: string | null; company: string | null;
  /** the net value of its orders, its articles with their line's value, where its profit centre came from (PC_FROM) */
  value?: number | null; arts?: [string, number][]; from?: number;
};
/**
 * Where a ticket's profit centre was found (SARCLA 04.11.2026: "WHY DO WE STILL HAVE No profit centre"): its linked
 * order's (the order's own, else most of its lines', else its customer's); else the articles named on the ticket
 * (Products & Pricing's profit centre); else its customer's main profit centre (major_profit_center). None found: why -
 * its customer buys across profit centres (4) or has bought nothing yet (5); no customer at all (0).
 */
export const PC_FROM = ["Not found", "Its order", "The articles named on it", "The customer's main profit centre", "Customer buying across profit centres", "Customer with no purchase yet"] as const;
/** a ticket's articles as kept: "article:value|article:value" */
export const artsText = (xs: [string, number][] | undefined) => (xs ?? []).map(([a, v]) => `${a}:${Math.round(v)}`).join("|");
export const artsOf = (s: string | undefined): [string, number][] => (s ? s.split("|").map((x) => { const i = x.lastIndexOf(":"); return [x.slice(0, i), Number(x.slice(i + 1)) || 0] as [string, number]; }) : []);
export function rowsOf(created: RowTicket[], closed: RowTicket[]): BoRows {
  const dict: string[] = [], at = new Map<string, number>();
  const ix = (x: string | null | undefined) => { const k = (x ?? "").trim(); let i = at.get(k); if (i === undefined) { i = dict.push(k) - 1; at.set(k, i); } return i; };
  const tenths = (ms: number | null | undefined) => (ms != null && ms > 0 ? Math.round((ms / DAY) * 10) : -1);
  return {
    dict,
    // the ticket's profit centre: its linked order's ("" - no order linked)
    created: created.map((t) => [t.day, ix(t.topic), ix(t.owner), ix(t.origin), tenths(t.toClose), tenths(t.toReply), t.c2s ? 1 : 0, ix((t.tone ?? "").toLowerCase()), ix(t.company), ix(t.pc),
      Math.round(t.value ?? 0), ix(artsText(t.arts)), t.from ?? 0]),
    closed: closed.map((t) => [t.day, ix(t.topic), ix(t.owner), ix(t.origin), ix(t.company)]),
    // each ticket's HubSpot id, beside its row - the lists of tickets behind a graph (SARCLA 03.11.2026)
    ids: created.map((t) => t.id ?? ""), cids: closed.map((t) => t.id ?? ""),
  };
}

/** The filters of the pages: values picked per breakdown (owners by their HubSpot id, customers by their company's facts). */
export type BoFilter = Partial<Record<"topic" | "person" | "origin" | "category" | "country" | "prio", string[]>>;
/** a company's facts the filters read: customer category, country, priority band - and its name, for the lists */
export type CoFacts = Record<string, [string, string, string] | [string, string, string, string]>;
const FACT = { category: 0, country: 1, prio: 2 } as const;
/** Does a ticket pass the filters - `topic`, `owner`, `origin`, `company` as strings. */
export function passes(f: BoFilter, co: CoFacts, t: { topic: string; owner: string; origin: string; company: string }): boolean {
  if (f.topic?.length && !f.topic.includes(topicLabel(t.topic))) return false;
  if (f.person?.length && !f.person.includes(t.owner)) return false;
  if (f.origin?.length && !f.origin.includes(t.origin)) return false;
  for (const k of ["category", "country", "prio"] as const) {
    if (!f[k]?.length) continue;
    const v = co[t.company]?.[FACT[k]] ?? "Not set";
    if (!f[k]!.includes(v)) return false;
  }
  return true;
}
export const filtering = (f: BoFilter) => Object.values(f).some((v) => v?.length);
/** A month with only the tickets that pass: the ticket figures counted again from its rows; orders, ESO, TSA as they are. */
export function filteredMonth(m: BoMonth, f: BoFilter, co: CoFacts): BoMonth {
  if (!m.rows || !filtering(f)) return m;
  const d = m.rows.dict;
  const out: BoMonth = { ...m, created: 0, closed: 0, closeDays: 0, closeN: 0, replyDays: 0, replyN: 0, chat: 0, topics: {}, c2s: 0, c2sDelivery: 0, tones: {} };
  for (const r of m.rows.created) {
    const t = { topic: d[r[RW.topic]], owner: d[r[RW.owner]], origin: d[r[RW.origin]], company: d[r[RW.company]] };
    if (!passes(f, co, t)) continue;
    out.created++;
    out.topics[t.topic] = (out.topics[t.topic] ?? 0) + 1;
    if (r[RW.close] >= 0) { out.closeDays += r[RW.close] / 10; out.closeN++; }
    if (r[RW.reply] >= 0) { out.replyDays += r[RW.reply] / 10; out.replyN++; }
    if (t.origin === "Chat") out.chat++;
    if (r[RW.c2s]) { out.c2s++; if (t.topic === "Delivery") out.c2sDelivery++; }
    const tone = d[r[RW.tone]];
    out.tones[tone] = (out.tones[tone] ?? 0) + 1;
  }
  for (const r of m.rows.closed) if (passes(f, co, { topic: d[r[RCL.topic]], owner: d[r[RCL.owner]], origin: d[r[RCL.origin]], company: d[r[RCL.company]] })) out.closed++;
  return out;
}

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
  const out: BoMonth = { ym: ms[0]?.ym ?? "", ...emptyMonth() };
  for (const m of ms) {
    if (m.pending) out.pending = true;
    for (const k of ["created", "closed", "closeDays", "closeN", "replyDays", "replyN", "chat", "eso", "tsa", "all", "orders", "lines", "c2s", "c2sDelivery"] as const) out[k] += m[k] ?? 0;
    for (const f of ["topics", "tones", "pcs"] as const) for (const [t, n] of Object.entries(m[f] ?? {})) out[f][t] = (out[f][t] ?? 0) + n;
    for (const [t, n] of Object.entries(m.linePcs ?? {})) { out.linePcs ??= {}; out.linePcs[t] = (out.linePcs[t] ?? 0) + n; }
    for (const [t, n] of Object.entries(m.valuePcs ?? {})) { out.valuePcs ??= {}; out.valuePcs[t] = (out.valuePcs[t] ?? 0) + n; }
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
  /** the tickets the sentiment sweep scored (positive, neutral, negative): the neutral and the negative share */
  neutral: number | null; negative: number | null;
  c2s: number | null; c2sDelivery: number | null;
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
    gqsCreated: t && g ? g.created : null, gqsSent: t && g ? avg(g.sentDays, g.sentN) : null, gqsResolution: t && g ? avg(g.doneDays, g.doneN) : null,
    perLine: r(m.created, m.lines), perOrder: r(m.created, m.orders), hoursPerTicket: hours != null ? r(hours, m.created) : null,
    eso: n(m.eso), esoPerLine: r(m.eso, m.lines), esoPerOrder: r(m.eso, m.orders),
    tsa: n(m.tsa), tsaPerLine: r(m.tsa, m.lines), tsaPerOrder: r(m.tsa, m.orders),
    all: n(m.all), allPerLine: r(m.all, m.lines), allPerOrder: r(m.all, m.orders),
    neutral: t ? ratio(m.tones?.neutral ?? 0, scored(m)) : null, negative: t ? ratio(m.tones?.negative ?? 0, scored(m)) : null,
    c2s: n(m.c2s ?? 0), c2sDelivery: n(m.c2sDelivery ?? 0),
  };
}
const scored = (m: BoMonth) => (m.tones?.positive ?? 0) + (m.tones?.neutral ?? 0) + (m.tones?.negative ?? 0);

/* ── ESO / TSA without the sales actions ──────────────────────────────── */

/**
 * The workbook counts the ESO's and the TSA's INBOUND tickets (its comments on September's 1,430 and 1,301: "sales
 * actions"; its new KPIs: "tickets ESO + TSA ... take the actions out"): the ESO Reports' own read sorts every ticket of
 * the two pipelines into incoming (a customer's request, Sales through GQS) and system (the UC hand-overs and the pushes -
 * erosion, win back, the September push, price checks). Its rows: year offset (0 this year, 1 the one before), month
 * 0-11, group (0 incoming), pipe (0 ESO, 1 TSA) - the columns given by `at`.
 */
export function inboundByMonth(rows: number[][], year: number, at: { year: number; month: number; group: number; pipe: number }): { eso: Record<string, number>; tsa: Record<string, number> } {
  const out = { eso: {} as Record<string, number>, tsa: {} as Record<string, number> };
  for (const r of rows) {
    if (r[at.group] !== 0) continue;
    const ym = `${year - r[at.year]}-${String(r[at.month] + 1).padStart(2, "0")}`;
    const k = (r[at.pipe] ?? 0) === 1 ? "tsa" : "eso";
    out[k][ym] = (out[k][ym] ?? 0) + 1;
  }
  return out;
}

/* ── what HubSpot does not hold: typed in per month (the workbook's own figures to start) ── */

export type TypedSeries = { id: string; title: string; note: string; unit: "pct" | "n"; target?: { value: number; lower?: boolean }; rows: { id: string; label: string }[] };
const OTD_ROWS: [string, string][] = [["online-special", "Online - Special"], ["online-standard", "Online - Standard"], ["online-all", "Online - All"],
  ...["DT", "KT", "FT", "ST", "AT"].flatMap((pc): [string, string][] => [[`${pc.toLowerCase()}-standard`, `Online - ${pc} - Standard`], [`${pc.toLowerCase()}-special`, `Online - ${pc} - Special`]])];
/**
 * Not in HubSpot (03.11.2026: no order carries a first confirmation date, a red/green status or its cause): the workbook's
 * OTD - with early call-offs, by the first confirmation date - its "KPI autonomy" (price pass rate, target 95 %; manual price
 * adjustments, target under 2.5 %; per mandant) and its stopped orders.
 */
export const TYPED: TypedSeries[] = [
  { id: "otd", title: "OTD", note: "On time against the first confirmation date, early call-offs counted", unit: "pct", rows: OTD_ROWS.map(([id, label]) => ({ id, label })) },
  { id: "pass", title: "Price pass rate", note: "Orders through without a hand on them", unit: "pct", target: { value: 0.95 }, rows: [{ id: "m100", label: "Mandant 100" }, { id: "m110", label: "Mandant 110" }] },
  { id: "price", title: "Manual price adjustments", note: "Order lines whose price was changed by hand", unit: "pct", target: { value: 0.025, lower: true }, rows: [{ id: "m100", label: "Mandant 100" }, { id: "m110", label: "Mandant 110" }] },
  { id: "stopped", title: "Stopped orders", note: "Magento orders transferred to the Back Office, those stopped, and why", unit: "n",
    rows: [{ id: "transferred", label: "Orders transferred" }, { id: "stopped", label: "Orders stopped" }, { id: "credit", label: "Stopped: credit limit" }, { id: "denomination", label: "Stopped: denomination" }, { id: "price", label: "Stopped: price missing" }] },
];
export type Typed = Record<string, Record<string, number>>;
export const typedKey = (series: string, row: string) => `${series}.${row}`;
const months26 = (xs: number[], scale = 1) => Object.fromEntries(xs.map((v, i) => [`2026-${String(i + 1).padStart(2, "0")}`, Math.round(v * scale * 10000) / 10000]));
/** The workbook's own figures (BO KPI, read 03.11.2026): OTD R4:Z16, price pass rate and manual price adjustments from its
 *  pictures, the stopped orders' 2025 history (Magento BO transferred, stopped). */
export const WORKBOOK_TYPED: Typed = {
  "otd.online-special": months26([0.66, 0.81, 0.78, 0.41, 0.43, 0.33, 0.736, 0.652, 0.724]),
  "otd.online-standard": months26([0.76, 0.82, 0.78, 0.78, 0.79, 0.77, 0.65, 0.81, 0.884]),
  "otd.online-all": months26([0.74, 0.82, 0.78, 0.71, 0.73, 0.68, 0.717, 0.773, 0.808]),
  "otd.dt-standard": months26([0.78, 0.76, 0.81, 0.81, 0.83, 0.82, 0.747, 0.841, 0.929]),
  "otd.dt-special": months26([0.73, 0.72, 0.73, 0.69, 0.58, 0.62, 0.654, 0.619, 0.776]),
  "otd.kt-standard": months26([0.70, 0.69, 0.68, 0.62, 0.66, 0.55, 0.694, 0.81, 0.773]),
  "otd.kt-special": months26([0.66, 0.84, 0.80, 0.37, 0.40, 0.28, 0.652, 0.662, 0.783]),
  "otd.ft-standard": months26([0.75, 0.82, 0.74, 0.79, 0.80, 0.76, 0.735, 0.836, 0.892]),
  "otd.ft-special": months26([0.48, 0.77, 0.48, 0.50, 0.65, 0.46, 0.696, 0.381, 0.769]),
  "otd.st-standard": months26([0.75, 0.86, 0.78, 0.71, 0.80, 0.76, 0.71, 0.746, 0.851]),
  "otd.st-special": months26([0.47, 0.46, 0.92, 0.59, 0.53, 0.40, 0.429, 0.50, 0.635]),
  "otd.at-standard": months26([0.66, 0.61, 0.66, 0.42, 0.52, 0.57, 0.669, 0.627, 0.702]),
  "otd.at-special": months26([0.44, 0.70, 0.64, 0.66, 0.40, 0.60, 0.40, 0.615, 0.708]),
  "pass.m100": months26([96.43, 96.66, 96.98, 96.64, 96.38, 96.85, 96.25, 96.48, 96.54], 0.01),
  "pass.m110": months26([95.50, 96.09, 97.03, 96.19, 96.04, 95.83, 96.17, 96.62, 95.57], 0.01),
  "price.m100": months26([3.41, 3.20, 2.93, 3.20, 3.57, 3.07, 3.69, 3.45, 3.35], 0.01),
  "price.m110": months26([4.43, 3.85, 2.87, 3.64, 3.93, 4.01, 3.62, 3.27, 4.33], 0.01),
  "stopped.transferred": { "2025-09": 4273, "2025-10": 4495, "2025-11": 4134, "2025-12": 3118 },
  "stopped.stopped": { "2025-09": 712, "2025-10": 674, "2025-11": 693, "2025-12": 497 },
};
/** a typed figure checked: a share 0-1 (typed 95.5 or 95.5 % is read as 95.5 %), a count 0 or more; empty = none */
export function checkTyped(unit: "pct" | "n", v: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === null || v === undefined || String(v).trim() === "") return { ok: true, value: null };
  const n = Number(String(v).replace(",", ".").replace("%", "").trim());
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: "That is not a figure." };
  if (unit === "pct") {
    const x = n > 1 ? n / 100 : n;
    return x > 1 ? { ok: false, error: "A share is 100 % at most." } : { ok: true, value: Math.round(x * 10000) / 10000 };
  }
  return { ok: true, value: Math.round(n) };
}

/** The topics the workbook has under "Others" today come one by one from the hub's classifier; kept apart, in this order. */
export const TOPIC_ORDER = [
  "Delivery", "Invoicing & Accounting", "Product Price", "Product Information", "Order Cancellation", "Certificates (ONLY FOR BO)",
  "Website Issue", "MS365", "Dashboard", "Others", "Automatic e-mail", "Finance e-mail", "Internal e-mail", "GQS task update",
  "Spam or advertising", "Empty e-mail", "AVOR e-mail",
];
export const topicLabel = (t: string) => (t ? t : "No topic");

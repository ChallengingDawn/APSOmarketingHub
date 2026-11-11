// KALREZ 6221 + 6230 -> EVOLAST - a one-shot call action (SARCLA 11.11.2026).
//
// The manufacturer stops Kalrez 6221 and 6230; webshop orders are taken until
// 27.11.2026 (apsoparts.com/en-INT/kalrez-6221-6230-discontinued). The direct
// replacements are evolast PB794 (for 6221) and PN794 (for 6230). Every customer
// who bought more than 1,000 CHF of 6221/6230 since 2022 in Switzerland (APSO CH)
// or more than 500 EUR anywhere else (APSO DE: Germany, Austria, Italy, France...)
// gets one call before 22.11.2026, on a ticket owned by the company owner (the
// territory owner Map assignment writes - the SAE Performis person for nearly all).
// "TSA Team" is the helpline inbox: those tickets stay unassigned in the TSA pipeline.
//
// The list was built once from OUR order lines, not from the BI pivot that
// circulated first: that file had no 6230 at all and missed revenue on 6221.
// It is frozen in data/kalrez_targets.json; the article lists in
// data/kalrez_articles.json come from Products & Pricing (714 Kalrez 6221/6230
// articles, 1,007 evolast PB794/PN794). A Swiss customer's figures are in CHF,
// everyone else's in EUR; the board's totals are in EUR.
//
// Pure: no HubSpot, no database, no JSON - kalrezData.ts holds the frozen list
// and the article lists; the loader hands over tickets and orders.

export type Compound = "6221" | "6230";
export type Evolast = "PB794" | "PN794";
export type Currency = "CHF" | "EUR";

export type KzArticle = { a: string; t: string; cpd: Compound; qty: number; value: number; last: string };
export type KzTarget = {
  un: string;
  companyId: string;
  /** Another HubSpot record of the same ERP customer, linked to the same ticket. */
  alsoCompanyIds?: string[];
  name: string;
  sae: string;
  mandant: "CH" | "DE";
  /** null = no named person (the "TSA Team" owner is the helpline inbox - never assign to it). */
  ownerId: string | null;
  ownerName: string;
  team: "ESO" | "TSA";
  /** The currency of every figure of this customer: CHF in Switzerland, EUR elsewhere. */
  cur: Currency;
  value: number;
  v6221: number;
  v6230: number;
  lastKalrez: string;
  articles: KzArticle[];
  moreArticles: number;
  orderIds: string[];
};

export const KZ = {
  id: "kalrez" as const,
  name: "Kalrez 6221/6230 discontinued",
  href: "/uc/kalrez-switch",
  line: "Customers who bought Kalrez 6221/6230 since 2022 - Switzerland above 1,000 CHF, every other country above 500 EUR - one call each to move them to evolast",
  /** First day whose orders and contacts count. */
  start: "2026-11-12",
  /** Calls done by (SARCLA: "call until 22 of november"). */
  callBy: "2026-11-22",
  /** The manufacturer's last order date for 6221/6230. */
  lastOrder: "2026-11-27",
  /** The ticket marker: <un>|2026-11. */
  keySuffix: "2026-11",
  prefix: "kalrez_switch",
};

export const REPLACEMENT: Record<Compound, Evolast> = { "6221": "PB794", "6230": "PN794" };

/** Article number -> compound, for the lines that matter here. */
export type KzArticles = { kalrez: Record<string, Compound>; evolast: Record<string, Evolast> };

/** Ticket pipelines and their "New" stage (as the September push and the Marc/Nancy pushes). */
export const PIPELINE = {
  ESO: { id: "1726599376", stage: "2338232556" },
  TSA: { id: "1726599377", stage: "2338232560" },
} as const;

/** One fixed rate, for an order in the other currency and for the board's EUR totals. */
export const CHF_PER_EUR = 0.94;
export function convert(v: number, from: Currency, to: Currency): number {
  if (from === to) return v;
  return from === "EUR" ? v * CHF_PER_EUR : v / CHF_PER_EUR;
}
export const toEur = (v: number, cur: Currency) => convert(v, cur, "EUR");

/* ── formatting ────────────────────────────────────────────────────────── */

/** 12345.6 -> 12'346 (the Swiss way the earlier ticket titles were written). */
export const amount = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
/** 2026-09-22 -> 22.09.2026 */
export const dmy = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");

/** The compounds this customer bought, biggest first. */
export function compoundsOf(t: Pick<KzTarget, "v6221" | "v6230">): Compound[] {
  return (["6221", "6230"] as Compound[]).filter((c) => (c === "6221" ? t.v6221 : t.v6230) > 0)
    .sort((a, b) => (b === "6221" ? t.v6221 : t.v6230) - (a === "6221" ? t.v6221 : t.v6230));
}

/** "evolast PN794 (for 6230) + evolast PB794 (for 6221)" */
export const offerText = (t: Pick<KzTarget, "v6221" | "v6230">) =>
  compoundsOf(t).map((c) => `evolast ${REPLACEMENT[c]} (for ${c})`).join(" + ");

/* ── the ticket ────────────────────────────────────────────────────────── */

export const kzKey = (t: Pick<KzTarget, "un">) => `${t.un}|${KZ.keySuffix}`;

export const kzSubject = (t: Pick<KzTarget, "value" | "cur" | "name">) =>
  `Kalrez 6221/6230 discontinued | ${amount(t.value)} ${t.cur} | ${t.name}`;

const listRule = (t: Pick<KzTarget, "mandant">) => (t.mandant === "CH" ? "APSO CH, more than 1,000 CHF" : "APSO DE, more than 500 EUR");

/** The ticket text: what to say, then what they bought. Short - the caller knows the process. */
export function kzBody(t: KzTarget): string {
  const cps = compoundsOf(t);
  const bought = cps.map((c) => `Kalrez ${c}`).join(" and ");
  const lines = [
    `Kalrez 6221 and 6230 are discontinued by the manufacturer. Last order date: ${dmy(KZ.lastOrder)}. Call before ${dmy(KZ.callBy)}.`,
    "",
    `Since 2022 they bought ${amount(t.value)} ${t.cur} of ${bought} (last order ${dmy(t.lastKalrez)}).`,
    `Offer: ${offerText(t)} - standard assortment, the sizes are in the article table on the shop.`,
    "",
    `Say this: "The manufacturer is ending ${bought}. We can still pass on orders until ${dmy(KZ.lastOrder)}; after that only stock is left. ` +
      `The direct replacement is ${cps.map((c) => `evolast ${REPLACEMENT[c]}`).join(" / ")} - shall I send you an offer for the sizes you use?"`,
    "",
    `What they bought since 2022 (article · qty · ${t.cur} · last order):`,
    ...t.articles.map((a) => `- ${a.a} ${a.t} · ${fmtQty(a.qty)} pc · ${amount(a.value)} ${t.cur} · ${dmy(a.last)}`),
    ...(t.moreArticles ? [`- and ${t.moreArticles} more Kalrez 6221/6230 article${t.moreArticles === 1 ? "" : "s"}`] : []),
    "",
    `List: ${listRule(t)} of Kalrez 6221/6230 since 2022 - SAE ${t.sae}.`,
  ];
  return lines.join("\n");
}

const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : q.toFixed(1));

/** Every property the ticket is created with. */
export function kzTicketProperties(t: KzTarget): Record<string, string> {
  const p = PIPELINE[t.team];
  const props: Record<string, string> = {
    subject: kzSubject(t),
    content: kzBody(t),
    hs_pipeline: p.id,
    hs_pipeline_stage: p.stage,
    hs_ticket_priority: toEur(t.value, t.cur) >= 10_000 ? "HIGH" : "MEDIUM",
    source_type: "AUTOMATION",
    [`${KZ.prefix}_key`]: kzKey(t),
    [`${KZ.prefix}_value`]: String(Math.round(t.value)),
    [`${KZ.prefix}_currency`]: t.cur,
    [`${KZ.prefix}_6221`]: String(Math.round(t.v6221)),
    [`${KZ.prefix}_6230`]: String(Math.round(t.v6230)),
    [`${KZ.prefix}_last_order`]: t.lastKalrez,
    [`${KZ.prefix}_offer`]: offerText(t),
    [`${KZ.prefix}_sae`]: t.sae,
  };
  if (t.ownerId) props.hubspot_owner_id = t.ownerId;
  return props;
}

/** The ticket properties of the action, created once in their own group. */
export const KZ_PROPERTY_GROUP = { name: KZ.prefix, label: "Kalrez 6221/6230 discontinued" };
export const KZ_PROPERTIES: { name: string; label: string; type: "string" | "number" | "date"; fieldType: "text" | "number" | "date" | "textarea" }[] = [
  { name: `${KZ.prefix}_key`, label: "Kalrez switch - key", type: "string", fieldType: "text" },
  { name: `${KZ.prefix}_value`, label: "Kalrez switch - 6221/6230 bought since 2022", type: "number", fieldType: "number" },
  { name: `${KZ.prefix}_currency`, label: "Kalrez switch - currency (CHF in Switzerland, EUR elsewhere)", type: "string", fieldType: "text" },
  { name: `${KZ.prefix}_6221`, label: "Kalrez switch - 6221 since 2022", type: "number", fieldType: "number" },
  { name: `${KZ.prefix}_6230`, label: "Kalrez switch - 6230 since 2022", type: "number", fieldType: "number" },
  { name: `${KZ.prefix}_last_order`, label: "Kalrez switch - last 6221/6230 order", type: "date", fieldType: "date" },
  { name: `${KZ.prefix}_offer`, label: "Kalrez switch - evolast to offer", type: "string", fieldType: "text" },
  { name: `${KZ.prefix}_sae`, label: "Kalrez switch - SAE Performis", type: "string", fieldType: "text" },
];

/* ── the board ─────────────────────────────────────────────────────────── */

export type KzTicket = {
  id: string;
  subject: string;
  stage: string;
  closed: boolean;
  resolution: string | null;
  lastActivity: string | null;
  contacted: number;
};

/** One order line since the start that matters here, in the customer's currency. */
export type KzLine = { date: string; no: string; article: string; kind: "kalrez" | "evolast"; compound: string; value: number };

export type KzCard = KzTarget & {
  ticket: KzTicket | null;
  lastContacted: string | null;
  lastCall: string | null;
  lines: KzLine[];
};

export type KzData = {
  today: string;
  generated: string;
  ticketsFound: number;
  contactSignal: boolean;
  cards: KzCard[];
};

export type KzState = "switched" | "lastbuy" | "contacted" | "closed" | "open";
export const KZ_STATE_LABEL: Record<KzState, string> = {
  switched: "Ordered evolast",
  lastbuy: "Last Kalrez order, no evolast yet",
  contacted: "Called, no order yet",
  closed: "Closed without an order",
  open: "Not called yet",
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** In the customer's own currency. */
export const evolastValue = (c: Pick<KzCard, "lines">) => sum(c.lines.filter((l) => l.kind === "evolast").map((l) => l.value));
export const kalrezValue = (c: Pick<KzCard, "lines">) => sum(c.lines.filter((l) => l.kind === "kalrez").map((l) => l.value));
/** Who calls, as the board names it: the owner, or "Unassigned (TSA)" for the helpline-inbox customers. */
export const ownerLabel = (c: Pick<KzTarget, "ownerId" | "ownerName">) => (c.ownerId ? c.ownerName : "Unassigned (TSA)");

export const ticketTouched = (c: KzCard) => !!c.ticket && (!!c.ticket.lastActivity || c.ticket.contacted > 0);

/** Called since the start: activity on the ticket, or a call, e-mail or meeting logged on the company. */
export const kzContacted = (c: KzCard) => ticketTouched(c) || (!!c.lastContacted && c.lastContacted >= KZ.start);

export function kzContactDay(c: KzCard): string | null {
  const days = [c.ticket?.lastActivity ?? null, c.lastContacted].filter((d): d is string => !!d && d >= KZ.start);
  return days.length ? days.sort().at(-1)! : null;
}

export function kzState(c: KzCard): KzState {
  if (evolastValue(c) > 0) return "switched";
  if (kalrezValue(c) > 0) return "lastbuy";
  if (kzContacted(c)) return "contacted";
  if (c.ticket?.closed) return "closed";
  return "open";
}

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** Whole days from today to a date, never below 0. */
export const daysTo = (today: string, iso: string) => Math.max(0, Math.round((ms(iso) - ms(today)) / DAY));

/** Every money total is in EUR (CHF customers converted at CHF_PER_EUR). */
export type KzSummary = {
  customers: number;
  tickets: number;
  listEur: number;
  contacted: number;
  stillToCall: number;
  stillToCallEur: number;
  switched: number;
  evolastEur: number;
  lastBuy: number;
  kalrezEur: number;
  closed: number;
  unassigned: number;
  daysToCallBy: number;
  daysToLastOrder: number;
  byState: { state: KzState; customers: number }[];
  byOwner: { owner: string; customers: number; listEur: number; contacted: number; switched: number; evolastEur: number }[];
  outcomes: { label: string; count: number }[];
};

export function kzSummary(data: Pick<KzData, "cards" | "today" | "ticketsFound">): KzSummary {
  const cards = data.cards;
  const eur = (c: KzCard, v: number) => toEur(v, c.cur);
  const states = new Map<KzState, number>();
  const owners = new Map<string, KzSummary["byOwner"][number]>();
  const outcomes = new Map<string, number>();
  for (const c of cards) {
    const s = kzState(c);
    states.set(s, (states.get(s) ?? 0) + 1);
    const label = ownerLabel(c);
    const o = owners.get(label) ?? { owner: label, customers: 0, listEur: 0, contacted: 0, switched: 0, evolastEur: 0 };
    o.customers += 1;
    o.listEur += eur(c, c.value);
    o.contacted += kzContacted(c) ? 1 : 0;
    o.switched += evolastValue(c) > 0 ? 1 : 0;
    o.evolastEur += eur(c, evolastValue(c));
    owners.set(label, o);
    if (c.ticket?.closed) {
      const r = c.ticket.resolution?.trim() || "No resolution recorded";
      outcomes.set(r, (outcomes.get(r) ?? 0) + 1);
    }
  }
  const notCalled = cards.filter((c) => !kzContacted(c));
  return {
    customers: cards.length,
    tickets: data.ticketsFound,
    listEur: sum(cards.map((c) => eur(c, c.value))),
    contacted: cards.length - notCalled.length,
    stillToCall: notCalled.length,
    stillToCallEur: sum(notCalled.map((c) => eur(c, c.value))),
    switched: cards.filter((c) => evolastValue(c) > 0).length,
    evolastEur: sum(cards.map((c) => eur(c, evolastValue(c)))),
    lastBuy: cards.filter((c) => kalrezValue(c) > 0).length,
    kalrezEur: sum(cards.map((c) => eur(c, kalrezValue(c)))),
    closed: cards.filter((c) => c.ticket?.closed).length,
    unassigned: cards.filter((c) => !c.ownerId).length,
    daysToCallBy: daysTo(data.today, KZ.callBy),
    daysToLastOrder: daysTo(data.today, KZ.lastOrder),
    byState: (["switched", "lastbuy", "contacted", "closed", "open"] as KzState[]).map((state) => ({ state, customers: states.get(state) ?? 0 })),
    byOwner: [...owners.values()].sort((a, b) => b.customers - a.customers || b.listEur - a.listEur),
    outcomes: [...outcomes.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}

/** Call next: not called, ticket open, nothing ordered since the start - biggest first (in EUR). */
export const kzCallNext = (cards: KzCard[]) =>
  cards.filter((c) => !kzContacted(c) && !c.ticket?.closed && evolastValue(c) <= 0 && kalrezValue(c) <= 0)
    .sort((a, b) => toEur(b.value, b.cur) - toEur(a.value, a.cur));

/** Reads one order's lines (order_positions_json) and keeps the Kalrez 6221/6230 and evolast PB794/PN794 ones, in the customer's currency. */
export function kzLinesOf(
  order: { no: string; date: string; currency: string | null; positionsJson: string | null }, arts: KzArticles, cur: Currency,
): KzLine[] {
  let pos: { a?: unknown; r?: unknown }[] = [];
  try {
    const parsed = JSON.parse(order.positionsJson || "[]");
    if (Array.isArray(parsed)) pos = parsed;
  } catch {
    return [];
  }
  const oc = (order.currency ?? "").toUpperCase();
  const from: Currency = oc === "EUR" || oc === "CHF" ? oc : cur;
  const out: KzLine[] = [];
  for (const p of pos) {
    const a = String(p.a ?? "");
    const r = Number(p.r);
    const value = Number.isFinite(r) ? convert(r, from, cur) : 0;
    const k = arts.kalrez[a];
    if (k) { out.push({ date: order.date, no: order.no, article: a, kind: "kalrez", compound: k, value }); continue; }
    const e = arts.evolast[a];
    if (e) out.push({ date: order.date, no: order.no, article: a, kind: "evolast", compound: e, value });
  }
  return out;
}

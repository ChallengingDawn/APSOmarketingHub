// KALREZ 6221 + 6230 -> EVOLAST - a one-shot call action (SARCLA 11.11.2026).
//
// The manufacturer stops Kalrez 6221 and 6230; webshop orders are taken until
// 27.11.2026 (apsoparts.com/en-INT/kalrez-6221-6230-discontinued). The direct
// replacements are evolast PB794 (for 6221) and PN794 (for 6230). Every Swiss
// customer (APSO CH, mandant 100) who bought more than 1,000 CHF of 6221/6230
// since 2022 gets one call, on a ticket owned by their SAE Performis person
// (who is also the company owner for all 36), before 22.11.2026.
//
// The list was built once from OUR order lines, not from the BI pivot that
// circulated first: that file had no 6230 at all and missed revenue on 6221.
// It is frozen in data/kalrez_ch_targets.json; the article lists in
// data/kalrez_articles.json come from Products & Pricing (714 Kalrez 6221/6230
// articles, 1,007 evolast PB794/PN794).
//
// Pure: no HubSpot, no database, no JSON - kalrezData.ts holds the frozen list
// and the article lists; the loader hands over tickets and orders.

export type Compound = "6221" | "6230";
export type Evolast = "PB794" | "PN794";

export type KzArticle = { a: string; t: string; cpd: Compound; qty: number; chf: number; last: string };
export type KzTarget = {
  un: string;
  companyId: string;
  name: string;
  sae: string;
  /** null = no named person (the "TSA Team" owner is the helpline inbox - never assign to it). */
  ownerId: string | null;
  ownerName: string;
  team: "ESO" | "TSA";
  chf: number;
  chf6221: number;
  chf6230: number;
  lastKalrez: string;
  articles: KzArticle[];
  moreArticles: number;
  orderIds: string[];
};

export const KZ = {
  id: "kalrez" as const,
  name: "Kalrez 6221/6230 discontinued",
  href: "/uc/kalrez-switch",
  line: "Swiss customers who bought more than 1,000 CHF of Kalrez 6221/6230 since 2022 - one call each to move them to evolast",
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

/** EUR order lines are turned into CHF with one fixed rate - the list's threshold was set in CHF. */
export const EUR_TO_CHF = 0.94;

/* ── formatting ────────────────────────────────────────────────────────── */

/** 12345.6 -> 12'346 (the Swiss way the earlier ticket titles were written). */
export const chf = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
/** 2026-09-22 -> 22.09.2026 */
export const dmy = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");

/** The compounds this customer bought, biggest first. */
export function compoundsOf(t: Pick<KzTarget, "chf6221" | "chf6230">): Compound[] {
  return (["6221", "6230"] as Compound[]).filter((c) => (c === "6221" ? t.chf6221 : t.chf6230) > 0)
    .sort((a, b) => (b === "6221" ? t.chf6221 : t.chf6230) - (a === "6221" ? t.chf6221 : t.chf6230));
}

/** "evolast PN794 (for 6230) + evolast PB794 (for 6221)" */
export const offerText = (t: Pick<KzTarget, "chf6221" | "chf6230">) =>
  compoundsOf(t).map((c) => `evolast ${REPLACEMENT[c]} (for ${c})`).join(" + ");

/* ── the ticket ────────────────────────────────────────────────────────── */

export const kzKey = (t: Pick<KzTarget, "un">) => `${t.un}|${KZ.keySuffix}`;

export const kzSubject = (t: Pick<KzTarget, "chf" | "name">) => `Kalrez 6221/6230 discontinued | ${chf(t.chf)} CHF | ${t.name}`;

/** The ticket text: what to say, then what they bought. Short - the caller knows the process. */
export function kzBody(t: KzTarget): string {
  const cps = compoundsOf(t);
  const bought = cps.map((c) => `Kalrez ${c}`).join(" and ");
  const lines = [
    `Kalrez 6221 and 6230 are discontinued by the manufacturer. Last order date: ${dmy(KZ.lastOrder)}. Call before ${dmy(KZ.callBy)}.`,
    "",
    `Since 2022 they bought ${chf(t.chf)} CHF of ${bought} (last order ${dmy(t.lastKalrez)}).`,
    `Offer: ${offerText(t)} - standard assortment, the sizes are in the article table on the shop.`,
    "",
    `Say this: "The manufacturer is ending ${bought}. We can still pass on orders until ${dmy(KZ.lastOrder)}; after that only stock is left. ` +
      `The direct replacement is ${cps.map((c) => `evolast ${REPLACEMENT[c]}`).join(" / ")} - shall I send you an offer for the sizes you use?"`,
    "",
    "What they bought since 2022 (article · qty · CHF · last order):",
    ...t.articles.map((a) => `- ${a.a} ${a.t} · ${fmtQty(a.qty)} pc · ${chf(a.chf)} CHF · ${dmy(a.last)}`),
    ...(t.moreArticles ? [`- and ${t.moreArticles} more Kalrez 6221/6230 article${t.moreArticles === 1 ? "" : "s"}`] : []),
    "",
    `Swiss list: more than 1,000 CHF of Kalrez 6221/6230 since 2022 - SAE ${t.sae}.`,
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
    hs_ticket_priority: t.chf >= 10_000 ? "HIGH" : "MEDIUM",
    source_type: "AUTOMATION",
    [`${KZ.prefix}_key`]: kzKey(t),
    [`${KZ.prefix}_value`]: String(Math.round(t.chf)),
    [`${KZ.prefix}_6221`]: String(Math.round(t.chf6221)),
    [`${KZ.prefix}_6230`]: String(Math.round(t.chf6230)),
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
  { name: `${KZ.prefix}_value`, label: "Kalrez switch - 6221/6230 bought since 2022 (CHF)", type: "number", fieldType: "number" },
  { name: `${KZ.prefix}_6221`, label: "Kalrez switch - 6221 since 2022 (CHF)", type: "number", fieldType: "number" },
  { name: `${KZ.prefix}_6230`, label: "Kalrez switch - 6230 since 2022 (CHF)", type: "number", fieldType: "number" },
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

/** One order line since the start that matters here: a Kalrez 6221/6230 line or an evolast PB794/PN794 line. */
export type KzLine = { date: string; no: string; article: string; kind: "kalrez" | "evolast"; compound: string; chf: number };

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
export const evolastChf = (c: Pick<KzCard, "lines">) => sum(c.lines.filter((l) => l.kind === "evolast").map((l) => l.chf));
export const kalrezChf = (c: Pick<KzCard, "lines">) => sum(c.lines.filter((l) => l.kind === "kalrez").map((l) => l.chf));
export const ticketTouched = (c: KzCard) => !!c.ticket && (!!c.ticket.lastActivity || c.ticket.contacted > 0);

/** Called since the start: activity on the ticket, or a call, e-mail or meeting logged on the company. */
export const kzContacted = (c: KzCard) => ticketTouched(c) || (!!c.lastContacted && c.lastContacted >= KZ.start);

export function kzContactDay(c: KzCard): string | null {
  const days = [c.ticket?.lastActivity ?? null, c.lastContacted].filter((d): d is string => !!d && d >= KZ.start);
  return days.length ? days.sort().at(-1)! : null;
}

export function kzState(c: KzCard): KzState {
  if (evolastChf(c) > 0) return "switched";
  if (kalrezChf(c) > 0) return "lastbuy";
  if (kzContacted(c)) return "contacted";
  if (c.ticket?.closed) return "closed";
  return "open";
}

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** Whole days from today to a date, never below 0. */
export const daysTo = (today: string, iso: string) => Math.max(0, Math.round((ms(iso) - ms(today)) / DAY));

export type KzSummary = {
  customers: number;
  tickets: number;
  listChf: number;
  contacted: number;
  stillToCall: number;
  stillToCallChf: number;
  switched: number;
  evolastChf: number;
  lastBuy: number;
  kalrezChf: number;
  closed: number;
  daysToCallBy: number;
  daysToLastOrder: number;
  byState: { state: KzState; customers: number }[];
  byOwner: { owner: string; customers: number; listChf: number; contacted: number; switched: number; evolastChf: number }[];
  outcomes: { label: string; count: number }[];
};

export function kzSummary(data: Pick<KzData, "cards" | "today" | "ticketsFound">): KzSummary {
  const cards = data.cards;
  const states = new Map<KzState, number>();
  const owners = new Map<string, KzSummary["byOwner"][number]>();
  const outcomes = new Map<string, number>();
  for (const c of cards) {
    const s = kzState(c);
    states.set(s, (states.get(s) ?? 0) + 1);
    const o = owners.get(c.ownerName) ?? { owner: c.ownerName, customers: 0, listChf: 0, contacted: 0, switched: 0, evolastChf: 0 };
    o.customers += 1;
    o.listChf += c.chf;
    o.contacted += kzContacted(c) ? 1 : 0;
    o.switched += evolastChf(c) > 0 ? 1 : 0;
    o.evolastChf += evolastChf(c);
    owners.set(c.ownerName, o);
    if (c.ticket?.closed) {
      const r = c.ticket.resolution?.trim() || "No resolution recorded";
      outcomes.set(r, (outcomes.get(r) ?? 0) + 1);
    }
  }
  const notCalled = cards.filter((c) => !kzContacted(c));
  return {
    customers: cards.length,
    tickets: data.ticketsFound,
    listChf: sum(cards.map((c) => c.chf)),
    contacted: cards.length - notCalled.length,
    stillToCall: notCalled.length,
    stillToCallChf: sum(notCalled.map((c) => c.chf)),
    switched: cards.filter((c) => evolastChf(c) > 0).length,
    evolastChf: sum(cards.map(evolastChf)),
    lastBuy: cards.filter((c) => kalrezChf(c) > 0).length,
    kalrezChf: sum(cards.map(kalrezChf)),
    closed: cards.filter((c) => c.ticket?.closed).length,
    daysToCallBy: daysTo(data.today, KZ.callBy),
    daysToLastOrder: daysTo(data.today, KZ.lastOrder),
    byState: (["switched", "lastbuy", "contacted", "closed", "open"] as KzState[]).map((state) => ({ state, customers: states.get(state) ?? 0 })),
    byOwner: [...owners.values()].sort((a, b) => b.customers - a.customers || b.listChf - a.listChf),
    outcomes: [...outcomes.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}

/** Call next: not called, ticket open, nothing ordered since the start - biggest first. */
export const kzCallNext = (cards: KzCard[]) =>
  cards.filter((c) => !kzContacted(c) && !c.ticket?.closed && evolastChf(c) <= 0 && kalrezChf(c) <= 0).sort((a, b) => b.chf - a.chf);

/** Reads one order's lines (order_positions_json) and keeps the Kalrez 6221/6230 and evolast PB794/PN794 ones, in CHF. */
export function kzLinesOf(
  order: { no: string; date: string; currency: string | null; positionsJson: string | null }, arts: KzArticles,
): KzLine[] {
  let pos: { a?: unknown; r?: unknown }[] = [];
  try {
    const parsed = JSON.parse(order.positionsJson || "[]");
    if (Array.isArray(parsed)) pos = parsed;
  } catch {
    return [];
  }
  const fx = (order.currency ?? "").toUpperCase() === "EUR" ? EUR_TO_CHF : 1;
  const out: KzLine[] = [];
  for (const p of pos) {
    const a = String(p.a ?? "");
    const r = Number(p.r);
    const value = Number.isFinite(r) ? r * fx : 0;
    const k = arts.kalrez[a];
    if (k) { out.push({ date: order.date, no: order.no, article: a, kind: "kalrez", compound: k, chf: value }); continue; }
    const e = arts.evolast[a];
    if (e) out.push({ date: order.date, no: order.no, article: a, kind: "evolast", compound: e, chf: value });
  }
  return out;
}

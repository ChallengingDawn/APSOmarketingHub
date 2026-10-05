// PRICE-CHECK TICKETS, READ BACK - what ESO and TSA did with them.
//
// The detector here (priceCheckTickets.ts) raises them; this reads every ticket
// carrying a `price_check_key`, with its live stage, owner and resolution, in the
// erosion tickets' shape so the UC outcome reports (win rate, reasons, teams and
// people) read them unchanged. Moved from the APSOAssistant micro app, which
// read the same tickets through the Compass connector (price_check_load.py).

import { hubspotFetchJson } from "./hubspot";
import { ownerNames, ticketStages } from "./erosion";
import { TICKET_PROPERTIES, fixText, mapTicket, type ErosionTicket } from "../erosion/model";

export type PriceCheckTicket = ErosionTicket & {
  value: number;
  articles: string | null;
  articleCount: number;
  profitCenters: string | null;
  unpriced: number;
  /** The shop day the customer priced the articles. */
  checkedOn: string | null;
  companyId: string | null;
};

export type PriceCheckTickets = { generatedAt: string; tickets: PriceCheckTicket[] };

const TTL_MS = 5 * 60_000;
const MAX_PAGES = 100;
const PROPS = [
  ...TICKET_PROPERTIES.filter((p) => !p.startsWith("erosion_")),
  "price_check_key", "price_check_date", "price_check_articles", "price_check_article_count",
  "price_check_value", "price_check_profit_centers", "price_check_unpriced_articles",
];

let cache: { at: number; p: Promise<PriceCheckTickets> } | null = null;

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Ticket -> company id and name. A subject the ESO workflow rewrote no longer carries the name. */
async function companies(ids: string[], signal?: AbortSignal) {
  const byTicket = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[] }>({
      path: "/crm/v4/associations/tickets/companies/batch/read", method: "POST", useTicketsToken: true, signal,
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const row of r.results ?? []) {
      const to = row.to?.[0]?.toObjectId;
      if (row.from?.id && to !== undefined) byTicket.set(String(row.from.id), String(to));
    }
  }
  const names = new Map<string, string>();
  const cids = [...new Set(byTicket.values())];
  for (let i = 0; i < cids.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: { id: string; properties?: { name?: string | null } }[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST", useTicketsToken: true, signal,
      body: { inputs: cids.slice(i, i + 100).map((id) => ({ id })), properties: ["name"] },
    });
    for (const row of r.results ?? []) if (row.properties?.name) names.set(row.id, fixText(row.properties.name));
  }
  return { byTicket, names };
}

async function load(signal?: AbortSignal): Promise<PriceCheckTickets> {
  const [stages, owners] = await Promise.all([ticketStages(signal), ownerNames(signal)]);
  const raw: { id: string; properties?: Record<string, unknown> }[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await hubspotFetchJson<{ results?: { id: string; properties?: Record<string, unknown> }[]; paging?: { next?: { after?: string } } }>({
      path: "/crm/v3/objects/tickets/search", method: "POST", useTicketsToken: true, signal,
      body: {
        filterGroups: [{ filters: [{ propertyName: "price_check_key", operator: "HAS_PROPERTY" }] }],
        properties: PROPS, sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: 100,
        ...(after ? { after } : {}),
      },
    });
    raw.push(...(res.results ?? []));
    after = res.paging?.next?.after;
    if (!after) break;
  }

  // a failed company read costs the names, not the screen
  let co: Awaited<ReturnType<typeof companies>> | null = null;
  try {
    co = await companies(raw.map((r) => r.id), signal);
  } catch (e) {
    console.warn(`[price-checks] company names unavailable: ${(e as Error).message}`);
  }

  const tickets = raw.map((r): PriceCheckTicket => {
    const t = mapTicket(r, stages, owners);
    const p = r.properties ?? {};
    const key = str(p.price_check_key) ?? "";
    const companyId = co?.byTicket.get(r.id) ?? null;
    // "PRICE CHECK | 3 articles | 1'234 EUR | Company" - the name is the last part, when the subject survived
    const fromSubject = t.subject.startsWith("PRICE CHECK |") ? t.subject.split(" | ").at(-1)?.trim() || null : null;
    return {
      ...t,
      amount: num(p.price_check_value),
      article: str(p.price_check_articles),
      articleDescription: str(p.price_check_profit_centers),
      company: (companyId && co?.names.get(companyId)) || fromSubject,
      un: key.includes("|") ? key.split("|")[0] : null,
      lastOrder: null,
      value: num(p.price_check_value),
      articles: str(p.price_check_articles),
      articleCount: Math.trunc(num(p.price_check_article_count)),
      profitCenters: str(p.price_check_profit_centers),
      unpriced: Math.trunc(num(p.price_check_unpriced_articles)),
      checkedOn: str(p.price_check_date)?.slice(0, 10) ?? null,
      companyId,
    };
  });
  return { generatedAt: new Date().toISOString(), tickets };
}

export async function fetchPriceCheckTickets(opts: { refresh?: boolean } = {}): Promise<PriceCheckTickets> {
  if (cache && !opts.refresh && Date.now() - cache.at < TTL_MS) return cache.p;
  const p = load();
  cache = { at: Date.now(), p };
  p.catch(() => { if (cache?.p === p) cache = null; });
  return p;
}

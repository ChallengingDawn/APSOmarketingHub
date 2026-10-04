// THE EROSION DETECTOR'S READS - everything the rules in src/lib/erosion/detector.ts
// need, read from HubSpot the way the connector reads it, so a preview here and a
// run on the connector see the same world.
//
// PREVIEW ONLY. Nothing in this file writes to HubSpot. The write path (creating
// and merging tickets, associations) is added only when the hub takes over from
// the connector, and only after the shadow comparison has shown both agree.

import { hubspotFetchJson } from "./hubspot";
import { IntegrationError } from "./status";
import { ownerNames } from "./erosion";
import fixmapJson from "../erosion/article_fixmap.json";
import {
  CUR_YEAR, PREV_YEAR, aggregate, buildGroups, buildOutlook, draftTicket, lastDayOfMonthBefore, memoryFromTickets,
  outlookCompanies, selectCandidates, type Company, type ExistingTicket, type FixMap, type OrderRec, type Resolved, type RunReport,
  type TicketDraft, type OutlookItem,
} from "../erosion/detector";

const FIXMAP = fixmapJson as unknown as FixMap;
const PP_OBJ = "2-200042439";
/** Monthly grouping (and with it the month map) went live on the connector on this day. */
export const MONTH_MERGE_FROM = "2026-10-01";

type SearchPage<P> = { total?: number; results?: { id: string; properties?: P }[]; paging?: { next?: { after?: string } } };

const ORDER_PROPS = [
  "order_order_number", "order_order_date", "order_positions_json", "order_mandant", "order_customer_number",
  "order_order_type", "order_order_status", "order_invoice_date",
];

/** UTC midnight of a YYYY-MM-01 day, in epoch ms - what the connector's naive datetime gives on a UTC host. */
const utcMs = (y: number, m: number) => Date.UTC(y, m - 1, 1);

/**
 * Every order dated PREV_YEAR-01 up to today, in monthly windows. A failed page
 * stops the whole run: a partial scan makes every article in the missing part
 * look unsold and invents erosion for customers who never stopped buying. A
 * window over HubSpot's 10,000-result cap stops it too, rather than truncate.
 */
export async function pullOrders(today: string, signal?: AbortSignal): Promise<OrderRec[]> {
  const out: OrderRec[] = [];
  let y = Number(PREV_YEAR), m = 1;
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  while (y < ty || (y === ty && m <= tm)) {
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    let after: string | undefined;
    for (let page = 0; ; page++) {
      const res = await hubspotFetchJson<SearchPage<Record<string, unknown>>>({
        path: "/crm/v3/objects/orders/search",
        method: "POST",
        body: {
          filterGroups: [{ filters: [
            { propertyName: "order_order_date", operator: "GTE", value: String(utcMs(y, m)) },
            { propertyName: "order_order_date", operator: "LT", value: String(utcMs(ny, nm)) },
          ] }],
          properties: ORDER_PROPS,
          limit: 100,
          ...(after ? { after } : {}),
        },
        signal,
      });
      if (page === 0 && (res.total ?? 0) > 10_000) {
        throw new IntegrationError(`Orders ${y}-${String(m).padStart(2, "0")}: ${res.total} exceed the 10,000 search cap - refusing a truncated scan.`);
      }
      for (const r of res.results ?? []) out.push({ id: r.id, props: r.properties ?? {} });
      after = res.paging?.next?.after;
      if (!after) break;
    }
    [y, m] = [ny, nm];
  }
  return out;
}

/** Every ticket the detector has raised, with the articles it carries now. */
export async function existingErosionTickets(signal?: AbortSignal): Promise<ExistingTicket[]> {
  const out: ExistingTicket[] = [];
  let after: string | undefined;
  for (;;) {
    const res = await hubspotFetchJson<SearchPage<Record<string, string | null>>>({
      path: "/crm/v3/objects/tickets/search",
      method: "POST",
      body: {
        filterGroups: [{ filters: [{ propertyName: "erosion_key", operator: "HAS_PROPERTY" }] }],
        properties: ["erosion_customer_number", "erosion_article", "createdate"],
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
        limit: 100,
        ...(after ? { after } : {}),
      },
      useTicketsToken: true,
      signal,
    });
    for (const r of res.results ?? []) {
      const p = r.properties ?? {};
      const un = (p.erosion_customer_number ?? "").trim();
      if (!un) continue;
      out.push({
        id: r.id,
        un,
        articles: (p.erosion_article ?? "").split(",").map((a) => a.trim()).filter(Boolean),
        created: (p.createdate ?? "").slice(0, 10),
      });
    }
    after = res.paging?.next?.after;
    if (!after) break;
  }
  return out;
}

/** company_unique_number -> company, the field the connector's un2id index is crawled from. */
export async function companiesByUn(uns: string[], signal?: AbortSignal): Promise<Map<string, Company>> {
  const map = new Map<string, Company>();
  const list = [...new Set(uns)];
  for (let i = 0; i < list.length; i += 100) {
    let after: string | undefined;
    for (;;) {
      const res = await hubspotFetchJson<SearchPage<Record<string, string | null>>>({
        path: "/crm/v3/objects/companies/search",
        method: "POST",
        body: {
          filterGroups: [{ filters: [{ propertyName: "company_unique_number", operator: "IN", values: list.slice(i, i + 100) }] }],
          properties: ["name", "hubspot_owner_id", "company_unique_number"],
          sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
          limit: 100,
          ...(after ? { after } : {}),
        },
        signal,
      });
      for (const r of res.results ?? []) {
        const p = r.properties ?? {};
        const un = (p.company_unique_number ?? "").trim();
        // the connector's index is a dict built crawling ascending ids: the LAST company with a number wins
        if (un) map.set(un, { id: r.id, name: p.name ?? "", ownerId: (p.hubspot_owner_id ?? "").trim() });
      }
      after = res.paging?.next?.after;
      if (!after) break;
    }
  }
  return map;
}

/** No company owner: the owner of the contact on one of the first two previous-year orders. */
async function ownerFromBuyer(orderIds: string[], signal?: AbortSignal): Promise<string> {
  for (const oid of orderIds.slice(0, 2)) {
    const assoc = await hubspotFetchJson<{ results?: { toObjectId: number | string }[] }>({
      path: `/crm/v4/objects/orders/${oid}/associations/contacts`, signal,
    }).catch(() => ({ results: [] as { toObjectId: number | string }[] }));
    const first = assoc.results?.[0];
    if (first) {
      const c = await hubspotFetchJson<{ properties?: { hubspot_owner_id?: string | null } }>({
        path: `/crm/v3/objects/contacts/${first.toObjectId}?properties=hubspot_owner_id`, signal,
      }).catch(() => null);
      return (c?.properties?.hubspot_owner_id ?? "").trim();
    }
  }
  return "";
}

/** The catalogue description and the P&P record of an article (10-digit or zero-padded). */
async function catalogue(art: string, signal?: AbortSignal): Promise<{ id: string | null; desc: string }> {
  const res = await hubspotFetchJson<SearchPage<{ article_description?: string | null }>>({
    path: `/crm/v3/objects/${PP_OBJ}/search`,
    method: "POST",
    body: {
      filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: [art, art.padStart(10, "0")] }] }],
      properties: ["article_description"],
      limit: 1,
    },
    signal,
  });
  const hit = res.results?.[0];
  return { id: hit?.id ?? null, desc: hit?.properties?.article_description ?? "" };
}

export type DetectorPreview = {
  today: string;
  ordersScanned: number;
  noCustomer: number;
  candidates: number;
  skippedOpenOrder: number;
  report: RunReport;
  /** One per company and month - new tickets, and merges onto this month's existing ticket. */
  tickets: (TicketDraft & { mergeInto: string | null; ppIds: string[] })[];
  outlook: { generated: string; days: number; items: OutlookItem[] };
  keysBefore: number;
};

/**
 * What the detector would do today, computed from HubSpot alone. `existing` lets a
 * caller pass the "before" picture of the tickets (the shadow check does, to ask
 * what would have been raised before the connector raised it).
 */
export async function previewDetector(opts: {
  today: string;
  existing?: ExistingTicket[];
  extraKeys?: string[];
  signal?: AbortSignal;
}): Promise<DetectorPreview> {
  const { today, signal } = opts;
  const orders = await pullOrders(today, signal);
  const { agg, noCust } = aggregate(orders, FIXMAP);
  const tickets = opts.existing ?? (await existingErosionTickets(signal));
  const memory = memoryFromTickets(tickets, agg, opts.extraKeys ?? []);
  // the connector's month map holds only tickets raised since monthly grouping went
  // live, pruned to this month and the last
  const keep = new Set([today.slice(0, 7), lastDayOfMonthBefore(today).slice(0, 7)]);
  const monthTickets = memoryFromTickets(tickets.filter((t) => t.created >= MONTH_MERGE_FROM), agg).month;
  const month = new Map([...monthTickets].filter(([k]) => keep.has(k.split("|").pop() ?? "")));

  const { cands, openOrders } = selectCandidates(agg, { horizon: today, keys: memory.keys });

  const companies = await companiesByUn(cands.map((c) => c.un), signal);
  const resolved: Resolved[] = [];
  for (const c of cands) {
    const company = companies.get(c.un) ?? null;
    let owner = company?.ownerId ?? "";
    if (company && !owner) owner = await ownerFromBuyer(c.a.oidsPrev, signal);
    resolved.push({ ...c, company, owner });
  }
  const { groups, report } = buildGroups(resolved, agg, month);

  const drafts: DetectorPreview["tickets"] = [];
  for (const g of groups.values()) {
    const descs: Record<string, string> = {};
    const ppIds: string[] = [];
    for (const m of g.members) {
      const cat = await catalogue(m.art, signal);
      if (cat.id) ppIds.push(cat.id);
      descs[m.art] = (cat.desc || m.a.text || "").trim();
    }
    drafts.push({ ...draftTicket(g, descs), mergeInto: month.get(g.mkey)?.tid ?? null, ppIds });
  }

  // the forecast, under the same rules - keys as they will be once today's tickets exist
  const keysAfter = new Set(memory.keys);
  for (const d of drafts) for (const k of d.keys) keysAfter.add(k);
  const forecastCompanies = await companiesByUn(outlookCompanies(agg, today, keysAfter), signal);
  for (const [un, c] of companies) forecastCompanies.set(un, c);
  const names = await ownerNames(signal).catch(() => new Map<string, string>());
  const outlook = buildOutlook(agg, {
    today,
    keys: keysAfter,
    companyOf: (un) => {
      const c = forecastCompanies.get(un);
      return c ? { name: c.name, ownerId: c.ownerId } : null;
    },
    ownerName: (o) => names.get(o),
  });

  return {
    today, ordersScanned: orders.length, noCustomer: noCust, candidates: cands.length, skippedOpenOrder: openOrders,
    report, tickets: drafts, outlook, keysBefore: memory.keys.size,
  };
}

export { CUR_YEAR };

// SMART SUB-TICKETS - the hub's page for the HubSpot app that creates sub-tickets from a ticket (the "Smart
// Sub-Ticket" card and 7 more), moved from "SARCLA - Smart Ticket Creator" into the hub's HubSpot app on
// 18.10.2026 (SARCLA: "where is the smart sub ticket app on the hub?"). The cards run in HubSpot; this reads
// what they created: tickets stamped by either app (hs_object_source_id) that are linked to their parent ticket.

import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";

/** The two apps that create smart sub-tickets: the old Smart Ticket Creator, and the hub's own since 18.10.2026. */
export const OLD_APP = "40488847";
export const HUB_APP = "50521064";
export const GQS = "1726786775";
export const PIPELINE: Record<string, string> = {
  "1726786777": "Back Office", [GQS]: "GQS", "1726599376": "ESO", "1726599377": "TSA", "1553929403": "Special Prices", "1737150687": "Product Management",
};
const PROPS = ["subject", "hs_pipeline", "createdate", "hubspot_owner_id", "margin__", "target_price", "hs_object_source_id", "gqs_type_of_request", "enquiry_category"];
const MAX = 1000;

type Obj = { id: string; properties?: Record<string, string | null> };
type Page = { results?: Obj[]; total?: number; paging?: { next?: { after?: string } } };
const hs = <T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });

/** HubSpot keeps margin__ as a fraction (0.25) - shown as a percentage; a value above 1.5 is already one. */
export const marginPercent = (v: string | null | undefined): number | null => {
  const n = v === null || v === undefined || v === "" ? NaN : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round((Math.abs(n) <= 1.5 ? n * 100 : n) * 10) / 10;
};
const filled = (v: string | null | undefined) => v !== null && v !== undefined && String(v).trim() !== "";

export type SubTicket = {
  id: string; subject: string | null; pipeline: string | null; createdAt: string; owner: string | null;
  app: "hub" | "old"; parentId: string | null; parentSubject: string | null;
  gqsType: string | null; category: string | null; marginPct: number | null; targetPrice: number | null; gqsComplete: boolean | null;
};

export async function smartTicketReport(from: string, to: string) {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`) + 86_400_000;
  const all: Obj[] = [];
  let after: string | undefined;
  do {
    const j = await hs<Page>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [
        { propertyName: "hs_object_source_id", operator: "IN", values: [OLD_APP, HUB_APP] },
        { propertyName: "createdate", operator: "GTE", value: String(fromMs) },
        { propertyName: "createdate", operator: "LT", value: String(toMs) },
      ] }],
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], properties: PROPS, limit: 100, ...(after ? { after } : {}),
    });
    all.push(...(j.results ?? []));
    after = j.paging?.next?.after;
  } while (after && all.length < MAX);

  // the parent: the ticket each one is linked to (the function links every sub-ticket to the ticket it came from)
  const links = new Map<string, string[]>();
  for (let i = 0; i < all.length; i += 100) {
    const j = await hs<{ results?: { from: { id: string }; to?: { toObjectId: string | number }[] }[] }>(
      "/crm/v4/associations/tickets/tickets/batch/read", "POST", { inputs: all.slice(i, i + 100).map((t) => ({ id: t.id })) });
    for (const r of j.results ?? []) links.set(String(r.from.id), (r.to ?? []).map((x) => String(x.toObjectId)));
  }
  // every ticket of the old app is a sub-ticket; the hub's app also makes erosion, price-check and DirectCut
  // tickets - only those linked to another ticket are sub-tickets
  const subs = all.filter((t) => t.properties?.hs_object_source_id === OLD_APP || (links.get(t.id) ?? []).length > 0);
  const parentIds = [...new Set(subs.slice(0, 200).map((t) => (links.get(t.id) ?? [])[0]).filter(Boolean))];
  const parents = new Map<string, string | null>();
  for (let i = 0; i < parentIds.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/batch/read", "POST", { properties: ["subject"], inputs: parentIds.slice(i, i + 100).map((id) => ({ id })) });
    for (const o of j.results ?? []) parents.set(String(o.id), o.properties?.subject ?? null);
  }
  const owners = await ownerNames().catch(() => new Map<string, string>());

  const rows: SubTicket[] = subs.map((t) => {
    const p = t.properties ?? {};
    const parentId = (links.get(t.id) ?? [])[0] ?? null;
    const isGqs = p.hs_pipeline === GQS;
    return {
      id: t.id, subject: p.subject ?? null, pipeline: PIPELINE[p.hs_pipeline ?? ""] ?? p.hs_pipeline ?? null, createdAt: p.createdate ?? "",
      owner: p.hubspot_owner_id ? owners.get(p.hubspot_owner_id) ?? `owner ${p.hubspot_owner_id}` : null,
      app: p.hs_object_source_id === HUB_APP ? "hub" : "old", parentId, parentSubject: parentId ? parents.get(parentId) ?? null : null,
      gqsType: p.gqs_type_of_request ?? null, category: p.enquiry_category ?? null,
      marginPct: marginPercent(p.margin__), targetPrice: filled(p.target_price) ? Number(p.target_price) : null,
      gqsComplete: isGqs ? filled(p.margin__) && filled(p.target_price) : null,
    };
  });
  const byPipeline: Record<string, number> = {};
  for (const r of rows) byPipeline[r.pipeline ?? "-"] = (byPipeline[r.pipeline ?? "-"] ?? 0) + 1;
  const gqs = rows.filter((r) => r.gqsComplete !== null);
  return {
    totals: {
      created: rows.length, capped: all.length >= MAX,
      gqs: gqs.length, gqsComplete: gqs.filter((r) => r.gqsComplete).length,
      hubApp: rows.filter((r) => r.app === "hub").length, oldApp: rows.filter((r) => r.app === "old").length,
      people: new Set(rows.map((r) => r.owner).filter(Boolean)).size,
    },
    byPipeline,
    rows: rows.slice(0, 200),
  };
}

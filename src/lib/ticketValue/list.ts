// TICKET VALUE, TICKET BY TICKET - the Tickets tab (SARCLA 24.10.2026: the time frame on top, no day chips, only ESO and
// TSA). The ESO and TSA tickets created in the days chosen, newest first, read from HubSpot page by page - their value,
// confidence and path as they are on the ticket now - and, for the tickets the hub handled in the last 21 days, what it
// wrote (the change log).

import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { recentRows } from "./engine";
import { pathOf, zurichMidnight, type Pipe, type Values } from "./model";
import { PATH_PROPS, PIPE_IDS } from "./figures";

export const PER_PAGE = 15;
export type ListRow = {
  id: string; subject: string; pipeline: "ESO" | "TSA"; created: string; now: Values; path: string;
  /** what the hub did last, when it is still in the change log (21 days) */
  hub: { at: string; why: string; before: Values; changed: boolean; error?: string } | null;
};
type Raw = { id: string; properties: Record<string, string | null> };
const CONFS = ["high", "medium", "low", "unqualified"];
const startOf = (day: string, add = 0) => zurichMidnight(Date.parse(`${day}T12:00:00Z`), add);

export async function ticketList(from: string, to: string, pipe: Pipe, conf: string, page: number): Promise<{ total: number; page: number; rows: ListRow[] }> {
  const filters: Record<string, unknown>[] = [
    pipe === "both" ? { propertyName: "hs_pipeline", operator: "IN", values: Object.values(PIPE_IDS) } : { propertyName: "hs_pipeline", operator: "EQ", value: PIPE_IDS[pipe] },
    { propertyName: "createdate", operator: "BETWEEN", value: String(startOf(from)), highValue: String(startOf(to, 1) - 1) },
  ];
  if (CONFS.includes(conf)) filters.push({ propertyName: "sales_potential_confidence", operator: "EQ", value: conf });
  else if (conf === "(none)") filters.push({ propertyName: "sales_potential_confidence", operator: "NOT_HAS_PROPERTY" });
  const r = await hubspotRetry<{ total?: number; results?: Raw[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
    filterGroups: [{ filters }], properties: [...PATH_PROPS, "createdate", "hs_pipeline"],
    sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: PER_PAGE, ...(page > 0 ? { after: String(page * PER_PAGE) } : {}),
  } });
  const log = new Map<string, Awaited<ReturnType<typeof recentRows>>[number]>();
  for (const x of await recentRows(21)) if (x.verdict === "live" && !log.has(x.ticketId)) log.set(x.ticketId, x); // newest first
  const rows = (r.results ?? []).map((t): ListRow => {
    const p = t.properties, l = log.get(String(t.id));
    return {
      id: String(t.id), subject: p.subject ?? "", pipeline: p.hs_pipeline === PIPE_IDS.TSA ? "TSA" : "ESO", created: p.createdate ?? "",
      now: { sales_potential_estimate: p.sales_potential_estimate ?? null, sales_potential_source: p.sales_potential_source ?? null, sales_potential_confidence: p.sales_potential_confidence ?? null },
      path: pathOf(p),
      hub: l ? { at: l.at, why: l.trigger === "created" ? "created" : l.stage ?? "stage", before: l.before, changed: !!l.written?.changed, error: l.written?.error } : null,
    };
  });
  return { total: r.total ?? rows.length, page, rows };
}

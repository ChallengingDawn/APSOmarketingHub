// TICKET VALUE BY MONTH - the Overview's time frame (SARCLA 24.10.2026: "a time frame as the other applications, not the
// tab and the time limitation"). Every ESO and TSA ticket created this year, read from HubSpot itself - its value, source
// and confidence as they are on the ticket now - and added up per month, pipeline, path and confidence. The page picks
// the months (the Digital Growth pages' picker). A background report: kept 2 hours, read again after.

import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { reportProgress, slowReport } from "@/lib/integrations/slowReport";
import { pathOf, type FigureBucket } from "./model";

export type Figures = { shape: 1; year: number; months: number; buckets: FigureBucket[] };
const KEY = "ticketValue:figures";
const SHAPE = 1;
const PIPES = [["1726599376", "ESO"], ["1726599377", "TSA"]] as const;
const PROPS = ["sales_potential_estimate", "sales_potential_source", "sales_potential_confidence", "subject", "erosion_key", "sept_push_target", "price_check_key", "hs_tag_ids"];
type Raw = { id: string; properties: Record<string, string | null> };

export const figures = () => slowReport<Figures>(KEY, (v) => (v?.shape !== SHAPE ? 0 : 2 * 3600_000), build);

async function build(): Promise<Figures> {
  const now = new Date();
  const year = now.getUTCFullYear(), months = now.getUTCMonth() + 1;
  const acc = new Map<string, FigureBucket>();
  for (let m = 0; m < months; m++) {
    const from = Date.UTC(year, m, 1), to = Date.UTC(year, m + 1, 1) - 1;
    for (const [id, pipe] of PIPES) {
      reportProgress(KEY, `reading ${pipe} tickets of ${new Date(from).toLocaleString("en", { month: "long", timeZone: "UTC" })}`);
      let cursor = "0";
      for (let page = 0; page < 200; page++) {
        const r = await hubspotRetry<{ results?: Raw[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
          filterGroups: [{ filters: [
            { propertyName: "hs_pipeline", operator: "EQ", value: id },
            { propertyName: "createdate", operator: "BETWEEN", value: String(from), highValue: String(to) },
            { propertyName: "hs_object_id", operator: "GT", value: cursor },
          ] }],
          properties: PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 100,
        } });
        const res = r.results ?? [];
        for (const t of res) {
          const p = t.properties;
          const path = pathOf(p), conf = (p.sales_potential_confidence ?? "").trim() || "(none)";
          const k = `${m}|${pipe}|${path}|${conf}`;
          const e = acc.get(k) ?? { m, pipe, path, conf, n: 0, value: 0 };
          e.n++;
          e.value += Number(p.sales_potential_estimate) || 0;
          acc.set(k, e);
        }
        if (res.length < 100) break;
        cursor = String(res[res.length - 1].id);
      }
    }
  }
  return { shape: SHAPE, year, months, buckets: [...acc.values()] };
}

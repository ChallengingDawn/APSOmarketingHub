// TICKET VALUE BY DAY - the page's time frame (SARCLA 24.10.2026: "a time frame on top like the other applications").
// Every ESO and TSA ticket created in the last 400 days, read from HubSpot itself - its value, source and confidence as
// they are on the ticket now - and added up per day (Zurich), pipeline, path, confidence and open or closed (the tiles'
// split, SARCLA 24.10.2026). The page sums the days of
// the hub's reporting window (the picker in the header: up to 365 days). Only sums are kept, no ticket. A background
// report: kept 2 hours, read again after.

import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { pathOf, zurichDay, zurichMidnight, type DayBucket } from "./model";
import { ALL_CLOSED_STAGES } from "./rules";

export type Figures = { shape: 3; from: string; to: string; buckets: DayBucket[] };
const KEY = "ticketValue:figures";
const SHAPE = 3;
export const DAYS_BACK = 400;
export const PIPE_IDS = { ESO: "1726599376", TSA: "1726599377" } as const;
export const PATH_PROPS = ["sales_potential_estimate", "sales_potential_source", "sales_potential_confidence", "subject", "erosion_key", "sept_push_target", "price_check_key", "hs_tag_ids"];
type Raw = { id: string; properties: Record<string, string | null> };

/**
 * The days' figures. While a new read runs, the report hands back the last answer it kept - and an answer of an older
 * shape (the months of 24.10 afternoon) is no answer here: it is left out, and the page waits for the new read.
 */
export async function figures(): Promise<SlowState<Figures>> {
  const s = await slowReport<Figures>(KEY, (v) => (v?.shape !== SHAPE ? 0 : 2 * 3600_000), build);
  return s.value && s.value.shape !== SHAPE ? { ...s, value: undefined, computing: !s.error } : s;
}

async function build(): Promise<Figures> {
  const since = zurichMidnight(Date.now(), -DAYS_BACK);
  const acc = new Map<string, DayBucket>();
  let read = 0;
  for (const [pipe, id] of Object.entries(PIPE_IDS) as ["ESO" | "TSA", string][]) {
    let cursor = "0";
    for (let page = 0; page < 500; page++) {
      reportProgress(KEY, `reading the ${pipe} tickets - ${read.toLocaleString("en-US")} so far`);
      const r = await hubspotRetry<{ results?: Raw[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
        filterGroups: [{ filters: [
          { propertyName: "hs_pipeline", operator: "EQ", value: id },
          { propertyName: "createdate", operator: "GTE", value: String(since) },
          { propertyName: "hs_object_id", operator: "GT", value: cursor },
        ] }],
        properties: [...PATH_PROPS, "createdate", "hs_pipeline_stage"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 100,
      } });
      const res = r.results ?? [];
      for (const t of res) {
        const p = t.properties;
        const day = zurichDay(Date.parse(p.createdate ?? "") || 0);
        const path = pathOf(p), conf = (p.sales_potential_confidence ?? "").trim() || "(none)";
        const state = ALL_CLOSED_STAGES.has(p.hs_pipeline_stage ?? "") ? "closed" : "open";
        const k = `${day}|${pipe}|${path}|${conf}|${state}`;
        const e = acc.get(k) ?? [day, pipe, path, conf, 0, 0, state];
        e[4]++;
        e[5] += Number(p.sales_potential_estimate) || 0;
        acc.set(k, e);
      }
      read += res.length;
      if (res.length < 100) break;
      cursor = String(res[res.length - 1].id);
    }
  }
  return { shape: SHAPE, from: zurichDay(since + 12 * 3600_000), to: zurichDay(Date.now()), buckets: [...acc.values()] };
}

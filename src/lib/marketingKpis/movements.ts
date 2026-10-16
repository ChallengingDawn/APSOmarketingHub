// SEGMENT MOVEMENTS (KPI C08) - who moved up or down, month by month, in the three
// things that place a company: its sales priority, its APSO segment and its yearly
// potential (SARCLA 16.10: "both - priority, segments and potential").
//
// HubSpot keeps every value a company property ever had, with its day and who set
// it. One read of every company with that history (the list API, 50 companies a
// page, about 1,200 pages, 8 to 9 minutes) is folded into counts per month: up,
// down, and first set, each also by a person in HubSpot (the rest is the engine,
// workflows and imports). Counts only - no company is kept. Read twice a day; the
// page shows the last read while a new one runs.
//
// Up and down, and the folding: moves.ts.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { firstMonth, movesOf, tally, type Entry, type Move, type MoveKind, type Movements } from "./moves";

export type { MoveKind, MonthCount, Movements } from "./moves";

const KEY = "marketingKpis:movements:v1";
const TTL_MS = 12 * 60 * 60 * 1000;

export function movements(): Promise<SlowState<Movements>> {
  return slowReport(KEY, TTL_MS, build);
}

async function build(): Promise<Movements> {
  const from = `${new Date().getUTCFullYear() - 1}-01`;
  const props = ["sales_priority", "apso_customer", "yearly_customer_potential"];
  const kindOf: Record<string, MoveKind> = { sales_priority: "prio", apso_customer: "segment", yearly_customer_potential: "potential" };
  const all: Move[] = [];
  const since: Movements["since"] = { prio: null, segment: null, potential: null };
  let companies = 0;
  let after: string | undefined;
  for (;;) {
    const qs = `limit=50&archived=false&properties=${props.join(",")}&propertiesWithHistory=${props.join(",")}${after ? `&after=${after}` : ""}`;
    const r = await hubspotFetchJson<{ results?: { propertiesWithHistory?: Record<string, Entry[]> }[]; paging?: { next?: { after?: string } } }>({ path: `/crm/v3/objects/companies?${qs}` });
    for (const c of r.results ?? []) {
      companies++;
      for (const [p, h] of Object.entries(c.propertiesWithHistory ?? {})) {
        const kind = kindOf[p];
        if (!kind || !Array.isArray(h)) continue;
        all.push(...movesOf(kind, h, from));
        const f = firstMonth(h);
        if (f && (!since[kind] || f < since[kind]!)) since[kind] = f;
      }
    }
    if (companies % 2000 < 50) reportProgress(KEY, `reading the companies' history: ${companies.toLocaleString("en")} so far`);
    after = r.paging?.next?.after;
    if (!after) break;
  }
  return { generatedAt: new Date().toISOString(), from, companies, since, ...tally(all) };
}

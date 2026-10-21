// THE AVERAGE FIRST ORDER - the value the hub gives a new registrant's ticket (SARCLA 20.10.2026 chose "Average first
// order": what a new customer's first order is worth on average, from real orders). Over the newest 300 companies whose
// first order (order_first_order_date) is in the last 12 months: their orders of that day, net
// (order_total_net_revenue). An order number counts once - its .000 document (the order as placed) when there is one,
// else its deliveries added up; credit notes are left out (memory: the .000 and its deliveries are the same goods).
// Worked out 30 companies a run, so a run stays short; the figure is kept a week, the last one stays until a new one
// is finished.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { averageOf } from "./model";
import { firstOrderValue } from "./rules";

const KV = "ticketValue:firstOrder";
const COMPANIES = 300;
const PER_RUN = 30;
const KEEP_MS = 7 * 86400_000;

export type FirstOrder = {
  /** the last finished figure */
  avg: number | null; median: number | null; n: number; at: string | null;
  /** the one being worked out */
  next: { started: string; companies: { id: string; day: string; name: string }[]; values: Record<string, number | null> } | null;
};
const EMPTY: FirstOrder = { avg: null, median: null, n: 0, at: null, next: null };

type Raw = { id: string; properties: Record<string, string | null> };
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

export const firstOrderState = async () => (await kvGet<FirstOrder>(KV)) ?? EMPTY;

/** A step of the work (at most 30 companies); returns the figure to use now. */
export async function firstOrderStep(more: () => boolean): Promise<FirstOrder> {
  const s = await firstOrderState();
  const fresh = s.at && Date.now() - Date.parse(s.at) < KEEP_MS;
  if (fresh && !s.next) return s;
  if (!s.next) {
    const since = String(Date.now() - 365 * 86400_000);
    const companies: { id: string; day: string; name: string }[] = [];
    let after: string | undefined;
    while (companies.length < COMPANIES) {
      const r = await hubspotRetry<{ results?: Raw[]; paging?: { next?: { after?: string } } }>({
        path: "/crm/v3/objects/companies/search", method: "POST",
        body: { filterGroups: [{ filters: [{ propertyName: "order_first_order_date", operator: "GTE", value: since }] }], properties: ["name", "order_first_order_date"], sorts: [{ propertyName: "order_first_order_date", direction: "DESCENDING" }], limit: 100, ...(after ? { after } : {}) },
      });
      for (const c of r.results ?? []) if (c.properties.order_first_order_date) companies.push({ id: String(c.id), day: c.properties.order_first_order_date.slice(0, 10), name: c.properties.name ?? "" });
      after = r.paging?.next?.after;
      if (!after) break;
    }
    s.next = { started: new Date().toISOString(), companies: companies.slice(0, COMPANIES), values: {} };
  }
  const n = s.next;
  let done = 0;
  for (const c of n.companies) {
    if (c.id in n.values) continue;
    if (done >= PER_RUN || !more()) break;
    const from = dayMs(c.day);
    const r = await hubspotRetry<{ results?: Raw[] }>({
      path: "/crm/v3/objects/orders/search", method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "associations.company", operator: "EQ", value: c.id }, { propertyName: "order_order_date", operator: "BETWEEN", value: String(from), highValue: String(from + 86_399_999) }] }], properties: ["hs_order_name", "order_total_net_revenue", "order_order_status"], limit: 100 },
    });
    n.values[c.id] = firstOrderValue((r.results ?? []).map((o) => ({ name: o.properties.hs_order_name ?? "", net: Number(o.properties.order_total_net_revenue) || 0, status: o.properties.order_order_status ?? "" })));
    done++;
  }
  if (n.companies.every((c) => c.id in n.values)) {
    const a = averageOf(Object.values(n.values));
    Object.assign(s, { avg: a.avg, median: a.median, n: a.n, at: new Date().toISOString(), next: null });
  }
  await kvSet(KV, s);
  return s;
}

// PRODUCTS REPORTS > VIEWS AGAINST ORDERS - THE VISITS' FUNNEL READ (SARCLA 01.11.2026 on the products funnel: "data can't be
// accurate, it's too simple, only one graph"): GA4's visits month by month at each step of the shop - saw articles (a list or a
// product page: view_item), put one in the cart, began the check-out, bought - this year and last. The visits themselves are
// the Engage read's (engageMonthly), already kept. A read of its own, so the Engage read the Marketing KPIs share is not
// asked again; kept through slowReport and read again every six hours. The counting is in ./viewsOrders.ts (visitsFunnelOf).

import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { slowReport, type SlowState } from "@/lib/integrations/slowReport";
import type { PathMonths } from "./viewsOrders";

const KEY = "products:visitsFunnel:v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const STEP = { view_item: 0, add_to_cart: 1, begin_checkout: 2, purchase: 3 } as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function visitsFunnelSource(): Promise<SlowState<{ generatedAt: string; months: PathMonths }>> {
  return slowReport(KEY, TTL_MS, async () => {
    const now = new Date();
    const year = now.getUTCFullYear(), py = year - 1;
    const months: PathMonths = {};
    for (const [from, to] of [[`${py}-01-01`, `${py}-12-31`], [`${year}-01-01`, iso(now)]]) {
      const r = await fetchGa4Report({ name: "shopPathMonthly", from, to });
      for (const row of r.rows) {
        const ym = String(row.keys[0] ?? ""), at = STEP[(row.keys[1] ?? "") as keyof typeof STEP];
        if (!/^\d{6}$/.test(ym) || at === undefined) continue;
        (months[`${ym.slice(0, 4)}-${ym.slice(4, 6)}`] ??= [0, 0, 0, 0])[at] += row.values[0] ?? 0;
      }
    }
    return { generatedAt: now.toISOString(), months };
  });
}

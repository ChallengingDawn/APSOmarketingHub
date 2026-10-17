// ONLINE SHARE OF ORDERS (KPI C06) - the read: every order of the customers
// cube's three years, which of them came through the shop, by the company's
// priority, segment and the other dimensions (SARCLA 16.10: "you know how many
// online orders come via the connector and those that only come via Compass").
// The rules are in onlineShare.ts.
//
// 1. The archived orders (the list API, about 100 pages): the web records the hub
//    archived once the ERP's deliveries covered them - their order numbers.
// 2. The orders, month by month by order date (the search, 200 a page, a month
//    split in halves when it holds more than the search's 10,000).
// 3. Each order's company (the association, 1,000 orders a call), and each
//    company's labels (100 a call) - as on the customers cube (customers.ts).
// About 5 minutes; read every 6 hours, the page shows the last read meanwhile.
// Counts and sums only - no company, no order.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { ownerNames } from "@/lib/integrations/erosion";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { CANCELLED } from "@/lib/connectors/steps/orderRules";
import { DIM_PROPS, labelsOf } from "./customers";
import type { Dim } from "./cube";
import { classifySearchCustomers, foldOnline, groupOrders, splitNumber, webMark, type OnlineCube, type OrderRec } from "./onlineShare";
import { fetchGa4Report } from "@/lib/integrations/ga4Reports";

const KEY = "marketingKpis:online:v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const PROPS = ["order_order_number", "order_order_date", "order_total_net_revenue", "hs_external_order_id", "order_channel", "order_web_order_number", "hs_pipeline_stage"];

export function onlineCube(): Promise<SlowState<OnlineCube>> {
  // a read stored before the customers from search existed (17.10.2026) is read again at once
  return slowReport(KEY, (v: OnlineCube) => (!v?.searchCustomers && !v?.searchCustomersError ? 0 : TTL_MS), build);
}

type Obj = { id: string; properties?: Record<string, string | null> };
type Page = { results?: Obj[]; total?: number; paging?: { next?: { after?: string } } };

/** order_order_date is epoch millis as text, or an ISO date. */
const monthOf = (v: string | null | undefined) => {
  if (!v) return "";
  const d = /^\d+$/.test(v) ? new Date(Number(v)) : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 7);
};

async function build(): Promise<OnlineCube> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const years = [year, year - 1, year - 2];

  // 1. the archived web records, by order number
  const archivedWeb = new Set<string>();
  // the shop's order number (GA4's transaction id) -> the order it belongs to, archived web records included
  const byShopNumber = new Map<string, string>();
  const noteShopNumber = (p: Record<string, string | null | undefined>, key: string) => {
    for (const k of [p.hs_external_order_id, p.order_web_order_number]) if (k) byShopNumber.set(String(k).trim(), key);
  };
  let after: string | undefined;
  let archived = 0;
  for (;;) {
    const r = await hubspotFetchJson<Page>({ path: `/crm/v3/objects/orders?limit=100&archived=true&properties=order_order_number,hs_external_order_id,order_channel,order_web_order_number${after ? `&after=${after}` : ""}` });
    for (const o of r.results ?? []) {
      archived++;
      const s = splitNumber(o.properties?.order_order_number);
      if (s && webMark(o.properties ?? {})) archivedWeb.add(s[0]);
      if (s) noteShopNumber(o.properties ?? {}, s[0]);
    }
    if (archived % 2000 < 100) reportProgress(KEY, `reading the archived web orders: ${archived.toLocaleString("en")}`);
    after = r.paging?.next?.after;
    if (!after) break;
  }

  // 2. the orders, month by month
  const recs: OrderRec[] = [];
  const readRange = async (from: number, to: number): Promise<void> => {
    const filters = [
      { propertyName: "order_order_date", operator: "GTE", value: String(from) },
      { propertyName: "order_order_date", operator: "LT", value: String(to) },
    ];
    let a: string | undefined;
    let first = true;
    do {
      const r = await hubspotFetchJson<Page>({
        path: "/crm/v3/objects/orders/search", method: "POST",
        body: { filterGroups: [{ filters }], properties: PROPS, limit: 200, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], ...(a ? { after: a } : {}) },
      });
      // the search stops at 10,000: a fuller range is read in halves
      if (first && (r.total ?? 0) > 9_900 && to - from > 86_400_000) {
        const mid = from + Math.floor((to - from) / 2);
        await readRange(from, mid);
        await readRange(mid, to);
        return;
      }
      first = false;
      for (const o of r.results ?? []) {
        const p = o.properties ?? {};
        noteShopNumber(p, splitNumber(p.order_order_number)?.[0] ?? `web:${o.id}`);
        recs.push({
          id: String(o.id), number: String(p.order_order_number ?? ""), month: monthOf(p.order_order_date),
          value: Number(p.order_total_net_revenue) || 0, web: webMark(p), cancelled: p.hs_pipeline_stage === CANCELLED,
        });
      }
      a = r.paging?.next?.after;
    } while (a);
  };
  for (let y = years[2]; y <= year; y++) {
    for (let m = 0; m < 12 && (y < year || m <= now.getUTCMonth()); m++) {
      reportProgress(KEY, `reading the orders of ${y}-${String(m + 1).padStart(2, "0")}: ${recs.length.toLocaleString("en")} so far`);
      await readRange(Date.UTC(y, m, 1), Date.UTC(y, m + 1, 1));
    }
  }
  const orders = groupOrders(recs, archivedWeb);

  // 3. each order's company, then each company's labels
  const picks = [...orders.values()].map((o) => o.pick);
  const companyOf = new Map<string, string>();
  for (let i = 0; i < picks.length; i += 1000) {
    reportProgress(KEY, `finding the orders' companies: ${i.toLocaleString("en")} of ${picks.length.toLocaleString("en")}`);
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: string | number }[] }[] }>({
      path: "/crm/v4/associations/orders/companies/batch/read", method: "POST",
      body: { inputs: picks.slice(i, i + 1000).map((id) => ({ id })) },
    });
    for (const x of r.results ?? []) {
      const c = x.to?.[0]?.toObjectId;
      if (x.from?.id != null && c != null) companyOf.set(String(x.from.id), String(c));
    }
  }
  const owners = await ownerNames();
  const ids = [...new Set(companyOf.values())];
  const labels = new Map<string, Record<Dim, string>>();
  const firstOrder = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    if (i % 2000 === 0) reportProgress(KEY, `reading the companies: ${i.toLocaleString("en")} of ${ids.length.toLocaleString("en")}`);
    const r = await hubspotFetchJson<{ results?: Obj[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: [...DIM_PROPS, "order_first_order_date"] },
    });
    for (const o of r.results ?? []) {
      labels.set(String(o.id), labelsOf(o.properties ?? {}, owners));
      const f = o.properties?.order_first_order_date;
      if (f) firstOrder.set(String(o.id), f.slice(0, 7));
    }
  }

  let all = 0, web = 0, noCompany = 0;
  const placed: { month: string; value: number; web: boolean; labels: Record<Dim, string> }[] = [];
  for (const o of orders.values()) {
    const c = companyOf.get(o.pick);
    const l = c ? labels.get(c) : undefined;
    if (!l) { noCompany++; continue; }
    all++; if (o.web) web++;
    placed.push({ month: o.month, value: o.value, web: o.web, labels: l });
  }
  // 4. customers from search: GA4's web orders by channel, a year per call (GA4 takes 365 days at most)
  let searchCustomers: OnlineCube["searchCustomers"];
  let searchCustomersError: string | undefined;
  try {
    reportProgress(KEY, "matching GA4's web orders to the orders");
    const ga4: { tid: string; channel: string; date: string }[] = [];
    for (const [y, to] of [[year - 1, `${year - 1}-12-31`], [year, now.toISOString().slice(0, 10)]] as const) {
      const r = await fetchGa4Report({ name: "transactionsChannel", from: `${y}-01-01`, to });
      for (const row of r.rows) ga4.push({ tid: (row.keys[0] ?? "").trim(), channel: row.keys[1] ?? "", date: row.keys[2] ?? "" });
    }
    const companyMonths = new Map<string, Set<string>>();
    for (const o of orders.values()) {
      const c = companyOf.get(o.pick);
      if (!c) continue;
      let set = companyMonths.get(c);
      if (!set) { set = new Set(); companyMonths.set(c, set); }
      set.add(o.month);
    }
    const upTo = now.getUTCMonth();
    let webOrdersCy = 0;
    for (const o of orders.values()) {
      if (o.web && Number(o.month.slice(0, 4)) === year && Number(o.month.slice(5, 7)) - 1 < upTo) webOrdersCy++;
    }
    searchCustomers = classifySearchCustomers({
      ga4,
      orderOf: (tid) => {
        const key = byShopNumber.get(tid);
        const o = key ? orders.get(key) : undefined;
        const c = o ? companyOf.get(o.pick) : undefined;
        return o && c ? { company: c, month: o.month } : null;
      },
      companyMonths, firstOrder, year, upTo, webOrdersCy,
    });
  } catch (e) {
    searchCustomersError = String((e as Error)?.message ?? e).slice(0, 300);
  }

  return {
    generatedAt: new Date().toISOString(), years, through: now.toISOString().slice(0, 10),
    orders: { all, web, noCompany }, ...foldOnline(placed, years),
    searchCustomers, searchCustomersError,
  };
}

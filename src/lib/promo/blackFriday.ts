// BLACK FRIDAY 2026 - the hub's side of the promotion (SARCLA 03.11.2026: 16.11-06.12.2026; new customers 20 %
// only when sure, Bronze 10 %, Silver / Gold / Platinum 5 %, every code used once; "deploy on website subapp").
//
// The customer path is on the Ads Gateway (Railway, APSOAssistant ads-gateway/promo.js): the shop's Black Friday
// page asks it after login and gets that company's own code. The hub cannot take customer traffic (A+P network
// only), so it only works the controls - settings and Magento's generated codes go OUT to the gateway's admin API
// with the key the Google Ads buckets page already uses - and reads the results from HubSpot: the companies that
// hold a code (written on them by the gateway) and the web orders that used one.

import { adminToken, adsGateway } from "@/lib/adsbuckets/gateway";
import { read, searchAll, type Rec } from "@/lib/lifecycle/read";
import { buildReport, normCode, splitCodes, type BfReport, type CodeOrder, type Holder } from "./report";

export { adminToken };

export type PromoPhase = "off" | "soon" | "live" | "ended";
export type PromoSettings = { on: boolean; start: string; end: string; discount: Record<string, number>; set_at: string | null; testers?: number };
export type PromoStock = { discount: number; loaded: number; taken: number; free: number };
export type PromoStatus = {
  settings: PromoSettings; phase: PromoPhase; stock: PromoStock[] | null; stock_error: string | null;
  answers: Record<string, number>; handed_out_since_boot: Record<string, number>; since: string;
  list_ready: boolean; last_error: { at: string; message: string } | null; properties: { code: string; discount: string; group: string };
};

export const promoStatus = () => adsGateway<PromoStatus>("/admin/promo");
export const setPromoSettings = (patch: Partial<Pick<PromoSettings, "on" | "start" | "end" | "discount">> & { testers?: string[] }) =>
  adsGateway<{ settings: PromoSettings }>("/admin/promo/settings", { method: "POST", body: patch });
export const loadPromoCodes = (discount: number, codes: string[]) =>
  adsGateway<{ given: number; valid: number; added: number; already: number }>("/admin/promo/codes", { method: "POST", body: { discount, codes } });

const fnum = (v: string | null | undefined) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : null;
};

/** Each order's companies, 100 orders a call. */
async function orderCompanies(ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 100) {
    const r = await read<{ results?: { from: { id: string }; to?: { toObjectId: number | string }[] }[] }>({
      path: "/crm/v4/associations/orders/companies/batch/read", method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const x of r.results ?? []) out.set(String(x.from.id), (x.to ?? []).map((t) => String(t.toObjectId)));
  }
  return out;
}

let cache: { at: number; key: string; report: BfReport } | null = null;
const FRESH_MS = 5 * 60_000;

/** Who holds a code and who used it, from HubSpot; kept 5 minutes unless asked fresh. */
export async function promoReport(s: PromoSettings, fresh = false): Promise<BfReport> {
  const key = `${s.start}|${JSON.stringify(s.discount)}`;
  if (!fresh && cache && cache.key === key && Date.now() - cache.at < FRESH_MS) return cache.report;

  const companies: Rec[] = await searchAll("companies", [[{ propertyName: "bf26_code", operator: "HAS_PROPERTY" }]],
    ["name", "bf26_code", "bf26_discount", "bf26_group", "budget_class"]);
  const holders: Holder[] = companies.map((c) => ({
    companyId: c.id, name: c.properties?.name || `Company ${c.id}`, code: normCode(c.properties?.bf26_code),
    discount: fnum(c.properties?.bf26_discount), group: c.properties?.bf26_group || "unclassified", budgetClass: c.properties?.budget_class ?? null,
  }));

  // web orders with a discount code since the day before the start - only those carrying one of OUR codes need their company
  const since = String(Date.parse(s.start) - 86_400_000);
  const orders: Rec[] = await searchAll("orders", [[
    { propertyName: "hs_discount_codes", operator: "HAS_PROPERTY" },
    { propertyName: "hs_createdate", operator: "GTE", value: since },
  ]], ["hs_discount_codes", "hs_total_price", "hs_order_discount", "hs_createdate", "hs_order_name"]);
  const ours = new Set(holders.map((h) => h.code));
  const relevant = orders.filter((o) => splitCodes(o.properties?.hs_discount_codes).some((c) => ours.has(c)));
  const assoc = await orderCompanies(relevant.map((o) => o.id));
  const codeOrders: CodeOrder[] = relevant.map((o) => ({
    orderId: o.id, codes: o.properties?.hs_discount_codes ?? null, createdAt: o.properties?.hs_createdate ?? null,
    total: fnum(o.properties?.hs_total_price), discount: fnum(o.properties?.hs_order_discount), name: o.properties?.hs_order_name ?? null,
    companyIds: assoc.get(o.id) ?? [],
  }));

  const report = buildReport(holders, codeOrders, s.discount);
  cache = { at: Date.now(), key, report };
  return report;
}

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
import { RULE_RATES, buildReport, normCode, rateOfCode, splitCodes, type BfReport, type CodeOrder, type Holder } from "./report";

export { adminToken };

export type PromoPhase = "off" | "soon" | "live" | "ended";
export type PromoSettings = { on: boolean; start: string; end: string; discount: Record<string, number>; set_at: string | null; testers?: number };
export type PromoStock = { discount: number; loaded: number; taken: number; free: number };
export type PromoStatus = {
  settings: PromoSettings; phase: PromoPhase; stock: PromoStock[] | null; stock_error: string | null;
  answers: Record<string, number>; handed_out_since_boot: Record<string, number>; since: string;
  list_ready: boolean; last_error: { at: string; message: string } | null; properties: { code: string; discount: string; group: string };
  /** how each hand-out was placed (Ads Gateway 2f870814): night list / e-mail domain's company / the account alone */
  placed_by?: { list: number; domain: number; account: number };
  /** codes given to accounts HubSpot had not placed yet; placed = since written on the buyer's company */
  account_codes?: { code: string; discount: number; grp: string; claimed_at: string; placed: boolean }[] | null;
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

/** Who holds a code and who used it, from HubSpot (+ the codes still on accounts, from the gateway); kept 5 minutes. */
export async function promoReport(status: PromoStatus, fresh = false): Promise<BfReport> {
  const s = status.settings;
  const accounts = status.account_codes ?? [];
  const key = `${s.start}|${JSON.stringify(s.discount)}|${accounts.length}`;
  if (!fresh && cache && cache.key === key && Date.now() - cache.at < FRESH_MS) return cache.report;

  const companies: Rec[] = await searchAll("companies", [[{ propertyName: "bf26_code", operator: "HAS_PROPERTY" }]],
    ["name", "bf26_code", "bf26_discount", "bf26_group", "budget_class"]);
  const holders: Holder[] = companies.map((c) => ({
    companyId: c.id, name: c.properties?.name || `Company ${c.id}`, code: normCode(c.properties?.bf26_code),
    discount: fnum(c.properties?.bf26_discount), group: c.properties?.bf26_group || "unclassified", budgetClass: c.properties?.budget_class ?? null,
  }));
  // a code given to a brand-new account is on no company until HubSpot places the buyer - it still counts
  const onCompanies = new Set(holders.map((h) => h.code));
  for (const a of accounts) {
    const code = normCode(a.code);
    if (!code || onCompanies.has(code)) continue;
    holders.push({
      companyId: "", name: a.placed ? "An account (its company holds another code)" : "A new account (not in HubSpot yet)",
      code, discount: a.discount, group: a.grp, budgetClass: null,
    });
  }

  // web orders with a discount code since the day before the start - only those carrying one of OUR codes need their company
  const since = String(Date.parse(s.start) - 86_400_000);
  const orders: Rec[] = await searchAll("orders", [[
    { propertyName: "hs_discount_codes", operator: "HAS_PROPERTY" },
    { propertyName: "hs_createdate", operator: "GTE", value: since },
  ]], ["hs_discount_codes", "hs_total_price", "hs_order_discount", "hs_createdate", "hs_order_name"]);
  // ours: a code the page handed out, or any code of the BLACKFRIDAY rules (one the page never gave out is a check)
  const ours = new Set(holders.map((h) => h.code));
  const ruleRates = [...RULE_RATES, ...Object.values(s.discount)];
  const relevant = orders.filter((o) => splitCodes(o.properties?.hs_discount_codes).some((c) => ours.has(c) || rateOfCode(c, ruleRates) != null));
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

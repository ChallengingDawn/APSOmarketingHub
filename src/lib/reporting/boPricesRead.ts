// The read behind KPI autonomy > Manual prices (rules in ./boPrices.ts). From HubSpot, every 12 hours, in the shared queue
// of the slow reads:
// 1. the archived records' shop numbers and days (the list, 100 a page) - the web .000s the hub archived once the ERP's
//    deliveries covered them - then those of the months read, with their lines (batch read, 100 a call);
// 2. the web .000s not archived yet, month by month (the search);
// 3. the ERP's deliveries with their lines, month by month (the search, a month in halves past 10,000).
// A month that ended 3 months ago or more no longer moves: it is kept from the last read and not read again, so a read
// covers about 4 months (the first one everything since June 2026). Counts, and for the biggest changes the order,
// article, both prices and the customer's name - as on the other Back-Office tables.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { kvGet, kvSet } from "@/lib/db/init";
import { CANCELLED } from "@/lib/connectors/steps/orderRules";
import { PRICES_FROM, PRICES_VERSION, SHOP_LINES, addDelivery, comparePrices, shopOrderOf, type ErpOrder, type PricesKept, type ShopOrder } from "./boPrices";

const KEY = "boReport:prices:read:v1";
const KV_KEPT = "boReport:prices";
const TTL_MS = 12 * 60 * 60 * 1000;
/** months that ended this long ago are final */
const FINAL_AFTER = 3;
const LINE_PROPS = Array.from({ length: SHOP_LINES }, (_, i) => ["article", "qty", "revenue"].map((k) => `order_line_${String(i + 1).padStart(2, "0")}_${k}`)).flat();
const SHOP_PROPS = ["hs_external_order_id", "order_order_number", "hs_order_name", "order_order_date", "hs_currency_code", "hs_order_discount", "hs_discount_codes", "hs_pipeline_stage", ...LINE_PROPS];
const ERP_PROPS = ["order_order_number", "hs_order_name", "order_mandant", "order_positions_json", "hs_pipeline_stage"];

type Obj = { id: string; properties?: Record<string, string | null> };
type Page = { results?: Obj[]; total?: number; paging?: { next?: { after?: string } } };

export function pricesState(): Promise<SlowState<PricesKept>> {
  return slowReport(KEY, TTL_MS, build);
}

const ymOf = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}`;
const startOf = (ym: string) => Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1);
/** the months from `from` to this one, as [yyyy-mm, start, end) */
function monthsFrom(from: string, now: Date): [string, number, number][] {
  const out: [string, number, number][] = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7)) - 1;
  while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && m <= now.getUTCMonth())) {
    out.push([ymOf(y, m), Date.UTC(y, m, 1), Date.UTC(y, m + 1, 1)]);
    m++; if (m === 12) { m = 0; y++; }
  }
  return out;
}

async function searchRange(filters: { propertyName: string; operator: string; value?: string }[], props: string[], from: number, to: number, each: (o: Obj) => void): Promise<void> {
  const range = [...filters, { propertyName: "order_order_date", operator: "GTE", value: String(from) }, { propertyName: "order_order_date", operator: "LT", value: String(to) }];
  let after: string | undefined, first = true;
  do {
    const r = await hubspotFetchJson<Page>({
      path: "/crm/v3/objects/orders/search", method: "POST",
      body: { filterGroups: [{ filters: range }], properties: props, limit: 200, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], ...(after ? { after } : {}) },
    });
    // the search stops at 10,000: a fuller range is read in halves
    if (first && (r.total ?? 0) > 9_900 && to - from > 86_400_000) {
      const mid = from + Math.floor((to - from) / 2);
      await searchRange(filters, props, from, mid, each);
      await searchRange(filters, props, mid, to, each);
      return;
    }
    first = false;
    for (const o of r.results ?? []) each(o);
    after = r.paging?.next?.after;
  } while (after);
}

async function build(): Promise<PricesKept> {
  const now = new Date();
  const prev = await kvGet<PricesKept>(KV_KEPT).catch(() => null);
  const cut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - FINAL_AFTER, 1));
  const cutYm = ymOf(cut.getUTCFullYear(), cut.getUTCMonth());
  const reuse = prev?.v === PRICES_VERSION;
  const from = reuse && cutYm > PRICES_FROM ? cutYm : PRICES_FROM;
  const fromMs = startOf(from);
  const months = monthsFrom(from, now);

  const shops = new Map<string, ShopOrder>();
  const takeShop = (o: Obj) => {
    const p = o.properties ?? {};
    if (p.hs_pipeline_stage === CANCELLED) return;
    const s = shopOrderOf(p);
    if (s && s.day >= `${from}-01`) shops.set(s.base, s);
  };

  // 1. the archived web records of the months read
  const ids: string[] = [];
  let after: string | undefined, seen = 0;
  for (;;) {
    const r = await hubspotFetchJson<Page>({ path: `/crm/v3/objects/orders?limit=100&archived=true&properties=hs_external_order_id,order_order_date${after ? `&after=${after}` : ""}` });
    for (const o of r.results ?? []) {
      seen++;
      const p = o.properties ?? {};
      const d = p.order_order_date ?? "";
      const ms = /^\d+$/.test(d) ? Number(d) : Date.parse(d);
      if (p.hs_external_order_id && Number.isFinite(ms) && ms >= fromMs) ids.push(o.id);
    }
    if (seen % 2000 < 100) reportProgress(KEY, `reading the archived web orders: ${seen.toLocaleString("en")}`);
    after = r.paging?.next?.after;
    if (!after) break;
  }
  for (let i = 0; i < ids.length; i += 100) {
    if (i % 2000 === 0) reportProgress(KEY, `reading the shop's prices: ${i.toLocaleString("en")} of ${ids.length.toLocaleString("en")} archived web orders`);
    const r = await hubspotFetchJson<Page>({ path: "/crm/v3/objects/orders/batch/read?archived=true", method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: SHOP_PROPS } });
    for (const o of r.results ?? []) takeShop(o);
  }

  // 2. + 3. month by month: the web records not archived, and the ERP's deliveries
  const erp = new Map<string, ErpOrder>();
  for (const [ym, a, b] of months) {
    reportProgress(KEY, `reading ${ym}: the shop's prices and the ERP's deliveries - ${shops.size.toLocaleString("en")} web orders so far`);
    await searchRange([{ propertyName: "hs_external_order_id", operator: "HAS_PROPERTY" }], SHOP_PROPS, a, b, takeShop);
    await searchRange([{ propertyName: "order_positions_json", operator: "HAS_PROPERTY" }], ERP_PROPS, a, b, (o) => {
      const p = o.properties ?? {};
      if (p.hs_pipeline_stage !== CANCELLED) addDelivery(erp, p);
    });
  }

  const fresh = comparePrices(shops.values(), erp);
  const kept: PricesKept = { v: PRICES_VERSION, at: now.toISOString(), months: {} };
  for (const mandant of new Set([...Object.keys(prev?.months ?? {}), ...Object.keys(fresh)])) {
    const old = reuse ? prev?.months[mandant] ?? {} : {};
    const keep = Object.fromEntries(Object.entries(old).filter(([ym]) => ym < from));
    kept.months[mandant] = { ...keep, ...(fresh[mandant] ?? {}) };
  }
  await kvSet(KV_KEPT, kept);
  return kept;
}

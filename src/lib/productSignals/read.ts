// THE PRODUCTS REPORTS' SHOP READ (SARCLA 01.11.2026: availability, price checks, minimum order - "all by sub app"): the
// Datatracker's one scan (src/lib/integrations/shopSignals.ts), as the Datatracker and Engagements read it, from the first
// whole day the smart bar counted to today - with two things more, asked of it alone:
//
//   kept    the lines the hub keeps of every company's shop activity (apsomh_shop_looks, every quarter of an hour): the
//           HubSpot property holds a company's last 50 articles only, so a month of a busy customer is mostly gone from it
//   facts   each article as Products & Pricing gives it - its profit centre, main group, sub group and product (read on the
//           same search the scan makes, no call more), its sales unit, its minimum and its stock - and the looks that did
//           end in an order, for "ordered later"
//
// Kept through slowReport (Postgres, shared by every task) and read again every two hours; the rules are in ./model.ts.

import { getPool } from "@/lib/db/client";
import { fetchShopSignals, type KeptLook } from "@/lib/integrations/shopSignals";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { SIGNALS_FROM, compactSignals, type SignalsData } from "./model";

const KEY = "products:signals:v2"; // v2 (01.11.2026): the path for the funnels
const TTL_MS = 2 * 60 * 60 * 1000;
/** a read that could not join the kept lines is asked again sooner */
const RETRY_MS = 20 * 60 * 1000;

export function productSignals(): Promise<SlowState<SignalsData>> {
  return slowReport(KEY, (v: SignalsData) => (v?.notes?.keptError ? RETRY_MS : TTL_MS), build);
}

/** Every line the hub kept since the first day, the ten-digit articles only - the largest quantity of the day. */
async function keptLooks(): Promise<{ rows: KeptLook[]; error: string | null }> {
  try {
    const r = await getPool().query<{ company_id: string; day: string; article: string; qty: number | null; carted: boolean; ordered: boolean; contact_id: string | null }>(
      `SELECT company_id, to_char(day, 'YYYY-MM-DD') AS day, article, COALESCE(qty_max, qty)::float8 AS qty, carted, ordered, contact_id
         FROM apsomh_shop_looks WHERE day >= $1::date AND article ~ '^[0-9]{10}$'`,
      [SIGNALS_FROM],
    );
    return {
      rows: r.rows.map((x) => ({ companyId: String(x.company_id), day: x.day, article: x.article, qty: x.qty == null ? null : Number(x.qty), carted: !!x.carted, ordered: !!x.ordered, contact: x.contact_id })),
      error: null,
    };
  } catch (e) {
    // the copy has not started on this database yet, or it cannot be reached: the property's lines alone, and the page says so
    return { rows: [], error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

async function build(): Promise<SignalsData> {
  reportProgress(KEY, "reading the shop lines the hub kept");
  const kept = await keptLooks();
  reportProgress(KEY, "reading what the shop saw: the companies, the quantities they asked for, Products & Pricing");
  const today = new Date().toISOString().slice(0, 10);
  const s = await fetchShopSignals({ from: SIGNALS_FROM, to: today, today, kept: kept.error ? undefined : kept.rows, facts: true });
  return compactSignals(s, { generatedAt: s.generatedAt, from: SIGNALS_FROM, through: today, keptError: kept.error });
}

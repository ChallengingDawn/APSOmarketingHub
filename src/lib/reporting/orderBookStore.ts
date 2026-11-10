// The ERP's order book, kept for My Sales Reports > Targets (rules in ./orderBookRules.ts). Written by the chain's ERP
// revenue step when the morning workbook carries the order book sheet; read by /api/reporting/my-sales/order-book. A
// workbook without the sheet keeps the last one - the page names its day.

import { kvGet, kvSet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { KV_ORDER_BOOK, ORDER_BOOK_VERSION, type OrderBookKept, type OrderBookResult } from "./orderBookRules";
import { zurichToday } from "./boDeliveryStore";

export async function saveOrderBook(r: OrderBookResult, file: string): Promise<Record<string, unknown>> {
  const kept: OrderBookKept = { v: ORDER_BOOK_VERSION, at: new Date().toISOString(), day: zurichToday(), file, rows: r.rows, total: r.total, customers: r.customers, book: r.book };
  // an empty sheet (a query that failed in Excel) never replaces a real book
  if (r.book.length) await kvSet(KV_ORDER_BOOK, kept);
  return { rows: r.rows, customers: r.customers, total_eur: r.total, other_mandants_or_zero: r.skipped, kept: r.book.length > 0 };
}

export const orderBookNow = () => kvGet<OrderBookKept>(KV_ORDER_BOOK).then((k) => (k?.v === ORDER_BOOK_VERSION ? k : null)).catch(() => null);

/** Each customer ("100-12345") -> its HubSpot company: the revenue step's own map (apsomh_cx_un2id). */
export async function companiesOfCustomers(customers: string[]): Promise<Map<string, string>> {
  if (!customers.length) return new Map();
  const r = await query<{ un: string; company_id: string }>("SELECT un, company_id FROM apsomh_cx_un2id WHERE un = ANY($1::text[])", [customers]);
  return new Map(r.rows.map((x) => [x.un, String(x.company_id)]));
}

// ORDER FACTS (SARCLA 08.11.2026: "populate also the properties on hubspot - can we now populate invoice date and
// populate data that we are missing ? I can add this file to the daily file"). HubSpot's order records carry ~50 ERP
// properties nobody ever filled (measured 08.11.2026: 0 % on the last 600 deliveries). They come from three places:
// - the ERP's nightly order file (dim_order.csv, read by order_sync already): customer order no., your reference,
//   delivery note, incoterm, payment term, the fixed date, the source, split delivery, warehouse, department, team,
//   sales agent, the customer's and the proposed delivery dates, prepayment;
// - the morning workbook's "KPI LINES" sheet (the BI model's order lines, ../../reporting/boErpLines.ts): the first
//   confirmed delivery date and whether the order holds special articles - per order (its number without the suffix);
// - its "KPI INVOICES" sheet (the BI model's invoices per delivery): invoice date, number, booking date, cancelled,
//   currency, count - the invoice date the nightly file cannot join (dim_invoice has no key to dim_order).
// Every value is checked against its property's type (a date, a choice list's own options) - a wrong one would make
// HubSpot refuse the whole order's update, title and status with it. Pure; the I/O is in ./orders.ts (order_sync) and
// ./erpRevenue.ts (the sheets).

import { cpSlice, pyStrip, shipIso, type Get } from "./orderRules";
import { dayOf, type ErpLine } from "../../reporting/boErpLines";

/** the orders filled: those of this year on (dim_order OrderYear) - history from 2020 (SARCLA 08.11.2026: "also historicals"),
 *  not the 800,000 since 2014 - each kept packed in memory for the night (the repeated values kept once, by number) */
export const FACTS_FROM_YEAR = 2020;
/** OFF until SARCLA has seen the preview's figures and said go: order_sync then counts and reports, writes nothing */
export const ORDER_FACTS_LIVE = false;
export const SHEET_INVOICES = "KPI INVOICES";

type Kind = "text" | "date" | "source" | "prepay" | "dict";
/** dim_order column -> order property (all in the group sarcla_orders, checked 08.11.2026) */
export const DIM_FACTS: readonly (readonly [prop: string, col: string, kind: Kind])[] = [
  ["order_customer_order_nr", "CustomerOrderNr", "text"],
  ["order_your_reference", "YourReference", "text"],
  ["order_delivery_note_nr", "DeliveryNoteNr", "text"],
  ["order_incoterm", "IncoTerm", "dict"],
  ["order_payment_term", "PaymentTerm", "dict"],
  ["order_order_fixed_date", "OrderFixedDate", "date"],
  ["order_order_source", "OrderSource", "source"],
  ["order_split_delivery", "SplitDelivery", "dict"],
  ["order_shipping_warehouse", "ShippingFromWarehouse", "dict"],
  ["order_sales_department", "SalesDepartment", "dict"],
  ["order_sales_team_id", "SalesTeamId", "dict"],
  ["order_sales_agent_code", "SA", "dict"],
  ["order_delivery_date_customer", "DeliveryDateCustomer", "date"],
  ["order_delivery_date_proposed", "DeliveryDateProp", "date"],
  ["order_advance_payment", "Prepayment", "prepay"],
  ["order_value_class", "OrderValueClassificationLC", "dict"],
  ["order_margin_class", "OrderMarginLevelClassificationLC", "dict"],
];
/** the properties the sheets fill */
export const LINE_FACTS = ["order_first_confirmed_delivery", "order_has_special_articles", "order_shipment_status"] as const;
export const INVOICE_FACTS = ["order_invoice_date", "order_invoice_number", "order_invoice_booking_date", "order_invoice_canceled", "order_invoice_currency", "order_invoice_count", "order_invoiced_status", "order_cogs_eur", "order_customer_class"] as const;

export type Facts = Record<string, string>;

/** text as HubSpot keeps it: no control characters, runs of spaces folded, at most 500 characters */
const clean = (s: string) => cpSlice(pyStrip(s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/ {2,}/g, " ")), 0, 500);
/** a date the ERP means: 20.02.2030 is its "no date" (88 % of DeliveryDateProp), so nothing from 2030 on */
function realDate(raw: string): string | null {
  const d = shipIso(raw);
  return d && d < "2030-01-01" ? d : null;
}
function value(kind: Kind, raw: string): string | null {
  const s = clean(raw ?? "");
  if (!s) return null;
  switch (kind) {
    case "text": case "dict": return s;
    case "date": return realDate(s);
    case "source": return s === "eShop" || s === "manually entered" ? s : null; // the choice list's own options
    case "prepay": return s === "J" ? "checked" : s === "N" ? "unchecked" : null;
  }
}

/** One dim_order row -> the facts it gives (empty values left out), or null for an order before FACTS_FROM_YEAR. */
export function dimFactsOf(get: Get): Facts | null {
  const y = Number(pyStrip(get("OrderYear")));
  if (!(y >= FACTS_FROM_YEAR)) return null;
  const f: Facts = {};
  for (const [prop, col, kind] of DIM_FACTS) { const v = value(kind, get(col)); if (v != null) f[prop] = v; }
  return f;
}
/** the values that repeat (incoterm, payment term, warehouse, team, classes ...) kept once, by number */
const DIM_DICT: string[] = [];
const DIM_INDEX = new Map<string, number>();
const intern = (v: string) => { let i = DIM_INDEX.get(v); if (i === undefined) { i = DIM_DICT.length; DIM_DICT.push(v); DIM_INDEX.set(v, i); } return String(i); };
/** packed small for ~400,000 orders in memory: the values in DIM_FACTS order, the repeated ones as their number */
export const packDim = (f: Facts) => DIM_FACTS.map(([p, , kind]) => (f[p] == null ? "" : kind === "dict" ? intern(f[p]) : f[p])).join("\u0001");
export function unpackDim(s: string | undefined): Facts {
  const f: Facts = {};
  if (!s) return f;
  s.split("\u0001").forEach((v, i) => {
    const d = DIM_FACTS[i];
    if (!v || !d) return;
    const val = d[2] === "dict" ? DIM_DICT[Number(v)] ?? "" : v;
    if (val) f[d[0]] = val;
  });
  return f;
}

/** "A26.661275.001" -> "A26.661275" */
export const baseOfNumber = (num: string) => num.replace(/\.\d{3}$/, "");

/** KPI LINES -> per order (base number): the earliest first confirmed date of its lines, special articles or not, and how
 *  far it is shipped (the property's own options: every line shipped in full, some shipped, none yet). */
export function lineFacts(lines: Iterable<Pick<ErpLine, "order" | "firstDay" | "artType" | "qty" | "shipped" | "lineType">>): Map<string, Facts> {
  const out = new Map<string, { first: string; special: boolean; lines: number; full: number; some: number }>();
  for (const l of lines) {
    if (!l.order) continue;
    const b = baseOfNumber(l.order);
    const x = out.get(b) ?? { first: "", special: false, lines: 0, full: 0, some: 0 };
    if (l.firstDay && l.firstDay < "2030-01-01" && (!x.first || l.firstDay < x.first)) x.first = l.firstDay;
    if (l.artType === "Special") x.special = true;
    if (l.qty != null && l.qty > 0 && (!l.lineType || l.lineType === "Order")) {
      x.lines++;
      if ((l.shipped ?? 0) >= l.qty - 1e-9) x.full++;
      else if ((l.shipped ?? 0) > 0) x.some++;
    }
    out.set(b, x);
  }
  return new Map([...out].map(([b, x]) => {
    const f: Facts = { order_has_special_articles: x.special ? "true" : "false" };
    if (x.first) f.order_first_confirmed_delivery = x.first;
    if (x.lines) f.order_shipment_status = x.full === x.lines ? "Fully shipped" : x.full || x.some ? "Partially shipped" : "Open";
    return [b, f];
  }));
}

/* ── KPI INVOICES: one row per delivery and invoice ─────────────────────────────────── */

export type InvoiceRow = { order: string; number: string; date: string; booked: string; canceled: string; currency: string; customerClass?: string; cogs?: number | null };
type Cell = Parameters<typeof dayOf>[0];
const text = (c: Cell) => (c == null ? "" : c instanceof Date ? dayOf(c) : typeof c === "object" ? String((c as { v: number }).v) : String(c).trim());
const norm = (s: string) => s.replace(/^\[|\]$/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

/** The sheet, row by row: the header (the first row naming InvoiceNumber and InvoiceDate), then the invoices. */
export class InvoicesSheet {
  private at: Record<string, number> | null = null;
  private rows: InvoiceRow[] = [];
  feed(_n: number, cells: Cell[]): void {
    if (!this.at) {
      const names = cells.map((c) => norm(text(c)));
      if (!names.includes("invoicenumber") || !names.includes("invoicedate")) return;
      this.at = Object.fromEntries(["order", "invoicenumber", "invoicedate", "bookingdate", "invoicecanceled", "currency", "customerclass", "cogseur"].map((k) => [k, names.indexOf(k)]));
      return;
    }
    const g = (k: string) => (this.at![k] >= 0 ? cells[this.at![k]] : null);
    const order = text(g("order")), number = text(g("invoicenumber"));
    if (!order || !number) return;
    const cogsText = text(g("cogseur")), cogs = Number(cogsText);
    this.rows.push({
      order, number, date: dayOf(g("invoicedate")), booked: dayOf(g("bookingdate")), canceled: text(g("invoicecanceled")).toUpperCase(), currency: text(g("currency")),
      customerClass: text(g("customerclass")), cogs: cogsText !== "" && Number.isFinite(cogs) ? cogs : null,
    });
  }
  finish(): InvoiceRow[] | null { return this.at ? this.rows : null; }
}

/**
 * Per delivery: its invoice (the first one not cancelled, else the first), how many there were, and whether every one
 * was cancelled. A delivery invoiced twice keeps the first invoice's date and number - the count says there are more.
 */
export function invoiceFacts(rows: Iterable<InvoiceRow>): Map<string, Facts> {
  const by = new Map<string, Map<string, InvoiceRow>>();
  for (const r of rows) {
    const m = by.get(r.order) ?? new Map<string, InvoiceRow>();
    if (!m.has(r.number)) m.set(r.number, r);
    by.set(r.order, m);
  }
  const out = new Map<string, Facts>();
  for (const [order, m] of by) {
    const inv = [...m.values()].sort((a, b) => (a.date || "9").localeCompare(b.date || "9") || a.number.localeCompare(b.number));
    const live = inv.filter((r) => r.canceled !== "J");
    const pick = live[0] ?? inv[0];
    const f: Facts = { order_invoice_number: clean(pick.number), order_invoice_count: String(inv.length), order_invoice_canceled: live.length ? "N" : "J", order_invoiced_status: live.length ? "invoiced" : "canceled" };
    if (pick.date && pick.date < "2030-01-01") f.order_invoice_date = pick.date;
    if (pick.booked && pick.booked < "2030-01-01") f.order_invoice_booking_date = pick.booked;
    if (pick.currency) f.order_invoice_currency = clean(pick.currency);
    if (pick.customerClass) f.order_customer_class = clean(pick.customerClass);
    const withCogs = live.filter((r) => r.cogs != null);
    if (withCogs.length) f.order_cogs_eur = String(Math.round(withCogs.reduce((t, r) => t + (r.cogs ?? 0), 0) * 100) / 100);
    out.set(order, f);
  }
  return out;
}

/** An order's facts: the nightly file's, its order's lines', its own invoices' - later ones never blank an earlier one. */
export function factsFor(num: string, dim: Facts, byBase: Map<string, Facts>, byOrder: Map<string, Facts>): Facts {
  return { ...dim, ...(byBase.get(baseOfNumber(num)) ?? {}), ...(byOrder.get(num) ?? {}) };
}
/** What was written for an order, to write again only what changed: the facts in a fixed order. */
export const factsHash = (f: Facts) => Object.keys(f).sort().map((k) => `${k}=${f[k]}`).join("\u0001");

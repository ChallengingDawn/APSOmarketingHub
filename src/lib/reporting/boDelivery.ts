// THE BACK OFFICE'S DELIVERY SPEED - Back-Office Reports > OTD > Delivery speed (SARCLA 06.11.2026: "but can we build an
// OTD report?" - "go").
//
// Read from the ERP's order file (dim_order.csv, every order since 2014, every night) by the Compass chain's order_sync, in
// the same pass as the certificate requests (steps/orders.ts): deliveryCollector().row() for every row, then
// summarize() -> kv boReport:delivery, which the Back-Office route hands to the page.
//
// A delivery = an A-number with its suffix (.000, .001 ...), mandants 100 and 110, the row's current version, counted once
// (the last row of a number wins, as order_sync's). Shipped = a shipment date up to today AND a status past the warehouse:
// invoiced, being delivered, ready for delivery / for tour, ready for invoicing. Left out: credit notes (G), frame
// contracts (R) and any other non-A number, inactive (J) or deleted orders, orders without a shipment (WithoutShipment J),
// orders still entered / pending / provisional (no shipment date - or a planned one).
//
// Speed = working days (Monday to Friday, no public holidays) from the order date to the shipment date: 0 = the same day,
// a Friday's order shipped on Monday = 1.
//
// "With a proposed date": DeliveryDateProp holds a real date - the made-to-order lines; the 20.02.2030 sentinel (88 % of the
// orders) means "as soon as it can". Shipped by it or not - which is NOT OTD: the ERP moves the proposed date when the
// delivery moves (Jan-Jun 2026 gave 84-89 % every month where the Back Office measured 33-43 % in April-June against the
// first confirmation date), and that first confirmed date is in no file the hub gets (dim_order.DeliveryDateInitial is
// empty since 2025; the workbook's FIGURES (5) has only OrderFixedDate = the day the order was confirmed, checked
// 05.11 + 06.11.2026). So OTD stays typed in, and the page says what this measures.
// No profit centre here: dim_order names none per order (its lines do, in the order fact).

import { erpStatus, pyStrip, type Get } from "../connectors/steps/orderRules";

export const DELIVERY_VERSION = 1;
export const KV_DELIVERY = "boReport:delivery";
/** the histogram's slots: 0 .. 30 working days, the last one 31 or more */
export const HIST = 32;
/** with a proposed date, shipped after it: working days late - 1, 2-5, 6-10, 11 or more */
export const LATE = ["1 working day", "2-5 working days", "6-10 working days", "11 working days or more"] as const;
/** the deliveries listed by name: shipped in the last days given, the slowest first */
export const SLOW_DAYS = 92, SLOW_MAX = 200, SLOW_FROM = 6;

const SHIPPED = new Set(["invoiced", "being_delivered", "ready_for_delivery", "ready_for_invoicing"]);
const SENTINEL_YEAR = 2030;

/** "dd.mm.yyyy[ hh:mm:ss]" -> "yyyy-mm-dd", else null */
export function erpDay(raw: string | null | undefined): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(pyStrip(raw ?? ""));
  if (!m) return null;
  const [, d, mo, y] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}

const dayNo = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
/** the working days from Monday of the week of 29.12.1969 up to and including the day */
function weekdaysThrough(iso: string): number {
  const k = dayNo(iso) + 3; // 0 = Monday 29.12.1969
  return Math.floor(k / 7) * 5 + Math.min((k % 7) + 1, 5);
}
/** Working days from a to b: 0 on the same day, Friday -> Monday 1, Friday -> Saturday 0; never below 0. */
export function workingDays(a: string, b: string): number {
  return Math.max(0, weekdaysThrough(b) - weekdaysThrough(a));
}

/** One delivery as the summary needs it. */
export type Delivery = {
  num: string; order: string; ship: string; wd: number;
  /** the proposed date, null without one (the sentinel) */
  prop: string | null; country: string; mode: string;
};
export type Skip = "status" | "no shipment date" | "not shipped yet" | "without shipment" | "inactive or deleted" | "not an A-number" | "bad dates";

/** A row of the file -> its delivery, or why it is not one. `on` = dimOrderNumber's (mandant and current version checked). */
export function deliveryOf(get: Get, on: string, today: string, minYear: number): Delivery | Skip | null {
  const ship = erpDay(get("ShipmentDate"));
  // most rows are older years: leave them before anything else is read
  if (ship ? +ship.slice(0, 4) < minYear : !(Number(pyStrip(get("OrderYear"))) >= minYear)) return null;
  if (!/^A/i.test(on)) return "not an A-number";
  if (pyStrip(get("Inactive")).toUpperCase() === "J" || pyStrip(get("DeletedOrder")).toUpperCase() === "Y") return "inactive or deleted";
  if (/^[JY]$/i.test(pyStrip(get("WithoutShipment")))) return "without shipment";
  if (!ship) return "no shipment date";
  if (ship > today) return "not shipped yet";
  if (!SHIPPED.has(erpStatus(get("OrderStatus"), on))) return "status";
  const order = erpDay(get("OrderDate"));
  if (!order || order > ship) return "bad dates";
  const p = erpDay(get("DeliveryDateProp"));
  return {
    num: on, order, ship, wd: workingDays(order, ship),
    prop: p && +p.slice(0, 4) < SENTINEL_YEAR ? p : null,
    country: pyStrip(get("ShippedToCountry")) || pyStrip(get("OrderCountry")) || "Not named",
    mode: pyStrip(get("ShippingMode")) || "Not named",
  };
}

/** One per order_sync run: every row of the file, then summarize(). */
export function deliveryCollector(today: string, minYear: number) {
  const found = new Map<string, Delivery>();
  const skipped: Record<string, number> = {};
  return {
    found, skipped,
    row(get: Get, on: string) {
      const d = deliveryOf(get, on, today, minYear);
      if (!d) { found.delete(on); return; }
      if (typeof d === "string") { found.delete(on); skipped[d] = (skipped[d] ?? 0) + 1; return; }
      found.set(on, d);
    },
  };
}

/* ── the summary kept ──────────────────────────────────────────────────── */

/** per country / shipping mode: deliveries, shipped within 2 working days, with a proposed date, shipped by it */
export type DCount = [n: number, within2: number, withDate: number, byDate: number];
export type DMonth = {
  /** working days from the order to the shipment, a histogram [0 .. 30, 31+]: without a proposed date, with one */
  s: number[]; p: number[];
  /** with a proposed date: shipped by it */
  by: number;
  /** with a proposed date, shipped after it: working days late, LATE's buckets */
  late: number[];
  c: Record<string, DCount>; m: Record<string, DCount>;
};
/** a delivery named: number, ordered, shipped, working days, proposed date ("" none), country, mode, the customer (its HubSpot title's last part) */
export type SlowRow = [num: string, order: string, ship: string, wd: number, prop: string, country: string, mode: string, company: string];
export type DeliveryKept = { v: number; at: string; today: string; months: Record<string, DMonth>; slow: SlowRow[]; skipped: Record<string, number>; deliveries: number };

export const emptyDMonth = (): DMonth => ({ s: Array(HIST).fill(0), p: Array(HIST).fill(0), by: 0, late: [0, 0, 0, 0], c: {}, m: {} });
const lateSlot = (wdLate: number) => (wdLate <= 1 ? 0 : wdLate <= 5 ? 1 : wdLate <= 10 ? 2 : 3);
const bump = (r: Record<string, DCount>, k: string, d: Delivery) => {
  const x = (r[k] ??= [0, 0, 0, 0]);
  x[0] += 1; if (d.wd <= 2) x[1] += 1;
  if (d.prop) { x[2] += 1; if (d.ship <= d.prop) x[3] += 1; }
};
const minus = (iso: string, days: number) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) - days)).toISOString().slice(0, 10);

/** The deliveries -> per month of shipment, and the slowest of the last SLOW_DAYS days. `company` names a delivery's customer. */
export function summarize(found: Iterable<Delivery>, today: string, skipped: Record<string, number> = {}, company: (num: string) => string = () => ""): DeliveryKept {
  const months: Record<string, DMonth> = {};
  const recent: Delivery[] = [];
  const since = minus(today, SLOW_DAYS);
  let n = 0;
  for (const d of found) {
    n += 1;
    const m = (months[d.ship.slice(0, 7)] ??= emptyDMonth());
    (d.prop ? m.p : m.s)[Math.min(d.wd, HIST - 1)] += 1;
    if (d.prop) {
      if (d.ship <= d.prop) m.by += 1;
      else m.late[lateSlot(workingDays(d.prop, d.ship))] += 1;
    }
    bump(m.c, d.country, d);
    bump(m.m, d.mode, d);
    if (d.ship >= since && (d.wd >= SLOW_FROM || (d.prop && d.ship > d.prop))) recent.push(d);
  }
  recent.sort((a, b) => b.wd - a.wd || b.ship.localeCompare(a.ship) || a.num.localeCompare(b.num));
  const slow = recent.slice(0, SLOW_MAX).map((d): SlowRow => [d.num, d.order, d.ship, d.wd, d.prop ?? "", d.country, d.mode, company(d.num)]);
  return { v: DELIVERY_VERSION, at: new Date().toISOString(), today, months, slow, skipped, deliveries: n };
}

/* ── read on the page ──────────────────────────────────────────────────── */

/** Months added up (the period shown); none -> an empty month. */
export function sumDMonths(ms: (DMonth | null | undefined)[]): DMonth {
  const t = emptyDMonth();
  const add = (into: Record<string, DCount>, from: Record<string, DCount>) => {
    for (const [k, v] of Object.entries(from)) { const x = (into[k] ??= [0, 0, 0, 0]); for (let i = 0; i < 4; i++) x[i] += v[i]; }
  };
  for (const m of ms) {
    if (!m) continue;
    for (let i = 0; i < HIST; i++) { t.s[i] += m.s[i] ?? 0; t.p[i] += m.p[i] ?? 0; }
    t.by += m.by;
    for (let i = 0; i < 4; i++) t.late[i] += m.late[i] ?? 0;
    add(t.c, m.c); add(t.m, m.m);
  }
  return t;
}
export const histSum = (h: number[]) => h.reduce((s, x) => s + x, 0);
/** both histograms, added slot by slot */
export const both = (m: DMonth) => m.s.map((x, i) => x + (m.p[i] ?? 0));
/** the share shipped within k working days, null without deliveries */
export function within(h: number[], k: number): number | null {
  const n = histSum(h);
  return n ? histSum(h.slice(0, k + 1)) / n : null;
}
/** the median of the working days (31 = "31 or more"), null without deliveries */
export function medianWd(h: number[]): number | null {
  const n = histSum(h);
  if (!n) return null;
  let seen = 0;
  for (let i = 0; i < h.length; i++) { seen += h[i]; if (seen * 2 >= n) return i; }
  return h.length - 1;
}
/** with a proposed date: the share shipped by it */
export function byDate(m: DMonth): number | null {
  const n = histSum(m.p);
  return n ? m.by / n : null;
}
/** the four bands the month-by-month mix draws: 0-1, 2-5, 6-20, 21 or more working days */
export function bands(h: number[]): [number, number, number, number] {
  const s = (a: number, b: number) => histSum(h.slice(a, b + 1));
  return [s(0, 1), s(2, 5), s(6, 20), s(21, HIST - 1)];
}

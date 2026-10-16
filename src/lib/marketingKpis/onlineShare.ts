// ONLINE SHARE OF ORDERS (KPI C06) - the pure part, shared by the read (online.ts)
// and the customers page: which orders came through the shop, folded into cells
// on the customers cube's dimensions, and sliced by the page's filters and months.
//
// An order is its number without the delivery part: A26.648373 is the web record
// A26.648373.000 and the ERP's deliveries .001, .002. It came through the shop when
// any of its records carries the shop's order id (hs_external_order_id), the eshop
// channel or a web order number - INCLUDING its archived records: once the ERP's
// deliveries cover a web order, the hub archives the .000, and the ERP copies do
// not carry the shop id. Measured 16.10.2026: September 2026 is 28% web on the
// active records alone and 99.3% with the archived ones joined - as March 2025
// (99.1%), when the old connector still stamped the id on every copy.
//
// Value: the order's net value (order_total_net_revenue) - the deliveries' sum,
// or the web record's while the ERP has none yet; never both. Credit notes (G…)
// and cancelled orders are left out. In the order's own currency (CHF or EUR).

import { DIMS, type Dim, type Filters, type Win } from "./cube";

export type OrderRec = { id: string; number: string; month: string; value: number; web: boolean; cancelled: boolean };
export type Order = { month: string; value: number; web: boolean; /** the record whose company the order counts for */ pick: string };

/** "A26.648373.001" -> ["A26.648373", "001"]; null for anything else. */
export function splitNumber(n: string | null | undefined): [string, string] | null {
  const m = /^([A-Z]\d{2}\.\d+)\.(\d{3})$/.exec(String(n ?? "").trim());
  return m ? [m[1], m[2]] : null;
}
/** Whether an order record carries the shop's mark. */
export function webMark(p: Record<string, string | null | undefined>): boolean {
  return !!(p.hs_external_order_id || p.order_web_order_number || String(p.order_channel ?? "").toLowerCase() === "eshop");
}

/** Records to orders: by number, web when any record (or an archived one) is, credit notes and cancellations out. */
export function groupOrders(recs: Iterable<OrderRec>, archivedWeb: ReadonlySet<string>): Map<string, Order> {
  const by = new Map<string, { month: string; web: boolean; erp: number; erpPick?: string; webVal: number; webPick?: string }>();
  for (const r of recs) {
    if (r.cancelled) continue;
    const s = splitNumber(r.number);
    if (s && s[0].startsWith("G")) continue;               // a credit note
    // a web order the ERP has not numbered yet stands on its own
    const key = s ? s[0] : `web:${r.id}`;
    const o = by.get(key) ?? { month: r.month, web: false, erp: 0, webVal: 0 };
    if (r.month && (!o.month || r.month < o.month)) o.month = r.month;
    if (r.web) o.web = true;
    if (s && s[1] !== "000") { o.erp += r.value; o.erpPick ??= r.id; } else { o.webVal += r.value; o.webPick ??= r.id; }
    by.set(key, o);
  }
  const out = new Map<string, Order>();
  for (const [k, o] of by) {
    if (!o.month) continue;
    const erp = o.erpPick != null;
    out.set(k, { month: o.month, value: erp ? o.erp : o.webVal, web: o.web || archivedWeb.has(k), pick: (erp ? o.erpPick : o.webPick)! });
  }
  return out;
}

/* ── the cells ───────────────────────────────────────────────────────── */

export type OnlineCube = {
  generatedAt: string;
  /** this year, last year, the year before - as the customers cube */
  years: number[];
  labels: Record<Dim, string[]>;
  /** the dimension indexes of each cell, in DIMS order */
  cells: number[][];
  /** [cell, year index, all orders' value Jan…Dec, web orders' value Jan…Dec] */
  value: number[][];
  /** the last order day read, "2026-10-16" */
  through: string;
  /** orders counted, of them through the shop; and orders without a company (left out) */
  orders: { all: number; web: number; noCompany: number };
};

/** Orders with their company's labels into cells; months outside the three years are left out. */
export function foldOnline(orders: Iterable<{ month: string; value: number; web: boolean; labels: Record<Dim, string> }>, years: number[]): Pick<OnlineCube, "labels" | "cells" | "value"> {
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const ix = (d: Dim, v: string) => { let i = labels[d].indexOf(v); if (i < 0) i = labels[d].push(v) - 1; return i; };
  const cellIx = new Map<string, number>();
  const cells: number[][] = [];
  const value = new Map<string, number[]>();
  for (const o of orders) {
    const yi = years.indexOf(Number(o.month.slice(0, 4)));
    const m = Number(o.month.slice(5, 7)) - 1;
    if (yi < 0 || !(m >= 0 && m < 12)) continue;
    const idx = DIMS.map((d) => ix(d, o.labels[d]));
    const key = idx.join(",");
    let ci = cellIx.get(key);
    if (ci === undefined) { ci = cells.push(idx) - 1; cellIx.set(key, ci); }
    const k = `${ci},${yi}`;
    let row = value.get(k);
    if (!row) { row = [ci, yi, ...Array(24).fill(0)]; value.set(k, row); }
    row[2 + m] += o.value;
    if (o.web) row[14 + m] += o.value;
  }
  return { labels, cells, value: [...value.values()].map((r) => r.map((x, i) => (i < 2 ? x : Math.round(x)))) };
}

/* ── slicing ─────────────────────────────────────────────────────────── */

export type OnlineAgg = { all: number; web: number; allPy: number; webPy: number };
export const onlineShare = (all: number, web: number) => (all > 0 ? web / all : null);

/**
 * The window's orders and web orders against the same months a year earlier,
 * under the page's filters (by label, as the customers cube's filters), all
 * together ("") or by one dimension's labels - that dimension's own filter left
 * out, as the customers cube's breakdown does. Months count as on the customers
 * cube: 0 = January of the year before last.
 */
export function onlineBy(o: OnlineCube, filters: Filters, win: Win, groupBy?: Dim): Map<string, OnlineAgg> {
  const f: [number, number][] = [];
  let none = false;
  DIMS.forEach((d, i) => {
    const v = filters[d];
    if (v == null || d === groupBy) return;
    const j = o.labels[d].indexOf(v);
    if (j < 0) none = true; else f.push([i, j]);
  });
  const out = new Map<string, OnlineAgg>();
  if (none) return out;
  const gi = groupBy ? DIMS.indexOf(groupBy) : -1;
  const ok = o.cells.map((c) => f.every(([i, v]) => c[i] === v));
  const { start, end } = win, ps = start - 12, pe = end - 12;
  for (const r of o.value) {
    if (!ok[r[0]]) continue;
    const base = (2 - r[1]) * 12;
    let all = 0, web = 0, allPy = 0, webPy = 0;
    for (let m = 0; m < 12; m++) {
      const k = base + m;
      if (k >= start && k <= end) { all += r[2 + m]; web += r[14 + m]; }
      if (k >= ps && k <= pe) { allPy += r[2 + m]; webPy += r[14 + m]; }
    }
    if (!all && !allPy) continue;
    const label = gi < 0 ? "" : o.labels[DIMS[gi]][o.cells[r[0]][gi]];
    const a = out.get(label) ?? { all: 0, web: 0, allPy: 0, webPy: 0 };
    a.all += all; a.web += web; a.allPy += allPy; a.webPy += webPy;
    out.set(label, a);
  }
  return out;
}

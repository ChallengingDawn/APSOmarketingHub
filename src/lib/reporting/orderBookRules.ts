// THE ERP'S ORDER BOOK (Bernd Rausmann on My Sales Reports > Targets, relayed by SARCLA 10.11.2026: "include the order book
// - right next to the sales figures or target achievement ... where the % and 'max' are shown ... show the relevant order
// book and the % of order book against the target there").
//
// The order book is the ERP's own: the BI model (SSAS sa1030020 / I_OI_OB) measure OB_NET_REV_EUR - what is ordered and not
// invoiced yet, in euros - per customer, profit centre and delivery date, a query SARCLA adds to the morning ERP workbook
// beside his others (a sheet named "KPI ORDER BOOK", or Excel's "Query7" - known by its columns). Not HubSpot's orders:
// on 10.11.2026 13,824 of them carried no invoice date, 12,323 of those the .000 order as placed, 11,363 of which the ERP
// had already shipped - the order book cannot be told from them.
//
// Each customer (CustomerNumberUnique, "100-12345") is then its company in HubSpot (the revenue step's own map) and that
// company's Performis SAE in the customers' cube - the person the Targets measure. A line falls in the quarter it is due
// in; what is overdue, or has no date, is to deliver now: the running quarter.
// Pure: the sheet reader feeds it (../connectors/steps/erpWorkbook.ts), the store is ./orderBookStore.ts.

import { DIMS, monthOf, type Cube } from "../marketingKpis/cube";
import type { Ledger } from "../marketingKpis/ledger";

export const ORDER_BOOK_VERSION = 1;
/** the sheet's name in the morning workbook - matched without case or spaces around it */
export const SHEET_ORDER_BOOK = "KPI ORDER BOOK";
export const KV_ORDER_BOOK = "reporting:orderBook";
/** the mandants the reports count (the customers' cube, the BI sheets) */
const MANDANTS = new Set(["100", "110"]);
/** the ERP's profit centres (dim_article[ProfitCenter]: AT, DT, FT, KT, PW, ST, WS), as the cube spells its own ("dt", "kt") */
const PCS = new Set(["at", "dt", "ft", "kt", "pw", "st", "ws"]);
export const pcCode = (raw: string): string => {
  const v = raw.trim().toLowerCase();
  return v === "asw" ? "ft" : PCS.has(v) ? v : "other";
};

type Cell = string | number | boolean | Date | { v: number } | null | undefined;
const text = (c: Cell): string => (c == null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : typeof c === "object" ? String(c.v) : String(c).trim());
const num = (c: Cell): number => (c == null || c === "" ? 0 : typeof c === "number" ? c : typeof c === "object" && !(c instanceof Date) ? c.v : Number(String(c).replace(/[\s']/g, "")) || 0);
/** yyyy-mm from a date cell (a Date, an Excel serial number, yyyy-mm-dd or dd.mm.yyyy text); "" when none */
export function monthOfCell(c: Cell): string {
  if (c == null || c === "") return "";
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 7);
  const n = typeof c === "number" ? c : typeof c === "object" && "v" in c ? c.v : NaN;
  if (Number.isFinite(n) && n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000).toISOString().slice(0, 7);
  const s = String(c).trim();
  const iso = /^(\d{4})-(\d\d)/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const de = /^\d\d\.(\d\d)\.(\d{4})/.exec(s);
  return de ? `${de[2]}-${de[1]}` : "";
}

const norm = (s: string) => s.replace(/^\[|\]$/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
/** A row's column names head the order book sheet: the customer and the order book in euros. */
export const isOrderBookHead = (names: Set<string>) => names.has("orderbookeur") && names.has("customer");

/** [customer, profit centre, yyyy-mm due ("" none), euros] */
export type BookRow = [string, string, string, number];
export type OrderBookResult = { rows: number; book: BookRow[]; total: number; customers: number; skipped: number };

/** The sheet, row by row as the workbook reader gives it: the header (the first row naming Customer and OrderBookEUR), then
 *  one row per customer, profit centre and delivery day - added up by month. Other mandants and empty rows are left out. */
export class OrderBookSheet {
  private at: { customer: number; pc: number | null; day: number | null; eur: number } | null = null;
  private sums = new Map<string, number>();
  rows = 0;
  skipped = 0;
  feed(_n: number, cells: Cell[]): void {
    if (!this.at) {
      const names = cells.map((c) => norm(text(c)));
      if (!isOrderBookHead(new Set(names))) return;
      const at = (n: string) => { const i = names.indexOf(n); return i >= 0 ? i : null; };
      this.at = { customer: at("customer")!, pc: at("profitcenter"), day: at("deliverydate"), eur: at("orderbookeur")! };
      return;
    }
    const u = text(cells[this.at.customer]);
    if (!u) return;
    this.rows++;
    const eur = num(cells[this.at.eur]);
    if (!MANDANTS.has(u.split("-")[0]) || !eur) { this.skipped++; return; }
    const pc = this.at.pc == null ? "other" : pcCode(text(cells[this.at.pc]));
    const ym = this.at.day == null ? "" : monthOfCell(cells[this.at.day]);
    const k = `${u}\u0000${pc}\u0000${ym}`;
    this.sums.set(k, (this.sums.get(k) ?? 0) + eur);
  }
  /** null when the sheet had no header the rules know */
  finish(): OrderBookResult | null {
    if (!this.at) return null;
    const book: BookRow[] = [];
    for (const [k, v] of this.sums) {
      const [u, pc, ym] = k.split("\u0000");
      const eur = Math.round(v * 100) / 100;
      if (eur) book.push([u, pc, ym, eur]);
    }
    book.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));
    return { rows: this.rows, book, total: Math.round(book.reduce((a, r) => a + r[3], 0)), customers: new Set(book.map((r) => r[0])).size, skipped: this.skipped };
  }
}

/** What is kept from the morning's sheet. */
export type OrderBookKept = { v: number; at: string; day: string; file: string; rows: number; total: number; customers: number; book: BookRow[] };

/* ── per person ─────────────────────────────────────────────────────────────── */

/** The order book the four revenue targets are measured beside: all of it, the sealing (DT), the plastics (KT), and that of
 *  the new customers - each as yyyy-mm due -> euros ("" no date). */
export type BookKey = "own" | "dt" | "kt" | "new";
export type PersonBook = Record<BookKey, Record<string, number>>;
export type BookBySae = {
  day: string; at: string; total: number;
  /** the SAE's name in the customers' cube -> their book */
  sae: Record<string, PersonBook>;
  /** the order book that reaches no one: customers with no company in HubSpot, companies the cube does not count */
  unmatched: { customers: number; eur: number };
};
const emptyBook = (): PersonBook => ({ own: {}, dt: {}, kt: {}, new: {} });
const add = (m: Record<string, number>, ym: string, eur: number) => { m[ym] = Math.round(((m[ym] ?? 0) + eur) * 100) / 100; };

/**
 * Each HubSpot company the cube counted -> its Performis SAE's name and whether it is a new customer of this year - the
 * New customers' rule (its first invoice this year), or, not invoiced yet in the three years read, its first order ever this
 * year: an order book is often how a new customer begins.
 */
export function ledgerLookups(cube: Pick<Cube, "cells" | "labels">, ledger: Pick<Ledger, "ids" | "cells" | "firsts" | "rev" | "orders">, year: number) {
  const sae = DIMS.indexOf("sae");
  const at = new Map(ledger.ids.map((id, i) => [id, i]));
  const firstThisYear = new Set(ledger.firsts.filter((f) => f[1] >= monthOf(0, 0)).map((f) => f[0]));
  const invoiced = new Set(ledger.rev.map((r) => r[0]));
  const orderedThisYear = new Set((ledger.orders ?? []).filter((o) => o[1] >= year * 10_000 + 101).map((o) => o[0]));
  return {
    saeOf: (id: string): string | undefined => {
      const i = at.get(id);
      const cell = i == null ? undefined : cube.cells[ledger.cells[i]];
      return cell ? cube.labels.sae[cell[sae]] : undefined;
    },
    isNew: (id: string): boolean => {
      const i = at.get(id);
      return i != null && (firstThisYear.has(i) || (!invoiced.has(i) && orderedThisYear.has(i)));
    },
  };
}

/** The morning's order book by person: customer -> company (companyOf) -> its SAE (saeOf), and new or not (isNew). */
export function bookBySae(kept: OrderBookKept, companyOf: (u: string) => string | undefined, saeOf: (id: string) => string | undefined, isNew: (id: string) => boolean): BookBySae {
  const out: BookBySae = { day: kept.day, at: kept.at, total: kept.total, sae: {}, unmatched: { customers: 0, eur: 0 } };
  const lost = new Set<string>();
  for (const [u, pc, ym, eur] of kept.book) {
    const id = companyOf(u);
    const who = id ? saeOf(id) : undefined;
    if (!id || !who) { lost.add(u); out.unmatched.eur += eur; continue; }
    const b = (out.sae[who] ??= emptyBook());
    add(b.own, ym, eur);
    if (pc === "dt" || pc === "kt") add(b[pc], ym, eur);
    if (isNew(id)) add(b.new, ym, eur);
  }
  out.unmatched = { customers: lost.size, eur: Math.round(out.unmatched.eur) };
  return out;
}

/** The books of several people added up (a team of one is the person). */
export function sumBooks(books: (PersonBook | undefined)[]): PersonBook {
  const out = emptyBook();
  for (const b of books) if (b) for (const k of Object.keys(out) as BookKey[]) for (const [ym, eur] of Object.entries(b[k])) add(out[k], ym, eur);
  return out;
}

/**
 * A book (yyyy-mm due -> euros) on the year's quarters: due in a quarter still to come, in that quarter; overdue - due
 * before the running quarter, last year too - or with no date, in the running quarter (it is to deliver now); due after
 * the year, `later`. runQ: the running quarter (0-3).
 */
export function bookQuarters(months: Record<string, number>, year: number, runQ: number): { q: number[]; later: number } {
  const q = [0, 0, 0, 0];
  let later = 0;
  for (const [ym, eur] of Object.entries(months)) {
    const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1;
    if (!ym || !Number.isFinite(y) || y < year) q[runQ] += eur;
    else if (y > year) later += eur;
    else q[Math.max(runQ, Math.floor(m / 3))] += eur;
  }
  return { q: q.map((x) => Math.round(x)), later: Math.round(later) };
}

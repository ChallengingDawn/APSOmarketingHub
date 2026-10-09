// THE ERP STOCK FILE - rules for steps/stock.ts, tested in tests/connectors-stock.test.ts.
//
// fct_article_quantity_and_consumption.csv is a ROLLING refresh, not a daily snapshot.
// The July delta held three days of ~46,500 articles each with almost none repeated
// (1,350-1,473 in common between any two days) - together ~136,000 articles, practically
// every stocked article once. An article missing from today's file has therefore not
// gone to zero; it simply was not refreshed today. So the step keeps, per article and
// warehouse, the newest snapshot it has ever seen (a newer date wins, an older delivery
// never overwrites) and sums the warehouses from that.
//
// StockQuantity is in the article's STOCK unit. For PTFE 225 plate 0111104200 the July
// file reads 53.238 - kilograms: the 53 kg the original feed wrote into HubSpot, and
// stock_value_chf / unit_cost_chf of the same record. Performis' availability, which
// the APSOAssistant gateway writes, is in the SALES unit (one plate). HubSpot keeps both:
//   stock_quantity (+ stock_unit)  kilograms  - THIS step, for cross-unit articles only
//   stock_sales    (+ sales_unit)  pieces     - the gateway
// For same-unit articles (o-rings, Stk/Stk) the gateway owns stock_quantity and this
// step leaves it alone: exactly one writer per article, decided by isCrossUnit below,
// which must stay identical to isCrossUnit in APSOAssistant smart-bar/gateway/stock.js.
// SARCLA 2026-10-09: "kg + pieces, both correct".

export const FCT_FILE = "fct_article_quantity_and_consumption.csv";

/** A number from the file ("88.0000", "3,5765"); null for an empty or broken cell. */
export function num(s: string | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* ── units: the same rule as the gateway ───────────────────────────────── */

const PCS = new Set(["stk", "stck", "stück", "stueck", "st", "pc", "pce", "pcs", "piece", "pieces", "pièce", "pièces", "pz", "ea", "each", "unit", "unité"]);
const METRE = new Set(["m", "meter", "metre", "mtr", "lfm", "rm"]);
const SQM = new Set(["m2", "m²", "qm", "sqm"]);
const KILO = new Set(["kg", "kgs"]);

/** Equivalent spellings collapse: Stk = Pcs = Stück, m2 = m², … (gateway normUnit). */
export function normUnit(u: string | null | undefined): string {
  const x = String(u ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (PCS.has(x)) return "pcs";
  if (METRE.has(x)) return "m";
  if (SQM.has(x)) return "m2";
  if (KILO.has(x)) return "kg";
  return x;
}

/**
 * Stock unit and sales unit genuinely differ (kg held, sold by the piece). Both must be
 * known; equivalent spellings and a multiplier unit ("100 Pcs" of a Pcs article) are NOT
 * cross-unit. Identical to the gateway's isCrossUnit - the two decide who writes
 * stock_quantity, so a difference would leave an article with two writers or none.
 */
export function isCrossUnit(stockUnit: string | null | undefined, salesUnit: string | null | undefined): boolean {
  if (!stockUnit || !salesUnit) return false;
  const a = normUnit(stockUnit), b = normUnit(salesUnit);
  if (a === b) return false;
  const m = String(salesUnit).trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(.+)$/);
  if (m && normUnit(m[2]) === a) return false;
  return true;
}

/* ── the file ──────────────────────────────────────────────────────────── */

/** One warehouse's figures on one day. Every number is in the article's stock unit / currency. */
export type Snap = { date: number; qty: number; cons: number; mov: number; gw: number | null; vchf: number; veur: number };

const NEED = ["dim_date_StockValue_key", "WarehouseId", "dim_article_key", "StockQuantity", "ArticleConsumption",
  "ArticleMovement", "GwstdpCHF", "StockValueGWSTDPChf", "StockValueGWSTDPEur", "delete_flag"] as const;

/** Reads the fact's rows by header name (the column order is BI's, not ours). */
export class FctReader {
  private readonly ix: Record<(typeof NEED)[number], number>;
  rows = 0;
  deleted = 0;
  broken = 0;

  constructor(header: string[]) {
    const h = header.map((c, i) => (i === 0 ? c.replace(/^﻿/, "") : c).trim());
    const ix = {} as Record<(typeof NEED)[number], number>;
    for (const name of NEED) {
      const i = h.indexOf(name);
      if (i < 0) throw new Error(`${FCT_FILE} has no column ${name}`);
      ix[name] = i;
    }
    this.ix = ix;
  }

  /** The row's article key, warehouse and figures; null for a deleted or unusable row. */
  row(r: string[]): { key: string; wh: string; snap: Snap } | null {
    this.rows += 1;
    const g = (k: (typeof NEED)[number]) => r[this.ix[k]];
    if ((g("delete_flag") ?? "").trim().toUpperCase() === "Y") { this.deleted += 1; return null; }
    const key = (g("dim_article_key") ?? "").trim(), wh = (g("WarehouseId") ?? "").trim();
    const date = num(g("dim_date_StockValue_key"));
    if (!key || !wh || date === null) { this.broken += 1; return null; }
    return {
      key, wh,
      snap: {
        date, qty: num(g("StockQuantity")) ?? 0, cons: num(g("ArticleConsumption")) ?? 0, mov: num(g("ArticleMovement")) ?? 0,
        gw: num(g("GwstdpCHF")), vchf: num(g("StockValueGWSTDPChf")) ?? 0, veur: num(g("StockValueGWSTDPEur")) ?? 0,
      },
    };
  }
}

/** dim_article.csv: dim_article_key -> ArticleNumber, kept only for the keys asked for. */
export class KeyBridge {
  private readonly k: number;
  private readonly a: number;
  readonly map = new Map<string, string>();

  constructor(header: string[]) {
    const h = header.map((c, i) => (i === 0 ? c.replace(/^﻿/, "") : c).trim());
    this.k = h.indexOf("dim_article_key");
    this.a = h.indexOf("ArticleNumber");
    if (this.k < 0 || this.a < 0) throw new Error("dim_article.csv has no dim_article_key / ArticleNumber column");
  }

  add(r: string[], wanted: Set<string>): void {
    const key = (r[this.k] ?? "").trim();
    if (!wanted.has(key)) return;
    const art = (r[this.a] ?? "").trim();
    if (art) this.map.set(key, art);
  }
}

/** Is `b` newer than what is held? A tie keeps what is held - one delivery is not overwritten by a copy of itself. */
export const newer = (held: Snap | undefined, b: Snap): boolean => !held || b.date > held.date;

/** Keep the newest snapshot per key in `m`; true when `s` replaced or added one. */
export function keepNewest(m: Map<string, Snap>, key: string, s: Snap): boolean {
  if (!newer(m.get(key), s)) return false;
  m.set(key, s);
  return true;
}

/** The article's figures: every warehouse summed, the unit cost the highest any warehouse carries. */
export type Agg = { qty: number; cons: number; mov: number; vchf: number; veur: number; gw: number | null; warehouses: number; latest: number };

export function sumSnaps(snaps: Iterable<Snap>): Agg {
  const a: Agg = { qty: 0, cons: 0, mov: 0, vchf: 0, veur: 0, gw: null, warehouses: 0, latest: 0 };
  for (const s of snaps) {
    a.qty += s.qty; a.cons += s.cons; a.mov += s.mov; a.vchf += s.vchf; a.veur += s.veur;
    if (s.gw !== null) a.gw = a.gw === null ? s.gw : Math.max(a.gw, s.gw);
    a.warehouses += 1;
    a.latest = Math.max(a.latest, s.date);
  }
  return a;
}

/* ── what HubSpot gets ─────────────────────────────────────────────────── */

/** A number as HubSpot takes it: rounded, no trailing zeros, never "-0". */
export function fmt(n: number, places: number): string {
  const r = Number(n.toFixed(places));
  return String(Object.is(r, -0) ? 0 : r);
}

/** The properties this step owns. stock_quantity only where the article is cross-unit. */
export const VALUE_PROPS = ["stock_value_chf", "stock_value_eur", "unit_cost_chf", "consumption", "stock_movement"] as const;
export const KG_PROP = "stock_quantity";

export function stockPayload(a: Agg, crossUnit: boolean): Record<string, string> {
  const p: Record<string, string> = {
    stock_value_chf: fmt(a.vchf, 2),
    stock_value_eur: fmt(a.veur, 2),
    consumption: fmt(a.cons, 4),
    stock_movement: fmt(a.mov, 4),
  };
  if (a.gw !== null) p.unit_cost_chf = fmt(a.gw, 4);
  if (crossUnit) p[KG_PROP] = fmt(a.qty, 4);
  return p;
}

/** Does HubSpot already hold these numbers? Compared as numbers ("0.0" is "0"); a missing value is a difference. */
export function sameNumbers(payload: Record<string, string>, current: Record<string, string | null | undefined>): boolean {
  for (const [k, v] of Object.entries(payload)) {
    const want = num(v), have = num(current[k]);
    if (want === null || have === null) { if (want !== have) return false; continue; }
    if (Math.abs(want - have) > 1e-6) return false;
  }
  return true;
}

/** The change-cache key: the payload, keys sorted. */
export function stockHash(p: Record<string, string>): string {
  return Object.keys(p).sort().map((k) => `${k}=${p[k]}`).join("|");
}

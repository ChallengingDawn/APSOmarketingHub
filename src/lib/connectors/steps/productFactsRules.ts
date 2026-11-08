// PRODUCT FACTS (SARCLA 08.11.2026: "products is also a night mare if we could get gwstdp purchase price and so forth would
// be amazing"; "unit_cost_chf but there is more properties we never received"). HubSpot's "Products & Pricing" records
// (object 2-200042439, one per article_number) carry ERP fields that are empty on most articles (measured 08.11.2026:
// GWSTDP 33 %, stock value 33 %, material 47 %, main supplier 4 % ...). The BI model holds them: the morning workbook's
// sheet "KPI ARTICLES" (one row per article: the article, its product properties, its current GWStdP, its stock on the
// latest day, its lead supplier). Each value is checked against its property: numbers as numbers, dates as dates, a choice
// list's value only when HubSpot lists it (the writer reads the options). Pure; the I/O is ./productFacts.ts.

import { cpSlice, pyStrip } from "./orderRules";
import { dayOf } from "../../reporting/boErpLines";

export const SHEET_ARTICLES = "KPI ARTICLES";
export const PRODUCTS_OBJECT = "2-200042439";
/** OFF until SARCLA has seen the preview's figures (and the GWStdP's unit is confirmed against the third already filled) */
export const PRODUCT_FACTS_LIVE = false;
/** the GWStdP is the ERP's price per this many stock units; HubSpot's unit_cost_chf is per unit - checked by the preview */
export const GWSTDP_PER = 100;

export type Facts = Record<string, string>;
type Cell = Parameters<typeof dayOf>[0];
const text = (c: Cell) => (c == null ? "" : c instanceof Date ? dayOf(c) : typeof c === "object" ? String((c as { v: number }).v) : String(c).trim());
const norm = (s: string) => s.replace(/^\[|\]$/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const clean = (s: string) => cpSlice(pyStrip(s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/ {2,}/g, " ")), 0, 500);
const num = (s: string) => { if (s === "") return null; const n = Number(s.replace(/'/g, "")); return Number.isFinite(n) ? n : null; };
const r2 = (n: number) => String(Math.round(n * 100) / 100);
const r4 = (n: number) => String(Math.round(n * 10000) / 10000);

const COLS = ["article", "articletype", "inliquidation", "countryoforigin", "consumptiondriven", "replenishmentdays", "tariffnumber", "suppliername",
  "gwstdpcurrency", "gwstdpchf", "gwstdpeur", "gwstdpusd", "stockday", "stockvaluechf", "stockvalueeur", "consumption", "movement",
  "material", "hardness", "colour", "compoundap", "compoundsupplier", "conformity"] as const;
export type ArticleRow = Record<(typeof COLS)[number], string>;

/** The sheet, row by row: the header (the first row naming Article and GwstdpCHF), then one article a row - the first wins. */
export class ArticlesSheet {
  private at: Record<string, number> | null = null;
  private rows = new Map<string, ArticleRow>();
  feed(_n: number, cells: Cell[]): void {
    if (!this.at) {
      const names = cells.map((c) => norm(text(c)));
      if (!names.includes("article") || !names.includes("gwstdpchf")) return;
      this.at = Object.fromEntries(COLS.map((k) => [k, names.indexOf(k)]));
      return;
    }
    const r = Object.fromEntries(COLS.map((k) => [k, this.at![k] >= 0 ? text(cells[this.at![k]]) : ""])) as ArticleRow;
    if (!r.article || this.rows.has(r.article)) return;
    this.rows.set(r.article, r);
  }
  finish(): ArticleRow[] | null { return this.at ? [...this.rows.values()] : null; }
}

/** One article's facts, before the choice lists are checked against HubSpot's options (./productFacts.ts). */
export function articleFacts(r: ArticleRow): Facts {
  const f: Facts = {};
  const put = (k: string, v: string | null | undefined) => { if (v != null && v !== "") f[k] = v; };
  // the GWStdP, in the article's lead currency (unit_cost_chf says so), per stock unit
  const cur = r.gwstdpcurrency.toUpperCase();
  const lead = cur === "CHF" ? num(r.gwstdpchf) : cur === "EUR" ? num(r.gwstdpeur) : cur === "USD" ? num(r.gwstdpusd) : null;
  if (lead != null && lead > 0) { put("unit_cost_chf", r4(lead / GWSTDP_PER)); put("currency", cur); }
  // the stock on the latest day
  const sv = num(r.stockvaluechf), se = num(r.stockvalueeur), co = num(r.consumption), mv = num(r.movement);
  if (sv != null) put("stock_value_chf", r2(sv));
  if (se != null) put("stock_value_eur", r2(se));
  if (co != null) put("consumption", r2(co));
  if (mv != null) put("stock_movement", r2(mv));
  const sd = dayOf(r.stockday);
  if (sd && sd < "2100-01-01") put("stock_as_of_date", sd);
  // the article
  const rd = num(r.replenishmentdays);
  if (rd != null && rd >= 0) put("replenishment_days", String(Math.round(rd)));
  put("country_of_origin", clean(r.countryoforigin));
  const cd = clean(r.consumptiondriven).toUpperCase();
  if (cd === "J" || cd === "N") put("consumption_driven", cd);
  put("tarifs_number", clean(r.tariffnumber));
  const liq = clean(r.inliquidation).toUpperCase();
  if (liq === "J" || liq === "Y" || liq === "1" || liq === "TRUE") put("article_status", "Liquidation");
  else if (liq === "N" || liq === "0" || liq === "FALSE") put("article_status", "Running Article");
  if (r.articletype === "Special" || r.articletype === "Standard") put("c2s_article", r.articletype === "Special" ? "true" : "false");
  put("main_supplier", clean(r.suppliername));
  // its product properties
  put("material", clean(r.material));
  put("hardness", clean(r.hardness));
  put("colour", clean(r.colour));
  put("ap_compound_designation", clean(r.compoundap));
  put("supplier_compound_designation", clean(r.compoundsupplier));
  put("conformities", clean(r.conformity));
  return f;
}

/** Keeps only the values a choice-list property lists (HubSpot refuses the whole record's update for one wrong option). */
export function checkOptions(f: Facts, options: ReadonlyMap<string, ReadonlySet<string>>): { facts: Facts; dropped: string[] } {
  const out: Facts = {}, dropped: string[] = [];
  for (const [k, v] of Object.entries(f)) {
    const o = options.get(k);
    if (o && !o.has(v)) { dropped.push(k); continue; }
    out[k] = v;
  }
  return { facts: out, dropped };
}

export const factsHash = (f: Facts) => Object.keys(f).sort().map((k) => `${k}=${f[k]}`).join("\u0001");

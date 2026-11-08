// PRODUCT FACTS (SARCLA 08.11.2026: "products is also a night mare if we could get gwstdp purchase price and so forth would
// be amazing"; "unit_cost_chf but there is more properties we never received"; "we have to be careful with purchasing
// price unit"). HubSpot's "Products & Pricing" records (object 2-200042439, one per article_number) carry ERP fields that are
// empty on most articles (measured 08.11.2026: GWSTDP 33 %, stock value 33 %, material 47 %, main supplier 4 % ...). The BI
// model holds them: the morning workbook's sheet "KPI ARTICLES" (one row per article: the article, its product properties,
// its current GWStdP, its stock on the latest day). Each value is checked against its property: numbers as numbers, dates as
// dates, a choice list's value only when HubSpot lists it (the writer reads the options). Pure; the I/O is ./productFacts.ts.
//
// THE GWStdP's UNIT (checked 08.11.2026 on 1,422 articles HubSpot already held a value for): HubSpot's unit_cost_chf (label
// "GWSTDP") is the cost of ONE STOCK UNIT IN CHF = the ERP's GWStdP in CHF / 100 - the ERP's price is per 100 stock units.
// Median ratio 1.0000 against CHF/100 (1.10 against EUR/100: the exchange rate), whatever the "currency" field says; 37 %
// within 2 % today, the rest older values loaded once and never refreshed. The unit is the STOCK unit (m, Pcs, kg, m2 - the
// record's stock_unit), not the sales unit: a plate stocked in kg and sold per piece has its cost per kg; nothing converts
// it (no weight per piece in the model). 0.01 is the ERP's placeholder for "no cost": nothing at or under 0.05 is written.

import { cpSlice, pyStrip } from "./orderRules";
import { dayOf } from "../../reporting/boErpLines";

export const SHEET_ARTICLES = "KPI ARTICLES";
export const PRODUCTS_OBJECT = "2-200042439";
/** OFF until SARCLA has seen the preview's figures */
export const PRODUCT_FACTS_LIVE = false;
/** the ERP's GWStdP is per 100 stock units; HubSpot's unit_cost_chf is per stock unit (checked 08.11.2026, see above) */
export const GWSTDP_PER = 100;
/** the ERP's "no cost" placeholder is 0.01 per 100 units: nothing this low is a cost */
export const GWSTDP_MIN = 0.05;

export type Facts = Record<string, string>;
type Cell = Parameters<typeof dayOf>[0];
const text = (c: Cell) => (c == null ? "" : c instanceof Date ? dayOf(c) : typeof c === "object" ? String((c as { v: number }).v) : String(c).trim());
const norm = (s: string) => s.replace(/^\[|\]$/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const clean = (s: string) => cpSlice(pyStrip(s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/ {2,}/g, " ")), 0, 500);
const num = (s: string) => { if (s === "") return null; const n = Number(s.replace(/'/g, "")); return Number.isFinite(n) ? n : null; };
const r2 = (n: number) => String(Math.round(n * 100) / 100);
const r4 = (n: number) => String(Math.round(n * 10000) / 10000);

const COLS = ["article", "articletype", "inliquidation", "countryoforigin", "consumptiondriven", "replenishmentdays", "tariffnumber", "suppliername",
  "gwstdpcurrency", "gwstdpchf", "stockday", "stockvaluechf", "stockvalueeur", "consumption", "movement",
  "material", "hardness", "colour", "compoundap", "compoundsupplier", "conformity"] as const;
export type ArticleRow = Record<(typeof COLS)[number], string>;

/** the properties written, in a fixed order - an article's facts are kept packed in it */
export const PRODUCT_KEYS = ["unit_cost_chf", "currency", "stock_value_chf", "stock_value_eur", "consumption", "stock_movement", "stock_as_of_date",
  "replenishment_days", "country_of_origin", "consumption_driven", "tarifs_number", "article_status", "c2s_article", "main_supplier",
  "material", "hardness", "colour", "ap_compound_designation", "supplier_compound_designation", "conformities"] as const;
export const packFacts = (f: Facts) => PRODUCT_KEYS.map((k) => f[k] ?? "").join("\u0001");
export function unpackFacts(s: string): Facts {
  const f: Facts = {};
  s.split("\u0001").forEach((v, i) => { if (v && PRODUCT_KEYS[i]) f[PRODUCT_KEYS[i]] = v; });
  return f;
}

/** One article's facts, before the choice lists are checked against HubSpot's options (./productFacts.ts). */
export function articleFacts(r: ArticleRow): Facts {
  const f: Facts = {};
  const put = (k: string, v: string | null | undefined) => { if (v != null && v !== "") f[k] = v; };
  // the GWStdP: CHF per stock unit (the ERP's CHF price per 100 units / 100), the article's lead currency beside it
  const chf = num(r.gwstdpchf);
  if (chf != null && chf > GWSTDP_MIN) put("unit_cost_chf", r4(chf / GWSTDP_PER));
  const cur = r.gwstdpcurrency.toUpperCase();
  if (/^[A-Z]{3}$/.test(cur)) put("currency", cur);
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

/**
 * The sheet, row by row: the header (the first row naming Article and GwstdpCHF), then one article a row - the first wins.
 * Only the articles `keep` names are kept (the BI model has ~860,000, HubSpot ~142,000), each as its packed facts.
 */
export class ArticlesSheet {
  private at: Record<string, number> | null = null;
  private facts = new Map<string, string>();
  rows = 0;
  skipped = 0;
  constructor(private keep: (article: string) => boolean = () => true) {}
  feed(_n: number, cells: Cell[]): void {
    if (!this.at) {
      const names = cells.map((c) => norm(text(c)));
      if (!names.includes("article") || !names.includes("gwstdpchf")) return;
      this.at = Object.fromEntries(COLS.map((k) => [k, names.indexOf(k)]));
      return;
    }
    const at = this.at;
    const article = at.article >= 0 ? text(cells[at.article]) : "";
    if (!article) return;
    this.rows++;
    if (this.facts.has(article)) return;
    if (!this.keep(article)) { this.skipped++; return; }
    const r = Object.fromEntries(COLS.map((k) => [k, at[k] >= 0 ? text(cells[at[k]]) : ""])) as ArticleRow;
    this.facts.set(article, packFacts(articleFacts(r)));
  }
  /** article -> its packed facts; null when the sheet had no header the rules know */
  finish(): Map<string, string> | null { return this.at ? this.facts : null; }
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

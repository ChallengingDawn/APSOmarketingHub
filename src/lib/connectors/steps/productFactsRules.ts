// PRODUCT FACTS (SARCLA 08.11.2026: "products is also a night mare if we could get gwstdp purchase price and so forth would
// be amazing"; "we have to be careful with purchasing price unit"; "did you have also the euro and the USD and the unit").
// HubSpot's "Products & Pricing" records (object 2-200042439, one per article_number) get, from the ERP's BI model (the
// morning workbook's sheet "KPI ARTICLES", one row per article), ONLY what no other step writes - one writer per property:
//   unit_cost_chf (+ currency)        the GWStdP: the stock step (stock_load) owns it whenever that step is live
//   unit_cost_eur, unit_cost_usd      the same cost in EUR / USD - written only once HubSpot has such a property
//   stock_unit                        the unit the cost is per - ONLY where it does not move who writes the stock (below)
//   article_status                    Liquidation / Running Article (DirectUP and the search bar show it to customers)
//   main_supplier                     the article's lead supplier (KPI ARTICLES LeadSupplier) named by the sheet "KPI SUPPLIERS"
//                                     (the ERP's supplier list) - 1 % filled in HubSpot; 78 % of a sample of 1,496 articles has one
// NOT here, because another step already writes them every day: the article master from dim_article.csv (material,
// hardness, colour, compounds, conformities, tariff number, replenishment days, country of origin, consumption driven,
// sales unit - ./filesRules.ts STR_MAP / ENUM_MAP) and the stock (stock_quantity: the search bar's gateway, or stock_load for
// cross-unit articles; stock_sales: the gateway; stock values, consumption, movement: stock_load). Pure; I/O in ./productFacts.ts.
//
// THE GWStdP's UNIT (checked 08.11.2026 on 1,422 articles HubSpot already held a value for): HubSpot's unit_cost_chf (label
// "GWSTDP") is the cost of ONE STOCK UNIT IN CHF = the ERP's GWStdP in CHF / 100 - the ERP's price is per 100 stock units.
// Median ratio 1.0000 against CHF/100 for every stock unit (m 561 articles, Stk 216, kg 204, m2 16); 1.10 against EUR/100
// (the exchange rate), whatever the "currency" field says. The stock step's own source (fct_article_quantity_and_consumption
// GwstdpCHF) is already per one unit, so both writers agree. The unit is the STOCK unit (m, Stk, kg, m2), not the sales unit:
// a plate stocked in kg and sold per piece has its cost per kg; nothing converts it (no weight per piece in the model).
// 0.01 is the ERP's placeholder for "no cost": nothing at or under 0.05 is written.
//
// THE STOCK UNIT moves the stock's writer: an article whose stock unit and sales unit differ (kg held, sold by the piece) has
// its stock_quantity written by stock_load in kg, every other one by the search bar's gateway in pieces (isCrossUnit, the
// same rule in the gateway's stock.js). Filling an empty stock unit with "kg" on a piece-sold article would hand its stock to
// stock_load - off today - and freeze it. So the ERP's stock unit is written only where that answer stays the same; the
// others are counted and held for SARCLA. The same unit in another spelling (Pcs / Stk, Kg / kg) is left as HubSpot has it.

import { cpSlice, pyStrip } from "./orderRules";
import { dayOf } from "../../reporting/boErpLines";
import { isCrossUnit, normUnit } from "./stockRules";

export const SHEET_ARTICLES = "KPI ARTICLES";
export const SHEET_SUPPLIERS = "KPI SUPPLIERS";
export const PRODUCTS_OBJECT = "2-200042439";
/** ON since 08.11.2026 (SARCLA: "switch writing on ... it's also important that we have purchasing price") - the unit checked
 *  on 1,422 articles, the stock unit on all 226,812 (35 held), no HubSpot workflow watches these properties */
export const PRODUCT_FACTS_LIVE = true;
/** the ERP's GWStdP is per 100 stock units; HubSpot's unit_cost_chf is per stock unit (checked 08.11.2026, see above) */
export const GWSTDP_PER = 100;
/** the ERP's "no cost" placeholder is 0.01 per 100 units: nothing this low is a cost */
export const GWSTDP_MIN = 0.05;
/** the step that owns the GWStdP when it is live (./stock.ts) */
export const STOCK_STEP = "stock_load";
export const STOCK_STEP_PROPS = ["unit_cost_chf"] as const;

export type Facts = Record<string, string>;
type Cell = Parameters<typeof dayOf>[0];
const text = (c: Cell) => (c == null ? "" : c instanceof Date ? dayOf(c) : typeof c === "object" ? String((c as { v: number }).v) : String(c).trim());
const norm = (s: string) => s.replace(/^\[|\]$/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const clean = (s: string) => cpSlice(pyStrip(s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/ {2,}/g, " ")), 0, 500);
const num = (s: string) => { if (s === "") return null; const n = Number(s.replace(/'/g, "")); return Number.isFinite(n) ? n : null; };
const r4 = (n: number) => String(Math.round(n * 10000) / 10000);

/** the sheet's columns the rules read (an older sheet's other columns are ignored) */
const COLS = ["article", "inliquidation", "gwstdpcurrency", "gwstdpchf", "gwstdpeur", "gwstdpusd", "stockunit", "salesunit", "suppliername", "leadsupplier"] as const;
export type ArticleRow = Record<(typeof COLS)[number], string>;

/** the properties written, in a fixed order - an article's facts are kept packed in it */
export const PRODUCT_KEYS = ["unit_cost_chf", "unit_cost_eur", "unit_cost_usd", "currency", "stock_unit", "article_status", "main_supplier"] as const;
export const packFacts = (f: Facts) => PRODUCT_KEYS.map((k) => f[k] ?? "").join("\u0001");
export function unpackFacts(s: string): Facts {
  const f: Facts = {};
  s.split("\u0001").forEach((v, i) => { if (v && PRODUCT_KEYS[i]) f[PRODUCT_KEYS[i]] = v; });
  return f;
}

/** One article's facts, before they are checked against HubSpot (its properties, options and units - ./productFacts.ts). */
export function articleFacts(r: ArticleRow): Facts {
  const f: Facts = {};
  const put = (k: string, v: string | null | undefined) => { if (v != null && v !== "") f[k] = v; };
  // the GWStdP per stock unit (the ERP's price per 100 units / 100), in CHF, EUR and USD, the lead currency beside it
  const cost = (k: string, s: string) => { const n = num(s); if (n != null && n > GWSTDP_MIN) put(k, r4(n / GWSTDP_PER)); };
  cost("unit_cost_chf", r.gwstdpchf);
  cost("unit_cost_eur", r.gwstdpeur);
  cost("unit_cost_usd", r.gwstdpusd);
  const cur = r.gwstdpcurrency.toUpperCase();
  if (/^[A-Z]{3}$/.test(cur)) put("currency", cur);
  // the unit the cost is per, as the ERP spells it (Stk, kg, m, m2, mm, Set); "Unknown" is none
  const su = clean(r.stockunit);
  if (su && su.toLowerCase() !== "unknown") put("stock_unit", su);
  const liq = clean(r.inliquidation).toUpperCase();
  if (liq === "J" || liq === "Y" || liq === "1" || liq === "TRUE") put("article_status", "Liquidation");
  else if (liq === "N" || liq === "0" || liq === "FALSE") put("article_status", "Running Article");
  put("main_supplier", clean(r.suppliername));
  return f;
}

/**
 * The ERP's stock unit against HubSpot's units: write it, or why not. "same" = HubSpot already says it (maybe in another
 * spelling); "moves_stock" = it would change which writer owns the article's stock_quantity (see above) - held for SARCLA.
 */
export function stockUnitCall(erp: string | undefined, hsStock: string | null | undefined, hsSales: string | null | undefined): "write" | "same" | "moves_stock" | "none" {
  if (!erp) return "none";
  if (hsStock && normUnit(hsStock) === normUnit(erp)) return "same";
  if (isCrossUnit(hsStock, hsSales) !== isCrossUnit(erp, hsSales)) return "moves_stock";
  return "write";
}

/** a supplier number as both sheets may give it: "0012345", 12345 and "12345" are one supplier */
export const supplierKey = (v: string) => { const t = v.trim().replace(/\.0+$/, ""); return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, "") : t.toUpperCase(); };

/** The ERP's supplier list, row by row: the header (the first row naming SupplierNumber and SupplierName), then a supplier
 *  a row - number -> name. (One query per article for the name took ages and named every article's supplier the same.) */
export class SuppliersSheet {
  private at: { n: number; name: number } | null = null;
  private names = new Map<string, string>();
  feed(_n: number, cells: Cell[]): void {
    if (!this.at) {
      const names = cells.map((c) => norm(text(c)));
      const n = names.indexOf("suppliernumber"), name = names.indexOf("suppliername");
      if (n >= 0 && name >= 0) this.at = { n, name };
      return;
    }
    const k = supplierKey(text(cells[this.at.n])), v = clean(text(cells[this.at.name]));
    if (k && v && !this.names.has(k)) this.names.set(k, v);
  }
  finish(): Map<string, string> | null { return this.at ? this.names : null; }
}

/**
 * The sheet, row by row: the header (the first row naming Article and GwstdpCHF), then one article a row - the first wins.
 * Only the articles `keep` names are kept (the BI model has ~860,000, HubSpot ~227,000), each as its packed facts; the lead
 * supplier's name from `suppliers` (the sheet KPI SUPPLIERS, read first).
 */
export class ArticlesSheet {
  private at: Record<string, number> | null = null;
  private facts = new Map<string, string>();
  rows = 0;
  skipped = 0;
  constructor(private keep: (article: string) => boolean = () => true, private suppliers: ReadonlyMap<string, string> | null = null) {}
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
    if (!r.suppliername && r.leadsupplier && this.suppliers) r.suppliername = this.suppliers.get(supplierKey(r.leadsupplier)) ?? "";
    this.facts.set(article, packFacts(articleFacts(r)));
  }
  /** article -> its packed facts; null when the sheet had no header the rules know */
  finish(): Map<string, string> | null { return this.at ? this.facts : null; }
}

/** HubSpot's side of the check: its properties (a choice list's options, or null), and who else writes what. */
export type HubSpotSide = { props: ReadonlyMap<string, ReadonlySet<string> | null>; stockStepLive: boolean };

/**
 * Keeps only what may be written: a property HubSpot has (unit_cost_eur / _usd wait for an admin to create them), a value a
 * choice list lists (HubSpot refuses the whole record's update for one wrong option), nothing the stock step owns while it
 * is live. The stock unit is decided per record by stockUnitCall, with HubSpot's units at that moment.
 */
export function checkFacts(f: Facts, hs: HubSpotSide): { facts: Facts; dropped: Record<string, string> } {
  const out: Facts = {}, dropped: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (!hs.props.has(k)) { dropped[k] = "no such property in HubSpot"; continue; }
    if (hs.stockStepLive && (STOCK_STEP_PROPS as readonly string[]).includes(k)) { dropped[k] = "the stock step writes it"; continue; }
    const o = hs.props.get(k);
    if (o && !o.has(v)) { dropped[k] = "not one of its options"; continue; }
    out[k] = v;
  }
  return { facts: out, dropped };
}

/** Does HubSpot already hold these values? Numbers compared as numbers ("1.50" is "1.5"). */
export function sameValues(f: Facts, current: Record<string, string | null | undefined>): boolean {
  for (const [k, v] of Object.entries(f)) {
    const c = (current[k] ?? "").trim();
    const a = Number(v), b = Number(c);
    if (c !== "" && Number.isFinite(a) && Number.isFinite(b) && v.trim() !== "" && Math.abs(a - b) < 1e-6) continue;
    if (c !== v) return false;
  }
  return true;
}

export const factsHash = (f: Facts) => Object.keys(f).sort().map((k) => `${k}=${f[k]}`).join("\u0001");

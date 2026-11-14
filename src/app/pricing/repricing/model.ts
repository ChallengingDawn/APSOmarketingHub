// Repricing Studio — types and the price arithmetic shared by the page, the Excel export and
// the PDF, so all three always show exactly the same numbers.

export type Scale = { qty: number | null; list: number | null };
export type CompPrices = { unit: string | null; prices: Record<number, number>; converted: boolean };
export type Article = {
  id: number; article_number: string; description: string; material: string; diameter: number | null;
  assortment_number: string | null; assortment_description: string | null;
  main_group_number: string | null; main_group_description: string | null;
  sub_group: string | null; sub_group_description: string | null;
  product_number: string | null; product_description: string | null;
  profit_center: string | null; sales_unit: string | null; stock_unit: string | null; unit: string | null;
  article_status: string | null; stock: number | null; mandant: string | null;
  // gwstdp = HubSpot unit_cost_chf: ERP standard cost per ONE stock unit, in its LEAD currency.
  gwstdp: number | null; gwstdp_currency: string | null;
  gwstdp_date: string | null;      // when that cost took its current value
  list_cost_date: string | null;   // supplier-list cost date (Purchasing), for reference
  price_date: string | null;       // when the listed price took its current value
  synced_at: string | null;        // when this article was last copied from HubSpot
  correction: number | null; basic_current: number | null; m100_current: number | null;
  basic_scales: Scale[] | null; m100_scales: Scale[] | null;
  matched: boolean;
  competitors?: Record<string, CompPrices>;
};
export type Tier = { qty: number; factor: number };
// fx = how many EUR one unit of the cost's lead currency is worth (cost → EUR before factors).
export type Factors = { base: number; country_m100: number; country_m110: number; currency: number; tiers: Tier[]; fx: Record<string, number> };
export type Kind = "basic" | "m100" | "m110";

export const DEFAULT_FACTORS: Factors = {
  base: 1.90, country_m100: 0.90, country_m110: 0.90, currency: 1.15,
  tiers: [{ qty: 1, factor: 1 }, { qty: 5, factor: 0.95 }, { qty: 10, factor: 0.90 }, { qty: 25, factor: 0.85 }, { qty: 50, factor: 0.80 }],
  fx: { CHF: 1.07, GBP: 0, USD: 0, SEK: 0 },
};
export const FX_CURRENCIES = ["CHF", "GBP", "USD", "SEK"] as const;

export function normFactors(p: Partial<Factors> & { country?: number }): Factors {
  const n = (v: unknown, d: number) => (Number(v) > 0 ? Number(v) : d);
  const fx: Record<string, number> = { ...DEFAULT_FACTORS.fx };
  if (p?.fx && typeof p.fx === "object") for (const k of Object.keys(p.fx)) { const v = Number(p.fx[k]); if (isFinite(v) && v >= 0) fx[k] = v; }
  return {
    base: n(p?.base, DEFAULT_FACTORS.base),
    country_m100: n(p?.country_m100 ?? p?.country, DEFAULT_FACTORS.country_m100),
    country_m110: n(p?.country_m110 ?? p?.country, DEFAULT_FACTORS.country_m110),
    currency: n(p?.currency, DEFAULT_FACTORS.currency),
    tiers: Array.isArray(p?.tiers) && p.tiers.length
      ? p.tiers.filter(t => Number(t.qty) > 0 && Number(t.factor) > 0).map(t => ({ qty: Number(t.qty), factor: Number(t.factor) }))
      : DEFAULT_FACTORS.tiers,
    fx,
  };
}

// Competitor sets (CHF on the M100 side, EUR on the M110 side).
export const COMPS_CHF = [{ code: "amsler", label: "Amsler" }, { code: "cellpack", label: "Cellpack" }, { code: "kundert", label: "Kundert" }];
export const COMPS_EUR = [{ code: "vink", label: "VINK" }, { code: "reiff", label: "Reiff" }, { code: "thyssen", label: "Thyssen" }];
export const ALL_COMPS = [...COMPS_CHF, ...COMPS_EUR];
export const compKind = (code: string): Kind => (COMPS_CHF.some(x => x.code === code) ? "m100" : "m110");

export const scaleFactor = (f: Factors, qty: number) => { const t = f.tiers.find(x => x.qty === qty); return t ? t.factor : 1; };
// At quantity 1 the LISTED price is the price (SARCLA: the listed 10.02 is correct, not the
// ERP scale). Rods carry one ERP scale "from 1 m" at ~0.91 × list (0117154506 PEEK Ø6: listed
// 10.02, scale qty 1 = 9.12), so scales only apply from the NEXT tier on — same as Benchmark.
export const currentAt = (scales: Scale[] | null, base: number | null, t: number) => {
  if (t <= 1 && base != null) return base;
  let best = base, bestQty = -1;
  for (const s of scales || []) if (s.list != null && s.qty != null && s.qty <= t && s.qty > bestQty) { best = s.list; bestQty = s.qty; }
  return best;
};
/** "ERP scale from 1 m: 9.12" when the ERP carries a scale at/below qty 1 that differs from the listed price. */
export const erpScaleNote = (scales: Scale[] | null, base: number | null, unit: string): string | null => {
  const s = (scales || []).filter(x => x.qty != null && x.list != null && x.qty <= 1).sort((a, b) => (b.qty! - a.qty!))[0];
  if (!s || base == null || Math.abs(s.list! - base) < 0.005) return null;
  return `ERP scale from ${s.qty} ${unit || "unit"}: ${s.list!.toFixed(2)} (listed ${base.toFixed(2)} used at 1+)`;
};
export const currentFor = (a: Article, kind: Kind, t: number) =>
  kind === "basic" ? currentAt(a.basic_scales, a.basic_current, t) : kind === "m100" ? currentAt(a.m100_scales, a.m100_current, t) : null;
// Applicable competitor price at a quantity (highest competitor tier ≤ qty).
export const compAt = (tiers: Record<number, number> | undefined, qty: number): number | null => {
  if (!tiers) return null;
  let best: number | null = null, bestQ = -1;
  for (const k of Object.keys(tiers)) { const q = Number(k); if (q <= qty && q > bestQ && tiers[q] != null) { best = tiers[q]; bestQ = q; } }
  return best;
};

// Our list prices AND the ERP cost are quoted per STOCK unit (plates per kg, foils per m²,
// rods per m) — the sales unit ("Stk") is only the ordering unit, never the price basis.
export const basisUnit = (a: Article) => a.stock_unit || a.sales_unit || a.unit || "";

// A cost at or below this is a placeholder (VOSS fittings carry exactly 0.0001), not a price.
export const SENTINEL_COST = 0.001;
// A proposal this far from the current price is a cost/price basis mismatch, never a repricing.
export const OUT_LOW = -0.9, OUT_HIGH = 2.0;
/** Our proposal vs a competitor price in the same unit. A gap beyond 4× either way is never a
 *  real market gap — it is a price basis mismatch (our price per piece/plate against theirs per
 *  kg, e.g. POM-C ED plate 222 EUR "/kg" vs VINK 9.52 /kg = +2232%), so it is flagged, not shown. */
export function compGap(ours: number | null | undefined, theirs: number | null | undefined, converted: boolean | undefined): { d: number | null; basis: boolean } {
  if (!converted || ours == null || theirs == null || !theirs) return { d: null, basis: false };
  const d = (ours - theirs) / theirs;
  return d > 3 || d < -0.75 ? { d: null, basis: true } : { d, basis: false };
}

export type CostInfo = { raw: number | null; currency: string; eur: number | null; problem: string | null };
/** The cost used for the proposal, converted to EUR (BASIC and M110 are EUR, M100 builds on them). */
export function costInfo(a: Article, override: number | undefined, f: Factors): CostInfo {
  const raw = override ?? a.gwstdp;
  const currency = (a.gwstdp_currency || "EUR").toUpperCase();
  if (raw == null) return { raw: null, currency, eur: null, problem: "no GWStdP" };
  if (raw <= SENTINEL_COST) return { raw, currency, eur: null, problem: `placeholder cost ${raw}` };
  const rate = currency === "EUR" ? 1 : f.fx[currency];
  if (!rate) return { raw, currency, eur: null, problem: `cost in ${currency} — set the ${currency}→EUR rate` };
  return { raw, currency, eur: raw * rate, problem: null };
}

/** New price per system: BASIC (EUR, no country), M100 (CHF, ×country×currency), M110 (EUR, ×country). */
export function newPrice(costEur: number | null, corr: number, f: Factors, t: number, kind: Kind): number | null {
  if (costEur == null) return null;
  const country = kind === "basic" ? 1 : kind === "m100" ? f.country_m100 : f.country_m110;
  return costEur * corr * f.base * scaleFactor(f, t) * country * (kind === "m100" ? f.currency : 1);
}
/** Target margin of a price system at a quantity: 1 − 1/(corr × base × scale × country). */
export function marginOf(corr: number, f: Factors, t: number, kind: Kind) {
  const country = kind === "basic" ? 1 : kind === "m100" ? f.country_m100 : f.country_m110;
  return 1 - 1 / (corr * f.base * scaleFactor(f, t) * country);
}
export function implausible(proposal: number | null, cur: number | null): string | null {
  if (proposal == null || cur == null || cur === 0) return null;
  const d = (proposal - cur) / cur;
  return d < OUT_LOW ? `proposal ${(d * 100).toFixed(0)}% vs current — cost/price basis mismatch?`
    : d > OUT_HIGH ? `proposal +${(d * 100).toFixed(0)}% vs current — cost/price basis mismatch?` : null;
}
export const pctTxt = (v: number | null, dp = 1) => (v == null ? "—" : `${(v * 100).toFixed(dp)}%`);
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = iso.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : iso;
};
export const roundCents = (v: number) => Math.round(v * 100) / 100;

/** The selection as query params — the same names the backend list/refresh/export read. */
export type Sel = { search: string; pc: string; ass: string; mg: string; sg: string; pg: string; matched: boolean };
export function selParams(s: Sel): URLSearchParams {
  const p = new URLSearchParams();
  if (s.search) p.set("search", s.search); if (s.pc) p.set("profit_center", s.pc); if (s.ass) p.set("assortment", s.ass);
  if (s.mg) p.set("main_group", s.mg); if (s.sg) p.set("sub_group", s.sg); if (s.pg) p.set("product_group", s.pg);
  if (s.matched) p.set("matched", "1");
  return p;
}
export function selSummary(s: Sel): string {
  const parts: string[] = [];
  if (s.search) parts.push(`search "${s.search}"`);
  if (s.pc) parts.push(`profit center ${s.pc}`); if (s.ass) parts.push(`assortment ${s.ass}`);
  if (s.mg) parts.push(`main group ${s.mg}`); if (s.sg) parts.push(`sub group ${s.sg}`); if (s.pg) parts.push(`product group ${s.pg}`);
  if (s.matched) parts.push("matched only");
  return parts.length ? parts.join(" · ") : "all articles";
}

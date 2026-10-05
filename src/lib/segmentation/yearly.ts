// THE YEARLY RECLASSIFICATION - the January run, with no HubSpot in it.
//
// Ported from the May 2026 segment_companies.py ("run yearly, e.g. each January"):
// every company's APSO segment is decided again from scratch by a waterfall of
// rules, APIC and industry are made to agree, and - in the I/O around it - the
// sales priority is set exactly to the formula, up OR down.
//
// Differences from the script, on purpose:
//   - the years count from the run: the script's 2024..2026 is this year - 2 .. this year
//   - revenue is revenue_YYYY only; the legacy perfomis_YYYY tracks are not read
//   - APIC values are matched by their code ("1.1"), the portal's label is looked up
//   - the potential is READ, never written: people and the nightly recalculation own
//     it. The script's sanity caps and starter value still shape the number the
//     rules look at, exactly as before - they just stay in memory.
//   - the product-fit multiplier is the hub's one table (the one How it works shows)

import { apicMult, fnum, pyRound, type Enums, type Props } from "./engine";

/** ERP-owned segments - no engine ever changes them. */
export const ERP_SEGMENT = /^(ESO-Customer|DS Customer$|Growth Engine Customer$)/;

/** APIC code -> the HubSpot industry it means (all 74 codes of the May script). */
export const APIC_TO_INDUSTRY: Record<string, string> = {
  "1.1": "MACHINERY", "1.1.1": "CONSTRUCTION", "1.1.2": "FOOD_PRODUCTION", "1.1.3": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING",
  "1.1.4": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING", "1.1.5": "LOGISTICS_AND_SUPPLY_CHAIN", "1.1.6": "INDUSTRIAL_AUTOMATION",
  "1.1.7": "MINING_METALS", "1.1.8": "PACKAGING_AND_CONTAINERS", "1.1.9": "PRINTING", "1.1.10": "TEXTILES",
  "1.1.11": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING",
  "1.2": "CONSUMER_ELECTRONICS", "1.2.1": "CONSUMER_ELECTRONICS", "1.2.2": "CONSUMER_ELECTRONICS", "1.2.3": "MACHINERY", "1.2.4": "CONSUMER_ELECTRONICS",
  "1.3": "AUTOMOTIVE", "1.3.1": "AUTOMOTIVE", "1.3.2": "AUTOMOTIVE", "1.3.3": "FARMING",
  "1.4": "RAILROAD_MANUFACTURE", "1.4.1": "RAILROAD_MANUFACTURE", "1.4.2": "RAILROAD_MANUFACTURE", "1.4.3": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING",
  "1.5": "AVIATION_AEROSPACE", "1.6": "MARITIME",
  "1.7": "RENEWABLES_ENVIRONMENT", "1.7.1": "RENEWABLES_ENVIRONMENT", "1.7.2": "RENEWABLES_ENVIRONMENT", "1.7.3": "RENEWABLES_ENVIRONMENT",
  "1.7.4": "RENEWABLES_ENVIRONMENT", "1.7.5": "RENEWABLES_ENVIRONMENT", "1.7.6": "RENEWABLES_ENVIRONMENT",
  "1.8": "CONSTRUCTION", "1.8.1": "CIVIL_ENGINEERING", "1.8.2": "MINING_METALS", "1.8.3": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING",
  "1.8.4": "UTILITIES", "1.8.5": "BUILDING_MATERIALS",
  "1.9": "PHARMACEUTICALS", "1.9.1": "PHARMACEUTICALS", "1.9.2": "MEDICAL_DEVICES", "1.9.3": "PHARMACEUTICALS",
  "1.10": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING", "1.10.1": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING",
  "1.10.2": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING", "1.10.3": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING",
  "1.11": "CHEMICALS", "1.11.1": "CHEMICALS", "1.11.2": "CHEMICALS",
  "1.12": "ELECTRICAL_ELECTRONIC_MANUFACTURING", "1.12.1": "ELECTRICAL_ELECTRONIC_MANUFACTURING", "1.12.2": "ELECTRICAL_ELECTRONIC_MANUFACTURING",
  "1.12.3": "ELECTRICAL_ELECTRONIC_MANUFACTURING", "1.12.4": "INDUSTRIAL_AUTOMATION", "1.12.5": "SEMICONDUCTORS",
  "2": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING", "2.1": "FARMING", "2.2": "CHEMICALS", "2.3": "FOOD_PRODUCTION", "2.4": "HOSPITALITY",
  "2.5": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING", "2.6": "PHARMACEUTICALS", "2.7": "GOVERNMENT_ADMINISTRATION", "2.8": "RESEARCH",
  "2.9": "LUXURY_GOODS_JEWELRY",
  "3": "WHOLESALE", "3.1": "WHOLESALE", "3.2": "WHOLESALE", "3.3": "WHOLESALE",
  "4.1": "MECHANICAL_OR_INDUSTRIAL_ENGINEERING", "4.2": "LOGISTICS_AND_SUPPLY_CHAIN",
  "5.1": "CIVIL_ENGINEERING",
};

/** Industries that cannot be a machine builder: next to an OEM APIC (1.x) they are corrected. */
export const SUSPECT_INDUSTRIES_FOR_OEM = new Set([
  "LEGAL_SERVICES", "ACCOUNTING", "BANKING", "REAL_ESTATE", "EDUCATION_MANAGEMENT", "HIGHER_EDUCATION", "HOSPITALITY",
  "LEISURE_TRAVEL_TOURISM", "RESTAURANTS", "LAW_PRACTICE", "HUMAN_RESOURCES", "STAFFING_AND_RECRUITING", "INSURANCE",
  "INVESTMENT_MANAGEMENT", "MARKETING_AND_ADVERTISING", "ENTERTAINMENT", "MUSIC", "PERFORMING_ARTS", "SPORTS",
  "ARTS_AND_CRAFTS", "FINE_ART", "PHOTOGRAPHY", "WRITING_AND_EDITING",
]);

/**
 * Industry -> the APIC code it reveals, used when the APIC is the generic "1.1" or
 * empty. null = no APIC fits (law, banking, ...): a generic 1.1 next to it is cleared.
 */
export const INDUSTRY_TO_APIC: Record<string, string | null> = {
  HIGHER_EDUCATION: "2.8", EDUCATION_MANAGEMENT: "2.8", RESEARCH: "2.8",
  LEGAL_SERVICES: null, LAW_PRACTICE: null, ACCOUNTING: null, BANKING: null, REAL_ESTATE: null,
  HOSPITALITY: "2.4", RESTAURANTS: "2.4", LEISURE_TRAVEL_TOURISM: null, MANAGEMENT_CONSULTING: null,
  HUMAN_RESOURCES: null, STAFFING_AND_RECRUITING: null, INSURANCE: null, INVESTMENT_MANAGEMENT: null,
  MARKETING_AND_ADVERTISING: null, ENTERTAINMENT: null, GOVERNMENT_ADMINISTRATION: "2.7",
  PHARMACEUTICALS: "1.9", MEDICAL_DEVICES: "1.9.2", HOSPITAL_HEALTH_CARE: "1.9", BIOTECHNOLOGY: "1.9",
  CHEMICALS: "1.11", AUTOMOTIVE: "1.3", FOOD_PRODUCTION: "1.1.2", FOOD_BEVERAGES: "2.3",
  CONSUMER_ELECTRONICS: "1.12", PACKAGING_AND_CONTAINERS: "1.1.8", PRINTING: "1.1.9", TEXTILES: "1.1.10",
  RENEWABLES_ENVIRONMENT: "1.7", UTILITIES: "1.8.4", BUILDING_MATERIALS: "1.8", FARMING: "1.3.3",
  WHOLESALE: "3.3", RAILROAD_MANUFACTURE: "1.4", AVIATION_AEROSPACE: "1.5", MARITIME: "1.6",
  COMPUTER_SOFTWARE: "1.12.4", INFORMATION_TECHNOLOGY_AND_SERVICES: "1.12.4",
};

/** Reseller APIC codes are always right - never changed. */
export const APIC_NEVER_CHANGE = new Set(["3", "3.1", "3.2", "3.3"]);
export const GENERIC_APIC = "1.1";

/** The waterfall's rules, in the order they are tried - the page and the Excel name them by key. */
export const YEARLY_RULES: { key: string; segment: string; text: string }[] = [
  { key: "erp", segment: "unchanged", text: "ESO-Customer, DS Customer, Growth Engine Customer come from the ERP - left alone" },
  { key: "ghost", segment: "No sales focus", text: "Older than 24 months, no revenue, no shop or ticket activity, list price or no budget, 10 employees or fewer" },
  { key: "micro", segment: "APSOmicro", text: "1-5 employees, no revenue, no activity" },
  { key: "lost", segment: "APSOlost", text: "Bought before, but no revenue and no order intake in the last three years" },
  { key: "churned", segment: "APSOcore (APSOmicro if 1-5 employees)", text: "Ordered in the shop in earlier years, never an invoice, some order intake lately" },
  { key: "new", segment: "APSOprospect", text: "Younger than 12 months, no revenue yet" },
  { key: "growth", segment: "APSOgrowth", text: "Revenue ≥ 500 €, potential ≥ 5,000 €, potential more than 30 % and 3,000 € above revenue, sector known" },
  { key: "core", segment: "APSOcore", text: "Revenue ≥ 500 € - an established customer close to its potential" },
  { key: "budget", segment: "APSOcore", text: "Budget class Platinum or Gold, no revenue on record" },
  { key: "small", segment: "APSOmicro / APSOcore / APSOgrowth / APSOprospect", text: "Revenue under 500 €: micro if 1-5 employees, core if it stopped, growth if a big potential in a known sector, else prospect" },
  { key: "engaged_budget", segment: "APSOgrowth or APSOprospect", text: "No revenue, Silver or Bronze budget, active in the shop or tickets: growth with potential ≥ 5,000 € and a sector, else prospect" },
  { key: "engaged", segment: "APSOgrowth", text: "No revenue, active, potential ≥ 5,000 €, sector known" },
  { key: "dead", segment: "No sales focus", text: "Older than 24 months, no revenue, no activity" },
  { key: "default", segment: "APSOprospect", text: "Not enough data to say more" },
];

export type YearlyCtx = {
  /** The run's calendar year - "this year" in every rule. */
  year: number;
  /** Now, in ms - the company's age is counted from its createdate. */
  now: number;
  /** Tickets associated with the company (only "any" matters). */
  tickets: number;
};

export type Reclass = {
  /** The APSO segment the rules give; null = ERP-owned, left alone. */
  segment: string | null;
  rule: string;
  reason: string;
  /** New apic_ap (exact portal value); "" clears it; absent = unchanged. */
  apic?: string;
  /** New industry; absent = unchanged. */
  industry?: string;
  /** The potential the rules looked at (after the in-memory sanity caps) - never written. */
  potential: number;
};

const DT_RE = /^(orders|n_of_views|n_of_logins|total_value)_datatracker(?:_(\d{4}))?$/;
/** The shop's datatracker properties without a year suffix hold 2026 (see eshopActivity). */
export const DT_BASE_YEAR = 2026;

/** Which of the portal's company properties the yearly run reads, beyond the priority's own. */
export function yearlyReadProps(available: Set<string>, year: number, firstYear = 2015): string[] {
  const want = ["numberofemployees", "budget_class"];
  for (let y = firstYear; y <= year; y++) want.push(`oi_${y}`);
  const out = want.filter((p) => available.has(p));
  for (const p of available) if (DT_RE.test(p)) out.push(p);
  return out;
}

type Shop = { orders: number; views: number; logins: number; value: number };

/** The shop's activity per year, from whichever datatracker properties the company carries. */
export function shopByYear(p: Props): Map<number, Shop> {
  const out = new Map<number, Shop>();
  for (const [k, v] of Object.entries(p)) {
    const m = DT_RE.exec(k);
    if (!m) continue;
    const y = m[2] ? Number(m[2]) : DT_BASE_YEAR;
    const n = fnum(v);
    if (n === null || !Number.isFinite(n)) continue;
    const s = out.get(y) ?? { orders: 0, views: 0, logins: 0, value: 0 };
    if (m[1] === "orders") s.orders += n;
    else if (m[1] === "n_of_views") s.views += n;
    else if (m[1] === "n_of_logins") s.logins += n;
    else s.value += n;
    out.set(y, s);
  }
  return out;
}

const num0 = (v: unknown) => {
  const n = fnum(v);
  return n === null || !Number.isFinite(n) ? 0 : n;
};

/** One company through the waterfall: the segment it should carry, and the APIC / industry fixes. */
export function reclassify(p: Props, en: Enums, ctx: YearlyCtx, firstYear = 2015): Reclass {
  const Y = ctx.year;
  const current = (p.apso_customer ?? "").trim();
  const apic = (p.apic_ap ?? "").trim();
  const code = apic.split(" ")[0];
  const industry = (p.industry ?? "").trim();
  const out: Reclass = { segment: null, rule: "", reason: "", potential: num0(p.yearly_customer_potential) };
  const reasons: string[] = [];

  if (ERP_SEGMENT.test(current)) return { ...out, rule: "erp", reason: "ERP-managed value, left alone" };

  // ── APIC and industry made to agree ─────────────────────────────────
  const hasInd = (i: string | null | undefined): i is string => !!i && en.industry.has(i);
  if (APIC_NEVER_CHANGE.has(code)) {
    const want = APIC_TO_INDUSTRY[code];
    if (!industry && hasInd(want)) { out.industry = want; reasons.push(`industry from APIC ${code}`); }
  } else if (code === GENERIC_APIC && industry && industry in INDUSTRY_TO_APIC) {
    const to = INDUSTRY_TO_APIC[industry];
    if (to) {
      const v = en.apic[to];
      if (v && v !== apic) { out.apic = v; reasons.push(`APIC 1.1 -> ${to} (industry ${industry})`); }
    } else {
      out.apic = "";
      reasons.push(`APIC 1.1 cleared - wrong for ${industry}`);
    }
  } else if (code === GENERIC_APIC && industry) {
    // a machine builder with a plausible industry - both kept
  } else if (apic && code !== GENERIC_APIC && code in APIC_TO_INDUSTRY) {
    const want = APIC_TO_INDUSTRY[code];
    if (!industry) {
      if (hasInd(want)) { out.industry = want; reasons.push(`industry from APIC ${code}`); }
    } else if (SUSPECT_INDUSTRIES_FOR_OEM.has(industry) && code.startsWith("1.") && hasInd(want) && want !== industry) {
      out.industry = want;
      reasons.push(`industry ${industry} -> ${want} (APIC ${code})`);
    }
  } else if (!apic && industry && INDUSTRY_TO_APIC[industry]) {
    const v = en.apic[INDUSTRY_TO_APIC[industry]!];
    if (v) { out.apic = v; reasons.push(`APIC from industry ${industry}`); }
  }

  // ── revenue, order intake, the shop ─────────────────────────────────
  const rev = new Map<number, number>();
  const oi = new Map<number, number>();
  for (let y = firstYear; y <= Y; y++) {
    const r = num0(p[`revenue_${y}`]);
    if (r > 0) rev.set(y, r);
    const o = num0(p[`oi_${y}`]);
    if (o > 0) oi.set(y, o);
  }
  const shop = shopByYear(p);
  const years = [...rev.keys()].sort((a, b) => b - a);
  const best = years.length ? rev.get(years[0])! : 0; // the latest year with revenue
  const hasAny = best > 0;
  const hasRecent = rev.has(Y - 1) || rev.has(Y);
  let hasPast = false;
  for (let y = firstYear; y <= Y - 2; y++) if (rev.has(y)) hasPast = true;
  let hasPastShop = false;
  for (let y = Y - 5; y <= Y - 2; y++) if ((shop.get(y)?.value ?? 0) > 0) hasPastShop = true;
  const churned = (hasPast || hasPastShop) && !hasRecent;

  let orders = 0, views = 0, logins = 0;
  for (const s of shop.values()) { orders += s.orders; views += s.views; logins += s.logins; }
  const engaged = views > 0 || logins > 0 || orders > 0 || ctx.tickets > 0;

  let ageMonths = 999;
  const created = Date.parse(p.createdate ?? "");
  if (Number.isFinite(created)) ageMonths = (ctx.now - created) / 86_400_000 / 30.44;
  const employees = num0(p.numberofemployees);
  const budget = (p.budget_class ?? "").trim();
  const effApic = out.apic !== undefined ? out.apic : apic;
  const effIndustry = out.industry || industry;

  // ── the potential the rules look at (in memory only) ────────────────
  let pot = out.potential;
  if (pot > 400_000) pot = 400_000;
  if (best > 0 && pot > best * 10 && pot > 50_000) pot = pyRound(best * 5);
  const peak = rev.size ? Math.max(...rev.values()) : 0;
  if (peak > 500 && pot < peak) pot = pyRound(peak * 1.3);
  const signal = hasAny || engaged || ["Platinum", "Gold", "Silver", "Bronze"].includes(budget);
  if (pot === 0 && (effApic || effIndustry) && employees > 0 && signal) {
    const base = employees <= 10 ? 300 : employees <= 50 ? 1000 : employees <= 250 ? 4000 : employees <= 1000 ? 10_000 : 20_000;
    let calc = pyRound(base * (effApic ? apicMult(effApic) : 1.0));
    if (best > 0) calc = Math.max(calc, pyRound(best * 1.3));
    if (calc > 200_000 && best < 100_000) calc = 200_000;
    pot = calc;
  }
  out.potential = pot;
  const goodApic = !!effApic && effApic.split(" ")[0] !== GENERIC_APIC;
  const gap = pot > 0 ? pot - best : 0;
  const gapPct = pot > 0 ? ((pot - best) / pot) * 100 : 0;
  const decide = (segment: string, rule: string, why: string): Reclass => ({ ...out, segment, rule, reason: [why, ...reasons].join(" · ") });
  const r0 = (x: number) => Math.round(x).toLocaleString("en-US");

  // ── the waterfall ───────────────────────────────────────────────────
  if (ageMonths > 24 && !hasAny && !engaged && (budget === "List price" || budget === "") && employees <= 10) {
    return decide("No sales focus", "ghost", `${Math.round(ageMonths)} months old, no revenue, no activity, ${employees} employees`);
  }
  if (employees > 0 && employees <= 5 && !hasAny && !engaged) {
    return decide("APSOmicro", "micro", `${employees} employees, no revenue, no activity`);
  }
  let recentRevOi = false;
  for (let y = Y - 2; y <= Y; y++) if (rev.has(y) || oi.has(y)) recentRevOi = true;
  let priorRevOi = hasPastShop;
  let lastActive = 0;
  for (let y = firstYear; y <= Y - 3; y++) if (rev.has(y) || oi.has(y)) { priorRevOi = true; lastActive = y; }
  if (priorRevOi && !recentRevOi) {
    return decide("APSOlost", "lost", `no revenue or order intake ${Y - 2}-${Y}, last active ${lastActive || "in the shop only"}`);
  }
  if (churned && !hasAny) {
    // bought in the shop before, never on an invoice, and some order intake lately
    let lastShop = 0;
    for (const [y, s] of shop) if (s.value > 0 && y > lastShop) lastShop = y;
    return decide(employees > 0 && employees <= 5 ? "APSOmicro" : "APSOcore", "churned", `stopped buying - last active in the shop ${lastShop}`);
  }
  if (ageMonths < 12 && !hasAny) {
    return decide("APSOprospect", "new", `${Math.round(ageMonths)} months old, no revenue yet`);
  }
  if (best >= 500 && pot >= 5000 && gap > 3000 && gapPct > 30 && (goodApic || effIndustry)) {
    return decide("APSOgrowth", "growth", `revenue ${r0(best)} €, potential ${r0(pot)} € - ${Math.round(gapPct)} % room`);
  }
  if (best >= 500 && pot > 0) {
    return decide("APSOcore", "core", `revenue ${r0(best)} €, potential ${r0(pot)} €`);
  }
  if (best >= 500 && pot === 0) {
    return decide("APSOcore", "core", `revenue ${r0(best)} €, no potential`);
  }
  if (budget === "Platinum" || budget === "Gold") {
    return decide("APSOcore", "budget", `budget ${budget}, no revenue on record`);
  }
  if (best > 0 && best < 500) {
    if (employees > 0 && employees <= 5) return decide("APSOmicro", "small", `${employees} employees, revenue ${r0(best)} €`);
    if (churned) return decide("APSOcore", "small", `stopped buying, last revenue ${r0(best)} €`);
    if (pot >= 5000 && goodApic && gap > 3000) return decide("APSOgrowth", "small", `small buyer (${r0(best)} €), potential ${r0(pot)} €`);
    return decide("APSOprospect", "small", `revenue ${r0(best)} € only`);
  }
  if ((budget === "Silver" || budget === "Bronze") && engaged) {
    return pot >= 5000 && goodApic
      ? decide("APSOgrowth", "engaged_budget", `budget ${budget}, active, potential ${r0(pot)} €`)
      : decide("APSOprospect", "engaged_budget", `budget ${budget}, active, potential or sector missing`);
  }
  if (engaged && pot >= 5000 && goodApic) {
    return decide("APSOgrowth", "engaged", `active (views ${views}, orders ${orders}), potential ${r0(pot)} €`);
  }
  if (ageMonths > 24 && !hasAny && !engaged) {
    return decide("No sales focus", "dead", `${Math.round(ageMonths)} months old, no revenue, no activity`);
  }
  return decide("APSOprospect", "default", `not enough data (revenue ${r0(best)} €, potential ${r0(pot)} €)`);
}

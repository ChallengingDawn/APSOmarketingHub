// The 2026 agency KPI targets, transcribed from KPIs_SMEC_2026.xlsx
// (sheet "SMEC Targets", agreed with smec). Baselines are 2025 closes and
// SEA-attributed — the sheet's own reference for them is "acc. Google
// Analytics, SEA drove …", so the live figures are GA4 filtered to the
// Paid Search channel. `measure` names the live figure this hub can put
// beside the target; `unavailable` says where the number lives otherwise.

export type SmecMeasure =
  | "signups"
  | "newbuyers"
  | "cvr"
  | "revenue"
  | "active"
  | "reactivated"
  | "cpa"
  | "costPerNewCustomer"
  | "roas"
  | "none";

export type SmecTarget = {
  area: "Acquisition" | "Retention & Reactivation" | "Revenue";
  kpi: string;
  baseline: string;
  goal: string;
  goalValue?: number;
  measure: SmecMeasure;
  note?: string;
  unavailable?: string;
};

export const SMEC_YEAR = 2026;

export const SMEC_TARGETS: SmecTarget[] = [
  {
    area: "Acquisition",
    kpi: "New buying customers (SEA)",
    baseline: "397",
    goal: "460",
    goalValue: 460,
    measure: "newbuyers",
    note: "The sheet's own method: companies whose first Compass order fell this year × GA4's Paid Search share of transactions (2025: 1,653 × 24 % = 397).",
  },
  {
    area: "Acquisition",
    kpi: "Sign-ups (SEA)",
    baseline: "1,301",
    goal: "1,496",
    goalValue: 1496,
    measure: "signups",
    note: "GA4 sign_up key events, Paid Search channel.",
  },
  {
    area: "Acquisition",
    kpi: "CVR registration → purchase",
    baseline: "36% (2025 close)",
    goal: "40%+",
    measure: "cvr",
    note: "The real cohort: shop accounts opened this year that have since placed an order. Purchases ÷ sign-ups is not it — existing customers buy without registering.",
  },
  {
    area: "Acquisition",
    kpi: "CPA",
    baseline: "not tracked",
    goal: "Track · benchmark · establish",
    measure: "cpa",
    note: "Google Ads cost divided by Paid Search purchases. The cost comes from the Ads-to-GA4 link, so it no longer has to be asked for.",
  },
  {
    area: "Retention & Reactivation",
    kpi: "Active customers",
    baseline: "9,656 (Compass total)",
    goal: "Baseline + direction",
    measure: "active",
    note: "Companies with at least one order this year, counted from our own order history — whole business, as the baseline is. Not separable by channel: a company is a customer of the shop, not of a channel.",
  },
  {
    area: "Retention & Reactivation",
    kpi: "Reactivated customers",
    baseline: "1,176",
    goal: "Baseline + direction",
    measure: "reactivated",
    note: "Companies whose first order this year came after a gap of more than twelve months — the same rule the Google Ads tag sends with each purchase.",
  },
  {
    area: "Retention & Reactivation",
    kpi: "Cost per activation / reactivation",
    baseline: "not tracked",
    goal: "Track · benchmark · establish",
    measure: "costPerNewCustomer",
    note: "Ad spend divided by the new buying customers it is credited with. Reactivations cannot be split from spend yet — that needs the three bucket conversions in the Ads account.",
  },
  {
    area: "Revenue",
    kpi: "SEA revenue",
    baseline: "3.9 Mio",
    goal: "4.5 Mio",
    goalValue: 4_500_000,
    measure: "revenue",
    note: "GA4 purchase revenue attributed to the Paid Search channel, in the property's reporting currency.",
  },
  {
    area: "Revenue",
    kpi: "ROAS",
    baseline: "13",
    goal: "min 13 — push spend, accept lower",
    goalValue: 13,
    measure: "roas",
    note: "GA4 revenue from Google Ads sessions ÷ the cost those accounts report. Google Ads shows its own ROAS on its own attribution, so the two will not match to the decimal.",
  },
];

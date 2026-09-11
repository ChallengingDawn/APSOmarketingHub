// The 2026 agency KPI targets, transcribed from KPIs_SMEC_2026.xlsx
// (sheet "SMEC Targets", agreed with smec). Baselines are 2025 closes and
// SEA-attributed — the sheet's own reference for them is "acc. Google
// Analytics, SEA drove …", so the live figures are GA4 filtered to the
// Paid Search channel. `measure` names the live figure this hub can put
// beside the target; `unavailable` says where the number lives otherwise.

export type SmecMeasure = "signups" | "newbuyers" | "cvr" | "revenue" | "none";

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
    measure: "none",
    unavailable: "Needs Compass first-order dates joined to the Paid Search source. GA4's 'first-time purchasers' counts cookies, not customers (2,199 YTD) — not comparable to the 397 baseline, so it is not shown.",
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
    measure: "none",
    unavailable: "A registration→purchase cohort measure. Purchases ÷ sign-ups is not it (existing customers buy without registering — the ratio is ~9×), so nothing is shown until the cohort join exists.",
  },
  {
    area: "Acquisition",
    kpi: "CPA",
    baseline: "not tracked",
    goal: "Track · benchmark · establish",
    measure: "none",
    unavailable: "Cost lives in Google Ads — reported by smec; this hub has no Ads connection.",
  },
  {
    area: "Retention & Reactivation",
    kpi: "Active customers",
    baseline: "9,656 (Compass total)",
    goal: "Baseline + direction",
    measure: "none",
    unavailable: "Compass-side KPI; the SEA contribution is not separable yet.",
  },
  {
    area: "Retention & Reactivation",
    kpi: "Reactivated customers",
    baseline: "1,176",
    goal: "Baseline + direction",
    measure: "none",
    unavailable: "Tracked yearly from Compass reactivation lists.",
  },
  {
    area: "Retention & Reactivation",
    kpi: "Cost per activation / reactivation",
    baseline: "not tracked",
    goal: "Track · benchmark · establish",
    measure: "none",
    unavailable: "Needs Google Ads cost — smec side.",
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
    measure: "none",
    unavailable: "Revenue side is live above; spend lives in Google Ads, so ROAS is smec's number.",
  },
];

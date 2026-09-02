// The 2026 agency KPI targets, transcribed from KPIs_SMEC_2026.xlsx
// (sheet "SMEC Targets", agreed with smec). Baselines are 2025 closes.
// `measure` says which live figure this hub can honestly put beside the
// target today; `unavailable` says why the others cannot be, and where
// that number actually lives.

export type SmecMeasure = "signups" | "none";

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
    unavailable: "First-purchase attribution joins Compass orders with Google Ads clicks — not derivable from GA4/HubSpot alone yet.",
  },
  {
    area: "Acquisition",
    kpi: "Sign-ups",
    baseline: "1,301",
    goal: "1,496",
    goalValue: 1496,
    measure: "signups",
    note: "GA4 sign_up key events, Paid Search channel (the target is SEA-attributed).",
  },
  {
    area: "Acquisition",
    kpi: "CVR registration → purchase",
    baseline: "36% (2025 close)",
    goal: "40%+",
    measure: "none",
    unavailable: "Needs a registration→purchase cohort join; measured with smec at the deep-dive cadence, not live here yet.",
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
    kpi: "Webshop revenue",
    baseline: "3.9 Mio",
    goal: "4.5 Mio",
    measure: "none",
    unavailable: "Google Ads-attributed revenue is smec's reported number — GA4's site total is a different measure, so no figure is shown here.",
  },
  {
    area: "Revenue",
    kpi: "ROAS",
    baseline: "13",
    goal: "min 13 — push spend, accept lower",
    measure: "none",
    unavailable: "Both revenue and spend live in Google Ads — ROAS is smec's reported number.",
  },
];

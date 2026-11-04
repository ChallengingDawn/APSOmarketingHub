// THE ACTION PLAN'S KPIS - THE RULES, for the page, the tiles and the server alike (SARCLA 04.11.2026: "don't populate
// any KPI for now on each team's KPIs - they need to be promoted here with a defined target; then we should have a toggle
// Target complete | Still running | Late; the KPI inside is defined on the Advanced reporting action"). A KPI comes to the
// plan's KPIs tab only from its tile's Actions window in Advanced reporting, once a target is saved there, under a team.

import { reportPathOfPage } from "../auth/tree"; // relative: the unit tests compile this file

/** The plan's KPI teams, in the tab's order. */
export const PLAN_KPI_TEAMS = [
  { id: "digital-growth", name: "Digital Growth", slug: "marketing" },
  { id: "eso", name: "ESO", slug: "eso" },
  { id: "tsa", name: "TSA", slug: "tsa" },
  { id: "back-office", name: "Back-Office", slug: "back-office" },
  { id: "products", name: "Products", slug: "products" },
  { id: "website", name: "Website", slug: "website" },
] as const;
export type PlanKpiTeam = (typeof PLAN_KPI_TEAMS)[number]["id"];
export const isPlanKpiTeam = (x: unknown): x is PlanKpiTeam => PLAN_KPI_TEAMS.some((t) => t.id === x);

/** Where a KPI stands - set by hand on the KPIs tab. */
export const PLAN_KPI_STATUSES = [
  { id: "complete", label: "Target complete" },
  { id: "running", label: "Still running" },
  { id: "late", label: "Late" },
] as const;
export type PlanKpiStatus = (typeof PLAN_KPI_STATUSES)[number]["id"];
export const isPlanKpiStatus = (x: unknown): x is PlanKpiStatus => PLAN_KPI_STATUSES.some((s) => s.id === x);

/** The team a tile belongs to, from its page's key ("eso-figures", "bo-tickets", "reach") - Digital Growth's otherwise. */
export function teamOfPage(page: string | null | undefined): PlanKpiTeam {
  const p = reportPathOfPage(page) ?? "";
  if (p.startsWith("/reporting/eso-benchmark")) return "eso";
  if (p.startsWith("/reporting/tsa-benchmark")) return "tsa";
  if (p.startsWith("/reporting/back-office")) return "back-office";
  return "digital-growth";
}

/** A tile's view - its filters and months - as one string: a figure is refreshed only from the view it was promoted in. */
export function viewOf(t: { filters?: Record<string, string[]>; from?: string; to?: string }): string {
  const f = t.filters ?? {};
  const keys = Object.keys(f).filter((k) => (f[k] ?? []).length).sort();
  return JSON.stringify({ f: keys.map((k) => [k, [...f[k]].sort()]), from: t.from ?? "", to: t.to ?? "" });
}

/** A KPI on the plan: its tile, its team, what it showed when last drawn in its view, where it stands. */
export type PlanKpi = {
  key: string; page: string; team: PlanKpiTeam; title: string; href: string;
  /** the key its target is kept under (a chart's own, else the tile's) and how that target is typed */
  targetKey: string; unit: "eur" | "pct" | "n";
  /** the tile's line ("30,216 Jan-Sep, -28% vs last year") the last time it was drawn in its view, and when */
  summary: string; summaryAt: string;
  view: string; status: PlanKpiStatus; by: string; at: string;
};

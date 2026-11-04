// THE ACTION PLAN'S KPIS - KEPT (SARCLA 04.11.2026: "they need to be promoted here with a defined target; then a toggle
// Target complete | Still running | Late"). One row per KPI tile promoted from its Actions window in Advanced reporting: its
// team, its words as last drawn in the view it was promoted in, where it stands. Its target stays the tile's own
// (apsomh_kpi_tile_target, kpiActions.ts) - one target, typed in one place. A table of its own, created on first use.
// (apsomh_action_plan_kpis and apsomh_report_tiles, of rounds 33-36, stay unused.)

import { query } from "@/lib/db/client";
import { targets } from "./kpiActions";
import { isPlanKpiStatus, isPlanKpiTeam, type PlanKpi, type PlanKpiStatus, type PlanKpiTeam } from "./planKpiTeams";

const T = "apsomh_plan_kpi_promoted";

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!ready) {
    ready = query(`CREATE TABLE IF NOT EXISTS ${T} (
      key text PRIMARY KEY,
      page text NOT NULL,
      team text NOT NULL,
      title text NOT NULL,
      href text NOT NULL DEFAULT '',
      target_key text NOT NULL,
      unit text NOT NULL DEFAULT 'n',
      summary text NOT NULL DEFAULT '',
      summary_at timestamptz NOT NULL DEFAULT now(),
      view text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'running',
      by_name text NOT NULL DEFAULT '',
      at timestamptz NOT NULL DEFAULT now()
    )`).then(() => undefined).catch((e) => { ready = null; throw e; });
  }
  return ready;
}

type Row = { key: string; page: string; team: string; title: string; href: string; target_key: string; unit: string; summary: string; summary_at: unknown; view: string; status: string; by_name: string; at: unknown };
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d ?? ""));
const kpi = (r: Row): PlanKpi => ({
  key: r.key, page: r.page, team: isPlanKpiTeam(r.team) ? r.team : "digital-growth", title: r.title, href: r.href,
  targetKey: r.target_key, unit: r.unit === "eur" || r.unit === "pct" ? r.unit : "n",
  summary: r.summary, summaryAt: iso(r.summary_at), view: r.view,
  status: isPlanKpiStatus(r.status) ? r.status : "running", by: r.by_name, at: iso(r.at),
});

/** Every KPI on the plan, oldest first, with the targets they are measured against (key -> value). */
export async function planKpis(): Promise<{ kpis: PlanKpi[]; targets: Record<string, number> }> {
  await ensure();
  const [r, all] = await Promise.all([query<Row>(`SELECT * FROM ${T} ORDER BY at, key`), targets()]);
  const kpis = r.rows.map(kpi);
  const keys = new Set(kpis.map((k) => k.targetKey));
  return { kpis, targets: Object.fromEntries(Object.entries(all).filter(([k]) => keys.has(k))) };
}

/** A tile promoted to the plan - or moved to another team, its words and view taken again. Needs its target saved. */
export async function promoteKpi(k: Omit<PlanKpi, "status" | "by" | "at" | "summaryAt">, by: string): Promise<void> {
  await ensure();
  const t = await targets();
  if (t[k.targetKey] == null) throw new Error("save its target first - a KPI comes to the plan with a target");
  await query(
    `INSERT INTO ${T} (key, page, team, title, href, target_key, unit, summary, view, by_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (key) DO UPDATE SET page = EXCLUDED.page, team = EXCLUDED.team, title = EXCLUDED.title, href = EXCLUDED.href,
       target_key = EXCLUDED.target_key, unit = EXCLUDED.unit, summary = EXCLUDED.summary, summary_at = now(), view = EXCLUDED.view`,
    [k.key, k.page, k.team, k.title.slice(0, 200), k.href.slice(0, 600), k.targetKey, k.unit, k.summary.slice(0, 400), k.view.slice(0, 2000), by],
  );
}

/** Off the plan. */
export async function demoteKpi(key: string): Promise<void> {
  await ensure();
  await query(`DELETE FROM ${T} WHERE key = $1`, [key]);
}

/** Where it stands: Target complete, Still running or Late. */
export async function setKpiStatus(key: string, status: PlanKpiStatus): Promise<boolean> {
  await ensure();
  const r = await query<{ key: string }>(`UPDATE ${T} SET status = $2 WHERE key = $1 RETURNING key`, [key, status]);
  return r.rows.length > 0;
}

/** Its words as the tile drew them just now - only in the view it was promoted in, and only when they changed. */
export async function refreshKpiSummary(key: string, summary: string, view: string): Promise<boolean> {
  await ensure();
  const r = await query<{ key: string }>(
    `UPDATE ${T} SET summary = $2, summary_at = now() WHERE key = $1 AND view = $3 AND summary <> $2 RETURNING key`,
    [key, summary.slice(0, 400), view],
  );
  return r.rows.length > 0;
}

export type { PlanKpiTeam };

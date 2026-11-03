// THE KPIS AN ACTION OR A CATEGORY IS MEASURED BY (SARCLA 03.11.2026, planKpiRules.ts): picked from the library, each
// with its target and, for a report or a KPI the hub does not read, the figure typed with its date - in its tracking. And
// the AI's proposal: it reads the row and what is under it - an action's sub-actions, a category's actions - and picks
// from the library the KPIs that show whether they succeed.
import { query } from "@/lib/db/client";
import { claudeText, getAnthropic } from "@/lib/ai/claude";
import { logChange, planItems } from "./actionPlan";
import { planTasks } from "./kpiActions";
import { stageOf, type PlanItem } from "./actionPlanRules";
import { kpiLibrary, libraryTree, type LibNode } from "./planKpiRules";
import { recentTiles } from "./reportTiles";

/** Advanced reporting as a tree, the graphs its pages have drawn in it - what the plan's KPIs are picked from. */
export const libraryNow = async (): Promise<LibNode[]> => libraryTree(await recentTiles());

const T = "apsomh_action_plan_kpis";

export type PlanKpi = {
  id: number; item: number; key: string; label: string; href: string; unit: string;
  target: number | null;
  /** false where lower is better (cost, position, bounce) */
  goodUp: boolean;
  /** a figure typed - for what the hub does not read itself - and its day */
  current: number | null; currentAt: string | null;
  addedBy: string; addedAt: string;
};
type Row = { id: number; item_id: number; key: string; label: string; href: string; unit: string; target: number | null; good_up: boolean; current: number | null; current_at: string | null; added_by: string; added_at: unknown };
const kpi = (r: Row): PlanKpi => ({
  id: r.id, item: r.item_id, key: r.key, label: r.label, href: r.href, unit: r.unit, target: r.target, goodUp: r.good_up,
  current: r.current, currentAt: r.current_at, addedBy: r.added_by, addedAt: r.added_at instanceof Date ? r.added_at.toISOString() : String(r.added_at ?? ""),
});
const COLS = `id, item_id, key, label, href, unit, target, good_up, current, to_char(current_at, 'YYYY-MM-DD') AS current_at, added_by, added_at`;

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  ready ??= query(`CREATE TABLE IF NOT EXISTS ${T} (
      id serial PRIMARY KEY, item_id integer NOT NULL, key text NOT NULL, label text NOT NULL, href text NOT NULL DEFAULT '',
      unit text NOT NULL DEFAULT '', target double precision, good_up boolean NOT NULL DEFAULT true, current double precision,
      current_at date, added_by text NOT NULL DEFAULT '', added_at timestamptz NOT NULL DEFAULT now(), UNIQUE (item_id, key))`)
    .then(() => undefined, (e) => { ready = null; throw e; });
  return ready;
}

/** The KPIs of these rows, in the order they were picked. */
export async function kpisOf(itemIds: number[]): Promise<PlanKpi[]> {
  await ensure();
  if (!itemIds.length) return [];
  const r = await query<Row>(`SELECT ${COLS} FROM ${T} WHERE item_id = ANY($1::int[]) ORDER BY item_id, id`, [itemIds]);
  return r.rows.map(kpi);
}

/** Picked from the library: its name and address kept as they are now - a report removed later still says what it was. */
export async function addKpis(itemId: number, picks: { key: string; target?: number | null; goodUp?: boolean }[], by: string): Promise<number> {
  await ensure();
  const lib = new Map(kpiLibrary(await recentTiles()).map((x) => [x.key, x]));
  let n = 0;
  for (const p of picks) {
    const x = lib.get(p.key);
    if (!x) continue;
    const r = await query<{ id: number }>(`INSERT INTO ${T} (item_id, key, label, href, unit, target, good_up, added_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (item_id, key) DO NOTHING RETURNING id`, [itemId, x.key, x.name, x.href, x.unit, p.target ?? null, p.goodUp ?? true, by]);
    if (r.rows.length) { n++; await logChange(itemId, by, [{ field: "KPI", before: "", after: `${x.name}${p.target != null ? ` - target ${p.target}` : ""}` }]); }
  }
  return n;
}

const said = (v: number | null) => (v == null ? "" : String(v));
/** Its target, its direction, or the figure typed (today's, unless a day is given). */
export async function setKpi(id: number, p: { target?: number | null; goodUp?: boolean; current?: number | null }, by: string): Promise<PlanKpi | null> {
  await ensure();
  const was = (await query<Row>(`SELECT ${COLS} FROM ${T} WHERE id = $1`, [id])).rows[0];
  if (!was) return null;
  const sets: string[] = [], vals: unknown[] = [];
  const lines: { field: string; before: string; after: string }[] = [];
  if (p.target !== undefined) { vals.push(p.target); sets.push(`target = $${vals.length}`); lines.push({ field: `KPI target · ${was.label}`, before: said(was.target), after: said(p.target) }); }
  if (p.goodUp !== undefined) { vals.push(p.goodUp); sets.push(`good_up = $${vals.length}`); lines.push({ field: `KPI · ${was.label}`, before: was.good_up ? "higher is better" : "lower is better", after: p.goodUp ? "higher is better" : "lower is better" }); }
  if (p.current !== undefined) {
    vals.push(p.current); sets.push(`current = $${vals.length}`, `current_at = ${p.current == null ? "NULL" : "current_date"}`);
    lines.push({ field: `KPI value · ${was.label}`, before: said(was.current), after: said(p.current) });
  }
  if (!sets.length) return kpi(was);
  vals.push(id);
  const r = await query<Row>(`UPDATE ${T} SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING ${COLS}`, vals);
  await logChange(was.item_id, by, lines);
  return r.rows[0] ? kpi(r.rows[0]) : null;
}

export async function removeKpi(id: number, by: string): Promise<boolean> {
  await ensure();
  const r = await query<Row>(`DELETE FROM ${T} WHERE id = $1 RETURNING ${COLS}`, [id]);
  const was = r.rows[0];
  if (was) await logChange(was.item_id, by, [{ field: "KPI", before: was.label, after: "" }]);
  return !!was;
}

/* ── the AI's proposal ────────────────────────────────────────────────── */

export type KpiProposal = { key: string; name: string; path: string; target: number | null; goodUp: boolean; why: string };

const SYSTEM = `You choose how a row of APSOparts' action plan is measured. APSOparts sells technical parts online (seals, O-rings, hoses, plastics); its plan has main categories, sub-categories, actions and the actions' sub-actions. From the library - the reports and KPIs of the hub's Advanced reporting - pick the 2 to 5 that best show whether the row succeeds: what its sub-actions (or, for a category, its actions) will move.
- Prefer a KPI (kind "kpi") - it has a number the hub measures - then a graph of a page (kind "graph"), then a whole report page; the narrowest that fits.
- Never one already picked.
- target: the figure to reach by the row's go-live, in the KPI's unit (a rate as a fraction: 0.12 for 12 %), only when the row's words or the KPI's own catalogue target give a basis - otherwise null. No made-up figures.
- goodUp: false when lower is better (cost, position, bounce, time to answer, abandonment).
- why: one short sentence in English naming the sub-action(s) or action(s) it follows.`;

const oneLine = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

/** 2 to 5 KPIs for the row, from the library, aligned with what is under it - none when the AI is not set up. */
export async function proposeKpis(itemId: number): Promise<{ proposals: KpiProposal[]; note: string }> {
  const client = getAnthropic();
  if (!client) return { proposals: [], note: "The AI is not set up on this hub." };
  const [items, tasks, picked] = await Promise.all([planItems(), planTasks(), kpisOf([itemId])]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const row = byId.get(itemId);
  if (!row) return { proposals: [], note: "No such row." };
  const kids = (id: number) => items.filter((i) => i.parentId === id);
  const actionsUnder = (id: number): PlanItem[] => kids(id).flatMap((k) => (k.kind === "action" ? [k] : actionsUnder(k.id)));
  const subsOf = (id: number) => tasks.filter((t) => t.planItem === id);
  const subLines = (a: PlanItem) => subsOf(a.id).slice(0, 20).map((s) => `    - sub-action: ${oneLine(s.title, 140)}${s.note ? ` - ${oneLine(s.note, 220)}` : ""}${stageOf(s.stage) ? ` [${stageOf(s.stage)!.label}]` : ""}`);
  const path: string[] = [];
  for (let p = row.parentId != null ? byId.get(row.parentId) : undefined; p && path.length < 6; p = p.parentId != null ? byId.get(p.parentId) : undefined) if (p.kind !== "goal") path.unshift(p.title);
  const about = row.kind === "action"
    ? [`Action: ${oneLine(row.title, 200)}`, row.detail && row.detail !== row.title ? `Description: ${oneLine(row.detail, 900)}` : "", path.length ? `In: ${path.join(" > ")}` : "",
      row.start || row.due ? `Planned ${row.start ?? "?"}, go-live ${row.due ?? "?"}` : "", "Its sub-actions:", ...subLines(row)].filter(Boolean)
    : [`${row.kind === "topic" ? "Main category" : row.kind === "group" ? "Sub-category" : "The goal"}: ${oneLine(row.title, 200)}`, path.length ? `In: ${path.join(" > ")}` : "",
      "Its actions:", ...actionsUnder(row.id).slice(0, 40).flatMap((a) => [`  - action: ${oneLine(a.title, 160)}`, ...subLines(a).slice(0, 6)])].filter(Boolean);
  const lib = kpiLibrary(await recentTiles()).filter((x) => !picked.some((p) => p.key === x.key));
  const listing = lib.map((x) => `- ${x.key} | ${x.kind} | ${oneLine(x.name, 90)} | ${x.path}${x.unit ? ` | unit: ${x.unit}` : ""}${x.definition ? ` | ${oneLine(x.definition, 140)}` : ""}${x.target ? ` | catalogue target: ${oneLine(x.target, 60)}` : ""}`);
  const schema = {
    type: "object", additionalProperties: false, required: ["kpis"],
    properties: { kpis: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "target", "goodUp", "why"], properties: {
      key: { type: "string", enum: lib.map((x) => x.key) }, target: { type: ["number", "null"] }, goodUp: { type: "boolean" }, why: { type: "string" },
    } } } },
  };
  const user = `${about.join("\n")}${picked.length ? `\n\nAlready picked: ${picked.map((p) => p.label).join("; ")}` : ""}\n\nThe library:\n${listing.join("\n")}`;
  const r = await claudeText({ client, system: [{ type: "text", text: SYSTEM }], user, budget: { maxTokens: 3000, effort: "low" }, outputFormat: { type: "json_schema", schema } });
  if (!r.ok) return { proposals: [], note: "The AI did not answer - try again." };
  let got: { key: string; target: number | null; goodUp: boolean; why: string }[] = [];
  try { got = (JSON.parse(r.text) as { kpis: typeof got }).kpis ?? []; } catch { got = []; }
  const byKey = new Map(lib.map((x) => [x.key, x]));
  const seen = new Set<string>();
  const proposals = got.filter((g) => byKey.has(g.key) && !seen.has(g.key) && seen.add(g.key)).slice(0, 5).map((g) => {
    const x = byKey.get(g.key)!;
    return { key: x.key, name: x.name, path: x.path, target: typeof g.target === "number" && Number.isFinite(g.target) ? g.target : null, goodUp: g.goodUp !== false, why: oneLine(g.why, 300) };
  });
  return { proposals, note: proposals.length ? "" : "Nothing in the library fits these words." };
}

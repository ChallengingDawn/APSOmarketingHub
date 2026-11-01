// THE ACTION PLAN, KEPT IN THE HUB (SARCLA 31.10.2026: "APSOparts Business Improvement Action Plan - I need
// to create a Gantt here ... per topic, main topic, drill down and drag and drop to switch categories").
// One table, filled once from the workbook's first tab (src/data/actionPlanSeed.json, the budget columns left
// out) and changed here from then on: dates, % complete, status, who, where a row sits. The rows' rules are
// in actionPlanRules.ts; the sub-actions are KPI tasks (kpiActions.ts, tile "plan:<id>").
// The seed is read from disk, not bundled: it is real company data, so the sandbox snapshot leaves it out
// (scripts/sandbox-snapshot.mjs) and a copy without it simply starts with an empty plan.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db/client";
import {
  PLAN_STATES, ownersFromCodes, percentOf, planFromSeed, reorder, stateOfPercent,
  type PlanFields, type PlanItem, type PlanKind, type PlanOwner, type PlanState, type SeedRow,
} from "./actionPlanRules";

const T = "apsomh_action_plan";

type Row = {
  id: number; parent_id: number | null; kind: string; code: string; sort: number; src: number | null;
  title: string; detail: string; priority: string; responsible: string; referent: string; status: string; state: string | null;
  result: string; main_topic: string; perimeter: string; expected: string; code_freeze: string; complexity: string; release: string;
  start_date: unknown; due_date: unknown; due_note: string; percent: number | null; dg: boolean; updated_by: string; updated_at: unknown;
  owners: unknown; matched: boolean;
};
const ownersOf = (x: unknown): PlanOwner[] => {
  const v = typeof x === "string" ? (() => { try { return JSON.parse(x); } catch { return []; } })() : x;
  return Array.isArray(v) ? v.filter((o) => o && typeof o.id === "string" && typeof o.name === "string").map((o) => ({ id: o.id, name: o.name })) : [];
};

const day = (d: unknown) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : d == null ? null : String(d).slice(0, 10));
const KINDS: readonly string[] = ["goal", "topic", "group", "action"];
const item = (r: Row): PlanItem => ({
  id: r.id, parentId: r.parent_id, kind: (KINDS.includes(r.kind) ? r.kind : "action") as PlanKind, code: r.code, sort: r.sort, src: r.src,
  title: r.title, detail: r.detail, priority: r.priority, responsible: r.responsible, referent: r.referent, status: r.status,
  state: r.state && (PLAN_STATES as readonly string[]).includes(r.state) ? (r.state as PlanState) : null,
  result: r.result, mainTopic: r.main_topic, perimeter: r.perimeter, expected: r.expected, codeFreeze: r.code_freeze,
  complexity: r.complexity, release: r.release, start: day(r.start_date), due: day(r.due_date), dueNote: r.due_note,
  percent: r.percent, dg: r.dg, owners: ownersOf(r.owners),
  updatedBy: r.updated_by, updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ""),
});

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS ${T} (
        id serial PRIMARY KEY,
        parent_id integer,
        kind text NOT NULL,
        code text NOT NULL DEFAULT '',
        sort integer NOT NULL DEFAULT 0,
        src integer UNIQUE,
        title text NOT NULL,
        detail text NOT NULL DEFAULT '',
        priority text NOT NULL DEFAULT '',
        responsible text NOT NULL DEFAULT '',
        referent text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT '',
        state text,
        result text NOT NULL DEFAULT '',
        main_topic text NOT NULL DEFAULT '',
        perimeter text NOT NULL DEFAULT '',
        expected text NOT NULL DEFAULT '',
        code_freeze text NOT NULL DEFAULT '',
        complexity text NOT NULL DEFAULT '',
        release text NOT NULL DEFAULT '',
        start_date date,
        due_date date,
        due_note text NOT NULL DEFAULT '',
        percent integer,
        dg boolean NOT NULL DEFAULT false,
        updated_by text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await query(`CREATE INDEX IF NOT EXISTS ${T}_parent ON ${T} (parent_id)`);
      // who does it, as people (SARCLA 01.11.2026); `matched` = the workbook's codes were read as people once
      await query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS owners jsonb NOT NULL DEFAULT '[]'::jsonb`);
      await query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS matched boolean NOT NULL DEFAULT false`);
      const n = await query<{ n: string }>(`SELECT count(*)::text AS n FROM ${T}`);
      if (Number(n.rows[0]?.n ?? 0) === 0) await seed();
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

/**
 * The workbook's rows, once, into an empty table. Two copies of the hub starting together may both try:
 * the rows are keyed by their workbook row (src), so the second adds nothing, and the parents are set
 * only where none is yet.
 */
async function seed(): Promise<void> {
  let rows: SeedRow[];
  try {
    rows = JSON.parse(await readFile(path.join(process.cwd(), "src", "data", "actionPlanSeed.json"), "utf8")) as SeedRow[];
  } catch {
    console.log("[action-plan] no workbook seed here - the plan starts empty");
    return;
  }
  const plan = planFromSeed(rows);
  const records = plan.map((p) => ({
    src: p.src, kind: p.kind, code: p.code, sort: p.sort, title: p.title, detail: p.detail, priority: p.priority,
    responsible: p.responsible, referent: p.referent, status: p.status, state: p.state, result: p.result,
    main_topic: p.mainTopic, perimeter: p.perimeter, expected: p.expected, code_freeze: p.codeFreeze,
    complexity: p.complexity, release: p.release, due_date: p.due, due_note: p.dueNote, percent: p.percent, dg: p.dg,
  }));
  await query(
    `INSERT INTO ${T} (src, kind, code, sort, title, detail, priority, responsible, referent, status, state, result, main_topic,
       perimeter, expected, code_freeze, complexity, release, due_date, due_note, percent, dg, updated_by)
     SELECT src, kind, code, sort, title, detail, priority, responsible, referent, status, state, result, main_topic,
       perimeter, expected, code_freeze, complexity, release, due_date, due_note, percent, dg, 'the workbook'
       FROM jsonb_to_recordset($1::jsonb) AS x(src int, kind text, code text, sort int, title text, detail text, priority text,
         responsible text, referent text, status text, state text, result text, main_topic text, perimeter text, expected text,
         code_freeze text, complexity text, release text, due_date date, due_note text, percent int, dg boolean)
     ON CONFLICT (src) DO NOTHING`,
    [JSON.stringify(records)],
  );
  const links = plan.filter((p) => p.parentSrc != null);
  await query(
    `UPDATE ${T} t SET parent_id = p.id
       FROM unnest($1::int[], $2::int[]) AS x(src, psrc) JOIN ${T} p ON p.src = x.psrc
      WHERE t.src = x.src AND t.parent_id IS NULL`,
    [links.map((p) => p.src), links.map((p) => p.parentSrc)],
  );
  console.log(`[action-plan] ${plan.length} rows of the workbook loaded`);
}

export async function planItems(): Promise<PlanItem[]> {
  await ensure();
  const r = await query<Row>(`SELECT * FROM ${T} ORDER BY sort, id`);
  return r.rows.map(item);
}

/**
 * The workbook's "Responsible of action" read as people, once per row: a code exactly one HubSpot user answers to
 * becomes that person (actionPlanRules.ownersFromCodes); the rest waits for someone to pick. A row someone already
 * gave people to, or cleared, is never read again. Returns how many rows got somebody.
 */
export async function matchOwnersOnce(people: PlanOwner[]): Promise<number> {
  await ensure();
  const r = await query<{ id: number; responsible: string; kind: string }>(`SELECT id, responsible, kind FROM ${T} WHERE NOT matched`);
  if (!r.rows.length) return 0;
  const found = r.rows.map((x) => ({ id: x.id, owners: x.kind === "action" ? ownersFromCodes(x.responsible, people) : [] }));
  await query(
    `UPDATE ${T} t SET owners = x.owners, matched = true
       FROM jsonb_to_recordset($1::jsonb) AS x(id int, owners jsonb)
      WHERE t.id = x.id AND NOT t.matched`,
    [JSON.stringify(found)],
  );
  const n = found.filter((f) => f.owners.length).length;
  console.log(`[action-plan] the workbook's codes read as people: ${n} of ${found.length} rows got somebody`);
  return n;
}

export async function itemById(id: number): Promise<PlanItem | null> {
  await ensure();
  const r = await query<Row>(`SELECT * FROM ${T} WHERE id = $1`, [id]);
  return r.rows[0] ? item(r.rows[0]) : null;
}

const TEXT: [keyof PlanFields, string, number][] = [
  ["title", "title", 300], ["detail", "detail", 8000], ["priority", "priority", 60], ["responsible", "responsible", 200],
  ["referent", "referent", 200], ["status", "status", 4000], ["result", "result", 4000], ["mainTopic", "main_topic", 120],
  ["perimeter", "perimeter", 120], ["expected", "expected", 2000], ["codeFreeze", "code_freeze", 200],
  ["complexity", "complexity", 60], ["release", "release", 120], ["dueNote", "due_note", 200],
];

/**
 * Only the fields given change. % complete and the state follow each other the way Planner does: 100 % is
 * done, 0 % not started, anything between in progress - and choosing a state sets its percentage, except
 * "in progress" keeps one already typed.
 */
export async function updateItem(id: number, p: Partial<PlanFields>, by: string): Promise<PlanItem | null> {
  await ensure();
  const before = await itemById(id);
  if (!before) return null;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  for (const [key, col, max] of TEXT) {
    const v = p[key];
    if (typeof v === "string") set(col, key === "title" ? v.trim().slice(0, max) || before.title : v.slice(0, max));
  }
  if (p.owners !== undefined) {
    vals.push(JSON.stringify(p.owners.slice(0, 20)));
    sets.push(`owners = $${vals.length}::jsonb`, "matched = true");
  }
  if (p.start !== undefined) set("start_date", p.start || null);
  if (p.due !== undefined) set("due_date", p.due || null);
  if (p.dg !== undefined) set("dg", !!p.dg);
  if (p.percent !== undefined && p.percent !== null) {
    const pc = Math.max(0, Math.min(100, Math.round(p.percent)));
    set("percent", pc);
    if (p.state === undefined) set("state", stateOfPercent(pc, before.state));
  } else if (p.percent === null) set("percent", null);
  if (p.state !== undefined) {
    set("state", p.state);
    if (p.percent === undefined) {
      const keep = p.state === "doing" && before.percent != null && before.percent > 0 && before.percent < 100;
      if (!keep) set("percent", percentOf(p.state));
    }
  }
  if (!sets.length) return before;
  set("updated_by", by);
  vals.push(id);
  const r = await query<Row>(`UPDATE ${T} SET ${sets.join(", ")}, updated_at = now() WHERE id = $${vals.length} RETURNING *`, vals);
  return r.rows[0] ? item(r.rows[0]) : null;
}

/** A new row, last under its parent: an action under a topic or group, a group under a topic, a topic under the goal. */
export async function addItem(a: { parentId: number; kind: PlanKind; title: string; by: string }): Promise<PlanItem> {
  await ensure();
  const parent = await itemById(a.parentId);
  if (!parent) throw new Error("no such row to add under");
  const ok: Record<PlanKind, PlanKind[]> = { goal: ["topic"], topic: ["group", "action"], group: ["action"], action: [] };
  if (!ok[parent.kind].includes(a.kind)) throw new Error(`a ${a.kind} cannot go under a ${parent.kind}`);
  const r = await query<Row>(
    `INSERT INTO ${T} (parent_id, kind, code, sort, title, dg, updated_by)
     VALUES ($1, $2, '', (SELECT COALESCE(max(sort), 0) + 1 FROM ${T}), $3, $4, $5) RETURNING *`,
    [parent.id, a.kind, a.title.trim().slice(0, 300), false, a.by],
  );
  // last among its siblings
  await query(`UPDATE ${T} SET sort = (SELECT COALESCE(max(sort), 0) + 1 FROM ${T} WHERE parent_id = $1 AND id <> $2) WHERE id = $2`, [parent.id, r.rows[0].id]);
  return (await itemById(r.rows[0].id))!;
}

/** A row and everything under it, ids only - what a delete takes away. */
export async function subtree(id: number): Promise<number[]> {
  await ensure();
  const r = await query<{ id: number }>(
    `WITH RECURSIVE s AS (SELECT id FROM ${T} WHERE id = $1 UNION ALL SELECT t.id FROM ${T} t JOIN s ON t.parent_id = s.id) SELECT id FROM s`,
    [id],
  );
  return r.rows.map((x) => x.id);
}

export async function deleteItems(ids: number[]): Promise<void> {
  await ensure();
  if (ids.length) await query(`DELETE FROM ${T} WHERE id = ANY($1::int[])`, [ids]);
}

/** A dragged row dropped on another (actionPlanRules.reorder decides whether it may land there). */
export async function moveItem(dragId: number, targetId: number, where: "into" | "before", by: string): Promise<boolean> {
  const items = await planItems();
  const m = reorder(items, dragId, targetId, where);
  if (!m) return false;
  await query(`UPDATE ${T} SET parent_id = $1, updated_by = $2, updated_at = now() WHERE id = $3`, [m.parentId, by, dragId]);
  await query(
    `UPDATE ${T} t SET sort = x.ord FROM unnest($1::int[]) WITH ORDINALITY AS x(id, ord) WHERE t.id = x.id`,
    [m.order],
  );
  return true;
}

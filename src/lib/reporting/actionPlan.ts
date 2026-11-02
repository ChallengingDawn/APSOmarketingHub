// THE ACTION PLAN, KEPT IN THE HUB (SARCLA 31.10.2026: "APSOparts Business Improvement Action Plan - I need
// to create a Gantt here ... per topic, main topic, drill down and drag and drop to switch categories").
// One table, filled once from the workbook's first tab (src/data/actionPlanSeed.json, the budget columns left
// out) and changed here from then on: dates, % complete, stage, who, where a row sits - in the "From Scroll to
// Sale" ticket's terms since 01.11.2026 (toS2s moves the workbook's words over once). Every change is written to
// a log, the action's tracking. The rows' rules are in actionPlanRules.ts; the sub-actions are KPI tasks
// (kpiActions.ts, tile "plan:<id>").
// The seed is read from disk, not bundled: it is real company data, so the sandbox snapshot leaves it out
// (scripts/sandbox-snapshot.mjs) and a copy without it simply starts with an empty plan.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db/client";
import {
  IDEA, IN_PROGRESS, PLAN_STATES, STAGES, ownersFromCodes, percentOfStage, planFromSeed, priorityLabel, reorder, stageOf, stageOfPercent, stateOfStage, toS2s,
  type PlanFields, type PlanItem, type PlanKind, type PlanOwner, type PlanState, type SeedRow,
} from "./actionPlanRules";
import { addTask, deleteTask, movePlanItem, moveTask, shareTickets, taskById, ticketsToAction, type KpiTask } from "./kpiActions";

/** An action's description as its sub-action's: without its name repeated on the first line, the workbook's indents out
 *  (SARCLA 02.11.2026: "the text feels weird"). */
export const subText = (title: string, detail: string): string => {
  let d = (detail ?? "").replace(/\r\n/g, "\n");
  if (d.trim().startsWith(title.trim())) d = d.trim().slice(title.trim().length);
  return d.split("\n").map((l) => l.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const T = "apsomh_action_plan";
const LOG = "apsomh_action_plan_log";

type Row = {
  id: number; parent_id: number | null; kind: string; code: string; sort: number; src: number | null;
  title: string; detail: string; priority: string; responsible: string; referent: string; status: string; state: string | null;
  result: string; main_topic: string; perimeter: string; expected: string; code_freeze: string; complexity: string; release: string;
  start_date: unknown; due_date: unknown; due_note: string; percent: number | null; dg: boolean; updated_by: string; updated_at: unknown;
  owners: unknown; matched: boolean;
  stage: string | null; channel: unknown; country: unknown; agency: unknown; roadmap_year: string;
  kpis: string; next_steps: string; status_note: string; s2s: boolean;
};
const list = (x: unknown): string[] => {
  const v = typeof x === "string" ? (() => { try { return JSON.parse(x); } catch { return []; } })() : x;
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
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
  stage: stageOf(r.stage) ? r.stage : null, channel: list(r.channel), country: list(r.country), agency: list(r.agency),
  roadmapYear: r.roadmap_year ?? "", kpis: r.kpis ?? "", nextSteps: r.next_steps ?? "", statusNote: r.status_note ?? "",
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
      // the "From Scroll to Sale" ticket's fields (SARCLA 01.11.2026); `s2s` = the workbook's words moved over once
      for (const c of [
        "stage text", "channel jsonb NOT NULL DEFAULT '[]'::jsonb", "country jsonb NOT NULL DEFAULT '[]'::jsonb",
        "agency jsonb NOT NULL DEFAULT '[]'::jsonb", "roadmap_year text NOT NULL DEFAULT ''", "kpis text NOT NULL DEFAULT ''",
        // report_link: kept, no longer read or shown (SARCLA 02.11.2026: "report link - take out completely")
        "next_steps text NOT NULL DEFAULT ''", "status_note text NOT NULL DEFAULT ''", "report_link text NOT NULL DEFAULT ''",
        "s2s boolean NOT NULL DEFAULT false",
        // `year_set` = the roadmap year taken from the dates once; `ticket_sync_at` = the action and its ticket last agreed
        "year_set boolean NOT NULL DEFAULT false", "ticket_sync_at timestamptz",
      ]) await query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS ${c}`);
      // the tracking: every change, who made it and when
      await query(`CREATE TABLE IF NOT EXISTS ${LOG} (
        id serial PRIMARY KEY, item_id integer NOT NULL, at timestamptz NOT NULL DEFAULT now(), by_name text NOT NULL DEFAULT '',
        field text NOT NULL, before text NOT NULL DEFAULT '', after text NOT NULL DEFAULT '')`);
      await query(`CREATE INDEX IF NOT EXISTS ${LOG}_item ON ${LOG} (item_id, at DESC)`);
      const n = await query<{ n: string }>(`SELECT count(*)::text AS n FROM ${T}`);
      if (Number(n.rows[0]?.n ?? 0) === 0) await seed();
      await toTicketTerms();
      // an action with a date and no roadmap year takes its date's year, once (SARCLA 02.11.2026: "show stuff like the year
      // we can define"); emptied afterwards, it stays empty
      await query(`UPDATE ${T} SET roadmap_year = CASE WHEN kind = 'action' AND roadmap_year = '' AND COALESCE(start_date, due_date) IS NOT NULL
                     THEN to_char(COALESCE(start_date, due_date), 'YYYY') ELSE roadmap_year END, year_set = true WHERE NOT year_set`);
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

/** The workbook's words in the ticket's fields, once per row (actionPlanRules.toS2s); two copies starting together write the same. */
async function toTicketTerms(): Promise<void> {
  const r = await query<Row>(`SELECT * FROM ${T} WHERE NOT s2s`);
  if (!r.rows.length) return;
  const moved = r.rows.map((row) => {
    const it = item(row);
    const s = toS2s(it);
    return { id: it.id, stage: it.kind === "action" ? s.stage : null, priority: it.kind === "action" ? s.priority : it.priority,
      status_note: s.statusNote, kpis: s.kpis, channel: s.channel, state: it.kind === "action" ? stateOfStage(s.stage) : null };
  });
  await query(
    `UPDATE ${T} t SET stage = x.stage, priority = x.priority, status_note = x.status_note, kpis = x.kpis, channel = x.channel,
            state = x.state, s2s = true
       FROM jsonb_to_recordset($1::jsonb) AS x(id int, stage text, priority text, status_note text, kpis text, channel jsonb, state text)
      WHERE t.id = x.id AND NOT t.s2s`,
    [JSON.stringify(moved)],
  );
  console.log(`[action-plan] ${moved.length} rows put in the Scroll to Sale ticket's terms`);
}

/** One line of an action's tracking. */
export type PlanLogLine = { at: string; by: string; field: string; before: string; after: string };

async function log(itemId: number, by: string, lines: { field: string; before: string; after: string }[]): Promise<void> {
  const real = lines.filter((l) => l.before !== l.after);
  if (!real.length) return;
  await query(
    `INSERT INTO ${LOG} (item_id, by_name, field, before, after) SELECT $1, $2, x.field, x.before, x.after
       FROM jsonb_to_recordset($3::jsonb) AS x(field text, before text, after text)`,
    [itemId, by, JSON.stringify(real.map((l) => ({ field: l.field, before: l.before.slice(0, 600), after: l.after.slice(0, 600) })))],
  );
}

/** An action's tracking, newest first. */
export async function planLog(itemId: number, limit = 200): Promise<PlanLogLine[]> {
  await ensure();
  const r = await query<{ at: unknown; by_name: string; field: string; before: string; after: string }>(
    `SELECT at, by_name, field, before, after FROM ${LOG} WHERE item_id = $1 ORDER BY at DESC, id DESC LIMIT $2`, [itemId, limit]);
  return r.rows.map((x) => ({ at: x.at instanceof Date ? x.at.toISOString() : String(x.at), by: x.by_name, field: x.field, before: x.before, after: x.after }));
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
  ["roadmapYear", "roadmap_year", 10], ["kpis", "kpis", 4000], ["nextSteps", "next_steps", 4000],
  ["statusNote", "status_note", 4000],
];
const LISTS: [keyof PlanFields, string][] = [["channel", "channel"], ["country", "country"], ["agency", "agency"]];

/** What the tracking calls a field, and how it writes a value. */
const FIELD_NAME: Partial<Record<keyof PlanFields, string>> = {
  title: "Name", detail: "Description", priority: "Priority", referent: "Referent", stage: "Status", owners: "Assigned to",
  start: "Planned date", due: "Go-live date", percent: "% complete", dg: "Led by Digital Growth", channel: "Marketing channel",
  country: "Implementation country", agency: "Agency", roadmapYear: "Roadmap year", kpis: "KPIs", nextSteps: "Next steps / milestones",
  statusNote: "Status note", dueNote: "Deadline words", responsible: "Responsible (workbook)",
};
function shown(k: keyof PlanFields, v: unknown): string {
  if (v == null || v === "") return "";
  if (k === "stage") return stageOf(String(v))?.label ?? String(v);
  if (k === "priority") return priorityLabel(String(v)) || String(v);
  if (k === "owners") return (v as PlanOwner[]).map((o) => o.name).join(", ");
  if (k === "percent") return `${v} %`;
  if (k === "dg") return v ? "yes" : "no";
  if ((k === "start" || k === "due") && typeof v === "string") return v.split("-").reverse().join(".");
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/**
 * Only the fields given change. % complete and the stage follow each other: choosing a stage sets its
 * percentage (an open stage keeps one already typed between 1 and 99), typing a percentage moves the stage
 * (actionPlanRules.stageOfPercent). The old state column follows the stage, so a rolled-back hub still reads it.
 * Every change goes to the log.
 */
export async function updateItem(id: number, p: Partial<PlanFields>, by: string): Promise<PlanItem | null> {
  await ensure();
  const before = await itemById(id);
  if (!before) return null;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown, cast = "") => { vals.push(v); sets.push(`${col} = $${vals.length}${cast}`); };
  for (const [key, col, max] of TEXT) {
    const v = p[key];
    if (typeof v === "string") set(col, key === "title" ? v.trim().slice(0, max) || before.title : v.slice(0, max));
  }
  for (const [key, col] of LISTS) {
    const v = p[key];
    if (Array.isArray(v)) set(col, JSON.stringify([...new Set(v.map((x) => String(x).slice(0, 80)))].slice(0, 30)), "::jsonb");
  }
  if (p.owners !== undefined) {
    vals.push(JSON.stringify(p.owners.slice(0, 20)));
    sets.push(`owners = $${vals.length}::jsonb`, "matched = true");
  }
  if (p.start !== undefined) set("start_date", p.start || null);
  if (p.due !== undefined) set("due_date", p.due || null);
  // a date on an action without a roadmap year brings its year
  const dated = p.start || p.due;
  if (dated && before.kind === "action" && !before.roadmapYear && p.roadmapYear === undefined) set("roadmap_year", dated.slice(0, 4));
  if (p.dg !== undefined) set("dg", !!p.dg);
  let stage = p.stage === undefined ? before.stage : p.stage;
  let percent = before.percent;
  if (p.percent !== undefined && p.percent !== null) {
    percent = Math.max(0, Math.min(100, Math.round(p.percent)));
    if (p.stage === undefined) stage = stageOfPercent(percent, before.stage);
  } else if (p.percent === null) percent = null;
  if (p.stage !== undefined && p.percent === undefined) {
    const keep = !!p.stage && !stageOf(p.stage)?.closed && p.stage !== STAGES[0].id && before.percent != null && before.percent > 0 && before.percent < 100;
    if (!keep) percent = percentOfStage(p.stage);
  }
  if (p.percent !== undefined || p.stage !== undefined) {
    set("percent", percent);
    set("stage", stage);
    set("state", stateOfStage(stage));
  }
  if (!sets.length) return before;
  set("updated_by", by);
  vals.push(id);
  const r = await query<Row>(`UPDATE ${T} SET ${sets.join(", ")}, updated_at = now() WHERE id = $${vals.length} RETURNING *`, vals);
  const after = r.rows[0] ? item(r.rows[0]) : null;
  if (after) {
    const keys = (Object.keys(FIELD_NAME) as (keyof PlanFields)[]).filter((k) => p[k] !== undefined || k === "stage" || k === "percent" || k === "roadmapYear");
    await log(id, by, keys.map((k) => ({ field: FIELD_NAME[k]!, before: shown(k, before[k]), after: shown(k, after[k]) })));
  }
  return after;
}

/**
 * An action something is put inside of is under way (SARCLA 02.11.2026: "if an action is inside of a main action, the
 * action itself should go to In Progress"): with no status or in the Idea box it moves to In Progress. The action as it
 * is now, or null when it is not an action.
 */
export async function startedBySub(id: number, by: string): Promise<PlanItem | null> {
  const a = await itemById(id);
  if (!a || a.kind !== "action") return null;
  if (a.stage && a.stage !== IDEA) return a;
  return updateItem(id, { stage: IN_PROGRESS }, by);
}

/**
 * A sub-action made an action again (SARCLA 02.11.2026: "I should be able to move a sub-action back into a main action
 * if needed"): an action of its own in the category it is dropped on, with its name, description, status, priority,
 * person, dates and status note, Digital Growth's as its action had it; its tickets go onto it, the sub-action leaves.
 * Only a sub-action made on the plan - a KPI tile's task stays the tile's. The new action, or null when it cannot.
 */
export async function subToAction(taskId: number, parentId: number, by: string): Promise<PlanItem | null> {
  const [k, parent] = await Promise.all([taskById(taskId), itemById(parentId)]);
  if (!k || !k.tile.startsWith("plan:") || !parent || (parent.kind !== "group" && parent.kind !== "topic")) return null;
  const from = k.planItem != null ? await itemById(k.planItem) : null;
  const a = await addItem({ parentId, kind: "action", title: k.title, by });
  const made = await updateItem(a.id, {
    detail: k.note || k.title, ...(k.stage ? { stage: k.stage } : {}), priority: k.priority, start: k.start, due: k.due, statusNote: k.statusNote,
    owners: /^\d+$/.test(k.owner) ? [{ id: k.owner, name: k.ownerName || k.owner }] : [],
    dg: from?.dg ?? false, country: from?.country ?? [], ...(from?.dg ? { channel: from.channel, agency: from.agency } : {}),
  }, by);
  await ticketsToAction(k.id, a.id);
  // they agree as they are: the ticket was the sub-action's, its fields are the action's now
  await markTicketSync([a.id]);
  await deleteTask(k.id);
  if (from) await log(from.id, by, [{ field: "Sub-action", before: k.title, after: `made an action of its own in “${parent.title}”` }]);
  await log(a.id, by, [{ field: "Made from", before: "", after: from ? `a sub-action of “${from.title}”` : "a sub-action" }]);
  return made;
}

/**
 * A sub-action duplicated onto another action (SARCLA 02.11.2026: "if a sub-action serves a purpose in another major
 * point I should be able to duplicate and drag and drop"): the same name, description, status, priority, person, dates,
 * status note and people it is shared with - and the same ticket, none made ("it should not create a new ticket but keep
 * the same, associated to a different action"): the copy, the sub-action and the ticket are kept in step as one
 * (sharedTicketSync). Only an action led by Digital Growth takes the ticket; never onto its own action. The copy and how
 * many tickets it shares, or null when it cannot.
 */
export async function copySub(taskId: number, actionId: number, by: string): Promise<{ task: KpiTask; tickets: number } | null> {
  const [k, to] = await Promise.all([taskById(taskId), itemById(actionId)]);
  if (!k || !to || to.kind !== "action" || k.planItem === to.id) return null;
  const from = k.planItem != null ? await itemById(k.planItem) : null;
  const copy = await addTask({
    tile: `plan:${to.id}`, page: "plan", title: k.title, note: k.note, owner: k.owner, ownerName: k.ownerName, due: k.due, start: k.start,
    stage: k.stage, priority: k.priority, statusNote: k.statusNote, shared: k.shared, href: `/action-plan?item=${to.id}`, by,
  });
  const tickets = to.dg ? await shareTickets(k.id, copy.id, `plan:${to.id}`, by) : 0;
  await log(to.id, by, [{ field: "Sub-action", before: "", after: `${k.title} (a copy of the one in “${from?.title ?? "another action"}”${tickets ? ", the same ticket" : ""})` }]);
  if (from) await log(from.id, by, [{ field: "Sub-action", before: "", after: `${k.title} duplicated onto “${to.title}”${tickets ? ", the same ticket" : ""}` }]);
  await startedBySub(to.id, by);
  return { task: copy, tickets };
}

/** A sub-action moved under another action, its tickets with it; the action it goes to is under way. */
export async function moveSub(taskId: number, actionId: number, by: string): Promise<boolean> {
  const [k, to] = await Promise.all([taskById(taskId), itemById(actionId)]);
  if (!k || !k.tile.startsWith("plan:") || !to || to.kind !== "action" || k.planItem === to.id) return false;
  const from = k.planItem != null ? await itemById(k.planItem) : null;
  await moveTask(k.id, to.id);
  if (from) await log(from.id, by, [{ field: "Sub-action", before: k.title, after: `moved under “${to.title}”` }]);
  await log(to.id, by, [{ field: "Sub-action", before: "", after: from ? `${k.title} (from “${from.title}”)` : k.title }]);
  await startedBySub(to.id, by);
  return true;
}

/**
 * Main actions whose sub-actions are under way while they are not (SARCLA 02.11.2026: "the status of the main action is
 * Idea box - this should be In Progress because the others are in progress"): to In Progress, each in its tracking.
 * `subs`: the plan's sub-actions with their action and stage. The ones moved.
 */
export async function startMains(subs: { planItem: number | null; stage: string | null; status: string }[], by: string): Promise<number[]> {
  const moving = new Set(subs.filter((x) => x.planItem != null && ((x.stage && x.stage !== IDEA) || (!x.stage && x.status !== "open"))).map((x) => x.planItem as number));
  if (!moving.size) return [];
  const r = await query<{ id: number }>(`SELECT id FROM ${T} WHERE kind = 'action' AND (stage IS NULL OR stage = $2) AND id = ANY($1::int[])`, [[...moving], IDEA]);
  for (const x of r.rows) await updateItem(x.id, { stage: IN_PROGRESS }, by);
  return r.rows.map((x) => x.id);
}

/** When each action and its ticket last agreed (actionPlanHubspot.ts). */
export async function ticketSyncTimes(): Promise<Map<number, string>> {
  await ensure();
  const r = await query<{ id: number; at: unknown }>(`SELECT id, ticket_sync_at AS at FROM ${T} WHERE ticket_sync_at IS NOT NULL`);
  return new Map(r.rows.map((x) => [x.id, x.at instanceof Date ? x.at.toISOString() : String(x.at)]));
}
/** A ticket linked to the action or taken off it: the next time they meet is a first time again. */
export async function forgetTicketSync(id: number): Promise<void> {
  await query(`UPDATE ${T} SET ticket_sync_at = NULL WHERE id = $1`, [id]);
}
export async function markTicketSync(ids: number[]): Promise<void> {
  if (ids.length) await query(`UPDATE ${T} SET ticket_sync_at = now() WHERE id = ANY($1::int[])`, [ids]);
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
  // last among its siblings, in the ticket's terms from the start
  await query(`UPDATE ${T} SET sort = (SELECT COALESCE(max(sort), 0) + 1 FROM ${T} WHERE parent_id = $1 AND id <> $2) WHERE id = $2`, [parent.id, r.rows[0].id]);
  await query(`UPDATE ${T} SET s2s = true, stage = $2, percent = $3, state = $4 WHERE id = $1`,
    [r.rows[0].id, a.kind === "action" ? STAGES[0].id : null, a.kind === "action" ? 0 : null, a.kind === "action" ? "todo" : null]);
  await log(r.rows[0].id, a.by, [{ field: "Created", before: "", after: `under "${parent.title}"` }]);
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

/**
 * An action dropped on another action becomes its sub-action (SARCLA 02.11.2026: "I should be able to drag and drop the
 * action into another, and the dragged becomes a sub-action"): a sub-action of the other with its name, description,
 * stage, priority, first person assigned, planned and go-live dates and status note; its sub-actions and tickets follow
 * (kpiActions.movePlanItem); the row leaves the plan and the other action's tracking says so. Null when it cannot.
 */
export async function actionToSub(id: number, intoId: number, by: string): Promise<KpiTask | null> {
  const [a, into] = await Promise.all([itemById(id), itemById(intoId)]);
  if (!a || !into || a.id === into.id || a.kind !== "action" || into.kind !== "action") return null;
  if ((await subtree(a.id)).length > 1) return null;
  const who = a.owners[0];
  const task = await addTask({
    tile: `plan:${into.id}`, page: "plan", title: a.title, note: subText(a.title, a.detail),
    owner: who?.id ?? "", ownerName: who?.name ?? "", due: a.due, start: a.start, stage: a.stage, priority: a.priority,
    statusNote: a.statusNote, href: `/action-plan?item=${into.id}`, by,
  });
  await movePlanItem(a.id, into.id, task.id);
  await log(into.id, by, [{ field: "Sub-action", before: "", after: `${a.title} (was an action of the plan)` }]);
  await deleteItems([a.id]);
  await startedBySub(into.id, by);
  return task;
}

/** A dragged row dropped on another (actionPlanRules.reorder decides whether it may land there). */
export async function moveItem(dragId: number, targetId: number, where: "into" | "before", by: string): Promise<boolean> {
  const items = await planItems();
  const m = reorder(items, dragId, targetId, where);
  if (!m) return false;
  await query(`UPDATE ${T} SET parent_id = $1, updated_by = $2, updated_at = now() WHERE id = $3`, [m.parentId, by, dragId]);
  const was = items.find((i) => i.id === dragId)?.parentId;
  if (was !== m.parentId) {
    const name = (pid: number | null | undefined) => items.find((i) => i.id === pid)?.title ?? "";
    await log(dragId, by, [{ field: "Category", before: name(was), after: name(m.parentId) }]);
  }
  await query(
    `UPDATE ${T} t SET sort = x.ord FROM unnest($1::int[]) WITH ORDINALITY AS x(id, ord) WHERE t.id = x.id`,
    [m.order],
  );
  return true;
}

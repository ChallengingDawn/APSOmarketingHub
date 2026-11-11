import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTENT_TODO_TILE, inPlan, inPlanSql, isContentTodo, planRows } from "../src/lib/reporting/planRows";
import { IDEA, IN_PROGRESS, LIVE, rollup, type PlanItem, type PlanSub } from "../src/lib/reporting/actionPlanRules";

// SARCLA 11.11.2026, the Gantt with one row per content to-do ("Banner · DE", "Video · DE", "SEO landing page · DE" x6 ...,
// almost all Idea box, 0 %): "the target is really to have one action when there is a ticket, otherwise no - take them
// out if no ticket". A content project's to-do (tile "content:<project>") is a row of the plan only with its ticket.

type Row = { id: number; tile: string; planItem: number | null; tickets: number; status: PlanSub["status"]; stage: string | null };
const row = (id: number, tile: string, tickets: number, stage: string | null = IDEA, status: PlanSub["status"] = "open"): Row =>
  ({ id, tile, planItem: 5, tickets, status, stage });
/** As the plan's route makes a sub-row of a task. */
const asSub = (r: Row): PlanSub => ({
  id: r.id, item: r.planItem as number, title: `t${r.id}`, owner: "", ownerName: "", start: null, due: null, status: r.status, stage: r.stage, priority: "",
  kpiHref: "", kpiTile: r.tile.startsWith("plan:") ? "" : r.tile, tickets: r.tickets,
});
const action = (id: number, p: Partial<PlanItem> = {}): PlanItem => ({
  id, parentId: null, kind: "action", code: "", sort: id, src: null, title: `#${id}`, detail: "", priority: "", responsible: "", referent: "", status: "",
  state: null, result: "", mainTopic: "", perimeter: "", expected: "", codeFreeze: "", complexity: "", release: "",
  start: null, due: null, dueNote: "", percent: null, dg: true, owners: [], updatedBy: "", updatedAt: "",
  stage: IN_PROGRESS, channel: [], country: [], agency: [], roadmapYear: "", kpis: "", nextSteps: "", statusNote: "", ...p,
});

test("plan rows: a content to-do is known by its tile, content:<project id>", () => {
  assert.equal(isContentTodo({ tile: "content:12" }), true);
  assert.equal(isContentTodo({ tile: "plan:5" }), false);
  assert.equal(isContentTodo({ tile: "reach:seo:R05" }), false);
  assert.equal(isContentTodo({ tile: "visit::P02" }), false);
  // a key that only starts like one is not
  assert.equal(isContentTodo({ tile: "content:new-project-ideas" }), false);
  assert.equal(isContentTodo({ tile: "content:12:x" }), false);
});

test("plan rows: a hand-made sub-action and a KPI tile's task stay, with or without a ticket", () => {
  assert.equal(inPlan({ tile: "plan:5", tickets: 0 }), true);
  assert.equal(inPlan({ tile: "plan:5", tickets: 1 }), true);
  assert.equal(inPlan({ tile: "reach:seo:R05", tickets: 0 }), true);
});

test("plan rows: a content to-do shows with its ticket, and not without one", () => {
  assert.equal(inPlan({ tile: "content:12", tickets: 1 }), true);
  assert.equal(inPlan({ tile: "content:12", tickets: 0 }), false);
  const rows = [row(1, "plan:5", 0), row(2, "content:12", 1), row(3, "content:12", 0), row(4, "reach:seo:R05", 0), row(5, "content:7", 0)];
  assert.deepEqual(planRows(rows).map((r) => r.id), [1, 2, 4]);
  // its ticket linked later: it shows; unlinked again: it leaves - nothing else about it changes
  const later = { ...rows[2], tickets: 1 };
  assert.deepEqual(planRows([...rows.slice(0, 2), later]).map((r) => r.id), [1, 2, 3]);
  assert.deepEqual(planRows([rows[0], { ...rows[1], tickets: 0 }]).map((r) => r.id), [1]);
});

test("plan rows: the SQL says what inPlan says", () => {
  const sql = inPlanSql("t", "apsomh_kpi_ticket_links");
  assert.match(sql, /t\.tile !~ '\^content:\[0-9\]\+\$'/);
  assert.match(sql, /EXISTS \(SELECT 1 FROM apsomh_kpi_ticket_links pl WHERE pl\.task_id = t\.id\)/);
  // the same pattern as CONTENT_TODO_TILE
  const inSql = new RegExp(/'(\^content:[^']+)'/.exec(sql)![1]);
  for (const tile of ["content:12", "content:", "content:a", "plan:5", "content:12:x"]) assert.equal(inSql.test(tile), CONTENT_TODO_TILE.test(tile), tile);
});

test("plan rows: an action's % and counts follow its rows in the plan only, not its ticketless Idea box to-dos", () => {
  const rows = [
    row(1, "plan:5", 0, LIVE, "done"), // made on the plan, done: 100 %
    row(2, "content:12", 1, IN_PROGRESS, "doing"), // a content to-do with its ticket, In progress: 50 %
    row(3, "content:12", 0), row(4, "content:12", 0), row(5, "content:12", 0), // Idea box, no ticket
    row(6, "content:12", 0, IN_PROGRESS, "doing"), // under way in its project, still no ticket
  ];
  const items = [action(5)];
  const all = rollup(items, rows.map(asSub), "2026-11-11").get(5)!;
  // read over every to-do the action is dragged down: (100 + 50 + 0 + 0 + 0 + 50) / 6
  assert.equal(all.percent, 33);
  assert.equal(all.subs, 6);
  const shown = rollup(items, planRows(rows).map(asSub), "2026-11-11").get(5)!;
  assert.equal(shown.percent, 75);
  assert.equal(shown.subs, 2);
  assert.equal(shown.subsOpen, 1);
  // an action whose only to-dos have no ticket has no sub-rows: its own % again
  const alone = rollup([action(5, { percent: 20 })], planRows(rows.slice(2)).map(asSub), "2026-11-11").get(5)!;
  assert.equal(alone.subs, 0);
  assert.equal(alone.percent, 20);
});

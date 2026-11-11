// WHICH SUB-ROWS THE ACTION PLAN SHOWS (SARCLA 11.11.2026: "it creates for each activity an action plan action - this is
// not the target; the target is really to have one action when there is a ticket, otherwise no - take them out if no
// ticket").
//
// A content project's to-do is a row of apsomh_kpi_tasks with the tile "content:<project id>" (todos.ts todoTile) - the
// only rows ever made with that tile (todos.ts addTodo, syncPieceTasks: one per piece of content). It keeps its action
// (plan_item) from the project's place in the plan, but it is a row of the plan - Gantt, mountain, lists, counts, %, the
// plan's HubSpot sync - ONLY while a "From Scroll to Sale" ticket is linked to it. Without one it stays a to-do of its
// project (its list, the content board, the studios), not a plan row. Linked later: it shows; unlinked: it leaves again.
// Every other row is as it was: sub-actions made on the plan ("plan:<id>"), KPI tiles' tasks tied to an action.
// Nothing is deleted - the rows are only not read as the plan's.
//
// Pure: no imports, so the tests can load it.

/** The tile of a content project's to-do: "content:<project id>". */
export const CONTENT_TODO_TILE = /^content:\d+$/;

/** A content project's to-do (not a sub-action made on the plan, not a KPI tile's task). */
export const isContentTodo = (t: { tile: string }): boolean => CONTENT_TODO_TILE.test(t.tile);

/** Is this task a row of the plan? A content to-do only with its ticket; every other task as it always was. */
export const inPlan = (t: { tile: string; tickets: number }): boolean => !isContentTodo(t) || t.tickets > 0;

/** The plan's rows of a list of tasks (each with how many tickets it carries). */
export const planRows = <T extends { tile: string; tickets: number }>(rows: T[]): T[] => rows.filter(inPlan);

/**
 * The same rule in SQL, for the task row aliased `t` and the ticket links' table `links` - kept beside inPlan so the two
 * never part. The regular expression is CONTENT_TODO_TILE's.
 */
export const inPlanSql = (t: string, links: string): string =>
  `(${t}.tile !~ '^content:[0-9]+$' OR EXISTS (SELECT 1 FROM ${links} pl WHERE pl.task_id = ${t}.id))`;

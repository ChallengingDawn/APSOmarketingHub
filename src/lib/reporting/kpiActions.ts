// WHAT PEOPLE DO WITH A DIGITAL GROWTH KPI TILE (SARCLA 18.10.2026) - every chart card of the
// Digital Growth KPIs pages carries a small toolbar:
//   tasks      actions to correct the KPI, kept here and tracked on the tile (owner, due, status)
//   tickets    "From Scroll to Sale" tickets created from the tile or linked to it (the tickets
//              themselves live in HubSpot - only the link is kept here)
//   placement  promoted to "In a nutshell" or demoted to its own tab - one choice for everyone; a KPI
//              shown there as a small tile or as its page's full card (SARCLA 19.10: "the same dashboard
//              that we push into the nutshell, even the small one, then we decide which format to push")
//   views      a named set of a page's filters (its URL query), personal unless shared
//   order      the tiles of a nutshell panel in the order someone dragged them (SARCLA 19.10: "press
//              continuously with the mouse on a graph and move it inside the card") - one order for everyone
//   target     a figure a chart is measured against (SARCLA 25.10.2026: "allow to enter a threshold so we can measure
//              the rest of it" - his pick: a target per chart), typed in the Actions window; one for everyone
// A tile is known by its key: "<page>:<tab>:<what>", e.g. "reach:seo:R05" or "visit::P02".
// An action of the action plan is a tile too, "plan:<id>": its tasks are the action's sub-actions, and a
// task made on a KPI tile can belong to an action as well (plan_item) - it then shows on both (SARCLA
// 31.10.2026: "subactions can be linked and triggered from the KPI actions").
// Six small tables, created on first use - and a seventh that records a one-off reset of the placements.

import { isTileStyle, type TileStyle } from "./tileStyles";
import { query } from "@/lib/db/client";
import { stageOfStatus, statusOfStage } from "./actionPlanRules";

const TASKS = "apsomh_kpi_tasks";
const LINKS = "apsomh_kpi_ticket_links";
const PLACE = "apsomh_kpi_tile_placement";
const VIEWS = "apsomh_kpi_views";
const ORDER = "apsomh_kpi_tile_order";
const TARGET = "apsomh_kpi_tile_target";
/** one-off resets of the placements, each with the tiles it moved */
const RESETS = "apsomh_kpi_resets";

export type TaskStatus = "open" | "doing" | "done";
export const TASK_STATUSES: readonly TaskStatus[] = ["open", "doing", "done"];
/** A HubSpot owner a task is shared with: the hub mails them, the ticket shares with their user. */
export type SharedPerson = { id: string; userId: string; name: string; email: string };
export type KpiTask = {
  id: number; tile: string; page: string; title: string; note: string;
  owner: string; ownerName: string; due: string | null; status: TaskStatus;
  shared: SharedPerson[]; href: string;
  /** The action plan's action this is a sub-action of: tile "plan:<id>", or a KPI tile's task linked to one. */
  planItem: number | null;
  /** As a small action of the plan (SARCLA 01.11.2026): the pipeline's stage (status follows it), a priority, a planned
   *  date (`due` is the go-live date). Empty on a task that never had them. */
  stage: string | null; priority: string; start: string | null;
  /** Where it stands, in a line or two (SARCLA 02.11.2026: "status note should directly appear on the sub-action"). */
  statusNote: string;
  /** Its place among its action's sub-actions, as dragged (SARCLA 03.11.2026); null until then. */
  planSort: number | null;
  /** KPI tracking, its own (SARCLA 04.11.2026): Yes or No, and the KPI of the plan it tracks - its key and its name. */
  tracked: boolean; trackKpi: string; trackKpiTitle: string;
  createdBy: string; createdAt: string; updatedAt: string; doneAt: string | null;
};
/** The action of a plan tile ("plan:12" -> 12), null for a KPI tile. */
export const planIdOf = (tile: string): number | null => { const m = /^plan:(\d+)$/.exec(tile); return m ? Number(m[1]) : null; };
export type Placement = "nutshell" | "tab";
/** How big a promoted graph is in the nutshell: a small tile, half the width, or the whole width. */
export type TileFormat = "tile" | "half" | "card";
const FORMATS: readonly string[] = ["tile", "half", "card"];
export type TileSpec = {
  key: string; page: string; tab?: string; kpiId?: string; kind: "kpi" | "card"; title: string;
  filters?: Record<string, string[]>; from?: string; to?: string; href?: string;
};
export type SavedView = { id: number; page: string; name: string; query: string; mine: boolean; shared: boolean; ownerName: string; createdAt: string };

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS ${TASKS} (
        id serial PRIMARY KEY,
        tile text NOT NULL,
        page text NOT NULL,
        title text NOT NULL,
        note text NOT NULL DEFAULT '',
        owner text NOT NULL DEFAULT '',
        owner_name text NOT NULL DEFAULT '',
        due date,
        status text NOT NULL DEFAULT 'open',
        created_by text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        done_at timestamptz
      )`);
      await query(`CREATE INDEX IF NOT EXISTS ${TASKS}_tile ON ${TASKS} (tile)`);
      // who it is shared with, and the page it was made on - for the mail (SARCLA 18.10)
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS shared jsonb NOT NULL DEFAULT '[]'::jsonb`);
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS href text NOT NULL DEFAULT ''`);
      // the action plan's action it belongs to (SARCLA 31.10.2026)
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS plan_item integer`);
      // a sub-action as a small action: stage, priority, planned date (SARCLA 01.11.2026)
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS stage text`);
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT ''`);
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS start date`);
      // and its status note (SARCLA 02.11.2026)
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS status_note text NOT NULL DEFAULT ''`);
      // when a sub-action and its ticket last agreed (actionPlanHubspot.ts)
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS ticket_sync_at timestamptz`);
      // its place among its action's sub-actions, dragged (SARCLA 03.11.2026)
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS plan_sort integer`);
      // KPI tracking on a sub-action, its own (SARCLA 04.11.2026)
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS kpi_tracking boolean NOT NULL DEFAULT false`);
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS kpi_tracking_key text NOT NULL DEFAULT ''`);
      await query(`ALTER TABLE ${TASKS} ADD COLUMN IF NOT EXISTS kpi_tracking_title text NOT NULL DEFAULT ''`);
      // a sub-action made from an action before 02.11.2026 repeated its name on its description's first line, the
      // workbook's indents in ("the text feels weird"): cleaned once - after it no description starts with its name
      await query(`UPDATE ${TASKS} SET note = btrim(regexp_replace(substr(note, length(title) + 1), E'\\n[ \\t]+', E'\\n', 'g'), E' \\t\\n')
                     WHERE tile LIKE 'plan:%' AND left(note, length(title) + 1) = title || E'\n'`);
      await query(`CREATE TABLE IF NOT EXISTS ${LINKS} (
        tile text NOT NULL,
        ticket_id text NOT NULL,
        created boolean NOT NULL DEFAULT false,
        linked_by text NOT NULL DEFAULT '',
        linked_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (tile, ticket_id)
      )`);
      // a ticket belongs to the task it was created or linked for (SARCLA 18.10: "the ticket inside the task")
      await query(`ALTER TABLE ${LINKS} ADD COLUMN IF NOT EXISTS task_id integer`);
      await query(`CREATE TABLE IF NOT EXISTS ${PLACE} (
        tile text PRIMARY KEY,
        placement text NOT NULL,
        spec jsonb NOT NULL,
        by_name text NOT NULL DEFAULT '',
        at timestamptz NOT NULL DEFAULT now()
      )`);
      await query(`ALTER TABLE ${PLACE} ADD COLUMN IF NOT EXISTS format text`);
      // a KPI's style in the BUC View, picked on its Actions page (tileStyles.ts); null = the look it has today
      await query(`ALTER TABLE ${PLACE} ADD COLUMN IF NOT EXISTS style text`);
      // the ESO BUC View emptied of its graphs, once (SARCLA 01.11.2026: "clear BUC view of all graphs, let the user
      // promote what he wants"): every ESO chart sent there goes back to its page - the panels' own figures stay. The
      // tiles it took off are kept with the reset (RESETS), so it can be undone; it never runs again.
      await query(`CREATE TABLE IF NOT EXISTS ${RESETS} (name text PRIMARY KEY, keys jsonb NOT NULL DEFAULT '[]'::jsonb, at timestamptz NOT NULL DEFAULT now())`);
      await query(
        `WITH cleared AS (
           UPDATE ${PLACE} SET placement = 'tab', by_name = 'BUC View cleared 01.11.2026', at = now()
            WHERE placement = 'nutshell' AND spec->>'page' LIKE 'eso-%' AND tile NOT LIKE '%:panel:%'
              AND NOT EXISTS (SELECT 1 FROM ${RESETS} WHERE name = $1)
           RETURNING tile)
         INSERT INTO ${RESETS} (name, keys) SELECT $1, COALESCE(jsonb_agg(tile), '[]'::jsonb) FROM cleared
         ON CONFLICT (name) DO NOTHING`,
        ["eso-buc-graphs-2026-11-01"],
      );
      await query(`CREATE TABLE IF NOT EXISTS ${VIEWS} (
        id serial PRIMARY KEY,
        page text NOT NULL,
        name text NOT NULL,
        query text NOT NULL,
        owner_id integer NOT NULL,
        owner_name text NOT NULL DEFAULT '',
        shared boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS ${ORDER} (
        scope text PRIMARY KEY,
        keys jsonb NOT NULL,
        by_name text NOT NULL DEFAULT '',
        at timestamptz NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS ${TARGET} (
        target text PRIMARY KEY,
        value double precision NOT NULL,
        by_name text NOT NULL DEFAULT '',
        at timestamptz NOT NULL DEFAULT now()
      )`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : d == null ? null : String(d));
// a date column comes as the local midnight of that day: its own day, read locally - toISOString gave the day before
// on any server east of UTC (seen on a local copy in Zurich, 01.11.2026)
const day = (d: unknown) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : d == null ? null : String(d).slice(0, 10));
type TaskRow = { id: number; tile: string; page: string; title: string; note: string; owner: string; owner_name: string; due: unknown; status: string; shared: unknown; href: string | null; plan_item?: number | null; stage?: string | null; priority?: string | null; start?: unknown; status_note?: string | null; plan_sort?: number | null; kpi_tracking?: boolean | null; kpi_tracking_key?: string | null; kpi_tracking_title?: string | null; created_by: string; created_at: unknown; updated_at: unknown; done_at: unknown };
const sharedOf = (x: unknown): SharedPerson[] => {
  const v = typeof x === "string" ? (() => { try { return JSON.parse(x); } catch { return []; } })() : x;
  return Array.isArray(v) ? v.filter((p) => p && typeof p.id === "string") : [];
};
const task = (r: TaskRow): KpiTask => ({
  id: r.id, tile: r.tile, page: r.page, title: r.title, note: r.note, owner: r.owner, ownerName: r.owner_name,
  due: day(r.due), status: (TASK_STATUSES as readonly string[]).includes(r.status) ? (r.status as TaskStatus) : "open",
  shared: sharedOf(r.shared), href: r.href ?? "", planItem: r.plan_item ?? planIdOf(r.tile),
  stage: r.stage ?? null, priority: r.priority ?? "", start: day(r.start), statusNote: r.status_note ?? "", planSort: r.plan_sort ?? null,
  tracked: !!r.kpi_tracking, trackKpi: r.kpi_tracking_key ?? "", trackKpiTitle: r.kpi_tracking_title ?? "",
  createdBy: r.created_by, createdAt: iso(r.created_at) ?? "", updatedAt: iso(r.updated_at) ?? "", doneAt: iso(r.done_at),
});

/* ── tasks ─────────────────────────────────────────────────────────────── */

/** The tasks a tile shows: its own, and for an action of the plan also the KPI tiles' tasks linked to it. */
const VISIBLE = `(tile = $1 OR ($2::int IS NOT NULL AND plan_item = $2))`;

export async function tasksOf(tile: string): Promise<KpiTask[]> {
  await ensure();
  const r = await query<TaskRow>(`SELECT * FROM ${TASKS} WHERE ${VISIBLE} ORDER BY (status = 'done'), due NULLS LAST, id`, [tile, planIdOf(tile)]);
  return r.rows.map(task);
}

export async function addTask(t: { tile: string; page: string; title: string; note?: string; owner?: string; ownerName?: string; due?: string | null; shared?: SharedPerson[]; href?: string; planItem?: number | null; stage?: string | null; priority?: string; start?: string | null; statusNote?: string; by: string }): Promise<KpiTask> {
  await ensure();
  const status = statusOfStage(t.stage ?? null);
  const r = await query<TaskRow>(
    `INSERT INTO ${TASKS} (tile, page, title, note, owner, owner_name, due, created_by, shared, href, plan_item, stage, priority, start, status, status_note, done_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, CASE WHEN $15 = 'done' THEN now() END) RETURNING *`,
    [t.tile, t.page, t.title.slice(0, 300), (t.note ?? "").slice(0, 4000), t.owner ?? "", t.ownerName ?? "", t.due || null, t.by, JSON.stringify(t.shared ?? []), (t.href ?? "").slice(0, 500), t.planItem ?? planIdOf(t.tile),
      t.stage || null, t.priority ?? "", t.start || null, status, (t.statusNote ?? "").slice(0, 4000)],
  );
  return task(r.rows[0]);
}

/** Only the fields given change; "done" stamps when, anything else clears it. */
export async function taskById(id: number): Promise<KpiTask | null> {
  await ensure();
  const r = await query<TaskRow>(`SELECT * FROM ${TASKS} WHERE id = $1`, [id]);
  return r.rows[0] ? task(r.rows[0]) : null;
}

export async function updateTask(id: number, p: { title?: string; note?: string; owner?: string; ownerName?: string; due?: string | null; status?: TaskStatus; shared?: SharedPerson[]; planItem?: number | null; stage?: string | null; priority?: string; start?: string | null; statusNote?: string; tracked?: boolean; trackKpi?: string; trackKpiTitle?: string }): Promise<KpiTask | null> {
  await ensure();
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (p.title !== undefined) set("title", p.title.slice(0, 300));
  if (p.note !== undefined) set("note", p.note.slice(0, 4000));
  if (p.owner !== undefined) set("owner", p.owner);
  if (p.ownerName !== undefined) set("owner_name", p.ownerName);
  if (p.due !== undefined) set("due", p.due || null);
  if (p.planItem !== undefined) set("plan_item", p.planItem);
  if (p.priority !== undefined) set("priority", p.priority);
  if (p.start !== undefined) set("start", p.start || null);
  if (p.statusNote !== undefined) set("status_note", p.statusNote.slice(0, 4000));
  if (p.tracked !== undefined) set("kpi_tracking", !!p.tracked);
  if (p.trackKpi !== undefined) set("kpi_tracking_key", p.trackKpi.slice(0, 200));
  if (p.trackKpiTitle !== undefined) set("kpi_tracking_title", p.trackKpiTitle.slice(0, 300));
  // the stage decides open / doing / done; open / doing / done set on a KPI tile moves a stage it has to the same
  const status = p.stage !== undefined ? statusOfStage(p.stage) : p.status;
  if (p.stage !== undefined) set("stage", p.stage || null);
  else if (p.status !== undefined) { vals.push(stageOfStatus(p.status)); sets.push(`stage = CASE WHEN stage IS NULL THEN NULL ELSE $${vals.length} END`); }
  if (p.shared !== undefined) { vals.push(JSON.stringify(p.shared)); sets.push(`shared = $${vals.length}::jsonb`); }
  if (status !== undefined) {
    set("status", status);
    sets.push(status === "done" ? "done_at = COALESCE(done_at, now())" : "done_at = NULL");
  }
  if (!sets.length) return null;
  vals.push(id);
  const r = await query<TaskRow>(`UPDATE ${TASKS} SET ${sets.join(", ")}, updated_at = now() WHERE id = $${vals.length} RETURNING *`, vals);
  return r.rows[0] ? task(r.rows[0]) : null;
}

/** The task goes, and with it its links - the tickets themselves stay in HubSpot. */
export async function deleteTask(id: number): Promise<void> {
  await ensure();
  await query(`DELETE FROM ${LINKS} WHERE task_id = $1`, [id]);
  await query(`DELETE FROM ${TASKS} WHERE id = $1`, [id]);
}

/* ── ticket links ──────────────────────────────────────────────────────── */

export async function linkTickets(tile: string, ticketIds: string[], by: string, created = false, taskId: number | null = null): Promise<void> {
  const ids = [...new Set(ticketIds.map(String).filter((x) => /^\d+$/.test(x)))];
  if (!ids.length) return;
  await ensure();
  await query(
    // linked again for a task: it moves under that task
    `INSERT INTO ${LINKS} (tile, ticket_id, created, linked_by, task_id) SELECT $1, x, $3, $4, $5 FROM unnest($2::text[]) AS x
     ON CONFLICT (tile, ticket_id) DO UPDATE SET task_id = COALESCE(EXCLUDED.task_id, ${LINKS}.task_id)`,
    [tile, ids, created, by, taskId],
  );
}

/** A tile's tickets: its own, and those of every task it shows (a linked KPI task's tickets show on its action too). */
const LINKS_OF = `(tile = $1 OR task_id IN (SELECT id FROM ${TASKS} WHERE ${VISIBLE}))`;

export async function unlinkTicket(tile: string, ticketId: string): Promise<void> {
  await ensure();
  await query(`DELETE FROM ${LINKS} WHERE ticket_id = $3 AND ${LINKS_OF}`, [tile, planIdOf(tile), ticketId]);
}

export async function ticketsOf(tile: string): Promise<{ ticketId: string; created: boolean; linkedBy: string; linkedAt: string; taskId: number | null }[]> {
  await ensure();
  const r = await query<{ ticket_id: string; created: boolean; linked_by: string; linked_at: unknown; task_id: number | null }>(`SELECT * FROM ${LINKS} WHERE ${LINKS_OF} ORDER BY linked_at`, [tile, planIdOf(tile)]);
  // one ticket linked under two tiles is still one ticket
  const seen = new Set<string>();
  return r.rows
    .filter((x) => (seen.has(x.ticket_id) ? false : (seen.add(x.ticket_id), true)))
    .map((x) => ({ ticketId: x.ticket_id, created: x.created, linkedBy: x.linked_by, linkedAt: iso(x.linked_at) ?? "", taskId: x.task_id ?? null }));
}

/** Every sub-action of the action plan, with how many tickets each carries - one read for the whole plan. */
export async function planTasks(): Promise<(KpiTask & { tickets: number })[]> {
  await ensure();
  const r = await query<TaskRow & { tickets: string }>(
    `SELECT t.*, (SELECT count(DISTINCT l.ticket_id) FROM ${LINKS} l WHERE l.task_id = t.id)::text AS tickets
       FROM ${TASKS} t WHERE t.tile LIKE 'plan:%' OR t.plan_item IS NOT NULL ORDER BY t.due NULLS LAST, t.id`,
  );
  return r.rows.map((x) => ({ ...task(x), tickets: Number(x.tickets) }));
}

/**
 * Every ticket that belongs to an action of the plan - linked on the action, or under a sub-action of it (one made on a
 * KPI tile and tied to the action too) - with that action; the first link wins, so a sub-action duplicated onto another
 * action with its ticket leaves the ticket where it was. For the plan's properties in HubSpot.
 */
export async function planTicketLinks(): Promise<{ ticketId: string; item: number }[]> {
  await ensure();
  const r = await query<{ ticket_id: string; item: number | null }>(
    `SELECT l.ticket_id, COALESCE(t.plan_item,
         CASE WHEN t.tile ~ '^plan:[0-9]+$' THEN substring(t.tile from 6)::int END,
         CASE WHEN l.tile ~ '^plan:[0-9]+$' THEN substring(l.tile from 6)::int END) AS item
       FROM ${LINKS} l LEFT JOIN ${TASKS} t ON t.id = l.task_id ORDER BY l.linked_at`,
  );
  const out = new Map<string, number>();
  for (const x of r.rows) if (x.item != null && !out.has(x.ticket_id)) out.set(x.ticket_id, Number(x.item));
  return [...out.entries()].map(([ticketId, item]) => ({ ticketId, item }));
}

/**
 * A sub-action's tickets given to its duplicate under another action too - the same tickets, none made (SARCLA
 * 02.11.2026). One the action already has stays as it is there. How many it was given.
 */
export async function shareTickets(fromTask: number, toTask: number, tile: string, by: string): Promise<number> {
  await ensure();
  const r = await query(
    `INSERT INTO ${LINKS} (tile, ticket_id, created, linked_by, task_id) SELECT $2, ticket_id, false, $4, $3 FROM ${LINKS} WHERE task_id = $1
     ON CONFLICT (tile, ticket_id) DO NOTHING RETURNING ticket_id`,
    [fromTask, tile, toTask, by],
  );
  return r.rows.length;
}

/**
 * Each sub-action's ticket - one per sub-action (SARCLA 02.11.2026), the latest linked when an older one has several.
 * For the sub-action and its ticket kept in step, as an action and its own.
 */
export async function taskTickets(): Promise<{ task: number; ticketId: string; count: number }[]> {
  await ensure();
  const r = await query<{ task_id: number; ticket_id: string; count: string }>(
    `SELECT DISTINCT ON (task_id) task_id, ticket_id, (count(*) OVER (PARTITION BY task_id))::text AS count
       FROM ${LINKS} WHERE task_id IS NOT NULL ORDER BY task_id, linked_at DESC`,
  );
  return r.rows.map((x) => ({ task: Number(x.task_id), ticketId: x.ticket_id, count: Number(x.count) }));
}
/** When each sub-action and its ticket last agreed. */
export async function taskSyncTimes(): Promise<Map<number, string>> {
  await ensure();
  const r = await query<{ id: number; at: unknown }>(`SELECT id, ticket_sync_at AS at FROM ${TASKS} WHERE ticket_sync_at IS NOT NULL`);
  return new Map(r.rows.map((x) => [x.id, iso(x.at) ?? ""]));
}
export async function markTaskSync(ids: number[]): Promise<void> {
  if (ids.length) await query(`UPDATE ${TASKS} SET ticket_sync_at = now() WHERE id = ANY($1::int[])`, [ids]);
}
/** A ticket linked to the sub-action or taken off it: the next time they meet is a first time again. */
export async function forgetTaskSync(id: number): Promise<void> {
  await ensure();
  await query(`UPDATE ${TASKS} SET ticket_sync_at = NULL WHERE id = $1`, [id]);
}

/**
 * Each action's own ticket - linked on the action, not under a sub-action; one per action (SARCLA 02.11.2026), the
 * latest linked when an older action has several. For the action and its ticket kept in step.
 */
export async function actionTickets(): Promise<{ item: number; ticketId: string; count: number }[]> {
  await ensure();
  const r = await query<{ item: number; ticket_id: string; count: string }>(
    `SELECT DISTINCT ON (substring(tile from 6)::int) substring(tile from 6)::int AS item, ticket_id,
            (count(*) OVER (PARTITION BY tile))::text AS count
       FROM ${LINKS} WHERE tile ~ '^plan:[0-9]+$' AND task_id IS NULL ORDER BY substring(tile from 6)::int, linked_at DESC`,
  );
  return r.rows.map((x) => ({ item: Number(x.item), ticketId: x.ticket_id, count: Number(x.count) }));
}

/** Every ticket linked on the plan, by where: a sub-action's (task) or an action's own (item) - for the plan's counts. */
export async function planTicketIds(): Promise<{ task: number | null; item: number | null; ticketId: string }[]> {
  await ensure();
  const r = await query<{ task_id: number | null; item: number | null; ticket_id: string }>(
    `SELECT DISTINCT task_id, CASE WHEN task_id IS NULL THEN substring(tile from 6)::int END AS item, ticket_id
       FROM ${LINKS} WHERE task_id IS NOT NULL OR tile ~ '^plan:[0-9]+$'`,
  );
  return r.rows.map((x) => ({ task: x.task_id == null ? null : Number(x.task_id), item: x.item == null ? null : Number(x.item), ticketId: String(x.ticket_id) }));
}

/** A sub-action made an action of its own: its tickets go onto that action (a ticket it already has stays as it is there). */
export async function ticketsToAction(taskId: number, itemId: number): Promise<void> {
  await ensure();
  const tile = `plan:${itemId}`;
  await query(`DELETE FROM ${LINKS} l WHERE l.task_id = $1 AND EXISTS (SELECT 1 FROM ${LINKS} x WHERE x.tile = $2 AND x.ticket_id = l.ticket_id AND x.task_id IS DISTINCT FROM $1)`, [taskId, tile]);
  await query(`UPDATE ${LINKS} SET tile = $2, task_id = NULL WHERE task_id = $1`, [taskId, tile]);
}

/** A sub-action moved under another action, its tickets with it. */
export async function moveTask(taskId: number, itemId: number): Promise<void> {
  await ensure();
  const tile = `plan:${itemId}`;
  await query(`DELETE FROM ${LINKS} l WHERE l.task_id = $1 AND l.tile <> $2 AND EXISTS (SELECT 1 FROM ${LINKS} x WHERE x.tile = $2 AND x.ticket_id = l.ticket_id)`, [taskId, tile]);
  await query(`UPDATE ${LINKS} SET tile = $2 WHERE task_id = $1`, [taskId, tile]);
  await query(`UPDATE ${TASKS} SET tile = $2, plan_item = $3, href = $4, plan_sort = NULL, updated_at = now() WHERE id = $1`, [taskId, tile, itemId, `/action-plan?item=${itemId}`]);
}

/** An action's sub-actions in the order given (ids, top to bottom), as dragged on the plan. */
export async function sortTasks(ids: number[]): Promise<void> {
  await ensure();
  await query(`UPDATE ${TASKS} t SET plan_sort = x.n FROM unnest($1::int[]) WITH ORDINALITY AS x(id, n) WHERE t.id = x.id`, [ids]);
}

/** An action leaves the plan: its own sub-actions go with it (their tickets stay in HubSpot), KPI tasks only lose the link. */
export async function dropPlanItem(id: number): Promise<void> {
  await ensure();
  await query(`DELETE FROM ${LINKS} WHERE task_id IN (SELECT id FROM ${TASKS} WHERE tile = $1) OR tile = $1`, [`plan:${id}`]);
  await query(`DELETE FROM ${TASKS} WHERE tile = $1`, [`plan:${id}`]);
  await query(`UPDATE ${TASKS} SET plan_item = NULL WHERE plan_item = $1`, [id]);
}

/**
 * An action made a sub-action of another (SARCLA 02.11.2026): its own sub-actions move to the other action, KPI tasks tied
 * to it are tied to the other one, and its tickets follow - those on the action itself go under its new sub-action
 * (`taskId`), those under its sub-actions stay with them. A ticket the other action already has stays as it is there.
 */
export async function movePlanItem(fromId: number, intoId: number, taskId: number): Promise<void> {
  await ensure();
  const from = `plan:${fromId}`, into = `plan:${intoId}`;
  await query(`UPDATE ${LINKS} SET task_id = $2 WHERE tile = $1 AND task_id IS NULL`, [from, taskId]);
  await query(`DELETE FROM ${LINKS} l WHERE l.tile = $1 AND EXISTS (SELECT 1 FROM ${LINKS} x WHERE x.tile = $2 AND x.ticket_id = l.ticket_id)`, [from, into]);
  await query(`UPDATE ${LINKS} SET tile = $2 WHERE tile = $1`, [from, into]);
  await query(`UPDATE ${TASKS} SET tile = $2, plan_item = $3, updated_at = now() WHERE tile = $1`, [from, into, intoId]);
  await query(`UPDATE ${TASKS} SET plan_item = $2 WHERE plan_item = $1`, [fromId, intoId]);
}

/* ── placement ─────────────────────────────────────────────────────────── */

/**
 * Where a tile is shown; a KPI's format kept as it was when none is given, and its style too - `null` puts it back to the
 * look it has today (tileStyles.ts).
 */
export async function setPlacement(spec: TileSpec, placement: Placement, by: string, format?: TileFormat, style?: TileStyle | null): Promise<void> {
  await ensure();
  const st = style === undefined ? "keep" : style ?? "";
  await query(
    `INSERT INTO ${PLACE} (tile, placement, spec, by_name, format, style) VALUES ($1, $2, $3::jsonb, $4, $5, NULLIF(NULLIF($6, 'keep'), ''))
     ON CONFLICT (tile) DO UPDATE SET placement = EXCLUDED.placement, spec = EXCLUDED.spec, by_name = EXCLUDED.by_name,
       format = COALESCE(EXCLUDED.format, ${PLACE}.format),
       style = CASE WHEN $6 = 'keep' THEN ${PLACE}.style ELSE NULLIF($6, '') END, at = now()`,
    [spec.key, placement, JSON.stringify(spec), by, format ?? null, st],
  );
}

/** Every tile someone moved: promoted to the nutshell or demoted to its tab. */
export async function placements(): Promise<{ spec: TileSpec; placement: Placement; format: TileFormat | null; style: TileStyle | null; by: string; at: string }[]> {
  await ensure();
  const r = await query<{ tile: string; placement: string; spec: TileSpec; by_name: string; at: unknown; format: string | null; style: string | null }>(`SELECT * FROM ${PLACE} ORDER BY at`);
  return r.rows.map((x) => ({ spec: { ...x.spec, key: x.tile }, placement: x.placement === "nutshell" ? "nutshell" : "tab", format: x.format && FORMATS.includes(x.format) ? (x.format as TileFormat) : null, style: isTileStyle(x.style) ? x.style : null, by: x.by_name, at: iso(x.at) ?? "" }));
}

/* ── order ───────────────────────────────────────────────────────────── */

/** A panel's tiles in the order someone dragged them; scope "nutshell:<stage slug>". */
export async function setOrder(scope: string, keys: string[], by: string): Promise<void> {
  await ensure();
  await query(
    `INSERT INTO ${ORDER} (scope, keys, by_name) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (scope) DO UPDATE SET keys = EXCLUDED.keys, by_name = EXCLUDED.by_name, at = now()`,
    [scope, JSON.stringify(keys), by],
  );
}

/** Every panel someone put in order: scope -> tile keys, first to last. */
export async function orders(): Promise<Record<string, string[]>> {
  await ensure();
  const r = await query<{ scope: string; keys: unknown }>(`SELECT scope, keys FROM ${ORDER}`);
  const out: Record<string, string[]> = {};
  for (const x of r.rows) {
    const v = typeof x.keys === "string" ? (() => { try { return JSON.parse(x.keys as string); } catch { return []; } })() : x.keys;
    if (Array.isArray(v)) out[x.scope] = v.filter((k): k is string => typeof k === "string");
  }
  return out;
}

/* ── targets ─────────────────────────────────────────────────────────── */

/** A chart's target, by the key the chart gives it ("eso-figures:ytd:ytdrev@eso"); null takes it away. */
export async function setTarget(key: string, value: number | null, by: string): Promise<void> {
  await ensure();
  if (value == null) { await query(`DELETE FROM ${TARGET} WHERE target = $1`, [key]); return; }
  await query(
    `INSERT INTO ${TARGET} (target, value, by_name) VALUES ($1, $2, $3)
     ON CONFLICT (target) DO UPDATE SET value = EXCLUDED.value, by_name = EXCLUDED.by_name, at = now()`,
    [key, value, by],
  );
}

/** Every target set: key -> value. */
export async function targets(): Promise<Record<string, number>> {
  await ensure();
  const r = await query<{ target: string; value: number }>(`SELECT target, value FROM ${TARGET}`);
  return Object.fromEntries(r.rows.map((x) => [x.target, Number(x.value)]).filter(([, v]) => Number.isFinite(v as number)));
}

/* ── saved views ───────────────────────────────────────────────────────── */

export async function viewsOf(page: string, userId: number): Promise<SavedView[]> {
  await ensure();
  const r = await query<{ id: number; page: string; name: string; query: string; owner_id: number; owner_name: string; shared: boolean; created_at: unknown }>(
    `SELECT * FROM ${VIEWS} WHERE page = $1 AND (owner_id = $2 OR shared) ORDER BY (owner_id <> $2), lower(name)`, [page, userId],
  );
  return r.rows.map((x) => ({ id: x.id, page: x.page, name: x.name, query: x.query, mine: x.owner_id === userId, shared: x.shared, ownerName: x.owner_name, createdAt: iso(x.created_at) ?? "" }));
}

export async function saveView(v: { page: string; name: string; query: string; shared: boolean; ownerId: number; ownerName: string }): Promise<number> {
  await ensure();
  const r = await query<{ id: number }>(
    `INSERT INTO ${VIEWS} (page, name, query, owner_id, owner_name, shared) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [v.page, v.name.slice(0, 120), v.query.slice(0, 2000), v.ownerId, v.ownerName, v.shared],
  );
  return r.rows[0].id;
}

/** Only its owner changes or removes a view. */
export async function updateView(id: number, ownerId: number, p: { name?: string; shared?: boolean; query?: string }): Promise<boolean> {
  await ensure();
  const r = await query<{ id: number }>(
    `UPDATE ${VIEWS} SET name = COALESCE($3, name), shared = COALESCE($4, shared), query = COALESCE($5, query) WHERE id = $1 AND owner_id = $2 RETURNING id`,
    [id, ownerId, p.name?.slice(0, 120) ?? null, p.shared ?? null, p.query?.slice(0, 2000) ?? null],
  );
  return r.rows.length > 0;
}

export async function deleteView(id: number, ownerId: number): Promise<boolean> {
  await ensure();
  const r = await query<{ id: number }>(`DELETE FROM ${VIEWS} WHERE id = $1 AND owner_id = $2 RETURNING id`, [id, ownerId]);
  return r.rows.length > 0;
}

/* ── what a page's tiles carry, in one read ────────────────────────────── */

/** Per tile of a page ("*" = every page, for the nutshell): open tasks, all tasks, linked tickets. */
export async function pageCounts(page: string): Promise<Record<string, { open: number; tasks: number; tickets: number }>> {
  await ensure();
  const out: Record<string, { open: number; tasks: number; tickets: number }> = {};
  const all = page === "*";
  const t = await query<{ tile: string; open: string; total: string }>(
    `SELECT tile, count(*) FILTER (WHERE status <> 'done')::text AS open, count(*)::text AS total FROM ${TASKS} ${all ? "" : "WHERE page = $1"} GROUP BY tile`, all ? [] : [page],
  );
  for (const x of t.rows) out[x.tile] = { open: Number(x.open), tasks: Number(x.total), tickets: 0 };
  const l = await query<{ tile: string; n: string }>(`SELECT tile, count(*)::text AS n FROM ${LINKS} ${all ? "" : "WHERE tile LIKE $1"} GROUP BY tile`, all ? [] : [`${page}:%`]);
  for (const x of l.rows) (out[x.tile] ??= { open: 0, tasks: 0, tickets: 0 }).tickets = Number(x.n);
  // what tracks a KPI on the action plan counts on its Actions tab too - its actions and sub-actions, made on its Actions
  // page or set there (SARCLA 04.11.2026); open = not Live, Maintaining or Killed. No plan yet: nothing to add.
  try {
    const like = all ? null : `${page}:%`;
    const r = await query<{ key: string; open: string; total: string }>(
      `SELECT key, sum(open)::text AS open, sum(total)::text AS total FROM (
         SELECT kpi_tracking_key AS key, count(*) FILTER (WHERE COALESCE(stage, '') NOT IN ('6161856758', '6161856759', '6161860810')) AS open, count(*) AS total
           FROM apsomh_action_plan WHERE kpi_tracking AND kpi_tracking_key <> '' ${like ? "AND kpi_tracking_key LIKE $1" : ""} GROUP BY 1
         UNION ALL
         SELECT kpi_tracking_key, count(*) FILTER (WHERE status <> 'done'), count(*)
           FROM ${TASKS} WHERE kpi_tracking AND kpi_tracking_key <> '' AND tile <> kpi_tracking_key ${like ? "AND kpi_tracking_key LIKE $1" : ""} GROUP BY 1
       ) x GROUP BY key`,
      like ? [like] : [],
    );
    for (const x of r.rows) {
      const c = (out[x.key] ??= { open: 0, tasks: 0, tickets: 0 });
      c.open += Number(x.open); c.tasks += Number(x.total);
    }
  } catch { /* the plan's tables are not there yet */ }
  return out;
}

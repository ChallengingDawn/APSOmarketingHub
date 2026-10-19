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
// A tile is known by its key: "<page>:<tab>:<what>", e.g. "reach:seo:R05" or "visit::P02".
// Five small tables, created on first use.

import { query } from "@/lib/db/client";

const TASKS = "apsomh_kpi_tasks";
const LINKS = "apsomh_kpi_ticket_links";
const PLACE = "apsomh_kpi_tile_placement";
const VIEWS = "apsomh_kpi_views";
const ORDER = "apsomh_kpi_tile_order";

export type TaskStatus = "open" | "doing" | "done";
export const TASK_STATUSES: readonly TaskStatus[] = ["open", "doing", "done"];
/** A HubSpot owner a task is shared with: the hub mails them, the ticket shares with their user. */
export type SharedPerson = { id: string; userId: string; name: string; email: string };
export type KpiTask = {
  id: number; tile: string; page: string; title: string; note: string;
  owner: string; ownerName: string; due: string | null; status: TaskStatus;
  shared: SharedPerson[]; href: string;
  createdBy: string; createdAt: string; updatedAt: string; doneAt: string | null;
};
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
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : d == null ? null : String(d));
const day = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d == null ? null : String(d).slice(0, 10));
type TaskRow = { id: number; tile: string; page: string; title: string; note: string; owner: string; owner_name: string; due: unknown; status: string; shared: unknown; href: string | null; created_by: string; created_at: unknown; updated_at: unknown; done_at: unknown };
const sharedOf = (x: unknown): SharedPerson[] => {
  const v = typeof x === "string" ? (() => { try { return JSON.parse(x); } catch { return []; } })() : x;
  return Array.isArray(v) ? v.filter((p) => p && typeof p.id === "string") : [];
};
const task = (r: TaskRow): KpiTask => ({
  id: r.id, tile: r.tile, page: r.page, title: r.title, note: r.note, owner: r.owner, ownerName: r.owner_name,
  due: day(r.due), status: (TASK_STATUSES as readonly string[]).includes(r.status) ? (r.status as TaskStatus) : "open",
  shared: sharedOf(r.shared), href: r.href ?? "",
  createdBy: r.created_by, createdAt: iso(r.created_at) ?? "", updatedAt: iso(r.updated_at) ?? "", doneAt: iso(r.done_at),
});

/* ── tasks ─────────────────────────────────────────────────────────────── */

export async function tasksOf(tile: string): Promise<KpiTask[]> {
  await ensure();
  const r = await query<TaskRow>(`SELECT * FROM ${TASKS} WHERE tile = $1 ORDER BY (status = 'done'), due NULLS LAST, id`, [tile]);
  return r.rows.map(task);
}

export async function addTask(t: { tile: string; page: string; title: string; note?: string; owner?: string; ownerName?: string; due?: string | null; shared?: SharedPerson[]; href?: string; by: string }): Promise<KpiTask> {
  await ensure();
  const r = await query<TaskRow>(
    `INSERT INTO ${TASKS} (tile, page, title, note, owner, owner_name, due, created_by, shared, href) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) RETURNING *`,
    [t.tile, t.page, t.title.slice(0, 300), (t.note ?? "").slice(0, 4000), t.owner ?? "", t.ownerName ?? "", t.due || null, t.by, JSON.stringify(t.shared ?? []), (t.href ?? "").slice(0, 500)],
  );
  return task(r.rows[0]);
}

/** Only the fields given change; "done" stamps when, anything else clears it. */
export async function taskById(id: number): Promise<KpiTask | null> {
  await ensure();
  const r = await query<TaskRow>(`SELECT * FROM ${TASKS} WHERE id = $1`, [id]);
  return r.rows[0] ? task(r.rows[0]) : null;
}

export async function updateTask(id: number, p: { title?: string; note?: string; owner?: string; ownerName?: string; due?: string | null; status?: TaskStatus; shared?: SharedPerson[] }): Promise<KpiTask | null> {
  await ensure();
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (p.title !== undefined) set("title", p.title.slice(0, 300));
  if (p.note !== undefined) set("note", p.note.slice(0, 4000));
  if (p.owner !== undefined) set("owner", p.owner);
  if (p.ownerName !== undefined) set("owner_name", p.ownerName);
  if (p.due !== undefined) set("due", p.due || null);
  if (p.shared !== undefined) { vals.push(JSON.stringify(p.shared)); sets.push(`shared = $${vals.length}::jsonb`); }
  if (p.status !== undefined) {
    set("status", p.status);
    sets.push(p.status === "done" ? "done_at = COALESCE(done_at, now())" : "done_at = NULL");
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

export async function unlinkTicket(tile: string, ticketId: string): Promise<void> {
  await ensure();
  await query(`DELETE FROM ${LINKS} WHERE tile = $1 AND ticket_id = $2`, [tile, ticketId]);
}

export async function ticketsOf(tile: string): Promise<{ ticketId: string; created: boolean; linkedBy: string; linkedAt: string; taskId: number | null }[]> {
  await ensure();
  const r = await query<{ ticket_id: string; created: boolean; linked_by: string; linked_at: unknown; task_id: number | null }>(`SELECT * FROM ${LINKS} WHERE tile = $1 ORDER BY linked_at`, [tile]);
  return r.rows.map((x) => ({ ticketId: x.ticket_id, created: x.created, linkedBy: x.linked_by, linkedAt: iso(x.linked_at) ?? "", taskId: x.task_id ?? null }));
}

/* ── placement ─────────────────────────────────────────────────────────── */

/** Where a tile is shown; a KPI's format kept as it was when none is given. */
export async function setPlacement(spec: TileSpec, placement: Placement, by: string, format?: TileFormat): Promise<void> {
  await ensure();
  await query(
    `INSERT INTO ${PLACE} (tile, placement, spec, by_name, format) VALUES ($1, $2, $3::jsonb, $4, $5)
     ON CONFLICT (tile) DO UPDATE SET placement = EXCLUDED.placement, spec = EXCLUDED.spec, by_name = EXCLUDED.by_name,
       format = COALESCE(EXCLUDED.format, ${PLACE}.format), at = now()`,
    [spec.key, placement, JSON.stringify(spec), by, format ?? null],
  );
}

/** Every tile someone moved: promoted to the nutshell or demoted to its tab. */
export async function placements(): Promise<{ spec: TileSpec; placement: Placement; format: TileFormat | null; by: string; at: string }[]> {
  await ensure();
  const r = await query<{ tile: string; placement: string; spec: TileSpec; by_name: string; at: unknown; format: string | null }>(`SELECT * FROM ${PLACE} ORDER BY at`);
  return r.rows.map((x) => ({ spec: { ...x.spec, key: x.tile }, placement: x.placement === "nutshell" ? "nutshell" : "tab", format: x.format && FORMATS.includes(x.format) ? (x.format as TileFormat) : null, by: x.by_name, at: iso(x.at) ?? "" }));
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
  return out;
}

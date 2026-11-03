// EVERY GRAPH THE HUB DRAWS, AS IT DRAWS IT (SARCLA 03.11.2026, of the action plan's KPI library: "I mean the individual
// reports like a library ... this should be hierarchy dynamic for picking up"). A report page builds its graphs in its
// own code - nowhere lists them - so each graph with the tiles' toolbar (TileActions) says it exists when its page is
// drawn: its page's address, its key, its name, a KPI id when it shows one. Kept with the day it was last seen: one no
// longer drawn falls out of the library after a month, a new one is in it the first time its page is opened.
import { query } from "@/lib/db/client";
import { figureOf } from "./planKpiRules";

const T = "apsomh_report_tiles";
/** A graph not drawn for this long is taken as gone. */
export const TILE_DAYS = 30;

export type SeenTile = {
  path: string; key: string; title: string; kind: string; kpiId: string | null;
  /** what the graph shows now, in its own words ("30,216 Jan-Sep, -28% vs last year") - the figure it opens with is its value */
  summary?: string | null; value?: number | null;
  /** when its page last said so */
  at?: string | null;
};

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  ready ??= query(`CREATE TABLE IF NOT EXISTS ${T} (
      path text NOT NULL, key text NOT NULL, title text NOT NULL, kind text NOT NULL DEFAULT 'card', kpi_id text,
      first_seen timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (path, key))`)
    // what each graph shows, its figure and when (SARCLA 03.11.2026: "we should see the real KPIs")
    .then(() => query(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS summary text, ADD COLUMN IF NOT EXISTS value double precision, ADD COLUMN IF NOT EXISTS value_at timestamptz`))
    .then(() => undefined, (e) => { ready = null; throw e; });
  return ready;
}

/** Graphs drawn: added, their name kept as it is now, the day they were seen. */
export async function tilesSeen(tiles: SeenTile[]): Promise<number> {
  await ensure();
  const ok = tiles.filter((t) => /^\/[\w\-/]{0,200}$/.test(t.path) && t.key && t.key.length <= 300 && t.title).slice(0, 100);
  if (!ok.length) return 0;
  await query(
    `INSERT INTO ${T} (path, key, title, kind, kpi_id, summary, value, value_at)
       SELECT x.path, x.key, x.title, x.kind, NULLIF(x.kpi_id, ''), NULLIF(x.summary, ''), x.value, CASE WHEN NULLIF(x.summary, '') IS NULL THEN NULL ELSE now() END
       FROM jsonb_to_recordset($1::jsonb) AS x(path text, key text, title text, kind text, kpi_id text, summary text, value double precision)
     ON CONFLICT (path, key) DO UPDATE SET title = EXCLUDED.title, kind = EXCLUDED.kind, kpi_id = EXCLUDED.kpi_id, last_seen = now(),
       summary = COALESCE(EXCLUDED.summary, ${T}.summary), value = CASE WHEN EXCLUDED.summary IS NULL THEN ${T}.value ELSE EXCLUDED.value END,
       value_at = COALESCE(EXCLUDED.value_at, ${T}.value_at)`,
    [JSON.stringify(ok.map((t) => {
      const summary = (t.summary ?? "").trim().slice(0, 300);
      return { path: t.path, key: t.key, title: t.title.slice(0, 200), kind: t.kind === "kpi" ? "kpi" : "card", kpi_id: t.kpiId ?? "", summary, value: summary ? figureOf(summary) : null };
    }))],
  );
  return ok.length;
}

/** The graphs drawn within the last month, by page and in the order they were first seen. */
export async function recentTiles(): Promise<SeenTile[]> {
  await ensure();
  const r = await query<{ path: string; key: string; title: string; kind: string; kpi_id: string | null; summary: string | null; value: number | null; at: string | null }>(
    `SELECT path, key, title, kind, kpi_id, summary, value, to_char(value_at AT TIME ZONE 'Europe/Zurich', 'YYYY-MM-DD HH24:MI') AS at
       FROM ${T} WHERE last_seen > now() - interval '${TILE_DAYS} days' ORDER BY path, first_seen, key`,
  );
  return r.rows.map((x) => ({ path: x.path, key: x.key, title: x.title, kind: x.kind, kpiId: x.kpi_id, summary: x.summary, value: x.value, at: x.at }));
}

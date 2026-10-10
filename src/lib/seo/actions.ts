// DID THE WORK ACTUALLY WORK.
//
// The queue says what to do and what it is worth. Until now nothing ever looked
// back, so nobody could say which advice was good — and advice nobody can grade
// is advice people quietly stop following.
//
// So: when somebody starts an item, the page's numbers at that moment are
// written down. After a waiting period, the same page is read again from Search
// Console and the two are compared. The baseline is captured at the START and
// never recomputed, because the reporting window moves and a "before" measured
// afterwards is not a before.
//
// What this is careful NOT to claim: that the work caused the change. Search
// moves on its own — a competitor publishes, an algorithm updates, demand is
// seasonal. A verdict here says what happened after the work, not because of
// it, and the page says so in those words.

import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import type { SeoAction, SeoActionInput } from "./actionModel";

type Row = {
  id: number; item_id: string; source: string; subject: string; action: string;
  euros_estimated: string | null; baseline_clicks: number | null;
  baseline_impressions: number | null; baseline_position: string | null;
  window_days: number; started_by: string; started_at: string;
  measured_at: string | null; after_clicks: number | null;
  after_impressions: number | null; after_position: string | null;
  dropped_at: string | null; dropped_reason: string | null;
};

const num = (v: string | number | null) => (v === null ? null : Number(v));

const toAction = (r: Row): SeoAction => ({
  id: r.id,
  itemId: r.item_id,
  source: r.source,
  subject: r.subject,
  action: r.action,
  eurosEstimated: num(r.euros_estimated),
  baselineClicks: r.baseline_clicks,
  baselineImpressions: r.baseline_impressions,
  baselinePosition: num(r.baseline_position),
  windowDays: r.window_days,
  startedBy: r.started_by,
  startedAt: new Date(r.started_at).toISOString(),
  measuredAt: r.measured_at ? new Date(r.measured_at).toISOString() : null,
  afterClicks: r.after_clicks,
  afterImpressions: r.after_impressions,
  afterPosition: num(r.after_position),
  droppedAt: r.dropped_at ? new Date(r.dropped_at).toISOString() : null,
  droppedReason: r.dropped_reason,
});

const COLUMNS = `id, item_id, source, subject, action, euros_estimated, baseline_clicks,
  baseline_impressions, baseline_position, window_days, started_by, started_at,
  measured_at, after_clicks, after_impressions, after_position, dropped_at, dropped_reason`;

/**
 * Start one. Starting the same item twice while the first is still open is a
 * misclick, not a second piece of work, so it returns the open one instead.
 */
export async function startAction(input: SeoActionInput, username: string): Promise<SeoAction> {
  await ensureSchema();
  const open = await query<Row>(
    `SELECT ${COLUMNS} FROM apsomh_seo_actions
      WHERE item_id = $1 AND measured_at IS NULL AND dropped_at IS NULL
      ORDER BY started_at DESC LIMIT 1`,
    [input.itemId],
  );
  if (open.rows[0]) return toAction(open.rows[0]);

  const r = await query<Row>(
    `INSERT INTO apsomh_seo_actions
       (item_id, source, subject, action, euros_estimated, baseline_clicks,
        baseline_impressions, baseline_position, window_days, started_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING ${COLUMNS}`,
    [
      input.itemId, input.source, input.subject, input.action,
      input.eurosEstimated, input.baselineClicks, input.baselineImpressions,
      input.baselinePosition, input.windowDays, username,
    ],
  );
  return toAction(r.rows[0]);
}

export async function listActions(limit = 200): Promise<SeoAction[]> {
  await ensureSchema();
  const r = await query<Row>(
    `SELECT ${COLUMNS} FROM apsomh_seo_actions ORDER BY started_at DESC LIMIT $1`,
    [limit],
  );
  return r.rows.map(toAction);
}

/** The after-reading, taken from Search Console rather than from anybody's view. */
export async function measureAction(
  id: number,
  after: { clicks: number | null; impressions: number | null; position: number | null },
): Promise<SeoAction | null> {
  await ensureSchema();
  const r = await query<Row>(
    `UPDATE apsomh_seo_actions
        SET measured_at = NOW(), after_clicks = $2, after_impressions = $3, after_position = $4
      WHERE id = $1 AND measured_at IS NULL AND dropped_at IS NULL
      RETURNING ${COLUMNS}`,
    [id, after.clicks, after.impressions, after.position],
  );
  return r.rows[0] ? toAction(r.rows[0]) : null;
}

/** Abandoned, with the reason — the playbook's "what we decided not to do". */
export async function dropAction(id: number, reason: string): Promise<SeoAction | null> {
  await ensureSchema();
  const r = await query<Row>(
    `UPDATE apsomh_seo_actions
        SET dropped_at = NOW(), dropped_reason = $2
      WHERE id = $1 AND measured_at IS NULL AND dropped_at IS NULL
      RETURNING ${COLUMNS}`,
    [id, reason.slice(0, 500)],
  );
  return r.rows[0] ? toAction(r.rows[0]) : null;
}


export * from "./actionModel";

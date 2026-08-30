// Who is working in this hub right now, from its own audit trail. Every row
// is an event the app recorded; there is no session tracking beyond that.

import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";

export type HubActor = { actor: string; actions: number; lastAt: string };
export type HubEvent = { actor: string; action: string; at: string; target: string | null };

export type HubActivity = {
  minutes: number;
  since: string;
  actors: HubActor[];
  recent: HubEvent[];
  /** Content rows updated in the period — a second signal of activity. */
  contentTouched: number;
};

type AuditRow = { actor: string | null; action: string; detail: Record<string, unknown> | null; created_at: Date };

const MAX_MINUTES = 24 * 60;
const MAX_EVENTS = 200;

function targetOf(detail: Record<string, unknown> | null): string | null {
  if (!detail) return null;
  for (const key of ["title", "name", "target", "channel", "id"]) {
    const v = detail[key];
    if (typeof v === "string" && v.length > 0) return v.length > 80 ? `${v.slice(0, 79)}…` : v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

export async function hubActivity(minutes = 60): Promise<HubActivity> {
  await ensureSchema();
  const span = Math.min(Math.max(Math.floor(minutes), 1), MAX_MINUTES);
  const since = new Date(Date.now() - span * 60_000);

  const events = await query<AuditRow>(
    `SELECT actor, action, detail, created_at FROM apsomh_audit
     WHERE created_at >= $1
     ORDER BY created_at DESC
     LIMIT ${MAX_EVENTS}`,
    [since],
  );
  const touched = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM apsomh_content WHERE updated_at >= $1`,
    [since],
  );

  const byActor = new Map<string, HubActor>();
  const recent: HubEvent[] = [];
  for (const row of events.rows) {
    const actor = row.actor && row.actor.length > 0 ? row.actor : "system";
    const at = new Date(row.created_at).toISOString();
    recent.push({ actor, action: row.action, at, target: targetOf(row.detail) });
    const cur = byActor.get(actor);
    if (cur) cur.actions += 1;
    else byActor.set(actor, { actor, actions: 1, lastAt: at });
  }

  return {
    minutes: span,
    since: since.toISOString(),
    actors: [...byActor.values()].sort((a, b) => b.actions - a.actions),
    recent,
    contentTouched: Number(touched.rows[0]?.n ?? 0),
  };
}

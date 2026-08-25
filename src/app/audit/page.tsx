import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import AuditLog, { type AuditEvent } from "./AuditLog";

export const dynamic = "force-dynamic";

/** Row cap — the log is read in full, newest first, up to this many rows. */
const MAX_ROWS = 500;

type AuditRow = {
  id: number;
  actor: string | null;
  action: string;
  detail: unknown;
  created_at: Date | string;
};

/**
 * The `detail` column is free-form jsonb. Surface a human-readable target when
 * the payload carries one under a conventional key; never invent one.
 */
function extractTarget(detail: unknown): string | null {
  if (typeof detail === "string") return detail.slice(0, 300) || null;
  if (typeof detail === "number" || typeof detail === "boolean") return String(detail);
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const record = detail as Record<string, unknown>;
    for (const key of ["target", "title", "subject", "path", "name", "id", "contentId"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.slice(0, 300);
      if (typeof value === "number") return String(value);
    }
  }
  return null;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export default async function AuditPage() {
  let events: AuditEvent[] = [];
  let error: string | null = null;

  try {
    await ensureSchema();
    const result = await query<AuditRow>(
      `SELECT id, actor, action, detail, created_at
         FROM apsomh_audit
        ORDER BY created_at DESC, id DESC
        LIMIT $1`,
      [MAX_ROWS],
    );
    events = result.rows.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      target: extractTarget(row.detail),
      detail: row.detail === null || row.detail === undefined ? null : JSON.stringify(row.detail, null, 2),
      createdAt: toIso(row.created_at),
    }));
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return <AuditLog events={events} error={error} limit={MAX_ROWS} />;
}

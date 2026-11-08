// OTHER APPS ON THE CONTENT CALENDAR (08.11.2026) - the rules are in ./calendarEventRules.ts.
// A server function, no route: AI testing & personalization (lib/convert) calls putCalendarEvent when a page test
// starts, its end is planned or a winner is published; the calendar page reads eventsBetween through
// GET /api/content/calendar/events. Upsert by (source, key), so a moved date is put again.

import { query } from "@/lib/db/client";
import { eventFrom, type CalendarEvent, type CalendarEventInput, type EventSource } from "./calendarEventRules";

export type { CalendarEvent, CalendarEventInput, CalendarEventKind, EventSource } from "./calendarEventRules";

let ready: Promise<void> | null = null;
function ensureEvents(): Promise<void> {
  ready ??= (async () => {
    // the day is TEXT "YYYY-MM-DD" on purpose: a DATE read back as a Date lands a day early in Zurich (calendar.ts)
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content_calendar_events (
        source VARCHAR(16) NOT NULL,
        key VARCHAR(200) NOT NULL,
        kind VARCHAR(32) NOT NULL,
        day VARCHAR(10) NOT NULL,
        title VARCHAR(200) NOT NULL,
        href VARCHAR(500) NOT NULL,
        env VARCHAR(8),
        path VARCHAR(400),
        test_id VARCHAR(12),
        project_id INTEGER,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (source, key)
      )`);
    await query(`CREATE INDEX IF NOT EXISTS apsomh_content_calendar_events_day ON apsomh_content_calendar_events (day)`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

/** The Content project made from this test (its brief carries "[APSOconvert page env:path test:<id>]"), if any. */
async function projectOfTest(testId: string): Promise<number | null> {
  const r = await query<{ id: number }>(
    `SELECT id FROM apsomh_content_projects WHERE brief LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`%[APSOconvert page %test:${testId}]%`],
  );
  return r.rows[0] ? Number(r.rows[0].id) : null;
}

/** Puts an entry on the calendar, or moves it (same source + key). Throws on a refused entry. */
export async function putCalendarEvent(input: CalendarEventInput): Promise<void> {
  const v = eventFrom(input);
  if (!v.ok) throw new Error(`Content calendar: ${v.error}`);
  await ensureEvents();
  const e = v.event;
  const projectId = e.projectId ?? (e.testId ? await projectOfTest(e.testId).catch(() => null) : null);
  await query(
    `INSERT INTO apsomh_content_calendar_events (source, key, kind, day, title, href, env, path, test_id, project_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (source, key) DO UPDATE SET kind = EXCLUDED.kind, day = EXCLUDED.day, title = EXCLUDED.title, href = EXCLUDED.href,
       env = EXCLUDED.env, path = EXCLUDED.path, test_id = EXCLUDED.test_id, project_id = EXCLUDED.project_id, updated_at = NOW()`,
    [e.source, e.key, e.kind, e.day, e.title, e.href, e.env, e.path, e.testId, projectId],
  );
}

/** Takes an entry off the calendar (nothing happens when it is not there). */
export async function removeCalendarEvent(source: EventSource, key: string): Promise<void> {
  await ensureEvents();
  await query(`DELETE FROM apsomh_content_calendar_events WHERE source = $1 AND key = $2`, [source, String(key)]);
}

type Row = { source: string; key: string; kind: string; day: string; title: string; href: string; env: string | null; path: string | null; test_id: string | null; project_id: number | null };

/** The entries from one day to another, both included ("YYYY-MM-DD"). */
export async function eventsBetween(from: string, to: string): Promise<CalendarEvent[]> {
  await ensureEvents();
  const r = await query<Row>(
    `SELECT source, key, kind, day, title, href, env, path, test_id, project_id FROM apsomh_content_calendar_events
      WHERE day >= $1 AND day <= $2 ORDER BY day, title LIMIT 500`,
    [from, to],
  );
  return r.rows.map((x) => ({
    source: x.source as CalendarEvent["source"], key: x.key, kind: x.kind as CalendarEvent["kind"], day: x.day, title: x.title, href: x.href,
    env: x.env === "prod" || x.env === "acc" ? x.env : null, path: x.path, testId: x.test_id, projectId: x.project_id === null ? null : Number(x.project_id),
  }));
}

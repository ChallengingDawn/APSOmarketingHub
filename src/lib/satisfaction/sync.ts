// SATISFACTION - the hub's copy of every HubSpot survey answer (SARCLA 27.10.2026: the Satisfaction KPI page and the
// APSOassistant Chat page's Satisfaction tab). ~4,700 answers a year are too many to read on every page view under
// HubSpot's search limit, so a job keeps them in apsomh_feedback: every 30 minutes the answers changed since the last
// look, oldest first, 200 a call and paced - the first run after a deploy fills the backfill over a few runs. An answer
// without a country of its own gets its contact's. The rules that place an answer (touchpoint, language, country,
// sentiment) are read at view time (rules.ts), so a rule changed applies to every answer at once.
// Needs the hub app's crm.objects.feedback_submissions.read (build #40, 27.10.2026). SATISFACTION=off stops the job.

import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";

const TABLE = "apsomh_feedback";
const LOCK = 4_107_248;
const EVERY_MS = 30 * 60_000;
const PER_RUN_PAGES = 40;                      // 8,000 answers a run at most
const PACE_MS = 350;                           // under HubSpot's search limit (~4 a second)
const FROM = Date.parse("2024-01-01T00:00:00Z");
const KV = { cursor: "satisfaction:cursor", run: "satisfaction:lastRun" };
const PROPS = ["hs_survey_name", "hs_survey_type", "hs_survey_channel", "hs_form_guid", "hs_value", "hs_sentiment", "hs_response_group",
  "country", "hs_contact_id", "hs_chatflow_name", "hs_ticket_id", "hs_ticket_pipeline", "hs_conversation_thread_id",
  "hs_content", "hs_negative_follow_up", "hs_neutral_follow_up", "hs_positive_follow_up", "hs_submission_url", "hs_createdate", "hs_lastmodifieddate"];

let ready: Promise<void> | null = null;
export function ensure(): Promise<void> {
  ready ??= (async () => {
    await query(`CREATE TABLE IF NOT EXISTS ${TABLE} (
      id text PRIMARY KEY, created_at timestamptz NOT NULL, modified_at timestamptz,
      survey_name text, survey_type text, channel text, form_guid text,
      value numeric, sentiment text, response_group text,
      country text, contact_id text, contact_country text, chatflow text,
      ticket_id text, ticket_pipeline text, thread_id text, comment text, submission_url text,
      synced_at timestamptz NOT NULL DEFAULT now())`);
    await query(`CREATE INDEX IF NOT EXISTS ${TABLE}_created ON ${TABLE} (created_at)`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export type SyncRun = { at: string; ok: boolean; read: number; contacts: number; cursor: string | null; done: boolean; error?: string };
type Sub = { id: string; properties: Record<string, string | null> };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const str = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** One run: the answers changed since the cursor, oldest first; the cursor moves with every page kept. */
export async function syncOnce(): Promise<SyncRun> {
  await ensure();
  const at = new Date().toISOString();
  let cursor = Number(await kvGet<number>(KV.cursor).catch(() => null)) || FROM;
  // the filter stays put while paging: "after" is an offset into ONE result set - moved with the cursor, it skips answers
  let from = cursor;
  let read = 0, contacts = 0, done = false, after: string | undefined;
  try {
    for (let page = 0; page < PER_RUN_PAGES; page++) {
      const r = await hubspotRetry<{ results?: Sub[]; paging?: { next?: { after?: string } } }>({
        path: "/crm/v3/objects/feedback_submissions/search", method: "POST",
        body: { filterGroups: [{ filters: [{ propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(from) }] }],
          properties: PROPS, sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }], limit: 200, ...(after ? { after } : {}) },
      });
      const rows = r.results ?? [];
      for (const s of rows) {
        const p = s.properties;
        const comment = [p.hs_content, p.hs_negative_follow_up, p.hs_neutral_follow_up, p.hs_positive_follow_up].map(str).filter(Boolean).join(" · ") || null;
        await query(
          `INSERT INTO ${TABLE} (id, created_at, modified_at, survey_name, survey_type, channel, form_guid, value, sentiment, response_group,
             country, contact_id, chatflow, ticket_id, ticket_pipeline, thread_id, comment, submission_url, synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
           ON CONFLICT (id) DO UPDATE SET modified_at = $3, survey_name = $4, survey_type = $5, channel = $6, form_guid = $7, value = $8,
             sentiment = $9, response_group = $10, country = $11, contact_id = $12, chatflow = $13, ticket_id = $14, ticket_pipeline = $15,
             thread_id = $16, comment = $17, submission_url = $18, synced_at = now()`,
          [s.id, p.hs_createdate, p.hs_lastmodifieddate, str(p.hs_survey_name), str(p.hs_survey_type), str(p.hs_survey_channel), str(p.hs_form_guid),
            p.hs_value === null || p.hs_value === "" ? null : Number(p.hs_value), str(p.hs_sentiment), str(p.hs_response_group), str(p.country),
            str(p.hs_contact_id), str(p.hs_chatflow_name), str(p.hs_ticket_id), str(p.hs_ticket_pipeline), str(p.hs_conversation_thread_id), comment,
            str(p.hs_submission_url)]);
        const m = Date.parse(p.hs_lastmodifieddate ?? "");
        if (m > cursor) cursor = m;
      }
      read += rows.length;
      await kvSet(KV.cursor, cursor);
      after = r.paging?.next?.after;
      if (!after) { done = true; break; }
      if (Number(after) >= 9_800) { after = undefined; from = cursor; }   // HubSpot's search stops at 10,000 results: go on from the cursor
      await sleep(PACE_MS);
    }
    contacts = await fillContactCountries();
    const run: SyncRun = { at, ok: true, read, contacts, cursor: new Date(cursor).toISOString(), done };
    await kvSet(KV.run, run);
    return run;
  } catch (e) {
    const run: SyncRun = { at, ok: false, read, contacts, cursor: new Date(cursor).toISOString(), done, error: String((e as Error).message).slice(0, 200) };
    await kvSet(KV.run, run).catch(() => {});
    return run;
  }
}

/** The answers without a country of their own: their contact's country, 100 contacts a call. */
async function fillContactCountries(): Promise<number> {
  const rows = (await query<{ contact_id: string }>(
    `SELECT DISTINCT contact_id FROM ${TABLE} WHERE country IS NULL AND contact_id IS NOT NULL AND contact_country IS NULL LIMIT 1000`)).rows;
  let n = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const ids = rows.slice(i, i + 100).map((r) => r.contact_id);
    const r = await hubspotRetry<{ results?: { id: string; properties: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/contacts/batch/read", method: "POST", body: { inputs: ids.map((id) => ({ id })), properties: ["country"] },
    });
    for (const c of r.results ?? []) {
      // "" = asked, the contact has none - not asked again
      await query(`UPDATE ${TABLE} SET contact_country = $2 WHERE contact_id = $1 AND country IS NULL`, [c.id, str(c.properties.country) ?? ""]);
      n++;
    }
    const missing = ids.filter((id) => !(r.results ?? []).some((c) => c.id === id));
    if (missing.length) await query(`UPDATE ${TABLE} SET contact_country = '' WHERE contact_id = ANY($1) AND country IS NULL`, [missing]);
    await sleep(PACE_MS);
  }
  return n;
}

export async function lastRun(): Promise<SyncRun | null> {
  return (await kvGet<SyncRun>(KV.run).catch(() => undefined)) ?? null;
}

async function tick(): Promise<void> {
  let client;
  try { client = await getPool().connect(); } catch (e) { console.warn(`[satisfaction] tick skipped: ${(e as Error).message}`); return; }
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return;                          // the other copy is reading
    try {
      const r = await syncOnce();
      console.log(`[satisfaction] ${r.ok ? "" : "FAILED - "}${r.read} answers read, ${r.contacts} contact countries${r.done ? "" : " - more next run"}${r.error ? ` · ${r.error}` : ""}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false;
export function startSatisfaction(): void {
  if (started || String(process.env.SATISFACTION ?? "").toLowerCase() === "off") return;
  started = true;
  console.log("[satisfaction] on: HubSpot's survey answers copied every 30 min");
  setInterval(() => void tick(), EVERY_MS).unref?.();
  setTimeout(() => void tick(), 3 * 60_000).unref?.();     // after the boot rush
}

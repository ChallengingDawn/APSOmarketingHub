// SATISFACTION - the answers a page reads, from the hub's copy of the survey answers (sync.ts), each placed once by
// rules.ts and packed small (answers.ts): the page does the periods, the filters, the same days a year earlier and the
// companies behind a graph itself (SARCLA 01.11.2026: "rebuild like Visits"). A touchpoint filter gives the chat's own
// view (APSOassistant Chat > Satisfaction) - with the chat page's window as its period.

import { query } from "@/lib/db/client";
import { ensure, lastRun } from "./sync";
import { FIRST_DAY, dayOf, isoOf, packAnswers, yearBack, type FeedbackRow, type SatisfactionData } from "./answers";
import type { Touchpoint } from "./rules";

export type { SatisfactionData } from "./answers";

/** Not customers' answers: three probes of the shop chat's survey endpoint sent by the hub's developer on 27.10.2026
 *  19:01 UTC (no contact, comment "x") - HubSpot's survey answers cannot be deleted through its API. */
const NOT_ANSWERS = new Set(["1420532444381", "1420706770157", "1420552270050"]);

/** A moment's day in Zurich, yyyymmdd. */
const zurichDay = (t: Date) => dayOf(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(t));

const cache = new Map<string, { at: number; d: SatisfactionData }>();

/**
 * The answers a page reads. `fromIso` given (the chat page's window): that day to today is the period, and the same days
 * a year earlier come with it. None (Satisfaction KPIs): this year and the two before - the page picks its period, and
 * any period of them has its year earlier along (the copy itself starts in 2024).
 */
export async function satisfactionData(fromIso: string | null, touchpoints: Touchpoint[] | null = null): Promise<SatisfactionData> {
  const today = zurichDay(new Date());
  const asked = fromIso ? Math.min(today, zurichDay(new Date(fromIso))) : null;
  const first = Math.max(FIRST_DAY, asked ? yearBack(asked) : (Math.floor(today / 10000) - 2) * 10000 + 101);
  const ck = `${first}:${asked ?? ""}:${today}:${touchpoints?.join(",") ?? "all"}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.d;
  await ensure();
  const rows = (await query<FeedbackRow>(
    `SELECT id, to_char(created_at AT TIME ZONE 'Europe/Zurich', 'YYYYMMDD')::int AS day, survey_name, form_guid, value, sentiment,
            response_group, country, contact_id, contact_country, submission_url, comment, company_id, company_name
       FROM apsomh_feedback WHERE created_at >= ($1::date::timestamp AT TIME ZONE 'Europe/Zurich') ORDER BY created_at`, [isoOf(first)])).rows;
  const d = packAnswers(rows.filter((x) => !NOT_ANSWERS.has(x.id)).map((x) => ({ ...x, day: Number(x.day) })),
    { today, first, asked, touchpoints, generatedAt: new Date().toISOString(), run: await lastRun() });
  cache.set(ck, { at: Date.now(), d });
  return d;
}

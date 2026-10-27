// SATISFACTION - the figures of a period, from the hub's copy of the survey answers (sync.ts) placed by rules.ts:
// the totals (CSAT = happy share, NPS apart), month by month, and per touchpoint, country, language and locale; the
// customers' own words, the unhappy ones first. A touchpoint filter gives the chat's own view (APSOassistant Chat).

import { query } from "@/lib/db/client";
import { ensure, lastRun, type SyncRun } from "./sync";
import { COUNTRY_LABEL, LANGUAGE_LABEL, TOUCHPOINT_LABEL, add, countryIso, csat, emptyTally, languageOf, localeOf, nps, readingOf, storeViewOf,
  touchpointOf, type Sentiment, type Tally, type Touchpoint } from "./rules";

export type Group = { key: string; label: string; tally: Tally; csat: number | null; nps: number | null };
export type Comment = { at: string; touchpoint: string; sentiment: Sentiment | null; nps: string | null; language: string | null; country: string | null; text: string };
export type SatisfactionData = {
  from: string; touchpoints: Touchpoint[] | null;
  total: Group; months: Group[];
  byTouchpoint: Group[]; byCountry: Group[]; byLanguage: Group[]; byLocale: Group[];
  comments: Comment[]; commentsTotal: number;
  /** answers with no store view, no country of their own nor their contact's */
  noCountry: number;
  run: SyncRun | null;
};

type Row = { id: string; created_at: string; survey_name: string | null; form_guid: string | null; value: string | null; sentiment: string | null;
  response_group: string | null; country: string | null; contact_country: string | null; submission_url: string | null; comment: string | null };

/** Not customers' answers: three probes of the shop chat's survey endpoint sent by the hub's developer on 27.10.2026
 *  19:01 UTC (no contact, comment "x") - HubSpot's survey answers cannot be deleted through its API. */
const NOT_ANSWERS = new Set(["1420532444381", "1420706770157", "1420552270050"]);

/** No e-mail address or phone number of a customer on the page, also inside a comment. */
const scrub = (s: string) => s.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]").replace(/\+?\d[\d\s/().-]{7,}\d/g, "[phone]");

const cache = new Map<string, { at: number; d: SatisfactionData }>();

export async function satisfactionData(fromIso: string, touchpoints: Touchpoint[] | null = null): Promise<SatisfactionData> {
  const ck = `${fromIso.slice(0, 13)}:${touchpoints?.join(",") ?? "all"}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.d;
  await ensure();
  const rows = (await query<Row>(
    `SELECT id, created_at, survey_name, form_guid, value, sentiment, response_group, country, contact_country, submission_url, comment
       FROM apsomh_feedback WHERE created_at >= $1 ORDER BY created_at DESC`, [fromIso])).rows;
  const groups = { tp: new Map<string, Group>(), country: new Map<string, Group>(), lang: new Map<string, Group>(), locale: new Map<string, Group>(), month: new Map<string, Group>() };
  const put = (m: Map<string, Group>, key: string, label: string, r: ReturnType<typeof readingOf>) => {
    const g = m.get(key) ?? { key, label, tally: emptyTally(), csat: null, nps: null };
    add(g.tally, r); m.set(key, g);
  };
  const total: Group = { key: "all", label: "All", tally: emptyTally(), csat: null, nps: null };
  const comments: Comment[] = [];
  let noCountry = 0;
  for (const x of rows) {
    if (NOT_ANSWERS.has(x.id)) continue;
    const tp = touchpointOf(x.survey_name, x.form_guid);
    if (touchpoints && !touchpoints.includes(tp)) continue;
    const r = readingOf({ surveyName: x.survey_name, sentiment: x.sentiment, value: x.value, group: x.response_group });
    const view = storeViewOf(x.submission_url);
    const lang = languageOf(x.survey_name) ?? view?.language ?? null;
    const country = view?.country ?? countryIso(x.country) ?? countryIso(x.contact_country);
    if (!country) noCountry++;
    const locale = view ? `${view.language}-${view.country}` : localeOf(lang, country);
    add(total.tally, r);
    put(groups.tp, tp, TOUCHPOINT_LABEL[tp], r);
    put(groups.country, country ?? "?", country ? COUNTRY_LABEL[country] ?? country : "Not known", r);
    put(groups.lang, lang ?? "?", lang ? LANGUAGE_LABEL[lang] ?? lang : "Not known", r);
    if (locale) put(groups.locale, locale, locale, r);
    put(groups.month, new Date(x.created_at).toISOString().slice(0, 7), "", r);   // pg gives a Date: its ISO month
    if (x.comment) comments.push({ at: new Date(x.created_at).toISOString(), touchpoint: TOUCHPOINT_LABEL[tp], sentiment: r.sentiment, nps: r.nps, language: lang, country, text: scrub(x.comment).slice(0, 600) });
  }
  const done = (m: Map<string, Group>) => [...m.values()].map((g) => ({ ...g, csat: csat(g.tally), nps: nps(g.tally) })).sort((a, b) => b.tally.answers - a.tally.answers);
  const order: Record<string, number> = { unhappy: 0, detractor: 0, neutral: 1, passive: 1, happy: 2, promoter: 2 };
  comments.sort((a, b) => (order[a.sentiment ?? a.nps ?? ""] ?? 3) - (order[b.sentiment ?? b.nps ?? ""] ?? 3) || b.at.localeCompare(a.at));
  const d: SatisfactionData = {
    from: fromIso, touchpoints,
    total: { ...total, csat: csat(total.tally), nps: nps(total.tally) },
    months: done(groups.month).map((g) => ({ ...g, label: g.key })).sort((a, b) => a.key.localeCompare(b.key)),
    byTouchpoint: done(groups.tp), byCountry: done(groups.country), byLanguage: done(groups.lang), byLocale: done(groups.locale),
    // all of them (the page shows 20 at a time) - at most 3,000, ~1,600 a year
    comments: comments.slice(0, 3000), commentsTotal: comments.length, noCountry,
    run: await lastRun(),
  };
  cache.set(ck, { at: Date.now(), d });
  return d;
}

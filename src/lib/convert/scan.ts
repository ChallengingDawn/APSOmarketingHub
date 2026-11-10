// APSOconvert > THE NIGHT SCAN - the AI reads the pages losing buyers by itself, so Insights holds ready optimizations
// in the morning, the way Webyn's Insight Agent works (SARCLA 08.11.2026: "the AI already sees optimizations and
// proposes"; asked how much: "5 pages per night and if the others are not pressed cap at 30").
//   - once a night (01:00-05:00 Swiss), checked every hour; one hub task does it (an advisory lock + a row per day)
//   - the worst pages of the last 28 days on the problem list (most add-to-carts missed first), production only,
//     pages that have no idea yet
//   - at most 5 pages a night, and none while 30 of the AI's ideas wait for a person's yes or no
//   - the same AI call as a person's click (proposeIdeas: the page's reading + 3-5 ideas with their blocks), inside the
//     hub's daily AI budget; nothing reaches the shop - the ideas wait on Insights for a person
// Beside it, every hour at any time of day (./scanRules.ts TOPUP): the types' own top-up - SEO landing page, Banner,
// Newsletter each get a batch when fewer than 3 of them wait (once a day per type) - and the English pass: what the AI
// wrote before "everything in English" is put into English (studio.ts englishPass).
// CONVERT_SCAN=off stops all of it.

import { getPool, query } from "@/lib/db/client";
import { STEP_LABEL, sortProblems, type Step } from "./model";
import { buildProblems } from "./problems";
import { englishPass, pageWork, proposeIdeas, type Numbers } from "./studio";
import { SCAN, TOPUP, pagesTonight, swissNow, typesToTopUp, type TopUpType } from "./scanRules";
import { blockByKey } from "./blocks";
import { buildSeo } from "./seo";
import { seoLine } from "./seoRules";
import { typeOfIdea } from "./changeTypes";

const LOCK = 4_107_263;
const DAY_LOCK = 4_107_264;
const TICK_MS = 60 * 60_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_convert_scans (
  day date PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL DEFAULT ''
);`;

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

const TOPUP_SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_convert_topups (
  day date NOT NULL,
  type text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '',
  PRIMARY KEY (day, type)
);`;

/** How many optimizations of each type wait for a person's yes or no. */
export async function waitingByType(): Promise<Record<string, number>> {
  const r = await query<{ content_type: string | null; block: string | null; n: string }>(
    `SELECT content_type, block, count(*) AS n FROM apsomh_convert_ideas WHERE status = 'proposed' GROUP BY content_type, block`);
  const out: Record<string, number> = {};
  for (const x of r.rows) {
    const t = typeOfIdea({ contentType: x.content_type, block: x.block });
    out[t] = (out[t] ?? 0) + Number(x.n);
  }
  return out;
}

/** One type's batch: the slider's or the newsletter band's optimizations, or new landing pages from Google's searches. */
async function topUpOne(t: TopUpType, by: string): Promise<string> {
  if (t === "banner" || t === "newsletter") {
    const b = blockByKey(t === "banner" ? "home-slider" : "newsletter");
    if (!b) return "no such block";
    const r = await proposeIdeas("prod", b.page, null, by, null, { key: b.key, name: b.name, selector: b.selector, about: b.about, goal: b.goal });
    return r.ok ? `${r.data.length} for the ${b.name.toLowerCase()}` : r.error;
  }
  // new landing pages: the pages Google shows for searches they answer badly, the most clicks missed first (Search
  // Console is two days behind); a page that has its landing pages already is skipped
  const to = isoDay(Date.now() - 3 * 86_400_000);
  const from = isoDay(Date.parse(to) - 27 * 86_400_000);
  const seo = await buildSeo(from, to);
  if (seo.error) return `Search Console did not answer (${seo.error})`;
  const problems = seo.rows.filter((r) => r.reasons.length > 0);
  const made: string[] = [];
  for (const row of [...problems.filter((r) => r.queries.length > 0), ...problems.filter((r) => r.queries.length === 0)]) {
    if (made.length >= TOPUP.seoPages) break;
    const work = await pageWork("prod", row.path);
    if (work.ideas.some((i) => i.contentType === "landing-page" && i.status !== "dropped")) continue;
    const numbers: Numbers = { reasons: [...row.reasons, seoLine(row, from, to)].slice(0, 4), from, to };
    const r = await proposeIdeas("prod", row.path, numbers, by, null, null, true);
    if (!r.ok) {
      if (/times today/.test(r.error)) break;
      continue;
    }
    made.push(`${r.data.length} from ${row.path}`);
  }
  return made.length ? `new landing pages: ${made.join(", ")}` : "no page Google shows for searches it answers badly";
}

/** The types under their waiting mark get their batch - each at most once a day (marked first: a failure waits a day). */
export async function runTopUp(by = "the AI's daily top-up"): Promise<string[]> {
  await query(TOPUP_SCHEMA);
  const day = swissNow().day;
  const done = (await query<{ type: string }>(`SELECT type FROM apsomh_convert_topups WHERE day = $1`, [day])).rows.map((r) => r.type);
  const notes: string[] = [];
  for (const t of typesToTopUp(await waitingByType(), done)) {
    const mine = await query<{ type: string }>(`INSERT INTO apsomh_convert_topups (day, type, note) VALUES ($1, $2, 'started') ON CONFLICT (day, type) DO NOTHING RETURNING type`, [day, t]);
    if (!mine.rows.length) continue;
    const note = await topUpOne(t, by).catch((e: Error) => `failed: ${e.message}`);
    await query(`UPDATE apsomh_convert_topups SET at = now(), note = $3 WHERE day = $1 AND type = $2`, [day, t, note.slice(0, 500)]);
    notes.push(`${t}: ${note}`);
  }
  return notes;
}

export async function runScan(by = "the AI's night scan"): Promise<{ read: string[]; note: string }> {
  await query(SCHEMA);
  const waiting = Number((await query<{ n: string }>(`SELECT count(*) AS n FROM apsomh_convert_ideas WHERE status = 'proposed' AND source = 'ai'`)).rows[0]?.n ?? 0);
  const room = pagesTonight(waiting);
  if (room === 0) return { read: [], note: `${waiting} of the AI's optimizations wait for a yes or no - none added until fewer than ${SCAN.waitingCap} wait` };
  const to = isoDay(Date.now() - 86_400_000);
  const from = isoDay(Date.parse(to) - 27 * 86_400_000);
  const data = await buildProblems(from, to);
  if (!data.ga4.ok) return { read: [], note: `Google Analytics did not answer (${data.ga4.error ?? "not connected"})` };
  const worst = (sortProblems(data.pages.filter((p) => p.reasons.length > 0), "missed") as typeof data.pages);
  const read: string[] = [];
  for (const p of worst) {
    if (read.length >= room) break;
    const work = await pageWork("prod", p.path);
    if (work.ideas.length) continue;
    const numbers: Numbers = {
      views: p.views, addToCarts: p.addToCarts, rate: p.rate, typical: p.typical, reasons: p.reasons,
      companies: p.shop?.companies ?? null, lost: p.shop?.lost ?? null, topLoss: p.shop?.topLoss ? STEP_LABEL[p.shop.topLoss as Step] : null, from, to,
    };
    const r = await proposeIdeas("prod", p.path, numbers, by, null);
    if (!r.ok) {
      console.warn(`[convert-scan] ${p.path}: ${r.error}`);
      if (/times today/.test(r.error)) break; // the day's AI budget is spent
      continue;
    }
    read.push(p.path);
    console.log(`[convert-scan] ${p.path}: ${r.data.length} ideas`);
  }
  return { read, note: `${read.length} of ${room} pages read; ${waiting} optimizations were waiting` };
}

/** Every hour, at any time of day: the English pass, then the types' top-up - one hub task at a time. */
async function dayTick(): Promise<void> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [DAY_LOCK]);
    if (!got.rows[0]?.ok) return;
    try {
      const en = await englishPass().catch((e: Error) => ({ ideas: 0, readings: 0, summaries: 0, left: 0, note: `failed: ${e.message}` }));
      if (en.ideas || en.readings || en.summaries || en.left || en.note.startsWith("failed")) console.log(`[convert-english] ${en.note}`);
      const notes = await runTopUp().catch((e: Error) => [`failed: ${e.message}`]);
      for (const n of notes) console.log(`[convert-topup] ${n}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [DAY_LOCK]).catch(() => {});
    }
  } catch (e) {
    console.warn(`[convert-topup] not run: ${(e as Error).message}`);
  } finally {
    client.release();
  }
}

async function tick(): Promise<void> {
  await dayTick();
  const now = swissNow();
  if (now.hour < SCAN.fromHour || now.hour >= SCAN.toHour) return;
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return;
    try {
      await client.query(SCHEMA);
      const done = await client.query(`SELECT 1 FROM apsomh_convert_scans WHERE day = $1`, [now.day]);
      if (done.rowCount) return;
      await client.query(`INSERT INTO apsomh_convert_scans (day, note) VALUES ($1, 'started') ON CONFLICT (day) DO NOTHING`, [now.day]);
      const r = await runScan().catch((e: Error) => ({ read: [] as string[], note: `failed: ${e.message}` }));
      await client.query(`UPDATE apsomh_convert_scans SET at = now(), pages = $2::jsonb, note = $3 WHERE day = $1`, [now.day, JSON.stringify(r.read), r.note.slice(0, 500)]);
      console.log(`[convert-scan] ${now.day}: ${r.note}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } catch (e) {
    console.warn(`[convert-scan] not run: ${(e as Error).message}`);
  } finally {
    client.release();
  }
}

let started = false;
export function startConvertScan() {
  if (started || String(process.env.CONVERT_SCAN ?? "").toLowerCase() === "off") return;
  started = true;
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  setTimeout(() => void tick(), 4 * 60_000).unref?.();
}

/** The last nights, for Insights' line under its filters. */
export async function lastScans(n = 7): Promise<{ day: string; pages: string[]; note: string }[]> {
  await query(SCHEMA);
  const r = await query<{ day: string; pages: string[]; note: string }>(`SELECT to_char(day, 'YYYY-MM-DD') AS day, pages, note FROM apsomh_convert_scans ORDER BY day DESC LIMIT $1`, [n]);
  return r.rows;
}

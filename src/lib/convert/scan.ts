// APSOconvert > THE NIGHT SCAN - the AI reads the pages losing buyers by itself, so Insights holds ready optimizations
// in the morning, the way Webyn's Insight Agent works (SARCLA 08.11.2026: "the AI already sees optimizations and
// proposes"; asked how much: "5 pages per night and if the others are not pressed cap at 30").
//   - once a night (01:00-05:00 Swiss), checked every hour; one hub task does it (an advisory lock + a row per day)
//   - the worst pages of the last 28 days on the problem list (most add-to-carts missed first), production only,
//     pages that have no idea yet
//   - at most 5 pages a night, and none while 30 of the AI's ideas wait for a person's yes or no
//   - the same AI call as a person's click (proposeIdeas: the page's reading + 3-5 ideas with their blocks), inside the
//     hub's daily AI budget; nothing reaches the shop - the ideas wait on Insights for a person
// CONVERT_SCAN=off stops it.

import { getPool, query } from "@/lib/db/client";
import { STEP_LABEL, sortProblems, type Step } from "./model";
import { buildProblems } from "./problems";
import { pageWork, proposeIdeas, type Numbers } from "./studio";
import { SCAN, pagesTonight, swissNow } from "./scanRules";

const LOCK = 4_107_263;
const TICK_MS = 60 * 60_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_convert_scans (
  day date PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL DEFAULT ''
);`;

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

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

async function tick(): Promise<void> {
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
  setTimeout(() => void tick(), 7 * 60_000).unref?.();
}

/** The last nights, for Insights' line under its filters. */
export async function lastScans(n = 7): Promise<{ day: string; pages: string[]; note: string }[]> {
  await query(SCHEMA);
  const r = await query<{ day: string; pages: string[]; note: string }>(`SELECT to_char(day, 'YYYY-MM-DD') AS day, pages, note FROM apsomh_convert_scans ORDER BY day DESC LIMIT $1`, [n]);
  return r.rows;
}

// BACK OFFICE DETECTION FOR ANY PERIOD - the counting (the pure rules are in figures.ts).
//
// Every 30 minutes, one copy of the hub at a time (advisory lock 4107247): each month of Back Office tickets since the
// pipeline began is counted per day - the category each ticket has today, who set it, and whether a person re-filed
// it (its category history) - and kept in kv boDetection:month:<YYYY-MM>. The current month is counted again every 30 minutes,
// the one before every 6 hours, older ones once a week (a person rarely re-files an old ticket). A restart loses at most
// the month being counted. Reads HubSpot only, writes nothing there. BO_DETECTION=off stops it.
// Since 01.11.2026 (store version 4) each ticket also counts for how it came to its topic - the one it came with, the
// hub's reading, a person (figures.ts Journey) - and what changed after intake; the tickets that did not keep their
// intake topic are listed per month (kv boDetection:list:<YYYY-MM>) so a line of the page opens its tickets. The same
// run reads every GQS task for the GQS figures (src/lib/gqsFigures, kv gqsFigures:store).

import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { addFact, dayOf, emptyDay, factOf, mergeDays, monthsOf, monthsSince, previousWindow, sumDays, type DayFig, type Guessed, type Hist, type How, type Journey, type MonthFig, type Win } from "./figures";
import { readGqs } from "../gqsFigures/read";
import type { GqsStore } from "../gqsFigures/figures";

const LOCK = 4_107_247;
const EVERY_MS = 30 * 60_000;
const BO = "1726786777";
/** The Back Office pipeline's first tickets */
const FIRST_MONTH = "2025-03";
const KV = { month: (ym: string) => `boDetection:month:${ym}`, list: (ym: string) => `boDetection:list:${ym}`, dirty: "boDetection:dirty", guessed: "ticketClose:guessed", gqs: "gqsFigures:store" };
const RESOLVED_AT = "hs_v2_date_entered_2338266328";
/** what a month store holds; a store of another version is counted again (2: who set the category; 3: the AI's guess;
 *  4: the journey from intake, what changed after it, the month's list) */
const VERSION = 4;

type MonthStore = { v?: number; at: string; n: number; days: Record<string, DayFig> };
/** A ticket that did not keep the topic it came with: its id, Swiss day, subject, intake topic, today's, how it got there. */
export type ListItem = { id: string; d: string; s: string; i: string; t: string; j: Journey; h: How };
type Obj = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, Hist[]> };

const HOUR = 3_600_000;
function staleAfter(ym: string, now = new Date()): number {
  const cur = monthsSince(ym, now).length; // 1 = this month, 2 = the one before
  return cur <= 1 ? 30 * 60_000 : cur === 2 ? 6 * HOUR : 7 * 24 * HOUR;
}

async function ticketsOfMonth(ym: string): Promise<Obj[]> {
  const [y, m] = ym.split("-").map(Number);
  const from = Date.UTC(y, m - 1, 1), to = Date.UTC(y, m, 1);
  const out: Obj[] = [];
  let cursor = "0";
  for (;;) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
      filterGroups: [{ filters: [
        { propertyName: "hs_pipeline", operator: "EQ", value: BO },
        { propertyName: "createdate", operator: "GTE", value: String(from) },
        { propertyName: "createdate", operator: "LT", value: String(to) },
        { propertyName: "hs_object_id", operator: "GT", value: cursor },
      ] }],
      properties: ["createdate", "enquiry_category", "subject"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) return out;
    cursor = String(res[res.length - 1].id);
  }
}

async function countMonth(ym: string, guessed: Record<string, Guessed>): Promise<{ store: MonthStore; list: ListItem[] }> {
  const tickets = await ticketsOfMonth(ym);
  const days: Record<string, DayFig> = {};
  const list: ListItem[] = [];
  for (let i = 0; i < tickets.length; i += 50) {
    const chunk = tickets.slice(i, i + 50);
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: {
      inputs: chunk.map((t) => ({ id: t.id })), properties: ["enquiry_category", RESOLVED_AT], propertiesWithHistory: ["enquiry_category"],
    } });
    const hist = new Map((j.results ?? []).map((o) => [String(o.id), o]));
    for (const t of chunk) {
      const created = t.properties.createdate;
      if (!created) continue;
      const h = hist.get(String(t.id));
      const k = dayOf(created);
      const f = factOf(h?.properties.enquiry_category ?? t.properties.enquiry_category, h?.propertiesWithHistory?.enquiry_category ?? [], h?.properties[RESOLVED_AT], guessed[String(t.id)], created);
      addFact((days[k] ??= emptyDay()), f);
      if (f.journey !== "kept") list.push({ id: String(t.id), d: k, s: (t.properties.subject ?? "").replace(/\s+/g, " ").trim().slice(0, 110), i: f.intake, t: f.cat, j: f.journey, h: f.how });
    }
  }
  return { store: { v: VERSION, at: new Date().toISOString(), n: tickets.length, days }, list };
}

async function run(): Promise<void> {
  const t0 = Date.now();
  const done: string[] = [];
  let n = 0;
  // months the ticket-close engine wrote into since their last count are counted again now, not next week
  const dirty = new Set((await kvGet<string[]>(KV.dirty)) ?? []);
  const guessed = (await kvGet<Record<string, Guessed>>(KV.guessed)) ?? {};
  for (const ym of monthsSince(FIRST_MONTH).reverse()) {
    const have = await kvGet<MonthStore>(KV.month(ym));
    if (have?.v === VERSION && !dirty.has(ym) && Date.now() - Date.parse(have.at) < staleAfter(ym)) continue;
    const m = await countMonth(ym, guessed);
    await kvSet(KV.list(ym), m.list);
    await kvSet(KV.month(ym), m.store);
    done.push(ym);
    n += m.store.n;
  }
  if (dirty.size) {
    const still = ((await kvGet<string[]>(KV.dirty)) ?? []).filter((ym) => !done.includes(ym));
    await kvSet(KV.dirty, still);
  }
  if (done.length) console.log(`[bo-detection] counted ${done.length} month(s) (${done.join(", ")}) - ${n} Back Office tickets, ${Math.round((Date.now() - t0) / 1000)} s`);
  // the GQS tasks, all of them every run - a failed read keeps the last one
  try {
    await kvSet(KV.gqs, await readGqs());
  } catch (e) { console.warn(`[bo-detection] GQS tasks not read: ${(e as Error).message.slice(0, 200)}`); }
}

export async function runOnce(): Promise<void> {
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return;
    try {
      await run();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false, running = false;
export function startBoDetection() {
  if (started || process.env.BO_DETECTION === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, 4 * EVERY_MS);
    timer.unref?.();
    void runOnce()
      .catch((e) => console.warn(`[bo-detection] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 300_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

export type PeriodFigures = {
  now: Win;
  before: Win;
  /** the period's tickets per month: per topic, per Journey */
  byMonth: MonthFig[];
  /** the first day with a Back Office ticket - a period that starts earlier really starts here */
  since: string | null;
  /** months not counted yet (the first count after a deploy takes a few minutes) */
  missing: string[];
  countedAt: string | null;
};

/** The figures of from..to (inclusive Swiss days) and of the same number of days just before it, from the store. */
export async function periodFigures(from: string, to: string): Promise<PeriodFigures> {
  const prev = previousWindow(from, to);
  const months = monthsSince(FIRST_MONTH);
  // every month in ONE query: twenty kvGets side by side were twenty connections per page load, on a database already
  // at its ceiling (26.10.2026)
  const got = await query<{ k: string; v: MonthStore | string }>("SELECT k, v FROM apsomh_kv WHERE k = ANY($1)", [months.map(KV.month)]);
  const byKey = new Map(got.rows.map((r) => [r.k, typeof r.v === "string" ? (JSON.parse(r.v) as MonthStore) : r.v]));
  const stores = months.map((ym) => byKey.get(KV.month(ym)));
  const missing = months.filter((_, i) => stores[i]?.v !== VERSION);
  const have = stores.filter((s): s is MonthStore => s?.v === VERSION);
  const days = mergeDays(have.map((s) => s.days));
  const countedAt = have.map((s) => s.at).sort()[0] ?? null;
  const keys = Object.keys(days).filter((k) => days[k].n > 0).sort();
  return {
    now: sumDays(days, from, to),
    byMonth: monthsOf(days, from, to),
    before: sumDays(days, prev.from, prev.to),
    since: keys[0] ?? null,
    missing: missing.filter((ym) => ym >= prev.from.slice(0, 7) && ym <= to.slice(0, 7)),
    countedAt,
  };
}

/** Which tickets of a period to list: a "came with -> has today" line, or a journey (open = still Others / empty). */
export type ListPick = { intake?: string; today?: string; journey?: Journey };
const LIST_MAX = 300;

/**
 * The tickets of from..to that did not keep the topic they came with, narrowed to a pick - newest first, at most 300
 * (total says how many there are). Read from the month lists, so it agrees with the figures of the same count.
 */
export async function periodList(from: string, to: string, pick: ListPick): Promise<{ rows: ListItem[]; total: number }> {
  const months = monthsSince(FIRST_MONTH).filter((ym) => ym >= from.slice(0, 7) && ym <= to.slice(0, 7));
  const got = await query<{ k: string; v: ListItem[] | string }>("SELECT k, v FROM apsomh_kv WHERE k = ANY($1)", [months.map(KV.list)]);
  const all = got.rows.flatMap((r) => (typeof r.v === "string" ? (JSON.parse(r.v) as ListItem[]) : r.v) ?? []);
  const keep = all.filter((x) => x.d >= from && x.d <= to
    && (pick.journey === undefined || x.j === pick.journey)
    && (pick.intake === undefined || x.i === pick.intake)
    && (pick.today === undefined || x.t === pick.today))
    .sort((a, b) => b.d.localeCompare(a.d) || b.id.localeCompare(a.id));
  return { rows: keep.slice(0, LIST_MAX), total: keep.length };
}

/** Every GQS task as last read (null until the first run after a release, ~5 minutes). */
export const gqsStore = () => kvGet<GqsStore>(KV.gqs);

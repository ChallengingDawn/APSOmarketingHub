// BACK OFFICE DETECTION FOR ANY PERIOD - the counting (the pure rules are in figures.ts).
//
// Every 30 minutes, one copy of the hub at a time (advisory lock 4107247): each month of Back Office tickets since the
// pipeline began is counted per day - the category each ticket has today, who set it, and whether a person re-filed
// it (its category history) - and kept in kv boDetection:month:<YYYY-MM>. The current month is counted again every 30 minutes,
// the one before every 6 hours, older ones once a week (a person rarely re-files an old ticket). A restart loses at most
// the month being counted. Reads HubSpot only, writes nothing there. BO_DETECTION=off stops it.

import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { addFact, dayOf, emptyDay, factOf, mergeDays, monthsSince, previousWindow, sumDays, type DayFig, type Hist, type Win } from "./figures";

const LOCK = 4_107_247;
const EVERY_MS = 30 * 60_000;
const BO = "1726786777";
/** The Back Office pipeline's first tickets */
const FIRST_MONTH = "2025-03";
const KV = { month: (ym: string) => `boDetection:month:${ym}` };
const RESOLVED_AT = "hs_v2_date_entered_2338266328";
/** what a month store holds; a store of another version is counted again (2: who set the category, 26.10.2026) */
const VERSION = 2;

type MonthStore = { v?: number; at: string; n: number; days: Record<string, DayFig> };
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
      properties: ["createdate", "enquiry_category"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) return out;
    cursor = String(res[res.length - 1].id);
  }
}

async function countMonth(ym: string): Promise<MonthStore> {
  const tickets = await ticketsOfMonth(ym);
  const days: Record<string, DayFig> = {};
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
      addFact((days[k] ??= emptyDay()), factOf(h?.properties.enquiry_category ?? t.properties.enquiry_category, h?.propertiesWithHistory?.enquiry_category ?? [], h?.properties[RESOLVED_AT]));
    }
  }
  return { v: VERSION, at: new Date().toISOString(), n: tickets.length, days };
}

async function run(): Promise<void> {
  const t0 = Date.now();
  const done: string[] = [];
  let n = 0;
  for (const ym of monthsSince(FIRST_MONTH).reverse()) {
    const have = await kvGet<MonthStore>(KV.month(ym));
    if (have?.v === VERSION && Date.now() - Date.parse(have.at) < staleAfter(ym)) continue;
    const m = await countMonth(ym);
    await kvSet(KV.month(ym), m);
    done.push(ym);
    n += m.n;
  }
  if (done.length) console.log(`[bo-detection] counted ${done.length} month(s) (${done.join(", ")}) - ${n} Back Office tickets, ${Math.round((Date.now() - t0) / 1000)} s`);
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
    before: sumDays(days, prev.from, prev.to),
    since: keys[0] ?? null,
    missing: missing.filter((ym) => ym >= prev.from.slice(0, 7) && ym <= to.slice(0, 7)),
    countedAt,
  };
}

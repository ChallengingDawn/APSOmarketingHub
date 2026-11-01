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
// Since 01.11.2026 (store version 5; SARCLA: "we should see the last 365 days in every report, the time filter on top
// should really filter it ... we can back-track") the Back Office's Overview and Tickets are counted here too, for any
// period: the owner each ticket was given when it arrived and what became of it (its owner's history), the hub's rule
// for it (copied from the routing's own record, kept 21 days, into kv boDetection:routed:<YYYY-MM> before it goes),
// whether nobody outside wrote on it, a Delivery's sub-category - and EVERY ticket is on its month's list.

import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { rowsOfDay } from "@/lib/boDistribution/engine";
import {
  WORKFLOW_RULE, addFact, byPersonNow, dayOf, emptyDay, factOf, givenOf, isC2s, mergeDays, monthsOf, monthsSince, ownerDays, ownerJourneyOf, previousWindow, sumDays,
  type DayFig, type Guessed, type Hist, type How, type Journey, type MonthFig, type OwnerJ, type Win,
} from "./figures";
import { readGqs } from "../gqsFigures/read";
import type { GqsStore } from "../gqsFigures/figures";

const LOCK = 4_107_247;
const EVERY_MS = 30 * 60_000;
const BO = "1726786777";
/** The Back Office pipeline's first tickets */
const FIRST_MONTH = "2025-03";
const KV = {
  month: (ym: string) => `boDetection:month:${ym}`, list: (ym: string) => `boDetection:list:${ym}`, routed: (ym: string) => `boDetection:routed:${ym}`,
  dirty: "boDetection:dirty", guessed: "ticketClose:guessed", gqs: "gqsFigures:store",
};
const RESOLVED_AT = "hs_v2_date_entered_2338266328";
const TONE = "sentiment_customer_tone", MACHINE = "not_valid_email";
const DELIVERY_SUB = "enquiry_sub_category___delivery___1";
/** where the routing picks the owner: New, or Redirected from chat */
const ENTERED_NEW = "hs_v2_date_entered_2338266325", ENTERED_REDIRECTED = "hs_v2_date_entered_2554860732";
/** what a month store holds; a store of another version is counted again (2: who set the category; 3: the AI's guess;
 *  4: the journey from intake, what changed after it, the month's list; 5: the owner, the hub's rule, machines,
 *  deliveries - and every ticket listed; 6: the owner given counted from entering New, not from the creation; 7: the
 *  priority and whether a person set it) */
const VERSION = 7;
/** the hub took the routing over from the HubSpot workflows; before, no rule was recorded per ticket */
const HANDOVER = "2026-10-19";
/** the routing's own record is kept this many days (boDistribution DAYS_KEPT) */
const ROUTED_DAYS = 21;

type MonthStore = { v?: number; at: string; n: number; days: Record<string, DayFig> };
/**
 * A ticket of the month: its id, Swiss day, subject, topic at intake, today's, how it got there (j, h); the owner it was
 * given and has today (owner ids, "" = none) and what became of the first (oj); the hub's rule ("" = none recorded).
 */
export type ListItem = { id: string; d: string; s: string; i: string; t: string; j: Journey; h: How; o?: string; n?: string; oj?: OwnerJ; r?: string; p?: string; pp?: boolean };
/** the hub's rule per ticket id, "-" = the hub decided and no rule gave an owner */
type Routed = Record<string, string>;
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

/** The month before and after - a ticket's Swiss day and the routing's day can fall either side of a month's end. */
const nextMonth = (ym: string, by: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + by, 1)); return d.toISOString().slice(0, 7); };

/**
 * The hub's rule for every ticket in the routing's record, kept per month before the record drops it after 21 days -
 * so "Which rule picked" answers for any period since the hub took over (19.10.2026).
 */
async function keepRouted(): Promise<void> {
  const add = new Map<string, Routed>();
  for (let i = 0; i < ROUTED_DAYS; i++) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    for (const r of await rowsOfDay(d)) {
      const ym = dayOf(r.enteredAt).slice(0, 7);
      const m = add.get(ym) ?? {};
      m[String(r.ticketId)] = r.route?.assigner ?? "-";
      add.set(ym, m);
    }
  }
  for (const [ym, m] of add) {
    const have = (await kvGet<Routed>(KV.routed(ym))) ?? {};
    await kvSet(KV.routed(ym), { ...have, ...m });
  }
}

async function countMonth(ym: string, guessed: Record<string, Guessed>): Promise<{ store: MonthStore; list: ListItem[] }> {
  const tickets = await ticketsOfMonth(ym);
  const routed: Routed = {};
  for (const x of [nextMonth(ym, -1), ym, nextMonth(ym, 1)]) Object.assign(routed, (await kvGet<Routed>(KV.routed(x))) ?? {});
  const days: Record<string, DayFig> = {};
  const list: ListItem[] = [];
  for (let i = 0; i < tickets.length; i += 50) {
    const chunk = tickets.slice(i, i + 50);
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: {
      inputs: chunk.map((t) => ({ id: t.id })),
      properties: ["enquiry_category", RESOLVED_AT, "hubspot_owner_id", TONE, DELIVERY_SUB, "c2s_ticket", "c2s_problem_order", ENTERED_NEW, ENTERED_REDIRECTED, "hs_ticket_priority"],
      propertiesWithHistory: ["enquiry_category", "hubspot_owner_id", "hs_ticket_priority"],
    } });
    const hist = new Map((j.results ?? []).map((o) => [String(o.id), o]));
    for (const t of chunk) {
      const created = t.properties.createdate;
      if (!created) continue;
      const id = String(t.id);
      const h = hist.get(id);
      const p = h?.properties ?? {};
      const k = dayOf(created);
      const f = factOf(p.enquiry_category ?? t.properties.enquiry_category, h?.propertiesWithHistory?.enquiry_category ?? [], p[RESOLVED_AT], guessed[id], created);
      const owners = h?.propertiesWithHistory?.hubspot_owner_id ?? [];
      const given = givenOf(owners, p[ENTERED_NEW] ?? p[ENTERED_REDIRECTED] ?? created), now = (p.hubspot_owner_id ?? "").trim();
      const o = {
        given, now, oj: ownerJourneyOf(given, now, owners), rule: routed[id] ?? (k < HANDOVER ? WORKFLOW_RULE : ""), machine: p[TONE] === MACHINE,
        sub: p[DELIVERY_SUB] ?? null, c2s: isC2s(p.c2s_ticket, p.c2s_problem_order, t.properties.subject),
        prio: (p.hs_ticket_priority ?? "").trim(), prioByPerson: byPersonNow(p.hs_ticket_priority, h?.propertiesWithHistory?.hs_ticket_priority ?? []),
      };
      addFact((days[k] ??= emptyDay()), f, o);
      list.push({ id, d: k, s: (t.properties.subject ?? "").replace(/\s+/g, " ").trim().slice(0, 100), i: f.intake, t: f.cat, j: f.journey, h: f.how, o: given, n: now, oj: o.oj, r: o.rule, p: o.prio, pp: o.prioByPerson || undefined });
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
  try { await keepRouted(); } catch (e) { console.warn(`[bo-detection] the routing's rules not kept: ${(e as Error).message.slice(0, 200)}`); }
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
  /** the period's tickets per month: per topic, per Journey, per OwnerJ */
  byMonth: MonthFig[];
  /** the period's tickets day by day, per OwnerJ */
  byDay: { d: string; n: number; oj: Partial<Record<OwnerJ, number>>; pr: Record<string, number> }[];
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
    byDay: ownerDays(days, from, to),
    before: sumDays(days, prev.from, prev.to),
    since: keys[0] ?? null,
    missing: missing.filter((ym) => ym >= prev.from.slice(0, 7) && ym <= to.slice(0, 7)),
    countedAt,
  };
}

/**
 * Which tickets of a period to list: a "came with -> has today" line, a journey (open = still Others / empty), what
 * became of the owner, the owner given, the hub's rule, a Delivery sub-category - and words of the subject or the id.
 */
export type ListPick = { intake?: string; today?: string; journey?: Journey; oj?: OwnerJ; /** owner ids, comma-separated */ given?: string; rule?: string; q?: string; prio?: string; byPerson?: boolean };
const LIST_MAX = 300;

/**
 * The tickets of from..to narrowed to a pick - newest first, at most 300 (total says how many there are), with how
 * many of the picked are in each OwnerJ. Read from the month lists, so it agrees with the figures of the same count.
 */
export async function periodList(from: string, to: string, pick: ListPick): Promise<{ rows: ListItem[]; total: number; oj: Partial<Record<OwnerJ, number>> }> {
  const months = monthsSince(FIRST_MONTH).filter((ym) => ym >= from.slice(0, 7) && ym <= to.slice(0, 7));
  const got = await query<{ k: string; v: ListItem[] | string }>("SELECT k, v FROM apsomh_kv WHERE k = ANY($1)", [months.map(KV.list)]);
  const all = got.rows.flatMap((r) => (typeof r.v === "string" ? (JSON.parse(r.v) as ListItem[]) : r.v) ?? []);
  const q = pick.q?.trim().toLowerCase();
  // one person can be two HubSpot owners (01.11.2026: Leart Asllani) - the page sends every id of the name
  const given = pick.given === undefined ? undefined : new Set(pick.given.split(","));
  const base = all.filter((x) => x.d >= from && x.d <= to
    && (pick.journey === undefined || x.j === pick.journey)
    && (pick.intake === undefined || x.i === pick.intake)
    && (pick.today === undefined || x.t === pick.today)
    && (given === undefined || given.has(x.o ?? ""))
    && (pick.rule === undefined || (x.r ?? "") === pick.rule)
    && (pick.prio === undefined || (x.p ?? "") === pick.prio)
    && (!pick.byPerson || !!x.pp)
    && (!q || x.id === q || x.s.toLowerCase().includes(q)));
  const oj: Partial<Record<OwnerJ, number>> = {};
  for (const x of base) if (x.oj) oj[x.oj] = (oj[x.oj] ?? 0) + 1;
  const keep = (pick.oj === undefined ? base : base.filter((x) => x.oj === pick.oj)).sort((a, b) => b.d.localeCompare(a.d) || b.id.localeCompare(a.id));
  return { rows: keep.slice(0, LIST_MAX), total: keep.length, oj };
}

/** Every GQS task as last read (null until the first run after a release, ~5 minutes). */
export const gqsStore = () => kvGet<GqsStore>(KV.gqs);

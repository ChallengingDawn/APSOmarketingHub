// BACK-OFFICE REPORTS - the HubSpot read (the rules are in ./boReportRules.ts). Month by month from January last year: the
// Back Office tickets created (their topic, days to close, days to the first reply, the chat's), those closed, every
// ticket of ESO, TSA and all pipelines, and the orders with their lines; and every GQS task. Each month is kept on its
// own (kv boReport:month:<YYYY-MM>): this month and the one before are counted again every hour, older ones once a week
// - about 2,000 tickets and 5,000 order records a month, so the first count of the 23 months takes some minutes.
//
// Not through slowReport (SARCLA 02.11.2026 on the first day: "waiting for another HubSpot read to finish ... also
// doesn't open"): after a release every slow report reads again and this one waited behind them all. The page answers
// at once with the months already kept, the newest counted first, and a counter fills the rest in the background - one
// copy of the hub at a time (kv boReport:lease, a heartbeat; a lease older than 3 minutes is a counter a release killed).
// Its searches go through the hub's shared pace like everyone's. Reads HubSpot only.

import { query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { read, searchAll, type Filter } from "@/lib/lifecycle/read";
import { gqsTally, monthStart, monthsBetween, nextMonth, orderTally, swissDay, ticketTally, type BoMonth, type GqsMonth } from "./boReportRules";

/** a kept month of another version is counted again */
const VERSION = 1;
const HOUR = 3_600_000, WEEK = 7 * 24 * HOUR;
const LEASE_STALE_MS = 3 * 60_000;
const PIPE = { bo: "1726786777", eso: "1726599376", tsa: "1726599377", gqs: "1726786775" } as const;
/** GQS: the Back Office's own two stages before a task goes on to GQS - New for Back-Office, Open the GQS Task */
const GQS_BO_STAGES = ["hs_v2_cumulative_time_in_2338266314", "hs_v2_cumulative_time_in_2338266316"];
/** Back Office: entered "Redirected from chat" - the chat handed it over */
const REDIRECTED = "hs_v2_date_entered_2554860732";
const KV = { month: (ym: string) => `boReport:month:${ym}`, gqs: "boReport:gqs", lease: "boReport:lease" };

type Kept = BoMonth & { v: number; at: string };
type KeptGqs = { v: number; at: string; months: GqsMonth[] };
export type BoRead = {
  generatedAt: string; months: BoMonth[]; gqs: GqsMonth[]; current: string; today: string;
  /** the months not counted yet (the counter is on them), and what it is doing */
  pending: string[]; counting: boolean; progress: string | null; error: string | null;
};

const between = (prop: string, ym: string): Filter[] => [
  { propertyName: prop, operator: "GTE", value: String(monthStart(ym)) },
  { propertyName: prop, operator: "LT", value: String(monthStart(nextMonth(ym))) },
];
const pipe = (id: string): Filter => ({ propertyName: "hs_pipeline", operator: "EQ", value: id });

/** How many tickets match - one search (the tickets' own token). */
async function ticketCount(filters: Filter[]): Promise<number> {
  const r = await read<{ total?: number }>({
    path: "/crm/v3/objects/tickets/search", method: "POST", useTicketsToken: true,
    body: { filterGroups: [{ filters }], limit: 1, properties: ["hs_object_id"] },
  });
  if (typeof r.total !== "number") throw new Error("HubSpot gave no total for a ticket count.");
  return r.total;
}

async function readMonth(ym: string, say: (s: string) => void): Promise<BoMonth> {
  say(`${ym}: the Back Office's tickets`);
  const tickets = await searchAll("tickets", [[pipe(PIPE.bo), ...between("createdate", ym)]],
    ["enquiry_category", "time_to_close", "time_to_first_agent_reply", "source_type", REDIRECTED],
    (n) => say(`${ym}: the Back Office's tickets · ${n.toLocaleString("en")}`));
  const num = (x: string | null | undefined) => (x == null || x === "" ? null : Number(x));
  const t = ticketTally(tickets.map((r) => ({
    topic: r.properties?.enquiry_category ?? null, toClose: num(r.properties?.time_to_close), toReply: num(r.properties?.time_to_first_agent_reply),
    chat: !!r.properties?.[REDIRECTED] || r.properties?.source_type === "CHAT",
  })));
  say(`${ym}: tickets closed, ESO's, TSA's, all`);
  const closed = await ticketCount([pipe(PIPE.bo), ...between("closed_date", ym)]);
  const eso = await ticketCount([pipe(PIPE.eso), ...between("createdate", ym)]);
  const tsa = await ticketCount([pipe(PIPE.tsa), ...between("createdate", ym)]);
  const all = await ticketCount(between("createdate", ym));
  say(`${ym}: the orders`);
  const orders = await searchAll("orders", [between("order_order_date", ym)], ["order_order_number", "order_order_type", "order_order_status", "order_line_count", "order_item_count"],
    (n) => say(`${ym}: the orders · ${n.toLocaleString("en")}`));
  const o = orderTally(orders.map((r) => ({
    number: r.properties?.order_order_number ?? null, type: r.properties?.order_order_type ?? null, status: r.properties?.order_order_status ?? null,
    lines: Number(r.properties?.order_line_count) || Number(r.properties?.order_item_count) || 0,
  })));
  return { ym, ...t, closed, eso, tsa, all, orders: o.orders, lines: o.lines };
}

async function readGqs(): Promise<GqsMonth[]> {
  const tasks = await searchAll("tickets", [[pipe(PIPE.gqs)]], ["createdate", "time_to_close", ...GQS_BO_STAGES]);
  return gqsTally(tasks.filter((r) => r.properties?.createdate).map((r) => ({
    created: r.properties!.createdate!, toClose: Number(r.properties?.time_to_close) || null,
    sentMs: GQS_BO_STAGES.reduce((s, p) => s + (Number(r.properties?.[p]) || 0), 0),
  })));
}

/* ── the counter: one copy of the hub at a time, the newest months first ── */

type State = { running: boolean; progress: string | null; error: string | null };
const state: State = ((globalThis as { __apsoBoReport?: State }).__apsoBoReport ??= { running: false, progress: null, error: null });

/** when a kept month is to be counted again: this month and the one before every hour, older ones every week */
const stale = (k: Kept | undefined, fresh: boolean, now: number) => !k || k.v !== VERSION || now - Date.parse(k.at) > (fresh ? HOUR : WEEK);

async function keptMonths(): Promise<Map<string, Kept>> {
  try {
    const r = await query<{ k: string; v: Kept }>("SELECT k, v FROM apsomh_kv WHERE k LIKE 'boReport:month:%'");
    return new Map(r.rows.map((x) => [x.k.slice("boReport:month:".length), x.v]));
  } catch {
    return new Map(); // no database on this machine
  }
}

async function leaseFree(): Promise<boolean> {
  const l = await kvGet<{ beat: string }>(KV.lease);
  return !l || Date.now() - Date.parse(l.beat) > LEASE_STALE_MS;
}
const beat = () => kvSet(KV.lease, { beat: new Date().toISOString() });

function count(todo: string[], gqsDue: boolean): void {
  state.running = true; state.error = null;
  let last = 0;
  const say = (s: string) => {
    state.progress = s;
    if (Date.now() - last > 15_000) { last = Date.now(); void beat(); }
  };
  void (async () => {
    try {
      await beat();
      for (const [i, ym] of todo.entries()) {
        const m = await readMonth(ym, (s) => say(`month ${i + 1} of ${todo.length} · ${s}`));
        await kvSet(KV.month(ym), { ...m, v: VERSION, at: new Date().toISOString() } satisfies Kept);
      }
      if (gqsDue) {
        say("the GQS tasks");
        await kvSet(KV.gqs, { v: VERSION, at: new Date().toISOString(), months: await readGqs() } satisfies KeptGqs);
      }
    } catch (e) {
      state.error = String((e as Error)?.message ?? e);
      console.error(`[bo-report] the count stopped: ${state.error}`);
    } finally {
      state.running = false; state.progress = null;
      await kvSet(KV.lease, { beat: new Date(0).toISOString() }).catch(() => {});
    }
  })();
}

/** What is kept now - and, when months are missing or due, the counter started (unless it runs here or on another copy). */
export async function boReportNow(): Promise<BoRead> {
  const now = Date.now();
  const today = swissDay(now), current = today.slice(0, 7);
  const months = monthsBetween(`${Number(current.slice(0, 4)) - 1}-01`, current);
  const fresh = new Set(months.slice(-2));
  const kept = await keptMonths();
  const g = await kvGet<KeptGqs>(KV.gqs);
  const pending = months.filter((ym) => !kept.get(ym) || kept.get(ym)!.v !== VERSION);
  const due = [...months].reverse().filter((ym) => stale(kept.get(ym), fresh.has(ym), now));
  const gqsDue = !g || g.v !== VERSION || now - Date.parse(g.at) > HOUR;
  if ((due.length || gqsDue) && !state.running && (await leaseFree())) count(due, gqsDue);
  const have = months.flatMap((ym) => (kept.get(ym) && kept.get(ym)!.v === VERSION ? [kept.get(ym)!] : []));
  const newest = [...have.map((m) => m.at), g?.at ?? ""].sort().pop() ?? "";
  const elsewhere = !state.running && !(await leaseFree());
  return {
    generatedAt: newest || new Date(now).toISOString(), months: have, gqs: g?.v === VERSION ? g.months : [], current, today,
    pending, counting: state.running || elsewhere, progress: state.running ? state.progress : elsewhere ? "counting on another copy of the hub" : null, error: state.error,
  };
}

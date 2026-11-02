// BACK-OFFICE REPORTS - the HubSpot read (the rules are in ./boReportRules.ts). Month by month from January last year: the
// Back Office tickets created (their topic, days to close, days to the first reply, the chat's), those closed, every
// ticket of ESO, TSA and all pipelines, and the orders with their lines; and every GQS task. Each month is kept (kv boReport:month:<YYYY-MM>):
// this month and the one before are read again every hour, older ones once a week - about 2,000 tickets and 5,000 order
// records a month, so the first count of the 23 months takes some minutes. Read through slowReport: the first visitor
// starts it, everyone after gets it. Reads HubSpot only.

import { kvGet, kvSet } from "@/lib/db/init";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { read, searchAll, type Filter } from "@/lib/lifecycle/read";
import { gqsTally, monthStart, monthsBetween, nextMonth, orderTally, swissDay, ticketTally, type BoMonth, type GqsMonth } from "./boReportRules";

const KEY = "boReport:v1";
const TTL_MS = 60 * 60 * 1000;
/** a kept month of another version is read again */
const VERSION = 1;
const WEEK = 7 * 86_400_000;
const PIPE = { bo: "1726786777", eso: "1726599376", tsa: "1726599377", gqs: "1726786775" } as const;
/** GQS: the Back Office's own two stages before a task goes on to GQS - New for Back-Office, Open the GQS Task */
const GQS_BO_STAGES = ["hs_v2_cumulative_time_in_2338266314", "hs_v2_cumulative_time_in_2338266316"];
/** Back Office: entered "Redirected from chat" - the chat handed it over */
const REDIRECTED = "hs_v2_date_entered_2554860732";
const monthKey = (ym: string) => `boReport:month:${ym}`;

type Kept = BoMonth & { v: number; at: string };
export type BoRead = { generatedAt: string; months: BoMonth[]; gqs: GqsMonth[]; current: string; today: string };

export function boReport(): Promise<SlowState<BoRead>> {
  return slowReport(KEY, TTL_MS, build);
}

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

async function build(): Promise<BoRead> {
  const now = Date.now();
  const today = swissDay(now), current = today.slice(0, 7);
  const months = monthsBetween(`${Number(current.slice(0, 4)) - 1}-01`, current);
  const fresh = new Set(months.slice(-2)); // this month and the one before: every hour
  const out: BoMonth[] = [];
  for (const [i, ym] of months.entries()) {
    const kept = await kvGet<Kept>(monthKey(ym));
    const old = !kept || kept.v !== VERSION || fresh.has(ym) || now - Date.parse(kept.at) > WEEK;
    if (!old && kept) { out.push(kept); continue; }
    const m = await readMonth(ym, (s) => reportProgress(KEY, `month ${i + 1} of ${months.length} · ${s}`));
    await kvSet(monthKey(ym), { ...m, v: VERSION, at: new Date().toISOString() } satisfies Kept);
    out.push(m);
  }
  // every GQS task since the pipeline began (about 60 a month) - read whole each time
  reportProgress(KEY, "the GQS tasks");
  const tasks = await searchAll("tickets", [[pipe(PIPE.gqs)]], ["createdate", "time_to_close", ...GQS_BO_STAGES]);
  const gqs = gqsTally(tasks.filter((r) => r.properties?.createdate).map((r) => ({
    created: r.properties!.createdate!, toClose: Number(r.properties?.time_to_close) || null,
    sentMs: GQS_BO_STAGES.reduce((s, p) => s + (Number(r.properties?.[p]) || 0), 0),
  })));
  return { generatedAt: new Date().toISOString(), months: out, gqs, current, today };
}

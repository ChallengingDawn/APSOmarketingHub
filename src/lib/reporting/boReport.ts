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
//
// Version 3 (SARCLA 03.11.2026: "doesn't have customer filter", "a graph by people ... how many came in automatic or
// customer, how much closed month by month", "the breakdown per category", "STILL NO PROFIT CENTER?"): every ticket kept
// one by one (its topic, owner, where it came from, its company, its days) and the tickets closed with them; the companies'
// facts the filters read (kv boReport:companies); and each order's profit centre from its lines - the line's own, else its
// article's, learnt from every order line that names one (kv boReport:articles).

import { query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { associations, batchRead, read, searchAll, type Filter } from "@/lib/lifecycle/read";
import { workingHours } from "@/lib/marketingKpis/handoverCube";
import { prioBand, prioOf } from "./esoRules";
import { isC2s } from "@/lib/boDetection/figures";
import {
  articlePcs, gqsTally, monthStart, monthsBetween, nextMonth, orderTally, originOf, pcFinder, rowsOf, swissDay, ticketTally,
  type BoMonth, type CoFacts, type GqsMonth, type RowTicket,
} from "./boReportRules";

/** a kept month of another version is counted again (2: the C2S tickets, the tones, the orders by profit centre; 3: the
 *  tickets one by one, the tickets closed, the orders' profit centre from their lines; 4: each ticket's id, for the lists;
 *  5: each ticket's profit centre - its linked order's - and the orders' value by profit centre) */
const VERSION = 5;
const HOUR = 3_600_000, WEEK = 7 * 24 * HOUR;
const LEASE_STALE_MS = 3 * 60_000;
const PIPE = { bo: "1726786777", eso: "1726599376", tsa: "1726599377", gqs: "1726786775" } as const;
/** GQS: the time before a task is sent on - from entering Open the GQS Task to entering Waiting on GQS, or Waiting on APSO
 *  where it was put by mistake (SARCLA 03.11.2026: "it's based on time to move from open the GQS task stage until waiting on
 *  GQS, sometimes APSO because of mistakes") */
const GQS_OPEN = "hs_v2_date_entered_2338266316", GQS_SENT = ["hs_v2_date_entered_4704538856", "hs_v2_date_entered_6078992599"];
/** the GQS tasks are counted again when this changes (4: the time before sent, as above) - the months keep theirs */
const GQS_VERSION = 4;
/** Back Office: entered "Redirected from chat" - the chat handed it over */
const REDIRECTED = "hs_v2_date_entered_2554860732";
const KV = { month: (ym: string) => `boReport:month:${ym}`, chat: (ym: string) => `boReport:chat:${ym}`, gqs: "boReport:gqs", lease: "boReport:lease", companies: "boReport:companies", articles: "boReport:articles" };
/**
 * A chat ticket's handling (SARCLA 03.11.2026: "a tab chat handling - per person how much time people take to call the
 * customer, if they close with activity"): [ticket id, owner id, the first contact (0 none, 1 call, 2 e-mail sent,
 * 3 meeting), working hours to it x10 (-1 none), calls, e-mails sent, notes, closed 0/1]. Kept per month on its own
 * (boReport:chat:<YYYY-MM>, its own version), so the months are not counted again for it.
 */
export type ChatRow = [string, string, number, number, number, number, number, number, number];
/** 2: the day each chat ticket came in, beside it (the calls count from the chat v3 on) */
const CHAT_VERSION = 2;
type KeptChat = { v: number; at: string; rows: ChatRow[] };
/** the order lines read per order record: enough for every order but the largest, whose profit centre most lines decide */
const LINES = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, "0"));
/** the companies' facts, read again weekly */
export type KeptCompanies = { at: string; facts: CoFacts };

type Kept = BoMonth & { v: number; at: string };
type KeptGqs = { v: number; at: string; months: GqsMonth[] };
export type BoRead = {
  generatedAt: string; months: BoMonth[]; gqs: GqsMonth[]; current: string; today: string;
  /** the chat tickets' handling, by month */
  chat: Record<string, ChatRow[]>;
  /** the months not counted yet (the counter is on them), and what it is doing */
  pending: string[]; counting: boolean; progress: string | null; error: string | null;
  /** the months shown with their earlier count while they are counted again (a new version after a release) */
  updating: string[];
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

/** what a month's read adds to the whole count: the articles' profit centres learnt, the companies met */
type Learnt = { arts: Record<string, string>; companies: Set<string> };

async function readMonth(ym: string, say: (s: string) => void, learnt: Learnt): Promise<BoMonth> {
  const num = (x: string | null | undefined) => (x == null || x === "" ? null : Number(x));
  const dayOf = (iso: string | null | undefined) => (iso ? Number(swissDay(Date.parse(iso)).slice(8, 10)) || 1 : 1);
  const chatOf = (p: Record<string, string | null> | undefined) => !!p?.[REDIRECTED] || p?.source_type === "CHAT";
  say(`${ym}: the Back Office's tickets`);
  const tickets = await searchAll("tickets", [[pipe(PIPE.bo), ...between("createdate", ym)]],
    ["createdate", "enquiry_category", "time_to_close", "time_to_first_agent_reply", "source_type", REDIRECTED, "subject", "c2s_ticket", "c2s_problem_order", "sentiment_customer_tone",
      "hubspot_owner_id", "hs_primary_company_id", "hs_object_source"],
    (n) => say(`${ym}: the Back Office's tickets · ${n.toLocaleString("en")}`));
  const created: RowTicket[] = tickets.map((r) => {
    const p = r.properties;
    return {
      id: String(r.id), day: dayOf(p?.createdate), topic: p?.enquiry_category ?? null, owner: p?.hubspot_owner_id ?? null, company: p?.hs_primary_company_id ?? null,
      origin: originOf(p?.enquiry_category, chatOf(p), p?.hs_object_source), toClose: num(p?.time_to_close), toReply: num(p?.time_to_first_agent_reply),
      c2s: isC2s(p?.c2s_ticket, p?.c2s_problem_order, p?.subject), tone: p?.sentiment_customer_tone ?? null,
    };
  });
  const t = ticketTally(created.map((r) => ({ topic: r.topic, toClose: r.toClose ?? null, toReply: r.toReply ?? null, chat: r.origin === "Chat", c2s: r.c2s, tone: r.tone })));
  const srcs: Record<string, number> = {};
  for (const r of tickets) { const k = r.properties?.hs_object_source ?? ""; srcs[k] = (srcs[k] ?? 0) + 1; }
  say(`${ym}: the tickets closed`);
  const closedRecs = await searchAll("tickets", [[pipe(PIPE.bo), ...between("closed_date", ym)]],
    ["closed_date", "enquiry_category", "hubspot_owner_id", "hs_primary_company_id", "source_type", REDIRECTED, "hs_object_source"],
    (n) => say(`${ym}: the tickets closed · ${n.toLocaleString("en")}`));
  const closed: RowTicket[] = closedRecs.map((r) => {
    const p = r.properties;
    return { id: String(r.id), day: dayOf(p?.closed_date), topic: p?.enquiry_category ?? null, owner: p?.hubspot_owner_id ?? null, company: p?.hs_primary_company_id ?? null, origin: originOf(p?.enquiry_category, chatOf(p), p?.hs_object_source) };
  });
  for (const r of [...created, ...closed]) if (r.company) learnt.companies.add(r.company);
  say(`${ym}: ESO's, TSA's, all tickets`);
  const eso = await ticketCount([pipe(PIPE.eso), ...between("createdate", ym)]);
  const tsa = await ticketCount([pipe(PIPE.tsa), ...between("createdate", ym)]);
  const all = await ticketCount(between("createdate", ym));
  say(`${ym}: the orders`);
  const orders = await searchAll("orders", [between("order_order_date", ym)],
    ["order_order_number", "order_order_type", "order_order_status", "order_line_count", "order_item_count", "order_profit_center", "order_total_net_revenue", ...LINES.flatMap((i) => [`order_line_${i}_article`, `order_line_${i}_pc`])],
    (n) => say(`${ym}: the orders · ${n.toLocaleString("en")}`));
  const recs = orders.map((r) => ({
    number: r.properties?.order_order_number ?? null, type: r.properties?.order_order_type ?? null, status: r.properties?.order_order_status ?? null,
    lines: Number(r.properties?.order_line_count) || Number(r.properties?.order_item_count) || 0, pc: r.properties?.order_profit_center ?? null,
    arts: LINES.map((i) => r.properties?.[`order_line_${i}_article`] ?? null), lpcs: LINES.map((i) => r.properties?.[`order_line_${i}_pc`] ?? null),
    value: Number(r.properties?.order_total_net_revenue) || 0,
  }));
  Object.assign(learnt.arts, articlePcs(recs));
  const find = pcFinder(learnt.arts);
  const o = orderTally(recs, find);
  // each ticket's profit centre: its linked order's (SARCLA 04.11.2026: "see per profit centre which types of tickets") -
  // the month's orders by their record, the others read; none linked: ""
  say(`${ym}: the tickets' orders`);
  try {
    const linked = await associations("tickets", "orders", created.map((c) => c.id!).filter(Boolean));
    const recPc = new Map<string, string>();
    orders.forEach((r, i) => { const n = recs[i].number; if (n) recPc.set(String(r.id), o.pcOfNumber.get(n.replace(/\.\d+$/, "")) ?? ""); });
    const missing = [...new Set([...linked.values()].flat())].filter((id) => !recPc.has(id));
    for (const r of await batchRead("orders", missing, ["order_profit_center", ...LINES.flatMap((i) => [`order_line_${i}_article`, `order_line_${i}_pc`])])) {
      const p = r.properties ?? {};
      const one = orderTally([{ number: String(r.id), type: null, status: null, lines: 1, pc: p.order_profit_center ?? null, arts: LINES.map((i) => p[`order_line_${i}_article`] ?? null), lpcs: LINES.map((i) => p[`order_line_${i}_pc`] ?? null) }], find);
      recPc.set(String(r.id), [...one.pcOfNumber.values()][0] ?? "");
    }
    for (const c of created) {
      const os = linked.get(c.id ?? "") ?? [];
      c.pc = os.length ? os.map((id) => recPc.get(id) ?? "").find(Boolean) || "No profit centre" : "";
    }
  } catch (e) {
    console.error(`[bo-report] ${ym}: the tickets' orders could not be read: ${String((e as Error)?.message ?? e)}`);
  }
  return { ym, ...t, closed: closed.length, eso, tsa, all, orders: o.orders, lines: o.lines, pcs: o.pcs, linePcs: o.linePcs, valuePcs: o.valuePcs, rows: rowsOf(created, closed), srcs };
}

/** A month's chat tickets and what the team did on each: the first call, e-mail sent or meeting, and how long it took in
 *  working hours; the calls, e-mails sent and notes logged; closed or not. */
async function readChat(ym: string, say: (s: string) => void): Promise<ChatRow[]> {
  const base = [pipe(PIPE.bo), ...between("createdate", ym)];
  const found = await searchAll("tickets", [[...base, { propertyName: REDIRECTED, operator: "HAS_PROPERTY" }], [...base, { propertyName: "source_type", operator: "EQ", value: "CHAT" }]],
    ["createdate", "hubspot_owner_id", "closed_date"], (n) => say(`${ym}: the chat's tickets · ${n.toLocaleString("en")}`));
  const dayIn = (v: string | null | undefined) => (v ? Number(swissDay(Date.parse(v)).slice(8, 10)) || 1 : 1);
  const tickets = new Map(found.map((t) => [String(t.id), t.properties ?? {}]));
  const ids = [...tickets.keys()];
  if (!ids.length) return [];
  say(`${ym}: what was done on the chat's tickets`);
  const [emails, calls, meetings, notes] = [await associations("tickets", "emails", ids), await associations("tickets", "calls", ids), await associations("tickets", "meetings", ids), await associations("tickets", "notes", ids)];
  const at = new Map<string, number>(), out = new Set<string>();
  const t = (v: string | null | undefined) => { const n = v ? (/^\d+$/.test(v) ? Number(v) : Date.parse(v)) : NaN; return Number.isFinite(n) ? n : null; };
  for (const e of await batchRead("emails", [...new Set([...emails.values()].flat())], ["hs_timestamp", "hs_email_direction"])) {
    const w = t(e.properties?.hs_timestamp); if (w != null) at.set(`e${e.id}`, w);
    if ((e.properties?.hs_email_direction ?? "") !== "INCOMING_EMAIL") out.add(String(e.id));
  }
  for (const c of await batchRead("calls", [...new Set([...calls.values()].flat())], ["hs_timestamp"])) { const w = t(c.properties?.hs_timestamp); if (w != null) at.set(`c${c.id}`, w); }
  for (const m of await batchRead("meetings", [...new Set([...meetings.values()].flat())], ["hs_meeting_start_time", "hs_timestamp"])) { const w = t(m.properties?.hs_meeting_start_time) ?? t(m.properties?.hs_timestamp); if (w != null) at.set(`m${m.id}`, w); }
  const rows: ChatRow[] = [];
  for (const [id, p] of tickets) {
    const created = t(p.createdate);
    const sent = (emails.get(id) ?? []).filter((e) => out.has(e));
    const contacts = [...(calls.get(id) ?? []).map((c) => [1, at.get(`c${c}`)] as const), ...sent.map((e) => [2, at.get(`e${e}`)] as const), ...(meetings.get(id) ?? []).map((m) => [3, at.get(`m${m}`)] as const)]
      .filter((x): x is readonly [1 | 2 | 3, number] => x[1] != null && (created == null || x[1] >= created - 60_000)).sort((a, b) => a[1] - b[1]);
    const first = contacts[0];
    rows.push([id, p.hubspot_owner_id ?? "", first ? first[0] : 0, first && created != null ? Math.round(workingHours(created, first[1]) * 10) : -1,
      (calls.get(id) ?? []).length, sent.length, (notes.get(id) ?? []).length, p.closed_date ? 1 : 0, dayIn(p.createdate)]);
  }
  return rows;
}

/** The facts the filters read of the companies met: customer category, country, priority band - those not known yet, or
 *  all of them once a week. */
async function readCompanies(ids: Set<string>, say: (s: string) => void): Promise<void> {
  const kept = await kvGet<KeptCompanies>(KV.companies);
  const old = !kept || Date.now() - Date.parse(kept.at) > WEEK;
  // the ones not known, or known without their name (kept before 03.11.2026), or all of them once a week
  const want = [...ids].filter((id) => old || !kept?.facts[id] || kept.facts[id].length < 4);
  if (!want.length) return;
  const recs = await batchRead("companies", want, ["name", "sales_priority", "apso_customer", "country_custom"], [],
    (n) => say(`the tickets' companies · ${n.toLocaleString("en")} of ${want.length.toLocaleString("en")}`));
  const facts: CoFacts = { ...(kept?.facts ?? {}) };
  for (const c of recs) {
    const p = c.properties ?? {};
    facts[String(c.id)] = [(p.apso_customer ?? "").trim() || "Not set", (p.country_custom ?? "").trim() || "Not set", prioBand(prioOf(p.sales_priority)), (p.name ?? "").trim() || `Company ${c.id}`];
  }
  await kvSet(KV.companies, { at: old ? new Date().toISOString() : kept!.at, facts } satisfies KeptCompanies);
}

async function readGqs(): Promise<GqsMonth[]> {
  const tasks = await searchAll("tickets", [[pipe(PIPE.gqs)]], ["createdate", "time_to_close", GQS_OPEN, ...GQS_SENT]);
  return gqsTally(tasks.filter((r) => r.properties?.createdate).map((r) => {
    const p = r.properties!;
    const open = Date.parse(p[GQS_OPEN] ?? ""), sent = Math.min(...GQS_SENT.map((k) => Date.parse(p[k] ?? "")).filter(Number.isFinite));
    return { created: p.createdate!, toClose: Number(p.time_to_close) || null, sentMs: Number.isFinite(open) && Number.isFinite(sent) && sent > open ? sent - open : 0 };
  }));
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

async function keptChats(): Promise<Map<string, KeptChat>> {
  try {
    const r = await query<{ k: string; v: KeptChat }>("SELECT k, v FROM apsomh_kv WHERE k LIKE 'boReport:chat:%'");
    return new Map(r.rows.map((x) => [x.k.slice("boReport:chat:".length), x.v]));
  } catch {
    return new Map();
  }
}

async function leaseFree(): Promise<boolean> {
  const l = await kvGet<{ beat: string }>(KV.lease);
  return !l || Date.now() - Date.parse(l.beat) > LEASE_STALE_MS;
}
const beat = () => kvSet(KV.lease, { beat: new Date().toISOString() });

function count(todo: string[], gqsDue: boolean, chatTodo: string[] = []): void {
  state.running = true; state.error = null;
  let last = 0;
  const say = (s: string) => {
    state.progress = s;
    if (Date.now() - last > 15_000) { last = Date.now(); void beat(); }
  };
  void (async () => {
    try {
      await beat();
      const learnt: Learnt = { arts: (await kvGet<Record<string, string>>(KV.articles)) ?? {}, companies: new Set() };
      for (const [i, ym] of todo.entries()) {
        const m = await readMonth(ym, (s) => say(`month ${i + 1} of ${todo.length} · ${s}`), learnt);
        await kvSet(KV.month(ym), { ...m, v: VERSION, at: new Date().toISOString() } satisfies Kept);
        await kvSet(KV.articles, learnt.arts);
      }
      for (const [i, ym] of chatTodo.entries()) {
        const rows = await readChat(ym, (s) => say(`chat ${i + 1} of ${chatTodo.length} · ${s}`));
        await kvSet(KV.chat(ym), { v: CHAT_VERSION, at: new Date().toISOString(), rows } satisfies KeptChat);
      }
      if (learnt.companies.size) await readCompanies(learnt.companies, say);
      if (gqsDue) {
        say("the GQS tasks");
        await kvSet(KV.gqs, { v: GQS_VERSION, at: new Date().toISOString(), months: await readGqs() } satisfies KeptGqs);
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
  // a month of an earlier version (from 3 on, the tickets one by one) stays shown while it is counted again - a release that
  // changes the read no longer leaves the pages empty for the half hour of the count (SARCLA 04.11.2026: "it's empty")
  const usable = (k: Kept | undefined) => !!k && (k.v === VERSION || k.v >= 3);
  const pending = months.filter((ym) => !usable(kept.get(ym)));
  const updating = months.filter((ym) => usable(kept.get(ym)) && kept.get(ym)!.v !== VERSION);
  const due = [...months].reverse().filter((ym) => stale(kept.get(ym), fresh.has(ym), now));
  const gqsDue = !g || g.v !== GQS_VERSION || now - Date.parse(g.at) > HOUR;
  // the chat's handling: the months with tickets, kept like the months (this one and the one before hourly, older weekly)
  const chats = await keptChats();
  const chatDue = [...months].reverse().filter((ym) => ym >= "2025-07" && (() => { const k = chats.get(ym); return !k || k.v !== CHAT_VERSION || now - Date.parse(k.at) > (fresh.has(ym) ? HOUR : WEEK); })());
  if ((due.length || gqsDue || chatDue.length) && !state.running && (await leaseFree())) count(due, gqsDue, chatDue);
  const have = months.flatMap((ym) => (usable(kept.get(ym)) ? [kept.get(ym)!] : []));
  const newest = [...have.map((m) => m.at), g?.at ?? ""].sort().pop() ?? "";
  const elsewhere = !state.running && !(await leaseFree());
  return {
    generatedAt: newest || new Date(now).toISOString(), months: have,
    chat: Object.fromEntries([...chats].filter(([, k]) => k.v === CHAT_VERSION).map(([ym, k]) => [ym, k.rows])), gqs: g?.v === GQS_VERSION ? g.months : [], current, today,
    pending, updating, counting: state.running || elsewhere, progress: state.running ? state.progress : elsewhere ? "counting on another copy of the hub" : null, error: state.error,
  };
}

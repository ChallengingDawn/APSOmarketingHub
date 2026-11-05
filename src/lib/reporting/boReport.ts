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
import { associations, batchRead, read, searchAll, type Filter, type Rec } from "@/lib/lifecycle/read";
import { workingHours } from "@/lib/marketingKpis/handoverCube";
import { prioBand, prioOf } from "./esoRules";
import { isC2s } from "@/lib/boDetection/figures";
import {
  RW, articlePcs, artsOf, baseOf, gqsTally, isCredit, monthStart, monthsBetween, nextMonth, orderTally, originOf, pcCode, pcFinder, rowsOf, swissDay, ticketTally,
  type BoMonth, type CoFacts, type GqsMonth, type OrderRec, type RowTicket,
} from "./boReportRules";
import { taskOf, type GqsKept, type GqsTask } from "./boGqs";
import { DEFAULT_LIMITS, type Limits } from "../gqsApprovals/rules";

/** a kept month of another version is counted again (2: the C2S tickets, the tones, the orders by profit centre; 3: the
 *  tickets one by one, the tickets closed, the orders' profit centre from their lines; 4: each ticket's id, for the lists;
 *  5: each ticket's profit centre - its linked order's - and the orders' value by profit centre; 6: a profit centre for
 *  every ticket and order that can have one - Products & Pricing's for an article no order line names, the customer's
 *  main one last - and each ticket's order value and articles, for the topics per article, per profit centre, in value) */
const VERSION = 6;
/** Products & Pricing, the articles' own record (article_number, profit_center, description, main group) */
const PP_OBJ = "2-200042439";
const PP_PROPS = ["article_number", "article_description", "profit_center", "main_group_description"];
/** an article as the pages name it: [its description, its profit centre, its main group] */
export type ArtInfo = [string, string, string];
const HOUR = 3_600_000, WEEK = 7 * 24 * HOUR;
const LEASE_STALE_MS = 3 * 60_000;
const PIPE = { bo: "1726786777", eso: "1726599376", tsa: "1726599377", gqs: "1726786775" } as const;
/** GQS: the time before a task is sent on - from entering Open the GQS Task to entering Waiting on GQS, or Waiting on APSO
 *  where it was put by mistake (SARCLA 03.11.2026: "it's based on time to move from open the GQS task stage until waiting on
 *  GQS, sometimes APSO because of mistakes") */
const GQS_OPEN = "hs_v2_date_entered_2338266316", GQS_SENT = ["hs_v2_date_entered_4704538856", "hs_v2_date_entered_6078992599"];
/** the GQS tasks are counted again when this changes (4: the time before sent, as above) - the months keep theirs */
const GQS_VERSION = 4;
/** every GQS task on its own, for the GQS page in full (boGqs.ts) - read with the months above, kept on its own key */
const GQS_TASKS_VERSION = 1;
const GQS_PROPS = [
  "createdate", "time_to_close", GQS_OPEN, ...GQS_SENT, "hs_pipeline_stage", "status_of_gqs", "gqs_type_of_request", "hubspot_owner_id", "back_office_ticket_requester",
  "price_tier_approver", "order_potential_", "margin__", "liquidation_article", "reason_of_decline_by_pm", "customer_number_customer_name",
];
/** Back Office: entered "Redirected from chat" - the chat handed it over */
const REDIRECTED = "hs_v2_date_entered_2554860732";
const KV = {
  month: (ym: string) => `boReport:month:${ym}`, chat: (ym: string) => `boReport:chat:${ym}`, gqs: "boReport:gqs", gqsTasks: "boReport:gqsTasks", lease: "boReport:lease", companies: "boReport:companies", articles: "boReport:articles",
  /** the articles Products & Pricing was asked for and does not know (or names no profit centre for) - not asked again */
  ppMiss: "boReport:ppMiss",
  /** the articles on the tickets, named for the pages: description, profit centre, main group */
  artInfo: "boReport:artInfo",
};
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
type KeptGqsTasks = GqsKept & { v: number };
export type BoRead = {
  generatedAt: string; months: BoMonth[]; gqs: GqsMonth[]; current: string; today: string;
  /** the chat tickets' handling, by month */
  chat: Record<string, ChatRow[]>;
  /** the months not counted yet (the counter is on them), and what it is doing */
  pending: string[]; counting: boolean; progress: string | null; error: string | null;
  /** the months shown with their earlier count while they are counted again (a new version after a release) */
  updating: string[];
  /** the articles on the tickets kept: description, profit centre, main group */
  arts?: Record<string, ArtInfo>;
  /** every GQS task on its own - the GQS page in full; null until first read */
  gqsTasks?: GqsKept | null;
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

/** what a month's read adds to the whole count: the articles' profit centres learnt, the companies met, the articles
 *  Products & Pricing does not know, the tickets' articles named, the companies' main profit centres */
type Learnt = { arts: Record<string, string>; companies: Set<string>; miss: Set<string>; info: Record<string, ArtInfo>; coPc: Map<string, string>; coRaw: Map<string, string> };

const clip = (s: string | null | undefined, n = 70) => { const t = (s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
/** Products & Pricing's records of some articles, 100 article numbers a search - each found one named and its profit
 *  centre learnt, the others remembered as unknown so they are not asked again. */
async function ppLearn(arts: string[], learnt: Learnt, say: (s: string) => void): Promise<void> {
  const want = [...new Set(arts.map((a) => a.trim()).filter((a) => a && !learnt.miss.has(a) && !(a in learnt.info)))];
  for (let i = 0; i < want.length; i += 100) {
    const chunk = want.slice(i, i + 100);
    say(`the articles in Products & Pricing · ${Math.min(i + 100, want.length).toLocaleString("en")} of ${want.length.toLocaleString("en")}`);
    const r = await read<{ results?: Rec[] }>({
      path: `/crm/v3/objects/${PP_OBJ}/search`, method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: chunk }] }], properties: PP_PROPS, limit: 200 },
    });
    const found = new Set<string>();
    for (const x of r.results ?? []) {
      const p = x.properties ?? {}, a = (p.article_number ?? "").trim(), pc = pcCode(p.profit_center);
      if (!a) continue;
      found.add(a);
      learnt.info[a] = [clip(p.article_description), pc, clip(p.main_group_description, 50)];
      if (pc && !learnt.arts[a]) learnt.arts[a] = pc;
    }
    for (const a of chunk) if (!found.has(a)) learnt.miss.add(a);
  }
}
/** The companies' main profit centre (major_profit_center) - read once a count, those not read yet. */
async function companyPcs(ids: string[], learnt: Learnt): Promise<void> {
  const want = [...new Set(ids)].filter((id) => id && !learnt.coPc.has(id));
  if (!want.length) return;
  for (const c of await batchRead("companies", want, ["major_profit_center"])) { learnt.coPc.set(String(c.id), pcCode(c.properties?.major_profit_center)); learnt.coRaw.set(String(c.id), (c.properties?.major_profit_center ?? "").trim()); }
  for (const id of want) if (!learnt.coPc.has(id)) learnt.coPc.set(id, "");
}
/** An order record as the count reads it. */
const recOf = (p: Record<string, string | null>, number: string | null): OrderRec => ({
  number, type: p.order_order_type ?? null, status: p.order_order_status ?? null,
  lines: Number(p.order_line_count) || Number(p.order_item_count) || 0, pc: p.order_profit_center ?? null,
  arts: LINES.map((i) => p[`order_line_${i}_article`] ?? null), lpcs: LINES.map((i) => p[`order_line_${i}_pc`] ?? null),
  revs: LINES.map((i) => (p[`order_line_${i}_revenue`] == null || p[`order_line_${i}_revenue`] === "" ? null : Number(p[`order_line_${i}_revenue`]) || 0)),
  value: Number(p.order_total_net_revenue) || 0,
});
const ORDER_PROPS = ["order_order_number", "order_order_type", "order_order_status", "order_line_count", "order_item_count", "order_profit_center", "order_total_net_revenue",
  ...LINES.flatMap((i) => [`order_line_${i}_article`, `order_line_${i}_pc`, `order_line_${i}_revenue`])];
/** Some order records' profit centres: the order's own, else most of its lines' (Products & Pricing asked for the articles
 *  not known), else its customer's main one. */
async function tallyWithPcs(recs: { id: string; rec: OrderRec }[], learnt: Learnt, say: (s: string) => void) {
  const rs = recs.map((x) => x.rec);
  Object.assign(learnt.arts, articlePcs(rs));
  try {
    await ppLearn(rs.flatMap((r) => (r.arts ?? []).filter((a): a is string => !!a && !learnt.arts[a.trim()])), learnt, say);
  } catch (e) {
    console.error(`[bo-report] Products & Pricing could not be read: ${String((e as Error)?.message ?? e)}`);
  }
  const find = pcFinder(learnt.arts);
  let o = orderTally(rs, find);
  // the orders still without one: their customer's main profit centre
  const blank = recs.filter((x) => x.rec.number && !isCredit(x.rec) && o.pcOfNumber.get(baseOf(x.rec.number)) === "");
  if (blank.length) {
    try {
      const co = await associations("orders", "companies", blank.map((x) => x.id));
      await companyPcs([...co.values()].flat(), learnt);
      const byBase = new Map<string, string>();
      for (const x of blank) { const pc = (co.get(x.id) ?? []).map((c) => learnt.coPc.get(c) ?? "").find(Boolean); if (pc && !byBase.has(baseOf(x.rec.number!))) byBase.set(baseOf(x.rec.number!), pc); }
      if (byBase.size) o = orderTally(rs, find, (b) => byBase.get(b));
    } catch (e) {
      console.error(`[bo-report] the orders' companies could not be read: ${String((e as Error)?.message ?? e)}`);
    }
  }
  return o;
}

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
  const orders = await searchAll("orders", [between("order_order_date", ym)], ORDER_PROPS, (n) => say(`${ym}: the orders · ${n.toLocaleString("en")}`));
  const recs = orders.map((r) => ({ id: String(r.id), rec: recOf(r.properties ?? {}, r.properties?.order_order_number ?? null) }));
  const o = await tallyWithPcs(recs, learnt, (s) => say(`${ym}: ${s}`));
  // Each ticket's profit centre, the value of its orders and its articles (SARCLA 04.11.2026: "see per profit centre which
  // types of tickets", "WHY DO WE STILL HAVE No profit centre", "per article, per profit centre, value"): its linked
  // orders' - the month's by their record, the others read - else the articles named on it, else its customer's main one.
  say(`${ym}: the tickets' orders and articles`);
  try {
    const ids = created.map((c) => c.id!).filter(Boolean);
    const linked = await associations("tickets", "orders", ids);
    type Linked = { base: string; pc: string; value: number; lines: [string, number][] };
    const linesOf = (r: OrderRec): [string, number][] => (r.arts ?? []).flatMap((a, i) => (a && a.trim() ? [[a.trim(), r.revs?.[i] ?? 0] as [string, number]] : []));
    const byRec = new Map<string, Linked>();
    const put = (id: string, r: OrderRec, t: { pcOfNumber: Map<string, string>; valueOfNumber: Map<string, number> }) => {
      if (!r.number) return;
      const b = baseOf(r.number);
      byRec.set(id, { base: b, pc: t.pcOfNumber.get(b) ?? "", value: t.valueOfNumber.get(b) ?? r.value ?? 0, lines: linesOf(r) });
    };
    for (const x of recs) put(x.id, x.rec, o);
    const missing = [...new Set([...linked.values()].flat())].filter((id) => !byRec.has(id));
    if (missing.length) {
      const other = (await batchRead("orders", missing, ORDER_PROPS)).map((r) => ({ id: String(r.id), rec: recOf(r.properties ?? {}, r.properties?.order_order_number || String(r.id)) }));
      const ot = await tallyWithPcs(other, learnt, (s) => say(`${ym}: ${s}`));
      for (const x of other) put(x.id, x.rec, ot);
    }
    // the articles named on the tickets (the hub's ticket associations link them to Products & Pricing) - a failure here
    // leaves the tickets their orders' profit centres
    let named = new Map<string, string[]>();
    const ppArt = new Map<string, string>();
    try {
      named = await associations("tickets", PP_OBJ, ids);
      const ppIds = [...new Set([...named.values()].flat())];
      if (ppIds.length) {
        for (const x of await batchRead(PP_OBJ, ppIds, PP_PROPS)) {
          const p = x.properties ?? {}, a = (p.article_number ?? "").trim();
          if (!a) continue;
          ppArt.set(String(x.id), a);
          learnt.info[a] = [clip(p.article_description), pcCode(p.profit_center), clip(p.main_group_description, 50)];
        }
      }
    } catch (e) {
      console.error(`[bo-report] ${ym}: the articles named on the tickets could not be read: ${String((e as Error)?.message ?? e)}`);
    }
    for (const c of created) {
      const os = [...new Map((linked.get(c.id ?? "") ?? []).map((id) => byRec.get(id)).filter((x): x is Linked => !!x).map((x) => [x.base, x] as const)).values()];
      const lines = os.flatMap((x) => x.lines);
      const arts = [...new Set((named.get(c.id ?? "") ?? []).map((id) => ppArt.get(id)).filter((a): a is string => !!a))];
      c.value = os.reduce((s, x) => s + x.value, 0);
      // the articles named on it, with their line's value where its order holds them; else its orders' lines, the largest first
      c.arts = arts.length ? arts.slice(0, 5).map((a) => [a, lines.filter(([x]) => x === a).reduce((s, [, v]) => s + v, 0)] as [string, number])
        : [...lines].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const pcOrder = os.map((x) => x.pc).find(Boolean);
      const byArt: Record<string, number> = {};
      for (const a of arts) { const pc = learnt.info[a]?.[1] || learnt.arts[a]; if (pc) byArt[pc] = (byArt[pc] ?? 0) + 1; }
      const pcArt = Object.entries(byArt).sort((x, y) => y[1] - x[1])[0]?.[0];
      if (pcOrder) { c.pc = pcOrder; c.from = 1; } else if (pcArt) { c.pc = pcArt; c.from = 2; } else { c.pc = ""; c.from = 0; }
    }
    // the rest: the customer's main profit centre
    const rest = created.filter((c) => !c.pc && c.company);
    if (rest.length) {
      await companyPcs(rest.map((c) => c.company!), learnt).catch((e) => console.error(`[bo-report] ${ym}: the companies' profit centres could not be read: ${String((e as Error)?.message ?? e)}`));
      // none: a customer buying across profit centres (4), or one with no purchase yet (5)
      for (const c of rest) { const pc = learnt.coPc.get(c.company!); if (pc) { c.pc = pc; c.from = 3; } else c.from = /mix/i.test(learnt.coRaw.get(c.company!) ?? "") ? 4 : 5; }
    }
    // the articles on the tickets named for the pages - those not named yet asked of Products & Pricing
    await ppLearn(created.flatMap((c) => (c.arts ?? []).map(([a]) => a)), learnt, (s) => say(`${ym}: ${s}`))
      .catch((e) => console.error(`[bo-report] ${ym}: the tickets' articles could not be named: ${String((e as Error)?.message ?? e)}`));
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

/** The approval rule's limits as they stand (Back Office distribution > GQS > Approvals), to say why a request went to the
 *  line manager. */
async function gqsLimits(): Promise<Limits> {
  const s = await kvGet<{ limits?: Partial<Limits> }>("gqsApprovals:settings").catch(() => null);
  return { ...DEFAULT_LIMITS, ...(s?.limits ?? {}) };
}

/** Every GQS task: the months' three figures as before, and each task on its own with its stage and STATUS OF GQS
 *  histories (50 a read, ~15 reads) - SARCLA 04.11.2026: "GQS ... this is a full pipeline, we should have the full scope". */
async function readGqs(say: (s: string) => void): Promise<{ months: GqsMonth[]; tasks: GqsKept }> {
  const recs = (await searchAll("tickets", [[pipe(PIPE.gqs)]], GQS_PROPS)).filter((r) => r.properties?.createdate);
  const hist = new Map<string, Record<string, { value?: string | null; timestamp?: string }[]>>();
  for (const r of await batchRead("tickets", recs.map((x) => String(x.id)), ["hs_pipeline_stage"], ["hs_pipeline_stage", "status_of_gqs"],
    (n) => say(`the GQS tasks' histories · ${n.toLocaleString("en")} of ${recs.length.toLocaleString("en")}`))) hist.set(String(r.id), r.propertiesWithHistory ?? {});
  const limits = await gqsLimits();
  const now = Date.now();
  const months = gqsTally(recs.map((r) => {
    const p = r.properties!;
    const open = Date.parse(p[GQS_OPEN] ?? ""), sent = Math.min(...GQS_SENT.map((k) => Date.parse(p[k] ?? "")).filter(Number.isFinite));
    return { created: p.createdate!, toClose: Number(p.time_to_close) || null, sentMs: Number.isFinite(open) && Number.isFinite(sent) && sent > open ? sent - open : 0 };
  }));
  const tasks = recs.map((r) => { const id = String(r.id), h = hist.get(id); return taskOf(id, r.properties!, h?.hs_pipeline_stage, h?.status_of_gqs, limits, now); })
    .filter((t): t is GqsTask => !!t);
  return { months, tasks: { at: new Date(now).toISOString(), tasks, limits } };
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
      // the GQS tasks first - a minute's read, never behind a recount of the months (and never stopping it)
      if (gqsDue) {
        say("the GQS tasks");
        try {
          const g = await readGqs(say);
          const at = new Date().toISOString();
          await kvSet(KV.gqs, { v: GQS_VERSION, at, months: g.months } satisfies KeptGqs);
          await kvSet(KV.gqsTasks, { ...g.tasks, v: GQS_TASKS_VERSION } satisfies KeptGqsTasks);
        } catch (e) {
          console.error(`[bo-report] the GQS tasks: ${String((e as Error)?.message ?? e)}`);
        }
      }
      const learnt: Learnt = {
        arts: (await kvGet<Record<string, string>>(KV.articles)) ?? {}, companies: new Set(), miss: new Set((await kvGet<string[]>(KV.ppMiss)) ?? []),
        info: (await kvGet<Record<string, ArtInfo>>(KV.artInfo)) ?? {}, coPc: new Map(), coRaw: new Map(),
      };
      for (const [i, ym] of todo.entries()) {
        const m = await readMonth(ym, (s) => say(`month ${i + 1} of ${todo.length} · ${s}`), learnt);
        await kvSet(KV.month(ym), { ...m, v: VERSION, at: new Date().toISOString() } satisfies Kept);
        await kvSet(KV.articles, learnt.arts);
        await kvSet(KV.ppMiss, [...learnt.miss]);
        // only the articles on the tickets go to the pages
        const onTickets = new Set(m.rows?.created.flatMap((r) => artsOf(m.rows!.dict[r[RW.arts]]).map(([a]) => a)) ?? []);
        const kept = (await kvGet<Record<string, ArtInfo>>(KV.artInfo)) ?? {};
        for (const a of onTickets) if (learnt.info[a]) kept[a] = learnt.info[a];
        await kvSet(KV.artInfo, kept);
      }
      for (const [i, ym] of chatTodo.entries()) {
        const rows = await readChat(ym, (s) => say(`chat ${i + 1} of ${chatTodo.length} · ${s}`));
        await kvSet(KV.chat(ym), { v: CHAT_VERSION, at: new Date().toISOString(), rows } satisfies KeptChat);
      }
      if (learnt.companies.size) await readCompanies(learnt.companies, say);
    } catch (e) {
      state.error = String((e as Error)?.message ?? e);
      console.error(`[bo-report] the count stopped: ${state.error}`);
    } finally {
      state.running = false; state.progress = null;
      await kvSet(KV.lease, { beat: new Date(0).toISOString() }).catch(() => {});
    }
  })();
}

/**
 * The GQS tasks kept, for the GQS tab of the Incoming tickets page (ESO, TSA, Sales Leader and My Sales Reports - SARCLA
 * 05.11.2026) - and, when they are an hour old, read again as a Back-Office page would (the GQS tasks only; the months
 * wait for a Back-Office page), unless the counter runs here or on another copy.
 */
export async function gqsTasksNow(): Promise<{ kept: GqsKept | null; counting: boolean }> {
  const now = Date.now();
  const g = await kvGet<KeptGqs>(KV.gqs);
  const gt = await kvGet<KeptGqsTasks>(KV.gqsTasks);
  const due = !g || g.v !== GQS_VERSION || now - Date.parse(g.at) > HOUR || !gt || gt.v !== GQS_TASKS_VERSION;
  if (due && !state.running && (await leaseFree())) count([], true, []);
  const counting = state.running || !(await leaseFree());
  return { kept: gt?.v === GQS_TASKS_VERSION ? { at: gt.at, tasks: gt.tasks, limits: gt.limits } : null, counting };
}

/** What is kept now - and, when months are missing or due, the counter started (unless it runs here or on another copy). */
export async function boReportNow(): Promise<BoRead> {
  const now = Date.now();
  const today = swissDay(now), current = today.slice(0, 7);
  const months = monthsBetween(`${Number(current.slice(0, 4)) - 1}-01`, current);
  const fresh = new Set(months.slice(-2));
  const kept = await keptMonths();
  const g = await kvGet<KeptGqs>(KV.gqs);
  const gt = await kvGet<KeptGqsTasks>(KV.gqsTasks);
  // a month of an earlier version (from 3 on, the tickets one by one) stays shown while it is counted again - a release that
  // changes the read no longer leaves the pages empty for the half hour of the count (SARCLA 04.11.2026: "it's empty")
  const usable = (k: Kept | undefined) => !!k && (k.v === VERSION || k.v >= 3);
  const pending = months.filter((ym) => !usable(kept.get(ym)));
  const updating = months.filter((ym) => usable(kept.get(ym)) && kept.get(ym)!.v !== VERSION);
  const due = [...months].reverse().filter((ym) => stale(kept.get(ym), fresh.has(ym), now));
  const gqsDue = !g || g.v !== GQS_VERSION || now - Date.parse(g.at) > HOUR || !gt || gt.v !== GQS_TASKS_VERSION;
  // the chat's handling: the months with tickets, kept like the months (this one and the one before hourly, older weekly)
  const chats = await keptChats();
  const chatDue = [...months].reverse().filter((ym) => ym >= "2025-07" && (() => { const k = chats.get(ym); return !k || k.v !== CHAT_VERSION || now - Date.parse(k.at) > (fresh.has(ym) ? HOUR : WEEK); })());
  if ((due.length || gqsDue || chatDue.length) && !state.running && (await leaseFree())) count(due, gqsDue, chatDue);
  const have = months.flatMap((ym) => (usable(kept.get(ym)) ? [kept.get(ym)!] : []));
  const newest = [...have.map((m) => m.at), g?.at ?? ""].sort().pop() ?? "";
  const elsewhere = !state.running && !(await leaseFree());
  const arts = (await kvGet<Record<string, ArtInfo>>(KV.artInfo).catch(() => null)) ?? {};
  return {
    generatedAt: newest || new Date(now).toISOString(), months: have,
    chat: Object.fromEntries([...chats].filter(([, k]) => k.v === CHAT_VERSION).map(([ym, k]) => [ym, k.rows])), gqs: g?.v === GQS_VERSION ? g.months : [], current, today,
    gqsTasks: gt?.v === GQS_TASKS_VERSION ? { at: gt.at, tasks: gt.tasks, limits: gt.limits } : null,
    pending, updating, arts, counting: state.running || elsewhere, progress: state.running ? state.progress : elsewhere ? "counting on another copy of the hub" : null, error: state.error,
  };
}

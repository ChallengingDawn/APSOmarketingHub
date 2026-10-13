// THE LIFECYCLE READS - one per page, plus the email sends every page shares.
//
// Each is minutes of HubSpot reading (the stage and email histories are the
// heavy part: 50 records a call), so each runs through slowReport: the first
// visitor starts it, everyone after gets the finished read, it is kept in the
// hub's Postgres (apsomh_kv) for 12 hours and a deployment mid-read hands it to
// the next task. While a newer read runs, the last finished one is served.
//
// Read only. What is kept is what the pages show - company names, stages,
// order days, ticket answers, email names and days - never contact details.

import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { HORIZON, PIPELINE, STAGE, STAGES, UC15_BACKFILL_MONTH, UC2_QUAL, ucForEmailNumber, ucOf, type UcKey, type ViewKey } from "./config";
import {
  companyOfContact, enrolledOn, monthOf, monthsFrom, parseEmailName, parts, revProp, revenueByMonth, secondOrderDay, sendsOf, shiftMonth, stageEntries,
  tally, toDay, type Entry, type OrderLite, type Send, type Src,
  qualOf,
} from "./rules";
import { associations, batchEach, batchRead, countOf, dayMs, emailStatsToken, newest, people, readEmailStats, searchAll, ticketStages, type Filter, type Rec } from "./read";
import type { Co, EmailData, OverviewData, Source, Task, Ticket, UcData } from "./types";

const TTL_MS = 12 * 60 * 60 * 1000;
// a read whose shape changes gets a new version, so an old cached read is never shown in the new page
// (UC2 v2, 13.10.2026: the qualification field, the company owner and the people's names)
// (13.10 v3/v2: UC2's buyers' revenue, the ticket companies' revenue, the emailed companies' last order)
const VERSION: Partial<Record<ViewKey | "emails", string>> = { uc2: "v3", uc15: "v2", uc6: "v2", uc9: "v2", uc4: "v2", emails: "v2" };
export const keyOf = (k: ViewKey | "emails") => `lifecycle:${k}:${VERSION[k] ?? "v1"}`;

const todayZurich = () => toDay(Date.now()) as string;
const n0 = (n: number) => n.toLocaleString("en-US");
const gte = (prop: string, day: string): Filter => ({ propertyName: prop, operator: "GTE", value: dayMs(day) });
const has = (prop: string): Filter => ({ propertyName: prop, operator: "HAS_PROPERTY" });

const BASE = ["name", "lifecyclestage", "order_first_order_date", "order_last_order_date", "order_total_orders"];

/** Only the stage entries a page reads - the rest would only make the cached read bigger. */
const only = (entries: Entry[], stages: string[]) => entries.filter((e) => stages.includes(e[0]));

function coOf(r: Rec, extra: Partial<Co> = {}): Co {
  const p = r.properties ?? {};
  const raw = p.order_total_orders;
  const orders = raw === null || raw === undefined || raw === "" ? null : Number(raw);
  return {
    id: String(r.id),
    name: (p.name ?? "").trim() || `Company ${r.id}`,
    stage: p.lifecyclestage || null,
    first: toDay(p.order_first_order_date),
    last: toDay(p.order_last_order_date),
    orders: orders !== null && Number.isFinite(orders) ? orders : null,
    ...extra,
  };
}

const num = (v: string | null | undefined) => {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : null;
};

/* ── shared pieces ─────────────────────────────────────────────────────── */

async function readTickets(key: string, workflows: string[]): Promise<Ticket[]> {
  if (!workflows.length) return [];
  const stages = await ticketStages();
  const rows = await searchAll(
    "tickets",
    [[{ propertyName: "hs_object_source_detail_1", operator: "IN", values: workflows }]],
    ["subject", "createdate", "hs_pipeline", "hs_pipeline_stage", "ticket_resolution_eso", "closed_date", "hs_object_source_detail_1", "hubspot_owner_id"],
    (n) => reportProgress(key, `reading the tickets · ${n0(n)}`),
  );
  reportProgress(key, "linking the tickets to their companies");
  const toCo = await associations("tickets", "companies", rows.map((r) => r.id));
  const out: Ticket[] = [];
  for (const r of rows) {
    const p = r.properties ?? {};
    const created = toDay(p.createdate);
    if (!created) continue;
    const st = stages.get(p.hs_pipeline_stage ?? "");
    out.push({
      id: String(r.id), created, closed: !!st?.closed, closedOn: toDay(p.closed_date),
      stage: st?.label ?? (p.hs_pipeline_stage ?? ""),
      team: p.hs_pipeline === PIPELINE.eso ? "ESO" : p.hs_pipeline === PIPELINE.tsa ? "TSA" : st?.pipelineLabel ?? "Other",
      resolution: p.ticket_resolution_eso?.trim() || null, subject: p.subject ?? "", workflow: p.hs_object_source_detail_1 ?? "",
      companyId: toCo.get(String(r.id))?.[0] ?? null,
      owner: p.hubspot_owner_id?.trim() || null,
    });
  }
  return out;
}

async function readTasks(key: string, workflows: string[], since: string): Promise<Task[]> {
  if (!workflows.length) return [];
  const rows = await searchAll(
    "tasks",
    [[{ propertyName: "hs_object_source_detail_1", operator: "IN", values: workflows }, gte("hs_createdate", since)]],
    ["hs_createdate", "hs_task_status", "hs_object_source_detail_1"],
    (n) => reportProgress(key, `reading the tasks · ${n0(n)}`),
  );
  const out: Task[] = [];
  for (const r of rows) {
    const p = r.properties ?? {};
    const created = toDay(p.hs_createdate);
    if (created) out.push({ id: String(r.id), created, done: p.hs_task_status === "COMPLETED", workflow: p.hs_object_source_detail_1 ?? "", companyId: null });
  }
  return out;
}

/** The latest task each group of workflows ever created - one search per group, all time. */
async function lastTasks(groups: { era: string; names: string[] }[]): Promise<{ era: string; day: string | null }[]> {
  const out: { era: string; day: string | null }[] = [];
  for (const g of groups) {
    if (!g.names.length) continue;
    const r = await newest("tasks", [{ propertyName: "hs_object_source_detail_1", operator: "IN", values: g.names }], "hs_createdate");
    out.push({ era: g.era, day: toDay(r?.properties?.hs_createdate) });
  }
  return out;
}

const erasOf = (tasks: { name: string; era?: string }[]) => {
  const m = new Map<string, string[]>();
  for (const t of tasks) m.set(t.era ?? "Tasks", [...(m.get(t.era ?? "Tasks") ?? []), t.name]);
  return [...m.entries()].map(([era, names]) => ({ era, names }));
};

/** Companies a ticket or task points at that the page's own read did not bring - names and order facts only. */
async function addMissing(key: string, companies: Co[], ids: (string | null)[], extraProps: string[] = [], extra?: (r: Rec) => Partial<Co>): Promise<void> {
  const have = new Set(companies.map((c) => c.id));
  const missing = [...new Set(ids.filter((id): id is string => !!id && !have.has(id)))];
  if (!missing.length) return;
  reportProgress(key, `reading ${n0(missing.length)} more companies`);
  const recs = await batchRead("companies", missing, [...BASE, ...extraProps]);
  for (const r of recs) companies.push(coOf(r, extra?.(r)));
}

/** The workflow's own outcome field, over every company that carries it - the side note. */
async function outcomeOf(key: string, prop: string, revenueProp: string): Promise<{ tally: { label: string; n: number }[]; revenue: { sum: number; n: number } }> {
  const rows = await searchAll("companies", [[has(prop)]], [prop, revenueProp], (n) => reportProgress(key, `reading the workflow's own outcome · ${n0(n)}`));
  let sum = 0, n = 0;
  for (const r of rows) {
    const v = num(r.properties?.[revenueProp]);
    if (v !== null) { sum += v; n += 1; }
  }
  return { tally: tally(rows.map((r) => r.properties?.[prop] ?? null)), revenue: { sum, n } };
}

function base(uc: UcKey, today: string): Omit<UcData, "companies" | "tickets" | "tasks" | "lastTask" | "sources"> {
  return { uc, generatedAt: new Date().toISOString(), today, horizon: HORIZON };
}

/* ── UC2 Welcome ───────────────────────────────────────────────────────── */

async function buildUc2(key: string): Promise<UcData> {
  const uc = ucOf("uc2");
  const today = todayZurich();
  const ids = (await searchAll("companies", [[gte(`hs_v2_date_entered_${STAGE.mql}`, HORIZON)]], ["hs_object_id"],
    (n) => reportProgress(key, `finding the companies that became an MQL · ${n0(n)}`))).map((r) => r.id);
  const recs = await batchRead("companies", ids, [...BASE, "hubspot_owner_id", UC2_QUAL, `hs_v2_date_entered_${STAGE.mql}`], ["lifecyclestage", UC2_QUAL],
    (n) => reportProgress(key, `reading their stage history · ${n0(n)} of ${n0(ids.length)}`));
  const companies = recs.map((r) => coOf(r, {
    entries: only(stageEntries(r.propertiesWithHistory?.lifecyclestage ?? [], HORIZON), [STAGE.mql, STAGE.sql, STAGE.lostLead]),
    enrolled: toDay(r.properties?.[`hs_v2_date_entered_${STAGE.mql}`]),
    owner: r.properties?.hubspot_owner_id?.trim() || null,
    qual: qualOf(r.propertiesWithHistory?.[UC2_QUAL] ?? []),
  }));
  // the buyers' ERP revenue by month - the overview's "revenue generated"
  const months = monthsFrom(HORIZON, today);
  const buyers = companies.filter((c) => c.first && c.first >= HORIZON).map((c) => c.id);
  if (buyers.length) {
    const byCo = new Map(companies.map((c) => [c.id, c]));
    const revs = await batchRead("companies", buyers, months.map(revProp), [],
      (n) => reportProgress(key, `reading the buyers' revenue · ${n0(n)} of ${n0(buyers.length)}`));
    for (const r of revs) {
      const c = byCo.get(String(r.id));
      if (c) c.rev = revenueByMonth(r.properties ?? {}, months);
    }
  }
  const tickets = await readTickets(key, uc.tickets.map((t) => t.name));
  await addMissing(key, companies, tickets.map((t) => t.companyId));
  const tasks = await readTasks(key, uc.tasks.map((t) => t.name), HORIZON);
  const lastTask = await lastTasks(erasOf(uc.tasks));
  const outcome = await outcomeOf(key, "uc2_outcome", "uc2_revenue");
  // only the names this page shows - who set the qualification, and the owners of the undecided
  reportProgress(key, "reading who qualified");
  const all = await people();
  const used = new Set(companies.flatMap((c) => [c.qual?.by ? `u:${c.qual.by}` : "", c.owner ? `o:${c.owner}` : ""]).filter(Boolean));
  const names = Object.fromEntries(Object.entries(all).filter(([k]) => used.has(k)));
  return {
    ...base("uc2", today), companies, tickets, tasks, lastTask, outcomeTally: outcome.tally, outcomeRevenue: outcome.revenue, people: names,
    sources: [
      { label: "companies that became an MQL since January 2025", n: ids.length },
      { label: "UC2 tickets", n: tickets.length },
      { label: "UC2 tasks since January 2025", n: tasks.length },
    ],
  };
}

/* ── UC15 Lost Leads ───────────────────────────────────────────────────── */

async function buildUc15(key: string): Promise<UcData> {
  const uc = ucOf("uc15");
  const today = todayZurich();
  const months = monthsFrom(UC15_BACKFILL_MONTH, today);
  const ids = (await searchAll("companies", [[has("uc15_outcome")]], ["hs_object_id"],
    (n) => reportProgress(key, `finding the companies in the flow · ${n0(n)}`))).map((r) => r.id);
  const recs = await batchRead("companies", ids, [...BASE, "uc15_outcome", "uc15_revenue", ...months.map(revProp)], ["uc15_outcome"],
    (n) => reportProgress(key, `reading when each entered the flow · ${n0(n)} of ${n0(ids.length)}`));
  const companies = recs.map((r) => {
    const c = coOf(r, {
      enrolled: enrolledOn(r.propertiesWithHistory?.uc15_outcome ?? []),
      outcome: r.properties?.uc15_outcome ?? null,
      outcomeRevenue: num(r.properties?.uc15_revenue),
    });
    // revenue is only shown for the companies that bought after entering - keep the cache small
    if (c.first && c.enrolled && c.first >= c.enrolled) c.rev = revenueByMonth(r.properties ?? {}, months);
    return c;
  });
  const withOutcome = companies.filter((c) => c.outcome);
  const tickets = await readTickets(key, uc.tickets.map((t) => t.name));
  await addMissing(key, companies, tickets.map((t) => t.companyId));
  const revs = withOutcome.map((c) => c.outcomeRevenue).filter((v): v is number => v !== null && v !== undefined);
  return {
    ...base("uc15", today), companies, tickets, tasks: [], lastTask: [],
    outcomeTally: tally(withOutcome.map((c) => c.outcome)),
    outcomeRevenue: { sum: revs.reduce((a, b) => a + b, 0), n: revs.length },
    sources: [{ label: "companies in the flow", n: ids.length }, { label: "UC15 tickets", n: tickets.length }],
  };
}

/* ── UC6 Thank You ─────────────────────────────────────────────────────── */

async function buildUc6(key: string): Promise<UcData> {
  const uc = ucOf("uc6");
  const today = todayZurich();
  const firsts = await searchAll("companies", [[gte("order_first_order_date", HORIZON)]], ["order_first_order_date"],
    (n) => reportProgress(key, `reading first purchasers · ${n0(n)}`));
  const firstDays = firsts.map((r) => toDay(r.properties?.order_first_order_date)).filter((d): d is string => !!d && d >= HORIZON).sort();
  const tickets = await readTickets(key, uc.tickets.map((t) => t.name));
  const companies: Co[] = [];
  await addMissing(key, companies, tickets.map((t) => t.companyId), ["first_purchase_survey_nps_rating"],
    (r) => ({ nps: num(r.properties?.first_purchase_survey_nps_rating) }));
  return {
    ...base("uc6", today), companies, tickets, tasks: [], lastTask: [], firstDays,
    sources: [{ label: "companies with a first order since January 2025", n: firstDays.length }, { label: "UC6 tickets", n: tickets.length }],
  };
}

/* ── UC9 Second Purchase ───────────────────────────────────────────────── */

async function buildUc9(key: string): Promise<UcData> {
  const uc = ucOf("uc9");
  const today = todayZurich();
  const ids = (await searchAll("companies", [[gte("order_first_order_date", HORIZON)]], ["hs_object_id"],
    (n) => reportProgress(key, `finding the new customers · ${n0(n)}`))).map((r) => r.id);
  const recs = await batchRead("companies", ids, BASE, ["lifecyclestage"],
    (n) => reportProgress(key, `reading their stage history · ${n0(n)} of ${n0(ids.length)}`));
  const companies = recs.map((r) => coOf(r, { entries: only(stageEntries(r.propertiesWithHistory?.lifecyclestage ?? [], HORIZON), [STAGE.grow, STAGE.newCustomerLost]) }));

  // the second order's day, from the orders themselves, counted as the company facts count them
  const two = companies.filter((c) => (c.orders ?? 0) >= 2);
  reportProgress(key, `finding the orders of ${n0(two.length)} customers with two or more`);
  const coOrders = await associations("companies", "orders", two.map((c) => c.id));
  const orderIds = [...new Set([...coOrders.values()].flat())];
  const orders = await batchRead("orders", orderIds, ["order_order_number", "order_order_date", "hs_pipeline", "hs_pipeline_stage"], [],
    (n) => reportProgress(key, `reading their orders · ${n0(n)} of ${n0(orderIds.length)}`));
  const lite = new Map<string, OrderLite>(orders.map((o) => [String(o.id), {
    number: o.properties?.order_order_number ?? null, date: o.properties?.order_order_date ?? null,
    pipeline: o.properties?.hs_pipeline ?? null, stage: o.properties?.hs_pipeline_stage ?? null,
  }]));
  for (const c of two) {
    const list = (coOrders.get(c.id) ?? []).map((id) => lite.get(id)).filter((o): o is OrderLite => !!o);
    c.second = secondOrderDay(list);
  }

  const tickets = await readTickets(key, uc.tickets.map((t) => t.name));
  await addMissing(key, companies, tickets.map((t) => t.companyId));
  const outcome = await outcomeOf(key, "uc9_outcome", "uc9_revenue");
  return {
    ...base("uc9", today), companies, tickets, tasks: [], lastTask: [], outcomeTally: outcome.tally, outcomeRevenue: outcome.revenue,
    sources: [
      { label: "new customers since January 2025", n: ids.length },
      { label: "their orders read for the second order", n: orders.length },
      { label: "UC9 tickets", n: tickets.length },
    ],
  };
}

/* ── UC10+11 Repeat Purchase ───────────────────────────────────────────── */

async function buildUc10(key: string): Promise<UcData> {
  const uc = ucOf("uc10");
  const today = todayZurich();
  const ids = (await searchAll("companies", [
    [gte(`hs_v2_date_entered_${STAGE.grow}`, HORIZON)],
    [gte(`hs_v2_date_entered_${STAGE.loyalty}`, HORIZON)],
    [{ propertyName: "lifecyclestage", operator: "IN", values: [STAGE.grow, STAGE.loyalty] }],
  ], ["hs_object_id"], (n) => reportProgress(key, `finding the repeat buyers · ${n0(n)}`))).map((r) => r.id);
  const recs = await batchRead("companies", ids, [...BASE, "order_avg_days_between_orders", "reason_for_no_repeat_purchase"], ["lifecyclestage"],
    (n) => reportProgress(key, `reading their stage history · ${n0(n)} of ${n0(ids.length)}`));
  const companies = recs.map((r) => coOf(r, {
    entries: only(stageEntries(r.propertiesWithHistory?.lifecyclestage ?? [], HORIZON), [STAGE.grow, STAGE.loyalty]),
    avgDays: num(r.properties?.order_avg_days_between_orders),
    reason: parts(r.properties?.reason_for_no_repeat_purchase).join(", ") || null,
  }));
  const reasonRows = await searchAll("companies", [[has("reason_for_no_repeat_purchase")]], ["reason_for_no_repeat_purchase"],
    (n) => reportProgress(key, `reading the reasons given · ${n0(n)}`));
  const reasons = tally(reasonRows.flatMap((r) => parts(r.properties?.reason_for_no_repeat_purchase)));
  const tasks = await readTasks(key, uc.tasks.map((t) => t.name), HORIZON);
  const lastTask = await lastTasks(erasOf(uc.tasks));
  return {
    ...base("uc10", today), companies, tickets: [], tasks, lastTask, reasons,
    sources: [
      { label: "companies in or through Grow / Nurture and Loyalty / Retain", n: ids.length },
      { label: "companies with a reason for no repeat purchase", n: reasonRows.length },
      { label: "reminder tasks since January 2025", n: tasks.length },
    ],
  };
}

/* ── UC13 Reactivation ─────────────────────────────────────────────────── */

async function buildUc13(key: string): Promise<UcData> {
  const uc = ucOf("uc13");
  const today = todayZurich();
  const months = monthsFrom(HORIZON, today);
  const ids = (await searchAll("companies", [[gte(`hs_v2_date_entered_${STAGE.churn}`, HORIZON)]], ["hs_object_id"],
    (n) => reportProgress(key, `finding the companies that entered Churn / Reactivate · ${n0(n)}`))).map((r) => r.id);
  const recs = await batchRead("companies", ids, [...BASE, ...months.map(revProp)], ["lifecyclestage"],
    (n) => reportProgress(key, `reading their stage history · ${n0(n)} of ${n0(ids.length)}`));
  const companies = recs.map((r) => {
    const entries = only(stageEntries(r.propertiesWithHistory?.lifecyclestage ?? [], HORIZON), [STAGE.churn, STAGE.reactivated, STAGE.notReactivated]);
    // revenue is only shown after a reactivation - keep the cache small
    const back = entries.some((e) => e[0] === STAGE.reactivated);
    return coOf(r, { entries, ...(back ? { rev: revenueByMonth(r.properties ?? {}, months) } : {}) });
  });
  const tasks = await readTasks(key, uc.tasks.map((t) => t.name), HORIZON);
  const lastTask = await lastTasks(erasOf(uc.tasks));
  return {
    ...base("uc13", today), companies, tickets: [], tasks, lastTask,
    sources: [{ label: "companies that entered Churn / Reactivate since January 2025", n: ids.length }, { label: "UC13 tasks since January 2025", n: tasks.length }],
  };
}

/* ── UC4 Abandoned Cart ────────────────────────────────────────────────── */

async function buildUc4(key: string): Promise<UcData> {
  const uc = ucOf("uc4");
  const today = todayZurich();
  const cartRows = await searchAll("contacts", [[gte("eyemagine_abandoned_created_at", HORIZON)]], ["eyemagine_abandoned_created_at", "associatedcompanyid"],
    (n) => reportProgress(key, `reading abandoned carts · ${n0(n)}`));
  const carts: [string, string | null][] = [];
  for (const r of cartRows) {
    const d = toDay(r.properties?.eyemagine_abandoned_created_at);
    if (d && d >= HORIZON) carts.push([d, companyOfContact(r.properties?.associatedcompanyid)]);
  }
  const orderRows = await searchAll("orders", [[{ propertyName: "order_channel", operator: "EQ", value: "eshop" }, gte("order_order_date", HORIZON)]], ["order_order_date"],
    (n) => reportProgress(key, `reading web-shop orders · ${n0(n)}`));
  reportProgress(key, "linking the web orders to their companies");
  const orderCo = await associations("orders", "companies", orderRows.map((r) => r.id));
  const web: Record<string, string[]> = {};
  for (const r of orderRows) {
    const d = toDay(r.properties?.order_order_date);
    const co = orderCo.get(String(r.id))?.[0];
    if (d && co) (web[co] ??= []).push(d);
  }
  for (const k of Object.keys(web)) web[k] = [...new Set(web[k])].sort();
  const tickets = await readTickets(key, uc.tickets.map((t) => t.name));
  const companies: Co[] = [];
  await addMissing(key, companies, tickets.map((t) => t.companyId));
  return {
    ...base("uc4", today), companies, tickets, tasks: [], lastTask: [], carts, webOrders: web,
    sources: [
      { label: "contacts with an abandoned cart since January 2025", n: cartRows.length },
      { label: "web-shop orders since January 2025", n: orderRows.length },
      { label: "UC4 tickets", n: tickets.length },
    ],
  };
}

/* ── UC12 Revenue Drop ─────────────────────────────────────────────────── */

async function buildUc12(key: string): Promise<UcData> {
  const uc = ucOf("uc12");
  const today = todayZurich();
  const tasks = await readTasks(key, uc.tasks.map((t) => t.name), HORIZON);
  reportProgress(key, "linking the flags to their companies");
  const taskCo = await associations("tasks", "companies", tasks.map((t) => t.id));
  for (const t of tasks) t.companyId = taskCo.get(t.id)?.[0] ?? null;
  const months = monthsFrom(shiftMonth(monthOf(HORIZON), -12), today);
  const companies: Co[] = [];
  await addMissing(key, companies, tasks.map((t) => t.companyId), ["customer_value_segmentation", ...months.map(revProp)],
    (r) => ({ segment: r.properties?.customer_value_segmentation ?? null, rev: revenueByMonth(r.properties ?? {}, months) }));
  const erosionRows = await searchAll("tickets", [[has("erosion_key")]], ["hs_object_id"], (n) => reportProgress(key, `reading erosion tickets · ${n0(n)}`));
  const erosionCo = await associations("tickets", "companies", erosionRows.map((r) => r.id));
  const erosion = [...new Set([...erosionCo.values()].flat())];
  return {
    ...base("uc12", today), companies, tickets: [], tasks, lastTask: await lastTasks(erasOf(uc.tasks)), erosion,
    sources: [{ label: "revenue-drop tasks since January 2025", n: tasks.length }, { label: "flagged companies", n: companies.length }, { label: "erosion tickets", n: erosionRows.length }],
  };
}

/* ── the overview ──────────────────────────────────────────────────────── */

async function buildOverview(key: string): Promise<OverviewData> {
  const today = todayZurich();
  const now: { stage: string; n: number }[] = [];
  for (const s of STAGES) {
    reportProgress(key, `counting companies per stage · ${s.label}`);
    now.push({ stage: s.id, n: await countOf("companies", [{ propertyName: "lifecyclestage", operator: "EQ", value: s.id }]) });
  }
  const noStage = await countOf("companies", [{ propertyName: "lifecyclestage", operator: "NOT_HAS_PROPERTY" }]);
  const total = await countOf("companies", []);

  // any company that changed stage since the horizon has its CURRENT stage entered since then
  const ids = (await searchAll("companies", [[gte("hs_v2_date_entered_current_stage", HORIZON)]], ["hs_object_id"],
    (n) => reportProgress(key, `finding companies that changed stage · ${n0(n)}`))).map((r) => r.id);
  const counts = new Map<string, number>();
  await batchEach("companies", ids, ["hs_object_id"], ["lifecyclestage"], (recs) => {
    for (const r of recs) {
      for (const [stage, day, src] of stageEntries(r.propertiesWithHistory?.lifecyclestage ?? [], HORIZON)) {
        const k = `${day}|${stage}|${src}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }, (n) => reportProgress(key, `reading stage histories · ${n0(n)} of ${n0(ids.length)}`));
  const entries = [...counts.entries()].map(([k, n]) => {
    const [day, stage, src] = k.split("|");
    return { day, stage, src: src as Src, n };
  }).sort((a, b) => a.day.localeCompare(b.day));

  const u10 = ucOf("uc10").tasks, u13 = ucOf("uc13").tasks;
  const lastTask = await lastTasks([
    { era: "UC10", names: u10.filter((t) => t.era === "UC10").map((t) => t.name) },
    { era: "UC11", names: u10.filter((t) => t.era === "UC11").map((t) => t.name) },
    { era: "UC13", names: u13.filter((t) => t.era === "Follow-up").map((t) => t.name) },
  ]);
  const sources: Source[] = [
    { label: "companies", n: total },
    { label: "companies whose stage history was read (changed stage since January 2025)", n: ids.length },
  ];
  return { generatedAt: new Date().toISOString(), today, horizon: HORIZON, now, noStage, total, entries, lastTask, sources };
}

/* ── the email sends, every page ───────────────────────────────────────── */

async function buildEmails(key: string): Promise<EmailData> {
  const ids = (await searchAll("contacts", [[gte("hs_email_last_send_date", HORIZON)]], ["hs_object_id"],
    (n) => reportProgress(key, `finding contacts sent an email since January 2025 · ${n0(n)}`))).map((r) => r.id);
  const names: string[] = [], nameIdx = new Map<string, number>();
  const companies: string[] = [], coIdx = new Map<string, number>();
  const sends: Send[] = [];
  let read = 0;
  await batchEach("contacts", ids, ["associatedcompanyid"], ["hs_email_last_email_name"], (recs) => {
    for (const r of recs) {
      read += 1;
      const co = companyOfContact(r.properties?.associatedcompanyid);
      let ci = -1;
      if (co) {
        ci = coIdx.get(co) ?? -1;
        if (ci < 0) { ci = companies.length; companies.push(co); coIdx.set(co, ci); }
      }
      for (const s of sendsOf(r.propertiesWithHistory?.hs_email_last_email_name ?? [], HORIZON)) {
        // only the UCs a page reports (UC5, UC7 and the like are older programmes)
        if (!ucForEmailNumber(parseEmailName(s.name)?.uc ?? "")) continue;
        let ni = nameIdx.get(s.name);
        if (ni === undefined) { ni = names.length; names.push(s.name); nameIdx.set(s.name, ni); }
        sends.push([ni, s.day, ci]);
      }
    }
  }, (n) => reportProgress(key, `reading email histories · ${n0(n)} of ${n0(ids.length)} contacts`));

  // each emailed company's last real order: "ordered after the email"
  const sent = [...new Set(sends.map((s) => s[2]).filter((ci) => ci >= 0))];
  const lastOrder: (string | null)[] = companies.map(() => null);
  if (sent.length) {
    await batchEach("companies", sent.map((ci) => companies[ci]), ["order_last_order_date"], [], (recs) => {
      for (const r of recs) {
        const ci = coIdx.get(String(r.id));
        if (ci !== undefined) lastOrder[ci] = toDay(r.properties?.order_last_order_date);
      }
    }, (n) => reportProgress(key, `reading the companies' last order · ${n0(n)} of ${n0(sent.length)}`));
  }

  let stats: EmailData["stats"] = null;
  let statsError: string | null = null;
  if (emailStatsToken()) {
    try {
      reportProgress(key, "reading email statistics");
      stats = await readEmailStats(new Set(names));
    } catch (e) {
      statsError = String((e as Error)?.message ?? e);
    }
  }
  return { generatedAt: new Date().toISOString(), horizon: HORIZON, contactsRead: read, names, companies, sends, stats, statsError, lastOrder };
}

/* ── the cache ─────────────────────────────────────────────────────────── */

const BUILD: Record<UcKey, (key: string) => Promise<UcData>> = {
  uc2: buildUc2, uc15: buildUc15, uc6: buildUc6, uc9: buildUc9, uc10: buildUc10, uc13: buildUc13, uc4: buildUc4, uc12: buildUc12,
};

export function overviewState(): Promise<SlowState<OverviewData>> {
  const key = keyOf("overview");
  return slowReport(key, TTL_MS, () => buildOverview(key));
}

/** The ticket owners' names, beside whatever names the page read already. */
async function withOwnerNames(d: UcData): Promise<UcData> {
  const ids = new Set(d.tickets.map((t) => (t.owner ? `o:${t.owner}` : "")).filter(Boolean));
  if (!ids.size) return d;
  const all = await people();
  const names: Record<string, string> = { ...(d.people ?? {}) };
  for (const id of ids) if (all[id]) names[id] = all[id];
  return { ...d, people: names };
}

/** The ticket UCs whose tickets get a win rate and "revenue generated". */
const TICKET_REVENUE: UcKey[] = ["uc15", "uc6", "uc9", "uc4"];

/** Each ticket company's last real order and its ERP revenue by month since January 2025. */
async function withTicketRevenue(k: UcKey, key: string, d: UcData): Promise<UcData> {
  if (!TICKET_REVENUE.includes(k)) return d;
  const ids = [...new Set(d.tickets.map((t) => t.companyId).filter((x): x is string => !!x))];
  const months = monthsFrom(HORIZON, d.today);
  const ticketCos: NonNullable<UcData["ticketCos"]> = {};
  if (ids.length) {
    const recs = await batchRead("companies", ids, ["order_last_order_date", ...months.map(revProp)], [],
      (n) => reportProgress(key, `reading the ticket companies' revenue · ${n0(n)} of ${n0(ids.length)}`));
    for (const r of recs) ticketCos[String(r.id)] = { last: toDay(r.properties?.order_last_order_date), rev: revenueByMonth(r.properties ?? {}, months) };
  }
  return { ...d, ticketCos };
}

export function ucState(k: UcKey): Promise<SlowState<UcData>> {
  const key = keyOf(k);
  return slowReport(key, TTL_MS, async () => withTicketRevenue(k, key, await withOwnerNames(await BUILD[k](key))));
}

export function emailState(): Promise<SlowState<EmailData>> {
  const key = keyOf("emails");
  return slowReport(key, TTL_MS, () => buildEmails(key));
}

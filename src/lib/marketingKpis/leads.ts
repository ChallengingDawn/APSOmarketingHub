// LEAD GENERATION - the read (the rules are in leadsCube.ts). SARCLA 18.10.2026: a lead is a new
// contact on a new company. From January last year, month by month: HubSpot's new contacts (their
// original source), their companies (when the company came in, country, owner, the owner's
// qualification, first order, orders, revenue), and on the new companies their ESO and TSA tickets
// and their UC2 qualification tasks (ESO qualified from a task until 1 October 2026, a ticket since).
// A few minutes; read every 6 hours, the page shows the last read meanwhile.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { channelOf, howOf, qualOf, type LeadRow, type LeadsData } from "./leadsCube";
import { UCS } from "@/lib/lifecycle/config";
import { associations, searchAll } from "@/lib/lifecycle/read";

// v2: the UC2 qualification tasks counted as the way to sales too; v3: how the first contact was
// made, and a ticket or task counted from the first contact on (both 18.10)
const KEY = "marketingKpis:leads:v3";
const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 30 * 60 * 1000;
const SALES_PIPES = new Set(["1726599376", "1726599377"]); // ESO, TSA
/** a company counts as new when it came in at most this long before its first new contact */
const NEW_SLACK_MS = 7 * 86_400_000;
const DAY = 86_400_000;

type Page<T> = { results?: T[]; paging?: { next?: { after?: string } } };
type Obj = { id: string; properties?: Record<string, string | null> };

export function leadsData(): Promise<SlowState<LeadsData>> {
  return slowReport(KEY, (v: LeadsData) => (Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS : TTL_MS), buildLeads);
}

/** A HubSpot date or datetime ("2026-09-14", "2026-09-14T08:00:00Z" or milliseconds) as milliseconds. */
const ms = (v: string | null | undefined): number | null => {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = /^\d+$/.test(t) ? Number(t) : Date.parse(t);
  return Number.isFinite(n) ? n : null;
};
const monthOf = (t: number) => new Date(t).toISOString().slice(0, 7);

/** The read itself (exported for a local check; the page goes through leadsData). */
export async function buildLeads(): Promise<LeadsData> {
  const now = new Date();
  const year = now.getUTCFullYear(), py = year - 1;
  const errors: Record<string, string> = {};

  // 1. the new contacts, month by month from January last year
  type C = { id: string; t: number; company: string | null; channel: string; how: string };
  const contacts: C[] = [];
  const perMonth: LeadsData["contacts"] = {};
  for (let y = py, m = 0; y < year || m <= now.getUTCMonth(); m === 11 ? (y++, m = 0) : m++) {
    const a = Date.UTC(y, m, 1), b = Date.UTC(y, m + 1, 1);
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    reportProgress(KEY, `reading the new contacts of ${key}`);
    let after: string | undefined;
    try {
      for (let page = 0; page < 50; page++) {
        const j = await hubspotFetchJson<Page<Obj>>({
          path: "/crm/v3/objects/contacts/search", method: "POST",
          body: {
            filterGroups: [{ filters: [{ propertyName: "createdate", operator: "GTE", value: String(a) }, { propertyName: "createdate", operator: "LT", value: String(b) }] }],
            properties: ["createdate", "associatedcompanyid", "hs_analytics_source", "hs_analytics_source_data_1", "hs_analytics_source_data_2", "hs_object_source", "hs_object_source_detail_1"],
            limit: 200, ...(after ? { after } : {}),
          },
        });
        for (const c of j.results ?? []) {
          const p = c.properties ?? {};
          const t = ms(p.createdate);
          if (t == null) continue;
          contacts.push({ id: String(c.id), t, company: p.associatedcompanyid ? String(p.associatedcompanyid) : null, channel: channelOf(p.hs_analytics_source, p.hs_analytics_source_data_1, p.hs_analytics_source_data_2), how: howOf(p.hs_object_source, p.hs_object_source_detail_1) });
        }
        after = j.paging?.next?.after;
        if (!after) break;
      }
    } catch (e) {
      errors[`contacts ${key}`] = String((e as Error)?.message ?? e).slice(0, 200);
    }
  }

  // 2. their companies
  const ids = [...new Set(contacts.map((c) => c.company).filter((x): x is string => !!x))];
  const cos = new Map<string, Record<string, string | null>>();
  for (let i = 0; i < ids.length; i += 100) {
    if (i % 2000 === 0) reportProgress(KEY, `reading the companies, ${i} of ${ids.length}`);
    try {
      const j = await hubspotFetchJson<{ results?: Obj[] }>({
        path: "/crm/v3/objects/companies/batch/read", method: "POST",
        body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["createdate", "country_custom", "country", "hubspot_owner_id", "order_first_order_date", "order_total_orders", "qualified_by_company_owner", `revenue_${py}`, `revenue_${year}`] },
      });
      for (const c of j.results ?? []) cos.set(String(c.id), c.properties ?? {});
    } catch (e) {
      errors.companies = String((e as Error)?.message ?? e).slice(0, 200);
    }
  }

  // the new companies: came in at most a week before their first new contact, from January last year on
  const firstOf = new Map<string, C>();
  for (const c of contacts) if (c.company && (!firstOf.has(c.company) || c.t < firstOf.get(c.company)!.t)) firstOf.set(c.company, c);
  const leads = new Map<string, { created: number; first: C; n: number }>();
  for (const [id, first] of firstOf) {
    const created = ms(cos.get(id)?.createdate);
    if (created == null || created < Date.UTC(py, 0, 1) || created < first.t - NEW_SLACK_MS) continue;
    leads.set(id, { created, first, n: 0 });
  }
  for (const c of contacts) {
    const l = c.company ? leads.get(c.company) : undefined;
    if (l && c.t - l.created < 31 * DAY) l.n += 1;
  }
  for (const c of contacts) {
    const k = monthOf(c.t);
    const e = (perMonth[k] ??= { all: 0, onNew: 0, noCompany: 0 });
    e.all += 1;
    if (!c.company) e.noCompany += 1;
    else if (leads.has(c.company)) e.onNew += 1;
  }

  // 3. on the new companies, their ESO and TSA tickets
  const leadIds = [...leads.keys()];
  const ticketsOf = new Map<string, string[]>();
  for (let i = 0; i < leadIds.length; i += 100) {
    if (i % 2000 === 0) reportProgress(KEY, `reading the new companies' tickets, ${i} of ${leadIds.length}`);
    try {
      const j = await hubspotFetchJson<{ results?: { from?: { id?: string | number }; to?: { toObjectId?: string | number }[] }[] }>({
        path: "/crm/v4/associations/companies/tickets/batch/read", method: "POST",
        body: { inputs: leadIds.slice(i, i + 100).map((id) => ({ id })) },
      });
      for (const r of j.results ?? []) if (r.from?.id != null) ticketsOf.set(String(r.from.id), (r.to ?? []).map((t) => String(t.toObjectId)));
    } catch (e) {
      errors.associations = String((e as Error)?.message ?? e).slice(0, 200);
    }
  }
  const tIds = [...new Set([...ticketsOf.values()].flat())];
  const tickets = new Map<string, { pipe: string; t: number }>();
  for (let i = 0; i < tIds.length; i += 100) {
    if (i % 2000 === 0) reportProgress(KEY, `reading the tickets, ${i} of ${tIds.length}`);
    try {
      const j = await hubspotFetchJson<{ results?: Obj[] }>({
        path: "/crm/v3/objects/tickets/batch/read", method: "POST",
        body: { inputs: tIds.slice(i, i + 100).map((id) => ({ id })), properties: ["hs_pipeline", "createdate"] },
      });
      for (const t of j.results ?? []) {
        const at = ms(t.properties?.createdate);
        if (at != null) tickets.set(String(t.id), { pipe: String(t.properties?.hs_pipeline ?? ""), t: at });
      }
    } catch (e) {
      errors.tickets = String((e as Error)?.message ?? e).slice(0, 200);
    }
  }

  // 3b. the UC2 qualification tasks (until 1 October 2026), by the workflow that made them, and their companies
  const taskNames = UCS.find((u) => u.key === "uc2")?.tasks.map((t) => t.name) ?? [];
  const tasksOf = new Map<string, { t: number; done: boolean }[]>();
  if (taskNames.length) {
    reportProgress(KEY, "reading the UC2 qualification tasks");
    try {
      // paged by id, as the lifecycle reports read them: HubSpot's own paging stops at 10,000 and
      // there are more UC2 tasks than that since January last year
      const rows = await searchAll("tasks", [[{ propertyName: "hs_object_source_detail_1", operator: "IN", values: taskNames }, { propertyName: "hs_createdate", operator: "GTE", value: String(Date.UTC(py, 0, 1)) }]],
        ["hs_createdate", "hs_task_status"], (n) => reportProgress(KEY, `reading the UC2 qualification tasks · ${n.toLocaleString("en")}`));
      const found = rows.flatMap((t) => { const at = ms(t.properties?.hs_createdate); return at == null ? [] : [{ id: String(t.id), t: at, done: t.properties?.hs_task_status === "COMPLETED" }]; });
      reportProgress(KEY, "linking the UC2 tasks to their companies");
      const toCo = await associations("tasks", "companies", found.map((t) => t.id));
      for (const t of found) for (const c of toCo.get(t.id) ?? []) (tasksOf.get(c) ?? tasksOf.set(c, []).get(c)!).push({ t: t.t, done: t.done });
    } catch (e) {
      errors.tasks = String((e as Error)?.message ?? e).slice(0, 200);
    }
  }

  // 4. the owners' names
  const owners: Record<string, string> = {};
  reportProgress(KEY, "reading the owners");
  try {
    let after: string | undefined;
    do {
      const j = await hubspotFetchJson<Page<{ id: string; firstName?: string; lastName?: string; email?: string }>>({ path: `/crm/v3/owners?limit=100&archived=false${after ? `&after=${after}` : ""}` });
      for (const o of j.results ?? []) owners[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || String(o.id);
      after = j.paging?.next?.after;
    } while (after);
  } catch (e) {
    errors.owners = String((e as Error)?.message ?? e).slice(0, 200);
  }

  const rows: LeadRow[] = [];
  for (const [id, l] of leads) {
    const p = cos.get(id) ?? {};
    // from the first new contact on, or the company if it came first: HubSpot often makes the company
    // days after the person wrote in, and the ticket of that first message counts (97 of them, 18.10)
    const since = Math.min(l.created, l.first.t) - DAY;
    const sales = (ticketsOf.get(id) ?? []).map((t) => tickets.get(t)).filter((t): t is { pipe: string; t: number } => !!t && SALES_PIPES.has(t.pipe) && t.t >= since);
    const tasks = (tasksOf.get(id) ?? []).filter((t) => t.t >= since);
    const firstTicket = sales.length ? Math.min(...sales.map((t) => t.t)) : null;
    const firstTask = tasks.length ? Math.min(...tasks.map((t) => t.t)) : null;
    const firstSales = firstTicket == null ? firstTask : firstTask == null ? firstTicket : Math.min(firstTicket, firstTask);
    const firstOrder = ms(p.order_first_order_date);
    rows.push({
      m: monthOf(l.created), c: l.first.channel, h: l.first.how, k: (p.country_custom || p.country || "").trim() || "Unknown", o: p.hubspot_owner_id ?? "",
      n: Math.max(1, l.n), q: qualOf(p.qualified_by_company_owner), s: firstSales != null,
      via: firstSales == null ? null : firstTask != null && firstTask === firstSales ? "task" : "ticket",
      td: tasks.some((t) => t.done),
      f: firstOrder != null ? monthOf(firstOrder) : null,
      a: firstOrder != null && (firstSales == null || firstSales > firstOrder),
      orders: Number(p.order_total_orders) || 0,
      rev: (Number(p[`revenue_${py}`]) || 0) + (Number(p[`revenue_${year}`]) || 0),
    });
  }
  rows.sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : 0));
  return { rows, owners, year, monthsDone: now.getUTCMonth(), contacts: perMonth, readAt: new Date().toISOString(), errors };
}

// TICKET VALUE - LIVE (SARCLA 21.10.2026: "if yes I will activate and take out all reference to the past workflow").
// The hub writes what its rules give (decideHub): the value, its source and confidence on the ticket - only what
// changes -, the ticket -> company link, and the rows of the KPI object (sales_funnel|<kind>|tid<id>) the Customer
// journey KPIs read. It writes only once the workflow SARCLA | TICKET VALUE CALCULATION (flow 4326395107) is switched
// off in HubSpot - until then the page says so and the hub stays in shadow - so the two never write at once.
// Two one-time jobs when it starts (his answers 21.10): every open ESO/TSA ticket valued once with the hub's rules; the
// values the workflow left on Back Office, GQS and Special Prices tickets cleared (a person's own value is kept), and
// their open-ticket rows in the KPI object counted without a value. Every change is logged with what was there before
// (kv ticketValue:log:<time>:<job>), so it can be put back.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { IntegrationError } from "@/lib/integrations/status";
import { ALL_CLOSED_STAGES, KPI_OBJ, PIPELINES, TICKET_PROPS, decideHub, lastEditorIsHuman, type Api, type Better, type HistoryEntry, type HubRule, type KpiRow, type Patch } from "./rules";
import { finalOf, type Values } from "./model";

export const WORKFLOW_ID = "4326395107";
const VALUE_PROPS = ["sales_potential_estimate", "sales_potential_source", "sales_potential_confidence"] as const;
const ESO = "1726599376", TSA = "1726599377";
const NO_VALUE_PIPES = Object.keys(PIPELINES).filter((p) => p !== ESO && p !== TSA);
const REVALUE_PER_RUN = 30;
const CLEAR_PAGES_PER_RUN = 2;

type Raw = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, HistoryEntry[]> };
const valuesOf = (p: Record<string, string | null | undefined>): Values => ({ sales_potential_estimate: p.sales_potential_estimate ?? null, sales_potential_source: p.sales_potential_source ?? null, sales_potential_confidence: p.sales_potential_confidence ?? null });

// ---------------- is the workflow still on? ----------------
let wfCache: { at: number; on: boolean | null } | null = null;
/** true = the workflow still runs (the hub waits), false = switched off, null = could not be read (the hub waits too). */
export async function workflowOn(): Promise<boolean | null> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.on;
  let on: boolean | null = null;
  try { on = !!(await hubspotRetry<{ isEnabled?: boolean }>({ path: `/automation/v4/flows/${WORKFLOW_ID}` })).isEnabled; } catch { on = null; }
  wfCache = { at: Date.now(), on };
  return on;
}

// ---------------- HubSpot, writing ----------------
/** As the shadow's, but the ticket -> company link is made. */
export function liveApi(links: string[]): Api {
  const seen = new Map<string, Promise<{ status: number; json: unknown }>>();
  const call = (path: string, method: "GET" | "POST" | "PUT", body?: unknown) => hubspotRetry<unknown>({ path, method, body }).then((json) => ({ status: 200, json }), (e) => ({ status: e instanceof IntegrationError && e.status ? e.status : 0, json: {} }));
  const read = (path: string, method: "GET" | "POST", body?: unknown) => {
    const key = `${method} ${path} ${body === undefined ? "" : JSON.stringify(body)}`;
    if (!seen.has(key)) seen.set(key, call(path, method, body));
    return seen.get(key)!;
  };
  return { get: (p) => read(p, "GET"), post: (p, b) => read(p, "POST", b), put: async (p) => { const r = await call(p, "PUT"); if (r.status === 200) links.push(p); return r; } };
}

const asProps = (patch: Patch) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)]));
async function writeTicket(id: string, patch: Patch) {
  await hubspotRetry({ path: `/crm/v3/objects/tickets/${id}`, method: "PATCH", body: { properties: asProps(patch) } });
}

/** The KPI object's rows by name, as the workflow kept them: found, then updated - or made; archived ones gone. */
async function kpiIdOf(name: string): Promise<string | null> {
  const r = await hubspotRetry<{ results?: { id: string }[] }>({ path: `/crm/v3/objects/${KPI_OBJ}/search`, method: "POST", body: { filterGroups: [{ filters: [{ propertyName: "name", operator: "EQ", value: name }] }], properties: ["name"], limit: 1 } });
  return r.results?.[0]?.id ?? null;
}
export async function writeKpi(rows: KpiRow[], archive: string[]): Promise<number> {
  let n = 0;
  for (const r of rows) {
    const id = await kpiIdOf(r.name);
    if (id) await hubspotRetry({ path: `/crm/v3/objects/${KPI_OBJ}/${id}`, method: "PATCH", body: { properties: r.props } });
    else await hubspotRetry({ path: `/crm/v3/objects/${KPI_OBJ}`, method: "POST", body: { properties: r.props } });
    n++;
  }
  for (const name of archive) {
    const id = await kpiIdOf(name);
    if (!id) continue;
    await hubspotRetry({ path: `/crm/v3/objects/${KPI_OBJ}/batch/archive`, method: "POST", body: { inputs: [{ id }] } });
    n++;
  }
  return n;
}

// ---------------- the log: what was there before ----------------
export type LogEntry = { id: string; job: "ticket" | "revalue" | "clear" | "kpi"; before: Values | Record<string, string | number | null>; after: Values | Record<string, string | number | null> | null; rule?: HubRule; link?: string | null };
async function log(job: LogEntry["job"], entries: LogEntry[]) {
  if (entries.length) await kvSet(`ticketValue:log:${new Date().toISOString()}:${job}`, entries);
}

// ---------------- one ticket, live ----------------
export type Written = { at: string; changed: boolean; link?: string | null; kpi: number; error?: string };
export type LiveResult = {
  subject: string; pipeline: string; before: Values;
  better: { rule: HubRule; action: string; final: Values; company?: string | null };
  written: Written;
};

/** Read the ticket, decide with the hub's rules, write what changes, the link, the KPI rows; log it. */
export async function liveTicket(id: string, better: Better, job: "ticket" | "revalue" = "ticket", raw?: Raw): Promise<LiveResult> {
  const t = raw ?? await hubspotRetry<Raw>({ path: `/crm/v3/objects/tickets/${id}?properties=${TICKET_PROPS.join(",")}&propertiesWithHistory=${VALUE_PROPS.join(",")}` });
  const p = t.properties ?? {};
  const human = lastEditorIsHuman(t.propertiesWithHistory?.sales_potential_estimate);
  const before = valuesOf(p);
  const links: string[] = [];
  const d = await decideHub(liveApi(links), id, p, human, new Date().toISOString().slice(0, 10), better);
  const final = finalOf(before, d.patch);
  const written: Written = { at: new Date().toISOString(), changed: false, kpi: 0, link: links[0]?.split("/").pop() ?? null };
  try {
    if (d.patch) { await writeTicket(id, d.patch); written.changed = true; }
    // the re-valuing keeps the open-ticket row of the KPI object right; a live ticket writes all its rows
    if (d.kpi?.rows) {
      const rows = job === "revalue" ? d.kpi.rows.filter((r) => /\|(live|mo)\|/.test(r.name)) : d.kpi.rows;
      const archive = job === "revalue" ? d.kpi.archive.filter((n) => /\|(live|mo)\|/.test(n)) : d.kpi.archive;
      if (job !== "revalue" || written.changed) written.kpi = await writeKpi(rows, archive);
    }
  } catch (e) {
    written.error = (e as Error).message.slice(0, 200);
  }
  if (written.changed || written.link) await log(job, [{ id, job, before, after: written.changed ? final : null, rule: d.rule, link: written.link }]);
  return {
    subject: (p.subject ?? "").slice(0, 160), pipeline: PIPELINES[p.hs_pipeline ?? ""] ?? "other", before,
    better: { rule: d.rule, action: d.action, final, company: d.scored?.company ? `${d.scored.company.id} (${d.scored.company.via})` : null }, written,
  };
}

type Page = { results?: Raw[]; paging?: { next?: { after?: string } } };
const closedStages = [...ALL_CLOSED_STAGES];

// ---------------- ESO/TSA tickets still without a value (24.10.2026) ----------------
// A ticket handed over from Back Office ("Redirected from Back-Office") was created in Back Office - no value there - and
// enters ESO/TSA at no moment the hub watches; an outage leaves tickets behind too (22.10: 24 found). The old workflow
// caught both because "value unknown" was itself a reason for it to run. So every run the hub also takes the newest ESO/TSA
// tickets that have no value at all - 30 a run; a ticket that could not be written is tried again after 6 hours.
const SWEEP_PER_RUN = 30;
const sweepTried = new Map<string, number>();
export async function sweepUnvalued(better: Better, more: () => boolean): Promise<{ id: string; r: LiveResult }[]> {
  const page = await hubspotRetry<Page>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
    filterGroups: [ESO, TSA].map((pipe) => ({ filters: [
      { propertyName: "hs_pipeline", operator: "EQ", value: pipe },
      { propertyName: "sales_potential_source", operator: "NOT_HAS_PROPERTY" },
      // the 4 minutes a new ticket is given before its first look
      { propertyName: "createdate", operator: "LTE", value: String(Date.now() - 4 * 60_000) },
    ] })),
    properties: ["hs_object_id"], sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: 100,
  } });
  const out: { id: string; r: LiveResult }[] = [];
  for (const t of page.results ?? []) {
    if (out.length >= SWEEP_PER_RUN || !more()) break;
    const id = String(t.id);
    const last = sweepTried.get(id);
    if (last && Date.now() - last < 6 * 3600_000) continue;
    sweepTried.set(id, Date.now());
    try { out.push({ id, r: await liveTicket(id, better) }); } catch { /* tried again in 6 hours */ }
  }
  if (sweepTried.size > 5000) for (const [k, v] of sweepTried) if (Date.now() - v > 6 * 3600_000) sweepTried.delete(k);
  return out;
}

// ---------------- the open pipeline's value (SARCLA 21.10.2026: "as an extra KPI the value of the pipeline, ESO and TSA") ----
export type PipeValue = { pipeline: "ESO" | "TSA"; open: number; value: number; byConf: Record<string, { n: number; value: number }> };
export type PipelineValue = { at: string; pipes: PipeValue[] };
const KV_PIPE = "ticketValue:pipeline";
export const pipelineState = async () => (await kvGet<PipelineValue>(KV_PIPE)) ?? null;
/** Every open ESO and TSA ticket's value added up, by confidence - worked out again every 30 minutes. */
export async function pipelineStep(more: () => boolean): Promise<void> {
  const cur = await pipelineState();
  if (cur && Date.now() - Date.parse(cur.at) < 30 * 60_000) return;
  const pipes: PipeValue[] = [];
  for (const [id, name] of [[ESO, "ESO"], [TSA, "TSA"]] as const) {
    const p: PipeValue = { pipeline: name, open: 0, value: 0, byConf: {} };
    let cursor = "0";
    for (let page = 0; page < 200; page++) {
      if (!more()) return; // half a count is no count: try again next run
      const r = await hubspotRetry<Page>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
        filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: id }, { propertyName: "hs_pipeline_stage", operator: "NOT_IN", values: closedStages }, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
        properties: ["sales_potential_estimate", "sales_potential_confidence"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 100,
      } });
      const res = r.results ?? [];
      for (const t of res) {
        const v = Number(t.properties.sales_potential_estimate) || 0;
        const c = (t.properties.sales_potential_confidence ?? "").trim() || "(none)";
        p.open++;
        p.value += v;
        const e = (p.byConf[c] ??= { n: 0, value: 0 });
        e.n++;
        e.value += v;
      }
      if (res.length < 100) break;
      cursor = String(res[res.length - 1].id);
    }
    pipes.push(p);
  }
  await kvSet(KV_PIPE, { at: new Date().toISOString(), pipes });
}

// ---------------- the two one-time jobs ----------------
export type Jobs = {
  started: string | null;
  revalue: { cursor: string; done: number; changed: number; errors: number; finished: string | null };
  clear: { cursor: string; done: number; cleared: number; keptTyped: number; kpiCursor: string; kpiFixed: number; finished: string | null };
};
const KV_JOBS = "ticketValue:jobs";
const freshJobs = (): Jobs => ({ started: new Date().toISOString(), revalue: { cursor: "0", done: 0, changed: 0, errors: 0, finished: null }, clear: { cursor: "0", done: 0, cleared: 0, keptTyped: 0, kpiCursor: "0", kpiFixed: 0, finished: null } });
export const jobsState = async () => (await kvGet<Jobs>(KV_JOBS)) ?? null;


/** Every open ESO/TSA ticket, valued once with the hub's rules (30 a run). */
async function revalueStep(j: Jobs, better: Better, more: () => boolean): Promise<number> {
  if (j.revalue.finished || !more()) return 0;
  const groups = [ESO, TSA].map((pipe) => ({ filters: [
    { propertyName: "hs_pipeline", operator: "EQ", value: pipe },
    { propertyName: "hs_pipeline_stage", operator: "NOT_IN", values: closedStages },
    { propertyName: "hs_object_id", operator: "GT", value: j.revalue.cursor },
  ] }));
  const page = await hubspotRetry<Page>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: { filterGroups: groups, properties: ["hs_object_id"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: REVALUE_PER_RUN } });
  const ids = (page.results ?? []).map((r) => String(r.id));
  if (!ids.length) { j.revalue.finished = new Date().toISOString(); return 0; }
  const full = await hubspotRetry<{ results?: Raw[] }>({ path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: { inputs: ids.map((id) => ({ id })), properties: TICKET_PROPS, propertiesWithHistory: ["sales_potential_estimate"] } });
  const byId = new Map((full.results ?? []).map((r) => [String(r.id), r]));
  let n = 0;
  for (const id of ids) {
    if (!more()) break;
    try {
      const r = await liveTicket(id, better, "revalue", byId.get(id));
      if (r.written.changed) j.revalue.changed++;
      if (r.written.error) j.revalue.errors++;
    } catch { j.revalue.errors++; }
    j.revalue.cursor = id;
    j.revalue.done++;
    n++;
  }
  return n;
}

/** The values the workflow left on Back Office, GQS and Special Prices tickets cleared (a person's own value kept),
 *  then the open-ticket rows of those pipelines in the KPI object counted without a value. */
async function clearStep(j: Jobs, more: () => boolean): Promise<number> {
  if (j.clear.finished || !more()) return 0;
  let n = 0;
  for (let i = 0; i < CLEAR_PAGES_PER_RUN && more() && j.clear.cursor !== "done"; i++) {
    const groups = NO_VALUE_PIPES.map((pipe) => ({ filters: [
      { propertyName: "hs_pipeline", operator: "EQ", value: pipe },
      { propertyName: "sales_potential_source", operator: "HAS_PROPERTY" },
      { propertyName: "hs_object_id", operator: "GT", value: j.clear.cursor },
    ] }));
    const page = await hubspotRetry<Page>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: { filterGroups: groups, properties: [...VALUE_PROPS], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 100 } });
    const res = page.results ?? [];
    if (!res.length) { j.clear.cursor = "done"; break; }
    const typed = res.filter((r) => (r.properties.sales_potential_source ?? "") === "manual_override");
    const todo = res.filter((r) => (r.properties.sales_potential_source ?? "") !== "manual_override");
    if (todo.length) {
      await hubspotRetry({ path: "/crm/v3/objects/tickets/batch/update", method: "POST", body: { inputs: todo.map((r) => ({ id: String(r.id), properties: { sales_potential_estimate: "", sales_potential_source: "", sales_potential_confidence: "" } })) } });
      await log("clear", todo.map((r) => ({ id: String(r.id), job: "clear" as const, before: valuesOf(r.properties), after: null })));
    }
    j.clear.cleared += todo.length;
    j.clear.keptTyped += typed.length;
    j.clear.done += res.length;
    j.clear.cursor = String(res[res.length - 1].id);
    n += res.length;
  }
  // the open-ticket rows of those pipelines: counted (1), no value
  while (j.clear.cursor === "done" && j.clear.kpiCursor !== "done" && more()) {
    const groups = ["BO", "GQS", "SPR"].map((pipe) => ({ filters: [
      { propertyName: "metric_name", operator: "EQ", value: "live_open" },
      { propertyName: "dimension_pipeline", operator: "EQ", value: pipe },
      { propertyName: "metric_value", operator: "GT", value: "1" },
      { propertyName: "hs_object_id", operator: "GT", value: j.clear.kpiCursor },
    ] }));
    const page = await hubspotRetry<Page>({ path: `/crm/v3/objects/${KPI_OBJ}/search`, method: "POST", body: { filterGroups: groups, properties: ["name", "metric_value"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 100 } });
    const res = page.results ?? [];
    if (!res.length) { j.clear.kpiCursor = "done"; break; }
    await hubspotRetry({ path: `/crm/v3/objects/${KPI_OBJ}/batch/update`, method: "POST", body: { inputs: res.map((r) => ({ id: String(r.id), properties: { metric_value: "1" } })) } });
    await log("kpi", res.map((r) => ({ id: String(r.id), job: "kpi" as const, before: { name: r.properties.name ?? "", metric_value: r.properties.metric_value ?? null }, after: { metric_value: 1 } })));
    j.clear.kpiFixed += res.length;
    j.clear.kpiCursor = String(res[res.length - 1].id);
    n += res.length;
  }
  if (j.clear.cursor === "done" && j.clear.kpiCursor === "done") j.clear.finished = new Date().toISOString();
  return n;
}

/** The one-time jobs, a little each run while time is left. */
export async function oneTimeJobs(better: Better, more: () => boolean): Promise<Jobs> {
  const j = (await kvGet<Jobs>(KV_JOBS)) ?? freshJobs();
  try {
    await revalueStep(j, better, more);
    await clearStep(j, more);
  } finally {
    await kvSet(KV_JOBS, j);
  }
  return j;
}

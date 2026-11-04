// GQS FOLLOW-UPS, RUN BY THE HUB - Associations > GQS follow-ups (SARCLA 04.11.2026). In place of the HubSpot workflow
// "SARCLA | GQS ESO/TSA SETS ASSOCIATION" (flow 3887968475): an ESO / TSA ticket linked to a GQS request carries
// "Type of sales ticket" = GQS (the rule: gqsTypeRules.ts). Inside the ticket associations' 3-minute scheduler and lock:
// every GQS request (about 700 on 04.11.2026, 50 more a month), their ticket links, the linked tickets' pipeline and
// type - some 15 calls a run. Modes off / preview (default, writes nothing) / live. It writes the value the workflow
// writes, so both can run side by side while the workflow is switched off.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { GQS_PIPELINE, GQS_TYPE, SALES_PIPELINES, planGqs, type GqsWhat } from "./gqsTypeRules";

export type GqsMode = "off" | "preview" | "live";
export type GqsRun = {
  at: string; seconds: number; mode: GqsMode; requests: number; linked: number; carrying: number;
  written: number; would: number; left: number; failed: number; error?: string;
  /** the linked tickets by pipeline and by their Type of sales ticket (none = empty) - the tab's figures */
  eso?: number; tsa?: number; types?: Record<string, number>;
};
export type GqsRow = {
  at: string; ticketId: string; pipeline: "ESO" | "TSA"; subject: string | null; requestId: string | null; requestSubject: string | null;
  before: string | null; what: GqsWhat | "failed"; error?: string;
};
/** seeded: the first look only remembers what already carries GQS - the 477 links of 04.11.2026 are not listed. */
type State = { seeded: boolean; done: Record<string, string> };

const KV = { state: "ticketAssoc:gqs:state", rows: "ticketAssoc:gqs:rows", last: "ticketAssoc:gqs:last" };
const ROWS_KEPT = 300;

type Obj = { id: string | number; properties?: Record<string, string | null> };
type Assoc = { from: { id: string | number }; to?: { toObjectId: string | number }[] };
const hs = <T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body, useTicketsToken: true });
const stopIfOver = (signal?: AbortSignal) => { if (signal?.aborted) throw new Error("time limit"); };

/** Every GQS request with its subject, by id (a moving id cursor - never the search's 10,000 cap). */
async function requests(signal?: AbortSignal): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  let after = "0";
  for (let page = 0; page < 200; page++) {
    stopIfOver(signal);
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: GQS_PIPELINE }, { propertyName: "hs_object_id", operator: "GT", value: after }] }],
      properties: ["subject"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    });
    const res = j.results ?? [];
    for (const t of res) out.set(String(t.id), t.properties?.subject ?? null);
    if (res.length < 200) break;
    after = String(res[res.length - 1].id);
  }
  return out;
}

/** The tickets linked to those requests: linked ticket -> the (first) request it is linked to. */
async function linked(ids: string[], signal?: AbortSignal): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 1000) {
    stopIfOver(signal);
    const j = await hs<{ results?: Assoc[] }>("/crm/v4/associations/tickets/tickets/batch/read", "POST", { inputs: ids.slice(i, i + 1000).map((id) => ({ id })) });
    for (const r of j.results ?? []) for (const t of r.to ?? []) if (!out.has(String(t.toObjectId))) out.set(String(t.toObjectId), String(r.from.id));
  }
  return out;
}

async function tickets(ids: string[], signal?: AbortSignal): Promise<Obj[]> {
  const out: Obj[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    stopIfOver(signal);
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/batch/read", "POST", { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["hs_pipeline", "type_of_sales_ticket", "subject"] });
    out.push(...(j.results ?? []));
  }
  return out;
}

/** One look. Never throws - a failure is kept on the last run and the next tick tries again. */
export async function runGqsType(mode: GqsMode, signal?: AbortSignal): Promise<GqsRun | null> {
  if (mode === "off") return null;
  const t0 = Date.now();
  const live = mode === "live";
  const run: GqsRun = { at: new Date().toISOString(), seconds: 0, mode, requests: 0, linked: 0, carrying: 0, written: 0, would: 0, left: 0, failed: 0, eso: 0, tsa: 0, types: {} };
  try {
    const state: State = (await kvGet<State>(KV.state)) ?? { seeded: false, done: {} };
    const rows = (await kvGet<GqsRow[]>(KV.rows)) ?? [];
    const reqs = await requests(signal);
    const links = await linked([...reqs.keys()], signal);
    const found = await tickets([...links.keys()].filter((id) => !reqs.has(id)), signal);
    run.requests = reqs.size;
    const done: Record<string, string> = {};
    const fresh: GqsRow[] = [];
    const toWrite: { row: GqsRow; next: string }[] = [];
    for (const t of found) {
      const id = String(t.id), p = t.properties ?? {};
      const pipe = SALES_PIPELINES[p.hs_pipeline ?? ""];
      if (!pipe) continue;
      run.linked++;
      if (pipe === "ESO") run.eso!++; else run.tsa!++;
      run.types![p.type_of_sales_ticket || "none"] = (run.types![p.type_of_sales_ticket || "none"] ?? 0) + 1;
      if (p.type_of_sales_ticket === GQS_TYPE) run.carrying++;
      const plan = planGqs({ pipeline: p.hs_pipeline ?? null, type: p.type_of_sales_ticket ?? null }, state.done[id], live);
      const requestId = links.get(id) ?? null;
      const row: GqsRow = { at: new Date().toISOString(), ticketId: id, pipeline: pipe, subject: p.subject ?? null, requestId, requestSubject: requestId ? reqs.get(requestId) ?? null : null, before: p.type_of_sales_ticket ?? null, what: plan.what ?? "already" };
      if (plan.what === "set") { toWrite.push({ row, next: plan.next ?? p.hs_pipeline! }); if (state.done[id]) done[id] = state.done[id]; continue; }
      if (plan.next) done[id] = plan.next;
      if (plan.what === "would") run.would++;
      if (plan.what === "left") run.left++;
      // the first look lists nothing that already carries GQS - only what it would set or found changed
      if (plan.what && !(plan.what === "already" && !state.seeded)) fresh.push(row);
    }
    for (let i = 0; i < toWrite.length; i += 100) {
      const chunk = toWrite.slice(i, i + 100);
      try {
        await hs("/crm/v3/objects/tickets/batch/update", "POST", { inputs: chunk.map((w) => ({ id: w.row.ticketId, properties: { type_of_sales_ticket: GQS_TYPE } })) });
        for (const w of chunk) {
          done[w.row.ticketId] = w.next; fresh.push(w.row); run.written++; run.carrying++;
          const was = w.row.before || "none";
          run.types![was] = Math.max(0, (run.types![was] ?? 1) - 1); run.types![GQS_TYPE] = (run.types![GQS_TYPE] ?? 0) + 1;
        }
      } catch (e) {
        // not remembered: asked again next run
        for (const w of chunk) { fresh.push({ ...w.row, what: "failed", error: (e as Error).message.slice(0, 200) }); run.failed++; }
      }
    }
    // only the tickets linked today are remembered - a link removed and made again is set again, as the workflow would
    await kvSet(KV.state, { seeded: true, done } satisfies State);
    if (fresh.length) await kvSet(KV.rows, [...fresh, ...rows].slice(0, ROWS_KEPT));
  } catch (e) {
    run.error = (e as Error).message.slice(0, 200);
  }
  run.seconds = Math.round((Date.now() - t0) / 1000);
  await kvSet(KV.last, run).catch(() => {});
  return run;
}

/** The HubSpot workflow this replaces - switched on? null = could not be read. */
export const GQS_WORKFLOW_ID = "3887968475";
let wfCache: { at: number; on: boolean | null } | null = null;
async function workflowOn(): Promise<boolean | null> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.on;
  let on: boolean | null = null;
  // the hub's own token reads workflows (the tickets token does not)
  try { on = !!(await hubspotRetry<{ isEnabled?: boolean }>({ path: `/automation/v4/flows/${GQS_WORKFLOW_ID}` })).isEnabled; } catch { on = null; }
  wfCache = { at: Date.now(), on };
  return on;
}

export async function gqsReport(): Promise<{ last: GqsRun | null; rows: GqsRow[]; workflowOn: boolean | null }> {
  const [last, rows, on] = await Promise.all([kvGet<GqsRun>(KV.last), kvGet<GqsRow[]>(KV.rows), workflowOn()]);
  return { last: last ?? null, rows: rows ?? [], workflowOn: on };
}

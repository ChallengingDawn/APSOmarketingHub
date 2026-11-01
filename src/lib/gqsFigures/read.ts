// GQS FIGURES - the HubSpot read (the figures are in figures.ts). Every GQS task since the pipeline began, with what
// the figures need: stage, status, type of request, owner, when it reached its outcome, the time in each stage. About
// 700 tasks (01.11.2026, ~60 a month) - four search pages. Read-only. Run with the Detection count every 30 minutes
// (boDetection/engine.ts), kept in kv gqsFigures:store.
// Since 01.11.2026 also the owner each task was given when it entered New for Back-Office (its owner's history, 50 a
// read) and the ESO / TSA ticket it belongs to, from its associations - stage and owner - about 35 reads in all.

import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { givenOf, ownerJourneyOf, type Hist } from "../boDetection/figures";
import { GQS_STAGE, WORK_STAGES, type GqsRow, type GqsStore } from "./figures";

const GQS = "1726786775";
const SALES = { "1726599376": "ESO", "1726599377": "TSA" } as const;
/** the first GQS tasks (July 2025); one search a year stays far under HubSpot's 10,000 a search */
const FIRST_YEAR = 2025;
const entered = (stage: string) => `hs_v2_date_entered_${stage}`;
const timeIn = (stage: string) => `hs_v2_cumulative_time_in_${stage}`;
const PROPS = [
  "subject", "createdate", "hs_pipeline_stage", "status_of_gqs", "gqs_type_of_request", "hubspot_owner_id", "eso_pipeline_status_for_gqs",
  "reason_of_decline_by_pm", entered(GQS_STAGE.offer), entered(GQS_STAGE.refused), entered(GQS_STAGE.newForBo), ...WORK_STAGES.map(timeIn),
];
type Obj = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, Hist[]> };
type Stage = { id: string; label: string; metadata?: { ticketState?: string } };

async function year(y: number): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (;;) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
      filterGroups: [{ filters: [
        { propertyName: "hs_pipeline", operator: "EQ", value: GQS },
        { propertyName: "createdate", operator: "GTE", value: String(Date.UTC(y, 0, 1)) },
        { propertyName: "createdate", operator: "LT", value: String(Date.UTC(y + 1, 0, 1)) },
        { propertyName: "hs_object_id", operator: "GT", value: cursor },
      ] }],
      properties: PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) return out;
    cursor = String(res[res.length - 1].id);
  }
}

/** Each task's owner history (HubSpot gives histories 50 tickets a read). */
async function ownerHistories(ids: string[]): Promise<Map<string, Hist[]>> {
  const out = new Map<string, Hist[]>();
  for (let i = 0; i < ids.length; i += 50) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: {
      inputs: ids.slice(i, i + 50).map((id) => ({ id })), properties: ["hubspot_owner_id"], propertiesWithHistory: ["hubspot_owner_id"],
    } });
    for (const o of j.results ?? []) out.set(String(o.id), o.propertiesWithHistory?.hubspot_owner_id ?? []);
  }
  return out;
}

/** The ESO / TSA ticket each task is associated with - the first one, when Sales linked more. */
async function salesTickets(ids: string[]): Promise<Map<string, Obj>> {
  const link = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hubspotRetry<{ results?: { from: { id: string }; to?: { toObjectId: number | string }[] }[] }>({
      path: "/crm/v4/associations/tickets/tickets/batch/read", method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const r of j.results ?? []) link.set(String(r.from.id), (r.to ?? []).map((t) => String(t.toObjectId)));
  }
  const others = [...new Set([...link.values()].flat())];
  const read = new Map<string, Obj>();
  for (let i = 0; i < others.length; i += 100) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: {
      inputs: others.slice(i, i + 100).map((id) => ({ id })), properties: ["hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id"],
    } });
    for (const o of j.results ?? []) read.set(String(o.id), o);
  }
  const out = new Map<string, Obj>();
  for (const [id, to] of link) {
    const s = to.map((x) => read.get(x)).find((o) => o && (o.properties.hs_pipeline ?? "") in SALES);
    if (s) out.set(id, s);
  }
  return out;
}

export async function readGqs(): Promise<GqsStore> {
  const tickets: Obj[] = [];
  for (let y = FIRST_YEAR; y <= new Date().getUTCFullYear(); y++) tickets.push(...(await year(y)));
  const ids = tickets.map((t) => String(t.id));
  const [names, pipe, eso, tsa, hist, sales] = await Promise.all([
    ownerNames(),
    hubspotRetry<{ stages?: Stage[] }>({ path: `/crm/v3/pipelines/tickets/${GQS}` }),
    hubspotRetry<{ stages?: Stage[] }>({ path: "/crm/v3/pipelines/tickets/1726599376" }),
    hubspotRetry<{ stages?: Stage[] }>({ path: "/crm/v3/pipelines/tickets/1726599377" }),
    ownerHistories(ids),
    salesTickets(ids),
  ]);
  const salesStage = new Map([...(eso.stages ?? []), ...(tsa.stages ?? [])].map((s) => [s.id, s]));
  const name = (id: string | null | undefined) => (id ? names.get(id) ?? null : null);
  const rows: GqsRow[] = tickets.filter((t) => t.properties.createdate).map((t) => {
    const p = t.properties;
    const id = String(t.id);
    const ms: Partial<Record<string, number>> = {};
    for (const s of WORK_STAGES) { const v = Number(p[timeIn(s)]); if (v > 0) ms[s] = v; }
    const h = hist.get(id) ?? [];
    // given on entering New for Back-Office, where the routing picks; a task created there entered it at its creation
    const given = givenOf(h, p[entered(GQS_STAGE.newForBo)] ?? p.createdate) || null;
    const s = sales.get(id);
    const st = s ? salesStage.get(s.properties.hs_pipeline_stage ?? "") : undefined;
    return {
      id, created: p.createdate!, stage: p.hs_pipeline_stage ?? "", status: p.status_of_gqs ?? null, type: p.gqs_type_of_request ?? null,
      owner: p.hubspot_owner_id || null, ownerName: name(p.hubspot_owner_id),
      offerAt: p[entered(GQS_STAGE.offer)] ?? null, refusedAt: p[entered(GQS_STAGE.refused)] ?? null, t: ms,
      eso: p.eso_pipeline_status_for_gqs ?? null, reason: (p.reason_of_decline_by_pm ?? "").trim().slice(0, 300) || null,
      subject: (p.subject ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
      given, givenName: name(given), oj: ownerJourneyOf(given ?? "", p.hubspot_owner_id, h),
      sales: s ? {
        id: String(s.id), pipe: SALES[s.properties.hs_pipeline as keyof typeof SALES], stage: st?.label.trim() ?? s.properties.hs_pipeline_stage ?? "",
        closed: st?.metadata?.ticketState === "CLOSED", owner: s.properties.hubspot_owner_id || null, ownerName: name(s.properties.hubspot_owner_id),
      } : null,
    };
  });
  return {
    at: new Date().toISOString(), rows,
    stages: (pipe.stages ?? []).map((s) => ({ id: s.id, label: s.label.trim(), closed: s.metadata?.ticketState === "CLOSED" })),
  };
}

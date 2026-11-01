// GQS FIGURES - the HubSpot read (the figures are in figures.ts). Every GQS task since the pipeline began, with what
// the figures need: stage, status, type of request, owner, when it reached its outcome, the time in each stage. About
// 700 tasks (01.11.2026, ~60 a month) - four search pages. Read-only. Run with the Detection count every 30 minutes
// (boDetection/engine.ts), kept in kv gqsFigures:store.

import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { GQS_STAGE, WORK_STAGES, type GqsRow, type GqsStore } from "./figures";

const GQS = "1726786775";
/** the first GQS tasks (July 2025); one search a year stays far under HubSpot's 10,000 a search */
const FIRST_YEAR = 2025;
const entered = (stage: string) => `hs_v2_date_entered_${stage}`;
const timeIn = (stage: string) => `hs_v2_cumulative_time_in_${stage}`;
const PROPS = [
  "subject", "createdate", "hs_pipeline_stage", "status_of_gqs", "gqs_type_of_request", "hubspot_owner_id", "eso_pipeline_status_for_gqs",
  "reason_of_decline_by_pm", entered(GQS_STAGE.offer), entered(GQS_STAGE.refused), ...WORK_STAGES.map(timeIn),
];
type Obj = { id: string; properties: Record<string, string | null> };

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

export async function readGqs(): Promise<GqsStore> {
  const tickets: Obj[] = [];
  for (let y = FIRST_YEAR; y <= new Date().getUTCFullYear(); y++) tickets.push(...(await year(y)));
  const names = await ownerNames();
  const pipe = await hubspotRetry<{ stages?: { id: string; label: string; metadata?: { ticketState?: string } }[] }>({ path: `/crm/v3/pipelines/tickets/${GQS}` });
  const rows: GqsRow[] = tickets.filter((t) => t.properties.createdate).map((t) => {
    const p = t.properties;
    const ms: Partial<Record<string, number>> = {};
    for (const s of WORK_STAGES) { const v = Number(p[timeIn(s)]); if (v > 0) ms[s] = v; }
    return {
      id: String(t.id), created: p.createdate!, stage: p.hs_pipeline_stage ?? "", status: p.status_of_gqs ?? null, type: p.gqs_type_of_request ?? null,
      owner: p.hubspot_owner_id || null, ownerName: p.hubspot_owner_id ? names.get(p.hubspot_owner_id) ?? null : null,
      offerAt: p[entered(GQS_STAGE.offer)] ?? null, refusedAt: p[entered(GQS_STAGE.refused)] ?? null, t: ms,
      eso: p.eso_pipeline_status_for_gqs ?? null, reason: (p.reason_of_decline_by_pm ?? "").trim().slice(0, 300) || null,
      subject: (p.subject ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
    };
  });
  return {
    at: new Date().toISOString(), rows,
    stages: (pipe.stages ?? []).map((s) => ({ id: s.id, label: s.label.trim(), closed: s.metadata?.ticketState === "CLOSED" })),
  };
}

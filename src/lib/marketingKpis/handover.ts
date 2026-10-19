// HAND-OVER TO ESO/TSA - the read (the rules are in handoverCube.ts). From January last year: every
// ticket in the ESO and TSA pipelines - what it is (a customer's request, a new registrant, a lifecycle
// hand-over, or left out), its first reply from the ticket in working hours, how it was closed, its
// company's country and its owner. Kept as one compact row per ticket that counts - no subject, no
// company, no contact. A few minutes; read again every 6 hours in the background (leadsWarm.ts), and the
// page shows the last read meanwhile.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { UCS } from "@/lib/lifecycle/config";
import { associations, batchRead, searchAll, ticketStages } from "@/lib/lifecycle/read";
import { HANDOVER_SHAPE, classify, workingHours, type HandoverData, type HandoverRow } from "./handoverCube";

const KEY = "marketingKpis:handover:v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 30 * 60 * 1000;
const PIPES: Record<string, "ESO" | "TSA"> = { "1726599376": "ESO", "1726599377": "TSA" };
const DAY = 86_400_000;
const PROPS = [
  "subject", "createdate", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "source_type", "hs_object_source",
  "hs_object_source_detail_1", "hs_outbound_ticket", "hs_tag_ids", "ticket_resolution_eso", "closed_date", "first_agent_reply_date",
  "hs_primary_company_id",
];

export function handoverData(): Promise<SlowState<HandoverData>> {
  return slowReport(KEY, (v: HandoverData) => ((v?.shape ?? 0) < HANDOVER_SHAPE ? 0 : Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS : TTL_MS), buildHandover);
}

const ms = (v: string | null | undefined): number | null => {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = /^\d+$/.test(t) ? Number(t) : Date.parse(t);
  return Number.isFinite(n) ? n : null;
};
const monthOf = (t: number) => new Date(t).toISOString().slice(0, 7);

/** The owners' names - and those who left, marked so (their tickets keep them as owner). */
async function ownerNames(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const archived of [false, true]) {
    let after: string | undefined;
    do {
      const j: { results?: { id: string; firstName?: string; lastName?: string; email?: string }[]; paging?: { next?: { after?: string } } } =
        await hubspotFetchJson({ path: `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}` });
      for (const o of j.results ?? []) {
        const name = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || String(o.id);
        out[String(o.id)] ??= archived ? `${name} (left)` : name;
      }
      after = j.paging?.next?.after;
    } while (after);
  }
  return out;
}

/** The labels people pick for the ticket resolution, by the stored value ("No reply" is shown as "No reply after multiple tries"). */
async function resolutionLabels(): Promise<(v: string) => string> {
  try {
    const p = await hubspotFetchJson<{ options?: { value: string; label: string }[] }>({ path: "/crm/v3/properties/tickets/ticket_resolution_eso", useTicketsToken: true });
    const m = new Map((p.options ?? []).map((o) => [o.value, o.label]));
    return (v) => m.get(v) ?? v;
  } catch {
    return (v) => v;
  }
}

/** The read itself (exported for a local check; the page goes through handoverData). */
export async function buildHandover(): Promise<HandoverData> {
  const now = Date.now();
  const year = new Date(now).getUTCFullYear(), py = year - 1;
  const errors: Record<string, string> = {};
  const skipped: Record<string, number> = {};

  // the workflows that make the lifecycle tickets: their name -> the use case
  const lifecycle: Record<string, string> = {};
  for (const u of UCS) for (const t of u.tickets) lifecycle[t.name] = u.key;

  reportProgress(KEY, "reading the ticket pipelines");
  const stages = await ticketStages();
  reportProgress(KEY, "reading the ESO and TSA tickets");
  const found = await searchAll("tickets",
    [[{ propertyName: "hs_pipeline", operator: "IN", values: Object.keys(PIPES) }, { propertyName: "createdate", operator: "GTE", value: String(Date.UTC(py, 0, 1)) }]],
    PROPS, (n) => reportProgress(KEY, `reading the ESO and TSA tickets · ${n.toLocaleString("en")}`));

  type Kept = { id: string; p: Record<string, string | null>; g: HandoverRow["g"]; c: string; created: number };
  const kept: Kept[] = [];
  for (const t of found) {
    const p = t.properties ?? {};
    const created = ms(p.createdate);
    if (created == null || !PIPES[p.hs_pipeline ?? ""]) continue;
    const what = classify({ subject: p.subject, sourceType: p.source_type, objectSource: p.hs_object_source, workflow: p.hs_object_source_detail_1, outbound: p.hs_outbound_ticket, tags: p.hs_tag_ids, resolution: p.ticket_resolution_eso }, lifecycle);
    if ("skip" in what) { skipped[what.skip] = (skipped[what.skip] ?? 0) + 1; continue; }
    kept.push({ id: String(t.id), p, g: what.g, c: what.c, created });
  }

  // the calls logged on the tickets: a call is a first contact too (SARCLA 19.10: "no reply on the ticket
  // should also mean no calls") - the first one after the ticket came in
  const firstCall = new Map<string, number>();
  try {
    reportProgress(KEY, "reading the calls on the tickets");
    const onTicket = await associations("tickets", "calls", kept.map((k) => k.id));
    const callIds = [...new Set([...onTicket.values()].flat())];
    const calls = await batchRead("calls", callIds, ["hs_timestamp", "hs_createdate"], [], (n) => reportProgress(KEY, `reading the calls, ${n.toLocaleString("en")} of ${callIds.length.toLocaleString("en")}`));
    const at = new Map(calls.map((c) => [String(c.id), ms(c.properties?.hs_timestamp) ?? ms(c.properties?.hs_createdate)]));
    for (const k of kept) {
      for (const id of onTicket.get(k.id) ?? []) {
        const t = at.get(id);
        if (t != null && t >= k.created && t < (firstCall.get(k.id) ?? Infinity)) firstCall.set(k.id, t);
      }
    }
  } catch (e) {
    errors.calls = String((e as Error)?.message ?? e).slice(0, 200);
  }

  // the companies' countries
  const countryOf = new Map<string, string>();
  const cos = [...new Set(kept.map((k) => k.p.hs_primary_company_id).filter((x): x is string => !!x))];
  try {
    const recs = await batchRead("companies", cos, ["country_custom", "country"], [], (n) => reportProgress(KEY, `reading the companies, ${n.toLocaleString("en")} of ${cos.length.toLocaleString("en")}`));
    for (const c of recs) countryOf.set(String(c.id), (c.properties?.country_custom || c.properties?.country || "").trim() || "Unknown");
  } catch (e) {
    errors.companies = String((e as Error)?.message ?? e).slice(0, 200);
  }

  let owners: Record<string, string> = {};
  try { owners = await ownerNames(); } catch (e) { errors.owners = String((e as Error)?.message ?? e).slice(0, 200); }

  const label = await resolutionLabels();
  const rows: HandoverRow[] = kept.map(({ id, p, g, c, created }) => {
    const closed = !!stages.get(p.hs_pipeline_stage ?? "")?.closed;
    const reply = ms(p.first_agent_reply_date);
    const closedAt = ms(p.closed_date);
    // the first contact: the ticket's first reply or its first call, whichever came first
    const first = Math.min(reply != null && reply >= created ? reply : Infinity, firstCall.get(id) ?? Infinity);
    const a = Number.isFinite(first) ? Math.round(workingHours(created, first) * 10) / 10 : null;
    const z = Math.max(0, Math.round(((closed ? closedAt ?? created : now) - created) / DAY));
    const r = closed ? label((p.ticket_resolution_eso ?? "").trim()) : "";
    return {
      m: monthOf(created), t: PIPES[p.hs_pipeline ?? ""], g, c,
      k: countryOf.get(p.hs_primary_company_id ?? "") ?? "Unknown", o: p.hubspot_owner_id ?? "",
      x: closed ? 1 : 0, ...(r ? { r } : {}), a, z,
    };
  });
  rows.sort((a, b) => (a.m < b.m ? -1 : a.m > b.m ? 1 : 0));
  return { rows, owners, year, monthsDone: new Date(now).getUTCMonth(), readAt: new Date(now).toISOString(), errors, skipped, shape: HANDOVER_SHAPE };
}

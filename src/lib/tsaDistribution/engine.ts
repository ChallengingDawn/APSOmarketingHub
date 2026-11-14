// TSA DISTRIBUTION - the engine (the rules in rules.ts). SARCLA 13-14.11.2026. READS ONLY for now: nothing is
// written to HubSpot - the workflow "SARCLA | TSA/HELPLINE MAIL TICKET CREATION" still routes. The hub's own routing
// (with "TSA NON QUALIFIED" split into "Outbound - TSA call" and "Finance reminder") goes Live in a second round, once
// the AP lead form's code is in the hub too.
//
// Every 15 minutes, one copy of the hub at a time (advisory lock 4107288): the TSA tickets of the last 90 days, and
// the helpline e-mails and AP lead forms TSA handed to the Back Office, read into the funnel (how each came in, what
// became of it, week by week); and for the last 7 days, what the hub would have done with each next to what the
// workflow did (the routing, side by side). Kept in kv tsaDistribution:state. TSA_DISTRIBUTION=off stops it.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { BO, TSA, arrival, decide, funnel, pathOf, wayIn, type Decision, type Funnel, type Path, type Ticket, type Way } from "./rules";

const LOCK = 4_107_288;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 12 * 60_000;
const DAYS = 90, SIDE_DAYS = 7;
const KV = { state: "tsaDistribution:state" };
const PROPS = ["subject", "source_type", "hs_outbound_ticket", "hs_object_source", "hs_object_source_detail_1", "hs_pipeline", "hs_pipeline_stage", "ticket_resolution_eso", "lead_management_ticket", "createdate"];

type Obj = { id: string; properties: Record<string, string | null> };
type Hist = { id: string; propertiesWithHistory?: Record<string, { value: string; timestamp: string }[]> };
export type SideRow = { id: string; created: string; subject: string; way: Way; hub: Path; workflow: Path; same: boolean; hubDid: Decision };
export type State = { at: string; days: number; funnel: Funnel; side: { days: number; rows: SideRow[]; same: number; differ: number } };
export type RunInfo = { at: string; seconds: number; tickets: number; error?: string };

async function search(filters: Record<string, unknown>[]): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 200; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
      filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  return out;
}
const asTicket = (o: Obj): Ticket => {
  const p = o.properties;
  return {
    id: String(o.id), created: p.createdate ?? "", subject: p.subject ?? "", sourceType: p.source_type ?? null, outbound: p.hs_outbound_ticket === "true",
    objectSource: p.hs_object_source ?? null, objectSourceDetail: p.hs_object_source_detail_1 ?? null, pipeline: String(p.hs_pipeline ?? ""),
    stage: String(p.hs_pipeline_stage ?? ""), resolution: p.ticket_resolution_eso ?? null, lead: p.lead_management_ticket === "true",
  };
};

/** The TSA tickets of the period, and those TSA handed to the Back Office (helpline e-mails, AP lead forms). */
async function tickets(sinceMs: number): Promise<Ticket[]> {
  const since = { propertyName: "createdate", operator: "GTE", value: String(sinceMs) };
  const [tsa, help, lead] = await Promise.all([
    search([{ propertyName: "hs_pipeline", operator: "EQ", value: TSA }, since]),
    search([{ propertyName: "hs_pipeline", operator: "EQ", value: BO }, since, { propertyName: "subject", operator: "CONTAINS_TOKEN", value: "HELPLINE" }]),
    search([{ propertyName: "hs_pipeline", operator: "EQ", value: BO }, since, { propertyName: "lead_management_ticket", operator: "EQ", value: "true" }]),
  ]);
  const byId = new Map<string, Ticket>();
  for (const o of tsa) byId.set(String(o.id), asTicket(o));
  // the Back Office ones only when TSA's routing made them so
  for (const o of [...help, ...lead]) { const t = asTicket(o); if (pathOf(t.subject) !== "none" || t.lead) byId.set(t.id, t); }
  return [...byId.values()];
}

/** Side by side: each ticket as the routing met it (rules.ts arrival), what the hub would do, what the workflow did. */
async function sideBySide(list: Ticket[]): Promise<SideRow[]> {
  const rows: SideRow[] = [];
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50);
    const j = await hubspotRetry<{ results?: Hist[] }>({ path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: {
      inputs: chunk.map((t) => ({ id: t.id })), properties: ["subject"], propertiesWithHistory: ["hs_pipeline_stage", "subject"],
    } });
    const hist = new Map((j.results ?? []).map((h) => [String(h.id), h.propertiesWithHistory ?? {}]));
    for (const t of chunk) {
      const h = hist.get(t.id) ?? {};
      const hub = decide(arrival(h.hs_pipeline_stage ?? [], h.subject ?? [], t.sourceType, t.outbound, { stage: t.stage, subject: t.subject }));
      const workflow = pathOf(t.subject);
      rows.push({ id: t.id, created: t.created, subject: t.subject, way: wayIn(t), hub: hub.path, workflow, same: hub.path === workflow, hubDid: hub });
    }
  }
  return rows.sort((a, b) => b.created.localeCompare(a.created));
}

async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const list = await tickets(Date.now() - DAYS * 86400_000);
  const recent = list.filter((t) => Date.parse(t.created) >= Date.now() - SIDE_DAYS * 86400_000 && Date.parse(t.created) <= Date.now() - 30 * 60_000);
  const rows = await sideBySide(recent);
  const now = new Date().toISOString();
  await kvSet(KV.state, { at: now, days: DAYS, funnel: funnel(list), side: { days: SIDE_DAYS, rows: rows.slice(0, 600), same: rows.filter((r) => r.same).length, differ: rows.filter((r) => !r.same).length } } satisfies State);
  return { at: now, seconds: Math.round((Date.now() - t0) / 1000), tickets: list.length };
}

export async function runOnce(): Promise<RunInfo | null> {
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch((e) => ({ at: new Date().toISOString(), seconds: 0, tickets: 0, error: (e as Error).message.slice(0, 300) }));
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false, running = false;
export function startTsaDistribution() {
  if (started || process.env.TSA_DISTRIBUTION === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .then((r) => { if (r?.error) console.warn(`[tsa-distribution] ${r.error}`); })
      .catch((e) => console.warn(`[tsa-distribution] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 330_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

export async function pageState(): Promise<State | null> {
  return (await kvGet<State>(KV.state)) ?? null;
}

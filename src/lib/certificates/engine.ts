// CERTIFICATES - the engine (UC & HubSpot Apps > Certificates; the rule in rules.ts). Replaces the HubSpot workflow
// "SARCLA | CERTIFICATES NEW PROCESS" (2959551709), switched off by mistake on 04.11.2026 - SARCLA: "migrate ASAP this
// certificates process to the hub as a sub-app, follow the logic".
//
// Every 3 minutes, one copy of the hub at a time (advisory lock 4107260): the open Back Office tickets that ask for a
// certificate (a certificate named, or an action set), their history (when the action was set, when it first went to
// Certificates, a merge) and their company. Each step that fell due since the workflow was switched off and that the
// hub has not done is done: one PATCH per ticket (and the note, for the 15-day escalation). Off / Preview (default:
// lists what it would do, writes nothing) / Live (writes - only while the workflow is switched off). Every step done or
// listed is kept (kv certificates:rows, the last 500); the open tickets with their step and the next one are kept for
// the page (certificates:open); the year in figures every 30 minutes (certificates:stats).
// CERTIFICATES=off stops the schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import {
  ACT, BO_PIPELINE, CATEGORY, DEFAULT_PEOPLE, STAGE, WORKFLOW_ID, WORKFLOW_OFF_AT, merge, owed, position, stepsOf,
  type Facts, type People, type Phase, type StepName,
} from "./rules";

const LOCK = 4_107_260;
const EVERY_MS = 3 * 60_000;
const LIMIT_MS = 8 * 60_000;
const STATS_EVERY_MS = 30 * 60_000;
const ROWS_KEPT = 500;
const KV = {
  settings: "certificates:settings", rows: "certificates:rows", last: "certificates:last", open: "certificates:open",
  done: "certificates:done", rotation: "certificates:rotation", stats: "certificates:stats",
};

export type Mode = "off" | "preview" | "live";
export type Settings = { mode: Mode; people: People; by?: string; at?: string };
export type RunInfo = { at: string; seconds: number; mode: Mode; writing: boolean; tickets: number; owed: number; written: number; listed: number; failed: number; error?: string };
/** One ticket's steps done (or, in Preview, listed) in one look. */
export type Row = {
  at: string; ticketId: string; subject: string | null; phase: Phase; steps: StepName[];
  what: "done" | "would" | "failed"; props: Record<string, string>; note: boolean; error?: string;
};
/** An open ticket of the process, for the page. */
export type OpenTicket = {
  id: string; subject: string | null; company: string | null; order: string | null; certs: string; due: string | null;
  stage: string | null; actions: string | null; owner: string | null; expert: string | null; createdAt: string;
  phase: Phase; step: StepName | null; next: { name: StepName; at: string } | null; workflowStep: boolean;
};
export type Stats = {
  at: string;
  months: { month: string; created: number; resolved: number }[];
  /** median days from the request to Resolved, the last 90 days */
  medianDays: number | null; resolved90: number;
};
type Obj = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, { value: string; timestamp: string; sourceType?: string }[]> };
const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });

// ---------------- settings, the workflow ----------------
export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings>>(KV.settings);
  return { mode: s?.mode ?? "preview", people: { ...DEFAULT_PEOPLE, ...(s?.people ?? {}) }, by: s?.by, at: s?.at };
}
export async function saveSettings(patch: { mode?: Mode; people?: Partial<People> }, by: string): Promise<Settings> {
  const cur = await getSettings();
  const next: Settings = { mode: patch.mode ?? cur.mode, people: { ...cur.people, ...(patch.people ?? {}) }, by, at: new Date().toISOString() };
  await kvSet(KV.settings, next);
  return next;
}
let wfCache: { at: number; on: boolean | null } | null = null;
/** The old workflow switched on? null = could not be read (then nothing is written). */
export async function workflowOn(): Promise<boolean | null> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.on;
  let on: boolean | null = null;
  try { on = !!(await hs<{ isEnabled?: boolean }>(`/automation/v4/flows/${WORKFLOW_ID}`)).isEnabled; } catch { on = null; }
  wfCache = { at: Date.now(), on };
  return on;
}

// ---------------- owners ----------------
type Owner = { id: string; name: string; archived: boolean };
let ownersCache: { at: number; list: Owner[] } | null = null;
export async function owners(): Promise<Owner[]> {
  if (ownersCache && Date.now() - ownersCache.at < 30 * 60_000) return ownersCache.list;
  const list: Owner[] = [];
  for (const archived of [false, true]) {
    let after = "";
    for (let i = 0; i < 20; i++) {
      const j = await hs<{ results?: { id: string; firstName?: string; lastName?: string; email?: string }[]; paging?: { next?: { after?: string } } }>(
        `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}`);
      for (const o of j.results ?? []) list.push({ id: String(o.id), name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || `Owner ${o.id}`, archived });
      after = j.paging?.next?.after ?? "";
      if (!after) break;
    }
  }
  ownersCache = { at: Date.now(), list };
  return list;
}

// ---------------- reading the tickets ----------------
const PROPS = [
  "subject", "hs_pipeline_stage", "hubspot_owner_id", "actions_for_certificates", "which_certificate__", "other_certificates",
  "sarcla_pm_witch_mandant__", "order_number", "delivery_date_for_certificate", "conformity_expert", "back_office_ticket_requester",
  "enquiry_category", "hs_merged_object_ids", "createdate",
];
const HIST = ["actions_for_certificates", "hs_pipeline_stage", "hs_merged_object_ids"];

async function search(filters: { propertyName: string; operator: string; value?: string }[], properties = ["hs_object_id"]): Promise<Obj[]> {
  const out: Obj[] = [];
  let after = "0";
  for (let page = 0; page < 50; page++) {
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: BO_PIPELINE }, ...filters, { propertyName: "hs_object_id", operator: "GT", value: after }] }],
      properties, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) break;
    after = String(res[res.length - 1].id);
  }
  return out;
}

/** The open tickets of the process: a certificate named, an action set, or a new Certificates request. */
export async function openIds(): Promise<string[]> {
  const open = { propertyName: "hs_pipeline_stage", operator: "NEQ", value: STAGE.resolved };
  const a = await search([open, { propertyName: "which_certificate__", operator: "HAS_PROPERTY" }]);
  const b = await search([open, { propertyName: "actions_for_certificates", operator: "HAS_PROPERTY" }]);
  return [...new Set([...a, ...b].map((t) => String(t.id)))];
}

const ts = (s: string) => Date.parse(s);
function factsOf(t: Obj, company: string | null): Facts {
  const p = t.properties;
  const h = t.propertiesWithHistory ?? {};
  const act = [...(h.actions_for_certificates ?? [])].sort((x, y) => ts(y.timestamp) - ts(x.timestamp));
  const stages = [...(h.hs_pipeline_stage ?? [])].sort((x, y) => ts(x.timestamp) - ts(y.timestamp));
  const merges = [...(h.hs_merged_object_ids ?? [])].filter((x) => x.value).sort((x, y) => ts(y.timestamp) - ts(x.timestamp));
  const firstCert = stages.find((x) => x.value === STAGE.certificates);
  return {
    id: String(t.id), stage: p.hs_pipeline_stage ?? null, actions: p.actions_for_certificates || null,
    actionsAt: act[0] ? ts(act[0].timestamp) : null, actionsBy: act[0]?.sourceType ?? null, actionsBefore: act[1]?.value || null,
    certs: (p.which_certificate__ ?? "").split(";").map((x) => x.trim()).filter(Boolean),
    other: p.other_certificates ?? null, mandant: p.sarcla_pm_witch_mandant__ ?? null, order: p.order_number ?? null,
    due: p.delivery_date_for_certificate ? p.delivery_date_for_certificate.slice(0, 10) : null,
    company, owner: p.hubspot_owner_id ?? null, requester: p.back_office_ticket_requester ?? null, expert: p.conformity_expert ?? null,
    category: p.enquiry_category ?? null, createdAt: ts(p.createdate ?? new Date().toISOString()),
    mergedAt: p.hs_merged_object_ids && merges[0] ? ts(merges[0].timestamp) : null,
    startedAt: firstCert ? ts(firstCert.timestamp) : null, subject: p.subject ?? null,
  };
}

/** The ticket's company name, as the workflow's subject had it (Company Name (unique), else the name). */
async function companies(ids: string[]): Promise<Map<string, string>> {
  const toCompany = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 1000) {
    const j = await hs<{ results?: { from: { id: string | number }; to?: { toObjectId: string | number; associationTypes?: { typeId: number; label?: string | null }[] }[] }[] }>(
      "/crm/v4/associations/tickets/companies/batch/read", "POST", { inputs: ids.slice(i, i + 1000).map((id) => ({ id })) });
    for (const r of j.results ?? []) {
      const to = r.to ?? [];
      // the primary company (26) - the workflow took the last-modified of the links, often A+P itself
      const primary = to.find((x) => (x.associationTypes ?? []).some((a) => a.typeId === 26 || a.label === "Primary")) ?? to[0];
      if (primary) toCompany.set(String(r.from.id), String(primary.toObjectId));
    }
  }
  const names = new Map<string, string>();
  const cids = [...new Set(toCompany.values())];
  for (let i = 0; i < cids.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/companies/batch/read", "POST", { inputs: cids.slice(i, i + 100).map((id) => ({ id })), properties: ["company_name__unique_", "name"] });
    for (const c of j.results ?? []) names.set(String(c.id), c.properties.company_name__unique_ || c.properties.name || "");
  }
  const out = new Map<string, string>();
  for (const [t, c] of toCompany) if (names.get(c)) out.set(t, names.get(c)!);
  return out;
}

export async function readTickets(ids: string[]): Promise<Facts[]> {
  const objs: Obj[] = [];
  // with history: 50 at most per call
  for (let i = 0; i < ids.length; i += 50) {
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/batch/read", "POST", { inputs: ids.slice(i, i + 50).map((id) => ({ id })), properties: PROPS, propertiesWithHistory: HIST });
    objs.push(...(j.results ?? []));
  }
  const names = await companies(objs.map((o) => String(o.id))).catch(() => new Map<string, string>());
  return objs.map((o) => factsOf(o, names.get(String(o.id)) ?? null));
}

// ---------------- one look ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const settings = await getSettings();
  const on = await workflowOn();
  const writing = settings.mode === "live" && on === false;
  const info: RunInfo = { at: new Date().toISOString(), seconds: 0, mode: settings.mode, writing, tickets: 0, owed: 0, written: 0, listed: 0, failed: 0 };
  const facts = await readTickets(await openIds());
  const doneMap = (await kvGet<Record<string, string[]>>(KV.done)) ?? {};
  const rot = (await kvGet<{ backOffice: number; experts: number }>(KV.rotation)) ?? { backOffice: 0, experts: 0 };
  const list = await owners().catch(() => [] as Owner[]);
  const active = (ids: string[]) => ids.filter((id) => !list.length || list.some((o) => o.id === id && !o.archived));
  const rows: Row[] = [];
  const open: OpenTicket[] = [];
  const now = Date.now();
  const nextDone: Record<string, string[]> = {};
  for (const f of facts) {
    const pos = position(f, now);
    if (!pos) continue;
    info.tickets++;
    const done = new Set(doneMap[f.id] ?? []);
    const due = owed(f, done, now);
    if (due.length) {
      info.owed += due.length;
      // the rotation: the next of the list, moved on only by a write that went through
      const used = { backOffice: 0, experts: 0 };
      const pick = (who: "backOffice" | "experts") => {
        const people = active(settings.people[who]);
        if (!people.length) return null;
        return people[(rot[who] + used[who]++) % people.length];
      };
      const { props, note } = merge(f, due, pick, settings.people);
      const row: Row = { at: new Date().toISOString(), ticketId: f.id, subject: f.subject, phase: pos.phase, steps: due.map((x) => x.name), what: "would", props, note };
      if (writing) {
        try {
          if (Object.keys(props).length) await hs(`/crm/v3/objects/tickets/${f.id}`, "PATCH", { properties: props });
          if (note) {
            const who = list.find((o) => o.id === settings.people.escalation)?.name ?? "";
            await hs("/crm/v3/objects/notes", "POST", {
              properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p>Dear ${who} more than 15 days and no certificates - please handle it manually</p><p>APSOhub - Certificates</p>` },
              associations: [{ to: { id: f.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 228 }] }],
            });
          }
          for (const x of due) done.add(x.key);
          rot.backOffice += used.backOffice; rot.experts += used.experts;
          row.what = "done"; info.written++;
        } catch (e) {
          row.what = "failed"; row.error = (e as Error).message.slice(0, 200); info.failed++;
        }
        rows.push(row);
      } else {
        // Preview: each step listed once ("~" = listed, not done - Live still does it)
        const fresh = due.filter((x) => !done.has(`~${x.key}`));
        if (fresh.length) { rows.push({ ...row, steps: fresh.map((x) => x.name) }); info.listed++; }
        for (const x of due) done.add(`~${x.key}`);
      }
    }
    if (done.size) nextDone[f.id] = [...done];
    const p2 = pos;
    open.push({
      id: f.id, subject: f.subject, company: f.company, order: f.order, certs: [f.certs.join(", "), f.other].filter(Boolean).join(" "), due: f.due,
      stage: f.stage, actions: f.actions, owner: f.owner, expert: f.expert, createdAt: new Date(f.createdAt).toISOString(),
      phase: p2.phase, step: p2.at, next: p2.next ? { name: p2.next.name, at: new Date(p2.next.at).toISOString() } : null,
      workflowStep: !!p2.at && (owedAt(f, p2.at) ?? now) < WORKFLOW_OFF_AT,
    });
  }
  // only the tickets still open are remembered
  await kvSet(KV.done, nextDone);
  await kvSet(KV.rotation, rot);
  if (rows.length) await kvSet(KV.rows, [...rows, ...((await kvGet<Row[]>(KV.rows)) ?? [])].slice(0, ROWS_KEPT));
  await kvSet(KV.open, open);
  info.seconds = Math.round((Date.now() - t0) / 1000);
  await kvSet(KV.last, info);
  const st = await kvGet<Stats>(KV.stats);
  if (!st?.at || Date.now() - Date.parse(st.at) > STATS_EVERY_MS) await readStats().catch((e) => console.warn(`[certificates] stats: ${(e as Error).message}`));
  return info;
}

/** When the step the ticket is at fell due (for "done by the workflow" on the page). */
function owedAt(f: Facts, name: StepName): number | null {
  return stepsOf(f)?.steps.find((x) => x.name === name)?.at ?? null;
}

/** The year in figures: certificate tickets created and resolved per month, days to resolve. */
export async function readStats(): Promise<Stats> {
  const since = Date.now() - 400 * 86400_000;
  const all = await search([{ propertyName: "which_certificate__", operator: "HAS_PROPERTY" }, { propertyName: "createdate", operator: "GTE", value: String(since) }], ["createdate", "closed_date", "hs_pipeline_stage", "enquiry_category"]);
  const m = new Map<string, { created: number; resolved: number }>();
  const bump = (k: string, f: "created" | "resolved") => { const x = m.get(k) ?? { created: 0, resolved: 0 }; x[f]++; m.set(k, x); };
  const days: number[] = [];
  for (const t of all) {
    const c = t.properties.createdate, r = t.properties.closed_date;
    if (c) bump(c.slice(0, 7), "created");
    if (r && t.properties.hs_pipeline_stage === STAGE.resolved) {
      bump(r.slice(0, 7), "resolved");
      if (c && Date.now() - ts(r) <= 90 * 86400_000) days.push((ts(r) - ts(c)) / 86400_000);
    }
  }
  days.sort((a, b) => a - b);
  const stats: Stats = {
    at: new Date().toISOString(),
    months: [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-13).map(([month, v]) => ({ month, ...v })),
    medianDays: days.length ? Math.round(days[Math.floor(days.length / 2)] * 10) / 10 : null, resolved90: days.length,
  };
  await kvSet(KV.stats, stats);
  return stats;
}

export async function runOnce(): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const s = await getSettings().catch(() => null);
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, mode: s?.mode ?? "preview", writing: false, tickets: 0, owed: 0, written: 0, listed: 0, failed: 0, error: (e as Error).message.slice(0, 300) };
        await kvSet(KV.last, info);
        return info;
      });
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false, running = false;
export function startCertificates() {
  if (started || process.env.CERTIFICATES === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .catch((e) => console.warn(`[certificates] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 60_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the page ----------------
export async function pageState() {
  const [settings, last, rows, open, stats, on] = await Promise.all([
    getSettings(), kvGet<RunInfo>(KV.last), kvGet<Row[]>(KV.rows), kvGet<OpenTicket[]>(KV.open), kvGet<Stats>(KV.stats), workflowOn(),
  ]);
  const list = await owners().catch(() => [] as Owner[]);
  const ids = new Set<string>([...settings.people.backOffice, ...settings.people.experts, settings.people.escalation]);
  for (const t of open ?? []) for (const id of [t.owner, t.expert]) if (id) ids.add(id);
  for (const r of rows ?? []) for (const k of ["hubspot_owner_id", "conformity_expert"]) if (r.props[k]) ids.add(r.props[k]);
  const names = Object.fromEntries([...ids].map((id) => [id, list.find((o) => o.id === id)?.name ?? `Owner ${id}`]));
  // people a rotation may hold: the owners who are not archived
  const choices = list.filter((o) => !o.archived).map((o) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    settings, last: last ?? null, rows: (rows ?? []).slice(0, 300), open: open ?? [], stats: stats ?? null, names, choices,
    workflowOn: on, writing: settings.mode === "live" && on === false, offAt: new Date(WORKFLOW_OFF_AT).toISOString(),
    category: CATEGORY, actions: ACT,
  };
}

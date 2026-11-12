// BACK OFFICE DISTRIBUTION > Available or Away - the engine (the rule in rules.ts). Replaces the HubSpot workflow
// "SARCLA | DISPLAY AVAILABITY BO" (3712821446), SARCLA 12.11.2026.
//
// Every 2 minutes, one copy of the hub at a time (advisory lock 4107287): every HubSpot user is read (all pages - the
// workflow read only the first 100), the six people's status taken, and every open Back Office and GQS ticket (the
// workflow's stages) read with its six values; a ticket whose values are not today's gets them, 100 a call - only the
// values that changed, so a quiet day writes nothing (the workflow wrote every open ticket each time it ran). Each
// person's change is kept (kv boAvailability:changes, the last 500). Writes only in Live AND while the workflow is
// switched off (never both writing); Live unless paused, as the other plain property jobs. BO_AVAILABILITY=off stops
// the schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { PEOPLE, PROPS, STAGES, WORKFLOW_ID, changesFor, statusOf, type Status } from "./rules";

const LOCK = 4_107_287;
const EVERY_MS = 2 * 60_000;
const LIMIT_MS = 6 * 60_000;
const KEEP_CHANGES = 500;
const KV = { settings: "boAvailability:settings", state: "boAvailability:state", last: "boAvailability:last", changes: "boAvailability:changes" };

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
export type PersonNow = { owner: string; name: string; prop: string; status: Status | null; raw: string | null; since: string | null };
export type State = { at: string; people: PersonNow[]; tickets: number; toWrite: number };
export type Change = { at: string; owner: string; name: string; from: Status | null; to: Status };
export type RunInfo = { at: string; seconds: number; tickets: number; toWrite: number; written: number; live: boolean; error?: string };

type Obj = { id: string; properties: Record<string, string | null> };

// ---------------- settings, the workflow ----------------
export async function getSettings(): Promise<Settings> {
  return (await kvGet<Settings>(KV.settings)) ?? { mode: "live", liveFrom: null };
}
export async function saveSettings(mode: Mode, by: string): Promise<Settings> {
  const cur = await getSettings();
  const next: Settings = { mode, liveFrom: mode === "live" ? (cur.mode === "live" ? cur.liveFrom : new Date().toISOString()) : null, by, at: new Date().toISOString() };
  await kvSet(KV.settings, next);
  return next;
}
let wfCache: { at: number; on: boolean | null } | null = null;
/** The old workflow switched on? null = could not be read (then nothing is written). */
export async function workflowOn(): Promise<boolean | null> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.on;
  let on: boolean | null = null;
  try { on = !!(await hubspotRetry<{ isEnabled?: boolean }>({ path: `/automation/v4/flows/${WORKFLOW_ID}` })).isEnabled; } catch { on = null; }
  wfCache = { at: Date.now(), on };
  return on;
}
export async function writing(): Promise<boolean> {
  return (await getSettings()).mode === "live" && (await workflowOn()) === false;
}

// ---------------- HubSpot ----------------
/** Each HubSpot user's status, by owner id - every page. */
async function statuses(): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  let after: string | undefined;
  for (let page = 0; page < 30; page++) {
    const j = await hubspotRetry<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v3/objects/users?limit=100&properties=hs_availability_status,hubspot_owner_id${after ? `&after=${after}` : ""}` });
    for (const u of j.results ?? []) { const o = u.properties.hubspot_owner_id; if (o) out.set(String(o), u.properties.hs_availability_status ?? null); }
    after = j.paging?.next?.after;
    if (!after) break;
  }
  return out;
}
async function openTickets(): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 100; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline_stage", operator: "IN", values: STAGES }, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  return out;
}

// ---------------- the run ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = await writing();
  const now = new Date().toISOString();
  const [raw, prev] = await Promise.all([statuses(), kvGet<State>(KV.state)]);
  const before = new Map((prev?.people ?? []).map((p) => [p.owner, p]));
  const people: PersonNow[] = PEOPLE.map((p) => {
    const found = raw.has(p.owner);
    const status = found ? statusOf(raw.get(p.owner)) : null;
    const was = before.get(p.owner);
    return { ...p, status, raw: found ? raw.get(p.owner) ?? null : null, since: status && was?.status === status ? was.since : status ? now : null };
  });
  // a person's change is kept, for "since" and the list on the page
  const changed: Change[] = people.filter((p) => p.status && before.get(p.owner)?.status !== p.status && prev)
    .map((p) => ({ at: now, owner: p.owner, name: p.name, from: before.get(p.owner)?.status ?? null, to: p.status! }));
  if (changed.length) {
    const list = (await kvGet<Change[]>(KV.changes)) ?? [];
    await kvSet(KV.changes, [...changed, ...list].slice(0, KEEP_CHANGES));
  }
  // a person not found among the users is left as the ticket has it
  const want: Record<string, Status> = {};
  for (const p of people) if (p.status) want[p.prop] = p.status;
  const tickets = await openTickets();
  const todo = tickets.map((t) => ({ id: t.id, props: changesFor(t.properties, want) })).filter((t) => Object.keys(t.props).length);
  let written = 0;
  if (live && todo.length) {
    for (let i = 0; i < todo.length; i += 100) {
      const chunk = todo.slice(i, i + 100);
      try {
        await hubspotRetry({ path: "/crm/v3/objects/tickets/batch/update", method: "POST", body: { inputs: chunk.map((t) => ({ id: t.id, properties: t.props })) } });
        written += chunk.length;
      } catch {
        for (const t of chunk) {
          try { await hubspotRetry({ path: `/crm/v3/objects/tickets/${t.id}`, method: "PATCH", body: { properties: t.props } }); written++; } catch { /* the next run tries again */ }
        }
      }
    }
  }
  await kvSet(KV.state, { at: now, people, tickets: tickets.length, toWrite: todo.length - written } satisfies State);
  const info: RunInfo = { at: now, seconds: Math.round((Date.now() - t0) / 1000), tickets: tickets.length, toWrite: todo.length, written, live };
  await kvSet(KV.last, info);
  return info;
}

export async function runOnce(): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, tickets: 0, toWrite: 0, written: 0, live: false, error: (e as Error).message.slice(0, 300) };
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
export function startBoAvailability() {
  if (started || process.env.BO_AVAILABILITY === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .then((r) => {
        if (r?.written) console.log(`[bo-availability] ${r.written} ticket(s) given today's Available / Away, ${r.toWrite - r.written} still to write`);
        if (r?.error) console.warn(`[bo-availability] ${r.error}`);
      })
      .catch((e) => console.warn(`[bo-availability] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 230_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the state the page reads ----------------
export async function pageState() {
  const [settings, last, state, changes, on] = await Promise.all([getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), kvGet<Change[]>(KV.changes), workflowOn()]);
  return { settings, last: last ?? null, state: state ?? null, changes: (changes ?? []).slice(0, 60), workflowOn: on, writing: settings.mode === "live" && on === false };
}

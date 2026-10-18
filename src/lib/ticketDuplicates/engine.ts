// DUPLICATES & MERGES - SHADOW MODE (SARCLA 18.10.2026: "DUPS and merge should be a separate app"). For every
// ticket entering Back Office "New" the hub looks for its duplicates the way the workflow "SARCLA | BACK OFFICE
// FILTERING | DUPS HANDLING WITH CODE" does (rules.ts) - its targeted search on the order number and subject, then
// its sweep of the newest 1000 tickets when that found nothing - once exactly as the workflow ("legacy") and once
// with the exclusions set on the page ("hub"); ten minutes later it reads what HubSpot wrote (dup_reason_and_id,
// and whether the owner moved). Writes NOTHING to HubSpot. Merging stays a person's decision in HubSpot
// ("Merge the tickets, I've checked" -> BO MERGING); the page lists those merges.
// Every 3 minutes, one copy of the hub at a time (advisory lock 4107232).

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { DEFAULT_EXCLUSIONS, extractKeys, findDuplicates, isErosion, type DupResult, type Exclusions, type Ticket } from "./rules";

const LOCK = 4_107_232;
const EVERY_MS = 3 * 60_000;
const LIMIT_MS = 10 * 60_000;
const OVERLAP_MS = 5 * 60_000;
const OUTCOME_AFTER_MS = 10 * 60_000;
const DAYS_KEPT = 21;
const MAX_PER_RUN = 25;
const BO = "1726786777", BO_NEW = "2338266325", CERTIFICATES = "3640065212";

export type Settings = { mode: "off" | "shadow"; exclusions: Exclusions; by: string | null; at: string | null };
export type Outcome = { at: string; message: string | null; detected: string | null; ownerBefore: string | null; ownerAfter: string | null; ownerAfterName: string | null; ownerSetBy: string | null };
export type Row = {
  key: string; ticketId: string; enteredAt: string; seenAt: string; subject: string; orderNumber: string | null; keys: string;
  /** the workflow stops before its code: certificates stage / erosion amount */
  stopped?: string;
  legacy: DupResult | null; hub: DupResult | null;
  ownerNames: Record<string, string>;
  ownerAtCheck: string | null;
  actual?: Outcome;
  error?: string;
};
export type RunInfo = { at: string; seconds: number; read: number; checked: number; settled: number; error?: string };

const KV = { settings: "ticketDup:settings", last: "ticketDup:lastRun", cursor: "ticketDup:cursor", day: (d: string) => `ticketDup:rows:${d}` };

export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Settings>(KV.settings);
  return { mode: s?.mode ?? "shadow", exclusions: { ...DEFAULT_EXCLUSIONS, ...(s?.exclusions ?? {}) }, by: s?.by ?? null, at: s?.at ?? null };
}
export async function saveSettings(patch: { mode?: "off" | "shadow"; exclusions?: Partial<Exclusions> }, by: string): Promise<Settings> {
  const cur = await getSettings();
  const ex = { ...cur.exclusions, ...(patch.exclusions ?? {}) };
  const clean: Exclusions = {
    pipelines: (ex.pipelines ?? []).map(String).filter((x) => /^\d+$/.test(x)).slice(0, 20),
    ownerFromSamePipelineOnly: !!ex.ownerFromSamePipelineOnly,
    neverMatchTexts: (ex.neverMatchTexts ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 30),
    ownerMaxAgeDays: Math.min(365, Math.max(0, Math.round(Number(ex.ownerMaxAgeDays) || 30))),
    flagOnly: !!ex.flagOnly,
  };
  const next: Settings = { mode: patch.mode === "off" ? "off" : patch.mode === "shadow" ? "shadow" : cur.mode, exclusions: clean, by, at: new Date().toISOString() };
  await kvSet(KV.settings, next);
  return next;
}
export const lastRun = async () => (await kvGet<RunInfo>(KV.last)) ?? null;
const day = (iso: string) => iso.slice(0, 10);
const rowsOfDay = async (d: string) => (await kvGet<Row[]>(KV.day(d))) ?? [];
export async function recentRows(days = 7): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < days; i++) out.push(...(await rowsOfDay(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10))));
  return out.sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
}

const hs = <T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
type Raw = { id: string; properties: Record<string, string | null> };
const PROPS = ["subject", "order_number", "hubspot_owner_id", "createdate", "hs_is_closed", "erosion_key", "hs_pipeline"];
const toTicket = (r: Raw): Ticket => ({
  id: String(r.id), subject: r.properties.subject ?? "", orderNumber: r.properties.order_number ?? null, owner: r.properties.hubspot_owner_id ?? null,
  createdate: r.properties.createdate ?? null, closed: (r.properties.hs_is_closed ?? "").toLowerCase() === "true", erosionKey: r.properties.erosion_key ?? null, pipeline: r.properties.hs_pipeline ?? null,
});
const pause = () => new Promise((res) => setTimeout(res, 260)); // the search API allows about 4 a second
async function search(filters: object[], after?: string): Promise<{ results: Raw[]; after?: string }> {
  const r = await hs<{ results?: Raw[]; paging?: { next?: { after?: string } } }>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: [{ filters }], properties: PROPS, sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: 100, ...(after ? { after } : {}),
  });
  await pause();
  return { results: r.results ?? [], after: r.paging?.next?.after };
}

/** The workflow's candidates, in its order: erosion key; or CONTAINS_TOKEN on order_number then subject for the first two
 *  cores; the sweep of the newest 1000 tickets only when that found no duplicate. */
async function candidates(me: Ticket, firstPass: (c: Ticket[]) => boolean): Promise<Ticket[]> {
  if (isErosion(me.subject)) return me.erosionKey ? (await search([{ propertyName: "erosion_key", operator: "EQ", value: me.erosionKey }])).results.map(toTicket) : [];
  const cores = [...new Set([...extractKeys(me.subject), ...extractKeys(me.orderNumber)].map((k) => k.core))].sort().slice(0, 2);
  const found = new Map<string, Ticket>();
  for (const core of cores) for (const prop of ["order_number", "subject"]) {
    for (const r of (await search([{ propertyName: prop, operator: "CONTAINS_TOKEN", value: core }])).results) if (!found.has(String(r.id))) found.set(String(r.id), toTicket(r));
  }
  const targeted = [...found.values()];
  if (firstPass(targeted)) return targeted;
  const sweep: Ticket[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const r = await search([{ propertyName: "createdate", operator: "GTE", value: "0" }], after);
    sweep.push(...r.results.map(toTicket));
    after = r.after;
    if (!after) break;
  }
  return [...targeted, ...sweep];
}

let archivedCache: { at: number; ids: Set<string> } | null = null;
async function archivedOwners(): Promise<Set<string>> {
  if (archivedCache && Date.now() - archivedCache.at < 60 * 60_000) return archivedCache.ids;
  const ids = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const r = await hs<{ results?: { id: string }[]; paging?: { next?: { after?: string } } }>(`/crm/v3/owners?archived=true&limit=100${after ? `&after=${after}` : ""}`);
    for (const o of r.results ?? []) ids.add(String(o.id));
    after = r.paging?.next?.after;
    if (!after) break;
  }
  archivedCache = { at: Date.now(), ids };
  return ids;
}

async function check(id: string, enteredAt: string, settings: Settings): Promise<Row> {
  const t = await hs<Raw & { propertiesWithHistory?: Record<string, { value: string; timestamp: string }[]> }>(
    `/crm/v3/objects/tickets/${id}?properties=${[...PROPS, "erosion_amount_2025"].join(",")}&propertiesWithHistory=hs_pipeline_stage`);
  const me = toTicket(t);
  const row: Row = { key: `${id}:${enteredAt}`, ticketId: id, enteredAt, seenAt: new Date().toISOString(), subject: me.subject, orderNumber: me.orderNumber, keys: "", legacy: null, hub: null, ownerNames: {}, ownerAtCheck: me.owner };
  // the workflow checks this 4 minutes after entry: a later move to Certificates does not count
  const by = Date.parse(enteredAt) + 4 * 60_000;
  if ((t.propertiesWithHistory?.hs_pipeline_stage ?? []).some((h) => h.value === CERTIFICATES && Date.parse(h.timestamp) <= by)) { row.stopped = "has been in Certificates - the workflow stops"; return row; }
  if (t.properties.erosion_amount_2025) { row.stopped = "erosion amount known - the workflow stops"; return row; }
  const archived = await archivedOwners();
  const legacyEx = DEFAULT_EXCLUSIONS; // the workflow, whatever the page's exclusions say
  // the sweep runs when the LEGACY rules found nothing in the targeted results - as the workflow does
  const cands = await candidates(me, (c) => findDuplicates(me, c, legacyEx, archived).duplicates.length > 0);
  row.legacy = findDuplicates(me, cands, legacyEx, archived);
  row.hub = findDuplicates(me, cands, settings.exclusions, archived);
  row.keys = row.legacy.keys;
  const names = await ownerNames();
  for (const o of [row.legacy.ownerChange?.ownerId, row.hub.ownerChange?.ownerId, me.owner]) if (o) row.ownerNames[o] = names.get(o) ?? o;
  return row;
}

async function outcome(row: Row): Promise<Outcome> {
  const t = await hs<Raw & { propertiesWithHistory?: Record<string, { value: string; timestamp: string; sourceType?: string; sourceId?: string; sourceLabel?: string }[]> }>(
    `/crm/v3/objects/tickets/${row.ticketId}?properties=dup_reason_and_id,dup_detected,hubspot_owner_id&propertiesWithHistory=hubspot_owner_id`);
  const hist = t.propertiesWithHistory?.hubspot_owner_id ?? [];
  const last = hist[0];
  const after = t.properties.hubspot_owner_id ?? null;
  return {
    at: new Date().toISOString(), message: t.properties.dup_reason_and_id ?? null, detected: t.properties.dup_detected ?? null,
    ownerBefore: row.ownerAtCheck, ownerAfter: after, ownerAfterName: after ? (await ownerNames()).get(after) ?? after : null,
    ownerSetBy: last ? `${last.sourceType ?? ""}${last.sourceId ? ` ${last.sourceId}` : ""}${last.sourceLabel ? ` (${last.sourceLabel})` : ""}`.trim() : null,
  };
}

/** One ticket checked now - nothing stored, nothing written. */
export async function checkTicket(id: string, settings?: Settings): Promise<Row> {
  const row = await check(id, new Date().toISOString(), settings ?? (await getSettings()));
  row.actual = await outcome(row);
  return row;
}

async function run(settings: Settings, signal?: AbortSignal): Promise<RunInfo> {
  const started = Date.now();
  const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, checked: 0, settled: 0 };
  const cursor = (await kvGet<number>(KV.cursor)) ?? Date.now() - 30 * 60_000;
  const prop = `hs_v2_date_entered_${BO_NEW}`;
  const r = await hs<{ results?: Raw[] }>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: BO }, { propertyName: prop, operator: "GTE", value: String(cursor - OVERLAP_MS) }] }],
    properties: [prop], sorts: [{ propertyName: prop, direction: "ASCENDING" }], limit: 100,
  });
  const found = (r.results ?? []).filter((x) => x.properties[prop]).map((x) => ({ id: String(x.id), enteredAt: new Date(Date.parse(x.properties[prop]!)).toISOString() }));
  info.read = found.length;
  const touched = new Map<string, Row[]>();
  const rowsFor = async (d: string) => touched.get(d) ?? (touched.set(d, await rowsOfDay(d)), touched.get(d)!);
  let newest = cursor;
  for (const e of found.slice(0, MAX_PER_RUN)) {
    if (signal?.aborted) break;
    const rows = await rowsFor(day(e.enteredAt));
    const key = `${e.id}:${e.enteredAt}`;
    newest = Math.max(newest, Date.parse(e.enteredAt));
    if (rows.some((x) => x.key === key)) continue;
    try { rows.push(await check(e.id, e.enteredAt, settings)); info.checked++; }
    catch (err) { rows.push({ key, ticketId: e.id, enteredAt: e.enteredAt, seenAt: new Date().toISOString(), subject: "", orderNumber: null, keys: "", legacy: null, hub: null, ownerNames: {}, ownerAtCheck: null, error: (err as Error).message.slice(0, 200) }); }
  }
  for (const d of [day(new Date().toISOString()), day(new Date(Date.now() - 86400_000).toISOString())]) {
    for (const x of await rowsFor(d)) {
      if (signal?.aborted) break;
      if (x.actual || x.error || x.stopped || Date.now() - Date.parse(x.enteredAt) < OUTCOME_AFTER_MS) continue;
      try { x.actual = await outcome(x); info.settled++; } catch (err) { x.error = `outcome: ${(err as Error).message.slice(0, 160)}`; }
    }
  }
  for (const [d, rows] of touched) await kvSet(KV.day(d), rows);
  await kvSet(KV.cursor, found.length > MAX_PER_RUN ? newest : Math.max(newest, Date.now() - OVERLAP_MS));
  await kvSet(KV.day(new Date(Date.now() - DAYS_KEPT * 86400_000).toISOString().slice(0, 10)), null);
  info.seconds = Math.round((Date.now() - started) / 1000);
  await kvSet(KV.last, info);
  return info;
}

export async function runOnce(signal?: AbortSignal): Promise<RunInfo | null> {
  const settings = await getSettings();
  if (settings.mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("ticket duplicates: time limit")); };
  if (signal?.aborted) drop(); else signal?.addEventListener("abort", drop, { once: true });
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run(settings, signal).catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, checked: 0, settled: 0, error: (e as Error).message.slice(0, 300) };
        await kvSet(KV.last, info);
        return info;
      });
    } finally {
      if (!dropped) await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    signal?.removeEventListener("abort", drop);
    if (!dropped) client.release();
  }
}

let started = false, running = false;
export function startTicketDuplicates() {
  if (started || process.env.TICKET_DUPLICATES === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const limit = new AbortController();
    const timer = setTimeout(() => {
      console.error(`[ticket-duplicates] run still going after ${LIMIT_MS / 60_000} min - stopped and its lock dropped`);
      limit.abort();
      running = false;
    }, LIMIT_MS);
    timer.unref?.();
    void runOnce(limit.signal)
      .catch((e) => console.warn(`[ticket-duplicates] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); if (!limit.signal.aborted) running = false; });
  };
  setTimeout(tick, 100_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

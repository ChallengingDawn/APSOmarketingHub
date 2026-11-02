// DUPLICATES & MERGES (SARCLA 18.10.2026: "DUPS and merge should be a separate app"; 02.11.2026: "improve a lot the
// duplicated app ... tabs to steer the different types", "person clicks, hub merges"). For every ticket entering Back
// Office "New", four minutes after it came (as the workflow waits):
//   - the hub's own verdict (types.ts): the same request twice, another open ticket on the same order, the same erosion
//     win-back - or nothing; closed tickets on the same order are history only. The candidates: the order number's
//     search (order number and subject), the sender's tickets of the last days (the ticket's first contact), the
//     erosion key;
//   - beside it, the copy of the workflow "SARCLA | BACK OFFICE FILTERING | DUPS HANDLING WITH CODE" (rules.ts, its
//     sweep of the newest 1000 tickets when the search finds nothing), and ten minutes later what HubSpot wrote - the
//     page shows what the workflow flags that the hub does not, and the other way round.
// Shadow: nothing written. Live (live.ts): the verdict and the owner written, once the workflow is switched off.
// After the live work, while time allows: the last 7 days replayed (oldest first, 25 a run; a row without the hub's
// verdict is checked again), and every stored ticket read again at 1 hour, daily, and at 7 days - merged by people,
// closed, or still open (model.ts). Every 3 minutes, one copy of the hub at a time (advisory lock 4107232). The decisions
// people take on the card are carried out every minute (lock 4107236) while merging is on.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { IntegrationError } from "@/lib/integrations/status";
import { DEFAULT_EXCLUSIONS, extractKeys, findDuplicates, fmtKeys, isErosion, type Exclusions, type Ticket } from "./rules";
import { mergeDue, ownerWhy, readMerge, workflowWrites, type Outcome, type Read, type Row } from "./model";
import { SKIP } from "./measure";
import { DEFAULT_TYPES, decide, type Cand, type Me, type TypeSettings } from "./types";
import { propsState } from "./properties";
import { runDecisions, workflowOn, writeVerdict } from "./live";

export type { Outcome, Row } from "./model";

const LOCK = 4_107_232, DECISIONS_LOCK = 4_107_236;
const EVERY_MS = 3 * 60_000, DECISIONS_EVERY_MS = 60_000;
const LIMIT_MS = 10 * 60_000;
const OVERLAP_MS = 5 * 60_000;
/** the workflow waits 4 minutes after entry: the subject is renamed and Back Office has given an owner by then */
const WAIT_MS = 4 * 60_000;
const OUTCOME_AFTER_MS = 10 * 60_000;
/** an owner is only handed over while the ticket is fresh - never after an outage */
const OWNER_FRESH_MS = 60 * 60_000;
const DAYS_KEPT = 21;
const MAX_PER_RUN = 25;
const BO = "1726786777", BO_NEW = "2338266325", CERTIFICATES = "3640065212";
/** extra work (replay, follow-up) starts only this long into a run - the next run is 3 minutes away */
const WORK_MS = 100_000;
const BACKFILL_DAYS = 7;
/** the replay version: a new one starts again from 7 days ago (2: the hub's verdict by type, 02.11.2026) */
const BACKFILL_VERSION = 2;
/** the replay stops short of now: the newest entries are the live loop's, and the workflow needs ~5 minutes */
const BACKFILL_GAP_MS = 20 * 60_000;
const FOLLOW_EVERY_MS = 15 * 60_000;
const FOLLOW_DAYS = 9;
const FOLLOW_MAX = 300;
const LATER_SEARCHES = 5;

export type Mode = "off" | "shadow" | "live";
export type Settings = {
  mode: Mode;
  /** the decisions people take on the card carried out (merge, not a duplicate) */
  merging: "off" | "on";
  types: TypeSettings;
  /** the exclusions of the first version (19.10.2026) - kept for its stored rows, no longer used */
  exclusions: Exclusions;
  by: string | null; at: string | null;
};
export type RunInfo = { at: string; seconds: number; read: number; checked: number; settled: number; backfilled?: number; followed?: number; written?: number; error?: string };
/** The replay of the last 7 days: Back Office "New" entries from `from` to `until`, `cursor` = the last one done. */
export type Backfill = { from: string; until: string; cursor: number; done: boolean; startedAt: string; checked: number; by: string | null; version?: number };

const KV = { settings: "ticketDup:settings", last: "ticketDup:lastRun", decisions: "ticketDup:decisionsRun", cursor: "ticketDup:cursor", backfill: "ticketDup:backfill", day: (d: string) => `ticketDup:rows:${d}` };

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || dflt));
const texts = (a: unknown, max: number) => (Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);
function cleanTypes(t: Partial<TypeSettings> | undefined, cur: TypeSettings): TypeSettings {
  const tw = { ...cur.twice, ...(t?.twice ?? {}) }, or = { ...cur.order, ...(t?.order ?? {}) }, er = { ...cur.erosion, ...(t?.erosion ?? {}) };
  return {
    twice: { on: !!tw.on, withinHours: clampInt(tw.withinHours, 1, 24 * 14, 72), handOver: !!tw.handOver, internalDomains: texts(tw.internalDomains, 30).map((d) => d.toLowerCase().replace(/^@/, "")) },
    order: { on: !!or.on, handOver: !!or.handOver, ownerMaxAgeDays: clampInt(or.ownerMaxAgeDays, 0, 365, 30) },
    erosion: { on: !!er.on },
    neverMatchTexts: t?.neverMatchTexts !== undefined ? texts(t.neverMatchTexts, 30) : cur.neverMatchTexts,
  };
}

export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings> & { mode?: string }>(KV.settings);
  return {
    mode: s?.mode === "off" || s?.mode === "live" ? s.mode : "shadow",
    merging: s?.merging === "on" ? "on" : "off",
    types: cleanTypes(s?.types, DEFAULT_TYPES),
    exclusions: { ...DEFAULT_EXCLUSIONS, ...(s?.exclusions ?? {}) },
    by: s?.by ?? null, at: s?.at ?? null,
  };
}
export async function saveSettings(patch: { mode?: Mode; merging?: "off" | "on"; types?: Partial<TypeSettings> }, by: string): Promise<Settings> {
  const cur = await getSettings();
  const next: Settings = {
    ...cur,
    mode: patch.mode === "off" || patch.mode === "shadow" || patch.mode === "live" ? patch.mode : cur.mode,
    merging: patch.merging === "on" || patch.merging === "off" ? patch.merging : cur.merging,
    types: patch.types ? cleanTypes(patch.types, cur.types) : cur.types,
    by, at: new Date().toISOString(),
  };
  await kvSet(KV.settings, next);
  return next;
}
export const lastRun = async () => (await kvGet<RunInfo>(KV.last)) ?? null;
export const lastDecisions = async () => (await kvGet<{ at: string; done: number; errors: number; error?: string }>(KV.decisions)) ?? null;
const freshBackfill = (by: string | null): Backfill => {
  const now = Date.now();
  return { from: new Date(now - BACKFILL_DAYS * 86400_000).toISOString(), until: new Date(now - BACKFILL_GAP_MS).toISOString(), cursor: now - BACKFILL_DAYS * 86400_000, done: false, startedAt: new Date(now).toISOString(), checked: 0, by, version: BACKFILL_VERSION };
};
export const backfillState = async () => (await kvGet<Backfill>(KV.backfill)) ?? null;
/** "Replay the last 7 days": the cursor back to 7 days ago - tickets already stored with the hub's verdict are skipped. */
export async function replayBackfill(by: string): Promise<Backfill> {
  const b = freshBackfill(by);
  await kvSet(KV.backfill, b);
  return b;
}
const day = (iso: string) => iso.slice(0, 10);
const rowsOfDay = async (d: string) => (await kvGet<Row[]>(KV.day(d))) ?? [];
export async function recentRows(days = 7): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < days; i++) out.push(...(await rowsOfDay(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10))));
  return out.sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
}

const hs = <T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
type Raw = { id: string; properties: Record<string, string | null> };
const PROPS = ["subject", "order_number", "hubspot_owner_id", "createdate", "hs_is_closed", "closed_date", "erosion_key", "hs_pipeline"];
const toTicket = (r: Raw): Ticket => ({
  id: String(r.id), subject: r.properties.subject ?? "", orderNumber: r.properties.order_number ?? null, owner: r.properties.hubspot_owner_id ?? null,
  createdate: r.properties.createdate ?? null, closed: (r.properties.hs_is_closed ?? "").toLowerCase() === "true", erosionKey: r.properties.erosion_key ?? null, pipeline: r.properties.hs_pipeline ?? null,
});
const toCand = (r: Raw): Cand => ({ ...toTicket(r), closedAt: r.properties.closed_date ?? null });
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
async function candidates(me: Ticket, firstPass: (c: Ticket[]) => boolean): Promise<Raw[]> {
  if (isErosion(me.subject)) return me.erosionKey ? (await search([{ propertyName: "erosion_key", operator: "EQ", value: me.erosionKey }])).results : [];
  const cores = [...new Set([...extractKeys(me.subject), ...extractKeys(me.orderNumber)].map((k) => k.core))].sort().slice(0, 2);
  const found = new Map<string, Raw>();
  for (const core of cores) for (const prop of ["order_number", "subject"]) {
    for (const r of (await search([{ propertyName: prop, operator: "CONTAINS_TOKEN", value: core }])).results) if (!found.has(String(r.id))) found.set(String(r.id), r);
  }
  const targeted = [...found.values()];
  if (firstPass(targeted.map(toTicket))) return targeted;
  const sweep: Raw[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const r = await search([{ propertyName: "createdate", operator: "GTE", value: "0" }], after);
    sweep.push(...r.results);
    after = r.after;
    if (!after) break;
  }
  return [...targeted, ...sweep];
}

/** The ticket's sender: its first contact, the e-mail's domain and the name. */
async function senderOf(id: string): Promise<Me["sender"]> {
  const a = await hs<{ results?: { toObjectId: string | number }[] }>(`/crm/v4/objects/tickets/${id}/associations/contacts?limit=10`);
  const first = a.results?.[0]?.toObjectId;
  if (!first) return null;
  const c = await hs<Raw>(`/crm/v3/objects/contacts/${first}?properties=email,firstname,lastname`);
  const email = String(c.properties.email ?? "");
  return { id: String(first), domain: email.includes("@") ? email.split("@").pop()!.toLowerCase() : null, name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ") || null };
}
/** The sender's tickets of the hours before (the setting of "same request twice"). */
async function senderTickets(sender: NonNullable<Me["sender"]>, created: number, hours: number): Promise<Raw[]> {
  return (await search([
    { propertyName: "associations.contact", operator: "EQ", value: sender.id },
    { propertyName: "createdate", operator: "GTE", value: String(created - hours * 3600_000) },
    { propertyName: "createdate", operator: "LTE", value: String(created) },
  ])).results;
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
  const row: Row = { key: `${id}:${enteredAt}`, ticketId: id, enteredAt, seenAt: new Date().toISOString(), subject: me.subject, orderNumber: me.orderNumber, keys: "", legacy: null, hub: null, ownerNames: {}, ownerAtCheck: me.owner, pipeline: me.pipeline };
  const archived = await archivedOwners();
  const names = await ownerNames();
  const legacyEx = DEFAULT_EXCLUSIONS; // the workflow, whatever the page says
  // the workflow stops before its code for these - the hub's own rules still look (they have their own exclusions)
  const by = Date.parse(enteredAt) + 4 * 60_000;
  if ((t.propertiesWithHistory?.hs_pipeline_stage ?? []).some((h) => h.value === CERTIFICATES && Date.parse(h.timestamp) <= by)) row.stopped = "has been in Certificates - the workflow stops";
  else if (t.properties.erosion_amount_2025) row.stopped = "erosion amount known - the workflow stops";
  // the sweep runs when the LEGACY rules found nothing in the targeted results - as the workflow does
  const raw = await candidates(me, (c) => !!row.stopped || findDuplicates(me, c, legacyEx, archived).duplicates.length > 0);
  const cands = raw.map(toTicket);
  if (!row.stopped) {
    row.legacy = findDuplicates(me, cands, legacyEx, archived);
    row.keys = row.legacy.keys;
  } else row.keys = fmtKeys([...extractKeys(me.subject), ...extractKeys(me.orderNumber)]);

  // the hub: the same candidates, the sender's tickets of the last days, then the rules by type
  const types = settings.types;
  const sender = types.twice.on ? await senderOf(id).catch(() => null) : null;
  const all = new Map<string, Cand>(raw.map((r) => [String(r.id), toCand(r)]));
  if (sender) {
    for (const r of await senderTickets(sender, Date.parse(me.createdate ?? enteredAt) || Date.now(), types.twice.withinHours)) {
      const c = all.get(String(r.id)) ?? toCand(r);
      all.set(String(r.id), { ...c, sameSender: true });
    }
  }
  row.v = decide({ ...toCand(t), sender }, [...all.values()], types, archived, (o) => names.get(o) ?? o);

  // the tickets either side found, as seen now - their pipeline, age and state are what the measurement needs
  const ids = new Set([...(row.legacy?.duplicates ?? []), ...row.v.of, ...row.v.history, ...row.v.elsewhere]);
  const seen = [...all.values()].filter((c) => ids.has(c.id));
  row.dups = Object.fromEntries(seen.map((c) => [c.id, { subject: c.subject.slice(0, 140), pipeline: c.pipeline, createdate: c.createdate, closed: c.closed, owner: c.owner }]));
  if (row.legacy) row.ownerWhy = { legacy: ownerWhy(me, cands.filter((c) => row.legacy!.duplicates.includes(c.id)), legacyEx, archived, row.legacy), hub: null };
  for (const o of [row.legacy?.ownerChange?.ownerId, row.v.ownerChange?.ownerId, me.owner, ...seen.map((c) => c.owner)]) if (o) row.ownerNames[o] = names.get(o) ?? o;
  return row;
}

type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string; sourceLabel?: string; updatedByUserId?: number }[];
async function outcome(row: Row): Promise<Outcome> {
  const t = await hs<Raw & { propertiesWithHistory?: Record<string, Hist> }>(
    `/crm/v3/objects/tickets/${row.ticketId}?properties=dup_reason_and_id,dup_detected,hubspot_owner_id&propertiesWithHistory=hubspot_owner_id,dup_reason_and_id`);
  const hist = t.propertiesWithHistory?.hubspot_owner_id ?? [];
  const last = hist[0];
  const after = t.properties.hubspot_owner_id ?? null;
  const names = await ownerNames();
  // the workflow's own writes after this entry: the merge flow rewrites the text later, and other flows move owners
  const own = workflowWrites(row.enteredAt, t.propertiesWithHistory?.dup_reason_and_id, hist);
  if (own.hsOwner) row.ownerNames[own.hsOwner.ownerId] = names.get(own.hsOwner.ownerId) ?? own.hsOwner.ownerId;
  return {
    at: new Date().toISOString(), message: t.properties.dup_reason_and_id ?? null, detected: t.properties.dup_detected ?? null,
    ownerBefore: row.ownerAtCheck, ownerAfter: after, ownerAfterName: after ? names.get(after) ?? after : null,
    ownerSetBy: last ? `${last.sourceType ?? ""}${last.sourceId ? ` ${last.sourceId}` : ""}${last.sourceLabel ? ` (${last.sourceLabel})` : ""}`.trim() : null,
    ...own,
  };
}

/** One ticket checked now - nothing stored, nothing written. Its entry is its last one into Back Office "New", so the
 *  certificates stop and HubSpot's answer are judged at the right moment (now, for a ticket that never entered). */
export async function checkTicket(id: string, settings?: Settings): Promise<Row> {
  const prop = `hs_v2_date_entered_${BO_NEW}`;
  const t = await hs<Raw>(`/crm/v3/objects/tickets/${id}?properties=${prop}`);
  const entered = Date.parse(t.properties[prop] ?? "");
  const row = await check(id, new Date(Number.isFinite(entered) ? entered : Date.now()).toISOString(), settings ?? (await getSettings()));
  row.actual = await outcome(row);
  return row;
}

/** Live: the verdict written - only while the page says Live, the workflow is off and the properties exist. */
async function liveWrite(row: Row, settings: Settings): Promise<boolean> {
  if (settings.mode !== "live" || !row.v?.status) return false;
  if ((await workflowOn()) !== false || !(await propsState()).ready) return false;
  try {
    const fresh = Date.now() - Date.parse(row.enteredAt) < OWNER_FRESH_MS;
    const r = await writeVerdict(row.ticketId, fresh ? row.v : { ...row.v, ownerChange: null });
    row.live = { at: new Date().toISOString(), flagged: r.flagged, owner: r.owner, ...(r.note ? { note: r.note } : !fresh && row.v.ownerChange ? { note: "seen over an hour after entry - owner left alone" } : {}) };
    return r.flagged;
  } catch (e) {
    row.live = { at: new Date().toISOString(), flagged: false, owner: false, error: (e as Error).message.slice(0, 200) };
    return false;
  }
}

type RowsFor = (d: string) => Promise<Row[]>;
const errorRow = (id: string, enteredAt: string, err: unknown): Row => ({
  key: `${id}:${enteredAt}`, ticketId: id, enteredAt, seenAt: new Date().toISOString(), subject: "", orderNumber: null, keys: "", legacy: null, hub: null, ownerNames: {}, ownerAtCheck: null, error: (err as Error).message.slice(0, 200),
});

/** The last 7 days, oldest first: entries the hub never stored, checked as the live loop checks and settled at once
 *  (the workflow answered days ago); a stored row without the hub's verdict gets it. Read as the tickets are today. */
async function backfill(settings: Settings, rowsFor: RowsFor, mark: (d: string) => void, more: () => boolean): Promise<number> {
  const stored = await kvGet<Backfill>(KV.backfill);
  const b = stored && stored.version === BACKFILL_VERSION ? stored : freshBackfill(stored ? "the hub's verdict by type" : "first run");
  if (b.done) return 0;
  const prop = `hs_v2_date_entered_${BO_NEW}`;
  const from = Number(b.cursor);
  const r = await hs<{ results?: Raw[] }>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: [{ filters: [
      { propertyName: "hs_pipeline", operator: "EQ", value: BO },
      { propertyName: prop, operator: "GTE", value: String(from) }, { propertyName: prop, operator: "LTE", value: String(Date.parse(b.until)) },
    ] }],
    properties: [prop], sorts: [{ propertyName: prop, direction: "ASCENDING" }], limit: 100,
  });
  await pause();
  const results = (r.results ?? []).filter((x) => x.properties[prop]);
  let cursor = from, checked = 0, cut = false;
  for (const x of results) {
    const id = String(x.id), enteredAt = new Date(Date.parse(x.properties[prop]!)).toISOString(), d = day(enteredAt);
    const rows = await rowsFor(d);
    const have = rows.find((y) => y.key === `${id}:${enteredAt}`);
    if (!have || (!have.v && !have.error)) {
      if (checked >= MAX_PER_RUN || !more()) { cut = true; break; }
      try {
        const row = await check(id, enteredAt, settings);
        if (have) { have.v = row.v; have.dups = { ...(have.dups ?? {}), ...(row.dups ?? {}) }; Object.assign(have.ownerNames, row.ownerNames); }
        else {
          if (!row.stopped) {
            try { row.actual = await outcome(row); } catch (err) { row.error = `outcome: ${(err as Error).message.slice(0, 160)}`; }
          }
          row.backfill = true;
          rows.push(row);
        }
      } catch (err) { if (!have) rows.push({ ...errorRow(id, enteredAt, err), backfill: true }); }
      mark(d); checked++;
    }
    cursor = Math.max(cursor, Date.parse(enteredAt));
  }
  const done = !cut && results.length < 100;
  // a replay pressed meanwhile wins over this run's cursor
  const cur = await kvGet<Backfill>(KV.backfill);
  if (!cur || cur.startedAt === b.startedAt || cur.version !== BACKFILL_VERSION) await kvSet(KV.backfill, { ...b, cursor, done, checked: b.checked + checked });
  return checked;
}

const FOLLOW_PROPS = [...PROPS, "hs_merged_object_ids"];
type WithHist = Raw & { propertiesWithHistory?: Record<string, Hist> };
const mergedIds = (raw: Raw) => String(raw.properties.hs_merged_object_ids ?? "").split(";").map((x) => x.trim()).filter(Boolean);
let lastFollow = 0;

/** Up to 100 tickets as they are now: one search, and a GET for those the search no longer has (merged away, or
 *  deleted) or that others were merged into - HubSpot answers a merged-away id with the ticket it went into. A ticket
 *  missing from the answer could not be read and is asked again next time. Reads only, no database. */
export async function readNow(ids: string[], names: Map<string, string>, more: () => boolean = () => true): Promise<Map<string, { raw: Raw | null; rec: Read }>> {
  const out = new Map<string, { raw: Raw | null; rec: Read }>();
  const res = await hs<{ results?: Raw[] }>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: [{ filters: [{ propertyName: "hs_object_id", operator: "IN", values: ids.slice(0, 100) }] }], properties: FOLLOW_PROPS, limit: 100,
  });
  await pause();
  const byId = new Map((res.results ?? []).map((x) => [String(x.id), x]));
  for (const mine of ids.slice(0, 100).map(String)) {
    const raw = byId.get(mine);
    if (raw && !mergedIds(raw).length) { out.set(mine, { raw, rec: { id: mine, merged: [], closed: (raw.properties.hs_is_closed ?? "").toLowerCase() === "true" } }); continue; }
    if (!more()) continue;
    try {
      const g = await hs<WithHist>(`/crm/v3/objects/tickets/${mine}?properties=${FOLLOW_PROPS.join(",")}&propertiesWithHistory=hs_merged_object_ids`);
      const h = [...(g.propertiesWithHistory?.hs_merged_object_ids ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      // merged away: the first version naming this ticket; others merged in: the latest merge
      const v = String(g.id) !== mine ? h.find((x) => x.value.split(";").includes(mine)) : h[h.length - 1];
      out.set(mine, {
        raw: g,
        rec: {
          id: String(g.id), merged: mergedIds(g), closed: (g.properties.hs_is_closed ?? "").toLowerCase() === "true", mergedAt: v?.timestamp ?? null,
          mergedBy: v ? (v.updatedByUserId ? names.get(String(v.updatedByUserId)) ?? `user ${v.updatedByUserId}` : v.sourceType === "INTEGRATION" ? `app ${v.sourceId}` : v.sourceLabel ?? v.sourceType ?? null) : null,
        },
      });
    } catch (err) {
      if (err instanceof IntegrationError && err.status === 404) out.set(mine, { raw: null, rec: null });
    }
  }
  return out;
}

/** Every stored ticket read again - at 1 hour, daily, and at 7 days (model.ts mergeDue): merged by people, closed, or
 *  still open. A ticket that had no order key and has one now is noted, with what the order-number search finds. */
async function followUp(settings: Settings, rowsFor: RowsFor, mark: (d: string) => void, more: () => boolean): Promise<number> {
  const now = Date.now();
  const due: { r: Row; d: string }[] = [];
  for (let i = 0; i < FOLLOW_DAYS; i++) {
    const d = day(new Date(now - i * 86400_000).toISOString());
    for (const r of await rowsFor(d)) if (mergeDue(r, now)) due.push({ r, d });
  }
  due.sort((a, b) => a.r.enteredAt.localeCompare(b.r.enteredAt));
  const todo = due.slice(0, FOLLOW_MAX);
  const names = await ownerNames();
  let read = 0, searches = 0;
  let archived: Set<string> | null = null;
  for (let i = 0; i < todo.length && more(); i += 100) {
    const chunk = todo.slice(i, i + 100);
    const got = await readNow(chunk.map((x) => String(x.r.ticketId)), names, more);
    for (const { r, d } of chunk) {
      const g = got.get(String(r.ticketId));
      if (!g) continue;
      r.merge = readMerge(r, g.rec, Date.now());
      // no order key at the check, one now (the association engine fills Order Number from e-mails and shop links)
      if (g.raw && String(g.raw.id) === String(r.ticketId) && r.legacy?.skip === SKIP.noKey && !r.later) {
        const t = toTicket(g.raw);
        const keys = [...new Set([...extractKeys(t.subject), ...extractKeys(t.orderNumber)].map((k) => fmtKeys([k])))].sort();
        if (keys.length) {
          r.later = { at: new Date().toISOString(), keys: keys.join(", "), orderNumber: t.orderNumber };
          if (searches < LATER_SEARCHES && more()) {
            searches++;
            try {
              archived ??= await archivedOwners();
              // the targeted search only (firstPass true): enough to show duplicates exist
              const raw = await candidates(t, () => true);
              r.later.wouldFind = decide({ ...toCand(g.raw), sender: null }, raw.map(toCand), settings.types, archived).of;
            } catch { /* counted without it */ }
          }
        }
      }
      mark(d); read++;
    }
  }
  return read;
}

async function run(settings: Settings, signal?: AbortSignal): Promise<RunInfo> {
  const started = Date.now();
  const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, checked: 0, settled: 0, written: 0 };
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
  // only the days that changed are written back
  const dirty = new Set<string>();
  const mark = (d: string) => { dirty.add(d); };
  const flush = async () => { for (const d of dirty) await kvSet(KV.day(d), touched.get(d) ?? []); dirty.clear(); };
  let newest = cursor;
  // four minutes after entry, as the workflow: the routing has renamed the subject and given an owner by then - the
  // younger ones come again with the next run (the search reaches back past the cursor)
  for (const e of found.filter((x) => Date.now() - Date.parse(x.enteredAt) >= WAIT_MS).slice(0, MAX_PER_RUN)) {
    if (signal?.aborted) break;
    const rows = await rowsFor(day(e.enteredAt));
    const key = `${e.id}:${e.enteredAt}`;
    newest = Math.max(newest, Date.parse(e.enteredAt));
    if (rows.some((x) => x.key === key)) continue;
    try {
      const row = await check(e.id, e.enteredAt, settings);
      if (await liveWrite(row, settings)) info.written!++;
      rows.push(row); info.checked++;
    } catch (err) { rows.push(errorRow(e.id, e.enteredAt, err)); }
    mark(day(e.enteredAt));
  }
  for (const d of [day(new Date().toISOString()), day(new Date(Date.now() - 86400_000).toISOString())]) {
    for (const x of await rowsFor(d)) {
      if (signal?.aborted) break;
      if (x.actual || x.error || x.stopped || Date.now() - Date.parse(x.enteredAt) < OUTCOME_AFTER_MS) continue;
      try { x.actual = await outcome(x); info.settled++; } catch (err) { x.error = `outcome: ${(err as Error).message.slice(0, 160)}`; }
      mark(d);
    }
  }
  await flush();
  await kvSet(KV.cursor, found.length > MAX_PER_RUN ? newest : Math.max(newest, Date.now() - OVERLAP_MS));
  await kvSet(KV.day(new Date(Date.now() - DAYS_KEPT * 86400_000).toISOString().slice(0, 10)), null);

  // the extra work, only while the run is young; a failure here never costs the live rows (already written)
  const more = () => !signal?.aborted && Date.now() - started < WORK_MS;
  const extra: string[] = [];
  if (more()) {
    try { info.backfilled = await backfill(settings, rowsFor, mark, more); } catch (err) { extra.push(`replay: ${(err as Error).message.slice(0, 120)}`); }
    await flush();
  }
  if (more() && Date.now() - lastFollow >= FOLLOW_EVERY_MS) {
    lastFollow = Date.now();
    try { info.followed = await followUp(settings, rowsFor, mark, more); } catch (err) { extra.push(`follow-up: ${(err as Error).message.slice(0, 120)}`); }
    await flush();
  }
  if (extra.length) info.error = extra.join("; ");
  info.seconds = Math.round((Date.now() - started) / 1000);
  await kvSet(KV.last, info);
  return info;
}

/** One run under an advisory lock - the connection dropped (and the lock with it) when the time limit hits. */
async function locked<T>(lock: number, work: () => Promise<T>, signal?: AbortSignal): Promise<T | null> {
  const client: PoolClient = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("ticket duplicates: time limit")); };
  if (signal?.aborted) drop(); else signal?.addEventListener("abort", drop, { once: true });
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [lock]);
    if (!got.rows[0]?.ok) return null;
    try { return await work(); }
    finally { if (!dropped) await client.query("SELECT pg_advisory_unlock($1)", [lock]).catch(() => {}); }
  } finally {
    signal?.removeEventListener("abort", drop);
    if (!dropped) client.release();
  }
}

export async function runOnce(signal?: AbortSignal): Promise<RunInfo | null> {
  const settings = await getSettings();
  if (settings.mode === "off") return null;
  return locked(LOCK, () => run(settings, signal).catch(async (e) => {
    const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, checked: 0, settled: 0, error: (e as Error).message.slice(0, 300) };
    await kvSet(KV.last, info);
    return info;
  }), signal);
}

/** The decisions people took on the card, carried out - while merging is on and the properties exist. */
export async function decisionsOnce(): Promise<{ done: number; errors: number } | null> {
  const settings = await getSettings();
  if (settings.merging !== "on" || !(await propsState()).ready) return null;
  return locked(DECISIONS_LOCK, async () => {
    const r = await runDecisions().catch((e) => ({ done: 0, errors: 1, error: (e as Error).message.slice(0, 200) }));
    await kvSet(KV.decisions, { at: new Date().toISOString(), ...r });
    return r;
  });
}

let started = false, running = false, deciding = false;
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
  const decisions = () => {
    if (deciding) return;
    deciding = true;
    void decisionsOnce()
      .then((r) => { if (r && (r.done || r.errors)) console.log(`[ticket-duplicates] decisions: ${r.done} done, ${r.errors} failed`); })
      .catch((e) => console.warn(`[ticket-duplicates] decisions: ${(e as Error).message}`))
      .finally(() => { deciding = false; });
  };
  setTimeout(tick, 100_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
  setInterval(decisions, DECISIONS_EVERY_MS).unref?.();
}


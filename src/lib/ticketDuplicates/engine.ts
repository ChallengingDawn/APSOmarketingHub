// DUPLICATES & MERGES - SHADOW MODE (SARCLA 18.10.2026: "DUPS and merge should be a separate app"). For every
// ticket entering Back Office "New" the hub looks for its duplicates the way the workflow "SARCLA | BACK OFFICE
// FILTERING | DUPS HANDLING WITH CODE" does (rules.ts) - its targeted search on the order number and subject, then
// its sweep of the newest 1000 tickets when that found nothing - once exactly as the workflow ("legacy") and once
// with the exclusions set on the page ("hub"); ten minutes later it reads what HubSpot wrote (dup_reason_and_id,
// and whether the owner moved). Writes NOTHING to HubSpot. Merging stays a person's decision in HubSpot
// ("Merge the tickets, I've checked" -> BO MERGING); the page lists those merges.
// After the live work, while time allows: the last 7 days replayed (oldest first, 25 a run), and every stored ticket
// read again at 1 hour, daily, and at 7 days - merged by people, closed, or still open (model.ts, measure.ts).
// Every 3 minutes, one copy of the hub at a time (advisory lock 4107232).

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { IntegrationError } from "@/lib/integrations/status";
import { DEFAULT_EXCLUSIONS, extractKeys, findDuplicates, fmtKeys, isErosion, type DupResult, type Exclusions, type Ticket } from "./rules";
import { mergeDue, ownerWhy, readMerge, workflowWrites, type Outcome, type Read, type Row } from "./model";
import { SKIP } from "./measure";

export type { Outcome, Row } from "./model";

const LOCK = 4_107_232;
const EVERY_MS = 3 * 60_000;
const LIMIT_MS = 10 * 60_000;
const OVERLAP_MS = 5 * 60_000;
const OUTCOME_AFTER_MS = 10 * 60_000;
const DAYS_KEPT = 21;
const MAX_PER_RUN = 25;
const BO = "1726786777", BO_NEW = "2338266325", CERTIFICATES = "3640065212";
/** extra work (replay, follow-up) starts only this long into a run - the next run is 3 minutes away */
const WORK_MS = 100_000;
const BACKFILL_DAYS = 7;
/** the replay stops short of now: the newest entries are the live loop's, and the workflow needs ~5 minutes */
const BACKFILL_GAP_MS = 20 * 60_000;
const FOLLOW_EVERY_MS = 15 * 60_000;
const FOLLOW_DAYS = 9;
const FOLLOW_MAX = 300;
const LATER_SEARCHES = 5;

export type Settings = { mode: "off" | "shadow"; exclusions: Exclusions; by: string | null; at: string | null };
export type RunInfo = { at: string; seconds: number; read: number; checked: number; settled: number; backfilled?: number; followed?: number; error?: string };
/** The replay of the last 7 days: Back Office "New" entries from `from` to `until`, `cursor` = the last one done. */
export type Backfill = { from: string; until: string; cursor: number; done: boolean; startedAt: string; checked: number; by: string | null };

const KV = { settings: "ticketDup:settings", last: "ticketDup:lastRun", cursor: "ticketDup:cursor", backfill: "ticketDup:backfill", day: (d: string) => `ticketDup:rows:${d}` };

/** The hub's exclusions until the page saves others (SARCLA 18.10.2026, "go ahead"): the owner only from a duplicate in the
 *  same pipeline, and the ERP's stale-export warnings never a duplicate. The copy keeps the workflow's own behaviour. */
export const INITIAL_EXCLUSIONS: Exclusions = { ...DEFAULT_EXCLUSIONS, ownerFromSamePipelineOnly: true, neverMatchTexts: ["ERP Order Export Stale Warning"] };

export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Settings>(KV.settings);
  return { mode: s?.mode ?? "shadow", exclusions: { ...INITIAL_EXCLUSIONS, ...(s?.exclusions ?? {}) }, by: s?.by ?? null, at: s?.at ?? null };
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
const freshBackfill = (by: string | null): Backfill => {
  const now = Date.now();
  return { from: new Date(now - BACKFILL_DAYS * 86400_000).toISOString(), until: new Date(now - BACKFILL_GAP_MS).toISOString(), cursor: now - BACKFILL_DAYS * 86400_000, done: false, startedAt: new Date(now).toISOString(), checked: 0, by };
};
export const backfillState = async () => (await kvGet<Backfill>(KV.backfill)) ?? null;
/** "Replay the last 7 days": the cursor back to 7 days ago - tickets already stored are skipped. */
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
  const row: Row = { key: `${id}:${enteredAt}`, ticketId: id, enteredAt, seenAt: new Date().toISOString(), subject: me.subject, orderNumber: me.orderNumber, keys: "", legacy: null, hub: null, ownerNames: {}, ownerAtCheck: me.owner, pipeline: me.pipeline };
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
  // the duplicates as seen now - their pipeline, age and state are what the measurement needs
  const ids = new Set([...row.legacy.duplicates, ...row.hub.duplicates]);
  const found = cands.filter((c, i) => ids.has(c.id) && cands.findIndex((x) => x.id === c.id) === i);
  row.dups = Object.fromEntries(found.map((c) => [c.id, { subject: c.subject.slice(0, 140), pipeline: c.pipeline, createdate: c.createdate, closed: c.closed, owner: c.owner }]));
  const of = (r: DupResult) => found.filter((c) => r.duplicates.includes(c.id));
  row.ownerWhy = { legacy: ownerWhy(me, of(row.legacy), legacyEx, archived, row.legacy), hub: ownerWhy(me, of(row.hub), settings.exclusions, archived, row.hub) };
  const names = await ownerNames();
  for (const o of [row.legacy.ownerChange?.ownerId, row.hub.ownerChange?.ownerId, me.owner, ...found.map((c) => c.owner)]) if (o) row.ownerNames[o] = names.get(o) ?? o;
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

type RowsFor = (d: string) => Promise<Row[]>;
const errorRow = (id: string, enteredAt: string, err: unknown): Row => ({
  key: `${id}:${enteredAt}`, ticketId: id, enteredAt, seenAt: new Date().toISOString(), subject: "", orderNumber: null, keys: "", legacy: null, hub: null, ownerNames: {}, ownerAtCheck: null, error: (err as Error).message.slice(0, 200),
});

/** The last 7 days, oldest first: entries the hub never stored, checked as the live loop checks and settled at once
 *  (the workflow answered days ago). The ticket, its duplicates and its owner are read as they are today. */
async function backfill(settings: Settings, rowsFor: RowsFor, mark: (d: string) => void, more: () => boolean): Promise<number> {
  const b = (await kvGet<Backfill>(KV.backfill)) ?? freshBackfill("first run");
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
    if (!rows.some((y) => y.key === `${id}:${enteredAt}`)) {
      if (checked >= MAX_PER_RUN || !more()) { cut = true; break; }
      let row: Row;
      try {
        row = await check(id, enteredAt, settings);
        if (!row.stopped) {
          try { row.actual = await outcome(row); } catch (err) { row.error = `outcome: ${(err as Error).message.slice(0, 160)}`; }
        }
      } catch (err) { row = errorRow(id, enteredAt, err); }
      row.backfill = true;
      rows.push(row); mark(d); checked++;
    }
    cursor = Math.max(cursor, Date.parse(enteredAt));
  }
  const done = !cut && results.length < 100;
  // a replay pressed meanwhile wins over this run's cursor
  const cur = await kvGet<Backfill>(KV.backfill);
  if (!cur || cur.startedAt === b.startedAt) await kvSet(KV.backfill, { ...b, cursor, done, checked: b.checked + checked });
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
              r.later.wouldFind = findDuplicates(t, await candidates(t, () => true), settings.exclusions, archived).duplicates;
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
  // only the days that changed are written back
  const dirty = new Set<string>();
  const mark = (d: string) => { dirty.add(d); };
  const flush = async () => { for (const d of dirty) await kvSet(KV.day(d), touched.get(d) ?? []); dirty.clear(); };
  let newest = cursor;
  for (const e of found.slice(0, MAX_PER_RUN)) {
    if (signal?.aborted) break;
    const rows = await rowsFor(day(e.enteredAt));
    const key = `${e.id}:${e.enteredAt}`;
    newest = Math.max(newest, Date.parse(e.enteredAt));
    if (rows.some((x) => x.key === key)) continue;
    try { rows.push(await check(e.id, e.enteredAt, settings)); info.checked++; }
    catch (err) { rows.push(errorRow(e.id, e.enteredAt, err)); }
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

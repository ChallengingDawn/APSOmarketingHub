// DUPLICATES & MERGES (SARCLA 18.10.2026: "DUPS and merge should be a separate app"; 02.11.2026: "improve a lot the
// duplicated app ... tabs to steer the different types", "person clicks, hub merges", "if we are 100% ... merge the 100%
// directly and the rest await for the manual"). For every ticket entering Back Office "New", four minutes after it came
// (as the workflow waits - the subject is renamed and the ticket has an owner by then):
//   - the candidates: the order number's search (order number and subject, every pipeline), the sender's tickets of the
//     last days (the ticket's first contact);
//   - the verdict (types.ts): the same request twice, another open ticket on the same order - or nothing; for "twice"
//     the first e-mail of both tickets is read: the same text = 100% sure;
//   - live (live.ts), only once the workflow is switched off: a 100% sure one merged into the older open ticket (its
//     owner kept), the rest written on the ticket for a person to decide, the owner handed over where the type says.
// Every stored ticket is read again at 1 hour, daily, and at 7 days - merged, closed or still open (model.ts). The last
// 365 days come from the year build (year.ts). Every 3 minutes, one copy of the hub at a time (advisory lock 4107232);
// the decisions people take on the card every minute (lock 4107236) while merging is on.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { IntegrationError } from "@/lib/integrations/status";
import { extractKeys, fmtKeys } from "./rules";
import { mergeDue, readMerge, type Read, type Row } from "./model";
import { DEFAULT_TYPES, decide, makeSure, sameText, type Cand, type Me, type TypeSettings } from "./types";
import { propsState } from "./properties";
import { autoMerge, runDecisions, workflowOn, writeVerdict } from "./live";
import { day, dropOldest, rowsOfDay, saveDay } from "./store";
import { buildYear, yearDue } from "./year";
import { BO, BO_NEW, PROPS, archivedOwners, firstText, hs, infoOf, locked, pause, search, toCand, type Raw } from "./reads";

export type { Row } from "./model";

const LOCK = 4_107_232, DECISIONS_LOCK = 4_107_236;
const EVERY_MS = 3 * 60_000, DECISIONS_EVERY_MS = 60_000;
const LIMIT_MS = 10 * 60_000;
const OVERLAP_MS = 5 * 60_000;
const WAIT_MS = 4 * 60_000;
/** an owner is only handed over, and a ticket only merged by itself, while it is fresh - never after an outage */
const FRESH_MS = 60 * 60_000;
const MAX_PER_RUN = 25;
const WORK_MS = 100_000;
const FOLLOW_EVERY_MS = 15 * 60_000;
const FOLLOW_DAYS = 9;
const FOLLOW_MAX = 300;

export type Mode = "off" | "shadow" | "live";
export type Settings = {
  mode: Mode;
  /** the decisions people take on the card carried out (merge, not a duplicate) */
  merging: "off" | "on";
  types: TypeSettings;
  by: string | null; at: string | null;
};
export type RunInfo = { at: string; seconds: number; read: number; checked: number; written?: number; merged?: number; followed?: number; error?: string };

const KV = { settings: "ticketDup:settings", last: "ticketDup:lastRun", decisions: "ticketDup:decisionsRun", cursor: "ticketDup:cursor" };

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || dflt));
const texts = (a: unknown, max: number) => [...new Set((Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter(Boolean))].slice(0, max);
const bool = (v: unknown, dflt: boolean) => (typeof v === "boolean" ? v : dflt);
function cleanTypes(t: Partial<TypeSettings> | undefined, cur: TypeSettings): TypeSettings {
  const tw = { ...cur.twice, ...(t?.twice ?? {}) }, or = { ...cur.order, ...(t?.order ?? {}) };
  return {
    twice: {
      on: bool(tw.on, true), withinHours: clampInt(tw.withinHours, 1, 24 * 14, 72), handOver: bool(tw.handOver, true), autoMerge: bool(tw.autoMerge, true),
      internalDomains: texts(tw.internalDomains, 40).map((d) => d.toLowerCase().replace(/^@/, "")),
    },
    order: { on: bool(or.on, true), handOver: bool(or.handOver, true), ownerMaxAgeDays: clampInt(or.ownerMaxAgeDays, 0, 365, 30) },
    neverMatchTexts: t?.neverMatchTexts !== undefined ? texts(t.neverMatchTexts, 60) : cur.neverMatchTexts,
  };
}

export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings> & { mode?: string }>(KV.settings);
  return {
    mode: s?.mode === "off" || s?.mode === "live" ? s.mode : "shadow",
    merging: s?.merging === "on" ? "on" : "off",
    types: cleanTypes(s?.types, DEFAULT_TYPES),
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

// ---------------- HubSpot, read ----------------
/** The tickets naming the same order: CONTAINS_TOKEN on Order Number, then subject, for the first two order cores. */
async function orderTickets(me: Cand): Promise<Raw[]> {
  const cores = [...new Set([...extractKeys(me.subject), ...extractKeys(me.orderNumber)].map((k) => k.core))].sort().slice(0, 2);
  const out: Raw[] = [];
  for (const core of cores) for (const prop of ["order_number", "subject"]) out.push(...(await search([{ propertyName: prop, operator: "CONTAINS_TOKEN", value: core }])));
  return out;
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
/** The sender's tickets of the hours before. */
const senderTickets = (sender: NonNullable<Me["sender"]>, created: number, hours: number) => search([
  { propertyName: "associations.contact", operator: "EQ", value: sender.id },
  { propertyName: "createdate", operator: "GTE", value: String(created - hours * 3600_000) },
  { propertyName: "createdate", operator: "LTE", value: String(created) },
]);
async function check(id: string, enteredAt: string, settings: Settings): Promise<Row> {
  const t = await hs<Raw>(`/crm/v3/objects/tickets/${id}?properties=${PROPS.join(",")}`);
  const me = toCand(t);
  const types = settings.types;
  const [archived, names, sender, byOrder] = await Promise.all([archivedOwners(), ownerNames(), senderOf(id).catch(() => null), orderTickets(me)]);
  const all = new Map<string, Cand>(byOrder.map((r) => [String(r.id), toCand(r)]));
  const threads = new Map<string, string | null>([[id, t.properties.hs_conversations_originating_thread_id ?? null], ...byOrder.map((r) => [String(r.id), r.properties.hs_conversations_originating_thread_id ?? null] as [string, string | null])]);
  if (sender && types.twice.on) {
    for (const r of await senderTickets(sender, Date.parse(me.createdate ?? enteredAt) || Date.now(), types.twice.withinHours)) {
      all.set(String(r.id), { ...(all.get(String(r.id)) ?? toCand(r)), sameSender: true });
      threads.set(String(r.id), r.properties.hs_conversations_originating_thread_id ?? null);
    }
  }
  let v = decide({ ...me, sender }, [...all.values()], types, archived, (o) => names.get(o) ?? o);
  // the same request twice: is it the same e-mail, word for word?
  if (v.type === "twice") {
    const [a, b] = await Promise.all([firstText(threads.get(id)).catch(() => ""), firstText(threads.get(v.of[0])).catch(() => "")]);
    if (sameText(a, b)) v = makeSure(v, sender?.domain ?? null);
  }
  const row: Row = {
    key: `${id}:${enteredAt}`, ticketId: id, enteredAt, seenAt: new Date().toISOString(), subject: me.subject.slice(0, 200), orderNumber: me.orderNumber,
    keys: fmtKeys([...extractKeys(me.subject), ...extractKeys(me.orderNumber)]), pipeline: me.pipeline, sender: sender?.domain ?? null,
    ownerNames: {}, ownerAtCheck: me.owner, v, dups: infoOf(v, all),
  };
  for (const o of [v.ownerChange?.ownerId, me.owner, ...Object.values(row.dups ?? {}).map((d) => d.owner)]) if (o) row.ownerNames[o] = names.get(o) ?? o;
  return row;
}

/** One ticket checked now - nothing stored, nothing written. */
export async function checkTicket(id: string, settings?: Settings): Promise<Row> {
  const prop = `hs_v2_date_entered_${BO_NEW}`;
  const t = await hs<Raw>(`/crm/v3/objects/tickets/${id}?properties=${prop}`);
  const entered = Date.parse(t.properties[prop] ?? "");
  return check(id, new Date(Number.isFinite(entered) ? entered : Date.now()).toISOString(), settings ?? (await getSettings()));
}

/** Live: a 100% sure one merged into the older ticket, the others' verdict written - only while the page says Live,
 *  the workflow is off and the properties exist. */
async function liveWrite(row: Row, settings: Settings): Promise<"merged" | "written" | null> {
  const v = row.v;
  if (settings.mode !== "live" || !v?.status) return null;
  if ((await workflowOn()) !== false || !(await propsState()).ready) return null;
  const fresh = Date.now() - Date.parse(row.enteredAt) < FRESH_MS;
  let note: string | undefined;
  try {
    if (v.type === "twice" && v.sure && settings.types.twice.autoMerge && fresh) {
      const r = await autoMerge(row.ticketId, v);
      if (r.merged) { row.live = { at: new Date().toISOString(), flagged: true, owner: false, merged: r.into }; return "merged"; }
      // not merged after all (the older one closed meanwhile, the hour's limit): a person decides
      note = r.note;
    }
    const r = await writeVerdict(row.ticketId, fresh ? v : { ...v, ownerChange: null });
    note ??= r.note ?? (!fresh && v.ownerChange ? "seen over an hour after entry - owner left alone" : undefined);
    row.live = { at: new Date().toISOString(), flagged: r.flagged, owner: r.owner, ...(note ? { note } : {}) };
    return r.flagged ? "written" : null;
  } catch (e) {
    row.live = { at: new Date().toISOString(), flagged: false, owner: false, error: (e as Error).message.slice(0, 200) };
    return null;
  }
}

const errorRow = (id: string, enteredAt: string, err: unknown): Row => ({
  key: `${id}:${enteredAt}`, ticketId: id, enteredAt, seenAt: new Date().toISOString(), subject: "", orderNumber: null, keys: "", ownerNames: {}, ownerAtCheck: null, error: (err as Error).message.slice(0, 200),
});

const mergedIds = (raw: Raw) => String(raw.properties.hs_merged_object_ids ?? "").split(";").map((x) => x.trim()).filter(Boolean);
type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string; sourceLabel?: string; updatedByUserId?: number }[];
let lastFollow = 0;

/** Up to 100 tickets as they are now: one search, and a GET for those the search no longer has (merged away, or deleted)
 *  or that others were merged into - HubSpot answers a merged-away id with the ticket it went into. */
async function readNow(ids: string[], names: Map<string, string>, more: () => boolean): Promise<Map<string, Read>> {
  const out = new Map<string, Read>();
  const props = ["hs_is_closed", "hs_merged_object_ids"];
  const res = await hs<{ results?: Raw[] }>("/crm/v3/objects/tickets/search", "POST", { filterGroups: [{ filters: [{ propertyName: "hs_object_id", operator: "IN", values: ids.slice(0, 100) }] }], properties: props, limit: 100 });
  await pause();
  const byId = new Map((res.results ?? []).map((x) => [String(x.id), x]));
  for (const mine of ids.slice(0, 100).map(String)) {
    const raw = byId.get(mine);
    if (raw && !mergedIds(raw).length) { out.set(mine, { id: mine, merged: [], closed: (raw.properties.hs_is_closed ?? "").toLowerCase() === "true" }); continue; }
    if (!more()) continue;
    try {
      const g = await hs<Raw & { propertiesWithHistory?: Record<string, Hist> }>(`/crm/v3/objects/tickets/${mine}?properties=${props.join(",")}&propertiesWithHistory=hs_merged_object_ids`);
      const h = [...(g.propertiesWithHistory?.hs_merged_object_ids ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const v = String(g.id) !== mine ? h.find((x) => x.value.split(";").includes(mine)) : h[h.length - 1];
      out.set(mine, {
        id: String(g.id), merged: mergedIds(g), closed: (g.properties.hs_is_closed ?? "").toLowerCase() === "true", mergedAt: v?.timestamp ?? null,
        mergedBy: v ? (v.updatedByUserId ? names.get(String(v.updatedByUserId)) ?? `user ${v.updatedByUserId}` : v.sourceType === "INTEGRATION" ? `app ${v.sourceId}` : v.sourceLabel ?? v.sourceType ?? null) : null,
      });
    } catch (err) {
      if (err instanceof IntegrationError && err.status === 404) out.set(mine, null);
    }
  }
  return out;
}

async function run(settings: Settings, signal?: AbortSignal): Promise<RunInfo> {
  const started = Date.now();
  const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, checked: 0, written: 0, merged: 0 };
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
  const dirty = new Set<string>();
  const flush = async () => { for (const d of dirty) await saveDay(d, touched.get(d) ?? []); dirty.clear(); };
  let newest = cursor;
  // four minutes after entry - the younger ones come again with the next run (the search reaches back past the cursor)
  for (const e of found.filter((x) => Date.now() - Date.parse(x.enteredAt) >= WAIT_MS).slice(0, MAX_PER_RUN)) {
    if (signal?.aborted) break;
    const rows = await rowsFor(day(e.enteredAt));
    const key = `${e.id}:${e.enteredAt}`;
    newest = Math.max(newest, Date.parse(e.enteredAt));
    if (rows.some((x) => x.key === key && !x.backfill)) continue;
    let row: Row;
    try {
      row = await check(e.id, e.enteredAt, settings);
      const w = await liveWrite(row, settings);
      if (w === "merged") info.merged!++; else if (w === "written") info.written!++;
      info.checked++;
    } catch (err) { row = errorRow(e.id, e.enteredAt, err); }
    const at = rows.findIndex((x) => x.key === key);
    if (at >= 0) rows[at] = row; else rows.push(row);
    dirty.add(day(e.enteredAt));
  }
  await flush();
  await kvSet(KV.cursor, found.length > MAX_PER_RUN ? newest : Math.max(newest, Date.now() - OVERLAP_MS));
  await dropOldest();

  // the follow-up, while the run is young: merged, closed or still open
  const more = () => !signal?.aborted && Date.now() - started < WORK_MS;
  if (more() && Date.now() - lastFollow >= FOLLOW_EVERY_MS) {
    lastFollow = Date.now();
    try {
      const now = Date.now();
      const due: { r: Row; d: string }[] = [];
      for (let i = 0; i < FOLLOW_DAYS; i++) {
        const d = day(new Date(now - i * 86400_000).toISOString());
        for (const x of await rowsFor(d)) if (mergeDue(x, now)) due.push({ r: x, d });
      }
      due.sort((a, b) => a.r.enteredAt.localeCompare(b.r.enteredAt));
      const names = await ownerNames();
      let n = 0;
      for (const chunk of [due.slice(0, 100), due.slice(100, 200), due.slice(200, FOLLOW_MAX)]) {
        if (!chunk.length || !more()) break;
        const got = await readNow(chunk.map((x) => x.r.ticketId), names, more);
        for (const { r: x, d } of chunk) { if (!got.has(x.ticketId)) continue; x.merge = readMerge(x, got.get(x.ticketId)!, Date.now()); dirty.add(d); n++; }
      }
      info.followed = n;
      await flush();
    } catch (err) { info.error = `follow-up: ${(err as Error).message.slice(0, 120)}`; }
  }
  info.seconds = Math.round((Date.now() - started) / 1000);
  await kvSet(KV.last, info);
  return info;
}

export async function runOnce(signal?: AbortSignal): Promise<RunInfo | null> {
  const settings = await getSettings();
  if (settings.mode === "off") return null;
  return locked(LOCK, () => run(settings, signal).catch(async (e) => {
    const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, checked: 0, error: (e as Error).message.slice(0, 300) };
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

let started = false, running = false, deciding = false, building = false;
export function startTicketDuplicates() {
  if (started || process.env.TICKET_DUPLICATES === "off") return;
  started = true;
  const tick = () => {
    // the last 365 days, built once (and again when asked) - its own lock, beside the live runs
    if (!building) {
      building = true;
      void yearDue()
        .then(async (due) => { if (due) { const s = await getSettings(); if (s.mode !== "off") await buildYear(s); } })
        .catch((e) => console.warn(`[ticket-duplicates] year: ${(e as Error).message}`))
        .finally(() => { building = false; });
    }
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

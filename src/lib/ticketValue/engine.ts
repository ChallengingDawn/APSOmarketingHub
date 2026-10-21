// TICKET VALUE - SHADOW MODE (SARCLA 20.10.2026: "bring the workflow SARCLA | TICKET VALUE CALCULATION as a sub app on
// the hub"). Every time the workflow takes a ticket - a new ticket, or one entering ESO/TSA "Waiting on customer" or
// "In progress" - the hub works the value out with the workflow's own rules (rules.ts), from the ticket as it was
// before the workflow wrote, and sets it next to what the workflow wrote (the property history: its Python step writes
// as app 30109717, its copy branches as the workflow). Writes NOTHING to HubSpot: the ticket -> company link the
// Python makes is recorded, not made.
// The hub looks when the workflow runs (4 minutes after the trigger) and reads what the workflow wrote 20 minutes after
// it; a ticket the workflow left alone is read again after 2 hours.
// Every 2 minutes, one copy of the hub at a time (advisory lock 4107234). TICKET_VALUE=off stops it.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { IntegrationError } from "@/lib/integrations/status";
import { BRANCH_LABEL, HUB_RULES, PIPELINES, REENROL_STAGES, TICKET_PROPS, WAIT_MS, decide, decideHub, lastEditorIsHuman, toNum, type Api, type Better, type Branch, type HistoryEntry, type HubRule } from "./rules";
import { loadReport } from "@/lib/integrations/articleReport";
import { firstOrderState, firstOrderStep } from "./firstOrder";
import { enrolsOnStage, finalOf, pricesOf, sameValue, type Values, type Verdict } from "./model";

export type { Verdict } from "./model";

const LOCK = 4_107_234;
const EVERY_MS = 2 * 60_000;
const LIMIT_MS = 10 * 60_000;
/** the workflow waits 4 minutes and then runs; 20 minutes later it has written if it ever will */
const BEHIND_MS = 20 * 60_000;
const RECHECK_MS = 2 * 60 * 60_000;
/** the first run starts a day back: those tickets are looked at late (their company may have changed since) */
const FIRST_DAYS = 1;
const LATE_MS = 15 * 60_000;
const MAX_PER_RUN = 40;
const DAYS_KEPT = 21;
const WORK_MS = 100_000;
/** the workflow's Python step writes as this app (secret DISTRIBUTION) */
export const WORKFLOW_APP = "30109717";
export const WORKFLOW_ID = "4326395107";
const VALUE_PROPS = ["sales_potential_estimate", "sales_potential_source", "sales_potential_confidence"] as const;

export type Settings = { mode: "off" | "shadow"; by: string | null; at: string | null };
export type RunInfo = { at: string; seconds: number; found: number; checked: number; settled: number; rechecked: number; behind?: string; error?: string };
export type Row = {
  key: string;
  ticketId: string;
  subject: string;
  pipeline: string;
  trigger: "created" | "stage";
  /** the stage entered, for "stage" */
  stage?: string;
  at: string;
  /** the workflow takes the ticket (a stage entry only when its value is unknown, written since yesterday, or older than 10 days) */
  enrols: boolean;
  before: Values;
  /** the workflow's rules, copied exactly - what is compared with the workflow */
  hub: {
    branch: Branch; action: string; final: Values; why?: string; link?: string | null; company?: string | null; kpi?: { upsert: string[]; archive: string[] };
    /** the hub's own rules (rules.ts "THE HUB'S IMPROVEMENTS") - what it writes once it takes over */
    better?: { rule?: HubRule; action: string; final: Values; company?: string | null };
  } | null;
  workflow: { wrote: boolean; at: string | null; by: "code" | "branch" | null; final: Values };
  verdict: Verdict;
  checkedAt: string;
  settledAt?: string;
  recheckedAt?: string;
  /** looked at more than 15 minutes after the trigger (the first day's replay): its company may have changed since */
  late?: boolean;
  error?: string;
};

const KV = { settings: "ticketValue:settings", last: "ticketValue:lastRun", cursor: "ticketValue:cursor", day: (d: string) => `ticketValue:rows:${d}` };

export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Settings>(KV.settings);
  return { mode: s?.mode ?? "shadow", by: s?.by ?? null, at: s?.at ?? null };
}
export async function saveSettings(patch: { mode?: "off" | "shadow" }, by: string): Promise<Settings> {
  const cur = await getSettings();
  const next: Settings = { mode: patch.mode === "off" ? "off" : patch.mode === "shadow" ? "shadow" : cur.mode, by, at: new Date().toISOString() };
  await kvSet(KV.settings, next);
  return next;
}
export const lastRun = async () => (await kvGet<RunInfo>(KV.last)) ?? null;
const day = (iso: string) => iso.slice(0, 10);
const rowsOfDay = async (d: string) => (await kvGet<Row[]>(KV.day(d))) ?? [];
export async function recentRows(days = 7): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < days; i++) out.push(...(await rowsOfDay(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10))));
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** HubSpot as the Python's `requests` saw it: a status, never a throw; the link is only recorded. One ticket's reads are
 *  kept, so the copy and the hub's own rules read HubSpot once between them. */
function shadowApi(links: string[]): Api {
  const seen = new Map<string, Promise<{ status: number; json: unknown }>>();
  const call = (path: string, method: "GET" | "POST", body?: unknown) => {
    const key = `${method} ${path} ${body === undefined ? "" : JSON.stringify(body)}`;
    if (!seen.has(key)) seen.set(key, hubspotRetry<unknown>({ path, method, body }).then((json) => ({ status: 200, json }), (e) => ({ status: e instanceof IntegrationError && e.status ? e.status : 0, json: {} })));
    return seen.get(key)!;
  };
  return { get: (p) => call(p, "GET"), post: (p, b) => call(p, "POST", b), put: async (p) => { links.push(p); return { status: 200, json: {} }; } };
}

/** What the hub knows for its own rules: each article's price per piece (the article report, rebuilt every night) and
 *  the average first order. */
let priceMap: { generated: string; map: Map<string, number> } | null = null;
export async function betterContext(): Promise<Better & { firstOrderAt: string | null; firstOrderN: number; pricedArticles: number }> {
  const rep = await loadReport().catch(() => null);
  if (rep && priceMap?.generated !== rep.generated) priceMap = { generated: rep.generated, map: pricesOf(rep.rows) };
  const map = priceMap?.map ?? new Map<string, number>();
  const fo = await firstOrderState();
  return { price: (a) => map.get(a) ?? null, firstOrder: fo.avg, firstOrderAt: fo.at, firstOrderN: fo.n, pricedArticles: map.size };
}

type Raw = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, HistoryEntry[]> };
const isWorkflow = (h: HistoryEntry) => (h.sourceType === "INTEGRATION" && String(h.sourceId) === WORKFLOW_APP) || h.sourceType === "AUTOMATION_PLATFORM";

const readTicket = async (id: string) => {
  const t = await hubspotRetry<Raw>({ path: `/crm/v3/objects/tickets/${id}?properties=${TICKET_PROPS.join(",")}&propertiesWithHistory=${VALUE_PROPS.join(",")}` });
  return { p: t.properties ?? {}, hist: t.propertiesWithHistory ?? {} };
};
/** the workflow's writes of the three properties within the hour after a trigger */
function workflowWrites(hist: Record<string, HistoryEntry[]>, atMs: number) {
  return VALUE_PROPS.flatMap((k) => (hist[k] ?? [])
    .filter((h) => { const t = Date.parse(h.timestamp ?? ""); return isWorkflow(h) && t >= atMs - 1000 && t <= atMs + 60 * 60_000; })
    .map((h) => ({ k, h, t: Date.parse(h.timestamp!) })));
}

/**
 * The first look, as the workflow runs (4 minutes after the trigger): the ticket as it was before the workflow wrote,
 * and what the hub would leave. Read this early so the hub sees the ticket's company and figures as the workflow
 * did - a ticket's companies change in its first hour (HubSpot then lists a different "first" company).
 */
export async function firstLook(id: string, trigger: Row["trigger"], at: string, stage?: string, better?: Better): Promise<Row> {
  const { p, hist } = await readTicket(id);
  const atMs = Date.parse(at);
  const writes = workflowWrites(hist, atMs);
  const firstWrite = writes.length ? Math.min(...writes.map((x) => x.t)) : null;
  const cutoff = firstWrite ?? Date.now();
  const histBefore = (k: string) => (hist[k] ?? []).filter((h) => Date.parse(h.timestamp ?? "") < cutoff);
  const before = Object.fromEntries(VALUE_PROPS.map((k) => [k, histBefore(k)[0]?.value ?? null])) as Values;
  const enrols = trigger === "created" || enrolsOnStage(before.sales_potential_estimate, histBefore("sales_potential_estimate")[0]?.timestamp ?? null, atMs);
  let hub: Row["hub"] = null;
  if (enrols) {
    const links: string[] = [];
    const api = shadowApi(links);
    const asWas = { ...p, ...before }, human = lastEditorIsHuman(histBefore("sales_potential_estimate")), today = new Date(cutoff).toISOString().slice(0, 10);
    const d = await decide(api, id, asWas, human, today);
    hub = {
      branch: d.branch, action: d.action, final: finalOf(before, d.patch), why: d.scored?.why,
      link: links[0]?.split("/").pop() ?? null, company: d.scored?.company ? `${d.scored.company.id} (${d.scored.company.via})` : null, kpi: d.kpi,
    };
    if (better) {
      const b = await decideHub(api, id, asWas, human, today, better);
      hub.better = { rule: b.rule, action: b.action, final: finalOf(before, b.patch), company: b.scored?.company ? `${b.scored.company.id} (${b.scored.company.via})` : null };
    }
  }
  return {
    key: `${id}:${trigger}:${at}`, ticketId: id, subject: (p.subject ?? "").slice(0, 160), pipeline: PIPELINES[p.hs_pipeline ?? ""] ?? "other",
    trigger, stage, at, enrols, before, hub, workflow: { wrote: false, at: null, by: null, final: before }, verdict: "pending",
    checkedAt: new Date().toISOString(), late: Date.now() - atMs > LATE_MS || undefined,
  };
}

/** 20 minutes on: what the workflow wrote, and the verdict. */
export async function settle(row: Row): Promise<void> {
  const { hist } = await readTicket(row.ticketId);
  const writes = workflowWrites(hist, Date.parse(row.at));
  const final = { ...row.before };
  for (const k of VALUE_PROPS) {
    const last = writes.filter((x) => x.k === k).sort((a, b) => b.t - a.t)[0];
    if (last) final[k] = last.h.value ?? null;
  }
  row.workflow = {
    wrote: writes.length > 0, at: writes.length ? new Date(Math.min(...writes.map((x) => x.t))).toISOString() : null,
    by: writes.length ? (writes.some((x) => x.h.sourceType === "INTEGRATION") ? "code" : "branch") : null, final,
  };
  row.verdict = sameValue(row.hub?.final ?? row.before, final) ? "agree" : row.workflow.wrote ? "differ" : "missed";
  row.settledAt = new Date().toISOString();
}

/** Both looks at once - for a local dry run. */
export async function checkTrigger(id: string, trigger: Row["trigger"], at: string, stage?: string, better?: Better): Promise<Row> {
  const r = await firstLook(id, trigger, at, stage, better);
  await settle(r);
  return r;
}

/** "Check a ticket": what the workflow's rules give it now, and what the workflow wrote last. Nothing stored. */
export async function checkTicket(id: string) {
  const t = await hubspotRetry<Raw>({ path: `/crm/v3/objects/tickets/${id}?properties=${TICKET_PROPS.join(",")}&propertiesWithHistory=${VALUE_PROPS.join(",")}` });
  const p = t.properties ?? {};
  const hist = t.propertiesWithHistory ?? {};
  const links: string[] = [];
  const api = shadowApi(links);
  const human = lastEditorIsHuman(hist.sales_potential_estimate), today = new Date().toISOString().slice(0, 10);
  const d = await decide(api, id, p, human, today);
  const b = await decideHub(api, id, p, human, today, await betterContext());
  const now = Object.fromEntries(VALUE_PROPS.map((k) => [k, p[k] ?? null])) as Values;
  const lastWf = VALUE_PROPS.flatMap((k) => (hist[k] ?? []).filter(isWorkflow).slice(0, 1).map((h) => h.timestamp ?? "")).sort().pop() ?? null;
  return {
    ticketId: id, subject: p.subject ?? "", pipeline: PIPELINES[p.hs_pipeline ?? ""] ?? "other", now,
    branch: d.branch, branchLabel: BRANCH_LABEL[d.branch], action: d.action, final: finalOf(now, d.patch), changes: d.patch !== null,
    why: d.scored?.why ?? null, company: d.scored?.company ?? null, link: links[0]?.split("/").pop() ?? null, kpi: d.kpi ?? null,
    lastWorkflowWrite: lastWf,
    better: { rule: b.rule, ruleLabel: HUB_RULES.find((x) => x.rule === b.rule)?.label ?? b.rule, action: b.action, final: finalOf(now, b.patch), changes: b.patch !== null, company: b.scored?.company ?? null },
    history: VALUE_PROPS.map((k) => ({ prop: k, entries: (hist[k] ?? []).slice(0, 6).map((h) => ({ value: h.value ?? null, at: h.timestamp ?? null, by: isWorkflow(h) ? "workflow" : h.sourceType === "INTEGRATION" ? `app ${h.sourceId}` : (h.sourceType ?? "?").toLowerCase() })) })),
  };
}

type Ev = { id: string; trigger: Row["trigger"]; at: string; stage?: string };
export async function findTriggers(from: number, to: number): Promise<Ev[]> {
  const between = (prop: string) => [{ propertyName: prop, operator: "GTE", value: String(from) }, { propertyName: prop, operator: "LTE", value: String(to) }];
  const stageProps = Object.keys(REENROL_STAGES).map((s) => `hs_v2_date_entered_${s}`);
  const filterGroups = [between("createdate"), ...stageProps.map(between)].map((filters) => ({ filters }));
  const evs: Ev[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const r = await hubspotRetry<{ results?: Raw[]; paging?: { next?: { after?: string } } }>({
      path: "/crm/v3/objects/tickets/search", method: "POST",
      body: { filterGroups, properties: ["createdate", ...stageProps], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 100, ...(after ? { after } : {}) },
    });
    for (const x of r.results ?? []) {
      const inWin = (v: string | null | undefined) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) && t >= from && t <= to ? new Date(t).toISOString() : null; };
      const c = inWin(x.properties.createdate);
      if (c) evs.push({ id: String(x.id), trigger: "created", at: c });
      for (const s of Object.keys(REENROL_STAGES)) {
        const e = inWin(x.properties[`hs_v2_date_entered_${s}`]);
        if (e) evs.push({ id: String(x.id), trigger: "stage", at: e, stage: REENROL_STAGES[s] });
      }
    }
    after = r.paging?.next?.after;
    if (!after) break;
  }
  return evs.sort((a, b) => a.at.localeCompare(b.at));
}

async function run(signal?: AbortSignal): Promise<RunInfo> {
  const started = Date.now();
  const info: RunInfo = { at: new Date().toISOString(), seconds: 0, found: 0, checked: 0, settled: 0, rechecked: 0 };
  const cursor = (await kvGet<number>(KV.cursor)) ?? Date.now() - FIRST_DAYS * 86400_000;
  const to = Date.now() - WAIT_MS;
  const touched = new Map<string, Row[]>();
  const dirty = new Set<string>();
  const rowsFor = async (d: string) => touched.get(d) ?? (touched.set(d, await rowsOfDay(d)), touched.get(d)!);
  const flush = async () => { for (const d of dirty) await kvSet(KV.day(d), touched.get(d) ?? []); dirty.clear(); };
  const more = () => !signal?.aborted && Date.now() - started < WORK_MS;
  let next = cursor;
  const better = await betterContext();
  if (to > cursor) {
    const evs = await findTriggers(cursor, to);
    info.found = evs.length;
    let done = 0;
    for (const e of evs.slice(0, MAX_PER_RUN)) {
      if (!more()) break;
      const rows = await rowsFor(day(e.at));
      const key = `${e.id}:${e.trigger}:${e.at}`;
      next = Math.max(next, Date.parse(e.at));
      done++;
      if (rows.some((x) => x.key === key)) continue;
      try { rows.push(await firstLook(e.id, e.trigger, e.at, e.stage, better)); info.checked++; }
      catch (err) {
        rows.push({ key, ticketId: e.id, subject: "", pipeline: "", trigger: e.trigger, stage: e.stage, at: e.at, enrols: false, before: empty(), hub: null,
          workflow: { wrote: false, at: null, by: null, final: empty() }, verdict: "error", checkedAt: new Date().toISOString(), error: (err as Error).message.slice(0, 200) });
      }
      dirty.add(day(e.at));
    }
    // all of the window done: the cursor moves to its end; else to the last trigger done (the rest next run)
    if (done === evs.length) next = to;
    else info.behind = new Date(next).toISOString();
  }
  await flush();
  await kvSet(KV.cursor, next);
  // 20 minutes on: what the workflow wrote; a ticket it left alone, once more after 2 hours
  for (const d of [day(new Date(Date.now() - 86400_000).toISOString()), day(new Date().toISOString())]) {
    for (const x of await rowsFor(d)) {
      if (!more()) break;
      const age = Date.now() - Date.parse(x.at);
      const again = x.verdict === "missed";
      const due = (x.verdict === "pending" && age >= BEHIND_MS) || (again && !x.recheckedAt && age >= RECHECK_MS);
      if (!due) continue;
      try { await settle(x); if (again) { x.recheckedAt = x.settledAt; info.rechecked++; } else info.settled++; }
      catch (err) { if (again) x.recheckedAt = new Date().toISOString(); else x.error = `settle: ${(err as Error).message.slice(0, 160)}`; }
      dirty.add(d);
    }
  }
  await flush();
  // the average first order, a little each run while time is left
  if (more()) await firstOrderStep(more).catch((e) => { info.error = `first order: ${(e as Error).message.slice(0, 120)}`; });
  await kvSet(KV.day(new Date(Date.now() - DAYS_KEPT * 86400_000).toISOString().slice(0, 10)), null);
  info.seconds = Math.round((Date.now() - started) / 1000);
  await kvSet(KV.last, info);
  return info;
}
const empty = (): Values => ({ sales_potential_estimate: null, sales_potential_source: null, sales_potential_confidence: null });

export async function runOnce(signal?: AbortSignal): Promise<RunInfo | null> {
  const settings = await getSettings();
  if (settings.mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("ticket value: time limit")); };
  if (signal?.aborted) drop(); else signal?.addEventListener("abort", drop, { once: true });
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run(signal).catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, found: 0, checked: 0, settled: 0, rechecked: 0, error: (e as Error).message.slice(0, 300) };
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
export function startTicketValue() {
  if (started || process.env.TICKET_VALUE === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const limit = new AbortController();
    const timer = setTimeout(() => {
      console.error(`[ticket-value] run still going after ${LIMIT_MS / 60_000} min - stopped and its lock dropped`);
      limit.abort();
      running = false;
    }, LIMIT_MS);
    timer.unref?.();
    void runOnce(limit.signal)
      .catch((e) => console.warn(`[ticket-value] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); if (!limit.signal.aborted) running = false; });
  };
  setTimeout(tick, 130_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

export const valueOf = (v: Values) => (v.sales_potential_estimate === null ? null : toNum(v.sales_potential_estimate));

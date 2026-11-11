// GROUP 4 - THE ORDERS, moved from the Compass connector into the hub:
//   orders_daily  yesterday's NEW orders from the delta fct_orderlinehist: create them with
//                 amounts, lines, positions and profit centre; link each to its company
//                 (509) by order number, never by position; the .000 duplicate guard;
//                 enrich web orders that exist without lines
//   stage_load    hs_pipeline_stage from dim_order.csv (Inactive=J / DeletedOrder=Y ->
//                 Cancelled), only where it differs
//   order_sync    "A# | Person | Company", the shipment date and order_order_status from
//                 dim_order.csv, only where they differ
// Each runs as a PREVIEW (reads HubSpot and the files, reports what it would write,
// writes nothing to HubSpot) or LIVE. Rules in ./orderRules.ts, files in ./orderFiles.ts,
// both tested; this file is the I/O, ported from service/orders_daily.py, stage_load.py
// and order_sync.py.
//
// State: the order snapshot (~800,000 orders: number, pipeline, stage, title, shipment
// date, status - the connector's two pickles in one) and the customer -> company map
// live in Postgres tables created here on first use; the per-file ledger and the
// snapshot's watermarks in kv (connectors:hub:*). Companies are never created.
//
// Deliberate differences from the connector (each reported with the port):
//   - a failed full snapshot pull is never saved as the snapshot: the step fails, nothing
//     is pruned, the watermarks stay where they were (stage_load saved the partial pull)
//   - the .000 guard's delivery search pages past 50 (it read one page of 50), and the
//     deliveries created a moment ago count even when the search index has not caught up
//   - the customer map refreshes itself: a customer it does not know is looked up live by
//     company_unique_number (lowest id wins, as the crawl did); an entry is re-checked
//     after 30 days. Never creates.
//   - a create that times out or fails with 5xx is never re-sent blind: the orders that
//     made it are found by number first (a blind retry would duplicate them); a batch
//     refused with 4xx is retried one order at a time, so one bad order does not take 49
//     others with it
//   - a batch update that fails is retried one order at a time in order_sync too (only
//     stage_load did), and deleted orders leave the snapshot
//   - "completed" is kept exactly as the connector has it, for a human decision:
//     stage_load maps it to Invoiced, order_sync leaves order_order_status blank.

import { kvGet as dbKvGet, kvSet as dbKvSet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import { requestCollector, saveErpRequests } from "@/lib/certificates/erpData";
import { deliveryCollector } from "@/lib/reporting/boDelivery";
import { saveDelivery, zurichToday } from "@/lib/reporting/boDeliveryStore";
import { FILL_ONLY, ORDER_FACTS_LIVE, compareWithHubSpot, dimFactsOf, factsFor, factsHash, packDim, unpackDim, type Facts } from "./orderFactsRules";
import { loadErpFacts, loadWritten, saveWritten } from "./orderFactsStore";
import { stat } from "node:fs/promises";
import { addPending, knownArticles } from "../articleIds";
import fixmapJson from "../data/article_fixmap.json";
import type { StepResult } from "./companyFacts";
import {
  articleLookup, collapseFctFile, detailTargetsFromFile, fileSha, stageTargetsFromFile,
} from "./orderFiles";
import {
  PIPELINE, WEB_CARRY, baseOf000, candidates, dedupDecision, deliveryBases, detailUpdate, enrichPayload, fnum, hsDate,
  isDeliveryOf, orderPayload, pyRepr, pyStrip, stageUpdate, unpackDetail, unresolvedIds, webCarry, companyForKey,
  type ArtInfo, type CompanyHit, type FctOrder, type FixMap,
} from "./orderRules";

const FIXMAP = fixmapJson as unknown as FixMap;

type Props = Record<string, string | null | undefined>;
type Obj = { id: string; properties?: Props };
type Page<T = Obj> = { results?: T[]; total?: number; paging?: { next?: { after?: string } } };
type Beat = () => Promise<void>;
type Upd = { id: string; properties: Record<string, string> };

/* ── state: Postgres tables + kv, behind a store the tests can replace ── */

export type SnapRow = { id: string; num: string; pipeline: string; stage: string; title: string; ship: string | null; status: string };
export type OrderStore = {
  kvGet<T>(key: string): Promise<T | undefined>;
  kvSet(key: string, value: unknown): Promise<void>;
  snapExists(): Promise<boolean>;
  snapCount(): Promise<number>;
  snapUpsert(rows: SnapRow[], gen: number): Promise<void>;
  /** drops every row a full pull of generation `gen` did not see */
  snapPrune(gen: number): Promise<number>;
  /** rows in the order pipeline (or none), by id, after `afterId`; `ids` narrows to those */
  snapPage(afterId: string, limit: number, ids?: string[] | null): Promise<SnapRow[]>;
  snapFold(rows: Pick<SnapRow, "id" | "stage" | "title" | "ship" | "status">[]): Promise<void>;
  snapDelete(ids: string[]): Promise<void>;
  /** customer key -> company id, for the entries checked since `since` (epoch ms) */
  mapGet(uns: string[], since: number): Promise<Map<string, string>>;
  mapPut(rows: [un: string, companyId: string][]): Promise<void>;
};

const SNAP_TABLE = "apsomh_cx_order_snapshot";
const MAP_TABLE = "apsomh_cx_customer_map";
let tablesReady: Promise<void> | null = null;
/** The two tables, created on first use - never inside ensureSchema. */
function ensureTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS ${SNAP_TABLE} (
        id bigint PRIMARY KEY,
        num text NOT NULL DEFAULT '',
        pipeline text NOT NULL DEFAULT '',
        stage text NOT NULL DEFAULT '',
        title text NOT NULL DEFAULT '',
        ship text,
        status text NOT NULL DEFAULT '',
        gen bigint NOT NULL DEFAULT 0,
        seen_at timestamptz NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS ${MAP_TABLE} (
        un text PRIMARY KEY,
        company_id text NOT NULL,
        checked_at timestamptz NOT NULL DEFAULT now()
      )`);
    })().catch((e) => {
      tablesReady = null;
      throw e;
    });
  }
  return tablesReady;
}

/** Last row per key wins: one INSERT ... ON CONFLICT may not touch a row twice. */
function lastBy<T>(rows: T[], key: (r: T) => string): T[] {
  const m = new Map<string, T>();
  for (const r of rows) m.set(key(r), r);
  return [...m.values()];
}

const CHUNK = 2000;
export const pgStore: OrderStore = {
  kvGet: (k) => dbKvGet(k),
  kvSet: (k, v) => dbKvSet(k, v),
  async snapExists() {
    await ensureTables();
    return (await query(`SELECT 1 FROM ${SNAP_TABLE} LIMIT 1`)).rows.length > 0;
  },
  async snapCount() {
    await ensureTables();
    const r = await query<{ n: string }>(`SELECT count(*)::text AS n FROM ${SNAP_TABLE} WHERE pipeline = '' OR pipeline = $1`, [PIPELINE]);
    return Number(r.rows[0]?.n ?? 0);
  },
  async snapUpsert(rows, gen) {
    await ensureTables();
    const all = lastBy(rows, (r) => r.id);
    for (let i = 0; i < all.length; i += CHUNK) {
      const c = all.slice(i, i + CHUNK);
      await query(
        `INSERT INTO ${SNAP_TABLE} (id, num, pipeline, stage, title, ship, status, gen, seen_at)
         SELECT v.id, v.num, v.pipeline, v.stage, v.title, v.ship, v.status, $8::bigint, now()
         FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
           AS v(id, num, pipeline, stage, title, ship, status)
         ON CONFLICT (id) DO UPDATE SET num = EXCLUDED.num, pipeline = EXCLUDED.pipeline, stage = EXCLUDED.stage,
           title = EXCLUDED.title, ship = EXCLUDED.ship, status = EXCLUDED.status, gen = EXCLUDED.gen, seen_at = now()`,
        [c.map((r) => r.id), c.map((r) => r.num), c.map((r) => r.pipeline), c.map((r) => r.stage), c.map((r) => r.title),
          c.map((r) => r.ship), c.map((r) => r.status), gen],
      );
    }
  },
  async snapPrune(gen) {
    await ensureTables();
    const r = await query<{ n: string }>(`WITH d AS (DELETE FROM ${SNAP_TABLE} WHERE gen <> $1 RETURNING 1) SELECT count(*)::text AS n FROM d`, [gen]);
    return Number(r.rows[0]?.n ?? 0);
  },
  async snapPage(afterId, limit, ids) {
    await ensureTables();
    const r = await query<SnapRow>(
      `SELECT id::text AS id, num, pipeline, stage, title, ship, status FROM ${SNAP_TABLE}
       WHERE (pipeline = '' OR pipeline = $1) AND id > $2::bigint ${ids ? "AND id = ANY($4::bigint[])" : ""}
       ORDER BY id LIMIT $3`,
      ids ? [PIPELINE, afterId, limit, ids] : [PIPELINE, afterId, limit],
    );
    return r.rows;
  },
  async snapFold(rows) {
    await ensureTables();
    const all = lastBy(rows, (r) => r.id);
    for (let i = 0; i < all.length; i += CHUNK) {
      const c = all.slice(i, i + CHUNK);
      await query(
        `UPDATE ${SNAP_TABLE} t SET stage = v.stage, title = v.title, ship = v.ship, status = v.status
         FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[]) AS v(id, stage, title, ship, status)
         WHERE t.id = v.id`,
        [c.map((r) => r.id), c.map((r) => r.stage), c.map((r) => r.title), c.map((r) => r.ship), c.map((r) => r.status)],
      );
    }
  },
  async snapDelete(ids) {
    if (!ids.length) return;
    await ensureTables();
    await query(`DELETE FROM ${SNAP_TABLE} WHERE id = ANY($1::bigint[])`, [ids]);
  },
  async mapGet(uns, since) {
    await ensureTables();
    const out = new Map<string, string>();
    for (let i = 0; i < uns.length; i += CHUNK) {
      const r = await query<{ un: string; company_id: string }>(
        `SELECT un, company_id FROM ${MAP_TABLE} WHERE un = ANY($1::text[]) AND checked_at >= $2::timestamptz`,
        [uns.slice(i, i + CHUNK), new Date(since).toISOString()],
      );
      for (const x of r.rows) out.set(x.un, x.company_id);
    }
    return out;
  },
  async mapPut(rows) {
    if (!rows.length) return;
    await ensureTables();
    const all = lastBy(rows, (r) => r[0]);
    for (let i = 0; i < all.length; i += CHUNK) {
      const c = all.slice(i, i + CHUNK);
      await query(
        `INSERT INTO ${MAP_TABLE} (un, company_id, checked_at) SELECT v.un, v.cid, now()
         FROM unnest($1::text[], $2::text[]) AS v(un, cid)
         ON CONFLICT (un) DO UPDATE SET company_id = EXCLUDED.company_id, checked_at = now()`,
        [c.map((r) => r[0]), c.map((r) => r[1])],
      );
    }
  },
};

/** The hub's memory of the ERP's internal article ids (connectors/articleIds.ts). */
type ArticleMemory = { known(ids: string[]): Promise<Map<string, ArtInfo>>; pending(rows: [orderId: string, id: string][]): Promise<number> };
type Deps = { store: OrderStore; sleep: (ms: number) => Promise<void>; now: () => number; memory: ArticleMemory };
const DEFAULT_DEPS: Deps = {
  store: pgStore, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now(),
  memory: { known: knownArticles, pending: addPending },
};
let deps: Deps = DEFAULT_DEPS;
/** Tests and the parity harness only: an in-memory store, no waiting. null restores the defaults. */
export function setOrderDeps(d: Partial<Deps> | null): void {
  deps = d ? { ...DEFAULT_DEPS, ...d } : DEFAULT_DEPS;
}

/* ── HubSpot calls ─────────────────────────────────────────────────────── */

type Req = Parameters<typeof hubspotFetchJson>[0];
const statusOf = (e: unknown): number | null => (e instanceof IntegrationError ? e.status : null);
/** A failure worth trying again: 429, 5xx, or the network (no HubSpot answer at all). */
const transient = (e: unknown): boolean => {
  const st = statusOf(e);
  return e instanceof IntegrationError ? st === 429 || (st !== null && st >= 500) : true;
};

/** For reads and idempotent writes: retried on 429/5xx/network, 90 s per attempt (as the connector). */
async function hs<T>(req: Req, tries = 5): Promise<T> {
  for (let a = 1; ; a += 1) {
    try {
      return await hubspotFetchJson<T>({ ...req, signal: AbortSignal.timeout(90_000) });
    } catch (e) {
      if (!transient(e) || a >= tries) throw e;
      await deps.sleep(2000 * a);
    }
  }
}

const search = (obj: string, body: object) => hs<Page>({ path: `/crm/v3/objects/${obj}/search`, method: "POST", body });

/** Every search result, page after page (the connector read the first page only). */
async function searchAll(obj: string, body: Record<string, unknown>): Promise<Obj[]> {
  const out: Obj[] = [];
  let after: string | undefined;
  for (;;) {
    const j = await search(obj, { ...body, ...(after ? { after } : {}) });
    out.push(...(j.results ?? []));
    after = j.paging?.next?.after;
    if (!after) return out;
  }
}

/** Orders by number (IN, 50 at a time as the connector asks). */
function ordersByNumber(nums: string[], properties: string[]): Promise<Obj[]> {
  return searchAll("orders", {
    filterGroups: [{ filters: [{ propertyName: "order_order_number", operator: "IN", values: nums }] }],
    properties, limit: 100,
  });
}

/** Heartbeat at most every 20 s, from inside long loops. */
function pacer(beat: Beat): () => Promise<void> {
  let last = deps.now();
  return async () => {
    if (deps.now() - last >= 20_000) { last = deps.now(); await beat(); }
  };
}

const errText = (e: unknown) => (e as Error).message.slice(0, 160);

/**
 * Batch update, 100 at a time. What fails as a batch is tried one order at a time (one
 * archived order fails all 100): updated -> done, 404 -> gone (deleted), else failed.
 */
async function updateOrders(rows: Upd[], tick: () => Promise<void>): Promise<{ done: Upd[]; gone: string[]; failed: number; errors: string[] }> {
  const done: Upd[] = [];
  const gone: string[] = [];
  const errors: string[] = [];
  let failed = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    let rest = chunk;
    try {
      const j = await hs<{ results?: { id: string | number }[]; errors?: unknown[] }>({ path: "/crm/v3/objects/orders/batch/update", method: "POST", body: { inputs: chunk } });
      const ok = new Set((j.results ?? []).map((r) => String(r.id)));
      // a 200 lists every input; a 207 only the ones that went through
      if (!j.results && !j.errors?.length) for (const u of chunk) ok.add(u.id);
      done.push(...chunk.filter((u) => ok.has(u.id)));
      rest = chunk.filter((u) => !ok.has(u.id));
    } catch (e) {
      if (errors.length < 3) errors.push(errText(e));
    }
    for (const u of rest) {
      try {
        await hs({ path: `/crm/v3/objects/orders/${u.id}`, method: "PATCH", body: { properties: u.properties } });
        done.push(u);
      } catch (e) {
        if (statusOf(e) === 404) gone.push(u.id);
        else { failed += 1; if (errors.length < 3) errors.push(errText(e)); }
      }
      await deps.sleep(50);
    }
    await deps.sleep(100);
    await tick();
  }
  return { done, gone, failed, errors };
}

/* ── the order snapshot ────────────────────────────────────────────────── */

const SNAP_PROPS = ["order_order_number", "hs_order_name", "order_shipment_date", "hs_pipeline", "hs_pipeline_stage", "order_order_status"];
const KV_SNAP = "connectors:hub:order_snapshot";
const FULL_PULL_MS = 30 * 86_400_000;
const OVERLAP_MS = 2 * 3_600_000;
const SEARCH_CAP = 9900;
type SnapMeta = { pulled?: number; synced?: number; gen?: number; rows?: number };

export function snapRowOf(o: Obj): SnapRow {
  const p = o.properties ?? {};
  return {
    id: String(o.id), num: pyStrip(p.order_order_number ?? ""), pipeline: p.hs_pipeline ?? "", stage: p.hs_pipeline_stage ?? "",
    title: p.hs_order_name ?? "", ship: hsDate(p.order_shipment_date ?? null), status: pyStrip(p.order_order_status ?? ""),
  };
}

/** Orders created or changed since `sinceMs`; null when more than search can page. */
async function pullChanged(sinceMs: number): Promise<SnapRow[] | null> {
  const out: SnapRow[] = [];
  let after: string | undefined;
  for (;;) {
    const j = await search("orders", {
      filterGroups: [{ filters: [{ propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(sinceMs) }] }],
      properties: SNAP_PROPS, limit: 100, sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
      ...(after ? { after } : {}),
    });
    if ((j.total ?? 0) > SEARCH_CAP) return null;
    out.push(...(j.results ?? []).map(snapRowOf));
    after = j.paging?.next?.after;
    if (!after) return out;
  }
}

/** Every order, written as it comes in under generation `gen`. Throws on any failed page. */
async function pullAll(gen: number, tick: () => Promise<void>): Promise<number> {
  let after: string | undefined;
  let buf: SnapRow[] = [];
  let n = 0;
  for (;;) {
    const qs = `limit=100&archived=false&properties=${SNAP_PROPS.join(",")}${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const j = await hs<Page>({ path: `/crm/v3/objects/orders?${qs}` });
    for (const o of j.results ?? []) buf.push(snapRowOf(o));
    if (buf.length >= CHUNK) { await deps.store.snapUpsert(buf, gen); n += buf.length; buf = []; await tick(); }
    after = j.paging?.next?.after;
    if (!after) break;
  }
  await deps.store.snapUpsert(buf, gen);
  return n + buf.length;
}

/**
 * The snapshot brought up to date: the orders changed since the last refresh (2 h
 * overlap), or everything when there is no snapshot, it is a month old, or the change is
 * more than search can page. A full pull that fails is not the snapshot: it throws,
 * nothing is pruned, the watermarks stay. -> the ids that changed (null after a full pull).
 */
async function refreshSnapshot(tick: () => Promise<void>): Promise<{ how: string; changed: string[] | null }> {
  const { store } = deps;
  const meta = (await store.kvGet<SnapMeta>(KV_SNAP)) ?? {};
  const started = deps.now();
  if (meta.pulled && meta.synced && started - meta.pulled < FULL_PULL_MS && (await store.snapExists())) {
    const changed = await pullChanged(meta.synced - OVERLAP_MS);
    if (changed) {
      await store.snapUpsert(changed, meta.gen ?? 0);
      await store.kvSet(KV_SNAP, { ...meta, synced: started });
      return { how: `cached + ${changed.length} new/changed`, changed: changed.map((r) => r.id) };
    }
  }
  const gen = started; // unique per attempt: rows a failed attempt stamped are pruned by the next good one
  const n = await pullAll(gen, tick);
  const pruned = await store.snapPrune(gen);
  await store.kvSet(KV_SNAP, { pulled: started, synced: started, gen, rows: n } satisfies SnapMeta);
  return { how: `full pull (${n} orders, ${pruned} gone)`, changed: null };
}

/** Every snapshot row in the order pipeline, page by page. */
async function* snapshotRows(ids: string[] | null): AsyncGenerator<SnapRow[]> {
  if (ids && !ids.length) return;
  let after = "0";
  for (;;) {
    const page = await deps.store.snapPage(after, 5000, ids);
    if (!page.length) return;
    yield page;
    after = page[page.length - 1].id;
  }
}

/* ── stage_load ────────────────────────────────────────────────────────── */

export async function stageLoad(live: boolean, beat: Beat, opts: { file: string; onlyChanged?: boolean }): Promise<StepResult> {
  const t0 = deps.now();
  const tick = pacer(beat);
  let refreshed: { how: string; changed: string[] | null } | null = null;
  let only: Set<string> | null = null;
  if (opts.onlyChanged) {
    // the second pass, after orders_daily: just the orders that are new or changed since the first
    refreshed = await refreshSnapshot(tick);
    if (refreshed.changed) {
      only = new Set<string>();
      for await (const page of snapshotRows(refreshed.changed)) for (const r of page) only.add(r.num);
    }
  }
  const { targets, cancelled } = await stageTargetsFromFile(opts.file, only, tick);
  if (!targets.size && !only) throw new Error("no target rows parsed (wrong file?)");
  if (!refreshed) refreshed = await refreshSnapshot(tick);
  const ids = opts.onlyChanged ? refreshed.changed : null;

  const matrix = new Map<string, number>();
  const examples: unknown[] = [];
  let toUpdate = 0, done = 0, err = 0, gone = 0, seen = 0;
  const errors: string[] = [];
  let pending: Upd[] = [];
  const cur = new Map<string, SnapRow>();
  const flush = async () => {
    if (!pending.length) return;
    if (live) {
      const r = await updateOrders(pending, tick);
      done += r.done.length; err += r.failed; gone += r.gone.length;
      errors.push(...r.errors.slice(0, 3 - errors.length));
      await deps.store.snapFold(r.done.map((u) => ({ ...cur.get(u.id)!, stage: u.properties.hs_pipeline_stage })));
      await deps.store.snapDelete(r.gone);
    }
    pending = [];
    cur.clear();
  };
  for await (const page of snapshotRows(ids)) {
    for (const row of page) {
      seen += 1;
      const tgt = stageUpdate(row.stage, targets.get(row.num));
      if (!tgt) continue;
      toUpdate += 1;
      const k = `${row.stage}->${tgt}`;
      matrix.set(k, (matrix.get(k) ?? 0) + 1);
      if (examples.length < 10) examples.push({ order: row.num, was: row.stage, now: tgt });
      pending.push({ id: row.id, properties: { hs_pipeline_stage: tgt } });
      cur.set(row.id, row);
      if (pending.length >= 100) await flush();
    }
    await tick();
  }
  await flush();
  const top = [...matrix.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return {
    targets: targets.size, cancelled_flagged: cancelled, orders_in_snapshot: ids ? seen : await deps.store.snapCount(),
    snapshot: refreshed.how, ...(opts.onlyChanged ? { only_changed: ids ? ids.length : "all (full pull)" } : {}),
    to_update: toUpdate, stage_updates: done, errors: err, deleted_dropped: gone, ...(errors.length ? { error_samples: errors } : {}),
    top_transitions: Object.fromEntries(top), examples, seconds: Math.round((deps.now() - t0) / 1000),
  };
}

/* ── order_sync ────────────────────────────────────────────────────────── */

export async function orderSync(live: boolean, beat: Beat, opts: { file: string }): Promise<StepResult> {
  const t0 = deps.now();
  const tick = pacer(beat);
  // the certificate requests in the ERP's internal comments (Certificates > From the shop) - read in the same pass
  const certs = requestCollector(new Date().getUTCFullYear() - 1);
  // and each delivery's speed, for Back-Office Reports > OTD (lib/reporting/boDelivery.ts) - this year and last
  const today = zurichToday();
  const deliveries = deliveryCollector(today, Number(today.slice(0, 4)) - 1);
  // and the ERP fields HubSpot's orders hold but nobody filled (./orderFactsRules.ts, SARCLA 08.11.2026) - from this file
  // and from what the morning workbook's sheets gave; written only where they changed, and only once ORDER_FACTS_LIVE
  const dimFacts = new Map<string, string>();
  const { targets } = await detailTargetsFromFile(opts.file, null, tick, (get, on) => {
    try { deliveries.row(get, on); } catch { /* never the chain's problem */ }
    try { const f = dimFactsOf(get); if (f) dimFacts.set(on, packDim(f)); } catch { /* never the chain's problem */ }
    certs.row(on, get("OrderYear"), get("InternalComment"));
  });
  if (!targets.size) throw new Error("no order rows parsed (wrong file?)");
  // the hub's own record (no HubSpot write) - kept whatever the mode; it never fails the step
  const certificateRequests = await saveErpRequests(certs.found).catch(() => -1);
  const refreshed = await refreshSnapshot(tick);
  // after the snapshot's refresh: the slowest deliveries are named by their order's title
  const deliveriesKept = await saveDelivery(deliveries, today).catch((e) => { console.warn(`[connectors] order_sync: the delivery speed was not kept - ${String((e as Error)?.message ?? e)}`); return -1; });

  const counts = { titles: 0, shipment_dates: 0, statuses: 0 };
  // the order facts: what the sheets gave and what was written - a table that cannot be read leaves them out tonight
  const fx = await Promise.all([loadErpFacts(), loadWritten()]).catch((e) => { console.warn(`[connectors] order_sync: order facts left out - ${String((e as Error)?.message ?? e)}`); return null; });
  const facts: {
    live: boolean; orders_from_file: number; with_facts: number; to_write: number; written: number; by_property: Record<string, number>;
    examples: Record<string, string>[]; left_for_next_nights?: number; compare_sample?: unknown;
  } = { live: ORDER_FACTS_LIVE, orders_from_file: dimFacts.size, with_facts: 0, to_write: 0, written: 0, by_property: {}, examples: [] };
  // the first night after the history (2020 on) writes at most FACTS_PER_NIGHT orders, the rest the nights after (their hash
  // is kept only once written); a sample of the orders to write is read back from HubSpot, to show what would change
  // this year's orders always go (the ones empty since June among them), the older years at most FACTS_PER_NIGHT a night
  const FACTS_PER_NIGHT = 60_000, COMPARE = 400;
  const thisYear = String(new Date().getUTCFullYear()).slice(2);
  let factsMerged = 0, factsHeld = 0;
  const compare: { id: string; order: string; f: Facts }[] = [];
  const curHash = new Map<string, string>();
  const samples: string[] = [];
  let persons = 0, queued = 0, done = 0, err = 0, gone = 0;
  const errors: string[] = [];
  let pending: Upd[] = [];
  const cur = new Map<string, SnapRow>();
  const flush = async () => {
    if (!pending.length) return;
    if (live) {
      // the facts HubSpot keeps when it has a value (orderFactsRules FILL_ONLY): read first; unread = left out tonight
      const fill = pending.filter((u) => FILL_ONLY.some((k) => k in u.properties));
      if (fill.length) {
        const has = await hs<{ results?: { id: string | number; properties?: Record<string, string | null> }[] }>({
          path: "/crm/v3/objects/orders/batch/read", method: "POST", body: { inputs: fill.map((u) => ({ id: u.id })), properties: [...FILL_ONLY] },
        }).then((j) => new Map((j.results ?? []).map((o) => [String(o.id), o.properties ?? {}]))).catch(() => null);
        for (const u of fill) for (const k of FILL_ONLY) if (!has || (has.get(u.id)?.[k] ?? "").trim()) delete u.properties[k];
      }
      const r = await updateOrders(pending, tick);
      done += r.done.length; err += r.failed; gone += r.gone.length;
      errors.push(...r.errors.slice(0, 3 - errors.length));
      await deps.store.snapFold(r.done.map((u) => {
        const was = cur.get(u.id)!;
        const p = u.properties;
        return { id: u.id, stage: was.stage, title: p.hs_order_name ?? was.title, ship: p.order_shipment_date ?? was.ship, status: p.order_order_status ?? was.status };
      }));
      await deps.store.snapDelete(r.gone);
      const kept = r.done.map((u) => [u.id, curHash.get(u.id)] as const).filter((x): x is readonly [string, string] => !!x[1]);
      if (kept.length) {
        facts.written += kept.length;
        await saveWritten(kept.map(([i, h]) => [i, h])).catch((e) => console.warn(`[connectors] order_sync: order facts written but not remembered - ${String((e as Error)?.message ?? e)}`));
      }
    }
    pending = [];
    cur.clear();
    curHash.clear();
  };
  for await (const page of snapshotRows(null)) {
    for (const row of page) {
      const t = unpackDetail(targets.get(row.num));
      if (!t) continue;
      if (t.person) persons += 1;
      let props = detailUpdate(row, t);
      if (fx) {
        const f = factsFor(row.num, unpackDim(dimFacts.get(row.num)), fx[0].byBase, fx[0].byOrder);
        const keys = Object.keys(f);
        if (keys.length) {
          facts.with_facts += 1;
          const h = factsHash(f);
          if (fx[1].get(row.id) !== h) {
            facts.to_write += 1;
            for (const k of keys) facts.by_property[k] = (facts.by_property[k] ?? 0) + 1;
            if (facts.examples.length < 5) { const { order_your_reference: _r, order_customer_order_nr: _c, ...shown } = f; facts.examples.push({ order: row.num, ...shown }); }
            if (compare.length < COMPARE) compare.push({ id: row.id, order: row.num, f });
            else { const j = Math.floor(Math.random() * facts.to_write); if (j < COMPARE) compare[j] = { id: row.id, order: row.num, f }; }
            const current = /^[A-Z](\d{2})\./.exec(row.num)?.[1] === thisYear;
            if (ORDER_FACTS_LIVE && (current || factsMerged < FACTS_PER_NIGHT)) { props = { ...(props ?? {}), ...f }; curHash.set(row.id, h); if (!current) factsMerged += 1; }
            else if (ORDER_FACTS_LIVE) factsHeld += 1;
          }
        }
      }
      if (!props) continue;
      queued += 1;
      if (props.hs_order_name) counts.titles += 1;
      if (props.order_shipment_date) counts.shipment_dates += 1;
      if (props.order_order_status) counts.statuses += 1;
      if (samples.length < 8 && props.hs_order_name) samples.push(`${row.title}  ->  ${props.hs_order_name}`);
      pending.push({ id: row.id, properties: props });
      cur.set(row.id, row);
      if (pending.length >= 100) await flush();
    }
    await tick();
  }
  await flush();
  if (factsHeld) facts.left_for_next_nights = factsHeld;
  if (compare.length) {
    try {
      const keys = [...new Set(compare.flatMap((c) => Object.keys(c.f)))];
      const items: { order: string; facts: Facts; current: Record<string, string | null | undefined> }[] = [];
      for (let i = 0; i < compare.length; i += 100) {
        const part = compare.slice(i, i + 100);
        const j = await hs<{ results?: { id: string | number; properties?: Record<string, string | null> }[] }>({
          path: "/crm/v3/objects/orders/batch/read", method: "POST", body: { inputs: part.map((c) => ({ id: c.id })), properties: keys },
        });
        const now = new Map((j.results ?? []).map((o) => [String(o.id), o.properties ?? {}]));
        for (const c of part) { const cur = now.get(c.id); if (cur) items.push({ order: c.order, facts: c.f, current: cur }); }
        await tick();
      }
      facts.compare_sample = { orders: items.length, ...compareWithHubSpot(items) };
    } catch (e) { facts.compare_sample = `not read: ${String((e as Error)?.message ?? e).slice(0, 160)}`; }
  }
  return {
    orders_in_snapshot: await deps.store.snapCount(), snapshot: refreshed.how, erp_orders: targets.size, with_person: persons,
    to_update: queued, ...counts, updated: done, errors: err, deleted_dropped: gone, ...(errors.length ? { error_samples: errors } : {}),
    examples: samples, certificate_requests: certificateRequests, deliveries_kept: deliveriesKept, order_facts: facts, seconds: Math.round((deps.now() - t0) / 1000),
  };
}

/* ── the customer -> company map ───────────────────────────────────────── */

const MAP_TTL_MS = 30 * 86_400_000;

/**
 * company_unique_number -> company id for the customers asked. Known entries come from
 * the table; the rest are looked up live (IN, 50 at a time) and remembered. A customer
 * with several companies gets the lowest id, as the connector's crawl kept the first.
 * Nothing is created: a customer not found stays unlinked and is reported.
 */
async function customerMap(uns: string[]): Promise<{ map: Map<string, string>; looked_up: number; not_found: string[]; by_number: number }> {
  const { store } = deps;
  const map = await store.mapGet(uns, deps.now() - MAP_TTL_MS);
  const todo = uns.filter((u) => !map.has(u));
  const found: [string, string][] = [];
  let byNumber = 0;
  for (let i = 0; i < todo.length; i += 50) {
    const part = todo.slice(i, i + 50);
    const res = await searchAll("companies", {
      filterGroups: [{ filters: [{ propertyName: "company_unique_number", operator: "IN", values: part }] }],
      properties: ["company_unique_number"], limit: 100,
    });
    const hits: CompanyHit[] = res.map((c) => ({ id: String(c.id), un: pyStrip(c.properties?.company_unique_number ?? "") }));
    // the key not on the company yet (it is written later - a new customer's first order comes before it): the ERP
    // customer number in that mandant, typed on the company (orderRules.ts companyForKey; SARCLA 10.11.2026)
    const left = part.filter((u) => !hits.some((h) => h.un === u));
    const nums = [...new Set(left.map((u) => u.split("-")[1] ?? "").filter((n) => /^\d+$/.test(n)))];
    for (let k = 0; k < nums.length; k += 50) {
      const more = await searchAll("companies", {
        filterGroups: [{ filters: [{ propertyName: "erp_customer_id", operator: "IN", values: nums.slice(k, k + 50) }] }],
        properties: ["erp_customer_id", "mandant", "company_unique_number"], limit: 100,
      });
      for (const c of more) hits.push({ id: String(c.id), un: pyStrip(c.properties?.company_unique_number ?? ""), erp: c.properties?.erp_customer_id ?? null, mandant: c.properties?.mandant ?? null });
    }
    for (const u of part) {
      const id = companyForKey(u, hits);
      if (!id) continue;
      if (left.includes(u)) byNumber++;
      map.set(u, id);
      found.push([u, id]);
    }
  }
  await store.mapPut(found);
  return { map, looked_up: todo.length, not_found: todo.filter((u) => !map.has(u)), by_number: byNumber };
}

/* ── orders without their company, linked again (SARCLA 10.11.2026) ───── */

const LINK_DAYS = 45;
/** An order is linked to its company once, right after it is made; a company whose key (or ERP number) comes later -
 *  a new customer's first order - stayed without its orders for good (262 of 413,503 on 10.11.2026). This looks at the
 *  orders of the last 45 days without a company: by the customer key (customerMap, with the ERP number fallback), and an
 *  order with no customer number (a web order) by its only contact's company, as the shop sync links it. */
export async function orderCompanyLink(live: boolean, beat: Beat): Promise<StepResult> {
  const t0 = deps.now();
  const since = String(t0 - LINK_DAYS * 86_400_000);
  const recent: Obj[] = [];
  let cursor = "0";
  for (;;) {
    // an id cursor: the search stops at 10,000 results
    const j = await search("orders", {
      filterGroups: [{ filters: [{ propertyName: "hs_createdate", operator: "GTE", value: since }, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: ["order_mandant", "order_customer_number", "hs_order_name"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 100,
    });
    const res = j.results ?? [];
    if (!res.length) break;
    recent.push(...res);
    cursor = String(res[res.length - 1].id);
    if (recent.length % 2000 < 100) await beat();
  }
  const linked = new Set<string>();
  for (let i = 0; i < recent.length; i += 100) {
    const j = await hs<{ results?: { from: { id: string }; to?: unknown[] }[] }>({ path: "/crm/v4/associations/orders/companies/batch/read", method: "POST", body: { inputs: recent.slice(i, i + 100).map((o) => ({ id: String(o.id) })) } });
    for (const r of j.results ?? []) if ((r.to ?? []).length) linked.add(String(r.from.id));
  }
  const orphans = recent.filter((o) => !linked.has(String(o.id)));
  const keyOf = (o: Obj) => {
    const m = pyStrip(o.properties?.order_mandant ?? ""), c = pyStrip(o.properties?.order_customer_number ?? "");
    return m && c ? `${m}-${c}` : "";
  };
  const withKey = orphans.filter((o) => keyOf(o));
  const cm = await customerMap([...new Set(withKey.map(keyOf))].sort(cmpStr));
  const plan: { order: string; name: string; company: string; how: "key" | "contact" }[] = [];
  for (const o of withKey) {
    const c = cm.map.get(keyOf(o));
    if (c) plan.push({ order: String(o.id), name: o.properties?.hs_order_name ?? "", company: c, how: "key" });
  }
  // a web order with no customer number: its only contact's company
  const noKey = orphans.filter((o) => !keyOf(o));
  for (let i = 0; i < noKey.length; i += 100) {
    const part = noKey.slice(i, i + 100);
    const a = await hs<{ results?: { from: { id: string }; to?: { toObjectId: string | number }[] }[] }>({ path: "/crm/v4/associations/orders/contacts/batch/read", method: "POST", body: { inputs: part.map((o) => ({ id: String(o.id) })) } });
    const only = new Map<string, string>();
    for (const r of a.results ?? []) if ((r.to ?? []).length === 1) only.set(String(r.from.id), String(r.to![0].toObjectId));
    const people = await hs<{ results?: Obj[] }>({ path: "/crm/v3/objects/contacts/batch/read", method: "POST", body: { inputs: [...new Set(only.values())].map((id) => ({ id })), properties: ["associatedcompanyid"] } });
    const companyOf = new Map((people.results ?? []).map((p) => [String(p.id), pyStrip(p.properties?.associatedcompanyid ?? "")]));
    for (const o of part) {
      const c = companyOf.get(only.get(String(o.id)) ?? "");
      if (c) plan.push({ order: String(o.id), name: o.properties?.hs_order_name ?? "", company: c, how: "contact" });
    }
  }
  const out: StepResult = {
    days: LINK_DAYS, orders: recent.length, without_company: orphans.length, to_link: plan.length,
    by_key: plan.filter((p) => p.how === "key").length, by_contact: plan.filter((p) => p.how === "contact").length,
    by_erp_number: cm.by_number, still_without: orphans.length - plan.length,
    examples: plan.slice(0, 10).map((p) => ({ order: p.name || p.order, company: p.company, how: p.how })),
    still_without_samples: orphans.filter((o) => !plan.some((p) => p.order === String(o.id))).slice(0, 10).map((o) => o.properties?.hs_order_name ?? String(o.id)),
  };
  if (live && plan.length) {
    let done = 0, failed = 0;
    for (let i = 0; i < plan.length; i += 100) {
      const chunk = plan.slice(i, i + 100);
      try {
        const j = await hs<{ errors?: unknown[] }>({ path: "/crm/v4/associations/orders/companies/batch/create", method: "POST", body: { inputs: chunk.map((p) => ({ from: { id: p.order }, to: { id: p.company }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 509 }] })) } });
        failed += j.errors?.length ?? 0;
        done += chunk.length - (j.errors?.length ?? 0);
      } catch { failed += chunk.length; }
    }
    Object.assign(out, { linked: done, failed });
  }
  return { ...out, seconds: Math.round((deps.now() - t0) / 1000) };
}

async function companyNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["name"] },
    });
    for (const c of j.results ?? []) out.set(String(c.id), pyStrip(c.properties?.name ?? ""));
  }
  return out;
}

/* ── orders_daily ──────────────────────────────────────────────────────── */

const KV_DAILY = "connectors:hub:orders_daily";
type Ledger = { files: Record<string, { ts: number; created: number; enriched: number }>; last?: Record<string, unknown> };
const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Create a batch of orders. A timeout or 5xx is ambiguous - the batch may have been
 * created - so before trying again the orders that exist are looked up by number and
 * only the rest re-sent. A 4xx refusal is retried one order at a time.
 * -> the created orders as [order number, id], paired by number from HubSpot's answer.
 */
async function createOrders(batch: [string, Record<string, string>][]): Promise<{ created: [string, string][]; failed: number; errors: string[] }> {
  const created: [string, string][] = [];
  const errors: string[] = [];
  const send = async (items: [string, Record<string, string>][]) => {
    const j = await hubspotFetchJson<{ results?: Obj[] }>({
      path: "/crm/v3/objects/orders/batch/create", method: "POST",
      body: { inputs: items.map(([, p]) => ({ properties: p })) }, signal: AbortSignal.timeout(90_000),
    });
    // HubSpot answers in ARBITRARY order: pair on the order number, never the position
    const want = new Set(items.map(([n]) => n));
    for (const r of j.results ?? []) {
      const num = pyStrip(r.properties?.order_order_number ?? "");
      if (want.has(num)) { created.push([num, String(r.id)]); want.delete(num); }
    }
  };
  let pending = batch;
  for (let attempt = 1; pending.length; attempt += 1) {
    try {
      await send(pending);
      break;
    } catch (e) {
      if (errors.length < 3) errors.push(errText(e));
      if (!transient(e)) {
        // refused: one at a time, so one bad order does not cost the other 49
        if (pending.length > 1) {
          for (const one of pending) {
            try { await send([one]); } catch (e1) { if (errors.length < 3) errors.push(errText(e1)); }
            await deps.sleep(100);
          }
        }
        break;
      }
      if (attempt >= 4) break;
      await deps.sleep(3000 * attempt);
      const made = new Set(created.map(([n]) => n));
      for (const o of await ordersByNumber(pending.map(([n]) => n), ["order_order_number"])) {
        const num = pyStrip(o.properties?.order_order_number ?? "");
        if (pending.some(([n]) => n === num) && !made.has(num)) { created.push([num, String(o.id)]); made.add(num); }
      }
      pending = pending.filter(([n]) => !made.has(n));
    }
  }
  const made = new Set(created.map(([n]) => n));
  return { created, failed: batch.filter(([n]) => !made.has(n)).length, errors };
}

type Delivery = { id: string; num: string; rev: number; web: string };

/** The .000 guard's deliveries of base b: every page, plus the ones created a moment ago that the index may not show yet. */
async function deliveriesOf(base: string, justCreated: Map<string, Delivery>): Promise<Delivery[]> {
  const res = await searchAll("orders", {
    filterGroups: [{ filters: [{ propertyName: "order_order_number", operator: "CONTAINS_TOKEN", value: base }] }],
    properties: ["order_order_number", "order_total_net_revenue", "order_web_order_number"], limit: 100,
  });
  const out: Delivery[] = [];
  const seen = new Set<string>();
  for (const o of res) {
    const num = o.properties?.order_order_number ?? "";
    if (!isDeliveryOf(num, base)) continue;
    out.push({ id: String(o.id), num, rev: fnum(o.properties?.order_total_net_revenue), web: o.properties?.order_web_order_number ?? "" });
    seen.add(String(o.id));
    seen.add(num);
  }
  for (const d of justCreated.values()) if (isDeliveryOf(d.num, base) && !seen.has(d.id) && !seen.has(d.num)) out.push(d);
  return out;
}

async function contactsOf(orderId: string): Promise<string[]> {
  const out: string[] = [];
  let after: string | undefined;
  for (;;) {
    const j = await hs<{ results?: { toObjectId?: string | number }[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v4/objects/orders/${orderId}/associations/contacts?limit=500${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    });
    for (const r of j.results ?? []) if (r.toObjectId) out.push(String(r.toObjectId));
    after = j.paging?.next?.after;
    if (!after) return out;
  }
}

export async function ordersDaily(live: boolean, beat: Beat, opts: { file: string; articleFile?: string; force?: boolean }): Promise<StepResult> {
  const t0 = deps.now();
  const tick = pacer(beat);
  const { store } = deps;
  let sha: string;
  try { sha = await fileSha(opts.file); } catch { throw new Error("no delta fct file"); }
  const led = (await store.kvGet<Ledger>(KV_DAILY)) ?? { files: {} };
  led.files ??= {};
  if (live && !opts.force && led.files[sha]) return { skipped: "file already processed", sha };

  // ---- the delta, collapsed: latest row per line, per full order number ----
  const { rows, orders } = await collapseFctFile(opts.file, tick);
  const { cand, staleBase } = candidates(orders);

  // ---- which exist already? Empty positions (web orders Magento made) get enriched ----
  const missing = new Map<string, FctOrder>();
  const emptyExist = new Map<string, [string, FctOrder]>();
  const names = [...cand.keys()].sort(cmpStr);
  for (let i = 0; i < names.length; i += 50) {
    const chunk = names.slice(i, i + 50);
    const have = new Map<string, [string, string]>();
    for (const o of await ordersByNumber(chunk, ["order_order_number", "order_positions_json"])) {
      have.set(pyStrip(o.properties?.order_order_number ?? ""), [String(o.id), pyStrip(o.properties?.order_positions_json ?? "")]);
    }
    for (const n of chunk) {
      const h = have.get(n);
      if (!h) missing.set(n, cand.get(n)!);
      else if (h[1] === "" || h[1] === "[]") emptyExist.set(n, [h[0], cand.get(n)!]);
    }
    await tick();
  }
  const rep: StepResult = {
    rows, orders_in_delta: orders.size, with_value: cand.size, stale_base_skipped: staleBase,
    already_in_hs: cand.size - missing.size, to_create: missing.size, to_enrich: emptyExist.size,
    samples: [...missing.keys()].sort(cmpStr).slice(0, 8), enrich_samples: [...emptyExist.keys()].sort(cmpStr).slice(0, 8), sha,
    ...(led.files[sha] ? { file_seen_before: true } : {}),
  };

  // ---- articles, companies, names (reads) and the payloads ----
  const keys = new Set<string>();
  for (const o of [...missing.values(), ...[...emptyExist.values()].map(([, o]) => o)]) {
    for (const l of o.lines.values()) if (!l.gone) keys.add(l.key);
  }
  const art = await articleLookup(opts.articleFile, keys, tick);
  // keys today's dim_article lacks - a made-to-order article is created the day it is ordered:
  // the hub's memory of internal ids answers what an earlier delivery taught it (17.10.2026)
  const lacking = new Set<string>();
  for (const o of [...missing.values(), ...[...emptyExist.values()].map(([, o]) => o)]) {
    for (const l of o.lines.values()) if (!l.gone && !art.has(l.key)) lacking.add(pyStrip(l.artno));
  }
  let known = new Map<string, ArtInfo>();
  try { known = lacking.size ? await deps.memory.known([...lacking]) : known; } catch (e) { rep.memory_error = errText(e); }
  if (keys.size && !(opts.articleFile && (await stat(opts.articleFile).then(() => true, () => false)))) {
    // loud: without the file every line falls back to the ERP's internal id, with no profit centre
    rep.WARNING = "dim_article.csv is not on this copy's disk - lines get the ERP's internal ids; the repair step fixes them later";
  }
  const actx = { art, fixmap: FIXMAP, known };
  const uns = [...new Set([...missing.values()].map((o) => o.custuniq).filter((u) => u))].sort(cmpStr);
  const cm = await customerMap(uns);
  const cname = await companyNames([...new Set(uns.map((u) => cm.map.get(u)).filter((x): x is string => !!x))].sort(cmpStr));
  const payload = (full: string, o: FctOrder) =>
    orderPayload(full, o, { ...actx, companyName: cname.get(cm.map.get(o.custuniq) ?? "") ?? "" });
  const items = [...missing.entries()].sort((a, b) => cmpStr(a[0], b[0]));
  Object.assign(rep, {
    articles_found: art.size, articles_asked: keys.size, articles_from_memory: [...lacking].filter((x) => known.has(x)).length,
    customers: uns.length, customers_looked_up: cm.looked_up,
    customers_not_found: cm.not_found.length, ...(cm.not_found.length ? { customers_not_found_samples: cm.not_found.slice(0, 10) } : {}),
    customers_by_erp_number: cm.by_number,
  });
  const bases = deliveryBases(missing.keys());

  if (!live) {
    // the .000 guard as it would decide: the deliveries in HubSpot plus the ones this run would create
    const virtual = new Map<string, Delivery>();
    for (const [full, o] of items) virtual.set(full, { id: `new:${full}`, num: full, rev: fnum(payload(full, o).order_total_net_revenue), web: "" });
    const guard = await guard000(bases, virtual, false, tick);
    return {
      ...rep, ...guard.report,
      examples: items.slice(0, 5).map(([full, o]) => {
        const p = payload(full, o);
        return { order: full, name: p.hs_order_name, company: cm.map.get(o.custuniq) ?? null, revenue: p.order_total_net_revenue, lines: p.order_line_count, profit_center: p.order_profit_center ?? null, properties: Object.keys(p).length };
      }),
      dedup_examples: guard.examples, seconds: Math.round((deps.now() - t0) / 1000),
    };
  }

  // ---- create, then link to the company by order number ----
  let created = 0, err = 0;
  const createErrors: string[] = [];
  const assoc: { from: { id: string }; to: { id: string }; types: { associationCategory: string; associationTypeId: number }[] }[] = [];
  const justCreated = new Map<string, Delivery>();
  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50).map(([full, o]) => [full, payload(full, o)] as [string, Record<string, string>]);
    const r = await createOrders(batch);
    created += r.created.length;
    err += r.failed;
    createErrors.push(...r.errors.slice(0, 3 - createErrors.length));
    const byNum = new Map(batch);
    for (const [num, id] of r.created) {
      const o = missing.get(num)!;
      justCreated.set(num, { id, num, rev: fnum(byNum.get(num)!.order_total_net_revenue), web: "" });
      const cid = cm.map.get(o.custuniq);
      if (cid) assoc.push({ from: { id }, to: { id: cid }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 509 }] });
    }
    await deps.sleep(120);
    await tick();
  }
  let adone = 0, afail = 0;
  for (let i = 0; i < assoc.length; i += 100) {
    const chunk = assoc.slice(i, i + 100);
    try {
      const j = await hs<{ errors?: unknown[] }>({ path: "/crm/v4/associations/orders/companies/batch/create", method: "POST", body: { inputs: chunk } });
      const bad = j.errors?.length ?? 0;
      adone += chunk.length - bad;
      afail += bad;
    } catch (e) {
      afail += chunk.length;
      if (createErrors.length < 3) createErrors.push(errText(e));
    }
    await deps.sleep(100);
  }

  // ---- the .000 duplicate guard ----
  const guard = await guard000(bases, justCreated, true, tick);

  // ---- enrich web orders that exist without lines (Magento keeps name and pipeline) ----
  let enriched = 0;
  const eitems = [...emptyExist.entries()].sort((a, b) => cmpStr(a[0], b[0]));
  for (let i = 0; i < eitems.length; i += 50) {
    const inputs = eitems.slice(i, i + 50).map(([full, [id, o]]) => ({ id, properties: enrichPayload(payload(full, o)) }));
    try {
      await hs({ path: "/crm/v3/objects/orders/batch/update", method: "POST", body: { inputs } });
      enriched += inputs.length;
    } catch (e) {
      err += inputs.length;
      if (createErrors.length < 3) createErrors.push(errText(e));
    }
    await deps.sleep(120);
  }

  // ---- lines still on the ERP's internal id: noted for the repair step (article_repair) ----
  const left: [string, string][] = [];
  for (const [num, d] of justCreated) for (const id of unresolvedIds(missing.get(num)!.lines.values(), actx)) left.push([d.id, id]);
  for (const [, [id, o]] of eitems) for (const x of unresolvedIds(o.lines.values(), actx)) left.push([id, x]);
  let leftNoted = 0;
  try { leftNoted = left.length ? await deps.memory.pending(left) : 0; } catch (e) { rep.memory_error = errText(e); }

  // ---- the ledger: this file is done (the newest 60 kept) ----
  led.files[sha] = { ts: Math.floor(deps.now() / 1000), created, enriched };
  const keep = Object.entries(led.files).sort((a, b) => b[1].ts - a[1].ts).slice(0, 60);
  led.files = Object.fromEntries(keep);
  led.last = { last_run: new Date(deps.now()).toISOString().slice(0, 10), created, enriched, to_create: missing.size, already_in_hs: rep.already_in_hs };
  await store.kvSet(KV_DAILY, led);
  return {
    ...rep, created, enriched, errors: err, company_assocs: adone, company_assocs_failed: afail, lines_left_for_repair: leftNoted, ...guard.report,
    ...(createErrors.length ? { error_samples: createErrors } : {}), dedup_examples: guard.examples,
    seconds: Math.round((deps.now() - t0) / 1000),
  };
}

/**
 * For every base that just got a delivery: carry the web fields and the contacts onto
 * the deliveries, then archive the .000 when the deliveries cover it, or reduce it to the
 * remainder. Preview (live=false) decides the same and writes nothing.
 */
async function guard000(bases: string[], justCreated: Map<string, Delivery>, live: boolean, tick: () => Promise<void>): Promise<{ report: Record<string, number>; examples: unknown[] }> {
  let archived = 0, reduced = 0, carried = 0, carryFailed = 0, cCarried = 0, cFailed = 0, failed = 0;
  const examples: unknown[] = [];
  const goneIds: string[] = [];
  for (let i = 0; i < bases.length; i += 50) {
    const chunk = bases.slice(i, i + 50);
    const base000 = new Map<string, { id: string; rev0: number; carry: Record<string, string> }>();
    for (const o of await ordersByNumber(chunk.map((b) => `${b}.000`), ["order_order_number", "order_total_net_revenue", ...WEB_CARRY])) {
      const p = o.properties ?? {};
      base000.set(baseOf000(p.order_order_number), { id: String(o.id), rev0: fnum(p.order_total_net_revenue), carry: webCarry(p) });
    }
    for (const [b, { id: oid, rev0, carry }] of base000) {
      const deliveries = await deliveriesOf(b, justCreated);
      const dec = dedupDecision(rev0, deliveries.map((d) => d.rev));
      if (examples.length < 10) examples.push({ base: b, order_000: rev0, deliveries: deliveries.map((d) => d.num), delivered: dec.sfx, action: dec.action, ...(dec.action === "reduce" ? { remainder: dec.remainder } : {}) });
      const real = deliveries.filter((d) => !d.id.startsWith("new:"));
      if (live) {
        // web fields onto deliveries that do not have them
        const upd = Object.keys(carry).length ? real.filter((d) => !d.web).map((d) => ({ id: d.id, properties: carry })) : [];
        if (upd.length) {
          try { await hs({ path: "/crm/v3/objects/orders/batch/update", method: "POST", body: { inputs: upd } }); carried += upd.length; }
          catch { carryFailed += upd.length; }
        }
        // the person: the .000's contacts onto every delivery (default association, a no-op when present)
        const cids = real.length ? await contactsOf(oid) : [];
        for (const d of real) {
          for (const cid of cids) {
            try { await hs({ path: `/crm/v4/objects/orders/${d.id}/associations/default/contacts/${cid}`, method: "PUT" }); cCarried += 1; }
            catch { cFailed += 1; }
          }
        }
        try {
          if (dec.action === "archive") {
            await hs({ path: "/crm/v3/objects/orders/batch/archive", method: "POST", body: { inputs: [{ id: oid }] } });
            archived += 1;
            goneIds.push(oid);
          } else if (dec.action === "reduce") {
            await hs({ path: `/crm/v3/objects/orders/${oid}`, method: "PATCH", body: { properties: { order_total_net_revenue: pyRepr(dec.remainder) } } });
            reduced += 1;
          }
        } catch {
          failed += 1;
        }
        await deps.sleep(150);
      } else if (dec.action === "archive") archived += 1;
      else if (dec.action === "reduce") reduced += 1;
      await tick();
    }
    await deps.sleep(200);
  }
  if (live) await deps.store.snapDelete(goneIds);
  const report: Record<string, number> = live
    ? { dedup_000_archived: archived, dedup_000_reduced: reduced, dedup_000_failed: failed, dedup_000_web_fields_carried: carried, dedup_000_web_fields_carry_failed: carryFailed, dedup_000_contacts_carried: cCarried, dedup_000_contacts_carry_failed: cFailed }
    : { dedup_000_would_archive: archived, dedup_000_would_reduce: reduced, dedup_000_bases: bases.length };
  return { report, examples };
}

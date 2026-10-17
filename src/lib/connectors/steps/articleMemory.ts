// ORDER LINES GET THEIR REAL ARTICLE AND PROFIT CENTRE (SARCLA 17.10.2026: "we have articles
// without profit centre - this is not possible, we need to fix it").
//
//   article_ids     with every ERP delivery: each order line's internal id and its key, the key
//                   looked up in that day's dim_article, and what resolves is remembered
//                   (connectors/articleIds.ts) - a made-to-order article missing from the day it
//                   was ordered is in the next day's file
//   article_repair  the HubSpot order lines still carrying an internal id (once: every order since
//                   January 2025 is read; then the lines orders_daily notes) get the real article,
//                   its profit centre and the order's main profit centre, as soon as the hub knows
//                   them (orderRules.repairOrder)
// Preview reads and counts; it writes neither HubSpot nor the memory.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import { kvGet, kvSet } from "@/lib/db/init";
import type { StepResult } from "./companyFacts";
import { articleLookup, readCsvFile } from "./orderFiles";
import { FCT, internalIdsOn, pyStrip, repairOrder, type ArtInfo } from "./orderRules";
import { addPending, clearPending, knownArticles, memoryCounts, rememberArticles, resolvablePending } from "../articleIds";
import seedJson from "../data/article_ids_seed.json";

type Beat = () => Promise<void>;
type Req = Parameters<typeof hubspotFetchJson>[0];
type Obj = { id: string; properties?: Record<string, string | null> };

const KV_SCAN = "connectors:hub:article_scan";
const KV_SEED = "connectors:hub:article_seed";
const SCAN_FROM = "2025-01";
const REPAIR_BUDGET_MS = 10 * 60_000;
const msg = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 200);

async function hs<T>(req: Req, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await hubspotFetchJson<T>(req);
    } catch (e) {
      const st = e instanceof IntegrationError ? e.status : null;
      if (i >= tries || !(st === null || st === 429 || (st !== undefined && st >= 500))) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

/* ── learning ──────────────────────────────────────────────────────────── */

/** The seed: internal ids resolved from SARCLA's July full-history files, loaded once. */
type Seed = { version: string; ids: Record<string, [pc: string, article: string, text: string]> };

async function loadSeed(live: boolean): Promise<number> {
  const seed = seedJson as unknown as Seed;
  if (!live || !seed.ids || !Object.keys(seed.ids).length) return 0;
  const done = await kvGet<{ version: string }>(KV_SEED);
  if (done?.version === seed.version) return 0;
  const n = await rememberArticles(Object.entries(seed.ids).map(([id, v]) => [id, v as unknown as ArtInfo]));
  await kvSet(KV_SEED, { version: seed.version, at: new Date().toISOString(), n });
  return n;
}

export async function learnArticleIds(live: boolean, beat: Beat, opts: { file: string; articleFile: string }): Promise<StepResult> {
  const t0 = Date.now();
  const seeded = await loadSeed(live);
  // every line's internal id and key (the last line's key per id)
  const keyOf = new Map<string, string>();
  let rows = 0, header = true;
  await readCsvFile(opts.file, { fatal: false, tick: beat }, (row) => {
    if (header) { header = false; return; }
    rows += 1;
    const id = pyStrip(row[FCT.ARTNO] ?? "");
    const k = (row[FCT.ARTKEY] ?? "").trim();
    if (id && k) keyOf.set(id, k);
  });
  const art = await articleLookup(opts.articleFile, new Set(keyOf.values()), beat);
  const learnt: [string, ArtInfo][] = [];
  const unknown: string[] = [];
  for (const [id, k] of keyOf) {
    const a = art.get(k);
    if (a && a[1]) learnt.push([id, a]);
    else unknown.push(id);
  }
  const remembered = live ? await rememberArticles(learnt) : 0;
  return {
    rows, internal_ids: keyOf.size, resolved_by_dim_article: learnt.length, not_in_dim_article: unknown.length,
    ...(unknown.length ? { not_in_dim_article_samples: unknown.slice(0, 10) } : {}),
    ...(art.size === 0 && keyOf.size ? { WARNING: "dim_article.csv gave nothing - is it on this copy's disk?" } : {}),
    remembered, seeded,
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}

/* ── repair ────────────────────────────────────────────────────────────── */

const monthStart = (ym: string) => Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1);
const nextYm = (ym: string) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

/** Every order since January 2025, month by month: the lines still on an internal id. */
async function scanOrders(beat: Beat): Promise<{ orders: number; found: [string, string][] }> {
  const found: [string, string][] = [];
  let orders = 0;
  const now = new Date();
  const last = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  for (let ym = SCAN_FROM; ym <= last; ym = nextYm(ym)) {
    let after: string | undefined;
    for (let page = 0; page < 60; page++) {
      const j = await hs<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({
        path: "/crm/v3/objects/orders/search", method: "POST",
        body: {
          filterGroups: [{ filters: [
            { propertyName: "order_order_date", operator: "GTE", value: String(monthStart(ym)) },
            { propertyName: "order_order_date", operator: "LT", value: String(monthStart(nextYm(ym))) },
          ] }],
          properties: ["order_positions_json"], limit: 200, ...(after ? { after } : {}),
        },
      });
      for (const o of j.results ?? []) {
        orders += 1;
        for (const id of internalIdsOn(o.properties?.order_positions_json)) found.push([String(o.id), id]);
      }
      after = j.paging?.next?.after;
      if (!after) break;
    }
    await beat();
  }
  return { orders, found };
}

export async function repairArticleLines(live: boolean, beat: Beat, opts: { full?: boolean } = {}): Promise<StepResult> {
  const t0 = Date.now();
  const out: StepResult = {};
  // once (or when asked): every order since January 2025, so the lines written before 17.10.2026 are found too
  const scanned = await kvGet<{ at: string }>(KV_SCAN);
  if (!scanned || opts.full || !live) {
    const s = await scanOrders(beat);
    const ids = [...new Set(s.found.map((f) => f[1]))];
    const known = await knownArticles(ids).catch(() => new Map<string, ArtInfo>());
    Object.assign(out, {
      scanned_orders: s.orders, lines_on_internal_id: s.found.length, orders_with_such_lines: new Set(s.found.map((f) => f[0])).size,
      internal_ids: ids.length, of_them_known: ids.filter((x) => known.has(x)).length,
      ...(ids.length ? { internal_id_samples: ids.filter((x) => !known.has(x)).slice(0, 10) } : {}),
    });
    if (live) {
      out.noted = await addPending(s.found);
      await kvSet(KV_SCAN, { at: new Date().toISOString(), orders: s.orders, lines: s.found.length });
    }
  }
  if (!live) return { ...out, ...(await memoryCounts().catch(() => ({}))), seconds: Math.round((Date.now() - t0) / 1000) };

  // repair what the hub now knows, 100 orders at a time, for at most 10 minutes a run
  let orders = 0, lines = 0, failed = 0;
  const errors: string[] = [];
  const examples: unknown[] = [];
  const seen = new Set<string>();
  while (Date.now() - t0 < REPAIR_BUDGET_MS) {
    const batch = (await resolvablePending(100)).filter((b) => !seen.has(b.orderId));
    if (!batch.length) break;
    for (const b of batch) seen.add(b.orderId);
    const j = await hs<{ results?: Obj[] }>({
      path: "/crm/v3/objects/orders/batch/read", method: "POST",
      body: { inputs: batch.map((b) => ({ id: b.orderId })), properties: ["order_positions_json", "order_order_number"] },
    });
    const byId = new Map((j.results ?? []).map((o) => [String(o.id), o.properties ?? {}]));
    const inputs: { id: string; properties: Record<string, string> }[] = [];
    const done: { orderId: string; ids: string[] }[] = [];
    for (const b of batch) {
      const p = byId.get(b.orderId);
      // gone from HubSpot, or the line no longer carries the id: nothing left to repair
      if (!p) { done.push({ orderId: b.orderId, ids: [...b.known.keys()] }); continue; }
      const r = repairOrder(p.order_positions_json, b.known);
      if (r.fixed.length) {
        inputs.push({ id: b.orderId, properties: r.patch });
        if (examples.length < 10) examples.push({ order: p.order_order_number, fixed: r.fixed.map((x) => `${x} -> ${b.known.get(x)?.[1]} (${b.known.get(x)?.[0] || "?"})`) });
      }
      done.push({ orderId: b.orderId, ids: [...b.known.keys()] });
      lines += r.fixed.length;
    }
    if (inputs.length) {
      try {
        await hs({ path: "/crm/v3/objects/orders/batch/update", method: "POST", body: { inputs } });
        orders += inputs.length;
      } catch (e) {
        failed += inputs.length;
        if (errors.length < 3) errors.push(msg(e));
        // not cleared: the next run tries these again
        const bad = new Set(inputs.map((x) => x.id));
        for (let i = done.length - 1; i >= 0; i--) if (bad.has(done[i].orderId)) done.splice(i, 1);
      }
    }
    for (const d of done) await clearPending(d.orderId, d.ids);
    await beat();
  }
  return {
    ...out, orders_repaired: orders, lines_repaired: lines, failed, ...(errors.length ? { errors } : {}), examples,
    ...(await memoryCounts().catch(() => ({}))),
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}

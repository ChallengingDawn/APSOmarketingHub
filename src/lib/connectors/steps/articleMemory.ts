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
// The second gap (17.10.2026): a line the old fixmap resolved carries its real 10-digit article
// but no profit centre - 1,346 of the fixmap's ids have none (530 lines in Sep-Oct 2026 alone).
// The day's dim_article does not have them (not one of the 1,346 was in July's 867,000 rows);
// Products & Pricing, which keeps the articles the ERP sent over the years, has 846 of them -
// and all 287 on the orders of Sep-Oct 2026 (FT, AT, ST, WS, DT). Both steps
// look them up there by NUMBER and remember them: the article for the repair, the fixmap id for
// orders_daily.
// The rest (SARCLA 18.10.2026, "this should be 100%"): ids NO file knows - dim_article leaves those
// articles out (credit notes, fees) - borrow the order's main profit centre, or the customer's on an
// order with no other line (orderRules.borrowOrder); the real answer still replaces it.
// Preview reads and counts; it writes neither HubSpot nor the memory.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import { kvGet, kvSet } from "@/lib/db/init";
import type { StepResult } from "./companyFacts";
import { articleLookup, readCsvFile } from "./orderFiles";
import { FCT, PC_OK, borrowOrder, customerPc, isArticleNumber, linePc, linesWithoutPcOn, mainPc, pyStrip, repairOrder, type ArtInfo, type FixMap } from "./orderRules";
import {
  addPending, clearPending, knownArticles, markBorrowed, memoryCounts, pendingArticleNumbers, rememberArticles, resolvablePending,
  retryNothingBorrowed, unknownPending, usualBorrowed,
} from "../articleIds";
import seedJson from "../data/article_ids_seed.json";
import fixmapJson from "../data/article_fixmap.json";

type Beat = () => Promise<void>;
type Req = Parameters<typeof hubspotFetchJson>[0];
type Obj = { id: string; properties?: Record<string, string | null> };

// v2: scanned again once for the lines on a real article with no profit centre (17.10.2026)
const KV_SCAN = "connectors:hub:article_scan:v2";
const KV_SEED = "connectors:hub:article_seed";
const SCAN_FROM = "2025-01";
const REPAIR_BUDGET_MS = 10 * 60_000;
const msg = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 200);
const PP = "2-200042439"; // Products & Pricing

/** The fixmap's ids that give a 10-digit article but no profit centre: fixmap id -> article. */
const FIX_NO_PC: ReadonlyMap<string, string> = new Map(
  Object.entries(fixmapJson as unknown as FixMap).filter(([, e]) => !e.pc && isArticleNumber(e.n || "")).map(([id, e]) => [id, e.n.trim()]),
);

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
  const nums = await learnByNumber(live, beat);
  return {
    ...nums,
    rows, internal_ids: keyOf.size, resolved_by_dim_article: learnt.length, not_in_dim_article: unknown.length,
    ...(unknown.length ? { not_in_dim_article_samples: unknown.slice(0, 10) } : {}),
    ...(art.size === 0 && keyOf.size ? { WARNING: "dim_article.csv gave nothing - is it on this copy's disk?" } : {}),
    remembered, seeded,
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}

/* ── articles by number ───────────────────────────────────────────────── */

async function byNumber(articles: string[], beat: Beat): Promise<Map<string, ArtInfo>> {
  const out = new Map<string, ArtInfo>();
  for (let i = 0; i < articles.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>({
      path: `/crm/v3/objects/${PP}/search`, method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: articles.slice(i, i + 100) }] }], properties: ["article_number", "profit_center", "article_description"], limit: 200 },
    });
    for (const r of j.results ?? []) {
      const a = pyStrip(r.properties?.article_number ?? "");
      const pc = linePc(r.properties?.profit_center);
      if (a && pc) out.set(a, [pc, a, pyStrip(r.properties?.article_description ?? "")]);
    }
    await new Promise((r) => setTimeout(r, 300));
    await beat();
  }
  return out;
}

/**
 * The fixmap's articles the memory does not know yet, and the waiting article-number lines, looked
 * up by number: remembered as the article (for the repair) and as each fixmap id pointing at it
 * (for orders_daily, which asks the memory before the fixmap).
 */
async function learnByNumber(live: boolean, beat: Beat): Promise<StepResult> {
  const waiting = await pendingArticleNumbers().catch(() => [] as string[]);
  const knownFix = await knownArticles([...FIX_NO_PC.keys()]).catch(() => new Map<string, ArtInfo>());
  const fixLeft = [...FIX_NO_PC].filter(([id]) => !knownFix.has(id));
  const wanted = [...new Set([...fixLeft.map(([, a]) => a), ...waiting])];
  if (!wanted.length) return {};
  const found = await byNumber(wanted, beat);
  const rows: [string, ArtInfo][] = [...found.entries()];
  for (const [id, a] of fixLeft) { const f = found.get(a); if (f) rows.push([id, f]); }
  const remembered = live ? await rememberArticles(rows) : 0;
  return { by_number_asked: wanted.length, by_number_waiting: waiting.length, by_number_found: found.size, by_number_remembered: remembered };
}

/* ── borrowing ─────────────────────────────────────────────────────────── */

/** Each order's companies (the first is the buyer's - orders carry one). */
async function companiesOf(orderIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < orderIds.length; i += 100) {
    const j = await hs<{ results?: { from?: { id?: string | number }; to?: { toObjectId?: string | number }[] }[] }>({
      path: "/crm/v4/associations/orders/companies/batch/read", method: "POST",
      body: { inputs: orderIds.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const r of j.results ?? []) {
      const to = r.to?.[0]?.toObjectId;
      if (r.from?.id !== undefined && to !== undefined) out.set(String(r.from.id), String(to));
    }
  }
  return out;
}

/** The customers' main profit centre for each year asked: company id -> year -> profit centre. */
async function customerPcs(companyIds: string[], years: number[]): Promise<Map<string, Map<number, string>>> {
  const out = new Map<string, Map<number, string>>();
  const props = [...new Set(years.flatMap((y) => [y, y - 1]))].map((y) => `rev_${y}_pc_monthly`);
  for (let i = 0; i < companyIds.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: companyIds.slice(i, i + 100).map((id) => ({ id })), properties: props },
    });
    for (const c of j.results ?? []) {
      const m = new Map<number, string>();
      for (const y of years) m.set(y, customerPc([c.properties?.[`rev_${y}_pc_monthly`], c.properties?.[`rev_${y - 1}_pc_monthly`]]));
      out.set(String(c.id), m);
    }
  }
  return out;
}

/**
 * The lines on an id no file knows: the order's main profit centre (its lines', else its own
 * field), else the customer's (that year or the one before), else - a new customer's first order -
 * the one that same id borrowed most often on its other orders. Two passes: the second gives the
 * orders the first left empty the ids' usual profit centre.
 */
async function borrowUnknown(beat: Beat, until: number): Promise<StepResult> {
  let orders = 0, lines = 0, fromOrder = 0, fromCustomer = 0, fromId = 0, nothing = 0, failed = 0;
  const errors: string[] = [];
  const examples: string[] = [];
  for (let pass = 0; pass < 2 && Date.now() < until; pass++) {
    await retryNothingBorrowed();
    nothing = 0;
    const seen = new Set<string>();
    while (Date.now() < until) {
      const batch = (await unknownPending(100)).filter((b) => !seen.has(b.orderId));
      if (!batch.length) break;
      for (const b of batch) seen.add(b.orderId);
      const j = await hs<{ results?: Obj[] }>({
        path: "/crm/v3/objects/orders/batch/read", method: "POST",
        body: { inputs: batch.map((b) => ({ id: b.orderId })), properties: ["order_positions_json", "order_order_number", "order_order_date", "order_profit_center"] },
      });
      const byId = new Map((j.results ?? []).map((o) => [String(o.id), o.properties ?? {}]));
      const ownPc = (p: Record<string, string | null>) => (PC_OK.has(p.order_profit_center ?? "") ? (p.order_profit_center as string) : "");
      // the customer, only for the orders with no line - and no profit centre - of their own to lend
      const lonely = batch.filter((b) => {
        const p = byId.get(b.orderId);
        if (!p || ownPc(p)) return false;
        try { return !mainPc(JSON.parse(p.order_positions_json || "[]")); } catch { return true; }
      });
      // the order date as HubSpot gives it: epoch milliseconds or an ISO date
      const yearOf = (p: Record<string, string | null>) => {
        const v = (p.order_order_date ?? "").trim();
        const d = /^\d+$/.test(v) ? new Date(Number(v)) : new Date(v);
        return Number.isNaN(d.getTime()) ? new Date().getUTCFullYear() : d.getUTCFullYear();
      };
      const co = lonely.length ? await companiesOf(lonely.map((b) => b.orderId)) : new Map<string, string>();
      const cpc = co.size ? await customerPcs([...new Set(co.values())], [...new Set(lonely.map((b) => yearOf(byId.get(b.orderId)!)))]) : new Map<string, Map<number, string>>();
      const usual = pass ? await usualBorrowed([...new Set(lonely.flatMap((b) => b.ids))]) : new Map<string, string>();
      const inputs: { id: string; properties: Record<string, string> }[] = [];
      const marks: { orderId: string; ids: string[]; pc: string }[] = [];
      for (const b of batch) {
        const p = byId.get(b.orderId);
        // gone from HubSpot: nothing left to borrow for
        if (!p) { await clearPending(b.orderId, b.ids); continue; }
        const isLonely = lonely.some((x) => x.orderId === b.orderId);
        const customer = cpc.get(co.get(b.orderId) ?? "")?.get(yearOf(p)) ?? "";
        const byIdPc = b.ids.map((x) => usual.get(x)).find(Boolean) ?? "";
        const r = borrowOrder(p.order_positions_json, new Set(b.ids), ownPc(p) || customer || byIdPc);
        if (!r.borrowed.length) { nothing += 1; marks.push({ orderId: b.orderId, ids: b.ids, pc: "" }); continue; }
        inputs.push({ id: b.orderId, properties: r.patch });
        marks.push({ orderId: b.orderId, ids: r.borrowed, pc: r.pc });
        lines += r.borrowed.length;
        const from = !isLonely ? "order" : customer ? "customer" : "same id elsewhere";
        if (from === "order") fromOrder += 1; else if (from === "customer") fromCustomer += 1; else fromId += 1;
        if (examples.length < 10) examples.push(`${p.order_order_number}: ${r.borrowed.join(", ")} -> ${r.pc}${from === "order" ? "" : ` (${from})`}`);
      }
      if (inputs.length) {
        try {
          await hs({ path: "/crm/v3/objects/orders/batch/update", method: "POST", body: { inputs } });
          orders += inputs.length;
        } catch (e) {
          failed += inputs.length;
          if (errors.length < 3) errors.push(msg(e));
          // not marked: the next run tries these again
          const bad = new Set(inputs.map((x) => x.id));
          for (let i = marks.length - 1; i >= 0; i--) if (bad.has(marks[i].orderId)) marks.splice(i, 1);
        }
      }
      for (const m of marks) await markBorrowed(m.orderId, m.ids, m.pc);
      await beat();
    }
  }
  return {
    borrowed_orders: orders, borrowed_lines: lines, borrowed_from_order: fromOrder, borrowed_from_customer: fromCustomer, borrowed_from_same_id: fromId,
    nothing_to_borrow: nothing, borrow_failed: failed, ...(errors.length ? { borrow_errors: errors } : {}), borrow_examples: examples,
  };
}

/* ── repair ────────────────────────────────────────────────────────────── */

const monthStart = (ym: string) => Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1);
const nextYm = (ym: string) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

/** Every order since January 2025, month by month: the lines still without a profit centre. */
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
        for (const id of linesWithoutPcOn(o.properties?.order_positions_json)) found.push([String(o.id), id]);
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
  // the July seed here too, so a "Run now" repairs at once - without waiting for a delivery's article_ids
  const seeded = await loadSeed(live);
  if (seeded) out.seeded = seeded;
  // once (or when asked): every order since January 2025, so the lines written before 17.10.2026 are found too
  const scanned = await kvGet<{ at: string }>(KV_SCAN);
  if (!scanned || opts.full || !live) {
    const s = await scanOrders(beat);
    const ids = [...new Set(s.found.map((f) => f[1]))];
    const known = await knownArticles(ids).catch(() => new Map<string, ArtInfo>());
    const onNumber = s.found.filter((f) => isArticleNumber(f[1])).length;
    Object.assign(out, {
      scanned_orders: s.orders, lines_without_pc: s.found.length, of_them_on_internal_id: s.found.length - onNumber, of_them_on_real_article: onNumber,
      orders_with_such_lines: new Set(s.found.map((f) => f[0])).size,
      internal_ids: ids.length, of_them_known: ids.filter((x) => known.has(x)).length,
      ...(ids.length ? { internal_id_samples: ids.filter((x) => !known.has(x)).slice(0, 10) } : {}),
    });
    if (live) {
      out.noted = await addPending(s.found);
      await kvSet(KV_SCAN, { at: new Date().toISOString(), orders: s.orders, lines: s.found.length });
    }
  }
  // the waiting 10-digit articles (and the fixmap's): their profit centre from Products & Pricing
  if (live) Object.assign(out, await learnByNumber(true, beat));
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
  // what nothing knows: borrowed, in the time left
  Object.assign(out, await borrowUnknown(beat, t0 + REPAIR_BUDGET_MS));
  return {
    ...out, orders_repaired: orders, lines_repaired: lines, failed, ...(errors.length ? { errors } : {}), examples,
    ...(await memoryCounts().catch(() => ({}))),
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}

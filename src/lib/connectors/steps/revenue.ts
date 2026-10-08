// GROUP 3 - REVENUE AND KPIs, moved from the Compass connector into the hub:
//   revenue          revenue_oi_rollup.csv -> each company's rev_<year>_* stack
//   revenue_kpi      the monthly revenue, order-intake, country and delta series (KPI object)
//   revenue_history  twelve years, profit centre and country by year, new and reactivated customers
// Each runs as a PREVIEW (reads, reports what it would write, writes nothing to
// HubSpot) or LIVE. Rules in ./revenueRules.ts, tested and checked against the
// connector's own functions; this file is the I/O, ported from service/revenue_load.py,
// revenue_monthly.py, revenue_kpi.py and revenue_history.py.
//
// Changed on the way, on purpose:
//   - the years compared were 2025/2026 in the code: now last year and this one (UTC)
//   - January has no complete month: the delta series are left alone (the connector archived them all)
//   - calculated properties (rev_<y>_q* may be) and ones the portal lacks are not written - and are named
//   - a company's change hash is recorded only once HubSpot accepted it (was: before the write)
//   - a page that fails stops the run instead of writing what was read so far, and the
//     history scan is counted against HubSpot's own company total before anything is written
//   - KPI rows go in batches of 100, not one request each
//
// The customer-number -> company map (the connector's un2id.pkl, uploaded from a PC)
// is built here from HubSpot itself - company_unique_number, first company wins, as
// the PC built it - kept in Postgres and rebuilt when older than 20 hours; a key it
// does not know is asked of HubSpot live before it counts as missing. NEVER creates
// a company: the unmatched go to the review queue.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { connectorGet } from "@/lib/erosion/run";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import type { ReviewItem } from "../snapshot";
import type { StepResult } from "./companyFacts";
import { readRollup } from "./revenueCsv";
import {
  CAT, KPI_OBJECT, addHistoryCompany, addMonthlyCompany, aliasMap, compareYears, deltaRows, erpYearTotal,
  finishMonthly, geoMonthlyRows, historyRows, historyYears, keysToLookUp, kpiPlan, mergeReviewQueue,
  newHistoryAcc, newMonthlyAcc, oiMonthlyRows, oiSeriesFromErp, planRevenueWrites, propRules, pyFloat, pyRound,
  revenueMonthlyRows, type KpiProps, type KpiRow, type PropDef, type PropRules, type QueueItem, type RevenuePlan,
} from "./revenueRules";

type Beat = () => Promise<void>;
type Props = Record<string, string | null | undefined>;
type Obj = { id: string; properties?: Props };
type Page = { results?: Obj[]; total?: number; paging?: { next?: { after?: string } } };
type Req = { path: string; method?: "GET" | "POST" | "PATCH" | "PUT"; body?: unknown };
type BatchReply = { results?: { id: string | number }[]; errors?: { message?: string; context?: { ids?: string[] } }[] };

const OBJ = KPI_OBJECT;
const KV = {
  queue: "connectors:hub:review-queue",
  un2id: "connectors:hub:un2id",
  monthly: "connectors:hub:revenue_monthly",
};
const UN2ID_MAX_AGE_MS = 20 * 3_600_000;
const SEARCH_CAP = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const utcToday = () => new Date().toISOString().slice(0, 10);
const secs = (t0: number) => Math.round((Date.now() - t0) / 1000);
const msg = (e: unknown) => (e as Error).message.slice(0, 160);

/**
 * hubspotFetchJson (which waits out a 429), also retried on 5xx and network errors.
 * For reads and idempotent writes only - never for a create.
 */
async function hs<T>(req: Req, attempts = 5): Promise<T> {
  for (let a = 1; ; a++) {
    try {
      return await hubspotFetchJson<T>(req);
    } catch (e) {
      const st = e instanceof IntegrationError ? e.status : undefined;
      // an IntegrationError without a status is configuration (no token): never transient
      const transient = st === undefined || st === 429 || (st !== null && st >= 500);
      if (!transient || a >= attempts) throw e;
      await sleep(1500 * a);
    }
  }
}

/** A write HubSpot refuses for want of a scope stops the step: every other batch would fail the same way. */
function fatal(e: unknown): boolean {
  return e instanceof IntegrationError && (e.status === 401 || e.status === 403);
}

const listPath = (obj: string, props: string[], after?: string) =>
  `/crm/v3/objects/${obj}?limit=100&archived=false&properties=${props.join(",")}${after ? `&after=${encodeURIComponent(after)}` : ""}`;

/* ── the hub's own tables (created on first use, never in ensureSchema) ── */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_cx_un2id (
  un         text        PRIMARY KEY,
  company_id text        NOT NULL,
  healed     boolean     NOT NULL DEFAULT false,
  updated    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS apsomh_cx_revenue_hash (
  company_id text        PRIMARY KEY,
  hash       text        NOT NULL,
  updated    timestamptz NOT NULL DEFAULT now()
);`;

let schemaReady: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  schemaReady ??= getPool().query(SCHEMA).then(() => undefined).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

/* ── customer key -> company ───────────────────────────────────────────── */

type MapState = { built: number; companies: number; keys: number; duplicates: number };

/** Every company's company_unique_number, first company wins (connector/build_un_index.py). */
async function buildUn2Id(beat: Beat): Promise<{ map: Map<string, string>; state: MapState }> {
  const map = new Map<string, string>();
  let after: string | undefined;
  let companies = 0, duplicates = 0, pages = 0;
  for (;;) {
    const j = await hs<Page>({ path: listPath("companies", ["company_unique_number"], after) });
    for (const c of j.results ?? []) {
      companies += 1;
      const un = (c.properties?.company_unique_number ?? "").trim();
      if (!un) continue;
      if (map.has(un)) duplicates += 1;
      else map.set(un, String(c.id));
    }
    after = j.paging?.next?.after;
    if (++pages % 50 === 0) await beat();
    if (!after) break;
  }
  return { map, state: { built: Date.now(), companies, keys: map.size, duplicates } };
}

async function loadUn2Id(beat: Beat, rebuild: boolean): Promise<{ map: Map<string, string>; source: string; state: MapState }> {
  await ensureTables();
  const st = await kvGet<MapState>(KV.un2id);
  if (!rebuild && st && Date.now() - st.built < UN2ID_MAX_AGE_MS) {
    const r = await getPool().query<{ un: string; company_id: string }>("SELECT un, company_id FROM apsomh_cx_un2id");
    if (r.rows.length) return { map: new Map(r.rows.map((x) => [x.un, x.company_id])), source: "kept (built within 20 hours)", state: st };
  }
  const built = await buildUn2Id(beat);
  // a list that comes back far shorter is a HubSpot hiccup, not 10% of customers gone
  if (st && built.map.size < 0.9 * st.keys) {
    throw new Error(`the company list gave ${built.map.size} customer keys, the last one ${st.keys} - not replacing the map`);
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM apsomh_cx_un2id");
    await client.query(
      "INSERT INTO apsomh_cx_un2id (un, company_id) SELECT * FROM unnest($1::text[], $2::text[])",
      [[...built.map.keys()], [...built.map.values()]],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await kvSet(KV.un2id, built.state);
  return { map: built.map, source: "rebuilt from HubSpot", state: built.state };
}

/** The snapshot may be older than a company: ask HubSpot before calling a customer missing. Never creates. */
async function liveLookup(un: string): Promise<string | null> {
  const j = await hs<Page>({
    path: "/crm/v3/objects/companies/search", method: "POST",
    body: {
      filterGroups: [{ filters: [{ propertyName: "company_unique_number", operator: "EQ", value: un }] }],
      sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], properties: ["company_unique_number"], limit: 1,
    },
  });
  const r = j.results ?? [];
  return r.length ? String(r[0].id) : null;
}

async function rememberHealed(pairs: [string, string][]): Promise<void> {
  if (!pairs.length) return;
  await getPool().query(
    `INSERT INTO apsomh_cx_un2id (un, company_id, healed)
     SELECT u, c, true FROM unnest($1::text[], $2::text[]) AS t(u, c)
     ON CONFLICT (un) DO UPDATE SET company_id = EXCLUDED.company_id, healed = true, updated = now()`,
    [pairs.map((p) => p[0]), pairs.map((p) => p[1])],
  );
}

/* ── the review queue ──────────────────────────────────────────────────── */

/** The hub's queue; on the very first run, the connector's (its resolutions are the aliases). */
async function loadQueue(): Promise<{ items: QueueItem[]; source: "hub" | "connector" | "none"; note?: string }> {
  const have = await kvGet<QueueItem[]>(KV.queue);
  if (Array.isArray(have)) return { items: have, source: "hub" };
  try {
    const st = await connectorGet<{ review_queue?: ReviewItem[] }>("/state");
    return { items: (st.review_queue ?? []) as QueueItem[], source: "connector" };
  } catch (e) {
    return { items: [], source: "none", note: `the connector's queue could not be read: ${msg(e)}` };
  }
}

/* ── which company properties may be written ───────────────────────────── */

async function companyPropRules(): Promise<PropRules> {
  const j = await hs<{ results?: PropDef[] }>({ path: "/crm/v3/properties/companies?archived=false" });
  if (!j.results?.length) throw new Error("HubSpot listed no company properties - not writing blind");
  return propRules(j.results);
}

/* ── change hashes ─────────────────────────────────────────────────────── */

async function loadHashes(): Promise<Map<string, string>> {
  await ensureTables();
  const r = await getPool().query<{ company_id: string; hash: string }>("SELECT company_id, hash FROM apsomh_cx_revenue_hash");
  return new Map(r.rows.map((x) => [x.company_id, x.hash]));
}

async function saveHashes(pairs: [string, string][]): Promise<void> {
  if (!pairs.length) return;
  await getPool().query(
    `INSERT INTO apsomh_cx_revenue_hash (company_id, hash)
     SELECT c, h FROM unnest($1::text[], $2::text[]) AS t(c, h)
     ON CONFLICT (company_id) DO UPDATE SET hash = EXCLUDED.hash, updated = now()`,
    [pairs.map((p) => p[0]), pairs.map((p) => p[1])],
  );
}

/** Which of a batch HubSpot took: all of it, unless it names errors (a 207) - then the ids it returned. */
function accepted<T extends string>(ids: T[], reply: BatchReply): Set<string> {
  if (!reply.errors?.length) return new Set(ids);
  const back = new Set((reply.results ?? []).map((r) => String(r.id)));
  return new Set(ids.filter((id) => back.has(id)));
}

async function writeCompanies(ups: RevenuePlan["ups"], beat: Beat): Promise<{ updated: number; errors: number; error_examples: string[] }> {
  const items = [...ups];
  let updated = 0, errors = 0;
  const ex: string[] = [];
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    try {
      const reply = await hs<BatchReply>({
        path: "/crm/v3/objects/companies/batch/update", method: "POST",
        body: { inputs: chunk.map(([id, u]) => ({ id, properties: clean(u.props) })) },
      });
      const ok = accepted(chunk.map(([id]) => id), reply);
      updated += ok.size;
      errors += chunk.length - ok.size;
      for (const e of reply.errors ?? []) if (ex.length < 3) ex.push((e.message ?? "").slice(0, 160));
      // only now: a batch HubSpot refused is written again next time
      await saveHashes(chunk.filter(([id]) => ok.has(id)).map(([id, u]) => [id, u.hash]));
    } catch (e) {
      if (fatal(e)) throw e;
      errors += chunk.length;
      if (ex.length < 3) ex.push(msg(e));
    }
    if ((i / 100) % 20 === 19) await beat();
  }
  return { updated, errors, error_examples: ex };
}

/* ── revenue: the rollup file onto the companies ───────────────────────── */

/**
 * revenue_oi_rollup.csv -> every matched company's rev_<year>_* stack, delta-only.
 * `opts.file` is the local path of the file; `rebuildMap` forces a fresh customer map.
 */
export async function revenueLoad(live: boolean, beat: Beat, opts: { file: string; rebuildMap?: boolean }): Promise<StepResult> {
  const t0 = Date.now();
  const oiFromCsv = process.env.OI_FROM_CSV === "1";
  const roll = await readRollup(opts.file, beat, oiFromCsv);
  await beat();
  const queue = await loadQueue();
  if (live && queue.source === "none") {
    throw new Error(`${queue.note} - the hub has no queue of its own yet, so the resolutions would be lost; not running live`);
  }
  const alias = aliasMap(queue.items);
  const un2id = await loadUn2Id(beat, !!opts.rebuildMap);
  const map = new Map(un2id.map);
  const lookups = keysToLookUp(roll, alias, map);
  const healed: [string, string][] = [];
  for (let i = 0; i < lookups.length; i++) {
    const cid = await liveLookup(lookups[i]);
    if (cid) {
      map.set(lookups[i], cid);
      healed.push([lookups[i], cid]);
    }
    if (i % 25 === 24) await beat();
  }
  await rememberHealed(healed); // a cache of what HubSpot said - kept in a preview too
  const rules = await companyPropRules();
  const plan = planRevenueWrites(roll, alias, map, oiFromCsv, rules, await loadHashes());
  const missing = [...plan.unmatched].sort((a, b) => b.revenue_eur - a.revenue_eur);
  const merged = mergeReviewQueue(queue.items, plan.unmatched, Math.floor(Date.now() / 1000));
  const out: StepResult = {
    rows: roll.rows, records: roll.lines, customers: roll.agg.size,
    companies_changed: plan.ups.size, unchanged: plan.unchanged, companies_with_several_keys: plan.shared,
    map: { source: un2id.source, keys: un2id.map.size, built: new Date(un2id.state.built).toISOString(), companies_sharing_a_key: un2id.state.duplicates },
    looked_up_live: lookups.length, map_self_healed: healed.length,
    unmatched_held: plan.unmatched.length,
    review_queue: { from: queue.source, ...(queue.note ? { note: queue.note } : {}), added: merged.added, resurfaced: merged.resurfaced, size: merged.queue.length },
    missing_companies: missing.slice(0, 20).map((u) => ({ un: u.un, revenue_eur: u.revenue_eur })),
    calculated_properties_skipped: plan.skipped.calculated.size, calculated_examples: [...plan.skipped.calculated].slice(0, 10),
    unknown_properties_skipped: plan.skipped.unknown.size, unknown_examples: [...plan.skipped.unknown].slice(0, 10),
    oi_from_csv: oiFromCsv,
    examples: [...plan.ups].slice(0, 10).map(([id, u]) => ({
      company: id, un: u.un, properties: Object.keys(u.props).length,
      revenue: Object.fromEntries(Object.entries(u.props).filter(([k]) => /^revenue_\d+$/.test(k))),
    })),
  };
  if (live) {
    // held BEFORE the writes, as the connector does
    if (plan.unmatched.length || queue.source !== "hub") await kvSet(KV.queue, merged.queue);
    Object.assign(out, await writeCompanies(plan.ups, beat));
  }
  return { ...out, seconds: secs(t0) };
}

/* ── the KPI object: upsert by name ────────────────────────────────────── */

async function searchAll(obj: string, filters: object[], properties: string[]): Promise<Obj[]> {
  const out: Obj[] = [];
  let after: string | undefined;
  for (;;) {
    const j = await hs<Page>({
      path: `/crm/v3/objects/${obj}/search`, method: "POST",
      body: {
        limit: 200, properties, filterGroups: [{ filters }],
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], ...(after ? { after } : {}),
      },
    });
    // past 10,000 the search cannot page: a short list here would CREATE duplicates
    if ((j.total ?? 0) > SEARCH_CAP) throw new Error(`more than ${SEARCH_CAP} rows for ${JSON.stringify(filters)} - the search cannot read them all`);
    out.push(...(j.results ?? []));
    after = j.paging?.next?.after;
    if (!after) return out;
  }
}

/** The rows a category has, by name (the last one when a name is there twice, as the connector). */
async function existingByName(cat: string): Promise<{ ids: Map<string, string>; duplicates: number }> {
  const ids = new Map<string, string>();
  let duplicates = 0;
  for (const x of await searchAll(OBJ, [{ propertyName: "kpi_category", operator: "EQ", value: cat }], ["name"])) {
    const nm = x.properties?.name;
    if (!nm) continue;
    if (ids.has(nm)) duplicates += 1;
    ids.set(nm, String(x.id));
  }
  return { ids, duplicates };
}

/** Numbers HubSpot could not store (NaN, infinity) are left out rather than sent as null, which would clear the field. */
function clean(props: KpiProps): KpiProps {
  const out: KpiProps = {};
  for (const [k, v] of Object.entries(props)) if (typeof v !== "number" || Number.isFinite(v)) out[k] = v;
  return out;
}

type KpiResult = Record<string, unknown>;

async function applyKpi(cat: string, rows: KpiRow[], sweep: boolean, live: boolean, beat: Beat): Promise<KpiResult> {
  const { ids, duplicates } = await existingByName(cat);
  const sorted = [...rows].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const plan = kpiPlan(ids, sorted, sweep);
  const res: KpiResult = { rows: rows.length, existing: ids.size, ...(duplicates ? { duplicate_names: duplicates } : {}) };
  if (!live) {
    await beat();
    return { ...res, would_create: plan.create.length, would_update: plan.update.length, would_archive: plan.archive.length };
  }
  let created = 0, updated = 0, archived = 0, failed = 0;
  const errors: string[] = [];
  const note = (e: unknown) => { if (errors.length < 3) errors.push(msg(e)); };
  for (let i = 0; i < plan.update.length; i += 100) {
    const chunk = plan.update.slice(i, i + 100);
    try {
      const reply = await hs<BatchReply>({ path: `/crm/v3/objects/${OBJ}/batch/update`, method: "POST", body: { inputs: chunk.map((u) => ({ id: u.id, properties: clean(u.row.props) })) } });
      const ok = accepted(chunk.map((u) => u.id), reply).size;
      updated += ok;
      failed += chunk.length - ok;
    } catch (e) {
      if (fatal(e)) throw e;
      failed += chunk.length;
      note(e);
    }
  }
  for (let i = 0; i < plan.create.length; i += 100) {
    const chunk = plan.create.slice(i, i + 100);
    try {
      // not retried on a 5xx: the rows may have been made, and a second try would double them
      const reply = await hubspotFetchJson<BatchReply>({ path: `/crm/v3/objects/${OBJ}/batch/create`, method: "POST", body: { inputs: chunk.map((r) => ({ properties: clean(r.props) })) } });
      const ok = reply.errors?.length ? (reply.results ?? []).length : chunk.length;
      created += ok;
      failed += chunk.length - ok;
    } catch (e) {
      if (fatal(e)) throw e;
      failed += chunk.length;
      note(e);
    }
  }
  // a row this run no longer produces would sit there for ever, and a tile pinned to it would freeze
  for (let i = 0; i < plan.archive.length; i += 100) {
    const chunk = plan.archive.slice(i, i + 100);
    try {
      await hs({ path: `/crm/v3/objects/${OBJ}/batch/archive`, method: "POST", body: { inputs: chunk.map((id) => ({ id })) } });
      archived += chunk.length;
    } catch (e) {
      if (fatal(e)) throw e;
      note(e);
    }
  }
  await beat();
  return { ...res, created, updated, archived, failed, ...(errors.length ? { errors } : {}) };
}

/* ── revenue_kpi: the monthly series from the companies' blobs ─────────── */

async function companiesTotal(): Promise<number> {
  const j = await hs<Page>({ path: "/crm/v3/objects/companies/search", method: "POST", body: { limit: 1, properties: [], filterGroups: [] } });
  if (typeof j.total !== "number") throw new Error("HubSpot gave no company total - cannot tell a full scan from a short one");
  return j.total;
}

/**
 * A scan cut short reads exactly like a decline: it must have seen every company
 * HubSpot counts, give or take those merged or deleted while it ran. Returns the count.
 */
function scanComplete(seen: number, before: number, after: number): number {
  const expect = Math.min(before, after);
  const slack = Math.max(25, Math.ceil(expect * 0.002));
  if (seen < expect - slack) {
    throw new Error(`the company scan read ${seen} of ${expect} companies - refusing to write: a truncated scan reads as a decline`);
  }
  return expect;
}

/** Order intake from HubSpot Orders by order date - only for a portal with no ERP rows yet. */
async function orderIntake(years: number[], beat: Beat): Promise<Record<string, number[]>> {
  const out: Record<string, number[]> = {};
  for (const y of years) {
    out[String(y)] = new Array<number>(12).fill(0);
    for (let m = 1; m <= 12; m++) {
      const start = Date.UTC(y, m - 1, 1), end = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1);
      let after: string | undefined;
      let total = 0;
      for (;;) {
        const j = await hs<Page>({
          path: "/crm/v3/objects/orders/search", method: "POST",
          body: {
            filterGroups: [{ filters: [
              { propertyName: "order_order_date", operator: "GTE", value: String(start) },
              { propertyName: "order_order_date", operator: "LT", value: String(end) },
            ] }],
            properties: ["order_total_net_revenue"], limit: 200,
            sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], ...(after ? { after } : {}),
          },
        });
        if ((j.total ?? 0) > SEARCH_CAP) throw new Error(`order intake ${y}-${String(m).padStart(2, "0")}: more than ${SEARCH_CAP} orders - refusing a partial total`);
        for (const o of j.results ?? []) {
          const v = pyFloat(o.properties?.order_total_net_revenue || 0);
          if (v !== null) total += v;
        }
        after = j.paging?.next?.after;
        if (!after) break;
      }
      out[String(y)][m - 1] = pyRound(total, 2);
      await beat();
    }
  }
  return out;
}

/**
 * The company-wide monthly figures (last year and this one) onto the KPI object:
 * revenue_monthly, oi_monthly, revenue_geo_monthly, revenue_delta_monthly and
 * revenue_delta_country - the connector's revenue_kpi.sync, sync_oi, sync_geo, sync_delta.
 */
export async function revenueKpi(live: boolean, beat: Beat): Promise<StepResult> {
  const t0 = Date.now();
  const today = utcToday();
  const years = compareYears(today);
  const acc = newMonthlyAcc(years);
  const props = ["company_unique_number", "country", ...years.map((y) => `rev_${y}_pc_monthly`)];
  const before = await companiesTotal();
  let after: string | undefined;
  let pages = 0;
  for (;;) {
    // a page that fails throws: half the companies would publish as a collapse
    const j = await hs<Page>({ path: listPath("companies", props, after) });
    for (const c of j.results ?? []) addMonthlyCompany(acc, c.properties ?? {});
    after = j.paging?.next?.after;
    if (++pages % 50 === 0) await beat();
    if (!after) break;
  }
  const expect = scanComplete(acc.scanned, before, await companiesTotal());
  const doc = finishMonthly(acc, today, `${new Date().toISOString().slice(0, 19)}Z`);

  const erpOi = await searchAll(OBJ, [{ propertyName: "kpi_category", operator: "EQ", value: "oi_erp_monthly" }], ["kpi_year", "kpi_month_label", "metric_value"]);
  let oi = oiSeriesFromErp(erpOi.map((x) => x.properties ?? {}));
  let oiSource = "oi_erp_monthly (the ERP workbook)";
  if (!oi) {
    oi = await orderIntake(years, beat);
    oiSource = "HubSpot orders (no oi_erp_monthly rows yet)";
  }

  const out: StepResult = {
    years: `${years[0]}-${years[1]}`, companies_read: doc.scanned, companies_in_portal: expect, blobs: doc.blobs,
    complete_months: doc.complete_months, like_for_like: doc.like_for_like, series: doc.series, oi_source: oiSource,
  };
  out[CAT.monthly] = await applyKpi(CAT.monthly, revenueMonthlyRows(doc), false, live, beat);
  out[CAT.oi] = await applyKpi(CAT.oi, oiMonthlyRows(oi, today), false, live, beat);
  const geo = geoMonthlyRows(doc);
  out[CAT.geo] = geo.length ? await applyKpi(CAT.geo, geo, true, live, beat) : { skipped: "no geo breakdown in the figures - nothing written or archived" };
  const delta = deltaRows(doc, today);
  if (delta.months < 1) {
    out.revenue_delta = { skipped: "no complete month yet - the delta rows stay as they are" };
  } else {
    out[CAT.deltaMonth] = await applyKpi(CAT.deltaMonth, delta.byMonth, true, live, beat);
    if (delta.byCountry) out[CAT.deltaCountry] = await applyKpi(CAT.deltaCountry, delta.byCountry, true, live, beat);
    out.months_compared = delta.months;
  }
  if (live) {
    const { geo: g, ...rest } = doc;
    await kvSet(KV.monthly, { ...rest, geo_rows: g.length });
  }
  return { ...out, seconds: secs(t0) };
}

/* ── revenue_history: twelve years and the cohorts ─────────────────────── */

/**
 * The six history series - revenue_year, revenue_pc_year, revenue_geo_pc_yearly,
 * newcust_revenue_monthly, newcust_monthly, reactivated_monthly - from one pass over
 * every company. A scan that reads fewer companies than HubSpot holds raises
 * before anything is written: a truncated scan reads exactly like a decline.
 */
export async function revenueHistory(live: boolean, beat: Beat): Promise<StepResult> {
  const t0 = Date.now();
  const today = utcToday();
  const years = historyYears(today);
  // the two text fields these rows carry: the connector created them; the hub's app may not create properties
  const missingProps: string[] = [];
  let propCheck = "kpi_window and kpi_period present";
  for (const name of ["kpi_window", "kpi_period"]) {
    try {
      await hs({ path: `/crm/v3/properties/${OBJ}/${name}` });
    } catch (e) {
      if (e instanceof IntegrationError && e.status === 404) missingProps.push(name);
      else if (e instanceof IntegrationError && e.status === 403) {
        propCheck = "not checked - the app may not read the KPI object's schema (crm.schemas.custom.read)";
        break;
      } else throw e;
    }
  }
  if (missingProps.length) propCheck = `missing: ${missingProps.join(", ")}`;
  if (live && missingProps.length) {
    throw new Error(`the KPI object has no ${missingProps.join(", ")} - create ${missingProps.length > 1 ? "them" : "it"} first (text, group kpi_information); nothing written`);
  }

  const before = await companiesTotal();
  const acc = newHistoryAcc(years, today);
  const props = ["country", "compass_first_order_year", ...years.map((y) => `rev_${y}_pc_monthly`)];
  let cursor = "0", pages = 0;
  for (;;) {
    // an id cursor instead of paging: the search stops at 10,000 results
    const j = await hs<Page>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: {
        limit: 100, properties: props, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
        filterGroups: [{ filters: [{ propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      },
    });
    const res = j.results ?? [];
    if (!res.length) break;
    for (const c of res) addHistoryCompany(acc, c.properties ?? {});
    cursor = String(res[res.length - 1].id);
    if (++pages % 50 === 0) await beat();
  }
  const expect = scanComplete(acc.seen, before, await companiesTotal());

  // the running year as the ERP workbook states it (the realigned revenue_monthly rows)
  let erp: number | null = null;
  try {
    const j = await hs<Page>({
      path: `/crm/v3/objects/${OBJ}/search`, method: "POST",
      body: {
        limit: 100, properties: ["metric_value"],
        filterGroups: [{ filters: [
          { propertyName: "kpi_category", operator: "EQ", value: "revenue_monthly" },
          { propertyName: "kpi_year", operator: "EQ", value: String(acc.ty) },
        ] }],
      },
    });
    erp = erpYearTotal((j.results ?? []).map((x) => x.properties?.metric_value));
  } catch {
    erp = null;
  }

  const plan = historyRows(acc, erp);
  const out: StepResult = {
    companies_read: acc.seen, companies_in_portal: expect, with_history: acc.withblob, years: `${years[0]}-${years[years.length - 1]}`,
    ...(plan.erpAlignment ? { erp_alignment: plan.erpAlignment } : {}),
    property_check: propCheck,
  };
  for (const c of plan.categories) out[c.cat] = await applyKpi(c.cat, c.rows, c.sweep, live, beat);
  return { ...out, seconds: secs(t0) };
}

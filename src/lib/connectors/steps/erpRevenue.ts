// THE ERP MORNING WORKBOOK -> HubSpot, moved from the Compass connector into the
// hub (service/erp_revenue.py). Reads revenue_profit_center.xlsx (./erpWorkbook.ts),
// decides every value with the connector's rules (./erpRules.ts) and writes:
//   companies      the 21 erp_* properties, matched by company_unique_number -
//                  never a company created
//   KPI object     forecast_monthly, oi_erp_monthly, revenue_pc_monthly,
//                  revenue_geo_erp_monthly, oi_geo_monthly, revenue_prio_monthly,
//                  oi_prio_monthly (upserted by name), and this year's existing
//                  revenue_monthly rows realigned (metric_value only)
// PREVIEW (live = false) parses, matches and reports - nothing is written.
//
// What the hub cannot do and the connector did: create the erp_revenue property
// group, its properties, kpi_profit_center / kpi_priority and the metric_name
// options. A preflight checks they exist and a live run refuses when one is
// missing. The KPI writes need crm.objects.custom.write on the hub's app; they go
// FIRST, so a missing scope stops the run before a single company is touched.
//
// Deliberately not as the connector: the whole file is read before HubSpot is
// touched (a layout change writes nothing, where the connector had written the
// companies before it met a broken forecast); writes go 100 per call (it sent one
// call per KPI row - most of its ~11 minutes); a property with no value is cleared
// with "" (it sent null); company search pages are followed; an export with no
// customer figures writes nothing (it would have zeroed this year's January).

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { KPI_OBJECT } from "@/lib/integrations/hubspotKpi";
import { IntegrationError } from "@/lib/integrations/status";
import type { StepResult } from "./companyFacts";
import {
  COMPANY_PROPS, KPI_CATEGORIES, KPI_PROPS, METRIC_NAMES, REALIGN_CATEGORY, customerPlan, planErp, realignTargets,
  type CompanyValues, type FoundCompany, type KpiProps, type KpiRows,
} from "./erpRules";
import { readErpWorkbook } from "./erpWorkbook";

type Beat = () => Promise<void>;
type Obj = { id: string; properties?: Record<string, string | null | undefined> };
type Page = { results?: Obj[]; total?: number; paging?: { next?: { after?: string } } };
type Req = Parameters<typeof hubspotFetchJson>[0];
type Value = string | number;
export type ErpRevenueOpts = { file: string; /** yyyy-mm-dd; defaults to today (UTC) */ today?: string };

const SEARCH_CAP = 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const statusOf = (e: unknown) => (e instanceof IntegrationError ? e.status : null);
const msg = (e: unknown) => (e as Error).message.slice(0, 200);

/**
 * hubspotFetchJson, plus the connector's retry of a 5xx or a dropped connection.
 * Only for reads and idempotent writes - a create is never sent twice blind.
 */
async function hs<T>(req: Req): Promise<T> {
  for (let a = 0; ; a++) {
    try {
      return await hubspotFetchJson<T>(req);
    } catch (e) {
      const st = statusOf(e);
      const transient = e instanceof IntegrationError ? st !== null && (st >= 500 || st === 429) : true;
      if (!transient || a >= 3) throw e;
      await sleep(1500 + 1000 * a);
    }
  }
}

/** A refused write that will not get better by retrying: the app lacks the scope. */
function scopeStop(e: unknown, what: string): void {
  const st = statusOf(e);
  if (st === 401 || st === 403) {
    throw new IntegrationError(`${what}: HubSpot refused the write (${st}) - the hub's app lacks the scope${what.startsWith("KPI") ? " crm.objects.custom.write" : ""}. ${msg(e)}`, st);
  }
}

/* ── preflight: what the connector created and the hub cannot ───────────── */

type Preflight = { missing: string[]; unverified: string[] };

async function preflight(): Promise<Preflight> {
  const out: Preflight = { missing: [], unverified: [] };
  const get = async (obj: string, name: string, label: string) => {
    try {
      return await hs<{ type?: string; options?: { value?: string }[] }>({ path: `/crm/v3/properties/${obj}/${name}` });
    } catch (e) {
      const st = statusOf(e);
      if (st === 404) out.missing.push(label);
      else if (st === 401 || st === 403) out.unverified.push(label);
      else throw e;
      return null;
    }
  };
  for (const p of COMPANY_PROPS) await get("companies", p, `companies.${p}`);
  for (const p of KPI_PROPS) {
    const def = await get(KPI_OBJECT, p, `kpi.${p}`);
    if (!def) continue;
    const opts = new Set((def.options ?? []).map((o) => o.value));
    if (p === "metric_name") for (const v of METRIC_NAMES) if (!opts.has(v)) out.missing.push(`kpi.metric_name option ${v}`);
    if (p === "kpi_category" && def.type === "enumeration") {
      for (const v of [...KPI_CATEGORIES, REALIGN_CATEGORY]) if (!opts.has(v)) out.missing.push(`kpi.kpi_category option ${v}`);
    }
  }
  return out;
}

/* ── reads ─────────────────────────────────────────────────────────────── */

/**
 * unique number -> company. Search caps at 100 IN values; unlike the connector the
 * pages are followed, so a key with duplicate companies cannot push another out.
 * A duplicate key keeps the LAST company HubSpot lists, as the connector did.
 */
async function resolveCompanies(uns: string[], beat: Beat): Promise<{ found: Map<string, FoundCompany>; duplicates: string[] }> {
  const want = new Set(uns);
  const found = new Map<string, FoundCompany>();
  const duplicates: string[] = [];
  for (let i = 0; i < uns.length; i += 100) {
    let after: string | undefined;
    do {
      const j = await hs<Page>({
        path: "/crm/v3/objects/companies/search", method: "POST",
        body: {
          filterGroups: [{ filters: [{ propertyName: "company_unique_number", operator: "IN", values: uns.slice(i, i + 100) }] }],
          properties: ["company_unique_number", "country", "sales_priority"], limit: 100, ...(after ? { after } : {}),
        },
      });
      for (const c of j.results ?? []) {
        const p = c.properties ?? {};
        const un = (p.company_unique_number ?? "").trim();
        if (!want.has(un)) continue;
        if (found.has(un)) duplicates.push(un);
        found.set(un, { id: String(c.id), country: p.country ?? null, sales_priority: p.sales_priority ?? null });
      }
      after = j.paging?.next?.after;
    } while (after);
    if ((i / 100) % 20 === 19) await beat();
  }
  return { found, duplicates };
}

/** name -> id of a KPI category's rows, in HubSpot's order (a repeated name keeps its last id). */
async function kpiExisting(cat: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let after: string | undefined;
  for (;;) {
    const j = await hs<Page>({
      path: `/crm/v3/objects/${KPI_OBJECT}/search`, method: "POST",
      body: { limit: 200, properties: ["name"], filterGroups: [{ filters: [{ propertyName: "kpi_category", operator: "EQ", value: cat }] }], ...(after ? { after } : {}) },
    });
    // a page lost past 10,000 would read as "missing" and the write would duplicate it
    if ((j.total ?? 0) > SEARCH_CAP) throw new Error(`${cat}: ${j.total} KPI rows - more than the search can list, writing would create duplicates`);
    for (const x of j.results ?? []) {
      const nm = x.properties?.name;
      if (nm) out.set(nm, String(x.id));
    }
    after = j.paging?.next?.after;
    if (!after) return out;
  }
}

/* ── writes ────────────────────────────────────────────────────────────── */

type Tally = { written: number; failed: number; errors: string[] };
const tally = (): Tally => ({ written: 0, failed: 0, errors: [] });
const note = (t: Tally, e: string) => {
  if (t.errors.length < 5) t.errors.push(e.slice(0, 200));
};

type BatchResp = { results?: unknown[]; numErrors?: number; errors?: { message?: string }[] };

/**
 * Batches of 100. A batch HubSpot rejects as invalid is retried row by row, so one
 * bad row costs one row (the connector wrote one row per call) - until three rows in
 * a row fail with none landing: then the cause is not a row (a missing property, a
 * missing option) and the rest is counted failed instead of sent one by one.
 * Updates retry a 5xx; a create does not - it may have landed, and the next run
 * finds it by name and updates it.
 */
async function writeBatches(obj: string, kind: "update" | "create", inputs: { id?: string; properties: Record<string, Value> }[], what: string, t: Tally, beat: Beat): Promise<void> {
  let rowByRow = true;
  for (let i = 0; i < inputs.length; i += 100) {
    const chunk = inputs.slice(i, i + 100);
    const req: Req = { path: `/crm/v3/objects/${obj}/batch/${kind}`, method: "POST", body: { inputs: chunk } };
    try {
      const j = kind === "update" ? await hs<BatchResp>(req) : await hubspotFetchJson<BatchResp>(req);
      const bad = j.numErrors ?? 0;
      t.written += j.results ? j.results.length : chunk.length - bad;
      t.failed += bad;
      for (const er of j.errors ?? []) note(t, `${what}: ${er.message ?? "error"}`);
    } catch (e) {
      scopeStop(e, what);
      const st = statusOf(e);
      if (rowByRow && st !== null && st >= 400 && st < 500 && st !== 429) {
        let streak = 0;
        for (let k = 0; k < chunk.length; k++) {
          const one = chunk[k];
          if (streak >= 3) {
            rowByRow = false;
            t.failed += chunk.length - k;
            note(t, `${what}: ${msg(e)} - not a single row, the rest not retried`);
            break;
          }
          try {
            if (kind === "update") await hs({ path: `/crm/v3/objects/${obj}/${one.id}`, method: "PATCH", body: { properties: one.properties } });
            else await hubspotFetchJson({ path: `/crm/v3/objects/${obj}`, method: "POST", body: { properties: one.properties } });
            t.written += 1;
            streak = 0;
          } catch (e1) {
            scopeStop(e1, what);
            t.failed += 1;
            streak += 1;
            note(t, `${what} ${String(one.properties.name ?? one.id ?? "")}: ${msg(e1)}`);
          }
        }
      } else {
        t.failed += chunk.length;
        note(t, `${what}: ${msg(e)}`);
      }
    }
    if ((i / 100) % 10 === 9) await beat();
  }
}

/** _kpi_upsert: rows by name - an existing name is updated, a new one created. */
async function kpiUpsert(cat: string, rows: KpiRows, existing: Map<string, string>, beat: Beat) {
  const upd: { id: string; properties: KpiProps }[] = [];
  const crt: { properties: KpiProps }[] = [];
  for (const nm of [...rows.keys()].sort()) {
    const id = existing.get(nm);
    if (id) upd.push({ id, properties: rows.get(nm)! });
    else crt.push({ properties: rows.get(nm)! });
  }
  const u = tally(), c = tally();
  await writeBatches(KPI_OBJECT, "update", upd, `KPI ${cat}`, u, beat);
  await writeBatches(KPI_OBJECT, "create", crt, `KPI ${cat}`, c, beat);
  return { updated: u.written, created: c.written, failed: u.failed + c.failed, errors: [...u.errors, ...c.errors].slice(0, 5) };
}

/** HubSpot property values: a number stays a number; no value clears the property. */
const companyInput = (id: string, p: CompanyValues) => ({
  id, properties: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === null ? "" : v])) as Record<string, Value>,
});

/* ── the step ──────────────────────────────────────────────────────────── */

export async function erpRevenue(live: boolean, beat: Beat, opts: ErpRevenueOpts): Promise<StepResult> {
  const t0 = Date.now();
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  // the whole file first: a layout change or a wrong file stops the run before HubSpot
  const wb = await readErpWorkbook(opts.file, beat);
  const data = wb.customers.customers;
  const { month, rows } = customerPlan(data);
  const out: StepResult = {
    file: wb.file, mb: wb.mb, sheets: wb.sheets, rows_read: wb.rows, read_seconds: wb.seconds,
    customers: data.size, month, pivots: wb.customers.pivots, dry_run: !live,
  };
  if (!data.size) throw new Error(`${wb.file}: no customer carries a figure - an empty or unfinished export, nothing written`);
  await beat();

  const pre = await preflight();
  out.preflight = pre;
  if (live && pre.missing.length) {
    throw new Error(`missing in HubSpot: ${pre.missing.join(", ")} - the hub's app cannot create properties or options; the Compass connector's ensure_properties (or a person) has to. Nothing written.`);
  }

  const { found, duplicates } = await resolveCompanies([...rows.keys()], beat);
  const plan = planErp({ customers: data, forecast: wb.customers.forecast, profitCentres: wb.profitCentres?.series ?? new Map() }, found, today);
  Object.assign(out, {
    totals: plan.totals, matched: found.size, unmatched: rows.size - found.size,
    duplicate_keys: duplicates.length, ranked: { revenue: plan.ranks.rev.size, gaining: plan.ranks.growth.size, declining: plan.ranks.decline.size },
    forecast_rows_skipped: wb.customers.forecastSkipped, forecast_year_total: plan.forecastYearTotal, forecast_suspect: plan.forecastSuspect,
    profit_center_rows_skipped: wb.profitCentres?.skipped ?? 0,
  });
  await beat();

  // the existing KPI rows, read once per category (a preview reports what would happen)
  const existing = new Map<string, Map<string, string>>();
  for (const s of plan.series) existing.set(s.cat, await kpiExisting(s.cat));
  const revRows = await kpiExisting(REALIGN_CATEGORY);
  const realign = realignTargets(plan.revCy, revRows, year);
  await beat();

  const kpi: Record<string, Record<string, unknown>> = {};
  for (const s of plan.series) {
    const ex = existing.get(s.cat)!;
    const upd = [...s.rows.keys()].filter((n) => ex.has(n)).length;
    kpi[s.cat] = { rows: s.rows.size, update: upd, create: s.rows.size - upd };
  }
  out.kpi = kpi;
  out.examples = plan.companies.slice(0, 10).map((c) => ({
    company: c.id, un: c.un, rev_ytd: c.properties.erp_rev_ytd_cy, rev_ytd_py: c.properties.erp_rev_ytd_py,
    oi_ytd: c.properties.erp_oi_ytd_cy, rank: c.properties.erp_rev_rank_ytd,
  }));
  out.unmatched_examples = [...rows.keys()].filter((u) => !found.has(u)).slice(0, 10);

  if (!live) {
    Object.assign(out, {
      companies_to_update: plan.companies.length, forecast_written: 0, revenue_monthly_realigned: 0,
      revenue_monthly_would_realign: realign.length,
      ...Object.fromEntries(plan.series.filter((s) => s.cat !== "forecast_monthly").map((s) => [s.cat, s.rows.size])),
    });
    return { ...out, seconds: Math.round((Date.now() - t0) / 1000) };
  }

  // ---- live: the KPI object first (a missing write scope stops here), then the companies
  const errors: string[] = [];
  for (const s of plan.series) {
    const r = await kpiUpsert(s.cat, s.rows, existing.get(s.cat)!, beat);
    Object.assign(kpi[s.cat], r);
    out[s.cat === "forecast_monthly" ? "forecast_written" : s.cat] = r.updated + r.created;
    errors.push(...r.errors);
    if (s.cat === "forecast_monthly") {
      const t = tally();
      await writeBatches(KPI_OBJECT, "update", realign.map((x) => ({ id: x.id, properties: { metric_value: x.metric_value } })), `KPI ${REALIGN_CATEGORY}`, t, beat);
      out.revenue_monthly_realigned = t.written;
      errors.push(...t.errors);
    }
  }
  const co = tally();
  await writeBatches("companies", "update", plan.companies.map((c) => companyInput(c.id, c.properties)), "companies", co, beat);
  Object.assign(out, { companies_updated: co.written, companies_failed: co.failed });
  errors.push(...co.errors);
  if (errors.length) out.errors = errors.slice(0, 10);
  return { ...out, seconds: Math.round((Date.now() - t0) / 1000) };
}

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
import { unpackFacts } from "./productFactsRules";
import { saveErpLines } from "@/lib/reporting/boErpLinesStore";
import { saveOrderBook } from "@/lib/reporting/orderBookStore";
import { loadOtdHistory, otdDates, otdTransport, saveOtdFromErp } from "@/lib/reporting/otdStore";
import { otdArticleInfo } from "@/lib/reporting/otdArticles";
import { otdDirectCutKinds } from "@/lib/reporting/otdDirectCut";
import { fetchFiles } from "@/lib/connectors/sftp";
import { saveSealing } from "@/lib/apHub/sealingStore";
import path from "node:path";
import { query } from "@/lib/db/client";
import { ownerNames } from "@/lib/integrations/erosion";
import { SHEET_INVOICES, invoiceFacts, lineFacts } from "./orderFactsRules";
import { saveErpFacts } from "./orderFactsStore";
import { loadProductIds, productFactsRun } from "./productFacts";

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
const companyInput = (id: string, p: Record<string, number | string | null>) => ({
  id, properties: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === null ? "" : v])) as Record<string, Value>,
});

/* ── the step ──────────────────────────────────────────────────────────── */

export async function erpRevenue(live: boolean, beat: Beat, opts: ErpRevenueOpts): Promise<StepResult> {
  const t0 = Date.now();
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));

  // the whole file first: a layout change or a wrong file stops the run before HubSpot
  // HubSpot's articles, read only once the workbook shows an articles sheet (by name or by its columns): the sheet keeps
  // only those (~227,000 of ~860,000)
  let productIds: Awaited<ReturnType<typeof loadProductIds>> | null = null, productIdsError = "";
  const wb = await readErpWorkbook(opts.file, beat, {
    articleFilter: async () => {
      productIds = await loadProductIds(beat).catch((e) => { productIdsError = String((e as Error)?.message ?? e); return null; });
      const ids = productIds?.ids;
      return ids ? (a) => ids.has(a) : () => false;
    },
  });
  const carriesArticles = !!wb.kpiSheets.articles;
  const data = wb.customers.customers;
  const { month, rows } = customerPlan(data);
  const out: StepResult = {
    file: wb.file, mb: wb.mb, sheets: wb.sheets, rows_read: wb.rows, read_seconds: wb.seconds,
    customers: data.size, month, pivots: wb.customers.pivots, dry_run: !live, kpi_sheets: wb.kpiSheets,
  };
  if (!data.size) throw new Error(`${wb.file}: no customer carries a figure - an empty or unfinished export, nothing written`);
  // the Back Office's KPIs from the "KPI LINES" sheet (pass rate, manual prices, OTD) - kept before HubSpot, never its problem
  if (!wb.erpLines) out.erp_lines = wb.kpiSheets.lines ? "sheet without the expected header" : "no order-lines sheet";
  else if (!live) out.erp_lines = { lines: wb.erpLines.lines.length, rows: wb.erpLines.rows, kept: false };
  else {
    // each article's main supplier from the articles sheet of the same workbook (OTD per supplier), and - once the
    // lines carry the customer - each customer's company owner in HubSpot (the manual prices per owner)
    const arts = wb.articles;
    const supplierOf = arts ? (a: string) => unpackFacts(arts.get(a) ?? "").main_supplier : undefined;
    const customers = [...new Set(wb.erpLines.lines.map((l) => l.customer ?? "").filter(Boolean))];
    const who = customers.length ? await customerOwners(customers).catch(() => undefined) : undefined;
    const ownerOf = who?.ownerOf;
    try { out.erp_lines = { ...(await saveErpLines(wb.erpLines.lines, { supplierOf, ownerOf }, articleTexts)), rows: wb.erpLines.rows, kept: true, customers: customers.length }; }
    catch (e) { out.erp_lines = `not kept: ${(e as Error).message}`; }
    // OTD Reports: the same lines by the OTD analysis file's rules (SARCLA 09.11.2026) - never the step's problem
    const plan = wb.articlePlanning;
    try {
      // each customer's transport days (otd_transport.csv beside the workbook, kept) - without them the country's - and the
      // ERP's dates of the OTD analysis file (otd_dates.csv, kept)
      const dir = path.dirname(opts.file);
      const notRead = (e: unknown) => ({ days: undefined, status: `not read: ${(e as Error)?.message ?? e}` });
      const [tr, fd] = await Promise.all([otdTransport(dir).catch(notRead), otdDates(dir).catch(notRead)]);
      const days = tr.days, fileDays = fd.days;
      // each article's text and product group from the nightly article master beside the workbook (dim_article.csv) - a run
      // from the page on a copy started since the delivery has only the workbook: the master is fetched from the ERP's folder
      // (read-only, the download record untouched; SARCLA 11.11.2026 "count it directly")
      const fetchMissing = process.env.SFTP_KEY ? (name: string) => fetchFiles(dir, [name]).then((r) => r.error ?? (r.pulled.length ? null : `${name} is not in the ERP's folder`)) : undefined;
      const ai = await otdArticleInfo(dir, wb.erpLines.lines.map((l) => l.article), beat, fetchMissing)
        .catch((e: unknown) => ({ infoOf: undefined, status: `not read: ${(e as Error)?.message ?? e}` }));
      // GLC's lines of DirectCut orders: a leftover off the shelf or cut on the saw (the DirectCut middleware, kept)
      const dc = await otdDirectCutKinds().catch((e: unknown) => ({ glcOf: undefined, status: `not read: ${(e as Error)?.message ?? e}` }));
      out.otd = {
        ...(await saveOtdFromErp(wb.erpLines.lines, {
          supplierOf, planningOf: plan ? (a) => plan.get(a) : undefined,
          customerOf: who ? (c) => ({ name: who.nameOf(c), owner: who.ownerOf(c) }) : undefined,
          customerDaysOf: days ? (c) => days.get(c) : undefined,
          fileDateOf: fileDays ? (k) => fileDays.get(k) : undefined,
          infoOf: ai.infoOf, glcOf: dc.glcOf,
        })),
        transport_file: tr.status, dates_file: fd.status, articles_file: ai.status, directcut: dc.status,
      };
    }
    catch (e) { out.otd = `not kept: ${(e as Error).message}`; }
  }
  // OTD Reports' history: the OTD analysis file's lines (otd_history.csv), when one was dropped beside the workbook
  if (live) out.otd_history = await loadOtdHistory(path.dirname(opts.file)).catch((e: unknown) => `not read: ${(e as Error)?.message ?? e}`);
  // the Angst+Pfister hub's Sealing Business Review (src/lib/apHub): the group's DT invoices, kept whole each morning -
  // never the step's problem
  if (wb.sealing) {
    out.ap_sealing = !live ? { rows: wb.sealing.rows.length, skipped: wb.sealing.skipped, kept: false }
      : await saveSealing(wb.sealing.rows, { file: wb.file, sheet: wb.kpiSheets.sealing, skipped: wb.sealing.skipped })
        .catch((e: unknown) => `not kept: ${(e as Error)?.message ?? e}`);
  } else if (wb.kpiSheets.sealing) out.ap_sealing = "sheet without the expected header";
  // the order facts the sheets give (first confirmed date, special articles, the invoice) - order_sync writes them at night
  if (wb.erpLines || wb.invoices) {
    const byBase = wb.erpLines ? lineFacts(wb.erpLines.lines) : new Map(), byOrder = wb.invoices ? invoiceFacts(wb.invoices) : new Map();
    // the deliveries invoiced, by the invoice's year - the history (2020 on) shows here the morning it comes
    const byYear: Record<string, number> = {};
    for (const f of byOrder.values()) { const y = (f.order_invoice_date ?? "").slice(0, 4) || "no date"; byYear[y] = (byYear[y] ?? 0) + 1; }
    if (!live) out.order_facts = { orders: byBase.size, deliveries_invoiced: byOrder.size, by_invoice_year: byYear, kept: false };
    else {
      try { out.order_facts = { ...(await saveErpFacts(byBase, byOrder)), by_invoice_year: byYear, kept: true }; }
      catch (e) { out.order_facts = `not kept: ${(e as Error).message}`; }
    }
  } else out.order_facts = wb.sheets.some((s) => s.trim().toUpperCase().startsWith(SHEET_INVOICES)) ? "KPI INVOICES without the expected header" : "no KPI LINES or KPI INVOICES sheet";
  // the ERP's order book for My Sales Reports' targets (../../reporting/orderBookRules.ts) - kept before HubSpot, never its problem
  if (wb.orderBook) {
    if (!live) out.order_book = { rows: wb.orderBook.rows, customers: wb.orderBook.customers, total_eur: wb.orderBook.total, kept: false };
    else {
      try { out.order_book = await saveOrderBook(wb.orderBook, wb.file); }
      catch (e) { out.order_book = `not kept: ${(e as Error).message}`; }
    }
  } else out.order_book = wb.orderBookError ? `not read: ${wb.orderBookError}` : wb.kpiSheets.orderBook ? "sheet without the expected header" : "no order book sheet";
  // the products' ERP fields (GWStdP, stock value, material ... - ./productFactsRules.ts): counted, and written once switched on
  // (set inside the reader's callback - read back through a cast, TypeScript cannot follow the assignment there)
  const copy = productIds as Awaited<ReturnType<typeof loadProductIds>> | null;
  if (wb.articles && copy) {
    try { out.product_facts = { ...(await productFactsRun(wb.articles, copy, live, beat)), hubspot_articles_copied: copy.refreshed }; }
    catch (e) { out.product_facts = `not run: ${(e as Error).message}`; }
  } else if (carriesArticles) out.product_facts = `not run: HubSpot's articles could not be read - ${productIdsError || "no article sheet"}`;
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

/** Each customer (CustomerNumberUnique, "100-12345") -> its company's owner in HubSpot, by name: the revenue step's own
 *  customer -> company map (apsomh_cx_un2id), the companies' owner read 100 a call, the owners' names. */
async function customerOwners(customers: string[]): Promise<{ ownerOf: (customer: string) => string | undefined; nameOf: (customer: string) => string | undefined }> {
  const r = await query<{ un: string; company_id: string }>("SELECT un, company_id FROM apsomh_cx_un2id WHERE un = ANY($1::text[])", [customers]);
  const companyOf = new Map(r.rows.map((x) => [x.un, String(x.company_id)]));
  const ids = [...new Set(companyOf.values())];
  const ownerOfCompany = new Map<string, string>(), nameOfCompany = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hubspotFetchJson<{ results?: { id: string | number; properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["hubspot_owner_id", "name"] },
    });
    for (const o of j.results ?? []) {
      const own = o.properties?.hubspot_owner_id, nm = o.properties?.name;
      if (own) ownerOfCompany.set(String(o.id), own);
      if (nm) nameOfCompany.set(String(o.id), nm);
    }
  }
  const names = await ownerNames();
  return {
    ownerOf: (c) => { const co = companyOf.get(c); const own = co ? ownerOfCompany.get(co) : undefined; return own ? names.get(own) ?? own : undefined; },
    nameOf: (c) => { const co = companyOf.get(c); return co ? nameOfCompany.get(co) : undefined; },
  };
}

/** Articles -> their description in HubSpot's Products & Pricing (article_description), 100 a search. */
async function articleTexts(articles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < articles.length; i += 100) {
    const j = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/2-200042439/search", method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: articles.slice(i, i + 100) }] }], properties: ["article_number", "article_description"], limit: 100 },
    });
    for (const o of j.results ?? []) { const a = (o.properties?.article_number ?? "").trim(), t = (o.properties?.article_description ?? "").trim(); if (a && t) out.set(a, t); }
  }
  return out;
}

// ARTICLES CY/LY - building the report and keeping it.
//
// A build reads every order from January of last year to today (the erosion
// detector's reader, month by month), counts each order once per article (see
// ../articles/model.ts), fills descriptions and profit centres the order lines
// lack from the Products & Pricing catalogue, and the buyers' countries from
// their companies. It takes minutes, so it runs in the background behind a
// Postgres advisory lock (production runs two copies of the hub) and writes
// its progress where either copy can read it. The finished report lives in
// the hub's kv; the server keeps the parsed copy in memory until a newer one lands.
//
// Since SARCLA's "Articles rebuilt like Figures" (01.11.2026) a build also reads
// every article's place in Products & Pricing - main group, sub group, product -
// and keeps, beside the report, who bought each article: the buyer's customer
// number, its HubSpot company (found by that number, as the countries always
// were) and its revenue on the article - so every graph can list its companies.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { IntegrationError } from "./status";
import { hubspotFetchJson } from "./hubspot";
import fixmapJson from "../erosion/article_fixmap.json";
import {
  aggregate, buyersOf, fillFromCatalogue, kpis, lines, needsCatalogue, rowsOf,
  type ArticleRow, type BuyerCompany, type Buyers, type Doc, type FixMap, type Kpis,
} from "../articles/model";

const FIXMAP = fixmapJson as unknown as FixMap;
const PP_OBJ = "2-200042439";
const LOCK = 4_107_203;
const KV = { report: "articles:report", meta: "articles:report:meta", status: "articles:build", buyers: "articles:report:buyers" } as const;
/** A "running" status older than this is a build that died with its process. */
const STALE_MS = 45 * 60_000;

export type ArticleReport = {
  generated: string;
  cy: number;
  ly: number;
  /** The day the build ran - "this year to date" ends here, last year's same days too. */
  today: string;
  ordersRead: number;
  rows: ArticleRow[];
  kpis: Kpis;
  /** The same orders summed document by document, as the connector did - for the note on screen. */
  documentsBasis: { totalCy: number; totalLyYtd: number; totalLy: number };
  catalogueFilled: number;
  buyersWithCountry: number;
  /** every article's main group, sub group and product read from Products & Pricing (01.11.2026) - absent before */
  hierarchy?: boolean;
  /** the buyers of each article kept beside it (KV.buyers, the same `generated`) - absent before 01.11.2026 */
  buyers?: boolean;
};

export type BuildStatus = {
  status: "idle" | "running" | "done" | "error";
  step: string;
  done: number;
  total: number;
  started: string | null;
  finished: string | null;
  error: string | null;
  trigger: string | null;
  heartbeat: string | null;
};

const IDLE: BuildStatus = { status: "idle", step: "", done: 0, total: 0, started: null, finished: null, error: null, trigger: null, heartbeat: null };

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const utcToday = () => new Date().toISOString().slice(0, 10);

/* ── what is stored ────────────────────────────────────────────────────── */

let mem: { generated: string; report: ArticleReport } | null = null;

/** The latest report, parsed once per build - the big kv row is only read when a newer one exists. */
export async function loadReport(): Promise<ArticleReport | null> {
  const meta = await kvGet<{ generated: string }>(KV.meta);
  if (!meta?.generated) return null;
  if (mem?.generated === meta.generated) return mem.report;
  const report = await kvGet<ArticleReport>(KV.report);
  if (!report) return null;
  mem = { generated: report.generated, report };
  return report;
}

export async function buildStatus(): Promise<BuildStatus> {
  const s = (await kvGet<BuildStatus>(KV.status)) ?? IDLE;
  if (s.status === "running" && s.heartbeat && Date.now() - Date.parse(s.heartbeat) > STALE_MS) {
    return { ...s, status: "error", error: "The build stopped without finishing (the server restarted). Start it again." };
  }
  return s;
}

/** The buyers kept beside the report they were built with - none for a report built before them. */
let memBuyers: Buyers | null = null;
export async function loadBuyers(report: ArticleReport): Promise<Buyers | null> {
  if (!report.buyers) return null;
  if (memBuyers?.generated === report.generated) return memBuyers;
  const b = await kvGet<Buyers>(KV.buyers);
  if (!b || b.generated !== report.generated) return null;
  memBuyers = b;
  return b;
}

/* ── the build ─────────────────────────────────────────────────────────── */

type Catalogued = { article: string; description: string; pc: string; group: string; sub: string; product: string; productName: string };
/** Products & Pricing ends its descriptions with " -" ("... 7.00 mm -") - as the shop report reads them. */
const ppText = (v: unknown) => str(v).trim().replace(/\s+-$/, "");

/** Every article's description, profit centre and place in Products & Pricing - 100 article numbers a search, every page of
 *  the answer (an article can be there more than once). */
async function catalogue(articles: string[], progress: (done: number) => void = () => {}): Promise<Catalogued[]> {
  const out: Catalogued[] = [];
  for (let i = 0; i < articles.length; i += 100) {
    const chunk = articles.slice(i, i + 100);
    try {
      let after: string | undefined;
      for (let page = 0; page < 10; page++) {
        const r = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[]; paging?: { next?: { after?: string } } }>({
          path: `/crm/v3/objects/${PP_OBJ}/search`, method: "POST", useTicketsToken: true,
          body: {
            filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: chunk }] }],
            properties: ["article_number", "article_description", "profit_center", "main_group_description", "sub_group_description", "product_number", "product_description"],
            limit: 100, ...(after ? { after } : {}),
          },
        });
        for (const o of r.results ?? []) {
          const p = o.properties ?? {};
          out.push({
            article: str(p.article_number).trim(), description: str(p.article_description), pc: str(p.profit_center),
            group: ppText(p.main_group_description), sub: ppText(p.sub_group_description), product: str(p.product_number).trim(), productName: ppText(p.product_description),
          });
        }
        after = r.paging?.next?.after;
        if (!after) break;
      }
    } catch (e) {
      // a page of descriptions is not worth the report - as the connector, skip it
      console.warn(`[articles] catalogue page skipped: ${(e as Error).message}`);
    }
    progress(Math.min(i + 100, articles.length));
  }
  return out;
}

/** "100-712345" -> its HubSpot company: id, name and country, searched 100 customer numbers at a time. */
async function companies(uns: string[], progress: (done: number) => void = () => {}): Promise<Map<string, BuyerCompany>> {
  const out = new Map<string, BuyerCompany>();
  for (let i = 0; i < uns.length; i += 100) {
    try {
      const r = await hubspotFetchJson<{ results?: { id?: string; properties?: Record<string, string | null> }[] }>({
        path: "/crm/v3/objects/companies/search", method: "POST", useTicketsToken: true,
        body: {
          filterGroups: [{ filters: [{ propertyName: "company_unique_number", operator: "IN", values: uns.slice(i, i + 100) }] }],
          properties: ["company_unique_number", "country_custom", "country", "name"], limit: 100,
        },
      });
      for (const o of r.results ?? []) {
        const un = str(o.properties?.company_unique_number).trim();
        // the Datatracker's country list is country_custom; the free-text field only when that is empty
        const c = (str(o.properties?.country_custom).trim() || str(o.properties?.country).trim());
        // a customer number on two companies: the first, unless only a later one has a country (as before)
        const was = out.get(un);
        if (un && (!was || (!was.country && c))) out.set(un, { id: str(o.id), name: str(o.properties?.name).trim(), country: c.slice(0, 24) });
      }
    } catch (e) {
      console.warn(`[articles] company page skipped: ${(e as Error).message}`);
    }
    progress(Math.min(i + 100, uns.length));
  }
  return out;
}

async function setStatus(s: Partial<BuildStatus>) {
  const cur = (await kvGet<BuildStatus>(KV.status)) ?? IDLE;
  await kvSet(KV.status, { ...cur, ...s, heartbeat: new Date().toISOString() });
}

/**
 * Every order document from January of last year to today, month by month, each
 * page reduced at once to what the report needs (number, day, customer, parsed
 * lines) - the raw JSON of 100,000 documents is never held. A failed page stops
 * the build and a month over HubSpot's 10,000-result cap refuses to start: a
 * partial read would publish revenue that is simply missing.
 */
async function pullDocs(today: string, progress: (done: number, total: number, month: string) => void): Promise<Doc[]> {
  const out: Doc[] = [];
  let y = Number(today.slice(0, 4)) - 1, m = 1;
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const total = (ty - y) * 12 + tm;
  let done = 0;
  while (y < ty || (y === ty && m <= tm)) {
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    let after: string | undefined;
    for (let page = 0; ; page++) {
      const res = await hubspotFetchJson<{ total?: number; results?: { properties?: Record<string, unknown> }[]; paging?: { next?: { after?: string } } }>({
        path: "/crm/v3/objects/orders/search", method: "POST", useTicketsToken: true,
        body: {
          filterGroups: [{ filters: [
            { propertyName: "order_order_date", operator: "GTE", value: String(Date.UTC(y, m - 1, 1)) },
            { propertyName: "order_order_date", operator: "LT", value: String(Date.UTC(ny, nm - 1, 1)) },
          ] }],
          properties: ["order_order_number", "order_order_date", "order_positions_json", "order_customer_number", "order_mandant"],
          limit: 100,
          ...(after ? { after } : {}),
        },
      });
      if (page === 0 && (res.total ?? 0) > 10_000) {
        throw new IntegrationError(`Orders ${y}-${String(m).padStart(2, "0")}: ${res.total} exceed the 10,000 search cap - refusing a truncated report.`);
      }
      for (const r of res.results ?? []) {
        const p = r.properties ?? {};
        const mand = str(p.order_mandant).trim();
        const cust = str(p.order_customer_number).trim();
        out.push({
          no: str(p.order_order_number).trim(),
          date: str(p.order_order_date).slice(0, 10),
          un: mand && cust ? `${mand}-${cust}` : null,
          lines: lines(p.order_positions_json, FIXMAP),
        });
      }
      after = res.paging?.next?.after;
      if (!after) break;
    }
    progress(++done, total, `${y}-${String(m).padStart(2, "0")}`);
    [y, m] = [ny, nm];
  }
  return out;
}

/** Read the orders and build the report - and, read with it, who bought each article. Pure work - no lock, no status: the
 *  runner below adds those. */
export async function computeReport(
  today = utcToday(),
  progress: (step: string, done: number, total: number) => void = () => {},
  opts: { enrich?: boolean } = {},
): Promise<{ report: ArticleReport; buyers: Buyers }> {
  const cy = Number(today.slice(0, 4));
  const ly = cy - 1;
  const docs = await pullDocs(today, (done, total, month) => progress(`reading orders - ${month}`, done, total));

  const o = { cy, ly, today };
  const agg = aggregate(docs, { ...o, basis: "orders" });
  const old = kpis(rowsOf(aggregate(docs, { ...o, basis: "documents" })));

  let filled = 0;
  let byCompany = new Map<string, BuyerCompany>();
  const hier = new Map<string, Pick<Catalogued, "group" | "sub" | "product" | "productName">>();
  const enrich = opts.enrich !== false;
  if (enrich) {
    // every article, not only those missing a text: the hierarchy is read for all of them
    const need = new Set(needsCatalogue(agg));
    const all = [...agg.keys()];
    const step = "reading descriptions and the product hierarchy from the catalogue";
    progress(step, 0, all.length);
    const cat = await catalogue(all, (done) => progress(step, done, all.length));
    filled = cat.filter((c) => need.has(c.article) || need.has(c.article.replace(/^0+/, ""))).length;
    fillFromCatalogue(agg, cat);
    for (const c of cat) {
      if (!c.article) continue;
      const h = { group: c.group, sub: c.sub, product: c.product, productName: c.productName };
      // an article listed twice: the record that names its product
      for (const k of new Set([c.article, c.article.replace(/^0+/, "")])) if (!hier.get(k)?.product) hier.set(k, h);
    }
    const uns = [...new Set(docs.map((d) => d.un).filter((u): u is string => !!u))];
    progress("finding the buyers' companies", 0, uns.length);
    byCompany = await companies(uns, (done) => progress("finding the buyers' companies", done, uns.length));
  }

  const generated = new Date().toISOString();
  const rows = rowsOf(agg, (un) => byCompany.get(un)?.country || null);
  if (enrich) for (const r of rows) Object.assign(r, { group: "", sub: "", product: "", productName: "", ...hier.get(r.article) });
  const report: ArticleReport = {
    generated, cy, ly, today, ordersRead: docs.length, rows, kpis: kpis(rows),
    documentsBasis: { totalCy: old.totalCy, totalLyYtd: old.totalLyYtd, totalLy: old.totalLy },
    catalogueFilled: filled, buyersWithCountry: [...byCompany.values()].filter((c) => c.country).length,
    hierarchy: enrich, buyers: true,
  };
  return { report, buyers: buyersOf(agg, generated, (un) => byCompany.get(un)) };
}

let runningHere = false;

/** Start a build in the background; false when one is already running (here or on the other copy). */
export async function startBuild(trigger: string): Promise<{ started: boolean; note: string }> {
  const s = await buildStatus();
  if (runningHere || s.status === "running") return { started: false, note: "a build is already running" };
  runningHere = true;
  void runBuild(trigger).finally(() => { runningHere = false; });
  return { started: true, note: "building - a few minutes" };
}

async function runBuild(trigger: string): Promise<void> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) {
      // another job holds the lock (the other copy building, or a job sharing the id) - never in silence
      console.log(`[articles] build (${trigger}) not started: the lock is held elsewhere - the next tick tries again`);
      return;
    }
    try {
      const started = new Date().toISOString();
      await kvSet(KV.status, { ...IDLE, status: "running", step: "starting", started, trigger, heartbeat: started });
      let last = 0;
      const { report, buyers } = await computeReport(utcToday(), (step, done, total) => {
        // the status row is written at most every few seconds, not on every page
        if (Date.now() - last < 3000) return;
        last = Date.now();
        void setStatus({ step, done, total });
      });
      // the buyers first: the report's meta row is what makes a new build the one read
      await kvSet(KV.buyers, buyers);
      await kvSet(KV.report, report);
      await kvSet(KV.meta, { generated: report.generated });
      mem = { generated: report.generated, report };
      memBuyers = buyers;
      await setStatus({ status: "done", step: `${report.rows.length.toLocaleString("en")} articles from ${report.ordersRead.toLocaleString("en")} order documents`, finished: new Date().toISOString(), error: null });
      console.log(`[articles] report built (${trigger}): ${report.rows.length} articles, ${report.ordersRead} documents`);
    } catch (e) {
      const error = (e as Error).message;
      console.warn(`[articles] build failed (${trigger}): ${error}`);
      await setStatus({ status: "error", error, finished: new Date().toISOString() }).catch(() => {});
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

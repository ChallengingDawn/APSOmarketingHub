// ENGAGEMENTS - the read (the rules are in engageCube.ts). GA4: engagement per month (exact, and per month x
// country x channel), the article views and the articles bought per month, the tools' and the site
// search's events; Products & Pricing ties a viewed product and a bought article to each other and to
// their profit centre; the search bar's own log through its gateway (searches, those that found nothing,
// the last searches one by one); each configurator's own count (DirectCut, DirectUP, the shop tools'
// gateways); why logged-in customers did not buy, from the live shop tracker (the Datatracker's rules).
// A year per GA4 call (the hub asks GA4 for 365 days at most). A minute or two; read every 6 hours.

import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { fetchShopSignals } from "@/lib/integrations/shopSignals";
import { kvGet, kvSet } from "@/lib/db/init";
import { gateway, type Gaps, type LogRow, type Report } from "@/lib/searchbar/gateway";
import { gateway as directUp, type Usage } from "@/lib/directup/gateway";
import { gateway as directCut } from "@/lib/directcut/gateway";
import type { RawPipeline } from "@/lib/directcut/board";
import { toolGateway } from "@/lib/shopTools/gateway";
import { SHOP_TOOLS, type ShopToolKey, type ToolUsage } from "@/lib/shopTools/tools";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { searchSample, viewPage, type EngageData, type MoqRow, type ShelfRow, type ToolCount } from "./engageCube";

const KEY = "marketingKpis:engage:v2";
const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 30 * 60 * 1000;
/** the live shop tracker writes the company's days since then - the price checks start there */
const TRACKER_SINCE = "2026-09-30";
/** what Products & Pricing said of a product (its profit centre) and of an article (its product) - they do not change, so they are kept */
const PRODUCT_PC = "marketingKpis:productPc:v1";
const ARTICLE_PRODUCT = "marketingKpis:articleProduct:v1";
const PP = "/crm/v3/objects/2-200042439/search";

export function engageData(): Promise<SlowState<EngageData>> {
  return slowReport(KEY, (v: EngageData) => (Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS : TTL_MS), build);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (k: string) => (/^\d{6}$/.test(k) ? `${k.slice(0, 4)}-${k.slice(4, 6)}` : k.slice(0, 7));
const countryOf = (k: string | undefined) => { const c = (k ?? "").toUpperCase(); return c === "(NOT SET)" ? "" : c; };
type PpRow = { properties?: Record<string, string | null> };

/**
 * Products & Pricing for the products and articles the hub has not asked about before: a product's profit
 * centre (any of its articles carries it), an article's product. "" = asked, not there.
 */
async function lookUp(products: string[], articles: string[]): Promise<{ pc: Record<string, string>; product: Record<string, string> }> {
  const pc = (await kvGet<Record<string, string>>(PRODUCT_PC)) ?? {};
  const product = (await kvGet<Record<string, string>>(ARTICLE_PRODUCT)) ?? {};
  // the articles first: each also says its product's profit centre
  const newArticles = articles.filter((a) => !(a in product));
  for (let i = 0; i < newArticles.length; i += 100) {
    if (i % 2000 === 0) reportProgress(KEY, `Products & Pricing: the articles bought, ${i} of ${newArticles.length}`);
    const slice = newArticles.slice(i, i + 100);
    const r = await hubspotFetchJson<{ results?: PpRow[] }>({ path: PP, method: "POST", body: { filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: slice }] }], properties: ["article_number", "product_number", "profit_center"], limit: 100 } });
    for (const a of slice) product[a] = "";
    for (const x of r.results ?? []) {
      const a = x.properties?.article_number, p = x.properties?.product_number;
      if (!a) continue;
      product[a] = p ?? "";
      if (p && !pc[p] && x.properties?.profit_center) pc[p] = x.properties.profit_center;
    }
    if (i % 2000 === 1900) await kvSet(ARTICLE_PRODUCT, product);
  }
  // the products: a search for 100 at once answers their articles, a hundred at a time - those that come
  // back are known, the rest are asked again; when every match has come back, the rest are not there
  let left = products.filter((p) => !(p in pc));
  for (let calls = 0; left.length && calls < 400; calls++) {
    if (calls % 20 === 0) reportProgress(KEY, `Products & Pricing: the products viewed, ${left.length} to go`);
    const batch = left.slice(0, 100);
    const r = await hubspotFetchJson<{ total?: number; results?: PpRow[] }>({ path: PP, method: "POST", body: { filterGroups: [{ filters: [{ propertyName: "product_number", operator: "IN", values: batch }] }], properties: ["product_number", "profit_center"], limit: 100 } });
    let got = 0;
    for (const x of r.results ?? []) { const p = x.properties?.product_number; if (p && !pc[p]) { pc[p] = x.properties?.profit_center ?? ""; got++; } }
    const all = (r.total ?? 0) <= 100;
    if (all) for (const p of batch) if (!(p in pc)) pc[p] = "";
    left = left.filter((p) => !(p in pc));
    if (!got && !all) break;
  }
  await kvSet(PRODUCT_PC, pc);
  await kvSet(ARTICLE_PRODUCT, product);
  return { pc, product };
}

async function build(): Promise<EngageData> {
  const now = new Date();
  const year = now.getUTCFullYear(), py = year - 1;
  const monthsDone = now.getUTCMonth();
  const errors: Record<string, string> = {};
  const guard = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { errors[name] = String((e as Error)?.message ?? e).slice(0, 300); }
  };
  const ranges: [string, string][] = [[`${py}-01-01`, `${py}-12-31`], [`${year}-01-01`, iso(now)]];

  const months: EngageData["months"] = {};
  await guard("months", async () => {
    reportProgress(KEY, "reading GA4 engagement per month");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "engageMonthly", from, to });
      for (const row of r.rows) months[monthKey(row.keys[0] ?? "")] = [row.values[0] ?? 0, row.values[1] ?? 0, row.values[2] ?? 0, row.values[3] ?? 0];
    }
  });

  const channels: string[] = [];
  const cube: EngageData["cube"] = [];
  await guard("cube", async () => {
    reportProgress(KEY, "reading GA4 engagement by country and channel");
    const idx = (c: string) => { let i = channels.indexOf(c); if (i < 0) { i = channels.length; channels.push(c); } return i; };
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "engageCube", from, to });
      for (const row of r.rows) cube.push([monthKey(row.keys[0] ?? ""), countryOf(row.keys[1]), idx(row.keys[2] || "(not set)"), row.values[0] ?? 0, row.values[1] ?? 0, row.values[2] ?? 0, row.values[3] ?? 0]);
    }
  });

  const views: EngageData["views"] = {};
  await guard("views", async () => {
    reportProgress(KEY, "reading GA4 article views");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "viewItemMonthly", from, to });
      for (const row of r.rows) views[monthKey(row.keys[0] ?? "")] = [row.values[0] ?? 0, row.values[1] ?? 0];
    }
  });

  // the pages viewed - category lists by profit centre, product pages by product - and the articles bought,
  // month by month, tied together by Products & Pricing
  const products: EngageData["products"] = {};
  const lists: EngageData["lists"] = {};
  const madeToOrder: number[] = Array(24).fill(0);
  const boughtPc: EngageData["bought"] = {};
  let unmapped = 0;
  await guard("products", async () => {
    reportProgress(KEY, "reading GA4 pages viewed and articles bought");
    const slot = (m: string) => (m.startsWith(String(year)) ? 12 : m.startsWith(String(py)) ? 0 : -1) + Number(m.slice(5, 7)) - 1;
    const bought: [number, string][] = [];
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "viewItemPages", from, to });
      for (const row of r.rows) {
        const i = slot(monthKey(row.keys[0] ?? "")), n = row.values[0] ?? 0;
        if (i < 0 || i > 23 || !n) continue;
        const pg = viewPage(row.keys[1] ?? "");
        if (pg.kind === "product") (products[pg.product] ??= { n: "", pc: null, v: Array(24).fill(0) }).v[i] += n;
        else (lists[pg.kind === "list" ? pg.pc : pg.kind] ??= Array(24).fill(0))[i] += n;
      }
      const b = await fetchGa4Report({ name: "itemsMonthly", from, to });
      for (const row of b.rows) {
        const i = slot(monthKey(row.keys[0] ?? "")), id = row.keys[1] ?? "";
        if (i < 0 || i > 23 || !(row.values[0] ?? 0) || !/^\d{10}$/.test(id)) continue;
        if (id.startsWith("8001")) madeToOrder[i]++; else bought.push([i, id]);
      }
    }
    // a name per product: the store language it was viewed in most - this year's, else last year's
    for (const [from, to] of [...ranges].reverse()) {
      const names = await fetchGa4Report({ name: "topItemsViewed", from, to });
      for (const row of names.rows) { const p = products[row.keys[1] ?? ""]; if (p && !p.n) p.n = row.keys[0] || ""; }
    }
    const { pc, product } = await lookUp(Object.keys(products), [...new Set(bought.map(([, a]) => a))]);
    for (const [id, p] of Object.entries(products)) p.pc = pc[id] || null;
    for (const [i, a] of bought) {
      const p = products[product[a] ?? ""];
      if (p) (p.b ??= Array(24).fill(0))[i]++;
      else if (!product[a]) unmapped++;
      // every article bought counts for its profit centre, its product page viewed or not
      (boughtPc[pc[product[a] ?? ""] || "other"] ??= Array(24).fill(0))[i]++;
    }
  });

  const events: EngageData["events"] = {};
  await guard("events", async () => {
    reportProgress(KEY, "reading GA4 tool and search events");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "engageEvents", from, to });
      for (const row of r.rows) (events[monthKey(row.keys[0] ?? "")] ??= {})[row.keys[1] ?? ""] = [row.values[0] ?? 0, row.values[1] ?? 0];
    }
  });

  // the search bar's own log: every search, consent or not - and whether it found something
  let search: EngageData["search"] = null;
  await guard("search", async () => {
    reportProgress(KEY, "reading the search bar's log");
    const r = await gateway<Report>("/api/smart-bar/report?days=365", { timeoutMs: 60_000 });
    // the gateway also answers the raw text and every language of a gap
    type GapRow = Gaps["gaps"][number] & { top_query_raw?: string; locales?: string[] };
    const g = await gateway<{ gaps: GapRow[] }>("/api/smart-bar/gaps?window=30d", { timeoutMs: 60_000 }).catch(() => null);
    // the last searches one by one - what those that found nothing were
    const log = await gateway<LogRow[]>("/api/smart-bar/logs?limit=2000", { timeoutMs: 60_000 }).catch(() => null);
    const byMonth: Record<string, [number, number]> = {};
    for (const x of r.by_day ?? []) { const m = String(x.day).slice(0, 7); const a = (byMonth[m] ??= [0, 0]); a[0] += x.searches ?? 0; a[1] += x.ok ?? 0; }
    search = {
      days: r.days, since: r.by_day?.[0]?.day ? String(r.by_day[0].day).slice(0, 10) : null, total: r.settled_searches ?? 0, zero: r.zero_result_searches ?? 0, byMonth,
      byLocale: (r.by_locale ?? []).map((x) => ({ locale: x.locale, searches: x.searches, ok: x.ok })),
      top: (r.keywords_top ?? []).slice(0, 60).map((x) => ({ query: x.query, searches: x.searches, found: Math.round((x.searches * (x.success_pct ?? 0)) / 100) })),
      // a pasted e-mail signature can land in the bar: the text is cut short
      gaps: (g?.gaps ?? []).slice(0, 40).map((x) => ({ query: String(x.top_query_raw || x.query_norm).replace(/\s+/g, " ").trim().slice(0, 90), count: x.count, last: String(x.last_seen).slice(0, 10), locales: x.locales ?? (x.locale ? [x.locale] : []) })),
      sample: Array.isArray(log) ? searchSample(log.map((l) => ({ text: l.query_raw ?? "", norm: l.query_norm ?? "", locale: l.locale ?? "", hits: l.hit_count ?? 0, at: l.created_at ?? "" })).filter((l) => l.at)) : null,
    };
  });

  // each configurator's own count (SARCLA 19.10: "a mini graph per micro service")
  const tools: ToolCount[] = [];
  reportProgress(KEY, "reading the configurators' own counts");
  {
    const t: ToolCount = { key: "directcut", name: "DirectCut", what: "Plastic parts cut to size - each cut line it took, and those ordered", source: "DirectCut's own ledger", since: null, unit: "Cut lines", unit2: "Ordered", days: [], onShop: true };
    try {
      const p = await directCut<RawPipeline>("/admin/pipeline", 40_000);
      const byDay: Record<string, [number, number]> = {};
      for (const [stage, lines] of Object.entries(p.stages ?? {})) {
        for (const l of lines ?? []) {
          const day = String(l.createdAt ?? "").slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
          const a = (byDay[day] ??= [0, 0]);
          a[0]++;
          if (l.orderNo || ["ordered", "to-cut", "cut-done"].includes(stage)) a[1]++;
        }
      }
      t.days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([d, [a, b]]) => [d, a, b]);
      t.since = t.days[0]?.[0] ?? null;
    } catch (e) { t.error = String((e as Error)?.message ?? e).slice(0, 200); }
    tools.push(t);
  }
  {
    const t: ToolCount = { key: "directup", name: "DirectUP", what: "An order list or file read into the cart - lists read, and carts filled from them", source: "DirectUP's own log", since: null, unit: "Lists read", unit2: "Carts filled", days: [], onShop: true };
    try {
      const u = await directUp<Usage>("/usage?days=400", { timeoutMs: 30_000 });
      const byDay: Record<string, [number, number]> = {};
      for (const d of u.perDay ?? []) (byDay[String(d.day).slice(0, 10)] ??= [0, 0])[0] += d.lists ?? 0;
      for (const c of u.carts ?? []) (byDay[String(c.day).slice(0, 10)] ??= [0, 0])[1] += c.carts ?? 0;
      t.days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([d, [a, b]]) => [d, a, b]);
      t.since = t.days[0]?.[0] ?? null;
    } catch (e) { t.error = String((e as Error)?.message ?? e).slice(0, 200); }
    tools.push(t);
  }
  for (const k of ["oring", "shaftseal", "compat", "vulcan"] as ShopToolKey[]) {
    const tool = SHOP_TOOLS[k];
    const t: ToolCount = { key: k, name: tool.name, what: tool.what, source: "its gateway's own count (since 14 Oct 2026)", since: null, unit: "Opened", unit2: tool.counts.search ? "Searches" : null, days: [], onShop: false };
    try {
      const u = await toolGateway<ToolUsage>(k, "/usage?days=400");
      const byDay: Record<string, [number, number]> = {};
      for (const r of u.rows ?? []) {
        const a = (byDay[String(r.day).slice(0, 10)] ??= [0, 0]);
        if (r.kind === "page") a[0] += r.n; else if (r.kind === "search") a[1] += r.n;
        if (r.kind === "page" && (r.shop === "www.apsoparts.com" || r.shop === "apsoparts.com")) t.onShop = true;
      }
      t.days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([d, [a, b]]) => [d, a, b]);
      t.since = t.days[0]?.[0] ?? null;
    } catch (e) { t.error = String((e as Error)?.message ?? e).slice(0, 200); }
    tools.push(t);
  }

  // why they did not buy: the Datatracker's rules on the live tracker's lines, since it started
  let prices: EngageData["prices"] = null;
  await guard("prices", async () => {
    reportProgress(KEY, "reading the price checks, minimum quantities and the shelf");
    const yesterday = iso(new Date(now.getTime() - 86_400_000));
    const s = await fetchShopSignals({ from: TRACKER_SINCE, to: yesterday, today: iso(now) });
    const byDay: Record<string, [number, number]> = {};
    const byTeam: Record<string, number> = {};
    const companies = new Set<string>();
    for (const r of s.priceChecks) {
      if (!r.qualifies || r.excluded) continue;
      const a = (byDay[r.day] ??= [0, 0]);
      a[0]++; if (r.ticketId) a[1]++;
      byTeam[r.team ?? "No team"] = (byTeam[r.team ?? "No team"] ?? 0) + 1;
      companies.add(r.companyId);
    }
    // the minimum order quantity: only a look that asked for fewer than the minimum
    const below = s.moq.filter((r) => r.belowMoq && r.qty != null);
    const moqDays: Record<string, [number, Set<string>]> = {};
    for (const r of below) { const a = (moqDays[r.day] ??= [0, new Set()]); a[0]++; a[1].add(r.companyId); }
    const moqRows: MoqRow[] = below.slice(0, 400).map((r) => ({ day: r.day, company: r.companyName ?? r.customerNumber ?? r.companyId, companyId: r.companyId, article: r.article, description: r.description, pc: r.profitCentre, qty: r.qty ?? 0, minimum: r.moqMinimum, unit: r.salesUnit }));
    // the shelf: nothing on it, or not as much as they asked for
    const shelfDays: Record<string, [number, number]> = {};
    for (const r of s.availability) { const a = (shelfDays[r.day] ??= [0, 0]); if (r.stock === 0) a[0]++; else a[1]++; }
    // the latest first (a mistyped 76,035 would head a list sorted by the gap); the stock is counted in the
    // sales unit - P&P's stock_unit label is not to be trusted
    const shelfRows: ShelfRow[] = [...s.availability].sort((a, b) => b.day.localeCompare(a.day) || (b.shortfall ?? 0) - (a.shortfall ?? 0)).slice(0, 400)
      .map((r) => ({ day: r.day, company: r.companyName ?? r.customerNumber ?? r.companyId, companyId: r.companyId, article: r.article, description: r.description, pc: r.profitCentre, qty: r.qty, stock: r.stock ?? 0, short: r.shortfall, unit: r.salesUnit ?? r.stockUnit }));
    const sorted = <T,>(o: Record<string, T>) => Object.entries(o).sort(([a], [b]) => a.localeCompare(b));
    prices = {
      since: TRACKER_SINCE, byDay: sorted(byDay).map(([day, [q, t]]) => [day, q, t]), byTeam, companies: companies.size,
      moq: { byDay: sorted(moqDays).map(([day, [n, c]]) => [day, n, c.size]), rows: moqRows, total: below.length },
      shelf: { byDay: sorted(shelfDays).map(([day, [a, b]]) => [day, a, b]), rows: shelfRows, total: s.availability.length },
    };
  });

  return { generatedAt: new Date().toISOString(), year, monthsDone, months, channels, cube, views, products, lists, bought: boughtPc, madeToOrder, unmapped, events, search, prices, tools, errors };
}

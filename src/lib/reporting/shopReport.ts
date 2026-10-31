// THE ESO SHOP BEHAVIOUR PAGE'S READ (SARCLA 29.10.2026: "rebuild like Figures/Visits" - logins, views, logged in &
// ordered in the shop): every company the shop counted, of everyone (ESO, TSA and the rest - the Figures' ESO | TSA |
// Total and the line managers' teams), as small rows; the rules in ./shopRules.ts. In three parts, as they change:
//
// 1. The companies and the Performis years - every six hours, through slowReport (about 400 searches, 50,000
//    companies): the E-Shop Data Tracker's export is one total per company and year on the company in HubSpot
//    (n_of_logins_datatracker[_YYYY], n_of_views_…, orders_…), loaded by hand - property history says when (the last
//    time 15 Apr 2026, so its 2026 stops there; the page says so); with each company's owner, priority, customer
//    category and country. APSOparts' and A+P's own left out.
// 2. The live counters - every five minutes: the smart bar's logins, article views and articles ordered per company
//    and day, which the hub keeps in its own database (apsomh_shop_days, src/lib/shopLooks, copied every quarter of an
//    hour) - counted since 2 Oct 2026. A company counted live but not in the export is read once and remembered. With
//    them the articles each company looked at (apsomh_shop_looks), by the profit centre Products & Pricing gives the
//    article - or the product page, when no article was chosen (SARCLA 30.10.2026: "views per assortment", his pick:
//    the profit centre), with its product, main group and sub group (31.10.2026: "the top product as well, include
//    product hierarchy") - and the article itself with its description ("drill down to article level as well"). The
//    map is kept in kv and grows: each six-hourly read looks up only what it has not seen.
// 3. The shop orders - every six hours, through slowReport: every order since January of last year (the search month
//    by month, as the online share's read), one per order number, the shop's when any of its records - or its archived
//    web record - carries the shop's mark (onlineShare.ts), with the profit centres of its lines (order_positions_json)
//    and its company (SARCLA 30.10.2026: "Orders: general & per assortment: # all, # one shots, # second, # multiple").

import { getPool } from "@/lib/db/client";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ESHOP_YEARS } from "@/lib/integrations/eshopActivity";
import { ownerNames } from "@/lib/integrations/erosion";
import { teamOf } from "@/lib/datatracker/rosters";
import { isInternalCompany } from "@/lib/datatracker/rules";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { kvGet, kvSet } from "@/lib/db/init";
import { CANCELLED } from "@/lib/connectors/steps/orderRules";
import { splitNumber, webMark } from "@/lib/marketingKpis/onlineShare";
import { categoryBand, prioBand, prioOf, CATEGORY_BANDS, PRIO_BANDS } from "./esoRules";
import { dayNo, type ShopData } from "./shopRules";

const BASE_KEY = "esoShop:base:v4"; // v2: the profit centres of the articles looked at; v3: their products and groups; v4: the articles' descriptions
const BASE_TTL_MS = 6 * 60 * 60 * 1000;
const ORDERS_KEY = "esoShop:orders:v1";
const ORDERS_TTL_MS = 6 * 60 * 60 * 1000;
/** article ("a:…") or product page ("p:…") -> its product (null: Products & Pricing does not know it); v2: with the article's description */
const PROD_KV = "esoShop:prodMap:v2";
const PP_OBJ = "2-200042439";
/** The profit centres in the order the page shows them; any other comes after, "Not assigned" last. */
export const PC_ORDER = ["DT", "KT", "FT", "ST", "AT"];
const NO_PC = "Not assigned";
const LIVE_TTL_MS = 5 * 60 * 1000;
/** The first whole day the smart bar counted - it went live on 2 Oct 2026 at 09:18 UTC; a test's counts sit on 30 Sep. */
export const LIVE_FROM = "2026-10-02";

type Row = { id: string; properties?: Record<string, string | null> };
type Props = Record<string, string | null | undefined>;
type Filter = { propertyName: string; operator: string; value?: string };
const num = (v: string | null | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** The 2026 pair has no year in its name (eshopActivity.ts). */
const DT_NOW = 2026;
const dtProp = (what: "n_of_logins" | "n_of_views" | "orders", y: number) => (y === DT_NOW ? `${what}_datatracker` : `${what}_datatracker_${y}`);
const FACTS = ["name", "domain", "hubspot_owner_id", "sales_priority", "apso_customer", "country_custom"];

/** The companies part, kept six hours: ShopData without the live days, with each company row's HubSpot id. */
/** What Products & Pricing says of an article or a product page: profit centre, main group, sub group, product number, name,
 *  and the article's description (an article's only). */
type Prod = [string | null, string | null, string | null, string, string, string?];
type Base = Pick<ShopData, "dtYears" | "dtLoaded" | "people" | "companies" | "years"> & {
  labels: CompanyLabels;
  generatedAt: string;
  ids: string[];
  /** APSOparts' and A+P's own, left out - kept so a live row of theirs is not read again */
  internal: string[];
  /** the product of each article and product page looked at so far */
  prodMap: Record<string, Prod | null>;
};
type CompanyLabels = Pick<ShopData["labels"], "prio" | "category" | "country">;

/* ── the people and the company rows, shared by both parts ─────────────── */

/** Who a company owner is and in which team - the rosters, else the team HubSpot has them in (as the Visits). */
async function teamFinder(): Promise<(id: string) => { name: string; team: string }> {
  const names = await ownerNames().catch(() => new Map<string, string>());
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  return (id) => ({
    name: id ? names.get(id) ?? `Owner ${id}` : "No owner",
    team: !id ? "Other" : teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other"),
  });
}
/** Adds companies to people / labels / rows (arrays it may grow) - one row per company: owner, priority, category, country. */
function rowMaker(people: ShopData["people"], labels: CompanyLabels, who: (id: string) => { name: string; team: string }) {
  const personIdx = new Map(people.map((p, i) => [p.id, i]));
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const person = (id: string) => {
    let i = personIdx.get(id);
    if (i === undefined) { i = people.push({ id, ...who(id) }) - 1; personIdx.set(id, i); }
    return i;
  };
  return (p: Props) => [person(p.hubspot_owner_id ?? ""), at(labels.prio, prioBand(prioOf(p.sales_priority))), at(labels.category, categoryBand(p.apso_customer)), at(labels.country, p.country_custom || "Not set")];
}

/* ── 1. the companies and the Performis years ──────────────────────────── */

function shopBase(): Promise<SlowState<Base>> {
  return slowReport(BASE_KEY, BASE_TTL_MS, buildBase);
}

/** Every company matching any of the groups, past the search's 10,000 by the object id (each group carries the cursor). */
async function searchAny(groups: Filter[][], properties: string[], label: string, seen: Map<string, Row>): Promise<void> {
  let lastId = "0";
  for (let page = 0; page < 2000; page++) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: {
        limit: 200, properties,
        filterGroups: groups.map((g) => ({ filters: [...g, { propertyName: "hs_object_id", operator: "GT", value: lastId }] })),
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      },
    });
    const rows = r.results ?? [];
    for (const x of rows) seen.set(String(x.id), x);
    reportProgress(BASE_KEY, `${label} · ${seen.size.toLocaleString("en")} companies`);
    if (rows.length < 200) break;
    lastId = rows[rows.length - 1].id;
  }
}

async function buildBase(): Promise<Base> {
  const years = [...ESHOP_YEARS].sort((a, b) => a - b);
  const props = [...FACTS, ...years.flatMap((y) => [dtProp("n_of_logins", y), dtProp("n_of_views", y), dtProp("orders", y)])];

  // every company the export has a login for, in any of its years (a search takes 5 groups at most)
  const found = new Map<string, Row>();
  const groups = years.map((y) => [{ propertyName: dtProp("n_of_logins", y), operator: "GT", value: "0" }]);
  for (let i = 0; i < groups.length; i += 3) await searchAny(groups.slice(i, i + 3), props, "reading the companies the shop counted", found);

  // the day the last export was loaded: the newest change of its newest logins, on the first companies that carry it
  let dtLoaded: string | null = null;
  try {
    const sample = [...found.values()].filter((c) => num(c.properties?.[dtProp("n_of_logins", DT_NOW)]) > 0).slice(0, 50);
    if (sample.length) {
      const r = await hubspotFetchJson<{ results?: { propertiesWithHistory?: Record<string, { timestamp: string }[]> }[] }>({
        path: "/crm/v3/objects/companies/batch/read", method: "POST",
        body: { inputs: sample.map((c) => ({ id: c.id })), properties: ["name"], propertiesWithHistory: [dtProp("n_of_logins", DT_NOW)] },
      });
      const votes = new Map<string, number>();
      for (const x of r.results ?? []) {
        const day = x.propertiesWithHistory?.[dtProp("n_of_logins", DT_NOW)]?.[0]?.timestamp?.slice(0, 10);
        if (day) votes.set(day, (votes.get(day) ?? 0) + 1);
      }
      dtLoaded = [...votes].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? null;
    }
  } catch { /* not known: the page then names the year without its end */ }

  const people: ShopData["people"] = [];
  const labels: Base["labels"] = { prio: [...PRIO_BANDS], category: [...CATEGORY_BANDS], country: [] };
  const row = rowMaker(people, labels, await teamFinder());
  const ids: string[] = [], companies: number[][] = [], yearRows: number[][] = [], internal: string[] = [];
  for (const [id, c] of found) {
    const p = c.properties ?? {};
    if (isInternalCompany(p.name, p.domain)) { internal.push(id); continue; }
    const ci = companies.push(row(p)) - 1;
    ids.push(id);
    years.forEach((y, yi) => {
      const l = num(p[dtProp("n_of_logins", y)]), v = num(p[dtProp("n_of_views", y)]), o = num(p[dtProp("orders", y)]);
      if (l || v || o) yearRows.push([ci, yi, l, v, o]);
    });
  }
  // the product of every article and product page looked at so far
  const prodMap = await prodMapFor(await lookedKeys(), 300, true, (t) => reportProgress(BASE_KEY, t));
  return { generatedAt: new Date().toISOString(), dtYears: years, dtLoaded, people, labels, companies, years: yearRows, ids, internal, prodMap };
}

/* ── the product of what was looked at ─────────────────────────────────── */

type LookKeys = { articles: string[]; products: string[]; pairs: [string, string][] };
/** Every article and product page looked at since the counters started, and which product each article was seen on. */
async function lookedKeys(): Promise<LookKeys> {
  try {
    const r = await getPool().query<{ article: string; product: string }>(
      `SELECT DISTINCT article, product FROM apsomh_shop_looks WHERE day >= $1::date`, [LIVE_FROM],
    );
    const articles = new Set<string>(), products = new Set<string>(), pairs: [string, string][] = [];
    for (const x of r.rows) {
      if (x.article) articles.add(x.article);
      if (x.product) products.add(x.product);
      if (x.article && x.product) pairs.push([x.article, x.product]);
    }
    return { articles: [...articles], products: [...products], pairs };
  } catch (e) {
    if (/does not exist/i.test(String((e as Error)?.message ?? e))) return { articles: [], products: [], pairs: [] };
    throw e;
  }
}

const prodSeen = new Map<string, Prod | null>();
let prodLoaded = false;
const PROD_PROPS = ["profit_center", "main_group_description", "sub_group_description", "product_number", "product_description", "article_description"];
/** The products of these keys - from kv and this process first, then Products & Pricing: articles 100 a search; a product
 *  page 25 a search (about 100 articles each, so one page answers most - a product never spans two profit centres, checked
 *  30.10.2026), the rest one by one up to `singles` a read. */
async function prodMapFor(k: LookKeys, singles: number, persist: boolean, progress?: (t: string) => void): Promise<Record<string, Prod | null>> {
  if (!prodLoaded) {
    const stored = (await kvGet<Record<string, Prod | null>>(PROD_KV).catch(() => undefined)) ?? {};
    for (const [key, x] of Object.entries(stored)) if (!prodSeen.has(key)) prodSeen.set(key, x);
    prodLoaded = true;
  }
  const before = prodSeen.size;
  const str = (v: string | null | undefined) => (v ?? "").trim() || null;
  // Products & Pricing ends its descriptions with " -" ("... 7.00 mm -")
  const text = (v: string | null | undefined) => str(v)?.replace(/\s+-$/, "") || null;
  const search = async (prop: string, values: string[], limit: number) => {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: `/crm/v3/objects/${PP_OBJ}/search`, method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: prop, operator: "IN", values }] }], properties: [prop, ...PROD_PROPS], limit },
    });
    return (r.results ?? []).map((x) => {
      const q = x.properties ?? {};
      const prod: Prod = [str(q.profit_center)?.toUpperCase() ?? null, str(q.main_group_description), str(q.sub_group_description), str(q.product_number) ?? "", text(q.product_description) ?? ""];
      if (prop === "article_number") prod.push(text(q.article_description) ?? "");
      return [String(q[prop] ?? ""), prod] as const;
    });
  };
  const articles = k.articles.filter((a) => !prodSeen.has(`a:${a}`));
  for (let i = 0; i < articles.length; i += 100) {
    const part = articles.slice(i, i + 100);
    for (const [a, x] of await search("article_number", part, 100)) if (a) prodSeen.set(`a:${a}`, x);
    for (const a of part) if (!prodSeen.has(`a:${a}`)) prodSeen.set(`a:${a}`, null);
    progress?.(`the products of the articles looked at · ${Math.min(i + 100, articles.length).toLocaleString("en")} of ${articles.length.toLocaleString("en")}`);
  }
  // a product page seen with one of its articles: that article's product
  for (const [a, prod] of k.pairs) { const x = prodSeen.get(`a:${a}`); if (x && !prodSeen.get(`p:${prod}`)) prodSeen.set(`p:${prod}`, x); }
  let products = k.products.filter((x) => !prodSeen.has(`p:${x}`));
  for (let i = 0; i < products.length; i += 25) {
    for (const [x, info] of await search("product_number", products.slice(i, i + 25), 200)) if (x && !prodSeen.get(`p:${x}`)) prodSeen.set(`p:${x}`, info);
    progress?.(`the product pages looked at · ${Math.min(i + 25, products.length).toLocaleString("en")} of ${products.length.toLocaleString("en")}`);
  }
  products = products.filter((x) => !prodSeen.has(`p:${x}`));
  for (const x of products.slice(0, singles)) {
    const [hit] = await search("product_number", [x], 1);
    prodSeen.set(`p:${x}`, hit?.[1] ?? null);
  }
  // kept by the six-hourly read; the five-minute join only remembers in this process
  if (persist && prodSeen.size > before) await kvSet(PROD_KV, Object.fromEntries(prodSeen)).catch(() => { /* looked up again next time */ });
  return Object.fromEntries(prodSeen);
}

/* ── 3. the shop orders ────────────────────────────────────────────────── */

/** The shop orders since January of last year: [company id, day placed, the profit centres of its lines joined by ","], and
 *  the facts of their companies (a buyer that never logged in is in no other part). */
type OrdersPart = { generatedAt: string; from: string; through: string; orders: [string, string, string][]; facts: Record<string, Props>; read: { records: number; orders: number; noCompany: number } };

function shopOrders(): Promise<SlowState<OrdersPart>> {
  return slowReport(ORDERS_KEY, ORDERS_TTL_MS, buildOrders);
}

/** order_order_date is epoch millis as text, or an ISO date. */
const dayOfOrder = (v: string | null | undefined) => {
  if (!v) return "";
  const d = /^\d+$/.test(v) ? new Date(Number(v)) : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
/** The profit centres of an order record's lines. */
const pcsOf = (json: string | null | undefined): string[] => {
  try {
    const lines = JSON.parse(json || "[]") as { pc?: string }[];
    return [...new Set(lines.map((l) => String(l?.pc ?? "").trim().toUpperCase()).filter(Boolean))];
  } catch { return []; }
};

async function buildOrders(): Promise<OrdersPart> {
  const now = new Date();
  const from = `${now.getUTCFullYear() - 1}-01-01`;
  const through = now.toISOString().slice(0, 10);
  type Page = { results?: Row[]; total?: number; paging?: { next?: { after?: string } } };

  // 1. the archived web records: once the ERP's deliveries cover a web order the hub archives its .000, and the deliveries
  //    do not carry the shop's mark (onlineShare.ts)
  const archivedWeb = new Set<string>();
  let after: string | undefined, archived = 0;
  for (;;) {
    const r = await hubspotFetchJson<Page>({ path: `/crm/v3/objects/orders?limit=100&archived=true&properties=order_order_number,hs_external_order_id,order_channel,order_web_order_number${after ? `&after=${after}` : ""}` });
    for (const o of r.results ?? []) {
      archived++;
      const sn = splitNumber(o.properties?.order_order_number);
      if (sn && webMark(o.properties ?? {})) archivedWeb.add(sn[0]);
    }
    if (archived % 2000 < 100) reportProgress(ORDERS_KEY, `reading the archived web orders · ${archived.toLocaleString("en")}`);
    after = r.paging?.next?.after;
    if (!after) break;
  }

  // 2. every order record, month by month; one order per number - the shop's when any record is
  type Ord = { day: string; web: boolean; pcs: Set<string>; erpPick?: string; webPick?: string };
  const byNumber = new Map<string, Ord>();
  let records = 0;
  const PROPS = ["order_order_number", "order_order_date", "hs_external_order_id", "order_web_order_number", "order_channel", "hs_pipeline_stage", "order_positions_json"];
  const readRange = async (a: number, b: number): Promise<void> => {
    const filters = [{ propertyName: "order_order_date", operator: "GTE", value: String(a) }, { propertyName: "order_order_date", operator: "LT", value: String(b) }];
    let next: string | undefined, first = true;
    do {
      const r = await hubspotFetchJson<Page>({
        path: "/crm/v3/objects/orders/search", method: "POST",
        body: { filterGroups: [{ filters }], properties: PROPS, limit: 200, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], ...(next ? { after: next } : {}) },
      });
      // the search stops at 10,000: a fuller range is read in halves
      if (first && (r.total ?? 0) > 9_900 && b - a > 86_400_000) {
        const mid = a + Math.floor((b - a) / 2);
        await readRange(a, mid);
        await readRange(mid, b);
        return;
      }
      first = false;
      for (const o of r.results ?? []) {
        const q = o.properties ?? {};
        records++;
        if (q.hs_pipeline_stage === CANCELLED) continue;
        const sn = splitNumber(q.order_order_number);
        if (sn && sn[0].startsWith("G")) continue; // a credit note
        // a web order the ERP has not numbered yet stands on its own
        const key = sn ? sn[0] : `web:${o.id}`;
        const day = dayOfOrder(q.order_order_date);
        let x = byNumber.get(key);
        if (!x) { x = { day, web: false, pcs: new Set() }; byNumber.set(key, x); }
        if (day && (!x.day || day < x.day)) x.day = day;
        if (webMark(q) || (sn && archivedWeb.has(sn[0]))) x.web = true;
        for (const pc of pcsOf(q.order_positions_json)) x.pcs.add(pc);
        if (sn && sn[1] !== "000") x.erpPick ??= String(o.id); else x.webPick ??= String(o.id);
      }
      next = r.paging?.next?.after;
    } while (next);
  };
  const [fy, fm] = [Number(from.slice(0, 4)), 0];
  for (let y = fy, m = fm; Date.UTC(y, m, 1) <= now.getTime(); m === 11 ? (y++, m = 0) : m++) {
    reportProgress(ORDERS_KEY, `reading the orders of ${y}-${String(m + 1).padStart(2, "0")} · ${records.toLocaleString("en")} records so far`);
    await readRange(Date.UTC(y, m, 1), Date.UTC(y, m + 1, 1));
  }
  const shop = [...byNumber.values()].filter((o) => o.web && o.day >= from);

  // 3. each order's company - the record the online share counts it for - and those companies' facts
  const picks = shop.map((o) => o.erpPick ?? o.webPick!).filter(Boolean);
  const companyOf = new Map<string, string>();
  for (let i = 0; i < picks.length; i += 1000) {
    reportProgress(ORDERS_KEY, `finding the orders' companies · ${i.toLocaleString("en")} of ${picks.length.toLocaleString("en")}`);
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: string | number }[] }[] }>({
      path: "/crm/v4/associations/orders/companies/batch/read", method: "POST",
      body: { inputs: picks.slice(i, i + 1000).map((id) => ({ id })) },
    });
    for (const x of r.results ?? []) { const c = x.to?.[0]?.toObjectId; if (x.from?.id != null && c != null) companyOf.set(String(x.from.id), String(c)); }
  }
  const orders: OrdersPart["orders"] = [];
  let noCompany = 0;
  for (const o of shop) {
    const c = companyOf.get(o.erpPick ?? o.webPick!);
    if (!c) { noCompany++; continue; }
    orders.push([c, o.day, [...o.pcs].join(",")]);
  }
  const ids = [...new Set(orders.map((o) => o[0]))];
  const facts: Record<string, Props> = {};
  for (let i = 0; i < ids.length; i += 100) {
    if (i % 2000 === 0) reportProgress(ORDERS_KEY, `reading the buyers · ${i.toLocaleString("en")} of ${ids.length.toLocaleString("en")}`);
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: FACTS },
    });
    for (const x of r.results ?? []) facts[String(x.id)] = Object.fromEntries(FACTS.map((f) => [f, x.properties?.[f] ?? null]));
  }
  return { generatedAt: new Date().toISOString(), from, through, orders, facts, read: { records, orders: orders.length, noCompany } };
}

/* ── 2. the live counters, joined to the companies ─────────────────────── */

/** The companies counted live but not in the export: their facts, read once (again after six hours); null = gone (merged). */
const factsSeen = new Map<string, { at: number; p: Props | null }>();
async function liveOnlyFacts(ids: string[]): Promise<Map<string, Props | null>> {
  const now = Date.now();
  const stale = ids.filter((id) => { const f = factsSeen.get(id); return !f || now - f.at > BASE_TTL_MS; });
  for (let i = 0; i < stale.length; i += 100) {
    const part = stale.slice(i, i + 100);
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: part.map((id) => ({ id })), properties: FACTS },
    });
    const got = new Map((r.results ?? []).map((x) => [String(x.id), x.properties ?? {}]));
    for (const id of part) factsSeen.set(id, { at: now, p: got.get(id) ?? null });
  }
  return new Map(ids.map((id) => [id, factsSeen.get(id)?.p ?? null]));
}

/** Rows of a table the first sweep makes (src/lib/shopLooks) - none yet is nothing counted yet. */
async function rowsOf<T>(sql: string, args: unknown[]): Promise<T[]> {
  try {
    return (await getPool().query(sql, args)).rows as T[];
  } catch (e) {
    if (/does not exist/i.test(String((e as Error)?.message ?? e))) return [];
    throw e;
  }
}

async function withLive(b: Base, o: OrdersPart | undefined): Promise<ShopData> {
  const today = new Date().toISOString().slice(0, 10);
  const live = await rowsOf<{ company_id: string; day: string; logins: number; views: number; orders: number; carts: number }>(
    `SELECT company_id, to_char(day, 'YYYY-MM-DD') AS day, logins, views, orders, carts FROM apsomh_shop_days WHERE day >= $1::date AND day <= $2::date`, [LIVE_FROM, today]);
  const looked = await rowsOf<{ company_id: string; day: string; article: string; product: string; carted: boolean; ordered: boolean }>(
    `SELECT company_id, to_char(day, 'YYYY-MM-DD') AS day, article, product, carted, ordered FROM apsomh_shop_looks WHERE day >= $1::date AND day <= $2::date`, [LIVE_FROM, today]);
  // the companies part is shared: grown on copies, never in place
  const people = [...b.people];
  const labels = { prio: [...b.labels.prio], category: [...b.labels.category], country: [...b.labels.country] };
  const companies = [...b.companies];
  const idx = new Map(b.ids.map((id, i) => [id, i]));
  const internal = new Set(b.internal);
  const row = rowMaker(people, labels, await teamFinder());
  // the buyers the other parts do not hold: their facts came with the orders
  for (const [id, p] of Object.entries(o?.facts ?? {})) {
    if (idx.has(id) || internal.has(id)) continue;
    if (isInternalCompany(p.name, p.domain)) { internal.add(id); continue; }
    idx.set(id, companies.push(row(p)) - 1);
  }
  const missing = [...new Set([...live, ...looked].map((r) => String(r.company_id)))].filter((id) => !idx.has(id) && !internal.has(id));
  if (missing.length) {
    const facts = await liveOnlyFacts(missing);
    for (const id of missing) {
      const p = facts.get(id);
      if (!p || isInternalCompany(p.name, p.domain)) continue;
      idx.set(id, companies.push(row(p)) - 1);
    }
  }
  const days: number[][] = [];
  for (const r of live) {
    const ci = idx.get(String(r.company_id));
    if (ci === undefined) continue; // internal, or gone from HubSpot (merged)
    days.push([ci, dayNo(LIVE_FROM, r.day), Number(r.logins) || 0, Number(r.views) || 0, Number(r.orders) || 0, Number(r.carts) || 0]);
  }
  // the products looked at, with their hierarchy - the new ones looked up (a few each time)
  const fresh = looked.flatMap((r) => [r.article ? `a:${r.article}` : "", r.product ? `p:${r.product}` : ""]).filter((k) => k && !(k in b.prodMap) && !prodSeen.has(k));
  const prodMap = fresh.length
    ? await prodMapFor({ articles: [...new Set(fresh.filter((k) => k.startsWith("a:")).map((k) => k.slice(2)))], products: [...new Set(fresh.filter((k) => k.startsWith("p:")).map((k) => k.slice(2)))], pairs: looked.filter((r) => r.article && r.product).map((r) => [r.article, r.product]) }, 20, false)
    : { ...b.prodMap, ...Object.fromEntries(prodSeen) };
  const prodOf = (r: { article: string; product: string }) => (r.article ? prodMap[`a:${r.article}`] : null) ?? (r.product ? prodMap[`p:${r.product}`] : null) ?? null;
  // the profit centres in the page's order, any other after, "Not assigned" last - fixed before any row points at one
  const seenPc = new Set<string>();
  for (const r of looked) seenPc.add(prodOf(r)?.[0] || NO_PC);
  for (const [, , pcs] of o?.orders ?? []) for (const pc of pcs ? pcs.split(",") : [NO_PC]) seenPc.add(pc);
  const pcList = [...PC_ORDER, ...[...seenPc].filter((pc) => pc !== NO_PC && !PC_ORDER.includes(pc)).sort(), NO_PC];
  const pcIdx = (pc: string | null | undefined) => { const i = pcList.indexOf(pc || NO_PC); return i < 0 ? pcList.length - 1 : i; };
  const groups: string[] = [], subs: string[] = [];
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const products: ShopData["products"] = [];
  const prodIdx = new Map<string, number>();
  const productOf = (x: Prod | null) => {
    const key = x?.[3] || NO_PC;
    let i = prodIdx.get(key);
    if (i === undefined) {
      i = products.push(x?.[3] ? [x[3], x[4] || x[3], pcIdx(x[0]), at(groups, x[1] || "Not set"), at(subs, x[2] || "Not set")] : ["", NO_PC, pcIdx(NO_PC), at(groups, "Not set"), at(subs, "Not set")]) - 1;
      prodIdx.set(key, i);
    }
    return i;
  };
  // the articles Products & Pricing knows, with their description - the others count on their product only
  const articles: ShopData["articles"] = [];
  const artIdx = new Map<string, number>();
  const articleOf = (a: string, prod: number) => {
    const x = a ? prodMap[`a:${a}`] : null;
    if (!x?.[3]) return -1;
    let i = artIdx.get(a);
    if (i === undefined) { i = articles.push([a, x[5] ?? "", prod]) - 1; artIdx.set(a, i); }
    return i;
  };
  const lookAt = new Map<string, number[]>();
  for (const r of looked) {
    const ci = idx.get(String(r.company_id));
    if (ci === undefined) continue;
    const prod = productOf(prodOf(r));
    const art = articleOf(r.article, prod);
    const day = dayNo(LIVE_FROM, r.day);
    const k = `${ci}|${day}|${prod}|${art}`;
    let x = lookAt.get(k);
    if (!x) { x = [ci, day, prod, 0, 0, 0, art]; lookAt.set(k, x); }
    x[3]++; if (r.carted) x[4]++; if (r.ordered) x[5]++;
  }
  const orders: number[][] = [];
  for (const [id, day, pcs] of o?.orders ?? []) {
    const ci = idx.get(id);
    if (ci === undefined || !day) continue;
    let bits = 0;
    for (const pc of pcs ? pcs.split(",") : [NO_PC]) bits |= 1 << pcIdx(pc);
    orders.push([ci, dayNo(LIVE_FROM, day), bits]);
  }
  return {
    generatedAt: new Date().toISOString(), today, liveFrom: LIVE_FROM, dtYears: b.dtYears, dtLoaded: b.dtLoaded,
    people, labels: { ...labels, pc: pcList, group: groups, sub: subs }, products, articles, companies, days, years: b.years, looks: [...lookAt.values()],
    orders, ordersFrom: o?.from ?? null,
    coverage: { companies: companies.length, live: new Set(days.map((r) => r[0])).size, performis: new Set(b.years.map((r) => r[0])).size, internal: b.internal.length },
  };
}

/** The page's read: the companies part and the shop orders (six hours each) joined to the live counters (five minutes).
 *  While the counters are read again, the last join is answered; the first one is waited for. The orders follow when
 *  read - the page says so meanwhile. */
type Joined = { at: number; base: string; value?: ShopData; pending?: Promise<ShopData>; error?: string };
let joined: Joined | null = null;
export async function esoShop(): Promise<SlowState<ShopData>> {
  const base = await shopBase();
  if (!base.value) return { computing: base.computing, progress: base.progress, error: base.error };
  const ord = await shopOrders();
  const b = base.value, o = ord.value;
  const stamp = `${b.generatedAt}|${o?.generatedAt ?? ""}`;
  const same = joined?.base === stamp;
  if (!joined || !same || (!joined.pending && Date.now() - joined.at > LIVE_TTL_MS)) {
    // new companies or orders: waited for (a few seconds - an answer without them would say "still reading"); the
    // five-minute refresh of the counters answers the last join meanwhile
    const run: Joined = { at: Date.now(), base: stamp, value: same ? joined?.value : undefined };
    const p = withLive(b, o).then((v) => { run.value = v; run.at = Date.now(); run.error = undefined; return v; });
    run.pending = p;
    // handled here, so a failed refresh behind a value already answered never goes unheard; the next look tries again
    p.catch((e) => { run.error = String((e as Error)?.message ?? e); }).finally(() => { run.pending = undefined; });
    joined = run;
  }
  const j = joined;
  // still reading the orders (or the companies again): the page looks again until both are in
  const state = { computing: base.computing || ord.computing, computedAt: base.computedAt, progress: ord.computing ? ord.progress : base.progress };
  if (j.value) return { ...state, value: j.value };
  try {
    if (!j.pending) throw new Error(j.error ?? "the shop's counters could not be read");
    return { ...state, value: await j.pending };
  } catch (e) {
    if (joined === j) joined = null;
    return { computing: false, error: String((e as Error)?.message ?? e) };
  }
}

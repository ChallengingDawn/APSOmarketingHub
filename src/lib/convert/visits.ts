// APSOconvert > Journeys > VISITS - the reads (the rules are in ./visitRules.ts, pure). SARCLA 09.11.2026: "you should
// allow to see the visits per customer really as a play again their visits and based on all of this data you do
// recommendations". Three sources, each saying what it answers for:
//
//   the shop's own record   apsomh_shop_looks, kept by the hub every quarter of an hour (src/lib/shopLooks/store.ts):
//                           every article a signed-in customer opened, the quantity, the cart, the order, the contact,
//                           the LAST minute of the day - with the step the Products Reports' read gives each look
//                           (src/lib/productSignals/read.ts, shared, never started twice) and Products & Pricing's names
//   HubSpot, page by page   /events/v3/events e_visited_page per contact - HubSpot gives it only to Enterprise portals;
//                           refused, the page says so and tries again after 10 minutes
//   HubSpot, last page      each contact's last page seen and its minute (a contact property, always readable)
//
// A product's page comes from the shop's page list (apsomh_convert_pages, the Pages read). Names travel to the browser,
// never into an address: the page is opened by HubSpot ids only.

import { query } from "@/lib/db/client";
import { owners } from "@/lib/integrations/eshopActivity";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { cachedReport } from "@/lib/integrations/hubspotJourney";
import { describeIntegrationError, hubspotToken } from "@/lib/integrations/status";
import { storeOf } from "@/lib/journeys/model";
import { AR, CO, PATH_STEPS, SIGNALS_FROM, type SignalsData } from "@/lib/productSignals/model";
import { productSignals } from "@/lib/productSignals/read";
import { productNumber, type Step } from "./model";
import {
  buildVisits, mergeStops, mostOf, reachOf, shopPathOf, stopWords, stopsOf,
  type CustomerRow, type Look, type PageView, type SharedStop, type Stop, type Visit,
} from "./visitRules";

/* ── how each source answered ─────────────────────────────────────────── */

export type SourceState = { state: "ok" | "partial" | "off" | "error"; note: string | null };
export type VisitSources = { hubspot: SourceState; pages: SourceState; shop: SourceState };

const OFF: SourceState = { state: "off", note: "HubSpot is not connected on this hub" };
const errNote = (e: unknown) => describeIntegrationError(e).error.slice(0, 200);

/** After HubSpot refused its events (an Enterprise feature), no events call for 10 minutes - each would fail alike. */
let eventsRefusedUntil = 0;
const EVENTS_REFUSED = "HubSpot gives each person's last page only - page by page needs HubSpot Enterprise";
const refusal = (msg: string, status: number | null) => status === 403 || /event-detail-read|web-analytics-api-access|business-intelligence/i.test(msg);

/* ── the shop's record ────────────────────────────────────────────────── */

type LookRow = { company_id: string; article: string; product: string; last_at: string; qty: number | null; carted: boolean; ordered: boolean; contact_id: string | null };

async function shopRows(from: string, to: string, companyId?: string): Promise<{ rows: LookRow[]; state: SourceState }> {
  try {
    const r = await query<LookRow>(
      `SELECT company_id, article, product, last_at, COALESCE(qty_max, qty)::float8 AS qty, carted, ordered, contact_id
         FROM apsomh_shop_looks
        WHERE day >= $1::date AND day <= $2::date ${companyId ? "AND company_id = $3" : ""}
        ORDER BY last_at
        LIMIT 60000`,
      companyId ? [from, to, companyId] : [from, to],
    );
    return { rows: r.rows, state: { state: "ok", note: null } };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    // a hub whose copy of the shop's lines never ran (the laptop sandbox): nothing kept yet, said so
    return { rows: [], state: { state: "error", note: /does not exist/i.test(msg) ? "The shop's record is not kept on this hub yet" : msg.slice(0, 200) } };
  }
}

/** The Products Reports' read, indexed once per computation: the step of each look, each article's name and product. */
type SignalIndex = { at: string; steps: Map<string, Step>; facts: Map<string, { name: string | null; page: string | null; product: string | null; minimum: number | null }>; companies: Map<string, { name: string; number: string; country: string }> };
let indexMemo: SignalIndex | null = null;

async function signalIndex(): Promise<SignalIndex | null> {
  let d: SignalsData | undefined;
  try { d = (await productSignals()).value; } catch { return null; }
  if (!d) return null;
  if (indexMemo && indexMemo.at === d.generatedAt) return indexMemo;
  const steps = new Map<string, Step>();
  for (const [c, a, day, s] of d.path ?? []) {
    const co = d.companies[c], ar = d.articles[a], step = PATH_STEPS[s];
    if (co && ar && step) steps.set(`${co[CO.id]}|${ar[AR.number]}|${day}`, step as Step);
  }
  const facts = new Map<string, { name: string | null; page: string | null; product: string | null; minimum: number | null }>();
  for (const ar of d.articles) facts.set(ar[AR.number], { name: ar[AR.description] || ar[AR.productName] || null, page: ar[AR.productName] || null, product: productNumber(ar[AR.product]), minimum: ar[AR.minimum] });
  const companies = new Map(d.companies.map((c) => [c[CO.id], { name: c[CO.name], number: c[CO.un], country: c[CO.country] }]));
  indexMemo = { at: d.generatedAt, steps, facts, companies };
  return indexMemo;
}

function lookOf(r: LookRow, idx: SignalIndex | null): Look {
  const f = r.article ? idx?.facts.get(r.article) : undefined;
  return {
    at: r.last_at, article: r.article, product: productNumber(r.product) ?? f?.product ?? null,
    qty: r.qty === null || r.qty === undefined ? null : Number(r.qty), carted: !!r.carted, ordered: !!r.ordered, contact: r.contact_id,
    step: r.article ? idx?.steps.get(`${r.company_id}|${r.article}|${r.last_at.slice(0, 10)}`) ?? null : null,
    name: f?.name ?? null, minimum: f?.minimum ?? null, page: f?.page ?? null,
  };
}

/** Each product's page on the live shop, in the store view asked for when it has one, else de-CH, else any. */
async function productPaths(products: string[], store: string | null): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!products.length) return out;
  try {
    const r = await query<{ product: string; store: string; url: string }>(
      `SELECT product, store, url FROM apsomh_convert_pages WHERE env = 'prod' AND gone_at IS NULL AND product = ANY($1::text[]) ORDER BY store`,
      [products.slice(0, 2000)],
    );
    const rank = (s: string) => (store && s === store ? 0 : store && s.startsWith(`${store}/`) ? 1 : s === "de-CH" ? 2 : 3);
    const best = new Map<string, { rank: number; url: string }>();
    for (const x of r.rows) {
      const k = rank(x.store);
      const cur = best.get(x.product);
      if (!cur || k < cur.rank) best.set(x.product, { rank: k, url: x.url });
    }
    for (const [p, v] of best) {
      try { out.set(p, new URL(v.url).pathname); } catch { /* an address the index could not read is left out */ }
    }
  } catch { /* no page list on this hub: the looks show without a picture */ }
  return out;
}

/* ── HubSpot ──────────────────────────────────────────────────────────── */

type Props = Record<string, unknown>;
type SearchRes = { results?: { id?: string; properties?: Props }[]; paging?: { next?: { after?: string } } };
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => { const n = Number(v); return v !== null && v !== "" && v !== undefined && Number.isFinite(n) ? n : null; };
const nameOfContact = (id: string, p: Props) => `${str(p.firstname) ?? ""} ${str(p.lastname) ?? ""}`.trim() || `Contact ${id}`;

const CONTACT_PROPS = ["firstname", "lastname", "jobtitle", "associatedcompanyid", "hs_analytics_last_timestamp", "hs_analytics_last_url", "hs_analytics_num_visits", "hs_analytics_num_page_views"];
const COMPANY_PROPS = ["name", "company_unique_number", "country_custom", "apso_customer", "sales_priority", "hubspot_owner_id"];

export type ContactLite = { id: string; name: string; job: string | null; companyId: string | null; lastAt: string | null; lastUrl: string | null; visits: number | null; pageViews: number | null };
const contactOf = (id: string, p: Props): ContactLite => ({
  id, name: nameOfContact(id, p), job: str(p.jobtitle), companyId: str(p.associatedcompanyid), lastAt: str(p.hs_analytics_last_timestamp),
  lastUrl: str(p.hs_analytics_last_url), visits: num(p.hs_analytics_num_visits), pageViews: num(p.hs_analytics_num_page_views),
});

function bounds(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  return { start, end: Date.parse(`${to}T00:00:00Z`) + 86_400_000 };
}

/** The contacts HubSpot saw on the site in the period, newest first - 200 at most (two search pages, paced by the hub). */
async function activeContacts(from: string, to: string, signal?: AbortSignal): Promise<ContactLite[]> {
  const { start, end } = bounds(from, to);
  const out: ContactLite[] = [];
  let after: string | undefined;
  for (let page = 0; page < 2; page++) {
    const res = await hubspotFetchJson<SearchRes>({
      path: "/crm/v3/objects/contacts/search", method: "POST", signal,
      body: {
        filterGroups: [{ filters: [
          { propertyName: "hs_analytics_last_timestamp", operator: "GTE", value: String(start) },
          { propertyName: "hs_analytics_last_timestamp", operator: "LT", value: String(end) },
          { propertyName: "associatedcompanyid", operator: "HAS_PROPERTY" },
        ] }],
        sorts: [{ propertyName: "hs_analytics_last_timestamp", direction: "DESCENDING" }],
        properties: CONTACT_PROPS, limit: 100, ...(after ? { after } : {}),
      },
    });
    for (const r of res.results ?? []) if (r.id) out.push(contactOf(r.id, r.properties ?? {}));
    after = res.paging?.next?.after;
    if (!after) break;
  }
  return out;
}

async function batchRead(object: "contacts" | "companies", ids: string[], properties: string[], signal?: AbortSignal): Promise<Map<string, Props>> {
  const out = new Map<string, Props>();
  for (let i = 0; i < ids.length; i += 100) {
    const res = await hubspotFetchJson<{ results?: { id?: string; properties?: Props }[] }>({
      path: `/crm/v3/objects/${object}/batch/read`, method: "POST", signal,
      body: { properties, inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const r of res.results ?? []) if (r.id) out.set(r.id, r.properties ?? {});
  }
  return out;
}

export type CompanyLite = { name: string | null; number: string | null; country: string | null; segment: string | null; priority: string | null; owner: string | null };

async function companiesOf(ids: string[], signal?: AbortSignal): Promise<Map<string, CompanyLite>> {
  const props = await batchRead("companies", ids, COMPANY_PROPS, signal);
  const ownerNames = await owners(signal);
  const out = new Map<string, CompanyLite>();
  for (const [id, p] of props) {
    out.set(id, {
      name: str(p.name), number: str(p.company_unique_number), country: str(p.country_custom), segment: str(p.apso_customer),
      priority: str(p.sales_priority), owner: ownerNames.get(String(p.hubspot_owner_id ?? "")) || null,
    });
  }
  return out;
}

/** A contact's last page seen as a page view - when it falls in the period. */
function lastView(c: ContactLite, from: string, to: string): PageView | null {
  if (!c.lastAt || !c.lastUrl) return null;
  const t = Date.parse(c.lastAt);
  const { start, end } = bounds(from, to);
  if (!Number.isFinite(t) || t < start || t >= end) return null;
  const sp = shopPathOf(c.lastUrl);
  return sp ? { at: new Date(t).toISOString(), path: sp.path, query: sp.query, title: null, contact: c.id, source: "last" } : null;
}

type EventsRes = { results?: { occurredAt?: string; properties?: { hs_url?: string; hs_title?: string } }[]; paging?: { next?: { after?: string } } };

/** One contact's pages in the period, page by page - 300 at most. Throws HubSpot's refusal. */
async function contactPages(contactId: string, from: string, to: string, signal?: AbortSignal): Promise<PageView[]> {
  const { start, end } = bounds(from, to);
  const out: PageView[] = [];
  let after: string | undefined;
  for (let page = 0; page < 3; page++) {
    const res = await hubspotFetchJson<EventsRes>({
      path: `/events/v3/events?objectType=contact&objectId=${encodeURIComponent(contactId)}&eventType=e_visited_page`
        + `&occurredAfter=${encodeURIComponent(new Date(start).toISOString())}&occurredBefore=${encodeURIComponent(new Date(end).toISOString())}`
        + `&limit=100&sort=-occurredAt${after ? `&after=${encodeURIComponent(after)}` : ""}`,
      useEventsToken: true, signal,
    });
    for (const e of res.results ?? []) {
      const sp = shopPathOf(e.properties?.hs_url);
      if (!e.occurredAt || !sp) continue;
      out.push({ at: e.occurredAt, path: sp.path, query: sp.query, title: e.properties?.hs_title ?? null, contact: contactId, source: "pages" });
    }
    after = res.paging?.next?.after;
    if (!after) break;
  }
  return out;
}

/* ── the list ─────────────────────────────────────────────────────────── */

export type VisitorsList = {
  from: string;
  to: string;
  rows: CustomerRow[];
  /** the pages where the most customers stopped short of an order */
  stops: (SharedStop & { path: string | null })[];
  sources: VisitSources;
  /** the first day the shop's record holds */
  shopFrom: string;
};

const LIST_COMPANIES = 600;

export function listVisitors(from: string, to: string, signal?: AbortSignal): Promise<VisitorsList> {
  return cachedReport(`convert:visits:list:${from}:${to}`, () => buildList(from, to, signal));
}

async function buildList(from: string, to: string, signal?: AbortSignal): Promise<VisitorsList> {
  const connected = !!hubspotToken();
  const [shop, idx] = await Promise.all([shopRows(from, to), signalIndex()]);
  const looksBy = new Map<string, Look[]>();
  for (const r of shop.rows) {
    const id = String(r.company_id);
    (looksBy.get(id) ?? looksBy.set(id, []).get(id)!).push(lookOf(r, idx));
  }

  let hubspot: SourceState = connected ? { state: "ok", note: null } : OFF;
  let contacts: ContactLite[] = [];
  if (connected) {
    try { contacts = await activeContacts(from, to, signal); } catch (e) { hubspot = { state: "error", note: errNote(e) }; }
  }
  const contactsBy = new Map<string, ContactLite[]>();
  for (const c of contacts) if (c.companyId) (contactsBy.get(c.companyId) ?? contactsBy.set(c.companyId, []).get(c.companyId)!).push(c);

  // the companies, the latest seen first - the shop's record and HubSpot's contacts together
  const lastOf = new Map<string, string>();
  for (const [id, ls] of looksBy) lastOf.set(id, ls.reduce((m, l) => (l.at > m ? l.at : m), ""));
  for (const [id, cs] of contactsBy) for (const c of cs) if (c.lastAt && c.lastAt > (lastOf.get(id) ?? "")) lastOf.set(id, c.lastAt);
  const ids = [...lastOf.keys()].sort((a, b) => (lastOf.get(b) ?? "").localeCompare(lastOf.get(a) ?? "")).slice(0, LIST_COMPANIES);

  // names: HubSpot's companies and the contacts the shop's record names that HubSpot's search did not bring
  let companies = new Map<string, CompanyLite>();
  const names = new Map<string, string>(contacts.map((c) => [c.id, c.name]));
  if (connected && hubspot.state === "ok") {
    try {
      companies = await companiesOf(ids, signal);
      const missing = [...new Set(ids.flatMap((id) => (looksBy.get(id) ?? []).map((l) => l.contact)).filter((c): c is string => !!c && !names.has(c)))].slice(0, 300);
      if (missing.length) for (const [cid, p] of await batchRead("contacts", missing, ["firstname", "lastname"], signal)) names.set(cid, nameOfContact(cid, p));
    } catch (e) { hubspot = { state: "error", note: errNote(e) }; }
  }

  // each product's page (de-CH first), so a step and a stop are named by their page and can be opened in Preview
  const paths = await productPaths([...new Set(ids.flatMap((id) => (looksBy.get(id) ?? []).map((l) => l.product)).filter((p): p is string => !!p))], "de-CH");
  const perCompanyStops: Stop[][] = [];
  const rows: CustomerRow[] = [];
  for (const id of ids) {
    const cs = contactsBy.get(id) ?? [];
    const views = cs.map((c) => lastView(c, from, to)).filter((v): v is PageView => !!v);
    const visits = buildVisits(views, looksBy.get(id) ?? [], { productPath: (p) => paths.get(p) ?? null });
    if (!visits.length) continue;
    const stops = stopsOf(visits);
    perCompanyStops.push(stops);
    const co = companies.get(id);
    const fallback = idx?.companies.get(id);
    const seen = new Map<string, { id: string; name: string; lastAt: string | null }>();
    for (const c of cs) seen.set(c.id, { id: c.id, name: c.name, lastAt: c.lastAt });
    for (const v of visits) for (const c of v.contacts) if (!seen.has(c)) seen.set(c, { id: c, name: names.get(c) ?? `Contact ${c}`, lastAt: v.end });
    rows.push({
      id, name: co?.name ?? fallback?.name ?? null, number: co?.number ?? fallback?.number ?? null, country: co?.country ?? fallback?.country ?? null,
      segment: co?.segment ?? null, priority: co?.priority ?? null, owner: co?.owner ?? null,
      store: mostOf(views.map((v) => storeOf(v.path))),
      lastAt: visits[0].end,
      contacts: [...seen.values()].sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")),
      visits: visits.length, articles: visits.reduce((n, v) => n + v.articles, 0), reach: reachOf(visits),
      sources: [...new Set(visits.flatMap((v) => v.sources))], strip: visits[0].steps.slice(0, 16).map((s) => s.kind),
      stop: stops[0] ? { name: stops[0].name, path: stops[0].path, words: stopWords(stops[0]) } : null,
    });
  }

  // the pages where most customers stopped
  const stops = mergeStops(perCompanyStops).slice(0, 8).map((s) => ({ ...s, path: s.path ?? (s.product ? paths.get(s.product) ?? null : null) }));

  return {
    from, to, rows, stops,
    sources: { hubspot, pages: connected ? { state: "partial", note: "The list reads each person's last page; a customer's page opens page by page" } : OFF, shop: shop.state },
    shopFrom: SIGNALS_FROM,
  };
}

/* ── one customer ─────────────────────────────────────────────────────── */

export type CustomerContact = { id: string; name: string; job: string | null; lastAt: string | null; lastPath: string | null; visits: number | null; pageViews: number | null };

export type CustomerVisits = {
  id: string;
  from: string;
  to: string;
  company: CompanyLite;
  /** the store view their pages were on (HubSpot's pages), null when not known */
  store: string | null;
  contacts: CustomerContact[];
  visits: Visit[];
  /** where this customer stopped, and how many companies in the period opened the same product - and ordered it */
  stops: (Stop & { others: { companies: number; ordered: number } | null })[];
  /** the shop's own counters in the period: sign-ins and article views */
  logins: number | null;
  shopViews: number | null;
  sources: VisitSources;
  shopFrom: string;
};

const EVENTS_CONTACTS = 6;

export function customerVisits(id: string, from: string, to: string, signal?: AbortSignal): Promise<CustomerVisits> {
  return cachedReport(`convert:visits:customer:${id}:${from}:${to}`, () => buildCustomer(id, from, to, signal));
}

async function buildCustomer(id: string, from: string, to: string, signal?: AbortSignal): Promise<CustomerVisits> {
  const connected = !!hubspotToken();
  const [shop, idx] = await Promise.all([shopRows(from, to, id), signalIndex()]);
  const looks = shop.rows.map((r) => lookOf(r, idx));

  let hubspot: SourceState = connected ? { state: "ok", note: null } : OFF;
  let pages: SourceState = connected ? { state: "ok", note: null } : OFF;
  let company: CompanyLite = { name: null, number: null, country: null, segment: null, priority: null, owner: null };
  const contacts = new Map<string, ContactLite>();
  const views: PageView[] = [];
  if (connected) {
    try {
      company = (await companiesOf([id], signal)).get(id) ?? company;
      const assoc = await hubspotFetchJson<{ results?: { toObjectId?: number | string }[] }>({
        path: `/crm/v4/objects/companies/${encodeURIComponent(id)}/associations/contacts?limit=100`, signal,
      });
      const ids = new Set((assoc.results ?? []).map((r) => String(r.toObjectId ?? "")).filter(Boolean));
      for (const l of looks) if (l.contact) ids.add(l.contact);
      for (const [cid, p] of await batchRead("contacts", [...ids].slice(0, 200), CONTACT_PROPS, signal)) contacts.set(cid, contactOf(cid, p));
    } catch (e) { hubspot = { state: "error", note: errNote(e) }; pages = { state: "error", note: null }; }

    for (const c of contacts.values()) { const v = lastView(c, from, to); if (v) views.push(v); }
    // page by page, for the contacts seen in the period - the latest first
    const { start } = bounds(from, to);
    const active = [...contacts.values()].filter((c) => c.lastAt && Date.parse(c.lastAt) >= start).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")).slice(0, EVENTS_CONTACTS);
    if (hubspot.state === "ok" && Date.now() < eventsRefusedUntil) pages = { state: "partial", note: EVENTS_REFUSED };
    else if (hubspot.state === "ok") {
      for (const c of active) {
        try { views.push(...await contactPages(c.id, from, to, signal)); } catch (e) {
          const d = describeIntegrationError(e);
          if (refusal(d.error, d.status)) { eventsRefusedUntil = Date.now() + 10 * 60_000; pages = { state: "partial", note: EVENTS_REFUSED }; }
          else pages = { state: "error", note: d.error.slice(0, 200) };
          break;
        }
      }
    }
  } else if (idx?.companies.get(id)) {
    const f = idx.companies.get(id)!;
    company = { ...company, name: f.name || null, number: f.number || null, country: f.country || null };
  }

  const store = mostOf(views.map((v) => storeOf(v.path)));
  const products = [...new Set(looks.map((l) => l.product).filter((p): p is string => !!p))];
  const paths = await productPaths(products, store);
  const visits = buildVisits(views, looks, { productPath: (p) => paths.get(p) ?? null });

  // the same products across every customer of the period: how many opened them, how many ordered
  const stops0 = stopsOf(visits).slice(0, 6);
  const others = await othersOn(stops0.map((s) => s.product).filter((p): p is string => !!p), from, to, idx);
  const stops = stops0.map((s) => ({ ...s, others: s.product ? others.get(s.product) ?? null : null }));

  let logins: number | null = null, shopViews: number | null = null;
  try {
    const r = await query<{ logins: number | null; views: number | null }>(
      `SELECT SUM(logins)::int AS logins, SUM(views)::int AS views FROM apsomh_shop_days WHERE company_id = $1 AND day >= $2::date AND day <= $3::date`, [id, from, to]);
    logins = r.rows[0]?.logins ?? null; shopViews = r.rows[0]?.views ?? null;
  } catch { /* the counters are not kept on this hub */ }

  const used = new Set(visits.flatMap((v) => v.contacts));
  const list: CustomerContact[] = [...contacts.values()]
    .filter((c) => used.has(c.id) || (c.lastAt && c.lastAt >= from))
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""))
    .map((c) => ({ id: c.id, name: c.name, job: c.job, lastAt: c.lastAt, lastPath: shopPathOf(c.lastUrl)?.path ?? null, visits: c.visits, pageViews: c.pageViews }));
  // a contact the shop's record names that HubSpot did not give: listed by id
  for (const c of used) if (!contacts.has(c)) list.push({ id: c, name: `Contact ${c}`, job: null, lastAt: null, lastPath: null, visits: null, pageViews: null });

  return { id, from, to, company, store, contacts: list, visits, stops, logins, shopViews, sources: { hubspot, pages, shop: shop.state }, shopFrom: SIGNALS_FROM };
}

/** Per product: how many companies opened one of its articles in the period, and how many of them ordered it. */
async function othersOn(products: string[], from: string, to: string, idx: SignalIndex | null): Promise<Map<string, { companies: number; ordered: number }>> {
  const out = new Map<string, { companies: number; ordered: number }>();
  if (!products.length) return out;
  const want = new Set(products);
  try {
    const r = await query<{ company_id: string; article: string; product: string; ordered: boolean }>(
      `SELECT company_id, article, product, ordered FROM apsomh_shop_looks WHERE day >= $1::date AND day <= $2::date`, [from, to]);
    const seen = new Map<string, { all: Set<string>; won: Set<string> }>();
    for (const x of r.rows) {
      const p = productNumber(x.product) ?? (x.article ? idx?.facts.get(x.article)?.product ?? null : null);
      if (!p || !want.has(p)) continue;
      const s = seen.get(p) ?? { all: new Set<string>(), won: new Set<string>() };
      s.all.add(String(x.company_id));
      if (x.ordered) s.won.add(String(x.company_id));
      seen.set(p, s);
    }
    for (const [p, s] of seen) out.set(p, { companies: s.all.size, ordered: s.won.size });
  } catch { /* no record kept: no comparison */ }
  return out;
}

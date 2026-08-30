// The customer side of the traffic: what HubSpot's own web tracking knows
// about the companies and contacts behind apsoparts.com visits. Everything
// here is read through the CRM search endpoint with explicit properties, and
// every aggregate states how many records it was computed over.

import { hubspotFetchJson } from "./hubspot";

const SEARCH_PAGE = 100;
/** Search paging is capped by HubSpot; three pages is enough for a window's aggregate. */
const MAX_CONTACT_PAGES = 3;

export type ActiveCompany = {
  id: string;
  name: string | null;
  domain: string | null;
  lastSeen: string | null;
  pageViews: number | null;
  visits: number | null;
  source: string | null;
  lifecycle: string | null;
  apsoCustomer: string | null;
  salesPriority: string | null;
  category: string | null;
};

export type ActiveCompanies = {
  total: number | null;
  rows: ActiveCompany[];
  from: string;
  to: string;
};

export type ContactsCreated = {
  total: number | null;
  /** How many contacts the aggregates below were computed over. */
  aggregated: number;
  bySource: { source: string; count: number }[];
  byFirstUrl: { url: string; count: number }[];
  byLifecycle: { stage: string; count: number }[];
  from: string;
  to: string;
};

type SearchResponse<P> = {
  total?: unknown;
  results?: { id?: string; properties?: P }[];
  paging?: { next?: { after?: string } };
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function total(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Inclusive ISO day → [startMs, endMs) in UTC. */
function bounds(from: string, to: string): { startMs: number; endMs: number } {
  const startMs = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const endMs = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10))) + 86_400_000;
  return { startMs, endMs };
}

type CompanyProps = Record<string, unknown>;

/**
 * Companies whose last session on the site falls inside the window, most
 * recent first. `total` is HubSpot's own count for the window; `rows` are the
 * first `limit` of them.
 */
export async function fetchCompaniesActiveOnSite(params: {
  from: string;
  to: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<ActiveCompanies> {
  const { startMs, endMs } = bounds(params.from, params.to);
  const limit = Math.min(Math.max(params.limit ?? 50, 1), SEARCH_PAGE);

  const res = await hubspotFetchJson<SearchResponse<CompanyProps>>({
    path: "/crm/v3/objects/companies/search",
    method: "POST",
    body: {
      filterGroups: [
        {
          filters: [
            { propertyName: "hs_analytics_last_timestamp", operator: "GTE", value: String(startMs) },
            { propertyName: "hs_analytics_last_timestamp", operator: "LT", value: String(endMs) },
          ],
        },
      ],
      sorts: [{ propertyName: "hs_analytics_last_timestamp", direction: "DESCENDING" }],
      properties: [
        "name",
        "domain",
        "hs_analytics_last_timestamp",
        "hs_analytics_num_page_views",
        "hs_analytics_num_visits",
        "hs_analytics_source",
        "lifecyclestage",
        "apso_customer",
        "sales_priority",
        "a_p_customer_category",
      ],
      limit,
    },
    signal: params.signal,
  });

  const rows: ActiveCompany[] = (res.results ?? []).map((r) => {
    const p = r.properties ?? {};
    return {
      id: r.id ?? "",
      name: str(p.name),
      domain: str(p.domain),
      lastSeen: str(p.hs_analytics_last_timestamp),
      pageViews: num(p.hs_analytics_num_page_views),
      visits: num(p.hs_analytics_num_visits),
      source: str(p.hs_analytics_source),
      lifecycle: str(p.lifecyclestage),
      apsoCustomer: str(p.apso_customer),
      salesPriority: str(p.sales_priority),
      category: str(p.a_p_customer_category),
    };
  });

  return { total: total(res.total), rows, from: params.from, to: params.to };
}

type ContactProps = Record<string, unknown>;

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch {
    return url;
  }
}

/**
 * Contacts created inside the window, aggregated by HubSpot's original
 * source, by the first page they were seen on, and by lifecycle stage.
 * Aggregation walks up to MAX_CONTACT_PAGES pages of results; `aggregated`
 * says how many of `total` that covered.
 */
export async function fetchContactsCreated(params: {
  from: string;
  to: string;
  signal?: AbortSignal;
}): Promise<ContactsCreated> {
  const { startMs, endMs } = bounds(params.from, params.to);
  const bySource = new Map<string, number>();
  const byUrl = new Map<string, number>();
  const byStage = new Map<string, number>();
  let grandTotal: number | null = null;
  let aggregated = 0;
  let after: string | undefined;

  for (let page = 0; page < MAX_CONTACT_PAGES; page++) {
    const res = await hubspotFetchJson<SearchResponse<ContactProps>>({
      path: "/crm/v3/objects/contacts/search",
      method: "POST",
      body: {
        filterGroups: [
          {
            filters: [
              { propertyName: "createdate", operator: "GTE", value: String(startMs) },
              { propertyName: "createdate", operator: "LT", value: String(endMs) },
            ],
          },
        ],
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
        properties: ["hs_analytics_source", "hs_analytics_first_url", "lifecyclestage"],
        limit: SEARCH_PAGE,
        ...(after ? { after } : {}),
      },
      signal: params.signal,
    });
    if (grandTotal === null) grandTotal = total(res.total);
    for (const r of res.results ?? []) {
      const p = r.properties ?? {};
      aggregated += 1;
      const source = str(p.hs_analytics_source) ?? "UNKNOWN";
      bySource.set(source, (bySource.get(source) ?? 0) + 1);
      const first = str(p.hs_analytics_first_url);
      if (first) {
        const path = pathOf(first);
        byUrl.set(path, (byUrl.get(path) ?? 0) + 1);
      }
      const stage = str(p.lifecyclestage) ?? "unknown";
      byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
    }
    after = res.paging?.next?.after;
    if (!after) break;
  }

  const desc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);

  // Custom lifecycle stages come back as numeric ids; show their labels.
  const stageLabels = await propertyLabels("contacts", "lifecyclestage", params.signal).catch(
    () => new Map<string, string>(),
  );

  return {
    total: grandTotal,
    aggregated,
    bySource: desc(bySource).map(([source, count]) => ({ source, count })),
    byFirstUrl: desc(byUrl)
      .slice(0, 25)
      .map(([url, count]) => ({ url, count })),
    byLifecycle: desc(byStage).map(([stage, count]) => ({ stage: stageLabels.get(stage) ?? stage, count })),
    from: params.from,
    to: params.to,
  };
}

/**
 * HubSpot's original-source codes mapped onto GA4's default channel groups,
 * so the two can be laid side by side. The mapping is shown in the UI — it is
 * a naming bridge, not a measurement.
 */
export const HUBSPOT_SOURCE_TO_GA4_CHANNEL: Record<string, string | null> = {
  ORGANIC_SEARCH: "Organic Search",
  PAID_SEARCH: "Paid Search",
  DIRECT_TRAFFIC: "Direct",
  REFERRALS: "Referral",
  SOCIAL_MEDIA: "Organic Social",
  PAID_SOCIAL: "Paid Social",
  EMAIL_MARKETING: "Email",
  OTHER_CAMPAIGNS: "Unassigned",
  OFFLINE: null,
  UNKNOWN: null,
};

/* ── label resolution ──────────────────────────────────────────────────── */

type PropertyOptions = { options?: { value?: string; label?: string }[] };

const labelCache = new Map<string, { at: number; map: Map<string, string> }>();
const LABEL_TTL_MS = 10 * 60 * 1000;

/**
 * value → label for an enumeration property, cached briefly. The portal uses
 * custom lifecycle stages whose values are numeric ids, so without this the
 * UI shows "878465262" where it means "Chat potential lead". On failure the
 * raw values stay — wrong-looking beats invented.
 */
export async function propertyLabels(
  object: "contacts" | "companies",
  property: string,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const key = `${object}.${property}`;
  const hit = labelCache.get(key);
  if (hit && Date.now() - hit.at < LABEL_TTL_MS) return hit.map;
  const res = await hubspotFetchJson<PropertyOptions>({ path: `/crm/v3/properties/${object}/${property}`, signal });
  const map = new Map<string, string>();
  for (const o of res.options ?? []) {
    if (typeof o.value === "string" && typeof o.label === "string") map.set(o.value, o.label);
  }
  labelCache.set(key, { at: Date.now(), map });
  return map;
}

/* ── segment and priority counts for the window ────────────────────────── */

export type SegmentCount = { value: string; label: string; count: number | null };

export type SegmentCounts = {
  apsoSegments: SegmentCount[];
  priorities: SegmentCount[];
  /** Companies in a customer segment active in the window (APSOcore, APSOgrowth, APSOmicro, Growth Engine Customer). */
  customersActive: number | null;
};

const CUSTOMER_SEGMENT_VALUES = new Set(["APSOcore", "APSOgrowth", "APSOmicro", "Growth Engine Customer"]);

async function countWithFilter(
  window: { startMs: number; endMs: number },
  property: string,
  value: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const res = await hubspotFetchJson<{ total?: unknown }>({
    path: "/crm/v3/objects/companies/search",
    method: "POST",
    body: {
      filterGroups: [
        {
          filters: [
            { propertyName: "hs_analytics_last_timestamp", operator: "GTE", value: String(window.startMs) },
            { propertyName: "hs_analytics_last_timestamp", operator: "LT", value: String(window.endMs) },
            { propertyName: property, operator: "EQ", value },
          ],
        },
      ],
      limit: 1,
      properties: [],
    },
    signal,
  });
  return typeof res.total === "number" && Number.isFinite(res.total) ? res.total : null;
}

/**
 * How the companies active in the window split by APSO segment and by sales
 * priority — one count per option, straight off HubSpot's own totals. The
 * calls run sequentially because the search endpoint throttles hard.
 */
export async function fetchSegmentCounts(params: {
  from: string;
  to: string;
  signal?: AbortSignal;
}): Promise<SegmentCounts> {
  const window = bounds(params.from, params.to);
  const [segLabels, prioLabels] = await Promise.all([
    propertyLabels("companies", "apso_customer", params.signal).catch(() => new Map<string, string>()),
    propertyLabels("companies", "sales_priority", params.signal).catch(() => new Map<string, string>()),
  ]);

  const apsoSegments: SegmentCount[] = [];
  for (const [value, label] of segLabels.size ? segLabels : new Map([["APSOcore", "APSOcore"]])) {
    apsoSegments.push({ value, label, count: await countWithFilter(window, "apso_customer", value, params.signal) });
  }
  const priorities: SegmentCount[] = [];
  for (const [value, label] of prioLabels) {
    priorities.push({ value, label, count: await countWithFilter(window, "sales_priority", value, params.signal) });
  }
  apsoSegments.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  priorities.sort((a, b) => a.value.localeCompare(b.value));

  let customersActive: number | null = null;
  for (const s of apsoSegments) {
    if (CUSTOMER_SEGMENT_VALUES.has(s.value) && s.count !== null) {
      customersActive = (customersActive ?? 0) + s.count;
    }
  }
  return { apsoSegments, priorities, customersActive };
}

/* ── one company, up close ─────────────────────────────────────────────── */

export type CompanyContact = {
  id: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
  lastSeen: string | null;
  pageViews: number | null;
};

export type CompanyVisit = { at: string; url: string; title: string | null; contact: string };

export type CompanyDetail = {
  companyId: string;
  contacts: CompanyContact[];
  /** Null when the token lacks the web-analytics scope; `visitsError` says so. */
  visits: CompanyVisit[] | null;
  visitsError: string | null;
};

type AssocResponse = { results?: { toObjectId?: number | string }[] };
type BatchRead = { results?: { id?: string; properties?: Record<string, unknown> }[] };
type EventsResponse = { results?: { occurredAt?: string; properties?: { hs_url?: string; hs_title?: string } }[] };

const DETAIL_CONTACTS = 10;
const VISITS_PER_CONTACT = 8;
const VISITS_CONTACTS = 3;
const VISITS_TOTAL = 20;

export async function fetchCompanyDetail(params: { id: string; signal?: AbortSignal }): Promise<CompanyDetail> {
  const assoc = await hubspotFetchJson<AssocResponse>({
    path: `/crm/v4/objects/companies/${encodeURIComponent(params.id)}/associations/contacts?limit=${DETAIL_CONTACTS}`,
    signal: params.signal,
  });
  const ids = (assoc.results ?? [])
    .map((r) => r.toObjectId)
    .filter((v): v is number | string => v !== undefined)
    .map(String);

  let contacts: CompanyContact[] = [];
  if (ids.length) {
    const batch = await hubspotFetchJson<BatchRead>({
      path: "/crm/v3/objects/contacts/batch/read",
      method: "POST",
      body: {
        inputs: ids.map((id) => ({ id })),
        properties: ["firstname", "lastname", "email", "jobtitle", "hs_analytics_last_timestamp", "hs_analytics_num_page_views"],
      },
      signal: params.signal,
    });
    contacts = (batch.results ?? []).map((r) => {
      const p = r.properties ?? {};
      const first = typeof p.firstname === "string" ? p.firstname : "";
      const last = typeof p.lastname === "string" ? p.lastname : "";
      const email = typeof p.email === "string" && p.email ? p.email : null;
      return {
        id: r.id ?? "",
        name: `${first} ${last}`.trim() || email || `Contact ${r.id}`,
        email,
        jobTitle: typeof p.jobtitle === "string" && p.jobtitle ? p.jobtitle : null,
        lastSeen: typeof p.hs_analytics_last_timestamp === "string" && p.hs_analytics_last_timestamp ? p.hs_analytics_last_timestamp : null,
        pageViews:
          typeof p.hs_analytics_num_page_views === "string" && p.hs_analytics_num_page_views
            ? Number(p.hs_analytics_num_page_views)
            : null,
      };
    });
    contacts.sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
  }

  let visits: CompanyVisit[] | null = [];
  let visitsError: string | null = null;
  try {
    const merged: CompanyVisit[] = [];
    for (const c of contacts.slice(0, VISITS_CONTACTS)) {
      const ev = await hubspotFetchJson<EventsResponse>({
        path: `/events/v3/events?objectType=contact&objectId=${encodeURIComponent(c.id)}&eventType=e_visited_page&limit=${VISITS_PER_CONTACT}&sort=-occurredAt`,
        signal: params.signal,
      });
      for (const e of ev.results ?? []) {
        if (!e.occurredAt || !e.properties?.hs_url) continue;
        let path = e.properties.hs_url;
        try {
          path = new URL(e.properties.hs_url).pathname || "/";
        } catch {
          /* keep raw */
        }
        merged.push({ at: e.occurredAt, url: path, title: e.properties.hs_title ?? null, contact: c.name });
      }
    }
    merged.sort((a, b) => b.at.localeCompare(a.at));
    visits = merged.slice(0, VISITS_TOTAL);
  } catch (err) {
    visits = null;
    visitsError = err instanceof Error ? err.message : "Page-visit events could not be read.";
  }

  return { companyId: params.id, contacts, visits, visitsError };
}

/* ── the journeys of actual customers ──────────────────────────────────── */

export type CustomerJourney = {
  id: string;
  name: string | null;
  domain: string | null;
  segment: string | null;
  priority: string | null;
  lastSeen: string | null;
  contactsChecked: number;
  visits: CompanyVisit[] | null;
  visitsError: string | null;
};

export type CustomerJourneys = {
  from: string;
  to: string;
  /** How many customer-segment companies were active; journeys cover the first `companies.length`. */
  customersActive: number;
  companies: CustomerJourney[];
};

const JOURNEY_COMPANIES = 4;
const JOURNEY_CONTACTS = 2;
const JOURNEY_VISITS_EACH = 6;

/**
 * The most recently active companies in a customer segment, each with the
 * pages their people actually opened. Everything runs sequentially — this is
 * many small calls against a rate-limited API, and slower-but-answers beats
 * fast-but-429.
 */
export async function fetchCustomerJourneys(params: {
  from: string;
  to: string;
  signal?: AbortSignal;
}): Promise<CustomerJourneys> {
  const active = await fetchCompaniesActiveOnSite({ from: params.from, to: params.to, limit: 40, signal: params.signal });
  const customers = active.rows.filter((r) => r.apsoCustomer && CUSTOMER_SEGMENT_VALUES.has(r.apsoCustomer));
  const picked = customers.slice(0, JOURNEY_COMPANIES);

  const companies: CustomerJourney[] = [];
  for (const c of picked) {
    const detail = await fetchCompanyDetailLimited(c.id, params.signal);
    companies.push({
      id: c.id,
      name: c.name,
      domain: c.domain,
      segment: c.apsoCustomer,
      priority: c.salesPriority,
      lastSeen: c.lastSeen,
      contactsChecked: detail.contactsChecked,
      visits: detail.visits,
      visitsError: detail.visitsError,
    });
  }

  return { from: params.from, to: params.to, customersActive: customers.length, companies };
}

async function fetchCompanyDetailLimited(
  id: string,
  signal?: AbortSignal,
): Promise<{ contactsChecked: number; visits: CompanyVisit[] | null; visitsError: string | null }> {
  const assoc = await hubspotFetchJson<AssocResponse>({
    path: `/crm/v4/objects/companies/${encodeURIComponent(id)}/associations/contacts?limit=${JOURNEY_CONTACTS}`,
    signal,
  });
  const ids = (assoc.results ?? [])
    .map((r) => r.toObjectId)
    .filter((v): v is number | string => v !== undefined)
    .map(String);
  if (ids.length === 0) return { contactsChecked: 0, visits: [], visitsError: null };

  const batch = await hubspotFetchJson<BatchRead>({
    path: "/crm/v3/objects/contacts/batch/read",
    method: "POST",
    body: { inputs: ids.map((cid) => ({ id: cid })), properties: ["firstname", "lastname", "email"] },
    signal,
  });
  const names = new Map<string, string>();
  for (const r of batch.results ?? []) {
    const p = r.properties ?? {};
    const first = typeof p.firstname === "string" ? p.firstname : "";
    const last = typeof p.lastname === "string" ? p.lastname : "";
    const email = typeof p.email === "string" ? p.email : "";
    names.set(r.id ?? "", `${first} ${last}`.trim() || email || `Contact ${r.id}`);
  }

  try {
    const merged: CompanyVisit[] = [];
    for (const cid of ids) {
      const ev = await hubspotFetchJson<EventsResponse>({
        path: `/events/v3/events?objectType=contact&objectId=${encodeURIComponent(cid)}&eventType=e_visited_page&limit=${JOURNEY_VISITS_EACH}&sort=-occurredAt`,
        signal,
      });
      for (const e of ev.results ?? []) {
        if (!e.occurredAt || !e.properties?.hs_url) continue;
        let path = e.properties.hs_url;
        try {
          path = new URL(e.properties.hs_url).pathname || "/";
        } catch {
          /* keep raw */
        }
        merged.push({ at: e.occurredAt, url: path, title: e.properties.hs_title ?? null, contact: names.get(cid) ?? "" });
      }
    }
    merged.sort((a, b) => b.at.localeCompare(a.at));
    return { contactsChecked: ids.length, visits: merged, visitsError: null };
  } catch (err) {
    return {
      contactsChecked: ids.length,
      visits: null,
      visitsError: err instanceof Error ? err.message : "Page-visit events could not be read.",
    };
  }
}

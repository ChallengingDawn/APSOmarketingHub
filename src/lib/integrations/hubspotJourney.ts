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

  return {
    total: grandTotal,
    aggregated,
    bySource: desc(bySource).map(([source, count]) => ({ source, count })),
    byFirstUrl: desc(byUrl)
      .slice(0, 25)
      .map(([url, count]) => ({ url, count })),
    byLifecycle: desc(byStage).map(([stage, count]) => ({ stage, count })),
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

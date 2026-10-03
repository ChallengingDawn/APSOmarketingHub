// E-SHOP ACTIVITY, PER CUSTOMER.
//
// The desktop E-Shop Data Tracker reads Performis and has to be exported by
// hand. Its customer figures already reach HubSpot every night — the
// `n_of_logins_datatracker` and `n_of_views_datatracker` properties, one pair
// per year — so this screen is the same table, live, with no export step.
//
// Why these numbers and not GA4's: logins and views here are counted by the
// shop itself on an essential-cookie basis, so they cover every customer.
// GA4 only ever sees the consented ones, and it has no customer identity at
// all, so it cannot answer "which company looked at what" for any price.
//
// What is NOT here, and why: the tracker's Orders and Total value columns count
// SHOP orders in the filtered period. Counting those per company would be one
// search per company — thousands of throttled calls — so this screen shows the
// ERP revenue already on the company record instead, and says so in the header.

import { hubspotFetchJson } from "./hubspot";

/** The years the Datatracker has written. 2026 lives on the unsuffixed pair. */
export const ESHOP_YEARS = [2026, 2025, 2024, 2023, 2022, 2021] as const;
export type EshopYear = (typeof ESHOP_YEARS)[number];

const loginsProp = (year: EshopYear) => (year === 2026 ? "n_of_logins_datatracker" : `n_of_logins_datatracker_${year}`);
const viewsProp = (year: EshopYear) => (year === 2026 ? "n_of_views_datatracker" : `n_of_views_datatracker_${year}`);

/** One day of the live counters, as the smart bar writes them. */
export type ActivityLine = {
  t: string;
  article: string | null;
  product: string | null;
  qty: number | null;
  cart: boolean;
  ordered: boolean;
};

type ActivityJson = {
  days?: Record<string, { v?: number; l?: number; c?: number; o?: number }>;
  /**
   * One line per article per day. `a` is the 10-digit ARTICLE, `p` the 8-digit
   * product page when no variant was chosen - they are different numbers and
   * only `a` joins to stock, price and orders. `q` is the quantity the customer
   * typed, `c` that it went in the cart, `o` that it was bought.
   */
  recent?: { t?: string; a?: string; p?: string; q?: number; c?: number; o?: number }[];
};

/** Sum the live counters between two ISO days, inclusive. Null when untouched. */
export function sumRange(raw: unknown, from: string, to: string): { views: number | null; logins: number | null; days: number } {
  if (typeof raw !== "string" || !raw) return { views: null, logins: null, days: 0 };
  let parsed: ActivityJson;
  try { parsed = JSON.parse(raw) as ActivityJson; } catch { return { views: null, logins: null, days: 0 }; }
  const days = parsed.days ?? {};
  let views = 0, logins = 0, touched = 0;
  for (const [day, counts] of Object.entries(days)) {
    if (day < from || day > to) continue;
    views += counts?.v ?? 0;
    logins += counts?.l ?? 0;
    touched++;
  }
  return touched ? { views, logins, days: touched } : { views: null, logins: null, days: 0 };
}

export type EshopRow = {
  id: string;
  mandant: string | null;
  customerNumber: string | null;
  name: string | null;
  logins: number | null;
  views: number | null;
  /** Views per login — how deep a visit goes, not how often they come. */
  viewsPerLogin: number | null;
  /** The same two figures over the requested range, from the live JSON. Null
   *  until the smart bar has written something for that company. */
  rangeViews: number | null;
  rangeLogins: number | null;
  /** The newest articles this customer opened, newest last. */
  recent: ActivityLine[];
  revenueYtd: number | null;
  country: string | null;
  representative: string | null;
  apsoCustomer: string | null;
  salesPriority: string | null;
  /** The remaining desktop-tracker columns, shown in the opened row. */
  shortAddress: string | null;
  phone: string | null;
  usageClass: string | null;
  deliveryCondition: string | null;
  paymentCondition: string | null;
  /**
   * Every year the Datatracker holds, oldest first. HubSpot carries yearly
   * totals and nothing finer, so this is the whole history available — a week
   * or a month would need daily rows loaded from Performis, which nothing does.
   */
  history: { year: EshopYear; logins: number | null; views: number | null }[];
};

export type EshopActivity = {
  year: EshopYear;
  /** The window the live counters cover. */
  from: string;
  to: string;
  /** True when at least one row carries live data — the page says so when not. */
  anyLive: boolean;
  /** Cursor for the next page, absent on the last one. */
  after: string | null;
  rows: EshopRow[];
  /** How many companies match the filters, not how many rows came back. */
  total: number | null;
  /** The filter values actually present, for the pickers. */
  countries: string[];
  mandants: string[];
  generatedAt: string;
};

export type EshopFilters = {
  year?: EshopYear;
  country?: string;
  mandant?: string;
  representative?: string;
  apsoCustomer?: string;
  priority?: string;
  /** HubSpot search cursor, for "load more". */
  after?: string;
  /** Rank by views, logins or revenue. */
  sort?: "views" | "logins" | "revenue";
  limit?: number;
  /** Inclusive ISO days for the live counters. Defaults to the last 30 days. */
  from?: string;
  to?: string;
  /**
   * "year" ranks on the Datatracker's yearly total; "range" lists only the
   * companies that have live counters at all. HubSpot cannot filter inside a
   * JSON property, so a range cannot be a server-side condition — narrowing to
   * companies that carry `eshop_activity` is as close as the API gets, and the
   * caller drops the ones with nothing inside the dates.
   */
  mode?: "year" | "range";
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

type SearchResponse = {
  total?: number;
  results?: { id?: string; properties?: Record<string, unknown> }[];
  paging?: { next?: { after?: string } };
};

/** id → name for the HubSpot owners, read once and kept for the process. */
let ownerNames: Map<string, string> | null = null;
export async function owners(signal?: AbortSignal): Promise<Map<string, string>> {
  if (ownerNames) return ownerNames;
  try {
    const res = await hubspotFetchJson<{ results?: { id?: string; firstName?: string; lastName?: string; email?: string }[] }>({
      path: "/crm/v3/owners?limit=500",
      signal,
    });
    ownerNames = new Map(
      (res.results ?? []).map((o) => [
        String(o.id ?? ""),
        [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || "",
      ]),
    );
  } catch {
    ownerNames = new Map();          // a missing owner name is a blank cell, not an error page
  }
  return ownerNames;
}

export async function fetchEshopActivity(filters: EshopFilters = {}, signal?: AbortSignal): Promise<EshopActivity> {
  const year = filters.year ?? 2026;
  const logins = loginsProp(year);
  const views = viewsProp(year);
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);

  const sortProperty = filters.sort === "logins" ? logins : filters.sort === "revenue" ? "erp_rev_ytd_cy" : views;

  // Only companies the shop actually saw that year. Without this the ranking is
  // padded with thousands of companies that have no activity at all.
  const conditions: { propertyName: string; operator: string; value?: string }[] =
    filters.mode === "range"
      ? [{ propertyName: "eshop_activity", operator: "HAS_PROPERTY" }]
      : [{ propertyName: views, operator: "GT", value: "0" }];
  if (filters.country) conditions.push({ propertyName: "country_custom", operator: "EQ", value: filters.country });
  if (filters.mandant) conditions.push({ propertyName: "mandant", operator: "EQ", value: filters.mandant });
  if (filters.representative) conditions.push({ propertyName: "hubspot_owner_id", operator: "EQ", value: filters.representative });
  if (filters.apsoCustomer) conditions.push({ propertyName: "apso_customer", operator: "EQ", value: filters.apsoCustomer });
  if (filters.priority) conditions.push({ propertyName: "sales_priority", operator: "EQ", value: filters.priority });

  const res = await hubspotFetchJson<SearchResponse>({
    path: "/crm/v3/objects/companies/search",
    method: "POST",
    body: {
      filterGroups: [{ filters: conditions }],
      properties: [
        "name", "company_unique_number", "mandant", logins, views,
        // every year, so a row can show whether this customer is growing or dying
        ...ESHOP_YEARS.flatMap((y) => [loginsProp(y), viewsProp(y)]),
        "erp_rev_ytd_cy", "country_custom", "apso_customer", "sales_priority",
        // The columns the desktop E-Shop Data Tracker carries that this screen
        // did not: short address, phone, usage class, delivery and payment.
        "compass_customer_short_address", "phone", "compass_customer_class",
        "compass_delivery_condition", "compass_payment_condition",
        // The representative IS the company owner (SARCLA, 01.10). ownername and
        // owneremail are empty on these records, so the id is resolved against
        // the owners API rather than read off the company.
        "hubspot_owner_id",
        "eshop_activity",
      ],
      sorts: [{ propertyName: sortProperty, direction: "DESCENDING" }],
      limit,
      ...(filters.after ? { after: filters.after } : {}),
    },
    signal,
  });

  const to = filters.to ?? new Date().toISOString().slice(0, 10);
  const from = filters.from ?? new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const ownerIndex = await owners(signal);
  const rows: EshopRow[] = (res.results ?? []).map((r) => {
    const p = r.properties ?? {};
    const l = num(p[logins]);
    const v = num(p[views]);
    return {
      id: String(r.id ?? ""),
      mandant: str(p.mandant),
      customerNumber: str(p.company_unique_number),
      name: str(p.name),
      logins: l,
      views: v,
      viewsPerLogin: v != null && l ? v / l : null,
      revenueYtd: num(p.erp_rev_ytd_cy),
      country: str(p.country_custom),
      representative: ownerIndex.get(String(p.hubspot_owner_id ?? "")) ?? null,
      apsoCustomer: str(p.apso_customer),
      salesPriority: str(p.sales_priority),
      shortAddress: str(p.compass_customer_short_address),
      phone: str(p.phone),
      usageClass: str(p.compass_customer_class),
      deliveryCondition: str(p.compass_delivery_condition),
      paymentCondition: str(p.compass_payment_condition),
      rangeViews: sumRange(p.eshop_activity, from, to).views,
      rangeLogins: sumRange(p.eshop_activity, from, to).logins,
      recent: (() => {
        try {
          const j = JSON.parse(String(p.eshop_activity ?? "")) as ActivityJson;
          return (j.recent ?? [])
            .filter((r) => r?.t && (r.a || r.p))
            .map((r) => ({
              t: String(r.t),
              article: r.a ? String(r.a) : null,
              product: r.p ? String(r.p) : null,
              qty: typeof r.q === "number" && r.q > 0 ? r.q : null,
              cart: r.c === 1,
              ordered: r.o === 1,
            }))
            .slice(-12);
        } catch { return []; }
      })(),
      history: [...ESHOP_YEARS]
        .sort((a, b) => a - b)
        .map((y) => ({ year: y, logins: num(p[loginsProp(y)]), views: num(p[viewsProp(y)]) })),
    };
  });

  return {
    year,
    from,
    to,
    anyLive: rows.some((r) => r.rangeViews != null || r.rangeLogins != null),
    after: res.paging?.next?.after ?? null,
    rows,
    total: typeof res.total === "number" ? res.total : null,
    countries: [...new Set(rows.map((r) => r.country).filter((c): c is string => !!c))].sort(),
    mandants: [...new Set(rows.map((r) => r.mandant).filter((m): m is string => !!m))].sort(),
    generatedAt: new Date().toISOString(),
  };
}

/** The option lists for the pickers, read from the property definitions. */
export async function fetchEshopFilterOptions(signal?: AbortSignal): Promise<{
  countries: string[];
  mandants: string[];
  apsoCustomers: string[];
  priorities: string[];
  representatives: { id: string; name: string }[];
}> {
  const read = async (property: string) => {
    const res = await hubspotFetchJson<{ options?: { label?: string; value?: string }[] }>({
      path: `/crm/v3/properties/companies/${property}`,
      signal,
    });
    return (res.options ?? []).map((o) => o.value).filter((v): v is string => !!v);
  };
  const [countries, mandants, apsoCustomers] = [
    await read("country_custom"),
    await read("mandant"),
    await read("apso_customer"),
  ];
  const priorities = await read("sales_priority");
  const index = await owners(signal);
  const representatives = [...index.entries()]
    .filter(([, name]) => name)
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { countries, mandants, apsoCustomers, priorities, representatives };
}

/** What the shop told us about one article, aggregated across every customer. */
export type ArticleLooks = {
  views: number;
  customers: number;
  carts: number;
  lastSeen: string | null;
  topQty: number | null;
};

/**
 * Per-article activity, built from the live feed rather than from GA4.
 *
 * GA4 only ever sees consented sessions and has no customer identity, so its
 * item views were both smaller than the truth and unattributable. The shop now
 * reports the article itself - off the ERP price lookup, which fires for every
 * signed-in customer whatever they chose on the cookie banner - so these counts
 * are the ones the Article tab should show.
 *
 * One scan of the companies carrying activity, so it is cached by the route.
 */
export async function fetchArticleLooks(signal?: AbortSignal): Promise<Record<string, ArticleLooks>> {
  const byArticle: Record<string, ArticleLooks & { seen: Set<string> }> = {};
  let after: string | undefined;
  let scanned = 0;

  do {
    const res = await hubspotFetchJson<SearchResponse>({
      path: "/crm/v3/objects/companies/search",
      method: "POST",
      signal,
      body: {
        filterGroups: [{ filters: [{ propertyName: "eshop_activity", operator: "HAS_PROPERTY" }] }],
        properties: ["eshop_activity"],
        limit: 100,
        after,
      },
    });
    for (const r of res.results ?? []) {
      scanned++;
      const raw = (r.properties ?? {}).eshop_activity;
      let parsed: ActivityJson;
      try { parsed = JSON.parse(String(raw ?? "")) as ActivityJson; } catch { continue; }
      for (const line of parsed.recent ?? []) {
        // Only the ten-digit article. A product page is not an article.
        const a = line?.a;
        if (!a || !/^\d{10}$/.test(String(a))) continue;
        const cur = byArticle[a] ?? { views: 0, customers: 0, carts: 0, lastSeen: null, topQty: null, seen: new Set<string>() };
        cur.views += 1;
        cur.seen.add(String(r.id ?? ""));
        if (line.c === 1) cur.carts += 1;
        if (typeof line.q === "number" && (cur.topQty == null || line.q > cur.topQty)) cur.topQty = line.q;
        const t = line.t ? String(line.t) : null;
        if (t && (cur.lastSeen == null || t > cur.lastSeen)) cur.lastSeen = t;
        byArticle[a] = cur;
      }
    }
    after = res.paging?.next?.after;
    if (scanned >= 3000) break;          // a guard, not a quota
  } while (after);

  const out: Record<string, ArticleLooks> = {};
  for (const [a, v] of Object.entries(byArticle)) {
    out[a] = { views: v.views, customers: v.seen.size, carts: v.carts, lastSeen: v.lastSeen, topQty: v.topQty };
  }
  return out;
}

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

export type EshopRow = {
  id: string;
  mandant: string | null;
  customerNumber: string | null;
  name: string | null;
  logins: number | null;
  views: number | null;
  /** Views per login — how deep a visit goes, not how often they come. */
  viewsPerLogin: number | null;
  revenueYtd: number | null;
  country: string | null;
  representative: string | null;
  apsoCustomer: string | null;
  salesPriority: string | null;
  /**
   * Every year the Datatracker holds, oldest first. HubSpot carries yearly
   * totals and nothing finer, so this is the whole history available — a week
   * or a month would need daily rows loaded from Performis, which nothing does.
   */
  history: { year: EshopYear; logins: number | null; views: number | null }[];
};

export type EshopActivity = {
  year: EshopYear;
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
  /** Rank by views, logins or revenue. */
  sort?: "views" | "logins" | "revenue";
  limit?: number;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

type SearchResponse = {
  total?: number;
  results?: { id?: string; properties?: Record<string, unknown> }[];
};

/** id → name for the HubSpot owners, read once and kept for the process. */
let ownerNames: Map<string, string> | null = null;
async function owners(signal?: AbortSignal): Promise<Map<string, string>> {
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
  const conditions: { propertyName: string; operator: string; value?: string }[] = [
    { propertyName: views, operator: "GT", value: "0" },
  ];
  if (filters.country) conditions.push({ propertyName: "country_custom", operator: "EQ", value: filters.country });
  if (filters.mandant) conditions.push({ propertyName: "mandant", operator: "EQ", value: filters.mandant });
  if (filters.representative) conditions.push({ propertyName: "sa__sales_agent", operator: "EQ", value: filters.representative });
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
        // ownername and owneremail are empty on these records, so the rep comes
        // from the ERP's own sales agent, with the HubSpot owner as a fallback.
        "sa__sales_agent", "hubspot_owner_id",
      ],
      sorts: [{ propertyName: sortProperty, direction: "DESCENDING" }],
      limit,
    },
    signal,
  });

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
      representative: str(p.sa__sales_agent) ?? ownerIndex.get(String(p.hubspot_owner_id ?? "")) ?? null,
      apsoCustomer: str(p.apso_customer),
      salesPriority: str(p.sales_priority),
      history: [...ESHOP_YEARS]
        .sort((a, b) => a - b)
        .map((y) => ({ year: y, logins: num(p[loginsProp(y)]), views: num(p[viewsProp(y)]) })),
    };
  });

  return {
    year,
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
  representatives: string[];
  priorities: string[];
}> {
  const read = async (property: string) => {
    const res = await hubspotFetchJson<{ options?: { label?: string; value?: string }[] }>({
      path: `/crm/v3/properties/companies/${property}`,
      signal,
    });
    return (res.options ?? []).map((o) => o.value).filter((v): v is string => !!v);
  };
  const [countries, mandants, apsoCustomers, representatives] = [
    await read("country_custom"),
    await read("mandant"),
    await read("apso_customer"),
    await read("sa__sales_agent"),
  ];
  const priorities = await read("sales_priority");
  return { countries, mandants, apsoCustomers, representatives, priorities };
}

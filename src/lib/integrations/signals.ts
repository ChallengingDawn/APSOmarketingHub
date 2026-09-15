// COOKIE-FREE SIGNALS — what the CRM knows about every customer without any
// browser tracking, so it also covers visitors who chose "necessary cookies
// only": ERP order intake and first orders on companies (Compass), form
// enquiries on contacts, e-shop account activity loaded from the Performis
// E-Shop Data Tracker, and web orders the Magento connector writes server to
// server. Every figure is a HubSpot search total — nothing sampled, scaled or
// modelled — and a property the portal does not have yields null, never 0.

import { hubspotFetchJson } from "./hubspot";
import { IntegrationError } from "./status";

type Filter = { propertyName: string; operator: string; value?: string };

async function countWhere(
  object: "companies" | "contacts" | "orders",
  filters: Filter[],
  signal?: AbortSignal,
): Promise<number | null> {
  const res = await hubspotFetchJson<{ total?: unknown }>({
    path: `/crm/v3/objects/${object}/search`,
    method: "POST",
    body: { filterGroups: [{ filters }], limit: 1, properties: [] },
    signal,
  });
  return typeof res.total === "number" && Number.isFinite(res.total) ? res.total : null;
}

async function companyPropertyNames(signal?: AbortSignal): Promise<Set<string>> {
  const res = await hubspotFetchJson<{ results?: { name?: unknown }[] }>({ path: "/crm/v3/properties/companies", signal });
  const names = (res.results ?? []).map((p) => (typeof p.name === "string" ? p.name : ""));
  return new Set(names.filter((n) => n.length > 0));
}

/** The last `count` calendar months (UTC), oldest first; the current, still running month is last. */
export function lastMonths(count: number, nowMs = Date.now()): { month: string; from: number; to: number }[] {
  const now = new Date(nowMs);
  const out: { month: string; from: number; to: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    const to = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1);
    out.push({ month: new Date(from).toISOString().slice(0, 7), from, to });
  }
  return out;
}

const gt0 = (propertyName: string): Filter => ({ propertyName, operator: "GT", value: "0" });

export type BuyerSignals = {
  year: number;
  /** Companies with ERP order intake (oi_YYYY) above zero this year. */
  buyersThisYear: number | null;
  buyersLastYear: number | null;
  /** Companies that ordered last year AND again this year. */
  repeatBuyers: number | null;
  /** Companies whose first Compass order fell in `year`. */
  newBuyers: number | null;
  /** Properties the portal does not have, so their figures are null. */
  missingProperties: string[];
};

export type EnquiryMonth = {
  month: string;
  /**
   * Contacts whose latest form submission in the month was a customer-facing
   * Contact Us / Returns form (form names carry "Customer Facing"). A MINIMUM:
   * HubSpot's searchable recent_conversion_* fields hold only each contact's
   * latest conversion (every submission is still stored on the record), and
   * automated forms (Magento order and cart summaries, ~1,800 contacts a month),
   * internal sales-visit forms, surveys and the consent-sync form replace an
   * earlier enquiry as "latest".
   */
  contacts: number | null;
  /** …of which HubSpot recorded no page view at all (no browsing history on the record). */
  withoutPageViews: number | null;
};

export type EshopYear = { year: number; companiesWithLogins: number | null; companiesWithOrders: number | null };

export type CookieFreeSignals = {
  generatedAt: string;
  buyers: BuyerSignals;
  enquiries: EnquiryMonth[];
  eshop: EshopYear[];
};

const ENQUIRY_MONTHS = 7;

/**
 * All counts run one after another through the throttled search queue — about
 * thirty calls, so the route caches the result for five minutes.
 */
export async function fetchCookieFreeSignals(params: { year: number; signal?: AbortSignal }): Promise<CookieFreeSignals> {
  const { year, signal } = params;
  const props = await companyPropertyNames(signal);
  const oiThis = `oi_${year}`;
  const oiLast = `oi_${year - 1}`;
  const missingProperties = [oiThis, oiLast, "compass_first_order_year"].filter((p) => !props.has(p));

  const buyersThisYear = props.has(oiThis) ? await countWhere("companies", [gt0(oiThis)], signal) : null;
  const buyersLastYear = props.has(oiLast) ? await countWhere("companies", [gt0(oiLast)], signal) : null;
  const repeatBuyers =
    props.has(oiThis) && props.has(oiLast) ? await countWhere("companies", [gt0(oiLast), gt0(oiThis)], signal) : null;
  const newBuyers = props.has("compass_first_order_year")
    ? await countWhere("companies", [{ propertyName: "compass_first_order_year", operator: "EQ", value: String(year) }], signal)
    : null;

  const enquiries: EnquiryMonth[] = [];
  for (const m of lastMonths(ENQUIRY_MONTHS)) {
    // "Facing" matches the customer-facing Contact Us / Returns forms ("DE_Customer Facing | Contact Us
    // Form_2507" and its language twins): 127 of 2,401 latest conversions in Aug 2026, identical to a
    // full manual tally. The rest were Magento order and cart summaries, internal visit forms, customer
    // surveys, newsletter sign-ups, 3D-file and smart-bar requests, and from 11.09 the consent-sync form.
    // Sandbox test clones of the contact form are excluded.
    const inMonth: Filter[] = [
      { propertyName: "recent_conversion_date", operator: "GTE", value: String(m.from) },
      { propertyName: "recent_conversion_date", operator: "LT", value: String(m.to) },
      { propertyName: "recent_conversion_event_name", operator: "CONTAINS_TOKEN", value: "Facing" },
      { propertyName: "recent_conversion_event_name", operator: "NOT_CONTAINS_TOKEN", value: "SANDBOX" },
    ];
    const contacts = await countWhere("contacts", inMonth, signal);
    const withoutPageViews = await countWhere(
      "contacts",
      [...inMonth, { propertyName: "hs_analytics_num_page_views", operator: "EQ", value: "0" }],
      signal,
    );
    enquiries.push({ month: m.month, contacts, withoutPageViews });
  }

  // The tracker is loaded yearly from Performis exports, so the years present are
  // whatever properties exist — read from the schema, not assumed.
  const eshopYears = [...props]
    .map((name) => /^n_of_logins_datatracker_(\d{4})$/.exec(name))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  const eshop: EshopYear[] = [];
  for (const y of eshopYears) {
    const companiesWithLogins = await countWhere("companies", [gt0(`n_of_logins_datatracker_${y}`)], signal);
    const ordersProp = `orders_datatracker_${y}`;
    const companiesWithOrders = props.has(ordersProp) ? await countWhere("companies", [gt0(ordersProp)], signal) : null;
    eshop.push({ year: y, companiesWithLogins, companiesWithOrders });
  }

  return {
    generatedAt: new Date().toISOString(),
    buyers: { year, buyersThisYear, buyersLastYear, repeatBuyers, newBuyers, missingProperties },
    enquiries,
    eshop,
  };
}

/** The Magento connector has written web orders live since Monday 6 July 2026; earlier records are its backfill. */
export const WEB_ORDERS_LIVE_FROM = "2026-07-06";
const DAY_MS = 86_400_000;
const MAX_WEEKS = 26;

export type WebOrderWeek = { week: string; records: number | null };
export type WebOrders = { weeks: WebOrderWeek[]; liveFrom: string };

/**
 * Web order records per Monday-to-Sunday week (UTC calendar days, as the connector
 * writes order_order_date): orders the Magento connector wrote into HubSpot
 * (order_source_system = magento). Nearly all are already linked to their ERP order;
 * the newest days can still be provisional. They are NOT checked against Magento's own
 * order count: from the week of 10 Aug 2026 several weeks hold fewer records than GA4
 * counted purchases from consenting visitors alone (e.g. 188 vs 462), so orders are
 * missing there. The page therefore compares the two per week instead of showing totals.
 */
export async function fetchWebOrders(params: { nowMs?: number; signal?: AbortSignal }): Promise<WebOrders> {
  const now = new Date(params.nowMs ?? Date.now());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const thisMonday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS;
  const liveFrom = Date.parse(`${WEB_ORDERS_LIVE_FROM}T00:00:00Z`);
  const start = Math.max(liveFrom, thisMonday - (MAX_WEEKS - 1) * 7 * DAY_MS);
  const out: WebOrderWeek[] = [];
  try {
    for (let wk = start; wk <= thisMonday; wk += 7 * DAY_MS) {
      const records = await countWhere(
        "orders",
        [
          { propertyName: "order_source_system", operator: "EQ", value: "magento" },
          { propertyName: "order_order_date", operator: "GTE", value: String(wk) },
          { propertyName: "order_order_date", operator: "LT", value: String(wk + 7 * DAY_MS) },
        ],
        params.signal,
      );
      out.push({ week: new Date(wk).toISOString().slice(0, 10), records });
    }
  } catch (err) {
    if (err instanceof IntegrationError && err.status === 403) {
      throw new IntegrationError(
        "HubSpot: the hub's private app cannot read Orders yet. It needs the read-only scope crm.objects.orders.read on the SARCLA - APSOMarketingHub app.",
        403,
      );
    }
    throw err;
  }
  return { weeks: out, liveFrom: WEB_ORDERS_LIVE_FROM };
}

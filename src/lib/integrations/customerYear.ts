// THE YEAR'S CUSTOMERS — the two retention KPIs smec set, counted from our own
// orders instead of waiting for a Compass list, plus the registration cohort
// behind the conversion-rate target.
//
//   active companies       ordered at least once this year
//   reactivated companies  their first order this year came after a gap of more
//                          than 12 months, or after no order at all in our
//                          history while the ERP shows they once bought
//   new companies          no order anywhere before this year
//
// A company is counted once, whatever it ordered. This is deliberately NOT
// filtered to Paid Search: a company is a customer of the shop, not of a
// channel, and the sheet's baselines (9,656 active, 1,176 reactivated) are
// whole-business Compass figures.

import { hubspotFetchJson } from "./hubspot";
import { reportProgress, slowReport, type SlowState } from "./slowReport";

const DAY_MS = 86_400_000;
const ACTIVE_DAYS = 365;
/** Thirteen months before the year starts: enough to judge the first order of January. */
const LOOKBACK_MONTHS = 13;
const TTL_MS = 12 * 60 * 60 * 1000;

export type CustomerYear = {
  year: number;
  activeCompanies: number;
  reactivatedCompanies: number;
  newCompanies: number;
  continuingCompanies: number;
  ordersInYear: number;
  scannedFrom: string;
  generatedAt: string;
};

export type RegistrationCohort = {
  year: number;
  registrations: number;
  converted: number;
  rate: number | null;
  generatedAt: string;
};

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Orders by order date, month by month, walking id windows (search stops paging at 10,000). */
async function scanOrders(from: string, to: string, key: string): Promise<{ id: string; date: string }[]> {
  const out: { id: string; date: string }[] = [];
  for (let cursor = dayMs(from); cursor <= dayMs(to); ) {
    const d = new Date(cursor);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    let lastId = "0";
    for (;;) {
      let after: string | undefined;
      let got = 0;
      let pageLast: string | null = null;
      do {
        const res = await hubspotFetchJson<{
          results?: { id?: string; properties?: Record<string, string | null> }[];
          paging?: { next?: { after?: string } };
        }>({
          path: "/crm/v3/objects/orders/search",
          method: "POST",
          body: {
            filterGroups: [{ filters: [
              { propertyName: "order_order_date", operator: "GTE", value: String(cursor) },
              { propertyName: "order_order_date", operator: "LT", value: String(next) },
              { propertyName: "hs_object_id", operator: "GT", value: lastId },
            ] }],
            properties: ["order_order_date", "order_order_type", "hs_external_order_status"],
            sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
            limit: 200,
            after,
          },
        });
        for (const row of res.results ?? []) {
          const p = row.properties ?? {};
          const date = (p.order_order_date ?? "").slice(0, 10);
          const status = (p.hs_external_order_status ?? "").toLowerCase();
          const credit = (p.order_order_type ?? "").toLowerCase().includes("credit");
          if (date && row.id && !credit && status !== "canceled" && status !== "cancelled") {
            out.push({ id: row.id, date });
          }
          if (row.id) pageLast = row.id;
          got++;
        }
        after = res.paging?.next?.after;
      } while (after && got < 9000);
      if (!got || !pageLast) break;
      lastId = pageLast;
    }
    reportProgress(key, `reading orders · ${out.length.toLocaleString("en")} so far`);
    cursor = next;
  }
  return out;
}

async function companiesOf(ids: string[], key: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 1000) {
    const res = await hubspotFetchJson<{
      results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[];
    }>({
      path: "/crm/v4/associations/orders/companies/batch/read",
      method: "POST",
      body: { inputs: ids.slice(i, i + 1000).map((id) => ({ id })) },
    });
    for (const row of res.results ?? []) {
      const orderId = row.from?.id;
      const companyId = row.to?.[0]?.toObjectId;
      if (orderId && companyId != null) out.set(orderId, String(companyId));
    }
    reportProgress(key, `matching orders to companies · ${out.size.toLocaleString("en")} of ${ids.length.toLocaleString("en")}`);
  }
  return out;
}

/**
 * Did this company order before our scan began, and when?
 *
 * The ERP's compass_first_order_year was the obvious shortcut and it is not
 * trustworthy — A+P's own figure can be wrong, and it is frozen whenever the
 * Compass sync stops. So we ask the order records themselves: the most recent
 * order strictly before the scan window. One call per company, and only for the
 * few whose first order of the year has nothing behind it.
 */
async function orderBeforeScan(companyIds: string[], scanStart: string, key: string, cache: Map<string, string | null>): Promise<void> {
  let done = 0;
  for (const cid of companyIds) {
    done++;
    if (cache.has(cid)) continue;
    const res = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/orders/search",
      method: "POST",
      body: {
        filterGroups: [{ filters: [
          { propertyName: "associations.company", operator: "EQ", value: cid },
          { propertyName: "order_order_date", operator: "LT", value: String(dayMs(scanStart)) },
          { propertyName: "order_order_type", operator: "NEQ", value: "Credit note" },
        ] }],
        properties: ["order_order_date"],
        sorts: [{ propertyName: "order_order_date", direction: "DESCENDING" }],
        limit: 1,
      },
    });
    const date = res.results?.[0]?.properties?.order_order_date?.slice(0, 10) ?? null;
    cache.set(cid, date);
    if (done % 25 === 0) reportProgress(key, `checking first orders · ${done} of ${companyIds.length}`);
  }
}

/** Both years from one pass: the later year's lookback already covers the earlier one. */
async function buildCustomerYears(years: number[], key: string): Promise<Record<number, CustomerYear>> {
  const earliest = Math.min(...years);
  const lookback = new Date(dayMs(`${earliest}-01-01`));
  lookback.setUTCMonth(lookback.getUTCMonth() - LOOKBACK_MONTHS);
  const scannedFrom = isoDay(lookback.getTime());
  const to = isoDay(Date.now());

  const orders = await scanOrders(scannedFrom, to, key);
  const byOrder = await companiesOf(orders.map((o) => o.id), key);
  const out: Record<number, CustomerYear> = {};
  const priorCache = new Map<string, string | null>();    // company -> its last order before the scan
  for (const year of years) out[year] = await countYear(year, orders, byOrder, scannedFrom, key, priorCache);
  return out;
}

async function countYear(
  year: number,
  orders: { id: string; date: string }[],
  byOrder: Map<string, string>,
  scannedFrom: string,
  key: string,
  priorCache: Map<string, string | null>,
): Promise<CustomerYear> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const days = new Map<string, string[]>();
  for (const o of orders) {
    const cid = byOrder.get(o.id);
    if (!cid) continue;
    const list = days.get(cid);
    if (list) list.push(o.date);
    else days.set(cid, [o.date]);
  }
  for (const list of days.values()) list.sort();

  const firstThisYear = new Map<string, string>();
  let ordersInYear = 0;
  for (const [cid, list] of days) {
    const inYear = list.filter((d) => d >= yearStart && d <= yearEnd);
    if (!inYear.length) continue;
    firstThisYear.set(cid, inYear[0]);
    ordersInYear += inYear.length;
  }

  // Companies whose first order of the year has nothing before it inside the
  // scan: only the ERP years can say whether they are new or long lapsed.
  const unknown: string[] = [];
  const gapOf = new Map<string, number | null>();
  for (const [cid, first] of firstThisYear) {
    const before = (days.get(cid) ?? []).filter((d) => d < first);
    const previous = before.length ? before[before.length - 1] : null;
    if (previous) gapOf.set(cid, (dayMs(first) - dayMs(previous)) / DAY_MS);
    else {
      gapOf.set(cid, null);
      unknown.push(cid);
    }
  }
  if (unknown.length) await orderBeforeScan(unknown, scannedFrom, key, priorCache);

  let reactivated = 0;
  let fresh = 0;
  let continuing = 0;
  for (const [cid, gap] of gapOf) {
    if (gap === null) {
      // Nothing before this order inside the scan: an order older than the scan
      // makes them a returning customer, no order at all makes this their first.
      const earlier = priorCache.get(cid) ?? null;
      if (earlier) reactivated++;
      else fresh++;
    } else if (gap > ACTIVE_DAYS) reactivated++;
    else continuing++;
  }

  return {
    year,
    activeCompanies: firstThisYear.size,
    reactivatedCompanies: reactivated,
    newCompanies: fresh,
    continuingCompanies: continuing,
    ordersInYear,
    scannedFrom,
    generatedAt: new Date().toISOString(),
  };
}

/** Shop accounts opened this year, and how many of them have since ordered. */
async function buildRegistrationCohort(year: number, key: string): Promise<RegistrationCohort> {
  const from = String(dayMs(`${year}-01-01`));
  const to = String(dayMs(`${year + 1}-01-01`));
  const contacts: { id: string; created: string }[] = [];
  let lastId = "0";
  for (;;) {
    const before = contacts.length;
    let after: string | undefined;
    let got = 0;
    do {
      const res = await hubspotFetchJson<{
        results?: { id?: string; properties?: Record<string, string | null> }[];
        paging?: { next?: { after?: string } };
      }>({
        path: "/crm/v3/objects/contacts/search",
        method: "POST",
        body: {
          filterGroups: [{ filters: [
            { propertyName: "eyemagine_customer_id", operator: "HAS_PROPERTY" },
            { propertyName: "createdate", operator: "GTE", value: from },
            { propertyName: "createdate", operator: "LT", value: to },
            { propertyName: "hs_object_id", operator: "GT", value: lastId },
          ] }],
          properties: ["createdate"],
          sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
          limit: 200,
          after,
        },
      });
      for (const row of res.results ?? []) {
        if (row.id) contacts.push({ id: row.id, created: (row.properties?.createdate ?? "").slice(0, 10) });
      }
      got += (res.results ?? []).length;
      after = res.paging?.next?.after;
    } while (after && got < 9000);
    if (contacts.length === before) break;
    lastId = contacts[contacts.length - 1].id;
    reportProgress(key, `reading registrations · ${contacts.length.toLocaleString("en")}`);
  }

  const ordersOf = new Map<string, string[]>();
  const orderIds = new Set<string>();
  for (let i = 0; i < contacts.length; i += 1000) {
    const res = await hubspotFetchJson<{
      results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[];
    }>({
      path: "/crm/v4/associations/contacts/orders/batch/read",
      method: "POST",
      body: { inputs: contacts.slice(i, i + 1000).map((c) => ({ id: c.id })) },
    });
    for (const row of res.results ?? []) {
      const cid = row.from?.id;
      if (!cid) continue;
      const list = (row.to ?? []).map((t) => String(t.toObjectId));
      ordersOf.set(cid, list);
      list.forEach((o) => orderIds.add(o));
    }
    reportProgress(key, `finding their orders · ${ordersOf.size.toLocaleString("en")} of ${contacts.length.toLocaleString("en")}`);
  }

  const orderDate = new Map<string, string>();
  const ids = [...orderIds];
  for (let i = 0; i < ids.length; i += 100) {
    const res = await hubspotFetchJson<{ results?: { id?: string; properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/orders/batch/read",
      method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["order_order_date"] },
    });
    for (const row of res.results ?? []) {
      if (row.id) orderDate.set(row.id, (row.properties?.order_order_date ?? "").slice(0, 10));
    }
  }

  let converted = 0;
  for (const c of contacts) {
    const list = ordersOf.get(c.id) ?? [];
    if (list.some((o) => { const d = orderDate.get(o); return d && d >= c.created; })) converted++;
  }

  return {
    year,
    registrations: contacts.length,
    converted,
    rate: contacts.length ? converted / contacts.length : null,
    generatedAt: new Date().toISOString(),
  };
}

export async function customerYear(year: number): Promise<SlowState<CustomerYear>> {
  // Counted in pairs: this year and the one before, from a single read of the orders.
  const years = [year - 1, year];
  const key = `customerYears:${years.join("-")}`;
  const state = await slowReport(key, TTL_MS, () => buildCustomerYears(years, key));
  const pair = state.value as Record<number, CustomerYear> | undefined;
  return { ...state, value: pair?.[year] };
}

/** The same pair, for the comparison column. */
export async function customerYearPair(year: number): Promise<SlowState<Record<number, CustomerYear>>> {
  const years = [year - 1, year];
  return slowReport(`customerYears:${years.join("-")}`, TTL_MS, () => buildCustomerYears(years, `customerYears:${years.join("-")}`));
}

export function registrationCohort(year: number): Promise<SlowState<RegistrationCohort>> {
  const key = `registrationCohort:${year}`;
  return slowReport(key, TTL_MS, () => buildRegistrationCohort(year, key));
}

// PRICE CHECKS: who priced articles in the shop and did not put them in the cart.
//
// The "price check" is not a tracked event - it is the ERP quantity lookup the
// product page fires when a customer types a quantity. The smart bar reads it
// off PerformanceObserver, so every look carries the ten-digit ARTICLE and the
// quantity, for every signed-in customer whatever they chose on the cookie
// banner. A line with no cart flag and no order flag is a price check.
//
// This screen is the detection half of the HubSpot ticket of the same name. It
// applies the same rules so the two cannot disagree, and shows the rows that do
// NOT qualify as well as the ones that do - a rule you cannot see the edge of is
// a rule nobody trusts.

import { hubspotFetchJson } from "./hubspot";
import { isArticle, isSpecialArticle, nextWorkingDay, priceCheckQualifies, shortPriority } from "../datatracker/rules";

/** P&P, keyed by article_number. The list price is per mandant. */
const PP_PROPS = [
  "article_number", "article_description", "profit_center",
  "art_price__m100__listed_price", "art_price__m110__listed_price",
  "sales_unit", "moq", "moq_minimum_quantity",
];

export type PriceCheckArticle = {
  article: string;
  description: string | null;
  qty: number | null;
  profitCentre: string | null;
  price: number | null;
  value: number | null;
  salesUnit: string | null;
  /** "yes" | "no" | null - null is a real state, filled on ~26% of articles. */
  moq: string | null;
  moqMinimum: number | null;
  special: boolean;
  /** Passed the KT/DT and not-special test, so it counts towards the rule. */
  counted: boolean;
};

export type PriceCheckRow = {
  companyId: string;
  companyName: string | null;
  customerNumber: string | null;
  mandant: string | null;
  country: string | null;
  ownerId: string | null;
  apsoCustomer: string | null;
  salesPriority: string | null;
  /** The day the prices were checked, local to the stored timestamp. */
  day: string;
  contactIds: string[];
  articles: PriceCheckArticle[];
  counted: number;
  value: number;
  skipped: number;
  qualifies: boolean;
  /** The first working day after the check - weekends prove nothing. */
  dueOn: string;
  gateOpen: boolean;
  /** Why this customer is out of scope, or null. */
  excluded: string | null;
};

export type PriceChecks = {
  rows: PriceCheckRow[];
  scanned: number;
  articlesLookedUp: number;
  generatedAt: string;
};

type ActivityLine = { t?: string; a?: string; q?: number; c?: number; o?: number; u?: string };
type ActivityJson = { recent?: ActivityLine[] };

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * APSOmicro and priorities 3 and 4 are out of scope. A customer we would not
 * call about a lapsed order is not one we call about a price check either.
 */
function excludedBecause(apsoCustomer: string | null, salesPriority: string | null): string | null {
  if ((apsoCustomer ?? "").toLowerCase() === "apsomicro") return "APSOmicro";
  const p = shortPriority(salesPriority);
  if (p === "Prio 3" || p === "Prio 4") return p;
  return null;
}

export async function fetchPriceChecks(
  params: { from?: string; to?: string; today?: string; signal?: AbortSignal } = {},
): Promise<PriceChecks> {
  const { from, to, signal } = params;
  // Passed in rather than read here, so the caller owns "today" and the result
  // is reproducible - a day boundary decided deep inside a scan is untestable.
  const today = params.today ?? new Date().toISOString().slice(0, 10);

  type Draft = {
    company: Omit<PriceCheckRow, "articles" | "counted" | "value" | "skipped" | "qualifies" | "dueOn" | "gateOpen" | "excluded" | "day" | "contactIds">;
    day: string;
    contacts: Set<string>;
    /** article -> the largest quantity priced that day */
    qty: Map<string, number | null>;
  };

  const drafts = new Map<string, Draft>();
  const wanted = new Set<string>();
  let after: string | undefined;
  let scanned = 0;

  do {
    const res = await hubspotFetchJson<{
      results?: { id?: string; properties?: Record<string, string | null> }[];
      paging?: { next?: { after?: string } };
    }>({
      path: "/crm/v3/objects/companies/search",
      method: "POST",
      signal,
      body: {
        filterGroups: [{ filters: [{ propertyName: "eshop_activity", operator: "HAS_PROPERTY" }] }],
        properties: ["eshop_activity", "name", "company_unique_number", "mandant",
          "country_custom", "apso_customer", "sales_priority", "hubspot_owner_id"],
        limit: 100,
        after,
      },
    });

    for (const r of res.results ?? []) {
      scanned++;
      const p = r.properties ?? {};
      let parsed: ActivityJson;
      try { parsed = JSON.parse(String(p.eshop_activity ?? "")) as ActivityJson; } catch { continue; }

      for (const line of parsed.recent ?? []) {
        const a = line?.a ? String(line.a) : "";
        // Ten digits or it is not an article: the eight-digit number is a page
        // that thirty-two variants share, and it joins to no price at all.
        if (!isArticle(a)) continue;
        // Priced AND left behind. A cart or an order is the opposite signal.
        if (line.c === 1 || line.o === 1) continue;
        const day = String(line.t ?? "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        if (from && day < from) continue;
        if (to && day > to) continue;

        const key = `${r.id}|${day}`;
        let d = drafts.get(key);
        if (!d) {
          d = {
            company: {
              companyId: String(r.id ?? ""),
              companyName: p.name ?? null,
              customerNumber: p.company_unique_number ?? null,
              mandant: p.mandant ?? null,
              country: p.country_custom ?? null,
              ownerId: p.hubspot_owner_id ?? null,
              apsoCustomer: p.apso_customer ?? null,
              salesPriority: p.sales_priority ?? null,
            },
            day,
            contacts: new Set<string>(),
            qty: new Map<string, number | null>(),
          };
          drafts.set(key, d);
        }
        if (line.u) d.contacts.add(String(line.u));
        // The largest quantity asked for that day: the customer who types 20 and
        // then 200 is asking about 200.
        const q = typeof line.q === "number" ? line.q : null;
        const seen = d.qty.get(a);
        if (seen === undefined || (q != null && (seen == null || q > seen))) d.qty.set(a, q);
        wanted.add(a);
      }
    }

    after = res.paging?.next?.after;
    if (scanned >= 3000) break;            // a guard, not a quota
  } while (after);

  // ---- what those articles cost, and whose profit centre they are ------------
  const spec = new Map<string, Record<string, string | null>>();
  const articles = [...wanted];
  for (let i = 0; i < articles.length; i += 100) {
    const slice = articles.slice(i, i + 100);
    const res = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/2-200042439/search",
      method: "POST",
      signal,
      body: {
        filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: slice }] }],
        properties: PP_PROPS,
        limit: 100,
      },
    });
    for (const r of res.results ?? []) {
      const a = r.properties?.article_number;
      if (a) spec.set(a, r.properties ?? {});
    }
  }

  const rows: PriceCheckRow[] = [];
  for (const d of drafts.values()) {
    // The list price is per mandant, and the customer's mandant is the one that
    // would be quoted. An unknown mandant leaves the price unknown rather than
    // guessing at the other one.
    const priceKey = d.company.mandant === "M110" ? "art_price__m110__listed_price"
      : d.company.mandant === "M100" ? "art_price__m100__listed_price" : null;

    const list: PriceCheckArticle[] = [...d.qty.entries()].map(([article, qty]) => {
      const pp = spec.get(article);
      const profitCentre = pp?.profit_center ?? null;
      const price = priceKey && pp ? num(pp[priceKey]) : null;
      const special = isSpecialArticle(article);
      return {
        article,
        description: pp?.article_description ?? null,
        qty,
        profitCentre,
        price,
        value: price != null && qty != null ? price * qty : null,
        salesUnit: pp?.sales_unit ?? null,
        moq: pp?.moq ?? null,
        moqMinimum: pp ? num(pp.moq_minimum_quantity) : null,
        special,
        counted: !special && (profitCentre === "KT" || profitCentre === "DT"),
      };
    }).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const verdict = priceCheckQualifies(list.map((a) => ({
      article: a.article, profitCentre: a.profitCentre, value: a.value,
    })));
    const dueOn = nextWorkingDay(d.day);

    rows.push({
      ...d.company,
      day: d.day,
      contactIds: [...d.contacts],
      articles: list,
      counted: verdict.counted,
      value: verdict.value,
      skipped: verdict.skipped,
      qualifies: verdict.qualifies,
      dueOn,
      gateOpen: dueOn <= today,
      excluded: excludedBecause(d.company.apsoCustomer, d.company.salesPriority),
    });
  }

  rows.sort((a, b) => b.value - a.value || b.day.localeCompare(a.day));
  return { rows, scanned, articlesLookedUp: spec.size, generatedAt: new Date().toISOString() };
}

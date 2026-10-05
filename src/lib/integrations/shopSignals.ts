// WHAT THE SHOP SAW A CUSTOMER DO, AND WHAT IT COST US.
//
// Three screens come out of one scan, because they all start from the same
// place: the quantity lookup the product page fires when a customer types a
// number. The smart bar reads it off PerformanceObserver, so each look carries
// the ten-digit ARTICLE and the quantity, for every signed-in customer whatever
// they chose on the cookie banner.
//
//   Price checks  - they priced it and left it. A rule and a ticket behind it.
//   MOQ           - they asked for fewer than we will sell. A record, no ticket.
//   Availability  - we did not have it. A record, no ticket.
//
// Scanning the companies three times to answer three questions about the same
// lines would be three times the wait for no extra truth, so this runs once.

import { hubspotFetchJson } from "./hubspot";
import { IntegrationError } from "./status";
import { isArticle, isSpecialArticle, knownMinimum, nextWorkingDay, priceCheckQualifies, shortPriority } from "../datatracker/rules";
import { ownerName, teamOf } from "../datatracker/rosters";

/** P&P, keyed by article_number. The list price is per mandant. */
const PP_PROPS = [
  "article_number", "article_description", "profit_center",
  "art_price__m100__listed_price", "art_price__m110__listed_price",
  "sales_unit", "moq", "moq_minimum_quantity",
  "stock_quantity", "stock_unit",
  "main_group_number", "main_group_description", "sub_group_number",
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
  /** `un|YYYY-MM-DD` - the same key the detector writes on the ticket. */
  key: string;
  /**
   * The ticket the detector raised for this day, if it has. The detector lives
   * on the connector and this screen is the view onto it, so a row that
   * qualifies here and has no ticket there is a disagreement worth seeing -
   * which is the whole reason this is read back rather than assumed.
   */
  ticketId: string | null;
  /** The team the company owner routes to, or null when they are on neither roster. */
  team: "ESO" | "TSA" | null;
  owner: string;
};

/** One customer, one article, one day - for the MOQ and Availability records. */
export type LookRecord = {
  companyId: string;
  companyName: string | null;
  customerNumber: string | null;
  mandant: string | null;
  country: string | null;
  salesPriority: string | null;
  day: string;
  article: string;
  description: string | null;
  mainGroup: string | null;
  subGroup: string | null;
  qty: number | null;
  salesUnit: string | null;
  moq: string | null;
  moqMinimum: number | null;
  stock: number | null;
  stockUnit: string | null;
  price: number | null;
  value: number | null;
  carted: boolean;
  /** They asked for fewer than we will sell. */
  belowMoq: boolean;
  /** How many short the shelf was, when we can say. */
  shortfall: number | null;
};

export type ShopSignals = {
  priceChecks: PriceCheckRow[];
  /** Looked at, not bought, and the article carries a minimum order quantity. */
  moq: LookRecord[];
  /** Looked at, not bought, and there was nothing (or not enough) on the shelf. */
  availability: LookRecord[];
  scanned: number;
  articlesLookedUp: number;
  generatedAt: string;
  /**
   * Set when the ticket read-back could not run - a missing scope, usually.
   * The rule still renders; only the Ticket column goes blank, and saying so is
   * the difference between "no ticket was raised" and "we could not look".
   */
  ticketLookupError: string | null;
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

export async function fetchShopSignals(
  params: { from?: string; to?: string; today?: string; signal?: AbortSignal } = {},
): Promise<ShopSignals> {
  // Which call failed matters more than that one did: the three reads below sit
  // behind different scopes, and an unlabelled message sends you looking in the
  // wrong place. The label is prefixed onto whatever HubSpot said.
  const at = { step: "company scan" };
  try {
    return await scan(params, at);
  } catch (err) {
    const e = err as Error;
    throw new IntegrationError(`${at.step}: ${e?.message ?? String(err)}`,
                               (e as IntegrationError)?.status);
  }
}

async function scan(
  params: { from?: string; to?: string; today?: string; signal?: AbortSignal },
  at: { step: string },
): Promise<ShopSignals> {
  const { from, to, signal } = params;
  // Passed in rather than read here, so the caller owns "today" and the result
  // is reproducible - a day boundary decided deep inside a scan is untestable.
  const today = params.today ?? new Date().toISOString().slice(0, 10);

  type Company = {
    companyId: string; companyName: string | null; customerNumber: string | null;
    mandant: string | null; country: string | null; ownerId: string | null;
    apsoCustomer: string | null; salesPriority: string | null;
  };
  type Draft = {
    company: Company;
    day: string;
    contacts: Set<string>;
    /** article -> the largest quantity asked for, and whether it reached a cart */
    looks: Map<string, { qty: number | null; carted: boolean }>;
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
        // Bought it? Then none of these three screens is about them.
        if (line.o === 1) continue;
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
            looks: new Map(),
          };
          drafts.set(key, d);
        }
        if (line.u) d.contacts.add(String(line.u));
        const q = typeof line.q === "number" ? line.q : null;
        const seen = d.looks.get(a);
        // The largest quantity asked for that day: the customer who types 20 and
        // then 200 is asking about 200. A cart anywhere in the day is a cart.
        d.looks.set(a, {
          qty: seen == null ? q : q != null && (seen.qty == null || q > seen.qty) ? q : seen.qty,
          carted: (seen?.carted ?? false) || line.c === 1,
        });
        wanted.add(a);
      }
    }

    after = res.paging?.next?.after;
    if (scanned >= 3000) break;            // a guard, not a quota
  } while (after);

  // ---- what those articles are: price, profit centre, MOQ, what is on the shelf
  at.step = "article lookup";
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

  const priceChecks: PriceCheckRow[] = [];
  const moq: LookRecord[] = [];
  const availability: LookRecord[] = [];

  for (const d of drafts.values()) {
    // The list price is per mandant, and the customer's mandant is the one that
    // would be quoted. An unknown mandant leaves the price unknown rather than
    // guessing at the other one.
    const priceKey = d.company.mandant === "M110" ? "art_price__m110__listed_price"
      : d.company.mandant === "M100" ? "art_price__m100__listed_price" : null;

    const detailed = [...d.looks.entries()].map(([article, look]) => {
      const pp = spec.get(article);
      const price = priceKey && pp ? num(pp[priceKey]) : null;
      const qty = look.qty;
      const moqMinimum = pp ? num(pp.moq_minimum_quantity) : null;
      const stock = pp ? num(pp.stock_quantity) : null;
      // A minimum only when P&P says YES and gives a number above one.
      const minimum = knownMinimum(pp?.moq, moqMinimum);
      return {
        article,
        look,
        pp,
        price,
        qty,
        moqMinimum,
        stock,
        minimum,
        profitCentre: pp?.profit_center ?? null,
        special: isSpecialArticle(article),
      };
    });

    // ---- the price-check row: priced, not carted ----------------------------
    const left = detailed.filter((x) => !x.look.carted);
    if (left.length > 0) {
      const list: PriceCheckArticle[] = left.map((x) => ({
        article: x.article,
        description: x.pp?.article_description ?? null,
        qty: x.qty,
        profitCentre: x.profitCentre,
        price: x.price,
        value: x.price != null && x.qty != null ? x.price * x.qty : null,
        salesUnit: x.pp?.sales_unit ?? null,
        moq: x.pp?.moq ?? null,
        moqMinimum: x.moqMinimum,
        special: x.special,
        counted: !x.special && (x.profitCentre === "KT" || x.profitCentre === "DT"),
      })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

      const verdict = priceCheckQualifies(list.map((a) => ({
        article: a.article, profitCentre: a.profitCentre, value: a.value,
      })));
      const dueOn = nextWorkingDay(d.day);

      priceChecks.push({
        ...d.company,
        key: `${d.company.customerNumber || d.company.companyId}|${d.day}`,
        ticketId: null,
        team: teamOf(d.company.ownerId),
        owner: ownerName(d.company.ownerId),
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

    // ---- the two record screens, article by article -------------------------
    for (const x of detailed) {
      const base: LookRecord = {
        companyId: d.company.companyId,
        companyName: d.company.companyName,
        customerNumber: d.company.customerNumber,
        mandant: d.company.mandant,
        country: d.company.country,
        salesPriority: d.company.salesPriority,
        day: d.day,
        article: x.article,
        description: x.pp?.article_description ?? null,
        mainGroup: x.pp?.main_group_description ?? null,
        subGroup: x.pp?.sub_group_number ?? null,
        qty: x.qty,
        salesUnit: x.pp?.sales_unit ?? null,
        moq: x.pp?.moq ?? null,
        moqMinimum: x.moqMinimum,
        stock: x.stock,
        stockUnit: x.pp?.stock_unit ?? null,
        price: x.price,
        value: x.price != null && x.qty != null ? x.price * x.qty : null,
        carted: x.look.carted,
        belowMoq: x.minimum != null && x.qty != null && x.qty < x.minimum,
        shortfall: x.stock != null && x.qty != null && x.stock < x.qty ? x.qty - x.stock : null,
      };

      // Only a look with a quantity against a minimum we know. Without the
      // quantity nothing says the minimum is what stopped them (SARCLA 05.10:
      // "some don't have wanted, some don't have MOQ").
      if (x.minimum != null && x.qty != null) moq.push(base);
      // Nothing on the shelf, or not as much as they asked for. A null stock is
      // not a zero - we simply do not know, and guessing would invent a problem.
      if (x.stock === 0 || base.shortfall != null) availability.push(base);
    }
  }

  // Which of these the detector has already ticketed. One search per hundred
  // keys, and only for the days that actually qualify - the rest can never have
  // a ticket, so asking about them would be a round trip for a certain no.
  const askable = priceChecks.filter((r) => r.qualifies && !r.excluded);
  let ticketLookupError: string | null = null;
  for (let i = 0; i < askable.length; i += 100) {
    const slice = askable.slice(i, i + 100);
    try {
      const res = await hubspotFetchJson<{ results?: { id?: string; properties?: Record<string, string | null> }[] }>({
        path: "/crm/v3/objects/tickets/search",
        method: "POST",
        signal,
        body: {
          filterGroups: [{ filters: [{ propertyName: "price_check_key", operator: "IN", values: slice.map((r) => r.key) }] }],
          properties: ["price_check_key"],
          limit: 100,
        },
      });
      const byKey = new Map((res.results ?? []).map((t) => [t.properties?.price_check_key ?? "", String(t.id ?? "")]));
      for (const r of slice) r.ticketId = byKey.get(r.key) ?? null;
    } catch (err) {
      // The rule still renders without this; only the ticket column goes blank -
      // but it says why, rather than looking like nothing was ever raised.
      ticketLookupError = String((err as Error)?.message ?? err);
      break;
    }
  }

  priceChecks.sort((a, b) => b.value - a.value || b.day.localeCompare(a.day));
  // The ones we can act on first: a customer who asked for less than the minimum,
  // or a shelf we can count the gap on.
  moq.sort((a, b) => Number(b.belowMoq) - Number(a.belowMoq) || b.day.localeCompare(a.day) || (b.value ?? 0) - (a.value ?? 0));
  availability.sort((a, b) => (b.shortfall ?? 0) - (a.shortfall ?? 0) || b.day.localeCompare(a.day));

  return { priceChecks, moq, availability, scanned, articlesLookedUp: spec.size,
           ticketLookupError, generatedAt: new Date().toISOString() };
}

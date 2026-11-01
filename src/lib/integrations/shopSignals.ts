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
import { VALUE_FLOOR_ACTIVE, isArticle, isInternalCompany, isSpecialArticle, knownMinimum, lostReason, nextWorkingDay, priceCheckQualifies, shortPriority, ticketWindowStart, typedQuantity, type LostReason } from "../datatracker/rules";
import { adoptNamedOwners, ownerName, teamOf } from "../datatracker/rosters";
import { owners } from "./eshopActivity";
import { largestEarlierQuantity } from "../shopLooks/parse";

/** P&P, keyed by article_number. The list price is per mandant. */
const PP_PROPS = [
  "article_number", "article_description", "profit_center",
  "art_price__m100__listed_price", "art_price__m110__listed_price",
  "sales_unit", "moq", "moq_minimum_quantity",
  "stock_quantity", "stock_unit",
  "main_group_number", "main_group_description", "sub_group_number",
  // the product hierarchy the Products Reports break down by (SARCLA 01.11.2026: "we should really create subtabs") - read
  // on the same search, so no call more
  "sub_group_description", "product_number", "product_description",
];

/**
 * A line the hub kept of a company's shop activity (apsomh_shop_looks, src/lib/shopLooks/store.ts). The property itself
 * holds only a company's last 50 articles, so a period reaching further back needs the hub's copy. Additive (01.11.2026):
 * only a caller that passes `kept` gets them merged in; the Datatracker and Engagements read the property alone, as before.
 */
export type KeptLook = { companyId: string; day: string; article: string; qty: number | null; carted: boolean; ordered: boolean; contact: string | null };

/** What Products & Pricing says of an article looked up - for the Products Reports' breakdowns (01.11.2026). */
export type ArticleFacts = {
  description: string | null;
  profitCentre: string | null;
  mainGroup: string | null;
  subGroup: string | null;
  product: string | null;
  productName: string | null;
  salesUnit: string | null;
  /** knownMinimum(): a minimum only when P&P says YES and gives a number above one */
  minimum: number | null;
  stock: number | null;
};

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
  /** Qualified, no ticket, and older than a run reaches back: it will never get one. */
  expired: boolean;
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
  /** P&P profit_center, for the filter. */
  profitCentre: string | null;
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
  /**
   * Every look that ended in no order, by where it was lost (rules.lostReason) - the looks (one customer,
   * one article, one day) and the companies behind them.
   */
  lost: { looks: Record<LostReason, number>; companies: Record<LostReason, number>; total: number; totalCompanies: number; ordered: number; orderedCompanies: number };
  scanned: number;
  articlesLookedUp: number;
  generatedAt: string;
  /**
   * Set when the ticket read-back could not run - a missing scope, usually.
   * The rule still renders; only the Ticket column goes blank, and saying so is
   * the difference between "no ticket was raised" and "we could not look".
   */
  ticketLookupError: string | null;
  /**
   * Set when the property history could not be read. The quantities are then
   * the ones HubSpot holds now, where a 1 may have overwritten a typed number.
   */
  quantityHistoryError: string | null;
  /** Each article looked up, as Products & Pricing gives it (additive, 01.11.2026 - the Products Reports). */
  articleFacts?: Record<string, ArticleFacts>;
  /** The looks that did end in an order, one company, one article, one day - for "ordered later" (additive, 01.11.2026). */
  orderedLooks?: { companyId: string; day: string; article: string }[];
  /** With `kept`: the hub's lines merged in, and those of a company the scan did not reach (left out). */
  kept?: { merged: number; unknownCompany: number } | null;
  /**
   * With `facts` (additive, 01.11.2026 - the Products Reports' funnel): every look, one company, one article, one day, and
   * where it stopped on the shop's path - the shelf, only looked, the minimum, the price, the cart - or "won", ordered that
   * day. The shelf as the Products Reports read it: a stock Products & Pricing does not give is unknown, not empty.
   */
  path?: PathLook[];
};

export type PathStep = LostReason | "won";
export type PathLook = { companyId: string; companyName: string | null; customerNumber: string | null; country: string | null; day: string; article: string; step: PathStep };

/** Where a look stopped, as the Products Reports count (src/lib/productSignals/model.ts): rules.lostReason, with a stock
 *  Products & Pricing does not give left as unknown - it passes the shelf - where lostReason reads it as 0. */
export function pathStep(x: { qty: number | null; carted: boolean; stock: number | null; minimum: number | null }): LostReason {
  const typed = typedQuantity(x.qty);
  if (x.stock !== null && (x.stock <= 0 || (typed && x.qty! > x.stock))) return "shelf";
  if (x.minimum != null && typed && x.qty! < x.minimum) return "moq";
  if (x.carted) return "cart";
  if (typed) return "price";
  return "looked";
}

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

/**
 * A 1 that overwrote a quantity the customer typed gets the typed one back.
 *
 * The gateway keeps the NEWEST quantity of the day, and the shop and the search
 * bar ask the ERP for 1 on their own - the search bar's stock read at 1 can land
 * after the price the customer asked for - so "50" became "x 1" on the ticket
 * (SARCLA, 19.10.2026: "the quantities are always set to one"). HubSpot keeps the earlier
 * values of the property; they are read only for the lines that end on a 1 and
 * never reached a cart, fifty companies a call. The largest typed quantity of
 * the day wins, as it does everywhere else here. A failed read leaves the
 * quantities as they are and says so.
 */
async function recoverTypedQuantities(
  days: { companyId: string; day: string; looks: Map<string, { qty: number | null; carted: boolean }> }[],
  signal?: AbortSignal,
): Promise<string | null> {
  const wanted = new Map<string, Set<string>>();   // company -> "day|article"
  const looksOf = new Map<string, Map<string, { qty: number | null; carted: boolean }>>();
  for (const d of days) {
    for (const [article, look] of d.looks) {
      if (look.carted || look.qty !== 1) continue;
      let w = wanted.get(d.companyId);
      if (!w) wanted.set(d.companyId, (w = new Set()));
      w.add(`${d.day}|${article}`);
      looksOf.set(`${d.companyId}|${d.day}`, d.looks);
    }
  }
  const ids = [...wanted.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const res = await hubspotFetchJson<{
        results?: { id?: string; propertiesWithHistory?: Record<string, { value?: string }[]> }[];
      }>({
        path: "/crm/v3/objects/companies/batch/read",
        method: "POST",
        signal,
        body: {
          inputs: ids.slice(i, i + 50).map((id) => ({ id })),
          properties: ["name"],
          propertiesWithHistory: ["eshop_activity"],
        },
      });
      for (const r of res.results ?? []) {
        const id = String(r.id ?? "");
        const versions = (r.propertiesWithHistory?.eshop_activity ?? []).map((v) => v.value);
        for (const [k, q] of largestEarlierQuantity(versions, wanted.get(id) ?? new Set())) {
          const [day, article] = k.split("|");
          const look = looksOf.get(`${id}|${day}`)?.get(article);
          if (look && look.qty === 1) look.qty = q;
        }
      }
    } catch (err) {
      if (signal?.aborted) throw err;
      return String((err as Error)?.message ?? err);
    }
  }
  return null;
}

export async function fetchShopSignals(
  params: { from?: string; to?: string; today?: string; signal?: AbortSignal; kept?: KeptLook[]; facts?: boolean } = {},
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
  params: { from?: string; to?: string; today?: string; signal?: AbortSignal; kept?: KeptLook[]; facts?: boolean },
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
  const orderedLooks = new Set<string>();
  const orderedCompanies = new Set<string>();
  /** every company the scan read (our own left out) - the kept lines join them by id */
  const seen = new Map<string, Company>();
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
        properties: ["eshop_activity", "name", "domain", "company_unique_number", "mandant",
          "country_custom", "apso_customer", "sales_priority", "hubspot_owner_id"],
        limit: 100,
        after,
      },
    });

    for (const r of res.results ?? []) {
      scanned++;
      const p = r.properties ?? {};
      // Our own companies (tests, intercompany): not on the boards, never a
      // ticket, never a morning mail - all three read this scan.
      if (isInternalCompany(p.name, p.domain)) continue;
      if (params.kept || params.facts) {
        seen.set(String(r.id ?? ""), {
          companyId: String(r.id ?? ""),
          companyName: p.name ?? null,
          customerNumber: p.company_unique_number ?? null,
          mandant: p.mandant ?? null,
          country: p.country_custom ?? null,
          ownerId: p.hubspot_owner_id ?? null,
          apsoCustomer: p.apso_customer ?? null,
          salesPriority: p.sales_priority ?? null,
        });
      }
      let parsed: ActivityJson;
      try { parsed = JSON.parse(String(p.eshop_activity ?? "")) as ActivityJson; } catch { continue; }

      for (const line of parsed.recent ?? []) {
        const a = line?.a ? String(line.a) : "";
        // Ten digits or it is not an article: the eight-digit number is a page
        // that thirty-two variants share, and it joins to no price at all.
        if (!isArticle(a)) continue;
        const day = String(line.t ?? "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        if (from && day < from) continue;
        if (to && day > to) continue;
        // Bought it? Then none of these three screens is about them - only the count of what was won.
        if (line.o === 1) { orderedLooks.add(`${r.id}|${day}|${a}`); orderedCompanies.add(String(r.id ?? "")); if (params.facts) wanted.add(a); continue; }

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

  // ---- the lines the hub kept: the property holds the last 50 articles only (additive, 01.11.2026 - only with `kept`).
  // A kept line is folded in as a line of the property is: the largest quantity of the day, a cart anywhere in the day.
  let kept: ShopSignals["kept"] = null;
  if (params.kept) {
    let merged = 0, unknownCompany = 0;
    for (const k of params.kept) {
      if (!isArticle(k.article) || !/^\d{4}-\d{2}-\d{2}$/.test(k.day)) continue;
      if (from && k.day < from) continue;
      if (to && k.day > to) continue;
      const company = seen.get(String(k.companyId));
      // our own companies are not in `seen`, nor one past the scan's guard: no name, no mandant - left out, counted
      if (!company) { unknownCompany++; continue; }
      merged++;
      if (k.ordered) { orderedLooks.add(`${company.companyId}|${k.day}|${k.article}`); orderedCompanies.add(company.companyId); if (params.facts) wanted.add(k.article); continue; }
      const key = `${company.companyId}|${k.day}`;
      let d = drafts.get(key);
      if (!d) drafts.set(key, (d = { company, day: k.day, contacts: new Set<string>(), looks: new Map() }));
      if (k.contact) d.contacts.add(String(k.contact));
      const q = typeof k.qty === "number" && Number.isFinite(k.qty) ? k.qty : null;
      const was = d.looks.get(k.article);
      d.looks.set(k.article, {
        qty: was == null ? q : q != null && (was.qty == null || q > was.qty) ? q : was.qty,
        carted: (was?.carted ?? false) || k.carted,
      });
      wanted.add(k.article);
    }
    // a look that ended in an order on its day is about none of the three screens, whichever copy says so
    for (const o of orderedLooks) {
      const [co, day, article] = o.split("|");
      const d = drafts.get(`${co}|${day}`);
      if (d?.looks.delete(article) && d.looks.size === 0) drafts.delete(`${co}|${day}`);
    }
    kept = { merged, unknownCompany };
  }

  // ---- a 1 that overwrote a typed quantity: the typed one, from the history
  at.step = "quantity history";
  const quantityHistoryError = await recoverTypedQuantities(
    [...drafts.values()].map((d) => ({ companyId: d.company.companyId, day: d.day, looks: d.looks })), signal);

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
  // each article as Products & Pricing gives it (additive, 01.11.2026); P&P ends its descriptions with " -"
  const ppText = (v: string | null | undefined) => (v ?? "").trim().replace(/\s+-$/, "") || null;
  // a property P&P leaves empty is unknown, not 0 - num(null) is 0, which the shelf rule below reads as an empty shelf
  const exact = (v: string | null | undefined) => (v == null || String(v).trim() === "" ? null : num(v));
  const articleFacts: Record<string, ArticleFacts> = {};
  if (params.facts) for (const [a, pp] of spec) {
    articleFacts[a] = {
      description: ppText(pp.article_description),
      profitCentre: ppText(pp.profit_center)?.toUpperCase() ?? null,
      mainGroup: ppText(pp.main_group_description),
      subGroup: ppText(pp.sub_group_description),
      product: ppText(pp.product_number),
      productName: ppText(pp.product_description),
      salesUnit: ppText(pp.sales_unit),
      minimum: knownMinimum(pp.moq, exact(pp.moq_minimum_quantity)),
      stock: exact(pp.stock_quantity),
    };
  }

  // Names for the owners, from HubSpot: the roster says which team, not who.
  const ownerIndex = await owners(signal).catch(() => new Map<string, string>());
  // owners known by name only (Jan Kalt) join their roster under their real id
  adoptNamedOwners(ownerIndex);
  const nameOf = (id: string | null) => (id && ownerIndex.get(id)) || ownerName(id);

  const priceChecks: PriceCheckRow[] = [];
  const moq: LookRecord[] = [];
  const availability: LookRecord[] = [];
  const lostLooks: Record<LostReason, number> = { shelf: 0, moq: 0, cart: 0, price: 0, looked: 0 };
  const lostCompanies: Record<LostReason, Set<string>> = { shelf: new Set(), moq: new Set(), cart: new Set(), price: new Set(), looked: new Set() };
  const lostAll = new Set<string>();
  const path: PathLook[] = [];

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

    for (const x of detailed) {
      const why = lostReason({ qty: x.qty, carted: x.look.carted, stock: x.stock, minimum: x.minimum });
      lostLooks[why]++;
      lostCompanies[why].add(d.company.companyId);
      lostAll.add(d.company.companyId);
      // ordered that day by another line of the property: the funnel counts it once, ordered
      if (params.facts && !orderedLooks.has(`${d.company.companyId}|${d.day}|${x.article}`)) {
        const c = d.company;
        path.push({ companyId: c.companyId, companyName: c.companyName, customerNumber: c.customerNumber, country: c.country, day: d.day, article: x.article,
          step: pathStep({ qty: x.qty, carted: x.look.carted, stock: x.pp ? exact(x.pp.stock_quantity) : null, minimum: x.minimum }) });
      }
    }

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
        // a bare 1 is the shop's own number, not a typed one (rules.ts, BARE_ONE_COUNTS)
        counted: typedQuantity(x.qty) && !x.special && (x.profitCentre === "KT" || x.profitCentre === "DT"),
      })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

      const verdict = priceCheckQualifies(list.map((a) => ({
        article: a.article, profitCentre: a.profitCentre, value: a.value, qty: a.qty,
      })));
      const dueOn = nextWorkingDay(d.day);

      priceChecks.push({
        ...d.company,
        key: `${d.company.customerNumber || d.company.companyId}|${d.day}`,
        ticketId: null,
        team: teamOf(d.company.ownerId),
        owner: nameOf(d.company.ownerId),
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
        expired: false,
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
        profitCentre: x.profitCentre,
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

  // A qualifying day the runs can no longer reach will never get a ticket - say
  // so, instead of promising "next run" forever (SARCLA 10.10: no catch-up).
  const windowStart = ticketWindowStart(today);
  for (const r of priceChecks) r.expired = r.qualifies && !r.excluded && r.gateOpen && !r.ticketId && r.day < windowStart;

  // Biggest first - by value once it means something, by articles until then.
  priceChecks.sort((a, b) => (VALUE_FLOOR_ACTIVE ? b.value - a.value : b.counted - a.counted) || b.day.localeCompare(a.day));
  // The ones we can act on first: a customer who asked for less than the minimum,
  // or a shelf we can count the gap on.
  moq.sort((a, b) => Number(b.belowMoq) - Number(a.belowMoq) || b.day.localeCompare(a.day) || (b.value ?? 0) - (a.value ?? 0));
  availability.sort((a, b) => (b.shortfall ?? 0) - (a.shortfall ?? 0) || b.day.localeCompare(a.day));

  const lost = {
    looks: lostLooks,
    companies: Object.fromEntries(Object.entries(lostCompanies).map(([k, v]) => [k, v.size])) as Record<LostReason, number>,
    total: Object.values(lostLooks).reduce((a, n) => a + n, 0),
    totalCompanies: lostAll.size,
    // the looks that did end in an order, the same way counted - what the lost ones are out of
    ordered: orderedLooks.size,
    orderedCompanies: orderedCompanies.size,
  };
  if (params.facts) for (const o of orderedLooks) {
    const [companyId, day, article] = o.split("|");
    const c = seen.get(companyId);
    path.push({ companyId, companyName: c?.companyName ?? null, customerNumber: c?.customerNumber ?? null, country: c?.country ?? null, day, article, step: "won" });
  }
  return { priceChecks, moq, availability, lost, scanned, articlesLookedUp: spec.size,
           ticketLookupError, quantityHistoryError, generatedAt: new Date().toISOString(),
           // only for a caller that asks (`facts`): the Datatracker's answer stays the size it was
           ...(params.facts ? {
             articleFacts,
             orderedLooks: [...orderedLooks].map((k) => { const [companyId, day, article] = k.split("|"); return { companyId, day, article }; }),
             path,
           } : {}),
           kept };
}

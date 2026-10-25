// MAP ASSIGNMENT - what GET /api/uc/map-assignment returns and PUT/POST accept: the contract between the engine
// (engine.ts, the route) and the page (src/app/uc/map-assignment). Types only.

import type { AssignRules, Decision, OwnerId } from "./rules";

export type Owner = { id: OwnerId; name: string; active: boolean };

/** One company whose owner or region_responsibility differs from what the rules decide. */
export type CompanyChange = {
  id: string; name: string; country: string | null; zip: string | null; sae: string | null;
  ownerNow: OwnerId | null; regionNow: OwnerId | null;
  decided: Decision;
  /** contacts of the company whose owner / region / SAE differ from the company's decided values */
  contactsOff: number;
  /** live: what was written, or why not */
  wrote?: { at: string; ok: boolean; error?: string } | null;
};

export type CountrySummary = {
  country: string; companies: number;
  /** companies whose owner or region would change */
  change: number;
  /** by decided owner: how many companies each person gets in this country */
  byOwner: { owner: OwnerId; companies: number }[];
  flags: Record<string, number>;
  /** how the rules decide them (SARCLA 20.10.2026: "rule 1 the SAE, rule 2 the postcode"): via -> companies
   *  (sae = rule 1, zone / default = rule 2, key = key account, redirection = an Owner redirection rule kept) */
  byVia: Record<string, number>;
  live: boolean;
  /** what going live writes at once: the differing companies with no owner, or one who has left (25.10.2026: live
   *  writes only those and what changes from then on - like the workflows it replaces); absent from an older hub */
  writeAtOnce?: number;
  /** when the country went live (ISO), null in shadow */
  liveSince?: string | null;
};

/** A recent contact with no company: what the domain says, and the candidates. */
export type NoCompany = {
  id: string; email: string | null; name: string; createdate: string | null; ownerId: OwnerId | null;
  why: string; suggestedOwner: OwnerId | null; link: string | null;
  candidates: { id: string; name: string; ownerId: OwnerId | null; erpId: string | null }[];
};

export type ScanInfo = { at: string; seconds: number; companies: number; contacts: number; mode: "full" | "changes"; error?: string };

/**
 * Who would go to whom (SARCLA 20.10.2026: Differences "moves by person"): per country, the owner now -> the owner by
 * the saved rules, over the WHOLE table. from === to: the owner is right, region_responsibility is not.
 */
export type MoveStat = {
  country: string; from: OwnerId | null; to: OwnerId;
  companies: number;
  /** their contacts that are off (where counted) */
  contacts: number;
};

/** GET ?companies=1&erp=id,id or &q=text (&country=CC): companies by ERP id or by a search on name / ERP id - for the key
 *  accounts (SARCLA 20.10.2026: "a key account customer should be displayed as a row, then you tick off or add by search"). */
export type CompanyRow = {
  id: string; name: string; erpId: string | null; country: string | null; zip: string | null;
  ownerNow: OwnerId | null; decided: OwnerId | null; via: string | null;
  /** revenue this year (EUR), null when unknown */
  revenue: number | null;
};

/** GET ?changes=1&country=&from=&to=&q=&offset=: one move's companies, a page at a time (sorted by name). */
export type ChangesPage = { total: number; offset: number; rows: CompanyChange[] };

/**
 * An Owner redirection rule that gives companies to someone the map would not (SARCLA 20.10.2026: "if these rules are
 * contrary to assignment we need an alert that we accept or decline"). Per rule:
 *   accept  ("map")  the map wins - the rule is switched off in Owner redirection
 *   decline ("rule") the rule wins - the map gives the companies it matches to the rule's person and leaves them alone
 * Counted on the stored companies the rule matches (the first matching rule, as Owner redirection runs them).
 */
export type RedirectionConflict = {
  ruleId: string;
  /** 1-based, as the Redirections list shows it */
  position: number;
  enabled: boolean;
  kind: "country" | "owner";
  countries: string[]; customCountries: string[]; fromOwner: OwnerId | null;
  toOwner: OwnerId;
  /** stored companies the rule matches */
  matched: number;
  /** of those, the map gives to someone else - by that person, most first */
  against: { owner: OwnerId; companies: number; countries: string[] }[];
  /** the answer, if any, and whether it still holds (the rule unchanged since) */
  decision: { decision: "map" | "rule"; at: string; by: string; current: boolean } | null;
};

export type MapData = {
  rules: AssignRules;
  /** the rules as first seeded from the HubSpot workflows - "back to the start" on the page */
  seeded: AssignRules;
  owners: Owner[];
  /** per country: "shadow" (compare only) or live (the hub writes owner + region + contacts) */
  live: Record<string, boolean>;
  last: ScanInfo | null;
  countries: CountrySummary[];
  /** the first 3,000 differences, biggest countries first */
  changes: CompanyChange[];
  noCompany: NoCompany[];
  /** every move, complete (changes above is cut at 3,000) */
  moves: MoveStat[];
  /** Owner redirection rules against the map, open ones first */
  conflicts: RedirectionConflict[];
  /** the sandbox (SARCLA 24.10.2026): rules to try things on - never decide or write; null = none yet (it starts as a
   *  copy of the live rules). Absent from an older hub. */
  sandbox?: { rules: AssignRules; by: string | null; at: string | null; from: string | null } | null;
  admin: boolean;
  by: string | null; at: string | null;
};

/** PUT body (admins): any of these. */
export type MapPut = {
  rules?: AssignRules; live?: Record<string, boolean>;
  patch?: { sae?: Record<string, OwnerId>; defaultOwner?: OwnerId; countries?: Record<string, import("./rules").CountryRule | null> };
  /** a conflict answered: "map" switches the rule off in Owner redirection, "rule" keeps it over the map, null forgets the answer */
  redirection?: { ruleId: string; decision: "map" | "rule" | null };
  /** the sandbox: a patch merged into it, a part put back to live (reset: "sae" | country), or reset: true = start again
   *  from live - in a request of its own; everyone who can open the page may change the sandbox */
  sandbox?: { patch?: { sae?: Record<string, OwnerId>; defaultOwner?: OwnerId; countries?: Record<string, import("./rules").CountryRule | null> }; reset?: string | boolean };
  /** admins: bring one part of the sandbox into the live rules ("sae" = the SAE table and the default, or a country) */
  promote?: { part: string };
};
/** POST body: {action: "run"} a scan now; {action: "link", contactId, companyId} links a contact from the list (admins). */
export type MapPost = { action: "run" } | { action: "link"; contactId: string; companyId: string };

/**
 * GET ?layers=<CC>: what the map can show per postcode, macro (regions) to detail (postcodes) - SARCLA 19.10.2026:
 * "interactive from macro to much detail, showing revenue, top customers, GDP, new customers, priority customers".
 * From the engine's company table (refreshed by its scans); companies without a readable postcode are counted in
 * `unplaced`.
 */
export type PostcodeStat = {
  zip: string;
  companies: number;
  /** companies with at least one order this year (credit notes left out) */
  customers: number;
  /** first order this year */
  newCustomers: number;
  /** revenue this year, in the company property named in LayerData.revenueField (EUR - Performis net revenue) */
  revenue: number;
  /** sales_priority P1..P4 -> companies */
  priority: Record<string, number>;
  /** apso_customer (APSOcore, APSOgrowth ...) -> companies; absent from an older hub */
  category?: Record<string, number>;
  /** the three biggest customers here by revenue */
  top: { id: string; name: string; revenue: number; owner: OwnerId | null }[];
  /** where it comes from (SARCLA 20.10.2026: "from what it comes - Performis to HubSpot"): the Performis SAE as
   *  written -> companies ("" = none) */
  sae?: Record<string, number>;
  /** owner in HubSpot now -> companies ("" = nobody) */
  now?: Record<string, number>;
  /** owner by the saved rules -> companies (the company's own decision: SAE, key account, zone) */
  decided?: Record<string, number>;
  /** companies whose owner or region_responsibility differ from the rules */
  change?: number;
  /** how the rules decide them: via -> companies (sae = rule 1, zone / default = rule 2, key, redirection) */
  via?: Record<string, number>;
  /** tickets of the last 90 days on these companies: every pipeline / the sales ones (ESO + TSA) */
  tickets?: number; sales?: number;
  /** the same figures per person the rules give the companies (SARCLA 21.10.2026: "more insightful KPIs - GDP,
   *  revenue, orders incoming, new customers, number of tickets, number of sales tickets") */
  byOwner?: Record<string, PersonStat>;
};
export type PersonStat = { companies: number; customers: number; newCustomers: number; revenue: number; tickets: number; sales: number };
export type LayerData = {
  country: string; at: string | null;
  points: PostcodeStat[];
  unplaced: number;
  /** GDP per region (shapes regions[].code), where known; null = unknown */
  gdp: { code: string; gdp: number | null }[];
  /** where the GDP comes from (public/geo/gdp/index.json): the country's GDP year and the year of the regions' shares
   *  (SARCLA 24.10.2026: "put also the source of GDP at the end"); absent from an older hub */
  gdpSource?: { year: number | null; regionalYear: number | null } | null;
  revenueField: string; customersField: string;
  /** the sales workload per person in this country (SARCLA 20.10.2026: "the KPI page should have ticket workload,
   *  revenue, GDP, everything - really a KPI page measuring the sales workload"); absent from an older hub */
  load?: OwnerLoad[];
  /** ESO + TSA tickets per owner, every country: open now, and created in the last 90 days */
  tickets?: TicketLoad | null;
};

export type OwnerLoad = {
  owner: OwnerId;
  /** companies owned in HubSpot now / by the rules */
  now: number; after: number;
  /** of "after": bought this year, first order this year, revenue this year (EUR), contacts */
  customers: number; newCustomers: number; revenue: number; contacts: number;
  /** of "after": tickets of the last 90 days on their companies - every pipeline, and the sales ones (ESO + TSA) */
  tickets: number; sales: number;
  /** of "after", by sales_priority (P1..P4, "" = none) and by apso_customer ("" = none) - SARCLA 24.10.2026: "the split
   *  of PRIO and APSOcustomer"; absent from an older hub */
  priority?: Record<string, number>; category?: Record<string, number>;
  /** of "after": the open ESO + TSA tickets on their companies in this country (25.10.2026); absent from an older hub */
  salesOpen?: number;
};
export type TicketLoad = { at: string; byOwner: Record<string, { open: number; last90: number }> };

/** GET ?performis=1: the Performis SAE copy, by country and SAE - what it fills on companies and contacts. */
export type SaeStat = {
  sae: string; country: string;
  companies: number; contacts: number;
  /** the person the rules give it in this country (global table or this country's redirect), null = not mapped */
  mappedTo: OwnerId | null; redirected: boolean;
  /** owner now -> companies */
  ownerNow: { owner: OwnerId | null; companies: number }[];
  /** companies / contacts whose owner, region or SAE differ from the rules */
  companiesOff: number; contactsOff: number;
};
export type PerformisData = {
  at: string | null;
  sae: SaeStat[];
  /** the properties the copy writes */
  props: { company: string[]; contact: string[] };
};

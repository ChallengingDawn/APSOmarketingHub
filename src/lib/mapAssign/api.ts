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
  live: boolean;
};

/** A recent contact with no company: what the domain says, and the candidates. */
export type NoCompany = {
  id: string; email: string | null; name: string; createdate: string | null; ownerId: OwnerId | null;
  why: string; suggestedOwner: OwnerId | null; link: string | null;
  candidates: { id: string; name: string; ownerId: OwnerId | null; erpId: string | null }[];
};

export type ScanInfo = { at: string; seconds: number; companies: number; contacts: number; mode: "full" | "changes"; error?: string };

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
  admin: boolean;
  by: string | null; at: string | null;
};

/** PUT body (admins): any of these. */
export type MapPut = { rules?: AssignRules; live?: Record<string, boolean>; patch?: { sae?: Record<string, OwnerId>; defaultOwner?: OwnerId; countries?: Record<string, import("./rules").CountryRule | null> } };
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
  /** revenue this year, in the company property named in LayerData.revenueField (CHF) */
  revenue: number;
  /** sales_priority P1..P4 -> companies */
  priority: Record<string, number>;
  /** the three biggest customers here by revenue */
  top: { id: string; name: string; revenue: number; owner: OwnerId | null }[];
};
export type LayerData = {
  country: string; at: string | null;
  points: PostcodeStat[];
  unplaced: number;
  /** GDP per region (shapes regions[].code), where known; null = unknown */
  gdp: { code: string; gdp: number | null }[];
  revenueField: string; customersField: string;
};

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

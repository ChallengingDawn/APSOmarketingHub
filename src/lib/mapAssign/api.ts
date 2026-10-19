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
export type MapPut = { rules?: AssignRules; live?: Record<string, boolean> };
/** POST body: {action: "run"} a scan now; {action: "link", contactId, companyId} links a contact from the list (admins). */
export type MapPost = { action: "run" } | { action: "link"; contactId: string; companyId: string };

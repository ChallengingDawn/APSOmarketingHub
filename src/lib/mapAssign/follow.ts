// MAP ASSIGNMENT - contacts follow their company, the pure part. SARCLA 24.10.2026: "On the contact page I don't see
// yet the steering module for the contact associations (when a contact's properties differ from the company's it
// should be corrected instantly as associated)" and "Can we correct all 'The latest that do not follow the rules'? If
// we are 100% sure that they don't follow the rules." What a contact should have - its OWN company's owner and region
// responsibility in HubSpot now -, what differs, a company's writes within a pass's cap, and the page's types. Which of
// the new contacts are sure: sureClass() in contacts.ts. No HubSpot, no database, relative imports only -
// tests/map-assign-contact-follow.test.ts runs it as is. The reads, the writes, the kv and the lock: contactFollow.ts.

import { isInternal, type Internal } from "./plan";
import type { NotSureCounts } from "./contacts";

/** The most contacts one pass writes (the rest wait for the next pass, 15 minutes later when Automatic is on). */
export const FOLLOW_CAP = 2000;
/** The most companies one "all" pass looks at (biggest first) - each costs reads even when nothing is written. */
export const FOLLOW_COMPANIES = 500;

/** "all": the companies whose contacts differ (the nightly read's counts); "new": the contacts created since the last
 *  pass; "latest": the sure ones among the new contacts of the last 30 days that do not follow the rules. */
export type FollowScope = "all" | "new" | "latest";
/** What one pass did; "auto" = the engine's run with Automatic on ("new", then a batch of "all"). */
export type FollowLast = {
  at: string; scope: FollowScope | "auto"; by: string;
  /** contacts compared with their company / written / not written (HubSpot said no - in the log, tried again after the
   *  next nightly read) */
  checked: number; wrote: number; failed: number;
  /** differ but past the cap: the next pass */
  left: number;
  /** companies looked at */
  companies: number;
  seconds: number;
  /** "latest": the not sure ones, never written */
  notSure?: number;
  error?: string;
};
/** kv mapAssign:contactFollow - the Automatic switch (default off). */
export type FollowSwitch = { auto: boolean; by: string | null; at: string | null };
/** The contacts that differ from their company, as the nightly full read counted them (contacts_mism, A+P people left
 *  out) - lowered by each "all" pass as it corrects them. */
export type FollowPending = {
  contacts: number; companies: number;
  /** contacts per company country ("??" = the company has none) */
  byCountry: Record<string, number>;
  /** the nightly full read that counted them */
  at: string | null;
  /** companies with no owner: their contacts are left alone (not in the figures above) */
  noOwner: { contacts: number; companies: number };
  /** companies whose owner has left (Stahl, Nitschke, Bozek): left alone too, until they get a new owner - by that owner */
  ownerLeft?: { contacts: number; companies: number; owners: { owner: string; contacts: number }[] };
};
/** The pass going, as far as it is: written after every hundred contacts (seen = then). */
export type FollowNow = { at: string; scope: FollowScope | "auto"; by: string; checked: number; wrote: number; failed: number; companies: number; seen: string };
/** GET ?contacts=1 -> follow: the steering card. */
export type ContactFollow = FollowSwitch & {
  last: FollowLast | null;
  /** a pass is going (here or on the other copy of the hub) */
  running: boolean;
  /** how far it is (null: none going, or an older hub) */
  now?: FollowNow | null;
  /** "Correct now" carried on by the engine's runs until none is left (who asked, when); null = nothing to carry on */
  rest?: { by: string; at: string } | null;
  pending: FollowPending;
  /** the new contacts of the last 30 days that do not follow the rules: sure (written by "Correct the sure ones") and
   *  not sure - the company first (why: per reason); known false = the hourly count predates the sure ones */
  latest: { sure: number; notSure: number; why: NotSureCounts | null; known: boolean; at: string | null };
  /** the most one pass writes */
  cap: number;
};
/** PUT {contactFollow: {auto}} or {contactFollow: {rest: false}} (stop carrying on) (admins, a request of its own);
 *  POST {action: "contacts-follow", scope} (admins). */
export type FollowPut = { contactFollow: { auto: boolean } | { rest: false } };
export type FollowPost = { action: "contacts-follow"; scope: "all" | "latest" };

/** Ids compared as text - kv and pg can hand back a number. null = "" (nobody). */
const v = (x: unknown) => String(x ?? "").trim();

/** What a contact should have: its company's owner and region responsibility now. null = the company has no owner -
 *  its contacts are left alone. region null = the company has none: the contact's region is left alone. */
export type FollowTarget = { owner: string; region: string | null };
export function followTarget(co: { owner?: unknown; region?: unknown } | null | undefined): FollowTarget | null {
  const owner = v(co?.owner);
  if (!owner) return null;
  return { owner, region: v(co?.region) || null };
}

/** Only what differs: hubspot_owner_id and / or region_responsibility - nothing else is ever written. */
export function followChanges(c: { owner?: unknown; region?: unknown }, t: FollowTarget | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!t) return out;
  if (v(c.owner) !== t.owner) out.hubspot_owner_id = t.owner;
  if (t.region && v(c.region) !== t.region) out.region_responsibility = t.region;
  return out;
}

/** A contact's own company: its primary company; with none, the first company that lists it (as ownContacts). */
export function ownCompanyOf(primary: unknown, listedBy: readonly unknown[] = []): string | null {
  const p = v(primary);
  if (p) return p;
  for (const x of listedBy) if (v(x)) return v(x);
  return null;
}

/** The company follows the rules in HubSpot now: owner AND region responsibility are the person the rules give it. */
export const companyFollowsRules = (co: { owner?: unknown; region?: unknown }, decided: unknown) =>
  !!v(decided) && v(co.owner) === v(decided) && v(co.region) === v(decided);

export type FollowContact = { id: string; email: string | null; owner: string | null; region: string | null };
export type FollowWrite = {
  id: string; company: string; properties: Record<string, string>;
  before: { hubspot_owner_id: string | null; region_responsibility: string | null };
};
export type FollowPlan = {
  writes: FollowWrite[];
  /** compared (A+P people not counted) */
  checked: number;
  /** A+P people, left alone */
  internal: number;
  /** differ, past the budget */
  left: number;
  /** the company has no owner: nothing planned */
  noOwner: boolean;
};

/**
 * One company's own contacts against it: what to write (only what differs), A+P people left alone, at most `budget`
 * writes - the rest counted in `left`. `target` null (the company has no owner) = nothing.
 */
export function planFollow(companyId: string, target: FollowTarget | null, contacts: readonly FollowContact[], internal: Internal, budget: number): FollowPlan {
  const plan: FollowPlan = { writes: [], checked: 0, internal: 0, left: 0, noOwner: !target };
  if (!target) return plan;
  const seen = new Set<string>();
  for (const c of contacts) {
    const id = v(c.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (isInternal(c.email, internal)) { plan.internal++; continue; }
    plan.checked++;
    const ch = followChanges(c, target);
    if (!Object.keys(ch).length) continue;
    if (plan.writes.length >= budget) { plan.left++; continue; }
    plan.writes.push({ id, company: v(companyId), properties: ch, before: { hubspot_owner_id: c.owner ?? null, region_responsibility: c.region ?? null } });
  }
  return plan;
}

/** The not sure ones, all reasons together. */
export const notSureTotal = (n: NotSureCounts | null | undefined) => (n ? (n.company || 0) + (n["unknown-company"] || 0) + (n["no-company"] || 0) : 0);

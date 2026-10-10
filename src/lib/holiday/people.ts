// WHO IS IN, WHO STANDS IN FOR THEM - the people behind Holiday redirection.
//
// SARCLA, 10.10: "on holiday redirection it would be great to see the person,
// their deputy and their status; the Back Office people as well; and we should be
// able to change the deputy with a dropdown".
//
// Everything lives in HubSpot, where the sweep reads it: the OWNER (name, e-mail,
// primary team) and the USER record (out of office, absence hours, deputy 1 and
// deputy 2 as owner ids). Nothing is stored in the hub. A deputy change writes the
// same user property the sweep reads, so it takes effect on its next run.

import { hubspotFetchJson } from "../integrations/hubspot";

/** The HubSpot primary teams shown, in this order. */
export const TEAMS = ["ESO", "TSA", "Backoffice Team"] as const;
export type Team = (typeof TEAMS)[number];
export const TEAM_LABEL: Record<Team, string> = { ESO: "ESO", TSA: "TSA", "Backoffice Team": "Back Office" };

export type Absence = { from: string; to: string };
export type Person = {
  ownerId: string;
  name: string;
  email: string | null;
  team: Team;
  /** Null when the owner has no HubSpot user record - then the sweep cannot see them either. */
  userObjectId: string | null;
  /** HubSpot's own out-of-office flag, as the sweep reads it. */
  away: boolean;
  /** The absence holding today, when absence hours are set. */
  now: Absence | null;
  /** The next absence that has not started yet. */
  next: Absence | null;
  deputy1: string | null;
  deputy2: string | null;
};

type OwnerRow = { id: string | number; firstName?: string | null; lastName?: string | null; email?: string | null;
  teams?: { name?: string | null; primary?: boolean | null }[] | null };
type Page<T> = { results?: T[]; paging?: { next?: { after?: string } } };

const USER_PROPS = ["hubspot_owner_id", "hs_email", "hs_is_out_of_office", "hs_out_of_office_hours", "ap_deputy_owner_id", "ap_deputy_2_owner_id"];

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The absence holding `now` and the next one ahead, from hs_out_of_office_hours. */
export function absences(raw: string | null | undefined, nowMs: number): { now: Absence | null; next: Absence | null } {
  let arr: unknown;
  try { arr = JSON.parse(raw || "[]"); } catch { return { now: null, next: null }; }
  if (!Array.isArray(arr)) return { now: null, next: null };
  let now: Absence | null = null;
  let next: { s: number; e: number } | null = null;
  for (const w of arr) {
    const s = Number((w as { startTimestamp?: unknown })?.startTimestamp);
    const e = Number((w as { endTimestamp?: unknown })?.endTimestamp);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) continue;
    if (s <= nowMs && nowMs <= e) now = { from: isoDay(s), to: isoDay(e) };
    else if (s > nowMs && (!next || s < next.s)) next = { s, e };
  }
  return { now, next: next ? { from: isoDay(next.s), to: isoDay(next.e) } : null };
}

function primaryTeam(o: OwnerRow): string | null {
  const teams = o.teams ?? [];
  return (teams.find((t) => t.primary)?.name ?? teams[0]?.name ?? null) || null;
}

export async function readPeople(nowMs = Date.now()): Promise<Person[]> {
  const owners: OwnerRow[] = [];
  let after: string | undefined;
  do {
    const j = await hubspotFetchJson<Page<OwnerRow>>({ path: `/crm/v3/owners?limit=100&archived=false${after ? `&after=${after}` : ""}` });
    owners.push(...(j.results ?? []));
    after = j.paging?.next?.after;
  } while (after);

  const users = new Map<string, { id: string; p: Record<string, string | null> }>();
  after = undefined;
  do {
    const q = new URLSearchParams({ limit: "100", properties: USER_PROPS.join(",") });
    if (after) q.set("after", after);
    const j = await hubspotFetchJson<Page<{ id: string; properties?: Record<string, string | null> }>>({ path: `/crm/v3/objects/users?${q}` });
    for (const u of j.results ?? []) {
      const owner = u.properties?.hubspot_owner_id;
      if (owner) users.set(String(owner), { id: String(u.id), p: u.properties ?? {} });
    }
    after = j.paging?.next?.after;
  } while (after);

  const people: Person[] = [];
  for (const o of owners) {
    const team = primaryTeam(o);
    if (!team || !(TEAMS as readonly string[]).includes(team)) continue;
    const ownerId = String(o.id);
    const u = users.get(ownerId);
    const { now, next } = absences(u?.p.hs_out_of_office_hours, nowMs);
    people.push({
      ownerId,
      name: `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || ownerId,
      email: o.email ?? null,
      team: team as Team,
      userObjectId: u?.id ?? null,
      away: String(u?.p.hs_is_out_of_office ?? "").toLowerCase() === "true",
      now,
      next,
      deputy1: u?.p.ap_deputy_owner_id || null,
      deputy2: u?.p.ap_deputy_2_owner_id || null,
    });
  }
  people.sort((a, b) => TEAMS.indexOf(a.team) - TEAMS.indexOf(b.team) || a.name.localeCompare(b.name));
  return people;
}

/**
 * Set deputy 1 or 2 of one person (null clears it). Written with the hub's own
 * token; if HubSpot refuses that, with the tickets token. A refusal on both is a
 * missing scope (crm.objects.users.write), and says so.
 */
export async function setDeputy(userObjectId: string, slot: 1 | 2, deputyOwnerId: string | null): Promise<void> {
  const property = slot === 1 ? "ap_deputy_owner_id" : "ap_deputy_2_owner_id";
  const body = { properties: { [property]: deputyOwnerId ?? "" } };
  const path = `/crm/v3/objects/users/${encodeURIComponent(userObjectId)}`;
  try {
    await hubspotFetchJson({ path, method: "PATCH", body });
  } catch (first) {
    const status = (first as { status?: number })?.status;
    if (status !== 401 && status !== 403) throw first;
    try {
      await hubspotFetchJson({ path, method: "PATCH", body, useTicketsToken: true });
    } catch (second) {
      const st = (second as { status?: number })?.status;
      if (st === 401 || st === 403) {
        throw new Error("HubSpot refused the change: the hub's app needs the crm.objects.users.write scope " +
          "(app-hsmeta.json in hubspot-apsomarketinghub, then hs project upload).");
      }
      throw second;
    }
  }
}

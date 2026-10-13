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
import { hubspotToken, ticketsToken } from "../integrations/status";

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

/**
 * The owners HubSpot allows in each deputy dropdown. ap_deputy_owner_id and
 * ap_deputy_2_owner_id are dropdown properties with a fixed option list, and a
 * value outside it is refused (SARCLA 11.10: Jan Kalt, 37053854, "was not one of
 * the allowed options"). The hub's app cannot change that list - HubSpot offers
 * no user-schema scope to project apps - so the screen offers only the allowed
 * owners and says who has to be added in HubSpot. Null when it cannot be read.
 */
export type DeputyOption = { value: string; label: string };
export async function readDeputyOptions(): Promise<{ d1: DeputyOption[]; d2: DeputyOption[] } | null> {
  try {
    type Opt = { value?: string; label?: string; hidden?: boolean; displayOrder?: number };
    const [a, b] = await Promise.all(["ap_deputy_owner_id", "ap_deputy_2_owner_id"].map((p) =>
      hubspotFetchJson<{ options?: Opt[] }>({ path: `/crm/v3/properties/users/${p}` })));
    // HubSpot's own choices, in HubSpot's order and with HubSpot's labels - what
    // the user sees in HubSpot is what the hub offers
    const opts = (r: { options?: Opt[] }) => (r.options ?? [])
      .filter((o) => o.value && !o.hidden)
      .sort((x, y) => (x.displayOrder ?? 0) - (y.displayOrder ?? 0))
      .map((o) => ({ value: String(o.value), label: String(o.label || o.value) }));
    return { d1: opts(a), d2: opts(b) };
  } catch {
    return null;
  }
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
 * The scopes a token really carries, asked of HubSpot itself (the token-info
 * endpoint returns the list, never the secret). Null when it cannot be told.
 */
async function scopesOf(useTicketsToken: boolean): Promise<string[] | null> {
  const token = useTicketsToken ? ticketsToken() : hubspotToken();
  if (!token) return null;
  try {
    const r = await hubspotFetchJson<{ scopes?: string[] }>({
      path: "/oauth/v2/private-apps/get/access-token-info", method: "POST", body: { tokenKey: token },
    });
    return Array.isArray(r.scopes) ? r.scopes : null;
  } catch {
    return null;
  }
}

const said = (e: unknown) => {
  const st = (e as { status?: number })?.status;
  return `${st ?? "?"} ${String((e as Error)?.message ?? e).replace(/\s+/g, " ").slice(0, 220)}`;
};

/**
 * Set deputy 1 or 2 of one person (null clears it). Written with the hub's own
 * token; if HubSpot refuses that, with the tickets token. When both refuse, the
 * error carries what HubSpot said to each AND whether each token holds
 * crm.objects.users.write - SARCLA re-authorized the app (11.10) and still got
 * "refused", and a guessed reason was no help.
 */
export async function setDeputy(userObjectId: string, slot: 1 | 2, deputyOwnerId: string | null): Promise<void> {
  const property = slot === 1 ? "ap_deputy_owner_id" : "ap_deputy_2_owner_id";
  const body = { properties: { [property]: deputyOwnerId ?? "" } };
  const path = `/crm/v3/objects/users/${encodeURIComponent(userObjectId)}`;
  try {
    await hubspotFetchJson({ path, method: "PATCH", body });
  } catch (first) {
    const status = (first as { status?: number })?.status;
    if (/INVALID_OPTION|not one of the allowed options/.test(String((first as Error)?.message ?? ""))) {
      throw new Error(`${deputyOwnerId} is not in HubSpot's list of allowed deputies for "${property}". Add it in HubSpot - ` +
        `Settings > Properties > User properties > ${property} > add an option with internal value ${deputyOwnerId} - and pick the person again.`);
    }
    if (status !== 401 && status !== 403) throw first;
    // no separate tickets app any more (13.10.2026): asking again would ask the same app
    if (!ticketsToken()) throw first;
    try {
      await hubspotFetchJson({ path, method: "PATCH", body, useTicketsToken: true });
    } catch (second) {
      const st = (second as { status?: number })?.status;
      if (st !== 401 && st !== 403) throw second;
      const [hub, tix] = await Promise.all([scopesOf(false), scopesOf(true)]);
      const has = (s: string[] | null) => (s === null ? "scopes unknown" : s.includes("crm.objects.users.write") ? "HAS crm.objects.users.write" : "does NOT have crm.objects.users.write");
      const detail = `hub app: ${said(first)} [${has(hub)}]; tickets app: ${said(second)} [${has(tix)}]`;
      console.warn(`[holiday] deputy write refused - ${detail}`);
      throw new Error(hub && !hub.includes("crm.objects.users.write")
        ? `HubSpot refused the change: the hub's token still does not carry crm.objects.users.write - the upload with that scope has not reached it (hs project upload in hubspot-apsomarketinghub, then approve). Details: ${detail}`
        : `HubSpot refused the change. Details: ${detail}`);
    }
  }
}

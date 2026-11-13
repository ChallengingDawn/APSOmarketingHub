// ABSENCES - reading and writing them in HubSpot (the rule in absenceRules.ts). SARCLA 13.11.2026: "allow also to see
// the absences and to record absences for colleagues", on Back Office distribution > Availability.
//
// The window goes into the person's HubSpot user record (hs_out_of_office_hours), the same field HubSpot's own
// out-of-office fills: HubSpot then shows them out of office, and the holiday redirection and the Back Office
// distribution, which read that field, take it into account on their next run. The record is read again just before
// each write and only the one window is added or taken away - the others stay exactly as they were. Every write is
// kept (kv absences:log, the last 500).

import { hubspotFetchJson } from "../integrations/hubspot";
import { kvGet, kvSet } from "../db/init";
import { readPeople, type Person } from "./people";
import { comingWindows, newWindow, windowsOf, withWindow, withoutWindow, type AbsenceWindow } from "./absenceRules";

const LOG = "absences:log";
type Page<T> = { results?: T[]; paging?: { next?: { after?: string } } };
type UserRow = { id: string; properties?: Record<string, string | null> };
export type LogRow = { at: string; by: string; ownerId: string; name: string; action: "add" | "remove"; from: string; to: string; title: string };
export type AbsencePerson = { ownerId: string; name: string; team: Person["team"]; userObjectId: string | null; away: boolean; windows: AbsenceWindow[] };

/** Every user's out-of-office hours, by owner id. */
async function hoursByOwner(): Promise<Map<string, { userId: string; raw: string | null }>> {
  const out = new Map<string, { userId: string; raw: string | null }>();
  let after: string | undefined;
  do {
    const q = new URLSearchParams({ limit: "100", properties: "hubspot_owner_id,hs_out_of_office_hours" });
    if (after) q.set("after", after);
    const j = await hubspotFetchJson<Page<UserRow>>({ path: `/crm/v3/objects/users?${q}` });
    for (const u of j.results ?? []) { const o = u.properties?.hubspot_owner_id; if (o) out.set(String(o), { userId: String(u.id), raw: u.properties?.hs_out_of_office_hours ?? null }); }
    after = j.paging?.next?.after;
  } while (after);
  return out;
}

/** The people shown: the Back Office team, plus anyone named in `extra` (owner ids), with their coming absences. */
export async function absencePeople(extra: string[], nowMs = Date.now()): Promise<AbsencePerson[]> {
  const [people, hours] = await Promise.all([readPeople(nowMs), hoursByOwner()]);
  const want = new Set(extra);
  return people.filter((p) => p.team === "Backoffice Team" || want.has(p.ownerId))
    .map((p) => ({ ownerId: p.ownerId, name: p.name, team: p.team, userObjectId: p.userObjectId, away: p.away,
      windows: comingWindows(windowsOf(hours.get(p.ownerId)?.raw), nowMs) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function readHours(userObjectId: string): Promise<string | null> {
  const j = await hubspotFetchJson<UserRow>({ path: `/crm/v3/objects/users/${encodeURIComponent(userObjectId)}?properties=hs_out_of_office_hours` });
  return j.properties?.hs_out_of_office_hours ?? null;
}
async function writeHours(userObjectId: string, raw: string): Promise<void> {
  await hubspotFetchJson({ path: `/crm/v3/objects/users/${encodeURIComponent(userObjectId)}`, method: "PATCH", body: { properties: { hs_out_of_office_hours: raw } } });
}
async function log(row: LogRow): Promise<void> {
  const list = (await kvGet<LogRow[]>(LOG)) ?? [];
  await kvSet(LOG, [row, ...list].slice(0, 500));
}
export async function absenceLog(): Promise<LogRow[]> {
  return (await kvGet<LogRow[]>(LOG)) ?? [];
}

/** Add an absence for one person; their coming absences after it. */
export async function addAbsence(p: { ownerId: string; name: string; userObjectId: string }, from: string, to: string, title: string, by: string): Promise<AbsenceWindow[]> {
  const nowMs = Date.now();
  const w = newWindow(from, to, title, by, nowMs);
  if ("error" in w) throw new Error(w.error);
  const raw = await readHours(p.userObjectId);
  const clash = windowsOf(raw).find((x) => x.start <= w.end && w.start <= x.end);
  if (clash) throw new Error(`${p.name} is already away ${clash.from === clash.to ? `on ${clash.from}` : `from ${clash.from} to ${clash.to}`}${clash.title ? ` (${clash.title})` : ""}`);
  const next = withWindow(raw, w);
  await writeHours(p.userObjectId, next);
  await log({ at: new Date(nowMs).toISOString(), by, ownerId: p.ownerId, name: p.name, action: "add", from, to, title: w.title });
  return comingWindows(windowsOf(next), nowMs);
}

/** Take one absence away (a coming or current one only - the past stays as it was). */
export async function removeAbsence(p: { ownerId: string; name: string; userObjectId: string }, id: string, by: string): Promise<AbsenceWindow[]> {
  const nowMs = Date.now();
  const raw = await readHours(p.userObjectId);
  const w = windowsOf(raw).find((x) => x.id === id);
  if (!w) throw new Error("That absence is not there any more - changed in HubSpot since");
  if (w.end < nowMs) throw new Error("That absence is over - it stays as it was");
  const { raw: next, removed } = withoutWindow(raw, id);
  if (!removed) throw new Error("That absence is not there any more");
  await writeHours(p.userObjectId, next);
  await log({ at: new Date(nowMs).toISOString(), by, ownerId: p.ownerId, name: p.name, action: "remove", from: w.from, to: w.to, title: w.title });
  return comingWindows(windowsOf(next), nowMs);
}

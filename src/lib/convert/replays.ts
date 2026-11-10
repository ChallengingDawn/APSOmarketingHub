// APSOconvert > Journeys > Visits > THE VISIT REPLAY - the hub's side (SARCLA 10.11.2026: "the visit, played back - we
// see the screen which is good but don't see the mouse and behaviour on the shop"; "we still don't see any page
// movement"). The shop's gateway records, with statistics consent and only while switched on here, each page view's
// pointer, scroll and clicks (directup-gateway src/convert/replay.ts); a page view carries HubSpot's visitor cookie
// (hubspotutk) when HubSpot set one. A customer's page views are found by its contacts' cookies - HubSpot keeps each
// contact's as the property hubspotutk. Kept 30 days on the gateway.
//
//   GET /api/admin/convert/settings/replay -> {on, by, at};  PUT {on, by}
//   GET /api/admin/convert/replays?from&to&utk=a,b -> { rows }
//   GET /api/admin/convert/replays/:pv -> the page view with its moments

import { adminKey, gateway } from "@/lib/directup/gateway";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";

export type Moment = [number, 0 | 1 | 2, number, number];
export type ReplayRow = { pv: string; sid: string; utk: string | null; host: string; path: string; dev: "d" | "m"; w: number; vh: number; dh: number; started_at: string; ms: number; n: number };
export type ReplayFull = ReplayRow & { ev: Moment[] };
export type ReplaySwitch = { on: boolean; by: string | null; at: string | null };

const notThere = (e: unknown) => (e as { status?: number })?.status === 404 || /answered 404/.test(String((e as Error)?.message ?? ""));

/** The recording's switch on the gateway - null when the gateway cannot say (no key, an older gateway). */
export async function replaySwitch(): Promise<ReplaySwitch | null> {
  if (!adminKey()) return null;
  try { return await gateway<ReplaySwitch>("/convert/settings/replay", { timeoutMs: 10_000 }); }
  catch (e) { if (notThere(e)) return null; throw e; }
}
export async function setReplay(on: boolean, by: string): Promise<ReplaySwitch> {
  if (!adminKey()) throw new Error("DIRECTUP_ADMIN_KEY is not set on the hub - it cannot reach the shop's gateway.");
  return gateway<ReplaySwitch>("/convert/settings/replay", { method: "PUT", body: { on, by }, timeoutMs: 15_000 });
}

/** A company's contacts with HubSpot's visitor cookie (hubspotutk), 100 at most. */
export async function companyCookies(companyId: string, signal?: AbortSignal): Promise<{ id: string; name: string; utk: string }[]> {
  const a = await hubspotFetchJson<{ results?: { toObjectId: number | string }[] }>({ path: `/crm/v4/objects/companies/${companyId}/associations/contacts?limit=100`, signal });
  const ids = [...new Set((a.results ?? []).map((r) => String(r.toObjectId)))].slice(0, 100);
  if (!ids.length) return [];
  const b = await hubspotFetchJson<{ results?: { id: string; properties: Record<string, string | null> }[] }>({
    path: "/crm/v3/objects/contacts/batch/read", method: "POST", signal,
    body: { properties: ["hubspotutk", "firstname", "lastname", "email"], inputs: ids.map((id) => ({ id })) },
  });
  return (b.results ?? []).map((c) => ({
    id: c.id,
    name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ") || c.properties.email || `Contact ${c.id}`,
    utk: String(c.properties.hubspotutk ?? "").toLowerCase(),
  })).filter((c) => /^[a-f0-9]{32}$/.test(c.utk));
}

/** A customer's recorded page views in a period (the newest first), each with the contact it belongs to. */
export async function companyReplays(companyId: string, from: string, to: string, signal?: AbortSignal): Promise<{
  switch: ReplaySwitch | null; contacts: number; rows: (ReplayRow & { contact: string | null })[]; error: string | null;
}> {
  const sw = await replaySwitch().catch(() => null);
  if (!sw) return { switch: null, contacts: 0, rows: [], error: null };
  let cookies: { id: string; name: string; utk: string }[] = [];
  try { cookies = await companyCookies(companyId, signal); }
  catch (e) { return { switch: sw, contacts: 0, rows: [], error: `HubSpot did not give the contacts' cookies: ${(e as Error).message}`.slice(0, 240) }; }
  if (!cookies.length) return { switch: sw, contacts: 0, rows: [], error: null };
  const byUtk = new Map(cookies.map((c) => [c.utk, c.name]));
  const r = await gateway<{ rows: ReplayRow[] }>(`/convert/replays?from=${from}T00:00:00Z&to=${to}T23:59:59Z&utk=${cookies.map((c) => c.utk).join(",")}`, { timeoutMs: 15_000 });
  return { switch: sw, contacts: cookies.length, rows: (r.rows ?? []).map((x) => ({ ...x, contact: x.utk ? byUtk.get(x.utk) ?? null : null })), error: null };
}

/** One recorded page view with its moments. */
export async function replayOf(pv: string): Promise<ReplayFull | null> {
  if (!/^[a-f0-9]{16,40}$/.test(pv) || !adminKey()) return null;
  try { return await gateway<ReplayFull>(`/convert/replays/${pv}`, { timeoutMs: 15_000 }); }
  catch (e) { if (notThere(e)) return null; throw e; }
}

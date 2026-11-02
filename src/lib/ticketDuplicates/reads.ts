// DUPLICATES & MERGES - the HubSpot reads the live check (engine.ts) and the year build (year.ts) share, and the advisory
// lock they run under.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import type { DupInfo } from "./model";
import { coreText, type Cand, type Verdict } from "./types";

export const BO = "1726786777", BO_NEW = "2338266325";
export const hs = <T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
export type Raw = { id: string; properties: Record<string, string | null> };
export const PROPS = ["subject", "order_number", "hubspot_owner_id", "createdate", "hs_is_closed", "closed_date", "erosion_key", "hs_pipeline", "hs_conversations_originating_thread_id"];
export const toCand = (r: Raw): Cand => ({
  id: String(r.id), subject: r.properties.subject ?? "", orderNumber: r.properties.order_number ?? null, owner: r.properties.hubspot_owner_id ?? null,
  createdate: r.properties.createdate ?? null, closed: (r.properties.hs_is_closed ?? "").toLowerCase() === "true", closedAt: r.properties.closed_date ?? null,
  erosionKey: r.properties.erosion_key ?? null, pipeline: r.properties.hs_pipeline ?? null,
});
export const pause = () => new Promise((res) => setTimeout(res, 260)); // the search API allows about 4 a second
export async function search(filters: object[]): Promise<Raw[]> {
  const r = await hs<{ results?: Raw[] }>("/crm/v3/objects/tickets/search", "POST", { filterGroups: [{ filters }], properties: PROPS, sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: 100 });
  await pause();
  return r.results ?? [];
}
/** The first e-mail a ticket came with: the oldest message of its conversation, in words (types.ts coreText). */
export async function firstText(threadId: string | null | undefined): Promise<string> {
  if (!threadId) return "";
  const r = await hs<{ results?: { type?: string; text?: string; createdAt?: string; direction?: string }[] }>(`/conversations/v3/conversations/threads/${threadId}/messages?limit=50`);
  const m = (r.results ?? []).filter((x) => x.type === "MESSAGE" && x.text).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return coreText((m.find((x) => x.direction === "INCOMING") ?? m[0])?.text);
}

let archivedCache: { at: number; ids: Set<string> } | null = null;
export async function archivedOwners(): Promise<Set<string>> {
  if (archivedCache && Date.now() - archivedCache.at < 60 * 60_000) return archivedCache.ids;
  const ids = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const r = await hs<{ results?: { id: string }[]; paging?: { next?: { after?: string } } }>(`/crm/v3/owners?archived=true&limit=100${after ? `&after=${after}` : ""}`);
    for (const o of r.results ?? []) ids.add(String(o.id));
    after = r.paging?.next?.after;
    if (!after) break;
  }
  archivedCache = { at: Date.now(), ids };
  return ids;
}

/** The other tickets a verdict names, as the check saw them - for the lists. */
export function infoOf(v: Verdict, all: Map<string, Cand>): Record<string, DupInfo> {
  const ids = [...v.of.slice(0, 3), ...v.history.slice(0, 3), ...v.elsewhere.slice(0, 3)];
  return Object.fromEntries(ids.map((id) => all.get(id)).filter((c): c is Cand => !!c).map((c) => [c.id, { subject: c.subject.slice(0, 120), pipeline: c.pipeline, createdate: c.createdate, closed: c.closed, owner: c.owner }]));
}

/** One run under an advisory lock - the connection dropped (and the lock with it) when the time limit hits. */
export async function locked<T>(lock: number, work: () => Promise<T>, signal?: AbortSignal): Promise<T | null> {
  const client: PoolClient = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("ticket duplicates: time limit")); };
  if (signal?.aborted) drop(); else signal?.addEventListener("abort", drop, { once: true });
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [lock]);
    if (!got.rows[0]?.ok) return null;
    try { return await work(); }
    finally { if (!dropped) await client.query("SELECT pg_advisory_unlock($1)", [lock]).catch(() => {}); }
  } finally {
    signal?.removeEventListener("abort", drop);
    if (!dropped) client.release();
  }
}


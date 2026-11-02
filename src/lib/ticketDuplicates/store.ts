// DUPLICATES & MERGES - the stored rows: one kv entry a day (ticketDup:rows:<YYYY-MM-DD>), kept 400 days so the page
// can show the last 365 (SARCLA 02.11.2026: "we need the last 365 days"). A year is read in one query, and kept a
// minute in memory: the page asks for its window again and again while a person clicks through the tabs.

import { query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import type { Row } from "./model";
import { daysBetween } from "./period";

export { daysBetween, spanOk } from "./period";

export const DAYS_KEPT = 400;
export const dayKey = (d: string) => `ticketDup:rows:${d}`;
export const day = (iso: string) => iso.slice(0, 10);
export const rowsOfDay = async (d: string) => (await kvGet<Row[]>(dayKey(d))) ?? [];
export async function saveDay(d: string, rows: Row[]) {
  await kvSet(dayKey(d), rows);
  cache.clear();
}

const cache = new Map<string, { at: number; rows: Row[] }>();
/** The rows of the days from `from` to `to`, newest first - one query. */
export async function rowsBetween(from: string, to: string): Promise<Row[]> {
  const k = `${from}|${to}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < 60_000) return hit.rows;
  const keys = daysBetween(from, to).map(dayKey);
  const r = await query<{ v: Row[] | string }>("SELECT v FROM apsomh_kv WHERE k = ANY($1)", [keys]);
  const rows = r.rows.flatMap((x) => (typeof x.v === "string" ? (JSON.parse(x.v) as Row[]) : x.v) ?? []).sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
  if (cache.size > 20) cache.clear();
  cache.set(k, { at: Date.now(), rows });
  return rows;
}

/** The day that leaves the 400 days. */
export const dropOldest = () => kvSet(dayKey(new Date(Date.now() - DAYS_KEPT * 86400_000).toISOString().slice(0, 10)), null);

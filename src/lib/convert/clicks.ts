// APSOconvert > the CLICK MAP - the hub's side (Journeys > Click map; the Preview's "Clicks"). The shop's gateway counts
// (directup-gateway src/convert/clicks.ts): a person switches the map on for a page here, for 30 days; on that page only,
// and only with the visitor's statistics consent, the shop's head.js counts which element is clicked and where inside it.
// The hub reads the counts back and the Preview draws them over the page.
//
// A gateway without the version that counts (before 09.11.2026 22:20) answers 404 on these paths: that is
// said as it is ("not on the shop's gateway yet"), never as zero clicks.
//
//   GET    /api/admin/convert/clickmaps          -> { maps }
//   PUT    /api/admin/convert/clickmaps/:id      {host, paths, until?, by?} -> the map
//   DELETE /api/admin/convert/clickmaps/:id      -> { ok } (its counts stay)
//   GET    /api/admin/convert/clicks?host&path&from&to -> { rows: {s,x,y,dev,n}[], total }
//   GET    /api/admin/convert/clicks/pages?from&to   -> { pages: {host,path,n,d,m,days}[] }

import { adminKey, gateway } from "@/lib/directup/gateway";
import { HOST } from "./contract";
import type { Env } from "./model";
import { CLICKMAP, dayRange, everyPage, heatOf, mapIdFor, mapOn, untilDay, type ClickMap, type ClickRow, type Dev, type Heat } from "./clickRules";
export { everyPage, mapOn, type ClickMap };
import { swissNow } from "./scanRules";

/** What the gateway can say about click maps: counting there, not there yet, or not reachable (and why). */
export type ClickState = { deployed: boolean; error: string | null };

const NO_KEY = "DIRECTUP_ADMIN_KEY is not set on the hub - it cannot read the shop's gateway.";
export const NOT_YET = "The shop's gateway does not count clicks yet - it counts once its new version is deployed.";
const notThere = (e: unknown) => (e as { status?: number })?.status === 404 || /answered 404/.test(String((e as Error)?.message ?? ""));

/** A counted page's clicks over the period: all, desktop, phone, on how many days. */
export type PageTotal = { host: string; path: string; n: number; d: number; m: number; days: number };

/** Every counted page's clicks over the last `days` (one read), or none when the gateway cannot say. */
export async function pageTotals(days: number = CLICKMAP.days): Promise<{ from: string; to: string; pages: PageTotal[] }> {
  const { from, to } = dayRange(swissNow().day, days);
  try {
    const r = await gateway<{ pages: PageTotal[] }>(`/convert/clicks/pages?from=${from}&to=${to}`, { timeoutMs: 12_000 });
    return { from, to, pages: Array.isArray(r?.pages) ? r.pages : [] };
  } catch {
    return { from, to, pages: [] };
  }
}

/** Every click map the gateway holds, or why not. */
export async function clickMaps(): Promise<ClickState & { maps: ClickMap[] }> {
  if (!adminKey()) return { deployed: false, error: NO_KEY, maps: [] };
  try {
    const r = await gateway<{ maps: ClickMap[] }>("/convert/clickmaps", { timeoutMs: 12_000 });
    return { deployed: true, error: null, maps: Array.isArray(r?.maps) ? r.maps : [] };
  } catch (e) {
    if (notThere(e)) return { deployed: false, error: null, maps: [] };
    return { deployed: false, error: (e as Error).message, maps: [] };
  }
}

/** ADD-TO-CARTS BY WHERE (SARCLA 10.11.2026: "count also the search bar interaction since maybe they don't go to the
 *  product any more and put in the cart via the search or the chat"): what the shop's gateway counted - the search bar,
 *  the chat, the pages' own cart buttons - in all and by day. null = the gateway cannot say (not deployed, no key). */
export type CartsFrom = { from: string; to: string; search: number; chat: number; page: number; days: { day: string; search: number; chat: number; page: number }[]; pages: { path: string; src: "s" | "c" | "p"; n: number }[] };
export async function cartsFrom(env: Env, days = 28): Promise<CartsFrom | null> {
  if (!adminKey()) return null;
  const { from, to } = dayRange(swissNow().day, days);
  try {
    const r = await gateway<{ totals: { src: string; n: number }[]; days: { day: string; src: string; n: number }[]; pages: { host: string; path: string; src: string; n: number }[] }>(
      `/convert/actions?from=${from}&to=${to}&host=${encodeURIComponent(HOST[env])}`, { timeoutMs: 12_000 });
    const sum = (src: string) => (r?.totals ?? []).filter((t) => t.src === src).reduce((a, t) => a + Number(t.n || 0), 0);
    const byDay = new Map<string, { day: string; search: number; chat: number; page: number }>();
    for (const d of r?.days ?? []) {
      const row = byDay.get(d.day) ?? { day: d.day, search: 0, chat: 0, page: 0 };
      if (d.src === "s") row.search += Number(d.n || 0); else if (d.src === "c") row.chat += Number(d.n || 0); else row.page += Number(d.n || 0);
      byDay.set(d.day, row);
    }
    return {
      from, to, search: sum("s"), chat: sum("c"), page: sum("p"), days: [...byDay.values()],
      pages: (r?.pages ?? []).filter((x) => x.src === "s" || x.src === "c" || x.src === "p").map((x) => ({ path: x.path, src: x.src as "s" | "c" | "p", n: Number(x.n || 0) })),
    };
  } catch {
    return null;
  }
}

export type PageClicks = ClickState & { map: ClickMap | null; heat: Heat | null; from: string; to: string };

/** One page's clicks over the last `days`, made into heat (desktop, phone or both). */
export async function clicksOf(env: Env, path: string, days: number = CLICKMAP.days, dev: Dev = "all"): Promise<PageClicks> {
  const { from, to } = dayRange(swissNow().day, days);
  const st = await clickMaps();
  if (!st.deployed) return { deployed: st.deployed, error: st.error, map: null, heat: null, from, to };
  const map = mapOn(st.maps, env, path, swissNow().day);
  try {
    const q = `host=${encodeURIComponent(HOST[env])}&path=${encodeURIComponent(path)}&from=${from}&to=${to}`;
    const r = await gateway<{ rows: ClickRow[]; total: number }>(`/convert/clicks?${q}`, { timeoutMs: 15_000 });
    return { deployed: true, error: null, map, heat: heatOf(Array.isArray(r?.rows) ? r.rows : [], dev), from, to };
  } catch (e) {
    return { deployed: true, error: (e as Error).message, map, heat: null, from, to };
  }
}

/** Count clicks on a page from today for 30 days (or stop): one map per page, the gateway's 20 at most. */
export async function switchClicks(env: Env, path: string, on: boolean, by: string): Promise<ClickMap | null> {
  if (!adminKey()) throw new Error(NO_KEY);
  const id = mapIdFor(HOST[env], path);
  try {
    if (!on) {
      await gateway(`/convert/clickmaps/${id}`, { method: "DELETE", timeoutMs: 15_000 });
      return null;
    }
    const until = untilDay(swissNow().day);
    return await gateway<ClickMap>(`/convert/clickmaps/${id}`, { method: "PUT", body: { host: HOST[env], paths: [path], until, by }, timeoutMs: 15_000 });
  } catch (e) {
    if (notThere(e)) throw new Error(NOT_YET);
    throw e;
  }
}

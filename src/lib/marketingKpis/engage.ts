// ENGAGE - the read (the rules are in engageCube.ts). GA4: engagement per month (exact, and per month x
// country x channel), the article views and the most viewed articles, the tools' and the site
// search's events; the search bar's own log through its gateway (searches, those that found
// nothing); the price checks from the live shop tracker (the Datatracker's rule). A year per GA4
// call (the hub asks GA4 for 365 days at most). About a minute; read every 6 hours.

import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { fetchShopSignals } from "@/lib/integrations/shopSignals";
import { gateway, type Gaps, type Report } from "@/lib/searchbar/gateway";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import type { EngageData } from "./engageCube";

const KEY = "marketingKpis:engage:v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 30 * 60 * 1000;
/** the live shop tracker writes the company's days since then - the price checks start there */
const TRACKER_SINCE = "2026-09-30";

export function engageData(): Promise<SlowState<EngageData>> {
  return slowReport(KEY, (v: EngageData) => (Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS : TTL_MS), build);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (k: string) => (/^\d{6}$/.test(k) ? `${k.slice(0, 4)}-${k.slice(4, 6)}` : k.slice(0, 7));
const countryOf = (k: string | undefined) => { const c = (k ?? "").toUpperCase(); return c === "(NOT SET)" ? "" : c; };

async function build(): Promise<EngageData> {
  const now = new Date();
  const year = now.getUTCFullYear(), py = year - 1;
  const monthsDone = now.getUTCMonth();
  const errors: Record<string, string> = {};
  const guard = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { errors[name] = String((e as Error)?.message ?? e).slice(0, 300); }
  };
  const ranges: [string, string][] = [[`${py}-01-01`, `${py}-12-31`], [`${year}-01-01`, iso(now)]];

  const months: EngageData["months"] = {};
  await guard("months", async () => {
    reportProgress(KEY, "reading GA4 engagement per month");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "engageMonthly", from, to });
      for (const row of r.rows) months[monthKey(row.keys[0] ?? "")] = [row.values[0] ?? 0, row.values[1] ?? 0, row.values[2] ?? 0, row.values[3] ?? 0];
    }
  });

  const channels: string[] = [];
  const cube: EngageData["cube"] = [];
  await guard("cube", async () => {
    reportProgress(KEY, "reading GA4 engagement by country and channel");
    const idx = (c: string) => { let i = channels.indexOf(c); if (i < 0) { i = channels.length; channels.push(c); } return i; };
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "engageCube", from, to });
      for (const row of r.rows) cube.push([monthKey(row.keys[0] ?? ""), countryOf(row.keys[1]), idx(row.keys[2] || "(not set)"), row.values[0] ?? 0, row.values[1] ?? 0, row.values[2] ?? 0, row.values[3] ?? 0]);
    }
  });

  const views: EngageData["views"] = {};
  const topItems: EngageData["topItems"] = [];
  await guard("views", async () => {
    reportProgress(KEY, "reading GA4 article views");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "viewItemMonthly", from, to });
      for (const row of r.rows) views[monthKey(row.keys[0] ?? "")] = [row.values[0] ?? 0, row.values[1] ?? 0];
    }
    if (monthsDone) {
      const r = await fetchGa4Report({ name: "topItemsViewed", from: `${year}-01-01`, to: iso(new Date(Date.UTC(year, monthsDone, 0))) });
      for (const row of r.rows) topItems.push({ name: row.keys[0] || "(no name)", id: row.keys[1] || "", views: row.values[0] ?? 0 });
    }
  });

  const events: EngageData["events"] = {};
  await guard("events", async () => {
    reportProgress(KEY, "reading GA4 tool and search events");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "engageEvents", from, to });
      for (const row of r.rows) (events[monthKey(row.keys[0] ?? "")] ??= {})[row.keys[1] ?? ""] = [row.values[0] ?? 0, row.values[1] ?? 0];
    }
  });

  // the search bar's own log: every search, consent or not - and whether it found something
  let search: EngageData["search"] = null;
  await guard("search", async () => {
    reportProgress(KEY, "reading the search bar's log");
    const r = await gateway<Report>("/api/smart-bar/report?days=365", { timeoutMs: 60_000 });
    // the gateway also answers the raw text and every language of a gap
    type GapRow = Gaps["gaps"][number] & { top_query_raw?: string; locales?: string[] };
    const g = await gateway<{ gaps: GapRow[] }>("/api/smart-bar/gaps?window=30d", { timeoutMs: 60_000 }).catch(() => null);
    const byMonth: Record<string, [number, number]> = {};
    for (const x of r.by_day ?? []) { const m = String(x.day).slice(0, 7); const a = (byMonth[m] ??= [0, 0]); a[0] += x.searches ?? 0; a[1] += x.ok ?? 0; }
    search = {
      days: r.days, since: r.by_day?.[0]?.day ? String(r.by_day[0].day).slice(0, 10) : null, total: r.settled_searches ?? 0, zero: r.zero_result_searches ?? 0, byMonth,
      byLocale: (r.by_locale ?? []).map((x) => ({ locale: x.locale, searches: x.searches, ok: x.ok })),
      top: (r.keywords_top ?? []).slice(0, 60).map((x) => ({ query: x.query, searches: x.searches, found: Math.round((x.searches * (x.success_pct ?? 0)) / 100) })),
      // a pasted e-mail signature can land in the bar: the text is cut short
      gaps: (g?.gaps ?? []).slice(0, 40).map((x) => ({ query: String(x.top_query_raw || x.query_norm).replace(/\s+/g, " ").trim().slice(0, 90), count: x.count, last: String(x.last_seen).slice(0, 10), locales: x.locales ?? (x.locale ? [x.locale] : []) })),
    };
  });

  // price checks: the Datatracker's rule on the live tracker's lines, since it started
  let prices: EngageData["prices"] = null;
  await guard("prices", async () => {
    reportProgress(KEY, "reading the price checks");
    const yesterday = iso(new Date(now.getTime() - 86_400_000));
    const s = await fetchShopSignals({ from: TRACKER_SINCE, to: yesterday, today: iso(now) });
    const byDay: Record<string, [number, number]> = {};
    const byTeam: Record<string, number> = {};
    const companies = new Set<string>();
    for (const r of s.priceChecks) {
      if (!r.qualifies || r.excluded) continue;
      const a = (byDay[r.day] ??= [0, 0]);
      a[0]++; if (r.ticketId) a[1]++;
      byTeam[r.team ?? "No team"] = (byTeam[r.team ?? "No team"] ?? 0) + 1;
      companies.add(r.companyId);
    }
    prices = { since: TRACKER_SINCE, byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, [q, t]]) => [day, q, t]), byTeam, companies: companies.size };
  });

  return { generatedAt: new Date().toISOString(), year, monthsDone, months, channels, cube, views, topItems, events, search, prices, errors };
}

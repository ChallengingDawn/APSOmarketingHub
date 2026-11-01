// PRODUCTS REPORTS > SEARCH - the read (the rules are in siteSearch.ts). The search bar's own answers through its gateway, as
// the Search bar page and Engage read them (src/lib/searchbar/gateway.ts - the gateway's admin key, server to server; a
// sandbox goes through its door): the report for the window (the gateway keeps each window ten minutes), the texts it passed
// to its AI over the last 7 or 30 days (it keeps no longer window of them), and the last searches one by one (up to 5,000
// lines of the last 7 days - a day or two) for the words still being typed. Kept here a quarter of an hour per window: the
// page's tabs and filters never ask the gateway again.

import { gateway, type Gaps, type LogRow, type Report } from "@/lib/searchbar/gateway";
import { gapsOf, monthsOfDays, termsOf, typingSample, PERIODS, type PeriodId, type SearchData } from "./siteSearch";

const KEEP_MS = 15 * 60 * 1000;
const kept = new Map<PeriodId, { at: number; data: SearchData }>();

type GapLine = Gaps["gaps"][number] & { top_query_raw?: string; locales?: string[] };

export async function siteSearchData(period: PeriodId): Promise<SearchData> {
  const hit = kept.get(period);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.data;
  const errors: Record<string, string> = {};
  const guard = async <T,>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try { return await fn(); } catch (e) { errors[name] = String((e as Error)?.message ?? e).slice(0, 300); return null; }
  };
  const p = PERIODS.find((x) => x.id === period)!;
  const gapWindow = p.days === 7 ? "7d" : "30d";
  const [r, g, log] = await Promise.all([
    guard("report", () => gateway<Report>(`/api/smart-bar/report?days=${p.days ?? "all"}`, { timeoutMs: 60_000 })),
    guard("gaps", () => gateway<{ gaps: GapLine[] }>(`/api/smart-bar/gaps?window=${gapWindow}&limit=300`, { timeoutMs: 60_000 })),
    guard("sample", () => gateway<LogRow[]>("/api/smart-bar/logs?window=7d&limit=5000", { timeoutMs: 60_000 })),
  ]);
  const terms = r ? termsOf(r.keywords_top ?? []) : { rows: [], hidden: 0 };
  const gaps = g ? gapsOf(g.gaps ?? []) : null;
  const data: SearchData = {
    period, days: r?.days ?? p.days ?? 0, generatedAt: r?.generated_at ?? new Date().toISOString(),
    since: r?.by_day?.[0]?.day ? String(r.by_day[0].day).slice(0, 10) : null,
    window: r ? {
      logged: r.logged_events ?? 0, settled: r.settled_searches ?? 0, ok: (r.settled_searches ?? 0) - (r.zero_result_searches ?? 0),
      terms: r.keywords_all_count ?? 0, aiFallback: r.ai_fallback_searches ?? 0, aiChats: r.ai_conversations ?? null,
      byStore: (r.by_locale ?? []).map((x) => ({ locale: x.locale, searches: x.searches, ok: x.ok })),
      byMonth: monthsOfDays(r.by_day ?? []),
    } : null,
    terms: terms.rows, termsHidden: terms.hidden,
    gaps: gaps ? { window: gapWindow, rows: gaps.rows, hidden: gaps.hidden } : null,
    sample: Array.isArray(log) ? typingSample(log.map((l) => ({ text: l.query_raw ?? "", norm: l.query_norm ?? "", locale: l.locale ?? "", tier: l.tier ?? "", hits: l.hit_count ?? null, at: String(l.created_at ?? "") }))) : null,
    errors,
  };
  // a read the gateway refused is not kept: the next visit asks again
  if (!errors.report) kept.set(period, { at: Date.now(), data });
  return data;
}

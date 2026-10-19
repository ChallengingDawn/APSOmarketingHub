// ENGAGE - the pure part (SARCLA 19.10: "let's tackle Engage next"). Read by engage.ts into:
//   months     GA4's sessions, engaged sessions, engagement seconds and users per month, exact
//   cube       the same per month x country x channel - the page's country and channel filters
//   views      the article views (GA4's view_item) per month: views, the visitors who viewed
//   topItems   the most viewed articles this year so far (whole months)
//   events     the tools' and the site search's GA4 events per month
//   search     the search bar's own log (its gateway): searches per month, those that found nothing
//   prices     price checks from the live shop tracker (since 30 Sep 2026): customers who priced
//              3+ KT/DT articles and did not order (the Datatracker's rule)
// GA4 counts visitors who accepted statistics cookies only: every GA4 figure is a floor.

import { countryName } from "./countries";

/** The GA4 events of the Tools tab, in plain words. */
export const TOOLS: { event: string; label: string; what: string }[] = [
  { event: "directup_form_submit_manualupload", label: "DirectUp - drawing uploaded", what: "A drawing or file uploaded in DirectUp to get a part made" },
  { event: "directup_form_submit", label: "DirectUp - request sent", what: "A DirectUp request sent to us" },
  { event: "oring_expert_add_to_cart", label: "O-ring Expert - to the cart", what: "An O-ring chosen in the O-ring Expert put in the cart" },
];
export const SEARCH_EVENTS = { searches: "view_search_results", clicks: "search_results_click" } as const;

export type EngageData = {
  generatedAt: string;
  year: number;
  /** whole months this year */
  monthsDone: number;
  /** "YYYY-MM" -> [sessions, engaged sessions, engagement seconds, users] */
  months: Record<string, [number, number, number, number]>;
  channels: string[];
  /** [month, country (two letters, "" unknown), channel index, sessions, engaged, seconds, users] */
  cube: [string, string, number, number, number, number, number][];
  /** "YYYY-MM" -> [article views, visitors who viewed one] */
  views: Record<string, [number, number]>;
  topItems: { name: string; id: string; views: number }[];
  /** "YYYY-MM" -> event -> [count, users] */
  events: Record<string, Record<string, [number, number]>>;
  search: {
    days: number;
    /** the log's first day (it started on 5 Jul 2026) */
    since: string | null;
    /** searches settled in the window, and those that found nothing */
    total: number; zero: number;
    /** "YYYY-MM" -> [searches, found something] */
    byMonth: Record<string, [number, number]>;
    byLocale: { locale: string; searches: number; ok: number }[];
    top: { query: string; searches: number; found: number }[];
    /** the searches that found nothing, the last 30 days - the words to add to the search bar */
    gaps: { query: string; count: number; last: string; locales: string[] }[];
  } | null;
  prices: {
    since: string;
    /** [day, price checks that qualify, of them with a ticket] */
    byDay: [string, number, number][];
    byTeam: Record<string, number>;
    companies: number;
  } | null;
  errors: Record<string, string>;
};

export type EngageFilters = { country?: string[]; channel?: string[] };
type Monthly = { months: (number | null)[]; py: (number | null)[] };
const ym = (y: number, i: number) => `${y}-${String(i + 1).padStart(2, "0")}`;
const empty = (): Monthly => ({ months: Array(12).fill(null), py: Array(12).fill(null) });

type SeriesId = "E02" | "E01" | "E03" | "E05Z" | "E02N" | "E02D" | "E01N" | "E03S" | "E03U" | "E04" | "E04U" | "E05" | "E05N" | "E06";
/**
 * The page's monthly KPIs, this year and last: engaged sessions and sessions (E02 and E01 are their
 * ratios), engagement seconds and users (E03 = seconds per user), article views (E04), smart-bar
 * searches and those that found nothing (E05, E05Z), the tools' events (E06). Unfiltered from GA4's
 * exact months; with a country or channel chosen from the cube (a visitor reaching us through two
 * channels in a month then counts twice in the users).
 */
export function engageSeries(d: EngageData, year: number, f: EngageFilters = {}): Record<SeriesId, Monthly> {
  const out = Object.fromEntries((["E02", "E01", "E03", "E05Z", "E02N", "E02D", "E01N", "E03S", "E03U", "E04", "E04U", "E05", "E05N", "E06"] as SeriesId[]).map((k) => [k, empty()])) as Record<SeriesId, Monthly>;
  const pickC = f.country?.length ? new Set(f.country.map((c) => c.toUpperCase())) : null;
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const filtered = !!(pickC || pickH);
  const agg: Record<string, [number, number, number, number]> = {};
  if (filtered) {
    for (const [m, c, h, s, e, sec, u] of d.cube) {
      if ((pickC && !pickC.has(c)) || (pickH && !pickH.has(d.channels[h]))) continue;
      const a = (agg[m] ??= [0, 0, 0, 0]);
      a[0] += s; a[1] += e; a[2] += sec; a[3] += u;
    }
  }
  for (const [side, y] of [["months", year], ["py", year - 1]] as const) {
    for (let i = 0; i < 12; i++) {
      const m = ym(y, i);
      const g = filtered ? agg[m] : d.months[m];
      if (g) {
        out.E02D[side][i] = g[0]; out.E02N[side][i] = g[1]; out.E01N[side][i] = g[0] - g[1];
        out.E03S[side][i] = g[2]; out.E03U[side][i] = g[3];
        // the ratios month by month too - the cards draw a ratio's own months (the year adds up the parts)
        out.E02[side][i] = g[0] ? g[1] / g[0] : null; out.E01[side][i] = g[0] ? (g[0] - g[1]) / g[0] : null;
        out.E03[side][i] = g[3] ? g[2] / g[3] : null;
      }
      const v = d.views[m];
      if (v) { out.E04[side][i] = v[0]; out.E04U[side][i] = v[1]; }
      const s = d.search?.byMonth[m];
      if (s) { out.E05[side][i] = s[0]; out.E05N[side][i] = s[0] - s[1]; out.E05Z[side][i] = s[0] ? (s[0] - s[1]) / s[0] : null; }
      const ev = d.events[m];
      if (ev) out.E06[side][i] = TOOLS.reduce((a, t) => a + (ev[t.event]?.[0] ?? 0), 0);
    }
  }
  return out;
}

/** The year-so-far KPI: price checks that qualify since the live tracker started (E07). */
export function engageYtd(d: EngageData): Record<"E07", { cy: number | null; py: number | null; pyNote?: string }> {
  const n = d.prices ? d.prices.byDay.reduce((a, [, q]) => a + q, 0) : null;
  return { E07: { cy: n, py: null, pyNote: d.prices ? `since ${d.prices.since} - the live shop tracker started then` : undefined } };
}

export type EngageRow = { key: string; label: string; sessions: number; engaged: number; seconds: number; users: number; pySessions: number; pyEngaged: number; pySeconds: number; pyUsers: number };
/** Engagement by channel or by country over the months chosen, against the same months a year earlier. */
export function engageTable(d: EngageData, year: number, months: number[], by: "channel" | "country", f: EngageFilters = {}): EngageRow[] {
  const cy = new Set(months.map((i) => ym(year, i))), py = new Set(months.map((i) => ym(year - 1, i)));
  const pickC = f.country?.length ? new Set(f.country.map((c) => c.toUpperCase())) : null;
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const rows: Record<string, EngageRow> = {};
  for (const [m, c, h, s, e, sec, u] of d.cube) {
    const isCy = cy.has(m);
    if (!isCy && !py.has(m)) continue;
    // the table's own dimension is not filtered: the chosen rows stand out instead
    if (by === "channel" && pickC && !pickC.has(c)) continue;
    if (by === "country" && pickH && !pickH.has(d.channels[h])) continue;
    const key = by === "channel" ? d.channels[h] : c || "ZZ";
    const r = (rows[key] ??= { key, label: by === "channel" ? key : countryName(key), sessions: 0, engaged: 0, seconds: 0, users: 0, pySessions: 0, pyEngaged: 0, pySeconds: 0, pyUsers: 0 });
    if (isCy) { r.sessions += s; r.engaged += e; r.seconds += sec; r.users += u; } else { r.pySessions += s; r.pyEngaged += e; r.pySeconds += sec; r.pyUsers += u; }
  }
  return Object.values(rows).filter((r) => r.sessions || r.pySessions).sort((a, b) => b.sessions - a.sessions);
}

/** The tools' events over the months chosen and the same months a year earlier. */
export function toolTotals(d: EngageData, year: number, months: number[]): { event: string; label: string; what: string; count: number; users: number; pyCount: number }[] {
  return TOOLS.map((t) => {
    let count = 0, users = 0, pyCount = 0;
    for (const i of months) {
      const cy = d.events[ym(year, i)]?.[t.event], p = d.events[ym(year - 1, i)]?.[t.event];
      count += cy?.[0] ?? 0; users += cy?.[1] ?? 0; pyCount += p?.[0] ?? 0;
    }
    return { ...t, count, users, pyCount };
  });
}

/** The site search as GA4 sees it: searches, a result clicked, over the months chosen and a year earlier. */
export function siteSearchGa4(d: EngageData, year: number, months: number[]): { searches: number; clicks: number; pySearches: number; pyClicks: number; searchers: number } {
  const t = { searches: 0, clicks: 0, pySearches: 0, pyClicks: 0, searchers: 0 };
  for (const i of months) {
    const cy = d.events[ym(year, i)], p = d.events[ym(year - 1, i)];
    t.searches += cy?.[SEARCH_EVENTS.searches]?.[0] ?? 0; t.searchers += cy?.[SEARCH_EVENTS.searches]?.[1] ?? 0; t.clicks += cy?.[SEARCH_EVENTS.clicks]?.[0] ?? 0;
    t.pySearches += p?.[SEARCH_EVENTS.searches]?.[0] ?? 0; t.pyClicks += p?.[SEARCH_EVENTS.clicks]?.[0] ?? 0;
  }
  return t;
}

/** "4 min 05 s" - engagement time. */
export const minSec = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${Math.floor(v / 60)} min ${String(Math.round(v % 60)).padStart(2, "0")} s`);

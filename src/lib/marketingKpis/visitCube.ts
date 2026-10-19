// VISIT & TRAFFIC ORIGIN - the pure part (SARCLA 18.10: "let's tackle the Visit page by building
// what's missing ... put the page like the others"). GA4 read by visit.ts into:
//   users      exact users, new users and sessions per month (V01, V02)
//   cube       sessions, users and new users per month x country x channel - the page's
//              period, country and channel filters, and the traffic origin and country tables
//   landing    sessions per landing page x channel, the year so far and the same months last
//              year - the store (the page address's first part, /de-CH) and landing page tables
//   countryUsers  exact users, new users and sessions per month x country (V04 by country)
//   logins     visitors who logged in to the shop per month x country - GA4's login event (V06G/V06S)
//   prio       companies that logged in to the shop, per sales priority (Datatracker, V06/V07)
//   unlinked   shop accounts with no company in HubSpot - their logins and orders count for nobody
// GA4 counts visitors who accepted statistics cookies only: every figure is a floor.
// GA4's "(not set)" landing page is a visit without a page view: a shop tab left open on a
// computer, active again after 30 minutes - GA4 starts a new visit, no page loads (checked
// 18.10.2026: 15% of the visits, 99% desktop, no page views, no orders, ~5,000 a month both years).
// They count as visits, but they are not a store or a page: the store and page figures leave them out.

import { countryName } from "./countries";
import type { Unlinked } from "../ticketAssoc/shopAccountRules";

/** GA4's default channel groups in plain words (SARCLA 18.10: "be more descriptive"). */
export const CHANNEL_INFO: Record<string, string> = {
  "Direct": "The address typed in, a bookmark, or a link GA4 cannot trace (apps, some emails, documents)",
  "Organic Search": "Unpaid results of Google, Bing and other search engines (SEO)",
  "Paid Search": "Search ads - Google Ads and Microsoft Ads search campaigns (SEA)",
  "Referral": "Links on other websites - partners, directories, suppliers' pages",
  "Cross-network": "Google Performance Max - one campaign across Search, Shopping, YouTube, Display and Gmail",
  "Unassigned": "Visits GA4 cannot put in any channel - usually campaign tags that were lost or misspelt",
  "Email": "Links in newsletters and e-mails that carry an e-mail tag",
  "AI Assistant": "Links in answers of ChatGPT, Gemini, Perplexity, Copilot and other AI assistants (GEO)",
  "Paid Other": "Paid visits GA4 cannot place - other ad networks, unusual campaign tags",
  "Organic Social": "Unpaid posts on LinkedIn, Facebook, Instagram, YouTube and other networks",
  "Organic Shopping": "Free product listings, e.g. Google Shopping's unpaid results",
  "Paid Social": "Ads on social networks",
  "Organic Video": "Unpaid video platforms, e.g. YouTube without an ad",
  "Paid Video": "Video ads",
  "Display": "Banner ads",
  "Paid Shopping": "Shopping ads outside Performance Max",
  "Affiliates": "Affiliate partners",
  "SMS": "Links in text messages",
  "Mobile Push Notifications": "Push messages on phones",
  "Audio": "Audio ads",
};

/** "de-CH" -> "German · Switzerland", "en-INT" -> "English · International"; null for an address that is not a store. */
export function storeName(code: string): string | null {
  const m = /^([a-z]{2})-([A-Z]{2}|INT)$/i.exec(code);
  if (!m) return null;
  let lang = m[1].toLowerCase();
  try { lang = new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang; } catch { /* the code stands */ }
  const region = m[2].toUpperCase() === "INT" ? "International" : countryName(m[2]);
  return `${lang} · ${region}`;
}

/** The store a landing page is on: "/de-CH/o-rings" -> "de-CH"; "(not set)" and the rest are not a store. */
export function storeOf(page: string): string | null {
  const m = /^\/([a-z]{2}-(?:[a-z]{2}|int))(?:\/|$)/i.exec(page);
  return m ? `${m[1].slice(0, 2).toLowerCase()}-${m[1].slice(3).toUpperCase()}` : null;
}

/** What GA4's "(not set)" landing page is, in plain words. */
export const NO_PAGE = "Shop tab left open - no page loaded";
export const NO_PAGE_INFO = "A shop tab left open on a computer that became active again after 30 minutes: GA4 starts a new visit, but no page loads, so there is no landing page. Almost all on desktop, no orders.";

export type { Unlinked, UnlinkedRow } from "../ticketAssoc/shopAccountRules";

export type VisitData = {
  generatedAt: string;
  year: number;
  /** whole months this year */
  monthsDone: number;
  /** "YYYY-MM" -> [users, new users, sessions], exact per month */
  users: Record<string, [number, number, number]>;
  /** the channels' names; cube rows refer to them by index */
  channels: string[];
  /** [month "YYYY-MM", country (two letters, "" unknown), channel index, sessions, users, new users] */
  cube: [string, string, number, number, number, number][];
  /** landing pages: this year so far (whole months) and the same months last year */
  landing: { months: number; cy: [string, string, number, number][]; py: [string, string, number, number][] };
  /** [month, country, users, new users, sessions], exact per month and country */
  countryUsers: [string, string, number, number, number][];
  /** [month, country, visitors who logged in] - GA4's login event */
  logins: [string, string, number][];
  /** companies by sales priority: all, logged in this year, logged in last year */
  prio: { band: string; all: number | null; cy: number | null; py: number | null }[];
  unlinked: Unlinked | null;
  /** Prio 1 and 2 companies that logged in per day: [day, Prio 1 companies, their logins, Prio 2 companies, their logins] - the live shop tracker */
  liveLogins: { days: [string, number, number, number, number][] } | null;
  errors: Record<string, string>;
};

export type VisitFilters = { country?: string[]; channel?: string[] };
type Monthly = { months: (number | null)[]; py: (number | null)[] };

const ym = (y: number, i: number) => `${y}-${String(i + 1).padStart(2, "0")}`;

type SeriesId = "V01" | "V02N" | "V02" | "V03" | "V04" | "V06G" | "V06U" | "V06S";

/**
 * The page's monthly KPIs, this year and last: users (V01), new users (V02N) and their share
 * (V02), sessions (V03), users outside Switzerland (V04), the visitors who logged in (V06G) and
 * their share of the visitors (V06S over V06U). Unfiltered, users are GA4's exact monthly users;
 * with countries chosen, GA4's exact users per month and country; with a channel chosen they come
 * from the cube, where a visitor arriving through two channels in a month counts twice. GA4's
 * login event has no channel: the known visitors follow the countries only.
 */
export function visitSeries(d: VisitData, year: number, f: VisitFilters = {}): Record<SeriesId, Monthly> {
  const empty = (): Monthly => ({ months: Array(12).fill(null), py: Array(12).fill(null) });
  const out: Record<SeriesId, Monthly> = { V01: empty(), V02N: empty(), V02: empty(), V03: empty(), V04: empty(), V06G: empty(), V06U: empty(), V06S: empty() };
  const pickC = f.country?.length ? new Set(f.country.map((c) => c.toUpperCase())) : null;
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  // sessions, users, new users, users outside Switzerland - per month
  const fromCube: Record<string, [number, number, number, number]> = {};
  for (const [m, c, h, s, u, n] of d.cube) {
    if (pickC && !pickC.has(c)) continue;
    if (pickH && !pickH.has(d.channels[h])) continue;
    const a = (fromCube[m] ??= [0, 0, 0, 0]);
    a[0] += s; a[1] += u; a[2] += n;
    if (c !== "CH") a[3] += u;
  }
  const byCountry: Record<string, [number, number, number, number]> = {};
  for (const [m, c, u, n, s] of d.countryUsers ?? []) {
    if (pickC && !pickC.has(c)) continue;
    const a = (byCountry[m] ??= [0, 0, 0, 0]);
    a[0] += s; a[1] += u; a[2] += n;
    if (c !== "CH") a[3] += u;
  }
  const known: Record<string, number> = {};
  for (const [m, c, u] of d.logins ?? []) if (!pickC || pickC.has(c)) known[m] = (known[m] ?? 0) + u;
  const hasLogins = (d.logins?.length ?? 0) > 0;
  for (const [side, y] of [["months", year], ["py", year - 1]] as const) {
    for (let i = 0; i < 12; i++) {
      const m = ym(y, i);
      const exact = d.users[m];
      if (!exact && !fromCube[m] && !byCountry[m]) continue;
      // the channel needs the cube; countries alone are exact; neither: GA4's own monthly users
      const a = pickH ? fromCube[m] ?? [0, 0, 0, 0] : pickC ? byCountry[m] ?? fromCube[m] ?? [0, 0, 0, 0] : null;
      const users = a ? a[1] : exact?.[0] ?? 0;
      const fresh = a ? a[2] : exact?.[1] ?? 0;
      out.V01[side][i] = users;
      out.V02N[side][i] = fresh;
      out.V02[side][i] = users ? fresh / users : null;
      out.V03[side][i] = a ? a[0] : exact?.[2] ?? 0;
      const abroad = pickH ? fromCube[m] : byCountry[m] ?? fromCube[m];
      out.V04[side][i] = abroad ? abroad[3] : null;
      // the known visitors: countries only (the login event has no channel)
      const den = pickC ? byCountry[m]?.[1] ?? null : exact?.[0] ?? null;
      if (hasLogins && den != null) {
        out.V06G[side][i] = known[m] ?? 0;
        out.V06U[side][i] = den;
        out.V06S[side][i] = den ? (known[m] ?? 0) / den : null;
      }
    }
  }
  return out;
}

/** GA4's channels in the four groups the catalogue names (V03: "organic / paid / direct / AI"), the rest "Other". */
export const CHANNEL_GROUPS = ["Organic", "Paid", "Direct", "AI assistants"] as const;
export function groupOf(channel: string): string {
  if (channel === "Direct") return "Direct";
  if (channel === "AI Assistant") return "AI assistants";
  if (/^Organic /.test(channel)) return "Organic";
  if (/^Paid /.test(channel) || channel === "Cross-network" || channel === "Display") return "Paid";
  return "Other";
}

export type MonthGroups = { month: number; total: number; pyTotal: number; groups: Record<string, number> };
/**
 * Visits per month by channel group, the months chosen, and each month a year earlier (SARCLA 18.10:
 * the traffic origin card "I don't understand" - one total per month under a "by channel" name).
 */
export function groupsByMonth(d: VisitData, year: number, months: number[], f: VisitFilters = {}): MonthGroups[] {
  const pickC = f.country?.length ? new Set(f.country.map((c) => c.toUpperCase())) : null;
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const out = months.map((i) => ({ month: i, total: 0, pyTotal: 0, groups: {} as Record<string, number> }));
  // "YYYY-MM" -> [the row, 0 this year / 1 a year earlier]
  const at = new Map<string, [number, 0 | 1]>();
  months.forEach((i, k) => { at.set(ym(year, i), [k, 0]); at.set(ym(year - 1, i), [k, 1]); });
  for (const [m, c, h, s] of d.cube) {
    const hit = at.get(m);
    if (!hit || (pickC && !pickC.has(c)) || (pickH && !pickH.has(d.channels[h]))) continue;
    const r = out[hit[0]];
    if (hit[1] === 1) { r.pyTotal += s; continue; }
    r.total += s;
    const g = groupOf(d.channels[h]);
    r.groups[g] = (r.groups[g] ?? 0) + s;
  }
  return out;
}

export type CountryUsersRow = { code: string; label: string; users: number; pyUsers: number };
/**
 * Users by country outside Switzerland over the months chosen, against the same months a year
 * earlier (V04 by country, SARCLA 18.10). Exact per country; with a channel chosen from the cube.
 */
export function usersAbroad(d: VisitData, year: number, months: number[], f: VisitFilters = {}, withHome = false): CountryUsersRow[] {
  const cy = new Set(months.map((i) => ym(year, i))), py = new Set(months.map((i) => ym(year - 1, i)));
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const rows: Record<string, CountryUsersRow> = {};
  const add = (m: string, c: string, u: number) => {
    if ((c === "CH" && !withHome) || (!cy.has(m) && !py.has(m))) return;
    const key = c || "ZZ";
    const r = (rows[key] ??= { code: key, label: countryName(key), users: 0, pyUsers: 0 });
    if (cy.has(m)) r.users += u; else r.pyUsers += u;
  };
  if (pickH || !d.countryUsers?.length) {
    for (const [m, c, h, , u] of d.cube) if (!pickH || pickH.has(d.channels[h])) add(m, c, u);
  } else {
    for (const [m, c, u] of d.countryUsers) add(m, c, u);
  }
  return Object.values(rows).filter((r) => r.users || r.pyUsers).sort((a, b) => b.users - a.users);
}

export type KnownRow = { code: string; label: string; users: number; known: number; pyUsers: number; pyKnown: number };
/** Per country: the visitors and those who logged in, over the months chosen and a year earlier. */
export function knownByCountry(d: VisitData, year: number, months: number[]): KnownRow[] {
  const cy = new Set(months.map((i) => ym(year, i))), py = new Set(months.map((i) => ym(year - 1, i)));
  const rows: Record<string, KnownRow> = {};
  const row = (c: string) => (rows[c || "ZZ"] ??= { code: c || "ZZ", label: countryName(c || "ZZ"), users: 0, known: 0, pyUsers: 0, pyKnown: 0 });
  for (const [m, c, u] of d.countryUsers ?? []) { if (cy.has(m)) row(c).users += u; else if (py.has(m)) row(c).pyUsers += u; }
  for (const [m, c, u] of d.logins ?? []) { if (cy.has(m)) row(c).known += u; else if (py.has(m)) row(c).pyKnown += u; }
  return Object.values(rows).filter((r) => r.users).sort((a, b) => b.known - a.known || b.users - a.users);
}

export type BreakRow = { key: string; label: string; sessions: number; pySessions: number; users: number; pyUsers: number; newUsers: number; pyNewUsers: number };

/** Traffic origin (by channel) or visitors by country over the months chosen, against the same months a year earlier. */
export function cubeTable(d: VisitData, year: number, months: number[], by: "channel" | "country", f: VisitFilters = {}): BreakRow[] {
  const cy = new Set(months.map((i) => ym(year, i))), py = new Set(months.map((i) => ym(year - 1, i)));
  const pickC = f.country?.length ? new Set(f.country.map((c) => c.toUpperCase())) : null;
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const rows: Record<string, BreakRow> = {};
  // countries without a channel chosen: GA4's exact users per country (the cube counts a visitor once per channel)
  if (by === "country" && !pickH && d.countryUsers?.length) {
    for (const [m, c, u, n, s] of d.countryUsers) {
      const isCy = cy.has(m);
      if (!isCy && !py.has(m)) continue;
      const key = c || "ZZ";
      const r = (rows[key] ??= { key, label: countryName(key), sessions: 0, pySessions: 0, users: 0, pyUsers: 0, newUsers: 0, pyNewUsers: 0 });
      if (isCy) { r.sessions += s; r.users += u; r.newUsers += n; } else { r.pySessions += s; r.pyUsers += u; r.pyNewUsers += n; }
    }
    return Object.values(rows).filter((r) => r.sessions || r.pySessions).sort((a, b) => b.sessions - a.sessions);
  }
  for (const [m, c, h, s, u, n] of d.cube) {
    const isCy = cy.has(m), isPy = py.has(m);
    if (!isCy && !isPy) continue;
    // the table's own dimension is not filtered: the chosen rows stand out instead
    if (by === "channel" && pickC && !pickC.has(c)) continue;
    if (by === "country" && pickH && !pickH.has(d.channels[h])) continue;
    const key = by === "channel" ? d.channels[h] : c || "ZZ";
    const r = (rows[key] ??= { key, label: by === "channel" ? key : countryName(key), sessions: 0, pySessions: 0, users: 0, pyUsers: 0, newUsers: 0, pyNewUsers: 0 });
    if (isCy) { r.sessions += s; r.users += u; r.newUsers += n; } else { r.pySessions += s; r.pyUsers += u; r.pyNewUsers += n; }
  }
  return Object.values(rows).filter((r) => r.sessions || r.pySessions).sort((a, b) => b.sessions - a.sessions);
}

export type StoreRow = { code: string; label: string; sessions: number; pySessions: number; users: number };
/** Sessions by the store they landed on - the year so far against the same months last year; the channel chosen only. */
export function storeTable(d: VisitData, f: VisitFilters = {}): StoreRow[] {
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const rows: Record<string, StoreRow> = {};
  for (const [side, list] of [["cy", d.landing.cy], ["py", d.landing.py]] as const) {
    for (const [page, ch, s, u] of list) {
      if (pickH && !pickH.has(ch)) continue;
      const code = storeOf(page) ?? (page === "(not set)" ? "(not set)" : "(other)");
      const r = (rows[code] ??= { code, label: storeName(code) ?? (code === "(not set)" ? NO_PAGE : "Other pages (not a store address)"), sessions: 0, pySessions: 0, users: 0 });
      if (side === "cy") { r.sessions += s; r.users += u; } else r.pySessions += s;
    }
  }
  // the stores first, largest first; the visits without a store at the end
  const rank = (r: StoreRow) => (r.code === "(not set)" ? 2 : r.code === "(other)" ? 1 : 0);
  return Object.values(rows).sort((a, b) => rank(a) - rank(b) || b.sessions - a.sessions);
}

export type StoreChannels = { code: string; label: string; total: number; pyTotal: number; channels: Record<string, number> };
/**
 * Each store's visits by the channel that brought them, the year so far (SARCLA 18.10: "a graph
 * about the locale + top main channel to compare what brings more visitors to it"). Stores only:
 * the visits without a page and the pages outside a store are not in it.
 */
export function storeChannels(d: VisitData, f: VisitFilters = {}): StoreChannels[] {
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const rows: Record<string, StoreChannels> = {};
  for (const [side, list] of [["cy", d.landing.cy], ["py", d.landing.py]] as const) {
    for (const [page, ch, s] of list) {
      if (pickH && !pickH.has(ch)) continue;
      const code = storeOf(page);
      if (!code) continue;
      const r = (rows[code] ??= { code, label: storeName(code) ?? code, total: 0, pyTotal: 0, channels: {} });
      if (side === "cy") { r.total += s; r.channels[ch] = (r.channels[ch] ?? 0) + s; } else r.pyTotal += s;
    }
  }
  return Object.values(rows).sort((a, b) => b.total - a.total);
}

/** The visits without a landing page (a tab left open), the year so far and the same months last year. */
export function noPageVisits(d: VisitData): { cy: number; py: number } {
  const sum = (l: [string, string, number, number][]) => l.reduce((a, [p, , s]) => a + (p === "(not set)" ? s : 0), 0);
  return { cy: sum(d.landing.cy), py: sum(d.landing.py) };
}

export type PageRow = { page: string; store: string | null; sessions: number; users: number; channels: Record<string, number> };
/** The landing pages with the most sessions this year so far - all channels or the ones chosen; the visits without a page left out. */
export function landingTable(d: VisitData, f: VisitFilters = {}, top = 25): PageRow[] {
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const rows: Record<string, PageRow> = {};
  for (const [page, ch, s, u] of d.landing.cy) {
    // a visit without a page view is not a landing page
    if (page === "(not set)" || (pickH && !pickH.has(ch))) continue;
    const r = (rows[page] ??= { page, store: storeOf(page), sessions: 0, users: 0, channels: {} });
    r.sessions += s; r.users += u; r.channels[ch] = (r.channels[ch] ?? 0) + s;
  }
  return Object.values(rows).sort((a, b) => b.sessions - a.sessions).slice(0, top);
}

/** The year-so-far KPIs: sessions that landed on a store page (V05), on the top landing pages (V08), Prio 1 and 2 companies logged in (V07). */
export function visitYtd(d: VisitData): Record<"V05" | "V07" | "V08", { cy: number | null; py: number | null; pyNote?: string }> {
  const stores = storeTable(d).filter((r) => storeOf(`/${r.code}`));
  const top = landingTable(d, {}, 20);
  const topPy = new Set(top.map((r) => r.page));
  const pyTop = d.landing.py.filter(([p]) => topPy.has(p)).reduce((a, [, , s]) => a + s, 0);
  const same = d.landing.months ? `same months Jan–${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.landing.months - 1]}` : undefined;
  const p12 = d.prio.filter((p) => /Prio 1|Prio 2/.test(p.band));
  const sum = (xs: (number | null)[]) => (xs.some((x) => x == null) ? null : xs.reduce<number>((a, b) => a + (b ?? 0), 0));
  return {
    V05: { cy: stores.reduce((a, r) => a + r.sessions, 0), py: stores.reduce((a, r) => a + r.pySessions, 0), pyNote: same },
    V07: { cy: sum(p12.map((p) => p.cy)), py: sum(p12.map((p) => p.py)), pyNote: `${d.year - 1} whole year` },
    V08: { cy: top.reduce((a, r) => a + r.sessions, 0), py: pyTop, pyNote: same },
  };
}

// VISIT & TRAFFIC ORIGIN - the pure part (SARCLA 18.10: "let's tackle the Visit page by building
// what's missing ... put the page like the others"). GA4 read by visit.ts into:
//   users      exact users, new users and sessions per month (V01, V02)
//   cube       sessions, users and new users per month x country x channel - the page's
//              period, country and channel filters, and the traffic origin and country tables
//   landing    sessions per landing page x channel, the year so far and the same months last
//              year - the store (the page address's first part, /de-CH) and landing page tables
//   prio       companies that logged in to the shop, per sales priority (Datatracker, V06/V07)
// GA4 counts visitors who accepted statistics cookies only: every figure is a floor.

import { countryName } from "./countries";

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
  /** companies by sales priority: all, logged in this year, logged in last year */
  prio: { band: string; all: number | null; cy: number | null; py: number | null }[];
  errors: Record<string, string>;
};

export type VisitFilters = { country?: string[]; channel?: string[] };
type Monthly = { months: (number | null)[]; py: (number | null)[] };

const ym = (y: number, i: number) => `${y}-${String(i + 1).padStart(2, "0")}`;

/**
 * The page's monthly KPIs, this year and last: users (V01), new users (V02N) and their share
 * (V02), sessions (V03), users outside Switzerland (V04). Unfiltered, users are GA4's exact
 * monthly users; with a country or channel chosen they come from the cube, where a visitor
 * arriving through two channels in a month counts twice.
 */
export function visitSeries(d: VisitData, year: number, f: VisitFilters = {}): Record<"V01" | "V02N" | "V02" | "V03" | "V04", Monthly> {
  const empty = (): Monthly => ({ months: Array(12).fill(null), py: Array(12).fill(null) });
  const out = { V01: empty(), V02N: empty(), V02: empty(), V03: empty(), V04: empty() };
  const filtered = !!(f.country?.length || f.channel?.length);
  const pickC = f.country?.length ? new Set(f.country.map((c) => c.toUpperCase())) : null;
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const agg: Record<string, [number, number, number, number]> = {};   // sessions, users, new, users outside CH
  for (const [m, c, h, s, u, n] of d.cube) {
    if (pickC && !pickC.has(c)) continue;
    if (pickH && !pickH.has(d.channels[h])) continue;
    const a = (agg[m] ??= [0, 0, 0, 0]);
    a[0] += s; a[1] += u; a[2] += n;
    if (c !== "CH") a[3] += u;
  }
  for (const [side, y] of [["months", year], ["py", year - 1]] as const) {
    for (let i = 0; i < 12; i++) {
      const m = ym(y, i);
      const exact = d.users[m], a = agg[m];
      if (!exact && !a) continue;
      const users = filtered ? a?.[1] ?? 0 : exact?.[0] ?? a?.[1] ?? 0;
      const fresh = filtered ? a?.[2] ?? 0 : exact?.[1] ?? a?.[2] ?? 0;
      out.V01[side][i] = users;
      out.V02N[side][i] = fresh;
      out.V02[side][i] = users ? fresh / users : null;
      out.V03[side][i] = filtered ? a?.[0] ?? 0 : exact?.[2] ?? a?.[0] ?? 0;
      out.V04[side][i] = a ? a[3] : null;
    }
  }
  return out;
}

export type BreakRow = { key: string; label: string; sessions: number; pySessions: number; users: number; pyUsers: number; newUsers: number; pyNewUsers: number };

/** Traffic origin (by channel) or visitors by country over the months chosen, against the same months a year earlier. */
export function cubeTable(d: VisitData, year: number, months: number[], by: "channel" | "country", f: VisitFilters = {}): BreakRow[] {
  const cy = new Set(months.map((i) => ym(year, i))), py = new Set(months.map((i) => ym(year - 1, i)));
  const pickC = f.country?.length ? new Set(f.country.map((c) => c.toUpperCase())) : null;
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const rows: Record<string, BreakRow> = {};
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
      const r = (rows[code] ??= { code, label: storeName(code) ?? (code === "(not set)" ? "No landing page recorded" : "Other pages (not a store address)"), sessions: 0, pySessions: 0, users: 0 });
      if (side === "cy") { r.sessions += s; r.users += u; } else r.pySessions += s;
    }
  }
  return Object.values(rows).sort((a, b) => b.sessions - a.sessions);
}

export type PageRow = { page: string; store: string | null; sessions: number; users: number; channels: Record<string, number> };
/** The landing pages with the most sessions this year so far - all channels or the ones chosen. */
export function landingTable(d: VisitData, f: VisitFilters = {}, top = 25): PageRow[] {
  const pickH = f.channel?.length ? new Set(f.channel) : null;
  const rows: Record<string, PageRow> = {};
  for (const [page, ch, s, u] of d.landing.cy) {
    if (pickH && !pickH.has(ch)) continue;
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

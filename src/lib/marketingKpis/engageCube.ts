// ENGAGE - the pure part (SARCLA 19.10: "let's tackle Engage next"). Read by engage.ts into:
//   months     GA4's sessions, engaged sessions, engagement seconds and users per month, exact
//   cube       the same per month x country x channel - the page's country and channel filters
//   views      the article views (GA4's view_item) per month: views, the visitors who viewed
//   topItems   the most viewed articles this year so far (whole months)
//   events     the tools' and the site search's GA4 events per month
//   search     the search bar's own log (its gateway): searches per month, those that found nothing
//   prices     why logged-in customers did not buy, from the live shop tracker (since 30 Sep 2026): the
//              price (they priced 3+ KT/DT articles and did not order - the Datatracker's rule), the
//              minimum order quantity (they asked for fewer), availability (not, or not enough, on the shelf)
//   products   each product page viewed, its profit centre and whether its articles were bought, per month
//   tools      each configurator's own count - DirectCut, DirectUP, the shop tools' gateways
// GA4 counts visitors who accepted statistics cookies only: every GA4 figure is a floor.

import { countryName } from "./countries";
import type { LostReason } from "../datatracker/rules";

/** The GA4 events of the Tools tab, in plain words. */
export const TOOLS: { event: string; label: string; what: string }[] = [
  { event: "directup_form_submit_manualupload", label: "DirectUp - drawing uploaded", what: "A drawing or file uploaded in DirectUp to get a part made" },
  { event: "directup_form_submit", label: "DirectUp - request sent", what: "A DirectUp request sent to us" },
  { event: "oring_expert_add_to_cart", label: "O-ring Expert - to the cart", what: "An O-ring chosen in the O-ring Expert put in the cart" },
];
export const SEARCH_EVENTS = { searches: "view_search_results", clicks: "search_results_click" } as const;

/** Products & Pricing's profit centres, in plain words. */
export const PROFIT_CENTRES: Record<string, string> = {
  DT: "Sealing", KT: "Plastics", FT: "Fluid - hoses and fittings", AT: "Drive - belts", ST: "Anti-vibration", PW: "Sensors and power",
};
export const pcLabel = (pc: string | null) => (pc ? (PROFIT_CENTRES[pc] ? `${pc} · ${PROFIT_CENTRES[pc]}` : pc) : "Not in Products & Pricing");

/** The shop's top categories in its six languages - a category page's profit centre. */
const CATEGORY_PC: Record<string, string> = Object.fromEntries(Object.entries({
  DT: ["dichtungstechnik", "sealing-technology", "technologie-de-l-etancheite", "tecnologia-delle-tenute", "afdichtingstechniek", "technologia-uszczelniania"],
  KT: ["kunststofftechnik", "engineering-plastics-technology", "technologie-des-matieres-plastiques", "tecnologia-delle-materie-plastiche", "kunststoftechniek", "technologia-tworzyw-sztucznych", "directcut-konfigurator", "directcut-configurator"],
  FT: ["fluidtechnik", "fluid-handling-technology", "technologie-des-fluides", "tecnologia-dei-fluidi", "industriele-slangen", "technologia-manipulowania-plynami"],
  AT: ["antriebstechnik", "drive-technology", "technologie-de-la-transmission", "tecnologia-delle-trasmissioni", "aandrijftechniek", "technologia-napedowa"],
  ST: ["schwingungstechnik", "antivibration-technology", "technologie-de-l-antivibration", "tecnologia-dell-antivibrazione", "trillingisolatie", "technologia-przeciwdrganiowa"],
  PW: ["sensoren-und-powertechnik", "sensors-and-power", "technologie-des-capteurs-et-de-l-energie", "tecnologia-dei-sensori-e-della-potenza", "sensoren-en-voedingstechnologie", "czujniki-i-elementy-zasilajace"],
}).flatMap(([pc, slugs]) => slugs.map((s) => [s, pc])));

/**
 * The page a view_item fired on: a product page (its address starts with the 8-digit product), a category
 * list (its top category is the profit centre), the search results, or something else.
 */
export function viewPage(path: string): { kind: "product"; product: string } | { kind: "list"; pc: string } | { kind: "search" | "other" } {
  let p = path.split("?")[0].split("/").filter(Boolean);
  if (/^[a-z]{2}-[A-Z]{2,3}$/.test(p[0] ?? "")) p = p.slice(1);
  if (/^[a-z]{3}$/.test(p[0] ?? "") && p.length > 1) p = p.slice(1);   // /de-DE/eur/... - the currency
  const last = (p[p.length - 1] ?? "").replace(/\.html$/, "");
  const m = /^(\d{8})-/.exec(last);
  if (m) return { kind: "product", product: m[1] };
  if (p[0] === "catalogsearch") return { kind: "search" };
  const pc = CATEGORY_PC[(p[0] ?? "").replace(/\.html$/, "")];
  return pc ? { kind: "list", pc } : { kind: "other" };
}

export type SearchKind = "number" | "code" | "words" | "long";
export const SEARCH_KINDS: Record<SearchKind, string> = {
  number: "A number we do not know - article, drawing, the customer's own",
  code: "A type or code - letters and numbers",
  words: "Words",
  long: "A long question or pasted text",
};

/** What a search was, by its text alone. */
export function searchKind(text: string): SearchKind {
  const s = text.trim();
  if (s.split(/\s+/).length >= 6 || s.length > 50) return "long";
  if (/^[\d\s.\-/]+$/.test(s) && s.replace(/\D/g, "").length >= 4) return "number";
  if (/\d/.test(s) && /\p{L}/u.test(s)) return "code";
  return "words";
}

export type LogLine = { text: string; norm: string; locale: string; hits: number; at: string };
export type SearchSample = {
  from: string; to: string; searches: number; nothing: number;
  /** found nothing while the person was still typing: a longer (or shorter) text followed within a minute */
  typing: number;
  kinds: Record<SearchKind, number>;
  /** the texts that found nothing most often, per kind */
  examples: Record<SearchKind, { text: string; n: number }[]>;
};
/**
 * The search bar's last searches, read for "is 27% too high?" (SARCLA 19.10): which of those that found
 * nothing were only half typed - the bar searches as one types, so "haltegri" finds nothing a moment
 * before "haltegriff" does - and what the others were.
 */
export function searchSample(lines: LogLine[]): SearchSample | null {
  if (!lines.length) return null;
  const asc = [...lines].sort((a, b) => a.at.localeCompare(b.at));
  const kinds: Record<SearchKind, number> = { number: 0, code: 0, words: 0, long: 0 };
  const seen: Record<SearchKind, Map<string, { text: string; n: number }>> = { number: new Map(), code: new Map(), words: new Map(), long: new Map() };
  let nothing = 0, typing = 0;
  for (let i = 0; i < asc.length; i++) {
    const l = asc[i];
    if (l.hits) continue;
    nothing++;
    const t = Date.parse(l.at);
    let half = false;
    for (let j = i + 1; j < asc.length && j < i + 80; j++) {
      const m = asc[j];
      if (Date.parse(m.at) - t > 60_000) break;
      if (m.locale === l.locale && m.norm !== l.norm && (m.norm.startsWith(l.norm) || l.norm.startsWith(m.norm))) { half = true; break; }
    }
    if (half) { typing++; continue; }
    const k = searchKind(l.text);
    kinds[k]++;
    // a password or an e-mail typed into the bar by mistake is counted, never shown
    if (/pass|kennw|mot de passe|@/i.test(l.text)) continue;
    const e = seen[k].get(l.norm);
    if (e) e.n++; else seen[k].set(l.norm, { text: l.text.replace(/\s+/g, " ").trim().slice(0, 70), n: 1 });
  }
  const top = (k: SearchKind) => [...seen[k].values()].sort((a, b) => b.n - a.n).slice(0, 8);
  return { from: asc[0].at, to: asc[asc.length - 1].at, searches: asc.length, nothing, typing, kinds, examples: { number: top("number"), code: top("code"), words: top("words"), long: top("long") } };
}

export type ToolCount = {
  key: string; name: string; what: string;
  /** where the count comes from, in a few words */
  source: string;
  /** the first day it counts */
  since: string | null;
  /** what the two figures of a day are */
  unit: string; unit2: string | null;
  /** [day, figure, second figure] */
  days: [string, number, number][];
  /** [month, figure, second figure] - when a read has no days (the search bar read before 19.10.2026) */
  months?: [string, number, number][];
  /** framed on the shop's production pages */
  onShop: boolean;
  error?: string;
};

/** Where a look that ended in no order was lost, in plain words - the order the diagram reads. */
export const LOST: { key: LostReason; label: string; what: string }[] = [
  { key: "shelf", label: "Availability", what: "Nothing on the shelf, or less than they asked for" },
  { key: "moq", label: "Minimum order quantity", what: "They asked for fewer than we sell" },
  { key: "cart", label: "Left in the cart", what: "Put in the cart, never ordered" },
  { key: "price", label: "The price", what: "They typed a quantity, saw the price, and left" },
  { key: "looked", label: "Only looked", what: "Opened the article, no quantity typed" },
];

/**
 * Where we lost them as a path (SARCLA 19.10: "a diagram like the other one, to see the path"): every
 * article looked at, step by step as the shop goes - on the shelf, a quantity typed, into the cart, ordered -
 * and at each step the ones that went no further. It follows rules.lostReason's order, so each look
 * leaves at one step only; an article ordered passes every step.
 */
export function lostPath(l: { looks: Record<LostReason, number>; ordered: number }): { columns: string[]; nodes: { id: string; column: number; label: string; lost: LostReason | "won" | null }[]; links: { from: string; to: string; value: number }[] } {
  const lost = l.looks;
  const all = l.ordered + Object.values(lost).reduce((a, n) => a + n, 0);
  const onShelf = all - lost.shelf, further = onShelf - lost.looked, cart = further - lost.moq - lost.price;
  const links = [
    { from: "all", to: "shelf-ok", value: onShelf }, { from: "all", to: "shelf", value: lost.shelf },
    { from: "shelf-ok", to: "typed", value: further }, { from: "shelf-ok", to: "looked", value: lost.looked },
    { from: "typed", to: "cart-in", value: cart }, { from: "typed", to: "moq", value: lost.moq }, { from: "typed", to: "price", value: lost.price },
    { from: "cart-in", to: "won", value: l.ordered }, { from: "cart-in", to: "cart", value: lost.cart },
  ].filter((x) => x.value > 0);
  const nodes = [
    { id: "all", column: 0, label: "Articles looked at", lost: null },
    { id: "shelf-ok", column: 1, label: "On the shelf", lost: null }, { id: "shelf", column: 1, label: "Not, or not enough, on the shelf", lost: "shelf" },
    { id: "typed", column: 2, label: "A quantity typed", lost: null }, { id: "looked", column: 2, label: "Only looked", lost: "looked" },
    { id: "cart-in", column: 3, label: "Into the cart", lost: null }, { id: "moq", column: 3, label: "Below the minimum quantity", lost: "moq" }, { id: "price", column: 3, label: "Saw the price and left", lost: "price" },
    { id: "won", column: 4, label: "Ordered", lost: "won" }, { id: "cart", column: 4, label: "Left in the cart", lost: "cart" },
  ] as const;
  const used = new Set(links.flatMap((x) => [x.from, x.to]));
  return { columns: ["Looked at", "On the shelf?", "A quantity typed?", "Into the cart?", "Ordered?"], nodes: nodes.filter((n) => used.has(n.id)).map((n) => ({ ...n })), links };
}

/** The search bar as one of the tools (SARCLA 19.10: "merge as a tool, only the number"): its searches each day, those that found something. */
export function searchTool(d: EngageData): ToolCount | null {
  const s = d.search;
  if (!s) return d.errors.search ? { key: "search", name: "Search bar", what: "The shop's search bar - searches, and those that found something", source: "its own log", since: null, unit: "Searches", unit2: "Found something", days: [], onShop: true, error: d.errors.search } : null;
  const days = s.byDay ?? [];
  const months = Object.keys(s.byMonth).sort().map((m) => [m, s.byMonth[m][0], s.byMonth[m][1]] as [string, number, number]);
  return { key: "search", name: "Search bar", what: "The shop's search bar - searches, and those that found something", source: "its own log - every search, cookies or not", since: s.since, unit: "Searches", unit2: "Found something", days, months, onShop: true };
}

export type MoqRow = { day: string; company: string; companyId: string; article: string; description: string | null; pc: string | null; qty: number; minimum: number | null; unit: string | null };
export type ShelfRow = { day: string; company: string; companyId: string; article: string; description: string | null; pc: string | null; qty: number | null; stock: number; short: number | null; unit: string | null };

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
  /**
   * Each product page viewed (the 8-digit product), its name and profit centre, and per month - last
   * year's January to December, then this year's - its page's views and how many of its articles were bought.
   */
  products: Record<string, { n: string; pc: string | null; v: number[]; b?: number[] }>;
  /** the other pages view_item fires on, per month: a category list by its profit centre, "search" (the results), "other" */
  lists: Record<string, number[]>;
  /** the articles bought online per month, by their product's profit centre ("other": Products & Pricing does not know it) */
  bought: Record<string, number[]>;
  /** made-to-order articles bought per month (8001..., cut pieces and special O-rings) - they belong to no product page */
  madeToOrder: number[];
  /** the other articles bought online that Products & Pricing could not tie to a product */
  unmapped: number;
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
    /** [day, searches, found something] - the search bar as one of the tools */
    byDay?: [string, number, number][];
    byLocale: { locale: string; searches: number; ok: number }[];
    top: { query: string; searches: number; found: number }[];
    /** the searches that found nothing, the last 30 days - the words to add to the search bar */
    gaps: { query: string; count: number; last: string; locales: string[] }[];
    /** the last searches, one by one: what those that found nothing were */
    sample: SearchSample | null;
  } | null;
  prices: {
    since: string;
    /** [day, price checks that qualify, of them with a ticket] */
    byDay: [string, number, number][];
    byTeam: Record<string, number>;
    companies: number;
    /** asked for fewer than the article's minimum order quantity: [day, looks, companies] and each look */
    moq: { byDay: [string, number, number][]; rows: MoqRow[]; total: number };
    /** nothing on the shelf, or not as much as they asked for: [day, nothing, not enough] and each look */
    shelf: { byDay: [string, number, number][]; rows: ShelfRow[]; total: number };
    /** every look that ended in no order, by where it was lost (datatracker/rules.lostReason) */
    lost?: { looks: Record<LostReason, number>; companies: Record<LostReason, number>; total: number; totalCompanies: number; ordered: number; orderedCompanies: number };
  } | null;
  tools: ToolCount[];
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

/** a month's place in a product's 24 months: last year's January to December, then this year's */
const at24 = (year: number, y: number, i: number) => (y === year ? 12 + i : y === year - 1 ? i : -1);

export type PcRow = {
  /** a profit centre, "search" (the search results), "other" (a page the hub cannot place) */
  key: string; label: string;
  /** every view: the category lists and the product pages */
  views: number; pyViews: number;
  /** the product pages' views, and those on a product of which an article was bought online in those months */
  productViews: number; viewsBought: number; pyProductViews: number; pyViewsBought: number;
  products: number; productsBought: number;
  /** the articles of the profit centre bought online (each once a month) */
  bought: number; pyBought: number;
};
const KEY_LABEL: Record<string, string> = { search: "Search results - no profit centre", other: "Other pages - not tied to a profit centre" };
/**
 * Article views by profit centre over the months chosen, against the same months a year earlier (SARCLA
 * 19.10: "the breakdown by profit center and if it was purchased or not"): every page view_item fires on -
 * a category list by its top category, a product page by its product's profit centre - and of the product
 * pages, those on a product bought online in those months. The rows add up to the Article views figure.
 */
export function viewsByPc(d: EngageData, year: number, months: number[]): PcRow[] {
  const rows = new Map<string, PcRow>();
  const row = (key: string) => {
    let r = rows.get(key);
    if (!r) rows.set(key, (r = { key, label: KEY_LABEL[key] ?? pcLabel(key), views: 0, pyViews: 0, productViews: 0, viewsBought: 0, pyProductViews: 0, pyViewsBought: 0, products: 0, productsBought: 0, bought: 0, pyBought: 0 }));
    return r;
  };
  const sum = (xs: number[] | undefined, y: number) => months.reduce((a, i) => a + (xs?.[at24(year, y, i)] ?? 0), 0);
  for (const [key, xs] of Object.entries(d.lists)) {
    const v = sum(xs, year), pv = sum(xs, year - 1);
    if (!v && !pv) continue;
    const r = row(key);
    r.views += v; r.pyViews += pv;
  }
  for (const [key, xs] of Object.entries(d.bought)) {
    const b = sum(xs, year), pb = sum(xs, year - 1);
    if (!b && !pb) continue;
    const r = row(key);
    r.bought += b; r.pyBought += pb;
  }
  for (const p of Object.values(d.products)) {
    const v = sum(p.v, year), pv = sum(p.v, year - 1), b = sum(p.b, year), pb = sum(p.b, year - 1);
    if (!v && !pv) continue;
    // a product Products & Pricing does not know joins the pages the hub cannot place
    const r = row(p.pc ?? "other");
    r.views += v; r.pyViews += pv; r.productViews += v; r.pyProductViews += pv;
    if (v) r.products++;
    if (v && b) { r.productsBought++; r.viewsBought += v; }
    if (pv && pb) r.pyViewsBought += pv;
  }
  const last = (k: string) => (k === "search" ? 1 : k === "other" ? 2 : 0);
  return [...rows.values()].sort((a, b) => last(a.key) - last(b.key) || b.views - a.views);
}

/** Made-to-order articles bought online over the months chosen - they belong to no product page. */
export const madeToOrderIn = (d: EngageData, year: number, months: number[]) => months.reduce((a, i) => a + (d.madeToOrder[at24(year, year, i)] ?? 0), 0);

export type ProductRow = { id: string; name: string; pc: string | null; views: number; pyViews: number; bought: number };
/** The products viewed most over the months chosen - their profit centre, and the articles of them bought online. */
export function productTable(d: EngageData, year: number, months: number[], f: { pc?: (string | null)[]; bought?: boolean } = {}): ProductRow[] {
  const out: ProductRow[] = [];
  for (const [id, p] of Object.entries(d.products)) {
    if (f.pc?.length && !f.pc.includes(p.pc)) continue;
    let v = 0, pv = 0, b = 0;
    for (const i of months) { v += p.v[at24(year, year, i)] ?? 0; pv += p.v[at24(year, year - 1, i)] ?? 0; b += p.b?.[at24(year, year, i)] ?? 0; }
    if (!v) continue;
    if (f.bought != null && f.bought !== b > 0) continue;
    out.push({ id, name: p.n, pc: p.pc, views: v, pyViews: pv, bought: b });
  }
  return out.sort((a, b) => b.views - a.views);
}

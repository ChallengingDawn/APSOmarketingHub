// APSOconvert > Problem pages > SEO PAGES - the rules, pure (tests/convert-seo.test.ts). SARCLA 09.11.2026: "you should
// bring another categories: SEO pages, Blog (to come), other pages that are not articles, blocks like newsletter block".
//
// An SEO page is a shop page as Google shows it (Search Console: how often it was shown, clicked, at which position).
// Its problem is the one a page can fix with its own words: Google shows it, people do not click - its click rate is
// under half of what is TYPICAL AT ITS POSITION ON THIS SHOP (the shop's own pages at the same position, not a figure
// from a study), or it sits just below Google's first page with many showings. No "@/" import: the tests compile it.

import { classify, type PageKind } from "./model";

export type GscPageRow = { key: string; clicks: number | null; impressions: number | null; ctr: number | null; position: number | null };
export type GscPairRow = { query: string; page: string; clicks: number | null; impressions: number | null; position: number | null };
export type SeoQuery = { q: string; clicks: number; impressions: number; position: number | null };
export type SeoRow = {
  /** The address on the shop (path), and the whole address Google shows. */
  path: string; url: string; kind: PageKind;
  clicks: number; impressions: number; ctr: number; position: number;
  /** The shop's own click rate at this position (null: too few pages there to say). */
  typical: number | null;
  /** Clicks the page would have had at the typical rate, minus the ones it had (0 when it does as well). */
  missed: number;
  reasons: string[];
  /** The searches it was shown for, the most shown first (at most 5). */
  queries: SeoQuery[];
};
export type SeoBand = { key: string; label: string; from: number; to: number; impressions: number; clicks: number; rate: number | null };

/** Google positions grouped the way click rates change: each of the first three, then 4-5, 6-10, page two, the rest. */
export const SEO_BANDS: { key: string; label: string; from: number; to: number }[] = [
  { key: "1", label: "Position 1", from: 0, to: 1.5 },
  { key: "2", label: "Position 2", from: 1.5, to: 2.5 },
  { key: "3", label: "Position 3", from: 2.5, to: 3.5 },
  { key: "4-5", label: "Positions 4-5", from: 3.5, to: 5.5 },
  { key: "6-10", label: "Positions 6-10", from: 5.5, to: 10.5 },
  { key: "11-20", label: "Google's 2nd page", from: 10.5, to: 20.5 },
  { key: "21+", label: "Further down", from: 20.5, to: Infinity },
];
export const SEO_RULES = { minImpressions: 300, nearFrom: 8, nearTo: 20, nearImpressions: 1000, bandPages: 3, shopHost: "www.apsoparts.com" } as const;

export const bandOf = (position: number) => SEO_BANDS.find((b) => position >= b.from && position < b.to) ?? SEO_BANDS[SEO_BANDS.length - 1];

const n = (x: number | null | undefined) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const pct = (r: number) => `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`;
const fmt = (x: number) => Math.round(x).toLocaleString("en-US");

/** The shop's address of a Search Console page ("https://www.apsoparts.com/de-CH/x.html" -> "/de-CH/x.html"), or null for another site. */
export function shopPathOf(url: string, host: string = SEO_RULES.shopHost): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== host) return null;
    return decodeURIComponent(u.pathname) || "/";
  } catch {
    return null;
  }
}

/** The shop's own click rate per band of positions: every page's clicks over its showings, where 3+ pages sit. */
export function seoBands(rows: GscPageRow[]): SeoBand[] {
  return SEO_BANDS.map((b) => {
    const inBand = rows.filter((r) => n(r.impressions) > 0 && r.position !== null && n(r.position) >= b.from && n(r.position) < b.to);
    const impressions = inBand.reduce((s, r) => s + n(r.impressions), 0);
    const clicks = inBand.reduce((s, r) => s + n(r.clicks), 0);
    return { ...b, impressions, clicks, rate: inBand.length >= SEO_RULES.bandPages && impressions > 0 ? clicks / impressions : null };
  });
}

/** Search Console's pages and searches made into SEO pages, the most clicks missed first, then the most shown. */
export function seoPages(pages: GscPageRow[], pairs: GscPairRow[], opts: { host?: string } = {}): { rows: SeoRow[]; bands: SeoBand[] } {
  const host = opts.host ?? SEO_RULES.shopHost;
  const own = pages.filter((p) => shopPathOf(p.key, host) !== null);
  const bands = seoBands(own);
  const rateAt = (pos: number) => bands.find((b) => pos >= b.from && pos < b.to)?.rate ?? null;
  const byPage = new Map<string, SeoQuery[]>();
  for (const q of pairs) {
    if (!q.query || shopPathOf(q.page, host) === null) continue;
    const list = byPage.get(q.page) ?? [];
    list.push({ q: q.query, clicks: n(q.clicks), impressions: n(q.impressions), position: q.position });
    byPage.set(q.page, list);
  }
  const rows: SeoRow[] = [];
  for (const p of own) {
    const impressions = n(p.impressions);
    if (impressions <= 0) continue;
    const path = shopPathOf(p.key, host)!;
    // SEO pages are the pages people find on Google to land on - categories, landing and content pages, the home -
    // never a product page (SARCLA 09.11.2026: "SEO pages are getting product pages"); products still count in what
    // is typical at a position.
    if (classify(path).kind === "product") continue;
    const clicks = n(p.clicks);
    const position = n(p.position) || 0;
    const ctr = clicks / impressions;
    const typical = position > 0 ? rateAt(position) : null;
    const missed = typical !== null ? Math.max(0, Math.round(impressions * typical - clicks)) : 0;
    const reasons: string[] = [];
    if (typical !== null && impressions >= SEO_RULES.minImpressions && ctr < typical / 2) {
      reasons.push(`Google showed it ${fmt(impressions)} times, ${pct(ctr)} clicked - ${pct(typical)} is typical at its position (${position.toFixed(1)}) on the shop`);
    }
    if (position >= SEO_RULES.nearFrom && position <= SEO_RULES.nearTo && impressions >= SEO_RULES.nearImpressions) {
      reasons.push(`Almost on Google's first page: position ${position.toFixed(1)}, shown ${fmt(impressions)} times`);
    }
    const queries = (byPage.get(p.key) ?? []).sort((a, b) => b.impressions - a.impressions).slice(0, 5);
    rows.push({ path, url: p.key, kind: classify(path).kind, clicks, impressions, ctr, position, typical, missed: reasons.length ? missed : 0, reasons, queries });
  }
  rows.sort((a, b) => b.missed - a.missed || b.impressions - a.impressions || a.path.localeCompare(b.path));
  return { rows, bands };
}

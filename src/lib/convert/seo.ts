// APSOconvert > Problem pages > SEO pages: the shop's pages as Google shows them (Search Console, the hub's service
// account - src/lib/integrations/gsc.ts) made into SEO pages by ./seoRules.ts. Search Console answers the 500 most
// clicked pages and the 500 most clicked search-and-page pairs; it is two days behind.
import { fetchGscQueries, fetchGscQueryPagePairs } from "@/lib/integrations/gsc";
import { describeIntegrationError } from "@/lib/integrations/status";
import { seoPages, type SeoBand, type SeoRow } from "./seoRules";

export type SeoData = { from: string; to: string; site: string | null; rows: SeoRow[]; bands: SeoBand[]; error: string | null; truncated: boolean };

export async function buildSeo(from: string, to: string, signal?: AbortSignal): Promise<SeoData> {
  try {
    const [pages, pairs] = await Promise.all([
      fetchGscQueries({ from, to, dimension: "page", rowLimit: 500, signal }),
      fetchGscQueryPagePairs({ from, to, rowLimit: 500, signal }).catch(() => null),
    ]);
    const { rows, bands } = seoPages(pages.rows, (pairs?.rows ?? []).map((r) => ({ query: r.query, page: r.page, clicks: r.clicks, impressions: r.impressions, position: r.position })));
    return { from, to, site: pages.siteUrl, rows, bands, error: null, truncated: pages.rows.length >= 500 };
  } catch (e) {
    return { from, to, site: null, rows: [], bands: [], error: describeIntegrationError(e).error, truncated: false };
  }
}

// APSOconvert > Insights > SEO landing page: the landing pages there are, to optimize (SARCLA 11.11.2026, he chose
// "existing + new"): the hub's own published pages first, then the shop's content pages Google shows - never a product
// page. Pure: tests/convert-blocks.test.ts; the list is drawn by src/app/website/ai-personalization/insights/LandingPages.tsx.

import type { Env } from "./model";

/** What the list needs of a page the hub published (./pages.ts HubPage), of Search Console's row (./seoRules.ts SeoRow)
 * and of an optimization (./studio.ts BoardRow) - said here, so this file stays pure. */
type HubLite = { env: Env; store: string; path: string; kind: string; title: string };
type GoogleLite = { path: string; kind: string; impressions: number; clicks: number; ctr: number; position: number; missed: number };
type IdeaLite = { env: Env; path: string; status: string; contentType: string };

export type Landing = {
  env: Env; path: string; ours: boolean; title: string; store: string | null;
  shown: number | null; clicks: number | null; ctr: number | null; position: number | null; missed: number;
  open: number;
};

/** The landing pages to optimize, ours first, then the shop's - by the clicks Google's searches missed, then shown. */
export function landingRows(published: HubLite[], seo: { rows: GoogleLite[] } | null, ideas: IdeaLite[]): Landing[] {
  const open = (env: Env, path: string) => ideas.filter((i) => i.env === env && i.path === path && i.status !== "dropped" && i.contentType !== "landing-page").length;
  const byPath = new Map((seo?.rows ?? []).map((r) => [r.path, r]));
  const out: Landing[] = [];
  const seen = new Set<string>();
  for (const p of published) {
    const k = `${p.env}${p.path}`;
    if (seen.has(k) || p.kind === "product") continue;
    seen.add(k);
    const g = p.env === "prod" ? byPath.get(p.path) : undefined;
    out.push({ env: p.env, path: p.path, ours: true, title: p.title, store: p.store, shown: g?.impressions ?? null, clicks: g?.clicks ?? null, ctr: g?.ctr ?? null, position: g?.position ?? null, missed: g?.missed ?? 0, open: open(p.env, p.path) });
  }
  const shop = (seo?.rows ?? []).filter((r) => r.kind === "cms" && !seen.has(`prod${r.path}`))
    .sort((a, b) => b.missed - a.missed || b.impressions - a.impressions);
  for (const r of shop) {
    out.push({ env: "prod", path: r.path, ours: false, title: "", store: r.path.split("/")[1] ?? null, shown: r.impressions, clicks: r.clicks, ctr: r.ctr, position: r.position, missed: r.missed, open: open("prod", r.path) });
  }
  return out;
}

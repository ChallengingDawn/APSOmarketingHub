// The frozen inputs of the Kalrez 6221/6230 action (see kalrez.ts): the 36 Swiss
// customers, built once from our order lines on 11.11.2026, and the article lists
// from Products & Pricing. Kept apart from the pure model so tests need no JSON.

import targetsJson from "./data/kalrez_ch_targets.json";
import articlesJson from "./data/kalrez_articles.json";
import type { KzArticles, KzTarget } from "./kalrez";

export const KZ_TARGETS: KzTarget[] = (targetsJson as { items: KzTarget[] }).items;
export const KZ_META = (targetsJson as { meta: Record<string, unknown> }).meta;
export const KZ_ARTICLES = articlesJson as KzArticles;

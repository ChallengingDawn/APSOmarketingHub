// THE ONE LIST OF SEO PAGES.
//
// There used to be two: a row of tabs inside the cockpit, and the hub sidebar's
// SEO group, each written out by hand. They drifted, as two hand-written copies
// of the same list always do, and the result was genuinely misleading — the tab
// marked "Performance" pointed at /seo, which rendered the Work queue, while
// the sidebar called that same page "What to do next". Three names for one
// page, and a fourth tab, "Work queue", pointing at a route that did not exist
// and so answered 404.
//
// Both now read this array. They cannot disagree, because there is nothing to
// disagree with.

export type SeoRouteId =
  | "overview"
  | "work-queue"
  | "performance"
  | "quick-wins"
  | "cannibalisation"
  | "decay"
  | "impact";

export type SeoNavEntry = {
  id: SeoRouteId;
  href: string;
  /** The ONE name this page has. Tabs, sidebar and page heading all use it. */
  label: string;
  /** What it answers, in a sentence. Shown on the overview and on hover. */
  blurb: string;
};

/**
 * Order is the order of work, not alphabetical: where you land, what to do,
 * then the numbers behind it, then the three analyses that feed the queue,
 * then the check that it worked.
 */
export const SEO_NAV: SeoNavEntry[] = [
  {
    id: "overview",
    href: "/seo",
    label: "Overview",
    blurb: "How the site is doing in Google Search, and where the work is.",
  },
  {
    id: "work-queue",
    href: "/seo/work-queue",
    label: "What to do next",
    blurb: "Every finding from the three analyses, merged and ranked into one list.",
  },
  {
    id: "performance",
    href: "/seo/performance",
    label: "Search performance",
    blurb: "Clicks, impressions, CTR and average position — the numbers themselves.",
  },
  {
    id: "quick-wins",
    href: "/seo/quick-wins",
    label: "Quick wins",
    blurb: "Queries already close to page one, where a small push pays.",
  },
  {
    id: "cannibalisation",
    href: "/seo/cannibalisation",
    label: "Cannibalisation",
    blurb: "Queries where two of your own URLs compete and both rank worse.",
  },
  {
    id: "decay",
    href: "/seo/decay",
    label: "Decay",
    blurb: "Pages that used to earn clicks and are losing them.",
  },
  {
    id: "impact",
    href: "/seo/impact",
    label: "Did it work",
    blurb: "What changed on the pages you acted on, 28 days later.",
  },
];

export const SEO_BY_ID: Record<SeoRouteId, SeoNavEntry> = Object.fromEntries(
  SEO_NAV.map((e) => [e.id, e]),
) as Record<SeoRouteId, SeoNavEntry>;

/**
 * A count beside an entry means "this many findings are waiting there". `null`
 * means not known yet, or the analysis could not run — shown as nothing rather
 * than as a zero, because a zero would be a claim.
 */
export type NavCounts = Partial<Record<SeoRouteId, number | null>>;

/** Longest-prefix match, so /seo never lights up for every page beneath it. */
export function isSeoActive(pathname: string, href: string): boolean {
  if (href === "/seo") return pathname === "/seo" || pathname === "/seo/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

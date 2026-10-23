// The 3D Gateway's counts - pure pieces (no database, no fetch) so they can be tested.

export type Count = { day: string; source: string; locale: string | null; kind: string; n: number };

/** Where a 3D request came from, as the 3D files page names it. */
// 23.10.2026 (SARCLA: "for the 4,000 downloads I want to know from where they were triggered - 3D page,
// search bar, PDP, mail to the customer"): the gateway splits "other" into the search bar, e-mails, direct
// clicks (a browser with no referer: Outlook, a pasted link) and robots. Order = the order of the bars.
export const SOURCE_LABEL: Record<string, string> = {
  catalogue: "3D catalogue page",
  "product-page": "Product page (3D button)",
  "search-bar": "Search bar (3D viewer)",
  mail: "E-mail to the customer",
  direct: "Direct link (Outlook, pasted link)",
  "hubspot-card": "HubSpot card",
  hub: "This hub (lookups, service check)",
  bot: "Robots (search engines, scripts)",
  other: "Other / not known",
};

/**
 * Until this day the search bar's server called the 3D Gateway with no marker, so its data-sheet checks and
 * downloads landed in "other" (src=search since 23.10.2026, 16:23). SARCLA, 23.10.2026: "give all this to the
 * search bar" - the hub shows the "other" of the days before it as the search bar.
 */
export const SEARCH_BAR_TAGGED_FROM = "2026-10-24";

/** What was asked for, as the page names it. */
export const KIND_LABEL: Record<string, string> = {
  aplink: "AP-Link calls",
  check: "Availability checks",
  download: "Downloads",
  view: "3D previews (live view)",
  search: "Searches",
  page: "Catalogue opened",
  script: "Product-page button loaded",
  request: "Form requests",
};

/** Pure: what to add to the hub's totals, given the counters seen last time (same boot) and now. */
export function deltas(prev: { bootId: string; counts: Record<string, number> } | null, bootId: string, now: Count[]): { add: Count[]; seen: Record<string, number> } {
  const base = prev && prev.bootId === bootId ? prev.counts : {};
  const seen: Record<string, number> = {};
  const add: Count[] = [];
  for (const c of now) {
    const k = `${c.day}|${c.source}|${c.locale ?? ""}|${c.kind}`;
    seen[k] = c.n;
    const d = c.n - (base[k] ?? 0);
    if (d > 0) add.push({ ...c, n: d });
  }
  return { add, seen };
}

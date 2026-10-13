// The 3D Gateway's counts - pure pieces (no database, no fetch) so they can be tested.

export type Count = { day: string; source: string; locale: string | null; kind: string; n: number };

/** Where a 3D request came from, as the 3D files page names it. */
export const SOURCE_LABEL: Record<string, string> = {
  catalogue: "3D catalogue page",
  "product-page": "Product page (3D button)",
  "hubspot-card": "HubSpot card",
  other: "Other / direct",
};

/** What was asked for, as the page names it. */
export const KIND_LABEL: Record<string, string> = {
  aplink: "AP-Link calls",
  check: "Availability checks",
  download: "Downloads",
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

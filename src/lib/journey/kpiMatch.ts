// BINDING A KPI CARD TO A FIGURE.
//
// Deliberately free of any server import. The board is a client component and it
// needs this matcher; pulling it out of metrics.ts would drag GA4, googleapis and
// node:crypto into the browser bundle and fail the build — which is exactly what
// happened the first time.

/** A KPI the business asked for, answered with a live figure where one exists. */
export type KpiFigure = {
  key: string;
  label: string;
  value: number | null;
  /** Already formatted with its unit, because a ratio and a count do not read alike. */
  display: string;
  source: string;
  note?: string;
};

/**
 * The cards come from a workbook, so they are prose, not keys — "Traffic by
 * acquisition channel (Nb Sessions)", "Bounce rate", "Cart abandonment rate". A
 * card matches when every word of a rule appears in it. Nothing matches loosely:
 * an unbound card says so, which is the honest answer and the thing to fix,
 * rather than a number that merely happens to be nearby.
 */
const KPI_RULES: { key: string; needs: string[][] }[] = [
  { key: "sessions_by_channel", needs: [["traffic", "channel", "session"], ["session", "acquisition", "channel"]] },
  { key: "organic_traffic", needs: [["organic", "traffic"]] },
  { key: "new_visitors", needs: [["new", "visitor"]] },
  { key: "bounce_rate", needs: [["bounce"]] },
  { key: "engaged_share", needs: [["ctr", "channel"]] },
  { key: "product_depth", needs: [["product", "page", "depth"], ["product", "pages", "viewed"]] },
  { key: "checkout_conversion", needs: [["checkout", "conversion"]] },
  { key: "cart_abandonment", needs: [["cart", "abandon"]] },
  { key: "purchase_conversion", needs: [["purchase", "conversion"]] },
  { key: "first_orders", needs: [["first", "purchase", "rate"], ["registrants", "first order"]] },
  // "Retention rate" and "repeat order rate" stay deliberately unbound. The ERP
  // gives us reactivations — companies we had LOST and won back — which is the
  // opposite of retention. Showing one under the other's label would be worse
  // than the empty card that tells the truth.
];

export function matchKpi(text: string, kpis: KpiFigure[]): KpiFigure | null {
  const hay = text.toLowerCase();
  for (const rule of KPI_RULES) {
    if (rule.needs.some((words) => words.every((w) => hay.includes(w)))) {
      return kpis.find((k) => k.key === rule.key) ?? null;
    }
  }
  return null;
}

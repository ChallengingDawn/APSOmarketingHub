// RETURN ON AD SPEND BY CHANNEL (SARCLA 18.10: "ROAS on SEA different channels + SEO") - pure.
// Revenue is GA4's (the order's session channel, last click; visitors who accepted statistics
// cookies only, so a floor), cost the ad platforms' own: Google Ads by network through GA4's
// Ads link, Microsoft Ads from the account's script. Both in euros. SEO has revenue but no ad
// cost: its row shows the revenue and no ROAS.

/** "YYYY-MM" -> channel -> [revenue €, orders, cost € | null] */
export type RoasMonths = Record<string, Record<string, [number, number, number | null]>>;
export type RoasRow = {
  key: string; label: string; indent: boolean;
  revenue: number; pyRevenue: number; orders: number; pyOrders: number;
  cost: number | null; pyCost: number | null;
  roas: number | null; pyRoas: number | null;
};

/** The channels in the table's order; a network row sits under its platform. */
export const ROAS_CHANNELS: { key: string; label: string; indent?: boolean; parts?: string[] }[] = [
  { key: "google", label: "Google Ads", parts: ["Google search", "Cross-network", "Google owned channels", "Search partners"] },
  { key: "Google search", label: "Google Search", indent: true },
  { key: "Cross-network", label: "Performance Max (all networks)", indent: true },
  { key: "Google owned channels", label: "YouTube, Gmail and Discover", indent: true },
  { key: "Search partners", label: "Search partners", indent: true },
  { key: "microsoft", label: "Microsoft Ads" },
  { key: "seo", label: "SEO (organic search)" },
];

/** The table over the months `months` (0-11) of `year` against the same months a year earlier. */
export function roasRows(data: RoasMonths, year: number, months: number[]): RoasRow[] {
  const ym = (y: number, i: number) => `${y}-${String(i + 1).padStart(2, "0")}`;
  const sum = (y: number, keys: string[]) => {
    let rev = 0, ord = 0, cost: number | null = 0;
    for (const i of months) {
      for (const k of keys) {
        const c = data[ym(y, i)]?.[k];
        if (!c) continue;
        rev += c[0]; ord += c[1];
        cost = cost == null || c[2] == null ? null : cost + c[2];
      }
    }
    return { rev, ord, cost };
  };
  return ROAS_CHANNELS.map((ch) => {
    const keys = ch.parts ?? [ch.key];
    const cy = sum(year, keys), py = sum(year - 1, keys);
    const seo = ch.key === "seo";
    const cost = seo ? null : cy.cost, pyCost = seo ? null : py.cost;
    return {
      key: ch.key, label: ch.label, indent: !!ch.indent,
      revenue: cy.rev, pyRevenue: py.rev, orders: cy.ord, pyOrders: py.ord, cost, pyCost,
      roas: cost ? cy.rev / cost : null, pyRoas: pyCost ? py.rev / pyCost : null,
    };
  });
}

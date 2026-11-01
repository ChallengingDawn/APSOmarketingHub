// PRODUCTS REPORTS > VIEWS AGAINST ORDERS - the read (the rules are in viewsOrders.ts). Nothing new is asked of GA4 or HubSpot:
// the Engage read (src/lib/marketingKpis/engage.ts - GA4's product pages viewed and articles bought per month, Products &
// Pricing's profit centre of each, read every six hours) and Articles CY/LY's report (each article's main group, sub group
// and product from Products & Pricing, built every night) are taken as they are kept.

import { engageData } from "@/lib/marketingKpis/engage";
import { loadReport } from "@/lib/integrations/articleReport";
import type { SlowState } from "@/lib/integrations/slowReport";
import type { EngageData } from "@/lib/marketingKpis/engageCube";
import { placesOf, type Places } from "./viewsOrders";

let placesKept: { generated: string; places: Places } | null = null;

/** Each product's main group and sub group, from the latest Articles CY/LY report with the hierarchy - none before one is built. */
export async function productPlaces(): Promise<{ places: Places; generated: string | null }> {
  const report = await loadReport().catch(() => null);
  if (!report?.hierarchy) return { places: {}, generated: null };
  if (placesKept?.generated !== report.generated) placesKept = { generated: report.generated, places: placesOf(report.rows) };
  return { places: placesKept.places, generated: report.generated };
}

/** The Engage read as it is kept (it starts a new one when it is older than six hours - Engage's own rule). */
export const viewsSource = (): Promise<SlowState<EngageData>> => engageData();

"use client";
// A KPI IN THE NUTSHELL, IN THE FORMAT IT WAS PUSHED (SARCLA 19.10: "we should have in Visit and
// organic traffic the same dashboard that we push into the nutshell, even the small one, then we
// decide which format to push"): the full card exactly as on its page, or the small tile's graph -
// the page's graph at tile size. Visit and Reach for now; null = none, the tile draws its months.

import type { LiveKpis } from "@/lib/marketingKpis/live";
import type { VisitData } from "@/lib/marketingKpis/visitCube";
import type { KpiView } from "./data";
import { VisitFullCard } from "./Visit";
import { ReachFullCard, ReachTileChart } from "./Reach";
import { VisitTileChart } from "./VisitCompact";

/** The KPI's card as on its page - for a placement whose format is "card". */
export function fullCardFor(page: string, kpiId: string, actions?: React.ReactNode): React.ReactNode | null {
  if (page === "visit") return <VisitFullCard kpiId={kpiId} actions={actions} />;
  if (page === "reach") return <ReachFullCard kpiId={kpiId} actions={actions} />;
  return null;
}

/** The KPI's page graph at tile size - for a tile; null = its months. */
export function tileChartFor(page: string, kpiId: string, views: Record<string, KpiView>, visit: VisitData | null, live: LiveKpis | undefined, year: number): React.ReactNode {
  if (page === "visit") return VisitTileChart({ id: kpiId, views, d: visit, year });
  if (page === "reach") return ReachTileChart({ id: kpiId, live });
  return null;
}

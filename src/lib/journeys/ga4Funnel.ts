// Website > Journeys > Funnel: Google Analytics' own funnel report (Data API v1alpha, runFunnelReport) - the visitors
// who did the steps IN THIS ORDER, which page-to-page steps chained can only estimate. The steps are the person's own
// (src/lib/journeys/model.ts ga4StepExpr: a kind of page as the addresses of that kind, the shop's cart, check-out and
// order events besides; one page as its address), broken down by device. It is an alpha API: when the property or the
// API refuses it, the page keeps the funnel chained from the steps and says why GA4's own is missing.
// It counts people (activeUsers), not visits - the page says "visitors".

import { googleFetchJson } from "@/lib/integrations/google";
import { ga4PropertyId } from "@/lib/integrations/status";
import { GA4_SCOPE } from "@/lib/integrations/ga4";
import { readFunnelTable, type FunnelExpr } from "./model";

const ALPHA = "https://analyticsdata.googleapis.com/v1alpha";

type FunnelResponse = {
  funnelTable?: {
    dimensionHeaders?: { name?: string }[];
    metricHeaders?: { name?: string }[];
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  };
};

/** The visitors at each step, in the order asked - in all and by `breakdown` (deviceCategory). */
export async function fetchFunnelReport(params: {
  from: string; to: string;
  steps: { name: string; filterExpression: FunnelExpr }[];
  breakdown?: string | null;
  signal?: AbortSignal;
}): Promise<{ all: (number | null)[]; by: Record<string, (number | null)[]> }> {
  const res = await googleFetchJson<FunnelResponse>({
    url: `${ALPHA}/properties/${encodeURIComponent(ga4PropertyId())}:runFunnelReport`,
    scope: GA4_SCOPE,
    label: "GA4 funnel",
    method: "POST",
    body: {
      dateRanges: [{ startDate: params.from, endDate: params.to }],
      funnel: { isOpenFunnel: false, steps: params.steps },
      ...(params.breakdown ? { funnelBreakdown: { breakdownDimension: { name: params.breakdown }, limit: "6" } } : {}),
    },
    signal: params.signal,
  });
  const t = res.funnelTable;
  const users = Math.max(0, (t?.metricHeaders ?? []).findIndex((h) => h.name === "activeUsers"));
  const dims = (t?.dimensionHeaders ?? []).map((h) => h.name ?? "");
  const byAt = params.breakdown ? dims.indexOf(params.breakdown) : -1;
  const rows = (t?.rows ?? []).map((row) => {
    const raw = row.metricValues?.[users]?.value;
    const n = raw === undefined || raw === "" ? null : Number(raw);
    return {
      // the step's name comes back numbered: "1. Way in"
      step: row.dimensionValues?.[0]?.value ?? "",
      by: byAt > 0 ? row.dimensionValues?.[byAt]?.value ?? null : null,
      users: n !== null && Number.isFinite(n) ? n : null,
    };
  });
  const out = readFunnelTable(rows, params.steps.length);
  if (out.all.every((x) => x === null)) throw new Error("GA4 funnel: the answer had no steps.");
  return out;
}

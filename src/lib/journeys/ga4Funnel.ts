// Website > Journeys > Funnel: Google Analytics' own funnel report (Data API v1alpha, runFunnelReport) - the visitors
// who did the shop's steps IN THIS ORDER, which a count of sessions per event cannot say. It is an alpha API: when the
// property or the API refuses it, the page keeps the sessions per event and says why the ordered one is missing.
// It counts people (activeUsers), not visits - the page says "visitors".

import { googleFetchJson } from "@/lib/integrations/google";
import { ga4PropertyId } from "@/lib/integrations/status";
import { GA4_SCOPE } from "@/lib/integrations/ga4";

const ALPHA = "https://analyticsdata.googleapis.com/v1alpha";

type FunnelResponse = {
  funnelTable?: {
    dimensionHeaders?: { name?: string }[];
    metricHeaders?: { name?: string }[];
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  };
};

/** The visitors at each step, in the order asked; a step the answer does not name stays null. */
export async function fetchOrderedFunnel(params: {
  from: string; to: string; events: string[];
  /** a store view: every step on its pages ("/de-CH/") */
  pathPrefix?: string | null;
  signal?: AbortSignal;
}): Promise<{ event: string; n: number | null }[]> {
  const step = (event: string) => {
    const ev = { funnelEventFilter: { eventName: event } };
    return {
      name: event,
      filterExpression: params.pathPrefix
        ? { andGroup: { expressions: [ev, { funnelFieldFilter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: params.pathPrefix } } }] } }
        : ev,
    };
  };
  const res = await googleFetchJson<FunnelResponse>({
    url: `${ALPHA}/properties/${encodeURIComponent(ga4PropertyId())}:runFunnelReport`,
    scope: GA4_SCOPE,
    label: "GA4 funnel",
    method: "POST",
    body: {
      dateRanges: [{ startDate: params.from, endDate: params.to }],
      funnel: { isOpenFunnel: false, steps: params.events.map(step) },
    },
    signal: params.signal,
  });
  const t = res.funnelTable;
  const users = Math.max(0, (t?.metricHeaders ?? []).findIndex((h) => h.name === "activeUsers"));
  const out = params.events.map((event) => ({ event, n: null as number | null }));
  for (const row of t?.rows ?? []) {
    // the step's name comes back numbered: "1. view_item"; a breakdown would add rows of its own - none is asked
    const m = /^(\d+)\.\s*(.*)$/.exec(row.dimensionValues?.[0]?.value ?? "");
    if (!m) continue;
    const i = Number(m[1]) - 1;
    const raw = row.metricValues?.[users]?.value;
    const n = raw === undefined || raw === "" ? null : Number(raw);
    if (out[i] && out[i].n === null && Number.isFinite(n)) out[i].n = n;
  }
  if (out.every((x) => x.n === null)) throw new Error("GA4 funnel: the answer had no steps.");
  return out;
}

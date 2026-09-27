// SALES POTENTIAL IN TICKETS.
//
// Every ticket carries a potential value, and the nightly load writes one row
// per ticket per day into the KPI object under `sales_funnel`, tagged with its
// pipeline — ESO, TSA, BO. This reads that: how many tickets were raised and
// closed in the window, how much potential they carried, and how much was won.
//
// ── TWO THINGS THIS DELIBERATELY DOES NOT DO ────────────────────────────────
// It does not subtract won from raised and call the difference "lost". They are
// two flows through the same window: a ticket raised in July may be won in
// October, and a ticket won in July was probably raised in May. The difference
// between them is not a cohort and naming it "lost" would be the same mistake
// as dividing two lifecycle stages.
//
// And it never reports a partial scan as a figure. A quarter holds around 10,000
// ticket rows, which is HubSpot's hard paging ceiling, so the sums are read
// month by month and a month that cannot be finished comes back null with its
// reason attached — a truncated sum looks exactly like a real decline.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { KPI_OBJECT } from "@/lib/integrations/hubspotKpi";
import { reportProgress } from "@/lib/integrations/slowReport";

export type PipelinePotential = {
  pipeline: string;
  ticketsRaised: number | null;
  ticketsClosed: number | null;
  potentialRaised: number | null;
  potentialWon: number | null;
  /** Set when a sum could not be completed, instead of a wrong number. */
  incomplete?: string;
};

export type SalesPotential = {
  from: string;
  to: string;
  pipelines: PipelinePotential[];
  /** Potential sitting in open tickets, as of the last snapshot that carries it. */
  open: { pipeline: string; value: number }[];
  openAsOf: string | null;
  generatedAt: string;
};

const dayMs = (day: string) => String(Date.parse(`${day}T00:00:00Z`));
const PAGE = 200;
/** 50 pages x 200 = 10,000, which is HubSpot's own ceiling. */
const MAX_PAGES = 50;

type SearchPage = {
  total?: number;
  results?: { properties?: Record<string, unknown> }[];
  paging?: { next?: { after?: string } };
};

const search = (body: Record<string, unknown>, signal?: AbortSignal) =>
  hubspotFetchJson<SearchPage>({ path: `/crm/v3/objects/${KPI_OBJECT}/search`, method: "POST", body, signal });

const between = (from: string, to: string) => ({
  propertyName: "snapshot_date",
  operator: "BETWEEN",
  value: dayMs(from),
  highValue: dayMs(to),
});

/** An exact count without reading a single row: every ticket row carries 1. */
async function countRows(metric: string, pipeline: string, from: string, to: string, signal?: AbortSignal) {
  const res = await search(
    {
      filterGroups: [{ filters: [
        { propertyName: "metric_name", operator: "EQ", value: metric },
        { propertyName: "dimension_pipeline", operator: "EQ", value: pipeline },
        between(from, to),
      ] }],
      limit: 1,
      properties: [],
    },
    signal,
  );
  return typeof res.total === "number" ? res.total : null;
}

/** Sum one metric across the window, by pipeline. Null where it could not finish. */
async function sumByPipeline(
  metric: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<{ totals: Map<string, number>; incomplete: string | null }> {
  const totals = new Map<string, number>();
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await search(
      {
        filterGroups: [{ filters: [
          { propertyName: "metric_name", operator: "EQ", value: metric },
          between(from, to),
        ] }],
        properties: ["metric_value", "dimension_pipeline"],
        limit: PAGE,
        ...(after ? { after } : {}),
      },
      signal,
    );
    for (const row of res.results ?? []) {
      const pipeline = typeof row.properties?.dimension_pipeline === "string" ? row.properties.dimension_pipeline : "—";
      const value = Number(row.properties?.metric_value);
      if (!Number.isFinite(value)) continue;
      totals.set(pipeline, (totals.get(pipeline) ?? 0) + value);
    }
    after = res.paging?.next?.after;
    if (!after) return { totals, incomplete: null };
    if (page % 5 === 0) reportProgress(`potential:${from}:${to}`, `${metric}: ${page * PAGE} rows read`);
  }
  return {
    totals,
    incomplete: `more than ${MAX_PAGES * PAGE} rows in this window — HubSpot stops paging there, so the sum would be short. Narrow the window.`,
  };
}

export async function fetchSalesPotential(params: {
  from: string;
  to: string;
  signal?: AbortSignal;
}): Promise<SalesPotential> {
  const { from, to, signal } = params;

  reportProgress(`potential:${from}:${to}`, "summing potential raised");
  const raised = await sumByPipeline("potential_created_sum", from, to, signal);
  reportProgress(`potential:${from}:${to}`, "summing potential won");
  const won = await sumByPipeline("potential_won_sum", from, to, signal);

  // The pipelines come from the rows just read, not from the property's option
  // list: the enumeration carries every pipeline the portal has ever had, and
  // each one costs two throttled counts whether or not it has a single ticket
  // in this window. This is the difference between ten calls and fifty.
  const pipelines = [...new Set([...raised.totals.keys(), ...won.totals.keys()])].filter((p) => p !== "—");

  const rows: PipelinePotential[] = [];
  for (const pipeline of pipelines) {
    reportProgress(`potential:${from}:${to}`, `counting tickets in ${pipeline}`);
    const ticketsRaised = await countRows("tickets_created_count", pipeline, from, to, signal);
    const ticketsClosed = await countRows("tickets_closed_count", pipeline, from, to, signal);
    if (!ticketsRaised && !ticketsClosed && !raised.totals.get(pipeline)) continue;
    rows.push({
      pipeline,
      ticketsRaised,
      ticketsClosed,
      potentialRaised: raised.incomplete ? null : raised.totals.get(pipeline) ?? 0,
      potentialWon: won.incomplete ? null : won.totals.get(pipeline) ?? 0,
      incomplete: raised.incomplete ?? won.incomplete ?? undefined,
    });
  }

  // What is still open, from the most recent snapshot that carries it. That
  // snapshot is dated on screen, because it is not necessarily last night's.
  const openRes = await search(
    {
      filterGroups: [{ filters: [{ propertyName: "metric_name", operator: "EQ", value: "potential_open_snapshot" }] }],
      properties: ["metric_value", "dimension_pipeline", "snapshot_date"],
      sorts: [{ propertyName: "snapshot_date", direction: "DESCENDING" }],
      limit: 100,
    },
    signal,
  );
  const openRows = openRes.results ?? [];
  const latest = openRows[0]?.properties?.snapshot_date;
  const openAsOf = typeof latest === "string" ? latest.slice(0, 10) : null;
  const openTotals = new Map<string, number>();
  for (const row of openRows) {
    const stamp = typeof row.properties?.snapshot_date === "string" ? row.properties.snapshot_date.slice(0, 10) : null;
    if (!openAsOf || stamp !== openAsOf) continue;
    const pipeline = typeof row.properties?.dimension_pipeline === "string" ? row.properties.dimension_pipeline : "—";
    const value = Number(row.properties?.metric_value);
    if (Number.isFinite(value)) openTotals.set(pipeline, (openTotals.get(pipeline) ?? 0) + value);
  }

  return {
    from,
    to,
    pipelines: rows.sort((a, b) => (b.potentialRaised ?? 0) - (a.potentialRaised ?? 0)),
    open: [...openTotals.entries()].map(([pipeline, value]) => ({ pipeline, value })).sort((a, b) => b.value - a.value),
    openAsOf,
    generatedAt: new Date().toISOString(),
  };
}

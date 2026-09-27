// WHAT THE JOURNEY IS WORTH.
//
// The board measures behaviour — visits, product views, logins, carts. None of
// that says whether the journey is working, because a journey that ends in more
// visits and fewer customers is a journey that is failing. This module brings in
// the money and the customer counts from the ERP file, which reaches HubSpot's
// KPI object every morning.
//
// It does NOT follow the hub's reporting window, and that is deliberate: the
// series are monthly, so they cannot answer "the last 28 days". Every figure
// therefore names the months it covers, and the screen prints that label next to
// it. A figure whose window is unstated is a figure somebody will misread.

import {
  KPI_SERIES,
  fetchKpiSeries,
  likeForLike,
  likeForLikeBy,
  type LikeForLike,
} from "@/lib/integrations/hubspotKpi";

export type BusinessUnit = "eur" | "companies" | "ratio";

export type BusinessFigure = {
  key: string;
  label: string;
  unit: BusinessUnit;
  value: number | null;
  priorValue: number | null;
  change: number | null;
  /** What the figure means in one line, for the reader who did not build it. */
  note: string;
};

export type BusinessSlice = {
  key: string;
  value: number | null;
  priorValue: number | null;
  change: number | null;
};

export type JourneyBusiness = {
  year: number | null;
  priorYear: number | null;
  /** "January–September" — the months both years are counted over. */
  monthsLabel: string;
  headline: BusinessFigure[];
  byCountry: BusinessSlice[];
  byFamily: BusinessSlice[];
  byPriority: BusinessSlice[];
  /** The one sentence a reader should leave with. */
  verdict: string;
  source: string;
  generatedAt: string;
};

const slice = (rows: (LikeForLike & { key: string })[]): BusinessSlice[] =>
  rows.map((r) => ({ key: r.key, value: r.value, priorValue: r.priorValue, change: r.change }));

const ratio = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b !== 0 ? a / b : null;

export async function fetchJourneyBusiness(signal?: AbortSignal): Promise<JourneyBusiness> {
  // Five series, read one after another: they all go through the CRM search
  // throttle, so firing them together only earns 429s.
  const revenueRows = await fetchKpiSeries(KPI_SERIES.revenueByCountry, signal);
  const intakeRows = await fetchKpiSeries(KPI_SERIES.intakeByCountry, signal);
  const familyRows = await fetchKpiSeries(KPI_SERIES.revenueByFamily, signal);
  const priorityRows = await fetchKpiSeries(KPI_SERIES.revenueByPriority, signal);
  const newRows = await fetchKpiSeries(KPI_SERIES.newCustomers, signal);
  const backRows = await fetchKpiSeries(KPI_SERIES.reactivated, signal);

  const revenue = likeForLike(revenueRows);
  const intake = likeForLike(intakeRows);
  const firstOrders = likeForLike(newRows);
  const cameBack = likeForLike(backRows);

  // Book-to-bill: what was ordered against what was invoiced. Above 100% the
  // order book is filling; below it, we are invoicing a book nobody refilled.
  const bookToBill = ratio(intake.value, revenue.value);
  const priorBookToBill = ratio(intake.priorValue, revenue.priorValue);

  const headline: BusinessFigure[] = [
    {
      key: "erp_revenue",
      label: "Revenue",
      unit: "eur",
      value: revenue.value,
      priorValue: revenue.priorValue,
      change: revenue.change,
      note: "Invoiced, all channels — the shop, the phone and the ERP together.",
    },
    {
      key: "erp_order_intake",
      label: "Order intake",
      unit: "eur",
      value: intake.value,
      priorValue: intake.priorValue,
      change: intake.change,
      note: "What customers ordered, net of cancellations. It leads revenue.",
    },
    {
      key: "erp_book_to_bill",
      label: "Book-to-bill",
      unit: "ratio",
      value: bookToBill,
      priorValue: priorBookToBill,
      change: bookToBill != null && priorBookToBill ? bookToBill / priorBookToBill - 1 : null,
      note: "Order intake over revenue. Under 100% we are invoicing the book faster than we fill it.",
    },
    {
      key: "erp_new_customers",
      label: "New customers",
      unit: "companies",
      value: firstOrders.value,
      priorValue: firstOrders.priorValue,
      change: firstOrders.change,
      note: "Companies that placed their first ever order — the journey's whole point, from step 1 to step 9.",
    },
    {
      key: "erp_reactivated",
      label: "Came back",
      unit: "companies",
      value: cameBack.value,
      priorValue: cameBack.priorValue,
      change: cameBack.change,
      note: "Companies that ordered again after thirteen months or more without an order.",
    },
  ];

  // The verdict is assembled from the figures, never written ahead of them: if
  // acquisition turns positive next month this sentence turns with it.
  const pct = (x: number | null) => (x == null ? "—" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`);
  let verdict: string;
  if (revenue.value == null || firstOrders.value == null) {
    verdict = "The ERP series has no month both years cover, so nothing can be compared yet.";
  } else if ((revenue.change ?? 0) > 0 && (firstOrders.change ?? 0) < 0) {
    verdict =
      `Revenue is ${pct(revenue.change)} and order intake ${pct(intake.change)}, but first orders are ` +
      `${pct(firstOrders.change)}: the growth is coming from customers we already had, not from new ones. ` +
      `That is a verdict on the early stages of this journey, not on the late ones.`;
  } else if ((revenue.change ?? 0) < 0 && (firstOrders.change ?? 0) > 0) {
    verdict =
      `First orders are ${pct(firstOrders.change)} while revenue is ${pct(revenue.change)}: the journey is ` +
      `bringing customers in, and they are not yet worth what the ones we lost were.`;
  } else {
    verdict =
      `Revenue ${pct(revenue.change)}, order intake ${pct(intake.change)}, first orders ` +
      `${pct(firstOrders.change)} — the journey and the money are moving the same way.`;
  }

  return {
    year: revenue.year,
    priorYear: revenue.priorYear,
    monthsLabel: revenue.monthsLabel,
    headline,
    byCountry: slice(likeForLikeBy(revenueRows, "country")).slice(0, 10),
    byFamily: slice(likeForLikeBy(familyRows, "family")),
    byPriority: slice(likeForLikeBy(priorityRows, "priority")),
    verdict,
    source: "ERP revenue file, loaded into the HubSpot KPI object",
    generatedAt: new Date().toISOString(),
  };
}

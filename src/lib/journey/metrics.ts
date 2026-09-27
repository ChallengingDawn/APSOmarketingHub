// NUMBERS FOR THE JOURNEY.
//
// The workbook says what each step of the journey is; this says how many people
// got that far, and how many of the previous step did not. Every figure names
// its source, and a step nothing can measure says so — an admitted gap is worth
// more than a plausible number, and this app is meant to survive a meeting.
//
// One window, four sources: GA4 for anything before the login, HubSpot for the
// account and the orders, the customer-type count for the repeat business, and
// the ERP series in HubSpot's KPI object for first orders and customers who came
// back. The ERP series is monthly, so it answers only for whole months inside
// the window — and says which ones, rather than quietly covering a different
// period from the step above it.

import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { countWhere } from "@/lib/integrations/hubspotCounts";
import { KPI_SERIES, fetchKpiSeries, monthsFullyInside, spellMonths, sumMonths } from "@/lib/integrations/hubspotKpi";
import { full } from "@/app/charts/format";
import type { KpiFigure } from "./kpiMatch";

export type StepMetric = {
  stepIndex: number;
  value: number | null;
  unit: string;
  source: string;
  note?: string;
  /** Why no number exists, when there is none. */
  gap?: string;
};

export type JourneyMetrics = {
  from: string;
  to: string;
  steps: StepMetric[];
  /** The measurable chain, in order, for the funnel chart. */
  funnel: { label: string; value: number | null; source: string }[];
  /** What the KPI cards can actually be answered with today. */
  kpis: KpiFigure[];
  generatedAt: string;
};

// The matcher and its type live in kpiMatch.ts, which imports nothing from the
// server: the board is a client component and needs it.
export type { KpiFigure } from "./kpiMatch";

const dayMs = (day: string) => String(Date.parse(`${day}T00:00:00Z`));

export async function fetchJourneyMetrics(params: { from: string; to: string; signal?: AbortSignal }): Promise<JourneyMetrics> {
  const { from, to } = params;

  // ── GA4: one call for the event counts, one for sessions, one for landings ──
  const events = await fetchGa4Report({ name: "eventTotals", from, to, signal: params.signal });
  const eventRow = (name: string) => events.rows.find((r) => r.keys[0] === name) ?? null;
  /** How many times it happened. */
  const eventCount = (name: string): number | null => eventRow(name)?.values[0] ?? null;
  /** In how many visits it happened — the only unit a funnel may use. */
  const eventSessions = (name: string): number | null => eventRow(name)?.values[1] ?? null;

  const totals = await fetchGa4Report({ name: "sessionTotals", from, to, signal: params.signal });
  const sessions = totals.rows[0]?.values[0] ?? null;

  const landings = await fetchGa4Report({ name: "landingSessions", from, to, signal: params.signal });
  // A locale root ("/de-CH/", "/fr-FR") is the homepage; anything deeper is not.
  const homeSessions = landings.rows
    .filter((r) => /^\/?[a-z]{2}-[A-Z]{2,3}\/?$|^\/$/.test(r.keys[0] ?? ""))
    .reduce((sum, r) => sum + (r.values[0] ?? 0), 0);

  // ── HubSpot: the account steps and the support step ──
  const accountFilters = [
    { propertyName: "eyemagine_customer_id", operator: "HAS_PROPERTY" },
    { propertyName: "createdate", operator: "GTE", value: dayMs(from) },
    { propertyName: "createdate", operator: "LT", value: dayMs(to) },
  ];
  const accountsCreated = await countWhere("contacts", accountFilters, params.signal);
  const accountsLinked = await countWhere(
    "contacts",
    [...accountFilters, { propertyName: "eyemagine_erp_customer_id", operator: "HAS_PROPERTY" }],
    params.signal,
  );
  const orders = await countWhere(
    "orders",
    [
      { propertyName: "order_order_date", operator: "GTE", value: dayMs(from) },
      { propertyName: "order_order_date", operator: "LT", value: dayMs(to) },
    ],
    params.signal,
  );

  // ── the ERP series: monthly, so whole months inside the window or nothing ──
  const wholeMonths = monthsFullyInside(from, to);
  let firstOrders: number | null = null;
  let cameBack: number | null = null;
  const monthsCovered = spellMonths(wholeMonths);
  if (wholeMonths.length > 0) {
    const newRows = await fetchKpiSeries(KPI_SERIES.newCustomers, params.signal);
    const backRows = await fetchKpiSeries(KPI_SERIES.reactivated, params.signal);
    firstOrders = sumMonths(newRows, wholeMonths);
    cameBack = sumMonths(backRows, wholeMonths);
  }

  const GA4 = "GA4 (property 307036030)";
  const HS = "HubSpot";
  const ERP = "ERP revenue file, via the HubSpot KPI object";
  /** Said once, because it is the reason these two figures do not match the rest. */
  const MONTHLY_GAP =
    "The ERP series is monthly and this window contains no whole month, so there is no honest figure for it. " +
    "Pick a window that covers a full month, or read the year-to-date band.";

  const steps: StepMetric[] = [
    { stepIndex: 1, value: sessions, unit: "sessions", source: GA4, note: "Everyone who arrived, whatever brought them." },
    { stepIndex: 2, value: homeSessions || null, unit: "sessions landing on a homepage", source: GA4, note: "Sessions whose first page is a locale root." },
    { stepIndex: 3, value: eventSessions("view_item"), unit: "visits that saw a product", source: GA4, note: `${full(eventCount("view_item"))} product views in total.` },
    { stepIndex: 4, value: accountsCreated, unit: "shop accounts created", source: HS, note: `GA4 counted ${eventCount("sign_up") ?? "—"} sign_up events in the same window.` },
    { stepIndex: 5, value: accountsLinked, unit: "of those linked to an ERP customer", source: HS, note: "Linking is what lets the account see its own prices." },
    { stepIndex: 6, value: eventSessions("login"), unit: "visits with a login", source: GA4, note: "A logged-in visit is the only one that sees real prices." },
    { stepIndex: 7, value: eventSessions("add_to_cart"), unit: "visits that added to the cart", source: GA4, note: `${full(eventSessions("begin_checkout"))} of those visits went on to start checkout.` },
    { stepIndex: 8, value: null, unit: "", source: "", gap: "Becoming an approved supplier happens in the customer's own procurement system. Nothing on our side sees it." },
    {
      stepIndex: 9,
      value: eventSessions("purchase"),
      unit: "visits that ended in a purchase",
      source: GA4,
      // The step says "make FIRST purchase", and a purchase visit is mostly a
      // repeat buyer. The count that answers the step is the ERP's first orders,
      // so it is stated here rather than swapped in — the column compares steps
      // to each other and they have to stay in one unit.
      note:
        `HubSpot recorded ${full(orders)} orders in the same window, web and offline — GA4 only sees the consented ones.` +
        (firstOrders != null ? ` Of those buyers, ${full(firstOrders)} companies placed their first ever order (${monthsCovered}, ERP).` : ""),
    },
    { stepIndex: 10, value: null, unit: "", source: "", gap: "Order acknowledgements are sent by the ERP; they are not events anything here can count." },
    { stepIndex: 11, value: null, unit: "", source: "", gap: "Support contacts are in HubSpot tickets but cannot yet be tied to an order, so a count would mislead." },
    { stepIndex: 12, value: null, unit: "", source: "", gap: "Delivery is in the ERP and the carrier's systems; no feed reaches this app." },
    { stepIndex: 13, value: null, unit: "", source: "", gap: "Nothing asks the customer whether the product performed. This is a survey, not a measurement." },
    {
      // "Order again" — and the ERP knows exactly who did, after a long silence.
      stepIndex: 14,
      value: cameBack,
      unit: cameBack != null ? `companies that came back after 13+ months (${monthsCovered})` : "",
      source: cameBack != null ? ERP : "",
      note: "Companies that kept buying within twelve months are counted on the SMEC targets page; this is the harder half — the ones that had stopped.",
      gap: cameBack != null ? undefined : MONTHLY_GAP,
    },
    { stepIndex: 15, value: null, unit: "", source: "", gap: "No referral or review mechanism exists on the shop." },
  ];

  // ── the KPI cards the business wrote, answered where GA4 can answer them ──
  const channels = await fetchGa4Report({ name: "acquisitionChannels", from, to, signal: params.signal });
  // sessions, newUsers, engagedSessions, engagementRate, keyEvents
  const chanSum = (col: number) => channels.rows.reduce((s, r) => s + (r.values[col] ?? 0), 0);
  const organic = channels.rows
    .filter((r) => /organic/i.test(r.keys[0] ?? ""))
    .reduce((s, r) => s + (r.values[0] ?? 0), 0);
  const chanSessions = chanSum(0) || null;
  const engaged = chanSum(2);
  const topChannels = [...channels.rows]
    .sort((a, b) => (b.values[0] ?? 0) - (a.values[0] ?? 0))
    .slice(0, 3)
    .map((r) => `${r.keys[0]} ${full(r.values[0] ?? 0)}`)
    .join(" · ");

  const pct = (x: number | null) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
  const ratio = (a: number | null, b: number | null) => (a != null && b ? a / b : null);
  const addToCart = eventSessions("add_to_cart");
  const checkout = eventSessions("begin_checkout");
  const purchased = eventSessions("purchase");
  const viewItemSessions = eventSessions("view_item");
  const viewItemCount = eventCount("view_item");

  const bounce = chanSessions ? 1 - engaged / chanSessions : null;
  const depth = ratio(viewItemCount, viewItemSessions);
  const kpis: KpiFigure[] = [
    { key: "sessions_by_channel", label: "Traffic by acquisition channel", value: chanSessions,
      display: full(chanSessions), source: GA4, note: topChannels || undefined },
    { key: "organic_traffic", label: "Organic traffic", value: organic || null,
      display: full(organic || null), source: GA4, note: "Sessions whose channel group is an organic one." },
    { key: "new_visitors", label: "New visitors", value: chanSum(1) || null,
      display: full(chanSum(1) || null), source: GA4 },
    { key: "bounce_rate", label: "Bounce rate", value: bounce, display: pct(bounce), source: GA4,
      note: "One minus the engaged share of sessions — GA4 has no bounce metric of its own." },
    { key: "engaged_share", label: "Engaged sessions per session", value: ratio(engaged, chanSessions),
      display: pct(ratio(engaged, chanSessions)), source: GA4,
      note: "Not a click-through rate: GA4 sees no impressions. A real CTR needs Search Console." },
    { key: "product_depth", label: "Product pages per visit that saw one", value: depth,
      display: depth == null ? "—" : depth.toFixed(1), source: GA4,
      note: `${full(viewItemCount)} product views across ${full(viewItemSessions)} visits.` },
    { key: "checkout_conversion", label: "Checkout conversion", value: ratio(purchased, checkout),
      display: pct(ratio(purchased, checkout)), source: GA4, note: "Purchases out of started checkouts." },
    { key: "cart_abandonment", label: "Cart abandonment", value: addToCart ? 1 - (purchased ?? 0) / addToCart : null,
      display: pct(addToCart ? 1 - (purchased ?? 0) / addToCart : null), source: GA4,
      note: "Visits that added to the cart and did not buy." },
    { key: "purchase_conversion", label: "Purchase conversion", value: ratio(purchased, sessions),
      display: pct(ratio(purchased, sessions)), source: GA4, note: "Purchases out of all sessions." },
    // The card asks for a RATE and we can only give the numerator: nothing links
    // a registrant to the order they eventually placed. The count is still the
    // most important number on this board, so it is shown, labelled as a count.
    { key: "first_orders", label: "First orders", value: firstOrders,
      display: full(firstOrders), source: firstOrders != null ? ERP : "",
      note: firstOrders != null
        ? `Companies placing their first ever order, ${monthsCovered}. A count, not a rate — no registrant is linked to the order they later placed.`
        : MONTHLY_GAP },
  ];

  // Every step is "visits in which it happened", so the percentages mean something.
  const funnel = [
    { label: "Arrived", value: sessions, source: GA4 },
    { label: "Saw a product", value: eventSessions("view_item"), source: GA4 },
    { label: "Added to cart", value: eventSessions("add_to_cart"), source: GA4 },
    { label: "Started checkout", value: eventSessions("begin_checkout"), source: GA4 },
    { label: "Bought", value: eventSessions("purchase"), source: GA4 },
  ];

  return { from, to, steps, funnel, kpis, generatedAt: new Date().toISOString() };
}

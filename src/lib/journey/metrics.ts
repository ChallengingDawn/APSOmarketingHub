// NUMBERS FOR THE JOURNEY.
//
// The workbook says what each step of the journey is; this says how many people
// got that far, and how many of the previous step did not. Every figure names
// its source, and a step nothing can measure says so — an admitted gap is worth
// more than a plausible number, and this app is meant to survive a meeting.
//
// One window, three sources: GA4 for anything before the login, HubSpot for the
// account and the orders, and the customer-type count for the repeat business.

import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { countWhere } from "@/lib/integrations/hubspotCounts";
import { full } from "@/app/charts/format";

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
  generatedAt: string;
};

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

  const GA4 = "GA4 (property 307036030)";
  const HS = "HubSpot";

  const steps: StepMetric[] = [
    { stepIndex: 1, value: sessions, unit: "sessions", source: GA4, note: "Everyone who arrived, whatever brought them." },
    { stepIndex: 2, value: homeSessions || null, unit: "sessions landing on a homepage", source: GA4, note: "Sessions whose first page is a locale root." },
    { stepIndex: 3, value: eventSessions("view_item"), unit: "visits that saw a product", source: GA4, note: `${full(eventCount("view_item"))} product views in total.` },
    { stepIndex: 4, value: accountsCreated, unit: "shop accounts created", source: HS, note: `GA4 counted ${eventCount("sign_up") ?? "—"} sign_up events in the same window.` },
    { stepIndex: 5, value: accountsLinked, unit: "of those linked to an ERP customer", source: HS, note: "Linking is what lets the account see its own prices." },
    { stepIndex: 6, value: eventSessions("login"), unit: "visits with a login", source: GA4, note: "A logged-in visit is the only one that sees real prices." },
    { stepIndex: 7, value: eventSessions("add_to_cart"), unit: "visits that added to the cart", source: GA4, note: `${full(eventSessions("begin_checkout"))} of those visits went on to start checkout.` },
    { stepIndex: 8, value: null, unit: "", source: "", gap: "Becoming an approved supplier happens in the customer's own procurement system. Nothing on our side sees it." },
    { stepIndex: 9, value: eventSessions("purchase"), unit: "visits that ended in a purchase", source: GA4, note: `HubSpot recorded ${full(orders)} orders in the same window, web and offline — GA4 only sees the consented ones.` },
    { stepIndex: 10, value: null, unit: "", source: "", gap: "Order acknowledgements are sent by the ERP; they are not events anything here can count." },
    { stepIndex: 11, value: null, unit: "", source: "", gap: "Support contacts are in HubSpot tickets but cannot yet be tied to an order, so a count would mislead." },
    { stepIndex: 12, value: null, unit: "", source: "", gap: "Delivery is in the ERP and the carrier's systems; no feed reaches this app." },
    { stepIndex: 13, value: null, unit: "", source: "", gap: "Nothing asks the customer whether the product performed. This is a survey, not a measurement." },
    { stepIndex: 14, value: null, unit: "", source: "", note: "Repeat business is counted properly on the SMEC targets page: companies that kept buying within twelve months.", gap: "Not wired into this screen yet." },
    { stepIndex: 15, value: null, unit: "", source: "", gap: "No referral or review mechanism exists on the shop." },
  ];

  // Every step is "visits in which it happened", so the percentages mean something.
  const funnel = [
    { label: "Arrived", value: sessions, source: GA4 },
    { label: "Saw a product", value: eventSessions("view_item"), source: GA4 },
    { label: "Added to cart", value: eventSessions("add_to_cart"), source: GA4 },
    { label: "Started checkout", value: eventSessions("begin_checkout"), source: GA4 },
    { label: "Bought", value: eventSessions("purchase"), source: GA4 },
  ];

  return { from, to, steps, funnel, generatedAt: new Date().toISOString() };
}

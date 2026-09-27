// KPIS FOR A USE CASE.
//
// A use case is an automation that acts on a population: leads who never
// registered, visitors who looked at a price and walked away, buyers who went
// quiet. Opening one should answer "how big is that population", and for most
// of them it can be — out of figures this application already reads.
//
// Like kpiMatch, this file imports nothing from the server: the board is a
// client component. And like kpiMatch, it matches on the words the business
// actually wrote, because the use cases came out of a workbook and will keep
// being typed by hand.

import { full } from "@/app/charts/format";
import type { JourneyMetrics } from "./metrics";
import type { JourneyBusiness } from "./business";

export type UseCaseFigure = {
  label: string;
  display: string;
  source: string;
  note: string;
};

const stepValue = (metrics: JourneyMetrics | null, index: number): number | null =>
  metrics?.steps.find((s) => s.stepIndex === index)?.value ?? null;

const minus = (a: number | null, b: number | null): number | null =>
  a == null ? null : Math.max(0, a - (b ?? 0));

/**
 * What can be counted for this use case today. An empty list is a legitimate
 * answer and the screen says so — better than a number that describes a
 * different population from the one the automation acts on.
 */
export function useCaseFigures(
  text: string,
  metrics: JourneyMetrics | null,
  business: JourneyBusiness | null,
): UseCaseFigure[] {
  const hay = text.toLowerCase();
  const out: UseCaseFigure[] = [];
  const window = metrics ? `${metrics.from} to ${metrics.to}` : "the window";

  // "Leads who are not yet registered" — an account exists but no ERP customer
  // is behind it, which is exactly step 4 minus step 5.
  if (/not yet regist|unregist|chat|form lead|registration/.test(hay)) {
    const created = stepValue(metrics, 4);
    const linked = stepValue(metrics, 5);
    out.push({
      label: "Accounts created but not linked to an ERP customer",
      display: full(minus(created, linked)),
      source: "HubSpot contacts",
      note: `${full(created)} shop accounts created ${window}, of which ${full(linked)} carry an ERP customer id. The rest cannot see their own prices yet.`,
    });
  }

  // "Checked prices and did not put the article in the cart."
  if (/cart|basket|panier/.test(hay)) {
    const sawProduct = stepValue(metrics, 3);
    const addedToCart = stepValue(metrics, 7);
    out.push({
      label: "Visits that saw a product and added nothing",
      display: full(minus(sawProduct, addedToCart)),
      source: "GA4 (property 307036030)",
      note: `${full(sawProduct)} visits opened a product page ${window} and ${full(addedToCart)} of them added one. The difference is the population this use case would act on.`,
    });
  }

  // "A purchaser who has not logged in for a while."
  if (/login|log in|logged/.test(hay)) {
    const logins = stepValue(metrics, 6);
    out.push({
      label: "Visits with a login",
      display: full(logins),
      source: "GA4",
      note: `Logged-in visits ${window}. Who stopped logging in needs the account list behind them, which this screen does not have yet.`,
    });
  }

  // "UC12 to be redone taking into account order intake."
  if (/order intake|\boi\b/.test(hay) && business) {
    const intake = business.headline.find((h) => h.key === "erp_order_intake");
    if (intake?.value != null) {
      out.push({
        label: "Order intake, like for like",
        display: `€${Math.round(intake.value).toLocaleString("en-US")}`,
        source: business.source,
        note: `${business.monthsLabel} ${business.year} against the same months of ${business.priorYear}. This is the measure the use case is being rebuilt around.`,
      });
    }
  }

  // Anything aimed at customers coming back has the cohort count behind it.
  if (/reactivat|win.?back|dormant|churn/.test(hay) && business) {
    const back = business.headline.find((h) => h.key === "erp_reactivated");
    if (back?.value != null) {
      out.push({
        label: "Companies that came back",
        display: full(back.value),
        source: business.source,
        note: `After thirteen months or more without an order, ${business.monthsLabel} ${business.year}.`,
      });
    }
  }

  return out;
}

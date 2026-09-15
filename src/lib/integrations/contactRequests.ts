// CONTACT REQUESTS — customers who wrote in through the Contact Us form on
// apsoparts.com, counted on HubSpot contacts. The form exists once per shop
// language and is named "<page title>: <LANG>_Customer Facing | Contact Us
// Form_2507"; the Returns page embeds the same form. HubSpot's searchable
// recent_conversion_* fields hold only each contact's LATEST form, so an
// automated form that follows (Magento order and cart summaries) hides an
// earlier request: every count here is a minimum. Checked against the form
// names on 15.09.2026: "Facing" matched only the twelve page variants of it.

import { countWhere, type Filter } from "./hubspotCounts";

export const FORM_LANGUAGES = ["DE", "FR", "EN", "IT", "PL", "NL"] as const;
export type FormLanguage = (typeof FORM_LANGUAGES)[number];

export type RequestBucket = { from: string; to: string; requests: number | null };

export type ContactRequests = {
  generatedAt: string;
  from: string;
  to: string;
  granularity: "week" | "month";
  total: number | null;
  byLanguage: { language: FormLanguage; requests: number | null }[];
  /** Oldest first; the first and last bucket are cut to the window. */
  buckets: RequestBucket[];
};

const DAY = 86_400_000;
/** Up to about three months the requests are counted per week, beyond that per month. */
export const WEEKLY_UP_TO_DAYS = 92;

const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function requestBuckets(from: string, to: string): { granularity: "week" | "month"; buckets: { from: string; to: string }[] } {
  const start = dayMs(from);
  const end = dayMs(to);
  const out: { from: string; to: string }[] = [];
  if (Math.round((end - start) / DAY) + 1 <= WEEKLY_UP_TO_DAYS) {
    for (let monday = start - ((new Date(start).getUTCDay() + 6) % 7) * DAY; monday <= end; monday += 7 * DAY) {
      out.push({ from: isoOf(Math.max(monday, start)), to: isoOf(Math.min(monday + 6 * DAY, end)) });
    }
    return { granularity: "week", buckets: out };
  }
  const s = new Date(start);
  for (let m = s.getUTCMonth(); Date.UTC(s.getUTCFullYear(), m, 1) <= end; m++) {
    const firstDay = Date.UTC(s.getUTCFullYear(), m, 1);
    const lastDay = Date.UTC(s.getUTCFullYear(), m + 1, 1) - DAY;
    out.push({ from: isoOf(Math.max(firstDay, start)), to: isoOf(Math.min(lastDay, end)) });
  }
  return { granularity: "month", buckets: out };
}

function customerForm(from: string, to: string): Filter[] {
  return [
    { propertyName: "recent_conversion_date", operator: "GTE", value: String(dayMs(from)) },
    { propertyName: "recent_conversion_date", operator: "LT", value: String(dayMs(to) + DAY) },
    { propertyName: "recent_conversion_event_name", operator: "CONTAINS_TOKEN", value: "Facing" },
    // Sandbox test clones of the form.
    { propertyName: "recent_conversion_event_name", operator: "NOT_CONTAINS_TOKEN", value: "SANDBOX" },
  ];
}

/** One search for the total, one per language and one per bucket — at most about twenty. */
export async function fetchContactRequests(params: { from: string; to: string; signal?: AbortSignal }): Promise<ContactRequests> {
  const { from, to, signal } = params;
  const plan = requestBuckets(from, to);
  const total = await countWhere("contacts", customerForm(from, to), signal);
  const byLanguage: ContactRequests["byLanguage"] = [];
  for (const language of FORM_LANGUAGES) {
    const filters = [...customerForm(from, to), { propertyName: "recent_conversion_event_name", operator: "CONTAINS_TOKEN", value: `${language}_Customer` }];
    byLanguage.push({ language, requests: await countWhere("contacts", filters, signal) });
  }
  const buckets: RequestBucket[] = [];
  for (const b of plan.buckets) buckets.push({ ...b, requests: await countWhere("contacts", customerForm(b.from, b.to), signal) });
  return { generatedAt: new Date().toISOString(), from, to, granularity: plan.granularity, total, byLanguage, buckets };
}

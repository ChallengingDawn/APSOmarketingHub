// THE LIFECYCLE FUNNELS, from HubSpot.
//
// The workbook names the paths the business wants to watch — MQL → SQL → Lost
// Lead, Churn/Reactivate → Not Reactivated, and the way back. The stages behind
// those names are real HubSpot lifecycle stages on the COMPANY, so the counts
// come from HubSpot and the workbook only supplies the question.
//
// What a step counts, precisely: companies that ENTERED that stage inside the
// window, plus how many sit in it today. It is a flow, not a cohort — a company
// that reached SQL this month may have become an MQL last year — and the screen
// says so, because a percentage between two flows is a comparison, not a
// conversion rate.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { countWhere } from "@/lib/integrations/hubspotCounts";

export type FunnelStep = {
  label: string;
  stageValue: string | null;
  entered: number | null;
  inStageNow: number | null;
  /** Unmatched stage names are named, never quietly dropped. */
  unmatched?: boolean;
};

export type FunnelResult = {
  id: string;
  path: FunnelStep[];
  note: string;
};

export type JourneyFunnels = {
  from: string;
  to: string;
  funnels: FunnelResult[];
  generatedAt: string;
};

const dayMs = (day: string) => String(Date.parse(`${day}T00:00:00Z`));

/** The portal's own lifecycle stages: label as people write it → internal value. */
async function stageIndex(signal?: AbortSignal): Promise<Map<string, string>> {
  const res = await hubspotFetchJson<{ options?: { label?: string; value?: string }[] }>({
    path: "/crm/v3/properties/companies/lifecyclestage",
    signal,
  });
  const index = new Map<string, string>();
  for (const option of res.options ?? []) {
    if (!option.label || !option.value) continue;
    index.set(normalise(option.label), option.value);
  }
  return index;
}

const normalise = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The workbook writes "MQL", the portal may call it "MQL lead"; match on the words. */
function matchStage(index: Map<string, string>, label: string): string | null {
  const wanted = normalise(label);
  if (index.has(wanted)) return index.get(wanted)!;
  for (const [key, value] of index) {
    if (key.startsWith(wanted) || wanted.startsWith(key)) return value;
  }
  return null;
}

export async function fetchJourneyFunnels(params: {
  from: string;
  to: string;
  paths: { id: string; path: string[]; note: string }[];
  signal?: AbortSignal;
}): Promise<JourneyFunnels> {
  const index = await stageIndex(params.signal);

  // Each distinct stage is counted once, however many funnels mention it.
  const distinct = new Map<string, { entered: number | null; inStageNow: number | null }>();
  for (const funnel of params.paths) {
    for (const label of funnel.path) {
      const value = matchStage(index, label);
      if (!value || distinct.has(value)) continue;
      const entered = await countWhere(
        "companies",
        [
          { propertyName: `hs_v2_date_entered_${value}`, operator: "GTE", value: dayMs(params.from) },
          { propertyName: `hs_v2_date_entered_${value}`, operator: "LT", value: dayMs(params.to) },
        ],
        params.signal,
      );
      const inStageNow = await countWhere(
        "companies",
        [{ propertyName: "lifecyclestage", operator: "EQ", value }],
        params.signal,
      );
      distinct.set(value, { entered, inStageNow });
    }
  }

  const funnels: FunnelResult[] = params.paths.map((funnel) => ({
    id: funnel.id,
    note: funnel.note,
    path: funnel.path.map((label) => {
      const value = matchStage(index, label);
      const counts = value ? distinct.get(value) : undefined;
      return {
        label,
        stageValue: value,
        entered: counts?.entered ?? null,
        inStageNow: counts?.inStageNow ?? null,
        ...(value ? {} : { unmatched: true }),
      };
    }),
  }));

  return { from: params.from, to: params.to, funnels, generatedAt: new Date().toISOString() };
}

// THE ACTIVITIES CHART'S READ (SARCLA 02.11.2026: "just a graph with the number of activities in total, split by e-mails,
// calls, customer visits"): every e-mail sent and every call of this year by the ESO and TSA people (their unit in
// Settings > Hierarchy, else the rosters), counted per person and day - no companies, nothing else. The rules in
// ./activityRules.ts; the visits are the Visits page's own read. Read every hour through slowReport: the first visitor
// starts it, everyone after gets it.

import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { teamOf } from "@/lib/datatracker/rosters";
import { hierarchyNow } from "@/lib/hierarchy/store";
import { reportsOfUnit } from "@/lib/hierarchy/rules";
import { searchAll } from "@/lib/lifecycle/read";
import { ymd } from "./visitsRules";
import { activityDays, isSent, type ActivityData } from "./activityRules";

const KEY = "esoActivity:v1";
const TTL_MS = 60 * 60 * 1000;
/** owners per search - HubSpot's IN takes a list, kept short */
const CHUNK = 50;

export function esoActivity(): Promise<SlowState<ActivityData>> {
  return slowReport(KEY, TTL_MS, build);
}

async function build(): Promise<ActivityData> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const today = now.toISOString().slice(0, 10);
  const first = year * 10000 + 101, last = ymd(today);
  const since = String(Date.UTC(year, 0, 1));

  const h = await hierarchyNow();
  const owners = h.people.filter((p) => reportsOfUnit(h.placed[p.id]?.unit) || teamOf(p.id)).map((p) => p.id);

  const mails: { owner: string; day: number }[] = [], calls: { owner: string; day: number }[] = [];
  const inYear = (day: number) => day >= first && day <= last;
  for (let i = 0; i < owners.length; i += CHUNK) {
    const ids = owners.slice(i, i + CHUNK);
    const filters = [{ propertyName: "hubspot_owner_id", operator: "IN", values: ids }, { propertyName: "hs_timestamp", operator: "GTE", value: since }];
    const m = await searchAll("emails", [filters], ["hubspot_owner_id", "hs_timestamp", "hs_email_direction"],
      (n) => reportProgress(KEY, `reading this year's e-mails · ${(mails.length + n).toLocaleString("en")}`));
    for (const r of m) {
      const day = ymd(r.properties?.hs_timestamp);
      if (isSent(r.properties?.hs_email_direction) && inYear(day)) mails.push({ owner: String(r.properties?.hubspot_owner_id ?? ""), day });
    }
    const c = await searchAll("calls", [filters], ["hubspot_owner_id", "hs_timestamp"],
      (n) => reportProgress(KEY, `reading this year's calls · ${(calls.length + n).toLocaleString("en")}`));
    for (const r of c) {
      const day = ymd(r.properties?.hs_timestamp);
      if (inYear(day)) calls.push({ owner: String(r.properties?.hubspot_owner_id ?? ""), day });
    }
  }
  return { generatedAt: now.toISOString(), year, today, days: activityDays(mails, calls), owners };
}

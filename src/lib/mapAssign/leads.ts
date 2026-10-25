// The ESO line managers, kept (rules in ./leadsRules.ts): owner id -> RABE | SARCLA | FALU, one kv value.
import { kvGet, kvSet } from "@/lib/db/init";
import { cleanLeads, type Lead } from "./leadsRules";

const KEY = "mapAssign:lineManagers:v1";

export async function getLeads(): Promise<Record<string, Lead>> {
  return cleanLeads(await kvGet<Record<string, string>>(KEY));
}

export async function setLead(ownerId: string, lead: Lead | null): Promise<Record<string, Lead>> {
  const now = await getLeads();
  if (lead) now[String(ownerId)] = lead; else delete now[String(ownerId)];
  await kvSet(KEY, now);
  return now;
}

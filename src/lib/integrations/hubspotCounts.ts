// Exact HubSpot counts: one search call per figure, reading only its total.
// Every call goes through the search throttle in hubspotFetchJson, so callers
// run them one after another, never in parallel. A total HubSpot did not
// return is null, never 0.

import { hubspotFetchJson } from "./hubspot";

export type Filter = { propertyName: string; operator: string; value?: string };

export async function countWhere(
  object: "companies" | "contacts" | "orders",
  filters: Filter[],
  signal?: AbortSignal,
): Promise<number | null> {
  const res = await hubspotFetchJson<{ total?: unknown }>({
    path: `/crm/v3/objects/${object}/search`,
    method: "POST",
    body: { filterGroups: [{ filters }], limit: 1, properties: [] },
    signal,
  });
  return typeof res.total === "number" && Number.isFinite(res.total) ? res.total : null;
}

export async function companyPropertyNames(signal?: AbortSignal): Promise<Set<string>> {
  const res = await hubspotFetchJson<{ results?: { name?: unknown }[] }>({ path: "/crm/v3/properties/companies", signal });
  const names = (res.results ?? []).map((p) => (typeof p.name === "string" ? p.name : ""));
  return new Set(names.filter((n) => n.length > 0));
}

export const gt0 = (propertyName: string): Filter => ({ propertyName, operator: "GT", value: "0" });

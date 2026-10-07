// THE REVIEW QUEUE'S AUTOMATIC CHECK - the connector's "link" moved into the hub.
//
// Most customers in the review queue are not unknown at all: the company sits in
// HubSpot with its ERP id (erp_customer_id) and mandant, only the customer key
// (company_unique_number = mandant + "-" + ERP id) is missing, so the revenue
// cannot find it. The check looks each one up; linking writes the missing key.
// It NEVER creates a company - one that is not in HubSpot stays waiting for a
// person (the Orders rule). The live check is the truth here, not the
// connector's own flag: a key that now matches is linked, whatever it says.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";

import { verdictFrom, type CheckRow, type Co } from "./reviewRule";

export type { CheckRow, CheckVerdict } from "./reviewRule";

async function search(filters: object[]): Promise<Co[]> {
  const r = await hubspotFetchJson<{ results?: Co[] }>({
    path: "/crm/v3/objects/companies/search", method: "POST",
    body: { filterGroups: [{ filters }], limit: 10, properties: ["name", "company_unique_number", "erp_customer_id", "mandant"] },
  });
  return r.results ?? [];
}

/** One customer key: already on a company, or one company that should carry it, or why not. */
export async function checkOne(un: string): Promise<CheckRow> {
  const m = /^(\d+)-(\d+)$/.exec(un.trim());
  if (!m) return { un, verdict: { kind: "invalid" } };
  const withKey = await search([{ propertyName: "company_unique_number", operator: "EQ", value: un }]);
  const byErpId = withKey.length ? [] : await search([{ propertyName: "erp_customer_id", operator: "EQ", value: m[2] }]);
  return { un, verdict: verdictFrom(un, withKey, byErpId) };
}

/** Check a list, one at a time (HubSpot's search allows a few a second). */
export async function checkAll(uns: string[]): Promise<CheckRow[]> {
  const out: CheckRow[] = [];
  for (const un of uns) {
    try {
      out.push(await checkOne(un));
    } catch {
      out.push({ un, verdict: { kind: "missing" } });
    }
  }
  return out;
}

/**
 * Write the missing key - only where the check still says exactly one company
 * with this ERP id, mandant and an empty key. Re-checked right before writing,
 * so a page left open for a day cannot write a stale answer.
 */
export async function linkAll(uns: string[]): Promise<{ linked: string[]; skipped: CheckRow[] }> {
  const linked: string[] = [];
  const skipped: CheckRow[] = [];
  for (const un of uns) {
    const row = await checkOne(un);
    if (row.verdict.kind !== "can_link") {
      skipped.push(row);
      continue;
    }
    await hubspotFetchJson({
      path: `/crm/v3/objects/companies/${row.verdict.companyId}`, method: "PATCH",
      body: { properties: { company_unique_number: un } },
    });
    linked.push(un);
  }
  return { linked, skipped };
}

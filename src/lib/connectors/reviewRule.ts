// The review queue's linking rule, with no HubSpot in it - so it can be tested.
// See reviewCheck.ts for the reads and the write.

export type CheckVerdict =
  | { kind: "linked"; companyId: string; name: string }           // the key is on a company - matches from the next run
  | { kind: "can_link"; companyId: string; name: string }         // one company with this ERP id and mandant, key empty
  | { kind: "conflict"; companyId: string; name: string; holds: string } // that company carries a different key
  | { kind: "several"; ids: string[] }                            // more than one company with this ERP id
  | { kind: "missing" }                                           // nothing in HubSpot - a person creates or merges it
  | { kind: "invalid" };                                          // not a mandant-customer key

export type CheckRow = { un: string; verdict: CheckVerdict };

export type Co = { id: string; properties: Record<string, string | null | undefined> };

/** The rule, with no HubSpot in it: the companies that carry the key, and those with the ERP id. */
export function verdictFrom(un: string, withKey: Co[], byErpId: Co[]): CheckVerdict {
  const m = /^(\d+)-(\d+)$/.exec(un.trim());
  if (!m) return { kind: "invalid" };
  const mand = m[1];
  if (withKey.length) return { kind: "linked", companyId: withKey[0].id, name: withKey[0].properties.name ?? withKey[0].id };
  // the mandant has to agree (M100 <-> 100); a record with no mandant at all is accepted
  const same = byErpId.filter((o) => (o.properties.mandant ?? "").toUpperCase().replace(/^M/, "") === mand);
  const cand = same.length ? same : byErpId.filter((o) => !o.properties.mandant);
  if (!cand.length) return { kind: "missing" };
  if (cand.length > 1) return { kind: "several", ids: cand.map((o) => o.id) };
  const c = cand[0];
  const holds = (c.properties.company_unique_number ?? "").trim();
  if (holds && holds !== un) return { kind: "conflict", companyId: c.id, name: c.properties.name ?? c.id, holds };
  return { kind: "can_link", companyId: c.id, name: c.properties.name ?? c.id };
}

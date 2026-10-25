// THE ESO LINE MANAGERS - who each ESO person reports to (SARCLA 25.10.2026: "on Map assignment, a column line manager so
// we can pick a line manager for each ESO", for the ESO Figures' "RABE TEAM | SARCLA TEAM | FALU TEAM"). No HubSpot or
// database here, so the page and the tests read it as it is.

export const LEADS = ["RABE", "SARCLA", "FALU"] as const;
export type Lead = (typeof LEADS)[number];
export const isLead = (x: unknown): x is Lead => typeof x === "string" && (LEADS as readonly string[]).includes(x);
export const leadTeam = (l: Lead) => `${l} TEAM`;

/** owner id -> line manager, only the ones that are one */
export function cleanLeads(x: unknown): Record<string, Lead> {
  const out: Record<string, Lead> = {};
  if (!x || typeof x !== "object") return out;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (/^\d+$/.test(String(k)) && isLead(v)) out[String(k)] = v;
  return out;
}

/** The people (by the name the reports carry) of each line manager's team. */
export function leadsByName(leads: Record<string, Lead>, names: Map<string, string>): Record<string, Lead> {
  const out: Record<string, Lead> = {};
  for (const [id, l] of Object.entries(leads)) { const n = names.get(String(id)); if (n) out[n] = l; }
  return out;
}

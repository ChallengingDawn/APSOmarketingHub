// THE ESO LINE MANAGERS' TEAMS - who each ESO person reports to (SARCLA 25.10.2026: "on Map assignment, a column line
// manager so we can pick a line manager for each ESO", for the ESO Figures' team switch), and the teams themselves
// (26.10.2026: "a panel to change the teams' names, or to delete and add more teams"). No HubSpot or database here, so
// the page and the tests read it as it is.

export type Team = { id: string; name: string };
/** The teams as first set up. A team keeps its id whatever it is renamed to, so the people picked keep their team. */
export const DEFAULT_TEAMS: Team[] = [{ id: "RABE", name: "RABE TEAM" }, { id: "SARCLA", name: "SARCLA TEAM" }, { id: "FALU", name: "FALU TEAM" }];
const ID = /^[A-Z0-9][A-Z0-9-]{0,39}$/;
export const isTeamId = (x: unknown): x is string => typeof x === "string" && ID.test(x);
/** A name as kept: trimmed, single spaces, at most 60 characters. */
export const tidyName = (s: string) => s.trim().replace(/\s+/g, " ").slice(0, 60);

/** The teams kept: each with an id and a name, no two alike. Nothing kept yet = the first three. */
export function cleanTeams(x: unknown): Team[] {
  if (!Array.isArray(x)) return DEFAULT_TEAMS.map((t) => ({ ...t }));
  const out: Team[] = [];
  for (const t of x as Partial<Team>[]) {
    const name = typeof t?.name === "string" ? tidyName(t.name) : "";
    if (!isTeamId(t?.id) || !name || out.some((o) => o.id === t.id || o.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ id: t.id, name });
  }
  return out;
}

/** A new team's id, from its name: "Benelux team" -> "BENELUX-TEAM", made unique. */
export function newTeamId(name: string, taken: string[]): string {
  const base = tidyName(name).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "TEAM";
  let id = base, n = 2;
  while (taken.includes(id)) id = `${base}-${n++}`;
  return id;
}

/**
 * The list an admin sends: the teams in their order, a name changed, a team added (no id yet), a team left out
 * (deleted). A name is needed and no two teams share one.
 */
export function applyTeams(sent: unknown, now: Team[]): { teams: Team[]; error?: string } {
  if (!Array.isArray(sent)) return { teams: now, error: "the teams are missing" };
  const out: Team[] = [];
  for (const t of sent as Partial<Team>[]) {
    const name = typeof t?.name === "string" ? tidyName(t.name) : "";
    if (!name) return { teams: now, error: "a team needs a name" };
    if (out.some((o) => o.name.toLowerCase() === name.toLowerCase())) return { teams: now, error: `two teams are called "${name}"` };
    const kept = isTeamId(t?.id) && now.some((o) => o.id === t.id) && !out.some((o) => o.id === t.id);
    out.push({ id: kept ? (t.id as string) : newTeamId(name, [...now.map((o) => o.id), ...out.map((o) => o.id)]), name });
  }
  return { teams: out };
}

/** owner id -> team id, only the people whose team exists */
export function cleanLeads(x: unknown, teams: Team[] = DEFAULT_TEAMS): Record<string, string> {
  const out: Record<string, string> = {};
  if (!x || typeof x !== "object") return out;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (/^\d+$/.test(String(k)) && teams.some((t) => t.id === v)) out[String(k)] = v as string;
  return out;
}

/** The people (by the name the reports carry) and their team's id. */
export function leadsByName(leads: Record<string, string>, names: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, l] of Object.entries(leads)) { const n = names.get(String(id)); if (n) out[n] = l; }
  return out;
}

// The ESO line managers' teams and who is in which, kept (rules in ./leadsRules.ts): the teams one kv value, owner id ->
// team id another.
import { kvGet, kvSet } from "@/lib/db/init";
import { applyTeams, cleanLeads, cleanTeams, type Team } from "./leadsRules";

const KEY = "mapAssign:lineManagers:v1";
const TEAMS = "mapAssign:leadTeams:v1";

export async function getTeams(): Promise<Team[]> {
  return cleanTeams(await kvGet<unknown>(TEAMS));
}

export async function getLeads(teams?: Team[]): Promise<Record<string, string>> {
  return cleanLeads(await kvGet<Record<string, string>>(KEY), teams ?? (await getTeams()));
}

export async function setLead(ownerId: string, team: string | null): Promise<Record<string, string>> {
  const teams = await getTeams();
  if (team && !teams.some((t) => t.id === team)) throw new Error("that team does not exist");
  const now = await getLeads(teams);
  if (team) now[String(ownerId)] = team; else delete now[String(ownerId)];
  await kvSet(KEY, now);
  return now;
}

/** The teams as an admin left them: renamed, added, deleted - the people of a deleted team lose their team. */
export async function saveTeams(sent: unknown): Promise<{ teams: Team[]; leads: Record<string, string> }> {
  const r = applyTeams(sent, await getTeams());
  if (r.error) throw new Error(r.error);
  await kvSet(TEAMS, r.teams);
  const leads = cleanLeads(await kvGet<Record<string, string>>(KEY), r.teams);
  await kvSet(KEY, leads);
  return { teams: r.teams, leads };
}

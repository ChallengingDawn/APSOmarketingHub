// THE HIERARCHY, KEPT - what an admin set in Settings > Hierarchy, and what the hub knew before it (the rules: ./rules.ts).

import { kvGet, kvSet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { readOwners, type Owner } from "@/lib/ownerRules/hubspot";
import { ownerNames } from "@/lib/integrations/erosion";
import { teamOf } from "@/lib/datatracker/rosters";
import { getLeads, getTeams } from "@/lib/mapAssign/leads";
import { DEFAULT_UNITS, cleanHierarchy, effective, seedUnit, tidyUnit, type Hierarchy } from "./rules";

const KEY = "hierarchy:v1";
const UNITS_KEY = "hierarchy:units";

export const savedHierarchy = async (): Promise<Hierarchy> => cleanHierarchy(await kvGet<unknown>(KEY));
export const saveHierarchy = (h: Hierarchy) => kvSet(KEY, h);

export async function getUnits(): Promise<string[]> {
  const v = await kvGet<unknown>(UNITS_KEY);
  const list = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(tidyUnit).filter(Boolean) : DEFAULT_UNITS;
  return [...new Set(list)];
}
export const saveUnits = (units: string[]) => kvSet(UNITS_KEY, [...new Set(units.map(tidyUnit).filter(Boolean))]);

/**
 * What the hub knew before anything was set here: each owner's unit - the rosters' ESO / TSA, else their HubSpot team -
 * and each ESO person's line manager from Map assignment (a team's id is its line manager's hub username - RABE,
 * SARCLA, FALU - whose email leads to their HubSpot owner).
 */
async function seedOf(owners: Owner[]): Promise<Hierarchy> {
  const seed: Hierarchy = {};
  for (const o of owners) { const unit = seedUnit(teamOf(o.id), o.team); if (unit) seed[o.id] = { unit }; }
  try {
    const teams = await getTeams();
    const leads = await getLeads(teams);
    const users = await query<{ username: string; email: string | null }>(`SELECT username, email FROM apsomh_users`);
    const ownerByEmail = new Map(owners.filter((o) => o.email).map((o) => [o.email!.toLowerCase(), o.id]));
    const managerOf = new Map<string, string>();
    for (const t of teams) {
      const u = users.rows.find((x) => x.username.toLowerCase() === t.id.toLowerCase());
      const id = u?.email ? ownerByEmail.get(u.email.toLowerCase()) : undefined;
      if (id) managerOf.set(t.id, id);
    }
    for (const [owner, team] of Object.entries(leads)) {
      const m = managerOf.get(team);
      if (m && m !== owner) seed[owner] = { ...(seed[owner] ?? {}), manager: m };
    }
  } catch { /* the units alone */ }
  return seed;
}

export type HierarchyPerson = { id: string; name: string; email: string | null; active: boolean; hsTeam: string | null };
/** Every HubSpot owner, what was set, what was known before, and each one's place as it stands. */
export async function hierarchyNow() {
  const owners = await readOwners();
  const names = await ownerNames().catch(() => new Map<string, string>());
  const [saved, seed] = [await savedHierarchy(), await seedOf(owners)];
  const people: HierarchyPerson[] = owners.map((o) => ({ id: o.id, name: names.get(o.id) ?? o.name, email: o.email, active: o.active, hsTeam: o.team }));
  return { people, saved, seed, placed: effective(saved, seed) };
}

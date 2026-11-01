// MY SALES REPORTS' SWITCH - Mine | My team | All ESO (or All TSA) | All (SARCLA 01.11.2026: "Adem should only see his KPIs
// + all ESO + all with TSA, a TSA person vice versa"; a manager also everyone under them in the hierarchy; "he should not
// be able to see other teams"), and whose figures each view shows on ESO's pages (src/app/reporting/scope.tsx). No React,
// no HubSpot here, so the pages and the tests read it as it is.

import type { Team } from "../mapAssign/leadsRules";

/** The team id a scope's people are known by - never a real team's (those are capitals and hyphens only, isTeamId). */
export const SCOPE_LEAD = "my-sales";

export type ScopeLeads = { byName: Record<string, string>; byId: Record<string, string>; teams: Team[] };
export type ScopeOf = {
  /** ESO's or TSA's reports (their pipeline, their rosters), or everyone */
  team: "eso" | "tsa" | "total";
  /** SCOPE_LEAD: only the people in `leads`; null: the whole team */
  lead: string | null;
  leads: ScopeLeads;
};

export type Person = { id: string; name: string };
/** What the switch is built from: the person signed in, the person shown, their unit's reports, them and everyone under them. */
export type Standing = { me: Person | null; subject: Person | null; reports: "eso" | "tsa" | null; team: Person[] };

export type View = "me" | "team" | "unit" | "all";
const UNIT_WORD: Record<"eso" | "tsa", string> = { eso: "ESO", tsa: "TSA" };

/** The switch's tabs for this person: My team only with people under them, their unit's only for ESO or TSA. */
export function viewsOf(st: Standing | null): { id: View; label: string }[] {
  const other = !!(st?.subject && st.me && st.subject.id !== st.me.id);
  const out: { id: View; label: string }[] = [{ id: "me", label: other ? st!.subject!.name : "Mine" }];
  if (st?.team.length) out.push({ id: "team", label: other ? `${st.subject!.name}'s team` : "My team" });
  if (st?.reports) out.push({ id: "unit", label: `All ${UNIT_WORD[st.reports]}` });
  out.push({ id: "all", label: "All (ESO + TSA)" });
  return out;
}

/** Whose figures a page shows for a view of the switch. */
export function scopeOf(st: Standing, view: View): ScopeOf {
  const none: ScopeLeads = { byName: {}, byId: {}, teams: [] };
  if (view === "all") return { team: "total", lead: null, leads: none };
  if (view === "unit" && st.reports) return { team: st.reports, lead: null, leads: none };
  const people = view === "team" && st.team.length ? st.team : st.subject ? [st.subject] : [];
  const name = view === "team" ? viewsOf(st).find((v) => v.id === "team")?.label ?? "My team" : st.subject?.name ?? "You";
  return {
    team: st.reports ?? "eso", lead: SCOPE_LEAD,
    leads: {
      byName: Object.fromEntries(people.map((p) => [p.name, SCOPE_LEAD])),
      byId: Object.fromEntries(people.map((p) => [p.id, SCOPE_LEAD])),
      teams: [{ id: SCOPE_LEAD, name }],
    },
  };
}

/** The people of a read (by owner id, or by the name the reports carry) a scope keeps. */
export function scopedPeople(people: { id?: string; name?: string }[], map: Record<string, string>, by: "id" | "name"): Set<number> {
  return new Set(people.flatMap((p, i) => (map[String(by === "id" ? p.id : p.name)] === SCOPE_LEAD ? [i] : [])));
}

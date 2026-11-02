// SALES LEADER REPORTS' RULES (SARCLA 02.11.2026: "build the sales leader report - the table for overall and for its team
// on the targets first page; rethink the more important graphs per sales leader"). His picks: Overall is one row per sales
// leader's team - their people's targets added up, what they reached, how far on track - each team opening to its people,
// and the grand total; My team a row per person of the leader's team and its total. The teams are Settings > Hierarchy's:
// everyone tagged Sales leader, and everyone under them.
//
// Each target as the VPP sheet reckons it (./mySalesRules.ts): the year's target from last year's figure and the growth
// set, its quarters by the period weighting, what is due by now - and the year to date against it. No HubSpot, no
// database, no React here, so the page and the tests read it as it is.

import { reportsOfUnit, under, type Tag } from "../hierarchy/rules";
import { TARGETS, quarterTargets, weightsOf, yearTarget, type PersonTargets, type TargetId } from "./mySalesRules";
import { dueToDate, type Reach } from "./mySalesFigures";

export type Person = { id: string; name: string };
export type LeaderTeam = { leader: Person; people: Person[]; reports: "eso" | "tsa" | null };
type Placed = Record<string, { manager: string | null; unit: string | null; tags?: Tag[] }>;

/** A leader's team: the leader first, then everyone under them at any depth, by name. */
export function teamOf(leader: Person, placed: Placed, byId: Map<string, Person>): LeaderTeam {
  const people = under(placed, leader.id).map((id) => byId.get(id)).filter((p): p is Person => !!p).sort((a, b) => a.name.localeCompare(b.name));
  return { leader, people: [leader, ...people], reports: reportsOfUnit(placed[leader.id]?.unit) };
}

/**
 * Every sales leader's team: those tagged Sales leader in the hierarchy - or, while nobody is tagged, those with people
 * under them in ESO or TSA. Biggest team first.
 */
export function leaderTeams(people: (Person & { active?: boolean })[], placed: Placed): LeaderTeam[] {
  const byId = new Map(people.map((p) => [p.id, { id: p.id, name: p.name }]));
  const live = people.filter((p) => p.active !== false);
  let leaders = live.filter((p) => placed[p.id]?.tags?.includes("leader"));
  if (!leaders.length) leaders = live.filter((p) => reportsOfUnit(placed[p.id]?.unit) && under(placed, p.id).length > 0);
  return leaders.map((l) => teamOf(byId.get(l.id)!, placed, byId))
    .sort((a, b) => b.people.length - a.people.length || a.leader.name.localeCompare(b.leader.name));
}

/** The team a person looks at: their own when people report to them (or they lead one), else their leader's; else none. */
export function myTeam(me: Person | null, people: Person[], placed: Placed): LeaderTeam | null {
  if (!me) return null;
  const byId = new Map(people.map((p) => [p.id, { id: p.id, name: p.name }]));
  if (under(placed, me.id).length || placed[me.id]?.tags?.includes("leader")) return teamOf(me, placed, byId);
  const m = placed[me.id]?.manager;
  return m && byId.has(m) ? teamOf(byId.get(m)!, placed, byId) : null;
}

/** A person's figure for a target: last year's (what a growth is set on) and this year's to date. */
export type Fig = { py: number; ytd: number };
/** One target of one person, or of a team added up. */
export type Cell = {
  /** the year to date - of everyone (a person's own; a team's of all its people) */
  ytd: number;
  /** of those with a target: their year's targets, what is due by now, what they reached */
  year: number; due: number; reached: number;
  /** how many have a target, of how many */
  set: number; of: number;
};

/** A person's cell: their target as the sheet reckons it, what is due by now, the year to date. */
export function personCell(id: TargetId, fig: Fig | undefined, t: PersonTargets | undefined, reach: Reach): Cell {
  const f = fig ?? { py: 0, ytd: 0 };
  const year = yearTarget(id, t?.[id], f.py);
  if (year == null) return { ytd: f.ytd, year: 0, due: 0, reached: 0, set: 0, of: 1 };
  return { ytd: f.ytd, year, due: dueToDate(quarterTargets(id, year, weightsOf(t, id)), reach), reached: f.ytd, set: 1, of: 1 };
}

/** Cells added up: a team, or all the teams. */
export const sumCells = (cells: Cell[]): Cell => cells.reduce((a, c) => ({
  ytd: a.ytd + c.ytd, year: a.year + c.year, due: a.due + c.due, reached: a.reached + c.reached, set: a.set + c.set, of: a.of + c.of,
}), { ytd: 0, year: 0, due: 0, reached: 0, set: 0, of: 0 });

/** How far on track: what those with a target reached against what is due by now - none without a target. */
export const onTrack = (c: Cell): number | null => (c.set && c.due > 0 ? c.reached / c.due : null);

/** Each person's five cells. */
export function personCells(figs: Partial<Record<TargetId, Fig>>, t: PersonTargets | undefined, reach: { rev: Reach; visits: Reach }): Record<TargetId, Cell> {
  return Object.fromEntries(TARGETS.map((d) => [d.id, personCell(d.id, figs[d.id], t, d.id === "visits" ? reach.visits : reach.rev)])) as Record<TargetId, Cell>;
}
/** A group's five cells from its people's. */
export function groupCells(rows: Record<TargetId, Cell>[]): Record<TargetId, Cell> {
  return Object.fromEntries(TARGETS.map((d) => [d.id, sumCells(rows.map((r) => r[d.id]))])) as Record<TargetId, Cell>;
}

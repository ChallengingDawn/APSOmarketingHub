"use client";
// SALES LEADER REPORTS - what its pages share (SARCLA 02.11.2026: "build the sales leader report - the table for overall
// and for its team on the targets first page; rethink the more important graphs per sales leader"): the teams - every
// sales leader's from Settings > Hierarchy, and the one of the person signed in (or previewed with View as) - each
// person's targets, and the switch My team | Overall. The ESO charts are drawn for the switch's people (../scope.tsx).

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { ReportTabs } from "@/app/uc/report/Tabs";
import { MUTED } from "@/app/uc/report/ui";
import { useViewAs } from "@/app/ViewAs";
import { ScopeProvider, type Scope } from "@/app/reporting/scope";
import { Note, shell } from "@/app/reporting/my-sales/shared";
import { scopeFor } from "@/lib/reporting/mySalesScope";
import type { PersonTargets } from "@/lib/reporting/mySalesRules";
import type { LeaderTeam, Person } from "@/lib/reporting/salesLeaderRules";

export type LeaderData = {
  ok?: boolean; error?: string; year: number;
  /** the HubSpot owner with the email signed in (or previewed) */
  me: Person | null;
  /** their team: theirs when people report to them, else their leader's - none when they are in no team */
  mine: LeaderTeam | null;
  /** every sales leader's team, the biggest first */
  teams: LeaderTeam[];
  /** owner id -> the targets they set */
  targets: Record<string, PersonTargets>;
};
export type LeaderView = "team" | "overall";

/** The teams and their targets - a preview (View as) answered as that person. */
export function useLeaderData() {
  const { viewed } = useViewAs();
  const as = viewed ? String(viewed.id) : null;
  const [st, setSt] = useState<LeaderData | null>(null);
  const load = useCallback(() => {
    let alive = true;
    fetch(`/api/reporting/sales-leader${as ? `?as=${as}` : ""}`).then((r) => r.json())
      .then((j: LeaderData) => { if (alive) setSt(j); })
      .catch((e) => { if (alive) setSt({ year: new Date().getFullYear(), me: null, mine: null, teams: [], targets: {}, ok: false, error: String((e as Error)?.message ?? e) }); });
    return () => { alive = false; };
  }, [as]);
  useEffect(() => load(), [load]);
  return st;
}

/** Everyone of every team once - the leaders first, in the teams' order. */
export const everyone = (teams: LeaderTeam[]): Person[] => {
  const seen = new Set<string>(), out: Person[] = [];
  for (const t of teams) for (const p of t.people) if (!seen.has(p.id)) { seen.add(p.id); out.push(p); }
  return out;
};
export const teamName = (t: LeaderTeam, me: Person | null) => (me && t.leader.id === me.id ? "My team" : `${t.leader.name}'s team`);
/** The reports a group is drawn in: its one unit's, else everyone's. */
const reportsOf = (teams: LeaderTeam[]): "eso" | "tsa" | "total" => {
  const r = new Set(teams.map((t) => t.reports));
  return r.size === 1 && !r.has(null) ? [...r][0]! : "total";
};

const KEPT = "salesLeader.view";
/** The switch, the people it shows and the scope the ESO charts read. */
export function useLeaderFrame() {
  const st = useLeaderData();
  const [kept, setKept] = useState<LeaderView>("team");
  useEffect(() => { try { const x = localStorage.getItem(KEPT); if (x === "team" || x === "overall") setKept(x); } catch { /* my team */ } }, []);
  const views = useMemo(() => [
    ...(st?.mine ? [{ id: "team" as const, label: teamName(st.mine, st.me), count: null }] : []),
    { id: "overall" as const, label: "Overall", count: null },
  ], [st]);
  // nobody's team to show: Overall
  const view: LeaderView = views.some((v) => v.id === kept) ? kept : "overall";
  const setView = (v: LeaderView) => { setKept(v); try { localStorage.setItem(KEPT, v); } catch { /* here only */ } };
  const bar = <Box sx={{ justifySelf: "start", minWidth: 0 }}><ReportTabs name="sales-leader-view" tab={view} onSelect={setView} tabs={views} /></Box>;
  const people = useMemo(() => (!st?.ok ? [] : view === "team" && st.mine ? st.mine.people : everyone(st.teams)), [st, view]);
  const name = view === "team" && st?.mine ? teamName(st.mine, st.me) : "All the teams";
  const scope = useMemo<Scope | null>(() => (st?.ok ? { ...scopeFor(people, name, reportsOf(view === "team" && st.mine ? [st.mine] : st.teams)), bar } : null),
    [st, people, name, view]); // eslint-disable-line react-hooks/exhaustive-deps
  return { st, view, bar, people, name, scope };
}

/**
 * An ESO page drawn whole inside Sales Leader Reports, for the people of the switch - as My Sales Reports draws them
 * (SARCLA 02.11.2026: "the sales leader report should follow the same pattern as ESO, TSA or My Sales Reports").
 */
export function LeaderFrame({ children }: { children: React.ReactNode }) {
  const { st, scope, bar } = useLeaderFrame();
  if (!st) return <Box sx={shell}><Typography sx={{ fontSize: "0.88rem", color: MUTED }}>Reading the teams…</Typography></Box>;
  if (!st.ok || !scope) return <Box sx={shell}>{bar}<Note title="The teams could not be read">{st.error ?? "Try again in a moment."}</Note></Box>;
  if (!st.teams.length && !st.mine) return <Box sx={shell}><Note title="No sales leader yet">Tag the sales leaders in Settings &gt; Hierarchy - each one&apos;s team is everyone under them.</Note></Box>;
  return <ScopeProvider value={scope}>{children}</ScopeProvider>;
}

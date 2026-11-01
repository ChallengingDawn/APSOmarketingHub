"use client";
// MY SALES REPORTS > FIGURES (SARCLA 01.11.2026: "Figures inherit graphs: revenue year to date by Performis SAE, order
// intake year to date by Performis SAE, book-to-bill year to date by Performis SAE, revenue year to date by sales
// priority, order intake year to date by sales priority, revenue year to date by profit center" - "picking the most
// important KPIs from ESO and putting them with this new filter"). The ESO Figures' own charts (../eso-benchmark/
// Figures.tsx), drawn for the person, their team or all ESO.

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { INK, MUTED } from "@/app/uc/report/ui";
import { useCustomersCube } from "@/app/reporting/marketing-kpis/Customers";
import { H1, TWO, Waiting, drawnOf, membersOf, tooOld, useKpiSeries, useLeads, withTeam, ytdPer, type FigCtx } from "@/app/reporting/eso-benchmark/Figures";
import { Note, PersonPicker, ScopeBar, footnoteSx, shell, useMySales, usePicked, usePickedTeam, useScope } from "./shared";

/** The charts, in his order: the Performis SAE's three, then by priority, then by profit centre. */
const CHARTS = ["ytd:rev", "ytd:oi", "ytd:b2b", "prio:rev", "prio:oi", "pc:rev"];
/** "the person" as a team of one, so every chart's title names them */
const ME = "ME";

export function MyFiguresPage() {
  const [picked, setPicked] = usePicked();
  const { st } = useMySales(picked);
  const [scope, setScope] = useScope();
  const [pickedTeam, setPickedTeam] = usePickedTeam();
  const { cube, computing, progress, error } = useCustomersCube();
  const { kpi, busy } = useKpiSeries();
  const lt = useLeads();
  const ready = cube && !tooOld(cube) ? cube : null;

  const subject = st?.subject ?? null;
  const teams = st?.teams ?? [];
  const ownTeam = subject ? lt?.byId[subject.id] ?? (subject.id === st?.me?.id ? st?.team : null) ?? null : st?.team ?? null;
  const teamId = st?.canPick && pickedTeam && teams.some((t) => t.id === pickedTeam) ? pickedTeam : ownTeam ?? (st?.canPick ? teams[0]?.id ?? null : null);
  const teamName = teams.find((t) => t.id === teamId)?.name ?? "Your team";

  const c = useMemo<FigCtx | null>(() => {
    if (!ready || !st || !lt) return null;
    const base = { cube: ready, kpi, kpiBusy: busy, team: "eso" as const, view: "ytd" as const, per: ytdPer(ready), filters: {}, leads: lt.byName };
    if (scope === "me") {
      // one person as a team of one: their SAE name in it - the charts by Performis SAE keep only the team's people - and
      // named as the "team" in every title
      const leads = subject ? { ...lt.byName, [subject.name]: ME } : lt.byName;
      return { ...base, leads, eff: { sae: subject ? [subject.name] : ["\u0000 none"] }, lead: ME, teams: [...teams, { id: ME, name: subject?.name ?? "You" }] };
    }
    const lead = scope === "team" ? teamId : null;
    return { ...base, eff: withTeam(ready, {}, "eso", lead, lt.byName), lead, teams };
  }, [ready, st, lt, kpi, busy, scope, subject, teams, teamId]);

  const who = scope === "me" ? subject?.name ?? "You" : scope === "team" ? teamName : "All ESO";
  return (
    <Box sx={shell}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>Figures</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}><b style={{ color: INK }}>{who}</b> · year to date, against the same days a year earlier - the ESO Figures&apos; own charts</Typography>
        </Box>
        {st && <PersonPicker st={st} picked={picked} onPick={setPicked} />}
      </Box>
      {st && <ScopeBar scope={scope} onScope={setScope} mine="My figures" teamLabel="My team" teams={teams} team={teamId} onTeam={setPickedTeam} canPick={st.canPick} />}
      {scope === "me" && st && !subject && <Note title="No figures of your own here">Your email is not a HubSpot owner&apos;s, so the reports cannot tell which customers are yours. My team and All ESO still show.</Note>}
      {scope === "team" && st && !teamId && <Note title="You are in no team yet">Map assignment&apos;s SAE table puts each ESO person in their line manager&apos;s team - an admin sets it there.</Note>}
      {scope === "team" && c && teamId && membersOf(c.cube, "eso", teamId, lt?.byName ?? {})?.length === 0 && <Note title={`No one in ${teamName} has customers yet`} />}
      {!c ? <Waiting computing={computing || (!!cube && tooOld(cube))} progress={progress} error={error ?? st?.error} /> : (
        <Box sx={TWO}>
          {CHARTS.map((id) => {
            const ch = drawnOf(id);
            return ch ? <Box key={id} sx={{ minWidth: 0 }}>{ch.draw({ ...c, view: ch.view })}</Box> : null;
          })}
        </Box>
      )}
      <Typography sx={footnoteSx}>
        Year to date: the ERP file&apos;s own figures per customer, against the same days a year earlier. Performis SAE: the customers Performis gives each person, as Map assignment maps the SAE to a person; My team: the people Map
        assignment&apos;s SAE table puts in the team. The same charts as ESO Reports &gt; Figures.
      </Typography>
    </Box>
  );
}

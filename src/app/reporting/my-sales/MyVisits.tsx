"use client";
// MY SALES REPORTS > VISITS (SARCLA 01.11.2026: "Visits: completed visits year to date, by person"). The ESO Visits'
// own charts (../eso-benchmark/Visits.tsx), drawn for the person, their team or all ESO - and their month by month.

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { INK, MUTED } from "@/app/uc/report/ui";
import { H1, TWO, useLeads } from "@/app/reporting/eso-benchmark/Figures";
import { Waiting, drawnOf, peopleOf, perOf, presetsOf, useVisits, type VCtx } from "@/app/reporting/eso-benchmark/Visits";
import { Note, PersonPicker, ScopeBar, footnoteSx, shell, useMySales, usePicked, usePickedTeam, useScope } from "./shared";

const CHARTS = ["people:visits", "people:months"];
const ME = "ME";

export function MyVisitsPage() {
  const [picked, setPicked] = usePicked();
  const { st } = useMySales(picked);
  const [scope, setScope] = useScope();
  const [pickedTeam, setPickedTeam] = usePickedTeam();
  const { d, computing, progress, error } = useVisits();
  const lt = useLeads();

  const subject = st?.subject ?? null;
  const teams = st?.teams ?? [];
  const ownTeam = subject ? lt?.byId[subject.id] ?? (subject.id === st?.me?.id ? st?.team : null) ?? null : st?.team ?? null;
  const teamId = st?.canPick && pickedTeam && teams.some((t) => t.id === pickedTeam) ? pickedTeam : ownTeam ?? (st?.canPick ? teams[0]?.id ?? null : null);
  const teamName = teams.find((t) => t.id === teamId)?.name ?? "Your team";

  const c = useMemo<VCtx | null>(() => {
    if (!d || !st || !lt) return null;
    const per = perOf(d, presetsOf(d)[0].win);
    if (scope === "me") {
      const mine = new Set(d.people.flatMap((p, i) => (subject && p.id === subject.id ? [i] : [])));
      return { d, per, team: "eso", lead: ME, teams: [...teams, { id: ME, name: subject?.name ?? "You" }], people: mine, filters: {}, view: "people" };
    }
    const lead = scope === "team" ? teamId : null;
    return { d, per, team: "eso", lead, teams, people: peopleOf(d, "eso", lead, lt.byId), filters: {}, view: "people" };
  }, [d, st, lt, scope, subject, teams, teamId]);

  const who = scope === "me" ? subject?.name ?? "You" : scope === "team" ? teamName : "All ESO";
  return (
    <Box sx={shell}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>Visits</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}><b style={{ color: INK }}>{who}</b> · completed visit reports, year to date - the ESO Visits&apos; own charts</Typography>
        </Box>
        {st && <PersonPicker st={st} picked={picked} onPick={setPicked} />}
      </Box>
      {st && <ScopeBar scope={scope} onScope={setScope} mine="My visits" teamLabel="My team" teams={teams} team={teamId} onTeam={setPickedTeam} canPick={st.canPick} />}
      {scope === "me" && st && !subject && <Note title="No visits of your own here">Your email is not a HubSpot owner&apos;s, so the reports cannot tell which visits are yours. My team and All ESO still show.</Note>}
      {scope === "team" && st && !teamId && <Note title="You are in no team yet">Map assignment&apos;s SAE table puts each ESO person in their line manager&apos;s team - an admin sets it there.</Note>}
      {!c ? <Waiting computing={computing} progress={progress} error={error ?? st?.error} /> : (
        <Box sx={TWO}>
          {CHARTS.map((id) => {
            const ch = drawnOf(id);
            return ch ? <Box key={id} sx={{ minWidth: 0 }}>{ch.draw(c)}</Box> : null;
          })}
        </Box>
      )}
      <Typography sx={footnoteSx}>Completed visits: the visit reports filed, year to date. My team: the people Map assignment&apos;s SAE table puts in the team. The same charts as ESO Reports &gt; Visits.</Typography>
    </Box>
  );
}

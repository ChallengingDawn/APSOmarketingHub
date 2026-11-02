"use client";
// SALES LEADER REPORTS > TEAM - the graphs that matter to a sales leader, person by person (SARCLA 02.11.2026: "rethink
// the more important graphs per sales leader"). His picks, each a section: who is on track; activity and coverage;
// revenue and book-to-bill; customer health - the ESO reports' own charts, drawn for the people of the switch (My team or
// every team), the year to date.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { INK, MUTED } from "@/app/uc/report/ui";
import { H1, useFiguresDraw } from "@/app/reporting/eso-benchmark/Figures";
import { useVisitsDraw } from "@/app/reporting/eso-benchmark/Visits";
import { useCustomerDevDraw } from "@/app/reporting/eso-benchmark/CustomerDev";
import { KeyCharts, ScopeProvider } from "@/app/reporting/scope";
import { Note, shell } from "@/app/reporting/my-sales/shared";
import type { Person } from "@/lib/reporting/salesLeaderRules";
import { OnTrack, useCells } from "./LeaderTargets";
import { teamName, useLeaderFrame, type LeaderData } from "./shared";

export function LeaderTeamPage() {
  const { st, view, bar, people, name, scope } = useLeaderFrame();
  const head = (
    <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
      <Typography component="h1" sx={H1}>Team</Typography>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
        <b style={{ color: INK }}>{view === "team" && st?.mine ? teamName(st.mine, st.me) : "Every sales leader's team"}</b> · year to date, person by person
      </Typography>
    </Box>
  );
  const body = (() => {
    if (!st) return <Note title="Reading the teams…" />;
    if (!st.ok || !scope) return <Note title="The teams could not be read">{st.error ?? "Try again in a moment."}</Note>;
    if (!st.teams.length && !st.mine) return <Note title="No sales leader yet">Tag the sales leaders in Settings &gt; Hierarchy - each one&apos;s team is everyone under them.</Note>;
    return <ScopeProvider value={scope}><Sections st={st} people={people} name={name} /></ScopeProvider>;
  })();
  return <Box sx={shell}>{head}{bar}{body}</Box>;
}

function Sections({ st, people, name }: { st: LeaderData; people: Person[]; name: string }) {
  const { cells, wait } = useCells(st);
  const fig = useFiguresDraw(), vis = useVisitsDraw(), cd = useCustomerDevDraw();
  return (
    <>
      <Section title="Who is on track" note="Each person's year to date against what their target says is due by now">
        {cells
          ? <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
            <OnTrack id="own" people={people} cells={cells} name={name} />
            <OnTrack id="visits" people={people} cells={cells} name={name} />
          </Box>
          : wait}
      </Section>
      <Section title="Activity and coverage" note="E-mails, calls and visits per person; how much of each priority they visited">
        {vis.draw ? <KeyCharts ids={["people:activities", "prio:coverage"]} draw={vis.draw} /> : vis.wait}
      </Section>
      <Section title="Revenue and book-to-bill" note="Revenue and order intake per person against last year, and their book-to-bill">
        {fig.draw ? <KeyCharts ids={["ytd:rev", "ytd:oi", "ytd:b2b"]} draw={fig.draw} /> : fig.wait}
      </Section>
      <Section title="Customer health" note="Per person: the customers lost, won back and new">
        {cd.draw ? <KeyCharts ids={["people:lost", "people:react", "people:new"]} draw={cd.draw} /> : cd.wait}
      </Section>
    </>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ display: "grid", gap: 1, minWidth: 0 }}>
      <Box>
        <Typography component="h2" sx={{ fontSize: "1.08rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>{title}</Typography>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{note}</Typography>
      </Box>
      {children}
    </Box>
  );
}

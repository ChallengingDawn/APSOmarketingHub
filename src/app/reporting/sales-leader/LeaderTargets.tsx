"use client";
// SALES LEADER REPORTS > TARGETS (SARCLA 02.11.2026: "the table for overall and for its team on the targets first page").
// His pick: My team is a row per person of the leader's team and its total; Overall a row per sales leader's team - their
// people's targets added up, what they reached, how far on track - each team opening to its people, and the grand total.
// Each target as the VPP sheet reckons it, measured on the ESO reports' figures (src/lib/reporting/salesLeaderRules.ts);
// the targets are set in My Sales Reports. Also "Who is on track", the Team page's first graph.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { FAINT, GREEN, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { useCustomersCube } from "@/app/reporting/marketing-kpis/Customers";
import { ChartBox, H1, Waiting, tooOld } from "@/app/reporting/eso-benchmark/Figures";
import { useVisits } from "@/app/reporting/eso-benchmark/Visits";
import { SHORT } from "@/app/reporting/my-sales/Targets";
import { Note, shell } from "@/app/reporting/my-sales/shared";
import { TARGETS, type TargetId } from "@/lib/reporting/mySalesRules";
import { cubeReach, figsByPerson, visitsReach } from "@/lib/reporting/mySalesFigures";
import { groupCells, onTrack, personCells, type Cell, type Person } from "@/lib/reporting/salesLeaderRules";
import { everyone, teamName, useLeaderFrame, type LeaderData } from "./shared";

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const int = (n: number) => Math.round(n).toLocaleString("en");
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const fmtOf = (id: TargetId) => (id === "visits" ? int : eur);
type Cells = Record<TargetId, Cell>;

/** Each person's five cells, for everyone of the teams - one pass of the ESO reports' reads. */
export function useCells(st: LeaderData | null) {
  const { cube, computing, progress, error } = useCustomersCube();
  const visits = useVisits();
  const ready = cube && !tooOld(cube) ? cube : null;
  const d = visits.d;
  const cells = useMemo(() => {
    if (!st?.ok || !ready || !d) return null;
    const all = everyone([...(st.mine ? [st.mine] : []), ...st.teams]);
    const figs = figsByPerson(ready, d, all);
    const reach = { rev: cubeReach(ready), visits: visitsReach(d) };
    return new Map(all.map((p) => [p.id, personCells(figs.get(p.id) ?? {}, st.targets[p.id], reach)]));
  }, [st, ready, d]);
  const wait = <Waiting computing={computing || visits.computing || (!!cube && tooOld(cube))} progress={progress ?? visits.progress} error={error ?? visits.error} />;
  return { cells, wait };
}

export function LeaderTargetsPage() {
  const { st, view, bar } = useLeaderFrame();
  const { cells, wait } = useCells(st);
  const head = (
    <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
      <Typography component="h1" sx={H1}>Targets</Typography>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
        {view === "team" && st?.mine
          ? <><b style={{ color: INK }}>{teamName(st.mine, st.me)}</b> · each person&apos;s {st.year} targets against what they reached</>
          : <><b style={{ color: INK }}>Every sales leader&apos;s team</b> · open a team for its people</>}
      </Typography>
    </Box>
  );
  const body = (() => {
    if (!st) return <Note title="Reading the teams…" />;
    if (!st.ok) return <Note title="The teams could not be read">{st.error ?? "Try again in a moment."}</Note>;
    if (!st.teams.length && !st.mine) return <Note title="No sales leader yet">Tag the sales leaders in Settings &gt; Hierarchy - each one&apos;s team is everyone under them.</Note>;
    if (!cells) return wait;
    return <TargetsTable st={st} cells={cells} team={view === "team"} />;
  })();
  return <Box sx={shell}>{head}{bar}{body}</Box>;
}

type Line = { key: string; label: React.ReactNode; depth: number; kind: "team" | "person" | "total"; cells: Cells; open?: boolean; onToggle?: () => void };

function TargetsTable({ st, cells, team }: { st: LeaderData; cells: Map<string, Cells>; team: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const of = (people: Person[]) => groupCells(people.map((p) => cells.get(p.id)).filter((c): c is Cells => !!c));
  const person = (p: Person, depth: number, lead: boolean): Line => ({
    key: `${depth}:${p.id}`, depth, kind: "person", cells: cells.get(p.id)!,
    label: <>{p.name}{lead && <span style={{ color: FAINT, fontWeight: 500 }}> · leader</span>}</>,
  });
  const lines: Line[] = [];
  if (team && st.mine) {
    const t = st.mine;
    for (const p of t.people) lines.push(person(p, 0, p.id === t.leader.id));
    lines.push({ key: "total", kind: "total", depth: 0, label: "Team total", cells: of(t.people) });
  } else {
    for (const t of st.teams) {
      const isOpen = open.has(t.leader.id);
      lines.push({
        key: `team:${t.leader.id}`, kind: "team", depth: 0, cells: of(t.people), open: isOpen,
        onToggle: () => setOpen((s) => { const x = new Set(s); if (x.has(t.leader.id)) x.delete(t.leader.id); else x.add(t.leader.id); return x; }),
        label: <>{teamName(t, st.me)}<span style={{ color: FAINT, fontWeight: 500 }}> · {t.people.length} {t.people.length === 1 ? "person" : "people"}</span></>,
      });
      if (isOpen) for (const p of t.people) lines.push(person(p, 1, p.id === t.leader.id));
    }
    lines.push({ key: "total", kind: "total", depth: 0, label: "All the teams", cells: of(everyone(st.teams)) });
  }
  const title = team && st.mine ? `${teamName(st.mine, st.me)}: each person's targets, ${st.year}` : `Every sales leader's team, ${st.year}`;
  const head = { fontSize: "0.74rem", fontWeight: 700, color: MUTED, borderColor: HAIRLINE, lineHeight: 1.3, py: 1.25, px: 0.75, verticalAlign: "bottom" as const };
  const cellSx = { fontSize: "0.86rem", color: INK, borderColor: HAIRLINE, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const, py: 1, px: 0.75 };
  return (
    <ChartBox title={title}
      hint="Each target: how far on track - what was reached against what is due by now, green from 100 % - then what is due and the year's target, as the VPP sheet reckons them. A team adds up the people with a target; the targets are set in My Sales Reports">
      <Box sx={{ overflowX: "auto", borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" }}>
        <Table size="small" sx={{ minWidth: 820 }} aria-label={title}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...head, pl: 1.5, minWidth: 200 }}>{team ? "Person" : "Team"}</TableCell>
              {TARGETS.map((t) => <TableCell key={t.id} align="right" sx={head} title={t.name}>{SHORT[t.id]}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.key} hover={!!l.onToggle} onClick={l.onToggle} sx={{ cursor: l.onToggle ? "pointer" : "default", bgcolor: l.depth ? "rgba(21,34,58,.025)" : undefined }}>
                <TableCell sx={{ ...cellSx, pl: 1.5 + l.depth * 3, fontWeight: l.kind === "person" ? 600 : 800, borderBottom: l.kind === "total" ? 0 : undefined }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {l.onToggle && (l.open ? <ExpandMoreIcon sx={{ fontSize: 18, color: MUTED }} /> : <ChevronRightIcon sx={{ fontSize: 18, color: MUTED }} />)}
                    <span>{l.label}</span>
                  </Box>
                </TableCell>
                {TARGETS.map((t) => (
                  <TableCell key={t.id} align="right" sx={{ ...cellSx, fontWeight: l.kind === "total" ? 800 : undefined, borderBottom: l.kind === "total" ? 0 : undefined }}>
                    <CellView id={t.id} c={l.cells[t.id]} group={l.kind !== "person"} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </ChartBox>
  );
}

function CellView({ id, c, group }: { id: TargetId; c: Cell; group: boolean }) {
  const f = fmtOf(id), x = onTrack(c);
  if (x == null) return (
    <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.3 }}>
      <b>{f(c.ytd)}</b>
      <span style={{ fontSize: "0.7rem", color: FAINT }}>{group ? "no target set" : "no target"}</span>
    </Box>
  );
  return (
    <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.3 }}>
      <b style={{ color: x >= 1 ? GREEN : RED }}>{pct(x)}</b>
      <span style={{ fontSize: "0.72rem", color: MUTED }}>{f(c.reached)} of {f(c.due)} due</span>
      <span style={{ fontSize: "0.68rem", color: FAINT }}>year {f(c.year)}{group ? ` · ${c.set} of ${c.of} set` : ""}</span>
    </Box>
  );
}

/**
 * Who is on track (SARCLA 02.11.2026, his pick for the leader's page): each person's year to date against what is due by
 * now on one target, the furthest behind first - a bar per person, the 100 % line across; those without a target named
 * under it.
 */
export function OnTrack({ id, people, cells, name }: { id: TargetId; people: Person[]; cells: Map<string, Cells>; name: string }) {
  const rows = people.map((p) => ({ p, c: cells.get(p.id)?.[id] })).filter((r): r is { p: Person; c: Cell } => !!r.c);
  const set = rows.map((r) => ({ ...r, x: onTrack(r.c) })).filter((r): r is typeof r & { x: number } => r.x != null).sort((a, b) => a.x - b.x || a.p.name.localeCompare(b.p.name));
  const none = rows.filter((r) => onTrack(r.c) == null);
  const top = Math.max(1.2, ...set.map((r) => r.x));
  const f = fmtOf(id);
  return (
    <ChartBox title={`Who is on track - ${SHORT[id].toLowerCase()}, ${name}`} hint="Each person's year to date against what is due by now, the furthest behind first; the line is 100 %">
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {set.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Nobody has set this target yet.</Typography>}
        {set.map((r) => (
          <Box key={r.p.id} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(110px, 0.9fr) minmax(60px, 2fr) auto" }, gap: { xs: 0.4, sm: 1.25 }, alignItems: "center", px: 0.5 }}>
            <Typography noWrap title={r.p.name} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{r.p.name}</Typography>
            <Box sx={{ position: "relative", height: 16 }}>
              <Box sx={{ position: "absolute", inset: 0, width: `${(Math.min(r.x, top) / top) * 100}%`, minWidth: 3, bgcolor: r.x >= 1 ? GREEN : RED, opacity: 0.85, borderRadius: "3px" }} />
              <Box sx={{ position: "absolute", top: -3, bottom: -3, left: `${(1 / top) * 100}%`, borderLeft: `2px dashed ${INK}`, opacity: 0.5 }} />
            </Box>
            <Typography sx={{ fontSize: "0.8rem", color: INK, textAlign: { sm: "right" }, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              <b style={{ color: r.x >= 1 ? GREEN : RED }}>{pct(r.x)}</b><span style={{ color: FAINT }}> · {f(r.c.reached)} of {f(r.c.due)}</span>
            </Typography>
          </Box>
        ))}
        {none.length > 0 && <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 0.5 }}>No target yet: {none.map((r) => r.p.name).join(", ")}</Typography>}
      </Box>
    </ChartBox>
  );
}


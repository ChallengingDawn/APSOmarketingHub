"use client";
// SALES LEADER REPORTS > TARGETS (SARCLA 02.11.2026: "the table for overall and for its team on the targets first page").
// His pick: My team is a row per person of the leader's team and its total; Overall a row per sales leader's team - their
// people's targets added up, what they reached, how far on track - each team opening to its people, and the grand total.
// Each target as the VPP sheet reckons it, measured on the ESO reports' figures (src/lib/reporting/salesLeaderRules.ts);
// the targets are set in My Sales Reports. Also "Who is on track", the Team page's first graph.
// 10.11.2026 (SARCLA: "both on Overall and My team put also the breakdown per quarter of the team"): under the table, the
// quarters of the team - or of one of its people, one team of all - as My Sales Reports shows a person's, the ERP's order
// book under each quarter running or to come (Bernd Rausmann's ask).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { useCustomersCube } from "@/app/reporting/marketing-kpis/Customers";
import { ChartBox, H1, Waiting, tooOld } from "@/app/reporting/eso-benchmark/Figures";
import { useVisits } from "@/app/reporting/eso-benchmark/Visits";
import { QS, SHORT, SMALL, STACK, TD, TH, dayWords, quarterCell, useOrderBook, type Row } from "@/app/reporting/my-sales/Targets";
import { Note, shell } from "@/app/reporting/my-sales/shared";
import { TARGETS, impliedGrowth, targetDef, type TargetId } from "@/lib/reporting/mySalesRules";
import { cubeReach, dueToDate, figsByPerson, revenueMeasures, visitsMeasure, visitsReach } from "@/lib/reporting/mySalesFigures";
import { bookQuarters, sumBooks, type BookBySae, type BookKey } from "@/lib/reporting/orderBookRules";
import { groupCells, groupQuarters, onTrack, personCells, type Cell, type Person } from "@/lib/reporting/salesLeaderRules";
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
  return { cells, wait, cube: ready, d };
}

export function LeaderTargetsPage() {
  const { st, view, bar } = useLeaderFrame();
  const { cells, wait, cube, d } = useCells(st);
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
    if (!cells || !cube || !d) return wait;
    const team = view === "team" && !!st.mine;
    return (
      <>
        <TargetsTable st={st} cells={cells} team={team} />
        <TeamQuarters key={view} st={st} cells={cells} cube={cube} d={d} groups={groupsOf(st, team)} />
      </>
    );
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

/* ── The quarters of a team (SARCLA 10.11.2026: "both on Overall and My team put also the breakdown per quarter of the
   team") - My Sales Reports' table of a person's targets, for a group ── */

type CubeReady = NonNullable<ReturnType<typeof useCustomersCube>["cube"]>;
type VisitsReady = NonNullable<ReturnType<typeof useVisits>["d"]>;
/** A group the quarters are shown for: a team, one of its people, all the teams. */
type Group = { key: string; name: string; people: Person[] };
/** My team: the team, then each of its people; Overall: all the teams, then each team. */
function groupsOf(st: LeaderData, team: boolean): Group[] {
  if (team && st.mine) {
    const t = st.mine;
    return [{ key: "team", name: teamName(t, st.me), people: t.people }, ...t.people.map((p) => ({ key: p.id, name: p.name, people: [p] }))];
  }
  return [{ key: "all", name: "All the teams", people: everyone(st.teams) }, ...st.teams.map((t) => ({ key: t.leader.id, name: teamName(t, st.me), people: t.people }))];
}

/** A target's row for a group: of its people with the target set (all of them when nobody's set) - how many of how many. */
type GroupRow = Row & { withT: number; of: number };
function groupRows(g: Group, st: LeaderData, cells: Map<string, Cells>, cube: CubeReady, d: VisitsReady, ob: BookBySae | null): GroupRow[] {
  const reach = { rev: cubeReach(cube), visits: visitsReach(d) };
  const runQ = Math.floor(reach.rev.month / 3);
  const index = new Map(d.people.map((p, i) => [p.id, i]));
  // the four revenues of the same people read once (the cube knows a person by their SAE name)
  const read = new Map<string, ReturnType<typeof revenueMeasures>>();
  const revenueOf = (ps: Person[]) => {
    const names = ps.map((p) => p.name), k = names.join("\u0000");
    if (!read.has(k)) read.set(k, revenueMeasures(cube, names));
    return read.get(k)!;
  };
  return TARGETS.map((t) => {
    const q = groupQuarters(t.id, g.people, cells, st.targets);
    const who = q?.set ?? g.people;
    const reachT = t.id === "visits" ? reach.visits : reach.rev;
    const m = t.id === "visits"
      ? visitsMeasure(d, new Set(who.flatMap((p) => { const i = index.get(p.id); return i == null ? [] : [i]; })))
      : revenueOf(who)[t.id];
    const book = t.id === "visits" || !ob ? null : bookQuarters(sumBooks(who.map((p) => ob.sae[p.name]))[t.id as BookKey], st.year, runQ);
    return {
      label: SHORT[t.id], id: t.id, m, set: undefined, amount: undefined, year: q?.year ?? null, quarters: q?.quarters ?? null,
      due: q ? dueToDate(q.quarters, reachT) : null, reach: reachT, w: [], own: false, book, withT: q?.set.length ?? 0, of: g.people.length,
    };
  });
}

function TeamQuarters({ st, cells, cube, d, groups }: { st: LeaderData; cells: Map<string, Cells>; cube: CubeReady; d: VisitsReady; groups: Group[] }) {
  const [pick, setPick] = useState(groups[0]?.key ?? "");
  const g = groups.find((x) => x.key === pick) ?? groups[0];
  const ob = useOrderBook();
  const rows = useMemo(() => (g ? groupRows(g, st, cells, cube, d, ob) : []), [g, st, cells, cube, d, ob]);
  if (!g) return null;
  const day = ob ? dayWords(ob.day) : null;
  const picker = groups.length > 1 && (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }} role="group" aria-label="Whose quarters">
      {groups.map((x, i) => {
        const on = x.key === g.key;
        return (
          <Chip key={x.key} size="small" clickable onClick={() => setPick(x.key)} aria-pressed={on} label={x.name}
            sx={{ height: 26, fontSize: "0.78rem", fontWeight: on || i === 0 ? 700 : 500, color: INK, bgcolor: on ? TINT.purple.bg : "transparent", border: `1px solid ${on ? "transparent" : HAIRLINE}` }} />
        );
      })}
    </Box>
  );
  return (
    <ChartBox title={`Quarter by quarter - ${g.name}, ${st.year}`}
      hint={`${g.people.length > 1 ? "Each target of the people who set it, added up: " : "Each target: "}the year's target, how it falls on the quarters by each one's period weighting, and what each quarter reached against its part${day ? `. Under each quarter running or to come, the order book - ordered, not invoiced yet, due in it (overdue in the running one) - and its share of the quarter's target: the ERP's order book of ${day}` : ""}. Nobody's target set: what the people reached`}>
      {picker}
      <Box sx={{ overflowX: "auto", borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" }}>
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%", minWidth: 760 }} aria-label={`Quarter by quarter - ${g.name}`}>
          <colgroup>
            <col style={{ width: "14%" }} />
            <col style={{ width: "15%" }} />
            {QS.map((q) => <col key={q} style={{ width: "14%" }} />)}
            <col style={{ width: "15%" }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...TH, textAlign: "left", pl: 1.5 }}>Target</TableCell>
              <TableCell sx={TH}>Target {st.year}</TableCell>
              {QS.map((q) => <TableCell key={q} sx={TH}>{q}</TableCell>)}
              <TableCell sx={TH}>Year to date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell sx={{ ...TD, textAlign: "left", fontWeight: 600, pl: 1.5 }}>{r.label}</TableCell>
                <TableCell sx={TD}>{groupYearCell(r)}</TableCell>
                {QS.map((q, k) => <TableCell key={q} sx={TD}>{quarterCell(r, k, day)}</TableCell>)}
                <TableCell sx={TD}>
                  <Box component="span" sx={STACK}>
                    <b>{fmtOf(r.id)(r.m.ytd)}</b>
                    {r.due != null && r.due > 0 && <span style={{ ...SMALL, color: r.m.ytd >= r.due ? GREEN : RED }}>{pct(r.m.ytd / r.due)} of {fmtOf(r.id)(r.due)} due</span>}
                    {r.id !== "visits" && <span style={{ ...SMALL, color: MUTED }}>{fmtOf(r.id)(r.m.ytdPy)} a year earlier</span>}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </ChartBox>
  );
}

/** A group's year's target: the people's added up, the growth it makes on their last year, how many set it. */
function groupYearCell(r: GroupRow) {
  const f = fmtOf(r.id);
  const g = r.year != null && targetDef(r.id).kind === "growth" ? impliedGrowth(r.year, r.m.py) : null;
  return (
    <Box component="span" sx={{ ...STACK, gap: 0.4 }}>
      {r.year == null ? <span style={{ color: FAINT }}>{r.of > 1 ? "nobody's set" : "not set"}</span> : <b>{f(r.year)}</b>}
      {g != null && <span style={{ ...SMALL, color: MUTED }}>{g >= 0 ? "+" : "−"}{Math.abs(g).toFixed(1)} % on last year</span>}
      <span style={{ ...SMALL, color: MUTED }}>{r.id === "visits" ? `${int(r.m.py)} meetings` : f(r.m.py)} last year</span>
      {r.of > 1 && r.withT > 0 && <span style={{ ...SMALL, color: r.withT < r.of ? TINT.purple.fg : FAINT }}>{r.withT} of {r.of} set it</span>}
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


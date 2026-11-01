"use client";
// MY SALES REPORTS > TARGETS (SARCLA 01.11.2026: "introduce the file VPP ESO 2026 BORJER - these are the sales targets;
// don't put the target, allow the sales to set its own target percentage; understand the file, how it's calculated, then
// display"; "filter by My Target | My Team Targets | All ESO - on the last two don't show the target but rather the
// contribution"). His picks: targets only (no pay, no bonus), set by the person themselves or an admin, as the sheet
// has them (a growth on last year for three revenues, an amount, a number of visits); the switch from the hierarchy
// (./shared.tsx); the team views as one table. The rules: src/lib/reporting/mySalesRules.ts; the figures: src/lib/reporting/mySalesFigures.ts.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FAINT, GREEN, INK, MUTED, RED, glass } from "@/app/uc/report/ui";
import { BEFORE, THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { useCustomersCube } from "@/app/reporting/marketing-kpis/Customers";
import { ChartBox, FullTable, H1, TARGET, TWO, Waiting, membersOf, tooOld, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { useVisits } from "@/app/reporting/eso-benchmark/Visits";
import { SCOPE_LEAD, scopedPeople } from "@/app/reporting/scope";
import { MONTH_NAMES } from "@/lib/marketingKpis/cube";
import {
  TARGETS, checkTarget, quarterTargets, yearTarget, type PersonTargets, type TargetDef, type TargetId,
} from "@/lib/reporting/mySalesRules";
import {
  cubeReach, dueToDate, revenueByPerson, revenueMeasures, visitsByPerson, visitsMeasure, visitsReach, type Measured, type PersonFig, type Reach,
} from "@/lib/reporting/mySalesFigures";
import { Note, footnoteSx, shell, useMySalesFrame, viewsOf, type MySales } from "./shared";

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const int = (n: number) => Math.round(n).toLocaleString("en");
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const fmtOf = (id: TargetId) => (id === "visits" ? int : eur);
const QS = ["Q1", "Q2", "Q3", "Q4"];

export function TargetsPage() {
  const { st, view, bar, scope, setTargets } = useMySalesFrame();
  const { cube, computing, progress, error } = useCustomersCube();
  const visits = useVisits();
  const ready = cube && !tooOld(cube) ? cube : null;
  const d = visits.d;
  const subject = st?.subject ?? null;
  const viewName = viewsOf(st).find((v) => v.id === view)?.label ?? "";
  const whose = view === "me" ? subject?.name ?? "You" : view === "all" ? "All - ESO and TSA" : viewName;

  // the people of the switch: their SAE names in the cube, their places in the visits read (../scope.tsx)
  const labels = useMemo(() => {
    if (!ready || !scope) return [];
    if (scope.lead === SCOPE_LEAD) return Object.keys(scope.leads.byName);
    return scope.team === "total" ? ready.labels.sae : membersOf(ready, scope.team, null, null) ?? [];
  }, [ready, scope]);
  const people = useMemo(() => {
    if (!d || !scope) return new Set<number>();
    if (scope.lead === SCOPE_LEAD) return scopedPeople(d.people, scope.leads.byId, "id");
    const word = scope.team === "eso" ? "ESO" : scope.team === "tsa" ? "TSA" : null;
    return new Set(d.people.flatMap((p, i) => (!word || p.team === word ? [i] : [])));
  }, [d, scope]);

  const head = (
    <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
      <Typography component="h1" sx={H1}>Targets</Typography>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
        {view === "me"
          ? <><b style={{ color: INK }}>{subject?.name ?? "You"}</b> · the {st?.year ?? ""} targets, set by the person, measured on the ESO reports&apos; figures</>
          : <><b style={{ color: INK }}>{whose}</b> · each person&apos;s figure and share of the year to date - no one&apos;s target shown</>}
      </Typography>
    </Box>
  );

  if (!st || !ready || !d) {
    return (
      <Box sx={shell}>
        {head}
        {bar}
        {st?.error ? <Note title="Your targets could not be read">{st.error}</Note>
          : <Waiting computing={computing || visits.computing || (!!cube && tooOld(cube))} progress={progress ?? visits.progress} error={error ?? visits.error} />}
      </Box>
    );
  }
  return (
    <Box sx={shell}>
      {head}
      {bar}
      {view === "me"
        ? <Mine st={st} cubeReady={ready} labels={labels} people={people} d={d} onSaved={setTargets} />
        : <Contribution scopeName={whose} cubeReady={ready} labels={labels} people={people} d={d} year={st.year} />}
      <Typography sx={footnoteSx}>
        The targets are the VPP sheet&apos;s five, reckoned as it reckons them: last year&apos;s figure and the growth set on it (an amount for the new customers&apos; revenue, a number of visits), the year&apos;s target split
        into quarters by the plan&apos;s weights - revenue 25.6 / 25 / 24.6 / 24.8 %, visits 26.5 / 27.5 / 22 / 24 %. Own area: the revenue of the customers Performis gives the person as their SAE; DT and KT: those customers&apos;
        revenue in Sealing Technology and Engineering Plastics; new customers: the customers whose first invoice was this year, and what they were invoiced (the BSC rule, as ESO&apos;s New customers); visits: completed visit reports.
        Revenue to {MONTH_NAMES[cubeReach(ready).month]} {st.year} as the ERP file has it, the month in progress to its day. My team: everyone under the person in Settings &gt; Hierarchy; All ESO or All TSA: the reports&apos; own team.
      </Typography>
    </Box>
  );
}

/* ── My targets ────────────────────────────────────────────────────────── */

function Mine({ st, cubeReady, labels, people, d, onSaved }: {
  st: MySales; cubeReady: NonNullable<ReturnType<typeof useCustomersCube>["cube"]>; labels: string[]; people: Set<number>;
  d: NonNullable<ReturnType<typeof useVisits>["d"]>; onSaved: (t: PersonTargets) => void;
}) {
  const m = useMemo(() => ({ ...revenueMeasures(cubeReady, labels), visits: visitsMeasure(d, people) }), [cubeReady, labels, d, people]);
  const reach = useMemo(() => ({ rev: cubeReach(cubeReady), visits: visitsReach(d) }), [cubeReady, d]);
  if (!st.subject) {
    return (
      <Note title="No figures of your own here">
        Your email is not a HubSpot owner&apos;s, so the reports cannot tell which customers are yours. My team&apos;s targets and All ESO still show - and an admin can check the email on your HubSpot user.
      </Note>
    );
  }
  if (!st.targets) return <Note title="The targets are not given to you">Ask an admin for Targets in Settings, People.</Note>;
  const set = st.targets;
  const rows = TARGETS.map((t) => rowOf(t, m[t.id], set[t.id], t.id === "visits" ? reach.visits : reach.rev));
  return (
    <>
      <Box sx={{ ...TWO, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" } }}>
        {TARGETS.map((t, i) => (
          <TargetCard key={t.id} def={t} row={rows[i]} year={st.year} canEdit={st.canEdit} owner={st.subject!.id}
            onSaved={onSaved} reach={t.id === "visits" ? reach.visits : reach.rev} />
        ))}
      </Box>
      <ChartBox title={`All the figures, ${st.year} - ${st.subject.name}`} hint={`Each target: last year, what was set, the year's target, each quarter's result against its part, the year to date against what is due by now`}>
        <FullTable<Row> first="Target" natural rows={rows} cols={COLS} />
      </ChartBox>
    </>
  );
}

type Row = { label: string; id: TargetId; m: Measured; set: number | undefined; year: number | null; quarters: number[] | null; due: number | null; reach: Reach };
function rowOf(t: TargetDef, m: Measured, set: number | undefined, reach: Reach): Row {
  const year = yearTarget(t.id, set, m.py);
  const quarters = year != null ? quarterTargets(t.id, year) : null;
  return { label: t.name, id: t.id, m, set, year, quarters, due: quarters ? dueToDate(quarters, reach) : null, reach };
}
const reachedTone = (a: number, t: number | null) => (t == null || t <= 0 ? FAINT : a >= t ? GREEN : RED);
const quarterCell = (r: Row, k: number) => {
  const runQ = Math.floor(r.reach.month / 3);
  if (k > runQ) return <span style={{ color: FAINT }}>{r.quarters ? `${fmtOf(r.id)(r.quarters[k])} to come` : "—"}</span>;
  const t = r.quarters?.[k] ?? null;
  return (
    <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.3 }}>
      <b>{fmtOf(r.id)(r.m.q[k])}</b>
      {t != null && <span style={{ fontSize: "0.72rem", color: reachedTone(r.m.q[k], k === runQ ? t * Math.min(1, (r.reach.month - k * 3 + r.reach.share) / 3) : t) }}>{pct(r.m.q[k] / t)} of {fmtOf(r.id)(t)}{k === runQ ? " · running" : ""}</span>}
    </Box>
  );
};
const setWords = (r: Row) => (r.set == null ? "not set" : targetDefOf(r.id).kind === "growth" ? `${r.set > 0 ? "+" : ""}${r.set} %` : fmtOf(r.id)(r.set));
const targetDefOf = (id: TargetId) => TARGETS.find((t) => t.id === id)!;
const COLS: Col<Row>[] = [
  { key: "py", head: "Last year", cell: (r) => (r.id === "visits" ? <span style={{ color: FAINT }}>{int(r.m.py)} meetings</span> : r.id === "new" ? <span style={{ color: FAINT }}>{eur(r.m.py)}</span> : eur(r.m.py)) },
  { key: "set", head: "Set", cell: (r) => <span style={{ color: r.set == null ? FAINT : INK }}>{setWords(r)}</span> },
  { key: "year", head: "Year's target", cell: (r) => (r.year == null ? "—" : <b>{fmtOf(r.id)(r.year)}</b>) },
  ...QS.map((q, k): Col<Row> => ({ key: q, head: q, cell: (r) => quarterCell(r, k) })),
  { key: "ytd", head: "Year to date", cell: (r) => <b>{fmtOf(r.id)(r.m.ytd)}</b> },
  { key: "due", head: "Due by now", tip: "The quarters done, and the running one as far as it has run", cell: (r) => (r.due == null ? "—" : fmtOf(r.id)(r.due)) },
  { key: "reached", head: "Reached", cell: (r) => (r.due == null ? "—" : <b style={{ color: reachedTone(r.m.ytd, r.due) }}>{pct(r.m.ytd / r.due)}</b>) },
];

/** One target: what is set (typed in place), its quarters against their parts, the year to date against what is due. */
function TargetCard({ def, row, year, canEdit, owner, onSaved, reach }: {
  def: TargetDef; row: Row; year: number; canEdit: boolean; owner: string; onSaved: (t: PersonTargets) => void; reach: Reach;
}) {
  const f = fmtOf(def.id);
  const runQ = Math.floor(reach.month / 3);
  const data = QS.map((q, k) => ({ q, cur: k > runQ ? null : row.m.q[k], prev: def.id === "visits" ? null : row.m.qPy[k], target: row.quarters?.[k] ?? null }));
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0, display: "grid", gap: 1.25, alignContent: "start" }}>
      <Box>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{def.name}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{def.note}</Typography>
      </Box>
      <SetLine def={def} row={row} year={year} canEdit={canEdit} owner={owner} onSaved={onSaved} />
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED, mb: -0.75 }}>
        <Legend color={THIS} label={`${year}, quarter by quarter`} />
        {def.id !== "visits" && <Legend color={BEFORE} label={`${year - 1}`} />}
        {row.quarters && <Legend color={TARGET} label="each quarter's target" dashed />}
      </Box>
      <Box sx={{ height: 170 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barGap={2}>
            <XAxis dataKey="q" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: MUTED }} />
            <YAxis tickLine={false} axisLine={false} width={def.id === "visits" ? 34 : 64} tick={{ fontSize: 10, fill: FAINT }} tickFormatter={(v: number) => (def.id === "visits" ? int(v) : `€${Math.round(v / 1000)}k`)} />
            <Tooltip formatter={(v, n) => [typeof v === "number" ? f(v) : "—", n === "cur" ? `${year}` : n === "prev" ? `${year - 1}` : "Target"]} />
            {def.id !== "visits" && <Bar dataKey="prev" fill={BEFORE} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />}
            <Bar dataKey="cur" fill={THIS} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            {row.quarters && <Line dataKey="target" stroke={TARGET} strokeDasharray="5 4" strokeWidth={2} dot={{ r: 3, fill: TARGET }} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "baseline" }}>
        <Typography sx={{ fontSize: "1.3rem", fontWeight: 700, color: INK, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{f(row.m.ytd)}</Typography>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
          year to date{row.due != null
            ? <> · <b style={{ color: reachedTone(row.m.ytd, row.due) }}>{pct(row.m.ytd / row.due)}</b> of the {f(row.due)} due by now · {pct(row.m.ytd / row.year!)} of the year&apos;s {f(row.year!)}</>
            : def.id !== "visits" ? <> · {f(row.m.ytdPy)} a year earlier</> : null}
        </Typography>
      </Box>
    </Box>
  );
}

const Legend = ({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
    <Box component="span" sx={dashed ? { width: 16, borderTop: `2px dashed ${color}` } : { width: 10, height: 10, borderRadius: "3px", bgcolor: color }} />
    {label}
  </Box>
);

/** What is set, typed in place: a growth in %, an amount, a number - saved when the field is left. */
function SetLine({ def, row, year, canEdit, owner, onSaved }: { def: TargetDef; row: Row; year: number; canEdit: boolean; owner: string; onSaved: (t: PersonTargets) => void }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = text ?? (row.set == null ? "" : def.kind === "growth" ? String(row.set) : row.set.toLocaleString("en"));
  const save = async () => {
    if (text == null) return;
    const c = checkTarget(def.id, text.trim() === "" ? null : text);
    if (!c.ok) { setErr(c.error); return; }
    if (c.value === (row.set ?? null)) { setText(null); setErr(null); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/reporting/my-sales", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner, target: def.id, value: c.value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setErr(j.error ?? "Not saved."); return; }
      onSaved(j.targets); setText(null); setErr(null);
    } finally { setBusy(false); }
  };
  const unit = def.kind === "growth" ? "%" : def.kind === "eur" ? "€" : "visits";
  const lead = def.kind === "growth" ? `Growth on ${year - 1} (${eur(row.m.py)})` : `Target ${year}`;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontWeight: 600 }}>{lead}</Typography>
      {canEdit ? (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, border: `1px solid ${err ? RED : "rgba(21,34,58,.16)"}`, borderRadius: "10px", px: 1, bgcolor: "#fff" }}>
          <InputBase value={shown} disabled={busy} placeholder="set it" inputProps={{ inputMode: "decimal", "aria-label": `${def.name}: ${lead}` }}
            onChange={(e) => { setText(e.target.value); setErr(null); }} onBlur={() => { void save(); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setText(null); setErr(null); } }}
            sx={{ width: def.kind === "growth" ? 64 : 110, fontSize: "0.86rem", fontWeight: 700, "& input": { textAlign: "right", py: 0.5 } }} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{unit}</Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: row.set == null ? FAINT : INK }}>{row.set == null ? "not set yet" : `${row.set} ${unit}`}</Typography>
      )}
      {row.year != null && def.kind === "growth" && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>= <b style={{ color: INK }}>{eur(row.year)}</b> for {year}</Typography>}
      {err && <Typography sx={{ fontSize: "0.76rem", color: RED, width: "100%" }}>{err}</Typography>}
      {row.year == null && !err && canEdit && <Typography sx={{ fontSize: "0.76rem", color: FAINT, width: "100%" }}>Set it to see each quarter against its part.</Typography>}
    </Box>
  );
}

/* ── My team | All ESO / TSA | All: each person's figure and share, no targets - one table (SARCLA 01.11.2026: "show
   them as horizontal table") ── */

function Contribution({ scopeName, cubeReady, labels, people, d, year }: {
  scopeName: string; cubeReady: NonNullable<ReturnType<typeof useCustomersCube>["cube"]>; labels: string[]; people: Set<number>;
  d: NonNullable<ReturnType<typeof useVisits>["d"]>; year: number;
}) {
  const by = useMemo(() => ({ ...revenueByPerson(cubeReady, labels), visits: visitsByPerson(d, people) }), [cubeReady, labels, d, people]);
  type P = { label: string } & Record<TargetId, number> & { prev: Record<TargetId, number> };
  const names = [...new Set(TARGETS.flatMap((t) => by[t.id].map((r) => r.label)))];
  const value = (id: TargetId, name: string) => by[id].find((r: PersonFig) => r.label === name);
  const rows: P[] = names.map((n) => {
    const row = { label: n, prev: {} as Record<TargetId, number> } as P;
    for (const t of TARGETS) { const v = value(t.id, n); row[t.id] = v?.cur ?? 0; row.prev[t.id] = v?.prev ?? 0; }
    return row;
  });
  const totals = Object.fromEntries(TARGETS.map((t) => [t.id, by[t.id].reduce((a, r) => a + r.cur, 0)])) as Record<TargetId, number>;
  const totalsPy = Object.fromEntries(TARGETS.map((t) => [t.id, by[t.id].reduce((a, r) => a + r.prev, 0)])) as Record<TargetId, number>;
  const change = (cur: number, prev: number) => (prev ? (cur - prev) / Math.abs(prev) : null);
  const cols: Col<P>[] = TARGETS.map((t) => ({
    key: t.id, head: SHORT[t.id], tip: t.name, sort: (r: P) => r[t.id],
    cell: (r: P) => {
      const ch = t.id === "visits" ? null : change(r[t.id], r.prev[t.id]);
      return (
        <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.3 }}>
          <b>{fmtOf(t.id)(r[t.id])}</b>
          <span style={{ fontSize: "0.72rem", color: MUTED }}>
            {pct(totals[t.id] ? r[t.id] / totals[t.id] : null)} of all{ch != null ? <> · <span style={{ color: ch >= 0 ? GREEN : RED }}>{ch >= 0 ? "+" : "−"}{Math.abs(ch * 100).toFixed(1)}%</span></> : null}
          </span>
        </Box>
      );
    },
  }));
  if (!rows.length) return <Note title={`No figures for ${scopeName} yet`} />;
  return (
    <ChartBox title={`${year} to date, by person - ${scopeName}`}
      hint={`Each person's figure year to date; under it their share of ${scopeName}'s, and the change against the same days of ${year - 1} - no one's target`}>
      <FullTable<P> first="Person" rows={rows} cols={cols} initial="own" find={rows.length > 12 ? "a person" : undefined}
        total={{ label: `${scopeName} in all`, ...totals, prev: totalsPy }} />
    </ChartBox>
  );
}
const SHORT: Record<TargetId, string> = { own: "Own area", dt: "Sealing (DT)", kt: "Plastics (KT)", new: "New customers", visits: "Visits" };

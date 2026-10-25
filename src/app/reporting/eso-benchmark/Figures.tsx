"use client";
// THE ESO REPORTS' FIGURES - first in the BUC View and the first page (SARCLA 24.10.2026: "simple to read: revenue per
// month per ESO; a toggle ESO | TSA | TOTAL, on click change all; OI MTD, OI YTD as the revenue; to forecast").
// Fifth version, started over (SARCLA 25.10.2026 on the fourth: the Performis SAE | Company owner switch "should not be
// a major toggle, this should be in a tab"; "graphs are still shit to steer, it doesn't follow the context with the
// tab and wraps like in digital growth"). Drawn as Digital Growth's Who are our customers: the title, ESO | TSA |
// Total and the figures top right; a tab per breakdown - the year so far, Performis SAE, company owner, country,
// sales priority, APSO customer, customer type - with Views and Filters at their right end; each tab ONE card that
// follows it: revenue and order intake side by side, the months under them, all the figures in a table. No switch
// inside a card - the tabs and the Filters window steer, a bar or a row picks its value.
// The year and month to date are the ERP's own per customer (erp_rev_* / erp_oi_*); the months are each customer's
// monthly revenue and order intake (the order intake per customer lags months behind - loaded to June in October).
// ESO and TSA by the Performis SAE (as Map assignment maps it to a person), on the Company owner tab by the owner.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { BEFORE, DimChart, THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { DIM, FilterWindow, useCustomersCube } from "@/app/reporting/marketing-kpis/Customers";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, refreshActions, send, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import {
  DIMS, MONTH_NAMES, PRIO_ORDER, byMonth, byMonthBy, chosenDims, defaultWindow, erpBy, erpTotals, lastComplete, lastMonth, monthOf, partial, yearCurve,
  type Cube, type Dim, type ErpAgg, type Filters,
} from "@/lib/marketingKpis/cube";
import type { EsoFigures } from "@/lib/reporting/esoFiguresRules";

/* ── the forecast's read: the company's own series ─────────────────────── */

type KpiState = { ok?: boolean; value?: EsoFigures; computing?: boolean; error?: string };
function useKpiSeries(): EsoFigures | null {
  const [v, setV] = useState<EsoFigures | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-figures").then((r) => r.json())
      .then((j: KpiState) => { if (!alive) return; if (j.value) setV(j.value); if (j.computing) timer = setTimeout(load, 5000); })
      .catch(() => {});
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  return v;
}

/* ── ESO | TSA | Total, and whose customers they are ───────────────────── */

export type TeamKey = "eso" | "tsa" | "total";
const TEAMS: { id: TeamKey; label: string; count: null }[] = [{ id: "eso", label: "ESO", count: null }, { id: "tsa", label: "TSA", count: null }, { id: "total", label: "Total", count: null }];
const TEAM_OF: Record<"eso" | "tsa", string> = { eso: "ESO", tsa: "TSA" };
const teamWord = (t: TeamKey) => (t === "total" ? "APSOparts" : TEAM_OF[t]);
/** ESO | TSA | Total, drawn as the pages' tabs - a click changes every figure. */
export function TeamToggle({ team, onTeam }: { team: TeamKey; onTeam: (t: TeamKey) => void }) {
  return <Box sx={{ justifySelf: "start" }}><ReportTabs name="eso-team" tab={team} onSelect={onTeam} tabs={TEAMS} /></Box>;
}

/** The two ways a customer belongs to a person: the Performis SAE (as its person), or the company owner in HubSpot. */
type PersonDim = "sae" | "owner";
const teamsOf = (cube: Cube, d: PersonDim) => (d === "sae" ? cube.saeTeams : cube.teams) ?? {};
/** A team's people by that way; null for Total. */
const membersOf = (cube: Cube, team: TeamKey, d: PersonDim) => (team === "total" ? null : cube.labels[d].filter((l) => teamsOf(cube, d)[l] === TEAM_OF[team]));
function withTeam(cube: Cube, filters: Filters, team: TeamKey, d: PersonDim): Filters {
  const members = membersOf(cube, team, d);
  if (!members) return filters;
  const chosen = filters[d]?.length ? filters[d]!.filter((o) => members.includes(o)) : members;
  return { ...filters, [d]: chosen.length ? chosen : ["\u0000 none"] };
}

/* ── the tabs ──────────────────────────────────────────────────────────── */

const BREAKDOWNS = ["sae", "owner", "country", "prio", "segment", "type"] as const;
type Breakdown = (typeof BREAKDOWNS)[number];
type View = "year" | Breakdown;
const isBreakdown = (x: string | null | undefined): x is Breakdown => (BREAKDOWNS as readonly string[]).includes(x ?? "");
/** The sales rep is the company owner here (SARCLA's word for the split). */
const NAMES: Partial<Record<Dim, string>> = { owner: "Company owner" };
const nameOf = (d: Dim) => NAMES[d] ?? DIM[d].name;
const lowerOf = (d: Dim) => (d === "owner" ? "company owner" : DIM[d].lower);
const VIEWS: { id: View; label: string }[] = [{ id: "year", label: "Year so far" }, ...BREAKDOWNS.map((d) => ({ id: d as View, label: nameOf(d) }))];
/** The team is the Performis SAE's people - on the Company owner tab the owners'. */
const teamDimOf = (v: View): PersonDim => (v === "owner" ? "owner" : "sae");
const NOTES: Record<Breakdown, string> = {
  sae: "The sales agent Performis has on the customer, as its person - the revenue as Performis splits it",
  owner: "The company owner in HubSpot today - ESO and TSA here are the companies their people own",
  country: "Where the customers are",
  prio: "Which priority bands carry the revenue",
  segment: "APSOcore, APSOgrowth, APSOprospect, APSOlost, APSOmicro, Growth Engine",
  type: "OEM, C2S workshops, MRO, resellers",
};

/* ── words and numbers, in full ────────────────────────────────────────── */

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const signedEur = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
const changeNote = (a: number, b: number) => (b ? { text: signedPct(changeOf(a, b)), color: tone(changeOf(a, b)) } : a > 0 ? { text: "new", color: GREEN } : null);

/** The day the ERP's figures are of - the file's day, else as far as the monthly revenue reaches. */
function erpDate(cube: Cube): { day: number; month: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cube.erpDay ?? "");
  if (m) return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
  const run = cube.running;
  return run ? { year: cube.years[0], month: run.month % 12, day: run.day } : null;
}
/** "13 Oct 2026" */
const dayWords = (cube: Cube, back = 0) => { const d = erpDate(cube); return d ? `${d.day} ${MONTH_NAMES[d.month]} ${d.year - back}` : "the last ERP file"; };
/** "Jan – 13 Oct 2026": the year to date, a year earlier with back = 1 */
const ytdWords = (cube: Cube, back = 0) => { const d = erpDate(cube); return d ? `Jan – ${d.day} ${MONTH_NAMES[d.month]} ${d.year - back}` : `${cube.years[back]} to date`; };
/** "1 – 13 Oct 2026": the month to date */
const mtdWords = (cube: Cube, back = 0) => { const d = erpDate(cube); return d ? `1 – ${d.day} ${MONTH_NAMES[d.month]} ${d.year - back}` : "the month to date"; };
/** This year's months read: 0 = January, the month in progress included. */
const runOf = (cube: Cube) => lastMonth(cube) - monthOf(0, 0);
/** This year's months with each customer's order intake loaded. */
const oiLoadedOf = (cube: Cube) => Math.min(cube.oiLoaded ?? runOf(cube) + 1, runOf(cube) + 1);

/* ── what every chart is drawn with ────────────────────────────────────── */

export type FigCtx = {
  cube: Cube; kpi: EsoFigures | null; team: TeamKey; view: View;
  /** the filters chosen, and with the team in them */
  filters: Filters; eff: Filters;
  /** in half a row of the BUC View */
  half?: boolean;
  /** a row or a person's months: show only it */
  onPick?: (d: Dim, label: string) => void;
  /** a bar: show only it, and the Filters window opens on its breakdown - as Who are our customers */
  onBar?: (d: Dim, label: string) => void;
  onFilter?: (d: Dim) => void;
};
const forecastShown = (c: FigCtx) => c.team === "total" && chosenDims(c.filters).length === 0 && !!c.kpi;

/** A chart's box, as DimChart's: its title and one line under it, its Actions at the right. */
function ChartBox({ title, hint, actions, children }: { title: string; hint?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0, display: "grid", gap: 1, gridTemplateColumns: "minmax(0, 1fr)", alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{title}</Typography>
          {hint && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{hint}</Typography>}
        </Box>
        {actions}
      </Box>
      {children}
    </Box>
  );
}
const TWO = { display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } } as const;
const tip = { contentStyle: { fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" } };
/** A value axis as wide as its longest figure, in full. */
const axisWidth = (max: number) => Math.max(56, eur(max).length * 7 + 10);

/* ── the year so far: each month added to the one before ───────────────── */

type Which = "rev" | "oi";
const cum = (xs: (number | null)[]) => { let s = 0; return xs.map((x) => (x == null ? null : (s += x))); };

function YearCurve({ c, which }: { c: FigCtx; which: Which }) {
  const { cube } = c;
  const y = yearCurve(cube, c.eff);
  const e = erpTotals(cube, c.eff);
  const run = runOf(cube), loaded = oiLoadedOf(cube);
  const cyMonths = which === "rev" ? y.rev.map((x, i) => (i <= run ? x : null)) : y.oi.map((x, i) => (i < loaded ? x : null));
  const cyCum = cum(cyMonths), pyCum = cum(which === "rev" ? y.revPy : y.oiPy);
  const fc = which === "rev" && forecastShown(c) ? cum(c.kpi!.total.forecast) : null;
  // the order intake per customer is loaded months behind the ERP: its curve stops where loaded, and a dashed line
  // reaches the ERP's own year to date in the running month
  const gap = which === "oi" && loaded <= run && loaded > 0;
  const ytd = which === "rev" ? e.revYtd : e.oiYtd;
  const data = MONTH_NAMES.map((x, i) => ({
    x, cy: cyCum[i], py: pyCum[i], fc: fc ? fc[i] : null,
    bridge: gap && (i === loaded - 1 || i === run) ? (i === run ? ytd : cyCum[i]) : null,
  }));
  const lastCy = gap ? run : cyCum.reduce<number>((k, v, i) => (v != null ? i : k), -1);
  const max = Math.max(1, ...pyCum.map((v) => v ?? 0), ...(fc ?? []).map((v) => v ?? 0), ytd);
  // each curve named at its end, in its colour; the two at December kept apart
  const pyEnd = pyCum[11] ?? 0, fcEnd = fc?.[11] ?? null;
  const pyDy = fcEnd != null && fcEnd > pyEnd ? 16 : -6, fcDy = fcEnd != null && fcEnd > pyEnd ? -6 : 16;
  const label = (at: number, color: string, text: (v: number) => string, dy = -8) => (p: { x?: number | string; y?: number | string; index?: number; value?: unknown }) =>
    p.index === at && p.value != null ? <text x={Number(p.x ?? 0) + 6} y={Number(p.y ?? 0) + dy} fontSize={12} fontWeight={700} fill={color}>{text(Number(p.value))}</text> : <g />;
  const CY_DY = 20;
  const [y0, y1] = cube.years;
  return (
    <ResponsiveContainer width="100%" height={c.half ? 240 : 280}>
      <ComposedChart data={data} margin={{ top: 22, right: 152, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id={`fig-${which}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={THIS} stopOpacity={0.26} />
            <stop offset="100%" stopColor={THIS} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e8ebf0" />
        <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: MUTED }} />
        <YAxis tickFormatter={(v: number) => eur(v)} tickLine={false} axisLine={false} width={axisWidth(max)} tick={{ fontSize: 11.5, fill: MUTED }} />
        <Tooltip {...tip} formatter={(v: unknown, n: unknown) => (v == null ? [null, null] : [eur(Number(v)), String(n)])} />
        {fc && <Line dataKey="fc" name={`Forecast ${y0}`} stroke="#d99a2b" strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" dot={false} isAnimationActive={false}
          label={label(11, "#b07a12", (v) => `Forecast ${eur(v)}`, fcDy)} />}
        <Line dataKey="py" name={String(y1)} stroke={BEFORE} strokeWidth={2.2} strokeDasharray="6 5" dot={false} isAnimationActive={false}
          label={label(11, MUTED, (v) => `${y1} ${eur(v)}`, pyDy)} />
        <Area dataKey="cy" name={String(y0)} stroke={THIS} strokeWidth={3} fill={`url(#fig-${which})`} dot={false} isAnimationActive={false} connectNulls={false}
          label={gap ? undefined : label(lastCy, THIS, (v) => `${y0} ${eur(v)}`, CY_DY)} />
        {gap && <Line dataKey="bridge" name={`${y0}, the ERP's year to date`} stroke={THIS} strokeWidth={2.5} strokeDasharray="4 4" connectNulls dot={{ r: 4, fill: "#fff", stroke: THIS, strokeWidth: 2 }} isAnimationActive={false}
          label={label(run, THIS, (v) => `${y0} ${eur(v)}`, CY_DY)} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
function yearCurveHint(c: FigCtx, which: Which) {
  const e = erpTotals(c.cube, c.eff);
  const [now, then] = which === "rev" ? [e.revYtd, e.revYtdPy] : [e.oiYtd, e.oiYtdPy];
  const loaded = oiLoadedOf(c.cube);
  const lag = which === "oi" && loaded <= runOf(c.cube) && loaded > 0 ? ` · each customer's months loaded to ${MONTH_NAMES[loaded - 1]}, the dashed line reaches the ERP's year to date` : "";
  return `${ytdWords(c.cube)}: ${eur(now)}, ${signedPct(changeOf(now, then))} against ${eur(then)} · ${c.cube.years[1]} dashed${which === "rev" && forecastShown(c) ? ", the forecast dotted" : ""}${lag}`;
}

/* ── month by month ────────────────────────────────────────────────────── */

/** The month under each pair of columns, and its change in its colour under it. */
function monthTick(data: { ch: number | null; missing: boolean }[]) {
  return function Tick(p: { x?: number | string; y?: number | string; payload?: { value?: string; index?: number } }) {
    const d = data[p.payload?.index ?? -1];
    return (
      <g transform={`translate(${Number(p.x ?? 0)},${Number(p.y ?? 0)})`}>
        <text dy={12} textAnchor="middle" fontSize={12} fill={MUTED}>{p.payload?.value}</text>
        {d && (d.missing
          ? <text dy={27} textAnchor="middle" fontSize={10.5} fill={FAINT}>not in</text>
          : d.ch != null && <text dy={27} textAnchor="middle" fontSize={11} fontWeight={700} fill={tone(d.ch)}>{signedPct(d.ch)}</text>)}
      </g>
    );
  };
}
function MonthColumns({ c, which }: { c: FigCtx; which: Which }) {
  const ms = byMonth(c.cube, c.eff);
  const loaded = oiLoadedOf(c.cube);
  const data = ms.map((m, i) => {
    const cur = which === "rev" ? m.rev : i < loaded ? m.oi : null;
    const prev = which === "rev" ? m.revPy : m.oiPy;
    return { x: MONTH_NAMES[i], cur, prev, ch: cur == null ? null : changeOf(cur, prev), missing: cur == null };
  });
  const max = Math.max(1, ...data.map((d) => Math.max(d.cur ?? 0, d.prev)));
  const [y0, y1] = c.cube.years;
  return (
    <ResponsiveContainer width="100%" height={c.half ? 240 : 280}>
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 4 }} barCategoryGap="22%" barGap={2}>
        <CartesianGrid vertical={false} stroke="#e8ebf0" />
        <XAxis dataKey="x" tickLine={false} axisLine={{ stroke: HAIRLINE }} interval={0} height={40} tick={monthTick(data)} />
        <YAxis tickFormatter={(v: number) => eur(v)} tickLine={false} axisLine={false} width={axisWidth(max)} tick={{ fontSize: 11.5, fill: MUTED }} />
        <Tooltip {...tip} cursor={{ fill: "rgba(21,34,58,.04)" }} formatter={(v: unknown, n: unknown) => (v == null ? ["not loaded yet", String(n)] : [eur(Number(v)), String(n)])} />
        <Bar dataKey="cur" name={String(y0)} fill={THIS} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="prev" name={String(y1)} fill={BEFORE} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
function monthColumnsHint(c: FigCtx, which: Which) {
  const run = partial(c.cube);
  const loaded = oiLoadedOf(c.cube);
  const lag = which === "oi" && loaded <= runOf(c.cube) && loaded > 0 ? ` · loaded to ${MONTH_NAMES[loaded - 1]} for each customer` : "";
  return `${c.cube.years[0]} blue, ${c.cube.years[1]} grey, the change under each month${run ? ` · ${MONTH_NAMES[run.month % 12]} to the ${run.day}th, against the same days` : ""}${lag}`;
}

/* ── a breakdown: its values, the people's months ──────────────────────── */

type ValueRow = { label: string; e: ErpAgg };
/** The values of a breakdown with figures, the largest year to date first (priority in its own order); a team's people only. */
function valuesOf(c: FigCtx, dim: Dim): ValueRow[] {
  const by = erpBy(c.cube, c.eff, dim);
  const members = (dim === "sae" || dim === "owner") && dim === teamDimOf(c.view) ? membersOf(c.cube, c.team, dim) : null;
  const rows = [...by.entries()].filter(([l, e]) => (!members || members.includes(l)) && (e.revYtd || e.revYtdPy || e.oiYtd || e.oiYtdPy)).map(([label, e]) => ({ label, e }));
  if (dim === "prio") return rows.sort((a, b) => (PRIO_ORDER.indexOf(a.label) + 99) % 99 - (PRIO_ORDER.indexOf(b.label) + 99) % 99 || a.label.localeCompare(b.label));
  return rows.sort((a, b) => b.e.revYtd - a.e.revYtd || a.label.localeCompare(b.label));
}

function ValueBars({ c, dim, which, actions }: { c: FigCtx; dim: Dim; which: Which; actions?: React.ReactNode }) {
  const rows = valuesOf(c, dim).map((r) => ({ label: r.label, rev: r.e.revYtd, cur: which === "rev" ? r.e.revYtd : r.e.oiYtd, prev: which === "rev" ? r.e.revYtdPy : r.e.oiYtdPy }));
  type R = (typeof rows)[number];
  const what = which === "rev" ? "Revenue" : "Order intake";
  return (
    <DimChart key={`${which}-${dim}`} title={`${what} ${ytdWords(c.cube)}, by ${lowerOf(dim)}`} rows={rows}
      cur={(r: R) => r.cur} prev={(r: R) => r.prev} curNote={(r: R) => changeNote(r.cur, r.prev)}
      // the period is in the title: the legend names the years, so it stays on one line in half a row
      curLabel={String(c.cube.years[0])} prevLabel={String(c.cube.years[1])} fmt={eur} pageSize={c.half ? 8 : 12} fixedOrder={dim === "prio"}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${lowerOf(dim)}`} actions={actions} />
  );
}

/** A value's months: its revenue this year against last year (dashed), its year to date and change - a click picks it. */
function MonthCard({ c, row, months, on, onClick }: { c: FigCtx; row: ValueRow; months: { rev: number; revPy: number }[]; on: boolean; onClick?: () => void }) {
  const [y0, y1] = c.cube.years;
  const data = months.map((m, i) => ({ x: MONTH_NAMES[i], cy: m.rev, py: m.revPy }));
  const ch = changeOf(row.e.revYtd, row.e.revYtdPy);
  return (
    <Box component={onClick ? "button" : "div"} type={onClick ? "button" : undefined} onClick={onClick} aria-pressed={onClick ? on : undefined}
      sx={{ font: "inherit", textAlign: "left", cursor: onClick ? "pointer" : "default", borderRadius: "14px", p: 1.25, pb: 0.5, minWidth: 0, display: "grid", gap: 0.25,
        bgcolor: on ? TINT.blue.bg : "#fff", border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.09)"}`, transition: "border-color .15s ease",
        "&:hover": onClick ? { borderColor: TINT.blue.fg } : {}, "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: 1 } }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
        <Typography noWrap title={row.label} sx={{ flex: 1, minWidth: 0, fontSize: "0.84rem", fontWeight: 700, color: INK }}>{row.label}</Typography>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{eur(row.e.revYtd)}</Typography>
        <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: row.e.revYtdPy ? tone(ch) : GREEN, whiteSpace: "nowrap" }}>{row.e.revYtdPy ? signedPct(ch) : row.e.revYtd ? "new" : "—"}</Typography>
      </Box>
      <Box sx={{ height: 96 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
            <XAxis dataKey="x" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10, fill: FAINT }} tickFormatter={(v: string) => v.slice(0, 1)} height={16} />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip {...tip} formatter={(v: unknown, n: unknown) => [eur(Number(v)), String(n)]} />
            <Line dataKey="py" name={String(y1)} stroke={BEFORE} strokeWidth={1.6} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Line dataKey="cy" name={String(y0)} stroke={THIS} strokeWidth={2.4} dot={{ r: 2, fill: THIS, strokeWidth: 0 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

function MonthCards({ c, dim, actions }: { c: FigCtx; dim: Dim; actions?: React.ReactNode }) {
  const [all, setAll] = useState(false);
  const rows = valuesOf(c, dim);
  const months = byMonthBy(c.cube, c.eff, dim);
  const chosen = c.filters[dim] ?? [];
  const FIRST = c.half ? 4 : 6;
  const base = chosen.length ? rows.filter((r) => chosen.includes(r.label)) : rows;
  const shown = all ? rows : base.slice(0, FIRST);
  // complete months only: on a curve, a month 13 days in reads as a collapse (its figure is in the year to date)
  const run = partial(c.cube);
  const complete = (ms: { rev: number; revPy: number }[]) => (run ? ms.slice(0, -1) : ms);
  const which = chosen.length ? (chosen.length === 1 ? "The one chosen" : "The ones chosen") : rows.length > FIRST ? `The largest ${FIRST} of ${rows.length}` : dim === "prio" ? "Each priority" : `All ${rows.length}`;
  return (
    <ChartBox title={`Revenue month by month, by ${lowerOf(dim)}`} actions={actions}
      hint={`${which} · the complete months, ${c.cube.years[0]} blue, ${c.cube.years[1]} dashed · the year to date and its change${c.onPick ? " · a click shows only them" : ""}`}>
      {shown.length === 0 ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Nothing with figures under these filters.</Typography> : (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: c.half ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))" } }}>
          {shown.map((r) => (
            <MonthCard key={r.label} c={c} row={r} months={complete(months.get(r.label) ?? [])} on={chosen.includes(r.label)} onClick={c.onPick ? () => c.onPick!(dim, r.label) : undefined} />
          ))}
        </Box>
      )}
      {rows.length > FIRST && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>
          {all ? (chosen.length ? "Show the ones chosen" : `Show the largest ${FIRST}`) : `Show all ${rows.length}`}
        </Button>
      )}
    </ChartBox>
  );
}

/* ── all the figures: wide, in words, any column sorts ─────────────────── */

type Col<R> = { key: string; head: string; tip?: string; cell: (r: R) => React.ReactNode; sort?: (r: R) => number };
function FullTable<R extends { label: string }>({ first, cols, rows, total, selected, onPick, tint = "blue", natural = false, initial, find }: {
  first: string; cols: Col<R>[]; rows: R[]; total?: R | null; selected?: string[]; onPick?: (label: string) => void; tint?: Tint;
  /** the column sorted by at first - the first that sorts unless given */
  initial?: string;
  /** the rows keep their own order until a header is clicked (months, priorities) */
  natural?: boolean;
  /** "a country" - a search box when there are many rows */
  find?: string;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(natural ? null : { key: initial ?? cols.find((x) => x.sort)?.key ?? "label", desc: true });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const col = sort ? cols.find((x) => x.key === sort.key) : null;
  const sorted = sort?.key === "label" ? [...rows].sort((a, b) => a.label.localeCompare(b.label) * (sort.desc ? -1 : 1))
    : col?.sort ? [...rows].sort((a, b) => (col.sort!(b) - col.sort!(a)) * (sort!.desc ? 1 : -1) || a.label.localeCompare(b.label)) : rows;
  const found = q ? sorted.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : sorted;
  const LIMIT = 25;
  const shown = open || q ? found : found.slice(0, LIMIT);
  const by = (key: string) => setSort((s) => (s?.key === key ? { key, desc: !s.desc } : { key, desc: key !== "label" }));
  const pad = cols.length > 10 ? 0.6 : 0.75;
  const head = {
    fontSize: "0.74rem", fontWeight: 700, color: MUTED, borderColor: HAIRLINE, lineHeight: 1.3, py: 1.25, px: pad, verticalAlign: "bottom" as const,
    maxWidth: 124, "& .MuiTableSortLabel-root": { whiteSpace: "normal", textAlign: "right" },
    "& .MuiTableSortLabel-root:not(.Mui-active) .MuiTableSortLabel-icon": { display: "none" },
  };
  const body = { fontSize: "0.86rem", color: INK, borderColor: HAIRLINE, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const, py: 1, px: pad };
  return (
    <Box sx={{ minWidth: 0 }}>
      {find && rows.length > 12 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, mb: 1, height: 34, maxWidth: 320, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${find}…`} inputProps={{ "aria-label": `Find ${find}` }} sx={{ fontSize: "0.86rem", flex: 1 }} />
        </Box>
      )}
      <Box sx={{ overflowX: "auto", borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" }}>
        <Table size="small" sx={{ minWidth: 860 }} aria-label={`All the figures, by ${first.toLowerCase()}`}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...head, maxWidth: "none", minWidth: 110, pl: 1.5 }}>
                <TableSortLabel active={sort?.key === "label"} direction={sort?.key === "label" && sort.desc ? "desc" : "asc"} onClick={() => by("label")}>{first}</TableSortLabel>
              </TableCell>
              {cols.map((x, i) => (
                <TableCell key={`${i}-${x.key}`} align="right" sx={head} title={x.tip}>
                  {x.sort ? <TableSortLabel active={sort?.key === x.key} direction={sort?.key === x.key && !sort.desc ? "asc" : "desc"} onClick={() => by(x.key)}>{x.head}</TableSortLabel> : x.head}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((r) => {
              const on = !!selected?.includes(r.label);
              return (
                <TableRow key={r.label} hover={!!onPick} onClick={onPick ? () => onPick(r.label) : undefined} selected={on} aria-selected={onPick ? on : undefined}
                  sx={{ cursor: onPick ? "pointer" : "default", opacity: selected?.length && !on ? 0.5 : 1, "&.Mui-selected, &.Mui-selected:hover": { bgcolor: TINT[tint].bg } }}>
                  <TableCell sx={{ ...body, fontWeight: 600, pl: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>{on && <CheckIcon sx={{ fontSize: 16, color: TINT[tint].fg }} />}{r.label}</Box>
                  </TableCell>
                  {cols.map((x, i) => <TableCell key={`${i}-${x.key}`} align="right" sx={body}>{x.cell(r)}</TableCell>)}
                </TableRow>
              );
            })}
            {total && (
              <TableRow>
                <TableCell sx={{ ...body, fontWeight: 800, borderBottom: 0, pl: 1.5 }}>{total.label}</TableCell>
                {cols.map((x, i) => <TableCell key={`${i}-${x.key}`} align="right" sx={{ ...body, fontWeight: 800, borderBottom: 0 }}>{x.cell(total)}</TableCell>)}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      {!q && found.length > LIMIT && (
        <Button size="small" onClick={() => setOpen((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, mt: 0.75 }}>{open ? `Show the first ${LIMIT}` : `Show all ${found.length}`}</Button>
      )}
    </Box>
  );
}

const zeroErp = (): ErpAgg => ({ revMtd: 0, revMtdPy: 0, revYtd: 0, revYtdPy: 0, oiMtd: 0, oiMtdPy: 0, oiYtd: 0, oiYtdPy: 0 });
/** A figure with its change under it, right-aligned - as Digital Growth's Visit tables: the table keeps to its card. */
const withChangeCell = (v: number, a: number, b: number) => (
  <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
    {eur(v)}
    <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: b ? tone(changeOf(a, b)) : a > 0 ? GREEN : FAINT }}>{b ? signedPct(changeOf(a, b)) : a > 0 ? "new" : "—"}</Box>
  </Box>
);
const changeCell = (a: number, b: number) => <span style={{ color: tone(changeOf(a, b)), fontWeight: 700 }}>{b ? signedPct(changeOf(a, b)) : a > 0 ? "new" : "—"}</span>;

function ValueTable({ c, dim }: { c: FigCtx; dim: Dim }) {
  const rows = valuesOf(c, dim);
  const total: ValueRow = { label: "Total", e: rows.reduce((t, r) => { for (const k of Object.keys(t) as (keyof ErpAgg)[]) t[k] += r.e[k]; return t; }, zeroErp()) };
  const sumRev = rows.reduce((s, r) => s + Math.max(0, r.e.revYtd), 0);
  const person = dim === "sae" || dim === "owner";
  const cube = c.cube;
  const cols: Col<ValueRow>[] = [
    ...(person && c.team === "total" ? [{ key: "team", head: "Team", cell: (r: ValueRow) => (r.label === "Total" ? "" : teamsOf(cube, dim as PersonDim)[r.label] ?? "—") }] : []),
    { key: "rev", head: `Revenue ${ytdWords(cube)}`, tip: "The ERP's revenue, the year to date", cell: (r) => eur(r.e.revYtd), sort: (r) => r.e.revYtd },
    { key: "revPy", head: `Revenue ${ytdWords(cube, 1)}`, tip: "The same days a year earlier", cell: (r) => eur(r.e.revYtdPy), sort: (r) => r.e.revYtdPy },
    { key: "diff", head: "Change in €", cell: (r) => <span style={{ color: tone(r.e.revYtd - r.e.revYtdPy) }}>{signedEur(r.e.revYtd - r.e.revYtdPy)}</span>, sort: (r) => r.e.revYtd - r.e.revYtdPy },
    { key: "change", head: "Change in %", cell: (r) => changeCell(r.e.revYtd, r.e.revYtdPy), sort: (r) => changeOf(r.e.revYtd, r.e.revYtdPy) ?? -Infinity },
    { key: "share", head: "Share of revenue", tip: "This row's part of the revenue in the table", cell: (r) => (r.e.revYtd > 0 && sumRev > 0 ? pct(r.e.revYtd / sumRev) : "—"), sort: (r) => r.e.revYtd },
    { key: "mtd", head: `Revenue ${mtdWords(cube)}`, tip: `The ERP's revenue, the month to date - under it the change against ${mtdWords(cube, 1)}`, cell: (r) => withChangeCell(r.e.revMtd, r.e.revMtd, r.e.revMtdPy), sort: (r) => r.e.revMtd },
    { key: "oi", head: `Order intake ${ytdWords(cube)}`, tip: `The ERP's order intake, the year to date - under it the change against ${ytdWords(cube, 1)}`, cell: (r) => withChangeCell(r.e.oiYtd, r.e.oiYtd, r.e.oiYtdPy), sort: (r) => r.e.oiYtd },
    { key: "oiMtd", head: `Order intake ${mtdWords(cube)}`, tip: `The ERP's order intake, the month to date - under it the change against ${mtdWords(cube, 1)}`, cell: (r) => withChangeCell(r.e.oiMtd, r.e.oiMtd, r.e.oiMtdPy), sort: (r) => r.e.oiMtd },
    { key: "b2b", head: "Book-to-bill", tip: "Order intake against revenue, the year to date", cell: (r) => (r.e.revYtd ? `${Math.round((r.e.oiYtd / r.e.revYtd) * 100)}%` : "—"), sort: (r) => (r.e.revYtd ? r.e.oiYtd / r.e.revYtd : -Infinity) },
  ];
  return <FullTable key={`${dim}-${c.team}`} first={nameOf(dim)} cols={cols} initial="rev" rows={rows} total={total} selected={c.filters[dim]} tint={DIM[dim].tint}
    onPick={c.onPick ? (l) => c.onPick!(dim, l) : undefined} natural={dim === "prio"} find={`a ${lowerOf(dim)}`} />;
}

type MonthRow = { label: string; rev: number; revPy: number; revCum: number; revPyCum: number; oi: number | null; oiPy: number; fc: number | null; erp?: boolean };
function YearTable({ c }: { c: FigCtx }) {
  const { cube } = c;
  const ms = byMonth(cube, c.eff);
  const loaded = oiLoadedOf(cube);
  const fc = forecastShown(c) ? c.kpi!.total.forecast : null;
  const run = partial(cube);
  let a = 0, b = 0;
  const rows: MonthRow[] = ms.map((m, i) => ({
    label: run && i === ms.length - 1 ? `${MONTH_NAMES[i]} (to the ${run.day}th)` : MONTH_NAMES[i],
    rev: m.rev, revPy: m.revPy, revCum: (a += m.rev), revPyCum: (b += m.revPy), oi: i < loaded ? m.oi : null, oiPy: m.oiPy, fc: fc ? fc[i] ?? 0 : null,
  }));
  const last = rows[rows.length - 1];
  // the order intake's total is the ERP's year to date: the months not loaded per customer are in it
  const e = erpTotals(cube, c.eff);
  const total: MonthRow | null = last ? {
    label: `Jan – ${MONTH_NAMES[rows.length - 1]}`, rev: last.revCum, revPy: last.revPyCum, revCum: last.revCum, revPyCum: last.revPyCum,
    oi: e.oiYtd, oiPy: e.oiYtdPy, fc: fc ? rows.reduce((s, r) => s + (r.fc ?? 0), 0) : null, erp: true,
  } : null;
  const [y0, y1] = cube.years;
  const cols: Col<MonthRow>[] = [
    { key: "rev", head: `Revenue ${y0}`, tip: `Under it the change against ${y1}`, cell: (r) => withChangeCell(r.rev, r.rev, r.revPy) },
    { key: "revPy", head: `Revenue ${y1}`, tip: "The same month a year earlier - the running month, the same days", cell: (r) => eur(r.revPy) },
    ...(fc ? [] : [{ key: "diff", head: "Change in €", cell: (r: MonthRow) => <span style={{ color: tone(r.rev - r.revPy) }}>{signedEur(r.rev - r.revPy)}</span> }]),
    { key: "cum", head: `${y0} so far`, tip: "Each month added to the one before", cell: (r) => eur(r.revCum) },
    { key: "cumPy", head: `${y1} so far`, cell: (r) => eur(r.revPyCum) },
    { key: "oi", head: `Order intake ${y0}`, tip: `Each customer's order intake, loaded to ${MONTH_NAMES[Math.max(0, loaded - 1)]} - under it the change against ${y1}`,
      cell: (r) => (r.oi == null ? <span style={{ color: FAINT }}>not loaded yet</span> : <span title={r.erp ? `The ERP's year to date, ${ytdWords(cube)}` : undefined}>{withChangeCell(r.oi, r.oi, r.oiPy)}</span>) },
    { key: "oiPy", head: `Order intake ${y1}`, cell: (r) => eur(r.oiPy) },
    ...(fc ? [
      { key: "fc", head: "Forecast", tip: "The ERP's forecast - the whole company", cell: (r: MonthRow) => eur(r.fc ?? 0) },
      { key: "reached", head: "Reached", tip: "Revenue against the forecast", cell: (r: MonthRow) => (r.fc ? pct(r.rev / r.fc) : "—") },
    ] : []),
  ];
  return <FullTable first="Month" cols={cols} rows={rows} total={total} natural />;
}

/* ── every chart by its key: the tabs draw them, and so does the BUC View ── */

type Drawn = { view: View; title: (c: FigCtx) => string; draw: (c: FigCtx, actions?: React.ReactNode) => React.ReactNode };
const yearChart = (which: Which, kind: "cum" | "mon"): Drawn => {
  const title = (c: FigCtx) => `${which === "rev" ? "Revenue" : "Order intake"}${kind === "cum" ? ", the year so far" : " month by month"}${c.team === "total" ? "" : ` - ${teamWord(c.team)}`}`;
  return {
    view: "year", title,
    draw: (c, actions) => (
      <ChartBox title={title(c)} hint={kind === "cum" ? yearCurveHint(c, which) : monthColumnsHint(c, which)} actions={actions}>
        {kind === "cum" ? <YearCurve c={c} which={which} /> : <MonthColumns c={c} which={which} />}
      </ChartBox>
    ),
  };
};
export const FIG_CHARTS: Record<string, Drawn> = {
  "year:cumrev": yearChart("rev", "cum"),
  "year:cumoi": yearChart("oi", "cum"),
  "year:monrev": yearChart("rev", "mon"),
  "year:monoi": yearChart("oi", "mon"),
  ...Object.fromEntries(BREAKDOWNS.flatMap((d): [string, Drawn][] => [
    [`${d}:rev`, { view: d, title: (c: FigCtx) => `Revenue by ${lowerOf(d)} - ${teamWord(c.team)}`, draw: (c: FigCtx, actions?: React.ReactNode) => <ValueBars c={c} dim={d} which="rev" actions={actions} /> }],
    [`${d}:oi`, { view: d, title: (c: FigCtx) => `Order intake by ${lowerOf(d)} - ${teamWord(c.team)}`, draw: (c: FigCtx, actions?: React.ReactNode) => <ValueBars c={c} dim={d} which="oi" actions={actions} /> }],
    [`${d}:months`, { view: d, title: (c: FigCtx) => `Revenue month by month, by ${lowerOf(d)} - ${teamWord(c.team)}`, draw: (c: FigCtx, actions?: React.ReactNode) => <MonthCards c={c} dim={d} actions={actions} /> }],
  ])),
};
/** A key's chart - the fourth version's keys (trajectory, people, drivers), still sent to some BUC Views, by what took their place. */
function chartOf(key: string, part?: string, split?: string): Drawn | undefined {
  const [, view, chart = ""] = key.split(":");
  if (view !== "figures") return FIG_CHARTS[`${view}:${chart}`];
  if (chart.startsWith("trajectory")) return FIG_CHARTS[part === "oi" ? "year:cumoi" : "year:cumrev"];
  if (chart.startsWith("people")) return FIG_CHARTS[`${split === "owner" ? "owner" : "sae"}:months`];
  if (chart.startsWith("drivers")) return FIG_CHARTS[`${isBreakdown(part) ? part : "country"}:rev`];
  return undefined;
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string) => React.ReactNode;
const draw = (c: FigCtx, act: Act, id: string) => { const d = FIG_CHARTS[id]; return d.draw(c, act(id, d.title(c))); };

function TabCard({ c, act, footnote }: { c: FigCtx; act: Act; footnote: React.ReactNode }) {
  const { view } = c;
  if (view === "year") return (
    <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={<ShowChartIcon />} tint="blue" title={`${teamWord(c.team)} - the year so far`}
        note={`Revenue and order intake from January, ${c.cube.years[0]} against ${c.cube.years[1]} - to ${dayWords(c.cube)}`} />
      <Box sx={{ ...TWO, mt: -1 }}>
        {draw(c, act, "year:cumrev")}
        {draw(c, act, "year:cumoi")}
        {draw(c, act, "year:monrev")}
        {draw(c, act, "year:monoi")}
      </Box>
      <Box>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>All the figures, by month</Typography>
        <YearTable c={c} />
      </Box>
      {footnote}
    </GlassCard>
  );
  const d = DIM[view];
  return (
    <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={d.icon} tint={d.tint} title={`${teamWord(c.team)} by ${lowerOf(view)}`} note={NOTES[view]} />
      <Box sx={{ ...TWO, mt: -1 }}>
        {draw(c, act, `${view}:rev`)}
        {draw(c, act, `${view}:oi`)}
      </Box>
      {draw(c, act, `${view}:months`)}
      <Box>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>All the figures, by {lowerOf(view)}</Typography>
        <ValueTable c={c} dim={view} />
      </Box>
      {footnote}
    </GlassCard>
  );
}

/* ── the figures top right: the ERP's year and month to date ───────────── */

function againstForecast(cube: Cube, kpi: EsoFigures | null) {
  if (!kpi) return null;
  const done = lastComplete(cube) - monthOf(0, 0) + 1;
  if (done < 1) return null;
  const fc = kpi.total.forecast.slice(0, done).reduce((s, x) => s + x, 0);
  const rev = kpi.total.rev.slice(0, done).reduce((s, p) => s + p.cy, 0);
  return fc ? { fc, rev, reached: rev / fc, through: MONTH_NAMES[(done - 1) % 12] } : null;
}
type Fig = { label: string; value: string; ch?: number | null; sub: string; icon: React.ReactNode; tint: Tint };
function figuresOf(e: ErpAgg, forecast: ReturnType<typeof againstForecast>): Fig[] {
  const out: Fig[] = [
    { label: "Revenue YTD", value: eur(e.revYtd), ch: changeOf(e.revYtd, e.revYtdPy), sub: `a year earlier: ${eur(e.revYtdPy)}`, icon: <EuroOutlinedIcon />, tint: "blue" },
    { label: "Revenue MTD", value: eur(e.revMtd), ch: changeOf(e.revMtd, e.revMtdPy), sub: `the same days a year earlier: ${eur(e.revMtdPy)}`, icon: <TodayOutlinedIcon />, tint: "blue" },
    { label: "Order intake YTD", value: eur(e.oiYtd), ch: changeOf(e.oiYtd, e.oiYtdPy), sub: `a year earlier: ${eur(e.oiYtdPy)}`, icon: <ShoppingBagOutlinedIcon />, tint: "purple" },
    { label: "Order intake MTD", value: eur(e.oiMtd), ch: changeOf(e.oiMtd, e.oiMtdPy), sub: `the same days a year earlier: ${eur(e.oiMtdPy)}`, icon: <TodayOutlinedIcon />, tint: "purple" },
  ];
  if (forecast) out.push({ label: "Against forecast", value: `${(forecast.reached * 100).toFixed(1)}%`, sub: `Jan–${forecast.through}: ${eur(forecast.rev)} of ${eur(forecast.fc)}`, icon: <FlagOutlinedIcon />, tint: "amber" });
  return out;
}
function FigureCards({ items }: { items: Fig[] }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${items.length}, minmax(124px, 172px))` }, flex: "0 1 auto" }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{it.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{it.value}</Typography>
            {it.ch !== undefined && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: tone(it.ch ?? null) }}>{signedPct(it.ch ?? null)}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

const KEPT = "eso.team";
function setQuery(mut: (q: URLSearchParams) => void) {
  const q = new URLSearchParams(window.location.search);
  mut(q);
  const s = q.toString();
  window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
}
const asTeam = (x: string | null): TeamKey | null => (x === "eso" || x === "tsa" || x === "total" ? x : null);
function useTeam(): [TeamKey, (t: TeamKey) => void] {
  const params = useSearchParams();
  const [kept, setKept] = useState<TeamKey | null>(null);
  useEffect(() => { try { setKept(asTeam(localStorage.getItem(KEPT))); } catch { /* ESO */ } }, []);
  const team: TeamKey = asTeam(params.get("team")) ?? kept ?? "eso";
  const set = (t: TeamKey) => {
    setQuery((q) => q.set("team", t));
    setKept(t);
    try { localStorage.setItem(KEPT, t); } catch { /* still applies here */ }
  };
  return [team, set];
}

function Waiting({ computing, progress, error }: { computing: boolean; progress?: string; error?: string }) {
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {computing && !error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>
          {error ? `The figures could not be read: ${error}` : `Reading every company in HubSpot - revenue and order intake${progress ? ` · ${progress}` : ""}…`}
        </Typography>
      </Box>
    </GlassCard>
  );
}
/** The cube read before the ERP's figures were in it (until the first new read after a deployment). */
const tooOld = (cube: Cube) => !cube.erp || !cube.saeTeams;
const FILTER_DIMS: Dim[] = ["prio", "segment", "potential", "country", "sae", "owner", "type", "apic", "mandant"];
const H1 = { fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 } as const;

export function FiguresExplorer() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const kpi = useKpiSeries();
  const params = useSearchParams();
  const [team, setTeam] = useTeam();
  const asked = params.get("view");
  const view: View = isBreakdown(asked) ? asked : "year";
  const setView = (v: View) => setQuery((q) => { if (v === "year") q.delete("view"); else q.set("view", v); });
  const filters: Filters = useMemo(() => Object.fromEntries(DIMS.flatMap((d) => (params.getAll(d).length ? [[d, params.getAll(d)]] : []))), [params]);
  const toggle = (d: Dim, label: string) => setQuery((q) => {
    const cur = q.getAll(d), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
    q.delete(d);
    for (const x of next) q.append(d, x);
  });
  const clearAll = () => setQuery((q) => { for (const d of DIMS) q.delete(d); });
  // the filters open as a window of their own, closed at first; a bar opens it on its breakdown (as Who are our customers)
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: Dim; n: number } | null>(null);
  const openOn = (d: Dim) => { setFocus((f) => ({ dim: d, n: (f?.n ?? 0) + 1 })); setPanel(true); };

  const back = (
    <Box component={Link} href="/reporting/eso-benchmark" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
      <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
    </Box>
  );
  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  if (!cube || tooOld(cube)) return (
    <Box sx={shell}>
      {back}
      <Typography component="h1" sx={H1}>Figures</Typography>
      <Waiting computing={computing || (!!cube && tooOld(cube))} progress={progress} error={error} />
    </Box>
  );
  const teamDim = teamDimOf(view);
  const eff = withTeam(cube, filters, team, teamDim);
  const c: FigCtx = { cube, kpi, team, view, filters, eff, onPick: toggle, onBar: (d, l) => { toggle(d, l); openOn(d); }, onFilter: openOn };
  const forecast = forecastShown(c) ? againstForecast(cube, kpi) : null;
  const active = chosenDims(filters);
  const chosen = active.flatMap((x) => (filters[x] ?? []).map((v) => [x, v] as const));
  // the tile toolbar per chart, keyed "eso-figures:<tab>:<chart>"; the team and the filters in force go with it
  const act: Act = (id, title) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-figures:${id}`, page: "eso-figures", tab: view, title, summary: `${teamWord(team)} · ${ytdWords(cube)}`,
        filters: { ...Object.fromEntries(active.map((d) => [d, filters[d] ?? []])), team: [team] }, kind: "card" }} />
  );
  const footnote = (
    <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
      Year and month to date: the ERP file&apos;s own figures per customer, of {dayWords(cube)}, against the same days a year earlier. The months: each customer&apos;s monthly revenue and order intake, summed
      {cube.oiLoaded != null ? ` (the order intake per customer loaded to ${MONTH_NAMES[Math.max(0, oiLoadedOf(cube) - 1)]})` : ""}.
      {team !== "total" && (teamDim === "sae"
        ? ` ${teamWord(team)}: the customers Performis gives its people (the SAE, as Map assignment maps it to a person) - a person's team from the rosters, else their HubSpot team.`
        : ` ${teamWord(team)}: the companies its people own in HubSpot today - a person's team from the rosters, else their HubSpot team.`)}
      {forecast ? " The forecast: the ERP's, the whole company - shown on Total with nothing filtered." : ""} Read from HubSpot {computedAt ? new Date(computedAt).toLocaleString("en-GB") : ""}.
    </Typography>
  );
  return (
    <Box sx={shell}>
      {back}
      {/* the title, the team and what is shown on the left; the figures top right */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>Figures</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamWord(team)}</b>{team !== "total" ? ` by ${teamDim === "sae" ? "Performis SAE" : "company owner"}` : ""} · <b style={{ color: INK }}>{ytdWords(cube)}</b> against the same days of {cube.years[1]} - the ERP&apos;s figures{computing ? " · reading HubSpot again" : ""}
          </Typography>
          <TeamToggle team={team} onTeam={setTeam} />
          {chosen.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {chosen.map(([x, v]) => (
                <Chip key={`${x}:${v}`} size="small" label={<span><b>{nameOf(x)}:</b> {v}</span>} onDelete={() => toggle(x, v)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[DIM[x].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[x].tint].fg } }} />
              ))}
              <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}>
          <FigureCards items={figuresOf(erpTotals(cube, eff), forecast)} />
        </Box>
      </Box>

      {/* the tabs, and at their right end Views and Filters - as Who are our customers */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="eso-figures" tab={view} onSelect={setView}
            tabs={VIEWS.map((v) => ({ id: v.id, label: v.label, count: v.id !== "year" && filters[v.id]?.length ? String(filters[v.id]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-figures" /></Box>
        <Button onClick={() => (panel ? setPanel(false) : view === "year" ? setPanel(true) : openOn(view))} variant={panel || active.length ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-figures-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || active.length ? undefined : "#fff" }}>
          Filters{chosen.length ? ` · ${chosen.length}` : ""}
        </Button>
      </Box>

      <TabCard key={view} c={c} act={act} footnote={footnote} />

      <FilterWindow id="eso-figures-filters" period={false} dims={FILTER_DIMS} names={NAMES} open={panel} onClose={() => setPanel(false)} focus={focus} cube={cube}
        win={defaultWindow(cube)} setWin={() => {}} filters={filters} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's first panel ────────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;

/** The figures for ESO, TSA or Total with the same toggle, the year so far - and the Figures charts sent here. */
export function FiguresPanel({ acts }: { acts: ActionsState | null }) {
  const { cube, computing, progress, error } = useCustomersCube();
  const kpi = useKpiSeries();
  const [team, setTeam] = useState<TeamKey>("eso");
  useEffect(() => { try { const x = asTeam(localStorage.getItem(KEPT)); if (x) setTeam(x); } catch { /* ESO */ } }, []);
  const pick = (t: TeamKey) => { setTeam(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const ready = cube && !tooOld(cube);
  const c: FigCtx | null = ready ? { cube, kpi, team, view: "year", filters: {}, eff: withTeam(cube, {}, team, "sae") } : null;
  const items: SortItem[] = !ready ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-figures").map(({ spec }) => {
    const ch = chartOf(spec.key, spec.filters?.part?.[0], spec.filters?.split?.[0]);
    const st = asTeam(spec.filters?.team?.[0] ?? null) ?? team;
    const sf: Filters = Object.fromEntries(DIMS.flatMap((d) => (spec.filters?.[d]?.length ? [[d, spec.filters[d]]] : [])));
    const fmt = formatOf(acts, spec);
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind }} />;
    const view = ch?.view ?? "year";
    const sc: FigCtx = { cube: cube!, kpi, team: st, view, filters: sf, eff: withTeam(cube!, sf, st, teamDimOf(view)), half: fmt === "half" };
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<QueryStatsOutlinedIcon />} tint="purple" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  });
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-figures", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = c ? figuresOf(erpTotals(c.cube, c.eff), forecastShown(c) ? againstForecast(c.cube, kpi) : null) : [];
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<QueryStatsOutlinedIcon />} tint="purple" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/figures?team=${team}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.purple.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Figures</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.purple.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamWord(team)}${team !== "total" ? " by Performis SAE" : ""} · ${ytdWords(c.cube)} against the same days of ${c.cube.years[1]}` : "Revenue and order intake"}</Typography>
        </Box>
        <TeamToggle team={team} onTeam={pick} />
      </Box>
      {!c ? <Waiting computing={computing || (!!cube && tooOld(cube))} progress={progress} error={error} /> : (
        <>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: `repeat(${figs.length}, minmax(0, 1fr))` } }}>
            {figs.map((f) => (
              <Box key={f.label} sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "grid", gap: 0.75, alignContent: "start", minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Badge icon={f.icon} tint={f.tint} size={32} />
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
                  {f.ch !== undefined && <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: tone(f.ch ?? null) }}>{signedPct(f.ch ?? null)}</Typography>}
                </Box>
                <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{f.sub}</Typography>
              </Box>
            ))}
          </Box>
          {/* the year so far, revenue and order intake side by side - the panel's own */}
          <Box sx={TWO}>
            {FIG_CHARTS["year:cumrev"].draw(c)}
            {FIG_CHARTS["year:cumoi"].draw(c)}
          </Box>
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-figures"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </>
      )}
    </GlassCard>
  );
}

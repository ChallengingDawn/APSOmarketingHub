"use client";
// THE ESO REPORTS' FIGURES - first in the BUC View and the first page (SARCLA 24.10.2026: "simple to read: revenue per
// month per ESO; a toggle ESO | TSA | TOTAL, on click change all; OI MTD, OI YTD as the revenue; to forecast").
// Drawn as Digital Growth's Who are our customers: the title, ESO | TSA | Total and the ERP's figures top right; a tab
// per view with Views and Filters at their right end; each tab ONE card that follows it, no switch inside a card.
// Sixth version (SARCLA 25.10.2026): "call it Year to date, and the month to date tab is missing"; "call really the
// graph month to date or year to date, this is really important"; Company owner "not relevant for figures, take it
// out"; the cumulative curves out ("the blue line can't be" - it ended on the customers' monthly sums, not on the
// ERP's year to date); "put also the number of customers"; the tables split - year to date, month to date; APIC and
// the profit centres as tabs; the forecast in the tables. So: Year to date | Month to date (by Performis SAE) |
// Country | Sales priority | APSO customer | Customer type | APIC | Profit center.
// The year and month to date are the ERP's own per customer (erp_rev_* / erp_oi_*); the months are each customer's
// monthly revenue and order intake, the running month the ERP's month to date. ESO and TSA by the Performis SAE.
// The ERP has the forecast (per mandant) and the revenue per profit centre for the whole company only.

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
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  DIMS, MONTH_NAMES, PRIO_ORDER, breakdown, buyersByMonthBy, byMonth, byMonthBy, chosenDims, defaultWindow, erpBy, erpTotals, lastMonth, monthOf, partial, totals,
  type Cube, type Dim, type ErpAgg, type Filters, type Win,
} from "@/lib/marketingKpis/cube";
import type { EsoFigures, Family } from "@/lib/reporting/esoFiguresRules";

/* ── the company's own series: the forecast, the profit centres ────────── */

type KpiState = { ok?: boolean; value?: EsoFigures; computing?: boolean; error?: string };
function useKpiSeries(): { kpi: EsoFigures | null; busy: boolean } {
  const [v, setV] = useState<EsoFigures | null>(null);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-figures").then((r) => r.json())
      .then((j: KpiState) => { if (!alive) return; if (j.value) setV(j.value); setBusy(!!j.computing); if (j.computing) timer = setTimeout(load, 5000); })
      .catch(() => { if (alive) setBusy(false); });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  return { kpi: v, busy };
}

/* ── ESO | TSA | Total: the Performis SAE's people ─────────────────────── */

export type TeamKey = "eso" | "tsa" | "total";
const TEAMS: { id: TeamKey; label: string; count: null }[] = [{ id: "eso", label: "ESO", count: null }, { id: "tsa", label: "TSA", count: null }, { id: "total", label: "Total", count: null }];
const TEAM_OF: Record<"eso" | "tsa", string> = { eso: "ESO", tsa: "TSA" };
const teamWord = (t: TeamKey) => (t === "total" ? "APSOparts" : TEAM_OF[t]);
/** ESO | TSA | Total, drawn as the pages' tabs - a click changes every figure. */
export function TeamToggle({ team, onTeam }: { team: TeamKey; onTeam: (t: TeamKey) => void }) {
  return <Box sx={{ justifySelf: "start" }}><ReportTabs name="eso-team" tab={team} onSelect={onTeam} tabs={TEAMS} /></Box>;
}
/** A team's Performis SAE people (the SAE as its person); null for Total. */
const membersOf = (cube: Cube, team: TeamKey) => (team === "total" ? null : cube.labels.sae.filter((l) => (cube.saeTeams ?? {})[l] === TEAM_OF[team]));
function withTeam(cube: Cube, filters: Filters, team: TeamKey): Filters {
  const members = membersOf(cube, team);
  if (!members) return filters;
  const chosen = filters.sae?.length ? filters.sae.filter((o) => members.includes(o)) : members;
  return { ...filters, sae: chosen.length ? chosen : ["\u0000 none"] };
}

/* ── the tabs ──────────────────────────────────────────────────────────── */

const BREAKDOWNS = ["country", "prio", "segment", "type", "apic"] as const;
type Breakdown = (typeof BREAKDOWNS)[number];
type View = "ytd" | "mtd" | Breakdown | "pc";
const VIEW_IDS: View[] = ["ytd", "mtd", ...BREAKDOWNS, "pc"];
const isView = (x: string | null | undefined): x is View => (VIEW_IDS as string[]).includes(x ?? "");
const isBreakdown = (x: string | null | undefined): x is Breakdown => (BREAKDOWNS as readonly string[]).includes(x ?? "");
const VIEWS: { id: View; label: string }[] = [
  { id: "ytd", label: "Year to date" }, { id: "mtd", label: "Month to date" },
  ...BREAKDOWNS.map((d) => ({ id: d as View, label: DIM[d].name })), { id: "pc", label: "Profit center" },
];
/** The breakdown a tab is drawn by: the Performis SAE on Year to date and Month to date; none on Profit center. */
const dimOf = (v: View): Dim | null => (v === "ytd" || v === "mtd" ? "sae" : v === "pc" ? null : v);
const NOTES: Record<Breakdown, string> = {
  country: "Where the customers are",
  prio: "Which priority bands carry the revenue",
  segment: "APSOcore, APSOgrowth, APSOprospect, APSOlost, APSOmicro, Growth Engine",
  type: "OEM, C2S workshops, MRO, resellers",
  apic: "The customer's APIC industry code - 1.x OEM industries, down to the sub-industry",
};

/* ── words and numbers, in full ────────────────────────────────────────── */

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const int = (n: number) => Math.round(n).toLocaleString("en");
const signedEur = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
const changeNote = (a: number, b: number) => (b ? { text: signedPct(changeOf(a, b)), color: tone(changeOf(a, b)) } : a > 0 ? { text: "new", color: GREEN } : null);

type Period = "ytd" | "mtd";
type Which = "rev" | "oi";
const PERIOD: Record<Period, string> = { ytd: "year to date", mtd: "month to date" };
const PERIOD_CAP: Record<Period, string> = { ytd: "Year to date", mtd: "Month to date" };
const WHAT: Record<Which, string> = { rev: "Revenue", oi: "Order intake" };

/** The day the ERP's figures are of - the file's day, else as far as the monthly revenue reaches. */
function erpDate(cube: Cube): { day: number; month: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cube.erpDay ?? "");
  if (m) return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
  const run = cube.running;
  return run ? { year: cube.years[0], month: run.month % 12, day: run.day } : null;
}
/** "21 Oct 2026" */
const dayWords = (cube: Cube, back = 0) => { const d = erpDate(cube); return d ? `${d.day} ${MONTH_NAMES[d.month]} ${d.year - back}` : "the last ERP file"; };
/** "1 Jan – 21 Oct 2026" (a year earlier with back = 1) and "1 – 21 Oct 2026" */
const periodWords = (cube: Cube, p: Period, back = 0) => {
  const d = erpDate(cube);
  if (!d) return p === "ytd" ? `${cube.years[back]} to date` : "the month to date";
  return p === "ytd" ? `1 Jan – ${d.day} ${MONTH_NAMES[d.month]} ${d.year - back}` : `1 – ${d.day} ${MONTH_NAMES[d.month]} ${d.year - back}`;
};
/** This year's months read: 0 = January, the month in progress included. */
const runOf = (cube: Cube) => lastMonth(cube) - monthOf(0, 0);
/** This year's months with each customer's order intake loaded. */
const oiLoadedOf = (cube: Cube) => Math.min(cube.oiLoaded ?? runOf(cube) + 1, runOf(cube) + 1);
const ytdWin = (cube: Cube): Win => ({ start: monthOf(0, 0), end: lastMonth(cube) });
const mtdWin = (cube: Cube): Win => ({ start: lastMonth(cube), end: lastMonth(cube) });
/** How far the ERP's month is: its day against the month's days (the forecast of the running month, pro rata). */
const monthShare = (cube: Cube) => { const d = erpDate(cube); return d ? d.day / new Date(Date.UTC(d.year, d.month + 1, 0)).getUTCDate() : 1; };

/* ── what every chart is drawn with ────────────────────────────────────── */

export type FigCtx = {
  cube: Cube; kpi: EsoFigures | null; kpiBusy?: boolean; team: TeamKey; view: View;
  /** the filters chosen, and with the team in them */
  filters: Filters; eff: Filters;
  /** in half a row of the BUC View */
  half?: boolean;
  /** a row or a card: show only it */
  onPick?: (d: Dim, label: string) => void;
  /** a bar: show only it, and the Filters window opens on its breakdown - as Who are our customers */
  onBar?: (d: Dim, label: string) => void;
  onFilter?: (d: Dim) => void;
};
/** The ERP's forecast is the whole company's: on Total, nothing filtered. */
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
const SubTitle = ({ children }: { children: React.ReactNode }) => <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>{children}</Typography>;

/* ── a breakdown's values: the ERP's figures, the customers ────────────── */

type ValueRow = { label: string; e: ErpAgg; cust: { ytd: number; ytdPy: number; mtd: number; mtdPy: number } };
const valueCache = new WeakMap<Filters, Map<string, ValueRow[]>>();
/** The values of a breakdown with figures - a team's own people on the Performis SAE - the largest year to date first (priority in its order). */
function valuesOf(c: FigCtx, dim: Dim): ValueRow[] {
  let memo = valueCache.get(c.eff);
  if (!memo) { memo = new Map(); valueCache.set(c.eff, memo); }
  const key = `${c.cube.generatedAt}|${dim}|${c.team}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const by = erpBy(c.cube, c.eff, dim);
  const y = new Map(breakdown(c.cube, dim, c.eff, ytdWin(c.cube)).map((r) => [r.label, r]));
  const m = new Map(breakdown(c.cube, dim, c.eff, mtdWin(c.cube)).map((r) => [r.label, r]));
  const members = dim === "sae" ? membersOf(c.cube, c.team) : null;
  const rows: ValueRow[] = [...by.entries()].filter(([l, e]) => (!members || members.includes(l)) && (e.revYtd || e.revYtdPy || e.oiYtd || e.oiYtdPy))
    .map(([label, e]) => ({ label, e, cust: { ytd: y.get(label)?.bought ?? 0, ytdPy: y.get(label)?.boughtPy ?? 0, mtd: m.get(label)?.bought ?? 0, mtdPy: m.get(label)?.boughtPy ?? 0 } }));
  if (dim === "prio") rows.sort((a, b) => ((PRIO_ORDER.indexOf(a.label) + 99) % 99) - ((PRIO_ORDER.indexOf(b.label) + 99) % 99) || a.label.localeCompare(b.label));
  else rows.sort((a, b) => b.e.revYtd - a.e.revYtd || a.label.localeCompare(b.label));
  memo.set(key, rows);
  return rows;
}
const pick = (e: ErpAgg, p: Period, w: Which): [number, number] =>
  p === "ytd" ? (w === "rev" ? [e.revYtd, e.revYtdPy] : [e.oiYtd, e.oiYtdPy]) : w === "rev" ? [e.revMtd, e.revMtdPy] : [e.oiMtd, e.oiMtdPy];
const lowerOf = (d: Dim) => DIM[d].lower;

/** Revenue or order intake, year or month to date, by a breakdown - the period in the title. */
function ValueBars({ c, dim, period, which, actions }: { c: FigCtx; dim: Dim; period: Period; which: Which; actions?: React.ReactNode }) {
  const rows = valuesOf(c, dim).map((r) => { const [cur, prev] = pick(r.e, period, which); return { label: r.label, rev: r.e.revYtd, cur, prev }; }).filter((r) => r.cur || r.prev);
  type R = (typeof rows)[number];
  return (
    <DimChart key={`${period}-${which}-${dim}`} title={`${WHAT[which]} ${PERIOD[period]}, by ${lowerOf(dim)}`} rows={rows}
      cur={(r: R) => r.cur} prev={(r: R) => r.prev} curNote={(r: R) => changeNote(r.cur, r.prev)}
      // the period is in the title and the card's: the legend names the years, on one line in half a row
      curLabel={String(c.cube.years[0])} prevLabel={`${c.cube.years[1]}, same days`} fmt={eur} pageSize={c.half ? 8 : 12} fixedOrder={dim === "prio"}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${lowerOf(dim)}`} actions={actions} />
  );
}

/* ── the year to date month by month: the ERP's month to date for the running one ── */

type MonthRow = { label: string; i: number; rev: number; revPy: number; oi: number | null; oiPy: number; cust: number; custPy: number; fc: number | null; erp: boolean };
const monthCache = new WeakMap<Filters, Map<string, MonthRow[]>>();
function monthRows(c: FigCtx): MonthRow[] {
  let memo = monthCache.get(c.eff);
  if (!memo) { memo = new Map(); monthCache.set(c.eff, memo); }
  const key = `${c.cube.generatedAt}|${c.team}|${forecastShown(c)}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const { cube } = c;
  const ms = byMonth(cube, c.eff);
  const e = erpTotals(cube, c.eff);
  const d = erpDate(cube);
  const loaded = oiLoadedOf(cube);
  const fc = forecastShown(c) ? c.kpi!.total.forecast : null;
  const rows = ms.map((m, i): MonthRow => {
    // the month the ERP's file is in: its own month to date against the same days a year earlier
    const erp = i === ms.length - 1 && !!d && d.year === cube.years[0] && d.month === i;
    const t = totals(cube, c.eff, { start: m.month, end: m.month });
    return {
      label: erp && partial(cube) ? `${MONTH_NAMES[i]} (1 – ${d!.day})` : MONTH_NAMES[i], i, erp,
      rev: erp ? e.revMtd : m.rev, revPy: erp ? e.revMtdPy : m.revPy,
      oi: erp ? e.oiMtd : i < loaded ? m.oi : null, oiPy: erp ? e.oiMtdPy : m.oiPy,
      cust: t.bought, custPy: t.boughtPy,
      fc: fc ? (fc[i] ?? 0) * (erp ? monthShare(cube) : 1) : null,
    };
  });
  memo.set(key, rows);
  return rows;
}

/** The month under each group of columns, and its change in its colour under it. */
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
const FORECAST = "#d99a2b";
function MonthColumns({ c, which }: { c: FigCtx; which: Which }) {
  const rows = monthRows(c);
  const withFc = which === "rev" && rows.some((r) => r.fc != null);
  const data = rows.map((r) => {
    const cur = which === "rev" ? r.rev : r.oi;
    const prev = which === "rev" ? r.revPy : r.oiPy;
    return { x: MONTH_NAMES[r.i], cur, prev, fc: withFc ? r.fc : null, ch: cur == null ? null : changeOf(cur, prev), missing: cur == null };
  });
  const max = Math.max(1, ...data.map((d) => Math.max(d.cur ?? 0, d.prev, d.fc ?? 0)));
  const [y0, y1] = c.cube.years;
  return (
    <ResponsiveContainer width="100%" height={c.half ? 240 : 280}>
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 4 }} barCategoryGap="20%" barGap={2}>
        <CartesianGrid vertical={false} stroke="#e8ebf0" />
        <XAxis dataKey="x" tickLine={false} axisLine={{ stroke: HAIRLINE }} interval={0} height={40} tick={monthTick(data)} />
        <YAxis tickFormatter={(v: number) => eur(v)} tickLine={false} axisLine={false} width={axisWidth(max)} tick={{ fontSize: 11.5, fill: MUTED }} />
        <Tooltip {...tip} cursor={{ fill: "rgba(21,34,58,.04)" }} formatter={(v: unknown, n: unknown) => (v == null ? ["not loaded yet", String(n)] : [eur(Number(v)), String(n)])} />
        <Bar dataKey="cur" name={String(y0)} fill={THIS} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
        <Bar dataKey="prev" name={`${y1}, same days`} fill={BEFORE} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
        {withFc && <Bar dataKey="fc" name="Forecast" fill={FORECAST} fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />}
      </BarChart>
    </ResponsiveContainer>
  );
}
function monthColumnsHint(c: FigCtx, which: Which) {
  const rows = monthRows(c);
  const last = rows[rows.length - 1];
  const loaded = oiLoadedOf(c.cube);
  const lag = which === "oi" && loaded <= runOf(c.cube) && loaded > 0 ? ` · each customer's order intake loaded to ${MONTH_NAMES[loaded - 1]}` : "";
  const fc = which === "rev" && rows.some((r) => r.fc != null) ? ", the forecast amber" : "";
  return `${c.cube.years[0]} blue, ${c.cube.years[1]} grey${fc}, the change under each month${last?.erp ? ` · ${MONTH_NAMES[last.i]}: the ERP's month to date` : ""}${lag}`;
}

/* ── month by month per value: the revenue and the customers ───────────── */

type Line = { label: string; value: string; ch: { text: string; color: string } | null };
/** A value's card: its figures, its revenue month by month against last year (dashed), its customers as columns under it. */
function MonthCard({ title, lines, rev, cust, on, onClick }: {
  title: string; lines: Line[]; rev: { x: string; cy: number; py: number }[]; cust?: { x: string; cy: number; py: number }[]; on?: boolean; onClick?: () => void;
}) {
  return (
    <Box component={onClick ? "button" : "div"} type={onClick ? "button" : undefined} onClick={onClick} aria-pressed={onClick ? !!on : undefined}
      sx={{ font: "inherit", textAlign: "left", cursor: onClick ? "pointer" : "default", borderRadius: "14px", p: 1.25, pb: 0.5, minWidth: 0, display: "grid", gap: 0.25,
        bgcolor: on ? TINT.blue.bg : "#fff", border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.09)"}`, transition: "border-color .15s ease",
        "&:hover": onClick ? { borderColor: TINT.blue.fg } : {}, "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: 1 } }}>
      <Typography noWrap title={title} sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{title}</Typography>
      {lines.map((l) => (
        <Box key={l.label} sx={{ display: "flex", alignItems: "baseline", gap: 0.75, fontSize: "0.78rem" }}>
          <Typography component="span" sx={{ flex: 1, fontSize: "0.76rem", color: MUTED }}>{l.label}</Typography>
          <Typography component="span" sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{l.value}</Typography>
          <Typography component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: l.ch?.color ?? FAINT, minWidth: 44, textAlign: "right", whiteSpace: "nowrap" }}>{l.ch?.text ?? "—"}</Typography>
        </Box>
      ))}
      <Box sx={{ height: 76, mt: 0.25 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rev} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
            <XAxis dataKey="x" hide />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip {...tip} formatter={(v: unknown, n: unknown) => [eur(Number(v)), `Revenue ${String(n)}`]} />
            <Line dataKey="py" name="last year" stroke={BEFORE} strokeWidth={1.6} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Line dataKey="cy" name="this year" stroke={THIS} strokeWidth={2.4} dot={{ r: 2, fill: THIS, strokeWidth: 0 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      {cust && (
        <Box sx={{ height: 46 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cust} margin={{ top: 2, right: 6, bottom: 0, left: 6 }} barGap={1} barCategoryGap="18%">
              <XAxis dataKey="x" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10, fill: FAINT }} tickFormatter={(v: string) => v.slice(0, 1)} height={14} />
              <YAxis hide domain={[0, "dataMax"]} />
              <Tooltip {...tip} formatter={(v: unknown, n: unknown) => [int(Number(v)), `Customers ${String(n)}`]} />
              <Bar dataKey="cy" name="this year" fill={THIS} fillOpacity={0.55} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="py" name="last year" fill={BEFORE} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
}
const CARDS_GRID = (half?: boolean) => ({ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: half ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))" } });

function MonthCards({ c, dim, actions }: { c: FigCtx; dim: Dim; actions?: React.ReactNode }) {
  const [all, setAll] = useState(false);
  const rows = valuesOf(c, dim);
  const months = byMonthBy(c.cube, c.eff, dim);
  const buyers = buyersByMonthBy(c.cube, c.eff, dim);
  const chosen = c.filters[dim] ?? [];
  const FIRST = c.half ? 4 : 6;
  const base = chosen.length ? rows.filter((r) => chosen.includes(r.label)) : rows;
  const shown = all ? rows : base.slice(0, FIRST);
  // complete months only: on a curve, a month 21 days in reads as a collapse (it is in the year to date)
  const complete = runOf(c.cube) + (partial(c.cube) ? 0 : 1);
  const which = chosen.length ? (chosen.length === 1 ? "The one chosen" : "The ones chosen") : rows.length > FIRST ? `The largest ${FIRST} of ${rows.length}` : `All ${rows.length}`;
  return (
    <ChartBox title={`Revenue and customers month by month, by ${lowerOf(dim)}`} actions={actions}
      hint={`${which} · the complete months, ${c.cube.years[0]} blue, ${c.cube.years[1]} grey · the figures: year to date against the same days of ${c.cube.years[1]}${c.onPick ? " · a click shows only them" : ""}`}>
      {shown.length === 0 ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Nothing with figures under these filters.</Typography> : (
        <Box sx={CARDS_GRID(c.half)}>
          {shown.map((r) => {
            const ms = (months.get(r.label) ?? []).slice(0, complete);
            const b = buyers.get(r.label);
            return (
              <MonthCard key={r.label} title={r.label} on={chosen.includes(r.label)} onClick={c.onPick ? () => c.onPick!(dim, r.label) : undefined}
                lines={[
                  { label: "Revenue year to date", value: eur(r.e.revYtd), ch: changeNote(r.e.revYtd, r.e.revYtdPy) },
                  { label: "Customers year to date", value: int(r.cust.ytd), ch: changeNote(r.cust.ytd, r.cust.ytdPy) },
                ]}
                rev={ms.map((m, i) => ({ x: MONTH_NAMES[i], cy: m.rev, py: m.revPy }))}
                cust={Array.from({ length: complete }, (_, i) => ({ x: MONTH_NAMES[i], cy: b?.cy[i] ?? 0, py: b?.py[i] ?? 0 }))} />
            );
          })}
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

/* ── the tables: wide, in words, any column sorts ──────────────────────── */

type Col<R> = { key: string; head: string; tip?: string; cell: (r: R) => React.ReactNode; sort?: (r: R) => number };
function FullTable<R extends { label: string }>({ first, cols, rows, total, selected, onPick, tint = "blue", natural = false, initial, find }: {
  first: string; cols: Col<R>[]; rows: R[]; total?: R | null; selected?: string[]; onPick?: (label: string) => void; tint?: Tint;
  /** the rows keep their own order until a header is clicked (months, priorities) */
  natural?: boolean;
  /** the column sorted by at first - the first that sorts unless given */
  initial?: string;
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
  const pad = cols.length > 9 ? 0.6 : 0.75;
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
        <Table size="small" sx={{ minWidth: 760 }} aria-label={first}>
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

/** A figure with its change under it, right-aligned - as Digital Growth's Visit tables: the table keeps to its card. */
const withChangeCell = (text: string, a: number, b: number) => (
  <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
    {text}
    <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: b ? tone(changeOf(a, b)) : a > 0 ? GREEN : FAINT }}>{b ? signedPct(changeOf(a, b)) : a > 0 ? "new" : "—"}</Box>
  </Box>
);
const changeCell = (a: number, b: number) => <span style={{ color: tone(changeOf(a, b)), fontWeight: 700 }}>{b ? signedPct(changeOf(a, b)) : a > 0 ? "new" : "—"}</span>;
const diffCell = (a: number, b: number) => <span style={{ color: tone(a - b) }}>{signedEur(a - b)}</span>;

/** All the figures of a breakdown for one period: the year to date, or the month to date - each its own table. */
function ValueTable({ c, dim, period }: { c: FigCtx; dim: Dim; period: Period }) {
  const rows = valuesOf(c, dim);
  const { cube } = c;
  const cu = (r: ValueRow): [number, number] => (period === "ytd" ? [r.cust.ytd, r.cust.ytdPy] : [r.cust.mtd, r.cust.mtdPy]);
  const sum = (f: (r: ValueRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const total: ValueRow = {
    label: "Total",
    e: { revMtd: sum((r) => r.e.revMtd), revMtdPy: sum((r) => r.e.revMtdPy), revYtd: sum((r) => r.e.revYtd), revYtdPy: sum((r) => r.e.revYtdPy), oiMtd: sum((r) => r.e.oiMtd), oiMtdPy: sum((r) => r.e.oiMtdPy), oiYtd: sum((r) => r.e.oiYtd), oiYtdPy: sum((r) => r.e.oiYtdPy) },
    cust: { ytd: sum((r) => r.cust.ytd), ytdPy: sum((r) => r.cust.ytdPy), mtd: sum((r) => r.cust.mtd), mtdPy: sum((r) => r.cust.mtdPy) },
  };
  const sumRev = rows.reduce((s, r) => s + Math.max(0, pick(r.e, period, "rev")[0]), 0);
  const P = PERIOD[period], y1 = cube.years[1];
  const cols: Col<ValueRow>[] = [
    ...(dim === "sae" && c.team === "total" ? [{ key: "team", head: "Team", cell: (r: ValueRow) => (r.label === "Total" ? "" : (cube.saeTeams ?? {})[r.label] ?? "—") }] : []),
    { key: "rev", head: `Revenue ${P}`, tip: `The ERP's revenue, ${periodWords(cube, period)}`, cell: (r) => eur(pick(r.e, period, "rev")[0]), sort: (r) => pick(r.e, period, "rev")[0] },
    { key: "revPy", head: `Same days ${y1}`, tip: periodWords(cube, period, 1), cell: (r) => eur(pick(r.e, period, "rev")[1]), sort: (r) => pick(r.e, period, "rev")[1] },
    { key: "diff", head: "Change in €", cell: (r) => diffCell(...pick(r.e, period, "rev")), sort: (r) => pick(r.e, period, "rev")[0] - pick(r.e, period, "rev")[1] },
    { key: "change", head: "Change in %", cell: (r) => changeCell(...pick(r.e, period, "rev")), sort: (r) => changeOf(...pick(r.e, period, "rev")) ?? -Infinity },
    { key: "share", head: "Share of revenue", tip: "This row's part of the revenue in the table", cell: (r) => { const v = pick(r.e, period, "rev")[0]; return v > 0 && sumRev > 0 ? pct(v / sumRev) : "—"; }, sort: (r) => pick(r.e, period, "rev")[0] },
    { key: "cust", head: `Customers ${P}`, tip: `The companies that bought, ${periodWords(cube, period)} - under it the change against the same months of ${y1}${period === "mtd" ? ` (its month pro rata)` : ""}`,
      cell: (r) => withChangeCell(int(cu(r)[0]), ...cu(r)), sort: (r) => cu(r)[0] },
    { key: "oi", head: `Order intake ${P}`, tip: `The ERP's order intake, ${periodWords(cube, period)} - under it the change against ${periodWords(cube, period, 1)}`,
      cell: (r) => withChangeCell(eur(pick(r.e, period, "oi")[0]), ...pick(r.e, period, "oi")), sort: (r) => pick(r.e, period, "oi")[0] },
    { key: "b2b", head: "Book-to-bill", tip: `Order intake against revenue, ${P}`, cell: (r) => { const [o] = pick(r.e, period, "oi"), [v] = pick(r.e, period, "rev"); return v ? `${Math.round((o / v) * 100)}%` : "—"; },
      sort: (r) => { const [o] = pick(r.e, period, "oi"), [v] = pick(r.e, period, "rev"); return v ? o / v : -Infinity; } },
  ];
  return <FullTable key={`${dim}-${period}-${c.team}`} first={DIM[dim].name} cols={cols} initial="rev" rows={rows} total={total} selected={c.filters[dim]} tint={DIM[dim].tint}
    onPick={c.onPick ? (l) => c.onPick!(dim, l) : undefined} natural={dim === "prio"} find={`${/^[aeiou]/i.test(lowerOf(dim)) ? "an" : "a"} ${lowerOf(dim)}`} />;
}

/** The year to date month by month - the forecast beside the revenue on Total, the ERP's year to date at the end. */
function MonthTable({ c }: { c: FigCtx }) {
  const { cube } = c;
  const rows = monthRows(c);
  const e = erpTotals(cube, c.eff);
  const yc = totals(cube, c.eff, ytdWin(cube));
  const withFc = rows.some((r) => r.fc != null);
  const fcSum = rows.reduce((s, r) => s + (r.fc ?? 0), 0);
  const end: MonthRow = { label: "Year to date", i: -1, erp: true, rev: e.revYtd, revPy: e.revYtdPy, oi: e.oiYtd, oiPy: e.oiYtdPy, cust: yc.bought, custPy: yc.boughtPy, fc: withFc ? fcSum : null };
  const loaded = oiLoadedOf(cube);
  const [y0, y1] = cube.years;
  const cols: Col<MonthRow>[] = [
    { key: "rev", head: `Revenue ${y0}`, tip: `Under it the change against ${y1} - the running month and the year to date: the ERP's, against the same days`, cell: (r) => withChangeCell(eur(r.rev), r.rev, r.revPy) },
    { key: "revPy", head: `Revenue ${y1}`, cell: (r) => eur(r.revPy) },
    { key: "diff", head: "Change in €", cell: (r) => diffCell(r.rev, r.revPy) },
    ...(withFc ? [
      { key: "fc", head: "Forecast", tip: "The ERP's forecast - the whole company (per mandant); the running month pro rata to the day", cell: (r: MonthRow) => eur(r.fc ?? 0) },
      { key: "reached", head: "Reached", tip: "Revenue against the forecast", cell: (r: MonthRow) => (r.fc ? pct(r.rev / r.fc) : "—") },
    ] : []),
    { key: "cust", head: `Customers ${y0}`, tip: `The companies that bought in the month (the year to date: in any month) - under it the change against ${y1}`, cell: (r) => withChangeCell(int(r.cust), r.cust, r.custPy) },
    { key: "oi", head: `Order intake ${y0}`, tip: `Each customer's order intake, loaded to ${MONTH_NAMES[Math.max(0, loaded - 1)]}; the running month and the year to date: the ERP's`,
      cell: (r) => (r.oi == null ? <span style={{ color: FAINT }}>not loaded yet</span> : withChangeCell(eur(r.oi), r.oi, r.oiPy)) },
    { key: "oiPy", head: `Order intake ${y1}`, cell: (r) => eur(r.oiPy) },
  ];
  return <FullTable first="Month" cols={cols} rows={rows} total={end} natural />;
}

/* ── the profit centres: the ERP's revenue, the whole company ──────────── */

type PcRow = { label: string; ytd: number; ytdPy: number; mtd: number; mtdPy: number; months: { cy: number; py: number }[] };
function pcRows(c: FigCtx): PcRow[] | null {
  const fam: Family[] | undefined = c.kpi?.pc;
  if (!fam) return null;
  const d = erpDate(c.cube);
  const run = d && d.year === c.cube.years[0] ? d.month : runOf(c.cube);
  return fam.map((f) => {
    const ms = f.months.slice(0, run + 1);
    const s = (k: "cy" | "py", to: number) => ms.slice(0, to).reduce((a, m) => a + m[k], 0);
    return { label: f.label, ytd: s("cy", run + 1), ytdPy: s("py", run + 1), mtd: ms[run]?.cy ?? 0, mtdPy: ms[run]?.py ?? 0, months: ms.slice(0, partial(c.cube) ? run : run + 1) };
  }).filter((r) => r.ytd || r.ytdPy);
}
function PcBars({ c, period, actions }: { c: FigCtx; period: Period; actions?: React.ReactNode }) {
  const rows = (pcRows(c) ?? []).map((r) => ({ label: r.label, rev: r.ytd, cur: period === "ytd" ? r.ytd : r.mtd, prev: period === "ytd" ? r.ytdPy : r.mtdPy }));
  type R = (typeof rows)[number];
  if (!pcRows(c)) return <PcWaiting busy={!!c.kpiBusy} />;
  return (
    <DimChart key={`pc-${period}`} title={`Revenue ${PERIOD[period]}, by profit center`} rows={rows} cur={(r: R) => r.cur} prev={(r: R) => r.prev} curNote={(r: R) => changeNote(r.cur, r.prev)}
      curLabel={String(c.cube.years[0])} prevLabel={String(c.cube.years[1])} fmt={eur} pageSize={12} labelWidth={240} actions={actions} />
  );
}
function PcCards({ c, actions }: { c: FigCtx; actions?: React.ReactNode }) {
  const rows = pcRows(c);
  if (!rows) return <PcWaiting busy={!!c.kpiBusy} />;
  return (
    <ChartBox title="Revenue month by month, by profit center" actions={actions}
      hint={`Each profit center · the complete months, ${c.cube.years[0]} blue, ${c.cube.years[1]} dashed · its year and month to date against ${c.cube.years[1]}`}>
      <Box sx={CARDS_GRID(c.half)}>
        {rows.map((r) => (
          <MonthCard key={r.label} title={r.label}
            lines={[{ label: "Revenue year to date", value: eur(r.ytd), ch: changeNote(r.ytd, r.ytdPy) }, { label: "Revenue month to date", value: eur(r.mtd), ch: changeNote(r.mtd, r.mtdPy) }]}
            rev={r.months.map((m, i) => ({ x: MONTH_NAMES[i], cy: m.cy, py: m.py }))} />
        ))}
      </Box>
    </ChartBox>
  );
}
function PcTable({ c, period }: { c: FigCtx; period: Period }) {
  const rows = pcRows(c) ?? [];
  const v = (r: PcRow): [number, number] => (period === "ytd" ? [r.ytd, r.ytdPy] : [r.mtd, r.mtdPy]);
  const sumRev = rows.reduce((s, r) => s + Math.max(0, v(r)[0]), 0);
  const total: PcRow = { label: "Total", ytd: rows.reduce((s, r) => s + r.ytd, 0), ytdPy: rows.reduce((s, r) => s + r.ytdPy, 0), mtd: rows.reduce((s, r) => s + r.mtd, 0), mtdPy: rows.reduce((s, r) => s + r.mtdPy, 0), months: [] };
  const P = PERIOD[period];
  const cols: Col<PcRow>[] = [
    { key: "rev", head: `Revenue ${P}`, tip: periodWords(c.cube, period), cell: (r) => eur(v(r)[0]), sort: (r) => v(r)[0] },
    { key: "revPy", head: `Same days ${c.cube.years[1]}`, cell: (r) => eur(v(r)[1]), sort: (r) => v(r)[1] },
    { key: "diff", head: "Change in €", cell: (r) => diffCell(...v(r)), sort: (r) => v(r)[0] - v(r)[1] },
    { key: "change", head: "Change in %", cell: (r) => changeCell(...v(r)), sort: (r) => changeOf(...v(r)) ?? -Infinity },
    { key: "share", head: "Share of revenue", cell: (r) => (v(r)[0] > 0 && sumRev > 0 ? pct(v(r)[0] / sumRev) : "—"), sort: (r) => v(r)[0] },
  ];
  return <FullTable key={`pc-${period}`} first="Profit center" cols={cols} initial="rev" rows={rows} total={total} />;
}
function PcWaiting({ busy }: { busy: boolean }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, display: "flex", gap: 1.25, alignItems: "center" }}>
      {busy && <CircularProgress size={16} />}
      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{busy ? "Reading the ERP's revenue per profit center…" : "The revenue per profit center could not be read."}</Typography>
    </Box>
  );
}

/* ── every chart by its key: the tabs draw them, and so does the BUC View ── */

type Drawn = { view: View; title: (c: FigCtx) => string; draw: (c: FigCtx, actions?: React.ReactNode) => React.ReactNode };
const team = (c: FigCtx) => (c.team === "total" ? "" : ` - ${teamWord(c.team)}`);
/** A chart by its id "<tab>:<chart>" - ytdrev, ytdoi, mtdrev, mtdoi, monrev, monoi, months. */
function drawnOf(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  const bar = /^(ytd|mtd)(rev|oi)$/.exec(chart);
  if (v === "pc") {
    if (bar && bar[2] === "rev") { const p = bar[1] as Period; return { view: v, title: () => `Revenue ${PERIOD[p]}, by profit center - APSOparts`, draw: (c, a) => <PcBars c={c} period={p} actions={a} /> }; }
    if (chart === "months") return { view: v, title: () => "Revenue month by month, by profit center - APSOparts", draw: (c, a) => <PcCards c={c} actions={a} /> };
    return undefined;
  }
  const dim = dimOf(v)!;
  if (bar) {
    const p = bar[1] as Period, w = bar[2] as Which;
    return { view: v, title: (c) => `${WHAT[w]} ${PERIOD[p]}, by ${lowerOf(dim)}${team(c)}`, draw: (c, a) => <ValueBars c={c} dim={dim} period={p} which={w} actions={a} /> };
  }
  if (v === "ytd" && (chart === "monrev" || chart === "monoi")) {
    const w: Which = chart === "monrev" ? "rev" : "oi";
    const title = (c: FigCtx) => `${WHAT[w]} year to date, month by month${team(c)}`;
    return { view: v, title, draw: (c, a) => <ChartBox title={title(c)} hint={monthColumnsHint(c, w)} actions={a}><MonthColumns c={c} which={w} /></ChartBox> };
  }
  if (chart === "months") return { view: v, title: (c) => `Revenue and customers month by month, by ${lowerOf(dim)}${team(c)}`, draw: (c, a) => <MonthCards c={c} dim={dim} actions={a} /> };
  return undefined;
}
/** A key's chart - the earlier versions' keys, still sent to some BUC Views, by what took their place. */
function chartOf(key: string, part?: string): Drawn | undefined {
  const [, view = "", raw = ""] = key.split(":");
  const chart = raw.split("-")[0];
  const asIs = drawnOf(`${view}:${raw}`);
  if (asIs) return asIs;
  // the fourth version: trajectory, people, drivers
  if (view === "figures") {
    if (chart === "trajectory") return drawnOf(part === "oi" ? "ytd:monoi" : "ytd:monrev");
    if (chart === "people") return drawnOf("ytd:months");
    if (chart === "drivers") return drawnOf(isBreakdown(part) ? `${part}:ytdrev` : "ytd:ytdrev");
  }
  // the fifth: the year's curves and columns, the Performis SAE and company owner tabs, the breakdowns' rev / oi
  if (view === "year") return drawnOf(chart.endsWith("oi") ? "ytd:monoi" : "ytd:monrev");
  if (view === "sae" || view === "owner") return drawnOf(chart === "months" ? "ytd:months" : chart === "oi" ? "ytd:ytdoi" : "ytd:ytdrev");
  if (isBreakdown(view)) return drawnOf(chart === "months" ? `${view}:months` : chart === "oi" ? `${view}:ytdoi` : `${view}:ytdrev`);
  return undefined;
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string) => React.ReactNode;
const draw = (c: FigCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c))); };

function TabCard({ c, act, footnote }: { c: FigCtx; act: Act; footnote: React.ReactNode }) {
  const { view, cube } = c;
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const against = (p: Period) => `${periodWords(cube, p)} against ${periodWords(cube, p, 1)}`;
  if (view === "ytd" || view === "mtd") {
    const p: Period = view;
    return (
      <GlassCard sx={card}>
        <CardTitle icon={p === "ytd" ? <DateRangeOutlinedIcon /> : <TodayOutlinedIcon />} tint="blue" title={`${teamWord(c.team)}, ${PERIOD[p]}`}
          note={`${against(p)} · by Performis SAE - the sales agent Performis has on the customer, as its person`} />
        <Box sx={{ ...TWO, mt: -1 }}>
          {draw(c, act, `${p}:${p}rev`)}
          {draw(c, act, `${p}:${p}oi`)}
        </Box>
        {p === "ytd" && (
          <>
            <Box sx={TWO}>
              {draw(c, act, "ytd:monrev")}
              {draw(c, act, "ytd:monoi")}
            </Box>
            {draw(c, act, "ytd:months")}
          </>
        )}
        <Box>
          <SubTitle>{PERIOD_CAP[p]}, by Performis SAE</SubTitle>
          <ValueTable c={c} dim="sae" period={p} />
        </Box>
        {p === "ytd" && (
          <Box>
            <SubTitle>Year to date, month by month</SubTitle>
            <MonthTable c={c} />
          </Box>
        )}
        {footnote}
      </GlassCard>
    );
  }
  if (view === "pc") return (
    <GlassCard sx={card}>
      <CardTitle icon={<CategoryOutlinedIcon />} tint="green" title="APSOparts by profit center"
        note={`Year to date ${periodWords(cube, "ytd")} and month to date ${periodWords(cube, "mtd")}, against the same days of ${cube.years[1]}`} />
      <Typography sx={{ mt: -1.5, fontSize: "0.82rem", color: MUTED, bgcolor: TINT.amber.bg, borderRadius: "10px", px: 1.5, py: 1 }}>
        The ERP gives the revenue per profit center for the whole company only: not per team, person or customer, and no order intake or forecast per profit center - ESO | TSA | Total and the filters do not change this tab.
      </Typography>
      {/* while the series is read (or when it could not be), the tab says so - no empty charts, no tables of €0 */}
      {!pcRows(c) ? <PcWaiting busy={!!c.kpiBusy} /> : (
        <>
          <Box sx={TWO}>
            {draw(c, act, "pc:ytdrev")}
            {draw(c, act, "pc:mtdrev")}
          </Box>
          {draw(c, act, "pc:months")}
          <Box><SubTitle>Year to date, by profit center</SubTitle><PcTable c={c} period="ytd" /></Box>
          <Box><SubTitle>Month to date, by profit center</SubTitle><PcTable c={c} period="mtd" /></Box>
        </>
      )}
      {footnote}
    </GlassCard>
  );
  const d = DIM[view];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={d.icon} tint={d.tint} title={`${teamWord(c.team)} by ${lowerOf(view)}`}
        note={`${NOTES[view]} · year to date ${periodWords(cube, "ytd")} and month to date ${periodWords(cube, "mtd")}, each against the same days of ${cube.years[1]}`} />
      <Box sx={{ ...TWO, mt: -1 }}>
        {draw(c, act, `${view}:ytdrev`)}
        {draw(c, act, `${view}:ytdoi`)}
        {draw(c, act, `${view}:mtdrev`)}
        {draw(c, act, `${view}:mtdoi`)}
      </Box>
      {draw(c, act, `${view}:months`)}
      <Box><SubTitle>Year to date, by {lowerOf(view)}</SubTitle><ValueTable c={c} dim={view} period="ytd" /></Box>
      <Box><SubTitle>Month to date, by {lowerOf(view)}</SubTitle><ValueTable c={c} dim={view} period="mtd" /></Box>
      {footnote}
    </GlassCard>
  );
}

/* ── the figures top right: the ERP's year and month to date ───────────── */

/** The revenue against the ERP's forecast to date (the running month pro rata) - the whole company. */
function againstForecast(cube: Cube, kpi: EsoFigures | null) {
  const d = erpDate(cube);
  if (!kpi || !d || d.year !== cube.years[0]) return null;
  const fc = kpi.total.forecast.slice(0, d.month).reduce((s, x) => s + x, 0) + (kpi.total.forecast[d.month] ?? 0) * monthShare(cube);
  const rev = erpTotals(cube, {}).revYtd;
  return fc ? { fc, rev, reached: rev / fc } : null;
}
type Fig = { label: string; value: string; ch?: number | null; sub: string; icon: React.ReactNode; tint: Tint };
function figuresOf(e: ErpAgg, forecast: ReturnType<typeof againstForecast>, cube: Cube): Fig[] {
  const out: Fig[] = [
    { label: "Revenue year to date", value: eur(e.revYtd), ch: changeOf(e.revYtd, e.revYtdPy), sub: `${periodWords(cube, "ytd", 1)}: ${eur(e.revYtdPy)}`, icon: <EuroOutlinedIcon />, tint: "blue" },
    { label: "Revenue month to date", value: eur(e.revMtd), ch: changeOf(e.revMtd, e.revMtdPy), sub: `${periodWords(cube, "mtd", 1)}: ${eur(e.revMtdPy)}`, icon: <TodayOutlinedIcon />, tint: "blue" },
    { label: "Order intake year to date", value: eur(e.oiYtd), ch: changeOf(e.oiYtd, e.oiYtdPy), sub: `${periodWords(cube, "ytd", 1)}: ${eur(e.oiYtdPy)}`, icon: <ShoppingBagOutlinedIcon />, tint: "purple" },
    { label: "Order intake month to date", value: eur(e.oiMtd), ch: changeOf(e.oiMtd, e.oiMtdPy), sub: `${periodWords(cube, "mtd", 1)}: ${eur(e.oiMtdPy)}`, icon: <TodayOutlinedIcon />, tint: "purple" },
  ];
  if (forecast) out.push({ label: "Against forecast", value: `${(forecast.reached * 100).toFixed(1)}%`, sub: `${eur(forecast.rev)} of ${eur(forecast.fc)} to ${dayWords(cube)}`, icon: <FlagOutlinedIcon />, tint: "amber" });
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
// the company owner is not the Figures' (SARCLA 25.10.2026: "not relevant for figures, take it out")
const FILTER_DIMS: Dim[] = ["prio", "segment", "potential", "country", "sae", "type", "apic", "mandant"];
const H1 = { fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 } as const;
/** An address from an earlier version (view=year, sae, owner) opens Year to date. */
const viewOf = (x: string | null): View => (isView(x) ? x : "ytd");

export function FiguresExplorer() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const { kpi, busy } = useKpiSeries();
  const params = useSearchParams();
  const [teamKey, setTeam] = useTeam();
  const view = viewOf(params.get("view"));
  const setView = (v: View) => setQuery((q) => { if (v === "ytd") q.delete("view"); else q.set("view", v); });
  const filters: Filters = useMemo(() => Object.fromEntries(DIMS.flatMap((d) => (d !== "owner" && params.getAll(d).length ? [[d, params.getAll(d)]] : []))), [params]);
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
  const eff = withTeam(cube, filters, teamKey);
  const c: FigCtx = { cube, kpi, kpiBusy: busy, team: teamKey, view, filters, eff, onPick: toggle, onBar: (d, l) => { toggle(d, l); openOn(d); }, onFilter: openOn };
  const forecast = forecastShown(c) ? againstForecast(cube, kpi) : null;
  const active = chosenDims(filters);
  const chosen = active.flatMap((x) => (filters[x] ?? []).map((v) => [x, v] as const));
  // the tile toolbar per chart, keyed "eso-figures:<tab>:<chart>"; the team and the filters in force go with it
  const act: Act = (id, title) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-figures:${id}`, page: "eso-figures", tab: view, title, summary: `${teamWord(teamKey)} · to ${dayWords(cube)}`,
        filters: { ...Object.fromEntries(active.map((d) => [d, filters[d] ?? []])), team: [teamKey] }, kind: "card" }} />
  );
  const footnote = (
    <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
      Year and month to date: the ERP file&apos;s own figures per customer, of {dayWords(cube)}, against the same days a year earlier. The months: each customer&apos;s monthly revenue and order intake, summed
      {cube.oiLoaded != null ? ` (the order intake per customer loaded to ${MONTH_NAMES[Math.max(0, oiLoadedOf(cube) - 1)]})` : ""}; the running month the ERP&apos;s month to date. Customers: the companies that bought.
      {teamKey !== "total" ? ` ${teamWord(teamKey)}: the customers Performis gives its people (the SAE, as Map assignment maps it to a person) - a person's team from the rosters, else their HubSpot team.` : ""}
      {" "}The forecast: the ERP&apos;s, per mandant - the whole company only, shown on Total with nothing filtered. Read from HubSpot {computedAt ? new Date(computedAt).toLocaleString("en-GB") : ""}.
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
            <b style={{ color: INK }}>{teamWord(teamKey)}</b>{teamKey !== "total" ? " by Performis SAE" : ""} · year to date <b style={{ color: INK }}>{periodWords(cube, "ytd")}</b>, month to date <b style={{ color: INK }}>{periodWords(cube, "mtd")}</b> - against the same days of {cube.years[1]}{computing ? " · reading HubSpot again" : ""}
          </Typography>
          <TeamToggle team={teamKey} onTeam={setTeam} />
          {chosen.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {chosen.map(([x, v]) => (
                <Chip key={`${x}:${v}`} size="small" label={<span><b>{DIM[x].name}:</b> {v}</span>} onDelete={() => toggle(x, v)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[DIM[x].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[x].tint].fg } }} />
              ))}
              <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}>
          <FigureCards items={figuresOf(erpTotals(cube, eff), forecast, cube)} />
        </Box>
      </Box>

      {/* the tabs, and at their right end Views and Filters - as Who are our customers */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="eso-figures" tab={view} onSelect={setView}
            tabs={VIEWS.map((v) => { const d = dimOf(v.id); return { id: v.id, label: v.label, count: d && v.id !== "ytd" && v.id !== "mtd" && filters[d]?.length ? String(filters[d]!.length) : null }; })} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-figures" /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else { const d = dimOf(view); if (d) openOn(d); else setPanel(true); } }} variant={panel || active.length ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-figures-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || active.length ? undefined : "#fff" }}>
          Filters{chosen.length ? ` · ${chosen.length}` : ""}
        </Button>
      </Box>

      <TabCard key={view} c={c} act={act} footnote={footnote} />

      <FilterWindow id="eso-figures-filters" period={false} dims={FILTER_DIMS} open={panel} onClose={() => setPanel(false)} focus={focus} cube={cube}
        win={defaultWindow(cube)} setWin={() => {}} filters={filters} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's first panel ────────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;

/** The figures for ESO, TSA or Total with the same toggle, the year to date month by month - and the Figures charts sent here. */
export function FiguresPanel({ acts }: { acts: ActionsState | null }) {
  const { cube, computing, progress, error } = useCustomersCube();
  const { kpi, busy } = useKpiSeries();
  const [teamKey, setTeam] = useState<TeamKey>("eso");
  useEffect(() => { try { const x = asTeam(localStorage.getItem(KEPT)); if (x) setTeam(x); } catch { /* ESO */ } }, []);
  const choose = (t: TeamKey) => { setTeam(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const ready = cube && !tooOld(cube);
  const c: FigCtx | null = ready ? { cube, kpi, kpiBusy: busy, team: teamKey, view: "ytd", filters: {}, eff: withTeam(cube, {}, teamKey) } : null;
  const items: SortItem[] = !ready ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-figures").map(({ spec }) => {
    const ch = chartOf(spec.key, spec.filters?.part?.[0]);
    const st = asTeam(spec.filters?.team?.[0] ?? null) ?? teamKey;
    const sf: Filters = Object.fromEntries(DIMS.flatMap((d) => (d !== "owner" && spec.filters?.[d]?.length ? [[d, spec.filters[d]]] : [])));
    const fmt = formatOf(acts, spec);
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind }} />;
    const sc: FigCtx = { cube: cube!, kpi, kpiBusy: busy, team: st, view: ch?.view ?? "ytd", filters: sf, eff: withTeam(cube!, sf, st), half: fmt === "half" };
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<QueryStatsOutlinedIcon />} tint="purple" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  });
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-figures", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = c ? figuresOf(erpTotals(c.cube, c.eff), forecastShown(c) ? againstForecast(c.cube, kpi) : null, c.cube) : [];
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<QueryStatsOutlinedIcon />} tint="purple" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/figures?team=${teamKey}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.purple.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Figures</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.purple.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamWord(teamKey)}${teamKey !== "total" ? " by Performis SAE" : ""} · year to date ${periodWords(c.cube, "ytd")}, month to date ${periodWords(c.cube, "mtd")} - against the same days of ${c.cube.years[1]}` : "Revenue and order intake"}</Typography>
        </Box>
        <TeamToggle team={teamKey} onTeam={choose} />
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
          {/* the year to date month by month, revenue and order intake side by side - the panel's own */}
          <Box sx={TWO}>
            {drawnOf("ytd:monrev")!.draw(c)}
            {drawnOf("ytd:monoi")!.draw(c)}
          </Box>
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-figures"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </>
      )}
    </GlassCard>
  );
}

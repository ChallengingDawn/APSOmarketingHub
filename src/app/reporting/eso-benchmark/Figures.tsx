"use client";
// THE ESO REPORTS' FIGURES - first in the BUC View and the first page (SARCLA 24.10.2026: "simple to read: revenue per
// month per ESO; a toggle ESO | TSA | TOTAL, on click change all; OI MTD, OI YTD as the revenue; to forecast" - the
// forecast "on total per month, as it is today on the dashboard"). Second version the same day (SARCLA: "the toggle
// should follow the design of Digital Growth; rethink the graphics, this is far from good; the filters should be
// country and the others, as in Digital Growth"): built on Who are our customers' cube and drawn as that page -
// the same Filters window and periods, a tab per breakdown, revenue and order intake side by side as its charts,
// then all the figures; ESO | TSA | Total as its tabs are drawn. The forecast (the ERP's, the whole company) is the
// KPI series the HubSpot dashboard reads (src/lib/reporting/esoFigures.ts), shown on Total with nothing filtered.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { DIM, FilterWindow, useCustomersCube } from "@/app/reporting/marketing-kpis/Customers";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, refreshActions, send, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import {
  DIMS, MONTH_NAMES, breakdown, byMonth, chosenDims, clampWindow, defaultWindow, lastComplete, monthOf, partial, presets, sortRows, totals, windowLabel,
  yearOfMonth, type Agg, type Cube, type Dim, type Filters, type Win,
} from "@/lib/marketingKpis/cube";
import type { EsoFigures } from "@/lib/reporting/esoFiguresRules";
import { ChartBox } from "./EsoKit";

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

/* ── ESO | TSA | Total ─────────────────────────────────────────────────── */

export type TeamKey = "eso" | "tsa" | "total";
const TEAMS: { id: TeamKey; label: string; count: null }[] = [{ id: "eso", label: "ESO", count: null }, { id: "tsa", label: "TSA", count: null }, { id: "total", label: "Total", count: null }];
const TEAM_OF: Record<"eso" | "tsa", string> = { eso: "ESO", tsa: "TSA" };
const teamWord = (t: TeamKey) => (t === "total" ? "APSOparts" : TEAM_OF[t]);
/** The sales reps of a team, as the cube names them; null for Total. */
const teamOwners = (cube: Cube, team: TeamKey) => (team === "total" ? null : cube.labels.owner.filter((l) => cube.teams?.[l] === TEAM_OF[team]));
/** The filters with the team: its sales reps, or those of them chosen; nothing when none of the chosen is in the team. */
function withTeam(cube: Cube, filters: Filters, team: TeamKey): Filters {
  const owners = teamOwners(cube, team);
  if (!owners) return filters;
  const chosen = filters.owner?.length ? filters.owner.filter((o) => owners.includes(o)) : owners;
  return { ...filters, owner: chosen.length ? chosen : ["\u0000 none"] };
}

/** ESO | TSA | Total, drawn as the pages' tabs - a click changes every figure. */
export function TeamToggle({ team, onTeam }: { team: TeamKey; onTeam: (t: TeamKey) => void }) {
  return <Box sx={{ justifySelf: "start" }}><ReportTabs name="eso-team" tab={team} onSelect={onTeam} tabs={TEAMS} /></Box>;
}

/* ── words and numbers, in full (as Who are our customers) ─────────────── */

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const int = (n: number) => Math.round(n).toLocaleString("en");
const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
const Chg = ({ a, b }: { a: number; b: number }) => <Box component="span" sx={{ fontWeight: 700, color: tone(changeOf(a, b)) }}>{b ? signedPct(changeOf(a, b)) : "—"}</Box>;
const ym = (cube: Cube, k: number) => `${yearOfMonth(cube, k)}-${String((k % 12) + 1).padStart(2, "0")}`;
const fromYm = (cube: Cube, s: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})$/.exec(s ?? "");
  return m ? (Number(m[1]) - cube.years[2]) * 12 + Number(m[2]) - 1 : null;
};
/** The month in progress, as "Oct to the 23rd"; null when the data end with a whole month. */
function runningWords(cube: Cube): string | null {
  const run = partial(cube);
  if (!run) return null;
  const d = run.day, th = d % 100 >= 11 && d % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][d % 10] ?? "th";
  return `${MONTH_NAMES[run.month % 12]} to the ${d}${th}`;
}

/* ── the figures top right: revenue and order intake, year and month to date ── */

/** The windows the four figures stand on: the year to date, and the month to date (the last month when it is complete). */
function fixedWindows(cube: Cube) {
  const p = presets(cube);
  const ytd = defaultWindow(cube);
  const mtd = p.find((x) => x.id === "mtd")?.win ?? p.find((x) => x.id === "lm")!.win;
  return { ytd, mtd, mtdName: p.some((x) => x.id === "mtd") ? "MTD" : MONTH_NAMES[mtd.end % 12] };
}

/** Completed months of this year: the company's revenue (ERP series) against the ERP's forecast. */
function againstForecast(cube: Cube, kpi: EsoFigures | null) {
  if (!kpi) return null;
  const done = lastComplete(cube) - monthOf(0, 0) + 1;
  if (done < 1) return null;
  const fc = kpi.total.forecast.slice(0, done).reduce((s, x) => s + x, 0);
  const rev = kpi.total.rev.slice(0, done).reduce((s, p) => s + p.cy, 0);
  return fc ? { fc, rev, reached: rev / fc, through: MONTH_NAMES[(done - 1) % 12] } : null;
}

type Fig = { label: string; value: string; ch?: number | null; sub: string; icon: React.ReactNode; tint: Tint };
export function figuresOf(cube: Cube, eff: Filters, forecast: ReturnType<typeof againstForecast>): Fig[] {
  const { ytd, mtd, mtdName } = fixedWindows(cube);
  const y = totals(cube, eff, ytd), m = totals(cube, eff, mtd);
  const out: Fig[] = [
    { label: "Revenue YTD", value: eur(y.rev), ch: changeOf(y.rev, y.revPy), sub: `a year earlier: ${eur(y.revPy)}`, icon: <EuroOutlinedIcon />, tint: "blue" },
    { label: `Revenue ${mtdName}`, value: eur(m.rev), ch: changeOf(m.rev, m.revPy), sub: `a year earlier: ${eur(m.revPy)}`, icon: <TodayOutlinedIcon />, tint: "blue" },
    { label: "Order intake YTD", value: eur(y.oi), ch: changeOf(y.oi, y.oiPy), sub: `a year earlier: ${eur(y.oiPy)}`, icon: <ShoppingBagOutlinedIcon />, tint: "purple" },
    { label: `Order intake ${mtdName}`, value: eur(m.oi), ch: changeOf(m.oi, m.oiPy), sub: `a year earlier: ${eur(m.oiPy)}`, icon: <TodayOutlinedIcon />, tint: "purple" },
  ];
  if (forecast) out.push({ label: "Against forecast", value: `${(forecast.reached * 100).toFixed(1)}%`, sub: `Jan–${forecast.through}: ${eur(forecast.rev)} of ${eur(forecast.fc)}`, icon: <FlagOutlinedIcon />, tint: "amber" });
  return out;
}

/** The figures, each in a small card - Who are our customers' KpiCards. */
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

/* ── the charts, by key "<tab>:<chart>": the page draws them, and so does the BUC View ── */

const DIM_TABS: Dim[] = ["owner", "country", "prio", "segment", "type"];
export type FigCtx = {
  cube: Cube; kpi: EsoFigures | null; team: TeamKey;
  /** the filters chosen, and with the team in them */
  filters: Filters; eff: Filters; win: Win;
  actions?: React.ReactNode; half?: boolean;
  /** a bar picks its value (on the page) */
  onPick?: (dim: Dim, label: string) => void; onFilter?: (dim: Dim) => void;
};
/** One breakdown under the filters and the team: a team's sales reps only on the Sales rep tab. */
function rowsOf(c: FigCtx, dim: Dim) {
  const rows = breakdown(c.cube, dim, c.eff, c.win);
  const owners = dim === "owner" ? teamOwners(c.cube, c.team) : null;
  const kept = owners ? rows.filter((r) => owners.includes(r.label)) : rows;
  return dim === "prio" ? kept : sortRows(kept, "rev", dim);
}
const forecastShown = (c: FigCtx) => c.team === "total" && chosenDims(c.filters).length === 0 && !!c.kpi;

function MonthColumns({ c, which }: { c: FigCtx; which: "rev" | "oi" }) {
  const months = byMonth(c.cube, c.eff);
  const run = partial(c.cube);
  const data = months.map((m) => ({ x: `${MONTH_NAMES[m.month % 12]}${run && m.month === run.month ? "*" : ""}`, current: which === "rev" ? m.rev : m.oi, prior: which === "rev" ? m.revPy : m.oiPy, partial: !!run && m.month === run.month }));
  return (
    <ChartFrame table={{ columns: ["Month", String(c.cube.years[0]), String(c.cube.years[1]), "Change"], rows: data.map((d) => [d.x, Math.round(d.current), Math.round(d.prior), signedPct(changeOf(d.current, d.prior))]), numeric: [1, 2] }}>
      <GroupedColumns data={data} currentLabel={String(c.cube.years[0])} priorLabel={String(c.cube.years[1])} height={c.half ? 220 : 260} />
    </ChartFrame>
  );
}
const monthNote = (c: FigCtx) => `${teamWord(c.team)} · ${c.cube.years[0]} month by month against ${c.cube.years[1]}${runningWords(c.cube) ? ` · ${runningWords(c.cube)}*, against the same days of ${c.cube.years[1]}` : ""}`;

export const FIG_CHARTS: Record<string, { title: (c: FigCtx) => string; when?: (c: FigCtx) => boolean; draw: (c: FigCtx) => React.ReactNode }> = {
  "months:revenue": { title: (c) => `Revenue per month - ${teamWord(c.team)}`, draw: (c) => <ChartBox title={`Revenue per month - ${teamWord(c.team)}`} note={monthNote(c)} actions={c.actions}><MonthColumns c={c} which="rev" /></ChartBox> },
  "months:intake": { title: (c) => `Order intake per month - ${teamWord(c.team)}`, draw: (c) => <ChartBox title={`Order intake per month - ${teamWord(c.team)}`} note={monthNote(c)} actions={c.actions}><MonthColumns c={c} which="oi" /></ChartBox> },
  "months:forecast": {
    title: () => "Revenue against the forecast",
    when: forecastShown,
    draw: (c) => {
      const k = c.kpi!;
      const done = lastComplete(c.cube) - monthOf(0, 0) + 1;
      const data = MONTH_NAMES.map((x, i) => ({ x, current: i < done ? k.total.rev[i].cy : 0, prior: k.total.forecast[i] ?? 0, partial: false }));
      return (
        <ChartBox title="Revenue against the forecast" note={`APSOparts · the completed months against the ERP's forecast, the whole year - the company's own series, as on the HubSpot dashboard`} actions={c.actions}>
          <ChartFrame table={{ columns: ["Month", `Revenue ${k.year}`, `Forecast ${k.year}`, "Reached"], rows: data.map((d, i) => [d.x, i < done ? Math.round(d.current) : "—", Math.round(d.prior), i < done && d.prior ? `${((d.current / d.prior) * 100).toFixed(1)}%` : "—"]), numeric: [1, 2] }}>
            <GroupedColumns data={data} currentLabel={`Revenue ${k.year}`} priorLabel={`Forecast ${k.year}`} height={c.half ? 220 : 260} />
          </ChartFrame>
        </ChartBox>
      );
    },
  },
  ...Object.fromEntries(DIM_TABS.flatMap((d) => [
    [`${d}:revenue`, {
      title: (c: FigCtx) => `Revenue, by ${DIM[d].lower} - ${teamWord(c.team)}`,
      draw: (c: FigCtx) => <DimChart title={`Revenue, by ${DIM[d].lower} - ${teamWord(c.team)}`} rows={rowsOf(c, d)} cur={(r) => r.rev} prev={(r) => r.revPy} curLabel={windowLabel(c.cube, c.win)} prevLabel={windowLabel(c.cube, c.win, 1)}
        fmt={eur} fixedOrder={d === "prio"} pageSize={c.half ? 6 : 12} selected={c.filters[d]} actions={c.actions}
        onPick={c.onPick ? (l) => c.onPick!(d, l) : undefined} onFilter={c.onFilter ? () => c.onFilter!(d) : undefined} filterLabel={`Filter by ${DIM[d].lower}`} />,
    }],
    [`${d}:intake`, {
      title: (c: FigCtx) => `Order intake, by ${DIM[d].lower} - ${teamWord(c.team)}`,
      draw: (c: FigCtx) => <DimChart title={`Order intake, by ${DIM[d].lower} - ${teamWord(c.team)}`} rows={rowsOf(c, d)} cur={(r) => r.oi} prev={(r) => r.oiPy} curLabel={windowLabel(c.cube, c.win)} prevLabel={windowLabel(c.cube, c.win, 1)}
        fmt={eur} fixedOrder={d === "prio"} pageSize={c.half ? 6 : 12} selected={c.filters[d]} actions={c.actions}
        onPick={c.onPick ? (l) => c.onPick!(d, l) : undefined} onFilter={c.onFilter ? () => c.onFilter!(d) : undefined} filterLabel={`Filter by ${DIM[d].lower}`} />,
    }],
  ])),
};

/* ── all the figures ───────────────────────────────────────────────────── */

const HEAD = ["Revenue", "A year earlier", "Change", "Order intake", "A year earlier", "Change"];
const figCells = (a: Pick<Agg, "rev" | "revPy" | "oi" | "oiPy">) => [eur(a.rev), <Box key="r" component="span" sx={{ color: MUTED }}>{eur(a.revPy)}</Box>, <Chg key="rc" a={a.rev} b={a.revPy} />, eur(a.oi), <Box key="o" component="span" sx={{ color: MUTED }}>{eur(a.oiPy)}</Box>, <Chg key="oc" a={a.oi} b={a.oiPy} />];

function MonthTable({ c }: { c: FigCtx }) {
  const months = byMonth(c.cube, c.eff);
  const run = partial(c.cube);
  const all = totals(c.cube, c.eff, { start: monthOf(0, 0), end: months[months.length - 1]?.month ?? monthOf(0, 0) });
  return (
    <Table head={["Month", ...HEAD]} firstWidth="minmax(150px, 1.2fr)" minWidth={170 + 6 * 120}
      rows={[
        ...months.map((m) => ({ key: String(m.month), cells: [run && m.month === run.month ? `${MONTH_NAMES[m.month % 12]}* (${runningWords(c.cube)})` : MONTH_NAMES[m.month % 12], ...figCells(m)] })),
        { key: "total", strong: true, cells: [`${windowLabel(c.cube, { start: monthOf(0, 0), end: months[months.length - 1]?.month ?? monthOf(0, 0) })}`, ...figCells(all)] },
      ]} />
  );
}

function DimTable({ c, dim, onPick }: { c: FigCtx; dim: Dim; onPick?: (label: string) => void }) {
  // a value with nothing in either year (81 countries on file, half of them empty) is no row - unless it is chosen
  const rows = rowsOf(c, dim).filter((r) => r.rev || r.revPy || r.oi || r.oiPy || r.bought || c.filters[dim]?.includes(r.label));
  // the total of the rows shown, as on Who are our customers (a breakdown shows all its values, its own filter only lights them)
  const all = rows.reduce((t, r) => ({ rev: t.rev + r.rev, revPy: t.revPy + r.revPy, oi: t.oi + r.oi, oiPy: t.oiPy + r.oiPy, bought: t.bought + r.bought }), { rev: 0, revPy: 0, oi: 0, oiPy: 0, bought: 0 });
  return (
    <Table head={[DIM[dim].name, ...HEAD, "Companies that bought"]} firstWidth="minmax(200px, 1.8fr)" minWidth={220 + 7 * 120}
      rows={[
        ...rows.map((r) => ({ key: r.label, on: c.filters[dim]?.includes(r.label), onPick: onPick ? () => onPick(r.label) : undefined, cells: [r.label, ...figCells(r), int(r.bought)] })),
        { key: "total", strong: true, cells: ["Total", ...figCells(all), int(all.bought)] },
      ]} />
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

type View = "months" | Dim;
const TABS: { id: View; label: string }[] = [{ id: "months", label: "Months" }, ...DIM_TABS.map((d) => ({ id: d as View, label: DIM[d].name }))];
const KEPT = "eso.team";
function setQuery(mut: (q: URLSearchParams) => void) {
  const q = new URLSearchParams(window.location.search);
  mut(q);
  const s = q.toString();
  window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
}
/** ESO | TSA | Total: in the address (a saved view keeps it) and in this browser (the BUC View and the next visit open on it). */
function useTeam(): [TeamKey, (t: TeamKey) => void] {
  const params = useSearchParams();
  const asked = params.get("team");
  const [kept, setKept] = useState<TeamKey | null>(null);
  useEffect(() => { try { const x = localStorage.getItem(KEPT); if (x === "eso" || x === "tsa" || x === "total") setKept(x); } catch { /* a private window starts on ESO */ } }, []);
  const team: TeamKey = asked === "eso" || asked === "tsa" || asked === "total" ? asked : kept ?? "eso";
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

export function FiguresExplorer() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const kpi = useKpiSeries();
  const params = useSearchParams();
  const [team, setTeam] = useTeam();
  const view: View = (TABS.find((t) => t.id === params.get("view"))?.id ?? "months") as View;
  const setView = (v: View) => setQuery((q) => { if (v === "months") q.delete("view"); else q.set("view", v); });
  const filters: Filters = useMemo(() => Object.fromEntries(DIMS.flatMap((d) => (params.getAll(d).length ? [[d, params.getAll(d)]] : []))), [params]);
  const toggle = (d: Dim, label: string) => setQuery((q) => {
    const cur = q.getAll(d), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
    q.delete(d);
    for (const x of next) q.append(d, x);
  });
  const clearAll = () => setQuery((q) => { for (const d of DIMS) q.delete(d); q.delete("from"); q.delete("to"); });
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: Dim; n: number } | null>(null);
  const openOn = (dim: Dim) => { setFocus((f) => ({ dim, n: (f?.n ?? 0) + 1 })); setPanel(true); };

  if (!cube) return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gap: 1.75 }}>
      <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" } }}>Figures</Typography>
      <Waiting computing={computing} progress={progress} error={error} />
    </Box>
  );
  const s = fromYm(cube, params.get("from")), e = fromYm(cube, params.get("to"));
  const win: Win = s != null && e != null ? clampWindow(cube, { start: s, end: e }) : defaultWindow(cube);
  const setWin = (w: Win) => setQuery((q) => { const d = defaultWindow(cube); if (w.start === d.start && w.end === d.end) { q.delete("from"); q.delete("to"); } else { q.set("from", ym(cube, w.start)); q.set("to", ym(cube, w.end)); } });
  const eff = withTeam(cube, filters, team);
  const c: FigCtx = { cube, kpi, team, filters, eff, win, onPick: (d, l) => { toggle(d, l); openOn(d); }, onFilter: openOn };
  const forecast = forecastShown(c) ? againstForecast(cube, kpi) : null;
  const chosen = chosenDims(filters).flatMap((x) => (filters[x] ?? []).map((v) => [x, v] as const));
  const charts = Object.keys(FIG_CHARTS).filter((k) => k.startsWith(`${view}:`) && (FIG_CHARTS[k].when?.(c) ?? true));
  const act = (key: string, title: string) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-figures:${view}:${key}`, page: "eso-figures", tab: view, title, summary: `${teamWord(team)} · ${windowLabel(cube, win)} against ${windowLabel(cube, win, 1)}`,
        filters: { ...Object.fromEntries(chosenDims(filters).map((d) => [d, filters[d] ?? []])), team: [team] }, from: ym(cube, win.start), to: ym(cube, win.end), kind: "card" }} />
  );
  const w = windowLabel(cube, win), pw = windowLabel(cube, win, 1);
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 }}>
      <Box component={Link} href="/reporting/eso-benchmark" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
        <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
      </Box>
      {/* the title, the period and the team on the left; the figures top right */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>Figures</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamWord(team)}</b> · {view === "months" ? `${cube.years[0]} month by month against ${cube.years[1]}` : <><b style={{ color: INK }}>{w}</b> against {pw}</>}{computing ? " · reading HubSpot again" : ""}
          </Typography>
          <TeamToggle team={team} onTeam={setTeam} />
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
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><FigureCards items={figuresOf(cube, eff, forecast)} /></Box>
      </Box>

      {/* the tabs, Views and Filters at their right end */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="eso-figures" tab={view} onSelect={setView} tabs={TABS.map((t) => ({ ...t, count: t.id !== "months" && filters[t.id as Dim]?.length ? String(filters[t.id as Dim]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-figures" /></Box>
        <Button onClick={() => (panel ? setPanel(false) : view === "months" ? setPanel(true) : openOn(view))} variant={panel || chosen.length ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-figures-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length ? undefined : "#fff" }}>
          Filters{chosen.length ? ` · ${chosen.length}` : ""}
        </Button>
      </Box>

      {/* the tab: its charts side by side, then all the figures */}
      <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <CardTitle icon={view === "months" ? <CalendarMonthOutlinedIcon /> : DIM[view].icon} tint={view === "months" ? "blue" : DIM[view].tint}
          title={view === "months" ? `${teamWord(team)}, month by month` : `${teamWord(team)}, by ${DIM[view].lower}`}
          note={view === "months" ? "Revenue and order intake this year against last - the period in Filters applies to the other tabs" : `Revenue and order intake, ${w} against ${pw} - a click on a bar shows only it`} />
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, mt: -1 }}>
          {charts.map((k, i) => (
            <Box key={`${k}-${team}`} sx={{ minWidth: 0, gridColumn: { lg: charts.length % 2 === 1 && i === charts.length - 1 ? "1 / -1" : "auto" } }}>
              {FIG_CHARTS[k].draw({ ...c, actions: act(k.split(":")[1], FIG_CHARTS[k].title(c)) })}
            </Box>
          ))}
        </Box>
        <Box>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>{view === "months" ? "All the figures, month by month" : `All the figures, by ${DIM[view].lower}`}</Typography>
          {view === "months" ? <MonthTable c={c} /> : <DimTable c={c} dim={view} onPick={(l) => toggle(view, l)} />}
        </Box>
        <Typography component="div" sx={{ fontSize: "0.76rem", color: FAINT }}>
          Every company in HubSpot, as on Who are our customers: revenue from each company&apos;s monthly revenue, order intake from its monthly order intake (the nightly ERP loads)
          {runningWords(cube) ? `; ${runningWords(cube)} against the same month a year earlier pro rata` : ""}. ESO and TSA = the companies their sales reps own today (the rosters).
          {forecastShown(c) ? " The forecast: the ERP's, the whole company, against the company's own revenue series - as on the HubSpot dashboard." : team === "total" && chosen.length ? " The forecast is the whole company's: it shows with nothing filtered." : ""}
        </Typography>
      </GlassCard>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Read from HubSpot {computedAt ? new Date(computedAt).toLocaleString("en-GB") : ""} · again with every ERP delivery, at the latest every 6 hours.</Typography>

      <FilterWindow id="eso-figures-filters" open={panel} onClose={() => setPanel(false)} focus={focus} cube={cube} win={win} setWin={setWin} filters={filters} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's first panel ────────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;

/** The figures for ESO, TSA or Total with the same toggle, revenue per month - and the Figures charts sent here. */
export function FiguresPanel({ acts }: { acts: ActionsState | null }) {
  const { cube, computing, progress, error } = useCustomersCube();
  const kpi = useKpiSeries();
  const [team, setTeam] = useState<TeamKey>("eso");
  useEffect(() => { try { const x = localStorage.getItem(KEPT); if (x === "eso" || x === "tsa" || x === "total") setTeam(x); } catch { /* ESO */ } }, []);
  const pick = (t: TeamKey) => { setTeam(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const c: FigCtx | null = cube ? { cube, kpi, team, filters: {}, eff: withTeam(cube, {}, team), win: defaultWindow(cube) } : null;
  const items: SortItem[] = !cube ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-figures").map(({ spec }) => {
    const [, tab, card] = spec.key.split(":");
    const ch = FIG_CHARTS[`${tab}:${card}`];
    const sent = spec.filters?.team?.[0];
    const st: TeamKey = sent === "eso" || sent === "tsa" || sent === "total" ? sent : team;
    const sf: Filters = Object.fromEntries(DIMS.flatMap((d) => (spec.filters?.[d]?.length ? [[d, spec.filters[d]]] : [])));
    const s0 = fromYm(cube, spec.from), e0 = fromYm(cube, spec.to);
    const fmt = formatOf(acts, spec);
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, from: spec.from, to: spec.to, href: spec.href, kind: spec.kind }} />;
    const sc: FigCtx = { cube, kpi, team: st, filters: sf, eff: withTeam(cube, sf, st), win: s0 != null && e0 != null ? clampWindow(cube, { start: s0, end: e0 }) : defaultWindow(cube), actions, half: fmt === "half" };
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch && (ch.when?.(sc) ?? true) ? ch.draw(sc) : <GlassCard><CardTitle icon={<QueryStatsOutlinedIcon />} tint="purple" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  });
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-figures", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = c ? figuresOf(c.cube, c.eff, forecastShown(c) ? againstForecast(c.cube, kpi) : null) : [];
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<QueryStatsOutlinedIcon />} tint="purple" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/figures?team=${team}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.purple.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Figures</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.purple.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamWord(team)} · ${windowLabel(c.cube, c.win)} against ${windowLabel(c.cube, c.win, 1)}` : "Revenue and order intake"}</Typography>
        </Box>
        <TeamToggle team={team} onTeam={pick} />
      </Box>
      {!c ? <Waiting computing={computing} progress={progress} error={error} /> : (
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
          {/* revenue per month - the panel's own chart */}
          {FIG_CHARTS["months:revenue"].draw(c)}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-figures"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </>
      )}
    </GlassCard>
  );
}

"use client";
// THE ESO REPORTS' FIGURES - first in the BUC View and the first page (SARCLA 24.10.2026: "simple to read: revenue per
// month per ESO; a toggle ESO | TSA | TOTAL, on click change all; OI MTD, OI YTD as the revenue; to forecast").
// Third version the same night (SARCLA: "the graphs' design is still not good - you are copying the existing
// dashboard; more fluid, more logic, more data on the graph; it is hard to read - think differently"), the direction
// SARCLA chose: a TRAJECTORY (the year so far as fluid cumulative curves - this year, last year, the forecast), the
// PEOPLE (a card each: their months as a curve against last year, the year to date, order intake, book-to-bill),
// the DRIVERS (who moves the figure: a row per country, priority… with the value, a bar, € and % against last year).
// The year to date and month to date are the ERP's own per company (erp_rev_* / erp_oi_*): the monthly order intake
// per company lags months behind (SARCLA: "not sure the figures are right" - order intake MTD read 0). ESO | TSA |
// Total as the pages' tabs, the Filters window as Digital Growth's (without its period: the ERP's figures are to date).
// Split by the Performis SAE - the sales agent Performis has on the customer, as its person - or by the company owner
// (SARCLA 24.10.2026: "the revenue should come from Performis SAE, the split as well next to the company owner; TSA as
// individuals, not only TSA Team" - under the owner most TSA customers sit with "TSA Team").

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
import ShowChartIcon from "@mui/icons-material/ShowChart";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AlignHorizontalLeftOutlinedIcon from "@mui/icons-material/AlignHorizontalLeftOutlined";
import { Area, ComposedChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { THIS, BEFORE } from "@/app/reporting/marketing-kpis/DimChart";
import { DIM, FilterWindow, useCustomersCube } from "@/app/reporting/marketing-kpis/Customers";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, refreshActions, send, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import {
  DIMS, MONTH_NAMES, byMonthBy, chosenDims, defaultWindow, erpBy, erpTotals, lastComplete, lastMonth, monthOf, yearCurve,
  type Cube, type Dim, type ErpAgg, type Filters, type MonthFig,
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

/* ── ESO | TSA | Total ─────────────────────────────────────────────────── */

export type TeamKey = "eso" | "tsa" | "total";
const TEAMS: { id: TeamKey; label: string; count: null }[] = [{ id: "eso", label: "ESO", count: null }, { id: "tsa", label: "TSA", count: null }, { id: "total", label: "Total", count: null }];
const TEAM_OF: Record<"eso" | "tsa", string> = { eso: "ESO", tsa: "TSA" };
const teamWord = (t: TeamKey) => (t === "total" ? "APSOparts" : TEAM_OF[t]);
/** Who the figures are split by: the Performis SAE (its person), or the company's owner in HubSpot. */
export type Split = "sae" | "owner";
const SPLITS: { id: Split; label: string }[] = [{ id: "sae", label: "Performis SAE" }, { id: "owner", label: "Company owner" }];
const teamsOf = (cube: Cube, split: Split) => (split === "sae" ? cube.saeTeams : cube.teams) ?? {};
/** The people of a team under the split, as the cube names them; null for Total. */
const teamMembers = (cube: Cube, team: TeamKey, split: Split) => (team === "total" ? null : cube.labels[split].filter((l) => teamsOf(cube, split)[l] === TEAM_OF[team]));
function withTeam(cube: Cube, filters: Filters, team: TeamKey, split: Split): Filters {
  const members = teamMembers(cube, team, split);
  if (!members) return filters;
  const chosen = filters[split]?.length ? filters[split]!.filter((o) => members.includes(o)) : members;
  return { ...filters, [split]: chosen.length ? chosen : ["\u0000 none"] };
}
/** ESO | TSA | Total, drawn as the pages' tabs - a click changes every figure. */
export function TeamToggle({ team, onTeam }: { team: TeamKey; onTeam: (t: TeamKey) => void }) {
  return <Box sx={{ justifySelf: "start" }}><ReportTabs name="eso-team" tab={team} onSelect={onTeam} tabs={TEAMS} /></Box>;
}

/** A small switch in the tabs' look: a white pill, the chosen part light blue. */
function Switch<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <Box role="group" aria-label={label} sx={{ display: "inline-flex", p: 0.4, gap: 0.25, borderRadius: "12px", bgcolor: "rgba(255,255,255,.85)", border: `1px solid ${HAIRLINE}` }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Box key={o.id} component="button" type="button" aria-pressed={on} onClick={() => onChange(o.id)}
            sx={{ border: 0, font: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 600, px: 1.4, py: 0.55, borderRadius: "9px", cursor: "pointer", bgcolor: on ? TINT.blue.bg : "transparent", color: on ? TINT.blue.fg : MUTED, "&:hover": { color: on ? TINT.blue.fg : INK } }}>
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── words and numbers ─────────────────────────────────────────────────── */

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
/** a short figure where a curve or a row is busy: €2.14M, €214k, €940 */
const short = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  return a >= 1e6 ? `${s}€${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M` : a >= 1e4 ? `${s}€${Math.round(a / 1e3)}k` : `${s}€${Math.round(a).toLocaleString("en")}`;
};
const signedShort = (n: number) => `${n > 0 ? "+" : ""}${short(n)}`;
const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
const pctPlain = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${Math.round(x * 100)}%`);
const ym = (cube: Cube, k: number) => `${cube.years[2] + Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
/** "21 Oct 2026" - the ERP file's day */
const erpDayWords = (cube: Cube) => (cube.erpDay ? new Date(`${cube.erpDay}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "the last ERP file");
/** the running month's index (0 = January) the ERP's month to date is of */
const erpMonth = (cube: Cube) => (cube.erpDay ? Number(cube.erpDay.slice(5, 7)) - 1 : (lastMonth(cube) - monthOf(0, 0)));

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
export function figuresOf(e: ErpAgg, forecast: ReturnType<typeof againstForecast>): Fig[] {
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

/* ── what every section is drawn with ──────────────────────────────────── */

export type FigCtx = {
  cube: Cube; kpi: EsoFigures | null; team: TeamKey; split: Split;
  /** the filters chosen, and with the team in them */
  filters: Filters; eff: Filters;
  actions?: React.ReactNode; half?: boolean;
  /** on the page: a person or a value picks itself; Total's team cards switch the toggle */
  onPick?: (dim: Dim, label: string) => void; onTeam?: (t: TeamKey) => void;
};
const forecastShown = (c: FigCtx) => c.team === "total" && chosenDims(c.filters).length === 0 && !!c.kpi;

/** A section: glass, its title and note, its Actions - the BUC View draws it the same. */
function Section({ icon, tint, title, note, right, actions, children }: { icon: React.ReactNode; tint: Tint; title: string; note?: string; right?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 220 }}><CardTitle icon={icon} tint={tint} title={title} note={note} /></Box>
        {right}
        {actions}
      </Box>
      {children}
    </GlassCard>
  );
}

/* ── 1 · the trajectory: the year so far, as curves ────────────────────── */

type Which = "rev" | "oi";
const cum = (xs: (number | null)[]) => { let s = 0; return xs.map((x) => (x == null ? null : (s += x))); };

function Trajectory({ c, which }: { c: FigCtx; which: Which }) {
  const { cube } = c;
  const y = yearCurve(cube, c.eff);
  const e = erpTotals(cube, c.eff);
  const run = lastMonth(cube) - monthOf(0, 0);
  // order intake per company is loaded month by month behind the ERP: this year's curve stops where it is loaded,
  // and the ERP's own year to date closes the line at the running month (dashed: the months between not loaded)
  const oiLoaded = Math.min(cube.oiLoaded ?? run + 1, run + 1);
  const cyMonths = which === "rev" ? y.rev.map((x, i) => (i <= run ? x : null)) : y.oi.map((x, i) => (i < oiLoaded ? x : null));
  const pyMonths = which === "rev" ? y.revPy : y.oiPy;
  const cyCum = cum(cyMonths), pyCum = cum(pyMonths);
  const fc = which === "rev" && forecastShown(c) ? cum(c.kpi!.total.forecast) : null;
  const gap = which === "oi" && oiLoaded <= run;
  const ytd = which === "rev" ? e.revYtd : e.oiYtd, ytdPy = which === "rev" ? e.revYtdPy : e.oiYtdPy;
  const data = MONTH_NAMES.map((x, i) => ({
    x, cy: cyCum[i], py: pyCum[i], fc: fc ? fc[i] : null,
    // the dashed bridge: from the last month loaded to the ERP's year to date
    bridge: gap && (i === oiLoaded - 1 || i === run) ? (i === run ? ytd : cyCum[i]) : null,
    m: cyMonths[i], mPy: pyMonths[i],
  }));
  const lastCy = gap ? run : cyCum.reduce<number>((k, v, i) => (v != null ? i : k), -1);
  const ch = changeOf(ytd, ytdPy);
  // a curve's name and figure at its end, in its colour - the rest of the curve unlabelled
  const label = (at: number, color: string, text: (v: number) => string) => (p: { x?: number | string; y?: number | string; index?: number; value?: unknown }) =>
    p.index === at && p.value != null ? <text x={Number(p.x ?? 0) + 8} y={Number(p.y ?? 0) + 4} fontSize={12} fontWeight={700} fill={color}>{text(Number(p.value))}</text> : <g />;
  return (
    <ChartFrame table={{
      columns: ["Month", String(cube.years[0]), String(cube.years[1]), "Change", `${cube.years[0]} so far`, `${cube.years[1]} so far`, ...(fc ? ["Forecast so far"] : [])],
      rows: MONTH_NAMES.map((x, i) => [x, data[i].m == null ? "—" : Math.round(data[i].m!), Math.round(data[i].mPy), data[i].m == null ? "—" : signedPct(changeOf(data[i].m!, data[i].mPy)), data[i].cy == null ? "—" : Math.round(data[i].cy!), Math.round(data[i].py!), ...(fc ? [Math.round(fc[i] ?? 0)] : [])]),
      numeric: [1, 2, 4, 5, ...(fc ? [6] : [])],
    }}>
      <ResponsiveContainer width="100%" height={c.half ? 260 : 340}>
        <ComposedChart data={data} margin={{ top: 16, right: 150, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`traj-${which}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={THIS} stopOpacity={0.28} />
              <stop offset="100%" stopColor={THIS} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e8ebf0" />
          <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: MUTED }} />
          <YAxis tickFormatter={(v: number) => short(v)} tickLine={false} axisLine={false} width={62} tick={{ fontSize: 11.5, fill: MUTED }} />
          <Tooltip contentStyle={{ fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" }}
            formatter={(v: unknown, n: unknown) => (v == null ? [null, null] : [eur(Number(v)), String(n)])} />
          {fc && <Line dataKey="fc" name={`Forecast ${cube.years[0]}, so far`} stroke="#d99a2b" strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" dot={false} isAnimationActive={false}
            label={label(11, "#b07a12", (v) => `Forecast ${short(v)}`)} />}
          <Line dataKey="py" name={`${cube.years[1]}, so far`} stroke={BEFORE} strokeWidth={2.2} strokeDasharray="6 5" dot={false} isAnimationActive={false}
            label={label(11, MUTED, (v) => `${cube.years[1]} ${short(v)}`)} />
          <Area dataKey="cy" name={`${cube.years[0]}, so far`} stroke={THIS} strokeWidth={3} fill={`url(#traj-${which})`} dot={false} isAnimationActive={false} connectNulls={false}
            label={gap ? undefined : label(lastCy, THIS, (v) => `${cube.years[0]} ${short(v)} ${ch == null ? "" : signedPct(ch)}`)} />
          {gap && <Line dataKey="bridge" name={`${cube.years[0]}, the ERP's year to date`} stroke={THIS} strokeWidth={2.5} strokeDasharray="4 4" connectNulls dot={{ r: 4, fill: "#fff", stroke: THIS, strokeWidth: 2 }} isAnimationActive={false}
            label={label(run, THIS, (v) => `${cube.years[0]} ${short(v)} ${ch == null ? "" : signedPct(ch)}`)} />}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function TrajectorySection({ c, which, setWhich }: { c: FigCtx; which: Which; setWhich?: (w: Which) => void }) {
  const run = lastMonth(c.cube) - monthOf(0, 0);
  const oiGap = which === "oi" && (c.cube.oiLoaded ?? run + 1) <= run;
  const note = which === "rev"
    ? `${teamWord(c.team)} · each month added to the one before - ${c.cube.years[0]} as a filled curve to ${erpDayWords(c.cube)}, ${c.cube.years[1]} dashed${forecastShown(c) ? ", the ERP's forecast dotted" : ""}; the label: the ERP's year to date against the same days a year earlier`
    : `${teamWord(c.team)} · each month added to the one before${oiGap ? ` - the customers' order intake is loaded to ${MONTH_NAMES[(c.cube.oiLoaded ?? 1) - 1]}, the dashed line reaches the ERP's year to date` : ""}`;
  return (
    <Section icon={<ShowChartIcon />} tint="blue" title={which === "rev" ? "The year so far - revenue" : "The year so far - order intake"} note={note} actions={c.actions}
      right={setWhich ? <Switch label="Revenue or order intake" value={which} onChange={setWhich} options={[{ id: "rev", label: "Revenue" }, { id: "oi", label: "Order intake" }]} /> : undefined}>
      <Trajectory c={c} which={which} />
    </Section>
  );
}

/* ── 2 · the people: a card each ───────────────────────────────────────── */

type Person = { key: string; label: string; e: ErpAgg; months: MonthFig[]; team?: TeamKey };
const zeroErp = (): ErpAgg => ({ revMtd: 0, revMtdPy: 0, revYtd: 0, revYtdPy: 0, oiMtd: 0, oiMtdPy: 0, oiYtd: 0, oiYtdPy: 0 });
const addErp = (a: ErpAgg, b: ErpAgg) => { for (const k of Object.keys(a) as (keyof ErpAgg)[]) a[k] += b[k]; return a; };
const addMonths = (a: MonthFig[], b: MonthFig[]) => a.map((m, i) => ({ ...m, rev: m.rev + (b[i]?.rev ?? 0), revPy: m.revPy + (b[i]?.revPy ?? 0), oi: m.oi + (b[i]?.oi ?? 0), oiPy: m.oiPy + (b[i]?.oiPy ?? 0) }));

/** ESO or TSA: its people; Total: the teams. Largest year to date first. */
function peopleOf(c: FigCtx): Person[] {
  const erp = erpBy(c.cube, c.eff, c.split);
  const months = byMonthBy(c.cube, c.eff, c.split);
  const blank = () => (months.values().next().value as MonthFig[] | undefined)?.map((m) => ({ ...m, rev: 0, revPy: 0, oi: 0, oiPy: 0 })) ?? [];
  if (c.team !== "total") {
    const owners = new Set(teamMembers(c.cube, c.team, c.split) ?? []);
    const chosen = c.filters[c.split]?.length ? new Set(c.filters[c.split]) : null;
    return [...new Set([...erp.keys(), ...months.keys()])].filter((o) => owners.has(o) && (!chosen || chosen.has(o)))
      .map((o) => ({ key: o, label: o, e: erp.get(o) ?? zeroErp(), months: months.get(o) ?? blank() }))
      .filter((p) => p.e.revYtd || p.e.revYtdPy || p.e.oiYtd || p.months.some((m) => m.rev || m.revPy))
      .sort((a, b) => b.e.revYtd - a.e.revYtd);
  }
  const groups: [string, string, TeamKey | undefined][] = [["ESO", "ESO", "eso"], ["TSA", "TSA", "tsa"], ["Other", c.split === "sae" ? "Other SAE" : "Other owners", undefined], ["None", c.split === "sae" ? "No SAE" : "No owner", undefined]];
  const teamOfOwner = (o: string) => (o === "No owner" || o === "No SAE" ? "None" : teamsOf(c.cube, c.split)[o] ?? "Other");
  return groups.map(([k, label, team]) => {
    const own = [...new Set([...erp.keys(), ...months.keys()])].filter((o) => teamOfOwner(o) === k);
    return { key: k, label, team, e: own.reduce((a, o) => addErp(a, erp.get(o) ?? zeroErp()), zeroErp()), months: own.reduce((a, o) => addMonths(a, months.get(o) ?? blank()), blank()) };
  }).filter((p) => p.e.revYtd || p.e.revYtdPy || p.e.oiYtd);
}

function PersonCard({ p, on, onClick, cube }: { p: Person; on?: boolean; onClick?: () => void; cube: Cube }) {
  const ch = changeOf(p.e.revYtd, p.e.revYtdPy), oiCh = changeOf(p.e.oiYtd, p.e.oiYtdPy), mCh = changeOf(p.e.revMtd, p.e.revMtdPy);
  const b2b = p.e.revYtd ? p.e.oiYtd / p.e.revYtd : null;
  const data = p.months.map((m) => ({ x: MONTH_NAMES[m.month % 12], cy: m.rev, py: m.revPy }));
  return (
    <Box component={onClick ? "button" : "div"} type={onClick ? "button" : undefined} onClick={onClick} aria-pressed={onClick ? !!on : undefined}
      sx={{ ...glass, all: undefined, textAlign: "left", font: "inherit", cursor: onClick ? "pointer" : "default", borderRadius: "18px", p: 1.75, display: "grid", gap: 0.5, minWidth: 0,
        bgcolor: on ? TINT.blue.bg : "rgba(255,255,255,.78)", border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.08)"}`, boxShadow: "0 6px 20px rgba(31,45,78,.05)",
        transition: "border-color .15s ease, transform .15s ease", "&:hover": onClick ? { borderColor: TINT.blue.fg, transform: "translateY(-1px)" } : {} }}>
      <Typography noWrap title={p.label} sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{p.label}</Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, color: INK, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{short(p.e.revYtd)}</Typography>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: tone(ch) }}>{signedPct(ch)}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>vs {short(p.e.revYtdPy)}</Typography>
      </Box>
      <Box sx={{ height: 64, mx: -0.5 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="x" hide />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip contentStyle={{ fontSize: "0.75rem", borderRadius: 8, border: "1px solid rgba(21,34,58,.1)", padding: "4px 8px" }} formatter={(v: unknown, n: unknown) => [eur(Number(v)), String(n)]} />
            <Line dataKey="py" name={String(cube.years[1])} stroke={BEFORE} strokeWidth={1.6} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Line dataKey="cy" name={String(cube.years[0])} stroke={THIS} strokeWidth={2.4} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      {/* label left, figure and change right - one line each */}
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", columnGap: 0.75, rowGap: 0.3, alignItems: "baseline", fontSize: "0.74rem", color: MUTED, borderTop: "1px solid rgba(21,34,58,.07)", pt: 0.75, whiteSpace: "nowrap" }}>
        <span>Order intake</span><b style={{ color: INK, textAlign: "right" }}>{short(p.e.oiYtd)}</b><span style={{ color: tone(oiCh), fontWeight: 700, textAlign: "right" }}>{signedPct(oiCh)}</span>
        <span>{MONTH_NAMES[erpMonth(cube)]} so far</span><b style={{ color: INK, textAlign: "right" }}>{short(p.e.revMtd)}</b><span style={{ color: tone(mCh), fontWeight: 700, textAlign: "right" }}>{signedPct(mCh)}</span>
        <span title="order intake against revenue, year to date">Book-to-bill</span><b style={{ color: INK, textAlign: "right" }}>{pctPlain(b2b)}</b><span />
      </Box>
    </Box>
  );
}

function PeopleSection({ c }: { c: FigCtx }) {
  const people = peopleOf(c);
  const [all, setAll] = useState(false);
  const LIMIT = c.half ? 4 : 12;
  const shown = all ? people : people.slice(0, LIMIT);
  const total = c.team === "total";
  return (
    <Section icon={<GroupsOutlinedIcon />} tint="purple" title={`${total ? "The teams" : `The people - ${teamWord(c.team)}`} · by ${c.split === "sae" ? "Performis SAE" : "company owner"}`} actions={c.actions}
      note={`${total ? "A card per team" : `A card per ${teamWord(c.team)} person, the largest first`}, ${c.split === "sae" ? "as Performis has the customers (the SAE, as its person)" : "as HubSpot has the customers (their owner today)"}: the year to date against the same days a year earlier, the months as a curve (dashed: last year) - a click ${total ? "opens the team" : "shows only them"}`}>
      {people.length === 0 ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Nobody with figures under these filters.</Typography> : (
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(auto-fill, minmax(230px, 1fr))" } }}>
          {shown.map((p) => (
            <PersonCard key={p.key} p={p} cube={c.cube} on={!total && !!c.filters[c.split]?.includes(p.label)}
              onClick={total ? (p.team && c.onTeam ? () => c.onTeam!(p.team!) : undefined) : c.onPick ? () => c.onPick!(c.split, p.label) : undefined} />
          ))}
        </Box>
      )}
      {people.length > LIMIT && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? "Show fewer" : `Show all ${people.length}`}</Button>
      )}
    </Section>
  );
}

/* ── 3 · the drivers: who moves the figure ─────────────────────────────── */

const DRIVER_DIMS: Dim[] = ["country", "prio", "segment", "type", "sae", "owner"];
type SortBy = "value" | "change";

function DriverRows({ c, dim, sortBy }: { c: FigCtx; dim: Dim; sortBy: SortBy }) {
  const [all, setAll] = useState(false);
  const by = erpBy(c.cube, c.eff, dim);
  const owners = dim === "owner" || dim === "sae" ? teamMembers(c.cube, c.team, dim) : null;
  const rows = [...by.entries()].filter(([l, e]) => (!owners || owners.includes(l)) && (e.revYtd || e.revYtdPy || e.oiYtd || e.oiYtdPy))
    .map(([label, e]) => ({ label, e, diff: e.revYtd - e.revYtdPy }))
    .sort((a, b) => (sortBy === "change" ? Math.abs(b.diff) - Math.abs(a.diff) : b.e.revYtd - a.e.revYtd) || a.label.localeCompare(b.label));
  const max = Math.max(1, ...rows.map((r) => Math.max(r.e.revYtd, r.e.revYtdPy)));
  const LIMIT = c.half ? 8 : 12;
  const shown = all ? rows : rows.slice(0, LIMIT);
  const sel = c.filters[dim] ?? [];
  const cols = { xs: "minmax(110px, 1.2fr) 90px 80px", md: "minmax(150px, 1.3fr) 100px minmax(120px, 1.6fr) 90px 70px 100px 70px 80px" };
  const head = ["", "Revenue YTD", "", "vs last year", "", "Order intake", "", "Book-to-bill"];
  const hideMd = { display: { xs: "none", md: "block" } };
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: cols, columnGap: 1.25, px: 1, pb: 0.5, borderBottom: `1px solid ${HAIRLINE}` }}>
        {head.map((h, i) => (
          <Typography key={i} sx={{ fontSize: "0.66rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i === 0 || i === 2 ? "left" : "right", ...(i > 2 ? hideMd : {}), ...(i === 2 ? hideMd : {}) }}>{h}</Typography>
        ))}
      </Box>
      {shown.map((r) => {
        const ch = changeOf(r.e.revYtd, r.e.revYtdPy), oiCh = changeOf(r.e.oiYtd, r.e.oiYtdPy), on = sel.includes(r.label);
        const b2b = r.e.revYtd ? r.e.oiYtd / r.e.revYtd : null;
        return (
          <Box key={r.label} component={c.onPick ? "button" : "div"} type={c.onPick ? "button" : undefined} onClick={c.onPick ? () => c.onPick!(dim, r.label) : undefined} aria-pressed={c.onPick ? on : undefined}
            sx={{ display: "grid", gridTemplateColumns: cols, columnGap: 1.25, alignItems: "center", px: 1, py: 0.75, border: 0, font: "inherit", textAlign: "left", width: "100%", cursor: c.onPick ? "pointer" : "default",
              borderRadius: "10px", bgcolor: on ? TINT.blue.bg : "transparent", "&:hover": c.onPick ? { bgcolor: on ? TINT.blue.bg : "rgba(21,34,58,.035)" } : {} }}>
            <Typography noWrap title={r.label} sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{r.label}</Typography>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{short(r.e.revYtd)}</Typography>
            {/* this year's bar over last year's, a hair below it */}
            <Box sx={{ ...hideMd, position: "relative", height: 18 }}>
              <Box sx={{ position: "absolute", left: 0, top: 2, height: 9, width: `${(Math.max(0, r.e.revYtd) / max) * 100}%`, bgcolor: THIS, borderRadius: "0 4px 4px 0" }} />
              <Box sx={{ position: "absolute", left: 0, top: 13, height: 4, width: `${(Math.max(0, r.e.revYtdPy) / max) * 100}%`, bgcolor: BEFORE, borderRadius: "0 3px 3px 0" }} />
            </Box>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: tone(ch), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{signedShort(r.diff)}</Typography>
            <Typography sx={{ ...hideMd, fontSize: "0.8rem", fontWeight: 700, color: tone(ch), textAlign: "right" }}>{signedPct(ch)}</Typography>
            <Typography sx={{ ...hideMd, fontSize: "0.82rem", color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{short(r.e.oiYtd)}</Typography>
            <Typography sx={{ ...hideMd, fontSize: "0.78rem", fontWeight: 700, color: tone(oiCh), textAlign: "right" }}>{signedPct(oiCh)}</Typography>
            <Typography sx={{ ...hideMd, fontSize: "0.82rem", color: MUTED, textAlign: "right" }}>{pctPlain(b2b)}</Typography>
          </Box>
        );
      })}
      {rows.length > LIMIT && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start", mt: 0.5 }}>{all ? "Show fewer" : `Show all ${rows.length}`}</Button>
      )}
    </Box>
  );
}

function DriversSection({ c, dim, setDim }: { c: FigCtx; dim: Dim; setDim?: (d: Dim) => void }) {
  const [sortBy, setSortBy] = useState<SortBy>("value");
  return (
    <Section icon={<AlignHorizontalLeftOutlinedIcon />} tint="green" title={`Who moves the figure - by ${DIM[dim].lower}`} actions={c.actions}
      note={`${teamWord(c.team)} · the ERP's year to date against the same days a year earlier: the bar this year, the line under it last year; the change in € and %, the order intake, and how much of the revenue it covers (book-to-bill)${c.onPick ? " - a click shows only that one" : ""}`}
      right={
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {setDim && <Switch label="By" value={dim} onChange={setDim} options={DRIVER_DIMS.map((d) => ({ id: d, label: DIM[d].name }))} />}
          <Switch label="Order" value={sortBy} onChange={setSortBy} options={[{ id: "value", label: "Largest" }, { id: "change", label: "Biggest change" }]} />
        </Box>
      }>
      <DriverRows c={c} dim={dim} sortBy={sortBy} />
    </Section>
  );
}

/* ── the sections by key: the page draws them, and so does the BUC View ─── */

export const FIG_CHARTS: Record<string, { title: (c: FigCtx) => string; draw: (c: FigCtx, part?: string) => React.ReactNode }> = {
  "figures:trajectory": { title: (c) => `The year so far - ${teamWord(c.team)}`, draw: (c, part) => <TrajectorySection c={c} which={part === "oi" ? "oi" : "rev"} /> },
  "figures:people": { title: (c) => (c.team === "total" ? "The teams" : `The people - ${teamWord(c.team)}`), draw: (c) => <PeopleSection c={c} /> },
  "figures:drivers": { title: (c) => `Who moves the figure - ${teamWord(c.team)}`, draw: (c, part) => <DriversSection c={c} dim={(DRIVER_DIMS as string[]).includes(part ?? "") ? (part as Dim) : "country"} /> },
};

/* ── the page ──────────────────────────────────────────────────────────── */

const KEPT = "eso.team";
function setQuery(mut: (q: URLSearchParams) => void) {
  const q = new URLSearchParams(window.location.search);
  mut(q);
  const s = q.toString();
  window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
}
function useTeam(): [TeamKey, (t: TeamKey) => void] {
  const params = useSearchParams();
  const asked = params.get("team");
  const [kept, setKept] = useState<TeamKey | null>(null);
  useEffect(() => { try { const x = localStorage.getItem(KEPT); if (x === "eso" || x === "tsa" || x === "total") setKept(x); } catch { /* ESO */ } }, []);
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
/** The cube read before the ERP's figures were in it (until the first new read after a deployment). */
const tooOld = (cube: Cube) => !cube.erp || !cube.saeTeams;

export function FiguresExplorer() {
  const { cube, computing, progress, error, computedAt } = useCustomersCube();
  const kpi = useKpiSeries();
  const params = useSearchParams();
  const [team, setTeam] = useTeam();
  const which: Which = params.get("show") === "oi" ? "oi" : "rev";
  const setWhich = (w: Which) => setQuery((q) => { if (w === "rev") q.delete("show"); else q.set("show", w); });
  const dim: Dim = (DRIVER_DIMS as string[]).includes(params.get("by") ?? "") ? (params.get("by") as Dim) : "country";
  const split: Split = params.get("split") === "owner" ? "owner" : "sae";
  const setSplit = (x: Split) => setQuery((q) => { if (x === "sae") q.delete("split"); else q.set("split", x); });
  const setDim = (d: Dim) => setQuery((q) => { if (d === "country") q.delete("by"); else q.set("by", d); });
  const filters: Filters = useMemo(() => Object.fromEntries(DIMS.flatMap((d) => (params.getAll(d).length ? [[d, params.getAll(d)]] : []))), [params]);
  const toggle = (d: Dim, label: string) => setQuery((q) => {
    const cur = q.getAll(d), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
    q.delete(d);
    for (const x of next) q.append(d, x);
  });
  const clearAll = () => setQuery((q) => { for (const d of DIMS) q.delete(d); });
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: Dim; n: number } | null>(null);
  const openOn = (d: Dim) => { setFocus((f) => ({ dim: d, n: (f?.n ?? 0) + 1 })); setPanel(true); };

  const head = (
    <Box component={Link} href="/reporting/eso-benchmark" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
      <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
    </Box>
  );
  if (!cube || tooOld(cube)) return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gap: 1.75 }}>
      {head}
      <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" } }}>Figures</Typography>
      <Waiting computing={computing || (!!cube && tooOld(cube))} progress={progress} error={error} />
    </Box>
  );
  const eff = withTeam(cube, filters, team, split);
  const c: FigCtx = { cube, kpi, team, split, filters, eff, onPick: (d, l) => toggle(d, l), onTeam: setTeam };
  const forecast = forecastShown(c) ? againstForecast(cube, kpi) : null;
  const chosen = chosenDims(filters).flatMap((x) => (filters[x] ?? []).map((v) => [x, v] as const));
  const act = (key: string, title: string, part?: string) => (
    <TileActions where="tab" start="tab" edge={{ xs: 2, md: 2.75 }}
      tile={{ key: `eso-figures:figures:${key}${part ? `-${part}` : ""}`, page: "eso-figures", tab: "figures", title, summary: `${teamWord(team)} · to ${erpDayWords(cube)}`,
        filters: { ...Object.fromEntries(chosenDims(filters).map((d) => [d, filters[d] ?? []])), team: [team], split: [split], ...(part ? { part: [part] } : {}) }, kind: "card" }} />
  );
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 }}>
      {head}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>Figures</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamWord(team)}</b>{team !== "total" ? ` by ${split === "sae" ? "Performis SAE" : "company owner"}` : ""} · the year to {erpDayWords(cube)} against the same days of {cube.years[1]} - the ERP&apos;s figures{computing ? " · reading HubSpot again" : ""}
          </Typography>
          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
            <TeamToggle team={team} onTeam={setTeam} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: MUTED }}>Split by</Typography>
              <Switch label="Split by" value={split} onChange={setSplit} options={SPLITS} />
            </Box>
          </Box>
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
        <Box sx={{ display: "grid", gap: 1, justifyItems: { lg: "end" } }}>
          <FigureCards items={figuresOf(erpTotals(cube, eff), forecast)} />
          <Box sx={{ display: "flex", gap: 1, "& .MuiButton-root": { height: 40 } }}>
            <SavedViews page="eso-figures" />
            <Button onClick={() => setPanel(!panel)} variant={panel || chosen.length ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="eso-figures-filters" startIcon={<TuneIcon />}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, whiteSpace: "nowrap", bgcolor: panel || chosen.length ? undefined : "#fff" }}>
              Filters{chosen.length ? ` · ${chosen.length}` : ""}
            </Button>
          </Box>
        </Box>
      </Box>

      <TrajectorySection c={{ ...c, actions: act("trajectory", `The year so far - ${teamWord(team)}`, which) }} which={which} setWhich={setWhich} />
      <PeopleSection c={{ ...c, actions: act("people", team === "total" ? "The teams" : `The people - ${teamWord(team)}`) }} />
      <DriversSection c={{ ...c, actions: act("drivers", `Who moves the figure - ${teamWord(team)}`, dim) }} dim={dim} setDim={setDim} />

      <Typography component="div" sx={{ fontSize: "0.76rem", color: FAINT }}>
        Year and month to date: the ERP file&apos;s own figures per customer, of {erpDayWords(cube)}, against the same days a year earlier. The curves: each customer&apos;s monthly revenue and order intake, summed
        {cube.oiLoaded != null ? ` (order intake per customer loaded to ${MONTH_NAMES[Math.max(0, cube.oiLoaded - 1)]})` : ""}. ESO and TSA by Performis SAE: the customers Performis gives their people (the SAE as Map assignment maps it to a person); by company owner: the companies they own in HubSpot today - a person's team from the rosters, else their HubSpot team.
        {forecast ? " The forecast: the ERP's, the whole company - shown on Total with nothing filtered." : ""} Read from HubSpot {computedAt ? new Date(computedAt).toLocaleString("en-GB") : ""}.
      </Typography>

      <FilterWindow id="eso-figures-filters" period={false} dims={["prio", "segment", "potential", "country", "sae", "owner", "type", "apic", "mandant"]} open={panel} onClose={() => setPanel(false)} focus={focus} cube={cube} win={defaultWindow(cube)} setWin={() => {}} filters={filters} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's first panel ────────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;

/** The figures for ESO, TSA or Total with the same toggle, the year so far - and the Figures sections sent here. */
export function FiguresPanel({ acts }: { acts: ActionsState | null }) {
  const { cube, computing, progress, error } = useCustomersCube();
  const kpi = useKpiSeries();
  const [team, setTeam] = useState<TeamKey>("eso");
  useEffect(() => { try { const x = localStorage.getItem(KEPT); if (x === "eso" || x === "tsa" || x === "total") setTeam(x); } catch { /* ESO */ } }, []);
  const pick = (t: TeamKey) => { setTeam(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const ready = cube && !tooOld(cube);
  const c: FigCtx | null = ready ? { cube, kpi, team, split: "sae", filters: {}, eff: withTeam(cube, {}, team, "sae") } : null;
  const items: SortItem[] = !ready ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-figures").map(({ spec }) => {
    const [, tab, raw] = spec.key.split(":");
    const [card] = (raw ?? "").split("-");
    const ch = FIG_CHARTS[`${tab}:${card}`];
    const sent = spec.filters?.team?.[0];
    const st: TeamKey = sent === "eso" || sent === "tsa" || sent === "total" ? sent : team;
    const sf: Filters = Object.fromEntries(DIMS.flatMap((d) => (spec.filters?.[d]?.length ? [[d, spec.filters[d]]] : [])));
    const fmt = formatOf(acts, spec);
    const actions = <TileActions where="nutshell" start="tab" edge={{ xs: 2, md: 2.75 }} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind }} />;
    const sp: Split = spec.filters?.split?.[0] === "owner" ? "owner" : "sae";
    const sc: FigCtx = { cube: cube!, kpi, team: st, split: sp, filters: sf, eff: withTeam(cube!, sf, st, sp), actions, half: fmt === "half" };
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, spec.filters?.part?.[0]) : <GlassCard><CardTitle icon={<QueryStatsOutlinedIcon />} tint="purple" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
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
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamWord(team)}${team !== "total" ? " by Performis SAE" : ""} · the year to ${erpDayWords(c.cube)} against the same days of ${c.cube.years[1]}` : "Revenue and order intake"}</Typography>
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
          {/* the year so far - the panel's own chart */}
          <TrajectorySection c={c} which="rev" />
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-figures"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </>
      )}
    </GlassCard>
  );
}

export { ym };

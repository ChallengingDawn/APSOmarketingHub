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
// The ERP has the forecast per mandant only - for the whole company.
// Seventh (SARCLA 25.10.2026: "the graphics design didn't change a bit"; "we should have also revenue by profit center
// by country and by sales" - "this data we bring via the Compass connector, already set by profit center, don't get it
// from order lines"): bullet rows instead of the paired bars (this year's bar green up / red down, last year's tick -
// his choice), the months as bullet columns; the Profit center tab from each customer's rev_<y>_pc_monthly in the
// cube, so it follows ESO | TSA | Total and the filters, split by country and by Performis SAE.
// Tenth (SARCLA 25.10.2026): each profit centre its own chart of the people ("per person revenue per profit center as a
// graph"), each with its own Actions so each goes to the BUC View alone; book-to-bill as its own leaderboards and figure
// ("book to bill is not done"); the months keep their proportions at half width; a target per chart, typed in its
// Actions ("a threshold so we can measure the rest of it") - each row's share of it, the months' line; and under ESO the
// line managers' teams, RABE TEAM | SARCLA TEAM | FALU TEAM, as Map assignment's SAE table sets them.
// Eleventh (SARCLA 26.10.2026): "the filter on Figures should have a time filter like quarter, month etc - this is really
// important" - his pick: the Period of Who are our customers in Filters, everything follows; Year to date and Month to
// date become one Performis SAE tab, every title names the period. Year and month to date stay the ERP's own figures;
// any other period adds up each customer's months - the order intake only as far as its months are loaded.

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import BalanceOutlinedIcon from "@mui/icons-material/BalanceOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { BEFORE, THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { DIM, FilterWindow, useCompanyNames, useCustomersCube, type CustomerPick } from "@/app/reporting/marketing-kpis/Customers";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, placementOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import {
  DIMS, MONTH_NAMES, PRIO_ORDER, breakdown, buyersByMonthBy, byMonthBy, chosenDims, clampWindow, erpBy, erpTotals, lastMonth, monthLabel, monthOf, partial, pcBy, presets, totals, windowLabel, yearOfMonth,
  type Cube, type Dim, type ErpAgg, type Filters, type PcMonths, type Win,
} from "@/lib/marketingKpis/cube";
import type { EsoFigures } from "@/lib/reporting/esoFiguresRules";
import { isTeamId, type Team } from "@/lib/mapAssign/leadsRules";

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
export const TEAM_OF: Record<"eso" | "tsa", string> = { eso: "ESO", tsa: "TSA" };
export const teamWord = (t: TeamKey) => (t === "total" ? "APSOparts" : TEAM_OF[t]);
/** ESO | TSA | Total, drawn as the pages' tabs - a click changes every figure. */
export function TeamToggle({ team, onTeam }: { team: TeamKey; onTeam: (t: TeamKey) => void }) {
  return <Box sx={{ justifySelf: "start" }}><ReportTabs name="eso-team" tab={team} onSelect={onTeam} tabs={TEAMS} /></Box>;
}
/** Under ESO, a line manager's team (SARCLA 25.10.2026: "next to ESO | TSA | All I want RABE TEAM | SARCLA TEAM | FALU
 *  TEAM, only visible on ESO") - the teams and each person's as Map assignment's SAE table keeps them, renamed, added or
 *  deleted there (26.10.2026). A team is known by its id, so a renamed team keeps its targets and its address. */
export type LeadKey = "all" | string;
export const asLead = (x: string | null): LeadKey | null => (x === "all" || isTeamId(x) ? x : null);
export type Leads = { byName: Record<string, string>; teams: Team[]; byId: Record<string, string> };
/** The teams, and each person's (by the name the cube carries) - read once per page. */
export function useLeads(): Leads | null {
  const [v, setV] = useState<Leads | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/uc/map-assignment/leads").then((r) => r.json())
      .then((j: Partial<Leads> & { leads?: Record<string, string> }) => { if (alive) setV({ byName: j.byName ?? {}, teams: j.teams ?? [], byId: j.leads ?? {} }); })
      .catch(() => { if (alive) setV({ byName: {}, teams: [], byId: {} }); });
    return () => { alive = false; };
  }, []);
  return v;
}
/** The team shown: a line manager's under ESO, once the teams are read and it is one of them. */
export const leadOf = (team: TeamKey, key: LeadKey, lt: Leads | null) => (team === "eso" && key !== "all" && lt?.teams.some((t) => t.id === key) ? key : null);
/** ESO | TSA | Total, and beside it - under ESO only - the line managers' teams. */
export function Teams({ team, onTeam, lead, onLead, teams }: { team: TeamKey; onTeam: (t: TeamKey) => void; lead: LeadKey; onLead: (l: LeadKey) => void; teams: Team[] }) {
  const tabs: { id: LeadKey; label: string; count: null }[] = [{ id: "all", label: "All ESO", count: null }, ...teams.map((t) => ({ id: t.id, label: t.name, count: null }))];
  return (
    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", justifySelf: "start", minWidth: 0 }}>
      <TeamToggle team={team} onTeam={onTeam} />
      {team === "eso" && teams.length > 0 && <ReportTabs name="eso-lead" tab={teams.some((t) => t.id === lead) ? lead : "all"} onSelect={onLead} tabs={tabs} />}
    </Box>
  );
}
/** A team's Performis SAE people (the SAE as its person); null for Total - under ESO, a line manager's team only. */
const membersOf = (cube: Cube, team: TeamKey, lead: string | null = null, leads: Record<string, string> | null = null) => (team === "total" ? null
  : cube.labels.sae.filter((l) => (cube.saeTeams ?? {})[l] === TEAM_OF[team] && (team !== "eso" || !lead || leads?.[l] === lead)));
function withTeam(cube: Cube, filters: Filters, team: TeamKey, lead: string | null = null, leads: Record<string, string> | null = null): Filters {
  const members = membersOf(cube, team, lead, leads);
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
// Year to date and Month to date are one tab since the period is in Filters (SARCLA 26.10.2026); "ytd" stays its id - the
// charts sent to the BUC View and their targets are kept by it - and "mtd" (old addresses, old tiles) opens it on the
// month to date.
const VIEWS: { id: View; label: string }[] = [
  { id: "ytd", label: "Performis SAE" },
  ...BREAKDOWNS.map((d) => ({ id: d as View, label: DIM[d].name })), { id: "pc", label: "Profit center" },
];
/** The breakdown a tab is drawn by: the Performis SAE on its tab (and the old Month to date); none on Profit center. */
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
const WHAT: Record<Which, string> = { rev: "Revenue", oi: "Order intake" };
const WHAT_ALL: Record<Which | "b2b", string> = { ...WHAT, b2b: "Book-to-bill" };

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

/* ── the period every chart, table and figure follows ──────────────────── */

/** Year to date (the default) or month to date - the ERP file's own figures per customer - or a month, a quarter, the
 *  last 12 months, last year, any months: each customer's months added up. */
export type Per = { win: Win; id: string; erp: Period | null; title: string; months: number };
function perOf(cube: Cube, win: Win): Per {
  const p = presets(cube).find((x) => x.win.start === win.start && x.win.end === win.end);
  const erp = p?.id === "ytd" || p?.id === "mtd" ? p.id : null;
  const title = erp ? PERIOD[erp] : p?.id === "12m" ? "the last 12 months" : p?.id === "ly" ? String(cube.years[1]) : p ? p.label : windowLabel(cube, win);
  return { win, id: p?.id ?? `m${win.start}-${win.end}`, erp, title, months: win.end - win.start + 1 };
}
const ytdPer = (cube: Cube) => perOf(cube, ytdWin(cube));
const mtdPer = (cube: Cube) => perOf(cube, mtdWin(cube));
/** "1 Jan – 13 Oct 2026", "Apr–Jun 2026" - a year earlier with back = 1 */
const perWords = (cube: Cube, per: Per, back = 0) => (per.erp ? periodWords(cube, per.erp, back) : windowLabel(cube, per.win, back));
/** "Year to date", "Q2 2026", "The last 12 months" */
const perCap = (per: Per) => per.title.charAt(0).toUpperCase() + per.title.slice(1);
/** Every month of the period has each customer's order intake - the ERP's year and month to date always have it. */
const oiOk = (cube: Cube, per: Per) => !!per.erp || per.win.end < monthOf(0, 0) + oiLoadedOf(cube);
const oiLoadedWords = (cube: Cube) => `each customer's order intake is loaded to ${MONTH_NAMES[Math.max(0, oiLoadedOf(cube) - 1)]} ${cube.years[0]}`;
/** What a ranking compares: "2026" against "2025, same days"; "Apr–Jun 2026" against "Apr–Jun 2025" */
const curLabelOf = (cube: Cube, per: Per) => (per.erp ? String(cube.years[0]) : windowLabel(cube, per.win));
const prevLabelOf = (cube: Cube, per: Per) => (per.erp ? `${cube.years[1]}, same days` : windowLabel(cube, per.win, 1));
/** A month in the address: "2026-04" */
const ym = (cube: Cube, k: number) => `${yearOfMonth(cube, k)}-${String((k % 12) + 1).padStart(2, "0")}`;
const fromYm = (cube: Cube, x: string | null | undefined) => { const m = /^(\d{4})-(\d{2})$/.exec(x ?? ""); return m ? (Number(m[1]) - cube.years[2]) * 12 + Number(m[2]) - 1 : null; };
/** A period as a chart sent to the BUC View keeps it: a ready-made one by its name, so it moves on with time; any other by its months. */
const perFilters = (cube: Cube, per: Per): Record<string, string[]> => (presets(cube).some((p) => p.id === per.id) ? { period: [per.id] } : { from: [ym(cube, per.win.start)], to: [ym(cube, per.win.end)] });
function perFromFilters(cube: Cube, f: Record<string, string[] | undefined> | undefined): Per | null {
  const id = f?.period?.[0];
  const p = id ? presets(cube).find((x) => x.id === id) : null;
  if (p) return perOf(cube, p.win);
  const a = fromYm(cube, f?.from?.[0]), b = fromYm(cube, f?.to?.[0]);
  return a != null && b != null ? perOf(cube, clampWindow(cube, { start: a, end: b })) : null;
}

/* ── what every chart is drawn with ────────────────────────────────────── */

export type FigCtx = {
  cube: Cube; kpi: EsoFigures | null; kpiBusy?: boolean; team: TeamKey; view: View;
  /** the period every chart follows */
  per: Per;
  /** the filters chosen, and with the team in them */
  filters: Filters; eff: Filters;
  /** in half a row of the BUC View */
  half?: boolean;
  /** a row or a card: show only it */
  onPick?: (d: Dim, label: string) => void;
  /** a bar: show only it, and the Filters window opens on its breakdown - as Who are our customers */
  onBar?: (d: Dim, label: string) => void;
  onFilter?: (d: Dim) => void;
  /** under ESO, a line manager's team, and each person's line manager (by name) */
  lead?: string | null; leads?: Record<string, string> | null; teams?: Team[];
  /** every chart's target, typed in its Actions window, by its key */
  targets?: Record<string, number>;
  /** customers chosen in Filters: the cube is theirs alone */
  picked?: number;
};
/** The ERP's forecast is the whole company's: on Total, nothing filtered, no customer chosen. */
const forecastShown = (c: FigCtx) => c.team === "total" && chosenDims(c.filters).length === 0 && !c.picked && !!c.kpi;
/** The team's name - a line manager's team under ESO. */
const teamName = (c: { team: TeamKey; lead?: string | null; teams?: Team[] }) => (c.team === "eso" && c.lead ? c.teams?.find((t) => t.id === c.lead)?.name ?? c.lead : teamWord(c.team));
/** A chart's target, one per chart, team (a line manager's team its own) and period: "eso-figures:ytd:ytdrev@eso-RABE" -
 *  the keys of before for the year and month to date - "eso-figures:ytd:rev~q2@eso" for Q2. The months' charts keep one
 *  target a month, whatever the period. */
function periodKey(id: string, per: Per) {
  const [v, ch = ""] = id.split(":");
  if (/^mon(rev|oi)$/.test(ch)) return id;
  if (/^(rev|oi|b2b)$/.test(ch)) return per.erp ? `${v}:${per.erp}${ch}` : `${id}~${per.id}`;
  return per.erp === "ytd" ? id : `${id}~${per.id}`;
}
const targetKey = (id: string, team: TeamKey, lead: string | null | undefined, per: Per) => `eso-figures:${periodKey(id, per)}@${team}${team === "eso" && lead ? `-${lead}` : ""}`;
const targetFor = (c: FigCtx, id: string) => { const t = c.targets?.[targetKey(id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/** A chart's box, as DimChart's: its title and one line under it, its Actions at the right. */
export function ChartBox({ title, hint, actions, children }: { title: string; hint?: string; actions?: React.ReactNode; children: React.ReactNode }) {
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
export const TWO = { display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } } as const;
const tip = { contentStyle: { fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" } };
/** A value axis as wide as its longest figure, in full. */
export const axisWidth = (max: number) => Math.max(56, eur(max).length * 7 + 10);
export const SubTitle = ({ children }: { children: React.ReactNode }) => <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>{children}</Typography>;

/* ── a breakdown's values: the ERP's figures, the customers ────────────── */

type ValueRow = { label: string; rev: number; revPy: number; oi: number | null; oiPy: number | null; cust: number; custPy: number };
const valueCache = new WeakMap<Filters, Map<string, ValueRow[]>>();
/**
 * The values of a breakdown with figures for the period - a team's own people on the Performis SAE - the largest revenue
 * first (priority in its order). Year and month to date: the ERP's own figures; any other period: each customer's months,
 * the order intake null where its months are not all loaded.
 */
function valuesOf(c: FigCtx, dim: Dim): ValueRow[] {
  let memo = valueCache.get(c.eff);
  if (!memo) { memo = new Map(); valueCache.set(c.eff, memo); }
  const key = `${c.cube.generatedAt}|${dim}|${c.team}|${c.lead ?? ""}|${c.per.id}|${c.per.win.start}-${c.per.win.end}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const b = new Map(breakdown(c.cube, dim, c.eff, c.per.win).map((r) => [r.label, r]));
  const members = dim === "sae" ? membersOf(c.cube, c.team, c.lead, c.leads) : null;
  let rows: ValueRow[];
  if (c.per.erp) {
    const p = c.per.erp;
    rows = [...erpBy(c.cube, c.eff, dim).entries()].filter(([l, e]) => (!members || members.includes(l)) && (e.revYtd || e.revYtdPy || e.oiYtd || e.oiYtdPy))
      .map(([label, e]) => { const [rev, revPy] = pick(e, p, "rev"), [oi, oiPy] = pick(e, p, "oi"); return { label, rev, revPy, oi, oiPy, cust: b.get(label)?.bought ?? 0, custPy: b.get(label)?.boughtPy ?? 0 }; });
  } else {
    const ok = oiOk(c.cube, c.per);
    rows = [...b.values()].filter((r) => (!members || members.includes(r.label)) && (r.rev || r.revPy || r.oi || r.oiPy))
      .map((r) => ({ label: r.label, rev: r.rev, revPy: r.revPy, oi: ok ? r.oi : null, oiPy: ok ? r.oiPy : null, cust: r.bought, custPy: r.boughtPy }));
  }
  if (dim === "prio") rows.sort((a, z) => ((PRIO_ORDER.indexOf(a.label) + 99) % 99) - ((PRIO_ORDER.indexOf(z.label) + 99) % 99) || a.label.localeCompare(z.label));
  else rows.sort((a, z) => z.rev - a.rev || a.label.localeCompare(z.label));
  memo.set(key, rows);
  return rows;
}
const pick = (e: ErpAgg, p: Period, w: Which): [number, number] =>
  p === "ytd" ? (w === "rev" ? [e.revYtd, e.revYtdPy] : [e.oiYtd, e.oiYtdPy]) : w === "rev" ? [e.revMtd, e.revMtdPy] : [e.oiMtd, e.oiMtdPy];
const lowerOf = (d: Dim) => DIM[d].lower;

/* ── bullet rows: this year's bar and last year's tick, the change in its colour beside (SARCLA 25.10.2026: "too much, it was really confusing" - one colour for the bars) ── */

/** The rows' columns, the same in every row of every chart: the name, the bar, the figures. */
const ROW_COLS = { xs: "104px minmax(0, 1fr) 116px", sm: "150px minmax(0, 1fr) 128px" };
export const NAV = { width: 30, height: 30, border: "1px solid rgba(21,34,58,.12)", borderRadius: "9px" };
/** The bullets' legend: this year up or down, last year's tick (and the forecast's and the target's dashes where they are drawn). */
function BulletLegend({ cur, prev, forecast, target }: { cur: string; prev: string; forecast?: boolean; target?: React.ReactNode }) {
  const item = (mark: React.ReactNode, text: string) => (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>{mark}{text}</Box>
  );
  const sw = (bg: string) => <Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: bg }} />;
  return (
    <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
      {item(sw(THIS), cur)}
      {item(<Box component="span" sx={{ width: 2, height: 12, bgcolor: INK, borderRadius: 1 }} />, prev)}
      {forecast && item(<Box component="span" sx={{ width: 14, borderTop: `2px dashed ${FORECAST}` }} />, "Forecast")}
      {target && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: INK, fontWeight: 600 }}><Box component="span" sx={{ width: 14, borderTop: `2px dashed ${TARGET}` }} />{target}</Box>}
    </Box>
  );
}
/** A pager's two arrows. */
function PagerArrows({ page, pages, setPage }: { page: number; pages: number; setPage: (f: (p: number) => number) => void }) {
  if (pages <= 1) return null;
  return (
    <Box sx={{ display: "flex", gap: 0.5 }}>
      <IconButton size="small" aria-label="The previous ones" disabled={page === 0} onClick={() => setPage((x) => Math.max(0, x - 1))} sx={NAV}><ChevronLeftIcon sx={{ fontSize: 18 }} /></IconButton>
      <IconButton size="small" aria-label="The next ones" disabled={page >= pages - 1} onClick={() => setPage((x) => Math.min(pages - 1, x + 1))} sx={NAV}><ChevronRightIcon sx={{ fontSize: 18 }} /></IconButton>
    </Box>
  );
}
function usePages<T>(rows: T[], size: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  useEffect(() => { if (page >= pages) setPage(0); }, [page, pages]);
  const at = Math.min(page, pages - 1);
  return { page: at, pages, setPage, slice: rows.slice(at * size, at * size + size), range: `${at * size + 1}–${Math.min(rows.length, (at + 1) * size)} of ${rows.length}` };
}
/** A row's change in its colour: in € and in %, "new" without last year. */
const changeLine = (cur: number, prev: number) => { const ch = changeNote(cur, prev); return { text: `${signedEur(cur - prev)} · ${ch?.text ?? "—"}`, color: ch?.color ?? FAINT }; };

/* ── the leaderboard: the top three as cards, everyone else ranked under them (SARCLA 25.10.2026 picked it - number 30 - from thirty proposals) ── */

export type BoardRow = { label: string; cur: number; prev: number; sub?: string };
const PODIUM_BG = "rgba(45,111,168,.07)";
/** "+1.2 pts" - a ratio's change (book-to-bill) */
const points = (cur: number, prev: number) => `${cur - prev > 0 ? "+" : cur - prev < 0 ? "−" : "±"}${Math.abs((cur - prev) * 100).toFixed(1)} pts`;

export function Leaderboard({ title, rows: given, curLabel, prevLabel, first = 12, selected, onPick, onFilter, filterLabel, actions, fmt = eur, diff = signedEur, ratio = false, target = null, summary, unranked, noChange = false }: {
  title: string; rows: BoardRow[]; curLabel: string; prevLabel: string;
  /** the places shown before "Show all" */
  first?: number;
  selected?: string[]; onPick?: (label: string) => void; onFilter?: () => void; filterLabel?: string; actions?: React.ReactNode;
  /** how a figure is written - euros unless given */
  fmt?: (n: number) => string;
  /** how a change is written under its percentage - euros unless given (the New customers' counts: "+12") */
  diff?: (n: number) => string;
  /** the figures are ratios (book-to-bill): the change in points, no change in euros */
  ratio?: boolean;
  /** the chart's target (typed in its Actions window): each row measured against it */
  target?: number | null;
  /** a line under the title: the chart's own total (a profit centre's) */
  summary?: React.ReactNode;
  /** rows listed under the ranking, not in it - book-to-bill's small books - and why */
  unranked?: { why: string; rows: BoardRow[] };
  /** nothing to compare with (the visits: none recorded last year) - no change shown */
  noChange?: boolean;
}) {
  const rows = useMemo(() => [...given].sort((a, b) => b.cur - a.cur || b.prev - a.prev || a.label.localeCompare(b.label)), [given]);
  const [all, setAll] = useState(false);
  const [small, setSmall] = useState(false);
  const shown = all ? rows : rows.slice(0, first);
  const podium = shown.slice(0, 3), rest = shown.slice(3);
  const reached = target ? rows.filter((r) => r.cur >= target).length : 0;
  // in words anyone reads (SARCLA 27.10.2026: "I don't understand 'ranked by 2026 · the first 6 of 17'")
  const hint = ["Highest first", rows.length > first && !all ? `top ${first} of ${rows.length} shown` : "", onPick ? "click one to show only it" : ""].filter(Boolean).join(" · ");
  // the change: in % and euros, or in points for a ratio
  const change = (r: BoardRow) => {
    if (noChange) return { main: "", color: FAINT, second: null as string | null };
    if (ratio) return { main: r.prev ? points(r.cur, r.prev) : "new", color: r.prev ? tone(r.cur - r.prev) : FAINT, second: null as string | null };
    const ch = changeNote(r.cur, r.prev);
    return { main: ch?.text ?? "—", color: ch?.color ?? FAINT, second: diff(r.cur - r.prev) };
  };
  // how far a row is from the target: "86% of the target", in its colour
  const toTarget = (r: BoardRow) => (target ? { text: `${pct(r.cur / target)} of the target`, color: r.cur >= target ? GREEN : RED } : null);
  const pickable = (label: string) => (onPick ? { component: "button" as const, type: "button" as const, onClick: () => onPick(label) } : { component: "div" as const });
  const tipOf = (r: BoardRow) => { const c = change(r); return `${r.label} - ${curLabel}: ${fmt(r.cur)}${noChange ? "" : ` · ${prevLabel}: ${fmt(r.prev)} · ${c.main}${c.second ? ` · ${c.second}` : ""}`}${target ? ` · target ${fmt(target)}` : ""}`; };
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0, display: "grid", gap: 1.25, gridTemplateColumns: "minmax(0, 1fr)", alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{title}</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{hint}</Typography>
          {summary && <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, mt: 0.25 }}>{summary}</Typography>}
          {target != null && target > 0 && (
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: INK, mt: 0.25 }}>
              Target {fmt(target)} · <span style={{ color: reached === rows.length ? GREEN : RED }}>{reached} of {rows.length} reached it</span>
            </Typography>
          )}
        </Box>
        {onFilter && (
          <IconButton size="small" aria-label={filterLabel ?? "Filter"} title={filterLabel} onClick={onFilter} sx={{ ...NAV, color: selected?.length ? TINT.blue.fg : MUTED, bgcolor: selected?.length ? TINT.blue.bg : "transparent" }}>
            <FilterAltOutlinedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        )}
        {actions}
      </Box>
      {rows.length === 0 ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Nothing with figures under these filters.</Typography> : (
        <>
          {/* the first three as cards */}
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" } }}>
            {podium.map((r, i) => {
              const on = !!selected?.includes(r.label), c = change(r), t = toTarget(r);
              return (
                <Box key={r.label} {...pickable(r.label)} aria-pressed={onPick ? on : undefined} title={tipOf(r)}
                  sx={{ font: "inherit", textAlign: "left", cursor: onPick ? "pointer" : "default", borderRadius: "14px", p: 1.5, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start",
                    bgcolor: on ? TINT.blue.bg : PODIUM_BG, border: `1px solid ${on ? TINT.blue.fg : "transparent"}`, opacity: selected?.length && !on ? 0.5 : 1,
                    "&:hover": onPick ? { borderColor: TINT.blue.fg } : {}, "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: 1 } }}>
                  <Typography sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: "1.6rem", fontWeight: 700, color: THIS, lineHeight: 1 }}>{i + 1}</Typography>
                  <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK, mt: 0.5 }}>{r.label}</Typography>
                  <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{fmt(r.cur)}</Typography>
                  {!noChange && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>{c.main}{c.second ? ` · ${c.second}` : ""}</Typography>}
                  {t && <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: t.color }}>{t.text}</Typography>}
                  {r.sub && <Typography noWrap sx={{ fontSize: "0.72rem", color: FAINT }}>{r.sub}</Typography>}
                </Box>
              );
            })}
          </Box>
          {/* everyone else, ranked */}
          {rest.length > 0 && (
            <Box sx={{ display: "grid" }}>
              {rest.map((r, i) => {
                const on = !!selected?.includes(r.label), c = change(r), t = toTarget(r);
                return (
                  <Box key={r.label} {...pickable(r.label)} aria-pressed={onPick ? on : undefined} title={tipOf(r)}
                    sx={{ display: "grid", gridTemplateColumns: noChange ? { xs: "24px minmax(0, 1fr) auto", sm: "30px minmax(0, 1fr) 128px" } : { xs: "24px minmax(0, 1fr) auto 64px", sm: "30px minmax(0, 1fr) 128px 108px" }, columnGap: 1.25, alignItems: "center", px: 0.75, py: 0.7, width: "100%",
                      border: 0, borderBottom: `1px solid ${HAIRLINE}`, font: "inherit", textAlign: "left", cursor: onPick ? "pointer" : "default",
                      bgcolor: on ? TINT.blue.bg : "transparent", opacity: selected?.length && !on ? 0.5 : 1,
                      "&:hover": onPick ? { bgcolor: on ? TINT.blue.bg : "rgba(21,34,58,.035)" } : {}, "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: -2 } }}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{i + 4}</Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, lineHeight: 1.25 }}>{r.label}</Typography>
                      {(r.sub || t) && (
                        <Typography noWrap sx={{ fontSize: "0.72rem", color: FAINT, lineHeight: 1.25 }}>
                          {r.sub}{r.sub && t ? " · " : ""}{t && <span style={{ color: t.color, fontWeight: 700 }}>{t.text}</span>}
                        </Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(r.cur)}</Typography>
                    {!noChange && <Box sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: c.color, lineHeight: 1.25 }}>{c.main}</Typography>
                      {c.second && <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.72rem", fontWeight: 600, color: c.color, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{c.second}</Typography>}
                    </Box>}
                  </Box>
                );
              })}
            </Box>
          )}
          {rows.length > first && (
            <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${first}` : `Show all ${rows.length}`}</Button>
          )}
        </>
      )}
      {unranked && unranked.rows.length > 0 && (
        <Box sx={{ display: "grid", gap: 0.5 }}>
          <Button size="small" onClick={() => setSmall((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start", color: MUTED }}>
            {small ? "Hide" : "Show"} the {unranked.rows.length} not ranked - {unranked.why}
          </Button>
          {small && [...unranked.rows].sort((a, b) => a.label.localeCompare(b.label)).map((r) => (
            <Box key={r.label} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 1.25, alignItems: "center", px: 0.75, py: 0.5, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 600, color: MUTED }}>{r.label}</Typography>
                {r.sub && <Typography noWrap sx={{ fontSize: "0.72rem", color: FAINT }}>{r.sub}</Typography>}
              </Box>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{fmt(r.cur)}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Book-to-bill checked against the ERP itself (SARCLA 26.10.2026: "how confident are you on book to bill?"): on Total,
 * nothing filtered, the year to date - the customers' own ERP figures added up beside the ERP's whole-company series
 * (the KPI series the forecast comes with), so the page shows how much of the company the customers cover.
 */
function b2bCheck(c: FigCtx) {
  const d = erpDate(c.cube);
  if (!forecastShown(c) || c.per.erp !== "ytd" || !d || d.year !== c.cube.years[0]) return null;
  const upTo = (xs: { cy: number }[]) => xs.slice(0, d.month + 1).reduce((s, x) => s + x.cy, 0);
  const kRev = upTo(c.kpi!.total.rev), kOi = upTo(c.kpi!.total.oi);
  const e = erpTotals(c.cube, {});
  return kRev > 0 && kOi > 0 ? { kRev, kOi, rev: e.revYtd, oi: e.oiYtd } : null;
}
function B2bCheckLine({ c }: { c: FigCtx }) {
  const k = b2bCheck(c);
  if (!k) return null;
  return (
    <span style={{ fontWeight: 500, color: MUTED }}>
      The ERP&apos;s whole company: order intake {eur(k.kOi)} ÷ revenue {eur(k.kRev)} = <b>{pct(k.kOi / k.kRev)}</b> · the customers here add up to {pct(k.rev / k.kRev)} of its revenue and {pct(k.oi / k.kOi)} of its order intake = {pct(k.rev ? k.oi / k.rev : null)}
    </span>
  );
}

/** Book-to-bill ranks the books of some size only (SARCLA 26.10.2026, his pick: "leave out small books") - a person with
 *  €18,658 of revenue at 109% topped ESO. €50,000 over three months or more; a month or two count less. */
const b2bMin = (months: number) => (months >= 3 ? 50_000 : months === 2 ? 10_000 : 5_000);

/** A chart the period cannot fill: its order intake per customer is not loaded that far. */
function OiMissing({ c, title, actions }: { c: FigCtx; title: string; actions?: React.ReactNode }) {
  return (
    <ChartBox title={title} actions={actions} hint={`${perCap(c.per)} - ${perWords(c.cube, c.per)}`}>
      <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.5 }}>
        Not for this period yet: {oiLoadedWords(c.cube)}. The ERP&apos;s year to date and month to date are complete - pick one of them under Filters &gt; Period.
      </Typography>
    </ChartBox>
  );
}

/** Revenue, order intake or book-to-bill of the period, by a breakdown - the period in the title; under each name the
 *  customers (revenue), the book-to-bill (order intake) or the two figures it is made of (book-to-bill). */
function ValueBars({ c, id, dim, which, actions }: { c: FigCtx; id: string; dim: Dim; which: Which | "b2b"; actions?: React.ReactNode }) {
  const b2b = which === "b2b";
  const title = `${WHAT_ALL[which]} ${c.per.title}, by ${lowerOf(dim)}`;
  if (which !== "rev" && !oiOk(c.cube, c.per)) return <OiMissing c={c} title={title} actions={actions} />;
  const min = b2bMin(c.per.months);
  const small: BoardRow[] = [];
  const rows: BoardRow[] = valuesOf(c, dim).flatMap((r) => {
    const o = r.oi ?? 0, oPy = r.oiPy ?? 0, v = r.rev, vPy = r.revPy;
    const n = Math.round(r.cust);
    if (b2b) {
      if (v <= 0) return [];
      const row = { label: r.label, cur: o / v, prev: vPy ? oPy / vPy : 0, sub: `order intake ${eur(o)} · revenue ${eur(v)}` };
      if (v < min) { small.push(row); return []; }
      return [row];
    }
    const [cur, prev] = which === "rev" ? [v, vPy] : [o, oPy];
    // the order intake's own line: book-to-bill, the order intake against the revenue (SARCLA 25.10.2026: "missing book to bill per SAE")
    const sub = which === "oi" ? `Book-to-bill ${v ? `${Math.round((o / v) * 100)}%` : "—"}` : `${int(n)} customer${n === 1 ? "" : "s"}`;
    return cur || prev ? [{ label: r.label, cur, prev, sub }] : [];
  });
  return (
    <Leaderboard key={`${c.per.id}-${which}-${dim}`} title={title} rows={rows}
      curLabel={curLabelOf(c.cube, c.per)} prevLabel={prevLabelOf(c.cube, c.per)} first={c.half ? 8 : 12}
      fmt={b2b ? pct : eur} ratio={b2b} target={targetFor(c, id)} unranked={b2b ? { why: `under ${eur(min)} of revenue`, rows: small } : undefined}
      summary={b2b && b2bCheck(c) ? <B2bCheckLine c={c} /> : undefined}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${lowerOf(dim)}`} actions={actions} />
  );
}

/* ── the period month by month: the ERP's month to date for the running one ── */

type MonthRow = { label: string; x: string; k: number; rev: number; revPy: number; oi: number | null; oiPy: number; cust: number; custPy: number; fc: number | null; erp: boolean };
const monthCache = new WeakMap<Filters, Map<string, MonthRow[]>>();
/** The period's months (of two months or more) - this year's under their name, last year's with their year. */
function monthRows(c: FigCtx): MonthRow[] {
  let memo = monthCache.get(c.eff);
  if (!memo) { memo = new Map(); monthCache.set(c.eff, memo); }
  const key = `${c.cube.generatedAt}|${c.team}|${c.lead ?? ""}|${forecastShown(c)}|${c.per.win.start}-${c.per.win.end}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const { cube } = c;
  const e = erpTotals(cube, c.eff);
  const d = erpDate(cube);
  const jan = monthOf(0, 0), loaded = jan + oiLoadedOf(cube), last = lastMonth(cube);
  const fc = forecastShown(c) ? c.kpi!.total.forecast : null;
  const rows: MonthRow[] = [];
  for (let k = c.per.win.start; k <= c.per.win.end; k++) {
    // the month the ERP's file is in: its own month to date against the same days a year earlier
    const erp = k === last && !!d && d.year === cube.years[0] && d.month === k - jan;
    const t = totals(cube, c.eff, { start: k, end: k });
    const x = k >= jan ? MONTH_NAMES[k - jan] : monthLabel(cube, k);
    rows.push({
      label: erp && partial(cube) ? `${x} (1 – ${d!.day})` : x, x, k, erp,
      rev: erp ? e.revMtd : t.rev, revPy: erp ? e.revMtdPy : t.revPy,
      oi: erp ? e.oiMtd : k < loaded ? t.oi : null, oiPy: erp ? e.oiMtdPy : t.oiPy,
      cust: t.bought, custPy: t.boughtPy,
      fc: fc && k >= jan ? (fc[k - jan] ?? 0) * (erp ? monthShare(cube) : 1) : null,
    });
  }
  memo.set(key, rows);
  return rows;
}

const FORECAST = "#d99a2b";
/** a chart's target, typed in its Actions */
export const TARGET = TINT.purple.fg;
/** A value axis's top: a round figure just above the largest. */
export function niceTop(max: number) {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const s of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) if (s * mag >= max) return s * mag;
  return 10 * mag;
}
/** The months as columns: this year's column, last year's tick across it, the forecast dashed on Total, the target (typed
 *  in Actions) as a line across. The plot keeps its proportions at any width (SARCLA 25.10.2026: "in half width it loses its ratio"). */
function MonthColumns({ c, which, target = null }: { c: FigCtx; which: Which; target?: number | null }) {
  const rows = monthRows(c);
  // the legend: "2026" against "2025, same month" - or, over a year end, the months shown against a year earlier
  const ys = new Set(rows.map((r) => yearOfMonth(c.cube, r.k)));
  const [y0, y1] = ys.size === 1 ? [String([...ys][0]), `${[...ys][0] - 1}, same month`] : ["The months shown", "A year earlier, same month"];
  const data = rows.map((r) => ({ x: r.x, cur: which === "rev" ? r.rev : r.oi, prev: which === "rev" ? r.revPy : r.oiPy, fc: which === "rev" ? r.fc : null, erp: r.erp }));
  const top = niceTop(Math.max(1, target ?? 0, ...data.map((d) => Math.max(d.cur ?? 0, d.prev, d.fc ?? 0))));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const withFc = data.some((d) => d.fc != null);
  // the target against the months that are over - the running one is not counted
  const done = data.filter((d) => d.cur != null && !(d.erp && partial(c.cube)));
  const reached = target ? done.filter((d) => (d.cur ?? 0) >= target).length : 0;
  const goal = target ? <>Target {eur(target)} a month · <span style={{ color: reached === done.length ? GREEN : RED }}>{reached} of {done.length} months reached it</span></> : undefined;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <BulletLegend cur={y0} prev={y1} forecast={withFc} target={goal} />
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: axisWidth(top) - 10 }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", lineHeight: 1.2 }}>{eur(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 160, maxHeight: 340 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          {target != null && target > 0 && <Box sx={{ position: "absolute", left: 0, right: 0, bottom: `${(target / top) * 100}%`, borderTop: `2px dashed ${TARGET}`, zIndex: 1, pointerEvents: "none" }} />}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((d) => (
              <Box key={d.x} title={`${d.x}: ${d.cur == null ? "not loaded yet" : eur(d.cur)} · a year earlier: ${eur(d.prev)}${d.fc != null ? ` · forecast: ${eur(d.fc)}` : ""}${target && d.cur != null ? ` · ${pct(d.cur / target)} of the target` : ""}`}
                sx={{ flex: 1, position: "relative", height: "100%", borderRadius: "6px", "&:hover": { bgcolor: "rgba(21,34,58,.035)" } }}>
                {d.cur != null && <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(Math.max(0, d.cur) / top) * 100}%`, bgcolor: THIS, borderRadius: "4px 4px 0 0" }} />}
                {d.prev > 0 && <Box sx={{ position: "absolute", bottom: `calc(${(d.prev / top) * 100}% - 1px)`, left: "50%", transform: "translateX(-50%)", width: "76%", maxWidth: 44, height: 2, bgcolor: INK, borderRadius: 1 }} />}
                {d.fc != null && d.fc > 0 && <Box sx={{ position: "absolute", bottom: `${(d.fc / top) * 100}%`, left: "50%", transform: "translateX(-50%)", width: "76%", maxWidth: 44, borderTop: `2px dashed ${FORECAST}` }} />}
              </Box>
            ))}
          </Box>
        </Box>
        <Box />
        <Box sx={{ display: "flex", overflow: "hidden" }}>
          {data.map((d) => {
            const ch = d.cur == null ? null : changeOf(d.cur, d.prev);
            return (
              <Box key={d.x} sx={{ flex: 1, textAlign: "center", pt: 0.5, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3 }}>{d.x}</Typography>
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: d.cur == null ? FAINT : tone(ch), lineHeight: 1.3, whiteSpace: "nowrap" }}>{d.cur == null ? "not in" : signedPct(ch)}</Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
function monthColumnsHint(c: FigCtx, which: Which) {
  const rows = monthRows(c);
  const last = rows[rows.length - 1];
  const loaded = oiLoadedOf(c.cube);
  const lag = which === "oi" && rows.some((r) => r.oi == null) && loaded > 0 ? ` · each customer's order intake loaded to ${MONTH_NAMES[loaded - 1]}` : "";
  return `${perWords(c.cube, c.per)} · the change under each month${last?.erp ? ` · ${last.x}: the ERP's month to date against the same days` : ""}${lag}`;
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

function MonthCards({ c: given, dim, actions }: { c: FigCtx; dim: Dim; actions?: React.ReactNode }) {
  const [all, setAll] = useState(false);
  const c: FigCtx = { ...given, per: ytdPer(given.cube) };
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
                  { label: "Revenue year to date", value: eur(r.rev), ch: changeNote(r.rev, r.revPy) },
                  { label: "Customers year to date", value: int(r.cust), ch: changeNote(r.cust, r.custPy) },
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

export type Col<R> = { key: string; head: string; tip?: string; cell: (r: R) => React.ReactNode; sort?: (r: R) => number };
export function FullTable<R extends { label: string }>({ first, cols, rows, total, selected, onPick, tint = "blue", natural = false, initial, find }: {
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

/** All the figures of a breakdown for the period. */
function ValueTable({ c, dim }: { c: FigCtx; dim: Dim }) {
  const rows = valuesOf(c, dim);
  const { cube, per } = c;
  const ok = oiOk(cube, per);
  const sum = (f: (r: ValueRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const total: ValueRow = { label: "Total", rev: sum((r) => r.rev), revPy: sum((r) => r.revPy), oi: ok ? sum((r) => r.oi ?? 0) : null, oiPy: ok ? sum((r) => r.oiPy ?? 0) : null, cust: sum((r) => r.cust), custPy: sum((r) => r.custPy) };
  const sumRev = rows.reduce((s, r) => s + Math.max(0, r.rev), 0);
  const P = per.title, y1 = cube.years[1];
  const notIn = <span style={{ color: FAINT }}>not loaded yet</span>;
  const cols: Col<ValueRow>[] = [
    ...(dim === "sae" && c.team === "total" ? [{ key: "team", head: "Team", cell: (r: ValueRow) => (r.label === "Total" ? "" : (cube.saeTeams ?? {})[r.label] ?? "—") }] : []),
    { key: "rev", head: `Revenue ${P}`, tip: `${per.erp ? "The ERP's revenue" : "Each customer's monthly revenue, added up"}, ${perWords(cube, per)}`, cell: (r) => eur(r.rev), sort: (r) => r.rev },
    { key: "revPy", head: per.erp ? `Same days ${y1}` : `Same months ${y1}`, tip: perWords(cube, per, 1), cell: (r) => eur(r.revPy), sort: (r) => r.revPy },
    { key: "diff", head: "Change in €", cell: (r) => diffCell(r.rev, r.revPy), sort: (r) => r.rev - r.revPy },
    { key: "change", head: "Change in %", cell: (r) => changeCell(r.rev, r.revPy), sort: (r) => changeOf(r.rev, r.revPy) ?? -Infinity },
    { key: "share", head: "Share of revenue", tip: "This row's part of the revenue in the table", cell: (r) => (r.rev > 0 && sumRev > 0 ? pct(r.rev / sumRev) : "—"), sort: (r) => r.rev },
    { key: "cust", head: `Customers ${P}`, tip: `The companies that bought, ${perWords(cube, per)} - under it the change against the same months of ${y1}`,
      cell: (r) => withChangeCell(int(r.cust), r.cust, r.custPy), sort: (r) => r.cust },
    { key: "oi", head: `Order intake ${P}`, tip: ok ? `${per.erp ? "The ERP's order intake" : "Each customer's monthly order intake, added up"}, ${perWords(cube, per)} - under it the change against ${perWords(cube, per, 1)}` : `Not for this period: ${oiLoadedWords(cube)}`,
      cell: (r) => (r.oi == null ? notIn : withChangeCell(eur(r.oi), r.oi, r.oiPy ?? 0)), sort: (r) => r.oi ?? -Infinity },
    { key: "b2b", head: "Book-to-bill", tip: `Order intake against revenue, ${P}`, cell: (r) => (r.oi == null ? "—" : r.rev ? `${Math.round((r.oi / r.rev) * 100)}%` : "—"),
      sort: (r) => (r.oi != null && r.rev ? r.oi / r.rev : -Infinity) },
  ];
  return <FullTable key={`${dim}-${per.id}-${c.team}`} first={DIM[dim].name} cols={cols} initial="rev" rows={rows} total={total} selected={c.filters[dim]} tint={DIM[dim].tint}
    onPick={c.onPick ? (l) => c.onPick!(dim, l) : undefined} natural={dim === "prio"} find={`${/^[aeiou]/i.test(lowerOf(dim)) ? "an" : "a"} ${lowerOf(dim)}`} />;
}

/** The period month by month - the forecast beside the revenue on Total, the period itself at the end (the ERP's year to date on Year to date). */
function MonthTable({ c }: { c: FigCtx }) {
  const { cube, per } = c;
  const rows = monthRows(c);
  const e = erpTotals(cube, c.eff);
  const t = totals(cube, c.eff, per.win);
  const ok = oiOk(cube, per);
  const withFc = rows.some((r) => r.fc != null);
  const fcSum = rows.reduce((s, r) => s + (r.fc ?? 0), 0);
  const [rev, revPy] = per.erp ? pick(e, per.erp, "rev") : [t.rev, t.revPy];
  const [oi, oiPy] = per.erp ? pick(e, per.erp, "oi") : [ok ? t.oi : null, t.oiPy];
  const end: MonthRow = { label: perCap(per), x: "", k: -1, erp: !!per.erp, rev, revPy, oi, oiPy, cust: t.bought, custPy: t.boughtPy, fc: withFc ? fcSum : null };
  const loaded = oiLoadedOf(cube);
  const cols: Col<MonthRow>[] = [
    { key: "rev", head: "Revenue", tip: "Under it the change against the same month a year earlier - the running month and the year to date: the ERP's, against the same days", cell: (r) => withChangeCell(eur(r.rev), r.rev, r.revPy) },
    { key: "revPy", head: "A year earlier", cell: (r) => eur(r.revPy) },
    { key: "diff", head: "Change in €", cell: (r) => diffCell(r.rev, r.revPy) },
    ...(withFc ? [
      { key: "fc", head: "Forecast", tip: "The ERP's forecast - the whole company (per mandant); the running month pro rata to the day", cell: (r: MonthRow) => eur(r.fc ?? 0) },
      { key: "reached", head: "Reached", tip: "Revenue against the forecast", cell: (r: MonthRow) => (r.fc ? pct(r.rev / r.fc) : "—") },
    ] : []),
    { key: "cust", head: "Customers", tip: "The companies that bought in the month (the period: in any of its months) - under it the change against a year earlier", cell: (r) => withChangeCell(int(r.cust), r.cust, r.custPy) },
    { key: "oi", head: "Order intake", tip: `Each customer's order intake, loaded to ${MONTH_NAMES[Math.max(0, loaded - 1)]}; the running month and the year to date: the ERP's`,
      cell: (r) => (r.oi == null ? <span style={{ color: FAINT }}>not loaded yet</span> : withChangeCell(eur(r.oi), r.oi, r.oiPy)) },
    { key: "oiPy", head: "Order intake a year earlier", cell: (r) => eur(r.oiPy) },
  ];
  return <FullTable first="Month" cols={cols} rows={rows} total={end} natural />;
}

/* ── the profit centres: each customer's revenue by profit centre (the Compass connector, from the ERP) ── */

const PC_KNOWN = ["dt", "ft", "kt", "at", "st"] as const;
const PC_ORDER: string[] = [...PC_KNOWN, "other"];
const PC_NAME: Record<string, string> = { dt: "Sealing Technology (DT)", ft: "Fluid Technology (FT)", kt: "Engineering Plastics (KT)", at: "Drive Technology (AT)", st: "Antivibration Technology (ST)", other: "Other" };
/** Fixed by the profit centre, never by its rank: the hub's four series slots and magenta (validated), "other" the de-emphasis grey. */
const PC_COLOR: Record<string, string> = { dt: "#2d6fa8", ft: "#eb6834", kt: "#1baf7a", at: "#eda100", st: "#e87ba4", other: "#b9c0c9" };
const pcKey = (pc: string) => ((PC_KNOWN as readonly string[]).includes(pc) ? pc : "other");

type PcFig = { cur: number; prev: number | null };
/** A profit centre's revenue in a month: this year's and last year's are read, nothing before. */
const pcAt = (cube: Cube, m: PcMonths, k: number): number | null => { const jan = monthOf(0, 0); return k >= jan && k < jan + 12 ? m.cy[k - jan] ?? 0 : k >= jan - 12 && k < jan ? m.py[k - jan + 12] ?? 0 : null; };
/** A profit centre's revenue in the period, against the same months a year earlier - last year's running month pro rata,
 *  as the cube compares; none to compare when the year before last would be needed. */
function pcFig(cube: Cube, m: PcMonths, per: Per): PcFig {
  const part = partial(cube), share = part ? part.day / part.days : 1;
  let cur = 0, prev: number | null = 0;
  for (let k = per.win.start; k <= per.win.end; k++) {
    cur += pcAt(cube, m, k) ?? 0;
    const p = pcAt(cube, m, k - 12);
    if (p == null) prev = null; else if (prev != null) prev += p * (part && k === part.month ? share : 1);
  }
  return { cur, prev };
}
const blankPc = (): PcMonths => ({ cy: Array(12).fill(0), py: Array(12).fill(0) });
/** The known profit centres apart, anything else as "other". */
function foldPcs(m: Map<string, PcMonths> | undefined): Map<string, PcMonths> {
  const out = new Map<string, PcMonths>();
  for (const [pc, v] of m ?? []) {
    const k = pcKey(pc), a = out.get(k) ?? blankPc();
    for (let i = 0; i < 12; i++) { a.cy[i] += v.cy[i]; a.py[i] += v.py[i]; }
    out.set(k, a);
  }
  return out;
}
const hasPc = (c: FigCtx) => !!c.cube.pcRevenue;
type PcRow = PcFig & { label: string; pc: string };
function pcRows(c: FigCtx): PcRow[] {
  const all = foldPcs(pcBy(c.cube, c.eff).get(""));
  return PC_ORDER.filter((pc) => all.has(pc)).map((pc) => ({ pc, label: PC_NAME[pc], ...pcFig(c.cube, all.get(pc)!, c.per) })).filter((r) => r.cur || r.prev);
}
type SplitRow = { label: string; byPc: Record<string, number>; byPcPy: Record<string, number>; total: number; totalPy: number };
const splitCache = new WeakMap<Filters, Map<string, SplitRow[]>>();
/** Each value of a breakdown with its revenue in the period by profit centre, and a year earlier - a team's own people on the Performis SAE. */
function pcSplit(c: FigCtx, dim: Dim): SplitRow[] {
  let memo = splitCache.get(c.eff);
  if (!memo) { memo = new Map(); splitCache.set(c.eff, memo); }
  const key = `${c.cube.generatedAt}|${dim}|${c.team}|${c.lead ?? ""}|${c.per.win.start}-${c.per.win.end}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const members = dim === "sae" ? membersOf(c.cube, c.team, c.lead, c.leads) : null;
  const rows: SplitRow[] = [];
  for (const [label, m] of pcBy(c.cube, c.eff, dim)) {
    if (members && !members.includes(label)) continue;
    const byPc: Record<string, number> = {}, byPcPy: Record<string, number> = {};
    let total = 0, totalPy = 0;
    for (const [pc, v] of foldPcs(m)) { const x = pcFig(c.cube, v, c.per); byPc[pc] = x.cur; byPcPy[pc] = x.prev ?? 0; total += x.cur; totalPy += x.prev ?? 0; }
    if (total || totalPy) rows.push({ label, byPc, byPcPy, total, totalPy });
  }
  rows.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  memo.set(key, rows);
  return rows;
}
/** The profit centres the people (or the countries) have revenue in, in their fixed order. */
const pcsOf = (c: FigCtx, dim: PcDim = "sae") => { const rows = pcSplit(c, dim); return PC_ORDER.filter((pc) => rows.some((r) => r.byPc[pc] || r.byPcPy[pc])); };
function PcWaiting() {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, display: "flex", gap: 1.25, alignItems: "center" }}>
      <CircularProgress size={16} />
      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading every company again for its revenue by profit center - a few minutes, once.</Typography>
    </Box>
  );
}

function PcBars({ c, id, actions }: { c: FigCtx; id: string; actions?: React.ReactNode }) {
  if (!hasPc(c)) return <PcWaiting />;
  const all = pcRows(c), sum = all.reduce((a, x) => a + x.cur, 0);
  const rows: BoardRow[] = all.map((r) => ({ label: r.label, cur: r.cur, prev: r.prev ?? 0, sub: `${sum > 0 ? pct(r.cur / sum) : "—"} of the revenue` }));
  return <Leaderboard key={`pc-${c.per.id}`} title={`Revenue ${c.per.title}, by profit center`} rows={rows} curLabel={curLabelOf(c.cube, c.per)} prevLabel={prevLabelOf(c.cube, c.per)} target={targetFor(c, id)} actions={actions} />;
}

/** One profit centre by the people or by country: each one's revenue year to date in it (SARCLA 25.10.2026: "per person
 *  revenue per profit center as a graph"; 26.10: the country table "should be a completely different graph" - his pick, one
 *  chart per profit center) - each its own chart, so each goes to the BUC View alone, with its total on top. */
type PcDim = "sae" | "country";
function PcDimBars({ c, id, pc, dim, actions }: { c: FigCtx; id: string; pc: string; dim: PcDim; actions?: React.ReactNode }) {
  if (!hasPc(c)) return <PcWaiting />;
  const rows: BoardRow[] = pcSplit(c, dim).flatMap((r) => {
    const cur = r.byPc[pc] ?? 0, prev = r.byPcPy[pc] ?? 0;
    return cur || prev ? [{ label: r.label, cur, prev, sub: `${r.total > 0 ? pct(cur / r.total) : "—"} of ${dim === "sae" ? "their" : "its"} revenue` }] : [];
  });
  const cur = rows.reduce((s, r) => s + r.cur, 0), prev = rows.reduce((s, r) => s + r.prev, 0), ch = changeNote(cur, prev);
  return (
    <Leaderboard key={`pc${dim}-${pc}-${c.per.id}`} title={`${PC_NAME[pc]} - revenue ${c.per.title}, by ${lowerOf(dim)}`} rows={rows}
      summary={<>In all {eur(cur)} <span style={{ color: ch?.color ?? FAINT }}>{ch?.text ?? "—"} · {signedEur(cur - prev)}</span></>}
      curLabel={curLabelOf(c.cube, c.per)} prevLabel={prevLabelOf(c.cube, c.per)} first={c.half ? 6 : 8} target={targetFor(c, id)}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${lowerOf(dim)}`} actions={actions} />
  );
}

/** The profit centres' colours and names. */
function PcLegend({ pcs }: { pcs: string[] }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
      {pcs.map((pc) => (
        <Box key={pc} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
          <Box component="span" sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: PC_COLOR[pc] }} />{PC_NAME[pc]}
        </Box>
      ))}
    </Box>
  );
}
/** A breakdown's values, each bar split by profit centre - the year to date; a click shows only that value. */
function PcSplitBars({ c, dim, actions }: { c: FigCtx; dim: Dim; actions?: React.ReactNode }) {
  const rows = hasPc(c) ? pcSplit(c, dim) : [];
  const p = usePages(rows, c.half ? 8 : 12);
  if (!hasPc(c)) return <PcWaiting />;
  const max = Math.max(1, ...p.slice.map((r) => r.total));
  const pcs = PC_ORDER.filter((pc) => rows.some((r) => r.byPc[pc]));
  const sel = c.filters[dim] ?? [];
  const onPick = c.onBar ? (l: string) => c.onBar!(dim, l) : undefined;
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0, display: "grid", gap: 1, gridTemplateColumns: "minmax(0, 1fr)", alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>Revenue {c.per.title} by {lowerOf(dim)}, split by profit center</Typography>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{[onPick ? "Click a row to show only it" : "", p.pages > 1 ? `${p.range}, largest first` : "", `the change against the same days of ${c.cube.years[1]}`].filter(Boolean).join(" · ")}</Typography>
        </Box>
        <PagerArrows page={p.page} pages={p.pages} setPage={p.setPage} />
        {actions}
      </Box>
      <PcLegend pcs={pcs} />
      {rows.length === 0 ? <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Nothing with figures under these filters.</Typography> : (
        <Box sx={{ display: "grid", gap: 0.25 }}>
          {p.slice.map((r) => {
            const on = sel.includes(r.label);
            const line = changeLine(r.total, r.totalPy);
            return (
              <Box key={r.label} component={onPick ? "button" : "div"} type={onPick ? "button" : undefined} onClick={onPick ? () => onPick(r.label) : undefined} aria-pressed={onPick ? on : undefined}
                sx={{ display: "grid", gridTemplateColumns: ROW_COLS, alignItems: "center", columnGap: 1.5, px: 1, py: 0.6, width: "100%",
                  border: 0, font: "inherit", textAlign: "left", borderRadius: "10px", cursor: onPick ? "pointer" : "default",
                  bgcolor: on ? TINT.blue.bg : "transparent", opacity: sel.length && !on ? 0.45 : 1,
                  "&:hover": onPick ? { bgcolor: on ? TINT.blue.bg : "rgba(21,34,58,.035)" } : {}, "&:focus-visible": { outline: `2px solid ${TINT.blue.fg}`, outlineOffset: 1 } }}>
                <Typography noWrap title={r.label} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{r.label}</Typography>
                {/* the segments in the profit centres' fixed order, 2px apart */}
                <Box sx={{ position: "relative", height: 14, minWidth: 0, overflow: "hidden" }}>
                  {(() => {
                    const parts = pcs.filter((pc) => r.byPc[pc] > 0);
                    let at = 0;
                    return parts.map((pc, i) => {
                      const left = (at / max) * 100, width = (r.byPc[pc] / max) * 100;
                      at += r.byPc[pc];
                      return (
                        <Box key={pc} title={`${r.label} - ${PC_NAME[pc]}: ${eur(r.byPc[pc])} (${pct(r.byPc[pc] / r.total)})`}
                          sx={{ position: "absolute", top: 0, bottom: 0, left: `${left}%`, width: `calc(${width}% - ${i < parts.length - 1 ? 2 : 0}px)`, minWidth: "1px",
                            bgcolor: PC_COLOR[pc], borderRadius: i === parts.length - 1 ? "0 4px 4px 0" : 0 }} />
                      );
                    });
                  })()}
                </Box>
                <Box sx={{ textAlign: "right", whiteSpace: "nowrap", minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.25 }}>{eur(r.total)}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: line.color, fontVariantNumeric: "tabular-nums", lineHeight: 1.25 }}>{line.text}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function PcCards({ c, actions }: { c: FigCtx; actions?: React.ReactNode }) {
  if (!hasPc(c)) return <PcWaiting />;
  // the cards of before (BUC View tiles): the year and month to date, the complete months
  const ytd = pcRows({ ...c, per: ytdPer(c.cube) }), mtd = new Map(pcRows({ ...c, per: mtdPer(c.cube) }).map((r) => [r.pc, r]));
  const all = foldPcs(pcBy(c.cube, c.eff).get(""));
  const complete = runOf(c.cube) + (partial(c.cube) ? 0 : 1);
  return (
    <ChartBox title="Revenue month by month, by profit center" actions={actions}
      hint={`Each profit center · the complete months, ${c.cube.years[0]} blue, ${c.cube.years[1]} dashed · its year and month to date against the same days of ${c.cube.years[1]}`}>
      <Box sx={CARDS_GRID(c.half)}>
        {ytd.map((r) => {
          const m = mtd.get(r.pc), pm = all.get(r.pc);
          return (
            <MonthCard key={r.pc} title={r.label}
              lines={[{ label: "Revenue year to date", value: eur(r.cur), ch: changeNote(r.cur, r.prev ?? 0) }, { label: "Revenue month to date", value: eur(m?.cur ?? 0), ch: changeNote(m?.cur ?? 0, m?.prev ?? 0) }]}
              rev={Array.from({ length: complete }, (_, i) => ({ x: MONTH_NAMES[i], cy: pm?.cy[i] ?? 0, py: pm?.py[i] ?? 0 }))} />
          );
        })}
      </Box>
    </ChartBox>
  );
}
function PcTable({ c }: { c: FigCtx }) {
  const rows = pcRows(c);
  const v = (r: PcRow): [number, number] => [r.cur, r.prev ?? 0];
  const sumRev = rows.reduce((s, r) => s + Math.max(0, r.cur), 0);
  const noPrev = rows.some((r) => r.prev == null);
  const total: PcRow = { pc: "", label: "Total", cur: rows.reduce((s, r) => s + r.cur, 0), prev: noPrev ? null : rows.reduce((s, r) => s + (r.prev ?? 0), 0) };
  const P = c.per.title;
  const prevCell = (r: PcRow, f: (a: number, b: number) => React.ReactNode) => (r.prev == null ? "—" : f(r.cur, r.prev));
  const cols: Col<PcRow>[] = [
    { key: "rev", head: `Revenue ${P}`, tip: perWords(c.cube, c.per), cell: (r) => eur(r.cur), sort: (r) => r.cur },
    { key: "revPy", head: c.per.erp ? `Same days ${c.cube.years[1]}` : "A year earlier", tip: `${perWords(c.cube, c.per, 1)} - the running month pro rata`, cell: (r) => (r.prev == null ? "—" : eur(r.prev)), sort: (r) => r.prev ?? -Infinity },
    { key: "diff", head: "Change in €", cell: (r) => prevCell(r, diffCell), sort: (r) => v(r)[0] - v(r)[1] },
    { key: "change", head: "Change in %", cell: (r) => prevCell(r, changeCell), sort: (r) => changeOf(...v(r)) ?? -Infinity },
    { key: "share", head: "Share of revenue", cell: (r) => (r.cur > 0 && sumRev > 0 ? pct(r.cur / sumRev) : "—"), sort: (r) => r.cur },
  ];
  return <FullTable key={`pc-${c.per.id}-${c.team}`} first="Profit center" cols={cols} initial="rev" rows={rows} total={total} />;
}
/** A breakdown's values against the profit centres: each one's year to date, and the total with its change. */
function PcSplitTable({ c, dim }: { c: FigCtx; dim: Dim }) {
  const rows = pcSplit(c, dim);
  const pcs = PC_ORDER.filter((pc) => rows.some((r) => r.byPc[pc]));
  const sumOf = (f: (r: SplitRow) => Record<string, number>) => Object.fromEntries(pcs.map((pc) => [pc, rows.reduce((s, r) => s + (f(r)[pc] ?? 0), 0)]));
  const total: SplitRow = { label: "Total", byPc: sumOf((r) => r.byPc), byPcPy: sumOf((r) => r.byPcPy), total: rows.reduce((s, r) => s + r.total, 0), totalPy: rows.reduce((s, r) => s + r.totalPy, 0) };
  const cols: Col<SplitRow>[] = [
    ...pcs.map((pc) => ({ key: pc, head: PC_NAME[pc], tip: `${PC_NAME[pc]}, revenue ${c.per.title}`, cell: (r: SplitRow) => (r.byPc[pc] ? eur(r.byPc[pc]) : "—"), sort: (r: SplitRow) => r.byPc[pc] ?? 0 })),
    { key: "total", head: `Revenue ${c.per.title}`, tip: `All profit centers - under it the change against ${perWords(c.cube, c.per, 1)}`, cell: (r) => withChangeCell(eur(r.total), r.total, r.totalPy), sort: (r) => r.total },
  ];
  return <FullTable key={`pcsplit-${dim}-${c.team}-${c.per.id}`} first={DIM[dim].name} cols={cols} initial="total" rows={rows} total={total} selected={c.filters[dim]} tint={DIM[dim].tint}
    onPick={c.onPick ? (l) => c.onPick!(dim, l) : undefined} find={`${/^[aeiou]/i.test(lowerOf(dim)) ? "an" : "a"} ${lowerOf(dim)}`} />;
}

/* ── every chart by its key: the tabs draw them, and so does the BUC View ── */

/** What a chart's target is typed in, and what it measures - shown in its Actions window. */
type TargetOf = { unit: "eur" | "pct"; label: string };
type Drawn = {
  /** the chart's own id - the same for an old key, so its target stays */
  id: string; view: View; title: (c: FigCtx) => string; draw: (c: FigCtx, actions?: React.ReactNode) => React.ReactNode; target?: (c: FigCtx) => TargetOf;
  /** an old key's period, kept: "ytd:mtdrev" is the month to date whatever the page's period */
  fixed?: Period;
};
const team = (c: FigCtx) => (c.team === "total" ? "" : ` - ${teamName(c)}`);
/** The chart drawn on its old key's period. */
const onPeriod = (c: FigCtx, p?: Period): FigCtx => (p ? { ...c, per: p === "ytd" ? ytdPer(c.cube) : mtdPer(c.cube) } : c);
/** A chart by its id "<tab>:<chart>" - rev, oi, b2b (and the old ytdrev … mtdb2b), monrev, monoi, months; on Profit center also sae-<pc>, country-<pc>. */
function drawnOf(id: string): Drawn | undefined {
  const [raw, chart = ""] = id.split(":");
  if (!isView(raw)) return undefined;
  // the old Month to date tab is the Performis SAE's, on the month to date
  const v: View = raw === "mtd" ? "ytd" : raw;
  const old = /^(ytd|mtd)(rev|oi|b2b)$/.exec(chart);
  const what = old ? old[2] : /^(rev|oi|b2b)$/.test(chart) ? chart : null;
  const fixed = old ? (old[1] as Period) : undefined;
  const forWhom = (c: FigCtx) => `${teamName(c)}'s target for ${c.per.title} - each team and period its own`;
  if (v === "pc") {
    if (what === "rev") {
      const cid = "pc:rev";
      return { id: cid, view: v, fixed, title: (c) => `Revenue ${onPeriod(c, fixed).per.title}, by profit center${team(c)}`, draw: (c, a) => <PcBars c={onPeriod(c, fixed)} id={cid} actions={a} />,
        target: (c) => ({ unit: "eur", label: `Each profit center's revenue ${c.per.title} is measured against it · ${forWhom(c)}.` }) };
    }
    const one = /^(sae|country)-([a-z]+)$/.exec(chart);
    if (one && PC_ORDER.includes(one[2])) {
      const d = one[1] as PcDim, pc = one[2];
      return { id, view: v, title: (c) => `${PC_NAME[pc]} - revenue ${c.per.title}, by ${lowerOf(d)}${team(c)}`, draw: (c, a) => <PcDimBars c={c} id={id} pc={pc} dim={d} actions={a} />,
        target: (c) => ({ unit: "eur", label: `Each ${d === "sae" ? "person's" : "country's"} revenue ${c.per.title} in ${PC_NAME[pc]} is measured against it · ${forWhom(c)}.` }) };
    }
    if (chart === "country" || chart === "sae") { const d: Dim = chart; return { id, view: v, title: (c) => `Revenue ${c.per.title} by ${lowerOf(d)}, split by profit center${team(c)}`, draw: (c, a) => <PcSplitBars c={c} dim={d} actions={a} /> }; }
    if (chart === "months") return { id, view: v, title: (c) => `Revenue month by month, by profit center${team(c)}`, draw: (c, a) => <PcCards c={c} actions={a} /> };
    return undefined;
  }
  const dim = dimOf(v)!;
  if (what) {
    const w = what as Which | "b2b", cid = `${v}:${w}`;
    return { id: cid, view: v, fixed, title: (c) => `${WHAT_ALL[w]} ${onPeriod(c, fixed).per.title}, by ${lowerOf(dim)}${team(c)}`, draw: (c, a) => <ValueBars c={onPeriod(c, fixed)} id={cid} dim={dim} which={w} actions={a} />,
      target: (c) => (w === "b2b"
        ? { unit: "pct", label: `Each ${lowerOf(dim)}'s book-to-bill ${c.per.title} - the order intake against the revenue - is measured against it, e.g. 100 · ${forWhom(c)}.` }
        : { unit: "eur", label: `Each ${lowerOf(dim)}'s ${WHAT[w].toLowerCase()} ${c.per.title} is measured against it · ${forWhom(c)}.` }) };
  }
  if (v === "ytd" && (chart === "monrev" || chart === "monoi")) {
    const w: Which = chart === "monrev" ? "rev" : "oi";
    const title = (c: FigCtx) => `${WHAT[w]} ${c.per.title}, month by month${team(c)}`;
    return { id, view: v, title, draw: (c, a) => <ChartBox title={title(c)} hint={monthColumnsHint(c, w)} actions={a}><MonthColumns c={c} which={w} target={targetFor(c, id)} /></ChartBox>,
      target: (c) => ({ unit: "eur", label: `Each month's ${WHAT[w].toLowerCase()} is measured against it - a line across the months; the running month is not counted · ${teamName(c)}'s target - each team its own.` }) };
  }
  if (chart === "months") return { id, view: v, title: (c) => `Revenue and customers month by month, by ${lowerOf(dim)}${team(c)}`, draw: (c, a) => <MonthCards c={c} dim={dim} actions={a} /> };
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

type Act = (id: string, title: string, target?: TargetOf) => React.ReactNode;
const draw = (c: FigCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c), d.target?.(c))); };

function TabCard({ c, act, footnote }: { c: FigCtx; act: Act; footnote: React.ReactNode }) {
  const { view, cube, per } = c;
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const against = `${perWords(cube, per)} against ${perWords(cube, per, 1)}`;
  const many = per.months >= 2;
  if (view === "ytd" || view === "mtd") {
    return (
      <GlassCard sx={card}>
        <CardTitle icon={per.months === 1 ? <TodayOutlinedIcon /> : <DateRangeOutlinedIcon />} tint="blue" title={`${teamName(c)}, ${per.title}`}
          note={`${against} · by Performis SAE - the sales agent Performis has on the customer, as its person`} />
        <Box sx={{ ...TWO, mt: -1 }}>
          {draw(c, act, "ytd:rev")}
          {draw(c, act, "ytd:oi")}
        </Box>
        {draw(c, act, "ytd:b2b")}
        {many && (
          <Box sx={TWO}>
            {draw(c, act, "ytd:monrev")}
            {draw(c, act, "ytd:monoi")}
          </Box>
        )}
        <Box>
          <SubTitle>{perCap(per)}, by Performis SAE</SubTitle>
          <ValueTable c={c} dim="sae" />
        </Box>
        {many && (
          <Box>
            <SubTitle>{perCap(per)}, month by month</SubTitle>
            <MonthTable c={c} />
          </Box>
        )}
        {footnote}
      </GlassCard>
    );
  }
  if (view === "pc") return (
    <GlassCard sx={card}>
      <CardTitle icon={<CategoryOutlinedIcon />} tint="green" title={`${teamName(c)} by profit center, ${per.title}`}
        note={`Each customer's monthly revenue by profit center, as the Compass connector brings it from the ERP · ${against}`} />
      {!hasPc(c) ? <PcWaiting /> : (
        <>
          <Box sx={{ mt: -1 }}>{draw(c, act, "pc:rev")}</Box>
          <Box>
            <SubTitle>Each profit center by Performis SAE, {per.title}</SubTitle>
            <Box sx={TWO}>{pcsOf(c).map((pc) => <Box key={pc} sx={{ display: "grid", minWidth: 0 }}>{draw(c, act, `pc:sae-${pc}`)}</Box>)}</Box>
          </Box>
          <Box>
            <SubTitle>Each profit center by country, {per.title}</SubTitle>
            <Box sx={TWO}>{pcsOf(c, "country").map((pc) => <Box key={pc} sx={{ display: "grid", minWidth: 0 }}>{draw(c, act, `pc:country-${pc}`)}</Box>)}</Box>
          </Box>
          <Box><SubTitle>{perCap(per)}, by profit center</SubTitle><PcTable c={c} /></Box>
          <Box><SubTitle>{perCap(per)}, by Performis SAE and profit center</SubTitle><PcSplitTable c={c} dim="sae" /></Box>
        </>
      )}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        The ERP&apos;s year to date per customer carries no profit center: this tab adds up each customer&apos;s monthly revenue by profit center, last year&apos;s running month pro rata - its totals can differ a little from the figures top right.
      </Typography>
      {footnote}
    </GlassCard>
  );
  const d = DIM[view];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={d.icon} tint={d.tint} title={`${teamName(c)} by ${lowerOf(view)}, ${per.title}`}
        note={`${NOTES[view]} · ${against}`} />
      <Box sx={{ ...TWO, mt: -1 }}>
        {draw(c, act, `${view}:rev`)}
        {draw(c, act, `${view}:oi`)}
      </Box>
      {draw(c, act, `${view}:b2b`)}
      <Box><SubTitle>{perCap(per)}, by {lowerOf(view)}</SubTitle><ValueTable c={c} dim={view} /></Box>
      {footnote}
    </GlassCard>
  );
}

/** A tab's card is drawn again only when what it draws from changes - a click elsewhere on the page leaves it be. */
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures top right: the ERP's year and month to date ───────────── */

/** The revenue against the ERP's forecast for the period (the running month pro rata) - the whole company, this year's months only. */
function againstForecast(cube: Cube, kpi: EsoFigures | null, per: Per) {
  const d = erpDate(cube), jan = monthOf(0, 0);
  if (!kpi || !d || d.year !== cube.years[0] || per.win.start < jan) return null;
  let fc = 0;
  for (let k = per.win.start; k <= per.win.end; k++) fc += (kpi.total.forecast[k - jan] ?? 0) * (k - jan === d.month ? monthShare(cube) : 1);
  const rev = per.erp ? pick(erpTotals(cube, {}), per.erp, "rev")[0] : totals(cube, {}, per.win).rev;
  return fc ? { fc, rev, reached: rev / fc } : null;
}
type Fig = { label: string; value: string; ch?: number | null; sub: string; icon: React.ReactNode; tint: Tint;
  /** the change written out (book-to-bill: in points) */
  chText?: { text: string; color: string };
  /** the BUC View's figure cards: their own key, the figure a target is held against, in euros or as a ratio */
  id?: string; amount?: number | null; unit?: "eur" | "pct" };
/** Book-to-bill: the order intake against the revenue, its change in points. */
function b2bFig(label: string, rev: [number, number], oi: [number, number] | null, was: string): Fig {
  const cur = oi && rev[0] ? oi[0] / rev[0] : null, prev = oi && rev[1] ? oi[1] / rev[1] : null;
  return { label, value: oi ? pct(cur) : "—", amount: cur, unit: "pct", chText: cur != null && prev != null ? { text: points(cur, prev), color: tone(cur - prev) } : undefined,
    sub: oi ? `Order intake against revenue · ${was}: ${pct(prev)}` : "Order intake not loaded for this period", icon: <BalanceOutlinedIcon />, tint: "green" };
}
const FigChange = ({ f, size }: { f: Fig; size: string }) => (f.chText
  ? <Typography sx={{ fontSize: size, fontWeight: 700, color: f.chText.color }}>{f.chText.text}</Typography>
  : f.ch !== undefined ? <Typography sx={{ fontSize: size, fontWeight: 700, color: tone(f.ch ?? null) }}>{signedPct(f.ch ?? null)}</Typography> : null);
/** The BUC View's figures: the ERP's year and month to date, as they were. */
function figuresOf(e: ErpAgg, forecast: ReturnType<typeof againstForecast>, cube: Cube): Fig[] {
  const out: Fig[] = [
    { id: "fig-revytd", amount: e.revYtd, unit: "eur", label: "Revenue year to date", value: eur(e.revYtd), ch: changeOf(e.revYtd, e.revYtdPy), sub: `${periodWords(cube, "ytd", 1)}: ${eur(e.revYtdPy)}`, icon: <EuroOutlinedIcon />, tint: "blue" },
    { id: "fig-revmtd", amount: e.revMtd, unit: "eur", label: "Revenue month to date", value: eur(e.revMtd), ch: changeOf(e.revMtd, e.revMtdPy), sub: `${periodWords(cube, "mtd", 1)}: ${eur(e.revMtdPy)}`, icon: <TodayOutlinedIcon />, tint: "blue" },
    { id: "fig-oiytd", amount: e.oiYtd, unit: "eur", label: "Order intake year to date", value: eur(e.oiYtd), ch: changeOf(e.oiYtd, e.oiYtdPy), sub: `${periodWords(cube, "ytd", 1)}: ${eur(e.oiYtdPy)}`, icon: <ShoppingBagOutlinedIcon />, tint: "purple" },
    { id: "fig-oimtd", amount: e.oiMtd, unit: "eur", label: "Order intake month to date", value: eur(e.oiMtd), ch: changeOf(e.oiMtd, e.oiMtdPy), sub: `${periodWords(cube, "mtd", 1)}: ${eur(e.oiMtdPy)}`, icon: <TodayOutlinedIcon />, tint: "purple" },
    { id: "fig-b2bytd", ...b2bFig("Book-to-bill year to date", [e.revYtd, e.revYtdPy], [e.oiYtd, e.oiYtdPy], periodWords(cube, "ytd", 1)) },
  ];
  if (forecast) out.push({ label: "Against forecast", value: `${(forecast.reached * 100).toFixed(1)}%`, sub: `${eur(forecast.rev)} of ${eur(forecast.fc)} to ${dayWords(cube)}`, icon: <FlagOutlinedIcon />, tint: "amber" });
  return out;
}
/** The page's figures: the period's revenue, order intake, book-to-bill and customers (and the forecast on Total). */
function periodFigures(c: FigCtx, forecast: ReturnType<typeof againstForecast>): Fig[] {
  const { cube, per } = c;
  const t = totals(cube, c.eff, per.win);
  const e = per.erp ? erpTotals(cube, c.eff) : null;
  const rev: [number, number] = e ? pick(e, per.erp!, "rev") : [t.rev, t.revPy];
  const oi: [number, number] | null = e ? pick(e, per.erp!, "oi") : oiOk(cube, per) ? [t.oi, t.oiPy] : null;
  const was = perWords(cube, per, 1), P = per.title;
  const out: Fig[] = [
    { label: `Revenue ${P}`, value: eur(rev[0]), ch: changeOf(rev[0], rev[1]), sub: `${was}: ${eur(rev[1])}`, icon: <EuroOutlinedIcon />, tint: "blue" },
    oi ? { label: `Order intake ${P}`, value: eur(oi[0]), ch: changeOf(oi[0], oi[1]), sub: `${was}: ${eur(oi[1])}`, icon: <ShoppingBagOutlinedIcon />, tint: "purple" }
      : { label: `Order intake ${P}`, value: "—", sub: `Not for this period: ${oiLoadedWords(cube)}`, icon: <ShoppingBagOutlinedIcon />, tint: "purple" },
    b2bFig(`Book-to-bill ${P}`, rev, oi, was),
    { label: `Customers ${P}`, value: int(t.bought), ch: changeOf(t.bought, t.boughtPy), sub: `The companies that bought · ${was}: ${int(t.boughtPy)}`, icon: <GroupsOutlinedIcon />, tint: "blue" },
  ];
  if (forecast) out.push({ label: "Against forecast", value: `${(forecast.reached * 100).toFixed(1)}%`, sub: `${eur(forecast.rev)} of ${eur(forecast.fc)} · ${perWords(cube, per)}`, icon: <FlagOutlinedIcon />, tint: "amber" });
  return out;
}
function FigureCards({ items }: { items: Fig[] }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(124px, 172px))", xl: `repeat(${items.length}, minmax(124px, 172px))` }, flex: "0 1 auto" }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{it.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{it.value}</Typography>
            <FigChange f={it} size="0.76rem" />
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

export const KEPT = "eso.team";
export function setQuery(mut: (q: URLSearchParams) => void) {
  const q = new URLSearchParams(window.location.search);
  mut(q);
  const s = q.toString();
  window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
}
export const asTeam = (x: string | null): TeamKey | null => (x === "eso" || x === "tsa" || x === "total" ? x : null);
export function useTeam(): [TeamKey, (t: TeamKey) => void] {
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
export const KEPT_LEAD = "eso.lead";
/** Under ESO, the line manager's team: ?lead= in the address, kept for the next visit. */
export function useLead(): [LeadKey, (l: LeadKey) => void] {
  const params = useSearchParams();
  const [kept, setKept] = useState<LeadKey | null>(null);
  useEffect(() => { try { setKept(asLead(localStorage.getItem(KEPT_LEAD))); } catch { /* all ESO */ } }, []);
  const lead: LeadKey = asLead(params.get("lead")) ?? kept ?? "all";
  const set = (l: LeadKey) => {
    setQuery((q) => { if (l === "all") q.delete("lead"); else q.set("lead", l); });
    setKept(l);
    try { localStorage.setItem(KEPT_LEAD, l); } catch { /* still applies here */ }
  };
  return [lead, set];
}
/** A line manager's team with nobody in it yet: where to set it. */
export function NoLeadYet({ name }: { name: string }) {
  return (
    <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
      Nobody is in {name} yet - pick each ESO person&apos;s line manager in the Line manager column of{" "}
      <Box component={Link} href="/uc/map-assignment#sae-table" sx={{ color: TINT.blue.fg, fontWeight: 600 }}>Map assignment &gt; SAE table</Box>.
    </Typography>
  );
}

function Waiting({ computing, progress, error, picked }: { computing: boolean; progress?: string; error?: string; picked?: boolean }) {
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {computing && !error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>
          {error ? `The figures could not be read: ${error}` : `Reading ${picked ? "the customers chosen" : "every company"} in HubSpot - revenue and order intake${progress ? ` · ${progress}` : ""}…`}
        </Typography>
      </Box>
    </GlassCard>
  );
}
/** The cube read before the ERP's figures were in it (until the first new read after a deployment). */
const tooOld = (cube: Cube) => !cube.erp || !cube.saeTeams;
// the company owner is not the Figures' (SARCLA 25.10.2026: "not relevant for figures, take it out")
const FILTER_DIMS: Dim[] = ["prio", "segment", "potential", "country", "sae", "type", "apic", "mandant"];
export const H1 = { fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 } as const;
/** An address from an earlier version (view=year, sae, owner - and mtd, now the period) opens the Performis SAE tab. */
const viewOf = (x: string | null): View => (isView(x) && x !== "mtd" ? x : "ytd");

export function FiguresExplorer() {
  const params = useSearchParams();
  // the customers chosen (SARCLA 26.10.2026: "customer as well"): the cube of those alone, each its own ?company=… in the address
  const companies = useMemo(() => params.getAll("company").filter((x) => /^\d+$/.test(x)).slice(0, 50), [params]);
  const { cube, computing, progress, error, computedAt } = useCustomersCube(companies);
  const names = useCompanyNames(companies);
  const { kpi, busy } = useKpiSeries();
  const [teamKey, setTeam] = useTeam();
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const leads = lt?.byName ?? null, teams = lt?.teams ?? [];
  const { state: acts } = useActions("eso-figures");
  const view = viewOf(params.get("view"));
  const setView = (v: View) => setQuery((q) => { if (v === "ytd") q.delete("view"); else q.set("view", v); });
  // the period, in the address as Who are our customers keeps it: ?from=2026-04&to=2026-06; none = year to date (an old ?view=mtd: month to date)
  const setWin = (w: Win) => setQuery((q) => {
    if (!cube) return;
    if (view === "ytd" && params.get("view") === "mtd") q.delete("view");
    const ytd = ytdWin(cube);
    if (w.start === ytd.start && w.end === ytd.end) { q.delete("from"); q.delete("to"); } else { q.set("from", ym(cube, w.start)); q.set("to", ym(cube, w.end)); }
  });
  const filters: Filters = useMemo(() => Object.fromEntries(DIMS.flatMap((d) => (d !== "owner" && params.getAll(d).length ? [[d, params.getAll(d)]] : []))), [params]);
  const toggle = (d: Dim, label: string) => setQuery((q) => {
    const cur = q.getAll(d), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
    q.delete(d);
    for (const x of next) q.append(d, x);
  });
  const clearAll = () => setQuery((q) => { for (const d of DIMS) q.delete(d); q.delete("company"); });
  const pick: CustomerPick = {
    chosen: companies.map((id) => names[id] ?? { id, name: `Company ${id}`, country: null, erpId: null }),
    add: (co) => setQuery((q) => { if (!q.getAll("company").includes(co.id)) q.append("company", co.id); }),
    remove: (id) => setQuery((q) => { const keep = q.getAll("company").filter((x) => x !== id); q.delete("company"); for (const x of keep) q.append("company", x); }),
  };
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
  // the work a click asks for, kept: a team, filters and period are read from the cube once, not again on every render;
  // the tabs and toggles answer at once and the charts follow as soon as they are drawn (SARCLA 27.10.2026: "the advanced
  // reporting clicking and feeling feels really slow" - each click held the page 0.3 to 1 s)
  const lead = leadOf(teamKey, leadKey, lt);
  const fromP = params.get("from"), toP = params.get("to"), oldMtd = params.get("view") === "mtd";
  const live = cube && !tooOld(cube) ? cube : null;
  const eff = useMemo(() => (live ? withTeam(live, filters, teamKey, lead, leads) : null), [live, filters, teamKey, lead, leads]);
  const per = useMemo(() => {
    if (!live) return null;
    const a0 = fromYm(live, fromP), b0 = fromYm(live, toP);
    return a0 != null && b0 != null ? perOf(live, clampWindow(live, { start: a0, end: b0 })) : oldMtd ? mtdPer(live) : ytdPer(live);
  }, [live, fromP, toP, oldMtd]);
  const want = useMemo(() => ({ view, per, eff, team: teamKey, lead, filters }), [view, per, eff, teamKey, lead, filters]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<FigCtx | null>(() => (live && drawn.per && drawn.eff ? {
    cube: live, kpi, kpiBusy: busy, team: drawn.team, view: drawn.view, per: drawn.per, filters: drawn.filters, eff: drawn.eff, lead: drawn.lead, leads, teams,
    targets: acts?.targets, picked: companies.length, onPick: toggle, onBar: (d, l) => { toggle(d, l); openOn(d); }, onFilter: openOn,
  } : null), [live, kpi, busy, drawn, leads, teams, acts?.targets, companies.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const figs = useMemo(() => (c ? periodFigures(c, forecastShown(c) ? againstForecast(c.cube, kpi, c.per) : null) : []), [c, kpi]);
  if (!cube || tooOld(cube) || !c || !per) return (
    <Box sx={shell}>
      {back}
      <Typography component="h1" sx={H1}>Figures</Typography>
      <Waiting computing={computing || (!!cube && tooOld(cube))} progress={progress} error={error} picked={companies.length > 0} />
    </Box>
  );
  const active = chosenDims(filters);
  const chosen = active.flatMap((x) => (filters[x] ?? []).map((v) => [x, v] as const));
  // the tile toolbar per chart, keyed "eso-figures:<tab>:<chart>"; the team and the filters in force go with it, and its target per team
  const act: Act = (id, title, target) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-figures:${id}`, page: "eso-figures", tab: c.view, title, summary: `${teamName(c)} · ${perWords(cube, c.per)}`,
        filters: { ...Object.fromEntries(chosenDims(c.filters).map((d) => [d, c.filters[d] ?? []])), team: [c.team], ...(c.lead ? { lead: [c.lead] } : {}), ...perFilters(cube, c.per) }, kind: "card",
        target: target ? { key: targetKey(drawnOf(id)?.id ?? id, c.team, c.lead, c.per), ...target } : undefined }} />
  );
  // the team the toggles show now (the charts may still be drawing the one before)
  const now = { team: teamKey, lead, teams };
  const footnote = (
    <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
      Year and month to date: the ERP file&apos;s own figures per customer, of {dayWords(cube)}, against the same days a year earlier. Any other period, and the months: each customer&apos;s monthly revenue and order intake, summed
      {cube.oiLoaded != null ? ` (the order intake per customer loaded to ${MONTH_NAMES[Math.max(0, oiLoadedOf(cube) - 1)]})` : ""}; the running month the ERP&apos;s month to date. Customers: the companies that bought.
      {teamKey !== "total" ? ` ${teamWord(teamKey)}: the customers Performis gives its people (the SAE, as Map assignment maps it to a person) - a person's team from the rosters, else their HubSpot team.` : ""}
      {lead ? ` ${teamName(c)}: the ESO people Map assignment's SAE table puts in this team.` : ""}
      {companies.length ? ` Customers chosen: only their figures, read from HubSpot as the page opened them.` : ""}
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
            <b style={{ color: INK }}>{teamName(now)}</b>{teamKey !== "total" ? " by Performis SAE" : ""} · {per.title} <b style={{ color: INK }}>{perWords(cube, per)}</b> - against {perWords(cube, per, 1)}{computing ? " · reading HubSpot again" : ""}
          </Typography>
          {(chosen.length > 0 || per.id !== "ytd" || pick.chosen.length > 0) && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {pick.chosen.map((co) => (
                <Chip key={`customer:${co.id}`} size="small" label={<span><b>Customer:</b> {co.name}</span>} onDelete={() => pick.remove(co.id)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.slate.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.slate.fg } }} />
              ))}
              {per.id !== "ytd" && (
                <Chip size="small" label={<span><b>Period:</b> {perCap(per)}</span>} onDelete={() => setWin(ytdWin(cube))} onClick={() => setPanel(true)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.blue.fg } }} />
              )}
              {chosen.map(([x, v]) => (
                <Chip key={`${x}:${v}`} size="small" label={<span><b>{DIM[x].name}:</b> {v}</span>} onDelete={() => toggle(x, v)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[DIM[x].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[x].tint].fg } }} />
              ))}
              {chosen.length + pick.chosen.length > 0 && <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>}
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}>
          <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease" }}><FigureCards items={figs} /></Box>
        </Box>
      </Box>
      {/* ESO | TSA | Total and, under ESO, the line managers' teams beside it - a row of their own, so the two stay side by side */}
      <Box sx={{ display: "grid", gap: 0.75, mt: -0.5 }}>
        <Teams team={teamKey} onTeam={setTeam} lead={leadKey} onLead={setLead} teams={teams} />
        {lead && leads && membersOf(cube, "eso", lead, leads)?.length === 0 && <NoLeadYet name={teamName(now)} />}
      </Box>

      {/* the tabs, and at their right end Views and Filters - as Who are our customers */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="eso-figures" tab={view} onSelect={setView}
            tabs={VIEWS.map((v) => { const d = dimOf(v.id); return { id: v.id, label: v.label, count: d && filters[d]?.length ? String(filters[d]!.length) : null }; })} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-figures" /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else { const d = dimOf(view); if (d) openOn(d); else setPanel(true); } }} variant={panel || active.length || companies.length || per.id !== "ytd" ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-figures-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || active.length || companies.length || per.id !== "ytd" ? undefined : "#fff" }}>
          Filters{chosen.length + companies.length + (per.id !== "ytd" ? 1 : 0) ? ` · ${chosen.length + companies.length + (per.id !== "ytd" ? 1 : 0)}` : ""}
        </Button>
      </Box>

      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} act={act} footnote={footnote} />
      </Box>

      <FilterWindow id="eso-figures-filters" period dims={FILTER_DIMS} open={panel} onClose={() => setPanel(false)} focus={focus} cube={cube}
        win={per.win} setWin={setWin} filters={filters} toggle={toggle} customers={pick} clearAll={() => { clearAll(); setWin(ytdWin(cube)); }} />
    </Box>
  );
}

/* ── the BUC View's first panel ────────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
/** The panel's own cards and month charts: their tile keys */
const PANEL = "eso-figures:panel:";

/** The figures for ESO, TSA or Total with the same toggle, the year to date month by month - and the Figures charts sent here. */
export function FiguresPanel({ acts }: { acts: ActionsState | null }) {
  const { cube, computing, progress, error } = useCustomersCube();
  const { kpi, busy } = useKpiSeries();
  const [teamKey, setTeam] = useState<TeamKey>("eso");
  const [leadKey, setLeadKey] = useState<LeadKey>("all");
  const lt = useLeads();
  const leads = lt?.byName ?? null, teams = lt?.teams ?? [];
  useEffect(() => {
    try { const x = asTeam(localStorage.getItem(KEPT)); if (x) setTeam(x); const l = asLead(localStorage.getItem(KEPT_LEAD)); if (l) setLeadKey(l); } catch { /* ESO */ }
  }, []);
  const choose = (t: TeamKey) => { setTeam(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const chooseLead = (l: LeadKey) => { setLeadKey(l); try { localStorage.setItem(KEPT_LEAD, l); } catch { /* here only */ } };
  const lead = leadOf(teamKey, leadKey, lt);
  // the toggle answers at once, the charts follow as soon as they are drawn - and are not drawn again on every render
  // (SARCLA 27.10.2026: "clicking feels really slow")
  const want = useMemo(() => ({ team: teamKey, lead }), [teamKey, lead]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const ready = cube && !tooOld(cube) ? cube : null;
  const c = useMemo<FigCtx | null>(() => (ready ? { cube: ready, kpi, kpiBusy: busy, team: drawn.team, view: "ytd", per: ytdPer(ready), filters: {}, eff: withTeam(ready, {}, drawn.team, drawn.lead, leads), lead: drawn.lead, leads, teams, targets: acts?.targets } : null),
    [ready, kpi, busy, drawn, leads, teams, acts?.targets]);
  // every chart here follows the panel's ESO | TSA | Total and its line managers' teams (SARCLA 26.10.2026: "the toggle
  // should work in every figures graph") - the team a chart was sent with no longer holds it; its filters and period do
  const st = drawn.team, slead = drawn.lead;
  const items: SortItem[] = useMemo(() => !ready ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-figures" && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const ch = chartOf(spec.key, spec.filters?.part?.[0]);
    const sf: Filters = Object.fromEntries(DIMS.flatMap((d) => (d !== "owner" && spec.filters?.[d]?.length ? [[d, spec.filters[d]]] : [])));
    const fmt = formatOf(acts, spec);
    const sp = ch?.fixed ? (ch.fixed === "ytd" ? ytdPer(ready) : mtdPer(ready)) : perFromFilters(ready, spec.filters) ?? ytdPer(ready);
    const sc: FigCtx = { cube: ready, kpi, kpiBusy: busy, team: st, view: ch?.view ?? "ytd", per: sp, filters: sf, eff: withTeam(ready, sf, st, slead, leads), lead: slead, leads, teams, targets: acts?.targets, half: fmt === "half" };
    const target = ch?.target ? { key: targetKey(ch.id, st, slead, sp), ...ch.target(sc) } : undefined;
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind, target }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<QueryStatsOutlinedIcon />} tint="purple" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [ready, acts, kpi, busy, st, slead, leads, teams]);
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-figures", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = useMemo(() => (c ? figuresOf(erpTotals(c.cube, c.eff), forecastShown(c) ? againstForecast(c.cube, kpi, c.per) : null, c.cube) : []), [c, kpi]);
  // the panel's own cards and month charts have their Actions too (SARCLA 26.10.2026: "some BUC tiles don't have actions"):
  // tasks, a target - and taken off the BUC View there, they stay off
  const ownKey = (id: string) => `${PANEL}${id}`;
  const shown = (id: string) => placementOf(acts, ownKey(id), "nutshell") === "nutshell";
  const ownActions = (id: string, title: string, kind: "kpi" | "card", target?: { key: string; unit: "eur" | "pct"; label: string }) => (
    <TileActions where="nutshell" start="nutshell" edge={2}
      tile={{ key: ownKey(id), page: "eso-figures", tab: "ytd", title: `${title}${c && c.team !== "total" ? ` - ${teamName(c)}` : ""}`, kind,
        filters: { team: [st], ...(slead ? { lead: [slead] } : {}), period: ["ytd"] }, href: `/reporting/eso-benchmark/figures?team=${st}${slead ? `&lead=${slead}` : ""}`, target }} />
  );
  const cards = figs.filter((f) => !f.id || shown(f.id));
  const figTarget = (f: Fig) => (c && f.id ? { key: targetKey(`panel:${f.id}`, st, slead, c.per), unit: f.unit ?? "eur", label: `${f.label} is measured against it · ${teamName(c)}'s target - each team its own.` } : undefined);
  const monthChart = (id: "monrev" | "monoi") => {
    const d = drawnOf(`ytd:${id}`)!;
    return d.draw(c!, ownActions(id, d.title({ ...c!, team: "total" }), "card", d.target ? { key: targetKey(d.id, st, slead, c!.per), ...d.target(c!) } : undefined));
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<QueryStatsOutlinedIcon />} tint="purple" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/figures?team=${teamKey}${lead ? `&lead=${lead}` : ""}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.purple.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Figures</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.purple.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName(c)}${teamKey !== "total" ? " by Performis SAE" : ""} · year to date ${periodWords(c.cube, "ytd")}, month to date ${periodWords(c.cube, "mtd")} - against the same days of ${c.cube.years[1]}` : "Revenue and order intake"}</Typography>
        </Box>
        <Teams team={teamKey} onTeam={choose} lead={leadKey} onLead={chooseLead} teams={teams} />
      </Box>
      {c && lead && leads && membersOf(c.cube, "eso", lead, leads)?.length === 0 && <NoLeadYet name={teamName(c)} />}
      {!c ? <Waiting computing={computing || (!!cube && tooOld(cube))} progress={progress} error={error} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: `repeat(${cards.length}, minmax(0, 1fr))` } }}>
            {cards.map((f) => {
              const tgt = f.id ? targetFor(c, `panel:${f.id}`) : null;
              return (
                <Box key={f.label} sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "grid", gap: 0.75, alignContent: "start", minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <Badge icon={f.icon} tint={f.tint} size={32} />
                    <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
                    {f.id && ownActions(f.id, f.label, "kpi", figTarget(f))}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
                    <FigChange f={f} size="0.82rem" />
                  </Box>
                  <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{f.sub}</Typography>
                  {tgt != null && f.amount != null && (
                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: f.amount >= tgt ? GREEN : RED }}>
                      {pct(f.amount / tgt)} of the target {f.unit === "pct" ? pct(tgt) : eur(tgt)}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
          {/* the year to date month by month, revenue and order intake side by side - the panel's own, with their Actions */}
          {(shown("monrev") || shown("monoi")) && (
            <Box sx={TWO}>
              {shown("monrev") && monthChart("monrev")}
              {shown("monoi") && monthChart("monoi")}
            </Box>
          )}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-figures"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </Box>
      )}
    </GlassCard>
  );
}

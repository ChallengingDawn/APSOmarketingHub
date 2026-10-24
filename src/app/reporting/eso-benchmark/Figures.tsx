"use client";
// THE ESO REPORTS' FIGURES - first in the BUC View and the first page (SARCLA 24.10.2026: "first on BUC View, and also
// a tab, Figures - it should be simple to read: revenue per month per ESO; a toggle ESO | TSA | TOTAL, on click change
// all; OI MTD, OI YTD as the revenue; to forecast" - the forecast "on total per month, as it is today on the dashboard").
// Total is the company's own series, the one SARCLA's HubSpot dashboard reads; ESO and TSA are their people's
// customers, summed (src/lib/reporting/esoFigures.ts). Drawn as the other ESO pages: title, figures top right, tabs
// with Views, each tab its charts then all the figures; every chart with Actions, so it can go to the BUC View.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { DimChart, THIS, BEFORE } from "@/app/reporting/marketing-kpis/DimChart";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, refreshActions, send, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import type { Book, EsoFigures, MPair } from "@/lib/reporting/esoFiguresRules";
import { ChartBox, Change, Figures as FigureCards, chg, type EsoFigure } from "./EsoKit";
import { money, moneyShort, n0 } from "./shared";

/* ── the read ──────────────────────────────────────────────────────────── */

type State = { ok?: boolean; value?: EsoFigures; computing?: boolean; progress?: string; computedAt?: string; error?: string };
export function useFigures(): State | null {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-figures").then((r) => r.json())
      .then((j: State) => { if (!alive) return; setState(j); if (j.computing) timer = setTimeout(load, 5000); })
      .catch((e) => { if (alive) setState({ error: String(e) }); });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  return state;
}

/* ── one team's figures ────────────────────────────────────────────────── */

export type TeamKey = "eso" | "tsa" | "total";
export const TEAMS: { id: TeamKey; label: string }[] = [{ id: "eso", label: "ESO" }, { id: "tsa", label: "TSA" }, { id: "total", label: "Total" }];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A row of the breakdown: a person (ESO, TSA) or a team (Total). Its months: null where not loaded yet. */
type Row = { key: string; label: string; rev: (MPair | null)[]; oi: (MPair | null)[]; revMtd: MPair; revYtd: MPair; oiMtd: MPair; oiYtd: MPair; companies: number };
export type FigView = {
  team: TeamKey; d: EsoFigures;
  /** the running month, 0-based: its figures are month-to-date */
  m: number;
  rev: MPair[]; oi: (MPair | null)[]; revMtd: MPair; revYtd: MPair; oiMtd: MPair; oiYtd: MPair;
  /** Total only: the ERP forecast, 12 months */
  forecast: number[] | null;
  rows: Row[];
  /** "Jan–Oct 2026" */
  cy: string; py: string;
};
const sum = (ps: MPair[]): MPair => ps.reduce((t, p) => ({ cy: t.cy + p.cy, py: t.py + p.py }), { cy: 0, py: 0 });
const z = (): MPair => ({ cy: 0, py: 0 });

function rowOf(key: string, label: string, books: Book[], d: EsoFigures): Row {
  const m = d.month - 1;
  const rev = Array.from({ length: m + 1 }, (_, i) => sum(books.map((b) => b.rev.months[i])));
  // order intake per customer is loaded month by month behind the ERP: a month not loaded yet is "—", the running month is the ERP's
  const oi = Array.from({ length: m + 1 }, (_, i) => (i < d.oiMonths || i === m ? sum(books.map((b) => b.oi.months[i])) : null));
  return {
    key, label, rev, oi, companies: books.reduce((s, b) => s + b.companies, 0),
    revMtd: sum(books.map((b) => b.rev.mtd)), revYtd: sum(books.map((b) => b.rev.ytd)), oiMtd: sum(books.map((b) => b.oi.mtd)), oiYtd: sum(books.map((b) => b.oi.ytd)),
  };
}

export function viewOf(d: EsoFigures, team: TeamKey): FigView {
  const m = d.month - 1;
  const cy = `Jan–${MONTH[m]} ${d.year}`, py = `Jan–${MONTH[m]} ${d.py}`;
  if (team === "total") {
    const rev = d.total.rev, oi = d.total.oi;
    const groups: [string, string, Book["team"][]][] = [["ESO", "ESO", ["ESO"]], ["TSA", "TSA", ["TSA"]], ["Other", "Other owners", ["Other"]], ["None", "No owner", ["None"]]];
    return {
      team, d, m, cy, py, rev, oi, forecast: d.total.forecast,
      revMtd: rev[m] ?? z(), revYtd: sum(rev.slice(0, m + 1)), oiMtd: oi[m] ?? z(), oiYtd: sum(oi.slice(0, m + 1)),
      rows: groups.map(([key, label, teams]) => rowOf(key, label, d.books.filter((b) => teams.includes(b.team)), d)).filter((r) => r.companies > 0),
    };
  }
  const books = d.books.filter((b) => b.team === (team === "eso" ? "ESO" : "TSA"));
  const all = rowOf("all", "", books, d);
  return {
    team, d, m, cy, py, rev: all.rev as MPair[], oi: all.oi, forecast: null,
    revMtd: all.revMtd, revYtd: all.revYtd, oiMtd: all.oiMtd, oiYtd: all.oiYtd,
    rows: books.map((b) => rowOf(b.id, b.active ? b.name : `${b.name} (left)`, [b], d)).sort((a, b) => b.revYtd.cy - a.revYtd.cy),
  };
}

const teamWord = (t: TeamKey) => (t === "total" ? "APSOparts" : t === "eso" ? "ESO" : "TSA");
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
/** "Oct to the 23rd" - how far the running month goes */
const asOfWords = (d: EsoFigures) => (d.asOf ? `${MONTH[d.month - 1]} to the ${ordinal(Number(d.asOf.slice(8, 10)))}` : `${MONTH[d.month - 1]} so far`);
/** The forecast of the completed months, and the revenue against it. */
const forecastDone = (v: FigView) => {
  if (!v.forecast) return null;
  const fc = v.forecast.slice(0, v.m).reduce((s, x) => s + x, 0);
  const rev = v.rev.slice(0, v.m).reduce((s, p) => s + p.cy, 0);
  return { fc, rev, pct: fc ? rev / fc : null, monthFc: v.forecast[v.m] ?? 0 };
};
const pctOf = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);

/* ── the pieces ────────────────────────────────────────────────────────── */

/** ESO | TSA | Total - a click changes every figure of the page. */
export function TeamToggle({ team, onTeam }: { team: TeamKey; onTeam: (t: TeamKey) => void }) {
  return (
    <Box role="group" aria-label="Whose figures" sx={{ display: "inline-flex", p: 0.5, gap: 0.5, borderRadius: "14px", bgcolor: "rgba(255,255,255,.75)", border: `1px solid ${HAIRLINE}`, justifySelf: "start" }}>
      {TEAMS.map((t) => {
        const on = t.id === team;
        return (
          <Box key={t.id} component="button" type="button" onClick={() => onTeam(t.id)} aria-pressed={on}
            sx={{ border: 0, font: "inherit", fontSize: "0.88rem", fontWeight: 700, px: 2.25, py: 0.85, borderRadius: "10px", cursor: "pointer", color: on ? "#fff" : INK, bgcolor: on ? TINT.blue.fg : "transparent", "&:hover": { bgcolor: on ? TINT.blue.fg : "rgba(21,34,58,.05)" } }}>
            {t.label}
          </Box>
        );
      })}
    </Box>
  );
}

export function figureItems(v: FigView): EsoFigure[] {
  const f = forecastDone(v);
  const items: EsoFigure[] = [
    { label: "Revenue MTD", icon: <TodayOutlinedIcon />, tint: "purple", value: moneyShort(v.revMtd.cy), d: chg(v.revMtd), sub: `${moneyShort(v.revMtd.py)} the same days last year` },
    { label: "Revenue YTD", icon: <EuroOutlinedIcon />, tint: "purple", value: moneyShort(v.revYtd.cy), d: chg(v.revYtd), sub: `${moneyShort(v.revYtd.py)} last year` },
    { label: "Order intake MTD", icon: <TodayOutlinedIcon />, tint: "blue", value: moneyShort(v.oiMtd.cy), d: chg(v.oiMtd), sub: `${moneyShort(v.oiMtd.py)} the same days last year` },
    { label: "Order intake YTD", icon: <ShoppingBagOutlinedIcon />, tint: "blue", value: moneyShort(v.oiYtd.cy), d: chg(v.oiYtd), sub: `${moneyShort(v.oiYtd.py)} last year` },
  ];
  if (f) items.push({ label: "Against forecast", icon: <FlagOutlinedIcon />, tint: "amber", value: pctOf(f.pct), d: null, sub: `Jan–${MONTH[v.m - 1] ?? "—"}: ${moneyShort(f.rev)} of ${moneyShort(f.fc)}` });
  return items;
}

/** Month by month: this year's bars against last year's - and, on Total, the forecast as a line, the whole year. */
function MonthsChart({ v, which, half }: { v: FigView; which: "rev" | "oi"; half?: boolean }) {
  const fc = which === "rev" ? v.forecast : null;
  const last = fc ? 11 : v.m;
  const ps = which === "rev" ? v.rev : v.oi;
  const data = MONTH.slice(0, last + 1).map((x, i) => ({
    x: i === v.m ? `${x}*` : x,
    cy: i <= v.m ? ps[i]?.cy ?? null : null, py: i <= v.m ? ps[i]?.py ?? null : null,
    ...(fc ? { fc: fc[i] ?? null } : {}),
  }));
  return (
    <ResponsiveContainer width="100%" height={half ? 240 : 300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="#e6e8ec" />
        <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: MUTED }} />
        <YAxis tickFormatter={(x: number) => moneyShort(x)} tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11.5, fill: MUTED }} />
        <Tooltip formatter={(x: unknown, n: unknown) => [x == null ? "—" : money(Number(x)), String(n)]} contentStyle={{ fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" }} />
        <Legend verticalAlign="top" align="left" height={28} iconType="circle" wrapperStyle={{ fontSize: "0.78rem" }} />
        <Bar dataKey="cy" name={String(v.d.year)} fill={THIS} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="py" name={String(v.d.py)} fill={BEFORE} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        {fc && <Line dataKey="fc" name={`Forecast ${v.d.year}`} stroke="#d99a2b" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: "#fff", stroke: "#d99a2b", strokeWidth: 2 }} isAnimationActive={false} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** A figure per person (ESO, TSA) or per team (Total), this year against last. */
function RowsChart({ v, title, pick, actions, half }: { v: FigView; title: string; pick: (r: Row) => MPair; actions?: React.ReactNode; half?: boolean }) {
  const rows = v.rows.map((r) => ({ label: r.label, p: pick(r) }));
  return <DimChart title={title} rows={rows} cur={(r) => r.p.cy} prev={(r) => r.p.py} curLabel={v.cy} prevLabel={v.py} fmt={moneyShort} fixedOrder={v.team === "total"} pageSize={half ? 6 : 12} actions={actions} />;
}

/* ── the charts, by key: the page draws them, and so does the BUC View ─── */

const monthNote = (v: FigView, which: "rev" | "oi") => `${teamWord(v.team)} · ${MONTH[v.m]}* = ${asOfWords(v.d)}, against the same days of ${v.d.py}${which === "rev" && v.forecast ? " · the forecast: the ERP's, the whole company" : ""}${which === "oi" && v.team !== "total" && v.d.oiMonths < v.m ? ` · order intake per customer is loaded through ${MONTH[v.d.oiMonths - 1] ?? "—"}` : ""}`;
export const FIG_CHARTS: Record<string, { title: (v: FigView) => string; draw: (v: FigView, actions?: React.ReactNode, half?: boolean) => React.ReactNode }> = {
  "revenue:months": {
    title: (v) => `Revenue per month - ${teamWord(v.team)}`,
    draw: (v, actions, half) => <ChartBox title={`Revenue per month${v.forecast ? ", against the forecast" : ""} - ${teamWord(v.team)}`} note={monthNote(v, "rev")} actions={actions}><MonthsChart v={v} which="rev" half={half} /></ChartBox>,
  },
  "revenue:rows": {
    title: (v) => (v.team === "total" ? "Revenue YTD per team" : `Revenue YTD per person - ${teamWord(v.team)}`),
    draw: (v, actions, half) => <RowsChart v={v} title={v.team === "total" ? "Revenue YTD per team" : `Revenue YTD per person - ${teamWord(v.team)}`} pick={(r) => r.revYtd} actions={actions} half={half} />,
  },
  "oi:months": {
    title: (v) => `Order intake per month - ${teamWord(v.team)}`,
    draw: (v, actions, half) => <ChartBox title={`Order intake per month - ${teamWord(v.team)}`} note={monthNote(v, "oi")} actions={actions}><MonthsChart v={v} which="oi" half={half} /></ChartBox>,
  },
  "oi:rows": {
    title: (v) => (v.team === "total" ? "Order intake YTD per team" : `Order intake YTD per person - ${teamWord(v.team)}`),
    draw: (v, actions, half) => <RowsChart v={v} title={v.team === "total" ? "Order intake YTD per team" : `Order intake YTD per person - ${teamWord(v.team)}`} pick={(r) => r.oiYtd} actions={actions} half={half} />,
  },
  "mtd:revenue": {
    title: (v) => `Revenue MTD per ${v.team === "total" ? "team" : "person"}`,
    draw: (v, actions, half) => <RowsChart v={v} title={`Revenue MTD per ${v.team === "total" ? "team" : "person"} - ${MONTH[v.m]} to the same day`} pick={(r) => r.revMtd} actions={actions} half={half} />,
  },
  "mtd:oi": {
    title: (v) => `Order intake MTD per ${v.team === "total" ? "team" : "person"}`,
    draw: (v, actions, half) => <RowsChart v={v} title={`Order intake MTD per ${v.team === "total" ? "team" : "person"} - ${MONTH[v.m]} to the same day`} pick={(r) => r.oiMtd} actions={actions} half={half} />,
  },
};

/* ── the tables ────────────────────────────────────────────────────────── */

const k = (x: number | null | undefined) => (x == null ? "—" : moneyShort(x));
const dim = (s: string) => <Box component="span" sx={{ color: MUTED }}>{s}</Box>;

/** A row per person (or team) and a column per month, this year; then the year to date against last year's. */
function PerMonth({ v, which }: { v: FigView; which: "rev" | "oi" }) {
  const months = MONTH.slice(0, v.m + 1);
  const ytd = (r: Row) => (which === "rev" ? r.revYtd : r.oiYtd);
  const all = { months: which === "rev" ? v.rev : v.oi, ytd: which === "rev" ? v.revYtd : v.oiYtd };
  return (
    <Table head={[v.team === "total" ? "Team" : "Person", ...months.map((x, i) => (i === v.m ? `${x}*` : x)), "YTD", "Last year", "Change"]}
      firstWidth="minmax(170px, 1.6fr)" widths={[...months.map(() => "minmax(62px, .7fr)"), "minmax(80px, 1fr)", "minmax(80px, 1fr)", "minmax(76px, .8fr)"]} minWidth={190 + months.length * 66 + 260}
      rows={[
        ...v.rows.map((r) => ({ key: r.key, cells: [r.label, ...(which === "rev" ? r.rev : r.oi).map((p) => k(p?.cy)), k(ytd(r).cy), dim(k(ytd(r).py)), <Change key="c" p={ytd(r)} />] })),
        { key: "total", strong: true, cells: [v.team === "total" ? "APSOparts (the ERP's series)" : `All ${teamWord(v.team)}`, ...all.months.slice(0, v.m + 1).map((p) => k(p?.cy)), k(all.ytd.cy), k(all.ytd.py), <Change key="c" p={all.ytd} />] },
      ]} />
  );
}

/** Total: month by month - revenue, last year, the forecast and how much of it was reached. */
function AgainstForecast({ v }: { v: FigView }) {
  const fc = v.forecast ?? [];
  return (
    <Table head={["Month", `Revenue ${v.d.year}`, String(v.d.py), "Change", "Forecast", "Reached"]} firstWidth="minmax(110px, 1fr)"
      rows={[
        ...MONTH.map((x, i) => ({
          key: x, cells: [i === v.m ? `${x}* (${asOfWords(v.d)})` : x, i <= v.m ? money(v.rev[i]?.cy ?? 0) : "—", i <= v.m ? dim(money(v.rev[i]?.py ?? 0)) : "—", i <= v.m ? <Change key="c" p={v.rev[i] ?? z()} /> : "—",
            fc[i] ? money(fc[i]) : "—", i < v.m && fc[i] ? <Reached key="r" x={(v.rev[i]?.cy ?? 0) / fc[i]} /> : i === v.m && fc[i] ? <Box key="r" component="span" sx={{ color: FAINT }}>{pctOf((v.rev[i]?.cy ?? 0) / fc[i])} so far</Box> : "—"],
        })),
        (() => { const f = forecastDone(v)!; return { key: "done", strong: true, cells: [`Jan–${MONTH[v.m - 1] ?? "—"}`, money(f.rev), money(v.rev.slice(0, v.m).reduce((s, p) => s + p.py, 0)), <Change key="c" p={sum(v.rev.slice(0, v.m))} />, money(f.fc), <Reached key="r" x={f.pct ?? NaN} />] }; })(),
      ]} />
  );
}
function Reached({ x }: { x: number }) {
  return <Box component="span" sx={{ fontWeight: 700, color: !Number.isFinite(x) ? FAINT : x >= 1 ? GREEN : x >= 0.95 ? MUTED : RED }}>{pctOf(x)}</Box>;
}

/** Month and year to date, revenue and order intake, per person (or team). */
function MtdYtd({ v }: { v: FigView }) {
  return (
    <Table head={[v.team === "total" ? "Team" : "Person", "Revenue MTD", "Last year", "Revenue YTD", "Last year", "Change", "Order intake MTD", "Last year", "Order intake YTD", "Last year", "Change"]}
      firstWidth="minmax(170px, 1.6fr)" minWidth={190 + 10 * 96}
      rows={[
        ...v.rows.map((r) => ({ key: r.key, cells: [r.label, k(r.revMtd.cy), dim(k(r.revMtd.py)), k(r.revYtd.cy), dim(k(r.revYtd.py)), <Change key="a" p={r.revYtd} />, k(r.oiMtd.cy), dim(k(r.oiMtd.py)), k(r.oiYtd.cy), dim(k(r.oiYtd.py)), <Change key="b" p={r.oiYtd} />] })),
        { key: "total", strong: true, cells: [v.team === "total" ? "APSOparts (the ERP's series)" : `All ${teamWord(v.team)}`, k(v.revMtd.cy), k(v.revMtd.py), k(v.revYtd.cy), k(v.revYtd.py), <Change key="a" p={v.revYtd} />, k(v.oiMtd.cy), k(v.oiMtd.py), k(v.oiYtd.cy), k(v.oiYtd.py), <Change key="b" p={v.oiYtd} />] },
      ]} />
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

const TABS = [
  { id: "revenue", label: "Revenue" },
  { id: "oi", label: "Order intake" },
  { id: "mtd", label: "MTD & YTD" },
] as const;
type TabId = (typeof TABS)[number]["id"];
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
    setQuery((q) => { if (t === "eso") q.delete("team"); else q.set("team", t); });
    setKept(t);
    try { localStorage.setItem(KEPT, t); } catch { /* still applies here */ }
  };
  return [team, set];
}

function Waiting({ state }: { state: State | null }) {
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {!state?.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>
          {state?.error ? `The figures could not be read: ${state.error}` : `Reading HubSpot - the customers' ERP figures and the company's series${state?.progress ? ` · ${state.progress}` : ""}…`}
        </Typography>
      </Box>
    </GlassCard>
  );
}

export function FiguresExplorer() {
  const state = useFigures();
  const d = state?.value;
  const params = useSearchParams();
  const [team, setTeam] = useTeam();
  const tab: TabId = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "revenue") as TabId;
  const setTab = (id: TabId) => setQuery((q) => { if (id === "revenue") q.delete("tab"); else q.set("tab", id); });
  const v = d ? viewOf(d, team) : null;
  const act = (key: string, title: string) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-figures:${tab}:${key}`, page: "eso-figures", tab, title, summary: v ? `${teamWord(team)} · revenue YTD ${moneyShort(v.revYtd.cy)}, order intake YTD ${moneyShort(v.oiYtd.cy)}` : undefined, filters: { team: [team] }, kind: "card" }} />
  );
  const charts = Object.keys(FIG_CHARTS).filter((key) => key.startsWith(`${tab}:`));
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 }}>
      <Box component={Link} href="/reporting/eso-benchmark" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
        <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
      </Box>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 1 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>Figures</Typography>
          {v && (
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
              <b style={{ color: INK }}>{v.cy}</b> ({asOfWords(v.d)}) against the same days of {v.d.py} · {teamWord(team)} · the ERP&apos;s figures{v.d.asOf ? ` of ${new Date(v.d.asOf).toLocaleDateString("en-GB")}` : ""}{state?.computing ? " · reading HubSpot again" : ""}
            </Typography>
          )}
          <TeamToggle team={team} onTeam={setTeam} />
        </Box>
        {v && <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><FigureCards items={figureItems(v)} /></Box>}
      </Box>
      {!v || !d ? <Waiting state={state} /> : (
        <>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
            <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
              <ReportTabs name="eso-figures" tab={tab} onSelect={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: null }))} />
            </Box>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-figures" /></Box>
          </Box>
          <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
            <CardTitle icon={tab === "oi" ? <ShoppingBagOutlinedIcon /> : tab === "mtd" ? <TodayOutlinedIcon /> : <EuroOutlinedIcon />} tint={tab === "oi" ? "blue" : tab === "mtd" ? "amber" : "purple"}
              title={tab === "revenue" ? `Revenue - ${teamWord(team)}` : tab === "oi" ? `Order intake - ${teamWord(team)}` : `Month and year to date - ${teamWord(team)}`}
              note={team === "total" ? "The company's own series, as on the HubSpot dashboard - and by team, each customer under its owner today" : `Each ${teamWord(team)} person's customers, under their owner today - a click on ESO, TSA or Total changes every figure`} />
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, mt: -1 }}>
              {charts.map((key) => <Box key={`${key}-${team}`} sx={{ minWidth: 0 }}>{FIG_CHARTS[key].draw(v, act(key.split(":")[1], FIG_CHARTS[key].title(v)))}</Box>)}
            </Box>
            {tab === "revenue" && team === "total" && (
              <Box>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>Month by month, against the forecast</Typography>
                <AgainstForecast v={v} />
              </Box>
            )}
            <Box>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>
                {tab === "mtd" ? "All the figures" : `All the figures, ${tab === "revenue" ? "revenue" : "order intake"} per ${team === "total" ? "team" : "person"} and month`}
              </Typography>
              {tab === "mtd" ? <MtdYtd v={v} /> : <PerMonth v={v} which={tab === "oi" ? "oi" : "rev"} />}
            </Box>
            <Typography component="div" sx={{ fontSize: "0.76rem", color: FAINT }}>
              {MONTH[v.m]}* = month to date: {asOfWords(d)}, against the same days of {d.py}. {team === "total"
                ? "Total = the KPI series the HubSpot dashboard reads (revenue_geo_erp_monthly, oi_geo_monthly, forecast_monthly). The teams add up each customer's own figures - a few tenths of a per cent under the series (customers without a HubSpot record); Other owners = Back Office and everyone outside the ESO and TSA rosters."
                : `Months before ${MONTH[v.m]} from each customer's monthly revenue and order intake; month and year to date from the ERP file - so the months can lag the ERP's year to date by the last load. A customer counts for its owner today.`}
            </Typography>
          </GlassCard>
          <Typography component="div" sx={{ fontSize: "0.76rem", color: FAINT }}>
            Read from HubSpot {new Date(state?.computedAt ?? d.generatedAt).toLocaleString("en-GB")} · {n0(d.companies)} customers with ERP figures · refreshed every 6 hours.
            {d.errors.length > 0 && <Box component="span" sx={{ color: RED }}> {d.errors.join(" ")}</Box>}
          </Typography>
        </>
      )}
    </Box>
  );
}

/* ── the BUC View's first panel ────────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;

/** The figures for ESO, TSA or Total with the same toggle, revenue per month - and the Figures charts sent here. */
export function FiguresPanel({ acts }: { acts: ActionsState | null }) {
  const state = useFigures();
  const d = state?.value;
  const [team, setTeam] = useState<TeamKey>("eso");
  useEffect(() => { try { const x = localStorage.getItem(KEPT); if (x === "eso" || x === "tsa" || x === "total") setTeam(x); } catch { /* ESO */ } }, []);
  const pick = (t: TeamKey) => { setTeam(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const v = d ? viewOf(d, team) : null;
  const items: SortItem[] = !d ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-figures").map(({ spec }) => {
    const [, tab, card] = spec.key.split(":");
    const ch = FIG_CHARTS[`${tab}:${card}`];
    const sent = spec.filters?.team?.[0];
    const tv = viewOf(d, sent === "eso" || sent === "tsa" || sent === "total" ? sent : team);
    const fmt = formatOf(acts, spec);
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(tv, actions, fmt === "half") : <GlassCard><CardTitle icon={<QueryStatsOutlinedIcon />} tint="purple" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  });
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-figures", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<QueryStatsOutlinedIcon />} tint="purple" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/figures${team === "eso" ? "" : `?team=${team}`}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.purple.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Figures</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.purple.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{v ? `${v.cy} (${asOfWords(v.d)}) against the same days of ${v.d.py} · ${teamWord(team)}` : "Revenue and order intake, per month and per person"}</Typography>
        </Box>
        <TeamToggle team={team} onTeam={pick} />
      </Box>
      {!v ? <Waiting state={state} /> : (
        <>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: `repeat(${figureItems(v).length}, minmax(0, 1fr))` } }}>
            {figureItems(v).map((f) => (
              <Box key={f.label} sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "grid", gap: 0.75, alignContent: "start", minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Badge icon={f.icon} tint={f.tint} size={32} />
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
                  {f.d && <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: f.d.color }}>{f.d.text}</Typography>}
                </Box>
                <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{f.sub}</Typography>
              </Box>
            ))}
          </Box>
          {/* revenue per month - with the forecast on Total - the panel's own chart */}
          {FIG_CHARTS["revenue:months"].draw(v)}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-figures"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </>
      )}
    </GlassCard>
  );
}

"use client";
// THE CUSTOMER REPORTS - Customer KPIs (SARCLA 01.11.2026 on Customer Reports: "based on what we know, think about what kind
// of dynamic KPI would be interesting here"). The whole company - no ESO | TSA | Total - on Who are our customers' cube and
// the companies kept beside it; the figures are worked out on the server (/api/reporting/customer-kpis, customerKpis.ts),
// the companies never come to the browser. Five pages, each built as the ESO reports this week: the title and the figures
// top right, a tab per breakdown with the Filters at their end, what the page is filtered by under the tabs, each graph its
// own card with its filter and its "Companies" button - the list adds up to the graph (ledger.ts companiesOf).
//   Customer base           active, new, won back, lost - and month by month what came and what went
//   Revenue concentration   revenue per customer (average, median), the top 10% and 20%, the revenue bands, the largest
//   Cross-selling           one, two, three or more profit centres, the pairs, the cross-sell targets
//   Recency & risk          months since the last order, at risk, decreasing, lost - the lists are the call lists
//   Retention               net and gross revenue retention, the customer retention rate, by cohort
// No Actions, no BUC View, no targets here (SARCLA 01.11.2026: "no actions are needed here because no BUC view").

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import AdsClickOutlinedIcon from "@mui/icons-material/AdsClickOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import AutorenewOutlinedIcon from "@mui/icons-material/AutorenewOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { BEFORE, THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { DIM, useCompanyNames, useCustomersCube, type CustomerPick } from "@/app/reporting/marketing-kpis/Customers";
import { FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { CardFilterFor, ChartBox, CubeFilterWindow, CubePeriod, FullTable, H1, Leaderboard, TWO, niceTop, periodsOf, setQuery, type BoardRow, type Col, type Per } from "@/app/reporting/eso-benchmark/Figures";
import { ActiveFilters, type ActiveItem } from "@/app/reporting/eso-benchmark/EsoFilters";
import {
  DIMS, MONTH_NAMES, PRIO_ORDER, chosenDims, clampWindow, monthLabel, monthOf, partial, presets, upToDate, windowLabel, yearOfMonth,
  type Cube, type Dim, type Filters, type Win,
} from "@/lib/marketingKpis/cube";
import type { CompanyBy } from "@/lib/marketingKpis/ledger";
import { DEFAULT_MIN, MINS, RECENCY } from "@/lib/marketingKpis/customerRules";
import { KPI_DIMS, grr, keptRate, nrr, type BaseFig, type ConcFig, type CrossFig, type KpiDim, type KpiOut, type KpiPage, type RecFig, type RetFig } from "@/lib/marketingKpis/customerKpis";
import { customerCompanies } from "./customerCompanies";

/* ── words and numbers, in full ────────────────────────────────────────── */

const int = (n: number) => Math.round(n).toLocaleString("en");
const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const pct = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const signedInt = (n: number) => `${Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? "−" : "±"}${Math.abs(Math.round(n)).toLocaleString("en")}`;
const points = (a: number, b: number) => `${a - b > 0 ? "+" : a - b < 0 ? "−" : "±"}${Math.abs((a - b) * 100).toFixed(1)} pts`;
const tone = (x: number | null, lower = false) => (x == null || Math.abs(x) < 0.0005 ? FAINT : (x > 0) !== lower ? GREEN : RED);
// every change in words (SARCLA 29.10.2026: "you have to be really explicit with text")
const moreLess = (n: number, fmt: (x: number) => string, less: string, more: string, tail = "") => (Math.round(n) === 0 ? "no change" : `${fmt(Math.abs(n))} ${n < 0 ? less : more}${tail}`);
const fewerMore = (n: number) => moreLess(n, int, "fewer", "more");
const lessMore = (n: number) => moreLess(n, eur, "less", "more");
const perCustomer = (n: number) => moreLess(n, eur, "less", "more", " per customer");
const div = (a: number, b: number) => (b > 0 ? a / b : 0);

/* ── the pages ─────────────────────────────────────────────────────────── */

export type PageId = "base" | "concentration" | "cross-selling" | "recency" | "retention";
const API: Record<PageId, KpiPage> = { base: "base", concentration: "concentration", "cross-selling": "cross", recency: "recency", retention: "retention" };
const TITLE: Record<PageId, string> = { base: "Customer base", concentration: "Revenue concentration", "cross-selling": "Cross-selling", recency: "Recency & risk", retention: "Retention" };
/** The pages with an amount "at least" (at risk, decreasing, the cross-sell targets). */
const WITH_MIN: PageId[] = ["cross-selling", "recency"];

type View = "overview" | KpiDim;
const VIEW_IDS: View[] = ["overview", ...KPI_DIMS];
const isView = (x: string | null | undefined): x is View => (VIEW_IDS as string[]).includes(x ?? "");
/** The company owner under its own name (DIM calls it the sales rep) - as the ESO reports. */
const nameOf = (d: Dim) => (d === "owner" ? "Company owner" : DIM[d].name);
const lowerOf = (d: Dim) => (d === "owner" ? "company owner" : DIM[d].lower);
const NOTES: Record<KpiDim, string> = {
  country: "Where the customers are",
  segment: "APSOcore, APSOgrowth, APSOprospect, APSOlost, APSOmicro, Growth Engine - as HubSpot has the company today",
  prio: "The sales priority Smart Segmentation gives each company",
  type: "OEM, C2S workshops, MRO, resellers",
  sae: "The sales agent Performis has on the customer, as its person",
  owner: "The company owner in HubSpot",
};
const PC_NAME: Record<string, string> = { dt: "Sealing (DT)", ft: "Fluid (FT)", kt: "Engineering Plastics (KT)", at: "Drive (AT)", st: "Antivibration (ST)" };

/* ── the period ────────────────────────────────────────────────────────── */

const ytdWin = (cube: Cube): Win => presets(cube)[0].win;
function perOf(cube: Cube, win: Win): Per {
  const p = periodsOf(cube).find((x) => x.win.start === win.start && x.win.end === win.end);
  const title = p?.id === "ytd" ? "year to date" : p?.id === "mtd" ? "month to date" : p?.id === "12m" ? "the last 12 months" : p?.id === "ly" ? String(cube.years[1]) : p ? p.label : windowLabel(cube, win);
  return { win, id: p?.id ?? `m${win.start}-${win.end}`, erp: null, title, months: win.end - win.start + 1 };
}
const perWords = (cube: Cube, per: Per, back = 0) => windowLabel(cube, per.win, back);
const perCap = (per: Per) => per.title.charAt(0).toUpperCase() + per.title.slice(1);
const ym = (cube: Cube, k: number) => `${yearOfMonth(cube, k)}-${String((k % 12) + 1).padStart(2, "0")}`;
const fromYm = (cube: Cube, x: string | null | undefined) => { const m = /^(\d{4})-(\d{2})$/.exec(x ?? ""); return m ? (Number(m[1]) - cube.years[2]) * 12 + Number(m[2]) - 1 : null; };
/** The period's last day, "30 Oct 2026" - a year earlier with back = 1 (the end of that month: a count at a day, no pro rata). */
const endWords = (cube: Cube, per: Per, back = 0) => upToDate(cube, { start: per.win.end - 12 * back, end: per.win.end - 12 * back });
/** "vs 2025" - "vs a year earlier" over a year end. */
const vsOf = (cube: Cube, per: Per) => { const a = yearOfMonth(cube, per.win.start), b = yearOfMonth(cube, per.win.end); return a === b ? `vs ${a - 1}` : "vs a year earlier"; };
/** A month's name in the period: this year's as "Mar", others with their year. */
const monthX = (cube: Cube, k: number) => (k >= monthOf(0, 0) ? MONTH_NAMES[k - monthOf(0, 0)] : monthLabel(cube, k));

/* ── the figures, read from the server ─────────────────────────────────── */

type Ask = { page: KpiPage; filters: Filters; win: Win; ids: string[]; min: number };
type Got = { data: KpiOut | null; busy: boolean; pending: boolean; error?: string; computing?: boolean };
/** A page's figures for a period and the Filters - a small POST; the last ones stay shown while new ones come. */
function useKpis(ask: Ask | null): Got {
  const key = ask ? JSON.stringify(ask) : "";
  const [st, setSt] = useState<Got & { key?: string }>({ data: null, busy: true, pending: false });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!key) return;
    let live = true;
    setSt((s) => ({ ...s, busy: true, error: undefined }));
    fetch("/api/reporting/customer-kpis", { method: "POST", headers: { "Content-Type": "application/json" }, body: key })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as (KpiOut & { ok?: boolean; pending?: boolean; error?: string; computing?: boolean }) | null;
        if (!live) return;
        if (!r.ok || !j || j.ok === false) { setSt((s) => ({ ...s, busy: false, error: j?.error ?? `HTTP ${r.status}` })); return; }
        if (j.pending) { setSt((s) => ({ ...s, busy: false, pending: true })); return; }
        setSt({ data: j, busy: false, pending: false, key, computing: j.computing });
      })
      .catch((e: unknown) => { if (live) setSt((s) => ({ ...s, busy: false, error: String((e as Error)?.message ?? e) })); });
    return () => { live = false; };
  }, [key, tick]);
  // the read the figures come with is on its way: ask again in a little while
  useEffect(() => {
    if (!st.pending) return;
    const t = setTimeout(() => setTick((x) => x + 1), 20_000);
    return () => clearTimeout(t);
  }, [st.pending, tick]);
  return st;
}

/* ── what every graph is drawn with ────────────────────────────────────── */

type Ctx = {
  page: PageId; cube: Cube; d: KpiOut; per: Per; view: View;
  filters: Filters; ids: string[]; min: number;
  /** a row: show only it; a bar: show only it and open the Filters on its breakdown */
  onPick?: (d: Dim, label: string) => void; onBar?: (d: Dim, label: string) => void; onFilter?: (d: Dim) => void;
};
/** A graph's companies: its list, the page's filters, period, customers chosen and amount "at least". */
const listOf = (c: Ctx, by: CompanyBy, note: string, extra: { win?: Win; cohort?: number | null } = {}) => customerCompanies({
  by, filters: c.filters, win: extra.win ?? c.per.win, ids: c.ids, min: c.min, cohort: extra.cohort ?? null,
  generatedAt: c.d.generatedAt, period: c.per.title, was: perWords(c.cube, c.per, 1), end: endWords(c.cube, c.per), note,
});
const minWords = (min: number) => (min > 0 ? `at least ${eur(min)}` : "any amount");

/** The months as columns: this period's column, a year earlier's tick across it (the ESO New customers' months, drawn alike). */
function Columns({ data, fmt, cur, prev, lower = false }: { data: { x: string; cur: number; prev: number | null; tip?: string; lower?: boolean }[]; fmt: (n: number) => string; cur: string; prev: string;
  /** fewer is better (the lost): a rise in red */
  lower?: boolean }) {
  const top = niceTop(Math.max(1, ...data.map((d) => Math.max(d.cur, d.prev ?? 0))));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const item = (mark: React.ReactNode, text: React.ReactNode) => <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>{mark}{text}</Box>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        {item(<Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: THIS }} />, cur)}
        {data.some((d) => d.prev != null) && item(<Box component="span" sx={{ width: 2, height: 12, bgcolor: INK, borderRadius: 1 }} />, prev)}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: Math.max(28, fmt(top).length * 7) }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", lineHeight: 1.2 }}>{fmt(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 150, maxHeight: 300 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((d) => (
              <Box key={d.x} title={d.tip ?? `${d.x}: ${fmt(d.cur)}${d.prev != null ? ` · a year earlier: ${fmt(d.prev)}` : ""}`}
                sx={{ flex: 1, position: "relative", height: "100%", borderRadius: "6px", "&:hover": { bgcolor: "rgba(21,34,58,.035)" } }}>
                <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(Math.max(0, d.cur) / top) * 100}%`, bgcolor: THIS, borderRadius: "4px 4px 0 0" }} />
                {d.prev != null && d.prev > 0 && <Box sx={{ position: "absolute", bottom: `calc(${(d.prev / top) * 100}% - 1px)`, left: "50%", transform: "translateX(-50%)", width: "76%", maxWidth: 44, height: 2, bgcolor: INK, borderRadius: 1 }} />}
              </Box>
            ))}
          </Box>
        </Box>
        <Box />
        <Box sx={{ display: "flex", overflow: "hidden", alignItems: "stretch" }}>
          {data.map((d) => (
            <Box key={d.x} sx={{ flex: 1, textAlign: "center", pt: 0.5, minWidth: 0, display: "grid", alignContent: "space-between" }}>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.3, px: 0.25 }}>{d.x}</Typography>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: tone(d.prev == null ? null : changeOf(d.cur, d.prev), d.lower ?? lower), lineHeight: 1.3, whiteSpace: "nowrap" }}>
                {d.prev == null ? "" : d.prev ? signedPct(changeOf(d.cur, d.prev)) : d.cur ? "new" : "—"}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/** A figure with its year earlier's change under it, in its colour - "new" without one, nothing where the years read do not reach. */
const withPy = (text: string, a: number, b: number | null, lower = false) => (
  <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
    {text}
    {b != null && <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: b ? tone(changeOf(a, b), lower) : a > 0 ? (lower ? RED : GREEN) : FAINT }}>{b ? signedPct(changeOf(a, b)) : a > 0 ? "new" : "—"}</Box>}
  </Box>
);
const ratioPy = (a: number | null, b: number | null) => (
  <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
    {pct(a)}
    {a != null && b != null && <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: tone(a - b) }}>{points(a, b)}</Box>}
  </Box>
);

/** A breakdown's rows as a leaderboard - one measure, the page's filter on its breakdown, its companies the measure's list. */
type Measure<F> = {
  title: string; by: CompanyBy; note: string;
  cur: (f: F) => number | null; prev: (f: F) => number | null;
  fmt?: (n: number) => string; diff?: (n: number) => string; ratio?: boolean; lower?: boolean; sub?: (f: F) => string;
};
function Board<F>({ c, dim, rows, m }: { c: Ctx; dim: KpiDim; rows: (F & { label: string })[]; m: Measure<F> }) {
  const board: BoardRow[] = [];
  let anyPy = false;
  for (const r of rows) {
    const cur = m.cur(r), prev = m.prev(r);
    if (prev != null) anyPy = true;
    if (cur == null && prev == null) continue;
    if (!cur && !prev) continue;
    board.push({ label: r.label, cur: cur ?? 0, prev: prev ?? 0, sub: m.sub?.(r) });
  }
  return (
    <Leaderboard key={`${dim}-${c.per.id}-${m.by}`} title={`${m.title} ${c.per.title}, by ${lowerOf(dim)}`} rows={board} curLabel={perWords(c.cube, c.per)} prevLabel={perWords(c.cube, c.per, 1)}
      fmt={m.fmt ?? int} diff={m.diff ?? fewerMore} vs={vsOf(c.cube, c.per)} ratio={m.ratio} lowerIsBetter={m.lower} noChange={!anyPy} pageSize={rows.length > 15 ? 15 : undefined}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${lowerOf(dim)}`}
      companies={listOf(c, m.by, m.note)} />
  );
}
/** All the figures of a breakdown, in a card of its own, its companies the page's list. */
function DimTable<R extends { label: string }>({ c, dim, rows, cols, total, by, note, title }: { c: Ctx; dim: KpiDim; rows: R[]; cols: Col<R>[]; total: R; by: CompanyBy; note: string; title?: string }) {
  return (
    <ChartBox title={title ?? `All the figures, ${c.per.title}, by ${lowerOf(dim)}`} hint={`${perWords(c.cube, c.per)} against ${perWords(c.cube, c.per, 1)} · a row shows only it`} companies={listOf(c, by, note)}>
      <FullTable key={`${dim}-${c.per.id}`} first={nameOf(dim)} cols={cols} rows={rows} total={total} selected={c.filters[dim]} tint={DIM[dim].tint}
        onPick={c.onPick ? (l) => c.onPick!(dim, l) : undefined} natural={dim === "prio"} find={`${/^[aeiou]/i.test(lowerOf(dim)) ? "an" : "a"} ${lowerOf(dim)}`} />
    </ChartBox>
  );
}
/** The rows of a breakdown in its order: the priorities as they run, the rest by `size`. */
function ordered<R extends { label: string }>(dim: KpiDim, rows: R[], size: (r: R) => number): R[] {
  if (dim === "prio") return [...rows].sort((a, b) => ((PRIO_ORDER.indexOf(a.label) + 99) % 99) - ((PRIO_ORDER.indexOf(b.label) + 99) % 99));
  return [...rows].sort((a, b) => size(b) - size(a) || a.label.localeCompare(b.label));
}

/* ── a) the customer base ──────────────────────────────────────────────── */

const BASE_NOTES = {
  active: "The customers who bought in the period - their revenue, the change against a year earlier under it",
  newC: "The customers whose first invoice ever falls in the period, as the BSC report counts them",
  won: "The customers who bought in the period after 12 months or more without an order",
  lost: "The customers with no order for 12 months or more at the period's end, however long ago the last one - the latest first",
  left: "The customers who reached 12 months since their last order in the period - the latest first",
  moved: "Every customer who came (new, won back) or went (lost) in the period",
  all: "Every customer the table counts: who bought in the period, and the lost",
};
function baseFigures(c: Ctx): Fig[] {
  const t = c.d.base!.total, was = perWords(c.cube, c.per, 1), P = c.per.title;
  return [
    { label: `Active customers ${P}`, value: int(t.active), ch: changeOf(t.active, t.activePy), sub: `bought in the period · ${was}: ${int(t.activePy)}`, icon: <GroupsOutlinedIcon />, tint: "blue" },
    { label: `New customers ${P}`, value: int(t.newC), ch: changeOf(t.newC, t.newPy), sub: `first invoice ever · ${was}: ${int(t.newPy)}`, icon: <PersonAddAltOutlinedIcon />, tint: "green" },
    { label: `Won back ${P}`, value: int(t.won), ch: t.wonPy == null ? null : changeOf(t.won, t.wonPy), sub: `after 12 months or more without an order · ${t.wonPy == null ? "a year earlier not in the three years read" : `${was}: ${int(t.wonPy)}`}`, icon: <ReplayOutlinedIcon />, tint: "purple" },
    { label: `Lost at ${endWords(c.cube, c.per)}`, value: int(t.lost), ch: t.lostPy == null ? null : changeOf(t.lost, t.lostPy), lower: true, sub: `no order for 12 months or more, however long ago · ${t.lostPy == null ? "a year earlier not in the three years read" : `${endWords(c.cube, c.per, 1)}: ${int(t.lostPy)}`}`, icon: <PersonOffOutlinedIcon />, tint: "pink" },
  ];
}
function BaseOverview({ c }: { c: Ctx }) {
  const b = c.d.base!, { cube, per } = c;
  const many = per.months >= 2;
  const sum = (f: (m: (typeof b.months)[number]) => number) => b.months.reduce((t, m) => t + f(m), 0);
  const came = sum((m) => m.newC), back = sum((m) => m.won), went = sum((m) => m.left);
  const before = upToDate(cube, { start: per.win.start - 1, end: per.win.start - 1 });
  const months = (pick: (m: (typeof b.months)[number]) => [number, number | null]) => b.months.map((m) => { const [cur, prev] = pick(m); return { x: monthX(cube, m.month), cur, prev }; });
  const y = yearOfMonth(cube, per.win.start) === yearOfMonth(cube, per.win.end) ? [String(yearOfMonth(cube, per.win.end)), `${yearOfMonth(cube, per.win.end) - 1}, same month`] : ["The month", "A year earlier, same month"];
  type MRow = { label: string; k: number; active: number; activePy: number; newC: number; newPy: number; won: number; wonPy: number | null; left: number; leftPy: number | null; in12: number; in12Py: number | null };
  const rows: MRow[] = b.months.map((m) => ({ label: monthX(cube, m.month), k: m.month, ...m }));
  const cols: Col<MRow>[] = [
    { key: "active", head: "Bought in the month", tip: "The customers who bought in the month - under it the change against the same month a year earlier", cell: (r) => (r.k < 0 ? int(r.active) : withPy(int(r.active), r.active, r.activePy)), sort: (r) => r.active },
    { key: "newC", head: "New", tip: "First invoice ever in the month", cell: (r) => (r.k < 0 ? int(r.newC) : withPy(int(r.newC), r.newC, r.newPy)), sort: (r) => r.newC },
    { key: "won", head: "Won back", tip: "Bought after 12 months or more without an order", cell: (r) => (r.k < 0 ? int(r.won) : withPy(int(r.won), r.won, r.wonPy)), sort: (r) => r.won },
    { key: "left", head: "Lost", tip: "Reached 12 months since their last order in the month", cell: (r) => (r.k < 0 ? int(r.left) : withPy(int(r.left), r.left, r.leftPy, true)), sort: (r) => r.left },
    { key: "net", head: "Net change", tip: "New + won back − lost", cell: (r) => <span style={{ color: tone(r.newC + r.won - r.left), fontWeight: 700 }}>{signedInt(r.newC + r.won - r.left)}</span>, sort: (r) => r.newC + r.won - r.left },
    { key: "in12", head: "Bought in the last 12 months", tip: "The customers who bought in the 12 months to the month's end", cell: (r) => (r.k < 0 ? int(r.in12) : withPy(int(r.in12), r.in12, r.in12Py)), sort: (r) => r.in12 },
  ];
  // the period in all: the customers who bought in it (each once), the comings and goings added up
  const total: MRow = { label: perCap(per), k: -1, active: b.total.active, activePy: 0, newC: came, newPy: 0, won: back, wonPy: null, left: went, leftPy: null, in12: b.end12, in12Py: null };
  return (
    <>
      <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.5, mt: -1 }}>
        Customers who bought in the last 12 months: <b>{int(b.start12)}</b> at {before}, <b>{int(b.end12)}</b> at {endWords(cube, per)} -{" "}
        <span style={{ color: GREEN, fontWeight: 700 }}>{int(came)} new</span>, <span style={{ color: GREEN, fontWeight: 700 }}>{int(back)} won back</span>,{" "}
        <span style={{ color: RED, fontWeight: 700 }}>{int(went)} lost</span> = <b style={{ color: tone(b.end12 - b.start12) }}>{signedInt(b.end12 - b.start12)}</b>
        {b.end12Py != null && b.start12Py != null ? <span style={{ color: MUTED }}> · a year earlier {signedInt(b.end12Py - b.start12Py)}</span> : null}
      </Typography>
      {many && (
        <>
          <Box sx={TWO}>
            <ChartBox title={`New customers ${per.title}, month by month`} hint="Each month, the customers whose first invoice ever was in it · the change under each month" companies={listOf(c, "new", BASE_NOTES.newC)}>
              <Columns data={months((m) => [m.newC, m.newPy])} fmt={int} cur={y[0]} prev={y[1]} />
            </ChartBox>
            <ChartBox title={`Won back ${per.title}, month by month`} hint="Each month, the customers who bought after 12 months or more without an order" companies={listOf(c, "won", BASE_NOTES.won)}>
              <Columns data={months((m) => [m.won, m.wonPy])} fmt={int} cur={y[0]} prev={y[1]} />
            </ChartBox>
          </Box>
          <Box sx={TWO}>
            <ChartBox title={`Lost ${per.title}, month by month`} hint="Each month, the customers who reached 12 months since their last order in it" companies={listOf(c, "left", BASE_NOTES.left)}>
              <Columns data={months((m) => [m.left, m.leftPy])} fmt={int} cur={y[0]} prev={y[1]} lower />
            </ChartBox>
            <ChartBox title={`Customers who bought ${per.title}, month by month`} hint="Each month, the customers who bought in it" companies={listOf(c, "cust", BASE_NOTES.active)}>
              <Columns data={months((m) => [m.active, m.activePy])} fmt={int} cur={y[0]} prev={y[1]} />
            </ChartBox>
          </Box>
        </>
      )}
      <ChartBox title={`The customer base ${per.title}, month by month`} hint={`${perWords(cube, per)} · each month what came and what went, against the same month a year earlier · the last row: ${per.title} in all, the customers who bought in the last 12 months at its end`}
        companies={listOf(c, "moved", BASE_NOTES.moved)}>
        <FullTable key={`months-${per.id}`} first="Month" cols={cols} rows={rows} total={total} natural />
      </ChartBox>
    </>
  );
}
function BaseDim({ c, dim }: { c: Ctx; dim: KpiDim }) {
  const rows = ordered(dim, c.d.base!.by[dim], (r) => r.active || r.lost);
  const t = c.d.base!.total;
  const M: Record<"active" | "newC" | "won" | "lost", Measure<BaseFig>> = {
    active: { title: "Active customers", by: "cust", note: BASE_NOTES.active, cur: (f) => f.active, prev: (f) => f.activePy },
    newC: { title: "New customers", by: "new", note: BASE_NOTES.newC, cur: (f) => f.newC, prev: (f) => f.newPy },
    won: { title: "Won back", by: "won", note: BASE_NOTES.won, cur: (f) => f.won, prev: (f) => f.wonPy },
    lost: { title: "Lost customers", by: "lost", note: BASE_NOTES.lost, cur: (f) => f.lost, prev: (f) => f.lostPy, lower: true },
  };
  const cols: Col<Row<BaseFig>>[] = [
    { key: "active", head: `Active ${c.per.title}`, cell: (r) => withPy(int(r.active), r.active, r.activePy), sort: (r) => r.active },
    { key: "newC", head: "New", cell: (r) => withPy(int(r.newC), r.newC, r.newPy), sort: (r) => r.newC },
    { key: "won", head: "Won back", cell: (r) => withPy(int(r.won), r.won, r.wonPy), sort: (r) => r.won },
    { key: "lost", head: `Lost at ${endWords(c.cube, c.per)}`, cell: (r) => withPy(int(r.lost), r.lost, r.lostPy, true), sort: (r) => r.lost },
    { key: "share", head: "Share of the active", cell: (r) => pct(div(r.active, t.active)), sort: (r) => r.active },
  ];
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}><Board c={c} dim={dim} rows={rows} m={M.active} /><Board c={c} dim={dim} rows={rows} m={M.newC} /></Box>
      <Box sx={TWO}><Board c={c} dim={dim} rows={rows} m={M.won} /><Board c={c} dim={dim} rows={rows} m={M.lost} /></Box>
      <DimTable c={c} dim={dim} rows={rows} cols={cols} total={{ label: "Total", ...t }} by="custlost" note={BASE_NOTES.all} />
    </>
  );
}
type Row<F> = F & { label: string };

/* ── b) revenue concentration ──────────────────────────────────────────── */

const CONC_NOTE = "The customers who bought in the period - the largest first, their revenue against a year earlier";
function concFigures(c: Ctx): Fig[] {
  const t = c.d.concentration!.total, was = perWords(c.cube, c.per, 1);
  return [
    { label: "Ø revenue per customer", value: eur(div(t.rev, t.n)), ch: t.nPy ? changeOf(div(t.rev, t.n), div(t.revPy, t.nPy)) : null, sub: `${int(t.n)} customers, ${eur(t.rev)} · ${was}: ${eur(div(t.revPy, t.nPy))}`, icon: <EuroOutlinedIcon />, tint: "blue" },
    { label: "Median revenue per customer", value: eur(t.median), ch: changeOf(t.median, t.medianPy), sub: `half the customers bought less · ${was}: ${eur(t.medianPy)}`, icon: <PaidOutlinedIcon />, tint: "purple" },
    { label: "Revenue of the top 10%", value: eur(t.top10), ch: changeOf(t.top10, t.top10Py), sub: `${pct(div(t.top10, t.pos))} of the revenue · ${was}: ${pct(div(t.top10Py, t.posPy))}`, icon: <LeaderboardOutlinedIcon />, tint: "green" },
    { label: "Revenue of the top 20%", value: eur(t.top20), ch: changeOf(t.top20, t.top20Py), sub: `${pct(div(t.top20, t.pos))} of the revenue · ${was}: ${pct(div(t.top20Py, t.posPy))}`, icon: <LeaderboardOutlinedIcon />, tint: "amber" },
  ];
}
function ConcOverview({ c }: { c: Ctx }) {
  const x = c.d.concentration!, { cube, per } = c, t = x.total;
  const cur = perWords(cube, per), prev = perWords(cube, per, 1);
  const curve = x.pareto.cy.map((v, k) => ({ x: k * 5, cy: v * 100, py: x.pareto.py[k] * 100 }));
  type BRow = { label: string; n: number; nPy: number; rev: number; revPy: number };
  const sumRev = x.bands.reduce((s, b) => s + Math.max(0, b.rev), 0);
  const cols: Col<BRow>[] = [
    { key: "n", head: `Customers ${per.title}`, cell: (r) => withPy(int(r.n), r.n, r.nPy), sort: (r) => r.n },
    { key: "rev", head: `Their revenue ${per.title}`, cell: (r) => withPy(eur(r.rev), r.rev, r.revPy), sort: (r) => r.rev },
    { key: "share", head: "Share of the revenue", cell: (r) => pct(div(Math.max(0, r.rev), sumRev)), sort: (r) => r.rev },
    { key: "avg", head: "Ø per customer", cell: (r) => eur(div(r.rev, r.n)), sort: (r) => div(r.rev, r.n) },
  ];
  const names = new Map<string, number>();
  const top: BoardRow[] = x.top.map((r) => { const k = (names.get(r.name) ?? 0) + 1; names.set(r.name, k); return { label: k > 1 ? `${r.name} (${k})` : r.name, cur: r.rev, prev: r.revPy, sub: `${pct(div(r.rev, t.pos))} of the revenue` }; });
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <ChartBox title={`Share of the revenue by share of customers, ${per.title}`} companies={listOf(c, "cust", CONC_NOTE)}
          hint={`The customers who bought, the largest first: the top 10% bring ${pct(div(t.top10, t.pos))} of the revenue (${pct(div(t.top10Py, t.posPy))} a year earlier), the top 20% ${pct(div(t.top20, t.pos))}`}>
          <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 16, borderTop: `3px solid ${THIS}` }} />{cur}</Box>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 16, borderTop: `2px dashed ${BEFORE}` }} />{prev}</Box>
          </Box>
          <Box sx={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <XAxis dataKey="x" type="number" domain={[0, 100]} ticks={[0, 10, 20, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: MUTED }} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: MUTED }} width={44} />
                <ReferenceLine x={10} stroke="#cfd4db" strokeDasharray="3 3" />
                <ReferenceLine x={20} stroke="#cfd4db" strokeDasharray="3 3" />
                <Tooltip formatter={(v, k) => [`${Number(v ?? 0).toFixed(1)}% of the revenue`, k === "cy" ? cur : prev]} labelFormatter={(v) => `The top ${v}% of the customers`} contentStyle={{ fontSize: "0.8rem", borderRadius: 10 }} />
                <Line dataKey="py" stroke={BEFORE} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line dataKey="cy" stroke={THIS} strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </ChartBox>
        <ChartBox title={`Customers by their revenue ${per.title}`} hint="Each customer in the band of what it bought in the period - the sales priority's thresholds" companies={listOf(c, "cust", CONC_NOTE)}>
          <Columns data={x.bands.map((b) => ({ x: b.label, cur: b.n, prev: b.nPy }))} fmt={int} cur={cur} prev={prev} />
        </ChartBox>
      </Box>
      <ChartBox title={`The revenue bands, ${per.title}`} hint={`${cur} against ${prev} · the customers in each band and their revenue`} companies={listOf(c, "cust", CONC_NOTE)}>
        <FullTable key={`bands-${per.id}`} first="Revenue in the period" cols={cols} rows={x.bands as BRow[]} natural
          total={{ label: "Total", n: t.n, nPy: t.nPy, rev: t.rev, revPy: t.revPy }} />
      </ChartBox>
      <Leaderboard key={`top-${per.id}`} title={`The ${x.top.length} largest customers ${per.title}`} rows={top} curLabel={cur} prevLabel={prev} first={25} fmt={eur} diff={lessMore} vs={vsOf(cube, per)}
        companies={listOf(c, `first:${x.top.length}` as CompanyBy, "The largest customers of the period, their revenue against a year earlier")} />
    </>
  );
}
function ConcDim({ c, dim }: { c: Ctx; dim: KpiDim }) {
  const rows = ordered(dim, c.d.concentration!.by[dim], (r) => r.rev);
  const t = c.d.concentration!.total;
  const M: Measure<ConcFig>[] = [
    { title: "Ø revenue per customer", by: "cust", note: CONC_NOTE, cur: (f) => (f.n ? div(f.rev, f.n) : null), prev: (f) => (f.nPy ? div(f.revPy, f.nPy) : null), fmt: eur, diff: perCustomer, sub: (f) => `${int(f.n)} customers · ${eur(f.rev)}` },
    { title: "Median revenue per customer", by: "cust", note: CONC_NOTE, cur: (f) => (f.n ? f.median : null), prev: (f) => (f.nPy ? f.medianPy : null), fmt: eur, diff: perCustomer, sub: (f) => `${int(f.n)} customers` },
  ];
  const cols: Col<Row<ConcFig>>[] = [
    { key: "n", head: `Customers ${c.per.title}`, cell: (r) => withPy(int(r.n), r.n, r.nPy), sort: (r) => r.n },
    { key: "rev", head: "Their revenue", cell: (r) => withPy(eur(r.rev), r.rev, r.revPy), sort: (r) => r.rev },
    { key: "avg", head: "Ø per customer", cell: (r) => withPy(eur(div(r.rev, r.n)), div(r.rev, r.n), r.nPy ? div(r.revPy, r.nPy) : null), sort: (r) => div(r.rev, r.n) },
    { key: "median", head: "Median", cell: (r) => withPy(eur(r.median), r.median, r.nPy ? r.medianPy : null), sort: (r) => r.median },
    { key: "top10", head: "Share of the top 10%", tip: "The revenue of its top 10% of customers against all of its revenue", cell: (r) => pct(div(r.top10, r.pos)), sort: (r) => div(r.top10, r.pos) },
  ];
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>{M.map((m) => <Board key={m.title} c={c} dim={dim} rows={rows} m={m} />)}</Box>
      <DimTable c={c} dim={dim} rows={rows} cols={cols} total={{ label: "Total", ...t }} by="cust" note={CONC_NOTE} />
    </>
  );
}

/* ── c) cross-selling ──────────────────────────────────────────────────── */

const CROSS = {
  any: "The customers who bought from one of the five profit centers in the period, and which",
  many: "The customers who bought from two profit centers or more in the period",
  single: (min: number) => `One profit center only, ${minWords(min)} in the period - the cross-sell targets, the largest first`,
};
function crossFigures(c: Ctx): Fig[] {
  const t = c.d.cross!.total, py = t.py, was = perWords(c.cube, c.per, 1), none = "a year earlier not kept by profit center";
  const several = t.two + t.three;
  return [
    { label: "From one profit center", value: int(t.one), ch: py ? changeOf(t.one, py.one) : null, sub: `${pct(div(t.one, t.n))} of the customers · ${py ? `${was}: ${int(py.one)}` : none}`, icon: <CategoryOutlinedIcon />, tint: "slate" },
    { label: "From two or more", value: int(several), ch: py ? changeOf(several, py.two + py.three) : null, sub: `${pct(div(several, t.n))} of the customers · ${py ? `${was}: ${pct(div(py.two + py.three, py.n))}` : none}`, icon: <HubOutlinedIcon />, tint: "green" },
    { label: "From three or more", value: int(t.three), ch: py ? changeOf(t.three, py.three) : null, sub: `${pct(div(t.three, t.n))} of the customers · ${py ? `${was}: ${int(py.three)}` : none}`, icon: <HubOutlinedIcon />, tint: "blue" },
    { label: "Cross-sell targets", value: int(t.single), ch: py ? changeOf(t.single, py.single) : null, sub: `one profit center, ${minWords(c.min)} · ${py ? `${was}: ${int(py.single)}` : none}`, icon: <AdsClickOutlinedIcon />, tint: "amber" },
  ];
}
function CrossOverview({ c }: { c: Ctx }) {
  const x = c.d.cross!, t = x.total, py = t.py, { cube, per } = c;
  const cur = perWords(cube, per), prev = perWords(cube, per, 1);
  const groups: { x: string; n: number; nPy: number | null; rev: number; revPy: number | null }[] = [
    { x: "One", n: t.one, nPy: py?.one ?? null, rev: t.rev1, revPy: py?.rev1 ?? null },
    { x: "Two", n: t.two, nPy: py?.two ?? null, rev: t.rev2, revPy: py?.rev2 ?? null },
    { x: "Three or more", n: t.three, nPy: py?.three ?? null, rev: t.rev3, revPy: py?.rev3 ?? null },
  ];
  const pairs: BoardRow[] = x.pairs.filter((p) => p.n || p.nPy).map((p) => ({ label: `${PC_NAME[p.a]} + ${PC_NAME[p.b]}`, cur: p.n, prev: p.nPy ?? 0, sub: `${pct(div(p.n, t.n))} of the customers` }));
  const single: BoardRow[] = x.single.filter((s) => s.n || s.nPy).map((s) => ({ label: PC_NAME[s.pc], cur: s.n, prev: s.nPy ?? 0, sub: `${eur(s.rev)} their revenue · Ø ${eur(div(s.rev, s.n))}` }));
  const pyNote = py ? "" : ` · a year earlier: the revenue by profit center is kept for ${cube.years[1]} and ${cube.years[0]} only`;
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <ChartBox title={`Customers by number of profit centers, ${per.title}`} hint={`The five profit centers each customer bought from in the period${pyNote}`} companies={listOf(c, "pcsany", CROSS.any)}>
          <Columns data={groups.map((g) => ({ x: g.x, cur: g.n, prev: g.nPy }))} fmt={int} cur={cur} prev={prev} />
        </ChartBox>
        <ChartBox title={`Ø revenue per customer by number of profit centers, ${per.title}`} hint={`What a customer bought in the period, by how many profit centers it bought from${pyNote}`} companies={listOf(c, "pcsany", CROSS.any)}>
          <Columns data={groups.map((g) => ({ x: g.x, cur: div(g.rev, g.n), prev: g.nPy == null ? null : div(g.revPy ?? 0, g.nPy) }))} fmt={eur} cur={cur} prev={prev} />
        </ChartBox>
      </Box>
      <Box sx={TWO}>
        <Leaderboard key={`pairs-${per.id}`} title={`Profit centers bought together, ${per.title}`} rows={pairs} curLabel={cur} prevLabel={prev} fmt={int} diff={fewerMore} vs={vsOf(cube, per)} noChange={!py}
          companies={listOf(c, "pcsmany", CROSS.many)} />
        <Leaderboard key={`single-${per.id}-${c.min}`} title={`Cross-sell targets ${per.title}, by the one profit center they buy from`} rows={single} curLabel={cur} prevLabel={prev} fmt={int} diff={fewerMore} vs={vsOf(cube, per)} noChange={!py}
          summary={`One profit center only, ${minWords(c.min)} in the period - the amount under Filters`} companies={listOf(c, "single", CROSS.single(c.min))} />
      </Box>
      {t.none > 0 && (
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
          {int(t.none)} customer{t.none === 1 ? "" : "s"} who bought in the period {t.none === 1 ? "is" : "are"} in none of these figures: nothing from the five profit centers - only Other (pw, ws …) or no split by profit center.
        </Typography>
      )}
    </>
  );
}
function CrossDim({ c, dim }: { c: Ctx; dim: KpiDim }) {
  const rows = ordered(dim, c.d.cross!.by[dim], (r) => r.n);
  const t = c.d.cross!.total;
  const several = (f: CrossFig) => (f.n ? div(f.two + f.three, f.n) : null);
  const severalPy = (f: CrossFig) => (f.py && f.py.n ? div(f.py.two + f.py.three, f.py.n) : null);
  const M: Measure<CrossFig>[] = [
    { title: "Share buying from two profit centers or more", by: "pcsmany", note: CROSS.many, cur: several, prev: severalPy, fmt: pct, ratio: true, sub: (f) => `${int(f.two + f.three)} of ${int(f.n)} customers` },
    { title: "Cross-sell targets", by: "single", note: CROSS.single(c.min), cur: (f) => f.single, prev: (f) => f.py?.single ?? null, sub: (f) => `${eur(f.singleRev)} their revenue · ${minWords(c.min)}` },
  ];
  const cols: Col<Row<CrossFig>>[] = [
    { key: "n", head: `Customers ${c.per.title}`, cell: (r) => withPy(int(r.n), r.n, r.py?.n ?? null), sort: (r) => r.n },
    { key: "one", head: "One profit center", cell: (r) => withPy(int(r.one), r.one, r.py?.one ?? null), sort: (r) => r.one },
    { key: "two", head: "Two", cell: (r) => withPy(int(r.two), r.two, r.py?.two ?? null), sort: (r) => r.two },
    { key: "three", head: "Three or more", cell: (r) => withPy(int(r.three), r.three, r.py?.three ?? null), sort: (r) => r.three },
    { key: "several", head: "Share from two or more", cell: (r) => ratioPy(several(r), severalPy(r)), sort: (r) => several(r) ?? -1 },
    { key: "single", head: `Cross-sell targets (${minWords(c.min)})`, cell: (r) => withPy(int(r.single), r.single, r.py?.single ?? null), sort: (r) => r.single },
  ];
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>{M.map((m) => <Board key={m.title} c={c} dim={dim} rows={rows} m={m} />)}</Box>
      <DimTable c={c} dim={dim} rows={rows} cols={cols} total={{ label: "Total", ...t }} by="pcsany" note={CROSS.any} />
    </>
  );
}

/* ── d) recency and risk ───────────────────────────────────────────────── */

const REC = {
  all: "Every customer by its last order at the period's end - the most bought in the 12 months to it first",
  risk: (min: number) => `Last order 6 to 12 months before the period's end, ${minWords(min)} bought in the 12 months to it - the call list, the most first`,
  down: (min: number) => `Bought in the period, 30% or more less than a year earlier (${minWords(min)} then) - the largest drop first`,
  lost: BASE_NOTES.lost,
  recent: "The customers whose last order is 0 to 3 months before the period's end",
};
function recFigures(c: Ctx): Fig[] {
  const t = c.d.recency!.total, end = endWords(c.cube, c.per), endPy = endWords(c.cube, c.per, 1), was = perWords(c.cube, c.per, 1);
  const no = "a year earlier not in the three years read";
  return [
    { label: "Bought in the last 3 months", value: int(t.rec[0]), ch: t.recPy ? changeOf(t.rec[0], t.recPy[0]) : null, sub: `last order 0–3 months before ${end} · ${t.recPy ? `${endPy}: ${int(t.recPy[0])}` : no}`, icon: <ScheduleOutlinedIcon />, tint: "blue" },
    { label: "At risk", value: int(t.risk), ch: t.riskPy == null ? null : changeOf(t.risk, t.riskPy), lower: true, sub: `last order 6–12 months ago, ${minWords(c.min)} in the 12 months to ${end} · ${t.riskPy == null ? no : `${endPy}: ${int(t.riskPy)}`}`, icon: <WarningAmberOutlinedIcon />, tint: "amber" },
    { label: "Decreasing", value: int(t.down), ch: t.downPy == null ? null : changeOf(t.down, t.downPy), lower: true, sub: `30% or more less than ${was}, ${minWords(c.min)} then · ${t.downPy == null ? no : `a year earlier: ${int(t.downPy)}`}`, icon: <TrendingDownOutlinedIcon />, tint: "purple" },
    { label: `Lost at ${end}`, value: int(t.rec[3]), ch: t.recPy ? changeOf(t.rec[3], t.recPy[3]) : null, lower: true, sub: `no order for 12 months or more, however long ago · ${t.recPy ? `${endPy}: ${int(t.recPy[3])}` : no}`, icon: <PersonOffOutlinedIcon />, tint: "pink" },
  ];
}
function RecOverview({ c }: { c: Ctx }) {
  const t = c.d.recency!.total, { cube, per } = c;
  const end = endWords(cube, per), endPy = endWords(cube, per, 1);
  type GRow = { label: string; n: number; nPy: number | null; rev: number; lower: boolean };
  const rows: GRow[] = [
    ...RECENCY.map((label, k) => ({ label: `Last order ${label} ago`, n: t.rec[k], nPy: t.recPy?.[k] ?? null, rev: t.recRev[k], lower: k >= 2 })),
    { label: `At risk (${minWords(c.min)})`, n: t.risk, nPy: t.riskPy, rev: t.riskRev, lower: true },
    { label: `Decreasing (${minWords(c.min)})`, n: t.down, nPy: t.downPy, rev: t.downRev, lower: true },
  ];
  const cols: Col<GRow>[] = [
    { key: "n", head: `Customers at ${end}`, cell: (r) => withPy(int(r.n), r.n, r.nPy, r.lower), sort: (r) => r.n },
    { key: "nPy", head: `At ${endPy}`, cell: (r) => (r.nPy == null ? "—" : int(r.nPy)), sort: (r) => r.nPy ?? -1 },
    { key: "rev", head: `Bought in the 12 months to ${end}`, tip: "Decreasing: their revenue in the period", cell: (r) => eur(r.rev), sort: (r) => r.rev },
  ];
  const sae = c.d.recency!.by.sae;
  const people = (pick: (f: RecFig) => [number, number | null]) => {
    let any = false;
    const rows = sae.map((r) => { const [cur, prev] = pick(r); if (prev != null) any = true; return { label: r.label, cur, prev: prev ?? 0 }; }).filter((r) => r.cur || r.prev);
    return { rows, any };
  };
  const risk = people((f) => [f.risk, f.riskPy]), down = people((f) => [f.down, f.downPy]), lost = people((f) => [f.rec[3], f.recPy?.[3] ?? null]);
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <ChartBox title={`Customers by months since their last order, at ${end}`} hint={`Every customer who ever ordered, by its last order - lost: 12 months or more, however long ago · the tick: at ${endPy}`} companies={listOf(c, "recall", REC.all)}>
          <Columns data={RECENCY.map((label, k) => ({ x: label, cur: t.rec[k], prev: t.recPy?.[k] ?? null, lower: k >= 2 }))} fmt={int} cur={end} prev={endPy} />
        </ChartBox>
        <Leaderboard key={`risk-${per.id}-${c.min}`} title={`At risk at ${end}, by Performis SAE`} rows={risk.rows} curLabel={end} prevLabel={endPy} fmt={int} diff={fewerMore} lowerIsBetter noChange={!risk.any}
          summary={`${int(t.risk)} customers · ${eur(t.riskRev)} bought in the 12 months to ${end} - who to call`} companies={listOf(c, "risk", REC.risk(c.min))}
          selected={c.filters.sae} onPick={c.onBar ? (l) => c.onBar!("sae", l) : undefined} onFilter={c.onFilter ? () => c.onFilter!("sae") : undefined} filterLabel="Filter by Performis SAE" />
      </Box>
      <Box sx={TWO}>
        <Leaderboard key={`down-${per.id}-${c.min}`} title={`Decreasing ${per.title}, by Performis SAE`} rows={down.rows} curLabel={perWords(cube, per)} prevLabel={perWords(cube, per, 1)} fmt={int} diff={fewerMore} lowerIsBetter noChange={!down.any}
          summary={`${int(t.down)} customers · ${eur(t.downDrop)} less than a year earlier`} companies={listOf(c, "down", REC.down(c.min))}
          selected={c.filters.sae} onPick={c.onBar ? (l) => c.onBar!("sae", l) : undefined} onFilter={c.onFilter ? () => c.onFilter!("sae") : undefined} filterLabel="Filter by Performis SAE" />
        <Leaderboard key={`lost-${per.id}`} title={`Lost at ${end}, by Performis SAE`} rows={lost.rows} curLabel={end} prevLabel={endPy} fmt={int} diff={fewerMore} lowerIsBetter noChange={!lost.any}
          summary={`${int(t.rec[3])} customers with no order for 12 months or more, however long ago`} companies={listOf(c, "lost", REC.lost)}
          selected={c.filters.sae} onPick={c.onBar ? (l) => c.onBar!("sae", l) : undefined} onFilter={c.onFilter ? () => c.onFilter!("sae") : undefined} filterLabel="Filter by Performis SAE" />
      </Box>
      <ChartBox title={`The customers by their last order, at ${end}`} hint={`At risk: last order 6–12 months ago, ${minWords(c.min)} in the 12 months to ${end} · decreasing: 30% or more less than a year earlier - the amount under Filters`} companies={listOf(c, "recall", REC.all)}>
        <FullTable key={`groups-${per.id}-${c.min}`} first="Group" cols={cols} rows={rows} natural />
      </ChartBox>
    </>
  );
}
function RecDim({ c, dim }: { c: Ctx; dim: KpiDim }) {
  const rows = ordered(dim, c.d.recency!.by[dim], (r) => r.rec.reduce((s, x) => s + x, 0));
  const t = c.d.recency!.total, end = endWords(c.cube, c.per);
  const M: Measure<RecFig>[] = [
    { title: "At risk", by: "risk", note: REC.risk(c.min), cur: (f) => f.risk, prev: (f) => f.riskPy, lower: true, sub: (f) => `${eur(f.riskRev)} bought in the 12 months to ${end}` },
    { title: "Decreasing", by: "down", note: REC.down(c.min), cur: (f) => f.down, prev: (f) => f.downPy, lower: true, sub: (f) => `${eur(f.downDrop)} less than a year earlier` },
    { title: "Bought in the last 3 months", by: "rec:0", note: REC.recent, cur: (f) => f.rec[0], prev: (f) => f.recPy?.[0] ?? null },
    { title: "Lost customers", by: "lost", note: REC.lost, cur: (f) => f.rec[3], prev: (f) => f.recPy?.[3] ?? null, lower: true },
  ];
  const cols: Col<Row<RecFig>>[] = [
    ...RECENCY.map((label, k) => ({ key: `r${k}`, head: label, tip: `Last order ${label} before ${end}`, cell: (r: Row<RecFig>) => withPy(int(r.rec[k]), r.rec[k], r.recPy?.[k] ?? null, k >= 2), sort: (r: Row<RecFig>) => r.rec[k] })),
    { key: "risk", head: "At risk", cell: (r) => withPy(int(r.risk), r.risk, r.riskPy, true), sort: (r) => r.risk },
    { key: "down", head: "Decreasing", cell: (r) => withPy(int(r.down), r.down, r.downPy, true), sort: (r) => r.down },
  ];
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}><Board c={c} dim={dim} rows={rows} m={M[0]} /><Board c={c} dim={dim} rows={rows} m={M[1]} /></Box>
      <Box sx={TWO}><Board c={c} dim={dim} rows={rows} m={M[2]} /><Board c={c} dim={dim} rows={rows} m={M[3]} /></Box>
      <DimTable c={c} dim={dim} rows={rows} cols={cols} total={{ label: "Total", ...t }} by="recall" note={REC.all} title={`All the figures at ${end}, by ${lowerOf(dim)}`} />
    </>
  );
}

/* ── e) retention ──────────────────────────────────────────────────────── */

const RET = {
  base: "The customers who bought in the same months a year earlier - what they bought then and now",
  gone: "The customers who bought a year earlier and nothing in the period - the most bought then first",
};
const retPy = (f: RetFig) => f.py;
function retFigures(c: Ctx): Fig[] {
  const t = c.d.retention!.total, py = t.py, was = perWords(c.cube, c.per, 1);
  const before = "the year before not in the three years read";
  const n = nrr(t), g = grr(t), k = keptRate(t);
  return [
    { label: "Net revenue retention", value: pct(n), chText: n != null && py && nrr(py) != null ? { text: points(n, nrr(py)!), color: tone(n - nrr(py)!) } : undefined, sub: `${eur(t.now)} now of ${eur(t.then)} - the ${int(t.base)} customers of ${was} · ${py ? `the year before: ${pct(nrr(py))}` : before}`, icon: <SavingsOutlinedIcon />, tint: "green" },
    { label: "Gross revenue retention", value: pct(g), chText: g != null && py && grr(py) != null ? { text: points(g, grr(py)!), color: tone(g - grr(py)!) } : undefined, sub: `the same, without what they bought more · ${py ? `the year before: ${pct(grr(py))}` : before}`, icon: <AutorenewOutlinedIcon />, tint: "blue" },
    { label: "Customer retention rate", value: pct(k), chText: k != null && py && keptRate(py) != null ? { text: points(k, keptRate(py)!), color: tone(k - keptRate(py)!) } : undefined, sub: `${int(t.kept)} of the ${int(t.base)} customers of ${was} bought again · ${py ? `the year before: ${pct(keptRate(py))}` : before}`, icon: <HowToRegOutlinedIcon />, tint: "purple" },
  ];
}
function RetOverview({ c }: { c: Ctx }) {
  const x = c.d.retention!, t = x.total, { cube, per } = c;
  const was = perWords(cube, per, 1), cur = perWords(cube, per);
  type GRow = { label: string; n: number; then: number; now: number };
  const groups: GRow[] = [
    { label: "Bought as much or more", n: t.grew, then: t.grewThen, now: t.grewNow },
    { label: "Bought less", n: t.shrank, then: t.shrankThen, now: t.shrankNow },
    { label: "Bought nothing", n: t.gone, then: t.goneThen, now: 0 },
  ];
  const gcols: Col<GRow>[] = [
    { key: "n", head: "Customers", cell: (r) => int(r.n), sort: (r) => r.n },
    { key: "share", head: "Share of them", cell: (r) => pct(div(r.n, t.base)), sort: (r) => r.n },
    { key: "then", head: `Revenue ${was}`, cell: (r) => eur(r.then), sort: (r) => r.then },
    { key: "now", head: `Revenue ${cur}`, cell: (r) => eur(r.now), sort: (r) => r.now },
    { key: "diff", head: "Change", cell: (r) => <span style={{ color: tone(r.now - r.then), fontWeight: 700 }}>{lessMore(r.now - r.then)}</span>, sort: (r) => r.now - r.then },
  ];
  type CRow = Row<RetFig & { cohort: number }>;
  const ccols: Col<CRow>[] = [
    { key: "base", head: `Customers of ${was}`, cell: (r) => int(r.base), sort: (r) => r.base },
    { key: "kept", head: "Bought again", cell: (r) => int(r.kept), sort: (r) => r.kept },
    { key: "rate", head: "Customer retention rate", cell: (r) => ratioPy(keptRate(r), r.py ? keptRate(r.py) : null), sort: (r) => keptRate(r) ?? -1 },
    { key: "then", head: `Revenue ${was}`, cell: (r) => eur(r.then), sort: (r) => r.then },
    { key: "now", head: `Revenue ${cur}`, cell: (r) => eur(r.now), sort: (r) => r.now },
    { key: "nrr", head: "Net revenue retention", cell: (r) => ratioPy(nrr(r), r.py ? nrr(r.py) : null), sort: (r) => nrr(r) ?? -1 },
    { key: "grr", head: "Gross revenue retention", cell: (r) => ratioPy(grr(r), r.py ? grr(r.py) : null), sort: (r) => grr(r) ?? -1 },
  ];
  const cohortRows: BoardRow[] = x.cohorts.filter((r) => r.base).map((r) => ({ label: r.cohort ? `First invoice in ${r.cohort}` : r.label === `Before ${c.cube.years[2]}` ? `Customers from before ${c.cube.years[2]}` : r.label, cur: keptRate(r) ?? 0, prev: r.py ? keptRate(r.py) ?? 0 : 0, sub: `${int(r.kept)} of ${int(r.base)} bought again · net revenue retention ${pct(nrr(r))}` }));
  const sae = x.by.sae.filter((r) => r.gone).map((r) => ({ label: r.label, cur: r.gone, prev: 0, sub: `${eur(r.goneThen)} bought ${was}` }));
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>
        <Leaderboard key={`cohort-${per.id}`} title={`Customer retention rate ${per.title}, by the year of the first invoice`} rows={cohortRows} curLabel={cur} prevLabel="the year before" fmt={pct} ratio noChange={!t.py}
          companies={listOf(c, "base", RET.base)} />
        <Leaderboard key={`gone-${per.id}`} title={`Bought nothing ${per.title}, by Performis SAE`} rows={sae} curLabel={cur} prevLabel={was} fmt={int} noChange
          summary={`${int(t.gone)} customers of ${was} · ${eur(t.goneThen)} bought then - who to call`} companies={listOf(c, "gone", RET.gone)}
          selected={c.filters.sae} onPick={c.onBar ? (l) => c.onBar!("sae", l) : undefined} onFilter={c.onFilter ? () => c.onFilter!("sae") : undefined} filterLabel="Filter by Performis SAE" />
      </Box>
      <ChartBox title={`Where the customers of ${was} stand, ${per.title}`} hint={`The ${int(t.base)} customers who bought ${was}: what they bought then, and in ${cur}`} companies={listOf(c, "base", RET.base)}>
        <FullTable key={`groups-${per.id}`} first="They" cols={gcols} rows={groups} natural total={{ label: "All of them", n: t.base, then: t.then, now: t.now }} />
      </ChartBox>
      <ChartBox title={`Retention ${per.title}, by the year of the first invoice`} hint={`The customers of ${was} by the year of their first invoice ever - customers from before ${cube.years[2]} together · under each rate its change against the year before, in points`}
        companies={listOf(c, "base", RET.base)}>
        <FullTable key={`cohorts-${per.id}`} first="Customers since" cols={ccols} rows={x.cohorts.filter((r) => r.base) as CRow[]} natural />
      </ChartBox>
    </>
  );
}
function RetDim({ c, dim }: { c: Ctx; dim: KpiDim }) {
  const rows = ordered(dim, c.d.retention!.by[dim], (r) => r.base);
  const t = c.d.retention!.total;
  const M: Measure<RetFig>[] = [
    { title: "Net revenue retention", by: "base", note: RET.base, cur: (f) => nrr(f), prev: (f) => (retPy(f) ? nrr(retPy(f)!) : null), fmt: pct, ratio: true, sub: (f) => `${eur(f.now)} now of ${eur(f.then)}` },
    { title: "Customer retention rate", by: "base", note: RET.base, cur: (f) => keptRate(f), prev: (f) => (retPy(f) ? keptRate(retPy(f)!) : null), fmt: pct, ratio: true, sub: (f) => `${int(f.kept)} of ${int(f.base)} bought again` },
  ];
  const cols: Col<Row<RetFig>>[] = [
    { key: "base", head: `Customers of ${perWords(c.cube, c.per, 1)}`, cell: (r) => int(r.base), sort: (r) => r.base },
    { key: "kept", head: "Bought again", cell: (r) => int(r.kept), sort: (r) => r.kept },
    { key: "rate", head: "Customer retention rate", cell: (r) => ratioPy(keptRate(r), r.py ? keptRate(r.py) : null), sort: (r) => keptRate(r) ?? -1 },
    { key: "then", head: "Revenue then", cell: (r) => eur(r.then), sort: (r) => r.then },
    { key: "now", head: "Revenue now", cell: (r) => eur(r.now), sort: (r) => r.now },
    { key: "nrr", head: "Net revenue retention", cell: (r) => ratioPy(nrr(r), r.py ? nrr(r.py) : null), sort: (r) => nrr(r) ?? -1 },
    { key: "grr", head: "Gross revenue retention", cell: (r) => ratioPy(grr(r), r.py ? grr(r.py) : null), sort: (r) => grr(r) ?? -1 },
  ];
  return (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>{M.map((m) => <Board key={m.title} c={c} dim={dim} rows={rows.filter((r) => r.base || r.py?.base)} m={m} />)}</Box>
      <DimTable c={c} dim={dim} rows={rows} cols={cols} total={{ label: "Total", ...t }} by="base" note={RET.base} />
    </>
  );
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

const OVERVIEW: Record<PageId, { note: (c: Ctx) => string; Draw: (p: { c: Ctx }) => React.ReactNode }> = {
  base: { note: () => "Active: bought in the period · new: first invoice ever in it, as the BSC report counts · won back: bought after 12 months or more without an order · lost: no order for 12 months or more, however long ago", Draw: BaseOverview },
  concentration: { note: () => "The customers who bought in the period and what each bought - how the revenue is spread over them", Draw: ConcOverview },
  "cross-selling": { note: (c) => `The five profit centers each customer bought from in the period - cross-sell targets: one profit center only, ${minWords(c.min)} (the amount under Filters)`, Draw: CrossOverview },
  recency: { note: (c) => `Every customer who ever ordered, by its last order at ${endWords(c.cube, c.per)} · at risk and decreasing from ${eur(c.min)} (the amount under Filters) - each list is a call list`, Draw: RecOverview },
  retention: { note: (c) => `The customers who bought ${perWords(c.cube, c.per, 1)}: what they bought ${perWords(c.cube, c.per)} - the net and gross revenue retention, the share who bought again`, Draw: RetOverview },
};
const BY_DIM: Record<PageId, (p: { c: Ctx; dim: KpiDim }) => React.ReactNode> = { base: BaseDim, concentration: ConcDim, "cross-selling": CrossDim, recency: RecDim, retention: RetDim };

function TabCard({ c, filter }: { c: Ctx; filter: { open: () => void; on: boolean } }) {
  const { view, cube, per } = c;
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const against = `${perWords(cube, per)} against ${perWords(cube, per, 1)}`;
  if (view === "overview") {
    const o = OVERVIEW[c.page];
    return (
      <GlassCard sx={card}>
        <CardTitle icon={<DateRangeOutlinedIcon />} tint="blue" title={`The whole company, ${per.title}`} note={`${against} · ${o.note(c)}`} />
        {/* a graph with no breakdown of its own: its filter opens the page's Filters */}
        <CardFilterFor filter={{ open: filter.open, label: "Filter", on: filter.on }}><o.Draw c={c} /></CardFilterFor>
      </GlassCard>
    );
  }
  const D = BY_DIM[c.page];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={DIM[view].icon} tint={DIM[view].tint} title={`By ${lowerOf(view)}, ${per.title}`} note={`${NOTES[view]} · ${against}`} />
      <D c={c} dim={view} />
    </GlassCard>
  );
}
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures top right: one unit each row (counts, euros or rates) ── */

type Fig = { label: string; value: string; ch?: number | null; chText?: { text: string; color: string }; lower?: boolean; sub: string; icon: React.ReactNode; tint: Tint };
const FIGURES: Record<PageId, (c: Ctx) => Fig[]> = { base: baseFigures, concentration: concFigures, "cross-selling": crossFigures, recency: recFigures, retention: retFigures };
function FigureCards({ items }: { items: Fig[] }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${items.length}, minmax(150px, 212px))` }, flex: "0 1 auto" }}>
      {items.map((f) => (
        <Box key={f.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={f.icon} tint={f.tint} size={22} />
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
            {f.chText ? <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: f.chText.color }}>{f.chText.text}</Typography>
              : f.ch != null && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: tone(f.ch, f.lower) }}>{signedPct(f.ch)}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{f.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── the amount "at least" (at risk, decreasing, cross-sell targets) ──── */

function MinSection({ min, onMin }: { min: number; onMin: (m: number) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <FilterSection id="filter-min" index={20} title="Amount at least" icon={<EuroOutlinedIcon />} tint="amber" open={open} onFlip={() => setOpen((o) => !o)} summary={min ? eur(min) : "Any amount"} chosen={min !== DEFAULT_MIN}>
      <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
        {MINS.map((m) => {
          const on = m === min;
          return (
            <Box key={m} component="button" type="button" onClick={() => onMin(m)} aria-pressed={on}
              sx={{ height: 30, px: 1.4, borderRadius: "9px", font: "inherit", fontSize: "0.8rem", fontWeight: 650, cursor: "pointer", bgcolor: on ? TINT.blue.fg : "#fff", color: on ? "#fff" : INK,
                border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.16)"}`, "&:hover": on ? {} : { borderColor: TINT.blue.fg, color: TINT.blue.fg } }}>
              {m ? eur(m) : "Any amount"}
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1, lineHeight: 1.45 }}>
        At risk: bought at least this much in the 12 months to the period&apos;s end. Decreasing: at least this much in the same months a year earlier. Cross-sell targets: at least this much in the period. The steps are the sales priority&apos;s thresholds.
      </Typography>
    </FilterSection>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

function Waiting({ computing, progress, error, again }: { computing: boolean; progress?: string | null; error?: string; again?: boolean }) {
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {computing && !error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>
          {error ? `The figures could not be read: ${error}`
            : again ? "Reading every company in HubSpot again for its first and last order - a few minutes, once…"
              : `Reading every company in HubSpot - revenue and orders${progress ? ` · ${progress}` : ""}…`}
        </Typography>
      </Box>
    </GlassCard>
  );
}
const FILTER_DIMS: Dim[] = ["prio", "segment", "country", "owner", "sae", "type", "apic", "mandant"];
const viewOf = (x: string | null): View => (isView(x) ? x : "overview");

export function CustomerKpisExplorer({ page }: { page: PageId }) {
  const params = useSearchParams();
  const companies = useMemo(() => params.getAll("company").filter((x) => /^\d+$/.test(x)).slice(0, 50), [params]);
  // the cube for the Filters window (each value's customers) and the periods - the figures come from the server
  const { cube, computing, progress, error } = useCustomersCube(companies);
  const names = useCompanyNames(companies);
  const view = viewOf(params.get("view"));
  const setView = (v: View) => setQuery((q) => { if (v === "overview") q.delete("view"); else q.set("view", v); });
  const minP = Number(params.get("min"));
  const min = WITH_MIN.includes(page) ? ((MINS as readonly number[]).includes(minP) && params.get("min") != null ? minP : DEFAULT_MIN) : 0;
  const setMin = (m: number) => setQuery((q) => { if (m === DEFAULT_MIN) q.delete("min"); else q.set("min", String(m)); });
  const setWin = (w: Win) => setQuery((q) => {
    if (!cube) return;
    const ytd = ytdWin(cube);
    if (w.start === ytd.start && w.end === ytd.end) { q.delete("from"); q.delete("to"); } else { q.set("from", ym(cube, w.start)); q.set("to", ym(cube, w.end)); }
  });
  const filters: Filters = useMemo(() => Object.fromEntries(DIMS.flatMap((d) => (d !== "potential" && params.getAll(d).length ? [[d, params.getAll(d)]] : []))), [params]);
  const toggle = (d: Dim, label: string) => setQuery((q) => {
    const cur = q.getAll(d), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
    q.delete(d);
    for (const x of next) q.append(d, x);
  });
  const clearAll = () => setQuery((q) => { for (const d of DIMS) q.delete(d); q.delete("company"); q.delete("min"); });
  const pick: CustomerPick = {
    chosen: companies.map((id) => names[id] ?? { id, name: `Company ${id}`, country: null, erpId: null }),
    add: (co) => setQuery((q) => { if (!q.getAll("company").includes(co.id)) q.append("company", co.id); }),
    remove: (id) => setQuery((q) => { const keep = q.getAll("company").filter((x) => x !== id); q.delete("company"); for (const x of keep) q.append("company", x); }),
  };
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: Dim; n: number } | null>(null);
  const openOn = (d: Dim) => { setFocus((f) => ({ dim: d, n: (f?.n ?? 0) + 1 })); setPanel(true); };

  const fromP = params.get("from"), toP = params.get("to");
  const per = useMemo(() => {
    if (!cube) return null;
    const a0 = fromYm(cube, fromP), b0 = fromYm(cube, toP);
    return a0 != null && b0 != null ? perOf(cube, clampWindow(cube, { start: a0, end: b0 })) : perOf(cube, ytdWin(cube));
  }, [cube, fromP, toP]);
  const ask = useMemo<Ask | null>(() => (per ? { page: API[page], filters, win: per.win, ids: companies, min } : null), [page, filters, per, companies, min]);
  const got = useKpis(ask);
  const want = useMemo(() => ({ view, per, filters, min, data: got.data }), [view, per, filters, min, got.data]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want || got.busy;
  const c = useMemo<Ctx | null>(() => (cube && drawn.per && drawn.data && drawn.data.page === API[page] ? {
    page, cube, d: drawn.data, per: drawn.per, view: drawn.view, filters: drawn.filters, ids: companies, min: drawn.data.min,
    onPick: toggle, onBar: (d, l) => { toggle(d, l); openOn(d); }, onFilter: openOn,
  } : null), [cube, drawn, companies, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  if (!cube || !per || !c) return (
    <Box sx={shell}>
      <Typography component="h1" sx={H1}>{TITLE[page]}</Typography>
      <Waiting computing={computing || got.busy || got.pending} progress={progress} error={error ?? got.error} again={got.pending && !!cube} />
    </Box>
  );
  const active = chosenDims(filters);
  const chosen = active.flatMap((x) => (filters[x] ?? []).map((v) => [x, v] as const));
  const minOn = WITH_MIN.includes(page) && min !== DEFAULT_MIN;
  const filterCount = chosen.length + companies.length + (per.id !== "ytd" ? 1 : 0) + (minOn ? 1 : 0);
  const clearEverything = () => { clearAll(); setWin(ytdWin(cube)); };
  const dimOfView = view === "overview" ? null : view;
  return (
    <Box sx={shell}>
      {/* the title and what is shown on the left; the figures top right */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>{TITLE[page]}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>The whole company</b> · {per.title} <b style={{ color: INK }}>{perWords(cube, per)}</b> - against {perWords(cube, per, 1)}{computing || got.computing ? " · reading HubSpot again" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}>
          <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease" }}><FigureCards items={FIGURES[page](c)} /></Box>
        </Box>
      </Box>
      {/* the tabs, and at their right end the Filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name={`customers-${page}`} tab={view} onSelect={setView}
            tabs={VIEW_IDS.map((v) => ({ id: v, label: v === "overview" ? "Overview" : nameOf(v), count: v !== "overview" && filters[v]?.length ? String(filters[v]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => { if (panel) setPanel(false); else if (dimOfView) openOn(dimOfView); else setPanel(true); }} variant={panel || filterCount ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls={`customers-${page}-filters`} startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || filterCount ? undefined : "#fff" }}>
          Filters{filterCount ? ` · ${filterCount}` : ""}
        </Button>
      </Box>
      {/* what the page is filtered by, under the tabs - the period first, then the amount, each customer and value chosen */}
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearEverything} items={[
        ...(per.id !== "ytd" ? [{ key: "period", name: "Period", value: perWords(cube, per) === per.title ? per.title : `${perCap(per)} · ${perWords(cube, per)}`, tint: "blue" as Tint, onRemove: () => setWin(ytdWin(cube)) }] : []),
        ...(minOn ? [{ key: "min", name: "Amount at least", value: min ? eur(min) : "Any amount", tint: "amber" as Tint, onRemove: () => setMin(DEFAULT_MIN) }] : []),
        ...pick.chosen.map((co): ActiveItem => ({ key: `customer:${co.id}`, name: "Customer", value: co.name, tint: "slate", onRemove: () => pick.remove(co.id) })),
        ...chosen.map(([x, v]): ActiveItem => ({ key: `${x}:${v}`, name: nameOf(x), value: v, tint: DIM[x].tint, onRemove: () => toggle(x, v) })),
      ]} />

      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} filter={{ open: () => setPanel(true), on: active.length > 0 }} />
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Each customer&apos;s monthly revenue as the ERP load writes it to HubSpot - a customer bought in a month when it was invoiced in it; the running month counts as far as the last ERP delivery, a year earlier&apos;s same month pro rata. Three years are read ({cube.years[2]} – {cube.years[0]}); a lost customer&apos;s last order before them comes from its first and last order in HubSpot. The ERP&apos;s customers not in HubSpot yet count too.
      </Typography>

      <CubeFilterWindow id={`customers-${page}-filters`} period dims={FILTER_DIMS} names={{ owner: "Company owner" }} open={panel} onClose={() => setPanel(false)} focus={focus} cube={cube}
        win={per.win} setWin={setWin} filters={filters} toggle={toggle} customers={pick} clearAll={clearEverything}
        extra={WITH_MIN.includes(page) ? <MinSection min={min} onMin={setMin} /> : null}
        periodPicker={<CubePeriod cube={cube} win={per.win} onWin={setWin} note={<>Every figure follows the period, against the same months a year earlier.</>} />} />
    </Box>
  );
}

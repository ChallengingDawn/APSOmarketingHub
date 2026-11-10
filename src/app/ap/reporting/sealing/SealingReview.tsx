"use client";

// SEALING BUSINESS REVIEW - the Angst+Pfister hub's first report (SARCLA 10.11.2026), from the Executive Committee's pilot
// of the same name: who buys, what sells, which materials and compounds lead, which approvals are written - and the three
// commercial priorities, found in the figures. Every business unit's sealing (profit centre DT) invoices from the ERP's BI
// model, read each morning (src/lib/apHub).
//
// Laid out as Digital Growth is (SARCLA 10.11.2026: "this is nothing alike the advanced reports, this is not well
// structured" - "look at Digital Growth for example"; src/app/reporting/marketing-kpis):
//   - the Overview is its macro page (marketing-kpis/page.tsx): the full width, a glass card per topic with its glyph
//     badge, each figure a tile with its badge, its figure, the same months a year earlier and its months as small bars
//     (tiles/KpiStyled KpiTileChart, data.tsx MiniBars); the topic's title is the way in to its page; the commercial
//     priorities a block of their own, as the customers' summary is there;
//   - each topic is a stage page (marketing-kpis/[stage] + Reach.tsx / Customers.tsx): the way back, the title and what is
//     shown with its figures top right (ExplorerKit FigureCards), the tabs with the Filters button at their right end, the
//     KPI cards (data.tsx KpiCard), then the breakdown's charts (DimChart) and its table (ExplorerKit Table);
//   - the period, the business units and the sales organisations in Digital Growth's Filters window (FilterPanel), the
//     choice as chips under the title, all of it in the address - carried from page to page.
// No tile toolbar (tasks, tickets, promote, drag, Actions): that is the APSOparts action plan, closed to Angst+Pfister.
// Margins are always the margin of the sums (sealingRules sumBy / rateMonths), never an average of margins.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import PercentOutlinedIcon from "@mui/icons-material/PercentOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import DonutLargeOutlinedIcon from "@mui/icons-material/DonutLargeOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { StackedColumns, type StackRow } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { compact } from "@/app/charts/format";
import { KpiCard, MONTHS, MiniBars, type KpiView } from "@/app/reporting/marketing-kpis/data";
import { KpiTileChart } from "@/app/reporting/marketing-kpis/tiles/KpiStyled";
import { FigureCards, Table, change, withChange, type TableSort } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { fmtValue, type Fmt } from "@/lib/marketingKpis/measures";
import { SEALING_PAGES, type SealingSlug } from "@/lib/apHub/sealingPages";
import type { SealingMonth, SealingView } from "@/lib/apHub/sealingStore";
import {
  isMonth, materialOf, monthsBetween, monthsSpan, periodWords, rateMonths, sealingPresets, sumMonths, tileSeries,
  type Figure, type KeyMonth, type MonthPair, type Priority,
} from "@/lib/apHub/sealingRules";

/* ── words and numbers, in full (Digital Growth: no abbreviations) ─────── */

const eur = (n: number | null | undefined) => fmtValue("eur", n);
const eurTick = (n: number | null) => (n == null ? "" : `€${compact(n)}`);
const pct = (x: number | null | undefined) => fmtValue("pct", x);
const int = (n: number | null | undefined) => fmtValue("int", n);
const signedPct = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x * 100).toFixed(1)}%`;
const points = (a: number, b: number) => { const d = (a - b) * 100; return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)} pts`; };
const tone = (d: number, eps = 0.0005) => (Math.abs(d) < eps ? MUTED : d > 0 ? GREEN : RED);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthWords = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const ymLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const lastDay = (ym: string) => `${new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()} ${monthWords(ym)}`;
const dayWords = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", year: "numeric" });
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const NOT_KNOWN = "Not known";

/* ── the read ──────────────────────────────────────────────────────────── */

function useSealing(ask: string, ready: boolean) {
  const [d, setD] = useState<SealingView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    setBusy(true);
    setErr(null);
    fetch(`/api/ap/sealing${ask ? `?${ask}` : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as SealingView & { ok?: boolean; error?: string };
        if (!live) return;
        if (!r.ok || !j.ok) setErr(j.error ?? `the hub answered ${r.status}`);
        else setD(j);
      })
      .catch((e) => { if (live) setErr(String((e as Error)?.message ?? e)); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [ask, ready, round]);
  return { d, err, busy, again: () => setRound((x) => x + 1) };
}

/* ── the address: the period and the filters, carried from page to page ── */

/** A change to the address without a reload (the pages read it back through useSearchParams). */
function setQuery(mut: (q: URLSearchParams) => void) {
  const q = new URLSearchParams(window.location.search);
  mut(q);
  const s = q.toString();
  window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
}
const FILTER_KEYS = ["from", "to", "bu", "org"];
/** The period and the filters of an address - what a link to another page of the review carries (never the tab). */
function filterPart(qs: string): string {
  const p = new URLSearchParams(qs), q = new URLSearchParams();
  for (const k of FILTER_KEYS) for (const v of p.getAll(k)) if (v) q.append(k, v);
  return q.toString();
}
const KEEP = "apSealingFilters";
/**
 * The address's filters, kept for the tab's next page of the review: the side panel's links carry none, so a page opened
 * from it without any takes the ones chosen on the page before ("Clear all" clears them for the next page too).
 */
function useCarried(): { qs: string; ready: boolean } {
  const qs = useSearchParams().toString();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) { try { sessionStorage.setItem(KEEP, filterPart(qs)); } catch { /* kept for this page only */ } return; }
    let kept = "";
    try { kept = sessionStorage.getItem(KEEP) ?? ""; } catch { /* nothing kept */ }
    if (!filterPart(qs) && kept) setQuery((q) => { for (const [k, v] of new URLSearchParams(kept)) q.append(k, v); });
    setReady(true);
  }, [qs, ready]);
  return { qs, ready };
}
const toggleParam = (key: string, v: string) => setQuery((q) => { const all = q.getAll(key); q.delete(key); for (const x of all.includes(v) ? all.filter((y) => y !== v) : [...all, v]) q.append(key, x); });
const clearAll = () => setQuery((q) => { for (const k of FILTER_KEYS) q.delete(k); });
const hrefOf = (slug: SealingSlug, carry: string, tab?: string) => {
  const base = SEALING_PAGES.find((p) => p.slug === slug)?.href ?? "/ap/reporting/sealing";
  const q = [tab ? `tab=${tab}` : "", carry].filter(Boolean).join("&");
  return q ? `${base}?${q}` : base;
};

/* ── what the page shows ───────────────────────────────────────────────── */

type Frame = {
  d: SealingView;
  /** the months shown, and the months the figures hold */
  from: string; to: string; min: string; max: string;
  /** the first month of the year to date (the period when none is chosen) */
  ytdFrom: string;
  now: string; before: string;
  /** whether the same months a year earlier are in the figures - all of them, some, none */
  prevKnown: "all" | "part" | "none";
  bus: string[]; orgs: string[];
  /** the address's period and filters - every link to another page of the review carries them */
  carry: string;
  /** "31 Oct 2026" - or the day of the delivery when the period ends in the month still running */
  upToDay: string;
  /** the line under a tile: how far its figure reaches, and when the hub read it */
  upTo: string;
};

function frameOf(d: SealingView, bus: string[], orgs: string[], carry: string): Frame {
  const max = d.meta.lastMonth ?? d.period.to;
  const min = d.meta.firstMonth && d.meta.firstMonth <= max ? d.meta.firstMonth : d.period.from;
  const ytd = `${max.slice(0, 4)}-01`;
  const known = d.months.filter((m) => m.prevRev !== null).length;
  const running = d.period.to === new Date().toISOString().slice(0, 7);
  const upToDay = running && d.meta.loadedAt ? dayWords(d.meta.loadedAt) : lastDay(d.period.to);
  return {
    d, from: d.period.from, to: d.period.to, min, max, ytdFrom: ytd < min ? min : ytd,
    now: periodWords(d.period.from, d.period.to), before: periodWords(d.period.prevFrom, d.period.prevTo),
    prevKnown: known && known === d.months.length ? "all" : known ? "part" : "none",
    bus, orgs, carry, upToDay,
    upTo: `Up to ${upToDay} · the ERP${d.meta.loadedAt ? `, read ${dayWords(d.meta.loadedAt)}` : ""}`,
  };
}
const ownPeriod = (f: Frame) => !(f.from === f.ytdFrom && f.to === f.max);
const hasBefore = (f: Frame) => f.prevKnown !== "none";
const chosenCount = (f: Frame) => (ownPeriod(f) ? 1 : 0) + f.bus.length + f.orgs.length;

/* ── a figure as Digital Growth's KPI ──────────────────────────────────── */

/** Digital Growth's KpiView, and the names of its months when the period runs over a year end. */
type SView = KpiView & { labels: string[] | null };

/**
 * A figure as a Digital Growth KPI (data.tsx KpiView): its value over the period, the same months a year earlier - like for
 * like when only some of them are in the figures ("same months Mar–Oct") - and its months for the small bars.
 */
function kv(f: Frame, o: {
  id: string; fmt: Fmt; cur: number | null; prev?: number | null; same?: number | null; sameMonths?: string[];
  months?: MonthPair[]; goodWhenUp?: boolean; definition?: string;
}): SView {
  const s = o.months?.length ? tileSeries(o.months) : { labels: null, months: Array(12).fill(null), py: Array(12).fill(null) };
  const like = o.same != null && !!o.sameMonths?.length && o.prev != null;
  return {
    id: o.id,
    measure: { id: o.id, label: o.id, fmt: o.fmt, agg: { kind: "sum" }, origin: "live", goodWhenUp: o.goodWhenUp ?? true, definition: o.definition },
    series: { months: s.months, py: s.py }, labels: s.labels,
    upTo: 12, ytd: o.cur, pyYtd: o.prev ?? null,
    pyNote: like ? `same months ${monthsSpan(o.sameMonths!)}` : f.before,
    sameYtd: like ? o.same : undefined,
    target: null, partial: null, period: f.now,
  };
}

const pairsOf = (ms: SealingMonth[], cur: (m: SealingMonth) => number, prev: (m: SealingMonth) => number | null): MonthPair[] =>
  ms.map((m) => ({ month: m.month, cur: cur(m), prev: prev(m) }));

/** A figure that adds up month by month (net revenue, gross profit) - compared like for like. */
function sumView(f: Frame, id: string, fmt: Fmt, ps: MonthPair[], more: { goodWhenUp?: boolean; definition?: string } = {}): SView {
  const s = sumMonths(ps);
  return kv(f, { id, fmt, cur: s.cur, prev: s.prev, same: s.same, sameMonths: s.sameMonths, months: ps, ...more });
}

/** A rate of two sums (gross margin, the share with no compound) - the rate of the sums, its months each month's rate. */
function rateView(f: Frame, id: string, num: MonthPair[], den: MonthPair[], more: { goodWhenUp?: boolean; definition?: string } = {}): SView {
  const r = rateMonths(num, den);
  const ps = num.map((n, i) => ({
    month: n.month,
    cur: den[i]?.cur ? (n.cur ?? 0) / den[i].cur! : null,
    prev: den[i]?.prev ? (n.prev ?? 0) / den[i].prev! : null,
  }));
  return kv(f, { id, fmt: "pct", cur: r.cur, prev: r.prev, same: r.same, sameMonths: r.sameMonths, months: ps, ...more });
}

/** A count or a share that does not add up month by month - compared only when all the months a year earlier are in. */
function wholeView(f: Frame, id: string, fmt: Fmt, cur: number | null, prev: number | null, more: { months?: MonthPair[]; goodWhenUp?: boolean; definition?: string } = {}): SView {
  return kv(f, { id, fmt, cur, prev: f.prevKnown === "all" ? prev : null, ...more });
}

/* the figures every page draws from */
const revPairs = (f: Frame) => pairsOf(f.d.months, (m) => m.rev, (m) => m.prevRev);
const gpPairs = (f: Frame) => pairsOf(f.d.months, (m) => m.gp, (m) => m.prevGp);
/** Some keys' months added together (a unit, "the other 4 units") - a year earlier only where every one of them is known. */
const keyPairs = (rows: KeyMonth[], keys: string[], months: string[]): MonthPair[] => months.map((month) => {
  const of = rows.filter((r) => r.month === month && keys.includes(r.key));
  const prev = of.length && of.every((r) => r.prevRev != null) ? of.reduce((a, r) => a + (r.prevRev ?? 0), 0) : null;
  return { month, cur: of.reduce((a, r) => a + r.rev, 0), prev };
});

const V = {
  rev: (f: Frame) => sumView(f, "Net revenue", "eur", revPairs(f), { definition: "Every sealing invoice of the period (profit centre DT), in EUR" }),
  gp: (f: Frame) => sumView(f, "Gross profit", "eur", gpPairs(f), { definition: "Net revenue less the cost of the goods" }),
  margin: (f: Frame) => rateView(f, "Gross margin", gpPairs(f), revPairs(f), { definition: "Gross profit over net revenue of the same invoices - never an average of margins" }),
  customers: (f: Frame) => wholeView(f, "Customers invoiced", "int", f.d.totals.customers, f.d.totals.prev.customers, {
    months: pairsOf(f.d.months, (m) => m.customers, (m) => m.prevCustomers), definition: "Customers with a sealing invoice in the period - each month's bar, the customers of that month",
  }),
  perCustomer: (f: Frame) => wholeView(f, "Net revenue per customer", "eur",
    f.d.totals.customers ? f.d.totals.rev / f.d.totals.customers : null, f.d.totals.prev.customers ? f.d.totals.prev.rev / f.d.totals.prev.customers : null, {
      months: pairsOf(f.d.months, (m) => (m.customers ? m.rev / m.customers : 0), (m) => (m.prevCustomers ? (m.prevRev ?? 0) / m.prevCustomers : null)),
      definition: "Net revenue over the customers invoiced",
    }),
  topCustomers: (f: Frame) => wholeView(f, "The 10 largest customers' share", "pct", f.d.concentration.customers, f.d.concentration.prevCustomers, {
    goodWhenUp: false, definition: "The part of the net revenue the 10 customers with the most carry - a year earlier, the 10 largest then",
  }),
  articles: (f: Frame) => wholeView(f, "Articles invoiced", "int", f.d.totals.articles, f.d.totals.prev.articles, {
    months: pairsOf(f.d.months, (m) => m.articles, (m) => m.prevArticles), definition: "Articles with a sealing invoice in the period - each month's bar, the articles of that month",
  }),
  perArticle: (f: Frame) => wholeView(f, "Net revenue per article", "eur",
    f.d.totals.articles ? f.d.totals.rev / f.d.totals.articles : null, f.d.totals.prev.articles ? f.d.totals.prev.rev / f.d.totals.prev.articles : null, {
      months: pairsOf(f.d.months, (m) => (m.articles ? m.rev / m.articles : 0), (m) => (m.prevArticles ? (m.prevRev ?? 0) / m.prevArticles : null)),
      definition: "Net revenue over the articles invoiced",
    }),
  topArticles: (f: Frame) => wholeView(f, "The 10 largest articles' share", "pct", f.d.concentration.articles, f.d.concentration.prevArticles, {
    goodWhenUp: false, definition: "The part of the net revenue the 10 articles with the most carry - a year earlier, the 10 largest then",
  }),
  noCompound: (f: Frame) => rateView(f, "No compound named", pairsOf(f.d.months, (m) => m.noCompound, (m) => m.prevNoCompound), revPairs(f), {
    goodWhenUp: false, definition: "The part of the net revenue whose article names no compound (\"No info\", \"Unknown\", \"TBD\", a drawing) - left out of the families and the compounds",
  }),
  compounds: (f: Frame) => wholeView(f, "Compounds named", "int", f.d.totals.compounds, f.d.totals.prev.compounds, { definition: "The compounds named on the articles invoiced" }),
  noApproval: (f: Frame) => rateView(f, "No approval written", pairsOf(f.d.months, (m) => m.noApproval, (m) => m.prevNoApproval), revPairs(f), {
    goodWhenUp: false, definition: "The part of the net revenue whose article has no approval written",
  }),
  withApproval: (f: Frame) => sumView(f, "Net revenue with an approval written", "eur", pairsOf(f.d.months, (m) => m.rev - m.noApproval, (m) => (m.prevRev == null ? null : m.prevRev - (m.prevNoApproval ?? 0))), {
    definition: "Net revenue whose article has at least one approval written",
  }),
  approvals: (f: Frame) => wholeView(f, "Approvals written", "int", f.d.totals.approvals, f.d.totals.prev.approvals, { definition: "The different approval texts written on the articles invoiced" }),
};

/** A key's net revenue (a business unit, a family) month by month - compared like for like. */
function keyView(f: Frame, id: string, rows: KeyMonth[], keys: string[], definition?: string): SView {
  return sumView(f, id, "eur", keyPairs(rows, keys, f.d.months.map((m) => m.month)), { definition });
}

/** The largest of a breakdown: its name in the title, its net revenue against the same months a year earlier. */
function largestView(f: Frame, what: string, x: Figure | undefined): SView | null {
  if (!x) return null;
  return wholeView(f, `Largest ${what}: ${cut(x.name || x.key || NOT_KNOWN, 60)}`, "eur", x.rev, x.prev ?? null, { definition: `The ${what} with the most net revenue` });
}

/* ── the overview: Digital Growth's macro page ─────────────────────────── */

/** One grid for a panel's tiles, twelve columns: a tile takes two on a wide screen (six to a row) - as the macro page's. */
const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
const TILE_SPAN = { gridColumn: { xs: "span 12", sm: "span 6", md: "span 4", lg: "span 3", xl: "span 2" } };
const THIRD_SPAN = { gridColumn: { xs: "span 12", lg: "span 4" } };

type Topic = { title: string; icon: React.ReactNode; tint: Tint };
const TOPIC: Record<"revenue" | "priorities" | Exclude<SealingSlug, "overview">, Topic> = {
  revenue: { title: "Revenue & margin", icon: <ShowChartOutlinedIcon />, tint: "blue" },
  priorities: { title: "Commercial priorities", icon: <LightbulbOutlinedIcon />, tint: "amber" },
  units: { title: "Business units", icon: <ApartmentOutlinedIcon />, tint: "purple" },
  customers: { title: "Customers", icon: <GroupsOutlinedIcon />, tint: "green" },
  articles: { title: "Articles", icon: <InventoryOutlinedIcon />, tint: "pink" },
  materials: { title: "Materials", icon: <CategoryOutlinedIcon />, tint: "blue" },
  approvals: { title: "Approvals", icon: <VerifiedOutlinedIcon />, tint: "slate" },
};

/** A tile of the macro page (tiles/KpiStyled KpiTileChart): the badge, the name, the figure, the comparison, its months. */
function Tile({ f, v, t }: { f: Frame; v: SView; t: Topic }) {
  const chart = v.labels ? <MiniBars v={v} labels={v.labels} /> : undefined;
  return (
    <Box sx={{ minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", ...TILE_SPAN }}>
      <KpiTileChart v={v} slug="sealing" tint={t.tint} icon={t.icon} upTo={f.upTo} title={v.id} chart={chart} />
    </Box>
  );
}

/** A topic as a stage's panel of the macro page: the badge, the name - the way in - one line, then its tiles. */
function TopicPanel({ t, href, note, children }: { t: Topic; href?: string; note?: string; children: React.ReactNode }) {
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={t.icon} tint={t.tint} size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          {href ? (
            <Box component={Link} href={href} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT[t.tint].fg } }}>
              <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>{t.title}</Typography>
              <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT[t.tint].fg, transition: "transform .15s ease" }} />
            </Box>
          ) : (
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em", color: INK }}>{t.title}</Typography>
          )}
          {note && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{note}</Typography>}
        </Box>
      </Box>
      {children}
    </GlassCard>
  );
}

function Tiles({ f, t, views }: { f: Frame; t: Topic; views: (SView | null)[] }) {
  const shown = views.filter((v): v is SView => !!v && v.ytd != null);
  if (!shown.length) return <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No invoice in these months with these filters.</Typography>;
  return <Box sx={GRID}>{shown.map((v) => <Tile key={v.id} f={f} v={v} t={t} />)}</Box>;
}

const KIND_NAME: Record<Priority["kind"], string> = { margin: "Margin improvement", growth: "Growth focus", spread: "Account comparison" };
const KIND_LOOK: Record<Priority["kind"], { icon: React.ReactNode; tint: Tint }> = {
  margin: { icon: <PercentOutlinedIcon />, tint: "pink" },
  growth: { icon: <TrendingUpOutlinedIcon />, tint: "green" },
  spread: { icon: <CompareArrowsOutlinedIcon />, tint: "purple" },
};

/** A priority, drawn as a tile of the macro page: its badge, what it is, the evidence, the next move, the effect at its foot. */
function PriorityCard({ p, i }: { p: Priority; i: number }) {
  const look = KIND_LOOK[p.kind];
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "flex", flexDirection: "column", gap: 1.1, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0 }}>
        <Badge icon={look.icon} tint={look.tint} size={32} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>{String(i + 1).padStart(2, "0")} · {KIND_NAME[p.kind]}</Typography>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em", lineHeight: 1.3 }}>{p.title}</Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.5 }}>{p.evidence}</Typography>
      <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.5 }}><b>Next move.</b> {p.next}</Typography>
      <Typography sx={{ mt: "auto", fontSize: "0.74rem", fontWeight: 600, color: FAINT, borderTop: "1px solid rgba(21,34,58,.07)", pt: 0.75 }}>
        {p.effect ? `${p.effectLabel}: ${eur(p.effect)} gross profit` : p.effectLabel}
      </Typography>
    </Box>
  );
}

/** The units, the families: the five largest, and the others together when there are more than six. */
function topKeys(figs: Figure[], n = 6): { keys: string[][]; names: string[] } {
  const named = figs.filter((x) => x.rev > 0 || (x.prev ?? 0) > 0);
  if (named.length <= n) return { keys: named.map((x) => [x.key]), names: named.map((x) => x.name || x.key || NOT_KNOWN) };
  const top = named.slice(0, n - 1), rest = named.slice(n - 1);
  return { keys: [...top.map((x) => [x.key]), rest.map((x) => x.key)], names: [...top.map((x) => x.name || x.key || NOT_KNOWN), `The other ${rest.length}`] };
}

function Overview({ f, busy, err, again }: { f: Frame; busy: boolean; err: string | null; again: () => void }) {
  const [panel, setPanel] = useState(false);
  const units = topKeys(f.d.byBu);
  const fams = topKeys(f.d.byFamily, 4);
  const famNote = `Named compounds only - ${pct(f.d.noCompoundShare)} of the net revenue names none`;
  return (
    // the macro page: the full width, the panels one under the other (marketing-kpis/page.tsx)
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <Head f={f} title="Sealing Business Review" busy={busy} panel={panel} onPanel={() => setPanel((x) => !x)} />
      <Trouble err={err} again={again} />
      <Box sx={{ display: "grid", gap: 2.5, minWidth: 0, opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }} aria-busy={busy}>
        <TopicPanel t={TOPIC.revenue} href={hrefOf("units", f.carry, "months")} note={`Every business unit's sealing invoices, ${f.now} - month by month on its page`}>
          <Tiles f={f} t={TOPIC.revenue} views={[V.rev(f), V.gp(f), V.margin(f)]} />
        </TopicPanel>
        {/* the summary block, as Who are our customers' is on the macro page: the three priorities side by side */}
        <TopicPanel t={TOPIC.priorities} note={`Found in the figures of ${f.now} - evidence, then a next move. Illustrative, never a forecast: validate before acting.`}>
          {f.d.priorities.length ? (
            <Box sx={GRID}>
              {f.d.priorities.map((p, i) => <Box key={p.kind} sx={{ minWidth: 0, display: "grid", ...THIRD_SPAN }}><PriorityCard p={p} i={i} /></Box>)}
            </Box>
          ) : <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Nothing in these months with these filters meets the thresholds.</Typography>}
        </TopicPanel>
        <TopicPanel t={TOPIC.units} href={hrefOf("units", f.carry)} note="Net revenue of each Angst+Pfister company that invoiced - their margins and the sales organisations on the page">
          <Tiles f={f} t={TOPIC.units} views={units.keys.map((k, i) => keyView(f, `${units.names[i]} net revenue`, f.d.unitMonths, k))} />
        </TopicPanel>
        <TopicPanel t={TOPIC.customers} href={hrefOf("customers", f.carry)} note="Who buys - every customer's figures on the page">
          <Tiles f={f} t={TOPIC.customers} views={[V.customers(f), V.perCustomer(f), V.topCustomers(f), largestView(f, "customer", f.d.customers[0])]} />
        </TopicPanel>
        <TopicPanel t={TOPIC.articles} href={hrefOf("articles", f.carry)} note="What sells - every article's figures and compound on the page">
          <Tiles f={f} t={TOPIC.articles} views={[V.articles(f), V.perArticle(f), V.topArticles(f), largestView(f, "article", f.d.articles[0])]} />
        </TopicPanel>
        <TopicPanel t={TOPIC.materials} href={hrefOf("materials", f.carry)} note={`${famNote} · the families and every compound on the page`}>
          <Tiles f={f} t={TOPIC.materials} views={[...fams.keys.map((k, i) => keyView(f, `${fams.names[i]} net revenue`, f.d.familyMonths, k)), V.compounds(f), V.noCompound(f)]} />
        </TopicPanel>
        <TopicPanel t={TOPIC.approvals} href={hrefOf("approvals", f.carry)} note="Which approvals are written on the articles sold - each approval's figures on the page">
          <Tiles f={f} t={TOPIC.approvals} views={[V.noApproval(f), V.withApproval(f), V.approvals(f), largestView(f, "approval", f.d.approvals[0])]} />
        </TopicPanel>
      </Box>
      <Foot f={f} slug="overview" />
      <FilterWindow f={f} open={panel} onClose={() => setPanel(false)} />
    </Box>
  );
}

/* ── the header: the title, what is shown, the choice as chips ─────────── */

const H1 = { fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 } as const;

const against = (f: Frame) => (f.prevKnown === "all" ? `against ${f.before}` : f.prevKnown === "part" ? `against ${f.before} - the figures begin ${monthWords(f.min)}` : "no figures a year earlier");

function Line({ f, busy }: { f: Frame; busy: boolean }) {
  return (
    <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
      {/* what is shown, as Who are our customers says it - the filters are the chips under it */}
      <b style={{ color: INK }}>{f.now}</b> {against(f)} · {f.bus.length || f.orgs.length ? "the sealing invoices chosen" : "every business unit's sealing invoices"} (profit centre DT), in EUR · figures up to {f.upToDay}{busy ? " · reading again" : ""}
    </Typography>
  );
}

/** What the page is filtered by, as chips - each one let go with its cross (Who are our customers, Reach). */
function Chosen({ f }: { f: Frame }) {
  if (!chosenCount(f)) return null;
  const chip = (key: string, name: string, value: string, tint: Tint, onDelete: () => void) => (
    <Chip key={key} size="small" label={<span><b>{name}:</b> {value}</span>} onDelete={onDelete}
      sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[tint].fg } }} />
  );
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
      {ownPeriod(f) && chip("period", "Period", f.now, "blue", () => setQuery((q) => { q.delete("from"); q.delete("to"); }))}
      {f.bus.map((x) => chip(`bu:${x}`, "Business unit", x, "purple", () => toggleParam("bu", x)))}
      {f.orgs.map((x) => chip(`org:${x}`, "Sales organisation", x, "green", () => toggleParam("org", x)))}
      <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
    </Box>
  );
}

function FiltersButton({ f, open, onClick }: { f: Frame; open: boolean; onClick: () => void }) {
  const n = chosenCount(f);
  return (
    <Button onClick={onClick} variant={open || n ? "contained" : "outlined"} disableElevation aria-expanded={open} aria-controls="sealing-filters" startIcon={<TuneIcon />}
      sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: open || n ? undefined : "#fff" }}>
      Filters{n ? ` · ${n}` : ""}
    </Button>
  );
}

/** The overview's head: the title, the line, the chips - and the Filters button on the right. */
function Head({ f, title, busy, panel, onPanel }: { f: Frame; title: string; busy: boolean; panel: boolean; onPanel: () => void }) {
  return (
    <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(240px, 1fr) auto" } }}>
      <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
        <Typography component="h1" sx={H1}>{title}</Typography>
        <Line f={f} busy={busy} />
        <Chosen f={f} />
      </Box>
      <Box sx={{ display: "flex", justifyContent: { md: "flex-end" } }}><FiltersButton f={f} open={panel} onClick={onPanel} /></Box>
    </Box>
  );
}

function Trouble({ err, again }: { err: string | null; again: () => void }) {
  if (!err) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.84rem", color: RED }}>These filters could not be read: {err}</Typography>
      <Button size="small" onClick={again} sx={{ textTransform: "none", fontWeight: 700 }}>Try again</Button>
    </Box>
  );
}

/** Where the figures come from - small, at the foot. */
function Foot({ f, slug }: { f: Frame; slug: SealingSlug }) {
  const m = f.d.meta;
  const file = m.file ? m.file.split(/[\\/]/).pop() : null;
  const from = [file, m.sheet ? `sheet "${m.sheet}"` : null].filter(Boolean).join(", ");
  const read = m.loadedAt ? new Date(m.loadedAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  const words = [
    "Source: the ERP's BI model - every business unit's sealing invoices (profit centre DT), net revenue and gross profit in EUR",
    from ? `read from ${from}` : null,
    read ? `loaded ${read}` : null,
    `invoices from ${monthWords(f.min)} up to ${monthWords(f.max)}`,
  ].filter(Boolean).join(" · ")
    + ". Gross margin = gross profit over net revenue of the same invoices, never an average of margins."
    + (slug === "overview" ? " The priorities are illustrative, never a forecast." : "");
  return <Typography sx={{ fontSize: "0.74rem", color: FAINT, lineHeight: 1.5 }}>{words}</Typography>;
}

/* ── the Filters window (FilterPanel): the period, the business units, the sales organisations ── */

/** The period, as Who are our customers chooses it: the ready-made ones, or any months from - to, over a year end too. */
function PeriodChoice({ f }: { f: Frame }) {
  const ready = sealingPresets(f.min, f.max);
  const months = monthsBetween(f.min, f.max);
  const set = (a: string, b: string) => setQuery((q) => {
    if (a === f.ytdFrom && b === f.max) { q.delete("from"); q.delete("to"); } else { q.set("from", a); q.set("to", b); }
  });
  const sel = { height: 32, fontSize: "0.82rem", fontWeight: 600, borderRadius: "9px", bgcolor: "#fff", flex: 1, "& .MuiSelect-select": { py: 0.5, pl: 1.25 } };
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
        {ready.map((p) => {
          const on = p.from === f.from && p.to === f.to;
          return (
            <Chip key={p.id} label={p.label} onClick={() => set(p.from, p.to)} aria-pressed={on}
              sx={{ height: 28, fontSize: "0.78rem", fontWeight: 600, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : INK, border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.14)"}` }} />
          );
        })}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>From</Typography>
        <Select size="small" value={months.includes(f.from) ? f.from : ""} onChange={(e) => { const a = String(e.target.value); if (isMonth(a)) set(a, a > f.to ? a : f.to); }} sx={sel} inputProps={{ "aria-label": "From month" }}>
          {months.map((m) => <MenuItem key={m} value={m}>{monthWords(m)}</MenuItem>)}
        </Select>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>to</Typography>
        <Select size="small" value={months.includes(f.to) ? f.to : ""} onChange={(e) => { const b = String(e.target.value); if (isMonth(b)) set(b < f.from ? b : f.from, b); }} sx={sel} inputProps={{ "aria-label": "To month" }}>
          {months.map((m) => <MenuItem key={m} value={m}>{monthWords(m)}</MenuItem>)}
        </Select>
      </Box>
    </Box>
  );
}

/** One list of the window, as Who are our customers' breakdowns: a check, the name, a bar of its net revenue, the figure. */
function Facet({ items, chosen, onPick, tint, noun }: { items: { key: string; rev: number }[]; chosen: string[]; onPick: (k: string) => void; tint: Tint; noun: string }) {
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const rows = [...items.filter((x) => x.key), ...chosen.filter((c) => !items.some((x) => x.key === c)).map((key) => ({ key, rev: 0 }))];
  if (!rows.length) return <Typography sx={{ fontSize: "0.78rem", color: FAINT, px: 1 }}>None in these months.</Typography>;
  const found = q ? rows.filter((r) => r.key.toLowerCase().includes(q.toLowerCase())) : rows;
  const LIMIT = 8;
  const shown = all || q ? found : [...found.slice(0, LIMIT), ...found.slice(LIMIT).filter((r) => chosen.includes(r.key))];
  const max = Math.max(1, ...rows.map((r) => r.rev));
  const t = TINT[tint];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.length > LIMIT && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${noun}…`} inputProps={{ "aria-label": `Find a ${noun} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
        </Box>
      )}
      <Box sx={{ display: "flex", justifyContent: "space-between", px: 1, pb: 0.25 }}>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>{noun}</Typography>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Net revenue</Typography>
      </Box>
      {shown.map((r) => {
        const on = chosen.includes(r.key);
        return (
          <Box key={r.key} component="button" type="button" onClick={() => onPick(r.key)} aria-pressed={on} title={on ? "Click again to let it go" : chosen.length ? `Add ${r.key}` : `Show only ${r.key}`}
            sx={{
              display: "grid", gridTemplateColumns: "20px minmax(0, 1fr) auto", alignItems: "center", columnGap: 1, width: "100%", border: 0, font: "inherit", textAlign: "left", cursor: "pointer",
              px: 1, py: 0.6, borderRadius: "9px", bgcolor: on ? t.bg : "#fff", color: INK, boxShadow: on ? `inset 0 0 0 1.5px ${t.fg}` : "inset 0 0 0 1px rgba(21,34,58,.06)",
              opacity: chosen.length && !on ? 0.7 : 1, "&:hover": { boxShadow: `inset 0 0 0 1.5px ${t.fg}`, opacity: 1 }, "&:focus-visible": { outline: `2px solid ${t.fg}`, outlineOffset: 1 },
            }}>
            <Box sx={{ width: 18, height: 18, borderRadius: "5px", display: "grid", placeItems: "center", bgcolor: on ? t.fg : "#fff", border: on ? "none" : "1.5px solid rgba(21,34,58,.28)" }}>
              {on && <CheckIcon sx={{ fontSize: 14, color: "#fff" }} />}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.key}</Typography>
              <Box sx={{ height: 3, borderRadius: 99, bgcolor: "rgba(21,34,58,.06)", mt: 0.4, overflow: "hidden" }}>
                <Box sx={{ width: `${(100 * Math.max(0, r.rev)) / max}%`, height: "100%", bgcolor: t.fg, opacity: 0.55, borderRadius: 99 }} />
              </Box>
            </Box>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{eur(r.rev)}</Typography>
          </Box>
        );
      })}
      {rows.length > LIMIT && !q && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start", px: 1, mt: 0.25 }}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      )}
    </Box>
  );
}

function FilterWindow({ f, open, onClose }: { f: Frame; open: boolean; onClose: () => void }) {
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => !shut[k];
  const flip = (k: string) => setShut((x) => ({ ...x, [k]: !x[k] }));
  const n = chosenCount(f);
  const chip = (key: string, name: string, value: string, tint: Tint, onDelete: () => void) => (
    <Chip key={key} size="small" label={<span><b>{name}:</b> {value}</span>} onDelete={onDelete}
      sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[tint].fg } }} />
  );
  return (
    <FilterPanel id="sealing-filters" open={open} onClose={onClose}
      subtitle={n ? `${n} chosen - click again to let one go` : "The months, the business units and the sales organisations - several at once"}
      onClearAll={n ? clearAll : undefined}
      chips={n ? [
        ...(ownPeriod(f) ? [chip("period", "Period", f.now, "blue", () => setQuery((q) => { q.delete("from"); q.delete("to"); }))] : []),
        ...f.bus.map((x) => chip(`bu:${x}`, "Business unit", x, "purple", () => toggleParam("bu", x))),
        ...f.orgs.map((x) => chip(`org:${x}`, "Sales organisation", x, "green", () => toggleParam("org", x))),
      ] : null}>
      <FilterSection id="sealf-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => flip("period")} summary={f.now} chosen={ownPeriod(f)}>
        <PeriodChoice f={f} />
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1, lineHeight: 1.45 }}>
          Against the same months a year earlier · any months from {monthWords(f.min)} to {monthWords(f.max)} · figures up to {f.upToDay}
        </Typography>
      </FilterSection>
      <FilterSection id="sealf-bu" index={1} title="Business unit" icon={<ApartmentOutlinedIcon />} tint="purple" open={isOpen("bu")} onFlip={() => flip("bu")}
        summary={!f.bus.length ? "All" : f.bus.length === 1 ? f.bus[0] : `${f.bus.length} chosen`} chosen={f.bus.length > 0}>
        <Facet items={f.d.meta.buFigures} chosen={f.bus} onPick={(k) => toggleParam("bu", k)} tint="purple" noun="business unit" />
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1, px: 0.5, lineHeight: 1.45 }}>The Angst+Pfister company that invoiced. None chosen: all of them.</Typography>
      </FilterSection>
      <FilterSection id="sealf-org" index={2} title="Sales organisation" icon={<StorefrontOutlinedIcon />} tint="green" open={isOpen("org")} onFlip={() => flip("org")}
        summary={!f.orgs.length ? "All" : f.orgs.length === 1 ? f.orgs[0] : `${f.orgs.length} chosen`} chosen={f.orgs.length > 0}>
        <Facet items={f.d.meta.channelFigures} chosen={f.orgs} onPick={(k) => toggleParam("org", k)} tint="green" noun="sales organisation" />
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1, px: 0.5, lineHeight: 1.45 }}>The organisation that sold to the customer. None chosen: all of them.</Typography>
      </FilterSection>
    </FilterPanel>
  );
}

/* ── a breakdown's rows ────────────────────────────────────────────────── */

type Row = { label: string; key: string; rev: number; gp: number; margin: number; prev: number; prevGp: number; compound?: string };

/** The figures as rows - a name twice (two customers of the same name) carries its number. */
function rowsOf(a: (Figure & { compound?: string })[]): Row[] {
  const n = new Map<string, number>();
  for (const x of a) n.set(x.name || NOT_KNOWN, (n.get(x.name || NOT_KNOWN) ?? 0) + 1);
  return a.map((x) => {
    const name = x.name || NOT_KNOWN;
    return { label: (n.get(name) ?? 0) > 1 ? `${name} · ${x.key || "-"}` : name, key: x.key, rev: x.rev, gp: x.gp, margin: x.margin, prev: x.prev ?? 0, prevGp: x.prevGp ?? 0, compound: x.compound };
  });
}
const prevMargin = (r: Row) => (r.prev ? r.prevGp / r.prev : null);
/** The rows summed - the margin of the sums, never an average of margins. */
function totalOf(rows: Row[], label: string): Row {
  const s = rows.reduce((t, r) => ({ rev: t.rev + r.rev, gp: t.gp + r.gp, prev: t.prev + r.prev, prevGp: t.prevGp + r.prevGp }), { rev: 0, gp: 0, prev: 0, prevGp: 0 });
  return { label, key: "", ...s, margin: s.rev ? s.gp / s.rev : 0 };
}
const revNote = (r: Row) => (r.prev ? { text: signedPct(r.rev / r.prev - 1), color: tone(r.rev / r.prev - 1) } : r.rev > 0 ? { text: "new", color: GREEN } : null);
const marginNote = (r: Row) => { const p = prevMargin(r); return p == null ? null : { text: points(r.margin, p), color: tone(r.margin - p) }; };

/* ── the drill-down's parts: charts, then tables (Customers.tsx, Reach.tsx) ── */

/** A chart's own box inside a breakdown's card - DimChart's look, for the charts that are not DimCharts. */
function ChartBox({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{title}</Typography>
      {hint && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>{hint}</Typography>}
      {children}
    </Box>
  );
}
const NONE = (what = "No invoice in these months with these filters.") => <Typography sx={{ fontSize: "0.85rem", color: MUTED, py: 2 }}>{what}</Typography>;

/** Net revenue per row against the same months a year earlier - a page at a time, the largest first; a bar can filter. */
function RevenueChart({ f, title, rows, labelWidth = 170, pageSize = 10, onPick, selected }: {
  f: Frame; title: string; rows: Row[]; labelWidth?: number; pageSize?: number; onPick?: (label: string) => void; selected?: string[];
}) {
  if (!rows.length) return <ChartBox title={title}>{NONE()}</ChartBox>;
  const two = hasBefore(f);
  return (
    <DimChart title={title} rows={rows} cur={(r) => r.rev} prev={(r) => r.prev} curLabel={f.now} prevLabel={f.before} fmt={eur} pageSize={pageSize}
      single={!two} curNote={two ? revNote : undefined} labelWidth={labelWidth} onPick={onPick} selected={selected} pickHint={onPick ? "Click a bar to show only it" : ""} />
  );
}

/** The gross margin per row, its change in points beside it - the largest by net revenue when `top` is given. */
function MarginChart({ f, title, rows, labelWidth = 170, top, pageSize = 10 }: { f: Frame; title: string; rows: Row[]; labelWidth?: number; top?: number; pageSize?: number }) {
  const shown = top ? [...rows].sort((a, b) => b.rev - a.rev).slice(0, top) : rows.filter((r) => r.rev > 0);
  if (!shown.length) return <ChartBox title={title}>{NONE()}</ChartBox>;
  return (
    <DimChart title={title} rows={shown} cur={(r) => r.margin} prev={() => 0} curLabel={`Gross margin, ${f.now}`} prevLabel="" fmt={pct} pageSize={pageSize}
      single fixedOrder={!!top} curNote={hasBefore(f) ? marginNote : undefined} labelWidth={labelWidth} pickHint="" />
  );
}

/** Each month's net revenue by unit, organisation or family - the three largest, the others in grey. */
function MonthStack({ f, rows, order, title }: { f: Frame; rows: KeyMonth[]; order: { key: string; name: string }[]; title: string }) {
  const top = order.slice(0, 3);
  const rest = order.length > 3;
  const data: StackRow[] = f.d.months.map(({ month }) => {
    const of = rows.filter((x) => x.month === month);
    const row: StackRow = { x: ymLabel(month) };
    top.forEach((k, j) => { row[`k${j}`] = of.filter((x) => x.key === k.key).reduce((a, x) => a + x.rev, 0); });
    if (rest) row.rest = of.filter((x) => !top.some((k) => k.key === x.key)).reduce((a, x) => a + x.rev, 0);
    return row;
  });
  const parts = [...top.map((k, j) => ({ key: `k${j}`, label: k.name, color: SERIES[j] })), ...(rest ? [{ key: "rest", label: "All the others", color: DEEMPHASIS }] : [])];
  return (
    <ChartBox title={title} hint={`the three with the most net revenue${rest ? ", all the others in grey" : ""}`}>
      {top.length ? (
        <ChartFrame table={{ columns: ["Month", ...parts.map((p) => p.label)], rows: data.map((d) => [String(d.x), ...parts.map((p) => Math.round(Number(d[p.key] ?? 0)))]), numeric: parts.map((_, i) => i + 1) }}>
          <StackedColumns data={data} parts={parts} format={eur} tickFormat={eurTick} xFormat={(x) => x} height={260} />
        </ChartFrame>
      ) : NONE()}
    </ChartBox>
  );
}

type Col = { head: string; cell: (r: Row) => React.ReactNode; sort: (r: Row) => number | string; text?: boolean };

/** All the figures of a breakdown (ExplorerKit Table) - any column sorts; a long list a page at a time, and a search. */
function FigTable({ f, title, first, rows, extra = [], total = null, find, withPrev = true }: {
  f: Frame; title: string; first: string; rows: Row[]; extra?: Col[]; total?: Row | null; find?: string; withPrev?: boolean;
}) {
  const all = f.d.totals.rev;
  const two = withPrev && hasBefore(f);
  const cols: Col[] = [
    { head: first, cell: (r) => r.label, sort: (r) => r.label.toLowerCase(), text: true },
    ...extra,
    { head: `Net revenue ${f.now}`, cell: (r) => (two ? withChange(eur(r.rev), r.prev ? change(r.rev, r.prev) : r.rev > 0 ? { text: "new", color: GREEN } : null) : eur(r.rev)), sort: (r) => r.rev },
    ...(two ? [{ head: `Net revenue ${f.before}`, cell: (r: Row) => eur(r.prev), sort: (r: Row) => r.prev }] : []),
    { head: "Gross profit", cell: (r) => eur(r.gp), sort: (r) => r.gp },
    {
      head: "Gross margin", sort: (r) => r.margin,
      cell: (r) => { const p = two ? prevMargin(r) : null; return p == null ? pct(r.margin) : withChange(pct(r.margin), { text: points(r.margin, p), color: tone(r.margin - p) }); },
    },
    { head: "Share of net revenue", cell: (r) => (all > 0 ? pct(r.rev / all) : "—"), sort: (r) => r.rev },
  ];
  const revCol = 1 + extra.length;
  const [sort, setSort] = useState<TableSort>({ col: revCol, desc: true });
  const [q, setQ] = useState("");
  // the rows found, in the order asked - the table draws them as they come (ExplorerKit: "the rows come sorted")
  const words = q.trim().toLowerCase();
  const found = words ? rows.filter((r) => `${r.label} ${r.key} ${r.compound ?? ""}`.toLowerCase().includes(words)) : rows;
  const by = cols[sort.col]?.sort ?? ((r: Row) => r.rev);
  const shown = [...found].sort((a, b) => {
    const x = by(a), y = by(b);
    const c = typeof x === "string" || typeof y === "string" ? String(x).localeCompare(String(y)) : x - y;
    return sort.desc ? -c : c;
  });
  const body: { key: string; cells: React.ReactNode[]; strong?: boolean }[] = shown.map((r, i) => ({ key: `${r.key}|${r.label}|${i}`, cells: cols.map((c) => c.cell(r)) }));
  // the total under the rows - the margin of the sums
  if (total && !words) body.push({ key: "__total", strong: true, cells: cols.map((c, i) => (i === 0 ? total.label : c.text ? "" : c.cell(total))) });
  const long = rows.length > 30;
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, flex: 1, minWidth: 200 }}>{title}</Typography>
        {find && rows.length > 10 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, height: 34, minWidth: 240, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
            <SearchIcon sx={{ fontSize: 17, color: MUTED }} />
            <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${find}…`} inputProps={{ "aria-label": `Find ${find}` }} sx={{ fontSize: "0.84rem", flex: 1 }} />
          </Box>
        )}
      </Box>
      {rows.length ? (
        <Table head={cols.map((c) => c.head)} rows={body} left={cols.map((c, i) => (c.text && i > 0 ? i : -1)).filter((i) => i > 0)}
          sortable={cols.map((_, i) => i)} sort={sort} onSort={(c) => setSort((s) => (s.col === c ? { col: c, desc: !s.desc } : { col: c, desc: cols[c]?.text ? false : true }))}
          pageSize={long ? 25 : undefined} />
      ) : NONE()}
    </Box>
  );
}

/** A breakdown's card: its title, the charts two by two, the table at the end, a line on what it counts (Customers.tsx). */
function Breakdown({ t, title, note, charts, table, foot }: { t: Topic; title: string; note: string; charts: React.ReactNode; table: React.ReactNode; foot?: string }) {
  return (
    <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={t.icon} tint={t.tint} title={title} note={note} />
      {/* the charts first, and the table at the end */}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, mt: -1 }}>{charts}</Box>
      {table}
      {foot && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{foot}</Typography>}
    </GlassCard>
  );
}
const Wide = ({ children }: { children: React.ReactNode }) => <Box sx={{ minWidth: 0, gridColumn: "1 / -1" }}>{children}</Box>;

/** A figure's months as Digital Growth's KPI card draws them (data.tsx KpiCard): the period's bars, the year before in grey. */
function MonthsChart({ f, v }: { f: Frame; v: SView }) {
  const labels = v.labels ?? MONTHS;
  if (!v.series.months.some((x) => x != null)) return null;
  const fmt = (x: number | null) => fmtValue(v.measure.fmt, x);
  return (
    <ChartFrame table={{ columns: ["Month", f.now, f.before], rows: labels.map((x, i) => [x, v.series.months[i] ?? "", v.series.py[i] ?? ""]), numeric: [1, 2] }}>
      <GroupedColumns height={180} format={fmt} data={labels.map((x, i) => ({ x, current: v.series.months[i], prior: v.series.py[i] }))} currentLabel={f.now} priorLabel={f.before} />
    </ChartFrame>
  );
}

/** The page's KPI cards (data.tsx KpiCard): the figure, against the same months a year earlier, its months - as a stage page opens. */
function KpiCards({ f, t, views }: { f: Frame; t: Topic; views: SView[] }) {
  const shown = views.filter((v) => v.ytd != null);
  if (!shown.length) return null;
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(420px, 1fr))" } }}>
      {shown.map((v) => (
        <KpiCard key={v.id} v={v} icon={t.icon} tint={t.tint} upTo={f.upTo} title={v.id}>
          {v.series.months.some((x) => x != null) ? <MonthsChart f={f} v={v} /> : undefined}
        </KpiCard>
      ))}
    </Box>
  );
}

/* ── the topic pages: Digital Growth's stage pages ─────────────────────── */

type TabDef = { id: string; label: string; count?: (f: Frame) => string | null; Body: (p: { f: Frame }) => React.ReactNode };
type PageDef = { title: string; topic: Topic; figures: (f: Frame) => { label: string; icon: React.ReactNode; tint: Tint; v: SView; sub?: string }[]; tabs: TabDef[] };

const glyph = (I: typeof EuroOutlinedIcon) => <I />;

/** A business unit or a sales organisation: its rows, the bars that filter, its months, every figure. */
function OrgBreakdown({ f, kind }: { f: Frame; kind: "units" | "orgs" }) {
  const units = kind === "units";
  const figs = units ? f.d.byBu : f.d.byChannel;
  const rows = rowsOf(figs);
  const param = units ? "bu" : "org";
  const keyOf = new Map(rows.map((r) => [r.label, r.key]));
  const pick = (label: string) => { const k = keyOf.get(label); if (k) toggleParam(param, k); };
  const chosen = units ? f.bus : f.orgs;
  const what = units ? "business unit" : "sales organisation";
  const t = units ? TOPIC.units : { ...TOPIC.units, icon: <StorefrontOutlinedIcon />, tint: "green" as Tint };
  return (
    <Breakdown t={t} title={`Net revenue and margin by ${what}, ${f.now}`}
      note={`${units ? "The Angst+Pfister company that invoiced" : "The organisation that sold to the customer"} · ${against(f)} · click a bar to show only it`}
      charts={<>
        <RevenueChart f={f} title={`Net revenue, by ${what}`} rows={rows} labelWidth={units ? 120 : 190} onPick={pick} selected={chosen.length ? rows.filter((r) => chosen.includes(r.key)).map((r) => r.label) : undefined} />
        <MarginChart f={f} title={`Gross margin, by ${what}`} rows={rows} labelWidth={units ? 120 : 190} />
        <Wide><MonthStack f={f} rows={units ? f.d.unitMonths : f.d.channelMonths} order={figs.map((x) => ({ key: x.key, name: x.name || NOT_KNOWN }))} title={`Net revenue month by month, by ${what}`} /></Wide>
      </>}
      table={<FigTable f={f} title={`All the figures, by ${what}`} first={units ? "Business unit" : "Sales organisation"} rows={rows} total={rows.length > 1 ? totalOf(rows, units ? "All business units" : "All sales organisations") : null} />}
      foot={units ? "The business unit is the Angst+Pfister company the invoice was written by (the ERP's company)." : "The sales organisation is the organisation that sold to the customer (the ERP's channel)."}
    />
  );
}

function MonthsTab({ f }: { f: Frame }) {
  return (
    <>
      <KpiCards f={f} t={TOPIC.revenue} views={[V.rev(f), V.gp(f), V.margin(f)]} />
      <Breakdown t={TOPIC.revenue} title={`Net revenue month by month, ${f.now}`} note={`Each month's invoices · ${against(f)}`}
        charts={<Wide><MonthStack f={f} rows={f.d.unitMonths} order={f.d.byBu.map((x) => ({ key: x.key, name: x.name || NOT_KNOWN }))} title="Net revenue month by month, by business unit" /></Wide>}
        table={null} />
    </>
  );
}

function CustomersTab({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.customers);
  const t = TOPIC.customers;
  return (
    <>
      <KpiCards f={f} t={t} views={[V.customers(f), V.perCustomer(f), V.topCustomers(f)]} />
      <Breakdown t={t} title={`Net revenue and margin by customer, ${f.now}`}
        note={`${int(f.d.totals.customers)} customers invoiced${f.d.customers.length < f.d.totals.customers ? ` · the ${int(f.d.customers.length)} with the most net revenue below` : ""} · ${against(f)}`}
        charts={<>
          <RevenueChart f={f} title="Net revenue, by customer" rows={rows} labelWidth={220} pageSize={12} />
          <MarginChart f={f} title="Gross margin of the largest customers" rows={rows} labelWidth={220} top={60} pageSize={12} />
        </>}
        table={<FigTable f={f} title="All the figures, by customer" first="Customer" rows={rows} find="a customer" extra={[{ head: "Customer number", cell: (r) => r.key || "—", sort: (r) => r.key, text: true }]} />}
      />
    </>
  );
}

function ArticlesTab({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.articles);
  const t = TOPIC.articles;
  return (
    <>
      <KpiCards f={f} t={t} views={[V.articles(f), V.perArticle(f), V.topArticles(f)]} />
      <Breakdown t={t} title={`Net revenue and margin by article, ${f.now}`}
        note={`${int(f.d.totals.articles)} articles invoiced${f.d.articles.length < f.d.totals.articles ? ` · the ${int(f.d.articles.length)} with the most net revenue below` : ""}, each with its compound · ${against(f)}`}
        charts={<>
          <RevenueChart f={f} title="Net revenue, by article" rows={rows} labelWidth={220} pageSize={12} />
          <MarginChart f={f} title="Gross margin of the largest articles" rows={rows} labelWidth={220} top={60} pageSize={12} />
        </>}
        table={<FigTable f={f} title="All the figures, by article" first="Article" rows={rows} find="an article" extra={[
          { head: "Article number", cell: (r) => r.key || "—", sort: (r) => r.key, text: true },
          { head: "Compound", cell: (r) => r.compound || "—", sort: (r) => (r.compound ?? "").toLowerCase(), text: true },
        ]} />}
      />
    </>
  );
}

function FamiliesTab({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.byFamily);
  const t = TOPIC.materials;
  return (
    <>
      <KpiCards f={f} t={t} views={[V.noCompound(f), V.compounds(f)]} />
      <Breakdown t={t} title={`Net revenue and margin by material family, ${f.now}`}
        note={`Named compounds only - ${pct(f.d.noCompoundShare)} of the net revenue names none · ${against(f)}`}
        charts={<>
          <RevenueChart f={f} title="Net revenue, by material family" rows={rows} labelWidth={120} />
          <MarginChart f={f} title="Gross margin, by material family" rows={rows} labelWidth={120} />
          <Wide><MonthStack f={f} rows={f.d.familyMonths} order={f.d.byFamily.map((x) => ({ key: x.key, name: x.name }))} title="Net revenue month by month, by material family" /></Wide>
        </>}
        table={<FigTable f={f} title="All the figures, by material family" first="Material family" rows={rows} total={rows.length > 1 ? totalOf(rows, "All named compounds") : null} />}
        foot="The family follows the pilot's rule, by the compound's name: FFKM (Kalrez, Evolast), HNBR, FKM (FPM), EPDM, NBR, VMQ (silicone), PTFE - any other compound is Unclassified."
      />
    </>
  );
}

function CompoundsTab({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.compounds);
  const t = { ...TOPIC.materials, icon: <ScienceOutlinedIcon />, tint: "purple" as Tint };
  return (
    <Breakdown t={t} title={`Net revenue and margin by compound, ${f.now}`}
      note={`${int(f.d.compounds.length)} named compounds - ${pct(f.d.noCompoundShare)} of the net revenue names none · each with its material family · ${against(f)}`}
      charts={<>
        <RevenueChart f={f} title="Net revenue, by compound" rows={rows} labelWidth={200} pageSize={12} />
        <MarginChart f={f} title="Gross margin of the largest compounds" rows={rows} labelWidth={200} top={60} pageSize={12} />
      </>}
      table={<FigTable f={f} title="All the figures, by compound" first="Compound" rows={rows} find="a compound" total={null}
        extra={[{ head: "Material family", cell: (r) => materialOf(r.key), sort: (r) => materialOf(r.key), text: true }]} />}
    />
  );
}

function ApprovalsTab({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.approvals);
  const t = TOPIC.approvals;
  const s = f.d.noApprovalShare, all = f.d.totals.rev;
  return (
    <>
      <KpiCards f={f} t={t} views={[V.noApproval(f), V.withApproval(f), V.approvals(f)]} />
      <Breakdown t={t} title={`The approvals written on the articles, ${f.now}`}
        note={`Which approvals matter? ${pct(s)} of the net revenue has no approval written on the article · ${against(f)}`}
        charts={<>
          <ChartBox title="With and without an approval written" hint={`the share of the net revenue, ${f.now}`}>
            {all ? (
              <BarList rows={[
                { label: "An approval written", value: 1 - s, secondary: `${eur(all * (1 - s))} net revenue` },
                { label: "No approval written", value: s, secondary: `${eur(all * s)} net revenue` },
              ]} format={pct} labelWidth={170} max={1} />
            ) : NONE()}
          </ChartBox>
          <MarginChart f={f} title="Gross margin of the largest approvals" rows={rows} labelWidth={220} top={30} />
          <Wide><RevenueChart f={f} title="Net revenue, by the approval written" rows={rows} labelWidth={260} pageSize={12} /></Wide>
        </>}
        table={<FigTable f={f} title="All the figures, by approval" first="Approval as written" rows={rows} find="an approval" />}
        foot="A text can name several approvals, and the figures cannot tell which approval caused a sale. The 60 approvals with the most net revenue are listed."
      />
    </>
  );
}

const PAGES: Record<Exclude<SealingSlug, "overview">, PageDef> = {
  units: {
    title: "Business units", topic: TOPIC.units,
    figures: (f) => [
      { label: "Net revenue", icon: glyph(EuroOutlinedIcon), tint: "green", v: V.rev(f) },
      { label: "Gross profit", icon: glyph(SavingsOutlinedIcon), tint: "purple", v: V.gp(f) },
      { label: "Gross margin", icon: glyph(PercentOutlinedIcon), tint: "blue", v: V.margin(f) },
      { label: "Business units", icon: glyph(ApartmentOutlinedIcon), tint: "slate", v: wholeView(f, "Business units", "int", f.d.byBu.filter((x) => x.rev > 0).length, null), sub: `${int(f.d.byChannel.filter((x) => x.rev > 0).length)} sales organisations` },
    ],
    tabs: [
      { id: "units", label: "Business units", count: (f) => (f.bus.length ? String(f.bus.length) : null), Body: ({ f }) => <OrgBreakdown f={f} kind="units" /> },
      { id: "orgs", label: "Sales organisations", count: (f) => (f.orgs.length ? String(f.orgs.length) : null), Body: ({ f }) => <OrgBreakdown f={f} kind="orgs" /> },
      { id: "months", label: "Month by month", Body: MonthsTab },
    ],
  },
  customers: {
    title: "Customers", topic: TOPIC.customers,
    figures: (f) => [
      { label: "Customers invoiced", icon: glyph(GroupsOutlinedIcon), tint: "green", v: V.customers(f) },
      { label: "Net revenue", icon: glyph(EuroOutlinedIcon), tint: "blue", v: V.rev(f) },
      { label: "Gross margin", icon: glyph(PercentOutlinedIcon), tint: "purple", v: V.margin(f) },
      { label: "The 10 largest' share", icon: glyph(DonutLargeOutlinedIcon), tint: "amber", v: V.topCustomers(f) },
    ],
    tabs: [{ id: "customers", label: "Customers", Body: CustomersTab }],
  },
  articles: {
    title: "Articles", topic: TOPIC.articles,
    figures: (f) => [
      { label: "Articles invoiced", icon: glyph(InventoryOutlinedIcon), tint: "pink", v: V.articles(f) },
      { label: "Net revenue", icon: glyph(EuroOutlinedIcon), tint: "blue", v: V.rev(f) },
      { label: "Gross margin", icon: glyph(PercentOutlinedIcon), tint: "purple", v: V.margin(f) },
      { label: "The 10 largest' share", icon: glyph(DonutLargeOutlinedIcon), tint: "amber", v: V.topArticles(f) },
    ],
    tabs: [{ id: "articles", label: "Articles", Body: ArticlesTab }],
  },
  materials: {
    title: "Materials", topic: TOPIC.materials,
    figures: (f) => [
      { label: "Net revenue", icon: glyph(EuroOutlinedIcon), tint: "blue", v: V.rev(f) },
      { label: "Gross margin", icon: glyph(PercentOutlinedIcon), tint: "purple", v: V.margin(f) },
      { label: "Compounds named", icon: glyph(ScienceOutlinedIcon), tint: "green", v: V.compounds(f) },
      { label: "No compound named", icon: glyph(CategoryOutlinedIcon), tint: "amber", v: V.noCompound(f), sub: "of the net revenue" },
    ],
    tabs: [
      { id: "families", label: "Material families", count: (f) => String(f.d.byFamily.length), Body: FamiliesTab },
      { id: "compounds", label: "Compounds", count: (f) => String(f.d.compounds.length), Body: CompoundsTab },
    ],
  },
  approvals: {
    title: "Approvals", topic: TOPIC.approvals,
    figures: (f) => [
      { label: "Net revenue", icon: glyph(EuroOutlinedIcon), tint: "blue", v: V.rev(f) },
      { label: "Gross margin", icon: glyph(PercentOutlinedIcon), tint: "purple", v: V.margin(f) },
      { label: "No approval written", icon: glyph(VerifiedOutlinedIcon), tint: "amber", v: V.noApproval(f) },
      { label: "Approvals written", icon: glyph(VerifiedOutlinedIcon), tint: "slate", v: V.approvals(f) },
    ],
    tabs: [{ id: "approvals", label: "Approvals", Body: ApprovalsTab }],
  },
};

/** A topic's page, as a stage page of Digital Growth: the way back, the head with its figures, the tabs and Filters, the cards. */
function TopicPage({ slug, f, busy, err, again }: { slug: Exclude<SealingSlug, "overview">; f: Frame; busy: boolean; err: string | null; again: () => void }) {
  const page = PAGES[slug];
  const params = useSearchParams();
  const asked = params.get("tab");
  const tab = page.tabs.find((x) => x.id === asked) ?? page.tabs[0];
  const setTab = (id: string) => setQuery((q) => { if (id === page.tabs[0].id) q.delete("tab"); else q.set("tab", id); });
  const [panel, setPanel] = useState(false);
  return (
    // the stage page's frame ([stage]/page.tsx): the way back, then the page
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.25 }}>
      <Box component={Link} href={hrefOf("overview", f.carry)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
        <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to Sealing Business Review
      </Box>
      <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
        {/* the title and what is shown on the left; the figures top right */}
        <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
          <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
            <Typography component="h1" sx={H1}>{page.title}</Typography>
            <Line f={f} busy={busy} />
            <Chosen f={f} />
          </Box>
          <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }}>
            <FigureCards items={page.figures(f).map((x, i) => ({ id: `${i}-${x.label}`, ...x }))} />
          </Box>
        </Box>
        {/* the tabs, and at their right end the Filters button */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
          <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
            {page.tabs.length > 1 && <ReportTabs name={`sealing-${slug}`} tab={tab.id} onSelect={setTab} tabs={page.tabs.map((x) => ({ id: x.id, label: x.label, count: x.count?.(f) ?? null }))} />}
          </Box>
          <Box sx={{ flex: 1 }} />
          <FiltersButton f={f} open={panel} onClick={() => setPanel((x) => !x)} />
        </Box>
        <Trouble err={err} again={again} />
        <Box id={`sealing-${slug}-panel-${tab.id}`} sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)", opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }} aria-busy={busy}>
          <tab.Body f={f} />
        </Box>
        <Foot f={f} slug={slug} />
      </Box>
      <FilterWindow f={f} open={panel} onClose={() => setPanel(false)} />
    </Box>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

const TITLE: Record<SealingSlug, string> = {
  overview: "Sealing Business Review", units: "Business units", customers: "Customers", articles: "Articles", materials: "Materials", approvals: "Approvals",
};

export function SealingPage({ slug }: { slug: SealingSlug }) {
  const { qs, ready } = useCarried();
  const { bus, orgs, ask, carry } = useMemo(() => {
    const p = new URLSearchParams(qs);
    const q = new URLSearchParams();
    const from = p.get("from"), to = p.get("to");
    if (isMonth(from)) q.set("from", from);
    if (isMonth(to)) q.set("to", to);
    const b = [...new Set(p.getAll("bu").filter(Boolean))], o = [...new Set(p.getAll("org").filter(Boolean))];
    for (const x of b) q.append("bu", x);
    for (const x of o) q.append("channel", x);
    return { bus: b, orgs: o, ask: q.toString(), carry: filterPart(qs) };
  }, [qs]);
  const { d, err, busy, again } = useSealing(ask, ready);
  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  const head = <Typography component="h1" sx={H1}>{TITLE[slug]}</Typography>;
  if (!d) {
    // Digital Growth's waiting card - or what went wrong, in plain words, and a way to ask again
    return (
      <Box sx={shell}>{head}
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          {!err && <CircularProgress size={18} />}
          <Typography sx={{ fontSize: "0.9rem", color: err ? RED : MUTED }}>{err ? `The sealing figures could not be read: ${err}` : "Reading the sealing figures…"}</Typography>
          {err && <Button size="small" onClick={again} sx={{ textTransform: "none", fontWeight: 700 }}>Try again</Button>}
        </Box></GlassCard>
      </Box>
    );
  }
  if (!d.meta.rows) return (
    <Box sx={shell}>{head}
      <GlassCard>
        <Typography sx={{ fontSize: "0.9rem", color: MUTED, lineHeight: 1.55 }}>
          No figures yet. They arrive with the morning ERP delivery that carries the sealing sheet, and this page fills the same morning.
        </Typography>
      </GlassCard>
    </Box>
  );
  const f = frameOf(d, bus, orgs, carry);
  return slug === "overview"
    ? <Overview f={f} busy={busy} err={err} again={again} />
    : <TopicPage slug={slug} f={f} busy={busy} err={err} again={again} />;
}

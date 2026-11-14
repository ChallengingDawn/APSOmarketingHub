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
//     (tiles/KpiStyled KpiTileChart, data.tsx MiniBars), the topic's charts under its tiles at half width; the topic's
//     title is the way in to its page; the commercial priorities a block of their own;
//   - each topic is a stage page (marketing-kpis/[stage] + Reach.tsx / Customers.tsx): the way back, the title and what is
//     shown with its figures top right (ExplorerKit FigureCards), the tabs with the Filters button at their right end, the
//     KPI cards (data.tsx KpiCard), then the breakdown's charts and its table (ExplorerKit Table);
//   - the period, the business units and the sales organisations in Digital Growth's Filters window (FilterPanel), the
//     choice as chips under the title, all of it in the address - carried from page to page.
//
// The pilot's KPIs, charts and structure in the hub's style (SARCLA 11.11.2026: "mix with the hub, on the style of the
// hub, but content-wise what he requests; if we can add more, perfect, but we should find his structure"): each of the
// pilot's views (index.html, revision.js) is a page here, its sections in its order under its own questions - the
// overview's four cards, "Where does revenue come from?" and "Which materials sell most?", "From results to action",
// "The business at a glance" (who buys, which compounds lead, what sells most, which approvals matter); a view's title,
// its cards, its search and ranking controls, its notice, its charts, its ranking, its cards of actions; "Definitions &
// source notes" at the foot. Drawn by the hub's chart kit (src/app/charts): the revenue mixes as rings (Donut), the
// rankings with their gross margin (BarList), scale against profitability as numbered bubbles (Bubbles), the approval
// evidence as share bars (ShareBar), the hub's tiles, glass cards and detail window. The hub's own figures - against a
// year earlier, month by month, every figure in a table - follow the pilot's content on each page.
//
// Round 7 (SARCLA 11.11.2026, on round 6 live): the rings bigger and balanced beside a one-line legend (the rest in
// "Other (n)"); no topics against a year earlier on the overview any more; a page's cards and Filters in its head, no
// band of their own; a ranking's controls right above it, "All" every one of them 30 a page from the hub (/api/ap/
// sealing/list) and an All tab per view; the source line in the definitions' window; the KPI cards stacked (the name
// on its own line); each figure its own full-width graph; the commercial priorities accepted, refused - the next comes
// in - and moved on by a cross-admin (/api/ap/sealing/priorities), three open in each block.
// No tile toolbar (tasks, tickets, promote, drag, Actions): that is the APSOparts action plan, closed to Angst+Pfister.
// Margins are always the margin of the sums (sealingRules sumBy / rateMonths), never an average of margins.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import MuiTable from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import TuneIcon from "@mui/icons-material/Tune";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
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
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame, type TableTwin } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { MultiLine } from "@/app/charts/MultiLine";
import { StackedColumns, type StackRow } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { ShareBar } from "@/app/charts/ShareBar";
import { Donut } from "@/app/charts/Donut";
import { Bubbles } from "@/app/charts/Bubbles";
import { ACCENT, DEEMPHASIS, DELTA, SERIES } from "@/app/charts/palette";
import { compact } from "@/app/charts/format";
import { KpiCard, MONTHS, MiniBars, type KpiView } from "@/app/reporting/marketing-kpis/data";
import { KpiTileChart } from "@/app/reporting/marketing-kpis/tiles/KpiStyled";
import { FigureCards, Table, type TableSort } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { fmtValue, type Fmt } from "@/lib/marketingKpis/measures";
import { SEALING_PAGES, type SealingSlug } from "@/lib/apHub/sealingPages";
import type { DetailRow, SealingDetail, SealingMonth, SealingView } from "@/lib/apHub/sealingStore";
import {
  APPROVAL_KINDS, LIST_PAGE, approvalLabel, approvalParts, cleanName, shortName, SEALING_DEFINITIONS, STATUS_NAME, actionsCaption, approvalCandidates, familyCandidates, nextStatuses, openCards, overviewCandidates, pagesOf, reviewCandidates, approvalKind, familyFigures, isMonth, leadingRefs,
  materialOf, monthsBetween, monthsSpan, noCompound, periodWords, rankBy, rateMonths, sealingPresets, sumMonths, tileSeries,
  NO_ORG, NO_UNIT, NO_UNIT_WHY, tinyNoUnit, APPROVAL_ROWS, PER_DATA_SHEET,
  type ApprovalKind, type DetailKind, type Figure, type KeyMonth, type ListKind, type MonthPair, type Position, type Priority, type PriorityStatus, type RankBy,
} from "@/lib/apHub/sealingRules";

/* ── words and numbers, in full (Digital Growth: no abbreviations) ─────── */

const eur = (n: number | null | undefined) => fmtValue("eur", n);
const eurTick = (n: number | null) => (n == null ? "" : `€${compact(n)}`);
const pct = (x: number | null | undefined) => fmtValue("pct", x);
const int = (n: number | null | undefined) => fmtValue("int", n);
const signedPct = (x: number) => { const d = Math.round(x * 1000) / 10; return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)}%`; };
const points = (a: number, b: number) => { const d = Math.round((a - b) * 1000) / 10; return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)} pts`; };
const tone = (d: number, eps = 0.0005) => (Math.abs(d) < eps ? MUTED : d > 0 ? GREEN : RED);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthWords = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const ymLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const lastDay = (ym: string) => `${new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()} ${monthWords(ym)}`;
const dayWords = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", year: "numeric" });
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const NOT_KNOWN = "Not known";
/** "FDA, WRAS and NSF" */
const andList = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
/** The chart controls' look - ChartFrame's own Chart / Table switch. */
const TOGGLE = { "& .MuiToggleButton-root": { px: 1.1, py: 0.35, fontSize: "0.74rem", textTransform: "none" } } as const;

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

/** What a click opens in the detail window - the pilot's drawer: a customer, an article, a compound, an approval text. */
type DetailPick = { kind: DetailKind | "approval"; key: string; name: string; rev: number; gp: number; margin: number };

/** One customer's articles, one article's or one compound's customers - with the page's period and filters. */
function useDetail(pick: DetailPick | null, ask: string) {
  const [s, setS] = useState<{ d: SealingDetail | null; err: string | null; busy: boolean }>({ d: null, err: null, busy: false });
  const kind = pick?.kind ?? null, key = pick?.key ?? null;
  useEffect(() => {
    if (!kind || kind === "approval" || key == null) { setS({ d: null, err: null, busy: false }); return; }
    let live = true;
    setS({ d: null, err: null, busy: true });
    const q = new URLSearchParams(ask);
    q.set("kind", kind);
    q.set("key", key);
    fetch(`/api/ap/sealing/detail?${q.toString()}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; detail?: SealingDetail };
        if (!live) return;
        if (!r.ok || !j.ok || !j.detail) setS({ d: null, err: j.error ?? `the hub answered ${r.status}`, busy: false });
        else setS({ d: j.detail, err: null, busy: false });
      })
      .catch((e) => { if (live) setS({ d: null, err: String((e as Error)?.message ?? e), busy: false }); });
    return () => { live = false; };
  }, [kind, key, ask]);
  return s;
}

/** The way a chart opens the detail window - the overview and every topic page give it. */
const InspectCtx = createContext<(p: DetailPick) => void>(() => {});

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
/** A page's own choice in the address (a material family, a search) - one value, or none. */
const setParam = (key: string, v: string | null) => setQuery((q) => { if (v) q.set(key, v); else q.delete(key); });
const clearAll = () => setQuery((q) => { for (const k of FILTER_KEYS) q.delete(k); });
/** The carried filters with one more value of `key` - a business unit picked on the overview. */
const plus = (carry: string, key: string, v: string) => { const q = new URLSearchParams(carry); if (!q.getAll(key).includes(v)) q.append(key, v); return q.toString(); };
const hrefOf = (slug: SealingSlug, carry: string, tab?: string, more: Record<string, string> = {}) => {
  const base = SEALING_PAGES.find((p) => p.slug === slug)?.href ?? "/ap/reporting/sealing";
  const q = [tab ? `tab=${encodeURIComponent(tab)}` : "", new URLSearchParams(more).toString(), carry].filter(Boolean).join("&");
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
  /** the same, as the API reads them - the detail window asks with it */
  ask: string;
  /** "31 Oct 2026" - or the day of the delivery when the period ends in the month still running */
  upToDay: string;
  /** the line under a tile: how far its figure reaches, and when the hub read it */
  upTo: string;
};

function frameOf(d: SealingView, bus: string[], orgs: string[], carry: string, ask: string): Frame {
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
    bus, orgs, carry, ask, upToDay,
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

/** The leading material family - the pilot's overview card leaves the unclassified ones out. */
const leadFamily = (f: Frame) => f.d.byFamily.find((x) => x.key !== "Unclassified");
/** The net revenue of the named compounds - the whole of the pilot's "named compound revenue". */
const namedRev = (f: Frame) => f.d.byFamily.reduce((a, x) => a + x.rev, 0);
const NO_COMPOUND = "No compound";
/** An article's material family by its compound - "No compound" where it names none. */
const familyOfArticle = (compound: string) => (noCompound(compound) ? NO_COMPOUND : materialOf(compound));

const V = {
  rev: (f: Frame) => sumView(f, "Net revenue", "eur", revPairs(f), { definition: "Every sealing invoice of the period (profit centre DT), in EUR - the pilot's revenue in this selection" }),
  gp: (f: Frame) => sumView(f, "Gross profit", "eur", gpPairs(f), { definition: "Net revenue less the cost of the goods" }),
  margin: (f: Frame) => rateView(f, "Gross margin", gpPairs(f), revPairs(f), { definition: "Gross profit over net revenue of the same invoices - the pilot's weighted margin, never an average of margins" }),
  customers: (f: Frame) => wholeView(f, "Customers invoiced", "int", f.d.totals.customers, f.d.totals.prev.customers, {
    months: pairsOf(f.d.months, (m) => m.customers, (m) => m.prevCustomers), definition: "Customer accounts with a sealing invoice in the period (the pilot's accounts) - each month's bar, the accounts of that month",
  }),
  customerShare: (f: Frame) => wholeView(f, "The largest customer's share", "pct", f.d.concentration.customer1, f.d.concentration.prevCustomer1, {
    goodWhenUp: false, definition: "The part of the net revenue the largest customer account carries - a year earlier, the largest then (the pilot's concentration)",
  }),
  negCustomers: (f: Frame) => wholeView(f, "Customers with a negative gross margin", "int", f.d.negative.customers.count, f.d.negative.prevCustomers?.count ?? null, {
    goodWhenUp: false, definition: "Customer accounts whose gross profit over the period is below zero (the pilot's margin review)",
  }),
  articles: (f: Frame) => wholeView(f, "Articles invoiced", "int", f.d.totals.articles, f.d.totals.prev.articles, {
    months: pairsOf(f.d.months, (m) => m.articles, (m) => m.prevArticles), definition: "Articles with a sealing invoice in the period - each month's bar, the articles of that month",
  }),
  negArticles: (f: Frame) => wholeView(f, "Articles with a negative gross margin", "int", f.d.negative.articles.count, f.d.negative.prevArticles?.count ?? null, {
    goodWhenUp: false, definition: "Articles whose gross profit over the period is below zero (the pilot's margin review)",
  }),
  noCompound: (f: Frame) => rateView(f, "No compound", pairsOf(f.d.months, (m) => m.noCompound, (m) => m.prevNoCompound), revPairs(f), {
    goodWhenUp: false, definition: "The part of the net revenue whose article names no compound (\"No info\", \"Unknown\", \"TBD\", a drawing) - the pilot's unresolved entries, left out of the families",
  }),
  compounds: (f: Frame) => wholeView(f, "Compounds", "int", f.d.totals.compounds, f.d.totals.prev.compounds, { definition: "The named compounds on the articles invoiced (the pilot's compound entries)" }),
  noApproval: (f: Frame) => rateView(f, "No approval written", pairsOf(f.d.months, (m) => m.noApproval, (m) => m.prevNoApproval), revPairs(f), {
    goodWhenUp: false, definition: "The part of the net revenue whose article has no approval written (the pilot's \"no approval comment\")",
  }),
  withApproval: (f: Frame) => sumView(f, "Net revenue with an approval written", "eur", pairsOf(f.d.months, (m) => m.rev - m.noApproval, (m) => (m.prevRev == null ? null : m.prevRev - (m.prevNoApproval ?? 0))), {
    definition: "Net revenue whose article has at least one approval written",
  }),
  approvals: (f: Frame) => wholeView(f, "Approvals written", "int", f.d.totals.approvals, f.d.totals.prev.approvals, { definition: "The different approval texts written on the articles invoiced (the pilot's comment records)" }),
};

/** A key's net revenue (a business unit, a family) month by month - compared like for like. */
function keyView(f: Frame, id: string, rows: KeyMonth[], keys: string[], definition?: string): SView {
  return sumView(f, id, "eur", keyPairs(rows, keys, f.d.months.map((m) => m.month)), { definition });
}

/* ── a figure with its real graph (SARCLA 13.11.2026: "this block still completely shit, put real graphs") ──
   Each figure one card: its name, the figure and its change on one line, then its months - this period's against the same
   months a year earlier, paired bars for counts and amounts, two lines for shares - a small legend, one short line. */

/** A figure's card: its view, how its months are drawn, its one line. */
type Trend = { v: SView; kind: "bars" | "lines"; note?: string; t: Topic };

/** A figure in a chart's axis and tooltip - short: €1.6M, 2.4K, 21.6%. */
const shortFmt = (fmt: Fmt) => (x: number | null) => (x == null ? "" : fmt === "eur" ? `€${compact(x)}` : fmt === "pct" ? `${(x * 100).toFixed(1)}%` : compact(x));

/** The change against the same months a year earlier, read as the figure cards read it - like for like where only some are known. */
function changeOf(v: SView): { text: string; tone: string } | null {
  const same = v.sameYtd != null && !!v.pyNote?.startsWith("same months");
  const cur = same ? v.sameYtd! : v.ytd;
  if (cur == null || v.pyYtd == null || v.pyYtd === 0) return null;
  const isPct = v.measure.fmt === "pct";
  const d = isPct ? (cur - v.pyYtd) * 100 : (cur / v.pyYtd - 1) * 100;
  const flat = Math.abs(d) < 0.05;
  const good = (d > 0) === (v.measure.goodWhenUp !== false);
  return { text: `${flat ? "±" : d > 0 ? "↑" : "↓"} ${Math.abs(d).toFixed(1)}${isPct ? " pts" : "%"}`, tone: flat ? FAINT : good ? GREEN : RED };
}

/** The month still running in a figure's months - drawn faded (GroupedColumns' partial) - or none. */
function runningAt(f: Frame, v: SView): number {
  const now = new Date().toISOString().slice(0, 7);
  if (f.d.period.to !== now) return -1;
  return v.labels ? f.d.months.length - 1 : Number(now.slice(5, 7)) - 1;
}

/** A figure's card - the name, the figure and its change on one line, its months as a real chart, one short line. */
function TrendCard({ f, it, compact: small = false }: { f: Frame; it: Trend; compact?: boolean }) {
  const { v, t } = it;
  const labels = v.labels ?? MONTHS;
  const ch = changeOf(v);
  const fmt = shortFmt(v.measure.fmt);
  const before = v.series.py.some((x) => x != null);
  const run = runningAt(f, v);
  const has = v.series.months.some((x) => x != null && x !== 0) || before;
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: small ? 1.75 : 2, display: "flex", flexDirection: "column", gap: 1, minWidth: 0, height: "100%" }}>
      {(() => {
        const name = small
          ? <Typography title={v.id} sx={{ flex: "1 1 auto", minWidth: 0, fontSize: "0.9rem", fontWeight: 700, color: INK, lineHeight: 1.3, minHeight: "2.6em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.id}</Typography>
          : <Typography noWrap title={v.id} sx={{ flex: "1 1 auto", minWidth: 0, fontSize: "0.9rem", fontWeight: 700, color: INK }}>{v.id}</Typography>;
        const figure = (
          <>
            <Typography noWrap sx={{ flex: "0 0 auto", fontSize: small ? "1.3rem" : "1.25rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {fmtValue(v.measure.fmt, v.ytd)}
            </Typography>
            {ch && <Typography noWrap title={`against ${v.pyNote ?? f.before}`} sx={{ flex: "0 0 auto", fontSize: "0.78rem", fontWeight: 700, color: ch.tone }}>{ch.text}</Typography>}
          </>
        );
        // a quarter of the row: the name on its line, the figure and its change under it; half a row: all on one line
        return small ? (
          <Box sx={{ display: "grid", gap: 0.5, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}><Badge icon={t.icon} tint={t.tint} size={26} />{name}</Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>{figure}</Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}><Badge icon={t.icon} tint={t.tint} size={28} />{name}{figure}</Box>
        );
      })()}
      <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
        {!has ? <Typography sx={{ fontSize: "0.8rem", color: FAINT, py: 4, textAlign: "center" }}>No months to draw yet.</Typography>
          : small ? <MiniBars v={v} labels={labels} height={78} />
            : it.kind === "bars" ? (
              <GroupedColumns height={170} format={fmt} currentLabel={f.now} priorLabel={f.before}
                data={labels.map((x, i) => ({ x: x.length > 3 ? x : x.slice(0, 3), current: v.series.months[i], prior: before ? v.series.py[i] : null, partial: i === run }))} />
            ) : (
              <MultiLine height={170} labels={labels} format={fmt}
                series={[{ key: "cur", label: f.now, values: v.series.months }, ...(before ? [{ key: "prev", label: f.before, values: v.series.py, rest: true }] : [])]} />
            )}
      </Box>
      <Typography title={it.note} sx={{ fontSize: "0.76rem", color: MUTED, minHeight: "1.2em", lineHeight: 1.35, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.note ?? ""}</Typography>
    </Box>
  );
}

/** A page's figures with their graphs: two to a row - the charts stay readable (SARCLA 13.11.2026). */
function TrendCards({ f, items, four = false }: { f: Frame; items: (Trend | null)[]; four?: boolean }) {
  const shown = items.filter((x): x is Trend => !!x && x.v.ytd != null);
  if (!shown.length) return null;
  return (
    <Box sx={{ display: "grid", gap: 1.5, alignItems: "stretch", gridTemplateColumns: four ? { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } : { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
      {shown.map((it) => <TrendCard key={it.v.id} f={f} it={it} compact={four} />)}
    </Box>
  );
}

/* each figure's months */

/** The period's largest customer account, article or named compound, month by month (net revenue) - a year earlier where known. */
const leaderPairs = (f: Frame, kind: "customer" | "article" | "compound"): MonthPair[] => {
  const rows = f.d.leaderMonths?.[kind] ?? [];
  return f.d.months.map(({ month }) => { const r = rows.find((x) => x.month === month); return { month, cur: r?.rev ?? 0, prev: r ? r.prevRev : null }; });
};
/** Some keys' gross profit added together month by month (a family's, the named compounds'). */
const keyGpPairs = (rows: KeyMonth[], keys: string[], months: string[]): MonthPair[] => months.map((month) => {
  const of = rows.filter((r) => r.month === month && keys.includes(r.key));
  const prev = of.length && of.every((r) => r.prevGp != null) ? of.reduce((a, r) => a + (r.prevGp ?? 0), 0) : null;
  return { month, cur: of.reduce((a, r) => a + r.gp, 0), prev };
});
const monthKeys = (f: Frame) => f.d.months.map((m) => m.month);

const TOPIC_COMPOUND: Topic = { title: "Compounds", icon: <ScienceOutlinedIcon />, tint: "purple" };

/** The figures with their graphs, by page. */
const TR = {
  customers: (f: Frame): Trend => ({ v: { ...V.customers(f), id: "Customers invoiced" }, kind: "bars", note: "The accounts with a sealing invoice each month", t: TOPIC.customers }),
  largestCustomer: (f: Frame): Trend | null => {
    const x = f.d.customers[0];
    return x ? { v: sumView(f, "Largest customer account", "eur", leaderPairs(f, "customer")), kind: "bars", note: x.name || x.key, t: TOPIC.customers } : null;
  },
  customerShare: (f: Frame): Trend | null => {
    const x = f.d.customers[0];
    return x ? { v: rateView(f, "Largest account's share", leaderPairs(f, "customer"), revPairs(f), { goodWhenUp: false }), kind: "lines", note: `${x.name || x.key} · of the net revenue`, t: TOPIC.customers } : null;
  },
  negCustomers: (f: Frame): Trend => ({
    v: wholeView(f, "Accounts at a negative margin", "int", f.d.negative.customers.count, f.d.negative.prevCustomers?.count ?? null, {
      goodWhenUp: false, months: pairsOf(f.d.months, (m) => m.negCustomers ?? 0, (m) => (m.prevRev == null ? null : m.prevNegCustomers ?? null)),
    }),
    kind: "bars", note: `${eur(f.d.negative.customers.rev)} with them · each bar, that month's losses`, t: TOPIC.customers,
  }),
  articles: (f: Frame): Trend => ({ v: { ...V.articles(f), id: "Articles invoiced" }, kind: "bars", note: "The articles with a sealing invoice each month", t: TOPIC.articles }),
  largestArticle: (f: Frame): Trend | null => {
    const x = f.d.articles[0];
    return x ? { v: sumView(f, "Largest article", "eur", leaderPairs(f, "article")), kind: "bars", note: `${x.key || "—"} · ${cleanName(x.name || "")}`, t: TOPIC.articles } : null;
  },
  articleShare: (f: Frame): Trend | null => {
    const x = f.d.articles[0];
    return x ? { v: rateView(f, "Largest article's share", leaderPairs(f, "article"), revPairs(f), { goodWhenUp: false }), kind: "lines", note: `${x.key || "—"} · ${cleanName(x.name || "")} · of the net revenue`, t: TOPIC.articles } : null;
  },
  negArticles: (f: Frame): Trend => ({
    v: wholeView(f, "Articles at a negative margin", "int", f.d.negative.articles.count, f.d.negative.prevArticles?.count ?? null, {
      goodWhenUp: false, months: pairsOf(f.d.months, (m) => m.negArticles ?? 0, (m) => (m.prevRev == null ? null : m.prevNegArticles ?? null)),
    }),
    kind: "bars", note: `${eur(f.d.negative.articles.rev)} with them · each bar, that month's losses`, t: TOPIC.articles,
  }),
  named: (f: Frame, family: string | null): Trend => {
    const keys = family ? [family] : f.d.byFamily.map((x) => x.key);
    return { v: keyView(f, family ? `${family} net revenue` : "Compound revenue", f.d.familyMonths, keys), kind: "bars", note: family ? `The ${family} compounds` : "Every compound", t: TOPIC_COMPOUND };
  },
  namedMargin: (f: Frame, family: string | null): Trend => {
    const keys = family ? [family] : f.d.byFamily.map((x) => x.key);
    const ms = monthKeys(f);
    return { v: rateView(f, family ? `${family} gross margin` : "Compounds' gross margin", keyGpPairs(f.d.familyMonths, keys, ms), keyPairs(f.d.familyMonths, keys, ms)), kind: "lines", note: "Gross profit over their net revenue", t: TOPIC_COMPOUND };
  },
  compounds: (f: Frame): Trend => ({
    v: wholeView(f, "Compounds", "int", f.d.totals.compounds, f.d.totals.prev.compounds, { months: pairsOf(f.d.months, (m) => m.compounds ?? 0, (m) => (m.prevRev == null ? null : m.prevCompounds ?? null)) }),
    kind: "bars", note: "The compounds invoiced each month", t: TOPIC_COMPOUND,
  }),
  noCompound: (f: Frame): Trend => ({ v: V.noCompound(f), kind: "lines", note: "Of the net revenue - \"No info\", \"Unknown\", \"TBD\", a drawing", t: TOPIC.materials }),
  leadFamily: (f: Frame): Trend | null => {
    const x = leadFamily(f);
    return x ? { v: keyView(f, "Leading material family", f.d.familyMonths, [x.key]), kind: "bars", note: `${x.name} · ${pct(namedRev(f) > 0 ? x.rev / namedRev(f) : 0)} of compound revenue`, t: TOPIC.materials } : null;
  },
  leadCompound: (f: Frame): Trend | null => {
    const x = f.d.compounds[0];
    return x ? { v: sumView(f, "Leading compound", "eur", leaderPairs(f, "compound")), kind: "bars", note: `${x.name} · ${pct(x.margin)} gross margin`, t: TOPIC_COMPOUND } : null;
  },
  noApproval: (f: Frame): Trend => ({ v: V.noApproval(f), kind: "lines", note: "Of the net revenue, no approval written on the article", t: TOPIC.approvals }),
  noApprovalRev: (f: Frame): Trend => ({
    v: sumView(f, "Net revenue with no approval", "eur", pairsOf(f.d.months, (m) => m.noApproval, (m) => m.prevNoApproval), { goodWhenUp: false }),
    kind: "bars", note: "No approval written on the article", t: TOPIC.approvals,
  }),
  withApproval: (f: Frame): Trend => ({ v: { ...V.withApproval(f), id: "Net revenue with an approval" }, kind: "bars", note: "At least one approval written on the article", t: TOPIC.approvals }),
  approvals: (f: Frame): Trend => ({
    v: wholeView(f, "Approval texts written", "int", f.d.totals.approvals, f.d.totals.prev.approvals, { months: pairsOf(f.d.months, (m) => m.approvals ?? 0, (m) => (m.prevRev == null ? null : m.prevApprovals ?? null)) }),
    kind: "bars", note: "The different texts on the articles invoiced each month", t: TOPIC.approvals,
  }),
  rev: (f: Frame): Trend => ({ v: V.rev(f), kind: "bars", note: "Every business unit's sealing invoices", t: TOPIC.revenue }),
  gp: (f: Frame): Trend => ({ v: V.gp(f), kind: "bars", note: "Net revenue less the cost of the goods", t: TOPIC.revenue }),
  margin: (f: Frame): Trend => ({ v: V.margin(f), kind: "lines", note: "Gross profit over net revenue", t: TOPIC.revenue }),
};

/* ── the overview: Digital Growth's macro page ─────────────────────────── */

/** One grid for a panel's tiles, twelve columns: a tile takes two on a wide screen (six to a row) - as the macro page's. */
const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
const THIRD_SPAN = { gridColumn: { xs: "span 12", lg: "span 4" } };
/** A topic's charts under its tiles, two to a row - the macro page's half-width cards. */
const PAIR = { display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } } as const;

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

/* ── "From results to action": the pilot's cards ───────────────────────── */

const KIND_NAME: Record<Priority["kind"], string> = {
  margin: "Margin improvement", growth: "Growth focus", spread: "Account comparison",
  profit: "Profitability review", retain: "Retention", compare: "Next commercial review", portfolio: "Portfolio review",
  capture: "Capture", validate: "Validate", interpret: "Interpret",
};
const KIND_LOOK: Record<Priority["kind"], { icon: React.ReactNode; tint: Tint }> = {
  margin: { icon: <PercentOutlinedIcon />, tint: "pink" },
  growth: { icon: <TrendingUpOutlinedIcon />, tint: "green" },
  spread: { icon: <CompareArrowsOutlinedIcon />, tint: "purple" },
  profit: { icon: <PercentOutlinedIcon />, tint: "pink" },
  retain: { icon: <GroupsOutlinedIcon />, tint: "amber" },
  compare: { icon: <CompareArrowsOutlinedIcon />, tint: "purple" },
  portfolio: { icon: <CategoryOutlinedIcon />, tint: "blue" },
  capture: { icon: <EditNoteOutlinedIcon />, tint: "blue" },
  validate: { icon: <FactCheckOutlinedIcon />, tint: "green" },
  interpret: { icon: <InfoOutlinedIcon />, tint: "slate" },
};

/* ── the priorities' statuses: accept, refuse, in progress, done (SARCLA 11.11.2026) ── */

type Marks = Record<string, PriorityStatus | undefined>;
type MarkInfo = Record<string, { setBy: string; setAt: string } | undefined>;
type PriorityState = {
  marks: Marks; info: MarkInfo; canEdit: boolean; err: string | null;
  /** a card's new status - null: back to proposed */
  set: (p: Priority, to: PriorityStatus | null) => void;
};
const PriorityCtx = createContext<PriorityState>({ marks: {}, info: {}, canEdit: false, err: null, set: () => {} });

/** The statuses given, read once for the page; a cross-admin's change shown at once, sent, and undone if refused. */
function usePriorities(): PriorityState {
  const [marks, setMarks] = useState<Marks>({});
  const [info, setInfo] = useState<MarkInfo>({});
  const [canEdit, setCanEdit] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/ap/sealing/priorities", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; marks?: { id: string; status: PriorityStatus; setBy: string; setAt: string }[]; canEdit?: boolean };
        if (!live || !r.ok || !j.ok) return;
        setMarks(Object.fromEntries((j.marks ?? []).map((m) => [m.id, m.status])));
        setInfo(Object.fromEntries((j.marks ?? []).map((m) => [m.id, { setBy: m.setBy, setAt: m.setAt }])));
        setCanEdit(!!j.canEdit);
      })
      .catch(() => { /* no statuses: every card proposed */ });
    return () => { live = false; };
  }, []);
  const set = useCallback((p: Priority, to: PriorityStatus | null) => {
    if (!p.id) return;
    const id = p.id;
    const [kind, ...rest] = id.split("|");
    const rule = rest.pop() ?? "";
    const entity = rest.join("|");
    let before: PriorityStatus | undefined;
    setMarks((m) => { before = m[id]; return { ...m, [id]: to ?? undefined }; });
    setErr(null);
    fetch("/api/ap/sealing/priorities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, entity, rule, status: to, title: p.title }) })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; setBy?: string };
        if (!r.ok || !j.ok) throw new Error(j.error ?? `the hub answered ${r.status}`);
        setInfo((x) => ({ ...x, [id]: to ? { setBy: j.setBy ?? "", setAt: new Date().toISOString() } : undefined }));
      })
      .catch((e) => { setMarks((m) => ({ ...m, [id]: before })); setErr(String((e as Error)?.message ?? e)); });
  }, []);
  return { marks, info, canEdit, err, set };
}

const STATUS_TINT: Record<PriorityStatus, Tint> = { accepted: "blue", in_progress: "amber", done: "green", refused: "slate" };
/** What a cross-admin can do with a card, by its status (sealingRules nextStatuses), in words. */
const MOVE_WORD = (from: PriorityStatus | null, to: PriorityStatus | null): string =>
  to === null ? (from === "refused" ? "Bring back" : "Back to proposed") : to === "accepted" ? (from ? "Back to accepted" : "Accept")
    : to === "in_progress" ? (from === "done" ? "Reopen" : "Start") : to === "done" ? "Done" : "Refuse";

function StatusChip({ s, by }: { s: PriorityStatus; by?: string }) {
  return (
    <Chip size="small" label={`${STATUS_NAME[s]}${by ? ` · ${by}` : ""}`}
      sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: TINT[STATUS_TINT[s]].bg, color: TINT[STATUS_TINT[s]].fg, maxWidth: "100%" }} />
  );
}

/** The moves a cross-admin may make on a card - none for anybody else. */
function Moves({ p, s }: { p: Priority; s: PriorityStatus | null }) {
  const st = useContext(PriorityCtx);
  if (!st.canEdit || !p.id) return null;
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      {nextStatuses(s).map((to) => (
        <Button key={String(to)} size="small" variant={to === "accepted" && !s ? "contained" : "outlined"} disableElevation onClick={() => st.set(p, to)}
          color={to === "refused" ? "inherit" : "primary"}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "9px", py: 0.2, px: 1.25, minWidth: 0, fontSize: "0.76rem" }}>
          {MOVE_WORD(s, to)}
        </Button>
      ))}
    </Box>
  );
}

/** A card, drawn as a tile of the macro page: its badge, what it is, its status, the evidence, the next move, the effect, its owner. */
function ActionCard({ p, i, onInspect }: { p: Priority; i: number; onInspect?: (compound: string) => void }) {
  const st = useContext(PriorityCtx);
  const look = KIND_LOOK[p.kind];
  const s = p.id ? st.marks[p.id] ?? null : null;
  const effect = p.effect ? `${p.effectLabel}: ${eur(p.effect)} gross profit` : p.effectLabel;
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "flex", flexDirection: "column", gap: 1.1, minWidth: 0, boxShadow: s && s !== "refused" ? `inset 0 0 0 1.5px ${TINT[STATUS_TINT[s]].fg}` : undefined }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0 }}>
        <Badge icon={look.icon} tint={look.tint} size={32} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>{String(i + 1).padStart(2, "0")} · {KIND_NAME[p.kind]}</Typography>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em", lineHeight: 1.3 }}>{p.title}</Typography>
        </Box>
      </Box>
      {s && <Box><StatusChip s={s} by={p.id ? st.info[p.id]?.setBy : undefined} /></Box>}
      <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.5 }}>{p.evidence}</Typography>
      {p.next && <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.5 }}><b>Next move.</b> {p.next}</Typography>}
      {p.compound && onInspect && (
        <Button size="small" onClick={() => onInspect(p.compound)} endIcon={<ChevronRightIcon />}
          sx={{ textTransform: "none", fontWeight: 700, alignSelf: "flex-start", px: 0, minWidth: 0 }}>
          Inspect {cut(p.compound, 36)} and its customers
        </Button>
      )}
      {/* the effect, the owner and the moves at the card's foot - level across the row */}
      <Box sx={{ mt: "auto", display: "grid", gap: 1 }}>
        {(effect || p.owner) && (
          <Box sx={{ borderTop: "1px solid rgba(21,34,58,.07)", pt: 0.75, display: "grid", gap: 0.25 }}>
            {effect && <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: FAINT }}>{effect}</Typography>}
            {p.owner && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>Suggested owner: {p.owner}</Typography>}
          </Box>
        )}
        <Moves p={p} s={s} />
      </Box>
    </Box>
  );
}

function ActionGrid({ items, onInspect }: { items: Priority[]; onInspect?: (compound: string) => void }) {
  return (
    <Box sx={GRID}>
      {items.map((p, i) => <Box key={p.id ?? `${p.kind}-${i}`} sx={{ minWidth: 0, display: "grid", ...THIRD_SPAN }}><ActionCard p={p} i={i} onInspect={onInspect} /></Box>)}
    </Box>
  );
}

/** The refused or the done cards of a block, one line each, with the way back. */
function SetAside({ title, cards }: { title: string; cards: Priority[] }) {
  const st = useContext(PriorityCtx);
  if (!cards.length) return null;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</Typography>
      {cards.map((p) => {
        const s = p.id ? st.marks[p.id] ?? null : null;
        return (
          <Box key={p.id} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", px: 1.25, py: 0.75, borderRadius: "12px", bgcolor: "#f4f6fa" }}>
            {s && <StatusChip s={s} by={p.id ? st.info[p.id]?.setBy : undefined} />}
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, flex: 1, minWidth: 200 }}>{p.title}</Typography>
            <Moves p={p} s={s} />
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * The pilot's "From results to action" (revision.js actionCards: "Commercial priorities", "Evidence · action ·
 * opportunity"; the approvals' index.html insights: "What should we do?", "Evidence → recommendation") - its cards under
 * the caption, the last of the pilot's sections on a page. Three open at a time from the ranked cards the figures hold:
 * a cross-admin accepts or refuses each - a refused one leaves and the next comes in - and moves an accepted one on (in
 * progress, done); the refused and the done ones listed under, with the way back. Anybody else sees the statuses.
 */
function Actions({ items, title, first = false, empty }: { items: Priority[]; title: string; first?: boolean; empty?: string }) {
  const inspect = useContext(InspectCtx);
  const st = useContext(PriorityCtx);
  const [aside, setAside] = useState<"refused" | "done" | null>(null);
  if (!items.length && !empty) return null;
  const { shown, refused, done, waiting } = openCards(items, st.marks, 3);
  const flip = (k: "refused" | "done") => setAside((x) => (x === k ? null : k));
  const toggle = (k: "refused" | "done", n: number) => (n ? (
    <Button size="small" onClick={() => flip(k)} aria-expanded={aside === k} sx={{ textTransform: "none", fontWeight: 700, minWidth: 0 }}>
      {k === "refused" ? "Refused" : "Done"} ({n}) {aside === k ? "▴" : "▾"}
    </Button>
  ) : null);
  return (
    <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={<LightbulbOutlinedIcon />} tint="amber" title={title}
        note={`From results to action · ${first ? "evidence → recommendation" : "evidence · action · opportunity"}${waiting ? ` · ${int(waiting)} more waiting` : ""}`}
        right={refused.length || done.length ? <Box sx={{ display: "flex", gap: 0.5 }}>{toggle("done", done.length)}{toggle("refused", refused.length)}</Box> : undefined} />
      <Box sx={{ mt: -1, display: "grid", gap: 1.5 }}>
        {shown.length
          ? <ActionGrid items={shown} onInspect={(c) => inspect(compoundPick(c))} />
          : <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{items.length ? "Every card here is done or refused - the lists on the right hold them." : empty}</Typography>}
        {aside === "refused" && <SetAside title="Refused - bring one back" cards={refused} />}
        {aside === "done" && <SetAside title="Done - reopen one" cards={done} />}
        {st.err && <Typography sx={{ fontSize: "0.8rem", color: RED }}>The status could not be kept: {st.err}</Typography>}
      </Box>
    </GlassCard>
  );
}

/** A section's heading between the cards (the pilot's "The business at a glance" and its hint on the right). */
function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mt: 0.5 }}>
      <Typography component="h2" sx={{ fontSize: "1.2rem", fontWeight: 650, color: INK, letterSpacing: "-0.02em" }}>{title}</Typography>
      {hint && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{hint}</Typography>}
    </Box>
  );
}

/** "Explore all", "Inspect" - the pilot's way from a panel to its view. */
function MoreLink({ href, children = "Explore all" }: { href: string; children?: React.ReactNode }) {
  return (
    <Box component={Link} href={href} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, fontSize: "0.8rem", fontWeight: 700, color: TINT.blue.fg, textDecoration: "none", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>
      {children}<ChevronRightIcon sx={{ fontSize: 18 }} />
    </Box>
  );
}

/**
 * The pilot's Overview (revision.js overview), in its order: "Understand the business." - its four cards, "Where does
 * revenue come from?" and "Which materials sell most?", "From results to action" (the commercial priorities), "The
 * business at a glance" (who buys from us, which compounds lead, what sells most, which approvals matter) - and no more
 * (SARCLA 11.11.2026, of the topics against a year earlier under them: "I don't like it any more on the overview").
 */
function Overview({ f, busy, err, again }: { f: Frame; busy: boolean; err: string | null; again: () => void }) {
  const [win, setWin] = useState<Win>(null);
  const [pick, setPick] = useState<DetailPick | null>(null);
  const router = useRouter();
  const inspect = useCallback((p: DetailPick) => { setWin(null); setPick(p); }, []);
  const open = (w: Win) => { setPick(null); setWin((x) => (x === w ? null : w)); };
  const pri = usePriorities();
  const custRows = rowsOf(f.d.customers), artRows = rowsOf(f.d.articles), compRows = rowsOf(f.d.compounds);
  return (
    <PriorityCtx.Provider value={pri}>
    <InspectCtx.Provider value={inspect}>
      {/* the macro page's frame: the full width, the sections one under the other (marketing-kpis/page.tsx) */}
      <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
        <Box sx={{ display: "grid", gap: 1.75, minWidth: 0 }}>
          <Head f={f} kicker="Sealing Business Review · Executive Committee pilot" title="Understand the business." lead="Who buys. What sells. Where to focus next." busy={busy} />
          {/* the Filters where every Advanced report has them: under the head, at the right end (SARCLA 14.11.2026) */}
          <FiltersRow f={f} open={win === "filters"} onFilters={() => open("filters")} />
        </Box>
        <Trouble err={err} again={again} />
        <Box sx={{ display: "grid", gap: 2.5, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)", opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }} aria-busy={busy}>
          {/* 1 · the pilot's cards: the largest customer account, the leading material family and compound, the largest article */}
          <TrendCards f={f} four items={[TR.largestCustomer(f), TR.leadFamily(f), TR.leadCompound(f), TR.largestArticle(f)]} />
          {/* 2 · where revenue comes from, which materials sell most */}
          <Box sx={PAIR}>
            <BuMix f={f} title="Where does revenue come from?" hint="Click an organisation to explore its customer accounts"
              onPick={(k) => router.push(hrefOf("customers", plus(f.carry, "bu", k)))} />
            <FamilyMix f={f} onPick={(x) => router.push(hrefOf("materials", f.carry, "compounds", { family: x }))} hint="Click a family to open its compounds" />
          </Box>
          {/* 3 · from results to action */}
          <Actions items={overviewCards(f)} title="Commercial priorities" empty="Nothing in these months with these filters meets the thresholds of a priority." />
          {/* 4 · the business at a glance */}
          <SectionHead title="The business at a glance" hint="Click a name to explore the relationship" />
          <Box sx={PAIR}>
            <Ranked title="Who buys from us?" hint={`Top 5 of ${int(f.d.totals.customers)} customer accounts`} rows={custRows} by="rev" n={5}
              nameHead="Customer" onPick={(r) => inspect(pickOf("customer", r))} labelWidth={200} right={<MoreLink href={hrefOf("customers", f.carry)} />} />
            <Ranked title="Which compounds lead?" hint="Top 5 compounds" rows={compRows} by="rev" n={5}
              nameHead="Compound" onPick={(r) => inspect(pickOf("compound", r))} labelWidth={200} right={<MoreLink href={hrefOf("materials", f.carry)} />} />
            <Ranked title="What sells most?" hint={`Top 5 of ${int(f.d.totals.articles)} articles`} rows={artRows} by="rev" n={5}
              nameHead="Article" onPick={(r) => inspect(pickOf("article", r))} labelWidth={200} right={<MoreLink href={hrefOf("articles", f.carry)} />} />
            <ApprovalShare f={f} href={hrefOf("approvals", f.carry)} />
          </Box>
        </Box>
        <Foot onDefinitions={() => open("definitions")} />
        <FilterWindow f={f} open={win === "filters"} onClose={() => setWin(null)} />
        <Definitions f={f} open={win === "definitions"} onClose={() => setWin(null)} />
        <DetailWindow f={f} pick={pick} onClose={() => setPick(null)} />
      </Box>
    </InspectCtx.Provider>
    </PriorityCtx.Provider>
  );
}

/* ── the header: the title, what is shown, the choice as chips ─────────── */

const H1 = { fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 } as const;

const against = (f: Frame) => (f.prevKnown === "all" ? `against ${f.before}` : f.prevKnown === "part" ? `against ${f.before} - the figures begin ${monthWords(f.min)}` : "no figures a year earlier");

function Line({ f, busy }: { f: Frame; busy: boolean }) {
  return (
    <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
      {/* what is shown, as Who are our customers says it - the filters are the chips under it */}
      <b style={{ color: INK }}>{f.now}</b> {against(f)} · {f.bus.length || f.orgs.length ? "the units and organisations chosen · " : ""}in EUR · figures up to {f.upToDay}{busy ? " · reading again" : ""}
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

/**
 * The row under a page's head: its tabs, and at the right end the Filters button - as Who are our customers, Visit and
 * Engage place it (SARCLA 14.11.2026: "Filters button is not at the correct location"); on a phone the button goes below.
 */
function FiltersRow({ f, open, onFilters, children }: { f: Frame; open: boolean; onFilters: () => void; children?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
      {children ? <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>{children}</Box> : null}
      <Box sx={{ flex: 1 }} />
      <FiltersButton f={f} open={open} onClick={onFilters} />
    </Box>
  );
}

/** The window open over a page besides the detail: the Filters, or the pilot's definitions. */
type Win = "filters" | "definitions" | null;

/** Above a title: whose review it is (the pilot's "Executive committee · Pilot 01"). */
const KICKER = { fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em" } as const;
/** Under a title: what the view is for (the pilot's "Who buys. What sells. Where to focus next."). */
const LEAD = { fontSize: "0.98rem", color: INK, lineHeight: 1.45 } as const;

/** The overview's head: the pilot's eyebrow, title and line, the period, the chips. */
function Head({ f, kicker, title, lead, busy }: { f: Frame; kicker?: string; title: string; lead?: string; busy: boolean }) {
  return (
    <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
      {kicker && <Typography sx={KICKER}>{kicker}</Typography>}
      <Typography component="h1" sx={H1}>{title}</Typography>
      {lead && <Typography sx={LEAD}>{lead}</Typography>}
      <Line f={f} busy={busy} />
      <Chosen f={f} />
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

/** The pilot's "Definitions & source notes" - a window as the Filters open, the hub's figures in the pilot's sections. */
function Definitions({ f, open, onClose }: { f: Frame; open: boolean; onClose: () => void }) {
  const m = f.d.meta;
  const file = m.file ? m.file.split(/[\\/]/).pop() : null;
  const read = m.loadedAt ? new Date(m.loadedAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  // where the figures come from - the line that stood at every page's foot, kept here (SARCLA 11.11.2026)
  const source = [
    "The ERP's BI model - every business unit's sealing invoices (profit centre DT), net revenue and gross profit in EUR",
    file ? `read from ${file}${m.sheet ? `, sheet "${m.sheet}"` : ""}` : null,
    read ? `loaded ${read}` : null,
    `invoices from ${monthWords(f.min)} up to ${monthWords(f.max)}`,
  ].filter(Boolean).join(" · ") + ". Selections overlap: totals across views are not additive.";
  const sections = [{ title: "Source", text: source }, ...SEALING_DEFINITIONS];
  return (
    <FilterPanel id="sealing-definitions" open={open} onClose={onClose} title="Definitions & source notes" icon={<InfoOutlinedIcon />} tint="slate" width={520}
      closeLabel="Close the definitions" subtitle="About this review - how its figures are read">
      <Box sx={{ display: "grid", gap: 0, px: 1, py: 0.5 }}>
        {sections.map((x, i) => (
          <Box key={x.title} sx={{ py: 1.4, borderTop: i ? `1px solid ${HAIRLINE}` : "none" }}>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 0.4 }}>{x.title}</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.55 }}>{x.text}</Typography>
          </Box>
        ))}
      </Box>
    </FilterPanel>
  );
}

/** The foot of a page: the pilot's "Definitions & source notes" - the source and the notes live in its window. */
function Foot({ onDefinitions }: { onDefinitions: () => void }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={onDefinitions} aria-controls="sealing-definitions"
        sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}>
        Definitions &amp; source notes
      </Button>
    </Box>
  );
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

/* ── the detail window: the pilot's drawer ─────────────────────────────── */

const PICK_LOOK: Record<DetailPick["kind"], { title: string; icon: React.ReactNode; tint: Tint; rows: string; rowHead: string }> = {
  customer: { title: "Customer account", icon: <GroupsOutlinedIcon />, tint: "green", rows: "Articles purchased", rowHead: "Article" },
  article: { title: "Article", icon: <InventoryOutlinedIcon />, tint: "pink", rows: "Customer exposure", rowHead: "Customer" },
  compound: { title: "Compound", icon: <ScienceOutlinedIcon />, tint: "purple", rows: "Available customer breakdown", rowHead: "Customer" },
  approval: { title: "Approval as written", icon: <VerifiedOutlinedIcon />, tint: "slate", rows: "", rowHead: "" },
};

/** A ranking's row as what a click opens. */
const pickOf = (kind: DetailPick["kind"], r: Row): DetailPick => ({ kind, key: r.key, name: r.label, rev: r.rev, gp: r.gp, margin: r.margin });
/** A compound named by a card - its figures arrive with the detail. */
const compoundPick = (name: string): DetailPick => ({ kind: "compound", key: name, name, rev: 0, gp: 0, margin: 0 });

/** A customer's articles, an article's or a compound's customers, an approval text - over the page, as the Filters window opens. */
function DetailWindow({ f, pick, onClose }: { f: Frame; pick: DetailPick | null; onClose: () => void }) {
  const read = useDetail(pick, f.ask);
  // the detail of the one picked - never the one before it, for the moment the next is asked
  const d = read.d && pick && read.d.kind === pick.kind && read.d.key === pick.key.trim().slice(0, 200) ? read.d : null;
  const { err, busy } = read;
  const look = PICK_LOOK[pick?.kind ?? "customer"];
  const head = d ? { name: d.name, rev: d.rev, gp: d.gp, margin: d.margin } : pick;
  const rows = d?.rows ?? [];
  const dup = new Map<string, number>();
  for (const r of rows) dup.set(r.name || NOT_KNOWN, (dup.get(r.name || NOT_KNOWN) ?? 0) + 1);
  const labelOf = (r: DetailRow) => { const n = r.name || NOT_KNOWN; return (dup.get(n) ?? 0) > 1 ? `${n} · ${r.key || "-"}` : n; };
  const kindName = pick?.kind === "approval" ? APPROVAL_KINDS.find((k) => k.key === approvalKind(pick.key))?.name ?? "" : "";
  const sub = !pick ? "" : pick.kind === "customer" ? `Account ${pick.key || "—"}${d?.bus.length ? ` · ${d.bus.join(", ")}` : ""}`
    : pick.kind === "article" ? `Article ${pick.key || "—"}${d?.compounds.length ? ` · compound ${d.compounds.join(", ")}` : ""}`
      : pick.kind === "compound" ? `${noCompound(pick.key) ? "No compound" : `${materialOf(pick.key)} family`}${d ? ` · ${int(d.count)} customer${d.count === 1 ? "" : "s"}` : ""}`
        : kindName;
  const cards: [string, string, boolean][] = head ? [["Net revenue", eur(head.rev), false], ["Gross profit", eur(head.gp), head.gp < 0], ["Gross margin", pct(head.margin), head.margin < 0]] : [];
  return (
    <FilterPanel id="sealing-detail" open={!!pick} onClose={onClose} title={look.title} icon={look.icon} tint={look.tint} width={580} closeLabel="Close the detail"
      subtitle={sub} foot={`${f.now} · the page's period and filters · the margin of the sums`}>
      {pick && (
        <Box sx={{ display: "grid", gap: 1.75, px: 1, py: 0.75 }}>
          <Typography sx={{ fontSize: "1.08rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em", lineHeight: 1.3, overflowWrap: "anywhere" }}>
            {pick.kind === "approval" ? cut(pick.name, 140) : head?.name || pick.name || NOT_KNOWN}
          </Typography>
          {head && (head.rev || pick.kind !== "compound" || d) ? (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1 }}>
              {cards.map(([l, v, bad]) => (
                <Box key={l} sx={{ ...glass, borderRadius: "14px", px: 1.25, py: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.7rem", color: MUTED, fontWeight: 600 }}>{l}</Typography>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: bad ? RED : INK, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{v}</Typography>
                </Box>
              ))}
            </Box>
          ) : null}
          {pick.kind === "approval" ? (
            <>
              <Box sx={{ bgcolor: "#f4f6fa", borderRadius: "12px", px: 1.5, py: 1.1 }}>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 }}>
                  What the text says: <b style={{ color: INK }}>{kindName}</b> - read from its words, not a checked certificate
                </Typography>
              </Box>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>The approvals it names · {int(approvalParts(pick.key).length)}</Typography>
              {/* the text read as its references, every one of them - never the run-on text (SARCLA 13.11.2026) */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6 }}>
                {approvalParts(pick.key).map((x) => (
                  <Box key={x} component="span" sx={{ fontSize: "0.78rem", fontWeight: 600, color: INK, bgcolor: "#eef2f8", border: `1px solid ${HAIRLINE}`, px: 0.9, borderRadius: "8px", lineHeight: 1.8 }}>{x}</Box>
                ))}
              </Box>
            </>
          ) : busy ? (
            <Skeletons n={5} h={26} />
          ) : err ? (
            <Typography sx={{ fontSize: "0.84rem", color: RED }}>The detail could not be read: {err}</Typography>
          ) : d ? (
            <>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>
                {look.rows}{d.count > rows.length ? ` · the ${int(rows.length)} largest of ${int(d.count)}` : ""}
              </Typography>
              {rows.length ? (
                <BarList ranked rows={rows.map((r) => ({
                  label: labelOf(r), value: r.rev, secondary: r.bus || undefined,
                  color: r.margin < 0 ? DELTA.bad : undefined, note: { text: pct(r.margin), color: r.margin < 0 ? DELTA.bad : DELTA.good },
                }))} heads={{ label: look.rowHead, value: "Net revenue", note: "Gross margin" }} format={eur} labelWidth={170} maxLabel={28} />
              ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing in these months with these filters.</Typography>}
            </>
          ) : null}
        </Box>
      )}
    </FilterPanel>
  );
}

/* ── a breakdown's rows ────────────────────────────────────────────────── */

type Row = { label: string; full?: string; key: string; rev: number; gp: number; margin: number; prev: number; prevGp: number; compound?: string };

/** The figures as rows - a name twice (two customers of the same name) carries its number. */
function rowsOf(a: (Figure & { compound?: string })[], shown: (name: string) => string = cleanName): Row[] {
  const count = (labels: string[]) => { const n = new Map<string, number>(); for (const l of labels) n.set(l, (n.get(l) ?? 0) + 1); return n; };
  const full = a.map((x) => cleanName(x.name || NOT_KNOWN) || NOT_KNOWN);
  // the short form where it stays one of a kind, else the whole name ("A+P" twice: "Angst+Pfister AG", "Angst+Pfister S.A.")
  const short = a.map((x, i) => shown(x.name || NOT_KNOWN) || full[i]);
  const n1 = count(short);
  const first = short.map((l, i) => ((n1.get(l) ?? 0) > 1 ? full[i] : l));
  // two of the same name even in full (two customer numbers): the number beside it
  const n2 = count(first);
  return a.map((x, i) => ({
    label: (n2.get(first[i]) ?? 0) > 1 ? `${first[i]} · ${x.key || "-"}` : first[i],
    full: full[i], key: x.key, rev: x.rev, gp: x.gp, margin: x.margin, prev: x.prev ?? 0, prevGp: x.prevGp ?? 0, compound: x.compound,
  }));
}
const prevMargin = (r: Row) => (r.prev ? r.prevGp / r.prev : null);
/** The rows summed - the margin of the sums, never an average of margins. */
function totalOf(rows: Row[], label: string): Row {
  const s = rows.reduce((t, r) => ({ rev: t.rev + r.rev, gp: t.gp + r.gp, prev: t.prev + r.prev, prevGp: t.prevGp + r.prevGp }), { rev: 0, gp: 0, prev: 0, prevGp: 0 });
  return { label, key: "", ...s, margin: s.rev ? s.gp / s.rev : 0 };
}
const revNote = (r: Row) => (r.prev ? { text: signedPct(r.rev / r.prev - 1), color: tone(r.rev / r.prev - 1) } : r.rev > 0 ? { text: "new", color: GREEN } : null);
const gpNote = (r: Row) => (r.prevGp > 0 && r.gp >= 0 ? { text: signedPct(r.gp / r.prevGp - 1), color: tone(r.gp / r.prevGp - 1) } : !r.prev && r.gp > 0 ? { text: "new", color: GREEN } : null);
const marginNote = (r: Row) => { const p = prevMargin(r); return p == null ? null : { text: points(r.margin, p), color: tone(r.margin - p) }; };

/* ── the drill-down's parts: the pilot's charts, then the hub's (Customers.tsx, Reach.tsx) ── */

/**
 * A chart's own box - DimChart's look, for the charts that are not DimCharts: its title and line with the Chart / Table
 * switch on the same row (ChartFrame - no band of its own), the chart, and a note held at the foot so that two boxes
 * side by side end level (SARCLA 11.11.2026: "proportions are not good").
 */
function ChartBox({ title, hint, right, table, foot, children }: {
  title: string; hint?: string; right?: React.ReactNode; table?: TableTwin; foot?: React.ReactNode; children: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
      {/* the title and its line on the left, the way on and the Chart / Table switch on the right - one row (ChartFrame's switch) */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>{title}</Typography>
          {hint && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>{hint}</Typography>}
        </Box>
        {(right || table) && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            {right}
            {table && (
              <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v: "chart" | "table" | null) => v && setView(v)} aria-label="Chart or table view"
                sx={{ "& .MuiToggleButton-root": { px: 1.25, py: 0.35, fontSize: "0.74rem" } }}>
                <ToggleButton value="chart">Chart</ToggleButton>
                <ToggleButton value="table">Table</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>
        )}
      </Box>
      {view === "table" && table ? (
        <Box sx={{ overflowX: "auto", border: `1px solid ${HAIRLINE}`, borderRadius: 2 }}>
          <MuiTable size="small">
            <TableHead><TableRow>{table.columns.map((c, i) => <TableCell key={c} align={table.numeric?.includes(i) ? "right" : "left"}>{c}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {table.rows.map((r, ri) => (
                <TableRow key={ri}>
                  {r.map((cell, ci) => <TableCell key={ci} align={table.numeric?.includes(ci) ? "right" : "left"} sx={table.numeric?.includes(ci) ? { fontVariantNumeric: "tabular-nums" } : undefined}>{cell}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </MuiTable>
        </Box>
      ) : (
        // the chart in the middle of the room the box has - two boxes side by side are as tall as the taller
        <Box sx={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>{children}</Box>
      )}
      {foot && <Typography component="div" sx={{ fontSize: "0.74rem", color: FAINT, mt: "auto", pt: 0.5, lineHeight: 1.5 }}>{foot}</Typography>}
    </Box>
  );
}
/** Grey placeholders the shape of what is coming - a section shows as soon as its data is there (SARCLA 13.11.2026). */
function Skeletons({ n = 3, h = 28 }: { n?: number; h?: number }) {
  return <Box sx={{ display: "grid", gap: 1 }}>{Array.from({ length: n }, (_, i) => <Skeleton key={i} variant="rounded" height={h} />)}</Box>;
}
const NONE = (what = "No invoice in these months with these filters.") => <Typography sx={{ fontSize: "0.85rem", color: MUTED, py: 2 }}>{what}</Typography>;

/* the pilot's charts, drawn by the hub's kit */

/** What a ranking ranks by - the pilot's "Rank by revenue / gross profit". */
type By = RankBy;
/** How many a ranking shows - the pilot's "Top 10 / 20 / 30 / All entries" (0: all, 30 a page). */
const TOPS = [10, 20, 30, 0];

/** A view's ranking choices - the pilot's search, rank by and how many (index.html go: revenue, the first 10) - and the page of "All". */
type RankState = { q: string; setQ: (q: string) => void; by: By; setBy: (b: By) => void; n: number; setN: (n: number) => void; offset: number; setOffset: (o: number) => void };
function useRanking(initial = ""): RankState {
  const [q, setQ] = useState(initial);
  const [by, setBy] = useState<By>("rev");
  const [n, setN] = useState(10);
  const [offset, setOffset] = useState(0);
  return { q, setQ, by, setBy, n, setN, offset, setOffset };
}

type ListState = { rows: Row[]; total: number; busy: boolean; err: string | null };

/**
 * One page of a whole list from the hub (/api/ap/sealing/list): every customer, article, compound or approval of the
 * page's period and filters, ranked as asked, the search waiting for the typing to pause.
 */
function useList(f: Frame, o: { kind: ListKind; by: By; q: string; offset: number; limit: number; family?: string | null; unresolved?: boolean; bu?: string; meaning?: boolean }): ListState {
  const [s, setS] = useState<ListState>({ rows: [], total: 0, busy: true, err: null });
  const [q, setQ] = useState(o.q);
  useEffect(() => { const t = setTimeout(() => setQ(o.q), 300); return () => clearTimeout(t); }, [o.q]);
  const ask = useMemo(() => {
    const p = new URLSearchParams(f.ask);
    p.set("kind", o.kind); p.set("by", o.by); p.set("offset", String(o.offset)); p.set("limit", String(o.limit));
    if (q.trim()) p.set("q", q.trim());
    if (o.family) p.set("family", o.family);
    if (o.unresolved) p.set("unresolved", "1");
    // the approval texts gathered by what they mean - a chart never lists the same meaning twice (SARCLA 14.11.2026)
    if (o.meaning) p.set("meaning", "1");
    // one business unit in place of the page's (Customers by unit)
    if (o.bu) { p.delete("bu"); p.append("bu", o.bu); }
    return p.toString();
  }, [f.ask, o.kind, o.by, o.offset, o.limit, o.family, o.unresolved, o.bu, o.meaning, q]);
  useEffect(() => {
    let live = true;
    setS((x) => ({ ...x, busy: true, err: null }));
    fetch(`/api/ap/sealing/list?${ask}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; list?: { total: number; rows: (Figure & { compound: string })[] } };
        if (!live) return;
        if (!r.ok || !j.ok || !j.list) setS((x) => ({ ...x, busy: false, err: j.error ?? `the hub answered ${r.status}` }));
        else setS({ rows: rowsOf(j.list.rows, o.kind === "approval" ? approvalLabel : cleanName), total: j.list.total, busy: false, err: null });
      })
      .catch((e) => { if (live) setS((x) => ({ ...x, busy: false, err: String((e as Error)?.message ?? e) })); });
    return () => { live = false; };
  }, [ask]);
  return s;
}

/** The pages of a whole list: where this one starts and ends, how many in all, the page before and after. */
function Pager({ total, offset, onOffset, size = LIST_PAGE }: { total: number; offset: number; onOffset: (o: number) => void; size?: number }) {
  const { pages, page } = pagesOf(total, offset, size);
  if (pages <= 1) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, justifyContent: "flex-end", flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
        {int(offset + 1)}–{int(Math.min(total, offset + size))} of {int(total)} · page {int(page + 1)} of {int(pages)}
      </Typography>
      <IconButton size="small" disabled={page === 0} onClick={() => onOffset(0)} aria-label="The first page"><FirstPageIcon fontSize="small" /></IconButton>
      <IconButton size="small" disabled={page === 0} onClick={() => onOffset(Math.max(0, offset - size))} aria-label="The page before"><ChevronLeftIcon fontSize="small" /></IconButton>
      <IconButton size="small" disabled={page >= pages - 1} onClick={() => onOffset(offset + size)} aria-label="The page after"><ChevronRightIcon fontSize="small" /></IconButton>
      <IconButton size="small" disabled={page >= pages - 1} onClick={() => onOffset((pages - 1) * size)} aria-label="The last page"><LastPageIcon fontSize="small" /></IconButton>
    </Box>
  );
}

/** The search box of a ranking or a list. */
function SearchBox({ what, q, onQ, width = 260 }: { what: string; q: string; onQ: (q: string) => void; width?: number }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 34, flex: `0 1 ${width}px`, minWidth: 180, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
      <SearchIcon sx={{ fontSize: 17, color: MUTED }} />
      <InputBase value={q} onChange={(e) => onQ(e.target.value)} placeholder={`Search ${what}…`} inputProps={{ "aria-label": `Search ${what}` }} sx={{ fontSize: "0.84rem", flex: 1 }} />
    </Box>
  );
}

/**
 * The pilot's controls (index.html controls), right above the ranking they drive (SARCLA 11.11.2026: "the search bar on
 * top doesn't make sense since the customers come after"): the search over names and identifiers, rank by net revenue
 * or gross profit, the first 10, 20, 30 or all of them - the business unit is the Filters'.
 */
function Controls({ what, st, count, children }: { what: string; st: RankState; count: number; children?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBox what={what} q={st.q} onQ={(x) => { st.setQ(x); st.setOffset(0); }} />
      <ToggleButtonGroup size="small" exclusive value={st.by} onChange={(_, v: By | null) => { if (v) { st.setBy(v); st.setOffset(0); } }} aria-label="Rank by" sx={TOGGLE}>
        <ToggleButton value="rev">Rank by net revenue</ToggleButton>
        <ToggleButton value="gp">Rank by gross profit</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup size="small" exclusive value={st.n} onChange={(_, v: number | null) => { if (v != null) { st.setN(v); st.setOffset(0); } }} aria-label="Number of results" sx={TOGGLE}>
        {TOPS.filter((t) => t <= 10 || t < count).map((t) => <ToggleButton key={t} value={t}>{t ? `Top ${t}` : `All ${int(count)}`}</ToggleButton>)}
      </ToggleButtonGroup>
      {children}
    </Box>
  );
}

const rankRow = (by: By) => (r: Row) => ({
  label: r.label, value: by === "gp" ? r.gp : r.rev, color: r.margin < 0 ? DELTA.bad : undefined,
  note: { text: pct(r.margin), color: r.margin < 0 ? DELTA.bad : DELTA.good },
});

/**
 * The overview's rankings ("Who buys from us?", "Which compounds lead?", "What sells most?"): the first five by net
 * revenue - the rank, the name, its bar, the figure and the gross margin beside it, a loss in red; a click opens it.
 */
function Ranked({ title, hint, rows, by, n, nameHead, onPick, labelWidth = 220, right }: {
  title: string; hint?: string; rows: Row[]; by: By; n: number; nameHead: string;
  onPick?: (r: Row) => void; labelWidth?: number; right?: React.ReactNode;
}) {
  const shown = rankBy(rows, by, n);
  const byLabel = new Map(shown.map((r) => [r.label, r]));
  return (
    <ChartBox title={title} hint={hint} right={right}
      table={{ columns: ["Rank", nameHead, "Net revenue", "Gross profit", "Gross margin"], rows: shown.map((r, i) => [i + 1, r.label, Math.round(r.rev), Math.round(r.gp), pct(r.margin)]), numeric: [0, 2, 3, 4] }}>
      {shown.length ? (
        <BarList ranked wrapLabels format={eur} labelWidth={labelWidth} maxLabel={Math.max(18, Math.round(labelWidth / 6.6))}
          heads={{ label: nameHead, value: by === "gp" ? "Gross profit" : "Net revenue", note: "GM %" }}
          rows={shown.map(rankRow(by))} onSelect={onPick ? (l) => { const r = byLabel.get(l); if (r) onPick(r); } : undefined} />
      ) : NONE("No records match this selection.")}
    </ChartBox>
  );
}

/**
 * A view's ranking (index.html chart): its controls right above it, then the ranks - from the hub's whole list, so a
 * ranking by gross profit and "All" reach every one of them, 30 a page (SARCLA 11.11.2026: "pagination at 30 when
 * All"); a click opens what the name is made of.
 */
function RankedList({ f, kind, title, hint, what, nameHead, st, onPick, labelWidth = 280, family, unresolved, extra, foot }: {
  f: Frame; kind: ListKind; title: string; hint?: string; what: string; nameHead: string; st: RankState; onPick?: (r: Row) => void;
  labelWidth?: number; family?: string | null; unresolved?: boolean; extra?: React.ReactNode; foot?: React.ReactNode;
}) {
  const all = st.n === 0;
  const list = useList(f, { kind, by: st.by, q: st.q, offset: all ? st.offset : 0, limit: all ? LIST_PAGE : st.n, family, unresolved, meaning: kind === "approval" });
  const byLabel = new Map(list.rows.map((r) => [r.label, r]));
  return (
    <ChartBox title={title} hint={hint} foot={foot}>
      <Controls what={what} st={st} count={list.total}>{extra}</Controls>
      <Box sx={{ opacity: list.busy ? 0.55 : 1, transition: "opacity .15s ease", mt: 0.5 }}>
        {list.err ? <Typography sx={{ fontSize: "0.84rem", color: RED }}>The ranking could not be read: {list.err}</Typography>
          : list.rows.length ? (
            <BarList ranked wrapLabels rankFrom={(all ? st.offset : 0) + 1} format={eur} labelWidth={labelWidth} maxLabel={Math.max(18, Math.round(labelWidth / 6.6))}
              heads={{ label: nameHead, value: st.by === "gp" ? "Gross profit" : "Net revenue", note: "GM %" }}
              rows={list.rows.map(rankRow(st.by))} onSelect={onPick ? (l) => { const r = byLabel.get(l); if (r) onPick(r); } : undefined} />
          ) : list.busy ? <Skeletons n={Math.min(10, st.n || 10)} h={24} /> : NONE("No records match this selection.")}
      </Box>
      {all && <Pager total={list.total} offset={st.offset} onOffset={st.setOffset} />}
    </ChartBox>
  );
}

/** The pilot's "Scale & profitability": the first ten of the ranking as bubbles - across their margin, up their revenue. */
function Scale({ f, kind, st, what, onPick, family }: { f: Frame; kind: ListKind; st: RankState; what: string; onPick?: (r: Row) => void; family?: string | null }) {
  const list = useList(f, { kind, by: st.by, q: st.q, offset: 0, limit: 10, family });
  const top = list.rows;
  const byLabel = new Map(top.map((r) => [r.label, r]));
  return (
    <ChartBox title="Scale & profitability" hint={`Top ${top.length} ${what} in the current ranking · numbers match the list`}
      table={{ columns: ["Rank", "Name", "Net revenue", "Gross margin"], rows: top.map((r, i) => [i + 1, r.label, Math.round(r.rev), pct(r.margin)]), numeric: [0, 2, 3] }}
      foot="Higher points represent more revenue. Further right represents a higher margin; a red one is a loss. Different product mixes can explain differences.">
      {top.length ? (
        <Box sx={{ opacity: list.busy ? 0.55 : 1 }}>
          <Bubbles points={top.map((r, i) => ({ label: r.label, x: r.margin, y: r.rev, size: r.rev, rank: i + 1, bad: r.margin < 0 }))}
            xFormat={pct} xTick={(v) => `${Math.round(v * 100)}%`} yFormat={eur} yTick={eurTick} xTitle="Gross margin" yTitle="Net revenue"
            onSelect={onPick ? (l) => { const r = byLabel.get(l); if (r) onPick(r); } : undefined} />
        </Box>
      ) : list.busy ? <Skeleton variant="rounded" height={300} /> : NONE()}
    </ChartBox>
  );
}

/** The pilot's revenue mix: a ring of the parts of the net revenue, its legend beside it - a click picks one. */
function Mix({ title, hint, parts, hidden = [], first, centerLabel, onPick, selected, foot }: {
  title: string; hint?: string; parts: { label: string; value: number; title?: string }[]; first: string; centerLabel: string;
  /** parts in the table only, too small for the ring (the rows with no business unit in the ERP) */
  hidden?: { label: string; value: number }[];
  onPick?: (label: string) => void; selected?: string[]; foot?: string;
}) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  const whole = total + hidden.reduce((a, p) => a + Math.max(0, p.value), 0);
  return (
    <ChartBox title={title} hint={hint} foot={foot}
      table={total > 0 ? { columns: [first, "Net revenue", "Share"], rows: [...parts, ...hidden].map((p) => [p.label, Math.round(p.value), pct(p.value / whole)]), numeric: [1, 2] } : undefined}>
      {total > 0 ? <Donut parts={parts} format={eur} centerLabel={centerLabel} onSelect={onPick} selected={selected} whole={hidden.length ? whole : undefined} /> : NONE()}
    </ChartBox>
  );
}

const partsOf = (figs: Figure[]) => figs.map((x) => ({ label: x.name || x.key || NOT_KNOWN, value: x.rev }));

/** "Where does revenue come from?" / "Business-unit contribution" (revision.js buMix) - each business unit's part; a click filters by it. */
function BuMix({ f, title, hint, onPick }: { f: Frame; title: string; hint?: string; onPick?: (key: string) => void }) {
  const rows = f.d.byBu.map((x) => ({ ...x, name: x.key.trim() ? x.name : NO_UNIT }));
  const keyOf = new Map(rows.map((x) => [x.name || x.key, x.key]));
  const pick = (label: string) => { const k = keyOf.get(label); if (k) (onPick ?? ((x: string) => toggleParam("bu", x)))(k); };
  // the rows with no business unit in the ERP out of the ring while under 0.1% - in its table (SARCLA 14.11.2026)
  const drawn = rows.filter((x) => !tinyNoUnit(x.key, x.rev, f.d.totals.rev));
  return <Mix title={title} hint={hint} parts={partsOf(drawn)} hidden={partsOf(rows.filter((x) => !drawn.includes(x)))} first="Business unit"
    centerLabel={f.bus.length || f.orgs.length ? "revenue in selection" : "net revenue"} onPick={pick} selected={f.bus.length ? f.bus : undefined} />;
}

/** "Which materials sell most?" (revision.js materialRows) - each family's part of the named compounds; a click opens its compounds. */
function FamilyMix({ f, onPick, chosen, hint }: { f: Frame; onPick: (family: string) => void; chosen?: string | null; hint?: string }) {
  return (
    <Mix title="Which materials sell most?" hint={hint} parts={partsOf(f.d.byFamily)} first="Material family" centerLabel="compound revenue"
      onPick={onPick} selected={chosen ? [chosen] : undefined} />
  );
}

/** "Material mix of the articles" (revision.js detailView, articles) - the family of each article's compound; a click filters the articles. */
function ArticleMix({ f, onPick, chosen, hint }: { f: Frame; onPick: (family: string) => void; chosen?: string | null; hint?: string }) {
  const none = f.d.noCompoundShare * f.d.totals.rev;
  return (
    <Mix title="Material mix of the articles" hint={hint} parts={[...partsOf(f.d.byFamily), ...(none > 0 ? [{ label: NO_COMPOUND, value: none }] : [])]}
      first="Material family" centerLabel="article revenue" onPick={onPick} selected={chosen ? [chosen] : undefined}
 />
  );
}

const KIND_COLOR: Record<ApprovalKind, string> = { none: DEEMPHASIS, datasheet: SERIES[2], explicit: SERIES[0], other: SERIES[1] };

/**
 * The pilot's "Which approvals matter?" (index.html overview): the share of the revenue with no approval written, large,
 * that share against the rest as one bar, the approvals carried most - and the way to the approvals page.
 */
function ApprovalShare({ f, href }: { f: Frame; href: string }) {
  const s = f.d.noApprovalShare, all = f.d.totals.rev;
  const named = leadingRefs(f.d.approvalRefs);
  return (
    <ChartBox title="Which approvals matter?" hint={`${pct(s)} of the net revenue comes from articles with no approval written`} right={<MoreLink href={href}>Inspect</MoreLink>}
      foot={named.length ? `The approvals our sold articles carry most: ${andList(named)}` : undefined}>
      {all > 0 ? (
        <ShareBar keepOrder format={eur} segments={[
          { label: "No approval written", value: all * s, color: DEEMPHASIS },
          { label: "An approval written", value: all * (1 - s), color: ACCENT },
        ]} />
      ) : NONE()}
    </ChartBox>
  );
}

/** The pilot's "The evidence available today" (index.html approvalSummary), in plain words: what the articles' approval texts say. */
function Evidence({ f }: { f: Frame }) {
  const kinds = f.d.approvalKinds;
  const all = kinds.reduce((a, k) => a + Math.max(0, k.rev), 0);
  return (
    <ChartBox title="What the approval texts say" hint="The net revenue by what is written in the article's approval field · read from the words, not a checked certificate"
      table={all > 0 ? { columns: ["The text", "Net revenue", "Share"], rows: kinds.map((k) => [k.name, Math.round(k.rev), pct(k.rev / all)]), numeric: [1, 2] } : undefined}
      >
      {all > 0 ? <ShareBar keepOrder format={eur} segments={kinds.map((k) => ({ label: k.name, value: k.rev, color: KIND_COLOR[k.key as ApprovalKind] }))} /> : NONE()}
    </ChartBox>
  );
}

/**
 * The pilot's "Most prominent approval references" (index.html mentionSummary), said plainly (SARCLA 14.11.2026: "I
 * really don't understand"): a bar per approval - the net revenue of the articles carrying it, how many articles beside
 * it. An article carrying two counts under both; a click finds the texts naming it.
 */
function References({ f, onPick }: { f: Frame; onPick?: (ref: string) => void }) {
  const refs = (f.d.approvalGroups ?? f.d.approvalRefs).filter((r) => r.rev > 0);
  const none = (f.d.approvalGroups ? APPROVAL_ROWS : f.d.approvalRefs.map((r) => r.name)).filter((n) => !refs.some((r) => r.name === n));
  const counted = refs.some((r) => r.articles != null);
  return (
    <ChartBox title="Which approvals our sold articles carry" hint={`An article can carry several approvals${onPick ? " · click one to see the texts that name it" : ""}`}
      table={refs.length ? { columns: ["Approval", ...(counted ? ["Articles"] : []), "Net revenue"], rows: refs.map((r) => [r.name, ...(counted ? [r.articles ?? 0] : []), Math.round(r.rev)]), numeric: counted ? [1, 2] : [1] } : undefined}
      foot={none.length > 0 ? `No article sold in these months carries ${andList(none).replace(/ and /, " or ")}.` : undefined}>
      {refs.length ? (
        <BarList format={eur} labelWidth={104} heads={{ label: "Approval", value: "Net revenue", note: counted ? "Articles" : undefined }} onSelect={onPick} noteWidth={counted ? 72 : undefined}
          rows={refs.map((r) => ({ label: r.name, value: r.rev, note: counted ? { text: int(r.articles ?? 0) } : undefined }))} />
      ) : NONE("No article sold in these months carries one of them.")}
    </ChartBox>
  );
}

/**
 * The pilot's "Materials first. Compounds next." (revision.js materialCards) as a real chart (SARCLA 13.11.2026: "put
 * real graphs"): a bar per material family by its named compounds' net revenue, the same months a year earlier as a
 * ghost bar behind it, the change and the gross margin in short columns at the right - and beside it the gross margin
 * of each family as bars. A click on a bar chooses the family (its compounds below); "All materials" is the way back.
 */
function FamilyChart({ f, active = null, onPick }: { f: Frame; active?: string | null; onPick: (family: string | null) => void }) {
  const rows = f.d.byFamily.filter((x) => x.rev > 0 || (x.prev ?? 0) > 0);
  const t = TOPIC.materials;
  if (!rows.length) return null;
  const two = hasBefore(f);
  const max = Math.max(1, ...rows.map((x) => Math.max(x.rev, two ? x.prev ?? 0 : 0)));
  const counts = new Map(familyFigures(f.d.compounds).map((x) => [x.key, x.count]));
  const cols = "minmax(80px, 110px) minmax(0, 1fr) 100px 62px 54px";
  const head = { fontSize: "0.66rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" } as const;
  const back = active ? (
    <Button size="small" onClick={() => onPick(null)} startIcon={<ArrowBackIcon />} sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}>All materials</Button>
  ) : undefined;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={t.icon} tint={t.tint} title="Materials first. Compounds next." note="Choose a family to explore the compounds underneath it" right={back} />
      {/* side by side where the bars keep their room, one under the other below */}
      <Box sx={{ display: "grid", gap: 1.5, mt: -1, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.5fr) minmax(0, 1fr)" } }}>
        <ChartBox title="Net revenue by material family" hint={two ? `${f.now}, the same months a year earlier in grey · click a family` : `${f.now} · click a family`}
          table={{ columns: ["Material family", "Net revenue", ...(two ? ["A year earlier", "Change"] : []), "Gross margin", "Compounds"], rows: rows.map((x) => [x.name, Math.round(x.rev), ...(two ? [Math.round(x.prev ?? 0), x.prev ? signedPct(x.rev / x.prev - 1) : "new"] : []), pct(x.margin), int(counts.get(x.key) ?? 0)]), numeric: two ? [1, 2, 3, 4, 5] : [1, 2, 3] }}>
          <Box sx={{ display: "grid", gap: 0.25 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: cols, columnGap: 1.25, px: 0.75, pb: 0.5 }}>
              <Typography sx={head}>Family</Typography><span />
              <Typography sx={{ ...head, textAlign: "right" }}>Net revenue</Typography>
              <Typography sx={{ ...head, textAlign: "right" }}>{two ? "Change" : ""}</Typography>
              <Typography sx={{ ...head, textAlign: "right" }}>GM %</Typography>
            </Box>
            {rows.map((x) => {
              const on = active === x.key;
              const ch = two && x.prev ? x.rev / x.prev - 1 : null;
              return (
                <Box key={x.key} component="button" type="button" onClick={() => onPick(on ? null : x.key)} aria-pressed={on}
                  title={`${x.name}: ${eur(x.rev)}${two ? ` · a year earlier ${eur(x.prev ?? 0)}` : ""} · gross margin ${pct(x.margin)} · ${int(counts.get(x.key) ?? 0)} compounds`}
                  sx={{
                    display: "grid", gridTemplateColumns: cols, columnGap: 1.25, alignItems: "center", width: "100%", border: 0, font: "inherit", textAlign: "left",
                    cursor: "pointer", px: 0.75, py: 0.6, borderRadius: "10px", color: INK,
                    bgcolor: on ? TINT.blue.bg : "transparent", boxShadow: on ? `inset 0 0 0 1.5px ${TINT.blue.fg}` : "none",
                    opacity: active && !on ? 0.55 : 1, "&:hover": { bgcolor: on ? TINT.blue.bg : "rgba(42,120,214,0.05)", opacity: 1 },
                    "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 1 },
                  }}>
                  <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: on ? 700 : 600 }}>{x.name}</Typography>
                  <Box sx={{ position: "relative", height: 18 }}>
                    {two && <Box sx={{ position: "absolute", left: 0, top: 0, height: 18, width: `${(Math.max(0, x.prev ?? 0) / max) * 100}%`, bgcolor: DEEMPHASIS, opacity: 0.45, borderRadius: "0 4px 4px 0" }} />}
                    <Box sx={{ position: "absolute", left: 0, top: 4, height: 10, width: `${(Math.max(0, x.rev) / max) * 100}%`, minWidth: x.rev > 0 ? 2 : 0, bgcolor: ACCENT, borderRadius: "0 3px 3px 0" }} />
                  </Box>
                  <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{eur(x.rev)}</Typography>
                  <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums", color: ch == null ? FAINT : tone(ch) }}>{two ? (ch == null ? (x.rev > 0 ? "new" : "—") : signedPct(ch)) : ""}</Typography>
                  <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums", color: x.margin < 0 ? RED : MUTED }}>{pct(x.margin)}</Typography>
                </Box>
              );
            })}
          </Box>
        </ChartBox>
        <ChartBox title="Gross margin by material family" hint="Gross profit over net revenue · click a family"
          table={{ columns: ["Material family", "Gross margin", "Gross profit"], rows: rows.map((x) => [x.name, pct(x.margin), Math.round(x.gp)]), numeric: [1, 2] }}>
          <BarList format={pct} labelWidth={110} heads={{ label: "Family", value: "Gross margin" }} selectedLabel={active ? rows.find((x) => x.key === active)?.name ?? null : null}
            onSelect={(label) => { const x = rows.find((r) => r.name === label); if (x) onPick(active === x.key ? null : x.key); }}
            rows={[...rows].sort((a, b) => b.margin - a.margin).map((x) => ({ label: x.name, value: Math.max(0, x.margin), color: x.margin < 0 ? DELTA.bad : undefined }))} />
        </ChartBox>
      </Box>
    </GlassCard>
  );
}

/* the hub's own charts - against a year earlier, month by month - under the pilot's: each figure its own full-width
   graph, a page at a time (SARCLA 11.11.2026: "all the figures, by customer, also in separate graphs") */

/** The rows a page of a figure's graph holds. */
const GRAPH_PAGE = 10;

/** Net revenue per row against the same months a year earlier - a page at a time, the largest first; a bar can filter. */
function RevenueChart({ f, title, rows, labelWidth = 220, pageSize = GRAPH_PAGE, onPick, selected }: {
  f: Frame; title: string; rows: Row[]; labelWidth?: number; pageSize?: number; onPick?: (label: string) => void; selected?: string[];
}) {
  if (!rows.length) return <ChartBox title={title}>{NONE()}</ChartBox>;
  const two = hasBefore(f);
  return (
    <DimChart title={title} rows={rows} cur={(r) => r.rev} prev={(r) => r.prev} curLabel={f.now} prevLabel={f.before} fmt={eur} pageSize={pageSize} bounded
      single={!two} curNote={two ? revNote : undefined} labelWidth={labelWidth} onPick={onPick} selected={selected} pickHint={onPick ? "Click a bar to show only it" : ""} />
  );
}

/** Gross profit per row against the same months a year earlier - the largest first, a page at a time. */
function ProfitChart({ f, title, rows, labelWidth = 220, pageSize = GRAPH_PAGE }: { f: Frame; title: string; rows: Row[]; labelWidth?: number; pageSize?: number }) {
  const shown = rows.filter((r) => r.gp > 0 || r.prevGp > 0);
  if (!shown.length) return <ChartBox title={title}>{NONE()}</ChartBox>;
  const two = hasBefore(f);
  return (
    <DimChart title={title} rows={shown} cur={(r) => r.gp} prev={(r) => r.prevGp} curLabel={f.now} prevLabel={f.before} fmt={eur} pageSize={pageSize} bounded
      single={!two} curNote={two ? gpNote : undefined} labelWidth={labelWidth} pickHint="" negatives />
  );
}

/** The gross margin per row, its change in points beside it - in the order of their net revenue, a page at a time. */
function MarginChart({ f, title, rows, labelWidth = 220, pageSize = GRAPH_PAGE }: { f: Frame; title: string; rows: Row[]; labelWidth?: number; pageSize?: number }) {
  const shown = [...rows].filter((r) => r.rev > 0).sort((a, b) => b.rev - a.rev);
  if (!shown.length) return <ChartBox title={title}>{NONE()}</ChartBox>;
  return (
    <DimChart title={title} rows={shown} cur={(r) => r.margin} prev={() => 0} curLabel={`Gross margin, ${f.now}`} prevLabel="" fmt={pct} pageSize={pageSize} bounded
      single fixedOrder curNote={hasBefore(f) ? marginNote : undefined} labelWidth={labelWidth} pickHint="" negatives />
  );
}

/** A breakdown's figures, each its own full-width graph: net revenue and gross profit against a year earlier, the gross margin. */
function FigureGraphs({ f, rows, what, labelWidth = 220, onPick, selected, paired = false }: {
  f: Frame; rows: Row[]; what: string; labelWidth?: number; onPick?: (label: string) => void; selected?: string[];
  /** the gross profit and the gross margin side by side (short names: the units, the organisations) - a tab within two screens */
  paired?: boolean;
}) {
  const profit = <ProfitChart f={f} title={paired ? "Gross profit against the same months a year earlier" : `Gross profit against the same months a year earlier, by ${what}`} rows={rows} labelWidth={labelWidth} />;
  const margin = <MarginChart f={f} title={paired ? "Gross margin - in the order of their net revenue" : `Gross margin, by ${what} - in the order of their net revenue`} rows={rows} labelWidth={labelWidth} />;
  return (
    <>
      <Wide><RevenueChart f={f} title={`Net revenue against the same months a year earlier, by ${what}`} rows={rows} labelWidth={labelWidth} onPick={onPick} selected={selected} /></Wide>
      {paired ? <>{profit}{margin}</> : <><Wide>{profit}</Wide><Wide>{margin}</Wide></>}
    </>
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
    <ChartBox title={title} hint={`The three with the most net revenue${rest ? ", all the others in grey" : ""}`}
      table={top.length ? { columns: ["Month", ...parts.map((p) => p.label)], rows: data.map((d) => [String(d.x), ...parts.map((p) => Math.round(Number(d[p.key] ?? 0)))]), numeric: parts.map((_, i) => i + 1) } : undefined}>
      {top.length ? <StackedColumns data={data} parts={parts} format={eur} tickFormat={eurTick} xFormat={(x) => x} height={260} /> : NONE()}
    </ChartBox>
  );
}

/* the tables: one line a row, short heads (SARCLA 13.11.2026: "table layout still broken"), and their columns balanced
   (SARCLA 14.11.2026: "columns size on table makes no sense") - the name what it needs, up to about a third of the width;
   every figure at least its widest value with its chip and its head on one line, then a share of the room left - so a
   number is never cut and a figure never runs into the one beside it, whatever the font or the window */

/** A figure with its change as a small chip beside it, on one line. */
const inlineChange = (v: React.ReactNode, c: { text: string; color: string } | null) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, whiteSpace: "nowrap" }}>
    <span>{v}</span>
    {c && <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, color: c.color, bgcolor: `${c.color}14`, px: 0.6, borderRadius: "6px", lineHeight: 1.6 }}>{c.text}</Box>}
  </Box>
);
/** A change as the tables write it in their chips - compact, no arrow: "+9.1%", "−1.8pp". */
const pctChip = (cur: number, prev: number) => { const r = cur / prev - 1, x = Math.round(r * 1000) / 10; return { text: `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(1)}%`, color: tone(r, 0.005) }; };
const ppChip = (cur: number, prev: number) => { const d = Math.round((cur - prev) * 1000) / 10; return { text: `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)}pp`, color: d ? tone(cur - prev) : MUTED }; };
/** A row's net revenue with its change, "new" when there was none a year earlier. */
const revChip = (r: Row) => (r.prev ? pctChip(r.rev, r.prev) : r.rev > 0 ? { text: "new", color: GREEN } : null);
/** A row's gross margin with its change in points, when a year earlier is known. */
const marginCell = (r: Row, two: boolean) => { if (!two) return pct(r.margin); const p = prevMargin(r); return inlineChange(pct(r.margin), p == null ? { text: "new", color: MUTED } : ppChip(r.margin, p)); };
/** A name on one line - cut with an ellipsis, the whole of it in the tooltip. */
const oneLine = (text: string, full?: string) => (
  <Box component="span" title={full ?? text} sx={{ display: "block", flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</Box>
);
/** An identifier on one line, never cut - its column is as wide as the longest ("20-120456"). */
const ident = (text: string) => <Box component="span" sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: MUTED }}>{text}</Box>;
/** The heads of the figure columns, short: "Net revenue 2026", "2025" - the years when the period is one calendar year. */
function figureHeads(f: Frame): { cur: string; prev: string } {
  const one = f.from.slice(0, 4) === f.to.slice(0, 4);
  return one ? { cur: `Net revenue ${f.to.slice(0, 4)}`, prev: f.d.period.prevTo.slice(0, 4) } : { cur: "Net revenue", prev: "Year before" };
}
/** The name's column: what the longest name of the page needs, at most about a third of the table (fit-content). */
const NAME_COL = "fit-content(35%)";
/** A figure's column: at least its widest value and its head, then its share of the room the name leaves. */
const FIG_COL = (fr = 1) => `minmax(max-content, ${fr}fr)`;
/** The figure columns: net revenue with its chip, the year before, gross profit, GM with its chip, share. */
const FIG_COLS = (two: boolean) => [FIG_COL(1.25), ...(two ? [FIG_COL(1)] : []), FIG_COL(1), FIG_COL(1.15), FIG_COL(0.7)];
/** About the least width of those columns - with the name's least, below it the table scrolls sideways. */
const figLeast = (two: boolean) => 160 + (two ? 100 : 0) + 110 + 120 + 56;
/** A figure in its cell, room before it - never against the figure on its left. */
const figCell = (v: React.ReactNode) => <Box component="span" sx={{ pl: 0.75, whiteSpace: "nowrap" }}>{v}</Box>;

type Col = { head: string; cell: (r: Row) => React.ReactNode; sort: (r: Row) => number | string; text?: boolean; width?: string; least?: number };

/** All the figures of a breakdown (ExplorerKit Table) - any column sorts; a long list a page at a time, and a search. */
function FigTable({ f, title, first, rows, extra = [], total = null, find, withPrev = true, query, onQuery }: {
  f: Frame; title: string; first: string; rows: Row[]; extra?: Col[]; total?: Row | null; find?: string; withPrev?: boolean;
  /** the search, when a chart above sets it */
  query?: string; onQuery?: (q: string) => void;
}) {
  const all = f.d.totals.rev;
  const two = withPrev && hasBefore(f);
  const heads = figureHeads(f);
  const cols: Col[] = [
    { head: first, cell: (r) => oneLine(r.label, r.full), sort: (r) => r.label.toLowerCase(), text: true, width: NAME_COL, least: 160 },
    ...extra.map((c) => ({ width: "max-content", least: 110, ...c })),
    { head: heads.cur, cell: (r) => figCell(two ? inlineChange(eur(r.rev), revChip(r)) : eur(r.rev)), sort: (r) => r.rev },
    ...(two ? [{ head: heads.prev, cell: (r: Row) => figCell(eur(r.prev)), sort: (r: Row) => r.prev }] : []),
    { head: "Gross profit", cell: (r) => figCell(eur(r.gp)), sort: (r) => r.gp },
    { head: "GM", cell: (r) => figCell(marginCell(r, two)), sort: (r) => r.margin },
    { head: "Share", cell: (r) => figCell(all > 0 ? pct(r.rev / all) : "—"), sort: (r) => r.rev },
  ];
  const widths = [...cols.slice(1, 1 + extra.length).map((c) => c.width ?? "max-content"), ...FIG_COLS(two)];
  const least = cols.slice(0, 1 + extra.length).reduce((a, c) => a + (c.least ?? 110), 0) + figLeast(two);
  const revCol = 1 + extra.length;
  const [sort, setSort] = useState<TableSort>({ col: revCol, desc: true });
  const [own, setOwn] = useState("");
  const q = query ?? own;
  const setQ = onQuery ?? setOwn;
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
        {find && (rows.length > 10 || q) && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, height: 34, minWidth: 240, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
            <SearchIcon sx={{ fontSize: 17, color: MUTED }} />
            <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${find}…`} inputProps={{ "aria-label": `Find ${find}` }} sx={{ fontSize: "0.84rem", flex: 1 }} />
          </Box>
        )}
      </Box>
      {rows.length ? (
        found.length ? (
          <Table head={cols.map((c) => c.head)} rows={body} left={cols.map((c, i) => (c.text && i > 0 ? i : -1)).filter((i) => i > 0)}
            firstWidth={NAME_COL} widths={widths} minWidth={least}
            sortable={cols.map((_, i) => i)} sort={sort} onSort={(c) => setSort((s) => (s.col === c ? { col: c, desc: !s.desc } : { col: c, desc: cols[c]?.text ? false : true }))}
            pageSize={long ? 25 : undefined} />
        ) : NONE(`Nothing found for "${q.trim()}".`)
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

/* ── the topic pages: the pilot's views, in Digital Growth's stage-page frame ── */

type TabDef = { id: string; label: string; count?: (f: Frame) => string | null; Body: (p: { f: Frame }) => React.ReactNode };
/** A figure top right of a page - left out when there is none to show. */
type PageFigure = { label: string; icon: React.ReactNode; tint: Tint; v: SView | null; sub?: string };
/**
 * A page: the pilot's title and line for its view (index.html detailView titles), its cards top right - the revenue in
 * the selection, how many are displayed, the reporting period - and its tabs.
 */
type PageDef = { title: string; lead: string; topic: Topic; figures: (f: Frame) => PageFigure[]; tabs: TabDef[] };

const glyph = (I: typeof EuroOutlinedIcon) => <I />;


/**
 * The business units or the sales organisations as rows: the rows the ERP gives no company number named plainly, why in
 * the tooltip (SARCLA 14.11.2026: "'Not known' in business units = ?").
 */
function unitRows(figs: Figure[], units: boolean): Row[] {
  return rowsOf(figs, units ? cleanName : shortName).map((r) => (r.key.trim() ? r : { ...r, label: units ? NO_UNIT : NO_ORG, full: `${units ? NO_UNIT : NO_ORG} - ${NO_UNIT_WHY}` }));
}
/** The rows a ring or a bar chart draws: the one with no unit left out while under 0.1% of the net revenue - the tables keep it. */
const chartRows = <T extends { key: string; rev: number }>(rows: T[], total: number): T[] => rows.filter((r) => !tinyNoUnit(r.key, r.rev, total));

/**
 * A business unit or a sales organisation (the hub's own page), a few graphs a tab (SARCLA 13.11.2026: "give it more
 * tabs, to decrease the number of graphs per page"): its contribution and every figure in the table, or its net revenue,
 * gross profit and gross margin against a year earlier.
 */
function OrgBreakdown({ f, kind, view }: { f: Frame; kind: "units" | "orgs"; view: "contribution" | "figures" }) {
  const units = kind === "units";
  const rows = unitRows(units ? f.d.byBu : f.d.byChannel, units);
  const drawn = chartRows(rows, f.d.totals.rev);
  const param = units ? "bu" : "org";
  const keyOf = new Map(rows.map((r) => [r.label, r.key]));
  const pick = (label: string) => { const k = keyOf.get(label); if (k) toggleParam(param, k); };
  const chosen = units ? f.bus : f.orgs;
  const what = units ? "business unit" : "sales organisation";
  const t = units ? TOPIC.units : { ...TOPIC.units, icon: <StorefrontOutlinedIcon />, tint: "green" as Tint };
  const picked = chosen.length ? rows.filter((r) => chosen.includes(r.key)).map((r) => r.label) : undefined;
  if (view === "figures") {
    return (
      <Breakdown t={t} title={`Revenue and margin by ${what}, ${f.now}`} note={`${against(f)} · click a bar to show only it`}
        charts={<FigureGraphs f={f} rows={drawn} what={what} labelWidth={units ? 140 : 190} onPick={pick} selected={picked} paired />} table={null} />
    );
  }
  return (
    <Breakdown t={t} title={`Where does revenue come from? By ${what}, ${f.now}`}
      note={`${units ? "The Angst+Pfister company that invoiced" : "The organisation that sold to the customer"} · ${against(f)} · click one to show only it`}
      charts={<Wide><Mix title={units ? "Business-unit contribution" : "Sales-organisation contribution"} hint="Revenue split within the selection · click one to show only it"
        parts={drawn.map((r) => ({ label: r.label, value: r.rev, title: r.full }))} hidden={rows.filter((r) => !drawn.includes(r)).map((r) => ({ label: r.label, value: r.rev }))}
        first={units ? "Business unit" : "Sales organisation"} centerLabel="revenue in selection" onPick={pick} selected={picked} /></Wide>}
      table={<FigTable f={f} title={`All the figures, by ${what}`} first={units ? "Business unit" : "Sales organisation"} rows={rows} total={rows.length > 1 ? totalOf(rows, units ? "All business units" : "All sales organisations") : null} />}
    />
  );
}

/** The sales organisations: their contribution, their net revenue against a year earlier and their gross margin side by side, the table. */
function OrgsTab({ f }: { f: Frame }) {
  const rows = unitRows(f.d.byChannel, false);
  const drawn = chartRows(rows, f.d.totals.rev);
  const keyOf = new Map(rows.map((r) => [r.label, r.key]));
  const pick = (label: string) => { const k = keyOf.get(label); if (k) toggleParam("org", k); };
  const picked = f.orgs.length ? rows.filter((r) => f.orgs.includes(r.key)).map((r) => r.label) : undefined;
  const t = { ...TOPIC.units, icon: <StorefrontOutlinedIcon />, tint: "green" as Tint };
  return (
    <Breakdown t={t} title={`Sales organisations, ${f.now}`} note={`The organisation that sold to the customer · ${against(f)} · click one to show only it`}
      charts={<>
        <Wide><Mix title="Sales-organisation contribution" hint="Revenue split within the selection · click one to show only it"
          parts={drawn.map((r) => ({ label: r.label, value: r.rev, title: r.full }))} hidden={rows.filter((r) => !drawn.includes(r)).map((r) => ({ label: r.label, value: r.rev }))}
          first="Sales organisation" centerLabel="revenue in selection" onPick={pick} selected={picked} /></Wide>
        <RevenueChart f={f} title="Net revenue against the same months a year earlier" rows={drawn} labelWidth={185} onPick={pick} selected={picked} />
        <MarginChart f={f} title="Gross margin - in the order of their net revenue" rows={drawn} labelWidth={185} />
      </>}
      table={<FigTable f={f} title="All the figures, by sales organisation" first="Sales organisation" rows={rows} total={rows.length > 1 ? totalOf(rows, "All sales organisations") : null} />}
    />
  );
}

function MonthsTab({ f }: { f: Frame }) {
  return (
    <>
      <TrendCards f={f} items={[TR.rev(f), TR.margin(f)]} />
      <Breakdown t={TOPIC.revenue} title={`Net revenue month by month, ${f.now}`} note={`Each month's invoices · ${against(f)}`}
        charts={<Wide><MonthStack f={f} rows={f.d.unitMonths} order={f.d.byBu.map((x) => ({ key: x.key, name: x.key.trim() ? x.name || x.key : NO_UNIT }))} title="Net revenue month by month, by business unit" /></Wide>}
        table={null} />
    </>
  );
}

/** Each business unit's customer accounts in the page's period and filters - how many, one small reading each. */
function useUnitAccounts(f: Frame, units: string[]): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const key = units.join("|");
  useEffect(() => {
    let live = true;
    Promise.all(units.map(async (u) => {
      const p = new URLSearchParams(f.ask);
      p.delete("bu"); p.append("bu", u);
      p.set("kind", "customer"); p.set("limit", "1"); p.set("offset", "0");
      const r = await fetch(`/api/ap/sealing/list?${p.toString()}`, { cache: "no-store" }).catch(() => null);
      const j = r ? ((await r.json().catch(() => ({}))) as { ok?: boolean; list?: { total: number } }) : {};
      return [u, j.ok && j.list ? j.list.total : 0] as const;
    })).then((all) => { if (live) setCounts(new Map(all)); });
    return () => { live = false; };
  }, [f.ask, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return counts;
}

/** Customers by unit: how many accounts each business unit invoiced, and the largest accounts of the unit chosen - two graphs. */
function CustomersByUnit({ f }: { f: Frame }) {
  const inspect = useContext(InspectCtx);
  // the units with a company number - the rows without one cannot be asked for by unit
  const units = f.d.byBu.filter((x) => x.key.trim() && x.rev > 0);
  const [unit, setUnit] = useState<string>(units[0]?.key ?? "");
  const counts = useUnitAccounts(f, units.map((u) => u.key));
  const st = useRanking();
  const top = useList(f, { kind: "customer", by: st.by, q: "", offset: 0, limit: 10, bu: unit });
  const byLabel = new Map(top.rows.map((r) => [r.label, r]));
  const t = { ...TOPIC.customers };
  return (
    <Breakdown t={t} title={`Customers by business unit, ${f.now}`} note="How many accounts each unit invoiced · click a unit for its largest accounts"
      charts={<>
        <ChartBox title="Customer accounts, by business unit" hint="Accounts with a sealing invoice in the period · net revenue per account beside"
          table={{ columns: ["Business unit", "Customer accounts", "Net revenue", "Per account"], rows: units.map((u) => [u.name || u.key, counts.get(u.key) ?? 0, Math.round(u.rev), counts.get(u.key) ? Math.round(u.rev / counts.get(u.key)!) : 0]), numeric: [1, 2, 3] }}>
          {counts.size ? (
            <BarList format={int} labelWidth={130} heads={{ label: "Business unit", value: "Accounts", note: "Per account" }} noteWidth={92}
              selectedLabel={units.find((u) => u.key === unit)?.name ?? unit} onSelect={(l) => { const u = units.find((x) => (x.name || x.key) === l); if (u) setUnit(u.key); }}
              rows={units.map((u) => ({ label: u.name || u.key, value: counts.get(u.key) ?? 0, note: { text: counts.get(u.key) ? eur(u.rev / counts.get(u.key)!) : "—" } })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))} />
          ) : <Skeletons n={6} h={22} />}
        </ChartBox>
        <ChartBox title={`The largest customers of ${units.find((u) => u.key === unit)?.name ?? unit}`} hint="By net revenue, each with its gross margin · click one to inspect it">
          {top.rows.length ? (
            <BarList ranked wrapLabels format={eur} labelWidth={170} heads={{ label: "Customer", value: "Net revenue", note: "GM %" }}
              rows={top.rows.map(rankRow("rev"))} onSelect={(l) => { const r = byLabel.get(l); if (r) inspect(pickOf("customer", r)); }} />
          ) : top.busy ? <Skeletons n={8} h={22} /> : NONE()}
        </ChartBox>
      </>}
      table={null}
    />
  );
}

/* the cards of each block, ranked - three open at a time (sealingRules: overviewCandidates, reviewCandidates ...) */

/** The compound to inspect from a page's third card - the spread priority's, else the leading compound. */
const compareCompound = (f: Frame) => f.d.priorities.find((p) => p.kind === "spread")?.compound ?? f.d.compounds[0]?.name ?? "";
/** The rows as the cards read them. */
const positions = (rows: Row[]): Position[] => rows.map((r) => ({ key: r.key, name: r.label, rev: r.rev, margin: r.margin }));
const commercial = (f: Frame) => f.d.candidates ?? f.d.priorities;
const noApprovalRev = (f: Frame) => f.d.noApprovalShare * f.d.totals.rev;
const overviewCards = (f: Frame) => overviewCandidates({
  commercial: commercial(f), customers: positions(rowsOf(f.d.customers)), total: f.d.totals.rev, noApprovalRev: noApprovalRev(f), families: positions(rowsOf(f.d.byFamily)),
});

/** A page's "All customers" tab: the way to it from the ranking's foot. */
const ToAll = ({ label }: { label: string }) => (
  <Button size="small" onClick={() => setQuery((q) => q.set("tab", "all"))} endIcon={<ChevronRightIcon />} sx={{ textTransform: "none", fontWeight: 700, px: 0, minWidth: 0, fontSize: "0.76rem" }}>{label}</Button>
);

/**
 * The pilot's Customers view (index.html detailView + revision.js): "Our leading customers" - its cards top right,
 * "Business-unit contribution" and "Scale & profitability", the ranking with its controls right above it. Its review
 * priorities, the figures against a year earlier and each account's graphs are the next tabs (SARCLA 14.11.2026).
 */
function CustomersTab({ f }: { f: Frame }) {
  const inspect = useContext(InspectCtx);
  const st = useRanking();
  const open = (r: Row) => inspect(pickOf("customer", r));
  return (
    <>
      <Box sx={PAIR}>
        <BuMix f={f} title="Business-unit contribution" hint="Revenue split within the selected customer accounts · click one to show only its customers" />
        <Scale f={f} kind="customer" st={st} what="accounts" onPick={open} />
      </Box>
      <RankedList f={f} kind="customer" title="Customer accounts, ranked" hint="Each with its gross margin · click an entry to inspect its available detail" what="customers or identifiers"
        nameHead="Customer" st={st} onPick={open}
        foot={<><ToAll label="Every account in the All customers tab" /></>} />
    </>
  );
}
/** The pilot's account review priorities, ranked - three open at a time. */
function CustomerPriorities({ f }: { f: Frame }) {
  return <Actions items={reviewCandidates("customers", positions(rowsOf(f.d.customers)), f.d.totals.rev, compareCompound(f))} title={actionsCaption(f.bus)} />;
}
/** The hub's own: the accounts' net revenue, gross profit and gross margin against a year earlier, each its own graph. */
function CustomerFigures({ f }: { f: Frame }) {
  const all = rowsOf(f.d.customers);
  return (
    <Breakdown t={TOPIC.customers} title={`The customer accounts against a year earlier, ${f.now}`} note={`The ${int(all.length)} accounts with the most net revenue of ${int(f.d.totals.customers)} invoiced · ${against(f)}`}
      charts={<FigureGraphs f={f} rows={all} what="customer" labelWidth={240} />} table={null} />
  );
}

/** The material family chosen on a page (?family=) - on every tab of the page, a name the figures know or nothing. */
function useFamily(f: Frame, articles = false): string | null {
  const asked = useSearchParams().get("family");
  return asked && ((articles && asked === NO_COMPOUND) || f.d.byFamily.some((x) => x.key === asked)) ? asked : null;
}
/** The pilot's breadcrumb when a material is chosen: "All article materials / FKM" - its cross lets it go. */
function FamilyCrumb({ family, all = "All article materials" }: { family: string | null; all?: string }) {
  if (!family) return null;
  const t = TOPIC.articles;
  return (
    <Box>
      <Chip size="small" label={<span><b>{all}</b> / {family}</span>} onDelete={() => setParam("family", null)}
        sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[t.tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[t.tint].fg } }} />
    </Box>
  );
}
/** The articles of the family chosen, from the page's largest. */
const articlesOf = (f: Frame, family: string | null) => { const all = rowsOf(f.d.articles); return family ? all.filter((r) => familyOfArticle(r.compound ?? "") === family) : all; };

/**
 * The pilot's Articles view: "The products behind the revenue" - its cards, the breadcrumb of a material chosen,
 * "Business-unit contribution" and the articles' material mix, the ranking with its controls. Its priorities and the
 * hub's own are the next tabs.
 */
function ArticlesTab({ f }: { f: Frame }) {
  const inspect = useContext(InspectCtx);
  const st = useRanking();
  const family = useFamily(f, true);
  const open = (r: Row) => inspect(pickOf("article", r));
  return (
    <>
      <FamilyCrumb family={family} />
      <Box sx={PAIR}>
        <BuMix f={f} title="Business-unit contribution" hint="Revenue split within the selected articles · click one to show only it" />
        <ArticleMix f={f} chosen={family} onPick={(x) => { setParam("family", x === family ? null : x); st.setOffset(0); }} hint="Click to filter these articles. Compound labels need validation" />
      </Box>
      <RankedList f={f} kind="article" title={family ? `Articles, ranked · ${family}` : "Articles, ranked"} hint="Each with its gross margin · click an entry to inspect its available detail"
        what="articles or numbers" nameHead="Article" st={st} onPick={open} labelWidth={320} family={family}
        foot={<><ToAll label="Every article in the All articles tab" /></>} />
    </>
  );
}
function ArticlePriorities({ f }: { f: Frame }) {
  const family = useFamily(f, true);
  return (
    <>
      <FamilyCrumb family={family} />
      <Actions items={reviewCandidates("articles", positions(articlesOf(f, family)), f.d.totals.rev, compareCompound(f))} title={actionsCaption(f.bus)} />
    </>
  );
}
function ArticleFigures({ f }: { f: Frame }) {
  const family = useFamily(f, true);
  const rows = articlesOf(f, family);
  return (
    <>
      <FamilyCrumb family={family} />
      <Breakdown t={TOPIC.articles} title={`The articles against a year earlier${family ? ` · ${family}` : ""}, ${f.now}`} note={`The ${int(rows.length)} articles with the most net revenue${family ? ` of the family` : ` of ${int(f.d.totals.articles)} invoiced`} · ${against(f)}`}
        charts={<FigureGraphs f={f} rows={rows} what="article" labelWidth={280} />} table={null} />
    </>
  );
}

/** The compounds of the family chosen (the unresolved entries with them when asked). */
const compoundsOf = (f: Frame, family: string | null, unresolved = false) =>
  [...f.d.compounds, ...(unresolved ? f.d.unresolved : [])].filter((c) => !family || materialOf(c.name) === family);
/** A family chosen on the Families tab opens its compounds on the next. */
const toCompounds = (family: string | null) => setQuery((q) => { if (family) { q.set("family", family); q.set("tab", "compounds"); } else q.delete("family"); });

/**
 * The pilot's "Materials first. Compounds next." - the families as real charts; a click opens the family's compounds
 * on the Compounds tab. Then the hub's ring of the families' parts.
 */
function FamiliesTab({ f }: { f: Frame }) {
  const family = useFamily(f);
  return (
    <>
      <FamilyChart f={f} active={family} onPick={toCompounds} />
      <FamilyMix f={f} onPick={toCompounds} chosen={family} hint="Each family's part of the compounds' net revenue · click a family to open its compounds" />
    </>
  );
}

/**
 * The pilot's compounds (revision.js compounds): the breadcrumb and the families to choose from, the ranking with its
 * controls and "Include unresolved entries".
 */
function CompoundsTab({ f }: { f: Frame }) {
  const inspect = useContext(InspectCtx);
  const [unresolved, setUnresolved] = useState(false);
  const st = useRanking();
  const family = useFamily(f);
  const open = (r: Row) => inspect(pickOf("compound", r));
  const chipSx = (on: boolean) => ({ height: 30, fontSize: "0.78rem", fontWeight: 600, bgcolor: on ? TINT.purple.bg : "#fff", color: on ? TINT.purple.fg : INK, border: `1px solid ${on ? TINT.purple.fg : "rgba(21,34,58,.14)"}` });
  const pickFamily = (x: string | null) => { setParam("family", x); st.setOffset(0); };
  return (
    <>
      {/* the pilot's breadcrumb, "All materials / FKM / Compounds" - and every family a click away */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
        <Chip label="All materials" onClick={() => pickFamily(null)} aria-pressed={!family} sx={chipSx(!family)} />
        {f.d.byFamily.map((x) => <Chip key={x.key} label={x.name} onClick={() => pickFamily(x.key === family ? null : x.key)} aria-pressed={x.key === family} sx={chipSx(x.key === family)} />)}
      </Box>
      <RankedList f={f} kind="compound" title={family ? `Compounds, ranked · ${family}` : "Compounds, ranked"} hint={family === "Unclassified" ? "The compounds whose name matches no material family, the largest first · click one to see its customers" : `Each with its gross margin${unresolved ? " · the entries with no compound included" : ""} · click one to see its customers`}
        what="compounds" nameHead="Compound" st={st} onPick={open} family={family} unresolved={unresolved}
        extra={f.d.unresolved.length > 0 ? <Chip icon={unresolved ? <CheckIcon /> : undefined} label={`Show the entries with no compound (${int(f.d.unresolved.length)})`} onClick={() => { setUnresolved((x) => !x); st.setOffset(0); }} aria-pressed={unresolved} sx={chipSx(unresolved)} /> : undefined}
        foot={<><ToAll label="Every compound in the All compounds tab" /></>} />
    </>
  );
}
/** The pilot's commercial priorities of the family chosen. */
function CompoundPriorities({ f }: { f: Frame }) {
  const family = useFamily(f);
  return (
    <>
      <FamilyCrumb family={family} all="All materials" />
      <Actions items={familyCandidates(commercial(f), family, compoundsOf(f, family))} title="Commercial priorities" />
    </>
  );
}
/** The hub's own: the compounds' and the families' figures against a year earlier, each with its graph. */
function CompoundsYear({ f }: { f: Frame }) {
  const family = useFamily(f);
  return (
    <>
      <FamilyCrumb family={family} all="All materials" />
      <TrendCards f={f} items={[TR.named(f, family), TR.namedMargin(f, family), TR.compounds(f), TR.noCompound(f), TR.leadFamily(f), TR.leadCompound(f)]} />
    </>
  );
}
function CompoundFigures({ f }: { f: Frame }) {
  const family = useFamily(f);
  const all = rowsOf(compoundsOf(f, family));
  return (
    <>
      <FamilyCrumb family={family} all="All materials" />
      <Breakdown t={TOPIC_COMPOUND} title={`The compounds against a year earlier${family ? ` · ${family}` : ""}, ${f.now}`} note={`${int(all.length)} compound${all.length === 1 ? "" : "s"} · ${against(f)}`}
        charts={<FigureGraphs f={f} rows={all} what="compound" labelWidth={240} />} table={null} />
    </>
  );
}
/**
 * The hub's own, by material family: the gross profit against a year earlier (the net revenue and the margin are the
 * Families tab's), month by month, every figure in the table.
 */
function FamilyFigures({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.byFamily);
  return (
    <Breakdown t={TOPIC.materials} title={`The material families against a year earlier, ${f.now}`}
      note={`${pct(f.d.noCompoundShare)} of the net revenue has no compound · ${against(f)}`}
      charts={<>
        <Wide><ProfitChart f={f} title="Gross profit against the same months a year earlier, by material family" rows={rows} labelWidth={140} /></Wide>
        <Wide><MonthStack f={f} rows={f.d.familyMonths} order={f.d.byFamily.map((x) => ({ key: x.key, name: x.name }))} title="Net revenue month by month, by material family" /></Wide>
      </>}
      table={<FigTable f={f} title="All the figures, by material family" first="Material family" rows={rows} total={rows.length > 1 ? totalOf(rows, "All compounds") : null} />}
    />
  );
}

/**
 * The pilot's "Approval information" view (index.html detailView, approvals): which approvals our sold articles carry,
 * what the approval texts say, the ranking with its controls. "What should we do?" and the hub's own are the next tabs.
 */
function ApprovalsTab({ f }: { f: Frame }) {
  const inspect = useContext(InspectCtx);
  const params = useSearchParams();
  const st = useRanking(params.get("find") ?? "");
  // the pilot's data-mention: an approval searches the texts
  const mention = (ref: string) => {
    st.setQ(ref);
    st.setOffset(0);
    document.getElementById("sealing-approvals-ranking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <>
      <Box sx={{ ...PAIR, alignItems: "start" }}>
        <References f={f} onPick={mention} />
        <Evidence f={f} />
      </Box>
      <Box id="sealing-approvals-ranking" sx={{ scrollMarginTop: 16 }}>
        <RankedList f={f} kind="approval" title="Approval texts, ranked" hint="Texts that say the same together - every data-sheet wording is one “Per data sheet” · click one to read it" what="approval texts" nameHead="Approval" st={st}
          onPick={(r) => inspect(pickOf("approval", r))} labelWidth={340}
          foot={<><ToAll label="Every text in the All approval texts tab" /></>} />
      </Box>
    </>
  );
}
/**
 * Each approval our sold articles carry - FDA, WRAS, KTW, ACS, NSF ... and "Per data sheet" for every text pointing to a
 * data sheet - against a year earlier: the net revenue and gross profit of the articles carrying it, its gross margin
 * (SARCLA 14.11.2026: the raw texts charted "still broken"). The raw texts are the All approval texts tab's.
 */
function ApprovalFigures({ f }: { f: Frame }) {
  const rows: Row[] = (f.d.approvalGroups ?? []).map((x) => ({ label: x.name, full: x.articles != null ? `${x.name} · ${int(x.articles)} article${x.articles === 1 ? "" : "s"}` : x.name, key: x.key, rev: x.rev, gp: x.gp, margin: x.margin, prev: x.prev ?? 0, prevGp: x.prevGp ?? 0 }));
  return (
    <Breakdown t={TOPIC.approvals} title={`The approvals our sold articles carry, against a year earlier, ${f.now}`}
      note={`An article can carry several approvals - it counts under each, so the rows overlap and do not add up · “Per data sheet”: every text pointing to a data sheet, an approval named or not · ${against(f)}`}
      charts={rows.length ? <FigureGraphs f={f} rows={rows} what="approval" labelWidth={130} paired /> : <Wide>{NONE("No article sold in these months carries one of them.")}</Wide>}
      table={rows.length ? <FigTable f={f} title="All the figures, by approval" first="Approval" rows={rows} /> : null} />
  );
}

/* ── the All tabs: every customer, article, compound or approval text, 30 a page (SARCLA 11.11.2026) ── */

/** A column of an All table besides the name and the figures: its head, its cell, its track and about its least width. */
type AllCol = { head: string; cell: (r: Row) => React.ReactNode; width: string; least: number };

/** A name over up to two lines - whole wherever two lines hold it; the whole of it in the tooltip either way. */
const twoLines = (text: React.ReactNode, title: string, lines = 2) => (
  <Box component="span" title={title} sx={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", overflowWrap: "anywhere", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", fontVariantNumeric: "normal" }}>{text}</Box>
);

/** An approval text's approvals as chips - over up to two lines, then how many more (the whole list in the detail window). */
function RefChips({ text, n = 6 }: { text: string; n?: number }) {
  const parts = approvalParts(text);
  if (!parts.length) return twoLines(text, text);
  if (parts.length === 1 && parts[0] === PER_DATA_SHEET && text.trim() !== PER_DATA_SHEET) return (
    <Box component="span" title={text} sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flex: "1 1 auto" }}>
      <Box component="span" sx={{ flex: "0 0 auto", fontSize: "0.72rem", fontWeight: 600, color: INK, bgcolor: "#eef2f8", border: `1px solid ${HAIRLINE}`, px: 0.75, borderRadius: "8px", lineHeight: 1.6, whiteSpace: "nowrap" }}>{PER_DATA_SHEET}</Box>
      <Box component="span" sx={{ color: MUTED, fontSize: "0.78rem", minWidth: 0, flex: "1 1 auto" }}>{twoLines(`“${text.trim()}”`, text)}</Box>
    </Box>
  );
  const shown = parts.slice(0, n);
  return (
    <Box component="span" title={parts.join(" · ")} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, minWidth: 0, flex: "1 1 auto" }}>
      {shown.map((p) => (
        <Box key={p} component="span" sx={{ flex: "0 1 auto", minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", fontSize: "0.72rem", fontWeight: 600, color: INK, bgcolor: "#eef2f8", border: `1px solid ${HAIRLINE}`, px: 0.75, borderRadius: "8px", lineHeight: 1.6, whiteSpace: "nowrap" }}>{p}</Box>
      ))}
      {parts.length > n && <Box component="span" sx={{ flex: "0 0 auto", fontSize: "0.72rem", fontWeight: 700, color: MUTED, lineHeight: 1.6, whiteSpace: "nowrap" }}>+{parts.length - n} more</Box>}
    </Box>
  );
}

/**
 * Every one of a kind in a table, 30 a page from the hub - searched, ranked by net revenue or gross profit, a click opens
 * it. The name what it needs up to a third of the width, over two lines (an article three) - shown whole (SARCLA
 * 13.11.2026: no cut names); the figures the rest, each never under its widest value (SARCLA 14.11.2026).
 */
function AllList({ f, kind, title, first, what, extra = [], pick, family, nameCell, nameLeast = 220 }: {
  f: Frame; kind: ListKind; title: string; first: string; what: string; extra?: AllCol[]; pick?: DetailPick["kind"]; family?: string | null;
  /** the first column's cell when not the name (the article's number and name, the approvals' chips) */
  nameCell?: (r: Row) => React.ReactNode;
  /** about the least width of the name's column - below it, with the others', the table scrolls sideways */
  nameLeast?: number;
}) {
  const inspect = useContext(InspectCtx);
  const [q, setQ] = useState("");
  const [by, setBy] = useState<By>("rev");
  const [offset, setOffset] = useState(0);
  const list = useList(f, { kind, by, q, offset, limit: LIST_PAGE, family });
  const two = hasBefore(f);
  const whole = f.d.totals.rev;
  const heads = figureHeads(f);
  const head = [first, ...extra.map((c) => c.head), heads.cur, ...(two ? [heads.prev] : []), "Gross profit", "GM", "Share"];
  const revCol = 1 + extra.length, gpCol = revCol + (two ? 2 : 1);
  const widths = [...extra.map((c) => c.width), ...FIG_COLS(two)];
  const least = nameLeast + extra.reduce((a, c) => a + c.least, 0) + figLeast(two);
  const rows = list.rows.map((r, i) => ({
    key: `${r.key}|${i}`,
    onPick: pick ? () => inspect(pickOf(pick, r)) : undefined,
    cells: [
      <Box key="n" component="span" sx={{ display: "flex", gap: 0.75, alignItems: "center", minWidth: 0, flex: "1 1 auto" }}>
        <Box component="span" sx={{ flex: "0 0 auto", color: FAINT, fontSize: "0.72rem", fontVariantNumeric: "tabular-nums", minWidth: 24 }}>{int(offset + i + 1)}</Box>
        {nameCell ? nameCell(r) : twoLines(r.label, r.full ?? r.label)}
      </Box>,
      ...extra.map((c) => c.cell(r)),
      figCell(two ? inlineChange(eur(r.rev), revChip(r)) : eur(r.rev)),
      ...(two ? [figCell(eur(r.prev))] : []),
      figCell(eur(r.gp)),
      figCell(marginCell(r, two)),
      figCell(whole > 0 ? pct(r.rev / whole) : "—"),
    ],
  }));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={<InventoryOutlinedIcon />} tint="slate" title={title}
        note={`${int(list.total)} in all${family ? ` · ${family}` : ""} · ${by === "gp" ? "by gross profit" : "by net revenue"}, 30 a page · ${f.now}`}
        right={<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
          <SearchBox what={what} q={q} onQ={(x) => { setQ(x); setOffset(0); }} width={320} />
          <ToggleButtonGroup size="small" exclusive value={by} onChange={(_, v: By | null) => { if (v) { setBy(v); setOffset(0); } }} aria-label="Rank by" sx={TOGGLE}>
            <ToggleButton value="rev">Net revenue</ToggleButton>
            <ToggleButton value="gp">Gross profit</ToggleButton>
          </ToggleButtonGroup>
        </Box>} />
      <Box sx={{ mt: -1, opacity: list.busy ? 0.55 : 1, transition: "opacity .15s ease" }}>
        {list.err ? <Typography sx={{ fontSize: "0.84rem", color: RED }}>The list could not be read: {list.err}</Typography>
          : rows.length ? <Table head={head} rows={rows} firstWidth={NAME_COL} widths={widths} minWidth={least}
            left={extra.map((_, i) => i + 1)} sortable={[revCol, gpCol]} sort={{ col: by === "gp" ? gpCol : revCol, desc: true }}
            onSort={(c) => { setBy(c === gpCol ? "gp" : "rev"); setOffset(0); }} />
            : list.busy ? <Skeletons n={6} h={34} /> : NONE(q ? `Nothing found for "${q.trim()}".` : undefined)}
      </Box>
      <Pager total={list.total} offset={offset} onOffset={setOffset} />
    </GlassCard>
  );
}

function AllCustomers({ f }: { f: Frame }) {
  // the number has its own column - the name without it, even where two accounts share a name
  return <AllList f={f} kind="customer" title="All customers" first="Customer" what="customers or numbers" pick="customer"
    nameCell={(r) => twoLines(r.full ?? r.label, `${r.full ?? r.label} · ${r.key}`)}
    extra={[{ head: "Number", cell: (r) => ident(r.key || "—"), width: "max-content", least: 96 }]} />;
}
function AllArticles({ f }: { f: Frame }) {
  const family = useSearchParams().get("family");
  // the article's number before its name, in grey - one column for both, so the name keeps its width
  return <AllList f={f} kind="article" title="All articles" first="Article" what="articles, numbers or compounds" pick="article" family={family || null} nameLeast={260}
    nameCell={(r) => twoLines(<><Box component="span" sx={{ color: FAINT, fontVariantNumeric: "tabular-nums", mr: 0.75 }}>{r.key}</Box>{r.label}</>, `${r.key} · ${r.full ?? r.label}`, 3)}
    extra={[{ head: "Compound", cell: (r) => twoLines(r.compound || "—", r.compound || ""), width: "fit-content(158px)", least: 150 }]} />;
}
function AllCompounds({ f }: { f: Frame }) {
  const family = useSearchParams().get("family");
  return <AllList f={f} kind="compound" title="All compounds" first="Compound" what="compounds" pick="compound" family={family && f.d.byFamily.some((x) => x.key === family) ? family : null}
    extra={[{ head: "Family", cell: (r) => <Box component="span" sx={{ whiteSpace: "nowrap" }}>{noCompound(r.key) ? NO_COMPOUND : materialOf(r.key)}</Box>, width: "max-content", least: 100 }]} />;
}
function AllApprovals({ f }: { f: Frame }) {
  return <AllList f={f} kind="approval" title="All approval texts" first="Approvals on the article" what="approval texts" pick="approval" nameLeast={260}
    nameCell={(r) => <RefChips text={r.key} />} />;
}

/** "Revenue in this selection" - the pilot's first card; on Materials & compounds the named compounds' revenue. */
const inSelection = (f: Frame, sub?: string): PageFigure => ({ label: "Revenue in this selection", icon: glyph(EuroOutlinedIcon), tint: "blue", v: V.rev(f), sub });

const PAGES: Record<Exclude<SealingSlug, "overview">, PageDef> = {
  customers: {
    title: "Our leading customers", lead: "Explore customer accounts and their article mix.", topic: TOPIC.customers,
    figures: (f) => [
      inSelection(f),
      { label: "Customer accounts invoiced", icon: glyph(GroupsOutlinedIcon), tint: "green", v: V.customers(f) },
    ],
    // a tab no longer than about two screens (SARCLA 14.11.2026: "too much scrolling ... create more tabs")
    tabs: [
      { id: "customers", label: "Customers", Body: CustomersTab },
      { id: "priorities", label: "Priorities", Body: CustomerPriorities },
      { id: "year", label: "Against a year earlier", Body: ({ f }) => <TrendCards f={f} items={[TR.customers(f), TR.largestCustomer(f), TR.customerShare(f), TR.negCustomers(f)]} /> },
      { id: "figures", label: "By account", Body: CustomerFigures },
      { id: "all", label: "All customers", count: (f) => int(f.d.totals.customers), Body: AllCustomers },
    ],
  },
  articles: {
    title: "The products behind the revenue", lead: "Explore articles, compound labels and customer exposure.", topic: TOPIC.articles,
    figures: (f) => [
      inSelection(f),
      { label: "Articles invoiced", icon: glyph(InventoryOutlinedIcon), tint: "pink", v: V.articles(f) },
    ],
    tabs: [
      { id: "articles", label: "Articles", Body: ArticlesTab },
      { id: "priorities", label: "Priorities", Body: ArticlePriorities },
      { id: "year", label: "Against a year earlier", Body: ({ f }) => <TrendCards f={f} items={[TR.articles(f), TR.largestArticle(f), TR.articleShare(f), TR.negArticles(f)]} /> },
      { id: "figures", label: "By article", Body: ArticleFigures },
      { id: "all", label: "All articles", count: (f) => int(f.d.totals.articles), Body: AllArticles },
    ],
  },
  materials: {
    title: "Our compound portfolio", lead: "Materials first, compounds next - the compounds as written on the articles.", topic: TOPIC.materials,
    figures: (f) => [
      { label: "Revenue in this selection", icon: glyph(EuroOutlinedIcon), tint: "blue", v: keyView(f, "Compound revenue", f.d.familyMonths, f.d.byFamily.map((x) => x.key)) },
      { label: "Compounds", icon: glyph(ScienceOutlinedIcon), tint: "purple", v: V.compounds(f) },
    ],
    // the pilot's families, its compounds' ranking and its priorities first, then the hub's own - one subject a tab
    // (SARCLA 14.11.2026: "too much scrolling on compounds, create more tabs")
    tabs: [
      { id: "families", label: "Families", count: (f) => String(f.d.byFamily.length), Body: FamiliesTab },
      { id: "compounds", label: "Compounds", Body: CompoundsTab },
      { id: "priorities", label: "Priorities", Body: CompoundPriorities },
      { id: "year", label: "Against a year earlier", Body: CompoundsYear },
      { id: "figures", label: "By compound", Body: CompoundFigures },
      { id: "family-figures", label: "By family", Body: FamilyFigures },
      { id: "all", label: "All compounds", count: (f) => int(f.d.compounds.length), Body: AllCompounds },
    ],
  },
  approvals: {
    title: "Approval information", lead: "What the approvals written on the articles can currently tell us.", topic: TOPIC.approvals,
    figures: (f) => [
      inSelection(f),
      { label: "Approval texts written", icon: glyph(VerifiedOutlinedIcon), tint: "slate", v: V.approvals(f) },
    ],
    tabs: [
      { id: "approvals", label: "Approvals", Body: ApprovalsTab },
      { id: "priorities", label: "Priorities", Body: ({ f }) => <Actions items={approvalCandidates(f.d.approvalRefs, noApprovalRev(f), f.d.totals.rev)} title="What should we do?" first /> },
      { id: "year", label: "Against a year earlier", Body: ({ f }) => <TrendCards f={f} items={[TR.noApproval(f), TR.noApprovalRev(f), TR.withApproval(f), TR.approvals(f)]} /> },
      { id: "figures", label: "By approval", Body: ApprovalFigures },
      { id: "all", label: "All approval texts", count: (f) => int(f.d.totals.approvals), Body: AllApprovals },
    ],
  },
  units: {
    title: "Business units", lead: "Where does revenue come from? Each Angst+Pfister company that invoiced, and the organisations that sold.", topic: TOPIC.units,
    figures: (f) => [
      { label: "Net revenue", icon: glyph(EuroOutlinedIcon), tint: "green", v: V.rev(f) },
      { label: "Gross profit", icon: glyph(SavingsOutlinedIcon), tint: "purple", v: V.gp(f) },
      { label: "Gross margin", icon: glyph(PercentOutlinedIcon), tint: "blue", v: V.margin(f) },
      { label: "Business units", icon: glyph(ApartmentOutlinedIcon), tint: "slate", v: wholeView(f, "Business units", "int", f.d.byBu.filter((x) => x.key.trim() && x.rev > 0).length, null), sub: `${int(f.d.byChannel.filter((x) => x.key.trim() && x.rev > 0).length)} sales organisations` },
    ],
    tabs: [
      { id: "units", label: "Contribution", count: (f) => (f.bus.length ? String(f.bus.length) : null), Body: ({ f }) => <OrgBreakdown f={f} kind="units" view="contribution" /> },
      { id: "figures", label: "Revenue & margin", Body: ({ f }) => <OrgBreakdown f={f} kind="units" view="figures" /> },
      { id: "months", label: "Month by month", Body: MonthsTab },
      { id: "orgs", label: "Sales organisations", count: (f) => (f.orgs.length ? String(f.orgs.length) : null), Body: OrgsTab },
      { id: "customers", label: "Customers by unit", Body: CustomersByUnit },
    ],
  },
};

/**
 * A view's page, as a stage page of the Advanced reports: the way back; the pilot's view name, title and line on the
 * left, its cards top right; under them the tabs, and at their right end the Filters button - where Who are our
 * customers, Visit and Engage have it (SARCLA 14.11.2026: "Filters button is not at the correct location"); the view;
 * the definitions at its foot.
 */
function TopicPage({ slug, f, busy, err, again }: { slug: Exclude<SealingSlug, "overview">; f: Frame; busy: boolean; err: string | null; again: () => void }) {
  const page = PAGES[slug];
  const params = useSearchParams();
  const asked = params.get("tab");
  const tab = page.tabs.find((x) => x.id === asked) ?? page.tabs[0];
  const setTab = (id: string) => setQuery((q) => { if (id === page.tabs[0].id) q.delete("tab"); else q.set("tab", id); });
  const [win, setWin] = useState<Win>(null);
  const [pick, setPick] = useState<DetailPick | null>(null);
  const pri = usePriorities();
  const inspect = useCallback((p: DetailPick) => { setWin(null); setPick(p); }, []);
  const openWin = (w: Win) => { setPick(null); setWin((x) => (x === w ? null : w)); };
  const figures = page.figures(f).filter((x): x is PageFigure & { v: SView } => !!x.v);
  const name = SEALING_PAGES.find((p) => p.slug === slug)?.name ?? page.title;
  return (
    <PriorityCtx.Provider value={pri}>
    <InspectCtx.Provider value={inspect}>
      {/* the stage page's frame ([stage]/page.tsx): the way back, then the page */}
      <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1, md: 1.5 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1 }}>
        <Box component={Link} href={hrefOf("overview", f.carry)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to the overview
        </Box>
        <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
          {/* the title and what is shown on the left; the figures top right (Customers.tsx, Visit.tsx, Engage.tsx) */}
          <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
            <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
              <Typography sx={KICKER}>Sealing Business Review · {name}</Typography>
              <Typography component="h1" sx={H1}>{page.title}</Typography>
              <Typography sx={LEAD}>{page.lead}</Typography>
              <Line f={f} busy={busy} />
              <Chosen f={f} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }}>
              <FigureCards items={figures.map((x, i) => ({ id: `${i}-${x.label}`, ...x }))} />
            </Box>
          </Box>
          {/* the tabs, and at their right end the Filters button - one row from tablet width, Filters below on a phone */}
          <FiltersRow f={f} open={win === "filters"} onFilters={() => openWin("filters")}>
            {page.tabs.length > 1 && <ReportTabs name={`sealing-${slug}`} tab={tab.id} onSelect={setTab} tabs={page.tabs.map((x) => ({ id: x.id, label: x.label, count: x.count?.(f) ?? null }))} />}
          </FiltersRow>
          <Trouble err={err} again={again} />
          <Box id={`sealing-${slug}-panel-${tab.id}`} sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)", opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }} aria-busy={busy}>
            <tab.Body f={f} />
          </Box>
          <Foot onDefinitions={() => openWin("definitions")} />
        </Box>
        <FilterWindow f={f} open={win === "filters"} onClose={() => setWin(null)} />
        <Definitions f={f} open={win === "definitions"} onClose={() => setWin(null)} />
        <DetailWindow f={f} pick={pick} onClose={() => setPick(null)} />
      </Box>
    </InspectCtx.Provider>
    </PriorityCtx.Provider>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

/** A section's card in grey while its figures come: its title's place, then the shape of its chart. */
function CardSkeleton({ h = 220, lines = 0 }: { h?: number; lines?: number }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, display: "grid", gap: 1.25, minWidth: 0 }}>
      <Skeleton variant="text" width="45%" height={22} />
      {lines > 0 && <Skeleton variant="text" width="70%" height={16} />}
      <Skeleton variant="rounded" height={h} />
    </Box>
  );
}

/** A page in grey, in the shape it will have - its head, its cards and charts where they will stand. */
function PageSkeleton({ slug }: { slug: SealingSlug }) {
  const page = slug === "overview" ? null : PAGES[slug];
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }} aria-busy>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        <Typography sx={KICKER}>Sealing Business Review{page ? ` · ${SEALING_PAGES.find((p) => p.slug === slug)?.name ?? ""}` : " · Executive Committee pilot"}</Typography>
        <Typography component="h1" sx={H1}>{TITLE[slug]}</Typography>
        <Typography sx={LEAD}>{page ? page.lead : "Who buys. What sells. Where to focus next."}</Typography>
        <Skeleton variant="text" width={420} height={20} />
      </Box>
      {slug === "overview" ? (
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} h={96} />)}
        </Box>
      ) : (
        <Skeleton variant="rounded" height={40} width={360} />
      )}
      <Box sx={PAIR}><CardSkeleton h={240} lines={1} /><CardSkeleton h={240} lines={1} /></Box>
      <CardSkeleton h={280} lines={1} />
    </Box>
  );
}

/** A page's title while its figures are read - the pilot's titles. */
const TITLE: Record<SealingSlug, string> = {
  overview: "Understand the business.", units: "Business units", customers: "Our leading customers", articles: "The products behind the revenue",
  materials: "Our compound portfolio", approvals: "Approval information",
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
    // what went wrong, in plain words, and a way to ask again - or the page's own shape in grey while its figures come
    // (SARCLA 13.11.2026: never one page-wide "Reading the sealing figures…")
    if (err) return (
      <Box sx={shell}>{head}
        <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.9rem", color: RED }}>The sealing figures could not be read: {err}</Typography>
          <Button size="small" onClick={again} sx={{ textTransform: "none", fontWeight: 700 }}>Try again</Button>
        </Box></GlassCard>
      </Box>
    );
    return <PageSkeleton slug={slug} />;
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
  const f = frameOf(d, bus, orgs, carry, ask);
  return slug === "overview"
    ? <Overview f={f} busy={busy} err={err} again={again} />
    : <TopicPage slug={slug} f={f} busy={busy} err={err} again={again} />;
}

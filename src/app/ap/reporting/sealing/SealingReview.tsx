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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
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
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { StackedColumns, type StackRow } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { ShareBar } from "@/app/charts/ShareBar";
import { Donut } from "@/app/charts/Donut";
import { Bubbles } from "@/app/charts/Bubbles";
import { ACCENT, DEEMPHASIS, DELTA, SERIES } from "@/app/charts/palette";
import { compact } from "@/app/charts/format";
import { KpiCard, MONTHS, MiniBars, type KpiView } from "@/app/reporting/marketing-kpis/data";
import { KpiTileChart } from "@/app/reporting/marketing-kpis/tiles/KpiStyled";
import { FigureCards, Table, change, withChange, type TableSort } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { fmtValue, type Fmt } from "@/lib/marketingKpis/measures";
import { SEALING_PAGES, type SealingSlug } from "@/lib/apHub/sealingPages";
import type { DetailRow, SealingDetail, SealingMonth, SealingView } from "@/lib/apHub/sealingStore";
import {
  APPROVAL_ACTIONS, APPROVAL_KINDS, SEALING_DEFINITIONS, actionsCaption, approvalKind, familyActions, familyFigures, isMonth, leadingRefs, matchesQuery,
  materialOf, monthsBetween, monthsSpan, noCompound, periodWords, rankBy, rateMonths, reviewActions, sealingPresets, sumMonths, tileSeries,
  type ApprovalKind, type DetailKind, type Figure, type KeyMonth, type MonthPair, type Priority, type RankBy,
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
const NO_COMPOUND = "No compound named";
/** An article's material family by its compound - "No compound named" where it names none. */
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
  noCompound: (f: Frame) => rateView(f, "No compound named", pairsOf(f.d.months, (m) => m.noCompound, (m) => m.prevNoCompound), revPairs(f), {
    goodWhenUp: false, definition: "The part of the net revenue whose article names no compound (\"No info\", \"Unknown\", \"TBD\", a drawing) - the pilot's unresolved entries, left out of the families",
  }),
  compounds: (f: Frame) => wholeView(f, "Compounds named", "int", f.d.totals.compounds, f.d.totals.prev.compounds, { definition: "The named compounds on the articles invoiced (the pilot's compound entries)" }),
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

/** The pilot's "largest" cards: the name in the title, its net revenue against the same months a year earlier. */
function largestView(f: Frame, title: string, x: Figure | undefined, definition: string): SView | null {
  if (!x) return null;
  return wholeView(f, `${title}: ${cut(x.name || x.key || NOT_KNOWN, 60)}`, "eur", x.rev, x.prev ?? null, { definition });
}

/** A tile or a KPI card: its figure, and the graph drawn under it when not its months. */
type Item = { v: SView; chart?: React.ReactNode };
const item = (v: SView | null, chart?: React.ReactNode): Item | null => (v ? { v, chart } : null);

/* ── the overview: Digital Growth's macro page ─────────────────────────── */

/** One grid for a panel's tiles, twelve columns: a tile takes two on a wide screen (six to a row) - as the macro page's. */
const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
const TILE_SPAN = { gridColumn: { xs: "span 12", sm: "span 6", md: "span 4", lg: "span 3", xl: "span 2" } };
const THIRD_SPAN = { gridColumn: { xs: "span 12", lg: "span 4" } };
/** The pilot's four overview cards, four to a row on a wide screen (revision.css .cards). */
const QUARTER_SPAN = { gridColumn: { xs: "span 12", sm: "span 6", lg: "span 3" } };
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

/** A tile of the macro page (tiles/KpiStyled KpiTileChart): the badge, the name, the figure, the comparison, its months. */
function Tile({ f, it, t, span = TILE_SPAN }: { f: Frame; it: Item; t: Topic; span?: object }) {
  const chart = it.chart ?? (it.v.labels ? <MiniBars v={it.v} labels={it.v.labels} /> : undefined);
  return (
    <Box sx={{ minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", ...span }}>
      <KpiTileChart v={it.v} slug="sealing" tint={t.tint} icon={t.icon} upTo={f.upTo} title={it.v.id} chart={chart} />
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

function Tiles({ f, t, items }: { f: Frame; t: Topic; items: (Item | null)[] }) {
  const shown = items.filter((x): x is Item => !!x && x.v.ytd != null);
  if (!shown.length) return <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No invoice in these months with these filters.</Typography>;
  return <Box sx={GRID}>{shown.map((it) => <Tile key={it.v.id} f={f} it={it} t={t} />)}</Box>;
}

/** A part of the whole as a thin bar and its words - the pilot's "accounts for x% of revenue", an article's margin beside it. */
function ShareLine({ share, of, margin, lead, tint }: { share: number | null; of: string; margin?: number | null; lead?: string; tint: Tint }) {
  if (share == null || !Number.isFinite(share)) return null;
  return (
    <Box sx={{ display: "grid", gap: 0.6 }}>
      <Box sx={{ height: 8, borderRadius: 99, bgcolor: "rgba(21,34,58,.07)", overflow: "hidden" }}>
        <Box sx={{ width: `${Math.min(100, Math.max(0, share * 100))}%`, minWidth: 3, height: "100%", bgcolor: TINT[tint].fg, borderRadius: 99 }} />
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.4 }}>
        {lead ? `${lead} · ` : ""}<b style={{ color: INK }}>{pct(share)}</b> {of}
        {margin != null && <> · gross margin <b style={{ color: margin < 0 ? RED : INK }}>{pct(margin)}</b></>}
      </Typography>
    </Box>
  );
}

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

/** A card, drawn as a tile of the macro page: its badge, what it is, the evidence, the next move, the effect and its owner. */
function ActionCard({ p, i, onInspect }: { p: Priority; i: number; onInspect?: (compound: string) => void }) {
  const look = KIND_LOOK[p.kind];
  const effect = p.effect ? `${p.effectLabel}: ${eur(p.effect)} gross profit` : p.effectLabel;
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
      {p.next && <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.5 }}><b>Next move.</b> {p.next}</Typography>}
      {p.compound && onInspect && (
        <Button size="small" onClick={() => onInspect(p.compound)} endIcon={<ChevronRightIcon />}
          sx={{ textTransform: "none", fontWeight: 700, alignSelf: "flex-start", px: 0, minWidth: 0 }}>
          Inspect {cut(p.compound, 36)} and its customers
        </Button>
      )}
      {(effect || p.owner) && (
        <Box sx={{ mt: "auto", borderTop: "1px solid rgba(21,34,58,.07)", pt: 0.75, display: "grid", gap: 0.25 }}>
          {effect && <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: FAINT }}>{effect}</Typography>}
          {p.owner && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>Suggested owner: {p.owner}</Typography>}
        </Box>
      )}
    </Box>
  );
}

function ActionGrid({ items, onInspect }: { items: Priority[]; onInspect?: (compound: string) => void }) {
  return (
    <Box sx={GRID}>
      {items.map((p, i) => <Box key={`${p.kind}-${i}`} sx={{ minWidth: 0, display: "grid", ...THIRD_SPAN }}><ActionCard p={p} i={i} onInspect={onInspect} /></Box>)}
    </Box>
  );
}

/**
 * The pilot's "From results to action" (revision.js actionCards: "Commercial priorities", "Evidence · action ·
 * opportunity"; the approvals' index.html insights: "What should we do?", "Evidence → recommendation") - its cards under
 * the caption, the last of the pilot's sections on a page.
 */
function Actions({ items, title, first = false, empty }: { items: Priority[]; title: string; first?: boolean; empty?: string }) {
  const inspect = useContext(InspectCtx);
  if (!items.length && !empty) return null;
  return (
    <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={<LightbulbOutlinedIcon />} tint="amber" title={title}
        note={`From results to action · ${first ? "evidence → recommendation" : "evidence · action · opportunity"}`} />
      <Box sx={{ mt: -1 }}>
        {items.length
          ? <ActionGrid items={items} onInspect={(c) => inspect(compoundPick(c))} />
          : <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{empty}</Typography>}
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

/** The pilot's notice under its controls - what the view's figures can and cannot say. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: "#f4f6fa", borderRadius: "12px", px: 1.75, py: 1.1 }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 }}>{children}</Typography>
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

/** The units, the families: the five largest, and the others together when there are more than six. */
function topKeys(figs: Figure[], n = 6): { keys: string[][]; names: string[] } {
  const named = figs.filter((x) => x.rev > 0 || (x.prev ?? 0) > 0);
  if (named.length <= n) return { keys: named.map((x) => [x.key]), names: named.map((x) => x.name || x.key || NOT_KNOWN) };
  const top = named.slice(0, n - 1), rest = named.slice(n - 1);
  return { keys: [...top.map((x) => [x.key]), rest.map((x) => x.key)], names: [...top.map((x) => x.name || x.key || NOT_KNOWN), `The other ${rest.length}`] };
}

/* the pilot's "largest" tiles, with the share of the whole they carry */
const largestCustomer = (f: Frame) => {
  const x = f.d.customers[0], all = f.d.totals.rev;
  return item(largestView(f, "Largest customer account", x, "The customer account with the most net revenue"),
    x ? <ShareLine share={all > 0 ? x.rev / all : null} of="of the net revenue" tint={TOPIC.customers.tint} /> : undefined);
};
const largestArticle = (f: Frame) => {
  const x = f.d.articles[0], all = f.d.totals.rev;
  return item(largestView(f, "Largest article", x, "The article with the most net revenue, and its gross margin"),
    x ? <ShareLine share={all > 0 ? x.rev / all : null} of="of the net revenue" margin={x.margin} lead={`article ${x.key || "—"}`} tint={TOPIC.articles.tint} /> : undefined);
};
const leadingFamily = (f: Frame) => {
  const x = leadFamily(f), named = namedRev(f);
  return item(largestView(f, "Leading material family", x, "The material family with the most net revenue - named compounds, unclassified left out"),
    x ? <ShareLine share={named > 0 ? x.rev / named : null} of="of the named compounds' net revenue" tint={TOPIC.materials.tint} /> : undefined);
};
const leadingCompound = (f: Frame) => {
  const x = f.d.compounds[0], named = namedRev(f);
  return item(largestView(f, "Leading identified compound", x, "The named compound with the most net revenue"),
    x ? <ShareLine share={named > 0 ? x.rev / named : null} of="of the named compounds' net revenue" margin={x.margin} tint={TOPIC.materials.tint} /> : undefined);
};
const negativeItem = (f: Frame, what: "customers" | "articles") => {
  const n = f.d.negative[what], all = f.d.totals.rev;
  return item(what === "customers" ? V.negCustomers(f) : V.negArticles(f),
    <ShareLine share={all > 0 ? n.rev / all : null} of={`of the net revenue sits with them · ${eur(n.rev)}`} tint={what === "customers" ? TOPIC.customers.tint : TOPIC.articles.tint} />);
};

/**
 * The pilot's Overview (revision.js overview), in its order: "Understand the business." - its four cards, "Where does
 * revenue come from?" and "Which materials sell most?", "From results to action" (the commercial priorities), "The
 * business at a glance" (who buys from us, which compounds lead, what sells most, which approvals matter). Then the hub's
 * own: each topic's figures against a year earlier and month by month, its title the way to its page.
 */
function Overview({ f, busy, err, again }: { f: Frame; busy: boolean; err: string | null; again: () => void }) {
  const [win, setWin] = useState<Win>(null);
  const [pick, setPick] = useState<DetailPick | null>(null);
  const router = useRouter();
  const inspect = useCallback((p: DetailPick) => { setWin(null); setPick(p); }, []);
  const open = (w: Win) => { setPick(null); setWin((x) => (x === w ? null : w)); };
  const units = topKeys(f.d.byBu);
  const custRows = rowsOf(f.d.customers), artRows = rowsOf(f.d.articles), compRows = rowsOf(f.d.compounds);
  const compound = { ...TOPIC.materials, icon: <ScienceOutlinedIcon />, tint: "purple" as Tint };
  const cards: [Item | null, Topic][] = [[largestCustomer(f), TOPIC.customers], [leadingFamily(f), TOPIC.materials], [leadingCompound(f), compound], [largestArticle(f), TOPIC.articles]];
  return (
    <InspectCtx.Provider value={inspect}>
      {/* the macro page's frame: the full width, the sections one under the other (marketing-kpis/page.tsx) */}
      <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
        <Head f={f} kicker="Sealing Business Review · Executive Committee pilot" title="Understand the business." lead="Who buys. What sells. Where to focus next."
          busy={busy} panel={win === "filters"} onPanel={() => open("filters")} />
        <Trouble err={err} again={again} />
        <Box sx={{ display: "grid", gap: 2.5, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)", opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }} aria-busy={busy}>
          {/* 1 · the pilot's cards: the largest customer account, the leading material family and compound, the largest article */}
          <Box sx={GRID}>
            {cards.filter((c): c is [Item, Topic] => !!c[0] && c[0].v.ytd != null).map(([it, t]) => <Tile key={it.v.id} f={f} it={it} t={t} span={QUARTER_SPAN} />)}
          </Box>
          {/* 2 · where revenue comes from, which materials sell most */}
          <Box sx={PAIR}>
            <BuMix f={f} title="Where does revenue come from?" hint="Click an organisation to explore its customer accounts"
              onPick={(k) => router.push(hrefOf("customers", plus(f.carry, "bu", k)))} />
            <FamilyMix f={f} onPick={(x) => router.push(hrefOf("materials", f.carry, undefined, { family: x }))} hint="Click a family to open its compounds" />
          </Box>
          {/* 3 · from results to action */}
          <Actions items={f.d.priorities} title="Commercial priorities" empty="Nothing in these months with these filters meets the thresholds of a priority." />
          {/* 4 · the business at a glance */}
          <SectionHead title="The business at a glance" hint="Click a name to explore the relationship" />
          <Box sx={PAIR}>
            <Ranked title="Who buys from us?" hint={`Top 5 of ${int(f.d.totals.customers)} customer accounts`} rows={custRows} by="rev" n={5}
              nameHead="Customer" onPick={(r) => inspect(pickOf("customer", r))} labelWidth={200} right={<MoreLink href={hrefOf("customers", f.carry)} />} />
            <Ranked title="Which compounds lead?" hint="Top 5 named entries · as written on the articles" rows={compRows} by="rev" n={5}
              nameHead="Compound" onPick={(r) => inspect(pickOf("compound", r))} labelWidth={200} right={<MoreLink href={hrefOf("materials", f.carry)} />} />
            <Ranked title="What sells most?" hint={`Top 5 of ${int(f.d.totals.articles)} articles`} rows={artRows} by="rev" n={5}
              nameHead="Article" onPick={(r) => inspect(pickOf("article", r))} labelWidth={200} right={<MoreLink href={hrefOf("articles", f.carry)} />} />
            <ApprovalShare f={f} href={hrefOf("approvals", f.carry)} />
          </Box>
          {/* the hub's own, after the pilot's: each topic against a year earlier, month by month - its title opens its page */}
          <SectionHead title="Against a year earlier" hint="Each topic month by month · its title opens its page" />
          <TopicPanel t={TOPIC.revenue} href={hrefOf("units", f.carry, "months")} note={`Every business unit's sealing invoices, ${f.now}`}>
            <Tiles f={f} t={TOPIC.revenue} items={[item(V.rev(f)), item(V.gp(f)), item(V.margin(f))]} />
          </TopicPanel>
          <TopicPanel t={TOPIC.customers} href={hrefOf("customers", f.carry)} note="The customer accounts invoiced, the largest one's share, the accounts at a negative margin">
            <Tiles f={f} t={TOPIC.customers} items={[item(V.customers(f)), item(V.customerShare(f)), negativeItem(f, "customers")]} />
          </TopicPanel>
          <TopicPanel t={TOPIC.articles} href={hrefOf("articles", f.carry)} note="The articles invoiced, the articles at a negative margin">
            <Tiles f={f} t={TOPIC.articles} items={[item(V.articles(f)), negativeItem(f, "articles")]} />
          </TopicPanel>
          <TopicPanel t={TOPIC.materials} href={hrefOf("materials", f.carry)} note={`The named compounds - ${pct(f.d.noCompoundShare)} of the net revenue names none`}>
            <Tiles f={f} t={TOPIC.materials} items={[item(V.compounds(f)), item(V.noCompound(f))]} />
          </TopicPanel>
          <TopicPanel t={TOPIC.approvals} href={hrefOf("approvals", f.carry)} note="What is written on the articles sold">
            <Tiles f={f} t={TOPIC.approvals} items={[item(V.noApproval(f)), item(V.withApproval(f)), item(V.approvals(f))]} />
          </TopicPanel>
          <TopicPanel t={TOPIC.units} href={hrefOf("units", f.carry)} note="Each Angst+Pfister company that invoiced - their margins and the sales organisations on the page">
            <Tiles f={f} t={TOPIC.units} items={units.keys.map((k, i) => item(keyView(f, `${units.names[i]} net revenue`, f.d.unitMonths, k)))} />
            <MarginChart f={f} title="Gross margin, by business unit" rows={rowsOf(f.d.byBu)} labelWidth={120} />
          </TopicPanel>
        </Box>
        <Foot f={f} slug="overview" onDefinitions={() => open("definitions")} />
        <FilterWindow f={f} open={win === "filters"} onClose={() => setWin(null)} />
        <Definitions open={win === "definitions"} onClose={() => setWin(null)} />
        <DetailWindow f={f} pick={pick} onClose={() => setPick(null)} />
      </Box>
    </InspectCtx.Provider>
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

/** The window open over a page besides the detail: the Filters, or the pilot's definitions. */
type Win = "filters" | "definitions" | null;

/** Above a title: whose review it is (the pilot's "Executive committee · Pilot 01"). */
const KICKER = { fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em" } as const;
/** Under a title: what the view is for (the pilot's "Who buys. What sells. Where to focus next."). */
const LEAD = { fontSize: "0.98rem", color: INK, lineHeight: 1.45 } as const;

/** The overview's head: the pilot's eyebrow, title and line, the period, the chips - and the Filters button on the right. */
function Head({ f, kicker, title, lead, busy, panel, onPanel }: { f: Frame; kicker?: string; title: string; lead?: string; busy: boolean; panel: boolean; onPanel: () => void }) {
  return (
    <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(240px, 1fr) auto" } }}>
      <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
        {kicker && <Typography sx={KICKER}>{kicker}</Typography>}
        <Typography component="h1" sx={H1}>{title}</Typography>
        {lead && <Typography sx={LEAD}>{lead}</Typography>}
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

/** The pilot's "Definitions & source notes" - a window as the Filters open, the hub's figures in the pilot's sections. */
function Definitions({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <FilterPanel id="sealing-definitions" open={open} onClose={onClose} title="Definitions & source notes" icon={<InfoOutlinedIcon />} tint="slate" width={520}
      closeLabel="Close the definitions" subtitle="About this review - how its figures are read">
      <Box sx={{ display: "grid", gap: 0, px: 1, py: 0.5 }}>
        {SEALING_DEFINITIONS.map((x, i) => (
          <Box key={x.title} sx={{ py: 1.4, borderTop: i ? `1px solid ${HAIRLINE}` : "none" }}>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, mb: 0.4 }}>{x.title}</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.55 }}>{x.text}</Typography>
          </Box>
        ))}
      </Box>
    </FilterPanel>
  );
}

/** Where the figures come from, and the pilot's source notes that still hold - small, at the foot - and its definitions. */
function Foot({ f, slug, onDefinitions }: { f: Frame; slug: SealingSlug; onDefinitions: () => void }) {
  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
      <Box sx={{ flex: "1 1 420px", minWidth: 0 }}><FootWords f={f} slug={slug} /></Box>
      <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={onDefinitions} aria-controls="sealing-definitions"
        sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
        Definitions &amp; source notes
      </Button>
    </Box>
  );
}

function FootWords({ f, slug }: { f: Frame; slug: SealingSlug }) {
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
    + " Selections overlap: totals across views are not additive."
    + (slug === "overview" ? " The priorities are illustrative sensitivities (+5 pp margin, +10% sales), never a forecast or a target." : "")
    + (slug === "customers" ? " Customer numbers stay apart even where two accounts carry the same name." : "")
    + (slug === "materials" || slug === "articles" ? " The material family follows the pilot's rule, by the compound's name; compounds are shown as written." : "")
    + (slug === "approvals" ? " An approval text is not a verified approval, and its category comes from its keywords only." : "");
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
      : pick.kind === "compound" ? `${noCompound(pick.key) ? "No compound named" : `${materialOf(pick.key)} family`}${d ? ` · ${int(d.count)} customer${d.count === 1 ? "" : "s"}` : ""}`
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
                  Indicative category: <b style={{ color: INK }}>{kindName}</b>. A text is not evidence of a current certification, nor of what caused a sale.
                </Typography>
              </Box>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Original text</Typography>
              <Typography sx={{ fontSize: "0.86rem", color: INK, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.55 }}>{pick.key}</Typography>
            </>
          ) : busy ? (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading its figures…</Typography></Box>
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
function ChartBox({ title, hint, right, children }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{title}</Typography>
          {hint && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{hint}</Typography>}
        </Box>
        {right}
      </Box>
      {children}
    </Box>
  );
}
const NONE = (what = "No invoice in these months with these filters.") => <Typography sx={{ fontSize: "0.85rem", color: MUTED, py: 2 }}>{what}</Typography>;

/* the pilot's charts, drawn by the hub's kit */

/** What a ranking ranks by - the pilot's "Rank by revenue / gross profit". */
type By = RankBy;
/** How many a ranking shows - the pilot's "Top 10 / 20 / 30 / All entries" (0: all). */
const TOPS = [10, 20, 30, 0];

/**
 * The pilot's controls above a view's charts (index.html controls): the search over names and identifiers, rank by net
 * revenue or gross profit, the first 10, 20, 30 or all - the business unit is the Filters'. The ranking and the
 * scatter follow them.
 */
function Controls({ what, q, onQ, by, onBy, n, onN, count, children }: {
  what: string; q: string; onQ: (q: string) => void; by: By; onBy: (b: By) => void; n: number; onN: (n: number) => void; count: number; children?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 36, flex: "1 1 260px", maxWidth: 460, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
        <SearchIcon sx={{ fontSize: 17, color: MUTED }} />
        <InputBase value={q} onChange={(e) => onQ(e.target.value)} placeholder={`Search ${what}…`} inputProps={{ "aria-label": `Search ${what}` }} sx={{ fontSize: "0.84rem", flex: 1 }} />
      </Box>
      <ToggleButtonGroup size="small" exclusive value={by} onChange={(_, v: By | null) => v && onBy(v)} aria-label="Rank by" sx={TOGGLE}>
        <ToggleButton value="rev">Rank by net revenue</ToggleButton>
        <ToggleButton value="gp">Rank by gross profit</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup size="small" exclusive value={n} onChange={(_, v: number | null) => v != null && onN(v)} aria-label="Number of results" sx={TOGGLE}>
        {TOPS.map((t) => <ToggleButton key={t} value={t}>{t ? `Top ${t}` : `All ${int(count)}`}</ToggleButton>)}
      </ToggleButtonGroup>
      {children}
    </Box>
  );
}

/** The rows the pilot's search finds - by name, identifier (and compound, on the articles). */
const found = (rows: Row[], q: string) => rows.filter((r) => matchesQuery(`${r.label} ${r.compound ?? ""}`, r.key, q));

/**
 * The pilot's ranking ("Who buys from us?", "What sells most?", "Which compounds lead?"): the rank, the name, its bar,
 * the figure ranked by and the gross margin beside it - a loss in red; ranked by net revenue or gross profit, the first
 * 10, 20, 30 or all; a click opens what the name is made of.
 */
function Ranked({ title, hint, rows, by, n, nameHead, onPick, labelWidth = 220, right, foot }: {
  title: string; hint?: string; rows: Row[]; by: By; n: number; nameHead: string;
  onPick?: (r: Row) => void; labelWidth?: number; right?: React.ReactNode; foot?: boolean;
}) {
  const shown = rankBy(rows, by, n);
  const byLabel = new Map(shown.map((r) => [r.label, r]));
  return (
    <ChartBox title={title} hint={hint} right={right}>
      {shown.length ? (
        <ChartFrame table={{ columns: ["Rank", nameHead, "Net revenue", "Gross profit", "Gross margin"], rows: shown.map((r, i) => [i + 1, r.label, Math.round(r.rev), Math.round(r.gp), pct(r.margin)]), numeric: [0, 2, 3, 4] }}>
          <BarList ranked format={eur} labelWidth={labelWidth} maxLabel={Math.max(18, Math.round(labelWidth / 6.6))}
            heads={{ label: nameHead, value: by === "gp" ? "Gross profit" : "Net revenue", note: "Gross margin" }}
            rows={shown.map((r) => ({ label: r.label, value: by === "gp" ? r.gp : r.rev, color: r.margin < 0 ? DELTA.bad : undefined, note: { text: pct(r.margin), color: r.margin < 0 ? DELTA.bad : DELTA.good } }))}
            onSelect={onPick ? (l) => { const r = byLabel.get(l); if (r) onPick(r); } : undefined} />
        </ChartFrame>
      ) : NONE("No records match this selection.")}
      {foot && (
        <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1.25 }}>
          {onPick ? "Click an entry to inspect its available detail. " : ""}Gross profit is the ERP's: the net revenue less the cost of the goods; the gross margin is the margin of the sums.
        </Typography>
      )}
    </ChartBox>
  );
}

/** The pilot's "Scale & profitability": the first ten of the ranking as bubbles - across their margin, up their revenue. */
function Scale({ rows, by, what, onPick }: { rows: Row[]; by: By; what: string; onPick?: (r: Row) => void }) {
  const top = rankBy(rows, by, 10);
  const byLabel = new Map(top.map((r) => [r.label, r]));
  return (
    <ChartBox title="Scale & profitability" hint={`Top ${top.length} ${what} in the current ranking · numbers match the list`}>
      {top.length ? (
        <ChartFrame table={{ columns: ["Rank", "Name", "Net revenue", "Gross margin"], rows: top.map((r, i) => [i + 1, r.label, Math.round(r.rev), pct(r.margin)]), numeric: [0, 2, 3] }}>
          <Bubbles points={top.map((r, i) => ({ label: r.label, x: r.margin, y: r.rev, size: r.rev, rank: i + 1, bad: r.margin < 0 }))}
            xFormat={pct} xTick={(v) => `${Math.round(v * 100)}%`} yFormat={eur} yTick={eurTick} xTitle="Gross margin" yTitle="Net revenue"
            onSelect={onPick ? (l) => { const r = byLabel.get(l); if (r) onPick(r); } : undefined} />
        </ChartFrame>
      ) : NONE()}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1 }}>Higher points represent more revenue. Further right represents a higher margin; a red one is a loss. Different product mixes can explain differences.</Typography>
    </ChartBox>
  );
}

/** The pilot's revenue mix: a ring of the parts of the net revenue, their legend beside it - a click picks one. */
function Mix({ title, hint, parts, first, centerLabel, onPick, selected, foot }: {
  title: string; hint?: string; parts: { label: string; value: number }[]; first: string; centerLabel: string;
  onPick?: (label: string) => void; selected?: string[]; foot?: string;
}) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  return (
    <ChartBox title={title} hint={hint}>
      {total > 0 ? (
        <ChartFrame table={{ columns: [first, "Net revenue", "Share"], rows: parts.map((p) => [p.label, Math.round(p.value), pct(p.value / total)]), numeric: [1, 2] }}>
          <Donut parts={parts} format={eur} centerLabel={centerLabel} onSelect={onPick} selected={selected} />
        </ChartFrame>
      ) : NONE()}
      {foot && <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1.25 }}>{foot}</Typography>}
    </ChartBox>
  );
}

const partsOf = (figs: Figure[]) => figs.map((x) => ({ label: x.name || x.key || NOT_KNOWN, value: x.rev }));
/** "the sealing invoices" or "the invoices chosen" - the pilot's "not total portfolio" in the hub's words. */
const scopeWords = (f: Frame) => (f.bus.length || f.orgs.length ? "The sealing invoices chosen in the Filters · not the total portfolio" : "Every business unit's sealing invoices (profit centre DT)");

/** "Where does revenue come from?" / "Business-unit contribution" (revision.js buMix) - each business unit's part; a click filters by it. */
function BuMix({ f, title, hint, onPick }: { f: Frame; title: string; hint?: string; onPick?: (key: string) => void }) {
  const keyOf = new Map(f.d.byBu.map((x) => [x.name || x.key || NOT_KNOWN, x.key]));
  const pick = (label: string) => { const k = keyOf.get(label); if (k) (onPick ?? ((x: string) => toggleParam("bu", x)))(k); };
  return <Mix title={title} hint={hint} parts={partsOf(f.d.byBu)} first="Business unit" centerLabel={f.bus.length || f.orgs.length ? "revenue in selection" : "net revenue"}
    onPick={pick} selected={f.bus.length ? f.bus : undefined} foot={scopeWords(f)} />;
}

/** "Which materials sell most?" (revision.js materialRows) - each family's part of the named compounds; a click opens its compounds. */
function FamilyMix({ f, onPick, chosen, hint }: { f: Frame; onPick: (family: string) => void; chosen?: string | null; hint?: string }) {
  return (
    <Mix title="Which materials sell most?" hint={hint} parts={partsOf(f.d.byFamily)} first="Material family" centerLabel="named compound revenue"
      onPick={onPick} selected={chosen ? [chosen] : undefined}
      foot="Named compound entries only. The family by the compound's name (Kalrez and Evolast are FFKM); a compound no rule names is Unclassified." />
  );
}

/** "Material mix of the articles" (revision.js detailView, articles) - the family of each article's compound; a click filters the articles. */
function ArticleMix({ f, onPick, chosen, hint }: { f: Frame; onPick: (family: string) => void; chosen?: string | null; hint?: string }) {
  const none = f.d.noCompoundShare * f.d.totals.rev;
  return (
    <Mix title="Material mix of the articles" hint={hint} parts={[...partsOf(f.d.byFamily), ...(none > 0 ? [{ label: NO_COMPOUND, value: none }] : [])]}
      first="Material family" centerLabel="article revenue" onPick={onPick} selected={chosen ? [chosen] : undefined}
      foot="The compound as written on the article - designations that do not match need validation." />
  );
}

const KIND_COLOR: Record<ApprovalKind, string> = { none: DEEMPHASIS, datasheet: SERIES[2], explicit: SERIES[0], other: SERIES[1] };

/**
 * The pilot's "Which approvals matter?" (index.html overview): the share of the revenue with no approval written, large,
 * that share against the rest as one bar, the references that appear - and the way to the evidence.
 */
function ApprovalShare({ f, href }: { f: Frame; href: string }) {
  const s = f.d.noApprovalShare, all = f.d.totals.rev;
  const named = leadingRefs(f.d.approvalRefs);
  return (
    <ChartBox title="Which approvals matter?" hint="Current evidence from the approvals written on the articles" right={<MoreLink href={href}>Inspect</MoreLink>}>
      {all > 0 ? (
        <>
          <Typography sx={{ fontSize: "2rem", fontWeight: 700, color: INK, letterSpacing: "-0.02em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{pct(s)}</Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, mb: 1.5 }}>of the net revenue has no approval written on the article.</Typography>
          <ShareBar keepOrder format={eur} segments={[
            { label: "No approval written", value: all * s, color: DEEMPHASIS },
            { label: "An approval written", value: all * (1 - s), color: ACCENT },
          ]} />
        </>
      ) : NONE()}
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1.25 }}>
        {named.length ? `${andList(named)} appear in some texts. ` : ""}The figures cannot establish which approvals caused sales.
      </Typography>
      <Box sx={{ mt: 1 }}><MoreLink href={href}>Explore the available evidence</MoreLink></Box>
    </ChartBox>
  );
}

/** The pilot's "The evidence available today" (index.html approvalSummary): the approval texts' revenue by their indicative category. */
function Evidence({ f }: { f: Frame }) {
  const kinds = f.d.approvalKinds;
  const all = kinds.reduce((a, k) => a + Math.max(0, k.rev), 0);
  return (
    <ChartBox title="The evidence available today" hint="Every approval text of the period · indicative text classifications, not validated approval status">
      {all > 0 ? (
        <ChartFrame table={{ columns: ["Category", "Net revenue", "Share"], rows: kinds.map((k) => [k.name, Math.round(k.rev), pct(k.rev / all)]), numeric: [1, 2] }}>
          <ShareBar keepOrder format={eur} segments={kinds.map((k) => ({ label: k.name, value: k.rev, color: KIND_COLOR[k.key as ApprovalKind] }))} />
        </ChartFrame>
      ) : NONE()}
      <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1.25 }}>Explicit references: FDA, WRAS, NSF, ACS, DVGW, KTW, USP, EC 1935, 3-A, BfR, LFGB, EN 681, W270, RoHS. Datasheet: a technical datasheet named.</Typography>
    </ChartBox>
  );
}

/**
 * The pilot's "Most prominent approval references" (index.html mentionSummary): the revenue of the texts mentioning each
 * reference - they overlap; a click searches the texts for it.
 */
function References({ f, onPick }: { f: Frame; onPick?: (ref: string) => void }) {
  const refs = f.d.approvalRefs.filter((r) => r.rev > 0);
  const none = f.d.approvalRefs.filter((r) => r.rev <= 0).map((r) => r.name);
  const all = f.d.totals.rev;
  return (
    <ChartBox title="Most prominent approval references" hint={`Revenue associated with the texts mentioning each reference. Groups overlap and cannot be added${onPick ? " · click one to inspect its texts" : ""}`}>
      {refs.length ? (
        <ChartFrame table={{ columns: ["Reference", "Net revenue", "Of the net revenue"], rows: refs.map((r) => [r.name, Math.round(r.rev), pct(all ? r.rev / all : 0)]), numeric: [1, 2] }}>
          <BarList format={eur} labelWidth={64} heads={{ label: "Reference", value: "Net revenue", note: "Of all" }} onSelect={onPick}
            rows={refs.map((r) => ({ label: r.name, value: r.rev, note: { text: pct(all ? r.rev / all : 0) } }))} />
        </ChartFrame>
      ) : NONE("No approval text of these months names one of them.")}
      {none.length > 0 && <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 1 }}>Named in no text of these months: {andList(none)}.</Typography>}
    </ChartBox>
  );
}

/**
 * The pilot's material cards (revision.js materialCards: "Materials first. Compounds next."), as the macro page's tiles -
 * each family's revenue, its compounds and margin, its share of the named compounds; the family list on the right, the
 * family chosen outlined; a click opens (or filters) its compounds.
 */
function FamilyTiles({ f, active = null, onPick }: { f: Frame; active?: string | null; onPick: (family: string | null) => void }) {
  const figs = familyFigures(f.d.compounds);
  const t = TOPIC.materials;
  if (!figs.length) return null;
  const pickList = (
    <Select size="small" value={active ?? ""} displayEmpty onChange={(e) => onPick(String(e.target.value) || null)} inputProps={{ "aria-label": "Material family" }}
      sx={{ height: 34, minWidth: 170, fontSize: "0.84rem", fontWeight: 600, borderRadius: "10px", bgcolor: "#fff" }}>
      <MenuItem value="">All materials</MenuItem>
      {figs.map((x) => <MenuItem key={x.key} value={x.key}>{x.name}</MenuItem>)}
    </Select>
  );
  return (
    <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={t.icon} tint={t.tint} title="Materials first. Compounds next." note="Choose a family to explore the compounds underneath it" right={pickList} />
      <Box sx={{ ...GRID, mt: -1 }}>
        {figs.map((x) => {
          const on = active === x.key;
          return (
            <Box key={x.key} component="button" type="button" onClick={() => onPick(on ? null : x.key)} aria-pressed={on} title={on ? "Click again for all materials" : `Open the ${x.name} compounds`}
              sx={{
                ...TILE_SPAN, minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", p: 0, border: 0, bgcolor: "transparent", font: "inherit", textAlign: "left", cursor: "pointer", borderRadius: "20px",
                opacity: active && !on ? 0.6 : 1,
                "& > div": on ? { boxShadow: `inset 0 0 0 2px ${TINT[t.tint].fg}` } : {},
                "&:hover > div": { boxShadow: `inset 0 0 0 1.5px ${TINT[t.tint].fg}` }, "&:hover": { opacity: 1 }, "&:focus-visible": { outline: `2px solid ${TINT[t.tint].fg}`, outlineOffset: 2 },
              }}>
              <KpiTileChart v={keyView(f, x.name, f.d.familyMonths, [x.key], `The ${x.name} compounds' net revenue`)} slug="sealing" tint={t.tint} icon={t.icon} upTo={f.upTo} title={x.name}
                chart={<ShareLine share={x.share} of="of named-entry revenue" margin={x.margin} lead={`${int(x.count)} compound ${x.count === 1 ? "entry" : "entries"}`} tint={t.tint} />} />
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: -0.5 }}>
        Material families are derived from compound names (Kalrez → FFKM). Compound designations and amounts remain unchanged. Unresolved entries are excluded from family totals.
      </Typography>
    </GlassCard>
  );
}

/* the hub's own charts - against a year earlier, month by month - under the pilot's */

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
function FigTable({ f, title, first, rows, extra = [], total = null, find, withPrev = true, query, onQuery }: {
  f: Frame; title: string; first: string; rows: Row[]; extra?: Col[]; total?: Row | null; find?: string; withPrev?: boolean;
  /** the search, when a chart above sets it (the approval references) */
  query?: string; onQuery?: (q: string) => void;
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

/** The page's KPI cards (data.tsx KpiCard): the figure, against the same months a year earlier, its months - or its own graph. */
function KpiCards({ f, t, items }: { f: Frame; t: Topic; items: (Item | null)[] }) {
  const shown = items.filter((x): x is Item => !!x && x.v.ytd != null);
  if (!shown.length) return null;
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(auto-fit, minmax(380px, 1fr))" } }}>
      {shown.map(({ v, chart }) => (
        <KpiCard key={v.id} v={v} icon={t.icon} tint={t.tint} upTo={f.upTo} title={v.id}>
          {chart ?? (v.series.months.some((x) => x != null) ? <MonthsChart f={f} v={v} /> : undefined)}
        </KpiCard>
      ))}
    </Box>
  );
}

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

/** The pilot's third card, "Reporting period" - drawn as a figure card (ExplorerKit FigureCards) with the period's words. */
function PeriodFigure({ f }: { f: Frame }) {
  return (
    <Box sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 124, maxWidth: 200, display: "grid", gap: 0.25, alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Badge icon={<CalendarMonthOutlinedIcon />} tint="slate" size={22} />
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>Reporting period</Typography>
      </Box>
      <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, letterSpacing: "-0.01em" }}>{f.now}</Typography>
      <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{hasBefore(f) ? `against ${f.before} · month by month` : "month by month"}</Typography>
    </Box>
  );
}

/** The hub's own, after the pilot's content on a page: its heading. */
const HubAfter = ({ hint }: { hint: string }) => <SectionHead title="Against a year earlier" hint={hint} />;

/** A business unit or a sales organisation (the hub's own page): where revenue comes from, its margin, a year earlier, its months, every figure. */
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
  const picked = chosen.length ? rows.filter((r) => chosen.includes(r.key)).map((r) => r.label) : undefined;
  return (
    <Breakdown t={t} title={`Where does revenue come from? By ${what}, ${f.now}`}
      note={`${units ? "The Angst+Pfister company that invoiced" : "The organisation that sold to the customer"} · ${against(f)} · click one to show only it`}
      charts={<>
        <Mix title={units ? "Business-unit contribution" : "Sales-organisation contribution"} hint={`Revenue split within the selection · click one to show only it`}
          parts={rows.map((r) => ({ label: r.label, value: r.rev }))} first={units ? "Business unit" : "Sales organisation"} centerLabel="revenue in selection" onPick={pick} selected={picked} foot={scopeWords(f)} />
        <MarginChart f={f} title={`Gross margin, by ${what}`} rows={rows} labelWidth={units ? 120 : 190} />
        <Wide><RevenueChart f={f} title={`Net revenue against the same months a year earlier, by ${what}`} rows={rows} labelWidth={units ? 120 : 190} onPick={pick} selected={picked} /></Wide>
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
      <KpiCards f={f} t={TOPIC.revenue} items={[item(V.rev(f)), item(V.gp(f)), item(V.margin(f))]} />
      <Breakdown t={TOPIC.revenue} title={`Net revenue month by month, ${f.now}`} note={`Each month's invoices · ${against(f)}`}
        charts={<Wide><MonthStack f={f} rows={f.d.unitMonths} order={f.d.byBu.map((x) => ({ key: x.key, name: x.name || NOT_KNOWN }))} title="Net revenue month by month, by business unit" /></Wide>}
        table={null} />
    </>
  );
}

/** The compound to inspect from a page's third card - the spread priority's, else the leading compound. */
const compareCompound = (f: Frame) => f.d.priorities.find((p) => p.kind === "spread")?.compound ?? f.d.compounds[0]?.name ?? "";
/** The rows as the pilot's review cards read them. */
const positions = (rows: Row[]) => rows.map((r) => ({ name: r.label, rev: r.rev, margin: r.margin }));

/** A view's ranking state - the pilot's search, rank by and how many (index.html go: revenue, the first 10). */
function useRanking(initial = "") {
  const [q, setQ] = useState(initial);
  const [by, setBy] = useState<By>("rev");
  const [n, setN] = useState(10);
  return { q, setQ, by, setBy, n, setN };
}

/**
 * The pilot's Customers view (index.html detailView + revision.js): "Our leading customers" - its cards top right, the
 * search and ranking controls, the notice, "Business-unit contribution" and "Scale & profitability", the ranking, the
 * account review priorities. Then the hub's own: a year earlier, month by month, every figure.
 */
function CustomersTab({ f }: { f: Frame }) {
  const inspect = useContext(InspectCtx);
  const k = useRanking();
  const all = rowsOf(f.d.customers);
  const rows = found(all, k.q);
  const t = TOPIC.customers;
  const open = (r: Row) => inspect(pickOf("customer", r));
  return (
    <>
      <Controls what="customers or identifiers" q={k.q} onQ={k.setQ} by={k.by} onBy={k.setBy} n={k.n} onN={k.setN} count={rows.length} />
      <Notice>Customer numbers remain separate even when names match. With a business unit chosen in the Filters, the ranking covers only its accounts{f.d.customers.length < f.d.totals.customers ? ` · the ${int(f.d.customers.length)} accounts with the most net revenue of ${int(f.d.totals.customers)} invoiced are ranked` : ""}.</Notice>
      <Box sx={PAIR}>
        <BuMix f={f} title="Business-unit contribution" hint="Revenue split within the selected customer accounts · click one to show only its customers" />
        <Scale rows={rows} by={k.by} what="accounts" onPick={open} />
      </Box>
      <Ranked title="Customer accounts, ranked" hint={`${k.by === "gp" ? "By gross profit" : "By net revenue"} · each with its gross margin${k.q ? ` · search "${k.q.trim()}"` : ""}`} rows={rows} by={k.by} n={k.n}
        nameHead="Customer" onPick={open} labelWidth={260} foot />
      <Actions items={reviewActions("customers", positions(rows), f.d.totals.rev, compareCompound(f))} title={actionsCaption(f.bus)} />
      {/* the hub's own, after the pilot's */}
      <HubAfter hint="The customer accounts month by month, against the same months a year earlier" />
      <KpiCards f={f} t={t} items={[item(V.customers(f)), largestCustomer(f), item(V.customerShare(f)), negativeItem(f, "customers")]} />
      <Breakdown t={t} title={`The customer accounts against a year earlier, ${f.now}`} note={`${int(f.d.totals.customers)} customer accounts invoiced · ${against(f)}`}
        charts={<>
          <RevenueChart f={f} title="Net revenue against the same months a year earlier" rows={all} labelWidth={220} pageSize={12} />
          <MarginChart f={f} title="Gross margin of the largest customers" rows={all} labelWidth={220} top={60} pageSize={12} />
        </>}
        table={<FigTable f={f} title="All the figures, by customer" first="Customer" rows={all} find="a customer" extra={[{ head: "Customer number", cell: (r) => r.key || "—", sort: (r) => r.key, text: true }]} />}
      />
    </>
  );
}

/**
 * The pilot's Articles view: "The products behind the revenue" - its cards, the controls, the notice, the breadcrumb of a
 * material chosen, "Business-unit contribution" and the articles' material mix, the ranking, the review priorities.
 * Then the hub's own.
 */
function ArticlesTab({ f }: { f: Frame }) {
  const inspect = useContext(InspectCtx);
  const params = useSearchParams();
  const k = useRanking();
  const asked = params.get("family");
  const family = asked && (asked === NO_COMPOUND || f.d.byFamily.some((x) => x.key === asked)) ? asked : null;
  const all = rowsOf(f.d.articles);
  const ofFamily = family ? all.filter((r) => familyOfArticle(r.compound ?? "") === family) : all;
  const rows = found(ofFamily, k.q);
  const t = TOPIC.articles;
  const open = (r: Row) => inspect(pickOf("article", r));
  return (
    <>
      <Controls what="articles or identifiers" q={k.q} onQ={k.setQ} by={k.by} onBy={k.setBy} n={k.n} onN={k.setN} count={rows.length} />
      <Notice>Compound labels are shown as written on the article; apparent designation mismatches need validation. With a business unit chosen in the Filters, the ranking covers only its articles{f.d.articles.length < f.d.totals.articles ? ` · the ${int(f.d.articles.length)} articles with the most net revenue of ${int(f.d.totals.articles)} invoiced are ranked` : ""}.</Notice>
      {/* the pilot's breadcrumb when a material is chosen: "All article materials / FKM" */}
      {family && (
        <Box>
          <Chip size="small" label={<span><b>All article materials</b> / {family} · {int(ofFamily.length)} of the {int(all.length)} articles</span>} onDelete={() => setParam("family", null)}
            sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[t.tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[t.tint].fg } }} />
        </Box>
      )}
      <Box sx={PAIR}>
        <BuMix f={f} title="Business-unit contribution" hint="Revenue split within the selected articles · click one to show only it" />
        <ArticleMix f={f} chosen={family} onPick={(x) => setParam("family", x === family ? null : x)} hint="Click to filter these articles. Compound labels need validation" />
      </Box>
      <Ranked title={family ? `Articles, ranked · ${family}` : "Articles, ranked"} hint={`${k.by === "gp" ? "By gross profit" : "By net revenue"} · each with its gross margin${k.q ? ` · search "${k.q.trim()}"` : ""}`}
        rows={rows} by={k.by} n={k.n} nameHead="Article" onPick={open} labelWidth={300} foot />
      <Actions items={reviewActions("articles", positions(rows), f.d.totals.rev, compareCompound(f))} title={actionsCaption(f.bus)} />
      {/* the hub's own, after the pilot's */}
      <HubAfter hint="The articles month by month, against the same months a year earlier" />
      <KpiCards f={f} t={t} items={[item(V.articles(f)), largestArticle(f), negativeItem(f, "articles")]} />
      <Breakdown t={t} title={`The articles against a year earlier${family ? ` · ${family}` : ""}, ${f.now}`} note={`${int(f.d.totals.articles)} articles invoiced, each with its compound · ${against(f)}`}
        charts={<>
          <RevenueChart f={f} title="Net revenue against the same months a year earlier" rows={ofFamily} labelWidth={220} pageSize={12} />
          <MarginChart f={f} title="Gross margin of the largest articles" rows={ofFamily} labelWidth={220} top={60} pageSize={12} />
        </>}
        table={<FigTable f={f} title={family ? `All the figures, by article · ${family}` : "All the figures, by article"} first="Article" rows={ofFamily} find="an article" extra={[
          { head: "Article number", cell: (r) => r.key || "—", sort: (r) => r.key, text: true },
          { head: "Compound", cell: (r) => r.compound || "—", sort: (r) => (r.compound ?? "").toLowerCase(), text: true },
        ]} />}
      />
    </>
  );
}

/**
 * The pilot's "Materials & compounds" view (revision.js compounds): "Materials first. Compounds next." - the family
 * cards and list, the breadcrumb, the controls with "Include unresolved entries", the notice, the compounds' ranking,
 * the commercial priorities of the family. Then the hub's own.
 */
function CompoundsTab({ f }: { f: Frame }) {
  const inspect = useContext(InspectCtx);
  const params = useSearchParams();
  const [unresolved, setUnresolved] = useState(false);
  const k = useRanking();
  const asked = params.get("family");
  const family = asked && f.d.byFamily.some((x) => x.key === asked) ? asked : null;
  const list = [...f.d.compounds, ...(unresolved ? f.d.unresolved : [])].filter((c) => !family || materialOf(c.name) === family);
  const all = rowsOf(list);
  const rows = found(all, k.q);
  const t = { ...TOPIC.materials, icon: <ScienceOutlinedIcon />, tint: "purple" as Tint };
  const open = (r: Row) => inspect(pickOf("compound", r));
  const chipSx = (on: boolean) => ({ height: 30, fontSize: "0.78rem", fontWeight: 600, bgcolor: on ? TINT.purple.bg : "#fff", color: on ? TINT.purple.fg : INK, border: `1px solid ${on ? TINT.purple.fg : "rgba(21,34,58,.14)"}` });
  return (
    <>
      <FamilyTiles f={f} active={family} onPick={(x) => setParam("family", x)} />
      {/* the pilot's breadcrumb: "All materials / FKM / Compounds" */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", fontSize: "0.84rem", color: MUTED }}>
        <Button size="small" onClick={() => setParam("family", null)} sx={{ textTransform: "none", fontWeight: 700, minWidth: 0, px: 0.5 }}>All materials</Button>
        <span>/ {family ? `${family} / Compounds` : "Compounds"}</span>
      </Box>
      <Controls what="compounds" q={k.q} onQ={k.setQ} by={k.by} onBy={k.setBy} n={k.n} onN={k.setN} count={rows.length}>
        {f.d.unresolved.length > 0 && (
          <Chip icon={unresolved ? <CheckIcon /> : undefined} label={`Include unresolved entries (${int(f.d.unresolved.length)})`} onClick={() => setUnresolved((x) => !x)} aria-pressed={unresolved} sx={chipSx(unresolved)} />
        )}
      </Controls>
      <Notice>A compound&apos;s customers come from the same invoices, so their totals match its own. Name variants of one compound remain separate; no names are merged. {pct(f.d.noCompoundShare)} of the net revenue names no compound.</Notice>
      <Ranked title={family ? `Compounds, ranked · ${family}` : "Compounds, ranked"} hint={`${k.by === "gp" ? "By gross profit" : "By net revenue"} · each with its gross margin${unresolved ? " · the unresolved entries included" : " · named entries only"}`}
        rows={rows} by={k.by} n={k.n} nameHead="Compound" onPick={open} labelWidth={260} foot />
      <Actions items={familyActions(f.d.priorities, family, list)} title="Commercial priorities" />
      {/* the hub's own, after the pilot's */}
      <HubAfter hint="The compounds against the same months a year earlier" />
      <Breakdown t={t} title={`The compounds against a year earlier${family ? ` · ${family}` : ""}, ${f.now}`}
        note={`${int(all.length)} compound${all.length === 1 ? "" : "s"}${unresolved ? ", the unresolved entries included" : " named"} · ${against(f)}`}
        charts={<>
          <RevenueChart f={f} title="Net revenue against the same months a year earlier" rows={all} labelWidth={200} pageSize={12} />
          <MarginChart f={f} title="Gross margin of the largest compounds" rows={all} labelWidth={200} top={60} pageSize={12} />
        </>}
        table={<FigTable f={f} title="All the figures, by compound" first="Compound" rows={all} find="a compound" total={null}
          extra={[{ head: "Material family", cell: (r) => (noCompound(r.key) ? NO_COMPOUND : materialOf(r.key)), sort: (r) => materialOf(r.key), text: true }]} />}
        foot="Compounds are shown as written - two spellings of one compound stay apart. A click on a compound opens its customers."
      />
    </>
  );
}

/** The hub's own: the material families against a year earlier, month by month (the pilot's families, by their revenue). */
function FamiliesTab({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.byFamily);
  const t = TOPIC.materials;
  const toCompounds = (family: string) => setQuery((q) => { q.delete("tab"); q.set("family", family); });
  return (
    <>
      <KpiCards f={f} t={t} items={[leadingFamily(f), leadingCompound(f), item(V.noCompound(f)), item(V.compounds(f))]} />
      <Breakdown t={t} title={`Which materials sell most? ${f.now}`}
        note={`Named compounds only - ${pct(f.d.noCompoundShare)} of the net revenue names none · ${against(f)}`}
        charts={<>
          <FamilyMix f={f} onPick={toCompounds} hint="Click a family to open its compounds" />
          <MarginChart f={f} title="Gross margin, by material family" rows={rows} labelWidth={120} />
          <Wide><RevenueChart f={f} title="Net revenue against the same months a year earlier, by material family" rows={rows} labelWidth={120} /></Wide>
          <Wide><MonthStack f={f} rows={f.d.familyMonths} order={f.d.byFamily.map((x) => ({ key: x.key, name: x.name }))} title="Net revenue month by month, by material family" /></Wide>
        </>}
        table={<FigTable f={f} title="All the figures, by material family" first="Material family" rows={rows} total={rows.length > 1 ? totalOf(rows, "All named compounds") : null} />}
        foot="The family follows the pilot's rule, by the compound's name: FFKM (Kalrez, Evolast), HNBR, FKM (FPM), EPDM, NBR, VMQ (silicone), PTFE - any other compound is Unclassified."
      />
    </>
  );
}

/**
 * The pilot's "Approval information" view (index.html detailView, approvals): its cards, "Most prominent approval
 * references", "The evidence available today", the controls, the notice, the ranking, "What should we do?". Then the
 * hub's own.
 */
function ApprovalsTab({ f }: { f: Frame }) {
  const inspect = useContext(InspectCtx);
  const params = useSearchParams();
  const k = useRanking(params.get("find") ?? "");
  const all = rowsOf(f.d.approvals);
  const rows = found(all, k.q);
  const t = TOPIC.approvals;
  // the pilot's data-mention: a reference searches the texts
  const mention = (ref: string) => {
    k.setQ(ref);
    document.getElementById("sealing-approvals-ranking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <>
      <References f={f} onPick={mention} />
      <Evidence f={f} />
      <Box id="sealing-approvals-ranking" sx={{ scrollMarginTop: 16 }}>
        <Controls what="approval texts" q={k.q} onQ={k.setQ} by={k.by} onBy={k.setBy} n={k.n} onN={k.setN} count={rows.length} />
      </Box>
      <Notice>Approvals as written are not verified approvals. Revenue is associated with the text, not attributed to an approval causing a sale. The {int(all.length)} texts with the most net revenue are ranked; {pct(f.d.noApprovalShare)} of the net revenue has none.</Notice>
      <Ranked title="Approval texts, ranked" hint={`${k.by === "gp" ? "By gross profit" : "By net revenue"} · each with its gross margin${k.q ? ` · search "${k.q.trim()}"` : ""}`} rows={rows} by={k.by} n={k.n}
        nameHead="Approval as written" onPick={(r) => inspect(pickOf("approval", r))} labelWidth={320} foot />
      <Actions items={APPROVAL_ACTIONS} title="What should we do?" first />
      {/* the hub's own, after the pilot's */}
      <HubAfter hint="The approvals month by month, against the same months a year earlier" />
      <KpiCards f={f} t={t} items={[item(V.noApproval(f)), item(V.withApproval(f)), item(V.approvals(f))]} />
      <Breakdown t={t} title={`The approvals against a year earlier, ${f.now}`} note={`${pct(f.d.noApprovalShare)} of the net revenue has no approval written on the article · ${against(f)}`}
        charts={<Wide><MarginChart f={f} title="Gross margin of the largest approvals" rows={all} labelWidth={260} top={30} /></Wide>}
        table={<FigTable f={f} title="All the figures, by approval" first="Approval as written" rows={all} find="an approval" query={k.q} onQuery={k.setQ} />}
        foot="A text can name several approvals, and the figures cannot tell which approval caused a sale."
      />
    </>
  );
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
    tabs: [{ id: "customers", label: "Customers", Body: CustomersTab }],
  },
  articles: {
    title: "The products behind the revenue", lead: "Explore articles, compound labels and customer exposure.", topic: TOPIC.articles,
    figures: (f) => [
      inSelection(f),
      { label: "Articles invoiced", icon: glyph(InventoryOutlinedIcon), tint: "pink", v: V.articles(f) },
    ],
    tabs: [{ id: "articles", label: "Articles", Body: ArticlesTab }],
  },
  materials: {
    title: "Our compound portfolio", lead: "Materials first, compounds next - the compounds as written on the articles.", topic: TOPIC.materials,
    figures: (f) => [
      { label: "Revenue in this selection", icon: glyph(EuroOutlinedIcon), tint: "blue", v: keyView(f, "Named compound revenue", f.d.familyMonths, f.d.byFamily.map((x) => x.key)), sub: "named compound entries" },
      { label: "Compound entries named", icon: glyph(ScienceOutlinedIcon), tint: "purple", v: V.compounds(f) },
    ],
    tabs: [
      { id: "compounds", label: "Materials & compounds", count: (f) => String(f.d.compounds.length), Body: CompoundsTab },
      { id: "families", label: "By material family", count: (f) => String(f.d.byFamily.length), Body: FamiliesTab },
    ],
  },
  approvals: {
    title: "Approval information", lead: "What the approvals written on the articles can currently tell us.", topic: TOPIC.approvals,
    figures: (f) => [
      inSelection(f),
      { label: "Approval texts written", icon: glyph(VerifiedOutlinedIcon), tint: "slate", v: V.approvals(f) },
    ],
    tabs: [{ id: "approvals", label: "Approvals", Body: ApprovalsTab }],
  },
  units: {
    title: "Business units", lead: "Where does revenue come from? Each Angst+Pfister company that invoiced, and the organisations that sold.", topic: TOPIC.units,
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
};

/**
 * A view's page, as a stage page of Digital Growth: the way back; the pilot's view name, title and line on the left,
 * its cards top right; the tabs and the Filters; the view; its foot and the definitions.
 */
function TopicPage({ slug, f, busy, err, again }: { slug: Exclude<SealingSlug, "overview">; f: Frame; busy: boolean; err: string | null; again: () => void }) {
  const page = PAGES[slug];
  const params = useSearchParams();
  const asked = params.get("tab");
  const tab = page.tabs.find((x) => x.id === asked) ?? page.tabs[0];
  const setTab = (id: string) => setQuery((q) => { if (id === page.tabs[0].id) q.delete("tab"); else q.set("tab", id); });
  const [win, setWin] = useState<Win>(null);
  const [pick, setPick] = useState<DetailPick | null>(null);
  const inspect = useCallback((p: DetailPick) => { setWin(null); setPick(p); }, []);
  const openWin = (w: Win) => { setPick(null); setWin((x) => (x === w ? null : w)); };
  const figures = page.figures(f).filter((x): x is PageFigure & { v: SView } => !!x.v);
  const name = SEALING_PAGES.find((p) => p.slug === slug)?.name ?? page.title;
  return (
    <InspectCtx.Provider value={inspect}>
      {/* the stage page's frame ([stage]/page.tsx): the way back, then the page */}
      <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.25 }}>
        <Box component={Link} href={hrefOf("overview", f.carry)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to the overview
        </Box>
        <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
          {/* the pilot's title and line on the left; its cards top right */}
          <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
            <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
              <Typography sx={KICKER}>Sealing Business Review · {name}</Typography>
              <Typography component="h1" sx={H1}>{page.title}</Typography>
              <Typography sx={LEAD}>{page.lead}</Typography>
              <Line f={f} busy={busy} />
              <Chosen f={f} />
            </Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start", justifyContent: { lg: "flex-end" }, opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }}>
              <FigureCards items={figures.map((x, i) => ({ id: `${i}-${x.label}`, ...x }))} />
              <PeriodFigure f={f} />
            </Box>
          </Box>
          {/* the tabs, and at their right end the Filters button */}
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
            <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
              {page.tabs.length > 1 && <ReportTabs name={`sealing-${slug}`} tab={tab.id} onSelect={setTab} tabs={page.tabs.map((x) => ({ id: x.id, label: x.label, count: x.count?.(f) ?? null }))} />}
            </Box>
            <Box sx={{ flex: 1 }} />
            <FiltersButton f={f} open={win === "filters"} onClick={() => openWin("filters")} />
          </Box>
          <Trouble err={err} again={again} />
          <Box id={`sealing-${slug}-panel-${tab.id}`} sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)", opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }} aria-busy={busy}>
            <tab.Body f={f} />
          </Box>
          <Foot f={f} slug={slug} onDefinitions={() => openWin("definitions")} />
        </Box>
        <FilterWindow f={f} open={win === "filters"} onClose={() => setWin(null)} />
        <Definitions open={win === "definitions"} onClose={() => setWin(null)} />
        <DetailWindow f={f} pick={pick} onClose={() => setPick(null)} />
      </Box>
    </InspectCtx.Provider>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

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
  const f = frameOf(d, bus, orgs, carry, ask);
  return slug === "overview"
    ? <Overview f={f} busy={busy} err={err} again={again} />
    : <TopicPage slug={slug} f={f} busy={busy} err={err} again={again} />;
}

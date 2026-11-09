"use client";
// BACK-OFFICE REPORTS (SARCLA 02.11.2026: "and the back office reports based on file?" - his picks "Live, file = the KPI
// list" and "like on the ESO / TSA, split per topic"): the Back Office's KPI workbook (sheet "BO KPI") worked out live -
// and, first, the BUC View as ESO's and TSA's (SARCLA 03.11.2026: "BUC View is missing on Back-Office Reports"): a panel
// per page, its figures, the graphs sent there with Actions. Rules: src/lib/reporting/boReportRules.ts.
//
// 03.11.2026, on the live pages: "the graphs are really shit, categories not good - rethink based on the excel file all
// the view, the tab as a real advanced reporting"; on the proposals drawn from the workbook: "it looks much better, but it
// should be in harmony with the other advanced reports". So a page per block of the workbook, in its order - Team totals,
// Topics, ESO & TSA tickets, GQS, OTD, KPI autonomy, Stopped orders - each as ESO's ticket pages: its figures top right, a
// tab per question, one card that follows the tab with its graphs two by two (the hub's own GroupedColumns,
// StackedColumns, MonthTrend, BarList, DimChart), and under it the workbook's table, a KPI a row, a month a column.
//
// 03.11.2026 evening, on the live pages: "doesn't have customer filter view, the year on top doesn't match the rest of the
// platform", "Team totals should have a graph by people to measure the workflow - how many came in automatic or customer,
// how much closed month by month", "created should come before closed", the table "a separate tab", "days to close ... the
// breakdown per category", "STILL NO PROFIT CENTER?". So the period and the filters (topic, person, where it came from, the
// customer's category, country, priority) in a Filters window as on ESO's pages, the tab row beside it, a People tab, the
// speed per topic, the table a tab of its own; the tickets are kept one by one for it (boReport.ts, version 3).
// Later that evening: the People graphs "limited to Back Office, a hidden row for wrong owners", each person month by month
// drawn anew, on Speed the first reply by person and the customer tickets closed without any answer, Workload "a real
// insight into team workload", the profit centres and a diagram of the whole on Orders & ratios, Customer tone renamed
// Sentiment with the survey sent after a ticket is closed, the Table first and drawn anew. Round 5: the Table in red and
// green against the period's average, the hours typed into it; the tickets behind every graph (the shared list, as the
// Companies of the other reports); the balance of each person; tickets per 100 orders by where they came from and C2S;
// Sentiment split into the Survey and the Detected tone, each by person. Round 6: the hours to type in marked, a filter on
// every graph, the orders diagram in totals, a C2S tab, a Chat handling tab (how fast the first call or e-mail, closed with
// or without any activity - boReport.ts readChat), the people ranked against the months before (the ESO pages' leaderboard).
// Round 7 (04.11.2026): each ticket's profit centre from its linked order - "per profit centre which types of tickets";
// C2S against its orders and their value month by month; the chat's first contact from the chat v3 on, "no contact" split
// into closed and still open; Topics reviewed - by person, by profit centre, the speed per topic. Round 8: the months keep
// their earlier count on show while counted again ("it's empty"); Topics completed - the topic table under All topics, the
// small graphs bigger, each person's and each profit centre's topics as tables, tickets per 100 orders per profit centre.
//
// Every graph is defined once (CHARTS) and drawn the same on its page and in the BUC View, keyed "bo-<page>:main:<id>".

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import WorkHistoryOutlinedIcon from "@mui/icons-material/WorkHistoryOutlined";
import SentimentNeutralOutlinedIcon from "@mui/icons-material/SentimentNeutralOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import CreditCardOffOutlinedIcon from "@mui/icons-material/CreditCardOffOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PercentOutlinedIcon from "@mui/icons-material/PercentOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import FactoryOutlinedIcon from "@mui/icons-material/FactoryOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";

import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { CardFilterFor, ChartBox, FullTable, H1, Leaderboard, TWO, setQuery, type BoardRow, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { ActiveFilters, PeriodPicker, quartersOf, type ActiveItem } from "@/app/reporting/eso-benchmark/EsoFilters";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { MonthTrend } from "@/app/reporting/eso-benchmark/TicketsCharts";
import { BucEmpty } from "@/app/reporting/eso-benchmark/BucEmpty";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import { FigureCards, MONTHS, changeOf, int, pct, tone, signedPct, withChangeCell, type Fig } from "@/app/reporting/products/views/kit";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { TrendChart } from "@/app/charts/TrendChart";
import { BarList } from "@/app/charts/BarList";
import { DEEMPHASIS, SEQUENTIAL, SERIES } from "@/app/charts/palette";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { CompaniesFor, type CompanySource } from "@/app/reporting/CompanyList";
import { Sankey } from "@/app/charts/Sankey";
import type { ArtInfo, BoRead, ChatRow } from "@/lib/reporting/boReport";
import { IN, inZero, type InDetail, type InRow } from "@/lib/reporting/boInbound";
import { HIST, LATE, bands, both, byDate, histSum, medianWd, sumDMonths, within, type DMonth, type DeliveryKept } from "@/lib/reporting/boDelivery";
import { PRICES_FROM, handRows, ownPriceCustomers, type PricesKept } from "@/lib/reporting/boPrices";
import {
  LATE_BANDS, LEAD_BANDS, NO_SUPPLIER, OPEN_DUE_WD, OTHER_SUPPLIERS, addWd, keysOf, otdSum, pairOf, priceOf, priceSum, transitOf,
  type ErpLinesKept, type OtdCounts, type OtdPick, type PriceCounts,
} from "@/lib/reporting/boErpLines";
import { FIRST_MONTH as GQS_FIRST, FLOW_COLUMNS, STAGE_LABEL, STAGE_WHO, WORK, daysTo, flowOf, offersOf, refusalsOf, stageTimes, sumOf, winRate, type FlowNode, type GSum, type GStage, type GqsTask } from "@/lib/reporting/boGqs";
import { GqsOpenBars } from "@/app/reporting/eso-benchmark/TicketsGqs";
import type { GOpen } from "@/lib/reporting/esoGqs";
import type { Reason } from "@/lib/gqsApprovals/rules";
import {
  ORIGINS, PC_FROM, RCL, RW, TOPIC_ORDER, TYPED, artsOf, emptyMonth, filteredMonth, hasTickets, kpisOf, passes, sumGqs, sumMonths, swissDay, topicLabel, typedKey,
  type BoFilter, type BoKpis, type BoMonth, type CoFacts, type GqsMonth, type Typed, type TypedSeries,
} from "@/lib/reporting/boReportRules";

/* ── the read ──────────────────────────────────────────────────────────── */

type Data = BoRead & {
  hours: Record<string, number>; typed: Typed; inbound: { eso: Record<string, number>; tsa: Record<string, number> } | null;
  /** the ESO's and the TSA's incoming tickets in detail - win rate, first contact, outcomes - per month, channel, owner */
  inDetail?: InDetail | null;
  /** the tickets' owners by their HubSpot id, and their companies' facts for the filters */
  names?: Record<string, string>; companies?: CoFacts;
  /** the Back Office team (owner ids, from the hierarchy), and the answers to the survey sent after a ticket is closed */
  team?: string[]; surveys?: BoSurvey[];
  /** each delivery's speed, from the ERP's order file (the chain's order_sync, every night) - OTD > Delivery speed */
  delivery?: DeliveryKept | null;
  /** OTD, the pass rate and the manual prices counted from the ERP's order lines (lib/reporting/boErpLines.ts) */
  erpLines?: ErpLinesKept | null;
  /** KPI autonomy > Manual prices: the shop's prices against the ERP's, and how the read stands */
  prices?: PricesKept | null;
  pricesRead?: { computing: boolean; progress: string | null; error: string | null } | null;
};
type BoSurvey = { day: string; value: number | null; sentiment: string | null; comment: string | null; ticket: string | null; company: string | null };
type Answer = { state: { computing: boolean; progress: string | null; error: string | null; computedAt: string | null }; data: Data | null; canEdit: boolean; canEditTyped: boolean | Record<string, boolean> };
const API = "/api/reporting/back-office";

function useBo() {
  const [a, setA] = useState<Answer | null>(null);
  const [err, setErr] = useState<{ error: string; status: number | null } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let off = false;
    fetch(API, { cache: "no-store" })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error ?? `HTTP ${r.status}`), { status: r.status }); return j as Answer; })
      .then((j) => { if (!off) { setA(j); setErr(null); } })
      .catch((e) => { if (!off) setErr({ error: String(e?.message ?? e), status: e?.status ?? null }); });
    return () => { off = true; };
  }, [tick]);
  // while the months are counted: ask again every 10 seconds - each month shows as soon as it is in
  useEffect(() => {
    if (a && !a.state.computing && a.data) return;
    const t = setTimeout(() => setTick((n) => n + 1), 10_000);
    return () => clearTimeout(t);
  }, [a]);
  const put = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch(API, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    setA((x) => (x?.data ? { ...x, data: { ...x.data, ...(j.hours ? { hours: j.hours } : {}), ...(j.typed ? { typed: j.typed } : {}) } } : x));
  }, []);
  return { a, err, again: () => setTick((n) => n + 1), put };
}

/* ── the year shown: its months, last year's beside them ──────────────── */

/** a month not counted yet */
const EMPTY = (ym: string): BoMonth => ({ ym, ...emptyMonth(), pending: true });
const EMPTY_GQS = (ym: string): GqsMonth => ({ ym, created: 0, sentDays: 0, sentN: 0, doneDays: 0, doneN: 0 });
const back = (ym: string) => `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;

type Frame = {
  year: number;
  /** the months shown - the period picked in Filters, of one year - and last year's same months */
  yms: string[]; labels: string[];
  cur: BoMonth[]; prev: (BoMonth | null)[]; gqs: (GqsMonth | null)[]; gqsPrev: (GqsMonth | null)[];
  hours: (number | null)[]; hoursPrev: (number | null)[];
  /** the complete months - the figures and the totals add these up, from `from` (the first with tickets in HubSpot) */
  done: number; from: number; doneWords: string;
  k: (i: number) => BoKpis; kPrev: (i: number) => BoKpis | null;
  total: BoKpis; totalPrev: BoKpis | null;
  /** the ESO's and the TSA's tickets are the inbound ones (the ESO Reports' read is in) - else every ticket */
  inbound: boolean;
  /** the filters picked, the companies' facts and the owners' names they read */
  fil: BoFilter; co: CoFacts; names: Record<string, string>;
  /** the period: its months of the year (0 = January); this year, and its last month with figures */
  win: { from: number; to: number }; cy: number; cm: number;
  /** the Back Office team - the People graphs show them, the other owners folded away (empty: everyone) */
  team: Set<string>;
};

/** the breakdowns the Filters window offers - "person" by the owner's HubSpot id */
const DIMS = ["topic", "person", "origin", "category", "country", "prio"] as const;
type Dim = (typeof DIMS)[number];
const DIM: Record<Dim, { name: string; icon: React.ReactNode; tint: Tint }> = {
  topic: { name: "Topic", icon: <CategoryOutlinedIcon />, tint: "amber" },
  person: { name: "Person", icon: <BadgeOutlinedIcon />, tint: "green" },
  origin: { name: "Came in from", icon: <AltRouteIcon />, tint: "purple" },
  category: { name: "Customer category", icon: <ApartmentOutlinedIcon />, tint: "blue" },
  country: { name: "Country", icon: <PublicOutlinedIcon />, tint: "blue" },
  prio: { name: "Priority", icon: <FlagOutlinedIcon />, tint: "pink" },
};
const toggle = (k: Dim, v: string) => setQuery((q) => { const cur = q.getAll(k), next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]; q.delete(k); for (const x of next) q.append(k, x); });
const clearFilters = () => setQuery((q) => { for (const k of DIMS) q.delete(k); q.delete("y"); q.delete("from"); q.delete("to"); });
/** the period: a year, its months from / to (to null: the last with figures) - the whole year leaves the address clean */
function setPeriod(f: Frame, year: number, from: number, to: number | null) {
  const last = year === f.cy ? f.cm : 11;
  setQuery((q) => {
    if (year === f.cy) q.delete("y"); else q.set("y", String(year));
    const t = Math.min(last, to ?? last);
    if (from === 0 && t === last) { q.delete("from"); q.delete("to"); } else { q.set("from", String(from + 1)); q.set("to", String(t + 1)); }
  });
}
const ownerName = (f: Frame, id: string) => (id ? f.names[id] ?? `Owner ${id}` : "No owner");

function useFrame(d: Data): Frame {
  const params = useSearchParams();
  const cy = Number(d.current.slice(0, 4)), cm = Number(d.current.slice(5, 7)) - 1;
  const year = params.get("y") === String(cy - 1) ? cy - 1 : cy;
  const lastM = year === cy ? cm : 11;
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  const wf = clamp((Number(params.get("from")) || 1) - 1, 0, lastM), wt = clamp((Number(params.get("to")) || lastM + 1) - 1, wf, lastM);
  const fkey = DIMS.map((k) => params.getAll(k).join("|")).join("/");
  return useMemo(() => {
    const fil: BoFilter = Object.fromEntries(DIMS.flatMap((k) => (params.getAll(k).length ? [[k, params.getAll(k)]] : [])));
    const co = d.companies ?? {}, names = d.names ?? {};
    const inb = d.inbound;
    // the ESO's and the TSA's inbound tickets in place of every ticket of their pipelines; "all" loses their sales actions too
    const withInbound = (m: BoMonth): BoMonth => {
      if (!inb || m.pending) return m;
      const e = inb.eso[m.ym] ?? 0, t = inb.tsa[m.ym] ?? 0;
      return { ...m, eso: e, tsa: t, all: m.all - Math.max(0, m.eso - e) - Math.max(0, m.tsa - t) };
    };
    const by = new Map(d.months.map((m) => [m.ym, filteredMonth(withInbound(m), fil, co)]));
    const gby = new Map(d.gqs.map((m) => [m.ym, m]));
    const yms = Array.from({ length: wt - wf + 1 }, (_, i) => `${year}-${String(wf + i + 1).padStart(2, "0")}`);
    const cur = yms.map((ym) => by.get(ym) ?? EMPTY(ym));
    const prev = yms.map((ym) => by.get(back(ym)) ?? null);
    // the GQS tasks not counted yet (a new count after a release): their figures "—", never 0
    const gqsKnown = d.gqs.length > 0;
    const gqs = yms.map((ym) => (gqsKnown ? gby.get(ym) ?? EMPTY_GQS(ym) : null));
    const gqsPrev = yms.map((ym) => (gqsKnown && by.has(back(ym)) ? gby.get(back(ym)) ?? EMPTY_GQS(back(ym)) : null));
    const hrs = (ym: string) => (d.hours[ym] != null ? d.hours[ym] : null);
    const hours = yms.map(hrs), hoursPrev = yms.map((ym) => hrs(back(ym)));
    const done = yms.filter((ym) => ym < d.current).length;
    // the totals from the first month with tickets in HubSpot - July in 2025 - so a year's figures are never all "—"
    const from = Math.min(Math.max(0, yms.findIndex(hasTickets)), Math.max(0, done - 1));
    const doneWords = done === 0 ? "" : done - from === 1 ? MONTHS[wf + from] : `${MONTHS[wf + from]}–${MONTHS[wf + done - 1]}`;
    const sumH = (xs: (number | null)[]) => (xs.slice(from, done).every((x) => x != null) && done ? xs.slice(from, done).reduce<number>((s, x) => s + (x ?? 0), 0) : null);
    const total = kpisOf(sumMonths(cur.slice(from, done)), gqsKnown ? sumGqs(gqs.slice(from, done) as GqsMonth[]) : null, sumH(hours));
    const havePrev = done > 0 && prev.slice(from, done).every((x) => x);
    const totalPrev = havePrev ? kpisOf(sumMonths(prev.slice(from, done) as BoMonth[]), gqsKnown ? sumGqs(gqsPrev.slice(from, done) as GqsMonth[]) : null, sumH(hoursPrev)) : null;
    return {
      year, yms,
      labels: yms.map((ym, i) => `${MONTHS[wf + i]}${ym === d.current ? " (to date)" : ""}`),
      cur, prev, gqs, gqsPrev, hours, hoursPrev, done, from, doneWords,
      k: (i: number) => kpisOf(cur[i], gqs[i], hours[i]),
      kPrev: (i: number) => (prev[i] ? kpisOf(prev[i] as BoMonth, gqsPrev[i], hoursPrev[i]) : null),
      total, totalPrev, inbound: !!inb, fil, co, names, win: { from: wf, to: wt }, cy, cm, team: new Set(d.team ?? []),
    };
  }, [d, year, wf, wt, fkey, cy, cm]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ── formats ───────────────────────────────────────────────────────────── */

const days = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} days`);
const daysTick = (v: number | null) => (v == null ? "" : v.toFixed(0));
const hrs = (v: number | null) => (v == null ? "—" : v.toLocaleString("en", { maximumFractionDigits: 1 }));
const n0 = (v: number | null) => (v == null ? "—" : int(v));
const share = (v: number | null) => pct(v);
const d1 = (v: number | null) => (v == null ? "—" : v.toFixed(1));


/* ── the pages: the workbook's blocks, in its order ───────────────────── */

export type Slug = "figures" | "topics" | "sales-tickets" | "gqs" | "otd" | "autonomy" | "stopped";
type PageDef = { slug: Slug; title: string; line: string; icon: React.ReactNode; tint: Tint };
/** Team totals keeps the address it had as Figures, so the graphs sent from it to the BUC View stay where they are. */
export const BO_PAGES: PageDef[] = [
  { slug: "figures", title: "Team totals", line: "tickets created and closed, speed, hours, orders, the customers' tone, profit centres", icon: <BarChartOutlinedIcon />, tint: "blue" },
  { slug: "topics", title: "Topics", line: "the Back Office's tickets by topic - delivery and C2S, cancellations, what is inside Others", icon: <CategoryOutlinedIcon />, tint: "amber" },
  { slug: "sales-tickets", title: "ESO & TSA tickets", line: "inbound, without the sales actions, against the orders - and APSOparts in total", icon: <GroupsOutlinedIcon />, tint: "purple" },
  { slug: "gqs", title: "GQS", line: "special tasks with the GQS team: how many, how long before sent, how long to close", icon: <AssignmentOutlinedIcon />, tint: "green" },
  { slug: "otd", title: "OTD", line: "on time against the first confirmed date, counted from the ERP · the late lines · the delivery speed", icon: <LocalShippingOutlinedIcon />, tint: "pink" },
  { slug: "autonomy", title: "Pass rate", line: "the pass rate and the manual price adjustments per mandant, counted from the ERP", icon: <VerifiedOutlinedIcon />, tint: "slate" },
  { slug: "stopped", title: "Stopped orders", line: "the orders stopped and why - typed in", icon: <BlockOutlinedIcon />, tint: "amber" },
];
const pageOf = (slug: Slug) => BO_PAGES.find((p) => p.slug === slug)!;
const hrefOf = (slug: Slug) => `/reporting/back-office/${slug}`;
/** the typed series each page types in */
const TYPED_ON: Partial<Record<Slug, string[]>> = { otd: ["otd"], autonomy: ["pass", "price"], stopped: ["stopped"] };

/** a figure top right: this year's complete months against last year's - no change shown where last year has no figure */
const fig = (label: string, value: string, a: number | null, b: number | null | undefined, sub: string, icon: React.ReactNode, tint: Tint, lower = false): Fig =>
  ({ label, value, ch: a != null && b != null ? changeOf(a, b) : undefined, sub, icon, tint, lower });

/** the typed figures of a series' row for the given months */
const typedOf = (d: Data, key: string, yms: string[]) => yms.map((ym) => d.typed[key]?.[ym] ?? null);
const meanOf = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const sumTyped = (d: Data, key: string, yms: string[]) => yms.reduce((s, ym) => s + (d.typed[key]?.[ym] ?? 0), 0);
const stoppedShare = (d: Data, ym: string) => { const t = d.typed["stopped.transferred"]?.[ym], s = d.typed["stopped.stopped"]?.[ym]; return t && s != null ? s / t : null; };
const doneYms = (f: Frame) => f.yms.slice(f.from, f.done);

/** The figures of a page - top right on the page, big in its BUC View panel; one kind of figure a row. */
const FIGS: Record<Slug, (f: Frame, d: Data) => Fig[]> = {
  figures: (f) => [
    fig("Tickets created", n0(f.total.created), f.total.created, f.totalPrev?.created ?? null, f.doneWords || String(f.year), <ConfirmationNumberOutlinedIcon sx={{ fontSize: 14 }} />, "blue", true),
    fig("Tickets closed", n0(f.total.closed), f.total.closed, f.totalPrev?.closed ?? null, f.doneWords || String(f.year), <TaskAltOutlinedIcon sx={{ fontSize: 14 }} />, "green"),
    fig("Orders", n0(f.total.orders), f.total.orders, f.totalPrev?.orders ?? null, `${share(f.total.perOrder)} tickets per order`, <ShoppingCartOutlinedIcon sx={{ fontSize: 14 }} />, "purple"),
    fig("Order lines", n0(f.total.lines), f.total.lines, f.totalPrev?.lines ?? null, `${share(f.total.perLine)} tickets per line`, <ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />, "amber"),
  ],
  topics: (f) => {
    const t = sumMonths(f.cur.slice(f.from, f.done || f.cur.length)).topics, p = f.totalPrev?.created != null ? sumMonths(f.prev.slice(f.from, f.done) as BoMonth[]).topics : null;
    const top = Object.entries(t).filter(([k]) => k).sort((a, b) => b[1] - a[1])[0];
    const n = Object.values(t).reduce((s, x) => s + x, 0);
    return [
      fig("Tickets", int(n), n, p ? Object.values(p).reduce((s, x) => s + x, 0) : null, f.doneWords || String(f.year), <ConfirmationNumberOutlinedIcon sx={{ fontSize: 14 }} />, "blue", true),
      fig(top ? top[0] : "Biggest topic", top ? int(top[1]) : "—", top?.[1] ?? null, top && p ? p[top[0]] ?? 0 : null, top && n ? `${pct(top[1] / n)} of the tickets` : "", <CategoryOutlinedIcon sx={{ fontSize: 14 }} />, "amber", true),
      fig("C2S tickets", n0(f.total.c2s), f.total.c2s, f.totalPrev?.c2s ?? null, `${n0(f.total.c2sDelivery)} of them Delivery`, <ContentCutOutlinedIcon sx={{ fontSize: 14 }} />, "pink", true),
      fig("No topic", int(t[""] ?? 0), t[""] ?? 0, p ? p[""] ?? 0 : null, "not yet given one", <HelpOutlineIcon sx={{ fontSize: 14 }} />, "slate", true),
    ];
  },
  "sales-tickets": (f) => [
    fig("ESO tickets", n0(f.total.eso), f.total.eso, f.totalPrev?.eso ?? null, `${share(f.total.esoPerOrder)} tickets per order`, <GroupsOutlinedIcon sx={{ fontSize: 14 }} />, "blue", true),
    fig("TSA tickets", n0(f.total.tsa), f.total.tsa, f.totalPrev?.tsa ?? null, `${share(f.total.tsaPerOrder)} tickets per order`, <SupportAgentOutlinedIcon sx={{ fontSize: 14 }} />, "green", true),
    fig("All APSOparts", n0(f.total.all), f.total.all, f.totalPrev?.all ?? null, `${share(f.total.allPerOrder)} tickets per order`, <ApartmentOutlinedIcon sx={{ fontSize: 14 }} />, "purple", true),
  ],
  gqs: (f, d) => {
    // the whole pipeline's headline: the requests, the offers sent, the win rate (SARCLA 04.11.2026: "a full pipeline")
    const py = gPrevYms(f);
    const o = gBy(d, gYms(f), "of"), op = py ? gBy(d, py, "of") : null;
    const a = o ? offersOf(o) : null, b = op ? offersOf(op) : null;
    const w = a ? winRate(a.won, a.lost) : null, wp = b ? winRate(b.won, b.lost) : null;
    return [
      fig("GQS tasks", n0(f.total.gqsCreated), f.total.gqsCreated, f.totalPrev?.gqsCreated ?? null, f.doneWords || String(f.year), <AssignmentOutlinedIcon sx={{ fontSize: 14 }} />, "blue"),
      fig("Offers sent to Sales", n0(a?.n ?? null), a?.n ?? null, b?.n ?? null, "by the day first sent", <SendOutlinedIcon sx={{ fontSize: 14 }} />, "green"),
      fig("Win rate", pct(w), w, wp, a ? `${int(a.won)} won of ${int(a.won + a.lost)} with a result` : "the offers with a result", <EmojiEventsOutlinedIcon sx={{ fontSize: 14 }} />, "green"),
    ];
  },
  otd: (f, d) => {
    const ys = doneYms(f), py = ys.map(back);
    const one = (row: string, label: string, tint: Tint, pick: OtdPick) => {
      const k = d.erpLines;
      if (k) {
        const c = otdSum(k, ys, pick), v = c[0] ? c[1] / c[0] : null;
        if (v != null) return fig(label, share(v), null, undefined, `${f.doneWords} · counted, ${int(c[0])} lines`, <LocalShippingOutlinedIcon sx={{ fontSize: 14 }} />, tint);
      }
      const a = meanOf(typedOf(d, `otd.${row}`, ys)), b = meanOf(typedOf(d, `otd.${row}`, py));
      return fig(label, share(a), a, b, a == null ? "not typed in yet" : `${f.doneWords} on average · typed in`, <LocalShippingOutlinedIcon sx={{ fontSize: 14 }} />, tint);
    };
    return [one("online-all", "OTD online", "blue", {}), one("online-standard", "Standard articles", "green", { type: "S" }), one("online-special", "Special articles", "amber", { type: "P" })];
  },
  autonomy: (f, d) => {
    const ys = doneYms(f);
    const one = (key: string, label: string, target: number, lower: boolean, icon: React.ReactNode, tint: Tint) => {
      // counted from the ERP's order lines ("pass.m100": the lines priced automatically, "price.m100": by hand), else typed in
      const [kind, mandant] = key.split(".m");
      const p = d.erpLines ? priceSum(d.erpLines, mandant, ys) : null;
      const counted = p && p[0] ? (kind === "pass" ? p[2] : p[1]) / p[0] : null;
      const v = counted ?? meanOf(typedOf(d, key, ys));
      const ok = v == null ? null : lower ? v < target : v >= target;
      return fig(label, share(v), null, undefined, `target ${lower ? "below " : ""}${pct(target)}${ok == null ? " · not typed in yet" : ok ? " · on target" : " · off target"}${counted != null ? " · counted" : v != null ? " · typed in" : ""}`, icon, tint);
    };
    return [
      one("pass.m100", "Pass rate, 100", 0.95, false, <VerifiedOutlinedIcon sx={{ fontSize: 14 }} />, "green"), one("pass.m110", "Pass rate, 110", 0.95, false, <VerifiedOutlinedIcon sx={{ fontSize: 14 }} />, "green"),
      one("price.m100", "Manual prices, 100", 0.025, true, <PriceChangeOutlinedIcon sx={{ fontSize: 14 }} />, "amber"), one("price.m110", "Manual prices, 110", 0.025, true, <PriceChangeOutlinedIcon sx={{ fontSize: 14 }} />, "amber"),
    ];
  },
  stopped: (f, d) => {
    const st = sumTyped(d, "stopped.stopped", f.yms), tr = sumTyped(d, "stopped.transferred", f.yms);
    const why = (row: string, label: string, icon: React.ReactNode) => {
      const n = sumTyped(d, `stopped.${row}`, f.yms);
      return fig(label, st ? n0(n) : "—", null, undefined, st && n ? `${pct(n / st)} of the stopped` : "typed in per month", icon, "amber");
    };
    return [
      fig("Orders stopped", tr ? n0(st) : "—", null, undefined, tr ? `${pct(st / tr)} of the ${n0(tr)} transferred` : "not typed in yet", <BlockOutlinedIcon sx={{ fontSize: 14 }} />, "pink"),
      why("credit", "Credit limit", <CreditCardOffOutlinedIcon sx={{ fontSize: 14 }} />), why("denomination", "Denomination", <BadgeOutlinedIcon sx={{ fontSize: 14 }} />), why("price", "Price missing", <SellOutlinedIcon sx={{ fontSize: 14 }} />),
    ];
  },
};

/* ── the graphs, each defined once ─────────────────────────────────────── */

/** what a graph is drawn from - and, on Topics, the topics picked */
type Ctx = { f: Frame; d: Data; picked?: string[]; pick?: (label: string) => void };
/** `wide`: across the card - a graph with many parts, or the first of three */
type ChartDef = {
  id: string; page: Slug; title: string; hint?: (c: Ctx) => string; body?: (c: Ctx) => React.ReactNode; wide?: boolean; list?: ListOf; board?: (c: Ctx) => BoardSpec;
  /** a graph with a box of its own (DimChart): drawn with the title, the Actions and the tickets handed to it - no box around
   *  a box (SARCLA 04.11.2026 on Tickets per topic: "still the same shitty design") */
  own?: (c: Ctx, box: { title: string; actions: React.ReactNode; companies?: CompanySource }) => React.ReactNode;
  /** two rows high beside two graphs (Tickets per topic beside its month by month) */
  tall?: boolean;
  /** the graph's headline figure for the period shown - its tile's summary opens with it, and the Action plan reads it as the
   *  KPI's real figure (SARCLA 03.11.2026: "we should see the real KPIs") */
  figure?: (c: Ctx) => string | null;
  /** counted from the ERP's order lines only: not drawn on its tab before the first of them is in (SARCLA 08.11.2026: "graphs show nothing") */
  needsCount?: boolean;
};
/** a person board: the Back Office team ranked, each against the same number of months right before; the other owners folded */
type BoardSpec = { rows: BoardRow[]; others: BoardRow[]; fmt: (v: number) => string; ratio?: boolean; lower?: boolean; diff?: (n: number) => string; summary: string; prevLabel: string; noChange: boolean };
/** a graph with the tickets behind it */
const listed = (l: ListOf) => (c: ChartDef): ChartDef => ({ ...c, list: l });
const ALL_IN: ListOf = { note: "the tickets created" };
/** the months a chart draws: the complete ones - a month two days old would read as a collapse (its orders come in days
 *  later: 3 on 2 November, so 615 % tickets per order line) - the month to date only while none is complete */
const drawn = (f: Frame) => Math.max(1, f.done);
const wide = (c: ChartDef): ChartDef => ({ ...c, wide: true });

/** a monthly KPI as a line, last year's beside it, its complete months added up in the hint */
function trend(id: string, page: Slug, title: string, note: string, pick: (k: BoKpis) => number | null, fmt: (v: number | null) => string, tick?: (v: number | null) => string): ChartDef {
  return {
    id, page, title, figure: ({ f }) => { const a = pick(f.total); return a == null ? null : fmt(a); },
    hint: ({ f }) => {
      const a = pick(f.total), b = f.totalPrev ? pick(f.totalPrev) : null;
      const ch = a != null && b != null ? changeOf(a, b) : null;
      return [note, f.done && a != null ? `${f.doneWords}: ${fmt(a)}${ch != null ? ` (${signedPct(ch)} on last year)` : ""}` : ""].filter(Boolean).join(" · ");
    },
    body: ({ f }) => {
      const n = drawn(f);
      const values = f.yms.slice(0, n).map((_, i) => pick(f.k(i)));
      const compare = f.yms.slice(0, n).map((_, i) => { const p = f.kPrev(i); return p ? pick(p) : null; });
      return <MonthTrend values={values} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={fmt} tick={tick} />;
    },
  };
}
/** a typed series' row as a line, last year's beside it, its target as a line */
/** some topics' tickets month by month - or, `perOrder`, against the month's orders */
function topicTrend(id: string, title: string, keys: string[], note: string, perOrder = false): ChartDef {
  return {
    id, page: "topics", title, hint: () => note,
    figure: ({ f }) => {
      const ms = f.cur.slice(f.from, f.done).filter((m) => hasTickets(m.ym) && !m.pending);
      const t = ms.reduce((s, m) => s + keys.reduce((x, k) => x + (m.topics[k] ?? 0), 0), 0), o = ms.reduce((s, m) => s + m.orders, 0);
      return ms.length ? (perOrder ? share(o ? t / o : null) : int(t)) : null;
    },
    body: ({ f }) => {
      const n = drawn(f);
      const of = (m: BoMonth | null) => {
        if (!m || !hasTickets(m.ym) || m.pending) return null;
        const t = keys.reduce((s, k) => s + (m.topics[k] ?? 0), 0);
        return perOrder ? (m.orders ? t / m.orders : null) : t;
      };
      const compare = f.prev.slice(0, n).map(of);
      return <MonthTrend values={f.cur.slice(0, n).map(of)} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={perOrder ? share : n0} />;
    },
  };
}

const topicSort = (a: string, b: string) => {
  const ia = TOPIC_ORDER.indexOf(a), ib = TOPIC_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};
/** the topics of the complete months, this year and last (where its tickets are in HubSpot) */
function topicRows(f: Frame) {
  const sumOf = (ms: (BoMonth | null)[]) => sumMonths(ms.filter((x): x is BoMonth => !!x)).topics;
  const compare = f.totalPrev?.created != null;
  const cur = sumOf(f.cur.slice(f.from, f.done || f.cur.length)), prev = compare ? sumOf(f.prev.slice(f.from, f.done)) : {};
  const all = [...new Set([...f.cur, ...f.prev].flatMap((m) => (m ? Object.keys(m.topics) : [])))].sort(topicSort);
  return { compare, all, rows: all.map((t) => ({ label: topicLabel(t), key: t, cur: cur[t] ?? 0, prev: prev[t] ?? 0 })) };
}
/** what the workbook calls Others: its own topic, and every kind HubSpot files on its own today (automatic, finance ...) */
const OTHERS = TOPIC_ORDER.slice(TOPIC_ORDER.indexOf("Others"));
const PCS = ["DT", "KT", "FT", "ST", "AT"];

/* a small graph per topic or per profit centre - the hub's colours, a glass tile each */
type Mini = { label: string; values: (number | null)[]; values2?: (number | null)[]; value: string; ch?: number | null; lower?: boolean; sub?: string; counts?: boolean };
function MiniColumns({ values }: { values: (number | null)[] }) {
  const w = 240, h = 84, max = Math.max(1, ...values.map((v) => v ?? 0)), band = w / Math.max(1, values.length);
  const last = values.reduce<number>((k, v, i) => (v != null ? i : k), -1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden>
      {values.map((v, i) => (v == null ? null : <rect key={i} x={band * i + 1.5} y={h - ((h - 2) * v) / max} width={Math.max(1, band - 3)} height={((h - 2) * v) / max} rx={1.5} fill={i === last ? SERIES[0] : SEQUENTIAL[1]} />))}
    </svg>
  );
}
function MiniLines({ a, b, share = true }: { a: (number | null)[]; b: (number | null)[]; share?: boolean }) {
  const w = 160, h = 50, vals = [...a, ...b].filter((x): x is number => x != null);
  // a share from 50 % (or lower) to 100 %, the dashed line at 80 %; counts from nought to the largest
  const lo = share ? Math.min(0.5, Math.floor(Math.min(1, ...vals) * 10) / 10) : 0, hi = share ? 1 : Math.max(1, ...vals), band = w / Math.max(1, a.length);
  const y = (v: number) => 3 + (h - 6) * (1 - (v - lo) / (hi - lo));
  const path = (xs: (number | null)[]) => xs.map((v, i) => (v == null ? "" : `${i && xs[i - 1] != null ? "L" : "M"}${band * i + band / 2} ${y(v)}`)).join("");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden>
      {share && <line x1={0} x2={w} y1={y(0.8)} y2={y(0.8)} stroke={HAIRLINE} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      <path d={path(b)} fill="none" stroke={DEEMPHASIS} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <path d={path(a)} fill="none" stroke={SERIES[0]} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
function Minis({ items, legend }: { items: Mini[]; legend?: [string, string] }) {
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {legend && (
        <Box sx={{ display: "flex", gap: 2, fontSize: "0.76rem", color: MUTED }}>
          {legend.map((l, i) => <Box key={l} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}><Box sx={{ width: 14, height: 3, borderRadius: 2, bgcolor: i ? DEEMPHASIS : SERIES[0] }} />{l}</Box>)}
        </Box>
      )}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
        {items.map((it) => (
          <Box key={it.label} sx={{ ...glass, borderRadius: "14px", px: 1.5, py: 1.1, display: "grid", gap: 0.5, minWidth: 0 }}>
            <Typography title={it.label} sx={{ fontSize: "0.8rem", fontWeight: 650, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</Typography>
            {it.values2 ? <MiniLines a={it.values} b={it.values2} share={!it.counts} /> : <MiniColumns values={it.values} />}
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{it.value}</Typography>
              {it.ch != null && <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: tone(it.ch, it.lower) }}>{signedPct(it.ch)}</Typography>}
            </Box>
            {it.sub && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{it.sub}</Typography>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

const TONE_RED = "#c0571f";
const share0 = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/* the tickets one by one - the People tab, the speed per topic, where they came from */

type Tk = { topic: string; owner: string; origin: string; company: string };
const tk = (d: string[], r: number[], C: typeof RW | typeof RCL): Tk => ({ topic: d[r[C.topic]], owner: d[r[C.owner]], origin: d[r[C.origin]], company: d[r[C.company]] });
const periodOf = (f: Frame) => (f.doneWords ? `${f.doneWords} ${f.year}` : String(f.year));
/**
 * A created ticket's profit centre (SARCLA 04.11.2026: "WHY DO WE STILL HAVE No profit centre - we should not have"): its
 * order's, else the articles named on it, else its customer's main one (read version 6); none found, the reason - its
 * customer buys across profit centres, has bought nothing yet, there is no customer. A month still counted the version-5
 * way shows its order's, the others "Being counted again" until it is.
 */
const COUNTING_PC = "Being counted again";
const PC_WHY: Record<number, string> = { 4: PC_FROM[4], 5: PC_FROM[5] };
const pcOfRow = (d: string[], r: number[]): string | null => {
  if (r.length <= RW.pc) return null;
  const pc = d[r[RW.pc]];
  if (r.length <= RW.from) return pc && pc !== "No profit centre" ? pc : COUNTING_PC;
  if (pc) return pc;
  return PC_WHY[r[RW.from]] ?? (d[r[RW.origin]] === "Automatic & internal" ? "Automatic & internal, no customer" : "No company on the ticket");
};
/** a reason, not a profit centre - drawn grey, listed last */
const notPc = (k: string) => !/^[A-Z]{2,4}$/.test(k);
/** Which types of problem per profit centre: the tickets of the period by their order's profit centre, on to their topic. */
function PcTopics({ f }: { f: Frame }) {
  const links = new Map<string, number>(), pcs = new Map<string, number>(), tops = new Map<string, number>();
  let known = 0, all = 0;
  f.cur.forEach((m, i) => {
    if (i < f.from || i >= Math.max(f.done, f.from + 1) || !m.rows || m.pending) return;
    for (const r of m.rows.created) {
      const t = tk(m.rows.dict, r, RW);
      if (!passes(f.fil, f.co, t)) continue;
      all++;
      const pc = pcOfRow(m.rows.dict, r);
      if (pc == null) continue;
      known++;
      const tp = topicLabel(t.topic);
      pcs.set(pc, (pcs.get(pc) ?? 0) + 1); tops.set(tp, (tops.get(tp) ?? 0) + 1);
      links.set(`${pc}|${tp}`, (links.get(`${pc}|${tp}`) ?? 0) + 1);
    }
  });
  if (!known) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>{all ? "The tickets' orders are being read - each month shows as soon as it is counted again." : "No tickets for this choice."}</Typography>;
  const head = [...tops].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k]) => k);
  const topOf = (tp: string) => (head.includes(tp) ? tp : "Every other type");
  const merged = new Map<string, number>();
  for (const [k, v] of links) { const [pc, tp] = k.split("|"); const key = `${pc}|${topOf(tp)}`; merged.set(key, (merged.get(key) ?? 0) + v); }
  const pcList = [...pcs].sort((a, b) => Number(notPc(a[0])) - Number(notPc(b[0])) || b[1] - a[1]).map(([k]) => k);
  const rights = [...head, ...(tops.size > head.length ? ["Every other type"] : [])];
  const nodes = [
    ...pcList.map((pc) => ({ id: `pc:${pc}`, column: 0, label: pc, color: notPc(pc) ? DEEMPHASIS : SEQUENTIAL[4] })),
    ...rights.map((tp) => ({ id: `t:${tp}`, column: 1, label: tp, color: tp === "Every other type" ? DEEMPHASIS : SERIES[1] })),
  ];
  const sankeyLinks = [...merged].map(([k, v]) => { const [pc, tp] = k.split("|"); return { from: `pc:${pc}`, to: `t:${tp}`, value: v }; });
  return (
    <ChartFrame table={{ columns: ["Profit centre", "Type of problem", "Tickets"], rows: sankeyLinks.map((l) => [l.from.slice(3), l.to.slice(2), l.value]), numeric: [2] }}>
      <Box sx={{ overflowX: "auto" }}><Box sx={{ minWidth: 700 }}>
        <Sankey height={420} columns={["Profit centre", "Type of problem"]} label="Which types of problem, per profit centre" nodes={nodes} links={sankeyLinks} format={(v) => int(v)} />
      </Box></Box>
      {known < all && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{int(all - known)} tickets of months not counted again yet are left out until they are.</Typography>}
    </ChartFrame>
  );
}

/** The tickets of the period by a breakdown (rows) and their topic (columns): the eight largest topics, every other, the
 *  total - each with its share of the row. */
function TopicMatrix({ f, by, head, last = () => false }: { f: Frame; by: (t: Tk, r: number[], d: string[]) => string | null; head: string; last?: (k: string) => boolean }) {
  const m = new Map<string, Map<string, number>>(), tot = new Map<string, number>();
  f.cur.forEach((mo, i) => {
    if (i < f.from || i >= Math.max(f.done, f.from + 1) || !mo.rows || mo.pending) return;
    const dd = mo.rows.dict;
    for (const r of mo.rows.created) {
      const t = tk(dd, r, RW);
      if (!passes(f.fil, f.co, t)) continue;
      const k = by(t, r, dd);
      if (k == null) continue;
      const tp = topicLabel(t.topic);
      const row = m.get(k) ?? new Map<string, number>();
      row.set(tp, (row.get(tp) ?? 0) + 1);
      m.set(k, row);
      tot.set(tp, (tot.get(tp) ?? 0) + 1);
    }
  });
  if (!m.size) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No tickets for this choice yet.</Typography>;
  const cols = [...tot].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  const rows = [...m].map(([k, row]) => ({ k, row, total: [...row.values()].reduce((a, b) => a + b, 0) })).sort((a, b) => Number(a.k.startsWith("Outside") || last(a.k)) - Number(b.k.startsWith("Outside") || last(b.k)) || b.total - a.total);
  const cell = (n: number, of: number) => (n ? <span>{int(n)} <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>{pct(n / of)}</Box></span> : <Box component="span" sx={{ color: FAINT }}>—</Box>);
  return (
    <WTable head={[head, ...cols, "Every other topic", "Tickets"]} totals={1} rows={rows.map((r) => {
      const other = r.total - cols.reduce((x, c) => x + (r.row.get(c) ?? 0), 0);
      return { key: r.k, cells: [r.k, ...cols.map((c) => cell(r.row.get(c) ?? 0, r.total)), cell(other, r.total), int(r.total)] };
    })} />
  );
}

/* the C2S tickets against their orders: the cut-to-size family's orders (KT - the only one cut to size) and their value */
type MonthRow = { name: string; values: (number | null)[]; fmt: (v: number) => string; color: string; total?: React.ReactNode; sub?: string;
  /** what a month without its figure shows instead of "—" (a month being read again: "…") */
  notes?: (string | null)[] };
function MonthRows({ labels, rows, totalHead }: { labels: string[]; rows: MonthRow[]; totalHead?: string }) {
  const cols = `minmax(170px, 1.2fr) repeat(${labels.length}, minmax(44px, 1fr))${totalHead ? " minmax(96px, 0.8fr)" : ""}`;
  const barH = rows.length > 6 ? 34 : 46;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: 640, display: "grid", gap: 1 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75 }}>
          <span />
          {labels.map((l) => <Typography key={l} sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: FAINT, textAlign: "center" }}>{l.replace(" (to date)", "*")}</Typography>)}
          {totalHead && <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: INK, textAlign: "right" }}>{totalHead}</Typography>}
        </Box>
        {rows.map((r) => {
          const max = Math.max(1, ...r.values.map((v) => v ?? 0));
          return (
            <Box key={r.name} sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, alignItems: "end", borderTop: `1px solid ${HAIRLINE}`, pt: 0.75 }}>
              <Box sx={{ alignSelf: "center", minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 650, color: INK }}>{r.name}</Typography>
                {r.sub && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{r.sub}</Typography>}
              </Box>
              {r.values.map((v, i) => (
                <Box key={i} title={`${r.name}, ${labels[i]}: ${v == null ? (r.notes?.[i] ? "being read again" : "—") : r.fmt(v)}`} sx={{ display: "grid", justifyItems: "center", gap: 0.25 }}>
                  <Box sx={{ width: "70%", height: barH, display: "flex", alignItems: "flex-end" }}><Box sx={{ width: "100%", height: `${((v ?? 0) / max) * 100}%`, minHeight: v ? 2 : 0, bgcolor: r.color, borderRadius: "3px 3px 0 0" }} /></Box>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: v == null && r.notes?.[i] ? FAINT : INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v == null ? r.notes?.[i] ?? "—" : r.fmt(v)}</Typography>
                </Box>
              ))}
              {totalHead && <Box sx={{ alignSelf: "center", textAlign: "right", fontSize: "0.84rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{r.total ?? ""}</Box>}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
/** how closely two monthly series move together (Pearson's r), over the months both have */
function correlation(a: (number | null)[], b: (number | null)[]): number | null {
  const xs: [number, number][] = a.map((x, i) => [x, b[i]] as const).filter((p): p is [number, number] => p[0] != null && p[1] != null);
  if (xs.length < 4) return null;
  const mx = xs.reduce((s2, p) => s2 + p[0], 0) / xs.length, my = xs.reduce((s2, p) => s2 + p[1], 0) / xs.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of xs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const rWords = (r: number | null) => (r == null ? "too few months to tell" : `r = ${r.toFixed(2)} - ${Math.abs(r) >= 0.7 ? "they move closely together" : Math.abs(r) >= 0.4 ? "they move somewhat together" : "little to do with one another"}`);

/* ── the topics in depth (SARCLA 04.11.2026: "Delivery, the biggest topic - its C2S is lacking, a lot of KPIs, order
   cancellation as well, per article, per profit centre, value - come on, you are not really thinking", "inside Others the
   same", "speed is lacking a per-people breakdown") ── */

/** what a group of tickets comes to: how many, the C2S ones, the speed, the customers' left without an answer, the value of
 *  their orders (read version 6 on: `v6` of them), their profit centres */
type Agg = { n: number; c2s: number; replyS: number; replyN: number; closeS: number; closeN: number; cust: number; quiet: number; value: number; v6: number; ordered: number; pcs: Record<string, number>; from: Record<number, number> };
const agg0 = (): Agg => ({ n: 0, c2s: 0, replyS: 0, replyN: 0, closeS: 0, closeN: 0, cust: 0, quiet: 0, value: 0, v6: 0, ordered: 0, pcs: {}, from: {} });
function aggAdd(a: Agg, t: Tk, r: number[], d: string[]) {
  a.n++;
  if (r[RW.c2s] === 1) a.c2s++;
  if (r[RW.reply] >= 0) { a.replyS += r[RW.reply] / 10; a.replyN++; }
  if (r[RW.close] >= 0) { a.closeS += r[RW.close] / 10; a.closeN++; }
  if (t.origin === "Customer") { a.cust++; if (unanswered(r, t)) a.quiet++; }
  if (r.length > RW.from) { a.v6++; a.value += r[RW.value] || 0; if (r[RW.value] > 0) a.ordered++; a.from[r[RW.from]] = (a.from[r[RW.from]] ?? 0) + 1; }
  const pc = pcOfRow(d, r);
  if (pc) a.pcs[pc] = (a.pcs[pc] ?? 0) + 1;
}
const aggSum = (xs: Agg[]) => xs.reduce((s, a) => {
  for (const k of ["n", "c2s", "replyS", "replyN", "closeS", "closeN", "cust", "quiet", "value", "v6", "ordered"] as const) s[k] += a[k];
  for (const [k, v] of Object.entries(a.pcs)) s.pcs[k] = (s.pcs[k] ?? 0) + v;
  for (const [k, v] of Object.entries(a.from)) s.from[Number(k)] = (s.from[Number(k)] ?? 0) + v;
  return s;
}, agg0());
const avgOf = (s: number, n: number) => (n ? s / n : null);
/** the period's created tickets that pass, grouped by a key (several keys: counted under each) - this year's, or the same
 *  months a year before */
function groups(f: Frame, key: (t: Tk, r: number[], d: string[]) => string | string[] | null, which: "cur" | "prev" = "cur"): Map<string, Agg> {
  const out = new Map<string, Agg>();
  (which === "cur" ? f.cur : f.prev).forEach((m, i) => {
    if (!m?.rows || m.pending || !hasTickets(m.ym) || i < f.from || i >= Math.max(f.done, f.from + 1)) return;
    const d = m.rows.dict;
    for (const r of m.rows.created) {
      const t = tk(d, r, RW);
      if (!passes(f.fil, f.co, t)) continue;
      const k = key(t, r, d);
      if (k == null) continue;
      for (const x of Array.isArray(k) ? k : [k]) { const a = out.get(x) ?? agg0(); aggAdd(a, t, r, d); out.set(x, a); }
    }
  });
  return out;
}
/** each drawn month's tickets of a kind, added up - null for a month not counted one by one */
function monthAggs(f: Frame, is: (t: Tk) => boolean, which: "cur" | "prev" = "cur"): (Agg | null)[] {
  return (which === "cur" ? f.cur : f.prev).slice(0, drawn(f)).map((m) => {
    if (!m?.rows || m.pending || !hasTickets(m.ym)) return null;
    const d = m.rows.dict, a = agg0();
    for (const r of m.rows.created) { const t = tk(d, r, RW); if (passes(f.fil, f.co, t) && is(t)) aggAdd(a, t, r, d); }
    return a;
  });
}
/** the period's orders, and per profit centre */
const ordersOfPeriod = (f: Frame) => f.total.orders ?? 0;
const per100 = (n: number, orders: number | null | undefined) => (orders ? (n / orders) * 100 : null);
const p100 = (v: number | null) => (v == null ? "—" : v.toFixed(1));
const money = (v: number | null) => (v == null ? "—" : int(v));
const moneyShort = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)} M` : v >= 1e3 ? `${Math.round(v / 1000)} k` : int(v));
const valueOf = (a: Agg) => (a.v6 ? a.value : null);
/** a group's largest profit centre and its share - reasons left out */
const mainPc = (a: Agg) => { const top = Object.entries(a.pcs).filter(([k]) => !notPc(k)).sort((x, y) => y[1] - x[1])[0]; return top ? `${top[0]} · ${pct(top[1] / a.n)}` : "—"; };
const c2sCell = (a: Agg) => (a.c2s ? <span>{int(a.c2s)} <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>{pct(a.c2s / a.n)}</Box></span> : "—");
const quietCell = (a: Agg) => (a.cust ? <span>{int(a.quiet)} <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>{pct(a.quiet / a.cust)}</Box></span> : "—");
const SOON = <Box component="span" sx={{ color: FAINT }}>being counted</Box>;

type GRow = { label: string; a: Agg; p: Agg | null; extra?: Record<string, React.ReactNode> };
/** The figures of a breakdown's tickets - one row each, every column sorts (the reports' "All the figures" table). */
function AggTable({ f, rows, first, find, pick, picked, lead = [], total = true, compare, hide = [] }: {
  f: Frame; rows: GRow[]; first: string; find?: string; pick?: (label: string) => void; picked?: string[]; lead?: Col<GRow>[]; total?: boolean; compare: boolean;
  /** columns left out - "per100" against every order means nothing for one customer, "pc" on a profit centre's own row */
  hide?: string[];
}) {
  const all = aggSum(rows.map((r) => r.a)), allP = compare ? aggSum(rows.map((r) => r.p ?? agg0())) : null;
  const orders = ordersOfPeriod(f);
  const cols: Col<GRow>[] = [
    ...lead,
    { key: "n", head: "Tickets", tip: compare ? `Against the same months of ${f.year - 1}` : undefined, cell: (r) => (compare && r.p ? withChangeCell(int(r.a.n), r.a.n, r.p.n, true) : int(r.a.n)), sort: (r) => r.a.n },
    { key: "share", head: "Share", tip: "Of the tickets in the table", cell: (r) => pct(all.n ? r.a.n / all.n : null), sort: (r) => r.a.n },
    { key: "per100", head: "Per 100 orders", tip: "Against every order of the period", cell: (r) => p100(per100(r.a.n, orders)), sort: (r) => r.a.n },
    { key: "c2s", head: "C2S", tip: "Cut to size - and their share of the row's tickets", cell: (r) => c2sCell(r.a), sort: (r) => r.a.c2s },
    { key: "reply", head: "First reply", tip: "Days to the first agent e-mail reply, on average", cell: (r) => days(avgOf(r.a.replyS, r.a.replyN)), sort: (r) => avgOf(r.a.replyS, r.a.replyN) ?? -1 },
    { key: "close", head: "Days to close", tip: "Of those closed since, on average", cell: (r) => days(avgOf(r.a.closeS, r.a.closeN)), sort: (r) => avgOf(r.a.closeS, r.a.closeN) ?? -1 },
    { key: "quiet", head: "Unanswered", tip: "Customer tickets closed without any agent reply - and their share of the row's customer tickets", cell: (r) => quietCell(r.a), sort: (r) => r.a.quiet },
    { key: "value", head: "Order value", tip: "The net value of the orders the tickets are about, CHF and EUR as booked", cell: (r) => (r.a.v6 === r.a.n ? money(r.a.value) : SOON), sort: (r) => r.a.value },
    { key: "pc", head: "Main profit centre", cell: (r) => (r.label === "Total" ? "" : mainPc(r.a)) },
  ];
  return <FullTable first={first} cols={cols.filter((c) => !hide.includes(c.key))} rows={rows} find={find} selected={picked} onPick={pick} initial="n" total={total ? { label: "Total", a: all, p: allP } : null} />;
}

/** small figures in a row - the BUC View's figure look, without a box around each */
type Tile = { label: string; value: string; ch?: number | null; lower?: boolean; sub: string; icon: React.ReactNode; tint: Tint };
function Tiles({ items }: { items: Tile[] }) {
  const cols = items.length % 4 === 0 ? 4 : 3;
  return (
    <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${cols}, minmax(0, 1fr))` } }}>
      {items.map((x) => (
        <Box key={x.label} sx={{ borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.8)", p: 1.75, display: "grid", gap: 0.5, alignContent: "start", minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Badge icon={x.icon} tint={x.tint} size={28} />
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{x.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: INK, lineHeight: 1.1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{x.value}</Typography>
            {x.ch != null && <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: tone(x.ch, x.lower) }}>{signedPct(x.ch)}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{x.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}
const ch2 = (a: number | null, b: number | null) => (a != null && b != null && b ? changeOf(a, b) : null);
/** a topic's (or several's) figures for the period - against the same months a year before where both have tickets */
function DiveTiles({ f, is, label }: { f: Frame; is: (t: Tk) => boolean; label: string }) {
  const a = aggSum([...groups(f, (t) => (is(t) ? "x" : null)).values()]);
  const compare = f.totalPrev?.created != null;
  const p = compare ? aggSum([...groups(f, (t) => (is(t) ? "x" : null), "prev").values()]) : null;
  const all = aggSum([...groups(f, () => "x").values()]);
  const allP = compare ? aggSum([...groups(f, () => "x", "prev").values()]) : null;
  // the value only once every month of the period is read again - a sum of some months would read as the whole
  const read = a.n > 0 && a.v6 === a.n;
  const orders = ordersOfPeriod(f), ordersP = f.totalPrev?.orders ?? null;
  const top = Object.entries(a.pcs).filter(([k]) => !notPc(k)).sort((x, y) => y[1] - x[1]);
  const S = 14;
  return <Tiles items={[
    { label: "Back Office tickets", value: int(all.n), ch: allP ? ch2(all.n, allP.n) : null, lower: true, sub: `every topic, ${periodOf(f)}`, icon: <ConfirmationNumberOutlinedIcon sx={{ fontSize: S }} />, tint: "slate" },
    { label, value: int(a.n), ch: p ? ch2(a.n, p.n) : null, lower: true, sub: `${pct(all.n ? a.n / all.n : null)} of the Back Office's tickets`, icon: <ConfirmationNumberOutlinedIcon sx={{ fontSize: S }} />, tint: "blue" },
    { label: "Per 100 orders", value: p100(per100(a.n, orders)), ch: p ? ch2(per100(a.n, orders), per100(p.n, ordersP)) : null, lower: true, sub: `against the period's ${int(orders)} orders`, icon: <PercentOutlinedIcon sx={{ fontSize: S }} />, tint: "purple" },
    { label: "C2S tickets", value: int(a.c2s), ch: p ? ch2(a.c2s, p.c2s) : null, lower: true, sub: a.n ? `${pct(a.c2s / a.n)} of them cut to size` : "", icon: <ContentCutOutlinedIcon sx={{ fontSize: S }} />, tint: "pink" },
    { label: "Value of their orders", value: read ? moneyShort(a.value) : a.n ? "…" : "—", sub: read ? `${int(a.ordered)} tickets about an order · CHF and EUR as booked` : "being read again - it shows once every month is counted", icon: <PaymentsOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
    { label: "Days to the first reply", value: days(avgOf(a.replyS, a.replyN)), ch: p ? ch2(avgOf(a.replyS, a.replyN), avgOf(p.replyS, p.replyN)) : null, lower: true, sub: `${int(a.replyN)} answered`, icon: <ForumOutlinedIcon sx={{ fontSize: S }} />, tint: "amber" },
    { label: "Days to close", value: days(avgOf(a.closeS, a.closeN)), ch: p ? ch2(avgOf(a.closeS, a.closeN), avgOf(p.closeS, p.closeN)) : null, lower: true, sub: `${int(a.closeN)} closed since`, icon: <TimerOutlinedIcon sx={{ fontSize: S }} />, tint: "amber" },
    { label: "Closed without any answer", value: int(a.quiet), ch: p ? ch2(a.quiet, p.quiet) : null, lower: true, sub: a.cust ? `${pct(a.quiet / a.cust)} of ${int(a.cust)} from customers` : "no customer tickets", icon: <MarkEmailUnreadOutlinedIcon sx={{ fontSize: S }} />, tint: "slate" },
    { label: "Main profit centre", value: top[0]?.[0] ?? "—", sub: top.length ? top.slice(0, 3).map(([k, n]) => `${k} ${pct(n / a.n)}`).join(" · ") : "", icon: <ApartmentOutlinedIcon sx={{ fontSize: S }} />, tint: "blue" },
  ]} />;
}
/** a topic's month by month: its tickets and last year's, per 100 orders, the C2S, the value of their orders, the speed */
function DiveMonths({ f, is }: { f: Frame; is: (t: Tk) => boolean }) {
  const n = drawn(f);
  const cur = monthAggs(f, is), prev = monthAggs(f, is, "prev");
  const sum = aggSum(cur.slice(f.from, Math.max(f.done, f.from + 1)).filter((x): x is Agg => !!x));
  const rows: MonthRow[] = [
    { name: "Tickets", values: cur.map((a) => a?.n ?? null), fmt: int, color: SERIES[0], total: int(sum.n) },
    ...(prev.some((x) => x) ? [{ name: `Tickets, ${f.year - 1}`, values: prev.map((a) => a?.n ?? null), fmt: int, color: DEEMPHASIS, total: int(aggSum(prev.filter((x): x is Agg => !!x)).n), sub: "the same month a year before" }] : []),
    { name: "Per 100 orders", values: cur.map((a, i) => (a ? per100(a.n, f.cur[i].orders) : null)), fmt: (v) => v.toFixed(1), color: SERIES[1], total: p100(per100(sum.n, ordersOfPeriod(f))) },
    { name: "C2S tickets", values: cur.map((a) => a?.c2s ?? null), fmt: int, color: SERIES[3], total: int(sum.c2s), sub: sum.n ? `${pct(sum.c2s / sum.n)} of them` : undefined },
    { name: "Value of their orders", values: cur.map((a) => (a && a.n && a.v6 === a.n ? a.value : null)), notes: cur.map((a) => (a && a.n && a.v6 < a.n ? "…" : null)), fmt: moneyShort, color: SERIES[2],
      total: sum.n && sum.v6 === sum.n ? moneyShort(sum.value) : sum.n ? <Box component="span" sx={{ color: FAINT, fontWeight: 600, fontSize: "0.74rem" }}>being read</Box> : "—", sub: "CHF and EUR as booked" },
    { name: "Days to close", values: cur.map((a) => (a ? avgOf(a.closeS, a.closeN) : null)), fmt: (v) => v.toFixed(1), color: SEQUENTIAL[4], total: d1(avgOf(sum.closeS, sum.closeN)) },
  ];
  return <MonthRows labels={f.labels.slice(0, n)} rows={rows} totalHead={f.doneWords || "Total"} />;
}
const outside = "Outside the Back Office";
const coName = (f: Frame, id: string) => { const x = f.co[id]; return x && x.length > 3 ? (x as string[])[3] : id ? `Company ${id}` : "No company"; };
/** a topic's tickets per profit centre, per person, per customer - one table each */
function DiveBy({ f, is, by }: { f: Frame; is: (t: Tk) => boolean; by: "pc" | "person" | "company" }) {
  const compare = f.totalPrev?.created != null;
  const key = (t: Tk, r: number[], d: string[]) => (!is(t) ? null : by === "pc" ? pcOfRow(d, r) : by === "person" ? (inTeam(f, t.owner) ? ownerName(f, t.owner) : outside) : coName(f, t.company));
  const cur = groups(f, key), prev = compare ? groups(f, key, "prev") : null;
  if (!cur.size) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No tickets for this choice.</Typography>;
  const pcOrders = new Map(sumField(f, "pcs").map((r) => [r.label, r.cur]));
  const lead: Col<GRow>[] = by === "pc"
    ? [{ key: "pco", head: "Per 100 of its orders", tip: "Against the profit centre's own orders of the period", cell: (r) => p100(per100(r.a.n, pcOrders.get(r.label))), sort: (r) => per100(r.a.n, pcOrders.get(r.label)) ?? -1 }]
    : by === "company" ? [{ key: "country", head: "Country", cell: (r) => (r.extra?.country as string) ?? "—" }] : [];
  const coOf = new Map<string, string>();
  if (by === "company") for (const m of f.cur) for (const r of m.rows?.created ?? []) { const id = m.rows!.dict[r[RW.company]]; coOf.set(coName(f, id), id); }
  const rows: GRow[] = [...cur].map(([label, a]) => ({ label, a, p: prev?.get(label) ?? null, extra: by === "company" ? { country: f.co[coOf.get(label) ?? ""]?.[1] ?? "—" } : undefined }))
    .sort((x, y) => Number(by === "pc" && notPc(x.label)) - Number(by === "pc" && notPc(y.label)));
  return <AggTable f={f} rows={rows} first={by === "pc" ? "Profit centre" : by === "person" ? "Person" : "Customer"} find={by === "company" ? "a customer" : by === "person" ? "a person" : undefined} lead={lead} compare={compare}
    hide={by === "pc" ? ["per100", "pc"] : ["per100"]} />;
}
/** a topic's tickets per article: the articles named on the ticket, else its orders' largest lines - with the value of their
 *  lines, the C2S ones, the customers (read version 6 on) */
function DiveArts({ f, d, is }: { f: Frame; d: Data; is: (t: Tk) => boolean }) {
  type A = { label: string; n: number; c2s: number; value: number; cos: Set<string> };
  const by = new Map<string, A>();
  let v6 = 0, all = 0;
  eachRow(f, "created", (t, r, i) => {
    if (!is(t)) return;
    all++;
    if (r.length <= RW.from) return;
    v6++;
    for (const [art, v] of artsOf(f.cur[i].rows!.dict[r[RW.arts]])) {
      const x = by.get(art) ?? { label: art, n: 0, c2s: 0, value: 0, cos: new Set<string>() };
      x.n++; x.value += v; if (r[RW.c2s] === 1) x.c2s++; if (t.company) x.cos.add(t.company);
      by.set(art, x);
    }
  });
  if (!by.size) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>{all && !v6 ? "The tickets' articles are being read - each month shows as soon as it is counted again." : "No article on these tickets."}</Typography>;
  const info = (a: string): ArtInfo | undefined => d.arts?.[a];
  const cols: Col<A>[] = [
    { key: "desc", head: "Article", cell: (r) => <Box component="span" title={info(r.label)?.[0]} sx={{ display: "inline-block", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", verticalAlign: "bottom" }}>{info(r.label)?.[0] || "—"}</Box> },
    { key: "group", head: "Main group", cell: (r) => <Box component="span" sx={{ display: "inline-block", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{info(r.label)?.[2] || "—"}</Box> },
    { key: "pc", head: "Profit centre", cell: (r) => info(r.label)?.[1] || "—" },
    { key: "n", head: "Tickets", cell: (r) => int(r.n), sort: (r) => r.n },
    { key: "c2s", head: "C2S", cell: (r) => (r.c2s ? int(r.c2s) : "—"), sort: (r) => r.c2s },
    { key: "cos", head: "Customers", cell: (r) => int(r.cos.size), sort: (r) => r.cos.size },
    { key: "value", head: "Value of its lines", tip: "The article's lines on the tickets' orders, net, CHF and EUR as booked", cell: (r) => money(r.value), sort: (r) => r.value },
  ];
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <FullTable first="Article number" cols={cols} rows={[...by.values()]} find="an article" initial="n" />
      {v6 < all && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{int(all - v6)} tickets of months not counted again yet are left out until they are.</Typography>}
    </Box>
  );
}
/** the charts of a topic's own tab - its figures, its months, per profit centre, per article, per person, per customer */
function dive(p: string, name: string, is: (topic: string) => boolean, why: string, o: { tile?: string; skip?: string[] } = {}): ChartDef[] {
  const keep = (t: Tk) => is(t.topic);
  const L: ListOf = { note: `the tickets filed ${name}`, keep };
  const fig = ({ f }: Ctx) => { const a = aggSum([...groups(f, (t) => (keep(t) ? "x" : null)).values()]); return a.n ? int(a.n) : null; };
  return [
    listed(L)(wide({ id: `${p}Figs`, page: "topics", title: `${name} in figures`, figure: fig, hint: ({ f }) => `${periodOf(f)} · ${why}${f.totalPrev?.created != null ? ` · the change against the same months of ${f.year - 1}` : ""}`, body: ({ f }) => <DiveTiles f={f} is={keep} label={o.tile ?? `${name} tickets`} /> })),
    listed(L)(wide({ id: `${p}Months`, page: "topics", title: `${name}, month by month`, figure: fig, hint: () => "Each month's tickets, last year's beside them, against the month's orders, the C2S ones, the value of their orders, the days to close - the figure of each month under its bar", body: ({ f }) => <DiveMonths f={f} is={keep} /> })),
    listed(L)(wide({ id: `${p}Pcs`, page: "topics", title: `${name} per profit centre`, figure: fig, hint: ({ f }) => `${periodOf(f)} · the profit centre of the order each ticket is about, else of the articles named on it, else its customer's main one · against the profit centre's own orders`, body: ({ f }) => <DiveBy f={f} is={keep} by="pc" /> })),
    listed(L)(wide({ id: `${p}Arts`, page: "topics", title: `${name} per article`, figure: fig, hint: ({ f }) => `${periodOf(f)} · the articles named on each ticket, else the largest lines of its order · the value of those lines · search an article number`, body: ({ f, d }) => <DiveArts f={f} d={d} is={keep} /> })),
    listed(L)(wide({ id: `${p}People`, page: "topics", title: `${name} per person`, figure: fig, hint: ({ f }) => `${periodOf(f)} · by the ticket's owner today - how many, how fast, the customers left without an answer · the owners outside the Back Office together`, body: ({ f }) => <DiveBy f={f} is={keep} by="person" /> })),
    listed(L)(wide({ id: `${p}Cos`, page: "topics", title: `${name} per customer`, figure: fig, hint: ({ f }) => `${periodOf(f)} · the customers behind the tickets - search a name`, body: ({ f }) => <DiveBy f={f} is={keep} by="company" /> })),
  ].filter((c) => !(o.skip ?? []).some((s) => c.id === `${p}${s}`));
}

/* ── the ESO's and the TSA's tickets in detail (SARCLA 04.11.2026: "ESO & TSA tickets should be also improved with a little
   bit more details, win rate and so forth") - the ESO Reports' own read, added up on the server (boInbound.ts) ── */

type Pipe = "eso" | "tsa";
const PIPE: Record<Pipe, string> = { eso: "ESO", tsa: "TSA" };
/** last year's same months beside this year's only with at least 50 tickets in them - the pipelines began in July 2025 */
const IN_MIN = 50;
const inPlus = (a: InRow, b: InRow | null | undefined) => { if (b) for (let i = 0; i < a.length; i++) a[i] += b[i] ?? 0; return a; };
/** a month's figures of a pipeline (or of one channel or owner in it) - null before the pipeline's first month, or while the
 *  ESO Reports' read is not in */
function inMonth(d: Data, pipe: Pipe, ym: string, by?: ["ch" | "who", string]): InRow | null {
  const p = d.inDetail?.[pipe];
  if (!p) return null;
  const first = Object.keys(p.m).sort()[0];
  if (!first || ym < first || ym > d.current) return null;
  return inPlus(inZero(), (by ? p[by[0]][by[1]] : p.m)?.[ym]);
}
/** the period's figures added up - this year's, or the same months a year before (null when one of them has none) */
function inPeriod(f: Frame, d: Data, pipe: Pipe, which: "cur" | "prev" = "cur", by?: ["ch" | "who", string]): InRow | null {
  const xs = f.yms.slice(f.from, Math.max(f.done, f.from + 1)).map((ym) => inMonth(d, pipe, which === "cur" ? ym : back(ym), by));
  if (xs.every((x) => x == null) || (which === "prev" && xs.some((x) => x == null))) return null;
  return xs.reduce<InRow>((s, x) => inPlus(s, x), inZero());
}
const inPrev = (f: Frame, d: Data, pipe: Pipe) => { const p = inPeriod(f, d, pipe, "prev"); return p && p[IN.n] >= IN_MIN ? p : null; };
const winOf = (a: InRow) => (a[IN.resolved] ? a[IN.won] / a[IN.resolved] : null);
const dayOf = (a: InRow) => (a[IN.n] ? a[IN.inDay] / a[IN.n] : null);
const quietIn = (a: InRow) => (a[IN.closed] ? a[IN.quiet] / a[IN.closed] : null);
const firstOf = (a: InRow) => (a[IN.hoursN] ? a[IN.hoursS] / a[IN.hoursN] : null);
const openIn = (a: InRow) => a[IN.n] - a[IN.closed];
/** working hours as a person says them - a working day is 9 hours */
const wh = (h: number | null) => (h == null ? "—" : h < 9 ? `${h.toFixed(1)} working hours` : `${(h / 9).toFixed(1)} working days`);
const eur = (v: number) => `${moneyShort(v)} EUR`;
const NO_READ = <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>The ESO Reports&apos; ticket read is still counting - these figures show as soon as it is in.</Typography>;

/** a pipeline's figures for the period - against the same months a year before where both have enough tickets */
function InTiles({ f, d, pipe }: { f: Frame; d: Data; pipe: Pipe }) {
  const a = inPeriod(f, d, pipe), p = inPrev(f, d, pipe);
  if (!a) return NO_READ;
  const orders = ordersOfPeriod(f), ordersP = f.totalPrev?.orders ?? null;
  const c = (x: number | null, y: number | null) => (p ? ch2(x, y) : null);
  const S = 14;
  return <Tiles items={[
    { label: `${PIPE[pipe]} tickets`, value: int(a[IN.n]), ch: c(a[IN.n], p?.[IN.n] ?? null), lower: true, sub: "incoming - the sales actions left out", icon: <ConfirmationNumberOutlinedIcon sx={{ fontSize: S }} />, tint: "blue" },
    { label: "Per 100 orders", value: p100(per100(a[IN.n], orders)), ch: c(per100(a[IN.n], orders), p ? per100(p[IN.n], ordersP) : null), lower: true, sub: `against the period's ${int(orders)} orders`, icon: <PercentOutlinedIcon sx={{ fontSize: S }} />, tint: "purple" },
    { label: "Win rate", value: pct(winOf(a)), ch: c(winOf(a), p ? winOf(p) : null), sub: `${int(a[IN.won])} won of ${int(a[IN.resolved])} closed with a resolution`, icon: <EmojiEventsOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
    { label: "Contacted within a working day", value: pct(dayOf(a)), ch: c(dayOf(a), p ? dayOf(p) : null), sub: `${int(a[IN.inDay])} of the ${int(a[IN.n])} tickets`, icon: <BoltOutlinedIcon sx={{ fontSize: S }} />, tint: "amber" },
    { label: "Time to the first contact", value: wh(firstOf(a)), ch: c(firstOf(a), p ? firstOf(p) : null), lower: true, sub: "on average - working hours, Monday to Friday 8-17", icon: <TimerOutlinedIcon sx={{ fontSize: S }} />, tint: "amber" },
    { label: "Closed without any activity", value: int(a[IN.quiet]), ch: c(a[IN.quiet], p?.[IN.quiet] ?? null), lower: true, sub: `${pct(quietIn(a))} of the ${int(a[IN.closed])} closed`, icon: <MarkEmailUnreadOutlinedIcon sx={{ fontSize: S }} />, tint: "slate" },
    { label: "Still open", value: int(openIn(a)), sub: `${pct(a[IN.n] ? openIn(a) / a[IN.n] : null)} of the tickets`, icon: <HourglassEmptyOutlinedIcon sx={{ fontSize: S }} />, tint: "pink" },
    { label: "Potential won", value: a[IN.pot] ? eur(a[IN.potWon]) : "—", ch: c(a[IN.potWon], p?.[IN.potWon] ?? null), sub: a[IN.pot] ? `of ${eur(a[IN.pot])} on the tickets - Sales' estimate` : "no potential on these tickets", icon: <PaymentsOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
  ]} />;
}
/** a pipeline's rate or figure month by month, last year's beside it */
function inTrend(id: string, pipe: Pipe, title: string, note: string, of: (a: InRow) => number | null, fmt: (v: number | null) => string): ChartDef {
  return {
    id, page: "sales-tickets", title,
    figure: ({ f, d }) => { const a = inPeriod(f, d, pipe); const v = a ? of(a) : null; return v == null ? null : fmt(v); },
    hint: ({ f, d }) => {
      const a = inPeriod(f, d, pipe), p = inPrev(f, d, pipe);
      const v = a ? of(a) : null, w = p ? of(p) : null;
      const ch = v != null && w != null ? changeOf(v, w) : null;
      return [note, f.done && v != null ? `${f.doneWords}: ${fmt(v)}${ch != null ? ` (${signedPct(ch)} on last year)` : ""}` : ""].filter(Boolean).join(" · ");
    },
    body: ({ f, d }) => {
      if (!d.inDetail) return NO_READ;
      const n = drawn(f);
      const at = (ym: string) => { const a = inMonth(d, pipe, ym); return a && a[IN.n] ? of(a) : null; };
      const values = f.yms.slice(0, n).map(at), compare = f.yms.slice(0, n).map((ym) => at(back(ym)));
      return <MonthTrend values={values} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={fmt} />;
    },
  };
}
/** each month's tickets by where they stand today */
function InOutcomes({ f, d, pipe }: { f: Frame; d: Data; pipe: Pipe }) {
  if (!d.inDetail) return NO_READ;
  const n = drawn(f);
  const data = f.yms.slice(0, n).map((ym, i) => {
    const a = inMonth(d, pipe, ym);
    const v = (x: (a: InRow) => number) => (a && a[IN.n] ? x(a) : null);
    // four parts at most (the chart's palette): closed without a resolution goes with the closed otherwise
    return { x: f.labels[i], won: v((a) => a[IN.won]), lost: v((a) => a[IN.lost]), other: v((a) => a[IN.closed] - a[IN.won] - a[IN.lost]), open: v(openIn) };
  });
  return <StackedColumns height={280} format={n0} data={data}
    parts={[{ key: "won", label: "Won" }, { key: "lost", label: "Lost" }, { key: "other", label: "Closed otherwise or without a resolution" }, { key: "open", label: "Still open", color: DEEMPHASIS }]} />;
}
/** a pipeline's tickets per channel or per owner - every column sorts */
function InTable({ f, d, pipe, by }: { f: Frame; d: Data; pipe: Pipe; by: "ch" | "who" }) {
  const p = d.inDetail?.[pipe], all = inPeriod(f, d, pipe);
  if (!p || !all) return NO_READ;
  const allP = inPrev(f, d, pipe);
  type R = { label: string; a: InRow; p: InRow | null };
  const rows: R[] = Object.keys(p[by]).map((label) => ({ label, a: inPeriod(f, d, pipe, "cur", [by, label]) ?? inZero(), p: allP ? inPeriod(f, d, pipe, "prev", [by, label]) : null })).filter((r) => r.a[IN.n] > 0);
  if (!rows.length) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No tickets in these months.</Typography>;
  const part = (n: number, of: number) => (n ? <span>{int(n)} <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>{pct(of ? n / of : null)}</Box></span> : "—");
  const cols: Col<R>[] = [
    { key: "n", head: "Tickets", tip: allP ? `Against the same months of ${f.year - 1}` : undefined, cell: (r) => (r.p && r.p[IN.n] ? withChangeCell(int(r.a[IN.n]), r.a[IN.n], r.p[IN.n], true) : int(r.a[IN.n])), sort: (r) => r.a[IN.n] },
    { key: "share", head: "Share", tip: "Of the incoming tickets", cell: (r) => pct(all[IN.n] ? r.a[IN.n] / all[IN.n] : null), sort: (r) => r.a[IN.n] },
    { key: "won", head: "Won", cell: (r) => int(r.a[IN.won]), sort: (r) => r.a[IN.won] },
    { key: "win", head: "Win rate", tip: "Won of the tickets closed with a resolution", cell: (r) => pct(winOf(r.a)), sort: (r) => winOf(r.a) ?? -1 },
    { key: "day", head: "In a working day", tip: "Contacted within a working day of coming in", cell: (r) => pct(dayOf(r.a)), sort: (r) => dayOf(r.a) ?? -1 },
    { key: "first", head: "First contact", tip: "Working hours to the first contact, on average", cell: (r) => wh(firstOf(r.a)), sort: (r) => firstOf(r.a) ?? -1 },
    { key: "quiet", head: "No activity", tip: "Closed with nothing logged on them - and their share of the closed", cell: (r) => part(r.a[IN.quiet], r.a[IN.closed]), sort: (r) => r.a[IN.quiet] },
    { key: "open", head: "Still open", cell: (r) => int(openIn(r.a)), sort: (r) => openIn(r.a) },
    { key: "pot", head: "Potential won", tip: "Sales' potential estimate of the won tickets, EUR", cell: (r) => (r.a[IN.potWon] ? eur(r.a[IN.potWon]) : "—"), sort: (r) => r.a[IN.potWon] },
  ];
  return <FullTable first={by === "ch" ? "Channel" : "Person"} cols={cols} rows={rows} find={by === "who" ? "a person" : undefined} initial="n" total={{ label: "Total", a: all, p: allP }} />;
}
/** the graphs of the ESO's (or the TSA's) tab - its figures, the rates month by month, what became of the tickets, the tables */
function inCharts(pipe: Pipe): ChartDef[] {
  const N = PIPE[pipe];
  return [
    wide({
      id: `${pipe}Figs`, page: "sales-tickets", title: `${N} in figures`, figure: ({ f, d }) => { const a = inPeriod(f, d, pipe); return a ? int(a[IN.n]) : null; },
      hint: ({ f, d }) => `${periodOf(f)} · the ${N}'s incoming tickets, the sales actions left out${inPrev(f, d, pipe) ? ` · the change against the same months of ${f.year - 1}` : ""}`,
      body: ({ f, d }) => <InTiles f={f} d={d} pipe={pipe} />,
    }),
    inTrend(`${pipe}Win`, pipe, "Win rate, month by month", "Won - closed as Ordered or a one-shot order - of the tickets closed with a resolution", winOf, share),
    inTrend(`${pipe}Day`, pipe, "Contacted within a working day", "The first reply, e-mail, call or meeting within a working day of the ticket coming in", dayOf, share),
    wide({ id: `${pipe}Out`, page: "sales-tickets", title: "What became of the tickets, month by month", hint: () => "Each month's incoming tickets by where they stand today: won, lost, closed otherwise or without a resolution, still open", body: ({ f, d }) => <InOutcomes f={f} d={d} pipe={pipe} /> }),
    inTrend(`${pipe}First`, pipe, "Time to the first contact", "Working hours from the ticket coming in to the first contact, on average - Monday to Friday 8-17", firstOf, (v) => (v == null ? "—" : `${v.toFixed(1)} h`)),
    inTrend(`${pipe}Quiet`, pipe, "Closed without any activity", "Of the month's tickets closed so far, those with nothing logged on them at all", quietIn, share),
    wide({ id: `${pipe}Ch`, page: "sales-tickets", title: `${N} tickets per channel`, hint: ({ f }) => `${periodOf(f)} · where each ticket came from: how many, won, how fast the first contact came, closed without any activity, still open, the potential won · a header sorts`, body: ({ f, d }) => <InTable f={f} d={d} pipe={pipe} by="ch" /> }),
    wide({ id: `${pipe}Who`, page: "sales-tickets", title: `${N} tickets per person`, hint: ({ f }) => `${periodOf(f)} · by the ticket's owner today · search a name, a header sorts`, body: ({ f, d }) => <InTable f={f} d={d} pipe={pipe} by="who" /> }),
  ];
}

/* ── GQS, the whole pipeline (SARCLA 04.11.2026: "GQS is very very incomplete - this is a full pipeline, we should have the
   full scope") - every task on its own, from its stage and STATUS OF GQS histories (boGqs.ts): the request, the approval,
   the work in each stage, the offer or the refusal, the result. Requests count by the day they came in, offers by the day
   first sent, refusals by the day refused - a month's own requests are young, so what came of them is said, never compared. ── */

const NO_GQS = <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>The GQS tasks are being read - these figures show in a minute.</Typography>;
const NONE_GQS = <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No GQS request in these months.</Typography>;
/** each task with the months it came in, was first offered and was refused */
type GIdx = { t: GqsTask; c: string; of: string | null; rf: string | null };
const gCache = new WeakMap<Data, GIdx[]>();
function gAll(d: Data): GIdx[] | null {
  const ts = d.gqsTasks?.tasks;
  if (!ts) return null;
  let x = gCache.get(d);
  if (!x) gCache.set(d, (x = ts.map((t) => ({ t, c: swissDay(t.c).slice(0, 7), of: t.of ? swissDay(t.of).slice(0, 7) : null, rf: t.s === "refused" && t.rf ? swissDay(t.rf).slice(0, 7) : null }))));
  return x;
}
type GWhich = "c" | "of" | "rf";
/** the tasks that came in (c), were first offered (of) or refused (rf) in some months */
function gBy(d: Data, yms: string[], which: GWhich): GqsTask[] | null {
  const all = gAll(d);
  if (!all) return null;
  const s = new Set(yms);
  return all.filter((x) => x[which] != null && s.has(x[which]!)).map((x) => x.t);
}
/** the period's months - the complete ones, the month to date only while none is */
const gYms = (f: Frame) => f.yms.slice(f.from, Math.max(f.done, f.from + 1));
/** the same months a year before - only where the pipeline already ran in every one of them (from July 2025) */
const gPrevYms = (f: Frame) => { const p = gYms(f).map(back); return p.every((ym) => ym >= GQS_FIRST) ? p : null; };
const gName = (f: Frame, id: string | undefined) => (id ? ownerName(f, id) : "Nobody");
const gType = (t: GqsTask) => t.ty ?? (t.c < Date.UTC(2026, 0, 1) ? "Not asked yet (before 2026)" : "No type");
const hShort = (h: number | null) => (h == null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`);
const eurN = (v: number | null) => (v == null ? "—" : moneyShort(v));
const dayCh = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}`);
const ago = (ms: number | undefined) => (ms ? Math.max(0, (Date.now() - ms) / 86_400_000) : null);
/** a list's rows named by customer and requester - a second request of the same pair numbered, so each row is its own */
const clipTo = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const uniqLabels = <R extends { label: string }>(rows: R[]): R[] => { const seen = new Map<string, number>(); return rows.map((r) => { const n = (seen.get(r.label) ?? 0) + 1; seen.set(r.label, n); return n > 1 ? { ...r, label: `${r.label} (${n})` } : r; }); };
const partCell = (n: number, of: number) => (n ? <span>{int(n)} <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>{pct(of ? n / of : null)}</Box></span> : "—");

/** the period in figures - against the same months a year before, where the pipeline ran then */
function GqTiles({ f, d }: { f: Frame; d: Data }) {
  const yms = gYms(f), py = gPrevYms(f);
  const req = gBy(d, yms, "c");
  if (!req) return NO_GQS;
  const a = sumOf(req), o = offersOf(gBy(d, yms, "of")!), r = refusalsOf(gBy(d, yms, "rf")!);
  const pa = py ? sumOf(gBy(d, py, "c")!) : null, po = py ? offersOf(gBy(d, py, "of")!) : null;
  const win = winRate(o.won, o.lost), winP = po ? winRate(po.won, po.lost) : null;
  const med = median(o.days), medP = po ? median(po.days) : null;
  const S = 14;
  return <Tiles items={[
    { label: "GQS requests", value: int(a.n), ch: pa ? ch2(a.n, pa.n) : null, sub: `${int(a.customers)} customers${a.again ? ` · ${int(a.again)} of them asked more than once` : ""}`, icon: <AssignmentOutlinedIcon sx={{ fontSize: S }} />, tint: "blue" },
    { label: "Sent to a line manager", value: int(a.review), sub: a.review ? `${pct(a.review / a.n)} of the requests · ${int(a.lmYes)} approved, ${int(a.lmNo)} refused${a.lmWait ? `, ${int(a.lmWait)} not decided` : ""}` : "the approval is kept from March 2026", icon: <VerifiedOutlinedIcon sx={{ fontSize: S }} />, tint: "purple" },
    { label: "Offers sent to Sales", value: int(o.n), ch: po ? ch2(o.n, po.n) : null, sub: "by the day first sent, whenever asked for", icon: <SendOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
    { label: "Days to the offer", value: days(med), ch: medP != null ? ch2(med, medP) : null, lower: true, sub: "from the request to the offer sent - the median", icon: <TimerOutlinedIcon sx={{ fontSize: S }} />, tint: "amber" },
    { label: "Refused", value: int(r.n), sub: r.n ? `by GQS ${r.gqs} · the Back Office ${r.bo} · a line manager ${r.lm}${r.none ? ` · not said ${r.none}` : ""}` : "none in these months", icon: <BlockOutlinedIcon sx={{ fontSize: S }} />, tint: "pink" },
    { label: "Still open", value: int(a.open), sub: `${pct(a.n ? a.open / a.n : null)} of these months' requests`, icon: <HourglassEmptyOutlinedIcon sx={{ fontSize: S }} />, tint: "slate" },
    { label: "Won", value: int(o.won), sub: `of the offers sent · ${int(o.lost)} lost, ${int(o.n - o.won - o.lost)} without a result yet`, icon: <EmojiEventsOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
    { label: "Win rate", value: pct(win), ch: winP != null ? ch2(win, winP) : null, sub: "won of the offers whose result is known", icon: <PercentOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
    { label: "Potential asked", value: a.potN ? eur(a.pot) : "—", ch: pa?.potN ? ch2(a.pot, pa.pot) : null, sub: `Sales' order potential, on ${int(a.potN)} of the ${int(a.n)} requests`, icon: <PaymentsOutlinedIcon sx={{ fontSize: S }} />, tint: "blue" },
    { label: "Potential won", value: o.potWon ? eur(o.potWon) : "—", ch: po?.potWon ? ch2(o.potWon, po.potWon) : null, sub: o.pot ? `of ${eur(o.pot)} offered · ${eur(o.potLost)} lost` : "no potential on these offers", icon: <PaymentsOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
    { label: "Days at GQS", value: days(median(o.atGqs)), lower: true, sub: "in Waiting on GQS, the offers that went there - the median", icon: <WorkHistoryOutlinedIcon sx={{ fontSize: S }} />, tint: "amber" },
    { label: "Reminded", value: int(a.reminded), sub: `${pct(a.n ? a.reminded / a.n : null)} of the requests went to Remind Back-Office`, icon: <MarkEmailUnreadOutlinedIcon sx={{ fontSize: S }} />, tint: "slate" },
  ]} />;
}

/** the period's requests from the request to the result, in one diagram */
function GqFlow({ f, d }: { f: Frame; d: Data }) {
  const req = gBy(d, gYms(f), "c");
  if (!req) return NO_GQS;
  if (!req.length) return NONE_GQS;
  const fl = flowOf(req);
  const TONE: Record<FlowNode["tone"], string> = { source: SERIES[0], good: SERIES[2], bad: SERIES[1], wait: SERIES[3], none: DEEMPHASIS };
  return <Sankey height={400} columns={FLOW_COLUMNS} label="The GQS pipeline, from the request to the result"
    nodes={fl.nodes.map((n) => ({ id: n.id, column: n.column, label: n.label, color: TONE[n.tone] }))} links={fl.links} format={(v) => int(v)} />;
}

/** a figure month by month, last year's beside it - over the tasks that came in, were offered or refused each month */
function gTrend(id: string, title: string, note: string, which: GWhich, of: (ts: GqsTask[]) => number | null, fmt: (v: number | null) => string, wideIt = false): ChartDef {
  const def: ChartDef = {
    id, page: "gqs", title,
    figure: ({ f, d }) => { const ts = gBy(d, gYms(f), which); const v = ts ? of(ts) : null; return v == null ? null : fmt(v); },
    hint: ({ f, d }) => {
      const ts = gBy(d, gYms(f), which), py = gPrevYms(f);
      const v = ts ? of(ts) : null, w = py ? of(gBy(d, py, which) ?? []) : null;
      const ch = v != null && w != null ? changeOf(v, w) : null;
      return [note, f.done && v != null ? `${f.doneWords}: ${fmt(v)}${ch != null ? ` (${signedPct(ch)} on last year)` : ""}` : ""].filter(Boolean).join(" · ");
    },
    body: ({ f, d }) => {
      if (!gAll(d)) return NO_GQS;
      const n = drawn(f);
      const at = (ym: string) => (ym < GQS_FIRST || ym > d.current ? null : of(gBy(d, [ym], which) ?? []));
      const values = f.yms.slice(0, n).map(at), compare = f.yms.slice(0, n).map((ym) => at(back(ym)));
      return <MonthTrend values={values} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={fmt} />;
    },
  };
  return wideIt ? wide(def) : def;
}

/** columns month by month: the parts of each month's tasks (four at most - the chart's palette) */
function GqStack({ f, d, which, parts, fmt = n0 }: { f: Frame; d: Data; which: GWhich; parts: { key: string; label: string; color?: string; of: (ts: GqsTask[]) => number }[]; fmt?: (v: number | null) => string }) {
  if (!gAll(d)) return NO_GQS;
  const n = drawn(f);
  const data = f.yms.slice(0, n).map((ym, i) => {
    const ts = ym < GQS_FIRST || ym > d.current ? null : gBy(d, [ym], which);
    return { x: f.labels[i], ...Object.fromEntries(parts.map((p) => [p.key, ts && ts.length ? p.of(ts) : null])) };
  });
  return <StackedColumns height={280} format={fmt} data={data} parts={parts.map(({ key, label, color }) => ({ key, label, color }))} />;
}

/** the period's requests per requester, person, type or customer - every column sorts */
type GqR = { label: string; s: GSum; ts: GqsTask[] };
function GqTable({ f, d, by, first, find, more = [], hide = [] }: { f: Frame; d: Data; by: (t: GqsTask) => string; first: string; find?: string; more?: Col<GqR>[]; hide?: string[] }) {
  const ts = gBy(d, gYms(f), "c");
  if (!ts) return NO_GQS;
  if (!ts.length) return NONE_GQS;
  const groups = new Map<string, GqsTask[]>();
  for (const t of ts) { const k = by(t); const g = groups.get(k); if (g) g.push(t); else groups.set(k, [t]); }
  const rows: GqR[] = [...groups].map(([label, xs]) => ({ label, s: sumOf(xs), ts: xs }));
  const all = sumOf(ts);
  const base: Col<GqR>[] = [
    { key: "n", head: "Requests", cell: (r) => int(r.s.n), sort: (r) => r.s.n },
    { key: "share", head: "Share", tip: "Of the period's requests", cell: (r) => pct(all.n ? r.s.n / all.n : null), sort: (r) => r.s.n },
    { key: "lm", head: "To a line manager", tip: "Sent to a line manager to approve - and their share of the requests", cell: (r) => partCell(r.s.review, r.s.n), sort: (r) => r.s.review },
    { key: "offer", head: "Offer sent", tip: "In Offer Sent to Sales now - and their share", cell: (r) => partCell(r.s.offer, r.s.n), sort: (r) => r.s.offer },
    { key: "refused", head: "Refused", cell: (r) => partCell(r.s.refused, r.s.n), sort: (r) => r.s.refused },
    { key: "open", head: "Still open", cell: (r) => int(r.s.open), sort: (r) => r.s.open },
    { key: "won", head: "Won", cell: (r) => int(r.s.won), sort: (r) => r.s.won },
    { key: "win", head: "Win rate", tip: "Won of the offers whose result is known", cell: (r) => pct(winRate(r.s.won, r.s.lost)), sort: (r) => winRate(r.s.won, r.s.lost) ?? -1 },
    { key: "pot", head: "Potential asked", tip: "Sales' order potential on the requests, EUR", cell: (r) => (r.s.potN ? eur(r.s.pot) : "—"), sort: (r) => r.s.pot },
    { key: "potWon", head: "Potential won", tip: "The order potential of the won offers, EUR", cell: (r) => (r.s.potWon ? eur(r.s.potWon) : "—"), sort: (r) => r.s.potWon },
    { key: "days", head: "Days to the offer", tip: "From the request to the offer sent - the median", cell: (r) => days(median(r.s.toOffer)), sort: (r) => median(r.s.toOffer) ?? -1 },
  ];
  const cols = [...base, ...more].filter((c) => !hide.includes(c.key));
  return <FullTable first={first} cols={cols} rows={rows} find={find} initial="n" total={{ label: "Total", s: all, ts }} />;
}

/** a few bars of the period's requests - per requester, per person */
function GqBars({ f, d, by, of = (xs) => xs.length, fmt = n0, top = 12, sub }: { f: Frame; d: Data; by: (t: GqsTask) => string; of?: (xs: GqsTask[]) => number | null; fmt?: (v: number | null) => string; top?: number; sub?: (xs: GqsTask[]) => string }) {
  const ts = gBy(d, gYms(f), "c");
  if (!ts) return NO_GQS;
  const groups = new Map<string, GqsTask[]>();
  for (const t of ts) { const k = by(t); const g = groups.get(k); if (g) g.push(t); else groups.set(k, [t]); }
  const rows = [...groups].map(([label, xs]) => ({ label, value: of(xs), secondary: sub?.(xs) })).filter((r) => r.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, top);
  return <BarList rows={rows} format={fmt} emptyMessage="No GQS request in these months." />;
}

/** why the requests went to the line manager, by the approval rule as it stands */
function GqWhy({ f, d }: { f: Frame; d: Data }) {
  const ts = gBy(d, gYms(f), "c");
  if (!ts) return NO_GQS;
  const rev = ts.filter((t) => t.ap === "r");
  const lim = d.gqsTasks!.limits;
  const e = (n: number) => `${Math.round(n).toLocaleString("de-CH")} EUR`, m = (x: number) => `${Math.round(x * 100)} %`;
  const LABEL: Record<Reason | "none", string> = {
    big: `Potential ${e(lim.bigFrom)} or more`, mid: `${e(lim.midFrom).replace(" EUR", "")}-${e(lim.midTo)}, margin ≤ ${m(lim.midMargin)}`,
    small: `Up to ${e(lim.smallUpTo)}, margin ≤ ${m(lim.smallMargin)}`, liquidation: "A liquidation article", none: "None of these today",
  };
  const KEYS: (Reason | "none")[] = ["big", "mid", "small", "liquidation", "none"];
  const rows = KEYS.map((k) => ({ label: LABEL[k], value: rev.filter((t) => (t.rule ?? "none") === k).length }))
    .filter((r) => r.value).map((r) => ({ ...r, secondary: pct(r.value / rev.length) }));
  return <BarList rows={rows} format={n0} labelWidth={290} maxLabel={52} emptyMessage="No request went to a line manager in these months." />;
}

/** the refused requests of the period, the reason each was given */
function GqReasons({ f, d }: { f: Frame; d: Data }) {
  const ts = gBy(d, gYms(f), "rf");
  if (!ts) return NO_GQS;
  if (!ts.length) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No GQS request refused in these months.</Typography>;
  type R = { label: string; t: GqsTask };
  const BY = { gqs: "GQS", bo: "The Back Office", lm: "A line manager" } as const;
  const rows: R[] = uniqLabels(ts.map((t) => ({ label: `${clipTo(t.cu ?? "No customer", 42)} · ${gName(f, t.rq)}`, t })));
  const cols: Col<R>[] = [
    { key: "when", head: "Refused", cell: (r) => (r.t.rf ? swissDay(r.t.rf).split("-").reverse().join(".") : "—"), sort: (r) => r.t.rf ?? 0 },
    { key: "by", head: "By", cell: (r) => (r.t.by ? BY[r.t.by] : "Not said") },
    { key: "why", head: "The reason given", cell: (r) => <Box component="span" title={r.t.why ?? ""} sx={{ display: "inline-block", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "bottom", color: r.t.why ? INK : FAINT }}>{r.t.why ?? "none typed in"}</Box> },
    { key: "type", head: "Type", cell: (r) => gType(r.t) },
    { key: "pot", head: "Potential", cell: (r) => (r.t.pot != null ? eur(r.t.pot) : "—"), sort: (r) => r.t.pot ?? -1 },
    { key: "open", head: "", cell: (r) => <Box component="a" href={`https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${r.t.id}`} target="_blank" rel="noreferrer" sx={{ color: TINT.blue.fg, fontWeight: 600 }}>Open</Box> },
  ];
  return <FullTable first="Customer · requester" cols={cols} rows={rows} find="a customer or a requester" initial="when" />;
}

/** each stage: how many of the period's requests went through it, how long they stayed - and how many are in it now */
function GqStages({ f, d, table = false }: { f: Frame; d: Data; table?: boolean }) {
  const ts = gBy(d, gYms(f), "c"), all = gAll(d);
  if (!ts || !all) return NO_GQS;
  if (!ts.length) return NONE_GQS;
  const now = new Map<GStage, number>();
  for (const x of all) now.set(x.t.s, (now.get(x.t.s) ?? 0) + 1);
  const st = stageTimes(ts);
  if (!table) return <BarList rows={st.filter((x) => x.n).map((x) => ({ label: STAGE_LABEL[x.stage], value: x.median, secondary: `${int(x.n)} tasks · ${STAGE_WHO[x.stage]}` }))} format={(v) => (v == null ? "—" : `${v.toFixed(1)} days`)} labelWidth={200} maxLabel={40} />;
  type R = { label: string; x: (typeof st)[number] };
  const cols: Col<R>[] = [
    { key: "n", head: "Tasks there", tip: "Of the period's requests, those that went through the stage", cell: (r) => partCell(r.x.n, ts.length), sort: (r) => r.x.n },
    { key: "median", head: "Days there", tip: "Every visit added up - the median", cell: (r) => days(r.x.median), sort: (r) => r.x.median ?? -1 },
    { key: "mean", head: "On average", cell: (r) => days(r.x.mean), sort: (r) => r.x.mean ?? -1 },
    { key: "who", head: "Waiting on", cell: (r) => STAGE_WHO[r.x.stage] },
    { key: "now", head: "In it now", tip: "Every GQS task in the stage today, whatever the period", cell: (r) => int(now.get(r.x.stage) ?? 0), sort: (r) => now.get(r.x.stage) ?? 0 },
  ];
  return <FullTable first="Stage" cols={cols} rows={st.map((x) => ({ label: STAGE_LABEL[x.stage], x }))} natural />;
}

/** every GQS task open now, whatever the period: where it waits, since when - and those whose sale is already decided */
function GqOpen({ f, d, list = false }: { f: Frame; d: Data; list?: boolean }) {
  const all = gAll(d);
  if (!all) return NO_GQS;
  const open = all.map((x) => x.t).filter((t) => t.s !== "offer" && t.s !== "refused");
  if (!open.length) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No GQS task is open.</Typography>;
  if (!list) {
    const by = new Map<GStage, GqsTask[]>();
    for (const t of open) { const g = by.get(t.s); if (g) g.push(t); else by.set(t.s, [t]); }
    return <BarList rows={WORK.filter((s) => by.has(s)).map((s) => { const xs = by.get(s)!; const old = xs.filter((t) => (ago(t.at) ?? 0) > 28).length; return { label: STAGE_LABEL[s], value: xs.length, secondary: `${old ? `${int(old)} there over 4 weeks · ` : ""}${dayCh(median(xs.map((t) => ago(t.at) ?? 0)))} days there, the median` }; })} format={n0} labelWidth={200} />;
  }
  type R = { label: string; t: GqsTask };
  const cols: Col<R>[] = [
    { key: "stage", head: "Stage", cell: (r) => STAGE_LABEL[r.t.s] },
    { key: "in", head: "Days in it", tip: "Since it entered the stage it is in", cell: (r) => dayCh(ago(r.t.at)), sort: (r) => ago(r.t.at) ?? -1 },
    { key: "age", head: "Days open", tip: "Since the request came in", cell: (r) => dayCh(ago(r.t.c)), sort: (r) => ago(r.t.c) ?? -1 },
    { key: "type", head: "Type", cell: (r) => gType(r.t) },
    { key: "owner", head: "Back Office", cell: (r) => gName(f, r.t.o) },
    { key: "pot", head: "Potential", cell: (r) => (r.t.pot != null ? eur(r.t.pot) : "—"), sort: (r) => r.t.pot ?? -1 },
    { key: "sale", head: "The sale", tip: "WON or LOST already on the task - its sales ticket decided before the offer", cell: (r) => (r.t.res === "w" ? <b style={{ color: GOOD }}>already won</b> : r.t.res === "l" ? <b style={{ color: BAD }}>already lost</b> : "—"), sort: (r) => (r.t.res ? 1 : 0) },
    { key: "open", head: "", cell: (r) => <Box component="a" href={`https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${r.t.id}`} target="_blank" rel="noreferrer" sx={{ color: TINT.blue.fg, fontWeight: 600 }}>Open</Box> },
  ];
  return <FullTable first="Customer · requester" cols={cols} rows={uniqLabels(open.map((t) => ({ label: `${clipTo(t.cu ?? "No customer", 48)} · ${gName(f, t.rq)}`, t })))} find="a customer or a requester" initial="age" />;
}

/** every GQS task open now, whatever the period, by a person - how many, how long in their stage, where most wait
 *  (SARCLA 05.11.2026: "open task show also by person") */
function GqOpenBy({ d, by }: { d: Data; by: (t: GqsTask) => string }) {
  const all = gAll(d);
  if (!all) return NO_GQS;
  const now = Date.now();
  const open: GOpen[] = all.map((x) => x.t).filter((t) => t.s !== "offer" && t.s !== "refused").map((t) => ({ t, inStage: t.at ? daysTo(t.at, now) : null, age: daysTo(t.c, now) }));
  return <GqsOpenBars open={open} by={(o) => by(o.t)} />;
}

/** the graphs of the GQS page */
function gqCharts(): ChartDef[] {
  const typeTop = (f: Frame, d: Data) => {
    const m = new Map<string, number>();
    for (const t of gBy(d, gYms(f), "c") ?? []) m.set(gType(t), (m.get(gType(t)) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  };
  return [
    /* Pipeline */
    wide({ id: "gqFigs", page: "gqs", title: "GQS in figures", figure: ({ f, d }) => { const ts = gBy(d, gYms(f), "c"); return ts ? int(ts.length) : null; },
      hint: ({ f }) => `${periodOf(f)} · requests by the day they came in, offers by the day first sent, refusals by the day refused${gPrevYms(f) ? ` · the change against the same months of ${f.year - 1}` : ""}`,
      body: ({ f, d }) => <GqTiles f={f} d={d} /> }),
    wide({ id: "gqFlow", page: "gqs", title: "The pipeline, from the request to the result", hint: ({ f }) => `${periodOf(f)}'s requests: how each was approved, where it stands today, what came of the offer - hover a band for its count`, body: ({ f, d }) => <GqFlow f={f} d={d} /> }),
    gTrend("gqOffers", "Offers sent to Sales", "By the day first sent, whenever the request came in", "of", (ts) => ts.length, n0),
    { id: "gqWhere", page: "gqs", title: "Where each month's requests stand", hint: () => "Each month's requests by where they are today: offer sent to Sales, refused, still in the pipeline",
      body: ({ f, d }) => <GqStack f={f} d={d} which="c" parts={[{ key: "offer", label: "Offer sent to Sales", of: (ts) => sumOf(ts).offer }, { key: "refused", label: "Refused", of: (ts) => sumOf(ts).refused }, { key: "open", label: "Still open", color: DEEMPHASIS, of: (ts) => sumOf(ts).open }]} /> },
    { id: "gqOpenStage", page: "gqs", title: "Open now, by stage", hint: () => "Every GQS task open today, whatever the period - and how long it has been in its stage", body: ({ f, d }) => <GqOpen f={f} d={d} /> },

    /* Approval */
    { id: "gqAp", page: "gqs", title: "Approved by the rule, or by a line manager", hint: () => "Each month's requests: approved automatically, sent to a line manager - the approval is kept in STATUS OF GQS from March 2026",
      body: ({ f, d }) => <GqStack f={f} d={d} which="c" parts={[{ key: "auto", label: "Approved automatically", color: SERIES[2], of: (ts) => sumOf(ts).auto }, { key: "review", label: "Sent to a line manager", color: SERIES[0], of: (ts) => sumOf(ts).review }, { key: "noAp", label: "No approval kept", color: DEEMPHASIS, of: (ts) => sumOf(ts).noAp }]} /> },
    gTrend("gqApShare", "Sent to a line manager", "Of the month's requests with an approval kept, those the rule sent to a line manager - a month with fewer than 10 left out", "c", (ts) => { const s = sumOf(ts); return s.auto + s.review >= 10 ? s.review / (s.auto + s.review) : null; }, share),
    gTrend("gqApHours", "Time to the line manager's decision", "From the request reaching the line manager to Approved or Refused by Line Manager - the median; a month with fewer than 3 decisions left out", "c", (ts) => { const xs = sumOf(ts).decH; return xs.length >= 3 ? median(xs) : null; }, hShort),
    { id: "gqApWhy", page: "gqs", title: "Why a line manager", hint: ({ f }) => `${periodOf(f)} · the requests sent to a line manager, by the approval rule as it stands now (Back Office distribution > GQS > Approvals) · "none of these today": a value changed since, or sent again`, body: ({ f, d }) => <GqWhy f={f} d={d} /> },
    wide({ id: "gqApLm", page: "gqs", title: "Per line manager", hint: ({ f }) => `${periodOf(f)} · the requests of each line manager's team: how many went to them, what they decided and how fast · a header sorts`,
      body: ({ f, d }) => <GqTable f={f} d={d} by={(t) => gName(f, t.lm)} first="Line manager" more={[
        { key: "dec", head: "Approved / refused", tip: "The line manager's decisions - and those not decided in HubSpot", cell: (r) => `${int(r.s.lmYes)} / ${int(r.s.lmNo)}${r.s.lmWait ? ` · ${int(r.s.lmWait)} open` : ""}`, sort: (r) => r.s.lmYes + r.s.lmNo },
        { key: "decH", head: "Time to decide", tip: "From the request reaching them to their decision - the median", cell: (r) => hShort(median(r.s.decH)), sort: (r) => median(r.s.decH) ?? -1 },
      ]} /> }),

    /* Offers & results */
    { id: "gqResult", page: "gqs", title: "What came of the offers, month by month", hint: () => "The offers sent each month by what STATUS OF GQS says now: won, lost, no result yet - the latest months' offers have had less time",
      body: ({ f, d }) => <GqStack f={f} d={d} which="of" parts={[{ key: "won", label: "Won", color: SERIES[2], of: (ts) => offersOf(ts).won }, { key: "lost", label: "Lost", color: SERIES[1], of: (ts) => offersOf(ts).lost }, { key: "wait", label: "No result yet", color: DEEMPHASIS, of: (ts) => { const o = offersOf(ts); return o.n - o.won - o.lost; } }]} /> },
    gTrend("gqWin", "Win rate, month by month", "Won of the offers sent that month whose result is known - a month with fewer than 8 results left out", "of", (ts) => { const o = offersOf(ts); return o.won + o.lost >= 8 ? winRate(o.won, o.lost) : null; }, share),
    { id: "gqValue", page: "gqs", title: "The offers' potential, month by month", hint: () => "Sales' order potential of the offers sent each month, EUR: won, lost, no result yet",
      body: ({ f, d }) => <GqStack f={f} d={d} which="of" fmt={eurN} parts={[{ key: "won", label: "Won", color: SERIES[2], of: (ts) => offersOf(ts).potWon }, { key: "lost", label: "Lost", color: SERIES[1], of: (ts) => offersOf(ts).potLost }, { key: "wait", label: "No result yet", color: DEEMPHASIS, of: (ts) => { const o = offersOf(ts); return o.pot - o.potWon - o.potLost; } }]} /> },
    { id: "gqRefused", page: "gqs", title: "Refused, month by month", hint: () => "The requests refused each month, by who refused them - STATUS OF GQS",
      body: ({ f, d }) => <GqStack f={f} d={d} which="rf" parts={[{ key: "gqs", label: "By GQS", color: SERIES[1], of: (ts) => refusalsOf(ts).gqs }, { key: "bo", label: "By the Back Office", color: SERIES[3], of: (ts) => refusalsOf(ts).bo }, { key: "lm", label: "By a line manager", color: SERIES[0], of: (ts) => refusalsOf(ts).lm }, { key: "none", label: "Not said", color: DEEMPHASIS, of: (ts) => refusalsOf(ts).none }]} /> },
    wide({ id: "gqReasons", page: "gqs", title: "The refused requests and why", hint: ({ f }) => `${periodOf(f)} · every request refused, who refused it and the reason typed in · search a customer or a requester`, body: ({ f, d }) => <GqReasons f={f} d={d} /> }),

    /* Speed */
    { id: "gqStages", page: "gqs", title: "Days in each stage", hint: ({ f }) => `${periodOf(f)}'s requests · every visit to a stage added up, the median of those that went there`, body: ({ f, d }) => <GqStages f={f} d={d} /> },
    gTrend("gqToOffer", "Days to the offer", "From the request to the offer sent, of the offers sent that month - the median", "of", (ts) => median(offersOf(ts).days), days),
    gTrend("gqBoDays", "Days with the Back Office", "In Open the GQS Task, of the offers sent that month - every visit added up, the median", "of", (ts) => median(ts.filter((t) => t.of && t.d?.open).map((t) => t.d!.open!)), days),
    gTrend("gqAtGqs", "Days at GQS", "In Waiting on GQS, of the offers sent that month that went there - the median", "of", (ts) => median(offersOf(ts).atGqs), days),
    gTrend("gqRemind", "Reminded", "Of the month's requests, those that went to Remind Back-Office", "c", (ts) => (ts.length ? sumOf(ts).reminded / ts.length : null), share),
    wide({ id: "gqStageTable", page: "gqs", title: "Each stage in figures", hint: ({ f }) => `${periodOf(f)}'s requests · the tasks in each stage, the days there, who it waits on, how many are in it today`, body: ({ f, d }) => <GqStages f={f} d={d} table /> }),

    /* Type of request */
    { id: "gqTypeMix", page: "gqs", title: "Types of request, month by month", hint: ({ f, d }) => `The period's three largest types, the others together${typeTop(f, d).includes("Not asked yet (before 2026)") ? " · the type is asked from January 2026" : ""}`,
      body: ({ f, d }) => { const top = typeTop(f, d); const COL = [SERIES[0], SERIES[2], SERIES[3]]; return <GqStack f={f} d={d} which="c" parts={[...top.map((k, i) => ({ key: `t${i}`, label: k, color: COL[i], of: (ts: GqsTask[]) => ts.filter((t) => gType(t) === k).length })), { key: "other", label: "The other types", color: DEEMPHASIS, of: (ts: GqsTask[]) => ts.filter((t) => !top.includes(gType(t))).length }]} />; } },
    { id: "gqTypeWin", page: "gqs", title: "Win rate per type", hint: ({ f }) => `${periodOf(f)}'s requests · won of the offers whose result is known`,
      body: ({ f, d }) => <GqBars f={f} d={d} by={gType} of={(xs) => { const s = sumOf(xs); return winRate(s.won, s.lost); }} fmt={share} sub={(xs) => { const s = sumOf(xs); return `${int(s.won)} won of ${int(s.won + s.lost)}`; }} /> },
    wide({ id: "gqTypeTable", page: "gqs", title: "Per type of request", hint: ({ f }) => `${periodOf(f)}'s requests per type · a header sorts`, body: ({ f, d }) => <GqTable f={f} d={d} by={gType} first="Type of request" /> }),

    /* People */
    { id: "gqReqBars", page: "gqs", title: "Requests per requester", hint: ({ f }) => `${periodOf(f)} · who in Sales asked - the largest twelve`, body: ({ f, d }) => <GqBars f={f} d={d} by={(t) => gName(f, t.rq)} sub={(xs) => { const s = sumOf(xs); return `${int(s.won)} won`; }} /> },
    { id: "gqOwnBars", page: "gqs", title: "Requests per Back Office person", hint: ({ f }) => `${periodOf(f)} · the task's owner today`, body: ({ f, d }) => <GqBars f={f} d={d} by={(t) => gName(f, t.o)} sub={(xs) => `${dayCh(median(xs.filter((t) => t.d?.open).map((t) => t.d!.open!)))} days in Open the GQS Task`} /> },
    { id: "gqLmWin", page: "gqs", title: "Win rate per line manager", hint: ({ f }) => `${periodOf(f)}'s requests of each line manager's team · won of the offers whose result is known`,
      body: ({ f, d }) => <GqBars f={f} d={d} by={(t) => gName(f, t.lm)} of={(xs) => { const s = sumOf(xs); return winRate(s.won, s.lost); }} fmt={share} sub={(xs) => { const s = sumOf(xs); return `${int(s.won)} won of ${int(s.won + s.lost)} with a result · ${int(s.n)} requests`; }} /> },
    { id: "gqLmPot", page: "gqs", title: "Potential won per line manager", hint: ({ f }) => `${periodOf(f)}'s requests of each line manager's team · Sales' order potential of the won offers, EUR`,
      body: ({ f, d }) => <GqBars f={f} d={d} by={(t) => gName(f, t.lm)} of={(xs) => sumOf(xs).potWon} fmt={eurN} sub={(xs) => { const s = sumOf(xs); return `${int(s.won)} won · ${s.potN ? `${eur(s.pot)} asked` : "no potential typed in"}`; }} /> },
    wide({ id: "gqReq", page: "gqs", title: "Per requester", hint: ({ f }) => `${periodOf(f)} · each Sales person's requests and what came of them · search a name, a header sorts`, body: ({ f, d }) => <GqTable f={f} d={d} by={(t) => gName(f, t.rq)} first="Requester" find="a person" /> }),
    wide({ id: "gqOwn", page: "gqs", title: "Per Back Office person", hint: ({ f }) => `${periodOf(f)} · by the task's owner today · a header sorts`,
      body: ({ f, d }) => <GqTable f={f} d={d} by={(t) => gName(f, t.o)} first="Back Office" find="a person" hide={["lm", "potWon"]} more={[
        { key: "bo", head: "Days in Open the GQS Task", tip: "Every visit added up - the median", cell: (r) => days(median(r.ts.filter((t) => t.d?.open).map((t) => t.d!.open!))), sort: (r) => median(r.ts.filter((t) => t.d?.open).map((t) => t.d!.open!)) ?? -1 },
        { key: "rem", head: "Reminded", cell: (r) => partCell(r.s.reminded, r.s.n), sort: (r) => r.s.reminded },
      ]} /> }),
    wide({ id: "gqCust", page: "gqs", title: "Per customer", hint: ({ f }) => `${periodOf(f)} · the customers asked for · search a name, a header sorts`, body: ({ f, d }) => <GqTable f={f} d={d} by={(t) => t.cu ?? "No customer"} first="Customer" find="a customer" hide={["share", "lm"]} /> }),

    /* Open tasks */
    { id: "gqOpenOwn", page: "gqs", title: "Open now, per Back Office person", hint: () => "Every GQS task open today, whatever the period, by its owner · \"d in stage\": the median days in the stage each waits in", body: ({ f, d }) => <GqOpenBy d={d} by={(t) => gName(f, t.o)} /> },
    { id: "gqOpenReq", page: "gqs", title: "Open now, per requester", hint: () => "Every GQS task open today, whatever the period, by the Sales person who asked", body: ({ f, d }) => <GqOpenBy d={d} by={(t) => gName(f, t.rq)} /> },
    { id: "gqOpenLm", page: "gqs", title: "Open now, per line manager", hint: () => "Every GQS task open today, whatever the period, by the requester's line manager", body: ({ f, d }) => <GqOpenBy d={d} by={(t) => gName(f, t.lm)} /> },
    wide({ id: "gqOpenList", page: "gqs", title: "Every open GQS task", hint: () => "Whatever the period, the oldest first · \"already won\" or \"already lost\": the sale was decided while the task is still open · search a customer or a requester", body: ({ f, d }) => <GqOpen f={f} d={d} list /> }),
  ];
}

/** "All the figures" of GQS: a figure a row, a month a column, then the period, last year's and the change */
type GqRowDef = { key: string; label: string; section: string; which: GWhich | "gm"; of: (ts: GqsTask[], g: GqsMonth | null) => number | null; fmt: (v: number | null) => string; strong?: boolean; lower?: boolean; plain?: boolean };
const gmAvg = (s: number, n: number) => (n ? s / n : null);
const S_REQ = "Requests", S_AP = "The approval - kept from March 2026", S_NOW = "Where the month's requests stand today", S_OF = "Offers sent to Sales - by the day first sent";
const S_SPEED = "Speed", S_VAL = "Value - Sales' order potential, EUR", S_RF = "Refused - by the day refused";
const GQ_ROWS: GqRowDef[] = [
  { key: "n", label: "GQS requests", section: S_REQ, which: "c", of: (ts) => ts.length, fmt: n0, strong: true, plain: true },
  { key: "cust", label: "Customers", section: S_REQ, which: "c", of: (ts) => sumOf(ts).customers, fmt: n0, plain: true },
  { key: "auto", label: "Approved automatically", section: S_AP, which: "c", of: (ts) => sumOf(ts).auto, fmt: n0, plain: true },
  { key: "review", label: "Sent to a line manager", section: S_AP, which: "c", of: (ts) => sumOf(ts).review, fmt: n0, plain: true },
  { key: "lmYes", label: "… approved by the line manager", section: S_AP, which: "c", of: (ts) => sumOf(ts).lmYes, fmt: n0, plain: true },
  { key: "lmNo", label: "… refused by the line manager", section: S_AP, which: "c", of: (ts) => sumOf(ts).lmNo, fmt: n0, plain: true },
  { key: "decH", label: "Hours to the line manager's decision (median)", section: S_AP, which: "c", of: (ts) => median(sumOf(ts).decH), fmt: d1, lower: true },
  { key: "offerNow", label: "In Offer Sent to Sales", section: S_NOW, which: "c", of: (ts) => sumOf(ts).offer, fmt: n0, plain: true },
  { key: "refusedNow", label: "Refused", section: S_NOW, which: "c", of: (ts) => sumOf(ts).refused, fmt: n0, plain: true },
  { key: "openNow", label: "Still open", section: S_NOW, which: "c", of: (ts) => sumOf(ts).open, fmt: n0, plain: true },
  { key: "offers", label: "Offers sent to Sales", section: S_OF, which: "of", of: (ts) => offersOf(ts).n, fmt: n0, strong: true },
  { key: "won", label: "Won", section: S_OF, which: "of", of: (ts) => offersOf(ts).won, fmt: n0 },
  { key: "lost", label: "Lost", section: S_OF, which: "of", of: (ts) => offersOf(ts).lost, fmt: n0, lower: true },
  { key: "win", label: "Win rate", section: S_OF, which: "of", of: (ts) => { const o = offersOf(ts); return winRate(o.won, o.lost); }, fmt: share },
  { key: "again", label: "Sent more than once", section: S_OF, which: "of", of: (ts) => offersOf(ts).again, fmt: n0, lower: true },
  { key: "toOffer", label: "Days to the offer (median)", section: S_SPEED, which: "of", of: (ts) => median(offersOf(ts).days), fmt: d1, lower: true },
  { key: "boDays", label: "Days in Open the GQS Task (median)", section: S_SPEED, which: "of", of: (ts) => median(ts.filter((t) => t.of && t.d?.open).map((t) => t.d!.open!)), fmt: d1, lower: true },
  { key: "atGqs", label: "Days at GQS (median)", section: S_SPEED, which: "of", of: (ts) => median(offersOf(ts).atGqs), fmt: d1, lower: true },
  { key: "sent", label: "Avg. time before sent to GQS (days)", section: S_SPEED, which: "gm", of: (_, g) => (g ? gmAvg(g.sentDays, g.sentN) : null), fmt: d1, lower: true },
  { key: "done", label: "Avg. resolution time GQS (days)", section: S_SPEED, which: "gm", of: (_, g) => (g ? gmAvg(g.doneDays, g.doneN) : null), fmt: d1, lower: true },
  { key: "remind", label: "Reminded - went to Remind Back-Office", section: S_SPEED, which: "c", of: (ts) => sumOf(ts).reminded, fmt: n0, lower: true },
  { key: "pot", label: "Potential asked", section: S_VAL, which: "c", of: (ts) => { const s = sumOf(ts); return s.potN ? s.pot : null; }, fmt: money, plain: true },
  { key: "potOf", label: "Potential of the offers sent", section: S_VAL, which: "of", of: (ts) => offersOf(ts).pot, fmt: money, plain: true },
  { key: "potWon", label: "Potential won", section: S_VAL, which: "of", of: (ts) => offersOf(ts).potWon, fmt: money },
  { key: "rf", label: "Refused", section: S_RF, which: "rf", of: (ts) => refusalsOf(ts).n, fmt: n0, lower: true },
  { key: "rfGqs", label: "… by GQS", section: S_RF, which: "rf", of: (ts) => refusalsOf(ts).gqs, fmt: n0, plain: true },
  { key: "rfBo", label: "… by the Back Office", section: S_RF, which: "rf", of: (ts) => refusalsOf(ts).bo, fmt: n0, plain: true },
  { key: "rfLm", label: "… by a line manager", section: S_RF, which: "rf", of: (ts) => refusalsOf(ts).lm, fmt: n0, plain: true },
];
function GqsTable({ f, d }: { f: Frame; d: Data }) {
  if (!gAll(d)) return NO_GQS;
  const yms = gYms(f), py = gPrevYms(f);
  const gm = new Map(d.gqs.map((m) => [m.ym, m]));
  const gOf = (ys: string[]) => (d.gqs.length ? sumGqs(ys.map((ym) => gm.get(ym) ?? EMPTY_GQS(ym))) : null);
  const val = (r: GqRowDef, ys: string[]) => (r.which === "gm" ? r.of([], gOf(ys)) : r.of(gBy(d, ys, r.which) ?? [], null));
  const sum = f.doneWords ? `${f.doneWords} ${f.year}` : String(f.year);
  const head = ["KPI", ...f.labels.map((l) => l.replace(" (to date)", "*")), sum, ...(py ? [`${f.doneWords} ${f.year - 1}`, "Change"] : [])];
  return (
    <ChartBox title="GQS, month by month" hint={`${f.labels.some((l) => l.includes("to date")) ? "* to date - " : ""}a figure a row · requests by the month they came in, offers by the month first sent, refusals by the month refused · a month in green when better than the period's average, in red when worse`}>
      <WTable head={head} totals={py ? 3 : 1} rows={GQ_ROWS.map((r) => {
        const vals = f.yms.map((ym) => (ym < GQS_FIRST || ym > d.current ? null : val(r, [ym])));
        const done = vals.slice(f.from, f.done).filter((x): x is number => x != null);
        const mean = done.length ? done.reduce((x, y) => x + y, 0) / done.length : null;
        const a = val(r, yms), b = py ? val(r, py) : null;
        const ch = a != null && b != null ? changeOf(a, b) : null;
        return {
          key: r.key, strong: r.strong, section: r.section,
          cells: [r.label, ...vals.map((v, i) => <Box key={i} component="span" sx={{ color: r.plain || f.labels[i].includes("to date") ? undefined : against(v, mean, r.lower) }}>{r.fmt(v)}</Box>), r.fmt(a),
            ...(py ? [r.fmt(b), <Box key="ch" component="span" sx={{ color: tone(ch, r.lower) }}>{signedPct(ch)}</Box>] : [])],
        };
      })} />
    </ChartBox>
  );
}

/** The days to close (or to the first reply) of each person, overall and in the period's largest topics - a cell green when
 *  faster than the topic's average by more than a tenth, red when slower; "(n)" the tickets it rests on. */
function SpeedPeople({ f, col }: { f: Frame; col: number }) {
  const top = topicRows(f).rows.filter((r) => r.key).sort((a, b) => b.cur - a.cur).slice(0, 5).map((r) => r.label);
  type S = { s: number; n: number };
  type P = { label: string; n: number; all: S; t: Record<string, S> };
  const by = new Map<string, P>(), avgT: Record<string, S> = {}, avgAll: S = { s: 0, n: 0 };
  eachRow(f, "created", (t, r) => {
    const who = inTeam(f, t.owner) ? ownerName(f, t.owner) : outside;
    const x = by.get(who) ?? { label: who, n: 0, all: { s: 0, n: 0 }, t: {} };
    x.n++;
    if (r[col] >= 0) {
      const v = r[col] / 10, tl = topicLabel(t.topic);
      x.all.s += v; x.all.n++; avgAll.s += v; avgAll.n++;
      if (top.includes(tl)) { (x.t[tl] ??= { s: 0, n: 0 }); x.t[tl].s += v; x.t[tl].n++; (avgT[tl] ??= { s: 0, n: 0 }); avgT[tl].s += v; avgT[tl].n++; }
    }
    by.set(who, x);
  });
  if (!by.size) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No tickets for this choice.</Typography>;
  const cell = (x: S | undefined, avg: S | undefined) => {
    if (!x?.n) return <Box component="span" sx={{ color: FAINT }}>—</Box>;
    const v = x.s / x.n, m = avg?.n ? avg.s / avg.n : null;
    const color = x.n < 3 || m == null || Math.abs(v / m - 1) < 0.1 ? INK : v < m ? GOOD : BAD;
    return <span><Box component="span" sx={{ color, fontWeight: 700 }}>{v.toFixed(1)}</Box> <Box component="span" sx={{ color: FAINT, fontSize: "0.74rem" }}>({int(x.n)})</Box></span>;
  };
  const cols: Col<P>[] = [
    { key: "n", head: "Tickets", cell: (r) => int(r.n), sort: (r) => r.n },
    { key: "all", head: "Every topic", tip: "Days, on average - the number of tickets in brackets", cell: (r) => cell(r.all, avgAll), sort: (r) => (r.all.n ? r.all.s / r.all.n : -1) },
    ...top.map((tl): Col<P> => ({ key: `t:${tl}`, head: tl, tip: `Days, on average, on ${tl} tickets`, cell: (r) => cell(r.t[tl], avgT[tl]), sort: (r) => (r.t[tl]?.n ? r.t[tl].s / r.t[tl].n : -1) })),
  ];
  const rows = [...by.values()].sort((a, b) => Number(a.label === outside) - Number(b.label === outside));
  return <FullTable first="Person" cols={cols} rows={rows} initial="n" find="a person" total={{ label: "Everyone", n: [...by.values()].reduce((s, x) => s + x.n, 0), all: avgAll, t: avgT }} />;
}

/** every ticket of the period's complete months (the month to date while none is) that passes the filters */
function eachRow(f: Frame, which: "created" | "closed", cb: (t: Tk, r: number[], i: number) => void) {
  const C = which === "created" ? RW : RCL;
  f.cur.forEach((m, i) => {
    if (i < f.from || i >= Math.max(f.done, f.from + 1) || !m.rows || m.pending) return;
    const d = m.rows.dict;
    for (const r of m.rows[which]) { const t = tk(d, r, C); if (passes(f.fil, f.co, t)) cb(t, r, i); }
  });
}
/** each drawn month's tickets that pass, counted by a key - null for a month not counted one by one */
function byMonth(f: Frame, which: "created" | "closed", key: (t: Tk) => string): (Record<string, number> | null)[] {
  const C = which === "created" ? RW : RCL;
  return f.cur.slice(0, drawn(f)).map((m) => {
    if (!m.rows || m.pending || !hasTickets(m.ym)) return null;
    const d = m.rows.dict, out: Record<string, number> = {};
    for (const r of m.rows[which]) { const t = tk(d, r, C); if (passes(f.fil, f.co, t)) { const k = key(t); out[k] = (out[k] ?? 0) + 1; } }
    return out;
  });
}
/** The tickets behind a graph, in the reports' shared list (SARCLA 03.11.2026: "companies or tickets and filter per KPI ...
 *  the list of tickets per people") - the period's tickets that pass the filters and the graph's own test; the owner first,
 *  so typing a name lists that person's tickets. */
type ListOf = { closed?: boolean; keep?: (t: Tk, r: number[]) => boolean; note: string };
function ticketsOf(f: Frame, key: string, l: ListOf): CompanySource {
  const coName = (id: string) => { const x = f.co[id]; return x && x.length > 3 ? (x as string[])[3] : id ? `Company ${id}` : "—"; };
  const at = (ym: string, day: number) => `${String(day).padStart(2, "0")}.${ym.slice(5, 7)}.${ym.slice(0, 4)}`;
  return {
    key: `bo|${key}|${f.yms[0]}|${f.yms[f.yms.length - 1]}|${JSON.stringify(f.fil)}`, object: "tickets",
    note: `${periodOf(f)} · ${l.note} · the owner first - type a name to see that person's tickets`,
    head: l.closed ? ["Closed", "Came in from", "Company"] : ["Came in", "Came in from", "Company", "Days to close", "First reply"],
    left: [2, 3], widths: l.closed ? ["110px", "150px", "minmax(200px, 1.4fr)"] : ["110px", "150px", "minmax(200px, 1.4fr)", "110px", "100px"],
    rows: () => {
      const out: { id: string | null; name: string; cells: React.ReactNode[]; values: (string | number | null)[] }[] = [];
      eachRow(f, l.closed ? "closed" : "created", (t, r, i) => {
        if (l.keep && !l.keep(t, r)) return;
        const m = f.cur[i], ids = l.closed ? m.rows?.cids : m.rows?.ids;
        const n = ids?.[l.closed ? m.rows!.closed.indexOf(r) : m.rows!.created.indexOf(r)] || null;
        const close = l.closed ? null : r[RW.close] >= 0 ? r[RW.close] / 10 : null, reply = l.closed ? null : r[RW.reply] >= 0 ? r[RW.reply] / 10 : null;
        const day = Number(m.ym.replace("-", "")) * 100 + r[0];
        out.push({
          // the ticket as its owner and its topic - typing a person's name lists their tickets
          id: n, name: `${ownerName(f, t.owner)} · ${topicLabel(t.topic)}`,
          cells: l.closed ? [at(m.ym, r[0]), t.origin, coName(t.company)] : [at(m.ym, r[0]), t.origin, coName(t.company), days(close), days(reply)],
          values: l.closed ? [ownerName(f, t.owner), day, t.origin, coName(t.company)] : [ownerName(f, t.owner), day, t.origin, coName(t.company), close, reply],
        });
      });
      return out.sort((a, b) => Number(b.values[1]) - Number(a.values[1]));
    },
  };
}

/** the same number of months as the period's, right before it - what a person board compares with */
function prevYms(f: Frame): string[] {
  const span = f.yms.slice(f.from, Math.max(f.done, f.from + 1));
  if (!span.length) return [];
  let y = Number(span[0].slice(0, 4)), m = Number(span[0].slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < span.length; i++) { m--; if (m === 0) { m = 12; y--; } out.unshift(`${y}-${String(m).padStart(2, "0")}`); }
  return out;
}
const prevWords = (f: Frame) => { const p = prevYms(f); return p.length ? (p.length === 1 ? `${MONTHS[Number(p[0].slice(5, 7)) - 1]} ${p[0].slice(0, 4)}` : `${MONTHS[Number(p[0].slice(5, 7)) - 1]} ${p[0].slice(0, 4)} – ${MONTHS[Number(p[p.length - 1].slice(5, 7)) - 1]} ${p[p.length - 1].slice(0, 4)}`) : ""; };
/** every created ticket of some months (from every month kept) that passes the filters */
function eachRowOf(f: Frame, d: Data, yms: string[], cb: (t: Tk, r: number[], m: BoMonth) => void) {
  const want = new Set(yms);
  for (const m of d.months) {
    if (!want.has(m.ym) || !m.rows || !hasTickets(m.ym)) continue;
    const dd = m.rows.dict;
    for (const r of m.rows.created) { const t = tk(dd, r, RW); if (passes(f.fil, f.co, t)) cb(t, r, m); }
  }
}
/** A person board from a measure kept per owner: (value, how many) now and in the months before. */
function personBoard(f: Frame, d: Data, add: (t: Tk, r: number[], m: BoMonth, into: (owner: string, hit: boolean) => void) => void, opts: { ratio: boolean; lower?: boolean; min?: number; what: string; summary: string }): BoardSpec {
  const cur = new Map<string, { k: number; n: number }>(), prev = new Map<string, { k: number; n: number }>();
  const into = (map: Map<string, { k: number; n: number }>) => (o: string, hit: boolean) => { const x = map.get(o) ?? { k: 0, n: 0 }; x.n++; if (hit) x.k++; map.set(o, x); };
  eachRowOf(f, d, f.yms.slice(f.from, Math.max(f.done, f.from + 1)), (t, r, m) => add(t, r, m, into(cur)));
  eachRowOf(f, d, prevYms(f), (t, r, m) => add(t, r, m, into(prev)));
  const val = (x: { k: number; n: number } | undefined) => (!x ? 0 : opts.ratio ? (x.n ? x.k / x.n : 0) : x.k);
  const rows = [...cur].filter(([, x]) => x.n >= (opts.min ?? 1)).map(([o, x]) => ({ o, row: { label: ownerName(f, o), cur: val(x), prev: val(prev.get(o)), sub: opts.ratio ? `${int(x.k)} of ${int(x.n)} ${opts.what}` : `${int(x.n)} ${opts.what}` } }));
  return {
    rows: rows.filter((x) => inTeam(f, x.o)).map((x) => x.row), others: rows.filter((x) => !inTeam(f, x.o)).map((x) => x.row),
    fmt: opts.ratio ? (v) => `${(v * 100).toFixed(1)}%` : (v) => int(v), ratio: opts.ratio, lower: opts.lower, diff: opts.ratio ? undefined : (n) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${int(Math.abs(n))}`,
    summary: opts.summary, prevLabel: prevWords(f), noChange: !prev.size,
  };
}

/* the chat's tickets and what was done on them (boReport.ts readChat) */
const CHAT_KINDS = ["No contact", "A call", "An e-mail sent", "A meeting"];
/** the chat v3 creates the ticket the team calls back on - the calls before it do not count (SARCLA 04.11.2026: "you cannot
 *  measure before the implementation of the chat v3 ... before is not relevant"); the Help Desk channel went live on 25.10.2026 */
const CHAT_FROM = "2026-10-25";
const chatDay = (ym: string, c: ChatRow) => `${ym}-${String(c[8] ?? 28).padStart(2, "0")}`;
/** the period's chat tickets that pass the filters - the ticket's row from the month's read where it is known */
function chatRows(f: Frame, d: Data, yms?: string[]): { c: ChatRow; t: Tk; ym: string }[] {
  const byId = new Map<string, Tk>();
  for (const m of d.months) { const r = m.rows; if (!r?.ids) continue; r.created.forEach((row, i) => { const id = r.ids![i]; if (id) byId.set(id, tk(r.dict, row, RW)); }); }
  const out: { c: ChatRow; t: Tk; ym: string }[] = [];
  for (const ym of yms ?? f.yms.slice(f.from, Math.max(f.done, f.from + 1))) {
    for (const c of d.chat?.[ym] ?? []) {
      if (chatDay(ym, c) < CHAT_FROM) continue;
      const t = byId.get(c[0]) ?? { topic: "", owner: c[1], origin: "Chat", company: "" };
      if (passes(f.fil, f.co, t)) out.push({ c, t, ym });
    }
  }
  return out;
}
const median = (xs: number[]) => { if (!xs.length) return null; const s2 = [...xs].sort((a, b) => a - b); const h = Math.floor(s2.length / 2); return s2.length % 2 ? s2[h] : (s2[h - 1] + s2[h]) / 2; };
const whours = (h: number | null) => (h == null ? "—" : h < 9 ? `${h.toFixed(1)} working hours` : `${(h / 9).toFixed(1)} working days`);
/** a chat person board: each owner's chat tickets, a measure of them now and in the months before */
function chatBoard(f: Frame, d: Data, of: (rows: ChatRow[]) => number | null, opts: { ratio?: boolean; lower?: boolean; fmt: (v: number) => string; sub: (rows: ChatRow[]) => string; summary: string }): BoardSpec {
  const group = (xs: { c: ChatRow; t: Tk }[]) => { const m = new Map<string, ChatRow[]>(); for (const x of xs) { const o = x.t.owner || x.c[1]; m.set(o, [...(m.get(o) ?? []), x.c]); } return m; };
  const cur = group(chatRows(f, d)), prev = group(chatRows(f, d, prevYms(f)));
  const rows = [...cur].map(([o, rs]) => ({ o, v: of(rs), row: null as BoardRow | null })).filter((x) => x.v != null).map((x) => ({ o: x.o, row: { label: ownerName(f, x.o), cur: x.v!, prev: of(prev.get(x.o) ?? []) ?? 0, sub: opts.sub(cur.get(x.o)!) } }));
  return { rows: rows.filter((x) => inTeam(f, x.o)).map((x) => x.row), others: rows.filter((x) => !inTeam(f, x.o)).map((x) => x.row), fmt: opts.fmt, ratio: opts.ratio, lower: opts.lower,
    diff: opts.ratio ? undefined : (n) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}`, summary: opts.summary, prevLabel: prevWords(f), noChange: !prev.size };
}
const quietChat = (c: ChatRow) => c[7] === 1 && c[4] + c[5] + c[6] === 0 && c[2] === 0;

type Person = { id: string; name: string; created: number; closed: number; origin: Record<string, number>; days: number; dn: number; came: number[]; shut: number[] };
/** each owner's tickets: what came in to them and from where, what they closed, how fast, month by month */
function peopleOf(f: Frame): Person[] {
  const by = new Map<string, Person>();
  const get = (id: string) => {
    let p = by.get(id);
    if (!p) { p = { id, name: ownerName(f, id), created: 0, closed: 0, origin: {}, days: 0, dn: 0, came: f.cur.map(() => 0), shut: f.cur.map(() => 0) }; by.set(id, p); }
    return p;
  };
  eachRow(f, "created", (t, r, i) => { const p = get(t.owner); p.created++; p.came[i]++; p.origin[t.origin] = (p.origin[t.origin] ?? 0) + 1; if (r[RW.close] >= 0) { p.days += r[RW.close] / 10; p.dn++; } });
  eachRow(f, "closed", (t, _r, i) => { const p = get(t.owner); p.closed++; p.shut[i]++; });
  return [...by.values()].sort((a, b) => b.created + b.closed - (a.created + a.closed) || a.name.localeCompare(b.name));
}
const inTeam = (f: Frame, id: string) => !f.team.size || f.team.has(id);
/** Bars for the Back Office team, the owners outside it folded under a button (SARCLA 03.11.2026: "a hidden row for wrong
 *  owners") - on one scale. */
function TeamBars({ f, rows, format, empty }: { f: Frame; rows: { id: string; label: string; value: number | null; secondary?: string }[]; format: (v: number | null) => string; empty: string }) {
  const [show, setShow] = useState(false);
  const mine = rows.filter((r) => inTeam(f, r.id)), others = rows.filter((r) => !inTeam(f, r.id));
  const max = Math.max(0, ...rows.map((r) => r.value ?? 0));
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <BarList rows={mine} format={format} labelWidth={170} max={max} emptyMessage={empty} />
      {others.length > 0 && (
        <Box sx={{ display: "grid", gap: 0.75, borderTop: `1px dashed ${HAIRLINE}`, pt: 1 }}>
          <Button size="small" onClick={() => setShow((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start", color: MUTED }}>
            {show ? "Hide" : "Show"} the {others.length} owner{others.length === 1 ? "" : "s"} outside the Back Office - tickets that may sit with the wrong person
          </Button>
          {show && <BarList rows={others} format={format} labelWidth={170} max={max} />}
        </Box>
      )}
    </Box>
  );
}
/** Each person a row, each month a column: what came in (blue) and what was closed (grey) side by side on one scale, the
 *  period's totals at the end - the team first, the other owners folded. */
function PersonMonths({ f, people }: { f: Frame; people: Person[] }) {
  const [show, setShow] = useState(false);
  const n = drawn(f);
  const mine = people.filter((p) => inTeam(f, p.id)), others = people.filter((p) => !inTeam(f, p.id));
  const max = Math.max(1, ...people.flatMap((p) => [...p.came.slice(0, n), ...p.shut.slice(0, n)]));
  const cols = `minmax(150px, 1.5fr) repeat(${n}, minmax(30px, 1fr)) 160px`;
  const row = (p: Person) => (
    <Box key={p.id} sx={{ display: "grid", gridTemplateColumns: cols, alignItems: "end", gap: 0.75, py: 0.6, borderBottom: `1px solid ${HAIRLINE}` }}>
      <Typography noWrap title={p.name} sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, alignSelf: "center" }}>{p.name}</Typography>
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} title={`${p.name}, ${f.labels[i]}: ${int(p.came[i])} came in, ${int(p.shut[i])} closed`} sx={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "2px", height: 34 }}>
          <Box sx={{ width: 8, height: `${(p.came[i] / max) * 100}%`, minHeight: p.came[i] ? 2 : 0, bgcolor: SERIES[0], borderRadius: "2px 2px 0 0" }} />
          <Box sx={{ width: 8, height: `${(p.shut[i] / max) * 100}%`, minHeight: p.shut[i] ? 2 : 0, bgcolor: DEEMPHASIS, borderRadius: "2px 2px 0 0" }} />
        </Box>
      ))}
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums", alignSelf: "center" }}>
        <b style={{ color: INK }}>{int(p.created)}</b> · {int(p.closed)} · <b style={{ color: p.closed > p.created ? "#1e7e45" : p.closed < p.created ? "#c5221f" : MUTED }}>{p.closed - p.created > 0 ? "+" : p.closed < p.created ? "−" : "±"}{int(Math.abs(p.closed - p.created))}</b>
      </Typography>
    </Box>
  );
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: 640, display: "grid" }}>
        <Box sx={{ display: "flex", gap: 2, fontSize: "0.76rem", color: MUTED, mb: 1 }}>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}><Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: SERIES[0] }} />Came in</Box>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}><Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: DEEMPHASIS }} />Closed</Box>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, pb: 0.5, borderBottom: `1px solid ${HAIRLINE}` }}>
          {["Person", ...f.labels.slice(0, n).map((l) => l.replace(" (to date)", "*")), "In · closed · balance"].map((h, i) => (
            <Typography key={i} sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: FAINT, textAlign: i === 0 ? "left" : i === n + 1 ? "right" : "center" }}>{h}</Typography>
          ))}
        </Box>
        {mine.map(row)}
        {others.length > 0 && (
          <Button size="small" onClick={() => setShow((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start", color: MUTED, mt: 0.75 }}>
            {show ? "Hide" : "Show"} the {others.length} owner{others.length === 1 ? "" : "s"} outside the Back Office
          </Button>
        )}
        {show && others.map(row)}
      </Box>
    </Box>
  );
}
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** a ticket's weekday, Monday first */
const weekdayOf = (ym: string, day: number) => (new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, day)).getUTCDay() + 6) % 7;
/** the working days (Monday to Friday) of the period's complete months - the month to date while none is */
function workingDays(f: Frame) {
  let n = 0;
  f.cur.forEach((m, i) => {
    if (i < f.from || i >= Math.max(f.done, f.from + 1)) return;
    const y = Number(m.ym.slice(0, 4)), mo = Number(m.ym.slice(5, 7)) - 1;
    const last = m.ym === f.yms[f.yms.length - 1] && i >= f.done ? new Date().getDate() : new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    for (let d = 1; d <= last; d++) if (weekdayOf(m.ym, d) < 5) n++;
  });
  return n;
}
/** the customers' tickets closed without any answer - no first agent reply - by the month they came in */
const unanswered = (r: number[], t: Tk) => t.origin === "Customer" && r[RW.close] >= 0 && r[RW.reply] < 0;
/** the survey's answers of the period's months, as happy / neutral / unhappy */
const feelingOf = (x: BoSurvey) => {
  const v = (x.sentiment ?? "").toLowerCase();
  if (/happy|pos/.test(v) && !/un/.test(v)) return "happy";
  if (/unhappy|neg/.test(v)) return "unhappy";
  if (/neutral/.test(v)) return "neutral";
  return x.value === 2 ? "happy" : x.value === 1 ? "neutral" : x.value === 0 ? "unhappy" : null;
};
const FEELINGS = [{ key: "happy", label: "Happy", color: SERIES[2] }, { key: "neutral", label: "Neutral", color: DEEMPHASIS }, { key: "unhappy", label: "Unhappy", color: "#c0571f" }];
/** each month of the frame's: its survey answers by feeling - this year's, or last year's same month */
function surveyMonths(f: Frame, d: Data, prior = false) {
  return f.yms.slice(0, drawn(f)).map((ym) => {
    const k = prior ? back(ym) : ym;
    const out: Record<string, number> = { happy: 0, neutral: 0, unhappy: 0 };
    for (const x of d.surveys ?? []) if (x.day.slice(0, 7) === k) { const fl = feelingOf(x); if (fl) out[fl]++; }
    return out;
  });
}
/** each ticket's owner by its HubSpot id, over every month kept - the survey answers point at their ticket */
const ownerCache = new WeakMap<Data, Map<string, string>>();
function ownersOfTickets(d: Data): Map<string, string> {
  let m = ownerCache.get(d);
  if (m) return m;
  m = new Map();
  for (const mo of d.months) {
    const r = mo.rows;
    if (!r?.ids) continue;
    r.created.forEach((row, i) => { const id = r.ids![i]; if (id) m!.set(id, r.dict[row[RW.owner]]); });
  }
  ownerCache.set(d, m);
  return m;
}
function SurveyTable({ f, d }: { f: Frame; d: Data }) {
  const [shown, setShown] = useState(25);
  const first = f.yms[0] ?? "", last = f.yms[f.yms.length - 1] ?? "";
  const rows = (d.surveys ?? []).filter((x) => x.day.slice(0, 7) >= first && x.day.slice(0, 7) <= last);
  const owners = ownersOfTickets(d);
  const color = (fl: string | null) => (fl === "happy" ? "#1e7e45" : fl === "unhappy" ? "#c5221f" : MUTED);
  if (!rows.length) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No answer to the survey in these months.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Table head={["Day", "Answer", "Owner", "Company", "What they wrote", "Ticket"]} minWidth={860} firstWidth="110px" left={[2, 3, 4]}
        rows={rows.slice(0, shown).map((x, i) => {
          const fl = feelingOf(x);
          return {
            key: `${x.day}-${x.ticket ?? ""}-${i}`,
            cells: [x.day.split("-").reverse().join("."), <Box key="a" component="span" sx={{ fontWeight: 700, color: color(fl) }}>{fl ? fl.charAt(0).toUpperCase() + fl.slice(1) : "—"}</Box>,
              x.ticket && owners.get(x.ticket) !== undefined ? ownerName(f, owners.get(x.ticket)!) : "—", x.company ?? "—", x.comment?.trim() || "—",
              x.ticket ? <Box key="t" component="a" href={`https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${x.ticket}`} target="_blank" rel="noreferrer" sx={{ color: TINT.blue.fg, fontWeight: 600 }}>Open</Box> : "—"],
          };
        })} />
      {rows.length > shown && <Button size="small" onClick={() => setShown((n) => n + 50)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>Show 50 more of {int(rows.length - shown)}</Button>}
    </Box>
  );
}

const shortName = (name: string) => { if (name === "No owner") return name; const w = name.trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : name; };
/** Customer, Chat, Automatic & internal */
const ORIGIN_COLORS = [SERIES[0], SERIES[3], DEEMPHASIS];
const originParts = ORIGINS.map((o, j) => ({ key: `o${j}`, label: o, color: ORIGIN_COLORS[j] }));
const originCells = (x: Record<string, number> | null) => Object.fromEntries(ORIGINS.map((o, j) => [`o${j}`, x ? x[o] ?? 0 : null]));
/** the days to close or to the first reply per topic, of the tickets created in the period - topics with 5 or more */
function topicSpeed(f: Frame, col: number) {
  const by = new Map<string, { s: number; n: number }>();
  eachRow(f, "created", (t, r) => { if (r[col] < 0) return; const k = topicLabel(t.topic); const x = by.get(k) ?? { s: 0, n: 0 }; x.s += r[col] / 10; x.n++; by.set(k, x); });
  return [...by].filter(([, x]) => x.n >= 5).map(([label, x]) => ({ label, value: x.s / x.n, secondary: `${int(x.n)} tickets` })).sort((a, b) => b.value - a.value);
}
/** a month field added up by key over the period's complete months, this year and last */
function sumField(f: Frame, field: "pcs" | "linePcs") {
  const add = (ms: (BoMonth | null)[]) => { const out: Record<string, number> = {}; for (const m of ms) if (m) for (const [k, v] of Object.entries(m[field] ?? {})) out[k] = (out[k] ?? 0) + v; return out; };
  const cur = add(f.cur.slice(f.from, f.done || f.cur.length)), prev = f.totalPrev ? add(f.prev.slice(f.from, f.done)) : {};
  return [...new Set([...Object.keys(cur), ...Object.keys(prev)])].map((k) => ({ label: k || "Not found", cur: cur[k] ?? 0, prev: prev[k] ?? 0 }));
}

/* ── OTD > Delivery speed: each delivery's working days, from the ERP's order file (lib/reporting/boDelivery.ts) ── */

const dvMonth = (d: Data, ym: string): DMonth | null => d.delivery?.months[ym] ?? null;
/** the months a delivery figure adds up: the period's complete months, else the month to date */
const dvYms = (f: Frame) => f.yms.slice(0, Math.max(f.done, 1));
const dvSum = (f: Frame, d: Data) => sumDMonths(dvYms(f).map((ym) => dvMonth(d, ym)));
/** the same months a year before - null where the file holds none of them */
const dvPrev = (f: Frame, d: Data) => { const ys = dvYms(f).map(back); return ys.some((ym) => dvMonth(d, ym)) ? sumDMonths(ys.map((ym) => dvMonth(d, ym))) : null; };
const wdays = (v: number | null) => (v == null ? "—" : v >= HIST - 1 ? `${HIST - 1}+ working days` : `${v} working day${v === 1 ? "" : "s"}`);
/** a share on an axis, whole: "100.0%" is cut off there */
const pctTick = (v: number | null) => (v == null ? "" : `${Math.round(v * 100)}%`);
const ddmm = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
function DvNone() {
  return <Typography sx={{ fontSize: "0.84rem", color: MUTED, py: 2 }}>Counted from the ERP&apos;s next order file - the chain reads it every night.</Typography>;
}
/** a delivery figure month by month - this year's line, last year's beside it */
function dvTrend(id: string, title: string, note: string, pick: (m: DMonth) => number | null, fmt: (v: number | null) => string, tick?: (v: number | null) => string): ChartDef {
  return {
    id, page: "otd", title,
    figure: ({ f, d }) => { if (!d.delivery) return null; const v = pick(dvSum(f, d)); return v == null ? null : fmt(v); },
    hint: ({ f, d }) => {
      const a = d.delivery ? pick(dvSum(f, d)) : null, p = d.delivery ? dvPrev(f, d) : null, b = p ? pick(p) : null;
      return [note, a != null ? `${periodOf(f)}: ${fmt(a)}${a != null && b ? ` (${signedPct(changeOf(a, b))} on last year)` : ""}` : ""].filter(Boolean).join(" · ");
    },
    body: ({ f, d }) => {
      if (!d.delivery) return <DvNone />;
      const n = drawn(f);
      const at = (ym: string) => { const m = dvMonth(d, ym); return m ? pick(m) : null; };
      const values = f.yms.slice(0, n).map(at), compare = f.yms.slice(0, n).map((ym) => at(back(ym)));
      return <MonthTrend values={values} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={fmt} tick={tick} />;
    },
  };
}
function dvCharts(): ChartDef[] {
  const S = 14;
  return [
    wide({
      id: "spdFigs", page: "otd", title: "Delivery speed in figures", hint: ({ f }) => `${periodOf(f)} against the same months a year before · the working days from the order to the shipment`,
      figure: ({ f, d }) => (d.delivery ? pct(within(both(dvSum(f, d)), 1)) : null),
      body: ({ f, d }) => {
        if (!d.delivery) return <DvNone />;
        const a = dvSum(f, d), p = dvPrev(f, d);
        const ha = both(a), hp = p ? both(p) : null;
        const na = histSum(ha), np = hp ? histSum(hp) : null, wa = histSum(a.p), wp = p ? histSum(p.p) : null;
        return <Tiles items={[
          { label: "Deliveries shipped", value: int(na), ch: ch2(na, np), sub: periodOf(f), icon: <LocalShippingOutlinedIcon sx={{ fontSize: S }} />, tint: "blue" },
          { label: "Same or next working day", value: pct(within(ha, 1)), ch: ch2(within(ha, 1), hp ? within(hp, 1) : null), sub: `${int(ha[0] + ha[1])} deliveries`, icon: <BoltOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
          { label: "Within 5 working days", value: pct(within(ha, 5)), ch: ch2(within(ha, 5), hp ? within(hp, 5) : null), sub: `${int(histSum(ha.slice(0, 6)))} deliveries`, icon: <TaskAltOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
          { label: "Half ship within", value: wdays(medianWd(ha)), ch: ch2(medianWd(ha), hp ? medianWd(hp) : null), lower: true, sub: "the median, from the order", icon: <TimerOutlinedIcon sx={{ fontSize: S }} />, tint: "amber" },
          { label: "With a proposed date", value: int(wa), ch: ch2(wa, wp), sub: na ? `${pct(wa / na)} of the deliveries` : "", icon: <CalendarMonthOutlinedIcon sx={{ fontSize: S }} />, tint: "purple" },
          { label: "Shipped by the proposed date", value: pct(byDate(a)), ch: ch2(byDate(a), p ? byDate(p) : null), sub: "the ERP moves it with the delivery - not OTD", icon: <HourglassEmptyOutlinedIcon sx={{ fontSize: S }} />, tint: "pink" },
        ]} />;
      },
    }),
    wide({
      id: "spdMix", page: "otd", title: "How fast each month's deliveries ship", hint: () => "The working days from the order to the shipment · a month's deliveries as 100 %, by the month shipped",
      body: ({ f, d }) => {
        if (!d.delivery) return <DvNone />;
        const data = f.yms.slice(0, drawn(f)).map((ym, i) => {
          const m = dvMonth(d, ym), h = m ? both(m) : null, t = h ? histSum(h) : 0, b = h ? bands(h) : [0, 0, 0, 0];
          return { x: f.labels[i], b0: t ? b[0] / t : null, b1: t ? b[1] / t : null, b2: t ? b[2] / t : null, b3: t ? b[3] / t : null };
        });
        return <StackedColumns height={280} format={(v) => (v == null ? "—" : pctTick(v))} data={data} parts={[
          { key: "b0", label: "Same or next working day", color: SEQUENTIAL[1] }, { key: "b1", label: "2-5 working days", color: SEQUENTIAL[3] },
          { key: "b2", label: "6-20 working days", color: SEQUENTIAL[5] }, { key: "b3", label: "More than 20", color: SEQUENTIAL[6] },
        ]} />;
      },
    }),
    dvTrend("spdFast", "Shipped within 2 working days", "Of the month's deliveries, from the order to the shipment", (m) => within(both(m), 2), share, pctTick),
    dvTrend("spdMedian", "Half the deliveries ship within", "The median working days from the order to the shipment", (m) => medianWd(both(m)), wdays, (v) => (v == null ? "" : String(v))),
    dvTrend("spdByDate", "Shipped by the proposed date", "The deliveries with a date the ERP proposed (made-to-order lines) - the ERP moves it when the delivery moves, so this is not OTD", byDate, share, pctTick),
    {
      id: "spdLate", page: "otd", title: "Shipped after the proposed date: how late", hint: ({ f }) => `${periodOf(f)} · the working days after the date the ERP proposed`,
      body: ({ f, d }) => {
        if (!d.delivery) return <DvNone />;
        const a = dvSum(f, d), late = a.late.reduce((x, y) => x + y, 0);
        return <BarList rows={LATE.map((label, i) => ({ label, value: a.late[i], secondary: late ? `${pct(a.late[i] / late)} of the late` : "" }))} format={(v) => int(v ?? 0)} labelWidth={170} emptyMessage="None shipped after its proposed date." />;
      },
    },
    {
      id: "spdCountry", page: "otd", title: "Shipped within 2 working days, per country",
      own: ({ f, d }, box) => {
        if (!d.delivery) return <ChartBox title={box.title} actions={box.actions}><DvNone /></ChartBox>;
        const a = dvSum(f, d), p = dvPrev(f, d);
        const rows = Object.entries(a.c).filter(([, v]) => v[0] >= 20).map(([label, v]) => {
          const q = p?.c[label];
          return { label, cur: v[1] / v[0], prev: q && q[0] ? q[1] / q[0] : 0 };
        });
        return <DimChart {...box} rows={rows} cur={(r) => r.cur} prev={(r) => r.prev} curLabel={periodOf(f)} prevLabel={String(f.year - 1)} fmt={(v) => pct(v)} />;
      },
    },
    {
      id: "spdMode", page: "otd", title: "Per shipping mode", hint: ({ f }) => `${periodOf(f)} · the deliveries, and the share shipped within 2 working days`,
      body: ({ f, d }) => {
        if (!d.delivery) return <DvNone />;
        const a = dvSum(f, d);
        const rows = Object.entries(a.m).sort((x, y) => y[1][0] - x[1][0]).map(([label, v]) => ({ label, value: v[0], secondary: `${pct(v[0] ? v[1] / v[0] : null)} within 2 working days` }));
        return <BarList rows={rows} format={(v) => int(v ?? 0)} labelWidth={190} emptyMessage="No deliveries in this period." />;
      },
    },
    wide({
      id: "spdTable", page: "otd", title: "Delivery speed, month by month", hint: () => "By the month shipped · the working days from the order to the shipment",
      body: ({ f, d }) => {
        if (!d.delivery) return <DvNone />;
        type R = { label: string; m: DMonth | null };
        const rows: R[] = f.yms.map((ym, i) => ({ label: f.labels[i], m: dvMonth(d, ym) }));
        const h = (r: R) => (r.m ? both(r.m) : null);
        const sh = (r: R, k: number) => { const x = h(r); return x ? within(x, k) : null; };
        const cols: Col<R>[] = [
          { key: "n", head: "Deliveries", cell: (r) => { const x = h(r); return x ? int(histSum(x)) : "—"; }, sort: (r) => { const x = h(r); return x ? histSum(x) : -1; } },
          { key: "d1", head: "Same or next day", cell: (r) => pct(sh(r, 1)), sort: (r) => sh(r, 1) ?? -1 },
          { key: "d2", head: "Within 2", cell: (r) => pct(sh(r, 2)), sort: (r) => sh(r, 2) ?? -1 },
          { key: "d5", head: "Within 5", cell: (r) => pct(sh(r, 5)), sort: (r) => sh(r, 5) ?? -1 },
          { key: "md", head: "Half within", cell: (r) => { const x = h(r); return x ? wdays(medianWd(x)) : "—"; }, sort: (r) => { const x = h(r); return x ? medianWd(x) ?? -1 : -1; } },
          { key: "wp", head: "With a proposed date", cell: (r) => (r.m ? int(histSum(r.m.p)) : "—"), sort: (r) => (r.m ? histSum(r.m.p) : -1) },
          { key: "by", head: "Shipped by it", cell: (r) => pct(r.m ? byDate(r.m) : null), sort: (r) => (r.m ? byDate(r.m) ?? -1 : -1) },
        ];
        return <FullTable first="Month" cols={cols} rows={rows} total={{ label: periodOf(f), m: dvSum(f, d) }} natural />;
      },
    }),
    wide({
      id: "spdSlow", page: "otd", title: "The slowest deliveries, last 3 months", hint: () => "6 working days or more from the order to the shipment, or shipped after the proposed date · the slowest first, whatever the period",
      body: ({ d }) => {
        if (!d.delivery) return <DvNone />;
        return <Table head={["Delivery", "Customer", "Country", "Ordered", "Shipped", "Working days", "Proposed date", "Shipping"]} left={[1, 2, 7]} pageSize={15} minWidth={1000}
          rows={d.delivery.slow.map((r) => ({
            key: r[0],
            cells: [r[0], r[7] || "—", r[5], ddmm(r[1]), ddmm(r[2]), `${int(r[3])} working day${r[3] === 1 ? "" : "s"}`, r[4] ? <Box key="p" component="span" sx={{ color: r[2] > r[4] ? BAD : undefined, fontWeight: r[2] > r[4] ? 700 : undefined }}>{ddmm(r[4])}</Box> : "—", r[6]],
          }))} />;
      },
    }),
  ];
}

/* ── KPI autonomy > Manual prices: the shop's prices against the ERP's (lib/reporting/boPrices.ts) ── */

const PR_TARGET = 0.025;
const prMonth = (d: Data, mandant: string, ym: string) => d.prices?.months[mandant]?.[ym];
/** the customers' own prices, from all the months read - worked out once per read */
const ownCache = new WeakMap<PricesKept, Set<string>>();
const prOwn = (d: Data) => { const k = d.prices; if (!k) return new Set<string>(); let x = ownCache.get(k); if (!x) { x = ownPriceCustomers(k); ownCache.set(k, x); } return x; };
/** the period's complete months the shop's prices are kept for (the month to date while none is complete) */
const prYms = (f: Frame) => f.yms.slice(f.from, Math.max(f.done, f.from + 1)).filter((ym) => ym >= PRICES_FROM);
function PrNone({ d }: { d: Data }) {
  const r = d.pricesRead;
  return <Typography sx={{ fontSize: "0.84rem", color: MUTED, py: 2 }}>{r?.error ? `The last read stopped: ${r.error}` : `Reading the shop's prices and the ERP's deliveries from HubSpot${r?.progress ? ` - ${r.progress}` : ""}. The first read takes a few minutes.`}</Typography>;
}
function prCharts(): ChartDef[] {
  return [
    wide({
      id: "prBig", page: "autonomy", title: "The biggest prices changed after the shop",
      hint: () => "The web order lines whose price per piece in the ERP moved most from the one the customer accepted in the shop, by the amount it made on the pieces invoiced · read from HubSpot every 12 hours, from June 2026 · the customers' own prices left out",
      body: ({ f, d }) => {
        if (!d.prices) return <PrNone d={d} />;
        const own = prOwn(d), yms = prYms(f);
        const rows = handRows(["100", "110"].flatMap((m) => yms.map((ym) => prMonth(d, m, ym))), own);
        const money = (v: number) => v.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 });
        return <Table head={["Order", "Customer", "Article", "Ordered", "Shop price", "ERP price", "Change", "Pieces"]} left={[1, 2]} pageSize={15} minWidth={1000}
          rows={rows.map((r, i) => ({
            key: `${r[0]}-${r[1]}-${i}`,
            cells: [r[0], r[6] || "—", r[1], ddmm(r[5]), r[2] ? money(r[2]) : "0", money(r[3]),
              r[2] ? <Box key="c" component="span" sx={{ fontWeight: 700, color: r[3] < r[2] ? BAD : INK }}>{signedPct((r[3] - r[2]) / r[2])}</Box> : "from 0", int(r[4])],
          }))} />;
      },
    }),
  ];
}

/* ── From the ERP's order lines (lib/reporting/boErpLines.ts): the pass rate, the manual prices and OTD, counted ── */

/** a month with fewer lines is not drawn */
const EL_MIN = 100, OTD_MIN = 30;
const PASS_TARGET = 0.95;
/** the period's complete months (the month to date while none is complete) */
const elYms = (f: Frame) => f.yms.slice(f.from, Math.max(f.done, f.from + 1));
const pcOf = (d: Data, mandant: string, yms: string[]) => priceSum(d.erpLines, mandant, yms);
const manualAt = (p: PriceCounts) => (p[0] >= EL_MIN ? p[1] / p[0] : null);
const autoAt = (p: PriceCounts) => (p[0] >= EL_MIN ? p[2] / p[0] : null);
const otdAt = (c: OtdCounts) => (c[0] >= OTD_MIN ? c[1] / c[0] : null);
const pushedAt = (c: OtdCounts) => (c[0] >= OTD_MIN ? c[2] / c[0] : null);
/** a percentage axis that keeps 2.5 % readable */
const pctTick1 = (v: number | null) => (v == null ? "" : v >= 0.1 ? `${Math.round(v * 100)}%` : `${Number((v * 100).toFixed(2))}%`);
function ElNone({ what }: { what: string }) {
  return <Typography sx={{ fontSize: "0.84rem", color: MUTED, py: 2 }}>{`Counted from the ERP's order lines once they come in with the morning file from the ERP - until then ${what}.`}</Typography>;
}
/** the counted line month by month, what the Back Office typed in beside it - or only the typed line before the first count */
function ElTrend({ f, d, typedKey, at, tick, target }: { f: Frame; d: Data; typedKey: string; at: (k: ErpLinesKept, ym: string) => number | null; tick: (v: number | null) => string; target?: number }) {
  const n = drawn(f), yms = f.yms.slice(0, n), typed = typedOf(d, typedKey, yms), k = d.erpLines;
  if (!k) return <MonthTrend values={typed} compare={null} labels={f.labels.slice(0, n)} label="Typed in by the Back Office" fmt={share} tick={tick} target={target} />;
  return <MonthTrend values={yms.map((ym) => at(k, ym))} compare={typed.some((x) => x != null) ? typed : null} labels={f.labels.slice(0, n)} label="Counted from the ERP" compareLabel="Typed in by the Back Office" fmt={share} tick={tick} target={target} />;
}

/** KPI autonomy: the pass rate or the manual prices of one mandant */
function elTrend(id: string, kind: "pass" | "price", mandant: string): ChartDef {
  const pass = kind === "pass", target = pass ? PASS_TARGET : PR_TARGET, key = `${kind}.m${mandant}`;
  const of = (p: PriceCounts) => (pass ? autoAt(p) : manualAt(p));
  return {
    id, page: "autonomy", title: pass ? `Pass rate, mandant ${mandant}` : `Manual price adjustments, mandant ${mandant}`,
    figure: ({ f, d }) => { const v = d.erpLines ? of(pcOf(d, mandant, elYms(f))) : meanOf(typedOf(d, key, elYms(f))); return v == null ? null : share(v); },
    hint: ({ f, d }) => {
      const p = d.erpLines ? pcOf(d, mandant, elYms(f)) : null;
      return [pass ? `eShop order lines whose price the ERP set by itself · target ${pct(target)}` : `eShop order lines whose price was typed by hand in the ERP · target below ${pct(target)}`,
        d.erpLines ? "the second line: typed in by the Back Office" : "typed in by the Back Office",
        p && p[0] ? `${periodOf(f)}: ${int(pass ? p[2] : p[1])} of ${int(p[0])} lines` : ""].filter(Boolean).join(" · ");
    },
    body: ({ f, d }) => <ElTrend f={f} d={d} typedKey={key} at={(k, ym) => of(priceSum(k, mandant, [ym]))} tick={pctTick1} target={target} />,
  };
}

/** OTD: one group's share on time month by month */
function otdTrend(id: string, title: string, typedKey: string, pick: OtdPick, note: string): ChartDef {
  return {
    id, page: "otd", title,
    figure: ({ f, d }) => { const v = d.erpLines ? otdAt(otdSum(d.erpLines, elYms(f), pick)) : meanOf(typedOf(d, typedKey, elYms(f))); return v == null ? null : share(v); },
    hint: ({ f, d }) => {
      const c = d.erpLines ? otdSum(d.erpLines, elYms(f), pick) : null;
      return [note, d.erpLines ? "the second line: typed in by the Back Office" : "typed in by the Back Office", c && c[0] ? `${periodOf(f)}: ${int(c[1])} of ${int(c[0])} lines on time` : ""].filter(Boolean).join(" · ");
    },
    body: ({ f, d }) => <ElTrend f={f} d={d} typedKey={typedKey} at={(k, ym) => otdAt(otdSum(k, [ym], pick))} tick={pctTick} />,
  };
}

function elCharts(): ChartDef[] {
  const S = 14;
  return [
    /* OTD */
    wide({
      id: "otdFigs", needsCount: true, page: "otd", title: "OTD in figures",
      hint: ({ f }) => `${periodOf(f)} · the eShop order lines shipped: on time when the shipment plus the ERP's transport time to the country reaches the first confirmed date`,
      figure: ({ f, d }) => (d.erpLines ? share(otdAt(otdSum(d.erpLines, elYms(f)))) : null),
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k) return <ElNone what="the Back Office's typed figures stand" />;
        const ys = elYms(f), all = otdSum(k, ys), std = otdSum(k, ys, { type: "S" }), spe = otdSum(k, ys, { type: "P" });
        const m100 = otdSum(k, ys, { mandant: "100" }), m110 = otdSum(k, ys, { mandant: "110" });
        const typed = meanOf(typedOf(d, "otd.online-all", doneYms(f)));
        return <Tiles items={[
          { label: "On time", value: share(otdAt(all)), sub: `${int(all[1])} of ${int(all[0])} lines${typed != null ? ` · typed in: ${share(typed)}` : ""}`, icon: <LocalShippingOutlinedIcon sx={{ fontSize: S }} />, tint: "blue" },
          { label: "Standard articles", value: share(otdAt(std)), sub: `${int(std[0])} lines`, icon: <InventoryOutlinedIcon sx={{ fontSize: S }} />, tint: "green" },
          { label: "Special articles", value: share(otdAt(spe)), sub: `${int(spe[0])} lines`, icon: <BuildOutlinedIcon sx={{ fontSize: S }} />, tint: "amber" },
          { label: "Mandant 100", value: share(otdAt(m100)), sub: `${int(m100[0])} lines`, icon: <ApartmentOutlinedIcon sx={{ fontSize: S }} />, tint: "slate" },
          { label: "Mandant 110", value: share(otdAt(m110)), sub: `${int(m110[0])} lines`, icon: <ApartmentOutlinedIcon sx={{ fontSize: S }} />, tint: "slate" },
          { label: "First date pushed later", value: share(pushedAt(all)), lower: true, sub: `${int(all[2])} lines got a later date after the first one`, icon: <EventRepeatOutlinedIcon sx={{ fontSize: S }} />, tint: "pink" },
        ]} />;
      },
    }),
    wide(otdTrend("otdAll", "OTD online, all", "otd.online-all", {}, "eShop order lines that arrived by their first confirmed date - the shipment plus the ERP's transport time to the country")),
    otdTrend("otdStandard", "OTD online, standard", "otd.online-standard", { type: "S" }, "Standard articles"),
    otdTrend("otdSpecial", "OTD online, special", "otd.online-special", { type: "P" }, "Special articles"),
    {
      id: "otdPushed", page: "otd", needsCount: true, title: "First date pushed later",
      figure: ({ f, d }) => (d.erpLines ? share(pushedAt(otdSum(d.erpLines, elYms(f)))) : null),
      hint: () => "Of the month's lines, those whose confirmed date was moved after the first one - by the month of the first date",
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k) return <ElNone what="this is not counted" />;
        const n = drawn(f);
        return <MonthTrend values={f.yms.slice(0, n).map((ym) => pushedAt(otdSum(k, [ym])))} compare={null} labels={f.labels.slice(0, n)} label="Counted from the ERP" fmt={share} tick={pctTick} />;
      },
    },
    wide({
      id: "otdMonths", needsCount: true, page: "otd", title: "OTD, month by month",
      hint: () => "By the month of the first confirmed date · the eShop order lines shipped · the last column: typed in by the Back Office",
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k) return <ElNone what="the Back Office's typed figures stand" />;
        type R = { label: string; yms: string[] };
        const rows: R[] = f.yms.map((ym, i) => ({ label: f.labels[i], yms: [ym] })).filter((r) => otdSum(k, r.yms)[0] > 0);
        const at = (r: R, p: OtdPick = {}) => otdAt(otdSum(k, r.yms, p));
        const cols: Col<R>[] = [
          { key: "n", head: "Lines", cell: (r) => int(otdSum(k, r.yms)[0]), sort: (r) => otdSum(k, r.yms)[0] },
          { key: "a", head: "On time", cell: (r) => pct(at(r)), sort: (r) => at(r) ?? -1 },
          { key: "s", head: "Standard", cell: (r) => pct(at(r, { type: "S" })), sort: (r) => at(r, { type: "S" }) ?? -1 },
          { key: "p", head: "Special", cell: (r) => pct(at(r, { type: "P" })), sort: (r) => at(r, { type: "P" }) ?? -1 },
          { key: "m1", head: "100", cell: (r) => pct(at(r, { mandant: "100" })), sort: (r) => at(r, { mandant: "100" }) ?? -1 },
          { key: "m2", head: "110", cell: (r) => pct(at(r, { mandant: "110" })), sort: (r) => at(r, { mandant: "110" }) ?? -1 },
          { key: "pu", head: "Pushed later", cell: (r) => pct(pushedAt(otdSum(k, r.yms))), sort: (r) => pushedAt(otdSum(k, r.yms)) ?? -1 },
          { key: "ty", head: "Typed in", cell: (r) => pct(meanOf(typedOf(d, "otd.online-all", r.yms))), sort: (r) => meanOf(typedOf(d, "otd.online-all", r.yms)) ?? -1 },
        ];
        if (!rows.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED, py: 2 }}>No eShop order line with a first date in this period.</Typography>;
        return <FullTable first="Month" cols={cols} rows={rows} total={{ label: periodOf(f), yms: elYms(f) }} natural />;
      },
    }),
    wide({
      id: "otdMinis", page: "otd", title: "Each profit centre, month by month", hint: ({ d }) => `Standard and special articles${d.erpLines ? ", counted from the ERP" : ", as typed in"} · the dashed line at 80 %`,
      body: ({ f, d }) => {
        const k = d.erpLines, yms = f.yms.slice(0, drawn(f));
        const lastOf = (xs: (number | null)[]) => [...xs].reverse().find((x) => x != null) ?? null;
        return <Minis legend={["Standard", "Special"]} items={PCS.map((pc) => {
          const std = k ? yms.map((ym) => otdAt(otdSum(k, [ym], { type: "S", pc }))) : typedOf(d, `otd.${pc.toLowerCase()}-standard`, yms);
          const spe = k ? yms.map((ym) => otdAt(otdSum(k, [ym], { type: "P", pc }))) : typedOf(d, `otd.${pc.toLowerCase()}-special`, yms);
          return { label: pc, values: std, values2: spe, value: `${share(lastOf(std))} · ${share(lastOf(spe))}`, sub: `standard · special, the last month ${k ? "counted" : "typed in"}` };
        })} />;
      },
    }),
    wide({
      id: "otdPc", page: "otd", title: "OTD per profit centre",
      own: ({ f, d }, box) => {
        const k = d.erpLines, yms = elYms(f);
        const rows = PCS.map((pc) => ({
          label: pc,
          std: (k ? otdAt(otdSum(k, yms, { type: "S", pc })) : meanOf(typedOf(d, `otd.${pc.toLowerCase()}-standard`, yms))) ?? 0,
          spc: (k ? otdAt(otdSum(k, yms, { type: "P", pc })) : meanOf(typedOf(d, `otd.${pc.toLowerCase()}-special`, yms))) ?? 0,
        }));
        return <DimChart {...box} rows={rows} cur={(r) => r.std} prev={(r) => r.spc} curLabel={`Standard, ${periodOf(f)}`} prevLabel="Special" fmt={(v) => pct(v)} fixedOrder />;
      },
    }),
    {
      id: "otdCountry", page: "otd", needsCount: true, title: "On time per delivery country", hint: ({ f }) => `${periodOf(f)} · in brackets the ERP's transport time, in working days`,
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k) return <ElNone what="this is not counted" />;
        const t = new Map<string, [number, number]>();
        for (const ym of elYms(f)) for (const [c, v] of Object.entries(k.country[ym] ?? {})) { const x = t.get(c) ?? [0, 0]; x[0] += v[0]; x[1] += v[1]; t.set(c, x); }
        const rows = [...t].filter(([, v]) => v[0] >= OTD_MIN).sort((a, b) => b[1][0] - a[1][0]).map(([c, v]) => ({ label: `${c} (${transitOf(c)})`, value: v[1] / v[0], secondary: `${int(v[0])} lines` }));
        return <BarList rows={rows} format={(v) => pct(v ?? null)} labelWidth={200} emptyMessage="No country with enough lines in this period." />;
      },
    },
    {
      id: "otdLate", page: "otd", needsCount: true, title: "The late lines: how late", hint: ({ f }) => `${periodOf(f)} · the working days after the first confirmed date that the line could have arrived`,
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k) return <ElNone what="this is not counted" />;
        const b = [0, 0, 0, 0, 0, 0];
        for (const ym of elYms(f)) (k.late[ym] ?? []).forEach((x, i) => { b[i] += x; });
        const late = b.reduce((x, y) => x + y, 0);
        return <BarList rows={LATE_BANDS.map((label, i) => ({ label, value: b[i], secondary: late ? `${pct(b[i] / late)} of the late lines` : "" }))} format={(v) => int(v ?? 0)} labelWidth={170} emptyMessage="No line late in this period." />;
      },
    },
    wide({
      id: "otdList", needsCount: true, page: "otd", title: "The late lines, last 3 months", hint: () => "The eShop order lines that arrived after their first confirmed date · the latest first date first, whatever the period",
      body: ({ d }) => {
        const k = d.erpLines;
        if (!k) return <ElNone what="this is not counted" />;
        return <Table head={["Order", "Article", "Supplier", "Country", "First date", "Shipped", "Late by", "Article type", "Profit centre", "Mandant"]} left={[1, 2, 3]} pageSize={15} minWidth={1150}
          rows={k.lateRows.map((r, i) => ({
            key: `${r[0]}-${r[1]}-${i}`,
            cells: [r[0], r[1], r[9] ? supName(r[9]) : "—", r[2] || "—", ddmm(r[3]), ddmm(r[4]), <Box key="l" component="span" sx={{ fontWeight: 700, color: BAD }}>{`${int(r[5])} working day${r[5] === 1 ? "" : "s"}`}</Box>, r[6] === "S" ? "Standard" : "Special", r[7] || "—", r[8]],
          }))} />;
      },
    }),

    /* KPI autonomy */
    elTrend("pass100", "pass", "100"),
    elTrend("pass110", "pass", "110"),
    elTrend("price100", "price", "100"),
    elTrend("price110", "price", "110"),
    wide({
      id: "elMonths", needsCount: true, page: "autonomy", title: "Pass rate and manual prices, month by month",
      hint: () => "eShop order lines by the month ordered, service articles left out · counted from the ERP",
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k) return <ElNone what="the Back Office's typed figures stand" />;
        type R = { label: string; a: PriceCounts; b: PriceCounts };
        const rows: R[] = f.yms.map((ym, i) => ({ label: f.labels[i], a: priceSum(k, "100", [ym]), b: priceSum(k, "110", [ym]) })).filter((r) => r.a[0] + r.b[0] > 0);
        const cols: Col<R>[] = [
          { key: "la", head: "Lines 100", cell: (r) => int(r.a[0]), sort: (r) => r.a[0] },
          { key: "pa", head: "Pass rate 100", cell: (r) => pct(autoAt(r.a)), sort: (r) => autoAt(r.a) ?? -1 },
          { key: "ma", head: "By hand 100", cell: (r) => pct(manualAt(r.a)), sort: (r) => manualAt(r.a) ?? -1 },
          { key: "lb", head: "Lines 110", cell: (r) => int(r.b[0]), sort: (r) => r.b[0] },
          { key: "pb", head: "Pass rate 110", cell: (r) => pct(autoAt(r.b)), sort: (r) => autoAt(r.b) ?? -1 },
          { key: "mb", head: "By hand 110", cell: (r) => pct(manualAt(r.b)), sort: (r) => manualAt(r.b) ?? -1 },
        ];
        if (!rows.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED, py: 2 }}>No eShop order line in this period.</Typography>;
        return <FullTable first="Month" cols={cols} rows={rows} total={{ label: periodOf(f), a: priceSum(k, "100", elYms(f)), b: priceSum(k, "110", elYms(f)) }} natural />;
      },
    }),
  ];
}


/* ── More from the order lines (SARCLA 09.11.2026: "not yet developed enough, we need more and logic is missing"):
   suppliers, open lines, every order source, the promised lead time; manual prices per profit centre, per article,
   per company owner - all from the same nightly summary (lib/reporting/boErpLines.ts, v2) ── */

const supName = (x: string) => (x.length > 36 ? `${x.slice(0, 35)}…` : x);
/** a share drawn from 20 lines on (an order source or a profit centre has fewer than the mandants) */
const share20 = (n: number, of: number) => (of >= 20 ? n / of : null);
const handOf = (p: PriceCounts) => share20(p[1], p[0]);
const passOf = (p: PriceCounts) => share20(p[2], p[0]);
const otd20 = (c: number[]) => share20(c[1], c[0]);
/** the promised lead time summed: [lines, working days, ...LEAD_BANDS] - every profit centre, or one */
function leadOf(k: ErpLinesKept | null | undefined, yms: string[], pc?: string): number[] {
  const t = [0, 0, 0, 0, 0, 0, 0];
  for (const ym of yms) for (const [p, c] of Object.entries(k?.lead?.[ym] ?? {})) { if (pc && p !== pc) continue; c.forEach((x, i) => { t[i] += x; }); }
  return t;
}
const wdAvg = (c: number[]) => (c[0] ? `${(c[1] / c[0]).toFixed(1)} wd` : "—");
type ElMonth = { label: string; yms: string[] };
const monthRows = (f: Frame, has: (yms: string[]) => boolean): ElMonth[] => f.yms.map((ym, i) => ({ label: f.labels[i], yms: [ym] })).filter((r) => has(r.yms));
function Note({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: "0.84rem", color: MUTED, py: 2 }}>{children}</Typography>;
}

function el2Charts(): ChartDef[] {
  const S = 14;
  return [
    /* OTD - every order source */
    wide({
      id: "otdSources", needsCount: true, page: "otd", title: "OTD per order source",
      hint: () => "Every order of mandants 100 and 110 shipped - the eShop's and those typed in by the Back Office - the same rule · by the month of the first confirmed date",
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.srcOtd) return <ElNone what="this is not counted" />;
        const ys = elYms(f), srcs = keysOf(k.srcOtd, ys);
        const all = (yms: string[]) => srcs.reduce((t, x) => { const v = pairOf(k.srcOtd, yms, x); return [t[0] + v[0], t[1] + v[1]]; }, [0, 0]);
        const cols: Col<ElMonth>[] = [
          { key: "n", head: "Lines", cell: (r) => int(all(r.yms)[0]), sort: (r) => all(r.yms)[0] },
          { key: "a", head: "On time, all", cell: (r) => pct(otd20(all(r.yms))), sort: (r) => otd20(all(r.yms)) ?? -1 },
          ...srcs.flatMap((x): Col<ElMonth>[] => [
            { key: `n-${x}`, head: `Lines, ${x}`, cell: (r) => int(pairOf(k.srcOtd, r.yms, x)[0]), sort: (r) => pairOf(k.srcOtd, r.yms, x)[0] },
            { key: `o-${x}`, head: `On time, ${x}`, cell: (r) => pct(otd20(pairOf(k.srcOtd, r.yms, x))), sort: (r) => otd20(pairOf(k.srcOtd, r.yms, x)) ?? -1 },
          ]),
        ];
        return <FullTable first="Month" cols={cols} rows={monthRows(f, (y) => keysOf(k.srcOtd, y).length > 0)} total={{ label: periodOf(f), yms: ys }} natural />;
      },
    }),

    /* OTD - suppliers */
    {
      id: "otdSupplier", needsCount: true, page: "otd", title: "On time per supplier",
      hint: ({ f }) => `${periodOf(f)} · the eShop lines shipped, by each article's main supplier in the ERP · the most lines first`,
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.supplier) return <ElNone what="this is not counted" />;
        const ys = elYms(f);
        const rows = keysOf(k.supplier, ys).map((x) => ({ x, v: pairOf(k.supplier, ys, x) })).filter((r) => r.v[0] >= OTD_MIN)
          .map((r) => ({ label: supName(r.x), value: r.v[1] / r.v[0], secondary: `${int(r.v[0])} lines · ${int(r.v[0] - r.v[1])} late` }));
        return <BarList rows={rows.slice(0, 25)} format={(v) => pct(v ?? null)} labelWidth={270} emptyMessage="No supplier with enough lines in this period." />;
      },
    },
    {
      id: "otdSupplierLate", needsCount: true, page: "otd", title: "Who the late lines come from",
      hint: ({ f }) => `${periodOf(f)} · each supplier's late eShop lines, and their share of all the late lines - where fixing counts most`,
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.supplier) return <ElNone what="this is not counted" />;
        const ys = elYms(f);
        const all = keysOf(k.supplier, ys).map((x) => ({ x, v: pairOf(k.supplier, ys, x) }));
        const lateAll = all.reduce((t, r) => t + r.v[0] - r.v[1], 0);
        const rows = all.map((r) => ({ label: supName(r.x), value: r.v[0] - r.v[1], secondary: lateAll ? `${pct((r.v[0] - r.v[1]) / lateAll)} of the late lines` : "" }))
          .filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
        return <BarList rows={rows.slice(0, 20)} format={(v) => int(v ?? 0)} labelWidth={270} emptyMessage="No late line in this period." />;
      },
    },
    wide({
      id: "otdSupplierMonths", needsCount: true, page: "otd", title: "The main suppliers, month by month",
      hint: () => "On time per month of the first confirmed date · the 8 suppliers with the most lines (a month with fewer than 10 lines left empty)",
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.supplier) return <ElNone what="this is not counted" />;
        const ys = elYms(f), top = keysOf(k.supplier, ys).filter((x) => x !== NO_SUPPLIER && x !== OTHER_SUPPLIERS).slice(0, 8);
        const at = (yms: string[], x: string) => { const v = pairOf(k.supplier, yms, x); return v[0] >= 10 ? v[1] / v[0] : null; };
        const cols: Col<ElMonth>[] = top.map((x) => ({ key: x, head: supName(x), cell: (r: ElMonth) => pct(at(r.yms, x)), sort: (r: ElMonth) => at(r.yms, x) ?? -1 }));
        return <FullTable first="Month" cols={cols} rows={monthRows(f, (y) => keysOf(k.supplier, y).length > 0)} total={{ label: periodOf(f), yms: ys }} natural />;
      },
    }),

    /* OTD - the open lines to act on */
    wide({
      id: "openFigs", needsCount: true, page: "otd", title: "Open lines to act on",
      hint: ({ d }) => `Every order of mandants 100 and 110 not shipped yet - standard and special articles - as the morning file had them${d.erpLines?.open ? ` on ${ddmm(d.erpLines.open.day)}` : ""}`,
      body: ({ d }) => {
        const o = d.erpLines?.open;
        if (!o) return <ElNone what="this is not counted" />;
        return <Tiles items={[
          { label: "Overdue", value: int(o.overdue), lower: true, sub: "lines whose first confirmed date has passed", icon: <EventRepeatOutlinedIcon sx={{ fontSize: S }} />, tint: "pink" },
          { label: `Due within ${OPEN_DUE_WD} working days`, value: int(o.due), lower: true, sub: "to ship now to arrive on time", icon: <TimerOutlinedIcon sx={{ fontSize: S }} />, tint: "amber" },
        ]} />;
      },
    }),
    wide({
      id: "openList", needsCount: true, page: "otd", title: "The open lines, the most overdue first",
      hint: () => `Not shipped yet: overdue, or due within ${OPEN_DUE_WD} working days · the first confirmed date, the date it stands at now, what is still to ship`,
      body: ({ d }) => {
        const o = d.erpLines?.open;
        if (!o) return <ElNone what="this is not counted" />;
        if (!o.rows.length) return <Note>No open line overdue or due within {OPEN_DUE_WD} working days.</Note>;
        return <Table head={["Order", "Article", "Supplier", "Country", "First date", "Date now", "Ordered", "Shipped", "Overdue", "Article", "Mandant · source"]} left={[0, 1, 2, 3]} pageSize={15} minWidth={1200}
          rows={o.rows.map((r, i) => ({
            key: `${r[0]}-${r[1]}-${i}`,
            cells: [r[0], r[1], r[12] ? supName(r[12]) : "—", r[2] || "—", ddmm(r[3]), r[4] ? ddmm(r[4]) : "—", int(r[5]), int(r[6]),
              <Box key="o" component="span" sx={{ fontWeight: 700, color: r[7] > 0 ? BAD : MUTED, whiteSpace: "nowrap" }}>{r[7] > 0 ? `${int(r[7])} wd overdue` : r[7] === 0 ? "due today" : `due in ${int(-r[7])} wd`}</Box>,
              `${r[8] === "S" ? "Standard" : "Special"} · ${r[9] || "—"}`, `${r[10]} · ${r[11]}`],
          }))} />;
      },
    }),

    /* OTD - the promised lead time */
    {
      id: "leadMonths", needsCount: true, page: "otd", title: "Promised lead time, month by month",
      hint: () => "The working days from the order to the first confirmed date, on average · eShop lines by the month ordered",
      figure: ({ f, d }) => { const c = leadOf(d.erpLines, elYms(f)); return c[0] ? wdAvg(c) : null; },
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.lead) return <ElNone what="this is not counted" />;
        const n = drawn(f);
        return <MonthTrend values={f.yms.slice(0, n).map((ym) => { const c = leadOf(k, [ym]); return c[0] >= OTD_MIN ? c[1] / c[0] : null; })} compare={null} labels={f.labels.slice(0, n)}
          label="Working days promised, on average" fmt={(v) => (v == null ? "—" : `${v.toFixed(1)} wd`)} tick={(v) => (v == null ? "" : `${Math.round(v)}`)} />;
      },
    },
    {
      id: "leadBands", needsCount: true, page: "otd", title: "How long we promise",
      hint: ({ f }) => `${periodOf(f)} · the eShop lines per promised lead time, from the order to the first confirmed date`,
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.lead) return <ElNone what="this is not counted" />;
        const c = leadOf(k, elYms(f));
        return <BarList rows={LEAD_BANDS.map((label, i) => ({ label, value: c[2 + i], secondary: c[0] ? `${pct(c[2 + i] / c[0])} of the lines` : "" }))} format={(v) => int(v ?? 0)} labelWidth={180} emptyMessage="No line in this period." />;
      },
    },
    wide({
      id: "leadPc", needsCount: true, page: "otd", title: "Promised lead time per profit centre",
      hint: ({ f }) => `${periodOf(f)} · the average working days, and the share promised within 5 and beyond 20`,
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.lead) return <ElNone what="this is not counted" />;
        const ys = elYms(f);
        type R = { label: string; pc?: string };
        const c = (r: R) => leadOf(k, ys, r.pc);
        const cols: Col<R>[] = [
          { key: "n", head: "Lines", cell: (r) => int(c(r)[0]), sort: (r) => c(r)[0] },
          { key: "avg", head: "Average", cell: (r) => wdAvg(c(r)), sort: (r) => (c(r)[0] ? c(r)[1] / c(r)[0] : -1) },
          { key: "f5", head: "Within 5 wd", cell: (r) => pct(c(r)[0] ? (c(r)[2] + c(r)[3]) / c(r)[0] : null), sort: (r) => (c(r)[0] ? (c(r)[2] + c(r)[3]) / c(r)[0] : -1) },
          { key: "g20", head: "Beyond 20 wd", cell: (r) => pct(c(r)[0] ? c(r)[6] / c(r)[0] : null), sort: (r) => (c(r)[0] ? c(r)[6] / c(r)[0] : -1) },
        ];
        return <FullTable first="Profit centre" cols={cols} rows={PCS.map((pc) => ({ label: pc, pc })).filter((r) => c(r)[0] > 0)} total={{ label: "All" }} natural />;
      },
    }),

    /* Pass rate - eShop and typed-in orders */
    wide({
      id: "prSources", needsCount: true, page: "autonomy", title: "eShop orders and orders typed in by the Back Office",
      hint: () => "The pass rate and the manual prices per order source, by the month ordered, service articles left out",
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.srcPrice) return <ElNone what="this is not counted" />;
        const ys = elYms(f), srcs = keysOf(k.srcPrice, ys);
        const cols: Col<ElMonth>[] = srcs.flatMap((x): Col<ElMonth>[] => [
          { key: `l-${x}`, head: `Lines, ${x}`, cell: (r) => int(priceOf(k.srcPrice, r.yms, x)[0]), sort: (r) => priceOf(k.srcPrice, r.yms, x)[0] },
          { key: `p-${x}`, head: `Pass rate, ${x}`, cell: (r) => pct(passOf(priceOf(k.srcPrice, r.yms, x))), sort: (r) => passOf(priceOf(k.srcPrice, r.yms, x)) ?? -1 },
          { key: `m-${x}`, head: `By hand, ${x}`, cell: (r) => pct(handOf(priceOf(k.srcPrice, r.yms, x))), sort: (r) => handOf(priceOf(k.srcPrice, r.yms, x)) ?? -1 },
        ]);
        return <FullTable first="Month" cols={cols} rows={monthRows(f, (y) => keysOf(k.srcPrice, y).length > 0)} total={{ label: periodOf(f), yms: ys }} natural />;
      },
    }),

    /* Manual prices - per profit centre, per article, per owner */
    wide({
      id: "pricePc", needsCount: true, page: "autonomy", title: "Manual prices per profit centre",
      own: ({ f, d }, box) => {
        const k = d.erpLines, ys = elYms(f);
        if (!k?.pcPrice) return <ElNone what="this is not counted" />;
        const rows = PCS.map((pc) => ({ label: pc, std: handOf(priceOf(k.pcPrice, ys, `S|${pc}`)) ?? 0, spc: handOf(priceOf(k.pcPrice, ys, `P|${pc}`)) ?? 0 }));
        return <DimChart {...box} rows={rows} cur={(r) => r.std} prev={(r) => r.spc} curLabel={`Standard, ${periodOf(f)}`} prevLabel="Special" fmt={(v) => pct(v)} fixedOrder />;
      },
    }),
    wide({
      id: "pricePcMonths", needsCount: true, page: "autonomy", title: "Manual prices per profit centre, month by month",
      hint: () => "The share of eShop lines priced by hand, standard and special articles together, by the month ordered (a month with fewer than 20 lines left empty)",
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.pcPrice) return <ElNone what="this is not counted" />;
        const ys = elYms(f);
        const of = (yms: string[], pc: string) => priceOf(k.pcPrice, yms, (g) => g.endsWith(`|${pc}`));
        const cols: Col<ElMonth>[] = PCS.map((pc) => ({ key: pc, head: pc, cell: (r: ElMonth) => pct(handOf(of(r.yms, pc))), sort: (r: ElMonth) => handOf(of(r.yms, pc)) ?? -1 }));
        return <FullTable first="Month" cols={cols} rows={monthRows(f, (y) => keysOf(k.pcPrice, y).length > 0)} total={{ label: periodOf(f), yms: ys }} natural />;
      },
    }),
    wide({
      id: "priceArticles", needsCount: true, page: "autonomy", title: "The articles priced by hand most",
      hint: () => "The last 3 months, eShop lines · priced by hand at least twice - candidates for the price list",
      body: ({ d }) => {
        const a = d.erpLines?.manualArticles;
        if (!a) return <ElNone what="this is not counted" />;
        if (!a.length) return <Note>No article priced by hand twice in the last 3 months.</Note>;
        return <Table head={["Article", "By hand", "Of its lines", "Share", "Last time", "Profit centre", "Type", "Supplier"]} left={[0, 7]} pageSize={15} minWidth={1000}
          rows={a.map((r) => ({ key: r[0], cells: [r[0], int(r[1]), int(r[2]), pct(r[2] ? r[1] / r[2] : null), ddmm(r[4]), r[3] || "—", r[6] === "S" ? "Standard" : r[6] === "P" ? "Special" : "—", r[5] ? supName(r[5]) : "—"] }))} />;
      },
    }),
    {
      id: "priceOwner", needsCount: true, page: "autonomy", title: "Manual prices per company owner",
      hint: ({ f }) => `${periodOf(f)} · the eShop lines of each owner's customers, priced by hand (from 20 lines)`,
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k?.ownerPrice) return <Note>Counted once the ERP&apos;s order lines carry the customer - then each line goes to its customer&apos;s company owner in HubSpot.</Note>;
        const ys = elYms(f);
        const rows = keysOf(k.ownerPrice, ys).map((o) => ({ o, p: priceOf(k.ownerPrice, ys, o) })).filter((r) => handOf(r.p) != null)
          .map((r) => ({ label: r.o, value: handOf(r.p) ?? 0, secondary: `${int(r.p[1])} of ${int(r.p[0])} lines by hand` })).sort((a, b) => b.value - a.value);
        return <BarList rows={rows} format={(v) => pct(v ?? null)} labelWidth={220} emptyMessage="No owner with enough lines in this period." />;
      },
    },

    /* Pass rate - how it's counted, with the figures and real lines */
    wide({
      id: "passSources", needsCount: true, page: "autonomy", title: "Every month's lines per price source",
      hint: () => "The eShop order lines of mandants 100 and 110 as the ERP records their price source, by the month ordered, service articles left out - what the pass rate and the manual prices are made of",
      body: ({ f, d }) => {
        const k = d.erpLines;
        if (!k) return <ElNone what="this is not counted" />;
        const p = (yms: string[]) => { const a = priceSum(k, "100", yms), b = priceSum(k, "110", yms); return a.map((x, i) => x + b[i]) as PriceCounts; };
        const cols: Col<ElMonth>[] = [
          { key: "n", head: "Lines", cell: (r) => int(p(r.yms)[0]), sort: (r) => p(r.yms)[0] },
          { key: "a", head: "automatically", cell: (r) => int(p(r.yms)[2]), sort: (r) => p(r.yms)[2] },
          { key: "m", head: "manually", cell: (r) => int(p(r.yms)[1]), sort: (r) => p(r.yms)[1] },
          { key: "c", head: "calculated", cell: (r) => int(p(r.yms)[3]), sort: (r) => p(r.yms)[3] },
          { key: "pr", head: "Pass rate", cell: (r) => pct(passOf(p(r.yms))), sort: (r) => passOf(p(r.yms)) ?? -1 },
          { key: "mp", head: "Manual prices", cell: (r) => pct(handOf(p(r.yms))), sort: (r) => handOf(p(r.yms)) ?? -1 },
        ];
        return <FullTable first="Month" cols={cols} rows={monthRows(f, (y) => p(y)[0] > 0)} total={{ label: periodOf(f), yms: elYms(f) }} natural />;
      },
    }),
    wide({
      id: "passExamples", needsCount: true, page: "autonomy", title: "Lines priced by hand, the latest",
      hint: () => "Real eShop order lines whose price was typed in the ERP (price source \"manually\") - each one counts against the pass rate",
      body: ({ d }) => {
        const m = d.erpLines?.manualRows;
        if (!m) return <ElNone what="this is not counted" />;
        return <Table head={["Order", "Article", "Ordered", "Profit centre", "Type", "Mandant", "Supplier"]} left={[0, 1, 6]} pageSize={10} minWidth={900}
          rows={m.map((r, i) => ({ key: `${r[0]}-${r[1]}-${i}`, cells: [r[0], r[1], ddmm(r[2]), r[3] || "—", r[5] === "S" ? "Standard" : r[5] === "P" ? "Special" : "—", r[4], r[6] ? supName(r[6]) : "—"] }))} />;
      },
    }),
  ];
}

/* ── How it's counted: OTD and the pass rate, in words, with the ERP's own dates and examples ── */

function Rule({ children }: { children: React.ReactNode }) {
  return <Box sx={{ px: 1.75, py: 1.25, borderRadius: "12px", bgcolor: TINT.blue.bg, border: `1px solid ${TINT.blue.fg}`, fontSize: "0.95rem", fontWeight: 700, color: INK }}>{children}</Box>;
}
function Points({ items }: { items: [string, string][] }) {
  return (
    <Box component="dl" sx={{ m: 0, mt: 1.5, display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 2, rowGap: 0.75 }}>
      {items.map(([k, v]) => (
        <Box key={k} sx={{ display: "contents" }}>
          <Box component="dt" sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{k}</Box>
          <Box component="dd" sx={{ m: 0, fontSize: "0.84rem", color: MUTED }}>{v}</Box>
        </Box>
      ))}
    </Box>
  );
}
function logicCharts(): ChartDef[] {
  return [
    wide({
      id: "otdLogic", page: "otd", title: "The rule", hint: () => "How a line counts as on time - the same rule for every month, every country and every profit centre",
      body: () => (
        <Box>
          <Rule>On time = the shipment date + the ERP&apos;s transport time to the delivery country (working days) is on or before the first confirmed date</Rule>
          <Points items={[
            ["Which lines", "Every order line of an eShop order in mandants 100 and 110 - standard and special articles; services (freight, certificates) left out; credit notes left out."],
            ["When counted", "Once the line is shipped and invoiced. A line not shipped yet waits - it is neither on time nor late."],
            ["Which month", "The month of the first confirmed date - so a month's OTD is the lines that were due that month."],
            ["Late by", "The working days between the first confirmed date and the day the line could arrive (shipment + transport)."],
            ["Pushed later", "A line whose confirmed date was moved after the first one. It still counts against the FIRST date."],
            ["Why the first date", "It is the promise made to the customer. The confirmed date moves when the delivery moves, so measured against it nearly everything would be on time."],
            ["Checked", "Against the Back Office's typed OTD, Jan-Sep 2026: within about 1.5 points every month (Jan 72.8 against 74, Jun 68.3 against 68, Sep 81.0 against 80.8)."],
            ["Order sources", "The KPI is the eShop's. \"OTD per order source\" adds the orders typed in by the Back Office, with the same rule."],
            ["Suppliers", "Each article's main supplier in the ERP (its lead supplier, named from the ERP's supplier list). An article without one counts as \"No supplier known\"."],
            ["Open lines", `Not shipped yet (ordered more than shipped, the order not invoiced or cancelled), with a first confirmed date that has passed or comes within ${OPEN_DUE_WD} working days - every order source, as the morning file had them.`],
            ["Lead time", "The working days from the order date to the first confirmed date - what was promised, not what happened. By the month ordered."],
          ]} />
        </Box>
      ),
    }),
    wide({
      id: "otdDates", page: "otd", title: "Which dates", hint: () => "Every date OTD reads, where it comes from in the ERP, and what it is used for",
      body: () => (
        <Table head={["Date", "In the ERP", "What it is", "Used for"]} left={[0, 1, 2, 3]} minWidth={900}
          rows={[
            ["First confirmed date", "Order line · ShippingDateInitial", "The delivery date first confirmed to the customer - the day at the customer's door", "The target, and the month OTD is counted in"],
            ["Shipment date", "Delivery · ShipmentDate", "The day the delivery left the warehouse (Embrach)", "The actual: shipment + transport = when it arrives"],
            ["Transport time", "The ERP's table per delivery country", "Working days from the warehouse to the customer - Switzerland 1, Germany 2, Italy 4, France 5 ...", "Added to the shipment date"],
            ["Confirmed date now", "Order line · ShippingDateConfirmed", "The date as it stands today, after every change", "Only to see which lines were pushed later"],
            ["Order date", "Order · OrderDate", "The day the order came in", "Not in OTD (the pass rate's month)"],
            ["Customer's wish date", "Order line · CustomerWishDate", "What the customer asked for - the same as the first date on 86 % of lines", "Not used: the first confirmed date is the promise"],
            ["Delivery date initial", "Order · DeliveryDateInitial", "Empty on every order since 2025", "Not used"],
          ].map((r) => ({ key: r[0], cells: r }))} />
      ),
    }),
    {
      id: "otdTransit", page: "otd", title: "Transport time per country", hint: ({ f, d }) => (d.erpLines ? `${periodOf(f)} · the ERP's working days, the lines and the share on time` : "The ERP's working days - a country it does not know counts 6"),
      body: ({ f, d }) => {
        const k = d.erpLines;
        const t = new Map<string, [number, number]>();
        if (k) for (const ym of elYms(f)) for (const [c, v] of Object.entries(k.country[ym] ?? {})) { const x = t.get(c) ?? [0, 0]; x[0] += v[0]; x[1] += v[1]; t.set(c, x); }
        const names = k ? [...t].sort((a, b) => b[1][0] - a[1][0]).map(([c]) => c) : ["Switzerland", "Liechtenstein", "Germany", "Netherlands", "Belgium", "Austria", "Italy", "Czech Republic", "Slovenia", "Hungary", "France", "Spain", "Romania", "Poland"];
        return <Table head={k ? ["Country", "Working days", "Lines", "On time"] : ["Country", "Working days"]} left={[0]} pageSize={12}
          rows={names.map((c) => { const v = t.get(c); return { key: c, cells: k ? [c, String(transitOf(c)), int(v?.[0] ?? 0), pct(v && v[0] ? v[1] / v[0] : null)] : [c, String(transitOf(c))] }; })} />;
      },
    },
    wide({
      id: "otdExamples", page: "otd", title: "Lines as counted", needsCount: true, hint: () => "Real lines of the last 3 months, each date as the rule reads it · late ones first",
      body: ({ d }) => {
        const k = d.erpLines;
        if (!k) return null;
        const rows = [...k.lateRows.slice(0, 6).map((r) => [r, false] as const), ...(k.okRows ?? []).slice(0, 6).map((r) => [r, true] as const)];
        return <Table head={["Order", "Country", "Shipped", "+ transport", "Arrives", "First date", "Result"]} left={[0, 1]} minWidth={760}
          rows={rows.map(([r, ok], i) => ({
            key: `${r[0]}-${r[1]}-${i}`,
            cells: [r[0], r[2] || "—", ddmm(r[4]), `${transitOf(r[2])} wd`, ddmm(addWd(r[4], transitOf(r[2]))), ddmm(r[3]),
              <Box key="r" component="span" sx={{ fontWeight: 700, color: ok ? GOOD : BAD }}>{ok ? (r[5] ? `on time, ${r[5]} wd to spare` : "on time, on the day") : `late by ${r[5]} wd`}</Box>],
          }))} />;
      },
    }),
    wide({
      id: "passLogic", page: "autonomy", title: "The rule", hint: () => "Where each line's price came from, as the ERP records it on the order line (PriceSource)",
      body: () => (
        <Box>
          <Rule>Pass rate = the share of eShop order lines whose price the ERP set by itself · manual prices = the share typed by a person</Rule>
          <Box sx={{ mt: 1.5 }}>
            <Table head={["Price source in the ERP", "What it means", "Counts as"]} left={[0, 1, 2]} minWidth={700}
              rows={[
                ["automatically", "The ERP found the price itself - its price list and the customer's conditions", "Pass rate - no hand on the price"],
                ["manually", "A person typed the price in the ERP", "Manual price adjustment"],
                ["calculated", "The ERP calculated it - about 0.1 % of the lines", "Neither"],
              ].map((r) => ({ key: r[0], cells: r }))} />
          </Box>
          <Points items={[
            ["Which lines", "Every order line of an eShop order in mandants 100 and 110; services (freight, certificates) left out; credit notes left out."],
            ["Which month", "The month the order came in."],
            ["Targets", "Pass rate 95 % or more; manual prices below 2.5 %."],
            ["Checked", "Against the Back Office's typed figures, Jan-Sep 2026: 0.3 points apart on average. Per ORDER it would be 6-10 % by hand - their figure is per line."],
            ["The biggest changes", "The list under Manual prices is another source: the shop's price against the price the ERP invoiced, for the lines that moved most."],
          ]} />
        </Box>
      ),
    }),
  ];
}

export const CHARTS: ChartDef[] = [
  /* Team totals - the workbook's "Monthly evolution - team totals" */
  listed(ALL_IN)({
    id: "createdClosed", page: "figures", title: "Tickets created and closed, month by month",
    figure: ({ f }) => (f.total.created == null ? null : `${n0(f.total.created)} created, ${n0(f.total.closed)} closed`),
    hint: ({ f }) => `Created: by the month they came in · closed: by their close date${f.done ? ` · ${f.doneWords}: ${n0(f.total.created)} created, ${n0(f.total.closed)} closed` : ""}`,
    body: ({ f }) => {
      const n = drawn(f);
      return <GroupedColumns height={240} format={n0} currentLabel="Created" priorLabel="Closed" currentFirst
        data={f.yms.slice(0, n).map((_, i) => { const k = f.k(i); return { x: f.labels[i], current: k.created, prior: k.closed }; })} />;
    },
  }),
  {
    id: "backlog", page: "figures", title: "Tickets created and closed, added up over the year",
    figure: ({ f }) => (f.total.created == null ? null : `${n0(f.total.created)} created, ${n0(f.total.closed)} closed`),
    hint: () => "The gap between the two lines is how far closing lags behind what came in",
    body: ({ f }) => {
      const n = drawn(f);
      let a = 0, b = 0;
      const data = f.yms.slice(0, n).map((_, i) => {
        const k = f.k(i);
        if (k.created == null) return { x: f.labels[i], value: null, compare: null };
        a += k.created; b += k.closed ?? 0;
        return { x: f.labels[i], value: a, compare: b };
      });
      return <TrendChart data={data} seriesLabel="Created, added up" compareLabel="Closed, added up" height={240} format={n0} xFormat={(x) => x} />;
    },
  },
  listed(ALL_IN)(trend("created", "figures", "Tickets created", "The Back Office's tickets, by the month they came in", (k) => k.created, n0)),
  listed({ note: "the chat's tickets", keep: (t) => t.origin === "Chat" })(trend("chat", "figures", "Chat tickets", "Handed over to the Back Office by the chat", (k) => k.chat, n0)),
  listed({ closed: true, note: "the tickets closed" })(trend("closed", "figures", "Tickets closed", "By their close date", (k) => k.closed, n0)),
  listed(ALL_IN)(wide({
    id: "origins", page: "figures", title: "Where the tickets came from, month by month",
    figure: ({ f }) => (f.total.created == null ? null : n0(f.total.created)),
    hint: () => "Customer: an e-mail or a form · Chat: handed over by the chat · Automatic & internal: what no customer wrote - automatic, finance and internal e-mails, GQS updates, spam - and what a system made",
    body: ({ f }) => <StackedColumns height={260} format={n0} data={byMonth(f, "created", (t) => t.origin).map((x, i) => ({ x: f.labels[i], ...originCells(x) }))} parts={originParts} />,
  })),
  listed(ALL_IN)(wide({
    id: "peopleOrigin", page: "figures", title: "What came in to each person, by where it came from",
    hint: ({ f }) => {
      const out = peopleOf(f).filter((p) => !inTeam(f, p.id)).reduce((s, p) => s + p.created, 0);
      return `${periodOf(f)} · the tickets created, by their owner today · the Back Office team${out ? ` - ${int(out)} tickets with owners outside it left out` : ""}`;
    },
    body: ({ f }) => {
      const ps = peopleOf(f).filter((p) => p.created && inTeam(f, p.id)).sort((a, b) => b.created - a.created).slice(0, 16);
      return <StackedColumns height={300} format={n0} data={ps.map((p) => ({ x: shortName(p.name), ...originCells(p.origin) }))} parts={originParts} />;
    },
  })),
  listed({ closed: true, note: "the tickets closed" })(wide({
    id: "peopleClosed", page: "figures", title: "Tickets closed, by person",
    hint: ({ f }) => `${periodOf(f)} · by their close date and their owner · beside it, what came in to them · the Back Office team, the other owners folded`,
    body: ({ f }) => <TeamBars f={f} rows={peopleOf(f).filter((p) => p.closed).sort((a, b) => b.closed - a.closed).map((p) => ({ id: p.id, label: p.name, value: p.closed, secondary: `${int(p.created)} came in` }))} format={(v) => int(v ?? 0)} empty="No ticket closed for this choice." />,
  })),
  listed({ note: "the tickets closed since", keep: (_t, r) => r[RW.close] >= 0 })({
    id: "peopleSpeed", page: "figures", title: "Days to close, by person",
    hint: ({ f }) => `${periodOf(f)} · the tickets created in the period and closed since, on average, by their owner`,
    body: ({ f }) => <TeamBars f={f} rows={peopleOf(f).filter((p) => p.dn).sort((a, b) => b.created - a.created).map((p) => ({ id: p.id, label: p.name, value: p.days / p.dn, secondary: `${int(p.dn)} of ${int(p.created)} closed` }))} format={days} empty="No ticket closed for this choice." />,
  }),
  listed({ note: "the tickets answered", keep: (_t, r) => r[RW.reply] >= 0 })({
    id: "peopleReply", page: "figures", title: "Days to the first reply, by person",
    hint: ({ f }) => `${periodOf(f)} · to the first agent e-mail reply, on average, by the ticket's owner`,
    body: ({ f }) => {
      const by = new Map<string, { s: number; n: number }>();
      eachRow(f, "created", (t, r) => { if (r[RW.reply] < 0) return; const x = by.get(t.owner) ?? { s: 0, n: 0 }; x.s += r[RW.reply] / 10; x.n++; by.set(t.owner, x); });
      return <TeamBars f={f} rows={[...by].sort((a, b) => b[1].n - a[1].n).map(([id, x]) => ({ id, label: ownerName(f, id), value: x.s / x.n, secondary: `${int(x.n)} answered` }))} format={days} empty="No ticket answered for this choice." />;
    },
  }),
  listed(ALL_IN)(wide({
    id: "peopleMonths", page: "figures", title: "Each person, month by month",
    hint: ({ f }) => `${periodOf(f)} · what came in to each and what each closed, month by month, on one scale · the balance in green when they closed more than came in · the Back Office team, the other owners folded`,
    body: ({ f }) => <PersonMonths f={f} people={peopleOf(f).filter((p) => p.created || p.closed)} />,
  })),
  listed({ note: "the customers' tickets closed without any answer", keep: (t, r) => unanswered(r, t) })({
    id: "noAnswer", page: "figures", title: "Customer tickets closed without any answer, month by month",
    hint: () => "A customer's e-mail or form closed with no agent reply at all - by the month it came in",
    body: ({ f }) => {
      const n = drawn(f);
      const of = (m: BoMonth | null) => {
        if (!m?.rows || m.pending || !hasTickets(m.ym)) return null;
        const d = m.rows.dict;
        let k = 0;
        for (const r of m.rows.created) { const t = tk(d, r, RW); if (passes(f.fil, f.co, t) && unanswered(r, t)) k++; }
        return k;
      };
      const compare = f.prev.slice(0, n).map(of);
      return <MonthTrend values={f.cur.slice(0, n).map(of)} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={n0} />;
    },
  }),
  listed({ note: "the customers' tickets closed without any answer", keep: (t, r) => unanswered(r, t) })({
    id: "noAnswerPeople", page: "figures", title: "Customer tickets closed without any answer, by person",
    hint: ({ f }) => `${periodOf(f)} · by the ticket's owner · beside it, the share of their customer tickets`,
    body: ({ f }) => {
      const by = new Map<string, { k: number; all: number }>();
      eachRow(f, "created", (t, r) => { if (t.origin !== "Customer") return; const x = by.get(t.owner) ?? { k: 0, all: 0 }; x.all++; if (unanswered(r, t)) x.k++; by.set(t.owner, x); });
      return <TeamBars f={f} rows={[...by].filter(([, x]) => x.k).sort((a, b) => b[1].k - a[1].k).map(([id, x]) => ({ id, label: ownerName(f, id), value: x.k, secondary: `${pct(x.k / x.all)} of ${int(x.all)}` }))} format={(v) => int(v ?? 0)} empty="None for this choice." />;
    },
  }),
  listed(ALL_IN)(wide({
    id: "topicPcs", page: "topics", title: "Which types of problem, per profit centre",
    hint: ({ f }) => `${periodOf(f)} · the tickets by their profit centre - their order's, else the articles named on them, else their customer's main one - on to their topic`,
    body: ({ f }) => <PcTopics f={f} />,
  })),
  listed(ALL_IN)(wide({
    id: "topicPeople", page: "topics", title: "Each person's topics",
    hint: ({ f }) => `${periodOf(f)} · the tickets created, by their owner today and their topic - the year's three largest topics and every other · the Back Office team`,
    body: ({ f }) => {
      const tops = topicRows(f).rows.filter((r) => r.key).sort((a, b) => b.cur - a.cur).slice(0, 3);
      const by = new Map<string, Record<string, number>>();
      eachRow(f, "created", (t) => { if (!inTeam(f, t.owner)) return; const x = by.get(t.owner) ?? {}; const k = tops.findIndex((r) => r.key === t.topic); const key = k >= 0 ? `t${k}` : "rest"; x[key] = (x[key] ?? 0) + 1; by.set(t.owner, x); });
      const rows = [...by].sort((a, b) => Object.values(b[1]).reduce((s2, v) => s2 + v, 0) - Object.values(a[1]).reduce((s2, v) => s2 + v, 0)).slice(0, 16);
      return <StackedColumns height={300} format={n0} data={rows.map(([o, x]) => ({ x: shortName(ownerName(f, o)), t0: x.t0 ?? 0, t1: x.t1 ?? 0, t2: x.t2 ?? 0, rest: x.rest ?? 0 }))}
        parts={[...tops.map((t, j2) => ({ key: `t${j2}`, label: t.label })), { key: "rest", label: "Every other topic", color: DEEMPHASIS }]} />;
    },
  })),
  listed(ALL_IN)(wide({
    id: "topicPeopleTable", page: "topics", title: "Each person's topics, in figures",
    hint: ({ f }) => `${periodOf(f)} · the tickets created, by their owner today: the eight largest topics and every other, each with its share of the person's tickets · the owners outside the Back Office together on the last row`,
    body: ({ f }) => <TopicMatrix f={f} head="Person" by={(t) => (inTeam(f, t.owner) ? ownerName(f, t.owner) : "Outside the Back Office")} />,
  })),
  listed(ALL_IN)(wide({
    id: "topicPcTable", page: "topics", title: "Each profit centre's topics, in figures",
    hint: ({ f }) => `${periodOf(f)} · the tickets by their profit centre - their order's, else the articles named on them, else their customer's main one: the eight largest topics and every other, each with its share of the profit centre's tickets`,
    body: ({ f }) => <TopicMatrix f={f} head="Profit centre" by={(_t, r, dd) => pcOfRow(dd, r)} last={notPc} />,
  })),
  listed(ALL_IN)({
    id: "pcPer100", page: "topics", title: "Tickets per 100 orders, by profit centre",
    hint: ({ f }) => `${periodOf(f)} · each profit centre's Back Office tickets against its own orders - where the orders cause the most work`,
    body: ({ f }) => {
      const tickets = new Map<string, number>();
      eachRow(f, "created", (_t, r, i) => { const pc = pcOfRow(f.cur[i].rows!.dict, r); if (pc && !notPc(pc)) tickets.set(pc, (tickets.get(pc) ?? 0) + 1); });
      const orders = new Map(sumField(f, "pcs").map((r) => [r.label, r.cur]));
      const rows = [...tickets].filter(([pc]) => (orders.get(pc) ?? 0) > 0).map(([pc, n]) => ({ label: pc, value: (n / orders.get(pc)!) * 100, secondary: `${int(n)} tickets · ${int(orders.get(pc)!)} orders` })).sort((a, b) => b.value - a.value);
      return <BarList rows={rows} format={(v) => (v == null ? "—" : v.toFixed(1))} labelWidth={150} emptyMessage="The tickets' orders are being read - each month shows as soon as it is counted again." />;
    },
  }),
  listed({ note: "the tickets closed since", keep: (_t, r) => r[RW.close] >= 0 })({
    id: "topicClose", page: "topics", title: "Days to close, by topic",
    hint: ({ f }) => `${periodOf(f)} · tickets created in the period and closed since, on average · topics with 5 or more, the slowest first`,
    body: ({ f }) => <BarList rows={topicSpeed(f, RW.close)} format={days} labelWidth={180} emptyMessage="No ticket closed for this choice." />,
  }),
  listed({ note: "the tickets answered", keep: (_t, r) => r[RW.reply] >= 0 })({
    id: "topicReply", page: "topics", title: "Days to the first reply, by topic",
    hint: ({ f }) => `${periodOf(f)} · to the first agent e-mail reply, on average · topics with 5 or more, the slowest first`,
    body: ({ f }) => <BarList rows={topicSpeed(f, RW.reply)} format={days} labelWidth={180} emptyMessage="No ticket answered for this choice." />,
  }),
  listed({ note: "the tickets closed since", keep: (_t, r) => r[RW.close] >= 0 })(wide({
    id: "topicClosePeople", page: "topics", title: "Days to close, each person by topic",
    hint: ({ f }) => `${periodOf(f)} · each person's tickets created in the period and closed since: days on average, overall and in the five largest topics · green faster than the topic's average by more than a tenth, red slower · (n) the tickets it rests on`,
    body: ({ f }) => <SpeedPeople f={f} col={RW.close} />,
  })),
  listed({ note: "the tickets answered", keep: (_t, r) => r[RW.reply] >= 0 })(wide({
    id: "topicReplyPeople", page: "topics", title: "Days to the first reply, each person by topic",
    hint: ({ f }) => `${periodOf(f)} · to the first agent e-mail reply: days on average, overall and in the five largest topics · green faster than the topic's average by more than a tenth, red slower · (n) the tickets it rests on`,
    body: ({ f }) => <SpeedPeople f={f} col={RW.reply} />,
  })),
  listed(ALL_IN)({
    id: "pcFound", page: "topics", title: "How each ticket's profit centre was found",
    hint: ({ f }) => `${periodOf(f)} · its order's (the order's own, else most of its lines', else its customer's), else the articles named on it, else its customer's main one - and why the rest have none`,
    body: ({ f }) => {
      const by = new Map<string, number>();
      let old = 0;
      eachRow(f, "created", (t, r) => {
        if (r.length <= RW.from) { old++; return; }
        const k = r[RW.from] ? PC_FROM[r[RW.from]] : t.origin === "Automatic & internal" ? "Automatic & internal, no customer" : "No company on the ticket";
        by.set(k, (by.get(k) ?? 0) + 1);
      });
      const tot = [...by.values()].reduce((s2, x) => s2 + x, 0);
      const order = [PC_FROM[1], PC_FROM[2], PC_FROM[3], PC_FROM[4], PC_FROM[5], "No company on the ticket", "Automatic & internal, no customer"];
      return (
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <BarList rows={order.filter((k) => by.has(k)).map((k) => ({ label: k, value: by.get(k)!, secondary: tot ? pct(by.get(k)! / tot) : "" }))} format={(v) => int(v ?? 0)} labelWidth={240} emptyMessage="The tickets are being counted again - each month shows as soon as it is." />
          {old > 0 && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{int(old)} tickets of months not counted again yet are left out until they are.</Typography>}
        </Box>
      );
    },
  }),
  listed({ note: "the tickets filed in Others", keep: (t) => OTHERS.includes(t.topic) })(wide({
    id: "othersKinds", page: "topics", title: "Each kind of Others, month by month",
    hint: ({ f }) => `${periodOf(f)} · a row per kind, the largest first - every month's tickets under its bar`,
    body: ({ f }) => {
      const n = drawn(f);
      const inside = topicRows(f).rows.filter((r) => OTHERS.includes(r.key) && r.cur > 0).sort((a, b) => b.cur - a.cur);
      return <MonthRows labels={f.labels.slice(0, n)} totalHead={f.doneWords || "Total"} rows={inside.map((r) => ({ name: r.label, fmt: int, color: SEQUENTIAL[4], total: int(r.cur), values: f.cur.slice(0, n).map((m) => (hasTickets(m.ym) && !m.pending ? m.topics[r.key] ?? 0 : null)) }))} />;
    },
  })),
  ...dive("dlv", "Delivery", (t) => t === "Delivery", "the biggest topic, with its C2S tickets"),
  ...dive("cxl", "Order cancellations", (t) => t === "Order Cancellation", "the tickets filed Order Cancellation", { tile: "Cancellation tickets" }),
  // Others: no figures of its own, its month by month once (SARCLA 04.11.2026 on "Others in figures": "not needed, doesn't make sense")
  ...dive("oth", "Others", (t) => OTHERS.includes(t), "each kind HubSpot files on its own today", { skip: ["Figs", "Months"] }),
  listed({ note: "the C2S tickets", keep: (_t, r) => r[RW.c2s] === 1 })(wide({
    id: "c2sFunnel", page: "figures", title: "C2S tickets against the cut-to-size orders and their value",
    hint: ({ f }) => {
      const ms = f.cur.slice(f.from, f.done).filter((m) => !m.pending && hasTickets(m.ym) && m.valuePcs);
      const r1 = correlation(ms.map((m) => m.c2s), ms.map((m) => m.valuePcs?.KT ?? null)), r2 = correlation(ms.map((m) => m.c2s), ms.map((m) => m.pcs?.KT ?? null));
      return `Month by month: the KT orders (plastics - the only cut-to-size family), their net value (CHF and EUR as booked), and the C2S tickets · with the value: ${rWords(r1)} · with the orders: ${rWords(r2)}`;
    },
    body: ({ f }) => {
      const n = drawn(f);
      const ms = f.cur.slice(0, n);
      return <MonthRows labels={f.labels.slice(0, n)} rows={[
        { name: "KT orders", values: ms.map((m) => (m.pending ? null : m.pcs?.KT ?? null)), fmt: int, color: SEQUENTIAL[4] },
        { name: "KT orders' net value", values: ms.map((m) => (m.pending || !m.valuePcs ? null : m.valuePcs.KT ?? 0)), fmt: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)} M` : `${Math.round(v / 1000)} k`), color: SERIES[2] },
        { name: "C2S tickets", values: ms.map((m) => (m.pending || !hasTickets(m.ym) || m.c2s == null ? null : m.c2s)), fmt: int, color: SERIES[1] },
        { name: "C2S tickets per 100 KT orders", values: ms.map((m) => (m.pending || !hasTickets(m.ym) || m.c2s == null || !m.pcs?.KT ? null : (m.c2s / m.pcs.KT) * 100)), fmt: (v) => v.toFixed(1), color: SERIES[0] },
      ]} />;
    },
  })),
  listed(ALL_IN)(wide({
    id: "perOrigin", page: "figures", title: "Tickets per 100 orders, by where they came from",
    hint: () => "Each month's tickets from customers, the chat and automatic & internal, against the month's orders",
    body: ({ f }) => {
      const ms = byMonth(f, "created", (t) => t.origin);
      return <StackedColumns height={260} format={(v) => (v == null ? "—" : v.toFixed(1))} parts={originParts}
        data={ms.map((x, i) => { const o = f.cur[i].orders; return { x: f.labels[i], ...Object.fromEntries(ORIGINS.map((k, j) => [`o${j}`, x && o ? ((x[k] ?? 0) / o) * 100 : null])) }; })} />;
    },
  })),
  listed({ note: "the C2S tickets", keep: (_t, r) => r[RW.c2s] === 1 })({
    id: "c2sPerOrder", page: "figures", title: "C2S tickets per 100 orders",
    hint: () => "The cut-to-size tickets against the month's orders - the orders do not say which are cut to size",
    body: ({ f }) => {
      const n = drawn(f);
      const of = (m: BoMonth | null) => (m && !m.pending && hasTickets(m.ym) && m.orders ? (m.c2s / m.orders) * 100 : null);
      const compare = f.prev.slice(0, n).map(of);
      return <MonthTrend values={f.cur.slice(0, n).map(of)} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={(v) => (v == null ? "—" : v.toFixed(2))} />;
    },
  }),
  listed({ note: "the C2S tickets", keep: (_t, r) => r[RW.c2s] === 1 })(trend("c2sT", "figures", "C2S tickets, month by month", "Cut-to-size: a C2S ticket, a problem order, or C2S in the subject", (k) => k.c2s, n0)),
  listed({ note: "the C2S tickets", keep: (_t, r) => r[RW.c2s] === 1 })(trend("c2sShare", "figures", "C2S tickets, their share of all", "Of the month's Back Office tickets, the C2S ones", (k) => (k.created ? (k.c2s ?? 0) / k.created : null), share)),
  listed({ note: "the C2S tickets", keep: (_t, r) => r[RW.c2s] === 1 })({
    id: "c2sTopics", page: "figures", title: "C2S tickets, by type of problem",
    hint: ({ f }) => `${periodOf(f)} · the topic each C2S ticket was filed under`,
    body: ({ f }) => {
      const by = new Map<string, number>();
      eachRow(f, "created", (t, r) => { if (r[RW.c2s] === 1) by.set(topicLabel(t.topic), (by.get(topicLabel(t.topic)) ?? 0) + 1); });
      const all = [...by.values()].reduce((x, y) => x + y, 0);
      return <BarList rows={[...by].sort((a, b) => b[1] - a[1]).map(([label, v]) => ({ label, value: v, secondary: pct(v / all) }))} format={(v) => int(v ?? 0)} labelWidth={180} emptyMessage="No C2S ticket for this choice." />;
    },
  }),
  listed({ note: "the C2S tickets", keep: (_t, r) => r[RW.c2s] === 1 })({
    id: "c2sSpeed", page: "figures", title: "Days to close: C2S tickets against the others",
    hint: () => "Each month's tickets closed since, on average - the C2S ones beside all the others",
    body: ({ f }) => {
      const n = drawn(f);
      const rows = f.cur.slice(0, n).map((m, i) => {
        let a = 0, an = 0, b = 0, bn = 0;
        if (m.rows && !m.pending) for (const r of m.rows.created) { const t = tk(m.rows.dict, r, RW); if (!passes(f.fil, f.co, t) || r[RW.close] < 0) continue; if (r[RW.c2s] === 1) { a += r[RW.close] / 10; an++; } else { b += r[RW.close] / 10; bn++; } }
        return { x: f.labels[i], current: an ? a / an : null, prior: bn ? b / bn : null };
      });
      return <GroupedColumns height={240} format={(v) => (v == null ? "—" : v.toFixed(1))} currentLabel="C2S" priorLabel="Every other ticket" currentFirst data={rows} />;
    },
  }),
  listed({ note: "the C2S tickets", keep: (_t, r) => r[RW.c2s] === 1 })({
    id: "c2sPeople", page: "figures", title: "C2S tickets, by person",
    hint: () => "", body: () => null,
    board: ({ f, d }) => personBoard(f, d, (t, r, _m, into) => { if (r[RW.c2s] === 1) into(t.owner, true); }, { ratio: false, what: "C2S tickets", summary: `${periodOf(f)} against ${prevWords(f)} · each person's C2S tickets, by the ticket's owner` }),
  }),
  listed({ note: "the chat's tickets", keep: (t) => t.origin === "Chat" })(wide({
    id: "chatKinds", page: "figures", title: "Chat tickets, by the first contact",
    hint: () => `From ${CHAT_FROM.split("-").reverse().join(".")} - the chat v3 - each month's tickets the chat handed over, by what the team did first: a call, an e-mail sent, a meeting - or nothing yet, closed or still open`,
    body: ({ f, d }) => {
      const n = drawn(f);
      const data = f.yms.slice(0, n).map((ym, i) => {
        const rs = chatRows(f, d, [ym]);
        const known = !!d.chat?.[ym] && `${ym}-31` >= CHAT_FROM;
        const n = (test: (c: ChatRow) => boolean) => (known ? rs.filter((x) => test(x.c)).length : null);
        return { x: f.labels[i], k1: n((c) => c[2] === 1), k2: n((c) => c[2] === 2 || c[2] === 3), k0c: n((c) => c[2] === 0 && c[7] === 1), k0o: n((c) => c[2] === 0 && c[7] !== 1) };
      });
      return <StackedColumns height={260} format={n0} data={data} parts={[{ key: "k1", label: "A call", color: SERIES[0] }, { key: "k2", label: "An e-mail sent or a meeting", color: SERIES[2] }, { key: "k0c", label: "No contact - closed", color: "#c0571f" }, { key: "k0o", label: "No contact - still open", color: SERIES[3] }]} />;
    },
  })),
  listed({ note: "the chat's tickets", keep: (t) => t.origin === "Chat" })({
    id: "chatHours", page: "figures", title: "Chat tickets: time to the first contact, month by month",
    hint: () => `From ${CHAT_FROM.split("-").reverse().join(".")} - the chat v3 - the middle of each month's first calls, e-mails sent or meetings on the chat's tickets, working hours Mon-Fri 8-17`,
    body: ({ f, d }) => {
      const n = drawn(f);
      const of = (ym: string) => (d.chat?.[ym] && `${ym}-31` >= CHAT_FROM ? median(chatRows(f, d, [ym]).filter((x) => x.c[3] >= 0).map((x) => x.c[3] / 10)) : null);
      const compare = f.yms.slice(0, n).map((ym) => of(back(ym)));
      return <MonthTrend values={f.yms.slice(0, n).map(of)} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={whours} tick={(v) => (v == null ? "" : `${Math.round(v)} h`)} />;
    },
  }),
  listed({ note: "the chat's tickets", keep: (t) => t.origin === "Chat" })({
    id: "chatPeopleHours", page: "figures", title: "Chat: time to the first contact, by person",
    hint: () => "", body: () => null,
    board: ({ f, d }) => chatBoard(f, d, (rs) => median(rs.filter((c) => c[3] >= 0).map((c) => c[3] / 10)), { lower: true, fmt: (v) => `${v.toFixed(1)} h`, sub: (rs) => `the middle of ${int(rs.filter((c) => c[3] >= 0).length)} first contacts · ${int(rs.length)} chat tickets`, summary: `${periodOf(f)} against ${prevWords(f)} · working hours from the ticket to the first call, e-mail sent or meeting` }),
  }),
  listed({ note: "the chat's tickets", keep: (t) => t.origin === "Chat" })({
    id: "chatPeopleCall", page: "figures", title: "Chat: tickets with a call, by person",
    hint: () => "", body: () => null,
    board: ({ f, d }) => chatBoard(f, d, (rs) => (rs.length ? rs.filter((c) => c[4] > 0).length / rs.length : null), { ratio: true, fmt: (v) => `${(v * 100).toFixed(1)}%`, sub: (rs) => `${int(rs.filter((c) => c[4] > 0).length)} of ${int(rs.length)} chat tickets called`, summary: `${periodOf(f)} against ${prevWords(f)} · the share of each person's chat tickets with at least one call` }),
  }),
  listed({ note: "the chat's tickets", keep: (t) => t.origin === "Chat" })({
    id: "chatQuiet", page: "figures", title: "Chat: closed without any activity, by person",
    hint: () => "", body: () => null,
    board: ({ f, d }) => chatBoard(f, d, (rs) => (rs.length ? rs.filter(quietChat).length / rs.length : null), { ratio: true, lower: true, fmt: (v) => `${(v * 100).toFixed(1)}%`, sub: (rs) => `${int(rs.filter(quietChat).length)} of ${int(rs.length)} closed with no call, e-mail sent, meeting or note`, summary: `${periodOf(f)} against ${prevWords(f)} · each person's chat tickets closed with nothing done on them` }),
  }),
  {
    id: "toneNegPeople", page: "figures", title: "Detected tone: negative, by person",
    hint: () => "", body: () => null,
    board: ({ f, d }) => personBoard(f, d, (t, r, m, into) => { const tone = m.rows!.dict[r[RW.tone]]; if (["positive", "neutral", "negative"].includes(tone)) into(t.owner, tone === "negative"); },
      { ratio: true, lower: true, min: 10, what: "scored", summary: `${periodOf(f)} against ${prevWords(f)} · not a survey - of each person's tickets the sentiment sweep scored, the share it heard as negative (10 or more scored)` }),
  },
  {
    id: "tonePosPeople", page: "figures", title: "Detected tone: positive, by person",
    hint: () => "", body: () => null,
    board: ({ f, d }) => personBoard(f, d, (t, r, m, into) => { const tone = m.rows!.dict[r[RW.tone]]; if (["positive", "neutral", "negative"].includes(tone)) into(t.owner, tone === "positive"); },
      { ratio: true, min: 10, what: "scored", summary: `${periodOf(f)} against ${prevWords(f)} · not a survey - of each person's tickets the sentiment sweep scored, the share it heard as positive (10 or more scored)` }),
  },
  trend("ticketsPerHour", "figures", "Tickets per hour worked", "The tickets that came in against the hours typed in for the month", (k) => (k.hoursPerTicket ? 1 / k.hoursPerTicket : null), (v) => (v == null ? "—" : v.toFixed(2)), (v) => (v == null ? "" : v.toFixed(1))),
  listed(ALL_IN)(wide({
    id: "weekday", page: "figures", title: "When the work comes in and goes out, by weekday",
    hint: ({ f }) => `${periodOf(f)} · the tickets by the weekday they came in, and the weekday they were closed`,
    body: ({ f }) => {
      const came = WEEKDAYS.map(() => 0), shut = WEEKDAYS.map(() => 0);
      eachRow(f, "created", (_t, r, i) => { came[weekdayOf(f.cur[i].ym, r[RW.day])]++; });
      eachRow(f, "closed", (_t, r, i) => { shut[weekdayOf(f.cur[i].ym, r[RCL.day])]++; });
      return <GroupedColumns height={240} format={n0} currentLabel="Came in" priorLabel="Closed" currentFirst data={WEEKDAYS.map((x, i) => ({ x, current: came[i], prior: shut[i] }))} />;
    },
  })),
  listed({ closed: true, note: "the tickets closed" })({
    id: "peopleDay", page: "figures", title: "Tickets closed per working day, by person",
    hint: ({ f }) => `${periodOf(f)} · each person's tickets closed against the ${int(workingDays(f))} working days, Monday to Friday`,
    body: ({ f }) => {
      const wd = Math.max(1, workingDays(f));
      return <TeamBars f={f} rows={peopleOf(f).filter((p) => p.closed).sort((a, b) => b.closed - a.closed).map((p) => ({ id: p.id, label: p.name, value: p.closed / wd, secondary: `${int(p.closed)} closed` }))} format={(v) => (v == null ? "—" : v.toFixed(1))} empty="No ticket closed for this choice." />;
    },
  }),
  wide({
    id: "overall", page: "figures", title: "Which types of problem, per profit centre",
    hint: ({ f }) => `${periodOf(f)} · the Back Office's tickets by their profit centre - their order's, else the articles named on them, else their customer's main one - on to their type of problem - every figure a total`,
    body: ({ f }) => <PcTopics f={f} />,
  }),
  wide({
    id: "csat", page: "figures", title: "Survey: the answers month by month",
    hint: () => "The customers' answers to the survey sent at random after a Back Office ticket is closed - by the month they answered; the ticket filters do not apply",
    body: ({ f, d }) => <StackedColumns height={260} format={n0} data={surveyMonths(f, d).map((x, i) => ({ x: f.labels[i], ...x }))} parts={FEELINGS} />,
  }),
  {
    id: "csatScore", page: "figures", title: "Survey: happy customers, month by month",
    hint: () => "Of the month's answers to the survey after a closed ticket, the share happy",
    body: ({ f, d }) => {
      const share = (x: Record<string, number>) => { const n = x.happy + x.neutral + x.unhappy; return n ? x.happy / n : null; };
      const cur = surveyMonths(f, d).map(share), prev = surveyMonths(f, d, true).map(share);
      return <MonthTrend values={cur} compare={prev.some((x) => x != null) ? prev : null} labels={f.labels.slice(0, drawn(f))} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={share0} />;
    },
  },
  {
    id: "surveyPeople", page: "figures", title: "Survey: happy customers, by person",
    hint: ({ f }) => `${periodOf(f)} · the answers by the owner of the ticket they were about · the share happy, and how many answered`,
    body: ({ f, d }) => {
      const owner = ownersOfTickets(d);
      const first = f.yms[0] ?? "", last = f.yms[f.yms.length - 1] ?? "";
      const by = new Map<string, { h: number; n: number }>();
      for (const x of d.surveys ?? []) {
        const ym = x.day.slice(0, 7), fl = feelingOf(x);
        if (ym < first || ym > last || !fl) continue;
        const o = owner.get(x.ticket ?? "") ?? "";
        const y = by.get(o) ?? { h: 0, n: 0 };
        y.n++; if (fl === "happy") y.h++;
        by.set(o, y);
      }
      return <TeamBars f={f} rows={[...by].sort((a, b) => b[1].n - a[1].n).map(([id, y]) => ({ id, label: ownerName(f, id), value: y.h / y.n, secondary: `${int(y.n)} answered` }))} format={share0} empty="No answer in these months." />;
    },
  },
  {
    id: "tonePeople", page: "figures", title: "Detected tone: negative, by person",
    hint: ({ f }) => `${periodOf(f)} · not a survey - of each person's tickets the sentiment sweep scored, the share it heard as negative`,
    body: ({ f }) => {
      const by = new Map<string, { neg: number; n: number }>();
      eachRow(f, "created", (t, r, i) => {
        const tone = f.cur[i].rows!.dict[r[RW.tone]];
        if (!["positive", "neutral", "negative"].includes(tone)) return;
        const y = by.get(t.owner) ?? { neg: 0, n: 0 };
        y.n++; if (tone === "negative") y.neg++;
        by.set(t.owner, y);
      });
      return <TeamBars f={f} rows={[...by].sort((a, b) => b[1].n - a[1].n).map(([id, y]) => ({ id, label: ownerName(f, id), value: y.neg / y.n, secondary: `${int(y.n)} scored` }))} format={share0} empty="No ticket scored for this choice." />;
    },
  },
  wide({
    id: "surveyTable", page: "figures", title: "Survey: every answer",
    hint: ({ f }) => `${periodOf(f)} · the newest first · what the customer wrote, and the ticket it was about`,
    body: ({ f, d }) => <SurveyTable f={f} d={d} />,
  }),
  listed({ note: "the tickets closed since", keep: (_t, r) => r[RW.close] >= 0 })({
    id: "closeByTopic", page: "figures", title: "Days to close, by topic",
    hint: ({ f }) => `${periodOf(f)} · tickets created in the period and closed since, on average · topics with 5 or more, the slowest first`,
    body: ({ f }) => <BarList rows={topicSpeed(f, RW.close)} format={days} labelWidth={180} emptyMessage="No ticket closed for this choice." />,
  }),
  listed({ note: "the tickets answered", keep: (_t, r) => r[RW.reply] >= 0 })({
    id: "replyByTopic", page: "figures", title: "Days to the first reply, by topic",
    hint: ({ f }) => `${periodOf(f)} · to the first agent e-mail reply, on average · topics with 5 or more, the slowest first`,
    body: ({ f }) => <BarList rows={topicSpeed(f, RW.reply)} format={days} labelWidth={180} emptyMessage="No ticket answered for this choice." />,
  }),
  {
    id: "pcLines", page: "figures", title: "Order lines per profit centre",
    own: ({ f }, box) => {
      const rows = sumField(f, "linePcs");
      return <DimChart {...box} rows={rows} cur={(r) => r.cur} prev={(r) => r.prev} curLabel={`${f.doneWords} ${f.year}`} prevLabel={f.totalPrev ? `${f.doneWords} ${f.year - 1}` : ""} single={!f.totalPrev || rows.every((r) => !r.prev)} fmt={int} />;
    },
  },
  listed({ note: "the tickets closed since", keep: (_t, r) => r[RW.close] >= 0 })(trend("resolution", "figures", "Days to close", "Tickets created in the month and closed since, on average", (k) => k.resolution, days, daysTick)),
  listed({ note: "the tickets answered", keep: (_t, r) => r[RW.reply] >= 0 })(trend("reply", "figures", "Days to the first reply", "To the first agent e-mail reply, tickets created in the month", (k) => k.firstReply, days, daysTick)),
  trend("hours", "figures", "Hours worked", "Typed in per month (Abacus) - not in HubSpot", (k) => k.hours, hrs),
  trend("perHour", "figures", "Hours per ticket", "Hours worked against the tickets created - where the hours are typed in", (k) => k.hoursPerTicket, (v) => (v == null ? "—" : `${v.toFixed(2)} h`), (v) => (v == null ? "" : v.toFixed(2))),
  trend("orders", "figures", "Orders", "By order date - an order number once whatever its deliveries", (k) => k.orders, n0),
  trend("lines", "figures", "Order lines", "Per order, the lines of its largest delivery", (k) => k.lines, n0),
  trend("perOrder", "figures", "Tickets per order", "Tickets created against the month's orders (an order number once, credit notes out)", (k) => k.perOrder, share),
  trend("perLine", "figures", "Tickets per order line", "Tickets created against the month's order lines", (k) => k.perLine, share),
  listed(ALL_IN)(wide({
    id: "tones", page: "figures", title: "Detected tone: the tickets month by month",
    hint: () => "Not a survey: the hub's sentiment sweep reads each ticket's e-mails and scores the tone it hears - the tickets it could not score left out",
    body: ({ f }) => {
      const n = drawn(f);
      const of = (m: BoMonth, k: string) => (m.pending || !hasTickets(m.ym) ? null : m.tones?.[k] ?? 0);
      return <StackedColumns height={260} format={n0} data={f.cur.slice(0, n).map((m, i) => ({ x: f.labels[i], positive: of(m, "positive"), neutral: of(m, "neutral"), negative: of(m, "negative") }))}
        parts={[{ key: "positive", label: "Positive", color: SERIES[2] }, { key: "neutral", label: "Neutral", color: DEEMPHASIS }, { key: "negative", label: "Negative", color: TONE_RED }]} />;
    },
  })),
  trend("neutral", "figures", "Detected tone: neutral", "Not a survey - of the tickets the sentiment sweep scored, the share it heard as neutral", (k) => k.neutral, share),
  trend("negative", "figures", "Detected tone: negative", "Not a survey - of the tickets the sentiment sweep scored, the share it heard as negative", (k) => k.negative, share),
  {
    id: "pcs", page: "figures", title: "Orders per profit centre",
    own: ({ f }, box) => <DimChart {...box} rows={sumField(f, "pcs")} cur={(r) => r.cur} prev={(r) => r.prev} curLabel={`${f.doneWords} ${f.year}`} prevLabel={f.totalPrev ? `${f.doneWords} ${f.year - 1}` : ""} single={!f.totalPrev} fmt={int} />,
  },

  /* Topics - the workbook's "BO tickets per topic" */
  listed(ALL_IN)(wide({
    id: "topicBoard", page: "topics", title: "Every topic in figures",
    figure: ({ f }) => (f.total.created == null ? null : `${n0(f.total.created)} tickets`),
    hint: ({ f }) => `${periodOf(f)} · the topic each ticket has today: how many${f.totalPrev?.created != null ? ` (the change against ${f.doneWords} ${f.year - 1})` : ""}, against the orders, the C2S ones, how fast, the customers left without an answer, the value of the orders they are about, their main profit centre · click a topic to follow it month by month below, a header to sort`,
    body: ({ f, picked, pick }) => {
      const compare = f.totalPrev?.created != null;
      const cur = groups(f, (t) => topicLabel(t.topic)), prev = compare ? groups(f, (t) => topicLabel(t.topic), "prev") : null;
      return <AggTable f={f} rows={[...cur].map(([label, a]) => ({ label, a, p: prev?.get(label) ?? null }))} first="Topic" pick={pick} picked={picked} compare={compare} />;
    },
  })),
  listed(ALL_IN)({
    id: "topics", page: "topics", title: "Tickets per topic", tall: true,
    own: ({ f, picked, pick }, box) => {
      const { compare, rows } = topicRows(f);
      return <DimChart {...box} rows={rows.filter((r) => r.cur > 0 || r.prev > 0)} cur={(r) => r.cur} prev={(r) => r.prev} curLabel={f.doneWords ? `${f.doneWords} ${f.year}` : String(f.year)} prevLabel={compare ? `${f.doneWords} ${f.year - 1}` : ""}
        single={!compare} fmt={int} selected={picked} onPick={pick} pickHint="Click topics to follow them month by month, beside" pageSize={10} />;
    },
  }),
  listed(ALL_IN)({
    id: "topicPer100", page: "topics", title: "Per 100 orders, month by month", hint: ({ picked }) => `${picked?.length ? picked.join(", ") : "Every topic"} - the month's tickets against its orders`,
    body: ({ f, picked }) => {
      const { all } = topicRows(f);
      const keys = picked?.length ? all.filter((t) => picked.includes(topicLabel(t))) : all;
      const of = (m: BoMonth | null) => (m && hasTickets(m.ym) && !m.pending && m.orders ? (keys.reduce((s, t) => s + (m.topics[t] ?? 0), 0) / m.orders) * 100 : null);
      const n = drawn(f);
      return <MonthTrend values={f.cur.slice(0, n).map(of)} compare={f.prev.some((x) => x && hasTickets(x.ym)) ? f.prev.slice(0, n).map(of) : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={d1} />;
    },
  }),
  listed(ALL_IN)({
    id: "topicMonths", page: "topics", title: "Month by month", hint: ({ picked }) => `${picked?.length ? picked.join(", ") : "Every topic"} - the topic each ticket has today; tickets re-filed since move with it`,
    body: ({ f, picked }) => {
      const { all } = topicRows(f);
      const keys = picked?.length ? all.filter((t) => picked.includes(topicLabel(t))) : all;
      const pickN = (m: BoMonth | null) => (m && hasTickets(m.ym) && !m.pending ? keys.reduce((s, t) => s + (m.topics[t] ?? 0), 0) : null);
      const n = drawn(f);
      return <MonthTrend values={f.cur.slice(0, n).map(pickN)} compare={f.prev.some((x) => x && hasTickets(x.ym)) ? f.prev.slice(0, n).map(pickN) : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={n0} />;
    },
  }),
  listed(ALL_IN)(wide({
    id: "topicMinis", page: "topics", title: "Each topic, month by month",
    hint: ({ f }) => `${periodOf(f)} · a row per topic, the largest first, each on its own scale - every month's tickets under its bar · the period's total at the end${f.totalPrev?.created != null ? `, with the change against the same months of ${f.year - 1}` : ""}`,
    body: ({ f }) => {
      const { compare, rows } = topicRows(f);
      const n = drawn(f), tot = rows.reduce((s2, r) => s2 + r.cur, 0);
      return <MonthRows labels={f.labels.slice(0, n)} totalHead={f.doneWords || "Total"} rows={rows.filter((r) => r.cur > 0).sort((a, b) => b.cur - a.cur).map((r, j) => ({
        name: r.label, sub: tot ? `${pct(r.cur / tot)} of the tickets` : undefined, fmt: int, color: j === 0 ? SERIES[0] : SEQUENTIAL[4],
        values: f.cur.slice(0, n).map((m) => (hasTickets(m.ym) && !m.pending ? m.topics[r.key] ?? 0 : null)),
        total: <span>{int(r.cur)}{compare && r.prev ? <Box component="span" sx={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: tone(changeOf(r.cur, r.prev), true) }}>{signedPct(changeOf(r.cur, r.prev))}</Box> : null}</span>,
      }))} />;
    },
  })),
  listed(ALL_IN)(wide({
    id: "topicShare", page: "topics", title: "Each month's tickets by topic",
    hint: () => "The year's three largest topics and every other together, as a share of the month's tickets",
    body: ({ f }) => {
      const { rows } = topicRows(f);
      const top = [...rows].filter((r) => r.key).sort((a, b) => b.cur - a.cur).slice(0, 3);
      const n = drawn(f);
      const data = f.cur.slice(0, n).map((m, i) => {
        const ok = hasTickets(m.ym) && !m.pending;
        const tot = ok ? Object.values(m.topics).reduce((s, x) => s + x, 0) : 0;
        const row: Record<string, string | number | null> & { x: string } = { x: f.labels[i] };
        let rest = tot;
        top.forEach((t, j) => { const v = m.topics[t.key] ?? 0; rest -= v; row[`t${j}`] = ok && tot ? v / tot : null; });
        row.rest = ok && tot ? rest / tot : null;
        return row;
      });
      return <StackedColumns height={260} format={(v) => (v == null ? "—" : `${Math.round(v * 100)}%`)} data={data} parts={[...top.map((t, j) => ({ key: `t${j}`, label: t.label })), { key: "rest", label: "Every other topic", color: DEEMPHASIS }]} />;
    },
  })),
  listed({ note: "the tickets filed Delivery", keep: (t) => t.topic === "Delivery" })(wide(topicTrend("delivery", "Delivery tickets", ["Delivery"], "The biggest topic"))),
  listed({ note: "the C2S tickets", keep: (_t, r) => r[RW.c2s] === 1 })(trend("c2s", "topics", "C2S tickets", "Cut-to-size: a C2S ticket, a problem order, or C2S in the subject - the first impact of C2S V1 and V2", (k) => k.c2s, n0)),
  listed({ note: "the C2S tickets filed Delivery", keep: (t, r) => r[RW.c2s] === 1 && t.topic === "Delivery" })(trend("c2sDelivery", "topics", "C2S tickets filed Delivery", "The C2S tickets among Delivery", (k) => k.c2sDelivery, n0)),
  listed({ note: "the tickets filed Order Cancellation", keep: (t) => t.topic === "Order Cancellation" })(topicTrend("cancel", "Order cancellations", ["Order Cancellation"], "Tickets filed Order Cancellation")),
  topicTrend("cancelPerOrder", "Order cancellations per order", ["Order Cancellation"], "Cancellation tickets against the month's orders", true),
  listed({ note: "the tickets filed in Others", keep: (t) => OTHERS.includes(t.topic) })({
    id: "othersWhat", page: "topics", title: "What is inside Others",
    hint: ({ f }) => `${f.doneWords} ${f.year} · each kind HubSpot files on its own today, the largest first`,
    body: ({ f }) => {
      const inside = topicRows(f).rows.filter((r) => OTHERS.includes(r.key) && r.cur > 0).sort((a, b) => b.cur - a.cur);
      const tot = inside.reduce((s, r) => s + r.cur, 0);
      return <BarList rows={inside.map((r) => ({ label: r.label, value: r.cur, secondary: tot ? pct(r.cur / tot) : "" }))} format={(v) => int(v ?? 0)} labelWidth={180} emptyMessage="Nothing in Others for these months." />;
    },
  }),
  listed({ note: "the tickets filed in Others", keep: (t) => OTHERS.includes(t.topic) })(topicTrend("othersMonths", "Others, month by month", OTHERS, "Every kind of Others together")),

  /* ESO & TSA tickets - the workbook's inbound table */
  wide(trend("eso", "sales-tickets", "ESO tickets", "The ESO's inbound tickets - the sales actions left out", (k) => k.eso, n0)),
  trend("esoO", "sales-tickets", "ESO tickets per order", "Inbound against the month's orders", (k) => k.esoPerOrder, share),
  trend("esoL", "sales-tickets", "ESO tickets per order line", "Inbound against the month's order lines", (k) => k.esoPerLine, share),
  wide(trend("tsa", "sales-tickets", "TSA tickets", "The TSA's inbound tickets - the sales actions left out", (k) => k.tsa, n0)),
  trend("tsaO", "sales-tickets", "TSA tickets per order", "Inbound against the month's orders", (k) => k.tsaPerOrder, share),
  trend("tsaL", "sales-tickets", "TSA tickets per order line", "Inbound against the month's order lines", (k) => k.tsaPerLine, share),
  ...inCharts("eso"), ...inCharts("tsa"),
  wide({
    id: "stack", page: "sales-tickets", title: "APSOparts' tickets, built up by team",
    hint: ({ f }) => `Back Office, the ESO's and the TSA's inbound, and every other pipeline (GQS and the others) on top${f.inbound ? "" : " · the ESO's and the TSA's sales actions still in, until ESO Reports' ticket read is in"}`,
    body: ({ f }) => {
      const n = drawn(f);
      return <StackedColumns height={280} format={n0}
        data={f.cur.slice(0, n).map((m, i) => { const ok = hasTickets(m.ym) && !m.pending; return { x: f.labels[i], bo: ok ? m.created : null, eso: ok ? m.eso : null, tsa: ok ? m.tsa : null, other: ok ? Math.max(0, m.all - m.created - m.eso - m.tsa) : null }; })}
        parts={[{ key: "bo", label: "Back Office" }, { key: "eso", label: "ESO inbound" }, { key: "tsa", label: "TSA inbound" }, { key: "other", label: "Every other pipeline", color: DEEMPHASIS }]} />;
    },
  }),
  trend("all", "sales-tickets", "All APSOparts tickets", "Every pipeline - Back Office, ESO, TSA, GQS and the others - without the ESO's and the TSA's sales actions", (k) => k.all, n0),
  trend("allO", "sales-tickets", "All tickets per order", "Against the month's orders", (k) => k.allPerOrder, share),
  trend("allL", "sales-tickets", "All tickets per order line", "Against the month's order lines", (k) => k.allPerLine, share),

  /* GQS - the whole pipeline (gqCharts), the requests and the two speeds counted from the start beside it */
  trend("gqs", "gqs", "GQS requests", "Back Office - Special Tasks GQS, by the month they came in", (k) => k.gqsCreated, n0),
  ...gqCharts(),
  trend("gqsSent", "gqs", "Days before sent to GQS", "From entering Open the GQS Task to entering Waiting on GQS - or Waiting on APSO, where a task was put by mistake - on average", (k) => k.gqsSent, days, daysTick),
  trend("gqsDone", "gqs", "Days to close", "HubSpot's time to close - to the offer sent to Sales, or refused; the tasks closed so far", (k) => k.gqsResolution, days, daysTick),

  /* OTD and KPI autonomy - counted from the ERP's order lines, the typed figures beside them */
  ...elCharts(),
  ...el2Charts(),
  ...logicCharts(),
  /* OTD > Delivery speed - from the ERP's order file */
  ...dvCharts(),

  /* KPI autonomy > Manual prices - the shop's prices against the ERP's */
  ...prCharts(),

  /* Stopped orders - typed in */
  {
    id: "stopped", page: "stopped", title: "Stopped orders, month by month", hint: () => "Of the Magento orders transferred to the Back Office, the share stopped",
    figure: ({ f, d }) => { const v = meanOf(f.yms.slice(f.from, Math.max(f.done, f.from + 1)).map((ym) => stoppedShare(d, ym))); return v == null ? null : share(v); },
    body: ({ f, d }) => {
      const n = f.year === Number(d.current.slice(0, 4)) ? drawn(f) : f.yms.length;
      const values = f.yms.slice(0, n).map((ym) => stoppedShare(d, ym)), compare = f.yms.slice(0, n).map((ym) => stoppedShare(d, back(ym)));
      return <MonthTrend values={values} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={share} />;
    },
  },
  {
    id: "stoppedWhy", page: "stopped", title: "Why orders are stopped", hint: ({ f }) => `${f.year} so far - the top reasons as typed in · the action planned on credit limits: review with the accounts the limits set`,
    body: ({ f, d }) => {
      const st = sumTyped(d, "stopped.stopped", f.yms);
      const rows = [["credit", "Credit limit"], ["denomination", "Denomination"], ["price", "Price missing"]].map(([k, label]) => ({ label, value: sumTyped(d, `stopped.${k}`, f.yms) }));
      return <BarList rows={rows.map((r) => ({ ...r, secondary: st ? `${pct(r.value / st)} of the stopped` : "" }))} format={(v) => int(v ?? 0)} labelWidth={160} emptyMessage="Nothing typed in for this year yet." />;
    },
  },
];
const chartKey = (c: ChartDef) => `bo-${c.page}:main:${c.id}`;
/** by its key - a graph of "OTD & autonomy" (until 03.11.2026) by its id, now on KPI autonomy or Stopped orders */
const chartByKey = (key: string) => CHARTS.find((c) => chartKey(c) === key) ?? CHARTS.find((c) => key === `bo-otd:main:${c.id}`);

/** A graph with its Actions - on its page, or in the BUC View. */
function Card({ def, c, where }: { def: ChartDef; c: Ctx; where: "tab" | "nutshell" }) {
  // the summary opens with the graph's figure for the period shown - "21,526 · Tickets created, Jan–Oct 2026"
  const fig = def.figure?.(c) ?? null;
  const summary = fig ? `${fig} · ${def.title}, ${periodOf(c.f)}` : undefined;
  const actions = <TileActions where={where} start="tab" edge={2} tile={{ key: chartKey(def), page: `bo-${def.page}`, tab: "main", title: def.title, kind: "card", href: hrefOf(def.page), summary }} />;
  if (def.board) {
    const b = def.board(c);
    return (
      <Leaderboard title={def.title} summary={b.summary} rows={b.rows} curLabel={periodOf(c.f)} prevLabel={b.prevLabel} first={12} fmt={b.fmt} diff={b.diff} ratio={!!b.ratio}
        lowerIsBetter={!!b.lower} ascending={!!b.lower} noChange={b.noChange} actions={actions} companies={def.list ? ticketsOf(c.f, chartKey(def), def.list) : undefined}
        unranked={b.others.length ? { why: `${b.others.length} owner${b.others.length === 1 ? "" : "s"} outside the Back Office - tickets that may sit with the wrong person`, rows: b.others } : undefined} />
    );
  }
  if (def.own) return <>{def.own(c, { title: def.title, actions, companies: def.list ? ticketsOf(c.f, chartKey(def), def.list) : undefined })}</>;
  const box = <ChartBox title={def.title} hint={def.hint?.(c)} actions={actions}>{def.body?.(c)}</ChartBox>;
  return def.list ? <CompaniesFor source={ticketsOf(c.f, chartKey(def), def.list)}>{box}</CompaniesFor> : box;
}

/* ── a tab per question, one card that follows it (as ESO's ticket pages) ── */

type TabDef = { id: string; label: string; title: string; note: string; icon: React.ReactNode; tint: Tint; charts: string[];
  /** graphs the filters do not reach (OTD > Delivery speed: deliveries, not tickets) - no "Filter these graphs" on them */
  unfiltered?: boolean;
  /** the tab's figures wait for data we do not have yet - said above its graphs (SARCLA 07.11.2026); null once it is in */
  warn?: string | ((d: Data) => string | null) };
/** the workbook's table, a tab of its own (SARCLA 03.11.2026: "the table should be a separate tab", "not on every page") */
const TABLE = (note: string): TabDef => ({ id: "table", label: "Table", title: "All the figures, month by month", note, icon: <TableChartOutlinedIcon />, tint: "slate", charts: [] });
const TYPE_IN: TabDef = { id: "input", label: "Type in", title: "Typed in by the Back Office", note: "not in HubSpot - a month typed in saves when you leave the field", icon: <EditNoteOutlinedIcon />, tint: "slate", charts: [] };
const TABS: Record<Slug, TabDef[]> = {
  figures: [
    TABLE("every KPI, a month a column - the last columns add up the complete months"),
    { id: "volume", label: "Volume", title: "Tickets created and closed", note: "what came in and from where, what was closed, the queue between them", icon: <ConfirmationNumberOutlinedIcon />, tint: "blue", charts: ["createdClosed", "backlog", "origins", "created", "chat"] },
    { id: "people", label: "People", title: "Who handles the tickets", note: "each ticket's owner today: what came in to them and from where, what they closed - the Back Office team, the other owners folded", icon: <BadgeOutlinedIcon />, tint: "green", charts: ["peopleOrigin", "peopleClosed", "peopleMonths"] },
    { id: "speed", label: "Speed", title: "How fast", note: "days to the first reply and to close, the customers' tickets closed without any answer - by month, person and topic", icon: <TimerOutlinedIcon />, tint: "amber", charts: ["reply", "resolution", "noAnswer", "noAnswerPeople", "peopleReply", "peopleSpeed", "replyByTopic", "closeByTopic"] },
    { id: "workload", label: "Workload", title: "The team's workload", note: "the hours (typed in on the Table, from Abacus) against the tickets, when the work comes in, what each person closes a working day", icon: <WorkHistoryOutlinedIcon />, tint: "purple", charts: ["weekday", "peopleDay", "ticketsPerHour", "hours", "perHour"] },
    { id: "ratios", label: "Orders & ratios", title: "Tickets against the orders", note: "an order number once, credit notes out · its profit centre the one it names, else most of its lines' (Products & Pricing's for an article no line names), else its customer's main one", icon: <ShoppingCartOutlinedIcon />, tint: "green", charts: ["overall", "perOrigin", "pcs", "pcLines", "perOrder", "perLine", "orders", "lines"] },
    { id: "c2s", label: "C2S", title: "C2S - cut to size", note: "the cut-to-size tickets: how many, their share, what they are about, how fast they close, who has them", icon: <ContentCutOutlinedIcon />, tint: "pink", charts: ["c2sFunnel", "c2sT", "c2sShare", "c2sPerOrder", "c2sSpeed", "c2sTopics", "c2sPeople"] },
    { id: "chat", label: "Chat handling", title: "The chat's tickets", note: "the tickets the chat handed over: what the team did first, how fast, the calls, and those closed with nothing done", icon: <SupportAgentOutlinedIcon />, tint: "purple", charts: ["chatKinds", "chatHours", "chat", "chatPeopleHours", "chatPeopleCall", "chatQuiet"] },
    { id: "survey", label: "Survey", title: "Survey after a closed ticket", note: "what the customers answered to the survey sent at random after a Back Office ticket is closed", icon: <SentimentNeutralOutlinedIcon />, tint: "green", charts: ["csat", "csatScore", "surveyPeople", "surveyTable"] },
    { id: "tone", label: "Detected tone", title: "Detected tone", note: "not a survey: the tone the hub's sentiment sweep hears in each ticket's e-mails", icon: <SentimentNeutralOutlinedIcon />, tint: "slate", charts: ["tones", "negative", "neutral", "toneNegPeople", "tonePosPeople"] },
  ],
  topics: [
    TABLE("Back Office tickets per topic, by the month they came in"),
    { id: "all", label: "All topics", title: "Tickets per topic", note: "the bars - click topics to follow them month by month - then every topic in figures", icon: <CategoryOutlinedIcon />, tint: "amber", charts: ["topics", "topicMonths", "topicPer100", "topicBoard"] },
    { id: "months", label: "Month by month", title: "Each topic, month by month", note: "the mix of each month, then every month's figure of every topic", icon: <BarChartOutlinedIcon />, tint: "blue", charts: ["topicShare", "topicMinis"] },
    { id: "people", label: "By person", title: "Each person's topics", note: "the topics each person of the Back Office handles", icon: <BadgeOutlinedIcon />, tint: "green", charts: ["topicPeople", "topicPeopleTable"] },
    { id: "pcs", label: "By profit centre", title: "Topics per profit centre", note: "each ticket's profit centre - its order's, else the articles named on it, else its customer's main one", icon: <ApartmentOutlinedIcon />, tint: "blue", charts: ["topicPcs", "pcFound", "pcPer100", "topicPcTable"] },
    { id: "speed", label: "Speed", title: "How fast, per topic and per person", note: "days to close and to the first reply, per topic - and each person in each topic", icon: <TimerOutlinedIcon />, tint: "amber", charts: ["topicClose", "topicReply", "topicClosePeople", "topicReplyPeople"] },
    { id: "delivery", label: "Delivery", title: "Delivery in depth", note: "the biggest topic: its figures, month by month, per profit centre, per article, per person, per customer - C2S and the value of the orders throughout", icon: <LocalShippingOutlinedIcon />, tint: "pink", charts: ["dlvFigs", "dlvMonths", "dlvPcs", "dlvArts", "dlvPeople", "dlvCos"] },
    { id: "cancel", label: "Order cancellations", title: "Order cancellations in depth", note: "its figures, month by month, per profit centre, per article, per person, per customer - in value", icon: <CancelOutlinedIcon />, tint: "purple", charts: ["cxlFigs", "cxlMonths", "cxlPcs", "cxlArts", "cxlPeople", "cxlCos"] },
    { id: "others", label: "Inside Others", title: "What is inside Others", note: "each kind on its own, month by month - and per profit centre, per article, per person, per customer", icon: <ManageSearchOutlinedIcon />, tint: "slate", charts: ["othersWhat", "othersMonths", "othersKinds", "othPcs", "othArts", "othPeople", "othCos"] },
  ],
  "sales-tickets": [
    TABLE("the ESO's and the TSA's inbound tickets against the month's orders and order lines"),
    { id: "eso", label: "ESO", title: "The ESO's inbound tickets", note: "the sales actions left out: how many, the win rate, how fast the first contact came, what became of them - per channel and per person", icon: <GroupsOutlinedIcon />, tint: "blue", charts: ["esoFigs", "eso", "esoWin", "esoDay", "esoOut", "esoFirst", "esoQuiet", "esoO", "esoL", "esoCh", "esoWho"] },
    { id: "tsa", label: "TSA", title: "The TSA's inbound tickets", note: "the sales actions left out: how many, the win rate, how fast the first contact came, what became of them - per channel and per person", icon: <SupportAgentOutlinedIcon />, tint: "green", charts: ["tsaFigs", "tsa", "tsaWin", "tsaDay", "tsaOut", "tsaFirst", "tsaQuiet", "tsaO", "tsaL", "tsaCh", "tsaWho"] },
    { id: "all", label: "APSOparts in total", title: "Every ticket of APSOparts", note: "every pipeline, the ESO's and the TSA's sales actions left out", icon: <ApartmentOutlinedIcon />, tint: "purple", charts: ["stack", "allO", "allL"] },
  ],
  gqs: [
    TABLE("every GQS figure, a month a column - requests by the month they came in, offers by the month first sent, refusals by the month refused"),
    { id: "pipeline", label: "Pipeline", title: "The GQS pipeline", note: "from the request to the result: how many, how each was approved, where they stand, the offers sent and won", icon: <AssignmentOutlinedIcon />, tint: "green", charts: ["gqFigs", "gqFlow", "gqs", "gqOffers", "gqWhere", "gqOpenStage"] },
    { id: "approval", label: "Approval", title: "The approval", note: "approved by the rule or sent to a line manager, why, and how fast each line manager decides", icon: <VerifiedOutlinedIcon />, tint: "purple", charts: ["gqAp", "gqApShare", "gqApHours", "gqApWhy", "gqApLm"] },
    { id: "results", label: "Offers & results", title: "The offers and what came of them", note: "the offers sent to Sales by the day sent: won, lost, the win rate, the value - then the requests refused, with the reasons", icon: <EmojiEventsOutlinedIcon />, tint: "green", charts: ["gqResult", "gqWin", "gqValue", "gqRefused", "gqReasons"] },
    { id: "speed", label: "Speed", title: "How long each step takes", note: "the days in each stage - the Back Office, GQS, the customer - the days to the offer, the reminders", icon: <TimerOutlinedIcon />, tint: "amber", charts: ["gqStages", "gqToOffer", "gqBoDays", "gqAtGqs", "gqsSent", "gqsDone", "gqRemind", "gqStageTable"] },
    { id: "types", label: "Type of request", title: "Per type of request", note: "running business and each profit centre's new business: how many, the offers, won, the value", icon: <CategoryOutlinedIcon />, tint: "blue", charts: ["gqTypeMix", "gqTypeWin", "gqTypeTable"] },
    { id: "people", label: "People", title: "Who asks, who handles", note: "the requesters in Sales, their line managers - win rate and potential won -, the Back Office person on each task, the customers", icon: <BadgeOutlinedIcon />, tint: "green", charts: ["gqReqBars", "gqOwnBars", "gqLmWin", "gqLmPot", "gqReq", "gqApLm", "gqOwn", "gqCust"] },
    { id: "open", label: "Open tasks", title: "Every GQS task open now", note: "whatever the period: where each one waits and since when, per Back Office person, requester and line manager - and those whose sale is already won or lost", icon: <HourglassEmptyOutlinedIcon />, tint: "pink", charts: ["gqOpenStage", "gqOpenOwn", "gqOpenReq", "gqOpenLm", "gqOpenList"] },
  ],
  otd: [
    { id: "online", label: "On time", title: "OTD online", note: "the eShop order lines shipped, counted from the ERP every night: on time when the shipment plus the ERP's transport time to the country reaches the first confirmed date · by the month of that date · the Back Office's typed figures beside them · the filters do not apply here", icon: <LocalShippingOutlinedIcon />, tint: "pink", unfiltered: true,
      charts: ["otdFigs", "otdAll", "otdStandard", "otdSpecial", "otdPushed", "otdMonths", "otdSources"] },
    { id: "pcs", label: "Profit centres", title: "OTD per profit centre", note: "standard and special articles, counted from the ERP · the filters do not apply here", icon: <ApartmentOutlinedIcon />, tint: "blue", unfiltered: true, charts: ["otdMinis", "otdPc"] },
    { id: "late", label: "Late lines", title: "Where and how late", note: "the lines that arrived after their first confirmed date: per country, how late, and each one of the last 3 months · the filters do not apply here", icon: <EventRepeatOutlinedIcon />, tint: "amber", unfiltered: true, charts: ["otdCountry", "otdLate", "otdList"] },
    { id: "suppliers", label: "Suppliers", title: "OTD per supplier", note: "the eShop lines shipped, by each article's main supplier in the ERP: on time, who the late lines come from, the main ones month by month · the filters do not apply here", icon: <FactoryOutlinedIcon />, tint: "blue", unfiltered: true, charts: ["otdSupplier", "otdSupplierLate", "otdSupplierMonths"] },
    { id: "open", label: "Open lines", title: "Open lines to act on", note: "the lines not shipped yet whose first confirmed date has passed or comes within 3 working days - every order source, as the morning file had them", icon: <PendingActionsOutlinedIcon />, tint: "pink", unfiltered: true, charts: ["openFigs", "openList"] },
    { id: "lead", label: "Lead time", title: "Promised lead time", note: "the working days from the order to the first confirmed date: what we promise, month by month and per profit centre · the filters do not apply here", icon: <HourglassEmptyOutlinedIcon />, tint: "green", unfiltered: true, charts: ["leadMonths", "leadBands", "leadPc"] },
    { id: "logic", label: "How it's counted", title: "How OTD is counted", note: "the rule, the ERP's dates it reads and the transport time per country - and real lines as the rule reads them", icon: <RuleOutlinedIcon />, tint: "slate", unfiltered: true, charts: ["otdLogic", "otdDates", "otdTransit", "otdExamples"] },
    { id: "speed", label: "Delivery speed", title: "Delivery speed", note: "every delivery in the ERP's order file, read every night: the working days from the order to the shipment - the filters do not apply here", icon: <TimerOutlinedIcon />, tint: "green", unfiltered: true,
      charts: ["spdFigs", "spdMix", "spdFast", "spdMedian", "spdByDate", "spdLate", "spdCountry", "spdMode", "spdTable", "spdSlow"] },
    TYPE_IN,
  ],
  autonomy: [
    { id: "pass", label: "Pass rate", title: "Pass rate per mandant", note: "the eShop order lines whose price the ERP set by itself, counted every night · by the month ordered, service articles left out · target 95 % · the filters do not apply here", icon: <VerifiedOutlinedIcon />, tint: "green", unfiltered: true, charts: ["pass100", "pass110", "elMonths", "prSources"],
      warn: (d) => (d.erpLines ? null : "Waiting for the ERP's order lines: the pass rate and the manual prices are counted from them, and the first morning file carrying them has not reached the hub yet. Until it does, the graphs show the Back Office's own typed figures.") },
    { id: "price", label: "Manual prices", title: "Manual price adjustments per mandant", note: "the eShop order lines whose price was typed by hand in the ERP, counted every night · by the month ordered, service articles left out · target below 2.5 % · then the biggest changes from the shop's price · the filters do not apply here", icon: <PriceChangeOutlinedIcon />, tint: "amber", unfiltered: true,
      charts: ["price100", "price110", "elMonths", "pricePc", "pricePcMonths", "priceArticles", "priceOwner", "prBig"] },
    { id: "logic", label: "How it's counted", title: "How the pass rate and the manual prices are counted", note: "where each eShop order line's price came from, as the ERP records it", icon: <RuleOutlinedIcon />, tint: "slate", unfiltered: true, charts: ["passLogic", "passSources", "passExamples"] },
    TYPE_IN,
  ],
  stopped: [
    { id: "stopped", label: "Stopped orders", title: "Stopped orders", note: "the share of the orders transferred that was stopped, and why", icon: <BlockOutlinedIcon />, tint: "pink", charts: ["stopped", "stoppedWhy"] },
    TYPE_IN,
  ],
};

/** The tab row with Saved views and Filters beside it, what the page is filtered by, the tab's card - as ESO's pages. */
function TabCard({ slug, c, extra }: { slug: Slug; c: Ctx; extra?: (tab: string) => React.ReactNode }) {
  const params = useSearchParams();
  const tabs = TABS[slug];
  const asked = params.get("tab");
  const [tab, setTabState] = useState(tabs.some((x) => x.id === asked) ? asked! : tabs[0].id);
  const setTab = (id: string) => { setTabState(id); setQuery((q) => { if (id === tabs[0].id) q.delete("tab"); else q.set("tab", id); }); };
  const [panel, setPanel] = useState(false);
  const t = tabs.find((x) => x.id === tab) ?? tabs[0];
  const f = c.f;
  const chosen = DIMS.flatMap((k) => (f.fil[k] ?? []).map((v) => [k, v] as const));
  const ownPeriod = f.year !== f.cy || f.win.from !== 0 || f.win.to !== f.cm;
  const n = chosen.length + (ownPeriod ? 1 : 0);
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          {tabs.length > 1 && <ReportTabs name={`bo-${slug}`} tab={t.id} onSelect={setTab} tabs={tabs.map((x) => ({ id: x.id, label: x.label, count: null }))} />}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page={`bo-${slug}`} /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || n ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="bo-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || n ? undefined : "#fff" }}>
          Filters{n ? ` · ${n}` : ""}
        </Button>
      </Box>
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearFilters} items={[
        ...(ownPeriod ? [{ key: "period", name: "Period", value: periodOf(f), tint: "blue" as Tint, onRemove: () => setPeriod(f, f.cy, 0, null) }] : []),
        ...chosen.map(([k, v]): ActiveItem => ({ key: `${k}:${v}`, name: DIM[k].name, value: k === "person" ? ownerName(f, v) : v, tint: DIM[k].tint, onRemove: () => toggle(k, v) })),
      ]} />
      <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <CardTitle icon={t.id === "table" ? pageOf(slug).icon : t.icon} tint={t.id === "table" ? pageOf(slug).tint : t.tint} title={`${t.title}, ${periodOf(f)}`} note={t.note} />
        {(() => { const w = typeof t.warn === "function" ? t.warn(c.d) : t.warn; return w ? <OnHold text={w} /> : null; })()}
        {t.charts.length > 0 && !t.charts.some((id) => { const x = CHARTS.find((y) => y.page === slug && y.id === id); return x && !(x.needsCount && !c.d.erpLines); }) && (
          <Typography sx={{ fontSize: "0.88rem", color: MUTED, py: 1 }}>These graphs are counted from the ERP&apos;s order lines - they show as soon as the first morning file carrying them has reached the hub.</Typography>
        )}
        {t.charts.length > 0 && (() => {
          const grid = (
            <Box sx={{ ...TWO, mt: -0.5 }}>
              {t.charts.map((id) => {
                const def = CHARTS.find((x) => x.page === slug && x.id === id);
                if (def?.needsCount && !c.d.erpLines) return null;
                return def ? <Box key={id} sx={{ minWidth: 0, ...(def.wide ? { gridColumn: "1 / -1" } : {}), ...(def.tall ? { gridRow: { lg: "span 2" } } : {}) }}><Card def={def} c={c} where="tab" /></Box> : null;
              })}
            </Box>
          );
          return t.unfiltered ? grid : <CardFilterFor filter={{ open: () => setPanel(true), label: n ? `Filtered by ${n} - change the filters` : "Filter these graphs", on: n > 0 }}>{grid}</CardFilterFor>;
        })()}
        {extra?.(t.id)}
      </GlassCard>
      <FilterWindow f={f} open={panel} onClose={() => setPanel(false)} />
    </>
  );
}

/** The period: this year to date, last year, a quarter, or one's own months - of one year at a time. */
function BoPeriod({ f }: { f: Frame }) {
  const lastOf = (y: number) => (y === f.cy ? f.cm : 11);
  const qs = quartersOf(f.year, lastOf(f.year), f.year === f.cy);
  const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const isOn = (id: string) => {
    if (id === "cy") return f.year === f.cy && f.win.from === 0 && f.win.to === f.cm;
    if (id === "py") return f.year === f.cy - 1 && f.win.from === 0 && f.win.to === 11;
    const q = qs.find((x) => x.id === id);
    return !!q && f.win.from === q.from && f.win.to === q.to;
  };
  const onChoice = (id: string) => {
    if (id === "cy") return setPeriod(f, f.cy, 0, null);
    if (id === "py") return setPeriod(f, f.cy - 1, 0, null);
    const q = qs.find((x) => x.id === id);
    if (q) setPeriod(f, f.year, q.from, q.to);
  };
  return (
    <PeriodPicker quick={[{ id: "cy", label: `Year to date ${f.cy}` }, { id: "py", label: String(f.cy - 1) }]} quarters={qs} isOn={isOn} onChoice={onChoice}
      unit="month" min={`${f.cy - 1}-01`} max={ym(f.cy, f.cm)} from={ym(f.year, f.win.from)} to={ym(f.year, f.win.to)}
      onRange={(a, b) => { const y = Number(a.slice(0, 4)); setPeriod(f, y, Number(a.slice(5, 7)) - 1, Number(b.slice(0, 4)) === y ? Number(b.slice(5, 7)) - 1 : lastOf(y)); }}
      note={<>The months of one year at a time, against the same months a year before - the Back Office&apos;s tickets are in HubSpot from July {f.cy - 1}.</>} />
  );
}

/** A breakdown's values, the most tickets first, each with how many of the period's tickets carry it. */
function facetRows(f: Frame, dim: Dim) {
  const m = new Map<string, number>();
  f.cur.forEach((mo, i) => {
    if (!mo.rows || i < f.from || i >= Math.max(f.done, f.from + 1)) return;
    const d = mo.rows.dict;
    for (const r of mo.rows.created) {
      const t = tk(d, r, RW), co = f.co[t.company];
      const v = dim === "topic" ? topicLabel(t.topic) : dim === "person" ? t.owner : dim === "origin" ? t.origin : co?.[dim === "category" ? 0 : dim === "country" ? 1 : 2] ?? "Not set";
      m.set(v, (m.get(v) ?? 0) + 1);
    }
  });
  return [...m].map(([value, n]) => ({ value, label: dim === "person" ? ownerName(f, value) : value, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}
function Facet({ f, dim }: { f: Frame; dim: Dim }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const rows = useMemo(() => facetRows(f, dim), [f, dim]);
  const sel = f.fil[dim] ?? [];
  const found = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
  const LIMIT = 8;
  const shown = all || q ? found : [...found.slice(0, LIMIT), ...found.slice(LIMIT).filter((r) => sel.includes(r.value))];
  const max = Math.max(1, ...rows.map((r) => r.n));
  const tt = TINT[DIM[dim].tint];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.length > LIMIT && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${DIM[dim].name.toLowerCase()}…`} inputProps={{ "aria-label": `Find a ${DIM[dim].name.toLowerCase()} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
        </Box>
      )}
      {shown.map((r) => {
        const on = sel.includes(r.value);
        return (
          <Box key={r.value} component="button" type="button" onClick={() => toggle(dim, r.value)} aria-pressed={on}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 70px 44px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? tt.bg : "transparent", "&:hover": { bgcolor: on ? tt.bg : "rgba(21,34,58,.04)" } }}>
            {on ? <CheckIcon sx={{ fontSize: 16, color: tt.fg }} /> : <span />}
            <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, color: INK }}>{r.label}</Typography>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(r.n / max) * 100}%`, bgcolor: tt.fg, opacity: 0.6 }} /></Box>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{int(r.n)}</Typography>
          </Box>
        );
      })}
      {!q && found.length > LIMIT && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${LIMIT}` : `Show all ${found.length}`}</Button>}
    </Box>
  );
}
function FilterWindow({ f, open, onClose }: { f: Frame; open: boolean; onClose: () => void }) {
  const [shut, setShut] = useState<Partial<Record<Dim | "period", boolean>>>({});
  const isOpen = (k: Dim | "period") => (shut[k] !== undefined ? !shut[k] : k === "period" || !!f.fil[k as Dim]?.length);
  const [live, setLive] = useState(open);
  useEffect(() => { if (open) { setLive(true); return; } const t = setTimeout(() => setLive(false), 320); return () => clearTimeout(t); }, [open]);
  const chosen = DIMS.flatMap((k) => (f.fil[k] ?? []).map((v) => [k, v] as const));
  return (
    <FilterPanel id="bo-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only those tickets - several at once; the orders, ESO and TSA stay whole"}
      onClearAll={chosen.length ? clearFilters : undefined}
      chips={chosen.length ? chosen.map(([k, v]) => <Chip key={`${k}:${v}`} size="small" label={<span><b>{DIM[k].name}:</b> {k === "person" ? ownerName(f, v) : v}</span>} onDelete={() => toggle(k, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[k].tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          <FilterSection id="bofilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => setShut((x) => ({ ...x, period: isOpen("period") }))} summary={periodOf(f)}>
            <BoPeriod f={f} />
          </FilterSection>
          {DIMS.map((k, i) => (
            <FilterSection key={k} id={`bofilter-${k}`} index={i + 1} title={DIM[k].name} icon={DIM[k].icon} tint={DIM[k].tint} open={isOpen(k)} onFlip={() => setShut((x) => ({ ...x, [k]: isOpen(k) }))}
              summary={!f.fil[k]?.length ? "All" : f.fil[k]!.length === 1 ? (k === "person" ? ownerName(f, f.fil[k]![0]) : f.fil[k]![0]) : `${f.fil[k]!.length} chosen`} chosen={!!f.fil[k]?.length}>
              <Facet f={f} dim={k} />
            </FilterSection>
          ))}
        </>
      )}
    </FilterPanel>
  );
}

/* ── the page around each part ─────────────────────────────────────────── */

const SHELL = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
type Put = (body: Record<string, unknown>) => Promise<void>;
/** may this person type a series in (its page's edit right) */
const canType = (a: Answer, series: string) => (typeof a.canEditTyped === "boolean" ? a.canEditTyped : !!a.canEditTyped[series]);

function Waiting({ title, a, err, again }: { title: string; a: Answer | null; err: { error: string; status: number | null } | null; again: () => void }) {
  const head = <Typography component="h1" sx={H1}>{title}</Typography>;
  if (err && !a?.data) return <Box sx={SHELL}>{head}<UpstreamPanel source="Back-Office Reports" error={err.error} status={err.status} onRetry={again} /></Box>;
  const label = a?.state.error ? `The last count stopped: ${a.state.error}` : `Counting the Back Office's months from HubSpot - the newest first, each shown as soon as it is counted${a?.state.progress ? ` · ${a.state.progress}` : "…"}`;
  return <Box sx={SHELL}>{head}<LoadingPanel label={label} /></Box>;
}

function Page({ slug, children }: { slug: Slug; children: (f: Frame, d: Data, a: Answer, put: Put) => React.ReactNode }) {
  const { a, err, again, put } = useBo();
  if (!a?.data) return <Waiting title={pageOf(slug).title} a={a} err={err} again={again} />;
  return <Loaded slug={slug} d={a.data} a={a} put={put}>{children}</Loaded>;
}

function Loaded({ slug, d, a, put, children }: { slug: Slug; d: Data; a: Answer; put: Put; children: (f: Frame, d: Data, a: Answer, put: Put) => React.ReactNode }) {
  const f = useFrame(d);
  const counted = new Date(d.generatedAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <Box sx={SHELL}>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) auto" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
          <Typography component="h1" sx={H1}>{pageOf(slug).title}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>Back Office</b> · {f.year}{f.done ? <> · the figures: <b style={{ color: INK }}>{f.doneWords} {f.year}</b>{f.totalPrev ? <> against {f.doneWords} {f.year - 1}</> : null}</> : null} · counted {counted}
            {a.state.computing && <> · <CircularProgress size={10} sx={{ mx: 0.4 }} />{d.pending?.length ? `counting - ${d.pending.length} of ${d.pending.length + d.months.length} months still to come, the newest first` : d.updating?.length ? `bringing ${d.updating.length} months up to date - their earlier figures shown meanwhile` : "counting again"}</>}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><FigureCards items={FIGS[slug](f, d)} /></Box>
      </Box>
      {children(f, d, a, put)}
    </Box>
  );
}

/** "All the figures": a KPI a row, a month a column, then the complete months, last year's and the change - as the workbook,
 *  its rows in sections (SARCLA 03.11.2026: "please improve table design"). `whole`: a ratio to the orders - "—" for the
 *  month to date, whose orders come in days later. */
type KRow = { key: string; label: string; pick: (k: BoKpis) => number | null; fmt: (v: number | null) => string; lower?: boolean; strong?: boolean; whole?: boolean; section?: string; plain?: boolean };
/** a month's figure against the period's average: green when better by more than 3 %, red when worse (SARCLA 03.11.2026:
 *  "some red and green where it's going well and when it's not") */
const GOOD = "#1e7e45", BAD = "#c5221f";
const against = (v: number | null, avgV: number | null, lower?: boolean) => {
  if (v == null || avgV == null || !avgV) return undefined;
  const ch = v / avgV - 1;
  if (Math.abs(ch) < 0.03) return undefined;
  return (ch < 0) === !!lower ? GOOD : BAD;
};
type WRow = { key: string; cells: React.ReactNode[]; strong?: boolean; section?: string };
/** The workbook's table: a sticky first column, the months, then the period's columns set apart; a section's name above its rows. */
function WTable({ head, rows, totals }: { head: string[]; rows: WRow[]; totals: number }) {
  const months = head.length - 1 - totals;
  const cell = { px: 1.25, py: 0.85, fontSize: "0.84rem", textAlign: "right" as const, whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums", borderBottom: `1px solid ${HAIRLINE}` };
  const apart = (i: number) => (i === months + 1 ? { borderLeft: `2px solid ${HAIRLINE}` } : {});
  let section: string | undefined;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 150 + head.length * 76 }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <Box component="th" key={i} sx={{ ...cell, ...apart(i), py: 1, fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: i > months ? INK : FAINT, textAlign: i ? "right" : "left", ...(i === 0 ? { position: "sticky", left: 0, bgcolor: "#fff", zIndex: 1, minWidth: 230 } : {}) }}>{h}</Box>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((r) => {
            const out: React.ReactNode[] = [];
            if (r.section && r.section !== section) {
              section = r.section;
              out.push(<tr key={`s-${r.key}`}><Box component="td" colSpan={head.length} sx={{ px: 1.25, pt: 2, pb: 0.75, fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: TINT.blue.fg, borderBottom: `1px solid ${HAIRLINE}`, position: "sticky", left: 0 }}>{r.section}</Box></tr>);
            }
            out.push(
              <Box component="tr" key={r.key} sx={{ "&:hover td": { bgcolor: "rgba(21,34,58,.03)" } }}>
                {r.cells.map((c, i) => (
                  <Box component="td" key={i} sx={{ ...cell, ...apart(i), fontWeight: r.strong || i > months ? 700 : 500, color: i === 0 || i > months ? INK : MUTED, ...(i === 0 ? { textAlign: "left", position: "sticky", left: 0, bgcolor: "#fff", zIndex: 1, whiteSpace: "normal" } : {}) }}>{c}</Box>
                ))}
              </Box>,
            );
            return out;
          })}
        </tbody>
      </Box>
    </Box>
  );
}
function AllFigures({ f, rows, title = "All the figures, month by month", hint, hours }: { f: Frame; rows: KRow[]; title?: string; hint?: string; hours?: { can: boolean; put: Put } }) {
  const sum = f.doneWords ? `${f.doneWords} ${f.year}` : String(f.year);
  const [msg, setMsg] = useState<string | null>(null);
  const save = (ym: string) => async (v: string) => {
    // "1,200.5" and "1'200" as a person writes them, "908,6" as a decimal comma
    const t = v.trim().replace(/[\s']/g, "");
    const n = t === "" ? null : Number(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? t.replace(/,/g, "") : t.replace(",", "."));
    if (n !== null && !Number.isFinite(n)) { setMsg("Hours are a number, e.g. 908.6"); return; }
    try { await hours!.put({ ym, hours: n }); setMsg(n === null ? "Cleared" : "Saved - the hours per ticket and the workload follow"); } catch (e) { setMsg(String((e as Error).message)); }
  };
  const head = ["KPI", ...f.labels.map((l) => l.replace(" (to date)", "*")), sum, ...(f.totalPrev ? [`${f.doneWords} ${f.year - 1}`, "Change"] : [])];
  return (
    <ChartBox title={title} hint={hint ?? `${f.labels.some((l) => l.includes("to date")) ? "* to date - " : ""}a KPI a row · a month in green when better than the period's average, in red when worse · the last columns add up the complete months${hours?.can ? " · the hours typed in here (Abacus) - nothing else is typed, all the rest comes from HubSpot" : ""}`}>
      <WTable head={head} totals={f.totalPrev ? 3 : 1} rows={rows.map((r) => {
        const a = r.pick(f.total), b = f.totalPrev ? r.pick(f.totalPrev) : null;
        const ch = a != null && b != null ? changeOf(a, b) : null;
        const vals = f.yms.map((_, i) => (r.whole && f.labels[i].includes("to date") ? null : r.pick(f.k(i))));
        const done = vals.slice(f.from, f.done).filter((x): x is number => x != null);
        const mean = done.length ? done.reduce((x, y) => x + y, 0) / done.length : null;
        const typed = r.key === "hours" && hours?.can;
        return {
          key: r.key, strong: r.strong, section: r.section,
          cells: [r.label, ...f.yms.map((ym, i) => (typed
            ? <Box key={ym} title={f.hours[i] == null && i < f.done ? "To type in: this month's hours from Abacus" : undefined}
                sx={f.hours[i] == null && i < f.done ? { display: "inline-block", minWidth: 64, px: 0.75, py: 0.25, borderRadius: "8px", border: "1.5px dashed #eda100", bgcolor: "#fff8e6" } : undefined}>
                <Cell value={f.hours[i]} fmt={(v) => (v == null ? "" : String(v))} can label={`Hours worked, ${f.labels[i]}`} onSave={save(ym)} />
              </Box>
            : <Box key={ym} component="span" sx={{ color: r.plain || f.labels[i].includes("to date") ? undefined : against(vals[i], mean, r.lower) }}>{vals[i] == null && r.whole && f.labels[i].includes("to date") ? "—" : r.fmt(vals[i])}</Box>)), r.fmt(a),
            ...(f.totalPrev ? [r.fmt(b), <Box key="ch" component="span" sx={{ color: tone(ch, r.lower) }}>{signedPct(ch)}</Box>] : [])],
        };
      })} />
      {msg && <Typography sx={{ fontSize: "0.78rem", color: /^Saved|^Cleared/.test(msg) ? GOOD : BAD }}>{msg}</Typography>}
      {hours?.can && f.hours.slice(0, f.done).some((x) => x == null) && <Typography sx={{ fontSize: "0.78rem", color: "#9a6700" }}>The months marked in amber still need their hours typed in (Abacus) - the hours per ticket and the workload graphs follow.</Typography>}
    </ChartBox>
  );
}

/* ── Team totals ───────────────────────────────────────────────────────── */

const TEAM_ROWS: KRow[] = [
  { key: "created", label: "Number of tickets created", pick: (k) => k.created, fmt: n0, strong: true, lower: true, section: "Tickets" },
  { key: "closed", label: "Number of tickets closed", pick: (k) => k.closed, fmt: n0, section: "Tickets" },
  { key: "chat", label: "Number of chat tickets", pick: (k) => k.chat, fmt: n0, plain: true, section: "Tickets" },
  { key: "reply", label: "Avg. first response time (days)", pick: (k) => k.firstReply, fmt: d1, lower: true, section: "Speed" },
  { key: "resolution", label: "Avg. resolution time (days)", pick: (k) => k.resolution, fmt: d1, lower: true, section: "Speed" },
  { key: "orders", label: "Orders", pick: (k) => k.orders, fmt: n0, section: "Orders" },
  { key: "lines", label: "Order lines", pick: (k) => k.lines, fmt: n0, section: "Orders" },
  { key: "perLine", label: "Ratio tickets vs order lines", pick: (k) => k.perLine, fmt: share, lower: true, whole: true, section: "Orders" },
  { key: "perOrder", label: "Ratio tickets vs orders", pick: (k) => k.perOrder, fmt: share, lower: true, whole: true, section: "Orders" },
  { key: "hours", label: "Hours worked", pick: (k) => k.hours, fmt: hrs, plain: true, section: "Workload" },
  { key: "perHour", label: "Avg. hours per ticket", pick: (k) => k.hoursPerTicket, fmt: (v) => (v == null ? "—" : v.toFixed(2)), whole: true, section: "Workload" },
  { key: "gqs", label: "Number of GQS tasks created", pick: (k) => k.gqsCreated, fmt: n0, plain: true, section: "GQS" },
  { key: "gqsSent", label: "Avg. time before sent to GQS (days)", pick: (k) => k.gqsSent, fmt: d1, lower: true, section: "GQS" },
  { key: "gqsDone", label: "Avg. resolution time GQS (days)", pick: (k) => k.gqsResolution, fmt: d1, lower: true, section: "GQS" },
  { key: "neutral", label: "Detected tone: neutral (share of scored)", pick: (k) => k.neutral, fmt: share, plain: true, section: "Sentiment" },
  { key: "negative", label: "Detected tone: negative (share of scored)", pick: (k) => k.negative, fmt: share, lower: true, section: "Sentiment" },
];

/** a month's figure typed in place: saved when it loses focus or on Enter */
function Cell({ value, fmt, can, label, onSave }: { value: number | null; fmt: (v: number | null) => string; can: boolean; label: string; onSave: (v: string) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!can) return <Typography component="span" sx={{ fontSize: "0.9rem", fontWeight: 650, color: value != null ? INK : FAINT }}>{fmt(value)}</Typography>;
  return (
    <InputBase value={draft ?? (value != null ? fmt(value) : "")} placeholder="—" inputProps={{ inputMode: "decimal", "aria-label": label }}
      onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== null) void onSave(draft).finally(() => setDraft(null)); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      sx={{ fontSize: "0.9rem", fontWeight: 650, color: INK, "& input": { p: 0, textAlign: "inherit" } }} />
  );
}

export function BoFiguresPage() {
  return (
    <Page slug="figures">
      {(f, d, a, put) => (
        <>
          <TabCard slug="figures" c={{ f, d }} extra={(tab) => (tab === "table" ? <AllFigures f={f} rows={TEAM_ROWS} title="Team totals, month by month" hours={{ can: a.canEdit, put }} /> : null)} />
        </>
      )}
    </Page>
  );
}

/* ── Topics ────────────────────────────────────────────────────────────── */

function TopicsBody({ f, d }: { f: Frame; d: Data }) {
  const [picked, setPicked] = useState<string[]>([]);
  const c: Ctx = { f, d, picked, pick: (l) => setPicked((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l])) };
  const { compare, rows } = topicRows(f);
  return (
    <TabCard slug="topics" c={c} extra={(tab) => tab === "table" && (
      <ChartBox title="Tickets per topic, month by month" hint="Back Office tickets per topic, by the month they came in - Others is each kind on its own today (automatic, finance, internal e-mails, spam ...)">
        <WTable head={["Topic", ...f.labels.map((l) => l.replace(" (to date)", "*")), ...(f.done ? [`${f.doneWords} ${f.year}`] : []), ...(compare ? [`${f.doneWords} ${f.year - 1}`, "Change"] : [])]}
          totals={(f.done ? 1 : 0) + (compare ? 2 : 0)}
          rows={[...rows, { label: "Grand total", key: "__total", cur: rows.reduce((s, r) => s + r.cur, 0), prev: rows.reduce((s, r) => s + r.prev, 0) }].map((r) => ({
            key: r.key, strong: r.key === "__total",
            cells: [r.label, ...f.cur.map((m) => (hasTickets(m.ym) && !m.pending ? n0(r.key === "__total" ? m.created : m.topics[r.key] ?? 0) : "—")), ...(f.done ? [int(r.cur)] : []),
              ...(compare ? [int(r.prev), <Box key="ch" component="span" sx={{ color: tone(changeOf(r.cur, r.prev), true) }}>{r.prev ? signedPct(changeOf(r.cur, r.prev)) : "—"}</Box>] : [])],
          }))} />
      </ChartBox>
    )} />
  );
}

export function BoTopicsPage() {
  return <Page slug="topics">{(f, d) => <TopicsBody f={f} d={d} />}</Page>;
}

/* ── ESO & TSA tickets ─────────────────────────────────────────────────── */

const SALES_ROWS: KRow[] = [
  { key: "eso", label: "Total number of tickets - ESO (inbound)", pick: (k) => k.eso, fmt: n0, strong: true, section: "ESO" },
  { key: "esoL", label: "Ratio tickets vs order lines", pick: (k) => k.esoPerLine, fmt: share, lower: true, whole: true, section: "ESO" },
  { key: "esoO", label: "Ratio tickets vs orders", pick: (k) => k.esoPerOrder, fmt: share, lower: true, whole: true, section: "ESO" },
  { key: "tsa", label: "Total number of tickets - TSA (inbound)", pick: (k) => k.tsa, fmt: n0, strong: true, section: "TSA" },
  { key: "tsaL", label: "Ratio tickets vs order lines", pick: (k) => k.tsaPerLine, fmt: share, lower: true, whole: true, section: "TSA" },
  { key: "tsaO", label: "Ratio tickets vs orders", pick: (k) => k.tsaPerOrder, fmt: share, lower: true, whole: true, section: "TSA" },
  { key: "all", label: "Total number of tickets - APSOparts", pick: (k) => k.all, fmt: n0, strong: true, section: "APSOparts" },
  { key: "allL", label: "Ratio tickets vs order lines", pick: (k) => k.allPerLine, fmt: share, lower: true, whole: true, section: "APSOparts" },
  { key: "allO", label: "Ratio tickets vs orders", pick: (k) => k.allPerOrder, fmt: share, lower: true, whole: true, section: "APSOparts" },
];

export function BoSalesTicketsPage() {
  return (
    <Page slug="sales-tickets">
      {(f, d) => (
        <>
          {!f.inbound && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>The ESO Reports&apos; ticket read is still counting - until it is in, the ESO and the TSA show every ticket of their pipelines, the sales actions with them.</Typography>}
          <TabCard slug="sales-tickets" c={{ f, d }} extra={(tab) => tab === "table" && <AllFigures f={f} rows={SALES_ROWS} title="ESO, TSA and APSOparts, month by month" hint="The ESO's and the TSA's inbound tickets (the UC hand-overs and the pushes - erosion, win back, the September push, price checks - left out) against the month's orders and order lines" />} />
        </>
      )}
    </Page>
  );
}

/* ── GQS ───────────────────────────────────────────────────────────────── */

export function BoGqsPage() {
  return (
    <Page slug="gqs">
      {(f, d) => <TabCard slug="gqs" c={{ f, d }} extra={(tab) => tab === "table" && <GqsTable f={f} d={d} />} />}
    </Page>
  );
}

/* ── OTD, KPI autonomy, Stopped orders: typed in ───────────────────────── */

function TypedTable({ s, f, d, can, put }: { s: TypedSeries; f: Frame; d: Data; can: boolean; put: Put }) {
  const [msg, setMsg] = useState<string | null>(null);
  const fmt = s.unit === "pct" ? share : n0;
  const save = (row: string, ym: string) => async (v: string) => {
    try { await put({ ym, series: s.id, row, value: v }); setMsg(null); } catch (e) { setMsg(String((e as Error).message)); }
  };
  return (
    <ChartBox title={`${s.title} - typed in`} hint={`${s.note}${s.target ? ` · target ${s.target.lower ? "below " : ""}${pct(s.target.value)}` : ""} · not in HubSpot - ${can ? "type a month in, it saves when you leave the field" : "typed in per month by the Back Office"}`}>
      <Table head={[s.title, ...f.labels.map((l) => l.replace(" (to date)", "*"))]} minWidth={Math.max(900, 150 + f.yms.length * 74)} firstWidth="minmax(220px, 1.8fr)"
        rows={s.rows.map((r) => ({
          key: r.id,
          cells: [r.label, ...f.yms.map((ym, i) => <Cell key={ym} value={d.typed[typedKey(s.id, r.id)]?.[ym] ?? null} fmt={fmt} can={can} label={`${s.title}, ${r.label}, ${f.labels[i]}`} onSave={save(r.id, ym)} />)],
        }))} />
      {msg && <Typography sx={{ fontSize: "0.78rem", color: "#c5221f" }}>{msg}</Typography>}
    </ChartBox>
  );
}

/** Figures on hold until we get the data - amber, an hourglass, said in words (SARCLA 07.11.2026) */
function OnHold({ text }: { text: string }) {
  return (
    <Box role="note" sx={{ display: "flex", gap: 1.25, alignItems: "center", px: 1.75, py: 1.25, borderRadius: "12px", border: `1px solid ${TINT.amber.fg}`, bgcolor: TINT.amber.bg }}>
      <HourglassEmptyOutlinedIcon sx={{ fontSize: 20, color: TINT.amber.fg }} />
      <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{text}</Typography>
    </Box>
  );
}

/** `warn`: a page on hold, said above everything on it (SARCLA 07.11.2026 on OTD) */
function TypedPage({ slug, note, warn }: { slug: Slug; note: string | ((d: Data) => string); warn?: string | ((d: Data) => string | null) }) {
  return (
    <Page slug={slug}>
      {(f, d, a, put) => (
        <>
          {(() => { const w = typeof warn === "function" ? warn(d) : warn; return w ? <OnHold text={w} /> : null; })()}
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{typeof note === "function" ? note(d) : note}</Typography>
          <TabCard slug={slug} c={{ f, d }} extra={(tab) => tab === "input" && TYPED.filter((s) => TYPED_ON[slug]?.includes(s.id)).map((s) => <TypedTable key={s.id} s={s} f={f} d={d} can={canType(a, s.id)} put={put} />)} />
        </>
      )}
    </Page>
  );
}

export function BoOtdPage() {
  return <TypedPage slug="otd" warn={(d) => (d.erpLines ? null : "Waiting for the ERP's order lines: OTD is counted from them, and the first morning file carrying them has not reached the hub yet. Until it does, the graphs show the Back Office's own typed figures.")}
    note={(d) => (d.erpLines ? `Counted every night from the ERP's order lines (${ddmm(d.erpLines.at.slice(0, 10))}): an eShop order line is on time when its shipment plus the ERP's transport time to the country reaches its first confirmed date. The Back Office's typed figures stay beside it. The delivery speed comes from the ERP's order file.` : "The Back Office types each month in until the ERP's order lines come in. The delivery speed is counted from the ERP's order file every night.")} />;
}
export function BoAutonomyPage() {
  return <TypedPage slug="autonomy" note={(d) => (d.erpLines ? `Counted every night from the ERP's order lines (${ddmm(d.erpLines.at.slice(0, 10))}): where each eShop order line's price came from - set by the ERP itself (the pass rate) or typed by hand (the manual prices). The Back Office's typed figures stay beside it.` : "The Back Office types each month in until the ERP's order lines come in. The biggest price changes are the shop's prices against the ERP's.")} />;
}
export function BoStoppedPage() {
  return <TypedPage slug="stopped" warn="Stopped orders are on hold until we get the data - the stops happen in Performis after the shop has passed the order on, and neither the ERP's nightly file nor the shop keeps them. Until then these are the Back Office's own figures, not checked." note="Not in HubSpot - no order says it was stopped, or why - so the Back Office types each month in." />;
}

/* ── the BUC View: a panel per page ────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;

function Panel({ p, c, acts }: { p: PageDef; c: Ctx; acts: ActionsState | null }) {
  const PAGE = `bo-${p.slug}`, scope = `nutshell:${PAGE}`;
  const figs = FIGS[p.slug](c.f, c.d);
  const items: SortItem[] = (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === PAGE).map(({ spec }) => {
    const def = chartByKey(spec.key);
    const fmt = formatOf(acts, spec);
    const node = def ? <Card def={def} c={c} where="nutshell" /> : (
      <ChartBox title={spec.title} hint="This graph is no longer on its page - Actions takes it off here."
        actions={<TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, kind: spec.kind, href: spec.href }} />}>{null}</ChartBox>
    );
    return { key: spec.key, node, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" }, block: true };
  });
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope, keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={p.icon} tint={p.tint} size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={hrefOf(p.slug)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT[p.tint].fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>{p.title}</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT[p.tint].fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c.f.doneWords} {c.f.year}{c.f.totalPrev ? ` against ${c.f.doneWords} ${c.f.year - 1}` : ""} · {p.line}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: `repeat(${figs.length}, minmax(0, 1fr))` } }}>
        {figs.map((x) => (
          <Box key={x.label} component={Link} href={hrefOf(p.slug)} sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "grid", gap: 0.75, alignContent: "start", minWidth: 0, textDecoration: "none", "&:hover": { borderColor: TINT[x.tint].fg } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Badge icon={x.icon} tint={x.tint} size={32} />
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{x.label}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{x.value}</Typography>
              {x.ch !== undefined && <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: tone(x.ch ?? null, x.lower) }}>{signedPct(x.ch ?? null)}</Typography>}
            </Box>
            <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{x.sub}</Typography>
          </Box>
        ))}
      </Box>
      {items.length > 0 ? <SortableGrid items={items} order={acts?.orders?.[scope]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} /> : <BucEmpty page={p.title} href={hrefOf(p.slug)} tint={p.tint} />}
    </GlassCard>
  );
}

function BucBody({ d, a }: { d: Data; a: Answer }) {
  const f = useFrame(d);
  const { state: acts } = useActions("nutshell");
  const c: Ctx = { f, d };
  return (
    <>
      {BO_PAGES.map((p) => <Panel key={p.slug} p={p} c={c} acts={acts} />)}
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot {new Date(d.generatedAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich" })}{a.state.computing ? ` · counting${d.pending?.length ? ` - ${d.pending.length} months still to come` : " again"}` : ""} · the complete months of this year against the same months of last year · OTD, KPI autonomy and the stopped orders typed in by the Back Office · a graph joins its page&apos;s panel here with Actions on the page.
      </Typography>
    </>
  );
}

export function BoBucView() {
  const { a, err, again } = useBo();
  return (
    // no title: the panels straight away, as ESO's and TSA's BUC View
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {!a?.data ? (err ? <UpstreamPanel source="Back-Office Reports" error={err.error} status={err.status} onRetry={again} />
        : <LoadingPanel label={a?.state.error ? `The last count stopped: ${a.state.error}` : `Counting the Back Office's months from HubSpot - the newest first${a?.state.progress ? ` · ${a.state.progress}` : "…"}`} />)
        : <BucBody d={a.data} a={a} />}
    </Box>
  );
}

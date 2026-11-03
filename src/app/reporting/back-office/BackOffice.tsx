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
// Sentiment with the survey sent after a ticket is closed, the Table first and drawn anew.
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

import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartBox, H1, TWO, setQuery } from "@/app/reporting/eso-benchmark/Figures";
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
import { FigureCards, MONTHS, changeOf, int, pct, tone, signedPct, type Fig } from "@/app/reporting/products/views/kit";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { TrendChart } from "@/app/charts/TrendChart";
import { BarList } from "@/app/charts/BarList";
import { DEEMPHASIS, SEQUENTIAL, SERIES } from "@/app/charts/palette";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { Sankey } from "@/app/charts/Sankey";
import type { BoRead } from "@/lib/reporting/boReport";
import {
  ORIGINS, RCL, RW, TOPIC_ORDER, TYPED, emptyMonth, filteredMonth, hasTickets, kpisOf, passes, sumGqs, sumMonths, topicLabel, typedKey,
  type BoFilter, type BoKpis, type BoMonth, type CoFacts, type GqsMonth, type Typed, type TypedSeries,
} from "@/lib/reporting/boReportRules";

/* ── the read ──────────────────────────────────────────────────────────── */

type Data = BoRead & {
  hours: Record<string, number>; typed: Typed; inbound: { eso: Record<string, number>; tsa: Record<string, number> } | null;
  /** the tickets' owners by their HubSpot id, and their companies' facts for the filters */
  names?: Record<string, string>; companies?: CoFacts;
  /** the Back Office team (owner ids, from the hierarchy), and the answers to the survey sent after a ticket is closed */
  team?: string[]; surveys?: BoSurvey[];
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
  cur: BoMonth[]; prev: (BoMonth | null)[]; gqs: GqsMonth[]; gqsPrev: (GqsMonth | null)[];
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
    const gqs = yms.map((ym) => gby.get(ym) ?? EMPTY_GQS(ym));
    const gqsPrev = yms.map((ym) => (by.has(back(ym)) ? gby.get(back(ym)) ?? EMPTY_GQS(back(ym)) : null));
    const hrs = (ym: string) => (d.hours[ym] != null ? d.hours[ym] : null);
    const hours = yms.map(hrs), hoursPrev = yms.map((ym) => hrs(back(ym)));
    const done = yms.filter((ym) => ym < d.current).length;
    // the totals from the first month with tickets in HubSpot - July in 2025 - so a year's figures are never all "—"
    const from = Math.min(Math.max(0, yms.findIndex(hasTickets)), Math.max(0, done - 1));
    const doneWords = done === 0 ? "" : done - from === 1 ? MONTHS[wf + from] : `${MONTHS[wf + from]}–${MONTHS[wf + done - 1]}`;
    const sumH = (xs: (number | null)[]) => (xs.slice(from, done).every((x) => x != null) && done ? xs.slice(from, done).reduce<number>((s, x) => s + (x ?? 0), 0) : null);
    const total = kpisOf(sumMonths(cur.slice(from, done)), sumGqs(gqs.slice(from, done)), sumH(hours));
    const havePrev = done > 0 && prev.slice(from, done).every((x) => x);
    const totalPrev = havePrev ? kpisOf(sumMonths(prev.slice(from, done) as BoMonth[]), sumGqs(gqsPrev.slice(from, done) as GqsMonth[]), sumH(hoursPrev)) : null;
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
  { slug: "otd", title: "OTD", line: "on time against the first confirmation date, early call-offs counted - typed in", icon: <LocalShippingOutlinedIcon />, tint: "pink" },
  { slug: "autonomy", title: "KPI autonomy", line: "pass rate and manual price adjustments per mandant, against target - typed in", icon: <VerifiedOutlinedIcon />, tint: "slate" },
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
  gqs: (f) => [
    fig("GQS tasks", n0(f.total.gqsCreated), f.total.gqsCreated, f.totalPrev?.gqsCreated ?? null, f.doneWords || String(f.year), <AssignmentOutlinedIcon sx={{ fontSize: 14 }} />, "blue"),
    fig("Days before GQS", days(f.total.gqsSent), f.total.gqsSent, f.totalPrev?.gqsSent ?? null, "in New and Open the GQS Task", <SendOutlinedIcon sx={{ fontSize: 14 }} />, "amber", true),
    fig("Days to close", days(f.total.gqsResolution), f.total.gqsResolution, f.totalPrev?.gqsResolution ?? null, "offer sent to Sales or refused", <TaskAltOutlinedIcon sx={{ fontSize: 14 }} />, "green", true),
  ],
  otd: (f, d) => {
    const ys = doneYms(f), py = ys.map(back);
    const one = (row: string, label: string, tint: Tint) => {
      const a = meanOf(typedOf(d, `otd.${row}`, ys)), b = meanOf(typedOf(d, `otd.${row}`, py));
      return fig(label, share(a), a, b, a == null ? "not typed in yet" : `${f.doneWords} on average`, <LocalShippingOutlinedIcon sx={{ fontSize: 14 }} />, tint);
    };
    return [one("online-all", "OTD online", "blue"), one("online-standard", "Standard articles", "green"), one("online-special", "Special articles", "amber")];
  },
  autonomy: (f, d) => {
    const ys = doneYms(f);
    const one = (key: string, label: string, target: number, lower: boolean, icon: React.ReactNode, tint: Tint) => {
      const v = meanOf(typedOf(d, key, ys));
      const ok = v == null ? null : lower ? v < target : v >= target;
      return fig(label, share(v), null, undefined, `target ${lower ? "below " : ""}${pct(target)}${ok == null ? " · not typed in yet" : ok ? " · on target" : " · off target"}`, icon, tint);
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
type ChartDef = { id: string; page: Slug; title: string; hint?: (c: Ctx) => string; body: (c: Ctx) => React.ReactNode; wide?: boolean };
/** the months a chart draws: the complete ones - a month two days old would read as a collapse (its orders come in days
 *  later: 3 on 2 November, so 615 % tickets per order line) - the month to date only while none is complete */
const drawn = (f: Frame) => Math.max(1, f.done);
const wide = (c: ChartDef): ChartDef => ({ ...c, wide: true });

/** a monthly KPI as a line, last year's beside it, its complete months added up in the hint */
function trend(id: string, page: Slug, title: string, note: string, pick: (k: BoKpis) => number | null, fmt: (v: number | null) => string, tick?: (v: number | null) => string): ChartDef {
  return {
    id, page, title,
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
function typedTrend(id: string, page: Slug, title: string, key: string, note: string, unit: "pct" | "n", target?: number): ChartDef {
  const fmt = unit === "pct" ? share : n0;
  return {
    id, page, title, hint: () => note,
    body: ({ f, d }) => {
      const n = drawn(f);
      const values = typedOf(d, key, f.yms.slice(0, n)), compare = typedOf(d, key, f.yms.slice(0, n).map(back));
      return <MonthTrend values={values} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={fmt} target={target} />;
    },
  };
}
/** some topics' tickets month by month - or, `perOrder`, against the month's orders */
function topicTrend(id: string, title: string, keys: string[], note: string, perOrder = false): ChartDef {
  return {
    id, page: "topics", title, hint: () => note,
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
  const w = 160, h = 46, max = Math.max(1, ...values.map((v) => v ?? 0)), band = w / Math.max(1, values.length);
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
      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))" }}>
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
  const cols = `minmax(150px, 1.5fr) repeat(${n}, minmax(30px, 1fr)) 120px`;
  const row = (p: Person) => (
    <Box key={p.id} sx={{ display: "grid", gridTemplateColumns: cols, alignItems: "end", gap: 0.75, py: 0.6, borderBottom: `1px solid ${HAIRLINE}` }}>
      <Typography noWrap title={p.name} sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, alignSelf: "center" }}>{p.name}</Typography>
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} title={`${p.name}, ${f.labels[i]}: ${int(p.came[i])} came in, ${int(p.shut[i])} closed`} sx={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "2px", height: 34 }}>
          <Box sx={{ width: 8, height: `${(p.came[i] / max) * 100}%`, minHeight: p.came[i] ? 2 : 0, bgcolor: SERIES[0], borderRadius: "2px 2px 0 0" }} />
          <Box sx={{ width: 8, height: `${(p.shut[i] / max) * 100}%`, minHeight: p.shut[i] ? 2 : 0, bgcolor: DEEMPHASIS, borderRadius: "2px 2px 0 0" }} />
        </Box>
      ))}
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums", alignSelf: "center" }}><b style={{ color: INK }}>{int(p.created)}</b> · {int(p.closed)}</Typography>
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
          {["Person", ...f.labels.slice(0, n).map((l) => l.replace(" (to date)", "*")), "Came in · closed"].map((h, i) => (
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
function SurveyTable({ f, d }: { f: Frame; d: Data }) {
  const [shown, setShown] = useState(25);
  const first = f.yms[0] ?? "", last = f.yms[f.yms.length - 1] ?? "";
  const rows = (d.surveys ?? []).filter((x) => x.day.slice(0, 7) >= first && x.day.slice(0, 7) <= last);
  const color = (fl: string | null) => (fl === "happy" ? "#1e7e45" : fl === "unhappy" ? "#c5221f" : MUTED);
  if (!rows.length) return <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>No answer to the survey in these months.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Table head={["Day", "Answer", "Company", "What they wrote", "Ticket"]} minWidth={760} firstWidth="110px"
        rows={rows.slice(0, shown).map((x, i) => {
          const fl = feelingOf(x);
          return {
            key: `${x.day}-${x.ticket ?? ""}-${i}`,
            cells: [x.day.split("-").reverse().join("."), <Box key="a" component="span" sx={{ fontWeight: 700, color: color(fl) }}>{fl ? fl.charAt(0).toUpperCase() + fl.slice(1) : "—"}</Box>,
              x.company ?? "—", x.comment?.trim() || "—",
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
  return [...new Set([...Object.keys(cur), ...Object.keys(prev)])].map((k) => ({ label: k || "No profit centre", cur: cur[k] ?? 0, prev: prev[k] ?? 0 }));
}

export const CHARTS: ChartDef[] = [
  /* Team totals - the workbook's "Monthly evolution - team totals" */
  {
    id: "createdClosed", page: "figures", title: "Tickets created and closed, month by month",
    hint: ({ f }) => `Created: by the month they came in · closed: by their close date${f.done ? ` · ${f.doneWords}: ${n0(f.total.created)} created, ${n0(f.total.closed)} closed` : ""}`,
    body: ({ f }) => {
      const n = drawn(f);
      return <GroupedColumns height={240} format={n0} currentLabel="Created" priorLabel="Closed" currentFirst
        data={f.yms.slice(0, n).map((_, i) => { const k = f.k(i); return { x: f.labels[i], current: k.created, prior: k.closed }; })} />;
    },
  },
  {
    id: "backlog", page: "figures", title: "Tickets created and closed, added up over the year",
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
  trend("created", "figures", "Tickets created", "The Back Office's tickets, by the month they came in", (k) => k.created, n0),
  trend("chat", "figures", "Chat tickets", "Handed over to the Back Office by the chat", (k) => k.chat, n0),
  trend("closed", "figures", "Tickets closed", "By their close date", (k) => k.closed, n0),
  wide({
    id: "origins", page: "figures", title: "Where the tickets came from, month by month",
    hint: () => "Customer: an e-mail or a form · Chat: handed over by the chat · Automatic & internal: what no customer wrote - automatic, finance and internal e-mails, GQS updates, spam - and what a system made",
    body: ({ f }) => <StackedColumns height={260} format={n0} data={byMonth(f, "created", (t) => t.origin).map((x, i) => ({ x: f.labels[i], ...originCells(x) }))} parts={originParts} />,
  }),
  wide({
    id: "peopleOrigin", page: "figures", title: "What came in to each person, by where it came from",
    hint: ({ f }) => {
      const out = peopleOf(f).filter((p) => !inTeam(f, p.id)).reduce((s, p) => s + p.created, 0);
      return `${periodOf(f)} · the tickets created, by their owner today · the Back Office team${out ? ` - ${int(out)} tickets with owners outside it left out` : ""}`;
    },
    body: ({ f }) => {
      const ps = peopleOf(f).filter((p) => p.created && inTeam(f, p.id)).sort((a, b) => b.created - a.created).slice(0, 16);
      return <StackedColumns height={300} format={n0} data={ps.map((p) => ({ x: shortName(p.name), ...originCells(p.origin) }))} parts={originParts} />;
    },
  }),
  wide({
    id: "peopleClosed", page: "figures", title: "Tickets closed, by person",
    hint: ({ f }) => `${periodOf(f)} · by their close date and their owner · beside it, what came in to them · the Back Office team, the other owners folded`,
    body: ({ f }) => <TeamBars f={f} rows={peopleOf(f).filter((p) => p.closed).sort((a, b) => b.closed - a.closed).map((p) => ({ id: p.id, label: p.name, value: p.closed, secondary: `${int(p.created)} came in` }))} format={(v) => int(v ?? 0)} empty="No ticket closed for this choice." />,
  }),
  {
    id: "peopleSpeed", page: "figures", title: "Days to close, by person",
    hint: ({ f }) => `${periodOf(f)} · the tickets created in the period and closed since, on average, by their owner`,
    body: ({ f }) => <TeamBars f={f} rows={peopleOf(f).filter((p) => p.dn).sort((a, b) => b.created - a.created).map((p) => ({ id: p.id, label: p.name, value: p.days / p.dn, secondary: `${int(p.dn)} of ${int(p.created)} closed` }))} format={days} empty="No ticket closed for this choice." />,
  },
  {
    id: "peopleReply", page: "figures", title: "Days to the first reply, by person",
    hint: ({ f }) => `${periodOf(f)} · to the first agent e-mail reply, on average, by the ticket's owner`,
    body: ({ f }) => {
      const by = new Map<string, { s: number; n: number }>();
      eachRow(f, "created", (t, r) => { if (r[RW.reply] < 0) return; const x = by.get(t.owner) ?? { s: 0, n: 0 }; x.s += r[RW.reply] / 10; x.n++; by.set(t.owner, x); });
      return <TeamBars f={f} rows={[...by].sort((a, b) => b[1].n - a[1].n).map(([id, x]) => ({ id, label: ownerName(f, id), value: x.s / x.n, secondary: `${int(x.n)} answered` }))} format={days} empty="No ticket answered for this choice." />;
    },
  },
  wide({
    id: "peopleMonths", page: "figures", title: "Each person, month by month",
    hint: ({ f }) => `${periodOf(f)} · what came in to each and what each closed, month by month, on one scale · the Back Office team, the other owners folded`,
    body: ({ f }) => <PersonMonths f={f} people={peopleOf(f).filter((p) => p.created || p.closed)} />,
  }),
  {
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
  },
  {
    id: "noAnswerPeople", page: "figures", title: "Customer tickets closed without any answer, by person",
    hint: ({ f }) => `${periodOf(f)} · by the ticket's owner · beside it, the share of their customer tickets`,
    body: ({ f }) => {
      const by = new Map<string, { k: number; all: number }>();
      eachRow(f, "created", (t, r) => { if (t.origin !== "Customer") return; const x = by.get(t.owner) ?? { k: 0, all: 0 }; x.all++; if (unanswered(r, t)) x.k++; by.set(t.owner, x); });
      return <TeamBars f={f} rows={[...by].filter(([, x]) => x.k).sort((a, b) => b[1].k - a[1].k).map(([id, x]) => ({ id, label: ownerName(f, id), value: x.k, secondary: `${pct(x.k / x.all)} of ${int(x.all)}` }))} format={(v) => int(v ?? 0)} empty="None for this choice." />;
    },
  },
  trend("ticketsPerHour", "figures", "Tickets per hour worked", "The tickets that came in against the hours typed in for the month", (k) => (k.hoursPerTicket ? 1 / k.hoursPerTicket : null), (v) => (v == null ? "—" : v.toFixed(2)), (v) => (v == null ? "" : v.toFixed(1))),
  wide({
    id: "weekday", page: "figures", title: "When the work comes in and goes out, by weekday",
    hint: ({ f }) => `${periodOf(f)} · the tickets by the weekday they came in, and the weekday they were closed`,
    body: ({ f }) => {
      const came = WEEKDAYS.map(() => 0), shut = WEEKDAYS.map(() => 0);
      eachRow(f, "created", (_t, r, i) => { came[weekdayOf(f.cur[i].ym, r[RW.day])]++; });
      eachRow(f, "closed", (_t, r, i) => { shut[weekdayOf(f.cur[i].ym, r[RCL.day])]++; });
      return <GroupedColumns height={240} format={n0} currentLabel="Came in" priorLabel="Closed" currentFirst data={WEEKDAYS.map((x, i) => ({ x, current: came[i], prior: shut[i] }))} />;
    },
  }),
  {
    id: "peopleDay", page: "figures", title: "Tickets closed per working day, by person",
    hint: ({ f }) => `${periodOf(f)} · each person's tickets closed against the ${int(workingDays(f))} working days, Monday to Friday`,
    body: ({ f }) => {
      const wd = Math.max(1, workingDays(f));
      return <TeamBars f={f} rows={peopleOf(f).filter((p) => p.closed).sort((a, b) => b.closed - a.closed).map((p) => ({ id: p.id, label: p.name, value: p.closed / wd, secondary: `${int(p.closed)} closed` }))} format={(v) => (v == null ? "—" : v.toFixed(1))} empty="No ticket closed for this choice." />;
    },
  },
  wide({
    id: "overall", page: "figures", title: "For every 100 orders",
    hint: ({ f }) => `${periodOf(f)} · the orders by profit centre, and the Back Office tickets that came in against them, by topic - per 100 orders`,
    body: ({ f }) => {
      const orders = f.total.orders ?? 0;
      const pcs = sumField(f, "pcs").filter((r) => r.cur).sort((a, b) => b.cur - a.cur);
      const tops = topicRows(f).rows.filter((r) => r.cur).sort((a, b) => b.cur - a.cur);
      const per = (x: number) => (orders ? Math.round((x / orders) * 1000) / 10 : 0);
      const head = tops.slice(0, 6), rest = tops.slice(6).reduce((s, r) => s + r.cur, 0);
      const right = [...head.map((r) => ({ id: `t:${r.key}`, label: r.label, v: per(r.cur) })), ...(rest ? [{ id: "t:rest", label: "Every other topic", v: per(rest) }] : [])];
      const nodes = [
        ...pcs.map((r) => ({ id: `pc:${r.label}`, column: 0, label: r.label, color: SEQUENTIAL[4] })),
        { id: "orders", column: 1, label: "100 orders", color: SERIES[0] },
        ...right.map((r) => ({ id: r.id, column: 2, label: r.label, color: r.id === "t:rest" ? DEEMPHASIS : SERIES[1] })),
      ];
      const links = [...pcs.map((r) => ({ from: `pc:${r.label}`, to: "orders", value: per(r.cur) })), ...right.map((r) => ({ from: "orders", to: r.id, value: r.v }))];
      return (
        <ChartFrame table={{ columns: ["From", "To", "Per 100 orders"], rows: links.map((l) => [l.from.replace(/^(pc|t):/, ""), l.to.replace(/^(pc|t):/, ""), l.value]), numeric: [2] }} empty={orders ? null : "No orders for this choice."}>
          <Box sx={{ overflowX: "auto" }}><Box sx={{ minWidth: 760 }}>
            <Sankey height={380} columns={["Orders by profit centre", "Per 100 orders", "Tickets by topic"]} label="For every 100 orders" nodes={nodes} links={links} format={(v) => v.toLocaleString("en", { maximumFractionDigits: 1 })} />
          </Box></Box>
        </ChartFrame>
      );
    },
  }),
  wide({
    id: "csat", page: "figures", title: "The survey after a ticket is closed, month by month",
    hint: () => "The customers' answers to the survey sent at random after a Back Office ticket is closed - by the month they answered; the ticket filters do not apply",
    body: ({ f, d }) => <StackedColumns height={260} format={n0} data={surveyMonths(f, d).map((x, i) => ({ x: f.labels[i], ...x }))} parts={FEELINGS} />,
  }),
  {
    id: "csatScore", page: "figures", title: "Happy customers, month by month",
    hint: () => "Of the month's answers to the survey after a closed ticket, the share happy",
    body: ({ f, d }) => {
      const share = (x: Record<string, number>) => { const n = x.happy + x.neutral + x.unhappy; return n ? x.happy / n : null; };
      const cur = surveyMonths(f, d).map(share), prev = surveyMonths(f, d, true).map(share);
      return <MonthTrend values={cur} compare={prev.some((x) => x != null) ? prev : null} labels={f.labels.slice(0, drawn(f))} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={share0} />;
    },
  },
  wide({
    id: "surveyTable", page: "figures", title: "Every answer to the survey",
    hint: ({ f }) => `${periodOf(f)} · the newest first · what the customer wrote, and the ticket it was about`,
    body: ({ f, d }) => <SurveyTable f={f} d={d} />,
  }),
  {
    id: "closeByTopic", page: "figures", title: "Days to close, by topic",
    hint: ({ f }) => `${periodOf(f)} · tickets created in the period and closed since, on average · topics with 5 or more, the slowest first`,
    body: ({ f }) => <BarList rows={topicSpeed(f, RW.close)} format={days} labelWidth={180} emptyMessage="No ticket closed for this choice." />,
  },
  {
    id: "replyByTopic", page: "figures", title: "Days to the first reply, by topic",
    hint: ({ f }) => `${periodOf(f)} · to the first agent e-mail reply, on average · topics with 5 or more, the slowest first`,
    body: ({ f }) => <BarList rows={topicSpeed(f, RW.reply)} format={days} labelWidth={180} emptyMessage="No ticket answered for this choice." />,
  },
  wide({
    id: "pcLines", page: "figures", title: "Order lines per profit centre", hint: ({ f }) => `${f.doneWords || f.year} - each line's profit centre as its order names it, else its article's (learnt from every order line that names one)`,
    body: ({ f }) => {
      const rows = sumField(f, "linePcs");
      return <DimChart title="" rows={rows} cur={(r) => r.cur} prev={(r) => r.prev} curLabel={`${f.doneWords} ${f.year}`} prevLabel={f.totalPrev ? `${f.doneWords} ${f.year - 1}` : ""} single={!f.totalPrev || rows.every((r) => !r.prev)} fmt={int} />;
    },
  }),
  trend("resolution", "figures", "Days to close", "Tickets created in the month and closed since, on average", (k) => k.resolution, days, daysTick),
  trend("reply", "figures", "Days to the first reply", "To the first agent e-mail reply, tickets created in the month", (k) => k.firstReply, days, daysTick),
  trend("hours", "figures", "Hours worked", "Typed in per month (Abacus) - not in HubSpot", (k) => k.hours, hrs),
  trend("perHour", "figures", "Hours per ticket", "Hours worked against the tickets created - where the hours are typed in", (k) => k.hoursPerTicket, (v) => (v == null ? "—" : `${v.toFixed(2)} h`), (v) => (v == null ? "" : v.toFixed(2))),
  trend("orders", "figures", "Orders", "By order date - an order number once whatever its deliveries", (k) => k.orders, n0),
  trend("lines", "figures", "Order lines", "Per order, the lines of its largest delivery", (k) => k.lines, n0),
  trend("perOrder", "figures", "Tickets per order", "Tickets created against the month's orders (an order number once, credit notes out)", (k) => k.perOrder, share),
  trend("perLine", "figures", "Tickets per order line", "Tickets created against the month's order lines", (k) => k.perLine, share),
  wide({
    id: "tones", page: "figures", title: "The tone the sentiment sweep heard, month by month",
    hint: () => "The tickets the sentiment sweep scored, by the tone it heard - those it could not score left out",
    body: ({ f }) => {
      const n = drawn(f);
      const of = (m: BoMonth, k: string) => (m.pending || !hasTickets(m.ym) ? null : m.tones?.[k] ?? 0);
      return <StackedColumns height={260} format={n0} data={f.cur.slice(0, n).map((m, i) => ({ x: f.labels[i], positive: of(m, "positive"), neutral: of(m, "neutral"), negative: of(m, "negative") }))}
        parts={[{ key: "positive", label: "Positive", color: SERIES[2] }, { key: "neutral", label: "Neutral", color: DEEMPHASIS }, { key: "negative", label: "Negative", color: TONE_RED }]} />;
    },
  }),
  trend("neutral", "figures", "Neutral feeling", "Of the tickets the sentiment sweep scored, the share it found neutral", (k) => k.neutral, share),
  trend("negative", "figures", "Negative feeling", "Of the tickets the sentiment sweep scored, the share it found negative", (k) => k.negative, share),
  wide({
    id: "pcs", page: "figures", title: "Orders per profit centre", hint: ({ f }) => `${f.doneWords || f.year} - an order counts for the profit centre it names, else the one most of its lines are in (the line's own, else its article's)`,
    body: ({ f }) => {
      const rows = sumField(f, "pcs");
      return <DimChart title="" rows={rows} cur={(r) => r.cur} prev={(r) => r.prev} curLabel={`${f.doneWords} ${f.year}`} prevLabel={f.totalPrev ? `${f.doneWords} ${f.year - 1}` : ""} single={!f.totalPrev} fmt={int} />;
    },
  }),

  /* Topics - the workbook's "BO tickets per topic" */
  {
    id: "topics", page: "topics", title: "Tickets per topic", hint: ({ pick }) => (pick ? "Click topics to follow only them month by month" : "The topic each ticket has today"),
    body: ({ f, picked, pick }) => {
      const { compare, rows } = topicRows(f);
      return <DimChart title="" rows={rows} cur={(r) => r.cur} prev={(r) => r.prev} curLabel={f.doneWords ? `${f.doneWords} ${f.year}` : String(f.year)} prevLabel={compare ? `${f.doneWords} ${f.year - 1}` : ""}
        single={!compare} fmt={int} selected={picked} onPick={pick} pickHint="Click topics to follow only them month by month" pageSize={20} />;
    },
  },
  {
    id: "topicMonths", page: "topics", title: "Month by month", hint: ({ picked }) => `${picked?.length ? picked.join(", ") : "Every topic"} - the topic each ticket has today; tickets re-filed since move with it`,
    body: ({ f, picked }) => {
      const { all } = topicRows(f);
      const keys = picked?.length ? all.filter((t) => picked.includes(topicLabel(t))) : all;
      const pickN = (m: BoMonth | null) => (m && hasTickets(m.ym) && !m.pending ? keys.reduce((s, t) => s + (m.topics[t] ?? 0), 0) : null);
      const n = drawn(f);
      return <MonthTrend values={f.cur.slice(0, n).map(pickN)} compare={f.prev.some((x) => x && hasTickets(x.ym)) ? f.prev.slice(0, n).map(pickN) : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={n0} />;
    },
  },
  wide({
    id: "topicMinis", page: "topics", title: "Each topic, month by month",
    hint: ({ f }) => `${f.doneWords} ${f.year} · a small graph per topic, its last month darker${f.totalPrev ? ` · the change against the same months of ${f.year - 1}` : ""}`,
    body: ({ f }) => {
      const { compare, rows } = topicRows(f);
      const n = drawn(f);
      return <Minis items={rows.filter((r) => r.cur > 0).sort((a, b) => b.cur - a.cur).map((r) => ({
        label: r.label, value: int(r.cur), ch: compare && r.prev ? changeOf(r.cur, r.prev) : null, lower: true,
        values: f.cur.slice(0, n).map((m) => (hasTickets(m.ym) && !m.pending ? m.topics[r.key] ?? 0 : null)),
      }))} />;
    },
  }),
  wide({
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
  }),
  wide(topicTrend("delivery", "Delivery tickets", ["Delivery"], "The workbook's biggest topic - \"delivery biggest issue\"")),
  trend("c2s", "topics", "C2S tickets", "Cut-to-size: a C2S ticket, a problem order, or C2S in the subject - the workbook asks for the first impact of C2S V1 and V2", (k) => k.c2s, n0),
  trend("c2sDelivery", "topics", "C2S tickets filed Delivery", "The C2S tickets among Delivery", (k) => k.c2sDelivery, n0),
  topicTrend("cancel", "Order cancellations", ["Order Cancellation"], "Tickets filed Order Cancellation - a KPI of its own, as the workbook's New KPIs ask"),
  topicTrend("cancelPerOrder", "Order cancellations per order", ["Order Cancellation"], "Cancellation tickets against the month's orders", true),
  {
    id: "othersWhat", page: "topics", title: "What is inside Others",
    hint: ({ f }) => `${f.doneWords} ${f.year} · the workbook's Others, each kind on its own today - its question: "the amount of Others is still huge, do we know what is inside?"`,
    body: ({ f }) => {
      const inside = topicRows(f).rows.filter((r) => OTHERS.includes(r.key) && r.cur > 0).sort((a, b) => b.cur - a.cur);
      const tot = inside.reduce((s, r) => s + r.cur, 0);
      return <BarList rows={inside.map((r) => ({ label: r.label, value: r.cur, secondary: tot ? pct(r.cur / tot) : "" }))} format={(v) => int(v ?? 0)} labelWidth={180} emptyMessage="Nothing in Others for these months." />;
    },
  },
  topicTrend("othersMonths", "Others, month by month", OTHERS, "Every kind of Others together"),

  /* ESO & TSA tickets - the workbook's inbound table */
  wide(trend("eso", "sales-tickets", "ESO tickets", "The ESO's inbound tickets - the sales actions left out", (k) => k.eso, n0)),
  trend("esoO", "sales-tickets", "ESO tickets per order", "Inbound against the month's orders", (k) => k.esoPerOrder, share),
  trend("esoL", "sales-tickets", "ESO tickets per order line", "Inbound against the month's order lines", (k) => k.esoPerLine, share),
  wide(trend("tsa", "sales-tickets", "TSA tickets", "The TSA's inbound tickets - the sales actions left out", (k) => k.tsa, n0)),
  trend("tsaO", "sales-tickets", "TSA tickets per order", "Inbound against the month's orders", (k) => k.tsaPerOrder, share),
  trend("tsaL", "sales-tickets", "TSA tickets per order line", "Inbound against the month's order lines", (k) => k.tsaPerLine, share),
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

  /* GQS */
  wide(trend("gqs", "gqs", "GQS tasks created", "Back Office - Special Tasks GQS, by the month they were created", (k) => k.gqsCreated, n0)),
  trend("gqsSent", "gqs", "Days before sent to GQS", "From entering Open the GQS Task to entering Waiting on GQS - or Waiting on APSO, where a task was put by mistake - on average", (k) => k.gqsSent, days, daysTick),
  trend("gqsDone", "gqs", "Days to close", "HubSpot's time to close - to the offer sent to Sales, or refused; the tasks closed so far", (k) => k.gqsResolution, days, daysTick),

  /* OTD - typed in */
  wide(typedTrend("otdAll", "otd", "OTD online, all", "otd.online-all", "With early call-offs, by the first confirmation date", "pct")),
  typedTrend("otdStandard", "otd", "OTD online, standard", "otd.online-standard", "Standard articles", "pct"),
  typedTrend("otdSpecial", "otd", "OTD online, special", "otd.online-special", "Special articles", "pct"),
  wide({
    id: "otdMinis", page: "otd", title: "Each profit centre, month by month", hint: () => "Standard and special articles, as typed in · the dashed line at 80 %",
    body: ({ f, d }) => {
      const yms = f.yms.slice(0, drawn(f));
      const lastOf = (xs: (number | null)[]) => [...xs].reverse().find((x) => x != null) ?? null;
      return <Minis legend={["Standard", "Special"]} items={PCS.map((pc) => {
        const std = typedOf(d, `otd.${pc.toLowerCase()}-standard`, yms), spe = typedOf(d, `otd.${pc.toLowerCase()}-special`, yms);
        return { label: pc, values: std, values2: spe, value: `${share(lastOf(std))} · ${share(lastOf(spe))}`, sub: "standard · special, the last month typed in" };
      })} />;
    },
  }),
  wide({
    id: "otdPc", page: "otd", title: "OTD per profit centre", hint: ({ f }) => `${f.doneWords || f.year} on average - standard and special articles`,
    body: ({ f, d }) => {
      const yms = f.yms.slice(f.from, Math.max(f.done, 1));
      const rows = PCS.map((pc) => ({ label: pc, std: meanOf(typedOf(d, `otd.${pc.toLowerCase()}-standard`, yms)) ?? 0, spc: meanOf(typedOf(d, `otd.${pc.toLowerCase()}-special`, yms)) ?? 0 }));
      return <DimChart title="" rows={rows} cur={(r) => r.std} prev={(r) => r.spc} curLabel="Standard" prevLabel="Special" fmt={(v) => pct(v)} fixedOrder />;
    },
  }),

  /* KPI autonomy - typed in */
  typedTrend("pass100", "autonomy", "Pass rate, mandant 100", "pass.m100", "Target 95 %", "pct", 0.95),
  typedTrend("pass110", "autonomy", "Pass rate, mandant 110", "pass.m110", "Target 95 %", "pct", 0.95),
  typedTrend("price100", "autonomy", "Manual price adjustments, mandant 100", "price.m100", "Target below 2.5 %", "pct", 0.025),
  typedTrend("price110", "autonomy", "Manual price adjustments, mandant 110", "price.m110", "Target below 2.5 %", "pct", 0.025),

  /* Stopped orders - typed in */
  {
    id: "stopped", page: "stopped", title: "Stopped orders, month by month", hint: () => "Of the Magento orders transferred to the Back Office, the share stopped",
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
  const actions = <TileActions where={where} start="tab" edge={2} tile={{ key: chartKey(def), page: `bo-${def.page}`, tab: "main", title: def.title, kind: "card", href: hrefOf(def.page) }} />;
  return <ChartBox title={def.title} hint={def.hint?.(c)} actions={actions}>{def.body(c)}</ChartBox>;
}

/* ── a tab per question, one card that follows it (as ESO's ticket pages) ── */

type TabDef = { id: string; label: string; title: string; note: string; icon: React.ReactNode; tint: Tint; charts: string[] };
/** the workbook's table, a tab of its own (SARCLA 03.11.2026: "the table should be a separate tab", "not on every page") */
const TABLE = (note: string): TabDef => ({ id: "table", label: "Table", title: "All the figures, month by month", note, icon: <TableChartOutlinedIcon />, tint: "slate", charts: [] });
const TYPE_IN: TabDef = { id: "input", label: "Type in", title: "Typed in by the Back Office", note: "not in HubSpot - a month typed in saves when you leave the field", icon: <EditNoteOutlinedIcon />, tint: "slate", charts: [] };
const TABS: Record<Slug, TabDef[]> = {
  figures: [
    TABLE("the workbook's rows, a month a column - the last columns add up the complete months"),
    { id: "volume", label: "Volume", title: "Tickets created and closed", note: "the workbook's first rows: what came in and from where, what was closed, the queue between them", icon: <ConfirmationNumberOutlinedIcon />, tint: "blue", charts: ["createdClosed", "backlog", "origins", "created", "chat"] },
    { id: "people", label: "People", title: "Who handles the tickets", note: "each ticket's owner today: what came in to them and from where, what they closed - the Back Office team, the other owners folded", icon: <BadgeOutlinedIcon />, tint: "green", charts: ["peopleOrigin", "peopleClosed", "peopleMonths"] },
    { id: "speed", label: "Speed", title: "How fast", note: "days to the first reply and to close, the customers' tickets closed without any answer - by month, person and topic", icon: <TimerOutlinedIcon />, tint: "amber", charts: ["reply", "resolution", "noAnswer", "noAnswerPeople", "peopleReply", "peopleSpeed", "replyByTopic", "closeByTopic"] },
    { id: "workload", label: "Workload", title: "The team's workload", note: "the hours typed in (Abacus) against the tickets, when the work comes in, what each person closes a working day", icon: <WorkHistoryOutlinedIcon />, tint: "purple", charts: ["hours", "ticketsPerHour", "weekday", "peopleDay", "perHour"] },
    { id: "ratios", label: "Orders & ratios", title: "Tickets against the orders", note: "an order number once, credit notes out · its profit centre the one it names, else most of its lines'", icon: <ShoppingCartOutlinedIcon />, tint: "green", charts: ["overall", "pcs", "pcLines", "orders", "lines", "perOrder", "perLine"] },
    { id: "tone", label: "Sentiment", title: "Sentiment", note: "the survey sent after a ticket is closed, and the tone the sentiment sweep heard in the tickets", icon: <SentimentNeutralOutlinedIcon />, tint: "slate", charts: ["csat", "csatScore", "neutral", "tones", "negative", "surveyTable"] },
  ],
  topics: [
    TABLE("the workbook's topic table: Back Office tickets per topic, by the month they came in"),
    { id: "all", label: "All topics", title: "Tickets per topic", note: "the topic each ticket has today · click topics to follow them month by month", icon: <CategoryOutlinedIcon />, tint: "amber", charts: ["topics", "topicMonths"] },
    { id: "months", label: "Month by month", title: "Each topic, month by month", note: "the shape of every topic, and the mix of each month", icon: <BarChartOutlinedIcon />, tint: "blue", charts: ["topicMinis", "topicShare"] },
    { id: "delivery", label: "Delivery & C2S", title: "Delivery and C2S", note: "the biggest topic, and the first impact of C2S V1 and V2", icon: <ContentCutOutlinedIcon />, tint: "pink", charts: ["delivery", "c2s", "c2sDelivery"] },
    { id: "cancel", label: "Order cancellations", title: "Order cancellations", note: "a KPI of its own, as the workbook's New KPIs ask", icon: <CancelOutlinedIcon />, tint: "purple", charts: ["cancel", "cancelPerOrder"] },
    { id: "others", label: "Inside Others", title: "What is inside Others", note: "the workbook's Others, each kind on its own", icon: <ManageSearchOutlinedIcon />, tint: "slate", charts: ["othersWhat", "othersMonths"] },
  ],
  "sales-tickets": [
    TABLE("the workbook's table: the ESO's and the TSA's inbound tickets against the month's orders and order lines"),
    { id: "eso", label: "ESO", title: "The ESO's inbound tickets", note: "the sales actions left out", icon: <GroupsOutlinedIcon />, tint: "blue", charts: ["eso", "esoO", "esoL"] },
    { id: "tsa", label: "TSA", title: "The TSA's inbound tickets", note: "the sales actions left out", icon: <SupportAgentOutlinedIcon />, tint: "green", charts: ["tsa", "tsaO", "tsaL"] },
    { id: "all", label: "APSOparts in total", title: "Every ticket of APSOparts", note: "every pipeline, the ESO's and the TSA's sales actions left out", icon: <ApartmentOutlinedIcon />, tint: "purple", charts: ["stack", "allO", "allL"] },
  ],
  gqs: [
    TABLE("every GQS task, by the month it was created"),
    { id: "gqs", label: "GQS", title: "GQS tasks", note: "how many, how long before sent to GQS, how long to close", icon: <AssignmentOutlinedIcon />, tint: "green", charts: ["gqs", "gqsSent", "gqsDone"] },
  ],
  otd: [
    { id: "online", label: "Online", title: "OTD online", note: "with early call-offs, against the first confirmation date", icon: <LocalShippingOutlinedIcon />, tint: "pink", charts: ["otdAll", "otdStandard", "otdSpecial"] },
    { id: "pcs", label: "Profit centres", title: "OTD per profit centre", note: "standard and special articles", icon: <ApartmentOutlinedIcon />, tint: "blue", charts: ["otdMinis", "otdPc"] },
    TYPE_IN,
  ],
  autonomy: [
    { id: "pass", label: "Pass rate", title: "Pass rate per mandant", note: "orders through without a hand on them · target 95 %", icon: <VerifiedOutlinedIcon />, tint: "green", charts: ["pass100", "pass110"] },
    { id: "price", label: "Manual prices", title: "Manual price adjustments per mandant", note: "order lines whose price was changed by hand · target below 2.5 %", icon: <PriceChangeOutlinedIcon />, tint: "amber", charts: ["price100", "price110"] },
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
        <CardTitle icon={t.icon} tint={t.tint} title={`${t.title}, ${periodOf(f)}`} note={t.note} />
        {t.charts.length > 0 && (
          <Box sx={{ ...TWO, mt: -0.5 }}>
            {t.charts.map((id) => {
              const def = CHARTS.find((x) => x.page === slug && x.id === id);
              return def ? <Box key={id} sx={{ minWidth: 0, ...(def.wide ? { gridColumn: "1 / -1" } : {}) }}><Card def={def} c={c} where="tab" /></Box> : null;
            })}
          </Box>
        )}
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
            {a.state.computing && <> · <CircularProgress size={10} sx={{ mx: 0.4 }} />{d.pending?.length ? `counting - ${d.pending.length} of ${d.pending.length + d.months.length} months still to come, the newest first` : "counting again"}</>}
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
type KRow = { key: string; label: string; pick: (k: BoKpis) => number | null; fmt: (v: number | null) => string; lower?: boolean; strong?: boolean; whole?: boolean; section?: string };
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
function AllFigures({ f, rows, title = "All the figures, month by month", hint }: { f: Frame; rows: KRow[]; title?: string; hint?: string }) {
  const sum = f.doneWords ? `${f.doneWords} ${f.year}` : String(f.year);
  const head = ["KPI", ...f.labels.map((l) => l.replace(" (to date)", "*")), sum, ...(f.totalPrev ? [`${f.doneWords} ${f.year - 1}`, "Change"] : [])];
  return (
    <ChartBox title={title} hint={hint ?? `${f.labels.some((l) => l.includes("to date")) ? "* to date - " : ""}the workbook's rows · the last columns add up the complete months`}>
      <WTable head={head} totals={f.totalPrev ? 3 : 1} rows={rows.map((r) => {
        const a = r.pick(f.total), b = f.totalPrev ? r.pick(f.totalPrev) : null;
        const ch = a != null && b != null ? changeOf(a, b) : null;
        return {
          key: r.key, strong: r.strong, section: r.section,
          cells: [r.label, ...f.yms.map((_, i) => (r.whole && f.labels[i].includes("to date") ? "—" : r.fmt(r.pick(f.k(i))))), r.fmt(a),
            ...(f.totalPrev ? [r.fmt(b), <Box key="ch" component="span" sx={{ color: tone(ch, r.lower) }}>{signedPct(ch)}</Box>] : [])],
        };
      })} />
    </ChartBox>
  );
}

/* ── Team totals ───────────────────────────────────────────────────────── */

const TEAM_ROWS: KRow[] = [
  { key: "created", label: "Number of tickets created", pick: (k) => k.created, fmt: n0, strong: true, section: "Tickets" },
  { key: "closed", label: "Number of tickets closed", pick: (k) => k.closed, fmt: n0, section: "Tickets" },
  { key: "chat", label: "Number of chat tickets", pick: (k) => k.chat, fmt: n0, section: "Tickets" },
  { key: "reply", label: "Avg. first response time (days)", pick: (k) => k.firstReply, fmt: d1, lower: true, section: "Speed" },
  { key: "resolution", label: "Avg. resolution time (days)", pick: (k) => k.resolution, fmt: d1, lower: true, section: "Speed" },
  { key: "orders", label: "Orders", pick: (k) => k.orders, fmt: n0, section: "Orders" },
  { key: "lines", label: "Order lines", pick: (k) => k.lines, fmt: n0, section: "Orders" },
  { key: "perLine", label: "Ratio tickets vs order lines", pick: (k) => k.perLine, fmt: share, lower: true, whole: true, section: "Orders" },
  { key: "perOrder", label: "Ratio tickets vs orders", pick: (k) => k.perOrder, fmt: share, lower: true, whole: true, section: "Orders" },
  { key: "hours", label: "Hours worked", pick: (k) => k.hours, fmt: hrs, section: "Workload" },
  { key: "perHour", label: "Avg. hours per ticket", pick: (k) => k.hoursPerTicket, fmt: (v) => (v == null ? "—" : v.toFixed(2)), whole: true, section: "Workload" },
  { key: "gqs", label: "Number of GQS tasks created", pick: (k) => k.gqsCreated, fmt: n0, section: "GQS" },
  { key: "gqsSent", label: "Avg. time before sent to GQS (days)", pick: (k) => k.gqsSent, fmt: d1, lower: true, section: "GQS" },
  { key: "gqsDone", label: "Avg. resolution time GQS (days)", pick: (k) => k.gqsResolution, fmt: d1, lower: true, section: "GQS" },
  { key: "neutral", label: "Neutral feeling (share of scored)", pick: (k) => k.neutral, fmt: share, section: "Sentiment" },
  { key: "negative", label: "Negative feeling (share of scored)", pick: (k) => k.negative, fmt: share, lower: true, section: "Sentiment" },
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

function HoursCard({ f, can, put }: { f: Frame; can: boolean; put: Put }) {
  const [msg, setMsg] = useState<string | null>(null);
  const save = (ym: string) => async (v: string) => {
    const n = v.trim() === "" ? null : Number(v.replace(",", "."));
    if (n !== null && !Number.isFinite(n)) { setMsg("Hours are a number, e.g. 908.6"); return; }
    try { await put({ ym, hours: n }); setMsg(null); } catch (e) { setMsg(String((e as Error).message)); }
  };
  return (
    <ChartBox title="Hours worked - typed in" hint={can ? "Not in HubSpot - typed in per month (Abacus); the hours per ticket follow" : "Not in HubSpot - typed in per month by the Back Office (Abacus)"}>
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
        {f.yms.map((ym, i) => (
          <Box key={ym} sx={{ ...glass, borderRadius: "12px", px: 1.2, py: 0.8, display: "grid", gap: 0.2 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{f.labels[i]}</Typography>
            <Cell value={f.hours[i]} fmt={hrs} can={can} label={`Hours worked, ${f.labels[i]}`} onSave={save(ym)} />
          </Box>
        ))}
      </Box>
      {msg && <Typography sx={{ fontSize: "0.78rem", color: "#c5221f" }}>{msg}</Typography>}
    </ChartBox>
  );
}

export function BoFiguresPage() {
  return (
    <Page slug="figures">
      {(f, d, a, put) => (
        <>
          <TabCard slug="figures" c={{ f, d }} extra={(tab) => (tab === "workload" ? <HoursCard f={f} can={a.canEdit} put={put} /> : tab === "table" ? <AllFigures f={f} rows={TEAM_ROWS} title="The workbook's team totals" /> : null)} />
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
      <ChartBox title="The workbook's topic table" hint="The workbook's topic table: Back Office tickets per topic, by the month they came in - what the workbook calls Others is each of its own today (automatic, finance, internal e-mails, spam ...)">
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
          <TabCard slug="sales-tickets" c={{ f, d }} extra={(tab) => tab === "table" && <AllFigures f={f} rows={SALES_ROWS} title="The workbook's table" hint="The ESO's and the TSA's inbound tickets (the UC hand-overs and the pushes - erosion, win back, the September push, price checks - left out) against the month's orders and order lines" />} />
        </>
      )}
    </Page>
  );
}

/* ── GQS ───────────────────────────────────────────────────────────────── */

const GQS_ROWS: KRow[] = [
  { key: "gqs", label: "Number of GQS tasks created", pick: (k) => k.gqsCreated, fmt: n0, strong: true },
  { key: "gqsSent", label: "Avg. time before sent to GQS (days)", pick: (k) => k.gqsSent, fmt: d1, lower: true },
  { key: "gqsDone", label: "Avg. resolution time GQS (days)", pick: (k) => k.gqsResolution, fmt: d1, lower: true },
];

export function BoGqsPage() {
  return (
    <Page slug="gqs">
      {(f, d) => <TabCard slug="gqs" c={{ f, d }} extra={(tab) => tab === "table" && <AllFigures f={f} rows={GQS_ROWS} title="The workbook's GQS rows" hint="Every GQS task, by the month it was created - the last columns add up the complete months" />} />}
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

function TypedPage({ slug, note }: { slug: Slug; note: string }) {
  return (
    <Page slug={slug}>
      {(f, d, a, put) => (
        <>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{note}</Typography>
          <TabCard slug={slug} c={{ f, d }} extra={(tab) => tab === "input" && TYPED.filter((s) => TYPED_ON[slug]?.includes(s.id)).map((s) => <TypedTable key={s.id} s={s} f={f} d={d} can={canType(a, s.id)} put={put} />)} />
        </>
      )}
    </Page>
  );
}

export function BoOtdPage() {
  return <TypedPage slug="otd" note="Not in HubSpot - no order carries its first confirmation date - so the Back Office types each month in; the workbook's own figures to start." />;
}
export function BoAutonomyPage() {
  return <TypedPage slug="autonomy" note="Not in HubSpot - the ERP knows which orders went through untouched and which prices were changed by hand - so the Back Office types each month in; the workbook's own figures to start." />;
}
export function BoStoppedPage() {
  return <TypedPage slug="stopped" note="Not in HubSpot - no order says it was stopped, or why - so the Back Office types each month in; the workbook's own figures to start." />;
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

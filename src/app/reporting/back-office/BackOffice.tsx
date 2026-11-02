"use client";
// BACK-OFFICE REPORTS (SARCLA 02.11.2026: "and the back office reports based on file?" - his picks "Live, file = the KPI
// list" and "like on the ESO / TSA, split per topic"): the Back Office's KPI workbook (sheet "BO KPI") worked out live, a
// page per part - Figures (the team totals), Topics, Sales tickets (ESO / TSA / all against the orders), GQS, OTD &
// autonomy (typed in: not in HubSpot) - and, first, the BUC View as ESO's and TSA's (SARCLA 03.11.2026: "BUC View is
// missing on Back-Office Reports - did you read this file and what is expected?"): a panel per page, its figures, the
// graphs sent there with Actions. Each month of the year beside last year's, the figures over the complete months, "All
// the figures" laid out as the workbook (a KPI a row, a month a column). Rules: src/lib/reporting/boReportRules.ts.
//
// Every graph is defined once (CHARTS) and drawn the same on its page and in the BUC View, keyed "bo-<page>:main:<id>".

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";

import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { Badge, FAINT, GlassCard, INK, MUTED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ChartBox, H1, TWO } from "@/app/reporting/eso-benchmark/Figures";
import { MonthTrend } from "@/app/reporting/eso-benchmark/TicketsCharts";
import { BucEmpty } from "@/app/reporting/eso-benchmark/BucEmpty";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import { Choices, FigureCards, MONTHS, changeOf, int, pct, tone, signedPct, type Fig } from "@/app/reporting/products/views/kit";
import type { BoRead } from "@/lib/reporting/boReport";
import {
  TOPIC_ORDER, TYPED, emptyMonth, hasTickets, kpisOf, sumGqs, sumMonths, topicLabel, typedKey,
  type BoKpis, type BoMonth, type GqsMonth, type Typed, type TypedSeries,
} from "@/lib/reporting/boReportRules";

/* ── the read ──────────────────────────────────────────────────────────── */

type Data = BoRead & { hours: Record<string, number>; typed: Typed; inbound: { eso: Record<string, number>; tsa: Record<string, number> } | null };
type Answer = { state: { computing: boolean; progress: string | null; error: string | null; computedAt: string | null }; data: Data | null; canEdit: boolean; canEditTyped: boolean };
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
  year: number; years: number[]; setYear: (y: number) => void;
  yms: string[]; labels: string[];
  /** the year's months, and last year's same months (null: not read - two years back) */
  cur: BoMonth[]; prev: (BoMonth | null)[]; gqs: GqsMonth[]; gqsPrev: (GqsMonth | null)[];
  hours: (number | null)[]; hoursPrev: (number | null)[];
  /** the complete months - the figures and the totals add these up, from `from` (the first with tickets in HubSpot) */
  done: number; from: number; doneWords: string;
  k: (i: number) => BoKpis; kPrev: (i: number) => BoKpis | null;
  total: BoKpis; totalPrev: BoKpis | null;
  /** the ESO's and the TSA's tickets are the inbound ones (the ESO Reports' read is in) - else every ticket */
  inbound: boolean;
};

function useFrame(d: Data): Frame {
  const cy = Number(d.current.slice(0, 4));
  const [year, setYear] = useState(cy);
  return useMemo(() => {
    const inb = d.inbound;
    // the ESO's and the TSA's inbound tickets in place of every ticket of their pipelines; "all" loses their sales actions too
    const withInbound = (m: BoMonth): BoMonth => {
      if (!inb || m.pending) return m;
      const e = inb.eso[m.ym] ?? 0, t = inb.tsa[m.ym] ?? 0;
      return { ...m, eso: e, tsa: t, all: m.all - Math.max(0, m.eso - e) - Math.max(0, m.tsa - t) };
    };
    const by = new Map(d.months.map((m) => [m.ym, withInbound(m)]));
    const gby = new Map(d.gqs.map((m) => [m.ym, m]));
    const last = year === cy ? Number(d.current.slice(5, 7)) : 12;
    const yms = Array.from({ length: last }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    const cur = yms.map((ym) => by.get(ym) ?? EMPTY(ym));
    const prev = yms.map((ym) => by.get(back(ym)) ?? null);
    const gqs = yms.map((ym) => gby.get(ym) ?? EMPTY_GQS(ym));
    const gqsPrev = yms.map((ym) => (by.has(back(ym)) ? gby.get(back(ym)) ?? EMPTY_GQS(back(ym)) : null));
    const hrs = (ym: string) => (d.hours[ym] != null ? d.hours[ym] : null);
    const hours = yms.map(hrs), hoursPrev = yms.map((ym) => hrs(back(ym)));
    const done = yms.filter((ym) => ym < d.current).length;
    // the totals from the first month with tickets in HubSpot - July in 2025 - so a year's figures are never all "—"
    const from = Math.min(Math.max(0, yms.findIndex(hasTickets)), Math.max(0, done - 1));
    const doneWords = done === 0 ? "" : done - from === 1 ? MONTHS[from] : `${MONTHS[from]}–${MONTHS[done - 1]}`;
    const sumH = (xs: (number | null)[]) => (xs.slice(from, done).every((x) => x != null) && done ? xs.slice(from, done).reduce<number>((s, x) => s + (x ?? 0), 0) : null);
    const total = kpisOf(sumMonths(cur.slice(from, done)), sumGqs(gqs.slice(from, done)), sumH(hours));
    const havePrev = done > 0 && prev.slice(from, done).every((x) => x);
    const totalPrev = havePrev ? kpisOf(sumMonths(prev.slice(from, done) as BoMonth[]), sumGqs(gqsPrev.slice(from, done) as GqsMonth[]), sumH(hoursPrev)) : null;
    return {
      year, years: [cy, cy - 1], setYear, yms,
      labels: yms.map((ym, i) => `${MONTHS[i]}${ym === d.current ? " (to date)" : ""}`),
      cur, prev, gqs, gqsPrev, hours, hoursPrev, done, from, doneWords,
      k: (i: number) => kpisOf(cur[i], gqs[i], hours[i]),
      kPrev: (i: number) => (prev[i] ? kpisOf(prev[i] as BoMonth, gqsPrev[i], hoursPrev[i]) : null),
      total, totalPrev, inbound: !!inb,
    };
  }, [d, year, cy]);
}

/* ── formats ───────────────────────────────────────────────────────────── */

const days = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} days`);
const daysTick = (v: number | null) => (v == null ? "" : v.toFixed(0));
const hrs = (v: number | null) => (v == null ? "—" : v.toLocaleString("en", { maximumFractionDigits: 1 }));
const n0 = (v: number | null) => (v == null ? "—" : int(v));
const share = (v: number | null) => pct(v);
const d1 = (v: number | null) => (v == null ? "—" : v.toFixed(1));

/* ── the pages ─────────────────────────────────────────────────────────── */

export type Slug = "figures" | "topics" | "sales-tickets" | "gqs" | "otd";
type PageDef = { slug: Slug; title: string; line: string; icon: React.ReactNode; tint: Tint };
export const BO_PAGES: PageDef[] = [
  { slug: "figures", title: "Figures", line: "tickets, orders, resolution, first reply, hours", icon: <BarChartOutlinedIcon />, tint: "blue" },
  { slug: "topics", title: "Topics", line: "the Back Office's tickets by topic, C2S", icon: <CategoryOutlinedIcon />, tint: "amber" },
  { slug: "sales-tickets", title: "Sales tickets", line: "ESO, TSA and all tickets against the orders", icon: <GroupsOutlinedIcon />, tint: "purple" },
  { slug: "gqs", title: "GQS", line: "special tasks with the GQS team", icon: <AssignmentOutlinedIcon />, tint: "green" },
  { slug: "otd", title: "OTD & autonomy", line: "on time, pass rate, manual prices, stopped orders - typed in", icon: <LocalShippingOutlinedIcon />, tint: "pink" },
];
const pageOf = (slug: Slug) => BO_PAGES.find((p) => p.slug === slug)!;
const hrefOf = (slug: Slug) => `/reporting/back-office/${slug}`;

/** a figure top right: this year's complete months against last year's - no change shown where last year has no figure */
const fig = (label: string, value: string, a: number | null, b: number | null | undefined, sub: string, icon: React.ReactNode, tint: Tint, lower = false): Fig =>
  ({ label, value, ch: a != null && b != null ? changeOf(a, b) : undefined, sub, icon, tint, lower });

/** the typed figures of a series' row for the given months */
const typedOf = (d: Data, key: string, yms: string[]) => yms.map((ym) => d.typed[key]?.[ym] ?? null);
const meanOf = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const stoppedShare = (d: Data, ym: string) => { const t = d.typed["stopped.transferred"]?.[ym], s = d.typed["stopped.stopped"]?.[ym]; return t && s != null ? s / t : null; };

/** The figures of a page - top right on the page, big in its BUC View panel. */
const FIGS: Record<Slug, (f: Frame, d: Data) => Fig[]> = {
  figures: (f) => [
    fig("Tickets created", n0(f.total.created), f.total.created, f.totalPrev?.created ?? null, f.doneWords || "this year", <ConfirmationNumberOutlinedIcon sx={{ fontSize: 14 }} />, "blue"),
    fig("Days to close", days(f.total.resolution), f.total.resolution, f.totalPrev?.resolution ?? null, "tickets created then, on average", <TimerOutlinedIcon sx={{ fontSize: 14 }} />, "amber", true),
    fig("Days to the first reply", days(f.total.firstReply), f.total.firstReply, f.totalPrev?.firstReply ?? null, "first agent e-mail", <ReplyOutlinedIcon sx={{ fontSize: 14 }} />, "purple", true),
    fig("Tickets per order line", share(f.total.perLine), f.total.perLine, f.totalPrev?.perLine ?? null, `${n0(f.total.lines)} order lines`, <ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />, "green", true),
  ],
  topics: (f) => {
    const t = sumMonths(f.cur.slice(f.from, f.done || f.cur.length)).topics, p = f.totalPrev?.created != null ? sumMonths(f.prev.slice(f.from, f.done) as BoMonth[]).topics : null;
    const top = Object.entries(t).filter(([k]) => k).sort((a, b) => b[1] - a[1])[0];
    const n = Object.values(t).reduce((s, x) => s + x, 0);
    return [
      fig("Tickets", int(n), n, p ? Object.values(p).reduce((s, x) => s + x, 0) : null, f.doneWords || String(f.year), <ConfirmationNumberOutlinedIcon sx={{ fontSize: 14 }} />, "blue"),
      fig(top ? top[0] : "Biggest topic", top ? int(top[1]) : "—", top?.[1] ?? null, top && p ? p[top[0]] ?? 0 : null, top && n ? `${pct(top[1] / n)} of the tickets` : "", <CategoryOutlinedIcon sx={{ fontSize: 14 }} />, "amber", true),
      fig("C2S tickets", n0(f.total.c2s), f.total.c2s, f.totalPrev?.c2s ?? null, `${n0(f.total.c2sDelivery)} of them Delivery`, <ContentCutOutlinedIcon sx={{ fontSize: 14 }} />, "pink", true),
      fig("No topic", int(t[""] ?? 0), t[""] ?? 0, p ? p[""] ?? 0 : null, "not yet given one", <HelpOutlineIcon sx={{ fontSize: 14 }} />, "slate", true),
    ];
  },
  "sales-tickets": (f) => [
    fig("ESO tickets", n0(f.total.eso), f.total.eso, f.totalPrev?.eso ?? null, `${share(f.total.esoPerLine)} of the order lines`, <GroupsOutlinedIcon sx={{ fontSize: 14 }} />, "blue", true),
    fig("TSA tickets", n0(f.total.tsa), f.total.tsa, f.totalPrev?.tsa ?? null, `${share(f.total.tsaPerLine)} of the order lines`, <SupportAgentOutlinedIcon sx={{ fontSize: 14 }} />, "green", true),
    fig("All APSOparts", n0(f.total.all), f.total.all, f.totalPrev?.all ?? null, `${share(f.total.allPerLine)} of the order lines`, <ApartmentOutlinedIcon sx={{ fontSize: 14 }} />, "purple", true),
  ],
  gqs: (f) => [
    fig("GQS tasks", n0(f.total.gqsCreated), f.total.gqsCreated, f.totalPrev?.gqsCreated ?? null, f.doneWords || String(f.year), <AssignmentOutlinedIcon sx={{ fontSize: 14 }} />, "blue"),
    fig("Days before GQS", days(f.total.gqsSent), f.total.gqsSent, f.totalPrev?.gqsSent ?? null, "in New and Open the GQS Task", <SendOutlinedIcon sx={{ fontSize: 14 }} />, "amber", true),
    fig("Days to close", days(f.total.gqsResolution), f.total.gqsResolution, f.totalPrev?.gqsResolution ?? null, "offer sent to Sales or refused", <TaskAltOutlinedIcon sx={{ fontSize: 14 }} />, "green", true),
  ],
  otd: (f, d) => {
    const doneYms = f.yms.slice(f.from, f.done), prevYms = doneYms.map(back);
    const avg = (key: string, yms: string[]) => meanOf(typedOf(d, key, yms));
    const stop = meanOf(doneYms.map((ym) => stoppedShare(d, ym))), stopPrev = meanOf(prevYms.map((ym) => stoppedShare(d, ym)));
    return [
      fig("OTD online", share(avg("otd.online-all", doneYms)), avg("otd.online-all", doneYms), avg("otd.online-all", prevYms), `${f.doneWords} on average`, <LocalShippingOutlinedIcon sx={{ fontSize: 14 }} />, "blue"),
      fig("Pass rate", share(meanOf([avg("pass.m100", doneYms), avg("pass.m110", doneYms)])), null, undefined, `target 95 % · 100: ${share(avg("pass.m100", doneYms))} · 110: ${share(avg("pass.m110", doneYms))}`, <VerifiedOutlinedIcon sx={{ fontSize: 14 }} />, "green"),
      fig("Manual prices", share(meanOf([avg("price.m100", doneYms), avg("price.m110", doneYms)])), null, undefined, `target < 2.5 % · 100: ${share(avg("price.m100", doneYms))} · 110: ${share(avg("price.m110", doneYms))}`, <PriceChangeOutlinedIcon sx={{ fontSize: 14 }} />, "amber", true),
      fig("Stopped orders", share(stop), stop, stopPrev, stop == null ? "not typed in yet" : "of the orders transferred", <BlockOutlinedIcon sx={{ fontSize: 14 }} />, "pink", true),
    ];
  },
};

/* ── the graphs, each defined once ─────────────────────────────────────── */

/** what a graph is drawn from - and, on Topics, the topics picked */
type Ctx = { f: Frame; d: Data; picked?: string[]; pick?: (label: string) => void };
type ChartDef = { id: string; page: Slug; title: string; hint?: (c: Ctx) => string; body: (c: Ctx) => React.ReactNode };
/** the months a chart draws: the complete ones - a month two days old would read as a collapse (its orders come in days
 *  later: 3 on 2 November, so 615 % tickets per order line) - the month to date only while none is complete */
const drawn = (f: Frame) => Math.max(1, f.done);

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
function typedTrend(id: string, title: string, key: string, note: string, unit: "pct" | "n", target?: number): ChartDef {
  const fmt = unit === "pct" ? share : n0;
  return {
    id, page: "otd", title, hint: () => note,
    body: ({ f, d }) => {
      const n = drawn(f);
      const values = typedOf(d, key, f.yms.slice(0, n)), compare = typedOf(d, key, f.yms.slice(0, n).map(back));
      return <MonthTrend values={values} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={fmt} target={target} />;
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
const PCS = ["DT", "KT", "FT", "ST", "AT"];

export const CHARTS: ChartDef[] = [
  // Figures - the workbook's team totals
  trend("created", "figures", "Tickets created", "The Back Office's tickets, by the month they came in", (k) => k.created, n0),
  trend("closed", "figures", "Tickets closed", "By their close date", (k) => k.closed, n0),
  trend("resolution", "figures", "Days to close", "Tickets created in the month and closed since, on average", (k) => k.resolution, days, daysTick),
  trend("reply", "figures", "Days to the first reply", "To the first agent e-mail reply, tickets created in the month", (k) => k.firstReply, days, daysTick),
  trend("perLine", "figures", "Tickets per order line", "Tickets created against the month's order lines", (k) => k.perLine, share),
  trend("perOrder", "figures", "Tickets per order", "Tickets created against the month's orders (an order number once, credit notes out)", (k) => k.perOrder, share),
  trend("orders", "figures", "Orders", "By order date - an order number once whatever its deliveries", (k) => k.orders, n0),
  trend("lines", "figures", "Order lines", "Per order, the lines of its largest delivery", (k) => k.lines, n0),
  trend("chat", "figures", "Chat tickets", "Handed over to the Back Office by the chat", (k) => k.chat, n0),
  trend("perHour", "figures", "Hours per ticket", "Hours worked against the tickets created - where the hours are typed in", (k) => k.hoursPerTicket, (v) => (v == null ? "—" : `${v.toFixed(2)} h`), (v) => (v == null ? "" : v.toFixed(2))),
  trend("neutral", "figures", "Neutral feeling", "Of the tickets the sentiment sweep scored, the share it found neutral", (k) => k.neutral, share),
  trend("negative", "figures", "Negative feeling", "Of the tickets the sentiment sweep scored, the share it found negative", (k) => k.negative, share),
  {
    id: "pcs", page: "figures", title: "Orders per profit centre", hint: ({ f }) => `${f.doneWords || f.year} - an order counts for the profit centre its records name; the shop's own records often name none`,
    body: ({ f }) => {
      const sum = (ms: (BoMonth | null)[]) => sumMonths(ms.filter((x): x is BoMonth => !!x)).pcs;
      const cur = sum(f.cur.slice(f.from, f.done || f.cur.length)), prev = f.totalPrev ? sum(f.prev.slice(f.from, f.done)) : {};
      const rows = [...new Set([...Object.keys(cur), ...Object.keys(prev)])].map((k) => ({ label: k || "No profit centre", cur: cur[k] ?? 0, prev: prev[k] ?? 0 }));
      return <DimChart title="" rows={rows} cur={(r) => r.cur} prev={(r) => r.prev} curLabel={`${f.doneWords} ${f.year}`} prevLabel={f.totalPrev ? `${f.doneWords} ${f.year - 1}` : ""} single={!f.totalPrev} fmt={int} />;
    },
  },
  // Topics
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
  trend("c2s", "topics", "C2S tickets", "Cut-to-size: a C2S ticket, a problem order, or C2S in the subject - the workbook asks for the first impact of C2S V1 and V2", (k) => k.c2s, n0),
  trend("c2sDelivery", "topics", "C2S tickets filed Delivery", "The C2S tickets among Delivery, the biggest topic", (k) => k.c2sDelivery, n0),
  // Sales tickets
  trend("eso", "sales-tickets", "ESO tickets", "The ESO's inbound tickets - the sales actions left out", (k) => k.eso, n0),
  trend("esoL", "sales-tickets", "ESO tickets per order line", "Inbound against the month's order lines", (k) => k.esoPerLine, share),
  trend("tsa", "sales-tickets", "TSA tickets", "The TSA's inbound tickets - the sales actions left out", (k) => k.tsa, n0),
  trend("tsaL", "sales-tickets", "TSA tickets per order line", "Inbound against the month's order lines", (k) => k.tsaPerLine, share),
  trend("all", "sales-tickets", "All APSOparts tickets", "Every pipeline - Back Office, ESO, TSA, GQS and the others - without the ESO's and the TSA's sales actions", (k) => k.all, n0),
  trend("allL", "sales-tickets", "All tickets per order line", "Against the month's order lines", (k) => k.allPerLine, share),
  // GQS
  trend("gqs", "gqs", "GQS tasks created", "Back Office - Special Tasks GQS, by the month they were created", (k) => k.gqsCreated, n0),
  trend("gqsSent", "gqs", "Days before sent to GQS", "Time in New for Back-Office and Open the GQS Task, on average - reliable from October 2026, with the new stage", (k) => k.gqsSent, days, daysTick),
  trend("gqsDone", "gqs", "Days to close", "HubSpot's time to close - to the offer sent to Sales, or refused; the tasks closed so far", (k) => k.gqsResolution, days, daysTick),
  // OTD & autonomy - typed in
  typedTrend("otdAll", "OTD online, all", "otd.online-all", "With early call-offs, by the first confirmation date", "pct"),
  typedTrend("otdStandard", "OTD online, standard", "otd.online-standard", "Standard articles", "pct"),
  typedTrend("otdSpecial", "OTD online, special", "otd.online-special", "Special articles", "pct"),
  {
    id: "otdPc", page: "otd", title: "OTD per profit centre", hint: ({ f }) => `${f.doneWords || f.year} on average - standard and special articles`,
    body: ({ f, d }) => {
      const yms = f.yms.slice(f.from, Math.max(f.done, 1));
      const rows = PCS.map((pc) => ({ label: pc, std: meanOf(typedOf(d, `otd.${pc.toLowerCase()}-standard`, yms)) ?? 0, spc: meanOf(typedOf(d, `otd.${pc.toLowerCase()}-special`, yms)) ?? 0 }));
      return <DimChart title="" rows={rows} cur={(r) => r.std} prev={(r) => r.spc} curLabel="Standard" prevLabel="Special" fmt={(v) => pct(v)} fixedOrder />;
    },
  },
  typedTrend("pass100", "Pass rate, mandant 100", "pass.m100", "Target 95 %", "pct", 0.95),
  typedTrend("pass110", "Pass rate, mandant 110", "pass.m110", "Target 95 %", "pct", 0.95),
  typedTrend("price100", "Manual price adjustments, mandant 100", "price.m100", "Target below 2.5 %", "pct", 0.025),
  typedTrend("price110", "Manual price adjustments, mandant 110", "price.m110", "Target below 2.5 %", "pct", 0.025),
  {
    id: "stopped", page: "otd", title: "Stopped orders", hint: () => "Of the Magento orders transferred to the Back Office, the share stopped",
    body: ({ f, d }) => {
      const n = drawn(f);
      const values = f.yms.slice(0, n).map((ym) => stoppedShare(d, ym)), compare = f.yms.slice(0, n).map((ym) => stoppedShare(d, back(ym)));
      return <MonthTrend values={values} compare={compare.some((x) => x != null) ? compare : null} labels={f.labels.slice(0, n)} label={String(f.year)} compareLabel={String(f.year - 1)} fmt={share} />;
    },
  },
  {
    id: "stoppedWhy", page: "otd", title: "Why orders are stopped", hint: ({ f }) => `${f.year} so far - the top reasons as typed in`,
    body: ({ f, d }) => {
      const sum = (row: string) => f.yms.reduce((s, ym) => s + (d.typed[`stopped.${row}`]?.[ym] ?? 0), 0);
      const rows = [{ label: "Credit limit", n: sum("credit") }, { label: "Denomination", n: sum("denomination") }, { label: "Price missing", n: sum("price") }];
      return <DimChart title="" rows={rows} cur={(r) => r.n} prev={() => 0} curLabel={String(f.year)} prevLabel="" single fmt={int} />;
    },
  },
];
const chartKey = (c: ChartDef) => `bo-${c.page}:main:${c.id}`;
const chartByKey = (key: string) => CHARTS.find((c) => chartKey(c) === key);

/** A graph with its Actions - on its page, or in the BUC View. */
function Card({ def, c, where }: { def: ChartDef; c: Ctx; where: "tab" | "nutshell" }) {
  const actions = <TileActions where={where} start="tab" edge={2} tile={{ key: chartKey(def), page: `bo-${def.page}`, tab: "main", title: def.title, kind: "card", href: hrefOf(def.page) }} />;
  return <ChartBox title={def.title} hint={def.hint?.(c)} actions={actions}>{def.body(c)}</ChartBox>;
}
const cardsOf = (page: Slug, c: Ctx) => CHARTS.filter((x) => x.page === page).map((def) => <Card key={def.id} def={def} c={c} where="tab" />);

/* ── the page around each part ─────────────────────────────────────────── */

const SHELL = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
type Put = (body: Record<string, unknown>) => Promise<void>;

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
            {a.state.computing && <> · <CircularProgress size={10} sx={{ mx: 0.4 }} />{d.pending?.length ? `counting - ${d.pending.length} of ${d.pending.length + d.months.length} months still to come, the newest first` : "counting again"}{a.state.progress ? `: ${a.state.progress}` : ""}</>}
          </Typography>
          <Choices items={f.years.map((y) => ({ id: String(y), label: String(y) }))} on={String(f.year)} onPick={(y) => f.setYear(Number(y))} />
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><FigureCards items={FIGS[slug](f, d)} /></Box>
      </Box>
      {children(f, d, a, put)}
    </Box>
  );
}

/** "All the figures": a KPI a row, a month a column, then the complete months, last year's and the change - as the workbook.
 *  `whole`: a ratio to the orders - "—" for the month to date, whose orders come in days later. */
type KRow = { key: string; label: string; pick: (k: BoKpis) => number | null; fmt: (v: number | null) => string; lower?: boolean; strong?: boolean; whole?: boolean };
function AllFigures({ f, rows, title = "All the figures", hint }: { f: Frame; rows: KRow[]; title?: string; hint?: string }) {
  const sum = f.doneWords ? `${f.doneWords} ${f.year}` : String(f.year);
  const head = ["KPI", ...f.labels.map((l) => l.replace(" (to date)", "*")), sum, ...(f.totalPrev ? [`${f.doneWords} ${f.year - 1}`, "Change"] : [])];
  return (
    <ChartBox title={title} hint={hint ?? `${f.labels.some((l) => l.includes("to date")) ? "* to date - " : ""}the last columns add up the complete months`}>
      <Table head={head} minWidth={Math.max(900, 150 + head.length * 74)} firstWidth="minmax(220px, 1.8fr)"
        rows={rows.map((r) => {
          const a = r.pick(f.total), b = f.totalPrev ? r.pick(f.totalPrev) : null;
          const ch = a != null && b != null ? changeOf(a, b) : null;
          return {
            key: r.key, strong: r.strong,
            cells: [r.label, ...f.yms.map((_, i) => (r.whole && f.labels[i].includes("to date") ? "—" : r.fmt(r.pick(f.k(i))))), r.fmt(a),
              ...(f.totalPrev ? [r.fmt(b), <Box key="ch" component="span" sx={{ fontWeight: 700, color: tone(ch, r.lower) }}>{signedPct(ch)}</Box>] : [])],
          };
        })} />
    </ChartBox>
  );
}

/* ── Figures ───────────────────────────────────────────────────────────── */

const TEAM_ROWS: KRow[] = [
  { key: "created", label: "Number of tickets created", pick: (k) => k.created, fmt: n0, strong: true },
  { key: "hours", label: "Hours worked", pick: (k) => k.hours, fmt: hrs },
  { key: "lines", label: "Order lines", pick: (k) => k.lines, fmt: n0 },
  { key: "orders", label: "Orders", pick: (k) => k.orders, fmt: n0 },
  { key: "closed", label: "Number of tickets closed", pick: (k) => k.closed, fmt: n0 },
  { key: "resolution", label: "Avg. resolution time (days)", pick: (k) => k.resolution, fmt: d1, lower: true },
  { key: "reply", label: "Avg. first response time (days)", pick: (k) => k.firstReply, fmt: d1, lower: true },
  { key: "chat", label: "Number of chat tickets", pick: (k) => k.chat, fmt: n0 },
  { key: "gqs", label: "Number of GQS tasks created", pick: (k) => k.gqsCreated, fmt: n0 },
  { key: "gqsSent", label: "Avg. time before sent to GQS (days)", pick: (k) => k.gqsSent, fmt: d1, lower: true },
  { key: "gqsDone", label: "Avg. resolution time GQS (days)", pick: (k) => k.gqsResolution, fmt: d1, lower: true },
  { key: "perLine", label: "Ratio tickets vs order lines", pick: (k) => k.perLine, fmt: share, lower: true, whole: true },
  { key: "perOrder", label: "Ratio tickets vs orders", pick: (k) => k.perOrder, fmt: share, lower: true, whole: true },
  { key: "perHour", label: "Avg. hours per ticket", pick: (k) => k.hoursPerTicket, fmt: (v) => (v == null ? "—" : v.toFixed(2)), whole: true },
  { key: "neutral", label: "Neutral feeling (share of scored)", pick: (k) => k.neutral, fmt: share },
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
    <ChartBox title="Hours worked" hint={can ? "Not in HubSpot - typed in per month (Abacus); the hours per ticket follow" : "Not in HubSpot - typed in per month by the Back Office (Abacus)"}>
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
          <Box sx={TWO}>{cardsOf("figures", { f, d })}</Box>
          <HoursCard f={f} can={a.canEdit} put={put} />
          <AllFigures f={f} rows={TEAM_ROWS} />
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
    <>
      <Box sx={TWO}>{cardsOf("topics", c)}</Box>
      <ChartBox title="All the figures" hint="Back Office tickets per topic, by the month they came in - what the workbook calls Others is each of its own today (automatic, finance, internal e-mails, spam ...)">
        <Table head={["Topic", ...f.labels.map((l) => l.replace(" (to date)", "*")), ...(f.done ? [`${f.doneWords} ${f.year}`] : []), ...(compare ? [`${f.doneWords} ${f.year - 1}`, "Change"] : [])]}
          minWidth={Math.max(900, 150 + (f.yms.length + 3) * 74)} firstWidth="minmax(220px, 1.8fr)"
          rows={[...rows, { label: "Grand total", key: "__total", cur: rows.reduce((s, r) => s + r.cur, 0), prev: rows.reduce((s, r) => s + r.prev, 0) }].map((r) => ({
            key: r.key, strong: r.key === "__total",
            cells: [r.label, ...f.cur.map((m) => (hasTickets(m.ym) && !m.pending ? n0(r.key === "__total" ? m.created : m.topics[r.key] ?? 0) : "—")), ...(f.done ? [int(r.cur)] : []),
              ...(compare ? [int(r.prev), <Box key="ch" component="span" sx={{ fontWeight: 700, color: tone(changeOf(r.cur, r.prev), true) }}>{r.prev ? signedPct(changeOf(r.cur, r.prev)) : "—"}</Box>] : [])],
          }))} />
      </ChartBox>
    </>
  );
}

export function BoTopicsPage() {
  return <Page slug="topics">{(f, d) => <TopicsBody f={f} d={d} />}</Page>;
}

/* ── Sales tickets ─────────────────────────────────────────────────────── */

const SALES_ROWS: KRow[] = [
  { key: "eso", label: "Total number of tickets - ESO (inbound)", pick: (k) => k.eso, fmt: n0, strong: true },
  { key: "esoL", label: "Ratio tickets vs order lines", pick: (k) => k.esoPerLine, fmt: share, lower: true, whole: true },
  { key: "esoO", label: "Ratio tickets vs orders", pick: (k) => k.esoPerOrder, fmt: share, lower: true, whole: true },
  { key: "tsa", label: "Total number of tickets - TSA (inbound)", pick: (k) => k.tsa, fmt: n0, strong: true },
  { key: "tsaL", label: "Ratio tickets vs order lines", pick: (k) => k.tsaPerLine, fmt: share, lower: true, whole: true },
  { key: "tsaO", label: "Ratio tickets vs orders", pick: (k) => k.tsaPerOrder, fmt: share, lower: true, whole: true },
  { key: "all", label: "Total number of tickets - APSOparts", pick: (k) => k.all, fmt: n0, strong: true },
  { key: "allL", label: "Ratio tickets vs order lines", pick: (k) => k.allPerLine, fmt: share, lower: true, whole: true },
  { key: "allO", label: "Ratio tickets vs orders", pick: (k) => k.allPerOrder, fmt: share, lower: true, whole: true },
];

export function BoSalesTicketsPage() {
  return (
    <Page slug="sales-tickets">
      {(f, d) => (
        <>
          {!f.inbound && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>The ESO Reports&apos; ticket read is still counting - until it is in, the ESO and the TSA show every ticket of their pipelines, the sales actions with them.</Typography>}
          <Box sx={TWO}>{cardsOf("sales-tickets", { f, d })}</Box>
          <AllFigures f={f} rows={SALES_ROWS} hint="The ESO's and the TSA's inbound tickets (the UC hand-overs and the pushes - erosion, win back, the September push, price checks - left out) against the month's orders and order lines" />
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
      {(f, d) => (
        <>
          <Box sx={TWO}>{cardsOf("gqs", { f, d })}</Box>
          <AllFigures f={f} rows={GQS_ROWS} hint="Every GQS task, by the month it was created - the last columns add up the complete months" />
        </>
      )}
    </Page>
  );
}

/* ── OTD & autonomy: typed in ─────────────────────────────────────────── */

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

export function BoOtdPage() {
  return (
    <Page slug="otd">
      {(f, d, a, put) => (
        <>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>None of this is in HubSpot - no order carries its first confirmation date, a red / green status or why it was stopped - so the Back Office types each month in; the workbook&apos;s own figures to start.</Typography>
          <Box sx={TWO}>{cardsOf("otd", { f, d })}</Box>
          {TYPED.map((s) => <TypedTable key={s.id} s={s} f={f} d={d} can={a.canEditTyped} put={put} />)}
        </>
      )}
    </Page>
  );
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
        Read from HubSpot {new Date(d.generatedAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich" })}{a.state.computing ? ` · counting${d.pending?.length ? ` - ${d.pending.length} months still to come` : " again"}` : ""} · the complete months of this year against the same months of last year · OTD & autonomy typed in by the Back Office · a graph joins its page&apos;s panel here with Actions on the page.
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

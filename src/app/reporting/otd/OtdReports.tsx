"use client";

// OTD REPORTS - the supply chain's OTD analysis file ("APSOparts-OTD-2025-Q3-2026") worked out live, a page per kind of
// question it asks and a tab per view (SARCLA 09.11.2026: "this is OTD analysis, inside the file you can find how we
// calculate, to compare to us + all the types of logic and graphs - should be used to create OTD advanced reports on its
// own and then bring to back office the main features"). Its rule and categories: lib/reporting/otdRules.ts; its figures:
// /api/reporting/otd (the ERP's order lines every morning, the file's own lines for the months before them). Drawn with
// the other advanced reports' pieces: FigureCards top right, a tab row, one card that follows the tab, graphs two by two.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TuneIcon from "@mui/icons-material/Tune";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import FactoryOutlinedIcon from "@mui/icons-material/FactoryOutlined";
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, TINT, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartBox, FullTable, H1, PageBar, TWO, setQuery, usePages, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { ActiveFilters, PeriodPicker, quartersOf, type ActiveItem } from "@/app/reporting/eso-benchmark/EsoFilters";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { MonthTrend } from "@/app/reporting/eso-benchmark/TicketsCharts";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { FigureCards, MONTHS, changeOf, int, pct, type Fig } from "@/app/reporting/products/views/kit";
import { StackedColumns, type StackRow } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { MultiLine, type MultiSeries } from "@/app/charts/MultiLine";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import {
  CHANGE_CATS, DELIVERIES, DELIVERY_ASKED, GLC, GLC_KINDS, LATE_CATS, LEAD_BUCKETS, LEAD_MEASURES, OTHER, PLANNED, POSITION_CATS, avg, emptySlice, impactRank, keysFor, monthly,
  onTimeShare, sumSlices, type ImpactRow, type OtdAxis, type OtdCube, type OtdFilter, type Slice, type Trio,
} from "@/lib/reporting/otdRules";
import { OTD_PAGES, type OtdSlug } from "@/lib/reporting/otdPages";
import { CustomerExplorer } from "./OtdCustomers";
import { ArticleMaster, GlcCompanies, SupplierLeads } from "./OtdLineViews";
import { PagedBars } from "./OtdPaged";

/* ── the read ──────────────────────────────────────────────────────────── */

function useOtd() {
  const [cube, setCube] = useState<OtdCube | null | undefined>(undefined);
  const [err, setErr] = useState<{ error: string; status: number | null } | null>(null);
  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch("/api/reporting/otd", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { cube?: OtdCube | null; error?: string };
      if (!r.ok) { setErr({ error: j.error ?? `HTTP ${r.status}`, status: r.status }); return; }
      setCube(j.cube ?? null);
    } catch (e) {
      setErr({ error: String((e as Error)?.message ?? e), status: null });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { cube, err, again: load };
}

/* ── what the page shows: the period, the month counted by, the filters - all in the address ── */

type AxisKey = "promised" | "delivered";
type Frame = {
  k: OtdCube; axisKey: AxisKey; axis: OtdAxis;
  /** the months shown, and the same months a year before (those the figures hold) */
  yms: string[]; prev: string[];
  min: string; max: string; from: string; to: string;
  filter: OtdFilter; params: URLSearchParams;
};
const FIRST_MONTH = "2025-01";
const ymAdd = (ym: string, n: number) => { const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const ymRange = (a: string, b: string) => { const out: string[] = []; for (let x = a; x <= b; x = ymAdd(x, 1)) out.push(x); return out; };
const ymLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const zurichMonth = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" }).slice(0, 7);
const SRC_LABEL: Record<string, string> = { e: "eShop", m: "Typed in by the Back Office" };
const ST_LABEL: Record<string, string> = { S: "Standard", P: "Special" };
const MANDANT_LABEL: Record<string, string> = { "100": "100 · Switzerland", "110": "110 · EU" };

function useFrame(k: OtdCube): Frame {
  const params = useSearchParams();
  return useMemo(() => {
    const axisKey: AxisKey = params.get("axis") === "delivered" ? "delivered" : "promised";
    const axis = k[axisKey];
    const months = [...new Set(Object.keys(axis.slices).map((x) => x.slice(0, 7)))].sort();
    // the last month shown: the last complete one the figures hold (the month running fills for weeks yet)
    const cap = ymAdd(zurichMonth(), -1);
    const max = months.filter((m) => m <= cap).pop() ?? months[months.length - 1] ?? cap;
    const min = months.find((m) => m >= FIRST_MONTH) ?? max;
    const want = (x: string | null) => (x && /^\d{4}-\d\d$/.test(x) ? x : null);
    let from = want(params.get("from")) ?? `${max.slice(0, 4)}-01`, to = want(params.get("to")) ?? max;
    if (from < min) from = min; if (to > max) to = max; if (from > to) from = to;
    const yms = ymRange(from, to);
    const have = new Set(months);
    const prev = yms.map((ym) => ymAdd(ym, -12)).filter((ym) => have.has(ym) && ym >= min);
    const src = params.get("src");
    const filter: OtdFilter = {
      company: params.getAll("mandant"), st: params.getAll("st"), pc: params.getAll("pc"),
      src: src === "all" ? [] : src === "m" ? ["m"] : ["e"],
    };
    return { k, axisKey, axis, yms, prev, min, max, from, to, filter, params: new URLSearchParams(params.toString()) };
  }, [k, params]);
}
/** where the measured dates end: to the OTD analysis file's last date the ERP's own, after it the hub's calculation */
const seamOf = (f: Frame) => {
  const u = f.k.dated?.fileUntil;
  if (!u) return "";
  const d = new Date(`${u}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return ` · deliveries to ${d}: the ERP's measured dates (the OTD analysis file); later ones the hub's calculation from the shipment - in the holiday months up to 2 points more on time than measured, until the file is exported again`;
};
const periodOf = (f: Frame) => (f.from === f.to ? ymLabel(f.from) : `${ymLabel(f.from)} – ${ymLabel(f.to)}`);
const axisWords = (f: Frame) => (f.axisKey === "promised" ? "by the month of the first confirmed date" : "by the month the line reached the customer");

/* ── reading the figures ───────────────────────────────────────────────── */

const total = (f: Frame, yms = f.yms, extra: Partial<OtdFilter> = {}) => sumSlices(keysFor(f.axis, yms, { ...f.filter, ...extra }).map((x) => f.axis.slices[x]));
const months = (f: Frame, extra: Partial<OtdFilter> = {}) => monthly(f.axis, f.yms, { ...f.filter, ...extra });
const share = (t: Trio) => (t[0] ? (t[0] - t[1]) / t[0] : null);
const lateRate = (t: Trio) => (t[0] ? t[1] / t[0] : null);
const days1 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)} days`);
const daysTick = (v: number | null) => (v == null ? "" : `${Math.round(v)}`);
const n0 = (v: number | null) => (v == null ? "—" : int(v));
const pct0 = (v: number | null) => (v == null ? "" : `${Math.round(v * 100)}%`);
const LABELS = (f: Frame) => f.yms.map(ymLabel);
/** the late categories' colours: on time in the series green, then one warm hue light to dark - an order, not identities */
const LATE_COLORS = [SERIES[2], "#f7d9b5", "#f0b47a", "#e5873f", "#c45a1c", "#7d3410"];
const BAD = "#c5221f";
const supName = (s: string) => (s === GLC ? "GLC" : s.replace(/\s*\(Konsi\)/i, "").split(",")[0].trim());
const trioRow = (t: Trio) => ({ n: t[0], late: t[1], onTime: share(t), avgDays: avg(t[2], t[0]) });

/** the profit centres of the lines the filters keep */
const pcsOf = (f: Frame) => [...new Set(keysFor(f.axis, f.yms, f.filter).map((x) => x.split("|")[4]))].filter(Boolean).sort();

/* ── a graph ───────────────────────────────────────────────────────────── */

/** `bare`: the body draws its own boxes (the customers' explorer) */
type ChartDef = { id: string; title: string; hint: (f: Frame) => string; body: (f: Frame) => React.ReactNode; wide?: boolean; bare?: boolean };
const NONE = (what = "No line in these months with these filters.") => <Typography sx={{ fontSize: "0.85rem", color: MUTED, py: 2 }}>{what}</Typography>;
/** the product group: the nightly article master's main group (dim_article.csv) for the morning months, the file's before */
const GROUP_FROM = "each article's main group in the ERP's article master";
/** the parts counted since 11.11.2026 - a cube built before carries none (the ERP delivers in the evening) */
const NEXT_RUN = "Counted from the next ERP delivery's run on.";
/** the lead-time bands and the processing time: an empty slice carries zeros, so "counted" = a band holds a line */
const hasDist = (s: Slice) => !!s.dist?.some((r) => r.some((x) => x > 0));
const SQ = (f: Frame) => ({ from: f.from, to: f.to, axis: f.axisKey, filter: f.filter, yms: f.yms });

const CHARTS: ChartDef[] = [
  /* ── Customers: the list, a click opens one (OtdCustomers.tsx) ── */
  {
    id: "custExplorer", wide: true, bare: true, title: "", hint: () => "",
    body: (f) => <CustomerExplorer q={SQ(f)} />,
  },
  /* ── every supplier's lead time and GLC's companies, from the lines kept one by one (OtdLineViews.tsx) ── */
  {
    id: "supLeadAll", wide: true, bare: true, title: "", hint: () => "",
    body: (f) => <SupplierLeads q={SQ(f)} fallback={supLeadBars(f, Infinity)} />,
  },
  {
    id: "glcCompanies", wide: true, bare: true, title: "", hint: () => "",
    body: (f) => <GlcCompanies q={SQ(f)} />,
  },
  {
    id: "artMaster", wide: true, bare: true, title: "", hint: () => "",
    body: (f) => <ArticleMaster q={SQ(f)} />,
  },
  /* ── Overview ─────────────────────────────────────────────── */
  {
    id: "otd", wide: true, title: "On time, month by month",
    hint: (f) => `the share of the lines that reached the customer by their first confirmed date · ${axisWords(f)}${f.prev.length ? " · the same months a year before in grey" : ""}${seamOf(f)}`,
    body: (f) => {
      const cur = months(f), py = f.prev.length ? monthly(f.axis, f.yms.map((ym) => ymAdd(ym, -12)), f.filter) : null;
      if (!cur.some((s) => s.n)) return NONE();
      return <MonthTrend values={cur.map(onTimeShare)} compare={py ? py.map((s) => (s.n ? onTimeShare(s) : null)) : null} labels={LABELS(f)} label="On time" compareLabel="A year before" fmt={pct} tick={pct0} height={260} />;
    },
  },
  {
    id: "lines", title: "Lines on time and late",
    hint: (f) => `the lines that reached the customer, ${axisWords(f)}`,
    body: (f) => {
      const ms = months(f);
      return <StackedColumns data={ms.map((s, i) => ({ x: LABELS(f)[i], ok: s.n - s.late, late: s.late }))} parts={[{ key: "ok", label: "On time", color: SERIES[2] }, { key: "late", label: "Late", color: BAD }]} format={n0} xFormat={(x) => x} height={240} />;
    },
  },
  {
    id: "mandant", title: "On time per mandant",
    hint: () => "100 Switzerland and 110 EU, month by month",
    body: (f) => <MultiLine labels={LABELS(f)} series={["100", "110"].map((c) => ({ key: c, label: MANDANT_LABEL[c], values: months(f, { company: [c] }).map((s) => (s.n ? onTimeShare(s) : null)) }))} format={pct} tickFormat={pct0} max={1} />,
  },
  {
    id: "type", title: "On time, standard and special articles",
    hint: () => "the article type as the ERP has it - not known for the OTD analysis file's months",
    body: (f) => {
      const series = ["S", "P"].map((x) => ({ key: x, label: ST_LABEL[x], values: months(f, { st: [x] }).map((s) => (s.n ? onTimeShare(s) : null)) }));
      if (!series.some((x) => x.values.some((v) => v != null))) return NONE("The article type comes with the ERP's morning lines - the OTD analysis file does not carry it.");
      return <MultiLine labels={LABELS(f)} series={series} format={pct} tickFormat={pct0} max={1} />;
    },
  },
  {
    id: "catMix", wide: true, title: "How late - the file's categories, month by month",
    hint: (f) => `each month's lines by how many working days after the first confirmed date they reached the customer · ${axisWords(f)}`,
    body: (f) => {
      const ms = months(f);
      return <StackedColumns data={ms.map((s, i) => Object.fromEntries([["x", LABELS(f)[i]], ...LATE_CATS.map((_, c) => [`c${c}`, s.n ? s.cat[c] / s.n : null])]) as StackRow)}
        parts={LATE_CATS.map((label, c) => ({ key: `c${c}`, label, color: LATE_COLORS[c] }))} format={pct} tickFormat={pct0} ordinal xFormat={(x) => x} height={280} />;
    },
  },
  {
    id: "catAvg", title: "Average days late, per category",
    hint: (f) => `${periodOf(f)} · the late lines of each category, and how many there were`,
    body: (f) => {
      const t = total(f);
      return <BarList rows={LATE_CATS.slice(1).map((label, i) => ({ label, value: avg(t.catDays[i + 1], t.cat[i + 1]), secondary: `${int(t.cat[i + 1])} lines · ${pct(t.n ? t.cat[i + 1] / t.n : null)}` }))} format={days1} labelWidth={170} />;
    },
  },
  {
    id: "catTable", title: "The categories in figures",
    hint: (f) => `${periodOf(f)} · lines, their share and their average late days (early days count as minus, as in the file)`,
    body: (f) => {
      const t = total(f);
      return <Table head={["Category", "Lines", "Share", "Average days"]} rows={[
        ...LATE_CATS.map((label, c) => ({ key: label, cells: [label, int(t.cat[c]), pct(t.n ? t.cat[c] / t.n : null), days1(avg(t.catDays[c], t.cat[c]))] })),
        { key: "all", strong: true, cells: ["All lines", int(t.n), "100%", days1(avg(t.signed, t.n))] },
      ]} />;
    },
  },
  {
    id: "depth", title: "Average days late of the late lines",
    hint: (f) => `the late lines only, month by month${f.prev.length ? " · a year before in grey" : ""}`,
    body: (f) => {
      const cur = months(f), py = f.prev.length ? monthly(f.axis, f.yms.map((ym) => ymAdd(ym, -12)), f.filter) : null;
      return <MonthTrend values={cur.map((s) => avg(s.days, s.late))} compare={py ? py.map((s) => avg(s.days, s.late)) : null} labels={LABELS(f)} label="Days late" compareLabel="A year before" fmt={days1} tick={daysTick} />;
    },
  },
  {
    id: "over10", title: "Lines more than 10 working days late",
    hint: () => "the file's categories 11-30 and more than 30, month by month",
    body: (f) => <MonthTrend values={months(f).map((s) => s.over10)} labels={LABELS(f)} label="Lines" fmt={n0} />,
  },
  {
    id: "pcBars", title: "On time per profit centre",
    hint: (f) => `${periodOf(f)} · the article's profit centre (the assortment group in the file's months)`,
    body: (f) => {
      const by = new Map<string, Slice[]>();
      for (const x of keysFor(f.axis, f.yms, f.filter)) { const pc = x.split("|")[4] || "Not known"; (by.get(pc) ?? by.set(pc, []).get(pc)!).push(f.axis.slices[x]); }
      const rows = [...by].map(([pc, ss]) => { const s = sumSlices(ss); return { label: pc, value: onTimeShare(s), secondary: `${int(s.n)} lines · ${int(s.late)} late` }; }).filter((r) => r.value != null).sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
      return <BarList rows={rows} format={pct} labelWidth={110} max={1} />;
    },
  },
  {
    id: "pcLate", title: "Where the late lines are",
    hint: (f) => `${periodOf(f)} · each profit centre's late lines and its share of all the late lines`,
    body: (f) => {
      const all = total(f);
      const rows = pcsOf(f).map((pc) => { const t = total(f, f.yms, { pc: [pc] }); return { label: pc, value: t.late, secondary: `${pct(all.late ? t.late / all.late : null)} of the late lines · ${int(t.n)} lines` }; })
        .filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
      return <BarList rows={rows} format={n0} labelWidth={110} />;
    },
  },
  {
    id: "pcTrend", wide: true, title: "The largest profit centres, month by month",
    hint: (f) => `the share on time of the five profit centres with the most lines in ${periodOf(f)} · ${axisWords(f)}`,
    body: (f) => {
      const top = pcsOf(f).map((pc) => [pc, total(f, f.yms, { pc: [pc] }).n] as const).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([pc]) => pc);
      if (!top.length) return NONE();
      return <MultiLine labels={LABELS(f)} series={top.map((pc) => ({ key: pc, label: pc, values: months(f, { pc: [pc] }).map((s) => (s.n ? onTimeShare(s) : null)) }))} format={pct} tickFormat={pct0} max={1} height={260} />;
    },
  },
  {
    id: "pcTable", wide: true, title: "Each profit centre in figures",
    hint: (f) => `${periodOf(f)} · on time by article type and mandant, the days late, the supplier with the most late lines (GLC = no supplier: cut to size and made in house)${f.prev.length ? " · against the same months a year before" : ""}`,
    body: (f) => {
      type R = { label: string; n: number; late: number; days: number; over10: number; rate: number | null; py: number | null; s: number | null; p: number | null; m100: number | null; m110: number | null; glc: number; worst: string };
      const rows: R[] = pcsOf(f).map((pc) => {
        const t = total(f, f.yms, { pc: [pc] });
        const py = f.prev.length ? total(f, f.yms.map((ym) => ymAdd(ym, -12)), { pc: [pc] }) : null;
        const sup = Object.entries(t.sup).filter(([k]) => k !== OTHER).sort((a, b) => b[1][1] - a[1][1])[0];
        return {
          label: pc, n: t.n, late: t.late, days: t.days, over10: t.over10, rate: onTimeShare(t), py: py && py.n ? onTimeShare(py) : null,
          s: onTimeShare(total(f, f.yms, { pc: [pc], st: ["S"] })), p: onTimeShare(total(f, f.yms, { pc: [pc], st: ["P"] })),
          m100: onTimeShare(total(f, f.yms, { pc: [pc], company: ["100"] })), m110: onTimeShare(total(f, f.yms, { pc: [pc], company: ["110"] })),
          glc: t.sup[GLC]?.[1] ?? 0, worst: sup && sup[1][1] ? `${supName(sup[0])} · ${int(sup[1][1])}` : "—",
        };
      }).filter((r) => r.n > 0);
      const gap = (a: number | null, b: number | null) => (a == null || b == null ? "—" : `${a - b >= 0 ? "+" : "−"}${Math.abs(100 * (a - b)).toFixed(1)}`);
      return <FullTable first="Profit centre" initial="late" rows={rows} cols={[
        { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
        { key: "late", head: "Late", cell: (r) => int(r.late), sort: (r) => r.late },
        { key: "rate", head: "On time", cell: (r) => pct(r.rate), sort: (r) => r.rate ?? 0 },
        ...(f.prev.length ? [{ key: "py", head: "Points vs a year before", cell: (r: R) => gap(r.rate, r.py), sort: (r: R) => (r.rate ?? 0) - (r.py ?? r.rate ?? 0) }] : []),
        { key: "avg", head: "Average late", cell: (r) => days1(r.late ? r.days / r.late : null), sort: (r) => (r.late ? r.days / r.late : 0) },
        { key: "over10", head: "Over 10 days", cell: (r) => int(r.over10), sort: (r) => r.over10 },
        { key: "s", head: "Standard on time", cell: (r) => pct(r.s), sort: (r) => r.s ?? 0 },
        { key: "p", head: "Special on time", cell: (r) => pct(r.p), sort: (r) => r.p ?? 0 },
        { key: "m100", head: "100 on time", cell: (r) => pct(r.m100), sort: (r) => r.m100 ?? 0 },
        { key: "m110", head: "110 on time", cell: (r) => pct(r.m110), sort: (r) => r.m110 ?? 0 },
        { key: "glc", head: "GLC late", cell: (r) => int(r.glc), sort: (r) => r.glc },
        { key: "worst", head: "Most late lines", cell: (r) => r.worst },
      ]} />;
    },
  },
  {
    id: "pcCats", wide: true, title: "How late, per profit centre",
    hint: (f) => `${periodOf(f)} · each profit centre's lines per late category of the OTD analysis file`,
    body: (f) => {
      const data = pcsOf(f).map((pc) => ({ pc, t: total(f, f.yms, { pc: [pc] }) })).filter((x) => x.t.n).sort((a, b) => b.t.n - a.t.n)
        .map(({ pc, t }) => ({ x: pc, ...Object.fromEntries(t.cat.map((n, j) => [`c${j}`, n])) }));
      if (!data.length) return NONE();
      return <StackedColumns ordinal data={data} parts={LATE_CATS.map((label, j) => ({ key: `c${j}`, label, color: LATE_COLORS[j] }))} format={n0} height={260} />;
    },
  },
  {
    id: "pcMonths", wide: true, title: "Each profit centre, month by month",
    hint: () => "the share on time · the lines of the month in grey beneath",
    body: (f) => {
      const pcs = [...new Set(keysFor(f.axis, f.yms, f.filter).map((x) => x.split("|")[4]))].filter(Boolean).sort();
      return <Table head={["Profit centre", ...LABELS(f), "Period"]} minWidth={240 + 80 * (f.yms.length + 1)} rows={pcs.map((pc) => {
        const ms = months(f, { pc: [pc] }), t = total(f, f.yms, { pc: [pc] });
        return { key: pc, cells: [pc, ...ms.map((s) => cell(onTimeShare(s), s.n)), cell(onTimeShare(t), t.n, true)] };
      })} />;
    },
  },

  /* ── Suppliers ────────────────────────────────────────────── */
  {
    id: "impact", wide: true, title: "Supplier impact on late lines",
    hint: (f) => `${periodOf(f)} · each article's main supplier, GLC the lines whose article has none · impact index = the supplier's late days against the largest (100) · Critical from 50, High from 20, Medium from 10 · the suppliers beyond the ${60} with the most lines summed as one, never ranked`,
    body: (f) => {
      const rows = impactRank(total(f));
      if (!rows.length) return NONE();
      type R = ImpactRow & { label: string };
      const cols: Col<R>[] = [
        { key: "rank", head: "Rank", cell: (r) => (r.rank ? r.rank : "—"), sort: (r) => -(r.rank || 999) },
        { key: "lines", head: "Lines", cell: (r) => int(r.lines), sort: (r) => r.lines },
        { key: "late", head: "Late", cell: (r) => int(r.late), sort: (r) => r.late },
        { key: "rate", head: "Late rate", cell: (r) => pct(r.lateRate), sort: (r) => r.lateRate },
        { key: "days", head: "Late days", cell: (r) => int(r.days), sort: (r) => r.days },
        { key: "share", head: "Share of late days", cell: (r) => pct(r.share), sort: (r) => r.share },
        { key: "avg", head: "Average late", cell: (r) => days1(r.avgLate), sort: (r) => r.avgLate ?? 0 },
        { key: "over", head: "Late > 10 days", cell: (r) => int(r.over10), sort: (r) => r.over10 },
        { key: "max", head: "Most days late", cell: (r) => int(r.max), sort: (r) => r.max },
        { key: "index", head: "Impact index", cell: (r) => (r.rank ? r.index.toFixed(1) : "—"), sort: (r) => r.index },
        { key: "prio", head: "Priority", cell: (r) => <Prio p={r.priority} />, sort: (r) => r.index },
      ];
      // the suppliers summed as one stay under the table, never sorted in among the real ones
      const rest = rows.find((r) => !r.rank);
      return <FullTable first="Supplier" cols={cols} rows={rows.filter((r) => r.rank).map((r) => ({ ...r, label: r.supplier }))} total={rest ? { ...rest, label: `${OTHER} - every one beyond the 60 with the most lines` } : null} initial="days" find="a supplier" />;
    },
  },
  {
    id: "top10", title: "Suppliers by late days",
    hint: (f) => `${periodOf(f)} · the working days late of their late lines, summed · every supplier, the most first, 10 a page`,
    body: (f) => <PagedBars rows={impactRank(total(f)).filter((r) => r.rank).map((r) => ({ label: supName(r.supplier), value: r.days, secondary: `${int(r.late)} late lines · ${pct(r.lateRate)} late · ${r.priority}` }))} format={n0} />,
  },
  {
    id: "supRate", title: "Late rate of every supplier",
    hint: (f) => `${periodOf(f)} · the share of their lines late · the most lines first, 10 a page`,
    body: (f) => {
      const rows = impactRank(total(f)).filter((r) => r.rank).sort((a, b) => b.lines - a.lines);
      return <PagedBars rows={rows.map((r) => ({ label: supName(r.supplier), value: r.lateRate, secondary: `${int(r.lines)} lines · ${int(r.late)} late` }))} format={pct} />;
    },
  },
  {
    id: "supDays", wide: true, title: "The 4 largest contributors' late days, month by month",
    hint: () => "the suppliers with the most late days over the period - the others in grey (the file's \"Supplier Impact Monthly\")",
    body: (f) => {
      const ms = months(f), top = topSuppliers(f, 4);
      const series: MultiSeries[] = top.map((s) => ({ key: s, label: supName(s), values: ms.map((m) => m.sup[s]?.[2] ?? 0) }));
      series.push({ key: "rest", label: "All the others", rest: true, values: ms.map((m) => Object.entries(m.sup).filter(([k]) => !top.includes(k)).reduce((a, [, r]) => a + r[2], 0)) });
      return <MultiLine labels={LABELS(f)} series={series} format={n0} height={260} />;
    },
  },
  {
    id: "supShare", wide: true, title: "Share of each month's late days",
    hint: () => "the same 4 suppliers and all the others - who the month's lateness comes from",
    body: (f) => {
      const ms = months(f), top = topSuppliers(f, 4);
      return <StackedColumns data={ms.map((m, i) => {
        const all = Object.values(m.sup).reduce((a, r) => a + r[2], 0);
        const row: StackRow = { x: LABELS(f)[i] };
        top.forEach((s, j) => { row[`s${j}`] = all ? (m.sup[s]?.[2] ?? 0) / all : null; });
        row.rest = all ? Object.entries(m.sup).filter(([k]) => !top.includes(k)).reduce((a, [, r]) => a + r[2], 0) / all : null;
        return row;
      })} parts={[...top.map((s, j) => ({ key: `s${j}`, label: supName(s), color: SERIES[j] })), { key: "rest", label: "All the others", color: DEEMPHASIS }]} format={pct} tickFormat={pct0} xFormat={(x) => x} height={260} />;
    },
  },
  {
    id: "supMonthTable", wide: true, title: "Every contributor, month by month",
    hint: () => "the late rate of each month, and the period's late days (the file's \"%LatePerSupplier\" and \"Supplier Impact Rank\") · the most late days first, 15 a page",
    body: (f) => <SupMonthPages f={f} />,
  },
  {
    id: "glcCats", title: "GLC - how late, month by month",
    hint: () => "the lines cut to size and made in house (no supplier) by the file's categories (its \"%LatePerSupplier-GLConly\")",
    body: (f) => {
      const ms = monthsOfSupplier(f, GLC);
      return <StackedColumns data={ms.map((s, i) => Object.fromEntries([["x", LABELS(f)[i]], ...LATE_CATS.map((_, c) => [`c${c}`, s.n ? s.cat[c] / s.n : null])]) as StackRow)}
        parts={LATE_CATS.map((label, c) => ({ key: `c${c}`, label, color: LATE_COLORS[c] }))} format={pct} tickFormat={pct0} ordinal xFormat={(x) => x} height={240} />;
    },
  },
  {
    id: "glcVs", title: "GLC against the suppliers",
    hint: () => "the share on time of GLC's lines and of all the other lines",
    body: (f) => {
      const ms = months(f);
      const g = ms.map((m) => m.sup[GLC]), o = ms.map((m, i) => { const x = g[i]; return { n: m.n - (x?.[0] ?? 0), late: m.late - (x?.[1] ?? 0) }; });
      return <MultiLine labels={LABELS(f)} series={[{ key: "glc", label: GLC, values: g.map((x) => (x && x[0] ? (x[0] - x[1]) / x[0] : null)) }, { key: "sup", label: "Bought from suppliers", values: o.map(onTimeShare) }]} format={pct} tickFormat={pct0} max={1} />;
    },
  },

  /* ── Products ─────────────────────────────────────────────── */
  {
    id: "articleBars", title: "Late lines per article",
    hint: (f) => `${periodOf(f)} · the 15 articles with the most late lines`,
    body: (f) => {
      const rows = f.k.articles.map((a) => { let n = 0, late = 0; for (const ym of f.yms) { const t = a.m[ym]; if (t) { n += t[0]; late += t[1]; } } return { label: a.group ? `${a.a} · ${a.group}` : a.a, value: late, secondary: n ? `of ${int(n)} lines · ${pct(late / n)} late` : "" }; })
        .filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 15);
      return <BarList rows={rows} format={n0} labelWidth={260} emptyMessage="No late line in these months." />;
    },
  },
  {
    id: "groups", title: "Late rate per product group",
    hint: (f) => `${periodOf(f)} · the 15 product groups with the most late lines · ${GROUP_FROM}`,
    body: (f) => {
      const t = total(f);
      const rows = Object.entries(t.group).sort((a, b) => b[1][1] - a[1][1]).slice(0, 15).map(([g, r]) => ({ label: g, value: lateRate(r), secondary: `${int(r[0])} lines · ${int(r[1])} late` }));
      return rows.length ? <BarList rows={rows} format={pct} labelWidth={200} /> : NONE(`No product group in these months yet. ${NEXT_RUN}`);
    },
  },
  {
    id: "groupTable", wide: true, title: "Every product group",
    hint: () => `lines, late lines, late rate and the average days late of the late lines · ${GROUP_FROM}`,
    body: (f) => {
      const t = total(f);
      type R = { label: string; n: number; late: number; days: number };
      const rows: R[] = Object.entries(t.group).map(([g, r]) => ({ label: g, n: r[0], late: r[1], days: r[2] }));
      if (!rows.length) return NONE(`No product group in these months yet. ${NEXT_RUN}`);
      return <FullTable first="Product group" find="a group" initial="late" rows={rows} cols={[
        { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
        { key: "late", head: "Late", cell: (r) => int(r.late), sort: (r) => r.late },
        { key: "rate", head: "Late rate", cell: (r) => pct(r.n ? r.late / r.n : null), sort: (r) => (r.n ? r.late / r.n : 0) },
        { key: "avg", head: "Average late", cell: (r) => days1(r.late ? r.days / r.late : null), sort: (r) => (r.late ? r.days / r.late : 0) },
      ]} />;
    },
  },
  {
    id: "planned", title: "Planned articles against the others",
    hint: () => "the share on time, month by month · planned = the ERP plans the article's stock (ConsumptionDriven, the OTD analysis file's \"Article planned\")",
    body: (f) => {
      const ms = months(f);
      return <MultiLine labels={LABELS(f)} series={PLANNED.slice(0, 2).map((label, i) => ({ key: `p${i}`, label, values: ms.map((s) => share(s.planned[i])) }))} format={pct} tickFormat={pct0} max={1} />;
    },
  },

  /* ── Product groups (since 11.11.2026 every month) ────────── */
  {
    id: "groupLate", title: "Where the late lines are, per product group",
    hint: (f) => `${periodOf(f)} · the 15 groups with the most late lines and their share of all the late lines`,
    body: (f) => {
      const t = total(f);
      const rows = Object.entries(t.group).filter(([, r]) => r[1] > 0).sort((a, b) => b[1][1] - a[1][1]).slice(0, 15)
        .map(([g, r]) => ({ label: g, value: r[1], secondary: `${pct(t.late ? r[1] / t.late : null)} of the late lines · ${int(r[0])} lines` }));
      return rows.length ? <BarList rows={rows} format={n0} labelWidth={200} /> : NONE(`No product group in these months yet. ${NEXT_RUN}`);
    },
  },
  {
    id: "groupTrend", wide: true, title: "The largest product groups, month by month",
    hint: (f) => `the share on time of the five groups with the most lines in ${periodOf(f)} · ${axisWords(f)}`,
    body: (f) => {
      const t = total(f), ms = months(f);
      const top = Object.entries(t.group).sort((a, b) => b[1][0] - a[1][0]).slice(0, 5).map(([g]) => g);
      if (!top.length) return NONE(`No product group in these months yet. ${NEXT_RUN}`);
      return <MultiLine labels={LABELS(f)} series={top.map((g) => ({ key: g, label: g, values: ms.map((s) => { const r = s.group[g]; return r && r[0] ? (r[0] - r[1]) / r[0] : null; }) }))} format={pct} tickFormat={pct0} max={1} height={260} />;
    },
  },

  /* ── Planned articles, in more detail ─────────────────────── */
  {
    id: "plannedFigures", wide: true, title: "Planned, not planned - in figures",
    hint: (f) => `${periodOf(f)} · planned = the ERP plans the article's stock (ConsumptionDriven) · lead times in working days`,
    body: (f) => {
      const t = total(f), pl = t.plannedLead;
      const all = t.planned.reduce((a, r) => a + r[0], 0);
      return <Table head={["", "Lines", "Share of the lines", "On time", "Late", "Over 10 days late", "Promised lead", "Real lead"]} rows={PLANNED.map((label, i) => {
        const r = t.planned[i], x = pl?.[i];
        return { key: label, strong: i === 0, cells: [label, int(r[0]), pct(all ? r[0] / all : null), pct(share(r)), int(r[1]), x?.[0] ? int(x[3]) : "—", x?.[0] ? days1(avg(x[1], x[0])) : "—", x?.[0] ? days1(avg(x[2], x[0])) : "—"] };
      })} />;
    },
  },
  {
    id: "plannedPc", wide: true, title: "Planned articles per profit centre",
    hint: (f) => `${periodOf(f)} · the share of the lines on planned articles, and on time planned against not planned`,
    body: (f) => {
      type R = { label: string; n: number; pl: number; onPl: number | null; onNot: number | null };
      const rows: R[] = pcsOf(f).map((pc) => { const t = total(f, f.yms, { pc: [pc] }); return { label: pc, n: t.n, pl: t.planned[0][0], onPl: share(t.planned[0]), onNot: share(t.planned[1]) }; }).filter((r) => r.n > 0);
      return <FullTable first="Profit centre" initial="n" rows={rows} cols={[
        { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
        { key: "pl", head: "On planned articles", cell: (r) => pct(r.n ? r.pl / r.n : null), sort: (r) => (r.n ? r.pl / r.n : 0) },
        { key: "onPl", head: "Planned on time", cell: (r) => pct(r.onPl), sort: (r) => r.onPl ?? 0 },
        { key: "onNot", head: "Not planned on time", cell: (r) => pct(r.onNot), sort: (r) => r.onNot ?? 0 },
        { key: "gap", head: "Points apart", cell: (r) => (r.onPl == null || r.onNot == null ? "—" : `${r.onPl - r.onNot >= 0 ? "+" : "−"}${Math.abs(100 * (r.onPl - r.onNot)).toFixed(1)}`), sort: (r) => (r.onPl ?? 0) - (r.onNot ?? 0) },
      ]} />;
    },
  },
  {
    id: "plannedArticles", wide: true, title: "Planned articles late most often",
    hint: (f) => `${periodOf(f)} · the articles the ERP plans, by their late lines · ${NEXT_RUN.toLowerCase().replace(".", "")} for the planning flag`,
    body: (f) => {
      const keep = new Set(f.yms);
      type R = { label: string; group: string; pc: string; sup: string; n: number; late: number; days: number };
      const rows: R[] = f.k.articles.filter((a) => a.pl === "J").map((a) => {
        let n = 0, late = 0, days = 0;
        for (const [ym, t] of Object.entries(a.m)) if (keep.has(ym)) { n += t[0]; late += t[1]; days += t[2]; }
        return { label: a.a, group: a.group ?? "", pc: a.pc, sup: a.sup, n, late, days };
      }).filter((r) => r.late > 0);
      if (!rows.length) return NONE(`No planned article late in these months. ${NEXT_RUN}`);
      return <FullTable first="Article" find="an article" initial="late" rows={rows} cols={[
        { key: "group", head: "Product group", cell: (r) => r.group || "—" },
        { key: "pc", head: "Profit centre", cell: (r) => r.pc || "—" },
        { key: "sup", head: "Supplier", cell: (r) => supName(r.sup) },
        { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
        { key: "late", head: "Late", cell: (r) => int(r.late), sort: (r) => r.late },
        { key: "avg", head: "Average late", cell: (r) => days1(r.late ? r.days / r.late : null), sort: (r) => (r.late ? r.days / r.late : 0) },
      ]} />;
    },
  },

  /* ── GLC, in more detail: leftover and cut to size ────────── */
  {
    id: "glcFigures", wide: true, title: "GLC against the lines bought in - in figures",
    hint: (f) => `${periodOf(f)} · GLC = no supplier in the ERP: cut to size and made in house · processing = order to shipment, in working days`,
    body: (f) => {
      const t = total(f), g = t.sup[GLC];
      const gl = t.glcLead ?? [], gN = gl.reduce((a, r) => a + (r[0] ?? 0), 0), gProc = gl.reduce((a, r) => a + (r[1] ?? 0), 0), gReal = gl.reduce((a, r) => a + (r[2] ?? 0), 0);
      if (!g) return NONE();
      const bN = t.n - g[0], bLate = t.late - g[1], bDays = t.days - g[2];
      const bProcN = t.lead[0] - gN, bProc = (t.proc ?? 0) - gProc, bReal = t.lead[2] - gReal;
      return <Table head={["", "Lines", "Late", "On time", "Average late", "Over 10 days", "Processing", "Real lead"]} rows={[
        { key: "glc", strong: true, cells: ["GLC", int(g[0]), int(g[1]), pct(g[0] ? (g[0] - g[1]) / g[0] : null), days1(g[1] ? g[2] / g[1] : null), int(g[3]), gN ? days1(gProc / gN) : "—", gN ? days1(gReal / gN) : "—"] },
        { key: "bought", cells: ["Bought in (a supplier)", int(bN), int(bLate), pct(bN ? (bN - bLate) / bN : null), days1(bLate ? bDays / bLate : null), int(t.over10 - g[3]), gN && bProcN ? days1(bProc / bProcN) : "—", gN && bProcN ? days1(bReal / bProcN) : "—"] },
      ]} />;
    },
  },
  {
    id: "glcKindTrend", wide: true, title: "GLC month by month: leftover, cut to size and the rest",
    hint: (f) => `the share on time · ${axisWords(f)}`,
    body: (f) => {
      const ms = months(f);
      const has = GLC_KINDS.map((_, i) => ms.some((s) => s.glc?.[i]?.[0]));
      if (!has.some(Boolean)) return NONE(NEXT_RUN);
      return <MultiLine labels={LABELS(f)} series={GLC_KINDS.map((label, i) => ({ key: `g${i}`, label, values: ms.map((s) => (s.glc?.[i]?.[0] ? share(s.glc[i]) : null)) })).filter((_, i) => has[i])} format={pct} tickFormat={pct0} max={1} height={250} />;
    },
  },
  {
    id: "glcProc", wide: true, title: "GLC: from the order to the shipment, month by month",
    hint: () => "working days, on average · leftover, cut to size and the rest",
    body: (f) => {
      const ms = months(f);
      const has = GLC_KINDS.map((_, i) => ms.some((s) => s.glcLead?.[i]?.[0]));
      if (!has.some(Boolean)) return NONE(NEXT_RUN);
      return <MultiLine labels={LABELS(f)} series={GLC_KINDS.map((label, i) => ({ key: `p${i}`, label, values: ms.map((s) => { const r = s.glcLead?.[i]; return r?.[0] ? r[1] / r[0] : null; }) })).filter((_, i) => has[i])} format={days1} tickFormat={daysTick} height={250} />;
    },
  },
  {
    id: "glcPc", title: "GLC per profit centre",
    hint: (f) => `${periodOf(f)} · GLC's share on time in each profit centre`,
    body: (f) => {
      const rows = pcsOf(f).map((pc) => { const g = total(f, f.yms, { pc: [pc] }).sup[GLC]; return g && g[0] ? { label: pc, value: (g[0] - g[1]) / g[0], secondary: `${int(g[0])} lines · ${int(g[1])} late` } : null; })
        .filter((r): r is NonNullable<typeof r> => !!r).sort((a, b) => a.value - b.value);
      return <BarList rows={rows} format={pct} labelWidth={110} max={1} emptyMessage="No GLC line in these months." />;
    },
  },

  /* ── Lead & transport time, rebuilt ────────────────────────── */
  {
    id: "leadKpis", wide: true, title: "The lead times, month by month",
    hint: (f) => `working days, on average · promised = order to the first confirmed date, processing = order to shipment, transport = shipment to the customer, real = order to the customer · ${axisWords(f)}`,
    body: (f) => {
      const ms = months(f);
      const hasProc = ms.some(hasDist);
      return <MultiLine labels={LABELS(f)} series={[
        { key: "p", label: "Promised", values: ms.map((s) => avg(s.lead[1], s.lead[0])) },
        ...(hasProc ? [{ key: "o", label: "Processing", values: ms.map((s) => (hasDist(s) ? avg(s.proc ?? 0, s.lead[0]) : null)) }] : []),
        { key: "t", label: "Transport", values: ms.map((s) => avg(s.lead[3], s.lead[0])) },
        { key: "r", label: "Real", values: ms.map((s) => avg(s.lead[2], s.lead[0])) },
      ]} format={days1} tickFormat={daysTick} height={280} />;
    },
  },
  {
    id: "leadFigures", wide: true, title: "The lead times in figures",
    hint: (f) => `${periodOf(f)} · working days, on average · the real lead time against the promised: positive = longer than promised`,
    body: (f) => {
      const t = total(f), n = t.lead[0];
      if (!n) return NONE();
      const parts: [string, number | null][] = [
        ["Promised", avg(t.lead[1], n)], ["Processing", hasDist(t) ? avg(t.proc ?? 0, n) : null], ["Transport", avg(t.lead[3], n)], ["Real", avg(t.lead[2], n)],
      ];
      return <Table head={["", ...parts.map(([k]) => k), "Real minus promised"]} rows={[
        { key: "all", strong: true, cells: ["All the lines", ...parts.map(([, v]) => days1(v)), days1((avg(t.lead[2], n) ?? 0) - (avg(t.lead[1], n) ?? 0))] },
        ...["S", "P"].map((st) => { const x = total(f, f.yms, { st: [st] }), m = x.lead[0]; return { key: st, cells: [ST_LABEL[st], days1(avg(x.lead[1], m)), hasDist(x) ? days1(avg(x.proc ?? 0, m)) : "—", days1(avg(x.lead[3], m)), days1(avg(x.lead[2], m)), m ? days1((avg(x.lead[2], m) ?? 0) - (avg(x.lead[1], m) ?? 0)) : "—"] }; }),
        ...["100", "110"].map((c) => { const x = total(f, f.yms, { company: [c] }), m = x.lead[0]; return { key: c, cells: [MANDANT_LABEL[c], days1(avg(x.lead[1], m)), hasDist(x) ? days1(avg(x.proc ?? 0, m)) : "—", days1(avg(x.lead[3], m)), days1(avg(x.lead[2], m)), m ? days1((avg(x.lead[2], m) ?? 0) - (avg(x.lead[1], m) ?? 0)) : "—"] }; }),
      ]} />;
    },
  },
  {
    id: "leadDist", wide: true, title: "How long - the lines per band",
    hint: (f) => `${periodOf(f)} · each lead time, the lines per band of working days`,
    body: (f) => {
      const t = total(f);
      if (!hasDist(t)) return NONE(NEXT_RUN);
      const colors = [SERIES[2], "#cfe6d8", "#f7d9b5", "#f0b47a", "#e5873f", "#c45a1c", "#7d3410"];
      return <StackedColumns ordinal data={LEAD_MEASURES.map((m, i) => ({ x: m.split(":")[0], ...Object.fromEntries(t.dist![i].map((n, j) => [`b${j}`, n])) }))}
        parts={LEAD_BUCKETS.map((label, j) => ({ key: `b${j}`, label, color: colors[j] }))} format={n0} height={280} />;
    },
  },
  {
    id: "leadPc", wide: true, title: "The lead times per profit centre",
    hint: (f) => `${periodOf(f)} · working days, on average`,
    body: (f) => {
      type R = { label: string; n: number; p: number | null; o: number | null; t: number | null; r: number | null };
      const rows: R[] = pcsOf(f).map((pc) => { const x = total(f, f.yms, { pc: [pc] }), m = x.lead[0]; return { label: pc, n: m, p: avg(x.lead[1], m), o: hasDist(x) ? avg(x.proc ?? 0, m) : null, t: avg(x.lead[3], m), r: avg(x.lead[2], m) }; }).filter((r) => r.n > 0);
      return <FullTable first="Profit centre" initial="r" rows={rows} cols={[
        { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
        { key: "p", head: "Promised", cell: (r) => days1(r.p), sort: (r) => r.p ?? 0 },
        { key: "o", head: "Processing", cell: (r) => days1(r.o), sort: (r) => r.o ?? 0 },
        { key: "t", head: "Transport", cell: (r) => days1(r.t), sort: (r) => r.t ?? 0 },
        { key: "r", head: "Real", cell: (r) => days1(r.r), sort: (r) => r.r ?? 0 },
        { key: "gap", head: "Real minus promised", cell: (r) => (r.r == null || r.p == null ? "—" : days1(r.r - r.p)), sort: (r) => (r.r ?? 0) - (r.p ?? 0) },
      ]} />;
    },
  },
  {
    id: "transportDist", title: "Transport time - the lines per band",
    hint: (f) => `${periodOf(f)} · working days from the shipment to the customer`,
    body: (f) => {
      const t = total(f);
      if (!hasDist(t)) return NONE(NEXT_RUN);
      const all = t.dist![2].reduce((a, b) => a + b, 0);
      return <BarList rows={LEAD_BUCKETS.slice(0, 5).map((label, j) => ({ label, value: t.dist![2][j], secondary: pct(all ? t.dist![2][j] / all : null) }))} format={n0} labelWidth={110} />;
    },
  },
  {
    id: "dated", title: "How the date at the customer was found",
    hint: () => "the morning lines: the ERP's own date where they carry it, else the shipment plus the transport time",
    body: (f) => {
      const d = f.k.dated;
      if (!d) return NONE(NEXT_RUN);
      const rows = [["The ERP's own date", d.own], ["Collected, or Liechtenstein by DHL", d.mode], ["The customer's transport time", d.customer], ["The country's transport time", d.country]] as const;
      const all = rows.reduce((a, [, v]) => a + v, 0);
      return <BarList rows={rows.filter(([, v]) => v > 0).map(([label, v]) => ({ label, value: v, secondary: pct(all ? v / all : null) }))} format={n0} labelWidth={240} />;
    },
  },
  {
    id: "plannedLead", title: "Promised and real lead time, planned or not",
    hint: (f) => `${periodOf(f)} · working days, on average`,
    body: (f) => {
      const pl = total(f).plannedLead;
      if (!pl || !pl.some((r) => r[0])) return NONE(NEXT_RUN);
      return <BarList rows={PLANNED.flatMap((label, i) => (pl[i][0] ? [{ label: `${label} - promised`, value: pl[i][1] / pl[i][0] }, { label: `${label} - real`, value: pl[i][2] / pl[i][0] }] : []))} format={days1} labelWidth={220} />;
    },
  },

  /* ── Orders & date changes ────────────────────────────────── */
  {
    id: "changed", title: "Lines whose date was changed, and the others",
    hint: () => "the share on time · changed = the last confirmed date is not the first one",
    body: (f) => {
      const ms = months(f);
      return <MultiLine labels={LABELS(f)} series={[{ key: "c", label: "Date changed", values: ms.map((s) => share(s.changed[1])) }, { key: "n", label: "Never changed", values: ms.map((s) => share(s.changed[0])) }]} format={pct} tickFormat={pct0} max={1} />;
    },
  },
  {
    id: "changedDays", title: "Average days late, date changed or not",
    hint: () => "every line, early days as minus (the file's \"ChgBtwInitialAndLastInfluence\")",
    body: (f) => {
      const ms = months(f);
      return <MultiLine labels={LABELS(f)} series={[{ key: "c", label: "Date changed", values: ms.map((s) => avg(s.changed[1][2], s.changed[1][0])) }, { key: "n", label: "Never changed", values: ms.map((s) => avg(s.changed[0][2], s.changed[0][0])) }]} format={days1} tickFormat={daysTick} />;
    },
  },
  {
    id: "changeCats", wide: true, title: "How far the date moved",
    hint: (f) => `${periodOf(f)} · the working days between the first and the last confirmed date, the file's categories`,
    body: (f) => {
      const t = total(f);
      return <Table head={["Change of the date", "Lines", "Share of lines", "Late", "On time", "Average days"]} rows={CHANGE_CATS.map((label, i) => {
        const r = trioRow(t.change[i]);
        return { key: label, cells: [label, int(r.n), pct(t.n ? r.n / t.n : null), int(r.late), pct(r.onTime), days1(r.avgDays)] };
      })} />;
    },
  },
  {
    id: "positions", title: "Average days late per number of positions",
    hint: () => "the positions of the order the line belongs to, month by month (the file's \"NbOfPositionInfluence\")",
    body: (f) => {
      const ms = months(f);
      return <MultiLine labels={LABELS(f)} series={POSITION_CATS.map((label, i) => ({ key: `p${i}`, label, values: ms.map((s) => avg(s.pos[i][2], s.pos[i][0])) }))} format={days1} tickFormat={daysTick} />;
    },
  },
  {
    id: "posTable", title: "Positions per order",
    hint: (f) => `${periodOf(f)} · lines, on time and average days`,
    body: (f) => {
      const t = total(f);
      return <Table head={["Positions", "Lines", "Share", "On time", "Average days"]} rows={POSITION_CATS.map((label, i) => {
        const r = trioRow(t.pos[i]);
        return { key: label, cells: [label, int(r.n), pct(t.n ? r.n / t.n : null), pct(r.onTime), days1(r.avgDays)] };
      })} />;
    },
  },
  {
    id: "shape", wide: true, title: "One delivery asked, or several",
    hint: (f) => `${periodOf(f)} · one delivery asked = every position of the order has the same first confirmed date (the file's "SingleDeliveryOrNotInfluence")`,
    body: (f) => {
      const t = total(f);
      const rows = POSITION_CATS.flatMap((p, i) => DELIVERY_ASKED.map((d, j) => ({ p, d, r: trioRow(t.shape[i * 2 + j]) }))).filter((x) => x.r.n);
      return <Table head={["Positions", "Delivery", "Lines", "On time", "Average days"]} left={[1]} rows={rows.map((x) => ({ key: `${x.p}${x.d}`, cells: [x.p, x.d, int(x.r.n), pct(x.r.onTime), days1(x.r.avgDays)] }))} />;
    },
  },
  {
    id: "more", title: "More deliveries than first confirmed",
    hint: (f) => `${periodOf(f)} · lines of an order split into more deliveries than its first confirmation said`,
    body: (f) => {
      const t = total(f);
      return <BarList rows={DELIVERIES.map((label, i) => { const r = trioRow(t.more[i]); return { label, value: r.onTime, secondary: `${int(r.n)} lines · ${days1(r.avgDays)} on average` }; })} format={pct} labelWidth={240} max={1} />;
    },
  },
  {
    id: "commentKinds", title: "What the customers wrote",
    hint: () => `${REMARK_FROM} · each remark read for what it asks · the period and the filters do not apply`,
    body: () => {
      const all = REMARK_KINDS.reduce((a, r) => a + r[1], 0);
      return <BarList rows={REMARK_KINDS.map(([label, n, orders]) => ({ label, value: n, secondary: `${pct(n / all)} of the remarks · ${int(orders)} orders` }))} format={n0} labelWidth={260} />;
    },
  },
  {
    id: "commentOnTime", title: "On time, by what the remark asks",
    hint: () => `${REMARK_FROM} · the share of the lines on time, against the lines without a remark`,
    body: () => (
      <BarList rows={[...REMARK_KINDS, REMARK_NONE].map(([label, n, , late, days]) => ({ label, value: (n - late) / n, secondary: `${int(n)} lines · ${int(late)} late · ${days1(late ? days / late : null)} late on average` }))}
        format={pct} labelWidth={260} max={1} />
    ),
  },
  {
    id: "commentTable", wide: true, title: "The remarks in figures",
    hint: () => `${REMARK_FROM} · average late = the late lines' working days after the first confirmed date`,
    body: () => {
      const withR = REMARK_KINDS.reduce<[number, number, number, number]>((a, r) => [a[0] + r[1], a[1] + r[2], a[2] + r[3], a[3] + r[4]], [0, 0, 0, 0]);
      const row = (key: string, label: string, [n, orders, late, days]: [number, number, number, number], strong = false) =>
        ({ key, strong, cells: [label, int(n), orders ? int(orders) : "—", int(late), pct((n - late) / n), days1(late ? days / late : null)] });
      return <Table head={["", "Lines", "Orders", "Late", "On time", "Average late"]} rows={[
        ...REMARK_KINDS.map(([label, ...x]) => row(label, label, x)),
        row("with", "Every line with a remark", withR, true),
        row("without", "The lines without a remark", [REMARK_NONE[1], 0, REMARK_NONE[3], REMARK_NONE[4]], true),
      ]} />;
    },
  },
  {
    id: "comment", wide: true, title: "With a remark and without, month by month",
    hint: () => `the share on time · ${REMARK_FROM}, by the month delivered - the months after it stay empty: the ERP's files the hub receives carry no remark`,
    body: (f) => {
      const at = new Map(REMARK_MONTHS.map((m) => [m[0], m]));
      const v = (i: 1 | 3) => f.yms.map((ym) => { const m = at.get(ym); if (!m) return null; const n = m[i], late = i === 1 ? m[2] : m[4]; return n ? (n - late) / n : null; });
      if (!f.yms.some((ym) => at.has(ym))) return NONE("The OTD analysis file holds no month of this period.");
      return <MultiLine labels={LABELS(f)} series={[{ key: "with", label: "With a remark", values: v(1) }, { key: "without", label: "Without a remark", values: v(3) }]} format={pct} tickFormat={pct0} max={1} />;
    },
  },

  /* ── what the morning lines carry since 10.11.2026 ─────────── */
  {
    id: "replen", wide: true, title: "Promised faster than the supplier can replenish",
    hint: (f) => `${periodOf(f)} · articles NOT planned, by their main supplier's replenishment time in the ERP: the lines whose first confirmed date came sooner after the order than that time - late from the start unless the article was in stock`,
    body: (f) => {
      const t = total(f), r = t.replen ?? [[0, 0, 0], [0, 0, 0]];
      if (!r[0][0] && !r[1][0]) return NONE("Counted from the morning lines once they carry the articles' planning (since 10.11.2026).");
      return <Table head={["Lines of articles not planned", "Lines", "Share", "On time", "Average days"]} rows={[
        { key: "ok", cells: ["Promised at least the replenishment time", int(r[0][0]), pct(r[0][0] / (r[0][0] + r[1][0])), pct(share(r[0])), days1(avg(r[0][2], r[0][0]))] },
        { key: "fast", strong: true, cells: ["Promised faster than the supplier replenishes", int(r[1][0]), pct(r[1][0] / (r[0][0] + r[1][0])), pct(share(r[1])), days1(avg(r[1][2], r[1][0]))] },
      ]} />;
    },
  },
  {
    id: "wishOtd", wide: true, title: "On time against the first confirmed date and against the customer's wish",
    hint: () => "the same lines: reached the customer by the date we first confirmed, and by the date the customer asked for (CustomerWishDate)",
    body: (f) => {
      const ms = months(f);
      if (!ms.some((s) => s.wish?.[0])) return NONE("Counted from the morning lines once they carry the customer's wish date (since 10.11.2026).");
      return <MultiLine labels={LABELS(f)} series={[
        { key: "f", label: "By the first confirmed date", values: ms.map((s) => (s.wish?.[0] ? onTimeShare(s) : null)) },
        { key: "w", label: "By the customer's wish date", values: ms.map((s) => (s.wish?.[0] ? share(s.wish) : null)) },
      ]} format={pct} tickFormat={pct0} max={1} height={260} />;
    },
  },
  {
    id: "wishLater", title: "First confirmed later than the customer asked",
    hint: () => "the share of the lines whose first confirmed date came after the customer's wish date",
    body: (f) => {
      const ms = months(f);
      return <MonthTrend values={ms.map((s) => (s.wish?.[0] ? (s.wishLater ?? 0) / s.wish[0] : null))} labels={LABELS(f)} label="Later than asked" fmt={pct} tick={pct0} />;
    },
  },
  {
    id: "wishTable", title: "The customer's wish in figures",
    hint: (f) => `${periodOf(f)} · the lines carrying a wish date`,
    body: (f) => {
      const t = total(f), w = t.wish ?? [0, 0, 0];
      if (!w[0]) return NONE("Counted from the morning lines once they carry the customer's wish date.");
      return <Table head={["", "Lines", "Share"]} rows={[
        { key: "n", cells: ["Lines with a wish date", int(w[0]), pct(t.n ? w[0] / t.n : null)] },
        { key: "later", cells: ["First confirmed later than asked", int(t.wishLater ?? 0), pct((t.wishLater ?? 0) / w[0])] },
        { key: "ok", strong: true, cells: ["Reached the customer by the wish date", int(w[0] - w[1]), pct(share(w))] },
        { key: "days", cells: ["Average days against the wish (early as minus)", days1(avg(w[2], w[0])), ""] },
      ]} />;
    },
  },
  {
    id: "customers", wide: true, title: "The customers with the most late lines",
    hint: (f) => `${periodOf(f)}, by the month of the first confirmed date · the 300 customers with the most late lines over all the months, their company and its owner in HubSpot · the other filters do not apply here`,
    body: (f) => {
      type R = { label: string; name: string; owner: string; company: string; n: number; late: number; days: number };
      const rows: R[] = (f.k.customers ?? []).map((c) => {
        let n = 0, late = 0, days = 0;
        for (const ym of f.yms) { const t = c.m[ym]; if (t) { n += t[0]; late += t[1]; days += t[2]; } }
        return { label: c.c, name: c.name ?? "", owner: c.owner ?? "", company: c.company, n, late, days };
      }).filter((r) => r.late > 0);
      if (!rows.length) return NONE("Counted from the morning lines once they carry the customer (since 10.11.2026).");
      return <FullTable first="Customer" find="a customer or company" initial="late" rows={rows} cols={[
        { key: "name", head: "Company", cell: (r) => r.name || "—" },
        { key: "owner", head: "Owner", cell: (r) => r.owner || "—" },
        { key: "company", head: "Mandant", cell: (r) => r.company },
        { key: "n", head: "Lines", cell: (r) => int(r.n), sort: (r) => r.n },
        { key: "late", head: "Late", cell: (r) => int(r.late), sort: (r) => r.late },
        { key: "rate", head: "On time", cell: (r) => pct(r.n ? (r.n - r.late) / r.n : null), sort: (r) => (r.n ? (r.n - r.late) / r.n : 0) },
        { key: "avg", head: "Average late", cell: (r) => days1(r.late ? r.days / r.late : null), sort: (r) => (r.late ? r.days / r.late : 0) },
      ]} />;
    },
  },
  {
    id: "ownersBars", title: "Late lines per owner",
    hint: (f) => `${periodOf(f)} · the late lines of the customers above, by their company's owner`,
    body: (f) => {
      const t = new Map<string, [number, number]>();
      for (const c of f.k.customers ?? []) for (const ym of f.yms) { const v = c.m[ym]; if (!v) continue; const k = c.owner || "No owner"; const x = t.get(k) ?? [0, 0]; x[0] += v[0]; x[1] += v[1]; t.set(k, x); }
      const rows = [...t].filter(([, v]) => v[1] > 0).sort((a, b) => b[1][1] - a[1][1]).slice(0, 15).map(([k, v]) => ({ label: k, value: v[1], secondary: `of ${int(v[0])} lines · ${pct(v[1] / v[0])} late` }));
      return <BarList rows={rows} format={n0} labelWidth={200} emptyMessage="Counted once the morning lines carry the customer." />;
    },
  },

  /* ── Lead & transport ─────────────────────────────────────── */
  {
    id: "lead", wide: true, title: "Lead time promised and real",
    hint: () => "working days from the order to the first confirmed date (promised) and to the customer (real), on average",
    body: (f) => {
      const ms = months(f);
      return <MultiLine labels={LABELS(f)} series={[{ key: "p", label: "Promised", values: ms.map((s) => avg(s.lead[1], s.lead[0])) }, { key: "r", label: "Real", values: ms.map((s) => avg(s.lead[2], s.lead[0])) }]} format={days1} tickFormat={daysTick} height={260} />;
    },
  },
  {
    id: "leadMandant", title: "Per mandant",
    hint: (f) => `${periodOf(f)} · working days on average`,
    body: (f) => <Table head={["Mandant", "Lines", "Promised", "Real", "Transport"]} rows={["100", "110"].map((c) => {
      const t = total(f, f.yms, { company: [c] });
      return { key: c, cells: [MANDANT_LABEL[c], int(t.lead[0]), days1(avg(t.lead[1], t.lead[0])), days1(avg(t.lead[2], t.lead[0])), days1(avg(t.lead[3], t.lead[0]))] };
    })} />,
  },
  {
    id: "transport", title: "Transport time per mandant",
    hint: () => "working days from the shipment to the customer, on average - the morning lines read the ERP's date at the customer where they carry it, else the country's transport time",
    body: (f) => <MultiLine labels={LABELS(f)} series={["100", "110"].map((c) => ({ key: c, label: MANDANT_LABEL[c], values: months(f, { company: [c] }).map((s) => avg(s.lead[3], s.lead[0])) }))} format={days1} tickFormat={daysTick} />,
  },

  /* ── File vs hub: charts only (SARCLA 10.11.2026: "just show visually the difference, no text no tab") ── */
  {
    id: "vsMonths", wide: true, title: "On time: the OTD analysis file and the hub, month by month",
    hint: () => "the same 97,409 lines, by the month delivered · the file exported 26.10.2026",
    body: () => <MultiLine labels={VS_FILE.map(([ym]) => ymLabel(ym))} series={[{ key: "file", label: "The OTD analysis file", values: VS_FILE.map((r) => r[1] / 100) }, { key: "hub", label: "The hub", values: VS_FILE.map((r) => r[2] / 100) }]} format={pct} tickFormat={pct0} height={280} />,
  },
  {
    id: "vsGap", title: "Points apart, month by month",
    hint: () => "the hub's on time minus the file's",
    body: () => <BarList rows={VS_FILE.map(([ym, a, b]) => ({ label: ymLabel(ym), value: Math.abs(b - a), secondary: b - a > 0.05 ? "the hub higher" : b - a < -0.05 ? "the hub lower" : "the same" }))} format={(v) => (v == null ? "—" : `${v.toFixed(1)} pts`)} labelWidth={80} />,
  },
  {
    id: "vsVerdict", title: "Lines on time for one, late for the other",
    hint: () => "the share of the month's lines whose verdict differs",
    body: () => <BarList rows={VS_FILE.map(([ym, , , d]) => ({ label: ymLabel(ym), value: d / 100 }))} format={pct} labelWidth={80} max={0.1} />,
  },
  {
    id: "vsDays", title: "The date at the customer, line by line",
    hint: () => "the hub's date against the file's",
    body: () => <BarList rows={VS_FILE_DAYS.map(([label, v]) => ({ label, value: v / 100 }))} format={pct} labelWidth={170} max={1} />,
  },
  {
    id: "vsRule", title: "The file's rule against the Back Office's",
    hint: () => "the file's own 201,345 lines counted both ways, by the month delivered",
    body: () => <MultiLine labels={CHECK.map(([ym]) => ymLabel(ym))} series={[{ key: "file", label: "The file's rule", values: CHECK.map((r) => r[2] / 100) }, { key: "bo", label: "The Back Office's rule", values: CHECK.map((r) => r[3] / 100) }]} format={pct} tickFormat={pct0} height={240} />,
  },

  /* ── File vs hub, the earlier views (kept, no longer on the page) ── */
  {
    id: "rule", wide: true, title: "The rule",
    hint: () => "the OTD analysis file's, word for word - and how the hub reads it",
    body: () => <Points items={[
      ["Late days", "The working days (Monday to Friday) from the line's FIRST confirmed date to the day it reached the customer: 0 the same day, +n late, -n early. On time = 0 or less."],
      ["The month", "The file counts each line in the month it reached the customer. The Back Office's KPI counts it in the month of its first confirmed date. The switch \"Month counted by\" in Filters shows either."],
      ["The categories", "On time or early · 1-2 · 3-4 · 5-10 · 11-30 · more than 30 working days late - the file's \"Category late apso\"."],
      ["The date at the customer", "The file reads it from the ERP: the forwarder's date at the customer. The morning lines carry the same date on about a fifth of the lines (DeliveryDateCustomer - equal to the file's wherever both have it). For the others the hub adds to the shipment the country's transport time in the ERP - none when the customer collects, one day for Liechtenstein by DHL. Measured on 97,409 lines in both (the file exported on 26.10.2026): the same verdict on time or late on 97.6 % of them, the months on average about 1 point apart. Where they differ: the customers whose own transport time in the ERP is not their country's (Italy and Austria 3 or 4 days, by the customer) and the dates the forwarder moved. Public holidays are not counted - a holiday calendar did not bring the verdict closer."],
      ["GLC", "The lines whose article has no supplier in the ERP: cut to size and made in house - the file's supplier \"-\"."],
      ["Impact", "A supplier's late days summed; its index = 100 × its late days / the largest supplier's; Critical from 50, High from 20, Medium from 10, else Low."],
      ["Date changes", "The working days between the first and the last confirmed date: moved earlier, none, 1-4, 5-9, 10-14, 15-19, 20 or more."],
      ["Order shape", "The positions of the order (1, 2, 3, 4 or more); one delivery asked when every position has the same first date; more deliveries than first confirmed when its lines reached the customer on more days than it had first dates."],
      ["The lines", "Order lines of mandants 100 and 110, standard and special articles, shipped - every order source; the eShop's alone unless Filters say otherwise (the file holds the eShop's)."],
    ]} />,
  },
  {
    id: "sources", wide: true, title: "Where the figures come from",
    hint: () => "each month from one source - the morning lines first",
    body: (f) => <Points items={[
      ["The ERP's order lines", `Every morning, from the same sheet of the morning workbook as the Back Office's KPIs: the lines of the last 13 months. ${f.k.from.includes("erp") ? "In the figures." : "Not in yet - the next morning run brings them."}`],
      ["The OTD analysis file", `Its own lines (\"Data Input\"), for the months before the morning lines begin - with the planned flag, the product groups and the customers' comments the morning lines lack. ${f.k.from.includes("file") ? "In the figures." : "Not in yet."}`],
      ...(f.k.dated ? [["The date at the customer", `Of the morning lines: ${f.k.dated.own.toLocaleString("en")} with the ERP's own date · ${(f.k.dated.file ?? 0).toLocaleString("en")} with the ERP's date from the OTD analysis file · ${f.k.dated.customer.toLocaleString("en")} by the customer's transport time · ${f.k.dated.mode.toLocaleString("en")} collected or Liechtenstein by DHL · ${f.k.dated.country.toLocaleString("en")} by the country's transport time`] as [string, string]] : []),
      ["Counted", `${f.k.lines.toLocaleString("en")} lines · first confirmed dates ${ymLabel(f.k.first)} – ${ymLabel(f.k.last)} · updated ${new Date(f.k.at).toLocaleString("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`],
    ]} />,
  },
  {
    id: "axes", wide: true, title: "By the promised month or by the delivered month",
    hint: () => "the same lines, the share on time counted both ways - the file counts by the month delivered",
    body: (f) => {
      const p = monthly(f.k.promised, f.yms, f.filter), d = monthly(f.k.delivered, f.yms, f.filter);
      return <MultiLine labels={LABELS(f)} series={[{ key: "p", label: "By the first confirmed date's month", values: p.map((s) => (s.n ? onTimeShare(s) : null)) }, { key: "d", label: "By the month delivered (the file)", values: d.map((s) => (s.n ? onTimeShare(s) : null)) }]} format={pct} tickFormat={pct0} max={1} height={260} />;
    },
  },
  {
    id: "check", wide: true, title: "The file against the Back Office's rule, line by line",
    hint: () => "checked 09.11.2026 on the file's own 201,345 lines (eShop, Jan 2025 – Sep 2026) - the hub's rule did not change since",
    body: () => <Box sx={{ display: "grid", gap: 1.5 }}>
      <Points items={[
        ["In total", "The file's rule 79.5 % on time; the Back Office's rule (shipment + transport time by the first date, the first date's month) 80.6 % on the same lines."],
        ["Line by line", "The same verdict on 98.4 % of the lines (198,014). 2,828 lines are late for the file and on time for the Back Office's rule: the ERP's date at customer is later than the shipment plus the line's transport time. 503 the other way."],
        ["Month by month", "Up to 3 points apart - mostly the month each counts in: a line first promised for the end of a month and late lands in the next month for the file."],
      ]} />
      <Table head={["Month", "Lines", "The file (delivered month)", "Back Office rule (promised month)", "Apart"]} rows={CHECK.map(([ym, n, a, b]) => ({ key: ym, cells: [ymLabel(ym), int(n), `${a.toFixed(1)}%`, `${b.toFixed(1)}%`, `${(b - a > 0 ? "+" : "")}${(b - a).toFixed(1)}`] }))} pageSize={12} />
    </Box>,
  },
];

/** the file check of 09.11.2026: [month, lines (delivered), the file's on-time %, the Back Office rule's on-time %] */
const CHECK: [string, number, number, number][] = [
  ["2025-01", 10790, 76.7, 73.5], ["2025-02", 10535, 79.0, 81.2], ["2025-03", 10435, 85.5, 85.1], ["2025-04", 9925, 84.3, 83.9], ["2025-05", 9773, 80.7, 83.6],
  ["2025-06", 9200, 80.7, 83.8], ["2025-07", 10094, 83.8, 86.5], ["2025-08", 7639, 83.4, 84.6], ["2025-09", 10120, 83.9, 85.4], ["2025-10", 10320, 84.2, 85.4],
  ["2025-11", 9335, 84.8, 86.3], ["2025-12", 6509, 82.9, 84.4], ["2026-01", 10096, 74.7, 74.3], ["2026-02", 10540, 82.6, 85.4], ["2026-03", 10973, 80.2, 80.5],
  ["2026-04", 10048, 71.3, 72.4], ["2026-05", 8515, 73.0, 75.4], ["2026-06", 10210, 69.1, 70.6], ["2026-07", 10298, 69.8, 72.6], ["2026-08", 7872, 77.7, 79.5],
  ["2026-09", 8114, 83.1, 90.6],
];

/** the hub against the OTD analysis file of 26.10.2026, measured 10.11.2026 on the 97,409 lines both hold, by the month
 *  delivered: [month, the file's on-time %, the hub's on-time %, the lines whose verdict differs %] */
const VS_FILE: [string, number, number, number][] = [
  ["2025-11", 92.7, 92.6, 2.5], ["2025-12", 86.6, 86.7, 3.1], ["2026-01", 77.2, 76.8, 2.4], ["2026-02", 84.0, 82.7, 1.4], ["2026-03", 80.7, 78.7, 3.0],
  ["2026-04", 71.7, 72.0, 2.8], ["2026-05", 73.3, 74.7, 3.3], ["2026-06", 69.3, 68.5, 2.1], ["2026-07", 70.3, 69.5, 1.2], ["2026-08", 77.8, 77.5, 0.4],
  ["2026-09", 83.2, 79.2, 4.8],
];
/** the same lines, the hub's date at the customer against the file's (working days) */
const VS_FILE_DAYS: [string, number][] = [
  ["The same day", 90.4], ["The hub 1 day earlier", 4.1], ["The hub 1 day later", 4.5], ["The hub 2 days earlier", 0.5], ["3 days or more earlier", 0.3],
  ["2 days or more later", 0.2],
];

/** The shop customers' checkout remarks ("Bemerkung des Kunden (nicht bindend für APSOparts)" and its four languages) in
 *  the OTD analysis file of 26.10.2026 - lines delivered Jan 2025 - Sep 2026, its rule - read 11.11.2026 for what each asks
 *  (SARCLA: "we need to check the detail of the comment"). Counts only: [kind, lines, orders, late lines, late days]. */
const REMARK_FROM = "the OTD analysis file's lines delivered Jan 25 – Sep 26";
const REMARK_KINDS: [string, number, number, number, number][] = [
  ["Their own reference (order, article, drawing)", 20619, 9624, 3945, 39783],
  ["Another note (a commission, a person, a machine)", 3551, 2356, 785, 9651],
  ["A delivery wish (a date, partial, how)", 588, 494, 151, 2647],
  ["A certificate or declaration (FDA, 3.1 …)", 562, 350, 156, 1349],
  ["A price or an offer", 330, 280, 118, 1565],
];
const REMARK_NONE: [string, number, number, number, number] = ["No remark", 175695, 0, 36150, 466714];
/** month delivered -> lines with a remark, late of them, lines without, late of them */
const REMARK_MONTHS: [string, number, number, number, number][] = [
  ["2025-01", 1607, 395, 9183, 2120], ["2025-02", 1344, 224, 9191, 1989], ["2025-03", 1410, 209, 9025, 1307], ["2025-04", 1118, 177, 8807, 1383],
  ["2025-05", 1382, 304, 8391, 1579], ["2025-06", 1220, 223, 7980, 1551], ["2025-07", 1359, 210, 8735, 1428], ["2025-08", 1012, 132, 6627, 1137],
  ["2025-09", 1379, 246, 8741, 1386], ["2025-10", 1430, 215, 8890, 1413], ["2025-11", 1104, 167, 8231, 1249], ["2025-12", 784, 96, 5725, 1018],
  ["2026-01", 1317, 342, 8779, 2214], ["2026-02", 1398, 175, 9142, 1659], ["2026-03", 1260, 222, 9713, 1956], ["2026-04", 1200, 393, 8848, 2488],
  ["2026-05", 1019, 268, 7496, 2034], ["2026-06", 1253, 413, 8957, 2739], ["2026-07", 1198, 351, 9100, 2758], ["2026-08", 890, 237, 6982, 1522],
  ["2026-09", 966, 156, 7148, 1219],
];

/** the cube's suppliers by their real lead time, the most lines first (the cube names its 60 largest) */
function supLeadBars(f: Frame, n: number): React.ReactNode {
  const rows = Object.entries(total(f).sup).filter(([k]) => k !== OTHER).sort((a, b) => b[1][0] - a[1][0]).slice(0, n);
  return <PagedBars rows={rows.map(([s, r]) => ({ label: supName(s), value: r[0] ? r[6] / r[0] : null, secondary: `${int(r[0])} lines` }))} size={15} format={days1} />;
}
/** every supplier month by month, a page at a time - a component: the pages keep their place */
function SupMonthPages({ f }: { f: Frame }) {
  const ms = months(f), all = topSuppliers(f, Infinity), t = total(f);
  const { page, pages, setPage, slice } = usePages(all, 15);
  return (
    <Box sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
      <Table head={["Supplier", ...LABELS(f), "Late days"]} left={[0]} minWidth={260 + 72 * (f.yms.length + 1)} rows={slice.map((s) => ({
        key: s, cells: [supName(s), ...ms.map((m) => { const r = m.sup[s]; return r ? cell(r[0] ? r[1] / r[0] : null, r[0], false, true) : <span style={{ color: FAINT }}>—</span>; }), int(t.sup[s]?.[2] ?? 0)],
      }))} />
      <PageBar page={page} pages={pages} setPage={setPage} from={page * 15 + 1} to={page * 15 + slice.length} of={all.length} />
    </Box>
  );
}
/** the suppliers with the most late days over the period (GLC among them), "Other suppliers" never one */
function topSuppliers(f: Frame, n: number): string[] {
  return Object.entries(total(f).sup).filter(([k]) => k !== OTHER).sort((a, b) => b[1][2] - a[1][2]).slice(0, n).map(([k]) => k);
}
/** one supplier's months: its lines, late lines and late lines per category (the cube keeps them per supplier) */
function monthsOfSupplier(f: Frame, supplier: string): Slice[] {
  return months(f).map((m) => {
    const r = m.sup[supplier], s = emptySlice();
    if (!r) return s;
    s.n = r[0]; s.late = r[1]; s.cat[0] = r[0] - r[1];
    for (let c = 1; c <= 5; c++) s.cat[c] = r[6 + c] ?? 0;
    return s;
  });
}

function cell(v: number | null, n: number, strong = false, lateIsBad = false): React.ReactNode {
  if (!n || v == null) return <span style={{ color: FAINT }}>—</span>;
  const bad = lateIsBad ? v >= 0.3 : v < 0.7;
  return (
    <Box component="span" sx={{ display: "inline-grid", textAlign: "right", lineHeight: 1.15 }}>
      <Box component="span" sx={{ fontWeight: strong ? 800 : 600, color: bad ? BAD : INK }}>{pct(v)}</Box>
      <Box component="span" sx={{ fontSize: "0.7rem", color: FAINT }}>{int(n)}</Box>
    </Box>
  );
}
function Prio({ p }: { p: string }) {
  const t: Tint = p === "Critical" ? "pink" : p === "High" ? "amber" : p === "Medium" ? "blue" : "slate";
  return <Chip size="small" label={p} sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700, bgcolor: TINT[t].bg, color: TINT[t].fg }} />;
}
function Points({ items }: { items: [string, string][] }) {
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {items.map(([a, b]) => (
        <Box key={a} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "200px 1fr" }, gap: { xs: 0.25, md: 2 }, py: 0.75, borderTop: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{a}</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED, lineHeight: 1.5 }}>{b}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── a tab per question, one card that follows it ───────────────────────── */

type TabDef = { id: string; label: string; title: string; note: string; icon: React.ReactNode; tint: Tint; charts: string[] };
const TABS: Record<OtdSlug, TabDef[]> = {
  customers: [
    { id: "list", label: "Customers", title: "OTD per customer", note: "every customer's lines, late lines and orders late - a click opens one: its figures, orders line by line, articles and suppliers", icon: <GroupsOutlinedIcon />, tint: "purple", charts: ["custExplorer"] },
    { id: "articles", label: "Articles", title: "OTD per article", note: "every article's lines, late lines, customers and orders - its number with its name, product group, product and supplier", icon: <InventoryOutlinedIcon />, tint: "amber", charts: ["artMaster"] },
  ],
  overview: [
    { id: "ontime", label: "On time", title: "On time", note: "the lines that reached the customer by their first confirmed date - per mandant and article type", icon: <LocalShippingOutlinedIcon />, tint: "green", charts: ["otd", "lines", "mandant", "type"] },
    { id: "late", label: "How late", title: "How late", note: "the file's categories, month by month - and the days late of the late lines", icon: <EventRepeatOutlinedIcon />, tint: "amber", charts: ["catMix", "catAvg", "catTable", "depth", "over10"] },
    { id: "pcs", label: "Profit centres", title: "Per profit centre", note: "each article's profit centre", icon: <ApartmentOutlinedIcon />, tint: "blue", charts: ["pcBars", "pcLate", "pcTrend", "pcTable", "pcCats", "pcMonths"] },
    { id: "customers", label: "Customers", title: "Per customer", note: "every customer's lines, late lines and orders late - a click opens one", icon: <GroupsOutlinedIcon />, tint: "purple", charts: ["custExplorer"] },
  ],
  suppliers: [
    { id: "impact", label: "Impact ranking", title: "Which suppliers make us late", note: "the file's \"Supplier Impact Rank\": each supplier's late days, its index against the largest, its priority", icon: <FactoryOutlinedIcon />, tint: "pink", charts: ["top10", "supRate", "impact"] },
    { id: "months", label: "Month by month", title: "The largest contributors, month by month", note: "late days and their share of the month - the file's \"Supplier Impact Monthly\" and \"%LatePerSupplier\"", icon: <BarChartOutlinedIcon />, tint: "amber", charts: ["supDays", "supShare", "supMonthTable"] },
    { id: "glc", label: "GLC", title: "GLC - cut to size and made in house", note: "the lines whose article has no supplier: DirectCut's orders as a leftover off the shelf or cut on the saw, the companies that received them, and against the lines bought in", icon: <ContentCutOutlinedIcon />, tint: "purple", charts: ["glcCompanies", "glcFigures", "glcPc", "glcKindTrend", "glcProc", "glcVs", "glcCats"] },
    { id: "lead", label: "Lead time", title: "Lead time per supplier", note: "every supplier from the order to the customer - in figures, then the graph", icon: <HourglassEmptyOutlinedIcon />, tint: "green", charts: ["supLeadAll"] },
  ],
  products: [
    { id: "articles", label: "Articles", title: "Every article", note: "each article's number with its name, product group, product and supplier - its lines, late lines, customers and orders", icon: <InventoryOutlinedIcon />, tint: "amber", charts: ["articleBars", "groups", "artMaster"] },
    { id: "groups", label: "Product groups", title: "Per product group", note: "each article's main group in the ERP's article master - every month", icon: <CategoryOutlinedIcon />, tint: "blue", charts: ["groupLate", "groups", "groupTrend", "groupTable"] },
    { id: "planned", label: "Planned articles", title: "Planned articles and replenishment time", note: "the ERP's planning of each article: how they do against the others, per profit centre, the planned articles late most often, and the lines promised faster than the supplier replenishes", icon: <TimerOutlinedIcon />, tint: "green", charts: ["plannedFigures", "planned", "plannedLead", "plannedPc", "plannedArticles", "replen"] },
  ],
  orders: [
    { id: "changes", label: "Date changes", title: "When the confirmed date moved", note: "the lines whose date changed after the first confirmation, and how far", icon: <EventRepeatOutlinedIcon />, tint: "pink", charts: ["changed", "changedDays", "changeCats"] },
    { id: "shape", label: "Order shape", title: "The order's shape", note: "the positions per order, one delivery or several, more deliveries than confirmed", icon: <ShoppingCartOutlinedIcon />, tint: "blue", charts: ["positions", "posTable", "more", "shape"] },
    { id: "wish", label: "Customer's wish", title: "The date the customer asked for", note: "on time against the customer's wish date, and the lines first confirmed later than asked", icon: <CalendarMonthOutlinedIcon />, tint: "amber", charts: ["wishOtd", "wishLater", "wishTable"] },
    { id: "comment", label: "Customer comment", title: "A comment from the customer", note: "what the shop customers wrote at checkout (\"not binding for APSOparts\"), read in the OTD analysis file - the ERP's files the hub receives do not carry it", icon: <ForumOutlinedIcon />, tint: "slate", charts: ["commentKinds", "commentOnTime", "commentTable", "comment"] },

  ],
  lead: [
    { id: "lead", label: "Lead times", title: "Lead times", note: "promised, processing, transport and real - in working days, month by month, per band and per profit centre", icon: <HourglassEmptyOutlinedIcon />, tint: "green", charts: ["leadKpis", "leadFigures", "leadDist", "leadPc"] },
    { id: "transport", label: "Transport", title: "Transport time", note: "from the shipment to the customer, and how the date at the customer was found", icon: <LocalShippingOutlinedIcon />, tint: "blue", charts: ["transport", "transportDist", "dated", "leadMandant"] },
    { id: "replen", label: "Planning & replenishment", title: "Planning and replenishment", note: "planned articles' lead times, and the lines promised faster than the supplier replenishes", icon: <TimerOutlinedIcon />, tint: "amber", charts: ["plannedLead", "replen"] },
    { id: "suppliers", label: "Suppliers", title: "Lead time per supplier", note: "every supplier from the order to the customer - in figures, then the graph", icon: <FactoryOutlinedIcon />, tint: "pink", charts: ["supLeadAll"] },
  ],
  compare: [
    { id: "vs", label: "File vs hub", title: "The OTD analysis file against the hub", note: "the same lines, both ways", icon: <CompareArrowsOutlinedIcon />, tint: "blue", charts: ["vsMonths", "vsGap", "vsVerdict", "vsDays", "axes", "vsRule"] },
  ],
};

/* ── the filters ───────────────────────────────────────────────────────── */

const toggleParam = (key: string, v: string) => setQuery((q) => { const all = q.getAll(key); q.delete(key); for (const x of all.includes(v) ? all.filter((y) => y !== v) : [...all, v]) q.append(key, x); });
const setParam = (key: string, v: string | null) => setQuery((q) => { if (v == null) q.delete(key); else q.set(key, v); });
const clearAll = () => setQuery((q) => { for (const k of ["from", "to", "axis", "mandant", "src", "st", "pc"]) q.delete(k); });

function Toggles({ options, on, onPick }: { options: { v: string; label: string }[]; on: (v: string) => boolean; onPick: (v: string) => void }) {
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      {options.map((o) => (
        <Chip key={o.v} label={o.label} onClick={() => onPick(o.v)} variant={on(o.v) ? "filled" : "outlined"} color={on(o.v) ? "primary" : "default"}
          sx={{ fontWeight: 600, fontSize: "0.8rem", borderRadius: "10px" }} />
      ))}
    </Box>
  );
}

function OtdPeriod({ f }: { f: Frame }) {
  const cy = Number(f.max.slice(0, 4)), cm = Number(f.max.slice(5, 7)) - 1;
  const qs = quartersOf(Number(f.from.slice(0, 4)), Number(f.from.slice(0, 4)) === cy ? cm : 11, Number(f.from.slice(0, 4)) === cy);
  const y = Number(f.from.slice(0, 4));
  const ym = (yy: number, m: number) => `${yy}-${String(m + 1).padStart(2, "0")}`;
  const last12 = ymAdd(f.max, -11) < f.min ? f.min : ymAdd(f.max, -11);
  const isOn = (id: string) => {
    if (id === "cy") return f.from === `${cy}-01` && f.to === f.max;
    if (id === "py") return f.from === `${cy - 1}-01` && f.to === `${cy - 1}-12`;
    if (id === "12") return f.from === last12 && f.to === f.max;
    const q = qs.find((x) => x.id === id);
    return !!q && f.from === ym(y, q.from) && f.to === ym(y, q.to);
  };
  const set = (a: string, b: string) => setQuery((q) => { q.set("from", a); q.set("to", b); });
  const onChoice = (id: string) => {
    if (id === "cy") return set(`${cy}-01`, f.max);
    if (id === "py") return set(`${cy - 1}-01`, `${cy - 1}-12`);
    if (id === "12") return set(last12, f.max);
    const q = qs.find((x) => x.id === id);
    if (q) set(ym(y, q.from), ym(y, q.to));
  };
  return (
    <PeriodPicker quick={[{ id: "cy", label: `Year to date ${cy}` }, { id: "py", label: String(cy - 1) }, { id: "12", label: "Last 12 months" }]} quarters={qs} isOn={isOn} onChoice={onChoice}
      unit="month" min={f.min} max={f.max} from={f.from} to={f.to} onRange={(a, b) => set(a, b)}
      note={<>Any months from {ymLabel(f.min)} - the OTD analysis file&apos;s months first, the ERP&apos;s morning lines from November 2025.</>} />
  );
}

function FilterWindow({ f, open, onClose }: { f: Frame; open: boolean; onClose: () => void }) {
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => !shut[k];
  const flip = (k: string) => setShut((x) => ({ ...x, [k]: !x[k] }));
  const pcs = useMemo(() => [...new Set(Object.keys(f.axis.slices).map((x) => x.split("|")[4]))].filter(Boolean).sort(), [f.axis]);
  const src = f.params.get("src") ?? "e";
  return (
    <FilterPanel id="otd-filters" open={open} onClose={onClose} subtitle="The period, the month each line counts in, and which lines" onClearAll={clearAll}>
      <FilterSection id="otdf-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => flip("period")} summary={periodOf(f)}>
        <OtdPeriod f={f} />
      </FilterSection>
      <FilterSection id="otdf-axis" index={1} title="Month counted by" icon={<AltRouteIcon />} tint="purple" open={isOpen("axis")} onFlip={() => flip("axis")} summary={f.axisKey === "promised" ? "First confirmed date" : "Delivered"} chosen={f.axisKey === "delivered"}>
        <Toggles options={[{ v: "promised", label: "The first confirmed date (Back Office KPI)" }, { v: "delivered", label: "The day delivered (the OTD file)" }]} on={(v) => v === f.axisKey} onPick={(v) => setParam("axis", v === "promised" ? null : v)} />
      </FilterSection>
      <FilterSection id="otdf-src" index={2} title="Order source" icon={<ShoppingCartOutlinedIcon />} tint="green" open={isOpen("src")} onFlip={() => flip("src")} summary={src === "all" ? "Every source" : SRC_LABEL[src]} chosen={src !== "e"}>
        <Toggles options={[{ v: "e", label: "eShop" }, { v: "m", label: "Typed in by the Back Office" }, { v: "all", label: "Every source" }]} on={(v) => v === src} onPick={(v) => setParam("src", v === "e" ? null : v)} />
      </FilterSection>
      <FilterSection id="otdf-mandant" index={3} title="Mandant" icon={<PublicOutlinedIcon />} tint="blue" open={isOpen("mandant")} onFlip={() => flip("mandant")} summary={f.filter.company?.length ? f.filter.company.join(", ") : "Both"} chosen={!!f.filter.company?.length}>
        <Toggles options={["100", "110"].map((v) => ({ v, label: MANDANT_LABEL[v] }))} on={(v) => !!f.filter.company?.includes(v)} onPick={(v) => toggleParam("mandant", v)} />
      </FilterSection>
      <FilterSection id="otdf-st" index={4} title="Article type" icon={<VerifiedOutlinedIcon />} tint="amber" open={isOpen("st")} onFlip={() => flip("st")} summary={f.filter.st?.length ? f.filter.st.map((x) => ST_LABEL[x]).join(", ") : "All"} chosen={!!f.filter.st?.length}>
        <Toggles options={["S", "P"].map((v) => ({ v, label: ST_LABEL[v] }))} on={(v) => !!f.filter.st?.includes(v)} onPick={(v) => toggleParam("st", v)} />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1 }}>The OTD analysis file does not say - its months drop out once a type is chosen.</Typography>
      </FilterSection>
      <FilterSection id="otdf-pc" index={5} title="Profit centre" icon={<ApartmentOutlinedIcon />} tint="slate" open={isOpen("pc")} onFlip={() => flip("pc")} summary={f.filter.pc?.length ? f.filter.pc.join(", ") : "All"} chosen={!!f.filter.pc?.length}>
        <Toggles options={pcs.map((v) => ({ v, label: v }))} on={(v) => !!f.filter.pc?.includes(v)} onPick={(v) => toggleParam("pc", v)} />
      </FilterSection>
    </FilterPanel>
  );
}

function TabCard({ slug, f }: { slug: OtdSlug; f: Frame }) {
  const params = useSearchParams();
  const tabs = TABS[slug];
  const asked = params.get("tab");
  const [tab, setTabState] = useState(tabs.some((x) => x.id === asked) ? asked! : tabs[0].id);
  const setTab = (id: string) => { setTabState(id); setQuery((q) => { if (id === tabs[0].id) q.delete("tab"); else q.set("tab", id); }); };
  const [panel, setPanel] = useState(false);
  const t = tabs.find((x) => x.id === tab) ?? tabs[0];
  const src = f.params.get("src") ?? "e";
  const ownPeriod = !(f.from === `${f.max.slice(0, 4)}-01` && f.to === f.max);
  const items: ActiveItem[] = [
    ...(ownPeriod ? [{ key: "period", name: "Period", value: periodOf(f), tint: "blue" as Tint, onRemove: () => setQuery((q) => { q.delete("from"); q.delete("to"); }) }] : []),
    ...(f.axisKey === "delivered" ? [{ key: "axis", name: "Month counted by", value: "the day delivered", tint: "purple" as Tint, onRemove: () => setParam("axis", null) }] : []),
    ...(src !== "e" ? [{ key: "src", name: "Order source", value: src === "all" ? "every source" : SRC_LABEL[src], tint: "green" as Tint, onRemove: () => setParam("src", null) }] : []),
    ...(f.filter.company ?? []).map((v) => ({ key: `m${v}`, name: "Mandant", value: MANDANT_LABEL[v], tint: "blue" as Tint, onRemove: () => toggleParam("mandant", v) })),
    ...(f.filter.st ?? []).map((v) => ({ key: `s${v}`, name: "Article type", value: ST_LABEL[v], tint: "amber" as Tint, onRemove: () => toggleParam("st", v) })),
    ...(f.filter.pc ?? []).map((v) => ({ key: `p${v}`, name: "Profit centre", value: v, tint: "slate" as Tint, onRemove: () => toggleParam("pc", v) })),
  ];
  const n = items.length;
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          {tabs.length > 1 && <ReportTabs name={`otd-${slug}`} tab={t.id} onSelect={setTab} tabs={tabs.map((x) => ({ id: x.id, label: x.label, count: null }))} />}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setPanel((x) => !x)} variant={panel || n ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="otd-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || n ? undefined : "#fff" }}>
          Filters{n ? ` · ${n}` : ""}
        </Button>
      </Box>
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearAll} items={items} />
      <GlassCard sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <CardTitle icon={t.icon} tint={t.tint} title={`${t.title}, ${periodOf(f)}`} note={t.note} />
        <Box sx={{ ...TWO, mt: -0.5 }}>
          {t.charts.map((id) => {
            const def = CHARTS.find((x) => x.id === id);
            return def ? (
              <Box key={id} sx={{ minWidth: 0, ...(def.wide ? { gridColumn: "1 / -1" } : {}) }}>
                {def.bare ? def.body(f) : <ChartBox title={def.title} hint={def.hint(f)}>{def.body(f)}</ChartBox>}
              </Box>
            ) : null;
          })}
        </Box>
      </GlassCard>
      <FilterWindow f={f} open={panel} onClose={() => setPanel(false)} />
    </>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

const SHELL = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;

function figs(f: Frame): Fig[] {
  const t = total(f), p = f.prev.length ? total(f, f.yms.map((ym) => ymAdd(ym, -12))) : null;
  const ot = onTimeShare(t), pot = p ? onTimeShare(p) : null;
  return [
    { label: "On time", value: pct(ot), ch: ot != null && pot != null ? changeOf(ot, pot) : undefined, sub: p ? "against a year before" : "", icon: <LocalShippingOutlinedIcon sx={{ fontSize: 14 }} />, tint: "green" },
    { label: "Late lines", value: int(t.late), sub: `of ${int(t.n)} lines`, icon: <WarningAmberOutlinedIcon sx={{ fontSize: 14 }} />, tint: "pink" },
    { label: "Days late, on average", value: days1(avg(t.days, t.late)), lower: true, ch: p && avg(p.days, p.late) && avg(t.days, t.late) != null ? changeOf(avg(t.days, t.late)!, avg(p.days, p.late)!) : undefined, sub: "the late lines", icon: <EventRepeatOutlinedIcon sx={{ fontSize: 14 }} />, tint: "amber" },
  ];
}

export function OtdPage({ slug }: { slug: OtdSlug }) {
  const { cube, err, again } = useOtd();
  const page = OTD_PAGES.find((p) => p.slug === slug)!;
  const head = <Typography component="h1" sx={H1}>{page.title}</Typography>;
  if (err && !cube) return <Box sx={SHELL}>{head}<UpstreamPanel source="OTD Reports" error={err.error} status={err.status} onRetry={again} /></Box>;
  if (cube === undefined) return <Box sx={SHELL}>{head}<LoadingPanel label="Reading the OTD figures…" /></Box>;
  if (cube === null) return (
    <Box sx={SHELL}>{head}
      <GlassCard><Typography sx={{ fontSize: "0.9rem", color: MUTED }}>Not counted yet: OTD Reports read the ERP&apos;s order lines of the morning workbook and the OTD analysis file&apos;s lines. The figures show after the next morning run.</Typography></GlassCard>
    </Box>
  );
  return <Loaded slug={slug} k={cube} />;
}

function Loaded({ slug, k }: { slug: OtdSlug; k: OtdCube }) {
  const f = useFrame(k);
  const page = OTD_PAGES.find((p) => p.slug === slug)!;
  const counted = new Date(k.at).toLocaleString("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const src = f.params.get("src") ?? "e";
  return (
    <Box sx={SHELL}>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) auto" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
          <Typography component="h1" sx={H1}>{page.title}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{src === "all" ? "Every order source" : SRC_LABEL[src]}</b> · {periodOf(f)}, {axisWords(f)} · the OTD analysis file&apos;s rule · counted {counted}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><FigureCards items={figs(f)} /></Box>
      </Box>
      <TabCard slug={slug} f={f} />
    </Box>
  );
}

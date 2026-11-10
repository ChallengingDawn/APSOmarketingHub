"use client";

// SEALING BUSINESS REVIEW - the Angst+Pfister hub's first report (SARCLA 10.11.2026), from the Executive Committee's pilot
// of the same name: who buys, what sells, which materials and compounds lead, which approvals are written - and the three
// commercial priorities, found in the figures. Every business unit's sealing (profit centre DT) invoices from the ERP's BI
// model, read each morning (src/lib/apHub).
//
// Laid out as the Advanced reports are (SARCLA 10.11.2026: "the layout should follow our advanced reports" - OTD Reports,
// src/app/reporting/otd/OtdReports.tsx): a page per question (src/lib/apHub/sealingPages.ts, listed in the side panel),
// the title and the figures top right, the Filters window - period, business unit, sales organisation - kept in the
// address, what the page is filtered by under it, then one card per view with its graphs two by two, graphs before tables.
// Margins are always the margin of the sums (sealingRules sumBy), never an average of margins.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TuneIcon from "@mui/icons-material/Tune";
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

import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartBox, FullTable, H1, TWO, setQuery, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { ActiveFilters, PeriodPicker, monthWords, quartersOf, type ActiveItem } from "@/app/reporting/eso-benchmark/EsoFilters";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { MonthTrend } from "@/app/reporting/eso-benchmark/TicketsCharts";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { FigureCards, MONTHS, changeOf, int, pct, points, rateCell, signedPct, tone, withChangeCell, type Fig } from "@/app/reporting/products/views/kit";
import { BarList } from "@/app/charts/BarList";
import { StackedColumns, type StackRow } from "@/app/charts/StackedColumns";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { compact } from "@/app/charts/format";
import type { SealingSlug } from "@/lib/apHub/sealingPages";
import type { SealingView } from "@/lib/apHub/sealingStore";
import { isMonth, materialOf, periodWords, type Figure, type Priority } from "@/lib/apHub/sealingRules";

/* ── words and numbers ─────────────────────────────────────────────────── */

const eur = (n: number | null) => (n == null || !Number.isFinite(n) ? "—" : `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`);
const eurTick = (n: number | null) => (n == null ? "" : `€${compact(n)}`);
const pct0 = (v: number | null) => (v == null ? "" : `${Math.round(v * 100)}%`);
const ymLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const ymAdd = (ym: string, n: number) => { const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const NOT_KNOWN = "Not known";
const NONE = (what = "No invoice in these months with these filters.") => <Typography sx={{ fontSize: "0.85rem", color: MUTED, py: 2 }}>{what}</Typography>;

const TITLE: Record<SealingSlug, string> = {
  overview: "Sealing Business Review",
  units: "Sealing per business unit",
  customers: "Sealing per customer",
  articles: "Sealing per article",
  materials: "Sealing per material and compound",
  approvals: "Sealing per approval",
};

/* ── the read ──────────────────────────────────────────────────────────── */

function useSealing(ask: string) {
  const [d, setD] = useState<SealingView | null>(null);
  const [err, setErr] = useState<{ error: string; status: number | null } | null>(null);
  const [busy, setBusy] = useState(true);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    setBusy(true);
    setErr(null);
    fetch(`/api/ap/sealing${ask ? `?${ask}` : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as SealingView & { ok?: boolean; error?: string };
        if (!live) return;
        if (!r.ok || !j.ok) setErr({ error: j.error ?? `HTTP ${r.status}`, status: r.ok ? null : r.status });
        else setD(j);
      })
      .catch((e) => { if (live) setErr({ error: String((e as Error)?.message ?? e), status: null }); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [ask, round]);
  return { d, err, busy, again: () => setRound((x) => x + 1) };
}

/* ── what the page shows: the period and the filters, all in the address ── */

type Frame = {
  d: SealingView;
  /** the months shown, and the months the figures hold */
  from: string; to: string; min: string; max: string;
  /** the first month of the year so far (the default period) */
  ytdFrom: string;
  now: string; before: string;
  /** whether the same months a year earlier are in the figures - all of them, some, none */
  prevKnown: "all" | "part" | "none";
  bus: string[]; orgs: string[];
};

function frameOf(d: SealingView, bus: string[], orgs: string[]): Frame {
  const max = d.meta.lastMonth ?? d.period.to;
  const min = d.meta.firstMonth && d.meta.firstMonth <= max ? d.meta.firstMonth : d.period.from;
  const ytd = `${max.slice(0, 4)}-01`;
  const known = d.months.filter((m) => m.prevRev !== null).length;
  return {
    d, from: d.period.from, to: d.period.to, min, max, ytdFrom: ytd < min ? min : ytd,
    now: periodWords(d.period.from, d.period.to), before: periodWords(d.period.prevFrom, d.period.prevTo),
    prevKnown: known && known === d.months.length ? "all" : known ? "part" : "none",
    bus, orgs,
  };
}
const ownPeriod = (f: Frame) => !(f.from === f.ytdFrom && f.to === f.max);
const hasBefore = (f: Frame) => f.prevKnown !== "none";

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
const changeNote = (r: Row) => (r.prev ? { text: signedPct(changeOf(r.rev, r.prev)), color: tone(changeOf(r.rev, r.prev)) } : r.rev > 0 ? { text: "new", color: GREEN } : null);

/* ── the graphs and the tables ─────────────────────────────────────────── */

/** A graph's place in the grid - the whole width when wide. */
const Tile = ({ wide = false, children }: { wide?: boolean; children: React.ReactNode }) => (
  <Box sx={{ minWidth: 0, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>{children}</Box>
);

/** Net revenue per row, against the same months a year earlier (DimChart: a page at a time, the largest first). */
function RevenueBars({ f, title, rows, labelWidth, single = false }: { f: Frame; title: string; rows: Row[]; labelWidth?: number; single?: boolean }) {
  if (!rows.length) return <ChartBox title={title}>{NONE()}</ChartBox>;
  const two = !single && hasBefore(f);
  return (
    <DimChart title={title} rows={rows} cur={(r) => r.rev} prev={(r) => r.prev} curLabel={f.now} prevLabel={f.before} fmt={eur}
      single={!two} curNote={two ? changeNote : undefined} labelWidth={labelWidth} pickHint="" />
  );
}

/** The gross margin of the largest rows, in their order. */
function MarginBars({ title, rows, n = 15, labelWidth = 200 }: { title: string; rows: Row[]; n?: number; labelWidth?: number }) {
  const top = rows.slice(0, n);
  const hint = rows.length > n ? `gross profit over net revenue · the ${n} with the most net revenue, largest first` : "gross profit over net revenue · largest first";
  return (
    <ChartBox title={title} hint={hint}>
      <BarList rows={top.map((r) => ({ label: r.label, value: r.margin, secondary: `${eur(r.rev)} net revenue · ${eur(r.gp)} gross profit` }))}
        format={pct} labelWidth={labelWidth} emptyMessage="No invoice in these months with these filters." />
    </ChartBox>
  );
}

/** All the figures of a breakdown - any column sorts. */
function FigureTable({ f, title, first, rows, find, extra = [], total = null, withPrev = true }: {
  f: Frame; title: string; first: string; rows: Row[]; find?: string; extra?: Col<Row>[]; total?: Row | null; withPrev?: boolean;
}) {
  const all = f.d.totals.rev;
  const two = withPrev && hasBefore(f);
  const cols: Col<Row>[] = [
    ...extra,
    { key: "rev", head: `Net revenue ${f.now}`, tip: two ? `Under it the change against ${f.before}` : undefined, cell: (r) => (two ? withChangeCell(eur(r.rev), r.rev, r.prev) : eur(r.rev)), sort: (r) => r.rev },
    ...(two ? [{ key: "prev", head: `Net revenue ${f.before}`, cell: (r: Row) => eur(r.prev), sort: (r: Row) => r.prev }] : []),
    { key: "gp", head: "Gross profit", cell: (r) => eur(r.gp), sort: (r) => r.gp },
    {
      key: "margin", head: "Gross margin", tip: `Gross profit over net revenue of the same invoices${two ? ` - under it the change in points against ${f.before}` : ""}`,
      cell: (r) => (two ? rateCell(r.margin, prevMargin(r)) : pct(r.margin)), sort: (r) => r.margin,
    },
    { key: "share", head: "Share of net revenue", tip: `This row's part of all the net revenue, ${f.now}`, cell: (r) => (all > 0 ? pct(r.rev / all) : "—"), sort: (r) => r.rev },
  ];
  return (
    <ChartBox title={title} hint={rows.length ? `${f.now} · click a column to sort by it` : undefined}>
      {rows.length ? <FullTable first={first} cols={cols} rows={rows} total={total} initial="rev" find={find} /> : NONE()}
    </ChartBox>
  );
}

/* ── the overview: the priorities, then the headline graphs ────────────── */

const KIND_NAME: Record<Priority["kind"], string> = { margin: "Margin improvement", growth: "Growth focus", spread: "Account comparison" };

function PriorityCard({ p, i }: { p: Priority; i: number }) {
  return (
    <Box sx={{ border: "1px solid rgba(21,34,58,.08)", borderRadius: "16px", p: 2, bgcolor: "rgba(255,255,255,.7)", display: "grid", gap: 1, alignContent: "start" }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
        {String(i + 1).padStart(2, "0")} / {KIND_NAME[p.kind]}
      </Typography>
      <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, letterSpacing: "-0.015em" }}>{p.title}</Typography>
      <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.5 }}>{p.evidence}</Typography>
      <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.5 }}><b>Next move.</b> {p.next}</Typography>
      <Typography sx={{ fontSize: "0.8rem", color: FAINT, mt: 0.5 }}>
        {p.effect ? `${p.effectLabel}: ${eur(p.effect)} gross profit` : p.effectLabel}
      </Typography>
    </Box>
  );
}

function Priorities({ f }: { f: Frame }) {
  const ps = f.d.priorities;
  if (!ps.length) return NONE("Nothing in these months with these filters meets the thresholds.");
  return (
    <Box sx={{ display: "grid", gap: 1.5, mt: -0.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: `repeat(${ps.length}, minmax(0, 1fr))` } }}>
      {ps.map((p, i) => <PriorityCard key={p.kind} p={p} i={i} />)}
    </Box>
  );
}

function Headline({ f }: { f: Frame }) {
  const ms = f.d.months, labels = ms.map((m) => ymLabel(m.month)), two = hasBefore(f);
  const grey = two ? " · the same months a year earlier in grey" : "";
  return (
    <Box sx={{ ...TWO, mt: -0.5 }}>
      <Tile wide>
        <ChartBox title="Net revenue, month by month" hint={`the invoices of each month${grey}`}>
          <MonthTrend values={ms.map((m) => m.rev)} compare={two ? ms.map((m) => m.prevRev) : null} labels={labels} label="Net revenue" compareLabel="A year earlier" fmt={eur} tick={eurTick} height={260} />
        </ChartBox>
      </Tile>
      <Tile>
        <ChartBox title="Gross margin, month by month" hint={`gross profit over net revenue of each month's invoices${grey}`}>
          <MonthTrend values={ms.map((m) => (m.rev ? m.gp / m.rev : null))} compare={two ? ms.map((m) => (m.prevRev ? (m.prevGp ?? 0) / m.prevRev : null)) : null}
            labels={labels} label="Gross margin" compareLabel="A year earlier" fmt={pct} tick={pct0} />
        </ChartBox>
      </Tile>
      <Tile>
        <ChartBox title="Gross profit, month by month" hint={`net revenue less the cost of the goods${grey}`}>
          <MonthTrend values={ms.map((m) => m.gp)} compare={two ? ms.map((m) => m.prevGp) : null} labels={labels} label="Gross profit" compareLabel="A year earlier" fmt={eur} tick={eurTick} />
        </ChartBox>
      </Tile>
      <Tile><RevenueBars f={f} title="Net revenue by business unit" rows={rowsOf(f.d.byBu)} labelWidth={120} /></Tile>
      <Tile><RevenueBars f={f} title="Net revenue by material family" rows={rowsOf(f.d.byFamily)} labelWidth={120} /></Tile>
    </Box>
  );
}

/* ── the business units ────────────────────────────────────────────────── */

/** Each month's net revenue by business unit - the three largest, the others in grey. */
function UnitMonths({ f }: { f: Frame }) {
  const top = f.d.byBu.slice(0, 3).map((b) => b.key);
  const rest = f.d.byBu.length > 3;
  const data: StackRow[] = f.d.months.map(({ month }) => {
    const of = f.d.buMonths.filter((x) => x.month === month);
    const row: StackRow = { x: ymLabel(month) };
    top.forEach((b, j) => { row[`b${j}`] = of.filter((x) => x.bu === b).reduce((a, x) => a + x.rev, 0); });
    if (rest) row.rest = of.filter((x) => !top.includes(x.bu)).reduce((a, x) => a + x.rev, 0);
    return row;
  });
  if (!top.length) return NONE();
  const parts = [...top.map((b, j) => ({ key: `b${j}`, label: b || NOT_KNOWN, color: SERIES[j] })), ...(rest ? [{ key: "rest", label: "All the others", color: DEEMPHASIS }] : [])];
  return <StackedColumns data={data} parts={parts} format={eur} tickFormat={eurTick} xFormat={(x) => x} height={260} />;
}

function Units({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.byBu);
  return (
    <Box sx={{ ...TWO, mt: -0.5 }}>
      <Tile><RevenueBars f={f} title="Net revenue by business unit" rows={rows} labelWidth={120} /></Tile>
      <Tile><MarginBars title="Gross margin by business unit" rows={rows} n={50} labelWidth={120} /></Tile>
      <Tile wide>
        <ChartBox title="Net revenue month by month, by business unit" hint={`the three units with the most net revenue${f.d.byBu.length > 3 ? ", all the others in grey" : ""}`}>
          <UnitMonths f={f} />
        </ChartBox>
      </Tile>
      <Tile wide><FigureTable f={f} title="All the figures, by business unit" first="Business unit" rows={rows} total={rows.length > 1 ? totalOf(rows, "All business units") : null} /></Tile>
    </Box>
  );
}

/* ── the customers and the articles ────────────────────────────────────── */

function Customers({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.customers);
  return (
    <Box sx={{ ...TWO, mt: -0.5 }}>
      <Tile><RevenueBars f={f} title="Net revenue by customer" rows={rows} labelWidth={220} /></Tile>
      <Tile><MarginBars title="Gross margin by customer" rows={rows} /></Tile>
      <Tile wide>
        <FigureTable f={f} title="All the figures, by customer" first="Customer" rows={rows} find="a customer"
          extra={[{ key: "number", head: "Customer number", cell: (r) => r.key || "—" }]} />
      </Tile>
    </Box>
  );
}

function Articles({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.articles);
  return (
    <Box sx={{ ...TWO, mt: -0.5 }}>
      <Tile><RevenueBars f={f} title="Net revenue by article" rows={rows} labelWidth={220} /></Tile>
      <Tile><MarginBars title="Gross margin by article" rows={rows} /></Tile>
      <Tile wide>
        <FigureTable f={f} title="All the figures, by article" first="Article" rows={rows} find="an article" extra={[
          { key: "number", head: "Article number", cell: (r) => r.key || "—" },
          { key: "compound", head: "Compound", cell: (r) => r.compound || "—" },
        ]} />
      </Tile>
    </Box>
  );
}

/* ── the materials: the pilot's families, then the compounds ───────────── */

function Families({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.byFamily);
  return (
    <Box sx={{ ...TWO, mt: -0.5 }}>
      <Tile><RevenueBars f={f} title="Net revenue by material family" rows={rows} labelWidth={120} /></Tile>
      <Tile><MarginBars title="Gross margin by material family" rows={rows} n={50} labelWidth={120} /></Tile>
      <Tile wide><FigureTable f={f} title="All the figures, by material family" first="Material family" rows={rows} total={rows.length > 1 ? totalOf(rows, "All named compounds") : null} /></Tile>
    </Box>
  );
}

function Compounds({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.compounds);
  return (
    <Box sx={{ ...TWO, mt: -0.5 }}>
      <Tile><RevenueBars f={f} title="Net revenue by compound" rows={rows} labelWidth={200} /></Tile>
      <Tile><MarginBars title="Gross margin by compound" rows={rows} /></Tile>
      <Tile wide>
        <FigureTable f={f} title="All the figures, by compound" first="Compound" rows={rows} find="a compound" total={rows.length > 1 ? totalOf(rows, "All named compounds") : null}
          extra={[{ key: "family", head: "Material family", cell: (r) => materialOf(r.key) }]} />
      </Tile>
    </Box>
  );
}

/* ── the approvals ─────────────────────────────────────────────────────── */

function Approvals({ f }: { f: Frame }) {
  const rows = rowsOf(f.d.approvals);
  const s = f.d.noApprovalShare, all = f.d.totals.rev;
  return (
    <Box sx={{ ...TWO, mt: -0.5 }}>
      <Tile>
        <ChartBox title="With and without an approval written" hint={`the share of the net revenue, ${f.now}`}>
          {all ? (
            <BarList rows={[
              { label: "An approval written", value: 1 - s, secondary: `${eur(all * (1 - s))} net revenue` },
              { label: "No approval written", value: s, secondary: `${eur(all * s)} net revenue` },
            ]} format={pct} labelWidth={170} max={1} />
          ) : NONE()}
        </ChartBox>
      </Tile>
      <Tile><MarginBars title="Gross margin by approval" rows={rows} labelWidth={220} /></Tile>
      <Tile wide><RevenueBars f={f} title="Net revenue by the approval written" rows={rows} labelWidth={260} single /></Tile>
      <Tile wide><FigureTable f={f} title="All the figures, by approval" first="Approval as written" rows={rows} find="an approval" withPrev={false} /></Tile>
    </Box>
  );
}

/* ── a page: its views, each one or more cards ────────────────────────── */

type CardDef = { id: string; title: string; note: (f: Frame) => string; icon: React.ReactNode; tint: Tint; Body: (p: { f: Frame }) => React.ReactNode };
type ViewDef = { id: string; label: string; count?: (f: Frame) => string; cards: CardDef[] };

const against = (f: Frame) => (f.prevKnown === "all" ? `against ${f.before}` : f.prevKnown === "part" ? `against ${f.before} - the figures begin ${monthWords(f.min)}` : "no figures a year earlier");

const VIEWS: Record<SealingSlug, ViewDef[]> = {
  overview: [{
    id: "overview", label: "Overview", cards: [
      { id: "priorities", title: "Commercial priorities", note: (f) => `Found in the figures of ${f.now} - evidence, then a next move. Validate before acting.`, icon: <LightbulbOutlinedIcon />, tint: "amber", Body: Priorities },
      { id: "headline", title: "Net revenue and margin", note: (f) => `Month by month, by business unit and by material family · ${against(f)}`, icon: <ShowChartOutlinedIcon />, tint: "blue", Body: Headline },
    ],
  }],
  units: [{
    id: "units", label: "Business units", cards: [
      { id: "units", title: "By business unit", note: (f) => `The Angst+Pfister company that invoiced · ${against(f)}`, icon: <ApartmentOutlinedIcon />, tint: "purple", Body: Units },
    ],
  }],
  customers: [{
    id: "customers", label: "Customers", cards: [
      { id: "customers", title: "By customer", note: (f) => `${int(f.d.totals.customers)} customers invoiced${f.d.customers.length < f.d.totals.customers ? ` · the ${int(f.d.customers.length)} with the most net revenue below` : ""} · ${against(f)}`, icon: <GroupsOutlinedIcon />, tint: "green", Body: Customers },
    ],
  }],
  articles: [{
    id: "articles", label: "Articles", cards: [
      { id: "articles", title: "By article", note: (f) => `${int(f.d.totals.articles)} articles invoiced${f.d.articles.length < f.d.totals.articles ? ` · the ${int(f.d.articles.length)} with the most net revenue below` : ""}, each with its compound · ${against(f)}`, icon: <InventoryOutlinedIcon />, tint: "amber", Body: Articles },
    ],
  }],
  materials: [
    {
      id: "families", label: "Material families", count: (f) => String(f.d.byFamily.length), cards: [
        { id: "families", title: "By material family", note: (f) => `Named compounds only - ${pct(f.d.noCompoundShare)} of the net revenue names none. The family follows the pilot's rule (FFKM, HNBR, FKM, EPDM, NBR, VMQ, PTFE) · ${against(f)}`, icon: <CategoryOutlinedIcon />, tint: "blue", Body: Families },
      ],
    },
    {
      id: "compounds", label: "Compounds", count: (f) => String(f.d.compounds.length), cards: [
        { id: "compounds", title: "By compound", note: (f) => `Named compounds only - ${pct(f.d.noCompoundShare)} of the net revenue names none · each with its material family · ${against(f)}`, icon: <ScienceOutlinedIcon />, tint: "purple", Body: Compounds },
      ],
    },
  ],
  approvals: [{
    id: "approvals", label: "Approvals", cards: [
      { id: "approvals", title: "The approvals written on the articles", note: (f) => `Which approvals matter? ${pct(f.d.noApprovalShare)} of the net revenue has no approval written on the article. A text can name several approvals, and the figures cannot tell which approval caused a sale.`, icon: <VerifiedOutlinedIcon />, tint: "slate", Body: Approvals },
    ],
  }],
};

/* ── the filters ───────────────────────────────────────────────────────── */

const toggleParam = (key: string, v: string) => setQuery((q) => { const all = q.getAll(key); q.delete(key); for (const x of all.includes(v) ? all.filter((y) => y !== v) : [...all, v]) q.append(key, x); });
const clearAll = () => setQuery((q) => { for (const k of ["from", "to", "bu", "org"]) q.delete(k); });

function Toggles({ options, on, onPick }: { options: { v: string; label: string }[]; on: (v: string) => boolean; onPick: (v: string) => void }) {
  if (!options.length) return <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>None in the figures yet.</Typography>;
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      {options.map((o) => (
        <Chip key={o.v} label={o.label} onClick={() => onPick(o.v)} variant={on(o.v) ? "filled" : "outlined"} color={on(o.v) ? "primary" : "default"}
          sx={{ fontWeight: 600, fontSize: "0.8rem", borderRadius: "10px", maxWidth: "100%" }} />
      ))}
    </Box>
  );
}

function SealingPeriod({ f }: { f: Frame }) {
  const cy = Number(f.max.slice(0, 4)), cm = Number(f.max.slice(5, 7)) - 1;
  const y = Number(f.from.slice(0, 4));
  const ym = (yy: number, m: number) => `${yy}-${String(m + 1).padStart(2, "0")}`;
  const atLeast = (x: string) => (x < f.min ? f.min : x);
  // each pick's months, kept within those the figures hold
  const qs = quartersOf(y, y === cy ? cm : 11, y === cy).map((q) => (ym(y, q.to) < f.min ? { ...q, disabled: true, title: "Before the first month in the figures" } : q));
  const span: Record<string, [string, string]> = { cy: [f.ytdFrom, f.max], py: [atLeast(`${cy - 1}-01`), `${cy - 1}-12`], "12": [atLeast(ymAdd(f.max, -11)), f.max] };
  for (const q of qs) span[q.id] = [atLeast(ym(y, q.from)), ym(y, q.to)];
  const isOn = (id: string) => !!span[id] && f.from === span[id][0] && f.to === span[id][1];
  const set = (a: string, b: string) => setQuery((q) => {
    if (a === f.ytdFrom && b === f.max) { q.delete("from"); q.delete("to"); } else { q.set("from", a); q.set("to", b); }
  });
  const onChoice = (id: string) => { const s = span[id]; if (s) set(s[0], s[1]); };
  const pyIn = `${cy - 1}-12` >= f.min;
  return (
    <PeriodPicker
      quick={[{ id: "cy", label: `Year to date ${cy}` }, { id: "py", label: String(cy - 1), disabled: !pyIn, title: pyIn ? undefined : "Before the first month in the figures" }, { id: "12", label: "Last 12 months" }]}
      quarters={qs} isOn={isOn} onChoice={onChoice} unit="month" min={f.min} max={f.max} from={f.from} to={f.to} onRange={(a, b) => set(a, b)}
      note={<>Any months from {monthWords(f.min)} to {monthWords(f.max)} - every figure against the same months a year earlier.</>} />
  );
}

function FilterWindow({ f, open, onClose }: { f: Frame; open: boolean; onClose: () => void }) {
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => !shut[k];
  const flip = (k: string) => setShut((x) => ({ ...x, [k]: !x[k] }));
  // a value chosen stays to pick off, even when the figures no longer carry it
  const withChosen = (all: string[], chosen: string[]) => [...all, ...chosen.filter((x) => !all.includes(x))];
  return (
    <FilterPanel id="sealing-filters" open={open} onClose={onClose} subtitle="The months, the business units and the sales organisations" onClearAll={clearAll}>
      <FilterSection id="sealf-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => flip("period")} summary={f.now} chosen={ownPeriod(f)}>
        <SealingPeriod f={f} />
      </FilterSection>
      <FilterSection id="sealf-bu" index={1} title="Business unit" icon={<ApartmentOutlinedIcon />} tint="purple" open={isOpen("bu")} onFlip={() => flip("bu")}
        summary={f.bus.length ? f.bus.join(", ") : "All"} chosen={f.bus.length > 0}>
        <Toggles options={withChosen(f.d.meta.bus, f.bus).map((v) => ({ v, label: v }))} on={(v) => f.bus.includes(v)} onPick={(v) => toggleParam("bu", v)} />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1 }}>The Angst+Pfister company that invoiced. None chosen: all of them.</Typography>
      </FilterSection>
      <FilterSection id="sealf-org" index={2} title="Sales organisation" icon={<StorefrontOutlinedIcon />} tint="green" open={isOpen("org")} onFlip={() => flip("org")}
        summary={f.orgs.length ? (f.orgs.length === 1 ? f.orgs[0] : `${f.orgs.length} chosen`) : "All"} chosen={f.orgs.length > 0}>
        <Toggles options={withChosen(f.d.meta.channels, f.orgs).map((v) => ({ v, label: v }))} on={(v) => f.orgs.includes(v)} onPick={(v) => toggleParam("org", v)} />
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1 }}>The organisation that sold to the customer. None chosen: all of them.</Typography>
      </FilterSection>
    </FilterPanel>
  );
}

/* ── the figures top right: one unit each ──────────────────────────────── */

function figs(f: Frame): Fig[] {
  const t = f.d.totals, p = t.prev, two = hasBefore(f);
  const icon = (I: typeof EuroOutlinedIcon) => <I sx={{ fontSize: 14 }} />;
  const none = "no figures a year earlier";
  return [
    { label: "Net revenue", value: eur(t.rev), ch: two ? changeOf(t.rev, p.rev) : undefined, sub: two ? `${eur(p.rev)} in ${f.before}` : none, icon: icon(EuroOutlinedIcon), tint: "green" },
    { label: "Gross margin", value: pct(t.margin), sub: two && p.rev ? `${points(t.margin, p.margin)} · ${pct(p.margin)} in ${f.before}` : two ? none : "gross profit over net revenue", icon: icon(PercentOutlinedIcon), tint: "blue" },
    { label: "Gross profit", value: eur(t.gp), ch: two ? changeOf(t.gp, p.gp) : undefined, sub: two ? `${eur(p.gp)} in ${f.before}` : none, icon: icon(SavingsOutlinedIcon), tint: "purple" },
    { label: "Customers", value: int(t.customers), ch: two ? changeOf(t.customers, p.customers) : undefined, sub: two ? `${int(p.customers)} in ${f.before}` : none, icon: icon(GroupsOutlinedIcon), tint: "slate" },
  ];
}

/* ── the page ──────────────────────────────────────────────────────────── */

const SHELL = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;

/** Where the figures come from - small, at the foot. */
function footWords(f: Frame, slug: SealingSlug): string {
  const m = f.d.meta;
  const file = m.file ? m.file.split(/[\\/]/).pop() : null;
  const from = [file, m.sheet ? `sheet "${m.sheet}"` : null].filter(Boolean).join(", ");
  const read = m.loadedAt ? new Date(m.loadedAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  return [
    `Source: the ERP's BI model - every business unit's sealing invoices (profit centre DT), net revenue and gross profit in EUR`,
    from ? `read from ${from}` : null,
    read ? `loaded ${read}` : null,
    `invoices from ${monthWords(f.min)} up to ${monthWords(f.max)}`,
  ].filter(Boolean).join(" · ")
    + ". Gross margin = gross profit over net revenue of the same invoices, never an average of margins."
    + (slug === "overview" ? " The priorities are illustrative, never a forecast." : "");
}

export function SealingPage({ slug }: { slug: SealingSlug }) {
  const params = useSearchParams();
  const qs = params.toString();
  const { bus, orgs, ask } = useMemo(() => {
    const p = new URLSearchParams(qs);
    const q = new URLSearchParams();
    const from = p.get("from"), to = p.get("to");
    if (isMonth(from)) q.set("from", from);
    if (isMonth(to)) q.set("to", to);
    const b = [...new Set(p.getAll("bu").filter(Boolean))], o = [...new Set(p.getAll("org").filter(Boolean))];
    for (const x of b) q.append("bu", x);
    for (const x of o) q.append("channel", x);
    return { bus: b, orgs: o, ask: q.toString() };
  }, [qs]);
  const { d, err, busy, again } = useSealing(ask);
  const head = <Typography component="h1" sx={H1}>{TITLE[slug]}</Typography>;
  if (err && !d) return <Box sx={SHELL}>{head}<UpstreamPanel source="The sealing figures" error={err.error} status={err.status} onRetry={again} /></Box>;
  if (!d) return <Box sx={SHELL}>{head}<LoadingPanel label="Reading the sealing figures…" /></Box>;
  if (!d.meta.rows) return (
    <Box sx={SHELL}>{head}
      <GlassCard>
        <Typography sx={{ fontSize: "0.9rem", color: MUTED, lineHeight: 1.55 }}>
          No figures yet. They arrive with the morning ERP delivery that carries the sealing sheet, and this page fills the same morning.
        </Typography>
      </GlassCard>
    </Box>
  );
  return <Loaded slug={slug} f={frameOf(d, bus, orgs)} busy={busy} err={err?.error ?? null} again={again} />;
}

function Loaded({ slug, f, busy, err, again }: { slug: SealingSlug; f: Frame; busy: boolean; err: string | null; again: () => void }) {
  const params = useSearchParams();
  const views = VIEWS[slug];
  const asked = params.get("tab");
  const [tab, setTabState] = useState(views.some((x) => x.id === asked) ? asked! : views[0].id);
  const setTab = (id: string) => { setTabState(id); setQuery((q) => { if (id === views[0].id) q.delete("tab"); else q.set("tab", id); }); };
  const [panel, setPanel] = useState(false);
  const v = views.find((x) => x.id === tab) ?? views[0];
  const items: ActiveItem[] = [
    ...(ownPeriod(f) ? [{ key: "period", name: "Period", value: f.now, tint: "blue" as Tint, onRemove: () => setQuery((q) => { q.delete("from"); q.delete("to"); }) }] : []),
    ...f.bus.map((x) => ({ key: `bu:${x}`, name: "Business unit", value: x, tint: "purple" as Tint, onRemove: () => toggleParam("bu", x) })),
    ...f.orgs.map((x) => ({ key: `org:${x}`, name: "Sales organisation", value: x, tint: "green" as Tint, onRemove: () => toggleParam("org", x) })),
  ];
  const n = items.length;
  const scope = f.bus.length ? f.bus.join(", ") : "Every business unit";
  const orgWords = f.orgs.length === 1 ? f.orgs[0] : f.orgs.length ? `${f.orgs.length} sales organisations` : null;
  return (
    <Box sx={SHELL}>
      {/* the title and what is shown on the left; the figures top right */}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) auto" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
          <Typography component="h1" sx={H1}>{TITLE[slug]}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{scope}</b>{orgWords ? <> · <b style={{ color: INK }}>{orgWords}</b></> : null} · sealing invoices (profit centre DT) · {f.now}, {against(f)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }}><FigureCards items={figs(f)} /></Box>
      </Box>
      {/* the views (where a page has more than one), and at the right end the Filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          {views.length > 1 && <ReportTabs name={`sealing-${slug}`} tab={v.id} onSelect={setTab} tabs={views.map((x) => ({ id: x.id, label: x.label, count: x.count?.(f) ?? null }))} />}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setPanel((x) => !x)} variant={panel || n ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="sealing-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || n ? undefined : "#fff" }}>
          Filters{n ? ` · ${n}` : ""}
        </Button>
      </Box>
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearAll} items={items} />
      {err && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.84rem", color: RED }}>These filters could not be read: {err}</Typography>
          <Button size="small" onClick={again} sx={{ textTransform: "none", fontWeight: 700 }}>Try again</Button>
        </Box>
      )}
      <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, opacity: busy ? 0.55 : 1, transition: "opacity .15s ease" }} aria-busy={busy}>
        {v.cards.map((c) => (
          <GlassCard key={c.id} sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
            <CardTitle icon={c.icon} tint={c.tint} title={`${c.title}, ${f.now}`} note={c.note(f)} />
            <c.Body f={f} />
          </GlassCard>
        ))}
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT, lineHeight: 1.5 }}>{footWords(f, slug)}</Typography>
      <FilterWindow f={f} open={panel} onClose={() => setPanel(false)} />
    </Box>
  );
}

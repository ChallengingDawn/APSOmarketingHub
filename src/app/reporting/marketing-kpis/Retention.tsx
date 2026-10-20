"use client";
// RETAIN & GROW - SARCLA'S RETENTION WORKBOOK, LIVE AND IN GRAPHS (SARCLA 20.10.2026: "2 · Retention Trend with
// other graphs - this applies to every tab; 3 · Cohorts & First-Order; 4 · Why They Leave, a diagram to see it;
// 5 · Tickets + 6 · Activities + 9 · Marketing Reach together to create a path; 7 · Personas - please think in
// graph format, and vary"). A chart of another kind on every card:
//   Retention trend   stacked columns (kept / won back / new) under the retention line; the bridge from the base
//                     year to the next; the revenue of the customers lost, as an area
//   Cohorts           a heat map of each first-order year; bought only once, as lines over the cohorts' size;
//                     year one to year two - customers lost against revenue lost
//   Why they leave    the flow from the base year's customers through their orders and profit centres to back or
//                     not; each lever left or right of the average
//   The path          the flow through sales touch, marketing reach and tickets to back or not; the owners as
//                     bubbles (book reached against churn); each group against the average line
//   Personas          the customers as tiles, sized by how many, coloured by churn; segment against priority
// The rules are in retentionCube.ts, the read in retention.ts. The figures in full (SARCLA: no abbreviations).

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import SwapVertOutlinedIcon from "@mui/icons-material/SwapVertOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import GridOnOutlinedIcon from "@mui/icons-material/GridOnOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import AlignHorizontalCenterOutlinedIcon from "@mui/icons-material/AlignHorizontalCenterOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import BubbleChartOutlinedIcon from "@mui/icons-material/BubbleChartOutlined";
import FormatListBulletedOutlinedIcon from "@mui/icons-material/FormatListBulletedOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, Treemap, XAxis, YAxis, ZAxis,
} from "recharts";

import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { Sankey } from "@/app/charts/Sankey";
import { PRIOS, type Flow, type GroupRow, type RetentionView } from "@/lib/marketingKpis/retentionCube";
import { n0 } from "./ExplorerKit";

const eur = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `€${Math.round(n).toLocaleString("en")}`);
const pct = (n: number | null | undefined, d = 0) => (n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(d)}%`);
const pts = (n: number | null | undefined) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)} pts`);
const BLUE = SERIES[0], ORANGE = SERIES[1], GREENS = SERIES[2], AMBER = SERIES[3];
const TONE: Record<Flow["nodes"][number]["tone"], string> = { base: BLUE, good: GREENS, mid: AMBER, bad: ORANGE, none: DEEMPHASIS };
const tip = { contentStyle: { fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" } } as const;
/** churn 0 → green, the average → amber, twice the average or more → red */
function churnColour(c: number | null | undefined, avg: number): string {
  if (c == null) return "#e6e9ef";
  const t = Math.max(0, Math.min(1, (c - avg + 0.2) / 0.4));
  const mix = (a: number[], b: number[], k: number) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
  const g = [27, 175, 122], y = [237, 161, 0], r = [214, 69, 65];
  const [rr, gg, bb] = t < 0.5 ? mix(g, y, t * 2) : mix(y, r, (t - 0.5) * 2);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

/* ── the read, shared by the page and the nutshell ───────────────────────────── */

type Read = { v: RetentionView | null; computing: boolean; progress?: string; error?: string };
const shared: { r: Read; p: Promise<void> | null; subs: Set<() => void> } = { r: { v: null, computing: true }, p: null, subs: new Set() };
function load() {
  if (shared.p) return;
  shared.p = fetch("/api/reporting/marketing-kpis/retention").then((x) => x.json())
    .then((j) => {
      const v = j?.retention?.value as RetentionView | undefined;
      shared.r = { v: v ?? shared.r.v, computing: !!j?.retention?.computing || !v, progress: j?.retention?.progress, error: j?.error ?? j?.retention?.error };
    })
    .catch((e) => { shared.r = { ...shared.r, error: String((e as Error)?.message ?? e) }; })
    .finally(() => { shared.p = null; shared.subs.forEach((f) => f()); if (!shared.r.v || shared.r.computing) setTimeout(() => { if (shared.subs.size) load(); }, 20_000); });
}
/** Asked again every 10 minutes while the page is open and seen (SARCLA 20.10: "cards that never refresh while left open - avoid"). */
let reask: ReturnType<typeof setInterval> | null = null;
export function useRetention(): Read {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    shared.subs.add(f);
    if (!shared.r.v) load();
    reask ??= setInterval(() => { if (shared.subs.size && document.visibilityState === "visible") load(); }, 10 * 60 * 1000);
    return () => { shared.subs.delete(f); if (!shared.subs.size && reask) { clearInterval(reask); reask = null; } };
  }, []);
  return shared.r;
}

export function RetentionWaiting({ r }: { r: Read }) {
  return (
    <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
      {!r.error && <CircularProgress size={18} />}
      <Typography sx={{ fontSize: "0.9rem", color: r.error ? RED : MUTED }}>
        {r.error ? `Could not load: ${r.error}` : `Reading every customer since 2015, the orders, tickets, calls, meetings, e-mails and contacts… a quarter of an hour the first time${r.progress ? ` · ${r.progress}` : ""}`}
      </Typography>
    </Box></GlassCard>
  );
}

/* ── the figures ─────────────────────────────────────────────────────────────── */

export function RetentionFigures({ v }: { v: RetentionView }) {
  const f = v.figures;
  const items: { label: string; icon: React.ReactNode; tint: Tint; v: string; sub: string }[] = [
    { label: `Active in ${v.base}`, icon: <GroupsOutlinedIcon />, tint: "blue", v: n0(f.active), sub: `customers with €${100} or more` },
    { label: v.partial ? `Back in ${v.next} so far` : `Kept in ${v.next}`, icon: <TimelineOutlinedIcon />, tint: "green", v: n0(f.back), sub: `${pct(f.active ? f.back / f.active : null)} of them` },
    { label: v.partial ? "Not back yet" : "Lost", icon: <TrendingDownOutlinedIcon />, tint: "pink", v: n0(f.gone), sub: `${pct(f.churn, 1)} - ${eur(f.goneRev)} of ${v.base} revenue` },
    { label: `New in ${v.next}`, icon: <PersonAddAltOutlinedIcon />, tint: "amber", v: n0(f.newNext), sub: `and ${n0(f.winbacks)} won back` },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(124px, 172px))" } }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{it.label}</Typography>
          </Box>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{it.v}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── shared pieces ───────────────────────────────────────────────────────────── */

/** A card: its title, a chart, a line of how to read it. */
function Card({ icon, tint, title, note, right, foot, children, span }: { icon: React.ReactNode; tint: Tint; title: string; note?: string; right?: React.ReactNode; foot?: React.ReactNode; children: React.ReactNode; span?: boolean }) {
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start", minWidth: 0, gridColumn: span ? "1 / -1" : undefined }}>
      <CardTitle icon={icon} tint={tint} title={title} note={note} right={right} />
      <Box sx={{ minWidth: 0 }}>{children}</Box>
      {foot && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{foot}</Typography>}
    </GlassCard>
  );
}
const Grid2 = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: "grid", gap: 1.75, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>{children}</Box>
);

const head = { fontSize: "0.74rem", fontWeight: 700, color: MUTED, borderColor: HAIRLINE, lineHeight: 1.3, py: 1.25, px: 0.75, verticalAlign: "bottom" as const };
const body = { fontSize: "0.86rem", color: INK, borderColor: HAIRLINE, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const, py: 0.9, px: 0.75 };
/** All the figures, as a plain table - as on Who are our customers. */
function Figures({ title, head: cols, rows, left = 1, label }: { title: string; head: string[]; rows: { key: string; cells: React.ReactNode[]; strong?: boolean; group?: boolean }[]; left?: number; label: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, mb: 1 }}>{title}</Typography>
      <Box sx={{ overflowX: "auto", borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" }}>
        <Table size="small" sx={{ minWidth: 760 }} aria-label={label}>
          <TableHead><TableRow>{cols.map((h, i) => <TableCell key={h} align={i < left ? "left" : "right"} sx={{ ...head, pl: i === 0 ? 1.5 : 0.75 }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.map((r) => r.group ? (
              <TableRow key={r.key}><TableCell colSpan={cols.length} sx={{ ...body, fontWeight: 800, bgcolor: "#f4f7fc", pl: 1.5 }}>{r.cells[0]}</TableCell></TableRow>
            ) : (
              <TableRow key={r.key} hover>
                {r.cells.map((c, i) => <TableCell key={i} align={i < left ? "left" : "right"} sx={{ ...body, fontWeight: r.strong ? 800 : i === 0 ? 600 : 500, whiteSpace: i < left ? "normal" : "nowrap", pl: i === 0 ? 1.5 : 0.75, minWidth: i === 0 ? 170 : undefined }}>{c}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
const groupCells = (r: GroupRow) => [r.group, n0(r.cos), n0(r.churned), <Box key="c" component="span" sx={{ fontWeight: 700 }}>{pct(r.churn, 1)}</Box>,
  <Box key="p" component="span" sx={{ color: (r.pts ?? 0) > 0.5 ? RED : (r.pts ?? 0) < -0.5 ? GREEN : FAINT, fontWeight: 700 }}>{pts(r.pts)}</Box>, eur(r.rev), eur(r.revLost)];
function groupTable(title: string, rows: GroupRow[], v: RetentionView, label: string) {
  const out: { key: string; cells: React.ReactNode[]; group?: boolean }[] = [];
  let dim = "";
  for (const r of rows) {
    if (r.dim !== dim) { dim = r.dim; out.push({ key: `g-${dim}`, cells: [dim], group: true }); }
    out.push({ key: `${r.dim}|${r.group}`, cells: groupCells(r) });
  }
  return <Figures title={title} label={label} head={["Group", `Active ${v.base}`, v.partial ? "Not back yet" : "Lost", "Churn", "Against the average", `Revenue ${v.base}`, "Revenue not back"]} rows={out} />;
}

/** A flow diagram from the base year's customers to back / not back. */
function FlowChart({ flow, height = 400, label }: { flow: Flow; height?: number; label: string }) {
  return (
    <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
      <Box sx={{ minWidth: 860 }}>
        <Sankey height={height} columns={flow.columns} label={label} links={flow.links} format={(n) => n0(n)}
          nodes={flow.nodes.map((x) => ({ id: x.id, column: x.column, label: x.label, color: TONE[x.tone] }))} />
      </Box>
    </Box>
  );
}

/** Each group's churn left or right of the average: worse in red to the right, better in green to the left. */
function Diverging({ rows, height }: { rows: GroupRow[]; height?: number }) {
  const one = new Set(rows.map((r) => r.dim)).size === 1;
  const data = rows.filter((r) => r.pts != null).map((r) => ({ label: one ? r.group : `${r.dim} · ${r.group}`, pts: Math.round((r.pts ?? 0) * 10) / 10, churn: r.churn, cos: r.cos }));
  const max = Math.ceil(Math.max(5, ...data.map((d) => Math.abs(d.pts))) * 1.2);
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(220, data.length * 30 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 4 }} barCategoryGap="22%">
        <CartesianGrid horizontal={false} stroke="#e6e8ec" />
        <XAxis type="number" domain={[-max, max]} tickFormatter={(x: number) => `${x > 0 ? "+" : ""}${x}`} tick={{ fontSize: 11.5, fill: MUTED }} />
        <YAxis type="category" dataKey="label" width={300} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 12, fill: INK }} />
        <ReferenceLine x={0} stroke={INK} strokeWidth={1} />
        <Tooltip {...tip} formatter={(_: unknown, __: unknown, p: { payload?: { churn?: number; cos?: number; pts?: number } }) => [`${pct(p.payload?.churn, 1)} churn (${pts(p.payload?.pts)}) - ${n0(p.payload?.cos)} customers`, ""]} />
        <Bar dataKey="pts" isAnimationActive={false} maxBarSize={18} radius={4}>
          {data.map((d) => <Cell key={d.label} fill={d.pts > 0 ? ORANGE : GREENS} />)}
          <LabelList dataKey="churn" position="right" formatter={(x: unknown) => pct(Number(x))} style={{ fontSize: 11.5, fill: INK, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── 1 · retention trend ─────────────────────────────────────────────────────── */

function CustomersChart({ v }: { v: RetentionView }) {
  const data = v.trend.map((t) => ({ year: t.partial ? `${t.next} so far` : String(t.next), kept: t.retained, back: t.winbacks, fresh: t.newNext, retention: t.retention == null ? null : Math.round(t.retention * 1000) / 10 }));
  return (
    <ResponsiveContainer width="100%" height={330}>
      <ComposedChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e6e8ec" />
        <XAxis dataKey="year" tick={{ fontSize: 11.5, fill: MUTED }} tickLine={false} />
        <YAxis yAxisId="n" domain={[0, (m: number) => Math.ceil((m * 1.6) / 1000) * 1000]} tickFormatter={(x: number) => x.toLocaleString("en")} tick={{ fontSize: 11.5, fill: MUTED }} width={52} />
        <YAxis yAxisId="p" orientation="right" domain={[20, 75]} ticks={[40, 50, 60, 70]} tickFormatter={(x: number) => `${x}%`} tick={{ fontSize: 11.5, fill: MUTED }} width={40} />
        <Tooltip {...tip} formatter={(x: unknown, n: unknown) => [n === "Kept from the year before (retention)" ? `${x}%` : Number(x).toLocaleString("en"), String(n)]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "0.78rem" }} />
        <Bar yAxisId="n" dataKey="kept" stackId="a" name="Kept" fill={BLUE} isAnimationActive={false} />
        <Bar yAxisId="n" dataKey="back" stackId="a" name="Won back" fill={GREENS} isAnimationActive={false} />
        <Bar yAxisId="n" dataKey="fresh" stackId="a" name="New" fill={AMBER} isAnimationActive={false} radius={[4, 4, 0, 0]} />
        <Line yAxisId="p" type="monotone" dataKey="retention" name="Kept from the year before (retention)" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 3.5, fill: ORANGE }} isAnimationActive={false}>
          <LabelList dataKey="retention" position="top" formatter={(x: unknown) => `${x}%`} style={{ fontSize: 11.5, fill: ORANGE, fontWeight: 800, paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function BridgeChart({ v }: { v: RetentionView }) {
  const t = v.trend.find((x) => x.year === v.base);
  if (!t) return null;
  const rows = [
    { name: `Active ${v.base}`, base: 0, v: t.active, fill: BLUE, label: n0(t.active) },
    { name: v.partial ? "Not back yet" : "Lost", base: t.active - t.churned, v: t.churned, fill: ORANGE, label: `−${n0(t.churned)}` },
    { name: "New", base: t.retained, v: t.newNext, fill: AMBER, label: `+${n0(t.newNext)}` },
    { name: "Won back", base: t.retained + t.newNext, v: t.winbacks, fill: GREENS, label: `+${n0(t.winbacks)}` },
    { name: v.partial ? `Active ${v.next} so far` : `Active ${v.next}`, base: 0, v: t.activeNext, fill: BLUE, label: n0(t.activeNext) },
  ];
  return (
    <ResponsiveContainer width="100%" height={330}>
      <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e6e8ec" />
        <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: INK }} tickLine={false} interval={0} />
        <YAxis tickFormatter={(x: number) => x.toLocaleString("en")} tick={{ fontSize: 11.5, fill: MUTED }} width={52} />
        <Tooltip {...tip} formatter={(x: unknown, n: unknown) => (n === "base" ? [null, null] : [Number(x).toLocaleString("en"), "Customers"])} />
        <Bar dataKey="base" stackId="w" fill="#fff" fillOpacity={0} stroke="none" isAnimationActive={false} />
        <Bar dataKey="v" stackId="w" isAnimationActive={false} radius={[4, 4, 4, 4]} maxBarSize={80}>
          {rows.map((r) => <Cell key={r.name} fill={r.fill} />)}
          <LabelList dataKey="label" position="top" style={{ fontSize: 12, fill: INK, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LostRevenueChart({ v }: { v: RetentionView }) {
  const top = Math.max(...v.trend.map((t) => t.churnedRev));
  const data = v.trend.map((t, i) => ({ year: String(t.year), rev: Math.round(t.churnedRev), n: t.churned, label: i === v.trend.length - 1 || t.churnedRev === top ? eur(t.churnedRev) : "" }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 24, right: 56, bottom: 0, left: 8 }}>
        <defs><linearGradient id="lostRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} /><stop offset="100%" stopColor={ORANGE} stopOpacity={0.03} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#e6e8ec" />
        <XAxis dataKey="year" tick={{ fontSize: 11.5, fill: MUTED }} tickLine={false} />
        <YAxis tickFormatter={(x: number) => eur(x)} tick={{ fontSize: 11.5, fill: MUTED }} width={86} />
        <Tooltip {...tip} formatter={(x: unknown) => [eur(Number(x)), "Revenue of the customers lost"]} />
        <Area type="monotone" dataKey="rev" stroke={ORANGE} strokeWidth={2.5} fill="url(#lostRev)" isAnimationActive={false}>
          <LabelList dataKey="label" position="top" style={{ fontSize: 11.5, fill: INK, fontWeight: 700 }} />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendTab({ v, act }: { v: RetentionView; act?: (card: string, title: string) => React.ReactNode }) {
  const t = v.trend;
  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      <Card icon={<BarChartOutlinedIcon />} tint="blue" title="Customers each year - kept, won back, new" span right={act?.("customers", "Customers each year")}
        note="Each year's active customers (EUR 100 or more): those kept from the year before, those won back, the new - and the share of the year before's customers kept (the line)"
        foot={`New = their first order ever that year (Compass); won back = bought before, not the year before.${v.partial ? ` ${v.next} is still running - its customers so far.` : ""}`}>
        <CustomersChart v={v} />
      </Card>
      <Grid2>
        <Card icon={<SwapVertOutlinedIcon />} tint="green" title={`From ${v.base} to ${v.next}`} right={act?.("bridge", `From ${v.base} to ${v.next}`)}
          note={`The ${v.base} customers, those not back, the new and the won back - the customers of ${v.next}${v.partial ? " so far" : ""}`}>
          <BridgeChart v={v} />
        </Card>
        <Card icon={<TrendingDownOutlinedIcon />} tint="pink" title="Revenue of the customers lost" right={act?.("lost", "Revenue of the customers lost")}
          note="Each year: what the customers who did not buy the next year had spent that year">
          <LostRevenueChart v={v} />
        </Card>
      </Grid2>
      <GlassCard>
        <Figures title="All the figures, by year" label="Retention by year" head={["Year", "Active", "Kept next year", "Retention", "Lost", "Their revenue", "New next year", "Won back next year"]}
          rows={t.map((x) => ({ key: String(x.year), cells: [`${x.year}${x.partial ? ` → ${x.next} so far` : ""}`, n0(x.active), n0(x.retained), <Box key="r" component="span" sx={{ fontWeight: 700 }}>{pct(x.retention, 1)}</Box>, n0(x.churned), eur(x.churnedRev), n0(x.newNext), n0(x.winbacks)] }))} />
      </GlassCard>
    </Box>
  );
}

/* ── 2 · cohorts ─────────────────────────────────────────────────────────────── */

function CohortHeat({ v }: { v: RetentionView }) {
  const rows = v.cohorts.rows;
  const years = v.years.filter((y) => y >= (rows[0]?.cohort ?? v.years[0]) && y <= v.next);
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: `76px 78px repeat(${years.length}, minmax(52px, 1fr))`, gap: "3px", minWidth: 160 + years.length * 55, fontVariantNumeric: "tabular-nums" }}>
        <Box sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, alignSelf: "end" }}>FIRST ORDER</Box>
        <Box sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, alignSelf: "end", textAlign: "right", pr: 0.5 }}>CUSTOMERS</Box>
        {years.map((y) => <Box key={y} sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textAlign: "center" }}>{y}{y === v.next && v.partial ? "*" : ""}</Box>)}
        {rows.map((r) => (
          <Box key={r.cohort} sx={{ display: "contents" }}>
            <Box sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, alignSelf: "center" }}>{r.cohort}</Box>
            <Box sx={{ fontSize: "0.8rem", color: MUTED, textAlign: "right", pr: 0.5, alignSelf: "center" }}>{n0(r.size)}</Box>
            {years.map((y) => {
              const k = y - r.cohort, s = k >= 0 ? r.share[k] : null;
              return (
                <Box key={y} title={s == null ? undefined : `${r.cohort} customers active in ${y}: ${pct(s, 1)}`}
                  sx={{ height: 30, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.74rem", fontWeight: 700,
                    bgcolor: s == null ? "transparent" : `rgba(45, 111, 168, ${(0.08 + 0.85 * s).toFixed(3)})`, color: s != null && s > 0.45 ? "#fff" : INK }}>
                  {s == null ? "" : pct(s)}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function OnceChart({ v }: { v: RetentionView }) {
  const data = v.cohorts.once.map((r) => ({ cohort: String(r.cohort), size: r.size, once: r.once == null ? null : Math.round(r.once * 1000) / 10, gone2: r.gone2 == null ? null : Math.round(r.gone2 * 1000) / 10, still: r.still == null ? null : Math.round(r.still * 1000) / 10 }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e6e8ec" />
        <XAxis dataKey="cohort" tick={{ fontSize: 11.5, fill: MUTED }} tickLine={false} />
        <YAxis yAxisId="n" tickFormatter={(x: number) => x.toLocaleString("en")} tick={{ fontSize: 11.5, fill: MUTED }} width={48} />
        <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={(x: number) => `${x}%`} tick={{ fontSize: 11.5, fill: MUTED }} width={40} />
        <Tooltip {...tip} formatter={(x: unknown, n: unknown) => [n === "Customers" ? Number(x).toLocaleString("en") : `${x}%`, String(n)]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "0.78rem" }} />
        <Bar yAxisId="n" dataKey="size" name="Customers" fill="#d9dee6" isAnimationActive={false} radius={[4, 4, 0, 0]} />
        <Line yAxisId="p" dataKey="once" name="Bought in one year only" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false}>
          <LabelList dataKey="once" position="top" formatter={(x: unknown) => (x == null ? "" : `${x}%`)} style={{ fontSize: 10.5, fill: ORANGE, fontWeight: 700 }} />
        </Line>
        <Line yAxisId="p" dataKey="gone2" name="Gone within two years" stroke={RED} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} isAnimationActive={false} connectNulls={false} />
        <Line yAxisId="p" dataKey="still" name={`Still buying (${v.next - 1} or ${v.next})`} stroke={GREENS} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function FirstSecondChart({ v }: { v: RetentionView }) {
  const data = v.cohorts.firstSecond.map((r) => ({ cohort: r.partial ? `${r.cohort}*` : String(r.cohort), lost: r.churn == null ? null : Math.round(r.churn * 1000) / 10, rev: r.revChurn == null ? null : Math.round(r.revChurn * 1000) / 10 }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="#e6e8ec" />
        <XAxis dataKey="cohort" tick={{ fontSize: 11.5, fill: MUTED }} tickLine={false} />
        <YAxis tickFormatter={(x: number) => `${x}%`} tick={{ fontSize: 11.5, fill: MUTED }} width={44} />
        <ReferenceLine y={0} stroke={INK} />
        <Tooltip {...tip} formatter={(x: unknown, n: unknown) => [`${x}%`, String(n)]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "0.78rem" }} />
        <Bar dataKey="lost" name="Customers lost after year one" fill={BLUE} isAnimationActive={false} radius={[4, 4, 0, 0]}>
          <LabelList dataKey="lost" position="top" formatter={(x: unknown) => `${x}%`} style={{ fontSize: 10.5, fill: INK, fontWeight: 700 }} />
        </Bar>
        <Bar dataKey="rev" name="Revenue lost after year one (below 0: it grew)" fill={DEEMPHASIS} isAnimationActive={false} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CohortsTab({ v, act }: { v: RetentionView; act?: (card: string, title: string) => React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      <Card icon={<GridOnOutlinedIcon />} tint="blue" title="Each first-order year: the share still buying" span right={act?.("heat", "Each first-order year: the share still buying")}
        note="A row per year of the first order ever (Compass) - the share of those customers that bought each year after (EUR 100 or more)"
        foot={`The first year is often below 100%: a first order under EUR 100.${v.partial ? ` * ${v.next} is still running.` : ""}`}>
        <CohortHeat v={v} />
      </Card>
      <Grid2>
        <Card icon={<ShowChartOutlinedIcon />} tint="pink" title="Bought in one year only" right={act?.("once", "Bought in one year only")}
          note="Of each first-order year's customers: bought in one year only, gone within two years, still buying - over how many there were">
          <OnceChart v={v} />
        </Card>
        <Card icon={<BarChartOutlinedIcon />} tint="amber" title="After year one: customers lost, revenue lost" right={act?.("firstsecond", "After year one: customers lost, revenue lost")}
          note="Each first-order year, from its first year to its second: the share of customers lost against the share of their revenue lost">
          <FirstSecondChart v={v} />
        </Card>
      </Grid2>
      <GlassCard>
        <Figures title="All the figures, by first-order year" label="Cohorts" head={["First order", "Year one", "Year two", "Customers lost", "Revenue year one", "Revenue year two", "Revenue lost", "Bought one year only"]}
          rows={v.cohorts.firstSecond.map((r) => {
            const o = v.cohorts.once.find((x) => x.cohort === r.cohort);
            return { key: String(r.cohort), cells: [`${r.cohort}${r.partial ? " (year two still running)" : ""}`, n0(r.y1), n0(r.y2), pct(r.churn, 1), eur(r.rev1), eur(r.rev2), pct(r.revChurn, 1), pct(o?.once, 1)] };
          })} />
      </GlassCard>
    </Box>
  );
}

/* ── 3 · why they leave ──────────────────────────────────────────────────────── */

export function LeaveTab({ v, act }: { v: RetentionView; act?: (card: string, title: string) => React.ReactNode }) {
  const l = v.leave;
  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      <Card icon={<CallSplitIcon />} tint="pink" title={`Why they leave - the ${n0(l.customers)} customers of ${v.base}, step by step`} span right={act?.("flow", "Why they leave - step by step")}
        note={`How many orders they placed in ${v.base}, from how many profit centres - and who is back${v.partial ? ` in ${v.next} so far` : ""}`}
        foot={`Average: ${pct(l.avg, 1)} ${v.partial ? "not back yet" : "lost"}. An order = one order number (its deliveries together); profit centres from the orders' lines. "No order found": revenue without an order in HubSpot under the customer number.`}>
        <FlowChart flow={l.flow} label="Why they leave" />
      </Card>
      <Card icon={<AlignHorizontalCenterOutlinedIcon />} tint="amber" title={`Each lever against the average (${pct(l.avg, 1)})`} span right={act?.("levers", "Each lever against the average")}
        note="Points of churn above the average (worse, to the right) or below it (better, to the left) - the churn itself at the end of each bar"
        foot="Correlations, not causes - size goes with most levers: a customer with six orders is rarely a small one.">
        <Diverging rows={l.rows} />
      </Card>
      <GlassCard>{groupTable("All the figures, by lever", l.rows, v, "Why they leave")}</GlassCard>
    </Box>
  );
}

/* ── 4 · the path ────────────────────────────────────────────────────────────── */

const TEAM_COLOUR: Record<string, string> = { "ESO - field sales": BLUE, "TSA - inside sales": ORANGE, "Back Office": GREENS, "Former staff": DEEMPHASIS, "No team": AMBER };

function OwnerBubbles({ v }: { v: RetentionView }) {
  const teams = [...new Set(v.path.owners.filter((o) => o.touchedPct != null).map((o) => o.team))];
  return (
    <ResponsiveContainer width="100%" height={380}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid stroke="#e6e8ec" />
        <XAxis type="number" dataKey="x" name="Book reached" domain={[0, 100]} tickFormatter={(x: number) => `${x}%`} tick={{ fontSize: 11.5, fill: MUTED }}
          label={{ value: `Share of the owner's ${v.base} customers its activity reached`, position: "insideBottom", offset: -14, style: { fontSize: 11.5, fill: MUTED } }} />
        <YAxis type="number" dataKey="y" name="Churn of those reached" tickFormatter={(x: number) => `${x}%`} tick={{ fontSize: 11.5, fill: MUTED }} width={44}
          label={{ value: "Churn of those reached", angle: -90, position: "insideLeft", style: { fontSize: 11.5, fill: MUTED } }} />
        <ZAxis type="number" dataKey="z" range={[40, 1100]} name="Revenue reached" />
        <ReferenceLine y={Math.round(v.path.avg * 1000) / 10} stroke={RED} strokeDasharray="5 4" label={{ value: `average ${pct(v.path.avg, 1)}`, position: "insideTopRight", style: { fontSize: 11, fill: RED } }} />
        <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
          const p = payload?.[0]?.payload as { name?: string; team?: string; x?: number; y?: number; z?: number; touched?: number } | undefined;
          if (!p) return null;
          return (
            <Box sx={{ bgcolor: "#fff", border: "1px solid rgba(21,34,58,.12)", borderRadius: "10px", p: 1, fontSize: "0.8rem" }}>
              <b>{p.name}</b> · {p.team}<br />{n0(p.touched)} customers reached · {p.x == null ? "—" : `${p.x}%`} of its book<br />{p.y}% not back · {eur(p.z)} revenue reached
            </Box>
          );
        }} />
        <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: "0.78rem" }} />
        {teams.map((t) => (
          <Scatter key={t} name={t} fill={TEAM_COLOUR[t] ?? AMBER} fillOpacity={0.75} isAnimationActive={false}
            data={v.path.owners.filter((o) => o.team === t).map((o) => ({ name: o.name, team: o.team, x: o.touchedPct == null ? null : Math.round(o.touchedPct * 1000) / 10, y: o.churn == null ? null : Math.round(o.churn * 1000) / 10, z: Math.round(o.touchedRev), touched: o.touched })).filter((d) => d.x != null)} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Each group's churn as a bar, the average as a line through them. */
function AgainstAverage({ rows, avg }: { rows: GroupRow[]; avg: number }) {
  const data = rows.map((r) => ({ label: `${r.dim} · ${r.group}`, churn: r.churn == null ? null : Math.round(r.churn * 1000) / 10, cos: r.cos }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 28 + 50)}>
      <BarChart data={data} layout="vertical" margin={{ top: 18, right: 60, bottom: 4, left: 4 }} barCategoryGap="24%">
        <CartesianGrid horizontal={false} stroke="#e6e8ec" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(x: number) => `${x}%`} tick={{ fontSize: 11.5, fill: MUTED }} />
        <YAxis type="category" dataKey="label" width={320} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 12, fill: INK }} />
        <ReferenceLine x={Math.round(avg * 1000) / 10} stroke={RED} strokeDasharray="5 4" label={{ value: `average ${pct(avg, 1)}`, position: "top", style: { fontSize: 11, fill: RED } }} />
        <Tooltip {...tip} formatter={(x: unknown, _: unknown, p: { payload?: { cos?: number } }) => [`${x}% not back - ${n0(p.payload?.cos)} customers`, ""]} />
        <Bar dataKey="churn" isAnimationActive={false} maxBarSize={16} radius={[0, 4, 4, 0]}>
          {data.map((d) => <Cell key={d.label} fill={(d.churn ?? 0) > avg * 100 ? ORANGE : BLUE} />)}
          <LabelList dataKey="churn" position="right" formatter={(x: unknown) => `${x}%`} style={{ fontSize: 11.5, fill: INK, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PathTab({ v, act }: { v: RetentionView; act?: (card: string, title: string) => React.ReactNode }) {
  const p = v.path;
  const ownerRows: { key: string; cells: React.ReactNode[]; group?: boolean }[] = [];
  let team = "";
  for (const o of p.owners) {
    if (o.team !== team) { team = o.team; ownerRows.push({ key: `t-${team}`, cells: [team], group: true }); }
    ownerRows.push({ key: o.id, cells: [o.name, n0(o.calls), n0(o.em), n0(o.mtg), o.book ? n0(o.book) : "—", n0(o.touched), pct(o.touchedPct), eur(o.touchedRev), n0(o.churned), <Box key="c" component="span" sx={{ fontWeight: 700, color: (o.churn ?? 0) > p.avg ? RED : INK }}>{pct(o.churn, 1)}</Box>, eur(o.churnedRev)] });
  }
  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      <Card icon={<RouteOutlinedIcon />} tint="purple" title={`The path - the ${n0(p.customers)} customers of ${v.base}, from our side`} span right={act?.("flow", "The path")}
        note={`Did sales reach them (a call, meeting, visit or sales ticket since January ${v.base}), can marketing reach them (a marketing contact), did they talk to us (a ticket in ${v.base}) - and who is back`}
        foot={`Average: ${pct(p.avg, 1)} ${v.partial ? "not back yet" : "lost"}. "Asked" = a ticket on a product's price or information - mostly requests for quotation; a customer that asked counts there, even with a problem ticket too.`}>
        <FlowChart flow={p.flow} height={440} label="The path" />
      </Card>
      <Grid2>
        <Card icon={<BubbleChartOutlinedIcon />} tint="blue" title="The owners: book reached, and what became of it" right={act?.("owners", "The owners: book reached")}
          note={`A bubble per owner (10 customers reached or more), sized by the ${v.base} revenue its activity reached; to the right = more of its own book reached, higher = more of them not back`}>
          <OwnerBubbles v={v} />
        </Card>
        <Card icon={<FormatListBulletedOutlinedIcon />} tint="amber" title="Calls, e-mails, tickets, marketing - each against the average" right={act?.("levers", "Each contact against the average")}
          note="The churn of each group, the average as a line - orange above it, blue below">
          <AgainstAverage rows={p.rows} avg={p.avg} />
        </Card>
      </Grid2>
      <GlassCard sx={{ display: "grid", gap: 2 }}>
        <Figures title={`The owners - activity since January ${v.base}, their book, the customers reached`} label="The owners" left={1}
          head={["Owner", "Calls", "E-mails sent", "Meetings & visits", `Book: active ${v.base} owned`, "Reached", "Book reached", `Revenue ${v.base} reached`, "Of them not back", "Churn of reached", "Their revenue"]} rows={ownerRows} />
        {groupTable("All the figures, by contact", p.rows, v, "The path")}
        <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
          Reached = a call, meeting, visit or e-mail the owner logged on the customer - reaching customers it does not own too, so it can pass its book. Team from HubSpot&apos;s teams; those who left in grey. Owners reaching fewer than 10 customers are left out.
        </Typography>
      </GlassCard>
    </Box>
  );
}

/* ── 5 · personas ────────────────────────────────────────────────────────────── */

const PERSONA_DIMS = ["Contact persona", "Business type", "Industry (APIC)", "Country", "Segment", "Sales priority"];

function TreeTile(p: { x?: number; y?: number; width?: number; height?: number; name?: string; churn?: number; cos?: number; avg?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", churn, cos } = p;
  if (width < 2 || height < 2) return null;
  const fill = churnColour(churn, p.avg ?? 0.4);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} fill={fill} stroke="#fff" strokeWidth={2} />
      {width > 70 && height > 34 && (
        <text x={x + 8} y={y + 18} fontSize={12} fontWeight={700} fill="#fff">{name.length * 6.5 > width - 12 ? `${name.slice(0, Math.max(3, Math.floor((width - 12) / 6.5) - 1))}…` : name}</text>
      )}
      {width > 70 && height > 50 && <text x={x + 8} y={y + 36} fontSize={11.5} fill="#fff">{pct(churn)} · {n0(cos)}</text>}
    </g>
  );
}

export function PersonasTab({ v, act }: { v: RetentionView; act?: (card: string, title: string) => React.ReactNode }) {
  const [dim, setDim] = useState(PERSONA_DIMS[0]);
  const ps = v.personas;
  const rows = useMemo(() => ps.rows.filter((r) => r.dim === dim), [ps.rows, dim]);
  const tiles = rows.map((r) => ({ name: r.group, size: r.cos, churn: r.churn, cos: r.cos, avg: ps.avg }));
  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      <Card icon={<DashboardOutlinedIcon />} tint="green" title={`Who they are - ${dim.toLowerCase()}`} span right={act?.("map", "Who they are")}
        note={`A tile per group: its size = the ${v.base} customers in it, its colour = how many are not back (green below the average ${pct(ps.avg, 1)}, red far above)`}>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.25 }}>
          {PERSONA_DIMS.map((x) => {
            const on = x === dim;
            return (
              <Box key={x} component="button" type="button" onClick={() => setDim(x)} aria-pressed={on}
                sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : INK, font: "inherit", fontSize: "0.8rem", fontWeight: 700, px: 1.25, py: 0.6, borderRadius: "10px", cursor: "pointer" }}>
                {x}
              </Box>
            );
          })}
        </Box>
        <ResponsiveContainer width="100%" height={360}>
          <Treemap data={tiles} dataKey="size" nameKey="name" isAnimationActive={false} content={<TreeTile />} />
        </ResponsiveContainer>
      </Card>
      <Grid2>
        <Card icon={<ViewModuleOutlinedIcon />} tint="purple" title="Segment against priority" right={act?.("matrix", "Segment against priority")}
          note="The churn of each segment at each sales priority - groups of 25 customers or more">
          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ display: "grid", gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${PRIOS.length}, minmax(64px, 1fr))`, gap: "4px", minWidth: 480 }}>
              <Box />
              {PRIOS.map((x) => <Box key={x} sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textAlign: "center" }}>{x}</Box>)}
              {ps.matrix.map((m) => (
                <Box key={m.segment} sx={{ display: "contents" }}>
                  <Box sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, alignSelf: "center" }}>{m.segment} <Box component="span" sx={{ color: FAINT, fontWeight: 500 }}>{n0(m.cos)}</Box></Box>
                  {m.cells.map((c) => (
                    <Box key={c.prio} title={`${m.segment}, ${c.prio}: ${n0(c.cos)} customers${c.churn == null ? "" : `, ${pct(c.churn, 1)} not back`}`}
                      sx={{ height: 40, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, bgcolor: c.churn == null ? "#f1f3f6" : churnColour(c.churn, ps.avg), color: c.churn == null ? FAINT : "#fff" }}>
                      {c.churn == null ? (c.cos ? n0(c.cos) : "") : pct(c.churn)}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </Card>
        <Card icon={<AlignHorizontalCenterOutlinedIcon />} tint="amber" title={`${dim} against the average`} right={act?.("levers", "Personas against the average")}
          note="Points of churn above (right) or below (left) the average">
          <Diverging rows={rows} />
        </Card>
      </Grid2>
      <GlassCard>{groupTable(`All the figures - ${dim.toLowerCase()}`, rows, v, "Personas")}</GlassCard>
    </Box>
  );
}

/* ── the nutshell ────────────────────────────────────────────────────────────── */

export const RETENTION_TABS = ["trend", "cohorts", "leave", "path", "personas"] as const;
export type RetentionTab = (typeof RETENTION_TABS)[number];
export const RETENTION_TAB_NAMES: Record<RetentionTab, string> = { trend: "Retention trend", cohorts: "Cohorts & first order", leave: "Why they leave", path: "The path", personas: "Personas" };

/** A retention chart promoted to the nutshell: its card, alone. */
export function RetentionPromoted({ tab, card, title, actions }: { tab: string; card: string; title: string; actions: React.ReactNode }) {
  const r = useRetention();
  if (!r.v) return <GlassCard><CardTitle icon={<EuroOutlinedIcon />} tint="amber" title={title} note="Reading the customers…" right={actions} /></GlassCard>;
  const v = r.v;
  const charts: Record<string, () => React.ReactNode> = {
    "trend:customers": () => <CustomersChart v={v} />, "trend:bridge": () => <BridgeChart v={v} />, "trend:lost": () => <LostRevenueChart v={v} />,
    "cohorts:heat": () => <CohortHeat v={v} />, "cohorts:once": () => <OnceChart v={v} />, "cohorts:firstsecond": () => <FirstSecondChart v={v} />,
    "leave:flow": () => <FlowChart flow={v.leave.flow} label="Why they leave" />, "leave:levers": () => <Diverging rows={v.leave.rows} />,
    "path:flow": () => <FlowChart flow={v.path.flow} height={440} label="The path" />, "path:owners": () => <OwnerBubbles v={v} />, "path:levers": () => <AgainstAverage rows={v.path.rows} avg={v.path.avg} />,
  };
  const draw = charts[`${tab}:${card}`] as (() => React.ReactNode) | undefined;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<EuroOutlinedIcon />} tint="amber" title={title} note={draw ? `Retain & grow · ${v.base} → ${v.next}${v.partial ? " so far" : ""}` : "This card is no longer on its page - Actions takes it off here."} right={actions} />
      {draw?.()}
    </GlassCard>
  );
}

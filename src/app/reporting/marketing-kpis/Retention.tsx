"use client";
// RETAIN & GROW - SARCLA'S RETENTION WORKBOOK, LIVE AND IN GRAPHS (SARCLA 20.10.2026: "2 · Retention Trend with
// other graphs - this applies to every tab; 3 · Cohorts & First-Order; 4 · Why They Leave, a diagram to see it;
// 5 · Tickets + 6 · Activities + 9 · Marketing Reach together to create a path; 7 · Personas - please think in
// graph format, and vary"; then "finer, to match the platform", "a tab only for new customers' retention").
// A chart of another kind on every card, drawn as the platform's (Who are our customers): the legend top left,
// quiet axes, thin bars, soft tints:
//   Retention trend   stacked columns (kept / won back / new) under the retention line; the bridge from the base
//                     year to the next; the revenue of the customers lost, as an area
//   Cohorts           a heat map of each first-order year; bought only once, as lines over the cohorts' size;
//                     year one to year two - customers lost against revenue lost
//   New customers     each year's new customers and how many came back; the flow of the base year's new ones;
//                     what brings a new customer back - how it bought, how we reached it
//   Why they leave    the flow from the base year's customers through their orders and profit centres to back or
//                     not; each lever left or right of the average
//   The path          the flow through sales touch, marketing reach and tickets to back or not; the owners as
//                     bubbles (book reached against churn); each contact against the average line
//   Personas          the customers as tiles, sized by how many, tinted by churn; segment against priority
// Groups under 25 customers, and the contacts no persona could be named for, are in the tables only.
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
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, Treemap, XAxis, YAxis, ZAxis,
} from "recharts";

import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { Sankey } from "@/app/charts/Sankey";
import { PRIOS, UNMAPPED, type Flow, type GroupRow, type RetentionView } from "@/lib/marketingKpis/retentionCube";
import { n0 } from "./ExplorerKit";

const eur = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `€${Math.round(n).toLocaleString("en")}`);
const pct = (n: number | null | undefined, d = 0) => (n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(d)}%`);
const pts = (n: number | null | undefined) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)} pts`);

/* ── the platform's chart look ───────────────────────────────────────────────── */

const BLUE = SERIES[0], ORANGE = SERIES[1];
/** softer second and third series: they sit on the blue, they do not shout over it */
const WON = "#5dbb98", NEW = "#f1b955", LOST = "#e8845c";
const TONE: Record<Flow["nodes"][number]["tone"], string> = { base: BLUE, good: "#3fae86", mid: "#e9a93c", bad: LOST, none: DEEMPHASIS };
const GRID = "#eef1f5";
const AX = { tick: { fontSize: 11, fill: FAINT }, axisLine: false, tickLine: false } as const;
const LEGEND = { verticalAlign: "top" as const, align: "left" as const, iconType: "circle" as const, iconSize: 8, wrapperStyle: { fontSize: "0.76rem", paddingBottom: 12, color: MUTED } };
const TIP = { contentStyle: { fontSize: "0.8rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)", boxShadow: "0 6px 18px rgba(31,45,78,.08)" }, cursor: { fill: "rgba(21,34,58,.035)" } } as const;
const LABEL = { fontSize: 11, fill: INK, fontWeight: 700 } as const;
/** a value's label on a chart, in a white halo so it reads over a line or a bar */
const HALO = { paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 } as const;

/** Churn as a soft tint: green 20 points below the average, amber at it, coral 20 points above - dark text on it. */
function churnTint(c: number | null | undefined, avg: number): string {
  if (c == null) return "#f1f3f6";
  const t = Math.max(0, Math.min(1, (c - avg + 0.2) / 0.4));
  const mix = (a: number[], b: number[], k: number) => a.map((x, i) => x + (b[i] - x) * k);
  const g = [63, 174, 134], y = [233, 169, 60], r = [226, 101, 76];
  const base = t < 0.5 ? mix(g, y, t * 2) : mix(y, r, (t - 0.5) * 2);
  const [rr, gg, bb] = mix(base, [255, 255, 255], 0.5).map(Math.round);
  return `rgb(${rr}, ${gg}, ${bb})`;
}
/** A group the charts draw: 25 customers or more, not set aside. */
const charted = (r: GroupRow) => r.cos >= 25 && !r.aside;
/** Rounded up to a tidy top for an axis. */
const tidy = (n: number) => { const step = 10 ** Math.floor(Math.log10(Math.max(1, n))) / 2; return Math.ceil(n / step) * step; };

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
    { label: `Active in ${v.base}`, icon: <GroupsOutlinedIcon />, tint: "blue", v: n0(f.active), sub: "customers with €100 or more" },
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
/** Two cards side by side, as tall as each other. */
const Grid2 = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: "grid", gap: 1.75, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, alignItems: "stretch" }}>{children}</Box>
);

const head = { fontSize: "0.74rem", fontWeight: 700, color: MUTED, borderColor: HAIRLINE, lineHeight: 1.3, py: 1.25, px: 0.75, verticalAlign: "bottom" as const };
const body = { fontSize: "0.86rem", color: INK, borderColor: HAIRLINE, fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const, py: 0.9, px: 0.75 };
/** All the figures, as a plain table - as on Who are our customers. */
function Figures({ title, head: cols, rows, left = 1, label }: { title: string; head: string[]; rows: { key: string; cells: React.ReactNode[]; strong?: boolean; group?: boolean; muted?: boolean }[]; left?: number; label: string }) {
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
              <TableRow key={r.key} hover sx={{ opacity: r.muted ? 0.6 : 1 }}>
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
  const out: { key: string; cells: React.ReactNode[]; group?: boolean; muted?: boolean }[] = [];
  let dim = "";
  for (const r of rows) {
    if (r.dim !== dim) { dim = r.dim; out.push({ key: `g-${dim}`, cells: [dim], group: true }); }
    out.push({ key: `${r.dim}|${r.group}`, cells: groupCells(r), muted: !charted(r) });
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

/** A group's line in a chart's tooltip. */
function GroupTip({ active, payload }: { active?: boolean; payload?: { payload?: { label?: string; churn?: number | null; pts?: number; cos?: number } }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <Box sx={{ bgcolor: "#fff", border: "1px solid rgba(21,34,58,.1)", borderRadius: "10px", px: 1.25, py: 0.9, fontSize: "0.8rem", boxShadow: "0 6px 18px rgba(31,45,78,.08)" }}>
      <Box sx={{ fontWeight: 700, color: INK }}>{p.label}</Box>
      <Box sx={{ color: MUTED }}>{pct(p.churn, 1)} not back{p.pts != null ? ` (${pts(p.pts)})` : ""} · {n0(p.cos)} customers</Box>
    </Box>
  );
}

/** Each group's churn left or right of the average: worse to the right in coral, better to the left in green. */
function Diverging({ rows, height }: { rows: GroupRow[]; height?: number }) {
  const shown = rows.filter(charted);
  const one = new Set(shown.map((r) => r.dim)).size === 1;
  const data = shown.filter((r) => r.pts != null).map((r) => ({ label: one ? r.group : `${r.dim} · ${r.group}`, pts: Math.round((r.pts ?? 0) * 10) / 10, churn: r.churn, cos: r.cos }));
  const max = Math.ceil(Math.max(5, ...data.map((d) => Math.abs(d.pts))) * 1.25);
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(200, data.length * 28 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[-max, max]} tickFormatter={(x: number) => `${x > 0 ? "+" : ""}${x}`} {...AX} />
        <YAxis type="category" dataKey="label" width={290} interval={0} {...AX} tick={{ fontSize: 11.5, fill: INK }} />
        <ReferenceLine x={0} stroke="#9aa5b6" />
        <Tooltip content={<GroupTip />} cursor={TIP.cursor} />
        <Bar dataKey="pts" isAnimationActive={false} maxBarSize={12} radius={6}>
          {data.map((d) => <Cell key={d.label} fill={d.pts > 0 ? LOST : TONE.good} />)}
          <LabelList dataKey="churn" position="right" formatter={(x: unknown) => pct(Number(x))} style={{ ...LABEL, fontSize: 10.5, fill: MUTED }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Each group's churn as a bar, the average as a line through them. */
function AgainstAverage({ rows, avg }: { rows: GroupRow[]; avg: number }) {
  const data = rows.filter(charted).map((r) => ({ label: `${r.dim} · ${r.group}`, churn: r.churn == null ? null : Math.round(r.churn * 1000) / 10, cos: r.cos, pts: r.pts ?? undefined, raw: r.churn }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28 + 44)}>
      <BarChart data={data.map((d) => ({ ...d, churn: d.churn }))} layout="vertical" margin={{ top: 20, right: 52, bottom: 4, left: 4 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(x: number) => `${x}%`} {...AX} />
        <YAxis type="category" dataKey="label" width={290} interval={0} {...AX} tick={{ fontSize: 11.5, fill: INK }} />
        <ReferenceLine x={Math.round(avg * 1000) / 10} stroke={RED} strokeDasharray="4 4" label={{ value: `average ${pct(avg, 1)}`, position: "top", style: { fontSize: 10.5, fill: RED } }} />
        <Tooltip content={({ active, payload }) => <GroupTip active={active} payload={payload?.map((p) => ({ payload: { ...(p.payload as object), churn: (p.payload as { raw?: number }).raw } }))} />} cursor={TIP.cursor} />
        <Bar dataKey="churn" isAnimationActive={false} maxBarSize={12} radius={[0, 6, 6, 0]}>
          {data.map((d) => <Cell key={d.label} fill={(d.churn ?? 0) > avg * 100 ? LOST : BLUE} fillOpacity={0.9} />)}
          <LabelList dataKey="churn" position="right" formatter={(x: unknown) => `${x}%`} style={{ ...LABEL, fontSize: 10.5, fill: MUTED }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── 1 · retention trend ─────────────────────────────────────────────────────── */

function CustomersChart({ v }: { v: RetentionView }) {
  const data = v.trend.map((t) => ({ year: t.partial ? `${t.next} so far` : String(t.next), kept: t.retained, back: t.winbacks, fresh: t.newNext, retention: t.retention == null ? null : Math.round(t.retention * 1000) / 10 }));
  const top = tidy(Math.max(...v.trend.map((t) => t.activeNext)) * 1.55);
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="34%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="year" {...AX} />
        <YAxis yAxisId="n" domain={[0, top]} ticks={[0, top / 4, top / 2, (3 * top) / 4]} tickFormatter={(x: number) => x.toLocaleString("en")} {...AX} width={50} />
        <YAxis yAxisId="p" orientation="right" domain={[20, 75]} ticks={[40, 50, 60, 70]} tickFormatter={(x: number) => `${x}%`} {...AX} width={38} />
        <Tooltip {...TIP} formatter={(x: unknown, n: unknown) => [n === "Kept from the year before" ? `${x}%` : Number(x).toLocaleString("en"), String(n)]} />
        <Legend {...LEGEND} />
        <Bar yAxisId="n" dataKey="kept" stackId="a" name="Kept" fill={BLUE} isAnimationActive={false} maxBarSize={40} />
        <Bar yAxisId="n" dataKey="back" stackId="a" name="Won back" fill={WON} isAnimationActive={false} maxBarSize={40} />
        <Bar yAxisId="n" dataKey="fresh" stackId="a" name="New" fill={NEW} isAnimationActive={false} maxBarSize={40} radius={[4, 4, 0, 0]} />
        <Line yAxisId="p" type="monotone" dataKey="retention" name="Kept from the year before" stroke={ORANGE} strokeWidth={2} dot={{ r: 3, fill: "#fff", stroke: ORANGE, strokeWidth: 2 }} isAnimationActive={false}>
          <LabelList dataKey="retention" position="top" offset={9} formatter={(x: unknown) => `${x}%`} style={{ ...LABEL, fontSize: 11, fill: ORANGE, ...HALO }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** The base year's customers and the next year's, side by side: the same customers in blue in both bars. */
function BridgeChart({ v }: { v: RetentionView }) {
  const t = v.trend.find((x) => x.year === v.base);
  if (!t) return null;
  const next = v.partial ? `${v.next} so far` : String(v.next);
  const rows = [
    { name: `${v.base} · ${n0(t.active)}`, kept: t.retained, gone: t.churned, back: 0, fresh: 0 },
    { name: `${next} · ${n0(t.activeNext)}`, kept: t.retained, gone: 0, back: t.winbacks, fresh: t.newNext },
  ];
  const seg = (key: "kept" | "gone" | "back" | "fresh", name: string, fill: string) => (
    <Bar dataKey={key} stackId="s" name={name} fill={fill} isAnimationActive={false} maxBarSize={44}>
      <LabelList dataKey={key} position="center" formatter={(x: unknown) => (Number(x) > 0 ? n0(Number(x)) : "")} style={{ ...LABEL, fontSize: 11.5, fill: "#fff" }} />
    </Bar>
  );
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap="28%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={150} {...AX} tick={{ fontSize: 12, fill: INK, fontWeight: 700 }} />
          <Tooltip {...TIP} formatter={(x: unknown, n: unknown) => (Number(x) > 0 ? [Number(x).toLocaleString("en"), String(n)] : [null, null])} />
          <Legend {...LEGEND} />
          {seg("kept", `Bought in ${v.base} and ${v.next}`, BLUE)}
          {seg("gone", v.partial ? "Not back yet" : "Lost", LOST)}
          {seg("back", "Won back", WON)}
          {seg("fresh", "New", NEW)}
        </BarChart>
      </ResponsiveContainer>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.5 }}>
        Of the <b style={{ color: INK }}>{n0(t.active)}</b> customers of {v.base}, <b style={{ color: BLUE }}>{n0(t.retained)}</b> bought again in {next} and <b style={{ color: LOST }}>{n0(t.churned)}</b> {v.partial ? "have not yet" : "did not"}.
        {" "}In {next}, <b style={{ color: INK }}>{n0(t.activeNext)}</b> customers: those {n0(t.retained)}, <b style={{ color: "#2f8f6b" }}>{n0(t.winbacks)}</b> won back and <b style={{ color: "#b07a12" }}>{n0(t.newNext)}</b> new.
      </Typography>
    </Box>
  );
}

function LostRevenueChart({ v }: { v: RetentionView }) {
  const top = Math.max(...v.trend.map((t) => t.churnedRev));
  const data = v.trend.map((t, i) => ({ year: String(t.year), rev: Math.round(t.churnedRev), label: i === v.trend.length - 1 || t.churnedRev === top ? eur(t.churnedRev) : "" }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 24, right: 60, bottom: 0, left: 8 }}>
        <defs><linearGradient id="lostRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={LOST} stopOpacity={0.28} /><stop offset="100%" stopColor={LOST} stopOpacity={0.02} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="year" {...AX} />
        <YAxis tickFormatter={(x: number) => eur(x)} {...AX} width={84} />
        <Tooltip {...TIP} formatter={(x: unknown) => [eur(Number(x)), "Revenue of the customers lost"]} />
        <Area type="monotone" dataKey="rev" stroke={LOST} strokeWidth={2} fill="url(#lostRev)" dot={{ r: 2.5, fill: "#fff", stroke: LOST, strokeWidth: 1.5 }} isAnimationActive={false}>
          <LabelList dataKey="label" position="top" offset={8} style={{ ...LABEL, ...HALO }} />
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
        <Card icon={<SwapVertOutlinedIcon />} tint="green" title={`${v.base} and ${v.next}: who stayed, who left, who came`} right={act?.("bridge", `${v.base} and ${v.next}: who stayed, who left, who came`)}
          note={`The same customers in blue in both bars: those who bought in ${v.base} and ${v.next}`}>
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
      <Box sx={{ display: "grid", gridTemplateColumns: `76px 78px repeat(${years.length}, minmax(50px, 1fr))`, gap: "3px", minWidth: 160 + years.length * 53, fontVariantNumeric: "tabular-nums" }}>
        <Box sx={{ fontSize: "0.68rem", fontWeight: 700, color: FAINT, alignSelf: "end", letterSpacing: "0.04em" }}>FIRST ORDER</Box>
        <Box sx={{ fontSize: "0.68rem", fontWeight: 700, color: FAINT, alignSelf: "end", textAlign: "right", pr: 0.5, letterSpacing: "0.04em" }}>CUSTOMERS</Box>
        {years.map((y) => <Box key={y} sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textAlign: "center" }}>{y}{y === v.next && v.partial ? "*" : ""}</Box>)}
        {rows.map((r) => (
          <Box key={r.cohort} sx={{ display: "contents" }}>
            <Box sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, alignSelf: "center" }}>{r.cohort}</Box>
            <Box sx={{ fontSize: "0.8rem", color: MUTED, textAlign: "right", pr: 0.5, alignSelf: "center" }}>{n0(r.size)}</Box>
            {years.map((y) => {
              const k = y - r.cohort, s = k >= 0 ? r.share[k] : null;
              return (
                <Box key={y} title={s == null ? undefined : `${r.cohort} customers active in ${y}: ${pct(s, 1)}`}
                  sx={{ height: 28, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 650,
                    bgcolor: s == null ? "transparent" : `rgba(45, 111, 168, ${(0.06 + 0.7 * s).toFixed(3)})`, color: s != null && s > 0.5 ? "#fff" : INK }}>
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

/** Of each year's new customers, the share that bought in that one year and never again. */
function OnceChart({ v }: { v: RetentionView }) {
  const data = v.cohorts.once.map((r) => ({ cohort: String(r.cohort), once: r.once == null ? null : Math.round(r.once * 1000) / 10, size: r.size }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="cohort" {...AX} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(x: number) => `${x}%`} {...AX} width={42} />
        <Tooltip {...TIP} formatter={(x: unknown, _: unknown, p: { payload?: { size?: number } }) => [`${x}% of ${n0(p.payload?.size)} new customers`, "Bought in that year only"]} />
        <Bar dataKey="once" fill={LOST} fillOpacity={0.9} isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={34}>
          <LabelList dataKey="once" position="top" formatter={(x: unknown) => `${Math.round(Number(x))}%`} style={LABEL} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Each year's new customers in their second year: how many still buy, and what they spend - against year one = 100%. */
function FirstSecondChart({ v }: { v: RetentionView }) {
  const data = v.cohorts.firstSecond.filter((r) => r.y1 > 0).map((r) => ({
    cohort: r.partial ? `${r.cohort}*` : String(r.cohort),
    cust: Math.round((r.y2 / r.y1) * 100),
    rev: r.rev1 ? Math.round((r.rev2 / r.rev1) * 100) : null,
  }));
  const top = Math.max(150, ...data.map((d) => d.rev ?? 0));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="cohort" {...AX} />
        <YAxis domain={[0, Math.ceil(top / 50) * 50]} ticks={Array.from({ length: Math.ceil(top / 50) + 1 }, (_, i) => i * 50)} tickFormatter={(x: number) => `${x}%`} {...AX} width={44} />
        <ReferenceLine y={100} stroke="#9aa5b6" strokeDasharray="4 4" />
        <Tooltip {...TIP} formatter={(x: unknown, n: unknown) => [`${x}% of year one`, String(n)]} />
        <Legend {...LEGEND} />
        <Line dataKey="cust" name="Customers still buying in year two" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: "#fff", stroke: BLUE, strokeWidth: 2 }} isAnimationActive={false}>
          <LabelList dataKey="cust" position="bottom" offset={8} formatter={(x: unknown) => `${x}%`} style={{ ...LABEL, fontSize: 10.5, fill: BLUE, ...HALO }} />
        </Line>
        <Line dataKey="rev" name="Their revenue in year two" stroke="#d99a2b" strokeWidth={2} dot={{ r: 3, fill: "#fff", stroke: "#d99a2b", strokeWidth: 2 }} isAnimationActive={false} connectNulls>
          <LabelList dataKey="rev" position="top" offset={8} formatter={(x: unknown) => `${x}%`} style={{ ...LABEL, fontSize: 10.5, fill: "#b07a12", ...HALO }} />
        </Line>
      </ComposedChart>
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
          note="Of each year's new customers (their first order that year), the share who bought in that year only - and never again">
          <OnceChart v={v} />
        </Card>
        <Card icon={<BarChartOutlinedIcon />} tint="amber" title="Year two: fewer customers, nearly the same money" right={act?.("firstsecond", "Year two: fewer customers, nearly the same money")}
          note="Each year's new customers in their second year, against their first (the dashed line, 100%): how many still buy, and what they spend"
          foot={v.partial ? `* ${v.next} is still running: that year two is not over.` : undefined}>
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

/* ── 3 · new customers ───────────────────────────────────────────────────────── */

function NewYearsChart({ v }: { v: RetentionView }) {
  const data = v.cohorts.firstSecond.filter((r) => r.y1 > 0).map((r) => ({ cohort: r.partial ? `${r.cohort}*` : String(r.cohort), y1: r.y1, back: Math.round((r.y2 / r.y1) * 1000) / 10 }));
  // the columns in the lower half, the line above them - no label sits on another
  const top = tidy(Math.max(1, ...data.map((d) => d.y1)) * 2.1);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="34%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="cohort" {...AX} />
        <YAxis yAxisId="n" domain={[0, top]} tickFormatter={(x: number) => x.toLocaleString("en")} {...AX} width={46} />
        <YAxis yAxisId="p" orientation="right" domain={[0, 60]} ticks={[20, 40, 60]} tickFormatter={(x: number) => `${x}%`} {...AX} width={38} />
        <Tooltip {...TIP} formatter={(x: unknown, n: unknown) => [n === "New customers" ? Number(x).toLocaleString("en") : `${x}%`, String(n)]} />
        <Legend {...LEGEND} />
        <Bar yAxisId="n" dataKey="y1" name="New customers" fill={NEW} isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="y1" position="insideBottom" offset={8} formatter={(x: unknown) => Number(x).toLocaleString("en")} style={{ ...LABEL, fontSize: 10.5, fill: "#6b4a10" }} />
        </Bar>
        <Line yAxisId="p" dataKey="back" name="Bought again the year after" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: "#fff", stroke: BLUE, strokeWidth: 2 }} isAnimationActive={false}>
          <LabelList dataKey="back" position="top" offset={9} formatter={(x: unknown) => `${x}%`} style={{ ...LABEL, fontSize: 11, fill: BLUE, ...HALO }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const BUYING_DIMS = ["Orders", "Size", "Product breadth", "Cut-to-size", "Specials", "Channel", "Margin"];

export function NewTab({ v, act }: { v: RetentionView; act?: (card: string, title: string) => React.ReactNode }) {
  const n = v.newcos;
  const buying = n.rows.filter((r) => BUYING_DIMS.includes(r.dim));
  const contact = n.rows.filter((r) => !BUYING_DIMS.includes(r.dim));
  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      <Card icon={<PersonAddAltOutlinedIcon />} tint="amber" title="New customers each year - and how many came back" span right={act?.("years", "New customers each year")}
        note="Each year's new customers (their first order ever that year, EUR 100 or more) - and the share of them who bought again the year after (the line)"
        foot={v.partial ? `* ${v.next} is still running: its second year is not over.` : undefined}>
        <NewYearsChart v={v} />
      </Card>
      <Card icon={<CallSplitIcon />} tint="pink" title={`The ${n0(n.customers)} new customers of ${v.base}, step by step`} span right={act?.("flow", `The new customers of ${v.base}`)}
        note={`How many orders they placed in their first year, how much they spent, whether sales reached them - and who is back${v.partial ? ` in ${v.next} so far` : ""}`}
        foot={`${pct(n.avg, 1)} of ${v.base}'s new customers ${v.partial ? "are not back yet" : "were lost"} - against ${pct(v.leave.avg, 1)} of all customers.`}>
        <FlowChart flow={n.flow} label="New customers" />
      </Card>
      <Grid2>
        <Card icon={<ShoppingBagOutlinedIcon />} tint="green" title="How they bought in their first year" right={act?.("buying", "New customers: how they bought")}
          note={`Each group of ${v.base}'s new customers against their average (${pct(n.avg, 1)} not back)`}>
          <Diverging rows={buying} />
        </Card>
        <Card icon={<ForumOutlinedIcon />} tint="blue" title="How we reached them" right={act?.("contact", "New customers: how we reached them")}
          note={`Calls, visits, e-mails, tickets, marketing - against the new customers' average (${pct(n.avg, 1)})`}>
          <Diverging rows={contact} />
        </Card>
      </Grid2>
      <GlassCard>{groupTable(`All the figures - the new customers of ${v.base}`, n.rows, v, "New customers")}</GlassCard>
    </Box>
  );
}

/* ── 4 · why they leave ──────────────────────────────────────────────────────── */

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
        foot="Correlations, not causes - size goes with most levers: a customer with six orders is rarely a small one. Groups under 25 customers are in the table only.">
        <Diverging rows={l.rows} />
      </Card>
      <GlassCard>{groupTable("All the figures, by lever", l.rows, v, "Why they leave")}</GlassCard>
    </Box>
  );
}

/* ── 5 · the path ────────────────────────────────────────────────────────────── */

const TEAM_COLOUR: Record<string, string> = { "ESO - field sales": BLUE, "TSA - inside sales": LOST, "Back Office": TONE.good, "Former staff": DEEMPHASIS, "No team": NEW };
const ACTIVITY_DIMS = ["Calls", "Call direction", "Visits & meetings", "E-mails", "Any sales touch"];

function OwnerBubbles({ v }: { v: RetentionView }) {
  const owners = v.path.owners.filter((o) => o.touchedPct != null);
  const teams = [...new Set(owners.map((o) => o.team))];
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ top: 4, right: 24, bottom: 26, left: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="x" name="Book reached" domain={[0, 100]} tickFormatter={(x: number) => `${x}%`} {...AX}
          label={{ value: `Share of the owner's ${v.base} customers its activity reached`, position: "insideBottom", offset: -16, style: { fontSize: 11, fill: MUTED } }} />
        <YAxis type="number" dataKey="y" name="Churn of those reached" tickFormatter={(x: number) => `${x}%`} {...AX} width={44}
          label={{ value: "Not back, of those reached", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: MUTED, textAnchor: "middle" } }} />
        <ZAxis type="number" dataKey="z" range={[50, 1200]} name="Revenue reached" />
        <ReferenceLine y={Math.round(v.path.avg * 1000) / 10} stroke={RED} strokeDasharray="4 4" label={{ value: `average ${pct(v.path.avg, 1)}`, position: "insideTopRight", style: { fontSize: 10.5, fill: RED } }} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
          const p = payload?.[0]?.payload as { name?: string; team?: string; x?: number; y?: number; z?: number; touched?: number } | undefined;
          if (!p) return null;
          return (
            <Box sx={{ bgcolor: "#fff", border: "1px solid rgba(21,34,58,.1)", borderRadius: "10px", px: 1.25, py: 0.9, fontSize: "0.8rem", boxShadow: "0 6px 18px rgba(31,45,78,.08)" }}>
              <Box sx={{ fontWeight: 700, color: INK }}>{p.name} <Box component="span" sx={{ color: FAINT, fontWeight: 500 }}>· {p.team}</Box></Box>
              <Box sx={{ color: MUTED }}>{n0(p.touched)} customers reached · {p.x == null ? "—" : `${p.x}%`} of its book</Box>
              <Box sx={{ color: MUTED }}>{p.y}% not back · {eur(p.z)} revenue reached</Box>
            </Box>
          );
        }} />
        <Legend {...LEGEND} />
        {teams.map((t) => (
          <Scatter key={t} name={t} fill={TEAM_COLOUR[t] ?? NEW} fillOpacity={0.6} stroke="#fff" strokeWidth={1} isAnimationActive={false}
            data={owners.filter((o) => o.team === t).map((o) => ({ name: o.name, team: o.team, x: Math.round((o.touchedPct ?? 0) * 1000) / 10, y: o.churn == null ? null : Math.round(o.churn * 1000) / 10, z: Math.round(o.touchedRev), touched: o.touched }))} />
        ))}
      </ScatterChart>
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
      <Card icon={<BubbleChartOutlinedIcon />} tint="blue" title="The owners: book reached, and what became of it" span right={act?.("owners", "The owners: book reached")}
        note={`A bubble per owner (10 customers reached or more), sized by the ${v.base} revenue its activity reached; to the right = more of its own book reached, higher = more of them not back`}>
        <OwnerBubbles v={v} />
      </Card>
      <Grid2>
        <Card icon={<FormatListBulletedOutlinedIcon />} tint="amber" title="Calls, visits, e-mails - against the average" right={act?.("levers", "Calls, visits, e-mails against the average")}
          note="The churn of each group, the average as a line - coral above it, blue below">
          <AgainstAverage rows={p.rows.filter((r) => ACTIVITY_DIMS.includes(r.dim))} avg={p.avg} />
        </Card>
        <Card icon={<ForumOutlinedIcon />} tint="green" title="Tickets and marketing - against the average" right={act?.("tickets", "Tickets and marketing against the average")}
          note="Asked, problems, erosion outreach, marketing reach - the churn of each, the average as a line">
          <AgainstAverage rows={p.rows.filter((r) => !ACTIVITY_DIMS.includes(r.dim))} avg={p.avg} />
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

/* ── 6 · personas ────────────────────────────────────────────────────────────── */

const PERSONA_DIMS = ["Contact persona", "Business type", "Industry (APIC)", "Country", "Segment", "Sales priority"];

function TreeTile(p: { x?: number; y?: number; width?: number; height?: number; name?: string; churn?: number; cos?: number; avg?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", churn, cos } = p;
  if (width < 2 || height < 2) return null;
  const fit = (s: string, w: number, px: number) => (s.length * px > w - 14 ? `${s.slice(0, Math.max(3, Math.floor((w - 14) / px) - 1))}…` : s);
  return (
    <g>
      <rect x={x + 1.5} y={y + 1.5} width={Math.max(0, width - 3)} height={Math.max(0, height - 3)} rx={8} fill={churnTint(churn, p.avg ?? 0.4)} />
      {width > 60 && height > 30 && <text x={x + 10} y={y + 20} fontSize={12} fontWeight={700} fill={INK}>{fit(name, width, 6.6)}</text>}
      {width > 60 && height > 48 && <text x={x + 10} y={y + 37} fontSize={11.5} fill={MUTED}>{pct(churn)} not back · {n0(cos)}</text>}
    </g>
  );
}

/** A tile per group of one dimension: sized by its customers, tinted by its churn. */
function PersonaTiles({ v, dim }: { v: RetentionView; dim: string }) {
  const ps = v.personas;
  const tiles = ps.rows.filter((r) => r.dim === dim && charted(r)).map((r) => ({ name: r.group, size: r.cos, churn: r.churn, cos: r.cos, avg: ps.avg }));
  return (
    <ResponsiveContainer width="100%" height={360}>
      <Treemap data={tiles} dataKey="size" nameKey="name" isAnimationActive={false} content={<TreeTile />} />
    </ResponsiveContainer>
  );
}

/** Each segment's churn at each sales priority. */
function SegmentMatrix({ v }: { v: RetentionView }) {
  const ps = v.personas;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${PRIOS.length}, minmax(60px, 1fr))`, gap: "4px", minWidth: 480 }}>
        <Box />
        {PRIOS.map((x) => <Box key={x} sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textAlign: "center" }}>{x}</Box>)}
        {ps.matrix.map((m) => (
          <Box key={m.segment} sx={{ display: "contents" }}>
            <Box sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, alignSelf: "center" }}>{m.segment} <Box component="span" sx={{ color: FAINT, fontWeight: 500 }}>{n0(m.cos)}</Box></Box>
            {m.cells.map((c) => (
              <Box key={c.prio} title={`${m.segment}, ${c.prio}: ${n0(c.cos)} customers${c.churn == null ? "" : `, ${pct(c.churn, 1)} not back`}`}
                sx={{ height: 38, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, bgcolor: c.churn == null ? "#f4f6f9" : churnTint(c.churn, ps.avg), color: c.churn == null ? FAINT : INK }}>
                {c.churn == null ? (c.cos ? n0(c.cos) : "") : pct(c.churn)}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function PersonasTab({ v, act }: { v: RetentionView; act?: (card: string, title: string) => React.ReactNode }) {
  const [dim, setDim] = useState(PERSONA_DIMS[0]);
  const ps = v.personas;
  const rows = useMemo(() => ps.rows.filter((r) => r.dim === dim), [ps.rows, dim]);
  const aside = rows.filter((r) => !charted(r));
  const unmapped = rows.find((r) => r.group === UNMAPPED);
  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      <Card icon={<DashboardOutlinedIcon />} tint="green" title={`Who they are - ${dim.toLowerCase()}`} span right={act?.("map", "Who they are")}
        note={`A tile per group: its size = the ${v.base} customers in it, its tint = how many are not back (green below the average ${pct(ps.avg, 1)}, coral above)`}
        foot={aside.length ? <>
          {unmapped && <>Set aside: {n0(unmapped.cos)} customers whose contacts carry no named persona (HubSpot&apos;s &quot;insufficient signal&quot; - anonymous traffic, info@ addresses, one-off buyers), {pct(unmapped.churn)} not back. </>}
          {aside.filter((r) => r !== unmapped).length > 0 && <>Groups under 25 customers ({aside.filter((r) => r !== unmapped).map((r) => r.group).join(", ")}) are in the table only.</>}
        </> : undefined}>
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
        <PersonaTiles v={v} dim={dim} />
      </Card>
      <Grid2>
        <Card icon={<ViewModuleOutlinedIcon />} tint="purple" title="Segment against priority" right={act?.("matrix", "Segment against priority")}
          note="The churn of each segment at each sales priority - cells of 25 customers or more; a smaller one shows how many">
          <SegmentMatrix v={v} />
        </Card>
        <Card icon={<AlignHorizontalCenterOutlinedIcon />} tint="amber" title={`${dim} against the average`} right={act?.("levers", "Personas against the average")}
          note={`Points of churn above (right) or below (left) the average ${pct(ps.avg, 1)}`}>
          <Diverging rows={rows} />
        </Card>
      </Grid2>
      <GlassCard>{groupTable(`All the figures - ${dim.toLowerCase()}`, rows, v, "Personas")}</GlassCard>
    </Box>
  );
}

/* ── the nutshell ────────────────────────────────────────────────────────────── */

export const RETENTION_TABS = ["trend", "cohorts", "newcos", "leave", "path", "personas"] as const;
export type RetentionTab = (typeof RETENTION_TABS)[number];
export const RETENTION_TAB_NAMES: Record<RetentionTab, string> = { trend: "Retention trend", cohorts: "Cohorts & first order", newcos: "New customers", leave: "Why they leave", path: "The path", personas: "Personas" };

/** A retention chart promoted to the nutshell: its card, alone. */
export function RetentionPromoted({ tab, card, title, actions }: { tab: string; card: string; title: string; actions: React.ReactNode }) {
  const r = useRetention();
  if (!r.v) return <GlassCard><CardTitle icon={<EuroOutlinedIcon />} tint="amber" title={title} note="Reading the customers…" right={actions} /></GlassCard>;
  const v = r.v;
  const charts: Record<string, () => React.ReactNode> = {
    "trend:customers": () => <CustomersChart v={v} />, "trend:bridge": () => <BridgeChart v={v} />, "trend:lost": () => <LostRevenueChart v={v} />,
    "cohorts:heat": () => <CohortHeat v={v} />, "cohorts:once": () => <OnceChart v={v} />, "cohorts:firstsecond": () => <FirstSecondChart v={v} />,
    "newcos:years": () => <NewYearsChart v={v} />, "newcos:flow": () => <FlowChart flow={v.newcos.flow} label="New customers" />,
    "newcos:buying": () => <Diverging rows={v.newcos.rows.filter((x) => BUYING_DIMS.includes(x.dim))} />, "newcos:contact": () => <Diverging rows={v.newcos.rows.filter((x) => !BUYING_DIMS.includes(x.dim))} />,
    "leave:flow": () => <FlowChart flow={v.leave.flow} label="Why they leave" />, "leave:levers": () => <Diverging rows={v.leave.rows} />,
    "path:flow": () => <FlowChart flow={v.path.flow} height={440} label="The path" />, "path:owners": () => <OwnerBubbles v={v} />,
    "path:levers": () => <AgainstAverage rows={v.path.rows.filter((x) => ACTIVITY_DIMS.includes(x.dim))} avg={v.path.avg} />,
    "path:tickets": () => <AgainstAverage rows={v.path.rows.filter((x) => !ACTIVITY_DIMS.includes(x.dim))} avg={v.path.avg} />,
    // personas in the nutshell: by contact persona, the tab's first view
    "personas:map": () => <PersonaTiles v={v} dim={PERSONA_DIMS[0]} />, "personas:matrix": () => <SegmentMatrix v={v} />,
    "personas:levers": () => <Diverging rows={v.personas.rows.filter((x) => x.dim === PERSONA_DIMS[0])} />,
  };
  const draw = charts[`${tab}:${card}`] as (() => React.ReactNode) | undefined;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<EuroOutlinedIcon />} tint="amber" title={title} note={draw ? `Retain & grow · ${v.base} → ${v.next}${v.partial ? " so far" : ""}` : "This card is no longer on its page - Actions takes it off here."} right={actions} />
      {draw?.()}
    </GlassCard>
  );
}

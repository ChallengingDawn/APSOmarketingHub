"use client";
// LEAD GENERATION (SARCLA 18.10.2026: "I really want to understand the lead path from acquisition
// to purchase"; a lead is a new contact on a new company; every breakdown its own tab). Laid out as
// Reach and Visit: the title with its figures top right, tabs - the path, sources, months,
// countries, teams - and the Filters window (the months, the sources, the countries). The choice
// lives in the address; each card carries the tile tools (Actions). The rules are in leadsCube.ts.
// SARCLA 18.10: "we need more graphs to understand better" and the sources "as a diagram where they
// split the number" - the path and the sources each open on a flow diagram (Sankey), the months show
// what became of each month's leads and how many bought, the countries and the owners get bars.
// 19.10: "split by new leads in different and individual graphs" - a small graph per source, country,
// owner and step of the path, each one can go to the nutshell (LeadPromotedTile); the Sources diagram
// is gone (the table and "which sources buy" say it); long tables page; the buyers split into after a
// sales contact and on their own.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import CheckIcon from "@mui/icons-material/Check";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";

import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { Sankey } from "@/app/charts/Sankey";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { CHANNELS, HOWS, channelLabel, howLabel, flowOf, inWin, keep, monthly, outcomeOf, pathBy, pathOf, sumPaths, type Flow, type FlowNode, type FlowStep, type LeadFilters, type LeadRow, type LeadsData, type PathCounts } from "@/lib/marketingKpis/leadsCube";
import type { TileSpec } from "@/lib/reporting/kpiActions";
import { MONTHS, useSlow, type MkState, type MonthWindow } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { PeriodPicker, Table, change, monthsLabel, n0, ratio, withChange } from "./ExplorerKit";
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";

type Tab = "path" | "sources" | "months" | "countries" | "teams";
const TABS: { id: Tab; label: string }[] = [
  { id: "path", label: "Path" },
  { id: "sources", label: "Sources" },
  { id: "months", label: "Months" },
  { id: "countries", label: "Countries" },
  { id: "teams", label: "Teams" },
];
const FOCUS = ["Switzerland", "Germany", "Italy", "France", "Austria", "Netherlands", "Liechtenstein", "Poland"];
const eur = (n: number) => `€${Math.round(n).toLocaleString("en")}`;

/** The figures top right: the path's steps this year, against the same months a year earlier. */
function Figures({ cur, prev }: { cur: PathCounts; prev: PathCounts }) {
  const items: { label: string; icon: React.ReactNode; tint: Tint; v: number; p: number; fmt?: (n: number) => string; sub?: string }[] = [
    { label: "New leads", icon: <PersonAddAltOutlinedIcon />, tint: "blue", v: cur.companies, p: prev.companies, sub: `${n0(cur.contacts)} new contacts` },
    { label: "To sales", icon: <SupportAgentOutlinedIcon />, tint: "amber", v: cur.toSales, p: prev.toSales, sub: `${ratio(cur.toSales, cur.companies)} · ${n0(cur.viaTask)} by task, ${n0(cur.viaTicket)} by ticket` },
    { label: "Qualified", icon: <VerifiedOutlinedIcon />, tint: "purple", v: cur.qualified, p: prev.qualified, sub: `${n0(cur.notQualified)} not, ${n0(cur.notYet)} not yet` },
    { label: "New customers", icon: <ShoppingCartOutlinedIcon />, tint: "green", v: cur.customers, p: prev.customers, sub: ratio(cur.customers, cur.companies) + " of the leads" },
    { label: "Their revenue", icon: <EuroOutlinedIcon />, tint: "green", v: cur.rev, p: prev.rev, fmt: eur, sub: `${n0(cur.orders)} orders` },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(120px, 168px))" } }}>
      {items.map((it) => {
        const d = it.p ? (it.v / it.p - 1) * 100 : null;
        return (
          <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Badge icon={it.icon} tint={it.tint} size={22} />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{it.label}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{(it.fmt ?? n0)(it.v)}</Typography>
              {d != null && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: Math.abs(d) < 0.05 ? FAINT : d > 0 ? GREEN : RED }}>{d > 0 ? "+" : d < 0 ? "−" : "±"}{Math.abs(d).toFixed(1)}%</Typography>}
            </Box>
            <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}{it.p ? ` · a year earlier ${(it.fmt ?? n0)(it.p)}` : ""}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/** The path as bars: each step against the leads it started from, this year and a year earlier. */
function PathCard({ cur, prev, w, year, actions }: { cur: PathCounts; prev: PathCounts; w: MonthWindow; year: number; actions: React.ReactNode }) {
  const steps: { label: string; note: string; v: number; p: number; tint: Tint }[] = [
    { label: "New leads", note: "new companies, with their first new contact", v: cur.companies, p: prev.companies, tint: "blue" },
    { label: "Handed to sales", note: `a UC2 qualification task (until 1 October) or an ESO/TSA ticket after they came in · ${n0(cur.viaTask)} by task, ${n0(cur.viaTicket)} by ticket`, v: cur.toSales, p: prev.toSales, tint: "amber" },
    { label: "Qualified by the owner", note: `${n0(cur.notQualified)} not qualified, ${n0(cur.notYet)} not yet${cur.taskDoneNoAnswer ? ` (${n0(cur.taskDoneNoAnswer)} of them with the task done but no answer on the company)` : ""}`, v: cur.qualified, p: prev.qualified, tint: "purple" },
    { label: "New customers", note: "their first order", v: cur.customers, p: prev.customers, tint: "green" },
    { label: "… of them on their own", note: "ordered before any UC2 task or ESO/TSA ticket", v: cur.onOwn, p: prev.onOwn, tint: "green" },
  ];
  const top = Math.max(cur.companies, prev.companies, 1);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5 }}>
      <CardTitle icon={<AltRouteIcon />} tint="blue" title="From acquisition to purchase" note={`${monthsLabel(w)} ${year} against ${monthsLabel(w)} ${year - 1} - new companies that came in, and what became of them`} right={actions} />
      <Box sx={{ display: "grid", gap: 1.5 }}>
        {steps.map((s) => (
          <Box key={s.label} sx={{ display: "grid", gap: 0.5, gridTemplateColumns: { xs: "1fr", md: "260px minmax(0, 1fr) 150px" }, alignItems: "center" }}>
            <Box>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{s.label}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{s.note}</Typography>
            </Box>
            <Box sx={{ display: "grid", gap: 0.4 }}>
              <Box sx={{ height: 16, borderRadius: 99, bgcolor: TINT[s.tint].fg, width: `${(s.v / top) * 100}%`, minWidth: 4 }} />
              <Box sx={{ height: 8, borderRadius: 99, bgcolor: "#d3d8e0", width: `${(s.p / top) * 100}%`, minWidth: 4 }} />
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{n0(s.v)} <Box component="span" sx={{ fontSize: "0.76rem", color: FAINT, fontWeight: 600 }}>{s.label === "New leads" ? "" : ratio(s.v, cur.companies)}</Box></Typography>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>a year earlier {n0(s.p)} {(() => { const c = change(s.v, s.p); return c ? <Box component="span" sx={{ color: c.color, fontWeight: 700 }}>{c.text}</Box> : null; })()}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Orders and revenue of the new customers: {n0(cur.orders)} orders, {eur(cur.rev)} (a year earlier {n0(prev.orders)}, {eur(prev.rev)}). A lead is a company new in HubSpot with its first new contact; counted per company, so three new people at one company are one lead.
      </Typography>
    </GlassCard>
  );
}

const head = ["", "Leads", "To sales", "Qualified", "New customers", "Conversion", "On their own", "Revenue"];
function rowCells(label: React.ReactNode, e: { cur: PathCounts; prev: PathCounts }) {
  const c = e.cur;
  return [label, withChange(n0(c.companies), change(c.companies, e.prev.companies)), n0(c.toSales), n0(c.qualified), withChange(n0(c.customers), change(c.customers, e.prev.customers)), ratio(c.customers, c.companies), n0(c.onOwn), eur(c.rev)];
}

/* ── the flow diagram ─────────────────────────────────────────────────── */

const STEP_NAME: Record<FlowStep, string> = { all: "New leads", how: "Came in by", source: "Source", contact: "Sales contact", qualification: "Owner's qualification", outcome: "Outcome" };
const TONE: Record<FlowNode["tone"], string> = { source: SERIES[0], sales: SERIES[3], good: SERIES[2], own: SERIES[0], bad: SERIES[1], none: DEEMPHASIS };

function FlowCard({ flow, title, note, actions, height }: { flow: Flow; title: string; note: string; actions: React.ReactNode; height: number }) {
  const label = new Map(flow.nodes.map((n) => [n.id, n.label]));
  const twin = { columns: ["From", "To", "Leads", "Share of from"], rows: flow.links.map((l) => [label.get(l.from) ?? l.from, label.get(l.to) ?? l.to, l.value, ratio(l.value, flow.totals[l.from])]), numeric: [2, 3] };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<AltRouteIcon />} tint="blue" title={title} note={note} right={actions} />
      <ChartFrame table={twin} empty={flow.nodes.length ? null : "No new leads for this choice."}>
        {/* the diagram needs its width: on a phone it scrolls inside the card, the page does not */}
        <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
          <Box sx={{ minWidth: 760 }}>
            <Sankey height={height} columns={flow.steps.map((s) => STEP_NAME[s])} label={title}
              nodes={flow.nodes.map((n) => ({ id: n.id, column: flow.steps.indexOf(n.step), label: n.label, color: TONE[n.tone] }))} links={flow.links} />
          </Box>
        </Box>
      </ChartFrame>
    </GlassCard>
  );
}

const pct = (v: number | null) => (v == null ? "—" : `${Number.isInteger(v) ? v : v.toFixed(1)}%`);

/* ── small graphs: a tile per source, country, owner or step of the path (SARCLA 19.10) ── */

type TileTab = "sources" | "countries" | "teams" | "months";
type Measure = "leads" | "toSales" | "qualified" | "customers" | "conversion";
const MEASURE: Record<Measure, { label: string; unit: string; of: (p: PathCounts) => number | null; pct?: boolean }> = {
  leads: { label: "New leads", unit: "new leads", of: (p) => p.companies },
  toSales: { label: "Handed to sales", unit: "to sales", of: (p) => p.toSales },
  qualified: { label: "Qualified by the owner", unit: "qualified", of: (p) => p.qualified },
  customers: { label: "New customers", unit: "new customers", of: (p) => p.customers },
  conversion: { label: "Leads that bought", unit: "bought", of: (p) => (p.companies ? (p.customers / p.companies) * 100 : null), pct: true },
};
const TILE_GRID = "repeat(auto-fill, minmax(min(100%, 228px), 1fr))";
const TAB_TINT: Record<TileTab, Tint> = { sources: "amber", countries: "green", teams: "purple", months: "blue" };
const tabIcon = (t: TileTab) => (t === "sources" ? <AltRouteIcon /> : t === "countries" ? <PublicOutlinedIcon /> : t === "teams" ? <GroupsOutlinedIcon /> : <TimelineOutlinedIcon />);
const ownerLabel = (d: LeadsData, o: string) => (o ? d.owners[o] ?? `Owner ${o}` : "No owner");

/** What a tile shows, from its tab and id - the same on the page and in the nutshell. */
function tileOf(d: LeadsData, tab: TileTab, id: string): { title: string; measure: Measure; pick: (r: LeadRow) => boolean } {
  switch (tab) {
    case "sources": return { title: channelLabel(id), measure: "leads", pick: (r) => r.c === id };
    case "countries": return { title: id, measure: "leads", pick: (r) => r.k === id };
    case "teams": return { title: ownerLabel(d, id), measure: "leads", pick: (r) => r.o === id };
    case "months": {
      const m = (id in MEASURE ? id : "leads") as Measure;
      return { title: MEASURE[m].label, measure: m, pick: () => true };
    }
  }
}
const tileKey = (tab: TileTab, id: string) => `lead:${tab}:tile:${id}`;
const tileTitle = (tab: TileTab, title: string) => (tab === "months" ? `${title} by month` : `New leads - ${title}`);

/** One small graph, drawn as the nutshell's KPI tiles: name, figure, change, its months, a line under. */
function LeadTile({ tab, title, measure, d, f, pick, win, actions }: {
  tab: TileTab; title: string; measure: Measure; d: LeadsData; f: LeadFilters; pick: (r: LeadRow) => boolean; win: MonthWindow; actions?: React.ReactNode;
}) {
  const m = MEASURE[measure];
  const { cy, py } = monthly(d, f, pick);
  const cur = sumPaths(cy.slice(win.start, win.end + 1)), prev = sumPaths(py.slice(win.start, win.end + 1));
  const v = m.of(cur), p = m.of(prev);
  const fmt = (x: number | null) => (m.pct ? pct(x == null ? null : Math.round(x * 10) / 10) : n0(x));
  const delta = m.pct
    ? (v != null && p != null ? { text: `${v - p > 0 ? "↑" : v - p < 0 ? "↓" : "±"} ${Math.abs(v - p).toFixed(1)} pts`, color: v - p > 0.05 ? GREEN : v - p < -0.05 ? RED : MUTED } : null)
    : change(v, p);
  const months = cy.map((x, i) => (i <= d.monthsDone - 1 ? m.of(x) : null)), last = py.map((x) => m.of(x));
  const max = Math.max(0, ...months.map((x) => x ?? 0), ...last.map((x) => x ?? 0)) || 1;
  const h = (x: number | null) => (!x ? 0 : Math.max(3, (x / max) * 100));
  const foot = measure === "leads" ? `${ratio(cur.customers, cur.companies)} bought · ${ratio(cur.toSales, cur.companies)} to sales` : `of ${n0(cur.companies)} new leads`;
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "flex", flexDirection: "column", gap: 1.1, minWidth: 0, height: "100%", boxSizing: "border-box" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0 }}>
        <Badge icon={tabIcon(tab)} tint={TAB_TINT[tab]} size={32} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25, flex: 1, minWidth: 0, pt: 0.75 }}>{title}</Typography>
        {actions}
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{m.unit} · {monthsLabel(win)}</Typography>
      </Box>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: delta?.color ?? FAINT }}>{delta ? `${delta.text} vs ${d.year - 1}` : `none in ${monthsLabel(win)} ${d.year - 1}`}</Typography>
      <Box sx={{ mt: "auto", pt: 0.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px", alignItems: "end", height: 72 }} role="img"
          aria-label={`${title}, ${m.unit} by month: ${months.map((x, i) => (x == null ? null : `${MONTHS[i]} ${fmt(x)}`)).filter(Boolean).join(", ")}`}>
          {MONTHS.map((mo, i) => (
            <Box key={mo} title={`${mo} ${d.year}: ${fmt(months[i])}${last[i] != null ? ` · ${d.year - 1}: ${fmt(last[i])}` : ""}`}
              sx={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              {!!last[i] && <Box sx={{ position: "absolute", bottom: 0, left: "8%", right: "8%", height: `${h(last[i])}%`, bgcolor: "#dfe3ea", borderRadius: "3px 3px 0 0" }} />}
              {months[i] != null && <Box sx={{ position: "relative", width: "62%", height: `${h(months[i])}%`, bgcolor: "#2d6fa8", opacity: i < win.start || i > win.end ? 0.35 : 1, borderRadius: "3px 3px 0 0" }} />}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "4px", mt: 0.4 }}>
          {MONTHS.map((mo) => <Typography key={mo} sx={{ fontSize: "0.62rem", color: FAINT, textAlign: "center" }}>{mo[0]}</Typography>)}
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: FAINT, borderTop: "1px solid rgba(21,34,58,.07)", pt: 0.75 }}>{foot}</Typography>
    </Box>
  );
}

/** A long table a page at a time, with "1-10 of 54" and the way back and on under it. */
function Paged<T>({ items, size = 10, children }: { items: T[]; size?: number; children: (rows: T[]) => React.ReactNode }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size)), at = Math.min(page, pages - 1);
  return (
    <>
      {children(items.slice(at * size, at * size + size))}
      {pages > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
          <Typography sx={{ fontSize: "0.78rem", color: FAINT, fontVariantNumeric: "tabular-nums" }}>{at * size + 1}–{Math.min(items.length, (at + 1) * size)} of {items.length}</Typography>
          <Button size="small" disabled={at === 0} onClick={() => setPage(at - 1)} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Previous</Button>
          <Button size="small" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Next</Button>
        </Box>
      )}
    </>
  );
}

// The nutshell's lead tiles share one read of the leads (the answer is ~1 MB - not once per tile).
const shared: { v: LeadsData | null; p: Promise<void> | null; subs: Set<() => void> } = { v: null, p: null, subs: new Set() };
function loadShared() {
  if (shared.p) return;
  shared.p = fetch("/api/reporting/marketing-kpis/leads")
    .then((r) => r.json())
    .then((j) => { const v = j?.leads?.value as LeadsData | undefined; if (v) shared.v = v; })
    .catch(() => {})
    .finally(() => {
      shared.p = null;
      shared.subs.forEach((f) => f());
      // still being read: ask again in a while, as long as a tile is on the screen
      if (!shared.v) setTimeout(() => { if (shared.subs.size) loadShared(); }, 20_000);
    });
}
function useSharedLeads(): LeadsData | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    shared.subs.add(f);
    if (!shared.v) loadShared();
    return () => { shared.subs.delete(f); };
  }, []);
  return shared.v;
}

/** A lead tile promoted to the nutshell: drawn from its key, with the filters and months it was promoted with. */
export function LeadPromotedTile({ spec, actions }: { spec: TileSpec; actions: React.ReactNode }) {
  const d = useSharedLeads();
  const parts = spec.key.split(":");
  const tab = parts[1] as TileTab, id = parts.slice(3).join(":");
  if (!d || !["sources", "countries", "teams", "months"].includes(tab)) {
    return (
      <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, minWidth: 0, display: "grid", gap: 1, alignContent: "start" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, flex: 1, pt: 0.75 }}>{spec.title}</Typography>
          {actions}
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>Reading the leads…</Typography>
      </Box>
    );
  }
  const done = d.monthsDone, from = Number(spec.from), to = Number(spec.to);
  const win: MonthWindow = from >= 1 && to >= from && to <= done ? { start: from - 1, end: to - 1 } : { start: 0, end: Math.max(0, done - 1) };
  const ff = spec.filters ?? {};
  const t = tileOf(d, tab, id);
  return <LeadTile tab={tab} title={t.title} measure={t.measure} d={d} f={{ channel: ff.source, country: ff.country, how: ff.how }} pick={t.pick} win={win} actions={actions} />;
}

export function LeadExplorer({ state }: { state: MkState | null }) {
  const params = useSearchParams();
  const ld = useSlow<LeadsData>("/api/reporting/marketing-kpis/leads", "leads");
  const d = ld.value;
  const year = d?.year ?? new Date().getFullYear();
  const done = d?.monthsDone ?? state?.live?.value?.monthsDone ?? new Date().getMonth();
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "path"));
  const [channels, setChannels] = useState<string[]>(() => params.getAll("source"));
  const [countries, setCountries] = useState<string[]>(() => params.getAll("country"));
  const [hows, setHows] = useState<string[]>(() => params.getAll("how").filter((h) => HOWS.some((x) => x.id === h)));
  const [chosenWin, setChosenWin] = useState<MonthWindow | null>(() => {
    const f = Number(params.get("from")), t = Number(params.get("to"));
    return f >= 1 && t >= f && t <= 12 ? { start: f - 1, end: t - 1 } : null;
  });
  const win: MonthWindow = chosenWin && chosenWin.end < Math.max(1, done) ? chosenWin : { start: 0, end: Math.max(0, done - 1) };
  const isDefault = win.start === 0 && win.end === Math.max(0, done - 1);
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState<{ period?: boolean; source?: boolean; country?: boolean; how?: boolean }>({});

  // the view lives in the address: a choice can be sent on and saved as a view
  useEffect(() => {
    const q = new URLSearchParams();
    if (tab !== "path") q.set("tab", tab);
    if (!isDefault) { q.set("from", String(win.start + 1)); q.set("to", String(win.end + 1)); }
    for (const c of channels) q.append("source", c);
    for (const c of countries) q.append("country", c);
    for (const h of hows) q.append("how", h);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [tab, win.start, win.end, isDefault, channels, countries, hows]);

  const f: LeadFilters = { channel: channels, country: countries, how: hows };
  const path = useMemo(() => (d ? pathOf(d, win, f) : null), [d, win.start, win.end, channels, countries, hows]); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const chosenCount = channels.length + countries.length + hows.length + (isDefault ? 0 : 1);
  const filters = { ...(channels.length ? { source: channels } : {}), ...(countries.length ? { country: countries } : {}), ...(hows.length ? { how: hows } : {}) };
  const act = (key: string, title: string) => (
    <TileActions where="tab" start="tab" tile={{ key: `lead:${tab}:${key}`, page: "lead", tab, title, summary: path ? `${n0(path.cur.companies)} new leads, ${n0(path.cur.customers)} new customers, ${monthsLabel(win)} ${year}` : undefined, filters, ...(isDefault ? {} : { from: String(win.start + 1), to: String(win.end + 1) }), kind: "card" }} />
  );

  const countryRows = useMemo(() => (d ? [...pathBy(d, win, f, (r) => r.k).entries()].sort((a, b) => (FOCUS.includes(b[0]) ? 1 : 0) - (FOCUS.includes(a[0]) ? 1 : 0) || b[1].cur.companies - a[1].cur.companies) : []), [d, win.start, win.end, channels, countries, hows]); // eslint-disable-line react-hooks/exhaustive-deps
  const countryOptions = useMemo(() => (d ? [...new Set(d.rows.map((r) => r.k))].sort((a, b) => (FOCUS.includes(b) ? 1 : 0) - (FOCUS.includes(a) ? 1 : 0) || a.localeCompare(b)) : []), [d]);
  const pathFlow = useMemo(() => (d ? flowOf(d, win, f, ["how", "contact", "qualification", "outcome"]) : null), [d, win.start, win.end, channels, countries, hows]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d || !path || !pathFlow) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!ld.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: ld.error ? RED : MUTED }}>{ld.error ? `Could not load: ${ld.error}` : `Reading the new contacts and their companies…${ld.progress ? ` ${ld.progress}` : ""} The first read takes a few minutes.`}</Typography>
      </Box></GlassCard>
    );
  }

  const bySource = pathBy(d, win, f, (r) => r.c);
  const byOwner = [...pathBy(d, win, f, (r) => r.o).entries()].sort((a, b) => b[1].cur.companies - a[1].cur.companies);
  const byMonth = pathBy(d, { start: 0, end: 11 }, f, (r) => r.m.slice(5, 7));
  const monthData = MONTHS.map((x, i) => {
    const e = byMonth.get(String(i + 1).padStart(2, "0"));
    const inCur = i <= done - 1;
    return { x, current: inCur ? e?.cur.companies ?? 0 : null, prior: e?.prev.companies ?? 0, partial: false };
  });
  // what became of each month's leads so far, this year
  const outcomeData = MONTHS.slice(0, Math.max(1, done)).map((x, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}`;
    const o = { x, customer: 0, notQualified: 0, qualified: 0, open: 0 };
    for (const r of d.rows) if (r.m === m && keep(r, f)) o[outcomeOf(r)] += 1;
    return o;
  });
  const convData = MONTHS.map((x, i) => {
    const e = byMonth.get(String(i + 1).padStart(2, "0"));
    const c = (p?: PathCounts) => (p && p.companies ? (p.customers / p.companies) * 100 : null);
    return { x, current: i <= done - 1 ? c(e?.cur) : null, prior: c(e?.prev), partial: false };
  });
  // conversion by source - the sources with at least 20 leads, best first
  const sourceConv = CHANNELS.flatMap((c) => { const e = bySource.get(c.id); return e && e.cur.companies >= 20 ? [{ id: c.id, label: c.label, value: (e.cur.customers / e.cur.companies) * 100, secondary: `${n0(e.cur.customers)} of ${n0(e.cur.companies)}` }] : []; }).sort((a, b) => b.value - a.value);
  // the leads with sales that the owner has not qualified yet, by owner
  const waiting = new Map<string, { n: number; of: number }>();
  for (const r of d.rows) {
    if (!r.s || !keep(r, f) || !inWin(r.m, d.year, win)) continue;
    const e = waiting.get(r.o) ?? { n: 0, of: 0 };
    e.of += 1;
    if (r.q == null) e.n += 1;
    waiting.set(r.o, e);
  }
  const ownerName = (o: string) => ownerLabel(d, o);
  const waitingRows = [...waiting.entries()].filter(([, e]) => e.n > 0).sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([o, e]) => ({ label: ownerName(o), value: e.n, secondary: `of ${n0(e.of)} with sales` }));
  const tile = (t: TileTab, id: string) => {
    const x = tileOf(d, t, id), key = tileKey(t, id);
    return (
      <LeadTile key={key} tab={t} title={x.title} measure={x.measure} d={d} f={f} pick={x.pick} win={win}
        actions={<TileActions where="tab" start="tab" edge={2.25} tile={{ key, page: "lead", tab: t, title: tileTitle(t, x.title), summary: `${monthsLabel(win)} ${year}`, filters, ...(isDefault ? {} : { from: String(win.start + 1), to: String(win.end + 1) }), kind: "card" }} />} />
    );
  };
  const tiles = (t: TileTab, ids: string[]) => <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: TILE_GRID }}>{ids.map((id) => tile(t, id))}</Box>;
  const sourceIds = CHANNELS.filter((c) => bySource.has(c.id)).sort((a, b) => bySource.get(b.id)!.cur.companies - bySource.get(a.id)!.cur.companies).map((c) => c.id);
  // the focus markets first, then the biggest - twelve; the rest are in the table
  const countryIds = countryRows.slice(0, 12).map(([k]) => k);
  const ownerIds = byOwner.filter(([o]) => o).slice(0, 12).map(([o]) => o);

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            Lead Generation
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{monthsLabel(win)} {year}</b> against the same months of {year - 1} · new contacts on new companies, and their path to the first order{ld.computing ? " · reading HubSpot again" : ""}
          </Typography>
          {chosenCount > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {!isDefault && <Chip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg }} />}
              {channels.map((c) => <Chip key={c} size="small" label={<span><b>Source:</b> {channelLabel(c)}</span>} onDelete={() => setChannels(flip(channels, c))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.amber.bg }} />)}
              {hows.map((h) => <Chip key={h} size="small" label={<span><b>Came in:</b> {howLabel(h)}</span>} onDelete={() => setHows(flip(hows, h))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.purple.bg }} />)}
              {countries.map((c) => <Chip key={c} size="small" label={<span><b>Country:</b> {c}</span>} onDelete={() => setCountries(flip(countries, c))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.green.bg }} />)}
              <Button size="small" onClick={() => { setChannels([]); setCountries([]); setHows([]); setChosenWin(null); }} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><Figures cur={path.cur} prev={path.prev} /></Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
          <ReportTabs name="lead" tab={tab} onSelect={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="lead" /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="lead-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      {tab === "path" && (
        <>
          <FlowCard flow={pathFlow} height={340} title="How the leads split" actions={act("flow", "How the leads split")}
            note={`${monthsLabel(win)} ${year} · every new lead by how it came in, then step by step: did sales get it (a UC2 task or an ESO/TSA ticket), did the owner qualify it, did it buy - after a sales contact, or on their own before any task or ticket · UC2 only picks up shop registrations, so the contacts sales and service add themselves get no UC2 task · hover a band for its count`} />
          <PathCard cur={path.cur} prev={path.prev} w={win} year={year} actions={act("path", "From acquisition to purchase")} />
        </>
      )}

      {tab === "sources" && (
        <GlassCard sx={{ display: "grid", gap: 1.5 }}>
          <CardTitle icon={<AltRouteIcon />} tint="amber" title="New leads by source" note={`${monthsLabel(win)} ${year} against ${year - 1}, month by month · each one can go to the nutshell (Actions)`} />
          {tiles("sources", sourceIds)}
        </GlassCard>
      )}

      {tab === "sources" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<ShoppingCartOutlinedIcon />} tint="green" title="Which sources buy" note={`${monthsLabel(win)} ${year} · the share of each source's new leads that placed an order · sources with 20 leads or more · click one to filter by it`} right={act("conversion", "Which sources buy")} />
          <ChartFrame table={{ columns: ["Source", "Bought", "New customers"], rows: sourceConv.map((r) => [r.label, pct(r.value), r.secondary]), numeric: [1] }}>
            <BarList rows={sourceConv} format={pct} labelWidth={240} onSelect={(l) => { const c = CHANNELS.find((x) => x.label === l); if (c) setChannels(flip(channels, c.id)); }} selectedLabel={channels.length === 1 ? channelLabel(channels[0]) : null} />
          </ChartFrame>
        </GlassCard>
      )}

      {tab === "sources" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<AltRouteIcon />} tint="amber" title="Where the leads came from" note={`${monthsLabel(win)} ${year} · the original source of each new company's first new contact · click a source to filter by it`} right={act("sources", "Where the leads came from")} />
          <Table head={["Source", ...head.slice(1)]} rows={CHANNELS.filter((c) => bySource.has(c.id)).map((c) => ({ key: c.id, on: channels.includes(c.id), onPick: () => setChannels(flip(channels, c.id)), cells: rowCells(c.label, bySource.get(c.id)!) }))} />
          <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>HubSpot&apos;s original source of the contact. &quot;Created by people&quot; are contacts entered by sales or service, &quot;Chat&quot; those from the website chat; SEA is split by search engine (Bing = Microsoft Ads). The change is against the same months of {year - 1}.</Typography>
        </GlassCard>
      )}

      {tab === "months" && (
        <GlassCard sx={{ display: "grid", gap: 1.5 }}>
          <CardTitle icon={<TimelineOutlinedIcon />} tint="blue" title="The path, month by month" note={`${monthsLabel(win)} ${year} against ${year - 1} · each one can go to the nutshell (Actions)`} />
          {tiles("months", ["leads", "toSales", "qualified", "customers", "conversion"])}
        </GlassCard>
      )}

      {tab === "months" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<TimelineOutlinedIcon />} tint="blue" title="New leads by month" note={`Every month of ${year} against ${year - 1}${channels.length || countries.length ? " · the sources and countries chosen" : ""}`} right={act("months", "New leads by month")} />
          <ChartFrame table={{ columns: ["Month", String(year), String(year - 1)], rows: monthData.map((m) => [m.x, m.current ?? "", m.prior]), numeric: [1, 2] }}>
            <GroupedColumns height={220} format={(x) => n0(x)} data={monthData} currentLabel={String(year)} priorLabel={String(year - 1)} />
          </ChartFrame>
          <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, mt: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>What became of each month&apos;s leads</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: FAINT, mb: 1 }}>{year}, so far - the newest months have had the least time</Typography>
              <ChartFrame table={{ columns: ["Month", "New customer", "Not qualified", "Qualified, no order yet", "Not qualified yet"], rows: outcomeData.map((o) => [o.x, o.customer, o.notQualified, o.qualified, o.open]), numeric: [1, 2, 3, 4] }}>
                <StackedColumns height={240} format={(v) => n0(v)} data={outcomeData}
                  parts={[{ key: "customer", label: "New customer" }, { key: "notQualified", label: "Not qualified" }, { key: "qualified", label: "Qualified, no order yet" }, { key: "open", label: "Not qualified yet" }]} />
              </ChartFrame>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>How many bought</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: FAINT, mb: 1 }}>The share of each month&apos;s new leads with an order, {year} against {year - 1} - {year - 1}&apos;s leads have had a year longer</Typography>
              <ChartFrame table={{ columns: ["Month", String(year), String(year - 1)], rows: convData.map((m) => [m.x, pct(m.current), pct(m.prior)]), numeric: [1, 2] }}>
                <GroupedColumns height={240} format={pct} data={convData} currentLabel={String(year)} priorLabel={String(year - 1)} />
              </ChartFrame>
            </Box>
          </Box>
          <Table head={["Month", ...head.slice(1)]} rows={MONTHS.slice(0, Math.max(1, done)).map((m, i) => {
            const e = byMonth.get(String(i + 1).padStart(2, "0")) ?? { cur: pathOf({ ...d, rows: [] }, win, f).cur, prev: pathOf({ ...d, rows: [] }, win, f).prev };
            return { key: m, cells: rowCells(m, e) };
          })} />
        </GlassCard>
      )}

      {tab === "countries" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<PublicOutlinedIcon />} tint="green" title="New leads by country" note={`${monthsLabel(win)} ${year} · our focus markets first · click a country to filter by it`} right={act("countries", "New leads by country")} />
          {tiles("countries", countryIds)}
          <Paged items={countryRows} size={10}>
            {(rows) => <Table head={["Country", ...head.slice(1)]} rows={rows.map(([k, e]) => ({ key: k, on: countries.includes(k), onPick: () => setCountries(flip(countries, k)), cells: rowCells(k, e) }))} />}
          </Paged>
        </GlassCard>
      )}

      {tab === "teams" && (
        <GlassCard sx={{ display: "grid", gap: 1.25 }}>
          <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="New leads by owner" note={`${monthsLabel(win)} ${year} · the company's owner in HubSpot today, the twelve with the most new leads as graphs`} right={act("teams", "New leads by owner")} />
          {tiles("teams", ownerIds)}
          <Box>
            <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>Waiting for the owner&apos;s qualification</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: FAINT, mb: 1 }}>Leads sent to sales (a UC2 task or an ESO/TSA ticket) with no answer yet in &quot;Qualified by company owner&quot;</Typography>
            <ChartFrame table={{ columns: ["Owner", "Not qualified yet", "With sales"], rows: waitingRows.map((r) => [r.label, r.value, r.secondary]), numeric: [1] }}>
              <BarList rows={waitingRows} format={(v) => n0(v)} labelWidth={200} emptyMessage="Every lead with sales has its qualification." />
            </ChartFrame>
          </Box>
          <Paged items={byOwner} size={15}>
            {(rows) => <Table head={["Owner", "Leads", "To sales", "Qualified", "Not qualified", "Not yet", "New customers", "Revenue"]} rows={rows.map(([o, e]) => ({ key: o || "none", cells: [ownerName(o), withChange(n0(e.cur.companies), change(e.cur.companies, e.prev.companies)), n0(e.cur.toSales), n0(e.cur.qualified), n0(e.cur.notQualified), n0(e.cur.notYet), n0(e.cur.customers), eur(e.cur.rev)] }))} />}
          </Paged>
        </GlassCard>
      )}

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot - new contacts, their companies, the companies&apos; UC2 qualification tasks and ESO and TSA tickets - {d.readAt ? `last read ${new Date(d.readAt).toLocaleString("en-GB")}` : ""}, every 6 hours.
        {Object.keys(d.errors).length > 0 && <Box component="span" sx={{ color: RED }}> Not everything could be read: {Object.keys(d.errors).join(", ")}.</Box>}
      </Typography>

      <FilterPanel id="lead-filters" open={panel} onClose={() => setPanel(false)} subtitle="The months, the sources, how they came in, the countries" onClearAll={chosenCount ? () => { setChannels([]); setCountries([]); setHows([]); setChosenWin(null); } : undefined}>
        <FilterSection id="lead-f-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={!!open.period} onFlip={() => setOpen((o) => ({ ...o, period: !o.period }))} summary={monthsLabel(win)} chosen={!isDefault}>
          <PeriodPicker done={done} win={win} onChange={(x) => setChosenWin(x)} />
        </FilterSection>
        <FilterSection id="lead-f-source" index={1} title="Source" icon={<AltRouteIcon />} tint="amber" open={!!open.source} onFlip={() => setOpen((o) => ({ ...o, source: !o.source }))} summary={channels.length ? `${channels.length} chosen` : "All"} chosen={channels.length > 0}>
          {CHANNELS.map((c) => <Pick key={c.id} on={channels.includes(c.id)} label={c.label} onClick={() => setChannels(flip(channels, c.id))} />)}
        </FilterSection>
        <FilterSection id="lead-f-how" index={2} title="How they came in" icon={<PersonAddAltOutlinedIcon />} tint="purple" open={!!open.how} onFlip={() => setOpen((o) => ({ ...o, how: !o.how }))} summary={hows.length ? `${hows.length} chosen` : "All"} chosen={hows.length > 0}>
          {HOWS.map((h) => <Pick key={h.id} on={hows.includes(h.id)} label={h.label} onClick={() => setHows(flip(hows, h.id))} />)}
        </FilterSection>
        <FilterSection id="lead-f-country" index={3} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!!open.country} onFlip={() => setOpen((o) => ({ ...o, country: !o.country }))} summary={countries.length ? `${countries.length} chosen` : "All"} chosen={countries.length > 0}>
          {countryOptions.map((c) => <Pick key={c} on={countries.includes(c)} label={c} note={FOCUS.includes(c) ? "focus market" : undefined} onClick={() => setCountries(flip(countries, c))} />)}
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}

function Pick({ on, label, note, onClick }: { on: boolean; label: string; note?: string; onClick: () => void }) {
  return (
    <Box component="button" type="button" onClick={onClick} aria-pressed={on}
      sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", border: 0, bgcolor: on ? TINT.blue.bg : "transparent", font: "inherit", textAlign: "left", px: 1, py: 0.6, borderRadius: "10px", cursor: "pointer", "&:hover": { bgcolor: on ? TINT.blue.bg : "rgba(21,34,58,.04)" } }}>
      <Box sx={{ width: 18, height: 18, borderRadius: "6px", border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.fg : "#fff", display: "grid", placeItems: "center" }}>{on && <CheckIcon sx={{ fontSize: 14, color: "#fff" }} />}</Box>
      <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1 }}>{label}</Typography>
      {note && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>{note}</Typography>}
    </Box>
  );
}

"use client";
// THE ESO TICKETS PAGES - Incoming tickets and System tickets (SARCLA 29.10.2026: "work on ESO Reports > Tickets", rebuilt
// like Visits; 30.10.2026 on the live page: "ticket should be split in 2 apps - Incoming Ticket and System tickets", "put
// diagram paths like in Digital Growth to follow the patterns", "the deviation [= from where they come, how we handle them
// by time and types of activity] and win rate per use case", "if the ticket was closed without any activity", "order rate
// - call it win rate", "all tables ... should be graphs", "the figures take out" - the potential and the figure cards -,
// "inspire yourself on Digital Growth to bring freshness and readability"). One page per group, as Hand-over to ESO/TSA and
// UC hand-overs are two: the path diagram first, then a tab per question, every figure a graph. The rows and their rules:
// src/lib/reporting/ticketsRules.ts.

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, TINT, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { everyWhileSeen } from "@/app/reporting/marketing-kpis/data";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, placementOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { Sankey } from "@/app/charts/Sankey";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import type { SlowState } from "@/lib/integrations/slowReport";
import { OUTCOMES } from "@/lib/marketingKpis/handoverCube";
import { PRIO_BANDS } from "@/lib/reporting/esoRules";
import {
  CHANNEL_ORDER, FIRST, LOST_IDS, PY_MIN, SPEEDS, blank, comparable, flowOf, inDayOf, labelOf, lostLabel, median, quietOf, rateOf, rowsOf, statsBy,
  type TDim, type TFilters, type TFlowNode, type TGroup, type TStats, type TWin, type TicketsData,
} from "@/lib/reporting/ticketsRules";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  ChartBox, H1, KEPT, KEPT_LEAD, Leaderboard, NoLeadYet, TARGET, TWO, asLead, asTeam, axisWidth, leadOf, niceTop, setQuery, useLead, useLeads, useTeam,
  type BoardRow, type LeadKey, type TeamKey,
} from "./Figures";

/* ── the read ──────────────────────────────────────────────────────────── */

function useTickets(): { d: TicketsData | null; computing: boolean; progress?: string; error?: string } {
  const [st, setSt] = useState<{ state?: SlowState<TicketsData>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-tickets").then((r) => r.json())
      .then((j: { state?: SlowState<TicketsData>; error?: string }) => {
        if (!alive) return;
        // the same read again (back to the window, the 10-minute look) is kept as it is: nothing drawn again
        setSt((was) => (was?.state?.value && j.state?.value && was.state.value.generatedAt === j.state.value.generatedAt && !!was.state.computing === !!j.state.computing ? was : j));
        timer = j.state?.computing ? setTimeout(() => { timer = undefined; load(); }, 5000) : undefined;
      })
      .catch((e) => { if (alive) setSt((s) => ({ ...(s ?? {}), error: String((e as Error)?.message ?? e) })); });
    load();
    const stop = everyWhileSeen(() => { if (!timer) load(); });
    return () => { alive = false; stop(); if (timer) clearTimeout(timer); };
  }, []);
  return { d: st?.state?.value ?? null, computing: !!st?.state?.computing || st === null, progress: st?.state?.progress, error: st?.error ?? st?.state?.error };
}

/* ── words and numbers ─────────────────────────────────────────────────── */

const int = (n: number) => Math.round(n).toLocaleString("en");
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${int(Math.abs(n))}`;
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
/** working hours, as a person says them: "3.5 working hours", "2.1 working days" (a working day = 9 hours) */
const whours = (h: number | null) => (h == null ? "—" : h < 9 ? `${h.toFixed(1)} working hours` : `${(h / 9).toFixed(1)} working days`);
const signedHours = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)} h`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** A rate or a median ranks a person or a group from this many tickets - two of three said nothing; the rest are listed open under it. */
const MIN_N = 10;

/* ── the two pages ─────────────────────────────────────────────────────── */

const GROUP: Record<TGroup, { title: string; page: string; href: string; icon: React.ReactNode; tint: Tint; from: string; fromLower: string; fromPlural: string; what: string; won: string }> = {
  incoming: {
    title: "Incoming tickets", page: "eso-tickets", href: "/reporting/eso-benchmark/tickets", icon: <ConfirmationNumberOutlinedIcon />, tint: "amber",
    from: "Channel", fromLower: "channel", fromPlural: "Channels",
    what: "the customers' requests: a website form, the chat, an e-mail, a request the ESO typed in, one redirected from Back Office, the helpline",
    won: "won: closed as Ordered or a one-shot order",
  },
  system: {
    title: "System tickets", page: "eso-system-tickets", href: "/reporting/eso-benchmark/system-tickets", icon: <BoltOutlinedIcon />, tint: "purple",
    from: "Use case", fromLower: "use case", fromPlural: "Use cases",
    what: "what a workflow or a push hands the ESO: new registrants, lost leads, second purchase, poor rating, abandoned cart - and erosion, win back, the September push, price checks, GQS sales follow-ups",
    won: "won: closed as Ordered or a one-shot order - a new registrant closed Qualified",
  },
};

/* ── the period: this year's months ────────────────────────────────────── */

type TPer = { win: TWin; id: string; title: string; months: number };
const nowMonth = (d: TicketsData) => Number(d.today.slice(5, 7)) - 1;
const todayDay = (d: TicketsData) => Number(d.today.slice(8, 10));
function presetsOf(d: TicketsData): { id: string; label: string; win: TWin }[] {
  const m = nowMonth(d);
  const out = [{ id: "ytd", label: "Year to date", win: { from: 0, to: m } }, { id: "mtd", label: "Month to date", win: { from: m, to: m } }];
  if (m > 0) out.push({ id: "lm", label: `${MONTHS_FULL[m - 1]} ${d.year}`, win: { from: m - 1, to: m - 1 } });
  for (let q = 0; q < 4; q++) if (q * 3 + 2 < m) out.push({ id: `q${q + 1}`, label: `Q${q + 1} ${d.year}`, win: { from: q * 3, to: q * 3 + 2 } });
  return out;
}
function perOf(d: TicketsData, win: TWin): TPer {
  const p = presetsOf(d).find((x) => x.win.from === win.from && x.win.to === win.to);
  const title = p?.id === "ytd" ? "year to date" : p?.id === "mtd" ? "month to date" : p ? p.label : `${MONTHS[win.from]}–${MONTHS[win.to]} ${d.year}`;
  return { win, id: p?.id ?? `m${win.from}-${win.to}`, title, months: win.to - win.from + 1 };
}
/** "1 Jan – 30 Oct 2026", "Apr–Jun 2026" */
function perWords(d: TicketsData, per: TPer) {
  const run = per.win.to === nowMonth(d);
  if (per.win.from === per.win.to) return run ? `1 – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS_FULL[per.win.from]} ${d.year}`;
  return run ? `1 ${MONTHS[per.win.from]} – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS[per.win.from]}–${MONTHS[per.win.to]} ${d.year}`;
}
const perCap = (p: TPer) => p.title.charAt(0).toUpperCase() + p.title.slice(1);

/* ── the teams: ESO, or everyone who owns a ticket of the ESO pipeline ─── */

const TTEAMS: { id: TeamKey; label: string; count: null }[] = [{ id: "eso", label: "ESO", count: null }, { id: "total", label: "Total", count: null }];
/** ESO | Total, and under ESO the line managers' teams (as Visits: TSA owns a handful of the ESO pipeline's tickets). */
function TTeams({ team, onTeam, lead, onLead, teams }: { team: TeamKey; onTeam: (t: TeamKey) => void; lead: LeadKey; onLead: (l: LeadKey) => void; teams: Team[] }) {
  const t: TeamKey = team === "eso" ? "eso" : "total";
  const tabs: { id: LeadKey; label: string; count: null }[] = [{ id: "all", label: "All ESO", count: null }, ...teams.map((x) => ({ id: x.id, label: x.name, count: null }))];
  return (
    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", justifySelf: "start", minWidth: 0 }}>
      <ReportTabs name="eso-team" tab={t} onSelect={onTeam} tabs={TTEAMS} />
      {t === "eso" && teams.length > 0 && <ReportTabs name="eso-lead" tab={teams.some((x) => x.id === lead) ? lead : "all"} onSelect={onLead} tabs={tabs} />}
    </Box>
  );
}
/** The people shown: ESO's (a line manager's team's), or everyone who owns a ticket of the ESO pipeline. */
const peopleOf = (d: TicketsData, team: TeamKey, lead: string | null, byId: Record<string, string>) => new Set(d.people.flatMap((p, i) => (
  team === "eso" ? (p.team === "ESO" && (!lead || byId[p.id] === lead) ? [i] : []) : [i]
)));
const teamName = (c: { team: TeamKey; lead: string | null; teams: Team[] }) => (c.team === "eso" ? (c.lead ? c.teams.find((t) => t.id === c.lead)?.name ?? c.lead : "ESO") : "Everyone on the ESO pipeline");

/* ── what every chart is drawn with ────────────────────────────────────── */

type TView = "paths" | "people" | "from" | "handling" | "outcomes" | "months" | "customers";
const VIEW_IDS: TView[] = ["paths", "people", "from", "handling", "outcomes", "months", "customers"];
const viewsOf = (g: TGroup): { id: TView; label: string }[] => [
  { id: "paths", label: "Paths" }, { id: "people", label: "People" }, { id: "from", label: GROUP[g].fromPlural }, { id: "handling", label: "Handling" },
  { id: "outcomes", label: "Outcomes" }, { id: "months", label: "Months" }, { id: "customers", label: "Customers" },
];
const isView = (x: string | null | undefined): x is TView => VIEW_IDS.includes(x as TView);
const DIM_OF: Record<TView, TDim> = { paths: "channel", people: "person", from: "channel", handling: "person", outcomes: "channel", months: "channel", customers: "prio" };
type DimInfo = { name: string; lower: string; one: string; icon: React.ReactNode; tint: Tint };
const dimOf = (g: TGroup, dim: TDim): DimInfo => ({
  person: { name: "Person", lower: "person", one: "a person", icon: <BadgeOutlinedIcon />, tint: "green" as Tint },
  channel: { name: GROUP[g].from, lower: GROUP[g].fromLower, one: `a ${GROUP[g].fromLower}`, icon: <AltRouteIcon />, tint: "amber" as Tint },
  prio: { name: "Priority", lower: "priority", one: "a priority", icon: <FlagOutlinedIcon />, tint: "purple" as Tint },
  category: { name: "Customer category", lower: "customer category", one: "a customer category", icon: <CategoryOutlinedIcon />, tint: "blue" as Tint },
  country: { name: "Country", lower: "country", one: "a country", icon: <PublicOutlinedIcon />, tint: "blue" as Tint },
})[dim];
const ORDER: Partial<Record<TDim, readonly string[]>> = { channel: CHANNEL_ORDER, prio: PRIO_BANDS };

export type TCtx = {
  d: TicketsData; group: TGroup; per: TPer; team: TeamKey; lead: string | null; teams: Team[];
  /** the people shown (indexes) */
  people: Set<number>; filters: TFilters; view: TView;
  half?: boolean; targets?: Record<string, number>;
  onBar?: (dim: TDim, label: string) => void; onFilter?: (dim: TDim) => void;
};

const statCache = new WeakMap<TCtx, Map<string, Map<string, TStats>>>();
/** The figures of the period by a breakdown (its own filter left out), or all together - kept per drawing; `py` the same
 *  months last year. */
function statsOf(c: TCtx, dim?: TDim, py = false): Map<string, TStats> {
  let memo = statCache.get(c);
  if (!memo) { memo = new Map(); statCache.set(c, memo); }
  const k = `${dim ?? ""}|${py ? 1 : 0}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const win: TWin = py ? { ...c.per.win, year: 1 } : c.per.win;
  const out = statsBy(rowsOf(c.d, c.group, win, c.filters, c.people, dim), win, dim ? (r) => labelOf(c.d, r, dim) : undefined);
  memo.set(k, out);
  return out;
}
const totalOf = (c: TCtx, py = false) => statsOf(c, undefined, py).get("") ?? blank(c.per.months);
const pyCache = new WeakMap<TCtx, boolean>();
/** Last year's same months beside this year's - only when each of them held enough tickets for the people shown. */
function pyOk(c: TCtx): boolean {
  let v = pyCache.get(c);
  if (v === undefined) { v = comparable(c.d, c.group, c.per.win, c.people); pyCache.set(c, v); }
  return v;
}
const PREV = (c: TCtx) => `${c.d.year - 1}, the same months`;

/** A chart's target, one per chart, team and period: "eso-tickets:people:won@eso-RABE~q2" (the year to date without "~"). */
const targetKey = (c: { group: TGroup }, id: string, team: TeamKey, lead: string | null, per: TPer) => `${GROUP[c.group].page}:${id}@${team === "eso" ? "eso" : "total"}${team === "eso" && lead ? `-${lead}` : ""}${/^months:/.test(id) || per.id === "ytd" ? "" : `~${per.id}`}`;
const targetFor = (c: TCtx, id: string) => { const t = c.targets?.[targetKey(c, id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/* ── the leaderboards ──────────────────────────────────────────────────── */

type Measure = "won" | "rate" | "tickets" | "inday" | "quiet" | "hours";
const MEASURE: Record<Measure, { title: string; fmt: (n: number) => string; unit: "n" | "pct" | "eur"; ratio?: boolean; lower?: boolean; diff?: (n: number) => string }> = {
  won: { title: "Tickets won", fmt: int, unit: "n", diff: signed },
  rate: { title: "Win rate", fmt: (n) => pct(n), unit: "pct", ratio: true },
  tickets: { title: "Tickets", fmt: int, unit: "n", diff: signed },
  inday: { title: "Contacted within a working day", fmt: (n) => pct(n), unit: "pct", ratio: true },
  quiet: { title: "Closed without any activity", fmt: int, unit: "n", lower: true, diff: signed },
  hours: { title: "Time to the first contact", fmt: (n) => whours(n), unit: "n", lower: true, diff: signedHours },
};
/** A measure's value of a set of tickets, and whether it says enough to be ranked. */
function valueOf(m: Measure, s: TStats): { v: number | null; ranked: boolean } {
  if (m === "won") return { v: s.won, ranked: true };
  if (m === "tickets") return { v: s.tickets, ranked: true };
  if (m === "quiet") return { v: s.quiet, ranked: true };
  if (m === "rate") return { v: rateOf(s), ranked: s.resolved >= MIN_N };
  if (m === "inday") return { v: inDayOf(s), ranked: s.tickets >= MIN_N };
  return { v: median(s.hours), ranked: s.hours.length >= MIN_N };
}
function subOf(m: Measure, s: TStats, t: TStats, dim: TDim): string {
  if (m === "won") return `win rate ${pct(rateOf(s))} · ${int(s.won)} of ${int(s.resolved)} closed with a resolution`;
  if (m === "rate") return `${int(s.won)} won of ${int(s.resolved)} closed with a resolution`;
  if (m === "tickets") return `${dim === "person" ? "" : `${pct(t.tickets ? s.tickets / t.tickets : null)} of the tickets · `}${int(s.won)} won · ${int(s.open)} still open`;
  if (m === "inday") return `${int(s.speed[0])} of ${int(s.tickets)} tickets`;
  if (m === "quiet") return `${pct(quietOf(s))} of the ${int(s.closed)} closed`;
  return `the middle of ${int(s.hours.length)} first contacts · working hours, Mon-Fri 8-17`;
}
function boardRows(c: TCtx, dim: TDim, m: Measure): { rows: BoardRow[]; small: BoardRow[] } {
  const by = statsOf(c, dim);
  const pyBy = pyOk(c) ? statsOf(c, dim, true) : null;
  const t = totalOf(c);
  const rows: BoardRow[] = [], small: BoardRow[] = [];
  for (const [label, s] of by) {
    const { v, ranked } = valueOf(m, s);
    if (v == null || (!v && (m === "won" || m === "quiet"))) continue;
    const p = pyBy?.get(label);
    const row = { label, cur: v, prev: p ? valueOf(m, p).v ?? 0 : 0, sub: subOf(m, s, t, dim) };
    (ranked ? rows : small).push(row);
  }
  return { rows, small };
}
function Board({ c, id, dim, m, actions }: { c: TCtx; id: string; dim: TDim; m: Measure; actions?: React.ReactNode }) {
  const { rows, small } = boardRows(c, dim, m);
  const M = MEASURE[m], D = dimOf(c.group, dim);
  const why = m === "rate" ? `under ${MIN_N} closed with a resolution` : m === "inday" ? `under ${MIN_N} tickets` : `under ${MIN_N} first contacts`;
  return (
    <Leaderboard key={`${id}-${c.per.id}`} title={`${M.title} ${c.per.title}, by ${D.lower}`} rows={rows} noChange={!pyOk(c)}
      curLabel={perWords(c.d, c.per)} prevLabel={PREV(c)} vs={`vs ${c.d.year - 1}`} first={c.half ? 8 : 12} fmt={M.fmt} diff={M.diff} ratio={!!M.ratio} lowerIsBetter={!!M.lower} target={targetFor(c, id)}
      unranked={small.length ? { why, rows: small, open: true } : undefined}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${D.lower}`} actions={actions} />
  );
}

/* ── the path: where they came from, how fast the first contact came, what became of them, why (as Hand-over) ── */

const TONE: Record<TFlowNode["tone"], string> = { source: SERIES[0], good: SERIES[2], bad: "#c0571f", none: DEEMPHASIS };
function PathChart({ c, title, actions }: { c: TCtx; title: string; actions?: React.ReactNode }) {
  const fl = flowOf(c.d, rowsOf(c.d, c.group, c.per.win, c.filters, c.people));
  const label = new Map(fl.nodes.map((n) => [n.id, n.label]));
  return (
    <ChartBox title={title} hint={`${perWords(c.d, c.per)} · where each came from, how fast the first contact came (a reply in the ticket, an e-mail sent, a call or a meeting - working hours), what became of it, and why for the lost`} actions={actions}>
      <ChartFrame table={{ columns: ["From", "To", "Tickets"], rows: fl.links.map((l) => [label.get(l.from) ?? l.from, label.get(l.to) ?? l.to, l.value]), numeric: [2] }} empty={fl.nodes.length ? null : "No tickets for this choice."}>
        <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
          <Box sx={{ minWidth: 900 }}>
            <Sankey height={c.half ? 380 : 460} columns={fl.columns} label={title} links={fl.links}
              nodes={fl.nodes.map((n) => ({ id: n.id, column: n.column, label: n.label, color: TONE[n.tone] }))} />
          </Box>
        </Box>
      </ChartFrame>
    </ChartBox>
  );
}

/* ── the bar graphs: what became of them, why lost, how fast, what the first contact was, what was logged ── */

function Bars({ c, title, hint, rows, fmt, actions }: { c: TCtx; title: string; hint: string; rows: { label: string; value: number; secondary: string }[]; fmt?: (v: number | null) => string; actions?: React.ReactNode }) {
  return (
    <ChartBox title={title} hint={`${perWords(c.d, c.per)} · ${hint}`} actions={actions}>
      <BarList rows={rows} format={fmt ?? ((v) => int(v ?? 0))} labelWidth={200} emptyMessage="No tickets for this choice." />
    </ChartBox>
  );
}
const ofAll = (n: number, all: number) => pct(all ? n / all : null);
function outcomeRows(t: TStats) {
  const ids = OUTCOMES.map((o) => o.id);
  const sum = (keep: (id: string) => boolean) => t.outcomes.reduce((a, n, i) => a + (keep(ids[i]) ? n : 0), 0);
  const lost = sum((id) => (LOST_IDS as readonly string[]).includes(id));
  return [
    { label: "Won", value: t.won, secondary: `${ofAll(t.won, t.tickets)} of the tickets · win rate ${pct(rateOf(t))}` },
    { label: "Lost or disqualified", value: lost, secondary: ofAll(lost, t.tickets) },
    { label: "Closed otherwise", value: sum((id) => id === "other"), secondary: ofAll(sum((id) => id === "other"), t.tickets) },
    { label: "Closed without a resolution", value: sum((id) => id === "nores"), secondary: ofAll(sum((id) => id === "nores"), t.tickets) },
    { label: "Still open", value: t.open, secondary: ofAll(t.open, t.tickets) },
  ];
}
function lostRows(t: TStats) {
  const ids = OUTCOMES.map((o) => o.id);
  const lost = LOST_IDS.reduce((a, id) => a + t.outcomes[ids.indexOf(id)], 0);
  return LOST_IDS.map((id) => ({ label: lostLabel(id), value: t.outcomes[ids.indexOf(id)], secondary: `${ofAll(t.outcomes[ids.indexOf(id)], lost)} of the lost` })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
}
const speedRows = (t: TStats) => SPEEDS.map((s, i) => ({ label: s, value: t.speed[i], secondary: `${ofAll(t.speed[i], t.tickets)} · win rate ${pct(t.speedResolved[i] ? t.speedWon[i] / t.speedResolved[i] : null)}` }));
function firstRows(t: TStats) {
  const none = t.speed[3], noneWon = t.speedWon[3], noneRes = t.speedResolved[3];
  return [
    ...FIRST.map((f, i) => ({ label: f, value: t.first[i], secondary: `${ofAll(t.first[i], t.tickets)} · win rate ${pct(t.firstResolved[i] ? t.firstWon[i] / t.firstResolved[i] : null)}` })).filter((r) => r.value > 0),
    { label: "No contact", value: none, secondary: `${ofAll(none, t.tickets)} · win rate ${pct(noneRes ? noneWon / noneRes : null)}` },
  ];
}
const activityRows = (t: TStats) => [
  { label: "E-mails sent", value: t.emails, secondary: `on ${int(t.withEmails)} tickets (${ofAll(t.withEmails, t.tickets)})` },
  { label: "Calls", value: t.calls, secondary: `on ${int(t.withCalls)} tickets (${ofAll(t.withCalls, t.tickets)})` },
  { label: "Notes and tasks", value: t.notes, secondary: `on ${int(t.withNotes)} tickets (${ofAll(t.withNotes, t.tickets)})` },
  { label: "Meetings", value: t.meetings, secondary: `on ${int(t.withMeetings)} tickets (${ofAll(t.withMeetings, t.tickets)})` },
];

/* ── the months: a figure per month as columns, a second figure under each ── */

type MonthWhat = "tickets" | "won" | "inday" | "quiet";
const MONTH_WHAT: Record<MonthWhat, { title: string; legend: string; under: string; ratio?: boolean; value: (t: TStats, i: number) => number; second: (t: TStats, i: number) => string; tip: (t: TStats, i: number) => string }> = {
  tickets: { title: "Tickets", legend: "Tickets that came in", under: "the win rate", value: (t, i) => t.months[i], second: (t, i) => pct(t.monthsResolved[i] ? t.monthsWon[i] / t.monthsResolved[i] : null), tip: (t, i) => `${int(t.months[i])} tickets · ${int(t.monthsWon[i])} won of ${int(t.monthsResolved[i])} closed with a resolution` },
  won: { title: "Tickets won", legend: "Tickets won", under: "the win rate", value: (t, i) => t.monthsWon[i], second: (t, i) => pct(t.monthsResolved[i] ? t.monthsWon[i] / t.monthsResolved[i] : null), tip: (t, i) => `${int(t.monthsWon[i])} won of ${int(t.monthsResolved[i])} closed with a resolution · ${int(t.months[i])} tickets` },
  inday: { title: "Contacted within a working day", legend: "Share contacted within a working day", under: "how many", ratio: true, value: (t, i) => (t.months[i] ? t.monthsInDay[i] / t.months[i] : 0), second: (t, i) => int(t.monthsInDay[i]), tip: (t, i) => `${int(t.monthsInDay[i])} of ${int(t.months[i])} tickets contacted within a working day` },
  quiet: { title: "Closed without any activity", legend: "Closed without any activity", under: "of the closed", value: (t, i) => t.monthsQuiet[i], second: (t, i) => pct(t.monthsClosed[i] ? t.monthsQuiet[i] / t.monthsClosed[i] : null), tip: (t, i) => `${int(t.monthsQuiet[i])} of ${int(t.monthsClosed[i])} closed tickets had nothing logged on them` },
};
function MonthColumns({ c, what, target }: { c: TCtx; what: MonthWhat; target: number | null }) {
  const t = totalOf(c);
  const W = MONTH_WHAT[what];
  const fmt = (n: number) => (W.ratio ? pct(n) : int(n));
  const data = t.months.map((_, i) => ({ x: MONTHS[c.per.win.from + i], v: W.value(t, i), second: W.second(t, i), tip: W.tip(t, i), running: c.per.win.from + i === nowMonth(c.d) }));
  const top = W.ratio ? 1 : niceTop(Math.max(1, target ?? 0, ...data.map((x) => x.v)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const done = data.filter((x) => !x.running);
  const reached = target ? done.filter((x) => (what === "quiet" ? x.v <= target : x.v >= target)).length : 0;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: THIS }} />{W.legend}</Box>
        <Box component="span">Under each month: {W.under}</Box>
        {target && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: INK, fontWeight: 600 }}><Box component="span" sx={{ width: 14, borderTop: `2px dashed ${TARGET}` }} />Target {fmt(target)} a month · <span style={{ color: reached === done.length ? GREEN : RED }}>{reached} of {done.length} months reached it</span></Box>}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: Math.max(28, axisWidth(W.ratio ? 100 : top) - 40) }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{W.ratio ? `${Math.round(f * 100)}%` : int(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 160, maxHeight: 320 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          {target != null && <Box sx={{ position: "absolute", left: 0, right: 0, bottom: `${(Math.min(target, top) / top) * 100}%`, borderTop: `2px dashed ${TARGET}`, zIndex: 1, pointerEvents: "none" }} />}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((x) => (
              <Box key={x.x} title={`${x.x}${x.running ? " (to date)" : ""}: ${x.tip}`} sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px" }}>
                <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(Math.min(x.v, top) / top) * 100}%`, bgcolor: THIS, opacity: x.running ? 0.55 : 1, borderRadius: "4px 4px 0 0" }} />
              </Box>
            ))}
          </Box>
        </Box>
        <Box />
        <Box sx={{ display: "flex" }}>
          {data.map((x) => (
            <Box key={x.x} sx={{ flex: 1, textAlign: "center", pt: 0.5, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3 }}>{x.x}</Typography>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{fmt(x.v)}</Typography>
              <Typography sx={{ fontSize: "0.68rem", color: FAINT, lineHeight: 1.3 }}>{x.second}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/* ── every chart by its key ────────────────────────────────────────────── */

type TargetOf = { unit: "eur" | "pct" | "n"; label: string };
type Drawn = { id: string; title: (c: TCtx) => string; draw: (c: TCtx, actions?: React.ReactNode) => React.ReactNode; target?: (c: TCtx) => TargetOf };
const teamPart = (c: TCtx) => ` - ${teamName(c)}`;
const forWhom = (c: TCtx) => `${teamName(c)}'s target for ${c.per.title} - each team and period its own`;
/** A chart by its id: "paths:flow", "outcomes:split", "outcomes:lost", "handling:speed|first|activity", "months:<what>", or a
 *  board "<tab>:<measure>[-<breakdown>]" - people:rate, from:quiet, customers:rate-country… */
function drawnOf(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  const P = (c: TCtx) => c.per.title;
  if (chart === "flow") {
    const title = (c: TCtx) => `What happens to the ${GROUP[c.group].title.toLowerCase()}, ${P(c)}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <PathChart c={c} title={title(c)} actions={a} /> };
  }
  if (chart === "split") {
    const title = (c: TCtx) => `Won, lost or still open, ${P(c)}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <Bars c={c} title={title(c)} hint={`${GROUP[c.group].won} · the win rate: of the tickets closed with a resolution`} rows={outcomeRows(totalOf(c))} actions={a} /> };
  }
  if (chart === "lost") {
    const title = (c: TCtx) => `Why they were lost, ${P(c)}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <Bars c={c} title={title(c)} hint="the resolutions of the lost, in groups" rows={lostRows(totalOf(c))} actions={a} /> };
  }
  if (chart === "speed") {
    const title = (c: TCtx) => `How fast the first contact came, ${P(c)}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <Bars c={c} title={title(c)} hint="working hours from the ticket coming in to the first reply, e-mail sent, call or meeting - Mon-Fri 8-17 · the win rate of each" rows={speedRows(totalOf(c))} actions={a} /> };
  }
  if (chart === "first") {
    const title = (c: TCtx) => `What the first contact was, ${P(c)}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <Bars c={c} title={title(c)} hint="the first thing the team did towards the customer · the win rate of each" rows={firstRows(totalOf(c))} actions={a} /> };
  }
  if (chart === "activity") {
    const title = (c: TCtx) => `What was logged on the tickets, ${P(c)}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <Bars c={c} title={title(c)} hint={`everything the team logged · ${int(totalOf(c).quiet)} of the ${int(totalOf(c).closed)} closed had nothing at all`} rows={activityRows(totalOf(c))} actions={a} /> };
  }
  if (v === "months" && chart in MONTH_WHAT) {
    const w = chart as MonthWhat;
    const title = (c: TCtx) => `${MONTH_WHAT[w].title} ${P(c)}, month by month${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · by the month the ticket came in · the running month to date, lighter`} actions={a}><MonthColumns c={c} what={w} target={targetFor(c, id)} /></ChartBox>,
      target: (c) => ({ unit: MONTH_WHAT[w].ratio ? "pct" : "n", label: `Each month is measured against it - a line across the months; the running month is not counted · ${teamName(c)}'s target.` }) };
  }
  const [what, by] = chart.split("-");
  if (!(what in MEASURE)) return undefined;
  const m = what as Measure;
  const dim: TDim = by && ["person", "channel", "prio", "category", "country"].includes(by) ? (by as TDim) : DIM_OF[v];
  return { id, title: (c) => `${MEASURE[m].title} ${P(c)}, by ${dimOf(c.group, dim).lower}${teamPart(c)}`, draw: (c, a) => <Board c={c} id={id} dim={dim} m={m} actions={a} />,
    target: (c) => ({ unit: MEASURE[m].unit, label: `Each ${dimOf(c.group, dim).lower}'s ${MEASURE[m].title.toLowerCase()} ${c.per.title} is measured against it · ${forWhom(c)}.` }) };
}
/** The earlier pages' keys, still in some BUC Views, by what took their place. */
function chartOf(key: string): Drawn | undefined {
  const [, view = "", chart = ""] = key.split(":");
  const old: Record<string, string> = {
    // the benchmark page (until 29.10.2026)
    "reps:created": "people:tickets", "reps:ordered": "people:won", "speed:counts": "months:tickets", "source:source": "from:won",
    "resolution:resolution": "outcomes:split", "open:count": "outcomes:split", "open:potential": "outcomes:split",
    // the page of 29.10.2026, before the split
    "people:ordered": "people:won", "people:value": "people:won", "people:months": "months:won", "people:open": "outcomes:split",
    "kind:ordered": "from:won", "kind:rate": "from:rate", "kind:tickets": "from:tickets",
    "prio:ordered": "customers:won-prio", "prio:rate": "customers:rate-prio", "prio:ordered-band": "customers:won-prio", "prio:rate-band": "customers:rate-prio",
    "category:ordered": "customers:won-category", "category:rate": "customers:rate-category", "country:ordered": "customers:won-country", "country:rate": "customers:rate-country",
  };
  return drawnOf(old[`${view}:${chart}`] ?? `${view}:${chart}`);
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string, target?: TargetOf) => React.ReactNode;
const draw = (c: TCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c), d.target?.(c))); };

function TabCard({ c, act }: { c: TCtx; act: Act }) {
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const words = perWords(c.d, c.per);
  const G = GROUP[c.group];
  const head = (icon: React.ReactNode, tint: Tint, title: string, note: string) => <CardTitle icon={icon} tint={tint} title={title} note={`${words} · ${note}`} />;
  const two = (a: string, b: string, first = false) => <Box sx={{ ...TWO, ...(first ? { mt: -1 } : {}) }}>{draw(c, act, a)}{draw(c, act, b)}</Box>;
  if (c.view === "paths") return (
    <GlassCard sx={card}>
      {head(<AltRouteIcon />, "blue", `${G.title}: the path, ${c.per.title}`, `${G.what} · ${G.won}`)}
      <Box sx={{ mt: -1 }}>{draw(c, act, "paths:flow")}</Box>
      {two("paths:split", "paths:speed")}
    </GlassCard>
  );
  if (c.view === "people") return (
    <GlassCard sx={card}>
      {head(<BadgeOutlinedIcon />, "green", `${teamName(c)}, ${c.per.title}`, `by who owns the ticket today · ${G.won}`)}
      {two("people:rate", "people:won", true)}
      {two("people:inday", "people:quiet")}
      {two("people:tickets", "people:hours")}
    </GlassCard>
  );
  if (c.view === "from") return (
    <GlassCard sx={card}>
      {head(<AltRouteIcon />, "amber", `${G.title} by ${G.fromLower}, ${c.per.title}`, `where each ticket came from · ${G.won}`)}
      {two("from:rate", "from:won", true)}
      {two("from:inday", "from:quiet")}
      {two("from:tickets", "from:hours")}
    </GlassCard>
  );
  if (c.view === "handling") return (
    <GlassCard sx={card}>
      {head(<TimerOutlinedIcon />, "blue", `How the ${G.title.toLowerCase()} are handled, ${c.per.title}`, "how fast the first contact came, what it was, what was logged - and the win rate of each")}
      {two("handling:speed", "handling:first", true)}
      {two("handling:activity", "handling:quiet-person")}
    </GlassCard>
  );
  if (c.view === "outcomes") return (
    <GlassCard sx={card}>
      {head(<FactCheckOutlinedIcon />, "purple", `What became of the ${G.title.toLowerCase()}, ${c.per.title}`, `${G.won} · the win rate: of the tickets closed with a resolution`)}
      {two("outcomes:split", "outcomes:lost", true)}
      {two("outcomes:rate", "outcomes:won")}
    </GlassCard>
  );
  if (c.view === "months") return (
    <GlassCard sx={card}>
      {head(<TimelineOutlinedIcon />, "blue", `${G.title}, month by month`, "by the month the ticket came in")}
      <Box sx={{ mt: -1 }}>{draw(c, act, "months:tickets")}</Box>
      {draw(c, act, "months:won")}
      {two("months:inday", "months:quiet")}
    </GlassCard>
  );
  return (
    <GlassCard sx={card}>
      {head(<ApartmentOutlinedIcon />, "purple", `${G.title} by customer, ${c.per.title}`, "the ticket's company: its priority, its APSO customer category, its country")}
      {two("customers:rate-prio", "customers:won-prio", true)}
      {two("customers:rate-category", "customers:won-category")}
      {two("customers:rate-country", "customers:won-country")}
    </GlassCard>
  );
}
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the Filters window: the period and the breakdowns ─────────────────── */

function TPeriod({ d, per, onPer }: { d: TicketsData; per: TPer; onPer: (w: TWin) => void }) {
  const m = nowMonth(d);
  const sel = { height: 32, fontSize: "0.82rem", fontWeight: 600, borderRadius: "9px", bgcolor: "#fff", flex: 1, "& .MuiSelect-select": { py: 0.5, pl: 1.25 } };
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
        {presetsOf(d).map((p) => {
          const on = p.win.from === per.win.from && p.win.to === per.win.to;
          return <Chip key={p.id} label={p.label} onClick={() => onPer(p.win)} aria-pressed={on} sx={{ height: 28, fontSize: "0.78rem", fontWeight: 600, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : INK, border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.14)"}` }} />;
        })}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>From</Typography>
        <Select size="small" value={per.win.from} onChange={(e) => { const f = Number(e.target.value); onPer({ from: f, to: Math.max(f, per.win.to) }); }} sx={sel} inputProps={{ "aria-label": "From month" }}>
          {MONTHS.slice(0, m + 1).map((x, i) => <MenuItem key={x} value={i}>{x} {d.year}</MenuItem>)}
        </Select>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>to</Typography>
        <Select size="small" value={per.win.to} onChange={(e) => { const t = Number(e.target.value); onPer({ from: Math.min(per.win.from, t), to: t }); }} sx={sel} inputProps={{ "aria-label": "To month" }}>
          {MONTHS.slice(0, m + 1).map((x, i) => <MenuItem key={x} value={i}>{x} {d.year}</MenuItem>)}
        </Select>
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>The graphs set last year beside this year when each month chosen held {PY_MIN} tickets or more last year - the ESO pipeline began in July {d.year - 1}.</Typography>
    </Box>
  );
}
function TFacet({ c, dim, onPick }: { c: TCtx; dim: TDim; onPick: (l: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const by = statsOf(c, dim);
  const order = ORDER[dim];
  const D = dimOf(c.group, dim);
  const rows = [...by].map(([label, s]) => ({ label, n: s.tickets }));
  rows.sort(order ? (a, b) => order.indexOf(a.label) - order.indexOf(b.label) : (a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const sel = c.filters[dim] ?? [];
  const found = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
  const LIMIT = 8;
  const shown = all || q ? found : [...found.slice(0, LIMIT), ...found.slice(LIMIT).filter((r) => sel.includes(r.label))];
  const max = Math.max(1, ...rows.map((r) => r.n));
  const t = TINT[D.tint];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.length > LIMIT && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${D.one}…`} inputProps={{ "aria-label": `Find ${D.one} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
        </Box>
      )}
      {shown.map((r) => {
        const on = sel.includes(r.label);
        return (
          <Box key={r.label} component="button" type="button" onClick={() => onPick(r.label)} aria-pressed={on}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 70px 44px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? t.bg : "transparent", "&:hover": { bgcolor: on ? t.bg : "rgba(21,34,58,.04)" } }}>
            {on ? <CheckIcon sx={{ fontSize: 16, color: t.fg }} /> : <span />}
            <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, color: INK }}>{r.label}</Typography>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(r.n / max) * 100}%`, bgcolor: t.fg, opacity: 0.6 }} /></Box>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{int(r.n)}</Typography>
          </Box>
        );
      })}
      {!q && found.length > LIMIT && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${LIMIT}` : `Show all ${found.length}`}</Button>}
    </Box>
  );
}
const FILTER_DIMS: TDim[] = ["person", "channel", "prio", "category", "country"];
function TFilterWindow({ c, per, open, onClose, focus, onPer, toggle, clearAll }: {
  c: TCtx; per: TPer; open: boolean; onClose: () => void; focus: { dim: TDim; n: number } | null; onPer: (w: TWin) => void; toggle: (d: TDim, l: string) => void; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<TDim | "period", boolean>>>({});
  const isOpen = (k: TDim | "period") => (shut[k] !== undefined ? !shut[k] : k === "period" || k === "person" || !!c.filters[k as TDim]?.length);
  const [live, setLive] = useState(open);
  useEffect(() => { if (open) { setLive(true); return; } const t = setTimeout(() => setLive(false), 320); return () => clearTimeout(t); }, [open]);
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.dim]: false }));
    const t = setTimeout(() => document.getElementById(`tfilter-${focus.dim}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const chosen = FILTER_DIMS.flatMap((d) => (c.filters[d] ?? []).map((v) => [d, v] as const));
  return (
    <FilterPanel id="eso-tickets-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, v]) => <Chip key={`${d}:${v}`} size="small" label={<span><b>{dimOf(c.group, d).name}:</b> {v}</span>} onDelete={() => toggle(d, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[dimOf(c.group, d).tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          <FilterSection id="tfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => setShut((s) => ({ ...s, period: isOpen("period") }))} summary={perCap(per)}>
            <TPeriod d={c.d} per={per} onPer={onPer} />
          </FilterSection>
          {FILTER_DIMS.map((dim, i) => {
            const D = dimOf(c.group, dim);
            return (
              <FilterSection key={dim} id={`tfilter-${dim}`} index={i + 1} title={D.name} icon={D.icon} tint={D.tint} open={isOpen(dim)} onFlip={() => setShut((s) => ({ ...s, [dim]: isOpen(dim) }))}
                summary={!c.filters[dim]?.length ? "All" : c.filters[dim]!.length === 1 ? c.filters[dim]![0] : `${c.filters[dim]!.length} chosen`} chosen={!!c.filters[dim]?.length}>
                <TFacet c={c} dim={dim} onPick={(l) => toggle(dim, l)} />
              </FilterSection>
            );
          })}
        </>
      )}
    </FilterPanel>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

function Waiting({ computing, progress, error }: { computing: boolean; progress?: string; error?: string }) {
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {computing && !error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The tickets could not be read: ${error}` : `Reading every ticket of the ESO pipeline in HubSpot, and what was done on each${progress ? ` · ${progress}` : ""}…`}</Typography>
      </Box>
    </GlassCard>
  );
}
const ym = (d: TicketsData, m: number) => `${d.year}-${String(m + 1).padStart(2, "0")}`;
const fromYm = (d: TicketsData, x: string | null) => { const m = /^(\d{4})-(\d{2})$/.exec(x ?? ""); return m && Number(m[1]) === d.year ? Number(m[2]) - 1 : null; };

export function TicketsExplorer({ group }: { group: TGroup }) {
  const G = GROUP[group];
  const params = useSearchParams();
  const { d, computing, progress, error } = useTickets();
  const [teamKey, setTeam] = useTeam();
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  const { state: acts } = useActions(G.page);
  const view: TView = isView(params.get("view")) ? (params.get("view") as TView) : "paths";
  const setView = (v: TView) => setQuery((q) => { if (v === "paths") q.delete("view"); else q.set("view", v); });
  const filters: TFilters = useMemo(() => Object.fromEntries(FILTER_DIMS.flatMap((k) => (params.getAll(k).length ? [[k, params.getAll(k)]] : []))), [params]);
  const toggle = (k: TDim, label: string) => setQuery((q) => { const cur = q.getAll(k), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]; q.delete(k); for (const x of next) q.append(k, x); });
  const clearAll = () => setQuery((q) => { for (const k of FILTER_DIMS) q.delete(k); q.delete("from"); q.delete("to"); });
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: TDim; n: number } | null>(null);
  const openOn = (k: TDim) => { setFocus((f) => ({ dim: k, n: (f?.n ?? 0) + 1 })); setPanel(true); };
  const setPer = (w: TWin) => setQuery((q) => { if (!d) return; const ytd = presetsOf(d)[0].win; if (w.from === ytd.from && w.to === ytd.to) { q.delete("from"); q.delete("to"); } else { q.set("from", ym(d, w.from)); q.set("to", ym(d, w.to)); } });

  // the work a click asks for, kept; the tabs and toggles answer at once and the charts follow (as the Figures)
  const team: TeamKey = teamKey === "eso" ? "eso" : "total";
  const lead = team === "eso" ? leadOf("eso", leadKey, lt) : null;
  const fromP = params.get("from"), toP = params.get("to");
  const per = useMemo(() => {
    if (!d) return null;
    const a = fromYm(d, fromP), b = fromYm(d, toP), m = nowMonth(d);
    return a != null && b != null ? perOf(d, { from: Math.min(a, b, m), to: Math.min(Math.max(a, b), m) }) : perOf(d, presetsOf(d)[0].win);
  }, [d, fromP, toP]);
  const people = useMemo(() => (d ? peopleOf(d, team, lead, lt?.byId ?? {}) : null), [d, team, lead, lt]);
  const want = useMemo(() => ({ view, per, people, team, lead, filters }), [view, per, people, team, lead, filters]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<TCtx | null>(() => (d && drawn.per && drawn.people ? {
    d, group, per: drawn.per, team: drawn.team, lead: drawn.lead, teams, people: drawn.people, filters: drawn.filters, view: drawn.view, targets: acts?.targets,
    onBar: (k, l) => { toggle(k, l); openOn(k); }, onFilter: openOn,
  } : null), [d, group, drawn, teams, acts?.targets]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = (
    <Box component={Link} href="/reporting/eso-benchmark" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
      <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
    </Box>
  );
  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  if (!d || !c || !per) return (<Box sx={shell}>{back}<Typography component="h1" sx={H1}>{G.title}</Typography><Waiting computing={computing} progress={progress} error={error} /></Box>);

  const act: Act = (id, title, target) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `${G.page}:${id}`, page: G.page, tab: c.view, title, summary: `${teamName(c)} · ${perWords(d, c.per)}`,
        filters: { ...Object.fromEntries(FILTER_DIMS.filter((k) => c.filters[k]?.length).map((k) => [k, c.filters[k] ?? []])), team: [c.team], ...(c.lead ? { lead: [c.lead] } : {}), ...(c.per.id.startsWith("m") ? { from: [ym(d, c.per.win.from)], to: [ym(d, c.per.win.to)] } : { period: [c.per.id] }) },
        kind: "card", target: target ? { key: targetKey(c, id, c.team, c.lead, c.per), ...target } : undefined }} />
  );
  const now = { team, lead, teams };
  const chosen = FILTER_DIMS.flatMap((k) => (filters[k] ?? []).map((v) => [k, v] as const));
  const views = viewsOf(group);
  return (
    <Box sx={shell}>
      {back}
      <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
        <Typography component="h1" sx={H1}>{G.title}</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
          <b style={{ color: INK }}>{teamName(now)}</b> · {per.title} <b style={{ color: INK }}>{perWords(d, per)}</b> · {G.what}{computing ? " · reading HubSpot again" : ""}
        </Typography>
        {(chosen.length > 0 || per.id !== "ytd") && (
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
            {per.id !== "ytd" && <Chip size="small" label={<span><b>Period:</b> {perCap(per)}</span>} onDelete={() => setPer(presetsOf(d)[0].win)} onClick={() => setPanel(true)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.blue.fg } }} />}
            {chosen.map(([k, v]) => <Chip key={`${k}:${v}`} size="small" label={<span><b>{dimOf(group, k).name}:</b> {v}</span>} onDelete={() => toggle(k, v)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[dimOf(group, k).tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[dimOf(group, k).tint].fg } }} />)}
            {chosen.length > 0 && <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>}
          </Box>
        )}
      </Box>
      <Box sx={{ display: "grid", gap: 0.75, mt: -0.5 }}>
        <TTeams team={team} onTeam={setTeam} lead={leadKey} onLead={setLead} teams={teams} />
        {lead && people && people.size === 0 && <NoLeadYet name={teamName(now)} />}
      </Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name={G.page} tab={view} onSelect={setView} tabs={views.map((v) => ({ id: v.id, label: v.label, count: null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page={G.page} /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else openOn(DIM_OF[view]); }} variant={panel || chosen.length || per.id !== "ytd" ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-tickets-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length || per.id !== "ytd" ? undefined : "#fff" }}>
          Filters{chosen.length + (per.id !== "ytd" ? 1 : 0) ? ` · ${chosen.length + (per.id !== "ytd" ? 1 : 0)}` : ""}
        </Button>
      </Box>
      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} act={act} />
      </Box>
      <TFilterWindow c={c} per={per} open={panel} onClose={() => setPanel(false)} focus={focus} onPer={setPer} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's panels: Incoming tickets, System tickets ───────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;

/** A tickets page in the BUC View: the year to date for the team the toggle shows, its months, and its charts sent here. */
export function TicketsPanel({ acts, group }: { acts: ActionsState | null; group: TGroup }) {
  const G = GROUP[group];
  const PANEL = `${G.page}:panel:`;
  const { d, computing, progress, error } = useTickets();
  const [teamKey, setTeam] = useState<TeamKey>("eso");
  const [leadKey, setLeadKey] = useState<LeadKey>("all");
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  useEffect(() => { try { const x = asTeam(localStorage.getItem(KEPT)); if (x) setTeam(x); const l = asLead(localStorage.getItem(KEPT_LEAD)); if (l) setLeadKey(l); } catch { /* ESO */ } }, []);
  const choose = (t: TeamKey) => { setTeam(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const chooseLead = (l: LeadKey) => { setLeadKey(l); try { localStorage.setItem(KEPT_LEAD, l); } catch { /* here only */ } };
  const team: TeamKey = teamKey === "eso" ? "eso" : "total";
  const lead = team === "eso" ? leadOf("eso", leadKey, lt) : null;
  const want = useMemo(() => ({ team, lead }), [team, lead]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<TCtx | null>(() => (d ? { d, group, per: perOf(d, presetsOf(d)[0].win), team: drawn.team, lead: drawn.lead, teams, people: peopleOf(d, drawn.team, drawn.lead, lt?.byId ?? {}), filters: {}, view: "paths", targets: acts?.targets } : null),
    [d, group, drawn, teams, lt, acts?.targets]);
  const items: SortItem[] = useMemo(() => !c ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === G.page && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const ch = chartOf(spec.key);
    const fmt = formatOf(acts, spec);
    const f = spec.filters ?? {};
    const sf: TFilters = Object.fromEntries(FILTER_DIMS.flatMap((k) => (f[k]?.length ? [[k, f[k]]] : [])));
    const pid = f.period?.[0], pr = pid ? presetsOf(c.d).find((p) => p.id === pid) : null;
    const a0 = fromYm(c.d, f.from?.[0] ?? null), b0 = fromYm(c.d, f.to?.[0] ?? null);
    const sp = pr ? perOf(c.d, pr.win) : a0 != null && b0 != null ? perOf(c.d, { from: a0, to: b0 }) : c.per;
    // every chart here follows the panel's toggle (as the Figures' panel); its filters and period stay as sent
    const sc: TCtx = { ...c, per: sp, filters: sf, view: (spec.tab && isView(spec.tab) ? spec.tab : "paths") as TView, half: fmt === "half" };
    const target = ch?.target ? { key: targetKey(c, ch.id, c.team, c.lead, sp), ...ch.target(sc) } : undefined;
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind, target }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={G.icon} tint={G.tint} title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [c, acts, G, PANEL]);
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: `nutshell:${G.page}`, keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const shown = (id: string) => placementOf(acts, `${PANEL}${id}`, "nutshell") === "nutshell";
  const months = drawnOf("months:won")!;
  const own = (title: string) => (
    <TileActions where="nutshell" start="nutshell" edge={2} tile={{ key: `${PANEL}months`, page: G.page, tab: "months", title, kind: "card",
      filters: { team: [drawn.team], ...(drawn.lead ? { lead: [drawn.lead] } : {}), period: ["ytd"] }, href: `${G.href}?team=${drawn.team}${drawn.lead ? `&lead=${drawn.lead}` : ""}` }} />
  );
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={G.icon} tint={G.tint} size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`${G.href}?team=${team}${lead ? `&lead=${lead}` : ""}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT[G.tint].fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>{G.title}</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT[G.tint].fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName({ team, lead, teams })} · year to date ${perWords(c.d, c.per)} · ${G.won}` : G.won}</Typography>
        </Box>
        <TTeams team={team} onTeam={choose} lead={leadKey} onLead={chooseLead} teams={teams} />
      </Box>
      {!c ? <Waiting computing={computing} progress={progress} error={error} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          {shown("months") && months.draw(c, own(months.title(c)))}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.[`nutshell:${G.page}`]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </Box>
      )}
    </GlassCard>
  );
}

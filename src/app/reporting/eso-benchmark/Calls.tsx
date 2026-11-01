"use client";
// THE TSA CALLS PAGE (SARCLA 01.11.2026: "TSA don't do visits, they call, they do qualified calls ... build instead of visits
// on TSA a sub report for calls") - the Visits page for TSA: a qualified call (the call outcome "TSA Qualified Calls", the
// TSA reps' "reached") counts as a completed visit counts on ESO. The same questions: how many, to which companies, of which
// priority - how much of each priority was reached -, the prospects called and did they register and buy, the customers
// called and did they buy again; the direction of the call (outbound / inbound) in the visit type's place; and how many of
// a person's calls were qualified. Qualified calls are in HubSpot since January 2026: nothing to compare with last year.
// The rows and their rules: src/lib/reporting/callsRules.ts and visitsRules.ts; the read: callsReport.ts.
// Second pass (01.11): "is this qualified calls or all calls? call it qualified calls - we really need the distinction"
// (every title says which); "became customers / had bought before / bought again: we need a split - only TSA, TSA & ESO,
// where the customer had also a contact from the sales ESO"; the Direction tab replaced by Overlapping ("how many companies
// get overlapped by user - I want to see it as a diagram and a specialized tab"); and "on calls, when you switch to ESO the
// visits should appear and vice versa - the only one that swaps" (CallsOrVisits, at the end).

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import PhoneInTalkOutlinedIcon from "@mui/icons-material/PhoneInTalkOutlined";
import CallMadeOutlinedIcon from "@mui/icons-material/CallMadeOutlined";
import PercentOutlinedIcon from "@mui/icons-material/PercentOutlined";
import JoinInnerOutlinedIcon from "@mui/icons-material/JoinInnerOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { DimChart, THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { everyWhileSeen } from "@/app/reporting/marketing-kpis/data";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { formatOf, placementOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import type { SlowState } from "@/lib/integrations/slowReport";
import {
  BEFORE, CO, REG_WAY, V, blank, coverageOf, dayWin, daysIn, daysOf, isoOf, labelOf, rowsOf, statsBy, visitedCompanies, ymd,
  type VDim, type VFilters, type VStats, type VWin,
} from "@/lib/reporting/visitsRules";
import { NO_COMPANY, WITH_ESO, allCallsOf, esoSideOf, overlapOf, type CallsData } from "@/lib/reporting/callsRules";
import { VisitsExplorer } from "./Visits";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  CardFilterFor, ChartBox, FullTable, H1, Leaderboard, NoLeadYet, TARGET, TWO, Teams, asTeam, axisWidth, leadOf, niceTop, setQuery, teamWord, useLead, useLeads, useTeam,
  type BoardRow, type CardFilter, type Col, type LeadKey, type TeamKey,
} from "./Figures";
import { ActiveFilters, PeriodPicker, quartersOf, type ActiveItem } from "./EsoFilters";
import { CompaniesFor, type CompanySource } from "@/app/reporting/CompanyList";
import { BucEmpty } from "./BucEmpty";

/* ── the read ──────────────────────────────────────────────────────────── */

function useCalls(): { d: CallsData | null; computing: boolean; progress?: string; error?: string } {
  const [st, setSt] = useState<{ state?: SlowState<CallsData>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/tsa-calls").then((r) => r.json())
      .then((j: { state?: SlowState<CallsData>; error?: string }) => {
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
const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* ── the period: this year's months, or any days of it ─────────────────── */

// SARCLA 31.10.2026: "put every quarter to be easy to select and really custom dates with a mini calendar" - a call has its
// day, so the calendar picks days; a range of days keeps them (VWin d0/d1), whole months stay the months as before.
type VPer = { win: VWin; id: string; title: string; months: number };
const nowMonth = (d: CallsData) => Number(d.today.slice(5, 7)) - 1;
const todayDay = (d: CallsData) => Number(d.today.slice(8, 10));
function presetsOf(d: CallsData): { id: string; label: string; win: VWin }[] {
  const m = nowMonth(d);
  const out = [{ id: "ytd", label: "Year to date", win: { from: 0, to: m } }, { id: "mtd", label: "Month to date", win: { from: m, to: m } }];
  if (m > 0) out.push({ id: "lm", label: `${MONTHS_FULL[m - 1]} ${d.year}`, win: { from: m - 1, to: m - 1 } });
  // every quarter, the running one to date (the read runs to its day) - not only the finished ones
  for (const q of quartersOf(d.year, m, true)) if (!q.disabled) out.push({ id: q.id, label: q.label, win: { from: q.from, to: q.to } });
  return out;
}
/** Days as words: "3 Mar – 17 May 2026", "3 – 17 Mar 2026", "5 Mar 2026" (yyyymmdd) */
function rangeWords(a: number, b: number) {
  const day = (n: number) => n % 100, mon = (n: number) => MONTHS[(Math.floor(n / 100) % 100) - 1], yr = (n: number) => Math.floor(n / 10000);
  if (a === b) return `${day(a)} ${mon(a)} ${yr(a)}`;
  if (Math.floor(a / 100) === Math.floor(b / 100)) return `${day(a)} – ${day(b)} ${mon(b)} ${yr(b)}`;
  return yr(a) === yr(b) ? `${day(a)} ${mon(a)} – ${day(b)} ${mon(b)} ${yr(b)}` : `${day(a)} ${mon(a)} ${yr(a)} – ${day(b)} ${mon(b)} ${yr(b)}`;
}
function perOf(d: CallsData, win: VWin): VPer {
  if (win.d0 && win.d1) return { win, id: `d${win.d0}-${win.d1}`, title: rangeWords(win.d0, win.d1), months: win.to - win.from + 1 };
  const p = presetsOf(d).find((x) => x.win.from === win.from && x.win.to === win.to);
  const title = p?.id === "ytd" ? "year to date" : p?.id === "mtd" ? "month to date" : p ? p.label : `${MONTHS[win.from]}–${MONTHS[win.to]} ${d.year}`;
  return { win, id: p?.id ?? `m${win.from}-${win.to}`, title, months: win.to - win.from + 1 };
}
/** "1 Jan – 27 Oct 2026", "Apr–Jun 2026", a range of days as it is */
function perWords(d: CallsData, per: VPer) {
  if (per.win.d0 && per.win.d1) return rangeWords(per.win.d0, per.win.d1);
  const run = per.win.to === nowMonth(d);
  if (per.win.from === per.win.to) return run ? `1 – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS_FULL[per.win.from]} ${d.year}`;
  return run ? `1 ${MONTHS[per.win.from]} – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS[per.win.from]}–${MONTHS[per.win.to]} ${d.year}`;
}
const perCap = (p: VPer) => p.title.charAt(0).toUpperCase() + p.title.slice(1);
/** the period with its days, once: "Year to date · 1 Jan – 27 Oct 2026", "3 Mar – 17 May 2026" */
const perFull = (d: CallsData, per: VPer) => (perCap(per) === perWords(d, per) ? perCap(per) : `${perCap(per)} · ${perWords(d, per)}`);
/** the period's last day: "27 Oct 2026" while it runs, "30 Jun 2026", a range's own */
const perEnd = (d: CallsData, per: VPer) => { const b = daysOf(d, per.win)[1]; return rangeWords(b, b); };
/** the months a period spans, a month cut short - the running one, the ends of a range of days - as far as it goes */
function monthsDone(d: CallsData, per: VPer) {
  const [a, b] = daysOf(d, per.win);
  let n = 0;
  for (let m = per.win.from; m <= per.win.to; m++) {
    const len = daysIn(d.year, m);
    n += ((m === per.win.to ? b % 100 : len) - (m === per.win.from ? a % 100 : 1) + 1) / len;
  }
  return n;
}
/** A month of the period as a column's head: "Mar", or the days a range of days cuts it to, "5–31 Mar" */
function monthHead(d: CallsData, per: VPer, i: number) {
  const m = per.win.from + i;
  if (!per.win.d0 || !per.win.d1) return MONTHS[m];
  const lo = i === 0 ? per.win.d0 % 100 : 1, hi = m === per.win.to ? per.win.d1 % 100 : daysIn(d.year, m);
  return lo === 1 && hi === daysIn(d.year, m) ? MONTHS[m] : `${lo === hi ? lo : `${lo}–${hi}`} ${MONTHS[m]}`;
}
/** a range of days cuts its first and last month - said under the month by month charts and table */
const cutWords = (c: VCtx) => (c.per.win.d0 ? ` · the first and the last month cut to the days chosen` : "");

/* ── the teams: ESO | TSA | Total by the call's owner, opening on TSA ──── */

/** The people shown: TSA's, ESO's (a line manager's team's), or everyone who called. */
const peopleOf = (d: CallsData, team: TeamKey, lead: string | null, byId: Record<string, string>) => new Set(d.people.flatMap((p, i) => (
  team === "total" ? [i] : team === "eso" ? (p.team === "ESO" && (!lead || byId[p.id] === lead) ? [i] : []) : p.team === "TSA" ? [i] : []
)));
const teamName = (c: { team: TeamKey; lead: string | null; teams: Team[] }) => (c.team === "eso" && c.lead ? c.teams.find((t) => t.id === c.lead)?.name ?? c.lead : teamWord(c.team));
/** Where the page sits: ESO Reports (the Visits page's address, under TSA) or TSA Reports (its own, opening on TSA). */
export type Home = "eso" | "tsa";

/* ── what every chart is drawn with ────────────────────────────────────── */

type VView = "people" | "new" | "prio" | "category" | "overlap" | "country";
const VIEWS: { id: VView; label: string }[] = [
  { id: "people", label: "People" }, { id: "new", label: "Registration" }, { id: "prio", label: "Priority" },
  { id: "category", label: "Customer category" }, { id: "overlap", label: "Overlapping" }, { id: "country", label: "Country" },
];
const isView = (x: string | null): x is VView => VIEWS.some((v) => v.id === x);
const DIM_OF: Record<VView, VDim> = { people: "person", new: "person", prio: "prio", category: "category", overlap: "person", country: "country" };
const DIM: Record<VDim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string }> = {
  person: { name: "Person", lower: "person", icon: <BadgeOutlinedIcon />, tint: "green", note: "Who made the call - the call's owner" },
  prio: { name: "Priority", lower: "priority", icon: <FlagOutlinedIcon />, tint: "purple", note: "The called company's priority: Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500" },
  category: { name: "Customer category", lower: "customer category", icon: <CategoryOutlinedIcon />, tint: "blue", note: "The called company's APSO customer category in HubSpot" },
  kind: { name: "Direction", lower: "direction", icon: <CallMadeOutlinedIcon />, tint: "slate", note: "Outbound: the person called the customer; inbound: the customer called in - as HubSpot logged the call" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where the called company is" },
};
const ORDER: Partial<Record<VDim, readonly string[]>> = {
  prio: ["Prio 1", "Prio 2", "Prio 3", "No priority", NO_COMPANY],
  category: ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "APSOlost", "Growth Engine Customer", "Not set", NO_COMPANY],
};

export type VCtx = {
  d: CallsData; per: VPer; team: TeamKey; lead: string | null; teams: Team[];
  /** the people shown (indexes) */
  people: Set<number>; filters: VFilters; view: VView;
  half?: boolean; targets?: Record<string, number>;
  onBar?: (dim: VDim, label: string) => void; onFilter?: (dim: VDim) => void;
};

const statCache = new WeakMap<VCtx, Map<string, Map<string, VStats>>>();
/** The figures of the period by a breakdown, or all together - kept per drawing. A chart shows only what is filtered
 *  (SARCLA 29.10.2026: "the filter goes but they still keep on top"); the Filters window's lists (all) leave their own out. */
function statsOf(c: VCtx, dim?: VDim, all = false): Map<string, VStats> {
  let memo = statCache.get(c);
  if (!memo) { memo = new Map(); statCache.set(c, memo); }
  const k = `${dim ?? ""}${all ? "*" : ""}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const rows = rowsOf(c.d, c.per.win, c.filters, c.people, all ? dim : undefined);
  const out = statsBy(c.d, rows, c.per.win, dim ? (r) => labelOf(c.d, r, dim) : undefined);
  memo.set(k, out);
  return out;
}
const totalOf = (c: VCtx) => statsOf(c).get("") ?? blank(c.per.months);

/** A chart's target, one per chart, team and period: "tsa-calls:people:visits@tsa~q2" (the year to date without "~"). */
const targetKey = (id: string, team: TeamKey, lead: string | null, per: VPer) => `tsa-calls:${id}@${team}${team === "eso" && lead ? `-${lead}` : ""}${/:months$/.test(id) || per.id === "ytd" ? "" : `~${per.id}`}`;
const targetFor = (c: VCtx, id: string) => { const t = c.targets?.[targetKey(id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/* ── the leaderboards ──────────────────────────────────────────────────── */

type Measure = "visits" | "new" | "registered" | "bought" | "again";
const MEASURE: Record<Measure, { title: string; fmt: (n: number) => string; unit: "n" | "pct" | "eur"; target: string }> = {
  visits: { title: "Qualified calls", fmt: int, unit: "n", target: "qualified calls" },
  new: { title: "Qualified calls to prospects", fmt: int, unit: "n", target: "qualified calls to prospects" },
  registered: { title: "Prospects registered after the qualified call", fmt: int, unit: "n", target: "prospects registered after the qualified call" },
  bought: { title: "Prospects that became customers after the qualified call", fmt: int, unit: "n", target: "prospects that became customers after the qualified call" },
  again: { title: "Customers won back after the qualified call", fmt: int, unit: "n", target: "customers won back after the qualified call" },
};
/** Of the companies called, the ones with revenue this year and how much - not an average over the prospects as well
 *  (SARCLA 28.10.2026 on "Ø revenue this year €534": "figures are completely wrong"). */
const boughtWords = (s: VStats) => (s.buyers ? `${int(s.buyers)} bought this year · ${eur(s.revenue)}` : "none bought this year");
function boardRows(c: VCtx, dim: VDim, m: Measure): BoardRow[] {
  const by = statsOf(c, dim);
  const t = totalOf(c);
  const done = monthsDone(c.d, c.per);
  const rows: BoardRow[] = [];
  for (const [label, s] of by) {
    let cur: number, sub: string;
    if (m === "visits") { cur = s.visits; sub = dim === "person" ? `${int(s.companies)} companies · ${(s.visits / Math.max(done, 0.1)).toFixed(1)} a month` : `${pct(t.visits ? s.visits / t.visits : null)} of the qualified calls · ${int(s.companies)} companies`; }
    else if (m === "new") { cur = s.newVisits; sub = `${int(s.newCompanies)} prospects reached · ${int(s.registeredAfter)} registered · ${int(s.boughtInPeriod)} became customers`; }
    else if (m === "registered") { cur = s.registeredAfter; sub = `${pct(s.newCompanies ? s.registeredAfter / s.newCompanies : null)} of ${int(s.newCompanies)} prospects reached by a qualified call`; }
    else if (m === "bought") { cur = s.boughtInPeriod; sub = `${pct(s.newCompanies ? s.boughtInPeriod / s.newCompanies : null)} of ${int(s.newCompanies)} prospects reached by a qualified call`; }
    else { cur = s.lapsedAgain; sub = `of ${int(s.lapsed)} reached by a qualified call that had not ordered for 12 months or more`; }
    if (!cur) continue;
    rows.push({ label, cur, prev: 0, sub });
  }
  return rows;
}
function Board({ c, id, dim, m, actions }: { c: VCtx; id: string; dim: VDim; m: Measure; actions?: React.ReactNode }) {
  const rows = boardRows(c, dim, m);
  const M = MEASURE[m];
  return (
    <Leaderboard key={`${id}-${c.per.id}`} title={`${M.title} ${c.per.title}, by ${DIM[dim].lower}`} rows={rows} noChange
      curLabel={perWords(c.d, c.per)} prevLabel="" first={c.half ? 8 : 12} fmt={M.fmt} target={targetFor(c, id)}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} actions={actions} />
  );
}

/* ── the months: qualified calls as columns, the target's line ────────── */

/** The people a chart is about: the team's, or the persons filtered. */
const shownPeople = (c: VCtx) => { const f = c.filters.person; if (!f?.length) return c.people; const s = new Set(f); return new Set([...c.people].filter((i) => s.has(c.d.people[i]?.name ?? ""))); };
const signedPct = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x * 100).toFixed(1)}%`;

/** This year's qualified calls as columns, month by month - qualified calls are in HubSpot since January 2026, so no last year. */
function CallMonths({ c, target }: { c: VCtx; target: number | null }) {
  const t = totalOf(c);
  const ly: number[] | null = null;
  const data = t.months.map((v, i) => ({ x: MONTHS[c.per.win.from + i], head: monthHead(c.d, c.per, i), v, prev: ly?.[i] ?? 0, running: c.per.win.from + i === nowMonth(c.d) }));
  const top = niceTop(Math.max(1, target ?? 0, ...data.map((x) => Math.max(x.v, x.prev))));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const done = data.filter((x) => !x.running);
  const reached = target ? done.filter((x) => x.v >= target).length : 0;
  const change = (x: { v: number; prev: number; running: boolean }) => (ly && !x.running && x.prev ? (x.v - x.prev) / x.prev : null);
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: THIS }} />{c.d.year}: qualified calls</Box>
        {ly && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 16, height: 2, borderRadius: 1, bgcolor: INK }} />{c.d.year - 1}, same month</Box>}
        {target && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: INK, fontWeight: 600 }}><Box component="span" sx={{ width: 14, borderTop: `2px dashed ${TARGET}` }} />Target {int(target)} a month · <span style={{ color: reached === done.length ? GREEN : RED }}>{reached} of {done.length} months reached it</span></Box>}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: Math.max(28, axisWidth(top) - 40) }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{int(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 160, maxHeight: 340 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          {target != null && <Box sx={{ position: "absolute", left: 0, right: 0, bottom: `${(target / top) * 100}%`, borderTop: `2px dashed ${TARGET}`, zIndex: 1, pointerEvents: "none" }} />}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((x) => (
              <Box key={x.x} title={`${x.head}${x.running ? " (to date)" : ""}: ${int(x.v)} qualified calls${ly ? ` · ${c.d.year - 1}: ${int(x.prev)}` : ""}${target ? ` · ${pct(x.v / target)} of the target` : ""}`} sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px" }}>
                <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(x.v / top) * 100}%`, bgcolor: THIS, opacity: x.running ? 0.55 : 1, borderRadius: "4px 4px 0 0" }} />
                {ly && x.prev > 0 && <Box sx={{ position: "absolute", bottom: `calc(${(x.prev / top) * 100}% - 1px)`, left: "50%", transform: "translateX(-50%)", width: "76%", maxWidth: 44, height: 2, bgcolor: INK, borderRadius: 1 }} />}
              </Box>
            ))}
          </Box>
        </Box>
        <Box />
        <Box sx={{ display: "flex" }}>
          {data.map((x) => {
            const ch = change(x);
            return (
              <Box key={x.x} sx={{ flex: 1, textAlign: "center", pt: 0.5, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3 }}>{x.x}</Typography>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{int(x.v)}</Typography>
                {ly && <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: ch == null ? FAINT : ch >= 0 ? GREEN : RED, lineHeight: 1.3, whiteSpace: "nowrap" }}>{ch == null ? "—" : signedPct(ch)}</Typography>}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
const monthsHint = (c: VCtx) => `${perWords(c.d, c.per)} · the running month to date, lighter${cutWords(c)} · qualified calls are in HubSpot since January ${c.d.year}, so no ${c.d.year - 1} to compare with · each person's months in the table below`;

/** How much of each priority the qualified calls reached - as the Visits page's (SARCLA 29.10.2026 on the visits by
 *  priority: "P1 is undervalued"): of the companies the people own now, by priority, how many had a qualified call in the
 *  period. */
function CoverageChart({ c, title, actions }: { c: VCtx; title: string; actions?: React.ReactNode }) {
  const chosen = c.filters.prio;
  const rows = coverageOf(c.d, rowsOf(c.d, c.per.win, c.filters, c.people), shownPeople(c))
    .filter((x) => (!chosen?.length || chosen.includes(x.label)) && x.owned > 0)
    .map((x) => ({ ...x, share: x.visited / x.owned }));
  return (
    <DimChart title={title} rows={rows} cur={(r) => r.share} prev={() => 0} curLabel="Share of their companies reached" prevLabel="" fmt={(n) => pct(n)} single fixedOrder labelWidth={110}
      curNote={(r) => ({ text: `${int(r.visited)} of ${int(r.owned)}`, color: MUTED })} selected={chosen}
      onPick={c.onBar ? (l) => c.onBar!("prio", l) : undefined} onFilter={c.onFilter ? () => c.onFilter!("prio") : undefined} filterLabel="Filter by priority" actions={actions} />
  );
}

/** Each part's colour in a split by priority or customer category - in the breakdown's own order */
const PART_COLOR: Record<string, string> = {
  "Prio 1": "#1f4e79", "Prio 2": THIS, "Prio 3": "#8fb4dc", "No priority": "#cfd4db",
  APSOcore: THIS, APSOgrowth: TINT.green.fg, APSOprospect: TINT.amber.fg, APSOmicro: TINT.purple.fg, APSOlost: "#c0605a", "Growth Engine Customer": "#4fa79b", "Not set": "#cfd4db",
  [NO_COMPANY]: "#e6e9ee",
};
/** Each person's qualified calls split by priority or customer category - as the Visits page's (SARCLA 31.10.2026: "on
 *  Priority a graph by person by priority") - every person's calls as one bar, the parts in the breakdown's order. */
function PersonSplit({ c, part }: { c: VCtx; part: VDim }) {
  const [all, setAll] = useState(false);
  const order = ORDER[part] ?? [];
  const by = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const r of rowsOf(c.d, c.per.win, c.filters, c.people)) {
    const who = labelOf(c.d, r, "person"), k = labelOf(c.d, r, part);
    const m = by.get(who) ?? new Map<string, number>();
    m.set(k, (m.get(k) ?? 0) + 1);
    by.set(who, m);
    totals.set(k, (totals.get(k) ?? 0) + 1);
  }
  const parts = [...order.filter((k) => totals.has(k)), ...[...totals.keys()].filter((k) => !order.includes(k))];
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  const rows = [...by].map(([label, m]) => ({ label, m, n: [...m.values()].reduce((a, b) => a + b, 0) })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const max = Math.max(1, ...rows.map((r) => r.n));
  const first = c.half ? 8 : 12;
  const shown = all ? rows : rows.slice(0, first);
  const color = (k: string, i: number) => PART_COLOR[k] ?? ["#7a8aa0", "#b38b5d", "#6b9e6b", "#9a7ab8"][i % 4];
  const lead = parts[0];
  return (
    <Box sx={{ display: "grid", gap: 1.1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap" }}>
        {parts.map((k, i) => (
          <Box key={k} component={c.onBar ? "button" : "div"} {...(c.onBar ? { type: "button" as const, onClick: () => c.onBar!(part, k) } : {})}
            sx={{ display: "flex", alignItems: "center", gap: 0.75, border: 0, bgcolor: "transparent", font: "inherit", p: 0, cursor: c.onBar ? "pointer" : "default" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color(k, i) }} />
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{k} <b style={{ color: INK }}>{int(totals.get(k) ?? 0)}</b> {pct(total ? (totals.get(k) ?? 0) / total : null)}</Typography>
          </Box>
        ))}
      </Box>
      {rows.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No qualified calls under these filters.</Typography>}
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {shown.map((r) => (
          <Box key={r.label} {...(c.onBar ? { component: "button" as const, type: "button" as const, onClick: () => c.onBar!("person", r.label) } : {})}
            sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(110px, 0.9fr) minmax(40px, 2fr) auto" }, gap: { xs: 0.4, sm: 1.25 }, alignItems: "center", border: 0, bgcolor: "transparent", font: "inherit", textAlign: "left", cursor: c.onBar ? "pointer" : "default", borderRadius: "8px", px: 0.5, py: 0.25, "&:hover": c.onBar ? { bgcolor: "rgba(21,34,58,.04)" } : {} }}>
            <Typography noWrap title={r.label} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{r.label}</Typography>
            <Box sx={{ display: "flex", gap: "2px", height: 16, width: `${(r.n / max) * 100}%`, minWidth: 6 }}>
              {parts.map((k, i) => (r.m.get(k) ?? 0) > 0 && (
                <Box key={k} title={`${r.label} - ${k}: ${int(r.m.get(k)!)} (${pct(r.m.get(k)! / r.n)})`} sx={{ flex: `${r.m.get(k)} 0 0`, minWidth: 2, bgcolor: color(k, i), "&:first-of-type": { borderRadius: "3px 0 0 3px" }, "&:last-of-type": { borderRadius: "0 3px 3px 0" } }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: "0.8rem", color: INK, textAlign: { sm: "right" }, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}><b>{int(r.n)}</b>{lead && <span style={{ color: FAINT }}> · {pct((r.m.get(lead) ?? 0) / r.n)} {lead}</span>}</Typography>
          </Box>
        ))}
      </Box>
      {rows.length > first && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${first}` : `Show all ${rows.length}`}</Button>}
    </Box>
  );
}

/** A few answers as bars: each one's count and its share of a base. */
function Bars({ items, empty }: { items: { label: string; n: number; of: number }[]; empty: string }) {
  const max = Math.max(1, ...items.map((x) => x.n));
  if (!items.length || items.every((x) => !x.of)) return <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>{empty}</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.6 }}>
      {items.map((x) => (
        <Box key={x.label} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(80px, 1fr) 130px", gap: 1, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>{x.label}</Typography>
          <Box sx={{ height: 10, borderRadius: 5, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(x.n / max) * 100}%`, bgcolor: THIS }} /></Box>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{int(x.n)} <span style={{ color: MUTED, fontWeight: 500 }}>{x.of !== x.n || items.length > 1 ? `${pct(x.of ? x.n / x.of : null)}` : ""}</span></Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Registration, in the Visits page's questions (SARCLA 27.10.2026) for the qualified calls: how many to prospects, how many
 *  of them registered after the qualified call, in what way, how many became customers - from the shop's registration day
 *  and the first order's day against the call's; the customers that had ordered before - still buying or not retained - and
 *  did they again. The last three split by whether ESO reached the company too (SARCLA 01.11.2026: "we need a split - only
 *  TSA, TSA & ESO, where the customer had also a contact from the sales ESO"). */
const callWords = (x: string) => x.replace(/the visit/g, "the qualified call");
/** "Only TSA" / "TSA & ESO", said out */
const SIDE_WORDS: Record<(typeof WITH_ESO)[number], string> = { "Only TSA": "Only TSA - no ESO visit or call", "TSA & ESO": "TSA & ESO - an ESO visit or call too" };
/** A few figures side by side: each row's count of its base, per side and together. */
function SplitTable({ rows, base }: { rows: { label: string; cells: [number, number][] }[]; base: string }) {
  const cols = [...WITH_ESO, "Together"];
  return (
    <Box sx={{ display: "grid", gap: 0.4, overflowX: "auto" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(170px, 1.4fr) repeat(3, minmax(108px, 1fr))", gap: 1, minWidth: 520 }}>
        <span />
        {cols.map((h) => <Typography key={h} sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>{h}</Typography>)}
        {rows.map((r) => [
          <Typography key={`${r.label}-l`} sx={{ fontSize: "0.84rem", color: INK }}>{r.label}</Typography>,
          ...r.cells.map(([n, of], i) => (
            <Typography key={`${r.label}-${i}`} sx={{ fontSize: "0.84rem", color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              <b>{int(n)}</b> <span style={{ color: MUTED }}>of {int(of)} · {pct(of ? n / of : null)}</span>
            </Typography>
          )),
        ])}
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{base}</Typography>
    </Box>
  );
}
function Answers({ c }: { c: VCtx }) {
  const t = totalOf(c);
  const end = daysOf(c.d, c.per.win)[1];
  const split = statsBy(c.d, rowsOf(c.d, c.per.win, c.filters, c.people), c.per.win, (r) => esoSideOf(c.d, r, end));
  const sides = WITH_ESO.map((k) => split.get(k) ?? blank(c.per.months));
  const ways = t.newCompanies ? REG_WAY.map((w) => ({ label: callWords(w), n: t.regWays[w] ?? 0, of: t.newCompanies })) : [];
  const q = (n: number, text: string) => (
    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}><span style={{ color: FAINT, marginRight: 8 }}>{n}</span>{text}</Typography>
  );
  const a = (main: string, rest?: string) => (
    <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{main}{rest && <span style={{ fontSize: "0.82rem", fontWeight: 500, color: MUTED }}> {rest}</span>}</Typography>
  );
  const row = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(260px, 1fr) minmax(0, 1.4fr)" }, gap: { xs: 0.5, md: 2 }, alignItems: "start", py: 1.25, borderBottom: `1px solid ${HAIRLINE}` } as const;
  const eso = `ESO: a completed visit by ESO or a call by someone on ESO, ${c.d.year} to ${perEnd(c.d, c.per)}${c.d.esoRead === false ? " - ESO's visits could not be read, its calls only" : ""}`;
  return (
    <Box sx={{ display: "grid" }}>
      <Box sx={row}>{q(1, "How many qualified calls to prospects?")}{a(`${int(t.newVisits)} qualified calls`, `to ${int(t.newCompanies)} prospects - companies that had never ordered before the day of the qualified call`)}</Box>
      <Box sx={row}>{q(2, "How many of them registered after the qualified call?")}{a(int(t.registeredAfter), `${pct(t.newCompanies ? t.registeredAfter / t.newCompanies : null)} of the ${int(t.newCompanies)} prospects - registered in the shop on the day of the qualified call or after it, by ${perEnd(c.d, c.per)}`)}</Box>
      <Box sx={row}>
        {q(3, "In what way?")}
        <Bars items={ways} empty="No prospect reached by a qualified call in this period." />
      </Box>
      <Box sx={row}>
        {q(4, "How many of them became customers?")}
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {a(int(t.boughtInPeriod), `${pct(t.newCompanies ? t.boughtInPeriod / t.newCompanies : null)} of the ${int(t.newCompanies)} prospects - their first order on the day of the qualified call or after it, by ${perEnd(c.d, c.per)}`)}
          <Bars items={WITH_ESO.map((k, i) => ({ label: `${SIDE_WORDS[k]} · of ${int(sides[i].newCompanies)} prospects`, n: sides[i].boughtInPeriod, of: sides[i].newCompanies }))} empty="No prospect reached by a qualified call in this period." />
          <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{eso}</Typography>
        </Box>
      </Box>
      <Box sx={row}>
        {q(5, "How many of the companies reached by a qualified call had bought before?")}
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {a(int(t.oldCompanies), `companies that had ordered before the day of the qualified call`)}
          <SplitTable base={eso} rows={[
            { label: "Had bought before", cells: [[sides[0].oldCompanies, t.oldCompanies], [sides[1].oldCompanies, t.oldCompanies], [t.oldCompanies, t.oldCompanies]] },
            ...BEFORE.map((label, i) => ({ label: callWords(label), cells: [...sides.map((s) => [i ? s.lapsed : s.stillBuying, s.oldCompanies] as [number, number]), [i ? t.lapsed : t.stillBuying, t.oldCompanies] as [number, number]] })),
          ]} />
        </Box>
      </Box>
      <Box sx={{ ...row, borderBottom: 0 }}>
        {q(6, "How many of them bought again after the qualified call?")}
        <SplitTable base={eso} rows={[
          { label: "Still buying - ordered after the qualified call", cells: [...sides.map((s) => [s.stillBuyingAgain, s.stillBuying] as [number, number]), [t.stillBuyingAgain, t.stillBuying]] },
          { label: "Not retained - won back, ordered again after the qualified call", cells: [...sides.map((s) => [s.lapsedAgain, s.lapsed] as [number, number]), [t.lapsedAgain, t.lapsed]] },
        ]} />
      </Box>
    </Box>
  );
}

/* ── overlapping: the same company called by several people ───────────── */

/** The companies called by one, two, three or more of the people shown - every call logged with a company. */
function OverlapBands({ c }: { c: VCtx }) {
  const o = overlapOf(c.d, c.per.win, shownPeople(c));
  const all = o.bands.reduce((x, b) => x + b.companies, 0);
  const label = (n: number) => (n === 1 ? "Called by one person" : n === 2 ? "Called by two people" : "Called by three people or more");
  return (
    <Box sx={{ display: "grid", gap: 0.9 }}>
      <Bars items={o.bands.map((b) => ({ label: `${label(b.people)} · ${int(b.calls)} calls`, n: b.companies, of: all }))} empty="No calls with a company under these filters." />
      <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{int(all)} companies called{o.noCompany ? ` · ${int(o.noCompany)} calls without a company cannot overlap` : ""}</Typography>
    </Box>
  );
}
/** Who overlaps with whom, as a diagram: each pair of people and the companies both called - the darker, the more; on the
 *  diagonal each person's own companies. */
function OverlapMatrix({ c }: { c: VCtx }) {
  const o = overlapOf(c.d, c.per.win, shownPeople(c));
  const who = [...o.persons].sort((a, b) => b[1].companies - a[1].companies).map(([p]) => p);
  const name = (p: number) => c.d.people[p]?.name ?? "Unknown";
  const both = (a: number, b: number) => (a === b ? o.persons.get(a)?.companies ?? 0 : o.pairs.get(a < b ? `${a}|${b}` : `${b}|${a}`) ?? 0);
  const max = Math.max(1, ...who.flatMap((a) => who.filter((b) => b !== a).map((b) => both(a, b))));
  if (!who.length) return <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No calls with a company under these filters.</Typography>;
  const cell = 64;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: `minmax(130px, 170px) repeat(${who.length}, ${cell}px)`, gap: "3px", alignItems: "stretch", width: "max-content" }}>
          <span />
          {who.map((b) => <Typography key={`h${b}`} title={name(b)} sx={{ fontSize: "0.7rem", fontWeight: 600, color: MUTED, textAlign: "center", lineHeight: 1.2, alignSelf: "end", pb: 0.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{name(b)}</Typography>)}
          {who.map((a) => [
            <Typography key={`r${a}`} noWrap title={name(a)} sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK, alignSelf: "center", pr: 1 }}>{name(a)}</Typography>,
            ...who.map((b) => {
              const n = both(a, b), self = a === b;
              const share = self ? 0 : n / max;
              return (
                <Box key={`${a}-${b}`} title={self ? `${name(a)} called ${int(n)} companies` : `${name(a)} and ${name(b)} both called ${int(n)} companies`}
                  sx={{ height: 40, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", border: self ? `1px solid ${HAIRLINE}` : 0,
                    bgcolor: self ? "#fff" : n ? `rgba(192, 57, 43, ${0.08 + share * 0.82})` : "rgba(21,34,58,.03)" }}>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: self ? MUTED : share > 0.55 ? "#fff" : n ? INK : FAINT }}>{n ? int(n) : "—"}</Typography>
                </Box>
              );
            }),
          ])}
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>Each cell: the companies both people called in the period - the darker, the more. On the diagonal, in white: the companies the person called.</Typography>
    </Box>
  );
}
/** Per person: how much of the calling lands on companies another person shown called too. */
function OverlapTable({ c }: { c: VCtx }) {
  const o = overlapOf(c.d, c.per.win, shownPeople(c));
  type ORow = { label: string; calls: number; companies: number; shared: number; sharedCalls: number };
  const rows: ORow[] = [...o.persons].map(([p, x]) => ({ label: c.d.people[p]?.name ?? "Unknown", ...x }));
  const all = o.bands.reduce((x, b) => x + b.companies, 0), sharedCos = o.bands[1].companies + o.bands[2].companies;
  const total: ORow = { label: "Total", calls: rows.reduce((x, r) => x + r.calls, 0), companies: all, shared: sharedCos, sharedCalls: o.bands[1].calls + o.bands[2].calls };
  const cols: Col<ORow>[] = [
    { key: "calls", head: "Calls logged on a company", tip: "Every call the person logged with a company, whatever its outcome", cell: (r) => int(r.calls), sort: (r) => r.calls },
    { key: "companies", head: "Companies called", cell: (r) => int(r.companies), sort: (r) => r.companies },
    { key: "shared", head: "Also called by another", tip: "Of them, companies someone else shown called too in the period", cell: (r) => int(r.shared), sort: (r) => r.shared },
    { key: "share", head: "Share overlapping", cell: (r) => pct(r.companies ? r.shared / r.companies : null), sort: (r) => (r.companies ? r.shared / r.companies : -1) },
    { key: "sharedCalls", head: "Calls on those companies", tip: "The person's calls to companies someone else called too", cell: (r) => int(r.sharedCalls), sort: (r) => r.sharedCalls },
  ];
  return <FullTable key={`ov-${c.per.id}-${c.team}`} first="Person" cols={cols} initial="shared" rows={rows} total={total} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" />;
}
/** The companies behind the overlap: called by two people or more, the most people first - who called it how often. */
function overlapListOf(c: VCtx): CompanySource | null {
  const ids = c.d.companyIds, names = c.d.companyNames;
  if (!ids || !names) return null;
  const o = overlapOf(c.d, c.per.win, shownPeople(c));
  return {
    key: `calls-overlap|${c.d.generatedAt}|${c.per.id}|${c.per.win.from}-${c.per.win.to}|${c.per.win.d0 ?? ""}-${c.per.win.d1 ?? ""}|${[...shownPeople(c)].join(",")}`,
    head: ["People", "Calls", "Called by", "Last call", `Revenue ${c.d.year}`], left: [3],
    note: `${perWords(c.d, c.per)} · the companies called by two people or more - every call logged, whatever its outcome - the most people first`,
    rows: o.shared.map((x) => ({
      id: ids[x.ci] ?? null, name: names[x.ci] ?? `Company ${x.ci + 1}`,
      cells: [int(x.by.size), int(x.calls), [...x.by].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${c.d.people[p]?.name ?? "Unknown"} (${n})`).join(", "), dayWords(x.last), eur(c.d.companies[x.ci]?.[CO.revenue] ?? 0)],
      values: [x.by.size, x.calls, null, x.last, c.d.companies[x.ci]?.[CO.revenue] ?? 0],
    })),
  };
}

/* ── every chart by its key ────────────────────────────────────────────── */

type TargetOf = { unit: "eur" | "pct" | "n"; label: string };
type Drawn = { id: string; title: (c: VCtx) => string; draw: (c: VCtx, actions?: React.ReactNode) => React.ReactNode; target?: (c: VCtx) => TargetOf };
const teamPart = (c: VCtx) => ` - ${teamName(c)}`;
const forWhom = (c: VCtx) => `${teamName(c)}'s target for ${c.per.title} - each team and period its own`;
/** A chart by its id - with the companies its qualified calls went to, its "Companies" button beside its filter (SARCLA
 *  31.10.2026: "next to each report ... a new icon Company ... allow to see the companies, paginated by 25"). */
function drawnOf(id: string): Drawn | undefined {
  const d = drawnBare(id);
  // the overlap's charts list the companies several people called; every other chart the companies its qualified calls reached
  const list = id.startsWith("overlap:") ? overlapListOf : calledOf;
  return d && { ...d, draw: (c, a) => <CompaniesFor source={list(c)}><CardFilterFor filter={cardFilterOf(c, id)}>{d.draw(c, a)}</CardFilterFor></CompaniesFor> };
}
/** A graph's filter where it has no breakdown of its own (the months, the splits, the tables): the page's filters on the
 *  graph's breakdown, or the tab's (SARCLA 01.11.2026: "both should be company and filter"). */
function cardFilterOf(c: VCtx, id: string): CardFilter | null {
  const [v, chart = ""] = id.split(":");
  if (!c.onFilter || !isView(v)) return null;
  const dim: VDim = DIM_OF[v];
  return { open: () => c.onFilter!(dim), label: `Filter by ${DIM[dim].lower}`, on: Object.values(c.filters).some((x) => (x?.length ?? 0) > 0) };
}
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** 20261012 -> "12 Oct 2026" */
const dayWords = (day: number) => `${day % 100} ${SHORT_MONTHS[(Math.floor(day / 100) % 100) - 1] ?? ""} ${Math.floor(day / 10000)}`;
/** The companies the chart's qualified calls went to: the period, team, people and filters of the chart, the most called first. */
function calledOf(c: VCtx): CompanySource | null {
  const ids = c.d.companyIds, names = c.d.companyNames;
  if (!ids || !names) return null;
  const rows = rowsOf(c.d, c.per.win, c.filters, c.people);
  const { companies, noCompany } = visitedCompanies(c.d, rows);
  const prioOf = new Map<number, string>(), countryOf = new Map<number, string>();
  for (const r of rows) {
    if (r[V.company] < 0) continue;
    prioOf.set(r[V.company], labelOf(c.d, r, "prio"));
    countryOf.set(r[V.company], labelOf(c.d, r, "country"));
  }
  return {
    key: `calls|${c.d.generatedAt}|${c.per.id}|${c.per.win.from}-${c.per.win.to}|${c.per.win.d0 ?? ""}-${c.per.win.d1 ?? ""}|${[...c.people].join(",")}|${JSON.stringify(c.filters)}`,
    head: ["Qualified calls", "Last qualified call", `Revenue ${c.d.year}`, "Called by", "Country", "Priority"], left: [4, 5, 6],
    note: `${perWords(c.d, c.per)} · the companies reached by a qualified call, the most calls first${noCompany ? ` · ${noCompany.toLocaleString("en")} qualified call${noCompany === 1 ? "" : "s"} without a company are not on the list` : ""}`,
    rows: companies.map((x) => ({
      id: ids[x.ci] ?? null, name: names[x.ci] ?? `Company ${x.ci + 1}`,
      cells: [x.visits.toLocaleString("en"), dayWords(x.last), eur(c.d.companies[x.ci]?.[CO.revenue] ?? 0), x.people.map((p) => c.d.people[p]?.name ?? "").filter(Boolean).join(", "), countryOf.get(x.ci) ?? "", prioOf.get(x.ci) ?? ""],
      // the last call by its day, not its words
      values: [x.visits, x.last, c.d.companies[x.ci]?.[CO.revenue] ?? 0, null, null, null],
    })),
  };
}
/** A chart by its id "<tab>:<what>[-<breakdown>]" - the Visits page's ids: people:visits, kind:kinds-person, new:answers,
 *  people:months, the tables people:table, people:months-table… */
function drawnBare(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  if (chart === "months") {
    const title = (c: VCtx) => `Qualified calls ${c.per.title}, month by month${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={monthsHint(c)} actions={a}><CallMonths c={c} target={targetFor(c, id)} /></ChartBox>,
      target: (c) => ({ unit: "n", label: `Each month's qualified calls are measured against it - a line across the months; the running month is not counted · ${teamName(c)}'s target.` }) };
  }
  if (chart === "answers") {
    const title = (c: VCtx) => `Prospects and customers reached by a qualified call - did they register, did they buy, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · qualified calls only (the outcome "TSA Qualified Calls") · prospects: companies that had never ordered before the day of the qualified call; registered: the shop's registration date against the qualified call's; became customers: a first order on the day of the qualified call or after it, by ${perEnd(c.d, c.per)} · split by whether ESO reached the company too`} actions={a}><Answers c={c} /></ChartBox> };
  }
  if (chart === "coverage") {
    const title = (c: VCtx) => `How much of each priority was reached by a qualified call - of the companies they own, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <CoverageChart c={c} title={title(c)} actions={a} /> };
  }
  if (chart === "bands") {
    const title = (c: VCtx) => `Companies called by one, two, three or more people, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · every call logged with a company, whatever its outcome - not only the qualified ones (as the TSA calls report of September) · by the people shown`} actions={a}><OverlapBands c={c} /></ChartBox> };
  }
  if (chart === "matrix") {
    const title = (c: VCtx) => `Who overlaps with whom - the companies both people called, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · every call logged with a company, whatever its outcome · the companies called by both people of a pair`} actions={a}><OverlapMatrix c={c} /></ChartBox> };
  }
  if (chart === "overlap-table") {
    const title = (c: VCtx) => `Overlapping, ${c.per.title}, by person${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each person's calls logged with a company, the companies called, how many someone else shown called too, and the calls on those`} actions={a}><OverlapTable c={c} /></ChartBox> };
  }
  if (chart === "persons") {
    const part = DIM_OF[v];
    const title = (c: VCtx) => `Qualified calls ${c.per.title}, by person and ${DIM[part].lower}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each person's qualified calls by the called company's ${DIM[part].lower}, the most calls first`} actions={a}><PersonSplit c={c} part={part} /></ChartBox> };
  }
  // every table its own card with its Actions (SARCLA 31.10.2026: "all the tables should be individual KPIs"):
  // people:months-table, country:people-table, and <tab>:table - the People tab's figures by person, the others by their
  // breakdown
  if (chart === "months-table" && v === "people") {
    const title = (c: VCtx) => `Qualified calls month by month, ${c.per.title}, by person${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each person's qualified calls in each month, the running month to date${cutWords(c)}`} actions={a}><PeopleMonths c={c} /></ChartBox> };
  }
  if (chart === "people-table" && v === "country") {
    const title = (c: VCtx) => `Qualified calls by country, ${c.per.title}, by person${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each person's qualified calls in the eight countries with the most calls, the other countries together - they add up to each person`} actions={a}><CountryTable c={c} /></ChartBox> };
  }
  if (chart === "table" && v === "people") {
    const title = (c: VCtx) => `All the figures, ${c.per.title}, by person${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each person's qualified calls, all calls logged (whatever the outcome) and the share qualified, companies reached, qualified calls without a company, prospects reached - registered after the qualified call, became customers - and the companies' revenue this year`} actions={a}><PeopleTable c={c} /></ChartBox> };
  }
  if (chart === "table") {
    const dim = DIM_OF[v];
    const title = (c: VCtx) => `All the figures, ${c.per.title}, by ${DIM[dim].lower}${teamPart(c)}`;
    const buyers = dim === "prio" || dim === "person";
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each ${DIM[dim].lower}'s qualified calls and their share, companies reached${buyers ? ", prospects reached, became customers and won back" : ""}`} actions={a}><DimTable c={c} dim={dim} /></ChartBox> };
  }
  if (chart === "share" && v === "people") {
    return { id, title: (c) => `Share of all calls logged that were qualified ${c.per.title}, by person${teamPart(c)}`, draw: (c, a) => <ShareBoard c={c} id={id} actions={a} />,
      target: (c) => ({ unit: "pct", label: `Each person's share of calls qualified ${c.per.title} is measured against it · ${forWhom(c)}.` }) };
  }
  const [what, by] = chart.split("-");
  if (!(what in MEASURE)) return undefined;
  const m = what as Measure;
  const dim: VDim = by && (by in DIM) ? (by as VDim) : DIM_OF[v];
  return { id, title: (c) => `${MEASURE[m].title} ${c.per.title}, by ${DIM[dim].lower}${teamPart(c)}`, draw: (c, a) => <Board c={c} id={id} dim={dim} m={m} actions={a} />,
    target: (c) => ({ unit: MEASURE[m].unit, label: `Each ${DIM[dim].lower}'s ${MEASURE[m].target} ${c.per.title} is measured against it · ${forWhom(c)}.` }) };
}
/** How many of each person's calls were qualified (SARCLA 01.11.2026: "is this qualified calls or all calls? we really need
 *  the distinction") - by the person and the period only. */
function ShareBoard({ c, id, actions }: { c: VCtx; id: string; actions?: React.ReactNode }) {
  const all = allCallsOf(c.d, c.per.win, shownPeople(c));
  const rows: BoardRow[] = [], small: BoardRow[] = [];
  for (const [p, x] of all) (x.calls >= 20 ? rows : small).push({ label: c.d.people[p]?.name ?? "Unknown", cur: x.calls ? x.qualified / x.calls : 0, prev: 0, sub: `${int(x.qualified)} qualified of ${int(x.calls)} calls logged` });
  return (
    <Leaderboard key={`${id}-${c.per.id}`} title={`Share of all calls logged that were qualified ${c.per.title}, by person`} rows={rows} noChange ratio
      curLabel={perWords(c.d, c.per)} prevLabel="" first={c.half ? 8 : 12} fmt={(n) => pct(n)} target={targetFor(c, id)}
      unranked={small.length ? { why: "under 20 calls logged", rows: small } : undefined}
      selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!("person") : undefined} filterLabel="Filter by person" actions={actions} />
  );
}

/* ── the tables ────────────────────────────────────────────────────────── */

type Row = VStats & { label: string; all?: number; qualified?: number };
function PeopleTable({ c }: { c: VCtx }) {
  const by = statsOf(c, "person");
  // every call the person logged in the period, qualified or not - by the person and the period only
  const all = allCallsOf(c.d, c.per.win, shownPeople(c));
  const ofName = (label: string) => all.get(c.d.people.findIndex((p) => p.name === label));
  const rows: Row[] = [...by].map(([label, s]) => ({ label, ...s, all: ofName(label)?.calls ?? 0, qualified: ofName(label)?.qualified ?? 0 }));
  const t = totalOf(c);
  const sum = [...all.values()].reduce((a, x) => ({ calls: a.calls + x.calls, qualified: a.qualified + x.qualified }), { calls: 0, qualified: 0 });
  const total: Row = { label: "Total", ...t, all: sum.calls, qualified: sum.qualified };
  const cols: Col<Row>[] = [
    { key: "visits", head: "Qualified calls", cell: (r) => int(r.visits), sort: (r) => r.visits },
    { key: "all", head: "All calls logged", tip: "Every call the person logged in the period, whatever its outcome - qualified or not", cell: (r) => int(r.all ?? 0), sort: (r) => r.all ?? 0 },
    { key: "share", head: "Qualified", tip: "The share of the person's calls with the outcome \"TSA Qualified Calls\"", cell: (r) => pct(r.all ? (r.qualified ?? 0) / r.all : null), sort: (r) => (r.all ? (r.qualified ?? 0) / r.all : -1) },
    { key: "companies", head: "Companies reached", cell: (r) => int(r.companies), sort: (r) => r.companies },
    { key: "noco", head: "Qualified, without a company", tip: "Qualified calls with no company - neither on the call nor on its contact: to link in HubSpot", cell: (r) => (r.noCompany ? int(r.noCompany) : "—"), sort: (r) => r.noCompany },
    { key: "new", head: "Prospects reached", tip: "Companies that had never ordered before the day of the qualified call", cell: (r) => int(r.newCompanies), sort: (r) => r.newCompanies },
    { key: "reg", head: "Registered after", tip: "Of those, registered in the shop on the day of the qualified call or after it (the shop's registration date)", cell: (r) => int(r.registeredAfter), sort: (r) => r.registeredAfter },
    { key: "bought", head: `Became customers, ${c.per.title}`, tip: "Of those, their first order on the day of the qualified call or after it, by the end of the period", cell: (r) => int(r.boughtInPeriod), sort: (r) => r.boughtInPeriod },
    { key: "rev", head: "Their revenue this year", tip: "This year's revenue of the companies reached", cell: (r) => eur(r.revenue), sort: (r) => r.revenue },
  ];
  return <FullTable key={`people-${c.per.id}-${c.team}`} first="Person" cols={cols} initial="visits" rows={rows} total={total} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" />;
}
/** Each person's qualified calls month by month - as the Visits page's (SARCLA 27.10.2026: "month by month should also be split per sales person"). */
function PeopleMonths({ c }: { c: VCtx }) {
  const by = statsOf(c, "person");
  type MRow = { label: string; months: number[]; visits: number };
  const rows: MRow[] = [...by].map(([label, s]) => ({ label, months: s.months, visits: s.visits }));
  const t = totalOf(c);
  const cols: Col<MRow>[] = [
    ...t.months.map((_, i) => ({ key: `m${i}`, head: monthHead(c.d, c.per, i), cell: (r: MRow) => (r.months[i] ? int(r.months[i]) : "—"), sort: (r: MRow) => r.months[i] ?? 0 })),
    { key: "visits", head: perCap(c.per), cell: (r) => <b>{int(r.visits)}</b>, sort: (r) => r.visits },
  ];
  return <FullTable key={`pm-${c.per.id}-${c.team}`} first="Person" cols={cols} initial="visits" rows={rows} total={{ label: "Total", months: t.months, visits: t.visits }} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" />;
}
function DimTable({ c, dim }: { c: VCtx; dim: VDim }) {
  const by = statsOf(c, dim);
  const t = totalOf(c);
  const order = ORDER[dim];
  const rows: Row[] = [...by].map(([label, s]) => ({ label, ...s }));
  // the new customers by priority, not by category (SARCLA 29.10.2026: "a new customer should not be APSOcore") or country
  const buyers = dim === "prio" || dim === "person";
  const cols: Col<Row>[] = [
    { key: "visits", head: "Qualified calls", cell: (r) => int(r.visits), sort: (r) => r.visits },
    { key: "share", head: "Share of the qualified calls", cell: (r) => pct(t.visits ? r.visits / t.visits : null), sort: (r) => r.visits },
    { key: "companies", head: "Companies reached", cell: (r) => int(r.companies), sort: (r) => r.companies },
    ...(buyers ? [
      { key: "new", head: "Prospects reached", cell: (r: Row) => int(r.newCompanies), sort: (r: Row) => r.newCompanies },
      { key: "bought", head: `Became customers, ${c.per.title}`, cell: (r: Row) => int(r.boughtInPeriod), sort: (r: Row) => r.boughtInPeriod },
      { key: "again", head: "Won back", tip: "Companies that had not ordered for 12 months or more before the qualified call and ordered after it, by the end of the period", cell: (r: Row) => (r.lapsed ? `${int(r.lapsedAgain)} of ${int(r.lapsed)}` : "—"), sort: (r: Row) => r.lapsedAgain },
    ] : []),
  ];
  const sorted = order ? [...rows].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : rows;
  return <FullTable key={`${dim}-${c.per.id}-${c.team}`} first={DIM[dim].name} cols={cols} initial="visits" rows={sorted} total={{ label: "Total", ...t }} natural={!!order}
    selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} find={`a ${DIM[dim].lower}`} />;
}

/** Each person's qualified calls by country - the countries add up to each person (as the Visits page's): the eight with
 *  the most calls as columns, the rest together. */
function CountryTable({ c }: { c: VCtx }) {
  const rows0 = rowsOf(c.d, c.per.win, c.filters, c.people);
  const tot = new Map<string, number>();
  for (const r of rows0) { const k = labelOf(c.d, r, "country"); tot.set(k, (tot.get(k) ?? 0) + 1); }
  const top = [...tot].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  const rest = tot.size - top.length;
  type CRow = { label: string; n: Record<string, number>; visits: number };
  const by = new Map<string, CRow>();
  const total: CRow = { label: "Total", n: {}, visits: 0 };
  for (const r of rows0) {
    const who = labelOf(c.d, r, "person"), k = labelOf(c.d, r, "country"), col = top.includes(k) ? k : "*";
    const e = by.get(who) ?? { label: who, n: {}, visits: 0 };
    e.n[col] = (e.n[col] ?? 0) + 1; e.visits++; by.set(who, e);
    total.n[col] = (total.n[col] ?? 0) + 1; total.visits++;
  }
  const cols: Col<CRow>[] = [
    ...top.map((k) => ({ key: k, head: k, cell: (r: CRow) => (r.n[k] ? int(r.n[k]) : "—"), sort: (r: CRow) => r.n[k] ?? 0 })),
    ...(rest > 0 ? [{ key: "*", head: `The other ${rest} ${rest === 1 ? "country" : "countries"}`, cell: (r: CRow) => (r.n["*"] ? int(r.n["*"]) : "—"), sort: (r: CRow) => r.n["*"] ?? 0 }] : []),
    { key: "visits", head: "Qualified calls", cell: (r) => <b>{int(r.visits)}</b>, sort: (r) => r.visits },
  ];
  return <FullTable key={`ct-${c.per.id}-${c.team}`} first="Person" cols={cols} initial="visits" rows={[...by.values()]} total={total} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" />;
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string, target?: TargetOf) => React.ReactNode;
const draw = (c: VCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c), d.target?.(c))); };

function TabCard({ c, act }: { c: VCtx; act: Act }) {
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const words = perWords(c.d, c.per);
  if (c.view === "people") return (
    <GlassCard sx={card}>
      <CardTitle icon={<BadgeOutlinedIcon />} tint="green" title={`${teamName(c)}, ${c.per.title}`} note={`${words} · qualified calls only (the outcome "TSA Qualified Calls"), by the call's day, by who made the call`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "people:visits")}{draw(c, act, "people:share")}</Box>
      {c.per.months >= 2 && draw(c, act, "people:months")}
      {c.per.months >= 2 && draw(c, act, "people:months-table")}
      {draw(c, act, "people:table")}
    </GlassCard>
  );
  if (c.view === "new") return (
    <GlassCard sx={card}>
      <CardTitle icon={<HowToRegOutlinedIcon />} tint="amber" title={`${teamName(c)}: registration, ${c.per.title}`} note={`${words} · qualified calls only · prospects reached - did they register, how, and did they become customers; the earlier customers - still buying or not retained - and did they buy again; each split by whether ESO reached the company too`} />
      <Box sx={{ mt: -1 }}>{draw(c, act, "new:answers")}</Box>
      <Box sx={TWO}>{draw(c, act, "new:new")}{draw(c, act, "new:registered")}</Box>
      <Box sx={TWO}>{draw(c, act, "new:bought")}{draw(c, act, "new:again")}</Box>
    </GlassCard>
  );
  if (c.view === "prio") return (
    <GlassCard sx={card}>
      <CardTitle icon={<FlagOutlinedIcon />} tint="purple" title={`${teamName(c)} by priority, ${c.per.title}`} note={`${DIM.prio.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "prio:coverage")}{draw(c, act, "prio:visits")}</Box>
      {draw(c, act, "prio:persons")}
      {draw(c, act, "prio:table")}
    </GlassCard>
  );
  if (c.view === "overlap") return (
    <GlassCard sx={card}>
      <CardTitle icon={<JoinInnerOutlinedIcon />} tint="pink" title={`${teamName(c)}: the same company called by several people, ${c.per.title}`} note={`${words} · every call logged with a company, whatever its outcome - not only the qualified ones (as the TSA calls report of September) · "Companies" lists the companies two people or more called`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "overlap:bands")}{draw(c, act, "overlap:overlap-table")}</Box>
      {draw(c, act, "overlap:matrix")}
    </GlassCard>
  );
  const dim = DIM_OF[c.view], dd = DIM[dim];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={dd.icon} tint={dd.tint} title={`${teamName(c)} by ${dd.lower}, ${c.per.title}`} note={`${dd.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, `${c.view}:visits`)}{draw(c, act, `${c.view}:new`)}</Box>
      {dim === "category" && draw(c, act, "category:persons")}
      {dim === "country" && draw(c, act, "country:people-table")}
      {draw(c, act, `${c.view}:table`)}
    </GlassCard>
  );
}
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures top right ─────────────────────────────────────────────── */

type Fig = { id: string; label: string; value: string; sub: string; icon: React.ReactNode; tint: Tint; amount: number; unit: "n" | "pct" | "eur" };
function figuresOf(c: VCtx): Fig[] {
  const t = totalOf(c);
  const done = monthsDone(c.d, c.per);
  const P = c.per.title;
  // how many of the calls were qualified: by the person and the period only - not under the other filters
  const plain = !(["prio", "category", "kind", "country"] as VDim[]).some((k) => c.filters[k]?.length);
  const all = [...allCallsOf(c.d, c.per.win, shownPeople(c)).values()].reduce((a, x) => ({ calls: a.calls + x.calls, qualified: a.qualified + x.qualified }), { calls: 0, qualified: 0 });
  return [
    { id: "fig-visits", label: `Qualified calls ${P}`, value: int(t.visits), sub: `${(t.visits / Math.max(done, 0.1)).toFixed(0)} a month`, icon: <PhoneInTalkOutlinedIcon />, tint: "green", amount: t.visits, unit: "n" },
    { id: "fig-share", label: "Share of all calls logged that were qualified", value: plain ? pct(all.calls ? all.qualified / all.calls : null) : "—", sub: plain ? `${int(all.qualified)} of ${int(all.calls)} calls logged` : "by person and period only - not under these filters", icon: <PercentOutlinedIcon />, tint: "slate", amount: all.calls ? all.qualified / all.calls : 0, unit: "pct" },
    { id: "fig-companies", label: `Companies reached ${P}`, value: int(t.companies), sub: boughtWords(t), icon: <ApartmentOutlinedIcon />, tint: "blue", amount: t.companies, unit: "n" },
    { id: "fig-new", label: "Prospects reached by a qualified call", value: int(t.newCompanies), sub: `${int(t.newVisits)} qualified calls - companies that had never ordered`, icon: <PersonAddAltOutlinedIcon />, tint: "amber", amount: t.newCompanies, unit: "n" },
    { id: "fig-registered", label: "Registered after the qualified call", value: int(t.registeredAfter), sub: `${pct(t.newCompanies ? t.registeredAfter / t.newCompanies : null)} of the prospects reached by a qualified call`, icon: <HowToRegOutlinedIcon />, tint: "purple", amount: t.registeredAfter, unit: "n" },
    { id: "fig-bought", label: `Became customers, ${P}`, value: int(t.boughtInPeriod), sub: `${pct(t.newCompanies ? t.boughtInPeriod / t.newCompanies : null)} of the prospects reached by a qualified call`, icon: <ShoppingCartCheckoutOutlinedIcon />, tint: "green", amount: t.boughtInPeriod, unit: "n" },
  ];
}
function FigureCards({ c, items, actions }: { c: VCtx; items: Fig[]; actions?: (f: Fig) => React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(124px, 1fr))", xl: `repeat(${items.length}, minmax(124px, 1fr))` }, minWidth: 0 }}>
      {items.map((f) => {
        const tgt = actions ? targetFor(c, `panel:${f.id}`) : null;
        return (
          <Box key={f.id} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Badge icon={f.icon} tint={f.tint} size={22} />
              <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
              {actions?.(f)}
            </Box>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
            <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{f.sub}</Typography>
            {tgt != null && <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: f.amount >= tgt ? GREEN : RED }}>{pct(f.amount / tgt)} of the target {f.unit === "pct" ? pct(tgt) : f.unit === "eur" ? eur(tgt) : int(tgt)}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── the Filters window: the period and the breakdowns ─────────────────── */

/** The quick picks, the year's four quarters and a calendar of this year's days (SARCLA 31.10.2026: "put every quarter to
 *  be easy to select and really custom dates with a mini calendar"); a range of whole months is the months, so a quarter
 *  picked on the calendar lights its button. */
function VPeriod({ d, per, onPer }: { d: CallsData; per: VPer; onPer: (w: VWin) => void }) {
  const all = presetsOf(d);
  const winOf = (id: string) => all.find((p) => p.id === id)?.win;
  const [a, b] = daysOf(d, per.win);
  return (
    <PeriodPicker quick={all.filter((p) => !p.id.startsWith("q"))} quarters={quartersOf(d.year, nowMonth(d), true)}
      isOn={(id) => { const w = winOf(id); return !!w && !per.win.d0 && w.from === per.win.from && w.to === per.win.to; }} onChoice={(id) => { const w = winOf(id); if (w) onPer(w); }}
      unit="day" min={`${d.year}-01-01`} max={isoOf(ymd(d.today))} from={isoOf(a)} to={isoOf(b)}
      onRange={(x, y) => onPer(dayWin(d, ymd(x), ymd(y)))}
      note={<>This year&apos;s days: qualified calls are in HubSpot since January {d.year}, so there is no {d.year - 1} to compare with.</>} />
  );
}
function VFacet({ c, dim, onPick }: { c: VCtx; dim: VDim; onPick: (l: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const by = statsOf(c, dim, true);
  const order = ORDER[dim];
  const rows = [...by].map(([label, s]) => ({ label, n: s.visits }));
  rows.sort(order ? (a, b) => order.indexOf(a.label) - order.indexOf(b.label) : (a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const sel = c.filters[dim] ?? [];
  const found = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
  const LIMIT = 8;
  const shown = all || q ? found : [...found.slice(0, LIMIT), ...found.slice(LIMIT).filter((r) => sel.includes(r.label))];
  const max = Math.max(1, ...rows.map((r) => r.n));
  const t = TINT[DIM[dim].tint];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.length > LIMIT && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${DIM[dim].lower}…`} inputProps={{ "aria-label": `Find a ${DIM[dim].lower} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
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
const FILTER_DIMS: VDim[] = ["person", "prio", "category", "country"];
function VFilterWindow({ c, per, open, onClose, focus, onPer, toggle, clearAll }: {
  c: VCtx; per: VPer; open: boolean; onClose: () => void; focus: { dim: VDim; n: number } | null; onPer: (w: VWin) => void; toggle: (d: VDim, l: string) => void; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<VDim | "period", boolean>>>({});
  const isOpen = (k: VDim | "period") => (shut[k] !== undefined ? !shut[k] : k === "period" || k === "person" || !!c.filters[k as VDim]?.length);
  const [live, setLive] = useState(open);
  useEffect(() => { if (open) { setLive(true); return; } const t = setTimeout(() => setLive(false), 320); return () => clearTimeout(t); }, [open]);
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.dim]: false }));
    const t = setTimeout(() => document.getElementById(`cfilter-${focus.dim}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const chosen = FILTER_DIMS.flatMap((d) => (c.filters[d] ?? []).map((v) => [d, v] as const));
  return (
    <FilterPanel id="tsa-calls-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, v]) => <Chip key={`${d}:${v}`} size="small" label={<span><b>{DIM[d].name}:</b> {v}</span>} onDelete={() => toggle(d, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          <FilterSection id="cfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => setShut((s) => ({ ...s, period: isOpen("period") }))} summary={perCap(per)}>
            <VPeriod d={c.d} per={per} onPer={onPer} />
          </FilterSection>
          {FILTER_DIMS.map((dim, i) => (
            <FilterSection key={dim} id={`cfilter-${dim}`} index={i + 1} title={DIM[dim].name} icon={DIM[dim].icon} tint={DIM[dim].tint} open={isOpen(dim)} onFlip={() => setShut((s) => ({ ...s, [dim]: isOpen(dim) }))}
              summary={!c.filters[dim]?.length ? "All" : c.filters[dim]!.length === 1 ? c.filters[dim]![0] : `${c.filters[dim]!.length} chosen`} chosen={!!c.filters[dim]?.length}>
              <VFacet c={c} dim={dim} onPick={(l) => toggle(dim, l)} />
            </FilterSection>
          ))}
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
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The calls could not be read: ${error}` : `Reading this year's calls in HubSpot${progress ? ` · ${progress}` : ""}…`}</Typography>
      </Box>
    </GlassCard>
  );
}
const ym = (d: CallsData, m: number) => `${d.year}-${String(m + 1).padStart(2, "0")}`;
const fromYm = (d: CallsData, x: string | null) => { const m = /^(\d{4})-(\d{2})$/.exec(x ?? ""); return m && Number(m[1]) === d.year ? Number(m[2]) - 1 : null; };
/** The period of an address, or of a card sent to the BUC View: ?from=2026-04&to=2026-06 whole months, as always, or
 *  ?from=2026-03-05&to=2026-05-17 a range of days; a month beside a day, its first or last day. Another year: none (the
 *  year to date). */
function winOfQuery(d: CallsData, from: string | null, to: string | null): VWin | null {
  const a = fromYm(d, from), b = fromYm(d, to), m = nowMonth(d);
  if (a != null && b != null) return { from: Math.min(a, b, m), to: Math.min(Math.max(a, b), m) };
  const day = (x: string | null, last: boolean) => {
    const k = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(x ?? ""), mo = Number(k?.[2]);
    if (!k || Number(k[1]) !== d.year || !(mo >= 1 && mo <= 12)) return null;
    return d.year * 10000 + mo * 100 + (k[3] ? Number(k[3]) : last ? daysIn(d.year, mo - 1) : 1);
  };
  const x = day(from, false), y = day(to, true);
  return x != null && y != null ? dayWin(d, x, y) : null;
}
/** A period as a card's filters: the year to date, a quick pick or a quarter by its id, else its months or days. */
const perFilters = (d: CallsData, per: VPer): Record<string, string[]> => (per.win.d0 && per.win.d1 ? { from: [isoOf(per.win.d0)], to: [isoOf(per.win.d1)] }
  : per.id.startsWith("m") ? { from: [ym(d, per.win.from)], to: [ym(d, per.win.to)] } : { period: [per.id] });

export function CallsExplorer({ team, setTeam, home = "tsa" }: { team: TeamKey; setTeam: (t: TeamKey) => void; home?: Home }) {
  const params = useSearchParams();
  const { d, computing, progress, error } = useCalls();
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  const { state: acts } = useActions("tsa-calls");
  const view: VView = isView(params.get("view")) ? (params.get("view") as VView) : "people";
  const setView = (v: VView) => setQuery((q) => { if (v === "people") q.delete("view"); else q.set("view", v); });
  const filters: VFilters = useMemo(() => Object.fromEntries(FILTER_DIMS.flatMap((k) => (params.getAll(k).length ? [[k, params.getAll(k)]] : []))), [params]);
  const toggle = (k: VDim, label: string) => setQuery((q) => { const cur = q.getAll(k), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]; q.delete(k); for (const x of next) q.append(k, x); });
  const clearAll = () => setQuery((q) => { for (const k of FILTER_DIMS) q.delete(k); q.delete("from"); q.delete("to"); });
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: VDim; n: number } | null>(null);
  const openOn = (k: VDim) => { setFocus((f) => ({ dim: k, n: (f?.n ?? 0) + 1 })); setPanel(true); };
  // the year to date: no from/to; whole months as YYYY-MM, as before; a range of days as YYYY-MM-DD
  const setPer = (w: VWin) => setQuery((q) => {
    if (!d) return;
    const ytd = presetsOf(d)[0].win;
    if (!w.d0 && w.from === ytd.from && w.to === ytd.to) { q.delete("from"); q.delete("to"); }
    else if (w.d0 && w.d1) { q.set("from", isoOf(w.d0)); q.set("to", isoOf(w.d1)); }
    else { q.set("from", ym(d, w.from)); q.set("to", ym(d, w.to)); }
  });

  // the work a click asks for, kept; the tabs and toggles answer at once and the charts follow (as the Figures)
  const lead = leadOf(team, leadKey, lt);
  const fromP = params.get("from"), toP = params.get("to");
  const per = useMemo(() => (d ? perOf(d, winOfQuery(d, fromP, toP) ?? presetsOf(d)[0].win) : null), [d, fromP, toP]);
  const people = useMemo(() => (d ? peopleOf(d, team, lead, lt?.byId ?? {}) : null), [d, team, lead, lt]);
  const want = useMemo(() => ({ view, per, people, team, lead, filters }), [view, per, people, team, lead, filters]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<VCtx | null>(() => (d && drawn.per && drawn.people ? {
    d, per: drawn.per, team: drawn.team, lead: drawn.lead, teams, people: drawn.people, filters: drawn.filters, view: drawn.view, targets: acts?.targets,
    onBar: (k, l) => { toggle(k, l); openOn(k); }, onFilter: openOn,
  } : null), [d, drawn, teams, acts?.targets]); // eslint-disable-line react-hooks/exhaustive-deps
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);

  // back to the BUC View of where the page sits: TSA's, or ESO's (the Visits page's address)
  const back = (
    <Box component={Link} href={`/reporting/${home}-benchmark`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
      <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
    </Box>
  );
  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  if (!d || !c || !per) return (<Box sx={shell}>{back}<Typography component="h1" sx={H1}>Calls</Typography><Waiting computing={computing} progress={progress} error={error} /></Box>);

  const act: Act = (id, title, target) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `tsa-calls:${id}`, page: "tsa-calls", tab: c.view, title, summary: `${teamName(c)} · ${perWords(d, c.per)}`,
        filters: { ...Object.fromEntries(FILTER_DIMS.filter((k) => c.filters[k]?.length).map((k) => [k, c.filters[k] ?? []])), team: [c.team], ...(c.lead ? { lead: [c.lead] } : {}), ...perFilters(d, c.per) },
        kind: "card", target: target ? { key: targetKey(id, c.team, c.lead, c.per), ...target } : undefined }} />
  );
  const now = { team, lead, teams };
  const chosen = FILTER_DIMS.flatMap((k) => (filters[k] ?? []).map((v) => [k, v] as const));
  return (
    <Box sx={shell}>
      {back}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>Calls</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamName(now)}</b> · {per.title === perWords(d, per) ? <b style={{ color: INK }}>{per.title}</b> : <>{per.title} <b style={{ color: INK }}>{perWords(d, per)}</b></>} · qualified calls - the outcome &quot;TSA Qualified Calls&quot;{computing ? " · reading HubSpot again" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}><FigureCards c={c} items={figs} /></Box>
      </Box>
      <Box sx={{ display: "grid", gap: 0.75, mt: -0.5 }}>
        <Teams team={team} onTeam={setTeam} lead={leadKey} onLead={setLead} teams={teams} />
        {lead && people && people.size === 0 && <NoLeadYet name={teamName(now)} />}
      </Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="tsa-calls" tab={view} onSelect={setView} tabs={VIEWS.map((v) => ({ id: v.id, label: v.label, count: v.id !== "people" && v.id !== "new" && filters[DIM_OF[v.id]]?.length ? String(filters[DIM_OF[v.id]]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="tsa-calls" /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else openOn(DIM_OF[view]); }} variant={panel || chosen.length || per.id !== "ytd" ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="tsa-calls-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length || per.id !== "ytd" ? undefined : "#fff" }}>
          Filters{chosen.length + (per.id !== "ytd" ? 1 : 0) ? ` · ${chosen.length + (per.id !== "ytd" ? 1 : 0)}` : ""}
        </Button>
      </Box>
      {/* what the page is filtered by, under the tabs - no more chips under the title (SARCLA 31.10.2026: "where they appear
          on top it is really hard to find them and see them") */}
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearAll} items={[
        ...(per.id !== "ytd" ? [{ key: "period", name: "Period", value: perFull(d, per), tint: "blue" as Tint, onRemove: () => setPer(presetsOf(d)[0].win) }] : []),
        ...chosen.map(([k, v]): ActiveItem => ({ key: `${k}:${v}`, name: DIM[k].name, value: v, tint: DIM[k].tint, onRemove: () => toggle(k, v) })),
      ]} />
      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} act={act} />
      </Box>
      <VFilterWindow c={c} per={per} open={panel} onClose={() => setPanel(false)} focus={focus} onPer={setPer} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── TSA's BUC View: the Calls panel ───────────────────────────────────── */

const PANEL = "tsa-calls:panel:";
const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;

/** Calls in TSA's BUC View (SARCLA 01.11.2026: "move the BUC View with the same principle to TSA reports"): the year to
 *  date for the team the toggle shows, and the Calls charts sent here - no graph of its own, as ESO's panels. */
export function CallsPanel({ acts }: { acts: ActionsState | null }) {
  const { d, computing, progress, error } = useCalls();
  const [team, setTeam] = useState<TeamKey>("tsa");
  const [leadKey, setLeadKey] = useState<LeadKey>("all");
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  const lead = leadOf(team, leadKey, lt);
  const want = useMemo(() => ({ team, lead }), [team, lead]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<VCtx | null>(() => (d ? { d, per: perOf(d, presetsOf(d)[0].win), team: drawn.team, lead: drawn.lead, teams, people: peopleOf(d, drawn.team, drawn.lead, lt?.byId ?? {}), filters: {}, view: "people", targets: acts?.targets } : null),
    [d, drawn, teams, lt, acts?.targets]);
  const items: SortItem[] = useMemo(() => !c ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "tsa-calls" && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const [, tab = "", chart = ""] = spec.key.split(":");
    const ch = drawnOf(`${tab}:${chart}`);
    const fmt = formatOf(acts, spec);
    const f = spec.filters ?? {};
    const sf: VFilters = Object.fromEntries(FILTER_DIMS.flatMap((k) => (f[k]?.length ? [[k, f[k]]] : [])));
    const pid = f.period?.[0], pr = pid ? presetsOf(c.d).find((p) => p.id === pid) : null;
    const qw = winOfQuery(c.d, f.from?.[0] ?? null, f.to?.[0] ?? null);
    const sp = pr ? perOf(c.d, pr.win) : qw ? perOf(c.d, qw) : c.per;
    // every chart here follows the panel's toggle (as the Figures' panel); its filters and period stay as sent
    const sc: VCtx = { ...c, per: sp, filters: sf, view: (spec.tab && isView(spec.tab) ? spec.tab : "people") as VView, half: fmt === "half" };
    const target = ch?.target ? { key: targetKey(ch.id, c.team, c.lead, sp), ...ch.target(sc) } : undefined;
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind, target }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<PhoneInTalkOutlinedIcon />} tint="green" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [c, acts]);
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:tsa-calls", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);
  const shown = (id: string) => placementOf(acts, `${PANEL}${id}`, "nutshell") === "nutshell";
  const href = `/reporting/tsa-benchmark/calls?team=${team}${lead ? `&lead=${lead}` : ""}`;
  const own = (id: string, title: string, target?: { key: string; unit: "eur" | "pct" | "n"; label: string }) => (
    <TileActions where="nutshell" start="nutshell" edge={2} tile={{ key: `${PANEL}${id}`, page: "tsa-calls", tab: "people", title: `${title} - ${c ? teamName(c) : "TSA"}`, kind: "kpi",
      filters: { team: [drawn.team], ...(drawn.lead ? { lead: [drawn.lead] } : {}), period: ["ytd"] }, href, target }} />
  );
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<PhoneInTalkOutlinedIcon />} tint="green" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={href} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.green.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Calls</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.green.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName({ team, lead, teams })} · year to date ${perWords(c.d, c.per)} · qualified calls` : "Qualified calls"}</Typography>
        </Box>
        <Teams team={team} onTeam={setTeam} lead={leadKey} onLead={setLeadKey} teams={teams} />
      </Box>
      {!c ? <Waiting computing={computing} progress={progress} error={error} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          <FigureCards c={c} items={figs.filter((f) => shown(f.id))} actions={(f) => own(f.id, f.label, { key: targetKey(`panel:${f.id}`, c.team, c.lead, c.per), unit: f.unit, label: `${f.label} is measured against it · ${teamName(c)}'s target - each team its own.` })} />
          {items.length > 0 ? <SortableGrid items={items} order={acts?.orders?.["nutshell:tsa-calls"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} /> : <BucEmpty page="Calls" href="/reporting/tsa-benchmark/calls" />}
        </Box>
      )}
    </GlassCard>
  );
}

/* ── the Calls and the Visits: one switch ──────────────────────────────── */

/** The Calls and the Visits swap with the team (SARCLA 01.11.2026: "on calls, when you switch to ESO the visits should
 *  appear and vice versa - this is the only one where we swap the reports"): ESO's visits, TSA's qualified calls; Total
 *  stays the page's own. On TSA Reports the address's team, else TSA; on ESO Reports the one kept across the ESO pages. */
export function CallsOrVisits({ home }: { home: Home }) {
  const params = useSearchParams();
  const kept = useTeam();
  const [team, setTeam]: [TeamKey, (t: TeamKey) => void] = home === "eso" ? kept : [asTeam(params.get("team")) ?? "tsa", (t) => setQuery((q) => q.set("team", t))];
  const calls = team === "tsa" || (team === "total" && home === "tsa");
  return calls ? <CallsExplorer team={team} setTeam={setTeam} home={home} /> : <VisitsExplorer team={team} setTeam={setTeam} home={home} />;
}

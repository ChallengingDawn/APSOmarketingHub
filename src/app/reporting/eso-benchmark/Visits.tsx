"use client";
// THE ESO VISITS PAGE, rebuilt like the Figures (SARCLA 27.10.2026: "review completely the visits" - his pick: "rebuild
// like Figures"). What the old page did wrong: a 2025 column and a change everywhere though HubSpot holds visits only
// since 2026 (all zero, all "—"); ESO only; the complete months only (no October), no period; "Ø potential per visit"
// led by people with 2 and 6 visits, and lifted by HubSpot's placeholder potentials over €1m; people listed with 0 to 2
// visits; paired bars, no targets; read every 12 hours.
// Second pass, the same day: "the TSA button should disappear from visits - they don't do visits, only Marc, so keep
// it for Marc only" (ESO | Total, Total = ESO and Marc Frech); "agreed visits - I don't know what this is" (named, under
// Type of visit); "the potential must be wrong" (the placeholders out; under Priority & potential with the visit reports'
// annual need beside it); "month by month should also be split per sales person" (a person x month table); "never
// ordered should become Registration" - answering: how many visits with new customers? how many of them registered after
// the visit? in what way? how many of them bought in the period? The rows and their rules: src/lib/reporting/visitsRules.ts.
// Third pass (29.10): no companies-visited boards and no potential ("take out the potential value"); a chart shows only what
// is filtered ("the filter goes but they still keep on top"); a visit without a company said so; the real customer
// categories ("no Other"); the months against last year's customer meetings; the customers who had bought before - still
// buying or not retained - and did they buy after the visit; how much of each priority was visited (visits by priority
// made Prio 1 look neglected); the annual need as the middle value, the not ranked shown.
// Fourth pass (29.10, later): "not agreed - call it scheduled"; the type of visit as a split (scheduled, cold, event) by
// person, month and breakdown, "review completely type of visits"; no annual need ("this cannot be the yearly potential");
// no footnote ("take out"); category without the new customers ("a new customer should not be APSOcore"); the country by
// person ("it doesn't match individuals"); "won back" for "not retained that bought again"; the priority chart drawn as
// every other tab's.

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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { DimChart, THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { everyWhileSeen } from "@/app/reporting/marketing-kpis/data";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, placementOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import type { SlowState } from "@/lib/integrations/slowReport";
import {
  BEFORE, KINDS, NO_COMPANY, REG_WAY, blank, coverageOf, dayWin, daysIn, daysOf, isoOf, labelOf, lastYearOf, rowsOf, statsBy, ymd,
  type VDim, type VFilters, type VStats, type VWin, type VisitsData,
} from "@/lib/reporting/visitsRules";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  ChartBox, FullTable, H1, KEPT, KEPT_LEAD, Leaderboard, NoLeadYet, TARGET, TWO, asLead, asTeam, axisWidth, leadOf, niceTop, setQuery, useLead, useLeads, useTeam,
  type BoardRow, type Col, type LeadKey, type TeamKey,
} from "./Figures";
import { ActiveFilters, PeriodPicker, quartersOf, type ActiveItem } from "./EsoFilters";

/* ── the read ──────────────────────────────────────────────────────────── */

function useVisits(): { d: VisitsData | null; computing: boolean; progress?: string; error?: string } {
  const [st, setSt] = useState<{ state?: SlowState<VisitsData>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-visits").then((r) => r.json())
      .then((j: { state?: SlowState<VisitsData>; error?: string }) => {
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

// SARCLA 31.10.2026: "put every quarter to be easy to select and really custom dates with a mini calendar" - a visit has its
// day, so the calendar picks days; a range of days keeps them (VWin d0/d1), whole months stay the months as before.
type VPer = { win: VWin; id: string; title: string; months: number };
const nowMonth = (d: VisitsData) => Number(d.today.slice(5, 7)) - 1;
const todayDay = (d: VisitsData) => Number(d.today.slice(8, 10));
function presetsOf(d: VisitsData): { id: string; label: string; win: VWin }[] {
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
function perOf(d: VisitsData, win: VWin): VPer {
  if (win.d0 && win.d1) return { win, id: `d${win.d0}-${win.d1}`, title: rangeWords(win.d0, win.d1), months: win.to - win.from + 1 };
  const p = presetsOf(d).find((x) => x.win.from === win.from && x.win.to === win.to);
  const title = p?.id === "ytd" ? "year to date" : p?.id === "mtd" ? "month to date" : p ? p.label : `${MONTHS[win.from]}–${MONTHS[win.to]} ${d.year}`;
  return { win, id: p?.id ?? `m${win.from}-${win.to}`, title, months: win.to - win.from + 1 };
}
/** "1 Jan – 27 Oct 2026", "Apr–Jun 2026", a range of days as it is */
function perWords(d: VisitsData, per: VPer) {
  if (per.win.d0 && per.win.d1) return rangeWords(per.win.d0, per.win.d1);
  const run = per.win.to === nowMonth(d);
  if (per.win.from === per.win.to) return run ? `1 – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS_FULL[per.win.from]} ${d.year}`;
  return run ? `1 ${MONTHS[per.win.from]} – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS[per.win.from]}–${MONTHS[per.win.to]} ${d.year}`;
}
const perCap = (p: VPer) => p.title.charAt(0).toUpperCase() + p.title.slice(1);
/** the period with its days, once: "Year to date · 1 Jan – 27 Oct 2026", "3 Mar – 17 May 2026" */
const perFull = (d: VisitsData, per: VPer) => (perCap(per) === perWords(d, per) ? perCap(per) : `${perCap(per)} · ${perWords(d, per)}`);
/** the period's last day: "27 Oct 2026" while it runs, "30 Jun 2026", a range's own */
const perEnd = (d: VisitsData, per: VPer) => { const b = daysOf(d, per.win)[1]; return rangeWords(b, b); };
/** the months a period spans, a month cut short - the running one, the ends of a range of days - as far as it goes */
function monthsDone(d: VisitsData, per: VPer) {
  const [a, b] = daysOf(d, per.win);
  let n = 0;
  for (let m = per.win.from; m <= per.win.to; m++) {
    const len = daysIn(d.year, m);
    n += ((m === per.win.to ? b % 100 : len) - (m === per.win.from ? a % 100 : 1) + 1) / len;
  }
  return n;
}
/** A month of the period as a column's head: "Mar", or the days a range of days cuts it to, "5–31 Mar" */
function monthHead(d: VisitsData, per: VPer, i: number) {
  const m = per.win.from + i;
  if (!per.win.d0 || !per.win.d1) return MONTHS[m];
  const lo = i === 0 ? per.win.d0 % 100 : 1, hi = m === per.win.to ? per.win.d1 % 100 : daysIn(d.year, m);
  return lo === 1 && hi === daysIn(d.year, m) ? MONTHS[m] : `${lo === hi ? lo : `${lo}–${hi}`} ${MONTHS[m]}`;
}
/** a range of days cuts its first and last month - said under the month by month charts and table */
const cutWords = (c: VCtx) => (c.per.win.d0 ? ` · the first and the last month cut to the days chosen` : "");

/* ── the teams: ESO, or everyone who visits (SARCLA: TSA does not visit - only Marc, so his visits stay) ── */

/** Marc Frech (the TSA roster): the one TSA person whose visits count */
const MARC = "817497321";
const visitsAt = (p: { id: string; team: string }) => p.team !== "TSA" || p.id === MARC;
const VTEAMS: { id: TeamKey; label: string; count: null }[] = [{ id: "eso", label: "ESO", count: null }, { id: "total", label: "Total", count: null }];
/** ESO | Total, and under ESO the line managers' teams (no TSA here: TSA does not visit). */
function VTeams({ team, onTeam, lead, onLead, teams }: { team: TeamKey; onTeam: (t: TeamKey) => void; lead: LeadKey; onLead: (l: LeadKey) => void; teams: Team[] }) {
  const t: TeamKey = team === "eso" ? "eso" : "total";
  const tabs: { id: LeadKey; label: string; count: null }[] = [{ id: "all", label: "All ESO", count: null }, ...teams.map((x) => ({ id: x.id, label: x.name, count: null }))];
  return (
    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", justifySelf: "start", minWidth: 0 }}>
      <ReportTabs name="eso-team" tab={t} onSelect={onTeam} tabs={VTEAMS} />
      {t === "eso" && teams.length > 0 && <ReportTabs name="eso-lead" tab={teams.some((x) => x.id === lead) ? lead : "all"} onSelect={onLead} tabs={tabs} />}
    </Box>
  );
}
/** The people shown: ESO's (a line manager's team's), or everyone who visits - ESO, Marc Frech and those outside the rosters. */
const peopleOf = (d: VisitsData, team: TeamKey, lead: string | null, byId: Record<string, string>) => new Set(d.people.flatMap((p, i) => (
  team === "eso" ? (p.team === "ESO" && (!lead || byId[p.id] === lead) ? [i] : []) : visitsAt(p) ? [i] : []
)));
const teamName = (c: { team: TeamKey; lead: string | null; teams: Team[] }) => (c.team === "eso" ? (c.lead ? c.teams.find((t) => t.id === c.lead)?.name ?? c.lead : "ESO") : "ESO and Marc Frech");

/* ── what every chart is drawn with ────────────────────────────────────── */

type VView = "people" | "new" | "prio" | "category" | "kind" | "country";
const VIEWS: { id: VView; label: string }[] = [
  { id: "people", label: "People" }, { id: "new", label: "Registration" }, { id: "prio", label: "Priority" },
  { id: "category", label: "Customer category" }, { id: "kind", label: "Type of visit" }, { id: "country", label: "Country" },
];
const isView = (x: string | null): x is VView => VIEWS.some((v) => v.id === x);
const DIM_OF: Record<VView, VDim> = { people: "person", new: "person", prio: "prio", category: "category", kind: "kind", country: "country" };
const DIM: Record<VDim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string }> = {
  person: { name: "Person", lower: "person", icon: <BadgeOutlinedIcon />, tint: "green", note: "Who made the visit - the visit's owner" },
  prio: { name: "Priority", lower: "priority", icon: <FlagOutlinedIcon />, tint: "purple", note: "The visited company's priority: Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500" },
  category: { name: "Customer category", lower: "customer category", icon: <CategoryOutlinedIcon />, tint: "blue", note: "The visited company's APSO customer category in HubSpot" },
  kind: { name: "Type of visit", lower: "type of visit", icon: <HandshakeOutlinedIcon />, tint: "slate", note: "Scheduled with the customer in advance, cold (unannounced), or at an event - as the visit report says" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where the visited company is" },
};
const ORDER: Partial<Record<VDim, readonly string[]>> = {
  prio: ["Prio 1", "Prio 2", "Prio 3", "No priority", NO_COMPANY], kind: KINDS,
  category: ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "APSOlost", "Growth Engine Customer", "Not set", NO_COMPANY],
};

export type VCtx = {
  d: VisitsData; per: VPer; team: TeamKey; lead: string | null; teams: Team[];
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

/** A chart's target, one per chart, team and period: "eso-visits:people:visits@eso-RABE~q2" (the year to date without "~"). */
const targetKey = (id: string, team: TeamKey, lead: string | null, per: VPer) => `eso-visits:${id}@${team === "eso" ? "eso" : "total"}${team === "eso" && lead ? `-${lead}` : ""}${/:months$/.test(id) || per.id === "ytd" ? "" : `~${per.id}`}`;
const targetFor = (c: VCtx, id: string) => { const t = c.targets?.[targetKey(id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/* ── the leaderboards ──────────────────────────────────────────────────── */

type Measure = "visits" | "new" | "registered" | "bought" | "again";
const MEASURE: Record<Measure, { title: string; fmt: (n: number) => string; unit: "n" | "pct" | "eur"; target: string }> = {
  visits: { title: "Completed visits", fmt: int, unit: "n", target: "completed visits" },
  new: { title: "Visits with new customers", fmt: int, unit: "n", target: "visits with new customers" },
  registered: { title: "New customers registered after the visit", fmt: int, unit: "n", target: "new customers registered after the visit" },
  bought: { title: "New customers that bought after the visit", fmt: int, unit: "n", target: "new customers that bought after the visit" },
  again: { title: "Customers won back after the visit", fmt: int, unit: "n", target: "customers won back after the visit" },
};
/** Of the companies visited, the ones with revenue this year and how much - not an average over the prospects as well
 *  (SARCLA 28.10.2026 on "Ø revenue this year €534": "figures are completely wrong"). */
const boughtWords = (s: VStats) => (s.buyers ? `${int(s.buyers)} bought this year · ${eur(s.revenue)}` : "none bought this year");
function boardRows(c: VCtx, dim: VDim, m: Measure): BoardRow[] {
  const by = statsOf(c, dim);
  const t = totalOf(c);
  const done = monthsDone(c.d, c.per);
  const rows: BoardRow[] = [];
  for (const [label, s] of by) {
    let cur: number, sub: string;
    if (m === "visits") { cur = s.visits; sub = dim === "person" ? `${int(s.companies)} companies · ${(s.visits / Math.max(done, 0.1)).toFixed(1)} a month` : `${pct(t.visits ? s.visits / t.visits : null)} of the visits · ${int(s.companies)} companies`; }
    else if (m === "new") { cur = s.newVisits; sub = `${int(s.newCompanies)} new customers · ${int(s.registeredAfter)} registered · ${int(s.boughtInPeriod)} bought`; }
    else if (m === "registered") { cur = s.registeredAfter; sub = `${pct(s.newCompanies ? s.registeredAfter / s.newCompanies : null)} of ${int(s.newCompanies)} new customers visited`; }
    else if (m === "bought") { cur = s.boughtInPeriod; sub = `${pct(s.newCompanies ? s.boughtInPeriod / s.newCompanies : null)} of ${int(s.newCompanies)} new customers visited`; }
    else { cur = s.lapsedAgain; sub = `of ${int(s.lapsed)} visited that had not ordered for 12 months or more`; }
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

/* ── the months: visits as columns, last year's meetings across, the target's line ── */

/** The people a chart is about: the team's, or the persons filtered. */
const shownPeople = (c: VCtx) => { const f = c.filters.person; if (!f?.length) return c.people; const s = new Set(f); return new Set([...c.people].filter((i) => s.has(c.d.people[i]?.name ?? ""))); };
/** Last year can follow the team and a person, not the other filters: a meeting has no visit report. */
const lastYearFollows = (c: VCtx) => c.d.coverage.lastYearRead && !(["prio", "category", "kind", "country"] as VDim[]).some((k) => c.filters[k]?.length);
const signedPct = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x * 100).toFixed(1)}%`;

/** This year's completed visits as columns against last year's customer meetings, a tick across each (SARCLA 29.10.2026:
 *  "this should also compare to the previous year"). The visit reports start in December 2025 - a meeting with a company
 *  is what became a visit; the ESO logged them from July 2025. */
function VisitMonths({ c, target }: { c: VCtx; target: number | null }) {
  const t = totalOf(c);
  const ly = lastYearFollows(c) ? lastYearOf(c.d, c.per.win, shownPeople(c)) : null;
  const data = t.months.map((v, i) => ({ x: MONTHS[c.per.win.from + i], head: monthHead(c.d, c.per, i), v, prev: ly?.[i] ?? 0, running: c.per.win.from + i === nowMonth(c.d) }));
  const top = niceTop(Math.max(1, target ?? 0, ...data.map((x) => Math.max(x.v, x.prev))));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const done = data.filter((x) => !x.running);
  const reached = target ? done.filter((x) => x.v >= target).length : 0;
  // a change only where last year has enough to compare with (before July 2025 hardly any meetings were logged: Jan +1,060%),
  // and not for the running month - its reports are still coming in
  const change = (x: { v: number; prev: number; running: boolean }) => (ly && !x.running && x.prev >= 10 && x.prev >= x.v / 4 ? (x.v - x.prev) / x.prev : null);
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: THIS }} />{c.d.year}: completed visits</Box>
        {ly && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 16, height: 2, borderRadius: 1, bgcolor: INK }} />{c.d.year - 1}, same month: customer meetings</Box>}
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
              <Box key={x.x} title={`${x.head}${x.running ? " (to date)" : ""}: ${int(x.v)} completed visits${ly ? ` · ${c.d.year - 1}: ${int(x.prev)} customer meetings` : ""}${target ? ` · ${pct(x.v / target)} of the target` : ""}`} sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px" }}>
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
const monthsHint = (c: VCtx) => `${perWords(c.d, c.per)} · the running month to date, lighter${cutWords(c)}${lastYearFollows(c)
  ? ` · ${c.d.year - 1}: the same people's customer meetings in HubSpot${c.per.win.d0 ? ", the same days" : ""} (the visit reports start in December ${c.d.year - 1}; meetings logged from July ${c.d.year - 1}) · the change where last year has a quarter of this year or more, not for the running month`
  : c.d.coverage.lastYearRead ? ` · ${c.d.year - 1} not shown: a meeting has no priority, category, type or country to filter by` : ""} · each person's months in the table below`;

/** How much of each priority the visits reached (SARCLA 29.10.2026 on the visits by priority: "P1 is undervalued - think
 *  about another graph"; "look at the design" - drawn as every other tab's chart): of the companies the people own now, by
 *  priority, how many had a completed visit in the period. */
function CoverageChart({ c, title, actions }: { c: VCtx; title: string; actions?: React.ReactNode }) {
  const chosen = c.filters.prio;
  const rows = coverageOf(c.d, rowsOf(c.d, c.per.win, c.filters, c.people), shownPeople(c))
    .filter((x) => (!chosen?.length || chosen.includes(x.label)) && x.owned > 0)
    .map((x) => ({ ...x, share: x.visited / x.owned }));
  return (
    <DimChart title={title} rows={rows} cur={(r) => r.share} prev={() => 0} curLabel="Share of their companies visited" prevLabel="" fmt={(n) => pct(n)} single fixedOrder labelWidth={110}
      curNote={(r) => ({ text: `${int(r.visited)} of ${int(r.owned)}`, color: MUTED })} selected={chosen}
      onPick={c.onBar ? (l) => c.onBar!("prio", l) : undefined} onFilter={c.onFilter ? () => c.onFilter!("prio") : undefined} filterLabel="Filter by priority" actions={actions} />
  );
}

/** The types of visit and their colours */
const KIND_COLOR: Record<string, string> = { Scheduled: THIS, Cold: TINT.amber.fg, Event: TINT.purple.fg, "Not recorded": "#cfd4db" };
const kindParts = (s: VStats) => [s.scheduled, s.cold, s.event, Math.max(0, s.visits - s.scheduled - s.cold - s.event)];
function KindLegend({ t }: { t: VStats }) {
  const n = kindParts(t);
  return (
    <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap" }}>
      {KINDS.map((k, i) => (n[i] > 0 || i < 3) && (
        <Box key={k} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: KIND_COLOR[k] }} />
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{k} <b style={{ color: INK }}>{int(n[i])}</b> {pct(t.visits ? n[i] / t.visits : null)}</Typography>
        </Box>
      ))}
    </Box>
  );
}
/** Scheduled, cold and event visits per person (or priority, category, country): each one's visits split by type
 *  (SARCLA 29.10.2026: "for example the split between cold and scheduled or event"). */
function KindSplit({ c, dim }: { c: VCtx; dim: VDim }) {
  const [all, setAll] = useState(false);
  const order = ORDER[dim];
  const rows = [...statsOf(c, dim)].map(([label, s]) => ({ label, s, n: kindParts(s) }));
  rows.sort(order ? (a, b) => order.indexOf(a.label) - order.indexOf(b.label) : (a, b) => b.s.visits - a.s.visits || a.label.localeCompare(b.label));
  const max = Math.max(1, ...rows.map((r) => r.s.visits));
  const first = c.half ? 8 : 12;
  const shown = all ? rows : rows.slice(0, first);
  return (
    <Box sx={{ display: "grid", gap: 1.1 }}>
      <KindLegend t={totalOf(c)} />
      {rows.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No visits under these filters.</Typography>}
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {shown.map((r) => (
          <Box key={r.label} {...(c.onBar ? { component: "button" as const, type: "button" as const, onClick: () => c.onBar!(dim, r.label) } : {})}
            sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(110px, 0.9fr) minmax(40px, 2fr) auto" }, gap: { xs: 0.4, sm: 1.25 }, alignItems: "center", border: 0, bgcolor: "transparent", font: "inherit", textAlign: "left", cursor: c.onBar ? "pointer" : "default", borderRadius: "8px", px: 0.5, py: 0.25, "&:hover": c.onBar ? { bgcolor: "rgba(21,34,58,.04)" } : {} }}>
            <Typography noWrap title={r.label} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{r.label}</Typography>
            <Box sx={{ display: "flex", gap: "2px", height: 16, width: `${(r.s.visits / max) * 100}%`, minWidth: 6 }}>
              {KINDS.map((k, i) => r.n[i] > 0 && (
                <Box key={k} title={`${r.label} - ${k}: ${int(r.n[i])} (${pct(r.n[i] / r.s.visits)})`} sx={{ flex: `${r.n[i]} 0 0`, minWidth: 2, bgcolor: KIND_COLOR[k], "&:first-of-type": { borderRadius: "3px 0 0 3px" }, "&:last-of-type": { borderRadius: "0 3px 3px 0" } }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: "0.8rem", color: INK, textAlign: { sm: "right" }, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}><b>{int(r.s.visits)}</b> <span style={{ color: FAINT }}>· {pct(r.s.visits ? r.s.scheduled / r.s.visits : null)} scheduled</span></Typography>
          </Box>
        ))}
      </Box>
      {rows.length > first && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${first}` : `Show all ${rows.length}`}</Button>}
    </Box>
  );
}
/** The types of visit month by month: each month's completed visits stacked by type, the share scheduled under it. */
function KindMonths({ c }: { c: VCtx }) {
  const by = statsOf(c, "kind");
  const t = totalOf(c);
  const data = t.months.map((v, i) => ({ x: MONTHS[c.per.win.from + i], head: monthHead(c.d, c.per, i), v, parts: KINDS.map((k) => by.get(k)?.months[i] ?? 0), running: c.per.win.from + i === nowMonth(c.d) }));
  const top = niceTop(Math.max(1, ...data.map((x) => x.v)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <KindLegend t={t} />
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: Math.max(28, axisWidth(top) - 40) }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{int(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 160, maxHeight: 340 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((x) => (
              <Box key={x.x} title={`${x.head}${x.running ? " (to date)" : ""}: ${KINDS.map((k, i) => `${k} ${int(x.parts[i])}`).join(" · ")}`} sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px" }}>
                <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(x.v / top) * 100}%`, display: "flex", flexDirection: "column-reverse", gap: "1px", opacity: x.running ? 0.6 : 1, borderRadius: "4px 4px 0 0", overflow: "hidden" }}>
                  {KINDS.map((k, i) => x.parts[i] > 0 && <Box key={k} sx={{ flex: `${x.parts[i]} 0 0`, bgcolor: KIND_COLOR[k] }} />)}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
        <Box />
        <Box sx={{ display: "flex" }}>
          {data.map((x) => (
            <Box key={x.x} sx={{ flex: 1, textAlign: "center", pt: 0.5, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3 }}>{x.x}</Typography>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{int(x.v)}</Typography>
              <Typography sx={{ fontSize: "0.66rem", color: FAINT, lineHeight: 1.3, whiteSpace: "nowrap" }}>{pct(x.v ? x.parts[0] / x.v : null)}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
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

/** Registration, in his four questions (SARCLA 27.10.2026): how many visits with new customers, how many of them registered
 *  after the visit, in what way, how many of them bought in the period - from the shop's registration day and the first
 *  order's day against the visit's (28.10: not the qualification's answers). 29.10: "how many bought after the visit - how
 *  many bought before, I also want to see (not retained)": the customers that had ordered before, and did they again. */
function Answers({ c }: { c: VCtx }) {
  const t = totalOf(c);
  const ways = t.newCompanies ? REG_WAY.map((w) => ({ label: w, n: t.regWays[w] ?? 0, of: t.newCompanies })) : [];
  const q = (n: number, text: string) => (
    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}><span style={{ color: FAINT, marginRight: 8 }}>{n}</span>{text}</Typography>
  );
  const a = (main: string, rest?: string) => (
    <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{main}{rest && <span style={{ fontSize: "0.82rem", fontWeight: 500, color: MUTED }}> {rest}</span>}</Typography>
  );
  const row = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(260px, 1fr) minmax(0, 1.4fr)" }, gap: { xs: 0.5, md: 2 }, alignItems: "start", py: 1.25, borderBottom: `1px solid ${HAIRLINE}` } as const;
  return (
    <Box sx={{ display: "grid" }}>
      <Box sx={row}>{q(1, "How many visits with new customers?")}{a(`${int(t.newVisits)} visits`, `to ${int(t.newCompanies)} new customers - companies that had never ordered before the day of the visit`)}</Box>
      <Box sx={row}>{q(2, "How many of them registered after the visit?")}{a(int(t.registeredAfter), `${pct(t.newCompanies ? t.registeredAfter / t.newCompanies : null)} of the ${int(t.newCompanies)} new customers - registered in the shop on the day of the visit or after it, by ${perEnd(c.d, c.per)}`)}</Box>
      <Box sx={row}>
        {q(3, "In what way?")}
        <Bars items={ways} empty="No new customer visited in this period." />
      </Box>
      <Box sx={row}>{q(4, "How many of them bought after the visit?")}{a(int(t.boughtInPeriod), `${pct(t.newCompanies ? t.boughtInPeriod / t.newCompanies : null)} of the ${int(t.newCompanies)} new customers - their first order on the day of the visit or after it, by ${perEnd(c.d, c.per)}`)}</Box>
      <Box sx={row}>
        {q(5, "How many of the companies visited had bought before?")}
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {a(int(t.oldCompanies), `companies that had ordered before the day of the visit`)}
          <Bars items={BEFORE.map((label, i) => ({ label, n: i ? t.lapsed : t.stillBuying, of: t.oldCompanies }))} empty="No earlier customer visited in this period." />
        </Box>
      </Box>
      <Box sx={{ ...row, borderBottom: 0 }}>
        {q(6, "How many of them bought again after the visit?")}
        <Bars items={[{ label: "Still buying - ordered after the visit", n: t.stillBuyingAgain, of: t.stillBuying }, { label: "Not retained - won back, ordered again after the visit", n: t.lapsedAgain, of: t.lapsed }]} empty="No earlier customer visited in this period." />
      </Box>
    </Box>
  );
}

/* ── every chart by its key ────────────────────────────────────────────── */

type TargetOf = { unit: "eur" | "pct" | "n"; label: string };
type Drawn = { id: string; title: (c: VCtx) => string; draw: (c: VCtx, actions?: React.ReactNode) => React.ReactNode; target?: (c: VCtx) => TargetOf };
const teamPart = (c: VCtx) => ` - ${teamName(c)}`;
const forWhom = (c: VCtx) => `${teamName(c)}'s target for ${c.per.title} - each team and period its own`;
/** A chart by its id "<tab>:<what>[-<breakdown>]": people:visits, prio:visits-band, kind:agreed-person, new:answers, people:months,
 *  the tables people:table, people:months-table… */
function drawnOf(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  if (chart === "months") {
    const title = (c: VCtx) => `Completed visits ${c.per.title}, month by month${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={monthsHint(c)} actions={a}><VisitMonths c={c} target={targetFor(c, id)} /></ChartBox>,
      target: (c) => ({ unit: "n", label: `Each month's completed visits are measured against it - a line across the months; the running month is not counted · ${teamName(c)}'s target.` }) };
  }
  if (chart === "answers") {
    const title = (c: VCtx) => `New and earlier customers visited - did they register, did they buy, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · new customers: companies that had never ordered before the day of the visit; registered: the shop's registration date against the visit's; bought: an order on the day of the visit or after it, by ${perEnd(c.d, c.per)}`} actions={a}><Answers c={c} /></ChartBox> };
  }
  if (chart === "coverage") {
    const title = (c: VCtx) => `How much of each priority was visited - of the companies they own, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <CoverageChart c={c} title={title(c)} actions={a} /> };
  }
  if (chart === "kindmonths") {
    const title = (c: VCtx) => `Scheduled, cold and event visits ${c.per.title}, month by month${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each month's completed visits by type, the share scheduled under it · the running month to date, lighter${cutWords(c)}`} actions={a}><KindMonths c={c} /></ChartBox> };
  }
  if (chart.startsWith("kinds")) {
    const by = chart.split("-")[1];
    const dim: VDim = by && by in DIM ? (by as VDim) : DIM_OF[v] === "kind" ? "person" : DIM_OF[v];
    const title = (c: VCtx) => `Scheduled, cold and event visits ${c.per.title}, by ${DIM[dim].lower}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each ${DIM[dim].lower}'s completed visits by type - ${DIM.kind.note.charAt(0).toLowerCase()}${DIM.kind.note.slice(1)}`} actions={a}><KindSplit c={c} dim={dim} /></ChartBox> };
  }
  // every table its own card with its Actions, so it can go to the BUC View as any chart (SARCLA 31.10.2026: "all the tables
  // should be individual KPIs" - "completed visits by person, month by month"): people:months-table, country:people-table,
  // and <tab>:table - the People tab's figures by person, Type of visit's by person and type, the others by their breakdown
  if (chart === "months-table" && v === "people") {
    const title = (c: VCtx) => `Completed visits month by month, ${c.per.title}, by person${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each person's completed visits in each month, the running month to date${cutWords(c)}`} actions={a}><PeopleMonths c={c} /></ChartBox> };
  }
  if (chart === "people-table" && v === "country") {
    const title = (c: VCtx) => `Visits by country, ${c.per.title}, by person${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each person's completed visits in the eight countries with the most visits, the other countries together - they add up to each person`} actions={a}><CountryTable c={c} /></ChartBox> };
  }
  if (chart === "table" && v === "people") {
    const title = (c: VCtx) => `All the figures, ${c.per.title}, by person${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each person's completed visits, companies visited, visits without a company, new customers visited - registered after the visit, bought - and the companies' revenue this year${c.per.id === "ytd" ? ", the visits not reported yet" : ""}`} actions={a}><PeopleTable c={c} /></ChartBox> };
  }
  if (chart === "table" && v === "kind") {
    const title = (c: VCtx) => `Visits by type, ${c.per.title}, by person${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each person's completed visits - scheduled, cold, at an event - and the share scheduled in advance`} actions={a}><KindTable c={c} /></ChartBox> };
  }
  if (chart === "table") {
    const dim = DIM_OF[v];
    const title = (c: VCtx) => `All the figures, ${c.per.title}, by ${DIM[dim].lower}${teamPart(c)}`;
    const buyers = dim === "prio" || dim === "person";
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · each ${DIM[dim].lower}'s completed visits and their share, companies visited${buyers ? ", new customers visited, bought and won back" : ""}, the share scheduled`} actions={a}><DimTable c={c} dim={dim} /></ChartBox> };
  }
  const [what, by] = chart.split("-");
  if (!(what in MEASURE)) return undefined;
  const m = what as Measure;
  const dim: VDim = by && (by in DIM) ? (by as VDim) : DIM_OF[v];
  return { id, title: (c) => `${MEASURE[m].title} ${c.per.title}, by ${DIM[dim].lower}${teamPart(c)}`, draw: (c, a) => <Board c={c} id={id} dim={dim} m={m} actions={a} />,
    target: (c) => ({ unit: MEASURE[m].unit, label: `Each ${DIM[dim].lower}'s ${MEASURE[m].target} ${c.per.title} is measured against it · ${forWhom(c)}.` }) };
}
/** The earlier charts' keys, still in some BUC Views, by what took their place. */
function chartOf(key: string): Drawn | undefined {
  const [, view = "", chart = ""] = key.split(":");
  const old: Record<string, string> = {
    "people:agreed": "kind:kinds-person", "people:potential": "prio:coverage", "new:funnel": "new:answers", "new:new": "new:new", "new:bought": "new:bought",
    // 29.10: the companies-visited boards and the potential taken out, visits by priority replaced by how much of each was visited
    "people:companies": "people:visits", "prio:visits": "prio:coverage", "prio:visits-band": "prio:coverage", "prio:potential-person": "prio:coverage",
    // later the same day: "scheduled" for "agreed", the type of visit as a split, no annual need, no visits-without-a-company board
    "kind:agreed-person": "kind:kinds-person", "kind:visits": "kind:kinds-person", "prio:need-person": "prio:coverage", "people:nocompany": "people:kinds",
  };
  const asIs = drawnOf(old[`${view}:${chart}`] ?? `${view}:${chart}`);
  if (asIs) return asIs;
  if (chart.startsWith("companies") && isView(view)) return drawnOf(`${view}:visits`);
  if (view === "reps") return drawnOf(chart === "potential" ? "prio:coverage" : chart === "months" ? "people:months" : "people:visits");
  if (view === "prio" || view === "category" || view === "kind") return drawnOf(chart === "months" ? "people:months" : `${view}:visits`);
  if (view === "new") return drawnOf("new:answers");
  return undefined;
}

/* ── the tables ────────────────────────────────────────────────────────── */

type Row = VStats & { label: string; open?: number };
function PeopleTable({ c }: { c: VCtx }) {
  const by = statsOf(c, "person");
  const ytd = c.per.id === "ytd";
  const rows: Row[] = [...by].map(([label, s]) => { const i = c.d.people.findIndex((p) => p.name === label); return { label, ...s, open: Object.values(c.d.open[String(i)] ?? {}).reduce((a, x) => a + x, 0) }; });
  const t = totalOf(c);
  const total: Row = { label: "Total", ...t, open: rows.reduce((a, r) => a + (r.open ?? 0), 0) };
  const cols: Col<Row>[] = [
    { key: "visits", head: "Completed visits", cell: (r) => int(r.visits), sort: (r) => r.visits },
    { key: "companies", head: "Companies visited", cell: (r) => int(r.companies), sort: (r) => r.companies },
    { key: "noco", head: "Without a company", tip: "Visits with no company - neither on the visit nor on its contact: to link in HubSpot", cell: (r) => (r.noCompany ? int(r.noCompany) : "—"), sort: (r) => r.noCompany },
    { key: "new", head: "New customers visited", tip: "Companies that had never ordered before the day of the visit", cell: (r) => int(r.newCompanies), sort: (r) => r.newCompanies },
    { key: "reg", head: "Registered after", tip: "Of those, registered in the shop on the day of the visit or after it (the shop's registration date)", cell: (r) => int(r.registeredAfter), sort: (r) => r.registeredAfter },
    { key: "bought", head: `Bought, ${c.per.title}`, tip: "Of those, their first order on the day of the visit or after it, by the end of the period", cell: (r) => int(r.boughtInPeriod), sort: (r) => r.boughtInPeriod },
    { key: "rev", head: "Their revenue this year", tip: "This year's revenue of the companies visited", cell: (r) => eur(r.revenue), sort: (r) => r.revenue },
    ...(ytd ? [{ key: "open", head: "Not reported yet", tip: "This year's visits whose report is not complete - they do not count yet", cell: (r: Row) => (r.open ? int(r.open) : "—"), sort: (r: Row) => r.open ?? 0 }] : []),
  ];
  return <FullTable key={`people-${c.per.id}-${c.team}`} first="Person" cols={cols} initial="visits" rows={rows} total={total} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" />;
}
/** Each person's completed visits month by month (SARCLA 27.10.2026: "month by month should also be split per sales person"). */
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
    { key: "visits", head: "Completed visits", cell: (r) => int(r.visits), sort: (r) => r.visits },
    { key: "share", head: "Share of the visits", cell: (r) => pct(t.visits ? r.visits / t.visits : null), sort: (r) => r.visits },
    { key: "companies", head: "Companies visited", cell: (r) => int(r.companies), sort: (r) => r.companies },
    ...(buyers ? [
      { key: "new", head: "New customers visited", cell: (r: Row) => int(r.newCompanies), sort: (r: Row) => r.newCompanies },
      { key: "bought", head: `Bought, ${c.per.title}`, cell: (r: Row) => int(r.boughtInPeriod), sort: (r: Row) => r.boughtInPeriod },
      { key: "again", head: "Won back", tip: "Companies that had not ordered for 12 months or more before the visit and ordered after it, by the end of the period", cell: (r: Row) => (r.lapsed ? `${int(r.lapsedAgain)} of ${int(r.lapsed)}` : "—"), sort: (r: Row) => r.lapsedAgain },
    ] : []),
    { key: "scheduled", head: "Scheduled", tip: "The share of the visits scheduled with the customer in advance", cell: (r) => (r.visits ? pct(r.scheduled / r.visits) : "—"), sort: (r) => (r.visits ? r.scheduled / r.visits : -1) },
  ];
  const sorted = order ? [...rows].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : rows;
  return <FullTable key={`${dim}-${c.per.id}-${c.team}`} first={DIM[dim].name} cols={cols} initial="visits" rows={sorted} total={{ label: "Total", ...t }} natural={!!order}
    selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} find={`a ${DIM[dim].lower}`} />;
}

/** Each person's visits by type (SARCLA 29.10.2026: "review completely type of visits"). */
function KindTable({ c }: { c: VCtx }) {
  type KRow = { label: string; n: number[]; visits: number };
  const rows: KRow[] = [...statsOf(c, "person")].map(([label, s]) => ({ label, n: kindParts(s), visits: s.visits }));
  const t = totalOf(c);
  const cols: Col<KRow>[] = [
    ...KINDS.map((k, i) => ({ key: k, head: k, cell: (r: KRow) => (r.n[i] ? int(r.n[i]) : "—"), sort: (r: KRow) => r.n[i] })).filter((_, i) => i < 3 || kindParts(t)[3] > 0),
    { key: "visits", head: "Completed visits", cell: (r) => <b>{int(r.visits)}</b>, sort: (r) => r.visits },
    { key: "share", head: "Scheduled", tip: "The share of the person's visits scheduled in advance", cell: (r) => pct(r.visits ? r.n[0] / r.visits : null), sort: (r) => (r.visits ? r.n[0] / r.visits : -1) },
  ];
  return <FullTable key={`kt-${c.per.id}-${c.team}`} first="Person" cols={cols} initial="visits" rows={rows} total={{ label: "Total", n: kindParts(t), visits: t.visits }} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" />;
}
/** Each person's visits by country - the countries add up to each person (SARCLA 29.10.2026: "it doesn't match
 *  individuals"): the eight with the most visits as columns, the rest together. */
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
    { key: "visits", head: "Completed visits", cell: (r) => <b>{int(r.visits)}</b>, sort: (r) => r.visits },
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
      <CardTitle icon={<BadgeOutlinedIcon />} tint="green" title={`${teamName(c)}, ${c.per.title}`} note={`${words} · completed visit reports only, by meeting date, by who made the visit`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "people:visits")}{draw(c, act, "people:kinds")}</Box>
      {c.per.months >= 2 && draw(c, act, "people:months")}
      {c.per.months >= 2 && draw(c, act, "people:months-table")}
      {draw(c, act, "people:table")}
    </GlassCard>
  );
  if (c.view === "new") return (
    <GlassCard sx={card}>
      <CardTitle icon={<HowToRegOutlinedIcon />} tint="amber" title={`${teamName(c)}: registration, ${c.per.title}`} note={`${words} · new customers visited - did they register, how, and did they buy; the earlier customers - still buying or not retained - and did they buy again`} />
      <Box sx={{ mt: -1 }}>{draw(c, act, "new:answers")}</Box>
      <Box sx={TWO}>{draw(c, act, "new:new")}{draw(c, act, "new:registered")}</Box>
      <Box sx={TWO}>{draw(c, act, "new:bought")}{draw(c, act, "new:again")}</Box>
    </GlassCard>
  );
  if (c.view === "prio") return (
    <GlassCard sx={card}>
      <CardTitle icon={<FlagOutlinedIcon />} tint="purple" title={`${teamName(c)} by priority, ${c.per.title}`} note={`${DIM.prio.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "prio:coverage")}{draw(c, act, "prio:kinds")}</Box>
      {draw(c, act, "prio:table")}
    </GlassCard>
  );
  if (c.view === "kind") return (
    <GlassCard sx={card}>
      <CardTitle icon={<HandshakeOutlinedIcon />} tint="slate" title={`${teamName(c)} by type of visit, ${c.per.title}`} note={`${DIM.kind.note} · ${words}`} />
      <Box sx={{ mt: -1 }}>{draw(c, act, "kind:kinds-person")}</Box>
      {c.per.months >= 2 && draw(c, act, "kind:kindmonths")}
      {draw(c, act, "kind:table")}
    </GlassCard>
  );
  const dim = DIM_OF[c.view], dd = DIM[dim];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={dd.icon} tint={dd.tint} title={`${teamName(c)} by ${dd.lower}, ${c.per.title}`} note={`${dd.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, `${c.view}:visits`)}{draw(c, act, `${c.view}:kinds`)}</Box>
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
  const open = c.per.id === "ytd" ? [...c.people].reduce((a, i) => a + Object.values(c.d.open[String(i)] ?? {}).reduce((x, y) => x + y, 0), 0) : 0;
  const P = c.per.title;
  return [
    { id: "fig-visits", label: `Completed visits ${P}`, value: int(t.visits), sub: `${(t.visits / Math.max(done, 0.1)).toFixed(0)} a month${open ? ` · ${int(open)} more not reported yet` : ""}`, icon: <DirectionsCarOutlinedIcon />, tint: "green", amount: t.visits, unit: "n" },
    { id: "fig-companies", label: `Companies visited ${P}`, value: int(t.companies), sub: boughtWords(t), icon: <ApartmentOutlinedIcon />, tint: "blue", amount: t.companies, unit: "n" },
    { id: "fig-new", label: "New customers visited", value: int(t.newCompanies), sub: `${int(t.newVisits)} visits - companies that had never ordered`, icon: <PersonAddAltOutlinedIcon />, tint: "amber", amount: t.newCompanies, unit: "n" },
    { id: "fig-registered", label: "Registered after the visit", value: int(t.registeredAfter), sub: `${pct(t.newCompanies ? t.registeredAfter / t.newCompanies : null)} of the new customers visited`, icon: <HowToRegOutlinedIcon />, tint: "purple", amount: t.registeredAfter, unit: "n" },
    { id: "fig-bought", label: `Bought, ${P}`, value: int(t.boughtInPeriod), sub: `${pct(t.newCompanies ? t.boughtInPeriod / t.newCompanies : null)} of the new customers visited`, icon: <ShoppingCartCheckoutOutlinedIcon />, tint: "green", amount: t.boughtInPeriod, unit: "n" },
    { id: "fig-agreed", label: "Scheduled visits", value: pct(t.visits ? t.scheduled / t.visits : null), sub: `${int(t.scheduled)} scheduled · ${int(t.cold)} cold · ${int(t.event)} at events`, icon: <HandshakeOutlinedIcon />, tint: "slate", amount: t.visits ? t.scheduled / t.visits : 0, unit: "pct" },
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
function VPeriod({ d, per, onPer }: { d: VisitsData; per: VPer; onPer: (w: VWin) => void }) {
  const all = presetsOf(d);
  const winOf = (id: string) => all.find((p) => p.id === id)?.win;
  const [a, b] = daysOf(d, per.win);
  return (
    <PeriodPicker quick={all.filter((p) => !p.id.startsWith("q"))} quarters={quartersOf(d.year, nowMonth(d), true)}
      isOn={(id) => { const w = winOf(id); return !!w && !per.win.d0 && w.from === per.win.from && w.to === per.win.to; }} onChoice={(id) => { const w = winOf(id); if (w) onPer(w); }}
      unit="day" min={`${d.year}-01-01`} max={isoOf(ymd(d.today))} from={isoOf(a)} to={isoOf(b)}
      onRange={(x, y) => onPer(dayWin(d, ymd(x), ymd(y)))}
      note={<>This year&apos;s days: the visit reports start in December {d.year - 1}. The months chart sets last year&apos;s customer meetings beside them - for a range of days, the same days a year earlier.</>} />
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
const FILTER_DIMS: VDim[] = ["person", "prio", "category", "kind", "country"];
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
    const t = setTimeout(() => document.getElementById(`vfilter-${focus.dim}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const chosen = FILTER_DIMS.flatMap((d) => (c.filters[d] ?? []).map((v) => [d, v] as const));
  return (
    <FilterPanel id="eso-visits-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, v]) => <Chip key={`${d}:${v}`} size="small" label={<span><b>{DIM[d].name}:</b> {v}</span>} onDelete={() => toggle(d, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          <FilterSection id="vfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => setShut((s) => ({ ...s, period: isOpen("period") }))} summary={perCap(per)}>
            <VPeriod d={c.d} per={per} onPer={onPer} />
          </FilterSection>
          {FILTER_DIMS.map((dim, i) => (
            <FilterSection key={dim} id={`vfilter-${dim}`} index={i + 1} title={DIM[dim].name} icon={DIM[dim].icon} tint={DIM[dim].tint} open={isOpen(dim)} onFlip={() => setShut((s) => ({ ...s, [dim]: isOpen(dim) }))}
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
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The visits could not be read: ${error}` : `Reading every customer visit in HubSpot${progress ? ` · ${progress}` : ""}…`}</Typography>
      </Box>
    </GlassCard>
  );
}
const ym = (d: VisitsData, m: number) => `${d.year}-${String(m + 1).padStart(2, "0")}`;
const fromYm = (d: VisitsData, x: string | null) => { const m = /^(\d{4})-(\d{2})$/.exec(x ?? ""); return m && Number(m[1]) === d.year ? Number(m[2]) - 1 : null; };
/** The period of an address, or of a card sent to the BUC View: ?from=2026-04&to=2026-06 whole months, as always, or
 *  ?from=2026-03-05&to=2026-05-17 a range of days; a month beside a day, its first or last day. Another year: none (the
 *  year to date). */
function winOfQuery(d: VisitsData, from: string | null, to: string | null): VWin | null {
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
const perFilters = (d: VisitsData, per: VPer): Record<string, string[]> => (per.win.d0 && per.win.d1 ? { from: [isoOf(per.win.d0)], to: [isoOf(per.win.d1)] }
  : per.id.startsWith("m") ? { from: [ym(d, per.win.from)], to: [ym(d, per.win.to)] } : { period: [per.id] });

export function VisitsExplorer() {
  const params = useSearchParams();
  const { d, computing, progress, error } = useVisits();
  const [teamKey, setTeam] = useTeam();
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  const { state: acts } = useActions("eso-visits");
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
  const team: TeamKey = teamKey === "eso" ? "eso" : "total";
  const lead = team === "eso" ? leadOf("eso", leadKey, lt) : null;
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

  const back = (
    <Box component={Link} href="/reporting/eso-benchmark" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
      <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
    </Box>
  );
  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  if (!d || !c || !per) return (<Box sx={shell}>{back}<Typography component="h1" sx={H1}>Visits</Typography><Waiting computing={computing} progress={progress} error={error} /></Box>);

  const act: Act = (id, title, target) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-visits:${id}`, page: "eso-visits", tab: c.view, title, summary: `${teamName(c)} · ${perWords(d, c.per)}`,
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
          <Typography component="h1" sx={H1}>Visits</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamName(now)}</b> · {per.title === perWords(d, per) ? <b style={{ color: INK }}>{per.title}</b> : <>{per.title} <b style={{ color: INK }}>{perWords(d, per)}</b></>} · completed visit reports{computing ? " · reading HubSpot again" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}><FigureCards c={c} items={figs} /></Box>
      </Box>
      <Box sx={{ display: "grid", gap: 0.75, mt: -0.5 }}>
        <VTeams team={team} onTeam={setTeam} lead={leadKey} onLead={setLead} teams={teams} />
        {lead && people && people.size === 0 && <NoLeadYet name={teamName(now)} />}
      </Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="eso-visits" tab={view} onSelect={setView} tabs={VIEWS.map((v) => ({ id: v.id, label: v.label, count: v.id !== "people" && v.id !== "new" && filters[DIM_OF[v.id]]?.length ? String(filters[DIM_OF[v.id]]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-visits" /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else openOn(DIM_OF[view]); }} variant={panel || chosen.length || per.id !== "ytd" ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-visits-filters" startIcon={<TuneIcon />}
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

/* ── the BUC View's Visits panel ───────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
const PANEL = "eso-visits:panel:";

/** Visits in the BUC View: the year to date for the team the toggle shows, the months, and the Visits charts sent here. */
export function VisitsPanel({ acts }: { acts: ActionsState | null }) {
  const { d, computing, progress, error } = useVisits();
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
  const c = useMemo<VCtx | null>(() => (d ? { d, per: perOf(d, presetsOf(d)[0].win), team: drawn.team, lead: drawn.lead, teams, people: peopleOf(d, drawn.team, drawn.lead, lt?.byId ?? {}), filters: {}, view: "people", targets: acts?.targets } : null),
    [d, drawn, teams, lt, acts?.targets]);
  const items: SortItem[] = useMemo(() => !c ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-visits" && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const ch = chartOf(spec.key);
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
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<DirectionsCarOutlinedIcon />} tint="green" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [c, acts]);
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-visits", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);
  const shown = (id: string) => placementOf(acts, `${PANEL}${id}`, "nutshell") === "nutshell";
  const own = (id: string, title: string, kind: "kpi" | "card", target?: { key: string; unit: "eur" | "pct" | "n"; label: string }) => (
    <TileActions where="nutshell" start="nutshell" edge={2} tile={{ key: `${PANEL}${id}`, page: "eso-visits", tab: "people", title: `${title} - ${c ? teamName(c) : "ESO"}`, kind,
      filters: { team: [drawn.team], ...(drawn.lead ? { lead: [drawn.lead] } : {}), period: ["ytd"] }, href: `/reporting/eso-benchmark/visits?team=${drawn.team}${drawn.lead ? `&lead=${drawn.lead}` : ""}`, target }} />
  );
  const months = drawnOf("people:months")!;
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<DirectionsCarOutlinedIcon />} tint="green" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/visits?team=${team}${lead ? `&lead=${lead}` : ""}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.green.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Visits</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.green.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName({ team, lead, teams })} · year to date ${perWords(c.d, c.per)} · completed visit reports` : "Completed visit reports"}</Typography>
        </Box>
        <VTeams team={team} onTeam={choose} lead={leadKey} onLead={chooseLead} teams={teams} />
      </Box>
      {!c ? <Waiting computing={computing} progress={progress} error={error} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          <FigureCards c={c} items={figs.filter((f) => shown(f.id))} actions={(f) => own(f.id, f.label, "kpi", { key: targetKey(`panel:${f.id}`, c.team, c.lead, c.per), unit: f.unit, label: `${f.label} is measured against it · ${teamName(c)}'s target.` })} />
          {shown("months") && months.draw(c, own("months", "Completed visits year to date, month by month", "card", months.target ? { key: targetKey(months.id, c.team, c.lead, c.per), ...months.target(c) } : undefined))}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-visits"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </Box>
      )}
    </GlassCard>
  );
}

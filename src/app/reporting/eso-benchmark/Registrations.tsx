"use client";
// THE ESO REGISTRATIONS PAGE, rebuilt like the Visits and the Figures (SARCLA 29.10.2026: "work on ESO Reports ->
// registration"). What the old page did wrong: a shop account was dated by the day HubSpot created the contact - 2025
// holds some 2,200 contacts HubSpot created that had registered in the shop before, so last year read 7,440 accounts
// where the shop has 5,219, and this year looked a fifth down when it is level; "how they registered" was the
// qualification's answer (SARCLA 28.10.2026: "you are using qualification - we are able to get this correctly"); a
// company opening a second account counted as registering again; last year's registrations had a year longer to buy;
// ESO only, the complete months only, the reps the only filter.
// Now: the shop's own dates (Magento "customer since"); a company registers once, with its first shop account; last year
// to the same day, and bought by the same day a year earlier; registered against the first visit's day; ESO | TSA |
// Total and the line managers' teams; the period under Filters; leaderboards against last year; targets. The rows and
// their rules: src/lib/reporting/registrationsRules.ts.

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
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import RepeatIcon from "@mui/icons-material/Repeat";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import FactoryOutlinedIcon from "@mui/icons-material/FactoryOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { everyWhileSeen } from "@/app/reporting/marketing-kpis/data";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, placementOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import type { SlowState } from "@/lib/integrations/slowReport";
import { POTENTIAL_BANDS, REG_VISIT, STATUS, blank, median, statsBy, type RDim, type RFilters, type RStats, type RWin, type RegData } from "@/lib/reporting/registrationsRules";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  ChartBox, FullTable, H1, KEPT, KEPT_LEAD, Leaderboard, NoLeadYet, SubTitle, TARGET, TWO, Teams, asLead, asTeam, leadOf, niceTop, setQuery, teamWord, useLead, useLeads, useTeam,
  type BoardRow, type Col, type LeadKey, type TeamKey,
} from "./Figures";

/* ── the read ──────────────────────────────────────────────────────────── */

function useRegistrations(): { d: RegData | null; computing: boolean; progress?: string; error?: string } {
  const [st, setSt] = useState<{ state?: SlowState<RegData>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-registrations").then((r) => r.json())
      .then((j: { state?: SlowState<RegData>; error?: string }) => {
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
const signedInt = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(Math.round(n)).toLocaleString("en")}`;
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const share = (a: number, b: number) => (b ? a / b : null);
const days = (x: number | null) => (x == null ? "—" : `${Math.round(x).toLocaleString("en")} ${Math.round(x) === 1 ? "day" : "days"}`);
const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
/** "+9.5%" in its colour, "new" without last year */
const changeNote = (a: number, b: number) => (b ? { text: signedPct(changeOf(a, b)), color: tone(changeOf(a, b)) } : a > 0 ? { text: "new", color: GREEN } : null);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** A share or a median ranks a person or a group with this many companies registered behind it - two or three said nothing. */
const MIN_COMPANIES = 10;

/* ── the period: this year's months, against the same of last year ─────── */

type RPer = { win: RWin; id: string; title: string; months: number };
const nowMonth = (d: RegData) => Number(d.today.slice(5, 7)) - 1;
const todayDay = (d: RegData) => Number(d.today.slice(8, 10));
function presetsOf(d: RegData): { id: string; label: string; win: RWin }[] {
  const m = nowMonth(d);
  const out = [{ id: "ytd", label: "Year to date", win: { from: 0, to: m } }, { id: "mtd", label: "Month to date", win: { from: m, to: m } }];
  if (m > 0) out.push({ id: "lm", label: `${MONTHS_FULL[m - 1]} ${d.year}`, win: { from: m - 1, to: m - 1 } });
  for (let q = 0; q < 4; q++) if (q * 3 + 2 < m) out.push({ id: `q${q + 1}`, label: `Q${q + 1} ${d.year}`, win: { from: q * 3, to: q * 3 + 2 } });
  return out;
}
function perOf(d: RegData, win: RWin): RPer {
  const p = presetsOf(d).find((x) => x.win.from === win.from && x.win.to === win.to);
  const title = p?.id === "ytd" ? "year to date" : p?.id === "mtd" ? "month to date" : p ? p.label : `${MONTHS[win.from]}–${MONTHS[win.to]} ${d.year}`;
  return { win, id: p?.id ?? `m${win.from}-${win.to}`, title, months: win.to - win.from + 1 };
}
/** "1 Jan – 29 Oct 2026", "Apr–Jun 2026" - or last year's: "1 Jan – 29 Oct 2025" */
function perWords(d: RegData, per: RPer, side: 0 | 1 = 0) {
  const y = d.year - side;
  const run = per.win.to === nowMonth(d);
  if (per.win.from === per.win.to) return run ? `1 – ${todayDay(d)} ${MONTHS[per.win.to]} ${y}` : `${MONTHS_FULL[per.win.from]} ${y}`;
  return run ? `1 ${MONTHS[per.win.from]} – ${todayDay(d)} ${MONTHS[per.win.to]} ${y}` : `${MONTHS[per.win.from]}–${MONTHS[per.win.to]} ${y}`;
}
const perCap = (p: RPer) => p.title.charAt(0).toUpperCase() + p.title.slice(1);
/** "29 Oct 2026", and last year's "29 Oct 2025" - the day bought and visited are counted to */
const cutWords = (d: RegData, side: 0 | 1) => `${todayDay(d)} ${MONTHS[nowMonth(d)]} ${d.year - side}`;

/* ── the teams: ESO, TSA or everyone - by the company's owner ──────────── */

/** The people shown: ESO's (a line manager's team's), TSA's, or everyone (null) - with the accounts no company owns. */
const peopleOf = (d: RegData, team: TeamKey, lead: string | null, byId: Record<string, string>): Set<number> | null => (team === "total" ? null
  : new Set(d.people.flatMap((p, i) => (team === "eso" ? (p.team === "ESO" && (!lead || byId[p.id] === lead) ? [i] : []) : p.team === "TSA" ? [i] : []))));
const teamName = (c: { team: TeamKey; lead: string | null; teams: Team[] }) => (c.team === "eso" && c.lead ? c.teams.find((t) => t.id === c.lead)?.name ?? c.lead : teamWord(c.team));

/* ── what every chart is drawn with ────────────────────────────────────── */

type RView = "people" | "visit" | "country" | "prio" | "category" | "type";
const VIEWS: { id: RView; label: string }[] = [
  { id: "people", label: "People" }, { id: "visit", label: "Visit and registration" }, { id: "country", label: "Country" },
  { id: "prio", label: "Priority & potential" }, { id: "category", label: "Customer category" }, { id: "type", label: "Customer type" },
];
const isView = (x: string | null): x is RView => VIEWS.some((v) => v.id === x);
const DIM_OF: Record<RView, RDim> = { people: "person", visit: "visit", country: "country", prio: "prio", category: "category", type: "type" };
const DIM: Record<RDim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string }> = {
  person: { name: "Person", lower: "person", icon: <BadgeOutlinedIcon />, tint: "pink", note: "The company's owner in HubSpot today" },
  status: { name: "Before registering", lower: "order history", icon: <RepeatIcon />, tint: "slate", note: "Whether the company had ever ordered before its first shop account - already a customer, or never ordered" },
  visit: { name: "Visit and registration", lower: "visit", icon: <DirectionsCarOutlinedIcon />, tint: "green", note: "The company's first completed customer visit against the day it registered - visits are in HubSpot since 2026" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where the company is" },
  prio: { name: "Priority", lower: "priority", icon: <FlagOutlinedIcon />, tint: "purple", note: "The company's priority: Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500" },
  band: { name: "Potential", lower: "potential", icon: <SavingsOutlinedIcon />, tint: "amber", note: "The company's yearly potential in HubSpot, in bands - a placeholder over €1m counts as not set" },
  category: { name: "Customer category", lower: "customer category", icon: <CategoryOutlinedIcon />, tint: "blue", note: "The company's APSO customer category - Other: APSOlost, APSOmicro, Growth Engine and not set" },
  type: { name: "Customer type", lower: "customer type", icon: <FactoryOutlinedIcon />, tint: "slate", note: "OEM, MRO, C2S workshop… as HubSpot has the company" },
};
const ORDER: Partial<Record<RDim, readonly string[]>> = { status: STATUS, visit: REG_VISIT, prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOgrowth", "APSOprospect", "Other"], band: POTENTIAL_BANDS };
/** visits are in HubSpot since 2026: a registration against a visit has no year before to compare with */
const thisYearOnly = (dim: RDim) => dim === "visit";

export type RCtx = {
  d: RegData; per: RPer; team: TeamKey; lead: string | null; teams: Team[];
  /** the people shown (indexes), null: everyone */
  people: Set<number> | null; filters: RFilters; view: RView;
  half?: boolean; targets?: Record<string, number>;
  onBar?: (dim: RDim, label: string) => void; onFilter?: (dim: RDim) => void;
};

const statCache = new WeakMap<RCtx, Map<string, Map<string, RStats>>>();
/** The figures of the period on a side (0 this year, 1 the same days of last year), by a breakdown (its own filter left
 *  out) or all together - kept per drawing. */
function statsOf(c: RCtx, side: 0 | 1, dim?: RDim): Map<string, RStats> {
  let memo = statCache.get(c);
  if (!memo) { memo = new Map(); statCache.set(c, memo); }
  const k = `${side}|${dim ?? ""}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const out = statsBy(c.d, c.per.win, side, c.filters, c.people, dim);
  memo.set(k, out);
  return out;
}
const totalOf = (c: RCtx, side: 0 | 1 = 0) => statsOf(c, side).get("") ?? blank(c.per.months);
/** Nothing to compare with last year: a breakdown by the visit, or a visit chosen under Filters (no visits before 2026). */
const noPy = (c: RCtx, dim?: RDim) => (dim ? thisYearOnly(dim) : false) || !!c.filters.visit?.length;
/** registered on the day of a visit or after one */
const visitedFirst = (s: RStats) => (s.visit[REG_VISIT[0]] ?? 0) + (s.visit[REG_VISIT[1]] ?? 0);

/** A chart's target, one per chart, team and period: "eso-registrations:people:registered@eso-RABE~q2" (the year to date without "~"). */
const targetKey = (id: string, team: TeamKey, lead: string | null, per: RPer) => `eso-registrations:${id}@${team}${team === "eso" && lead ? `-${lead}` : ""}${/:months$/.test(id) || per.id === "ytd" ? "" : `~${per.id}`}`;
const targetFor = (c: RCtx, id: string) => { const t = c.targets?.[targetKey(id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/* ── the leaderboards ──────────────────────────────────────────────────── */

type Measure = "registered" | "bought" | "conversion" | "accounts" | "visited";
const MEASURE: Record<Measure, { title: string; fmt: (n: number) => string; unit: "n" | "pct"; target: string }> = {
  registered: { title: "Companies registered", fmt: int, unit: "n", target: "companies registered" },
  bought: { title: "Bought since registering", fmt: int, unit: "n", target: "companies that bought since registering" },
  conversion: { title: "Share that bought since registering", fmt: (n) => pct(n), unit: "pct", target: "share that bought since registering" },
  accounts: { title: "Shop accounts opened", fmt: int, unit: "n", target: "shop accounts opened" },
  visited: { title: "Registered on the day of a visit or after one", fmt: int, unit: "n", target: "companies registered on the day of a visit or after one" },
};
function boardRows(c: RCtx, dim: RDim, m: Measure): { rows: BoardRow[]; small: BoardRow[] } {
  const by = statsOf(c, 0, dim), was = statsOf(c, 1, dim);
  const rows: BoardRow[] = [], small: BoardRow[] = [];
  for (const label of new Set([...by.keys(), ...(m === "visited" ? [] : was.keys())])) {
    const s = by.get(label) ?? blank(c.per.months), p = was.get(label) ?? blank(c.per.months);
    let cur: number, prev: number, sub: string, ranked = true;
    if (m === "registered") { cur = s.companies; prev = p.companies; sub = `${int(s.bought)} bought since · ${int(s.already)} already customers`; }
    else if (m === "bought") { cur = s.bought; prev = p.bought; sub = `${pct(share(s.bought, s.fresh))} of ${int(s.fresh)} that had never ordered · median ${days(median(s.days))}`; }
    else if (m === "conversion") { cur = share(s.bought, s.fresh) ?? 0; prev = share(p.bought, p.fresh) ?? 0; sub = `${int(s.bought)} of ${int(s.fresh)} · last year ${pct(share(p.bought, p.fresh))}`; ranked = s.fresh >= MIN_COMPANIES; }
    else if (m === "accounts") { cur = s.accounts; prev = p.accounts; sub = `${int(s.more)} at companies already in the shop`; }
    else { cur = visitedFirst(s); prev = 0; sub = `${pct(share(cur, s.companies))} of ${int(s.companies)} registered · ${int(s.visit[REG_VISIT[0]] ?? 0)} on the day`; }
    if (!cur && !prev) continue;
    (ranked ? rows : small).push({ label, cur, prev, sub });
  }
  return { rows, small };
}
function Board({ c, id, dim, m, actions }: { c: RCtx; id: string; dim: RDim; m: Measure; actions?: React.ReactNode }) {
  const { rows, small } = boardRows(c, dim, m);
  const M = MEASURE[m];
  const noChange = m === "visited" || noPy(c, dim);
  return (
    <Leaderboard key={`${id}-${c.per.id}`} title={`${M.title} ${c.per.title}, by ${DIM[dim].lower}`} rows={rows} noChange={noChange}
      curLabel={perWords(c.d, c.per)} prevLabel={`${perWords(c.d, c.per, 1)}${m === "bought" || m === "conversion" ? `, bought by ${cutWords(c.d, 1)}` : ""}`}
      first={c.half ? 8 : 12} fmt={M.fmt} diff={signedInt} ratio={m === "conversion"} target={targetFor(c, id)}
      unranked={small.length ? { why: `under ${MIN_COMPANIES} companies that had never ordered`, rows: small } : undefined}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} actions={actions} />
  );
}

/* ── the months: this year's companies registered as columns, last year's tick across ── */

function RegMonths({ c, target }: { c: RCtx; target: number | null }) {
  const t = totalOf(c, 0), p = totalOf(c, 1);
  const data = t.months.map((v, i) => ({ x: MONTHS[c.per.win.from + i], v, was: p.months[i] ?? 0, running: c.per.win.from + i === nowMonth(c.d) }));
  const top = niceTop(Math.max(1, target ?? 0, ...data.map((x) => Math.max(x.v, x.was))));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const done = data.filter((x) => !x.running);
  const reached = target ? done.filter((x) => x.v >= target).length : 0;
  const sw = (bg: string) => <Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: bg }} />;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>{sw(THIS)}{c.d.year}</Box>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 14, height: 2, bgcolor: INK, borderRadius: 1 }} />{c.d.year - 1}, same month</Box>
        {target && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: INK, fontWeight: 600 }}><Box component="span" sx={{ width: 14, borderTop: `2px dashed ${TARGET}` }} />Target {int(target)} a month · <span style={{ color: reached === done.length ? GREEN : RED }}>{reached} of {done.length} months reached it</span></Box>}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: 28 + String(int(top)).length * 4 }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{int(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 160, maxHeight: 340 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          {target != null && <Box sx={{ position: "absolute", left: 0, right: 0, bottom: `${(target / top) * 100}%`, borderTop: `2px dashed ${TARGET}`, zIndex: 1, pointerEvents: "none" }} />}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((x) => (
              <Box key={x.x} title={`${x.x}${x.running ? ` (1 – ${todayDay(c.d)})` : ""}: ${int(x.v)} companies registered · ${c.d.year - 1}: ${int(x.was)}${target ? ` · ${pct(x.v / target)} of the target` : ""}`}
                sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px" }}>
                <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(x.v / top) * 100}%`, bgcolor: THIS, borderRadius: "4px 4px 0 0" }} />
                {x.was > 0 && <Box sx={{ position: "absolute", bottom: `calc(${(x.was / top) * 100}% - 1px)`, left: "50%", transform: "translateX(-50%)", width: "76%", maxWidth: 44, height: 2, bgcolor: INK, borderRadius: 1 }} />}
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
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: tone(changeOf(x.v, x.was)), lineHeight: 1.3, whiteSpace: "nowrap" }}>{x.was ? signedPct(changeOf(x.v, x.was)) : "—"}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/** The companies registered against their first visit, each way with what came of it (this year: visits are in HubSpot
 *  since 2026). */
function VisitSplit({ c }: { c: RCtx }) {
  const cols = c.half ? "minmax(0, 1fr) 104px minmax(0, 1fr)" : "minmax(200px, 1.1fr) minmax(60px, .8fr) 110px minmax(240px, 1.2fr)";
  const by = statsOf(c, 0, "visit");
  const t = totalOf(c);
  const rows = REG_VISIT.map((w) => [w, by.get(w) ?? blank(c.per.months)] as const);
  const max = Math.max(1, ...rows.map(([, s]) => s.companies));
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.map(([w, s]) => {
        const on = !!c.filters.visit?.includes(w);
        return (
          <Box key={w} component={c.onBar ? "button" : "div"} type={c.onBar ? "button" : undefined} onClick={c.onBar ? () => c.onBar!("visit", w) : undefined} aria-pressed={c.onBar ? on : undefined}
            sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) 96px", md: cols }, gap: 1.25, alignItems: "center", px: 1, py: 1, border: 0, borderBottom: `1px solid ${HAIRLINE}`, font: "inherit", textAlign: "left",
              cursor: c.onBar ? "pointer" : "default", bgcolor: on ? TINT.green.bg : "transparent", opacity: c.filters.visit?.length && !on ? 0.5 : 1, "&:hover": c.onBar ? { bgcolor: on ? TINT.green.bg : "rgba(21,34,58,.035)" } : {} }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{w}</Typography>
            {!c.half && <Box sx={{ display: { xs: "none", md: "block" }, height: 10, borderRadius: 5, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(s.companies / max) * 100}%`, bgcolor: THIS }} /></Box>}
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{int(s.companies)} <span style={{ color: MUTED, fontWeight: 500 }}>{pct(share(s.companies, t.companies))}</span></Typography>
            <Typography sx={{ display: { xs: "none", md: "block" }, fontSize: "0.78rem", color: MUTED }}>{int(s.bought)} bought since · {pct(share(s.bought, s.fresh))} of {int(s.fresh)} that had never ordered</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/* ── every chart by its key ────────────────────────────────────────────── */

type TargetOf = { unit: "pct" | "n"; label: string };
type Drawn = { id: string; title: (c: RCtx) => string; draw: (c: RCtx, actions?: React.ReactNode) => React.ReactNode; target?: (c: RCtx) => TargetOf };
const teamPart = (c: RCtx) => ` - ${teamName(c)}`;
const forWhom = (c: RCtx) => `${teamName(c)}'s target for ${c.per.title} - each team and period its own`;
/** A chart by its id "<tab>:<what>[-<breakdown>]": people:registered, people:months, visit:split, country:bought… */
function drawnOf(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  if (chart === "months") {
    const title = (c: RCtx) => `Companies registered ${c.per.title}, month by month${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} against the same months of ${c.d.year - 1} - the running month to the same day · each person's months in the table below`} actions={a}><RegMonths c={c} target={targetFor(c, id)} /></ChartBox>,
      target: (c) => ({ unit: "n", label: `Each month's companies registered are measured against it - a line across the months; the running month is not counted · ${teamName(c)}'s target.` }) };
  }
  if (chart === "split") {
    const title = (c: RCtx) => `Registered against the first visit, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · the companies registered, against their first completed customer visit by ${cutWords(c.d, 0)} · a click shows only them`} actions={a}><VisitSplit c={c} /></ChartBox> };
  }
  const [what, by] = chart.split("-");
  if (!(what in MEASURE)) return undefined;
  const m = what as Measure;
  const dim: RDim = by && (by in DIM) ? (by as RDim) : DIM_OF[v];
  return { id, title: (c) => `${MEASURE[m].title} ${c.per.title}, by ${DIM[dim].lower}${teamPart(c)}`, draw: (c, a) => <Board c={c} id={id} dim={dim} m={m} actions={a} />,
    target: (c) => ({ unit: MEASURE[m].unit, label: `Each ${DIM[dim].lower}'s ${MEASURE[m].target} ${c.per.title} is measured against it · ${forWhom(c)}.` }) };
}
/** The old Registrations page's keys, still in some BUC Views, by what took their place. */
function chartOf(key: string): Drawn | undefined {
  const [, view = "", chart = ""] = key.split(":");
  const asIs = drawnOf(`${view}:${chart}`);
  if (asIs) return asIs;
  const old: Record<string, string> = { "funnel:funnel": "people:months", "reps:companies": "people:registered", "reps:bought": "people:bought", "way:groups": "visit:split", "type:groups": "type:registered", "prio:groups": "prio:registered" };
  return old[`${view}:${chart}`] ? drawnOf(old[`${view}:${chart}`]) : undefined;
}

/* ── the tables ────────────────────────────────────────────────────────── */

type Row = { label: string; s: RStats; p: RStats };
const withChange = (text: string, a: number, b: number) => (
  <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
    {text}
    <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: changeNote(a, b)?.color ?? FAINT }}>{changeNote(a, b)?.text ?? "—"}</Box>
  </Box>
);
/** The columns every table shares: this year's figures with the change against the same days of last year under them. */
function colsOf(c: RCtx, dim: RDim): Col<Row>[] {
  const none = noPy(c, dim);
  const n = (get: (s: RStats) => number) => (r: Row) => (none ? int(get(r.s)) : withChange(int(get(r.s)), get(r.s), get(r.p)));
  return [
    { key: "companies", head: "Companies registered", tip: "Their first shop account opened in the period", cell: n((s) => s.companies), sort: (r) => r.s.companies },
    ...(none ? [] : [{ key: "py", head: `Same days of ${c.d.year - 1}`, cell: (r: Row) => int(r.p.companies), sort: (r: Row) => r.p.companies }]),
    { key: "already", head: "Already customers", tip: "Had ordered before their first shop account", cell: (r) => int(r.s.already), sort: (r) => r.s.already },
    { key: "fresh", head: "Had never ordered", cell: (r) => int(r.s.fresh), sort: (r) => r.s.fresh },
    { key: "bought", head: "Bought since", tip: `Of those that had never ordered: their first order on the day of registering or after it, by ${cutWords(c.d, 0)} (last year's by ${cutWords(c.d, 1)})`, cell: n((s) => s.bought), sort: (r) => r.s.bought },
    { key: "conv", head: "Bought, of them", cell: (r) => pct(share(r.s.bought, r.s.fresh)), sort: (r) => share(r.s.bought, r.s.fresh) ?? -1 },
    { key: "days", head: "Median days to the first order", cell: (r) => days(median(r.s.days)), sort: (r) => median(r.s.days) ?? -1 },
    ...(dim === "visit" ? [] : [{ key: "visited", head: "On the day of a visit or after one", tip: "Registered on the day of their first completed visit or after it - visits are in HubSpot since 2026", cell: (r: Row) => int(visitedFirst(r.s)), sort: (r: Row) => visitedFirst(r.s) }]),
    { key: "accounts", head: "Shop accounts opened", tip: "Every account opened in the period, also at companies already in the shop", cell: n((s) => s.accounts), sort: (r) => r.s.accounts },
    { key: "more", head: "At companies already in the shop", cell: (r) => int(r.s.more), sort: (r) => r.s.more },
  ];
}
function rowsOf(c: RCtx, dim: RDim): Row[] {
  const by = statsOf(c, 0, dim), was = noPy(c, dim) ? new Map<string, RStats>() : statsOf(c, 1, dim);
  return [...new Set([...by.keys(), ...was.keys()])].map((label) => ({ label, s: by.get(label) ?? blank(c.per.months), p: was.get(label) ?? blank(c.per.months) }));
}
function DimTable({ c, dim }: { c: RCtx; dim: RDim }) {
  const order = ORDER[dim];
  const rows = rowsOf(c, dim);
  const sorted = order ? [...rows].sort((a, b) => ((order.indexOf(a.label) + 99) % 99) - ((order.indexOf(b.label) + 99) % 99) || a.label.localeCompare(b.label)) : rows;
  const total: Row = { label: "Total", s: totalOf(c, 0), p: totalOf(c, 1) };
  return <FullTable key={`${dim}-${c.per.id}-${c.team}`} first={DIM[dim].name} cols={colsOf(c, dim)} initial="companies" rows={sorted} total={total} natural={!!order}
    selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} find={`a ${DIM[dim].lower}`} tint={DIM[dim].tint} />;
}
/** Each person's companies registered month by month. */
function PeopleMonths({ c }: { c: RCtx }) {
  const by = statsOf(c, 0, "person");
  type MRow = { label: string; months: number[]; companies: number };
  const rows: MRow[] = [...by].map(([label, s]) => ({ label, months: s.months, companies: s.companies })).filter((r) => r.companies);
  const t = totalOf(c);
  const cols: Col<MRow>[] = [
    ...t.months.map((_, i) => ({ key: `m${i}`, head: MONTHS[c.per.win.from + i], cell: (r: MRow) => (r.months[i] ? int(r.months[i]) : "—"), sort: (r: MRow) => r.months[i] ?? 0 })),
    { key: "companies", head: perCap(c.per), cell: (r) => <b>{int(r.companies)}</b>, sort: (r) => r.companies },
  ];
  return <FullTable key={`pm-${c.per.id}-${c.team}`} first="Person" cols={cols} initial="companies" rows={rows} total={{ label: "Total", months: t.months, companies: t.companies }} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" tint="pink" />;
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string, target?: TargetOf) => React.ReactNode;
const draw = (c: RCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c), d.target?.(c))); };

function TabCard({ c, act, footnote }: { c: RCtx; act: Act; footnote: React.ReactNode }) {
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const words = `${perWords(c.d, c.per)} against ${perWords(c.d, c.per, 1)}`;
  if (c.view === "people") return (
    <GlassCard sx={card}>
      <CardTitle icon={<BadgeOutlinedIcon />} tint="pink" title={`${teamName(c)}, ${c.per.title}`} note={`${words} · companies registered in the shop, by the company's owner`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "people:registered")}{draw(c, act, "people:bought")}</Box>
      {c.per.months >= 2 && draw(c, act, "people:months")}
      {c.per.months >= 2 && <Box><SubTitle>Companies registered by person, month by month</SubTitle><PeopleMonths c={c} /></Box>}
      <Box sx={TWO}>{draw(c, act, "people:conversion")}{draw(c, act, "people:accounts")}</Box>
      <Box><SubTitle>{perCap(c.per)}, by person</SubTitle><DimTable c={c} dim="person" /></Box>
      {footnote}
    </GlassCard>
  );
  if (c.view === "visit") return (
    <GlassCard sx={card}>
      <CardTitle icon={<DirectionsCarOutlinedIcon />} tint="green" title={`${teamName(c)}: registered against the first visit, ${c.per.title}`} note={`${perWords(c.d, c.per)} · ${DIM.visit.note} - this year only · click a way to see who bought of it`} />
      <Box sx={{ mt: -1 }}>{draw(c, act, "visit:split")}</Box>
      <Box sx={TWO}>{draw(c, act, "visit:visited-person")}{draw(c, act, "visit:bought-person")}</Box>
      <Box><SubTitle>{perCap(c.per)}, against the first visit</SubTitle><DimTable c={c} dim="visit" /></Box>
      {footnote}
    </GlassCard>
  );
  if (c.view === "prio") return (
    <GlassCard sx={card}>
      <CardTitle icon={<FlagOutlinedIcon />} tint="purple" title={`${teamName(c)} by priority and potential, ${c.per.title}`} note={`${DIM.prio.note} · ${DIM.band.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "prio:registered")}{draw(c, act, "prio:registered-band")}</Box>
      <Box sx={TWO}>{draw(c, act, "prio:bought")}{draw(c, act, "prio:bought-band")}</Box>
      <Box><SubTitle>{perCap(c.per)}, by priority</SubTitle><DimTable c={c} dim="prio" /></Box>
      <Box><SubTitle>{perCap(c.per)}, by potential</SubTitle><DimTable c={c} dim="band" /></Box>
      {footnote}
    </GlassCard>
  );
  const dim = DIM_OF[c.view], dd = DIM[dim];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={dd.icon} tint={dd.tint} title={`${teamName(c)} by ${dd.lower}, ${c.per.title}`} note={`${dd.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, `${c.view}:registered`)}{draw(c, act, `${c.view}:bought`)}</Box>
      <Box><SubTitle>{perCap(c.per)}, by {dd.lower}</SubTitle><DimTable c={c} dim={dim} /></Box>
      {footnote}
    </GlassCard>
  );
}
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures top right ─────────────────────────────────────────────── */

type Fig = { id: string; label: string; value: string; sub: React.ReactNode; icon: React.ReactNode; tint: Tint; amount: number; unit: "n" | "pct" };
function figuresOf(c: RCtx): Fig[] {
  const t = totalOf(c, 0), p = totalOf(c, 1);
  const P = c.per.title;
  const ch = (a: number, b: number) => { const x = changeNote(a, b); return x ? <span style={{ color: x.color, fontWeight: 700 }}>{x.text}</span> : "—"; };
  const conv = share(t.bought, t.fresh), convPy = share(p.bought, p.fresh);
  // under a visit filter last year has nothing to compare (no visits before 2026)
  const py = !noPy(c);
  return [
    { id: "fig-registered", label: `Companies registered ${P}`, value: int(t.companies), sub: py ? <>{ch(t.companies, p.companies)} · {int(p.companies)} the same days of {c.d.year - 1}</> : `${int(t.fresh)} had never ordered`, icon: <HowToRegOutlinedIcon />, tint: "pink", amount: t.companies, unit: "n" },
    { id: "fig-bought", label: "Bought since registering", value: int(t.bought), sub: <>{pct(conv)} of {int(t.fresh)} that had never ordered{py ? ` · ${c.d.year - 1}: ${pct(convPy)}` : ""}</>, icon: <ShoppingCartCheckoutOutlinedIcon />, tint: "green", amount: t.bought, unit: "n" },
    { id: "fig-days", label: "Median days to the first order", value: days(median(t.days)), sub: py ? `${c.d.year - 1}: ${days(median(p.days))}` : `over ${int(t.days.length)} that bought`, icon: <TimerOutlinedIcon />, tint: "amber", amount: median(t.days) ?? 0, unit: "n" },
    { id: "fig-already", label: "Already customers", value: int(t.already), sub: `${pct(share(t.already, t.companies))} had ordered before registering`, icon: <RepeatIcon />, tint: "slate", amount: t.already, unit: "n" },
    { id: "fig-visited", label: "On the day of a visit or after one", value: int(visitedFirst(t)), sub: `${pct(share(visitedFirst(t), t.companies))} of the companies registered`, icon: <DirectionsCarOutlinedIcon />, tint: "green", amount: visitedFirst(t), unit: "n" },
    { id: "fig-accounts", label: `Shop accounts opened ${P}`, value: int(t.accounts), sub: <>{py ? <>{ch(t.accounts, p.accounts)} · </> : null}{int(t.more)} at companies already in the shop</>, icon: <PersonAddAltOutlinedIcon />, tint: "blue", amount: t.accounts, unit: "n" },
  ];
}
function FigureCards({ c, items, actions }: { c: RCtx; items: Fig[]; actions?: (f: Fig) => React.ReactNode }) {
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
            {tgt != null && <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: f.amount >= tgt ? GREEN : RED }}>{pct(f.amount / tgt)} of the target {f.unit === "pct" ? pct(tgt) : int(tgt)}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── the Filters window: the period and the breakdowns ─────────────────── */

function RPeriod({ d, per, onPer }: { d: RegData; per: RPer; onPer: (w: RWin) => void }) {
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
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>This year&apos;s months, each against the same months of {d.year - 1} - the running month to the same day.</Typography>
    </Box>
  );
}
function RFacet({ c, dim, onPick }: { c: RCtx; dim: RDim; onPick: (l: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const by = statsOf(c, 0, dim);
  const order = ORDER[dim];
  const rows = [...by].map(([label, s]) => ({ label, n: s.companies })).filter((r) => r.n || c.filters[dim]?.includes(r.label));
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
const FILTER_DIMS: RDim[] = ["person", "status", "visit", "country", "prio", "band", "category", "type"];
function RFilterWindow({ c, per, open, onClose, focus, onPer, toggle, clearAll }: {
  c: RCtx; per: RPer; open: boolean; onClose: () => void; focus: { dim: RDim; n: number } | null; onPer: (w: RWin) => void; toggle: (d: RDim, l: string) => void; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<RDim | "period", boolean>>>({});
  const isOpen = (k: RDim | "period") => (shut[k] !== undefined ? !shut[k] : k === "period" || k === "person" || !!c.filters[k as RDim]?.length);
  const [live, setLive] = useState(open);
  useEffect(() => { if (open) { setLive(true); return; } const t = setTimeout(() => setLive(false), 320); return () => clearTimeout(t); }, [open]);
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.dim]: false }));
    const t = setTimeout(() => document.getElementById(`rfilter-${focus.dim}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const chosen = FILTER_DIMS.flatMap((d) => (c.filters[d] ?? []).map((v) => [d, v] as const));
  return (
    <FilterPanel id="eso-registrations-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, v]) => <Chip key={`${d}:${v}`} size="small" label={<span><b>{DIM[d].name}:</b> {v}</span>} onDelete={() => toggle(d, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          <FilterSection id="rfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => setShut((s) => ({ ...s, period: isOpen("period") }))} summary={perCap(per)}>
            <RPeriod d={c.d} per={per} onPer={onPer} />
          </FilterSection>
          {FILTER_DIMS.map((dim, i) => (
            <FilterSection key={dim} id={`rfilter-${dim}`} index={i + 1} title={DIM[dim].name} icon={DIM[dim].icon} tint={DIM[dim].tint} open={isOpen(dim)} onFlip={() => setShut((s) => ({ ...s, [dim]: isOpen(dim) }))}
              summary={!c.filters[dim]?.length ? "All" : c.filters[dim]!.length === 1 ? c.filters[dim]![0] : `${c.filters[dim]!.length} chosen`} chosen={!!c.filters[dim]?.length}>
              <RFacet c={c} dim={dim} onPick={(l) => toggle(dim, l)} />
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
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The registrations could not be read: ${error}` : `Reading every shop registration in HubSpot${progress ? ` · ${progress}` : ""}…`}</Typography>
      </Box>
    </GlassCard>
  );
}
const ym = (d: RegData, m: number) => `${d.year}-${String(m + 1).padStart(2, "0")}`;
const fromYm = (d: RegData, x: string | null) => { const m = /^(\d{4})-(\d{2})$/.exec(x ?? ""); return m && Number(m[1]) === d.year ? Number(m[2]) - 1 : null; };

function Footnote({ d }: { d: RegData }) {
  return (
    <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
      Registered: the day the shop says the account was opened (Magento &quot;customer since&quot;) - not the day HubSpot created the contact, and not the qualification&apos;s answers. A company registers once, with its first shop account; later accounts at it count as shop accounts opened at companies already in the shop.
      {" "}Each period against the same months of {d.year - 1}, the running month to the same day. Bought since: of the companies that had never ordered, a first order on the day of registering or after it, by {cutWords(d, 0)} - last year&apos;s by {cutWords(d, 1)}, so both had as long to buy. Already customers: a first order before registering.
      {" "}Against the first visit: the company&apos;s first completed customer visit (the stage &quot;Visit and Report complete&quot;); visits are in HubSpot since 2026, so this is this year only.
      {" "}People: the company&apos;s owner in HubSpot today, in both years. ESO and TSA: the rosters, else the owner&apos;s HubSpot team; a line manager&apos;s team as Map assignment&apos;s SAE table sets it; Total: every company, and the accounts no company is linked to ({int(d.coverage.noCompany)}).
      {" "}Whether the ESO opened an account on a customer&apos;s behalf is not recorded: every account in HubSpot names the shop&apos;s store view, none the shop&apos;s admin.
      {" "}{int(d.coverage.accounts)} shop accounts read, {int(d.coverage.companies)} companies, {int(d.coverage.visits)} completed visits. Read from HubSpot {new Date(d.generatedAt).toLocaleString("en-GB")}, every hour.
    </Typography>
  );
}

export function RegistrationsExplorer() {
  const params = useSearchParams();
  const { d, computing, progress, error } = useRegistrations();
  const [team, setTeam] = useTeam();
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  const { state: acts } = useActions("eso-registrations");
  const view: RView = isView(params.get("view")) ? (params.get("view") as RView) : "people";
  const setView = (v: RView) => setQuery((q) => { if (v === "people") q.delete("view"); else q.set("view", v); });
  const filters: RFilters = useMemo(() => Object.fromEntries(FILTER_DIMS.flatMap((k) => (params.getAll(k).length ? [[k, params.getAll(k)]] : []))), [params]);
  const toggle = (k: RDim, label: string) => setQuery((q) => { const cur = q.getAll(k), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]; q.delete(k); for (const x of next) q.append(k, x); });
  const clearAll = () => setQuery((q) => { for (const k of FILTER_DIMS) q.delete(k); q.delete("from"); q.delete("to"); });
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: RDim; n: number } | null>(null);
  const openOn = (k: RDim) => { setFocus((f) => ({ dim: k, n: (f?.n ?? 0) + 1 })); setPanel(true); };
  const setPer = (w: RWin) => setQuery((q) => { if (!d) return; const ytd = presetsOf(d)[0].win; if (w.from === ytd.from && w.to === ytd.to) { q.delete("from"); q.delete("to"); } else { q.set("from", ym(d, w.from)); q.set("to", ym(d, w.to)); } });

  // the work a click asks for, kept; the tabs and toggles answer at once and the charts follow (as the Figures)
  const lead = leadOf(team, leadKey, lt);
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
  const c = useMemo<RCtx | null>(() => (d && drawn.per ? {
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
  if (!d || !c || !per) return (<Box sx={shell}>{back}<Typography component="h1" sx={H1}>Registrations</Typography><Waiting computing={computing} progress={progress} error={error} /></Box>);

  const act: Act = (id, title, target) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-registrations:${id}`, page: "eso-registrations", tab: c.view, title, summary: `${teamName(c)} · ${perWords(d, c.per)}`,
        filters: { ...Object.fromEntries(FILTER_DIMS.filter((k) => c.filters[k]?.length).map((k) => [k, c.filters[k] ?? []])), team: [c.team], ...(c.lead ? { lead: [c.lead] } : {}), ...(c.per.id.startsWith("m") ? { from: [ym(d, c.per.win.from)], to: [ym(d, c.per.win.to)] } : { period: [c.per.id] }) },
        kind: "card", target: target ? { key: targetKey(id, c.team, c.lead, c.per), ...target } : undefined }} />
  );
  const now = { team, lead, teams };
  const chosen = FILTER_DIMS.flatMap((k) => (filters[k] ?? []).map((v) => [k, v] as const));
  return (
    <Box sx={shell}>
      {back}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>Registrations</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamName(now)}</b> · {per.title} <b style={{ color: INK }}>{perWords(d, per)}</b> against the same days of {d.year - 1}{computing ? " · reading HubSpot again" : ""}
          </Typography>
          {(chosen.length > 0 || per.id !== "ytd") && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {per.id !== "ytd" && <Chip size="small" label={<span><b>Period:</b> {perCap(per)}</span>} onDelete={() => setPer(presetsOf(d)[0].win)} onClick={() => setPanel(true)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.blue.fg } }} />}
              {chosen.map(([k, v]) => <Chip key={`${k}:${v}`} size="small" label={<span><b>{DIM[k].name}:</b> {v}</span>} onDelete={() => toggle(k, v)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[DIM[k].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[k].tint].fg } }} />)}
              {chosen.length > 0 && <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>}
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}><FigureCards c={c} items={figs} /></Box>
      </Box>
      <Box sx={{ display: "grid", gap: 0.75, mt: -0.5 }}>
        <Teams team={team} onTeam={setTeam} lead={leadKey} onLead={setLead} teams={teams} />
        {lead && people && people.size === 0 && <NoLeadYet name={teamName(now)} />}
      </Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="eso-registrations" tab={view} onSelect={setView} tabs={VIEWS.map((v) => ({ id: v.id, label: v.label, count: v.id !== "people" && filters[DIM_OF[v.id]]?.length ? String(filters[DIM_OF[v.id]]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-registrations" /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else openOn(DIM_OF[view]); }} variant={panel || chosen.length || per.id !== "ytd" ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-registrations-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length || per.id !== "ytd" ? undefined : "#fff" }}>
          Filters{chosen.length + (per.id !== "ytd" ? 1 : 0) ? ` · ${chosen.length + (per.id !== "ytd" ? 1 : 0)}` : ""}
        </Button>
      </Box>
      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} act={act} footnote={<Footnote d={d} />} />
      </Box>
      <RFilterWindow c={c} per={per} open={panel} onClose={() => setPanel(false)} focus={focus} onPer={setPer} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's Registrations panel ────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
const PANEL = "eso-registrations:panel:";

/** Registrations in the BUC View: the year to date for the team the toggle shows, the months, and the charts sent here. */
export function RegistrationsPanel({ acts }: { acts: ActionsState | null }) {
  const { d, computing, progress, error } = useRegistrations();
  const [team, setTeamKey] = useState<TeamKey>("eso");
  const [leadKey, setLeadKey] = useState<LeadKey>("all");
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  useEffect(() => { try { const x = asTeam(localStorage.getItem(KEPT)); if (x) setTeamKey(x); const l = asLead(localStorage.getItem(KEPT_LEAD)); if (l) setLeadKey(l); } catch { /* ESO */ } }, []);
  const choose = (t: TeamKey) => { setTeamKey(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const chooseLead = (l: LeadKey) => { setLeadKey(l); try { localStorage.setItem(KEPT_LEAD, l); } catch { /* here only */ } };
  const lead = leadOf(team, leadKey, lt);
  const want = useMemo(() => ({ team, lead }), [team, lead]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<RCtx | null>(() => (d ? { d, per: perOf(d, presetsOf(d)[0].win), team: drawn.team, lead: drawn.lead, teams, people: peopleOf(d, drawn.team, drawn.lead, lt?.byId ?? {}), filters: {}, view: "people", targets: acts?.targets } : null),
    [d, drawn, teams, lt, acts?.targets]);
  const items: SortItem[] = useMemo(() => !c ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-registrations" && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const ch = chartOf(spec.key);
    const fmt = formatOf(acts, spec);
    const f = spec.filters ?? {};
    const sf: RFilters = Object.fromEntries(FILTER_DIMS.flatMap((k) => (f[k]?.length ? [[k, f[k]]] : [])));
    const pid = f.period?.[0], pr = pid ? presetsOf(c.d).find((p) => p.id === pid) : null;
    const a0 = fromYm(c.d, f.from?.[0] ?? null), b0 = fromYm(c.d, f.to?.[0] ?? null);
    const sp = pr ? perOf(c.d, pr.win) : a0 != null && b0 != null ? perOf(c.d, { from: a0, to: b0 }) : c.per;
    // every chart here follows the panel's toggle (as the Figures' and the Visits' panels); its filters and period stay as sent
    const sc: RCtx = { ...c, per: sp, filters: sf, view: (spec.tab && isView(spec.tab) ? spec.tab : "people") as RView, half: fmt === "half" };
    const target = ch?.target ? { key: targetKey(ch.id, c.team, c.lead, sp), ...ch.target(sc) } : undefined;
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind, target }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<HowToRegOutlinedIcon />} tint="pink" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [c, acts]);
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-registrations", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);
  const shown = (id: string) => placementOf(acts, `${PANEL}${id}`, "nutshell") === "nutshell";
  const own = (id: string, title: string, kind: "kpi" | "card", target?: { key: string; unit: "pct" | "n"; label: string }) => (
    <TileActions where="nutshell" start="nutshell" edge={2} tile={{ key: `${PANEL}${id}`, page: "eso-registrations", tab: "people", title: `${title} - ${c ? teamName(c) : "ESO"}`, kind,
      filters: { team: [drawn.team], ...(drawn.lead ? { lead: [drawn.lead] } : {}), period: ["ytd"] }, href: `/reporting/eso-benchmark/registrations?team=${drawn.team}${drawn.lead ? `&lead=${drawn.lead}` : ""}`, target }} />
  );
  const months = drawnOf("people:months")!;
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<HowToRegOutlinedIcon />} tint="pink" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/registrations?team=${team}${lead ? `&lead=${lead}` : ""}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.pink.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Registrations</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.pink.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName({ team, lead, teams })} · year to date ${perWords(c.d, c.per)} against ${perWords(c.d, c.per, 1)} · shop registrations` : "Shop registrations"}</Typography>
        </Box>
        <Teams team={team} onTeam={choose} lead={leadKey} onLead={chooseLead} teams={teams} />
      </Box>
      {!c ? <Waiting computing={computing} progress={progress} error={error} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          <FigureCards c={c} items={figs.filter((f) => shown(f.id))} actions={(f) => own(f.id, f.label, "kpi", { key: targetKey(`panel:${f.id}`, c.team, c.lead, c.per), unit: f.unit, label: `${f.label} is measured against it · ${teamName(c)}'s target.` })} />
          {shown("months") && months.draw(c, own("months", "Companies registered year to date, month by month", "card", months.target ? { key: targetKey(months.id, c.team, c.lead, c.per), ...months.target(c) } : undefined))}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-registrations"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </Box>
      )}
    </GlassCard>
  );
}

"use client";
// THE ESO TICKETS PAGE, rebuilt like Visits (SARCLA 29.10.2026: "work on ESO Reports > Tickets" - his pick: "rebuild
// like Visits", for one question: tickets -> orders, per person). What the old page did wrong: the benchmark's per-rep
// totals only (no period, no filter but the reps, no company); every kind of ticket in one count, though an erosion or
// a win-back ticket ends in an order far less often than a customer's request; last year's whole pipeline beside this
// year's although it began in July 2025; read every 12 hours. The rows and their rules: src/lib/reporting/ticketsRules.ts.

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
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import PercentOutlinedIcon from "@mui/icons-material/PercentOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import HourglassBottomOutlinedIcon from "@mui/icons-material/HourglassBottomOutlined";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { everyWhileSeen } from "@/app/reporting/marketing-kpis/data";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, placementOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import type { SlowState } from "@/lib/integrations/slowReport";
import { CATEGORY_BANDS, PRIO_BANDS } from "@/lib/reporting/esoRules";
import { CHANNEL_ORDER, KINDS, POTENTIAL_BANDS, PY_MIN, T, blank, comparable, labelOf, rateOf, rowsOf, statsBy, type TDim, type TFilters, type TStats, type TWin, type TicketsData } from "@/lib/reporting/ticketsRules";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  ChartBox, FullTable, H1, KEPT, KEPT_LEAD, Leaderboard, NoLeadYet, SubTitle, TARGET, TWO, asLead, asTeam, axisWidth, leadOf, niceTop, setQuery, useLead, useLeads, useTeam,
  type BoardRow, type Col, type LeadKey, type TeamKey,
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
const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** An order rate ranks a person or a group from this many tickets closed with a resolution - two of three said nothing. */
const MIN_RESOLVED = 10;
/** "40 of 117" - the tickets ordered of those closed with a resolution */
const ofWords = (s: Pick<TStats, "ordered" | "resolved">) => `${int(s.ordered)} of ${int(s.resolved)}`;

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
/** "1 Jan – 29 Oct 2026", "Apr–Jun 2026" */
function perWords(d: TicketsData, per: TPer) {
  const run = per.win.to === nowMonth(d);
  if (per.win.from === per.win.to) return run ? `1 – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS_FULL[per.win.from]} ${d.year}`;
  return run ? `1 ${MONTHS[per.win.from]} – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS[per.win.from]}–${MONTHS[per.win.to]} ${d.year}`;
}
const perCap = (p: TPer) => p.title.charAt(0).toUpperCase() + p.title.slice(1);
/** the months a period spans, the running one as far as it has gone */
const monthsDone = (d: TicketsData, per: TPer) => per.months - (per.win.to === nowMonth(d) ? 1 - todayDay(d) / new Date(Date.UTC(d.year, per.win.to + 1, 0)).getUTCDate() : 0);

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

type TView = "people" | "kind" | "prio" | "category" | "country";
const VIEWS: { id: TView; label: string }[] = [
  { id: "people", label: "People" }, { id: "kind", label: "Kind of ticket" }, { id: "prio", label: "Priority & potential" },
  { id: "category", label: "Customer category" }, { id: "country", label: "Country" },
];
const isView = (x: string | null): x is TView => VIEWS.some((v) => v.id === x);
const DIM_OF: Record<TView, TDim> = { people: "person", kind: "channel", prio: "prio", category: "category", country: "country" };
/** `one`: what a search box looks for - "Find a source…" */
const DIM: Record<TDim, { name: string; lower: string; one: string; icon: React.ReactNode; tint: Tint; note: string }> = {
  person: { name: "Person", lower: "person", one: "a person", icon: <BadgeOutlinedIcon />, tint: "green", note: "Who owns the ticket today" },
  kind: { name: "Kind of ticket", lower: "kind of ticket", one: "a kind of ticket", icon: <AltRouteIcon />, tint: "purple", note: "A customer's request, a lifecycle hand-over (abandoned cart, lost lead, second purchase, poor rating) or a push or campaign typed in for the ESO (erosion, win back, the September push, price checks, GQS sales follow-ups)" },
  channel: { name: "Came from", lower: "where it came from", one: "a source", icon: <AltRouteIcon />, tint: "purple", note: "Where the ticket came from - a website form, the chat, an e-mail, a request the ESO typed in, one redirected from Back Office, the helpline, a lifecycle workflow, or a push" },
  prio: { name: "Priority", lower: "priority", one: "a priority", icon: <FlagOutlinedIcon />, tint: "purple", note: "The ticket's company's priority: Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500" },
  band: { name: "Potential", lower: "potential", one: "a potential", icon: <SavingsOutlinedIcon />, tint: "amber", note: "The ticket's company's yearly potential in HubSpot, in bands - a placeholder over €1m counts as not set" },
  category: { name: "Customer category", lower: "customer category", one: "a customer category", icon: <CategoryOutlinedIcon />, tint: "blue", note: "The ticket's company's APSO customer category - Other: APSOlost, APSOmicro, Growth Engine and not set" },
  country: { name: "Country", lower: "country", one: "a country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where the ticket's company is" },
};
const ORDER: Partial<Record<TDim, readonly string[]>> = { kind: KINDS, channel: CHANNEL_ORDER, prio: PRIO_BANDS, category: CATEGORY_BANDS, band: POTENTIAL_BANDS };

export type TCtx = {
  d: TicketsData; per: TPer; team: TeamKey; lead: string | null; teams: Team[];
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
  const rows = rowsOf(c.d, win, c.filters, c.people, dim);
  const out = statsBy(rows, win, dim ? (r) => labelOf(c.d, r, dim) : undefined);
  memo.set(k, out);
  return out;
}
const totalOf = (c: TCtx, py = false) => statsOf(c, undefined, py).get("") ?? blank(c.per.months);
const pyCache = new WeakMap<TCtx, boolean>();
/** Last year's same months beside this year's - only when each of them held enough tickets for the people shown. */
function pyOk(c: TCtx): boolean {
  let v = pyCache.get(c);
  if (v === undefined) { v = comparable(c.d, c.per.win, c.people); pyCache.set(c, v); }
  return v;
}

/** A chart's target, one per chart, team and period: "eso-tickets:people:ordered@eso-RABE~q2" (the year to date without "~"). */
const targetKey = (id: string, team: TeamKey, lead: string | null, per: TPer) => `eso-tickets:${id}@${team === "eso" ? "eso" : "total"}${team === "eso" && lead ? `-${lead}` : ""}${/:months$/.test(id) || per.id === "ytd" ? "" : `~${per.id}`}`;
const targetFor = (c: TCtx, id: string) => { const t = c.targets?.[targetKey(id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/* ── the leaderboards ──────────────────────────────────────────────────── */

type Measure = "ordered" | "rate" | "tickets" | "value" | "open";
const MEASURE: Record<Measure, { title: string; fmt: (n: number) => string; unit: "n" | "pct" | "eur"; target: string }> = {
  ordered: { title: "Tickets that ended in an order", fmt: int, unit: "n", target: "tickets that ended in an order" },
  rate: { title: "Order rate", fmt: (n) => pct(n), unit: "pct", target: "order rate" },
  tickets: { title: "Tickets", fmt: int, unit: "n", target: "tickets" },
  value: { title: "Ticket value of the orders", fmt: eur, unit: "eur", target: "ticket value of the tickets that ended in an order" },
  open: { title: "Tickets still open", fmt: int, unit: "n", target: "tickets still open" },
};
function boardRows(c: TCtx, dim: TDim, m: Measure): { rows: BoardRow[]; small: BoardRow[] } {
  const by = statsOf(c, dim);
  const t = totalOf(c);
  const done = monthsDone(c.d, c.per);
  const rows: BoardRow[] = [], small: BoardRow[] = [];
  for (const [label, s] of by) {
    let cur: number, sub: string, ranked = true;
    if (m === "ordered") { cur = s.ordered; sub = `${pct(rateOf(s))} of ${int(s.resolved)} closed · ${eur(s.value)}`; }
    else if (m === "rate") { cur = rateOf(s) ?? 0; sub = `${ofWords(s)} closed with a resolution`; ranked = s.resolved >= MIN_RESOLVED; if (!s.resolved) continue; }
    else if (m === "tickets") { cur = s.tickets; sub = dim === "person" ? `${(s.tickets / Math.max(done, 0.1)).toFixed(1)} a month · ${int(s.ordered)} ordered · ${int(s.open)} open` : `${pct(t.tickets ? s.tickets / t.tickets : null)} of the tickets · ${int(s.ordered)} ordered`; }
    else if (m === "value") { cur = s.value; sub = `${int(s.ordered)} tickets ordered`; }
    else { cur = s.open; sub = `${eur(s.openValue)} ticket value · of ${int(s.tickets)} tickets`; }
    if (!cur && m !== "rate") continue;
    (ranked ? rows : small).push({ label, cur, prev: 0, sub });
  }
  return { rows, small };
}
function Board({ c, id, dim, m, actions }: { c: TCtx; id: string; dim: TDim; m: Measure; actions?: React.ReactNode }) {
  const { rows, small } = boardRows(c, dim, m);
  const M = MEASURE[m];
  return (
    <Leaderboard key={`${id}-${c.per.id}`} title={`${M.title} ${c.per.title}, by ${DIM[dim].lower}`} rows={rows} noChange
      curLabel={perWords(c.d, c.per)} prevLabel="" first={c.half ? 8 : 12} fmt={M.fmt} ratio={m === "rate"} target={targetFor(c, id)}
      unranked={small.length ? { why: `under ${MIN_RESOLVED} tickets closed with a resolution`, rows: small } : undefined}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} actions={actions} />
  );
}

/* ── the months: the tickets that ended in an order as columns, the order rate under each ── */

function TicketMonths({ c, target }: { c: TCtx; target: number | null }) {
  const t = totalOf(c);
  const data = t.monthsOrdered.map((v, i) => ({ x: MONTHS[c.per.win.from + i], v, tickets: t.months[i], resolved: t.monthsResolved[i], running: c.per.win.from + i === nowMonth(c.d) }));
  const top = niceTop(Math.max(1, target ?? 0, ...data.map((x) => x.v)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const done = data.filter((x) => !x.running);
  const reached = target ? done.filter((x) => x.v >= target).length : 0;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: THIS }} />Tickets that ended in an order</Box>
        <Box component="span">Under each month: the order rate</Box>
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
              <Box key={x.x} title={`${x.x}${x.running ? " (to date)" : ""}: ${int(x.tickets)} tickets · ${int(x.v)} ended in an order, of ${int(x.resolved)} closed with a resolution (${pct(x.resolved ? x.v / x.resolved : null)})${target ? ` · ${pct(x.v / target)} of the target` : ""}`} sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px" }}>
                <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(x.v / top) * 100}%`, bgcolor: THIS, opacity: x.running ? 0.55 : 1, borderRadius: "4px 4px 0 0" }} />
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
              <Typography sx={{ fontSize: "0.68rem", color: FAINT, lineHeight: 1.3 }}>{pct(x.resolved ? x.v / x.resolved : null)}</Typography>
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
/** A chart by its id "<tab>:<what>[-<breakdown>]": people:ordered, kind:rate, prio:ordered-band, people:months… */
function drawnOf(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  if (chart === "months") {
    const title = (c: TCtx) => `Tickets that ended in an order ${c.per.title}, month by month${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · by the month the ticket came in · the running month to date, lighter · each person's months in the table below`} actions={a}><TicketMonths c={c} target={targetFor(c, id)} /></ChartBox>,
      target: (c) => ({ unit: "n", label: `Each month's tickets that ended in an order are measured against it - a line across the months; the running month is not counted · ${teamName(c)}'s target.` }) };
  }
  const [what, by] = chart.split("-");
  if (!(what in MEASURE)) return undefined;
  const m = what as Measure;
  const dim: TDim = by && (by in DIM) ? (by as TDim) : DIM_OF[v];
  return { id, title: (c) => `${MEASURE[m].title} ${c.per.title}, by ${DIM[dim].lower}${teamPart(c)}`, draw: (c, a) => <Board c={c} id={id} dim={dim} m={m} actions={a} />,
    target: (c) => ({ unit: MEASURE[m].unit, label: `Each ${DIM[dim].lower}'s ${MEASURE[m].target} ${c.per.title} is measured against it · ${forWhom(c)}.` }) };
}
/** The old page's keys, still in some BUC Views, by what took their place. */
function chartOf(key: string): Drawn | undefined {
  const [, view = "", chart = ""] = key.split(":");
  const old: Record<string, string> = {
    "reps:created": "people:tickets", "reps:ordered": "people:ordered", "speed:counts": "people:months", "source:source": "kind:ordered",
    "resolution:resolution": "people:rate", "open:count": "people:open", "open:potential": "people:open",
  };
  return drawnOf(old[`${view}:${chart}`] ?? `${view}:${chart}`);
}

/* ── the tables ────────────────────────────────────────────────────────── */

type Row = TStats & { label: string; pyRate?: number | null };
/** The columns every table shares: the tickets, how many were decided and ordered, the rate, the value, what is still open. */
function cols(c: TCtx, share: boolean, py: boolean): Col<Row>[] {
  const t = totalOf(c);
  return [
    { key: "tickets", head: "Tickets", cell: (r) => int(r.tickets), sort: (r) => r.tickets },
    ...(share ? [{ key: "share", head: "Share of the tickets", cell: (r: Row) => pct(t.tickets ? r.tickets / t.tickets : null), sort: (r: Row) => r.tickets }] : []),
    { key: "resolved", head: "Closed with a resolution", tip: "Closed, a resolution set - the open ones and those closed without a resolution are not decided", cell: (r) => int(r.resolved), sort: (r) => r.resolved },
    { key: "ordered", head: "Ended in an order", tip: "Closed as Ordered, a one-shot order or a one-shot C2S order", cell: (r) => <b>{int(r.ordered)}</b>, sort: (r) => r.ordered },
    { key: "rate", head: "Order rate", tip: "Ended in an order, of the tickets closed with a resolution", cell: (r) => pct(rateOf(r)), sort: (r) => rateOf(r) ?? -1 },
    ...(py ? [{ key: "py", head: "Order rate last year", tip: "The same months last year", cell: (r: Row) => <Box component="span" sx={{ color: MUTED }}>{pct(r.pyRate ?? null)}</Box>, sort: (r: Row) => r.pyRate ?? -1 }] : []),
    { key: "value", head: "Ticket value of the orders", tip: "The Sales Potential (€) of the tickets that ended in an order - the ticket's value as the Ticket value app sets it, an estimate", cell: (r) => eur(r.value), sort: (r) => r.value },
    { key: "open", head: "Still open", tip: "Not closed yet - they may still end in an order", cell: (r) => (r.open ? int(r.open) : "—"), sort: (r) => r.open },
    { key: "nores", head: "Closed without a resolution", cell: (r) => (r.nores ? int(r.nores) : "—"), sort: (r) => r.nores },
  ];
}
function DimTable({ c, dim }: { c: TCtx; dim: TDim }) {
  const by = statsOf(c, dim);
  const py = pyOk(c);
  const pyBy = py ? statsOf(c, dim, true) : null;
  const order = ORDER[dim];
  const rows: Row[] = [...by].map(([label, s]) => ({ label, ...s, pyRate: pyBy ? rateOf(pyBy.get(label) ?? blank(1)) : null }));
  const sorted = order ? [...rows].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : rows;
  return <FullTable key={`${dim}-${c.per.id}-${c.team}`} first={DIM[dim].name} cols={cols(c, dim !== "person", py)} initial={dim === "person" ? "ordered" : "tickets"} rows={sorted}
    total={{ label: "Total", ...totalOf(c), pyRate: py ? rateOf(totalOf(c, true)) : null }} natural={!!order}
    selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} find={DIM[dim].one} />;
}
/** Each person's tickets that ended in an order, month by month (as Visits' person x month table). */
function PeopleMonths({ c }: { c: TCtx }) {
  const by = statsOf(c, "person");
  type MRow = { label: string; months: number[]; ordered: number };
  const rows: MRow[] = [...by].map(([label, s]) => ({ label, months: s.monthsOrdered, ordered: s.ordered }));
  const t = totalOf(c);
  const mcols: Col<MRow>[] = [
    ...t.monthsOrdered.map((_, i) => ({ key: `m${i}`, head: MONTHS[c.per.win.from + i], cell: (r: MRow) => (r.months[i] ? int(r.months[i]) : "—"), sort: (r: MRow) => r.months[i] ?? 0 })),
    { key: "ordered", head: perCap(c.per), cell: (r) => <b>{int(r.ordered)}</b>, sort: (r) => r.ordered },
  ];
  return <FullTable key={`pm-${c.per.id}-${c.team}`} first="Person" cols={mcols} initial="ordered" rows={rows} total={{ label: "Total", months: t.monthsOrdered, ordered: t.ordered }} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" />;
}
/** Each person's order rate by kind of ticket: a request, a hand-over and a push end in an order at very different rates,
 *  so a person's rate is read against the same kind of ticket. */
function KindByPerson({ c }: { c: TCtx }) {
  const rows0 = rowsOf(c.d, c.per.win, c.filters, c.people, "kind");
  const by = statsBy(rows0, c.per.win, (r) => `${labelOf(c.d, r, "person")}\u0000${labelOf(c.d, r, "kind")}`);
  const all = statsBy(rows0, c.per.win, (r) => labelOf(c.d, r, "person"));
  const kinds = statsBy(rows0, c.per.win, (r) => labelOf(c.d, r, "kind"));
  const shown = KINDS.filter((k) => (!c.filters.kind?.length || c.filters.kind.includes(k)) && kinds.has(k));
  type KRow = { label: string; of: Record<string, TStats>; all: TStats };
  const rows: KRow[] = [...all].map(([label, s]) => ({ label, all: s, of: Object.fromEntries(shown.map((k) => [k, by.get(`${label}\u0000${k}`) ?? blank(1)])) }));
  const cell = (s: TStats) => (s.resolved ? <span><b>{pct(rateOf(s))}</b> <span style={{ color: FAINT }}>{ofWords(s)}</span></span> : "—");
  const kcols: Col<KRow>[] = [
    ...shown.map((k) => ({ key: k, head: k, tip: `Ended in an order, of the ${k.toLowerCase()} closed with a resolution`, cell: (r: KRow) => cell(r.of[k]), sort: (r: KRow) => (r.of[k].resolved >= MIN_RESOLVED ? rateOf(r.of[k]) ?? -1 : -1) })),
    { key: "all", head: "All kinds", cell: (r) => cell(r.all), sort: (r) => (r.all.resolved >= MIN_RESOLVED ? rateOf(r.all) ?? -1 : -1) },
  ];
  const total: KRow = { label: "Total", all: statsBy(rows0, c.per.win).get("") ?? blank(1), of: Object.fromEntries(shown.map((k) => [k, kinds.get(k) ?? blank(1)])) };
  return <FullTable key={`kp-${c.per.id}-${c.team}`} first="Person" cols={kcols} initial="all" rows={rows} total={total} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" />;
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string, target?: TargetOf) => React.ReactNode;
const draw = (c: TCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c), d.target?.(c))); };

function TabCard({ c, act, footnote }: { c: TCtx; act: Act; footnote: React.ReactNode }) {
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const words = perWords(c.d, c.per);
  if (c.view === "people") return (
    <GlassCard sx={card}>
      <CardTitle icon={<BadgeOutlinedIcon />} tint="green" title={`${teamName(c)}, ${c.per.title}`} note={`${words} · the ESO pipeline's tickets by the month they came in, by who owns them · ordered: closed as Ordered or a one-shot order`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "people:ordered")}{draw(c, act, "people:rate")}</Box>
      <Box sx={TWO}>{draw(c, act, "people:tickets")}{draw(c, act, "people:value")}</Box>
      {c.per.months >= 2 && draw(c, act, "people:months")}
      {c.per.months >= 2 && <Box><SubTitle>Tickets that ended in an order by person, month by month</SubTitle><PeopleMonths c={c} /></Box>}
      <Box><SubTitle>{perCap(c.per)}, by person</SubTitle><DimTable c={c} dim="person" /></Box>
      {footnote}
    </GlassCard>
  );
  if (c.view === "kind") return (
    <GlassCard sx={card}>
      <CardTitle icon={<AltRouteIcon />} tint="purple" title={`${teamName(c)} by kind of ticket, ${c.per.title}`} note={`${DIM.kind.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "kind:ordered")}{draw(c, act, "kind:rate")}</Box>
      <Box><SubTitle>{perCap(c.per)}, by kind of ticket</SubTitle><DimTable c={c} dim="kind" /></Box>
      <Box><SubTitle>Order rate by person and kind of ticket, {c.per.title}</SubTitle><KindByPerson c={c} /></Box>
      <Box><SubTitle>{perCap(c.per)}, by where the ticket came from</SubTitle><DimTable c={c} dim="channel" /></Box>
      {footnote}
    </GlassCard>
  );
  if (c.view === "prio") return (
    <GlassCard sx={card}>
      <CardTitle icon={<FlagOutlinedIcon />} tint="purple" title={`${teamName(c)} by priority and potential, ${c.per.title}`} note={`${DIM.prio.note} · the potential: the company's yearly potential in HubSpot - a placeholder over €1m counts as not set · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "prio:ordered")}{draw(c, act, "prio:rate")}</Box>
      <Box sx={TWO}>{draw(c, act, "prio:ordered-band")}{draw(c, act, "prio:rate-band")}</Box>
      <Box><SubTitle>{perCap(c.per)}, by priority</SubTitle><DimTable c={c} dim="prio" /></Box>
      <Box><SubTitle>{perCap(c.per)}, by potential</SubTitle><DimTable c={c} dim="band" /></Box>
      {footnote}
    </GlassCard>
  );
  const dim = DIM_OF[c.view], dd = DIM[dim];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={dd.icon} tint={dd.tint} title={`${teamName(c)} by ${dd.lower}, ${c.per.title}`} note={`${dd.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, `${c.view}:ordered`)}{draw(c, act, `${c.view}:rate`)}</Box>
      <Box><SubTitle>{perCap(c.per)}, by {dd.lower}</SubTitle><DimTable c={c} dim={dim} /></Box>
      {footnote}
    </GlassCard>
  );
}
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures top right ─────────────────────────────────────────────── */

type Fig = { id: string; label: string; value: string; sub: string; icon: React.ReactNode; tint: Tint; amount: number; unit: "n" | "pct" | "eur" };
function figuresOf(c: TCtx): Fig[] {
  const t = totalOf(c);
  const done = monthsDone(c.d, c.per);
  const py = pyOk(c) ? rateOf(totalOf(c, true)) : null;
  const P = c.per.title;
  return [
    { id: "fig-tickets", label: `Tickets ${P}`, value: int(t.tickets), sub: `${(t.tickets / Math.max(done, 0.1)).toFixed(0)} a month`, icon: <ConfirmationNumberOutlinedIcon />, tint: "amber", amount: t.tickets, unit: "n" },
    { id: "fig-ordered", label: "Ended in an order", value: int(t.ordered), sub: `of ${int(t.resolved)} closed with a resolution`, icon: <ShoppingCartCheckoutOutlinedIcon />, tint: "green", amount: t.ordered, unit: "n" },
    { id: "fig-rate", label: "Order rate", value: pct(rateOf(t)), sub: py != null ? `last year, the same months: ${pct(py)}` : "ordered, of those closed with a resolution", icon: <PercentOutlinedIcon />, tint: "blue", amount: rateOf(t) ?? 0, unit: "pct" },
    { id: "fig-value", label: "Ticket value of the orders", value: eur(t.value), sub: `of the ${int(t.ordered)} tickets ordered - an estimate`, icon: <EuroOutlinedIcon />, tint: "purple", amount: t.value, unit: "eur" },
    { id: "fig-open", label: "Still open", value: int(t.open), sub: `${eur(t.openValue)} ticket value`, icon: <HourglassBottomOutlinedIcon />, tint: "slate", amount: t.open, unit: "n" },
  ];
}
function FigureCards({ c, items, actions }: { c: TCtx; items: Fig[]; actions?: (f: Fig) => React.ReactNode }) {
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
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>This year&apos;s months. Last year&apos;s order rate is shown beside this year&apos;s when each month chosen held {PY_MIN} tickets or more last year - the ESO pipeline began in July {d.year - 1}.</Typography>
    </Box>
  );
}
function TFacet({ c, dim, onPick }: { c: TCtx; dim: TDim; onPick: (l: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const by = statsOf(c, dim);
  const order = ORDER[dim];
  const rows = [...by].map(([label, s]) => ({ label, n: s.tickets }));
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
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${DIM[dim].one}…`} inputProps={{ "aria-label": `Find ${DIM[dim].one} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
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
const FILTER_DIMS: TDim[] = ["person", "kind", "channel", "prio", "band", "category", "country"];
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
      chips={chosen.length ? chosen.map(([d, v]) => <Chip key={`${d}:${v}`} size="small" label={<span><b>{DIM[d].name}:</b> {v}</span>} onDelete={() => toggle(d, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          <FilterSection id="tfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => setShut((s) => ({ ...s, period: isOpen("period") }))} summary={perCap(per)}>
            <TPeriod d={c.d} per={per} onPer={onPer} />
          </FilterSection>
          {FILTER_DIMS.map((dim, i) => (
            <FilterSection key={dim} id={`tfilter-${dim}`} index={i + 1} title={DIM[dim].name} icon={DIM[dim].icon} tint={DIM[dim].tint} open={isOpen(dim)} onFlip={() => setShut((s) => ({ ...s, [dim]: isOpen(dim) }))}
              summary={!c.filters[dim]?.length ? "All" : c.filters[dim]!.length === 1 ? c.filters[dim]![0] : `${c.filters[dim]!.length} chosen`} chosen={!!c.filters[dim]?.length}>
              <TFacet c={c} dim={dim} onPick={(l) => toggle(dim, l)} />
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
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The tickets could not be read: ${error}` : `Reading every ticket of the ESO pipeline in HubSpot${progress ? ` · ${progress}` : ""}…`}</Typography>
      </Box>
    </GlassCard>
  );
}
const ym = (d: TicketsData, m: number) => `${d.year}-${String(m + 1).padStart(2, "0")}`;
const fromYm = (d: TicketsData, x: string | null) => { const m = /^(\d{4})-(\d{2})$/.exec(x ?? ""); return m && Number(m[1]) === d.year ? Number(m[2]) - 1 : null; };
/** What the read left out, in words: "596 not a sales topic, 240 new registrants to qualify…" */
const leftWords = (d: TicketsData) => Object.entries(d.coverage.left).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${int(n)} ${k}`).join(", ");

export function TicketsExplorer() {
  const params = useSearchParams();
  const { d, computing, progress, error } = useTickets();
  const [teamKey, setTeam] = useTeam();
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  const { state: acts } = useActions("eso-tickets");
  const view: TView = isView(params.get("view")) ? (params.get("view") as TView) : "people";
  const setView = (v: TView) => setQuery((q) => { if (v === "people") q.delete("view"); else q.set("view", v); });
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
  if (!d || !c || !per) return (<Box sx={shell}>{back}<Typography component="h1" sx={H1}>Tickets</Typography><Waiting computing={computing} progress={progress} error={error} /></Box>);

  const act: Act = (id, title, target) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-tickets:${id}`, page: "eso-tickets", tab: c.view, title, summary: `${teamName(c)} · ${perWords(d, c.per)}`,
        filters: { ...Object.fromEntries(FILTER_DIMS.filter((k) => c.filters[k]?.length).map((k) => [k, c.filters[k] ?? []])), team: [c.team], ...(c.lead ? { lead: [c.lead] } : {}), ...(c.per.id.startsWith("m") ? { from: [ym(d, c.per.win.from)], to: [ym(d, c.per.win.to)] } : { period: [c.per.id] }) },
        kind: "card", target: target ? { key: targetKey(id, c.team, c.lead, c.per), ...target } : undefined }} />
  );
  const now = { team, lead, teams };
  const chosen = FILTER_DIMS.flatMap((k) => (filters[k] ?? []).map((v) => [k, v] as const));
  const footnote = (
    <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
      The ESO pipeline&apos;s tickets, by the month they came in and by who owns them today. Ended in an order: closed as Ordered, a one-shot order or a one-shot C2S order; the order rate: of the tickets closed with a resolution - the open ones are not decided yet. Rates rank people and groups with {MIN_RESOLVED} tickets closed with a resolution or more.
      {" "}Kinds as on Hand-over to ESO/TSA: customer requests (a website form, the chat, an e-mail, a request the ESO typed in, one redirected from Back Office, the helpline) and lifecycle hand-overs - and here also the pushes and campaigns typed in for the ESO. Left out: {leftWords(d) || "nothing"}.
      {" "}The ticket value: its Sales Potential (€) as the Ticket value app sets it - an estimate, not the order&apos;s amount. ESO: the ESO roster; Total: everyone who owns a ticket of the ESO pipeline. A line manager&apos;s team as Map assignment&apos;s SAE table sets it.
      {" "}{int(d.coverage.kept)} tickets counted, {int(d.coverage.withCompany)} of them with a company. Read from HubSpot {new Date(d.generatedAt).toLocaleString("en-GB")}, every hour.
    </Typography>
  );
  return (
    <Box sx={shell}>
      {back}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>Tickets</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamName(now)}</b> · {per.title} <b style={{ color: INK }}>{perWords(d, per)}</b> · the ESO pipeline&apos;s tickets and how many ended in an order{computing ? " · reading HubSpot again" : ""}
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
        <TTeams team={team} onTeam={setTeam} lead={leadKey} onLead={setLead} teams={teams} />
        {lead && people && people.size === 0 && <NoLeadYet name={teamName(now)} />}
      </Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="eso-tickets" tab={view} onSelect={setView} tabs={VIEWS.map((v) => ({ id: v.id, label: v.label, count: v.id !== "people" && filters[DIM_OF[v.id]]?.length ? String(filters[DIM_OF[v.id]]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-tickets" /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else openOn(DIM_OF[view]); }} variant={panel || chosen.length || per.id !== "ytd" ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-tickets-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length || per.id !== "ytd" ? undefined : "#fff" }}>
          Filters{chosen.length + (per.id !== "ytd" ? 1 : 0) ? ` · ${chosen.length + (per.id !== "ytd" ? 1 : 0)}` : ""}
        </Button>
      </Box>
      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} act={act} footnote={footnote} />
      </Box>
      <TFilterWindow c={c} per={per} open={panel} onClose={() => setPanel(false)} focus={focus} onPer={setPer} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's Tickets panel ──────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
const PANEL = "eso-tickets:panel:";

/** Tickets in the BUC View: the year to date for the team the toggle shows, the months, and the Tickets charts sent here. */
export function TicketsPanel({ acts }: { acts: ActionsState | null }) {
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
  const c = useMemo<TCtx | null>(() => (d ? { d, per: perOf(d, presetsOf(d)[0].win), team: drawn.team, lead: drawn.lead, teams, people: peopleOf(d, drawn.team, drawn.lead, lt?.byId ?? {}), filters: {}, view: "people", targets: acts?.targets } : null),
    [d, drawn, teams, lt, acts?.targets]);
  const items: SortItem[] = useMemo(() => !c ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-tickets" && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const ch = chartOf(spec.key);
    const fmt = formatOf(acts, spec);
    const f = spec.filters ?? {};
    const sf: TFilters = Object.fromEntries(FILTER_DIMS.flatMap((k) => (f[k]?.length ? [[k, f[k]]] : [])));
    const pid = f.period?.[0], pr = pid ? presetsOf(c.d).find((p) => p.id === pid) : null;
    const a0 = fromYm(c.d, f.from?.[0] ?? null), b0 = fromYm(c.d, f.to?.[0] ?? null);
    const sp = pr ? perOf(c.d, pr.win) : a0 != null && b0 != null ? perOf(c.d, { from: a0, to: b0 }) : c.per;
    // every chart here follows the panel's toggle (as the Figures' panel); its filters and period stay as sent
    const sc: TCtx = { ...c, per: sp, filters: sf, view: (spec.tab && isView(spec.tab) ? spec.tab : "people") as TView, half: fmt === "half" };
    const target = ch?.target ? { key: targetKey(ch.id, c.team, c.lead, sp), ...ch.target(sc) } : undefined;
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind, target }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<ConfirmationNumberOutlinedIcon />} tint="amber" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [c, acts]);
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-tickets", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);
  const shown = (id: string) => placementOf(acts, `${PANEL}${id}`, "nutshell") === "nutshell";
  const own = (id: string, title: string, kind: "kpi" | "card", target?: { key: string; unit: "eur" | "pct" | "n"; label: string }) => (
    <TileActions where="nutshell" start="nutshell" edge={2} tile={{ key: `${PANEL}${id}`, page: "eso-tickets", tab: "people", title: `${title} - ${c ? teamName(c) : "ESO"}`, kind,
      filters: { team: [drawn.team], ...(drawn.lead ? { lead: [drawn.lead] } : {}), period: ["ytd"] }, href: `/reporting/eso-benchmark/tickets?team=${drawn.team}${drawn.lead ? `&lead=${drawn.lead}` : ""}`, target }} />
  );
  const months = drawnOf("people:months")!;
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<ConfirmationNumberOutlinedIcon />} tint="amber" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/tickets?team=${team}${lead ? `&lead=${lead}` : ""}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.amber.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Tickets</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.amber.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName({ team, lead, teams })} · year to date ${perWords(c.d, c.per)} · the ESO pipeline's tickets and how many ended in an order` : "The ESO pipeline's tickets and how many ended in an order"}</Typography>
        </Box>
        <TTeams team={team} onTeam={choose} lead={leadKey} onLead={chooseLead} teams={teams} />
      </Box>
      {!c ? <Waiting computing={computing} progress={progress} error={error} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          <FigureCards c={c} items={figs.filter((f) => shown(f.id))} actions={(f) => own(f.id, f.label, "kpi", { key: targetKey(`panel:${f.id}`, c.team, c.lead, c.per), unit: f.unit, label: `${f.label} is measured against it · ${teamName(c)}'s target.` })} />
          {shown("months") && months.draw(c, own("months", "Tickets that ended in an order year to date, month by month", "card", months.target ? { key: targetKey(months.id, c.team, c.lead, c.per), ...months.target(c) } : undefined))}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-tickets"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </Box>
      )}
    </GlassCard>
  );
}

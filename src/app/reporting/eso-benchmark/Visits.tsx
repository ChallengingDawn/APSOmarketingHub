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
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
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
import { POTENTIAL_BANDS, REG_WAY, blank, labelOf, rowsOf, statsBy, type VDim, type VFilters, type VStats, type VWin, type VisitsData } from "@/lib/reporting/visitsRules";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  ChartBox, FullTable, H1, KEPT, KEPT_LEAD, Leaderboard, NoLeadYet, SubTitle, TARGET, TWO, asLead, asTeam, axisWidth, leadOf, niceTop, setQuery, useLead, useLeads, useTeam,
  type BoardRow, type Col, type LeadKey, type TeamKey,
} from "./Figures";

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
/** A person's or a group's rank needs this many visits behind an average or a share - two or six visits said nothing. */
const MIN_VISITS = 10;

/* ── the period: this year's months ────────────────────────────────────── */

type VPer = { win: VWin; id: string; title: string; months: number };
const nowMonth = (d: VisitsData) => Number(d.today.slice(5, 7)) - 1;
const todayDay = (d: VisitsData) => Number(d.today.slice(8, 10));
function presetsOf(d: VisitsData): { id: string; label: string; win: VWin }[] {
  const m = nowMonth(d);
  const out = [{ id: "ytd", label: "Year to date", win: { from: 0, to: m } }, { id: "mtd", label: "Month to date", win: { from: m, to: m } }];
  if (m > 0) out.push({ id: "lm", label: `${MONTHS_FULL[m - 1]} ${d.year}`, win: { from: m - 1, to: m - 1 } });
  for (let q = 0; q < 4; q++) if (q * 3 + 2 < m) out.push({ id: `q${q + 1}`, label: `Q${q + 1} ${d.year}`, win: { from: q * 3, to: q * 3 + 2 } });
  return out;
}
function perOf(d: VisitsData, win: VWin): VPer {
  const p = presetsOf(d).find((x) => x.win.from === win.from && x.win.to === win.to);
  const title = p?.id === "ytd" ? "year to date" : p?.id === "mtd" ? "month to date" : p ? p.label : `${MONTHS[win.from]}–${MONTHS[win.to]} ${d.year}`;
  return { win, id: p?.id ?? `m${win.from}-${win.to}`, title, months: win.to - win.from + 1 };
}
/** "1 Jan – 27 Oct 2026", "Apr–Jun 2026" */
function perWords(d: VisitsData, per: VPer) {
  const run = per.win.to === nowMonth(d);
  if (per.win.from === per.win.to) return run ? `1 – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS_FULL[per.win.from]} ${d.year}`;
  return run ? `1 ${MONTHS[per.win.from]} – ${todayDay(d)} ${MONTHS[per.win.to]} ${d.year}` : `${MONTHS[per.win.from]}–${MONTHS[per.win.to]} ${d.year}`;
}
const perCap = (p: VPer) => p.title.charAt(0).toUpperCase() + p.title.slice(1);
/** the period's last day: "27 Oct 2026" while it runs, "30 Jun 2026" */
const perEnd = (d: VisitsData, per: VPer) => `${per.win.to === nowMonth(d) ? todayDay(d) : new Date(Date.UTC(d.year, per.win.to + 1, 0)).getUTCDate()} ${MONTHS[per.win.to]} ${d.year}`;
/** the months a period spans, the running one as far as it has gone */
const monthsDone = (d: VisitsData, per: VPer) => per.months - (per.win.to === nowMonth(d) ? 1 - todayDay(d) / new Date(Date.UTC(d.year, per.win.to + 1, 0)).getUTCDate() : 0);

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
  { id: "people", label: "People" }, { id: "new", label: "Registration" }, { id: "prio", label: "Priority & potential" },
  { id: "category", label: "Customer category" }, { id: "kind", label: "Type of visit" }, { id: "country", label: "Country" },
];
const isView = (x: string | null): x is VView => VIEWS.some((v) => v.id === x);
const DIM_OF: Record<VView, VDim> = { people: "person", new: "person", prio: "prio", category: "category", kind: "kind", country: "country" };
const DIM: Record<VDim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string }> = {
  person: { name: "Person", lower: "person", icon: <BadgeOutlinedIcon />, tint: "green", note: "Who made the visit - the visit's owner" },
  prio: { name: "Priority", lower: "priority", icon: <FlagOutlinedIcon />, tint: "purple", note: "The visited company's priority: Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500" },
  band: { name: "Potential", lower: "potential", icon: <SavingsOutlinedIcon />, tint: "amber", note: "The visited company's yearly potential in HubSpot, in bands - a placeholder over €1m counts as not set" },
  category: { name: "Customer category", lower: "customer category", icon: <CategoryOutlinedIcon />, tint: "blue", note: "The visited company's APSO customer category - Other: APSOlost, APSOmicro, Growth Engine and not set" },
  kind: { name: "Type of visit", lower: "type of visit", icon: <HandshakeOutlinedIcon />, tint: "slate", note: "Agreed in advance with the customer (a scheduled visit), cold (unannounced), or at an event - as the visit report says" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where the visited company is" },
};
const ORDER: Partial<Record<VDim, readonly string[]>> = { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOgrowth", "APSOprospect", "Other"], kind: ["Agreed", "Cold", "Event", "Not recorded"], band: POTENTIAL_BANDS };

export type VCtx = {
  d: VisitsData; per: VPer; team: TeamKey; lead: string | null; teams: Team[];
  /** the people shown (indexes) */
  people: Set<number>; filters: VFilters; view: VView;
  half?: boolean; targets?: Record<string, number>;
  onBar?: (dim: VDim, label: string) => void; onFilter?: (dim: VDim) => void;
};

const statCache = new WeakMap<VCtx, Map<string, Map<string, VStats>>>();
/** The figures of the period by a breakdown (its own filter left out), or all together - kept per drawing. */
function statsOf(c: VCtx, dim?: VDim): Map<string, VStats> {
  let memo = statCache.get(c);
  if (!memo) { memo = new Map(); statCache.set(c, memo); }
  const k = dim ?? "";
  const hit = memo.get(k);
  if (hit) return hit;
  const rows = rowsOf(c.d, c.per.win, c.filters, c.people, dim);
  const out = statsBy(c.d, rows, c.per.win, dim ? (r) => labelOf(c.d, r, dim) : undefined);
  memo.set(k, out);
  return out;
}
const totalOf = (c: VCtx) => statsOf(c).get("") ?? blank(c.per.months);

/** A chart's target, one per chart, team and period: "eso-visits:people:visits@eso-RABE~q2" (the year to date without "~"). */
const targetKey = (id: string, team: TeamKey, lead: string | null, per: VPer) => `eso-visits:${id}@${team === "eso" ? "eso" : "total"}${team === "eso" && lead ? `-${lead}` : ""}${/:months$/.test(id) || per.id === "ytd" ? "" : `~${per.id}`}`;
const targetFor = (c: VCtx, id: string) => { const t = c.targets?.[targetKey(id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/* ── the leaderboards ──────────────────────────────────────────────────── */

type Measure = "visits" | "companies" | "new" | "registered" | "bought" | "agreed" | "potential" | "need";
const MEASURE: Record<Measure, { title: string; fmt: (n: number) => string; unit: "n" | "pct" | "eur"; target: string }> = {
  visits: { title: "Completed visits", fmt: int, unit: "n", target: "completed visits" },
  companies: { title: "Companies visited", fmt: int, unit: "n", target: "companies visited" },
  new: { title: "Visits with new customers", fmt: int, unit: "n", target: "visits with new customers" },
  registered: { title: "New customers registered after the visit", fmt: int, unit: "n", target: "new customers registered after the visit" },
  bought: { title: "New customers that bought after the visit", fmt: int, unit: "n", target: "new customers that bought after the visit" },
  agreed: { title: "Visits agreed in advance", fmt: (n) => pct(n), unit: "pct", target: "share of visits agreed in advance" },
  potential: { title: "Ø yearly potential of the companies visited", fmt: eur, unit: "eur", target: "Ø yearly potential of the companies visited" },
  need: { title: "Ø annual need from the visit reports", fmt: eur, unit: "eur", target: "Ø annual need from the visit reports" },
};
/** Of the companies visited, the ones with revenue this year and how much - not an average over the prospects as well
 *  (SARCLA 28.10.2026 on "Ø revenue this year €534": "figures are completely wrong"). */
const boughtWords = (s: VStats) => (s.buyers ? `${int(s.buyers)} bought this year · ${eur(s.revenue)}` : "none bought this year");
function boardRows(c: VCtx, dim: VDim, m: Measure): { rows: BoardRow[]; small: BoardRow[] } {
  const by = statsOf(c, dim);
  const t = totalOf(c);
  const done = monthsDone(c.d, c.per);
  const rows: BoardRow[] = [], small: BoardRow[] = [];
  for (const [label, s] of by) {
    let cur: number, sub: string, ranked = true;
    if (m === "visits") { cur = s.visits; sub = dim === "person" ? `${int(s.companies)} companies · ${(s.visits / Math.max(done, 0.1)).toFixed(1)} a month` : `${pct(t.visits ? s.visits / t.visits : null)} of the visits · ${int(s.companies)} companies`; }
    else if (m === "companies") { cur = s.companies; sub = boughtWords(s); }
    else if (m === "new") { cur = s.newVisits; sub = `${int(s.newCompanies)} new customers · ${int(s.registeredAfter)} registered · ${int(s.boughtInPeriod)} bought`; }
    else if (m === "registered") { cur = s.registeredAfter; sub = `${pct(s.newCompanies ? s.registeredAfter / s.newCompanies : null)} of ${int(s.newCompanies)} new customers visited`; }
    else if (m === "bought") { cur = s.boughtInPeriod; sub = `${pct(s.newCompanies ? s.boughtInPeriod / s.newCompanies : null)} of ${int(s.newCompanies)} new customers visited`; }
    else if (m === "agreed") { cur = s.visits ? s.agreed / s.visits : 0; sub = `${int(s.agreed)} agreed in advance · ${int(s.cold)} cold · ${int(s.event)} at events`; ranked = s.visits >= MIN_VISITS; }
    else if (m === "potential") { cur = s.potN ? s.potSum / s.potN : 0; sub = `over ${int(s.potN)} visits to companies with a potential`; ranked = s.potN >= MIN_VISITS; }
    else { cur = s.needN ? s.needSum / s.needN : 0; sub = `over ${int(s.needN)} visit reports that give one`; ranked = s.needN >= MIN_VISITS; }
    if (!cur && m !== "agreed") continue;
    (ranked ? rows : small).push({ label, cur, prev: 0, sub });
  }
  return { rows, small };
}
function Board({ c, id, dim, m, actions }: { c: VCtx; id: string; dim: VDim; m: Measure; actions?: React.ReactNode }) {
  const { rows, small } = boardRows(c, dim, m);
  const M = MEASURE[m];
  return (
    <Leaderboard key={`${id}-${c.per.id}`} title={`${M.title} ${c.per.title}, by ${DIM[dim].lower}`} rows={rows} noChange
      curLabel={perWords(c.d, c.per)} prevLabel="" first={c.half ? 8 : 12} fmt={M.fmt} ratio={m === "agreed"} target={targetFor(c, id)}
      unranked={small.length ? { why: m === "potential" ? `under ${MIN_VISITS} visits to companies with a potential` : m === "need" ? `under ${MIN_VISITS} visit reports with an annual need` : `under ${MIN_VISITS} visits`, rows: small } : undefined}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} actions={actions} />
  );
}

/* ── the months: visits as columns, the target's line across ──────────── */

function VisitMonths({ c, target }: { c: VCtx; target: number | null }) {
  const t = totalOf(c);
  const data = t.months.map((v, i) => ({ x: MONTHS[c.per.win.from + i], v, running: c.per.win.from + i === nowMonth(c.d) }));
  const top = niceTop(Math.max(1, target ?? 0, ...data.map((x) => x.v)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const done = data.filter((x) => !x.running);
  const reached = target ? done.filter((x) => x.v >= target).length : 0;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: THIS }} />Completed visits</Box>
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
              <Box key={x.x} title={`${x.x}${x.running ? " (to date)" : ""}: ${int(x.v)} completed visits${target ? ` · ${pct(x.v / target)} of the target` : ""}`} sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px" }}>
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
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/** Registration, in his four questions (SARCLA 27.10.2026): how many visits with new customers, how many of them registered
 *  after the visit, in what way, how many of them bought in the period - from the shop's registration day and the first
 *  order's day against the visit's (28.10: not the qualification's answers). */
function Answers({ c }: { c: VCtx }) {
  const t = totalOf(c);
  const ways = t.newCompanies ? REG_WAY.map((w) => [w, t.regWays[w] ?? 0] as const) : [];
  const maxWay = Math.max(1, ...ways.map(([, n]) => n));
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
        <Box sx={{ display: "grid", gap: 0.6 }}>
          {ways.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No new customer visited in this period.</Typography>}
          {ways.map(([w, n]) => (
            <Box key={w} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(80px, 1fr) 110px", gap: 1, alignItems: "center" }}>
              <Typography sx={{ fontSize: "0.84rem", color: INK }}>{w}</Typography>
              <Box sx={{ height: 10, borderRadius: 5, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(n / maxWay) * 100}%`, bgcolor: THIS }} /></Box>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{int(n)} <span style={{ color: MUTED, fontWeight: 500 }}>{pct(t.newCompanies ? n / t.newCompanies : null)}</span></Typography>
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ ...row, borderBottom: 0 }}>{q(4, `How many of them bought, ${c.per.title}?`)}{a(int(t.boughtInPeriod), `${pct(t.newCompanies ? t.boughtInPeriod / t.newCompanies : null)} of the ${int(t.newCompanies)} new customers - their first order on the day of the visit or after it, by ${perEnd(c.d, c.per)}`)}</Box>
    </Box>
  );
}

/* ── every chart by its key ────────────────────────────────────────────── */

type TargetOf = { unit: "eur" | "pct" | "n"; label: string };
type Drawn = { id: string; title: (c: VCtx) => string; draw: (c: VCtx, actions?: React.ReactNode) => React.ReactNode; target?: (c: VCtx) => TargetOf };
const teamPart = (c: VCtx) => ` - ${teamName(c)}`;
const forWhom = (c: VCtx) => `${teamName(c)}'s target for ${c.per.title} - each team and period its own`;
/** A chart by its id "<tab>:<what>[-<breakdown>]": people:visits, prio:visits-band, kind:agreed-person, new:answers, people:months… */
function drawnOf(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  if (chart === "months") {
    const title = (c: VCtx) => `Completed visits ${c.per.title}, month by month${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · the running month to date, lighter · each person's months in the table below`} actions={a}><VisitMonths c={c} target={targetFor(c, id)} /></ChartBox>,
      target: (c) => ({ unit: "n", label: `Each month's completed visits are measured against it - a line across the months; the running month is not counted · ${teamName(c)}'s target.` }) };
  }
  if (chart === "answers") {
    const title = (c: VCtx) => `New customers and registration, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} · new customers: companies that had never ordered before the day of the visit; registered: the shop's registration date against the visit's`} actions={a}><Answers c={c} /></ChartBox> };
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
  const old: Record<string, string> = { "people:agreed": "kind:agreed-person", "people:potential": "prio:potential-person", "new:funnel": "new:answers", "new:new": "new:new", "new:bought": "new:bought" };
  const asIs = drawnOf(old[`${view}:${chart}`] ?? `${view}:${chart}`);
  if (asIs) return asIs;
  if (view === "reps") return drawnOf(chart === "potential" ? "prio:potential-person" : chart === "months" ? "people:months" : "people:visits");
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
    ...t.months.map((_, i) => ({ key: `m${i}`, head: MONTHS[c.per.win.from + i], cell: (r: MRow) => (r.months[i] ? int(r.months[i]) : "—"), sort: (r: MRow) => r.months[i] ?? 0 })),
    { key: "visits", head: perCap(c.per), cell: (r) => <b>{int(r.visits)}</b>, sort: (r) => r.visits },
  ];
  return <FullTable key={`pm-${c.per.id}-${c.team}`} first="Person" cols={cols} initial="visits" rows={rows} total={{ label: "Total", months: t.months, visits: t.visits }} selected={c.filters.person} onPick={c.onBar ? (l) => c.onBar!("person", l) : undefined} find="a person" />;
}
function DimTable({ c, dim }: { c: VCtx; dim: VDim }) {
  const by = statsOf(c, dim);
  const t = totalOf(c);
  const order = ORDER[dim];
  const rows: Row[] = [...by].map(([label, s]) => ({ label, ...s }));
  const cols: Col<Row>[] = [
    { key: "visits", head: "Completed visits", cell: (r) => int(r.visits), sort: (r) => r.visits },
    { key: "share", head: "Share of the visits", cell: (r) => pct(t.visits ? r.visits / t.visits : null), sort: (r) => r.visits },
    { key: "companies", head: "Companies visited", cell: (r) => int(r.companies), sort: (r) => r.companies },
    { key: "new", head: "New customers visited", cell: (r) => int(r.newCompanies), sort: (r) => r.newCompanies },
    { key: "bought", head: `Bought, ${c.per.title}`, cell: (r) => int(r.boughtInPeriod), sort: (r) => r.boughtInPeriod },
    ...(dim === "prio" || dim === "band" ? [{ key: "pot", head: "Ø yearly potential", tip: "Of the visited companies with one (placeholders over €1m left out)", cell: (r: Row) => (r.potN ? eur(r.potSum / r.potN) : "—"), sort: (r: Row) => (r.potN ? r.potSum / r.potN : -1) }] : []),
    ...(dim === "kind" ? [] : [{ key: "agreed", head: "Agreed in advance", cell: (r: Row) => (r.visits ? pct(r.agreed / r.visits) : "—"), sort: (r: Row) => (r.visits ? r.agreed / r.visits : -1) }]),
  ];
  const sorted = order ? [...rows].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : rows;
  return <FullTable key={`${dim}-${c.per.id}-${c.team}`} first={DIM[dim].name} cols={cols} initial="visits" rows={sorted} total={{ label: "Total", ...t }} natural={!!order}
    selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} find={`a ${DIM[dim].lower}`} />;
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string, target?: TargetOf) => React.ReactNode;
const draw = (c: VCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c), d.target?.(c))); };

function TabCard({ c, act, footnote }: { c: VCtx; act: Act; footnote: React.ReactNode }) {
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const words = perWords(c.d, c.per);
  if (c.view === "people") return (
    <GlassCard sx={card}>
      <CardTitle icon={<BadgeOutlinedIcon />} tint="green" title={`${teamName(c)}, ${c.per.title}`} note={`${words} · completed visit reports only, by meeting date, by who made the visit`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "people:visits")}{draw(c, act, "people:companies")}</Box>
      {c.per.months >= 2 && draw(c, act, "people:months")}
      {c.per.months >= 2 && <Box><SubTitle>Completed visits by person, month by month</SubTitle><PeopleMonths c={c} /></Box>}
      <Box><SubTitle>{perCap(c.per)}, by person</SubTitle><PeopleTable c={c} /></Box>
      {footnote}
    </GlassCard>
  );
  if (c.view === "new") return (
    <GlassCard sx={card}>
      <CardTitle icon={<HowToRegOutlinedIcon />} tint="amber" title={`${teamName(c)}: registration, ${c.per.title}`} note={`${words} · new customers visited - did they register, how, and did they buy`} />
      <Box sx={{ mt: -1 }}>{draw(c, act, "new:answers")}</Box>
      <Box sx={TWO}>{draw(c, act, "new:new")}{draw(c, act, "new:registered")}</Box>
      {draw(c, act, "new:bought")}
      {footnote}
    </GlassCard>
  );
  if (c.view === "prio") return (
    <GlassCard sx={card}>
      <CardTitle icon={<FlagOutlinedIcon />} tint="purple" title={`${teamName(c)} by priority and potential, ${c.per.title}`} note={`${DIM.prio.note} · the potential: the company's yearly potential in HubSpot - a placeholder over €1m counts as not set · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "prio:visits")}{draw(c, act, "prio:visits-band")}</Box>
      <Box sx={TWO}>{draw(c, act, "prio:potential-person")}{draw(c, act, "prio:need-person")}</Box>
      <Box><SubTitle>{perCap(c.per)}, by priority</SubTitle><DimTable c={c} dim="prio" /></Box>
      <Box><SubTitle>{perCap(c.per)}, by potential</SubTitle><DimTable c={c} dim="band" /></Box>
      {footnote}
    </GlassCard>
  );
  if (c.view === "kind") return (
    <GlassCard sx={card}>
      <CardTitle icon={<HandshakeOutlinedIcon />} tint="slate" title={`${teamName(c)} by type of visit, ${c.per.title}`} note={`${DIM.kind.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "kind:visits")}{draw(c, act, "kind:agreed-person")}</Box>
      <Box><SubTitle>{perCap(c.per)}, by type of visit</SubTitle><DimTable c={c} dim="kind" /></Box>
      {footnote}
    </GlassCard>
  );
  const dim = DIM_OF[c.view], dd = DIM[dim];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={dd.icon} tint={dd.tint} title={`${teamName(c)} by ${dd.lower}, ${c.per.title}`} note={`${dd.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, `${c.view}:visits`)}{draw(c, act, `${c.view}:companies`)}</Box>
      <Box sx={TWO}>{draw(c, act, `${c.view}:new`)}{draw(c, act, `${c.view}:bought`)}</Box>
      <Box><SubTitle>{perCap(c.per)}, by {dd.lower}</SubTitle><DimTable c={c} dim={dim} /></Box>
      {footnote}
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
    { id: "fig-agreed", label: "Agreed in advance", value: pct(t.visits ? t.agreed / t.visits : null), sub: `${int(t.agreed)} agreed · ${int(t.cold)} cold · ${int(t.event)} at events`, icon: <HandshakeOutlinedIcon />, tint: "slate", amount: t.visits ? t.agreed / t.visits : 0, unit: "pct" },
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

function VPeriod({ d, per, onPer }: { d: VisitsData; per: VPer; onPer: (w: VWin) => void }) {
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
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>This year&apos;s months: HubSpot holds visits since 2026, so there is no year before to compare with.</Typography>
    </Box>
  );
}
function VFacet({ c, dim, onPick }: { c: VCtx; dim: VDim; onPick: (l: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const by = statsOf(c, dim);
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
const FILTER_DIMS: VDim[] = ["person", "prio", "band", "category", "kind", "country"];
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
  const setPer = (w: VWin) => setQuery((q) => { if (!d) return; const ytd = presetsOf(d)[0].win; if (w.from === ytd.from && w.to === ytd.to) { q.delete("from"); q.delete("to"); } else { q.set("from", ym(d, w.from)); q.set("to", ym(d, w.to)); } });

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
        filters: { ...Object.fromEntries(FILTER_DIMS.filter((k) => c.filters[k]?.length).map((k) => [k, c.filters[k] ?? []])), team: [c.team], ...(c.lead ? { lead: [c.lead] } : {}), ...(c.per.id.startsWith("m") ? { from: [ym(d, c.per.win.from)], to: [ym(d, c.per.win.to)] } : { period: [c.per.id] }) },
        kind: "card", target: target ? { key: targetKey(id, c.team, c.lead, c.per), ...target } : undefined }} />
  );
  const now = { team, lead, teams };
  const chosen = FILTER_DIMS.flatMap((k) => (filters[k] ?? []).map((v) => [k, v] as const));
  const footnote = (
    <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
      Completed visit reports only (the stage &quot;Visit and Report complete&quot;), by meeting date and by who made the visit; this year&apos;s others are counted as not reported yet. HubSpot holds visits since 2026: there is no year before to compare with.
      {" "}ESO: the ESO roster; Total: ESO, Marc Frech (the TSA person who visits) and the people outside the rosters. A line manager&apos;s team as Map assignment&apos;s SAE table sets it.
      {" "}New customers: companies that had never ordered before the day of the visit; registered: the day the shop says the company registered (Magento &quot;customer since&quot;) against the visit&apos;s - not the qualification&apos;s answers; bought: their first order on the day of the visit or after it, by the end of the period. The potential: the company&apos;s yearly potential in HubSpot, a placeholder over €1m left out; averages and shares rank people with {MIN_VISITS} visits or more.
      {" "}{int(d.coverage.completed)} completed visits read, {int(d.coverage.withCompany)} of them linked to a company. Read from HubSpot {new Date(d.generatedAt).toLocaleString("en-GB")}, every hour.
    </Typography>
  );
  return (
    <Box sx={shell}>
      {back}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>Visits</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamName(now)}</b> · {per.title} <b style={{ color: INK }}>{perWords(d, per)}</b> · completed visit reports{computing ? " · reading HubSpot again" : ""}
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
      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} act={act} footnote={footnote} />
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
    const a0 = fromYm(c.d, f.from?.[0] ?? null), b0 = fromYm(c.d, f.to?.[0] ?? null);
    const sp = pr ? perOf(c.d, pr.win) : a0 != null && b0 != null ? perOf(c.d, { from: a0, to: b0 }) : c.per;
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

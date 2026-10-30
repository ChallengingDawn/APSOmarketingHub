"use client";
// THE ESO CUSTOMER DEVELOPMENT PAGE, rebuilt like Visits (SARCLA 29.10.2026: "work on ESO Reports -> customer development"
// - his picks: rebuild like Visits; the customers by their Performis SAE, as the Figures split revenue; Ø orders from
// HubSpot's orders; lost = no order for 12 to 24 months, as Retain & grow's "stopped"). What the old page did: the company
// owner, ESO only, the complete months only, no Ø revenue or Ø orders per status though the CrystalESO deck asks for both,
// lost = bought last calendar year and nothing this year (right for the year to date only), paired bars, no targets.
// Second pass, the same evening: "show all, don't hide the not ranked" (everyone on the list); "be more specific" on the
// churn (the months named); the footnote out; "these are not separated graphs, they should" (every tab its own boards);
// the potential out; every company with a priority; the real customer categories ("other" out); APIC beside the customer
// type; lost = no order for 12 months or more, however long ago, in every figure. The rows and their rules:
// src/lib/reporting/customerDevRules.ts.

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
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import FactoryOutlinedIcon from "@mui/icons-material/FactoryOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
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
import {
  CY0, PRIOS, blank, churn, labelOf, namedOf, rowsOf, statsBy, type CDim, type CFilters, type CStats, type CWin, type CustDevData,
} from "@/lib/reporting/customerDevRules";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  ChartBox, FullTable, H1, KEPT, KEPT_LEAD, Leaderboard, NoLeadYet, SubTitle, TARGET, TEAM_OF, TWO, Teams, asLead, asTeam, leadOf, niceTop, setQuery, teamWord,
  useLead, useLeads, useTeam, type BoardRow, type Col, type LeadKey, type TeamKey,
} from "./Figures";

/* ── the read ──────────────────────────────────────────────────────────── */

function useCustDev(): { d: CustDevData | null; computing: boolean; progress?: string; error?: string } {
  const [st, setSt] = useState<{ state?: SlowState<CustDevData>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-customers").then((r) => r.json())
      .then((j: { state?: SlowState<CustDevData>; error?: string }) => {
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
const dec1 = (n: number) => n.toFixed(1);
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±");
const signedInt = (n: number) => `${sign(Math.round(n))}${Math.abs(Math.round(n)).toLocaleString("en")}`;
const signedDec = (n: number) => `${sign(n)}${Math.abs(n).toFixed(1)}`;
const signedEur = (n: number) => `${sign(Math.round(n))}€${Math.abs(Math.round(n)).toLocaleString("en")}`;
const avg = (a: number, n: number) => (n > 0 ? a / n : 0);
/** A change in its colour - green when it went the good way (for the lost, down is good). */
function changeOf(cur: number, prev: number, lower = false): { text: string; color: string } {
  if (!prev) return cur > 0 ? { text: "new", color: lower ? RED : GREEN } : { text: "—", color: FAINT };
  const x = (cur - prev) / Math.abs(prev);
  const good = lower ? x < 0 : x > 0;
  return { text: `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x * 100).toFixed(1)}%`, color: Math.abs(x) < 0.0005 ? FAINT : good ? GREEN : RED };
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Every row on the list (SARCLA 29.10.2026: "show all, don't hide the not ranked - put them on the list"). */
const ALL = 9999;

/* ── the period: this year's months, against the same months a year earlier ─ */

type CPer = { win: CWin; id: string; title: string; months: number };
/** The last month the revenue reaches: the month in progress, else the last complete one. */
const lastOf = (d: CustDevData) => (d.running ? d.running.month - CY0 : Math.max(0, d.loaded - 1));
const runOf = (d: CustDevData) => (d.running ? d.running.month - CY0 : -1);
function presetsOf(d: CustDevData): { id: string; label: string; win: CWin }[] {
  const m = lastOf(d), run = runOf(d) === m;
  const out = [{ id: "ytd", label: "Year to date", win: { from: 0, to: m } }, { id: "mtd", label: run ? "Month to date" : `${MONTHS_FULL[m]} ${d.year}`, win: { from: m, to: m } }];
  if (m > 0) out.push({ id: "lm", label: `${MONTHS_FULL[m - 1]} ${d.year}`, win: { from: m - 1, to: m - 1 } });
  for (let q = 0; q < 4; q++) if (q * 3 + 2 < m || (!run && q * 3 + 2 === m)) out.push({ id: `q${q + 1}`, label: `Q${q + 1} ${d.year}`, win: { from: q * 3, to: q * 3 + 2 } });
  return out;
}
function perOf(d: CustDevData, win: CWin): CPer {
  const p = presetsOf(d).find((x) => x.win.from === win.from && x.win.to === win.to);
  const title = p?.id === "ytd" ? "year to date" : p?.id === "mtd" && runOf(d) === win.to ? "month to date" : p ? p.label : `${MONTHS[win.from]}–${MONTHS[win.to]} ${d.year}`;
  return { win, id: p?.id ?? `m${win.from}-${win.to}`, title, months: win.to - win.from + 1 };
}
/** "1 Jan – 28 Oct 2026", "Apr–Jun 2026"; a year earlier with py */
function perWords(d: CustDevData, per: CPer, py = false) {
  const y = d.year - (py ? 1 : 0);
  const run = per.win.to === runOf(d) && d.running ? d.running.day : null;
  if (per.win.from === per.win.to) return run ? `1 – ${run} ${MONTHS[per.win.to]} ${y}` : `${MONTHS_FULL[per.win.from]} ${y}`;
  return run ? `1 ${MONTHS[per.win.from]} – ${run} ${MONTHS[per.win.to]} ${y}` : `${MONTHS[per.win.from]}–${MONTHS[per.win.to]} ${y}`;
}
const perCap = (p: CPer) => p.title.charAt(0).toUpperCase() + p.title.slice(1);
const ym = (d: CustDevData, m: number) => `${d.year}-${String(m + 1).padStart(2, "0")}`;
const fromYm = (d: CustDevData, x: string | null) => { const m = /^(\d{4})-(\d{2})$/.exec(x ?? ""); return m && Number(m[1]) === d.year ? Number(m[2]) - 1 : null; };
/** "Oct 2025" - a month number of the read (0 = January three years before) */
const monthWords = (d: CustDevData, k: number) => `${MONTHS[k % 12]} ${d.year - 3 + Math.floor(k / 12)}`;
/** the period's last day: "28 Oct 2026" while it runs, "30 Jun 2026" */
const perEnd = (d: CustDevData, per: CPer) => `${per.win.to === runOf(d) && d.running ? d.running.day : new Date(Date.UTC(d.year, per.win.to + 1, 0)).getUTCDate()} ${MONTHS[per.win.to]} ${d.year}`;
/** The churn rate's months, named (SARCLA: "be more specific"): who bought "Nov 2024 – Oct 2025", nothing "since" */
const baseWords = (d: CustDevData, per: CPer) => `${monthWords(d, CY0 + per.win.to - 23)} – ${monthWords(d, CY0 + per.win.to - 12)}`;
const sinceWords = (d: CustDevData, per: CPer) => `${monthWords(d, CY0 + per.win.to - 11)} – ${perEnd(d, per)}`;

/* ── the teams: ESO | TSA | Total by the Performis SAE's people, as the Figures ── */

/** The people shown (indexes): a team's SAE people - under ESO, a line manager's team only; null for Total. */
const peopleOf = (d: CustDevData, team: TeamKey, lead: string | null, byName: Record<string, string>) => (team === "total" ? null
  : new Set(d.people.flatMap((p, i) => (p.team === TEAM_OF[team] && (team !== "eso" || !lead || byName[p.name] === lead) ? [i] : []))));
const teamName = (c: { team: TeamKey; lead: string | null; teams: Team[] }) => (c.team === "eso" && c.lead ? c.teams.find((t) => t.id === c.lead)?.name ?? c.lead : teamWord(c.team));

/* ── what every chart is drawn with ────────────────────────────────────── */

type CView = "people" | "status" | "prio" | "category" | "type" | "apic" | "country";
const VIEWS: { id: CView; label: string }[] = [
  { id: "people", label: "Performis SAE" }, { id: "status", label: "Where they stand" }, { id: "prio", label: "Priority" },
  { id: "category", label: "Customer category" }, { id: "type", label: "Customer type" }, { id: "apic", label: "APIC" }, { id: "country", label: "Country" },
];
const isView = (x: string | null): x is CView => VIEWS.some((v) => v.id === x);
const DIM_OF: Record<CView, CDim> = { people: "person", status: "person", prio: "prio", category: "category", type: "type", apic: "apic", country: "country" };
const DIM: Record<CDim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string }> = {
  person: { name: "Performis SAE", lower: "Performis SAE", icon: <BadgeOutlinedIcon />, tint: "green", note: "The customer's Performis SAE as its person (Map assignment's SAE table), as the Figures split revenue" },
  prio: { name: "Priority", lower: "priority", icon: <StarOutlineIcon />, tint: "purple", note: "The customer's sales priority: Prio 1 above €25,000, Prio 2 €2,500-25,000, Prio 3 €500-2,500 - one Smart Segmentation has not set yet worked out by its rule" },
  category: { name: "Customer category", lower: "customer category", icon: <CategoryOutlinedIcon />, tint: "blue", note: "The customer's APSO customer category as HubSpot has it" },
  type: { name: "Customer type", lower: "customer type", icon: <FlagOutlinedIcon />, tint: "pink", note: "OEM, MRO, C2S workshop… as HubSpot has the company" },
  apic: { name: "APIC", lower: "APIC", icon: <FactoryOutlinedIcon />, tint: "amber", note: "The customer's APIC industry code - 1.x OEM industries, down to the sub-industry" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where the customer is" },
};
const ORDER: Partial<Record<CDim, readonly string[]>> = { prio: PRIOS, category: ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "APSOlost", "Growth Engine Customer", "Not set"] };
/** A breakdown's own order (priorities, categories) - values it does not name after them, by size. */
const ranked = (dim: CDim) => { const o = ORDER[dim]; return o ? (l: string) => { const i = o.indexOf(l); return i < 0 ? 999 : i; } : null; };

export type CCtx = {
  d: CustDevData; per: CPer; team: TeamKey; lead: string | null; teams: Team[];
  /** the people shown (indexes), null for everyone */
  people: Set<number> | null; filters: CFilters; view: CView;
  half?: boolean; targets?: Record<string, number>;
  onBar?: (dim: CDim, label: string) => void; onFilter?: (dim: CDim) => void;
};

const statCache = new WeakMap<CCtx, Map<string, Map<string, CStats>>>();
/** The figures of the period by a breakdown, or all together - only what is filtered (SARCLA 29.10.2026 on Visits: "the
 *  filter goes but they still keep on top"); `own` leaves the breakdown's own filter out, for the Filters window's lists. */
function statsOf(c: CCtx, dim?: CDim, own = false): Map<string, CStats> {
  let memo = statCache.get(c);
  if (!memo) { memo = new Map(); statCache.set(c, memo); }
  const k = `${dim ?? ""}${own ? ":all" : ""}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const out = statsBy(c.d, rowsOf(c.d, c.filters, c.people, own ? dim : undefined), c.per.win, dim ? (r) => labelOf(c.d, r, dim) : undefined);
  memo.set(k, out);
  return out;
}
const totalOf = (c: CCtx) => statsOf(c).get("") ?? blank(c.per.months);

/** A chart's target, one per chart, team and period: "eso-customers:people:active@eso-RABE~q2" (the year to date without "~"). */
const targetKey = (id: string, team: TeamKey, lead: string | null, per: CPer) => `eso-customers:${id}@${team}${team === "eso" && lead ? `-${lead}` : ""}${/:months$/.test(id) || per.id === "ytd" ? "" : `~${per.id}`}`;
const targetFor = (c: CCtx, id: string) => { const t = c.targets?.[targetKey(id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/* ── the leaderboards ──────────────────────────────────────────────────── */

type Measure = "active" | "new" | "react" | "slow" | "lost" | "churn" | "avgrev" | "avgord";
const MEASURE: Record<Measure, { title: string; fmt: (n: number) => string; diff: (n: number) => string; unit: "n" | "pct" | "eur"; target: string; lower?: boolean; ratio?: boolean }> = {
  active: { title: "Active customers", fmt: int, diff: signedInt, unit: "n", target: "active customers" },
  new: { title: "New customers", fmt: int, diff: signedInt, unit: "n", target: "new customers" },
  react: { title: "Reactivated customers", fmt: int, diff: signedInt, unit: "n", target: "reactivated customers" },
  slow: { title: "Slowing customers", fmt: int, diff: signedInt, unit: "n", target: "slowing customers", lower: true },
  lost: { title: "Lost customers", fmt: int, diff: signedInt, unit: "n", target: "lost customers", lower: true },
  churn: { title: "Churn rate", fmt: (n) => pct(n), diff: signedDec, unit: "pct", target: "churn rate", lower: true, ratio: true },
  avgrev: { title: "Ø revenue per active customer", fmt: eur, diff: signedEur, unit: "eur", target: "Ø revenue per active customer" },
  avgord: { title: "Ø orders per active customer", fmt: dec1, diff: signedDec, unit: "n", target: "Ø orders per active customer" },
};
/** "Lost customers - no order for 12 months or more": the lost one's title names its rule wherever it stands. */
const measureTitle = (m: Measure) => (m === "lost" ? "Lost customers - no order for 12 months or more" : MEASURE[m].title);
function boardRows(c: CCtx, dim: CDim, m: Measure): BoardRow[] {
  const rows: BoardRow[] = [];
  for (const [label, s] of statsOf(c, dim)) {
    let cur: number, prev: number, sub: string;
    if (m === "active") { cur = s.active.cy; prev = s.active.py; sub = `Ø ${eur(avg(s.active.rev, s.active.cy))} · Ø ${dec1(avg(s.active.ord, s.active.cy))} orders`; }
    else if (m === "new") { cur = s.new.cy; prev = s.new.py; sub = `${eur(s.new.rev)} revenue · ${int(s.new.ord)} orders`; }
    else if (m === "react") { cur = s.react.cy; prev = s.react.py; sub = `${eur(s.react.rev)} revenue · ${int(s.react.ord)} orders`; }
    else if (m === "slow") { cur = s.slow.cy; prev = s.slow.py; sub = `${eur(s.slow.rev)} now · ${eur(s.slow.revPy)} a year earlier`; }
    else if (m === "lost") { cur = s.lost.cy; prev = s.lost.py; sub = `${int(s.churned.cy)} of them still bought ${baseWords(c.d, c.per)}`; }
    else if (m === "churn") { const r = churn(s); cur = r.cy ?? 0; prev = r.py ?? 0; sub = `${int(s.churned.cy)} of the ${int(s.base.cy)} who bought ${baseWords(c.d, c.per)} did not order since`; if (!s.base.cy) continue; }
    else if (m === "avgrev") { cur = avg(s.active.rev, s.active.cy); prev = avg(s.active.revPy, s.active.py); sub = `${int(s.active.cy)} active customers`; }
    else { cur = avg(s.active.ord, s.active.cy); prev = avg(s.active.ordPy, s.active.py); sub = `${int(s.active.ord)} orders · ${int(s.active.cy)} active customers`; }
    if (!cur && !prev && m !== "churn") continue;
    rows.push({ label, cur, prev, sub });
  }
  return rows;
}
function Board({ c, id, dim, m, actions }: { c: CCtx; id: string; dim: CDim; m: Measure; actions?: React.ReactNode }) {
  const M = MEASURE[m];
  return (
    <Leaderboard key={`${id}-${c.per.id}`} title={`${measureTitle(m)}, ${c.per.title}, by ${DIM[dim].lower}`} rows={boardRows(c, dim, m)}
      curLabel={perWords(c.d, c.per)} prevLabel={perWords(c.d, c.per, true)} first={ALL} fmt={M.fmt} diff={M.diff} lowerIsBetter={M.lower} ratio={M.ratio}
      target={targetFor(c, id)}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} actions={actions} />
  );
}

/* ── where they stand: the deck's questions in one table ───────────────── */

type SRow = { label: string; note: string; cy: number; py: number; lower?: boolean; avgRev: number | null; avgRevPy: number | null; avgOrd: number | null; avgOrdPy: number | null };
function statusRows(t: CStats): SRow[] {
  const f = (label: string, note: string, x: CStats["active"], lower = false): SRow => ({
    label, note, cy: x.cy, py: x.py, lower, avgRev: avg(x.rev, x.cy), avgRevPy: avg(x.revPy, x.py), avgOrd: avg(x.ord, x.cy), avgOrdPy: avg(x.ordPy, x.py),
  });
  return [
    f("Active", "bought in the period", t.active),
    f("New", "first order ever in the period", t.new),
    f("Reactivated", "bought again after 12 months or more without", t.react),
    f("Slowing", "bought less than half of the same months a year earlier", t.slow, true),
    { label: "Lost", note: "no order for 12 months or more at the period's end, however long ago the last one", cy: t.lost.cy, py: t.lost.py, lower: true, avgRev: null, avgRevPy: null, avgOrd: null, avgOrdPy: null },
  ];
}
const withChange = (text: string, cur: number, prev: number, lower = false) => {
  const ch = changeOf(cur, prev, lower);
  return (
    <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
      {text}
      <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: ch.color }}>{ch.text}</Box>
    </Box>
  );
};
function StatusTable({ c }: { c: CCtx }) {
  const t = totalOf(c);
  const rows = statusRows(t);
  const r = churn(t);
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <FullTable key={`status-${c.per.id}-${c.team}`} first="Customers" natural rows={rows} cols={[
        { key: "cy", head: perCap(c.per), cell: (x) => withChange(int(x.cy), x.cy, x.py, x.lower), sort: (x) => x.cy },
        { key: "py", head: "The same months last year", tip: "Last year's month matching the one in progress counts pro rata", cell: (x) => int(x.py), sort: (x) => x.py },
        { key: "diff", head: "Change", cell: (x) => <span style={{ color: changeOf(x.cy, x.py, x.lower).color, fontWeight: 700 }}>{signedInt(x.cy - x.py)}</span>, sort: (x) => x.cy - x.py },
        { key: "rev", head: "Ø revenue per customer", tip: "Their revenue in the period, per customer", cell: (x) => (x.avgRev == null ? "—" : withChange(eur(x.avgRev), x.avgRev, x.avgRevPy ?? 0)), sort: (x) => x.avgRev ?? -1 },
        { key: "revPy", head: "A year earlier", cell: (x) => (x.avgRevPy == null ? "—" : eur(x.avgRevPy)), sort: (x) => x.avgRevPy ?? -1 },
        { key: "ord", head: "Ø orders per customer", tip: "HubSpot's orders in the period, per customer - credit notes and cancelled orders left out", cell: (x) => (x.avgOrd == null ? "—" : withChange(dec1(x.avgOrd), x.avgOrd, x.avgOrdPy ?? 0)), sort: (x) => x.avgOrd ?? -1 },
        { key: "ordPy", head: "A year earlier", cell: (x) => (x.avgOrdPy == null ? "—" : dec1(x.avgOrdPy)), sort: (x) => x.avgOrdPy ?? -1 },
      ]} />
      <Box sx={{ display: "grid", gap: 0.4, px: 0.5 }}>
        {rows.map((x) => <Typography key={x.label} sx={{ fontSize: "0.76rem", color: MUTED }}><b style={{ color: INK }}>{x.label}:</b> {x.note}</Typography>)}
        <Typography sx={{ fontSize: "0.82rem", color: INK, mt: 0.5 }}>
          <b>Churn rate {pct(r.cy)}</b> <span style={{ color: MUTED }}>- of the {int(t.base.cy)} customers who bought {baseWords(c.d, c.per)}, {int(t.churned.cy)} did not order {sinceWords(c.d, c.per)} · a year earlier {pct(r.py)}</span>
          {r.cy != null && r.py != null && <span style={{ color: r.cy <= r.py ? GREEN : RED, fontWeight: 700 }}> · {signedDec((r.cy - r.py) * 100)} pts</span>}
        </Typography>
      </Box>
    </Box>
  );
}

/* ── the months: customers who bought, last year's same month as a tick ── */

function CustMonths({ c, target }: { c: CCtx; target: number | null }) {
  const t = totalOf(c);
  const data = t.months.cy.map((v, i) => ({ x: MONTHS[c.per.win.from + i], v, py: t.months.py[i] ?? 0, running: c.per.win.from + i === runOf(c.d) }));
  const top = niceTop(Math.max(1, target ?? 0, ...data.map((x) => Math.max(x.v, x.py))));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const done = data.filter((x) => !x.running);
  const reached = target ? done.filter((x) => x.v >= target).length : 0;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: THIS }} />Customers who bought, {c.d.year}</Box>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 14, borderTop: `2px solid ${INK}` }} />The same month, {c.d.year - 1}</Box>
        {target && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: INK, fontWeight: 600 }}><Box component="span" sx={{ width: 14, borderTop: `2px dashed ${TARGET}` }} />Target {int(target)} a month · <span style={{ color: reached === done.length ? GREEN : RED }}>{reached} of {done.length} months reached it</span></Box>}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: 40 }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{int(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 160, maxHeight: 340 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          {target != null && <Box sx={{ position: "absolute", left: 0, right: 0, bottom: `${(target / top) * 100}%`, borderTop: `2px dashed ${TARGET}`, zIndex: 1, pointerEvents: "none" }} />}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((x) => (
              <Box key={x.x} title={`${x.x}${x.running ? " (to date)" : ""}: ${int(x.v)} customers bought · ${c.d.year - 1}: ${int(x.py)}${x.running ? " (pro rata)" : ""}${target ? ` · ${pct(x.v / target)} of the target` : ""}`}
                sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px" }}>
                <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(x.v / top) * 100}%`, bgcolor: THIS, opacity: x.running ? 0.55 : 1, borderRadius: "4px 4px 0 0" }} />
                <Box sx={{ position: "absolute", bottom: `${(x.py / top) * 100}%`, left: "50%", transform: "translateX(-50%)", width: "64%", maxWidth: 38, borderTop: `2px solid ${INK}`, zIndex: 1 }} />
              </Box>
            ))}
          </Box>
        </Box>
        <Box />
        <Box sx={{ display: "flex" }}>
          {data.map((x) => {
            const ch = changeOf(x.v, x.py);
            return (
              <Box key={x.x} sx={{ flex: 1, textAlign: "center", pt: 0.5, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3 }}>{x.x}</Typography>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{int(x.v)}</Typography>
                <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: ch.color, lineHeight: 1.3 }}>{ch.text}</Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

/* ── the customers to call: the lost and the slowing by name ───────────── */

/** "Mar 2025", or the day of an older last order "14 Jun 2019" */
const lastWords = (d: CustDevData, r: { last: number | null; lastDay: number }) => {
  if (r.last != null) return monthWords(d, r.last);
  if (!r.lastDay) return "—";
  const y = Math.floor(r.lastDay / 10000), m = Math.floor(r.lastDay / 100) % 100, day = r.lastDay % 100;
  return `${day} ${MONTHS[m - 1]} ${y}`;
};

type NRow = { label: string; person: string; country: string; rev: number; revPy: number; last: number | null; lastDay: number };
function NamedTable({ c, status }: { c: CCtx; status: "lost" | "slow" }) {
  const list = useMemo(() => namedOf(c.d, rowsOf(c.d, c.filters, c.people), c.per.win, status), [c, status]);
  // a name twice (two companies alike) keeps both rows apart
  const seen = new Map<string, number>();
  const rows: NRow[] = list.map((x) => {
    const n = (seen.get(x.name) ?? 0) + 1;
    seen.set(x.name, n);
    return { label: n > 1 ? `${x.name} (${c.d.ids[x.i]})` : x.name, person: x.person, country: x.country, rev: x.rev, revPy: x.revPy, last: x.last, lastDay: x.lastDay };
  });
  const cols: Col<NRow>[] = status === "lost" ? [
    { key: "person", head: "Performis SAE", cell: (r) => r.person },
    { key: "country", head: "Country", cell: (r) => r.country },
    { key: "last", head: "Last order", tip: "Their last purchase up to the period's end", cell: (r) => lastWords(c.d, r), sort: (r) => (r.last != null ? 100_000_000 + r.last : r.lastDay) },
    { key: "rev", head: "Bought in the 12 months up to it", tip: `Their revenue in the 12 months up to their last purchase - read since January ${c.d.year - 3}`, cell: (r) => (r.last == null ? "—" : eur(r.rev)), sort: (r) => r.rev },
  ] : [
    { key: "person", head: "Performis SAE", cell: (r) => r.person },
    { key: "country", head: "Country", cell: (r) => r.country },
    { key: "rev", head: perCap(c.per), cell: (r) => eur(r.rev), sort: (r) => r.rev },
    { key: "revPy", head: "The same months last year", cell: (r) => eur(r.revPy), sort: (r) => r.revPy },
    { key: "diff", head: "Less by", cell: (r) => <span style={{ color: RED, fontWeight: 700 }}>{signedEur(r.rev - r.revPy)}</span>, sort: (r) => r.revPy - r.rev },
  ];
  if (!rows.length) return <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>None under these filters.</Typography>;
  return <FullTable key={`${status}-${c.per.id}-${c.team}`} first="Customer" cols={cols} rows={rows} initial={status === "lost" ? "rev" : "diff"} find="a customer" />;
}

/* ── every chart by its key ────────────────────────────────────────────── */

type TargetOf = { unit: "eur" | "pct" | "n"; label: string };
type Drawn = { id: string; title: (c: CCtx) => string; draw: (c: CCtx, actions?: React.ReactNode) => React.ReactNode; target?: (c: CCtx) => TargetOf };
const teamPart = (c: CCtx) => ` - ${teamName(c)}`;
const forWhom = (c: CCtx) => `${teamName(c)}'s target for ${c.per.title} - each team and period its own`;
/** A chart by its id "<tab>:<what>[-<breakdown>]": people:active, apic:lost, status:table, status:months, status:lost-list… */
function drawnOf(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  if (chart === "months") {
    const title = (c: CCtx) => `Customers who bought, ${c.per.title}, month by month${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} against ${perWords(c.d, c.per, true)} · the running month to date, lighter, against last year's same month pro rata`} actions={a}><CustMonths c={c} target={targetFor(c, id)} /></ChartBox>,
      target: (c) => ({ unit: "n", label: `Each month's customers who bought are measured against it - a line across the months; the running month is not counted · ${teamName(c)}'s target.` }) };
  }
  if (chart === "table") {
    const title = (c: CCtx) => `Where the customers stand, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${perWords(c.d, c.per)} against the same months a year earlier · quantity, Ø revenue and Ø orders per customer`} actions={a}><StatusTable c={c} /></ChartBox> };
  }
  if (chart === "lost-list" || chart === "slow-list") {
    const lost = chart === "lost-list";
    const title = (c: CCtx) => `The ${lost ? "lost" : "slowing"} customers by name, ${c.per.title}${teamPart(c)}`;
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={lost ? `No order for 12 months or more at ${perEnd(c.d, c.per)} - those who bought most in their last 12 months of buying first` : "Less than half of the same months a year earlier - the biggest drop first"} actions={a}><NamedTable c={c} status={lost ? "lost" : "slow"} /></ChartBox> };
  }
  const [what, by] = chart.split("-");
  if (!(what in MEASURE)) return undefined;
  const m = what as Measure;
  const dim: CDim = by && (by in DIM) ? (by as CDim) : DIM_OF[v];
  return { id, title: (c) => `${measureTitle(m)}, ${c.per.title}, by ${DIM[dim].lower}${teamPart(c)}`, draw: (c, a) => <Board c={c} id={id} dim={dim} m={m} actions={a} />,
    target: (c) => ({ unit: MEASURE[m].unit, label: `Each ${DIM[dim].lower}'s ${MEASURE[m].target} ${c.per.title} is measured against it${MEASURE[m].lower ? " - at or under it is reached" : ""} · ${forWhom(c)}.` }) };
}
/** The old page's keys, still in some BUC Views (the 21.10 page: reps, status, category), by what took their place. */
function chartOf(key: string): Drawn | undefined {
  const [, view = "", chart = ""] = key.split(":");
  const asIs = drawnOf(`${view}:${chart}`);
  if (asIs) return asIs;
  if (view === "reps") return drawnOf(chart === "lost" ? "people:lost" : "people:active");
  if (view === "status") return drawnOf("status:table");
  if (view === "category") return drawnOf("category:active");
  if (view === "prio") return drawnOf(chart.startsWith("lost") ? "prio:lost" : "prio:active");
  return undefined;
}

/* ── the tables ────────────────────────────────────────────────────────── */

type Row = CStats & { label: string };
const churnOf = (r: CStats) => churn(r).cy;
function dimCols(c: CCtx): Col<Row>[] {
  return [
    { key: "active", head: "Active customers", tip: `Bought in the period - the change against ${perWords(c.d, c.per, true)}`, cell: (r) => withChange(int(r.active.cy), r.active.cy, r.active.py), sort: (r) => r.active.cy },
    { key: "avgrev", head: "Ø revenue", tip: "Revenue in the period per active customer", cell: (r) => eur(avg(r.active.rev, r.active.cy)), sort: (r) => avg(r.active.rev, r.active.cy) },
    { key: "avgord", head: "Ø orders", tip: "HubSpot's orders in the period per active customer", cell: (r) => dec1(avg(r.active.ord, r.active.cy)), sort: (r) => avg(r.active.ord, r.active.cy) },
    { key: "new", head: "New", tip: "First order ever in the period", cell: (r) => int(r.new.cy), sort: (r) => r.new.cy },
    { key: "react", head: "Reactivated", tip: "Bought again after 12 months or more without", cell: (r) => int(r.react.cy), sort: (r) => r.react.cy },
    { key: "slow", head: "Slowing", tip: "Less than half of the same months a year earlier", cell: (r) => int(r.slow.cy), sort: (r) => r.slow.cy },
    { key: "lost", head: "Lost", tip: "No order for 12 months or more at the period's end", cell: (r) => withChange(int(r.lost.cy), r.lost.cy, r.lost.py, true), sort: (r) => r.lost.cy },
    { key: "churn", head: "Churn rate", tip: `Of the customers who bought ${baseWords(c.d, c.per)}, the share that did not order since`, cell: (r) => pct(churnOf(r)), sort: (r) => churnOf(r) ?? -1 },
  ];
}
function DimTable({ c, dim }: { c: CCtx; dim: CDim }) {
  const by = statsOf(c, dim);
  const rank = ranked(dim);
  const rows: Row[] = [...by].map(([label, s]) => ({ label, ...s }));
  const sorted = rank ? [...rows].sort((a, b) => rank(a.label) - rank(b.label) || b.active.cy - a.active.cy) : rows;
  return <FullTable key={`${dim}-${c.per.id}-${c.team}`} first={DIM[dim].name} cols={dimCols(c)} initial="active" rows={sorted} total={{ label: "Total", ...totalOf(c) }} natural={!!rank}
    selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} find={dim === "person" ? "a person" : `a ${DIM[dim].lower}`} />;
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string, target?: TargetOf) => React.ReactNode;
const draw = (c: CCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c), d.target?.(c))); };

function TabCard({ c, act }: { c: CCtx; act: Act }) {
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const words = `${perWords(c.d, c.per)} against ${perWords(c.d, c.per, true)}`;
  // every breakdown its own boards, a measure each (SARCLA 29.10.2026: "these are not separated graphs, they should")
  const boards = (v: CView) => (
    <>
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, `${v}:active`)}{draw(c, act, `${v}:lost`)}</Box>
      <Box sx={TWO}>{draw(c, act, `${v}:new`)}{draw(c, act, `${v}:react`)}</Box>
      <Box sx={TWO}>{draw(c, act, `${v}:slow`)}{draw(c, act, `${v}:churn`)}</Box>
      <Box sx={TWO}>{draw(c, act, `${v}:avgrev`)}{draw(c, act, `${v}:avgord`)}</Box>
    </>
  );
  if (c.view === "people") return (
    <GlassCard sx={card}>
      <CardTitle icon={<BadgeOutlinedIcon />} tint="green" title={`${teamName(c)}'s customers, ${c.per.title}`} note={`${words} · by the customer's Performis SAE`} />
      {boards("people")}
      <Box><SubTitle>{perCap(c.per)}, by Performis SAE</SubTitle><DimTable c={c} dim="person" /></Box>
    </GlassCard>
  );
  if (c.view === "status") return (
    <GlassCard sx={card}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="green" title={`Where ${teamName(c)}'s customers stand, ${c.per.title}`} note={`${words} · existing customers, counted the same way in both years`} />
      <Box sx={{ mt: -1 }}>{draw(c, act, "status:table")}</Box>
      {c.per.months >= 2 && draw(c, act, "status:months")}
      {draw(c, act, "status:lost-list")}
      {draw(c, act, "status:slow-list")}
    </GlassCard>
  );
  const dim = DIM_OF[c.view], dd = DIM[dim];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={dd.icon} tint={dd.tint} title={`${teamName(c)}'s customers by ${dd.lower}, ${c.per.title}`} note={`${dd.note} · ${words}`} />
      {boards(c.view)}
      <Box><SubTitle>{perCap(c.per)}, by {dd.lower}</SubTitle><DimTable c={c} dim={dim} /></Box>
    </GlassCard>
  );
}
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures top right: five counts, the change and a word under each ─ */

type Fig = { id: string; label: string; value: string; change: { text: string; color: string }; sub: string; icon: React.ReactNode; tint: Tint; amount: number; lower?: boolean };
function figuresOf(c: CCtx): Fig[] {
  const t = totalOf(c);
  const r = churn(t);
  const vs = (x: { cy: number; py: number }, lower = false) => { const ch = changeOf(x.cy, x.py, lower); return { text: `${ch.text} · ${signedInt(x.cy - x.py)} on ${int(x.py)} a year earlier`, color: ch.color }; };
  return [
    { id: "fig-active", label: `Active customers ${c.per.title}`, value: int(t.active.cy), change: vs(t.active), sub: `Ø ${eur(avg(t.active.rev, t.active.cy))} · Ø ${dec1(avg(t.active.ord, t.active.cy))} orders`, icon: <GroupsOutlinedIcon />, tint: "green", amount: t.active.cy },
    { id: "fig-new", label: "New customers", value: int(t.new.cy), change: vs(t.new), sub: `Ø ${eur(avg(t.new.rev, t.new.cy))} · first order ever`, icon: <PersonAddAltOutlinedIcon />, tint: "blue", amount: t.new.cy },
    { id: "fig-react", label: "Reactivated", value: int(t.react.cy), change: vs(t.react), sub: `Ø ${eur(avg(t.react.rev, t.react.cy))} · after 12 months or more`, icon: <RestartAltOutlinedIcon />, tint: "purple", amount: t.react.cy },
    { id: "fig-slow", label: "Slowing", value: int(t.slow.cy), change: vs(t.slow, true), sub: "under half of a year earlier", icon: <TrendingDownOutlinedIcon />, tint: "amber", amount: t.slow.cy, lower: true },
    { id: "fig-lost", label: "Lost - no order for 12 months or more", value: int(t.lost.cy), change: vs(t.lost, true), sub: `churn ${pct(r.cy)}: ${int(t.churned.cy)} of ${int(t.base.cy)} who bought ${baseWords(c.d, c.per)}`, icon: <PersonOffOutlinedIcon />, tint: "pink", amount: t.lost.cy, lower: true },
  ];
}
function FigureCards({ c, items, actions }: { c: CCtx; items: Fig[]; actions?: (f: Fig) => React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(132px, 1fr))", xl: `repeat(${items.length}, minmax(132px, 1fr))` }, minWidth: 0 }}>
      {items.map((f) => {
        const tgt = actions ? targetFor(c, `panel:${f.id}`) : null;
        const hit = tgt != null && (f.lower ? f.amount <= tgt : f.amount >= tgt);
        return (
          <Box key={f.id} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Badge icon={f.icon} tint={f.tint} size={22} />
              <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
              {actions?.(f)}
            </Box>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: f.change.color, lineHeight: 1.3 }}>{f.change.text}</Typography>
            <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{f.sub}</Typography>
            {tgt != null && <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: hit ? GREEN : RED }}>{pct(f.amount / tgt)} of the target {int(tgt)}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── the Filters window: the period and the breakdowns ─────────────────── */

function CPeriod({ d, per, onPer }: { d: CustDevData; per: CPer; onPer: (w: CWin) => void }) {
  const m = lastOf(d);
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
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>This year&apos;s months, against the same months a year earlier. Lost: no order in the 12 months up to the period&apos;s end.</Typography>
    </Box>
  );
}
function CFacet({ c, dim, onPick }: { c: CCtx; dim: CDim; onPick: (l: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const by = statsOf(c, dim, true);
  const rank = ranked(dim);
  const rows = [...by].map(([label, s]) => ({ label, n: s.active.cy }));
  rows.sort(rank ? (a, b) => rank(a.label) - rank(b.label) || b.n - a.n : (a, b) => b.n - a.n || a.label.localeCompare(b.label));
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
          <Box key={r.label} component="button" type="button" onClick={() => onPick(r.label)} aria-pressed={on} title={`${r.label}: ${int(r.n)} active customers`}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 70px 52px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? t.bg : "transparent", "&:hover": { bgcolor: on ? t.bg : "rgba(21,34,58,.04)" } }}>
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
const FILTER_DIMS: CDim[] = ["person", "prio", "category", "type", "apic", "country"];
function CFilterWindow({ c, per, open, onClose, focus, onPer, toggle, clearAll }: {
  c: CCtx; per: CPer; open: boolean; onClose: () => void; focus: { dim: CDim; n: number } | null; onPer: (w: CWin) => void; toggle: (d: CDim, l: string) => void; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<CDim | "period", boolean>>>({});
  const isOpen = (k: CDim | "period") => (shut[k] !== undefined ? !shut[k] : k === "period" || k === "person" || !!c.filters[k as CDim]?.length);
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
    <FilterPanel id="eso-customers-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, v]) => <Chip key={`${d}:${v}`} size="small" label={<span><b>{DIM[d].name}:</b> {v}</span>} onDelete={() => toggle(d, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          <FilterSection id="cfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => setShut((s) => ({ ...s, period: isOpen("period") }))} summary={perCap(per)}>
            <CPeriod d={c.d} per={per} onPer={onPer} />
          </FilterSection>
          {FILTER_DIMS.map((dim, i) => (
            <FilterSection key={dim} id={`cfilter-${dim}`} index={i + 1} title={DIM[dim].name} icon={DIM[dim].icon} tint={DIM[dim].tint} open={isOpen(dim)} onFlip={() => setShut((s) => ({ ...s, [dim]: isOpen(dim) }))}
              summary={!c.filters[dim]?.length ? "All" : c.filters[dim]!.length === 1 ? c.filters[dim]![0] : `${c.filters[dim]!.length} chosen`} chosen={!!c.filters[dim]?.length}>
              <CFacet c={c} dim={dim} onPick={(l) => toggle(dim, l)} />
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
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The customers could not be read: ${error}` : `Reading every company that bought and this year's and last year's orders in HubSpot${progress ? ` · ${progress}` : ""}…`}</Typography>
      </Box>
    </GlassCard>
  );
}
export function CustomerDevExplorer() {
  const params = useSearchParams();
  const { d, computing, progress, error } = useCustDev();
  const [team, setTeam] = useTeam();
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  const { state: acts } = useActions("eso-customers");
  const view: CView = isView(params.get("view")) ? (params.get("view") as CView) : "people";
  const setView = (v: CView) => setQuery((q) => { if (v === "people") q.delete("view"); else q.set("view", v); });
  const filters: CFilters = useMemo(() => Object.fromEntries(FILTER_DIMS.flatMap((k) => (params.getAll(k).length ? [[k, params.getAll(k)]] : []))), [params]);
  const toggle = (k: CDim, label: string) => setQuery((q) => { const cur = q.getAll(k), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]; q.delete(k); for (const x of next) q.append(k, x); });
  const clearAll = () => setQuery((q) => { for (const k of FILTER_DIMS) q.delete(k); q.delete("from"); q.delete("to"); });
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: CDim; n: number } | null>(null);
  const openOn = (k: CDim) => { setFocus((f) => ({ dim: k, n: (f?.n ?? 0) + 1 })); setPanel(true); };
  const setPer = (w: CWin) => setQuery((q) => { if (!d) return; const ytd = presetsOf(d)[0].win; if (w.from === ytd.from && w.to === ytd.to) { q.delete("from"); q.delete("to"); } else { q.set("from", ym(d, w.from)); q.set("to", ym(d, w.to)); } });

  // the work a click asks for, kept; the tabs and toggles answer at once and the charts follow (as the Figures)
  const lead = leadOf(team, leadKey, lt);
  const fromP = params.get("from"), toP = params.get("to");
  const per = useMemo(() => {
    if (!d) return null;
    const a = fromYm(d, fromP), b = fromYm(d, toP), m = lastOf(d);
    return a != null && b != null ? perOf(d, { from: Math.min(a, b, m), to: Math.min(Math.max(a, b), m) }) : perOf(d, presetsOf(d)[0].win);
  }, [d, fromP, toP]);
  const people = useMemo(() => (d ? peopleOf(d, team, lead, lt?.byName ?? {}) : null), [d, team, lead, lt]);
  const want = useMemo(() => ({ view, per, people, team, lead, filters }), [view, per, people, team, lead, filters]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<CCtx | null>(() => (d && drawn.per ? {
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
  if (!d || !c || !per) return (<Box sx={shell}>{back}<Typography component="h1" sx={H1}>Customer development</Typography><Waiting computing={computing} progress={progress} error={error} /></Box>);

  const act: Act = (id, title, target) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-customers:${id}`, page: "eso-customers", tab: c.view, title, summary: `${teamName(c)} · ${perWords(d, c.per)}`,
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
          <Typography component="h1" sx={H1}>Customer development</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamName(now)}</b> · {per.title} <b style={{ color: INK }}>{perWords(d, per)}</b> against {perWords(d, per, true)} · existing customers, by Performis SAE{computing ? " · reading HubSpot again" : ""}
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
          <ReportTabs name="eso-customers" tab={view} onSelect={setView} tabs={VIEWS.map((v) => ({ id: v.id, label: v.label, count: v.id !== "status" && filters[DIM_OF[v.id]]?.length ? String(filters[DIM_OF[v.id]]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-customers" /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else openOn(DIM_OF[view]); }} variant={panel || chosen.length || per.id !== "ytd" ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-customers-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length || per.id !== "ytd" ? undefined : "#fff" }}>
          Filters{chosen.length + (per.id !== "ytd" ? 1 : 0) ? ` · ${chosen.length + (per.id !== "ytd" ? 1 : 0)}` : ""}
        </Button>
      </Box>
      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} act={act} />
      </Box>
      <CFilterWindow c={c} per={per} open={panel} onClose={() => setPanel(false)} focus={focus} onPer={setPer} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's Customer development panel ─────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
const PANEL = "eso-customers:panel:";

/** Customer development in the BUC View: the year to date for the team the toggle shows, the months, and the charts sent here. */
export function CustomerDevPanel({ acts }: { acts: ActionsState | null }) {
  const { d, computing, progress, error } = useCustDev();
  const [team, setTeam] = useState<TeamKey>("eso");
  const [leadKey, setLeadKey] = useState<LeadKey>("all");
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  useEffect(() => { try { const x = asTeam(localStorage.getItem(KEPT)); if (x) setTeam(x); const l = asLead(localStorage.getItem(KEPT_LEAD)); if (l) setLeadKey(l); } catch { /* ESO */ } }, []);
  const choose = (t: TeamKey) => { setTeam(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const chooseLead = (l: LeadKey) => { setLeadKey(l); try { localStorage.setItem(KEPT_LEAD, l); } catch { /* here only */ } };
  const lead = leadOf(team, leadKey, lt);
  const want = useMemo(() => ({ team, lead }), [team, lead]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<CCtx | null>(() => (d ? { d, per: perOf(d, presetsOf(d)[0].win), team: drawn.team, lead: drawn.lead, teams, people: peopleOf(d, drawn.team, drawn.lead, lt?.byName ?? {}), filters: {}, view: "people", targets: acts?.targets } : null),
    [d, drawn, teams, lt, acts?.targets]);
  const items: SortItem[] = useMemo(() => !c ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-customers" && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const ch = chartOf(spec.key);
    const fmt = formatOf(acts, spec);
    const f = spec.filters ?? {};
    const sf: CFilters = Object.fromEntries(FILTER_DIMS.flatMap((k) => (f[k]?.length ? [[k, f[k]]] : [])));
    const pid = f.period?.[0], pr = pid ? presetsOf(c.d).find((p) => p.id === pid) : null;
    const a0 = fromYm(c.d, f.from?.[0] ?? null), b0 = fromYm(c.d, f.to?.[0] ?? null);
    const sp = pr ? perOf(c.d, pr.win) : a0 != null && b0 != null ? perOf(c.d, { from: a0, to: b0 }) : c.per;
    // every chart here follows the panel's toggle (as the Figures' panel); its filters and period stay as sent
    const sc: CCtx = { ...c, per: sp, filters: sf, view: (spec.tab && isView(spec.tab) ? spec.tab : "people") as CView, half: fmt === "half" };
    const target = ch?.target ? { key: targetKey(ch.id, c.team, c.lead, sp), ...ch.target(sc) } : undefined;
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind, target }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<GroupsOutlinedIcon />} tint="green" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [c, acts]);
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-customers", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);
  const shown = (id: string) => placementOf(acts, `${PANEL}${id}`, "nutshell") === "nutshell";
  const href = `/reporting/eso-benchmark/customers?team=${drawn.team}${drawn.lead ? `&lead=${drawn.lead}` : ""}`;
  const own = (id: string, title: string, kind: "kpi" | "card", target?: { key: string; unit: "eur" | "pct" | "n"; label: string }) => (
    <TileActions where="nutshell" start="nutshell" edge={2} tile={{ key: `${PANEL}${id}`, page: "eso-customers", tab: "status", title: `${title} - ${c ? teamName(c) : "ESO"}`, kind,
      filters: { team: [drawn.team], ...(drawn.lead ? { lead: [drawn.lead] } : {}), period: ["ytd"] }, href, target }} />
  );
  const months = drawnOf("status:months")!;
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<GroupsOutlinedIcon />} tint="green" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/customers?team=${team}${lead ? `&lead=${lead}` : ""}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.green.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Customer development</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.green.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName({ team, lead, teams })} · year to date ${perWords(c.d, c.per)} against ${perWords(c.d, c.per, true)} · existing customers, by Performis SAE` : "Existing customers, by Performis SAE"}</Typography>
        </Box>
        <Teams team={team} onTeam={choose} lead={leadKey} onLead={chooseLead} teams={teams} />
      </Box>
      {!c ? <Waiting computing={computing} progress={progress} error={error} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          <FigureCards c={c} items={figs.filter((f) => shown(f.id))} actions={(f) => own(f.id, f.label, "kpi", { key: targetKey(`panel:${f.id}`, c.team, c.lead, c.per), unit: "n", label: `${f.label} is measured against it${f.lower ? " - at or under it is reached" : ""} · ${teamName(c)}'s target.` })} />
          {shown("months") && months.draw(c, own("months", "Customers who bought, year to date, month by month", "card", months.target ? { key: targetKey(months.id, c.team, c.lead, c.per), ...months.target(c) } : undefined))}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-customers"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </Box>
      )}
    </GlassCard>
  );
}

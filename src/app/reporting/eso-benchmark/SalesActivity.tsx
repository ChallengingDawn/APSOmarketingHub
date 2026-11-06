"use client";
// THE SALES ACTIVITY PAGE (SARCLA 05.11.2026: "build this report as a sub report on ESO and TSA master dashboard") - Diana's
// HubSpot dashboard "Sales Activities x Companies Performance" in ESO and TSA Reports, built like Customer development: the
// companies Sales reached against those it did not, and what share of the revenue and of the potential sits in them - this
// year so far against last year, by the company's owner as the dashboard splits it. What Alexandre asked for on 10.09.2026
// is in it: the base is a choice (Claudio's Prio 1 + 2 first, every company in HubSpot as the dashboard has it, ever bought,
// bought this year, the customer categories) and "Which companies count" puts them side by side; the potential stands beside
// the revenue everywhere. Diana's four definitions are the Filters' "Sales activity", calls and visits first. The rows and
// their rules: src/lib/reporting/salesActivityRules.ts.
// What to keep in mind (no footer on the page - SARCLA 06.11.2026 took the line out): the flags are HubSpot's company
// properties "Sales Activity in <year>", the same as the HubSpot dashboard; calls, visits and e-mails had to be logged in
// HubSpot only from mid-2025, so 2025 reads low; each company counts under today's owner, priority and potential in both
// years; this year runs to the day of the read, last year is the whole year.

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
import ConnectWithoutContactOutlinedIcon from "@mui/icons-material/ConnectWithoutContactOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import DonutLargeOutlinedIcon from "@mui/icons-material/DonutLargeOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import PhoneInTalkOutlinedIcon from "@mui/icons-material/PhoneInTalkOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, TINT, TRACK, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { BEFORE, THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { FilterPanel, FilterSection } from "@/app/reporting/marketing-kpis/FilterPanel";
import { everyWhileSeen } from "@/app/reporting/marketing-kpis/data";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, placementOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import type { SlowState } from "@/lib/integrations/slowReport";
import {
  BASES, C, DEFS, ORDER, baseForDim, baseOf, basesOf, blank, defOf, labelOf, reachedBy, rowsOf, shareOf, sharesOf, statsBy,
  type BaseId, type SDim, type SFilters, type SStats, type SalesActData,
} from "@/lib/reporting/salesActivityRules";
import { CompaniesFor, type CompanyItem, type CompanySource } from "@/app/reporting/CompanyList";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  ChartBox, FullTable, H1, KEPT, KEPT_LEAD, Leaderboard, NoLeadYet, TEAM_OF, TWO, Teams, asLead, asTeam, leadOf, setQuery, teamWord,
  useLead, useLeads, useTeam, type BoardRow, type Col, type Home, type LeadKey, type TeamKey,
} from "./Figures";
import { BucEmpty } from "./BucEmpty";
import { ActiveFilters, type ActiveItem } from "./EsoFilters";
import { useScoped } from "@/app/reporting/scope";

/* ── the read ──────────────────────────────────────────────────────────── */

function useSalesActivity(): { d: SalesActData | null; computing: boolean; progress?: string; error?: string } {
  const [st, setSt] = useState<{ state?: SlowState<SalesActData>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/sales-activity").then((r) => r.json())
      .then((j: { state?: SlowState<SalesActData>; error?: string }) => {
        if (!alive) return;
        // the same read again is kept as it is: nothing drawn again
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
const pct = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const signedInt = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(Math.round(n)).toLocaleString("en")}`;
const signedEur = (n: number) => `${Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? "−" : "±"}€${Math.abs(Math.round(n)).toLocaleString("en")}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** A share's change in points - green when it went up (or down, for what should shrink). */
function ptsOf(cy: number | null, py: number | null, lower = false): { text: string; color: string } {
  if (cy == null || py == null) return { text: "—", color: FAINT };
  const x = (cy - py) * 100;
  const good = lower ? x < 0 : x > 0;
  return { text: `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(1)} pts`, color: Math.abs(x) < 0.05 ? FAINT : good ? GREEN : RED };
}
const withPts = (text: string, cy: number | null, py: number | null) => {
  const ch = ptsOf(cy, py);
  return (
    <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
      {text}
      <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: ch.color }}>{ch.text}</Box>
    </Box>
  );
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** every place on a board, 15 a page (as Customer development) */
const PAGE = 15;

/** "2026 so far" and "2025" - the flags are kept for the whole year, this one running to the day of the read */
const cyWord = (d: SalesActData) => `${d.year} so far`;
const pyWord = (d: SalesActData) => String(d.year - 1);
/** "2026 to 5 Nov against 2025, the whole year" */
const yearsWords = (d: SalesActData) => { const [, m, day] = d.today.split("-").map(Number); return `${d.year} to ${day} ${MONTHS[m - 1]} against ${d.year - 1}, the whole year`; };

/* ── the teams: ESO | TSA | Total by the company's owner ───────────────── */

/** The owners shown (indexes): a team's - under ESO, a line manager's team only; null for Total (every company, the ones
 *  without an owner too). */
const peopleOf = (d: SalesActData, team: TeamKey, lead: string | null, byName: Record<string, string>) => (team === "total" ? null
  : new Set(d.people.flatMap((p, i) => (p.team === TEAM_OF[team] && (team !== "eso" || !lead || byName[p.name] === lead) ? [i] : []))));
const teamName = (c: { team: TeamKey; lead: string | null; teams: Team[] }) => (c.team === "eso" && c.lead ? c.teams.find((t) => t.id === c.lead)?.name ?? c.lead : teamWord(c.team));

/* ── what every chart is drawn with ────────────────────────────────────── */

type SView = "overview" | "people" | "prio" | "category" | "country" | "bases";
const VIEWS: { id: SView; label: string }[] = [
  { id: "overview", label: "Contacted or not" }, { id: "people", label: "Company owner" }, { id: "prio", label: "Priority" },
  { id: "category", label: "Customer category" }, { id: "country", label: "Country" }, { id: "bases", label: "Which companies count" },
];
const isView = (x: string | null | undefined): x is SView => VIEWS.some((v) => v.id === x);
type DimView = "people" | "prio" | "category" | "country";
const DIM_OF: Record<DimView, SDim> = { people: "person", prio: "prio", category: "category", country: "country" };
const isDimView = (v: SView): v is DimView => v in DIM_OF;
const DIM: Record<SDim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string }> = {
  person: { name: "Company owner", lower: "company owner", icon: <BadgeOutlinedIcon />, tint: "green", note: "The company's owner in HubSpot today, as the HubSpot dashboard splits it" },
  prio: { name: "Priority", lower: "priority", icon: <StarOutlineIcon />, tint: "purple", note: "The company's sales priority today: Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500" },
  category: { name: "Customer category", lower: "customer category", icon: <CategoryOutlinedIcon />, tint: "blue", note: "The company's APSO customer category today" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where the company is" },
};
/** A breakdown's own order (priorities, categories) - values it does not name after them, by size. */
const ranked = (dim: SDim) => { const o = ORDER[dim]; return o ? (l: string) => { const i = o.indexOf(l); return i < 0 ? 999 : i; } : null; };

export type SCtx = {
  d: SalesActData; def: number; base: BaseId; team: TeamKey; lead: string | null; teams: Team[];
  /** the owners shown (indexes), null for everyone */
  people: Set<number> | null; filters: SFilters; view: SView;
  onBar?: (dim: SDim, label: string) => void; onFilter?: (dim: SDim) => void; onBase?: (b: BaseId) => void;
};
const verb = (c: SCtx) => DEFS[c.def].verb;
const baseWord = (c: SCtx, b: BaseId = c.base) => BASES.find((x) => x.id === b)!.label;
/** the base in a sentence: "Prio 1 + 2 companies", "companies in HubSpot" */
const baseWords = (c: SCtx, dim?: SDim) => BASES.find((x) => x.id === baseForDim(c.base, dim))!.words;
/** "ESO's", "APSOparts'" */
const poss = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const teamPart = (c: SCtx) => ` - ${teamName(c)}`;

const statCache = new WeakMap<SCtx, Map<string, Map<string, SStats>>>();
/** The figures of the base by a breakdown, or all together - only what is filtered; `own` leaves the breakdown's own filter
 *  out, for the Filters window's lists. By priority the base is every company when it is Prio 1 + 2 (baseForDim). */
function statsOf(c: SCtx, dim?: SDim, own = false, base: BaseId = baseForDim(c.base, dim)): Map<string, SStats> {
  let memo = statCache.get(c);
  if (!memo) { memo = new Map(); statCache.set(c, memo); }
  const k = `${dim ?? ""}${own ? ":all" : ""}@${base}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const out = statsBy(c.d, rowsOf(c.d, base, c.filters, c.people, own ? dim : undefined), c.def, dim ? (r) => labelOf(c.d, r, dim) : undefined);
  memo.set(k, out);
  return out;
}
const totalOf = (c: SCtx) => statsOf(c).get("") ?? blank();
/** A breakdown's total, on the base it counts on - every company by priority when the base is Prio 1 + 2. */
const totalFor = (c: SCtx, dim: SDim) => statsOf(c, undefined, false, baseForDim(c.base, dim)).get("") ?? blank();
/** The shares - a year whose flag is not in HubSpot left empty: unknown, not none. */
function shares(c: SCtx, s: SStats) {
  const x = sharesOf(s);
  const cy = !!c.d.read.cy[c.def], py = !!c.d.read.py[c.def];
  return {
    reach: { cy: cy ? x.reach.cy : null, py: py ? x.reach.py : null },
    rev: { cy: cy ? x.rev.cy : null, py: py ? x.rev.py : null },
    pot: { cy: cy ? x.pot.cy : null, py: py ? x.pot.py : null },
    never: cy && py ? x.never : null,
  };
}

/* ── the leaderboards ──────────────────────────────────────────────────── */

type Measure = "reach" | "rev" | "pot" | "never";
const isMeasure = (x: string): x is Measure => x === "reach" || x === "rev" || x === "pot" || x === "never";
function measureTitle(c: SCtx, m: Measure) {
  const v = verb(c);
  return m === "reach" ? `Share of companies ${v}` : m === "rev" ? `Share of revenue from companies ${v}` : m === "pot" ? `Share of potential in companies ${v}` : `Companies not ${v} in ${c.d.year - 1} or ${c.d.year}`;
}
function boardRows(c: SCtx, dim: SDim, m: Measure): BoardRow[] {
  const rows: BoardRow[] = [];
  const py = c.d.year - 1;
  for (const [label, s] of statsOf(c, dim)) {
    if (!s.n) continue;
    const x = shares(c, s);
    if (m === "reach") rows.push({ label, cur: x.reach.cy ?? 0, prev: x.reach.py ?? 0, sub: `${int(s.cy)} of ${int(s.n)} companies · ${int(s.py)} in ${py}` });
    else if (m === "rev") { if (s.revCy <= 0 && s.revPy <= 0) continue; rows.push({ label, cur: x.rev.cy ?? 0, prev: x.rev.py ?? 0, sub: `${eur(s.revCyHit)} of ${eur(s.revCy)}` }); }
    else if (m === "pot") { if (s.pot <= 0) continue; rows.push({ label, cur: x.pot.cy ?? 0, prev: x.pot.py ?? 0, sub: `${eur(s.potCy)} of ${eur(s.pot)} potential` }); }
    else { if (!s.never) continue; rows.push({ label, cur: s.never, prev: 0, sub: `${pct(shareOf(s.never, s.n))} of ${int(s.n)} companies · ${eur(s.potNever)} potential` }); }
  }
  return rows;
}
function Board({ c, id, dim, m, actions }: { c: SCtx; id: string; dim: SDim; m: Measure; actions?: React.ReactNode }) {
  const share = m !== "never";
  return (
    <Leaderboard key={`${id}-${c.def}-${c.base}`} title={`${measureTitle(c, m)}, by ${DIM[dim].lower}`} rows={boardRows(c, dim, m)}
      curLabel={cyWord(c.d)} prevLabel={pyWord(c.d)} vs={share ? `vs ${c.d.year - 1}` : undefined} pageSize={PAGE}
      fmt={share ? (n) => pct(n) : int} diff={signedInt} ratio={share} noChange={!share}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} actions={actions} />
  );
}

/* ── contacted or not: one bar a year, the share reached in blue ───────── */

function Legend({ items }: { items: { color: string; label: string; tick?: boolean; soft?: boolean }[] }) {
  return (
    <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
      {items.map((x) => (
        <Box key={x.label} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
          {x.tick ? <Box component="span" sx={{ width: 14, borderTop: `2px solid ${x.color}` }} />
            : <Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: x.color, opacity: x.soft ? 0.45 : 1, border: x.color === TRACK ? "1px solid #cfd4db" : 0 }} />}
          {x.label}
        </Box>
      ))}
    </Box>
  );
}
type SplitRow = { year: string; hit: number; total: number; fmt: (n: number) => string; known: boolean };
/** Two years, one bar each: the part in the companies reached (blue), the rest - the figures written above. */
function SplitBars({ rows, hitWord, restWord }: { rows: SplitRow[]; hitWord: string; restWord: string }) {
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Legend items={[{ color: THIS, label: hitWord }, { color: TRACK, label: restWord }]} />
      {rows.map((r) => {
        const s = r.total > 0 ? r.hit / r.total : 0;
        return (
          <Box key={r.year} sx={{ display: "grid", gap: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, minWidth: 88 }}>{r.year}</Typography>
              {r.known ? (
                <>
                  <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{pct(s)}</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{r.fmt(r.hit)} of {r.fmt(r.total)}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{restWord}: {r.fmt(r.total - r.hit)} · {pct(r.total > 0 ? 1 - s : null)}</Typography>
                </>
              ) : <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>not recorded in HubSpot</Typography>}
            </Box>
            <Box title={r.known ? `${r.year}: ${pct(s)} - ${r.fmt(r.hit)} of ${r.fmt(r.total)}` : undefined}
              sx={{ height: 22, borderRadius: "6px", bgcolor: TRACK, border: "1px solid #e1e5eb", overflow: "hidden", display: "flex" }}>
              {r.known && <Box sx={{ width: `${s * 100}%`, bgcolor: THIS }} />}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
/** Each company once: reached in both years, this year only, last year only, or in neither. */
function YearsBar({ c, s }: { c: SCtx; s: SStats }) {
  const cy = c.d.year, py = cy - 1;
  if (!c.d.read.cy[c.def] || !c.d.read.py[c.def]) return <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Both years&apos; flags are needed - one is not recorded in HubSpot.</Typography>;
  const parts = [
    { label: "Both years", n: s.both, color: THIS, soft: false },
    { label: `${cy} only`, n: s.cy - s.both, color: THIS, soft: true },
    { label: `${py} only`, n: s.py - s.both, color: BEFORE, soft: false },
    { label: "Neither", n: s.never, color: TRACK, soft: false },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      <Box sx={{ height: 22, borderRadius: "6px", border: "1px solid #e1e5eb", overflow: "hidden", display: "flex", bgcolor: TRACK }}>
        {parts.map((p) => (s.n && p.n ? <Box key={p.label} title={`${p.label}: ${int(p.n)} · ${pct(p.n / s.n)}`} sx={{ width: `${(p.n / s.n) * 100}%`, bgcolor: p.color, opacity: p.soft ? 0.45 : 1 }} /> : null))}
      </Box>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {parts.map((p) => (
          <Box key={p.label} sx={{ display: "grid", gridTemplateColumns: "14px minmax(0, 1fr) auto 64px", gap: 1, alignItems: "center" }}>
            <Box sx={{ width: 14, height: 10, borderRadius: "2px", bgcolor: p.color, opacity: p.soft ? 0.45 : 1, border: p.color === TRACK ? "1px solid #cfd4db" : 0 }} />
            <Typography sx={{ fontSize: "0.84rem", color: INK }}>{p.label}</Typography>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{int(p.n)}</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(s.n ? p.n / s.n : null)}</Typography>
          </Box>
        ))}
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5 }}>Neither year: {eur(s.potNever)} potential</Typography>
      </Box>
    </Box>
  );
}

/* ── all the figures ───────────────────────────────────────────────────── */

type ORow = { label: string; cy: string; py: string; ch: React.ReactNode };
function OverviewTable({ c }: { c: SCtx }) {
  const t = totalOf(c), x = shares(c, t), v = verb(c), k = c.d.read;
  const known = (side: "cy" | "py", text: string) => (k[side][c.def] ? text : "—");
  const both = !!k.cy[c.def] && !!k.py[c.def];
  const ch = (p: { cy: number | null; py: number | null }) => { const z = ptsOf(p.cy, p.py); return <span style={{ color: z.color, fontWeight: 700 }}>{z.text}</span>; };
  // every row a figure each year and its change (SARCLA 06.11.2026: "not all fields are populated") - counts and euros in
  // full, uncoloured: this year runs to today against the whole of last year
  const n = (a: number, b: number) => (both ? signedInt(a - b) : "—");
  const money = (a: number, b: number, needs = true) => (needs && !both ? "—" : `${signedEur(a - b)} · ${b ? `${a - b >= 0 ? "+" : "−"}${Math.abs(((a - b) / b) * 100).toFixed(1)}%` : "—"}`);
  const rows: ORow[] = [
    { label: "Companies", cy: int(t.n), py: int(t.n), ch: signedInt(0) },
    { label: `Companies ${v}`, cy: known("cy", int(t.cy)), py: known("py", int(t.py)), ch: n(t.cy, t.py) },
    { label: `Companies not ${v}`, cy: known("cy", int(t.n - t.cy)), py: known("py", int(t.n - t.py)), ch: n(t.n - t.cy, t.n - t.py) },
    { label: `Share of companies ${v}`, cy: pct(x.reach.cy), py: pct(x.reach.py), ch: ch(x.reach) },
    { label: "Revenue", cy: eur(t.revCy), py: eur(t.revPy), ch: money(t.revCy, t.revPy, false) },
    { label: `Revenue from companies ${v}`, cy: known("cy", eur(t.revCyHit)), py: known("py", eur(t.revPyHit)), ch: money(t.revCyHit, t.revPyHit) },
    { label: `Share of revenue from companies ${v}`, cy: pct(x.rev.cy), py: pct(x.rev.py), ch: ch(x.rev) },
    { label: "Potential today", cy: eur(t.pot), py: eur(t.pot), ch: signedEur(0) },
    { label: `Potential in companies ${v}`, cy: known("cy", eur(t.potCy)), py: known("py", eur(t.potPy)), ch: money(t.potCy, t.potPy) },
    { label: `Share of potential in companies ${v}`, cy: pct(x.pot.cy), py: pct(x.pot.py), ch: ch(x.pot) },
  ];
  return (
    <FullTable key={`overview-${c.def}-${c.base}-${c.team}`} first={cap(baseWords(c))} natural rows={rows} cols={[
      { key: "cy", head: cyWord(c.d), cell: (r) => r.cy },
      { key: "py", head: pyWord(c.d), cell: (r) => r.py },
      { key: "ch", head: "Change", tip: "Shares in points, counts and euros in full - this year runs to the day of the read, last year is the whole year", cell: (r) => r.ch },
    ]} />
  );
}

type DRow = SStats & { label: string };
function dimCols(c: SCtx): Col<DRow>[] {
  const v = verb(c), cy = c.d.year, py = cy - 1;
  const sh = (r: DRow) => shares(c, r);
  return [
    { key: "n", head: "Companies", tip: cap(baseWords(c)), cell: (r) => int(r.n), sort: (r) => r.n },
    { key: "cy", head: `${cap(v)} ${cy}`, tip: `Companies ${v} this year so far`, cell: (r) => int(r.cy), sort: (r) => r.cy },
    { key: "reach", head: `Share ${cy}`, tip: `The change against ${py} in points`, cell: (r) => withPts(pct(sh(r).reach.cy), sh(r).reach.cy, sh(r).reach.py), sort: (r) => sh(r).reach.cy ?? -1 },
    { key: "reachPy", head: `Share ${py}`, cell: (r) => pct(sh(r).reach.py), sort: (r) => sh(r).reach.py ?? -1 },
    { key: "rev", head: `Revenue ${cy} so far`, cell: (r) => eur(r.revCy), sort: (r) => r.revCy },
    { key: "revShare", head: `From companies ${v}`, tip: `This year's revenue from the companies ${v} this year`, cell: (r) => pct(sh(r).rev.cy), sort: (r) => sh(r).rev.cy ?? -1 },
    { key: "pot", head: "Potential", tip: "Today's yearly potential", cell: (r) => eur(r.pot), sort: (r) => r.pot },
    { key: "potShare", head: `In companies ${v}`, tip: `The potential of the companies ${v} this year`, cell: (r) => pct(sh(r).pot.cy), sort: (r) => sh(r).pot.cy ?? -1 },
    { key: "never", head: `Neither ${py} nor ${cy}`, tip: `Companies not ${v} in either year`, cell: (r) => int(r.never), sort: (r) => r.never },
  ];
}
function DimTable({ c, dim }: { c: SCtx; dim: SDim }) {
  const rank = ranked(dim);
  const rows: DRow[] = [...statsOf(c, dim)].map(([label, s]) => ({ label, ...s }));
  const sorted = rank ? [...rows].sort((a, b) => rank(a.label) - rank(b.label) || b.n - a.n) : rows;
  return <FullTable key={`${dim}-${c.def}-${c.base}-${c.team}`} first={DIM[dim].name} cols={dimCols(c)} initial="n" rows={sorted} total={{ label: "Total", ...totalFor(c, dim) }} natural={!!rank}
    selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} find={dim === "person" ? "an owner" : `a ${DIM[dim].lower}`} />;
}

/* ── which companies count: every base side by side ────────────────────── */

function BaseBars({ c }: { c: SCtx }) {
  const by = useMemo(() => basesOf(c.d, c.filters, c.people, c.def), [c]);
  const cy = c.d.year, py = cy - 1;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Legend items={[{ color: THIS, label: `Share ${verb(c)}, ${cy} so far` }, { color: INK, label: `${py}`, tick: true }]} />
      {BASES.map((b) => {
        const s = by.get(b.id)!, x = shares(c, s), on = b.id === c.base, z = ptsOf(x.reach.cy, x.reach.py);
        return (
          <Box key={b.id} component="button" type="button" onClick={() => c.onBase?.(b.id)} aria-pressed={on} disabled={!c.onBase}
            title={`${b.label}: ${pct(x.reach.cy)} of ${int(s.n)} companies ${verb(c)} in ${cy} so far · ${py}: ${pct(x.reach.py)}`}
            sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) 96px", md: "minmax(200px, 1.2fr) minmax(0, 2fr) 128px" }, gap: 1.25, alignItems: "center", px: 1, py: 1, border: 0, borderRadius: "10px", font: "inherit", textAlign: "left", color: "inherit", cursor: c.onBase ? "pointer" : "default", bgcolor: on ? TINT.blue.bg : "transparent", "&:hover": { bgcolor: on ? TINT.blue.bg : "rgba(21,34,58,.04)" } }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: on ? 700 : 600, color: INK }}>{b.label}{on ? " · counted now" : ""}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.35 }}>{int(s.n)} companies · {b.note}</Typography>
            </Box>
            <Box sx={{ position: "relative", height: 18, bgcolor: TRACK, border: "1px solid #e1e5eb", borderRadius: "5px", display: { xs: "none", md: "block" } }}>
              <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(x.reach.cy ?? 0) * 100}%`, bgcolor: THIS, borderRadius: "4px" }} />
              {x.reach.py != null && <Box sx={{ position: "absolute", top: -4, bottom: -4, left: `${x.reach.py * 100}%`, borderLeft: `2px solid ${INK}` }} />}
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontSize: "0.98rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{pct(x.reach.cy)}</Typography>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: z.color }}>{z.text}<span style={{ color: MUTED, fontWeight: 500 }}> · {py} {pct(x.reach.py)}</span></Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
type BRow = SStats & { label: string; id: BaseId };
function BasesTable({ c }: { c: SCtx }) {
  const by = useMemo(() => basesOf(c.d, c.filters, c.people, c.def), [c]);
  const rows: BRow[] = BASES.map((b) => ({ label: b.label, id: b.id, ...by.get(b.id)! }));
  const cols = dimCols(c).map((x) => (x.key === "n" ? { ...x, tip: "Companies in the base" } : x));
  return <FullTable key={`bases-${c.def}-${c.team}`} first="Base" natural cols={cols as unknown as Col<BRow>[]} rows={rows} selected={[baseWord(c)]}
    onPick={c.onBase ? (l) => { const b = BASES.find((x) => x.label === l); if (b) c.onBase!(b.id); } : undefined} />;
}

/* ── the companies behind a chart ──────────────────────────────────────── */

/** Who a chart's list holds: every company of the base, those with revenue, or those reached in neither year. */
type Who = "all" | "rev" | "never";
/**
 * The companies behind a chart, its "Companies" button: the chart's base, team, owners and filters, worked out only when
 * the button is pressed (a base can be every company in HubSpot) - the most potential first, the revenue lists by revenue.
 */
function companiesOf(c: SCtx, id: string, who: Who, dim?: SDim): CompanySource {
  const v = verb(c), cy = c.d.year, py = cy - 1, k = c.d.read;
  const key = `salesact|${c.d.generatedAt}|${id}|${c.def}|${baseForDim(c.base, dim)}|${c.team}|${c.lead ?? ""}|${JSON.stringify(c.filters)}`;
  const yes = (side: "cy" | "py", hit: boolean) => (k[side][c.def] ? (hit ? "Yes" : "No") : "—");
  const whoWords = who === "rev" ? "those with revenue in either year" : who === "never" ? `not ${v} in ${py} or ${cy}` : "all of them";
  return {
    key, head: [`${cap(v)} ${cy}`, `${cap(v)} ${py}`, `Revenue ${cy} so far`, `Revenue ${py}`, "Potential", "Company owner", "Priority", "Country"],
    left: [1, 2, 6, 7, 8],
    note: `${cap(baseWords(c, dim))} · ${teamName(c)} · ${whoWords} · ${who === "rev" ? "the most revenue first" : "the most potential first"}`,
    rows: () => {
      const idx = rowsOf(c.d, baseForDim(c.base, dim), c.filters, c.people).filter((i) => {
        const r = c.d.companies[i];
        if (who === "rev") return r[C.revCy] > 0 || r[C.revPy] > 0;
        if (who === "never") return !reachedBy(r, c.def, "cy") && !reachedBy(r, c.def, "py");
        return true;
      });
      const rc = (i: number) => c.d.companies[i][C.revCy], pot = (i: number) => c.d.companies[i][C.pot];
      idx.sort(who === "rev" ? (a, b) => rc(b) - rc(a) || pot(b) - pot(a) : (a, b) => pot(b) - pot(a) || rc(b) - rc(a));
      return idx.map((i): CompanyItem => {
        const r = c.d.companies[i], hc = reachedBy(r, c.def, "cy"), hp = reachedBy(r, c.def, "py");
        return {
          id: c.d.ids[i] || null, name: c.d.names[i] || `Company ${c.d.ids[i]}`,
          cells: [yes("cy", hc), yes("py", hp), eur(r[C.revCy]), eur(r[C.revPy]), eur(r[C.pot]), labelOf(c.d, r, "person"), labelOf(c.d, r, "prio"), labelOf(c.d, r, "country")],
          values: [hc ? 1 : 0, hp ? 1 : 0, r[C.revCy], r[C.revPy], r[C.pot], null, null, null],
        };
      });
    },
  };
}

/* ── every chart by its key ────────────────────────────────────────────── */

type Drawn = { id: string; title: (c: SCtx) => string; draw: (c: SCtx, actions?: React.ReactNode) => React.ReactNode; who?: Who; dim?: SDim };
/** A chart by its id - with the companies it counts behind its "Companies" button. */
function drawnOf(id: string): Drawn | undefined {
  const d = drawnBare(id);
  return d && { ...d, draw: (c, a) => <CompaniesFor source={d.who ? companiesOf(c, id, d.who, d.dim) : null}>{d.draw(c, a)}</CompaniesFor> };
}
/** A chart by its id "<tab>:<chart>": overview:companies, people:reach, prio:never, bases:chart… */
function drawnBare(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  if (v === "overview") {
    const years = (c: SCtx) => `${c.d.year} so far and ${c.d.year - 1}`;
    if (chart === "companies") {
      const title = (c: SCtx) => `Companies ${verb(c)}, ${years(c)}${teamPart(c)}`;
      return { id, title, who: "all", draw: (c, a) => { const t = totalOf(c), k = c.d.read; return (
        <ChartBox title={title(c)} hint={`Of the ${int(t.n)} ${baseWords(c)} - ${DEFS[c.def].note} in the year`} actions={a}>
          <SplitBars hitWord={cap(verb(c))} restWord={`Not ${verb(c)}`} rows={[
            { year: cyWord(c.d), hit: t.cy, total: t.n, fmt: int, known: !!k.cy[c.def] }, { year: pyWord(c.d), hit: t.py, total: t.n, fmt: int, known: !!k.py[c.def] }]} />
        </ChartBox>); } };
    }
    if (chart === "revenue") {
      const title = (c: SCtx) => `Revenue from companies ${verb(c)}, ${years(c)}${teamPart(c)}`;
      return { id, title, who: "rev", draw: (c, a) => { const t = totalOf(c), k = c.d.read; return (
        <ChartBox title={title(c)} hint={`The revenue of the ${baseWords(c)} each year - the part from those ${verb(c)} in the same year`} actions={a}>
          <SplitBars hitWord={`From companies ${verb(c)}`} restWord="From the others" rows={[
            { year: cyWord(c.d), hit: t.revCyHit, total: t.revCy, fmt: eur, known: !!k.cy[c.def] }, { year: pyWord(c.d), hit: t.revPyHit, total: t.revPy, fmt: eur, known: !!k.py[c.def] }]} />
        </ChartBox>); } };
    }
    if (chart === "potential") {
      const title = (c: SCtx) => `Potential in companies ${verb(c)}, ${years(c)}${teamPart(c)}`;
      return { id, title, who: "all", draw: (c, a) => { const t = totalOf(c), k = c.d.read; return (
        <ChartBox title={title(c)} hint={`The yearly potential today of the ${baseWords(c)} - the part in those ${verb(c)} each year`} actions={a}>
          <SplitBars hitWord={`In companies ${verb(c)}`} restWord="In the others" rows={[
            { year: cyWord(c.d), hit: t.potCy, total: t.pot, fmt: eur, known: !!k.cy[c.def] }, { year: pyWord(c.d), hit: t.potPy, total: t.pot, fmt: eur, known: !!k.py[c.def] }]} />
        </ChartBox>); } };
    }
    if (chart === "years") {
      const title = (c: SCtx) => `Companies ${verb(c)} in ${c.d.year - 1}, ${c.d.year}, both or neither${teamPart(c)}`;
      return { id, title, who: "never", draw: (c, a) => (
        <ChartBox title={title(c)} hint={`Each of the ${int(totalOf(c).n)} ${baseWords(c)} once - Companies lists those in neither year`} actions={a}>
          <YearsBar c={c} s={totalOf(c)} />
        </ChartBox>) };
    }
    if (chart === "table") {
      const title = (c: SCtx) => `All the figures, ${baseWords(c)}${teamPart(c)}`;
      return { id, title, who: "all", draw: (c, a) => <ChartBox title={title(c)} hint={`${DEFS[c.def].label} · ${yearsWords(c.d)}`} actions={a}><OverviewTable c={c} /></ChartBox> };
    }
    return undefined;
  }
  if (v === "bases") {
    if (chart === "chart") {
      const title = (c: SCtx) => `Share of companies ${verb(c)}, by base${teamPart(c)}`;
      return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`The same ${DEFS[c.def].label.toLowerCase()} counted on each base - click one to count the whole page on it`} actions={a}><BaseBars c={c} /></ChartBox> };
    }
    if (chart === "table") {
      const title = (c: SCtx) => `All the figures, by base${teamPart(c)}`;
      return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={`${DEFS[c.def].label} · ${yearsWords(c.d)}`} actions={a}><BasesTable c={c} /></ChartBox> };
    }
    return undefined;
  }
  const dim = DIM_OF[v];
  if (chart === "figures") {
    const title = (c: SCtx) => `All the figures, by ${DIM[dim].lower}${teamPart(c)}`;
    return { id, title, who: "all", dim, draw: (c, a) => <ChartBox title={title(c)} hint={`${cap(baseWords(c, dim))} · ${DEFS[c.def].label.toLowerCase()} · ${yearsWords(c.d)}`} actions={a}><DimTable c={c} dim={dim} /></ChartBox> };
  }
  if (!isMeasure(chart)) return undefined;
  return { id, title: (c) => `${measureTitle(c, chart)}, by ${DIM[dim].lower}${teamPart(c)}`, who: chart === "rev" ? "rev" : chart === "never" ? "never" : "all", dim,
    draw: (c, a) => <Board c={c} id={id} dim={dim} m={chart} actions={a} /> };
}
/** A chart sent to the BUC View, by its tile key "<page>:<tab>:<chart>". */
const chartOf = (key: string) => { const [, view = "", chart = ""] = key.split(":"); return drawnOf(`${view}:${chart}`); };

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string) => React.ReactNode;
const draw = (c: SCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c))); };

function TabCard({ c, act }: { c: SCtx; act: Act }) {
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const words = `${cap(baseWords(c))} · ${DEFS[c.def].label.toLowerCase()} · ${yearsWords(c.d)}`;
  if (c.view === "overview") return (
    <GlassCard sx={card}>
      <CardTitle icon={<ConnectWithoutContactOutlinedIcon />} tint="blue" title={`${poss(teamName(c))} companies, ${verb(c)} or not`} note={words} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "overview:companies")}{draw(c, act, "overview:revenue")}</Box>
      <Box sx={TWO}>{draw(c, act, "overview:potential")}{draw(c, act, "overview:years")}</Box>
      {draw(c, act, "overview:table")}
    </GlassCard>
  );
  if (c.view === "bases") return (
    <GlassCard sx={card}>
      <CardTitle icon={<DonutLargeOutlinedIcon />} tint="blue" title={`Which of ${poss(teamName(c))} companies count`} note={`Every base side by side, ${DEFS[c.def].label.toLowerCase()} · ${yearsWords(c.d)}`} />
      <Box sx={{ mt: -1 }}>{draw(c, act, "bases:chart")}</Box>
      {draw(c, act, "bases:table")}
    </GlassCard>
  );
  if (!isDimView(c.view)) return null;
  const dim = DIM_OF[c.view], dd = DIM[dim];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={dd.icon} tint={dd.tint} title={`${poss(teamName(c))} companies by ${dd.lower}`} note={`${dd.note} · ${cap(baseWords(c, dim))} · ${DEFS[c.def].label.toLowerCase()} · ${yearsWords(c.d)}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, `${c.view}:reach`)}{draw(c, act, `${c.view}:rev`)}</Box>
      <Box sx={TWO}>{draw(c, act, `${c.view}:pot`)}{draw(c, act, `${c.view}:never`)}</Box>
      {draw(c, act, `${c.view}:figures`)}
    </GlassCard>
  );
}
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures top right: four shares of the same companies ──────────── */

type Fig = { id: string; label: string; value: string; change: { text: string; color: string }; sub: string; icon: React.ReactNode; tint: Tint };
function figuresOf(c: SCtx): Fig[] {
  const t = totalOf(c), x = shares(c, t), v = verb(c), py = c.d.year - 1;
  const vs = (p: { cy: number | null; py: number | null }) => { const z = ptsOf(p.cy, p.py); return { text: z.text === "—" ? "—" : `${z.text} on ${py}`, color: z.color }; };
  return [
    { id: "fig-reach", label: `Companies ${v}`, value: pct(x.reach.cy), change: vs(x.reach), sub: `${int(t.cy)} of ${int(t.n)} ${baseWords(c)}`, icon: <ConnectWithoutContactOutlinedIcon />, tint: "blue" },
    { id: "fig-rev", label: "Their share of the revenue", value: pct(x.rev.cy), change: vs(x.rev), sub: `${eur(t.revCyHit)} of ${eur(t.revCy)} this year`, icon: <EuroOutlinedIcon />, tint: "green" },
    { id: "fig-pot", label: "Their share of the potential", value: pct(x.pot.cy), change: vs(x.pot), sub: `${eur(t.potCy)} of ${eur(t.pot)}`, icon: <SavingsOutlinedIcon />, tint: "purple" },
    { id: "fig-never", label: `Not ${v} in ${py} or ${c.d.year}`, value: pct(x.never), change: { text: x.never == null ? "—" : `${int(t.never)} companies`, color: MUTED }, sub: `${eur(t.potNever)} potential`, icon: <PersonOffOutlinedIcon />, tint: "pink" },
  ];
}
function FigureCards({ items, actions }: { items: Fig[]; actions?: (f: Fig) => React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(132px, 1fr))" }, minWidth: 0 }}>
      {items.map((f) => (
        <Box key={f.id} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={f.icon} tint={f.tint} size={22} />
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
            {actions?.(f)}
          </Box>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: f.change.color, lineHeight: 1.3 }}>{f.change.text}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{f.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── the Filters window: the activity, the base and the breakdowns ─────── */

/** One choice of a few, each with a line saying what it is. */
function Choice<T extends string | number>({ items, on, onPick }: { items: { id: T; label: string; note: string }[]; on: T; onPick: (id: T) => void }) {
  const t = TINT.blue;
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {items.map((x) => {
        const sel = x.id === on;
        return (
          <Box key={String(x.id)} component="button" type="button" onClick={() => onPick(x.id)} aria-pressed={sel}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr)", alignItems: "start", gap: 0.75, px: 1, py: 0.6, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: sel ? t.bg : "transparent", "&:hover": { bgcolor: sel ? t.bg : "rgba(21,34,58,.04)" } }}>
            {sel ? <CheckIcon sx={{ fontSize: 16, color: t.fg, mt: 0.2 }} /> : <span />}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: sel ? 700 : 500, color: INK }}>{x.label}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.35 }}>{x.note}</Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
function SFacet({ c, dim, onPick }: { c: SCtx; dim: SDim; onPick: (l: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const by = statsOf(c, dim, true, c.base);
  const rank = ranked(dim);
  const rows = [...by].map(([label, s]) => ({ label, n: s.n }));
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
          <Box key={r.label} component="button" type="button" onClick={() => onPick(r.label)} aria-pressed={on} title={`${r.label}: ${int(r.n)} companies`}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 70px 58px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? t.bg : "transparent", "&:hover": { bgcolor: on ? t.bg : "rgba(21,34,58,.04)" } }}>
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
const FILTER_DIMS: SDim[] = ["person", "prio", "category", "country"];
type Focus = SDim | "def" | "base";
function SFilterWindow({ c, open, onClose, focus, onDef, onBase, toggle, clearAll }: {
  c: SCtx; open: boolean; onClose: () => void; focus: { dim: Focus; n: number } | null; onDef: (i: number) => void; onBase: (b: BaseId) => void; toggle: (d: SDim, l: string) => void; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<Focus, boolean>>>({});
  const isOpen = (k: Focus) => (shut[k] !== undefined ? !shut[k] : k === "def" || k === "base" || !!c.filters[k as SDim]?.length);
  const [live, setLive] = useState(open);
  useEffect(() => { if (open) { setLive(true); return; } const t = setTimeout(() => setLive(false), 320); return () => clearTimeout(t); }, [open]);
  useEffect(() => {
    if (!focus) return;
    setShut((s) => ({ ...s, [focus.dim]: false }));
    const t = setTimeout(() => document.getElementById(`sfilter-${focus.dim}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    return () => clearTimeout(t);
  }, [focus]);
  const chosen = FILTER_DIMS.flatMap((d) => (c.filters[d] ?? []).map((v) => [d, v] as const));
  return (
    <FilterPanel id="sales-activity-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "What counts as contact, which companies count - then values to show only them"}
      onClearAll={chosen.length || c.def || c.base !== "prio12" ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, v]) => <Chip key={`${d}:${v}`} size="small" label={<span><b>{DIM[d].name}:</b> {v}</span>} onDelete={() => toggle(d, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          <FilterSection id="sfilter-def" index={0} title="Sales activity" icon={<PhoneInTalkOutlinedIcon />} tint="blue" open={isOpen("def")} onFlip={() => setShut((s) => ({ ...s, def: isOpen("def") }))} summary={DEFS[c.def].label} chosen={c.def !== 0}>
            <Choice items={DEFS.map((x, i) => ({ id: i, label: x.label, note: `${cap(x.note)} in the year` }))} on={c.def} onPick={onDef} />
          </FilterSection>
          <FilterSection id="sfilter-base" index={1} title="Which companies count" icon={<DonutLargeOutlinedIcon />} tint="blue" open={isOpen("base")} onFlip={() => setShut((s) => ({ ...s, base: isOpen("base") }))} summary={baseWord(c)} chosen={c.base !== "prio12"}>
            <Choice items={BASES.map((b) => ({ id: b.id, label: b.label, note: cap(b.note) }))} on={c.base} onPick={onBase} />
          </FilterSection>
          {FILTER_DIMS.map((dim, i) => (
            <FilterSection key={dim} id={`sfilter-${dim}`} index={i + 2} title={DIM[dim].name} icon={DIM[dim].icon} tint={DIM[dim].tint} open={isOpen(dim)} onFlip={() => setShut((s) => ({ ...s, [dim]: isOpen(dim) }))}
              summary={!c.filters[dim]?.length ? "All" : c.filters[dim]!.length === 1 ? c.filters[dim]![0] : `${c.filters[dim]!.length} chosen`} chosen={!!c.filters[dim]?.length}>
              <SFacet c={c} dim={dim} onPick={(l) => toggle(dim, l)} />
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
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The companies could not be read: ${error}` : `Reading every company in HubSpot and its Sales Activity flags${progress ? ` · ${progress}` : ""}…`}</Typography>
      </Box>
    </GlassCard>
  );
}

export function SalesActivityExplorer({ home = "eso" }: { home?: Home }) {
  // its charts to the BUC View of the reports it is in: "eso-sales-activity:…", or "tsa-sales-activity:…" on TSA Reports
  const PAGE = `${home}-sales-activity`;
  const params = useSearchParams();
  const { d, computing, progress, error } = useSalesActivity();
  const [team, setTeam] = useTeam(home);
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  const { state: acts } = useActions(PAGE);
  const view: SView = isView(params.get("view")) ? (params.get("view") as SView) : "overview";
  const setView = (v: SView) => setQuery((q) => { if (v === "overview") q.delete("view"); else q.set("view", v); });
  const def = defOf(params.get("def")), base = baseOf(params.get("base"));
  const setDef = (i: number) => setQuery((q) => { if (i === 0) q.delete("def"); else q.set("def", DEFS[i].id); });
  const setBase = (b: BaseId) => setQuery((q) => { if (b === "prio12") q.delete("base"); else q.set("base", b); });
  const filters: SFilters = useMemo(() => Object.fromEntries(FILTER_DIMS.flatMap((k) => (params.getAll(k).length ? [[k, params.getAll(k)]] : []))), [params]);
  const toggle = (k: SDim, label: string) => setQuery((q) => { const cur = q.getAll(k), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]; q.delete(k); for (const x of next) q.append(k, x); });
  const clearAll = () => setQuery((q) => { for (const k of FILTER_DIMS) q.delete(k); q.delete("def"); q.delete("base"); });
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: Focus; n: number } | null>(null);
  const openOn = (k: Focus) => { setFocus((f) => ({ dim: k, n: (f?.n ?? 0) + 1 })); setPanel(true); };

  // the work a click asks for, kept; the tabs and toggles answer at once and the charts follow (as the Figures)
  const lead = leadOf(team, leadKey, lt);
  const people = useMemo(() => (d ? peopleOf(d, team, lead, lt?.byName ?? {}) : null), [d, team, lead, lt]);
  const want = useMemo(() => ({ view, def, base, people, team, lead, filters }), [view, def, base, people, team, lead, filters]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<SCtx | null>(() => (d ? {
    d, def: drawn.def, base: drawn.base, team: drawn.team, lead: drawn.lead, teams, people: drawn.people, filters: drawn.filters, view: drawn.view,
    onBar: (k, l) => { toggle(k, l); openOn(k); }, onFilter: openOn, onBase: setBase,
  } : null), [d, drawn, teams]); // eslint-disable-line react-hooks/exhaustive-deps
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);

  const scoped = useScoped();
  const back = scoped ? null : (
    <Box component={Link} href={`/reporting/${home}-benchmark`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
      <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
    </Box>
  );
  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  if (!d || !c) return (<Box sx={shell}>{back}<Typography component="h1" sx={H1}>Sales activity</Typography><Waiting computing={computing} progress={progress} error={error} /></Box>);

  const act: Act = (id, title) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `${PAGE}:${id}`, page: PAGE, tab: c.view, title, summary: `${teamName(c)} · ${baseWord(c)} · ${DEFS[c.def].label}`,
        filters: { ...Object.fromEntries(FILTER_DIMS.filter((k) => c.filters[k]?.length).map((k) => [k, c.filters[k] ?? []])), team: [c.team], ...(c.lead ? { lead: [c.lead] } : {}), def: [DEFS[c.def].id], base: [c.base] },
        kind: "card" }} />
  );
  const now = { team, lead, teams };
  const chosen = FILTER_DIMS.flatMap((k) => (filters[k] ?? []).map((v) => [k, v] as const));
  const steering = chosen.length + (def ? 1 : 0) + (base !== "prio12" ? 1 : 0);
  return (
    <Box sx={shell}>
      {back}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>Sales activity</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamName(now)}</b> · <b style={{ color: INK }}>{baseWord(c, base)}</b> · {DEFS[def].label.toLowerCase()}{computing ? " · reading HubSpot again" : ""}
          </Typography>
          {!d.read.cy[def] && <Typography sx={{ fontSize: "0.8rem", color: RED }}>HubSpot has no flag &quot;Sales Activity in {d.year}&quot; for {DEFS[def].label.toLowerCase()} yet - this year stays empty until it is set up.</Typography>}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" }, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }}><FigureCards items={figs} /></Box>
      </Box>
      <Box sx={{ display: "grid", gap: 0.75, mt: -0.5 }}>
        <Teams team={team} onTeam={setTeam} lead={leadKey} onLead={setLead} teams={teams} />
        {lead && people && people.size === 0 && <NoLeadYet name={teamName(now)} />}
      </Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="sales-activity" tab={view} onSelect={setView} tabs={VIEWS.map((v) => ({ id: v.id, label: v.label, count: isDimView(v.id) && filters[DIM_OF[v.id]]?.length ? String(filters[DIM_OF[v.id]]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        {/* the page's own key: saving a view is allowed by the report it maps to (src/lib/auth/tree.ts reportPathOfPage) */}
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page={PAGE} /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else openOn(isDimView(view) ? DIM_OF[view] : view === "bases" ? "base" : "def"); }} variant={panel || steering ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="sales-activity-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || steering ? undefined : "#fff" }}>
          Filters{steering ? ` · ${steering}` : ""}
        </Button>
      </Box>
      <ActiveFilters onEdit={() => setPanel(true)} onClearAll={clearAll} items={[
        ...(def ? [{ key: "def", name: "Sales activity", value: DEFS[def].label, tint: "blue" as Tint, onRemove: () => setDef(0) }] : []),
        ...(base !== "prio12" ? [{ key: "base", name: "Which companies count", value: baseWord(c, base), tint: "blue" as Tint, onRemove: () => setBase("prio12") }] : []),
        ...chosen.map(([k, v]): ActiveItem => ({ key: `${k}:${v}`, name: DIM[k].name, value: v, tint: DIM[k].tint, onRemove: () => toggle(k, v) })),
      ]} />
      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.def}-${c.base}`} c={c} act={act} />
      </Box>
      <SFilterWindow c={c} open={panel} onClose={() => setPanel(false)} focus={focus} onDef={setDef} onBase={setBase} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's Sales activity panel ───────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;

/** Sales activity in the BUC View: the four figures for the team the toggle shows (Prio 1 + 2, calls and visits), and the
 *  charts sent here from the page with Actions - each with the activity, base and filters it was sent with. */
export function SalesActivityPanel({ acts, home = "eso" }: { acts: ActionsState | null; home?: Home }) {
  // ESO's BUC View or TSA's: the page's charts are keyed by the reports they were sent from
  const PAGE = `${home}-sales-activity`, PANEL = `${PAGE}:panel:`, href0 = `/reporting/${home}-benchmark/sales-activity`;
  const { d, computing, progress, error } = useSalesActivity();
  const [team, setTeam] = useState<TeamKey>(home);
  const [leadKey, setLeadKey] = useState<LeadKey>("all");
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  useEffect(() => { if (home === "tsa") return; try { const x = asTeam(localStorage.getItem(KEPT)); if (x) setTeam(x); const l = asLead(localStorage.getItem(KEPT_LEAD)); if (l) setLeadKey(l); } catch { /* ESO */ } }, [home]);
  const choose = (t: TeamKey) => { setTeam(t); if (home === "eso") try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const chooseLead = (l: LeadKey) => { setLeadKey(l); try { localStorage.setItem(KEPT_LEAD, l); } catch { /* here only */ } };
  const lead = leadOf(team, leadKey, lt);
  const want = useMemo(() => ({ team, lead }), [team, lead]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<SCtx | null>(() => (d ? { d, def: 0, base: "prio12", team: drawn.team, lead: drawn.lead, teams, people: peopleOf(d, drawn.team, drawn.lead, lt?.byName ?? {}), filters: {}, view: "overview" } : null),
    [d, drawn, teams, lt]);
  const items: SortItem[] = useMemo(() => !c ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === PAGE && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const ch = chartOf(spec.key);
    const fmt = formatOf(acts, spec);
    const f = spec.filters ?? {};
    // every chart here follows the panel's toggle (as the Figures' panel); its activity, base and filters stay as sent
    const sc: SCtx = { ...c, filters: Object.fromEntries(FILTER_DIMS.flatMap((k) => (f[k]?.length ? [[k, f[k]]] : []))), def: defOf(f.def?.[0]), base: baseOf(f.base?.[0]), view: spec.tab && isView(spec.tab) ? spec.tab : "overview" };
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<ConnectWithoutContactOutlinedIcon />} tint="blue" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [c, acts]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: `nutshell:${PAGE}`, keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);
  const shown = (id: string) => placementOf(acts, `${PANEL}${id}`, "nutshell") === "nutshell";
  const href = `${href0}?team=${drawn.team}${drawn.lead ? `&lead=${drawn.lead}` : ""}`;
  const own = (id: string, title: string) => (
    <TileActions where="nutshell" start="nutshell" edge={1.5} tile={{ key: `${PANEL}${id}`, page: PAGE, tab: "overview", title: `${title} - ${c ? teamName(c) : teamWord(home)}`, kind: "kpi",
      filters: { team: [drawn.team], ...(drawn.lead ? { lead: [drawn.lead] } : {}) }, href }} />
  );
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<ConnectWithoutContactOutlinedIcon />} tint="blue" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`${href0}?team=${team}${lead ? `&lead=${lead}` : ""}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.blue.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Sales activity</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.blue.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName({ team, lead, teams })} · Prio 1 + 2 companies · calls and visits · ${yearsWords(c.d)}` : "Prio 1 + 2 companies · calls and visits"}</Typography>
        </Box>
        <Teams team={team} onTeam={choose} lead={leadKey} onLead={chooseLead} teams={teams} />
      </Box>
      {!c ? <Waiting computing={computing} progress={progress} error={error} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          <FigureCards items={figs.filter((f) => shown(f.id))} actions={(f) => own(f.id, f.label)} />
          {items.length > 0 ? <SortableGrid items={items} order={acts?.orders?.[`nutshell:${PAGE}`]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} /> : <BucEmpty page="Sales activity" href={href0} />}
        </Box>
      )}
    </GlassCard>
  );
}

"use client";
// THE ESO SHOP BEHAVIOUR PAGE, rebuilt like the Figures and the Visits (SARCLA 29.10.2026: "rebuild like Figures/Visits";
// his picks: logins, views, logged in & bought - bought = ordered in the shop; the live counters since 2 Oct with the
// Performis years beside them). What the old page did wrong: its "this year" was the Performis export loaded once on
// 15 Apr 2026 - 1 January to mid-April, shown as this year so far against last year whole; ESO only; no period; bought =
// any ERP revenue. Now a period is either the smart bar's live counters (day by day since 2 Oct 2026, against the same
// number of days right before) or a Performis year (against the year before) - never both on one chart; ESO | TSA |
// Total and the line managers' teams; leaderboards with targets. The rows and their rules: src/lib/reporting/shopRules.ts.

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
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
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
import {
  blank, dayOf, dayWords, labelOf, liveSeries, passOf, presetsOf, shortDays, statsBy, totalsOf, yearSeries,
  type SDim, type SFilters, type SPer, type SStats, type SWin, type Series, type ShopData,
} from "@/lib/reporting/shopRules";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  ChartBox, FullTable, H1, KEPT, KEPT_LEAD, Leaderboard, NoLeadYet, SubTitle, TARGET, TWO, Teams, asLead, asTeam, axisWidth, leadOf, niceTop, setQuery, useLead, useLeads, useTeam,
  type BoardRow, type Col, type LeadKey, type TeamKey,
} from "./Figures";

/* ── the read ──────────────────────────────────────────────────────────── */

function useShop(): { d: ShopData | null; computing: boolean; progress?: string; error?: string } {
  const [st, setSt] = useState<{ state?: SlowState<ShopData>; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-shop").then((r) => r.json())
      .then((j: { state?: SlowState<ShopData>; error?: string }) => {
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
const one = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const signedInt = (n: number) => `${Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? "−" : "±"}${Math.abs(Math.round(n)).toLocaleString("en")}`;
const signedOne = (n: number) => `${n > 0.05 ? "+" : n < -0.05 ? "−" : "±"}${Math.abs(n).toFixed(1)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
/** A share or an average ranks a person or a group from this many companies that logged in. */
const MIN_COMPANIES = 10;
/** Article views, beside the logins */
const VIEWS = "#eb6834";

/* ── the period ────────────────────────────────────────────────────────── */

const DEFAULT_PER = "28d";
const perCap = (p: SPer) => p.title.charAt(0).toUpperCase() + p.title.slice(1);
const isLive = (w: SWin): w is Extract<SWin, { kind: "live" }> => w.kind === "live";
/** "2 – 28 Oct 2026", "28 Sep – 4 Oct 2026", "1 Jan – 15 Apr 2026", "1 Jan – 31 Dec 2025" */
function winWords(d: ShopData, w: SWin, partial = false): string {
  if (w.kind === "year") {
    const y = d.dtYears[w.y];
    return partial && d.dtLoaded ? `1 Jan – ${dayWords(d.dtLoaded)}` : `1 Jan – 31 Dec ${y}`;
  }
  const a = dayOf(d.liveFrom, w.from), b = dayOf(d.liveFrom, w.to);
  const tail = b === d.today ? " (today so far)" : "";
  if (a === b) return `${dayWords(a)}${tail}`;
  const sameYear = a.slice(0, 4) === b.slice(0, 4), sameMonth = sameYear && a.slice(5, 7) === b.slice(5, 7);
  const left = sameMonth ? String(Number(a.slice(8, 10))) : sameYear ? dayWords(a).replace(/ \d{4}$/, "") : dayWords(a);
  return `${left} – ${dayWords(b)}${tail}`;
}
const perWords = (d: ShopData, p: SPer) => winWords(d, p.win, p.partial);
/** "the 7 days before (15 – 21 Oct 2026)", "2024" */
const prevWords = (d: ShopData, p: SPer) => (!p.prev ? "" : p.prev.kind === "year" ? String(d.dtYears[p.prev.y]) : winWords(d, p.prev));
const sourceWords = (p: SPer) => (isLive(p.win) ? "the smart bar's live counters" : "the Performis export (E-Shop Data Tracker)");

/* ── the teams: ESO | TSA | Total by the company's owner, and under ESO the line managers' teams ── */

const peopleOf = (d: ShopData, team: TeamKey, lead: string | null, byId: Record<string, string>) => (team === "total" ? null : new Set(d.people.flatMap((p, i) => (
  p.team === (team === "eso" ? "ESO" : "TSA") && (team !== "eso" || !lead || byId[p.id] === lead) ? [i] : []
))));
const teamName = (c: { team: TeamKey; lead: string | null; teams: Team[] }) => (c.team === "eso" ? (c.lead ? c.teams.find((t) => t.id === c.lead)?.name ?? c.lead : "ESO") : c.team === "tsa" ? "TSA" : "APSOparts");

/* ── what every chart is drawn with ────────────────────────────────────── */

type SView = "people" | "activity" | "category" | "prio" | "country";
const VIEWS_TABS: { id: SView; label: string }[] = [
  { id: "people", label: "People" }, { id: "activity", label: "Logins & views" },
  { id: "category", label: "Customer category" }, { id: "prio", label: "Priority" }, { id: "country", label: "Country" },
];
const isView = (x: string | null): x is SView => VIEWS_TABS.some((v) => v.id === x);
const DIM_OF: Record<SView, SDim> = { people: "person", activity: "person", category: "category", prio: "prio", country: "country" };
const DIM: Record<SDim, { name: string; lower: string; icon: React.ReactNode; tint: Tint; note: string }> = {
  person: { name: "Company owner", lower: "company owner", icon: <BadgeOutlinedIcon />, tint: "green", note: "Whose customers they are - the company's owner in HubSpot" },
  prio: { name: "Priority", lower: "priority", icon: <FlagOutlinedIcon />, tint: "purple", note: "The company's priority: Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500" },
  category: { name: "Customer category", lower: "customer category", icon: <CategoryOutlinedIcon />, tint: "blue", note: "The company's APSO customer category - Other: APSOlost, APSOmicro, Growth Engine and not set" },
  country: { name: "Country", lower: "country", icon: <PublicOutlinedIcon />, tint: "blue", note: "Where the company is" },
};
const ORDER: Partial<Record<SDim, readonly string[]>> = { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOgrowth", "APSOprospect", "Other"] };

export type ShCtx = {
  d: ShopData; per: SPer; team: TeamKey; lead: string | null; teams: Team[];
  /** the company owners shown (indexes); null: every company */
  people: Set<number> | null; filters: SFilters; view: SView;
  half?: boolean; targets?: Record<string, number>;
  onBar?: (dim: SDim, label: string) => void; onFilter?: (dim: SDim) => void;
};

const statCache = new WeakMap<ShCtx, Map<string, Map<string, SStats>>>();
/** The figures of the period - or of the one before it - by a breakdown (its own filter left out), or all together. */
function statsOf(c: ShCtx, dim?: SDim, before = false): Map<string, SStats> {
  let memo = statCache.get(c);
  if (!memo) { memo = new Map(); statCache.set(c, memo); }
  const k = `${before ? "p" : "c"}|${dim ?? ""}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const w = before ? c.per.prev : c.per.win;
  const out = !w ? new Map<string, SStats>() : statsBy(c.d, totalsOf(c.d, w), passOf(c.d, c.filters, c.people, dim), dim ? (co) => labelOf(c.d, co, dim) : undefined);
  memo.set(k, out);
  return out;
}
const totalOf = (c: ShCtx, before = false) => statsOf(c, undefined, before).get("") ?? blank();
const seriesCache = new WeakMap<ShCtx, Series>();
/** The period day by day (month by month past two months), or every Performis year - under the team and the filters. */
function seriesOf(c: ShCtx): Series {
  const hit = seriesCache.get(c);
  if (hit) return hit;
  const pass = passOf(c.d, c.filters, c.people);
  const s = isLive(c.per.win) ? liveSeries(c.d, c.per.win, pass) : yearSeries(c.d, pass);
  seriesCache.set(c, s);
  return s;
}

/** A chart's target, one per chart, team and period: "eso-shop:people:loggedin@eso-RABE~7d" (the default period without "~"). */
const targetKey = (id: string, team: TeamKey, lead: string | null, per: SPer) => `eso-shop:${id}@${team}${team === "eso" && lead ? `-${lead}` : ""}${/:days$/.test(id) || per.id === DEFAULT_PER ? "" : `~${per.id}`}`;
const targetFor = (c: ShCtx, id: string) => { const t = c.targets?.[targetKey(id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/* ── the leaderboards ──────────────────────────────────────────────────── */

type Measure = "loggedin" | "logins" | "views" | "ordered" | "share" | "depth" | "noview";
const MEASURE: Record<Measure, { title: string; fmt: (n: number) => string; unit: "n" | "pct"; target: string }> = {
  loggedin: { title: "Companies that logged in", fmt: int, unit: "n", target: "companies that logged in" },
  logins: { title: "Logins", fmt: int, unit: "n", target: "logins" },
  views: { title: "Article views", fmt: int, unit: "n", target: "article views" },
  ordered: { title: "Logged in and ordered in the shop", fmt: int, unit: "n", target: "companies that logged in and ordered in the shop" },
  share: { title: "Share that ordered in the shop", fmt: (n) => pct(n), unit: "pct", target: "share of the companies that logged in that ordered in the shop" },
  depth: { title: "Article views per login", fmt: one, unit: "n", target: "article views per login" },
  noview: { title: "Logged in, viewed no article", fmt: int, unit: "n", target: "companies that logged in and viewed no article" },
};
/** A measure of a group's figures; and whether the group has enough behind it to be ranked on it. */
function valueOf(m: Measure, s: SStats): { v: number; ranked: boolean } {
  if (m === "loggedin") return { v: s.companies, ranked: true };
  if (m === "logins") return { v: s.logins, ranked: true };
  if (m === "views") return { v: s.views, ranked: true };
  if (m === "ordered") return { v: s.ordered, ranked: true };
  if (m === "noview") return { v: s.noView, ranked: true };
  if (m === "share") return { v: s.companies ? s.ordered / s.companies : 0, ranked: s.companies >= MIN_COMPANIES };
  return { v: s.logins ? s.views / s.logins : 0, ranked: s.companies >= MIN_COMPANIES };
}
function subOf(m: Measure, s: SStats, t: SStats, dim: SDim): string {
  if (m === "loggedin") return dim === "person" ? `${int(s.logins)} logins · ${int(s.views)} article views` : `${pct(t.companies ? s.companies / t.companies : null)} of the companies · ${int(s.logins)} logins`;
  if (m === "logins") return `${int(s.companies)} companies · ${one(s.companies ? s.logins / s.companies : NaN)} per company`;
  if (m === "views") return `${one(s.logins ? s.views / s.logins : NaN)} per login · ${int(s.companies)} companies`;
  if (m === "ordered" || m === "share") return `${int(s.ordered)} of the ${int(s.companies)} that logged in`;
  if (m === "noview") return `${pct(s.companies ? s.noView / s.companies : null)} of the ${int(s.companies)} that logged in`;
  return `${int(s.views)} views over ${int(s.logins)} logins`;
}
function boardRows(c: ShCtx, dim: SDim, m: Measure): { rows: BoardRow[]; small: BoardRow[] } {
  const by = statsOf(c, dim), before = statsOf(c, dim, true);
  const t = totalOf(c);
  const rows: BoardRow[] = [], small: BoardRow[] = [];
  for (const [label, s] of by) {
    const { v, ranked } = valueOf(m, s);
    if (!v && m !== "share") continue;
    const p = before.get(label);
    (ranked ? rows : small).push({ label, cur: v, prev: p ? valueOf(m, p).v : 0, sub: subOf(m, s, t, dim) });
  }
  return { rows, small };
}
function Board({ c, id, dim, m, actions }: { c: ShCtx; id: string; dim: SDim; m: Measure; actions?: React.ReactNode }) {
  const { rows, small } = boardRows(c, dim, m);
  const M = MEASURE[m];
  // a rise in "viewed no article" is not good news - shown without a change rather than in the wrong colour
  const noChange = !c.per.prev || m === "noview";
  return (
    <Leaderboard key={`${id}-${c.per.id}`} title={`${M.title}, ${c.per.title}, by ${DIM[dim].lower}`} rows={rows} noChange={noChange}
      curLabel={perWords(c.d, c.per)} prevLabel={prevWords(c.d, c.per)} first={c.half ? 8 : 12} fmt={M.fmt} ratio={m === "share"} diff={m === "depth" ? signedOne : signedInt} target={targetFor(c, id)}
      unranked={small.length ? { why: `under ${MIN_COMPANIES} companies that logged in`, rows: small } : undefined}
      selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={`Filter by ${DIM[dim].lower}`} actions={actions} />
  );
}

/* ── the series: day by day (live) or year by year (Performis), columns with the target's line across ── */

/** "Mo 5" (a day), "Oct" (a month), "2025" (a year) */
function bucketWords(k: string): { top: string; weekend: boolean } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) { const wd = new Date(`${k}T00:00:00Z`).getUTCDay(); return { top: `${WEEKDAY[wd]} ${Number(k.slice(8, 10))}`, weekend: wd === 0 || wd === 6 }; }
  if (/^\d{4}-\d{2}$/.test(k)) return { top: MONTHS[Number(k.slice(5, 7)) - 1], weekend: false };
  return { top: k, weekend: false };
}
function SeriesColumns({ c, which, target }: { c: ShCtx; which: "companies" | "activity"; target: number | null }) {
  const s = seriesOf(c);
  const live = isLive(c.per.win);
  const sel = !live && c.per.win.kind === "year" ? String(c.d.dtYears[c.per.win.y]) : null;
  const bars = which === "companies" ? [{ name: "Companies that logged in", v: s.companies, color: THIS }] : [{ name: "Logins", v: s.logins, color: THIS }, { name: "Article views", v: s.views, color: VIEWS }];
  const top = niceTop(Math.max(1, target ?? 0, ...bars.flatMap((b) => b.v)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const running = (k: string) => k === c.d.today || (k.length === 7 && c.d.today.startsWith(k)) || (!!c.d.dtLoaded && k === c.d.dtLoaded.slice(0, 4));
  const done = s.keys.filter((k) => !running(k)).map((k) => s.companies[s.keys.indexOf(k)]);
  const reached = target ? done.filter((v) => v >= target).length : 0;
  const dense = s.keys.length > 16;
  // a weekday far below the others: a gap in the recording or a holiday - marked, so no one reads a drop into it
  const short = live ? shortDays(s) : new Set<string>();
  const SHORT = "far below the other weekdays - a gap in the recording or a holiday";
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        {bars.map((b) => <Box key={b.name} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}><Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: b.color }} />{b.name}</Box>)}
        {target && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: INK, fontWeight: 600 }}><Box component="span" sx={{ width: 14, borderTop: `2px dashed ${TARGET}` }} />Target {int(target)} · <span style={{ color: reached === done.length ? GREEN : RED }}>{reached} of {done.length} reached it</span></Box>}
        {short.size > 0 && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: TINT.amber.fg, fontWeight: 600 }}><Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: TINT.amber.fg }} />{[...short].map((k) => dayWords(k).replace(/ \d{4}$/, "")).join(", ")}: {SHORT}</Box>}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: Math.max(28, axisWidth(top) - 40) }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{int(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 160, maxHeight: 340 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          {target != null && <Box sx={{ position: "absolute", left: 0, right: 0, bottom: `${(target / top) * 100}%`, borderTop: `2px dashed ${TARGET}`, zIndex: 1, pointerEvents: "none" }} />}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {s.keys.map((k, i) => {
              const w = bucketWords(k), run = running(k);
              const tip = `${k}${run ? (live ? " (to date)" : " (until the export)") : ""}: ${int(s.companies[i])} companies logged in · ${int(s.logins[i])} logins · ${int(s.views[i])} article views · ${int(s.ordered[i])} ordered in the shop${target ? ` · ${pct(s.companies[i] / target)} of the target` : ""}${short.has(k) ? ` · ${SHORT}` : ""}`;
              return (
                <Box key={k} title={tip} sx={{ flex: 1, position: "relative", height: "100%", "&:hover": { bgcolor: "rgba(21,34,58,.035)" }, borderRadius: "6px", bgcolor: sel === k ? "rgba(45,111,168,.06)" : undefined }}>
                  <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: bars.length > 1 ? "70%" : "52%", maxWidth: bars.length > 1 ? 40 : 30, height: "100%", display: "flex", alignItems: "flex-end", gap: "2px" }}>
                    {bars.map((b) => <Box key={b.name} sx={{ flex: 1, height: `${(b.v[i] / top) * 100}%`, bgcolor: short.has(k) ? TINT.amber.fg : b.color, opacity: run || w.weekend ? 0.5 : 1, borderRadius: "3px 3px 0 0" }} />)}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box />
        <Box sx={{ display: "flex" }}>
          {s.keys.map((k, i) => {
            const w = bucketWords(k);
            return (
              <Box key={k} sx={{ flex: 1, textAlign: "center", pt: 0.5, minWidth: 0 }}>
                <Typography sx={{ fontSize: dense ? "0.62rem" : "0.74rem", color: short.has(k) ? TINT.amber.fg : w.weekend ? FAINT : MUTED, fontWeight: short.has(k) ? 700 : 400, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden" }}>{dense ? w.top.split(" ").pop() : w.top}</Typography>
                {!dense && <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{int(bars[0].v[i])}</Typography>}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

/* ── every chart by its key ────────────────────────────────────────────── */

type TargetOf = { unit: "eur" | "pct" | "n"; label: string };
type Drawn = { id: string; title: (c: ShCtx) => string; draw: (c: ShCtx, actions?: React.ReactNode) => React.ReactNode; target?: (c: ShCtx) => TargetOf };
const teamPart = (c: ShCtx) => ` - ${teamName(c)}`;
const forWhom = (c: ShCtx) => `${teamName(c)}'s target for ${c.per.title} - each team and period its own`;
const stepWords = (c: ShCtx) => (!isLive(c.per.win) ? "year by year" : seriesOf(c).keys[0]?.length === 7 ? "month by month" : "day by day");
/** A chart by its id "<tab>:<what>[-<breakdown>]": people:loggedin, people:days, activity:views, prio:share… */
function drawnOf(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  if (chart === "days") {
    const which = v === "activity" ? "activity" : "companies";
    const title = (c: ShCtx) => `${which === "activity" ? "Logins and article views" : "Companies that logged in"}, ${stepWords(c)}${teamPart(c)}`;
    const hint = (c: ShCtx) => (isLive(c.per.win)
      ? `${perWords(c.d, c.per)} · ${sourceWords(c.per)} · weekends and the running day lighter`
      : `Every year of ${sourceWords(c.per)}${c.d.dtLoaded ? ` · ${c.d.dtLoaded.slice(0, 4)} until the export of ${dayWords(c.d.dtLoaded)}, lighter` : ""}`);
    return { id, title, draw: (c, a) => <ChartBox title={title(c)} hint={hint(c)} actions={a}><SeriesColumns c={c} which={which} target={which === "companies" ? targetFor(c, id) : null} /></ChartBox>,
      ...(which === "companies" ? { target: (c: ShCtx) => ({ unit: "n" as const, label: `Each ${isLive(c.per.win) ? "day's" : "year's"} companies that logged in are measured against it - a line across the columns; the running one is not counted · ${teamName(c)}'s target.` }) } : {}) };
  }
  const [what, by] = chart.split("-");
  if (!(what in MEASURE)) return undefined;
  const m = what as Measure;
  const dim: SDim = by && (by in DIM) ? (by as SDim) : DIM_OF[v];
  return { id, title: (c) => `${MEASURE[m].title}, ${c.per.title}, by ${DIM[dim].lower}${teamPart(c)}`, draw: (c, a) => <Board c={c} id={id} dim={dim} m={m} actions={a} />,
    target: (c) => ({ unit: MEASURE[m].unit, label: `Each ${DIM[dim].lower}'s ${MEASURE[m].target}, ${c.per.title}, is measured against it · ${forWhom(c)}.` }) };
}
/** The old page's charts, still in some BUC Views, by what took their place ("orders ever" is gone with the old page). */
function chartOf(key: string): Drawn | undefined {
  const [, view = "", chart = ""] = key.split(":");
  const old: Record<string, string> = { "reps:loggedin": "people:loggedin", "reps:bought": "people:ordered", "category:category": "category:loggedin", "activity:activity": "activity:days" };
  return drawnOf(old[`${view}:${chart}`] ?? `${view}:${chart}`);
}

/* ── the tables ────────────────────────────────────────────────────────── */

type Row = SStats & { label: string; before?: number };
function DimTable({ c, dim }: { c: ShCtx; dim: SDim }) {
  const by = statsOf(c, dim), was = statsOf(c, dim, true);
  const t = totalOf(c);
  const order = ORDER[dim];
  const rows: Row[] = [...by].map(([label, s]) => ({ label, ...s, before: was.get(label)?.companies ?? 0 }));
  const cols: Col<Row>[] = [
    { key: "companies", head: "Logged in", tip: "Companies that logged in in the period", cell: (r) => int(r.companies), sort: (r) => r.companies },
    ...(c.per.prev ? [{ key: "before", head: "The period before", tip: `Companies that logged in, ${prevWords(c.d, c.per)}`, cell: (r: Row) => int(r.before ?? 0), sort: (r: Row) => r.before ?? 0 }] : []),
    ...(dim === "person" ? [] : [{ key: "share", head: "Share of the companies", cell: (r: Row) => pct(t.companies ? r.companies / t.companies : null), sort: (r: Row) => r.companies }]),
    { key: "logins", head: "Logins", cell: (r) => int(r.logins), sort: (r) => r.logins },
    { key: "views", head: "Article views", cell: (r) => int(r.views), sort: (r) => r.views },
    { key: "depth", head: "Views per login", cell: (r) => (r.logins ? one(r.views / r.logins) : "—"), sort: (r) => (r.logins ? r.views / r.logins : -1) },
    { key: "ordered", head: "Ordered in the shop", tip: "Of the companies that logged in, those that also ordered in the shop in the period", cell: (r) => int(r.ordered), sort: (r) => r.ordered },
    { key: "orderedShare", head: "Of them", tip: "The share of the companies that logged in that ordered in the shop", cell: (r) => pct(r.companies ? r.ordered / r.companies : null), sort: (r) => (r.companies ? r.ordered / r.companies : -1) },
    { key: "noview", head: "Viewed no article", tip: "Logged in, but opened no article in the period", cell: (r) => int(r.noView), sort: (r) => r.noView },
  ];
  const sorted = order ? [...rows].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : rows;
  return <FullTable key={`${dim}-${c.per.id}-${c.team}`} first={DIM[dim].name} cols={cols} initial="companies" rows={sorted} total={{ label: "Total", ...t, before: totalOf(c, true).companies }} natural={!!order}
    selected={c.filters[dim]} onPick={c.onBar ? (l) => c.onBar!(dim, l) : undefined} find={`a ${DIM[dim].lower}`} />;
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string, target?: TargetOf) => React.ReactNode;
const draw = (c: ShCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c), d.target?.(c))); };

function TabCard({ c, act, footnote }: { c: ShCtx; act: Act; footnote: React.ReactNode }) {
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const words = `${perWords(c.d, c.per)} · ${sourceWords(c.per)}`;
  if (c.view === "people") return (
    <GlassCard sx={card}>
      <CardTitle icon={<BadgeOutlinedIcon />} tint="green" title={`${teamName(c)}'s customers in the shop, ${c.per.title}`} note={`${words} · by the company's owner`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "people:loggedin")}{draw(c, act, "people:ordered")}</Box>
      {draw(c, act, "people:days")}
      <Box sx={TWO}>{draw(c, act, "people:share")}{draw(c, act, "people:noview")}</Box>
      <Box><SubTitle>{perCap(c.per)}, by company owner</SubTitle><DimTable c={c} dim="person" /></Box>
      {footnote}
    </GlassCard>
  );
  if (c.view === "activity") return (
    <GlassCard sx={card}>
      <CardTitle icon={<TouchAppOutlinedIcon />} tint="amber" title={`${teamName(c)}: logins and article views, ${c.per.title}`} note={`${words} · how often they come, and how much they look at`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "activity:logins")}{draw(c, act, "activity:views")}</Box>
      {draw(c, act, "activity:days")}
      <Box sx={TWO}>{draw(c, act, "activity:depth")}{draw(c, act, "activity:noview")}</Box>
      {footnote}
    </GlassCard>
  );
  const dim = DIM_OF[c.view], dd = DIM[dim];
  return (
    <GlassCard sx={card}>
      <CardTitle icon={dd.icon} tint={dd.tint} title={`${teamName(c)} by ${dd.lower}, ${c.per.title}`} note={`${dd.note} · ${words}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, `${c.view}:loggedin`)}{draw(c, act, `${c.view}:ordered`)}</Box>
      <Box sx={TWO}>{draw(c, act, `${c.view}:share`)}{draw(c, act, `${c.view}:depth`)}</Box>
      <Box><SubTitle>{perCap(c.per)}, by {dd.lower}</SubTitle><DimTable c={c} dim={dim} /></Box>
      {footnote}
    </GlassCard>
  );
}
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures top right ─────────────────────────────────────────────── */

type Fig = { id: string; label: string; value: string; sub: string; icon: React.ReactNode; tint: Tint; amount: number; unit: "n" | "pct"; change: { text: string; color: string } | null };
/** "+12.3% on the 7 days before" - in points for a share; none without a period before */
function changeOf(cur: number, prev: number, share: boolean, c: ShCtx): Fig["change"] {
  if (!c.per.prev) return null;
  const vs = isLive(c.per.win) ? "on the period before" : `on ${prevWords(c.d, c.per)}`;
  if (share) { const p = (cur - prev) * 100; return { text: `${p > 0.05 ? "+" : p < -0.05 ? "−" : "±"}${Math.abs(p).toFixed(1)} pts ${vs}`, color: Math.abs(p) < 0.05 ? FAINT : p > 0 ? GREEN : RED }; }
  if (!prev) return cur ? { text: `new ${vs}`, color: GREEN } : null;
  const x = (cur - prev) / prev;
  return { text: `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x * 100).toFixed(1)}% ${vs}`, color: Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED };
}
function figuresOf(c: ShCtx): Fig[] {
  const t = totalOf(c), p = totalOf(c, true);
  const share = (s: SStats) => (s.companies ? s.ordered / s.companies : 0);
  return [
    { id: "fig-loggedin", label: "Companies that logged in", value: int(t.companies), sub: `${int(t.logins)} logins`, icon: <LoginOutlinedIcon />, tint: "blue", amount: t.companies, unit: "n", change: changeOf(t.companies, p.companies, false, c) },
    { id: "fig-logins", label: "Logins", value: int(t.logins), sub: `${one(t.companies ? t.logins / t.companies : NaN)} per company`, icon: <StorefrontOutlinedIcon />, tint: "green", amount: t.logins, unit: "n", change: changeOf(t.logins, p.logins, false, c) },
    { id: "fig-views", label: "Article views", value: int(t.views), sub: `${one(t.logins ? t.views / t.logins : NaN)} per login`, icon: <TouchAppOutlinedIcon />, tint: "amber", amount: t.views, unit: "n", change: changeOf(t.views, p.views, false, c) },
    { id: "fig-ordered", label: "Logged in and ordered in the shop", value: pct(t.companies ? share(t) : null), sub: `${int(t.ordered)} of the ${int(t.companies)} companies`, icon: <ShoppingCartCheckoutOutlinedIcon />, tint: "purple", amount: share(t), unit: "pct", change: changeOf(share(t), share(p), true, c) },
    { id: "fig-noview", label: "Logged in, viewed no article", value: int(t.noView), sub: `${pct(t.companies ? t.noView / t.companies : null)} of those that logged in`, icon: <VisibilityOffOutlinedIcon />, tint: "slate", amount: t.noView, unit: "n", change: null },
  ];
}
function FigureCards({ c, items, actions }: { c: ShCtx; items: Fig[]; actions?: (f: Fig) => React.ReactNode }) {
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
            {f.change && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: f.change.color, lineHeight: 1.3 }}>{f.change.text}</Typography>}
            <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{f.sub}</Typography>
            {tgt != null && <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: f.amount >= tgt ? GREEN : RED }}>{pct(f.amount / tgt)} of the target {f.unit === "pct" ? pct(tgt) : int(tgt)}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── the Filters window: the period and the breakdowns ─────────────────── */

function SPeriod({ d, per, onPer }: { d: ShopData; per: SPer; onPer: (id: string) => void }) {
  const all = presetsOf(d);
  const chips = (list: SPer[]) => (
    <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
      {list.map((p) => {
        const on = p.id === per.id;
        return <Chip key={p.id} label={p.label} onClick={() => onPer(p.id)} aria-pressed={on} sx={{ height: 28, fontSize: "0.78rem", fontWeight: 600, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : INK, border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.14)"}` }} />;
      })}
    </Box>
  );
  const head = { fontSize: "0.76rem", fontWeight: 700, color: INK } as const;
  const note = { fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 } as const;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography sx={head}>Live - the smart bar&apos;s counters</Typography>
      {chips(all.filter((p) => isLive(p.win)))}
      <Typography sx={note}>Day by day since {dayWords(d.liveFrom)}. A period is compared with the same number of days right before it, once the counters reach back that far.</Typography>
      <Typography sx={{ ...head, mt: 0.5 }}>Performis - the E-Shop Data Tracker&apos;s export</Typography>
      {chips(all.filter((p) => !isLive(p.win)))}
      <Typography sx={note}>One total per company and year, loaded by hand{d.dtLoaded ? ` - the last on ${dayWords(d.dtLoaded)}, so ${d.dtLoaded.slice(0, 4)} stops there` : ""}. A whole year is compared with the year before.</Typography>
    </Box>
  );
}
function SFacet({ c, dim, onPick }: { c: ShCtx; dim: SDim; onPick: (l: string) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const by = statsOf(c, dim);
  const order = ORDER[dim];
  const rows = [...by].map(([label, s]) => ({ label, n: s.companies }));
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
const FILTER_DIMS: SDim[] = ["person", "prio", "category", "country"];
function SFilterWindow({ c, per, open, onClose, focus, onPer, toggle, clearAll }: {
  c: ShCtx; per: SPer; open: boolean; onClose: () => void; focus: { dim: SDim; n: number } | null; onPer: (id: string) => void; toggle: (d: SDim, l: string) => void; clearAll: () => void;
}) {
  const [shut, setShut] = useState<Partial<Record<SDim | "period", boolean>>>({});
  const isOpen = (k: SDim | "period") => (shut[k] !== undefined ? !shut[k] : k === "period" || k === "person" || !!c.filters[k as SDim]?.length);
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
    <FilterPanel id="eso-shop-filters" open={open} onClose={onClose}
      subtitle={chosen.length ? `${chosen.length} chosen - click again to let one go` : "Click values to show only them - several at once"}
      onClearAll={chosen.length ? clearAll : undefined}
      chips={chosen.length ? chosen.map(([d, v]) => <Chip key={`${d}:${v}`} size="small" label={<span><b>{DIM[d].name}:</b> {v}</span>} onDelete={() => toggle(d, v)} sx={{ height: 26, fontSize: "0.76rem", bgcolor: TINT[DIM[d].tint].bg, color: INK }} />) : null}>
      {live && (
        <>
          <FilterSection id="sfilter-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={isOpen("period")} onFlip={() => setShut((s) => ({ ...s, period: isOpen("period") }))} summary={per.label}>
            <SPeriod d={c.d} per={per} onPer={onPer} />
          </FilterSection>
          {FILTER_DIMS.map((dim, i) => (
            <FilterSection key={dim} id={`sfilter-${dim}`} index={i + 1} title={DIM[dim].name} icon={DIM[dim].icon} tint={DIM[dim].tint} open={isOpen(dim)} onFlip={() => setShut((s) => ({ ...s, [dim]: isOpen(dim) }))}
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
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>{error ? `The shop's figures could not be read: ${error}` : `Reading the shop's counters and the companies in HubSpot${progress ? ` · ${progress}` : ""}…`}</Typography>
      </Box>
    </GlassCard>
  );
}
/** A period by its id, the default one when it is not (or no longer) offered - a month that has not ended, say. */
const perById = (d: ShopData, id: string | null | undefined) => { const all = presetsOf(d); return all.find((p) => p.id === id) ?? all.find((p) => p.id === DEFAULT_PER) ?? all[0]; };

export function ShopExplorer() {
  const params = useSearchParams();
  const { d, computing, progress, error } = useShop();
  const [teamKey, setTeam] = useTeam();
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const teams = lt?.teams ?? [];
  const { state: acts } = useActions("eso-shop");
  const view: SView = isView(params.get("view")) ? (params.get("view") as SView) : "people";
  const setView = (v: SView) => setQuery((q) => { if (v === "people") q.delete("view"); else q.set("view", v); });
  const filters: SFilters = useMemo(() => Object.fromEntries(FILTER_DIMS.flatMap((k) => (params.getAll(k).length ? [[k, params.getAll(k)]] : []))), [params]);
  const toggle = (k: SDim, label: string) => setQuery((q) => { const cur = q.getAll(k), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]; q.delete(k); for (const x of next) q.append(k, x); });
  const clearAll = () => setQuery((q) => { for (const k of FILTER_DIMS) q.delete(k); q.delete("per"); });
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: SDim; n: number } | null>(null);
  const openOn = (k: SDim) => { setFocus((f) => ({ dim: k, n: (f?.n ?? 0) + 1 })); setPanel(true); };
  const setPer = (id: string) => setQuery((q) => { if (id === DEFAULT_PER) q.delete("per"); else q.set("per", id); });

  // the work a click asks for, kept; the tabs and toggles answer at once and the charts follow (as the Figures)
  const team = teamKey;
  const lead = leadOf(team, leadKey, lt);
  const perP = params.get("per");
  const per = useMemo(() => (d ? perById(d, perP) : null), [d, perP]);
  const people = useMemo(() => (d ? peopleOf(d, team, lead, lt?.byId ?? {}) : null), [d, team, lead, lt]);
  const want = useMemo(() => ({ view, per, people, team, lead, filters }), [view, per, people, team, lead, filters]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<ShCtx | null>(() => (d && drawn.per ? {
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
  if (!d || !c || !per) return (<Box sx={shell}>{back}<Typography component="h1" sx={H1}>Shop behaviour</Typography><Waiting computing={computing} progress={progress} error={error} /></Box>);

  const act: Act = (id, title, target) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-shop:${id}`, page: "eso-shop", tab: c.view, title, summary: `${teamName(c)} · ${perWords(d, c.per)}`,
        filters: { ...Object.fromEntries(FILTER_DIMS.filter((k) => c.filters[k]?.length).map((k) => [k, c.filters[k] ?? []])), team: [c.team], ...(c.lead ? { lead: [c.lead] } : {}), period: [c.per.id] },
        kind: "card", target: target ? { key: targetKey(id, c.team, c.lead, c.per), ...target } : undefined }} />
  );
  const now = { team, lead, teams };
  const chosen = FILTER_DIMS.flatMap((k) => (filters[k] ?? []).map((v) => [k, v] as const));
  const footnote = (
    <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
      Live: the smart bar&apos;s counters on the shop - each login, each article opened, each article ordered - per company and day since {dayWords(d.liveFrom)}, compared with the same number of days right before once they reach back that far.
      {" "}Performis: the E-Shop Data Tracker&apos;s export, one total per company and year, loaded into HubSpot by hand{d.dtLoaded ? ` - the last on ${dayWords(d.dtLoaded)}, so ${d.dtLoaded.slice(0, 4)} stops there` : ""}; a whole year against the year before. The two are never on one chart.
      {" "}A company counts when it logged in in the period; ordered: it also ordered in the shop in the period. Whose customers: the company&apos;s owner in HubSpot - ESO and TSA by the rosters (else the owner&apos;s HubSpot team), Total every company the shop counted; a line manager&apos;s team as Map assignment&apos;s SAE table sets it. Shares and averages rank from {MIN_COMPANIES} companies that logged in. APSOparts&apos; and A+P&apos;s own companies left out.
      {" "}{int(d.coverage.companies)} companies read, {int(d.coverage.live)} of them counted live. Read {new Date(d.generatedAt).toLocaleString("en-GB")}, every hour.
    </Typography>
  );
  return (
    <Box sx={shell}>
      {back}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>Shop behaviour</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamName(now)}</b>&apos;s customers · {isLive(per.win) ? `${per.title} ` : ""}<b style={{ color: INK }}>{perWords(d, per)}</b> · {sourceWords(per)}{per.prev ? ` · against ${prevWords(d, per)}` : ""}{computing ? " · reading again" : ""}
          </Typography>
          {(chosen.length > 0 || per.id !== DEFAULT_PER) && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {per.id !== DEFAULT_PER && <Chip size="small" label={<span><b>Period:</b> {per.label}</span>} onDelete={() => setPer(DEFAULT_PER)} onClick={() => setPanel(true)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.blue.fg } }} />}
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
          <ReportTabs name="eso-shop" tab={view} onSelect={setView} tabs={VIEWS_TABS.map((v) => ({ id: v.id, label: v.label, count: v.id !== "people" && v.id !== "activity" && filters[DIM_OF[v.id]]?.length ? String(filters[DIM_OF[v.id]]!.length) : null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-shop" /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else openOn(DIM_OF[view]); }} variant={panel || chosen.length || per.id !== DEFAULT_PER ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-shop-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosen.length || per.id !== DEFAULT_PER ? undefined : "#fff" }}>
          Filters{chosen.length + (per.id !== DEFAULT_PER ? 1 : 0) ? ` · ${chosen.length + (per.id !== DEFAULT_PER ? 1 : 0)}` : ""}
        </Button>
      </Box>
      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} act={act} footnote={footnote} />
      </Box>
      <SFilterWindow c={c} per={per} open={panel} onClose={() => setPanel(false)} focus={focus} onPer={setPer} toggle={toggle} clearAll={clearAll} />
    </Box>
  );
}

/* ── the BUC View's Shop panel ─────────────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
const PANEL = "eso-shop:panel:";

/** Shop behaviour in the BUC View: the last 4 weeks for the team the toggle shows, the days, and the Shop charts sent here. */
export function ShopPanel({ acts }: { acts: ActionsState | null }) {
  const { d, computing, progress, error } = useShop();
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
  const c = useMemo<ShCtx | null>(() => (d ? { d, per: perById(d, DEFAULT_PER), team: drawn.team, lead: drawn.lead, teams, people: peopleOf(d, drawn.team, drawn.lead, lt?.byId ?? {}), filters: {}, view: "people", targets: acts?.targets } : null),
    [d, drawn, teams, lt, acts?.targets]);
  const items: SortItem[] = useMemo(() => !c ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-shop" && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const ch = chartOf(spec.key);
    const fmt = formatOf(acts, spec);
    const f = spec.filters ?? {};
    const sf: SFilters = Object.fromEntries(FILTER_DIMS.flatMap((k) => (f[k]?.length ? [[k, f[k]]] : [])));
    // every chart here follows the panel's toggle (as the Figures' panel); its filters and period stay as sent
    const sc: ShCtx = { ...c, per: f.period?.[0] ? perById(c.d, f.period[0]) : c.per, filters: sf, view: (spec.tab && isView(spec.tab) ? spec.tab : "people") as SView, half: fmt === "half" };
    const target = ch?.target ? { key: targetKey(ch.id, c.team, c.lead, sc.per), ...ch.target(sc) } : undefined;
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind, target }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<StorefrontOutlinedIcon />} tint="blue" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [c, acts]);
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-shop", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);
  const shown = (id: string) => placementOf(acts, `${PANEL}${id}`, "nutshell") === "nutshell";
  const own = (id: string, title: string, kind: "kpi" | "card", target?: { key: string; unit: "eur" | "pct" | "n"; label: string }) => (
    <TileActions where="nutshell" start="nutshell" edge={2} tile={{ key: `${PANEL}${id}`, page: "eso-shop", tab: "people", title: `${title} - ${c ? teamName(c) : "ESO"}`, kind,
      filters: { team: [drawn.team], ...(drawn.lead ? { lead: [drawn.lead] } : {}), period: [DEFAULT_PER] }, href: `/reporting/eso-benchmark/shop?team=${drawn.team}${drawn.lead ? `&lead=${drawn.lead}` : ""}`, target }} />
  );
  const days = drawnOf("people:days")!;
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<StorefrontOutlinedIcon />} tint="blue" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/shop?team=${team}${lead ? `&lead=${lead}` : ""}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.blue.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>Shop behaviour</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.blue.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName({ team, lead, teams })}'s customers · ${c.per.title} ${perWords(c.d, c.per)} · ${sourceWords(c.per)}` : "Logins, article views and orders in the shop"}</Typography>
        </Box>
        <Teams team={team} onTeam={choose} lead={leadKey} onLead={chooseLead} teams={teams} />
      </Box>
      {!c ? <Waiting computing={computing} progress={progress} error={error} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          <FigureCards c={c} items={figs.filter((f) => shown(f.id))} actions={(f) => own(f.id, f.label, "kpi", { key: targetKey(`panel:${f.id}`, c.team, c.lead, c.per), unit: f.unit, label: `${f.label} is measured against it · ${teamName(c)}'s target.` })} />
          {shown("days") && days.draw(c, own("days", "Companies that logged in, day by day", "card", days.target ? { key: targetKey(days.id, c.team, c.lead, c.per), ...days.target(c) } : undefined))}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-shop"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </Box>
      )}
    </GlassCard>
  );
}

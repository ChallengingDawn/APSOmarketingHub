"use client";
// THE ESO NEW CUSTOMERS PAGE, rebuilt like the Figures (SARCLA 29.10.2026 - his picks: "rebuild like Figures/Visits"; a new
// customer counts for its Performis SAE; the new customers with their revenue and Ø per customer). What the old page was:
// the company owners on the ESO roster only, the complete months only, no period, paired bars per rep, its own read
// (esoBenchmark.ts). Now on Who are our customers' cube, as the Figures: ESO | TSA | Total and the line managers' teams,
// the Period, the customers and every breakdown in Filters, a tab per breakdown, leaderboards with a target each, all the
// figures in a table. A new customer: a company whose first order ever (order_first_order_date) falls in the period; its
// revenue: what it bought from then to the period's end, from each customer's monthly revenue (cube.ts newBy / newByMonth).

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";

import { GUTTER } from "@/app/analytics/Shell";
import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { DIM, FilterWindow, useCompanyNames, useCustomersCube, type CustomerPick } from "@/app/reporting/marketing-kpis/Customers";
import { TileActions } from "@/app/reporting/marketing-kpis/tiles/TileActions";
import { SavedViews } from "@/app/reporting/marketing-kpis/tiles/SavedViews";
import { SortableGrid, type SortItem } from "@/app/reporting/marketing-kpis/tiles/SortableGrid";
import { formatOf, placementOf, refreshActions, send, useActions, type ActionsState } from "@/app/reporting/marketing-kpis/tiles/store";
import {
  DIMS, MONTH_NAMES, PRIO_ORDER, chosenDims, clampWindow, monthLabel, monthOf, newBy, newByMonth, partial, presets, windowLabel, yearOfMonth,
  type Cube, type Dim, type Filters, type NewAgg, type NewMonth, type Win,
} from "@/lib/marketingKpis/cube";
import type { Team } from "@/lib/mapAssign/leadsRules";
import {
  ChartBox, FullTable, H1, KEPT, KEPT_LEAD, Leaderboard, NoLeadYet, SubTitle, TARGET, TEAM_OF, TWO, Teams, asLead, asTeam, leadOf, niceTop, setQuery, teamWord,
  useLead, useLeads, useTeam, type BoardRow, type Col, type LeadKey, type Per, type TeamKey,
} from "./Figures";

/* ── words and numbers, in full ────────────────────────────────────────── */

const int = (n: number) => Math.round(n).toLocaleString("en");
const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const signedInt = (n: number) => `${Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? "−" : "±"}${Math.abs(Math.round(n)).toLocaleString("en")}`;
const signedEur = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const tone = (x: number | null) => (x == null || Math.abs(x) < 0.0005 ? FAINT : x > 0 ? GREEN : RED);
const avg = (a: NewAgg) => (a.n ? a.rev / a.n : 0);
const avgPy = (a: NewAgg) => (a.nPy ? a.revPy / a.nPy : 0);
/** An average ranks only over enough new customers: one big first order made a person top of the list. */
const minNew = (months: number) => (months >= 3 ? 5 : 2);

/* ── ESO | TSA | Total: the Performis SAE's people, as the Figures ──────── */

/** A team's Performis SAE people (the SAE as its person); null for Total - under ESO, a line manager's team only. */
const membersOf = (cube: Cube, team: TeamKey, lead: string | null = null, leads: Record<string, string> | null = null) => (team === "total" ? null
  : cube.labels.sae.filter((l) => (cube.saeTeams ?? {})[l] === TEAM_OF[team] && (team !== "eso" || !lead || leads?.[l] === lead)));
function withTeam(cube: Cube, filters: Filters, team: TeamKey, lead: string | null = null, leads: Record<string, string> | null = null): Filters {
  const members = membersOf(cube, team, lead, leads);
  if (!members) return filters;
  const chosen = filters.sae?.length ? filters.sae.filter((o) => members.includes(o)) : members;
  return { ...filters, sae: chosen.length ? chosen : ["\u0000 none"] };
}
const teamName = (c: { team: TeamKey; lead?: string | null; teams?: Team[] }) => (c.team === "eso" && c.lead ? c.teams?.find((t) => t.id === c.lead)?.name ?? c.lead : teamWord(c.team));

/* ── the period every chart, table and figure follows ──────────────────── */

const ytdWin = (cube: Cube): Win => presets(cube)[0].win;
function perOf(cube: Cube, win: Win): Per {
  const p = presets(cube).find((x) => x.win.start === win.start && x.win.end === win.end);
  const title = p?.id === "ytd" ? "year to date" : p?.id === "mtd" ? "month to date" : p?.id === "12m" ? "the last 12 months" : p?.id === "ly" ? String(cube.years[1]) : p ? p.label : windowLabel(cube, win);
  return { win, id: p?.id ?? `m${win.start}-${win.end}`, erp: null, title, months: win.end - win.start + 1 };
}
/** "Jan – 28 Oct 2026", "Apr–Jun 2026" - a year earlier with back = 1 */
const perWords = (cube: Cube, per: Per, back = 0) => windowLabel(cube, per.win, back);
const perCap = (per: Per) => per.title.charAt(0).toUpperCase() + per.title.slice(1);
const ym = (cube: Cube, k: number) => `${yearOfMonth(cube, k)}-${String((k % 12) + 1).padStart(2, "0")}`;
const fromYm = (cube: Cube, x: string | null | undefined) => { const m = /^(\d{4})-(\d{2})$/.exec(x ?? ""); return m ? (Number(m[1]) - cube.years[2]) * 12 + Number(m[2]) - 1 : null; };
/** A period as a chart sent to the BUC View keeps it: a ready-made one by its name, so it moves on with time; any other by its months. */
const perFilters = (cube: Cube, per: Per): Record<string, string[]> => (presets(cube).some((p) => p.id === per.id) ? { period: [per.id] } : { from: [ym(cube, per.win.start)], to: [ym(cube, per.win.end)] });
function perFromFilters(cube: Cube, f: Record<string, string[] | undefined> | undefined): Per | null {
  const id = f?.period?.[0];
  const p = id ? presets(cube).find((x) => x.id === id) : null;
  if (p) return perOf(cube, p.win);
  const a = fromYm(cube, f?.from?.[0]), b = fromYm(cube, f?.to?.[0]);
  return a != null && b != null ? perOf(cube, clampWindow(cube, { start: a, end: b })) : null;
}

/* ── the tabs ──────────────────────────────────────────────────────────── */

const BREAKDOWNS = ["country", "prio", "segment", "type", "apic"] as const;
type Breakdown = (typeof BREAKDOWNS)[number];
type View = "sae" | Breakdown | "pc";
const VIEW_IDS: View[] = ["sae", ...BREAKDOWNS, "pc"];
const isView = (x: string | null | undefined): x is View => (VIEW_IDS as string[]).includes(x ?? "");
const VIEWS: { id: View; label: string }[] = [
  { id: "sae", label: "Performis SAE" }, ...BREAKDOWNS.map((d) => ({ id: d as View, label: DIM[d].name })), { id: "pc", label: "Profit center" },
];
/** What a tab is broken down by: a cube dimension, or the profit centre the new customers bought most from. */
type By = Dim | "pc";
const byOf = (v: View): By => v;
const NOTES: Record<Breakdown | "pc", string> = {
  country: "Where the new customers are",
  prio: "Which priority bands the new customers come in",
  segment: "APSOcore, APSOgrowth, APSOprospect, APSOlost, APSOmicro, Growth Engine - as HubSpot has the company today",
  type: "OEM, C2S workshops, MRO, resellers",
  apic: "The customer's APIC industry code - 1.x OEM industries, down to the sub-industry",
  pc: "The profit center each new customer bought most from since its first order",
};
const PC_KNOWN = ["dt", "ft", "kt", "at", "st"];
const PC_NAME: Record<string, string> = { dt: "Sealing Technology (DT)", ft: "Fluid Technology (FT)", kt: "Engineering Plastics (KT)", at: "Drive Technology (AT)", st: "Antivibration Technology (ST)", other: "Other", none: "No revenue yet" };
const PC_ORDER = [...PC_KNOWN.map((k) => PC_NAME[k]), PC_NAME.other, PC_NAME.none];
const pcName = (raw: string) => (raw === "none" ? PC_NAME.none : PC_NAME[PC_KNOWN.includes(raw) ? raw : "other"]);
const nameOf = (by: By) => (by === "pc" ? "Profit center" : DIM[by].name);
const lowerOf = (by: By) => (by === "pc" ? "profit center" : DIM[by].lower);

/* ── what every chart is drawn with ────────────────────────────────────── */

type NCtx = {
  cube: Cube; team: TeamKey; view: View;
  /** the period every chart follows */
  per: Per;
  /** the filters chosen, and with the team in them */
  filters: Filters; eff: Filters;
  /** in half a row of the BUC View */
  half?: boolean;
  /** a row: show only it */
  onPick?: (d: Dim, label: string) => void;
  /** a bar: show only it, and the Filters window opens on its breakdown */
  onBar?: (d: Dim, label: string) => void;
  onFilter?: (d: Dim) => void;
  /** under ESO, a line manager's team, and each person's line manager (by name) */
  lead?: string | null; leads?: Record<string, string> | null; teams?: Team[];
  /** every chart's target, typed in its Actions window, by its key */
  targets?: Record<string, number>;
};

type NRow = NewAgg & { label: string };
const rowCache = new WeakMap<Filters, Map<string, NRow[]>>();
/** The new customers of the period by a breakdown - a team's own people on the Performis SAE - the most first (priority, profit centre in their order). */
function rowsBy(c: NCtx, by: By): NRow[] {
  let memo = rowCache.get(c.eff);
  if (!memo) { memo = new Map(); rowCache.set(c.eff, memo); }
  const key = `${c.cube.generatedAt}|${by}|${c.team}|${c.lead ?? ""}|${c.per.win.start}-${c.per.win.end}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const members = by === "sae" ? membersOf(c.cube, c.team, c.lead, c.leads) : null;
  const merged = new Map<string, NRow>();
  for (const [raw, a] of newBy(c.cube, c.eff, c.per.win, by)) {
    if (members && !members.includes(raw)) continue;
    if (!a.n && !a.nPy) continue;
    // the profit centres by name, any code the ERP adds under Other
    const label = by === "pc" ? pcName(raw) : raw;
    const r = merged.get(label) ?? { label, n: 0, nPy: 0, rev: 0, revPy: 0 };
    r.n += a.n; r.nPy += a.nPy; r.rev += a.rev; r.revPy += a.revPy;
    merged.set(label, r);
  }
  const rows = [...merged.values()];
  const order = by === "prio" ? PRIO_ORDER : by === "pc" ? PC_ORDER : null;
  if (order) rows.sort((a, z) => ((order.indexOf(a.label) + 99) % 99) - ((order.indexOf(z.label) + 99) % 99) || a.label.localeCompare(z.label));
  else rows.sort((a, z) => z.n - a.n || z.rev - a.rev || a.label.localeCompare(z.label));
  memo.set(key, rows);
  return rows;
}
const totalCache = new WeakMap<Filters, Map<string, NewAgg>>();
/** The period's new customers all together. */
function totalOf(c: NCtx): NewAgg {
  let memo = totalCache.get(c.eff);
  if (!memo) { memo = new Map(); totalCache.set(c.eff, memo); }
  const key = `${c.cube.generatedAt}|${c.per.win.start}-${c.per.win.end}`;
  let t = memo.get(key);
  if (!t) { t = newBy(c.cube, c.eff, c.per.win).get("") ?? { n: 0, nPy: 0, rev: 0, revPy: 0 }; memo.set(key, t); }
  return t;
}
const monthCache = new WeakMap<Filters, Map<string, NewMonth[]>>();
function monthsOf(c: NCtx): NewMonth[] {
  let memo = monthCache.get(c.eff);
  if (!memo) { memo = new Map(); monthCache.set(c.eff, memo); }
  const key = `${c.cube.generatedAt}|${c.per.win.start}-${c.per.win.end}`;
  let m = memo.get(key);
  if (!m) { m = newByMonth(c.cube, c.eff, c.per.win); memo.set(key, m); }
  return m;
}

/** A chart's target, one per chart, team (a line manager's team its own) and period: "eso-new-customers:sae:new@eso-RABE~q2"
 *  (the year to date without "~"); the months' charts keep one target a month, whatever the period. */
const targetKey = (id: string, team: TeamKey, lead: string | null | undefined, per: Per) =>
  `eso-new-customers:${id}@${team}${team === "eso" && lead ? `-${lead}` : ""}${/:mon/.test(id) || per.id === "ytd" ? "" : `~${per.id}`}`;
const targetFor = (c: NCtx, id: string) => { const t = c.targets?.[targetKey(id, c.team, c.lead, c.per)]; return t != null && t > 0 ? t : null; };

/* ── the leaderboards ──────────────────────────────────────────────────── */

// every change in words (SARCLA 29.10.2026 on "−5.7% · −€63": "you have to be really explicit with text, this means nothing for me")
const moreLess = (n: number, fmt: (x: number) => string, less: string, more: string, tail = "") => (Math.round(n) === 0 ? "no change" : `${fmt(Math.abs(n))} ${n < 0 ? less : more}${tail}`);
type Measure = "new" | "rev" | "avg";
const MEASURE: Record<Measure, { title: string; fmt: (n: number) => string; diff: (n: number) => string; signed: (n: number) => string; unit: "n" | "eur"; target: string }> = {
  new: { title: "New customers", fmt: int, diff: (n) => moreLess(n, int, "fewer", "more"), signed: signedInt, unit: "n", target: "new customers" },
  rev: { title: "Revenue of the new customers", fmt: eur, diff: (n) => moreLess(n, eur, "less", "more"), signed: signedEur, unit: "eur", target: "revenue of its new customers" },
  avg: { title: "Ø revenue per new customer", fmt: eur, diff: (n) => moreLess(n, eur, "less", "more", " per customer"), signed: signedEur, unit: "eur", target: "Ø revenue per new customer" },
};
/** What every change is against: "vs 2025" - "vs a year earlier" over a year end. */
const vsOf = (c: NCtx) => { const a = yearOfMonth(c.cube, c.per.win.start), b = yearOfMonth(c.cube, c.per.win.end); return a === b ? `vs ${a - 1}` : "vs a year earlier"; };
function Board({ c, id, by, m, actions }: { c: NCtx; id: string; by: By; m: Measure; actions?: React.ReactNode }) {
  const t = totalOf(c);
  const min = minNew(c.per.months);
  const rows: BoardRow[] = [], small: BoardRow[] = [];
  for (const r of rowsBy(c, by)) {
    // the new customers not invoiced yet count, but have no revenue to rank (they stay in the count and the table)
    if (m !== "new" && by === "pc" && r.label === PC_NAME.none) continue;
    if (m === "new") { if (r.n || r.nPy) rows.push({ label: r.label, cur: r.n, prev: r.nPy, sub: `${eur(r.rev)} their revenue · Ø ${r.n ? eur(avg(r)) : "—"} per customer` }); }
    else if (m === "rev") { if (r.rev || r.revPy) rows.push({ label: r.label, cur: r.rev, prev: r.revPy, sub: `${int(r.n)} new customer${r.n === 1 ? "" : "s"} · ${pct(t.rev ? r.rev / t.rev : null)} of the total` }); }
    else if (r.n) (r.n >= min ? rows : small).push({ label: r.label, cur: avg(r), prev: avgPy(r), sub: `${int(r.n)} new customer${r.n === 1 ? "" : "s"} · ${eur(r.rev)} their revenue` });
  }
  const M = MEASURE[m];
  const dim = by === "pc" ? null : by;
  return (
    <Leaderboard key={`${id}-${c.per.id}`} title={`${M.title} ${c.per.title}, by ${lowerOf(by)}`} rows={rows}
      curLabel={perWords(c.cube, c.per)} prevLabel={perWords(c.cube, c.per, 1)} first={c.half ? 8 : 12} fmt={M.fmt} diff={M.diff} vs={vsOf(c)} target={targetFor(c, id)}
      unranked={small.length ? { why: `under ${min} new customers`, rows: small } : undefined}
      selected={dim ? c.filters[dim] : undefined} onPick={dim && c.onBar ? (l) => c.onBar!(dim, l) : undefined}
      onFilter={dim && c.onFilter ? () => c.onFilter!(dim) : undefined} filterLabel={dim ? `Filter by ${lowerOf(dim)}` : undefined} actions={actions} />
  );
}

/* ── the period month by month ─────────────────────────────────────────── */

/** The months as columns: this year's column, last year's tick across it, the target (typed in Actions) as a line across. */
function NewMonths({ c, which, target }: { c: NCtx; which: "n" | "rev"; target: number | null }) {
  const jan = monthOf(0, 0);
  const fmt = which === "n" ? int : eur;
  const run = partial(c.cube);
  const data = monthsOf(c).map((m) => ({ x: m.month >= jan ? MONTH_NAMES[m.month - jan] : monthLabel(c.cube, m.month), cur: which === "n" ? m.n : m.rev, prev: which === "n" ? m.nPy : m.revPy, running: !!run && m.month === run.month }));
  const ys = new Set(monthsOf(c).map((m) => yearOfMonth(c.cube, m.month)));
  const [y0, y1] = ys.size === 1 ? [String([...ys][0]), `${[...ys][0] - 1}, same month`] : ["The months shown", "A year earlier, same month"];
  const top = niceTop(Math.max(1, target ?? 0, ...data.map((d) => Math.max(d.cur, d.prev))));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const done = data.filter((d) => !d.running);
  const reached = target ? done.filter((d) => d.cur >= target).length : 0;
  const item = (mark: React.ReactNode, text: React.ReactNode) => <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>{mark}{text}</Box>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.74rem", color: MUTED }}>
        {item(<Box component="span" sx={{ width: 14, height: 8, borderRadius: "2px", bgcolor: THIS }} />, y0)}
        {item(<Box component="span" sx={{ width: 2, height: 12, bgcolor: INK, borderRadius: 1 }} />, y1)}
        {target != null && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: INK, fontWeight: 600 }}><Box component="span" sx={{ width: 14, borderTop: `2px dashed ${TARGET}` }} />Target {fmt(target)} a month · <span style={{ color: reached === done.length ? GREEN : RED }}>{reached} of {done.length} months reached it</span></Box>}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
        <Box sx={{ position: "relative", minWidth: Math.max(28, fmt(top).length * 7) }}>
          {ticks.map((f) => <Typography key={f} sx={{ position: "absolute", right: 0, bottom: `calc(${f * 100}% - 7px)`, fontSize: "0.7rem", color: FAINT, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", lineHeight: 1.2 }}>{fmt(f * top)}</Typography>)}
        </Box>
        <Box sx={{ position: "relative", width: "100%", aspectRatio: "2.6 / 1", minHeight: 160, maxHeight: 340 }}>
          {ticks.map((f) => <Box key={f} sx={{ position: "absolute", left: 0, right: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${f === 0 ? "#cfd4db" : "#eef0f3"}` }} />)}
          {target != null && <Box sx={{ position: "absolute", left: 0, right: 0, bottom: `${(target / top) * 100}%`, borderTop: `2px dashed ${TARGET}`, zIndex: 1, pointerEvents: "none" }} />}
          <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
            {data.map((d) => (
              <Box key={d.x} title={`${d.x}${d.running ? " (to date)" : ""}: ${fmt(d.cur)} · a year earlier: ${fmt(d.prev)}${target ? ` · ${pct(d.cur / target)} of the target` : ""}`}
                sx={{ flex: 1, position: "relative", height: "100%", borderRadius: "6px", "&:hover": { bgcolor: "rgba(21,34,58,.035)" } }}>
                <Box sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "52%", maxWidth: 30, height: `${(Math.max(0, d.cur) / top) * 100}%`, bgcolor: THIS, borderRadius: "4px 4px 0 0" }} />
                {d.prev > 0 && <Box sx={{ position: "absolute", bottom: `calc(${(d.prev / top) * 100}% - 1px)`, left: "50%", transform: "translateX(-50%)", width: "76%", maxWidth: 44, height: 2, bgcolor: INK, borderRadius: 1 }} />}
              </Box>
            ))}
          </Box>
        </Box>
        <Box />
        <Box sx={{ display: "flex", overflow: "hidden" }}>
          {data.map((d) => (
            <Box key={d.x} sx={{ flex: 1, textAlign: "center", pt: 0.5, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3 }}>{d.x}</Typography>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: tone(changeOf(d.cur, d.prev)), lineHeight: 1.3, whiteSpace: "nowrap" }}>{d.prev ? signedPct(changeOf(d.cur, d.prev)) : d.cur ? "new" : "—"}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
const monthsHint = (c: NCtx, which: "n" | "rev") =>
  `${perWords(c.cube, c.per)} · the change under each month${which === "rev" ? " · each month, what the period's new customers so far bought in it - the months add up to the period" : " · each month, the companies whose first order ever was in it"}`;

/* ── the tables ────────────────────────────────────────────────────────── */

/** A change written out, in its colour: "−176", "−€66,709", "−61.3%"; "new" without a year before. */
const ChangeText = ({ a, b, signed, asPct }: { a: number; b: number; signed: (n: number) => string; asPct?: boolean }) => (
  <span style={{ color: b ? tone(changeOf(a, b)) : a > 0 ? GREEN : FAINT, fontWeight: 700 }}>{!b ? (a > 0 ? "new" : "—") : asPct ? signedPct(changeOf(a, b)) : signed(a - b)}</span>
);
const sumRows = (rows: NRow[], label: string): NRow => rows.reduce((s, r) => ({ ...s, n: s.n + r.n, nPy: s.nPy + r.nPy, rev: s.rev + r.rev, revPy: s.revPy + r.revPy }), { label, n: 0, nPy: 0, rev: 0, revPy: 0 });
/** A measure of a row: this period and a year earlier. */
const valOf = (m: Measure, r: NewAgg): [number, number] => (m === "new" ? [r.n, r.nPy] : m === "rev" ? [r.rev, r.revPy] : [avg(r), avgPy(r)]);

/** One measure of a breakdown, as a report (SARCLA 29.10.2026: "split the table as real reports"): the period, the same
 *  months a year earlier, the change in figures and in %, and its share - the one table per measure. */
function MeasureTable({ c, by, m }: { c: NCtx; by: By; m: Measure }) {
  const all = rowsBy(c, by);
  const rows = m === "avg" ? all.filter((r) => r.n || r.nPy) : all;
  const total = sumRows(all, "Total");
  const { cube, per } = c;
  const M = MEASURE[m];
  const dim = by === "pc" ? null : by;
  const [sumCur] = valOf(m, total);
  // an average without its new customers is no figure
  const has = (r: NRow, side: 0 | 1) => m !== "avg" || (side === 0 ? r.n : r.nPy) > 0;
  const cols: Col<NRow>[] = [
    ...(by === "sae" && c.team === "total" ? [{ key: "team", head: "Team", cell: (r: NRow) => (r.label === "Total" ? "" : (cube.saeTeams ?? {})[r.label] ?? "—") }] : []),
    { key: "cur", head: perWords(cube, per), tip: m === "new" ? "Companies whose first order ever was in the period" : m === "rev" ? "What they bought from their first order to the end of the period" : "Their revenue over the new customers", cell: (r) => (has(r, 0) ? M.fmt(valOf(m, r)[0]) : "—"), sort: (r) => (has(r, 0) ? valOf(m, r)[0] : -Infinity) },
    { key: "prev", head: perWords(cube, per, 1), tip: "The same months a year earlier - the running month pro rata", cell: (r) => (has(r, 1) ? M.fmt(valOf(m, r)[1]) : "—"), sort: (r) => (has(r, 1) ? valOf(m, r)[1] : -Infinity) },
    { key: "diff", head: `Change ${vsOf(c)}`, cell: (r) => (has(r, 0) && has(r, 1) ? <ChangeText a={valOf(m, r)[0]} b={valOf(m, r)[1]} signed={M.signed} /> : "—"), sort: (r) => (has(r, 0) && has(r, 1) ? valOf(m, r)[0] - valOf(m, r)[1] : -Infinity) },
    { key: "pct", head: `Change ${vsOf(c)} in %`, cell: (r) => (has(r, 0) && has(r, 1) ? <ChangeText a={valOf(m, r)[0]} b={valOf(m, r)[1]} signed={M.signed} asPct /> : "—"), sort: (r) => (has(r, 0) && has(r, 1) ? changeOf(...valOf(m, r)) ?? -Infinity : -Infinity) },
    m === "avg"
      ? { key: "n", head: "New customers it is over", cell: (r) => int(r.n), sort: (r) => r.n }
      : { key: "share", head: m === "new" ? "Share of all new customers" : "Share of all their revenue", cell: (r) => (sumCur ? pct(valOf(m, r)[0] / sumCur) : "—"), sort: (r) => valOf(m, r)[0] },
  ];
  return <FullTable key={`${m}-${by}-${per.id}-${c.team}`} first={nameOf(by)} cols={cols} initial="cur" rows={rows} total={total} selected={dim ? c.filters[dim] : undefined} tint={dim ? DIM[dim].tint : "green"}
    onPick={dim && c.onPick ? (l) => c.onPick!(dim, l) : undefined} natural={by === "prio" || by === "pc"} find={`${/^[aeiou]/i.test(lowerOf(by)) ? "an" : "a"} ${lowerOf(by)}`} />;
}
/** The three report tables of a breakdown, each under its own title. */
function MeasureTables({ c, by }: { c: NCtx; by: By }) {
  return (
    <>
      {(["new", "rev", "avg"] as const).map((m) => (
        <Box key={m}><SubTitle>{MEASURE[m].title} {c.per.title}, by {lowerOf(by)}</SubTitle><MeasureTable c={c} by={by} m={m} /></Box>
      ))}
    </>
  );
}

type MRow = { label: string; cur: number; prev: number };
/** One measure month by month, the period itself at the end. */
function MonthTable({ c, which }: { c: NCtx; which: "n" | "rev" }) {
  const jan = monthOf(0, 0);
  const run = partial(c.cube);
  const M = MEASURE[which === "n" ? "new" : "rev"];
  const rows: MRow[] = monthsOf(c).map((m) => {
    const x = m.month >= jan ? MONTH_NAMES[m.month - jan] : monthLabel(c.cube, m.month);
    return { label: run && m.month === run.month ? `${x} (1 – ${run.day})` : x, cur: which === "n" ? m.n : m.rev, prev: which === "n" ? m.nPy : m.revPy };
  });
  const t = totalOf(c);
  const ys = new Set(monthsOf(c).map((m) => yearOfMonth(c.cube, m.month)));
  const [y0, y1] = ys.size === 1 ? [String([...ys][0]), `${[...ys][0] - 1}, same month`] : ["The month", "A year earlier, same month"];
  const cols: Col<MRow>[] = [
    { key: "cur", head: y0, tip: which === "n" ? "Companies whose first order ever was in the month" : "What the period's new customers so far bought in the month - the months add up to the period", cell: (r) => M.fmt(r.cur) },
    { key: "prev", head: y1, cell: (r) => M.fmt(r.prev) },
    { key: "diff", head: `Change ${vsOf(c)}`, cell: (r) => <ChangeText a={r.cur} b={r.prev} signed={M.signed} /> },
    { key: "pct", head: `Change ${vsOf(c)} in %`, cell: (r) => <ChangeText a={r.cur} b={r.prev} signed={M.signed} asPct /> },
  ];
  const [cur, prev] = which === "n" ? [t.n, t.nPy] : [t.rev, t.revPy];
  return <FullTable key={`months-${which}-${c.per.id}-${c.team}`} first="Month" cols={cols} rows={rows} total={{ label: perCap(c.per), cur, prev }} natural />;
}

/* ── every chart by its key: the tabs draw them, and so does the BUC View ── */

type TargetOf = { unit: "n" | "eur"; label: string };
type Drawn = { id: string; view: View; title: (c: NCtx) => string; draw: (c: NCtx, actions?: React.ReactNode) => React.ReactNode; target?: (c: NCtx) => TargetOf };
const teamPart = (c: NCtx) => (c.team === "total" ? "" : ` - ${teamName(c)}`);
const forWhom = (c: NCtx) => `${teamName(c)}'s target for ${c.per.title} - each team and period its own`;
/** A chart by its id "<tab>:<chart>": new, rev, avg on every tab; monnew, monrev on the Performis SAE's. */
function drawnOf(id: string): Drawn | undefined {
  const [v, chart = ""] = id.split(":");
  if (!isView(v)) return undefined;
  if (v === "sae" && (chart === "monnew" || chart === "monrev")) {
    const which = chart === "monnew" ? "n" : "rev";
    const title = (c: NCtx) => `${which === "n" ? "New customers" : "Revenue of the new customers"} ${c.per.title}, month by month${teamPart(c)}`;
    return { id, view: v, title, draw: (c, a) => <ChartBox title={title(c)} hint={monthsHint(c, which)} actions={a}><NewMonths c={c} which={which} target={targetFor(c, id)} /></ChartBox>,
      target: (c) => ({ unit: which === "n" ? "n" : "eur", label: `Each month's ${which === "n" ? "new customers" : "revenue of the new customers"} is measured against it - a line across the months; the running month is not counted · ${teamName(c)}'s target - each team its own.` }) };
  }
  if (!(chart in MEASURE)) return undefined;
  const m = chart as Measure, by = byOf(v);
  return { id, view: v, title: (c) => `${MEASURE[m].title} ${c.per.title}, by ${lowerOf(by)}${teamPart(c)}`, draw: (c, a) => <Board c={c} id={id} by={by} m={m} actions={a} />,
    target: (c) => ({ unit: MEASURE[m].unit, label: `Each ${lowerOf(by)}'s ${MEASURE[m].target} ${c.per.title} is measured against it · ${forWhom(c)}.` }) };
}
/** The old page's keys, still in some BUC Views, by what took their place. */
function chartOf(key: string): Drawn | undefined {
  const [, view = "", chart = ""] = key.split(":");
  const old: Record<string, string> = { "reps:count": "sae:new", "reps:revenue": "sae:rev", "type:groups": "type:new", "prio:groups": "prio:new", "assortment:groups": "pc:new" };
  return drawnOf(old[`${view}:${chart}`] ?? `${view}:${chart}`);
}

/* ── a tab: one card that follows it ───────────────────────────────────── */

type Act = (id: string, title: string, target?: TargetOf) => React.ReactNode;
const draw = (c: NCtx, act: Act, id: string) => { const d = drawnOf(id)!; return d.draw(c, act(id, d.title(c), d.target?.(c))); };

function TabCard({ c, act }: { c: NCtx; act: Act }) {
  const { view, cube, per } = c;
  const card = { display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" } as const;
  const against = `${perWords(cube, per)} against ${perWords(cube, per, 1)}`;
  const many = per.months >= 2;
  if (view === "sae") return (
    <GlassCard sx={card}>
      <CardTitle icon={per.months === 1 ? <TodayOutlinedIcon /> : <DateRangeOutlinedIcon />} tint="blue" title={`${teamName(c)}, ${per.title}`}
        note={`${against} · by Performis SAE - the sales agent Performis has on the customer, as its person`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, "sae:new")}{draw(c, act, "sae:rev")}</Box>
      {draw(c, act, "sae:avg")}
      {many && <Box sx={TWO}>{draw(c, act, "sae:monnew")}{draw(c, act, "sae:monrev")}</Box>}
      <MeasureTables c={c} by="sae" />
      {many && <Box><SubTitle>New customers {per.title}, month by month</SubTitle><MonthTable c={c} which="n" /></Box>}
      {many && <Box><SubTitle>Revenue of the new customers {per.title}, month by month</SubTitle><MonthTable c={c} which="rev" /></Box>}
    </GlassCard>
  );
  const by = byOf(view);
  const head = by === "pc" ? { icon: <CategoryOutlinedIcon />, tint: "green" as Tint } : { icon: DIM[by].icon, tint: DIM[by].tint };
  return (
    <GlassCard sx={card}>
      <CardTitle icon={head.icon} tint={head.tint} title={`${teamName(c)} by ${lowerOf(by)}, ${per.title}`} note={`${NOTES[view as Breakdown | "pc"]} · ${against}`} />
      <Box sx={{ ...TWO, mt: -1 }}>{draw(c, act, `${view}:new`)}{draw(c, act, `${view}:rev`)}</Box>
      {draw(c, act, `${view}:avg`)}
      <MeasureTables c={c} by={by} />
    </GlassCard>
  );
}
/** A tab's card is drawn again only when what it draws from changes. */
const TabCardKept = memo(TabCard, (a, b) => a.c === b.c);

/* ── the figures top right ─────────────────────────────────────────────── */

type Fig = { id: string; label: string; value: string; ch: number | null; sub: string; icon: React.ReactNode; tint: Tint; amount: number; unit: "n" | "eur" };
function figuresOf(c: NCtx): Fig[] {
  const t = totalOf(c);
  const was = perWords(c.cube, c.per, 1), P = c.per.title;
  return [
    { id: "fig-new", label: `New customers ${P}`, value: int(t.n), ch: changeOf(t.n, t.nPy), sub: `${int(t.nPy)} in ${was}`, icon: <PersonAddAltOutlinedIcon />, tint: "blue", amount: t.n, unit: "n" },
    { id: "fig-rev", label: `Their revenue ${P}`, value: eur(t.rev), ch: changeOf(t.rev, t.revPy), sub: `${eur(t.revPy)} in ${was}`, icon: <EuroOutlinedIcon />, tint: "purple", amount: t.rev, unit: "eur" },
    { id: "fig-avg", label: "Ø revenue per new customer", value: t.n ? eur(avg(t)) : "—", ch: t.n && t.nPy ? changeOf(avg(t), avgPy(t)) : null, sub: `${t.nPy ? `${eur(avgPy(t))} per customer` : "—"} in ${was}`, icon: <PaidOutlinedIcon />, tint: "green", amount: avg(t), unit: "eur" },
  ];
}
function FigureCards({ c, items, big, actions }: { c: NCtx; items: Fig[]; big?: boolean; actions?: (f: Fig) => React.ReactNode }) {
  return (
    <Box sx={big
      ? { display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: `repeat(${items.length}, minmax(0, 1fr))` }, minWidth: 0 }
      : { display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${items.length}, minmax(150px, 212px))` }, flex: "0 1 auto" }}>
      {items.map((f) => {
        const tgt = actions ? targetFor(c, `panel:${f.id}`) : null;
        return (
          <Box key={f.id} sx={{ ...glass, borderRadius: big ? "20px" : "16px", px: big ? 2.25 : 1.5, py: big ? 2.25 : 1.1, minWidth: 0, display: "grid", gap: big ? 0.75 : 0.25, alignContent: "start" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: big ? 1.25 : 0.75 }}>
              <Badge icon={f.icon} tint={f.tint} size={big ? 32 : 22} />
              <Typography sx={{ flex: 1, minWidth: 0, fontSize: big ? "0.86rem" : "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{f.label}</Typography>
              {actions?.(f)}
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: big ? "1.6rem" : "1.15rem", fontWeight: 700, color: INK, lineHeight: big ? 1.05 : 1.25, letterSpacing: big ? "-0.03em" : "-0.01em", fontVariantNumeric: "tabular-nums" }}>{f.value}</Typography>
              {f.ch != null && <Typography sx={{ fontSize: big ? "0.82rem" : "0.76rem", fontWeight: 700, color: tone(f.ch) }}>{signedPct(f.ch)}</Typography>}
            </Box>
            <Typography sx={{ fontSize: big ? "0.74rem" : "0.7rem", color: FAINT, lineHeight: 1.3 }}>{f.sub}</Typography>
            {tgt != null && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: f.amount >= tgt ? GREEN : RED }}>{pct(f.amount / tgt)} of the target {f.unit === "eur" ? eur(tgt) : int(tgt)}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

function Waiting({ computing, progress, error, picked, again }: { computing: boolean; progress?: string; error?: string; picked?: boolean; again?: boolean }) {
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {computing && !error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>
          {error ? `The figures could not be read: ${error}`
            : again ? `Reading every company in HubSpot again for what the new customers bought - a few minutes, once${progress ? ` · ${progress}` : ""}…`
              : `Reading ${picked ? "the customers chosen" : "every company"} in HubSpot - first orders and revenue${progress ? ` · ${progress}` : ""}…`}
        </Typography>
      </Box>
    </GlassCard>
  );
}
/** A cube read before the new customers' revenue was in it (until the first read after the deployment). */
const tooOld = (cube: Cube) => !cube.newRevenue || !cube.saeTeams;
const FILTER_DIMS: Dim[] = ["prio", "segment", "potential", "country", "sae", "type", "apic", "mandant"];
const viewOf = (x: string | null): View => (isView(x) ? x : "sae");

export function NewCustomersExplorer() {
  const params = useSearchParams();
  // the customers chosen: the cube of those alone, each its own ?company=… in the address (as the Figures)
  const companies = useMemo(() => params.getAll("company").filter((x) => /^\d+$/.test(x)).slice(0, 50), [params]);
  const { cube, computing, progress, error } = useCustomersCube(companies);
  const names = useCompanyNames(companies);
  const [teamKey, setTeam] = useTeam();
  const [leadKey, setLead] = useLead();
  const lt = useLeads();
  const leads = lt?.byName ?? null, teams = lt?.teams ?? [];
  const { state: acts } = useActions("eso-new-customers");
  const view = viewOf(params.get("view"));
  const setView = (v: View) => setQuery((q) => { if (v === "sae") q.delete("view"); else q.set("view", v); });
  const setWin = (w: Win) => setQuery((q) => {
    if (!cube) return;
    const ytd = ytdWin(cube);
    if (w.start === ytd.start && w.end === ytd.end) { q.delete("from"); q.delete("to"); } else { q.set("from", ym(cube, w.start)); q.set("to", ym(cube, w.end)); }
  });
  const filters: Filters = useMemo(() => Object.fromEntries(DIMS.flatMap((d) => (d !== "owner" && params.getAll(d).length ? [[d, params.getAll(d)]] : []))), [params]);
  const toggle = (d: Dim, label: string) => setQuery((q) => {
    const cur = q.getAll(d), next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
    q.delete(d);
    for (const x of next) q.append(d, x);
  });
  const clearAll = () => setQuery((q) => { for (const d of DIMS) q.delete(d); q.delete("company"); });
  const pick: CustomerPick = {
    chosen: companies.map((id) => names[id] ?? { id, name: `Company ${id}`, country: null, erpId: null }),
    add: (co) => setQuery((q) => { if (!q.getAll("company").includes(co.id)) q.append("company", co.id); }),
    remove: (id) => setQuery((q) => { const keep = q.getAll("company").filter((x) => x !== id); q.delete("company"); for (const x of keep) q.append("company", x); }),
  };
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<{ dim: Dim; n: number } | null>(null);
  const openOn = (d: Dim) => { setFocus((f) => ({ dim: d, n: (f?.n ?? 0) + 1 })); setPanel(true); };

  const back = (
    <Box component={Link} href="/reporting/eso-benchmark" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, justifySelf: "start", "&:hover": { color: INK } }}>
      <ArrowBackIcon sx={{ fontSize: 18 }} /> Back to BUC View
    </Box>
  );
  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  // the work a click asks for, kept - the tabs and toggles answer at once, the charts follow (as the Figures)
  const lead = leadOf(teamKey, leadKey, lt);
  const fromP = params.get("from"), toP = params.get("to");
  const live = cube && !tooOld(cube) ? cube : null;
  const eff = useMemo(() => (live ? withTeam(live, filters, teamKey, lead, leads) : null), [live, filters, teamKey, lead, leads]);
  const per = useMemo(() => {
    if (!live) return null;
    const a0 = fromYm(live, fromP), b0 = fromYm(live, toP);
    return a0 != null && b0 != null ? perOf(live, clampWindow(live, { start: a0, end: b0 })) : perOf(live, ytdWin(live));
  }, [live, fromP, toP]);
  const want = useMemo(() => ({ view, per, eff, team: teamKey, lead, filters }), [view, per, eff, teamKey, lead, filters]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const c = useMemo<NCtx | null>(() => (live && drawn.per && drawn.eff ? {
    cube: live, team: drawn.team, view: drawn.view, per: drawn.per, filters: drawn.filters, eff: drawn.eff, lead: drawn.lead, leads, teams,
    targets: acts?.targets, onPick: toggle, onBar: (d, l) => { toggle(d, l); openOn(d); }, onFilter: openOn,
  } : null), [live, drawn, leads, teams, acts?.targets]); // eslint-disable-line react-hooks/exhaustive-deps
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);
  if (!cube || tooOld(cube) || !c || !per) return (
    <Box sx={shell}>
      {back}
      <Typography component="h1" sx={H1}>New customers</Typography>
      <Waiting computing={computing || (!!cube && tooOld(cube))} progress={progress} error={error} picked={companies.length > 0} again={!!cube && tooOld(cube)} />
    </Box>
  );
  const active = chosenDims(filters);
  const chosen = active.flatMap((x) => (filters[x] ?? []).map((v) => [x, v] as const));
  // the tile toolbar per chart, keyed "eso-new-customers:<tab>:<chart>"; the team, filters and period go with it, its target per team and period
  const act: Act = (id, title, target) => (
    <TileActions where="tab" start="tab" edge={2}
      tile={{ key: `eso-new-customers:${id}`, page: "eso-new-customers", tab: c.view, title, summary: `${teamName(c)} · ${perWords(cube, c.per)}`,
        filters: { ...Object.fromEntries(chosenDims(c.filters).map((d) => [d, c.filters[d] ?? []])), team: [c.team], ...(c.lead ? { lead: [c.lead] } : {}), ...perFilters(cube, c.per) }, kind: "card",
        target: target ? { key: targetKey(id, c.team, c.lead, c.per), ...target } : undefined }} />
  );
  const now = { team: teamKey, lead, teams };
  const filterCount = chosen.length + companies.length + (per.id !== "ytd" ? 1 : 0);
  return (
    <Box sx={shell}>
      {back}
      {/* the title, what is shown and ESO | TSA | Total on the left; the figures top right - one block, no gap under it (SARCLA 29.10.2026: "too much top padding") */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
          <Typography component="h1" sx={H1}>New customers</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{teamName(now)}</b>{teamKey !== "total" ? " by Performis SAE" : ""} · {per.title} <b style={{ color: INK }}>{perWords(cube, per)}</b> - against {perWords(cube, per, 1)}{computing ? " · reading HubSpot again" : ""}
          </Typography>
          {(chosen.length > 0 || per.id !== "ytd" || pick.chosen.length > 0) && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {pick.chosen.map((co) => (
                <Chip key={`customer:${co.id}`} size="small" label={<span><b>Customer:</b> {co.name}</span>} onDelete={() => pick.remove(co.id)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.slate.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.slate.fg } }} />
              ))}
              {per.id !== "ytd" && (
                <Chip size="small" label={<span><b>Period:</b> {perCap(per)}</span>} onDelete={() => setWin(ytdWin(cube))} onClick={() => setPanel(true)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT.blue.fg } }} />
              )}
              {chosen.map(([x, v]) => (
                <Chip key={`${x}:${v}`} size="small" label={<span><b>{DIM[x].name}:</b> {v}</span>} onDelete={() => toggle(x, v)}
                  sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT[DIM[x].tint].bg, color: INK, "& .MuiChip-deleteIcon": { color: TINT[DIM[x].tint].fg } }} />
              ))}
              {chosen.length + pick.chosen.length > 0 && <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>}
            </Box>
          )}
          <Box sx={{ display: "grid", gap: 0.75, mt: 0.5 }}>
            <Teams team={teamKey} onTeam={setTeam} lead={leadKey} onLead={setLead} teams={teams} />
            {lead && leads && membersOf(cube, "eso", lead, leads)?.length === 0 && <NoLeadYet name={teamName(now)} />}
          </Box>
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}>
          <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease" }}><FigureCards c={c} items={figs} /></Box>
        </Box>
      </Box>
      {/* the tabs, and at their right end Views and Filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto", "& [role=tab]": { px: { xs: 1, xl: 1.5 } } }}>
          <ReportTabs name="eso-new-customers" tab={view} onSelect={setView}
            tabs={VIEWS.map((v) => { const d = v.id === "pc" ? null : v.id; return { id: v.id, label: v.label, count: d && filters[d]?.length ? String(filters[d]!.length) : null }; })} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="eso-new-customers" /></Box>
        <Button onClick={() => { if (panel) setPanel(false); else if (view !== "pc") openOn(view); else setPanel(true); }} variant={panel || filterCount ? "contained" : "outlined"} disableElevation
          aria-expanded={panel} aria-controls="eso-new-customers-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || filterCount ? undefined : "#fff" }}>
          Filters{filterCount ? ` · ${filterCount}` : ""}
        </Button>
      </Box>

      <Box sx={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
        <TabCardKept key={`${c.view}-${c.per.id}`} c={c} act={act} />
      </Box>

      <FilterWindow id="eso-new-customers-filters" period dims={FILTER_DIMS} open={panel} onClose={() => setPanel(false)} focus={focus} cube={cube}
        win={per.win} setWin={setWin} filters={filters} toggle={toggle} customers={pick} clearAll={() => { clearAll(); setWin(ytdWin(cube)); }} />
    </Box>
  );
}

/* ── the BUC View's New customers panel ────────────────────────────────── */

const GRID = { display: "grid", gap: 1.5, gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoFlow: "row" } as const;
/** The panel's own cards and month chart: their tile keys */
const PANEL = "eso-new-customers:panel:";

/** New customers in the BUC View: the year to date for the team the toggle shows, the months, and the charts sent here. */
export function NewCustomersPanel({ acts }: { acts: ActionsState | null }) {
  const { cube, computing, progress, error } = useCustomersCube();
  const [teamKey, setTeam] = useState<TeamKey>("eso");
  const [leadKey, setLeadKey] = useState<LeadKey>("all");
  const lt = useLeads();
  const leads = lt?.byName ?? null, teams = lt?.teams ?? [];
  useEffect(() => {
    try { const x = asTeam(localStorage.getItem(KEPT)); if (x) setTeam(x); const l = asLead(localStorage.getItem(KEPT_LEAD)); if (l) setLeadKey(l); } catch { /* ESO */ }
  }, []);
  const choose = (t: TeamKey) => { setTeam(t); try { localStorage.setItem(KEPT, t); } catch { /* here only */ } };
  const chooseLead = (l: LeadKey) => { setLeadKey(l); try { localStorage.setItem(KEPT_LEAD, l); } catch { /* here only */ } };
  const lead = leadOf(teamKey, leadKey, lt);
  const want = useMemo(() => ({ team: teamKey, lead }), [teamKey, lead]);
  const drawn = useDeferredValue(want);
  const stale = drawn !== want;
  const ready = cube && !tooOld(cube) ? cube : null;
  const c = useMemo<NCtx | null>(() => (ready ? { cube: ready, team: drawn.team, view: "sae", per: perOf(ready, ytdWin(ready)), filters: {}, eff: withTeam(ready, {}, drawn.team, drawn.lead, leads), lead: drawn.lead, leads, teams, targets: acts?.targets } : null),
    [ready, drawn, leads, teams, acts?.targets]);
  // every chart here follows the panel's ESO | TSA | Total and its line managers' teams (as the Figures' panel); its filters and period stay as sent
  const items: SortItem[] = useMemo(() => !c ? [] : (acts?.placements ?? []).filter((x) => x.placement === "nutshell" && x.spec.page === "eso-new-customers" && !x.spec.key.startsWith(PANEL)).map(({ spec }) => {
    const ch = chartOf(spec.key);
    const fmt = formatOf(acts, spec);
    const sf: Filters = Object.fromEntries(DIMS.flatMap((d) => (d !== "owner" && spec.filters?.[d]?.length ? [[d, spec.filters[d]]] : [])));
    const sp = perFromFilters(c.cube, spec.filters) ?? c.per;
    const sc: NCtx = { ...c, view: ch?.view ?? "sae", per: sp, filters: sf, eff: withTeam(c.cube, sf, c.team, c.lead, leads), half: fmt === "half" };
    const target = ch?.target ? { key: targetKey(ch.id, c.team, c.lead, sp), ...ch.target(sc) } : undefined;
    const actions = <TileActions where="nutshell" start="tab" edge={2} tile={{ key: spec.key, page: spec.page, tab: spec.tab, title: spec.title, filters: spec.filters, href: spec.href, kind: spec.kind, target }} />;
    return { key: spec.key, block: true, sx: fmt === "half" ? { gridColumn: { xs: "span 12", md: "span 6" } } : { gridColumn: "1 / -1" },
      node: ch ? ch.draw(sc, actions) : <GlassCard><CardTitle icon={<PersonAddAltOutlinedIcon />} tint="blue" title={spec.title} note="This card is no longer on its page - Actions takes it off here." right={actions} /></GlassCard> };
  }), [c, acts, leads]);
  const save = (keys: string[]) => { void send("/api/reporting/kpi-actions/order", "POST", { scope: "nutshell:eso-new-customers", keys }).catch(() => {}).finally(() => { void refreshActions(); }); };
  const figs = useMemo(() => (c ? figuresOf(c) : []), [c]);
  // the panel's own cards and month chart have their Actions too: tasks, a target - and taken off the BUC View there, they stay off
  const shown = (id: string) => placementOf(acts, `${PANEL}${id}`, "nutshell") === "nutshell";
  const own = (id: string, title: string, kind: "kpi" | "card", target?: { key: string; unit: "n" | "eur"; label: string }) => (
    <TileActions where="nutshell" start="nutshell" edge={2} tile={{ key: `${PANEL}${id}`, page: "eso-new-customers", tab: "sae", title: `${title}${c && c.team !== "total" ? ` - ${teamName(c)}` : ""}`, kind,
      filters: { team: [drawn.team], ...(drawn.lead ? { lead: [drawn.lead] } : {}), period: ["ytd"] }, href: `/reporting/eso-benchmark/new-customers?team=${drawn.team}${drawn.lead ? `&lead=${drawn.lead}` : ""}`, target }} />
  );
  const months = drawnOf("sae:monnew")!;
  return (
    <GlassCard sx={{ display: "grid", gap: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Badge icon={<PersonAddAltOutlinedIcon />} tint="blue" size={42} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box component={Link} href={`/reporting/eso-benchmark/new-customers?team=${teamKey}${lead ? `&lead=${lead}` : ""}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: INK, textDecoration: "none", "&:hover .chev": { transform: "translateX(3px)" }, "&:hover": { color: TINT.blue.fg } }}>
            <Typography sx={{ fontSize: "1.12rem", fontWeight: 650, letterSpacing: "-0.02em" }}>New customers</Typography>
            <ChevronRightIcon className="chev" sx={{ fontSize: 22, color: TINT.blue.fg, transition: "transform .15s ease" }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{c ? `${teamName({ team: teamKey, lead, teams })}${teamKey !== "total" ? " by Performis SAE" : ""} · year to date ${perWords(c.cube, c.per)} - against ${perWords(c.cube, c.per, 1)} · first order ever` : "First order ever"}</Typography>
        </Box>
        <Teams team={teamKey} onTeam={choose} lead={leadKey} onLead={chooseLead} teams={teams} />
      </Box>
      {c && lead && leads && membersOf(c.cube, "eso", lead, leads)?.length === 0 && <NoLeadYet name={teamName(c)} />}
      {!c ? <Waiting computing={computing || (!!cube && tooOld(cube))} progress={progress} error={error} again={!!cube && tooOld(cube)} /> : (
        <Box sx={{ display: "grid", gap: 2.25, opacity: stale ? 0.55 : 1, transition: "opacity .15s ease", minWidth: 0 }} aria-busy={stale}>
          <FigureCards c={c} big items={figs.filter((f) => shown(f.id))}
            actions={(f) => own(f.id, f.label, "kpi", { key: targetKey(`panel:${f.id}`, c.team, c.lead, c.per), unit: f.unit, label: `${f.label} is measured against it · ${teamName(c)}'s target - each team its own.` })} />
          {shown("monnew") && months.draw(c, own("monnew", "New customers year to date, month by month", "card", months.target ? { key: targetKey(months.id, c.team, c.lead, c.per), ...months.target(c) } : undefined))}
          {items.length > 0 && <SortableGrid items={items} order={acts?.orders?.["nutshell:eso-new-customers"]} canMove={!!acts?.canWrite} onMove={save} sx={GRID} />}
        </Box>
      )}
    </GlassCard>
  );
}

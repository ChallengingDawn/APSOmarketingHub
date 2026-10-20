"use client";
// HAND-OVER TO ESO/TSA - HOW THE TEAMS HANDLE THE TICKET LEADS (SARCLA 19.10.2026: "the concept is a little
// wrong - the idea is a view on what they do with the leads they handle, how they handle them, what the win
// rate is; I want to see how the teams perform with ticket leads"). Laid out as Lead Generation: the title
// with its figures top right, tabs - teams, months, outcomes, channels, countries, people - and the Filters
// window. Every card is drawn from the tickets, the filters and the months alone (CARDS), so a promoted one is
// the same graph in the nutshell (HandoverPromoted). The rules are in handoverCube.ts.
// 19.10 later: "ticket leads" (SARCLA: "call it ticket leads?"), what counts said on the page, special price
// requests out, ESO and TSA side by side as graphs (the table "is shit"), won-lost-open per team and why lost.
// 19.10 night: the customers' requests or the UC hand-overs, never both ("a separate graph, no mix up"); a call
// is a first contact too; the lost and the closed otherwise broken down by reason; misassigned left out; "Win
// rate by person" and the "figures" tables are cards of their own.
// Later that night (SARCLA: "the UC hand-overs would replace completely the cart & checkout - then we keep the
// customer requests only at Hand-over ESO/TSA, and we don't have the graph problem any more"): two pages from
// this one - Hand-over to ESO/TSA (the customers' requests, slug handover) and UC hand-overs (slug uc), each with
// its own card keys, so a card of each can be in the nutshell. The diagram: team, first contact, outcome, why.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import ForwardToInboxOutlinedIcon from "@mui/icons-material/ForwardToInboxOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import HourglassBottomOutlinedIcon from "@mui/icons-material/HourglassBottomOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";

import { Badge, CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { Sankey } from "@/app/charts/Sankey";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import {
  CHANNELS, GROUPS, OUTCOMES, channelLabel, emptyStats, flowOf, inDayRate, inWin, keep, kindsOf, median, statsBy, statsOf, winRate,
  type Group, type HFilters, type HFlowNode, type HandoverData, type Outcome, type Stats,
} from "@/lib/marketingKpis/handoverCube";
import type { TileSpec } from "@/lib/reporting/kpiActions";
import { MONTHS, everyWhileSeen, useSlow, type MkState, type MonthWindow } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { PeriodPicker, Table, change, monthsLabel, n0, ratio } from "./ExplorerKit";
import { HALF_ROWS, Paged, Pick } from "./Lead";
import { TileActions } from "./tiles/TileActions";
import { SavedViews } from "./tiles/SavedViews";

type Tab = "teams" | "months" | "outcomes" | "channels" | "countries" | "people";
const TABS: { id: Tab; label: string }[] = [
  { id: "teams", label: "Teams" },
  { id: "months", label: "Months" },
  { id: "outcomes", label: "Outcomes" },
  { id: "channels", label: "Channels" },
  { id: "countries", label: "Countries" },
  { id: "people", label: "People" },
];
const TEAMS = ["ESO", "TSA"] as const;
const FOCUS = ["Switzerland", "Germany", "Italy", "France", "Austria", "Netherlands", "Liechtenstein", "Poland"];
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 10) / 10}%`);
const hours = (v: number | null) => (v == null ? "—" : `${v < 10 ? v.toFixed(1) : Math.round(v)} h`);

/** A year earlier counts only when every month chosen has its tickets then - the pipelines started in July 2025. */
function yearEarlierOk(d: HandoverData, w: MonthWindow): boolean {
  const per = new Map<string, number>();
  for (const r of d.rows) if (inWin(r.m, d.year - 1, w)) per.set(r.m, (per.get(r.m) ?? 0) + 1);
  for (let m = w.start; m <= w.end; m++) if ((per.get(`${d.year - 1}-${String(m + 1).padStart(2, "0")}`) ?? 0) < 50) return false;
  return true;
}

/** The figures top right. */
function Figures({ cur, prev, py, group }: { cur: Stats; prev: Stats; py: boolean; group: Group }) {
  const items: { label: string; icon: React.ReactNode; tint: Tint; v: string; d?: { text: string; color: string } | null; sub: string }[] = [
    { label: groupName(group), icon: <ForwardToInboxOutlinedIcon />, tint: "blue", v: n0(cur.incoming), d: py ? change(cur.incoming, prev.incoming) : null, sub: `${n0(cur.closed)} closed · ${n0(cur.open)} open` },
    { label: "Contacted in a working day", icon: <TimerOutlinedIcon />, tint: "amber", v: pct(inDayRate(cur)), sub: `a reply or a call · median ${hours(median(cur.firstHours))}` },
    { label: "Win rate", icon: <EmojiEventsOutlinedIcon />, tint: "green", v: pct(winRate(cur)), sub: `${n0(cur.won)} won of ${n0(cur.resolved)} closed` },
    { label: "Still open", icon: <HourglassBottomOutlinedIcon />, tint: "purple", v: n0(cur.open), sub: `${n0(cur.stale)} open more than 30 days` },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(130px, 180px))" } }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{it.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{it.v}</Typography>
            {it.d && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: it.d.color }}>{it.d.text}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── a horizontal bar of parts per row: what became of each team's, channel's, country's, person's leads ── */

const OUTCOME_COLOR: Record<Outcome, string> = {
  won: SERIES[2], price: SERIES[1], supply: "#c0571f", delivery: "#e9a07a", info: SERIES[3], noreply: "#d9b65c", disq: "#8f99a6", other: "#c9cfd8", nores: "#e3e7ed", open: DEEMPHASIS,
};

/** "Customer requests" or "UC hand-overs" - the page never mixes the two. */
const groupName = (g: Group) => GROUPS.find((x) => x.id === g)!.label;
/** the same inside a sentence: "customer requests", "UC hand-overs" */
const groupWords = (g: Group) => (g === "uc" ? "UC hand-overs" : "customer requests");
const groupOfF = (f: HFilters): Group => (f.kind?.length && f.kind.every((k) => k !== "request") ? "uc" : "requests");

function Legend() {
  return (
    <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap" }}>
      {OUTCOMES.map((o) => (
        <Box key={o.id} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: OUTCOME_COLOR[o.id] }} />
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{o.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function OutcomeBars({ rows, page = 12 }: { rows: { key: string; label: string; s: Stats }[]; page?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.s.incoming));
  return (
    <Paged items={rows} size={page}>
      {(list) => (
        <Box sx={{ display: "grid", gap: 0.9 }}>
          {list.map((r) => (
            <Box key={r.key} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(120px, 210px) minmax(0, 1fr) auto" }, gap: { xs: 0.4, md: 1.5 }, alignItems: "center" }}>
              <Typography noWrap title={r.label} sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{r.label}</Typography>
              <Box sx={{ display: "flex", gap: "2px", height: 18, width: `${(r.s.incoming / max) * 100}%`, minWidth: 8 }}>
                {OUTCOMES.filter((o) => r.s.outcomes[o.id] > 0).map((o, i, all) => (
                  <Box key={o.id} title={`${o.label}: ${n0(r.s.outcomes[o.id])} (${ratio(r.s.outcomes[o.id], r.s.incoming)})`}
                    sx={{ flex: `${r.s.outcomes[o.id]} 0 0`, minWidth: 2, bgcolor: OUTCOME_COLOR[o.id], borderRadius: i === all.length - 1 ? "0 4px 4px 0" : 0 }} />
                ))}
              </Box>
              <Box sx={{ textAlign: { md: "right" }, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{n0(r.s.incoming)}</Typography>
                <Typography sx={{ fontSize: "0.7rem", color: FAINT, whiteSpace: "nowrap" }}>{pct(winRate(r.s))} won</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paged>
  );
}

const twinOf = (rows: { label: string; s: Stats }[]) => ({
  columns: ["", "Tickets", ...OUTCOMES.map((o) => o.label), "Win rate"],
  rows: rows.map((r) => [r.label, r.s.incoming, ...OUTCOMES.map((o) => r.s.outcomes[o.id]), pct(winRate(r.s))]),
  numeric: [1, ...OUTCOMES.map((_, i) => i + 2)],
});

/* ── the cards ─────────────────────────────────────────────────────────── */

type Ctx = {
  d: HandoverData; f: HFilters; win: MonthWindow; py: boolean; actions?: React.ReactNode; onChannel?: (id: string) => void; onCountry?: (k: string) => void;
  /** drawn at half width in the nutshell: the compact form - a few rows a page, the first card of a pair (Lead's HALF_ROWS) */
  half?: boolean;
};

const TONE: Record<HFlowNode["tone"], string> = { source: SERIES[0], eso: "#1c5cab", tsa: SERIES[1], good: SERIES[2], bad: "#c0571f", none: DEEMPHASIS };

function FlowCard({ d, f, win, actions }: Ctx) {
  const fl = flowOf(d, win, f);
  const label = new Map(fl.nodes.map((n) => [n.id, n.label]));
  const title = `What happens to the ${groupWords(groupOfF(f))}`;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<AltRouteIcon />} tint="blue" title={title} note={`${monthsLabel(win)} ${d.year} · which team got each, how fast the first contact came (a reply in the ticket or a call), what became of it - and why, for the lost and the closed otherwise · how they came in is on the ${groupOfF(f) === "uc" ? "Use cases" : "Channels"} tab · hover a band for its count`} right={actions} />
      <ChartFrame table={{ columns: ["From", "To", "Tickets"], rows: fl.links.map((l) => [label.get(l.from) ?? l.from, label.get(l.to) ?? l.to, l.value]), numeric: [2] }} empty={fl.nodes.length ? null : "No tickets for this choice."}>
        <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
          <Box sx={{ minWidth: 980 }}>
            <Sankey height={460} columns={fl.columns} label={title} links={fl.links}
              nodes={fl.nodes.map((n) => ({ id: n.id, column: n.column, label: n.label, color: TONE[n.tone] }))} />
          </Box>
        </Box>
      </ChartFrame>
    </GlassCard>
  );
}

const TEAM_COLOR: Record<string, string> = { ESO: SERIES[0], TSA: SERIES[1] };

/**
 * ESO and TSA side by side, as graphs: each figure a small graph with the two teams' bars, the better of the
 * two in green (SARCLA 19.10: the table "is shit").
 */
function CompareCard({ d, f, win, actions, half }: Ctx) {
  const by = statsBy(d, win, f, (r) => r.t);
  const of = (t: string) => by.get(t)?.cur ?? emptyStats();
  const share = (n: number, base: number) => (base ? (n / base) * 100 : null);
  const metrics: { title: string; note: string; v: (s: Stats) => number | null; fmt: (v: number | null) => string; max?: number; up?: boolean }[] = [
    { title: groupName(groupOfF(f)), note: "came in", v: (s) => s.incoming, fmt: (v) => n0(v) },
    { title: "Contacted within a working day", note: "a reply in the ticket or a call", v: inDayRate, fmt: pct, max: 100, up: true },
    { title: "Median first contact", note: "working hours to the first reply or call", v: (s) => median(s.firstHours), fmt: hours, up: false },
    { title: "No reply, no call", note: "neither a reply in the ticket nor a call logged on it", v: (s) => share(s.noReply, s.incoming), fmt: pct, max: 100, up: false },
    { title: "Win rate", note: "won of the closed with a resolution", v: winRate, fmt: pct, max: 100, up: true },
    { title: "Open for more than 30 days", note: "of those still open", v: (s) => share(s.stale, s.open), fmt: pct, max: 100, up: false },
  ];
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="ESO and TSA side by side" note={`${monthsLabel(win)} ${d.year} · ${groupWords(groupOfF(f))} · the same six figures for both teams - the better of the two in green`} right={actions} />
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", [half ? "xl" : "lg"]: "repeat(3, minmax(0, 1fr))" } }}>
        {metrics.map((m) => {
          const a = m.v(of("ESO")), b = m.v(of("TSA"));
          const top = m.max ?? Math.max(a ?? 0, b ?? 0, 1);
          const better = m.up == null || a == null || b == null || a === b ? null : (a > b) === m.up ? "ESO" : "TSA";
          return (
            <Box key={m.title} sx={{ ...glass, borderRadius: "16px", p: 1.75, display: "grid", gap: 1, alignContent: "start", minWidth: 0 }}>
              <Box>
                <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>{m.title}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{m.note}</Typography>
              </Box>
              {([["ESO", a], ["TSA", b]] as const).map(([t, v]) => (
                <Box key={t} sx={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) 64px", gap: 1, alignItems: "center" }}>
                  <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: MUTED }}>{t}</Typography>
                  <Box sx={{ height: 14, bgcolor: "rgba(21,34,58,.05)", borderRadius: "0 4px 4px 0" }}>
                    <Box sx={{ height: "100%", width: `${v == null ? 0 : Math.max(2, Math.min(100, (v / top) * 100))}%`, bgcolor: TEAM_COLOR[t], borderRadius: "0 4px 4px 0" }} />
                  </Box>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, textAlign: "right", color: better === t ? GREEN : INK, fontVariantNumeric: "tabular-nums" }}>{m.fmt(v)}</Typography>
                </Box>
              ))}
            </Box>
          );
        })}
      </Box>
    </GlassCard>
  );
}

const monthsOf = (d: HandoverData, win: MonthWindow) => MONTHS.slice(0, Math.max(win.end + 1, 1));

function MonthVolumeCard({ d, f, win, actions }: Ctx) {
  const by = statsBy(d, { start: 0, end: 11 }, f, (r) => `${r.m.slice(5, 7)}|${r.t}`);
  const data = monthsOf(d, win).map((x, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return { x, ESO: by.get(`${mm}|ESO`)?.cur.incoming ?? 0, TSA: by.get(`${mm}|TSA`)?.cur.incoming ?? 0 };
  });
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<TimelineOutlinedIcon />} tint="blue" title={`${groupName(groupOfF(f))} by month`} note={`${d.year}, ESO and TSA - the running month so far`} right={actions} />
      <ChartFrame table={{ columns: ["Month", "ESO", "TSA"], rows: data.map((m) => [m.x, m.ESO, m.TSA]), numeric: [1, 2] }}>
        <StackedColumns height={240} format={(v) => n0(v)} data={data} parts={[{ key: "ESO", label: "ESO" }, { key: "TSA", label: "TSA" }]} />
      </ChartFrame>
    </GlassCard>
  );
}

function MonthRateCard({ d, f, win, actions, which }: Ctx & { which: "win" | "speed" }) {
  const by = statsBy(d, { start: 0, end: 11 }, f, (r) => `${r.m.slice(5, 7)}|${r.t}`);
  const val = (s?: Stats) => (s ? (which === "win" ? winRate(s) : inDayRate(s)) : null);
  const data = monthsOf(d, win).map((x, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return { x, current: val(by.get(`${mm}|ESO`)?.cur), prior: val(by.get(`${mm}|TSA`)?.cur), partial: false };
  });
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={which === "win" ? <EmojiEventsOutlinedIcon /> : <TimerOutlinedIcon />} tint={which === "win" ? "green" : "amber"}
        title={which === "win" ? "Win rate by month" : "Contacted within a working day, by month"}
        note={which === "win" ? `${d.year} · ${groupWords(groupOfF(f))} · of those that came in that month and are closed with a resolution - the newest months are still being worked` : `${d.year} · ${groupWords(groupOfF(f))} · a reply in the ticket or a call within a working day`} right={actions} />
      <ChartFrame table={{ columns: ["Month", "ESO", "TSA"], rows: data.map((m) => [m.x, pct(m.current), pct(m.prior)]), numeric: [1, 2] }}>
        <GroupedColumns height={240} format={pct} data={data} currentLabel="ESO" priorLabel="TSA" />
      </ChartFrame>
    </GlassCard>
  );
}

const LOST_IDS: Outcome[] = ["price", "supply", "delivery", "info", "noreply", "disq"];
const BIG: { id: string; label: string; color: string; of: (s: Stats) => number }[] = [
  { id: "won", label: "Won", color: SERIES[2], of: (s) => s.outcomes.won },
  { id: "lost", label: "Lost or disqualified", color: SERIES[1], of: (s) => LOST_IDS.reduce((a, k) => a + s.outcomes[k], 0) },
  { id: "other", label: "Closed otherwise", color: "#c9cfd8", of: (s) => s.outcomes.other },
  // most of them TSA's helpline and Back Office tickets of January and February, before the resolution was asked for
  { id: "nores", label: "No resolution set", color: "#e3e7ed", of: (s) => s.outcomes.nores },
  { id: "open", label: "Still open", color: DEEMPHASIS, of: (s) => s.outcomes.open },
];

/** Won, lost or still open - each team's ticket leads as one bar of 100% (SARCLA 19.10: the nine-part bars were not clear). */
function SplitCard({ d, f, win, actions }: Ctx) {
  const by = statsBy(d, win, f, (r) => r.t);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<FactCheckOutlinedIcon />} tint="purple" title="Won, lost or still open" note={`${monthsLabel(win)} ${d.year} · each team's ${groupWords(groupOfF(f))} - why lost and how closed otherwise are in the cards below; "no resolution set" are mostly TSA's tickets of January and February, before the resolution was asked for`} right={actions} />
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {BIG.map((g) => (
          <Box key={g.id} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: g.color }} />
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{g.label}</Typography>
          </Box>
        ))}
      </Box>
      <ChartFrame table={{ columns: ["Team", "Tickets", ...BIG.map((g) => g.label)], rows: TEAMS.map((t) => { const s = by.get(t)?.cur ?? emptyStats(); return [t, s.incoming, ...BIG.map((g) => `${n0(g.of(s))} (${ratio(g.of(s), s.incoming)})`)]; }), numeric: [1] }}>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {TEAMS.map((t) => {
            const s = by.get(t)?.cur ?? emptyStats();
            return (
              <Box key={t} sx={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) auto", gap: 1.5, alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK }}>{t}</Typography>
                <Box sx={{ display: "flex", gap: "2px", height: 30, borderRadius: "8px", overflow: "hidden" }}>
                  {BIG.filter((g) => g.of(s) > 0).map((g) => {
                    const sh = s.incoming ? g.of(s) / s.incoming : 0;
                    return (
                      <Box key={g.id} title={`${g.label}: ${n0(g.of(s))} (${ratio(g.of(s), s.incoming)})`}
                        sx={{ flex: `${g.of(s)} 0 0`, minWidth: 3, bgcolor: g.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {sh > 0.08 && <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: g.id === "other" || g.id === "nores" || g.id === "open" ? INK : "#fff" }}>{Math.round(sh * 100)}%</Typography>}
                      </Box>
                    );
                  })}
                </Box>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{n0(s.incoming)}</Typography>
              </Box>
            );
          })}
        </Box>
      </ChartFrame>
    </GlassCard>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Why they were lost, ESO next to TSA: the reason groups as a share of each team's lost ticket leads. */
function LostCard({ d, f, win, actions, half }: Ctx) {
  const by = statsBy(d, win, f, (r) => r.t);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<FactCheckOutlinedIcon />} tint="amber" title="Why they were lost" note={`${monthsLabel(win)} ${d.year} · ${groupWords(groupOfF(f))} · the resolutions of the lost, in groups - "only looking for info" is a lost sale`} right={actions} />
      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
        {TEAMS.map((t) => {
          const s = by.get(t)?.cur ?? emptyStats();
          const lost = LOST_IDS.reduce((a, k) => a + s.outcomes[k], 0);
          const rows = LOST_IDS.map((k) => ({ label: cap(OUTCOMES.find((o) => o.id === k)!.label.replace(/^Lost - /, "")), value: s.outcomes[k], secondary: ratio(s.outcomes[k], lost) })).filter((r) => r.value > 0).sort((x, y) => y.value - x.value);
          return (
            <Box key={t} sx={{ minWidth: 0, display: "grid", gap: 0.75, alignContent: "start" }}>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK }}>{t} <Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 600, color: FAINT }}>{n0(lost)} lost</Box></Typography>
              <BarList rows={rows} format={(v) => n0(v)} labelWidth={half ? 150 : 200} emptyMessage="None lost in these months." />
            </Box>
          );
        })}
      </Box>
    </GlassCard>
  );
}

function ReasonsCard({ d, f, win, actions, half }: Ctx) {
  const per = new Map<string, number>();
  let all = 0;
  for (const r of d.rows) {
    if (!keep(r, f) || !inWin(r.m, d.year, win) || !r.x) continue;
    all += 1;
    const k = r.r?.trim() || "No resolution set";
    per.set(k, (per.get(k) ?? 0) + 1);
  }
  const rows = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([label, value]) => ({ label, value, secondary: ratio(value, all) }));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<FactCheckOutlinedIcon />} tint="amber" title="How they were closed" note={`${monthsLabel(win)} ${d.year} · ${groupWords(groupOfF(f))} · the resolution the team set, of the ${n0(all)} closed - the 25 most used; "No resolution set" are mostly TSA's helpline and Back Office tickets of January and February, before the resolution was asked for`} right={actions} />
      <ChartFrame table={{ columns: ["Resolution", "Tickets", "Share"], rows: rows.map((r) => [r.label, r.value, r.secondary]), numeric: [1] }}>
        {half
          ? <Paged items={rows} size={HALF_ROWS}>{(page) => <BarList rows={page} format={(v) => n0(v)} labelWidth={220} maxLabel={40} max={rows[0]?.value} />}</Paged>
          : <BarList rows={rows} format={(v) => n0(v)} labelWidth={280} maxLabel={52} />}
      </ChartFrame>
    </GlassCard>
  );
}

type By = { by: "c" | "k"; title: string; icon: React.ReactNode; tint: Tint; labelOf: (k: string) => string; sortFocus?: boolean; onPick?: (k: string) => void };
const listOf = (d: HandoverData, win: MonthWindow, f: HFilters, keyOf: "c" | "k", sortFocus?: boolean) =>
  [...statsBy(d, win, f, (r) => r[keyOf]).entries()].sort((a, b) => (sortFocus ? (FOCUS.includes(b[0]) ? 1 : 0) - (FOCUS.includes(a[0]) ? 1 : 0) : 0) || b[1].cur.incoming - a[1].cur.incoming);

/** What became of each channel's or country's tickets, as bars. */
function BreakdownCard({ d, f, win, actions, half, by: keyOf, title, note, icon, tint, labelOf, sortFocus }: Ctx & By & { note: string }) {
  const rows = listOf(d, win, f, keyOf, sortFocus).map(([k, e]) => ({ key: k, label: labelOf(k), s: e.cur }));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={icon} tint={tint} title={title} note={note} right={actions} />
      <Legend />
      <ChartFrame table={twinOf(rows)}><OutcomeBars rows={rows} page={half ? HALF_ROWS : 12} /></ChartFrame>
    </GlassCard>
  );
}

/** The same in figures - a card of its own (SARCLA 19.10). */
function BreakdownFiguresCard({ d, f, win, actions, half, by: keyOf, title, icon, tint, labelOf, sortFocus, onPick }: Ctx & By) {
  const list = listOf(d, win, f, keyOf, sortFocus);
  const teamOf = (k: string) => statsBy({ ...d, rows: d.rows.filter((r) => r[keyOf] === k) }, win, f, (r) => r.t);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={icon} tint={tint} title={`${title} - the figures`} note={`${monthsLabel(win)} ${d.year} · ${groupWords(groupOfF(f))}${onPick ? " · click a row to filter by it" : ""}`} right={actions} />
      <Paged items={list} size={half ? HALF_ROWS : 12}>
        {(page) => half ? (
          <Table head={["", "Tickets", "Contacted in a day", "Win rate"]}
            rows={page.map(([k, e]) => ({ key: k, cells: [labelOf(k), n0(e.cur.incoming), pct(inDayRate(e.cur)), pct(winRate(e.cur))] }))} />
        ) : (
          <Table head={["", "Tickets", "ESO", "TSA", "Contacted in a day", "Median first contact", "Win rate", "Still open"]}
            rows={page.map(([k, e]) => {
              const t = teamOf(k);
              return {
                key: k, onPick: onPick ? () => onPick(k) : undefined, on: (keyOf === "c" ? f.channel : f.country)?.includes(k),
                cells: [labelOf(k), n0(e.cur.incoming), n0(t.get("ESO")?.cur.incoming ?? 0), n0(t.get("TSA")?.cur.incoming ?? 0), pct(inDayRate(e.cur)), hours(median(e.cur.firstHours)), pct(winRate(e.cur)), n0(e.cur.open)],
              };
            })} />
        )}
      </Paged>
    </GlassCard>
  );
}

const personName = (d: HandoverData, o: string) => (o ? d.owners[o] ?? `Owner ${o}` : "No owner");

function PeopleCard({ d, f, win, actions, half }: Ctx) {
  const list = [...statsBy(d, win, f, (r) => `${r.o}|${r.t}`).entries()].sort((a, b) => b[1].cur.incoming - a[1].cur.incoming);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="Who handles them" note={`${monthsLabel(win)} ${d.year} · each person's ${groupWords(groupOfF(f))} in their team: speed, outcome, what is still open - the ticket's owner today, those who left marked "(left)"`} right={actions} />
      <Paged items={list} size={half ? HALF_ROWS : 15}>
        {(page) => half ? (
          <Table head={["Person", "Team", "Tickets", "Win rate", "Open > 30 days"]}
            rows={page.map(([k, e]) => { const [o, t] = k.split("|"), s = e.cur; return { key: k, cells: [personName(d, o), t, n0(s.incoming), pct(winRate(s)), n0(s.stale)] }; })} />
        ) : (
          <Table head={["Person", "Team", "Tickets", "Contacted in a day", "Median first contact", "Closed", "Won", "Win rate", "Open > 30 days"]}
            rows={page.map(([k, e]) => {
              const [o, t] = k.split("|"), s = e.cur;
              return { key: k, cells: [personName(d, o), t, n0(s.incoming), pct(inDayRate(s)), hours(median(s.firstHours)), n0(s.closed), n0(s.won), pct(winRate(s)), n0(s.stale)] };
            })} />
        )}
      </Paged>
    </GlassCard>
  );
}

/** Win rate by person - a card of its own, a few at a time at half width (SARCLA 19.10). */
function PeopleWinCard({ d, f, win, actions, half }: Ctx) {
  const ranked = [...statsBy(d, win, f, (r) => `${r.o}|${r.t}`).entries()]
    .filter(([k, e]) => k.split("|")[0] && e.cur.resolved >= 20)
    .map(([k, e]) => ({ label: `${personName(d, k.split("|")[0])} · ${k.split("|")[1]}`, value: winRate(e.cur) ?? 0, secondary: `${n0(e.cur.won)} of ${n0(e.cur.resolved)}` }))
    .sort((a, b) => b.value - a.value);
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<EmojiEventsOutlinedIcon />} tint="green" title="Win rate by person" note={`${monthsLabel(win)} ${d.year} · ${groupWords(groupOfF(f))} · people with 20 or more closed with a resolution`} right={actions} />
      <ChartFrame table={{ columns: ["Person", "Win rate", "Won"], rows: ranked.map((r) => [r.label, pct(r.value), r.secondary]), numeric: [1] }}>
        {half
          ? <Paged items={ranked} size={HALF_ROWS}>{(page) => <BarList rows={page} format={pct} labelWidth={200} maxLabel={34} max={100} emptyMessage="Nobody has 20 closed in these months." />}</Paged>
          : <BarList rows={ranked} format={pct} labelWidth={260} maxLabel={44} max={100} emptyMessage="Nobody has 20 closed in these months." />}
      </ChartFrame>
    </GlassCard>
  );
}

/** Every card of the page by its key "<tab>:<card>" - the page draws them, and so does the nutshell. */
const CARDS: Record<string, { title: string; draw: (c: Ctx) => React.ReactNode }> = {
  "teams:compare": { title: "ESO and TSA side by side", draw: (c) => <CompareCard {...c} /> },
  "teams:flow": { title: "What happens to them", draw: (c) => <FlowCard {...c} /> },
  "months:volume": { title: "By month", draw: (c) => <MonthVolumeCard {...c} /> },
  "months:win": { title: "Win rate by month", draw: (c) => <MonthRateCard {...c} which="win" /> },
  "months:speed": { title: "Contacted within a working day, by month", draw: (c) => <MonthRateCard {...c} which="speed" /> },
  "outcomes:split": { title: "Won, lost or still open", draw: (c) => <SplitCard {...c} /> },
  "outcomes:lost": { title: "Why they were lost", draw: (c) => <LostCard {...c} /> },
  "outcomes:reasons": { title: "How they were closed", draw: (c) => <ReasonsCard {...c} /> },
  "channels:channels": { title: "By channel", draw: (c) => <BreakdownCard {...c} by="c" title={groupOfF(c.f) === "uc" ? "By use case" : "By channel"} icon={<AltRouteIcon />} tint="amber" labelOf={channelLabel} note={`${monthsLabel(c.win)} ${c.d.year} · ${groupWords(groupOfF(c.f))} · how they came in, and what became of them`} /> },
  "channels:figures": { title: "By channel - the figures", draw: (c) => <BreakdownFiguresCard {...c} by="c" title={groupOfF(c.f) === "uc" ? "By use case" : "By channel"} icon={<AltRouteIcon />} tint="amber" labelOf={channelLabel} onPick={c.onChannel} /> },
  "countries:countries": { title: "By country", draw: (c) => <BreakdownCard {...c} by="k" title="By country" icon={<PublicOutlinedIcon />} tint="green" labelOf={(k) => k} sortFocus note={`${monthsLabel(c.win)} ${c.d.year} · ${groupWords(groupOfF(c.f))} · the company's country - our focus markets first`} /> },
  "countries:figures": { title: "By country - the figures", draw: (c) => <BreakdownFiguresCard {...c} by="k" title="By country" icon={<PublicOutlinedIcon />} tint="green" labelOf={(k) => k} sortFocus onPick={c.onCountry} /> },
  "people:people": { title: "Who handles them", draw: (c) => <PeopleCard {...c} /> },
  "people:win": { title: "Win rate by person", draw: (c) => <PeopleWinCard {...c} /> },
};

// The nutshell's hand-over cards share one read of the tickets.
// While HubSpot is read again the answer is the last one: asked again every 20 s until the new one is there
// (SARCLA 19.10: a card in the nutshell "didn't change" after a deploy - it kept the answer of its first visit).
// ...and every ten minutes while the page is in view (SARCLA 20.10: a card left open "never refreshed"): one timer for all the cards.
const shared: { v: HandoverData | null; p: Promise<void> | null; again: boolean; subs: Set<() => void>; stop?: () => void } = { v: null, p: null, again: false, subs: new Set() };
function loadShared() {
  if (shared.p) return;
  shared.p = fetch("/api/reporting/marketing-kpis/handover").then((r) => r.json())
    .then((j) => { const v = j?.handover?.value as HandoverData | undefined; if (v) shared.v = v; shared.again = !!j?.handover?.computing; }).catch(() => {})
    .finally(() => { shared.p = null; shared.subs.forEach((f) => f()); if (!shared.v || shared.again) setTimeout(() => { if (shared.subs.size) loadShared(); }, 20_000); });
}
function useSharedHandover(): HandoverData | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    shared.subs.add(f);
    if (!shared.v) loadShared();
    shared.stop ??= everyWhileSeen(loadShared);
    return () => { shared.subs.delete(f); if (!shared.subs.size) { shared.stop?.(); shared.stop = undefined; } };
  }, []);
  return shared.v;
}

/** The card the nutshell's Hand-over panel starts with (demotable). */
export const HANDOVER_NUTSHELL_CARDS = [{ key: "handover:teams:compare", title: "ESO and TSA side by side" }];
/** ...and the UC hand-overs panel's. */
export const UC_NUTSHELL_CARDS = [{ key: "uc:teams:compare", title: "ESO and TSA side by side" }];
/** The page a group is on: the customers' requests on Hand-over to ESO/TSA, the UC hand-overs on their own. */
const slugOf = (g: Group) => (g === "uc" ? "uc" : "handover");

/** A hand-over card promoted to the nutshell - the same graph as on the page, with its filters and months. */
export function HandoverPromoted({ spec, actions, half }: { spec: TileSpec; actions: React.ReactNode; half?: boolean }) {
  const d = useSharedHandover();
  const [, tab, card] = spec.key.split(":");
  const c = CARDS[`${tab}:${card}`];
  if (!d || !c) {
    return <GlassCard><CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title={c?.title ?? spec.title} note={d ? "This card is no longer on its page." : "Reading the tickets…"} right={actions} /></GlassCard>;
  }
  const from = Number(spec.from), to = Number(spec.to);
  const win: MonthWindow = from >= 1 && to >= from && to <= d.monthsDone + 1 ? { start: from - 1, end: to - 1 } : { start: 0, end: d.monthsDone };
  const ff = spec.filters ?? {};
  // the page it came from: UC hand-overs, or the customers' requests on Hand-over to ESO/TSA - never both
  const group: Group = spec.page === "uc" ? "uc" : "requests";
  return <>{c.draw({ d, f: { team: ff.team, kind: kindsOf(group), channel: ff.channel, country: ff.country }, win, py: yearEarlierOk(d, win), actions, half })}</>;
}

export function HandoverExplorer({ state, group = "requests" }: { state: MkState | null; group?: Group }) {
  const slug = slugOf(group);
  const params = useSearchParams();
  const ld = useSlow<HandoverData>("/api/reporting/marketing-kpis/handover", "handover");
  const d = ld.value;
  const year = d?.year ?? new Date().getFullYear();
  // the running month too: the new registrants' tickets only started in October 2026
  const now = d?.monthsDone ?? state?.live?.value?.monthsDone ?? new Date().getMonth();
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "teams"));
  const pick = (k: string) => params.getAll(k);
  const [teams, setTeams] = useState<string[]>(() => pick("team"));
  const [channels, setChannels] = useState<string[]>(() => pick("channel"));
  const [countries, setCountries] = useState<string[]>(() => pick("country"));
  const [chosenWin, setChosenWin] = useState<MonthWindow | null>(() => {
    const a = Number(params.get("from")), b = Number(params.get("to"));
    return a >= 1 && b >= a && b <= 12 ? { start: a - 1, end: b - 1 } : null;
  });
  const win: MonthWindow = chosenWin && chosenWin.end <= now ? chosenWin : { start: 0, end: now };
  const isDefault = win.start === 0 && win.end === now;
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const q = new URLSearchParams();
    if (tab !== "teams") q.set("tab", tab);
    if (!isDefault) { q.set("from", String(win.start + 1)); q.set("to", String(win.end + 1)); }
    for (const [k, xs] of [["team", teams], ["channel", channels], ["country", countries]] as const) for (const x of xs) q.append(k, x);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [tab, win.start, win.end, isDefault, teams, channels, countries]);

  // the channels of the group shown only
  const groupChannels = CHANNELS.filter((c) => kindsOf(group).includes(c.kind));
  const shownChannels = channels.filter((c) => groupChannels.some((x) => x.id === c));
  const f: HFilters = { team: teams, kind: kindsOf(group), channel: shownChannels, country: countries };
  const flip = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const stats = useMemo(() => (d ? statsOf(d, win, f) : null), [d, win.start, win.end, teams, group, channels, countries]); // eslint-disable-line react-hooks/exhaustive-deps
  const countryOptions = useMemo(() => (d ? [...new Set(d.rows.map((r) => r.k))].sort((a, b) => (FOCUS.includes(b) ? 1 : 0) - (FOCUS.includes(a) ? 1 : 0) || a.localeCompare(b)) : []), [d]);
  const chosenCount = teams.length + shownChannels.length + countries.length + (isDefault ? 0 : 1);
  const filters = Object.fromEntries(([["team", teams], ["channel", shownChannels], ["country", countries]] as const).filter(([, xs]) => xs.length)) as Record<string, string[]>;
  const clearAll = () => { setTeams([]); setChannels([]); setCountries([]); setChosenWin(null); };
  const act = (key: string, title: string) => (
    <TileActions where="tab" start={[...HANDOVER_NUTSHELL_CARDS, ...UC_NUTSHELL_CARDS].some((t) => t.key === `${slug}:${tab}:${key}`) ? "nutshell" : "tab"}
      tile={{ key: `${slug}:${tab}:${key}`, page: slug, tab, title, summary: stats ? `${n0(stats.cur.incoming)} ${groupWords(group)}, win rate ${pct(winRate(stats.cur))}, ${monthsLabel(win)} ${year}` : undefined, filters, ...(isDefault ? {} : { from: String(win.start + 1), to: String(win.end + 1) }), kind: "card" }} />
  );

  if (!d || !stats) {
    return (
      <GlassCard><Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!ld.error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: ld.error ? RED : MUTED }}>{ld.error ? `Could not load: ${ld.error}` : `Reading the ESO and TSA tickets…${ld.progress ? ` ${ld.progress}` : ""}`}</Typography>
      </Box></GlassCard>
    );
  }
  const py = yearEarlierOk(d, win);
  const ctx: Ctx = { d, f, win, py, onChannel: (id) => setChannels(flip(channels, id)), onCountry: (k) => setCountries(flip(countries, k)) };
  const card = (key: string) => {
    const c = CARDS[`${tab}:${key}`];
    return c ? <Box key={key} sx={{ minWidth: 0, display: "grid", gap: 1.75 }}>{c.draw({ ...ctx, actions: act(key, c.title) })}</Box> : null;
  };
  const pair = (a: string, b: string) => (
    <Box sx={{ display: "grid", gap: 1.75, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, alignItems: "stretch", "& > * > *": { height: "100%", boxSizing: "border-box" } }}>{card(a)}{card(b)}</Box>
  );
  const skipped = Object.entries(d.skipped).sort((a, b) => b[1] - a[1]);

  return (
    <Box sx={{ display: "grid", gap: 1.75, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(240px, 1fr) auto" } }}>
        <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontWeight: 600, color: "#1a1d21", letterSpacing: "-0.03em", fontSize: { xs: "1.6rem", md: "1.9rem" }, lineHeight: 1.1 }}>
            {group === "uc" ? "UC hand-overs" : "Hand-over to ESO/TSA"}
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{monthsLabel(win)} {year}</b>{win.end === now ? ` (${MONTHS[now]} so far)` : ""} · {group === "uc"
              ? "what the UC workflows hand over to ESO and TSA - abandoned carts, lost leads, second purchases, poor ratings, new registrants: how fast they are contacted, what becomes of them"
              : "how ESO and TSA handle the customers' requests: how fast, what they do with them, how many they win"}{py ? ` · against the same months of ${year - 1}` : ` · no year earlier to compare: the ESO and TSA pipelines started in July ${year - 1}`}{ld.computing ? " · reading HubSpot again" : ""}
          </Typography>
          {chosenCount > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {!isDefault && <Chip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg }} />}
              {teams.map((x) => <Chip key={x} size="small" label={<span><b>Team:</b> {x}</span>} onDelete={() => setTeams(flip(teams, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.purple.bg }} />)}
              {shownChannels.map((x) => <Chip key={x} size="small" label={<span><b>Channel:</b> {channelLabel(x)}</span>} onDelete={() => setChannels(flip(channels, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.amber.bg }} />)}
              {countries.map((x) => <Chip key={x} size="small" label={<span><b>Country:</b> {x}</span>} onDelete={() => setCountries(flip(countries, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.green.bg }} />)}
              <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><Figures cur={stats.cur} prev={stats.prev} py={py} group={group} /></Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
          <ReportTabs name={slug} tab={tab} onSelect={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.id === "channels" && group === "uc" ? "Use cases" : t.label, count: null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page={slug} /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="handover-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      {tab === "teams" && <>{card("compare")}{card("flow")}</>}
      {tab === "months" && <>{card("volume")}{pair("win", "speed")}</>}
      {tab === "outcomes" && <>{card("split")}{card("lost")}{card("reasons")}</>}
      {tab === "channels" && <>{card("channels")}{card("figures")}</>}
      {tab === "countries" && <>{card("countries")}{card("figures")}</>}
      {tab === "people" && <>{card("people")}{card("win")}</>}

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot - the ESO and TSA tickets since January {year - 1}, their first reply, the calls logged on them, resolution, company and owner{d.readAt ? `, last read ${new Date(d.readAt).toLocaleString("en-GB")}` : ""}, every 6 hours.
        {skipped.length > 0 && ` Left out: ${skipped.map(([k, v]) => `${n0(v)} ${k}`).join(", ")}.`}
        {Object.keys(d.errors).length > 0 && <Box component="span" sx={{ color: RED }}> Not everything could be read: {Object.keys(d.errors).join(", ")}.</Box>}
      </Typography>

      <FilterPanel id="handover-filters" open={panel} onClose={() => setPanel(false)} subtitle="The months, the team, the channel, the country" onClearAll={chosenCount ? clearAll : undefined}>
        <FilterSection id="ho-f-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={!!open.period} onFlip={() => setOpen((o) => ({ ...o, period: !o.period }))} summary={monthsLabel(win)} chosen={!isDefault}>
          <PeriodPicker done={now + 1} win={win} onChange={(x) => setChosenWin(x)} />
        </FilterSection>
        <FilterSection id="ho-f-team" index={1} title="Team" icon={<GroupsOutlinedIcon />} tint="purple" open={!!open.team} onFlip={() => setOpen((o) => ({ ...o, team: !o.team }))} summary={teams.length ? teams.join(", ") : "Both"} chosen={teams.length > 0}>
          {TEAMS.map((t) => <Pick key={t} on={teams.includes(t)} label={t} onClick={() => setTeams(flip(teams, t))} />)}
        </FilterSection>
        <FilterSection id="ho-f-channel" index={2} title={group === "uc" ? "Use case" : "Channel"} icon={<AltRouteIcon />} tint="amber" open={!!open.channel} onFlip={() => setOpen((o) => ({ ...o, channel: !o.channel }))} summary={shownChannels.length ? `${shownChannels.length} chosen` : "All"} chosen={shownChannels.length > 0}>
          {groupChannels.map((c) => <Pick key={c.id} on={channels.includes(c.id)} label={c.label} onClick={() => setChannels(flip(channels, c.id))} />)}
        </FilterSection>
        <FilterSection id="ho-f-country" index={3} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!!open.country} onFlip={() => setOpen((o) => ({ ...o, country: !o.country }))} summary={countries.length ? `${countries.length} chosen` : "All"} chosen={countries.length > 0}>
          {countryOptions.map((c) => <Pick key={c} on={countries.includes(c)} label={c} note={FOCUS.includes(c) ? "focus market" : undefined} onClick={() => setCountries(flip(countries, c))} />)}
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}

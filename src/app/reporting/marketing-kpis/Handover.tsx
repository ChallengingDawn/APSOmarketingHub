"use client";
// HAND-OVER TO ESO/TSA - HOW THE TEAMS HANDLE THE INCOMING LEADS (SARCLA 19.10.2026: "the concept is a little
// wrong - the idea is a view on what they do with the leads they handle, how they handle them, what the win
// rate is; I want to see how the teams perform with incoming leads"). Laid out as Lead Generation: the title
// with its figures top right, tabs - teams, months, outcomes, channels, countries, people - and the Filters
// window. Every card is drawn from the tickets, the filters and the months alone (CARDS), so a promoted one is
// the same graph in the nutshell (HandoverPromoted). The rules are in handoverCube.ts.

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
  CHANNELS, KINDS, OUTCOMES, channelLabel, flowOf, inDayRate, inWin, keep, kindLabel, median, statsBy, statsOf, winRate,
  type HFilters, type HFlowNode, type HandoverData, type Outcome, type Stats,
} from "@/lib/marketingKpis/handoverCube";
import type { TileSpec } from "@/lib/reporting/kpiActions";
import { MONTHS, useSlow, type MkState, type MonthWindow } from "./data";
import { FilterPanel, FilterSection } from "./FilterPanel";
import { PeriodPicker, Table, change, monthsLabel, n0, ratio } from "./ExplorerKit";
import { Paged, Pick } from "./Lead";
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
function Figures({ cur, prev, py }: { cur: Stats; prev: Stats; py: boolean }) {
  const items: { label: string; icon: React.ReactNode; tint: Tint; v: string; d?: { text: string; color: string } | null; sub: string }[] = [
    { label: "Incoming leads", icon: <ForwardToInboxOutlinedIcon />, tint: "blue", v: n0(cur.incoming), d: py ? change(cur.incoming, prev.incoming) : null, sub: `${n0(cur.requests)} customer requests` },
    { label: "Answered in a working day", icon: <TimerOutlinedIcon />, tint: "amber", v: pct(inDayRate(cur)), sub: `of the requests · median ${hours(median(cur.firstHours))}` },
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
  won: SERIES[2], price: SERIES[1], supply: "#c0571f", delivery: "#e9a07a", info: SERIES[3], noreply: "#d9b65c", disq: "#8f99a6", other: "#c9cfd8", open: DEEMPHASIS,
};

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
  columns: ["", "Incoming", ...OUTCOMES.map((o) => o.label), "Win rate"],
  rows: rows.map((r) => [r.label, r.s.incoming, ...OUTCOMES.map((o) => r.s.outcomes[o.id]), pct(winRate(r.s))]),
  numeric: [1, ...OUTCOMES.map((_, i) => i + 2)],
});

/* ── the cards ─────────────────────────────────────────────────────────── */

type Ctx = { d: HandoverData; f: HFilters; win: MonthWindow; py: boolean; actions?: React.ReactNode; onChannel?: (id: string) => void; onCountry?: (k: string) => void };

const TONE: Record<HFlowNode["tone"], string> = { source: SERIES[0], eso: "#1c5cab", tsa: SERIES[1], good: SERIES[2], bad: "#c0571f", none: DEEMPHASIS };

function FlowCard({ d, f, win, actions }: Ctx) {
  const fl = flowOf(d, win, f);
  const label = new Map(fl.nodes.map((n) => [n.id, n.label]));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<AltRouteIcon />} tint="blue" title="What happens to the incoming leads" note={`${monthsLabel(win)} ${d.year} · every incoming lead: how it came in, which team got it, how fast a customer's request got its first reply, and what became of it · hover a band for its count`} right={actions} />
      <ChartFrame table={{ columns: ["From", "To", "Leads"], rows: fl.links.map((l) => [label.get(l.from) ?? l.from, label.get(l.to) ?? l.to, l.value]), numeric: [2] }} empty={fl.nodes.length ? null : "No incoming leads for this choice."}>
        <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
          <Box sx={{ minWidth: 760 }}>
            <Sankey height={420} columns={fl.columns} label="What happens to the incoming leads" links={fl.links}
              nodes={fl.nodes.map((n) => ({ id: n.id, column: n.column, label: n.label, color: TONE[n.tone] }))} />
          </Box>
        </Box>
      </ChartFrame>
    </GlassCard>
  );
}

/** ESO and TSA side by side: the same figures, so the difference reads at a glance. */
function CompareCard({ d, f, win, py, actions }: Ctx) {
  const by = statsBy(d, win, f, (r) => r.t);
  const lines: { label: string; v: (s: Stats) => string; better?: (a: Stats, b: Stats) => number }[] = [
    { label: "Incoming leads", v: (s) => n0(s.incoming) },
    { label: "… customer requests", v: (s) => n0(s.requests) },
    { label: "Answered within a working day", v: (s) => pct(inDayRate(s)), better: (a, b) => (inDayRate(a) ?? 0) - (inDayRate(b) ?? 0) },
    { label: "Median first reply", v: (s) => hours(median(s.firstHours)), better: (a, b) => (median(b.firstHours) ?? 0) - (median(a.firstHours) ?? 0) },
    { label: "No reply from the ticket", v: (s) => `${n0(s.noReply)} (${ratio(s.noReply, s.requests)})`, better: (a, b) => (b.noReply / Math.max(1, b.requests)) - (a.noReply / Math.max(1, a.requests)) },
    { label: "Win rate", v: (s) => pct(winRate(s)), better: (a, b) => (winRate(a) ?? 0) - (winRate(b) ?? 0) },
    { label: "Won", v: (s) => n0(s.won) },
    { label: "Median days to close", v: (s) => { const m = median(s.closeDays); return m == null ? "—" : `${Math.round(m)} days`; } },
    { label: "Still open", v: (s) => n0(s.open) },
    { label: "… open more than 30 days", v: (s) => `${n0(s.stale)} (${ratio(s.stale, s.open)})`, better: (a, b) => (b.stale / Math.max(1, b.open)) - (a.stale / Math.max(1, a.open)) },
  ];
  const s = (t: string) => by.get(t)?.cur ?? statsOf({ ...d, rows: [] }, win, f).cur;
  const p = (t: string) => by.get(t)?.prev;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="ESO and TSA side by side" note={`${monthsLabel(win)} ${d.year} · the same figures for both teams - the better of the two in green${py ? ` · win rate a year earlier under it` : ""}`} right={actions} />
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(160px, 1.4fr) repeat(2, minmax(0, 1fr))", rowGap: 0.25 }}>
        <Box />
        {TEAMS.map((t) => <Typography key={t} sx={{ fontSize: "0.78rem", fontWeight: 800, color: MUTED, textAlign: "right", letterSpacing: "0.04em", pb: 0.5 }}>{t}</Typography>)}
        {lines.map((l) => {
          const a = s("ESO"), b = s("TSA");
          const diff = l.better ? l.better(a, b) : 0;
          return [
            <Typography key={`${l.label}-l`} sx={{ fontSize: "0.84rem", color: l.label.startsWith("…") ? FAINT : INK, py: 0.6, borderTop: "1px solid rgba(21,34,58,.06)" }}>{l.label}</Typography>,
            ...TEAMS.map((t, i) => {
              const good = l.better && Math.abs(diff) > 1e-9 && (i === 0 ? diff > 0 : diff < 0);
              const prev = l.label === "Win rate" && py ? p(t) : undefined;
              return (
                <Box key={`${l.label}-${t}`} sx={{ textAlign: "right", py: 0.6, borderTop: "1px solid rgba(21,34,58,.06)" }}>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: good ? GREEN : INK, fontVariantNumeric: "tabular-nums" }}>{l.v(t === "ESO" ? a : b)}</Typography>
                  {prev && <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>a year earlier {pct(winRate(prev))}</Typography>}
                </Box>
              );
            }),
          ];
        })}
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>Speed counts the customer requests only: a new registrant or a lifecycle hand-over is worked by phone or mail, and a reply by phone or from Outlook is not in the ticket. Win rate = closed as Ordered (a one-shot order too) - for a new registrant, closed Qualified - of the tickets closed with a resolution.</Typography>
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
      <CardTitle icon={<TimelineOutlinedIcon />} tint="blue" title="Incoming leads by month" note={`${d.year}, ESO and TSA - the running month so far`} right={actions} />
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
        title={which === "win" ? "Win rate by month" : "Answered within a working day, by month"}
        note={which === "win" ? `${d.year} · of the leads that came in that month and are closed with a resolution - the newest months are still being worked` : `${d.year} · the customer requests that got their first reply from the ticket within a working day`} right={actions} />
      <ChartFrame table={{ columns: ["Month", "ESO", "TSA"], rows: data.map((m) => [m.x, pct(m.current), pct(m.prior)]), numeric: [1, 2] }}>
        <GroupedColumns height={240} format={pct} data={data} currentLabel="ESO" priorLabel="TSA" />
      </ChartFrame>
    </GlassCard>
  );
}

function SplitCard({ d, f, win, actions }: Ctx) {
  const by = statsBy(d, win, f, (r) => `${r.t} · ${kindLabel(r.g)}`);
  const rows = [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, e]) => ({ key: k, label: k, s: e.cur }));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<FactCheckOutlinedIcon />} tint="purple" title="What became of them, by team" note={`${monthsLabel(win)} ${d.year} · each team's incoming leads by kind: won, lost and why, closed otherwise, still open`} right={actions} />
      <Legend />
      <ChartFrame table={twinOf(rows)}><OutcomeBars rows={rows} /></ChartFrame>
    </GlassCard>
  );
}

function ReasonsCard({ d, f, win, actions }: Ctx) {
  const per = new Map<string, number>();
  let all = 0;
  for (const r of d.rows) {
    if (!keep(r, f) || !inWin(r.m, d.year, win) || !r.x || !r.r) continue;
    all += 1;
    per.set(r.r, (per.get(r.r) ?? 0) + 1);
  }
  const rows = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([label, value]) => ({ label, value, secondary: ratio(value, all) }));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<FactCheckOutlinedIcon />} tint="amber" title="How they were closed" note={`${monthsLabel(win)} ${d.year} · the resolution the team set, of the ${n0(all)} closed with one - the 25 most used`} right={actions} />
      <ChartFrame table={{ columns: ["Resolution", "Tickets", "Share"], rows: rows.map((r) => [r.label, r.value, r.secondary]), numeric: [1] }}>
        <BarList rows={rows} format={(v) => n0(v)} labelWidth={280} maxLabel={52} />
      </ChartFrame>
    </GlassCard>
  );
}

function BreakdownCard({ d, f, win, actions, by: keyOf, title, note, icon, tint, labelOf, sortFocus, onPick }: Ctx & {
  by: "c" | "k"; title: string; note: string; icon: React.ReactNode; tint: Tint; labelOf: (k: string) => string; sortFocus?: boolean; onPick?: (k: string) => void;
}) {
  const by = statsBy(d, win, f, (r) => r[keyOf]);
  const list = [...by.entries()].sort((a, b) => (sortFocus ? (FOCUS.includes(b[0]) ? 1 : 0) - (FOCUS.includes(a[0]) ? 1 : 0) : 0) || b[1].cur.incoming - a[1].cur.incoming);
  const rows = list.map(([k, e]) => ({ key: k, label: labelOf(k), s: e.cur }));
  return (
    <>
      <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
        <CardTitle icon={icon} tint={tint} title={title} note={note} right={actions} />
        <Legend />
        <ChartFrame table={twinOf(rows)}><OutcomeBars rows={rows} /></ChartFrame>
      </GlassCard>
      <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
        <CardTitle icon={icon} tint={tint} title={`${title} - the figures`} note={`${monthsLabel(win)} ${d.year}${onPick ? " · click a row to filter by it" : ""}`} />
        <Paged items={list} size={12}>
          {(page) => (
            <Table head={["", "Incoming", "ESO", "TSA", "Answered in a day", "Median reply", "Win rate", "Still open"]}
              rows={page.map(([k, e]) => {
                const t = statsBy({ ...d, rows: d.rows.filter((r) => r[keyOf] === k) }, win, f, (r) => r.t);
                return {
                  key: k, onPick: onPick ? () => onPick(k) : undefined, on: (keyOf === "c" ? f.channel : f.country)?.includes(k),
                  cells: [labelOf(k), n0(e.cur.incoming), n0(t.get("ESO")?.cur.incoming ?? 0), n0(t.get("TSA")?.cur.incoming ?? 0), pct(inDayRate(e.cur)), hours(median(e.cur.firstHours)), pct(winRate(e.cur)), n0(e.cur.open)],
                };
              })} />
          )}
        </Paged>
      </GlassCard>
    </>
  );
}

function PeopleCard({ d, f, win, actions }: Ctx) {
  const by = statsBy(d, win, f, (r) => `${r.o}|${r.t}`);
  const list = [...by.entries()].sort((a, b) => b[1].cur.incoming - a[1].cur.incoming);
  const name = (o: string) => (o ? d.owners[o] ?? `Owner ${o}` : "No owner");
  const ranked = list.filter(([k, e]) => k.split("|")[0] && e.cur.resolved >= 20).map(([k, e]) => ({ label: `${name(k.split("|")[0])} · ${k.split("|")[1]}`, value: winRate(e.cur) ?? 0, secondary: `${n0(e.cur.won)} of ${n0(e.cur.resolved)}` })).sort((a, b) => b.value - a.value);
  return (
    <>
      <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
        <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title="Who handles the incoming leads" note={`${monthsLabel(win)} ${d.year} · each person's incoming leads in their team: speed, outcome, what is still open - the ticket's owner today, those who left marked "(left)"`} right={actions} />
        <Paged items={list} size={15}>
          {(page) => (
            <Table head={["Person", "Team", "Incoming", "Answered in a day", "Median reply", "Closed", "Won", "Win rate", "Open > 30 days"]}
              rows={page.map(([k, e]) => {
                const [o, t] = k.split("|"), s = e.cur;
                return { key: k, cells: [name(o), t, n0(s.incoming), pct(inDayRate(s)), hours(median(s.firstHours)), n0(s.closed), n0(s.won), pct(winRate(s)), n0(s.stale)] };
              })} />
          )}
        </Paged>
      </GlassCard>
      <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
        <CardTitle icon={<EmojiEventsOutlinedIcon />} tint="green" title="Win rate by person" note={`${monthsLabel(win)} ${d.year} · people with 20 or more leads closed with a resolution`} />
        <ChartFrame table={{ columns: ["Person", "Win rate", "Won"], rows: ranked.map((r) => [r.label, pct(r.value), r.secondary]), numeric: [1] }}>
          <BarList rows={ranked} format={pct} labelWidth={260} maxLabel={44} emptyMessage="Nobody has 20 leads closed in these months." />
        </ChartFrame>
      </GlassCard>
    </>
  );
}

/** Every card of the page by its key "<tab>:<card>" - the page draws them, and so does the nutshell. */
const CARDS: Record<string, { title: string; draw: (c: Ctx) => React.ReactNode }> = {
  "teams:compare": { title: "ESO and TSA side by side", draw: (c) => <CompareCard {...c} /> },
  "teams:flow": { title: "What happens to the incoming leads", draw: (c) => <FlowCard {...c} /> },
  "months:volume": { title: "Incoming leads by month", draw: (c) => <MonthVolumeCard {...c} /> },
  "months:win": { title: "Win rate by month", draw: (c) => <MonthRateCard {...c} which="win" /> },
  "months:speed": { title: "Answered within a working day, by month", draw: (c) => <MonthRateCard {...c} which="speed" /> },
  "outcomes:split": { title: "What became of them, by team", draw: (c) => <SplitCard {...c} /> },
  "outcomes:reasons": { title: "How they were closed", draw: (c) => <ReasonsCard {...c} /> },
  "channels:channels": { title: "By channel", draw: (c) => <BreakdownCard {...c} by="c" title="By channel" icon={<AltRouteIcon />} tint="amber" labelOf={channelLabel} onPick={c.onChannel} note={`${monthsLabel(c.win)} ${c.d.year} · how the leads came in, and what became of them`} /> },
  "countries:countries": { title: "By country", draw: (c) => <BreakdownCard {...c} by="k" title="By country" icon={<PublicOutlinedIcon />} tint="green" labelOf={(k) => k} sortFocus onPick={c.onCountry} note={`${monthsLabel(c.win)} ${c.d.year} · the company's country - our focus markets first`} /> },
  "people:people": { title: "Who handles the incoming leads", draw: (c) => <PeopleCard {...c} /> },
};

// The nutshell's hand-over cards share one read of the tickets.
const shared: { v: HandoverData | null; p: Promise<void> | null; subs: Set<() => void> } = { v: null, p: null, subs: new Set() };
function loadShared() {
  if (shared.p) return;
  shared.p = fetch("/api/reporting/marketing-kpis/handover").then((r) => r.json())
    .then((j) => { const v = j?.handover?.value as HandoverData | undefined; if (v) shared.v = v; }).catch(() => {})
    .finally(() => { shared.p = null; shared.subs.forEach((f) => f()); if (!shared.v) setTimeout(() => { if (shared.subs.size) loadShared(); }, 20_000); });
}
function useSharedHandover(): HandoverData | null {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); shared.subs.add(f); if (!shared.v) loadShared(); return () => { shared.subs.delete(f); }; }, []);
  return shared.v;
}

/** The card the nutshell's Hand-over panel starts with (demotable). */
export const HANDOVER_NUTSHELL_CARDS = [{ key: "handover:teams:compare", title: "ESO and TSA side by side" }];

/** A hand-over card promoted to the nutshell - the same graph as on the page, with its filters and months. */
export function HandoverPromoted({ spec, actions }: { spec: TileSpec; actions: React.ReactNode }) {
  const d = useSharedHandover();
  const [, tab, card] = spec.key.split(":");
  const c = CARDS[`${tab}:${card}`];
  if (!d || !c) {
    return <GlassCard><CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title={c?.title ?? spec.title} note={d ? "This card is no longer on the Hand-over page." : "Reading the tickets…"} right={actions} /></GlassCard>;
  }
  const from = Number(spec.from), to = Number(spec.to);
  const win: MonthWindow = from >= 1 && to >= from && to <= d.monthsDone + 1 ? { start: from - 1, end: to - 1 } : { start: 0, end: d.monthsDone };
  const ff = spec.filters ?? {};
  return <>{c.draw({ d, f: { team: ff.team, kind: ff.kind, channel: ff.channel, country: ff.country }, win, py: yearEarlierOk(d, win), actions })}</>;
}

export function HandoverExplorer({ state }: { state: MkState | null }) {
  const params = useSearchParams();
  const ld = useSlow<HandoverData>("/api/reporting/marketing-kpis/handover", "handover");
  const d = ld.value;
  const year = d?.year ?? new Date().getFullYear();
  // the running month too: the new registrants' tickets only started in October 2026
  const now = d?.monthsDone ?? state?.live?.value?.monthsDone ?? new Date().getMonth();
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "teams"));
  const pick = (k: string) => params.getAll(k);
  const [teams, setTeams] = useState<string[]>(() => pick("team"));
  const [kinds, setKinds] = useState<string[]>(() => pick("kind"));
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
    for (const [k, xs] of [["team", teams], ["kind", kinds], ["channel", channels], ["country", countries]] as const) for (const x of xs) q.append(k, x);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [tab, win.start, win.end, isDefault, teams, kinds, channels, countries]);

  const f: HFilters = { team: teams, kind: kinds, channel: channels, country: countries };
  const flip = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const stats = useMemo(() => (d ? statsOf(d, win, f) : null), [d, win.start, win.end, teams, kinds, channels, countries]); // eslint-disable-line react-hooks/exhaustive-deps
  const countryOptions = useMemo(() => (d ? [...new Set(d.rows.map((r) => r.k))].sort((a, b) => (FOCUS.includes(b) ? 1 : 0) - (FOCUS.includes(a) ? 1 : 0) || a.localeCompare(b)) : []), [d]);
  const chosenCount = teams.length + kinds.length + channels.length + countries.length + (isDefault ? 0 : 1);
  const filters = Object.fromEntries(([["team", teams], ["kind", kinds], ["channel", channels], ["country", countries]] as const).filter(([, xs]) => xs.length)) as Record<string, string[]>;
  const clearAll = () => { setTeams([]); setKinds([]); setChannels([]); setCountries([]); setChosenWin(null); };
  const act = (key: string, title: string) => (
    <TileActions where="tab" start={`handover:${tab}:${key}` === HANDOVER_NUTSHELL_CARDS[0].key ? "nutshell" : "tab"}
      tile={{ key: `handover:${tab}:${key}`, page: "handover", tab, title, summary: stats ? `${n0(stats.cur.incoming)} incoming leads, win rate ${pct(winRate(stats.cur))}, ${monthsLabel(win)} ${year}` : undefined, filters, ...(isDefault ? {} : { from: String(win.start + 1), to: String(win.end + 1) }), kind: "card" }} />
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
            Hand-over to ESO/TSA
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
            <b style={{ color: INK }}>{monthsLabel(win)} {year}</b>{win.end === now ? ` (${MONTHS[now]} so far)` : ""} · how ESO and TSA handle the incoming leads: how fast, what they do with them, how many they win{py ? ` · against the same months of ${year - 1}` : ` · no year earlier to compare: the ESO and TSA pipelines started in July ${year - 1}`}{ld.computing ? " · reading HubSpot again" : ""}
          </Typography>
          {chosenCount > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
              {!isDefault && <Chip size="small" label={<span><b>Period:</b> {monthsLabel(win)}</span>} onDelete={() => setChosenWin(null)} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg }} />}
              {teams.map((x) => <Chip key={x} size="small" label={<span><b>Team:</b> {x}</span>} onDelete={() => setTeams(flip(teams, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.purple.bg }} />)}
              {kinds.map((x) => <Chip key={x} size="small" label={<span><b>Kind:</b> {kindLabel(x)}</span>} onDelete={() => setKinds(flip(kinds, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.blue.bg }} />)}
              {channels.map((x) => <Chip key={x} size="small" label={<span><b>Channel:</b> {channelLabel(x)}</span>} onDelete={() => setChannels(flip(channels, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.amber.bg }} />)}
              {countries.map((x) => <Chip key={x} size="small" label={<span><b>Country:</b> {x}</span>} onDelete={() => setCountries(flip(countries, x))} sx={{ height: 26, fontSize: "0.78rem", bgcolor: TINT.green.bg }} />)}
              <Button size="small" onClick={clearAll} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Clear all</Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", justifyContent: { lg: "flex-end" } }}><Figures cur={stats.cur} prev={stats.prev} py={py} /></Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ minWidth: 0, flex: "0 1 auto" }}>
          <ReportTabs name="handover" tab={tab} onSelect={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: null }))} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ "& .MuiButton-root": { height: 44 } }}><SavedViews page="handover" /></Box>
        <Button onClick={() => setPanel((x) => !x)} variant={panel || chosenCount ? "contained" : "outlined"} disableElevation aria-expanded={panel} aria-controls="handover-filters" startIcon={<TuneIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: "12px", px: 2.25, height: 44, whiteSpace: "nowrap", bgcolor: panel || chosenCount ? undefined : "#fff" }}>
          Filters{chosenCount ? ` · ${chosenCount}` : ""}
        </Button>
      </Box>

      {tab === "teams" && <>{card("compare")}{card("flow")}</>}
      {tab === "months" && <>{card("volume")}{pair("win", "speed")}</>}
      {tab === "outcomes" && <>{card("split")}{card("reasons")}</>}
      {tab === "channels" && card("channels")}
      {tab === "countries" && card("countries")}
      {tab === "people" && card("people")}

      <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
        Read from HubSpot - the ESO and TSA tickets since January {year - 1}, their first reply, resolution, company and owner{d.readAt ? `, last read ${new Date(d.readAt).toLocaleString("en-GB")}` : ""}, every 6 hours.
        {skipped.length > 0 && ` Left out: ${skipped.map(([k, v]) => `${n0(v)} ${k}`).join(", ")}.`}
        {Object.keys(d.errors).length > 0 && <Box component="span" sx={{ color: RED }}> Not everything could be read: {Object.keys(d.errors).join(", ")}.</Box>}
      </Typography>

      <FilterPanel id="handover-filters" open={panel} onClose={() => setPanel(false)} subtitle="The months, the team, the kind of lead, the channel, the country" onClearAll={chosenCount ? clearAll : undefined}>
        <FilterSection id="ho-f-period" index={0} title="Period" icon={<CalendarMonthOutlinedIcon />} tint="blue" open={!!open.period} onFlip={() => setOpen((o) => ({ ...o, period: !o.period }))} summary={monthsLabel(win)} chosen={!isDefault}>
          <PeriodPicker done={now + 1} win={win} onChange={(x) => setChosenWin(x)} />
        </FilterSection>
        <FilterSection id="ho-f-team" index={1} title="Team" icon={<GroupsOutlinedIcon />} tint="purple" open={!!open.team} onFlip={() => setOpen((o) => ({ ...o, team: !o.team }))} summary={teams.length ? teams.join(", ") : "Both"} chosen={teams.length > 0}>
          {TEAMS.map((t) => <Pick key={t} on={teams.includes(t)} label={t} onClick={() => setTeams(flip(teams, t))} />)}
        </FilterSection>
        <FilterSection id="ho-f-kind" index={2} title="Kind of lead" icon={<ForwardToInboxOutlinedIcon />} tint="blue" open={!!open.kind} onFlip={() => setOpen((o) => ({ ...o, kind: !o.kind }))} summary={kinds.length ? `${kinds.length} chosen` : "All"} chosen={kinds.length > 0}>
          {KINDS.map((k) => <Pick key={k.id} on={kinds.includes(k.id)} label={k.label} onClick={() => setKinds(flip(kinds, k.id))} />)}
        </FilterSection>
        <FilterSection id="ho-f-channel" index={3} title="Channel" icon={<AltRouteIcon />} tint="amber" open={!!open.channel} onFlip={() => setOpen((o) => ({ ...o, channel: !o.channel }))} summary={channels.length ? `${channels.length} chosen` : "All"} chosen={channels.length > 0}>
          {CHANNELS.map((c) => <Pick key={c.id} on={channels.includes(c.id)} label={c.label} note={kindLabel(c.kind)} onClick={() => setChannels(flip(channels, c.id))} />)}
        </FilterSection>
        <FilterSection id="ho-f-country" index={4} title="Country" icon={<PublicOutlinedIcon />} tint="green" open={!!open.country} onFlip={() => setOpen((o) => ({ ...o, country: !o.country }))} summary={countries.length ? `${countries.length} chosen` : "All"} chosen={countries.length > 0}>
          {countryOptions.map((c) => <Pick key={c} on={countries.includes(c)} label={c} note={FOCUS.includes(c) ? "focus market" : undefined} onClick={() => setCountries(flip(countries, c))} />)}
        </FilterSection>
      </FilterPanel>
    </Box>
  );
}

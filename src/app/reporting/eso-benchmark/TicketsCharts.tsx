"use client";
// THE ESO TICKETS PAGES' GRAPHS OF 31.10.2026 (SARCLA on the live pages: "instead of [won, lost or still open] we should
// really have the breakdown by resolutions - this should then apply also to the channel", "on outcomes focus more on the
// resolution: overall, per owner, and also the resolution texts", "by month change the graphs completely to bring state of
// the art"). Drawn from the rows' figures alone (ticketsRules.ts), so the pages and the BUC View draw them the same.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import SearchIcon from "@mui/icons-material/Search";

import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { TrendChart, type TrendPoint } from "@/app/charts/TrendChart";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { T, labelOf, resolutionsOf, type TStats, type TicketsData } from "@/lib/reporting/ticketsRules";

const int = (n: number) => Math.round(n).toLocaleString("en");
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** One colour per standing - won green, lost orange, closed otherwise grey, without a resolution pale, open blue-grey. */
export const STANDING = {
  won: { color: SERIES[2], word: "won" },
  lost: { color: SERIES[1], word: "lost" },
  other: { color: "#8f99a6", word: "closed otherwise" },
  nores: { color: "#d5dae1", word: "no resolution" },
} as const;

function Legend() {
  return (
    <Box sx={{ display: "flex", gap: 1.75, flexWrap: "wrap" }}>
      {(Object.keys(STANDING) as (keyof typeof STANDING)[]).map((k) => (
        <Box key={k} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: STANDING[k].color }} />
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{k === "won" ? "Won" : k === "lost" ? "Lost" : k === "other" ? "Closed otherwise" : "No resolution set"}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/** A resolution's bar: its name, a bar in its standing's colour, how many and their share of the closed. */
function ResRow({ label, n, of, max, color, wide }: { label: string; n: number; of: number; max: number; color: string; wide?: boolean }) {
  return (
    <Box title={`${label}: ${int(n)} (${pct(of ? n / of : null)} of the closed)`} sx={{ display: "grid", gridTemplateColumns: wide ? "minmax(140px, 260px) minmax(0, 1fr) 118px" : "minmax(0, 1.3fr) minmax(0, 1fr) 92px", gap: 1, alignItems: "center", py: 0.35 }}>
      <Typography noWrap sx={{ fontSize: wide ? "0.84rem" : "0.78rem", color: INK }}>{label}</Typography>
      <Box sx={{ height: wide ? 14 : 10, borderRadius: "0 4px 4px 0", bgcolor: "rgba(21,34,58,.05)" }}>
        <Box sx={{ height: "100%", width: `${Math.max(1.5, (n / Math.max(1, max)) * 100)}%`, bgcolor: color, borderRadius: "0 4px 4px 0" }} />
      </Box>
      <Typography sx={{ fontSize: wide ? "0.84rem" : "0.76rem", fontWeight: 700, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {int(n)} <span style={{ fontWeight: 500, color: MUTED }}>{pct(of ? n / of : null)}</span>
      </Typography>
    </Box>
  );
}

/** Every resolution of the closed tickets, the most used first, each in its standing's colour. */
export function ResolutionBars({ d, s, first = 14 }: { d: TicketsData; s: TStats; first?: number }) {
  const [all, setAll] = useState(false);
  const rows = resolutionsOf(d, s);
  const max = Math.max(1, ...rows.map((r) => r.n));
  const shown = all ? rows : rows.slice(0, first);
  if (!rows.length) return <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No closed tickets for this choice.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Legend />
      <Box sx={{ display: "grid" }}>
        {shown.map((r) => <ResRow key={r.key} label={r.label} n={r.n} of={s.closed} max={max} color={STANDING[r.group].color} wide />)}
      </Box>
      {rows.length > first && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${first}` : `Show all ${rows.length} resolutions`}</Button>}
    </Box>
  );
}

/** Small multiples: for each group (a channel, a person) its tickets, win rate and its most used resolutions - each panel the
 *  same graph, so they read side by side. Every group shown (SARCLA: "if hidden it should be directly displayed"). */
export function ResolutionPanels({ d, groups, top = 5, onPick, selected }: { d: TicketsData; groups: { label: string; s: TStats }[]; top?: number; onPick?: (label: string) => void; selected?: string[] }) {
  const list = groups.filter((g) => g.s.closed > 0).sort((a, b) => b.s.closed - a.s.closed);
  if (!list.length) return <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No closed tickets for this choice.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      <Legend />
      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" } }}>
        {list.map(({ label, s }) => {
          const rows = resolutionsOf(d, s);
          const head = rows.slice(0, top), rest = rows.slice(top).reduce((a, r) => a + r.n, 0);
          const max = Math.max(1, ...rows.map((r) => r.n));
          const on = !!selected?.includes(label);
          return (
            <Box key={label} component={onPick ? "button" : "div"} type={onPick ? "button" : undefined} onClick={onPick ? () => onPick(label) : undefined}
              sx={{ font: "inherit", textAlign: "left", cursor: onPick ? "pointer" : "default", border: `1px solid ${on ? SERIES[0] : HAIRLINE}`, borderRadius: "14px", bgcolor: on ? "rgba(45,111,168,.06)" : "rgba(255,255,255,.7)", p: 1.5, display: "grid", gap: 0.5, alignContent: "start", minWidth: 0, opacity: selected?.length && !on ? 0.55 : 1, "&:hover": onPick ? { borderColor: SERIES[0] } : {} }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.88rem", fontWeight: 700, color: INK }}>{label}</Typography>
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: STANDING.won.color, whiteSpace: "nowrap" }}>win rate {pct(s.resolved ? s.won / s.resolved : null)}</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{int(s.closed)} closed · {int(s.won)} won · {int(s.open)} still open</Typography>
              <Box sx={{ display: "grid", mt: 0.5 }}>
                {head.map((r) => <ResRow key={r.key} label={r.label} n={r.n} of={s.closed} max={max} color={STANDING[r.group].color} />)}
                {rest > 0 && <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.25 }}>and {int(rest)} more in {rows.length - top} other resolutions</Typography>}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/* ── the resolution texts: what the owner wrote when closing ───────────── */

const indexCache = new WeakMap<TicketsData, Map<number[], number>>();
const indexOf = (d: TicketsData, r: number[]) => {
  let m = indexCache.get(d);
  if (!m) { m = new Map(d.tickets.map((row, i) => [row, i])); indexCache.set(d, m); }
  return m.get(r) ?? -1;
};
/** The tickets of a set that carry a resolution text, the newest first. */
export function textsOf(d: TicketsData, rows: number[][]): { row: number[]; text: string }[] {
  const out: { row: number[]; text: string }[] = [];
  for (const r of rows) { const t = d.texts[String(indexOf(d, r))]; if (t) out.push({ row: r, text: t }); }
  return out.sort((a, b) => b.row[T.month] - a.row[T.month] || b.row[T.day] - a.row[T.day]);
}
export function ResolutionTexts({ d, rows }: { d: TicketsData; rows: number[][] }) {
  const [q, setQ] = useState("");
  const [n, setN] = useState(20);
  const all = useMemo(() => textsOf(d, rows), [d, rows]);
  const res = (r: number[]) => (r[T.resolution] >= 0 ? d.labels.resolution[r[T.resolution]] : "No resolution set");
  const found = q ? all.filter((x) => `${x.text} ${res(x.row)} ${labelOf(d, x.row, "person")}`.toLowerCase().includes(q.toLowerCase())) : all;
  if (!all.length) return <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No resolution text written on these tickets.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 34, flex: "1 1 260px", maxWidth: 380, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
          <InputBase value={q} onChange={(e) => { setQ(e.target.value); setN(20); }} placeholder="Find a word, a resolution or a person…" inputProps={{ "aria-label": "Find in the resolution texts" }} sx={{ fontSize: "0.86rem", flex: 1 }} />
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{int(found.length)} of {int(rows.length)} tickets carry a text{q ? " with these words" : ""}</Typography>
      </Box>
      <Box sx={{ display: "grid" }}>
        {found.slice(0, n).map(({ row, text }, i) => {
          return (
            <Box key={i} sx={{ display: "grid", gap: 0.35, py: 1.1, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK }}>{res(row)}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{labelOf(d, row, "person")} · {row[T.day]} {MONTHS[row[T.month]]} · {labelOf(d, row, "channel")}</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.45 }}>{text}</Typography>
            </Box>
          );
        })}
      </Box>
      {found.length > n && <Button size="small" onClick={() => setN((x) => x + 40)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>Show {int(Math.min(40, found.length - n))} more</Button>}
    </Box>
  );
}

/* ── the months ────────────────────────────────────────────────────────── */

/** The tickets of each month by what became of them - won, lost, closed otherwise, still open. `labels`: each month's
 *  name as the page writes it ("Oct (to date)", "Mar (5–31)"). */
export function MonthOutcomes({ s, labels, height = 280 }: { s: TStats; labels: string[]; height?: number }) {
  const data = s.months.map((_, i) => ({ x: labels[i], won: s.monthsWon[i], lost: s.monthsLost[i], other: s.monthsOther[i] + s.monthsNores[i], open: s.monthsOpen[i] }));
  return (
    <StackedColumns height={height} format={(v) => int(v ?? 0)} data={data}
      parts={[{ key: "won", label: "Won", color: STANDING.won.color }, { key: "lost", label: "Lost or disqualified", color: STANDING.lost.color }, { key: "other", label: "Closed otherwise or without a resolution", color: STANDING.other.color }, { key: "open", label: "Still open", color: DEEMPHASIS }]} />
  );
}

/** A monthly figure as a line - this year, and last year's same month beside it when it compares. */
export function MonthTrend({ values, compare, labels, label, compareLabel, fmt, tick, height = 240, target }: {
  values: (number | null)[]; compare?: (number | null)[] | null; labels: string[]; label: string; compareLabel?: string; fmt: (v: number | null) => string;
  /** the axis' own short labels ("6 h") where the readout is long ("5.6 working hours") */
  tick?: (v: number | null) => string; height?: number; target?: number | null;
}) {
  const data: TrendPoint[] = values.map((v, i) => ({ x: labels[i], value: v, compare: compare ? compare[i] ?? null : null }));
  return <TrendChart data={data} seriesLabel={label} compareLabel={compare ? compareLabel : undefined} height={height} format={fmt} tickFormat={tick} xFormat={(x) => x}
    threshold={target != null && target > 0 ? { value: target, label: `Target ${fmt(target)}` } : undefined} />;
}

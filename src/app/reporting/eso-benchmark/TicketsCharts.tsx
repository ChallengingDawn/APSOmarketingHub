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
import IconButton from "@mui/material/IconButton";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import SearchIcon from "@mui/icons-material/Search";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { TrendChart, type TrendPoint } from "@/app/charts/TrendChart";
import { DEEMPHASIS, SEQUENTIAL, SERIES } from "@/app/charts/palette";
import { SPEEDS, T, labelOf, resolutionsOf, type TStats, type TicketsData } from "@/lib/reporting/ticketsRules";

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
/** The texts a page holds (SARCLA 31.10.2026: "paginate at 25 to be able to show all, also filtering the resolution"). */
const PAGE = 25;
function Pager({ at, pages, onPage }: { at: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const nav = { border: `1px solid ${HAIRLINE}`, borderRadius: "8px", width: 30, height: 30 } as const;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <IconButton size="small" aria-label="The previous 25" disabled={at === 0} onClick={() => onPage(at - 1)} sx={nav}><ChevronLeftIcon sx={{ fontSize: 18 }} /></IconButton>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, minWidth: 74, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>page {at + 1} of {pages}</Typography>
      <IconButton size="small" aria-label="The next 25" disabled={at >= pages - 1} onClick={() => onPage(at + 1)} sx={nav}><ChevronRightIcon sx={{ fontSize: 18 }} /></IconButton>
    </Box>
  );
}
export function ResolutionTexts({ d, rows }: { d: TicketsData; rows: number[][] }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [page, setPage] = useState(0);
  const all = useMemo(() => textsOf(d, rows), [d, rows]);
  const res = (r: number[]) => (r[T.resolution] >= 0 ? d.labels.resolution[r[T.resolution]] ?? "Unknown" : "No resolution set");
  // the resolutions the texts carry, the most written first - the filter's choices
  const choices = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of all) { const k = x.row[T.resolution] >= 0 ? d.labels.resolution[x.row[T.resolution]] ?? "Unknown" : "No resolution set"; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [all, d]);
  const found = all.filter((x) => (!pick || res(x.row) === pick) && (!q || `${x.text} ${res(x.row)} ${labelOf(d, x.row, "person")}`.toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(found.length / PAGE));
  const at = Math.min(page, pages - 1);
  if (!all.length) return <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No resolution text written on these tickets.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 36, flex: "1 1 240px", maxWidth: 360, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 18, color: MUTED }} />
          <InputBase value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Find a word or a person…" inputProps={{ "aria-label": "Find in the resolution texts" }} sx={{ fontSize: "0.86rem", flex: 1 }} />
        </Box>
        <Select size="small" value={pick} displayEmpty onChange={(e) => { setPick(String(e.target.value)); setPage(0); }} inputProps={{ "aria-label": "Only one resolution" }}
          sx={{ flex: "0 1 300px", minWidth: 200, height: 36, borderRadius: "9px", bgcolor: "#fff", fontSize: "0.86rem", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(21,34,58,.14)" } }}>
          <MenuItem value="" sx={{ fontSize: "0.86rem" }}>Every resolution · {int(all.length)}</MenuItem>
          {choices.map(([label, n]) => <MenuItem key={label} value={label} sx={{ fontSize: "0.86rem" }}>{label} · {int(n)}</MenuItem>)}
        </Select>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
          {found.length ? `${int(at * PAGE + 1)}–${int(Math.min(found.length, (at + 1) * PAGE))} of ${int(found.length)}` : "None"} {pick || q ? `of the ${int(all.length)} texts` : `texts, of ${int(rows.length)} tickets`}
        </Typography>
        <Pager at={at} pages={pages} onPage={setPage} />
      </Box>
      <Box sx={{ display: "grid" }}>
        {found.slice(at * PAGE, (at + 1) * PAGE).map(({ row, text }, i) => (
          <Box key={`${at}-${i}`} sx={{ display: "grid", gap: 0.35, py: 1.1, borderBottom: `1px solid ${HAIRLINE}` }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK }}>{res(row)}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{labelOf(d, row, "person")} · {row[T.day]} {MONTHS[row[T.month]]} · {labelOf(d, row, "channel")}</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.45 }}>{text}</Typography>
          </Box>
        ))}
        {!found.length && <Typography sx={{ fontSize: "0.86rem", color: FAINT, py: 1.5 }}>No text for this choice.</Typography>}
      </Box>
      {pages > 1 && <Box sx={{ justifySelf: "end" }}><Pager at={at} pages={pages} onPage={(p) => setPage(p)} /></Box>}
    </Box>
  );
}

/* ── how fast the first contact came (SARCLA 31.10.2026: "the layout is really bad") ── */

/** The speeds' colours: the faster the darker (one hue, light to dark), no contact grey. */
export const SPEED_COLORS = [SEQUENTIAL[5], SEQUENTIAL[3], SEQUENTIAL[1], DEEMPHASIS] as const;
/** The split of the tickets by how fast the first contact came, as one bar in the speeds' order; then a tile per speed -
 *  its tickets, their share, and their win rate on one 0-100% scale, all the tickets' win rate marked on each. Two
 *  measures, two marks: never one axis for both. */
export function SpeedPanel({ s }: { s: TStats }) {
  const all = s.resolved ? s.won / s.resolved : null;
  if (!s.tickets) return null;
  return (
    <Box sx={{ display: "grid", gap: 1.5, containerType: "inline-size" }}>
      <Box sx={{ display: "flex", gap: "2px", height: 30, borderRadius: "6px", overflow: "hidden" }}>
        {SPEEDS.map((l, i) => {
          const sh = s.speed[i] / s.tickets;
          return s.speed[i] > 0 && (
            <Box key={l} title={`${l}: ${int(s.speed[i])} tickets · ${pct(sh)}`} sx={{ width: `${sh * 100}%`, minWidth: 3, bgcolor: SPEED_COLORS[i], display: "flex", alignItems: "center", justifyContent: "center" }}>
              {sh >= 0.09 && <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: i < 2 ? "#fff" : INK, whiteSpace: "nowrap" }}>{Math.round(sh * 100)}%</Typography>}
            </Box>
          );
        })}
      </Box>
      {/* two by two in a half-width card or on a phone, the four in a row when the card is wide - never three and one */}
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@container (min-width: 760px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" } }}>
        {SPEEDS.map((l, i) => {
          const rate = s.speedResolved[i] ? s.speedWon[i] / s.speedResolved[i] : null;
          return (
            <Box key={l} title={`${l}: ${int(s.speed[i])} tickets (${pct(s.speed[i] / s.tickets)}) · win rate ${pct(rate)}, ${int(s.speedWon[i])} won of ${int(s.speedResolved[i])} closed with a resolution`}
              sx={{ border: `1px solid ${HAIRLINE}`, borderTop: `4px solid ${SPEED_COLORS[i]}`, borderRadius: "12px", bgcolor: "rgba(255,255,255,.75)", p: 1.5, display: "grid", gap: 0.35, alignContent: "start", minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED }}>{l}</Typography>
              <Typography sx={{ fontSize: "1.55rem", fontWeight: 700, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{int(s.speed[i])}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{pct(s.speed[i] / s.tickets)} of the tickets</Typography>
              <Box sx={{ mt: 0.75, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Win rate</Typography>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{pct(rate)}</Typography>
              </Box>
              <Box sx={{ position: "relative", height: 8, borderRadius: 4, bgcolor: "rgba(21,34,58,.06)" }}>
                <Box sx={{ height: "100%", width: `${(rate ?? 0) * 100}%`, bgcolor: STANDING.won.color, borderRadius: 4 }} />
                {all != null && <Box sx={{ position: "absolute", top: -3, bottom: -3, left: `calc(${all * 100}% - 1px)`, width: 2, borderRadius: 1, bgcolor: INK }} />}
              </Box>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{int(s.speedWon[i])} won of {int(s.speedResolved[i])} closed with a resolution</Typography>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box sx={{ width: 2, height: 12, borderRadius: 1, bgcolor: INK }} />
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>The win rate of all the tickets: {pct(all)}</Typography>
      </Box>
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

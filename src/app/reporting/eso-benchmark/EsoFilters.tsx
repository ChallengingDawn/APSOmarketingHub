"use client";
// THE ESO REPORTS' PERIOD AND FILTERS, one piece for every page (SARCLA 31.10.2026, across all ESO reports: "put every
// quarter to be easy to select and really custom dates with a mini calendar"; "the filter when clicked should appear next
// to the tabs, in a different design - where they appear on top it is really hard to find them and see them").
//
//   PeriodPicker   the Period section of a page's Filters window: the quick picks, every quarter of the year (the one
//                  running "to date", the ones to come greyed), and a mini calendar for any range - by the day where the
//                  page's data has the day, by the month where it has months only (it says so)
//   ActiveFilters  the bar under the tab row: what the page is filtered by, one pill each, the period first
//
// The pages keep their own periods and rules; these draw them alike.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TuneIcon from "@mui/icons-material/Tune";
import { FAINT, HAIRLINE, INK, MUTED, TINT, type Tint } from "@/app/uc/report/ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/* ── the quick picks ───────────────────────────────────────────────────── */

export type PeriodChoice = { id: string; label: string; disabled?: boolean; title?: string };
/**
 * The year's four quarters as picks: a finished one as it is, the one running "Q4 2026 to date" (up to the last month the
 * data reach), one still to come greyed. `last` = the last month of the year with data (0 = January); `running` = it is
 * still going. The window of each: months q*3 .. q*3+2, the running one cut at `last`.
 */
export function quartersOf(year: number, last: number, running: boolean): (PeriodChoice & { from: number; to: number })[] {
  return [0, 1, 2, 3].map((q) => {
    const from = q * 3, end = q * 3 + 2;
    const future = from > last;
    const open = !future && end >= last && (running || end > last);
    return {
      id: `q${q + 1}`, from, to: Math.min(end, Math.max(from, last)), disabled: future,
      label: `Q${q + 1} ${year}${open ? " to date" : ""}`, title: future ? "Not started yet" : undefined,
    };
  });
}

function Pick({ p, on, onClick }: { p: PeriodChoice; on: boolean; onClick: () => void }) {
  return (
    <Box component="button" type="button" disabled={p.disabled} onClick={onClick} aria-pressed={on} title={p.title}
      sx={{ height: 30, px: 1.4, borderRadius: "9px", font: "inherit", fontSize: "0.8rem", fontWeight: 650, cursor: p.disabled ? "default" : "pointer",
        bgcolor: on ? TINT.blue.fg : "#fff", color: on ? "#fff" : p.disabled ? FAINT : INK,
        border: `1px solid ${on ? TINT.blue.fg : "rgba(21,34,58,.16)"}`, opacity: p.disabled ? 0.55 : 1,
        "&:hover": p.disabled || on ? {} : { borderColor: TINT.blue.fg, color: TINT.blue.fg } }}>
      {p.label}
    </Box>
  );
}
const groupHead = { fontSize: "0.72rem", fontWeight: 700, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" } as const;

/* ── the mini calendar ─────────────────────────────────────────────────── */

/** "2026-03-05" <-> a UTC day; "2026-03" <-> a month. */
const dayOf = (s: string) => new Date(`${s}T00:00:00Z`);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const dayWords = (s: string) => { const d = dayOf(s); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const monthWords = (s: string) => `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;

function RangeNote({ unit, from, to, pending }: { unit: "day" | "month"; from: string; to: string; pending: string | null }) {
  const w = unit === "day" ? dayWords : monthWords;
  return (
    <Typography sx={{ fontSize: "0.8rem", color: INK, fontWeight: 600 }}>
      {pending ? <>From <b>{w(pending)}</b> - now click the {unit === "day" ? "last day" : "last month"}</> : <>{w(from)} – {w(to)}</>}
    </Typography>
  );
}

/** A month's days, Monday first, the range tinted; days outside min..max cannot be picked. */
function DayCalendar({ from, to, min, max, pending, onPick }: { from: string; to: string; min: string; max: string; pending: string | null; onPick: (day: string) => void }) {
  const [view, setView] = useState(() => (pending ?? to).slice(0, 7));
  useEffect(() => { setView((pending ?? to).slice(0, 7)); }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  const y = Number(view.slice(0, 4)), m = Number(view.slice(5, 7)) - 1;
  const first = new Date(Date.UTC(y, m, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => isoDay(new Date(Date.UTC(y, m, i + 1))))];
  const step = (n: number) => setView(isoDay(new Date(Date.UTC(y, m + n, 1))).slice(0, 7));
  const lo = pending ?? from, hi = pending ?? to;
  return (
    <Box sx={{ display: "grid", gap: 0.5, maxWidth: 300 }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <IconButton size="small" aria-label="Previous month" disabled={view <= min.slice(0, 7)} onClick={() => step(-1)}><ChevronLeftIcon fontSize="small" /></IconButton>
        <Typography sx={{ flex: 1, textAlign: "center", fontSize: "0.86rem", fontWeight: 700, color: INK }}>{MONTHS_FULL[m]} {y}</Typography>
        <IconButton size="small" aria-label="Next month" disabled={view >= max.slice(0, 7)} onClick={() => step(1)}><ChevronRightIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }} role="grid" aria-label={`${MONTHS_FULL[m]} ${y}`}>
        {DAYS.map((d) => <Typography key={d} sx={{ fontSize: "0.68rem", color: FAINT, textAlign: "center", fontWeight: 700 }}>{d}</Typography>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const off = d < min || d > max;
          const end = d === lo || d === hi;
          const inside = d > lo && d < hi;
          return (
            <Box key={d} component="button" type="button" disabled={off} onClick={() => onPick(d)} aria-label={dayWords(d)} aria-pressed={end || inside}
              sx={{ height: 30, border: 0, borderRadius: "7px", font: "inherit", fontSize: "0.78rem", fontWeight: end ? 800 : 500, cursor: off ? "default" : "pointer",
                bgcolor: end ? TINT.blue.fg : inside ? TINT.blue.bg : "transparent", color: end ? "#fff" : off ? "#c4cad3" : INK,
                "&:hover": off || end ? {} : { bgcolor: "rgba(36,89,209,.12)" } }}>
              {Number(d.slice(8, 10))}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** A year's twelve months; months outside min..max cannot be picked. */
function MonthCalendar({ from, to, min, max, pending, onPick }: { from: string; to: string; min: string; max: string; pending: string | null; onPick: (month: string) => void }) {
  const [year, setYear] = useState(() => Number((pending ?? to).slice(0, 4)));
  const lo = pending ?? from, hi = pending ?? to;
  return (
    <Box sx={{ display: "grid", gap: 0.5, maxWidth: 300 }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <IconButton size="small" aria-label="Previous year" disabled={`${year}` <= min.slice(0, 4)} onClick={() => setYear((y) => y - 1)}><ChevronLeftIcon fontSize="small" /></IconButton>
        <Typography sx={{ flex: 1, textAlign: "center", fontSize: "0.86rem", fontWeight: 700, color: INK }}>{year}</Typography>
        <IconButton size="small" aria-label="Next year" disabled={`${year}` >= max.slice(0, 4)} onClick={() => setYear((y) => y + 1)}><ChevronRightIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }} role="grid" aria-label={`${year}`}>
        {MONTHS.map((label, i) => {
          const k = `${year}-${String(i + 1).padStart(2, "0")}`;
          const off = k < min || k > max;
          const end = k === lo || k === hi;
          const inside = k > lo && k < hi;
          return (
            <Box key={k} component="button" type="button" disabled={off} onClick={() => onPick(k)} aria-label={monthWords(k)} aria-pressed={end || inside}
              sx={{ height: 34, border: 0, borderRadius: "8px", font: "inherit", fontSize: "0.8rem", fontWeight: end ? 800 : 600, cursor: off ? "default" : "pointer",
                bgcolor: end ? TINT.blue.fg : inside ? TINT.blue.bg : "rgba(21,34,58,.03)", color: end ? "#fff" : off ? "#c4cad3" : INK,
                "&:hover": off || end ? {} : { bgcolor: "rgba(36,89,209,.12)" } }}>
              {label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/* ── the Period section ────────────────────────────────────────────────── */

/**
 * The period of a page, as one section of its Filters window. `quick` = the page's own picks (year to date, month to
 * date, last month…), `quarters` = quartersOf(); `isOn` = whether a pick is the period shown (two can be: in October
 * "Q4 to date" is "month to date"), none for a range of one's own. The calendar works
 * in `unit` ("YYYY-MM-DD" days or "YYYY-MM" months) between `min` and `max`, showing `from`..`to`; a range is picked
 * with two clicks (the first and the last), in either order.
 */
export function PeriodPicker({ quick, quarters, isOn, onChoice, unit, min, max, from, to, onRange, note }: {
  quick: PeriodChoice[]; quarters?: PeriodChoice[]; isOn: (id: string) => boolean; onChoice: (id: string) => void;
  unit: "day" | "month"; min: string; max: string; from: string; to: string; onRange: (from: string, to: string) => void; note?: React.ReactNode;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const pick = (x: string) => {
    if (!pending) { setPending(x); return; }
    const [a, b] = pending <= x ? [pending, x] : [x, pending];
    setPending(null);
    onRange(a, b);
  };
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      <Box sx={{ display: "grid", gap: 0.6 }}>
        <Typography sx={groupHead}>Quick</Typography>
        <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>{quick.map((p) => <Pick key={p.id} p={p} on={isOn(p.id)} onClick={() => { setPending(null); onChoice(p.id); }} />)}</Box>
      </Box>
      {quarters && quarters.length > 0 && (
        <Box sx={{ display: "grid", gap: 0.6 }}>
          <Typography sx={groupHead}>Quarters</Typography>
          <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>{quarters.map((p) => <Pick key={p.id} p={p} on={isOn(p.id)} onClick={() => { setPending(null); onChoice(p.id); }} />)}</Box>
        </Box>
      )}
      <Box sx={{ display: "grid", gap: 0.6 }}>
        <Typography sx={groupHead}>Your own {unit === "day" ? "dates" : "months"}</Typography>
        <RangeNote unit={unit} from={from} to={to} pending={pending} />
        {unit === "day"
          ? <DayCalendar from={from} to={to} min={min} max={max} pending={pending} onPick={pick} />
          : <MonthCalendar from={from} to={to} min={min} max={max} pending={pending} onPick={pick} />}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>
          Click the first {unit === "day" ? "day" : "month"}, then the last.{unit === "month" ? " This page's figures are kept by the month, so it counts whole months." : ""}
        </Typography>
        {note && <Typography component="div" sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>{note}</Typography>}
      </Box>
    </Box>
  );
}

/* ── what the page is filtered by: a bar under the tabs ────────────────── */

export type ActiveItem = { key: string; name: string; value: string; tint: Tint; onRemove?: () => void };
/** "Filtered by" - the period first, then every value chosen, one pill each; nothing chosen, no bar. */
export function ActiveFilters({ items, onEdit, onClearAll }: { items: ActiveItem[]; onEdit?: () => void; onClearAll?: () => void }) {
  const removable = useMemo(() => items.filter((x) => x.onRemove).length, [items]);
  if (!items.length) return null;
  return (
    <Box role="region" aria-label="Filtered by" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", px: 1.5, py: 1, borderRadius: "14px",
      bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, boxShadow: "0 1px 2px rgba(21,34,58,.05)" }}>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: TINT.blue.fg, mr: 0.5 }}>
        <TuneIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>Filtered by</Typography>
      </Box>
      {items.map((x) => (
        <Box key={x.key} sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, pl: 1.2, pr: x.onRemove ? 0.4 : 1.2, height: 30, borderRadius: "15px",
          bgcolor: TINT[x.tint].bg, border: `1px solid ${TINT[x.tint].fg}`, color: INK, maxWidth: "100%" }}>
          <Typography noWrap sx={{ fontSize: "0.8rem" }}><span style={{ color: TINT[x.tint].fg, fontWeight: 700 }}>{x.name}:</span> <b>{x.value}</b></Typography>
          {x.onRemove && (
            <IconButton size="small" aria-label={`Remove ${x.name}: ${x.value}`} onClick={x.onRemove} sx={{ p: 0.3, color: TINT[x.tint].fg }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
          )}
        </Box>
      ))}
      <Box sx={{ flex: 1 }} />
      {onEdit && <Button size="small" onClick={onEdit} sx={{ textTransform: "none", fontWeight: 700 }}>Change</Button>}
      {onClearAll && removable > 0 && <Button size="small" onClick={onClearAll} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>Clear all</Button>}
    </Box>
  );
}

"use client";
// THE PARTS A STAGE PAGE IS MADE OF, laid out as Who are our customers and Reach (SARCLA 18.10:
// "put the page like the others"): figures top right, a plain table with full figures, the period
// picker of the Filters window. Visit uses them; Reach keeps its own copies until its tile icons are in.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { Badge, FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { fmtValue } from "@/lib/marketingKpis/measures";
import { MONTHS, type KpiView, type MonthWindow } from "./data";

export const n0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en"));
export const ratio = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? "—" : `${((a / b) * 100).toFixed(1)}%`);
export const change = (cur: number | null | undefined, prev: number | null | undefined) => {
  if (cur == null || !prev) return null;
  const r = cur / prev - 1;
  return { text: `${r > 0 ? "↑" : r < 0 ? "↓" : "±"} ${Math.abs(r * 100).toFixed(1)}%`, color: r > 0.005 ? GREEN : r < -0.005 ? RED : MUTED };
};
export const monthsLabel = (w: MonthWindow) => (w.end < w.start ? "no months yet" : w.start === w.end ? MONTHS[w.start] : `${MONTHS[w.start]}–${MONTHS[w.end]}`);
/** A figure with its change under it, right-aligned - never squeezed beside it. */
export const withChange = (v: React.ReactNode, c: ReturnType<typeof change>) => (
  <Box sx={{ display: "grid", justifyItems: "end" }}>
    <span>{v}</span>
    {c && <Box component="span" sx={{ color: c.color, fontWeight: 700, fontSize: "0.74rem" }}>{c.text}</Box>}
  </Box>
);

/** A plain table, figures in full (SARCLA: no abbreviations); a row can be picked. */
export function Table({ head, rows, firstWidth = "minmax(200px, 1.6fr)", widths }: {
  head: string[]; rows: { key: string; cells: React.ReactNode[]; strong?: boolean; on?: boolean; onPick?: () => void }[]; firstWidth?: string;
  /** the other columns' widths, when not all the same */
  widths?: string[];
}) {
  const cols = widths ? `${firstWidth} ${widths.join(" ")}` : `${firstWidth} repeat(${head.length - 1}, minmax(110px, 1fr))`;
  return (
    <Box sx={{ overflowX: "auto" }}>
      {/* the cells stretch to their row, so a row's line runs straight across */}
      <Box sx={{ display: "grid", gridTemplateColumns: cols, minWidth: 220 + (head.length - 1) * 115, alignItems: "stretch" }}>
        {head.map((h, i) => <Typography key={h} sx={{ display: "flex", alignItems: "flex-end", justifyContent: i ? "flex-end" : "flex-start", fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: i ? "right" : "left", pb: 0.75, px: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>{h}</Typography>)}
        {rows.map((r) => (
          <Box key={r.key} role={r.onPick ? "button" : undefined} tabIndex={r.onPick ? 0 : undefined} aria-pressed={r.onPick ? !!r.on : undefined}
            onClick={r.onPick} onKeyDown={r.onPick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); r.onPick!(); } } : undefined}
            sx={{ display: "contents", cursor: r.onPick ? "pointer" : "default", "& > *": { py: 0.8, px: 0.75, borderBottom: `1px solid ${HAIRLINE}`, fontVariantNumeric: "tabular-nums", bgcolor: r.on ? TINT.blue.bg : r.strong ? "#f4f7fc" : "transparent" }, "&:hover > *": r.onPick ? { bgcolor: r.on ? TINT.blue.bg : "#f7f9fc" } : {} }}>
            {r.cells.map((c, i) => <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: i ? "flex-end" : "flex-start", fontSize: "0.86rem", color: INK, fontWeight: r.strong ? 800 : i ? 500 : 600, textAlign: i ? "right" : "left", minWidth: 0 }}>{c}</Box>)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** The figures top right beside the title, each in a small card - as on Who are our customers. */
export function FigureCards({ items }: { items: { id: string; label: string; icon: React.ReactNode; tint: Tint; v?: KpiView; sub?: string }[] }) {
  const shown = items.filter((it) => it.v && it.v.ytd != null);
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${shown.length}, minmax(124px, 172px))` }, flex: "0 1 auto" }}>
      {shown.map((it) => {
        const v = it.v!;
        const same = v.sameYtd != null && v.pyNote?.startsWith("same months");
        const whole = v.pyNote?.includes("whole year");
        const cur = same ? v.sameYtd! : v.ytd;
        const pct = v.measure.fmt === "pct";
        const d = !whole && cur != null && v.pyYtd != null && v.pyYtd !== 0 ? (pct ? (cur - v.pyYtd) * 100 : (cur / v.pyYtd - 1) * 100) : null;
        const good = v.measure.goodWhenUp !== false;
        return (
          <Box key={it.id} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Badge icon={it.icon} tint={it.tint} size={22} />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{it.label}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
              {d != null && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: Math.abs(d) < 0.05 ? FAINT : (d > 0) === good ? GREEN : RED }}>{d > 0 ? "+" : d < 0 ? "−" : "±"}{Math.abs(d).toFixed(1)}{pct ? " pts" : "%"}</Typography>}
            </Box>
            <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>
              {it.sub ?? (v.pyYtd != null ? `${whole ? v.pyNote : `a year earlier${same ? ` (${v.pyNote?.replace("same months ", "")})` : ""}`}: ${fmtValue(v.measure.fmt, v.pyYtd)}` : "no year earlier to compare")}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/** The months: the year so far, the last three, a quarter - or any run of the months that are in. */
export function PeriodPicker({ done, win, onChange }: { done: number; win: MonthWindow; onChange: (w: MonthWindow) => void }) {
  const last = Math.max(0, done - 1);
  const presets: { label: string; w: MonthWindow }[] = [
    { label: "This year so far", w: { start: 0, end: last } },
    ...(done >= 3 ? [{ label: "Last 3 months", w: { start: done - 3, end: last } }] : []),
    ...[0, 1, 2, 3].filter((q) => q * 3 < done).map((q) => ({ label: `Q${q + 1}`, w: { start: q * 3, end: Math.min(q * 3 + 2, last) } })),
  ];
  const same = (a: MonthWindow, b: MonthWindow) => a.start === b.start && a.end === b.end;
  const sel = { font: "inherit", fontSize: "0.84rem", padding: "6px 8px", borderRadius: "10px", border: `1px solid ${HAIRLINE}`, background: "#fff", color: INK } as const;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        {presets.map((p) => {
          const on = same(p.w, win);
          return (
            <Box key={p.label} component="button" type="button" onClick={() => onChange(p.w)} aria-pressed={on}
              sx={{ border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", color: on ? TINT.blue.fg : INK, font: "inherit", fontSize: "0.8rem", fontWeight: 700, px: 1.25, py: 0.6, borderRadius: "10px", cursor: "pointer" }}>
              {p.label}
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Typography component="label" sx={{ fontSize: "0.8rem", color: MUTED }}>From
          <select aria-label="From month" value={win.start} onChange={(e) => { const s = Number(e.target.value); onChange({ start: s, end: Math.max(s, win.end) }); }} style={{ ...sel, marginLeft: 6 }}>
            {MONTHS.slice(0, Math.max(1, done)).map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </Typography>
        <Typography component="label" sx={{ fontSize: "0.8rem", color: MUTED }}>to
          <select aria-label="To month" value={win.end} onChange={(e) => { const e2 = Number(e.target.value); onChange({ start: Math.min(win.start, e2), end: e2 }); }} style={{ ...sel, marginLeft: 6 }}>
            {MONTHS.slice(0, Math.max(1, done)).map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </Typography>
      </Box>
    </Box>
  );
}

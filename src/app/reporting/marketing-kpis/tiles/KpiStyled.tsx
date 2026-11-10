"use client";
// A KPI DRAWN IN THE STYLE PICKED ON ITS ACTIONS PAGE (SARCLA 04.11.2026: "a mini editor in styles, same data of
// course"; src/lib/reporting/tileStyles.ts). The BUC View's own pieces, nothing of a design of its own: a small tile is
// the BUC View's KPI tile (KpiTileChart, moved here from its page so the Actions page draws the very one), half or the
// whole width is the KPI's card (data.tsx KpiCard) - only the chart inside changes: the months as columns or a line,
// the running total toward the target, the year so far as two bars, the figure and its trend, or how far it is toward
// its target. No style picked: drawn as today.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { AMBER, Badge, FAINT, GREEN, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { fmtValue } from "@/lib/marketingKpis/measures";
import type { TileFormat } from "@/lib/reporting/kpiActions";
import { runningTotal, shareOfTarget, targetTone, type KpiShape, type TileStyle } from "@/lib/reporting/tileStyles";
import { Compare, KpiCard, MONTHS, MiniBars, StageGlyph, YtdBars, nameOf, periodOf, type KpiView } from "../data";

const CY = "#2d6fa8", PY = "#b9c1cf";
const TONE = { good: GREEN, near: AMBER, far: RED } as const;

/** What a KPI's data allows (tileStyles.stylesFor): months, and whether they add up. */
export const shapeOf = (v: KpiView): KpiShape => ({
  months: v.measure.agg.kind !== "ytd" && v.series.months.some((x) => x != null),
  additive: v.measure.agg.kind === "sum",
});

/** One KPI as the UC apps draw a headline: badge, name, the figure, the comparison - and its months (the BUC View's tile). */
export function KpiTileChart({ v, slug, tint, upTo, actions, chart, title, icon }: {
  v: KpiView; slug: string; tint: Tint; upTo: string; actions?: React.ReactNode;
  /** the graph its card on the page draws, small (SARCLA 19.10: "the same graph in both levels") - else its months */
  chart?: React.ReactNode;
  /** the page's own name for the KPI, when it has one */
  title?: string;
  /** the badge's glyph - its stage's unless given (the Sealing Business Review: each topic's own) */
  icon?: React.ReactNode;
}) {
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "flex", flexDirection: "column", gap: 1.1, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0 }}>
        <Badge icon={icon ?? <StageGlyph slug={slug} />} tint={tint} size={32} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25, flex: 1, minWidth: 0, pt: 0.75 }}>{title ?? nameOf(v.id)}</Typography>
        {actions}
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmtValue(v.measure.fmt, v.ytd)}</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{periodOf(v)}</Typography>
      </Box>
      <Compare v={v} size="0.78rem" />
      <Box sx={{ mt: "auto", pt: 0.5 }}>
        {chart ? chart : v.measure.agg.kind === "ytd" ? (
          // a count for the year so far: this year against last year whole, as two bars
          <Box sx={{ display: "grid", gap: 0.6 }}>
            {([["This year so far", v.ytd, TINT[tint].fg], [v.pyNote ?? "Last year", v.pyYtd, "#d3d8e0"]] as const).map(([label, x, color]) => {
              const max = Math.max(v.ytd ?? 0, v.pyYtd ?? 0) || 1;
              return (
                <Box key={label}>
                  <Typography sx={{ fontSize: "0.68rem", color: FAINT, mb: 0.25 }}>{label}</Typography>
                  <Box sx={{ height: 12, borderRadius: 99, bgcolor: color, width: `${((x ?? 0) / max) * 100}%`, minWidth: 4 }} />
                </Box>
              );
            })}
          </Box>
        ) : (
          <MiniBars v={v} />
        )}
      </Box>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: FAINT, borderTop: "1px solid rgba(21,34,58,.07)", pt: 0.75 }}>{upTo}</Typography>
    </Box>
  );
}

/** The width a chart has, so its words stay their size (an SVG stretched to fit would stretch them too). */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Round figures for the axis: 0, a quarter, half, three quarters, the top. */
function niceTop(max: number): number {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * The months as a line, this year over last year (grey) - or their running total toward the target, a dashed line
 * at it. Each point says its month and figure on hover; the running month is left out of the total.
 */
export function KpiLine({ v, total = false, target = null, height = 220 }: { v: KpiView; total?: boolean; target?: number | null; height?: number }) {
  const [ref, w] = useWidth();
  const upTo = v.upTo || 0;
  const cy = total ? runningTotal(v.series.months, upTo) : v.series.months;
  const py = total ? runningTotal(v.series.py, 12) : v.series.py;
  const all = [...cy, ...py].filter((x): x is number => x != null);
  const top = niceTop(Math.max(0, ...all, total && target ? target : 0));
  const fmt = (x: number | null) => fmtValue(v.measure.fmt, x);
  const axisW = Math.max(46, Math.ceil(Math.max(...[0, top / 2, top].map((t) => fmt(t).length)) * 6.6) + 12);
  const pad = { l: axisW, r: 12, t: 14, b: 22 };
  const iw = Math.max(10, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (i * iw) / 11;
  const y = (n: number) => pad.t + ih - (n / top) * ih;
  const path = (a: (number | null)[]) => a.map((n, i) => (n == null ? null : `${x(i)},${y(n)}`)).filter(Boolean).join(" ");
  const label = total ? "in total" : "";
  return (
    <Box ref={ref} sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", gap: 2, mb: 0.75, flexWrap: "wrap" }}>
        {([[CY, total ? "This year, added up" : "This year"], [PY, "Last year"], ...(total && target ? [[INK, `Target ${fmt(target)}`]] : [])] as const).map(([c, l]) => (
          <Typography key={l} sx={{ fontSize: "0.74rem", color: MUTED, display: "flex", alignItems: "center", gap: 0.6 }}>
            <Box component="span" sx={{ width: 12, height: c === INK ? 2 : 3, borderRadius: 2, bgcolor: c }} />{l}
          </Typography>
        ))}
      </Box>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={`${nameOf(v.id)}${total ? ", added up month by month" : " by month"}`}>
          {[0, top / 4, top / 2, (top * 3) / 4, top].map((t, k) => (
            <g key={k}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={k ? "rgba(21,34,58,.07)" : "rgba(21,34,58,.25)"} />
              {k % 2 === 0 && <text x={pad.l - 6} y={y(t) + 3.5} fontSize={10} fill={FAINT} textAnchor="end">{fmt(t)}</text>}
            </g>
          ))}
          {total && target ? (
            <line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} stroke={INK} strokeWidth={1.2} strokeDasharray="4 4" />
          ) : null}
          <polyline points={path(py)} fill="none" stroke={PY} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={path(total ? cy : cy.map((n, i) => (i === v.partial ? null : n)))} fill="none" stroke={CY} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
          {py.map((n, i) => n == null ? null : (
            <circle key={`p${i}`} cx={x(i)} cy={y(n)} r={3.2} fill={PY} stroke="#fff" strokeWidth={2}><title>{`${MONTHS[i]} last year: ${fmt(n)} ${label}`.trim()}</title></circle>
          ))}
          {cy.map((n, i) => n == null ? null : (
            <circle key={`c${i}`} cx={x(i)} cy={y(n)} r={4} fill={i === v.partial ? "#fff" : CY} stroke={i === v.partial ? CY : "#fff"} strokeWidth={2}>
              <title>{`${MONTHS[i]} this year: ${fmt(n)} ${label}${i === v.partial ? " (still running)" : ""}`.trim()}</title>
            </circle>
          ))}
          {MONTHS.map((m, i) => <text key={m} x={x(i)} y={height - 6} fontSize={10} fill={FAINT} textAnchor="middle">{m}</text>)}
        </svg>
      )}
    </Box>
  );
}

/** The months up to the last whole one as a small line - the shape of the year beside its figure. */
export function KpiTrend({ v, height = 56 }: { v: KpiView; height?: number }) {
  const [ref, w] = useWidth();
  const cy = v.series.months.slice(0, v.upTo || 0);
  const vals = cy.filter((x): x is number => x != null);
  const max = Math.max(0, ...vals), min = Math.min(...vals, max);
  const span = max - min || 1;
  const x = (i: number) => 3 + (i * (w - 6)) / Math.max(1, cy.length - 1);
  const y = (n: number) => 4 + (height - 8) * (1 - (n - min) / span);
  return (
    <Box ref={ref} sx={{ width: "100%" }}>
      {w > 0 && vals.length > 1 && (
        <svg width={w} height={height} role="img" aria-label={`${nameOf(v.id)}, month by month`}>
          <polyline points={cy.map((n, i) => (n == null ? null : `${x(i)},${y(n)}`)).filter(Boolean).join(" ")} fill="none" stroke={CY} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {cy.map((n, i) => n == null ? null : <circle key={i} cx={x(i)} cy={y(n)} r={i === cy.length - 1 ? 3.5 : 0} fill={CY}><title>{`${MONTHS[i]}: ${fmtValue(v.measure.fmt, n)}`}</title></circle>)}
        </svg>
      )}
      <Typography sx={{ fontSize: "0.7rem", color: FAINT, mt: 0.25 }}>{cy.length ? `Jan–${MONTHS[cy.length - 1]}, month by month` : "No month in yet"}</Typography>
    </Box>
  );
}

/** How far the year so far is toward its target: the share, a bar, the target itself. */
export function KpiProgress({ v, target, big = false }: { v: KpiView; target: number | null; big?: boolean }) {
  const share = shareOfTarget(v.ytd, target);
  if (share == null) return <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>No target yet - it is set on the KPI's Actions page.</Typography>;
  const c = TONE[targetTone(share)];
  return (
    <Box sx={{ display: "grid", gap: 0.6 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: big ? "1.7rem" : "1.25rem", fontWeight: 750, color: c, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{Math.round(share * 100)} %</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>of the target {fmtValue(v.measure.fmt, target)}</Typography>
      </Box>
      <Box sx={{ height: big ? 10 : 8, borderRadius: 99, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${Math.min(1, share) * 100}%`, bgcolor: c, borderRadius: 99 }} />
      </Box>
    </Box>
  );
}

/**
 * A KPI in a style: at tile size the BUC View's tile with the chart swapped, at half or the whole width its card with
 * the chart swapped. `target`: the KPI's own (typed on its Actions page), else the catalogue's.
 */
export function KpiStyled({ v, style, format, slug, tint, upTo, target, actions, title }: {
  v: KpiView; style: TileStyle; format: TileFormat; slug: string; tint: Tint; upTo: string; target: number | null; actions?: React.ReactNode; title?: string;
}) {
  const t = target ?? v.target;
  if (format === "tile") {
    const chart = style === "columns" ? <MiniBars v={v} />
      : style === "ytd" ? <YtdBars v={v} tint={tint} />
      : style === "trend" ? <KpiTrend v={v} />
      : style === "progress" ? <KpiProgress v={v} target={t} />
      : undefined;
    return <KpiTileChart v={v} slug={slug} tint={tint} upTo={upTo} actions={actions} chart={chart} title={title} />;
  }
  const h = format === "card" ? 240 : 200;
  const chart = style === "columns" ? undefined
    : style === "line" ? <KpiLine v={v} height={h} />
    : style === "cumul" ? <KpiLine v={v} total target={t} height={h} />
    : style === "ytd" ? <YtdBars v={v} tint={tint} />
    : style === "trend" ? <KpiTrend v={v} height={format === "card" ? 90 : 72} />
    : <KpiProgress v={v} target={t} big />;
  return <KpiCard v={v} icon={<StageGlyph slug={slug} />} tint={tint} upTo={upTo} actions={actions} title={title}>{chart}</KpiCard>;
}

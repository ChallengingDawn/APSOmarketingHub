"use client";

// Two figures of each item at once, and its weight: a bubble per item, across
// one figure (gross margin), up the other (revenue), its area the weight - the
// Sealing Business Review's "Scale & profitability", from the Executive
// Committee's pilot. Every bubble wears the slot-1 hue; one on the wrong side
// of a line that matters (a negative margin) wears the "bad" delta colour -
// meaning, never identity. Each carries its rank, so it reads against the list
// beside it. Hairline grid, the axis labels as the other charts write them,
// the readout (ChartTip's look) beside the bubble under the mouse or the
// keyboard, and a click picks the item.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ACCENT, CHROME, DELTA, FONT } from "./palette";
import { compact } from "./format";

export type BubblePoint = {
  label: string;
  x: number;
  y: number;
  /** the bubble's weight - its area; the y figure when not given */
  size?: number;
  /** the number it wears - its place in the list beside the chart */
  rank?: number;
  /** on the wrong side of the line that matters (a negative margin) */
  bad?: boolean;
};

/** The width the chart has, so its words keep their size - whichever box is mounted (the chart, or its empty line). */
function useWidth(): [(el: HTMLDivElement | null) => void, number] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w];
}

/** A round step for about `n` ticks over a span. */
function niceStep(span: number, n: number): number {
  const raw = span / Math.max(1, n);
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= raw) return s * p;
  return 10 * p;
}

/** The value axis' top: a round figure at or above the largest. */
function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const s of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) if (s * magnitude >= max) return s * magnitude;
  return 10 * magnitude;
}

const R_MIN = 8;
const R_MAX = 20;

export function Bubbles({
  points,
  height = 300,
  xFormat,
  yFormat = compact,
  xTick,
  yTick,
  xTitle,
  yTitle,
  onSelect,
  emptyMessage = "Nothing to place for this window.",
}: {
  points: BubblePoint[];
  height?: number;
  /** the readout's figures */
  xFormat: (v: number | null) => string;
  yFormat?: (v: number | null) => string;
  /** the axes' own short labels ("25%", "€1M") where the readout is long */
  xTick?: (v: number) => string;
  yTick?: (v: number | null) => string;
  /** what each axis is ("Gross margin", "Net revenue") */
  xTitle: string;
  yTitle: string;
  /** a click on a bubble picks its item */
  onSelect?: (label: string) => void;
  emptyMessage?: string;
}) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  if (!points.length) {
    return (
      <Box ref={ref} sx={{ border: `1px dashed ${CHROME.axis}`, borderRadius: 2, p: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.85rem", color: CHROME.muted }}>{emptyMessage}</Typography>
      </Box>
    );
  }

  // across: from below the lowest (and zero) to above the highest, on round steps
  const xs = points.map((p) => p.x);
  let lo = Math.min(0, ...xs);
  let hi = Math.max(...xs);
  if (hi - lo < 1e-9) hi = lo + 1;
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const xTicks: number[] = [];
  for (let t = lo; t <= hi + step / 1e6 && xTicks.length < 40; t += step) xTicks.push(Math.round(t / step) * step);
  // up: from zero to a round top
  const top = niceCeiling(Math.max(0, ...points.map((p) => p.y)));
  const yTicks = [0, top / 4, top / 2, (top * 3) / 4, top];
  const yText = (v: number) => (yTick ?? yFormat)(v);
  const axisW = Math.max(46, Math.ceil(Math.max(...yTicks.map((t) => yText(t).length)) * 6.8) + 10);
  const pad = { l: axisW + R_MAX, r: R_MAX + 8, t: R_MAX + 8, b: 44 };
  const iw = Math.max(10, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const X = (v: number) => pad.l + ((v - lo) / (hi - lo)) * iw;
  const Y = (v: number) => pad.t + ih - (Math.max(0, v) / top) * ih;
  const weights = points.map((p) => Math.max(0, p.size ?? p.y));
  const heaviest = Math.max(1e-9, ...weights);
  const radius = (i: number) => R_MIN + Math.sqrt(weights[i] / heaviest) * (R_MAX - R_MIN);
  // the heaviest first, so a small bubble stays on top of a large one
  const order = points.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);
  const on = hover != null ? points[hover] : null;
  const tipLeft = on && hover != null ? X(on.x) : 0;
  const flip = tipLeft > w * 0.6;

  return (
    <Box ref={ref} sx={{ position: "relative", width: "100%", fontFamily: FONT }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={`${yTitle} against ${xTitle}: ${points.map((p) => `${p.rank ? `${p.rank}. ` : ""}${p.label} ${yFormat(p.y)}, ${xFormat(p.x)}`).join("; ")}`}>
          {yTicks.map((t, k) => (
            <g key={`y${k}`}>
              <line x1={pad.l - R_MAX} x2={w - pad.r + R_MAX} y1={Y(t)} y2={Y(t)} stroke={k ? CHROME.grid : CHROME.axis} strokeWidth={1} />
              <text x={axisW - 4} y={Y(t) + 4} fontSize={12} fill={CHROME.label} textAnchor="end">{yText(t)}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`x${t}`}>
              <line x1={X(t)} x2={X(t)} y1={pad.t - R_MAX} y2={pad.t + ih} stroke={CHROME.grid} strokeWidth={1} />
              <text x={X(t)} y={pad.t + ih + 18} fontSize={12} fill={CHROME.label} textAnchor="middle">{xTick ? xTick(t) : xFormat(t)}</text>
            </g>
          ))}
          {/* the line that matters - zero - when the axis crosses it */}
          {lo < 0 && hi > 0 && <line x1={X(0)} x2={X(0)} y1={pad.t - R_MAX} y2={pad.t + ih} stroke={CHROME.muted} strokeWidth={1} strokeDasharray="3 3" />}
          <text x={w - pad.r + R_MAX} y={height - 4} fontSize={11} fill={CHROME.muted} textAnchor="end">{xTitle} →</text>
          <text x={4} y={12} fontSize={11} fill={CHROME.muted}>↑ {yTitle}</text>
          {order.map((i) => {
            const p = points[i];
            const cx = X(p.x), cy = Y(p.y), rr = radius(i);
            const lit = hover === i;
            return (
              <g
                key={`${p.label}-${i}`}
                role={onSelect ? "button" : undefined}
                tabIndex={0}
                aria-label={`${p.rank ? `${p.rank}. ` : ""}${p.label}: ${yFormat(p.y)} ${yTitle.toLowerCase()}, ${xFormat(p.x)} ${xTitle.toLowerCase()}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={onSelect ? () => onSelect(p.label) : undefined}
                onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.label); } } : undefined}
                style={{ cursor: onSelect ? "pointer" : "default", outline: "none" }}
              >
                <circle cx={cx} cy={cy} r={rr} fill={p.bad ? DELTA.bad : ACCENT} fillOpacity={lit ? 1 : 0.82}
                  stroke={lit ? CHROME.ink : CHROME.surface} strokeWidth={lit ? 2 : 1.5} style={{ transition: "fill-opacity 120ms ease" }} />
                {p.rank != null && (
                  <text x={cx} y={cy + 3.5} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle" style={{ pointerEvents: "none" }}>{p.rank}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {on && hover != null && (
        <Box
          sx={{
            position: "absolute",
            top: Math.max(0, Y(on.y) - 22),
            left: flip ? tipLeft - radius(hover) - 10 : tipLeft + radius(hover) + 10,
            transform: flip ? "translateX(-100%)" : "none",
            bgcolor: CHROME.ink,
            color: "#fff",
            borderRadius: 2,
            px: 1.5,
            py: 1,
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
            minWidth: 150,
            maxWidth: 260,
            fontSize: "0.78rem",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <Box sx={{ color: "rgba(255,255,255,0.7)", mb: 0.5, fontSize: "0.72rem", overflowWrap: "anywhere" }}>
            {on.rank != null ? `${on.rank}. ` : ""}{on.label}
          </Box>
          {([[yFormat(on.y), yTitle, ACCENT], [xFormat(on.x), xTitle, on.bad ? DELTA.bad : "#fff"]] as const).map(([v, name, color]) => (
            <Box key={name} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.2 }}>
              <Box sx={{ width: 14, height: 2.5, borderRadius: 1, bgcolor: color, flexShrink: 0 }} />
              <Box sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v}</Box>
              <Box sx={{ color: "rgba(255,255,255,0.72)" }}>{name}</Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

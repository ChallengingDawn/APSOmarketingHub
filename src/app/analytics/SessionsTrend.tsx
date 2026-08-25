"use client";

// Daily sessions, drawn as an inline SVG area chart. No charting dependency:
// the geometry is computed from the GA4 timeseries that was actually returned.
// Single series, so no legend — the peak and the trough are labelled directly
// instead of a hover tooltip, which cannot be made clean without a library.

import { useId } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { formatIsoDay, type Ga4DailyPoint } from "./integrationApi";

const NAVY = "#274e64";
const INK = "#1a1d21";
const MUTED = "#5b6470";
const HAIRLINE = "#e3e6ea";

const W = 960;
const H = 300;
const PAD = { top: 30, right: 20, bottom: 42, left: 62 };

const NUMBER = new Intl.NumberFormat("en-US");

type Plotted = { date: string; value: number; x: number; y: number };

function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const steps = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  for (const s of steps) {
    const candidate = s * magnitude;
    if (candidate >= max) return candidate;
  }
  return 10 * magnitude;
}

export default function SessionsTrend({
  daily,
  days,
}: {
  daily: Ga4DailyPoint[];
  days: number;
}) {
  const gradientId = useId().replace(/:/g, "");

  const usable = daily.filter(
    (d): d is Ga4DailyPoint & { sessions: number } => typeof d.sessions === "number",
  );

  if (usable.length < 2) {
    return (
      <Box
        sx={{
          border: `1px dashed ${HAIRLINE}`,
          borderRadius: 2,
          p: 4,
          textAlign: "center",
        }}
      >
        <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
          {usable.length === 0
            ? `GA4 returned no daily rows for the last ${days} days, so there is no trend to draw.`
            : "GA4 returned a single daily row — at least two days are needed to draw a trend."}
        </Typography>
      </Box>
    );
  }

  const values = usable.map((d) => d.sessions);
  const rawMax = Math.max(...values);
  const yMax = niceCeiling(rawMax);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const points: Plotted[] = usable.map((d, i) => ({
    date: d.date,
    value: d.sessions,
    x: PAD.left + (i / (usable.length - 1)) * innerW,
    y: PAD.top + (1 - d.sessions / yMax) * innerH,
  }));

  const baseline = PAD.top + innerH;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(2)},${baseline} L${points[0].x.toFixed(2)},${baseline} Z`;

  let peak = points[0];
  let trough = points[0];
  for (const p of points) {
    if (p.value > peak.value) peak = p;
    if (p.value < trough.value) trough = p;
  }
  const flat = peak.value === trough.value;

  const gridValues = [yMax, yMax / 2, 0];
  const clampX = (x: number) => Math.min(Math.max(x, PAD.left + 46), W - PAD.right - 46);

  const peakLabelY = peak.y - 14 < PAD.top + 10 ? peak.y + 24 : peak.y - 14;
  const troughLabelY = trough.y + 26 > baseline ? trough.y - 14 : trough.y + 26;

  return (
    <Box>
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Daily GA4 sessions over the last ${days} days. Peak ${NUMBER.format(peak.value)} on ${formatIsoDay(peak.date)}, low ${NUMBER.format(trough.value)} on ${formatIsoDay(trough.date)}.`}
        sx={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`trend-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NAVY} stopOpacity={0.22} />
            <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {gridValues.map((v) => {
          const y = PAD.top + (1 - v / yMax) * innerH;
          return (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={HAIRLINE} strokeWidth={1} />
              <text
                x={PAD.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize={13}
                fill={MUTED}
                fontFamily="Inter, sans-serif"
              >
                {NUMBER.format(Math.round(v))}
              </text>
            </g>
          );
        })}

        <path d={area} fill={`url(#trend-${gradientId})`} />
        <path d={line} fill="none" stroke={NAVY} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {!flat && (
          <>
            <circle cx={peak.x} cy={peak.y} r={4.5} fill={NAVY} stroke="#ffffff" strokeWidth={2} />
            <text
              x={clampX(peak.x)}
              y={peakLabelY}
              textAnchor="middle"
              fontSize={13}
              fontWeight={600}
              fill={INK}
              fontFamily="Inter, sans-serif"
            >
              {`Peak ${NUMBER.format(peak.value)} · ${formatIsoDay(peak.date)}`}
            </text>
            <circle cx={trough.x} cy={trough.y} r={4.5} fill="#ffffff" stroke={NAVY} strokeWidth={2} />
            <text
              x={clampX(trough.x)}
              y={troughLabelY}
              textAnchor="middle"
              fontSize={13}
              fill={MUTED}
              fontFamily="Inter, sans-serif"
            >
              {`Low ${NUMBER.format(trough.value)} · ${formatIsoDay(trough.date)}`}
            </text>
          </>
        )}

        <text
          x={PAD.left}
          y={H - 12}
          textAnchor="start"
          fontSize={13}
          fill={MUTED}
          fontFamily="Inter, sans-serif"
        >
          {formatIsoDay(points[0].date)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 12}
          textAnchor="end"
          fontSize={13}
          fill={MUTED}
          fontFamily="Inter, sans-serif"
        >
          {formatIsoDay(points[points.length - 1].date)}
        </text>
      </Box>

      <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 1 }}>
        {`${usable.length} of ${daily.length} day${daily.length === 1 ? "" : "s"} returned a sessions value · y-axis 0–${NUMBER.format(yMax)} · highest observed ${NUMBER.format(rawMax)}`}
      </Typography>
    </Box>
  );
}

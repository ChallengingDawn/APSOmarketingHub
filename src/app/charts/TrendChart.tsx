"use client";

// Change over time. One series in the accent hue with a 10% wash beneath it;
// an optional comparison series (the previous period) in the de-emphasis grey
// so the current period stays the point. Hairline solid grid, recessive axes,
// a crosshair that snaps to the nearest day and reads every series at once.

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ACCENT, AREA_WASH_OPACITY, CHROME, DEEMPHASIS, FONT } from "./palette";
import { ChartTip } from "./ChartTip";
import { compact, dayLabel } from "./format";

export type TrendPoint = {
  /** Category key on the x axis (an ISO day for daily series). */
  x: string;
  value: number | null;
  compare?: number | null;
};

function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const s of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (s * magnitude >= max) return s * magnitude;
  }
  return 10 * magnitude;
}

export function TrendChart({
  data,
  seriesLabel,
  compareLabel,
  height = 260,
  format = compact,
  xFormat = dayLabel,
}: {
  data: TrendPoint[];
  seriesLabel: string;
  compareLabel?: string;
  height?: number;
  format?: (v: number | null) => string;
  xFormat?: (x: string) => string;
}) {
  const hasCompare = Boolean(compareLabel) && data.some((d) => typeof d.compare === "number");

  const { yMax, ticks, peak, latest } = useMemo(() => {
    const values = data.flatMap((d) => [d.value, hasCompare ? d.compare : null]).filter(
      (v): v is number => typeof v === "number",
    );
    const max = values.length ? Math.max(...values) : 0;
    const top = niceCeiling(max);
    const stride = Math.max(1, Math.round(data.length / 5));
    const xs = data.filter((_, i) => i % stride === 0 || i === data.length - 1).map((d) => d.x);
    let pk: TrendPoint | null = null;
    for (const d of data) if (typeof d.value === "number" && (!pk || d.value > (pk.value as number))) pk = d;
    const last = [...data].reverse().find((d) => typeof d.value === "number") ?? null;
    return { yMax: top, ticks: xs, peak: pk, latest: last };
  }, [data, hasCompare]);

  return (
    <Box>
      <Box sx={{ width: "100%", height, fontFamily: FONT }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="trend-wash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={AREA_WASH_OPACITY * 1.6} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHROME.grid} strokeWidth={1} />
            <XAxis
              dataKey="x"
              ticks={ticks}
              tickFormatter={(v) => xFormat(String(v))}
              tick={{ fontSize: 12, fill: CHROME.label }}
              axisLine={{ stroke: CHROME.axis }}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={[0, yMax]}
              ticks={[0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax]}
              tickFormatter={(v) => format(Number(v))}
              tick={{ fontSize: 12, fill: CHROME.label }}
              axisLine={false}
              tickLine={false}
              width={46}
            />
            <Tooltip
              cursor={{ stroke: CHROME.axis, strokeWidth: 1 }}
              content={(p) => (
                <ChartTip
                  active={p.active}
                  payload={p.payload as ReadonlyArray<{ name?: unknown; value?: unknown; color?: string }>}
                  label={p.label}
                  format={format}
                  labelFormat={xFormat}
                />
              )}
            />
            {hasCompare && (
              <Area
                type="monotone"
                dataKey="compare"
                name={compareLabel}
                stroke={DEEMPHASIS}
                strokeWidth={2}
                fill="transparent"
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: CHROME.surface, fill: DEEMPHASIS }}
                isAnimationActive={false}
                connectNulls
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              name={seriesLabel}
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#trend-wash)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: CHROME.surface, fill: ACCENT }}
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1, flexWrap: "wrap" }}>
        <Legend swatch={ACCENT} label={seriesLabel} />
        {hasCompare && compareLabel && <Legend swatch={DEEMPHASIS} label={compareLabel} />}
        <Box sx={{ flex: 1 }} />
        {peak && latest && (
          <Typography sx={{ fontSize: "0.74rem", color: CHROME.muted, fontVariantNumeric: "tabular-nums" }}>
            {`Peak ${format(peak.value)} on ${xFormat(peak.x)} · latest ${format(latest.value)} on ${xFormat(latest.x)}`}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box sx={{ width: 16, height: 2.5, borderRadius: 1, bgcolor: swatch }} />
      <Typography sx={{ fontSize: "0.76rem", color: CHROME.muted }}>{label}</Typography>
    </Box>
  );
}

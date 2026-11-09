"use client";

// A few series over time, each its own line - at most four in the categorical hues (palette SERIES, in their fixed
// order), a fifth "the rest" in the de-emphasis grey; more than that folds before it gets here. Same chrome as
// TrendChart: hairline grid, recessive axes, one tooltip reading every line, a legend always (two lines or more).

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { CHROME, DEEMPHASIS, FONT, SERIES } from "./palette";
import { ChartTip } from "./ChartTip";

export type MultiSeries = { key: string; label: string; values: (number | null)[]; rest?: boolean };

const niceCeiling = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

export function MultiLine({ labels, series, format, tickFormat, height = 240, max, threshold }: {
  labels: string[]; series: MultiSeries[]; format: (v: number | null) => string; tickFormat?: (v: number | null) => string; height?: number;
  /** a fixed top (1 for a share) */
  max?: number;
  threshold?: { value: number; label: string };
}) {
  const shown = series.slice(0, 5);
  const color = (s: MultiSeries, i: number) => (s.rest ? DEEMPHASIS : SERIES[i % SERIES.length]);
  const { data, yMax, ticks } = useMemo(() => {
    const rows = labels.map((x, i) => Object.fromEntries([["x", x], ...shown.map((s) => [s.key, s.values[i] ?? null])]));
    const all = shown.flatMap((s) => s.values).filter((v): v is number => typeof v === "number");
    if (threshold) all.push(threshold.value);
    const top = max ?? niceCeiling(all.length ? Math.max(...all) : 0);
    const stride = Math.max(1, Math.round(labels.length / 6));
    return { data: rows, yMax: top, ticks: labels.filter((_, i) => i % stride === 0 || i === labels.length - 1) };
  }, [labels, shown, max, threshold]);
  let named = 0;
  const colors = shown.map((s) => (s.rest ? DEEMPHASIS : color(s, named++)));
  return (
    <Box>
      <Box sx={{ width: "100%", height, fontFamily: FONT }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHROME.grid} strokeWidth={1} />
            <XAxis dataKey="x" ticks={ticks} tick={{ fontSize: 12, fill: CHROME.label }} axisLine={{ stroke: CHROME.axis }} tickLine={false} tickMargin={8} />
            <YAxis domain={[0, yMax]} ticks={[0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax]} tickFormatter={(v) => (tickFormat ?? format)(Number(v))}
              tick={{ fontSize: 12, fill: CHROME.label }} axisLine={false} tickLine={false} width={50} />
            <Tooltip cursor={{ stroke: CHROME.axis, strokeWidth: 1 }}
              content={(p) => <ChartTip active={p.active} payload={p.payload as ReadonlyArray<{ name?: unknown; value?: unknown; color?: string }>} label={p.label} format={format} labelFormat={(x) => x} />} />
            {threshold && <ReferenceLine y={threshold.value} stroke={CHROME.muted} strokeWidth={1} strokeDasharray="4 4" ifOverflow="extendDomain" />}
            {shown.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colors[i]} strokeWidth={2} dot={labels.length <= 3 ? { r: 4 } : false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: CHROME.surface, fill: colors[i] }} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      {shown.length > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1, flexWrap: "wrap" }}>
          {shown.map((s, i) => (
            <Box key={s.key} sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              <Box sx={{ width: 16, height: 2.5, borderRadius: 1, bgcolor: colors[i], flex: "0 0 auto" }} />
              <Typography sx={{ fontSize: "0.76rem", color: CHROME.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{s.label}</Typography>
            </Box>
          ))}
          {threshold && <Typography sx={{ fontSize: "0.76rem", color: CHROME.muted }}>- - {threshold.label}</Typography>}
        </Box>
      )}
    </Box>
  );
}

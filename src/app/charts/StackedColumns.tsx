"use client";

// Part-to-whole across a few categories (calendar years): stacked columns with
// one hue per part in the fixed categorical order (at most four parts), a 2px
// surface gap between segments, the top of each column rounded, a hover
// readout of every part, and a legend underneath — identity is never colour
// alone. The ChartFrame table twin carries the exact values.

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { CHROME, FONT, SERIES } from "./palette";
import { ChartTip } from "./ChartTip";
import { compact } from "./format";

export type StackPart = { key: string; label: string };
export type StackRow = { x: string } & Record<string, string | number | null>;

function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const s of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (s * magnitude >= max) return s * magnitude;
  }
  return 10 * magnitude;
}

export function StackedColumns({
  data,
  parts,
  height = 260,
  format = compact,
  xFormat = (x) => x,
}: {
  data: StackRow[];
  /** Bottom segment first. Four at most: the categorical palette is never cycled. */
  parts: StackPart[];
  height?: number;
  format?: (v: number | null) => string;
  xFormat?: (x: string) => string;
}) {
  const shown = parts.slice(0, SERIES.length);
  const totals = data.map((d) => shown.reduce((a, p) => a + (typeof d[p.key] === "number" ? (d[p.key] as number) : 0), 0));
  const top = niceCeiling(Math.max(0, ...totals));

  return (
    <Box>
      <Box sx={{ width: "100%", height, fontFamily: FONT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={CHROME.grid} strokeWidth={1} />
            <XAxis
              dataKey="x"
              tickFormatter={(v) => xFormat(String(v))}
              tick={{ fontSize: 12, fill: CHROME.label }}
              axisLine={{ stroke: CHROME.axis }}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={[0, top]}
              ticks={[0, top / 4, top / 2, (top * 3) / 4, top]}
              tickFormatter={(v) => format(Number(v))}
              tick={{ fontSize: 12, fill: CHROME.label }}
              axisLine={false}
              tickLine={false}
              width={46}
            />
            <Tooltip
              cursor={{ fill: "rgba(26,29,33,0.04)" }}
              content={(p) => (
                <ChartTip
                  active={p.active}
                  payload={[...((p.payload ?? []) as ReadonlyArray<{ name?: unknown; value?: unknown; color?: string }>)].reverse()}
                  label={p.label}
                  format={format}
                  labelFormat={xFormat}
                />
              )}
            />
            {shown.map((part, i) => (
              <Bar
                key={part.key}
                dataKey={part.key}
                name={part.label}
                stackId="parts"
                fill={SERIES[i]}
                stroke={CHROME.surface}
                strokeWidth={2}
                radius={i === shown.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={72}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1, flexWrap: "wrap" }}>
        {[...shown].reverse().map((part) => (
          <Box key={part.key} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: SERIES[shown.indexOf(part)] }} />
            <Typography sx={{ fontSize: "0.76rem", color: CHROME.muted }}>{part.label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

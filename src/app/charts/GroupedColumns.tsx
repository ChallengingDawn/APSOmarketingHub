"use client";

// This period against the one before it, month by month, side by side.
//
// Two bars per month, never stacked: a stack would read as a total, and these
// two years are alternatives, not parts of one thing. The current year wears
// slot 1; last year wears the de-emphasis grey the palette reserves for "the
// previous period", so the eye lands on this year without a second hue
// competing for meaning. The legend is always present — identity is never
// colour alone — and ChartFrame's table twin carries the exact values.

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { CHROME, DEEMPHASIS, FONT, SERIES } from "./palette";
import { ChartTip } from "./ChartTip";
import { compact } from "./format";

export type GroupedRow = { x: string; current: number | null; prior: number | null };

function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const s of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (s * magnitude >= max) return s * magnitude;
  }
  return 10 * magnitude;
}

export function GroupedColumns({
  data,
  currentLabel,
  priorLabel,
  height = 230,
  format = compact,
}: {
  data: GroupedRow[];
  currentLabel: string;
  priorLabel: string;
  height?: number;
  format?: (v: number | null) => string;
}) {
  const top = niceCeiling(
    Math.max(0, ...data.flatMap((d) => [d.current ?? 0, d.prior ?? 0])),
  );

  return (
    <Box>
      <Box sx={{ width: "100%", height, fontFamily: FONT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }} barCategoryGap="24%" barGap={2}>
            <CartesianGrid vertical={false} stroke={CHROME.grid} strokeWidth={1} />
            <XAxis
              dataKey="x"
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
                  payload={(p.payload ?? []) as ReadonlyArray<{ name?: unknown; value?: unknown; color?: string }>}
                  label={p.label}
                  format={format}
                />
              )}
            />
            {/* Last year first, so this year's bar sits on the right of each pair
                and the sequence reads left to right in time. */}
            <Bar dataKey="prior" name={priorLabel} fill={DEEMPHASIS} radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false} />
            <Bar dataKey="current" name={currentLabel} fill={SERIES[0]} radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1, flexWrap: "wrap" }}>
        {[
          { label: currentLabel, colour: SERIES[0] },
          { label: priorLabel, colour: DEEMPHASIS },
        ].map((entry) => (
          <Box key={entry.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: entry.colour }} />
            <Typography sx={{ fontSize: "0.76rem", color: CHROME.muted }}>{entry.label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

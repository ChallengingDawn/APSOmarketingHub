"use client";

// The portfolio at a glance: the sales-priority mix as a donut with its buckets in
// order (P1 first, never sorted by size), and the APSO segments as bars in their
// own colours with each one's share.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { full } from "@/app/charts/format";
import { INK, MUTED, TRACK } from "@/app/uc/report/ui";

export type Slice = { label: string; note: string; value: number; color: string };

const pct = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(a / b < 0.1 ? 1 : 0)}%` : "—");

export function PriorityMix({ slices, total }: { slices: Slice[]; total: number }) {
  const shown = slices.filter((s) => s.value > 0);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "240px minmax(0, 1fr)" }, gap: 3, alignItems: "center" }}>
      <Box sx={{ position: "relative", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="label" innerRadius={70} outerRadius={100} paddingAngle={1.5} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>
              {shown.map((s) => <Cell key={s.label} fill={s.color} />)}
            </Pie>
            <Tooltip formatter={(v: unknown, n: unknown) => [`${full(Number(v))} companies`, String(n)]}
              contentStyle={{ fontSize: "0.78rem", borderRadius: 10, border: "1px solid rgba(21,34,58,.1)" }} />
          </PieChart>
        </ResponsiveContainer>
        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color: INK, lineHeight: 1, letterSpacing: "-0.02em" }}>{full(total)}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.4 }}>companies</Typography>
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5 }}>
        {slices.map((s) => (
          <Box key={s.label}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: s.color, flexShrink: 0, alignSelf: "center" }} />
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>{s.label}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.note}</Typography>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{full(s.value)}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, width: 46, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(s.value, total)}</Typography>
            </Box>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }}>
              <Box sx={{ width: `${total ? (100 * s.value) / total : 0}%`, minWidth: s.value ? 3 : 0, height: "100%", bgcolor: s.color, borderRadius: 99 }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Segment colours - stable, so a segment keeps its colour wherever it appears. */
export const SEGMENT_COLOR: Record<string, string> = {
  APSOcore: "#1b7a55", APSOgrowth: "#13866a", "Growth Engine Customer": "#2d6fa8", APSOprospect: "#5b8def",
  APSOmicro: "#9a7bf0", APSOlost: "#d65a4a", "No sales focus": "#b9c0c9", "Other values": "#8b97ac", "No segment": "#c9ced6",
};

export function SegmentMix({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Box sx={{ display: "grid", gap: 1.1 }}>
      {rows.map((r) => {
        const color = SEGMENT_COLOR[r.label] ?? "#8b97ac";
        return (
          <Box key={r.label} sx={{ display: "grid", gridTemplateColumns: { xs: "120px minmax(0,1fr) 110px", md: "200px minmax(0,1fr) 140px" }, gap: 1.5, alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: color, flexShrink: 0 }} />
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</Typography>
            </Box>
            <Box sx={{ height: 14, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }}>
              <Box sx={{ width: `${(100 * r.value) / max}%`, minWidth: r.value ? 4 : 0, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{full(r.value)}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, width: 46, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pct(r.value, total)}</Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

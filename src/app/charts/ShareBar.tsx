"use client";

// Part-to-whole as a single horizontal stacked bar: segments separated by a
// 2px surface gap, categorical slots in fixed order, a legend that always
// carries identity, and a label inside a segment only when it fits.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { CHROME, SERIES, DEEMPHASIS } from "./palette";
import { compact, percent } from "./format";

export type ShareSegment = { label: string; value: number | null };

const MAX_SLOTS = SERIES.length;

export function ShareBar({
  segments,
  format = compact,
  height = 28,
}: {
  segments: ShareSegment[];
  format?: (v: number | null) => string;
  height?: number;
}) {
  const usable = segments.filter((s) => typeof s.value === "number" && (s.value as number) > 0) as {
    label: string;
    value: number;
  }[];
  const sorted = [...usable].sort((a, b) => b.value - a.value);
  // Past the validated slots the tail folds into "Other" — never a generated hue.
  const head = sorted.slice(0, MAX_SLOTS);
  const tail = sorted.slice(MAX_SLOTS);
  const parts = tail.length
    ? [...head, { label: "Other", value: tail.reduce((s, t) => s + t.value, 0) }]
    : head;
  const total = parts.reduce((s, p) => s + p.value, 0);

  if (total <= 0) {
    return (
      <Box sx={{ border: `1px dashed ${CHROME.axis}`, borderRadius: 2, p: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.85rem", color: CHROME.muted }}>Nothing to split for this window.</Typography>
      </Box>
    );
  }

  const colorOf = (i: number, label: string) => (label === "Other" ? DEEMPHASIS : SERIES[i]);

  return (
    <Box>
      <Box sx={{ display: "flex", gap: "2px", height, borderRadius: 1.5, overflow: "hidden" }}>
        {parts.map((p, i) => {
          const share = p.value / total;
          const fits = share > 0.12;
          return (
            <Tooltip key={p.label} title={`${p.label} · ${format(p.value)} · ${percent(share)}`} placement="top">
              <Box
                sx={{
                  width: `${share * 100}%`,
                  bgcolor: colorOf(i, p.label),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "filter 120ms ease",
                  "&:hover": { filter: "brightness(1.08)" },
                  minWidth: 3,
                }}
              >
                {fits && (
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                    {percent(share, 0)}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 1.25 }}>
        {parts.map((p, i) => (
          <Box key={p.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: colorOf(i, p.label) }} />
            <Typography sx={{ fontSize: "0.78rem", color: CHROME.ink }}>{p.label}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: CHROME.muted, fontVariantNumeric: "tabular-nums" }}>
              {format(p.value)} · {percent(p.value / total, 0)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

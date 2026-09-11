"use client";

// A target bar: how far the year-to-date actual has come toward an annual
// goal, with a marker where straight-line pace says it should be by now.
// One hue for the actual, a neutral track, text in ink — never colour alone:
// the caption spells out ahead/behind.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { ACCENT, CHROME, DEEMPHASIS } from "./palette";

export function PaceBar({
  actual,
  goal,
  elapsed,
  format,
  height = 10,
}: {
  actual: number | null;
  goal: number;
  /** Share of the period gone, 0..1. */
  elapsed: number;
  format: (n: number) => string;
  height?: number;
}) {
  const fill = actual === null || goal <= 0 ? 0 : Math.min(1, actual / goal);
  const marker = Math.min(1, Math.max(0, elapsed));
  const expected = goal * marker;
  const behind = actual !== null && actual < expected;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Tooltip
        title={
          actual === null
            ? "No actual yet"
            : `${format(actual)} of ${format(goal)} · straight-line pace says ${format(Math.round(expected))} by now`
        }
        placement="top"
      >
        <Box sx={{ position: "relative", height, borderRadius: height / 2, bgcolor: DEEMPHASIS, overflow: "visible" }}>
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${fill * 100}%`,
              borderRadius: height / 2,
              bgcolor: behind ? "#eb6834" : ACCENT,
              transition: "width 400ms ease",
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              left: `calc(${marker * 100}% - 1px)`,
              top: -3,
              bottom: -3,
              width: 2,
              bgcolor: CHROME.ink,
              opacity: 0.7,
            }}
          />
        </Box>
      </Tooltip>
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
        <Typography sx={{ fontSize: "0.7rem", color: CHROME.muted }}>
          {actual === null ? "—" : format(actual)} so far
        </Typography>
        <Typography sx={{ fontSize: "0.7rem", color: CHROME.muted }}>
          marker = pace · goal {format(goal)}
        </Typography>
      </Box>
    </Box>
  );
}

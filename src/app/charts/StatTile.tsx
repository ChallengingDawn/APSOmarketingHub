"use client";

// The stat-tile contract: label, value in proportional figures, an optional
// signed delta against a named period whose colour is direction × whether up
// is good, and an optional twelve-point sparkline in the de-emphasis grey
// with the current point in the accent.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ACCENT, CHROME, DEEMPHASIS, DELTA } from "./palette";
import { signedPercent } from "./format";

export type StatDelta = {
  /** Relative change as a ratio; null when it cannot be computed. */
  ratio: number | null;
  /** What it is compared against, e.g. "previous 28 days". */
  versus: string;
  /** Whether a rise is good news. Defaults to true. */
  upIsGood?: boolean;
};

export function StatTile({
  label,
  value,
  delta,
  trend,
  note,
}: {
  label: string;
  value: string;
  delta?: StatDelta;
  trend?: (number | null)[];
  note?: string;
}) {
  const reported = value !== "—";
  const dir = delta?.ratio === null || delta?.ratio === undefined ? 0 : Math.sign(delta.ratio);
  const good = delta ? (delta.upIsGood ?? true ? dir > 0 : dir < 0) : false;
  const deltaColor = dir === 0 ? DELTA.flat : good ? DELTA.good : DELTA.bad;

  return (
    <Box
      sx={{
        border: `1px solid ${CHROME.grid}`,
        borderRadius: 2.4,
        bgcolor: "#fff",
        p: 2.25,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        minWidth: 0,
      }}
    >
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: CHROME.muted }}>{label}</Typography>
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 1.5 }}>
        <Typography
          sx={{
            fontSize: "1.85rem",
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: reported ? CHROME.ink : CHROME.muted,
          }}
        >
          {value}
        </Typography>
        {trend && trend.filter((v) => typeof v === "number").length >= 3 && <Sparkline points={trend} />}
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, minHeight: 18 }}>
        {delta && delta.ratio !== null && (
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: deltaColor, fontVariantNumeric: "tabular-nums" }}>
            {signedPercent(delta.ratio)}
          </Typography>
        )}
        <Typography sx={{ fontSize: "0.74rem", color: CHROME.muted }}>
          {delta ? (delta.ratio === null ? `no comparison for ${delta.versus}` : `vs ${delta.versus}`) : note ?? ""}
        </Typography>
      </Box>
    </Box>
  );
}

function Sparkline({ points }: { points: (number | null)[] }) {
  const W = 88;
  const H = 30;
  const vals = points.map((p) => (typeof p === "number" ? p : null));
  const nums = vals.filter((v): v is number => v !== null);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const step = W / Math.max(1, vals.length - 1);
  const coords = vals.map((v, i) => (v === null ? null : { x: i * step, y: H - 3 - ((v - min) / span) * (H - 6) }));
  const d = coords
    .map((c, i) => (c ? `${i === 0 || !coords[i - 1] ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}` : ""))
    .join(" ");
  const last = [...coords].reverse().find((c) => c !== null) ?? null;

  return (
    <Box component="svg" viewBox={`0 0 ${W} ${H}`} sx={{ width: W, height: H, flexShrink: 0, overflow: "visible" }} aria-hidden>
      <path d={d} fill="none" stroke={DEEMPHASIS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last.x} cy={last.y} r={3.5} fill={ACCENT} stroke="#fff" strokeWidth={2} />}
    </Box>
  );
}

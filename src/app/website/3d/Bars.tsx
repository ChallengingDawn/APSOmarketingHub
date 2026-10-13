"use client";

// Rows of label, bar and figure - the UC apps' horizontal bars, shared by the 3D files tabs.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { full } from "@/app/charts/format";
import { ACCENT, INK, MUTED, TRACK } from "@/app/uc/report/ui";

export default function Bars({ rows, colour = ACCENT }: { rows: { label: string; n: number; colour?: string }[]; colour?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>None in this period.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {rows.map((r) => (
        <Box key={r.label} sx={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,2fr) 52px", alignItems: "center", gap: 1.25 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</Typography>
          <Box sx={{ height: 10, borderRadius: 5, bgcolor: TRACK }}>
            <Box sx={{ height: 10, borderRadius: 5, width: `${(r.n / max) * 100}%`, bgcolor: r.colour ?? colour }} />
          </Box>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(r.n)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

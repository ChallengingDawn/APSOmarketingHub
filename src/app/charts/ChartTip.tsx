"use client";

// The hover readout shared by the Recharts-based charts. Values lead, series
// names follow; each row is keyed by a short stroke of the series colour.
// Names and labels come from API responses, so they are rendered as text
// nodes — never as markup.

import Box from "@mui/material/Box";
import { CHROME } from "./palette";

type Row = { name?: unknown; value?: unknown; color?: string; dataKey?: unknown };

export function ChartTip({
  active,
  payload,
  label,
  format,
  labelFormat,
}: {
  active?: boolean;
  payload?: ReadonlyArray<Row>;
  label?: unknown;
  format: (v: number | null) => string;
  labelFormat?: (l: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const heading = typeof label === "string" || typeof label === "number" ? String(label) : "";

  return (
    <Box
      sx={{
        bgcolor: CHROME.ink,
        color: "#fff",
        borderRadius: 2,
        px: 1.5,
        py: 1,
        boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        minWidth: 150,
        fontSize: "0.78rem",
        pointerEvents: "none",
      }}
    >
      {heading && (
        <Box sx={{ color: "rgba(255,255,255,0.7)", mb: 0.5, fontSize: "0.72rem" }}>
          {labelFormat ? labelFormat(heading) : heading}
        </Box>
      )}
      {payload.map((row, i) => {
        const v = typeof row.value === "number" ? row.value : null;
        const name = typeof row.name === "string" ? row.name : String(row.dataKey ?? "");
        return (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.2 }}>
            <Box sx={{ width: 14, height: 2.5, borderRadius: 1, bgcolor: row.color ?? "#fff", flexShrink: 0 }} />
            <Box sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{format(v)}</Box>
            <Box sx={{ color: "rgba(255,255,255,0.72)" }}>{name}</Box>
          </Box>
        );
      })}
    </Box>
  );
}

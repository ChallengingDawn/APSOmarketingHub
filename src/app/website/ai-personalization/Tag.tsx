"use client";

// APSOconvert's tags, SQUARED (SARCLA 08.11.2026: "tags should be squared" - the filters were squared first, the tags on
// cards, rows and headers stayed round and he saw them still round on the live hub). Same props as the round Chip of
// @/app/connectors/parts, so a page swaps one import; the same tints, a 3px corner and a hairline in the tint's colour.

import Box from "@mui/material/Box";
import { TINT, type Tint } from "@/app/uc/report/ui";

export function Chip({ tint, children }: { tint: Tint; children: React.ReactNode }) {
  const t = TINT[tint];
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", px: 0.85, py: "1px", borderRadius: "3px", bgcolor: t.bg, color: t.fg,
      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${t.fg} 18%, transparent)`, fontSize: "0.72rem", fontWeight: 700,
      lineHeight: 1.5, letterSpacing: ".01em", whiteSpace: "nowrap",
    }}>
      {children}
    </Box>
  );
}

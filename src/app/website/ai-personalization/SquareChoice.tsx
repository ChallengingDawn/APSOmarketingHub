"use client";

// APSOconvert's filters: one choice at a time, SQUARED (SARCLA 08.11.2026: "tags should be squared") - a segmented
// row of square-cornered buttons, the chosen one filled. Same props as the round Choice of @/app/connectors/parts, so a
// page swaps one import. An optional `label` names the row for screen readers and for the eye ("Show", "Kind"...).

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";

const BLUE = "#2459d1";

export function SquareChoice<K extends string>({ value, onChange, options, label }: {
  value: K; onChange: (k: K) => void; options: { key: K; label: string; count?: number; disabled?: boolean }[]; label?: string;
}) {
  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
      {label && <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</Typography>}
      <Box sx={{ display: "inline-flex", flexWrap: "wrap", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(255,255,255,.75)" }}>
        {options.map((o, i) => {
          const on = value === o.key;
          return (
            <Box key={o.key} component="button" type="button" role="radio" aria-checked={on} disabled={o.disabled} onClick={() => onChange(o.key)} sx={{
              all: "unset", cursor: o.disabled ? "default" : "pointer", px: 1.25, py: 0.55, fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.35,
              borderLeft: i ? `1px solid ${HAIRLINE}` : "none", color: on ? "#fff" : o.disabled ? "#b3bccb" : INK, bgcolor: on ? BLUE : "transparent",
              whiteSpace: "nowrap", transition: "background-color .12s, color .12s",
              "&:hover": on || o.disabled ? {} : { bgcolor: "rgba(36,89,209,.07)", color: BLUE },
              "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
            }}>
              {o.label}
              {o.count !== undefined && <Box component="span" sx={{ ml: 0.6, fontWeight: 700, color: on ? "rgba(255,255,255,.85)" : MUTED, fontVariantNumeric: "tabular-nums" }}>{o.count}</Box>}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

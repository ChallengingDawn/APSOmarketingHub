"use client";

// Ranked magnitude. Nominal categories, so every bar wears the same slot-1 hue
// — bar length already says which is bigger. Thin bars (18px), rounded at the
// data end and square at the baseline, value at the tip, hover lifts the bar.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { ACCENT, CHROME } from "./palette";
import { compact, shortLabel } from "./format";

export type BarRow = {
  label: string;
  value: number | null;
  /** A second figure shown after the value, e.g. an engagement rate. */
  secondary?: string;
  href?: string;
};

export function BarList({
  rows,
  format = compact,
  labelWidth = 220,
  maxLabel = 38,
  emptyMessage = "Nothing to show for this window.",
  onSelect,
  selectedLabel,
}: {
  rows: BarRow[];
  format?: (v: number | null) => string;
  labelWidth?: number;
  maxLabel?: number;
  emptyMessage?: string;
  /** Makes rows clickable — used where a bar filters a list below it. */
  onSelect?: (label: string) => void;
  selectedLabel?: string | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...rows.map((r) => (typeof r.value === "number" ? r.value : 0)));

  if (rows.length === 0) {
    return (
      <Box sx={{ border: `1px dashed ${CHROME.axis}`, borderRadius: 2, p: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.85rem", color: CHROME.muted }}>{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Box role="list" sx={{ display: "grid", gap: 0.5 }}>
      {rows.map((r, i) => {
        const v = typeof r.value === "number" ? r.value : 0;
        const width = max > 0 ? Math.max(2, (v / max) * 100) : 0;
        const active = hover === i;
        return (
          <Tooltip
            key={`${r.label}-${i}`}
            title={`${r.label} · ${format(r.value)}${r.secondary ? ` · ${r.secondary}` : ""}`}
            placement="top"
            enterDelay={200}
          >
            <Box
              role="listitem"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={onSelect ? () => onSelect(r.label) : undefined}
              sx={{
                display: "grid",
                gridTemplateColumns: `${labelWidth}px 1fr auto`,
                alignItems: "center",
                gap: 1.5,
                py: 0.4,
                px: 0.5,
                borderRadius: 1.5,
                bgcolor:
                  selectedLabel === r.label
                    ? "rgba(42,120,214,0.12)"
                    : active
                      ? "rgba(42,120,214,0.05)"
                      : "transparent",
                outline: selectedLabel === r.label ? "1px solid rgba(42,120,214,0.4)" : "none",
                transition: "background-color 120ms ease",
                cursor: r.href || onSelect ? "pointer" : "default",
              }}
              component={r.href ? "a" : "div"}
              {...(r.href ? { href: r.href, target: "_blank", rel: "noreferrer" } : {})}
            >
              <Typography
                title={r.label}
                sx={{
                  fontSize: "0.82rem",
                  color: CHROME.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: /^\/|^https?:/.test(r.label) ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
                  textDecoration: "none",
                }}
              >
                {shortLabel(r.label, maxLabel)}
              </Typography>
              <Box sx={{ position: "relative", height: 18 }}>
                <Box
                  sx={{
                    position: "absolute",
                    inset: "0 auto 0 0",
                    width: `${width}%`,
                    bgcolor: ACCENT,
                    opacity: active ? 1 : 0.9,
                    borderRadius: "0 4px 4px 0",
                    transition: "width 220ms ease, opacity 120ms ease",
                  }}
                />
              </Box>
              <Typography
                sx={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: CHROME.ink,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  minWidth: 56,
                  textAlign: "right",
                }}
              >
                {format(r.value)}
                {r.secondary && (
                  <Box component="span" sx={{ color: CHROME.muted, fontWeight: 500, ml: 0.75 }}>
                    {r.secondary}
                  </Box>
                )}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

"use client";

// Ranked magnitude. Nominal categories, so every bar wears the same slot-1 hue
// — bar length already says which is bigger. Thin bars (18px), rounded at the
// data end and square at the baseline, value at the tip, hover lifts the bar.
// Optionally (the Sealing Business Review's rankings, from its pilot): each
// row's place before its name, the columns named above the rows, a figure of
// its own column after the value (a margin), and a bar coloured only where the
// row's meaning has a colour (a loss) - never to tell rows apart.

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
  /** The bar's colour where the row's meaning has one (a negative margin) - else the slot-1 hue. */
  color?: string;
  /** A figure in its own column after the value (a margin), in its own colour when given. */
  note?: { text: string; color?: string };
};

export function BarList({
  rows,
  format = compact,
  labelWidth = 220,
  maxLabel = 38,
  emptyMessage = "Nothing to show for this window.",
  onSelect,
  selectedLabel,
  max: fixedMax,
  ranked = false,
  rankFrom = 1,
  heads,
  noteWidth = 64,
}: {
  rows: BarRow[];
  format?: (v: number | null) => string;
  labelWidth?: number;
  maxLabel?: number;
  emptyMessage?: string;
  /** Makes rows clickable — used where a bar filters a list below it. */
  onSelect?: (label: string) => void;
  selectedLabel?: string | null;
  /** The value of a full bar - a list shown a page at a time keeps one scale across its pages. */
  max?: number;
  /** Each row's place before its name ("01") - a chart beside the list can then name a row by its number. */
  ranked?: boolean;
  /** The first row's place, when the list is a later page of a ranking. */
  rankFrom?: number;
  /** The columns' names above the rows: the name, the value and the note. */
  heads?: { label: string; value: string; note?: string };
  /** The note column's width. */
  noteWidth?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = fixedMax ?? Math.max(0, ...rows.map((r) => (typeof r.value === "number" ? r.value : 0)));
  const withNote = !!heads?.note || rows.some((r) => r.note);
  const columns = `${ranked ? "24px " : ""}${labelWidth}px 1fr auto${withNote ? ` ${noteWidth}px` : ""}`;
  const headSx = { fontSize: "0.66rem", fontWeight: 700, color: CHROME.label, textTransform: "uppercase", letterSpacing: "0.05em" } as const;

  if (rows.length === 0) {
    return (
      <Box sx={{ border: `1px dashed ${CHROME.axis}`, borderRadius: 2, p: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.85rem", color: CHROME.muted }}>{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Box role="list" sx={{ display: "grid", gap: 0.5 }}>
      {heads && (
        <Box aria-hidden sx={{ display: "grid", gridTemplateColumns: columns, alignItems: "center", gap: 1.5, px: 0.5, pb: 0.25 }}>
          {ranked && <span />}
          <Typography sx={headSx}>{heads.label}</Typography>
          <span />
          <Typography sx={{ ...headSx, textAlign: "right", minWidth: 56 }}>{heads.value}</Typography>
          {withNote && <Typography sx={{ ...headSx, textAlign: "right" }}>{heads.note ?? ""}</Typography>}
        </Box>
      )}
      {rows.map((r, i) => {
        const v = typeof r.value === "number" ? r.value : 0;
        const width = max > 0 ? Math.max(2, (v / max) * 100) : 0;
        const active = hover === i;
        return (
          <Tooltip
            key={`${r.label}-${i}`}
            title={`${ranked ? `${rankFrom + i}. ` : ""}${r.label} · ${format(r.value)}${r.secondary ? ` · ${r.secondary}` : ""}${r.note ? ` · ${r.note.text}${heads?.note ? ` ${heads.note.toLowerCase()}` : ""}` : ""}`}
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
                gridTemplateColumns: columns,
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
              {ranked && (
                <Typography sx={{ fontSize: "0.72rem", color: CHROME.label, fontVariantNumeric: "tabular-nums" }}>
                  {String(rankFrom + i).padStart(2, "0")}
                </Typography>
              )}
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
                    bgcolor: r.color ?? ACCENT,
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
              {withNote && (
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: r.note?.color ?? CHROME.muted, fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap" }}>
                  {r.note?.text ?? ""}
                </Typography>
              )}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

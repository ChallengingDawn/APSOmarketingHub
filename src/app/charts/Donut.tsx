"use client";

// Part-to-whole as a ring: where a total comes from (the Sealing Business
// Review's "Where does revenue come from?" and "Which materials sell most?",
// from the Executive Committee's pilot). The parts keep the fixed categorical
// slots, largest first; past the four validated slots the rest share one grey
// arc - never a generated hue (ShareBar's rule). A 2px surface gap parts the
// arcs. The whole sits in the middle; the part under the mouse takes its place.
// The legend beside the ring always carries identity: every part, its share
// and its value - a part folded into the grey arc wears the grey swatch - and
// a click on a row (or an arc) picks the part, as a bar of BarList does.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { CHROME, DEEMPHASIS, FONT, SERIES } from "./palette";
import { compact, percent } from "./format";

export type DonutPart = { label: string; value: number | null };

const REST = "\u0000rest";

export function Donut({
  parts,
  format = compact,
  centerLabel,
  size = 196,
  thickness = 24,
  onSelect,
  selected,
  emptyMessage = "Nothing to split for this window.",
}: {
  parts: DonutPart[];
  format?: (v: number | null) => string;
  /** what the whole in the middle is ("net revenue") */
  centerLabel: string;
  size?: number;
  thickness?: number;
  /** a click on a part's row or arc picks it - used where the ring filters the page */
  onSelect?: (label: string) => void;
  /** the parts picked - the others fade */
  selected?: string[] | null;
  emptyMessage?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const usable = parts
    .filter((p): p is { label: string; value: number } => typeof p.value === "number" && p.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = usable.reduce((a, p) => a + p.value, 0);

  if (total <= 0) {
    return (
      <Box sx={{ border: `1px dashed ${CHROME.axis}`, borderRadius: 2, p: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.85rem", color: CHROME.muted }}>{emptyMessage}</Typography>
      </Box>
    );
  }

  const head = usable.slice(0, SERIES.length);
  const tail = usable.slice(SERIES.length);
  const restValue = tail.reduce((a, p) => a + p.value, 0);
  const restName = tail.length === 1 ? tail[0].label : `The other ${tail.length}`;
  // one arc per slot, the rest together in grey
  const arcs = [
    ...head.map((p, i) => ({ id: p.label, labels: [p.label], value: p.value, color: SERIES[i] as string })),
    ...(tail.length ? [{ id: REST, labels: tail.map((p) => p.label), value: restValue, color: DEEMPHASIS }] : []),
  ];
  const arcOf = (label: string) => arcs.find((a) => a.labels.includes(label)) ?? arcs[arcs.length - 1];
  const lit = hover ? (hover === REST ? arcs.find((a) => a.id === REST) : arcOf(hover)) : null;
  const picked = selected?.length ? selected : null;

  const mid = size / 2;
  const r = mid - thickness / 2 - 4;
  const c = 2 * Math.PI * r;
  let at = 0;

  // the middle: the whole - or the part under the mouse
  const shown = hover === REST ? { label: restName, value: restValue } : hover ? usable.find((p) => p.label === hover) ?? null : null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", fontFamily: FONT }}>
      <Box sx={{ position: "relative", width: size, height: size, flex: "0 0 auto", mx: { xs: "auto", sm: 0 } }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
          aria-label={`${centerLabel} ${format(total)}: ${usable.map((p) => `${p.label} ${percent(p.value / total)}`).join(", ")}`}>
          <g transform={`rotate(-90 ${mid} ${mid})`}>
            <circle cx={mid} cy={mid} r={r} fill="none" stroke={CHROME.grid} strokeWidth={thickness} />
            {arcs.map((a) => {
              const len = (a.value / total) * c;
              const off = at;
              at += len;
              const on = lit?.id === a.id;
              const faded = (!!lit && !on) || (!!picked && !a.labels.some((l) => picked.includes(l)));
              const one = a.labels.length === 1 ? a.labels[0] : null;
              return (
                <circle
                  key={a.id}
                  cx={mid}
                  cy={mid}
                  r={r}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={on ? thickness + 6 : thickness}
                  strokeDasharray={`${Math.max(0.5, len - (arcs.length > 1 ? 2 : 0))} ${c}`}
                  strokeDashoffset={-off}
                  opacity={faded ? 0.35 : 1}
                  style={{ cursor: onSelect && one ? "pointer" : "default", transition: "stroke-width 120ms ease, opacity 120ms ease" }}
                  onMouseEnter={() => setHover(a.id === REST ? REST : a.labels[0])}
                  onMouseLeave={() => setHover(null)}
                  onClick={onSelect && one ? () => onSelect(one) : undefined}
                />
              );
            })}
          </g>
        </svg>
        <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", textAlign: "center", px: `${thickness + 10}px` }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: CHROME.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1.15, letterSpacing: "-0.01em" }}>
            {format(shown ? shown.value : total)}
          </Typography>
          <Typography sx={{ fontSize: "0.7rem", color: CHROME.muted, lineHeight: 1.25, mt: 0.25, overflowWrap: "anywhere" }}>
            {shown ? `${shown.label} · ${percent(shown.value / total)}` : centerLabel}
          </Typography>
        </Box>
      </Box>

      {/* a list to read - or, where a click picks a part, a row of buttons that keep their own role */}
      <Box role={onSelect ? undefined : "list"} sx={{ flex: "1 1 200px", minWidth: 0, display: "grid", gap: 0.25 }}>
        {usable.map((p) => {
          const arc = arcOf(p.label);
          const on = hover === p.label || (hover === REST && arc.id === REST);
          const chosen = !!picked && picked.includes(p.label);
          return (
            <Box
              key={p.label}
              role={onSelect ? undefined : "listitem"}
              component={onSelect ? "button" : "div"}
              {...(onSelect ? { type: "button" as const, onClick: () => onSelect(p.label), "aria-pressed": chosen } : {})}
              onMouseEnter={() => setHover(arc.id === REST ? REST : p.label)}
              onMouseLeave={() => setHover(null)}
              sx={{
                display: "grid",
                gridTemplateColumns: "10px minmax(0, 1fr) auto",
                alignItems: "center",
                columnGap: 1,
                width: "100%",
                border: 0,
                font: "inherit",
                textAlign: "left",
                color: CHROME.ink,
                px: 0.75,
                py: 0.5,
                borderRadius: 1.5,
                cursor: onSelect ? "pointer" : "default",
                bgcolor: chosen ? "rgba(42,120,214,0.12)" : on ? "rgba(42,120,214,0.05)" : "transparent",
                outline: chosen ? "1px solid rgba(42,120,214,0.4)" : "none",
                opacity: picked && !chosen ? 0.7 : 1,
                transition: "background-color 120ms ease",
                "&:focus-visible": { outline: `2px solid ${SERIES[0]}`, outlineOffset: 1 },
              }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: arc.color }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: CHROME.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.label}>
                  {p.label}
                </Typography>
                <Typography sx={{ fontSize: "0.68rem", color: CHROME.muted }}>{percent(p.value / total)} of the whole</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: CHROME.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{format(p.value)}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

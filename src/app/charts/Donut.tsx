"use client";

// Part-to-whole as a ring: where a total comes from (the Sealing Business
// Review's "Where does revenue come from?" and "Which materials sell most?",
// from the Executive Committee's pilot). The parts keep the fixed categorical
// slots, largest first; past the four validated slots the rest share one grey
// arc - never a generated hue (ShareBar's rule). A 2px surface gap parts the
// arcs. The whole sits in the middle; the part under the mouse takes its place.
// The legend beside the ring always carries identity - a part folded into the
// grey arc wears the grey swatch - one line a part: its swatch, its name, its
// share, its value. Past `maxRows` the smallest fold into "Other (n)", which
// opens to list them (SARCLA 11.11.2026: "proportions are not good" - a small
// ring beside a tall legend). The ring and its legend sit centred, side by
// side; a click on a row (or an arc) picks the part, as a bar of BarList does.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { CHROME, DEEMPHASIS, FONT, SERIES } from "./palette";
import { compact, percent } from "./format";

export type DonutPart = { label: string; value: number | null; /** the full name for the tooltip, when the label is a short form */ title?: string };

const REST = "\u0000rest";

export function Donut({
  parts,
  format = compact,
  centerLabel,
  size = 232,
  thickness = 30,
  maxRows = 7,
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
  /** the legend's rows at most - past them the smallest parts fold into "Other (n)" */
  maxRows?: number;
  /** a click on a part's row or arc picks it - used where the ring filters the page */
  onSelect?: (label: string) => void;
  /** the parts picked - the others fade */
  selected?: string[] | null;
  emptyMessage?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // the room it has: the ring takes up to , never more than 40 % of the width, so its legend stays beside it
  const box = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const usable = parts
    .filter((p): p is { label: string; value: number; title?: string } => typeof p.value === "number" && p.value > 0)
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

  // the legend: the largest parts a row each, the smallest folded into "Other (n)" past maxRows
  const rows = Math.max(2, maxRows);
  const listed = usable.length > rows ? usable.slice(0, rows - 1) : usable;
  const folded = usable.length > rows ? usable.slice(rows - 1) : [];
  const foldedValue = folded.reduce((a, p) => a + p.value, 0);

  const side = width >= 400;
  const ring = width ? Math.round(Math.min(size, Math.max(170, side ? (width - 32) * 0.4 : width * 0.8))) : size;
  // a smaller ring, a thinner band - its middle keeps room for the whole
  const band = ring < 200 ? Math.min(thickness, 24) : thickness;
  const mid = ring / 2;
  const r = mid - band / 2 - 4;
  const c = 2 * Math.PI * r;
  let at = 0;

  // the middle: the whole - or the part under the mouse
  const shown = hover === REST ? { label: restName, value: restValue } : hover ? usable.find((p) => p.label === hover) ?? null : null;

  const row = (p: { label: string; value: number; title?: string }, indent = false) => {
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
          gridTemplateColumns: "10px minmax(0, 1fr) auto auto",
          alignItems: "center",
          columnGap: 1.25,
          width: "100%",
          border: 0,
          font: "inherit",
          textAlign: "left",
          color: CHROME.ink,
          pl: indent ? 2.5 : 0.75,
          pr: 0.75,
          py: 0.55,
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
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: CHROME.ink, lineHeight: 1.3, overflow: "hidden", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }} title={p.title ?? p.label}>
          {p.label}
        </Typography>
        <Typography sx={{ fontSize: "0.76rem", color: CHROME.muted, fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: 44 }}>{percent(p.value / total)}</Typography>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: CHROME.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textAlign: "right", minWidth: 92 }}>{format(p.value)}</Typography>
      </Box>
    );
  };

  return (
    <Box ref={box} sx={{ display: "flex", alignItems: "center", justifyContent: "center", columnGap: 3, rowGap: 2, flexWrap: side ? "nowrap" : "wrap", fontFamily: FONT, py: 0.5 }}>
      <Box sx={{ position: "relative", width: ring, height: ring, flex: "0 0 auto" }}>
        <svg width={ring} height={ring} viewBox={`0 0 ${ring} ${ring}`} role="img"
          aria-label={`${centerLabel} ${format(total)}: ${usable.map((p) => `${p.label} ${percent(p.value / total)}`).join(", ")}`}>
          <g transform={`rotate(-90 ${mid} ${mid})`}>
            <circle cx={mid} cy={mid} r={r} fill="none" stroke={CHROME.grid} strokeWidth={band} />
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
                  strokeWidth={on ? band + 6 : band}
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
        <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", textAlign: "center", px: `${band + 6}px` }}>
          <Typography sx={{ fontSize: ring < 200 ? "1.02rem" : "1.3rem", fontWeight: 700, color: CHROME.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            {format(shown ? shown.value : total)}
          </Typography>
          <Typography sx={{ fontSize: "0.74rem", color: CHROME.muted, lineHeight: 1.25, mt: 0.4, overflowWrap: "anywhere" }}>
            {shown ? `${shown.label} · ${percent(shown.value / total)}` : centerLabel}
          </Typography>
        </Box>
      </Box>

      {/* a list to read - or, where a click picks a part, a row of buttons that keep their own role */}
      <Box role={onSelect ? undefined : "list"} sx={{ flex: side ? "1 1 0" : "1 1 100%", maxWidth: 440, minWidth: 0, display: "grid", gap: 0.15 }}>
        {listed.map((p) => row(p))}
        {folded.length > 0 && (
          <>
            <Box component="button" type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open}
              onMouseEnter={() => setHover(REST)} onMouseLeave={() => setHover(null)}
              sx={{
                display: "grid", gridTemplateColumns: "10px minmax(0, 1fr) auto auto", alignItems: "center", columnGap: 1.25, width: "100%",
                border: 0, font: "inherit", textAlign: "left", color: CHROME.ink, px: 0.75, py: 0.55, borderRadius: 1.5, cursor: "pointer",
                bgcolor: hover === REST ? "rgba(42,120,214,0.05)" : "transparent", "&:focus-visible": { outline: `2px solid ${SERIES[0]}`, outlineOffset: 1 },
              }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: DEEMPHASIS }} />
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: CHROME.ink, whiteSpace: "nowrap" }}>
                Other ({folded.length}) <Box component="span" sx={{ color: CHROME.muted, fontWeight: 500 }}>{open ? "▴" : "▾"}</Box>
              </Typography>
              <Typography sx={{ fontSize: "0.76rem", color: CHROME.muted, fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: 44 }}>{percent(foldedValue / total)}</Typography>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: CHROME.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textAlign: "right", minWidth: 92 }}>{format(foldedValue)}</Typography>
            </Box>
            {open && folded.map((p) => row(p, true))}
          </>
        )}
      </Box>
    </Box>
  );
}

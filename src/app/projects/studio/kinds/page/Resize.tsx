"use client";
// DRAG TO RESIZE INSIDE A BLOCK (Content v10, SARCLA 10.11.2026 point 5: "drag and drop to scale object inside of the
// block"). Over the page, on what is selected: a handle on the line between a block's two columns (a text and its picture,
// the hero, a module's two columns) or on a tile's right edge. Dragging it moves the line live in the page, snapping to
// sensible steps (25 / 33 / 50 / 66 / 75 %, a tile's whole columns) with the steps marked and the share said beside it;
// letting go keeps it as the block's setting (drawn the same in Magento's copy - lib .../newpage.ts, .../modules/looks.ts).
// A phone's page stacks as before: the handle only shows where there are two columns.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { PINK } from "../../parts";

export type ResizeSpec =
  | {
    kind: "split"; key: string;
    /** the grid of the two columns, in the page */
    grid: string;
    /** the left column's share now (%), null = the block's own */
    left: number | null;
    steps: number[];
    /** said while dragging ("Text 66 % · picture 33 %") */
    what: (left: number) => string;
    commit: (left: number) => void;
  }
  | { kind: "span"; key: string; el: string; span: number; commit: (n: number) => void };

type Geo = { x: number; top: number; h: number; ticks: number[]; label: (v: number) => string; value: number };

const nearest = (v: number, steps: number[]) => steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), steps[0]);
const px = (v: string | null | undefined) => Number.parseFloat(v ?? "") || 0;

/** The two columns of a grid (its shown children, left to right) - null when it is not two columns now (a phone). */
function columnsOf(grid: HTMLElement): { a: DOMRect; b: DOMRect; inner: { left: number; width: number }; gap: number } | null {
  const win = grid.ownerDocument.defaultView;
  if (!win) return null;
  const cs = win.getComputedStyle(grid);
  if (!/grid/.test(cs.display)) return null;
  const tracks = cs.gridTemplateColumns.split(/\s+/).filter((t) => /px$/.test(t));
  if (tracks.length !== 2) return null;
  const kids = [...grid.children].filter((k) => win.getComputedStyle(k).display !== "none").map((k) => k.getBoundingClientRect()).filter((r) => r.width > 0).sort((x, y) => x.left - y.left);
  if (kids.length < 2) return null;
  const r = grid.getBoundingClientRect();
  const left = r.left + px(cs.paddingLeft) + px(cs.borderLeftWidth);
  const width = r.width - px(cs.paddingLeft) - px(cs.paddingRight) - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
  return { a: kids[0], b: kids[kids.length - 1], inner: { left, width }, gap: px(cs.columnGap) };
}

/** The handle over the selection; `doc` the page's document, `zoom` the preview's, `origin` where the page starts. */
export function ResizeLayer({ spec, doc, frame, zoom, origin, tick }: {
  spec: ResizeSpec; doc: Document | null; frame: HTMLIFrameElement | null; zoom: number; origin: { left: number; top: number };
  /** anything that moves the page (a redraw, the selection) - the handle is measured again */
  tick: string;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const target = useRef<HTMLElement | null>(null);

  // measured from the page as it is laid out now
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      if (!doc || drag !== null) return;
      try {
        if (spec.kind === "split") {
          const g = doc.querySelector(spec.grid) as HTMLElement | null;
          const c = g ? columnsOf(g) : null;
          target.current = g;
          if (!g || !c) { setGeo(null); return; }
          const sy = doc.documentElement.scrollTop || doc.body?.scrollTop || 0;
          const gr = g.getBoundingClientRect();
          const value = spec.left ?? Math.round((c.a.width / (c.a.width + c.b.width)) * 100);
          setGeo({
            x: (c.a.right + c.b.left) / 2, top: gr.top + sy, h: gr.height, value,
            ticks: spec.steps.map((s) => c.inner.left + c.gap / 2 + ((c.inner.width - c.gap) * s) / 100), label: spec.what,
          });
        } else {
          const el = doc.querySelector(spec.el) as HTMLElement | null;
          const grid = el?.parentElement ?? null;
          target.current = el;
          const win = doc.defaultView;
          if (!el || !grid || !win) { setGeo(null); return; }
          const cs = win.getComputedStyle(grid);
          const tracks = cs.gridTemplateColumns.split(/\s+/).filter((t) => /px$/.test(t)).map(px);
          if (tracks.length < 2) { setGeo(null); return; }
          const r = el.getBoundingClientRect();
          const gr = grid.getBoundingClientRect();
          const gap = px(cs.columnGap);
          const sy = doc.documentElement.scrollTop || doc.body?.scrollTop || 0;
          const ticks: number[] = [];
          let x = gr.left + px(cs.paddingLeft);
          for (const t of tracks) { x += t; ticks.push(x); x += gap; }
          setGeo({ x: r.right, top: r.top + sy, h: r.height, value: spec.span, ticks: ticks.filter((t) => t > r.left + 4), label: (n) => (n === 1 ? "1 column" : `${n} columns`) });
        }
      } catch { setGeo(null); }
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, tick, spec.key, spec.kind === "split" ? spec.left : spec.span, zoom, drag === null]);

  if (!geo || !doc || !frame) return null;

  const toFrameX = (clientX: number) => (clientX - frame.getBoundingClientRect().left) / zoom;
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(geo.value);
  };
  const valueAt = (clientX: number): number | null => {
    const x = toFrameX(clientX);
    const el = target.current;
    if (!el) return null;
    if (spec.kind === "split") {
      const c = columnsOf(el);
      if (!c) return null;
      const share = ((x - c.inner.left - c.gap / 2) / Math.max(1, c.inner.width - c.gap)) * 100;
      return nearest(Math.max(10, Math.min(90, share)), spec.steps);
    }
    const r = el.getBoundingClientRect();
    const grid = el.parentElement;
    const win = doc.defaultView;
    if (!grid || !win) return null;
    const cs = win.getComputedStyle(grid);
    const tracks = cs.gridTemplateColumns.split(/\s+/).filter((t) => /px$/.test(t)).map(px);
    const gap = px(cs.columnGap);
    const col = tracks[0] ?? 1;
    const n = Math.round((x - r.left + gap) / (col + gap));
    return Math.max(1, Math.min(Math.min(4, tracks.length), n));
  };
  const show = (v: number) => {
    const el = target.current;
    if (!el) return;
    if (spec.kind === "split") el.style.setProperty("grid-template-columns", `minmax(0,${v}fr) minmax(0,${100 - v}fr)`, "important");
    else el.style.setProperty("grid-column", `span ${v}`, "important");
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const v = valueAt(e.clientX);
    if (v === null || v === drag) return;
    setDrag(v);
    show(v);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* released */ }
    const v = drag;
    setDrag(null);
    if (v === geo.value) {
      // nothing changed: the page as it was
      const el = target.current;
      if (el) { el.style.removeProperty(spec.kind === "split" ? "grid-template-columns" : "grid-column"); }
      return;
    }
    spec.commit(v);
  };

  const left = origin.left + geo.x * zoom;
  const top = origin.top + geo.top * zoom;
  const h = Math.max(36, geo.h * zoom);
  const on = drag !== null;
  return (
    <>
      {on && geo.ticks.map((t, i) => (
        <Box key={i} sx={{ position: "absolute", left: origin.left + t * zoom - 1, top: top - 6, width: 2, height: h + 12, bgcolor: "rgba(194,44,110,.22)", borderRadius: 1, zIndex: 2, pointerEvents: "none" }} />
      ))}
      <Box role="slider" aria-label={spec.kind === "split" ? "Drag to change the columns' widths" : "Drag to make the tile wider"} aria-valuenow={drag ?? geo.value} tabIndex={0}
        title={spec.kind === "split" ? "Drag: the two columns' widths" : "Drag: how many columns the tile spans"}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const steps = spec.kind === "split" ? spec.steps : [1, 2, 3, 4];
          const i = steps.indexOf(geo.value);
          const next = steps[Math.max(0, Math.min(steps.length - 1, (i < 0 ? steps.indexOf(nearest(geo.value, steps)) : i) + (e.key === "ArrowLeft" ? -1 : 1)))];
          if (next !== geo.value) spec.commit(next);
        }}
        sx={{
          position: "absolute", left: left - 9, top, width: 18, height: h, zIndex: 2, cursor: "col-resize", touchAction: "none", outline: "none",
          "&::before": { content: '""', position: "absolute", left: 8, top: 0, bottom: 0, width: 2, borderRadius: 1, bgcolor: PINK, opacity: on ? 1 : 0.55, transition: "opacity .15s" },
          "&:hover::before, &:focus-visible::before": { opacity: 1 },
          "&:focus-visible > span": { boxShadow: "0 0 0 3px rgba(194,44,110,.3)" },
        }}>
        <Box component="span" sx={{ position: "absolute", left: 2, top: "50%", mt: "-22px", width: 14, height: 44, borderRadius: "7px", bgcolor: "#fff", border: `2px solid ${PINK}`, boxSizing: "border-box",
          boxShadow: "0 4px 12px rgba(21,34,58,.25)", display: "grid", placeItems: "center",
          "&::after": { content: '""', width: 2, height: 16, borderLeft: `2px solid ${PINK}`, borderRight: `2px solid ${PINK}`, boxSizing: "content-box", opacity: 0.8 } }} />
      </Box>
      {on && (
        <Box sx={{ position: "absolute", left: left + 14, top: top + h / 2 - 15, zIndex: 6, px: 1.1, py: 0.55, borderRadius: "7px", bgcolor: "#15223a", color: "#fff", fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap", pointerEvents: "none", boxShadow: "0 8px 20px rgba(21,34,58,.3)" }}>
          {geo.label(drag ?? geo.value)}
        </Box>
      )}
    </>
  );
}

"use client";

// How a whole splits, step by step (a Sankey). Columns are the steps, a node's
// height is how many pass through it, and each band carries the ones that go
// from one node to the next - coloured by where they go, so the split reads
// from left to right. Hovering a band or a node lifts it and the bands through
// it, with the count and its share; labels sit beside the nodes with a surface
// halo so they read over the bands. The ChartFrame table twin carries every
// band's exact value.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { CHROME, FONT } from "./palette";

export type SankeyNode = { id: string; column: number; label: string; color: string };
export type SankeyLink = { from: string; to: string; value: number };

const NODE_W = 14;
const GAP = 12;
const HEAD = 24;
const LINE = 15;

type Placed = SankeyNode & { x: number; y: number; h: number; value: number };
type Band = SankeyLink & { i: number; sy: number; ty: number; w: number; color: string };
type Hover = { kind: "link"; i: number } | { kind: "node"; id: string } | null;

export function Sankey({
  nodes,
  links,
  columns,
  height = 360,
  format = (n) => n.toLocaleString("en"),
  label = "Flow diagram",
}: {
  /** Top to bottom within each column, in the order given. */
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** The step names, one per column. */
  columns: string[];
  height?: number;
  format?: (n: number) => string;
  /** What the diagram shows, for screen readers. */
  label?: string;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Hover>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const wide = width >= 760;
  const layout = useMemo(() => {
    if (width <= 0) return null;
    const live = links.filter((l) => l.value > 0);
    const inOf = new Map<string, number>(), outOf = new Map<string, number>();
    for (const l of live) {
      outOf.set(l.from, (outOf.get(l.from) ?? 0) + l.value);
      inOf.set(l.to, (inOf.get(l.to) ?? 0) + l.value);
    }
    const valueOf = (id: string) => Math.max(inOf.get(id) ?? 0, outOf.get(id) ?? 0);
    // room for the first and last columns' labels outside the plot: as wide as the longest (roughly - 12px text)
    const room = (c: number) => Math.min(320, Math.max(90, ...nodes.filter((x) => x.column === c).map((x) => x.label.length * 7 + `${format(valueOf(x.id))} · 100%`.length * 6.4 + 22)));
    const n = Math.max(2, columns.length);
    const padL = wide ? room(0) : 6, padR = wide ? room(n - 1) : 6;
    const colX = (c: number) => padL + (c * (width - padL - padR - NODE_W)) / (n - 1);
    const plotH = height - HEAD - 4;
    const cols = columns.map((_, c) => nodes.filter((x) => x.column === c && valueOf(x.id) > 0));
    // one scale for every column, so a lead is the same height everywhere
    const k = Math.min(...cols.filter((c) => c.length).map((c) => (plotH - (c.length - 1) * GAP) / Math.max(1, c.reduce((a, x) => a + valueOf(x.id), 0))));
    const placed = new Map<string, Placed>();
    cols.forEach((c, ci) => {
      const used = c.reduce((a, x) => a + Math.max(2, valueOf(x.id) * k), 0) + (c.length - 1) * GAP;
      let y = HEAD + Math.max(0, (plotH - used) / 2);
      for (const x of c) {
        const h = Math.max(2, valueOf(x.id) * k);
        placed.set(x.id, { ...x, x: colX(ci), y, h, value: valueOf(x.id) });
        y += h + GAP;
      }
    });
    // the bands leave and enter each node in the order of the nodes at their other end
    const outY = new Map<string, number>(), inY = new Map<string, number>();
    const order = (id: string) => placed.get(id)?.y ?? 0;
    const bands: Band[] = [];
    const byOut = live.map((l, i) => ({ ...l, i })).filter((l) => placed.has(l.from) && placed.has(l.to));
    const sy = new Map<number, number>(), ty = new Map<number, number>();
    for (const l of [...byOut].sort((a, b) => order(a.from) - order(b.from) || order(a.to) - order(b.to))) {
      const s = placed.get(l.from)!;
      const at = outY.get(l.from) ?? s.y;
      sy.set(l.i, at);
      outY.set(l.from, at + l.value * k);
    }
    for (const l of [...byOut].sort((a, b) => order(a.to) - order(b.to) || order(a.from) - order(b.from))) {
      const t = placed.get(l.to)!;
      const at = inY.get(l.to) ?? t.y;
      ty.set(l.i, at);
      inY.set(l.to, at + l.value * k);
    }
    for (const l of byOut) bands.push({ ...l, sy: sy.get(l.i)!, ty: ty.get(l.i)!, w: Math.max(1, l.value * k), color: placed.get(l.to)!.color });
    // labels: beside their node, pushed apart where small nodes sit close
    const labels: { id: string; x: number; y: number; anchor: "start" | "end"; halo: boolean }[] = [];
    cols.forEach((c, ci) => {
      const last = ci === columns.length - 1;
      const left = wide ? ci === 0 : last;
      const ys: number[] = [];
      c.forEach((x, i) => {
        const p = placed.get(x.id)!;
        const want = p.y + p.h / 2;
        ys.push(i ? Math.max(want, ys[i - 1] + LINE) : want);
      });
      const over = ys.length ? ys[ys.length - 1] - (height - 6) : 0;
      if (over > 0) {
        ys[ys.length - 1] -= over;
        for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - LINE);
      }
      c.forEach((x, i) => {
        const p = placed.get(x.id)!;
        labels.push({ id: x.id, x: left ? p.x - 7 : p.x + NODE_W + 7, y: ys[i], anchor: left ? "end" : "start", halo: !(wide && (ci === 0 || last)) });
      });
    });
    return { placed, bands, labels, colX, total: Math.max(0, ...cols.map((c) => c.reduce((a, x) => a + valueOf(x.id), 0))) };
  }, [width, wide, nodes, links, columns, height]);

  const lit = (b: Band) => !hover || (hover.kind === "link" ? hover.i === b.i : hover.id === b.from || hover.id === b.to);
  const nodeLit = (id: string) => !hover || (hover.kind === "node" ? hover.id === id : layout?.bands.some((b) => b.i === hover.i && (b.from === id || b.to === id)));
  const move = (e: React.MouseEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setTip({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const leave = () => { setHover(null); setTip(null); };

  const tipText = (() => {
    if (!hover || !layout) return null;
    if (hover.kind === "link") {
      const b = layout.bands.find((x) => x.i === hover.i);
      const s = b && layout.placed.get(b.from), t = b && layout.placed.get(b.to);
      if (!b || !s || !t) return null;
      return { head: `${s.label} → ${t.label}`, value: format(b.value), note: `${share(b.value, s.value)} of ${s.label}` };
    }
    const p = layout.placed.get(hover.id);
    return p ? { head: p.label, value: format(p.value), note: `${share(p.value, layout.total)} of all` } : null;
  })();

  return (
    <Box ref={box} sx={{ position: "relative", width: "100%", height, fontFamily: FONT }} onMouseLeave={leave}>
      {layout && (
        <svg width={width} height={height} role="img" aria-label={label} style={{ display: "block", overflow: "visible" }}>
          {columns.map((c, ci) => {
            const x = layout.colX(ci);
            const first = ci === 0, last = ci === columns.length - 1;
            return (
              <text key={c} x={first ? (wide ? x + NODE_W : x) : last ? x + NODE_W : x + NODE_W / 2} y={14} textAnchor={first ? (wide ? "end" : "start") : last ? "end" : "middle"}
                style={{ fontSize: 11, fontWeight: 700, fill: CHROME.label, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                {c}
              </text>
            );
          })}
          {layout.bands.map((b) => {
            const x0 = layout.placed.get(b.from)!.x + NODE_W, x1 = layout.placed.get(b.to)!.x, xm = (x0 + x1) / 2;
            const d = `M${x0},${b.sy} C${xm},${b.sy} ${xm},${b.ty} ${x1},${b.ty} L${x1},${b.ty + b.w} C${xm},${b.ty + b.w} ${xm},${b.sy + b.w} ${x0},${b.sy + b.w} Z`;
            const on = lit(b);
            return (
              <path key={b.i} d={d} fill={b.color} fillOpacity={hover ? (on ? 0.62 : 0.1) : 0.36} stroke={CHROME.surface} strokeWidth={0.5}
                style={{ transition: "fill-opacity 120ms ease", cursor: "default" }}
                onMouseEnter={() => setHover({ kind: "link", i: b.i })} onMouseMove={move} />
            );
          })}
          {[...layout.placed.values()].map((p) => (
            <rect key={p.id} x={p.x} y={p.y} width={NODE_W} height={p.h} rx={3} fill={p.color} stroke={CHROME.surface} strokeWidth={2}
              opacity={nodeLit(p.id) ? 1 : 0.35} style={{ transition: "opacity 120ms ease" }}
              onMouseEnter={() => setHover({ kind: "node", id: p.id })} onMouseMove={move} />
          ))}
          {layout.labels.map((l) => {
            const p = layout.placed.get(l.id)!;
            return (
              <text key={l.id} x={l.x} y={l.y} dy="0.35em" textAnchor={l.anchor} pointerEvents="none"
                style={{ fontSize: 12, paintOrder: "stroke", stroke: l.halo ? CHROME.surface : "none", strokeWidth: 4, strokeLinejoin: "round", opacity: nodeLit(l.id) ? 1 : 0.4 }}>
                <tspan style={{ fill: CHROME.ink, fontWeight: 600 }}>{p.label}</tspan>
                <tspan dx={6} style={{ fill: CHROME.muted, fontVariantNumeric: "tabular-nums" }}>{format(p.value)} · {share(p.value, layout.total)}</tspan>
              </text>
            );
          })}
        </svg>
      )}
      {tipText && tip && (
        <Box sx={{ position: "absolute", left: Math.min(tip.x + 14, Math.max(0, width - 240)), top: Math.max(0, tip.y - 64), bgcolor: CHROME.ink, color: "#fff", borderRadius: 2, px: 1.5, py: 1, boxShadow: "0 6px 20px rgba(0,0,0,0.18)", fontSize: "0.78rem", pointerEvents: "none", maxWidth: 240, zIndex: 2 }}>
          <Box sx={{ color: "rgba(255,255,255,0.7)", mb: 0.25, fontSize: "0.72rem" }}>{tipText.head}</Box>
          <Box sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{tipText.value}</Box>
          <Box sx={{ color: "rgba(255,255,255,0.72)" }}>{tipText.note}</Box>
        </Box>
      )}
    </Box>
  );
}

const share = (v: number, of: number) => (of > 0 ? `${Math.round((v / of) * 100)}%` : "–");

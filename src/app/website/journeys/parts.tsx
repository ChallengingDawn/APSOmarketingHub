"use client";

// Website > Journeys - the pieces its pages share: a kind of page as a coloured square and its name (the same colour on
// every page, src/lib/journeys/model.ts KIND_COLOR), the flow through the shop drawn as ribbons whose width is the
// visits, and a funnel of steps with the biggest drop said in red (the signed-in customers' one). Drawn in SVG by hand:
// the layout numbers come from the model (tested), the drawing is here. The choices the pages share: ./controls.tsx.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { full } from "@/app/charts/format";
import { FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TRACK } from "@/app/uc/report/ui";
import {
  KIND_COLOR, KIND_NAME, KIND_ON, layoutFlow, ribbonPath,
  type Drop, type FlowGraph, type FlowKind, type FunnelStep, type JKind,
} from "@/lib/journeys/model";


/** A share as people read it: "34%", "4.2%", "<0.1%". */
export const pct = (r: number | null | undefined) => {
  if (r === null || r === undefined || !Number.isFinite(r)) return "–";
  if (r > 0 && r < 0.001) return "<0.1%";
  return `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`;
};
const ORDINAL = ["Way in", "2nd page", "3rd page", "4th page", "5th page", "6th page", "7th page"];


/** A kind of page: its colour as a small square, and its name. */
export function KindTag({ kind, label, strong }: { kind: FlowKind; label?: string; strong?: boolean }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, minWidth: 0, whiteSpace: "nowrap" }}>
      <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: KIND_COLOR[kind], flexShrink: 0 }} />
      <Box component="span" sx={{ fontSize: "0.82rem", fontWeight: strong ? 700 : 600, color: kind === "left" ? MUTED : INK, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label ?? KIND_NAME[kind]}
      </Box>
    </Box>
  );
}

/** The kinds a chart shows, as a key above it. */
export function KindLegend({ kinds }: { kinds: FlowKind[] }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1, md: 1.75 }, rowGap: 0.75 }}>
      {kinds.map((k) => <KindTag key={k} kind={k} />)}
    </Box>
  );
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

type Tip = { x: number; y: number; head: string; value: string; note: string; hint?: string };

function TipBox({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  return (
    <Box role="status" sx={{
      position: "absolute", left: Math.max(4, Math.min(tip.x + 14, width - 256)), top: Math.max(4, tip.y - 78), width: 240,
      bgcolor: INK, color: "#fff", borderRadius: "10px", px: 1.5, py: 1, boxShadow: "0 8px 24px rgba(21,34,58,.22)",
      fontSize: "0.78rem", pointerEvents: "none", zIndex: 3, lineHeight: 1.35,
    }}>
      <Box sx={{ color: "rgba(255,255,255,.72)", fontSize: "0.72rem", mb: 0.25 }}>{tip.head}</Box>
      <Box sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: "0.9rem" }}>{tip.value}</Box>
      <Box sx={{ color: "rgba(255,255,255,.8)" }}>{tip.note}</Box>
      {tip.hint && <Box sx={{ color: "rgba(255,255,255,.6)", mt: 0.5, fontSize: "0.72rem" }}>{tip.hint}</Box>}
    </Box>
  );
}

/* ── the flow through the shop ────────────────────────────────────────── */

const NODE_W = 12;
const HEAD = 30;
const FLOW_H = 470;
/** under this width the chart scrolls sideways inside its card instead of squeezing */
const FLOW_MIN_W = 860;
const PAD_L = 132;
const PAD_R = 138;

/**
 * The visits' way through the shop, column by column (src/lib/journeys/model.ts chainFlow): the ribbons' width is the
 * visits, coloured by where they go. A hover gives the exact numbers and the share; a click on a kind opens its pages.
 */
export function JourneyFlowChart({ flow, selected, onPick }: { flow: FlowGraph; selected: JKind | null; onPick: (k: JKind) => void }) {
  const [box, boxW] = useWidth<HTMLDivElement>();
  const width = Math.max(FLOW_MIN_W, boxW);
  const [hover, setHover] = useState<{ node?: string; link?: string } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);

  const L = useMemo(() => {
    if (boxW <= 0) return null;
    const plotW = width - PAD_L - PAD_R;
    const laid = layoutFlow(flow, { width: plotW, height: FLOW_H - 6, nodeWidth: NODE_W, gap: 9, top: HEAD, minLink: 0.0015 });
    const nodes = laid.nodes.map((n) => ({ ...n, x: n.x + PAD_L }));
    const links = laid.links.map((l) => ({ ...l, key: `${l.source}>${l.target}`, x0: l.x0 + PAD_L, x1: l.x1 + PAD_L }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const colX = Array.from({ length: flow.columns }, (_, c) => PAD_L + (flow.columns > 1 ? (c * (plotW - NODE_W)) / (flow.columns - 1) : 0));
    return { nodes, links, byId, colX };
  }, [flow, width, boxW]);

  const at = (e: React.MouseEvent) => {
    const r = inner.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };
  const nodeTip = (id: string, p: { x: number; y: number }): Tip | null => {
    const n = L?.byId.get(id);
    if (!n) return null;
    return {
      ...p, head: `${ORDINAL[n.col] ?? `${n.col + 1}th page`} · ${KIND_NAME[n.kind]}`, value: `${full(n.value)} visits`,
      note: `${pct(n.value / flow.total)} of all visits`, hint: n.kind === "left" ? undefined : "Click to see its pages",
    };
  };
  const linkTip = (key: string, p: { x: number; y: number }): Tip | null => {
    const l = L?.links.find((x) => x.key === key);
    const s = l && L?.byId.get(l.source), t = l && L?.byId.get(l.target);
    if (!l || !s || !t) return null;
    return {
      ...p,
      head: t.kind === "left" ? `${KIND_NAME[s.kind]}, then left the shop` : `${KIND_NAME[s.kind]} → ${KIND_NAME[t.kind]}`,
      value: `${full(l.value)} visits`,
      note: `${pct(l.value / s.value)} of those ${KIND_ON[s.kind]} at the ${ORDINAL[s.col]?.toLowerCase() ?? "step"} · ${pct(l.value / flow.total)} of all visits`,
    };
  };
  const litLink = (l: { key: string; source: string; target: string }) =>
    !hover ? true : hover.link ? hover.link === l.key : hover.node === l.source || hover.node === l.target;
  const litNode = (id: string) =>
    !hover ? true : hover.node ? hover.node === id || L!.links.some((l) => (l.source === hover.node && l.target === id) || (l.target === hover.node && l.source === id))
      : L!.links.some((l) => l.key === hover.link && (l.source === id || l.target === id));
  const leave = () => { setHover(null); setTip(null); };
  const lastCol = flow.columns - 1;

  return (
    <Box ref={box} sx={{ width: "100%", minWidth: 0, overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}>
      <Box ref={inner} onMouseLeave={leave} sx={{ position: "relative", width, height: FLOW_H }}>
        {L && (
          <svg width={width} height={FLOW_H} role="img" aria-label="How visitors move through the shop, page after page" style={{ display: "block" }}>
            {L.colX.map((x, c) => (
              <text key={c} x={c === 0 ? x + NODE_W : c === lastCol ? x : x + NODE_W / 2} y={14}
                textAnchor={c === 0 ? "end" : c === lastCol ? "start" : "middle"}
                style={{ fontSize: 11, fontWeight: 700, fill: FAINT, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {ORDINAL[c] ?? `${c + 1}th page`}
              </text>
            ))}
            {L.links.map((l) => {
              const t = L.byId.get(l.target)!;
              const on = litLink(l);
              return (
                <path key={l.key} d={ribbonPath(l.x0, l.sy, l.x1, l.ty, l.w)} fill={t.kind === "left" && hover && on ? "#8e98aa" : KIND_COLOR[t.kind]}
                  fillOpacity={hover ? (on ? 0.62 : 0.07) : t.kind === "left" ? 0.3 : 0.34}
                  style={{ transition: "fill-opacity 120ms ease", cursor: "default" }}
                  onMouseEnter={(e) => { setHover({ link: l.key }); setTip(linkTip(l.key, at(e))); }}
                  onMouseMove={(e) => { setHover({ link: l.key }); setTip(linkTip(l.key, at(e))); }}
                  onClick={(e) => { setHover({ link: l.key }); setTip(linkTip(l.key, at(e))); }} />
              );
            })}
            {L.nodes.map((n) => {
              const pick = n.kind !== "left";
              const sel = selected !== null && n.kind === selected;
              return (
                <g key={n.id} role={pick ? "button" : undefined} tabIndex={pick ? 0 : undefined}
                  aria-label={`${ORDINAL[n.col] ?? ""} ${KIND_NAME[n.kind]}: ${full(n.value)} visits${pick ? " - open its pages" : ""}`}
                  style={{ cursor: pick ? "pointer" : "default", outline: "none" }}
                  onMouseEnter={(e) => { setHover({ node: n.id }); setTip(nodeTip(n.id, at(e))); }}
                  onMouseMove={(e) => { setHover({ node: n.id }); setTip(nodeTip(n.id, at(e))); }}
                  onClick={() => { if (pick) onPick(n.kind as JKind); }}
                  onKeyDown={(e) => { if (pick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick(n.kind as JKind); } }}>
                  {/* a wider invisible target, so a thin node can be hovered and clicked */}
                  <rect x={n.x - 6} y={n.y - 3} width={NODE_W + 12} height={Math.max(n.h + 6, 14)} fill="transparent" />
                  <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx={3} fill={KIND_COLOR[n.kind]}
                    stroke={sel ? INK : "#fff"} strokeWidth={sel ? 2 : 1.5} opacity={litNode(n.id) ? 1 : 0.3}
                    style={{ transition: "opacity 120ms ease" }} />
                </g>
              );
            })}
            {L.nodes.filter((n) => n.h >= 12).map((n) => {
              const left = n.col === 0;
              const x = left ? n.x - 8 : n.x + NODE_W + 7;
              const halo = !left && n.col !== lastCol;
              return (
                <text key={`t${n.id}`} x={x} y={n.y + n.h / 2} dy="0.35em" textAnchor={left ? "end" : "start"} pointerEvents="none"
                  style={{ fontSize: 12, paintOrder: "stroke", stroke: halo ? "rgba(255,255,255,.92)" : "none", strokeWidth: 4, strokeLinejoin: "round", opacity: litNode(n.id) ? 1 : 0.35 }}>
                  <tspan style={{ fill: n.kind === "left" ? MUTED : INK, fontWeight: 600 }}>{KIND_NAME[n.kind]}</tspan>
                  <tspan dx={5} style={{ fill: MUTED, fontVariantNumeric: "tabular-nums" }}>{pct(n.value / flow.total)}</tspan>
                </text>
              );
            })}
          </svg>
        )}
        <TipBox tip={tip} width={width} />
      </Box>
    </Box>
  );
}

/* ── a funnel ─────────────────────────────────────────────────────────── */

/**
 * The steps top to bottom, each bar as wide as its share of the first step; between two steps, how many did not go on -
 * the biggest drop in red. `stops` names why, where the source knows (the shop's record: "No stock for the quantity").
 */
export function StepFunnel({ steps, drop, unit, stops }: { steps: FunnelStep[]; drop: Drop | null; unit: string; stops?: Record<string, string> }) {
  const first = steps[0]?.n ?? null;
  return (
    <Box sx={{ display: "grid", gap: 0 }}>
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1] : null;
        const lost = prev && prev.n !== null && s.n !== null && prev.n >= s.n ? prev.n - s.n : null;
        const share = lost !== null && prev?.n ? lost / prev.n : null;
        const biggest = !!drop && drop.to.key === s.key && drop.from.key === prev?.key;
        const w = first && s.n !== null ? Math.max(0.4, (s.n / first) * 100) : 0;
        const last = i === steps.length - 1;
        return (
          <Box key={s.key}>
            {prev && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.6, pl: { xs: 0, sm: "200px" } }}>
                <Box aria-hidden sx={{ width: 2, height: 16, bgcolor: biggest ? RED : HAIRLINE, borderRadius: 1, ml: 1 }} />
                <Typography sx={{ fontSize: "0.76rem", color: biggest ? RED : MUTED, fontWeight: biggest ? 700 : 500 }}>
                  {share === null ? "–" : `${pct(share)} did not go on`}{lost !== null && lost > 0 ? ` · ${full(lost)}` : ""}
                  {stops?.[s.key] ? ` · ${stops[s.key]}` : ""}
                  {biggest ? " · the biggest drop" : ""}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "190px minmax(0, 1fr)" }, columnGap: 1.25, rowGap: 0.4, alignItems: "center" }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{s.label}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0, height: 22, borderRadius: "6px", bgcolor: TRACK, overflow: "hidden" }}>
                  <Box sx={{ height: "100%", width: `${w}%`, bgcolor: last ? GREEN : "#2459d1", opacity: last ? 0.9 : Math.max(0.45, 1 - i * 0.1), borderRadius: "6px", transition: "width .3s ease" }} />
                </Box>
                <Box sx={{ minWidth: 92, textAlign: "right" }}>
                  <Typography component="div" sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{full(s.n)}</Typography>
                  <Typography component="div" sx={{ fontSize: "0.72rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{i === 0 ? unit : first ? `${pct((s.n ?? 0) / first)} of all` : "–"}</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** A small stacked bar: where a page's visitors went next, by kind, and who left. */
export function NextBar({ next, left }: { next: { kind: JKind; share: number }[]; left: number }) {
  const parts = [...next, { kind: "left" as const, share: left }].filter((p) => p.share > 0) as { kind: FlowKind; share: number }[];
  const title = parts.map((p) => `${KIND_NAME[p.kind]} ${pct(p.share)}`).join(" · ");
  return (
    <Box title={title} sx={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", bgcolor: TRACK, width: "100%", minWidth: 80 }}>
      {parts.map((p) => <Box key={p.kind} sx={{ width: `${p.share * 100}%`, bgcolor: KIND_COLOR[p.kind] }} />)}
    </Box>
  );
}

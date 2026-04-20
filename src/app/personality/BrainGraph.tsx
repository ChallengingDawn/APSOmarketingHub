"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

type Kind = "editable" | "ingested" | "derived";

type NodeDef = {
  id: string;
  label: string;
  sub: string;
  kind: Kind;
  mass: number;
};

type Edge = { from: string; to: string };

type LiveNode = NodeDef & {
  ax: number; // anchor x
  ay: number; // anchor y
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

const NODES: NodeDef[] = [
  { id: "engine", label: "Content Engine", sub: "Claude + Gemini", kind: "derived", mass: 1.5 },
  { id: "voice", label: "Brand Voice", sub: "Tone · Storyline · DNA", kind: "editable", mass: 1.15 },
  { id: "guard", label: "Positioning Guard", sub: "APSOparts vs A+P", kind: "editable", mass: 1 },
  { id: "phrases", label: "Signature Phrases", sub: "Reusable library", kind: "editable", mass: 1 },
  { id: "product", label: "Product Rules", sub: "Page structure", kind: "editable", mass: 1 },
  { id: "social", label: "Social Rules", sub: "LinkedIn template", kind: "editable", mass: 1 },
  { id: "gold", label: "Gold Examples", sub: "7 posts · 3 ads", kind: "editable", mass: 1 },
  { id: "category", label: "Category Intel", sub: "411 leafs · 304 gaps", kind: "ingested", mass: 1 },
  { id: "keywords", label: "Keyword Signals", sub: "FFKM spike · DE codes", kind: "ingested", mass: 1 },
];

const EDGES: Edge[] = [
  { from: "voice", to: "engine" },
  { from: "guard", to: "engine" },
  { from: "phrases", to: "engine" },
  { from: "product", to: "engine" },
  { from: "social", to: "engine" },
  { from: "gold", to: "engine" },
  { from: "category", to: "engine" },
  { from: "keywords", to: "engine" },
  { from: "voice", to: "guard" },
  { from: "voice", to: "phrases" },
  { from: "social", to: "gold" },
  { from: "product", to: "social" },
];

const COLORS: Record<Kind, { core: string; glow: string; particle: string }> = {
  editable: { core: "#2fb48a", glow: "rgba(47,180,138,0.4)", particle: "#4ad0a4" },
  ingested: { core: "#d99429", glow: "rgba(217,148,41,0.38)", particle: "#eeb04f" },
  derived: { core: "#ed1b2f", glow: "rgba(237,27,47,0.45)", particle: "#ff5c73" },
};

const BASE_RADIUS = 48;
const CANVAS_W = 1600;
const CANVAS_H = 900;
const CENTER = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
const RING_R = 340;

function computeAnchors(): Record<string, { x: number; y: number }> {
  const outer = ["voice", "phrases", "gold", "social", "product", "guard", "keywords", "category"];
  const anchors: Record<string, { x: number; y: number }> = {
    engine: { x: CENTER.x, y: CENTER.y },
  };
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < outer.length; i++) {
    const t = startAngle + (i / outer.length) * Math.PI * 2;
    anchors[outer[i]] = {
      x: CENTER.x + Math.cos(t) * RING_R,
      y: CENTER.y + Math.sin(t) * RING_R,
    };
  }
  return anchors;
}

function initLayout(): LiveNode[] {
  const anchors = computeAnchors();
  return NODES.map((n) => {
    const a = anchors[n.id];
    return {
      ...n,
      ax: a.x,
      ay: a.y,
      x: a.x,
      y: a.y,
      vx: 0,
      vy: 0,
      r: BASE_RADIUS * n.mass,
    };
  });
}

export default function BrainGraph({
  activeId,
  onNodeClick,
}: {
  activeId?: string;
  onNodeClick?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<LiveNode[]>(initLayout());
  const [, setTick] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dragRef = useRef<{
    id: string;
    dx: number;
    dy: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const animRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  const focusId = hoverId ?? activeId ?? null;
  const focusSet = new Set<string>();
  if (focusId) {
    focusSet.add(focusId);
    EDGES.forEach((e) => {
      if (e.from === focusId) focusSet.add(e.to);
      if (e.to === focusId) focusSet.add(e.from);
    });
  }

  const step = useCallback(() => {
    const nodes = nodesRef.current;
    const anchorK = 0.028;
    const repel = 36000;
    const damping = 0.78;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (dragRef.current?.id === a.id) continue;
      a.vx += (a.ax - a.x) * anchorK;
      a.vy += (a.ay - a.y) * anchorK;

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = Math.max(900, dx * dx + dy * dy);
        const minDist = (a.r + b.r) * 1.15;
        if (d2 < minDist * minDist) {
          const d = Math.sqrt(d2);
          const f = repel / d2;
          a.vx += (dx / d) * f * 0.05;
          a.vy += (dy / d) * f * 0.05;
        }
      }

      a.vx *= damping;
      a.vy *= damping;
      a.x += a.vx;
      a.y += a.vy;
    }
  }, []);

  useEffect(() => {
    let last = performance.now();
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      timeRef.current += dt;
      step();
      setTick((v) => v + 1);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [step]);

  const toLocal = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    dragRef.current = { id, dx: x - node.x, dy: y - node.y, moved: false, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const node = nodesRef.current.find((n) => n.id === dragRef.current!.id);
    if (!node) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    const nx = x - dragRef.current.dx;
    const ny = y - dragRef.current.dy;
    if (Math.hypot(nx - node.x, ny - node.y) > 2) dragRef.current.moved = true;
    node.x = nx;
    node.y = ny;
    node.vx = 0;
    node.vy = 0;
  };

  const onPointerUp = (_e: React.PointerEvent, id: string) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved) {
      onNodeClick?.(id);
    }
  };

  const nodes = nodesRef.current;
  const getNode = (id: string) => nodes.find((n) => n.id === id)!;

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 140px)",
        minHeight: 560,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 45%, #ffffff 0%, #f3f5f8 55%, #e8ecf2 100%)",
        touchAction: "none",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(26,58,76,0.08) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: "10% 10% 10% 10%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(237,27,47,0.08) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <svg
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <defs>
          {EDGES.map((e, i) => {
            const fromKind = NODES.find((n) => n.id === e.from)!.kind;
            const toKind = NODES.find((n) => n.id === e.to)!.kind;
            return (
              <linearGradient key={i} id={`edge-grad-${i}`} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={COLORS[fromKind].core} stopOpacity="0.75" />
                <stop offset="100%" stopColor={COLORS[toKind].core} stopOpacity="0.75" />
              </linearGradient>
            );
          })}
          <filter id="particle-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {EDGES.map((e, i) => {
          const a = getNode(e.from);
          const b = getNode(e.to);
          const isFocus = focusId && focusSet.has(a.id) && focusSet.has(b.id);
          const gradId = `edge-grad-${i}`;
          const fromColors = COLORS[a.kind];
          const key = `${e.from}-${e.to}`;
          const length = Math.hypot(b.x - a.x, b.y - a.y);
          const tOffset = ((timeRef.current / 2800) + i * 0.17) % 1;
          const pX = a.x + (b.x - a.x) * tOffset;
          const pY = a.y + (b.y - a.y) * tOffset;
          return (
            <g key={key}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={`url(#${gradId})`}
                strokeWidth={isFocus ? 3 : 1.5}
                opacity={focusId ? (isFocus ? 0.95 : 0.12) : 0.4}
              />
              {(!focusId || isFocus) && length > 60 && (
                <circle
                  cx={pX}
                  cy={pY}
                  r={isFocus ? 4 : 3}
                  fill={fromColors.particle}
                  opacity={isFocus ? 1 : 0.8}
                  filter="url(#particle-glow)"
                />
              )}
            </g>
          );
        })}
      </svg>

      {nodes.map((n) => {
        const colors = COLORS[n.kind];
        const focused = focusId === n.id;
        const neighbor = focusId !== null && focusId !== n.id && focusSet.has(n.id);
        const dimmed = focusId !== null && !focused && !neighbor;
        const xPct = (n.x / CANVAS_W) * 100;
        const yPct = (n.y / CANVAS_H) * 100;
        return (
          <Box
            key={n.id}
            role="button"
            tabIndex={0}
            onMouseEnter={() => setHoverId(n.id)}
            onMouseLeave={() => setHoverId(null)}
            onPointerDown={(e) => onPointerDown(e, n.id)}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => onPointerUp(e, n.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNodeClick?.(n.id);
              }
            }}
            sx={{
              position: "absolute",
              left: `${xPct}%`,
              top: `${yPct}%`,
              width: n.r * 2,
              height: n.r * 2,
              marginLeft: `-${n.r}px`,
              marginTop: `-${n.r}px`,
              borderRadius: "50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              cursor: "grab",
              userSelect: "none",
              touchAction: "none",
              background: `radial-gradient(circle at 35% 30%, ${colors.core}FF, ${colors.core}D8 60%, ${colors.core}B0 100%)`,
              border: `2px solid ${colors.core}`,
              color: "#ffffff",
              boxShadow: focused
                ? `0 0 0 8px ${colors.glow}, 0 14px 36px ${colors.glow}, inset 0 -6px 12px rgba(0,0,0,0.15)`
                : `0 6px 22px ${colors.glow}, inset 0 -4px 10px rgba(0,0,0,0.12)`,
              opacity: dimmed ? 0.35 : 1,
              transform: focused
                ? "scale(1.08)"
                : neighbor
                  ? "scale(1.03)"
                  : "scale(1)",
              transition: "transform 0.25s ease, opacity 0.3s ease, box-shadow 0.25s ease",
              "&:active": { cursor: "grabbing" },
              "&:hover": { transform: "scale(1.08)" },
              "&:focus-visible": {
                outline: `3px solid ${colors.core}`,
                outlineOffset: 4,
              },
            }}
          >
            <Typography
              sx={{
                fontSize: 12 * n.mass,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.1,
                px: 1,
                textShadow: "0 1px 6px rgba(0,0,0,0.35)",
                letterSpacing: "-0.005em",
              }}
            >
              {n.label}
            </Typography>
            <Typography
              sx={{
                fontSize: 9.5 * n.mass,
                color: "rgba(255,255,255,0.92)",
                lineHeight: 1.2,
                mt: 0.4,
                px: 1,
                fontWeight: 500,
                textShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }}
            >
              {n.sub}
            </Typography>
          </Box>
        );
      })}

      <Box
        sx={{
          position: "absolute",
          top: 14,
          left: 20,
          display: "flex",
          alignItems: "center",
          gap: 1,
          pointerEvents: "none",
          opacity: 0.8,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "#ed1b2f",
            boxShadow: "0 0 10px rgba(237,27,47,0.7)",
            animation: "apsoPulseDot 1.4s ease-in-out infinite",
          }}
        />
        <Typography
          sx={{
            fontSize: 10,
            color: "#1a3a4c",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            fontWeight: 700,
          }}
        >
          Live brain
        </Typography>
      </Box>

      <Box
        sx={{
          position: "absolute",
          bottom: 14,
          left: 20,
          display: "flex",
          gap: 1.25,
          p: 0.75,
          pr: 1.25,
          borderRadius: 999,
          bgcolor: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(26,58,76,0.08)",
          pointerEvents: "none",
        }}
      >
        {(Object.keys(COLORS) as Kind[]).map((k) => (
          <Box key={k} sx={{ display: "flex", alignItems: "center", gap: 0.6, px: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: COLORS[k].core,
                boxShadow: `0 0 8px ${COLORS[k].glow}`,
              }}
            />
            <Typography
              sx={{
                fontSize: 10,
                color: "#3c4043",
                textTransform: "capitalize",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            >
              {k}
            </Typography>
          </Box>
        ))}
      </Box>

      <style>{`
        @keyframes apsoPulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>
    </Box>
  );
}

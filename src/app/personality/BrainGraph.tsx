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
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

const NODES: NodeDef[] = [
  { id: "voice", label: "Brand Voice", sub: "Tone · Storyline · DNA", kind: "editable", mass: 1.4 },
  { id: "guard", label: "Positioning Guard", sub: "APSOparts vs A+P", kind: "editable", mass: 1 },
  { id: "phrases", label: "Signature Phrases", sub: "Reusable library", kind: "editable", mass: 1 },
  { id: "product", label: "Product Rules", sub: "Page structure", kind: "editable", mass: 0.95 },
  { id: "social", label: "Social Rules", sub: "LinkedIn template", kind: "editable", mass: 0.95 },
  { id: "gold", label: "Gold Examples", sub: "7 posts · 3 ads", kind: "editable", mass: 1 },
  { id: "category", label: "Category Intel", sub: "411 leafs · 304 gaps", kind: "ingested", mass: 1.05 },
  { id: "keywords", label: "Keyword Signals", sub: "FFKM spike · DE codes", kind: "ingested", mass: 1.05 },
  { id: "engine", label: "Content Engine", sub: "Claude + Gemini", kind: "derived", mass: 1.6 },
];

const EDGES: Edge[] = [
  { from: "voice", to: "guard" },
  { from: "voice", to: "phrases" },
  { from: "voice", to: "social" },
  { from: "guard", to: "product" },
  { from: "guard", to: "social" },
  { from: "phrases", to: "gold" },
  { from: "social", to: "gold" },
  { from: "product", to: "engine" },
  { from: "social", to: "engine" },
  { from: "gold", to: "engine" },
  { from: "category", to: "engine" },
  { from: "keywords", to: "engine" },
];

const COLORS: Record<Kind, { core: string; glow: string; label: string; particle: string }> = {
  editable: { core: "#38d0a8", glow: "rgba(56,208,168,0.55)", label: "#c6f7e6", particle: "#7dffcf" },
  ingested: { core: "#ffb347", glow: "rgba(255,179,71,0.5)", label: "#ffe4b5", particle: "#ffcf7a" },
  derived: { core: "#ff2e63", glow: "rgba(255,46,99,0.65)", label: "#ffd5dd", particle: "#ff7ea1" },
};

const BASE_RADIUS = 38;
const CANVAS_W = 1000;
const CANVAS_H = 560;
const CENTER = { x: CANVAS_W / 2, y: CANVAS_H / 2 };

function initLayout(): LiveNode[] {
  return NODES.map((n, i) => {
    const angle = (i / NODES.length) * Math.PI * 2;
    const radius = 220;
    return {
      ...n,
      x: CENTER.x + Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
      y: CENTER.y + Math.sin(angle) * radius + (Math.random() - 0.5) * 20,
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
    const repel = 6800;
    const springLen = 170;
    const springK = 0.02;
    const centerK = 0.004;
    const damping = 0.86;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (dragRef.current?.id === a.id) continue;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = Math.max(40, dx * dx + dy * dy);
        const f = repel / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f * 0.016;
        a.vy += (dy / d) * f * 0.016;
      }
    }

    for (const e of EDGES) {
      const a = nodes.find((n) => n.id === e.from)!;
      const b = nodes.find((n) => n.id === e.to)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const diff = d - springLen;
      const fx = (dx / d) * diff * springK;
      const fy = (dy / d) * diff * springK;
      if (dragRef.current?.id !== a.id) {
        a.vx += fx;
        a.vy += fy;
      }
      if (dragRef.current?.id !== b.id) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    for (const n of nodes) {
      if (dragRef.current?.id === n.id) continue;
      n.vx += (CENTER.x - n.x) * centerK;
      n.vy += (CENTER.y - n.y) * centerK;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      const margin = n.r + 12;
      n.x = Math.max(margin, Math.min(CANVAS_W - margin, n.x));
      n.y = Math.max(margin, Math.min(CANVAS_H - margin, n.y));
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
        aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid #101520",
        background: "#05080d",
        touchAction: "none",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: -40,
          background:
            "radial-gradient(60% 60% at 20% 30%, rgba(56,208,168,0.18) 0%, transparent 60%), " +
            "radial-gradient(60% 60% at 80% 70%, rgba(255,46,99,0.2) 0%, transparent 60%), " +
            "radial-gradient(50% 50% at 50% 50%, rgba(255,179,71,0.1) 0%, transparent 70%)",
          animation: "apsoAurora 18s ease-in-out infinite alternate",
          filter: "blur(24px)",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
          backgroundSize: "24px 24px",
          pointerEvents: "none",
        }}
      />

      <svg
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        preserveAspectRatio="xMidYMid meet"
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
                <stop offset="0%" stopColor={COLORS[fromKind].core} stopOpacity="0.9" />
                <stop offset="100%" stopColor={COLORS[toKind].core} stopOpacity="0.9" />
              </linearGradient>
            );
          })}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
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
          const tOffset = ((timeRef.current / 2600) + i * 0.17) % 1;
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
                strokeWidth={isFocus ? 2.2 : 1.2}
                opacity={focusId ? (isFocus ? 0.95 : 0.15) : 0.55}
              />
              {(!focusId || isFocus) && length > 40 && (
                <circle
                  cx={pX}
                  cy={pY}
                  r={isFocus ? 3.4 : 2.4}
                  fill={fromColors.particle}
                  opacity={isFocus ? 1 : 0.75}
                  filter="url(#node-glow)"
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
        const ringPulse = focused ? "apsoPulseStrong" : "apsoPulse";
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
              background: `radial-gradient(circle at 30% 30%, ${colors.core}F0, ${colors.core}90 55%, ${colors.core}55 100%)`,
              border: `1.5px solid ${colors.core}`,
              color: colors.label,
              boxShadow: focused
                ? `0 0 0 4px ${colors.glow}, 0 0 30px 4px ${colors.glow}, inset 0 0 14px rgba(255,255,255,0.18)`
                : `0 0 18px ${colors.glow}, inset 0 0 10px rgba(255,255,255,0.12)`,
              opacity: dimmed ? 0.25 : 1,
              transform: focused
                ? "scale(1.12)"
                : neighbor
                  ? "scale(1.05)"
                  : "scale(1)",
              transition: "transform 0.25s ease, opacity 0.3s ease, box-shadow 0.25s ease",
              animation: `${ringPulse} ${focused ? 1.8 : 2.6}s ease-in-out infinite`,
              "&:active": { cursor: "grabbing" },
              "&:hover": { transform: "scale(1.12)" },
              "&:focus-visible": {
                outline: `2px solid ${colors.core}`,
                outlineOffset: 4,
              },
            }}
          >
            <Typography
              sx={{
                fontSize: 11 * n.mass,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.08,
                px: 0.6,
                textShadow: "0 1px 6px rgba(0,0,0,0.55)",
                letterSpacing: "-0.01em",
              }}
            >
              {n.label}
            </Typography>
            <Typography
              sx={{
                fontSize: 8.8 * n.mass,
                color: colors.label,
                opacity: 0.9,
                lineHeight: 1.2,
                mt: 0.3,
                px: 0.6,
                fontWeight: 500,
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
          top: 16,
          left: 18,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "#ff2e63",
            boxShadow: "0 0 14px rgba(255,46,99,0.9)",
            animation: "apsoPulseDot 1.4s ease-in-out infinite",
          }}
        />
        <Typography
          sx={{
            fontSize: 11,
            color: "#e4e8ef",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 700,
          }}
        >
          Live brain · drag to reshape
        </Typography>
      </Box>

      <Box
        sx={{
          position: "absolute",
          bottom: 16,
          left: 18,
          display: "flex",
          gap: 1.25,
          p: 0.9,
          pr: 1.25,
          borderRadius: 999,
          bgcolor: "rgba(15,20,26,0.65)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {(Object.keys(COLORS) as Kind[]).map((k) => (
          <Box key={k} sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 0.5 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: COLORS[k].core,
                boxShadow: `0 0 10px ${COLORS[k].glow}`,
              }}
            />
            <Typography
              sx={{
                fontSize: 10.5,
                color: "#e4e8ef",
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

      <Typography
        sx={{
          position: "absolute",
          top: 16,
          right: 18,
          fontSize: 11,
          color: "rgba(228,232,239,0.7)",
          fontStyle: "italic",
          letterSpacing: "0.02em",
        }}
      >
        Click to edit · drag to move
      </Typography>

      <style>{`
        @keyframes apsoAurora {
          0% { transform: translate(-10px, -10px) scale(1); }
          100% { transform: translate(20px, 14px) scale(1.08); }
        }
        @keyframes apsoPulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.12); }
        }
        @keyframes apsoPulseStrong {
          0%, 100% { filter: brightness(1.05); }
          50% { filter: brightness(1.3); }
        }
        @keyframes apsoPulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>
    </Box>
  );
}
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import ShieldIcon from "@mui/icons-material/Shield";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ShareIcon from "@mui/icons-material/Share";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

type Kind = "editable" | "ingested" | "derived";

type NodeDef = {
  id: string;
  label: string;
  sub: string;
  kind: Kind;
  mass: number;
  color: string;
  accent: string;
  icon: React.ReactElement<{ sx?: Record<string, unknown> }>;
  orbitRadius: number;
  orbitPeriod: number;
  orbitPhase: number;
};

type Edge = { from: string; to: string };

type LiveNode = NodeDef & {
  ax: number;
  ay: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

export type BrainGraphHandle = {
  getNodeRect: (id: string) => DOMRect | null;
};

const NODES: NodeDef[] = [
  {
    id: "engine",
    label: "Content Engine",
    sub: "Claude + Gemini",
    kind: "derived",
    mass: 1.45,
    color: "#ed1b2f",
    accent: "#ff6478",
    icon: <AutoAwesomeIcon />,
    orbitRadius: 0,
    orbitPeriod: 0,
    orbitPhase: 0,
  },
  {
    id: "voice",
    label: "Brand Voice",
    sub: "Tone · Storyline",
    kind: "editable",
    mass: 1.1,
    color: "#6f42c1",
    accent: "#b197ff",
    icon: <RecordVoiceOverIcon />,
    orbitRadius: 10,
    orbitPeriod: 14000,
    orbitPhase: 0.0,
  },
  {
    id: "guard",
    label: "Positioning Guard",
    sub: "APSOparts vs A+P",
    kind: "editable",
    mass: 1,
    color: "#1d4ed8",
    accent: "#6d8fe3",
    icon: <ShieldIcon />,
    orbitRadius: 9,
    orbitPeriod: 16000,
    orbitPhase: 0.8,
  },
  {
    id: "phrases",
    label: "Signature Phrases",
    sub: "Reusable library",
    kind: "editable",
    mass: 1,
    color: "#0d9488",
    accent: "#5ccfc3",
    icon: <FormatQuoteIcon />,
    orbitRadius: 10,
    orbitPeriod: 12000,
    orbitPhase: 1.7,
  },
  {
    id: "product",
    label: "Product Rules",
    sub: "Page structure",
    kind: "editable",
    mass: 1,
    color: "#ea580c",
    accent: "#ffa06a",
    icon: <Inventory2Icon />,
    orbitRadius: 11,
    orbitPeriod: 18000,
    orbitPhase: 2.3,
  },
  {
    id: "social",
    label: "Social Rules",
    sub: "LinkedIn template",
    kind: "editable",
    mass: 1,
    color: "#0a66c2",
    accent: "#6aa9ed",
    icon: <ShareIcon />,
    orbitRadius: 9,
    orbitPeriod: 15000,
    orbitPhase: 3.1,
  },
  {
    id: "gold",
    label: "Gold Examples",
    sub: "7 posts · 3 ads",
    kind: "editable",
    mass: 1,
    color: "#d4a017",
    accent: "#ffd969",
    icon: <EmojiEventsIcon />,
    orbitRadius: 10,
    orbitPeriod: 13000,
    orbitPhase: 4.2,
  },
  {
    id: "category",
    label: "Category Intel",
    sub: "411 · 304 gaps",
    kind: "ingested",
    mass: 1,
    color: "#15803d",
    accent: "#6cd19a",
    icon: <AccountTreeIcon />,
    orbitRadius: 10,
    orbitPeriod: 20000,
    orbitPhase: 5.0,
  },
  {
    id: "keywords",
    label: "Keyword Signals",
    sub: "FFKM · DE codes",
    kind: "ingested",
    mass: 1,
    color: "#be185d",
    accent: "#ee7daf",
    icon: <ManageSearchIcon />,
    orbitRadius: 9,
    orbitPeriod: 17000,
    orbitPhase: 5.7,
  },
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

const BASE_RADIUS = 52;
const CANVAS_W = 1600;
const CANVAS_H = 900;
const CENTER = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
const RING_R = 360;

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
  onNodeClick?: (id: string, rect: DOMRect) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
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
    const anchorK = 0.05;
    const repel = 70000;
    const damping = 0.7;
    const time = timeRef.current;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (dragRef.current?.id === a.id) continue;

      const orbitX =
        a.orbitPeriod > 0
          ? Math.cos((time / a.orbitPeriod) * Math.PI * 2 + a.orbitPhase) * a.orbitRadius
          : 0;
      const orbitY =
        a.orbitPeriod > 0
          ? Math.sin((time / a.orbitPeriod) * Math.PI * 2 + a.orbitPhase) * a.orbitRadius
          : 0;
      const targetX = a.ax + orbitX;
      const targetY = a.ay + orbitY;

      a.vx += (targetX - a.x) * anchorK;
      a.vy += (targetY - a.y) * anchorK;

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = Math.max(900, dx * dx + dy * dy);
        const minDist = (a.r + b.r) * 1.2;
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

  const onPointerUp = (e: React.PointerEvent, id: string) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved) {
      const target = e.currentTarget as HTMLElement;
      onNodeClick?.(id, target.getBoundingClientRect());
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
        borderRadius: 0,
        background:
          "radial-gradient(ellipse 90% 70% at 50% 40%, #ffffff 0%, #edf2fb 55%, #d9e3f2 100%)",
        touchAction: "none",
        boxShadow: "inset 0 0 0 1px rgba(39,78,100,0.08)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(26,58,76,0.10) 1px, transparent 0)",
          backgroundSize: "26px 26px",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: "8% 14%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(237,27,47,0.08) 0%, transparent 55%)",
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
            const from = NODES.find((n) => n.id === e.from)!;
            const to = NODES.find((n) => n.id === e.to)!;
            return (
              <linearGradient key={i} id={`edge-grad-${i}`} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={from.color} stopOpacity="0.75" />
                <stop offset="100%" stopColor={to.color} stopOpacity="0.75" />
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
          const key = `${e.from}-${e.to}`;
          const length = Math.hypot(b.x - a.x, b.y - a.y);
          const tOffset = ((timeRef.current / 3200) + i * 0.17) % 1;
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
                strokeWidth={isFocus ? 3 : 1.4}
                opacity={focusId ? (isFocus ? 0.95 : 0.12) : 0.36}
              />
              {(!focusId || isFocus) && length > 60 && (
                <circle
                  cx={pX}
                  cy={pY}
                  r={isFocus ? 4 : 2.8}
                  fill={a.accent}
                  opacity={isFocus ? 1 : 0.8}
                  filter="url(#particle-glow)"
                />
              )}
            </g>
          );
        })}
      </svg>

      {nodes.map((n) => {
        const focused = focusId === n.id;
        const neighbor = focusId !== null && focusId !== n.id && focusSet.has(n.id);
        const dimmed = focusId !== null && !focused && !neighbor;
        const xPct = (n.x / CANVAS_W) * 100;
        const yPct = (n.y / CANVAS_H) * 100;
        const borderStyle = n.kind === "ingested" ? "dashed" : "solid";
        const iconSize = 20 + n.mass * 6;
        return (
          <Box
            key={n.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(n.id, el as HTMLElement);
            }}
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
                const el = nodeRefs.current.get(n.id);
                if (el) onNodeClick?.(n.id, el.getBoundingClientRect());
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
              background: `radial-gradient(circle at 32% 28%, ${n.color}FF, ${n.color}E5 55%, ${n.color}BF 100%)`,
              border: `2px ${borderStyle} ${n.color}`,
              color: "#ffffff",
              boxShadow: focused
                ? `0 0 0 8px ${n.color}26, 0 14px 36px ${n.color}55, inset 0 -6px 14px rgba(0,0,0,0.18)`
                : `0 6px 22px ${n.color}40, inset 0 -4px 10px rgba(0,0,0,0.14)`,
              opacity: dimmed ? 0.35 : 1,
              transform: focused ? "scale(1.08)" : neighbor ? "scale(1.03)" : "scale(1)",
              transition: "opacity 0.3s ease, box-shadow 0.25s ease, transform 0.25s ease",
              "&:active": { cursor: "grabbing" },
              "&:hover": { transform: "scale(1.08)" },
              "&:focus-visible": {
                outline: `3px solid ${n.color}`,
                outlineOffset: 4,
              },
            }}
          >
            <Box
              sx={{
                mb: 0.3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
              }}
            >
              {React.cloneElement(n.icon, {
                sx: { fontSize: iconSize, color: "#ffffff" },
              })}
            </Box>
            <Typography
              sx={{
                fontSize: 11.5 * n.mass,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.1,
                px: 0.8,
                textShadow: "0 1px 6px rgba(0,0,0,0.45)",
                letterSpacing: "-0.005em",
              }}
            >
              {n.label}
            </Typography>
            <Typography
              sx={{
                fontSize: 9 * n.mass,
                color: "rgba(255,255,255,0.94)",
                lineHeight: 1.2,
                mt: 0.25,
                px: 0.8,
                fontWeight: 500,
                textShadow: "0 1px 3px rgba(0,0,0,0.35)",
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
          opacity: 0.85,
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
          bgcolor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(26,58,76,0.1)",
          pointerEvents: "none",
          boxShadow: "0 2px 8px rgba(26,58,76,0.08)",
        }}
      >
        {(
          [
            { k: "editable" as Kind, label: "Editable", style: "solid" },
            { k: "ingested" as Kind, label: "Ingested (dashed)", style: "dashed" },
            { k: "derived" as Kind, label: "Engine", style: "solid" },
          ]
        ).map((k) => (
          <Box key={k.k} sx={{ display: "flex", alignItems: "center", gap: 0.6, px: 0.5 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                border: `1.5px ${k.style} #274e64`,
                bgcolor: k.k === "derived" ? "#ed1b2f" : "transparent",
              }}
            />
            <Typography
              sx={{
                fontSize: 10,
                color: "#3c4043",
                letterSpacing: "0.04em",
                fontWeight: 600,
              }}
            >
              {k.label}
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

import React from "react";

export { NODES as BRAIN_NODES };

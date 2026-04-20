"use client";
import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

type NodeDef = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  kind: "editable" | "ingested" | "derived";
  size: number;
};

type Edge = { from: string; to: string };

const NODES: NodeDef[] = [
  { id: "voice", label: "Brand Voice", sub: "Tone · Storyline · DNA", x: 50, y: 18, kind: "editable", size: 1.2 },
  { id: "guard", label: "Positioning Guard", sub: "APSOparts vs A+P", x: 20, y: 34, kind: "editable", size: 1 },
  { id: "phrases", label: "Signature Phrases", sub: "Reusable library", x: 80, y: 34, kind: "editable", size: 1 },
  { id: "product", label: "Product Rules", sub: "Page structure", x: 16, y: 58, kind: "editable", size: 0.95 },
  { id: "social", label: "Social Rules", sub: "LinkedIn template", x: 50, y: 50, kind: "editable", size: 0.95 },
  { id: "gold", label: "Gold Examples", sub: "7 posts · 3 ads", x: 84, y: 58, kind: "editable", size: 0.95 },
  { id: "category", label: "Category Intel", sub: "411 leafs · 304 gaps", x: 22, y: 82, kind: "ingested", size: 0.95 },
  { id: "keywords", label: "Keyword Signals", sub: "FFKM spike · DE codes", x: 78, y: 82, kind: "ingested", size: 0.95 },
  { id: "engine", label: "Content Engine", sub: "Claude + Gemini", x: 50, y: 86, kind: "derived", size: 1.1 },
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

const COLORS: Record<NodeDef["kind"], { bg: string; border: string; dot: string; glow: string }> = {
  editable: { bg: "#e8f0f4", border: "#274e64", dot: "#274e64", glow: "rgba(39,78,100,0.35)" },
  ingested: { bg: "#fef7e6", border: "#b8860b", dot: "#b8860b", glow: "rgba(184,134,11,0.35)" },
  derived: { bg: "#fdebed", border: "#ed1b2f", dot: "#ed1b2f", glow: "rgba(237,27,47,0.4)" },
};

export default function BrainGraph({
  activeId,
  onNodeClick,
}: {
  activeId?: string;
  onNodeClick?: (id: string) => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getNode = (id: string) => NODES.find((n) => n.id === id)!;
  const focusId = hoverId ?? activeId ?? null;

  const focusSet = new Set<string>();
  if (focusId) {
    focusSet.add(focusId);
    EDGES.forEach((e) => {
      if (e.from === focusId) focusSet.add(e.to);
      if (e.to === focusId) focusSet.add(e.from);
    });
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: { xs: 520, md: 620 },
        bgcolor: "#0f141a",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
        backgroundSize: "22px 22px",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid #1f2933",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {EDGES.map((e, i) => {
          const a = getNode(e.from);
          const b = getNode(e.to);
          const isFocus = focusId && (focusSet.has(a.id) && focusSet.has(b.id));
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={isFocus ? "#ed1b2f" : "#3c4a58"}
              strokeWidth={isFocus ? 0.35 : 0.18}
              opacity={focusId ? (isFocus ? 0.95 : 0.18) : 0.5}
              vectorEffect="non-scaling-stroke"
              style={{ transition: "all 0.25s ease" }}
            />
          );
        })}
      </svg>

      {NODES.map((n) => {
        const colors = COLORS[n.kind];
        const focused = focusId === n.id;
        const neighbor = focusId !== null && focusId !== n.id && focusSet.has(n.id);
        const dimmed = focusId !== null && !focused && !neighbor;
        const radius = 44 * n.size;
        return (
          <Box
            key={n.id}
            role="button"
            tabIndex={0}
            onClick={() => onNodeClick?.(n.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNodeClick?.(n.id);
              }
            }}
            onMouseEnter={() => setHoverId(n.id)}
            onMouseLeave={() => setHoverId(null)}
            sx={{
              position: "absolute",
              left: `${n.x}%`,
              top: `${n.y}%`,
              width: radius * 2,
              height: radius * 2,
              marginLeft: `-${radius}px`,
              marginTop: `-${radius}px`,
              borderRadius: "50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              cursor: "pointer",
              userSelect: "none",
              bgcolor: colors.bg,
              border: `2px solid ${colors.border}`,
              boxShadow: focused
                ? `0 0 0 6px ${colors.glow}, 0 10px 28px ${colors.glow}`
                : "0 2px 10px rgba(0,0,0,0.35)",
              opacity: dimmed ? 0.35 : mounted ? 1 : 0,
              transform: focused
                ? "scale(1.08)"
                : neighbor
                  ? "scale(1.02)"
                  : "scale(1)",
              transition:
                "transform 0.25s ease, opacity 0.35s ease, box-shadow 0.25s ease",
              "&:hover": {
                transform: "scale(1.08)",
              },
              "&:focus-visible": {
                outline: `3px solid ${colors.border}`,
                outlineOffset: 2,
              },
            }}
          >
            <Typography
              sx={{
                fontSize: 12 * n.size,
                fontWeight: 700,
                color: colors.border,
                lineHeight: 1.1,
                px: 0.5,
              }}
            >
              {n.label}
            </Typography>
            <Typography
              sx={{
                fontSize: 9.5 * n.size,
                color: "#5f6368",
                lineHeight: 1.2,
                mt: 0.35,
                px: 0.75,
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
          left: 16,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#ed1b2f" }}
          className="animate-pulse-dot"
        />
        <Typography
          sx={{
            fontSize: 11,
            color: "#cfd3d7",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 600,
          }}
        >
          Brain graph
        </Typography>
      </Box>

      <Box
        sx={{
          position: "absolute",
          bottom: 14,
          left: 16,
          display: "flex",
          gap: 2,
        }}
      >
        {(Object.keys(COLORS) as NodeDef["kind"][]).map((k) => (
          <Box key={k} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                bgcolor: COLORS[k].dot,
                boxShadow: `0 0 8px ${COLORS[k].glow}`,
              }}
            />
            <Typography
              sx={{
                fontSize: 10.5,
                color: "#cfd3d7",
                textTransform: "capitalize",
                letterSpacing: "0.04em",
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
          top: 14,
          right: 16,
          fontSize: 11,
          color: "#7a828a",
          fontStyle: "italic",
        }}
      >
        Click a node to edit
      </Typography>
    </Box>
  );
}
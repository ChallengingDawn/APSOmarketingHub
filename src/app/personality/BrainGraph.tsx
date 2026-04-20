"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

type NodeDef = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  kind: "editable" | "ingested" | "derived";
};

type Edge = { from: string; to: string };

const NODES: NodeDef[] = [
  { id: "voice", label: "Brand Voice", sub: "Tone · Storyline · DNA", x: 50, y: 8, kind: "editable" },
  { id: "guard", label: "Positioning Guard", sub: "APSOparts vs A+P parent", x: 18, y: 28, kind: "editable" },
  { id: "phrases", label: "Signature Phrases", sub: "Reusable library", x: 82, y: 28, kind: "editable" },
  { id: "product", label: "Product Rules", sub: "Page structure, style", x: 18, y: 55, kind: "editable" },
  { id: "social", label: "Social Rules", sub: "LinkedIn template", x: 50, y: 55, kind: "editable" },
  { id: "gold", label: "Gold Examples", sub: "7 posts + 3 ads", x: 82, y: 55, kind: "editable" },
  { id: "category", label: "Category Intel", sub: "411 leafs · 304 gaps", x: 18, y: 82, kind: "ingested" },
  { id: "keywords", label: "Keyword Signals", sub: "FFKM spike · DE codes", x: 50, y: 82, kind: "ingested" },
  { id: "engine", label: "Content Engine", sub: "Claude + Gemini", x: 82, y: 82, kind: "derived" },
];

const EDGES: Edge[] = [
  { from: "voice", to: "guard" },
  { from: "voice", to: "phrases" },
  { from: "voice", to: "product" },
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

const COLORS: Record<NodeDef["kind"], { bg: string; border: string; dot: string }> = {
  editable: { bg: "#e8f0f4", border: "#274e64", dot: "#274e64" },
  ingested: { bg: "#fef7e6", border: "#b8860b", dot: "#b8860b" },
  derived: { bg: "#fdebed", border: "#ed1b2f", dot: "#ed1b2f" },
};

export default function BrainGraph({ activeId }: { activeId?: string }) {
  const getNode = (id: string) => NODES.find((n) => n.id === id)!;

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        bgcolor: "#fafbfc",
        borderRadius: 2,
        border: "1px solid #ececec",
        overflow: "hidden",
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
          const active = activeId === e.from || activeId === e.to;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={active ? "#ed1b2f" : "#c4c7c5"}
              strokeWidth={active ? 0.35 : 0.2}
              opacity={active ? 0.9 : 0.55}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {NODES.map((n) => {
        const colors = COLORS[n.kind];
        const active = activeId === n.id;
        return (
          <Box
            key={n.id}
            sx={{
              position: "absolute",
              left: `${n.x}%`,
              top: `${n.y}%`,
              px: 1.25,
              py: 0.75,
              bgcolor: colors.bg,
              border: `1.5px solid ${colors.border}`,
              borderRadius: 2,
              minWidth: 110,
              textAlign: "center",
              boxShadow: active ? "0 4px 14px rgba(237,27,47,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
              transition: "box-shadow 0.2s, transform 0.2s",
              transform: active
                ? "translate(-50%, -50%) scale(1.06)"
                : "translate(-50%, -50%) scale(1)",
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: colors.border, lineHeight: 1.15 }}>
              {n.label}
            </Typography>
            <Typography sx={{ fontSize: 10, color: "#5f6368", lineHeight: 1.2, mt: 0.25 }}>
              {n.sub}
            </Typography>
          </Box>
        );
      })}

      <Box sx={{ position: "absolute", bottom: 8, left: 10, display: "flex", gap: 1.5, fontSize: 10 }}>
        {(Object.keys(COLORS) as NodeDef["kind"][]).map((k) => (
          <Box key={k} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: COLORS[k].dot,
              }}
            />
            <Typography sx={{ fontSize: 10, color: "#5f6368", textTransform: "capitalize" }}>
              {k}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
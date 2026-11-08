"use client";
// THE SELECTED OBJECT'S PROPERTIES (SARCLA 08.11.2026: "the window needs to be movable, so it doesn't appear in front of
// the design"). The editor's own sections (Content, Font, Colour, Effects, Arrange) live here, never on the board:
// docked as a column on the right by default, or floating - dragged by its handle wherever it is out of the way, and
// kept there next time. With nothing selected it shows the page's layers.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VerticalSplitOutlinedIcon from "@mui/icons-material/VerticalSplitOutlined";
import TitleIcon from "@mui/icons-material/Title";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";

import type { DesignNode } from "@/lib/design-document";
import { plainText } from "@/lib/editor/richText";
import { LOGOS, formatLabel } from "@/lib/content/studio/kinds/social/design";
import { T } from "./look";
import type { StudioCtx } from "./Studio";

const W = 312;
type Place = { x: number; y: number };

function readPlace(): { mode: "dock" | "float"; at: Place | null } {
  try {
    const v = JSON.parse(window.localStorage.getItem("social-inspector") ?? "null") as { mode?: string; at?: Place } | null;
    return { mode: v?.mode === "float" ? "float" : "dock", at: v?.at && Number.isFinite(v.at.x) && Number.isFinite(v.at.y) ? v.at : null };
  } catch { return { mode: "dock", at: null }; }
}
function keepPlace(v: { mode: "dock" | "float"; at: Place | null }) {
  try { window.localStorage.setItem("social-inspector", JSON.stringify(v)); } catch { /* no storage */ }
}

const isLogo = (n: DesignNode) => n.kind === "image" && Object.values(LOGOS).some((l) => l.src === n.src);
function layerName(n: DesignNode): string {
  if (n.kind === "text") return plainText(n.text).replace(/\s+/g, " ").trim().slice(0, 40) || "Text";
  if (isLogo(n)) return "APSOparts logo";
  if (n.kind === "image") return "Picture";
  if (n.kind === "rect") return (n.width ?? 0) > 0 && (n.height ?? 0) > 0 && n.fill === "#DDE5EB" ? "Picture frame" : "Shape";
  if (n.kind === "ellipse") return "Circle";
  if (n.kind === "arrow") return "Arrow";
  if (n.kind === "scrim") return "Shade";
  return n.kind;
}
function layerIcon(n: DesignNode) {
  if (n.kind === "text") return <TitleIcon />;
  if (isLogo(n)) return <WorkspacePremiumOutlinedIcon />;
  if (n.kind === "image") return <ImageOutlinedIcon />;
  return <CategoryOutlinedIcon />;
}

function Layers({ ctx }: { ctx: StudioCtx }) {
  const nodes = ctx.live?.nodes ?? [];
  const c = ctx.canvas.current;
  const patch = (id: string, p: Partial<DesignNode>) => c?.commit((all) => all.map((n) => (n.id === id ? { ...n, ...p } : n)));
  return (
    <Box sx={{ px: 1.5, pb: 2 }}>
      <Box sx={{ px: 0.75, py: 1.5 }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: T.ink }}>Nothing selected</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: T.ink3, mt: 0.25, lineHeight: 1.45 }}>
          Click something on the page to change it. Double-click a text to type in it; put *stars* around words to make them red.
        </Typography>
      </Box>
      <Typography sx={{ px: 0.75, fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.ink3, mb: 0.5 }}>
        Layers · {ctx.live ? formatLabel(ctx.fmt, ctx.doc.design) : ""}
      </Typography>
      {!nodes.length && <Typography sx={{ px: 0.75, fontSize: "0.8rem", color: T.ink3 }}>The page is empty.</Typography>}
      {[...nodes].reverse().map((n) => (
        <Box key={n.id} onClick={() => c?.select([n.id])} sx={{
          display: "flex", alignItems: "center", gap: 1, px: 0.75, py: 0.6, borderRadius: "8px", cursor: "pointer", opacity: n.hidden ? 0.45 : 1,
          "&:hover": { bgcolor: T.hover }, "&:hover .acts": { opacity: 1 }, "& > svg": { fontSize: 16, color: T.ink3 },
        }}>
          {layerIcon(n)}
          <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", color: T.ink }}>{layerName(n)}</Typography>
          <Box className="acts" sx={{ display: "flex", opacity: n.locked || n.hidden ? 1 : 0, transition: "opacity .12s", "& button": { all: "unset", cursor: "pointer", width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: "6px", color: T.ink3, "&:hover": { bgcolor: "#fff", color: T.ink } }, "& svg": { fontSize: 15 } }}>
            <Tooltip title={n.hidden ? "Show" : "Hide"}><button type="button" onClick={(e) => { e.stopPropagation(); patch(n.id, { hidden: !n.hidden }); }}>{n.hidden ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}</button></Tooltip>
            <Tooltip title={n.locked ? "Unlock" : "Lock"}><button type="button" onClick={(e) => { e.stopPropagation(); patch(n.id, { locked: !n.locked }); }}>{n.locked ? <LockOutlinedIcon /> : <LockOpenOutlinedIcon />}</button></Tooltip>
            <Tooltip title="Delete"><button type="button" onClick={(e) => { e.stopPropagation(); c?.commit((all) => all.filter((x) => x.id !== n.id)); }}><DeleteOutlineIcon /></button></Tooltip>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function Inspector({ ctx, onHost }: { ctx: StudioCtx; onHost: (el: HTMLElement | null) => void }) {
  const [state, setState] = useState<{ mode: "dock" | "float"; at: Place | null }>({ mode: "dock", at: null });
  useEffect(() => { setState(readPlace()); }, []);
  const hostRef = useCallback((el: HTMLDivElement | null) => { if (el) onHost(el); }, [onHost]);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const empty = ctx.selection.length === 0;
  const float = state.mode === "float";
  const at = state.at ?? { x: typeof window === "undefined" ? 800 : window.innerWidth - W - 28, y: 132 };
  const clamp = (p: Place): Place => ({ x: Math.min(window.innerWidth - 120, Math.max(8, p.x)), y: Math.min(window.innerHeight - 60, Math.max(64, p.y)) });
  const setMode = (mode: "dock" | "float") => { const next = { mode, at: state.at }; setState(next); keepPlace(next); };

  const header = (
    <Box
      onPointerDown={float ? (e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = { dx: e.clientX - at.x, dy: e.clientY - at.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } : undefined}
      onPointerMove={float ? (e) => { if (drag.current) setState((s) => ({ ...s, at: clamp({ x: e.clientX - drag.current!.dx, y: e.clientY - drag.current!.dy }) })); } : undefined}
      onPointerUp={float ? () => { if (drag.current) { drag.current = null; setState((s) => { keepPlace(s); return s; }); } } : undefined}
      sx={{
        display: "flex", alignItems: "center", gap: 0.75, px: 1.5, height: 46, flexShrink: 0, borderBottom: `1px solid ${T.line}`,
        cursor: float ? "grab" : "default", userSelect: "none", touchAction: "none", "&:active": float ? { cursor: "grabbing" } : {},
      }}>
      {float && <DragIndicatorIcon sx={{ fontSize: 18, color: T.ink3, ml: -0.5 }} />}
      <Typography sx={{ flex: 1, fontSize: "0.86rem", fontWeight: 700, color: T.ink }}>{empty ? "Page" : "Selected"}</Typography>
      <Tooltip title={float ? "Dock it on the right" : "Float it - drag it anywhere"}>
        <Box component="button" type="button" aria-label={float ? "Dock the properties" : "Float the properties"} onClick={() => setMode(float ? "dock" : "float")} sx={{ all: "unset", cursor: "pointer", width: 30, height: 30, borderRadius: "8px", display: "grid", placeItems: "center", color: T.ink3, "&:hover": { bgcolor: T.hover, color: T.ink } }}>
          {float ? <VerticalSplitOutlinedIcon sx={{ fontSize: 18 }} /> : <OpenInNewIcon sx={{ fontSize: 17 }} />}
        </Box>
      </Tooltip>
    </Box>
  );

  const body = (
    <>
      {header}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Box ref={hostRef} sx={{
          display: empty ? "none" : "block",
          // the editor's selection card, made part of this column: no frame of its own, its controls in full
          "& > .MuiCard-root": { border: "0 !important", borderRadius: "0 !important", m: "0 !important", boxShadow: "none !important", bgcolor: "transparent !important" },
          "& > .MuiCard-root > .MuiBox-root": { maxHeight: "none !important" },
          "& .MuiButton-root": { textTransform: "none", borderRadius: "6px" },
          // the object's name on its own line, the sections under it
          "& > .MuiCard-root > .MuiBox-root:first-of-type > .MuiTypography-root:first-of-type": { flex: "1 1 calc(100% - 32px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        }} />
        {empty && <Layers ctx={ctx} />}
      </Box>
    </>
  );

  if (!float) {
    return (
      <Box component="aside" aria-label="Properties" sx={{ width: W, height: "100%", bgcolor: "#fff", borderLeft: `1px solid ${T.line}`, display: "flex", flexDirection: "column", minHeight: 0, zIndex: 2 }}>
        {body}
      </Box>
    );
  }
  return (
    <Box sx={{ width: 0 }}>
      {typeof document !== "undefined" && createPortal(
        <Box component="aside" aria-label="Properties" sx={{
          position: "fixed", left: at.x, top: at.y, width: W, maxHeight: "min(640px, calc(100vh - 160px))", display: "flex", flexDirection: "column",
          bgcolor: "rgba(255,255,255,.97)", backdropFilter: "blur(10px)", borderRadius: "14px", border: `1px solid ${T.line}`, boxShadow: T.shadowLg, zIndex: 1200, overflow: "hidden",
        }}>
          {body}
        </Box>,
        document.body,
      )}
    </Box>
  );
}

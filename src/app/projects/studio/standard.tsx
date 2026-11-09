"use client";
// THE STUDIO FLOW STANDARD'S SHARED PIECES (night of 09.11.2026; SARCLA: "I see that the features are there but the
// editing and the flow is not logical yet for me"). One way of working in all six studios - these are the parts every
// studio's left pane is made of, built first for the social post studio, ready for the others to take:
//
//   MapRow       a part of the thing in the map: its state mark (written / empty / picture missing / being written),
//                its name, one line of what it holds, a chevron; open = its fields under it
//   PictureSlot  ONE picture slot everywhere: empty = dashed frame with the idea, "Make it" (pink) + "Upload"; making =
//                the frame shimmers with a progress line and a clock; filled = the picture + Make another · Upload ·
//                Gallery · Remove
//   LastStep     the foot of the left pane: "LAST STEP · <name>", opening its own view
//   BackRow      "← <map>" at the top of a view that opened in the left pane
//   useClock     "0:12" while something runs - nothing frozen, nothing silent
// Squared corners (6-8 px), one pink primary, MUI icons only.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { PINK } from "./parts";

const INK = "#16202a";
const MUTED = "#8a94a3";
const LINE = "rgba(17,24,39,.08)";
const still = { "@media (prefers-reduced-motion: reduce)": { animation: "none" } };

/** "0:12" from the moment `on` turns true; "" while it is off. */
export function useClock(on: boolean): string {
  const since = useRef<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) { since.current = null; return; }
    since.current = Date.now();
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [on]);
  if (!on || since.current === null) return on ? "0:00" : "";
  const s = Math.max(0, Math.floor((Date.now() - since.current) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A surface the AI is writing: a soft pink light passing over it. Spread into an `sx`. */
export const shimmerSx = {
  backgroundImage: "linear-gradient(100deg, rgba(194,44,110,.05) 0%, rgba(194,44,110,.05) 35%, rgba(255,255,255,.75) 50%, rgba(194,44,110,.05) 65%, rgba(194,44,110,.05) 100%)",
  backgroundSize: "250% 100%",
  animation: "stdShimmer 1.5s ease-in-out infinite",
  "@keyframes stdShimmer": { from: { backgroundPosition: "100% 0" }, to: { backgroundPosition: "-50% 0" } },
  ...still,
} as const;

export type PartState = "written" | "empty" | "picture" | "working";

/** ● written · ○ empty · ▣ picture missing · a breathing pink dot while it is being written. */
export function StateMark({ state }: { state: PartState }) {
  const tip = state === "written" ? "Written" : state === "empty" ? "Empty" : state === "picture" ? "Picture missing" : "Being written";
  return (
    <Tooltip title={tip} enterDelay={500}>
      <Box sx={{ width: 14, height: 14, display: "grid", placeItems: "center", flexShrink: 0 }}>
        {state === "written" && <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#1b7a55" }} />}
        {state === "empty" && <Box sx={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px solid ${MUTED}`, boxSizing: "border-box" }} />}
        {state === "picture" && <Box sx={{ width: 9, height: 9, borderRadius: "2px", border: "1.5px dashed #b7791f", boxSizing: "border-box" }} />}
        {state === "working" && <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: PINK, animation: "stdBreathe 1.2s ease-in-out infinite", "@keyframes stdBreathe": { "0%,100%": { opacity: 0.35, transform: "scale(.8)" }, "50%": { opacity: 1, transform: "scale(1.15)" } }, ...still }} />}
      </Box>
    </Tooltip>
  );
}

/**
 * A part of the thing in the map. A click opens it (and the studio selects it in the middle); its fields come as
 * children, under the row, only while it is open.
 */
export function MapRow({ state, name, line, open, onClick, children, thumb, actions, depth = 0, dim, rowRef }: {
  state: PartState; name: string; line?: string; open: boolean; onClick: () => void; children?: React.ReactNode;
  /** a small picture before the name (a page's thumbnail) */
  thumb?: React.ReactNode;
  /** small buttons shown on hover, at the right */
  actions?: React.ReactNode;
  depth?: number; dim?: boolean;
  rowRef?: React.Ref<HTMLDivElement>;
}) {
  const working = state === "working";
  return (
    <Box ref={rowRef} sx={{ borderRadius: "8px", bgcolor: open ? "rgba(194,44,110,.045)" : "transparent", boxShadow: open ? "inset 0 0 0 1px rgba(194,44,110,.22)" : "none", transition: "background-color .15s, box-shadow .15s", mb: 0.25 }}>
      <Box role="button" tabIndex={0} aria-expanded={open} onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
        sx={{
          display: "flex", alignItems: "center", gap: 1, pl: 1 + depth * 1.75, pr: 0.75, py: 0.75, minHeight: 40, borderRadius: "8px", cursor: "pointer",
          opacity: dim ? 0.5 : 1, outline: "none", ...(working ? shimmerSx : {}),
          "&:hover": { bgcolor: open ? undefined : "#f3f4f6" }, "&:hover .std-acts": { opacity: 1 }, "&:focus-visible": { boxShadow: "inset 0 0 0 2px #2459d1" },
        }}>
        <StateMark state={state} />
        {thumb}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 650, color: INK, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</Typography>
          {line && <Typography sx={{ fontSize: "0.75rem", color: MUTED, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{line}</Typography>}
        </Box>
        {actions && <Box className="std-acts" onClick={(e) => e.stopPropagation()} sx={{ display: "flex", opacity: 0, transition: "opacity .12s" }}>{actions}</Box>}
        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: MUTED, flexShrink: 0, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .18s" }} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateRows: open && children ? "1fr" : "0fr", transition: "grid-template-rows .22s cubic-bezier(.2,.8,.2,1)" }}>
        <Box sx={{ overflow: "hidden", minHeight: 0 }}>
          {open && children ? <Box sx={{ px: 1, pb: 1, pl: 1 + depth * 1.75 }}>{children}</Box> : null}
        </Box>
      </Box>
    </Box>
  );
}

/** "← Build" at the top of a view that opened in the left pane. */
export function BackRow({ label, onClick, right }: { label: string; onClick: () => void; right?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, height: 44, flexShrink: 0, borderBottom: `1px solid ${LINE}` }}>
      <Box component="button" type="button" onClick={onClick} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.6, px: 0.75, py: 0.5, borderRadius: "6px", fontSize: "0.82rem", fontWeight: 700, color: INK, "&:hover": { bgcolor: "#f3f4f6" }, "&:focus-visible": { outline: "2px solid #2459d1" } }}>
        <ArrowBackIcon sx={{ fontSize: 17 }} />{label}
      </Box>
      <Box sx={{ flex: 1 }} />
      {right}
    </Box>
  );
}

/** The foot of the left pane: the last step, always in reach. */
export function LastStep({ name, sub, onClick, active }: { name: string; sub?: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <Box component="button" type="button" onClick={onClick} sx={{
      all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1.25, width: "100%", px: 1.5, py: 1.1, borderRadius: "8px",
      bgcolor: active ? "rgba(194,44,110,.08)" : "#fff", border: `1px solid ${active ? "rgba(194,44,110,.35)" : LINE}`, transition: "border-color .12s, background-color .12s",
      "&:hover": { borderColor: "rgba(194,44,110,.45)" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 },
    }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: PINK, lineHeight: 1.3 }}>Last step · {name}</Typography>
        {sub && <Typography component="div" sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</Typography>}
      </Box>
      <ChevronRightIcon sx={{ fontSize: 20, color: PINK }} />
    </Box>
  );
}

/* ── the picture slot ───────────────────────────────────────────────────────────────────────────────────────────── */

export type SlotActions = {
  onMake: () => void;
  onUpload: (file: File) => void;
  onGallery: () => void;
  onRemove: () => void;
};

/** A hidden file input and the function that opens it. */
function useFilePick(onFile: (f: File) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = <input ref={ref} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />;
  return { open: () => ref.current?.click(), input };
}

const actBtn = (dark?: boolean) => ({
  all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.8, py: 0.45, borderRadius: "6px", fontSize: "0.76rem", fontWeight: 650, whiteSpace: "nowrap",
  color: dark ? "#fff" : INK, "&:hover": { bgcolor: dark ? "rgba(255,255,255,.14)" : "#f3f4f6" }, "&:focus-visible": { outline: "2px solid #2459d1" }, "& svg": { fontSize: 15 },
}) as const;

/** The four actions on a picture that is there: Make another · Upload · Gallery · Remove. `dark` = on the canvas. */
export function PictureActions({ onMake, onUpload, onGallery, onRemove, dark, canMake = true }: SlotActions & { dark?: boolean; canMake?: boolean }) {
  const pick = useFilePick(onUpload);
  return (
    <Box sx={dark ? { display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 0.25 } : { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.25, "& > button": { justifyContent: "flex-start" } }}>
      {canMake && <Box component="button" type="button" onClick={onMake} sx={actBtn(dark)}><RefreshIcon />Make another</Box>}
      <Box component="button" type="button" onClick={pick.open} sx={actBtn(dark)}><FileUploadOutlinedIcon />Upload</Box>
      <Box component="button" type="button" onClick={onGallery} sx={actBtn(dark)}><PhotoLibraryOutlinedIcon />Gallery</Box>
      <Box component="button" type="button" onClick={onRemove} sx={{ ...actBtn(dark), color: dark ? "#ffd2cc" : "#b42318" }}><DeleteOutlineIcon />Remove</Box>
      {pick.input}
    </Box>
  );
}

/** "Make it" (pink) and "Upload" - what an empty slot offers. */
export function EmptyActions({ onMake, onUpload, onGallery, canMake = true, compact }: Omit<SlotActions, "onRemove"> & { canMake?: boolean; compact?: boolean }) {
  const pick = useFilePick(onUpload);
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 0.75 }}>
      {canMake && (
        <Box component="button" type="button" onClick={onMake} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, px: compact ? 1 : 1.25, height: compact ? 28 : 32, borderRadius: "6px", bgcolor: PINK, color: "#fff", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap", boxShadow: "0 2px 8px -3px rgba(194,44,110,.6)", "&:hover": { bgcolor: "#a3245c" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 }, "& svg": { fontSize: 16 } }}>
          <AutoAwesomeOutlinedIcon />Make it
        </Box>
      )}
      <Box component="button" type="button" onClick={pick.open} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, px: compact ? 1 : 1.25, height: compact ? 28 : 32, borderRadius: "6px", bgcolor: "#fff", color: INK, border: `1px solid rgba(17,24,39,.16)`, boxSizing: "border-box", fontSize: "0.8rem", fontWeight: 650, whiteSpace: "nowrap", "&:hover": { borderColor: "rgba(17,24,39,.3)" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 }, "& svg": { fontSize: 16 } }}>
        <FileUploadOutlinedIcon />Upload
      </Box>
      {!compact && (
        <Box component="button" type="button" onClick={onGallery} sx={{ ...actBtn(), color: MUTED }}><PhotoLibraryOutlinedIcon />Gallery</Box>
      )}
      {pick.input}
    </Box>
  );
}

/** The frame while the picture is being made: shimmer, a running line, the words and the clock. */
export function MakingFrame({ label = "Making the picture…", height = 112, note }: { label?: string; height?: number; note?: string }) {
  const clock = useClock(true);
  return (
    <Box role="status" aria-live="polite" sx={{ position: "relative", height, borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(194,44,110,.3)", display: "grid", placeItems: "center", ...shimmerSx }}>
      <Box sx={{ textAlign: "center", px: 1.5 }}>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: PINK }}>{label} <Box component="span" sx={{ color: MUTED, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{clock}</Box></Typography>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.25 }}>{note ?? "A picture takes 10 to 40 seconds."}</Typography>
      </Box>
      <LinearProgress sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />
    </Box>
  );
}

/**
 * ONE picture slot (flow standard §3), as a card in the left pane. Empty: the dashed frame with the picture's idea (the
 * person may change it) and Make it / Upload. Making: the frame shimmers. Filled: the picture and its four actions.
 */
export function PictureSlot({ url, idea, onIdea, making, error, canEdit = true, canMake = true, height = 112, circle, ...acts }: SlotActions & {
  url: string | null; idea: string; onIdea?: (v: string) => void; making: boolean; error?: string | null; canEdit?: boolean; canMake?: boolean; height?: number; circle?: boolean;
}) {
  if (making) return <MakingFrame height={height} />;
  if (url) {
    return (
      <Box>
        <Box sx={{ height, borderRadius: circle ? "50%" : "8px", width: circle ? height : "100%", mx: circle ? "auto" : 0, overflow: "hidden", bgcolor: "#f3f4f6", border: `1px solid ${LINE}` }}>
          <Box component="img" src={url} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </Box>
        {canEdit && <Box sx={{ mt: 0.5 }}><PictureActions {...acts} canMake={canMake} /></Box>}
        {error && <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: "#b42318" }}>{error}</Typography>}
      </Box>
    );
  }
  return (
    <Box>
      <Box sx={{ minHeight: height, boxSizing: "border-box", borderRadius: "8px", border: "1.5px dashed rgba(17,24,39,.22)", bgcolor: "#fafbfc", p: 1.25, display: "flex", flexDirection: "column", justifyContent: "center", gap: 1 }}>
        {onIdea && canEdit ? (
          <Box component="textarea" rows={2} value={idea} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onIdea(e.target.value)} aria-label="The picture's idea"
            placeholder="What the picture shows…"
            sx={{ all: "unset", boxSizing: "border-box", width: "100%", resize: "none", fontSize: "0.78rem", lineHeight: 1.4, color: MUTED, textAlign: "center", "&:focus": { color: INK }, "&::placeholder": { color: MUTED } }} />
        ) : (
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, textAlign: "center", lineHeight: 1.4 }}>{idea || "No picture yet."}</Typography>
        )}
        {canEdit && <EmptyActions {...acts} canMake={canMake} />}
      </Box>
      {error && <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: "#b42318" }}>{error}</Typography>}
    </Box>
  );
}

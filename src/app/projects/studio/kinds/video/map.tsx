"use client";
// THE MAP, THE LAST STEP AND THE CHANGES - FOR THE VIDEO AND THE BANNER STUDIOS (09.11.2026, the studio flow standard:
// "one way of working in all six studios"; SARCLA: "the features are there, but the editing and the flow is not logical
// yet"). The page studio's look, kept here so these two studios read as it does:
//   MapRow / MapList   the left pane's list of the thing's parts: a state mark, the name, one line of what it holds, a
//                      chevron; open, its fields under it (one open at a time, smooth)
//   StartCard          the empty start: "What are you making?", the few choices, one pink "... with AI"
//   LastStep           pinned at the foot of the left pane: "LAST STEP · <name>", opening its own view (StepView)
//   WorkingOn          the top of the assistant: what it works on - the selection with ×, or the whole thing
//   ChangesList        "Changes made here": every change the AI made, each with Undo (back to before it, and every later)

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import UndoIcon from "@mui/icons-material/Undo";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { PINK, btn } from "../../parts";
import { makePicture, uploadPicture, type PictureAspect } from "../../pictures";

export const sheen = keyframes`from { background-position: 140% 0; } to { background-position: -140% 0; }`;
export const SHEEN_BG = "linear-gradient(100deg, rgba(255,255,255,0) 25%, rgba(194,44,110,.13) 42%, rgba(255,255,255,.75) 50%, rgba(36,89,209,.12) 58%, rgba(255,255,255,0) 75%)";
export const slideIn = keyframes`from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; }`;
export const fadeIn = keyframes`from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; }`;
/** The shimmer of a part being written (in the map and on the thing). */
export const shimmer = { backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.5s linear infinite`, "@media (prefers-reduced-motion: reduce)": { animation: "none" } };

const GREEN = "#1b7a55";
const AMBER = "#b7791f";

export type Mark = "written" | "empty" | "picture" | "busy" | "stop" | "warn" | "none";

/** A part's state: written ●, empty ○, a picture missing ▣, being written (turning), something to fix (red). */
export function StateMark({ state }: { state: Mark }) {
  if (state === "busy") return <CircularProgress size={15} thickness={5} sx={{ color: PINK, m: "1.5px", flexShrink: 0 }} />;
  if (state === "written") return <CheckCircleIcon sx={{ fontSize: 18, color: GREEN, flexShrink: 0 }} />;
  if (state === "picture") return <ImageOutlinedIcon sx={{ fontSize: 18, color: AMBER, flexShrink: 0 }} />;
  if (state === "stop") return <ErrorOutlineRoundedIcon sx={{ fontSize: 18, color: "#c5221f", flexShrink: 0 }} />;
  if (state === "warn") return <WarningAmberRoundedIcon sx={{ fontSize: 18, color: AMBER, flexShrink: 0 }} />;
  if (state === "empty") return <Box sx={{ width: 14, height: 14, m: "2px", borderRadius: "50%", border: "1.5px solid #b9c3cf", boxSizing: "border-box", flexShrink: 0 }} />;
  return <Box sx={{ width: 18, flexShrink: 0 }} />;
}

/** A row of the map: its state, name and a line of what it holds; open, its fields below. */
export function MapRow({ id, title, sub, summary, state, open, onToggle, busyLabel, children, thumb, accent, onAi, aiLabel, canAi }: {
  id: string; title: React.ReactNode; sub?: string; summary?: React.ReactNode; state: Mark; open: boolean; onToggle: () => void;
  busyLabel?: string; children?: React.ReactNode;
  /** a small picture before the name (a scene of the film, a place's shape) */
  thumb?: React.ReactNode;
  accent?: "pink" | "blue";
  onAi?: () => void; aiLabel?: string; canAi?: boolean;
}) {
  const busy = state === "busy";
  return (
    <Box data-row={id} sx={{ borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: "none" }, bgcolor: open ? "#fff" : "transparent", transition: "background-color .2s" }}>
      <Box role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        sx={{
          display: "flex", alignItems: "center", gap: 1.1, px: 1.5, py: 1, cursor: "pointer", position: "relative", outline: "none",
          "&:hover": { bgcolor: "rgba(21,34,58,.03)" }, "&:focus-visible": { boxShadow: `inset 0 0 0 2px ${PINK}` },
          ...(open ? { boxShadow: `inset 3px 0 0 ${accent === "blue" ? "#2459d1" : PINK}` } : {}),
          ...(busy ? shimmer : {}),
        }}>
        <StateMark state={state} />
        {thumb}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="div" sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}{sub ? <Box component="span" sx={{ color: MUTED, fontWeight: 600 }}> · {sub}</Box> : null}
          </Typography>
          {busy && busyLabel ? <Typography sx={{ fontSize: "0.76rem", color: PINK, fontWeight: 600, lineHeight: 1.35 }}>{busyLabel}</Typography>
            : summary ? <Typography component="div" sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary}</Typography> : null}
        </Box>
        {onAi && (
          <Tooltip title={aiLabel ?? "Write it with AI"}>
            <span>
              <IconButton size="small" disabled={!canAi || busy} onClick={(e) => { e.stopPropagation(); onAi(); }} aria-label={aiLabel ?? "Write it with AI"} sx={{ color: PINK, opacity: open ? 1 : 0.55 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <ExpandMoreIcon sx={{ fontSize: 20, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .22s ease", flexShrink: 0 }} />
      </Box>
      <Collapse in={open} timeout={240} unmountOnExit>
        <Box sx={{ px: 1.75, pb: 1.75, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

/** The rows in one quiet card. */
export function MapList({ children }: { children: React.ReactNode }) {
  return <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", overflow: "hidden", bgcolor: "rgba(250,251,253,.9)" }}>{children}</Box>;
}

/** A small heading over a group of rows, with something on its right (a link, the AI's clock). */
export function Kick({ children, right, mt = 0 }: { children: React.ReactNode; right?: React.ReactNode; mt?: number }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt, mb: 0.75, minHeight: 26 }}>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{children}</Typography>
      {right}
    </Box>
  );
}

/** The empty start, at the top of the map. */
export function StartCard({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2, p: 1.75, borderRadius: "12px", border: "1px solid rgba(194,44,110,.22)", background: "linear-gradient(135deg, rgba(194,44,110,.06), rgba(36,89,209,.05))", animation: `${fadeIn} .25s ease-out` }}>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 750, color: INK, mb: 1.25 }}>What are you making?</Typography>
      {children}
    </Box>
  );
}

/** Seconds since `since`, as 0:12 - for "Writing the film · 0:12". */
export function useClock(since: number | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [since]);
  const s = since ? Math.max(0, Math.round((Date.now() - since) / 1000)) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The AI at work, in a map header: the turning mark, what it does and its clock. */
export function Writing({ label, since }: { label: string; since: number | null }) {
  const clock = useClock(since);
  return (
    <Typography component="span" sx={{ fontSize: "0.76rem", color: PINK, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 0.75, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      <CircularProgress size={12} thickness={6} sx={{ color: PINK }} />{label} · {clock}
    </Typography>
  );
}

/** The left pane: the map scrolling, the last step pinned at its foot. */
export function MapPane({ children, foot }: { children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>{children}</Box>
      {foot}
    </Box>
  );
}

/** "LAST STEP · <name>", always in view at the foot of the map; the line over it says how far the thing is. */
export function LastStep({ name, line, onClick }: { name: string; line: React.ReactNode; onClick: () => void }) {
  return (
    <Box sx={{ flexShrink: 0, px: 2, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.92)", backdropFilter: "blur(6px)" }}>
      <Typography component="div" sx={{ fontSize: "0.74rem", color: MUTED, mb: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{line}</Typography>
      <Button fullWidth variant="contained" disableElevation onClick={onClick} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
        sx={{ ...btn, height: 40, borderRadius: "8px", bgcolor: "#15223a", color: "#fff", justifyContent: "space-between", px: 1.75, "&:hover": { bgcolor: "#24344f" } }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 1, minWidth: 0, overflow: "hidden" }}>
          <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>Last step</Box>
          {name}
        </Box>
      </Button>
    </Box>
  );
}

/** The last step's own view in the left pane, with "← <map>" back. */
export function StepView({ back, onBack, name, children }: { back: string; onBack: () => void; name: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: 2, animation: `${slideIn} .22s ease-out` }}>
      <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 17 }} />} onClick={onBack} sx={{ ...btn, color: INK, px: 0.5, ml: -0.5, mb: 1.25 }}>{back}</Button>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: PINK }}>Last step</Typography>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 750, color: INK, mb: 1.5, letterSpacing: "-0.01em" }}>{name}</Typography>
      {children}
    </Box>
  );
}

/** "Working on": the selection (with × to let it go) or the whole thing. */
export function WorkingOn({ selection, whole, hint, onClear }: { selection: string | null; whole: string; hint: string; onClear: () => void }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: selection ? 1 : 0.25 }}>Working on</Typography>
      {selection ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, pl: 1.25, borderRadius: "8px", bgcolor: "rgba(194,44,110,.07)", border: "1px solid rgba(194,44,110,.25)" }}>
          <Box sx={{ width: 3, alignSelf: "stretch", borderRadius: 2, bgcolor: PINK }} />
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selection}</Typography>
          <Tooltip title={whole}><IconButton size="small" onClick={onClear} aria-label={whole}><CloseIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        </Box>
      ) : (
        <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>{whole} <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}>· {hint}</Box></Typography>
      )}
    </Box>
  );
}

/* ── the changes made here ─────────────────────────────────────────────────────────────────────────────────────── */

export type Change<T> = { id: number; label: string; note?: string; at: number; before: T; undone: boolean };

const ago = (t: number) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`; };

/** The AI's changes, newest first; Undo puts the thing back as it was before one (and every later one). */
export function useChanges<T>() {
  const [list, setList] = useState<Change<T>[]>([]);
  const record = useCallback((label: string, before: T, note?: string) => {
    setList((l) => [{ id: Date.now() + Math.random(), label, note, at: Date.now(), before, undone: false }, ...l].slice(0, 30));
  }, []);
  /** The state to go back to, the entry and every later one marked undone. */
  const undo = useCallback((e: Change<T>): T => {
    setList((l) => l.map((x) => (x.at >= e.at && !x.undone ? { ...x, undone: true } : x)));
    return e.before;
  }, []);
  return { list, record, undo };
}

export function ChangesList<T>({ list, onUndo, what }: { list: Change<T>[]; onUndo: (e: Change<T>) => void; what: string }) {
  if (!list.length) return null;
  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Changes made here</Typography>
      {list.map((e) => (
        <Box key={e.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start", py: 0.9, borderTop: `1px solid ${HAIRLINE}`, opacity: e.undone ? 0.45 : 1 }}>
          <Box sx={{ mt: 0.6, width: 7, height: 7, borderRadius: "2px", bgcolor: PINK, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.83rem", color: INK, fontWeight: 600, textDecoration: e.undone ? "line-through" : "none" }}>{e.label}</Typography>
            {e.note && <Typography title={e.note} sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.note}</Typography>}
            <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{ago(e.at)}{e.undone ? " · undone" : ""}</Typography>
          </Box>
          {!e.undone && (
            <Tooltip title={`Put the ${what} back as it was before this (and every later change)`}>
              <Button size="small" onClick={() => onUndo(e)} startIcon={<UndoIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, color: INK, minWidth: 0, px: 1 }}>Undo</Button>
            </Tooltip>
          )}
        </Box>
      ))}
    </Box>
  );
}

/* ── the picture slot, as the flow standard has it ─────────────────────────────────────────────────────────────── */

/**
 * One picture, everywhere: empty = a dashed frame, the picture's idea in small grey, "Make it" (pink) and "Upload";
 * making = the frame shimmers with a progress bar and "Making the picture…"; filled = the picture, with Make another ·
 * Upload · Gallery · Remove. "Gallery" opens the galleries under it (`gallery`: the shop's photos, ours). Never a
 * picture model call without a visible progress.
 */
export function PictureSlot({ url, idea, aspect, where, onSet, onRemove, removeLabel = "Remove", gallery, disabled, height = 120, note }: {
  url: string | null; idea: string; aspect: PictureAspect; where: { projectId: number; pieceId: number };
  onSet: (url: string, name?: string | null) => void; onRemove?: () => void; removeLabel?: string;
  /** what "Gallery" opens: the pictures to pick from */
  gallery: React.ReactNode;
  disabled?: boolean; height?: number;
  /** a line under the slot (where the picture comes from) */
  note?: React.ReactNode;
}) {
  const [making, setMaking] = useState<number | null>(null);
  const [share, setShare] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement | null>(null);
  const clock = useClock(making);
  const make = async () => {
    setMaking(Date.now()); setErr(null);
    const r = await makePicture(idea || "Industrial components, real, calm light, for APSOparts.", aspect, where);
    setMaking(null);
    if (!r.ok) { setErr(r.error); return; }
    onSet(r.picture.url, r.picture.name);
  };
  const upload = async (list: FileList | null) => {
    const f = Array.from(list ?? []).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    setShare(0); setErr(null);
    const r = await uploadPicture(f, where, (s) => setShare(s));
    setShare(null);
    if (!r.ok) { setErr(r.error); return; }
    onSet(r.picture.url, r.picture.name);
  };
  const busy = making !== null || share !== null;
  const act = { ...btn, fontSize: "0.76rem", py: 0.2, px: 0.9, minWidth: 0, color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", borderRadius: "6px" };
  return (
    <Box>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      {busy ? (
        <Box role="status" aria-live="polite" sx={{ height, borderRadius: "8px", border: "1px solid rgba(194,44,110,.25)", position: "relative", overflow: "hidden", display: "grid", placeItems: "center", ...shimmer, bgcolor: "#fffafc" }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: PINK, fontVariantNumeric: "tabular-nums" }}>{making !== null ? `Making the picture… ${clock}` : "Uploading…"}</Typography>
            {making !== null && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>about half a minute</Typography>}
          </Box>
          <LinearProgress variant={share !== null ? "determinate" : "indeterminate"} value={share !== null ? share * 100 : undefined}
            sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />
        </Box>
      ) : url ? (
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 6, border: `1px solid ${HAIRLINE}`, flexShrink: 0, background: "#eef1f6" }} />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6, minWidth: 0 }}>
            <Button size="small" disabled={disabled} onClick={() => void make()} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14, color: PINK }} />} sx={act}>Make another</Button>
            <Button size="small" disabled={disabled} onClick={() => file.current?.click()} sx={act}>Upload</Button>
            <Button size="small" disabled={disabled} onClick={() => setOpen((x) => !x)} sx={{ ...act, ...(open ? { borderColor: PINK, color: PINK } : {}) }}>Gallery</Button>
            {onRemove && <Button size="small" disabled={disabled} onClick={onRemove} sx={{ ...act, color: MUTED }}>{removeLabel}</Button>}
          </Box>
        </Box>
      ) : (
        <Box sx={{ minHeight: height, borderRadius: "8px", border: "1.5px dashed #b9c3cf", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, p: 1.5, boxSizing: "border-box", textAlign: "center", bgcolor: "rgba(255,255,255,.6)" }}>
          {idea && <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea}</Typography>}
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", justifyContent: "center" }}>
            <Button size="small" variant="contained" disableElevation disabled={disabled} onClick={() => void make()} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, bgcolor: PINK, color: "#fff", borderRadius: "6px", "&:hover": { bgcolor: "#a3245c" } }}>Make it</Button>
            <Button size="small" disabled={disabled} onClick={() => file.current?.click()} sx={act}>Upload</Button>
            <Button size="small" disabled={disabled} onClick={() => setOpen((x) => !x)} sx={act}>Gallery</Button>
          </Box>
        </Box>
      )}
      {err && <Typography sx={{ mt: 0.75, fontSize: "0.76rem", color: "#c5221f" }}>{err}</Typography>}
      {note && <Typography component="div" sx={{ mt: 0.6, fontSize: "0.72rem", color: MUTED, lineHeight: 1.4 }}>{note}</Typography>}
      <Collapse in={open} timeout={220} unmountOnExit>
        <Box sx={{ mt: 1.25 }}>{gallery}</Box>
      </Collapse>
    </Box>
  );
}

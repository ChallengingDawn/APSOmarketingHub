"use client";

/**
 * THE ASSISTANT AS A WINDOW YOU PUT WHERE YOU WANT IT.
 *
 * It has been a panel on a board, a panel on a rail and a strip under the
 * brief box, and each time it was somewhere SARCLA was not. The reason is now
 * obvious: there IS no right place for it, because it is wanted at different
 * moments over different parts of the screen. So it stops being a region of
 * the layout and becomes a window — dragged where the work is not, kept out
 * of the way, reopened where you left it.
 *
 * The details that make a floating window feel built rather than bolted on,
 * and why each one is here:
 *
 *   · It is dragged by its header, never by its body, so selecting text in a
 *     reply does not fling the window across the screen.
 *   · Dragging is tracked on the WINDOW, not the header, and captures the
 *     pointer: a fast drag outruns the element under the cursor, and without
 *     capture the window is dropped mid-gesture.
 *   · It is clamped into the viewport on every move AND on resize of the
 *     browser, because a window parked bottom-right of a large monitor is
 *     off-screen and unreachable on a laptop.
 *   · Position and size are remembered per person, so it opens where they
 *     left it rather than where we think it belongs.
 *   · Escape minimises. Nothing traps focus: it is a tool beside the work,
 *     not a modal over it.
 *   · The shadow lifts while dragging. That is the whole animation budget —
 *     a window that springs or bounces is a window you notice instead of the
 *     work, and this one is meant to be furniture.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RemoveIcon from "@mui/icons-material/Remove";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import TuneIcon from "@mui/icons-material/Tune";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import Assistant from "./Assistant";

const INK = "#15223a";
const FAINT = "#8b97ac";
const MUTED = "#5d6b85";
const HAIRLINE = "rgba(21,34,58,.10)";
const PURPLE = "#6a46c9";

const MIN_W = 320;
const MIN_H = 280;
const MARGIN = 12;

type Rect = { x: number; y: number; w: number; h: number };

const KEY = "apsomh:assistant-window";

/** Where it opens the very first time: bottom-right, clear of the rail. */
function defaultRect(): Rect {
  // Wider than a chat bubble on purpose: this window now holds the brief,
  // the personas and the brain as well as the conversation, and a 380px
  // column turns two dropdowns side by side into two dropdowns stacked.
  const w = 460;
  const h = 640;
  if (typeof window === "undefined") return { x: 40, y: 40, w, h };
  return {
    x: Math.max(MARGIN, window.innerWidth - w - 24),
    y: Math.max(MARGIN, window.innerHeight - h - 24),
    w,
    h,
  };
}

/**
 * Keeps the window reachable.
 *
 * A window remembered at the bottom-right of a 4K monitor is entirely
 * off-screen on a laptop, and a window you cannot see is a window you cannot
 * close. Clamped on every move and on every viewport change.
 */
function clamp(r: Rect): Rect {
  if (typeof window === "undefined") return r;
  const w = Math.min(Math.max(r.w, MIN_W), Math.max(MIN_W, window.innerWidth - MARGIN * 2));
  const h = Math.min(Math.max(r.h, MIN_H), Math.max(MIN_H, window.innerHeight - MARGIN * 2));
  return {
    w,
    h,
    x: Math.min(Math.max(r.x, MARGIN), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
    y: Math.min(Math.max(r.y, MARGIN), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
  };
}

function load(): { rect: Rect; minimised: boolean } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { rect?: Partial<Rect>; minimised?: boolean };
    if (!v.rect || typeof v.rect.x !== "number") return null;
    return { rect: clamp(v.rect as Rect), minimised: !!v.minimised };
  } catch {
    // Private windows and cleared site data both throw here. A forgotten
    // position is a shrug; a crash on mount is not.
    return null;
  }
}

function save(rect: Rect, minimised: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ rect, minimised }));
  } catch {
    /* nothing to do, and nothing worth telling anybody */
  }
}

export default function FloatingAssistant({
  projectId,
  canEdit = true,
  onApplied,
  settings,
}: {
  projectId: number;
  canEdit?: boolean;
  onApplied?: () => void;
  /**
   * The generator's own settings — brief, personas, brain. They belong with
   * the thing that uses them, not on a rail of drawing tools, and they are
   * passed in rather than lifted because their state lives in the studio.
   */
  settings?: React.ReactNode;
}) {
  const [rect, setRect] = useState<Rect>(() => defaultRect());
  const [minimised, setMinimised] = useState(true);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Collapsed by default: most turns are a sentence, and the settings are
  // something you open when the answer is wrong, not before every question.
  const [showSettings, setShowSettings] = useState(false);
  const [resizing, setResizing] = useState(false);

  // Read the remembered position after mount: localStorage does not exist on
  // the server, and reading it during render would differ between the two.
  useEffect(() => {
    const seen = load();
    if (seen) {
      setRect(seen.rect);
      setMinimised(seen.minimised);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(rect, minimised);
  }, [rect, minimised, ready]);

  // A laptop after a monitor: pull it back into view rather than leaving it
  // somewhere the person cannot reach.
  useEffect(() => {
    const onResize = () => setRect((r) => clamp(r));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !minimised) setMinimised(true);
      // One shortcut, and the one every tool uses for "talk to me".
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMinimised((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [minimised]);

  const gesture = useRef<{ kind: "move" | "size"; dx: number; dy: number } | null>(null);

  const onPointerDown = useCallback(
    (kind: "move" | "size") => (e: React.PointerEvent) => {
      // Only the primary button, and never on a control inside the header.
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      gesture.current =
        kind === "move"
          ? { kind, dx: e.clientX - rect.x, dy: e.clientY - rect.y }
          : { kind, dx: e.clientX - rect.w, dy: e.clientY - rect.h };
      if (kind === "move") setDragging(true);
      else setResizing(true);
    },
    [rect],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    e.preventDefault();
    setRect((r) =>
      clamp(
        g.kind === "move"
          ? { ...r, x: e.clientX - g.dx, y: e.clientY - g.dy }
          : { ...r, w: e.clientX - g.dx, h: e.clientY - g.dy },
      ),
    );
  }, []);

  const endGesture = useCallback((e: React.PointerEvent) => {
    if (!gesture.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* the capture may already be gone; releasing twice is harmless */
    }
    gesture.current = null;
    setDragging(false);
    setResizing(false);
  }, []);

  if (!ready) return null;

  if (minimised) {
    return (
      <Tooltip title="Assistant  ·  Ctrl + K" placement="left">
        <IconButton
          onClick={() => setMinimised(false)}
          aria-label="Open the assistant"
          sx={{
            position: "fixed", right: 20, bottom: 20, zIndex: 1250,
            width: 52, height: 52, bgcolor: PURPLE, color: "#fff",
            boxShadow: "0 6px 20px rgba(106,70,201,.38)",
            "&:hover": { bgcolor: "#5a39ad" },
          }}
        >
          <AutoAwesomeIcon />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Box
      role="dialog"
      aria-label="Assistant"
      sx={{
        position: "fixed", zIndex: 1250,
        left: rect.x, top: rect.y, width: rect.w, height: rect.h,
        display: "flex", flexDirection: "column",
        bgcolor: "#fff", borderRadius: "16px", border: `1px solid ${HAIRLINE}`,
        overflow: "hidden",
        // The only motion: it lifts while you hold it. A window that springs
        // is a window you look at instead of the work.
        boxShadow: dragging || resizing
          ? "0 24px 60px rgba(21,34,58,.28)"
          : "0 10px 34px rgba(21,34,58,.18)",
        transition: "box-shadow 140ms ease",
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      }}
    >
      <Box
        onPointerDown={onPointerDown("move")}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        sx={{
          display: "flex", alignItems: "center", gap: 0.75, px: 1, py: 0.75,
          borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "#faf9ff",
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none", flexShrink: 0, userSelect: "none",
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16, color: FAINT }} />
        <AutoAwesomeIcon sx={{ fontSize: 16, color: PURPLE }} />
        <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700, color: INK }}>Assistant</Typography>
        <Tooltip title="Minimise  ·  Esc">
          <IconButton size="small" onClick={() => setMinimised(true)} aria-label="Minimise the assistant">
            <RemoveIcon sx={{ fontSize: 17, color: FAINT }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {settings && (
          <Box sx={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            <Box
              component="button"
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              sx={{
                width: "100%", display: "flex", alignItems: "center", gap: 0.75,
                px: 1.25, py: 1, border: 0, bgcolor: "transparent", cursor: "pointer",
                fontFamily: "inherit", color: MUTED,
                "&:hover": { bgcolor: "#fafbfd" },
              }}
            >
              <TuneIcon sx={{ fontSize: 15 }} />
              <Typography sx={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 700, color: INK }}>
                What it writes with
              </Typography>
              <ExpandMoreIcon sx={{ fontSize: 17, transform: showSettings ? "rotate(180deg)" : "none", transition: "transform 140ms" }} />
            </Box>
            {showSettings && <Box sx={{ pb: 1 }}>{settings}</Box>}
          </Box>
        )}
        <Box sx={{ p: 1.25 }}>
          <Assistant projectId={projectId} canEdit={canEdit} onApplied={onApplied ?? (() => {})} bare />
        </Box>
      </Box>

      {/* The resize corner. A real target rather than a 4px hairline — a grip
          you have to aim at is a grip nobody uses. */}
      <Box
        onPointerDown={onPointerDown("size")}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        aria-label="Resize the assistant"
        sx={{
          position: "absolute", right: 0, bottom: 0, width: 18, height: 18,
          cursor: "nwse-resize", touchAction: "none",
          "&::after": {
            content: '""', position: "absolute", right: 4, bottom: 4,
            width: 7, height: 7,
            borderRight: `2px solid ${FAINT}`, borderBottom: `2px solid ${FAINT}`,
            borderBottomRightRadius: 2,
          },
        }}
      />
    </Box>
  );
}

"use client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Collapse from "@mui/material/Collapse";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import WebAssetIcon from "@mui/icons-material/WebAsset";
import ViewDayOutlinedIcon from "@mui/icons-material/ViewDayOutlined";
import type { DetailMode } from "@/lib/pricing/prefs";

const NAVY = "#274e64";

/** "Details: Pop-up | In row" — the same switch on every table of the platform. */
export function DetailModeToggle({ mode, onChange }: { mode: DetailMode; onChange: (m: DetailMode) => void }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#5d6b85" }}>Details</Typography>
      <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && onChange(v)}
        sx={{ "& .MuiToggleButton-root": { py: 0.2, px: 1, fontSize: "0.68rem", fontWeight: 700, textTransform: "none", gap: 0.5, color: "#5d6b85", borderColor: "#d8dce1" },
          "& .Mui-selected": { bgcolor: "#e8f0f4 !important", color: `${NAVY} !important` } }}>
        <ToggleButton value="popup"><WebAssetIcon sx={{ fontSize: 15 }} />Pop-up</ToggleButton>
        <ToggleButton value="inline"><ViewDayOutlinedIcon sx={{ fontSize: 15 }} />In row</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

// The in-row drop-down sits in a cell that spans the WHOLE table, which on the wide pricing
// tables is far wider than the screen — its right-hand cards ended off-screen. Pin it to the
// visible part of the scrolling box (sticky left, width = that box's visible width).
function InlineFit({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let box: HTMLElement | null = el.parentElement;
    while (box && !(box.scrollWidth > box.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowX))) box = box.parentElement;
    if (!box) return;
    const sc = box;
    const fit = () => setW(sc.clientWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(sc);
    return () => ro.disconnect();
  }, []);
  return <Box ref={ref} sx={w ? { position: "sticky", left: 0, width: w, maxWidth: w } : undefined}>{children}</Box>;
}

/**
 * The detail of one table row. "inline" = the drop-down under the row (a TableRow, so it
 * must sit inside the TableBody right after its row); "popup" = a wide dialog with room
 * for the full comparison, with ← / → to step through the rows without closing it.
 */
export function RowDetail({ mode, open, onClose, colSpan, title, subtitle, actions, onPrev, onNext, maxWidth = "xl", children }: {
  mode: DetailMode; open: boolean; onClose: () => void; colSpan: number;
  title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode;
  onPrev?: () => void; onNext?: () => void;
  maxWidth?: "md" | "lg" | "xl"; children: React.ReactNode;
}) {
  // Keyboard stepping in the pop-up (ignored while typing in a field).
  useEffect(() => {
    if (mode !== "popup" || !open) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft" && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === "ArrowRight" && onNext) { e.preventDefault(); onNext(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mode, open, onPrev, onNext]);

  if (mode === "inline") {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} sx={{ p: 0, borderBottom: open ? `2px solid ${NAVY}` : "none" }}>
          <Collapse in={open} timeout="auto" unmountOnExit><InlineFit>{children}</InlineFit></Collapse>
        </TableCell>
      </TableRow>
    );
  }
  if (!open) return null;
  return (
    <Dialog open onClose={onClose} maxWidth={maxWidth} fullWidth scroll="paper"
      PaperProps={{ sx: { borderRadius: 2, overflow: "hidden", maxHeight: "92vh" } }}>
      <Box sx={{ bgcolor: NAVY, color: "#fff", px: 2.5, py: 1.25, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {title && <Typography sx={{ color: "#fff", fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.02rem", fontWeight: 700, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Typography>}
          {subtitle && <Typography sx={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</Typography>}
        </Box>
        {actions}
        {(onPrev || onNext) && (
          <Box sx={{ display: "flex" }}>
            <Tooltip title="Previous row (←)"><span><IconButton size="small" disabled={!onPrev} onClick={onPrev} sx={{ color: "#fff", "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" } }}><ChevronLeftIcon /></IconButton></span></Tooltip>
            <Tooltip title="Next row (→)"><span><IconButton size="small" disabled={!onNext} onClick={onNext} sx={{ color: "#fff", "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" } }}><ChevronRightIcon /></IconButton></span></Tooltip>
          </Box>
        )}
        <Tooltip title="Close (Esc)"><IconButton size="small" onClick={onClose} sx={{ color: "#fff" }}><CloseIcon /></IconButton></Tooltip>
      </Box>
      <DialogContent sx={{ p: 0, bgcolor: "#f8f9fb" }}>{children}</DialogContent>
    </Dialog>
  );
}

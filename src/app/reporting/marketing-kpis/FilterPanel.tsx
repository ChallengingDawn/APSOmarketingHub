"use client";
// THE FILTER WINDOW - a window of its own over the page, like the assistant's chat
// (SARCLA 13.10): it opens from the Filters button, closes with its cross, Escape or
// Done, and the charts behind it stay live. Shared by Who are our customers and Reach
// (SARCLA 18.10: "adapt the reach page to match who are our customers with the filter").

import { useEffect } from "react";
import { keyframes } from "@mui/system";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import TuneIcon from "@mui/icons-material/Tune";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { Badge, FAINT, HAIRLINE, INK, MUTED, TINT, type Tint } from "@/app/uc/report/ui";

const foldIn = keyframes`from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; }`;

export function FilterPanel({ id, open, onClose, subtitle, chips, onClearAll, children }: {
  id: string; open: boolean; onClose: () => void; subtitle: string; chips?: React.ReactNode; onClearAll?: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  return (
    <Box id={id} role="dialog" aria-modal="false" aria-label="Filters" aria-hidden={!open}
      sx={{
        position: "fixed", top: 16, right: 16, bottom: 16, width: { xs: "calc(100vw - 32px)", sm: 380 }, zIndex: 1300,
        display: "flex", flexDirection: "column", borderRadius: "22px", overflow: "hidden",
        bgcolor: "#fff", border: "1px solid rgba(21,34,58,.08)",
        boxShadow: "0 24px 60px rgba(21,34,58,.22), 0 4px 14px rgba(21,34,58,.08)",
        // it grows out of the top right, where its button is, and settles softly
        transformOrigin: "top right",
        transform: open ? "translate3d(0, 0, 0) scale(1)" : "translate3d(28px, -6px, 0) scale(.96)",
        opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden",
        transition: open
          ? "transform .42s cubic-bezier(.16, 1, .3, 1), opacity .24s ease, visibility 0s"
          : "transform .22s cubic-bezier(.4, 0, 1, 1), opacity .18s ease, visibility 0s linear .22s",
        "& .fold": { animation: open ? `${foldIn} .38s cubic-bezier(.16, 1, .3, 1) both` : "none" },
        "@media (prefers-reduced-motion: reduce)": { transition: "opacity .1s linear", transform: "none", "& .fold": { animation: "none" } },
      }}>
      {/* the header: what this is, how many choices, and the way out */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.25, py: 1.75, borderBottom: `1px solid ${HAIRLINE}`, background: "linear-gradient(180deg, #f6f8fc, #fff)" }}>
        <Badge icon={<TuneIcon />} tint="blue" size={34} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>Filters</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{subtitle}</Typography>
        </Box>
        {onClearAll && <Button size="small" onClick={onClearAll} sx={{ textTransform: "none", fontWeight: 700 }}>Clear all</Button>}
        <IconButton aria-label="Close the filters" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)", "&:hover": { bgcolor: "rgba(21,34,58,.1)" } }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {chips && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", px: 2.25, py: 1.25, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "#fbfcfe" }}>
          {chips}
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: "auto", px: 1.25, py: 1 }}>
        {children}
      </Box>

      <Box sx={{ px: 2.25, py: 1.5, borderTop: `1px solid ${HAIRLINE}`, display: "flex", gap: 1, alignItems: "center", bgcolor: "#fbfcfe" }}>
        <Typography sx={{ fontSize: "0.74rem", color: FAINT, flex: 1 }}>Filters apply at once; the charts behind stay live</Typography>
        <Button variant="contained" disableElevation onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>Done</Button>
      </Box>
    </Box>
  );
}

/** One fold of the filter window: its glyph, its name, what is chosen - and its content when open. */
export function FilterSection({ id, index, lit = false, title, icon, tint, open, onFlip, summary, chosen = false, children }: {
  id: string; index: number; lit?: boolean; title: string; icon: React.ReactNode; tint: Tint; open: boolean; onFlip: () => void; summary: string; chosen?: boolean; children: React.ReactNode;
}) {
  return (
    <Box id={id} className="fold" sx={{
      borderRadius: "14px", mb: 0.75, scrollMarginTop: 8, animationDelay: `${40 + index * 28}ms`,
      bgcolor: lit ? TINT[tint].bg : open ? "#f7f9fc" : "transparent", border: `1px solid ${lit ? TINT[tint].fg : open ? HAIRLINE : "transparent"}`,
      transition: "background-color .4s ease, border-color .4s ease",
    }}>
      <Box component="button" type="button" onClick={onFlip} aria-expanded={open}
        sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", border: 0, bgcolor: "transparent", font: "inherit", cursor: "pointer", textAlign: "left", px: 1, py: 0.9, borderRadius: "14px", "&:hover": { bgcolor: open ? "transparent" : "rgba(21,34,58,.04)" } }}>
        <Badge icon={icon} tint={tint} size={26} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: 1 }}>{title}</Typography>
        <Typography sx={{ fontSize: "0.76rem", fontWeight: chosen ? 700 : 500, color: chosen ? TINT[tint].fg : FAINT, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</Typography>
        <ExpandMoreIcon sx={{ fontSize: 20, color: FAINT, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.25, pb: 1.25 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

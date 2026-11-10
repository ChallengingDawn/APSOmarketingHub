"use client";
// THE PAGE'S OUTLINE ON THE LEFT (SARCLA 08.11.2026, evening: "The UX and the Build on the left: can we improve it to be
// more fluid, subdivided"). One short list of the page's parts - each with its state (written, empty, a picture missing,
// being written) and a line of what it says. A click opens that part alone (smoothly; the others close) and selects it in
// the preview, which scrolls to it; a click in the preview opens its part here. While the AI writes, the parts it works
// on shimmer here and in the page - the person sees it working the moment they click.
// Content v5 (SARCLA 09.11.2026: "each block should be a section", "add more elements by + next to sections"): a new
// page's map is its BLOCKS, one row each, numbered as on the page; a block with items opens into them (./Fields.tsx
// ItemRows); a "+" between two rows adds a block there (./AddBlock.tsx); rows move by dragging or up / down.
// Content v8: the page's blocks are ./BlockList.tsx; these rows are the page-level ones below it (search engines, the
// changes, store views, notes).

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { PartInfo } from "@/lib/content/studio/kinds/page/outline";
import { PINK } from "../../parts";
import { SHEEN_BG, sheen } from "./Fields";

export type RowState = PartInfo["state"] | "busy" | "none";

const GREEN = "#1b7a55";
const AMBER = "#b7791f";

export function StateIcon({ state }: { state: RowState }) {
  if (state === "busy") return <CircularProgress size={15} thickness={5} sx={{ color: PINK, m: "1.5px" }} />;
  if (state === "written") return <CheckCircleIcon sx={{ fontSize: 18, color: GREEN }} />;
  if (state === "picture") return <ImageOutlinedIcon sx={{ fontSize: 18, color: AMBER }} />;
  if (state === "partly") return <Box sx={{ width: 14, height: 14, m: "2px", borderRadius: "50%", border: `2px solid ${AMBER}`, background: `linear-gradient(90deg, ${AMBER} 50%, transparent 50%)`, boxSizing: "border-box" }} />;
  if (state === "empty") return <Box sx={{ width: 14, height: 14, m: "2px", borderRadius: "50%", border: "1.5px solid #b9c3cf", boxSizing: "border-box" }} />;
  return <Box sx={{ width: 18 }} />;
}

/** One row of the outline: its state, name and a line of what it says; open, its body below - one open at a time. */
export function Row({ id, title, count, summary, state, open, onToggle, onAi, aiLabel, canAi, busyLabel, children, accent, num, actions, handle, drop, dragProps }: {
  id: string; title: string; count?: number | null; summary?: React.ReactNode; state: RowState; open: boolean; onToggle: () => void;
  onAi?: () => void; aiLabel?: string; canAi?: boolean;
  /** shown in place of the summary while the AI works on it */
  busyLabel?: string;
  children?: React.ReactNode;
  /** a row that is not a part of the page (the element selected, the languages) */
  accent?: "pink" | "blue";
  /** a block's number on the page (Content v5: "numbered as on the page") */
  num?: number | null;
  /** small buttons shown on hover, at the right (move, remove) */
  actions?: React.ReactNode;
  /** a drag handle, shown on hover at the left */
  handle?: React.ReactNode;
  /** while a row is dragged over this one: where it would land */
  drop?: "above" | "below" | null;
  /** the row's own drag-over / drop handlers */
  dragProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const busy = state === "busy";
  return (
    <Box data-row={id} {...dragProps} sx={{ position: "relative", borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: "none" }, bgcolor: open ? "#fff" : "transparent", transition: "background-color .2s",
      ...(drop ? { boxShadow: drop === "above" ? `inset 0 2px 0 ${PINK}` : `inset 0 -2px 0 ${PINK}` } : {}) }}>
      <Box role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        sx={{
          display: "flex", alignItems: "center", gap: 1.1, px: 1.5, py: 1.05, cursor: "pointer", position: "relative", outline: "none",
          ...(handle ? { pl: 0.5 } : {}),
          "&:hover": { bgcolor: "rgba(21,34,58,.03)" }, "&:focus-visible": { boxShadow: `inset 0 0 0 2px ${PINK}` },
          "&:hover .ai, &:hover .acts, &:hover .handle": { opacity: 1 },
          ...(open ? { boxShadow: `inset 3px 0 0 ${accent === "blue" ? "#2459d1" : PINK}` } : {}),
          ...(busy ? { backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.5s linear infinite` } : {}),
        }}>
        {handle}
        <StateIcon state={state} />
        {num ? (
          <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.4, boxSizing: "border-box", borderRadius: "4px", display: "inline-grid", placeItems: "center", flexShrink: 0, bgcolor: open ? PINK : "#eef1f5", color: open ? "#fff" : "#5b6675", fontSize: "0.7rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", transition: "background-color .2s, color .2s" }}>{num}</Box>
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}{count ? <Box component="span" sx={{ color: MUTED, fontWeight: 600 }}> · {count}</Box> : null}
          </Typography>
          {(busy && busyLabel) ? <Typography sx={{ fontSize: "0.76rem", color: PINK, fontWeight: 600, lineHeight: 1.35 }}>{busyLabel}</Typography>
            : summary ? <Typography component="div" sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary}</Typography> : null}
        </Box>
        {actions && <Box className="acts" onClick={(e) => e.stopPropagation()} sx={{ display: "flex", alignItems: "center", opacity: { xs: 1, md: 0 }, transition: "opacity .12s" }}>{actions}</Box>}
        {onAi && (
          <Tooltip title={aiLabel ?? "Write it with AI"}>
            <span>
              <IconButton className="ai" size="small" disabled={!canAi || busy} onClick={(e) => { e.stopPropagation(); onAi(); }} aria-label={aiLabel ?? "Write it with AI"}
                sx={{ color: PINK, opacity: { xs: 1, md: open ? 1 : 0.55 }, transition: "opacity .15s" }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <ExpandMoreIcon sx={{ fontSize: 20, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .22s ease" }} />
      </Box>
      <Collapse in={open} timeout={240} unmountOnExit>
        <Box sx={{ px: 1.75, pb: 1.75, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

/** The rows in one quiet card. */
export function RowList({ children }: { children: React.ReactNode }) {
  return <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", overflow: "hidden", bgcolor: "rgba(250,251,253,.9)" }}>{children}</Box>;
}

"use client";

/**
 * THE PAGES OF A DESIGN.
 *
 * Until now a piece was one artboard, so a three-slide carousel meant three
 * separate versions with no relationship to each other, and the order lived in
 * somebody's head. Express puts the pages in a row under the canvas and that
 * row is the document: add, duplicate, reorder, delete, and you can see the
 * whole thing at once.
 *
 * Previews are drawn from the pages themselves — the same nodes, scaled — for
 * the same reason the template gallery is: a thumbnail that is generated
 * separately from the thing it depicts is wrong the moment either changes.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import type { DesignDocument } from "@/lib/design-document";

const INK = "#15223a";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";
const ACCENT = "#2459d1";

export default function PageStrip({
  pages,
  active,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: {
  pages: DesignDocument[];
  active: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
  onDuplicate: (i: number) => void;
  onDelete: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
}) {
  return (
    <Box sx={{
      flexShrink: 0, display: "flex", alignItems: "center", gap: 1,
      px: 1, py: 0.75, mt: 1, borderRadius: "12px",
      bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, overflowX: "auto",
    }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0, pl: 0.5 }}>
        {pages.length === 1 ? "1 page" : `${pages.length} pages`}
      </Typography>

      {pages.map((d, i) => {
        const on = i === active;
        return (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
            <Box
              component="button"
              type="button"
              onClick={() => onSelect(i)}
              aria-current={on ? "true" : undefined}
              aria-label={`Page ${i + 1}`}
              sx={{
                cursor: "pointer", p: 0, borderRadius: "8px", overflow: "hidden",
                border: `1px solid ${on ? ACCENT : HAIRLINE}`,
                boxShadow: on ? `0 0 0 1px ${ACCENT}` : "none",
                bgcolor: d.background.color, position: "relative",
                width: 64, height: Math.max(28, Math.round((64 * d.canvas.h) / d.canvas.w)),
                "&:hover": { borderColor: ACCENT },
              }}
            >
              {/* Only the blocks — at this size, text is a grey bar and that is
                  more honest than four unreadable pixels of a word. */}
              {d.nodes.slice(0, 14).map((n) => (
                <Box
                  key={n.id}
                  sx={{
                    position: "absolute",
                    left: `${(n.x / d.canvas.w) * 100}%`,
                    top: `${(n.y / d.canvas.h) * 100}%`,
                    width: n.width ? `${(n.width / d.canvas.w) * 100}%` : "10%",
                    height: n.kind === "text"
                      ? `${Math.max(2, ((n.fontSize ?? 20) / d.canvas.h) * 100)}%`
                      : `${((n.height ?? 20) / d.canvas.h) * 100}%`,
                    bgcolor: n.fill,
                    opacity: n.kind === "text" ? 0.75 : 1,
                    borderRadius: "1px",
                  }}
                />
              ))}
              <Box sx={{
                position: "absolute", left: 2, bottom: 1,
                fontSize: 8, fontWeight: 700, color: INK, opacity: 0.55,
              }}>
                {i + 1}
              </Box>
            </Box>

            {on && (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                <Tooltip title="Move left">
                  <span>
                    <IconButton size="small" disabled={i === 0} onClick={() => onMove(i, -1)} sx={{ p: 0.15 }}>
                      <ChevronLeftIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move right">
                  <span>
                    <IconButton size="small" disabled={i === pages.length - 1} onClick={() => onMove(i, 1)} sx={{ p: 0.15 }}>
                      <ChevronRightIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            )}
          </Box>
        );
      })}

      <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0, pl: 0.5 }}>
        <Tooltip title="Duplicate this page">
          <IconButton size="small" onClick={() => onDuplicate(active)}>
            <ContentCopyIcon sx={{ fontSize: 16, color: FAINT }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add a page">
          <IconButton size="small" onClick={onAdd}>
            <AddIcon sx={{ fontSize: 18, color: FAINT }} />
          </IconButton>
        </Tooltip>
        {/* Never offered on the last page: a design with no pages is not a
            state the editor can show, and deleting into it is a trap. */}
        <Tooltip title={pages.length > 1 ? "Delete this page" : "A design needs at least one page"}>
          <span>
            <IconButton size="small" disabled={pages.length <= 1} onClick={() => onDelete(active)}>
              <DeleteOutlineIcon sx={{ fontSize: 17, color: FAINT }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

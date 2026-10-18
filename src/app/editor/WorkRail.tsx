"use client";

/**
 * THE WORK RAIL — what this piece is made of, and what it sits beside.
 *
 * The hub's rail says where things live. This one says where YOU are: the
 * pages of this design and the other pieces of the project, both one click
 * away and both visible without opening a menu. It is the half of navigation
 * the canvas page never had. (SARCLA, 18.10.2026)
 */

import Box from "@mui/material/Box";
import Link from "next/link";

import type { DesignDocument } from "@/lib/design-document";
import { ACCENT, INK, INK_2, INK_3, LINE, LINE_2, RAIL_W, SUNKEN } from "./canvasChrome";

type Sibling = { id: number; title: string | null; label: string | null; status: string };

const ctlSx = {
  border: 0, bgcolor: "transparent", cursor: "pointer", color: INK_2,
  fontFamily: "inherit", fontSize: 13, lineHeight: 1, px: 0.5, py: 0.5, borderRadius: "5px",
  "&:hover": { bgcolor: SUNKEN, color: INK },
  "&:disabled": { color: "#c9ced6", cursor: "default", bgcolor: "transparent" },
} as const;

const dotFor = (status: string) =>
  status === "approved" || status === "published" ? "#b7bfca" : status === "draft" ? INK_3 : ACCENT;

/**
 * Drawn from the page itself, scaled — never a stored thumbnail. A preview
 * generated separately from the thing it depicts is wrong the moment either
 * one changes.
 */
function Thumb({ d }: { d: DesignDocument }) {
  return (
    <Box sx={{ position: "absolute", inset: 0, bgcolor: d.background.color }}>
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
    </Box>
  );
}

export default function WorkRail({
  pages, activePage, onSelectPage, onAddPage, onDuplicatePage, onDeletePage, onMovePage,
  siblings, itemId, project,
}: {
  pages: DesignDocument[];
  activePage: number;
  onSelectPage: (i: number) => void;
  /** Absent until the piece is saved — a page on an unsaved design has nowhere to go. */
  onAddPage?: () => void;
  onDuplicatePage?: (i: number) => void;
  onDeletePage?: (i: number) => void;
  onMovePage?: (i: number, dir: -1 | 1) => void;
  siblings: Sibling[];
  itemId?: number;
  project: { id: number; title: string } | null;
}) {
  return (
    <Box sx={{
      width: RAIL_W, flexShrink: 0, bgcolor: "#fff", borderRight: `1px solid ${LINE}`,
      display: "flex", flexDirection: "column", px: 1.25, py: 1.5, overflowY: "auto",
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 0.5 }}>
        <Box sx={{ fontSize: 12, color: INK_3 }}>Pages</Box>
        <Box sx={{ fontSize: 11, color: "#b4bcc7" }}>{pages.length || 1}</Box>
        <Box sx={{ flex: 1 }} />
        {onAddPage && (
          <Box component="button" type="button" onClick={onAddPage} aria-label="Add a page"
            title="Add a page"
            sx={{ border: 0, bgcolor: "transparent", cursor: "pointer", color: INK_2, fontSize: 17, lineHeight: 1, px: 0.5, borderRadius: "5px", "&:hover": { bgcolor: SUNKEN, color: INK } }}>
            +
          </Box>
        )}
      </Box>

      {pages.length > 1 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.875, mt: 1 }}>
          {pages.map((d, i) => {
            const on = i === activePage;
            return (
              <Box
                key={i}
                component="button"
                type="button"
                onClick={() => onSelectPage(i)}
                aria-current={on ? "true" : undefined}
                aria-label={`Page ${i + 1}`}
                sx={{
                  position: "relative", p: 0, cursor: "pointer", borderRadius: "6px", overflow: "hidden",
                  width: "100%", height: Math.max(40, Math.round(((RAIL_W - 20) * d.canvas.h) / d.canvas.w)),
                  border: `1px solid ${on ? INK : LINE_2}`,
                  boxShadow: on ? `0 0 0 1px ${INK}` : "none",
                  "&:hover": { borderColor: INK },
                }}
              >
                <Thumb d={d} />
                <Box sx={{ position: "absolute", left: 4, bottom: 3, fontSize: 9, fontWeight: 700, color: INK, opacity: 0.55 }}>
                  {i + 1}
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ fontSize: 12, color: INK_3, lineHeight: 1.5, px: 0.5, mt: 1 }}>
          {onAddPage ? "One page so far." : "One page. Save the design to add more."}
        </Box>
      )}

      {pages.length > 0 && (onDuplicatePage || onDeletePage || onMovePage) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mt: 1, px: 0.25 }}>
          {onMovePage && (
            <>
              <Box component="button" type="button" aria-label="Move this page up"
                disabled={activePage === 0} onClick={() => onMovePage(activePage, -1)}
                sx={ctlSx}>&#8593;</Box>
              <Box component="button" type="button" aria-label="Move this page down"
                disabled={activePage >= pages.length - 1} onClick={() => onMovePage(activePage, 1)}
                sx={ctlSx}>&#8595;</Box>
            </>
          )}
          <Box sx={{ flex: 1 }} />
          {onDuplicatePage && (
            <Box component="button" type="button" aria-label="Duplicate this page"
              onClick={() => onDuplicatePage(activePage)} sx={{ ...ctlSx, fontSize: 11.5, px: 0.75 }}>
              Duplicate
            </Box>
          )}
          {onDeletePage && (
            <Box component="button" type="button" aria-label="Delete this page"
              // Never offered on the last page: a design with no pages is not a
              // state the editor can show, and deleting into it is a trap.
              disabled={pages.length <= 1} onClick={() => onDeletePage(activePage)}
              sx={{ ...ctlSx, fontSize: 11.5, px: 0.75 }}>
              Delete
            </Box>
          )}
        </Box>
      )}

      {siblings.length > 0 && (
        <Box sx={{ mt: 2.5, pt: 1.75, borderTop: `1px solid ${LINE}` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 0.5, mb: 1 }}>
            <Box sx={{ fontSize: 12, color: INK_3 }}>In this project</Box>
            <Box sx={{ fontSize: 11, color: "#b4bcc7" }}>{siblings.length}</Box>
          </Box>
          {siblings.map((s) => {
            const on = s.id === itemId;
            return (
              <Box
                key={s.id}
                component={Link}
                href={`/editor?item=${s.id}`}
                sx={{
                  display: "flex", alignItems: "center", gap: 1, minHeight: 30, px: 0.75, py: 0.5,
                  borderRadius: "6px", fontSize: 12.5, lineHeight: 1.35,
                  color: on ? INK : INK_2, fontWeight: on ? 600 : 400,
                  bgcolor: on ? SUNKEN : "transparent",
                  "&:hover": { bgcolor: SUNKEN },
                }}
              >
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: dotFor(s.status), flexShrink: 0 }} />
                <Box sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.label || s.title || `Piece ${s.id}`}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Box sx={{ mt: "auto", pt: 1.75, borderTop: `1px solid ${LINE}` }}>
        <Box
          component={Link}
          href={project ? `/projects/${project.id}` : "/projects"}
          sx={{ display: "block", px: 0.75, py: 0.75, borderRadius: "6px", fontSize: 12.5, color: INK_2, "&:hover": { bgcolor: SUNKEN, color: INK } }}
        >
          {project ? "Brief and comments" : "Projects"}
        </Box>
        <Box
          component={Link}
          href="/library"
          sx={{ display: "block", px: 0.75, py: 0.75, borderRadius: "6px", fontSize: 12.5, color: INK_2, "&:hover": { bgcolor: SUNKEN, color: INK } }}
        >
          Library
        </Box>
      </Box>
    </Box>
  );
}

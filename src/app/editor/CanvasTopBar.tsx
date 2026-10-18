"use client";

/**
 * THE TITLE BAR — every segment is a way out.
 *
 * A breadcrumb that only goes up is a label. Each of the three segments opens
 * the list of its own siblings instead: the project opens your other projects,
 * the piece opens the other pieces of this project, the page opens the pages of
 * this design. Going UP is the back arrow; going SIDEWAYS is the segment.
 *
 * This is the difference from the "Go to" menu that was here before, which
 * listed the same six destinations wherever you stood. These three are built
 * from what you are inside, so they change with you. (SARCLA, 18.10.2026)
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { ACCENT, BAR_H, INK, INK_2, INK_3, LINE, LINE_2, SUNKEN } from "./canvasChrome";

type Sibling = { id: number; title: string | null; label: string | null; status: string };
type ProjectRef = { id: number; title: string; variantCount?: number };

const segSx = {
  height: 30, px: 1, display: "flex", alignItems: "center", gap: 0.6,
  border: 0, borderRadius: "7px", bgcolor: "transparent", cursor: "pointer",
  fontFamily: "inherit", fontSize: 13, color: INK_2, whiteSpace: "nowrap",
  maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis",
  "&:hover": { bgcolor: SUNKEN, color: INK },
} as const;

function Segment({
  label, here, onOpen, disabled,
}: { label: string; here?: boolean; onOpen: (el: HTMLElement) => void; disabled?: boolean }) {
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => onOpen(e.currentTarget)}
      sx={{ ...segSx, color: here ? INK : INK_2, fontWeight: here ? 600 : 400, "&:disabled": { cursor: "default", color: INK_3 } }}
    >
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Box>
      {!disabled && <KeyboardArrowDownIcon sx={{ fontSize: 15, opacity: 0.55 }} />}
    </Box>
  );
}

const dotFor = (status: string) =>
  status === "approved" || status === "published" ? "#b7bfca" : status === "draft" ? INK_3 : ACCENT;

export default function CanvasTopBar({
  itemId, itemTitle, project, siblings, projectId, pages, activePage, onSelectPage, revision,
}: {
  itemId?: number;
  itemTitle: string;
  /** Fetched once by the shell and shared with the work rail. */
  project: ProjectRef | null;
  siblings: Sibling[];
  projectId: number | null;
  pages: number;
  activePage: number;
  onSelectPage: (i: number) => void;
  revision: number | null;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [anchor, setAnchor] = useState<{ el: HTMLElement; which: "project" | "piece" | "page" } | null>(null);

  // Other projects, fetched once the menu is first opened rather than on load:
  // a list nobody has asked for is not worth a request on every visit.
  const askedProjects = useRef(false);
  useEffect(() => {
    if (anchor?.which !== "project" || askedProjects.current) return;
    askedProjects.current = true;
    fetch("/api/content/projects")
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setProjects(d.projects ?? []); })
      .catch(() => {});
  }, [anchor]);

  const close = () => setAnchor(null);
  const idx = itemId ? siblings.findIndex((s) => s.id === itemId) : -1;
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <Box sx={{
      height: BAR_H, flexShrink: 0, bgcolor: "#fff", borderBottom: `1px solid ${LINE}`,
      display: "flex", alignItems: "center", gap: 1, pl: 1, pr: 1.5,
    }}>
      <Tooltip title={project ? `Back to ${project.title}` : "Back to Projects"}>
        <Box
          component={Link}
          href={project ? `/projects/${project.id}` : "/projects"}
          aria-label="Back"
          sx={{
            width: 30, height: 30, borderRadius: "7px", display: "flex", alignItems: "center",
            justifyContent: "center", color: INK_2, flexShrink: 0, "&:hover": { bgcolor: SUNKEN, color: INK },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 17 }} />
        </Box>
      </Tooltip>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, minWidth: 0 }}>
        <Segment
          label={project ? project.title : "No project"}
          onOpen={(el) => setAnchor({ el, which: "project" })}
        />
        <Box sx={{ color: "#c3c9d2", fontSize: 13 }}>/</Box>
        <Segment
          label={itemTitle}
          here={pages <= 1}
          disabled={siblings.length === 0}
          onOpen={(el) => setAnchor({ el, which: "piece" })}
        />
        {pages > 1 && (
          <>
            <Box sx={{ color: "#c3c9d2", fontSize: 13 }}>/</Box>
            <Segment label={`Page ${activePage + 1}`} here onOpen={(el) => setAnchor({ el, which: "page" })} />
          </>
        )}

        {siblings.length > 1 && idx >= 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, ml: 0.75, pl: 1.25, borderLeft: `1px solid ${LINE}` }}>
            <Tooltip title={prev ? (prev.label || prev.title || `Piece ${idx}`) : "First piece"}>
              <span>
                <Box
                  component="button" type="button" disabled={!prev} aria-label="Previous piece"
                  onClick={() => prev && router.push(`/editor?item=${prev.id}`)}
                  sx={{ border: 0, bgcolor: "transparent", cursor: "pointer", color: INK_2, display: "flex", p: 0.25, borderRadius: "5px", "&:hover": { bgcolor: SUNKEN }, "&:disabled": { color: "#d3d8df", cursor: "default" } }}
                >
                  <ChevronLeftIcon sx={{ fontSize: 17 }} />
                </Box>
              </span>
            </Tooltip>
            <Box sx={{ fontSize: 12, color: INK_3, whiteSpace: "nowrap" }}>
              {idx + 1} of {siblings.length}
            </Box>
            <Tooltip title={next ? (next.label || next.title || `Piece ${idx + 2}`) : "Last piece"}>
              <span>
                <Box
                  component="button" type="button" disabled={!next} aria-label="Next piece"
                  onClick={() => next && router.push(`/editor?item=${next.id}`)}
                  sx={{ border: 0, bgcolor: "transparent", cursor: "pointer", color: INK_2, display: "flex", p: 0.25, borderRadius: "5px", "&:hover": { bgcolor: SUNKEN }, "&:disabled": { color: "#d3d8df", cursor: "default" } }}
                >
                  <ChevronRightIcon sx={{ fontSize: 17 }} />
                </Box>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>

      <Box sx={{ flex: 1 }} />
      {revision !== null && (
        <Box sx={{ fontSize: 12, color: INK_3, whiteSpace: "nowrap" }}>Saved · revision {revision}</Box>
      )}
      <Box
        component={Link}
        href={projectId ? `/create?project=${projectId}` : "/create"}
        sx={{ fontSize: 13, fontWeight: 600, color: INK_2, px: 1, py: 0.75, borderRadius: "7px", "&:hover": { bgcolor: SUNKEN, color: INK } }}
      >
        Create Studio
      </Box>
      <Box
        component={Link}
        href="/library"
        sx={{ fontSize: 13, fontWeight: 600, color: INK_2, px: 1, py: 0.75, borderRadius: "7px", "&:hover": { bgcolor: SUNKEN, color: INK } }}
      >
        Library
      </Box>

      <Menu
        anchorEl={anchor?.el ?? null}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 300, borderRadius: "10px", border: `1px solid ${LINE_2}`, boxShadow: "0 12px 32px rgba(17,22,28,.16)" } } }}
      >
        {anchor?.which === "project" && [
          <Box key="h" sx={{ fontSize: 11, color: INK_3, px: 1.5, pt: 1, pb: 0.5 }}>Projects</Box>,
          ...projects.slice(0, 8).map((p) => (
            <MenuItem key={p.id} component={Link} href={`/projects/${p.id}`} onClick={close}
              selected={p.id === projectId}
              sx={{ fontSize: 13, gap: 1 }}>
              <Box sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</Box>
              <Box sx={{ fontSize: 12, color: INK_3 }}>
                {p.id === projectId ? "here" : p.variantCount ? `${p.variantCount} pieces` : ""}
              </Box>
            </MenuItem>
          )),
          <Divider key="d" />,
          <MenuItem key="all" component={Link} href="/projects" onClick={close} sx={{ fontSize: 13 }}>All projects</MenuItem>,
        ]}

        {anchor?.which === "piece" && [
          <Box key="h" sx={{ fontSize: 11, color: INK_3, px: 1.5, pt: 1, pb: 0.5 }}>
            In {project?.title ?? "this project"}
          </Box>,
          ...siblings.map((s) => (
            <MenuItem key={s.id} component={Link} href={`/editor?item=${s.id}`} onClick={close}
              selected={s.id === itemId} sx={{ fontSize: 13, gap: 1.25 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: dotFor(s.status), flexShrink: 0 }} />
              <Box sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.label || s.title || `Piece ${s.id}`}
              </Box>
              <Box sx={{ fontSize: 12, color: INK_3, textTransform: "capitalize" }}>
                {s.id === itemId ? "here" : s.status}
              </Box>
            </MenuItem>
          )),
          <Divider key="d" />,
          <MenuItem key="op" component={Link} href={project ? `/projects/${project.id}` : "/projects"} onClick={close} sx={{ fontSize: 13 }}>
            Open the project
          </MenuItem>,
        ]}

        {anchor?.which === "page" && [
          <Box key="h" sx={{ fontSize: 11, color: INK_3, px: 1.5, pt: 1, pb: 0.5 }}>Pages in this piece</Box>,
          ...Array.from({ length: pages }, (_, i) => (
            <MenuItem key={i} selected={i === activePage} onClick={() => { onSelectPage(i); close(); }} sx={{ fontSize: 13, gap: 1 }}>
              <Box sx={{ flex: 1 }}>Page {i + 1}</Box>
              {i === activePage && <Box sx={{ fontSize: 12, color: INK_3 }}>here</Box>}
            </MenuItem>
          )),
        ]}
      </Menu>
    </Box>
  );
}

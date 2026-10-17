"use client";

/**
 * THE EDITOR'S CHROME.
 *
 * Express puts a dark bar across the top carrying the document's identity and
 * the things you do to the whole document — where it came from, what it is
 * called, and how it leaves. Everything else on screen is then about the work
 * rather than about the app.
 *
 * Our studio had this spread across a white page header: a 26px "Create
 * Studio" title, a subtitle explaining the app to somebody who is already
 * using it, and the real actions scattered between a brief card and a toolbar
 * above the canvas. The page was explaining itself instead of getting out of
 * the way.
 *
 * Dark on purpose, and not for fashion: it separates the application from the
 * document, so a white artboard reads as the thing being made rather than as
 * part of the furniture.
 */

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

const BAR = "#15223a";
const ON_BAR = "#e8edf6";
const DIM = "#93a0b8";

export default function StudioChrome({
  projectId,
  projectTitle,
  typeLabel,
  canvasSize,
  /** The save control — the studio owns what saving means. */
  right,
}: {
  projectId?: number;
  projectTitle?: string;
  typeLabel: string;
  /** The artboard size, shown so nobody has to open a panel to read it. */
  canvasSize?: { w: number; h: number } | null;
  right?: React.ReactNode;
}) {
  const home = projectId ? `/projects/${projectId}` : "/projects";

  return (
    <Box
      sx={{
        display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1,
        bgcolor: BAR, color: ON_BAR, flexShrink: 0,
      }}
    >
      <Tooltip title={projectTitle ? `Back to ${projectTitle}` : "Projects"}>
        <IconButton component={Link} href={home} size="small" sx={{ color: ON_BAR }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      <Box sx={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography sx={{
          fontSize: 14, fontWeight: 700, color: ON_BAR,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 420,
        }}>
          {projectTitle ?? "Untitled"}
        </Typography>
        <Typography sx={{ fontSize: 12, color: DIM, whiteSpace: "nowrap" }}>{typeLabel}</Typography>
        {canvasSize && (
          <Typography sx={{ fontSize: 12, color: DIM, whiteSpace: "nowrap" }}>
            {canvasSize.w} &times; {canvasSize.h}
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1 }} />

      {right}

      <Button
        component={Link}
        href={home}
        size="small"
        startIcon={<FolderOpenIcon sx={{ fontSize: 16 }} />}
        sx={{ textTransform: "none", fontWeight: 600, color: ON_BAR, "&:hover": { bgcolor: "rgba(255,255,255,.08)" } }}
      >
        {projectId ? "Project" : "Projects"}
      </Button>
    </Box>
  );
}

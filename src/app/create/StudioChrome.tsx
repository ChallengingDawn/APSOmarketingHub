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
import { useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import SearchIcon from "@mui/icons-material/Search";
import AppsIcon from "@mui/icons-material/Apps";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
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
  const [goAnchor, setGoAnchor] = useState<HTMLElement | null>(null);

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

      {/* The way out. It used to be a second button pointing at exactly the
          same href as the back arrow, so the editor had ONE destination and
          the rest of the hub was unreachable from here. */}
      <Button
        size="small"
        onClick={(e) => setGoAnchor(e.currentTarget)}
        startIcon={<FolderOpenIcon sx={{ fontSize: 16 }} />}
        endIcon={<ExpandMoreIcon sx={{ fontSize: 17 }} />}
        sx={{ textTransform: "none", fontWeight: 600, color: ON_BAR, "&:hover": { bgcolor: "rgba(255,255,255,.08)" } }}
      >
        Go to
      </Button>
      <Menu
        open={Boolean(goAnchor)}
        anchorEl={goAnchor}
        onClose={() => setGoAnchor(null)}
        slotProps={{ paper: { sx: { borderRadius: "12px", minWidth: 220 } } }}
      >
        {projectId && (
          <MenuItem component={Link} href={`/projects/${projectId}`} onClick={() => setGoAnchor(null)} sx={{ gap: 1, fontSize: "0.86rem", fontWeight: 600 }}>
            <FolderOpenIcon sx={{ fontSize: 17, color: "#5b6470" }} />
            {projectTitle ? `Back to ${projectTitle}` : "Back to the project"}
          </MenuItem>
        )}
        {projectId && <Divider />}
        {[
          { href: "/projects", label: "Projects", icon: <FolderOpenIcon sx={{ fontSize: 17, color: "#5b6470" }} /> },
          { href: "/projects/all", label: "All projects", icon: <SearchIcon sx={{ fontSize: 17, color: "#5b6470" }} /> },
          { href: "/projects/calendar", label: "Calendar", icon: <CalendarMonthIcon sx={{ fontSize: 17, color: "#5b6470" }} /> },
          { href: "/templates", label: "Templates", icon: <DashboardCustomizeIcon sx={{ fontSize: 17, color: "#5b6470" }} /> },
        ].map((d) => (
          <MenuItem key={d.href} component={Link} href={d.href} onClick={() => setGoAnchor(null)} sx={{ gap: 1, fontSize: "0.86rem" }}>
            {d.icon}{d.label}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem component={Link} href="/" onClick={() => setGoAnchor(null)} sx={{ gap: 1, fontSize: "0.86rem", color: "#5b6470" }}>
          <AppsIcon sx={{ fontSize: 17, color: "#5b6470" }} />
          All apps
        </MenuItem>
      </Menu>
    </Box>
  );
}

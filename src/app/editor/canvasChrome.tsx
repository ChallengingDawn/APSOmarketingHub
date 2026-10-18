"use client";

/**
 * THE CANVAS PAGE'S OWN CHROME.
 *
 * The editor used to borrow the hub's: a 300px drawer of 89 links down the
 * side, a 26px page title, a sentence of explanation, and two buttons. None of
 * that answers the question you actually have while drawing — what else is in
 * this project, which page am I on, how do I get back — so the page had no
 * navigation at all and the drawer took 300px to say so.
 *
 * Two different jobs, kept apart: the app rail says where things live in the
 * hub and stays 48px wide, the title bar and the work rail move you through
 * the work. (SARCLA, 18.10.2026)
 */

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";

import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

export const INK = "#1a1d21";
export const INK_2 = "#5b6470";
export const INK_3 = "#8b97ac";
export const ACCENT = "#ed1b2f";
export const LINE = "rgba(21,34,58,.11)";
export const LINE_2 = "rgba(21,34,58,.20)";
export const SUNKEN = "#f1f3f5";
export const GROUND = "#e9ebee";

export const HUB_W = 48;
export const RAIL_W = 200;
export const INSP_W = 330;
export const BAR_H = 48;

const APPS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/", label: "All apps", icon: <HomeOutlinedIcon sx={{ fontSize: 19 }} /> },
  { href: "/mission-control", label: "Mission Control", icon: <DashboardIcon sx={{ fontSize: 19 }} /> },
  { href: "/create", label: "Create Studio", icon: <AutoAwesomeIcon sx={{ fontSize: 19 }} /> },
  { href: "/projects", label: "Projects", icon: <FolderOpenIcon sx={{ fontSize: 19 }} /> },
  { href: "/projects/calendar", label: "Calendar", icon: <CalendarMonthIcon sx={{ fontSize: 19 }} /> },
  { href: "/library", label: "Library", icon: <LibraryBooksIcon sx={{ fontSize: 19 }} /> },
  { href: "/templates", label: "Templates", icon: <DashboardCustomizeIcon sx={{ fontSize: 19 }} /> },
];

/** The hub, 48px wide. Every link is one click away and none of them is resident. */
export function HubRail() {
  const pathname = usePathname() || "";
  return (
    <Box
      component="nav"
      aria-label="Apps"
      sx={{
        width: HUB_W, flexShrink: 0, bgcolor: "#fff", borderRight: `1px solid ${LINE}`,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25, py: 1,
      }}
    >
      {APPS.map((a) => {
        const on = a.href !== "/" && pathname.startsWith(a.href);
        return (
          <Tooltip key={a.href} title={a.label} placement="right">
            <Box
              component={Link}
              href={a.href}
              aria-label={a.label}
              sx={{
                width: 32, height: 32, borderRadius: "7px", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: on ? INK : INK_3, bgcolor: on ? SUNKEN : "transparent",
                "&:hover": { bgcolor: SUNKEN, color: INK },
              }}
            >
              {a.icon}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/**
 * The strip under the stage. It says only what is true: which page of how
 * many, and the size the design is actually drawn at. Zoom lives inside the
 * canvas, which owns it — a second set of zoom buttons here would be a
 * decoration that does nothing.
 */
export function CanvasStatusBar({
  pageCount, activePage, onSelectPage, size, typeLabel,
}: {
  pageCount: number;
  activePage: number;
  onSelectPage: (i: number) => void;
  size: { w: number; h: number } | null;
  typeLabel: string;
}) {
  return (
    <Box sx={{
      height: 36, flexShrink: 0, bgcolor: "#fff", borderTop: `1px solid ${LINE}`,
      display: "flex", alignItems: "center", gap: 1, px: 1.5,
    }}>
      <Box sx={{ fontSize: 12, color: INK_3 }}>{typeLabel}</Box>
      <Box sx={{ flex: 1 }} />
      {pageCount > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box
            component="button"
            type="button"
            disabled={activePage === 0}
            onClick={() => onSelectPage(activePage - 1)}
            aria-label="Previous page"
            sx={{ border: 0, bgcolor: "transparent", cursor: "pointer", color: INK_2, px: 0.5, "&:disabled": { color: "#d3d8df", cursor: "default" } }}
          >
            &#8249;
          </Box>
          <Box sx={{ fontSize: 12, color: INK_2 }}>Page {activePage + 1} of {pageCount}</Box>
          <Box
            component="button"
            type="button"
            disabled={activePage >= pageCount - 1}
            onClick={() => onSelectPage(activePage + 1)}
            aria-label="Next page"
            sx={{ border: 0, bgcolor: "transparent", cursor: "pointer", color: INK_2, px: 0.5, "&:disabled": { color: "#d3d8df", cursor: "default" } }}
          >
            &#8250;
          </Box>
        </Box>
      )}
      <Box sx={{ flex: 1 }} />
      <Box sx={{ fontSize: 12, color: INK_3, fontVariantNumeric: "tabular-nums" }}>
        {size ? `${size.w} × ${size.h}` : "—"}
      </Box>
    </Box>
  );
}

"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import DashboardIcon from "@mui/icons-material/Dashboard";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import InsightsIcon from "@mui/icons-material/Insights";
import HubIcon from "@mui/icons-material/Hub";
import SensorsIcon from "@mui/icons-material/Sensors";
import HandshakeIcon from "@mui/icons-material/Handshake";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SecurityIcon from "@mui/icons-material/Security";
import BarChartIcon from "@mui/icons-material/BarChart";
import DescriptionIcon from "@mui/icons-material/Description";
import SettingsIcon from "@mui/icons-material/Settings";
import PeopleIcon from "@mui/icons-material/People";
import PsychologyIcon from "@mui/icons-material/Psychology";
import HistoryIcon from "@mui/icons-material/History";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LogoutIcon from "@mui/icons-material/Logout";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import Link from "next/link";

const DRAWER_WIDTH = 300;
const RED = "#ed1b2f";

interface NavSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: { label: string; href: string; icon: React.ReactNode; badge?: string }[];
}

/**
 * Every href below resolves to a page under src/app — checked against the route
 * tree, because a dead sidebar entry is worse than a missing one. Deliberately
 * absent: /studio and /calendar (now redirects to /create and /), and
 * /knowledge-base (retired; it redirects to /personality, which is listed).
 *
 * Integrations appears exactly ONCE in this app, under Governance beside
 * Settings — it is configuration, and a second entry under Intelligence only
 * made people wonder which of the two was the real one.
 */
const navSections: NavSection[] = [
  {
    title: "Overview",
    icon: <DashboardIcon />,
    color: "#274e64",
    items: [
      // The content calendar now lives on Overview — /calendar redirects here.
      { label: "Mission Control", href: "/", icon: <DashboardIcon fontSize="small" /> },
      // Top level on purpose: the brain feeds every generator in the app.
      { label: "Personality", href: "/personality", icon: <PsychologyIcon fontSize="small" />, badge: "Brain" },
    ],
  },
  {
    title: "AI Engine",
    icon: <AutoAwesomeIcon />,
    color: RED,
    items: [
      { label: "Create Studio", href: "/create", icon: <AutoAwesomeIcon fontSize="small" />, badge: "AI" },
      { label: "Content Library", href: "/library", icon: <MenuBookIcon fontSize="small" /> },
      { label: "Templates", href: "/templates", icon: <DashboardCustomizeIcon fontSize="small" /> },
      { label: "Logs", href: "/logs", icon: <HistoryIcon fontSize="small" /> },
    ],
  },
  {
    // Everything that reads a live source lives here — one category, so the
    // reader never wonders whether search data counts as intelligence.
    title: "Intelligence",
    icon: <InsightsIcon />,
    color: "#0a84ff",
    items: [
      { label: "Analytics", href: "/analytics", icon: <BarChartIcon fontSize="small" /> },
      { label: "SEO Cockpit", href: "/seo", icon: <TravelExploreIcon fontSize="small" /> },
      { label: "GEO Readiness", href: "/geo", icon: <ManageSearchIcon fontSize="small" /> },
      { label: "Live", href: "/live", icon: <SensorsIcon fontSize="small" />, badge: "Live" },
      { label: "Customers", href: "/customers", icon: <HandshakeIcon fontSize="small" /> },
    ],
  },
  {
    title: "Governance",
    icon: <SecurityIcon />,
    color: "#8e8e93",
    items: [
      { label: "Settings", href: "/settings", icon: <SettingsIcon fontSize="small" /> },
      { label: "Integrations", href: "/settings/integrations", icon: <HubIcon fontSize="small" /> },
      { label: "Audit", href: "/audit", icon: <SecurityIcon fontSize="small" /> },
      { label: "Admin · Users", href: "/admin", icon: <PeopleIcon fontSize="small" /> },
      { label: "Docs", href: "/docs", icon: <DescriptionIcon fontSize="small" /> },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  // Only ONE item active: the longest href that is an exact or parent-prefix
  // match. Stops "/docs" collisions and "/" lighting up everywhere.
  const activeHref = (() => {
    const all = navSections.flatMap((s) => s.items.map((i) => i.href));
    const matches = all.filter(
      (h) => pathname === h || (h !== "/" && pathname?.startsWith(h + "/")),
    );
    return matches.sort((a, b) => b.length - a.length)[0] ?? "/";
  })();

  const activeSectionTitle = navSections.find((s) => s.items.some((i) => i.href === activeHref))?.title;

  // Collapsible sections — accordion, only one open; the active section
  // starts open and re-opens on navigation.
  const [open, setOpen] = useState<string | null>(activeSectionTitle ?? null);
  useEffect(() => {
    if (activeSectionTitle) setOpen(activeSectionTitle);
  }, [activeSectionTitle]);
  const toggle = (t: string) => setOpen((cur) => (cur === t ? null : t));

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          bgcolor: "#ffffff",
          borderRight: "1px solid #e6e8ec",
          position: "relative",
          overflow: "hidden",
        },
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          px: 3.25,
          pt: 3.5,
          pb: 2.75,
          position: "relative",
          zIndex: 2,
          bgcolor: "#ffffff",
          borderBottom: "1px solid #e6e8ec",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.25 }}>
          <Box
            component="span"
            className="brand-display brand-apso"
            sx={{ fontSize: 36, fontWeight: 700 }}
          >
            <span className="letter letter-a">A</span>
            <span className="letter letter-p">P</span>
            <span className="letter letter-s">S</span>
            <span className="letter letter-o">O</span>
          </Box>
          <Box
            component="span"
            className="brand-display"
            sx={{ fontSize: 22, color: "#3c4043", fontWeight: 400, ml: 0.25 }}
          >
            Marketing
          </Box>
          <Box
            component="span"
            className="brand-display"
            sx={{ fontSize: 32, color: RED, fontWeight: 800, ml: 0.25 }}
          >
            Hub
          </Box>
        </Box>
        <Typography
          sx={{
            fontSize: 12,
            color: "#5f6368",
            fontWeight: 500,
            mt: 1,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          apsoparts.com
        </Typography>
      </Box>

      {/* Navigation Sections — collapsible, iOS Settings rows */}
      <Box sx={{ flex: 1, overflow: "auto", py: 0, position: "relative", zIndex: 1 }}>
        {navSections.map((section) => {
          const isOpen = open === section.title;
          return (
            <Box key={section.title} sx={{ borderBottom: "0.5px solid #ececef" }}>
              {/* Category row */}
              <Box
                onClick={() => toggle(section.title)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.6,
                  px: 3.25,
                  py: 1.35,
                  cursor: "pointer",
                  userSelect: "none",
                  bgcolor: isOpen ? "#f3f4f6" : "transparent",
                  transition: "background-color 0.16s ease",
                  "&:hover": { bgcolor: "#f3f4f6" },
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    bgcolor: section.color,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.14)",
                    "& svg": { fontSize: 21 },
                  }}
                >
                  {section.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.2,
                      color: "#1d1d1f",
                    }}
                  >
                    {section.title}
                  </Typography>
                </Box>
                <KeyboardArrowRightIcon
                  sx={{
                    fontSize: 22,
                    flexShrink: 0,
                    color: "#c7c7cc",
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: "transform 0.22s ease",
                  }}
                />
              </Box>

              {/* Items */}
              <Collapse in={isOpen} timeout={240} unmountOnExit>
                <List dense disablePadding sx={{ px: 2, py: 0.75 }}>
                  {section.items.map((item) => {
                    const active = item.href === activeHref;
                    return (
                      <ListItemButton
                        key={item.href}
                        component={Link}
                        href={item.href}
                        disableRipple
                        sx={{
                          borderRadius: 1.25,
                          mb: 0.4,
                          py: 1,
                          px: 2.25,
                          minHeight: 46,
                          position: "relative",
                          bgcolor: active ? RED : "transparent",
                          color: active ? "#ffffff" : "#363c44",
                          boxShadow: active ? "0 1px 2px rgba(237,27,47,0.25), 0 4px 12px rgba(237,27,47,0.18)" : "none",
                          transition: "background-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease",
                          "&:hover": {
                            bgcolor: active ? "#d81528" : "#f1f3f5",
                          },
                          "& .MuiListItemIcon-root": {
                            color: active ? "#ffffff" : "#5b6470",
                            minWidth: 36,
                            transition: "color 0.18s ease",
                          },
                        }}
                      >
                        <ListItemIcon>
                          <Box
                            component="span"
                            className={active ? "nav-icon-active" : undefined}
                            sx={{ display: "inline-flex", alignItems: "center" }}
                          >
                            {item.icon}
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          slotProps={{
                            primary: {
                              sx: {
                                fontSize: 14.5,
                                fontWeight: active ? 600 : 500,
                                color: active ? "#ffffff" : "#3c4043",
                                letterSpacing: "-0.005em",
                              },
                            },
                          }}
                        />
                        {item.badge && (
                          <Chip
                            label={item.badge}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: 10.5,
                              fontWeight: 700,
                              bgcolor: active ? "#ffffff" : RED,
                              color: active ? RED : "#fff",
                              ml: 0.5,
                            }}
                          />
                        )}
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* Bottom Status + Sign out */}
      <Box sx={{ px: 2.5, py: 2.25, borderTop: "1px solid #e6e8ec", position: "relative", zIndex: 1, bgcolor: "#ffffff" }}>
        <Box sx={{ mb: 1.5, px: 1.75, py: 1.35, borderRadius: 1.25, bgcolor: "#f5f6f8", border: "1px solid #e6e8ec" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
            <Box
              sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#1e7e45", boxShadow: "0 0 0 3px rgba(30,126,69,0.15)" }}
              className="animate-pulse-dot"
            />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "#1a1d21" }}>
              System Active
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: "#5b6470" }}>
            Content engine online
          </Typography>
        </Box>
        <ListItemButton
          component="a"
          href="/api/auth/signout"
          disableRipple
          sx={{
            borderRadius: 1.25,
            py: 1,
            px: 2.25,
            minHeight: 46,
            color: "#363c44",
            borderLeft: "3px solid transparent",
            "&:hover": {
              bgcolor: "#fdebed",
              color: RED,
              borderLeftColor: RED,
              "& .MuiListItemIcon-root": { color: RED },
            },
            "& .MuiListItemIcon-root": { minWidth: 36, color: "#5b6470" },
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Sign out"
            slotProps={{
              primary: {
                sx: { fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.005em" },
              },
            }}
          />
        </ListItemButton>
      </Box>
    </Drawer>
  );
}

export { DRAWER_WIDTH };

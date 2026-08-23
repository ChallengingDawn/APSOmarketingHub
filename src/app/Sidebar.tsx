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
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EditNoteIcon from "@mui/icons-material/EditNote";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SecurityIcon from "@mui/icons-material/Security";
import BarChartIcon from "@mui/icons-material/BarChart";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import ArticleIcon from "@mui/icons-material/Article";
import DescriptionIcon from "@mui/icons-material/Description";
import SettingsIcon from "@mui/icons-material/Settings";
import PeopleIcon from "@mui/icons-material/People";
import PsychologyIcon from "@mui/icons-material/Psychology";
import GroupsIcon from "@mui/icons-material/Groups";
import PublicIcon from "@mui/icons-material/Public";
import HistoryIcon from "@mui/icons-material/History";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import ShareIcon from "@mui/icons-material/Share";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LogoutIcon from "@mui/icons-material/Logout";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import Link from "next/link";

const DRAWER_WIDTH = 264;
const RED = "#ed1b2f";

interface NavSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: { label: string; href: string; icon: React.ReactNode; badge?: string }[];
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    icon: <BarChartIcon />,
    color: "#0a84ff",
    items: [
      { label: "Mission Control", href: "/", icon: <DashboardIcon fontSize="small" /> },
      { label: "Analytics", href: "/analytics", icon: <BarChartIcon fontSize="small" /> },
    ],
  },
  {
    title: "AI Engine",
    icon: <AutoAwesomeIcon />,
    color: RED,
    items: [
      { label: "Content Generation", href: "/content-generation", icon: <PublicIcon fontSize="small" />, badge: "AI" },
      { label: "Personality", href: "/personality", icon: <PsychologyIcon fontSize="small" />, badge: "Brain" },
      { label: "Personas", href: "/personas", icon: <GroupsIcon fontSize="small" /> },
      { label: "Image Studio", href: "/photos", icon: <PhotoCameraIcon fontSize="small" /> },
      { label: "Templates", href: "/templates", icon: <DashboardCustomizeIcon fontSize="small" /> },
      { label: "Logs", href: "/logs", icon: <HistoryIcon fontSize="small" /> },
    ],
  },
  {
    title: "SEO & Content",
    icon: <TravelExploreIcon />,
    color: "#34c759",
    items: [
      { label: "SEO Command Center", href: "/seo", icon: <TravelExploreIcon fontSize="small" /> },
      { label: "Content Calendar", href: "/calendar", icon: <CalendarMonthIcon fontSize="small" /> },
      { label: "Content Studio", href: "/studio", icon: <EditNoteIcon fontSize="small" />, badge: "AI" },
    ],
  },
  {
    title: "Channels",
    icon: <ShareIcon />,
    color: "#ff9f0a",
    items: [
      { label: "LinkedIn", href: "/linkedin", icon: <LinkedInIcon fontSize="small" /> },
      { label: "Newsletter", href: "/newsletter", icon: <NewspaperIcon fontSize="small" /> },
      { label: "Blog", href: "/blog", icon: <ArticleIcon fontSize="small" /> },
    ],
  },
  {
    title: "Governance",
    icon: <SecurityIcon />,
    color: "#8e8e93",
    items: [
      { label: "Knowledge Base", href: "/knowledge-base", icon: <MenuBookIcon fontSize="small" /> },
      { label: "Audit & Compliance", href: "/audit", icon: <SecurityIcon fontSize="small" /> },
      { label: "Settings", href: "/settings", icon: <SettingsIcon fontSize="small" /> },
      { label: "Admin · Users", href: "/admin", icon: <PeopleIcon fontSize="small" /> },
      { label: "Technical Roadmap", href: "/docs/technical-roadmap", icon: <DescriptionIcon fontSize="small" /> },
      { label: "Security Infrastructure", href: "/docs/security-infrastructure", icon: <SecurityIcon fontSize="small" /> },
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
          px: 3,
          pt: 3.5,
          pb: 2.5,
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
            fontSize: 11,
            color: "#5f6368",
            fontWeight: 500,
            mt: 0.75,
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
                  gap: 1.5,
                  px: 3,
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
                    width: 30,
                    height: 30,
                    borderRadius: 1.75,
                    bgcolor: section.color,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.14)",
                    "& svg": { fontSize: 19 },
                  }}
                >
                  {section.icon}
                </Box>
                <Typography
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                    color: "#1d1d1f",
                  }}
                >
                  {section.title}
                </Typography>
                <KeyboardArrowRightIcon
                  sx={{
                    fontSize: 21,
                    flexShrink: 0,
                    color: "#c7c7cc",
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: "transform 0.22s ease",
                  }}
                />
              </Box>

              {/* Items */}
              <Collapse in={isOpen} timeout={240} unmountOnExit>
                <List dense disablePadding sx={{ px: 1.5, py: 0.4 }}>
                  {section.items.map((item) => {
                    const active = item.href === activeHref;
                    return (
                      <ListItemButton
                        key={item.href}
                        component={Link}
                        href={item.href}
                        disableRipple
                        sx={{
                          borderRadius: 1,
                          mb: 0.25,
                          py: 0.85,
                          px: 2,
                          minHeight: 40,
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
                            minWidth: 32,
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
                                fontSize: 14,
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
                              height: 20,
                              fontSize: 10,
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
      <Box sx={{ px: 2, py: 2, borderTop: "1px solid #e6e8ec", position: "relative", zIndex: 1, bgcolor: "#ffffff" }}>
        <Box sx={{ mb: 1.5, px: 1.5, py: 1.1, borderRadius: 1, bgcolor: "#f5f6f8", border: "1px solid #e6e8ec" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
            <Box
              sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#1e7e45", boxShadow: "0 0 0 3px rgba(30,126,69,0.15)" }}
              className="animate-pulse-dot"
            />
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#1a1d21" }}>
              System Active
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11, color: "#5b6470" }}>
            Content engine online
          </Typography>
        </Box>
        <ListItemButton
          component="a"
          href="/api/auth/signout"
          disableRipple
          sx={{
            borderRadius: 1,
            py: 0.85,
            px: 2,
            minHeight: 40,
            color: "#363c44",
            borderLeft: "3px solid transparent",
            "&:hover": {
              bgcolor: "#fdebed",
              color: RED,
              borderLeftColor: RED,
              "& .MuiListItemIcon-root": { color: RED },
            },
            "& .MuiListItemIcon-root": { minWidth: 32, color: "#5b6470" },
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Sign out"
            slotProps={{
              primary: {
                sx: { fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em" },
              },
            }}
          />
        </ListItemButton>
      </Box>
    </Drawer>
  );
}

export { DRAWER_WIDTH };

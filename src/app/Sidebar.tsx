"use client";
import { usePathname } from "next/navigation";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
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
import PsychologyIcon from "@mui/icons-material/Psychology";
import PublicIcon from "@mui/icons-material/Public";
import HistoryIcon from "@mui/icons-material/History";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import LogoutIcon from "@mui/icons-material/Logout";
import Link from "next/link";

const DRAWER_WIDTH = 264;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  external?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Documentation for GDS",
    items: [
      { label: "Technical Roadmap", href: "/docs/technical-roadmap", icon: <DescriptionIcon fontSize="small" /> },
      { label: "Security Infrastructure", href: "/docs/security-infrastructure", icon: <SecurityIcon fontSize="small" /> },
    ],
  },
  {
    title: "Phase 1",
    items: [
      { label: "Personality", href: "/personality", icon: <PsychologyIcon fontSize="small" />, badge: "Brain" },
      { label: "Content Generation", href: "/content-generation", icon: <PublicIcon fontSize="small" />, badge: "Public" },
      { label: "Image Studio", href: "/photos", icon: <PhotoCameraIcon fontSize="small" />, badge: "AI" },
      { label: "Templates", href: "/templates", icon: <DashboardCustomizeIcon fontSize="small" /> },
      { label: "Logs", href: "/logs", icon: <HistoryIcon fontSize="small" /> },
    ],
  },
  {
    title: "Overview",
    items: [
      { label: "Mission Control", href: "/", icon: <DashboardIcon fontSize="small" /> },
      { label: "Analytics", href: "/analytics", icon: <BarChartIcon fontSize="small" /> },
    ],
  },
  {
    title: "SEO & Content",
    items: [
      { label: "SEO Command Center", href: "/seo", icon: <TravelExploreIcon fontSize="small" /> },
      { label: "Content Calendar", href: "/calendar", icon: <CalendarMonthIcon fontSize="small" /> },
      { label: "Content Studio", href: "/studio", icon: <EditNoteIcon fontSize="small" />, badge: "AI" },
    ],
  },
  {
    title: "Channels",
    items: [
      { label: "LinkedIn", href: "/linkedin", icon: <LinkedInIcon fontSize="small" /> },
      { label: "Newsletter", href: "/newsletter", icon: <NewspaperIcon fontSize="small" /> },
      { label: "Blog", href: "/blog", icon: <ArticleIcon fontSize="small" /> },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Knowledge Base", href: "/knowledge-base", icon: <MenuBookIcon fontSize="small" /> },
      { label: "Audit & Compliance", href: "/audit", icon: <SecurityIcon fontSize="small" /> },
      { label: "Settings", href: "/settings", icon: <SettingsIcon fontSize="small" /> },
    ],
  },
  {
    title: "Sister apps",
    items: [
      {
        label: "Pricing Hub",
        href: "https://apsopricinghub-production.up.railway.app/",
        icon: <RequestQuoteIcon fontSize="small" />,
        external: true,
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

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
          borderRight: "1px solid #ececec",
          position: "relative",
          overflow: "hidden",
        },
      }}
    >
      {/* ── Animated Background: flat Google-style compass ── */}
      <Box className="sidebar-bg">
        <Box className="sidebar-icon-bg sidebar-icon-compass">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="42" stroke="#274e64" strokeWidth="5" fill="none" />
            <circle cx="50" cy="50" r="34" stroke="#274e64" strokeWidth="2" fill="none" opacity="0.5" />
            <path
              d="M50 18 L58 50 L50 82 L42 50 Z"
              fill="#ed1b2f"
            />
            <circle cx="50" cy="50" r="4" fill="#274e64" />
          </svg>
        </Box>
      </Box>
      <Box className="sidebar-dots" />

      {/* Brand Header — animated marketing typography */}
      <Box
        sx={{
          px: 3,
          pt: 3.5,
          pb: 2.5,
          position: "relative",
          zIndex: 2,
          bgcolor: "#ffffff",
          borderBottom: "1px solid #ececec",
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
            sx={{
              fontSize: 22,
              color: "#3c4043",
              fontWeight: 400,
              ml: 0.25,
            }}
          >
            Marketing
          </Box>
          <Box
            component="span"
            className="brand-display"
            sx={{
              fontSize: 32,
              color: "#ed1b2f",
              fontWeight: 800,
              ml: 0.25,
            }}
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

      {/* Navigation Sections */}
      <Box sx={{ flex: 1, overflow: "auto", py: 0.5, position: "relative", zIndex: 1 }}>
        {navSections.map((section) => (
          <Box key={section.title} sx={{ mb: 0.5 }}>
            <Typography
              sx={{
                px: 3,
                pt: 2,
                pb: 0.75,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#3c4043",
              }}
            >
              {section.title}
            </Typography>
            <List dense disablePadding sx={{ px: 1.5, py: 0 }}>
              {section.items.map((item) => {
                const active = pathname === item.href;
                const externalProps = item.external
                  ? {
                      component: "a" as const,
                      href: item.href,
                      target: "_blank",
                      rel: "noopener noreferrer",
                    }
                  : {
                      component: Link,
                      href: item.href,
                    };
                return (
                  <ListItemButton
                    key={item.href}
                    {...externalProps}
                    disableRipple
                    sx={{
                      borderRadius: 999,
                      mb: 0.25,
                      py: 0.85,
                      px: 2,
                      minHeight: 40,
                      bgcolor: active ? "#e8f0f4" : "rgba(255,255,255,0.55)",
                      backdropFilter: "blur(6px)",
                      color: active ? "#1a3a4c" : "#3c4043",
                      transition: "background-color 0.2s ease, transform 0.2s ease",
                      "&:hover": {
                        bgcolor: active ? "#dbe7ed" : "rgba(255,255,255,0.92)",
                        transform: "translateX(2px)",
                      },
                      "& .MuiListItemIcon-root": {
                        color: active ? "#274e64" : "#5f6368",
                        minWidth: 32,
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
                            color: active ? "#1a3a4c" : "#3c4043",
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
                          bgcolor: active ? "#274e64" : "#ed1b2f",
                          color: "#fff",
                          ml: 0.5,
                        }}
                      />
                    )}
                    {item.external && (
                      <OpenInNewIcon
                        sx={{ fontSize: 14, color: "#5f6368", ml: 0.5, opacity: 0.7 }}
                      />
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Bottom Status + Sign out */}
      <Box sx={{ px: 2, py: 2, borderTop: "1px solid #ececec", position: "relative", zIndex: 1, bgcolor: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)" }}>
        <Box sx={{ px: 1, mb: 1.25 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
            <Box
              sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#34a853" }}
              className="animate-pulse-dot"
            />
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: "#1f1f1f" }}>
              Pipeline Active
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11, color: "#5f6368" }}>
            Draft-only mode enabled
          </Typography>
        </Box>
        <ListItemButton
          component="a"
          href="/api/auth/signout"
          disableRipple
          sx={{
            borderRadius: 999,
            py: 0.85,
            px: 2,
            minHeight: 40,
            color: "#3c4043",
            "&:hover": {
              bgcolor: "#fdebed",
              color: "#ed1b2f",
              "& .MuiListItemIcon-root": { color: "#ed1b2f" },
            },
            "& .MuiListItemIcon-root": {
              minWidth: 32,
              color: "#5f6368",
            },
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Sign out"
            slotProps={{
              primary: {
                sx: {
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "-0.005em",
                },
              },
            }}
          />
        </ListItemButton>
      </Box>
    </Drawer>
  );
}

export { DRAWER_WIDTH };

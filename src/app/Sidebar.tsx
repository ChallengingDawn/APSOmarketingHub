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
import SettingsIcon from "@mui/icons-material/Settings";
import Link from "next/link";

const DRAWER_WIDTH = 264;

interface NavSection {
  title: string;
  items: { label: string; href: string; icon: React.ReactNode; badge?: string }[];
}

const navSections: NavSection[] = [
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
      {/* ── Animated Background ── */}
      <Box className="sidebar-bg">
        <Box className="sidebar-blob sidebar-blob-1" />
        <Box className="sidebar-blob sidebar-blob-2" />
        <Box className="sidebar-blob sidebar-blob-3" />
      </Box>
      <Box className="sidebar-dots" />

      {/* Brand Header — animated marketing typography */}
      <Box
        sx={{
          px: 3,
          pt: 3.5,
          pb: 2.5,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
          <Box
            component="span"
            className="brand-display"
            sx={{
              fontSize: 22,
              color: "#1f1f1f",
            }}
          >
            APSO
          </Box>
          <Box
            component="span"
            className="brand-display"
            sx={{
              fontSize: 18,
              color: "#3c4043",
              fontWeight: 500,
            }}
          >
            Marketing
          </Box>
          <Box component="span" className="brand-hub-wrap">
            <Box
              component="span"
              className="brand-hub"
              sx={{ fontSize: 22 }}
            >
              Hub
            </Box>
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
                return (
                  <ListItemButton
                    key={item.href}
                    component={Link}
                    href={item.href}
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
                    <ListItemIcon>{item.icon}</ListItemIcon>
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
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Bottom Status */}
      <Box sx={{ px: 3, py: 2.5, borderTop: "1px solid #ececec", position: "relative", zIndex: 1, bgcolor: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)" }}>
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
    </Drawer>
  );
}

export { DRAWER_WIDTH };

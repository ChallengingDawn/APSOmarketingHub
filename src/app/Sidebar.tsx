"use client";
import { usePathname } from "next/navigation";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
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

const DRAWER_WIDTH = 270;

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
          borderRight: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      {/* Brand Header */}
      <Box sx={{ px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: "secondary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography sx={{ color: "#fff", fontWeight: 900, fontSize: 14, letterSpacing: 1 }}>AP</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: "text.primary", lineHeight: 1.2 }}>
            APSO Marketing Hub
          </Typography>
          <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 500 }}>
            apsoparts.com
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Navigation Sections */}
      <Box sx={{ flex: 1, overflow: "auto", py: 1 }}>
        {navSections.map((section) => (
          <Box key={section.title} sx={{ mb: 0.5 }}>
            <Typography
              sx={{
                px: 2.5,
                pt: 2,
                pb: 0.5,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "text.secondary",
                opacity: 0.6,
              }}
            >
              {section.title}
            </Typography>
            <List dense sx={{ px: 1.5, py: 0 }}>
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <ListItemButton
                    key={item.href}
                    component={Link}
                    href={item.href}
                    selected={active}
                    sx={{
                      borderRadius: 2,
                      mb: 0.25,
                      py: 0.75,
                      px: 1.5,
                      "&.Mui-selected": {
                        bgcolor: "primary.main",
                        color: "#fff",
                        "&:hover": { bgcolor: "primary.light" },
                        "& .MuiListItemIcon-root": { color: "#fff" },
                      },
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32, color: active ? "#fff" : "text.secondary" }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 600 : 500 }}
                    />
                    {item.badge && (
                      <Chip
                        label={item.badge}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: active ? "rgba(255,255,255,0.2)" : "secondary.main",
                          color: "#fff",
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

      {/* Bottom Section */}
      <Divider />
      <Box sx={{ p: 2, mx: 1, mb: 1, mt: 1, borderRadius: 2, bgcolor: "#f8f9fb" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "success.main" }} className="animate-pulse-dot" />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.primary" }}>Pipeline Active</Typography>
        </Box>
        <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
          Draft-only mode enabled
        </Typography>
      </Box>
    </Drawer>
  );
}

export { DRAWER_WIDTH };

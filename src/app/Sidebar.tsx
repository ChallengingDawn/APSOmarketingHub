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
import NewspaperIcon from "@mui/icons-material/Newspaper";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import FolderIcon from "@mui/icons-material/Folder";
import SettingsIcon from "@mui/icons-material/Settings";
import DashboardIcon from "@mui/icons-material/Dashboard";
import Link from "next/link";

const DRAWER_WIDTH = 260;

const navItems = [
  { label: "Dashboard", href: "/", icon: <DashboardIcon /> },
  { label: "LinkedIn", href: "/linkedin", icon: <LinkedInIcon /> },
  { label: "Newsletter", href: "/newsletter", icon: <NewspaperIcon /> },
  { label: "Content Base", href: "/content", icon: <FolderIcon /> },
  { label: "Settings", href: "/settings", icon: <SettingsIcon /> },
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
          bgcolor: "background.paper",
        },
      }}
    >
      <Box sx={{ px: 3, py: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 0.5 }}>
            Angst+Pfister
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, color: "secondary.main", letterSpacing: 0.5 }}>
            APSO
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Marketing Hub
        </Typography>
      </Box>

      <Divider />

      <List sx={{ px: 1, py: 1 }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={active}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "#fff",
                  "&:hover": { bgcolor: "primary.light" },
                  "& .MuiListItemIcon-root": { color: "#fff" },
                },
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: active ? "#fff" : "text.secondary" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}

export { DRAWER_WIDTH };

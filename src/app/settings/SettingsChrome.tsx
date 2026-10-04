"use client";
// The Settings app's heading.
//
// The sections used to be a tab bar here as well as groups in the sidebar, which
// meant two menus for one app and two places showing which section you were in.
// The sidebar owns that now; this is the title and nothing else.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const INK = "#15223a";
const MUTED = "#5d6b85";

export default function SettingsChrome({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, pt: { xs: 2.5, md: 3.5 } }}>
        <Typography component="h1" sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontWeight: 600, color: INK, letterSpacing: "-0.035em",
          fontSize: { xs: "1.9rem", md: "2.3rem" }, lineHeight: 1.05,
        }}>Settings</Typography>
        <Typography sx={{ fontSize: "0.95rem", color: MUTED, mt: 0.5 }}>
          Your account, your team, and workspace access.
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

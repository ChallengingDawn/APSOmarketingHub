"use client";
// PREFERENCES — what you can change about your own hub.
//
// One thing is real: your quick links, kept against your account so they follow
// you between machines. The rest is named rather than drawn, because a control
// that saves nothing reads as a promise.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinkIcon from "@mui/icons-material/Link";
import TranslateIcon from "@mui/icons-material/Translate";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import QuickLinks from "@/app/QuickLinks";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";

const glass = {
  bgcolor: "rgba(255,255,255,.72)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.8)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
};

/** Named, with the reason each is not a control yet. */
const NOT_YET = [
  {
    name: "Language", icon: <TranslateIcon />,
    why: "The hub is English throughout. A chooser would need every screen translated first.",
  },
  {
    name: "Light and dark", icon: <DarkModeOutlinedIcon />,
    why: "One palette exists. A switch would need a second one designed, not just inverted.",
  },
  {
    name: "Notifications", icon: <NotificationsNoneIcon />,
    why: "The hub sends nothing. There is a mailer now, so this is the next one that can become real.",
  },
  {
    name: "Default reporting window", icon: <CalendarMonthIcon />,
    why: "The window you pick is remembered in this browser, not on your account, so it does not follow you.",
  },
];

export default function Preferences() {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1000 }}>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: "11px", display: "grid", placeItems: "center",
            bgcolor: "#e9eef5", color: "#4a5a70", "& svg": { fontSize: 19 },
          }}><LinkIcon /></Box>
          <Box>
            <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
              Your quick links
            </Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
              The same set that sits on the home screen. Kept against your account, so they follow you.
            </Typography>
          </Box>
        </Box>
        <QuickLinks glass={glass} />
      </Box>

      <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
        <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
          Not built yet
        </Typography>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.25, mb: 2 }}>
          Listed so the gap is visible rather than discovered. None of these is a control that quietly does
          nothing.
        </Typography>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" } }}>
          {NOT_YET.map((n) => (
            <Box key={n.name} sx={{
              display: "flex", gap: 1.5, p: 1.75, borderRadius: "16px",
              bgcolor: "rgba(255,255,255,.55)", border: `1px solid ${HAIRLINE}`,
            }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center",
                bgcolor: "#eef1f5", color: FAINT, flexShrink: 0, "& svg": { fontSize: 18 },
              }}>{n.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>{n.name}</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.45 }}>{n.why}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

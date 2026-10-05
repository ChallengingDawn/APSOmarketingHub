"use client";
// NOTIFICATIONS — its own place in Settings.
//
// It was a card at the bottom of Preferences, which is where a feature goes to
// be missed. It is the only thing in the hub that reaches you when you are not
// looking at it, so it gets a page, and the page is a LIST: one row per thing
// the hub could tell you, each with its own switch.
//
// Only one of them is built. The rest are named here, plainly, so the shape is
// obvious when the second one arrives — and so nobody switches on something
// that does not exist.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MailOutlineIcon from "@mui/icons-material/MailOutline";

import Notifications from "./Notifications";

const INK = "#15223a";
const MUTED = "#5d6b85";

const glass = {
  bgcolor: "rgba(255,255,255,.72)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.8)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
};

export default function NotificationsPage() {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1000 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: "11px", display: "grid", placeItems: "center",
          bgcolor: "#e6edfd", color: "#2459d1", "& svg": { fontSize: 19 },
        }}><MailOutlineIcon /></Box>
        <Box>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Notifications
          </Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
            The only way the hub reaches you when you are not looking at it.
          </Typography>
        </Box>
      </Box>

      <Notifications glass={glass} />
    </Box>
  );
}

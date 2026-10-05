"use client";
// PREFERENCES — what you can change about your own hub.
//
// Everything on this page is real and saved against the account rather than the
// browser, so it follows you between machines: your quick links and your home
// screen. Mail has its own page — it is the one thing that reaches you when you
// are not looking at the hub, which is not a card at the bottom of something.
//
// The list of gaps that used to sit at the bottom is gone, and so are the gaps
// — except light and dark, which SARCLA does not want, so it is not named as a
// shortcoming either.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinkIcon from "@mui/icons-material/Link";

import QuickLinks from "@/app/QuickLinks";
import HomeScreen from "./HomeScreen";

const INK = "#15223a";
const MUTED = "#5d6b85";

const glass = {
  bgcolor: "rgba(255,255,255,.72)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.8)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
};

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

      <HomeScreen glass={glass} />

    </Box>
  );
}

"use client";
// THE LOOK OF THE DOOR.
//
// Sign in, the authenticator, the code, a forgotten password — four pages that
// people meet before anything else, so they are one card and one wordmark rather
// than four variations on the old Marketing Hub login. Kept here because a page
// file in the App Router should export its page and little else.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { Wordmark } from "./Wordmark";

export const INK = "#15223a";
export const MUTED = "#5d6b85";
export const FAINT = "#8b97ac";
export const ACCENT = "#2459d1";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{
      minHeight: "100vh", display: "grid", placeItems: "center", px: 2, py: 6,
      background:
        "radial-gradient(110% 80% at 8% 0%, #efe6fb 0%, transparent 55%)," +
        "radial-gradient(90% 70% at 92% 6%, #ffe8ef 0%, transparent 52%)," +
        "radial-gradient(90% 80% at 70% 100%, #e3f4fb 0%, transparent 55%), #f7f8fb",
    }}>
      <Box sx={{
        width: "100%", maxWidth: 420, p: { xs: 3, md: 4 }, borderRadius: "24px",
        bgcolor: "rgba(255,255,255,.84)", backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,.85)",
        boxShadow: "0 2px 6px rgba(31,45,78,.06), 0 20px 48px rgba(31,45,78,.12)",
      }}>
        <Box sx={{ mb: 3 }}><Wordmark size={28} /></Box>
        {children}
      </Box>
    </Box>
  );
}

/** Six digits, spaced so they read as a code rather than a number. */
export const codeField = {
  fontSize: "1.4rem", letterSpacing: "0.4em", textAlign: "center" as const,
  fontFamily: "ui-monospace, monospace",
};

/**
 * White on this blue is 6.1:1. The disabled pair is the part that was wrong:
 * a 35%-alpha blue took MUI's own grey disabled text, which left "Continue"
 * barely readable on it. Grey on grey now — 4.5:1, and unmistakably off.
 *
 * The extra .MuiButton-root raises specificity above MUI's disabled rule, so
 * the colour below is the one that paints whatever variant the button is.
 */
export const primaryButton = {
  textTransform: "none" as const, borderRadius: "12px", fontWeight: 600, py: 1.1,
  bgcolor: ACCENT, color: "#fff", boxShadow: "none",
  "&:hover": { bgcolor: "#1c47a8", boxShadow: "none" },
  "&.MuiButton-root.Mui-disabled": { bgcolor: "#e7ebf3", color: "#5d6b85" },
  "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
};

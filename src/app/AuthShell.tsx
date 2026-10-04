"use client";
// THE LOOK OF THE DOOR.
//
// Sign in, the authenticator, the code, a forgotten password — four pages that
// people meet before anything else, so they are one card and one wordmark rather
// than four variations on the old Marketing Hub login. Kept here because a page
// file in the App Router should export its page and little else.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export const INK = "#15223a";
export const MUTED = "#5d6b85";
export const FAINT = "#8b97ac";
export const ACCENT = "#2459d1";

export function Wordmark() {
  return (
    <Box sx={{ display: "grid", lineHeight: 1, mb: 3 }}>
      {/* One word. A space made it read as two products sharing a header. */}
      <Box sx={{ display: "flex", alignItems: "baseline" }}>
        <Box component="span" sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: INK,
        }}>APSO</Box>
        <Box component="span" sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em",
          background: "linear-gradient(95deg,#3b82f6,#8b5cf6)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          // The painted box has to be wider than the glyphs or the b is clipped.
          display: "inline-block", paddingRight: "6px", marginRight: "-4px",
        }}>hub</Box>
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.4 }}>apsoparts.com</Typography>
    </Box>
  );
}

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
        <Wordmark />
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

export const primaryButton = {
  textTransform: "none" as const, borderRadius: "12px", fontWeight: 600, py: 1.1,
  bgcolor: ACCENT, color: "#fff", boxShadow: "none",
  "&:hover": { bgcolor: "#1c47a8", boxShadow: "none" },
  "&.Mui-disabled": { bgcolor: "rgba(36,89,209,.35)", color: "#fff" },
};

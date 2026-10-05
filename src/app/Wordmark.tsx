"use client";
// THE HUB'S NAME, IN ONE PLACE.
//
// It was set three different ways — Outfit 800 with tight negative tracking on
// the launch pad, the same on the sign-in card, and a stretched animated version
// in the sidebar. Three hands, one product.
//
// The look is taken from venceslauarquitetos.pt, which SARCLA pointed at: the
// SAME typeface the hub already loads, Outfit, but at 200–300 instead of 700–800
// and with wide positive tracking instead of negative. Light and airy rather than
// heavy and tight. Nothing new to download; the family was always capable of it,
// it was being asked for the wrong thing.
//
// Uppercase, because at 0.3em tracking lowercase letters drift apart into
// separate objects while capitals hold a line.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function Wordmark({ size = 26, subtitle = "apsoparts.com", align = "start" }: {
  size?: number;
  /** The small line underneath. Pass null where there is no room. */
  subtitle?: string | null;
  align?: "start" | "center";
}) {
  const type = {
    fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
    fontSize: size,
    fontWeight: 300,
    letterSpacing: "0.3em",
    lineHeight: 1.1,
  } as const;

  return (
    <Box sx={{ display: "grid", justifyItems: align, lineHeight: 1 }}>
      {/* The tracking adds a gap after the final letter; pulling it back keeps
          the mark optically flush with whatever sits under it. */}
      <Box sx={{ display: "flex", alignItems: "baseline", mr: "-0.3em" }}>
        <Box component="span" sx={{ ...type, color: "#15223a" }}>APSO</Box>
        <Box component="span" sx={{
          ...type,
          background: "linear-gradient(95deg,#3b82f6,#8b5cf6)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          // A painted box wider than the glyphs, or the gradient clips the H.
          display: "inline-block", paddingRight: "0.1em",
        }}>HUB</Box>
      </Box>
      {subtitle && (
        <Typography sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: Math.max(9, Math.round(size * 0.3)),
          fontWeight: 300, letterSpacing: "0.16em", textTransform: "uppercase",
          color: "#8b97ac", mt: 0.6,
        }}>{subtitle}</Typography>
      )}
    </Box>
  );
}

"use client";
// THE HUB'S NAME, IN ONE PLACE.
//
// It was set three different ways — Outfit 800 with tight negative tracking on
// the launch pad, the same on the sign-in card, and a stretched animated version
// in the sidebar. Three hands, one product.
//
// SARCLA picked the original from six side by side: Outfit at 800, mixed case,
// letters pulled tight. Two rounds of lighter, wider, uppercase settings — taken
// from venceslauarquitetos.pt, which he had pointed at — were both wrong, and
// what he actually meant by "the font" was the body text everywhere else, not
// the mark.
//
// It stays ONE component, which was the other half worth keeping: it had been
// set three ways, including a stretched red version in the sidebar whose letters
// cycled through colours on a nine-second loop.

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
    lineHeight: 1.1,
  } as const;

  return (
    <Box sx={{ display: "grid", justifyItems: align, lineHeight: 1 }}>
      {/* No gap: it is APSOhub, one word. A space made it read as two products
          sharing a header. */}
      <Box sx={{ display: "flex", alignItems: "baseline" }}>
        <Box component="span" sx={{ ...type, fontWeight: 800, letterSpacing: "-0.03em", color: "#15223a" }}>APSO</Box>
        <Box component="span" sx={{
          ...type, fontWeight: 700, letterSpacing: "-0.01em",
          background: "linear-gradient(95deg,#3b82f6,#8b5cf6)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          // A painted box wider than the glyphs, or the gradient clips the b.
          display: "inline-block", paddingRight: "6px", marginRight: "-4px",
        }}>hub</Box>
      </Box>
      {subtitle && (
        <Typography sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: Math.max(10, Math.round(size * 0.26)),
          color: "#8b97ac", mt: 0.3,
        }}>{subtitle}</Typography>
      )}
    </Box>
  );
}

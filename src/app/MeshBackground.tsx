"use client";
// THE PASTEL MESH.
//
// Four soft fields on their own slow paths. It is behind the front page and
// behind every app screen, so the hub is one surface rather than a colourful
// door onto a grey room — and the glass panels on top have something to be
// glass over. Flat grey under frosted glass just looks like a faint border.
//
// Fixed and pointer-transparent, so it never scrolls, never intercepts a click
// and costs nothing in layout. It stops moving for anyone whose system asks for
// less motion.

import Box from "@mui/material/Box";

export const MESH_BASE = "#f7f8fc";

export default function MeshBackground() {
  return (
    <Box aria-hidden sx={{
      position: "fixed", inset: "-18%", zIndex: 0, pointerEvents: "none", filter: "blur(10px)",
      "@keyframes meshA": {
        "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
        "50%": { transform: "translate3d(6%,4%,0) scale(1.12)" },
      },
      "@keyframes meshB": {
        "0%,100%": { transform: "translate3d(0,0,0) scale(1.05)" },
        "50%": { transform: "translate3d(-7%,5%,0) scale(.95)" },
      },
      "@keyframes meshC": {
        "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
        "50%": { transform: "translate3d(4%,-6%,0) scale(1.1)" },
      },
      "& > span": { position: "absolute", borderRadius: "50%", display: "block" },
      "@media (prefers-reduced-motion: reduce)": { "& > span": { animation: "none !important" } },
    }}>
      <Box component="span" sx={{
        width: "58%", height: "62%", left: "-6%", top: "-8%",
        background: "radial-gradient(circle, rgba(196,181,253,.62), transparent 68%)",
        animation: "meshA 26s ease-in-out infinite",
      }} />
      <Box component="span" sx={{
        width: "52%", height: "58%", right: "-8%", top: "-4%",
        background: "radial-gradient(circle, rgba(251,207,232,.60), transparent 68%)",
        animation: "meshB 31s ease-in-out infinite",
      }} />
      <Box component="span" sx={{
        width: "60%", height: "60%", right: "4%", bottom: "-14%",
        background: "radial-gradient(circle, rgba(165,216,243,.58), transparent 68%)",
        animation: "meshC 29s ease-in-out infinite",
      }} />
      <Box component="span" sx={{
        width: "46%", height: "52%", left: "4%", bottom: "-10%",
        background: "radial-gradient(circle, rgba(167,233,202,.52), transparent 68%)",
        animation: "meshA 35s ease-in-out infinite reverse",
      }} />
    </Box>
  );
}

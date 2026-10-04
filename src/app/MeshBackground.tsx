"use client";
// THE PASTEL MESH.
//
// Four soft fields on their own slow paths, behind the front page and behind
// every app screen, so the hub is one surface rather than a colourful door onto
// a grey room — and the frosted panels have something to be glass over.
//
// Two strengths, because the same wash cannot do both jobs. The front page is
// almost entirely covered by cards, so the colour only shows at the edges and
// can afford to be seen. An app screen is mostly empty below its content, where
// the wash is the whole lower half of the window: at full strength it stops
// being a background and starts being the page.
//
// The hues are deliberately desaturated — a saturated lavender behind a table of
// customer names competes with the names.
//
// Fixed and pointer-transparent, so it never scrolls, never intercepts a click
// and costs nothing in layout. It stops moving under prefers-reduced-motion.

import Box from "@mui/material/Box";

export const MESH_BASE = "#f7f8fb";

type Field = { w: string; h: string; pos: object; rgb: string; alpha: number; anim: string };

const FIELDS: Field[] = [
  // Lavender, pulled well back towards grey: it was the one that shouted.
  { w: "58%", h: "62%", pos: { left: "-6%", top: "-8%" }, rgb: "201,198,226", alpha: 0.50, anim: "meshA 26s ease-in-out infinite" },
  { w: "52%", h: "58%", pos: { right: "-8%", top: "-4%" }, rgb: "238,214,224", alpha: 0.46, anim: "meshB 31s ease-in-out infinite" },
  { w: "60%", h: "60%", pos: { right: "4%", bottom: "-14%" }, rgb: "191,215,233", alpha: 0.46, anim: "meshC 29s ease-in-out infinite" },
  { w: "46%", h: "52%", pos: { left: "4%", bottom: "-10%" }, rgb: "198,224,209", alpha: 0.40, anim: "meshA 35s ease-in-out infinite reverse" },
];

/** How much of it to show. `quiet` is for screens with real content on them. */
export type MeshStrength = "full" | "quiet";

const SCALE: Record<MeshStrength, number> = { full: 1, quiet: 0.42 };

export default function MeshBackground({ strength = "full" }: { strength?: MeshStrength }) {
  const k = SCALE[strength];
  return (
    <Box aria-hidden sx={{
      position: "fixed", inset: "-18%", zIndex: 0, pointerEvents: "none", filter: "blur(12px)",
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
      {FIELDS.map((f, i) => (
        <Box key={i} component="span" sx={{
          width: f.w, height: f.h, ...f.pos,
          background: `radial-gradient(circle, rgba(${f.rgb},${(f.alpha * k).toFixed(3)}), transparent 68%)`,
          animation: f.anim,
        }} />
      ))}
    </Box>
  );
}

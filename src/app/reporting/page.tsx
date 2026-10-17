"use client";
// ADVANCED REPORTING - every report in the hub, by team (SARCLA, 11.10.2026).
//
// A front door like the launch pad, and like it with no side panel (SARCLA:
// "should not display side bar until you first got in"): a tile per category
// with the reports this person may open, and the panel only once you are in a
// report. A category with nothing in it yet says what its first report will be,
// in one line.
//
// SARCLA, 16.10.2026: "keep the header like it was a second home page" - the
// front page's own bar (src/app/HomeBar.tsx) instead of an "All apps" link, a
// smaller title under it, and every tile the same size; later the same day the
// tiles became small cards without their report lists, and the line under the
// title went.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { HomeBar } from "@/app/HomeBar";
import { REPORT_CATEGORIES } from "@/lib/reporting/categories";
import { useCanOpen } from "./useCanOpen";
import { CategoryTile, INK, riseKeyframes } from "./ui";

export default function AdvancedReporting() {
  const canOpen = useCanOpen();
  return (
    <Box sx={{ maxWidth: 1480, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, ...riseKeyframes }}>
      <HomeBar />

      {/* The name alone (SARCLA 16.10: the line "Every report in the hub, by team." goes). */}
      <Typography component="h1" sx={{
        mt: { xs: 2, md: 3 },
        fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
        fontSize: { xs: "1.45rem", md: "1.75rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK, lineHeight: { xs: "30px", md: "34px" },
      }}>Advanced reporting</Typography>

      {/* Tiles all the same size, every row as tall as the tallest. SARCLA 17.10:
          "bigger the tiles, it's too small now" - three across from a laptop up (the
          nine categories make a square), two on a tablet, one on a phone. */}
      <Box sx={{
        display: "grid", gap: { xs: 1.5, md: 2 }, alignItems: "stretch", mt: { xs: 1.75, md: 2.25 },
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
        gridAutoRows: "1fr",
      }}>
        {REPORT_CATEGORIES.map((c, i) => (
          <CategoryTile key={c.slug} c={c} reports={c.reports.filter((r) => canOpen(r.href))} i={i} />
        ))}
      </Box>
    </Box>
  );
}

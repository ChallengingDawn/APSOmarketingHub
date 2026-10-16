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
        mt: { xs: 2, md: 2.5 },
        fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
        fontSize: { xs: "1.3rem", md: "1.45rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK, lineHeight: "28px",
      }}>Advanced reporting</Typography>

      {/* Small tiles, all the same size (SARCLA 16.10): as many as fit across
          at 240 px or more - five on a wide screen - and every row as tall as the
          tallest. On a phone, two across. */}
      <Box sx={{
        display: "grid", gap: 1.5, alignItems: "stretch", mt: { xs: 1.5, md: 1.75 },
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(auto-fill, minmax(240px, 1fr))" },
        gridAutoRows: "1fr",
      }}>
        {REPORT_CATEGORIES.map((c, i) => (
          <CategoryTile key={c.slug} c={c} reports={c.reports.filter((r) => canOpen(r.href))} i={i} />
        ))}
      </Box>
    </Box>
  );
}

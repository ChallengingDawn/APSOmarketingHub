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
// smaller title under it, and every tile the same size.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { HomeBar } from "@/app/HomeBar";
import { REPORT_CATEGORIES } from "@/lib/reporting/categories";
import { useCanOpen } from "./useCanOpen";
import { CategoryTile, INK, MUTED, riseKeyframes } from "./ui";

export default function AdvancedReporting() {
  const canOpen = useCanOpen();
  return (
    <Box sx={{ maxWidth: 1480, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, ...riseKeyframes }}>
      <HomeBar />

      <Box sx={{ mt: { xs: 2, md: 2.5 }, display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap" }}>
        <Typography component="h1" sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: { xs: "1.3rem", md: "1.45rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK, lineHeight: "28px",
        }}>Advanced reporting</Typography>
        <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>Every report in the hub, by team.</Typography>
      </Box>

      {/* Eight categories: two even rows of four on a wide screen, never a row
          of three with two left over - and every row as tall as the tallest, so
          all eight tiles are the same size. On a phone, one column at its own
          height. */}
      <Box sx={{
        display: "grid", gap: 2, alignItems: "stretch", mt: { xs: 1.75, md: 2 },
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        gridAutoRows: { xs: "auto", sm: "1fr" },
        "@media (min-width:1280px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
      }}>
        {REPORT_CATEGORIES.map((c, i) => (
          <CategoryTile key={c.slug} c={c} reports={c.reports.filter((r) => canOpen(r.href))} i={i} />
        ))}
      </Box>
    </Box>
  );
}

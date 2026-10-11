"use client";
// ADVANCED REPORTING - every report in the hub, by team (SARCLA, 11.10.2026).
//
// A front door like the launch pad, and like it with no side panel (SARCLA:
// "should not display side bar until you first got in"): a tile per category
// with the reports this person may open, and the panel only once you are in a
// category or a report. A category with nothing in it yet says what its first
// report will be, in one line.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

import { REPORT_CATEGORIES } from "@/lib/reporting/categories";
import { useCanOpen } from "./useCanOpen";
import { CategoryTile, INK, MUTED, focusRing, riseKeyframes } from "./ui";

export default function AdvancedReporting() {
  const canOpen = useCanOpen();
  return (
    <Box sx={{ maxWidth: 1480, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, ...riseKeyframes }}>
      {/* The way back out, since there is no panel to carry it. */}
      <Box component={Link} href="/" sx={{
        display: "inline-flex", alignItems: "center", gap: 0.25, textDecoration: "none", color: MUTED,
        fontSize: "0.85rem", fontWeight: 500, ...focusRing, "&:hover": { color: INK },
      }}>
        <ChevronLeftIcon sx={{ fontSize: 20 }} /> All apps
      </Box>

      <Box sx={{ mt: { xs: 1.5, md: 2 } }}>
        <Typography component="h1" sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: { xs: "1.7rem", md: "2rem" }, fontWeight: 600, letterSpacing: "-0.03em", color: INK, lineHeight: 1.1,
        }}>Advanced reporting</Typography>
        <Typography sx={{ fontSize: "0.95rem", color: MUTED, mt: 0.75 }}>Every report in the hub, by team.</Typography>
      </Box>

      {/* Eight categories: two even rows of four on a wide screen, never a
          row of three with two left over. */}
      <Box sx={{
        display: "grid", gap: 2, alignItems: "stretch", mt: { xs: 2.5, md: 3 },
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        "@media (min-width:1280px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
      }}>
        {REPORT_CATEGORIES.map((c, i) => (
          <CategoryTile key={c.slug} c={c} reports={c.reports.filter((r) => canOpen(r.href))} i={i} />
        ))}
      </Box>
    </Box>
  );
}

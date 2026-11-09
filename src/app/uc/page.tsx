"use client";
// UC & HUBSPOT APPS - its front page, a tile per section (SARCLA 06.11.2026: "transform the HubSpot app into a website
// look-alike, where each main topic is a main app and then drill down": UC's, HubSpot Apps, One-shot actions). A door
// like Website's, and like it with no side panel until you are in a section (AppShell). The sections and their pages
// are UC_SECTIONS in hubApps.ts, the one list.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { HomeBar } from "@/app/HomeBar";
import { UC_SECTIONS } from "@/app/hubApps";
import { useReportAccess } from "@/app/reporting/useCanOpen";
import { INK, MUTED, riseKeyframes } from "@/app/reporting/ui";
import { SectionTile } from "@/app/website/ui";

export default function UcFront() {
  const { canOpen, ready } = useReportAccess();
  // a section with a page of theirs - and nothing until their access is read
  const shown = ready ? UC_SECTIONS.filter((s) => !s.pages.length || s.pages.some((p) => canOpen(p.href))) : [];
  return (
    <Box sx={{ maxWidth: 1480, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, ...riseKeyframes }}>
      <HomeBar />

      <Typography component="h1" sx={{
        mt: { xs: 2, md: 3 },
        fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
        fontSize: { xs: "1.45rem", md: "1.75rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK, lineHeight: { xs: "30px", md: "34px" },
      }}>UC &amp; HubSpot Apps</Typography>
      <Typography sx={{ mt: 0.5, fontSize: { xs: "0.9rem", md: "0.98rem" }, color: MUTED }}>
        The use cases, the HubSpot workflows the hub runs, the one-shot pushes and the translator.
      </Typography>

      <Box sx={{
        display: "grid", gap: { xs: 1.5, md: 2 }, alignItems: "stretch", mt: { xs: 1.75, md: 2.25 },
        // one row on a wide screen: four sections since APSO Translator became one (09.11.2026)
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: `repeat(${Math.min(4, Math.max(3, shown.length))}, minmax(0, 1fr))` },
        gridAutoRows: "1fr",
      }}>
        {shown.map((s, i) => <SectionTile key={s.slug} s={s} canOpen={canOpen} i={i} base="/uc" />)}
      </Box>
    </Box>
  );
}

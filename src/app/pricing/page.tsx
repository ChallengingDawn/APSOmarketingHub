"use client";
// PRICING - its front page, a tile per section (SARCLA 14.11.2026: "split the internal apps and create a menu before, like
// we do in website or content"): Pricing intelligence, Product matching, Purchasing, Data sources. A door like Website's
// and Marketing & Content's, and like them with no side panel until you are in a section (AppShell). The sections and
// their pages are PRICING_SECTIONS in hubApps.ts, the one list.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { HomeBar } from "@/app/HomeBar";
import { PRICING_SECTIONS } from "@/app/hubApps";
import { useReportAccess } from "@/app/reporting/useCanOpen";
import { INK, MUTED, riseKeyframes } from "@/app/reporting/ui";
import { SectionTile } from "@/app/website/ui";

export default function PricingFront() {
  const { canOpen, ready } = useReportAccess();
  // a section with a page of theirs - and nothing until their access is read
  const shown = ready ? PRICING_SECTIONS.filter((s) => s.pages.some((p) => canOpen(p.href))) : [];
  return (
    <Box sx={{ maxWidth: 1480, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, ...riseKeyframes }}>
      <HomeBar />

      <Typography component="h1" sx={{
        mt: { xs: 2, md: 3 },
        fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
        fontSize: { xs: "1.45rem", md: "1.75rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK, lineHeight: { xs: "30px", md: "34px" },
      }}>Pricing</Typography>
      <Typography sx={{ mt: 0.5, fontSize: { xs: "0.9rem", md: "0.98rem" }, color: MUTED }}>
        Our prices against the competitors&apos;, the matches behind them, the suppliers&apos; prices, and where it all comes from.
      </Typography>

      <Box sx={{
        display: "grid", gap: { xs: 1.5, md: 2 }, alignItems: "stretch", mt: { xs: 1.75, md: 2.25 },
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
        gridAutoRows: "1fr",
      }}>
        {shown.map((s, i) => <SectionTile key={s.slug} s={s} canOpen={canOpen} i={i} base="/pricing" />)}
      </Box>
    </Box>
  );
}

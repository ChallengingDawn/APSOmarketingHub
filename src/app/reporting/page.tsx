"use client";
// ADVANCED REPORTING - every report in the hub, by team (SARCLA, 11.10.2026).
// One card per category with the reports this person may open; a category with
// nothing in it yet says what its first report will be, in one line.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InsightsIcon from "@mui/icons-material/Insights";

import PageHeader from "@/app/PageHeader";
import { GlassCard, INK, MUTED } from "@/app/uc/report/ui";
import { REPORT_CATEGORIES } from "@/lib/reporting/categories";
import { useCanOpen } from "./useCanOpen";

export default function AdvancedReporting() {
  const canOpen = useCanOpen();
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5 }}>
      <PageHeader title="Advanced reporting" subtitle="Every report in the hub, by team" />
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1fr 1fr" } }}>
        {REPORT_CATEGORIES.map((c) => ({ c, reports: c.reports.filter((r) => canOpen(r.href)) })).map(({ c, reports }) => (
          <GlassCard key={c.slug} sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
            <Link href={`/reporting/${c.slug}`} style={{ textDecoration: "none" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <InsightsIcon sx={{ fontSize: 20, color: "#1f6fa8" }} />
                <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{c.name}</Typography>
              </Box>
            </Link>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{c.line}</Typography>
            {reports.length ? (
              <Box sx={{ display: "grid", gap: 0.5 }}>
                {reports.map((r) => (
                  <Link key={r.href} href={r.href} style={{ textDecoration: "none" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 0.6, px: 1, borderRadius: 1.5,
                      "&:hover": { bgcolor: "rgba(31,111,168,.07)" } }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: "#1f6fa8" }}>{r.name}</Typography>
                      <Typography sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right" }}>{r.note}</Typography>
                    </Box>
                  </Link>
                ))}
              </Box>
            ) : (
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontStyle: "italic" }}>
                {c.reports.length ? "Not opened to you - an admin can grant it." : c.next}
              </Typography>
            )}
          </GlassCard>
        ))}
      </Box>
    </Box>
  );
}

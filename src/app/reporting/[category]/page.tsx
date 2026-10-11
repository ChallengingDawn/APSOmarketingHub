"use client";
// One category of Advanced reporting: the reports this person may open, or -
// while it has none - the one line naming its first. Categories come from
// src/lib/reporting/categories.ts.

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import PageHeader from "@/app/PageHeader";
import { GlassCard, INK, MUTED } from "@/app/uc/report/ui";
import { categoryBySlug } from "@/lib/reporting/categories";
import { useCanOpen } from "../useCanOpen";

export default function ReportCategory() {
  const { category } = useParams<{ category: string }>();
  const c = categoryBySlug(category);
  const canOpen = useCanOpen();
  if (!c) notFound();
  const reports = c.reports.filter((r) => canOpen(r.href));
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 980 }}>
      <PageHeader title={c.name} subtitle={c.line} />
      {reports.length ? (
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {reports.map((r) => (
            <Link key={r.href} href={r.href} style={{ textDecoration: "none" }}>
              <GlassCard sx={{ "&:hover": { boxShadow: "0 6px 24px rgba(31,111,168,.12)" } }}>
                <Typography sx={{ fontSize: "0.98rem", fontWeight: 700, color: INK }}>{r.name}</Typography>
                <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 0.5 }}>{r.note}</Typography>
              </GlassCard>
            </Link>
          ))}
        </Box>
      ) : (
        <GlassCard>
          <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>
            {c.reports.length ? "These reports are not opened to you - an admin can grant them." : `No report here yet. ${c.next}`}
          </Typography>
        </GlassCard>
      )}
    </Box>
  );
}

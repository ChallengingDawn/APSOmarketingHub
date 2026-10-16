"use client";
// One category of Advanced reporting. A category with reports is a doorway, not
// a page: it sends you straight into its first report (SARCLA, 16.10.2026: "when
// I click a report I should not enter this view, I should go directly to In a
// nutshell") - so the launch pad, the landing tiles and the side panel's category
// link all land in the report. Only a category with no report yet (or none this
// person may open) stays, and says what comes first. Categories come from
// src/lib/reporting/categories.ts; the look is the launch pad's (./ui.tsx).

import { useEffect } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import HubIconGlyph from "@/app/HubIcon";
import { categoryBySlug, categoryEntry } from "@/lib/reporting/categories";
import { useReportAccess } from "../useCanOpen";
import { FAINT, INK, MUTED, glass, riseKeyframes, toneOf } from "../ui";

export default function ReportCategory() {
  const { category } = useParams<{ category: string }>();
  const router = useRouter();
  const c = categoryBySlug(category);
  const { canOpen, ready } = useReportAccess();
  const reports = c ? c.reports.filter((r) => canOpen(r.href)) : [];
  const go = c && ready && reports.length ? categoryEntry(c, canOpen) : null;
  useEffect(() => { if (go) router.replace(go); }, [go, router]);
  if (!c) notFound();
  // on the way into the first report: nothing to draw
  if (!ready || reports.length) return null;

  const tone = toneOf(c.slug);
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1080, ...riseKeyframes }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
        <Box sx={{
          width: 52, height: 52, borderRadius: "16px", flexShrink: 0, display: "grid", placeItems: "center",
          background: `linear-gradient(140deg, ${tone.fg}b3, ${tone.fg})`, color: "#fff", boxShadow: `0 10px 22px ${tone.tint}`,
        }}><HubIconGlyph name={tone.icon} fontSize={27} /></Box>
        <Box>
          <Typography component="h1" sx={{
            fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
            fontSize: { xs: "1.5rem", md: "1.75rem" }, fontWeight: 600, letterSpacing: "-0.03em", color: INK, lineHeight: 1.1,
          }}>{c.name}</Typography>
          <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: 0.5 }}>{c.line}</Typography>
        </Box>
      </Box>

      <Box sx={{ ...glass, borderRadius: "18px", p: 2.25, background: `linear-gradient(170deg, ${tone.tint}, rgba(255,255,255,.64) 58%)` }}>
        <Typography sx={{ fontSize: "0.9rem", color: FAINT, lineHeight: 1.5 }}>
          {c.reports.length ? "These reports are not opened to you - an admin can grant them." : `No report here yet. ${c.next}`}
        </Typography>
      </Box>
    </Box>
  );
}

"use client";
// One category of Advanced reporting: the reports this person may open, or -
// while it has none - the one line naming its first. Categories come from
// src/lib/reporting/categories.ts; the look is the launch pad's (./ui.tsx).

import { notFound, useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import HubIconGlyph from "@/app/HubIcon";
import { categoryBySlug } from "@/lib/reporting/categories";
import { useCanOpen } from "../useCanOpen";
import { FAINT, INK, MUTED, ReportRow, glass, riseKeyframes, toneOf } from "../ui";

export default function ReportCategory() {
  const { category } = useParams<{ category: string }>();
  const c = categoryBySlug(category);
  const canOpen = useCanOpen();
  if (!c) notFound();
  const reports = c.reports.filter((r) => canOpen(r.href));
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

      {reports.length ? (
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {reports.map((r) => <ReportRow key={r.href} r={r} tone={tone} big />)}
        </Box>
      ) : (
        <Box sx={{ ...glass, borderRadius: "18px", p: 2.25, background: `linear-gradient(170deg, ${tone.tint}, rgba(255,255,255,.64) 58%)` }}>
          <Typography sx={{ fontSize: "0.9rem", color: FAINT, lineHeight: 1.5 }}>
            {c.reports.length ? "These reports are not opened to you - an admin can grant them." : `No report here yet. ${c.next}`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

"use client";
// One section of UC & HubSpot Apps (06.11.2026), as Website's are: a section with pages is a doorway, not a page: it
// sends you straight into its first page you may open. Only a section none of whose pages is opened to you stays and
// says so.

import { useEffect } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import HubIconGlyph from "@/app/HubIcon";
import { ucSectionBySlug } from "@/app/hubApps";
import { useReportAccess } from "@/app/reporting/useCanOpen";
import { FAINT, INK, MUTED, glass, riseKeyframes } from "@/app/reporting/ui";
import { sectionEntry } from "@/app/website/ui";

export default function UcSection() {
  const { section } = useParams<{ section: string }>();
  const router = useRouter();
  const s = ucSectionBySlug(section);
  const { canOpen, ready } = useReportAccess();
  const open = s ? s.pages.filter((p) => canOpen(p.href)) : [];
  const go = s && ready && open.length ? sectionEntry(s, canOpen, "/uc") : null;
  useEffect(() => { if (go) router.replace(go); }, [go, router]);
  if (!s) notFound();
  // on the way into the first page: nothing to draw
  if (!ready || open.length) return null;

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1080, ...riseKeyframes }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
        <Box sx={{
          width: 52, height: 52, borderRadius: "16px", flexShrink: 0, display: "grid", placeItems: "center",
          background: `linear-gradient(140deg, ${s.fg}b3, ${s.fg})`, color: "#fff", boxShadow: `0 10px 22px ${s.tint}`,
        }}><HubIconGlyph name={s.icon} fontSize={27} /></Box>
        <Box>
          <Typography component="h1" sx={{
            fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
            fontSize: { xs: "1.5rem", md: "1.75rem" }, fontWeight: 600, letterSpacing: "-0.03em", color: INK, lineHeight: 1.1,
          }}>{s.name}</Typography>
          <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: 0.5 }}>{s.line}</Typography>
        </Box>
      </Box>

      <Box sx={{ ...glass, borderRadius: "18px", p: 2.25, background: `linear-gradient(170deg, ${s.tint}, rgba(255,255,255,.64) 58%)` }}>
        <Typography sx={{ fontSize: "0.9rem", color: FAINT, lineHeight: 1.5 }}>
          {s.pages.length ? "These pages are not opened to you - an admin can grant them." : "Nothing here yet."}
        </Typography>
      </Box>
    </Box>
  );
}

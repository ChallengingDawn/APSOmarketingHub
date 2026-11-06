"use client";
// Website's sections drawn as Advanced reporting draws its categories (SARCLA 03.11.2026: "website becomes a multiple
// app application like advanced reports"): the same tile - a coloured glyph, the name with a chevron, one line - with
// the section's colours from WEBSITE_SECTIONS in hubApps.ts, so the launch pad, these tiles and the side panel agree.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import HubIconGlyph from "@/app/HubIcon";
import type { WebsiteSection } from "@/app/hubApps";
import { FAINT, INK, MUTED, focusRing, glass } from "@/app/reporting/ui";

const rise = (i: number) => ({ animation: `riseIn .5s cubic-bezier(.22,.8,.3,1) ${0.05 + i * 0.07}s backwards` });

/** Where a section's tile leads: its first page this person may open, else the section's own page (under `base` -
 *  Website's, or UC & HubSpot Apps' since 06.11.2026). */
export const sectionEntry = (s: WebsiteSection, canOpen: (href: string) => boolean, base = "/website") =>
  s.pages.find((p) => canOpen(p.href))?.href ?? `${base}/${s.slug}`;

export function SectionTile({ s, canOpen, i, base = "/website" }: { s: WebsiteSection; canOpen: (href: string) => boolean; i: number; base?: string }) {
  const open = s.pages.filter((p) => canOpen(p.href));
  const count = open.length === 1 ? open[0].name
    : open.length ? `${open.length} pages`
    : s.pages.length ? "Not opened to you - an admin can grant it" : "Nothing here yet";
  return (
    <Box component={Link} href={sectionEntry(s, canOpen, base)} sx={{
      ...glass, backdropFilter: "none", borderRadius: "22px", p: { xs: 2, md: 2.75 }, height: "100%", minHeight: { md: 188 }, boxSizing: "border-box",
      display: "flex", flexDirection: "column", gap: 1.25, textDecoration: "none", color: INK, ...focusRing,
      background: `linear-gradient(170deg, ${s.tint}, rgba(255,255,255,.64) 62%)`,
      transition: "box-shadow .2s ease, border-color .2s ease",
      "&:hover": { borderColor: `${s.fg}55`, boxShadow: "0 2px 6px rgba(31,45,78,.06), 0 18px 40px rgba(31,45,78,.11)" },
      "&:hover .chev": { transform: "translateX(3px)" },
      ...rise(i + 1),
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{
          width: { xs: 44, md: 52 }, height: { xs: 44, md: 52 }, borderRadius: "15px", flexShrink: 0, display: "grid", placeItems: "center",
          background: `linear-gradient(140deg, ${s.fg}b3, ${s.fg})`, color: "#fff", boxShadow: `0 8px 18px ${s.tint}`,
        }}><HubIconGlyph name={s.icon} fontSize={26} /></Box>
        <Typography component="span" sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: { xs: "1.15rem", md: "1.3rem" }, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: { xs: "26px", md: "30px" }, minWidth: 0,
        }}>{s.name}</Typography>
        <ChevronRightIcon className="chev" sx={{ fontSize: 24, color: s.fg, ml: "auto", flexShrink: 0, transition: "transform .18s ease" }} />
      </Box>
      <Typography sx={{ fontSize: { xs: "0.9rem", md: "0.98rem" }, color: MUTED, lineHeight: { xs: "21px", md: "23px" } }}>{s.line}</Typography>
      <Typography sx={{ fontSize: "0.85rem", color: open.length ? s.fg : FAINT, fontWeight: 600, mt: "auto", lineHeight: "20px" }}>{count}</Typography>
    </Box>
  );
}

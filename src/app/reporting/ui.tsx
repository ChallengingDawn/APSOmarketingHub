"use client";
// Advanced reporting drawn like the launch pad (SARCLA, 11.10.2026: "design
// should be more like the UC's"): a category is a tile the way an app is - a
// coloured glyph, its name with a chevron, one line - and its reports are the
// tile's rows. The colours and glyphs are the ones the launch pad already gives
// each category (hubApps.ts, the reporting app's subs), so both agree.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import HubIconGlyph from "@/app/HubIcon";
import { APPS, type IconKey } from "@/app/hubApps";
import { categoryEntry, type Report, type ReportCategory } from "@/lib/reporting/categories";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const ACCENT = "#3b7df6";

export const glass = {
  bgcolor: "rgba(255,255,255,.60)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,.75)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 14px 36px rgba(31,45,78,.075)",
};

const focusRing = {
  "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 3, borderRadius: 10 },
};

/** The page root carries the keyframes; each tile rises a beat after the last. */
export const riseKeyframes = {
  "@keyframes riseIn": { from: { opacity: 0, transform: "translateY(14px)" }, to: { opacity: 1, transform: "none" } },
  "@media (prefers-reduced-motion: reduce)": {
    "&, & *": {
      animationDuration: "0.01ms !important",
      animationIterationCount: "1 !important",
      transitionDuration: "0.01ms !important",
    },
  },
};
// `backwards`, not `both`: a fill that holds the end state keeps the animation active, and
// Chrome keeps every tile on a compositor layer of its own - on Windows that turns the text
// soft (SARCLA 16.10: "pixelized"). Backwards hides the tile before its turn and lets go after.
const rise = (i: number) => ({ animation: `riseIn .5s cubic-bezier(.22,.8,.3,1) ${0.05 + i * 0.07}s backwards` });

type Tone = { icon: IconKey; tint: string; fg: string };
const FALLBACK: Tone = { icon: "bar", tint: "#e6edfd", fg: "#3461c9" };

/** A category's glyph and colours, as its row on the launch pad has them. */
export function toneOf(slug: string): Tone {
  const sub = APPS.find((a) => a.key === "reporting")?.subs.find((s) => s.href === `/reporting/${slug}`);
  return sub ? { icon: sub.icon, tint: sub.tint, fg: sub.fg } : FALLBACK;
}

/**
 * A category as a small tile: its glyph, name and line, and how many reports it
 * holds - the reports themselves are not listed (SARCLA, 16.10.2026: "smaller
 * tiles, don't list every sub-report"). The whole tile is one link, straight
 * into the first report this person may open (categoryEntry); a category with
 * none yet opens its own page, which names what comes first. No lift on hover:
 * a transform puts the tile on a layer of its own, and that is what made the
 * text soft (119b6ce) - the border and the shadow answer the hover instead.
 */
export function CategoryTile({ c, reports, i }: { c: ReportCategory; reports: Report[]; i: number }) {
  const tone = toneOf(c.slug);
  const entry = categoryEntry(c, (href) => reports.some((r) => r.href === href));
  const count = reports.length
    ? `${reports.length} report${reports.length === 1 ? "" : "s"}`
    : c.reports.length ? "Not opened to you - an admin can grant it" : "No report yet";
  return (
    <Box component={Link} href={entry} sx={{
      ...glass, backdropFilter: "none", borderRadius: "18px", p: { xs: 1.5, md: 1.6 }, height: "100%", boxSizing: "border-box",
      display: "flex", flexDirection: "column", gap: 0.9, textDecoration: "none", color: INK, ...focusRing,
      background: `linear-gradient(170deg, ${tone.tint}, rgba(255,255,255,.64) 62%)`,
      transition: "box-shadow .2s ease, border-color .2s ease",
      "&:hover": { borderColor: `${tone.fg}55`, boxShadow: "0 2px 6px rgba(31,45,78,.06), 0 18px 40px rgba(31,45,78,.11)" },
      "&:hover .chev": { transform: "translateX(3px)" },
      ...rise(i + 1),
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.1 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: "11px", flexShrink: 0, display: "grid", placeItems: "center",
          background: `linear-gradient(140deg, ${tone.fg}b3, ${tone.fg})`, color: "#fff",
          boxShadow: `0 6px 14px ${tone.tint}`,
        }}><HubIconGlyph name={tone.icon} fontSize={19} /></Box>
        <Typography component="span" sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: "1rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: "22px", minWidth: 0,
        }}>{c.name}</Typography>
        <ChevronRightIcon className="chev" sx={{ fontSize: 18, color: tone.fg, ml: "auto", flexShrink: 0, transition: "transform .18s ease" }} />
      </Box>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: "18px" }}>{c.line}</Typography>
      <Typography sx={{ fontSize: "0.74rem", color: reports.length ? tone.fg : FAINT, fontWeight: 600, mt: "auto", lineHeight: "16px" }}>{count}</Typography>
    </Box>
  );
}

export { INK, MUTED, FAINT, focusRing };

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
import type { Report, ReportCategory } from "@/lib/reporting/categories";

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
const rise = (i: number) => ({ animation: `riseIn .5s cubic-bezier(.22,.8,.3,1) ${0.05 + i * 0.07}s both` });

type Tone = { icon: IconKey; tint: string; fg: string };
const FALLBACK: Tone = { icon: "bar", tint: "#e6edfd", fg: "#3461c9" };

/** A category's glyph and colours, as its row on the launch pad has them. */
export function toneOf(slug: string): Tone {
  const sub = APPS.find((a) => a.key === "reporting")?.subs.find((s) => s.href === `/reporting/${slug}`);
  return sub ? { icon: sub.icon, tint: sub.tint, fg: sub.fg } : FALLBACK;
}

/** One report: the white row with a tinted glyph, as on a launch-pad tile. */
export function ReportRow({ r, tone, big = false }: { r: Report; tone: Tone; big?: boolean }) {
  return (
    <Box component={Link} href={r.href} sx={{
      display: "flex", alignItems: "center", gap: 1.2, p: big ? 1.5 : 1.05, borderRadius: "14px",
      textDecoration: "none", bgcolor: "rgba(255,255,255,.72)",
      border: "1px solid rgba(255,255,255,.85)", ...focusRing,
      transition: "background-color .18s ease, transform .18s ease",
      "&:hover": { bgcolor: "#fff", transform: "translateX(3px)" },
    }}>
      <Box sx={{
        width: big ? 40 : 34, height: big ? 40 : 34, borderRadius: "11px", flexShrink: 0, display: "grid", placeItems: "center",
        bgcolor: tone.tint, color: tone.fg,
      }}><HubIconGlyph name={r.icon} fontSize={big ? 21 : 18} /></Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: big ? "0.95rem" : "0.875rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em", lineHeight: 1.25 }}>
          {r.name}
        </Typography>
        <Typography sx={{ fontSize: big ? "0.8rem" : "0.735rem", color: FAINT, lineHeight: 1.3 }}>{r.note}</Typography>
      </Box>
      <ChevronRightIcon sx={{ fontSize: 17, color: FAINT, flexShrink: 0 }} />
    </Box>
  );
}

/** A category as a launch-pad tile. `reports` is what this person may open. */
export function CategoryTile({ c, reports, i }: { c: ReportCategory; reports: Report[]; i: number }) {
  const tone = toneOf(c.slug);
  return (
    <Box sx={{
      ...glass, borderRadius: "22px", p: { xs: 2, md: 2.1 },
      display: "flex", flexDirection: "column", gap: 1.5,
      background: `linear-gradient(170deg, ${tone.tint}, rgba(255,255,255,.64) 58%)`,
      transition: "transform .22s cubic-bezier(.22,.8,.3,1), box-shadow .22s ease",
      "&:hover": { transform: "translateY(-4px)", boxShadow: "0 2px 6px rgba(31,45,78,.06), 0 24px 52px rgba(31,45,78,.12)" },
      ...rise(i + 1),
    }}>
      <Box sx={{
        width: 52, height: 52, borderRadius: "16px", display: "grid", placeItems: "center",
        background: `linear-gradient(140deg, ${tone.fg}b3, ${tone.fg})`, color: "#fff",
        boxShadow: `0 10px 22px ${tone.tint}`,
      }}><HubIconGlyph name={tone.icon} fontSize={27} /></Box>

      <Box>
        <Box component={Link} href={`/reporting/${c.slug}`} sx={{
          display: "inline-flex", alignItems: "center", gap: 0.4, textDecoration: "none", color: INK, ...focusRing,
          "&:hover .chev": { transform: "translateX(4px)" },
        }}>
          <Typography component="span" sx={{
            fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
            fontSize: "1.18rem", fontWeight: 600, letterSpacing: "-0.028em", lineHeight: 1.16,
          }}>{c.name}</Typography>
          <ChevronRightIcon className="chev" sx={{ fontSize: 21, color: tone.fg, transition: "transform .18s ease" }} />
        </Box>
        <Typography sx={{ fontSize: "0.875rem", color: MUTED, mt: 0.6, lineHeight: 1.45 }}>{c.line}</Typography>
      </Box>

      {/* Rows follow the line rather than sinking to the foot: categories hold
          zero to four reports, and a lone row at the bottom reads as a gap. */}
      <Box sx={{ display: "grid", gap: 1 }}>
        {reports.map((r) => <ReportRow key={r.href} r={r} tone={tone} />)}
        {/* Empty on purpose says so, and names what comes first. */}
        {!reports.length && (
          <Typography sx={{ fontSize: "0.82rem", color: FAINT, lineHeight: 1.5, py: 0.5 }}>
            {c.reports.length ? "Not opened to you - an admin can grant it." : c.next}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export { INK, MUTED, FAINT, focusRing };

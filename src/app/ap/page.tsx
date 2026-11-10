"use client";
// THE ANGST+PFISTER HUB'S FRONT PAGE (SARCLA 10.11.2026: "on their hub for the moment we will create advanced
// reporting"). Drawn as Advanced reporting's own front page is - the hub's bar, the name, a tile per report - so the
// two hubs read as one house. The switch in the bar leads to the APSOparts hub, where a cross-user looks and changes
// nothing (src/lib/auth/access.ts).

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import HubIconGlyph from "@/app/HubIcon";
import { HomeBar } from "@/app/HomeBar";
import { FAINT, INK, MUTED, focusRing, glass, riseKeyframes } from "@/app/reporting/ui";
import { AP_REPORTS } from "./reports";

const rise = (i: number) => ({ animation: `riseIn .5s cubic-bezier(.22,.8,.3,1) ${0.05 + i * 0.07}s backwards` });

export default function AngstPfisterHub() {
  return (
    <Box sx={{ maxWidth: 1480, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, ...riseKeyframes }}>
      <HomeBar hub="ap" on="Home" />

      <Typography component="h1" sx={{
        mt: { xs: 2, md: 3 },
        fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
        fontSize: { xs: "1.45rem", md: "1.75rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK,
        lineHeight: { xs: "30px", md: "34px" },
      }}>Advanced reporting</Typography>

      <Box sx={{
        display: "grid", gap: { xs: 1.5, md: 2 }, alignItems: "stretch", mt: { xs: 1.75, md: 2.25 },
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
        gridAutoRows: "1fr",
      }}>
        {AP_REPORTS.map((r, i) => (
          <Box key={r.href} component={Link} href={r.href} sx={{
            ...glass, backdropFilter: "none", borderRadius: "22px", p: { xs: 2, md: 2.75 }, height: "100%",
            minHeight: { md: 188 }, boxSizing: "border-box",
            display: "flex", flexDirection: "column", gap: 1.25, textDecoration: "none", color: INK, ...focusRing,
            background: `linear-gradient(170deg, ${r.tint}, rgba(255,255,255,.64) 62%)`,
            transition: "box-shadow .2s ease, border-color .2s ease",
            "&:hover": { borderColor: `${r.fg}55`, boxShadow: "0 2px 6px rgba(31,45,78,.06), 0 18px 40px rgba(31,45,78,.11)" },
            "&:hover .chev": { transform: "translateX(3px)" },
            ...rise(i + 1),
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{
                width: { xs: 44, md: 52 }, height: { xs: 44, md: 52 }, borderRadius: "15px", flexShrink: 0,
                display: "grid", placeItems: "center",
                background: `linear-gradient(140deg, ${r.fg}b3, ${r.fg})`, color: "#fff", boxShadow: `0 8px 18px ${r.tint}`,
              }}><HubIconGlyph name={r.icon} fontSize={26} /></Box>
              <Typography component="span" sx={{
                fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
                fontSize: { xs: "1.15rem", md: "1.3rem" }, fontWeight: 600, letterSpacing: "-0.02em",
                lineHeight: { xs: "26px", md: "30px" }, minWidth: 0,
              }}>{r.name}</Typography>
              <ChevronRightIcon className="chev" sx={{ fontSize: 24, color: r.fg, ml: "auto", flexShrink: 0, transition: "transform .18s ease" }} />
            </Box>
            <Typography sx={{ fontSize: { xs: "0.9rem", md: "0.98rem" }, color: MUTED, lineHeight: { xs: "21px", md: "23px" } }}>{r.line}</Typography>
            <Typography sx={{ fontSize: "0.85rem", color: FAINT, fontWeight: 600, mt: "auto", lineHeight: "20px" }}>{r.scope}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

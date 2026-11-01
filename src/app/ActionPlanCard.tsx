"use client";
// THE HOME PAGE'S ACTION PLAN CARD - it was "Mission Control" (SARCLA 31.10.2026: "change the name to Action
// plan; the mountain behind should see real data and show what is our position until 30 millions in 2031").
// The range behind the words is APSOparts' revenue year by year and the climb to the summit; the words say
// where this year is heading against the path. It opens the plan.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { SummitMountain, useSummit } from "./action-plan/Summit";
import { SUMMIT, mEur, pct1 } from "@/lib/reporting/summitRules";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";

export default function ActionPlanCard({ glass, focusRing }: { glass: object; focusRing: object }) {
  const { data: s } = useSummit();
  const due = s?.current ? s.path.find((p) => p.year === s.current!.year) : undefined;
  const ahead = s?.gap == null || s.gap >= 0;
  const tone = !s?.current ? "#6d5bd0" : ahead ? "#1b7a55" : "#a96a12";
  return (
    <Box component={Link} href="/action-plan" sx={{
      ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 }, position: "relative", overflow: "hidden",
      textDecoration: "none", minHeight: 170, display: "flex", flexDirection: "column", justifyContent: "center",
      background: "linear-gradient(150deg, rgba(154,123,240,.18), rgba(91,141,239,.13) 58%, rgba(255,255,255,.72))",
      ...focusRing,
      transition: "transform .22s ease",
      "&:hover": { transform: "translateY(-3px)" },
      "&:hover .go": { transform: "translateX(4px)" },
      "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
    }}>
      {/* mountain 8: real years, the climb to the summit, snow above 26 M€, the dot where we are - across the card's face */}
      <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <SummitMountain s={s} mode="card" />
      </Box>

      <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 0.6, mb: 1 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: tone }} />
        <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: tone }}>
          {SUMMIT.value / 1_000_000} M€ by {SUMMIT.year}
        </Typography>
      </Box>
      <Typography sx={{
        position: "relative",
        fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
        fontSize: "1.32rem", fontWeight: 600, color: INK, letterSpacing: "-0.03em", lineHeight: 1.18,
      }}>
        <Box component="span" sx={{
          background: "linear-gradient(95deg,#3b82f6,#8b5cf6)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          display: "inline-block", paddingRight: "6px", marginRight: "-4px",
        }}>Action plan</Box>
      </Typography>
      <Typography sx={{ position: "relative", fontSize: "0.86rem", color: MUTED, mt: 0.75, maxWidth: "30ch", lineHeight: 1.45 }}>
        {s?.current && due
          ? <>{s.current.year} heads for <b style={{ color: INK }}>{mEur(s.current.estimate)}</b> against {mEur(due.value)} on the path to {SUMMIT.value / 1_000_000} M€.</>
          : s?.base
            ? <>{s.base.year} closed at <b style={{ color: INK }}>{mEur(s.base.value)}</b>; {SUMMIT.value / 1_000_000} M€ by {SUMMIT.year} takes {s.cagr != null ? pct1(s.cagr) : "—"} a year.</>
            : <>Every action of the business improvement plan by topic - who owns it, when it is due, how far it is.</>}
      </Typography>
      {s?.current && (
        <Typography sx={{ position: "relative", fontSize: "0.74rem", color: FAINT, mt: 0.5, maxWidth: "34ch" }}>
          {s.current.monthsLabel} {pct1(s.current.change)} on last year
        </Typography>
      )}
      <Box className="go" sx={{
        position: "absolute", right: 18, bottom: 18, width: 42, height: 42, borderRadius: "50%",
        display: "grid", placeItems: "center",
        background: "linear-gradient(140deg,#5b8def,#3461c9)", color: "#fff",
        boxShadow: "0 8px 20px rgba(52,97,201,.32)", transition: "transform .18s ease",
        "& svg": { fontSize: 22 },
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      }}><ChevronRightIcon /></Box>
    </Box>
  );
}

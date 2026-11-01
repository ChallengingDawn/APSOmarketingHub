"use client";
// THE HOME PAGE'S ACTION PLAN CARD - it was "Mission Control" (SARCLA 31.10.2026: "change the name to Action
// plan; the mountain behind should see real data and show what is our position until 30 millions in 2031").
// The range behind the words is APSOparts' revenue year by year and the climb to the summit (mountain 8, "Snow
// cap"); the words are text design 4, "Headline line" (SARCLA 01.11.2026, both picked of 30): the sentence is
// the headline with its three amounts in colour, the name a small label above, the goal and the year-on-year
// note under it. It opens the plan, admins only.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { SummitMountain, useSummit } from "./action-plan/Summit";
import { SUMMIT, mEur, pct1, standingOf } from "@/lib/reporting/summitRules";

const INK = "#15223a";
const FAINT = "#8b97ac";
const BLUE = "#3461c9";

export default function ActionPlanCard({ glass, focusRing }: { glass: object; focusRing: object }) {
  const { data: s } = useSummit();
  const due = s?.current ? s.path.find((p) => p.year === s.current!.year) : undefined;
  // on the path (within 0.05 M€) counts as green, like ahead
  const tone = !s?.current ? "#6d5bd0" : standingOf(s.gap) === "behind" ? "#a96a12" : "#1b7a55";
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

      {/* text design 4: the name a label, the sentence the headline, the goal and the note under it */}
      <Box sx={{ position: "relative", maxWidth: 262 }}>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: FAINT }}>
          Action plan
        </Typography>
        <Typography sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: "1.22rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em", lineHeight: 1.22, mt: 0.75,
          "& b": { fontWeight: 600 },
        }}>
          {s?.current && due
            ? <>{s.current.year} heads for <b style={{ color: tone }}>{mEur(s.current.estimate)}</b> against <b style={{ color: BLUE }}>{mEur(due.value)}</b> on the path to <b>{SUMMIT.value / 1_000_000} M€</b>.</>
            : s?.base
              ? <>{s.base.year} closed at <b style={{ color: BLUE }}>{mEur(s.base.value)}</b>; {SUMMIT.value / 1_000_000} M€ by {SUMMIT.year} takes {s.cagr != null ? pct1(s.cagr) : "—"} a year.</>
              : <>Every action of the business improvement plan, with who owns it and when it is due.</>}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mt: 1.25 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: tone, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: tone }}>
            {SUMMIT.value / 1_000_000} M€ by {SUMMIT.year}
          </Typography>
        </Box>
        {s?.current && (
          <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.5, lineHeight: 1.4 }}>
            {s.current.monthsLabel} {pct1(s.current.change)} on last year
          </Typography>
        )}
      </Box>
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

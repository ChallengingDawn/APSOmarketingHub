"use client";

// The tracking-health verdict where GA4 channel figures are used as counters
// (SMEC targets). From the fault until the fix is confirmed it says the Paid
// Search figures under-count and for which days; once healthy it shrinks to a
// one-line note of the gap the year-to-date totals keep. It shows nothing while
// the check is loading or cannot run — the page's own tiles carry those states.

import Link from "next/link";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { HAIRLINE, INK, MUTED } from "../Shell";
import { dayLabel } from "@/app/charts/format";
import { FIX_DATE, INCIDENT_DATE, describeHealth, shiftIso, type Health, type HealthTone } from "./health";

export const TONE: Record<HealthTone, { bg: string; fg: string }> = {
  good: { bg: "#e5f3ea", fg: "#155d33" },
  warn: { bg: "#fff4e5", fg: "#8a4b00" },
  bad: { bg: "#fdf3f2", fg: "#9e1b18" },
  flat: { bg: "#eef0f3", fg: "#3c4043" },
};

const ICON: Record<HealthTone, typeof CheckCircleIcon> = {
  good: CheckCircleIcon,
  warn: AutorenewIcon,
  bad: ErrorOutlineIcon,
  flat: HelpOutlineIcon,
};

/** Status is never colour alone: icon + label + tone. */
export function HealthChip({ tone, label }: { tone: HealthTone; label: string }) {
  const Icon = ICON[tone];
  return (
    <Chip
      icon={<Icon />}
      label={label}
      size="small"
      sx={{
        bgcolor: TONE[tone].bg,
        color: TONE[tone].fg,
        fontWeight: 600,
        "& .MuiChip-icon": { color: TONE[tone].fg, fontSize: 16 },
      }}
    />
  );
}

const trackingLink = (label: string) => (
  <Link href="/analytics/tracking" style={{ color: "#1b4a80", fontWeight: 600 }}>
    {label}
  </Link>
);

export function AttributionNotice({ health }: { health: Health | null }) {
  if (!health || health.state === "insufficient") return null;
  const incident = dayLabel(INCIDENT_DATE);
  const fix = dayLabel(FIX_DATE);

  if (health.state === "healthy") {
    return (
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 2.5 }}>
        GA4 recorded part of Paid Search as Direct from {incident} to {fix}. Recorded sessions are not re-attributed, so the
        year-to-date Paid Search figures keep that gap. {trackingLink("Tracking health")}
      </Typography>
    );
  }

  const copy = describeHealth(health);
  const headline =
    health.state === "alert"
      ? "Check the GA4 counters below before using them"
      : health.state === "verifying"
        ? `Paid Search counters under-count from ${incident} to ${fix}`
        : `The Paid Search counters below under-count from ${incident}`;
  const footnote =
    health.state === "verifying"
      ? `GA4 does not re-attribute sessions it has already recorded, so that gap stays in the year-to-date totals. Days from ${dayLabel(shiftIso(FIX_DATE, 1))} count normally once the check confirms the fix.`
      : `Figures before ${incident} are unaffected. GA4 does not re-attribute sessions it has already recorded, so the gap stays in the year-to-date totals even after the fix.`;

  return (
    <Box
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderLeft: `3px solid ${TONE[copy.tone].fg}`,
        borderRadius: 2.4,
        bgcolor: "#fff",
        p: { xs: 2, md: 2.25 },
        mb: 2.5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.75 }}>
        <HealthChip tone={copy.tone} label={copy.label} />
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>{headline}</Typography>
      </Box>
      <Typography sx={{ fontSize: "0.82rem", color: INK }}>{copy.sentence}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75 }}>
        {footnote} {trackingLink("Open Tracking health")}
      </Typography>
    </Box>
  );
}

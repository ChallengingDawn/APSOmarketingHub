"use client";
// ADVANCED REPORTING — an app with nothing in it yet, said out loud.
//
// The four pages that briefly lived here were Website's all along: Live, the
// tracking health check, cookie consent and the web order sync all answer
// questions about the site, and they went back.
//
// What belongs here is the reporting that cuts ACROSS the apps — the numbers
// nobody can get today without opening three screens and a spreadsheet. None of
// it is built. So the app exists, it is empty, and the page says so rather than
// offering a menu of things that are not there.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InsightsIcon from "@mui/icons-material/Insights";

import PageHeader from "@/app/PageHeader";
import { CardTitle, FAINT, GlassCard, INK, Kicker, MUTED } from "@/app/uc/report/ui";

/** Candidates, not promises. Each is a question somebody has actually asked. */
const CANDIDATES = [
  "Revenue against the website, month by month — the shop and HubSpot in one series.",
  "What a customer did before they ordered: looked, priced, asked, bought.",
  "Which articles are looked at and never ordered, across every customer at once.",
  "A board pack that builds itself from the month that just closed.",
];

export default function AdvancedReporting() {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 900 }}>
      <PageHeader title="Advanced reporting" subtitle="Reports that cut across the apps" />

      <GlassCard>
        <CardTitle
          icon={<InsightsIcon />} tint="blue" title="Nothing in here yet"
          note="The app exists so the reports have somewhere to land. None of them is built."
        />
        <Typography sx={{ fontSize: "0.9rem", color: MUTED, lineHeight: 1.65, mb: 2.5 }}>
          Every app answers its own question well. What is missing is the question that spans them — the number
          you can only get today by opening three screens and a spreadsheet. That is what this is for.
        </Typography>

        <Kicker>What would go here</Kicker>
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 1 }}>
          {CANDIDATES.map((c) => (
            <Typography component="li" key={c} sx={{ fontSize: "0.88rem", color: INK, lineHeight: 1.55 }}>
              {c}
            </Typography>
          ))}
        </Box>

        <Typography sx={{ fontSize: "0.82rem", color: FAINT, mt: 2.5, lineHeight: 1.55 }}>
          None of these is being worked on. They are written down so the shape of the app is clear, and so the
          first real one can be chosen rather than defaulted into. Say which matters and it gets built.
        </Typography>
      </GlassCard>
    </Box>
  );
}

"use client";

// SATISFACTION KPIs - Reporting > Satisfaction Reports (SARCLA 27.10.2026: "a new KPI page for satisfaction", "the
// happiness per country - based on locales - and languages and locale"). Every HubSpot survey answer: order success on
// the shop, the live chat and the shop chat, Back Office tickets, TSA calls, the NPS e-mail - CSAT (the happy share) and
// NPS apart, per touchpoint, country, language and locale, and what the customers wrote.
// Rebuilt like the ESO Visits page (SARCLA 01.11.2026: "rebuild like Visits"): the title and the figures on top, the
// period in the Filters window - no more reporting window in the header (./SatisfactionView.tsx).

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { H1 } from "@/app/reporting/eso-benchmark/Figures";
import type { SatisfactionData } from "@/lib/satisfaction/figures";
import { SatisfactionView } from "./SatisfactionView";

const TITLE = "Satisfaction KPIs";

export default function SatisfactionKpis() {
  const [n, setN] = useState(0);
  const url = `/api/reporting/satisfaction?r=${n}`;
  const held = useHeld<SatisfactionData>(url, [url]);
  const r = held.result;
  const shell = { width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 1.25, md: 1.75 }, pb: 3, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.75 } as const;
  return (
    <Box sx={shell}>
      {r === null || r.state !== "ok" ? (
        <>
          <Typography component="h1" sx={H1}>{TITLE}</Typography>
          {r === null ? <LoadingPanel label="Reading the survey answers…" />
            : <UpstreamPanel source="HubSpot surveys" error={r.state === "error" ? r.error : "Not set up"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />}
        </>
      ) : <Box sx={{ minWidth: 0, opacity: held.stale ? 0.6 : 1 }}><SatisfactionView d={r.data} title={TITLE} /></Box>}
    </Box>
  );
}

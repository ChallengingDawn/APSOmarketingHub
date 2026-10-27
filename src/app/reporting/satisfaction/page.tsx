"use client";

// SATISFACTION KPIs - Reporting > Satisfaction Reports (SARCLA 27.10.2026: "a new KPI page for satisfaction", "the
// happiness per country - based on locales - and languages and locale"). Every HubSpot survey answer of the period:
// order success on the shop, the live chat and the shop chat, Back Office tickets, TSA calls, the NPS e-mail - CSAT
// (the happy share) and NPS apart, per country, language, locale and touchpoint, and what the customers wrote.

import { useState } from "react";
import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { WindowPicker, isoDate, spanDays, useReportingWindow } from "@/app/window/ReportingWindow";
import type { SatisfactionData } from "@/lib/satisfaction/figures";
import { SatisfactionView } from "./SatisfactionView";

export default function SatisfactionKpis() {
  const { window: win, label } = useReportingWindow();
  const days = Math.min(800, Math.max(1, spanDays(win.from, isoDate(new Date()))));
  const [n, setN] = useState(0);
  const url = `/api/reporting/satisfaction?days=${days}&r=${n}`;
  const held = useHeld<SatisfactionData>(url, [url]);
  const r = held.result;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Satisfaction KPIs" subtitle="What customers answer in our HubSpot surveys - satisfied share, per country, language, locale and touchpoint, and their own words"
        rightSlot={<WindowPicker />} />
      {r === null ? <LoadingPanel label="Reading the survey answers…" />
        : r.state !== "ok" ? <UpstreamPanel source="HubSpot surveys" error={r.state === "error" ? r.error : "Not set up"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />
        : <Box sx={{ display: "grid", gap: 2.5, minWidth: 0, opacity: held.stale ? 0.6 : 1 }}><SatisfactionView d={r.data} label={label} /></Box>}
    </Box>
  );
}

"use client";

/**
 * INTELLIGENCE SHELL — independent sub-apps reached from the sidebar, no tab
 * rail: New customers, Buying companies, Contact requests, SMEC targets,
 * Tracking health, Cookie consent and Web order sync. The GA4 site sub-apps
 * (overview, acquisition, audience) live in the Website area; old /analytics
 * URLs redirect (next.config.ts).
 *
 * The header's right slot follows what the sub-app reads. New customers uses
 * the shared GA4 + HubSpot provider, so it gets the provider, the window picker
 * and a reload. Sub-apps that fetch their own reports for the hub-wide window
 * get the picker alone. Buying companies and SMEC targets work on calendar
 * years and get nothing.
 */

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "@/app/PageHeader";
import { WindowPicker } from "@/app/window/ReportingWindow";
import { AnalyticsProvider, useAnalytics } from "./AnalyticsData";
import { GUTTER, MUTED } from "./Shell";

type Controls = "analytics" | "window" | "none";
type Header = { title: string; subtitle: string; controls: Controls };

const HEADERS: Record<string, Header> = {
  "/analytics/new-customers": {
    title: "New customers",
    subtitle: "New contacts and companies in the window, and the channels that brought them",
    controls: "analytics",
  },
  "/analytics/buyers": {
    title: "Buying companies",
    subtitle: "How many companies order each year, how many are new and how many come back",
    controls: "none",
  },
  "/analytics/contact-requests": {
    title: "Contact requests",
    subtitle: "How many customers write in through the contact and returns form, and in which language",
    controls: "window",
  },
  "/analytics/smec": { title: "SMEC targets", subtitle: "Where the agency's 2026 goals stand today", controls: "none" },
  "/analytics/tracking": {
    title: "Tracking health",
    subtitle: "Whether Google Analytics credits visits to the right channel, and whether the consent fix has passed",
    controls: "window",
  },
  "/analytics/consent": {
    title: "Cookie consent",
    subtitle: "How many visitors allow statistics and marketing cookies, which sets how much Google Analytics and Ads can see",
    controls: "window",
  },
  "/analytics/web-orders": {
    title: "Web order sync",
    subtitle: "Whether every web shop order reaches HubSpot, checked week by week against GA4 purchases",
    controls: "window",
  },
};

const FALLBACK: Header = { title: "Intelligence", subtitle: "Customers, targets and data quality", controls: "none" };

function AnalyticsControls() {
  const { overview, reload } = useAnalytics();
  const loading = overview.result === null || overview.stale;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {loading && <CircularProgress size={14} sx={{ color: MUTED }} />}
      <WindowPicker />
      <Tooltip title="Reload every report">
        <IconButton size="small" onClick={reload} aria-label="Reload">
          <RefreshIcon sx={{ fontSize: 18, color: MUTED }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function Chrome({ header, children }: { header: Header; children: ReactNode }) {
  const rightSlot = header.controls === "analytics" ? <AnalyticsControls /> : header.controls === "window" ? <WindowPicker /> : undefined;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader title={header.title} subtitle={header.subtitle} rightSlot={rightSlot} />
      {children}
    </Box>
  );
}

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  const pathname = (usePathname() ?? "").replace(/\/$/, "");
  const header = HEADERS[pathname] ?? FALLBACK;
  if (header.controls !== "analytics") return <Chrome header={header}>{children}</Chrome>;
  return (
    <AnalyticsProvider>
      <Chrome header={header}>{children}</Chrome>
    </AnalyticsProvider>
  );
}

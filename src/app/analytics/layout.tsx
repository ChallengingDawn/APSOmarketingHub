"use client";

/**
 * INTELLIGENCE SHELL — New customers, SMEC targets, Tracking health and
 * Cookie-free signals: independent sub-apps reached from the sidebar, no tab
 * rail. The GA4 site sub-apps (overview, acquisition, audience) live in the
 * Website area now; their old /analytics URLs redirect (next.config.ts).
 *
 * Only New customers follows the hub-wide reporting window, so only it gets the
 * shared GA4 + HubSpot provider and the window picker. The other sub-apps state
 * their own fixed windows and fetch only what they show.
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

type Header = { title: string; subtitle: string; windowed: boolean };

const HEADERS: Record<string, Header> = {
  "/analytics/new-customers": {
    title: "New customers",
    subtitle: "Who just arrived, and what they become — GA4 and HubSpot, no sample data",
    windowed: true,
  },
  "/analytics/smec": { title: "SMEC targets", subtitle: "Agency KPIs against the 2026 goals — GA4, HubSpot and ERP", windowed: false },
  "/analytics/tracking": {
    title: "Tracking health",
    subtitle: "Is GA4 putting sessions in the right channel — checked against the consent-fix acceptance test",
    windowed: false,
  },
  "/analytics/signals": {
    title: "Cookie-free signals",
    subtitle: "What we know about customers from business records and consent logs — ERP, CRM and Cookiebot",
    windowed: false,
  },
};

const FALLBACK: Header = { title: "Intelligence", subtitle: "Customers, targets and tracking quality — no sample data", windowed: false };

function WindowControls() {
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
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader title={header.title} subtitle={header.subtitle} rightSlot={header.windowed ? <WindowControls /> : undefined} />
      {children}
    </Box>
  );
}

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  const pathname = (usePathname() ?? "").replace(/\/$/, "");
  const header = HEADERS[pathname] ?? FALLBACK;
  if (!header.windowed) return <Chrome header={header}>{children}</Chrome>;
  return (
    <AnalyticsProvider>
      <Chrome header={header}>{children}</Chrome>
    </AnalyticsProvider>
  );
}

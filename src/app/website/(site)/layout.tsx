"use client";

/**
 * WEBSITE · GA4 SUB-APPS — Site overview, Acquisition and Audience.
 *
 * Three independent sub-apps in the Website area, beside Live and Pages, reached
 * from the sidebar (no tab rail). They share one GA4 connection and the hub-wide
 * reporting window, so switching between them refetches nothing and every figure
 * covers the same slice of time. Their old /analytics URLs redirect here
 * (next.config.ts).
 *
 *   /website/overview      Site overview   how the site is doing
 *   /website/acquisition   Acquisition     where visitors come from
 *   /website/audience      Audience        who they are
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
import { AnalyticsProvider, useAnalytics } from "@/app/analytics/AnalyticsData";
import { GUTTER, MUTED } from "@/app/analytics/Shell";

const HEADERS: Record<string, { title: string; subtitle: string }> = {
  "/website/overview": { title: "Site overview", subtitle: "Visits, engagement and revenue on apsoparts.com, against the period before" },
  "/website/acquisition": { title: "Acquisition", subtitle: "Which channels and sources bring visitors, and how engaged they are" },
  "/website/audience": { title: "Audience", subtitle: "Who visits: devices, countries, and new or returning" },
};

function Chrome({ children }: { children: ReactNode }) {
  const pathname = (usePathname() ?? "").replace(/\/$/, "");
  const header = HEADERS[pathname] ?? { title: "Website", subtitle: "How apsoparts.com is doing" };
  const { overview, reload } = useAnalytics();
  const loading = overview.result === null || overview.stale;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title={header.title}
        subtitle={header.subtitle}
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {loading && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <WindowPicker />
            <Tooltip title="Reload every report">
              <IconButton size="small" onClick={reload} aria-label="Reload">
                <RefreshIcon sx={{ fontSize: 18, color: MUTED }} />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />
      {children}
    </Box>
  );
}

export default function WebsiteAnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider>
      <Chrome>{children}</Chrome>
    </AnalyticsProvider>
  );
}

"use client";

/**
 * ANALYTICS COCKPIT SHELL.
 *
 * Five sub-apps, five routes, one connection, one window. The window is the
 * hub-wide reporting window (the picker in the header), so what you see here
 * is the same slice of time as the SEO cockpit and the customer view.
 *
 *   /analytics               Overview      how the site is doing
 *   /analytics/acquisition   Acquisition   where visitors come from
 *   /analytics/content       Content       what they read and land on
 *   /analytics/audience      Audience      who they are
 *   /analytics/commercial    Commercial    what turns into business
 */

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "@/app/PageHeader";
import { WindowPicker } from "@/app/window/ReportingWindow";
import { AnalyticsProvider, useAnalytics } from "./AnalyticsData";
import { GUTTER, MUTED, SubNav } from "./Shell";

function Chrome({ children }: { children: ReactNode }) {
  const { overview, reload } = useAnalytics();
  const loading = overview.result === null || overview.stale;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Analytics"
        subtitle="Live Google Analytics 4 and HubSpot for apsoparts.com — five focused sub-apps over one window, no sample data"
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
      <SubNav />
      {children}
    </Box>
  );
}

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider>
      <Chrome>{children}</Chrome>
    </AnalyticsProvider>
  );
}

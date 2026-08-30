"use client";

/**
 * ANALYTICS COCKPIT SHELL.
 *
 * Five sub-apps, five routes, one connection. The layout owns the window and
 * the GA4 overview; Next keeps it mounted while you move between siblings, so
 * navigating does not refetch and the window you chose survives the move.
 *
 *   /analytics               Overview      how the site is doing
 *   /analytics/acquisition   Acquisition   where visitors come from
 *   /analytics/content       Content       what they read and land on
 *   /analytics/audience      Audience      who they are
 *   /analytics/commercial    Commercial    what turns into business
 */

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { AnalyticsProvider, useAnalytics } from "./AnalyticsData";
import { GUTTER, SubNav, WindowSwitch } from "./Shell";

function Chrome({ children }: { children: ReactNode }) {
  const { windowDays, setWindowDays, overview, reload } = useAnalytics();
  const loading = overview.result === null || overview.stale;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Analytics"
        subtitle="Live Google Analytics 4 and HubSpot for apsoparts.com — five focused sub-apps, one window, no sample data"
        rightSlot={
          <WindowSwitch windowDays={windowDays} onChange={setWindowDays} loading={loading} onReload={reload} />
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

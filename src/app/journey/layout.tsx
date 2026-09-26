"use client";

/**
 * CUSTOMER JOURNEY — an application of its own.
 *
 *   /journey           The journey     five stages, fifteen steps, live numbers
 *   /journey/funnels   Funnels         lifecycle paths and where they stop
 *   /journey/sources   Sources         workbook rows, live sources, gaps
 *   /journey/import    Import          upload the workbook, preview, apply
 *
 * The definition comes from the business (Alexandre's workbook); the numbers
 * come from GA4, HubSpot and the shop. The two are kept visibly apart, so a
 * figure is never mistaken for an intention, or the other way round.
 */

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { JourneySubNav } from "./JourneyShell";

export default function JourneyLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Customer journey"
        subtitle="Who arrives, how far they get, and where we lose them"
      />
      <JourneySubNav />
      {children}
    </Box>
  );
}

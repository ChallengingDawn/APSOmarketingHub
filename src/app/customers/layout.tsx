"use client";

/**
 * CUSTOMERS SHELL — three sub-apps over the same window.
 *
 *   /customers            Overview   who was on the site, segmented
 *   /customers/visitors   Visitors   GA4 traffic beside known companies
 *   /customers/journeys   Journeys   what customer companies actually browsed
 */

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { WindowPicker } from "@/app/window/ReportingWindow";
import { GUTTER } from "@/app/analytics/Shell";
import { CustomersSubNav } from "./CustomersShell";

export default function CustomersLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Customers"
        subtitle="What the companies and contacts behind the traffic are doing — HubSpot's web tracking beside GA4, over the same window"
        rightSlot={<WindowPicker />}
      />
      <CustomersSubNav />
      {children}
    </Box>
  );
}

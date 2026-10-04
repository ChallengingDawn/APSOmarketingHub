"use client";

/**
 * CUSTOMER JOURNEY — an application of its own.
 *
 * The board is the application; the funnels and the data sources are their own
 * entries in the sidebar rather than tabs inside this one. There is no strip of
 * tabs here on purpose: a tab bar inside an app that also lives in the sidebar
 * gives two ways to the same screen and makes neither of them obvious.
 */

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { GUTTER } from "@/app/analytics/Shell";

// No header here. The board's heading is the journey's own name, which is
// stored with the journey and edited on the page, so the page writes it — a
// layout cannot know what the journey is called.
export default function JourneyShell({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 } }}>
      {children}
    </Box>
  );
}

"use client";

/**
 * SUB-APP · LIVE PAGES.
 *
 * The stored library is what we wrote; this is what we actually published. The
 * server fetches the page, converts it to readable text and runs the same seven
 * checks — plus what the HTML itself declares: FAQPage / Article JSON-LD and a
 * visible date, which the copy alone cannot tell you.
 */

import Box from "@mui/material/Box";
import { PageIntro } from "../geoUi";
import LivePageReadinessPanel from "../LivePageReadinessPanel";

const PURPOSE =
  "Score a published page exactly as an answer engine finds it — the served HTML, its FAQPage and Article JSON-LD, and whether it carries a date. Search Console's top pages become one-click targets when it is connected.";

export default function GeoLivePage() {
  return (
    <Box>
      <PageIntro title="Live pages" purpose={PURPOSE} />
      <LivePageReadinessPanel />
    </Box>
  );
}

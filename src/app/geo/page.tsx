"use client";

/**
 * GEO cockpit — generative-engine optimisation.
 *
 * Two surfaces: the content library scored before it ships, and the published
 * pages scored as an answer engine actually finds them. Both run the same
 * auditor (`src/lib/geo/audit.ts`), whose rules mirror the GEO rules the
 * content brain already writes with.
 *
 * Data policy: every number on this page is computed from a real body of text
 * or returned by a real API. When a source is missing or empty the page says
 * which one and what to connect — it never shows an example.
 */

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import PageHeader from "../PageHeader";
import { GEO_CHECKS } from "@/lib/geo/audit";
import { C, DISPLAY_FONT, Panel, SectionLabel } from "./geoUi";
import ContentReadinessPanel from "./ContentReadinessPanel";
import LivePageReadinessPanel from "./LivePageReadinessPanel";

type PanelKey = "content" | "live";

export default function GeoPage() {
  const [tab, setTab] = useState<PanelKey>("content");

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1280, mx: "auto" }}>
      <PageHeader
        title="GEO Cockpit"
        subtitle="What makes a page quotable by AI answer engines — scored on the copy you have, not on assumptions."
        badge="GEO"
      />

      <Panel sx={{ p: { xs: 2, md: 2.5 }, mb: 3 }}>
        <SectionLabel sx={{ mb: 1.5 }}>The seven checks · weighted to 100</SectionLabel>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)", md: "repeat(7, 1fr)" },
            gap: 1.5,
          }}
        >
          {GEO_CHECKS.map((c) => (
            <Tooltip
              key={c.id}
              title={
                <Box sx={{ p: 0.5 }}>
                  <Box sx={{ fontWeight: 700, mb: 0.5 }}>{c.question}</Box>
                  <Box>{c.why}</Box>
                </Box>
              }
            >
              <Box
                sx={{
                  borderLeft: `2px solid ${C.navy}`,
                  pl: 1.25,
                  py: 0.25,
                  cursor: "help",
                }}
              >
                <Typography
                  sx={{ fontFamily: DISPLAY_FONT, fontSize: 19, fontWeight: 600, color: C.navy, lineHeight: 1 }}
                >
                  {c.weight}
                </Typography>
                <Typography sx={{ fontSize: 12, color: C.ink, fontWeight: 600, mt: 0.5, lineHeight: 1.3 }}>
                  {c.label}
                </Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Panel>

      <Tabs
        value={tab}
        onChange={(_e, v: PanelKey) => setTab(v)}
        sx={{
          mb: 2.5,
          minHeight: 40,
          borderBottom: `1px solid ${C.hairline}`,
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 600,
            fontSize: 13.5,
            minHeight: 40,
            color: C.muted,
            "&.Mui-selected": { color: C.navy },
          },
          "& .MuiTabs-indicator": { backgroundColor: C.red, height: 2 },
        }}
      >
        <Tab value="content" label="Content readiness" />
        <Tab value="live" label="Live page readiness" />
      </Tabs>

      {tab === "content" ? (
        <Box>
          <Typography sx={{ fontSize: 13, color: C.muted, mb: 2, maxWidth: 720 }}>
            Every stored library piece is scored against the seven checks before it ships. Worst first — the
            piece at the top is the one an answer engine is least able to quote.
          </Typography>
          <ContentReadinessPanel />
        </Box>
      ) : (
        <Box>
          <Typography sx={{ fontSize: 13, color: C.muted, mb: 2, maxWidth: 720 }}>
            The same seven checks run against a published page as it is served, plus what its HTML declares:
            FAQPage / Article JSON-LD and a visible date.
          </Typography>
          <LivePageReadinessPanel />
        </Box>
      )}
    </Box>
  );
}

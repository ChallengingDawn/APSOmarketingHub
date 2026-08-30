"use client";

// VISITORS — the traffic and the customers in one view. GA4 counts people
// and sessions; HubSpot counts the companies it can identify. The units are
// different, so they stand side by side with their units named — this is a
// comparison, not a funnel.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useReportingWindow, windowQuery } from "@/app/window/ReportingWindow";
import { Gate, INK, MUTED, Section, SourceNote, SubAppHead } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import type { Ga4Overview } from "@/app/analytics/integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { ShareBar } from "@/app/charts/ShareBar";
import { compact, full, percent } from "@/app/charts/format";
import type { ActiveCompanies, ContactsCreated, SegmentCounts } from "@/lib/integrations/hubspotJourney";

type Journey = { companies: ActiveCompanies; contacts: ContactsCreated; segments: SegmentCounts };

export default function VisitorsPage() {
  const { window: win, days, label } = useReportingWindow();
  const q = windowQuery(win);
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);

  const ga4 = useHeld<Ga4Overview>(`/api/integrations/ga4?${q}`, [q, tick]);
  const journey = useHeld<Journey>(`/api/integrations/hubspot?report=journey&${q}`, [q, tick]);

  return (
    <Box>
      <SubAppHead
        title="Visitors"
        purpose={`How much traffic apsoparts.com had in ${label.toLowerCase()}, and how much of it HubSpot can put a company name to.`}
      />

      <Gate held={ga4} source="Google Analytics 4" loadingLabel="Reading traffic…" onRetry={retry}>
        {(g, ga4Stale) => (
          <Gate held={journey} source="HubSpot" loadingLabel="Reading known companies…" onRetry={retry}>
            {(j, jStale) => {
              const stale = ga4Stale || jStale;
              const known = j.companies.total;
              const customers = j.segments.customersActive;
              return (
                <Box sx={{ opacity: stale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
                  <Grid container spacing={2} sx={{ mb: 2.5 }}>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <StatTile label="Visitors" value={compact(g.totals?.totalUsers ?? null)} note="People or devices, counted by GA4" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <StatTile label="Sessions" value={compact(g.totals?.sessions ?? null)} note="Visits, counted by GA4" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <StatTile label="Known companies" value={compact(known)} note="Companies HubSpot identified on the site" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                      <StatTile
                        label="APSO customers among them"
                        value={compact(customers)}
                        note={known && customers !== null ? `${percent(customers / known, 0)} of known companies` : "core, growth, micro"}
                      />
                    </Grid>
                  </Grid>

                  <Section sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>Two rulers, one window</Typography>
                    <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 2, maxWidth: 860 }}>
                      GA4 counts anonymous people and their visits; HubSpot counts the companies its tracking can name. A visitor
                      only becomes a known company after someone from there identifies themselves, so the two numbers measure
                      different things — the interesting figure is how the known slice splits.
                    </Typography>
                    <ChartFrame
                      title="Known companies by segment"
                      caption="Every company HubSpot saw on the site in the window, split by APSO segment"
                      stale={stale}
                      empty={j.segments.apsoSegments.length === 0 ? "No segment counts returned." : null}
                      table={{
                        columns: ["Segment", "Companies"],
                        numeric: [1],
                        rows: j.segments.apsoSegments.map((s) => [s.label, full(s.count)]),
                      }}
                    >
                      <ShareBar segments={j.segments.apsoSegments.map((s) => ({ label: s.label, value: s.count }))} />
                    </ChartFrame>
                  </Section>

                  <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12, lg: 6 }}>
                      <Section sx={{ height: "100%" }}>
                        <ChartFrame
                          title="By sales priority"
                          caption="Known companies on the site, one HubSpot count per priority"
                          stale={stale}
                          empty={j.segments.priorities.length === 0 ? "No priority counts returned." : null}
                          table={{
                            columns: ["Priority", "Companies"],
                            numeric: [1],
                            rows: j.segments.priorities.map((s) => [s.label, full(s.count)]),
                          }}
                        >
                          <BarList rows={j.segments.priorities.map((s) => ({ label: s.label, value: s.count }))} labelWidth={230} maxLabel={34} />
                        </ChartFrame>
                      </Section>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 6 }}>
                      <Section sx={{ height: "100%" }}>
                        <ChartFrame
                          title="Where sessions come from"
                          caption="GA4 sessions by channel, the same window"
                          stale={stale}
                          empty={g.channels.length === 0 ? "GA4 returned no channel rows." : null}
                          table={{
                            columns: ["Channel", "Sessions"],
                            numeric: [1],
                            rows: g.channels.map((c) => [c.key, full(c.sessions)]),
                          }}
                        >
                          <BarList rows={g.channels.map((c) => ({ label: c.key, value: c.sessions }))} labelWidth={170} />
                        </ChartFrame>
                      </Section>
                    </Grid>
                  </Grid>

                  <SourceNote>
                    Sources: GA4 property {g.propertyId} totals for the window; HubSpot company counts on hs_analytics_last_timestamp,
                    one search per segment and priority option. Window {win.from} → {win.to} ({days} days). The two systems count
                    different units and are never divided into each other.
                  </SourceNote>
                </Box>
              );
            }}
          </Gate>
        )}
      </Gate>
    </Box>
  );
}

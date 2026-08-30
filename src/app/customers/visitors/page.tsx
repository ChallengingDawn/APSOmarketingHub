"use client";

// VISITORS — what the audience does, not a repeat of other pages. Four
// behaviours across the same window: visiting, identifying, creating an
// account, buying — each from the system that actually measures it — then
// the people HubSpot saw on the site by lifecycle stage, and where sessions
// convert least.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useReportingWindow, windowQuery } from "@/app/window/ReportingWindow";
import { Gate, INK, MUTED, Section, SourceNote, SubAppHead } from "@/app/analytics/Shell";
import { metricOf, useHeld } from "@/app/analytics/AnalyticsData";
import type { Ga4TableReport } from "@/app/analytics/integrationApi";
import { StatTile } from "@/app/charts/StatTile";
import { BarList } from "@/app/charts/BarList";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { ShareBar } from "@/app/charts/ShareBar";
import { compact, full, percent } from "@/app/charts/format";
import type { Audience, ContactsCreated, SegmentCounts } from "@/lib/integrations/hubspotJourney";

type Journey = { contacts: ContactsCreated; segments: SegmentCounts };

export default function VisitorsPage() {
  const { window: win, days, label } = useReportingWindow();
  const q = windowQuery(win);
  const [tick, setTick] = useState(0);
  const retry = () => setTick((n) => n + 1);

  const conv = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=conversionTotals&${q}`, [q, tick]);
  const keyEvents = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=keyEventsByName&${q}`, [q, tick]);
  const channels = useHeld<Ga4TableReport>(`/api/integrations/ga4?report=acquisitionChannels&${q}`, [q, tick]);
  const journey = useHeld<Journey>(`/api/integrations/hubspot?report=journey&${q}`, [q, tick]);
  const audience = useHeld<Audience>(`/api/integrations/hubspot?report=audience&${q}`, [q, tick]);

  return (
    <Box>
      <SubAppHead
        title="Visitors"
        purpose={`What the audience did in ${label.toLowerCase()} — visited, identified themselves, created an account, bought — and who the identified ones are.`}
      />

      <Gate held={conv} source="Google Analytics 4" loadingLabel="Reading behaviour…" onRetry={retry}>
        {(report, stale) => {
          const row = report.rows[0];
          const m = (name: string) => (row ? metricOf(report, name)(row) : null);
          const sessions = m("sessions");
          const visitors = m("totalUsers");
          const convRate = m("sessionKeyEventRate");
          const notConverting = convRate === null || sessions === null ? null : Math.round(sessions * (1 - convRate));

          const ker = keyEvents.result;
          const events =
            ker && ker.state === "ok"
              ? new Map(ker.data.rows.map((r) => [r.keys[0], metricOf(ker.data, "keyEvents")(r)]))
              : null;
          const signUps = events ? events.get("sign_up") ?? null : null;
          const purchases = events ? events.get("purchase") ?? null : null;

          return (
            <Box sx={{ opacity: stale ? 0.7 : 1, transition: "opacity 160ms ease" }}>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Visited" value={compact(visitors)} note={`${compact(sessions)} sessions · GA4`} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Sessions that converted"
                    value={percent(convRate)}
                    note="At least one key event in the session · GA4"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Created an account"
                    value={compact(signUps)}
                    note={signUps === null ? "No sign_up key event returned for this window" : "sign_up key events · GA4"}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Bought"
                    value={compact(purchases)}
                    note={purchases === null ? "No purchase key event returned for this window" : "purchase key events · GA4"}
                  />
                </Grid>
              </Grid>

              <Section sx={{ mb: 2.5 }}>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 0.25 }}>
                  Visited without converting
                </Typography>
                <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 2 }}>
                  {notConverting !== null && convRate !== null
                    ? `${compact(notConverting)} sessions — ${percent(1 - convRate)} of the window — ended without a single key event. The channels below convert least, which is where preparation pays.`
                    : "GA4 did not return a session key-event rate for this window."}
                </Typography>
                <Gate held={channels} source="Google Analytics 4" loadingLabel="Reading channels…" onRetry={retry}>
                  {(ch, chStale) => {
                    const s = metricOf(ch, "sessions");
                    const k = metricOf(ch, "keyEvents");
                    const rows = ch.rows
                      .map((r) => {
                        const sess = s(r);
                        const kev = k(r);
                        const rate = sess && kev !== null ? kev / sess : null;
                        return { label: r.keys[0], value: sess, rate };
                      })
                      .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1));
                    return (
                      <ChartFrame
                        title="Channels by conversion"
                        caption="Sessions per channel, sorted worst-converting first — key events per session beside each"
                        stale={chStale}
                        empty={rows.length === 0 ? "GA4 returned no channel rows." : null}
                        table={{
                          columns: ["Channel", "Sessions", "Key events / session"],
                          numeric: [1, 2],
                          rows: rows.map((r) => [r.label, full(r.value), r.rate === null ? "—" : percent(r.rate)]),
                        }}
                      >
                        <BarList
                          rows={rows.map((r) => ({ label: r.label, value: r.value, secondary: r.rate === null ? "" : `${percent(r.rate)} convert` }))}
                          labelWidth={170}
                        />
                      </ChartFrame>
                    );
                  }}
                </Gate>
              </Section>

              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Section sx={{ height: "100%" }}>
                    <Gate held={audience} source="HubSpot" loadingLabel="Reading who was identified…" onRetry={retry}>
                      {(a, aStale) => (
                        <ChartFrame
                          title="People identified on the site"
                          caption={`${full(a.activeContacts)} contacts had a session in the window — by the portal's lifecycle stages`}
                          stale={aStale}
                          empty={a.byLifecycle.length === 0 ? "No lifecycle counts returned." : null}
                          table={{
                            columns: ["Lifecycle stage", "Contacts"],
                            numeric: [1],
                            rows: a.byLifecycle.map((s2) => [s2.label, full(s2.count)]),
                          }}
                        >
                          <BarList rows={a.byLifecycle.map((s2) => ({ label: s2.label, value: s2.count }))} labelWidth={190} />
                        </ChartFrame>
                      )}
                    </Gate>
                  </Section>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Section sx={{ height: "100%" }}>
                    <Gate held={journey} source="HubSpot" loadingLabel="Reading company segments…" onRetry={retry}>
                      {(j, jStale) => (
                        <ChartFrame
                          title="Companies identified on the site"
                          caption="Split by APSO segment — click through on the Overview to see the companies themselves"
                          stale={jStale}
                          empty={j.segments.apsoSegments.length === 0 ? "No segment counts returned." : null}
                          table={{
                            columns: ["Segment", "Companies"],
                            numeric: [1],
                            rows: j.segments.apsoSegments.map((s2) => [s2.label, full(s2.count)]),
                          }}
                        >
                          <ShareBar segments={j.segments.apsoSegments.map((s2) => ({ label: s2.label, value: s2.count }))} />
                        </ChartFrame>
                      )}
                    </Gate>
                  </Section>
                </Grid>
              </Grid>

              <SourceNote>
                Sources: GA4 totals, key events and channel key-event rates; HubSpot contact and company counts on
                hs_analytics_last_timestamp. Window {win.from} → {win.to} ({days} days). GA4 counts people and sessions,
                HubSpot counts records it identified — the two are never divided into each other.
              </SourceNote>
            </Box>
          );
        }}
      </Gate>
    </Box>
  );
}

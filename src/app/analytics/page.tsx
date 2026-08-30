"use client";

// OVERVIEW — how the site is doing. Four figures with their change against
// the previous equivalent window, the sessions trend, the channel mix and the
// pages people arrive on. Every number is a value GA4 returned.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import { useAnalytics } from "./AnalyticsData";
import { Gate, Section, SourceNote, SubAppHead } from "./Shell";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { TrendChart } from "@/app/charts/TrendChart";
import { BarList } from "@/app/charts/BarList";
import { ShareBar } from "@/app/charts/ShareBar";
import { change, compact, dayLabel, full, percent, shortLabel } from "@/app/charts/format";

export default function AnalyticsOverviewPage() {
  const { overview, windowDays, reload } = useAnalytics();
  const versus = `previous ${windowDays} days`;

  return (
    <Box>
      <SubAppHead
        title="Overview"
        purpose={`What apsoparts.com earned in the last ${windowDays} days, and how that compares with the ${windowDays} days before.`}
      />

      <Gate held={overview} source="Google Analytics 4" loadingLabel="Reading the property…" onRetry={reload}>
        {(data, stale) => {
          const t = data.totals;
          const p = data.previousTotals;
          const dailySessions = data.daily.map((d) => d.sessions);
          const sparkline = dailySessions.slice(-12);
          const trend = data.daily.map((d) => ({ x: d.date, value: d.sessions }));
          const channels = data.channels.map((c) => ({ label: c.key, value: c.sessions }));
          const landing = data.landingPages.slice(0, 8).map((l) => ({
            label: l.key,
            value: l.sessions,
            secondary: `${percent(l.engagementRate, 0)} engaged`,
          }));

          return (
            <Box sx={{ opacity: stale ? 0.6 : 1, transition: "opacity 160ms ease" }}>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Sessions"
                    value={compact(t?.sessions ?? null)}
                    delta={{ ratio: change(t?.sessions, p?.sessions), versus }}
                    trend={sparkline}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Users"
                    value={compact(t?.totalUsers ?? null)}
                    delta={{ ratio: change(t?.totalUsers, p?.totalUsers), versus }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="New users"
                    value={compact(t?.newUsers ?? null)}
                    delta={{ ratio: change(t?.newUsers, p?.newUsers), versus }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Engagement rate"
                    value={percent(t?.engagementRate ?? null)}
                    delta={{ ratio: change(t?.engagementRate, p?.engagementRate), versus }}
                  />
                </Grid>
              </Grid>

              <Section sx={{ mb: 2.5 }}>
                <ChartFrame
                  title="Sessions per day"
                  caption={`${data.daily.length} days returned for the window ending today`}
                  stale={stale}
                  empty={data.daily.length < 2 ? "GA4 returned fewer than two days, so there is no trend to draw." : null}
                  table={{
                    columns: ["Day", "Sessions", "Users", "Engagement"],
                    numeric: [1, 2, 3],
                    rows: data.daily.map((d) => [dayLabel(d.date), full(d.sessions), full(d.totalUsers), percent(d.engagementRate)]),
                  }}
                >
                  <TrendChart data={trend} seriesLabel="Sessions" />
                </ChartFrame>
              </Section>

              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Channel mix"
                      caption="Share of sessions by default channel group"
                      stale={stale}
                      empty={channels.length === 0 ? "GA4 returned no channel rows for this window." : null}
                      table={{
                        columns: ["Channel", "Sessions"],
                        numeric: [1],
                        rows: channels.map((c) => [c.label, full(c.value)]),
                      }}
                    >
                      <ShareBar segments={channels} />
                    </ChartFrame>
                  </Section>
                </Grid>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Top landing pages"
                      caption="Where sessions begin, by sessions"
                      stale={stale}
                      empty={landing.length === 0 ? "GA4 returned no landing-page rows for this window." : null}
                      table={{
                        columns: ["Landing page", "Sessions", "Engagement"],
                        numeric: [1, 2],
                        rows: data.landingPages.map((l) => [shortLabel(l.key, 80), full(l.sessions), percent(l.engagementRate)]),
                      }}
                    >
                      <BarList rows={landing} />
                    </ChartFrame>
                  </Section>
                </Grid>
              </Grid>

              <SourceNote>
                Source: GA4 property {data.propertyId}, window {data.range.startDate} → {data.range.endDate}. Deltas compare
                the equivalent window immediately before{p ? "" : " — which GA4 did not return this time, so no delta is shown"}.
                No value on this page is estimated, modelled or sampled.
              </SourceNote>
            </Box>
          );
        }}
      </Gate>
    </Box>
  );
}

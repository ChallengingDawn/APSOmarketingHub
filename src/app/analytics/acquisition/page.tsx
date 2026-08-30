"use client";

// ACQUISITION — where visitors come from. Channel groups ranked by sessions,
// the share each takes, and the source / medium pairs beneath them.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import { metricOf, sumOf, useAnalytics, useGa4Report } from "../AnalyticsData";
import { Gate, Section, SourceNote, SubAppHead } from "../Shell";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { ShareBar } from "@/app/charts/ShareBar";
import { compact, full, percent } from "@/app/charts/format";

export default function AcquisitionPage() {
  const { windowDays, reload } = useAnalytics();
  const channels = useGa4Report("acquisitionChannels");
  const sources = useGa4Report("acquisitionSources");

  return (
    <Box>
      <SubAppHead
        title="Acquisition"
        purpose={`Which channels and sources brought sessions in the last ${windowDays} days, and how engaged each one was.`}
      />

      <Gate held={channels} source="Google Analytics 4" loadingLabel="Reading channel groups…" onRetry={reload}>
        {(report, stale) => {
          const sessions = metricOf(report, "sessions");
          const newUsers = metricOf(report, "newUsers");
          const engagement = metricOf(report, "engagementRate");
          const keyEvents = metricOf(report, "keyEvents");
          const rows = report.rows.map((r) => ({
            label: r.keys[0],
            value: sessions(r),
            secondary: `${percent(engagement(r), 0)} engaged`,
          }));
          const totalSessions = sumOf(report, "sessions");
          const totalNew = sumOf(report, "newUsers");
          const totalKey = sumOf(report, "keyEvents");
          const top = report.rows[0];

          return (
            <Box sx={{ opacity: stale ? 0.6 : 1, transition: "opacity 160ms ease" }}>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Sessions across channels" value={compact(totalSessions)} note={`${report.rows.length} channel groups`} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="New users" value={compact(totalNew)} note="First-time visitors in the window" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Key events" value={compact(totalKey)} note="Conversions GA4 counts as key events" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Largest channel"
                    value={top ? top.keys[0] : "—"}
                    note={top && totalSessions ? `${percent((sessions(top) ?? 0) / totalSessions, 0)} of sessions` : "No rows"}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Channel share"
                      caption="Sessions by default channel group"
                      stale={stale}
                      empty={rows.length === 0 ? "GA4 returned no channel rows." : null}
                      table={{ columns: ["Channel", "Sessions"], numeric: [1], rows: rows.map((r) => [r.label, full(r.value)]) }}
                    >
                      <ShareBar segments={rows.map((r) => ({ label: r.label, value: r.value }))} />
                    </ChartFrame>
                  </Section>
                </Grid>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <Section sx={{ height: "100%" }}>
                    <ChartFrame
                      title="Channels by sessions"
                      caption="With the engagement rate beside each"
                      stale={stale}
                      empty={rows.length === 0 ? "GA4 returned no channel rows." : null}
                      table={{
                        columns: ["Channel", "Sessions", "New users", "Engagement", "Key events"],
                        numeric: [1, 2, 3, 4],
                        rows: report.rows.map((r) => [r.keys[0], full(sessions(r)), full(newUsers(r)), percent(engagement(r)), full(keyEvents(r))]),
                      }}
                    >
                      <BarList rows={rows} labelWidth={170} />
                    </ChartFrame>
                  </Section>
                </Grid>
              </Grid>
            </Box>
          );
        }}
      </Gate>

      <Box sx={{ mt: 2.5 }}>
        <Gate held={sources} source="Google Analytics 4" loadingLabel="Reading sources…" onRetry={reload}>
          {(report, stale) => {
            const sessions = metricOf(report, "sessions");
            const newUsers = metricOf(report, "newUsers");
            const engagement = metricOf(report, "engagementRate");
            const keyEvents = metricOf(report, "keyEvents");
            const rows = report.rows.map((r) => ({
              label: r.keys[0],
              value: sessions(r),
              secondary: `${compact(newUsers(r))} new`,
            }));
            return (
              <Section>
                <ChartFrame
                  title="Source / medium"
                  caption={`Top ${report.rows.length} pairs by sessions${report.truncated ? " — the head of a longer list" : ""}`}
                  stale={stale}
                  empty={rows.length === 0 ? "GA4 returned no source rows." : null}
                  table={{
                    columns: ["Source / medium", "Sessions", "New users", "Engagement", "Key events"],
                    numeric: [1, 2, 3, 4],
                    rows: report.rows.map((r) => [r.keys[0], full(sessions(r)), full(newUsers(r)), percent(engagement(r)), full(keyEvents(r))]),
                  }}
                >
                  <BarList rows={rows} labelWidth={240} maxLabel={44} />
                </ChartFrame>
              </Section>
            );
          }}
        </Gate>
      </Box>

      <SourceNote>
        Source: GA4 Data API, dimensions sessionDefaultChannelGroup and sessionSourceMedium for the last {windowDays} days.
        Nothing here is estimated, modelled or sampled.
      </SourceNote>
    </Box>
  );
}

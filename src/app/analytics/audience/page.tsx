"use client";

// AUDIENCE — who the visitors are. Device split, new against returning, and
// the countries sessions come from.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import { metricOf, useAnalytics, useGa4Report } from "../AnalyticsData";
import { Gate, Section, SourceNote, SubAppHead } from "../Shell";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { ShareBar } from "@/app/charts/ShareBar";
import { compact, duration, full, percent } from "@/app/charts/format";

export default function AudiencePage() {
  const { windowDays, reload } = useAnalytics();
  const devices = useGa4Report("devices");
  const countries = useGa4Report("countries");
  const returning = useGa4Report("newVsReturning");

  return (
    <Box>
      <SubAppHead title="Audience" purpose={`Who visited in the last ${windowDays} days — on what, for the first time or again, and from where.`} />

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Section sx={{ height: "100%" }}>
            <Gate held={devices} source="Google Analytics 4" loadingLabel="Reading devices…" onRetry={reload}>
              {(report, stale) => {
                const sessions = metricOf(report, "sessions");
                const engagement = metricOf(report, "engagementRate");
                const avg = metricOf(report, "averageSessionDuration");
                return (
                  <ChartFrame
                    title="Devices"
                    caption="Share of sessions by device category"
                    stale={stale}
                    empty={report.rows.length === 0 ? "GA4 returned no device rows." : null}
                    table={{
                      columns: ["Device", "Sessions", "Engagement", "Avg. duration"],
                      numeric: [1, 2, 3],
                      rows: report.rows.map((r) => [r.keys[0], full(sessions(r)), percent(engagement(r)), duration(avg(r))]),
                    }}
                  >
                    <ShareBar segments={report.rows.map((r) => ({ label: r.keys[0], value: sessions(r) }))} />
                    <Box sx={{ mt: 2.5 }}>
                      <BarList
                        rows={report.rows.map((r) => ({
                          label: r.keys[0],
                          value: sessions(r),
                          secondary: `${percent(engagement(r), 0)} engaged · ${duration(avg(r))}`,
                        }))}
                        labelWidth={110}
                      />
                    </Box>
                  </ChartFrame>
                );
              }}
            </Gate>
          </Section>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Section sx={{ height: "100%" }}>
            <Gate held={returning} source="Google Analytics 4" loadingLabel="Reading new against returning…" onRetry={reload}>
              {(report, stale) => {
                const sessions = metricOf(report, "sessions");
                const engagement = metricOf(report, "engagementRate");
                const rows = report.rows.filter((r) => r.keys[0] && r.keys[0] !== "(not set)");
                return (
                  <ChartFrame
                    title="New against returning"
                    caption="Sessions from first-time visitors and from people coming back"
                    stale={stale}
                    empty={rows.length === 0 ? "GA4 returned no new/returning rows." : null}
                    table={{
                      columns: ["Visitor", "Sessions", "Engagement"],
                      numeric: [1, 2],
                      rows: rows.map((r) => [r.keys[0], full(sessions(r)), percent(engagement(r))]),
                    }}
                  >
                    <ShareBar segments={rows.map((r) => ({ label: r.keys[0], value: sessions(r) }))} />
                    <Box sx={{ mt: 2.5 }}>
                      <BarList
                        rows={rows.map((r) => ({ label: r.keys[0], value: sessions(r), secondary: `${percent(engagement(r), 0)} engaged` }))}
                        labelWidth={110}
                      />
                    </Box>
                  </ChartFrame>
                );
              }}
            </Gate>
          </Section>
        </Grid>
      </Grid>

      <Section>
        <Gate held={countries} source="Google Analytics 4" loadingLabel="Reading countries…" onRetry={reload}>
          {(report, stale) => {
            const sessions = metricOf(report, "sessions");
            const newUsers = metricOf(report, "newUsers");
            const engagement = metricOf(report, "engagementRate");
            return (
              <ChartFrame
                title="Countries"
                caption={`Top ${report.rows.length} by sessions`}
                stale={stale}
                empty={report.rows.length === 0 ? "GA4 returned no country rows." : null}
                table={{
                  columns: ["Country", "Sessions", "New users", "Engagement"],
                  numeric: [1, 2, 3],
                  rows: report.rows.map((r) => [r.keys[0], full(sessions(r)), full(newUsers(r)), percent(engagement(r))]),
                }}
              >
                <BarList
                  rows={report.rows.map((r) => ({ label: r.keys[0], value: sessions(r), secondary: `${compact(newUsers(r))} new` }))}
                  labelWidth={160}
                />
              </ChartFrame>
            );
          }}
        </Gate>
      </Section>

      <SourceNote>
        Source: GA4 Data API, dimensions deviceCategory, newVsReturning and country for the last {windowDays} days. Nothing here is
        estimated, modelled or sampled.
      </SourceNote>
    </Box>
  );
}

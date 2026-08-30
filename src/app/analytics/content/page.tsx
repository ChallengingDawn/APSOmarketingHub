"use client";

// CONTENT — what people read and where they arrive. Pages by views with how
// long they hold attention, and landing pages by the sessions they open.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import { metricOf, sumOf, useAnalytics, useGa4Report } from "../AnalyticsData";
import { Gate, Section, SourceNote, SubAppHead } from "../Shell";
import { StatTile } from "@/app/charts/StatTile";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { compact, duration, full, percent } from "@/app/charts/format";

export default function ContentPage() {
  const { windowDays, reload } = useAnalytics();
  const pages = useGa4Report("pages");
  const landing = useGa4Report("landingPages");

  return (
    <Box>
      <SubAppHead
        title="Content"
        purpose={`The pages that carried attention in the last ${windowDays} days, and the ones sessions started on.`}
      />

      <Gate held={pages} source="Google Analytics 4" loadingLabel="Reading pages…" onRetry={reload}>
        {(report, stale) => {
          const views = metricOf(report, "screenPageViews");
          const sessions = metricOf(report, "sessions");
          const engagement = metricOf(report, "engagementRate");
          const avg = metricOf(report, "averageSessionDuration");
          const rows = report.rows.map((r) => ({
            label: r.keys[0],
            value: views(r),
            secondary: `${duration(avg(r))} avg`,
          }));
          const totalViews = sumOf(report, "screenPageViews");
          const top = report.rows[0];
          return (
            <Box sx={{ opacity: stale ? 0.6 : 1, transition: "opacity 160ms ease", mb: 2.5 }}>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Page views, top pages" value={compact(totalViews)} note={`Across the ${report.rows.length} pages returned`} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile label="Most viewed" value={top ? compact(views(top)) : "—"} note={top ? top.keys[0] : "No rows"} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Longest hold"
                    value={(() => {
                      const best = [...report.rows].sort((a, b) => (avg(b) ?? 0) - (avg(a) ?? 0))[0];
                      return best ? duration(avg(best)) : "—";
                    })()}
                    note="Average session duration on its best page"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <StatTile
                    label="Engagement on top page"
                    value={top ? percent(engagement(top)) : "—"}
                    note={top ? `${compact(sessions(top))} sessions` : "No rows"}
                  />
                </Grid>
              </Grid>
              <Section>
                <ChartFrame
                  title="Pages by views"
                  caption={`Top ${report.rows.length} page paths${report.truncated ? " — the head of a longer list" : ""}`}
                  stale={stale}
                  empty={rows.length === 0 ? "GA4 returned no page rows." : null}
                  table={{
                    columns: ["Page", "Views", "Sessions", "Engagement", "Avg. duration"],
                    numeric: [1, 2, 3, 4],
                    rows: report.rows.map((r) => [r.keys[0], full(views(r)), full(sessions(r)), percent(engagement(r)), duration(avg(r))]),
                  }}
                >
                  <BarList rows={rows} labelWidth={260} maxLabel={48} />
                </ChartFrame>
              </Section>
            </Box>
          );
        }}
      </Gate>

      <Gate held={landing} source="Google Analytics 4" loadingLabel="Reading landing pages…" onRetry={reload}>
        {(report, stale) => {
          const sessions = metricOf(report, "sessions");
          const newUsers = metricOf(report, "newUsers");
          const engagement = metricOf(report, "engagementRate");
          const keyEvents = metricOf(report, "keyEvents");
          const rows = report.rows.map((r) => ({
            label: r.keys[0],
            value: sessions(r),
            secondary: `${compact(keyEvents(r))} key events`,
          }));
          return (
            <Section sx={{ opacity: stale ? 0.6 : 1, transition: "opacity 160ms ease" }}>
              <ChartFrame
                title="Landing pages by sessions"
                caption="Where sessions begin, with the key events those sessions produced"
                stale={stale}
                empty={rows.length === 0 ? "GA4 returned no landing-page rows." : null}
                table={{
                  columns: ["Landing page", "Sessions", "New users", "Engagement", "Key events"],
                  numeric: [1, 2, 3, 4],
                  rows: report.rows.map((r) => [r.keys[0], full(sessions(r)), full(newUsers(r)), percent(engagement(r)), full(keyEvents(r))]),
                }}
              >
                <BarList rows={rows} labelWidth={260} maxLabel={48} />
              </ChartFrame>
            </Section>
          );
        }}
      </Gate>

      <SourceNote>
        Source: GA4 Data API, dimensions pagePath and landingPagePlusQueryString for the last {windowDays} days. Nothing here is
        estimated, modelled or sampled.
      </SourceNote>
    </Box>
  );
}

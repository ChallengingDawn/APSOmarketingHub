"use client";

// SITE OVERVIEW — how the site is doing, in the hub's own clothes.
//
// Same four figures, same three panels, same GA4 values: what changed is that
// it is now built from the pieces the UC apps use — the frosted card, the
// tinted badge beside each title, the KPI tile with its change. Erosion and
// this page are the same product; they were drawn by two different hands.
//
// The Chart/Table toggle stays. It is the one control on the page that lets
// somebody check a number rather than read a shape, and a prettier card is not
// worth losing it.

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import TimelineIcon from "@mui/icons-material/Timeline";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import DonutSmallIcon from "@mui/icons-material/DonutSmall";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";

import { useAnalytics } from "@/app/analytics/AnalyticsData";
import { Gate, SourceNote } from "@/app/analytics/Shell";
import { CardTitle, GlassCard, KpiTile } from "@/app/uc/report/ui";
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
      <Gate held={overview} source="Google Analytics 4" loadingLabel="Reading the property…" onRetry={reload}>
        {(data, stale) => {
          const t = data.totals;
          const p = data.previousTotals;
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
                  <KpiTile
                    icon={<TimelineIcon />} tint="blue" label="Sessions"
                    value={compact(t?.sessions ?? null)}
                    delta={{ ratio: change(t?.sessions, p?.sessions), versus }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <KpiTile
                    icon={<GroupsIcon />} tint="green" label="Users"
                    value={compact(t?.totalUsers ?? null)}
                    delta={{ ratio: change(t?.totalUsers, p?.totalUsers), versus }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <KpiTile
                    icon={<PersonAddAltIcon />} tint="purple" label="New users"
                    value={compact(t?.newUsers ?? null)}
                    delta={{ ratio: change(t?.newUsers, p?.newUsers), versus }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <KpiTile
                    icon={<QueryStatsIcon />} tint="amber" label="Engagement rate"
                    value={percent(t?.engagementRate ?? null)}
                    delta={{ ratio: change(t?.engagementRate, p?.engagementRate), versus }}
                  />
                </Grid>
              </Grid>

              <GlassCard sx={{ mb: 2.5 }}>
                <CardTitle
                  icon={<ShowChartIcon />} tint="blue" title="Sessions per day"
                  note={`${data.daily.length} days returned for the window ending today`}
                />
                <ChartFrame
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
              </GlassCard>

              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <GlassCard sx={{ height: "100%" }}>
                    <CardTitle
                      icon={<DonutSmallIcon />} tint="green" title="Channel mix"
                      note="Share of sessions by default channel group"
                    />
                    <ChartFrame
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
                  </GlassCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <GlassCard sx={{ height: "100%" }}>
                    <CardTitle
                      icon={<FlagOutlinedIcon />} tint="purple" title="Top landing pages"
                      note="Where sessions begin, by sessions"
                    />
                    <ChartFrame
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
                  </GlassCard>
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
